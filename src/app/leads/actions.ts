
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
const HEADER_MAPPINGS: Record<keyof LeadDisplayData, string[]> = {
    id: [], // Not from CSV
    cliente: ["negocio - pessoa do contato", "nome do contato", "cliente", "nome"],
    estagio: ["negocio - status", "estagio negociacao", "status", "estagio"],
    telefone: ["negocio - celular titular", "whatsapp", "telefone", "celular"],
    consumoKwh: ["negocio - consumo medio mensal (kwh)", "consumo (kwh)", "consumo"],
    mediaFatura: ["media r$", "media fatura", "valor medio"],
};

/**
 * Finds the canonical field name for a given CSV header.
 * @param header The header from the CSV file.
 * @returns The canonical field name or null if not found.
 */
function getCanonicalField(header: string): keyof LeadDisplayData | null {
    const normalizedHeader = normalizeHeader(header);
    for (const key in HEADER_MAPPINGS) {
        if (HEADER_MAPPINGS[key as keyof LeadDisplayData].includes(normalizedHeader)) {
            return key as keyof LeadDisplayData;
        }
    }
    return null;
}

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
          }
          if (!results.meta.fields) {
              resolve({ success: false, error: "Não foi possível detectar os cabeçalhos da planilha. Verifique o formato do arquivo." });
              return;
          }

          const fieldMap: { [key: string]: keyof LeadDisplayData } = {};
          results.meta.fields.forEach(header => {
              const canonicalField = getCanonicalField(header);
              if (canonicalField) {
                  fieldMap[header] = canonicalField;
              }
          });

          // Check if essential fields were found
          if (!fieldMap['cliente'] && !Object.values(fieldMap).includes('cliente')) {
              resolve({ success: false, error: "A coluna 'Cliente' ('Nome do contato' ou 'Negócio - Pessoa do contato') é obrigatória e não foi encontrada."});
              return;
          }

          const allPhones = results.data
            .map(row => (row.Telefone || row.WhatsApp || row['Negócio - Celular Titular'])?.replace(/\D/g, ''))
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
            const cliente = row['Cliente'] || row['Nome do contato'] || row['Negócio - Pessoa do contato'];
            const telefoneRaw = row['Telefone'] || row['WhatsApp'] || row['Negócio - Celular Titular'];
            const telefone = telefoneRaw?.replace(/\D/g, '');

            if (!cliente || !telefone || telefone.length < 10) {
                return; // Skip rows without essential data
            }

            if (existingPhones.has(telefone)) {
              duplicatesSkipped++;
              return; // Skip duplicate
            }

            const consumoKwh = parseInt(row['Consumo (KWh)'] || row['Consumo'] || row['Negócio - Consumo Médio Mensal (Kwh)'] || '0');
            const mediaFatura = parseFloat((row['Media R$'] || row['Media Fatura'] || '0').replace(',', '.'));
            
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

          await batch.commit();
          
          resolve({
            success: true,
            leads: leadsForDisplay,
            message: `${newLeadsCount} novos leads importados. ${duplicatesSkipped} duplicatas foram ignoradas.`,
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
