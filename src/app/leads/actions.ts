
'use server';

import { z } from 'zod';
import Papa from 'papaparse';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { StageId } from '@/types/crm';
import { getFirestore, Timestamp, collection, where, getDocs, writeBatch, doc } from 'firebase-admin/firestore';

export interface LeadDisplayData {
    id: string;
    cliente: string;
    estagio: string;
    telefone?: string;
    consumoKwh?: number;
    mediaFatura?: number;
}

const ActionResultSchema = z.object({
  success: z.boolean(),
  leads: z.array(z.custom<LeadDisplayData>()).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});
type ActionResult = z.infer<typeof ActionResultSchema>;

function normalizeHeader(header: string): string {
    if (!header) return '';
    return header.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
}

const FIELD_TO_HEADER_ALIASES: Record<string, string[]> = {
    cliente: ["negocio - pessoa de contato"],
    estagio: ["negocio - status"],
    telefone: ["negocio - celular titular", "negocio - telefone"],
    consumoKwh: ["negocio - consumo medio mensal (kwh)"],
    mediaFatura: ["negocio - valor"],
};

export async function uploadAndProcessLeads(formData: FormData): Promise<ActionResult> {
  console.log('[Leads Action] Received request to upload and process leads.');
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
          if (!results.meta.fields || results.meta.fields.length === 0) {
              resolve({ success: false, error: "Não foi possível detectar os cabeçalhos da planilha." });
              return;
          }

          const normalizedHeaders = results.meta.fields.map(normalizeHeader);
          const headerMap: Record<string, string | undefined> = {};
          
          for (const field in FIELD_TO_HEADER_ALIASES) {
              for (const alias of FIELD_TO_HEADER_ALIASES[field]) {
                  const index = normalizedHeaders.indexOf(alias);
                  if (index !== -1) {
                      headerMap[field] = results.meta.fields![index];
                      break;
                  }
              }
          }

          if (!headerMap.cliente || !headerMap.telefone) {
              const missing = [!headerMap.cliente && "'Negócio - Pessoa de contato'", !headerMap.telefone && "'Negócio - Celular Titular'"].filter(Boolean).join(' e ');
              resolve({ success: false, error: `Coluna(s) obrigatória(s) ${missing} não encontrada(s) na planilha.` });
              return;
          }

          const allPhones = results.data
            .map(row => String(row[headerMap.telefone!] || '').replace(/\D/g, ''))
            .filter(phone => phone.length >= 10);
          
          const uniquePhones = [...new Set(allPhones)];
          const existingPhones = new Set<string>();

          if (uniquePhones.length > 0) {
            const leadsRef = collection(adminDb, "crm_leads");
            for (let i = 0; i < uniquePhones.length; i += 30) {
              const chunk = uniquePhones.slice(i, i + 30);
              const q = where('phone', 'in', chunk);
              const querySnapshot = await getDocs(query(leadsRef, q));
              querySnapshot.forEach(doc => existingPhones.add(doc.data().phone));
            }
          }

          let newLeadsCount = 0;
          let duplicatesSkipped = 0;
          const leadsForDisplay: LeadDisplayData[] = [];
          const batch = writeBatch(adminDb);

          results.data.forEach(row => {
            const clientValue = String(row[headerMap.cliente!] || '').trim();
            const phoneValue = String(row[headerMap.telefone!] || '').replace(/\D/g, '');

            if (!clientValue || !phoneValue || phoneValue.length < 10 || existingPhones.has(phoneValue)) {
                if (existingPhones.has(phoneValue)) duplicatesSkipped++;
                return; 
            }

            const estagioValue = headerMap.estagio ? String(row[headerMap.estagio] || '') : 'N/A';
            const consumoKwhValue = headerMap.consumoKwh ? String(row[headerMap.consumoKwh] || '0') : '0';
            const mediaFaturaValue = headerMap.mediaFatura ? String(row[headerMap.mediaFatura] || '0').replace('BRL', '').trim() : '0';

            const consumoKwh = parseInt(consumoKwhValue.replace(/\D/g, ''), 10);
            const mediaFatura = parseFloat(mediaFaturaValue.replace('.', '').replace(',', '.'));
            
            const newLeadRef = doc(collection(adminDb, "crm_leads"));
            
            const leadData = {
              name: clientValue,
              phone: phoneValue,
              stageId: 'para-atribuir' as StageId,
              sellerName: 'Sistema',
              userId: 'unassigned',
              kwh: isNaN(consumoKwh) ? 0 : consumoKwh,
              value: isNaN(mediaFatura) ? 0 : mediaFatura,
              createdAt: Timestamp.now(),
              lastContact: Timestamp.now(),
              leadSource: 'Importação CSV' as const,
            };

            batch.set(newLeadRef, leadData);
            existingPhones.add(phoneValue);
            newLeadsCount++;
            leadsForDisplay.push({
                id: newLeadRef.id,
                cliente: leadData.name,
                estagio: estagioValue,
                telefone: leadData.phone,
                consumoKwh: leadData.kwh,
                mediaFatura: leadData.value,
            });
          });

          if (newLeadsCount > 0) {
            await batch.commit();
          }
          
          let successMessage = `${newLeadsCount} novo(s) lead(s) importado(s) e adicionado(s) ao CRM.`;
          if (duplicatesSkipped > 0) successMessage += ` ${duplicatesSkipped} duplicata(s) foram ignorada(s).`;
          
          if (newLeadsCount === 0 && results.data.length > 0) {
              successMessage = `Nenhum lead novo para importar. ${duplicatesSkipped > 0 ? `${duplicatesSkipped} lead(s) já existiam no sistema.` : 'Verifique se os dados da planilha estão corretos.'}`;
          }

          resolve({ success: true, leads: leadsForDisplay, message: successMessage });
        },
        error: (error: Error) => {
          console.error('[Leads Action] PapaParse error:', error);
          resolve({ success: false, error: `Erro ao processar o CSV: ${error.message}` });
        },
      });
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
    console.error('[Leads Action] Critical server error:', err);
    return { success: false, error: `Erro crítico no servidor: ${errorMessage}` };
  }
}
