// src/app/api/process-fatura/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);
    const textoFatura = data.text;

    // A MÁGICA ACONTECE AQUI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em extração de dados de faturas de energia (OCR). 
          Sua missão é estruturar dados bagunçados em JSON confiável.`
        },
        {
          role: "user",
          content: `Analise o texto desta fatura de energia (ex: Energisa, CPFL, Enel).
          
          Extraia ESTRITAMENTE os seguintes campos:

          1. **nomeCliente**: O nome da empresa ou pessoa.
             - DICA: Geralmente está no topo esquerdo, acima do endereço, ou próximo a "Classificação". No exemplo da Energisa, aparece antes de "RUA...".
             - Exemplo no texto: "RECICLATE COM MATERIAIS RECICLAVEIS LTDA"

          2. **consumoKwh**: A quantidade de energia consumida.
             - DICA: Procure a linha que começa com "Consumo em kWh" ou "Consumo Ativo". Pegue o valor numérico na coluna "Quant" ou "Leitura Atual - Anterior".
             - No texto aparece algo como: "Consumo em kWh KWH 1793 ..." -> O valor é 1793.

          3. **precoUnitario**: O preço do kWh COM tributos.
             - DICA: Na mesma linha do consumo, procure a coluna "Preço unit" ou "Tarifa com Tributos".
             - No texto aparece algo como: "... 1793 1,127570 ..." -> O valor é 1.127570.

          4. **valorTotal**: O valor total a pagar da fatura (R$).

          5. **vencimento**: Data de vencimento da fatura.

          IMPORTANTE: 
          - Converta números para formato float (ponto ao invés de vírgula).
          - Retorne APENAS o JSON.

          Texto da Fatura:
          """
          ${textoFatura.substring(0, 4000)}
          """`
        }
      ],
      temperature: 0, // Zero criatividade, máxima precisão
      response_format: { type: "json_object" } // Garante que volta JSON válido
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(result);

  } catch (error) {
    console.error("Erro AI:", error);
    return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 });
  }
}
