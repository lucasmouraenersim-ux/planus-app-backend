
'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { initializeAdmin } from '@/lib/firebase/admin';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase-admin/firestore';


const ActionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;

const CsvRowSchema = z.object({
  cliente: z.string().optional(),
  documento: z.string().optional(),
  'parcelas pagas': z.string().optional(),
}).refine(data => data.cliente || data.documento, {
  message: 'Pelo menos "cliente" ou "documento" deve ser fornecido.',
});


export async function importRecurrenceStatusFromCSV(formData: FormData): Promise<ActionResult> {
  const file = formData.get('csvFile') as File | null;

  if (!file) {
    return { success: false, message: 'Nenhum arquivo enviado.' };
  }
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    return { success: false, message: 'Formato de arquivo inválido. Envie um .csv.' };
  }
  
  try {
    const fileContent = await file.text();
    
    return new Promise((resolve) => {
      Papa.parse<z.infer<typeof CsvRowSchema>>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.toLowerCase().trim(),
        complete: async (results) => {
          let updatedCount = 0;
          let notFoundCount = 0;
          let invalidRowCount = 0;
          const errors: string[] = [];

          try {
            const { db: adminDb } = await initializeAdmin();
            const leadsRef = collection(adminDb, "crm_leads");
            
            const BATCH_SIZE = 400;

            for (let i = 0; i < results.data.length; i += BATCH_SIZE) {
              const batch = writeBatch(adminDb);
              const chunk = results.data.slice(i, i + BATCH_SIZE);

              for (const row of chunk) {
                const validation = CsvRowSchema.safeParse(row);
                if (!validation.success) {
                  invalidRowCount++;
                  continue; 
                }

                const { cliente, documento } = validation.data;
                const parcelasPagasValue = validation.data['parcelas pagas'];
                
                const isPaid = parcelasPagasValue ? parseInt(parcelasPagasValue, 10) > 0 : false;

                if (!isPaid) {
                    continue; // Skip if not paid
                }
                
                let q;
                if (documento && documento.replace(/\D/g, '').length >= 11) {
                  const normalizedDoc = documento.replace(/\D/g, '');
                  q = query(leadsRef, where(normalizedDoc.length === 11 ? 'cpf' : 'cnpj', '==', normalizedDoc));
                } else if (cliente) {
                  q = query(leadsRef, where('name', '==', cliente));
                } else {
                   invalidRowCount++;
                   continue;
                }

                try {
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                    const leadDoc = querySnapshot.docs[0];
                    batch.update(leadDoc.ref, { recorrenciaPaga: isPaid });
                    updatedCount++;
                  } else {
                    notFoundCount++;
                  }
                } catch (qError) {
                    console.error(`Query failed for row: ${JSON.stringify(row)}`, qError);
                    errors.push(`Query failed for "${cliente}"`);
                }
              }
               
              try {
                  await batch.commit();
              } catch(commitError) {
                  console.error("Batch commit failed:", commitError);
              }
            }

            let message = `Importação concluída. ${updatedCount} status de recorrência atualizados para 'Pago'.`;
            if (notFoundCount > 0) {
              message += ` ${notFoundCount} leads não foram encontrados.`;
            }
             if (invalidRowCount > 0) {
              message += ` ${invalidRowCount} linhas foram ignoradas por dados inválidos.`;
            }
            if (errors.length > 0) {
              console.warn("Erros durante a importação (amostra):", errors.slice(0, 10)); 
            }

            resolve({ success: true, message });

          } catch (initError) {
            console.error("[IMPORT_RECURRENCE] Critical Firebase initialization or query error:", initError);
            const errorMessage = initError instanceof Error ? initError.message : 'Erro ao conectar ao banco de dados.';
            resolve({ success: false, message: `Erro de Servidor: ${errorMessage}` });
          }
        },
        error: (err) => {
          console.error("[IMPORT_RECURRENCE] PapaParse error:", err);
          resolve({ success: false, message: `Erro ao processar CSV: ${err.message}` });
        },
      });
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    console.error("[IMPORT_RECURRENCE] Critical file read error:", err);
    return { success: false, message: `Erro crítico na leitura do arquivo: ${errorMessage}` };
  }
}
