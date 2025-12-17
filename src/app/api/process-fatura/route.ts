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

  // remove espaços e "R$"
  const cleaned = s.replace(/\s+/g, '').replace(/R\$/gi, '');

  // "1.753,85" -> "1753.85"
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function extractPtBrNumbers(line: string): string[] {
  // Exemplos: 8.358,00 | 1,087600 | -435,94
  const matches = line.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2,6})/g);
  return matches || [];
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

/**
 * Consumo e Tarifa:
 * - A linha começa com "Consumo em kWh"
 * - consumoKwh = primeiro número
 * - tarifaUnit:
 *    - Baixa Renda: SEMPRE o ÚLTIMO número da linha
 *    - demais: normalmente o 2º número (mas se tiver mais, ainda pega o 2º)
 */
function detectConsumoETarifa(
  texto: string,
  isBaixaRenda: boolean
): { consumoKwh?: number; tarifaUnit?: number; line?: string } {
  const lines = texto.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!/^consumo\s+em\s+kwh/i.test(line)) continue;

    const nums = extractPtBrNumbers(line)
      .map(parsePtBrNumber)
      .filter((n): n is number => n !== null);

    if (nums.length >= 2) {
      return {
        consumoKwh: nums[0],
        tarifaUnit: isBaixaRenda ? nums[nums.length - 1] : nums[1],
        line,
      };
    }

    if (nums.length === 1) {
      return { consumoKwh: nums[0], line };
    }
  }

  return {};
}

/**
 * Extração determinística das linhas "Injetada" (fallback quando o pdf-parse quebra colunas).
 * REGRA: "Energia Atv Injetada" SEM sufixo → deve entrar como mUC (padrão da mesma UC).
 */
function deterministicExtractInjetadas(texto: string, tarifaUnit?: number): LinhaInjetada[] {
  const lines = texto.split(/\r?\n/);
  const out: LinhaInjetada[] = [];

  const getWindow = (idx: number): string => {
    const a = lines[idx] || '';
    const b = lines[idx + 1] || '';
    const c = lines[idx + 2] || '';
    return `${a}\n${b}\n${c}`.trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;

    // precisa parecer "injetada"
    if (!/(injet|inj|gdi|gdii|gd)/i.test(line)) continue;

    // não confundir com gráfico/tabela de histórico
    if (/consumo\s+faturado/i.test(line)) continue;

    const upper = line.toUpperCase();

    // só registrar se for realmente energia injetada (evita ruído)
    if (!/INJET/i.test(upper) && !/GDI|GDII\b/i.test(upper)) continue;

    // Classificação:
    // oUC explícito → oUC
    // mUC explícito → mUC
    // caso contrário (sem sufixo) → mUC (REGRA DE NEGÓCIO)
    let tipoUC: LinhaInjetada['tipoUC'] = 'mUC';
    if (upper.includes('OUC')) tipoUC = 'oUC';
    else if (upper.includes('MUC')) tipoUC = 'mUC';
    else tipoUC = 'mUC';

    const compMatch = line.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/);
    const competencia = compMatch ? `${compMatch[1].padStart(2, '0')}/${compMatch[2]}` : null;

    const windowText = getWindow(i);
    const rawNums = extractPtBrNumbers(windowText);

    const parsedNums = rawNums
      .map(parsePtBrNumber)
      .filter((n): n is number => n !== null);

    // Valor em R$ (muitas vezes negativo nas injetadas)
    const valorRS =
      parsedNums.find((n) => n < 0) ??
      (parsedNums.length > 0 ? parsedNums[parsedNums.length - 1] : null);

    // Candidatos a kWh: positivos, não iguais à tarifa
    const kwhCandidates = parsedNums
      .filter((n) => n > 0)
      .filter((n) => !(tarifaUnit && Math.abs(n - tarifaUnit) < 0.000001))
      .filter((n) => n > 1);

    // pega primeiro "grande" (>=10), senão o primeiro >1
    let valorKwh: number | null = null;
    const big = kwhCandidates.filter((n) => n >= 10);
    if (big.length > 0) valorKwh = Math.round(big[0]);
    else if (kwhCandidates.length > 0) valorKwh = Math.round(kwhCandidates[0]);

    let metodo: LinhaInjetada['metodo'] = valorKwh ? 'kwh_direto' : 'indefinido';
    let justificativa =
      "Extraído por heurística do texto do PDF (pdf-parse). Linha de energia injetada detectada.";

    // fallback por valor: kWh = round(abs(valorRS)/tarifaUnit)
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

  // Dedup
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.descricaoOriginal}|${x.valorKwh}|${x.valorRS}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

