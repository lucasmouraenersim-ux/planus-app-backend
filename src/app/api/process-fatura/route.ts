
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

    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text;
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao ler PDF' }, { status: 422 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { 
            role: "system", 
            content: `Você é um perito em faturas da ENERGISA. Sua missão é achar valores de injeção GD escondidos.`
        },
        {
          role: "user",
          content: `Extraia os dados técnicos. O texto está desformatado.

          1. TARIFA UNITÁRIA:
             - Procure na linha "Consumo em kWh". Pegue o valor unitário (ex: 1,087600).

          2. ENERGIA INJETADA (GDI) - ALTA PRIORIDADE:
             - A Energisa lista várias linhas como "Energia Atv Injetada GDI mUC Mês/Ano".
             - O valor em kWh (Quantidade) costuma estar LOGO APÓS a descrição ou a data.
             - Exemplo no texto: "Energia Atv Injetada GDI mUC 10/2025 mPT ... 15.170,00 ... -1.500,00"
             - O valor correto é o 15.170,00 (Quantidade). O outro é valor monetário.
             - TAREFA: Encontre TODAS as ocorrências de "mUC" e "oUC". Some suas quantidades (kWh).
             - Se achar "15.170,00", some 15170. Se achar "272,00", some 272.

          3. CLASSIFICAÇÃO:
             - Procure: "B OPTANTE", "GRUPO A", "ALTA TENSÃO".
             - Procure Tensão Nominal DISP >= 13800.
             - Procure "Energia Reativa Exced". Se achar, é forte indício de B Optante ou A.

          4. GERAIS:
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

    const dados = JSON.parse(completion.choices[0].message.content || '{}');

    // 3. Regras
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = Number(dados.injectedEnergyOUC || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';
    if (injetadaOUC > 0) gdEligibility = 'oportunidade';
    else if (injetadaMUC > 0) {
        if ((consumo - injetadaMUC) > 1000) gdEligibility = 'elegivel';
        else gdEligibility = 'inelegivel';
    }

    // Classificação
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';
    const classText = (dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;

    if (classText.includes('BAIXA RENDA')) tensaoType = 'baixa_renda';
    else if (classText.includes('ALTA TENSÃO') || classText.includes('GRUPO A')) tensaoType = 'alta';
    else if (tensaoDisp >= 13800 || temReativa || classText.includes('OPTANTE')) tensaoType = 'b_optante';
    else tensaoType = 'baixa';

    // 4. Geocoding
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
    console.error("Erro Processamento Fatura:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }