
// src/app/api/process-fatura/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // 1. Converter o arquivo para Buffer e extrair texto
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extrai o texto cru do PDF
    const data = await pdf(buffer);
    const textoFatura = data.text;

    // 2. Enviar para a IA (GPT-4o)
    // O segredo está no prompt: Pedimos para ele achar o dado específico
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em ler faturas de energia elétrica do Brasil (Enel, CPFL, Cemig, etc).
          Sua tarefa é extrair dados técnicos financeiros e retornar estritamente em formato JSON.`
        },
        {
          role: "user",
          content: `Analise o texto desta fatura abaixo.
          
          Eu preciso que você encontre especificamente:
          1. O "Preço Unitário com Tributos" (Geralmente na coluna 'Tarifa com Impostos' ou 'Preço Unitário'). Se houver TUSD e TE separados, some os dois preços unitários ou pegue o valor cheio se houver.
          2. O Consumo total em kWh.
          3. O Valor Total da fatura (R$).
          4. A Data de Vencimento.
          
          Texto da Fatura:
          """
          ${textoFatura.substring(0, 3000)} // Enviamos os primeiros 3000 caracteres (geralmente onde estão os dados)
          """
          
          Retorne APENAS um JSON neste formato, sem markdown:
          {
            "precoUnitario": number,
            "consumoKwh": number,
            "valorTotal": number,
            "vencimento": "DD/MM/AAAA",
            "detalhes": "string (ex: Soma de TUSD + TE)"
          }`
        }
      ],
      temperature: 0, // 0 deixa a IA mais precisa e menos criativa
    });

    // 3. Limpar a resposta e converter para Objeto
    const rawContent = completion.choices[0].message.content;
    const jsonString = rawContent?.replace(/```json/g, '').replace(/```/g, '').trim();
    const dadosExtraidos = JSON.parse(jsonString || '{}');

    return NextResponse.json(dadosExtraidos);

  } catch (error) {
    console.error("Erro ao processar fatura:", error);
    return NextResponse.json({ error: 'Falha ao processar fatura' }, { status: 500 });
  }
}
