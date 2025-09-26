// src/components/admin/CompanyCommissionsTable.tsx
"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
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
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays, addMonths, subMonths, format as formatDateFns } from 'date-fns';
import { AlertTriangle, Calendar as CalendarIcon, X, Upload, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { updateCrmLeadDetails } from '@/lib/firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'; // Import Tabs
import { importRecurrenceStatusFromCSV } from '@/actions/admin/commissionActions';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { ptBR } from 'date-fns/locale';

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
  desagil: number;
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

  segundaComissaoPerc: number;
  terceiraComissaoPerc: number;
  financialStatus: 'none' | 'Adimplente' | 'Inadimplente' | 'Em atraso' | 'Nunca pagou' | 'Cancelou';
  completedAt: string | undefined;

  // Recurrence control
  dataReferenciaVenda?: string;
  parcelasEsperadas: number;
  paidRecurrenceMonths?: string[];
}

export default function CompanyCommissionsTable({ leads, allUsers }: CompanyCommissionsTableProps) {
  const { toast } = useToast();
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.uid, u])), [allUsers]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [recurrenceCompanyFilter, setRecurrenceCompanyFilter] = useState('all');
  const [recurrencePromoterFilter, setRecurrencePromoterFilter] = useState('all');
  const [recurrenceDateFilter, setRecurrenceDateFilter] = useState<DateRange | undefined>();
  const [isImportRecurrenceModalOpen, setIsImportRecurrenceModalOpen] = useState(false);
  const [isUploadingRecurrence, setIsUploadingRecurrence] = useState(false);
  const [selectedRecurrenceMonth, setSelectedRecurrenceMonth] = useState(new Date());


  const calculateCommission = (
    proposta: number, 
    desagilPercent: number, 
    promotorId?: string
  ): number => {
    const promotor = promotorId ? userMap.get(promotorId) : undefined;
    const baseCommissionRate = promotor?.commissionRate || 40; 
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
  
  const calculateFinancials = useCallback((rowData: Omit<TableRowData, 'comissaoTotal' | 'lucroBruto' | 'lucroLiq' | 'garantiaChurn' | 'comercializador' | 'nota' | 'jurosRS' | 'jurosPerc' | 'recorrenciaComissao'>) => {
    const comissaoTotal = rowData.comissaoImediata + rowData.segundaComissao + rowData.terceiraComissao + rowData.quartaComissao;
    const lucroBruto = comissaoTotal - rowData.comissaoPromotor;
    
    let garantiaChurn = 0;
    let comercializador = 0;
    let nota = 0;

    if (rowData.empresa !== 'Fit Energia') {
        garantiaChurn = comissaoTotal * 0.10;
        comercializador = comissaoTotal * 0.10;
        nota = comissaoTotal * 0.12;
    }

    let jurosRS = 0;
    let jurosPerc = "0%";
    if (rowData.empresa === 'BC') {
        jurosRS = rowData.comissaoImediata * 0.12;
        jurosPerc = "12%";
    } else if (rowData.empresa === 'Origo') {
        jurosRS = rowData.comissaoImediata * 0.17;
        jurosPerc = "17%";
    }
    
    let recorrenciaComissao = 0;
    if (rowData.empresa === 'Fit Energia' && rowData.recorrenciaAtiva && rowData.desagil < 25) {
        recorrenciaComissao = rowData.proposta * ((25 - rowData.desagil) / 100);
    } else if (rowData.empresa === 'Bowe' && rowData.recorrenciaAtiva) {
        recorrenciaComissao = rowData.proposta * (rowData.recorrenciaPerc / 100);
    }

    const lucroLiq = lucroBruto - garantiaChurn - comercializador - nota - jurosRS;

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
  }, []);

  // Initialize table data
  useEffect(() => {
    const stagesToInclude: StageId[] = ['contrato', 'conformidade', 'assinado', 'finalizado'];
    const leadsForCommission = leads.filter(lead => stagesToInclude.includes(lead.stageId));

    const initialData = leadsForCommission.map(lead => {
        const desagilInitial = lead.discountPercentage || 0;
        const proposta = lead.valueAfterDiscount || 0;
        const empresa = EMPRESA_OPTIONS.includes(lead.empresa || '') ? lead.empresa : 'Bowe';
        const promotorId = lead.userId;

        const sellerNameLower = (lead.sellerName || '').toLowerCase();
        const isExcludedFromRecurrence = sellerNameLower.includes('eduardo') || sellerNameLower.includes('diogo');
        let recorrenciaAtivaInitial = !isExcludedFromRecurrence;
        
        let recorrenciaPercInitial = 0;
        if (empresa === 'Fit Energia') {
          recorrenciaAtivaInitial = desagilInitial < 25;
          if (recorrenciaAtivaInitial) {
            recorrenciaPercInitial = 25 - desagilInitial;
          }
        } else if (empresa === 'Bowe') {
           recorrenciaPercInitial = !isExcludedFromRecurrence ? 1 : 0;
        }

        const comissaoPromotorInitial = calculateCommission(proposta, desagilInitial, promotorId);

        let comissaoImediata = 0;
        if (empresa === 'Bowe' || empresa === 'Matrix') comissaoImediata = proposta * 0.60;
        else if (empresa === 'Origo' || empresa === 'BC') comissaoImediata = proposta * 0.50;
        else if (empresa === 'Fit Energia') comissaoImediata = 0;

        let segundaComissao = 0;
        let segundaComissaoPerc = 35; 
        if (empresa === 'BC') segundaComissao = proposta * 0.35;
        else if (empresa === 'Origo') {
            segundaComissaoPerc = 100;
            segundaComissao = proposta * (segundaComissaoPerc / 100);
        } else if (empresa === 'Fit Energia') segundaComissao = proposta * 0.40;

        let terceiraComissao = 0;
        let terceiraComissaoPerc = 60;
        if (empresa === 'BC') terceiraComissao = proposta * 0.60;
        else if (empresa === 'Origo') {
            if (totalKwhFinalizadoNoMes >= 30000 && totalKwhFinalizadoNoMes <= 40000) terceiraComissaoPerc = 30;
            else if (totalKwhFinalizadoNoMes > 40000) terceiraComissaoPerc = 50;
            else terceiraComissaoPerc = 0;
            terceiraComissao = proposta * (terceiraComissaoPerc / 100);
        } else if (empresa === 'Fit Energia') terceiraComissao = proposta * 0.60;
        
        let recorrenciaPagaInitial = lead.recorrenciaPaga || false;
        let financialStatusInitial: TableRowData['financialStatus'] = lead.financialStatus || 'none';
        
        let parcelasEsperadas = 0;
        if (lead.saleReferenceDate) {
            try {
                const [mes, ano] = lead.saleReferenceDate.split('/').map(Number);
                if (mes && ano) {
                    const dataInicioRecorrencia = addMonths(new Date(ano, mes - 1, 1), 4);
                    const hoje = new Date();
                    if (hoje > dataInicioRecorrencia) {
                        parcelasEsperadas = (hoje.getFullYear() - dataInicioRecorrencia.getFullYear()) * 12 + hoje.getMonth() - dataInicioRecorrencia.getMonth() + 1;
                    }
                }
            } catch (e) { console.error("Error parsing saleReferenceDate", e); }
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
            completedAt: lead.completedAt,
            dataReferenciaVenda: lead.saleReferenceDate,
            parcelasEsperadas,
            paidRecurrenceMonths: lead.paidRecurrenceMonths || [],
        };
        
        const financials = calculateFinancials(partialRow as any);

        return { ...partialRow, ...financials };
    });
    setTableData(initialData);
  }, [leads, userMap, totalKwhFinalizadoNoMes, calculateFinancials]);

  const updateRowData = (leadId: string, updates: Partial<TableRowData>) => {
    const firestoreUpdates: Partial<LeadWithId> = {};
    if (updates.empresa !== undefined) firestoreUpdates.empresa = updates.empresa;
    if (updates.desagil !== undefined) firestoreUpdates.discountPercentage = updates.desagil;
    if (updates.recorrenciaPaga !== undefined) firestoreUpdates.recorrenciaPaga = updates.recorrenciaPaga;
    if (updates.financialStatus !== undefined) firestoreUpdates.financialStatus = updates.financialStatus;
    if (updates.paidRecurrenceMonths !== undefined) firestoreUpdates.paidRecurrenceMonths = updates.paidRecurrenceMonths;

    if (Object.keys(firestoreUpdates).length > 0) {
        updateCrmLeadDetails(leadId, firestoreUpdates);
    }
    
    setTableData(currentData =>
      currentData.map(row => {
        if (row.id === leadId) {
          let updatedRow: TableRowData = { ...row, ...updates };
          const comissaoPromotor = calculateCommission(updatedRow.proposta, updatedRow.desagil, updatedRow.promotorId);
          updatedRow.comissaoPromotor = comissaoPromotor;
          // ... (rest of the recalculation logic) ...
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

  const filteredRecurrenceData = useMemo(() => {
    const monthStart = startOfMonth(selectedRecurrenceMonth);
    const monthEnd = endOfMonth(selectedRecurrenceMonth);
    const selectedMonthKey = format(selectedRecurrenceMonth, 'yyyy-MM');

    return tableData.filter(row => {
        const isRelevantCompany = ['Fit Energia', 'Bowe'].includes(row.empresa);
        if (!isRelevantCompany || row.recorrenciaComissao <= 0) return false;
        
        const companyMatch = recurrenceCompanyFilter === 'all' || row.empresa === recurrenceCompanyFilter;
        const promoterMatch = recurrencePromoterFilter === 'all' || row.promotor === recurrencePromoterFilter;
        
        let dateMatch = true;
        if (row.dataReferenciaVenda) {
            try {
                const [mes, ano] = row.dataReferenciaVenda.split('/').map(Number);
                if(mes && ano) {
                    const recurrenceStartDate = addMonths(new Date(ano, mes - 1, 1), 4);
                    // Check if the selected month is on or after the recurrence start date
                    if (monthStart < recurrenceStartDate) {
                        dateMatch = false;
                    }
                } else {
                    dateMatch = false; // Invalid date format
                }
            } catch { dateMatch = false; }
        } else {
            dateMatch = false; // No reference date
        }

        return companyMatch && promoterMatch && dateMatch;
    });
  }, [tableData, recurrenceCompanyFilter, recurrencePromoterFilter, selectedRecurrenceMonth]);

  const handleToggleRecurrencePayment = (leadId: string, monthKey: string) => {
      const row = tableData.find(r => r.id === leadId);
      if (!row) return;

      const currentPaidMonths = new Set(row.paidRecurrenceMonths || []);
      if (currentPaidMonths.has(monthKey)) {
          currentPaidMonths.delete(monthKey);
      } else {
          currentPaidMonths.add(monthKey);
      }
      updateRowData(leadId, { paidRecurrenceMonths: Array.from(currentPaidMonths) });
  };


  const totalRecorrenciaEmCaixa = useMemo(() => {
      return filteredRecurrenceData.reduce((sum, row) => sum + row.recorrenciaComissao, 0);
  }, [filteredRecurrenceData]);

  const handleImportRecurrence = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fileInput = event.currentTarget.elements.namedItem('csvFile') as HTMLInputElement;

    if (!fileInput?.files?.length) {
      toast({ title: "Nenhum arquivo", description: "Por favor, selecione um arquivo CSV.", variant: "destructive" });
      return;
    }
    setIsUploadingRecurrence(true);
    const result = await importRecurrenceStatusFromCSV(formData);
    toast({
      title: result.success ? "Importação Concluída" : "Erro na Importação",
      description: result.message,
      variant: result.success ? "default" : "destructive"
    });
    if (result.success) {
      setIsImportRecurrenceModalOpen(false);
    }
    setIsUploadingRecurrence(false);
  };

  return (
    <>
      <Card>
        <Tabs defaultValue="commissions">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Comissões e Recorrências</CardTitle>
                <CardDescription>
                  Visão detalhada das propostas de energia e pagamentos de comissões associados.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <TabsList>
                    <TabsTrigger value="commissions">Controle de Caixa</TabsTrigger>
                    <TabsTrigger value="recurrence">Recorrências a Receber</TabsTrigger>
                  </TabsList>
              </div>
            </div>
          </CardHeader>

          <TabsContent value="commissions">
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableCaption>Esta tabela fornece uma visão abrangente das propostas e comissões.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">Promotor</TableHead>
                      <TableHead>Cliente</TableHead>
                      {/* Simplified for brevity */}
                      <TableHead>Empresa</TableHead>
                      <TableHead>Proposta (R$)</TableHead>
                      <TableHead>Comissão Total (R$)</TableHead>
                      <TableHead>Lucro Líquido (R$)</TableHead>
                      <TableHead>Status Financeiro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paginatedData.length > 0 ? paginatedData.map((row) => (
                      <TableRow key={row.id}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.promotor}</TableCell>
                          <TableCell>{row.cliente}</TableCell>
                          <TableCell>{row.empresa}</TableCell>
                          <TableCell>{formatCurrency(row.proposta)}</TableCell>
                          <TableCell className="font-bold">{formatCurrency(row.comissaoTotal)}</TableCell>
                          <TableCell className="font-bold text-green-500">{formatCurrency(row.lucroLiq)}</TableCell>
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
                              <TableCell colSpan={7} className="h-24 text-center">Nenhum lead finalizado encontrado para exibir.</TableCell>
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
                      <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={String(rowsPerPage)} /></SelectTrigger>
                      <SelectContent side="top">
                      {[10, 25, 50, 100].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
                </div>
                <div className="text-sm font-medium">Página {currentPage} de {totalPages}</div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>Anterior</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Próximo</Button>
                </div>
              </div>
            </CardFooter>
          </TabsContent>

          <TabsContent value="recurrence">
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between gap-4 mb-4 p-4 border rounded-lg bg-muted/30">
                 <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => setSelectedRecurrenceMonth(subMonths(selectedRecurrenceMonth, 1))}>
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                    <h3 className="text-xl font-semibold text-center text-primary capitalize">
                        {formatDateFns(selectedRecurrenceMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                    </h3>
                    <Button variant="outline" size="icon" onClick={() => setSelectedRecurrenceMonth(addMonths(selectedRecurrenceMonth, 1))}>
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Select value={recurrenceCompanyFilter} onValueChange={setRecurrenceCompanyFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Empresa" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todas as Empresas</SelectItem>{['Fit Energia', 'Bowe'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={recurrencePromoterFilter} onValueChange={setRecurrencePromoterFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Promotor" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os Promotores</SelectItem>{promotersWithLeads.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/50 text-center">
                    <p className="text-sm font-medium text-green-600">Total de Recorrência (Mês)</p>
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(totalRecorrenciaEmCaixa)}</p>
                </div>
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Comissão Recorrente</TableHead>
                      <TableHead>Parcelas Pagas</TableHead>
                      <TableHead>Parcelas Esperadas</TableHead>
                      <TableHead>Status Pagamento (Mês)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecurrenceData.length > 0 ? filteredRecurrenceData.map(row => {
                      const selectedMonthKey = format(selectedRecurrenceMonth, 'yyyy-MM');
                      const isPaidThisMonth = row.paidRecurrenceMonths?.includes(selectedMonthKey) ?? false;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{row.cliente}</TableCell>
                          <TableCell>{row.empresa}</TableCell>
                          <TableCell className="font-semibold text-green-500">{formatCurrency(row.recorrenciaComissao)}</TableCell>
                          <TableCell>{row.paidRecurrenceMonths?.length || 0}</TableCell>
                          <TableCell>{row.parcelasEsperadas}</TableCell>
                          <TableCell>
                            <Button
                                variant={isPaidThisMonth ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleToggleRecurrencePayment(row.id, selectedMonthKey)}
                                className={cn("h-8", isPaidThisMonth && "bg-green-100 dark:bg-green-900/50 border-green-500")}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !isPaidThisMonth && "opacity-0")} />
                                {isPaidThisMonth ? 'Pago' : 'Marcar como Pago'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    }) : (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma recorrência para este mês/filtro.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
