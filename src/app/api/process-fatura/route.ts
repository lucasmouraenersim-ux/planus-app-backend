import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Falta OPENAI_API_KEY' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    // 1. Ler PDF
    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text;
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao ler PDF' }, { status: 422 });
    }

    // 2. Inteligência (Prompt Matemático para Energisa)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { 
            role: "system", 
            content: `Você é um motor de processamento de faturas de energia. 
            Sua principal habilidade é ler tabelas desformatadas, identificar múltiplas linhas de "Energia Injetada" e SOMAR seus valores.`
        },
        {
          role: "user",
          content: `Extraia os dados técnicos desta fatura da Energisa.

          1. TARIFA UNITÁRIA (tarifaUnit):
             - Procure na linha "Consumo em kWh".
             - Pegue o número com 5 ou 6 casas decimais (ex: 1,087600).

          2. ENERGIA INJETADA (GDI) - ATENÇÃO MÁXIMA AQUI:
             - A fatura lista a injeção em VÁRIAS LINHAS separadas por mês (ex: "Energia Atv Injetada GDI mUC 3/2025", "Energia Atv Injetada GDI mUC 1/2025", etc).
             - VOCÊ DEVE ENCONTRAR TODAS ESSAS LINHAS E SOMAR A QUANTIDADE (kWh).
             - Regra mUC: Some todos os kWh das linhas que contêm "mUC".
             - Regra oUC: Some todos os kWh das linhas que contêm "oUC".
             - O valor em kWh é o número positivo (ex: 4.768,00 ou 1.433,00) que aparece ANTES da tarifa unitária. 
             - IGNORE o valor monetário (que é negativo, ex: -R$ 5.000). QUEREMOS O KWH.

          3. DADOS GERAIS:
             - nomeCliente, consumoKwh, valorTotal, vencimento.
             - mediaConsumo: Procure no histórico "Média: XXX" ou calcule a média dos últimos meses listados no histórico.

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
            "injectedEnergyMUC": number (SOMA TOTAL kWh de todas as linhas mUC),
            "injectedEnergyOUC": number (SOMA TOTAL kWh de todas as linhas oUC),
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

    // 3. Regras de Negócio e Cálculos Finais
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = Number(dados.injectedEnergyOUC || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';

    // Regra:
    // Se oUC > 0 -> Oportunidade (recebe de fora).
    // Se mUC > 0 -> Verifica se sobra saldo. (Consumo - Geração mUC > 1000?)
    
    if (injetadaOUC > 0) {
        gdEligibility = 'oportunidade';
    } else if (injetadaMUC > 0) {
        const saldoLiquido = consumo - injetadaMUC;
        if (saldoLiquido > 1000) {
            gdEligibility = 'elegivel'; // Tem solar, mas consome muito mais
        } else {
            gdEligibility = 'inelegivel'; // Solar cobre quase tudo
        }
    }

    // 4. Geocoding
    let geoData = { latitude: null, longitude: null };
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (dados.enderecoCompleto || dados.cidade)) {
        try {
            const address = `${dados.enderecoCompleto || ''}, ${dados.cidade || ''} - ${dados.estado || ''}, Brasil`;
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
            const googleRes = await fetch(url);
            const googleJson = await googleRes.json();
            if (googleJson.results?.length > 0) {
                const loc = googleJson.results[0].geometry.location;
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
        ...geoData
    });

  } catch (error: any) {
    console.error("Erro Processamento:", error);
    return NextResponse.json({ error: error.message || 'Falha interna.' }, { status: 500 });
  }
}