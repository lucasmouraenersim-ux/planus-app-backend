'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { type OutboundLead } from '@/actions/whatsapp/sendBulkWhatsappMessages';

const CsvRowSchema = z.object({
  nome: z.string().optional(),
  numero: z.string().optional(),
});

const ActionResultSchema = z.object({
  success: z.boolean(),
  leads: z.array(z.custom<OutboundLead>()).optional(),
  error: z.string().optional(),
  info: z.string().optional(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;


export async function uploadLeadsFromCSV(formData: FormData): Promise<ActionResult> {
  const file = formData.get('csvFile') as File | null;

  if (!file) {
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }

  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    return { success: false, error: 'Formato de arquivo inválido. Por favor, envie um arquivo .csv.' };
  }

  try {
    const fileContent = await file.text();
    
    return new Promise((resolve) => {
      Papa.parse<z.infer<typeof CsvRowSchema>>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.toLowerCase().trim(),
        complete: (results) => {
          const validLeads: OutboundLead[] = [];
          const errorDetails: { row: number; reason: string }[] = [];

          results.data.forEach((row, index) => {
            const rowNum = index + 2; 

            if (!row.nome?.trim() && !row.numero?.trim()) {
              return;
            }

            const validation = CsvRowSchema.safeParse(row);
            if (!validation.success || !validation.data.nome || !validation.data.numero) {
              errorDetails.push({ row: rowNum, reason: "Colunas 'nome' ou 'numero' ausentes ou vazias." });
              return;
            }
            
            // Phone number is passed as-is; normalization happens in the flow
            const phone = validation.data.numero;

            if (phone.replace(/\D/g, '').length < 10) {
                errorDetails.push({ row: rowNum, reason: `Número '${validation.data.numero}' inválido.` });
                return;
            }

            validLeads.push({
              id: `csv-${Date.now()}-${index}`,
              name: validation.data.nome.trim(),
              phone: phone, 
              consumption: 0,
              company: undefined,
            });
          });

          if (validLeads.length === 0) {
            const firstErrorReason = errorDetails.length > 0
              ? `Exemplo de erro na linha ${errorDetails[0].row}: ${errorDetails[0].reason}`
              : "Verifique se as colunas 'nome' e 'numero' existem e estão preenchidas.";
            resolve({ success: false, error: `Nenhum lead válido encontrado no arquivo. ${firstErrorReason}` });
            return;
          }

          let infoMessage = undefined;
          if (errorDetails.length > 0) {
            infoMessage = `${errorDetails.length} linha(s) foram ignoradas por conterem erros (ex: número inválido na linha ${errorDetails[0].row}).`;
          }

          resolve({ success: true, leads: validLeads, info: infoMessage });
        },
        error: (error: Error) => {
          resolve({ success: false, error: `Erro ao processar o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    console.error('Error reading file:', err);
    return { success: false, error: 'Não foi possível ler o arquivo enviado.' };
  }
}
