
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
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/BC-ENERGIA.png",
  },
  {
    name: "Bolt Energy",
    cnpj: "CNPJ 43.899.807/0001-04",
    segment: "Comercializacao varejista e gestao de energia",
    coverage: "Centro-Oeste e Sudeste",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/Bolt%20Energy.jpg",
  },
  {
    name: "Cenergy",
    cnpj: "CNPJ 35.274.925/0001-80",
    segment: "Geracao distribuida fotovoltaica",
    coverage: "GO, BA, MG",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.jpg",
  },
  {
    name: "Serena Energia",
    cnpj: "CNPJ 40.102.671/0001-09",
    segment: "Midway e atacado de energia limpa",
    coverage: "CO, SE, NE",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.png",
  },
  {
    name: "Bowe Holding",
    cnpj: "CNPJ 31.746.013/0001-62",
    segment: "Holding de participacoes e servicos energeticos",
    coverage: "Atuacao nacional",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_bow-e-holding_NU3tgD.png",
  },
  {
    name: "Fit Energia",
    cnpj: "CNPJ 28.715.463/0001-55",
    segment: "Projetos sob medida de geracao compartilhada",
    coverage: "GO, MT, MS",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_fitenergia.png",
  },
];

const plants = [
  {
    name: "Complexo Solar Ceilandia - DF",
    location: "Ceilândia • Distrito Federal",
    capacity: "Capacidade não informada",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/Complexo-solar-Ceilandia-DF-1-768x465.jpg",
  },
  {
    name: "Complexo Solar Janaúba - MG",
    location: "Janaúba • Minas Gerais",
    capacity: "1,5 GWp",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/maior-energia-solar-brasil-mg-ciclovivo.jpg",
  },
  {
    name: "Complexo GDSun",
    location: "Localização não informada",
    capacity: "Comercializador: GDSun",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/maior-energia-solar-brasil-mg-ciclovivo.jpg",
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
        <div className="rounded-xl border-t-8 border-sky-600 bg-white p-6 md:p-8">
          <h2 className="mb-6 text-3xl font-bold text-gray-800">
            ⚙️ Configuração Rápida da Proposta (Edite Aqui)
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="proposalCode" className="block text-sm font-medium text-gray-700">
                1. Código da Proposta
              </label>
              <input
                type="text"
                id="proposalCode"
                value={proposalData.proposalCode}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                2. Nome do Cliente
              </label>
              <input
                type="text"
                id="clientName"
                value={proposalData.clientName}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="clientCpfCnpj" className="block text-sm font-medium text-gray-700">
                3. CNPJ/CPF
              </label>
              <input
                type="text"
                id="clientCpfCnpj"
                value={proposalData.clientCpfCnpj}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="consumerUnit" className="block text-sm font-medium text-gray-700">
                4. Unidade Consumidora (UC)
              </label>
              <input
                type="text"
                id="consumerUnit"
                value={proposalData.consumerUnit}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="distributor" className="block text-sm font-medium text-gray-700">
                5. Distribuidora
              </label>
              <input
                type="text"
                id="distributor"
                value={proposalData.distributor}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="comercializadora" className="block text-sm font-medium text-gray-700">
                6. Comercializadora Responsável
              </label>
              <select
                id="comercializadora"
                value={proposalData.comercializadora}
                onChange={handleSelectChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              >
                {commercializerCatalog.map((commercializer) => (
                  <option key={commercializer.name} value={commercializer.name}>
                    {commercializer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="avgConsumption" className="block text-sm font-medium text-gray-700">
                7. Consumo Mensal (kWh)
              </label>
              <input
                type="number"
                id="avgConsumption"
                value={proposalData.avgConsumption}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="currentPrice" className="block text-sm font-medium text-gray-700">
                8. Tarifa Atual (R$/kWh)
              </label>
              <input
                type="number"
                step="0.01"
                id="currentPrice"
                value={proposalData.currentPrice}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label htmlFor="discountRate" className="block text-sm font-medium text-gray-700">
                9. Desconto Oferecido (%)
              </label>
              <input
                type="number"
                id="discountRate"
                value={proposalData.discountRate}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                id="coversTariffFlag"
                type="checkbox"
                checked={proposalData.coversTariffFlag}
                onChange={handleInputChange}
                className="h-4 w-4 accent-sky-600"
              />
              <label htmlFor="coversTariffFlag" className="text-sm font-medium text-gray-700">
                Esta proposta cobre bandeiras tarifárias
              </label>
            </div>
          </div>
        </div>

        <div ref={proposalRef} className="space-y-6">
          <div className="relative flex min-h-[1024px] flex-col justify-between overflow-hidden rounded-xl bg-slate-900 text-white">
            <Image
              src="https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/96dbd2e9523b247dd65b33b507908aa99ff3a78a/capa-planus.png"
              alt="Capa proposta Planus Energia"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/70" />

            <div className="relative flex flex-col items-center justify-between px-6 py-10 text-center md:px-16 md:py-16">
              <div className="flex w-full items-start justify-between text-sm md:text-base">
                <span className="font-light uppercase tracking-wide text-sky-200">
                  Proposta Comercial Planus Energia
                </span>
                <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-sky-100">
                  Código: {proposalData.proposalCode}
                </span>
              </div>

              <div className="mt-16 flex flex-col items-center gap-4">
                <Image
                  src="/proposal/logo-planus.png"
                  alt="Logo Planus Energia"
                  width={120}
                  height={120}
                  className="drop-shadow-lg"
                />
                <h1 className="text-5xl font-black tracking-tight md:text-7xl">
                  Energia por Assinatura
                </h1>
                <h2 className="text-2xl font-light text-sky-100 md:text-3xl">
                  Soluções completas em geração distribuída
                </h2>
              </div>

              <div className="mt-24 flex flex-col items-center gap-3">
                <p className="text-lg font-light text-sky-100 md:text-2xl">
                  Geramos valor com a nossa energia, entregue sob medida para sua operação.
                </p>
                <p className="text-sm uppercase tracking-[0.3em] text-sky-200">
                  Planus Energia • Geração Distribuída • Mercado Livre
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-8 md:p-12">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-4xl font-extrabold text-slate-900">Quem Somos</h2>
                <p className="mt-2 max-w-3xl text-lg text-slate-600">
                  A Planus Energia integra um ecossistema de empresas especializadas em soluções de energia limpas, conectando consumidores às nossas usinas fotovoltaicas e comercializadoras parceiras. Atuamos com responsabilidade ESG, neutralizando emissões e preservando recursos naturais.
                </p>
              </div>
              <Image src="/proposal/logo-planus.png" alt="Logo Planus" width={140} height={140} className="self-start md:self-center" />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 text-center sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-3xl font-black text-sky-900">+5.500</p>
                <p className="text-sm text-slate-600">Clientes atendidos nas soluções Planus</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-3xl font-black text-sky-900">+R$ 480 mi</p>
                <p className="text-sm text-slate-600">Economia gerada nos últimos 10 anos</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-3xl font-black text-sky-900">+230 GWh</p>
                <p className="text-sm text-slate-600">Energia limpa gerada pelas nossas usinas</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-3xl font-black text-sky-900">ESG</p>
                <p className="text-sm text-slate-600">+15 mil toneladas de CO₂ evitadas</p>
              </div>
            </div>

            <h3 className="mt-12 text-2xl font-bold text-slate-900">Algumas de nossas usinas</h3>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plants.map((plant) => (
                <div key={plant.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="relative h-40 w-full">
                    <Image src={plant.image} alt={plant.name} fill className="object-cover" />
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="text-sm font-semibold text-slate-800">{plant.name}</p>
                    <p className="text-xs text-slate-500">{plant.location}</p>
                    <p className="text-xs font-medium text-sky-600">{plant.capacity}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-12 text-2xl font-bold text-slate-900">
              Comercializadoras sob gestão Planus
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Atuamos através de estrutura multicomercializadora, garantindo aderência regulatória e competitividade para cada perfil de cliente.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {commercializerCatalog.map((item) => (
                <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex h-16 items-center justify-center">
                    <Image
                      src={item.logo}
                      alt={`Logo ${item.name}`}
                      width={160}
                      height={64}
                      className="h-auto w-auto max-h-16 max-w-[160px] object-contain"
                    />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">{item.name}</h4>
                  {item.cnpj ? (
                    <p className="text-xs uppercase tracking-widest text-sky-600">{item.cnpj}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-600">{item.segment}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Cobertura: {item.coverage}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-8 md:p-12">
            <h2 className="text-4xl font-extrabold text-sky-900">Proposta Comercial</h2>
            <p className="mt-2 text-lg text-slate-600">
              Geração Distribuída • Energia por Assinatura • PPA Planus
            </p>

            <div className="mt-8 rounded-xl border-l-4 border-sky-500 bg-slate-50 p-6">
              <h3 className="text-xl font-bold text-slate-800">Dados da Proposta</h3>
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-900">Cliente</dt>
                  <dd>{proposalData.clientName}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">CNPJ/CPF</dt>
                  <dd>{proposalData.clientCpfCnpj}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Instalação (UC)</dt>
                  <dd>{proposalData.consumerUnit}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Distribuidora Local</dt>
                  <dd>{proposalData.distributor}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border-l-4 border-rose-500 bg-rose-50 p-6">
                <h3 className="text-2xl font-bold text-rose-700">Cenário Atual (sem Planus)</h3>
                <div className="mt-4 space-y-3 text-sm text-rose-700">
                  <p className="flex justify-between">
                    <span>Consumo Mensal</span>
                    <strong>{formatKWh(proposalData.avgConsumption)}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Tarifa Atual (R$/kWh)</span>
                    <strong>{formatCurrency(proposalData.currentPrice)}</strong>
                  </p>
                  <p className="flex justify-between border-t border-rose-200 pt-3 text-lg">
                    <span>Custo Médio Mensal</span>
                    <strong>{formatCurrency(calculated.avgMonthlyCost)}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50 p-6">
                <h3 className="text-2xl font-bold text-emerald-700">Cenário com Planus Energia</h3>
                <div className="mt-4 space-y-3 text-sm text-emerald-700">
                  <p className="flex justify-between">
                    <span>Desconto Aplicado</span>
                    <strong>{proposalData.discountRate}%</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Tarifa Planus (R$/kWh)</span>
                    <strong>{formatCurrency(calculated.bcPrice)}</strong>
                  </p>
                  <p className="flex justify-between border-t border-emerald-200 pt-3 text-lg">
                    <span>Custo Médio Mensal</span>
                    <strong>{formatCurrency(calculated.bcMonthlyCost)}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_3fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Comercializadora responsável pela entrega
                </h3>
                {selectedCommercializer?.logo ? (
                  <div className="mt-4 flex h-16 items-center justify-center">
                    <Image
                      src={selectedCommercializer.logo}
                      alt={`Logo ${selectedCommercializer.name}`}
                      width={160}
                      height={64}
                      className="h-auto w-auto max-h-16 max-w-[160px] object-contain"
                    />
                  </div>
                ) : null}
                <p className="mt-4 text-sm text-slate-600">{selectedCommercializer?.name}</p>
                {selectedCommercializer?.cnpj ? (
                  <p className="mt-1 text-xs uppercase tracking-widest text-sky-600">
                    {selectedCommercializer.cnpj}
                  </p>
                ) : null}
                <p className="mt-4 text-sm text-slate-600">
                  {selectedCommercializer?.segment} • Cobertura: {selectedCommercializer?.coverage}
                </p>
                <div
                  className={`mt-6 rounded-lg border px-4 py-3 text-sm font-medium ${
                    proposalData.coversTariffFlag
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                  }`}
                >
                  {bandeiraMessage}
                </div>
              </div>

              <div className="rounded-xl bg-sky-600 p-6 text-center text-white shadow-lg">
                <p className="text-lg font-semibold">Economia Mensal Projetada</p>
                <p className="text-5xl font-black">{formatCurrency(calculated.monthlyEconomy)}</p>
                <p className="mt-6 text-base font-semibold uppercase tracking-widest text-sky-100">
                  Economia Anual Sem Investimento
                </p>
                <p className="text-4xl font-black text-amber-300">
                  {formatCurrency(calculated.annualEconomy)}
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="text-2xl font-bold text-slate-900">O que é a Bandeira Tarifária?</h3>
              <p className="mt-4 text-sm text-slate-600">
                As bandeiras tarifárias sinalizam as condições de geração de energia no sistema elétrico brasileiro. Mesmo em cenários críticos, a Planus entrega previsibilidade contratual e suporte consultivo na gestão da conta.
              </p>
              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Cor</th>
                      <th className="px-6 py-3 font-semibold">Significado</th>
                      <th className="px-6 py-3 font-semibold">Impacto na Conta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-600">
                    <tr>
                      <td className="px-6 py-3 font-semibold text-emerald-600">Verde</td>
                      <td className="px-6 py-3">Condições normais de geração</td>
                      <td className="px-6 py-3">Sem cobrança adicional</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-amber-500">Amarela</td>
                      <td className="px-6 py-3">Geração mais cara</td>
                      <td className="px-6 py-3">Taxa adicional moderada</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-red-600">Vermelha I</td>
                      <td className="px-6 py-3">Geração muito cara</td>
                      <td className="px-6 py-3">Custo extra elevado</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 font-semibold text-red-800">Vermelha II</td>
                      <td className="px-6 py-3">Geração crítica</td>
                      <td className="px-6 py-3">Custo extra máximo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-0 shadow-lg">
            <Image
              src="/proposal/clientes-planus.png"
              alt="Alguns dos clientes atendidos pela Planus Energia"
              width={2480}
              height={1754}
              className="w-full rounded-xl object-cover"
            />
          </div>
        </div>
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
    </Suspense>
  );
}
