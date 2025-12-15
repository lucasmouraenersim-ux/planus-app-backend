import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LinhaInjetada = {
  descricaoOriginal?: string;
  tipoUC?: 'mUC' | 'oUC' | 'indefinida' | string;
  competencia?: string | null;
  valorKwh?: number | null;
  valorRS?: number | null;
  metodo?: 'kwh_direto' | 'fallback_por_valor_rs' | 'indefinido' | string;
  justificativa?: string;
};

function newRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parsePtBrNumber(raw: string): number | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const cleaned = s.replace(/\s+/g, '').replace(/R\$/gi, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function extractPtBrNumbers(line: string): string[] {
  // Exemplos: 8.358,00 | 1,087600 | -435,94
  const matches = line.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2,6})/g);
  return matches || [];
}

function detectConsumoETarifa(texto: string): { consumoKwh?: number; tarifaUnit?: number; line?: string } {
  const lines = texto.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!/^consumo\s+em\s+kwh/i.test(line)) continue;
    const nums = extractPtBrNumbers(line).map(parsePtBrNumber).filter((n): n is number => n !== null);
    if (nums.length >= 2) return { consumoKwh: nums[0], tarifaUnit: nums[1], line };
    if (nums.length === 1) return { consumoKwh: nums[0], line };
  }
  return {};
}

function deterministicExtractInjetadas(texto: string, tarifaUnit?: number): LinhaInjetada[] {
  const lines = texto.split(/\r?\n/);
  const out: LinhaInjetada[] = [];

  const getWindow = (idx: number): string => {
    // Junta linha atual + 2 próximas (pdf-parse frequentemente quebra as colunas em linhas adjacentes)
    const a = lines[idx] || '';
    const b = lines[idx + 1] || '';
    const c = lines[idx + 2] || '';
    return `${a}\n${b}\n${c}`.trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;
    if (!/(injet|inj|gdi|gdii|gd)/i.test(line)) continue;
    if (/consumo\s+faturado/i.test(line)) continue;

    const upper = line.toUpperCase();
    // Só registrar se parece uma linha de energia injetada/itens GD, senão vira ruído
    if (!/INJET/i.test(upper) && !/GDI|GDII\b/i.test(upper)) continue;

    // Classificação mais inteligente:
    // 1. Se tem "oUC" explícito → oUC
    // 2. Se tem "mUC" explícito → mUC
    // 3. Se tem apenas "GDI" sem sufixo E não tem competência (MM/AAAA) → provavelmente é mUC (mesma UC)
    // 4. Caso contrário → indefinida
    let tipoUC: LinhaInjetada['tipoUC'] = 'indefinida';
    
    if (upper.includes('OUC')) {
      tipoUC = 'oUC';
    } else if (upper.includes('MUC')) {
      tipoUC = 'mUC';
    } else if (/GDI|GDII/i.test(upper) && !/\d{1,2}\/20\d{2}/.test(line)) {
      // Se tem GDI mas não tem data (competência), é provavelmente mUC (mesma UC, mês atual)
      tipoUC = 'mUC';
    }

    const compMatch = line.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/);
    const competencia = compMatch ? `${compMatch[1].padStart(2, '0')}/${compMatch[2]}` : null;

    // Tenta números no "window" para pegar Quant./Valor quando quebrados
    const windowText = getWindow(i);
    const rawNums = extractPtBrNumbers(windowText);
    const moneyCandidates = rawNums
      .filter((s) => /,\d{2}\b/.test(s))
      .map(parsePtBrNumber)
      .filter((n): n is number => n !== null);

    const valorRS =
      moneyCandidates.find((n) => n < 0) ?? (moneyCandidates.length > 0 ? moneyCandidates[moneyCandidates.length - 1] : null);

    // Candidatos a kWh: números positivos maiores que 1, excluindo a tarifa
    const kwhCandidates = rawNums
      .filter((s) => /,\d{2}\b/.test(s))
      .map(parsePtBrNumber)
      .filter((n): n is number => n !== null)
      .filter((n) => n > 0)
      .filter((n) => !(tarifaUnit && Math.abs(n - tarifaUnit) < 0.000001))
      .filter((n) => n > 1);

    // Tenta pegar o PRIMEIRO número que parece ser kWh (geralmente o maior ou o primeiro > 10)
    // Prioriza números acima de 10 kWh (valores muito pequenos podem ser taxas)
    let valorKwh: number | null = null;
    const bigCandidates = kwhCandidates.filter((n) => n >= 10);
    if (bigCandidates.length > 0) {
      valorKwh = Math.round(bigCandidates[0]);
    } else if (kwhCandidates.length > 0) {
      valorKwh = Math.round(kwhCandidates[0]);
    }
    let metodo: LinhaInjetada['metodo'] = valorKwh ? 'kwh_direto' : 'indefinido';
    let justificativa = 'Extraído por heurística do texto do PDF (pdf-parse).';

    if ((!valorKwh || valorKwh <= 0) && valorRS !== null && tarifaUnit && tarifaUnit > 0) {
      valorKwh = Math.round(Math.abs(valorRS) / tarifaUnit);
      metodo = 'fallback_por_valor_rs';
      justificativa = `kWh calculado por fallback: round(abs(${valorRS}) / ${tarifaUnit}).`;
    }

    out.push({
      descricaoOriginal: line,
      tipoUC,
      competencia,
      valorKwh,
      valorRS,
      metodo,
      justificativa,
    });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.descricaoOriginal}|${x.valorKwh}|${x.valorRS}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function pickDebugLines(texto: string, needle: RegExp, max = 30): string[] {
  const lines = texto.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (needle.test(line)) out.push(line.trim());
    if (out.length >= max) break;
  }
  return out;
}

