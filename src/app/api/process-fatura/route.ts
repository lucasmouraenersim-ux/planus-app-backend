
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

    // 3. Extração de Dados via IA (Prompt Avançado)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
            role: "system", 
            content: "Você é um auditor especialista em faturas de energia elétrica. Sua prioridade é extrair valores numéricos com precisão decimal absoluta e identificar linhas de Geração Distribuída (GD)." 
        },
        {
          role: "user",
          content: `Analise o texto desta fatura e extraia os dados em JSON.
          
          CAMPOS GERAIS:
          - nomeCliente (string)
          - consumoKwh (number): Soma total do consumo ativo faturado.
          - valorTotal (number)
          - vencimento (string dd/mm/aaaa)
          - mediaConsumo (number)
          
          CAMPOS TÉCNICOS CRÍTICOS:
          1. tarifaUnit (number): Localize a linha "Consumo em kWh" (ou similar) nos Itens da Fatura. Extraia o valor da coluna "Preço unit" ou "Tarifa com tributos". Exemplo: se estiver 1,127570, retorne 1.127570. Se houver múltiplas tarifas (Ponta/Fora Ponta), pegue a maior.
          
          2. energiaInjetadaMUC (number): Procure itens contendo "Energia Atv Injetada" OU "Injeção" que contenham o termo "mUC" (mesma Unidade). Some a quantidade (kWh). Retorne 0 se não houver.
          
          3. energiaInjetadaOUC (number): Procure itens contendo "Energia Atv Injetada" OU "Injeção" que contenham o termo "oUC" (outra Unidade). Some a quantidade (kWh). Retorne 0 se não houver.

          LOCALIZAÇÃO:
          - enderecoCompleto (string)
          - cidade (string)
          - estado (string UF)

          Texto da Fatura:
          """${textoFatura.substring(0, 6000)}"""`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0, // Precisão máxima
    });

    const rawContent = completion.choices[0].message.content;
    if (!rawContent) throw new Error("A IA não retornou conteúdo.");
    
    const dados = JSON.parse(rawContent);

    // --- 4. CÁLCULO DE ELEGIBILIDADE (Lógica de Negócio) ---
    const consumo = dados.consumoKwh || 0;
    const injetadaMUC = dados.energiaInjetadaMUC || 0;
    const injetadaOUC = dados.energiaInjetadaOUC || 0;
    
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao'; // Cliente normal (Sem GD)

    if (injetadaMUC > 0 || injetadaOUC > 0) {
        // Regra 2: oUC (Outra Unidade) -> Oportunidade
        if (injetadaOUC > 0) {
            gdEligibility = 'oportunidade'; 
        }
        // Regra 1: mUC (Mesma Unidade) -> Verifica Saldo
        else if (injetadaMUC > 0) {
            const saldoDisponivel = consumo - injetadaMUC;
            // Se a diferença for maior que 1000kWh, vale a pena vender o excedente
            if (saldoDisponivel > 1000) {
                gdEligibility = 'elegivel';
            } else {
                gdEligibility = 'inelegivel';
            }
        }
    }

    // Normalização de Dados para o Frontend
    const resultadoFinal = {
        ...dados,
        unitPrice: dados.tarifaUnit ? Number(dados.tarifaUnit) : 0, // Renomeia para o padrão do CRM
        gdEligibility, // Adiciona o status calculado
        // Mantemos os originais caso precise debugar
        injectedEnergyMUC: injetadaMUC,
        injectedEnergyOUC: injetadaOUC
    };

    // 5. Geocoding (Google Maps)
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
