// src/app/api/process-fatura/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  // 1. Verificar Chave de API
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERRO: OPENAI_API_KEY não encontrada no .env.local");
    return NextResponse.json({ error: 'Chave de API da OpenAI não configurada no servidor.' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo recebido pelo servidor.' }, { status: 400 });
    }

    console.log(`📄 Recebendo arquivo: ${file.name} (${file.size} bytes)`);

    // 2. Tentar converter PDF para Texto
    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text;
      
      console.log(`📝 Texto extraído (primeiros 100 chars): ${textoFatura.substring(0, 100)}...`);

      if (!textoFatura || textoFatura.trim().length < 10) {
        throw new Error("PDF parece estar vazio ou é uma imagem escaneada sem texto selecionável.");
      }
    } catch (pdfError: any) {
      console.error("❌ Erro ao ler PDF:", pdfError);
      return NextResponse.json({ error: `Erro ao ler o PDF: ${pdfError.message}` }, { status: 400 });
    }

    // 3. Enviar para OpenAI
    console.log("🤖 Enviando para OpenAI...");
    
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
          content: `Extraia os dados desta fatura.
          
          Campos obrigatórios (JSON):
          - nomeCliente (string)
          - consumoKwh (number)
          - valorTotal (number)
          - vencimento (string dd/mm/aaaa)
          - precoUnitario (number)
          - mediaConsumo (number): Procure no bloco "CONSUMO FATURADO" ou "Histórico" a linha escrito "Média". Retorne apenas o número (ex: 1751).

          NOVOS CAMPOS DE LOCALIZAÇÃO:
          - enderecoCompleto (string): O endereço da unidade consumidora (Rua, Número, Bairro).
          - cidade (string): A cidade da unidade (Ex: Várzea Grande, Cuiabá).
          - estado (string): Sigla do estado (Ex: MT).

          Texto:
          """
          ${textoFatura.substring(0, 4000)}
          """`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const conteudo = completion.choices[0].message.content;
    console.log("✅ Resposta da IA:", conteudo);

    if (!conteudo) throw new Error("A IA retornou uma resposta vazia.");

    const result = JSON.parse(conteudo);
    return NextResponse.json(result);

  } catch (error: any) {
    // Log detalhado no terminal do servidor
    console.error("❌ ERRO GERAL NA API:", error);
    
    // Retorna o erro detalhado para o frontend ver
    const errorMessage = (error as any).response?.data?.error?.message || (error as any).message || "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
