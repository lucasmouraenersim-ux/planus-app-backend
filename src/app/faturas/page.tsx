"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, PlusCircle, Trash2, Upload, Download, Eye } from 'lucide-react';

interface Fatura {
  id: string;
  nome: string;
  tipoPessoa: 'pf' | 'pj' | '';
  consumoKwh: string;
  temGeracao: boolean;
  arquivoFatura: File | null;
}

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [nextId, setNextId] = useState(1);

  const handleAddRow = () => {
    const newFatura: Fatura = {
      id: `fatura-${nextId}`,
      nome: '',
      tipoPessoa: '',
      consumoKwh: '',
      temGeracao: false,
      arquivoFatura: null,
    };
    setFaturas([...faturas, newFatura]);
    setNextId(nextId + 1);
  };

  const handleRemoveRow = (id: string) => {
    setFaturas(faturas.filter(f => f.id !== id));
  };

  const handleInputChange = (id: string, field: keyof Fatura, value: any) => {
    setFaturas(faturas.map(f => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const handleFileChange = (id: string, file: File | null) => {
    handleInputChange(id, 'arquivoFatura', file);
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
            Adicione e gerencie as informações e documentos das faturas dos seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Nome do Cliente</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead>Consumo (kWh)</TableHead>
                  <TableHead className="text-center">Tem Geração?</TableHead>
                  <TableHead className="text-center">Fatura</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturas.length > 0 ? (
                  faturas.map((fatura) => (
                    <TableRow key={fatura.id}>
                      <TableCell>
                        <Input
                          placeholder="Nome do cliente"
                          value={fatura.nome}
                          onChange={(e) => handleInputChange(fatura.id, 'nome', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={fatura.tipoPessoa}
                          onValueChange={(value: 'pf' | 'pj' | '') => handleInputChange(fatura.id, 'tipoPessoa', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pf">PF</SelectItem>
                            <SelectItem value="pj">PJ</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="Ex: 500"
                          value={fatura.consumoKwh}
                          onChange={(e) => handleInputChange(fatura.id, 'consumoKwh', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={fatura.temGeracao}
                          onCheckedChange={(checked) => handleInputChange(fatura.id, 'temGeracao', checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="outline" size="sm">
                          <label className="cursor-pointer">
                            <Upload className="mr-2 h-4 w-4" />
                            {fatura.arquivoFatura ? 'Trocar' : 'Anexar'}
                            <Input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(fatura.id, e.target.files ? e.target.files[0] : null)}
                            />
                          </label>
                        </Button>
                      </TableCell>
                      <TableCell className="flex justify-center items-center gap-2">
                         {fatura.arquivoFatura && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleView(fatura.arquivoFatura!)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(fatura.arquivoFatura!)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="destructive" size="icon" onClick={() => handleRemoveRow(fatura.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhuma fatura adicionada. Clique em "Adicionar Linha" para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Button onClick={handleAddRow} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Linha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
