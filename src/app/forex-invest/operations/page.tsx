
"use client";

import { Suspense, useState } from 'react';
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
import { format } from 'date-fns';

interface Operation {
  id: string;
  date: Date;
  loteSize: number;
  resultUSD?: number;
  status: 'Aberta' | 'Fechada';
}

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
});

type OperationFormData = z.infer<typeof operationSchema>;

function ForexOperationsPage() {
  const { toast } = useToast();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [operationToDelete, setOperationToDelete] = useState<Operation | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<OperationFormData>({
    resolver: zodResolver(operationSchema)
  });

  const handleOpenModal = (operation: Operation | null = null) => {
    setEditingOperation(operation);
    if (operation) {
        setValue("loteSize", operation.loteSize);
        setValue("resultUSD", operation.resultUSD);
    } else {
        reset({ loteSize: 0.01, resultUSD: undefined });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOperation(null);
    reset();
  };

  const onSubmit: SubmitHandler<OperationFormData> = (data) => {
    const status = data.resultUSD !== undefined ? 'Fechada' : 'Aberta';
    
    if (editingOperation) {
        // Update operation
        setOperations(prevOps => prevOps.map(op => 
            op.id === editingOperation.id ? { ...op, ...data, status } : op
        ));
        toast({ title: "Sucesso!", description: "Operação atualizada." });
    } else {
        // Add new operation
        const newOperation: Operation = {
            id: new Date().toISOString(),
            date: new Date(),
            ...data,
            status,
        };
        setOperations(prevOps => [newOperation, ...prevOps]);
        toast({ title: "Sucesso!", description: "Nova operação adicionada." });
    }

    // TODO: Trigger recalculation of the main projection dashboard
    handleCloseModal();
  };

  const handleDelete = (operationId: string) => {
    setOperations(prevOps => prevOps.filter(op => op.id !== operationId));
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
                <TableHead>Data</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Lucro/Prejuízo (USD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.length > 0 ? (
                operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>{format(op.date, 'dd/MM/yyyy HH:mm')}</TableCell>
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
                                <AlertDialogAction onClick={() => operationToDelete && handleDelete(operationToDelete.id)}>Confirmar</AlertDialogAction>
                             </AlertDialogFooter>
                          </AlertDialogContent>
                       </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Nenhuma operação registrada ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingOperation ? "Editar Operação" : "Nova Operação"}</DialogTitle>
                <DialogDescription>
                    {editingOperation ? "Atualize os detalhes da sua operação." : "Registre uma nova operação. O resultado pode ser adicionado depois."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                <div>
                    <Label htmlFor="loteSize">Tamanho do Lote</Label>
                    <Input id="loteSize" type="number" step="0.01" {...register("loteSize")} />
                    {errors.loteSize && <p className="text-red-500 text-xs mt-1">{errors.loteSize.message}</p>}
                </div>
                <div>
                    <Label htmlFor="resultUSD">Resultado (USD)</Label>
                    <Input id="resultUSD" type="number" step="0.01" placeholder="Deixe em branco se aberta" {...register("resultUSD")} />
                    {errors.resultUSD && <p className="text-red-500 text-xs mt-1">{errors.resultUSD.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Preencher este campo marcará a operação como "Fechada".</p>
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                    <Button type="submit">Salvar Operação</Button>
                </DialogFooter>
            </form>
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

    