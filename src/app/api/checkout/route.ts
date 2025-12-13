
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase/admin';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Define a URL base (Produção ou Sandbox)
const ASAAS_API_URL = process.env.ASAAS_ENV === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://www.asaas.com/api/v3';

// Pega a chave do ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

export async function POST(req: Request) {
  console.log("🚀 [API Checkout] Iniciando processamento...");

  try {
    const { db } = await initializeAdmin(); // Chama a função para obter o db
    
    // 1. Validação de Segurança Básica
    if (!ASAAS_API_KEY) {
      console.error("❌ [API Checkout] ERRO: ASAAS_API_KEY não encontrada no .env.local");
      return NextResponse.json({ error: 'Configuração de servidor inválida (Falta API Key).' }, { status: 500 });
    }

    const body = await req.json();
    const { userId, itemId, type } = body;

    console.log(`📦 [API Checkout] Item: ${itemId}, Usuário: ${userId}`);

    if (!userId) {
      return NextResponse.json({ error: 'Usuário não identificado.' }, { status: 400 });
    }

    // 2. Buscar dados do Usuário no Firebase
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'Usuário não encontrado no banco de dados.' }, { status: 404 });
    }
    const userData = userSnap.data();

    // 3. Definir o Preço baseado no ID do pacote
    let price = 0;
    let description = '';

    switch (itemId) {
        case 'pack_10': price = 30; description = 'Recarga 10 Créditos - Sent Energia'; break;
        case 'pack_50': price = 125; description = 'Recarga 50 Créditos - Sent Energia'; break;
        case 'pack_100': price = 200; description = 'Recarga 100 Créditos - Sent Energia'; break;
        case 'starter_monthly': price = 97; description = 'Assinatura Starter - Sent Energia'; break;
        case 'pro_monthly': price = 197; description = 'Assinatura Pro - Sent Energia'; break;
        default: return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 });
    }

    // 4. Criar Cliente no Asaas (Se ainda não tiver ID)
    let asaasCustomerId = userData.asaasCustomerId;

    if (!asaasCustomerId) {
      console.log("👤 [API Checkout] Criando cliente no Asaas...");
      
      const createCustomerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: userData.displayName || 'Cliente Sent Energia',
          email: userData.email,
          cpfCnpj: userData.cpf || userData.documento || userData.cnpj || '00000000000', // Tenta achar um documento ou envia genérico (Asaas pode reclamar se for vazio)
          externalReference: userId
        })
      });
      
      const customerData = await createCustomerRes.json();
      
      if (customerData.id) {
        asaasCustomerId = customerData.id;
        // Salva o ID do Asaas no Firebase para usar na próxima vez
        await updateDoc(userRef, { asaasCustomerId });
      } else {
        // Se der erro na criação do cliente, retorna o erro do Asaas
        console.error("❌ [API Checkout] Erro ao criar cliente Asaas:", customerData);
        return NextResponse.json({ error: 'Erro ao cadastrar cliente no financeiro.', details: customerData }, { status: 400 });
      }
    }

    // 5. Criar a Cobrança
    console.log(`💸 [API Checkout] Gerando cobrança para ID: ${asaasCustomerId}`);
    
    const billingRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED', // Permite o usuário escolher como pagar
        value: price,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vence em 3 dias
        description: description,
        externalReference: userId, // Importante para o Webhook
        postalService: false
      })
    });

    const billingData = await billingRes.json();

    if (!billingData.invoiceUrl) {
      console.error("❌ [API Checkout] Erro ao gerar cobrança:", billingData);
      return NextResponse.json({ error: 'Erro ao gerar link de pagamento.', details: billingData }, { status: 400 });
    }

    // 6. Sucesso! Retorna o link
    console.log("✅ [API Checkout] Sucesso! URL:", billingData.invoiceUrl);
    return NextResponse.json({ paymentUrl: billingData.invoiceUrl });

  } catch (error: any) {
    console.error("❌ [API Checkout] Erro Fatal:", error);
    return NextResponse.json({ error: 'Erro interno no servidor.', details: error.message }, { status: 500 });
  }
}
