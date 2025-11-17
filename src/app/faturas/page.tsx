"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, PlusCircle, Trash2, Upload, Download, Eye, ChevronDown } from 'lucide-react';

// Defines an individual invoice or consumer unit
interface UnidadeConsumidora {
  id: string;
  consumoKwh: string;
  temGeracao: boolean;
  arquivoFatura: File | null;
}

// Defines a client, who can have multiple consumer units
interface ClienteFatura {
  id: string;
  nome: string;
  tipoPessoa: 'pf' | 'pj' | '';
  unidades: UnidadeConsumidora[];
}

export default function FaturasPage() {
  const [clientes, setClientes] = useState<ClienteFatura[]>([]);
  const [nextId, setNextId] = useState(1);

  const handleAddCliente = () => {
    const newCliente: ClienteFatura = {
      id: `cliente-${nextId}`,
      nome: '',
      tipoPessoa: '',
      unidades: [
        {
          id: `uc-${nextId}-1`,
          consumoKwh: '',
          temGeracao: false,
          arquivoFatura: null,
        },
      ],
    };
    setClientes([...clientes, newCliente]);
    setNextId(nextId + 1);
  };

  const handleRemoveCliente = (clienteId: string) => {
    setClientes(clientes.filter(c => c.id !== clienteId));
  };
  
  const handleClienteInputChange = (clienteId: string, field: keyof ClienteFatura, value: any) => {
    setClientes(clientes.map(c => (c.id === clienteId ? { ...c, [field]: value } : c)));
  };

  const handleAddUnidade = (clienteId: string) => {
    setClientes(clientes.map(c => {
      if (c.id === clienteId) {
        const newUnidade: UnidadeConsumidora = {
          id: `uc-${c.id}-${c.unidades.length + 1}`,
          consumoKwh: '',
          temGeracao: false,
          arquivoFatura: null,
        };
        return { ...c, unidades: [...c.unidades, newUnidade] };
      }
      return c;
    }));
  };

  const handleRemoveUnidade = (clienteId: string, unidadeId: string) => {
    setClientes(clientes.map(c => {
      if (c.id === clienteId) {
        // Prevent removing the last unit
        if (c.unidades.length <= 1) return c;
        return { ...c, unidades: c.unidades.filter(u => u.id !== unidadeId) };
      }
      return c;
    }));
  };

  const handleUnidadeInputChange = (clienteId: string, unidadeId: string, field: keyof UnidadeConsumidora, value: any) => {
    setClientes(clientes.map(c => {
      if (c.id === clienteId) {
        const novasUnidades = c.unidades.map(u => u.id === unidadeId ? { ...u, [field]: value } : u);
        return { ...c, unidades: novasUnidades };
      }
      return c;
    }));
  };

  const handleFileChange = (clienteId: string, unidadeId: string, file: File | null) => {
    handleUnidadeInputChange(clienteId, unidadeId, 'arquivoFatura', file);
  };

  const handleDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleView = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  };

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
          <Accordion type="multiple" className="w-full space-y-2">
            {clientes.length > 0 ? (
              clientes.map((cliente, index) => {
                const totalConsumo = cliente.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
                return (
                  <AccordionItem key={cliente.id} value={cliente.id} className="border-b-0">
                    <Card className="overflow-hidden">
                      <div className="flex items-center pr-4">
                        <AccordionTrigger className="flex-1 p-4 text-left font-medium text-lg hover:no-underline">
                           <div className="flex flex-col md:flex-row md:items-center md:gap-4 w-full">
                                <span className="flex-1 min-w-0 truncate" title={cliente.nome || "Novo Cliente"}>
                                  {index + 1}. {cliente.nome || <span className="italic text-muted-foreground">Novo Cliente</span>}
                                </span>
                                <span className="text-sm font-normal text-muted-foreground md:border-l md:pl-4">
                                  Total: <span className="font-semibold text-primary">{totalConsumo.toLocaleString('pt-BR')} kWh</span>
                                </span>
                           </div>
                        </AccordionTrigger>
                         <Button variant="ghost" size="icon" onClick={() => handleRemoveCliente(cliente.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="p-4 border-t bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input
                              placeholder="Nome do cliente"
                              value={cliente.nome}
                              onChange={(e) => handleClienteInputChange(cliente.id, 'nome', e.target.value)}
                            />
                            <Select
                              value={cliente.tipoPessoa}
                              onValueChange={(value: 'pf' | 'pj' | '') => handleClienteInputChange(cliente.id, 'tipoPessoa', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pf">PF</SelectItem>
                                <SelectItem value="pj">PJ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Unidades Consumidoras</h4>
                          <div className="space-y-3">
                            {cliente.unidades.map((unidade, ucIndex) => (
                              <div key={unidade.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 border rounded bg-background">
                                <span className="md:col-span-1 text-center font-semibold text-muted-foreground">UC {ucIndex + 1}</span>
                                <div className="md:col-span-3">
                                  <Input
                                      type="number"
                                      placeholder="Consumo (kWh)"
                                      value={unidade.consumoKwh}
                                      onChange={(e) => handleUnidadeInputChange(cliente.id, unidade.id, 'consumoKwh', e.target.value)}
                                  />
                                </div>
                                <div className="md:col-span-2 flex items-center justify-center gap-2">
                                  <Checkbox
                                      checked={unidade.temGeracao}
                                      onCheckedChange={(checked) => handleUnidadeInputChange(cliente.id, unidade.id, 'temGeracao', checked)}
                                      id={`gen-${unidade.id}`}
                                  />
                                  <label htmlFor={`gen-${unidade.id}`} className="text-sm">Tem Geração?</label>
                                </div>
                                <div className="md:col-span-2">
                                  <Button asChild variant="outline" size="sm" className="w-full">
                                    <label className="cursor-pointer">
                                      <Upload className="mr-2 h-4 w-4" />
                                      {unidade.arquivoFatura ? 'Trocar Fatura' : 'Anexar Fatura'}
                                      <Input type="file" className="hidden" onChange={(e) => handleFileChange(cliente.id, unidade.id, e.target.files ? e.target.files[0] : null)} />
                                    </label>
                                  </Button>
                                </div>
                                <div className="md:col-span-3 flex items-center justify-end gap-1">
                                  {unidade.arquivoFatura && (
                                    <>
                                      <Button variant="ghost" size="icon" onClick={() => handleView(unidade.arquivoFatura!)}><Eye className="h-4 w-4" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDownload(unidade.arquivoFatura!)}><Download className="h-4 w-4" /></Button>
                                    </>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveUnidade(cliente.id, unidade.id)} disabled={cliente.unidades.length <= 1}>
                                    <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button onClick={() => handleAddUnidade(cliente.id)} className="mt-4" variant="outline" size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar UC
                          </Button>
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                );
              })
            ) : (
                <div className="h-24 text-center text-muted-foreground flex items-center justify-center">
                    Nenhum cliente adicionado. Clique em "Adicionar Cliente" para começar.
                </div>
            )}
          </Accordion>
          
          <Button onClick={handleAddCliente} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Cliente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
