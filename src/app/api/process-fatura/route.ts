import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

type LinhaInjetada = {
  descricaoOriginal?: string;
  tipoUC?: 'mUC' | 'oUC' | 'indefinida' | string;
  competencia?: string | null;
  valorKwh?: number | null;
  valorRS?: number | null;
  metodo?: 'kwh_direto' | 'fallback_por_valor_rs' | 'indefinido' | string;
  justificativa?: string;
};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Falta OPENAI_API_KEY' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Array para acumular os logs e enviar para o frontend
  const debugLogs: string[] = [];
  
  // Função auxiliar para logar no servidor E guardar para o webconsole
  const log = (message: string, data?: any) => {
    const logString = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    console.log(message, data || ''); // Log no terminal do servidor
    debugLogs.push(logString); // Guarda para retorno
  };

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    let textoFatura = '';
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      textoFatura = data.text || '';
      log(`📄 PDF lido com sucesso. Tamanho do texto: ${textoFatura.length} caracteres.`);
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao ler PDF' }, { status: 422 });
    }

    const head = textoFatura.slice(0, 15000);
    const tail = textoFatura.length > 15000 ? textoFatura.slice(-15000) : '';
    const textoParaIA = `${head}\n\n-----[TAIL]-----\n\n${tail}`;

    log('🤖 Enviando texto para análise da IA...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Você é um perito em faturas da ENERGISA especializado em identificar energia injetada de Geração Distribuída (GD) e classificação de tensão. Você DEVE encontrar TODOS os valores de energia injetada mUC e oUC, mesmo quando o texto está desformatado. NUNCA confunda "Consumo em kWh" com "Energia Injetada".`,
        },
        {
          role: 'user',
          content: `Analise esta fatura da ENERGISA e extraia os dados. O texto pode estar desformatado.
          ... (MANTENHA O PROMPT ORIGINAL AQUI) ...
          TEXTO DA FATURA:
          """${textoParaIA}"""`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const dados = JSON.parse(completion.choices[0].message.content || '{}');

    // --- LOGS DETALHADOS DA EXTRAÇÃO ---
    log('=== 🔍 DADOS EXTRAÍDOS PELA IA ===');
    log(`⚡ Consumo Extraído: ${dados.consumoKwh} kWh`);
    log(`💲 Tarifa Unitária: R$ ${dados.tarifaUnit}`);
    log(`🏢 Classificação Texto: "${dados.classificacaoTexto}"`);
    log(`🔌 Tensão DISP: ${dados.tensaoNominalDisp}`);
    log(`⚠️ Reativa Excedente: ${dados.temReativaExcedente}`);

    log('--- ☀️ ANÁLISE DE ENERGIA INJETADA (IA) ---');
    if (dados.linhasInjetadas && Array.isArray(dados.linhasInjetadas)) {
        dados.linhasInjetadas.forEach((item: LinhaInjetada, index: number) => {
            log(`Item ${index + 1}:`);
            log(`   - Texto Original: "${item.descricaoOriginal}"`);
            log(`   - Tipo Identificado: ${item.tipoUC}`);
            log(`   - Valor kWh: ${item.valorKwh}`);
            log(`   - Método: ${item.metodo}`);
            log(`   - Justificativa IA: ${item.justificativa}`);
        });
    } else {
        log('Nenhuma linha de injeção detalhada foi retornada pela IA.');
    }
    
    log(`Total mUC (IA): ${dados.injectedEnergyMUC}`);
    log(`Total oUC (IA): ${dados.injectedEnergyOUC}`);

    // CÁLCULO DA MÉDIA DE CONSUMO
    let mediaConsumo = 0;
    const historico = dados.historicoConsumoValores || [];

    if (Array.isArray(historico) && historico.length > 0) {
      const consumosValidos = historico
        .map((c: any) => Number(c) || 0)
        .filter((c: number) => c > 0);

      if (consumosValidos.length > 0) {
        const somaConsumo = consumosValidos.reduce((acc: number, c: number) => acc + c, 0);
        mediaConsumo = Math.round(somaConsumo / consumosValidos.length);
      }
      log(`📊 Média de Consumo: ${mediaConsumo} kWh (Baseado em ${consumosValidos.length} meses)`);
    } else {
        log('📊 Média de Consumo: Não foi possível calcular (histórico vazio ou inválido).');
    }

    // ✅ RE-CÁLCULO DETERMINÍSTICO
    log('--- 🧮 RE-CÁLCULO (Validando IA) ---');
    let injetadaMUC_calc = 0;
    let injetadaOUC_calc = 0;

    const linhasInjetadas: LinhaInjetada[] = Array.isArray(dados.linhasInjetadas) ? dados.linhasInjetadas : [];

    for (const it of linhasInjetadas) {
      const desc = String(it?.descricaoOriginal || '').toUpperCase();
      const valor = Number(it?.valorKwh ?? 0);

      if (!Number.isFinite(valor) || valor <= 0) continue;

      if (desc.includes('OUC')) {
        injetadaOUC_calc += valor;
        log(`   -> Item somado em oUC: ${valor} kWh ("${desc}")`);
      } else if (desc.includes('MUC')) {
        injetadaMUC_calc += valor;
        log(`   -> Item somado em mUC: ${valor} kWh ("${desc}")`);
      } else {
        log(`   -> Item IGNORADO no cálculo manual (sem flag mUC/oUC): ${valor} kWh ("${desc}")`);
      }
    }

    const injetadaMUC = injetadaMUC_calc > 0 ? injetadaMUC_calc : Number(dados.injectedEnergyMUC || 0);
    const injetadaOUC = injetadaOUC_calc > 0 ? injetadaOUC_calc : Number(dados.injectedEnergyOUC || 0);

    log(`✅ Total Final mUC: ${injetadaMUC}`);
    log(`✅ Total Final oUC: ${injetadaOUC}`);

    // Regras de Elegibilidade GD
    const consumo = Number(dados.consumoKwh || 0);
    const tarifa = Number(dados.tarifaUnit || 0);

    let gdEligibility: 'padrao' | 'oportunidade' | 'elegivel' | 'inelegivel' = 'padrao';

    if (injetadaOUC > 0) {
      gdEligibility = 'oportunidade';
      log('🎯 Elegibilidade: OPORTUNIDADE (Possui injeção oUC)');
    } else if (injetadaMUC > 0) {
      const saldoDisponivel = consumo - injetadaMUC;
      log(`⚖️ Saldo Disponível (Consumo - mUC): ${saldoDisponivel}`);
      if (saldoDisponivel > 1000) {
        gdEligibility = 'elegivel';
        log('🎯 Elegibilidade: ELEGÍVEL (Saldo > 1000)');
      } else {
        gdEligibility = 'inelegivel';
        log('🎯 Elegibilidade: INELEGÍVEL (Saldo < 1000)');
      }
    } else {
        log('🎯 Elegibilidade: PADRÃO (Sem injeção detectada)');
    }

    // Classificação de Tensão
    let tensaoType: 'baixa' | 'alta' | 'b_optante' | 'baixa_renda' = 'baixa';
    const classText = (dados.classificacaoTexto || '').toUpperCase();
    const tensaoDisp = Number(dados.tensaoNominalDisp || 0);
    const temReativa = dados.temReativaExcedente === true;
    const valorReativa = Number(dados.valorReativaExcedente || 0);

    log('--- 🔌 CLASSIFICAÇÃO DE TENSÃO ---');
    if (classText.includes('BAIXA RENDA')) {
      tensaoType = 'baixa_renda';
      log('Tipo: BAIXA RENDA (Encontrado no texto)');
    } else if (
      classText.includes('ALTA TENSÃO') ||
      classText.includes('GRUPO A') ||
      classText.includes(' A4') ||
      classText.includes(' A3') ||
      classText.includes(' A2')
    ) {
      tensaoType = 'alta';
      log('Tipo: ALTA TENSÃO (Encontrado termos de Grupo A)');
    } else if (tensaoDisp >= 13800 || temReativa || valorReativa > 0) {
      tensaoType = 'b_optante';
      log(`Tipo: B OPTANTE (Critérios: Disp=${tensaoDisp}, Reativa=${temReativa})`);
    } else {
      tensaoType = 'baixa';
      log('Tipo: BAIXA TENSÃO (Padrão)');
    }

    // Geocoding
    let geoData = { latitude: null as number | null, longitude: null as number | null };
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (dados.enderecoCompleto || dados.cidade)) {
      try {
        const address = `${dados.enderecoCompleto || ''}, ${dados.cidade || ''} - ${dados.estado || ''}, Brasil`;
        log(`🗺️ Buscando coordenadas para: "${address}"`);
        
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address
        )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.results?.length > 0) {
          const loc = json.results[0].geometry.location;
          geoData = { latitude: loc.lat, longitude: loc.lng };
          log(`📍 Coordenadas encontradas: ${loc.lat}, ${loc.lng}`);
        } else {
            log('📍 Coordenadas não encontradas pelo Google Maps.');
        }
      } catch (err) {
        console.error('Geocoding error', err);
        log('❌ Erro no Geocoding.');
      }
    }

    // RETORNO FINAL COM OS LOGS
    return NextResponse.json({
      ...dados,
      mediaConsumo: mediaConsumo,
      unitPrice: tarifa,
      codigoCliente: dados.codigoCliente || '',
      distribuidora: dados.distribuidora || '',
      injectedEnergyMUC: injetadaMUC,
      injectedEnergyOUC: injetadaOUC,
      gdEligibility,
      tensaoType,
      ...geoData,
      debugLogs: debugLogs, // <--- AQUI: O frontend pode ler isso e mostrar no console
    });
  } catch (error: any) {
    console.error('Erro Processamento Fatura:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}