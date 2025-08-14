
"use client";

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2 } from 'lucide-react';

function ForexOperationsPage() {
  // Placeholder data
  const operations = [
    { id: '1', date: '2024-07-29', loteSize: 0.1, resultUSD: 150.50, status: 'Fechada' },
    { id: '2', date: '2024-07-28', loteSize: 0.2, resultUSD: -75.20, status: 'Fechada' },
    { id: '3', date: '2024-07-29', loteSize: 0.15, resultUSD: undefined, status: 'Aberta' },
  ];
  
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return <span className="text-muted-foreground">N/A</span>;
    return <span className={value >= 0 ? 'text-green-500' : 'text-red-500'}>{value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}</span>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            Minhas Operações
          </h1>
          <p className="text-muted-foreground mt-1">Registre e acompanhe seu histórico de operações.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <Button><PlusCircle className="mr-2 h-4 w-4" /> Nova Operação</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Operações</CardTitle>
          <CardDescription>Todas as suas operações registradas, da mais recente para a mais antiga.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Lucro/Prejuízo (USD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>{op.date}</TableCell>
                  <TableCell>{op.loteSize}</TableCell>
                  <TableCell>{formatCurrency(op.resultUSD)}</TableCell>
                  <TableCell>{op.status}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="outline" size="sm">Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}

export default function ForexInvestOperationsPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando Operações...</p>
        </div>
    }>
        <ForexOperationsPage />
    </Suspense>
  )
}
