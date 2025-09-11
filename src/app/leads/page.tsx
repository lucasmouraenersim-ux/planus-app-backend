"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadAndProcessLeads } from './actions';
import type { LeadDisplayData } from './actions';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Database, ShieldAlert, ListFilter } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function LeadsPage() {
  const { userAppRole, isLoadingAuth } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<LeadDisplayData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [filter, setFilter] = useState('');

  const handleFileImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fileInput = e.currentTarget.elements.namedItem('csvFile') as HTMLInputElement;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        toast({ title: "Nenhum Arquivo", description: "Por favor, selecione um arquivo CSV para carregar.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setLeads([]);
    setUploadMessage("Iniciando processamento...");
    
    const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 10 : 90));
    }, 200);

    const result = await uploadAndProcessLeads(formData);
    
    clearInterval(progressInterval);
    setUploadProgress(100);

    if (result.success && result.leads) {
      setLeads(result.leads);
      setUploadMessage(`Importação concluída! ${result.message}`);
      toast({ 
        title: "Sucesso!", 
        description: result.message
      });
    } else {
      setUploadMessage(`Erro: ${result.error}`);
      toast({ title: "Erro na Importação", description: result.error, variant: "destructive" });
    }
    
    setTimeout(() => {
        setIsUploading(false);
    }, 5000);
  };

  const filteredLeads = useMemo(() => {
      if (!filter) return leads;
      return leads.filter(lead => 
          lead.cliente.toLowerCase().includes(filter.toLowerCase()) ||
          lead.estagio.toLowerCase().includes(filter.toLowerCase()) ||
          (lead.telefone || '').includes(filter)
      );
  }, [leads, filter]);

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-56px)] bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando...</p>
      </div>
    );
  }

  if (userAppRole !== 'admin' && userAppRole !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] text-destructive p-4 text-center">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Gestão de Leads Importados</h1>
        <p className="text-muted-foreground mt-2">Importe planilhas e visualize seus contatos em um só lugar.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>1. Importar Planilha</CardTitle>
                <CardDescription>Faça o upload de um arquivo CSV com seus leads.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleFileImport} className="space-y-4">
                    <div>
                        <Label htmlFor="csvFile">Arquivo CSV</Label>
                        <Input id="csvFile" name="csvFile" type="file" accept=".csv" disabled={isUploading} />
                    </div>
                    <Button type="submit" disabled={isUploading} className="w-full">
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? 'Processando...' : 'Importar e Processar'}
                    </Button>
                </form>
                {isUploading && (
                    <div className="mt-4 space-y-2">
                        <Progress value={uploadProgress} />
                        <p className="text-sm text-center text-muted-foreground">{uploadMessage}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">
                    O sistema buscará por colunas como 'Negócio - Pessoa de contato', 'Negócio - Celular Titular', etc.
                </p>
            </CardFooter>
        </Card>

        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>2. Lista de Contatos Importados</CardTitle>
                <CardDescription>
                    {leads.length > 0
                    ? `Exibindo ${filteredLeads.length} de ${leads.length} leads importados nesta sessão.`
                    : "Aguardando importação para exibir os leads."}
                </CardDescription>
                <div className="relative pt-2">
                     <ListFilter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input 
                        placeholder="Filtrar por cliente, estágio ou telefone..."
                        className="pl-8"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                     />
                </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estágio (da planilha)</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Consumo (kWh)</TableHead>
                      <TableHead className="text-right">Média Fatura (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map(lead => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.cliente}</TableCell>
                          <TableCell>{lead.estagio}</TableCell>
                          <TableCell>{lead.telefone || 'N/A'}</TableCell>
                          <TableCell className="text-right">{lead.consumoKwh?.toLocaleString('pt-BR') || 'N/A'}</TableCell>
                          <TableCell className="text-right">{lead.mediaFatura?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            {isUploading ? "Processando..." : "Nenhum lead para exibir."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
