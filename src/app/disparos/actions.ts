
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
        complete: (results) => {
          // Check for parsing errors from Papaparse itself
          if (results.errors.length > 0) {
             const firstError = results.errors[0];
             resolve({ success: false, error: `Erro na linha ${firstError.row}: ${firstError.message}` });
             return;
          }

          const parsedData = results.data;
          const validation = z.array(CsvRowSchema).safeParse(parsedData);

          if (!validation.success) {
            // Provide a more detailed error message from Zod
            const firstError = validation.error.errors[0];
            const errorPath = firstError.path;
            const errorMessage = `Erro na linha ${ (errorPath[0] as number) + 2 }: ${firstError.message} (na coluna '${errorPath[1]}').`;
            resolve({ success: false, error: errorMessage });
            return;
          }
          
          const outboundLeads: OutboundLead[] = validation.data.map((row, index) => ({
            id: `csv-${Date.now()}-${index}`,
            name: row.nome.trim(),
            phone: row.numero.replace(/\D/g, ''), // Normalize phone number
            consumption: 0, // Default value as it's not in the CSV
            company: undefined,
          }));

          resolve({ success: true, leads: outboundLeads });
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
