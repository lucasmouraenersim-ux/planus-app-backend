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

    // 2. Extrair Dados com IA (Prompt "Cirúrgico" para Energisa)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // OBRIGATÓRIO ser gpt-4o para essa precisão visual
      messages: [
        { 
            role: "system", 
            content: `Você é um motor de OCR especializado em faturas de energia da ENERGISA. 
            Sua missão é encontrar valores técnicos escondidos em tabelas desformatadas.
            
            REGRA DE OURO: Números decimais no Brasil usam vírgula (,) e milhar usa ponto (.).
            Exemplo: 1.200,50 é mil e duzentos. 1,127570 é um e doze centavos (tarifa).`
        },
        {
          role: "user",
          content: `Extraia os dados técnicos desta fatura. O texto está "achatado", então use padrões para achar os valores.

          1. TARIFA UNITÁRIA (tarifaUnit):
             - Procure na seção "Itens da Fatura".
             - Encontre a linha que começa com "Consumo em kWh" ou "Consumo Ativo".
             - NESTA MESMA LINHA, procure um número que tenha **5 ou 6 casas decimais**.
             - Exemplo de padrão: "Consumo em kWh ... 1,127570 ...".
             - Se houver TUSD e TE separados, some os valores unitários ou pegue o "Preço Unit com Tributos" se disponível.
             - O valor deve ser algo entre 0,50 e 2,00.

          2. ENERGIA INJETADA (Geração Distribuída):
             - Procure por linhas contendo "Energia Atv Injetada", "Injeção" ou "GDI".
             - Se a linha tiver "mUC" -> Extraia o valor em kWh para 'injetadaMUC'.
             - Se a linha tiver "oUC" -> Extraia o valor em kWh para 'injetadaOUC'.
             - DICA: O valor em kWh é positivo (ex: 455,00) e costuma vir antes do valor em reais (que é negativo, ex: -500,00). Ignore o valor monetário negativo.

          3. CONSUMO E GERAIS:
             - consumoKwh: O valor principal de consumo do mês (Geralmente na primeira linha dos itens).
             - valorTotal: O valor final a pagar (R$).
             - vencimento: Data de vencimento.
             - nomeCliente: Nome do titular.
             - mediaConsumo: Média histórica dos últimos meses.

          LOCALIZAÇÃO:
          - enderecoCompleto, cidade, estado.

          Retorne APENAS um JSON válido com este formato (sem markdown):
          {
            "nomeCliente": string,
            "consumoKwh": number,
            "valorTotal": number,
            "vencimento": string,
            "mediaConsumo": number,
            "tarifaUnit": number,
            "injectedEnergyMUC": number,
            "injectedEnergyOUC": number,
            "enderecoCompleto": string,
            "cidade": string,
            "estado": string
          }

          --- INÍCIO DO TEXTO DA FATURA ---
          ${textoFatura.substring(0, 10000)}
          --- FIM DO TEXTO ---`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0, // Zero criatividade, máxima precisão
    });

    const dados = JSON.parse(completion.choices[0].message.content || '{}');

    // 3. Pós-Processamento e Regras de Negócio
    
    // Normalizar números (Garantir que venham como Number JS)
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = Number(dados.injectedEnergyOUC || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    // Cálculo de Elegibilidade (Sua Regra de Negócio)
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';

    if (injetadaMUC > 0 || injetadaOUC > 0) {
        // Caso 2: oUC (Vem de fora) -> Oportunidade
        if (injetadaOUC > 0) {
            gdEligibility = 'oportunidade';
        }
        // Caso 1: mUC (Mesma unidade) -> Verifica se sobra
        else if (injetadaMUC > 0) {
            // Se consome 2000 e gera 1000, sobra 1000 para nós (Elegível)
            // Se consome 2000 e gera 1900, sobra 100 (Inelegível)
            const saldoParaVenda = consumo - injetadaMUC;
            
            if (saldoParaVenda > 1000) {
                gdEligibility = 'elegivel';
            } else {
                gdEligibility = 'inelegivel';
            }
        }
    }

    // 4. Geocoding (Google Maps)
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

    // Retorno Final Formatado
    return NextResponse.json({
        ...dados,
        // Campos normalizados para o frontend
        unitPrice: tarifa, 
        injectedEnergyMUC: injetadaMUC,
        injectedEnergyOUC: injetadaOUC,
        gdEligibility,
        ...geoData
    });

  } catch (error: any) {
    console.error("Erro Processamento Fatura:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
