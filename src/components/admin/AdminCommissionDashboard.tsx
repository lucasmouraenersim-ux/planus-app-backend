// src/components/admin/AdminCommissionDashboard.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, addMonths, subMonths, nextFriday, setDate as setDateFn, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Papa from 'papaparse';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { STAGES_CONFIG } from '@/config/crm-stages';
import CompanyCommissionsTable from './CompanyCommissionsTable';
import { Textarea } from '../ui/textarea';


import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import type { LeadWithId, StageId } from '@/types/crm';
import type { WithdrawalRequestWithId, WithdrawalStatus } from '@/types/wallet';
import { USER_TYPE_FILTER_OPTIONS, USER_TYPE_ADD_OPTIONS, WITHDRAWAL_STATUSES_ADMIN } from '@/config/admin-config';
import { updateUser } from '@/lib/firebase/firestore';
import { createUser } from '@/actions/admin/createUser';
import { deleteUser } from '@/actions/admin/deleteUser';
import { syncLegacySellers } from '@/actions/admin/syncLegacySellers';
import { processOldWithdrawals } from '@/actions/admin/processOldWithdrawals';
import { useAuth } from '@/contexts/AuthContext'; 

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { 
    CalendarIcon, Filter, Users, UserPlus, DollarSign, Settings, RefreshCw, 
    ExternalLink, ShieldAlert, WalletCards, Activity, BarChartHorizontalBig, PieChartIcon, 
    Loader2, Search, Download, Edit2, Trash2, Eye, Rocket, UsersRound as CrmIcon, Percent, Network, Banknote, TrendingUp, ArrowRight, ClipboardList, Building, PiggyBank, Target as TargetIcon, Briefcase, PlusCircle, Pencil, Trash, LineChart, TrendingUp as TrendingUpIcon, Landmark
} from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const MOCK_WITHDRAWALS: WithdrawalRequestWithId[] = [
  { id: 'wd1', userId: 'user1', userEmail: 'vendedor1@example.com', userName: 'Vendedor Um', amount: 500, pixKeyType: 'CPF/CNPJ', pixKey: '111.111.111-11', status: 'pendente', requestedAt: new Date(Date.now() - 86400000).toISOString(), withdrawalType: 'personal' },
  { id: 'wd2', userId: 'user2', userEmail: 'vendedor2@example.com', userName: 'Vendedor Dois', amount: 200, pixKeyType: 'Email', pixKey: 'vendedor2@example.com', status: 'concluido', requestedAt: new Date(Date.now() - 86400000 * 2).toISOString(), processedAt: new Date(Date.now() - 86400000).toISOString(), withdrawalType: 'mlm', adminNotes: 'Pago.' },
];

const addUserFormSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  phone: z.string().optional(),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos.").max(14, "Formato de CPF inválido.").regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^\d{11}$/, "Formato de CPF inválido."),
  type: z.enum(USER_TYPE_ADD_OPTIONS.map(opt => opt.value) as [Exclude<UserType, 'pending_setup' | 'user'>, ...Exclude<UserType, 'pending_setup' | 'user'>[]], { required_error: "Tipo de usuário é obrigatório." }),
});
type AddUserFormData = z.infer<typeof addUserFormSchema>;

const editUserFormSchema = z.object({
  displayName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
  phone: z.string().optional(),
  type: z.enum(USER_TYPE_ADD_OPTIONS.map(opt => opt.value) as [Exclude<UserType, 'pending_setup' | 'user'>, ...Exclude<UserType, 'pending_setup' | 'user'>[]], { required_error: "Tipo de usuário é obrigatório." }),
  commissionRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number({ invalid_type_error: "Deve ser um número" }).min(0, "Deve ser no mínimo 0").max(100, "Não pode exceder 100").optional()
  ),
  mlmEnabled: z.boolean().default(false),
  uplineUid: z.string().optional(),
  recurrenceRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(String(val).replace(',', '.'))),
    z.number({ invalid_type_error: "Deve ser um número" }).min(0.5, "Deve ser no mínimo 0.5").max(5, "Não pode exceder 5").optional()
  ),
  canViewLeadPhoneNumber: z.boolean().default(false),
  canViewCrm: z.boolean().default(false),
  canViewCareerPlan: z.boolean().default(false),
  assignmentLimit: z.preprocess(
    (val) => (val === 'none' || val === '' || val === null || val === undefined ? 2 : Number(val)),
    z.number().int().optional()
  ),
});
type EditUserFormData = z.infer<typeof editUserFormSchema>;


const updateWithdrawalFormSchema = z.object({
  status: z.enum(WITHDRAWAL_STATUSES_ADMIN as [WithdrawalStatus, ...WithdrawalStatus[]], { required_error: "Status é obrigatório." }),
  adminNotes: z.string().optional(),
});
type UpdateWithdrawalFormData = z.infer<typeof updateWithdrawalFormSchema>;

interface AdminCommissionDashboardProps {
  loggedInUser: AppUser;
  initialUsers: FirestoreUser[];
  isLoadingUsersProp: boolean;
  onUsersChange: () => Promise<void>;
}

interface Employee {
  id: string;
  name: string;
  regime: 'CLT' | 'PJ';
  role: 'SDR' | 'Marketing' | 'Outro';
  salary: number;
  monthlyRevenueGenerated: number;
}

interface Receivable {
  leadId: string;
  clientName: string;
  company: string;
  finalizationDate: Date;
  immediateCommission: number;
  immediatePaymentDate: Date;
  secondCommission: number;
  secondPaymentDate: Date;
  isSecondPaymentDateEditable: boolean;
  thirdCommission: number;
  thirdPaymentDate: Date;
  isThirdPaymentDateEditable: boolean;
  // Cost fields for monthly dashboard
  jurosRS: number;
  garantiaChurn: number;
  comercializador: number;
  nota: number;
  // Recurrence
  recorrenciaPaga: boolean;
  recorrenciaComissao: number;
}

interface PersonalExpense {
  id: string;
  description: string;
  amount: number;
  type: 'Fixo' | 'Variavel';
  installments: number;
}

interface PersonalRevenue {
  id: string;
  description: string;
  amount: number;
  date: string;
}

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const duration = 800; // Animation duration in milliseconds

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;

    const animationFrame = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const nextValue = startValue + (value - startValue) * progress;
      
      setDisplayValue(nextValue);
      
      if (progress < 1) {
        requestAnimationFrame(animationFrame);
      }
    };
    requestAnimationFrame(animationFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{prefix}{displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}</>;
};


