
'use server';
/**
 * @fileoverview Script de depuração para buscar leads específicos e verificar seus dados.
 */

import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadDocumentData } from '@/types/crm';

async function debugLeads() {
  console.log("Iniciando script de depuração de leads...");
  const adminDb = await initializeAdmin();
  const leadsRef = adminDb.collection('crm_leads');
  
  const leadNamesToDebug = [
      "CHM Promotora de Vendas LTDA", // Nome completo conforme CRM
      "Vitoria Giovana Moraes"
  ];

  try {
    console.log("Buscando pelos seguintes leads:", leadNamesToDebug.join(', '));
    
    for (const leadName of leadNamesToDebug) {
        const q = leadsRef.where('name', '==', leadName).limit(1);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            console.log(`\n❌ NENHUM LEAD ENCONTRADO com o nome: "${leadName}"`);
        } else {
            const leadDoc = querySnapshot.docs[0];
            const leadData = leadDoc.data() as LeadDocumentData;

            console.log(`\n✅ LEAD ENCONTRADO: "${leadName}" (ID: ${leadDoc.id})`);
            console.log("--------------------------------------------------");
            console.log(`  - Nome do Vendedor: ${leadData.sellerName}`);
            console.log(`  - ID do Usuário (userId): ${leadData.userId}`);
            console.log(`  - Estágio (stageId): ${leadData.stageId}`);
            console.log(`  - Criado em: ${leadData.createdAt ? (leadData.createdAt as any).toDate() : 'N/A'}`);
            console.log(`  - Último Contato: ${leadData.lastContact ? (leadData.lastContact as any).toDate() : 'N/A'}`);
            console.log("  - Dados completos:", JSON.stringify(leadData, null, 2));
            console.log("--------------------------------------------------");
        }
    }
    
    console.log("\nScript de depuração concluído.");

  } catch (error) {
    console.error("\n❌ Erro crítico durante a execução do script:", error);
  }
}

// Executa a função de teste
debugLeads();
