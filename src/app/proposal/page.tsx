
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type ProposalState = {
  proposalCode: string;
  clientName: string;
  clientCpfCnpj: string;
  consumerUnit: string;
  distributor: string;
  comercializadora: string;
  avgConsumption: number;
  currentPrice: number;
  discountRate: number;
  coversTariffFlag: boolean;
};

type CalculatedValues = {
  avgMonthlyCost: number;
  bcPrice: number;
  bcMonthlyCost: number;
  monthlyEconomy: number;
  annualEconomy: number;
};

type Commercializer = {
  name: string;
  cnpj: string;
  segment: string;
  coverage: string;
  logo: string;
};

const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "R$ 0,00";
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatKWh = (value: number | undefined | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "0 kWh";
  }
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " kWh"
  );
};

const parseLocaleNumber = (value: string | null | undefined, fallback = 0) => {
  if (!value) return fallback;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const commercializerCatalog: Commercializer[] = [
  {
    name: "BC Energia",
    cnpj: "CNPJ 18.384.740/0001-34",
    segment: "Geracao distribuida para baixa tensao",
    coverage: "GO, DF, MT, MS",
    logo: "/proposal/comercializadoras/bc-energia.png",
  },
  {
    name: "Bolt Energy",
    cnpj: "CNPJ 43.899.807/0001-04",
    segment: "Comercializacao varejista e gestao de energia",
    coverage: "Centro-Oeste e Sudeste",
    logo: "/proposal/comercializadoras/bolt-energy.jpg",
  },
  {
    name: "Cenergy",
    cnpj: "CNPJ 35.274.925/0001-80",
    segment: "Geracao distribuida fotovoltaica",
    coverage: "GO, BA, MG",
    logo: "/proposal/comercializadoras/cenergy.jpg",
  },
  {
    name: "Serena Energia",
    cnpj: "CNPJ 40.102.671/0001-09",
    segment: "Midway e atacado de energia limpa",
    coverage: "CO, SE, NE",
    logo: "/proposal/comercializadoras/serena-energia.png",
  },
  {
    name: "Bowe Holding",
    cnpj: "CNPJ 31.746.013/0001-62",
    segment: "Holding de participacoes e servicos energeticos",
    coverage: "Atuacao nacional",
    logo: "/proposal/comercializadoras/bowe-holding.png",
  },
  {
    name: "Fit Energia",
    cnpj: "CNPJ 28.715.463/0001-55",
    segment: "Projetos sob medida de geracao compartilhada",
    coverage: "GO, MT, MS",
    logo: "/proposal/comercializadoras/fit-energia.png",
  },
];

const plants = [
  {
    name: "Complexo Solar Buriti",
    location: "Caldas Novas • Goiás",
    capacity: "4,8 MWp",
    image: "/proposal/usina-1.jpg",
  },
  {
    name: "Complexo Fotovoltaico Veredas",
    location: "Unaí • Minas Gerais",
    capacity: "6,2 MWp",
    image: "/proposal/usina-2.jpg",
  },
  {
    name: "Complexo Planus Rio Araguaia",
    location: "Barra do Garças • Mato Grosso",
    capacity: "5,5 MWp",
    image: "/proposal/capa-planus.png",
  },
];

function ProposalPageContent() {
  const searchParams = useSearchParams();
  const proposalRef = useRef<HTMLDivElement>(null);

  const [proposalData, setProposalData] = useState<ProposalState>({
    proposalCode: "0001/2025",
    clientName: "ACADEMIA FITNESS TOTAL LTDA",
    clientCpfCnpj: "XX.XXX.XXX/0001-XX",
    consumerUnit: "Rua das Acacias, 123 - Goiania/GO",
    distributor: "Neoenergia Brasilia",
    comercializadora: commercializerCatalog[0]?.name ?? "",
    avgConsumption: 23183,
    currentPrice: 0.98,
    discountRate: 19,
    coversTariffFlag: true,
  });

  const [calculated, setCalculated] = useState<CalculatedValues>({
    avgMonthlyCost: 0,
    bcPrice: 0,
    bcMonthlyCost: 0,
    monthlyEconomy: 0,
    annualEconomy: 0,
  });

  useEffect(() => {
    const consumerAddress = [
      searchParams.get("clienteRua") || "",
      searchParams.get("clienteNumero") || "",
    ]
      .filter(Boolean)
      .join(", ");
    const cityUf = [searchParams.get("clienteCidade") || "", searchParams.get("clienteUF") || ""]
      .filter(Boolean)
      .join("/");

    setProposalData((prev) => ({
      ...prev,
      proposalCode: searchParams.get("proposalCode") || prev.proposalCode,
      clientName: searchParams.get("clienteNome") || prev.clientName,
      clientCpfCnpj: searchParams.get("clienteCnpjCpf") || prev.clientCpfCnpj,
      consumerUnit:
        consumerAddress && cityUf
          ? `${consumerAddress} - ${cityUf}`
          : consumerAddress || cityUf || prev.consumerUnit,
      distributor: searchParams.get("distribuidora") || prev.distributor,
      comercializadora:
        searchParams.get("comercializadora") ||
        prev.comercializadora ||
        commercializerCatalog[0]?.name ||
        "",
      avgConsumption: parseLocaleNumber(searchParams.get("item1Quantidade"), prev.avgConsumption),
      currentPrice: parseLocaleNumber(searchParams.get("currentTariff"), prev.currentPrice),
      discountRate: parseLocaleNumber(
        searchParams.get("fixedRate") || searchParams.get("promotionalRate"),
        prev.discountRate,
      ),
      coversTariffFlag:
        searchParams.get("cobreBandeira") !== null
          ? ["true", "sim", "1"].includes(
              (searchParams.get("cobreBandeira") || "").toLowerCase(),
            )
          : prev.coversTariffFlag,
    }));
  }, [searchParams]);

  useEffect(() => {
    const { avgConsumption, currentPrice, discountRate } = proposalData;
    const discountDecimal = discountRate / 100;
    const avgMonthlyCost = avgConsumption * currentPrice;
    const bcPrice = currentPrice * (1 - discountDecimal);
    const bcMonthlyCost = avgConsumption * bcPrice;
    const monthlyEconomy = avgMonthlyCost - bcMonthlyCost;
    const annualEconomy = monthlyEconomy * 12;

    setCalculated({
      avgMonthlyCost,
      bcPrice,
      bcMonthlyCost,
      monthlyEconomy,
      annualEconomy,
    });
  }, [proposalData]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = event.target;
    const numericFields: Array<keyof ProposalState> = [
      "avgConsumption",
      "currentPrice",
      "discountRate",
    ];

    setProposalData((prev) => ({
      ...prev,
      [id]: numericFields.includes(id as keyof ProposalState)
        ? parseFloat(value) || 0
        : type === "checkbox"
        ? (event.target as HTMLInputElement).checked
        : value,
    }));
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { id, value } = event.target;
    setProposalData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");
    const content = proposalRef.current;
    if (content) {
      doc.html(content, {
        callback(pdf) {
          pdf.save(`Proposta_${proposalData.clientName.replace(/\s+/g, "_")}.pdf`);
        },
        x: 0,
        y: 0,
        html2canvas: {
          scale: 0.6,
          useCORS: true,
        },
      });
    }
  };
  const selectedCommercializer = useMemo(
    () =>
      commercializerCatalog.find((item) => item.name === proposalData.comercializadora) ||
      commercializerCatalog[0],
    [proposalData.comercializadora],
  );

  const bandeiraMessage = proposalData.coversTariffFlag
    ? "A comercializadora absorve os custos adicionais das bandeiras tarifárias, garantindo previsibilidade ao longo do contrato."
    : "Os custos adicionais das bandeiras tarifárias serão repassados conforme tabela vigente da ANEEL.";


  return (
    <div className="font-sans bg-gray-100 p-4 md:p-8">
      <div id="proposal-container" className="mx-auto max-w-5xl space-y-6">
      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={handleDownloadPDF} size="lg" className="h-16 w-auto rounded-full px-6 shadow-lg">
          <Download className="mr-3 h-6 w-6" />
          <div className="flex flex-col items-start">
            <span className="text-base font-bold">Baixar PDF</span>
            <span className="text-xs font-medium text-white/80">Exportar proposta</span>
          </div>
        </Button>
      </div>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={<div>Carregando proposta...</div>}>
      <ProposalPageContent />