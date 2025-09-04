
// src/components/admin/CompanyCommissionsTable.tsx
"use client";

import { useMemo, useState, useEffect } from 'react';
import type { LeadWithId, StageId } from '@/types/crm';
import type { FirestoreUser } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '../ui/badge';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { AlertTriangle, Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';


interface CompanyCommissionsTableProps {
  leads: LeadWithId[];
  allUsers: FirestoreUser[];
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const EMPRESA_OPTIONS = ['Bowe', 'Origo', 'BC', 'Matrix', 'Fit Energia'];
const FINANCIAL_STATUS_OPTIONS = [
    { value: 'none', label: 'Não Definido' },
    { value: 'Adimplente', label: 'Adimplente' },
    { value: 'Inadimplente', label: 'Inadimplente' },
    { value: 'Em atraso', label: 'Em atraso' },
    { value: 'Nunca pagou', label: 'Nunca pagou' },
    { value: 'Cancelou', label: 'Cancelou' },
];

const getFinancialStatusBadgeStyle = (status?: string) => {
    switch (status) {
        case 'Adimplente': return 'bg-green-500/20 text-green-400 border-green-500/50';
        case 'Inadimplente': return 'bg-red-500/20 text-red-400 border-red-500/50';
        case 'Em atraso': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
        case 'Nunca pagou': return 'bg-red-600/30 text-red-300 border-red-600/50';
        case 'Cancelou': return 'bg-red-500/20 text-red-400 border-red-500/50 line-through';
        default: return 'bg-muted/50';
    }
};

interface TableRowData {
  id: string;
  promotor: string;
  promotorId?: string;
  cliente: string;
  status: string;
  empresa: string;
  kwh: number;
  proposta: number;
  desagil: number; // Storing as a number (e.g., 20 for 20%)
  comissaoImediata: number;
  dataComissaoImediata: string;
  segundaComissao: number;
  dataSegundaComissao: string;
  terceiraComissao: number;
  dataTerceiraComissao: string;
  quartaComissao: number;
  dataQuartaComissao: string;
  comissaoTotal: number;
  comissaoPromotor: number;
  lucroBruto: number;
  lucroLiq: number;
  jurosPerc: string;
  jurosRS: number;
  garantiaChurn: number;
  comercializador: number;
  nota: number;
  
  recorrenciaAtiva: boolean;
  recorrenciaPerc: number;
  recorrenciaComissao: number;
  recorrenciaPaga: boolean;

  // For dynamic calculation
  segundaComissaoPerc: number;
  terceiraComissaoPerc: number;
  financialStatus: 'none' | 'Adimplente' | 'Inadimplente' | 'Em atraso' | 'Nunca pagou' | 'Cancelou';
  completedAt: string | undefined;
}

export default function CompanyCommissionsTable({ leads, allUsers }: CompanyCommissionsTableProps) {
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.uid, u])), [allUsers]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [recurrenceCompanyFilter, setRecurrenceCompanyFilter] = useState('all');
  const [recurrencePromoterFilter, setRecurrencePromoterFilter] = useState('all');
  const [recurrenceDateFilter, setRecurrenceDateFilter] = useState<DateRange | undefined>();

  const calculateCommission = (
    proposta: number, 
    desagilPercent: number, 
    promotorId?: string
  ): number => {
    const promotor = promotorId ? userMap.get(promotorId) : undefined;
    const baseCommissionRate = promotor?.commissionRate || 40; // Default to 40% if not set
    const baseCalculo = proposta * (1 - (desagilPercent / 100));
    return baseCalculo * (baseCommissionRate / 100);
  };
    
  const totalKwhFinalizadoNoMes = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return leads
      .filter(lead => 
        lead.stageId === 'finalizado' && 
        lead.completedAt &&
        isWithinInterval(parseISO(lead.completedAt), { start, end })
      )
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);
  
  const calculateFinancials = (rowData: Omit<TableRowData, 'comissaoTotal' | 'lucroBruto' | 'lucroLiq' | 'garantiaChurn' | 'comercializador' | 'nota' | 'jurosRS' | 'jurosPerc' >) => {
    const comissaoTotal = rowData.comissaoImediata + rowData.segundaComissao + rowData.terceiraComissao + rowData.quartaComissao;
    const lucroBruto = comissaoTotal - rowData.comissaoPromotor;
    const garantiaChurn = comissaoTotal * 0.10;
    
    // Updated Comercializador logic
    const comercializador = (rowData.empresa === 'Bowe' || rowData.empresa === 'Matrix' || rowData.empresa === 'Fit Energia') ? 0 : comissaoTotal * 0.10;
    
    const nota = comissaoTotal * 0.12;
    const lucroLiq = lucroBruto - garantiaChurn - comercializador - nota;

    let jurosRS = 0;
    let jurosPerc = "0%";
    if (rowData.empresa === 'BC') {
        jurosRS = rowData.comissaoImediata * 0.12;
        jurosPerc = "12%";
    } else if (rowData.empresa === 'Origo') {
        jurosRS = rowData.comissaoImediata * 0.17;
        jurosPerc = "17%";
    }
    
    const recorrenciaComissao = rowData.recorrenciaAtiva ? rowData.proposta * (rowData.recorrenciaPerc / 100) : 0;

    return {
      comissaoTotal,
      lucroBruto,
      lucroLiq,
      garantiaChurn,
      comercializador,
      nota,
      jurosRS: jurosRS,
      jurosPerc: jurosPerc,
      recorrenciaComissao,
    };
  }

  // Initialize table data
  useEffect(() => {
    const stagesToInclude: StageId[] = ['contrato', 'conformidade', 'assinado', 'finalizado'];
    const leadsForCommission = leads.filter(lead => stagesToInclude.includes(lead.stageId));

    const initialData = leadsForCommission.map(lead => {
        const desagilInitial = lead.discountPercentage || 0;
        const proposta = lead.valueAfterDiscount || 0;
        const empresa = 'Bowe'; // Default all existing leads to Bowe
        const promotorId = lead.userId;

        // Recorrência
        const sellerNameLower = (lead.sellerName || '').toLowerCase();
        const isExcludedFromRecurrence = sellerNameLower.includes('eduardo') || sellerNameLower.includes('diogo');
        const recorrenciaAtivaInitial = !isExcludedFromRecurrence;
        const recorrenciaPercInitial = !isExcludedFromRecurrence ? 1 : 0;

        // Comissão do Promotor
        const comissaoPromotorInitial = calculateCommission(proposta, desagilInitial, promotorId);

        // Comissão Imediata
        let comissaoImediata = 0;
        if (empresa === 'Bowe' || empresa === 'Matrix') {
            comissaoImediata = proposta * 0.60;
        } else if (empresa === 'Origo' || empresa === 'BC') {
            comissaoImediata = proposta * 0.50;
        } else if (empresa === 'Fit Energia') {
            comissaoImediata = proposta * 0.40;
        }

        // Segunda Comissão
        let segundaComissao = 0;
        let segundaComissaoPerc = 45; // Default for BC
        if (empresa === 'BC') {
            segundaComissao = proposta * 0.45;
        } else if (empresa === 'Origo') {
            segundaComissaoPerc = 120; // Defaulting to 120% for Origo
            segundaComissao = proposta * (segundaComissaoPerc / 100);
        } else if (empresa === 'Fit Energia') {
            segundaComissao = proposta * 0.60;
        }

        // Terceira Comissão
        let terceiraComissao = 0;
        let terceiraComissaoPerc = 60; // Default for BC
        if (empresa === 'BC') {
            terceiraComissao = proposta * 0.60;
        } else if (empresa === 'Origo') {
            if (totalKwhFinalizadoNoMes >= 30000 && totalKwhFinalizadoNoMes <= 40000) {
                terceiraComissaoPerc = 30;
            } else if (totalKwhFinalizadoNoMes > 40000) {
                terceiraComissaoPerc = 50; // Default to 50, user can select 70
            } else {
                terceiraComissaoPerc = 0;
            }
            terceiraComissao = proposta * (terceiraComissaoPerc / 100);
        }

        // Check if the lead was finalized more than 120 days ago
        let recorrenciaPagaInitial = false;
        let financialStatusInitial: TableRowData['financialStatus'] = 'none';
        if (lead.completedAt) {
            const completedDate = parseISO(lead.completedAt);
            const daysSinceCompletion = differenceInDays(new Date(), completedDate);
            if (daysSinceCompletion > 120) {
                recorrenciaPagaInitial = true;
                financialStatusInitial = 'Adimplente';
            }
        }
        
        const partialRow = {
            id: lead.id,
            promotor: lead.sellerName || 'N/A',
            promotorId: promotorId,
            cliente: lead.name,
            status: lead.stageId,
            empresa: empresa,
            kwh: lead.kwh || 0,
            proposta: proposta,
            desagil: desagilInitial,
            comissaoImediata: comissaoImediata,
            dataComissaoImediata: "3 dias depois",
            segundaComissao: segundaComissao,
            dataSegundaComissao: "45 dias depois",
            terceiraComissao: terceiraComissao,
            dataTerceiraComissao: "4 meses depois",
            quartaComissao: 0,
            dataQuartaComissao: "6 meses depois",
            comissaoPromotor: comissaoPromotorInitial,
            recorrenciaAtiva: recorrenciaAtivaInitial,
            recorrenciaPerc: recorrenciaPercInitial,
            segundaComissaoPerc: segundaComissaoPerc,
            terceiraComissaoPerc: terceiraComissaoPerc,
            recorrenciaPaga: recorrenciaPagaInitial,
            financialStatus: financialStatusInitial,
            completedAt: lead.completedAt
        };
        
        const financials = calculateFinancials(partialRow as any);

        return { ...partialRow, ...financials };
    });
    setTableData(initialData);
  }, [leads, userMap, totalKwhFinalizadoNoMes]);

  const updateRowData = (leadId: string, updates: Partial<TableRowData>) => {
    setTableData(currentData =>
      currentData.map(row => {
        if (row.id === leadId) {
          let updatedRow: TableRowData = { ...row, ...updates };

          const comissaoPromotor = calculateCommission(updatedRow.proposta, updatedRow.desagil, updatedRow.promotorId);
          updatedRow.comissaoPromotor = comissaoPromotor;
          
          let comissaoImediata = 0;
          if (updatedRow.empresa === 'Bowe' || updatedRow.empresa === 'Matrix') {
              comissaoImediata = updatedRow.proposta * 0.60;
          } else if (updatedRow.empresa === 'Origo' || updatedRow.empresa === 'BC') {
              comissaoImediata = updatedRow.proposta * 0.50;
          } else if (updatedRow.empresa === 'Fit Energia') {
              comissaoImediata = updatedRow.proposta * 0.40;
          }
          updatedRow.comissaoImediata = comissaoImediata;


          let segundaComissao = 0;
          if (updatedRow.empresa === 'BC') {
              segundaComissao = updatedRow.proposta * 0.45;
              updatedRow.segundaComissaoPerc = 45;
          } else if (updatedRow.empresa === 'Origo') {
              segundaComissao = updatedRow.proposta * (updatedRow.segundaComissaoPerc / 100);
          } else if (updatedRow.empresa === 'Fit Energia') {
              segundaComissao = updatedRow.proposta * 0.60;
              updatedRow.segundaComissaoPerc = 0;
          } else {
              updatedRow.segundaComissaoPerc = 0;
          }
          updatedRow.segundaComissao = segundaComissao;


          let terceiraComissao = 0;
          if (updatedRow.empresa === 'BC') {
              terceiraComissao = updatedRow.proposta * 0.60;
              updatedRow.terceiraComissaoPerc = 60;
          } else if (updatedRow.empresa === 'Origo') {
             terceiraComissao = updatedRow.proposta * (updatedRow.terceiraComissaoPerc / 100);
          } else {
              updatedRow.terceiraComissaoPerc = 0;
          }
          updatedRow.terceiraComissao = terceiraComissao;

          const financials = calculateFinancials(updatedRow);
          return { ...updatedRow, ...financials };
        }
        return row;
      })
    );
  };
    
  const getStageBadgeStyle = (stageId: string) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  const totalPages = Math.ceil(tableData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = tableData.slice(startIndex, endIndex);

  const promotersWithLeads = useMemo(() => {
    const promoters = new Set<string>();
    tableData.forEach(row => promoters.add(row.promotor));
    return Array.from(promoters).sort();
  }, [tableData]);

  const totalRecorrenciaEmCaixa = useMemo(() => {
    return tableData
      .filter(row => {
          const sellerNameLower = (row.promotor || '').toLowerCase();
          const isExcluded = sellerNameLower.includes('eduardo') || sellerNameLower.includes('diogo');
          const companyMatch = recurrenceCompanyFilter === 'all' || row.empresa === recurrenceCompanyFilter;
          const promoterMatch = recurrencePromoterFilter === 'all' || row.promotor === recurrencePromoterFilter;
          let dateMatch = true;
          if (recurrenceDateFilter?.from && row.completedAt) {
              const completedDate = parseISO(row.completedAt);
              dateMatch = isWithinInterval(completedDate, {
                  start: recurrenceDateFilter.from,
                  end: recurrenceDateFilter.to || recurrenceDateFilter.from
              });
          }
          
          return row.recorrenciaPaga && row.financialStatus === 'Adimplente' && !isExcluded && companyMatch && promoterMatch && dateMatch;
      })
      .reduce((sum, row) => sum + row.recorrenciaComissao, 0);
  }, [tableData, recurrenceCompanyFilter, recurrencePromoterFilter, recurrenceDateFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comissões por Empresas</CardTitle>
        <div className="flex flex-col md:flex-row gap-4 justify-between">
            <CardDescription>
            Visão detalhada das propostas de energia e pagamentos de comissões associados (baseado em leads a partir do estágio 'Contrato').
            <br />
            <span className="font-semibold text-primary">KWh Finalizados no Mês: {totalKwhFinalizadoNoMes.toLocaleString('pt-BR')} kWh</span>
            </CardDescription>
            <Card className="p-3 bg-green-500/10 border-green-500/50">
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <p className="text-sm font-medium text-green-600">Total de Recorrência em Caixa</p>
                        <p className="text-2xl font-bold text-green-500">{formatCurrency(totalRecorrenciaEmCaixa)}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={recurrenceCompanyFilter} onValueChange={setRecurrenceCompanyFilter}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Empresa" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todas as Empresas</SelectItem>{EMPRESA_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={recurrencePromoterFilter} onValueChange={setRecurrencePromoterFilter}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Promotor" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos os Promotores</SelectItem>{promotersWithLeads.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn("h-8 w-full sm:w-[240px] justify-start text-left font-normal text-xs", !recurrenceDateFilter && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {recurrenceDateFilter?.from ? (
                                    recurrenceDateFilter.to ? (
                                        <>{format(recurrenceDateFilter.from, "LLL dd, y")} - {format(recurrenceDateFilter.to, "LLL dd, y")}</>
                                    ) : (format(recurrenceDateFilter.from, "LLL dd, y"))
                                ) : ( <span>Filtrar por Data</span> )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={recurrenceDateFilter?.from} selected={recurrenceDateFilter} onSelect={setRecurrenceDateFilter} numberOfMonths={2}/>
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRecurrenceCompanyFilter('all'); setRecurrencePromoterFilter('all'); setRecurrenceDateFilter(undefined); }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </Card>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
            <TableCaption>Esta tabela fornece uma visão abrangente das propostas e comissões.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Promotor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Kwh</TableHead>
                <TableHead>Proposta (R$)</TableHead>
                <TableHead>Deságio (%)</TableHead>
                <TableHead>Comissão Imediata (R$)</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>2ª Comissão</TableHead>
                <TableHead>Data.1</TableHead>
                <TableHead>3ª Comissão</TableHead>
                <TableHead>Data.2</TableHead>
                <TableHead>4ª Comissão (R$)</TableHead>
                <TableHead>Data.3</TableHead>
                <TableHead>Comissão Total (R$)</TableHead>
                <TableHead>Comissão Promotor (R$)</TableHead>
                <TableHead>Lucro Bruto (R$)</TableHead>
                <TableHead>Lucro Líquido (R$)</TableHead>
                <TableHead>Juros (%)</TableHead>
                <TableHead>Juros (R$)</TableHead>
                <TableHead>Garantia Churn (R$)</TableHead>
                <TableHead>Comercializador (R$)</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Data.4</TableHead>
                <TableHead>Recorrência Comissão (R$)</TableHead>
                <TableHead>Recorrência Paga?</TableHead>
                <TableHead>Status Financeiro</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedData.length > 0 ? paginatedData.map((row) => (
                <TableRow key={row.id}>
                    <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.promotor}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell><Badge className={getStageBadgeStyle(row.status as any)}>{STAGES_CONFIG.find(s => s.id === row.status)?.title || row.status}</Badge></TableCell>
                    <TableCell>
                        <Select
                            defaultValue={EMPRESA_OPTIONS.includes(row.empresa) ? row.empresa : undefined}
                            onValueChange={(value) => updateRowData(row.id, { empresa: value })}
                        >
                            <SelectTrigger className="w-[120px] h-8">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {EMPRESA_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell>{row.kwh.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{formatCurrency(row.proposta)}</TableCell>
                    <TableCell className="w-[100px]">
                        <Input 
                            type="number"
                            value={row.desagil}
                            onChange={(e) => updateRowData(row.id, { desagil: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-right bg-yellow-100 dark:bg-yellow-900/50"
                        />
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(row.comissaoImediata)}</TableCell>
                    <TableCell>{row.dataComissaoImediata}</TableCell>
                    <TableCell className="w-[150px]">
                        {row.empresa === 'BC' && formatCurrency(row.segundaComissao)}
                        {row.empresa === 'Fit Energia' && formatCurrency(row.segundaComissao)}
                        {row.empresa === 'Origo' && (
                            <Select
                                value={String(row.segundaComissaoPerc)}
                                onValueChange={(value) => updateRowData(row.id, { segundaComissaoPerc: parseInt(value, 10) })}
                            >
                                <SelectTrigger className="w-full h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="120">120% ({formatCurrency(row.proposta * 1.2)})</SelectItem>
                                    <SelectItem value="150">150% ({formatCurrency(row.proposta * 1.5)})</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                         {(row.empresa !== 'BC' && row.empresa !== 'Origo' && row.empresa !== 'Fit Energia') && formatCurrency(row.segundaComissao)}
                    </TableCell>
                    <TableCell>{row.dataSegundaComissao}</TableCell>
                     <TableCell className="w-[150px]">
                        {row.empresa === 'BC' && formatCurrency(row.terceiraComissao)}
                        {row.empresa === 'Origo' && (
                            <Select
                                value={String(row.terceiraComissaoPerc)}
                                onValueChange={(value) => updateRowData(row.id, { terceiraComissaoPerc: parseInt(value, 10) })}
                            >
                                <SelectTrigger className="w-full h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30">30% ({formatCurrency(row.proposta * 0.3)})</SelectItem>
                                    <SelectItem value="50">50% ({formatCurrency(row.proposta * 0.5)})</SelectItem>
                                    <SelectItem value="70">70% ({formatCurrency(row.proposta * 0.7)})</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        {(row.empresa !== 'BC' && row.empresa !== 'Origo') && formatCurrency(row.terceiraComissao)}
                    </TableCell>
                    <TableCell>{row.dataTerceiraComissao}</TableCell>
                    <TableCell>{formatCurrency(row.quartaComissao)}</TableCell>
                    <TableCell>{row.dataQuartaComissao}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(row.comissaoTotal)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCurrency(row.comissaoPromotor)}</TableCell>
                    <TableCell className="font-semibold text-green-600">{formatCurrency(row.lucroBruto)}</TableCell>
                    <TableCell className="font-bold text-green-500">{formatCurrency(row.lucroLiq)}</TableCell>
                    <TableCell>{row.jurosPerc}</TableCell>
                    <TableCell>{formatCurrency(row.jurosRS)}</TableCell>
                    <TableCell>{formatCurrency(row.garantiaChurn)}</TableCell>
                    <TableCell>{formatCurrency(row.comercializador)}</TableCell>
                    <TableCell>{formatCurrency(row.nota)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 w-[200px]">
                        <Checkbox
                          id={`recorrencia-${row.id}`}
                          checked={row.recorrenciaAtiva}
                          onCheckedChange={(checked) => updateRowData(row.id, { recorrenciaAtiva: !!checked })}
                        />
                        {row.recorrenciaAtiva ? (
                           <Input
                              type="number"
                              value={row.recorrenciaPerc}
                              onChange={(e) => updateRowData(row.id, { recorrenciaPerc: parseFloat(e.target.value) || 0 })}
                              className="h-8 w-20 text-right"
                              placeholder="%"
                            />
                        ) : (
                          <div className="w-20"></div>
                        )}
                        <span>{formatCurrency(row.recorrenciaComissao)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <Checkbox
                          id={`recorrencia-paga-${row.id}`}
                          checked={row.recorrenciaPaga}
                          onCheckedChange={(checked) => updateRowData(row.id, { recorrenciaPaga: !!checked })}
                        />
                    </TableCell>
                    <TableCell>
                        <Select
                            value={row.financialStatus}
                            onValueChange={(value) => updateRowData(row.id, { financialStatus: value as TableRowData['financialStatus'] })}
                        >
                            <SelectTrigger className={cn("w-[150px] h-8", getFinancialStatusBadgeStyle(row.financialStatus))}>
                                <SelectValue placeholder="Definir" />
                            </SelectTrigger>
                            <SelectContent>
                                {FINANCIAL_STATUS_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center">
                                            {option.value === 'Nunca pagou' && <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />}
                                            {option.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TableCell>
                </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={28} className="h-24 text-center">Nenhum lead finalizado encontrado para exibir.</TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
       <CardFooter className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          {tableData.length} propostas encontradas.
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Linhas por página</p>
                <Select
                    value={`${rowsPerPage}`}
                    onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                    }}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={String(rowsPerPage)} />
                    </SelectTrigger>
                    <SelectContent side="top">
                    {[10, 25, 50, 100].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
          <div className="text-sm font-medium">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
