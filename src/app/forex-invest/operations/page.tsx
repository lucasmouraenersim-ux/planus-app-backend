
"use client";

import { Suspense, useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForex } from '@/contexts/ForexProvider';
import type { ForexOperation } from '@/types/forex';

const operationSchema = z.object({
  loteSize: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number().positive("O tamanho do lote deve ser um número positivo.")
  ),
  resultUSD: z.preprocess(
    (a) => {
        const str = String(a).trim();
        if (str === "") return undefined;
        return parseFloat(str.replace(",", "."));
    },
    z.number().optional()
  ),
  createdAt: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
  }, z.date({
    required_error: "A data de abertura é obrigatória.",
  })),
  closedAt: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) {
        if (arg === "") return undefined;
        return new Date(arg);
    }
    return undefined;
  }, z.date().optional()),
});


type OperationFormData = z.infer<typeof operationSchema>;

function ForexOperationsPage() {
  const { toast } = useToast();
  const { operations, addOperation, updateOperation, deleteOperation, isLoading } = useForex();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<ForexOperation | null>(null);
  const [operationToDelete, setOperationToDelete] = useState<ForexOperation | null>(null);

  const form = useForm<OperationFormData>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
        loteSize: 0.01,
        createdAt: new Date(),
    }
  });
  const { handleSubmit, control, reset } = form;

  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return "";
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, "yyyy-MM-dd'T'HH:mm");
  };

  const handleOpenModal = (operation: ForexOperation | null = null) => {
    setEditingOperation(operation);
    if (operation) {
        reset({
            loteSize: operation.loteSize,
            resultUSD: operation.resultUSD,
            createdAt: operation.createdAt ? new Date(operation.createdAt as string) : new Date(),
            closedAt: operation.closedAt ? new Date(operation.closedAt as string) : undefined,
        });
    } else {
        reset({
            loteSize: 0.01,
            resultUSD: undefined,
            createdAt: new Date(),
            closedAt: undefined,
        });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOperation(null);
    reset();
  };

  const onSubmit: SubmitHandler<OperationFormData> = async (data) => {
    const status = data.resultUSD !== undefined && data.resultUSD !== null ? 'Fechada' : 'Aberta';
    
    if (editingOperation && editingOperation.id) {
        await updateOperation(editingOperation.id, {
            ...data,
            status,
            closedAt: status === 'Fechada' ? (data.closedAt || new Date()) : undefined
        });
        toast({ title: "Sucesso!", description: "Operação atualizada." });
    } else {
        await addOperation({
            ...data,
            status,
            closedAt: status === 'Fechada' ? (data.closedAt || new Date()) : undefined,
            createdAt: data.createdAt || new Date(),
        });
        toast({ title: "Sucesso!", description: "Nova operação adicionada." });
    }

    handleCloseModal();
  };

  const handleDelete = async (operationId: string) => {
    await deleteOperation(operationId);
    toast({ title: "Operação Excluída", description: "A operação foi removida do seu histórico." });
    setOperationToDelete(null);
  };

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
          <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4" /> Nova Operação</Button>
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
                <TableHead>Aberta em</TableHead>
                <TableHead>Fechada em</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Lucro/Prejuízo (USD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : operations.length > 0 ? (
                operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>{format(parseISO(op.createdAt as string), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{op.closedAt ? format(parseISO(op.closedAt as string), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                    <TableCell>{op.loteSize.toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(op.resultUSD)}</TableCell>
                    <TableCell>{op.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="outline" size="sm" onClick={() => handleOpenModal(op)}>
                         <Edit className="h-3 w-3 mr-1" /> Editar
                       </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="sm" onClick={() => setOperationToDelete(op)}>
                               <Trash2 className="h-3 w-3 mr-1" /> Excluir
                             </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                             <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir esta operação? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                             <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setOperationToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => operationToDelete && operationToDelete.id && handleDelete(operationToDelete.id)}>Confirmar</AlertDialogAction>
                             </AlertDialogFooter>
                          </AlertDialogContent>
                       </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Nenhuma operação registrada ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingOperation ? "Editar Operação" : "Nova Operação"}</DialogTitle>
                <DialogDescription>
                    {editingOperation ? "Atualize os detalhes da sua operação." : "Registre uma nova operação."}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name="loteSize" render={({ field }) => (
                            <FormItem><Label htmlFor="loteSize">Tamanho do Lote</Label><FormControl><Input id="loteSize" type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={control} name="resultUSD" render={({ field }) => (
                            <FormItem><Label htmlFor="resultUSD">Resultado (USD)</Label><FormControl><Input id="resultUSD" type="number" step="0.01" placeholder="Deixe em branco se aberta" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={control}
                            name="createdAt"
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Aberta em</Label>
                                    <FormControl>
                                        <Input
                                            type="datetime-local"
                                            value={formatDateForInput(field.value)}
                                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={control}
                            name="closedAt"
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Fechada em (Opcional)</Label>
                                     <FormControl>
                                        <Input
                                            type="datetime-local"
                                            value={formatDateForInput(field.value)}
                                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                        <Button type="submit">Salvar Operação</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
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
