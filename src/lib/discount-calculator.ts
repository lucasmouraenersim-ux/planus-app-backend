
// /src/lib/discount-calculator.ts
import type { SavingsResult, StateInfo, SavingsByFlag } from "@/types";
import { statesData } from "@/data/state-data";

// Constants
const MIN_BILL_AMOUNT_VALID = 50; 
const MAX_BILL_AMOUNT_VALID = 100000; 
const FIXED_DISCOUNT_NO_FIDELITY = 0.15; // 15%
const KWH_TO_R_FACTOR = 1.0907;

const calculateDFSavings = (billAmountInReais: number, isFidelityEnabled: boolean): SavingsResult => {
    const kwh = billAmountInReais / KWH_TO_R_FACTOR;
    let savingsByFlag: SavingsByFlag;
    let description: string;
    let savingsRange: { min: number; max: number };

    if (kwh <= 20000) {
        savingsByFlag = {
            green: { rate: isFidelityEnabled ? 0.10 : 0.08 }, // 10% (com) ou 8% (sem)
            yellow: { rate: isFidelityEnabled ? 0.13 : 0.11 },
            red1: { rate: isFidelityEnabled ? 0.15 : 0.13 },
            red2: { rate: isFidelityEnabled ? 0.18 : 0.15 }
        };
        savingsRange = { min: savingsByFlag.green.rate, max: savingsByFlag.red2.rate };
        description = `Para o DF, com consumo até 20.000 kWh, o desconto varia de ${savingsRange.min*100}% a ${savingsRange.max*100}% de acordo com a bandeira tarifária.`;
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
    const averageDiscountRate = (savingsRange.min + savingsRange.max) / 2;

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


export function calculateSavings(billAmountInReais: number, isFidelityEnabled: boolean, stateCode?: string | null): SavingsResult {
  
  if (stateCode === 'DF') {
    return calculateDFSavings(billAmountInReais, isFidelityEnabled);
  }

  // --- Lógica original para os outros estados ---
  let effectiveAnnualDiscountPercentage: number;
  let discountDescription: string;
  let totalSavingsYear: number;
  let averageMonthlySaving: number;

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

  if (!isFidelityEnabled) {
    // Fixed 15% discount if fidelity is not enabled
    totalSavingsYear = billAmountInReais * 12 * FIXED_DISCOUNT_NO_FIDELITY;
    averageMonthlySaving = totalSavingsYear / 12;
    effectiveAnnualDiscountPercentage = FIXED_DISCOUNT_NO_FIDELITY * 100;
    discountDescription = "15% de desconto fixo (sem fidelidade).";
  } else {
    // Existing tiered logic for when fidelity is enabled
    let firstTwoMonthsDiscountRate: number;
    let nextTenMonthsDiscountRate: number;
    let fixedAnnualDiscountRate: number | null = null;

    if (billAmountInReais <= 1000) {
      firstTwoMonthsDiscountRate = 0.25; // 25%
      nextTenMonthsDiscountRate = 0.15; // 15%
      discountDescription = "Com fidelidade: 25% nos 2 primeiros meses, 15% nos 10 meses seguintes.";
    } else if (billAmountInReais <= 3000) {
      firstTwoMonthsDiscountRate = 0.25; // 25%
      nextTenMonthsDiscountRate = 0.18; // 18%
      discountDescription = "Com fidelidade: 25% nos 2 primeiros meses, 18% nos 10 meses seguintes.";
    } else if (billAmountInReais <= 5000) {
      firstTwoMonthsDiscountRate = 0.25; // 25%
      nextTenMonthsDiscountRate = 0.22; // 22%
      discountDescription = "Com fidelidade: 25% nos 2 primeiros meses, 22% nos 10 meses seguintes.";
    } else if (billAmountInReais <= 10000) {
      fixedAnnualDiscountRate = 0.25; // 25%
      discountDescription = "Com fidelidade: 25% de desconto fixo anual.";
    } else if (billAmountInReais <= 20000) {
      fixedAnnualDiscountRate = 0.28; // 28%
      discountDescription = "Com fidelidade: 28% de desconto fixo anual.";
    } else { // billAmountInReais > 20000
      fixedAnnualDiscountRate = 0.30; // 30%
      discountDescription = "Com fidelidade: 30% de desconto fixo anual.";
    }

    if (fixedAnnualDiscountRate !== null) {
      totalSavingsYear = billAmountInReais * 12 * fixedAnnualDiscountRate;
      averageMonthlySaving = totalSavingsYear / 12;
      effectiveAnnualDiscountPercentage = fixedAnnualDiscountRate * 100;
    } else {
      const savingsFirstTwoMonths = billAmountInReais * firstTwoMonthsDiscountRate * 2;
      const savingsNextTenMonths = billAmountInReais * nextTenMonthsDiscountRate * 10;
      totalSavingsYear = savingsFirstTwoMonths + savingsNextTenMonths;
      averageMonthlySaving = totalSavingsYear / 12;
      effectiveAnnualDiscountPercentage = (totalSavingsYear / (billAmountInReais * 12)) * 100;
    }
  }
  
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
