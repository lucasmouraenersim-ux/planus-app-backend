
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { sendBulkWhatsappMessages, type SendBulkWhatsappMessagesOutput, type SendingConfiguration, type OutboundLead } from '@/actions/whatsapp/sendBulkWhatsappMessages';
import { uploadLeadsFromCSV } from './actions';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlayCircle, CheckCircle, AlertCircle, Upload, Database, Download, ShieldAlert, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TEMPLATE_OPTIONS = [
  { value: 'novocontato', label: 'Novo Contato (Reduza até 25%)' },
  { value: 'leadsquentes', label: 'Leads Quentes (Reduza sua conta)' },
];

const TEMPLATE_PREVIEWS: { [key: string]: string } = {
  novocontato: 'https://raw.githubusercontent.com/LucasMouraChaser/apisent/f1998e7c61dee0c48333cf1353725d8fa880ad42/Captura%20de%20tela%202025-06-28%20133600.png',
  leadsquentes: 'https://raw.githubusercontent.com/LucasMouraChaser/apisent/f1998e7c61dee0c48333cf1353725d8fa880ad42/Captura%20de%20tela%202025-06-28%20133756.png',
};

export default function DisparosPage() {
  const { fetchAllCrmLeadsGlobally, userAppRole, isLoadingAuth } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<OutboundLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState("novocontato");
  const [sendingConfig, setSendingConfig] = useState<SendingConfiguration>({
    sendPerChip: 25,
    sendInterval: 10,
    randomDelay: 5,
    restAfterRound: "30-60",
    numberOfSimultaneousWhatsapps: 4,
  });

  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [simulationResult, setSimulationResult] = useState<SendBulkWhatsappMessagesOutput | null>(null);
  const [lastDataSource, setLastDataSource] = useState<'none' | 'crm' | 'csv'>('none');

  const loadLeadsFromCrm = async () => {
    setIsLoadingLeads(true);
    setSimulationResult(null);
    try {
      const allLeads = await fetchAllCrmLeadsGlobally();
      const validLeads = allLeads
        .filter(lead => lead.phone && lead.phone.trim() !== '')
        .map((lead): OutboundLead => ({
            id: lead.id,
            name: lead.name,
            phone: lead.phone!, // The filter ensures phone is not null/empty
            consumption: lead.kwh,
            company: lead.company,
        }));
      setLeads(validLeads);
      setSelectedLeads(new Set());
      setLastDataSource('crm');
    } catch (error) {
      console.error("Failed to load leads:", error);
      toast({
        title: "Erro ao Carregar Leads",
        description: "Não foi possível buscar os leads do CRM. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fileInput = e.currentTarget.elements.namedItem('csvFile') as HTMLInputElement;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        toast({ title: "Nenhum Arquivo", description: "Por favor, selecione um arquivo CSV para carregar.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setSimulationResult(null);
    const result = await uploadLeadsFromCSV(formData);
    
    if (result.success && result.leads) {
      setLeads(result.leads);
      setSelectedLeads(new Set());
      setLastDataSource('csv');
      toast({ 
        title: "Sucesso!", 
        description: `${result.leads.length} leads carregados do arquivo CSV. ${result.info || ''}` 
      });
    } else {
      toast({ title: "Erro no Upload", description: result.error, variant: "destructive" });
    }
    setIsUploading(false);
  };
  
  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,nome,numero\nJoão da Silva,5511999998888\nMaria Souza,5521987654321";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Download Iniciado",
      description: "O arquivo modelo_leads.csv está sendo baixado.",
    });
  };

  const handleSelectLead = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const handleSelectAllLeads = (checked: boolean) => {
    if (checked) {
      const allLeadIds = new Set(leads.map(lead => lead.id));
      setSelectedLeads(allLeadIds);
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSendingConfig(prev => ({
      ...prev,
      [name]: name === 'restAfterRound' ? value : Number(value),
    }));
  };

  const handleStartSending = async () => {
    if (selectedLeads.size === 0 || !templateName) {
      toast({
        title: "Dados Incompletos",
        description: "Selecione ao menos um lead e um template de mensagem.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setProgress(0);
    setSimulationResult(null);
    setStatusText("Iniciando disparos...");

    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 10 : 90));
    }, 500);

    const leadsToSend = leads.filter(lead => selectedLeads.has(lead.id));
    setStatusText(`Preparando para enviar para ${leadsToSend.length} contatos...`);

    try {
      const result = await sendBulkWhatsappMessages({
        leads: leadsToSend,
        templateName: templateName,
        configuration: sendingConfig,
      });
      setSimulationResult(result);
      toast({
        title: "Disparo Finalizado",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error("Bulk send failed:", error);
      toast({
        title: "Erro no Disparo",
        description: "Ocorreu um erro ao executar o disparo em massa.",
        variant: "destructive",
      });
      setSimulationResult({ success: false, message: "O disparo falhou.", sentCount: 0 });
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setIsSending(false);
      setStatusText("Disparo finalizado.");
    }
  };

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
        <h1 className="text-3xl font-bold text-primary">Disparos em Massa via WhatsApp</h1>
        <p className="text-muted-foreground mt-2">Configure e envie mensagens para seus leads usando templates aprovados.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Fonte dos Leads</CardTitle>
              <CardDescription>Carregue leads do CRM ou suba um arquivo CSV.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={loadLeadsFromCrm} disabled={isLoadingLeads || isUploading} className="w-full">
                {isLoadingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Carregar Leads do CRM
              </Button>
            </CardContent>
            <Separator className="my-4" />
            <CardContent>
              <form onSubmit={handleCsvUpload} className="space-y-3">
                <Label htmlFor="csvFile">Ou suba um arquivo CSV</Label>
                <Input id="csvFile" name="csvFile" type="file" accept=".csv" disabled={isLoadingLeads || isUploading} />
                <Button type="submit" disabled={isLoadingLeads || isUploading} className="w-full">
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Carregar do CSV
                </Button>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">O CSV deve ter as colunas: 'nome' e 'numero'.</p>
                    <Button type="button" variant="link" size="sm" onClick={handleDownloadTemplate} className="text-primary p-0 h-auto">
                        <Download className="mr-1 h-3 w-3" />
                        Baixar Modelo
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>2. Template da Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="templateName">Selecione o Template</Label>
                <Select
                  value={templateName}
                  onValueChange={(value) => setTemplateName(value)}
                >
                  <SelectTrigger id="templateName">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {templateName && (
                <div className="pt-4 border-t">
                  <Label className="flex items-center mb-2 text-muted-foreground">
                    <Eye className="mr-2 h-4 w-4" />
                    Pré-visualização do Template
                  </Label>
                  <div className="p-2 border rounded-md bg-muted/30">
                    <Image
                      src={TEMPLATE_PREVIEWS[templateName]}
                      alt={`Preview do template ${templateName}`}
                      width={350}
                      height={200}
                      className="rounded-md object-contain mx-auto"
                      data-ai-hint="whatsapp message preview"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader>
              <CardTitle>3. Configurações de Envio</CardTitle>
              <CardDescription>Ajuste os parâmetros para o disparo.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sendPerChip">Envios por chip</Label>
                <Input id="sendPerChip" name="sendPerChip" type="number" value={sendingConfig.sendPerChip} onChange={handleConfigChange} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sendInterval">Intervalo (s)</Label>
                <Input id="sendInterval" name="sendInterval" type="number" value={sendingConfig.sendInterval} onChange={handleConfigChange} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="randomDelay">Atraso aleatório (s)</Label>
                <Input id="randomDelay" name="randomDelay" type="number" value={sendingConfig.randomDelay} onChange={handleConfigChange} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="restAfterRound">Descanso (min)</Label>
                <Input id="restAfterRound" name="restAfterRound" type="text" value={sendingConfig.restAfterRound} onChange={handleConfigChange} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="numberOfSimultaneousWhatsapps">Nº de WhatsApps simultâneos</Label>
                <Input id="numberOfSimultaneousWhatsapps" name="numberOfSimultaneousWhatsapps" type="number" value={sendingConfig.numberOfSimultaneousWhatsapps} onChange={handleConfigChange} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>4. Seleção de Leads</CardTitle>
              <CardDescription>
                {leads.length > 0
                  ? `${selectedLeads.size} de ${leads.length} leads selecionados da fonte: ${lastDataSource.toUpperCase()}`
                  : "Carregue os leads para visualizá-los aqui."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={leads.length > 0 && selectedLeads.size === leads.length}
                          onCheckedChange={handleSelectAllLeads}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLeads || isUploading ? (
                      <TableRow><TableCell colSpan={3} className="h-24 text-center">Carregando...</TableCell></TableRow>
                    ) : leads.length > 0 ? (
                      leads.map(lead => (
                        <TableRow key={lead.id} data-state={selectedLeads.has(lead.id) && "selected"}>
                          <TableCell><Checkbox checked={selectedLeads.has(lead.id)} onCheckedChange={() => handleSelectLead(lead.id)} /></TableCell>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.phone}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum lead carregado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Execução e Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <Button
                size="lg"
                onClick={handleStartSending}
                disabled={isSending || selectedLeads.size === 0 || !templateName}
                className="w-full"
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-5 w-5" />
                )}
                Iniciar Disparo Real
              </Button>
              {isSending && (
                <div className="space-y-2 pt-4">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{statusText}</p>
                </div>
              )}
              {simulationResult && (
                <Card className={`mt-4 p-4 ${simulationResult.success ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                  <div className="flex items-center justify-center">
                    {simulationResult.success ? <CheckCircle className="h-6 w-6 text-green-500 mr-2" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-2" />}
                    <div>
                      <p className="font-semibold">{simulationResult.message}</p>
                      <p className="text-sm text-muted-foreground">Contatos processados: {simulationResult.sentCount} de {selectedLeads.size}</p>
                    </div>
                  </div>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
