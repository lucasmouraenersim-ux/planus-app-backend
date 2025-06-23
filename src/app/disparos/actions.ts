
'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { type OutboundLead } from '@/ai/flows/send-bulk-whatsapp-messages-flow';

// Define the schema for a single CSV row
const CsvRowSchema = z.object({
  nome: z.string().min(1, 'A coluna "nome" não pode estar vazia.'),
  numero: z.string().min(10, 'A coluna "numero" deve ter pelo menos 10 dígitos.'),
});

// Define the schema for the action's return type
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
          const errorRows: number[] = [];

          results.data.forEach((row, index) => {
            // Skip if row is essentially empty
            if (!row.nome && !row.numero) {
              return;
            }
            const validation = CsvRowSchema.safeParse(row);
            if (validation.success) {
              validLeads.push({
                id: `csv-${Date.now()}-${index}`,
                name: validation.data.nome.trim(),
                phone: validation.data.numero.replace(/\D/g, ''), // Normalize phone number
                consumption: 0, // Default value as it's not in the CSV
                company: undefined,
              });
            } else {
              errorRows.push(index + 2); // +2 because index is 0-based and header is line 1
            }
          });

          if (validLeads.length === 0) {
            resolve({ success: false, error: `Nenhum lead válido encontrado. Verifique o arquivo CSV na linha ${errorRows[0]} ou se as colunas 'nome' e 'numero' existem.` });
            return;
          }

          let infoMessage = undefined;
          if (errorRows.length > 0) {
            infoMessage = `${errorRows.length} linha(s) foram ignoradas por conterem erros.`;
          }

          resolve({ success: true, leads: validLeads, info: infoMessage });
        },
        error: (error: Error) => {
          resolve({ success: false, error: `Erro ao parsear o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    console.error('Error reading file:', err);
    return { success: false, error: 'Não foi possível ler o arquivo enviado.' };
  }
}
