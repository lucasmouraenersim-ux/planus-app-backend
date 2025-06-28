
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { LeadDocumentData, StageId, LeadSource } from '@/types/crm';
import { STAGE_IDS, LEAD_SOURCES } from '@/types/crm'; // Import defined arrays
import type { FirestoreUser } from '@/types/user';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const leadFormSchema = z.object({
  customerType: z.enum(['pf', 'pj'], { required_error: "Selecione o tipo de cliente." }),
  name: z.string().min(2, "O nome ou razão social é obrigatório."),
  company: z.string().optional(),
  value: z.preprocess(
    (val) => parseFloat(String(val).replace(",", ".")),
    z.number().positive("O valor deve ser positivo.")
  ),
  kwh: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number().int().positive("O consumo em KWh deve ser um inteiro positivo.")
  ),
  stageId: z.enum(STAGE_IDS, { required_error: "O estágio é obrigatório." }),
  sellerName: z.string().min(1, "O nome do vendedor é obrigatório."),
  leadSource: z.enum(LEAD_SOURCES).optional(),
  phone: z.string().optional(),
  email: z.string().email("O email fornecido é inválido.").optional().or(z.literal('')),
  
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  stateRegistration: z.string().optional(),

  naturality: z.string().optional(),
  maritalStatus: z.string().optional(),
  profession: z.string().optional(),
  
  correctionReason: z.string().optional(),
  photoDocumentFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
  billDocumentFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
}).refine(data => {
    if (data.customerType === 'pf') return !!data.cpf && data.cpf.replace(/\D/g, '').length === 11;
    return true;
}, {
    message: "CPF é obrigatório e deve conter 11 dígitos.",
    path: ["cpf"],
}).refine(data => {
    if (data.customerType === 'pj') return !!data.cnpj && data.cnpj.replace(/\D/g, '').length === 14;
    return true;
}, {
    message: "CNPJ é obrigatório e deve conter 14 dígitos.",
    path: ["cnpj"],
});


type LeadFormData = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  onSubmit: (data: Omit<LeadFormData, 'photoDocumentFile' | 'billDocumentFile'>, photoFile?: File, billFile?: File) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<LeadDocumentData & { id?: string }>; // For editing
  isSubmitting?: boolean;
  allUsers: FirestoreUser[];
}

export function LeadForm({ onSubmit, onCancel, initialData, isSubmitting, allUsers }: LeadFormProps) {
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      company: initialData?.company || "",
      value: initialData?.value || 0,
      kwh: initialData?.kwh || 0,
      stageId: initialData?.stageId || 'contato',
      sellerName: initialData?.sellerName || "Sistema",
      leadSource: initialData?.leadSource || undefined,
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      correctionReason: initialData?.correctionReason || "",
      customerType: initialData?.customerType,
      cpf: initialData?.cpf || "",
      cnpj: initialData?.cnpj || "",
      stateRegistration: initialData?.stateRegistration || "",
      naturality: initialData?.naturality || "",
      maritalStatus: initialData?.maritalStatus || "",
      profession: initialData?.profession || "",
    },
  });

  const photoFileRef = form.register("photoDocumentFile");
  const billFileRef = form.register("billDocumentFile");


  const handleSubmit = async (values: LeadFormData) => {
    const photoFile = values.photoDocumentFile?.[0];
    const billFile = values.billDocumentFile?.[0];
    const dataToSubmit: Omit<LeadFormData, 'photoDocumentFile' | 'billDocumentFile'> = { ...values };
    delete (dataToSubmit as any).photoDocumentFile;
    delete (dataToSubmit as any).billDocumentFile;
    await onSubmit(dataToSubmit, photoFile, billFile);
  };
  
  const customerType = form.watch('customerType');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6">
          <div className="space-y-4">

            <FormField
              control={form.control}
              name="customerType"
              render={({ field }) => (
                <FormItem className="space-y-3 rounded-lg border p-4">
                  <FormLabel>Tipo de Cliente *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                      disabled={!!initialData?.customerType} // Disable if already set
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="pf" />
                        </FormControl>
                        <FormLabel className="font-normal">Pessoa Física</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="pj" />
                        </FormControl>
                        <FormLabel className="font-normal">Pessoa Jurídica</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {customerType && (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{customerType === 'pf' ? 'Nome Completo *' : 'Razão Social *'}</FormLabel>
                      <FormControl><Input placeholder={customerType === 'pf' ? "Ex: João da Silva" : "Ex: Empresa Exemplo LTDA"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {customerType === 'pf' && (
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {customerType === 'pj' && (
                  <>
                     <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Fantasia (Opcional)</FormLabel>
                          <FormControl><Input placeholder="Ex: Consultoria ABC" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="stateRegistration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inscrição Estadual (Opcional)</FormLabel>
                          <FormControl><Input placeholder="Ex: 123456789" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Valor Estimado (R$) *</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="Ex: 1500.50" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="kwh"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Consumo Médio (KWh) *</FormLabel>
                        <FormControl><Input type="number" placeholder="Ex: 350" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="stageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estágio *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o estágio" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {STAGE_IDS.map(stage => <SelectItem key={stage} value={stage}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor Responsável *</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um vendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Sistema">Sistema</SelectItem>
                          {allUsers.filter(u => u.type === 'vendedor' || u.type === 'admin' || u.type === 'superadmin').map(user => (
                            <SelectItem key={user.uid} value={user.displayName || user.email!}>
                              {user.displayName || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fonte do Lead</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {LEAD_SOURCES.map(source => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl><Input placeholder="Ex: (XX) XXXXX-XXXX" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="Ex: contato@empresa.com" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                
                {customerType === 'pf' && (
                  <>
                    <FormField
                      control={form.control}
                      name="naturality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Naturalidade</FormLabel>
                          <FormControl><Input placeholder="Ex: Brasileiro(a), São Paulo-SP" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="maritalStatus"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Estado Civil</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                <SelectContent>
                                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                                <SelectItem value="casado">Casado(a)</SelectItem>
                                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                                <SelectItem value="uniao_estavel">União Estável</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="profession"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Profissão</FormLabel>
                            <FormControl><Input placeholder="Ex: Engenheiro(a)" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                  </>
                )}


                <FormField
                  control={form.control}
                  name="photoDocumentFile"
                  render={() => (
                    <FormItem>
                        <FormLabel>{customerType === 'pj' ? 'Contrato Social ou Doc do Sócio' : 'Documento de Identidade (Foto/PDF)'}</FormLabel>
                        <FormControl><Input type="file" {...photoFileRef} /></FormControl>
                        <FormDescription>
                          {customerType === 'pj' 
                            ? "Anexe o contrato social da empresa ou o documento de um dos sócios."
                            : "Anexe uma foto ou PDF do documento do cliente (RG ou CNH)."
                          }
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billDocumentFile"
                  render={() => (
                    <FormItem>
                        <FormLabel>Fatura de Energia (PDF/Imagem)</FormLabel>
                        <FormControl><Input type="file" {...billFileRef} /></FormControl>
                        <FormDescription>Anexe a última fatura de energia do cliente.</FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                {initialData?.id && ( // Only show for existing leads being edited
                    <FormField
                    control={form.control}
                    name="correctionReason"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Motivo da Correção (se aplicável)</FormLabel>
                        <FormControl><Textarea placeholder="Admin solicitou correção por..." {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
              </>
            )}

          </div>
        </ScrollArea>
        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !customerType}>
            {isSubmitting ? "Salvando..." : (initialData?.id ? "Salvar Alterações" : "Criar Lead")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
