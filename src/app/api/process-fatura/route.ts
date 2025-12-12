import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  console.log("🚀 [API] Iniciando processamento de fatura...");

  // 1. Verificação de Segurança da Chave
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ [API] ERRO CRÍTICO: Chave OPENAI_API_KEY não encontrada.");
    return NextResponse.json(
      { error: 'Configuração de servidor ausente: OPENAI_API_KEY faltando.' },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey: apiKey });

  try {
    // 2. Recebimento do Arquivo
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error("❌ [API] Nenhum arquivo recebido.");
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
    }

    console.log(`📄 [API] Arquivo recebido: ${file.name}`);

    // 3. Conversão do PDF (Com tratamento de erro específico)
    let textoFatura = '';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdf(buffer);
      textoFatura = data.text;
      
      console.log(`📝 [API] Texto extraído com sucesso (${textoFatura.length} caracteres).`);
      
      if (!textoFatura || textoFatura.length < 50) {
        throw new Error("O PDF parece ser uma imagem ou está vazio/protegido.");
      }
    } catch (pdfError: any) {
      console.error("❌ [API] Erro ao ler PDF:", pdfError);
      return NextResponse.json(
        { error: 'Não foi possível ler o texto do PDF. Verifique se não é um PDF escaneado (imagem).' },
        { status: 422 }
      );
    }

    // 4. Chamada OpenAI
    console.log("🤖 [API] Enviando para OpenAI GPT-4o...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um parser JSON de faturas de energia (OCR)."
        },
        {
          role: "user",
          content: `Extraia os dados deste texto de fatura da Energisa/Outras.
          Se encontrar "RECICLATE" ou similar, esse é o nomeCliente.
          
          Campos obrigatórios (JSON):
          - nomeCliente (string)
          - consumoKwh (number) - Procure por "Consumo em kWh" ou coluna "Quant"
          - valorTotal (number) - Valor final a pagar
          - vencimento (string dd/mm/aaaa)
          - precoUnitario (number) - Preço unitário com tributos

          Texto:
          """
          ${textoFatura.substring(0, 4000)}
          """`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const resultString = completion.choices[0].message.content;
    console.log("✅ [API] Resposta da IA:", resultString);

    if (!resultString) throw new Error("IA retornou vazio");

    const dados = JSON.parse(resultString);
    return NextResponse.json(dados);

  } catch (error: any) {
    console.error("❌ [API] Erro Geral:", error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}