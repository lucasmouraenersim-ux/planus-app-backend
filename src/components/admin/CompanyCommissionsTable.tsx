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
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays, addMonths, subMonths, format as formatDateFns, nextFriday, setDate as setDateFn } from 'date-fns';
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
  dataComissaoImediata: Date;
  segundaComissao: number;
  dataSegundaComissao: Date;
  terceiraComissao: number;
  dataTerceiraComissao: Date;
  quartaComissao: number;
  dataQuartaComissao: Date;
  comissaoTotalBruta: number; 
  comissaoPromotor: number;
  lucroBrutoEmpresa: number; 
  lucroLiquidoEmpresa: number; 
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
  
  const [commissionCompanyFilter, setCommissionCompanyFilter] = useState('all');
  const [commissionPromoterFilter, setCommissionPromoterFilter] = useState('all');
  
  const [recurrenceCompanyFilter, setRecurrenceCompanyFilter] = useState('all');
  const [recurrencePromoterFilter, setRecurrencePromoterFilter] = useState('all');
  const [selectedRecurrenceMonth, setSelectedRecurrenceMonth] = useState(new Date());

  const [isImportRecurrenceModalOpen, setIsImportRecurrenceModalOpen] = useState(false);
  const [isUploadingRecurrence, setIsUploadingRecurrence] = useState(false);
  
  const [receivableDates, setReceivableDates] = useState<Record<string, { immediate?: string; second?: string; third?: string }>>({});

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
  
  const calculateFinancials = useCallback((rowData: Omit<TableRowData, 'comissaoTotalBruta' | 'lucroBrutoEmpresa' | 'lucroLiquidoEmpresa' | 'garantiaChurn' | 'comercializador' | 'nota' | 'jurosRS' | 'jurosPerc' | 'recorrenciaComissao'>) => {
    const comissaoTotalBruta = rowData.comissaoImediata + rowData.segundaComissao + rowData.terceiraComissao + rowData.quartaComissao;
    const lucroBrutoEmpresa = comissaoTotalBruta - rowData.comissaoPromotor;
    
    let garantiaChurn = 0;
    let comercializador = 0;
    let nota = 0;

    if (rowData.empresa !== 'Fit Energia') {
        garantiaChurn = comissaoTotalBruta * 0.10;
        comercializador = comissaoTotalBruta * 0.10;
        nota = comissaoTotalBruta * 0.12;
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

    const lucroLiquidoEmpresa = lucroBrutoEmpresa - garantiaChurn - comercializador - nota - jurosRS;

    return {
      comissaoTotalBruta,
      lucroBrutoEmpresa,
      lucroLiquidoEmpresa,
      garantiaChurn,
      comercializador,
      nota,
      jurosRS: jurosRS,
      jurosPerc: jurosPerc,
      recorrenciaComissao,
    };
  }, []);

  useEffect(() => {
    const stagesToInclude: StageId[] = ['contrato', 'conformidade', 'assinado', 'finalizado'];
    const leadsForCommission = leads.filter(lead => stagesToInclude.includes(lead.stageId));

    const initialData = leadsForCommission.map(lead => {
        const baseDate = parseISO(lead.completedAt || lead.signedAt || lead.createdAt);
        const desagilInitial = lead.discountPercentage || 0;
        const proposta = lead.valueAfterDiscount || 0;
        const empresa = EMPRESA_OPTIONS.includes(lead.empresa || '') ? lead.empresa! : 'Bowe';
        const promotorId = lead.userId;

        const sellerNameLower = (lead.sellerName || '').toLowerCase();
        const isExcludedFromRecurrence = sellerNameLower.includes('eduardo') || sellerNameLower.includes('diogo');
        let recorrenciaAtivaInitial = !isExcludedFromRecurrence;
        
        let recorrenciaPercInitial = 0;
        if (empresa === 'Fit Energia') {
          recorrenciaAtivaInitial = desagilInitial < 25 && !isExcludedFromRecurrence;
          if (recorrenciaAtivaInitial) {
            recorrenciaPercInitial = 25 - desagilInitial;
          }
        } else if (empresa === 'Bowe') {
           recorrenciaPercInitial = !isExcludedFromRecurrence ? 1 : 0;
        }

        const comissaoPromotorInitial = calculateCommission(proposta, desagilInitial, promotorId);
        
        const customDates = receivableDates[lead.id] || {};

        let comissaoImediata = 0;
        let dataComissaoImediata = customDates.immediate ? parseISO(customDates.immediate) : nextFriday(baseDate);
        if (empresa === 'Bowe' || empresa === 'Matrix') comissaoImediata = proposta * 0.60;
        else if (empresa === 'Origo' || empresa === 'BC') comissaoImediata = proposta * 0.50;
        else if (empresa === 'Fit Energia') comissaoImediata = 0;

        let segundaComissao = 0;
        let segundaComissaoPerc = 35;
        let dataSegundaComissao = customDates.second ? parseISO(customDates.second) : setDateFn(addMonths(baseDate, 1), 20); // Default for BC
        if (empresa === 'BC') segundaComissao = proposta * 0.35;
        else if (empresa === 'Origo') {
            segundaComissaoPerc = 100;
            segundaComissao = proposta * (segundaComissaoPerc / 100);
            dataSegundaComissao = customDates.second ? parseISO(customDates.second) : setDateFn(addMonths(baseDate, 2), 15);
        } else if (empresa === 'Fit Energia') {
          segundaComissao = proposta * 0.40;
          dataSegundaComissao = customDates.second ? parseISO(customDates.second) : setDateFn(addMonths(baseDate, 1), 15);
        }

        let terceiraComissao = 0;
        let terceiraComissaoPerc = 60;
        let dataTerceiraComissao = customDates.third ? parseISO(customDates.third) : addMonths(baseDate, 4);
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
            dataComissaoImediata: dataComissaoImediata,
            segundaComissao: segundaComissao,
            dataSegundaComissao: dataSegundaComissao,
            terceiraComissao: terceiraComissao,
            dataTerceiraComissao: dataTerceiraComissao,
            quartaComissao: 0,
            dataQuartaComissao: new Date(),
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
  }, [leads, userMap, totalKwhFinalizadoNoMes, calculateFinancials, receivableDates]);

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
          
          const baseDate = parseISO(updatedRow.completedAt || new Date().toISOString());
          const empresa = updatedRow.empresa;
          const proposta = updatedRow.proposta;
          const desagil = updatedRow.desagil;

          const sellerNameLower = (updatedRow.promotor || '').toLowerCase();
          const isExcludedFromRecurrence = sellerNameLower.includes('eduardo') || sellerNameLower.includes('diogo');
          updatedRow.recorrenciaAtiva = !isExcludedFromRecurrence;
          
          if (empresa === 'Fit Energia') {
            updatedRow.recorrenciaAtiva = desagil < 25 && !isExcludedFromRecurrence;
            updatedRow.recorrenciaPerc = updatedRow.recorrenciaAtiva ? 25 - desagil : 0;
          } else if (empresa === 'Bowe') {
             updatedRow.recorrenciaPerc = !isExcludedFromRecurrence ? 1 : 0;
          }

          updatedRow.comissaoPromotor = calculateCommission(proposta, desagil, updatedRow.promotorId);

          if (empresa === 'Bowe' || empresa === 'Matrix') updatedRow.comissaoImediata = proposta * 0.60;
          else if (empresa === 'Origo' || empresa === 'BC') updatedRow.comissaoImediata = proposta * 0.50;
          else if (empresa === 'Fit Energia') updatedRow.comissaoImediata = 0;
          updatedRow.dataComissaoImediata = nextFriday(baseDate);

          if (empresa === 'BC') {
              updatedRow.segundaComissao = proposta * 0.35;
              updatedRow.dataSegundaComissao = setDateFn(addMonths(baseDate, 1), 20);
          } else if (empresa === 'Origo') {
              updatedRow.segundaComissao = proposta;
              updatedRow.dataSegundaComissao = setDateFn(addMonths(baseDate, 2), 15);
          } else if (empresa === 'Fit Energia') {
              updatedRow.segundaComissao = proposta * 0.40;
              updatedRow.dataSegundaComissao = setDateFn(addMonths(baseDate, 1), 15);
          } else {
              updatedRow.segundaComissao = 0;
          }
          
          if (empresa === 'BC') {
              updatedRow.terceiraComissao = proposta * 0.60;
          } else if (empresa === 'Origo') {
            let perc = 0;
            if (totalKwhFinalizadoNoMes >= 30000 && totalKwhFinalizadoNoMes <= 40000) perc = 30;
            else if (totalKwhFinalizadoNoMes > 40000) perc = 50;
            else perc = 0;
            updatedRow.terceiraComissao = proposta * (perc / 100);
          } else if (empresa === 'Fit Energia') {
              updatedRow.terceiraComissao = proposta * 0.60;
          } else {
              updatedRow.terceiraComissao = 0;
          }
          updatedRow.dataTerceiraComissao = addMonths(baseDate, 4);

          const financials = calculateFinancials(updatedRow as any);
          return { ...updatedRow, ...financials };
        }
        return row;
      })
    );
  };

  const handleReceivableDateChange = (leadId: string, commissionType: 'immediate' | 'second' | 'third', newDate?: Date) => {
    if (!newDate) return;
    setReceivableDates(prev => ({
      ...prev,
      [leadId]: { ...prev[leadId], [commissionType]: newDate.toISOString() }
    }));
  };
    
  const getStageBadgeStyle = (stageId: string) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };
  
  const filteredCommissionData = useMemo(() => {
    return tableData.filter(row => {
      const companyMatch = commissionCompanyFilter === 'all' || row.empresa === commissionCompanyFilter;
      const promoterMatch = commissionPromoterFilter === 'all' || row.promotor === commissionPromoterFilter;
      return companyMatch && promoterMatch;
    });
  }, [tableData, commissionCompanyFilter, commissionPromoterFilter]);
  
  const promotersWithLeads = useMemo(() => {
    const promoters = new Set<string>();
    tableData.forEach(row => promoters.add(row.promotor));
    return Array.from(promoters).sort();
  }, [tableData]);

  const totalPages = Math.ceil(filteredCommissionData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = filteredCommissionData.slice(startIndex, endIndex);

  const filteredRecurrenceData = useMemo(() => {
    const monthStart = startOfMonth(selectedRecurrenceMonth);
    const monthEnd = endOfMonth(selectedRecurrenceMonth);
    
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
                    if (monthStart < recurrenceStartDate) {
                        dateMatch = false;
                    }
                } else {
                    dateMatch = false;
                }
            } catch { dateMatch = false; }
        } else {
            dateMatch = false;
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
              <div className="flex flex-col md:flex-row gap-2 mb-4">
                  <Select value={commissionCompanyFilter} onValueChange={setCommissionCompanyFilter}>
                      <SelectTrigger className="h-8 text-xs w-full md:w-[180px]"><SelectValue placeholder="Filtrar por Empresa" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todas as Empresas</SelectItem>{[...new Set(tableData.map(r => r.empresa))].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={commissionPromoterFilter} onValueChange={setCommissionPromoterFilter}>
                      <SelectTrigger className="h-8 text-xs w-full md:w-[180px]"><SelectValue placeholder="Filtrar por Promotor" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os Promotores</SelectItem>{promotersWithLeads.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
              </div>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableCaption>Esta tabela fornece uma visão abrangente das propostas e comissões.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">Promotor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>kWh</TableHead>
                      <TableHead>Proposta (R$)</TableHead>
                      <TableHead>Deságio (%)</TableHead>
                      <TableHead>Comissão Total Bruta (R$)</TableHead>
                      <TableHead>Lucro Líquido (R$)</TableHead>
                      <TableHead>1ª Com. (R$)</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>2ª Com. (R$)</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>3ª Com. (R$)</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Juros (R$)</TableHead>
                      <TableHead>Garantia Churn</TableHead>
                      <TableHead>Comercializador</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paginatedData.length > 0 ? paginatedData.map((row) => (
                      <TableRow key={row.id}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.promotor}</TableCell>
                          <TableCell>{row.cliente}</TableCell>
                          <TableCell>
                            <Select value={row.empresa} onValueChange={(value) => updateRowData(row.id, { empresa: value })}>
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="Empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EMPRESA_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{row.kwh.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{formatCurrency(row.proposta)}</TableCell>
                          <TableCell className='w-[100px]'>
                              <Input
                                type="number"
                                value={row.desagil.toFixed(2)}
                                onChange={(e) => updateRowData(row.id, { desagil: parseFloat(e.target.value) || 0 })}
                                className="h-8 text-xs bg-muted/50"
                              />
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(row.comissaoTotalBruta)}</TableCell>
                          <TableCell className="font-bold text-green-500">{formatCurrency(row.lucroLiquidoEmpresa)}</TableCell>
                          <TableCell>{formatCurrency(row.comissaoImediata)}</TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8">{formatDateFns(row.dataComissaoImediata, 'dd/MM/yy')}</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={row.dataComissaoImediata} onSelect={(date) => handleReceivableDateChange(row.id, 'immediate', date)} initialFocus />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>{formatCurrency(row.segundaComissao)}</TableCell>
                          <TableCell>{formatDateFns(row.dataSegundaComissao, 'dd/MM/yy')}</TableCell>
                          <TableCell>{formatCurrency(row.terceiraComissao)}</TableCell>
                          <TableCell>{formatDateFns(row.dataTerceiraComissao, 'dd/MM/yy')}</TableCell>
                          <TableCell>{formatCurrency(row.jurosRS)}</TableCell>
                          <TableCell>{formatCurrency(row.garantiaChurn)}</TableCell>
                          <TableCell>{formatCurrency(row.comercializador)}</TableCell>
                          <TableCell>{formatCurrency(row.nota)}</TableCell>
                      </TableRow>
                      )) : (
                          <TableRow>
                              <TableCell colSpan={18} className="h-24 text-center">Nenhum lead finalizado encontrado para exibir.</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">
                {filteredCommissionData.length} propostas encontradas.
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
                 <Button onClick={() => setIsImportRecurrenceModalOpen(true)} variant="outline" size="sm" className="h-8">
                    <Upload className="mr-2 h-4 w-4" />
                    Importar CSV de Recorrência
                </Button>
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
      
      <Dialog open={isImportRecurrenceModalOpen} onOpenChange={setIsImportRecurrenceModalOpen}>
        <DialogContent className="sm:max-w-md bg-card/70 backdrop-blur-lg border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">Importar Status de Recorrência</DialogTitle>
            <DialogDescription>
              Faça o upload de um arquivo CSV para atualizar o status de pagamento das recorrências. O arquivo deve conter colunas 'Cliente' ou 'Documento' e 'Parcelas pagas'.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportRecurrence} className="flex flex-col items-center gap-4 py-4">
              <Label htmlFor="recurrenceCsvFile" className="sr-only">Arquivo CSV</Label>
              <Input id="recurrenceCsvFile" name="csvFile" type="file" accept=".csv" className="flex-1 w-full" />
              <Button type="submit" disabled={isUploadingRecurrence} className="w-full">
                  {isUploadingRecurrence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar e Atualizar Status
              </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
