// src/components/admin/CompanyCommissionsTable.tsx
"use client";

import { useMemo } from 'react';
import type { LeadWithId } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '../ui/badge';
import { STAGES_CONFIG } from '@/config/crm-stages';

interface CompanyCommissionsTableProps {
  leads: LeadWithId[];
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function CompanyCommissionsTable({ leads }: CompanyCommissionsTableProps) {
    
  const getStageBadgeStyle = (stageId: LeadWithId['stageId']) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  const tableData = useMemo(() => {
    // Filtra apenas os leads com status 'finalizado'
    const finalizedLeads = leads.filter(lead => lead.stageId === 'finalizado');

    return finalizedLeads.map(lead => {
        // Exemplo de cálculo: Comissão total de 40% sobre o valor da proposta.
        // Este cálculo pode ser ajustado conforme as regras de negócio reais.
        const comissaoTotal = (lead.valueAfterDiscount || 0) * 0.40; 
        
        return {
            // Dados reais do Lead
            promotor: lead.sellerName || 'N/A',
            cliente: lead.name,
            status: lead.stageId,
            empresa: lead.concessionaria || 'N/A',
            kwh: lead.kwh || 0,
            proposta: lead.valueAfterDiscount || 0,
            desagil: `${(lead.discountPercentage || 0).toFixed(1)}%`,
            
            // Dados de placeholder para preenchimento manual futuro
            comissaoImediata: comissaoTotal * 0.5, // Exemplo: 50% da comissão total
            dataComissaoImediata: "3 dias depois",
            segundaComissao: comissaoTotal * 0.25, // Exemplo: 25% da comissão total
            dataSegundaComissao: "45 dias depois",
            terceiraComissao: comissaoTotal * 0.25, // Exemplo: 25% da comissão total
            dataTerceiraComissao: "4 meses depois",
            quartaComissao: 0, // Placeholder
            dataQuartaComissao: "6 meses depois",
            comissaoTotal: comissaoTotal,
            comissaoPromotor: comissaoTotal, // Assumindo que a comissão total vai para o promotor

            // Detalhes financeiros (placeholders)
            lucroBruto: (lead.value || 0) - (lead.valueAfterDiscount || 0), // Exemplo simples de lucro
            lucroLiq: ((lead.value || 0) - (lead.valueAfterDiscount || 0)) * 0.7, // Exemplo com impostos
            jurosPerc: "12%", // Placeholder
            jurosRS: ((lead.value || 0) - (lead.valueAfterDiscount || 0)) * 0.12, // Exemplo
            garantiaChurn: 0, // Placeholder
            comercializador: 0, // Placeholder
            nota: 0, // Placeholder
            recorrenciaComissao: 0, // Placeholder
            recorrenciaCaixa: 0, // Placeholder
        }
    });
  }, [leads]);

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
                {/* Proposta Info */}
                <TableHead className="sticky left-0 bg-card z-10">Promotor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Kwh</TableHead>
                <TableHead>Proposta (R$)</TableHead>
                <TableHead>Deságio (%)</TableHead>
                
                {/* Comissões */}
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

                {/* Detalhes Financeiros */}
                <TableHead>Lucro Bruto (R$)</TableHead>
                <TableHead>Lucro Líquido (R$)</TableHead>
                <TableHead>Juros (%)</TableHead>
                <TableHead>Juros (R$)</TableHead>
                <TableHead>Garantia Churn (R$)</TableHead>
                <TableHead>Comercializador (R$)</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Data.4</TableHead>

                {/* Recorrência */}
                <TableHead>Recorrência Comissão (R$)</TableHead>
                <TableHead>Recorrência Caixa (R$)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tableData.length > 0 ? tableData.map((row, index) => (
                <TableRow key={index}>
                    <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.promotor}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell><Badge className={getStageBadgeStyle(row.status as any)}>{STAGES_CONFIG.find(s => s.id === row.status)?.title || row.status}</Badge></TableCell>
                    <TableCell>{row.empresa}</TableCell>
                    <TableCell>{row.kwh.toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{formatCurrency(row.proposta)}</TableCell>
                    <TableCell>{row.desagil}</TableCell>
                    <TableCell>{formatCurrency(row.comissaoImediata)}</TableCell>
                    <TableCell>{row.dataComissaoImediata}</TableCell>
                    <TableCell>{formatCurrency(row.segundaComissao)}</TableCell>
                    <TableCell>{row.dataSegundaComissao}</TableCell>
                    <TableCell>{formatCurrency(row.terceiraComissao)}</TableCell>
                    <TableCell>{row.dataTerceiraComissao}</TableCell>
                    <TableCell>{formatCurrency(row.quartaComissao)}</TableCell>
                    <TableCell>{row.dataQuartaComissao}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCurrency(row.comissaoTotal)}</TableCell>
                    <TableCell>{formatCurrency(row.comissaoPromotor)}</TableCell>
                    <TableCell>{formatCurrency(row.lucroBruto)}</TableCell>
                    <TableCell>{formatCurrency(row.lucroLiq)}</TableCell>
                    <TableCell>{row.jurosPerc}</TableCell>
                    <TableCell>{formatCurrency(row.jurosRS)}</TableCell>
                    <TableCell>{formatCurrency(row.garantiaChurn)}</TableCell>
                    <TableCell>{formatCurrency(row.comercializador)}</TableCell>
                    <TableCell>{row.nota}</TableCell>
                    <TableCell></TableCell> {/* Data.4 is empty */}
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
