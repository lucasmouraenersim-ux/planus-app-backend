
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  // 1. Verificação de Segurança
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Configuração de servidor inválida: Falta OPENAI_API_KEY' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    // 2. Extração de Texto do PDF
    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text;
    } catch (e) {
      return NextResponse.json({ error: 'O arquivo PDF está corrompido ou protegido.' }, { status: 422 });
    }

    // 3. Extração de Dados via IA (Prompt Especializado para Soma e Classificação)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
            role: "system", 
            content: "Você é um auditor de faturas de energia. Sua especialidade é somar múltiplas linhas de compensação (GD) e identificar a classificação técnica do cliente." 
        },
        {
          role: "user",
          content: `Extraia os dados técnicos desta fatura.

          1. TARIFA UNITÁRIA (tarifaUnit):
             - Procure na linha "Consumo em kWh". Pegue o valor da coluna "Preço Unit" (ex: 1,087600).

          2. ENERGIA INJETADA (GDI) - SOMA OBRIGATÓRIA:
             - A fatura pode ter VÁRIAS linhas de "Energia Atv Injetada" (ex: "GDI mUC 10/2025", "GDI mUC 11/2024").
             - TAREFA: Encontre TODAS essas linhas.
             - Extraia a QUANTIDADE (kWh) de cada uma. DICA: É o número positivo (ex: 4.768,00) que vem antes do preço. NÃO pegue o valor monetário negativo.
             - SOME todas as quantidades que tiverem "mUC" -> campo 'injectedEnergyMUC'.
             - SOME todas as quantidades que tiverem "oUC" -> campo 'injectedEnergyOUC'.

          3. CLASSIFICAÇÃO E TENSÃO (CRÍTICO):
             - classificacaoTexto: Extraia o texto após "Classificação:". (Ex: B3 COMERCIAL, GRUPO A, BAIXA RENDA).
             - tensaoNominalDisp: Procure "TENSÃO NOMINAL EM VOLTS" e pegue o valor "DISP".
             - temReativaExcedente: Procure se existe o item "Energia Reativa Exced" na lista de cobrança. (true/false).

          4. DADOS GERAIS:
             - nomeCliente, consumoKwh, valorTotal, vencimento, mediaConsumo.

          LOCALIZAÇÃO:
             - enderecoCompleto, cidade, estado.

          Retorne APENAS JSON:
          {
            "nomeCliente": string,
            "consumoKwh": number,
            "valorTotal": number,
            "vencimento": string,
            "mediaConsumo": number,
            "tarifaUnit": number,
            "injectedEnergyMUC": number,
            "injectedEnergyOUC": number,
            "classificacaoTexto": string,
            "tensaoNominalDisp": number,
            "temReativaExcedente": boolean,
            "enderecoCompleto": string,
            "cidade": string,
            "estado": string
          }

          TEXTO DA FATURA:
          """${textoFatura.substring(0, 15000)}"""`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const rawContent = completion.choices[0].message.content;
    if (!rawContent) throw new Error("A IA não retornou conteúdo.");
    
    const dados = JSON.parse(rawContent);

    // 4. Regras de Negócio
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = Number(dados.injectedEnergyOUC || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    // Elegibilidade
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';
    if (injetadaOUC > 0) gdEligibility = 'oportunidade';
    else if (injetadaMUC > 0) {
        if ((consumo - injetadaMUC) > 1000) gdEligibility = 'elegivel';
        else gdEligibility = 'inelegivel';
    }

    // Classificação Automática (Tensão)
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';
    const classText = (dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;

    if (classText.includes('BAIXA RENDA')) {
        tensaoType = 'baixa_renda';
    } else if (classText.includes('ALTA TENSÃO') || classText.includes('GRUPO A')) {
        tensaoType = 'alta';
    } else {
        // Regra B Optante: Tensão alta disponível OU cobrança de reativa
        if (tensaoDisp >= 13800 || temReativa || classText.includes('OPTANTE')) {
            tensaoType = 'b_optante';
        } else {
            tensaoType = 'baixa';
        }
    }

    // 5. Geocoding
    let geoData = { latitude: null, longitude: null };
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (dados.enderecoCompleto || dados.cidade)) {
      try {
        const address = `${dados.enderecoCompleto || ''}, ${dados.cidade || ''} - ${dados.estado || ''}, Brasil`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
        const googleRes = await fetch(url);
        const googleData = await googleRes.json();
        if (googleData.results?.length > 0) {
          const loc = googleData.results[0].geometry.location;
          geoData = { latitude: loc.lat, longitude: loc.lng };
        }
      } catch (err) { console.error("Erro Geocoding:", err); }
    }

    // Retorno Unificado
    return NextResponse.json({
        ...dados,
        unitPrice: tarifa, 
        injectedEnergyMUC: injetadaMUC,
        injectedEnergyOUC: injetadaOUC,
        gdEligibility,
        tensaoType, 
        ...geoData
    });

  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return NextResponse.json({ error: error.message || 'Falha interna.' }, { status: 500 });
  }
}
