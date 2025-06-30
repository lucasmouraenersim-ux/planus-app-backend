
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
  'valor (r$)': z.string().optional(),
  status: z.string().optional(),
  'assinado em': z.string().optional(),
  'finalizado em': z.string().optional(),
  'data referencia venda': z.string().optional(),
  'criado em': z.string().optional(),
  'atualizado em': z.string().optional(),
});

const KWH_TO_REAIS_FACTOR = 1.093113;

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
          let successfulUpdates = 0;
          let failedImports = 0;
          const errors: string[] = [];

          const installationCodes = results.data
              .map(row => row['instalação']?.trim())
              .filter((code): code is string => !!code);
          const uniqueInstallationCodes = [...new Set(installationCodes)];

          const existingLeadsMap = new Map<string, { id: string }>();
          if (uniqueInstallationCodes.length > 0) {
              const leadsRef = adminDb.collection("crm_leads");
              for (let i = 0; i < uniqueInstallationCodes.length; i += 30) {
                  const chunk = uniqueInstallationCodes.slice(i, i + 30);
                  const querySnapshot = await leadsRef.where('codigoClienteInstalacao', 'in', chunk).get();
                  querySnapshot.forEach(doc => {
                      const data = doc.data() as LeadDocumentData;
                      if (data.codigoClienteInstalacao) {
                          existingLeadsMap.set(data.codigoClienteInstalacao, { id: doc.id });
                      }
                  });
              }
          }

          const batchSize = 400;
          for (let i = 0; i < results.data.length; i += batchSize) {
              const batch = adminDb.batch();
              const batchData = results.data.slice(i, i + batchSize);
              
              for (const row of batchData) {
                  const validation = CsvRowSchema.safeParse(row);
                  if (!validation.success) {
                      failedImports++;
                      errors.push(`Linha inválida: ${JSON.stringify(row)}. Erro: ${validation.error.message}`);
                      continue;
                  }

                  const data = validation.data;
                  const instalacao = data['instalação']?.trim();
                  const existingLead = instalacao ? existingLeadsMap.get(instalacao) : undefined;

                  const signedAtDate = parseCsvDate(data['assinado em'], 'dd/MM/yyyy HH:mm');
                  const completedAtDate = parseCsvDate(data['finalizado em'], 'dd/MM/yyyy HH:mm');
                  let stageId: StageId;
                  if (completedAtDate) { stageId = 'finalizado'; } 
                  else if (signedAtDate) { stageId = 'assinado'; } 
                  else { stageId = mapStatusToStageId(data.status) || 'contato'; }

                  const normalizedDocument = data.documento?.replace(/\D/g, '') || '';
                  const kwh = parseCsvNumber(data['consumo (kwh)']);
                  const valorFaturado = parseCsvNumber(data['valor (r$)']);
                  const valorOriginal = kwh * KWH_TO_REAIS_FACTOR;
                  const discountPercentage = valorOriginal > 0 ? (1 - (valorFaturado / valorOriginal)) * 100 : 0;

                  const leadDataObject: Partial<LeadDocumentData> = {
                      name: data.cliente,
                      sellerName: data.vendedor,
                      cpf: normalizedDocument.length === 11 ? normalizedDocument : undefined,
                      cnpj: normalizedDocument.length === 14 ? normalizedDocument : undefined,
                      customerType: normalizedDocument.length === 11 ? 'pf' : (normalizedDocument.length === 14 ? 'pj' : undefined),
                      codigoClienteInstalacao: data.instalação,
                      concessionaria: data.concessionária,
                      plano: data.plano,
                      kwh,
                      value: valorOriginal,
                      valueAfterDiscount: valorFaturado,
                      discountPercentage: discountPercentage,
                      stageId,
                      signedAt: signedAtDate,
                      completedAt: completedAtDate,
                      saleReferenceDate: data['data referencia venda'],
                      lastContact: parseCsvDate(data['atualizado em'], 'dd/MM/yyyy HH:mm') || admin.firestore.Timestamp.now(),
                  };

                  const cleanLeadData = Object.fromEntries(
                    Object.entries(leadDataObject).filter(([, v]) => v !== undefined && v !== null && v !== '')
                  );

                  if (existingLead) {
                      const docRef = adminDb.collection("crm_leads").doc(existingLead.id);
                      batch.update(docRef, cleanLeadData);
                      successfulUpdates++;
                  } else if (instalacao) {
                      const docRef = adminDb.collection("crm_leads").doc();
                      const createData = {
                        ...cleanLeadData,
                        createdAt: parseCsvDate(data['criado em'], 'dd/MM/yyyy HH:mm') || admin.firestore.Timestamp.now(),
                        userId: 'unassigned',
                        needsAdminApproval: false,
                        commissionPaid: false,
                      };
                      batch.set(docRef, createData);
                      successfulImports++;
                  }
              }
              await batch.commit();
          }

          resolve({
              success: true,
              message: `Importação concluída. ${successfulImports} importados, ${successfulUpdates} atualizados, ${failedImports} falharam.`,
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
