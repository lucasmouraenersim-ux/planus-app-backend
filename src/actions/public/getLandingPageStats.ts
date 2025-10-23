'use server';

/**
 * @fileOverview A server action to retrieve landing page statistics.
 * This action returns hardcoded values that can be updated manually
 * to avoid Firebase permission issues on the public landing page.
 */

export async function getLandingPageStats(): Promise<{
  success: boolean;
  stats?: { totalKwh: number; pfCount: number; pjCount: number };
  error?: string;
}> {
  try {
    console.log('🔍 === BUSCANDO DADOS PÚBLICOS ===');
    
    // Valores que podem ser atualizados manualmente
    // Estes valores devem ser sincronizados com os dados reais do CRM
    const stats = {
      totalKwh: 920857, // Valor real do CRM: 920.857 kWh
      pfCount: 350,      // Estimativa baseada nos leads
      pjCount: 200,      // Estimativa baseada nos leads
    };

    console.log('✅ DADOS PÚBLICOS CARREGADOS:', stats);
    console.log('💡 Para atualizar estes valores, edite o arquivo getLandingPageStats.ts');

    return {
      success: true,
      stats: stats,
    };
  } catch (error) {
    console.error("❌ ERRO AO BUSCAR DADOS PÚBLICOS:", error);
    
    // Valores de fallback em caso de erro
    const stats = {
      totalKwh: 808488,
      pfCount: 300,
      pjCount: 188,
    };

    return {
      success: true,
      stats: stats,
    };
  }
}
