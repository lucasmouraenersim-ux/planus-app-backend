
'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { StageId } from '@/types/crm';
import { getDocs, collection, query, where, writeBatch, doc } from 'firebase/firestore';
import admin from 'firebase-admin';

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
    if (!header) return '';
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
    "celular": ["telefone"],
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
  console.log('[Leads Action] Received request to upload and process leads.');
  const file = formData.get('csvFile') as File | null;

  if (!file) {
    console.log('[Leads Action] No file uploaded.');
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }

  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    console.log(`[Leads Action] Invalid file format: ${file.type}`);
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
          console.log(`[Leads Action] PapaParse finished. Found ${results.data.length} rows.`);
          if (results.errors.length > 0) {
              console.error("[Leads Action] PapaParse Errors:", results.errors);
          }
          if (!results.meta.fields || results.meta.fields.length === 0) {
              console.log("[Leads Action] Could not detect headers.");
              resolve({ success: false, error: "Não foi possível detectar os cabeçalhos da planilha. Verifique o formato do arquivo." });
              return;
          }

          const headerToFieldMap: { [originalHeader: string]: (keyof LeadDisplayData | 'celular')[] } = {};
          let hasClient = false;
          let hasPhone = false;
          
          results.meta.fields.forEach(header => {
              const normalized = normalizeHeader(header);
              for (const mappingKey in HEADER_MAPPINGS) {
                  if (normalized === mappingKey) {
                      const fields = HEADER_MAPPINGS[mappingKey];
                      headerToFieldMap[header] = fields;
                      if (fields.includes('cliente')) hasClient = true;
                      if (fields.includes('telefone')) hasPhone = true;
                      break;
                  }
              }
          });
          
          console.log('[Leads Action] Header mapping created:', headerToFieldMap);

          if (!hasClient || !hasPhone) {
              const missingColumns = [!hasClient && "'Cliente'", !hasPhone && "'Telefone'"].filter(Boolean).join(' e ');
              console.log(`[Leads Action] Missing required columns: ${missingColumns}.`);
              resolve({ success: false, error: `A(s) coluna(s) ${missingColumns} (ou uma variação como 'Nome', 'WhatsApp') é/são obrigatória(s) e não foi/foram encontrada(s).`});
              return;
          }

          const allPhones = results.data
            .map(row => {
              for (const header in row) {
                const fields = headerToFieldMap[header];
                if (fields && (fields.includes('telefone') || fields.includes('celular'))) {
                   const phoneValue = String(row[header] || '').replace(/\D/g, '');
                   if (phoneValue.length >= 10) return phoneValue;
                }
              }
              return null;
            })
            .filter((phone): phone is string => !!phone);
          
          const uniquePhones = [...new Set(allPhones)];
          console.log(`[Leads Action] Found ${uniquePhones.length} unique phone numbers in CSV to check for duplicates.`);
          const existingPhones = new Set<string>();

          if (uniquePhones.length > 0) {
            const leadsRef = collection(adminDb, "crm_leads");
            for (let i = 0; i < uniquePhones.length; i += 30) {
              const chunk = uniquePhones.slice(i, i + 30);
              const q = query(leadsRef, where('phone', 'in', chunk));
              const querySnapshot = await getDocs(q);
              querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.phone) existingPhones.add(data.phone);
              });
            }
          }
          console.log(`[Leads Action] Found ${existingPhones.size} existing phone numbers in Firestore.`);

          let newLeadsCount = 0;
          let duplicatesSkipped = 0;
          const leadsForDisplay: LeadDisplayData[] = [];
          const batch = writeBatch(adminDb);

          results.data.forEach(row => {
            let phoneValue: string | null = null;
            let clientValue: string | null = null;
            let estagioValue: string | null = null;
            let consumoKwhValue: string | null = null;
            let mediaFaturaValue: string | null = null;
            
            for (const header in row) {
              const fields = headerToFieldMap[header];
              if (fields) {
                if (fields.includes('cliente') && !clientValue) clientValue = String(row[header] || '');
                if (fields.includes('estagio') && !estagioValue) estagioValue = String(row[header] || '');
                if (fields.includes('consumoKwh') && !consumoKwhValue) consumoKwhValue = String(row[header] || '0');
                if (fields.includes('mediaFatura') && !mediaFaturaValue) mediaFaturaValue = String(row[header] || '0');
                if ((fields.includes('telefone') || fields.includes('celular')) && !phoneValue) {
                  const rawPhone = String(row[header] || '');
                  if (rawPhone.length > 0) phoneValue = rawPhone.replace(/\D/g, '');
                }
              }
            }

            if (!clientValue || !phoneValue || phoneValue.length < 10) return;
            if (existingPhones.has(phoneValue)) { duplicatesSkipped++; return; }

            const consumoKwh = parseInt(consumoKwhValue?.replace(/\D/g, '') || '0', 10);
            const mediaFatura = parseFloat(mediaFaturaValue?.replace(',', '.') || '0');
            
            const newLeadRef = doc(collection(adminDb, "crm_leads"));
            
            const leadData = {
              name: clientValue,
              phone: phoneValue,
              stageId: 'para-atribuir' as StageId,
              sellerName: 'Sistema',
              userId: 'unassigned',
              kwh: isNaN(consumoKwh) ? 0 : consumoKwh,
              value: isNaN(mediaFatura) ? 0 : mediaFatura,
              createdAt: admin.firestore.Timestamp.now(),
              lastContact: admin.firestore.Timestamp.now(),
              leadSource: 'Importação CSV' as const,
            };

            batch.set(newLeadRef, leadData);
            existingPhones.add(phoneValue); // Avoid duplicates within the same batch
            newLeadsCount++;
            leadsForDisplay.push({
                id: newLeadRef.id,
                cliente: leadData.name,
                estagio: estagioValue || 'N/A',
                telefone: leadData.phone,
                consumoKwh: leadData.kwh,
                mediaFatura: leadData.value,
            });
          });

          console.log(`[Leads Action] Processed all rows. New leads to create: ${newLeadsCount}. Duplicates skipped: ${duplicatesSkipped}.`);

          if (newLeadsCount > 0) {
            await batch.commit();
            console.log(`[Leads Action] Firestore batch commit successful for ${newLeadsCount} leads.`);
          }
          
          let successMessage = `${newLeadsCount} novo(s) lead(s) importado(s).`;
          if (duplicatesSkipped > 0) { successMessage += ` ${duplicatesSkipped} duplicata(s) foram ignorada(s).`; }
          
          if (newLeadsCount === 0 && results.data.length > 0) {
              if (duplicatesSkipped > 0) { successMessage = `Nenhum lead novo para importar. ${duplicatesSkipped} lead(s) já existia(m) no sistema.`; } 
              else { successMessage = "Nenhum lead válido encontrado no arquivo para importar. Verifique o conteúdo das colunas."; }
          } else if (results.data.length === 0) {
              successMessage = "O arquivo CSV estava vazio ou não continha dados válidos.";
          }
          
          console.log(`[Leads Action] Final message: ${successMessage}`);
          resolve({ success: true, leads: leadsForDisplay, message: successMessage });
        },
        error: (error: Error) => {
          console.error('[Leads Action] PapaParse critical error:', error.message);
          resolve({ success: false, error: `Erro ao processar o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    console.error('[Leads Action] Critical error in uploadAndProcessLeads action:', err);
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    return { success: false, error: `Erro crítico no servidor: ${errorMessage}` };
  }
}

    