async function bufferFromAny(input: { file?: File; url?: string }): Promise<Buffer> {
  if (input.file) {
    return Buffer.from(await input.file.arrayBuffer());
  }
  if (input.url) {
    const res = await fetch(input.url);
    if (!res.ok) throw new Error(`Falha ao baixar PDF (HTTP ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('Nenhum arquivo/URL fornecido');
}

export async function POST(req: Request) {
  // Importante: esses logs aparecem NO SERVIDOR (terminal / logs do hosting), não no console do navegador.
  const requestId = newRequestId();
  console.log('[API/process-fatura] POST recebido', { requestId });

  if (!process.env.OPENAI_API_KEY) {
    console.error('[API/process-fatura] Falta OPENAI_API_KEY');
    return NextResponse.json({ error: 'Falta OPENAI_API_KEY' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const debugEnabled =
    new URL(req.url).searchParams.get('debug') === '1' ||
    new URL(req.url).searchParams.get('debug') === 'true';

  try {
    const contentType = req.headers.get('content-type') || '';

    let file: File | undefined;
    let billUrl: string | undefined;
    let originalName: string | undefined;

    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as null | {
        billUrl?: string;
        originalName?: string;
      };
      billUrl = body?.billUrl;
      originalName = body?.originalName;
    } else {
      const formData = await req.formData();
      file = (formData.get('file') as File | null) || undefined;
      billUrl = (formData.get('billUrl') as string | null) || undefined;
      originalName = (formData.get('originalName') as string | null) || undefined;
    }

    if (!file && !billUrl) {
      return NextResponse.json(
        { error: 'Envie `file` (multipart) ou `billUrl` (JSON/multipart).' },
        { status: 400 }
      );
    }

    console.log('[API/process-fatura] Fonte:', file ? 'multipart:file' : 'url', {
      requestId,
      originalName: originalName || file?.name || '',
      hasBillUrl: Boolean(billUrl),
    });

    let textoFatura = '';
    try {
      const buffer = await bufferFromAny({ file, url: billUrl });
      const data = await pdf(buffer);
      textoFatura = data.text || '';
    } catch (e: any) {
      console.error('[API/process-fatura] Erro ao ler PDF:', e?.message || e);
      return NextResponse.json(
        { error: 'Erro ao ler PDF', details: String(e?.message || e), requestId },
        { status: 422 }
      );
    }

    console.log('[API/process-fatura] Texto extraído (len):', { requestId, len: textoFatura.length });

    // ⚠️ NÃO truncar só o início: o bloco de "Itens da Fatura" às vezes aparece mais pro fim
    const head = textoFatura.slice(0, 15000);
    const tail = textoFatura.length > 15000 ? textoFatura.slice(-15000) : '';
    const textoParaIA = `${head}\n\n-----[TAIL]-----\n\n${tail}`;

    // Extração determinística (fallback) — útil quando o texto do pdf-parse quebra colunas.
    const detConsumo = detectConsumoETarifa(textoFatura);
    const detLinhasInjetadas = deterministicExtractInjetadas(textoFatura, detConsumo.tarifaUnit);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Você é um perito em faturas da ENERGISA especializado em identificar energia injetada de Geração Distribuída (GD) e classificação de tensão. Você DEVE encontrar TODOS os valores de energia injetada mUC e oUC, mesmo quando o texto está desformatado. NUNCA confunda "Consumo em kWh" com "Energia Injetada".',
        },
        {
          role: 'user',
          content: `Analise esta fatura da ENERGISA e extraia os dados. O texto pode estar desformatado.

RETORNE APENAS JSON válido no formato final especificado ao final deste prompt.

## CONSUMO EM KWH (CRÍTICO - NÃO CONFUNDIR):

O CONSUMO é encontrado ESPECIFICAMENTE na linha que começa com:
- "Consumo em kWh" ou "Consumo em KWH"
- Esta linha NÃO contém a palavra "Injetada"
- É sempre a primeira linha abaixo de "Itens da Fatura"
- O consumo NÃO contém "Energia Atv Injetada" ou "Energia Atv Inj"
- Exemplo:
  - "Consumo em kWh KWH 32.701,64 1,101380 36.017,13..."
  - "Consumo em kWh 8.617,00"
  → O consumo é 32.701,64 = 32701 kWh
  → O consumo é 8.617,00 = 8617 kWh

⚠️ ATENÇÃO: NÃO confunda com linhas de "Energia Atv Injetada" — estas são DIFERENTES!
- "Energia Atv Injetada GDI mUC..." → NÃO É CONSUMO, é energia injetada
- "Consumo em kWh..." → ESTE É O CONSUMO

Regras adicionais obrigatórias:
- Esta linha representa EXCLUSIVAMENTE energia consumida da rede
- Nunca somar, compensar ou comparar com energia injetada sem solicitação explícita
- A competência do consumo é SEMPRE o período da fatura atual

## INSTRUÇÕES PARA ENERGIA INJETADA (GD):

Você DEVE analisar a fatura linha por linha, sem inferências, sem atalhos e sem assumir valores finais.

⚠️ REGRA ABSOLUTA:
NUNCA retorne 0 (zero) para energia injetada mUC ou oUC
sem antes listar TODAS as linhas de energia injetada encontradas no texto.

Se existir qualquer linha com "Injetada" + "mUC", o valor de injectedEnergyMUC NÃO pode ser zero.

----------------------------------------------------------------
ETAPA 1 — IDENTIFICAÇÃO DE CONSUMO (OBRIGATÓRIA)
- Identifique EXCLUSIVAMENTE a linha que começa com:
  "Consumo em kWh" ou "Consumo em KWH"
- Essa linha:
  • NÃO contém a palavra "Injetada"
  • É a primeira linha abaixo de "Itens da Fatura"

Extraia:
- consumoKwh = PRIMEIRO valor numérico dessa linha (kWh)

⚠️ PROIBIDO:
- Usar qualquer linha com "Injetada" como consumo
- Inferir consumo a partir de valores monetários
- Inferir consumo a partir de histórico

----------------------------------------------------------------
ETAPA 2 — ENUMERAÇÃO OBRIGATÓRIA DE ENERGIA INJETADA

⚠️ ATENÇÃO CRÍTICA: 
Frequentemente existem MÚLTIPLAS linhas de "Energia Atv Injetada GDI" na mesma fatura:
1. "Energia Atv Injetada GDI" (SEM sufixo mUC/oUC) → Esta é da MESMA UC (mUC)
2. "Energia Atv Injetada GDI oUC" → Esta é de OUTRA UC (oUC)
3. "Energia Atv Injetada GDI mUC" → Esta é da MESMA UC (mUC)

Você DEVE listar CADA LINHA SEPARADAMENTE! NÃO agrupe ou combine linhas diferentes!

Variações aceitas para detectar linhas:
- "Energia Atv Injetada"
- "Energia Ativ Injetada"
- "En Atv Inj"
- "Atv Inj"
- "Injetada"
- "GDI"
- "GDII"
- "GD"

Para CADA linha encontrada, crie um item SEPARADO na lista com o formato:
- descricaoOriginal (o texto EXATO da linha, incluindo ou não mUC/oUC)
- tipoUC = "mUC" ou "oUC" ou "indefinida"
- competencia = MM/AAAA (se existir)
- valorKwh (ESPECÍFICO desta linha, não de outra!)
- valorRS (ESPECÍFICO desta linha, não de outra!)
- metodo = "kwh_direto" ou "fallback_por_valor_rs" ou "indefinido"
- justificativa (explique por que classificou como mUC/oUC e de onde veio o valor)

⚠️ REGRAS DE CLASSIFICAÇÃO:
- Se a descrição contém "oUC" → tipo = "oUC"
- Se a descrição contém "mUC" → tipo = "mUC"
- Se NÃO contém "oUC" nem "mUC" mas tem "GDI" → tipo = "mUC" (padrão: mesma UC)
- Se não tem certeza → tipo = "indefinida"

⚠️ ESTA ETAPA É OBRIGATÓRIA.
Se você não listar TODAS as linhas separadamente, a resposta é considerada incorreta.

----------------------------------------------------------------
ETAPA 3 — EXTRAÇÃO DO kWh (REGRA DURA) + CORREÇÃO PARA PDF-PARSE (ANTI-FALHA)

⚠️ PROBLEMA REAL + SOLUÇÃO:
Em muitos PDFs da ENERGISA extraídos por pdf-parse, a coluna "Quant." (kWh) NÃO fica na mesma linha da descrição.
Às vezes a linha da injetada contém apenas "Preço unit", "Base Calc", "ICMS" e "Valor (R$)".
NÃO conclua que não existe kWh só porque não vê o número ao lado do texto.

⚠️ ATENÇÃO PARA MÚLTIPLAS LINHAS:
Se você encontrar 2 linhas de "Energia Atv Injetada GDI":
- Uma SEM sufixo (ex: "Energia Atv Injetada GDI")
- Outra COM sufixo (ex: "Energia Atv Injetada GDI oUC 10/2025")

Você DEVE:
1. Procurar os valores de CADA linha separadamente
2. NÃO associar o valor da primeira linha com a descrição da segunda
3. Cada linha tem seu próprio valor em kWh e em R$
4. Se uma linha tem competência (MM/AAAA) e outra não, são linhas DIFERENTES!

EXEMPLO CORRETO:
Se o texto contém:
"Energia Atv Injetada GDI    KWH 1.491,00  1,087600  -1.621,62  17  -275,67  0,862190
Energia Atv Injetada GDI oUC 10/2025 mPT  KWH 860,00  1,087600  -935,34  17  -159,01  0,862190"

Você DEVE retornar:
linhasInjetadas: [
  {
    "descricaoOriginal": "Energia Atv Injetada GDI",
    "tipoUC": "mUC",
    "competencia": null,
    "valorKwh": 1491,
    "valorRS": -1621.62,
    "metodo": "kwh_direto",
    "justificativa": "Linha sem sufixo mUC/oUC, classificada como mUC (mesma UC). Valor 1491 kWh encontrado diretamente."
  },
  {
    "descricaoOriginal": "Energia Atv Injetada GDI oUC 10/2025 mPT",
    "tipoUC": "oUC",
    "competencia": "10/2025",
    "valorKwh": 860,
    "valorRS": -935.34,
    "metodo": "kwh_direto",
    "justificativa": "Linha com sufixo 'oUC', classificada como oUC. Valor 860 kWh encontrado diretamente."
  }
]

ORDEM DE EXTRAÇÃO OBRIGATÓRIA (use sempre nesta ordem):

A) TENTAR EXTRAÇÃO DIRETA DO kWh (preferencial):
- Procure por um número no formato brasileiro que represente kWh:
  • "12,00"
  • "4.768,00"
  • "1.433,00"
  • "15.170,00"
- Se encontrar kWh claramente associado ao item (Quant.), use:
  → valorKwh = esse número
  → metodo = "kwh_direto"

B) FALLBACK OBRIGATÓRIO POR VALOR (R$) (quando Quant. estiver ausente/quebrada):
Se NÃO for possível achar o kWh direto para o item, você DEVE calcular:

- Primeiro extraia valorRS:
  • use o valor monetário do próprio item (geralmente negativo para injetada)
  • exemplo: "-295,82", "-1.558,54", "-5.185,72", "-13,05"

- Para calcular kWh:
  kWh_calculado = round( abs(valorRS) / tarifaUnit )

- Isso só é permitido se tarifaUnit já tiver sido extraída da linha "Consumo em kWh".

Se usar fallback:
→ valorKwh = kWh_calculado
→ metodo = "fallback_por_valor_rs"

⚠️ PROIBIDO:
- Usar valores de impostos (ICMS/PIS/COFINS) como valorRS
- Usar "Base Calc" como valorRS
- Usar números fora do item
- Inventar tarifaUnit

----------------------------------------------------------------
ETAPA 4 — CLASSIFICAÇÃO DA UNIDADE (REGRA BINÁRIA)
- Se a linha contém "mUC" → pertence à mesma UC geradora
- Se a linha contém "oUC" → pertence a outra UC
- Se não contiver explicitamente "mUC" ou "oUC":
  → classifique como "indefinida" e NÃO some

----------------------------------------------------------------
ETAPA 5 — SOMA CONTROLADA (PROIBIDO ATALHO)
Somente APÓS listar todas as linhas:
- injectedEnergyMUC = soma de TODOS os valores (kWh) classificados como "mUC"
- injectedEnergyOUC = soma de TODOS os valores (kWh) classificados como "oUC"

----------------------------------------------------------------
ETAPA 6 — CLASSIFICAÇÃO DE TENSÃO (OBRIGATÓRIO)

Você DEVE extrair os seguintes campos para classificação:

1. **classificacaoTexto**: Procure por "Classificação:" no cabeçalho
   - Exemplo: "MTC-CONVENCIONAL BAIXA TENSÃO / B3"
   - Exemplo: "ALTA TENSÃO"
   - Exemplo: "BAIXA RENDA"

2. **tensaoNominalDisp**: Procure "TENSÃO NOMINAL EM VOLTS" seguido de "DISP:"
   - Exemplo: "TENSÃO NOMINAL EM VOLTS DISP: 13800" → tensaoNominalDisp = 13800
   - Exemplo: "DISP: 117" → tensaoNominalDisp = 117
   - Se não encontrar, retorne 0

3. **temReativaExcedente**: Procure nos itens da fatura por "Energia Reativa Exced"
   - Se encontrar com valor > 0 → temReativaExcedente = true
   - Se não encontrar → temReativaExcedente = false

4. **valorReativaExcedente**: Valor em kWh da "Energia Reativa Exced"
   - Se não encontrar → 0

5. **historicoConsumoValores**: Procure tabela "CONSUMO FATURADO"
   - Extraia todos os valores numéricos (ignore vazios e "*")
   - Retorne como array de números
   - Exemplo: [32701, 28787, 79153, 27640, ...]

----------------------------------------------------------------
ETAPA 7 — FORMATO FINAL DE SAÍDA (OBRIGATÓRIO)

RETORNE APENAS JSON válido:
{
  "nomeCliente": "string",
  "consumoKwh": number,
  "valorTotal": number,
  "vencimento": "string",
  "codigoCliente": "string",
  "distribuidora": "string",
  "historicoConsumoValores": [number],
  "tarifaUnit": number,
  "injectedEnergyMUC": number,
  "injectedEnergyOUC": number,
  "linhasInjetadas": [
    {
      "descricaoOriginal": "string",
      "tipoUC": "mUC|oUC|indefinida",
      "competencia": "MM/AAAA|null",
      "valorKwh": number|null,
      "valorRS": number|null,
      "metodo": "kwh_direto|fallback_por_valor_rs|indefinido",
      "justificativa": "string"
    }
  ],
  "classificacaoTexto": "texto da classificação",
  "tensaoNominalDisp": number,
  "temReativaExcedente": boolean,
  "valorReativaExcedente": number,
  "enderecoCompleto": "string",
  "cidade": "string",
  "estado": "string"
}

TEXTO DA FATURA:
"""${textoParaIA}"""`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const dados = JSON.parse(completion.choices[0].message.content || '{}') as any;

    // Log detalhado para debug (server)
    console.log('\n🤖 [API/process-fatura] === DADOS DA IA ===', { requestId });
    console.log('📊 Consumo kWh (IA):', dados?.consumoKwh);
    console.log('💰 Tarifa Unit (IA):', dados?.tarifaUnit);
    console.log('☀️ Injetada mUC (IA):', dados?.injectedEnergyMUC);
    console.log('☀️ Injetada oUC (IA):', dados?.injectedEnergyOUC);
    console.log('📋 Linhas Injetadas (IA):', Array.isArray(dados?.linhasInjetadas) ? dados.linhasInjetadas.length : 0);
    
    if (Array.isArray(dados?.linhasInjetadas) && dados.linhasInjetadas.length > 0) {
      console.log('\n📄 LINHAS INJETADAS DETECTADAS PELA IA:');
      dados.linhasInjetadas.forEach((linha: any, idx: number) => {
        console.log(`  [${idx + 1}] Descrição:`, linha.descricaoOriginal);
        console.log(`      Tipo: ${linha.tipoUC} | kWh: ${linha.valorKwh} | R$: ${linha.valorRS}`);
        console.log(`      Método: ${linha.metodo} | Justificativa: ${linha.justificativa}`);
      });
    } else {
      console.log('⚠️ IA NÃO DETECTOU nenhuma linha de energia injetada!');
    }
    
    console.log('\n🔧 [API/process-fatura] === EXTRAÇÃO DETERMINÍSTICA (Fallback) ===');
    console.log('📊 Consumo kWh (Det):', detConsumo.consumoKwh);
    console.log('💰 Tarifa Unit (Det):', detConsumo.tarifaUnit);
    console.log('📋 Linhas Injetadas (Det):', detLinhasInjetadas.length);
    
    if (detLinhasInjetadas.length > 0) {
      console.log('\n📄 LINHAS INJETADAS DETECTADAS POR HEURÍSTICA:');
      detLinhasInjetadas.forEach((linha, idx) => {
        console.log(`  [${idx + 1}] Descrição:`, linha.descricaoOriginal);
        console.log(`      Tipo: ${linha.tipoUC} | kWh: ${linha.valorKwh} | R$: ${linha.valorRS}`);
        console.log(`      Método: ${linha.metodo}`);
      });
    }

    // ✅ RE-CÁLCULO DETERMINÍSTICO (corrige o bug clássico: mUC virando oUC)
    let injetadaMUC_calc = 0;
    let injetadaOUC_calc = 0;

    const linhasInjetadas: LinhaInjetada[] =
      Array.isArray(dados.linhasInjetadas) && dados.linhasInjetadas.length > 0 ? dados.linhasInjetadas : detLinhasInjetadas;

    for (const it of linhasInjetadas) {
      const desc = String(it?.descricaoOriginal || '').toUpperCase();
      const valor = Number(it?.valorKwh ?? 0);
      if (!Number.isFinite(valor) || valor <= 0) continue;
      if (desc.includes('OUC')) injetadaOUC_calc += valor;
      else if (desc.includes('MUC')) injetadaMUC_calc += valor;
    }

    const injetadaMUC = injetadaMUC_calc > 0 ? injetadaMUC_calc : Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = injetadaOUC_calc > 0 ? injetadaOUC_calc : Number(dados.injectedEnergyOUC || 0);
    
    console.log('\n🎯 [API/process-fatura] === VALORES FINAIS (Recalculados) ===');
    console.log('☀️ Injetada mUC (final):', injetadaMUC, 'kWh');
    console.log('☀️ Injetada oUC (final):', injetadaOUC, 'kWh');
    console.log('📋 Linhas usadas no cálculo:', linhasInjetadas.length);
    console.log('=====================================\n');

    // CÁLCULO DA MÉDIA DE CONSUMO (12 meses, vazios = 0, asteriscos = ignorar)
    let mediaConsumo = 0;
    const historico = dados.historicoConsumoValores || [];
    
    if (Array.isArray(historico) && historico.length > 0) {
      console.log('📊 [API/process-fatura] === CÁLCULO DA MÉDIA ===');
      console.log('Histórico bruto recebido:', historico);
      
      // Pega até 12 valores e filtra valores válidos
      const ultimos12Meses = historico.slice(0, 12);
      const valoresValidos: number[] = [];
      
      ultimos12Meses.forEach((c: any) => {
        const str = String(c || '').trim();
        
        // Ignora asteriscos e valores inválidos
        if (str === '*' || str === '') {
          console.log(`  Ignorando valor: "${str}"`);
          return;
        }
        
        const num = Number(c);
        if (!isNaN(num) && num >= 0) {
          valoresValidos.push(num);
          console.log(`  Valor válido: ${num}`);
        } else {
          console.log(`  Ignorando valor inválido: "${c}"`);
        }
      });
      
      if (valoresValidos.length > 0) {
        const somaTotal = valoresValidos.reduce((acc: number, val: number) => acc + val, 0);
        // Média = soma dos valores válidos / quantidade de valores válidos
        mediaConsumo = Math.round(somaTotal / valoresValidos.length);
        
        console.log('Valores válidos encontrados:', valoresValidos.length);
        console.log('Soma total:', somaTotal);
        console.log('Média calculada:', mediaConsumo);
      } else {
        console.log('⚠️ Nenhum valor válido encontrado no histórico');
      }
      
      console.log('==========================================\n');
    }

    // CLASSIFICAÇÃO DE TENSÃO
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';
    const classText = (dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;
    
    console.log('⚡ [API/process-fatura] === CLASSIFICAÇÃO DE TENSÃO ===');
    console.log('Texto classificação:', classText);
    console.log('Tensão DISP:', tensaoDisp);
    console.log('Tem Reativa Excedente:', temReativa);
    
    // Regra 1: Baixa Renda
    if (classText.includes('BAIXA RENDA')) {
      tensaoType = 'baixa_renda';
      console.log('✅ Classificado como: BAIXA RENDA');
    } 
    // Regra 2: Alta Tensão
    else if (
      classText.includes('ALTA TENSÃO') ||
      classText.includes('ALTA TENSAO') ||
      classText.includes('GRUPO A') ||
      classText.includes('A4') ||
      classText.includes('A3') ||
      classText.includes('A2')
    ) {
      tensaoType = 'alta';
      console.log('✅ Classificado como: ALTA TENSÃO');
    }
    // Regra 3: B Optante (2 critérios)
    else if (classText.includes('BAIXA TENSÃO') || classText.includes('BAIXA TENSAO')) {
      // Critério 1: DISP >= 13800
      if (tensaoDisp >= 13800) {
        tensaoType = 'b_optante';
        console.log('✅ Classificado como: B OPTANTE (DISP >= 13800)');
      }
      // Critério 2: Tem Energia Reativa Excedente
      else if (temReativa) {
        tensaoType = 'b_optante';
        console.log('✅ Classificado como: B OPTANTE (Reativa Excedente)');
      }
      // Se não tem nenhum dos critérios, é Baixa Tensão normal
      else {
        tensaoType = 'baixa';
        console.log('✅ Classificado como: BAIXA TENSÃO');
      }
    }
    // Fallback: Baixa Tensão
    else {
      tensaoType = 'baixa';
      console.log('✅ Classificado como: BAIXA TENSÃO (fallback)');
    }
    
    console.log('================================================\n');
    
    // ELEGIBILIDADE GD
    const consumo = Number(dados.consumoKwh || 0);
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';
    
    if (injetadaOUC > 0) {
      gdEligibility = 'oportunidade';
    } else if (injetadaMUC > 0) {
      const saldoDisponivel = consumo - injetadaMUC;
      if (saldoDisponivel > 1000) {
        gdEligibility = 'elegivel';
      } else {
        gdEligibility = 'inelegivel';
      }
    }

    // Resposta final
    const base = {
      ...dados,
      consumoKwh: Number(dados?.consumoKwh || 0) > 0 ? dados.consumoKwh : detConsumo.consumoKwh || dados.consumoKwh || 0,
      tarifaUnit: Number(dados?.tarifaUnit || 0) > 0 ? dados.tarifaUnit : detConsumo.tarifaUnit || dados.tarifaUnit || 0,
      mediaConsumo: mediaConsumo,
      linhasInjetadas,
      injectedEnergyMUC: injetadaMUC,
      injectedEnergyOUC: injetadaOUC,
      tensaoType: tensaoType,
      gdEligibility: gdEligibility,
      requestId,
    };

    if (!debugEnabled) return NextResponse.json(base);

    const debug = {
      _debug: {
        requestId,
        textoLen: textoFatura.length,
        temInjetada: /INJET/i.test(textoFatura),
        linhasComInjetada: pickDebugLines(textoFatura, /(INJET|INJ|GDI|GDII|GD)/i, 50),
        linhasComConsumo: pickDebugLines(textoFatura, /^\\s*Consumo\\s+em\\s+kwh/i, 10),
        deterministico: {
          consumoLine: detConsumo.line || null,
          consumoKwh: detConsumo.consumoKwh || null,
          tarifaUnit: detConsumo.tarifaUnit || null,
          linhasInjetadasCount: detLinhasInjetadas.length,
          primeirasLinhasInjetadas: detLinhasInjetadas.slice(0, 10),
        },
        headSample: head.slice(0, 1200),
        tailSample: tail.slice(0, 1200),
      },
    };

    return NextResponse.json({ ...base, ...debug });
  } catch (error: any) {
    console.error('[API/process-fatura] Erro Processamento:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro desconhecido', details: String(error?.stack || ''), requestId: undefined },
      { status: 500 }
    );
  }
}


