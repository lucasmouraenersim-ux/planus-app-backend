
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  // 1. Verificação de Segurança
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Falta OPENAI_API_KEY' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    // 2. Ler PDF
    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text;
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao ler PDF' }, { status: 422 });
    }

    // 3. Inteligência (Prompt Completo)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { 
            role: "system", 
            content: `Você é um motor de cálculo de faturas de energia. 
            Sua prioridade é identificar tabelas desformatadas, SOMAR valores de GDI e ler textos de CLASSIFICAÇÃO técnica.`
        },
        {
          role: "user",
          content: `Extraia os dados técnicos desta fatura.

          1. TARIFA UNITÁRIA (tarifaUnit):
             - Procure na linha "Consumo em kWh". Pegue o número com 5 ou 6 casas decimais (ex: 1,087600).

          2. ENERGIA INJETADA (GDI) - SOMA:
             - Encontre TODAS as linhas que contêm "Energia Atv Injetada", "Injeção" ou "GDI".
             - Some os kWh das linhas com "mUC" -> 'injetadaMUC'.
             - Some os kWh das linhas com "oUC" -> 'injetadaOUC'.
             - IMPORTANTE: O valor em kWh é o número POSITIVO (ex: 4.768,00). Ignore o valor em R$ (que é negativo).

          3. CLASSIFICAÇÃO E TENSÃO (CRÍTICO):
             - classificacaoTexto: Extraia o texto que vem depois de "Classificação:". Procure por palavras chaves como "BAIXA TENSÃO", "ALTA TENSÃO", "GRUPO A", "BAIXA RENDA".
             - tensaoNominalDisp: Procure por "TENSÃO NOMINAL EM VOLTS" e pegue o valor do campo "DISP" (Disponível). Retorne apenas o número (ex: 127, 220, 13800).
             - temReativaExcedente: Procure nos Itens da Fatura se existe alguma linha contendo "Energia Reativa Exced", "Reativa Excedente" ou "UFER". Retorne true ou false.

          4. DADOS GERAIS:
             - nomeCliente, consumoKwh, valorTotal, vencimento.
             - mediaConsumo: Procure por "Média: XXX" ou "Média Histórica".

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
          """${textoFatura.substring(0, 12000)}"""` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const dados = JSON.parse(completion.choices[0].message.content || '{}');

    // 4. Regras de Negócio e Pós-Processamento
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = Number(dados.injectedEnergyOUC || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    // --- LÓGICA DE ELEGIBILIDADE GD ---
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';
    if (injetadaOUC > 0) {
        gdEligibility = 'oportunidade';
    } else if (injetadaMUC > 0) {
        // Cálculo do saldo líquido para ver se compensa
        const saldo = consumo - injetadaMUC;
        if (saldo > 1000) gdEligibility = 'elegivel';
        else gdEligibility = 'inelegivel';
    }

    // --- LÓGICA DE CLASSIFICAÇÃO (TENSÃO) ---
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';
    const classText = (dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;

    if (classText.includes('BAIXA RENDA')) {
        tensaoType = 'baixa_renda';
    } else if (classText.includes('ALTA TENSÃO') || classText.includes('GRUPO A')) {
        tensaoType = 'alta';
    } else {
        // Verifica B Optante
        if (tensaoDisp >= 13800 || temReativa) {
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
            const res = await fetch(url);
            const json = await res.json();
            if (json.results?.length > 0) {
                const loc = json.results[0].geometry.location;
                geoData = { latitude: loc.lat, longitude: loc.lng };
            }
        } catch (err) { console.error("Geocoding error", err); }
    }

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
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
