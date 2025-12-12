// src/app/api/process-fatura/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  // Verificação de Segurança
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Falta OPENAI_API_KEY' }, { status: 500 });

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

    // 2. Extrair Dados com IA
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é um parser JSON de faturas de energia." },
        {
          role: "user",
          content: `Extraia os dados desta fatura.
          
          Campos Obrigatórios (JSON):
          - nomeCliente (string)
          - consumoKwh (number)
          - valorTotal (number)
          - vencimento (string dd/mm/aaaa)
          - mediaConsumo (number): Procure a palavra "Média" no histórico.
          
          LOCALIZAÇÃO (IMPORTANTE):
          - enderecoCompleto (string): Rua, Número e Bairro.
          - cidade (string): Cidade da unidade.
          - estado (string): Sigla do estado (Ex: MT).

          Texto: """${textoFatura.substring(0, 4000)}"""`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const dados = JSON.parse(completion.choices[0].message.content || '{}');

    // 3. Geocoding (Google Maps) - Transformar Endereço em Lat/Long
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (dados.enderecoCompleto || dados.cidade)) {
      try {
        const address = `${dados.enderecoCompleto || ''}, ${dados.cidade || ''} - ${dados.estado || ''}, Brasil`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
        
        const googleRes = await fetch(url);
        const googleData = await googleRes.json();

        if (googleData.results?.length > 0) {
          const loc = googleData.results[0].geometry.location;
          dados.latitude = loc.lat;
          dados.longitude = loc.lng;
        }
      } catch (err) {
        console.error("Erro Geocoding:", err);
      }
    }

    return NextResponse.json(dados);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
