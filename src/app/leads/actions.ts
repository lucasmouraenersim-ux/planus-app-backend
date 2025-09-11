
'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { StageId } from '@/types/crm';

// Defines the structure of the data we want to display on the frontend table.
export interface LeadDisplayData {
    id: string;
    cliente: string;
    estagio: string;
    telefone?: string;
    consumoKwh?: number;
    mediaFatura?: number;
}

// Defines the output of our server action.
const ActionResultSchema = z.object({
  success: z.boolean(),
  leads: z.array(z.custom<LeadDisplayData>()).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Normalizes a header name by converting to lowercase, trimming, and removing accents.
 * @param header The header string to normalize.
 * @returns The normalized header string.
 */
function normalizeHeader(header: string): string {
    return header
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Maps possible CSV header names to our canonical field names.
 * This allows for flexibility in the imported spreadsheet.
 */
const HEADER_MAPPINGS: Record<string, (keyof LeadDisplayData | 'celular')[]> = {
    "negocio - pessoa do contato": ["cliente"],
    "nome do contato": ["cliente"],
    "cliente": ["cliente"],
    "nome": ["cliente"],
    "negocio - status": ["estagio"],
    "estagio negociacao": ["estagio"],
    "status": ["estagio"],
    "estagio": ["estagio"],
    "negocio - celular titular": ["telefone"],
    "whatsapp": ["telefone"],
    "telefone": ["telefone"],
    "celular": ["celular"], // Keep celular for mapping logic
    "negocio - consumo medio mensal (kwh)": ["consumoKwh"],
    "consumo (kwh)": ["consumoKwh"],
    "consumo": ["consumoKwh"],
    "media r$": ["mediaFatura"],
    "media fatura": ["mediaFatura"],
    "valor medio": ["mediaFatura"],
};


/**
 * A server action to upload a CSV file, process its content, check for duplicates in Firestore,
 * and save new leads to the 'crm_leads' collection.
 * 
 * @param formData The FormData object containing the uploaded CSV file.
 * @returns An ActionResult object with the processing result.
 */
export async function uploadAndProcessLeads(formData: FormData): Promise<ActionResult> {
  const file = formData.get('csvFile') as File | null;

  if (!file) {
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }

  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    return { success: false, error: 'Formato de arquivo inválido. Por favor, envie um arquivo .csv.' };
  }

  try {
    const adminDb = await initializeAdmin();
    const fileContent = await file.text();
    
    return new Promise((resolve) => {
      Papa.parse<any>(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (results.errors.length > 0) {
              console.error("PapaParse Errors:", results.errors);
              // Even with errors, we might have valid data, so we continue but log it.
          }
          if (!results.meta.fields || results.meta.fields.length === 0) {
              resolve({ success: false, error: "Não foi possível detectar os cabeçalhos da planilha. Verifique o formato do arquivo." });
              return;
          }

          // Create a map from original header to canonical field name
          const headerToFieldMap: { [originalHeader: string]: (keyof LeadDisplayData | 'celular') } = {};
          let hasClient = false;
          results.meta.fields.forEach(header => {
              const normalized = normalizeHeader(header);
              const fields = HEADER_MAPPINGS[normalized];
              if (fields) {
                  // We just take the first match.
                  headerToFieldMap[header] = fields[0];
                  if (fields.includes('cliente')) {
                    hasClient = true;
                  }
              }
          });

          if (!hasClient) {
              resolve({ success: false, error: "A coluna 'Cliente' (ou uma variação como 'Nome') é obrigatória e não foi encontrada."});
              return;
          }

          // Dynamically find phone numbers using the map
          const allPhones = results.data
            .map(row => {
              for (const originalHeader in headerToFieldMap) {
                  const mappedField = headerToFieldMap[originalHeader];
                  if ((mappedField === 'telefone' || mappedField === 'celular') && row[originalHeader]) {
                      return String(row[originalHeader]).replace(/\D/g, '');
                  }
              }
              return null;
            })
            .filter((phone): phone is string => !!phone && phone.length >= 10);
          
          const uniquePhones = [...new Set(allPhones)];
          const existingPhones = new Set<string>();

          // Check for existing phones in Firestore in chunks of 30
          if (uniquePhones.length > 0) {
            const leadsRef = adminDb.collection("crm_leads");
            for (let i = 0; i < uniquePhones.length; i += 30) {
              const chunk = uniquePhones.slice(i, i + 30);
              const q = leadsRef.where('phone', 'in', chunk);
              const querySnapshot = await q.get();
              querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.phone) existingPhones.add(data.phone);
              });
            }
          }

          let newLeadsCount = 0;
          let duplicatesSkipped = 0;
          const leadsForDisplay: LeadDisplayData[] = [];
          const batch = adminDb.batch();

          results.data.forEach(row => {
            const processedRow: Partial<LeadDisplayData & { celular?: string }> = {};
            for (const header in row) {
                const field = headerToFieldMap[header];
                if (field) {
                    (processedRow as any)[field] = row[header];
                }
            }

            const cliente = processedRow.cliente;
            // Get phone number from any of the possible mapped fields
            const telefone = (processedRow.telefone || processedRow.celular || '').replace(/\D/g, '');


            if (!cliente || !telefone || telefone.length < 10) {
                return; // Skip rows without essential data
            }

            if (existingPhones.has(telefone)) {
              duplicatesSkipped++;
              return; // Skip duplicate
            }

            const consumoKwh = parseInt(String(processedRow.consumoKwh || '0').replace(/\D/g, ''));
            const mediaFatura = parseFloat(String(processedRow.mediaFatura || '0').replace(',', '.'));
            
            const newLeadRef = adminDb.collection("crm_leads").doc();
            
            const leadData = {
              name: cliente,
              phone: telefone,
              stageId: 'para-atribuir' as StageId,
              sellerName: 'Sistema',
              userId: 'unassigned',
              kwh: isNaN(consumoKwh) ? 0 : consumoKwh,
              value: isNaN(mediaFatura) ? 0 : mediaFatura,
              createdAt: new Date(),
              lastContact: new Date(),
              leadSource: 'Importação CSV' as const,
            };

            batch.set(newLeadRef, leadData);
            existingPhones.add(telefone); // Add to set to avoid duplicates within the same file
            newLeadsCount++;
            leadsForDisplay.push({
                id: newLeadRef.id,
                cliente: leadData.name,
                estagio: leadData.stageId,
                telefone: leadData.phone,
                consumoKwh: leadData.kwh,
                mediaFatura: leadData.value,
            });
          });

          if (newLeadsCount > 0) {
            await batch.commit();
          }
          
          let successMessage = `${newLeadsCount} novo(s) lead(s) importado(s).`;
          if (duplicatesSkipped > 0) {
            successMessage += ` ${duplicatesSkipped} duplicata(s) foram ignorada(s).`;
          }
          if (newLeadsCount === 0 && results.data.length > 0) {
              if (duplicatesSkipped > 0) {
                successMessage = `Nenhum lead novo para importar. ${duplicatesSkipped} lead(s) já existia(m) no sistema.`;
              } else {
                successMessage = "Nenhum lead válido encontrado no arquivo para importar. Verifique o conteúdo das colunas.";
              }
          } else if (results.data.length === 0) {
              successMessage = "O arquivo CSV estava vazio ou não continha dados válidos.";
          }


          resolve({
            success: true,
            leads: leadsForDisplay,
            message: successMessage,
          });
        },
        error: (error: Error) => {
          resolve({ success: false, error: `Erro ao processar o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    console.error('Error in uploadAndProcessLeads action:', err);
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    return { success: false, error: `Erro crítico no servidor: ${errorMessage}` };
  }
}
