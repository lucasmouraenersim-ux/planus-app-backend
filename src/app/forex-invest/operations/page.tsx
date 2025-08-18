
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForex } from '@/contexts/ForexProvider';
import type { ForexOperation } from '@/types/forex';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';


const operationSchema = z.object({
  side: z.enum(['Long', 'Short'], { required_error: "O lado da operação é obrigatório."}),
  entryPriceUSD: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number().positive("O preço de entrada deve ser um número positivo.")
  ),
  loteSize: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number().positive("O tamanho do lote deve ser um número positivo.")
  ),
  createdAt: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
  }, z.date({
    required_error: "A data de abertura é obrigatória.",
  })),
  isFinished: z.boolean().optional().default(false),
  exitPriceUSD: z.preprocess(
    (a) => {
        const s = String(a).replace(",", ".");
        return s.trim() === "" ? undefined : parseFloat(s);
    },
    z.number().optional()
  ),
  resultUSD: z.preprocess(
    (a) => {
        const s = String(a).replace(",", ".");
        return s.trim() === "" ? undefined : parseFloat(s);
    },
    z.number().optional()
  ),
  runUpUSD: z.preprocess(
    (a) => {
        const s = String(a).replace(",", ".");
        return s.trim() === "" ? undefined : parseFloat(s);
    },
    z.number().optional()
  ),
  drawdownUSD: z.preprocess(
    (a) => {
        const s = String(a).replace(",", ".");
        return s.trim() === "" ? undefined : parseFloat(s);
    },
    z.number().optional()
  ),
  closedAt: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) {
        if (arg === "") return undefined;
        return new Date(arg);
    }
    return undefined;
  }, z.date().optional()),
}).refine(data => {
    if (data.isFinished) {
        return data.exitPriceUSD !== undefined && data.resultUSD !== undefined;
    }
    return true;
}, {
    message: "Preço de saída e PnL são obrigatórios para operações finalizadas.",
    path: ["exitPriceUSD"], // You can point the error to a specific field
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
        side: 'Long',
        isFinished: false,
    }
  });
  const { handleSubmit, control, reset, watch } = form;
  const isFinished = watch("isFinished");

  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return "";
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    try {
        return format(dateObj, "yyyy-MM-dd'T'HH:mm");
    } catch (error) {
        console.warn("Invalid date for formatting:", date);
        return "";
    }
  };

  const handleOpenModal = (operation: ForexOperation | null = null) => {
    setEditingOperation(operation);
    if (operation) {
        const isOpFinished = operation.status === 'Fechada';
        reset({
            side: operation.side,
            entryPriceUSD: operation.entryPriceUSD,
            loteSize: operation.loteSize,
            createdAt: operation.createdAt ? new Date(operation.createdAt as string) : new Date(),
            isFinished: isOpFinished,
            // Only set these if the operation is finished
            exitPriceUSD: isOpFinished ? operation.exitPriceUSD : undefined,
            resultUSD: isOpFinished ? operation.resultUSD : undefined,
            runUpUSD: isOpFinished ? operation.runUpUSD : undefined,
            drawdownUSD: isOpFinished ? operation.drawdownUSD : undefined,
            closedAt: isOpFinished && operation.closedAt ? new Date(operation.closedAt as string) : undefined,
        });
    } else {
        reset({
            loteSize: 0.01,
            entryPriceUSD: undefined,
            exitPriceUSD: undefined,
            resultUSD: undefined,
            runUpUSD: undefined,
            drawdownUSD: undefined,
            createdAt: new Date(),
            closedAt: undefined,
            side: 'Long',
            isFinished: false,
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
    const status = data.isFinished ? 'Fechada' : 'Aberta';
    
    const operationData: Partial<ForexOperation> = {
      side: data.side,
      entryPriceUSD: data.entryPriceUSD,
      loteSize: data.loteSize,
      createdAt: data.createdAt,
      status: status,
    };

    if (status === 'Fechada') {
        operationData.exitPriceUSD = data.exitPriceUSD;
        operationData.resultUSD = data.resultUSD;
        operationData.runUpUSD = data.runUpUSD;
        operationData.drawdownUSD = data.drawdownUSD;
        operationData.closedAt = data.closedAt || new Date();
    } else {
        operationData.exitPriceUSD = undefined;
        operationData.resultUSD = undefined;
        operationData.runUpUSD = undefined;
        operationData.drawdownUSD = undefined;
        operationData.closedAt = undefined;
    }
    
    if (editingOperation && editingOperation.id) {
        await updateOperation(editingOperation.id, operationData);
        toast({ title: "Sucesso!", description: "Operação atualizada." });
    } else {
        await addOperation(operationData as Omit<ForexOperation, 'id' | 'userId' | 'tradeNumber'>);
        toast({ title: "Sucesso!", description: "Nova operação adicionada." });
    }

    handleCloseModal();
  };

  const handleDelete = async (operationId: string) => {
    await deleteOperation(operationId);
    toast({ title: "Operação Excluída", description: "A operação foi removida do seu histórico." });
    setOperationToDelete(null);
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return <span className="text-muted-foreground">N/A</span>;
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
                <TableHead>Trade #</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Aberta em</TableHead>
                <TableHead>Preço Entrada</TableHead>
                <TableHead>Fechada em</TableHead>
                <TableHead>Preço Saída</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>PnL (USD)</TableHead>
                <TableHead>Run-up</TableHead>
                <TableHead>Drawdown</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : operations.length > 0 ? (
                operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono text-muted-foreground">{op.tradeNumber || '-'}</TableCell>
                    <TableCell><Badge variant={op.side === 'Long' ? 'default' : 'destructive'} className={op.side === 'Long' ? 'bg-green-500/80' : 'bg-red-500/80'}>{op.side}</Badge></TableCell>
                    <TableCell>{op.createdAt ? format(parseISO(op.createdAt as string), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(op.entryPriceUSD)}</TableCell>
                    <TableCell>{op.closedAt ? format(parseISO(op.closedAt as string), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(op.exitPriceUSD)}</TableCell>
                    <TableCell>{op.loteSize.toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(op.resultUSD)}</TableCell>
                    <TableCell>{formatCurrency(op.runUpUSD)}</TableCell>
                    <TableCell>{formatCurrency(op.drawdownUSD)}</TableCell>
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
                  <TableCell colSpan={12} className="text-center h-24 text-muted-foreground">Nenhuma operação registrada ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{editingOperation ? `Editar Operação #${editingOperation.tradeNumber}` : "Nova Operação"}</DialogTitle>
                <DialogDescription>
                    {editingOperation ? "Atualize os detalhes da sua operação." : "Registre uma nova operação."}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <FormField control={control} name="side" render={({ field }) => (
                        <FormItem className="space-y-3"><Label>Lado da Operação</Label><FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Long" /></FormControl><Label className="font-normal">Long (Compra)</Label></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Short" /></FormControl><Label className="font-normal">Short (Venda)</Label></FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                    )} />
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField control={control} name="entryPriceUSD" render={({ field }) => (<FormItem><Label>Preço de Entrada (USD)</Label><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={control} name="loteSize" render={({ field }) => (<FormItem><Label>Tamanho do Lote</Label><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={control} name="createdAt" render={({ field }) => (<FormItem><Label>Data de Abertura</Label><FormControl><Input type="datetime-local" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}/></FormControl><FormMessage /></FormItem>)} />
                    </div>

                    <FormField
                      control={control}
                      name="isFinished"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <Label>Operação Finalizada?</Label>
                          </div>
                        </FormItem>
                      )}
                    />

                    {isFinished && (
                        <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={control} name="exitPriceUSD" render={({ field }) => (<FormItem><Label>Preço de Saída (USD)</Label><FormControl><Input type="number" step="any" placeholder="Preço de fechamento" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name="closedAt" render={({ field }) => (<FormItem><Label>Data de Fechamento</Label><FormControl><Input type="datetime-local" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}/></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField control={control} name="resultUSD" render={({ field }) => (<FormItem><Label>PnL (USD)</Label><FormControl><Input type="number" step="any" placeholder="Resultado em $" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name="runUpUSD" render={({ field }) => (<FormItem><Label>Run-up (USD)</Label><FormControl><Input type="number" step="any" placeholder="Opcional" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={control} name="drawdownUSD" render={({ field }) => (<FormItem><Label>Drawdown (USD)</Label><FormControl><Input type="number" step="any" placeholder="Opcional" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                    )}
                    
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
