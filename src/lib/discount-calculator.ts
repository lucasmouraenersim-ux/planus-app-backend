// src/lib/discount-calculator.ts
import type { SavingsResult, StateInfo, SavingsByFlag } from "@/types";
import { statesData } from "@/data/state-data";

// Constants
const MIN_BILL_AMOUNT_VALID = 50;
const MAX_BILL_AMOUNT_VALID = 100000;
const KWH_TO_R_FACTOR = 1.0907;

interface DiscountConfig {
  type: 'promotional' | 'fixed';
  promotional?: {
    rate: number; // e.g., 25 for 25%
    durationMonths: number;
    subsequentRate: number; // e.g., 15 for 15%
  };
  fixed?: {
    rate: number; // e.g., 20 for 20%
  };
}

const calculateDFSavings = (billAmountInReais: number, isFidelityEnabled: boolean): SavingsResult => {
    const kwh = billAmountInReais / KWH_TO_R_FACTOR;
    let savingsByFlag: SavingsByFlag;
    let description: string;
    let savingsRange: { min: number; max: number };

    if (kwh <= 5000) {
        savingsByFlag = {
            green: { rate: isFidelityEnabled ? 0.10 : 0.08 },
            yellow: { rate: isFidelityEnabled ? 0.13 : 0.11 },
            red1: { rate: isFidelityEnabled ? 0.15 : 0.13 },
            red2: { rate: isFidelityEnabled ? 0.18 : 0.15 }
        };
        savingsRange = { min: savingsByFlag.green.rate, max: savingsByFlag.red2.rate };
        description = `Para o DF, com consumo até 5.000 kWh, o desconto varia de ${savingsRange.min*100}% a ${savingsRange.max*100}% de acordo com a bandeira tarifária.`;
    } else if (kwh > 5000 && kwh <= 20000) {
        savingsByFlag = {
            green: { rate: 0.15 },
            yellow: { rate: 0.18 },
            red1: { rate: 0.21 },
            red2: { rate: 0.23 }
        };
        savingsRange = { min: savingsByFlag.green.rate, max: savingsByFlag.red2.rate };
        description = `Para o DF, com consumo de 5.000 a 20.000 kWh, o desconto varia de ${savingsRange.min*100}% a ${savingsRange.max*100}% de acordo com a bandeira tarifária.`;
    } else { // acima de 20000 kWh
        savingsByFlag = {
            green: { rate: 0.20 },
            yellow: { rate: 0.23 },
            red1: { rate: 0.25 },
            red2: { rate: 0.28 }
        };
        savingsRange = { min: savingsByFlag.green.rate, max: savingsByFlag.red2.rate };
        description = `Para o DF, com consumo acima de 20.000 kWh, o desconto varia de ${savingsRange.min*100}% a ${savingsRange.max*100}% de acordo com a bandeira tarifária.`;
    }

    // A média representa um cenário anual ponderado.
    const averageDiscountRate = (savingsByFlag.green.rate + savingsByFlag.red1.rate) / 2;

    const totalSavingsYear = billAmountInReais * 12 * averageDiscountRate;
    const averageMonthlySaving = totalSavingsYear / 12;
    const effectiveAnnualDiscountPercentage = averageDiscountRate * 100;
    const newMonthlyBillWithPlanus = billAmountInReais - averageMonthlySaving;

    return {
        effectiveAnnualDiscountPercentage: parseFloat(effectiveAnnualDiscountPercentage.toFixed(2)),
        monthlySaving: parseFloat(averageMonthlySaving.toFixed(2)),
        annualSaving: parseFloat(totalSavingsYear.toFixed(2)),
        discountDescription: description,
        originalMonthlyBill: parseFloat(billAmountInReais.toFixed(2)),
        newMonthlyBillWithPlanus: parseFloat(newMonthlyBillWithPlanus.toFixed(2)),
        savingsByFlag, // Include the detailed breakdown
    };
};

export function calculateSavings(
  billAmountInReais: number,
  config: DiscountConfig,
  stateCode?: string | null
): SavingsResult {
  
  if (stateCode === 'DF') {
    // A lógica de fidelidade original para DF precisa ser adaptada ou mantida.
    // Por simplicidade, vamos usar a configuração de fidelidade para decidir.
    const isFidelityEnabledForDF = config.type === 'promotional' || (config.type === 'fixed' && (config.fixed?.rate || 0) > 15);
    return calculateDFSavings(billAmountInReais, isFidelityEnabledForDF);
  }

  if (billAmountInReais < MIN_BILL_AMOUNT_VALID || billAmountInReais > MAX_BILL_AMOUNT_VALID) {
    return {
      effectiveAnnualDiscountPercentage: 0,
      monthlySaving: 0,
      annualSaving: 0,
      discountDescription: "Valor da conta fora da faixa de cálculo para descontos.",
      originalMonthlyBill: billAmountInReais,
      newMonthlyBillWithPlanus: billAmountInReais,
    };
  }

  let totalSavingsYear: number;
  let effectiveAnnualDiscountPercentage: number;
  let discountDescription: string;

  if (config.type === 'fixed' && config.fixed) {
    const fixedRate = config.fixed.rate / 100;
    totalSavingsYear = billAmountInReais * 12 * fixedRate;
    effectiveAnnualDiscountPercentage = config.fixed.rate;
    discountDescription = `${config.fixed.rate}% de desconto fixo durante todo o período.`;
  } else if (config.type === 'promotional' && config.promotional) {
    const promoRate = config.promotional.rate / 100;
    const promoMonths = config.promotional.durationMonths;
    const subsequentRate = config.promotional.subsequentRate / 100;
    const subsequentMonths = 12 - promoMonths;

    if (promoMonths >= 12) {
      // If promo duration is 12 months or more, it's effectively a fixed discount
      totalSavingsYear = billAmountInReais * 12 * promoRate;
    } else {
      const savingsPromoPeriod = billAmountInReais * promoMonths * promoRate;
      const savingsSubsequentPeriod = billAmountInReais * subsequentMonths * subsequentRate;
      totalSavingsYear = savingsPromoPeriod + savingsSubsequentPeriod;
    }
    
    effectiveAnnualDiscountPercentage = (totalSavingsYear / (billAmountInReais * 12)) * 100;
    discountDescription = `Desconto promocional de ${config.promotional.rate}% por ${promoMonths} meses, seguido por ${config.promotional.subsequentRate}% nos meses restantes.`;
  } else {
    // Fallback case, though it shouldn't be reached with proper config
    return {
      effectiveAnnualDiscountPercentage: 0,
      monthlySaving: 0,
      annualSaving: 0,
      discountDescription: "Configuração de desconto inválida.",
      originalMonthlyBill: billAmountInReais,
      newMonthlyBillWithPlanus: billAmountInReais,
    };
  }

  const averageMonthlySaving = totalSavingsYear / 12;
  const newMonthlyBillWithPlanus = billAmountInReais - averageMonthlySaving;

  return {
    effectiveAnnualDiscountPercentage: parseFloat(effectiveAnnualDiscountPercentage.toFixed(2)),
    monthlySaving: parseFloat(averageMonthlySaving.toFixed(2)),
    annualSaving: parseFloat(totalSavingsYear.toFixed(2)),
    discountDescription,
    originalMonthlyBill: parseFloat(billAmountInReais.toFixed(2)),
    newMonthlyBillWithPlanus: parseFloat(newMonthlyBillWithPlanus.toFixed(2)),
  };
}
