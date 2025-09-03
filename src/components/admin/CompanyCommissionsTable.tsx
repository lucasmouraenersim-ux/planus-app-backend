// src/components/admin/CompanyCommissionsTable.tsx
"use client";

import { useMemo, useState, useEffect } from 'react';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '../ui/badge';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';

interface CompanyCommissionsTableProps {
  leads: LeadWithId[];
  allUsers: FirestoreUser[];
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const EMPRESA_OPTIONS = ['Bowe', 'Origo', 'BC', 'Matrix'];

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
  recorrenciaComissao: number;
  recorrenciaCaixa: number;
}

export default function CompanyCommissionsTable({ leads, allUsers }: CompanyCommissionsTableProps) {
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.uid, u])), [allUsers]);

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
    
  useEffect(() => {
    const finalizedLeads = leads.filter(lead => lead.stageId === 'finalizado');
    const initialData = finalizedLeads.map(lead => {
        const desagilInitial = lead.discountPercentage || 0;
        const proposta = lead.valueAfterDiscount || 0;
        const comissaoPromotorInitial = calculateCommission(proposta, desagilInitial, lead.userId);

        return {
            id: lead.id,
            promotor: lead.sellerName || 'N/A',
            promotorId: lead.userId,
            cliente: lead.name,
            status: lead.stageId,
            empresa: lead.concessionaria || 'N/A',
            kwh: lead.kwh || 0,
            proposta: proposta,
            desagil: desagilInitial,
            comissaoImediata: 0, // Placeholder
            dataComissaoImediata: "3 dias depois",
            segundaComissao: 0, // Placeholder
            dataSegundaComissao: "45 dias depois",
            terceiraComissao: 0, // Placeholder
            dataTerceiraComissao: "4 meses depois",
            quartaComissao: 0, // Placeholder
            dataQuartaComissao: "6 meses depois",
            comissaoTotal: comissaoPromotorInitial,
            comissaoPromotor: comissaoPromotorInitial,
            lucroBruto: (lead.value || 0) - proposta,
            lucroLiq: ((lead.value || 0) - proposta) * 0.7,
            jurosPerc: "12%", // Placeholder
            jurosRS: ((lead.value || 0) - proposta) * 0.12,
            garantiaChurn: 0, // Placeholder
            comercializador: 0, // Placeholder
            nota: 0, // Placeholder
            recorrenciaComissao: 0, // Placeholder
            recorrenciaCaixa: 0, // Placeholder
        };
    });
    setTableData(initialData);
  }, [leads, userMap]);

  const handleDesagilChange = (leadId: string, newDesagilValue: string) => {
    const newDesagilPercent = parseFloat(newDesagilValue) || 0;
    setTableData(currentData =>
      currentData.map(row => {
        if (row.id === leadId) {
          const newCommission = calculateCommission(row.proposta, newDesagilPercent, row.promotorId);
          return { 
            ...row, 
            desagil: newDesagilPercent,
            comissaoPromotor: newCommission,
            // You might want to update comissaoTotal and its installments here as well
            comissaoTotal: newCommission,
          };
        }
        return row;
      })
    );
  };
    
  const getStageBadgeStyle = (stageId: string) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  const handleCompanyChange = async (leadId: string, newCompany: string) => {
    console.log(`Updating lead ${leadId} company to ${newCompany}`);
    // Example: await updateCrmLeadDetails(leadId, { concessionaria: newCompany });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comissões por Empresas</CardTitle>
        <CardDescription>
          Visão detalhada das propostas de energia e pagamentos de comissões associados (baseado em leads finalizados).
        </CardDescription>
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
                <TableHead>2ª Comissão (R$)</TableHead>
                <TableHead>Data.1</TableHead>
                <TableHead>3ª Comissão (R$)</TableHead>
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
                <TableHead>Recorrência Caixa (R$)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tableData.length > 0 ? tableData.map((row) => (
                <TableRow key={row.id}>
                    <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.promotor}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell><Badge className={getStageBadgeStyle(row.status as any)}>{STAGES_CONFIG.find(s => s.id === row.status)?.title || row.status}</Badge></TableCell>
                    <TableCell>
                        <Select
                            defaultValue={EMPRESA_OPTIONS.includes(row.empresa) ? row.empresa : undefined}
                            onValueChange={(value) => handleCompanyChange(row.id, value)}
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
                            onChange={(e) => handleDesagilChange(row.id, e.target.value)}
                            className="h-8 text-right"
                        />
                    </TableCell>
                    <TableCell>{formatCurrency(row.comissaoImediata)}</TableCell>
                    <TableCell>{row.dataComissaoImediata}</TableCell>
                    <TableCell>{formatCurrency(row.segundaComissao)}</TableCell>
                    <TableCell>{row.dataSegundaComissao}</TableCell>
                    <TableCell>{formatCurrency(row.terceiraComissao)}</TableCell>
                    <TableCell>{row.dataTerceiraComissao}</TableCell>
                    <TableCell>{formatCurrency(row.quartaComissao)}</TableCell>
                    <TableCell>{row.dataQuartaComissao}</TableCell>
                    <TableCell>{formatCurrency(row.comissaoTotal)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCurrency(row.comissaoPromotor)}</TableCell>
                    <TableCell>{formatCurrency(row.lucroBruto)}</TableCell>
                    <TableCell>{formatCurrency(row.lucroLiq)}</TableCell>
                    <TableCell>{row.jurosPerc}</TableCell>
                    <TableCell>{formatCurrency(row.jurosRS)}</TableCell>
                    <TableCell>{formatCurrency(row.garantiaChurn)}</TableCell>
                    <TableCell>{formatCurrency(row.comercializador)}</TableCell>
                    <TableCell>{row.nota}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>{formatCurrency(row.recorrenciaComissao)}</TableCell>
                    <TableCell>{formatCurrency(row.recorrenciaCaixa)}</TableCell>
                </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={26} className="h-24 text-center">Nenhum lead finalizado encontrado para exibir.</TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
