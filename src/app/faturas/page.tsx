
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, PlusCircle, Trash2, Upload, Download, Eye, Loader2, User as UserIcon, Phone, Filter as FilterIcon, ArrowUpDown, Zap, MessageSquare, UserCheck, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, arrayUnion, arrayRemove, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { FaturaCliente, UnidadeConsumidora, Contato, FaturaStatus, TensaoType } from '@/types/faturas';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';

const FATURA_STATUS_OPTIONS: FaturaStatus[] = ['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'];
const TENSAO_OPTIONS: { value: TensaoType; label: string }[] = [
    { value: 'baixa', label: 'Baixa Tensão' },
    { value: 'alta', label: 'Alta Tensão' },
    { value: 'b_optante', label: 'B Optante' },
    { value: 'baixa_renda', label: 'Baixa Renda' },
];

const getStatusStyle = (status?: FaturaStatus) => {
    switch (status) {
        case 'Contato?': return { badge: 'bg-sky-500/80', border: 'border-l-sky-500' };
        case 'Proposta': return { badge: 'bg-indigo-500/80', border: 'border-l-indigo-500' };
        case 'Fechamento': return { badge: 'bg-purple-500/80', border: 'border-l-purple-500' };
        case 'Fechado': return { badge: 'bg-green-500/80', border: 'border-l-green-500' };
        default: return { badge: 'bg-muted', border: 'border-l-transparent' };
    }
};

