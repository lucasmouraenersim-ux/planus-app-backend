
import type { LucideProps } from 'lucide-react';
import type React from 'react';

export interface StateInfo {
  code: string;
  name: string;
  capital: string;
  population: string;
  area: string;
  funFact: string;
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  pathD: string;
  textTransform: string;
  abbreviation: string;
  circlePathD?: string;
  available: boolean;
}

export interface SavingsByFlag {
  green: { rate: number };
  yellow: { rate: number };
  red1: { rate: number };
  red2: { rate: number };
}

export interface SavingsResult {
  effectiveAnnualDiscountPercentage: number;
  monthlySaving: number;
  annualSaving: number;
  discountDescription: string;
  originalMonthlyBill: number;
  newMonthlyBillWithPlanus: number;
  savingsByFlag?: SavingsByFlag; // Optional property for DF-specific breakdown
}

// Manter tipos existentes
export interface InvoiceData {
  headerTitle: string;
  companyName: string;
  companyAddress: string;
  companyCityStateZip: string;
  companyCnpj: string;
  companyInscEst: string;
  domBanco: string;
  domEnt: string;
  classificacao: string;
  ligacao: string;
  tensaoNominalDisp: string;
  limMinTensao: string;
  limMaxTensao: string;
  leituraAnteriorData: string;
  leituraAtualData: string;
  numDiasFaturamento: string;
  proximaLeituraData: string;
  notaFiscalNum: string;
  clienteNome: string;
  clienteEndereco: string;
  clienteBairro: string;
  clienteCidadeUF: string;
  clienteCnpjCpf: string;
  codigoClienteInstalacao: string;
  mesAnoReferencia: string;
  dataVencimento: string;
  valorTotalFatura: string;
  item1Desc: string;
  item1Unidade: string;
  item1Quantidade: string;
  item1Tarifa: string;
  item1Valor: string;
  item1PisBase: string;
  item1PisAliq: string;
  item1PisValor: string;
  item1CofinsBase: string;
  item1CofinsAliq: string;
  item1CofinsValor: string;
  item1IcmsBase: string;
  item1IcmsPerc: string;
  item1TarifaEnergiaInjetadaREF: string;
  item1IcmsRS: string;
  item2Desc: string;
  item2Tarifa: string;
  item2Valor: string;
  item3Desc: string;
  item3Valor: string;
  valorProducaoPropria?: string;
  isencaoIcmsEnergiaGerada?: "sim" | "nao";
  [key: string]: string | undefined;
}

export interface FieldConfig {
  name: keyof InvoiceData;
  x: number;
  y: number;
  width: number;
  height: number;
  initialValue: string;
  style?: React.CSSProperties;
  className?: string;
  isTextarea?: boolean;
}


