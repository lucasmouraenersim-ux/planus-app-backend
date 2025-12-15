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

    // 3. Extração de Dados via IA (Prompt Especializado para Energisa/Tabelas)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
            role: "system", 
            content: "Você é um especialista em leitura técnica de faturas de energia (Energisa, Cemig, Enel). Você deve ignorar textos de marketing e focar estritamente na tabela de 'Itens da Fatura'." 
        },
        {
          role: "user",
          content: `Analise o texto bruto desta fatura e extraia os dados técnicos.
          
          ATENÇÃO: A leitura do PDF pode misturar colunas. Siga estas regras de heurística para encontrar os valores corretos:

          1. TARIFA UNITÁRIA (tarifaUnit):
             - Procure a linha que começa com "Consumo em kWh" ou "Consumo Ativo".
             - Nesta linha, haverá uma sequência de números.
             - A "Quantidade" geralmente é um número inteiro ou com 00 decimais (ex: 539 ou 8.617,00).
             - O "Valor Total" é um valor monetário alto (ex: 607,76 ou 9.371,93).
             - A "Tarifa Unitária" (O QUE QUEREMOS) é geralmente um número menor (entre 0.50 e 1.50) e MUITAS VEZES TEM 5 OU 6 CASAS DECIMAIS (ex: 1,127570 ou 0,852130).
             - SE HOUVER DIFERENÇA entre Tarifa TE e Tarifa TUSD, some as duas ou pegue o valor "Com Tributos" se disponível. Priorize o valor "Com Tributos" (maior valor unitário da linha).

          2. GERAÇÃO DISTRIBUÍDA (Injeção):
             - Procure por linhas contendo "Energia Atv Injetada", "Injeção", "GDI" ou "Compensação".
             - Verifique se a linha contém o texto "mUC" (Mesma Unidade) ou "oUC" (Outra Unidade).
             - Extraia a QUANTIDADE (kWh) dessas linhas. O número costuma vir logo após a descrição ou na coluna de quantidade. Ignore valores negativos em R$ (dinheiro), queremos o kWh (físico).

          3. DADOS GERAIS:
             - nomeCliente: Nome do titular.
             - consumoKwh: Soma do consumo ativo.
             - valorTotal: Valor final a pagar.
             - vencimento: Data de vencimento.
             - mediaConsumo: Média histórica (procure por "Média: XXX kWh" ou calcule a média dos últimos meses listados no histórico).

          LOCALIZAÇÃO:
          - enderecoCompleto, cidade, estado.

          RETORNE APENAS JSON:
          {
            "nomeCliente": string,
            "consumoKwh": number,
            "valorTotal": number,
            "vencimento": string,
            "mediaConsumo": number,
            "tarifaUnit": number,
            "energiaInjetadaMUC": number (Soma kWh mUC),
            "energiaInjetadaOUC": number (Soma kWh oUC),
            "enderecoCompleto": string,
            "cidade": string,
            "estado": string
          }

          TEXTO DA FATURA:
          """${textoFatura.substring(0, 10000)}"""` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0, 
    });

    const rawContent = completion.choices[0].message.content;
    if (!rawContent) throw new Error("A IA não retornou conteúdo.");
    
    const dados = JSON.parse(rawContent);

    // --- 4. CÁLCULO DE ELEGIBILIDADE (Lógica de Negócio Refinada) ---
    const consumo = Number(dados.consumoKwh || 0);
    const injetadaMUC = Number(dados.energiaInjetadaMUC || 0);
    const injetadaOUC = Number(dados.energiaInjetadaOUC || 0);
    
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';

    // Se tem injeção de energia (Geração Distribuída)
    if (injetadaMUC > 0 || injetadaOUC > 0) {
        
        // REGRA 2: Tem oUC (Outra Unidade) -> É oportunidade
        // Significa que ele recebe crédito de outro lugar, ou manda pra outro lugar. 
        // Vale a pena investigar.
        if (injetadaOUC > 0) {
            gdEligibility = 'oportunidade'; 
        }
        
        // REGRA 1: Só tem mUC (Mesma Unidade) -> Verifica se sobra consumo
        // Se ele consome 2000 e a usina dele gera 1000 (mUC), sobram 1000 pra gente atender.
        // Se ele consome 2000 e a usina gera 1900, não sobra nada (Inelegível).
        else if (injetadaMUC > 0) {
            const saldoParaAtender = consumo - injetadaMUC;
            
            // Margem de segurança: Sò atendemos se sobrar mais de 500 kWh (ajuste conforme sua regra de negócio, você disse 1000 antes)
            if (saldoParaAtender > 1000) {
                gdEligibility = 'elegivel';
            } else {
                gdEligibility = 'inelegivel';
            }
        }
    }

    // Normalização Final
    const resultadoFinal = {
        ...dados,
        // Garante que tarifaUnit venha como número e com fallback se a IA falhar
        unitPrice: dados.tarifaUnit ? Number(dados.tarifaUnit) : 0, 
        injectedEnergyMUC: injetadaMUC,
        injectedEnergyOUC: injetadaOUC,
        gdEligibility
    };

    // 5. Geocoding (Mantido)
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (dados.enderecoCompleto || dados.cidade)) {
      try {
        const address = `${dados.enderecoCompleto || ''}, ${dados.cidade || ''} - ${dados.estado || ''}, Brasil`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
        const googleRes = await fetch(url);
        const googleData = await googleRes.json();
        if (googleData.results?.length > 0) {
          const loc = googleData.results[0].geometry.location;
          resultadoFinal.latitude = loc.lat;
          resultadoFinal.longitude = loc.lng;
        }
      } catch (err) { console.error("Erro Geocoding:", err); }
    }

    return NextResponse.json(resultadoFinal);

  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return NextResponse.json({ error: error.message || 'Falha interna.' }, { status: 500 });
  }
}