// New component for Company Management
function CompanyManagementTab({ leads, tableData }: { leads: LeadWithId[], tableData: any[] }) {
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const STORAGE_KEY = 'companyManagementSettings';
  const PAYROLL_STORAGE_KEY = 'companyPayroll';
  const RECEIVABLE_DATES_KEY = 'receivableDates';

  const [proLabore, setProLabore] = useState(25);
  const [tax, setTax] = useState(6);
  const [reinvest, setReinvest] = useState(15);
  const [riskFund, setRiskFund] = useState(10000);
  const [missionaryHelp, setMissionaryHelp] = useState(10);
  
  const [payroll, setPayroll] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', regime: 'CLT' as 'CLT' | 'PJ', role: 'SDR' as 'SDR' | 'Marketing' | 'Outro', salary: 0, monthlyRevenueGenerated: 0 });

  const [allReceivables, setAllReceivables] = useState<Receivable[]>([]);
  const [receivableDates, setReceivableDates] = useState<Record<string, { second?: string; third?: string }>>({});

  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // New states for filtering and pagination
  const [receivableCompanyFilter, setReceivableCompanyFilter] = useState('all');
  const [receivablePromoterFilter, setReceivablePromoterFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // State for the new monthly dashboard filter
  const [showMonthlyDashboard, setShowMonthlyDashboard] = useState(false);


  // Load from LocalStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setProLabore(parsed.proLabore || 25);
        setTax(parsed.tax || 6);
        setReinvest(parsed.reinvest || 15);
        setRiskFund(parsed.riskFund || 10000);
        setMissionaryHelp(parsed.missionaryHelp || 10);
      } catch (e) { console.error("Failed to parse company settings", e); }
    }
    const savedPayroll = localStorage.getItem(PAYROLL_STORAGE_KEY);
    if (savedPayroll) {
      try { setPayroll(JSON.parse(savedPayroll)); } 
      catch (e) { console.error("Failed to parse payroll", e); }
    }
    const savedDates = localStorage.getItem(RECEIVABLE_DATES_KEY);
    if (savedDates) {
      try { setReceivableDates(JSON.parse(savedDates)); }
      catch (e) { console.error("Failed to parse receivable dates", e); }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    const settings = { proLabore, tax, reinvest, riskFund, missionaryHelp };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [proLabore, tax, reinvest, riskFund, missionaryHelp]);

  useEffect(() => {
    localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(payroll));
  }, [payroll]);

  useEffect(() => {
    localStorage.setItem(RECEIVABLE_DATES_KEY, JSON.stringify(receivableDates));
  }, [receivableDates]);
  
  const monthlyRevenue = useMemo(() => {
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);

    return allReceivables.reduce((total, r) => {
      let monthTotal = 0;
      if (isWithinInterval(r.immediatePaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) monthTotal += r.immediateCommission;
      if (isWithinInterval(r.secondPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) monthTotal += r.secondCommission;
      if (isWithinInterval(r.thirdPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) monthTotal += r.thirdCommission;
      return total + monthTotal;
    }, 0);
  }, [allReceivables, selectedMonth]);


  // Calculate Receivables and Monthly Revenue
  useEffect(() => {
    const relevantStages: StageId[] = ['contrato', 'conformidade', 'assinado', 'finalizado'];
    const receivableLeads = leads.filter(l => relevantStages.includes(l.stageId));
    
    const calculatedReceivables: Receivable[] = receivableLeads.map(lead => {
      const baseDateStr = lead.completedAt || lead.signedAt || lead.createdAt;
      const finalizationDate = parseISO(baseDateStr);

      const proposta = lead.valueAfterDiscount || 0;
      const empresa = lead.empresa || 'Bowe';

      let immediateCommission = 0;
      let immediatePaymentDate = nextFriday(finalizationDate);
      
      let secondCommission = 0;
      let secondPaymentDate = new Date();
      let isSecondPaymentDateEditable = false;

      let thirdCommission = 0;
      let thirdPaymentDate = new Date();
      let isThirdPaymentDateEditable = false;

      // Fit Energia
      if (empresa === 'Fit Energia') {
        immediateCommission = 0; // Corrected
        secondCommission = proposta * 0.40;
        secondPaymentDate = setDateFn(addMonths(finalizationDate, 1), 15);
        thirdCommission = proposta * 0.60;
        thirdPaymentDate = addMonths(finalizationDate, 4);
        isThirdPaymentDateEditable = true;
      }
      // BC
      else if (empresa === 'BC') {
        immediateCommission = proposta * 0.50;
        secondCommission = proposta * 0.35; // Changed from 0.45
        secondPaymentDate = setDateFn(addMonths(finalizationDate, 1), 20);
        thirdCommission = proposta * 0.60;
        thirdPaymentDate = addMonths(finalizationDate, 4);
        isThirdPaymentDateEditable = true;
      }
      // Origo
      else if (empresa === 'Origo') {
        immediateCommission = proposta * 0.50;
        secondCommission = proposta;
        secondPaymentDate = setDateFn(addMonths(finalizationDate, 2), 15);
        thirdCommission = proposta * 0.50;
        thirdPaymentDate = addMonths(finalizationDate, 4);
        isThirdPaymentDateEditable = true;
      }
      // Bowe & Matrix
      else { 
        immediateCommission = proposta * 0.60;
      }
      
      const comissaoTotal = immediateCommission + secondCommission + thirdCommission;
      let jurosRS = 0;
      if (empresa === 'BC') { jurosRS = immediateCommission * 0.12; }
      else if (empresa === 'Origo') { jurosRS = immediateCommission * 0.17; }

      let garantiaChurn = 0;
      let comercializador = 0;
      let nota = 0;
      
      if (empresa !== 'Fit Energia') {
          garantiaChurn = comissaoTotal * 0.10;
          comercializador = comissaoTotal * 0.10;
          nota = comissaoTotal * 0.12;
      }
      
      const customDates = receivableDates[lead.id];
      if (customDates?.second) secondPaymentDate = parseISO(customDates.second);
      if (customDates?.third) thirdPaymentDate = parseISO(customDates.third);

      // From tableData
      const tData = tableData.find(t => t.id === lead.id);
      const recorrenciaPaga = tData ? tData.recorrenciaPaga : false;
      const recorrenciaComissao = tData ? tData.recorrenciaComissao : 0;

      return {
        leadId: lead.id, clientName: lead.name, company: empresa, finalizationDate,
        immediateCommission, immediatePaymentDate,
        secondCommission, secondPaymentDate, isSecondPaymentDateEditable,
        thirdCommission, thirdPaymentDate, isThirdPaymentDateEditable,
        jurosRS, garantiaChurn, comercializador, nota,
        recorrenciaPaga, recorrenciaComissao,
      };
    });

    setAllReceivables(calculatedReceivables.sort((a, b) => b.finalizationDate.getTime() - a.finalizationDate.getTime()));

  }, [leads, receivableDates, tableData]);
  
  const handleReceivableDateChange = (leadId: string, commissionType: 'second' | 'third', newDate?: Date) => {
    if (!newDate) return;
    setReceivableDates(prev => ({
      ...prev,
      [leadId]: { ...prev[leadId], [commissionType]: newDate.toISOString() }
    }));
  };

  const totalPayroll = useMemo(() => payroll.reduce((sum, emp) => sum + emp.salary, 0), [payroll]);
  const proLaboreValue = monthlyRevenue * (proLabore / 100);
  const taxValue = monthlyRevenue * (tax / 100);
  const reinvestValue = monthlyRevenue * (reinvest / 100);
  const missionaryHelpValue = monthlyRevenue * (missionaryHelp / 100);
  
  const handleAddEmployee = () => {
    if (!newEmployee.name || newEmployee.salary <= 0) { alert("Nome e salário são obrigatórios."); return; }
    setPayroll([...payroll, { ...newEmployee, id: Date.now().toString() }]);
    setNewEmployee({ name: '', regime: 'CLT', role: 'SDR', salary: 0, monthlyRevenueGenerated: 0 });
  };
  
  const handleRemoveEmployee = (id: string) => { setPayroll(payroll.filter(emp => emp.id !== id)); };
  
  const calculateTax = (employee: Employee) => employee.regime === 'CLT' ? employee.salary * 0.20 : 0;

  const calculateROI = (employee: Employee) => {
      const totalCost = employee.salary + calculateTax(employee);
      if (totalCost === 0) return 'N/A';
      const roi = ((employee.monthlyRevenueGenerated - totalCost) / totalCost) * 100;
      return `${roi.toFixed(2)}%`;
  };
  
  const filteredReceivables = useMemo(() => {
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);
  
    return allReceivables.filter(r => {
      const companyMatch = receivableCompanyFilter === 'all' || r.company === receivableCompanyFilter;
      const promoterMatch = receivablePromoterFilter === 'all' || leads.find(l => l.id === r.leadId)?.sellerName === receivablePromoterFilter;
  
      const immediatePaymentInMonth = isWithinInterval(r.immediatePaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth }) && r.immediateCommission > 0;
      const secondPaymentInMonth = isWithinInterval(r.secondPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth }) && r.secondCommission > 0;
      const thirdPaymentInMonth = isWithinInterval(r.thirdPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth }) && r.thirdCommission > 0;
  
      return companyMatch && promoterMatch && (immediatePaymentInMonth || secondPaymentInMonth || thirdPaymentInMonth);
    });
  }, [allReceivables, receivableCompanyFilter, receivablePromoterFilter, leads, selectedMonth]);

  const paidRecurrences = useMemo(() => {
    return allReceivables.filter(r => r.recorrenciaPaga);
  }, [allReceivables]);
  
  const promotersWithLeads = useMemo(() => {
      const promoterSet = new Set<string>();
      allReceivables.forEach(r => {
        const lead = leads.find(l => l.id === r.leadId);
        if (lead?.sellerName) promoterSet.add(lead.sellerName);
      });
      return Array.from(promoterSet).sort();
  }, [allReceivables, leads]);

  const monthlyDashboardMetrics = useMemo(() => {
    if (!showMonthlyDashboard) return null;
    
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);
    
    const revenueByType = { immediate: 0, second: 0, third: 0, fourth: 0 };
    const operationCosts = { juros: 0, churn: 0, comercializador: 0, nota: 0 };
    
    allReceivables.forEach(r => {
        let commissionPaidThisMonth = 0;

        if (isWithinInterval(r.immediatePaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) {
            commissionPaidThisMonth += r.immediateCommission;
            revenueByType.immediate += r.immediateCommission;
        }
        if (isWithinInterval(r.secondPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) {
            commissionPaidThisMonth += r.secondCommission;
            revenueByType.second += r.secondCommission;
        }
        if (isWithinInterval(r.thirdPaymentDate, { start: startOfSelectedMonth, end: endOfSelectedMonth })) {
            commissionPaidThisMonth += r.thirdCommission;
            revenueByType.third += r.thirdCommission;
        }

        if (commissionPaidThisMonth > 0) {
            // Apply costs only on the portion paid this month
            if (r.company === 'BC') {
                 operationCosts.juros += r.immediateCommission * 0.12; 
                 operationCosts.churn += commissionPaidThisMonth * 0.10;
                 operationCosts.comercializador += commissionPaidThisMonth * 0.10;
                 operationCosts.nota += commissionPaidThisMonth * 0.12;
            } else if (r.company === 'Origo') {
                 operationCosts.juros += r.immediateCommission * 0.17;
                 operationCosts.churn += commissionPaidThisMonth * 0.10;
                 operationCosts.comercializador += commissionPaidThisMonth * 0.10;
                 operationCosts.nota += commissionPaidThisMonth * 0.12;
            }
        }
    });

    const totalReceivable = Object.values(revenueByType).reduce((sum, val) => sum + val, 0);
    const totalOperationCosts = Object.values(operationCosts).reduce((sum, val) => sum + val, 0);

    const adminCosts = {
      proLabore: totalReceivable * (proLabore / 100),
      tax: totalReceivable * (tax / 100),
      reinvest: totalReceivable * (reinvest / 100),
      missionary: totalReceivable * (missionaryHelp / 100),
      fixed: (totalPayroll || 0) + (riskFund || 0),
    };
    const totalAdminCosts = Object.values(adminCosts).reduce((sum, val) => sum + val, 0);
    const netProfit = totalReceivable - totalOperationCosts - totalAdminCosts;

    return { totalReceivable, operationCosts, adminCosts, netProfit, revenueByType };
  }, [showMonthlyDashboard, allReceivables, proLabore, tax, reinvest, missionaryHelp, totalPayroll, riskFund, selectedMonth]);


  const totalPages = Math.ceil(filteredReceivables.length / rowsPerPage);
  const paginatedReceivables = filteredReceivables.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5" />Gestão Financeira da Empresa</CardTitle>
          <CardDescription>Defina os percentuais e valores para a distribuição do faturamento mensal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                    <CalendarIcon className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-semibold text-center text-primary capitalize">
                    {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </h2>
                <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                    <CalendarIcon className="h-4 w-4" />
                </Button>
            </div>
            <div>
              <Label htmlFor="monthlyRevenue" className="text-sm text-muted-foreground">Faturamento Previsto para o Mês Selecionado (R$)</Label>
              <div className="text-3xl font-bold text-green-500 mt-1">
                  <AnimatedNumber value={monthlyRevenue} prefix="R$ " />
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-5 gap-6">
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Pró-labore ({proLabore}%)</Label>
                <span className="text-sm font-semibold text-primary">{formatCurrency(proLaboreValue)}</span>
              </div>
              <Slider value={[proLabore]} onValueChange={(val) => setProLabore(val[0])} max={100} step={1} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Impostos ({tax}%)</Label>
                <span className="text-sm font-semibold text-primary">{formatCurrency(taxValue)}</span>
              </div>
              <Slider value={[tax]} onValueChange={(val) => setTax(val[0])} max={100} step={1} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Reinvestimento ({reinvest}%)</Label>
                <span className="text-sm font-semibold text-primary">{formatCurrency(reinvestValue)}</span>
              </div>
              <Slider value={[reinvest]} onValueChange={(val) => setReinvest(val[0])} max={100} step={1} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Ajuda Missionária ({missionaryHelp}%)</Label>
                <span className="text-sm font-semibold text-primary">{formatCurrency(missionaryHelpValue)}</span>
              </div>
              <Slider value={[missionaryHelp]} onValueChange={(val) => setMissionaryHelp(val[0])} max={100} step={1} />
            </div>
            <div>
              <Label htmlFor="riskFund">Caixa de Risco (R$)</Label>
              <Input id="riskFund" type="number" value={riskFund} onChange={(e) => setRiskFund(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>
       
      <Tabs defaultValue="commissions">
        <CardHeader>
            <div className="flex justify-between items-center">
                <TabsList>
                    <TabsTrigger value="commissions">Comissões a Receber (Controle de Caixa)</TabsTrigger>
                    <TabsTrigger value="recurrence">Recorrências Pagas</TabsTrigger>
                </TabsList>
                <div className="flex items-center space-x-2">
                    <Label htmlFor="monthly-dashboard-switch" className="text-sm font-medium">Visualizar Dashboard do Mês</Label>
                    <Switch id="monthly-dashboard-switch" checked={showMonthlyDashboard} onCheckedChange={setShowMonthlyDashboard} />
                </div>
            </div>
        </CardHeader>
        <TabsContent value="commissions">
            <Card>
                <CardHeader>
                    <CardDescription>Filtre para visualizar comissões específicas. Mostrando {paginatedReceivables.length} de {filteredReceivables.length} registros para o mês selecionado.</CardDescription>
                    <div className="flex flex-wrap gap-2 pt-2">
                        <Select value={receivableCompanyFilter} onValueChange={setReceivableCompanyFilter}><SelectTrigger className="h-8 text-xs w-full sm:w-auto flex-1"><SelectValue placeholder="Filtrar por Empresa" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as Empresas</SelectItem>{[...new Set(allReceivables.map(r => r.company))].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        <Select value={receivablePromoterFilter} onValueChange={setReceivablePromoterFilter}><SelectTrigger className="h-8 text-xs w-full sm:w-auto flex-1"><SelectValue placeholder="Filtrar por Promotor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os Promotores</SelectItem>{promotersWithLeads.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                    </div>
                </CardHeader>
                {showMonthlyDashboard && monthlyDashboardMetrics && ( <CardContent className="mb-4 space-y-4">
                    <div className="grid md:grid-cols-3 gap-4 text-center"><Card className="bg-blue-500/10 border-blue-500/50 p-4"><CardTitle className="text-sm font-medium text-blue-500">Total a Receber no Mês</CardTitle><p className="text-2xl font-bold text-blue-400">{formatCurrency(monthlyDashboardMetrics.totalReceivable)}</p></Card><Card className="bg-red-500/10 border-red-500/50 p-4"><CardTitle className="text-sm font-medium text-red-500">Total de Custos no Mês</CardTitle><p className="text-2xl font-bold text-red-400">{formatCurrency((monthlyDashboardMetrics.totalOperationCosts || 0) + (monthlyDashboardMetrics.totalAdminCosts || 0))}</p></Card><Card className="bg-green-500/10 border-green-500/50 p-4"><CardTitle className="text-sm font-medium text-green-500">Lucro Líquido do Mês</CardTitle><p className="text-2xl font-bold text-green-400">{formatCurrency(monthlyDashboardMetrics.netProfit)}</p></Card></div>
                    <div className="grid md:grid-cols-3 gap-4"><Card><CardHeader className="p-3"><CardTitle className="text-base text-primary flex items-center"><TrendingUpIcon className="mr-2 h-4 w-4"/>Lucro da Operação</CardTitle></CardHeader><CardContent className="p-3 text-sm space-y-1"><div className="flex justify-between"><span>Comissões Imediatas:</span><span className="font-medium text-green-500">{formatCurrency(monthlyDashboardMetrics.revenueByType.immediate)}</span></div><div className="flex justify-between"><span>2ªs Comissões:</span><span className="font-medium text-green-500">{formatCurrency(monthlyDashboardMetrics.revenueByType.second)}</span></div><div className="flex justify-between"><span>3ªs Comissões:</span><span className="font-medium text-green-500">{formatCurrency(monthlyDashboardMetrics.revenueByType.third)}</span></div><div className="flex justify-between"><span>4ªs Comissões:</span><span className="font-medium text-green-500">{formatCurrency(monthlyDashboardMetrics.revenueByType.fourth)}</span></div><Separator className="my-1"/><div className="flex justify-between font-bold"><span>Total:</span><span>{formatCurrency(monthlyDashboardMetrics.totalReceivable)}</span></div></CardContent></Card><Card><CardHeader className="p-3"><CardTitle className="text-base text-primary flex items-center"><Briefcase className="mr-2 h-4 w-4"/>Custos da Operação</CardTitle></CardHeader><CardContent className="p-3 text-sm space-y-1"><div className="flex justify-between"><span>Juros:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.operationCosts.juros)}</span></div><div className="flex justify-between"><span>Garantia Churn:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.operationCosts.churn)}</span></div><div className="flex justify-between"><span>Comercializador:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.operationCosts.comercializador)}</span></div><div className="flex justify-between"><span>Nota Fiscal:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.operationCosts.nota)}</span></div><Separator className="my-1"/><div className="flex justify-between font-bold"><span>Total:</span><span>{formatCurrency(monthlyDashboardMetrics.totalOperationCosts)}</span></div></CardContent></Card><Card><CardHeader className="p-3"><CardTitle className="text-base text-primary flex items-center"><Landmark className="mr-2 h-4 w-4"/>Custos Administrativos</CardTitle></CardHeader><CardContent className="p-3 text-sm space-y-1"><div className="flex justify-between"><span>Pró-labore:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.adminCosts.proLabore)}</span></div><div className="flex justify-between"><span>Impostos:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.adminCosts.tax)}</span></div><div className="flex justify-between"><span>Reinvestimento:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.adminCosts.reinvest)}</span></div><div className="flex justify-between"><span>Ajuda Missionária:</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.adminCosts.missionary)}</span></div><div className="flex justify-between"><span>Custos Fixos (Folha+Risco):</span><span className="font-medium text-red-500">{formatCurrency(monthlyDashboardMetrics.adminCosts.fixed)}</span></div><Separator className="my-1"/><div className="flex justify-between font-bold"><span>Total:</span><span>{formatCurrency(monthlyDashboardMetrics.totalAdminCosts)}</span></div></CardContent></Card></div>
                </CardContent>)}
                <CardContent><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Empresa</TableHead><TableHead>1ª Comissão</TableHead><TableHead>Data Pagto.</TableHead><TableHead>2ª Comissão</TableHead><TableHead>Data Pagto.</TableHead><TableHead>3ª Comissão</TableHead><TableHead>Data Pagto.</TableHead></TableRow></TableHeader><TableBody>{paginatedReceivables.map(r => (<TableRow key={r.leadId}><TableCell>{r.clientName}</TableCell><TableCell>{r.company}</TableCell><TableCell>{formatCurrency(r.immediateCommission)}</TableCell><TableCell>{format(r.immediatePaymentDate, 'dd/MM/yy')}</TableCell><TableCell>{formatCurrency(r.secondCommission)}</TableCell><TableCell>{r.isSecondPaymentDateEditable ? (<Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{format(r.secondPaymentDate, 'dd/MM/yy')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={r.secondPaymentDate} onSelect={(date) => handleReceivableDateChange(r.leadId, 'second', date)} initialFocus/></PopoverContent></Popover>) : format(r.secondPaymentDate, 'dd/MM/yy')}</TableCell><TableCell>{formatCurrency(r.thirdCommission)}</TableCell><TableCell>{r.isThirdPaymentDateEditable ? (<Popover><PopoverTrigger asChild><Button variant="outline" size="sm">{format(r.thirdPaymentDate, 'dd/MM/yy')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={r.thirdPaymentDate} onSelect={(date) => handleReceivableDateChange(r.leadId, 'third', date)} initialFocus/></PopoverContent></Popover>) : format(r.thirdPaymentDate, 'dd/MM/yy')}</TableCell></TableRow>))}</TableBody></Table></CardContent>
                <CardFooter className="flex justify-end items-center gap-4"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button></CardFooter>
            </Card>
        </TabsContent>
        <TabsContent value="recurrence">
          <Card>
            <CardHeader>
              <CardTitle>Recorrências Pagas</CardTitle>
              <CardDescription>Histórico de comissões recorrentes que já foram pagas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Comissão de Recorrência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidRecurrences.length > 0 ? (
                    paidRecurrences.map(r => (
                      <TableRow key={r.leadId}>
                        <TableCell>{r.clientName}</TableCell>
                        <TableCell>{r.company}</TableCell>
                        <TableCell>{formatCurrency(r.recorrenciaComissao)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">Nenhuma recorrência paga encontrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Folha de Pagamento</CardTitle>
          <CardDescription>Gerencie seus funcionários e seus custos.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid md:grid-cols-3 gap-4 mb-4">
              <Input placeholder="Nome" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
              <Select value={newEmployee.regime} onValueChange={(v: 'CLT'|'PJ') => setNewEmployee({...newEmployee, regime: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="CLT">CLT</SelectItem><SelectItem value="PJ">PJ</SelectItem></SelectContent>
              </Select>
               <Select value={newEmployee.role} onValueChange={(v: 'SDR'|'Marketing'|'Outro') => setNewEmployee({...newEmployee, role: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="SDR">SDR</SelectItem><SelectItem value="Marketing">Marketing</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent>
              </Select>
              <Input type="number" placeholder="Salário (R$)" value={newEmployee.salary || ''} onChange={e => setNewEmployee({...newEmployee, salary: Number(e.target.value)})} />
              <Input type="number" placeholder="Receita Gerada/Mês (R$)" value={newEmployee.monthlyRevenueGenerated || ''} onChange={e => setNewEmployee({...newEmployee, monthlyRevenueGenerated: Number(e.target.value)})} />
              <Button onClick={handleAddEmployee}>Adicionar Funcionário</Button>
           </div>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Regime</TableHead><TableHead>Função</TableHead><TableHead>Salário</TableHead><TableHead>Impostos (CLT 20%)</TableHead><TableHead>ROI</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {payroll.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell>{emp.name}</TableCell><TableCell>{emp.regime}</TableCell><TableCell>{emp.role}</TableCell>
                  <TableCell>{formatCurrency(emp.salary)}</TableCell><TableCell>{formatCurrency(calculateTax(emp))}</TableCell>
                  <TableCell>{calculateROI(emp)}</TableCell>
                  <TableCell><Button variant="destructive" size="sm" onClick={() => handleRemoveEmployee(emp.id)}>Remover</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader><CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5"/>Distribuição do Faturamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Faturamento Bruto:</p><p className="font-semibold">{formatCurrency(monthlyRevenue)}</p></div>
              <Separator/>
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Pró-labore ({proLabore}%):</p><p className="font-semibold">{formatCurrency(proLaboreValue)}</p></div>
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Impostos ({tax}%):</p><p className="font-semibold">{formatCurrency(taxValue)}</p></div>
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Reinvestimento ({reinvest}%):</p><p className="font-semibold">{formatCurrency(reinvestValue)}</p></div>
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Ajuda Missionária ({missionaryHelp}%):</p><p className="font-semibold">{formatCurrency(missionaryHelpValue)}</p></div>
              <div className="flex justify-between items-center"><p className="text-muted-foreground">Custos Fixos (Folha + Risco):</p><p className="font-semibold">{formatCurrency(totalPayroll + riskFund)}</p></div>
              <Separator/>
              <div className="flex justify-between items-center text-lg"><p className="font-bold text-primary">Lucro Líquido Estimado:</p><p className="font-bold text-primary">{formatCurrency(monthlyRevenue - proLaboreValue - taxValue - reinvestValue - (totalPayroll + riskFund) - missionaryHelpValue)}</p></div>
          </CardContent>
      </Card>
    </div>
  );
}

function PersonalFinanceTab({ monthlyProLabore, user, onUpdate }: { monthlyProLabore: number; user: AppUser; onUpdate: (updates: Partial<FirestoreUser>) => Promise<void> }) {
    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    
    const [personalCapital, setPersonalCapital] = useState(user.personalFinance?.personalCapital || 500000);
    const [investmentAllocation, setInvestmentAllocation] = useState(user.personalFinance?.investmentAllocation || { stocks: 40, fixedIncome: 30, crypto: 15, realEstate: 15 });
    const [expenses, setExpenses] = useState<PersonalExpense[]>(user.personalFinance?.expenses || []);
    const [newExpense, setNewExpense] = useState({ description: '', amount: 0, type: 'Variavel' as 'Fixo' | 'Variavel', installments: 1 });
    const [revenues, setRevenues] = useState<PersonalRevenue[]>(user.personalFinance?.revenues || []);
    const [newRevenue, setNewRevenue] = useState({ description: '', amount: 0, date: '' });
    const [editingRevenue, setEditingRevenue] = useState<PersonalRevenue | null>(null);

    const updateFirestore = useCallback((data: Partial<FirestoreUser['personalFinance']>) => {
        onUpdate({ personalFinance: { ...user.personalFinance, ...data } as FirestoreUser['personalFinance'] });
    }, [onUpdate, user.personalFinance]);

    const handleAddExpense = () => {
        if (!newExpense.description || newExpense.amount <= 0) { alert("Descrição e valor são obrigatórios."); return; }
        const updatedExpenses = [...expenses, { ...newExpense, id: Date.now().toString() }];
        setExpenses(updatedExpenses);
        updateFirestore({ expenses: updatedExpenses });
        setNewExpense({ description: '', amount: 0, type: 'Variavel', installments: 1 });
    };

    const handleRemoveExpense = (id: string) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);
        updateFirestore({ expenses: updatedExpenses });
    };

    const handleAddRevenue = () => {
      if (!newRevenue.description || newRevenue.amount <= 0) { alert("Descrição e valor são obrigatórios."); return; }
      const updatedRevenues = [...revenues, { ...newRevenue, id: Date.now().toString(), date: newRevenue.date || new Date().toISOString().split('T')[0] }];
      setRevenues(updatedRevenues);
      updateFirestore({ revenues: updatedRevenues });
      setNewRevenue({ description: '', amount: 0, date: '' });
    };

    const handleUpdateRevenue = () => {
        if (!editingRevenue) return;
        const updatedRevenues = revenues.map(r => r.id === editingRevenue.id ? editingRevenue : r);
        setRevenues(updatedRevenues);
        updateFirestore({ revenues: updatedRevenues });
        setEditingRevenue(null);
    };
    
    const handleRemoveRevenue = (id: string) => {
        const updatedRevenues = revenues.filter(rev => rev.id !== id);
        setRevenues(updatedRevenues);
        updateFirestore({ revenues: updatedRevenues });
    };

    const totalMonthlyExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount, 0), [expenses]);
    const totalMonthlyRevenues = useMemo(() => revenues.reduce((sum, rev) => sum + rev.amount, 0), [revenues]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><PiggyBank className="mr-2 h-5 w-5" />Controle Financeiro Pessoal</CardTitle>
                    <CardDescription>Gerencie seu capital pessoal, despesas e investimentos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid md:grid-cols-2 gap-6">
                         <div>
                            <Label htmlFor="personalCapital">Capital Pessoal Total (R$)</Label>
                            <Input id="personalCapital" type="number" value={personalCapital} onChange={(e) => setPersonalCapital(Number(e.target.value))} onBlur={() => updateFirestore({ personalCapital })} />
                        </div>
                    </div>
                    <div>
                        <Label>Alocação de Investimentos (%)</Label>
                        <div className="space-y-3 pt-2">
                            <div>
                                <div className="flex justify-between text-sm mb-1"><Label>Ações</Label><span>{investmentAllocation.stocks}%</span></div>
                                <Slider value={[investmentAllocation.stocks]} onValueChange={(v) => setInvestmentAllocation(p => ({...p, stocks: v[0]}))} onValueCommit={(v) => updateFirestore({ investmentAllocation: { ...investmentAllocation, stocks: v[0] } })} />
                            </div>
                             <div>
                                <div className="flex justify-between text-sm mb-1"><Label>Renda Fixa</Label><span>{investmentAllocation.fixedIncome}%</span></div>
                                <Slider value={[investmentAllocation.fixedIncome]} onValueChange={(v) => setInvestmentAllocation(p => ({...p, fixedIncome: v[0]}))} onValueCommit={(v) => updateFirestore({ investmentAllocation: { ...investmentAllocation, fixedIncome: v[0] } })} />
                            </div>
                             <div>
                                <div className="flex justify-between text-sm mb-1"><Label>Criptomoedas</Label><span>{investmentAllocation.crypto}%</span></div>
                                <Slider value={[investmentAllocation.crypto]} onValueChange={(v) => setInvestmentAllocation(p => ({...p, crypto: v[0]}))} onValueCommit={(v) => updateFirestore({ investmentAllocation: { ...investmentAllocation, crypto: v[0] } })} />
                            </div>
                             <div>
                                <div className="flex justify-between text-sm mb-1"><Label>Imóveis</Label><span>{investmentAllocation.realEstate}%</span></div>
                                <Slider value={[investmentAllocation.realEstate]} onValueChange={(v) => setInvestmentAllocation(p => ({...p, realEstate: v[0]}))} onValueCommit={(v) => updateFirestore({ investmentAllocation: { ...investmentAllocation, realEstate: v[0] } })} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle className="text-base">Gerenciar Receitas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2 mb-4">
                            <Input placeholder="Descrição da Receita" value={editingRevenue ? editingRevenue.description : newRevenue.description} onChange={e => editingRevenue ? setEditingRevenue({...editingRevenue, description: e.target.value}) : setNewRevenue({ ...newRevenue, description: e.target.value })} />
                            <Input type="number" placeholder="Valor (R$)" value={editingRevenue ? editingRevenue.amount : newRevenue.amount} onChange={e => editingRevenue ? setEditingRevenue({...editingRevenue, amount: Number(e.target.value)}) : setNewRevenue({ ...newRevenue, amount: Number(e.target.value) })} />
                            <Input type="date" value={editingRevenue ? editingRevenue.date : newRevenue.date} onChange={e => editingRevenue ? setEditingRevenue({...editingRevenue, date: e.target.value}) : setNewRevenue({ ...newRevenue, date: e.target.value })} />
                            {editingRevenue ? (
                                <div className="flex gap-2"><Button onClick={handleUpdateRevenue}>Salvar</Button><Button variant="ghost" onClick={() => setEditingRevenue(null)}>Cancelar</Button></div>
                            ) : (
                                <Button onClick={handleAddRevenue}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Receita</Button>
                            )}
                        </div>
                         <Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                            <TableBody>{revenues.map(rev => (
                                <TableRow key={rev.id}>
                                    <TableCell>{rev.description}</TableCell><TableCell>{formatCurrency(rev.amount)}</TableCell><TableCell>{rev.date}</TableCell>
                                    <TableCell><Button size="icon" variant="ghost" onClick={() => setEditingRevenue(rev)}><Pencil className="h-4 w-4"/></Button><Button size="icon" variant="ghost" onClick={() => handleRemoveRevenue(rev.id)}><Trash className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-base">Gerenciar Despesas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2 mb-4">
                            <Input placeholder="Descrição da Despesa" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} />
                            <Input type="number" placeholder="Valor (R$)" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} />
                            <Select value={newExpense.type} onValueChange={(v: 'Fixo' | 'Variavel') => setNewExpense({ ...newExpense, type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="Fixo">Fixo</SelectItem><SelectItem value="Variavel">Variável</SelectItem></SelectContent>
                            </Select>
                            <Input type="number" placeholder="Nº de Parcelas" value={newExpense.installments || ''} onChange={e => setNewExpense({ ...newExpense, installments: Number(e.target.value) })} />
                            <Button onClick={handleAddExpense}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Despesa</Button>
                        </div>
                         <Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Tipo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                            <TableBody>{expenses.map(exp => (
                                <TableRow key={exp.id}>
                                    <TableCell>{exp.description}</TableCell><TableCell>{formatCurrency(exp.amount)}</TableCell><TableCell>{exp.type}</TableCell>
                                    <TableCell><Button size="icon" variant="ghost" onClick={() => handleRemoveExpense(exp.id)}><Trash className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5"/>Resumo do Patrimônio Pessoal</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center"><p className="text-muted-foreground">Patrimônio Total:</p><p className="font-semibold">{formatCurrency(personalCapital)}</p></div>
                    <Separator/>
                    <div className="flex justify-between items-center"><p className="text-muted-foreground">Alocado em Ações:</p><p className="font-semibold">{formatCurrency(personalCapital * (investmentAllocation.stocks/100))}</p></div>
                    <div className="flex justify-between items-center"><p className="text-muted-foreground">Alocado em Renda Fixa:</p><p className="font-semibold">{formatCurrency(personalCapital * (investmentAllocation.fixedIncome/100))}</p></div>
                     <div className="flex justify-between items-center"><p className="text-muted-foreground">Alocado em Cripto:</p><p className="font-semibold">{formatCurrency(personalCapital * (investmentAllocation.crypto/100))}</p></div>
                     <div className="flex justify-between items-center"><p className="text-muted-foreground">Alocado em Imóveis:</p><p className="font-semibold">{formatCurrency(personalCapital * (investmentAllocation.realEstate/100))}</p></div>
                    <Separator/>
                    <div className="flex justify-between items-center"><p className="text-muted-foreground">Total de Receitas Mensais Adicionais:</p><p className="font-semibold text-green-500">{formatCurrency(totalMonthlyRevenues)}</p></div>
                    <div className="flex justify-between items-center"><p className="text-muted-foreground">Total de Despesas Mensais:</p><p className="font-semibold text-red-500">{formatCurrency(totalMonthlyExpenses)}</p></div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg"><p className="font-bold text-primary">Saldo Líquido Mensal:</p><p className="font-bold text-primary">{formatCurrency(monthlyProLabore + totalMonthlyRevenues - totalMonthlyExpenses)}</p></div>
                </CardContent>
            </Card>
        </div>
    );
}


export default function AdminCommissionDashboard({ loggedInUser, initialUsers, isLoadingUsersProp, onUsersChange }: AdminCommissionDashboardProps) {
  const { toast } = useToast();
  const { userAppRole, fetchAllCrmLeadsGlobally, updateAppUserProfile } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestWithId[]>(MOCK_WITHDRAWALS);

  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<UserType | 'all'>('all');

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isUpdateWithdrawalModalOpen, setIsUpdateWithdrawalModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequestWithId | null>(null);
  const [userToDelete, setUserToDelete] = useState<FirestoreUser | null>(null);

  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessingWithdrawals, setIsProcessingWithdrawals] = useState(false);
  
  const addUserForm = useForm<AddUserFormData>({ 
    resolver: zodResolver(addUserFormSchema), 
    defaultValues: { type: 'vendedor', cpf: '', displayName: '', email: '', password: '', phone: '' } 
  });
  const editUserForm = useForm<EditUserFormData>({ resolver: zodResolver(editUserFormSchema) });
  const updateWithdrawalForm = useForm<UpdateWithdrawalFormData>({ resolver: zodResolver(updateWithdrawalFormSchema) });

  const canEdit = useMemo(() => userAppRole === 'superadmin' || userAppRole === 'admin', [userAppRole]);
  
  useEffect(() => {
    async function loadLeads() {
      setIsLoadingLeads(true);
      const leads = await fetchAllCrmLeadsGlobally();
      setAllLeads(leads);
      setIsLoadingLeads(false);
    }
    loadLeads();
  }, [fetchAllCrmLeadsGlobally]);

  const handleOpenEditModal = (user: FirestoreUser) => {
    setSelectedUser(user);
    editUserForm.reset({
      displayName: user.displayName || '',
      phone: user.phone || '',
      type: user.type,
      commissionRate: user.commissionRate,
      mlmEnabled: user.mlmEnabled || false,
      uplineUid: user.uplineUid,
      recurrenceRate: user.recurrenceRate,
      canViewLeadPhoneNumber: user.canViewLeadPhoneNumber || false,
      canViewCrm: user.canViewCrm || false,
      canViewCareerPlan: user.canViewCareerPlan || false,
      assignmentLimit: user.assignmentLimit,
    });
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (data: EditUserFormData) => {
    if (!selectedUser) return;
    setIsSubmittingAction(true);
    try {
      await updateUser(selectedUser.uid, {
        displayName: data.displayName,
        phone: data.phone,
        type: data.type,
        commissionRate: data.commissionRate,
        mlmEnabled: data.mlmEnabled,
        uplineUid: data.uplineUid,
        recurrenceRate: data.recurrenceRate,
        canViewLeadPhoneNumber: data.canViewLeadPhoneNumber,
        canViewCrm: data.canViewCrm,
        canViewCareerPlan: data.canViewCareerPlan,
        assignmentLimit: data.assignmentLimit,
      });
      await onUsersChange();
      toast({ title: "Sucesso", description: `Usuário ${data.displayName} atualizado.` });
      setIsEditUserModalOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar o usuário.", variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleUpdatePersonalFinance = useCallback(async (personalFinanceData: Partial<FirestoreUser['personalFinance']>) => {
    if (userAppRole !== 'superadmin' || !loggedInUser) return;
    try {
      await updateAppUserProfile({ personalFinance: {
          ...loggedInUser.personalFinance,
          ...personalFinanceData
        } as FirestoreUser['personalFinance'] });
      // Optionally toast success, but maybe too noisy for every change
    } catch (error) {
      console.error("Error updating personal finance data:", error);
      toast({ title: "Erro", description: "Não foi possível salvar os dados financeiros.", variant: "destructive" });
    }
  }, [loggedInUser, updateAppUserProfile, userAppRole, toast]);


  const handleOpenResetPasswordModal = (user: FirestoreUser) => {
    setSelectedUser(user);
    setIsResetPasswordModalOpen(true);
  };
  
  const handleConfirmResetPassword = async () => {
    if (!selectedUser || !selectedUser.email) return;
    setIsSubmittingAction(true);
    try {
      await sendPasswordResetEmail(auth, selectedUser.email);
      toast({ title: "Email Enviado", description: `Um email de redefinição de senha foi enviado para ${selectedUser.email}.` });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível enviar o email de redefinição de senha.", variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
      setIsResetPasswordModalOpen(false);
      setSelectedUser(null);
    }
  };

  const handleOpenDeleteModal = (user: FirestoreUser) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsSubmittingAction(true);
    try {
        const result = await deleteUser(userToDelete.uid);
        if (result.success) {
            toast({ title: "Usuário Excluído", description: result.message });
            await onUsersChange();
        } else {
            toast({ title: "Erro ao Excluir", description: result.message, variant: "destructive" });
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        toast({ title: "Erro", description: "Não foi possível excluir o usuário.", variant: "destructive" });
    } finally {
        setIsSubmittingAction(false);
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return initialUsers.filter(user => {
      const searchTermLower = userSearchTerm.toLowerCase();
      const matchesSearch = 
        (user.displayName?.toLowerCase().includes(searchTermLower)) ||
        (user.email?.toLowerCase().includes(searchTermLower)) ||
        ((user.cpf?.replace(/\D/g, '') ?? '').includes(searchTermLower.replace(/\D/g, '')));
      const matchesType = userTypeFilter === 'all' || user.type === userTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [initialUsers, userSearchTerm, userTypeFilter]);

  const handleAddUser = async (data: AddUserFormData) => {
    setIsSubmittingUser(true);
    try {
      const result = await createUser(data);

      if (result.success) {
        await onUsersChange();
        toast({ title: "Usuário Criado", description: result.message });
        setIsAddUserModalOpen(false);
        addUserForm.reset({ type: 'vendedor', cpf: '', displayName: '', email: '', password: '', phone: '' });
      } else {
        toast({
          title: "Erro ao Criar Usuário",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("CRITICAL ERROR adding user:", error);
      toast({
        title: "Erro de Rede",
        description: "Não foi possível conectar ao servidor para criar o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenUpdateWithdrawalModal = (withdrawal: WithdrawalRequestWithId) => {
    setSelectedWithdrawal(withdrawal);
    updateWithdrawalForm.reset({ status: withdrawal.status, adminNotes: withdrawal.adminNotes || '' });
    setIsUpdateWithdrawalModalOpen(true);
  };

  const handleUpdateWithdrawal = async (data: UpdateWithdrawalFormData) => {
    if (!selectedWithdrawal) return;
    setIsSubmittingAction(true);
    setTimeout(() => {
        setWithdrawalRequests(prev => prev.map(w => w.id === selectedWithdrawal.id ? {...w, ...data, processedAt: (data.status === 'concluido' || data.status === 'falhou') ? new Date().toISOString() : w.processedAt} : w));
        toast({ title: "Status de Saque Atualizado", description: "Solicitação atualizada (simulado)." });
        setIsUpdateWithdrawalModalOpen(false);
        setIsSubmittingAction(false);
    }, 1000);
  };

  const handleExportUsersCSV = () => {
    if (filteredUsers.length === 0) {
      toast({ title: "Nenhum usuário para exportar", description: "A seleção atual de filtros não retornou usuários." });
      return;
    }
    const dataToExport = filteredUsers.map(user => ({ 'UID': user.uid, 'Nome': user.displayName || 'N/A', 'Email': user.email || 'N/A', 'CPF': user.cpf || 'N/A', 'Telefone': user.phone || 'N/A', 'Tipo': user.type || 'N/A', 'Saldo Pessoal (R$)': (user.personalBalance || 0).toFixed(2).replace('.', ','), 'Saldo MLM (R$)': (user.mlmBalance || 0).toFixed(2).replace('.', ','), 'Data de Criação': user.createdAt ? format(parseISO(user.createdAt as string), "yyyy-MM-dd HH:mm:ss") : 'N/A', 'Último Acesso': user.lastSignInTime ? format(parseISO(user.lastSignInTime as string), "yyyy-MM-dd HH:mm:ss") : 'N/A' }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `usuarios_sent_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: "Exportação Iniciada", description: `${filteredUsers.length} usuários exportados.` });
  };
  
  const handleSyncSellers = async () => {
      setIsSyncing(true);
      const result = await syncLegacySellers();
      toast({
          title: result.success ? "Sincronização Concluída" : "Erro na Sincronização",
          description: result.message,
          variant: result.success ? "default" : "destructive",
          duration: 9000,
      });
      if (result.success) {
          await onUsersChange();
      }
      setIsSyncing(false);
  };

  const handleProcessOldWithdrawals = async () => {
    setIsProcessingWithdrawals(true);
    const result = await processOldWithdrawals();
    toast({
        title: result.success ? "Processamento Concluído" : "Erro no Processamento",
        description: result.message,
        variant: result.success ? "default" : "destructive",
        duration: 9000,
    });
    // Here you would typically re-fetch withdrawal data.
    // For this example, we'll just show the toast.
    setIsProcessingWithdrawals(false);
  };

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  const filteredLeads = useMemo(() => {
    return allLeads.filter(lead => {
      if (!dateRange || !dateRange.from) return true; // Show all if no date range
      const createdAt = new Date(lead.createdAt);
      const inRange = createdAt >= dateRange.from && (!dateRange.to || createdAt <= dateRange.to);
      return inRange;
    });
  }, [allLeads, dateRange]);

  const aggregatedMetrics = useMemo(() => {
    const paidCommissions = withdrawalRequests.filter(w => w.status === 'concluido').reduce((sum, w) => sum + w.amount, 0);
    const pendingCommissions = withdrawalRequests.filter(w => w.status === 'pendente').reduce((sum, w) => sum + w.amount, 0);
    const finalizedLeadsValue = filteredLeads.filter(l => l.stageId === 'finalizado').reduce((sum, l) => sum + (l.value || 0), 0);
    return { paidCommissions, pendingCommissions, finalizedLeadsValue };
  }, [withdrawalRequests, filteredLeads]);

  const funnelMetrics = useMemo(() => {
    const funnelOrder: StageId[] = ['contato', 'fatura', 'proposta', 'contrato', 'assinado', 'finalizado'];
    const stageIndices = funnelOrder.reduce((acc, stage, index) => {
        acc[stage] = index;
        return acc;
    }, {} as Record<string, number>);

    const leadsPassingThrough = funnelOrder.map(stageId => {
        const stageIndex = stageIndices[stageId];
        const count = filteredLeads.filter(lead => {
            const leadStageIndex = stageIndices[lead.stageId];
            return leadStageIndex !== undefined && leadStageIndex >= stageIndex;
        }).length;
        return { 
            name: STAGES_CONFIG.find(s => s.id === stageId)?.title || stageId, 
            value: count 
        };
    });
    
    return funnelOrder.map((stageId, index) => {
        const currentStage = leadsPassingThrough.find(s => s.name === (STAGES_CONFIG.find(conf => conf.id === stageId)?.title || stageId));
        const prevStageCount = index > 0 ? leadsPassingThrough[index - 1].value : (currentStage?.value || 0);
        const conversionRate = prevStageCount > 0 ? ((currentStage?.value || 0) / prevStageCount) * 100 : 100;
        
        return {
            name: currentStage?.name || 'N/A',
            value: currentStage?.value || 0,
            conversion: conversionRate.toFixed(1) + '%',
        };
    }).filter(d => d.value > 0);
  }, [filteredLeads]);


  const leadSourceMetrics = useMemo(() => {
    const finalizedLeads = filteredLeads.filter(l => l.stageId === 'finalizado');
    const sourceCounts = finalizedLeads.reduce((acc, lead) => {
        const source = lead.leadSource || 'Não Informado';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);
  

  const sellerPerformanceMetrics = useMemo(() => {
    return filteredUsers
      .map(user => {
        const userLeads = filteredLeads.filter(lead => lead.userId === user.uid);
        if (userLeads.length === 0) return null;

        const finalizedLeads = userLeads.filter(l => l.stageId === 'finalizado' && l.completedAt && l.createdAt);
        const totalTimeToClose = finalizedLeads.reduce((sum, l) => sum + differenceInDays(parseISO(l.completedAt!), parseISO(l.createdAt)), 0);
        
        return {
          uid: user.uid,
          name: user.displayName || user.email || 'N/A',
          totalLeads: userLeads.length,
          finalizedLeads: finalizedLeads.length,
          conversionRate: finalizedLeads.length > 0 ? ((finalizedLeads.length / userLeads.length) * 100).toFixed(1) + '%' : '0.0%',
          avgTimeToClose: finalizedLeads.length > 0 ? (totalTimeToClose / finalizedLeads.length).toFixed(1) + ' dias' : 'N/A',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.finalizedLeads - a.finalizedLeads);
  }, [filteredLeads, filteredUsers]);


  const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  const getUserTypeBadgeStyle = (type?: UserType) => {
    if (!type) return 'bg-gray-500/20 text-gray-400';
    switch (type) {
      case 'superadmin': return 'bg-yellow-500/20 text-yellow-400';
      case 'admin': return 'bg-red-500/20 text-red-400';
      case 'vendedor': return 'bg-blue-500/20 text-blue-400';
      case 'prospector': return 'bg-purple-500/20 text-purple-400';
      case 'advogado': return 'bg-slate-500/20 text-slate-400';
      case 'user': return 'bg-green-500/20 text-green-400';
      case 'pending_setup': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground flex items-center">
          <ShieldAlert className="w-8 h-8 mr-3 text-primary" />
          Painel do Administrador
        </h1>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")) : (<span>Selecione o período</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus locale={ptBR} /></PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" disabled><Filter className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" onClick={onUsersChange} disabled={isLoadingUsersProp}><RefreshCw className={cn("w-4 h-4", isLoadingUsersProp && "animate-spin")} /></Button>
        </div>
      </header>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard"><Activity className="mr-2 h-4 w-4"/>Dashboard</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4"/>Usuários</TabsTrigger>
          <TabsTrigger value="commissions"><ClipboardList className="mr-2 h-4 w-4"/>Comissões por Empresas</TabsTrigger>
          <TabsTrigger value="management"><Building className="mr-2 h-4 w-4"/>Gestão da Empresa</TabsTrigger>
          {userAppRole === 'superadmin' && (
            <TabsTrigger value="personal_finance"><PiggyBank className="mr-2 h-4 w-4"/>Finanças Pessoais</TabsTrigger>
          )}
          <TabsTrigger value="withdrawals"><WalletCards className="mr-2 h-4 w-4"/>Saques</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Comissões Pagas</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.paidCommissions)}</div></CardContent></Card>
            <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Saques Pendentes</CardTitle><WalletCards className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.pendingCommissions)}</div></CardContent></Card>
            <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Leads Finalizados (Período)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.finalizedLeadsValue)}</div><p className="text-xs text-muted-foreground">{filteredLeads.filter(l=>l.stageId === 'finalizado').length} leads</p></CardContent></Card>
            <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Total de Usuários</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{initialUsers.length}</div></CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <Card className="bg-card/70 backdrop-blur-lg border">
                  <CardHeader>
                      <CardTitle className="text-primary flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Funil de Vendas</CardTitle>
                      <CardDescription>Conversão de leads entre estágios no período selecionado.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                      {funnelMetrics.length > 0 ? (
                          funnelMetrics.map((stage, index) => (
                              <div key={stage.name} className="flex items-center">
                                  <div className="flex-1 space-y-1">
                                      <div className="flex justify-between">
                                          <p className="font-medium">{stage.name}</p>
                                          <p className="font-semibold text-foreground">{stage.value} Leads</p>
                                      </div>
                                      <div className="h-2 w-full bg-muted rounded-full">
                                          <div className="h-2 bg-primary rounded-full" style={{ width: `${(stage.value / funnelMetrics[0].value) * 100}%` }}></div>
                                      </div>
                                  </div>
                                  {index > 0 && (
                                      <div className="text-center w-24 flex-shrink-0">
                                          <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                                          <p className="text-xs font-semibold text-green-500">{stage.conversion}</p>
                                      </div>
                                  )}
                              </div>
                          ))
                      ) : (
                          <p className="text-center text-muted-foreground py-10">Nenhum dado para o funil neste período.</p>
                      )}
                  </CardContent>
              </Card>
              <Card className="bg-card/70 backdrop-blur-lg border">
                  <CardHeader>
                      <CardTitle className="text-primary flex items-center"><PieChartIcon className="mr-2 h-5 w-5"/>Origem dos Leads Convertidos</CardTitle>
                      <CardDescription>Distribuição de fontes para leads finalizados no período.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                      {leadSourceMetrics.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={leadSourceMetrics} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const radius = innerRadius + (outerRadius - innerRadius) * 1.2; const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180)); const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180)); return (<text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs fill-muted-foreground">{`${(percent * 100).toFixed(0)}%`}</text>);}}>
                                      {leadSourceMetrics.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                  </Pie>
                                  <RechartsTooltip formatter={(value: number) => `${value} leads`} />
                                  <Legend />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <p className="text-center text-muted-foreground pt-10">Nenhum lead convertido no período para exibir.</p>
                      )}
                  </CardContent>
              </Card>
          </div>

          <Card className="bg-card/70 backdrop-blur-lg border">
              <CardHeader>
                  <CardTitle className="text-primary flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5"/>Relatório de Performance por Vendedor</CardTitle>
                  <CardDescription>Análise detalhada do desempenho da equipe no período.</CardDescription>
              </CardHeader>
              <CardContent>
                  {sellerPerformanceMetrics.length > 0 ? (
                      <Table>
                          <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>Leads Trabalhados</TableHead><TableHead>Leads Finalizados</TableHead><TableHead>Taxa de Conversão</TableHead><TableHead>Tempo Médio de Fechamento</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {sellerPerformanceMetrics.map(seller => (
                                  <TableRow key={seller.uid}>
                                      <TableCell className="font-medium">{seller.name}</TableCell>
                                      <TableCell>{seller.totalLeads}</TableCell>
                                      <TableCell className="font-semibold text-primary">{seller.finalizedLeads}</TableCell>
                                      <TableCell>{seller.conversionRate}</TableCell>
                                      <TableCell>{seller.avgTimeToClose}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  ) : (
                      <p className="text-center text-muted-foreground py-10">Nenhum dado de performance para exibir no período selecionado.</p>
                  )}
              </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users">
            <Card className="bg-card/70 backdrop-blur-lg border">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><CardTitle className="text-primary flex items-center"><Users className="mr-2 h-5 w-5" />Gerenciamento de Usuários</CardTitle><CardDescription>Adicione e gerencie usuários e suas comissões.</CardDescription></div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={handleExportUsersCSV} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
                    {canEdit && <Button onClick={() => setIsAddUserModalOpen(true)} size="sm"><UserPlus className="mr-2 h-4 w-4" /> Adicionar Usuário</Button>}
                </div>
                </CardHeader>
                <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome, email ou CPF..." className="pl-8" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} /></div>
                    <Select value={userTypeFilter} onValueChange={(value) => setUserTypeFilter(value as UserType | 'all')}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger><SelectContent>{USER_TYPE_FILTER_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent></Select>
                </div>
                {isLoadingUsersProp ? (<div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : filteredUsers.length === 0 ? (<p className="text-center text-muted-foreground py-4">Nenhum usuário encontrado com os filtros atuais.</p>) : (
                    <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>CPF</TableHead><TableHead>Telefone</TableHead><TableHead>Tipo</TableHead><TableHead>Último Acesso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filteredUsers.map(user => (
                        <TableRow key={user.uid}>
                            <TableCell className="font-medium"><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} /><AvatarFallback>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback></Avatar>{user.displayName || user.email?.split('@')[0] || 'N/A'}</div></TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.cpf ? `${user.cpf.slice(0,3)}.${user.cpf.slice(3,6)}.${user.cpf.slice(6,9)}-${user.cpf.slice(9,11)}` : 'N/A'}</TableCell>
                            <TableCell>{user.phone || 'N/A'}</TableCell>
                            <TableCell><span className={`px-2 py-1 text-xs rounded-full ${getUserTypeBadgeStyle(user.type)}`}>{USER_TYPE_FILTER_OPTIONS.find(opt => opt.value === user.type)?.label || user.type}</span></TableCell>
                            <TableCell>{user.lastSignInTime ? format(parseISO(user.lastSignInTime as string), "dd/MM/yy HH:mm") : 'Nunca'}</TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-4 w-4" /><span className="sr-only">Ações</span></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleOpenEditModal(user)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Ver / Editar Detalhes
                                </DropdownMenuItem>
                                {canEdit && <DropdownMenuSeparator />}
                                {canEdit && (<DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => handleOpenResetPasswordModal(user)}>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    Redefinir Senha
                                </DropdownMenuItem>)}
                                {canEdit && (
                                    <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => handleOpenDeleteModal(user)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir Usuário
                                    </DropdownMenuItem>
                                )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="commissions">
            <CompanyCommissionsTable leads={allLeads} allUsers={initialUsers} />
        </TabsContent>

        <TabsContent value="management">
            <CompanyManagementTab leads={allLeads} tableData={[]} />
        </TabsContent>
        
        {userAppRole === 'superadmin' && (
          <TabsContent value="personal_finance">
            <PersonalFinanceTab monthlyProLabore={(loggedInUser.personalFinance?.revenues.find(r => r.description.toLowerCase().includes('pró-labore'))?.amount || 0)} user={loggedInUser} onUpdate={handleUpdatePersonalFinance} />
          </TabsContent>
        )}

        <TabsContent value="withdrawals">
            <Card className="bg-card/70 backdrop-blur-lg border">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className="text-primary">Solicitações de Saque</CardTitle>
                        <CardDescription>Gerencie as solicitações de saque dos usuários.</CardDescription>
                    </div>
                     <Button onClick={handleProcessOldWithdrawals} size="sm" variant="outline" disabled={isProcessingWithdrawals}>
                        {isProcessingWithdrawals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                        Processar Saques Antigos
                    </Button>
                </CardHeader>
                <CardContent>
                <Input placeholder="Buscar por usuário ou chave PIX..." className="mb-4" />
                <Table>
                    <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>Tipo</TableHead><TableHead>Chave PIX</TableHead><TableHead>Solicitado em</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {withdrawalRequests.map(req => (
                        <TableRow key={req.id}>
                        <TableCell>{req.userName || req.userEmail}</TableCell><TableCell>{formatCurrency(req.amount)}</TableCell>
                        <TableCell>{req.withdrawalType === 'personal' ? 'Pessoal' : 'Rede MLM'}</TableCell><TableCell title={req.pixKey} className="truncate max-w-[150px]">{req.pixKeyType}: {req.pixKey}</TableCell>
                        <TableCell>{req.requestedAt ? format(parseISO(req.requestedAt as string), "dd/MM/yy HH:mm") : 'N/A'}</TableCell>
                        <TableCell><span className={`px-2 py-1 text-xs rounded-full ${req.status === 'concluido' ? 'bg-green-500/20 text-green-400' : req.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' : req.status === 'falhou' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{req.status}</span></TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleOpenUpdateWithdrawalModal(req)}><ExternalLink className="h-3 w-3 mr-1"/>Detalhes</Button></TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>


      {/* Modals */}
      <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}><DialogContent className="sm:max-w-[425px] bg-card/80 backdrop-blur-xl border text-foreground"><DialogHeader><DialogTitle className="text-primary">Adicionar Novo Usuário</DialogTitle><DialogDescription>Crie uma nova conta de usuário para o sistema.</DialogDescription></DialogHeader><Form {...addUserForm}><form onSubmit={addUserForm.handleSubmit(handleAddUser)} className="space-y-4 py-3"><FormField control={addUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nome Completo (Opcional)</FormLabel><FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email*</FormLabel><FormControl><Input type="email" placeholder="Ex: joao.silva@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input placeholder="(XX) XXXXX-XXXX" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha*</FormLabel><FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF*</FormLabel><FormControl><Input placeholder="Ex: 000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo de Usuário*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl><SelectContent>{USER_TYPE_ADD_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /><DialogFooter><Button type="button" variant="outline" onClick={() => { setIsAddUserModalOpen(false); addUserForm.reset(); }} disabled={isSubmittingUser}>Cancelar</Button><Button type="submit" disabled={isSubmittingUser}>{isSubmittingUser ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}Adicionar</Button></DialogFooter></form></Form></DialogContent></Dialog>
      
      {selectedUser && (
        <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
          <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-primary">Ver / Editar Usuário</DialogTitle>
              <DialogDescription>
                {canEdit ? 'Altere os dados, permissões e comissões do usuário.' : 'Você está visualizando os detalhes do usuário.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit(handleUpdateUser)} className="space-y-4 py-3">
                
                {/* User Info */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Informações Pessoais</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} disabled={!canEdit || isSubmittingAction} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={editUserForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} disabled={!canEdit || isSubmittingAction} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={editUserForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo de Usuário</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || isSubmittingAction}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{USER_TYPE_ADD_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </CardContent></Card>
                
                {/* Permissions */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Permissões da Plataforma</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="canViewCrm" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Acesso ao CRM</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="canViewCareerPlan" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Ver Plano de Carreira</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="canViewLeadPhoneNumber" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Ver Telefone dos Leads</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField
                      control={editUserForm.control}
                      name="assignmentLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><ClipboardList className="mr-2 h-4 w-4" />Limite de Leads Ativos</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))} 
                            value={field.value !== undefined ? String(field.value) : '2'} // Default to 2 if undefined
                            disabled={!canEdit || isSubmittingAction}
                          >
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="2">2 (Padrão)</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="9999">Ilimitado</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Máximo de leads sem feedback que o vendedor pode ter.</p>
                        </FormItem>
                      )}
                    />
                </CardContent></Card>

                {/* Commissions */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Configurações de Comissão</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="commissionRate" render={({ field }) => (
                      <FormItem>
                          <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4"/>Comissão Direta (%)</FormLabel>
                          <FormControl><Input type="number" step="1" placeholder="Padrão do Nível" {...field} value={field.value ?? ''} disabled={!canEdit || isSubmittingAction} /></FormControl>
                          <p className="text-xs text-muted-foreground">Deixe em branco para usar o padrão do nível (40% ou 50%).</p>
                          <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editUserForm.control} name="recurrenceRate" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><RefreshCw className="mr-2 h-4 w-4"/>Recorrência (%)</FormLabel>
                          <FormControl><Input type="number" step="0.1" placeholder="Sem Recorrência" {...field} value={field.value ?? ''} disabled={!canEdit || isSubmittingAction} /></FormControl>
                          <p className="text-xs text-muted-foreground">Deixe em branco para sem recorrência.</p>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={editUserForm.control} name="mlmEnabled" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel className="flex items-center"><Network className="mr-2 h-4 w-4"/>Ativar Multinível</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    {editUserForm.watch("mlmEnabled") && (<>
                        <FormField control={editUserForm.control} name="uplineUid" render={({ field }) => (<FormItem><FormLabel>Upline (Líder Direto)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || isSubmittingAction}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o upline" /></SelectTrigger></FormControl><SelectContent>{initialUsers.filter(u => u.uid !== selectedUser.uid).map(u => <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                    </>)}
                </CardContent></Card>


                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditUserModalOpen(false)} disabled={isSubmittingAction}>
                    {canEdit ? 'Cancelar' : 'Fechar'}
                  </Button>
                  {canEdit && (
                    <Button type="submit" disabled={isSubmittingAction}>
                      {isSubmittingAction && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                      Salvar Alterações
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {selectedWithdrawal && (<Dialog open={isUpdateWithdrawalModalOpen} onOpenChange={setIsUpdateWithdrawalModalOpen}><DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border text-foreground"><DialogHeader><DialogTitle className="text-primary">Processar Solicitação de Saque</DialogTitle><DialogDescription>ID: {selectedWithdrawal.id}</DialogDescription></DialogHeader><div className="py-2 text-sm"><p><strong>Usuário:</strong> {selectedWithdrawal.userName || selectedWithdrawal.userEmail}</p><p><strong>Valor:</strong> {formatCurrency(selectedWithdrawal.amount)} ({selectedWithdrawal.withdrawalType})</p><p><strong>PIX:</strong> {selectedWithdrawal.pixKeyType} - {selectedWithdrawal.pixKey}</p><p><strong>Solicitado em:</strong> {selectedWithdrawal.requestedAt ? format(parseISO(selectedWithdrawal.requestedAt as string), "dd/MM/yyyy HH:mm") : 'N/A'}</p></div><Form {...updateWithdrawalForm}><form onSubmit={updateWithdrawalForm.handleSubmit(handleUpdateWithdrawal)} className="space-y-4 pt-2"><FormField control={updateWithdrawalForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>Novo Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl><SelectContent>{WITHDRAWAL_STATUSES_ADMIN.map(status => (<SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={updateWithdrawalForm.control} name="adminNotes" render={({ field }) => (<FormItem><FormLabel>Notas do Admin (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Pagamento efetuado" {...field} /></FormControl><FormMessage /></FormItem>)} /><CardFooter><Button type="button" variant="outline" onClick={() => setIsUpdateWithdrawalModalOpen(false)} disabled={isSubmittingAction}>Cancelar</Button><Button type="submit" disabled={isSubmittingAction}>{isSubmittingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Atualizar Status</Button></CardFooter></form></Form></DialogContent></Dialog>)}
      
      <AlertDialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Redefinição de Senha</AlertDialogTitle><AlertDialogDescription>Um email será enviado para <strong>{selectedUser?.email}</strong> com instruções para criar uma nova senha. O usuário será desconectado de todas as sessões ativas. Deseja continuar?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmittingAction}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleConfirmResetPassword} disabled={isSubmittingAction}>{isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar Email</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário{' '}
                <strong className="text-foreground">{userToDelete?.displayName}</strong> ({userToDelete?.email}) e
                reatribuirá todos os seus leads para "Sistema".
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isSubmittingAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleConfirmDelete}
                disabled={isSubmittingAction}
            >
                {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sim, Excluir Usuário
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
