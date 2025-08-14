"use client";

import { useForex } from '@/contexts/ForexProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Operation } from '@/types/forex';
import { format, parseISO } from 'date-fns';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';

const operationSchema = z.object({
    id: z.string().optional(),
    date: z.string(),
    lotSize: z.coerce.number().positive("O tamanho do lote deve ser positivo."),
    result: z.coerce.number().optional(),
    status: z.enum(['Aberta', 'Fechada']),
});

type OperationFormData = z.infer<typeof operationSchema>;

export default function Operations() {
    const { operations, addOperation, updateOperation, deleteOperation } = useForex();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOperation, setEditingOperation] = useState<Operation | null>(null);

    const form = useForm<OperationFormData>({
        resolver: zodResolver(operationSchema),
    });

    const handleOpenModal = (operation: Operation | null = null) => {
        setEditingOperation(operation);
        form.reset(operation ? {
            ...operation,
            date: format(parseISO(operation.date), "yyyy-MM-dd'T'HH:mm"),
        } : {
            date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            status: 'Aberta',
            lotSize: 0.01,
        });
        setIsModalOpen(true);
    };

    const onSubmit = (data: OperationFormData) => {
        const operationData = {
            ...data,
            id: editingOperation?.id || `op-${Date.now()}`,
            date: new Date(data.date).toISOString(),
            status: data.result !== undefined ? 'Fechada' : 'Aberta',
        } as Operation;

        if (editingOperation) {
            updateOperation(operationData);
        } else {
            addOperation(operationData);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-serif text-[#3F51B5]">Minhas Operações</h1>
                <Button onClick={() => handleOpenModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nova Operação
                </Button>
            </div>

            <Card>
                <CardHeader><CardTitle>Diário de Operações</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Resultado (USD)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operations.map(op => (
                                <TableRow key={op.id}>
                                    <TableCell>{format(parseISO(op.date), "dd/MM/yyyy HH:mm")}</TableCell>
                                    <TableCell>{op.lotSize}</TableCell>
                                    <TableCell className={op.result >= 0 ? 'text-green-500' : 'text-red-500'}>
                                        {op.result !== undefined ? `$${op.result.toFixed(2)}` : '-'}
                                    </TableCell>
                                    <TableCell>{op.status}</TableCell>
                                    <TableCell className="space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleOpenModal(op)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir esta operação? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteOperation(op.id)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingOperation ? 'Editar' : 'Nova'} Operação</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="lotSize" render={({ field }) => (
                            <FormItem><FormLabel>Tamanho do Lote</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="result" render={({ field }) => (
                            <FormItem><FormLabel>Resultado (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Deixe em branco para manter como "Aberta".</FormDescription><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