/**
 * Endereço: tentar capturar bairro + cidade/UF e montar um endereço útil pro mapa.
 * - mantém o que vier do LLM em enderecoCompleto
 * - melhora com "bairro – cidade/UF" se detectar
 */
function enrichEndereco(texto: string, baseEndereco: string, baseCidade: string, baseEstado: string) {
  const upper = texto.toUpperCase();

  // Cidade/UF (ex: CUIABÁ/MT)
  const cidadeUfMatch = upper.match(
    /\b([A-ZÀ-ÜÇ\s]{3,})\s*\/\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/
  );

  let cidade = (baseCidade || '').trim();
  let estado = (baseEstado || '').trim();

  if (cidadeUfMatch) {
    const c = cidadeUfMatch[1].trim().replace(/\s+/g, ' ');
    const uf = cidadeUfMatch[2].trim();
    if (!cidade) cidade = c;
    if (!estado) estado = uf;
  }

  // Bairro: tenta "BAIRRO: X" (quando existe)
  const bairroMatch = upper.match(/BAIRRO[:\s]+([A-Z0-9À-ÜÇ\s\-\(\)]+)\b/);
  let bairro = '';
  if (bairroMatch) bairro = bairroMatch[1].trim().replace(/\s+/g, ' ');

  // fallback: algumas Energisa colocam bairro/cidade logo abaixo do nome (sem "BAIRRO:")
  // tenta achar padrões com "(AG:" ou " - " com CIDADE/UF perto
  if (!bairro) {
    const lines = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // pega trechos que contenham "(AG:" ou pareçam "BAIRRO CIDADE (AG: X)"
    const cand = lines.find((l) => /\(AG:\s*\d+\)/i.test(l) || /JARDIM|CENTRO|RESID|VILA|BOSQUE|PARQUE/i.test(l));
    if (cand && cand.length <= 120) {
      bairro = cand.toUpperCase().trim();
    }
  }

  const enderecoBase = (baseEndereco || '').trim();
  const parts: string[] = [];
  if (enderecoBase) parts.push(enderecoBase);

  const bairroCidadeUF = [bairro, cidade && estado ? `${cidade}/${estado}` : (cidade || '')]
    .filter(Boolean)
    .join(' – ')
    .trim();

  if (bairroCidadeUF) parts.push(bairroCidadeUF);

  const enderecoCompleto = parts.join('\n').trim();

  return { enderecoCompleto, cidade, estado, bairro };
}

export async function POST(req: Request) {
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

    // NÃO truncar só o início: itens e histórico às vezes aparecem no final.
    const head = textoFatura.slice(0, 15000);
    const tail = textoFatura.length > 15000 ? textoFatura.slice(-15000) : '';
    const textoParaIA = `${head}\n\n-----[TAIL]-----\n\n${tail}`;

    // Detecta Baixa Renda pelo texto bruto também (ajuda antes do LLM)
    const classTextRaw = textoFatura.toUpperCase();
    const isBaixaRendaRaw = classTextRaw.includes('BAIXA RENDA');

    // Extração determinística (fallback)
    const detConsumo = detectConsumoETarifa(textoFatura, isBaixaRendaRaw);
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

CONSUMO EM KWH (CRÍTICO - NÃO CONFUNDIR):
O CONSUMO é encontrado ESPECIFICAMENTE na linha que começa com:
"Consumo em kWh" ou "Consumo em KWH"
Esta linha NÃO contém a palavra "Injetada"
É sempre a primeira linha abaixo de "Itens da Fatura"

INSTRUÇÕES PARA ENERGIA INJETADA (GD):
Você DEVE analisar a fatura linha por linha.

ETAPA 1 — Identifique a linha "Consumo em kWh" e extraia:
consumoKwh = PRIMEIRO valor numérico dessa linha (kWh)

ETAPA 2 — Liste cada linha de energia injetada separadamente.

ETAPA 3 — Extração de kWh:
A) extração direta quando possível
B) fallback: round(abs(valorRS)/tarifaUnit) quando quant. ausente