export default function FaturasPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [clientes, setClientes] = useState<FaturaCliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // State for filters
  const [filterTensao, setFilterTensao] = useState<TensaoType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  useEffect(() => {
    const faturasCollectionRef = collection(db, 'faturas_clientes');
    const q = query(faturasCollectionRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faturasData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
            lastUpdatedAt: data.lastUpdatedAt ? (data.lastUpdatedAt as Timestamp).toDate().toISOString() : undefined,
          }
        }) as FaturaCliente[];
      setClientes(faturasData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching faturas: ", error);
      toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar os dados do Firestore.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const filteredAndSortedClientes = useMemo(() => {
    let filtered = clientes;

    // Filter by tension
    if (filterTensao !== 'all') {
      filtered = filtered.filter(cliente => cliente.tensao === filterTensao);
    }
    
    // Sort by kWh
    if (sortOrder !== 'none') {
        filtered.sort((a, b) => {
            const totalConsumoA = a.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
            const totalConsumoB = b.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
            if (sortOrder === 'asc') {
                return totalConsumoA - totalConsumoB;
            } else {
                return totalConsumoB - totalConsumoA;
            }
        });
    }

    return filtered;
  }, [clientes, filterTensao, sortOrder]);

  const { totalKwhAlta, totalKwhBaixa, totalKwhBOptante, totalKwhBaixaRenda } = useMemo(() => {
    let totals: Record<TensaoType, number> = { alta: 0, baixa: 0, b_optante: 0, baixa_renda: 0 };

    clientes.forEach(cliente => {
      const clienteKwh = cliente.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
      if (totals[cliente.tensao] !== undefined) {
        totals[cliente.tensao] += clienteKwh;
      }
    });

    return { 
      totalKwhAlta: totals.alta, 
      totalKwhBaixa: totals.baixa, 
      totalKwhBOptante: totals.b_optante, 
      totalKwhBaixaRenda: totals.baixa_renda 
    };
  }, [clientes]);


  const handleAddCliente = async () => {
    const newUnidade: UnidadeConsumidora = {
      id: crypto.randomUUID(),
      consumoKwh: '',
      temGeracao: false,
      arquivoFaturaUrl: null,
      nomeArquivo: null,
    };
    const newContato: Contato = {
      id: crypto.randomUUID(),
      nome: '',
      telefone: '',
    };
    const newClienteData: Omit<FaturaCliente, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      nome: 'Novo Cliente',
      tipoPessoa: '' as 'pf' | 'pj',
      tensao: 'baixa', // Default to baixa
      unidades: [newUnidade],
      contatos: [newContato],
      createdAt: Timestamp.now(),
      status: 'Nenhum',
      feedbackNotes: '',
    };
    try {
      await addDoc(collection(db, 'faturas_clientes'), newClienteData);
      toast({ title: "Cliente Adicionado", description: "Um novo cliente foi criado com sucesso." });
    } catch (error) {
      console.error("Error adding document: ", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o cliente.", variant: "destructive" });
    }
  };

  const handleRemoveCliente = async (clienteId: string) => {
    try {
      await deleteDoc(doc(db, 'faturas_clientes', clienteId));
      toast({ title: "Cliente Removido", description: "O cliente e todos os seus dados foram removidos." });
    } catch (error) {
      console.error("Error removing document: ", error);
      toast({ title: "Erro", description: "Não foi possível remover o cliente.", variant: "destructive" });
    }
  };
  
  const handleUpdateField = async (clienteId: string, fieldPath: string, value: any) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    try {
      const updates: { [key: string]: any } = { [fieldPath]: value };
      if (fieldPath === 'status' || fieldPath === 'feedbackNotes' || fieldPath === 'feedbackAttachmentUrl') {
        updates.lastUpdatedAt = Timestamp.now();
        if (appUser) {
          updates.lastUpdatedBy = { uid: appUser.uid, name: appUser.displayName || appUser.email || 'N/A' };
        }
      }
      await updateDoc(clienteDocRef, updates);
    } catch (error) {
      console.error(`Error updating field ${fieldPath}: `, error);
      toast({ title: "Erro ao Salvar", description: "Não foi possível salvar a alteração.", variant: "destructive" });
    }
  };

  const handleAddUnidade = async (clienteId: string) => {
    const newUnidade: UnidadeConsumidora = {
      id: crypto.randomUUID(),
      consumoKwh: '',
      temGeracao: false,
      arquivoFaturaUrl: null,
      nomeArquivo: null,
    };
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { unidades: arrayUnion(newUnidade) });
  };

  const handleRemoveUnidade = async (clienteId: string, unidade: UnidadeConsumidora) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { unidades: arrayRemove(unidade) });
  };
  
  const handleAddContato = async (clienteId: string) => {
    const newContato: Contato = { id: crypto.randomUUID(), nome: '', telefone: '' };
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { contatos: arrayUnion(newContato) });
  };

  const handleRemoveContato = async (clienteId: string, contato: Contato) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { contatos: arrayRemove(contato) });
  };

  const handleFileChange = async (clienteId: string, unidadeId: string, file: File | null) => {
    if (!file) return;

    toast({ title: "Enviando arquivo...", description: "Aguarde enquanto a fatura é salva." });
    try {
      const filePath = `faturas/${clienteId}/${unidadeId}/${file.name}`;
      const fileUrl = await uploadFile(file, filePath);
      
      const cliente = clientes.find(c => c.id === clienteId);
      if (cliente) {
        const novasUnidades = cliente.unidades.map(u => 
          u.id === unidadeId ? { ...u, arquivoFaturaUrl: fileUrl, nomeArquivo: file.name } : u
        );
        await handleUpdateField(clienteId, 'unidades', novasUnidades);
        toast({ title: "Sucesso!", description: "Fatura enviada e salva com sucesso." });
      }
    } catch (error) {
      console.error("File upload error: ", error);
      toast({ title: "Erro de Upload", description: "Não foi possível enviar o arquivo da fatura.", variant: "destructive" });
    }
  };

  const handleFeedbackFileChange = async (clienteId: string, file: File | null) => {
    if (!file) return;
    toast({ title: "Enviando comprovante...", description: "Aguarde enquanto o arquivo é salvo." });
    try {
      const filePath = `faturas_feedback/${clienteId}/${Date.now()}_${file.name}`;
      const fileUrl = await uploadFile(file, filePath);
      await handleUpdateField(clienteId, 'feedbackAttachmentUrl', fileUrl);
      toast({ title: "Sucesso!", description: "Comprovante de feedback enviado." });
    } catch (error) {
      console.error("Feedback file upload error: ", error);
      toast({ title: "Erro de Upload", description: "Não foi possível enviar o comprovante.", variant: "destructive" });
    }
  };


  const handleDownload = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const handleView = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank');
  };
  
  const toggleExpand = (clienteId: string) => {
    setExpandedClientId(currentId => currentId === clienteId ? null : clienteId);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-lg">Carregando dados das faturas...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold text-primary">
            <FileText className="mr-3 h-6 w-6" />
            Gerenciamento de Faturas
          </CardTitle>
          <CardDescription>
            Adicione clientes e gerencie as faturas e o consumo de suas unidades consumidoras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dashboard Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Alta Tensão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-300 flex items-center">
                  <Zap className="h-6 w-6 mr-2" />
                  {totalKwhAlta.toLocaleString('pt-BR')} kWh
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Baixa Tensão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-800 dark:text-green-300 flex items-center">
                  <Zap className="h-6 w-6 mr-2" />
                  {totalKwhBaixa.toLocaleString('pt-BR')} kWh
                </div>
              </CardContent>
            </Card>
             <Card className="bg-orange-500/10 border-orange-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">B Optante</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-800 dark:text-orange-300 flex items-center">
                  <Zap className="h-6 w-6 mr-2" />
                  {totalKwhBOptante.toLocaleString('pt-BR')} kWh
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Baixa Renda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300 flex items-center">
                  <Zap className="h-6 w-6 mr-2" />
                  {totalKwhBaixaRenda.toLocaleString('pt-BR')} kWh
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Section */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <Label>Filtrar por Tensão:</Label>
                <Select value={filterTensao} onValueChange={(value: TensaoType | 'all') => setFilterTensao(value)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TENSAO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Label>Ordenar por Consumo:</Label>
                <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc' | 'none') => setSortOrder(value)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão</SelectItem>
                    <SelectItem value="desc">Maior para Menor</SelectItem>
                    <SelectItem value="asc">Menor para Menor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px] p-2"></TableHead>
                        <TableHead className="p-2">Cliente</TableHead>
                        <TableHead className="p-2">Consumo Total</TableHead>
                        <TableHead className="p-2">Telefone Principal</TableHead>
                        <TableHead className="p-2">Tem GD</TableHead>
                        <TableHead className="p-2">Tensão</TableHead>
                        <TableHead className="p-2">Status</TableHead>
                        <TableHead className="p-2">Última Interação</TableHead>
                        <TableHead className="text-right p-2">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAndSortedClientes.length > 0 ? (
                        filteredAndSortedClientes.map(cliente => {
                            const totalConsumo = cliente.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
                            const hasGd = cliente.unidades.some(u => u.temGeracao);
                            const isExpanded = expandedClientId === cliente.id;
                            const statusStyles = getStatusStyle(cliente.status);
                            const tensaoLabel = TENSAO_OPTIONS.find(opt => opt.value === cliente.tensao)?.label || cliente.tensao;

                            return (
                                <React.Fragment key={cliente.id}>
                                    <TableRow onClick={() => toggleExpand(cliente.id)} className={`cursor-pointer hover:bg-muted/50 border-l-4 ${statusStyles.border}`}>
                                        <TableCell className="p-2 text-sm">
                                            <Button variant="ghost" size="icon">
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="p-2 font-medium text-sm">
                                            {cliente.tensao === 'alta' ? 'A - ' : 'B - '}
                                            {cliente.nome || <span className="italic text-muted-foreground">Novo Cliente</span>}
                                        </TableCell>
                                        <TableCell className="p-2 text-sm">{totalConsumo.toLocaleString('pt-BR')} kWh</TableCell>
                                        <TableCell className="p-2 text-sm">{cliente.contatos[0]?.telefone || 'N/A'}</TableCell>
                                        <TableCell className="p-2 text-sm">{hasGd ? 'Sim' : 'Não'}</TableCell>
                                        <TableCell className="p-2 text-sm">{tensaoLabel}</TableCell>
                                        <TableCell className="p-2 text-sm"><span className={`px-2 py-1 text-xs rounded-full text-white ${statusStyles.badge}`}>{cliente.status || 'Nenhum'}</span></TableCell>
                                        <TableCell className="p-2 text-sm">
                                            {cliente.lastUpdatedBy ? (
                                                <div className="flex flex-col text-xs">
                                                    <span className="font-medium">{cliente.lastUpdatedBy.name}</span>
                                                    <span className="text-muted-foreground">{cliente.lastUpdatedAt ? new Date(cliente.lastUpdatedAt).toLocaleString('pt-BR') : ''}</span>
                                                </div>
                                            ) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="p-2 text-right">
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveCliente(cliente.id); }}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="p-0">
                                                <div className="p-4 bg-muted/30">
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                                    <Input placeholder="Nome do cliente" defaultValue={cliente.nome} onBlur={(e) => handleUpdateField(cliente.id, 'nome', e.target.value)} />
                                                    <Select value={cliente.tipoPessoa} onValueChange={(value: 'pf' | 'pj' | '') => handleUpdateField(cliente.id, 'tipoPessoa', value)}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent><SelectItem value="pf">PF</SelectItem><SelectItem value="pj">PJ</SelectItem></SelectContent></Select>
                                                    <Select value={cliente.tensao} onValueChange={(value: TensaoType) => handleUpdateField(cliente.id, 'tensao', value)}><SelectTrigger><SelectValue placeholder="Selecione a Tensão" /></SelectTrigger><SelectContent>{TENSAO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select>
                                                  </div>
                                                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Contatos</h4>
                                                  <div className="space-y-3 mb-6">
                                                      {cliente.contatos.map((contato) => (
                                                        <div key={contato.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 border rounded bg-background">
                                                          <div className="md:col-span-5 flex items-center"><UserIcon className="h-4 w-4 mr-2 text-muted-foreground"/><Input placeholder="Nome do Contato" defaultValue={contato.nome} onBlur={(e) => { const updatedContatos = cliente.contatos.map((c) => c.id === contato.id ? { ...c, nome: e.target.value } : c); handleUpdateField(cliente.id, 'contatos', updatedContatos); }} /></div>
                                                          <div className="md:col-span-6 flex items-center"><Phone className="h-4 w-4 mr-2 text-muted-foreground"/><Input placeholder="Telefone" defaultValue={contato.telefone} onBlur={(e) => { const updatedContatos = cliente.contatos.map((c) => c.id === contato.id ? { ...c, telefone: e.target.value } : c); handleUpdateField(cliente.id, 'contatos', updatedContatos); }}/></div>
                                                          <div className="md:col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => handleRemoveContato(cliente.id, contato)} disabled={cliente.contatos.length <= 1}><Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" /></Button></div>
                                                        </div>))}
                                                      <Button onClick={() => handleAddContato(cliente.id)} className="mt-2" variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" />Adicionar Contato</Button>
                                                  </div>
                                                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Unidades Consumidoras</h4>
                                                  <div className="space-y-3">
                                                      {cliente.unidades.map((unidade, ucIndex) => (
                                                        <div key={unidade.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 border rounded bg-background">
                                                          <span className="md:col-span-1 text-center font-semibold text-muted-foreground">UC {ucIndex + 1}</span>
                                                          <div className="md:col-span-3"><Input type="number" placeholder="Consumo (kWh)" defaultValue={unidade.consumoKwh} onBlur={(e) => { const updatedUnidades = cliente.unidades.map((u) => u.id === unidade.id ? { ...u, consumoKwh: e.target.value } : u); handleUpdateField(cliente.id, 'unidades', updatedUnidades); }}/></div>
                                                          <div className="md:col-span-2 flex items-center justify-center gap-2"><Checkbox checked={unidade.temGeracao} onCheckedChange={(checked) => { const updatedUnidades = cliente.unidades.map((u) => u.id === unidade.id ? { ...u, temGeracao: !!checked } : u); handleUpdateField(cliente.id, 'unidades', updatedUnidades); }} id={`gen-${cliente.id}-${ucIndex}`}/><label htmlFor={`gen-${cliente.id}-${ucIndex}`} className="text-sm">Tem Geração?</label></div>
                                                          <div className="md:col-span-2"><Button asChild variant="outline" size="sm" className="w-full"><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{unidade.arquivoFaturaUrl ? 'Trocar' : 'Anexar'}<Input type="file" className="hidden" onChange={(e) => handleFileChange(cliente.id, unidade.id, e.target.files ? e.target.files[0] : null)} /></label></Button></div>
                                                          <div className="md:col-span-3 flex items-center justify-end gap-1">{unidade.arquivoFaturaUrl && (<><Button variant="ghost" size="icon" onClick={() => handleView(unidade.arquivoFaturaUrl)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDownload(unidade.arquivoFaturaUrl)}><Download className="h-4 w-4" /></Button></>)}<Button variant="ghost" size="icon" onClick={() => handleRemoveUnidade(cliente.id, unidade)} disabled={cliente.unidades.length <= 1}><Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" /></Button></div>
                                                        </div>))}
                                                  </div>
                                                  <Button onClick={() => handleAddUnidade(cliente.id)} className="mt-4" variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" />Adicionar UC</Button>
                                                  
                                                  <div className="mt-6 pt-4 border-t">
                                                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground flex items-center"><MessageSquare className="mr-2 h-4 w-4" />Feedback e Status</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <Select value={cliente.status || 'Nenhum'} onValueChange={(value: FaturaStatus) => handleUpdateField(cliente.id, 'status', value)}>
                                                          <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                                                          <SelectContent>{FATURA_STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                        <div className="md:col-span-2">
                                                          <Textarea placeholder="Adicione notas de feedback aqui..." defaultValue={cliente.feedbackNotes} onBlur={(e) => handleUpdateField(cliente.id, 'feedbackNotes', e.target.value)}/>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex items-center gap-4">
                                                        <Button asChild variant="outline" size="sm">
                                                            <label className="cursor-pointer">
                                                                <Paperclip className="mr-2 h-4 w-4" />
                                                                Anexar Comprovante
                                                                <Input type="file" className="hidden" onChange={(e) => handleFeedbackFileChange(cliente.id, e.target.files ? e.target.files[0] : null)} />
                                                            </label>
                                                        </Button>
                                                        {cliente.feedbackAttachmentUrl && (
                                                            <Button variant="secondary" size="sm" onClick={() => handleView(cliente.feedbackAttachmentUrl)}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                Ver Anexo
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {cliente.lastUpdatedBy && (<div className="text-xs text-muted-foreground mt-2 flex items-center"><UserCheck className="mr-2 h-3 w-3"/>Última atualização por <strong className="mx-1">{cliente.lastUpdatedBy.name}</strong> em {cliente.lastUpdatedAt ? new Date(cliente.lastUpdatedAt).toLocaleString('pt-BR') : '...'}</div>)}
                                                  </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">Nenhum cliente encontrado. Clique em "Adicionar Cliente" para começar.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
          
          <Button onClick={handleAddCliente} className="mt-6">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Cliente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
