'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import admin from 'firebase-admin';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadDocumentData, StageId } from '@/types/crm';
import { parse as parseDate, isValid } from 'date-fns';

const ActionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;

const CsvRowSchema = z.object({
  cliente: z.string().min(1, 'Coluna "Cliente" é obrigatória.'),
  vendedor: z.string().optional(),
  documento: z.string().optional(),
  instalação: z.string().optional(),
  concessionária: z.string().optional(),
  plano: z.string().optional(),
  'consumo (kwh)': z.string().optional(),
  'valor (rs)': z.string().optional(),
  status: z.string().optional(),
  'assinado em': z.string().optional(),
  'finalizado em': z.string().optional(),
  'data referencia venda': z.string().optional(),
  'criado em': z.string().optional(),
  'atualizado em': z.string().optional(),
});

/**
 * Maps a status string from the CSV to a CRM StageId.
 * Prioritizes direct stage names and common contract statuses.
 * @param status The status string from the CSV.
 * @returns A StageId or null if no mapping is found.
 */
function mapStatusToStageId(status: string | undefined): StageId | null {
  const s = status?.trim().toUpperCase().replace(/_/g, ' '); // Normalize
  if (!s) return null;

  if (s.includes('FINALIZADO')) return 'finalizado';
  if (s.includes('ASSINADO')) return 'assinado';
  if (s.includes('CANCELADO')) return 'cancelado';
  if (s.includes('PERDIDO')) return 'perdido';
  if (s.includes('CONFORMIDADE')) return 'conformidade';
  if (s.includes('CONTRATO')) return 'contrato';
  if (s.includes('PROPOSTA')) return 'proposta';
  if (s.includes('FATURA')) return 'fatura';
  if (s.includes('CONTATO')) return 'contato';
  if (s.includes('VALIDACAO')) return 'para-validacao';

  return null;
}

function parseCsvNumber(value: string | undefined): number {
    if (!value) return 0;
    // Remove currency symbols, thousand separators, and use dot as decimal separator
    const cleaned = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleaned);
    return isNaN(number) ? 0 : number;
}

function parseCsvDate(dateStr: string | undefined, format: string): admin.firestore.Timestamp | undefined {
  if (!dateStr) return undefined;
  const parsedDate = parseDate(dateStr, format, new Date());
  return isValid(parsedDate) ? admin.firestore.Timestamp.fromDate(parsedDate) : undefined;
}


export async function importLeadsFromCSV(formData: FormData): Promise<ActionResult> {
  const file = formData.get('csvFile') as File | null;

  if (!file) {
    return { success: false, message: 'Nenhum arquivo enviado.' };
  }

  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    return { success: false, message: 'Formato de arquivo inválido. Por favor, envie um arquivo .csv.' };
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
          let successfulImports = 0;
          let failedImports = 0;
          const errors: string[] = [];
          const batchSize = 400; // Firestore batch limit is 500
          const batches = [];

          for (let i = 0; i < results.data.length; i += batchSize) {
              batches.push(results.data.slice(i, i + batchSize));
          }
          
          for (const batchData of batches) {
              const batch = adminDb.batch();

              for (const row of batchData) {
                  const validation = CsvRowSchema.safeParse(row);
                  if (!validation.success) {
                      failedImports++;
                      errors.push(`Linha inválida: ${JSON.stringify(row)}. Erro: ${validation.error.message}`);
                      continue;
                  }

                  const data = validation.data;
                  const docRef = adminDb.collection("crm_leads").doc();
                  
                  // --- New Stage Logic ---
                  const signedAtDate = parseCsvDate(data['assinado em'], 'dd/MM/yyyy HH:mm');
                  const completedAtDate = parseCsvDate(data['finalizado em'], 'dd/MM/yyyy HH:mm');
                  
                  let stageId: StageId;

                  if (completedAtDate) {
                    stageId = 'finalizado';
                  } else if (signedAtDate) {
                    stageId = 'assinado';
                  } else {
                    stageId = mapStatusToStageId(data.status) || 'contato'; // Fallback to status, then to 'contato'
                  }
                  // --- End New Stage Logic ---

                  const normalizedDocument = data.documento?.replace(/\D/g, '') || '';
                  
                  const leadDataObject: Partial<LeadDocumentData> = {
                      name: data.cliente,
                      sellerName: data.vendedor || "Sistema",
                      cpf: normalizedDocument.length === 11 ? normalizedDocument : undefined,
                      cnpj: normalizedDocument.length === 14 ? normalizedDocument : undefined,
                      customerType: normalizedDocument.length === 11 ? 'pf' : normalizedDocument.length === 14 ? 'pj' : undefined,
                      codigoClienteInstalacao: data.instalação,
                      concessionaria: data.concessionária,
                      plano: data.plano,
                      kwh: parseCsvNumber(data['consumo (kwh)']),
                      value: parseCsvNumber(data['valor (rs)']),
                      stageId: stageId, // Use the new logic
                      signedAt: signedAtDate, // Pass the parsed date
                      completedAt: completedAtDate, // Pass the parsed date
                      saleReferenceDate: data['data referencia venda'],
                      createdAt: parseCsvDate(data['criado em'], 'dd/MM/yyyy HH:mm') || admin.firestore.Timestamp.now(),
                      lastContact: parseCsvDate(data['atualizado em'], 'dd/MM/yyyy HH:mm') || admin.firestore.Timestamp.now(),
                      needsAdminApproval: false, // Default for imported leads
                      userId: 'unassigned', // Default, should be updated manually if needed
                  };

                  // Remove properties that are undefined, as Firestore doesn't allow them.
                  const cleanLeadData = Object.entries(leadDataObject).reduce((acc, [key, value]) => {
                    if (value !== undefined) {
                      acc[key as keyof LeadDocumentData] = value;
                    }
                    return acc;
                  }, {} as Partial<LeadDocumentData>);
                  
                  batch.set(docRef, cleanLeadData);
                  successfulImports++;
              }
              
              await batch.commit();
          }

          resolve({
              success: true,
              message: `Importação concluída. ${successfulImports} leads importados, ${failedImports} falharam.`,
          });
        },
        error: (error: Error) => {
          resolve({ success: false, message: `Erro ao processar o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    console.error('Error in importLeadsFromCSV action:', err);
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    return { success: false, message: `Erro crítico no servidor: ${errorMessage}` };
  }
}