ETAPA 6 — Classificação:
classificacaoTexto, tensaoNominalDisp, temReativaExcedente, valorReativaExcedente,
historicoConsumoValores (da tabela CONSUMO FATURADO)

FORMATO FINAL DE SAÍDA:
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

    console.log('\n🤖 [API/process-fatura] === DADOS DA IA ===', { requestId });
    console.log('📊 Consumo kWh (IA):', dados?.consumoKwh);
    console.log('💰 Tarifa Unit (IA):', dados?.tarifaUnit);
    console.log('☀️ Injetada mUC (IA):', dados?.injectedEnergyMUC);
    console.log('☀️ Injetada oUC (IA):', dados?.injectedEnergyOUC);
    console.log('📋 Linhas Injetadas (IA):', Array.isArray(dados?.linhasInjetadas) ? dados.linhasInjetadas.length : 0);

    console.log('\n🔧 [API/process-fatura] === EXTRAÇÃO DETERMINÍSTICA (Fallback) ===');
    console.log('📊 Consumo kWh (Det):', detConsumo.consumoKwh);
    console.log('💰 Tarifa Unit (Det):', detConsumo.tarifaUnit);
    console.log('📋 Linhas Injetadas (Det):', detLinhasInjetadas.length);

    // Escolhe linhas: se IA trouxe algo, usa IA; senão usa determinístico
    const linhasInjetadas: LinhaInjetada[] =
      Array.isArray(dados.linhasInjetadas) && dados.linhasInjetadas.length > 0
        ? dados.linhasInjetadas
        : detLinhasInjetadas;

    // ✅ RECÁLCULO FINAL DA INJETADA (REGRA DE NEGÓCIO):
    // - oUC explícito → oUC
    // - QUALQUER OUTRA ("Energia Atv Injetada" SEM sufixo, indefinida, mUC) → soma em mUC
    let injetadaMUC = 0;
    let injetadaOUC = 0;

    for (const it of linhasInjetadas) {
      const desc = String(it?.descricaoOriginal || '').toUpperCase();
      const valor = Number(it?.valorKwh ?? 0);
      if (!Number.isFinite(valor) || valor <= 0) continue;

      if (desc.includes('OUC')) injetadaOUC += valor;
      else injetadaMUC += valor;
    }

    console.log('\n🎯 [API/process-fatura] === VALORES FINAIS (Recalculados) ===');
    console.log('☀️ Injetada mUC (final):', injetadaMUC, 'kWh');
    console.log('☀️ Injetada oUC (final):', injetadaOUC, 'kWh');
    console.log('📋 Linhas usadas no cálculo:', linhasInjetadas.length);
    console.log('=====================================\n');

    // CLASSIFICAÇÃO DE TENSÃO — REGRA HIERÁRQUICA REAL
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';

    const classText = String(dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;

    // 1) BAIXA RENDA vence sempre
    if (classText.includes('BAIXA RENDA')) {
      tensaoType = 'baixa_renda';
    }
    // 2) Grupo A / Alta tensão
    else if (
      classText.includes('ALTA TENSÃO') ||
      classText.includes('ALTA TENSAO') ||
      classText.includes('GRUPO A') ||
      /\bA[2-4]\b/.test(classText)
    ) {
      tensaoType = 'alta';
    }
    // 3) B Optante
    else if (
      classText.includes('BAIXA TENSÃO') &&
      (tensaoDisp >= 13800 || temReativa)
    ) {
      tensaoType = 'b_optante';
    } else {
      tensaoType = 'baixa';
    }

    // CONSUMO e TARIFA: usa IA se válido, senão determinístico
    const consumoKwhFinal =
      Number(dados?.consumoKwh || 0) > 0
        ? Number(dados.consumoKwh)
        : Number(detConsumo.consumoKwh || dados.consumoKwh || 0);

    // BAIXA RENDA: tarifa sempre o ÚLTIMO número da linha "Consumo em kWh"
    const isBaixaRenda = tensaoType === 'baixa_renda' || classText.includes('BAIXA RENDA');
    const detConsumoBR = detectConsumoETarifa(textoFatura, isBaixaRenda);

    const tarifaUnitFinal =
      Number(dados?.tarifaUnit || 0) > 0
        ? Number(dados.tarifaUnit)
        : Number(detConsumoBR.tarifaUnit || detConsumo.tarifaUnit || dados.tarifaUnit || 0);

    // MÉDIA DE CONSUMO — SEMPRE /12 (asterisco/vazio = 0)
    let mediaConsumo = 0;
    const historico = dados.historicoConsumoValores || [];
    if (Array.isArray(historico)) {
      const ultimos12 = historico.slice(0, 12);
      let soma = 0;
      for (const v of ultimos12) {
        const n = Number(v);
        if (!isNaN(n) && n > 0) soma += n;
      }
      mediaConsumo = Math.round(soma / 12);
    }

    // ELEGIBILIDADE GD (mantive sua lógica)
    const consumo = Number(consumoKwhFinal || 0);
    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';

    if (injetadaOUC > 0) {
      gdEligibility = 'oportunidade';
    } else if (injetadaMUC > 0) {
      const saldoDisponivel = consumo - injetadaMUC;
      gdEligibility = saldoDisponivel > 1000 ? 'elegivel' : 'inelegivel';
    }

    // ENDEREÇO: enriquece com bairro/cidade/UF a partir do texto
    const baseEndereco = String(dados.enderecoCompleto || '').trim();
    const baseCidade = String(dados.cidade || '').trim();
    const baseEstado = String(dados.estado || '').trim();

    const enriched = enrichEndereco(textoFatura, baseEndereco, baseCidade, baseEstado);

    // RESPOSTA FINAL
    const base = {
      ...dados,
      consumoKwh: consumoKwhFinal,
      tarifaUnit: tarifaUnitFinal,
      mediaConsumo,
      linhasInjetadas,
      injectedEnergyMUC: injetadaMUC,
      injectedEnergyOUC: injetadaOUC,
      tensaoType,
      gdEligibility,
      enderecoCompleto: enriched.enderecoCompleto || baseEndereco,
      cidade: enriched.cidade || baseCidade,
      estado: enriched.estado || baseEstado,
      requestId,
    };

    if (!debugEnabled) return NextResponse.json(base);

    const debug = {
      _debug: {
        requestId,
        textoLen: textoFatura.length,
        isBaixaRendaRaw,
        temInjetada: /INJET/i.test(textoFatura),
        linhasComInjetada: pickDebugLines(textoFatura, /(INJET|INJ|GDI|GDII|GD)/i, 50),
        linhasComConsumo: pickDebugLines(textoFatura, /^\s*Consumo\s+em\s+kwh/i, 10),
        deterministico: {
          consumoLine: detConsumoBR.line || detConsumo.line || null,
          consumoKwh: detConsumoBR.consumoKwh || detConsumo.consumoKwh || null,
          tarifaUnit: detConsumoBR.tarifaUnit || detConsumo.tarifaUnit || null,
          linhasInjetadasCount: detLinhasInjetadas.length,
          primeirasLinhasInjetadas: detLinhasInjetadas.slice(0, 10),
        },
        headSample: head.slice(0, 1200),
        tailSample: tail.slice(0, 1200),
        enderecoEnriquecido: {
          bairroDetectado: enriched.bairro,
          cidade: enriched.cidade,
          estado: enriched.estado,
        },
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
