// src/lib/billing/leadPricing.ts
export function calculateLeadCost(consumoKwh: number): number {
  // Garante número positivo
  const kwh = Math.max(0, Number(consumoKwh) || 0);

  // TABELA DE PREÇOS FIXA (Conforme sua definição)
  
  // Até 2.000 kWh -> 1 Crédito (Cobre o ex: 875 kWh)
  if (kwh <= 2000) return 1;

  // Até 4.000 kWh -> 2 Créditos (Cobre o ex: 3.500 kWh)
  if (kwh <= 4000) return 2;

  // Até 8.000 kWh -> 4 Créditos (Cobre o ex: 5.000 kWh)
  if (kwh <= 8000) return 4;

  // Até 15.000 kWh -> 6 Créditos (Cobre o ex: 11.458 kWh)
  if (kwh <= 15000) return 6;

  // Até 50.000 kWh -> 8 Créditos (Cobre o ex: 17.531 kWh)
  if (kwh <= 50000) return 8;

  // Acima de 50k (Baleias) -> 10 Créditos (Teto Máximo)
  return 10; 
}

export function getLeadTierName(cost: number): string {
  switch (cost) {
    case 1: return "Residencial/Pequeno";
    case 2: return "Comércio Padrão";
    case 4: return "Alto Potencial";
    case 6: return "Grande Consumidor";
    case 8: return "Industrial";
    case 10: return "Grupo A / Power";
    default: return "Padrão";
  }
}
