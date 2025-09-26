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

const CsvRowSchema = z.object({
  cliente: z.string().min(1, 'Coluna "cliente" é obrigatória.'),
  documento: z.string().optional(),
  'recorrencia paga': z.string().min(1, 'Coluna "recorrencia paga" é obrigatória'),
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
          const batch = writeBatch(adminDb);

          for (const [index, row] of results.data.entries()) {
            const validation = CsvRowSchema.safeParse(row);
            if (!validation.success) {
              errors.push(`Linha ${index + 2}: ${validation.error.message}`);
              continue;
            }

            const { cliente, documento } = validation.data;
            const recorrenciaPagaValue = validation.data['recorrencia paga'].toLowerCase();
            const isPaid = ['sim', 'pago', 'true', '1'].includes(recorrenciaPagaValue);

            let q;
            if (documento && documento.replace(/\D/g, '').length >= 11) {
              const normalizedDoc = documento.replace(/\D/g, '');
              q = query(leadsRef, where(normalizedDoc.length === 11 ? 'cpf' : 'cnpj', '==', normalizedDoc));
            } else {
              q = query(leadsRef, where('name', '==', cliente));
            }

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const leadDoc = querySnapshot.docs[0];
              batch.update(leadDoc.ref, { recorrenciaPaga: isPaid });
              updatedCount++;
            } else {
              notFoundCount++;
              errors.push(`Lead não encontrado para cliente: "${cliente}" ou documento: "${documento}"`);
            }

            // Commit batch in chunks to avoid exceeding limits
            if (index > 0 && index % 400 === 0) {
              await batch.commit();
              // Re-initialize batch, although writeBatch can be reused in some SDK versions, this is safer.
              // A new batch must be created after commit.
            }
          }

          // Commit any remaining changes
          if (updatedCount > 0) {
             await batch.commit();
          }

          let message = `Importação concluída. ${updatedCount} status de recorrência atualizados.`;
          if (notFoundCount > 0) {
            message += ` ${notFoundCount} leads não foram encontrados.`;
          }
          if (errors.length > 0) {
            console.warn("Erros durante a importação:", errors.slice(0, 10)); // Log first 10 errors
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
