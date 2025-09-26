'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { initializeAdmin } from '@/lib/firebase/admin';
import { updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

const ActionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;

// Schema updated to reflect the user's spreadsheet columns
const CsvRowSchema = z.object({
  cliente: z.string().min(1, 'Coluna "cliente" é obrigatória.'),
  documento: z.string().optional(), // 'Documento' can be used for matching
  'parcelas pagas': z.string().optional(), // Main column to check for payment
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
    const adminDb = await initializeAdmin();
    const fileContent = await file.text();
    
    return new Promise((resolve) => {
      Papa.parse<z.infer<typeof CsvRowSchema>>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.toLowerCase().trim(),
        complete: async (results) => {
          let updatedCount = 0;
          let notFoundCount = 0;
          const errors: string[] = [];
          const leadsRef = collection(adminDb, "crm_leads");
          
          const BATCH_SIZE = 400;

          // Using a for...of loop with await to process sequentially
          for (let i = 0; i < results.data.length; i += BATCH_SIZE) {
            const batch = writeBatch(adminDb);
            const chunk = results.data.slice(i, i + BATCH_SIZE);

            for (const row of chunk) {
              const validation = CsvRowSchema.safeParse(row);
              if (!validation.success) {
                // errors.push(`Linha ${i + 2}: ${validation.error.message}`);
                continue; // Skip rows that don't match the basic schema
              }

              const { cliente, documento } = validation.data;
              const parcelasPagasValue = validation.data['parcelas pagas'];
              
              // Determine if paid based on 'Parcelas pagas' being a number > 0
              const isPaid = parcelasPagasValue ? parseInt(parcelasPagasValue, 10) > 0 : false;

              let q;
              // Prioritize document (CPF/CNPJ) for matching if available
              if (documento && documento.replace(/\D/g, '').length >= 11) {
                const normalizedDoc = documento.replace(/\D/g, '');
                q = query(leadsRef, where(normalizedDoc.length === 11 ? 'cpf' : 'cnpj', '==', normalizedDoc));
              } else {
                // Fallback to client name
                q = query(leadsRef, where('name', '==', cliente));
              }

              try {
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  const leadDoc = querySnapshot.docs[0];
                  batch.update(leadDoc.ref, { recorrenciaPaga: isPaid });
                  updatedCount++;
                } else {
                  notFoundCount++;
                  // errors.push(`Lead não encontrado para cliente: "${cliente}" ou documento: "${documento}"`);
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
                // Handle batch commit error, maybe resolve with failure
            }
          }

          let message = `Importação concluída. ${updatedCount} status de recorrência atualizados.`;
          if (notFoundCount > 0) {
            message += ` ${notFoundCount} leads não foram encontrados.`;
          }
          if (errors.length > 0) {
            console.warn("Erros durante a importação (amostra):", errors.slice(0, 10)); 
          }

          resolve({ success: true, message });
        },
        error: (err) => {
          resolve({ success: false, message: `Erro ao processar CSV: ${err.message}` });
        },
      });
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    return { success: false, message: `Erro crítico: ${errorMessage}` };
  }
}
