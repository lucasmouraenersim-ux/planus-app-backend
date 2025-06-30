
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";


const leadFormSchema = z.object({
  customerType: z.enum(['pf', 'pj']).optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  value: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val).replace(",", "."))),
    z.number().optional()
  ),
  kwh: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int().min(0).optional()
  ),
  discountPercentage: z.preprocess(
    (val) => (String(val || "").trim() === '' ? undefined : parseFloat(String(val || "0").replace(",", "."))),
    z.number().min(0).max(100).optional()
  ),
  stageId: z.enum(STAGE_IDS).optional().default('contato'), // Default to 'contato'
  sellerName: z.string().optional(),
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
  
  // PJ Legal Rep fields
  legalRepresentativeName: z.string().optional(),
  legalRepresentativeCpf: z.string().optional(),
  legalRepresentativeRg: z.string().optional(),
  legalRepresentativeAddress: z.string().optional(),
  legalRepresentativeEmail: z.string().email("Email do representante é inválido.").optional().or(z.literal('')),
  legalRepresentativePhone: z.string().optional(),
  legalRepresentativeMaritalStatus: z.string().optional(),
  legalRepresentativeBirthDate: z.string().optional(),
  legalRepresentativeProfession: z.string().optional(),
  legalRepresentativeNationality: z.string().optional(),

  // File fields
  photoDocumentFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
  billDocumentFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
  legalRepresentativeDocumentFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
  otherDocumentsFile: (typeof window === 'undefined' ? z.any() : z.instanceof(FileList)).optional(),
});


type LeadFormData = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  onSubmit: (data: Omit<LeadFormData, 'photoDocumentFile' | 'billDocumentFile' | 'legalRepresentativeDocumentFile' | 'otherDocumentsFile'>, photoFile?: File, billFile?: File, legalRepFile?: File, otherDocsFile?: File) => Promise<void>;
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
      value: initialData?.value || undefined,
      kwh: initialData?.kwh || undefined,
      discountPercentage: initialData?.discountPercentage || undefined,
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
      legalRepresentativeName: initialData?.legalRepresentativeName || "",
      legalRepresentativeCpf: initialData?.legalRepresentativeCpf || "",
      legalRepresentativeRg: initialData?.legalRepresentativeRg || "",
      legalRepresentativeAddress: initialData?.legalRepresentativeAddress || "",
      legalRepresentativeEmail: initialData?.legalRepresentativeEmail || "",
      legalRepresentativePhone: initialData?.legalRepresentativePhone || "",
      legalRepresentativeMaritalStatus: initialData?.legalRepresentativeMaritalStatus || "",
      legalRepresentativeBirthDate: initialData?.legalRepresentativeBirthDate || "",
      legalRepresentativeProfession: initialData?.legalRepresentativeProfession || "",
      legalRepresentativeNationality: initialData?.legalRepresentativeNationality || "",
    },
  });

  const photoFileRef = form.register("photoDocumentFile");
  const billFileRef = form.register("billDocumentFile");
  const legalRepFileRef = form.register("legalRepresentativeDocumentFile");
  const otherDocsFileRef = form.register("otherDocumentsFile");


  const handleSubmit = async (values: LeadFormData) => {
    const photoFile = values.photoDocumentFile?.[0];
    const billFile = values.billDocumentFile?.[0];
    const legalRepFile = values.legalRepresentativeDocumentFile?.[0];
    const otherDocsFile = values.otherDocumentsFile?.[0];

    const dataToSubmit: Omit<LeadFormData, 'photoDocumentFile' | 'billDocumentFile' | 'legalRepresentativeDocumentFile' | 'otherDocumentsFile'> = { ...values };
    delete (dataToSubmit as any).photoDocumentFile;
    delete (dataToSubmit as any).billDocumentFile;
    delete (dataToSubmit as any).legalRepresentativeDocumentFile;
    delete (dataToSubmit as any).otherDocumentsFile;
    
    await onSubmit(dataToSubmit, photoFile, billFile, legalRepFile, otherDocsFile);
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
                      <FormLabel>{customerType === 'pf' ? 'Nome Completo' : 'Razão Social'}</FormLabel>
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
                        <FormLabel>CPF</FormLabel>
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
                          <FormLabel>CNPJ</FormLabel>
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
                    name="kwh"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Consumo Médio (KWh)</FormLabel>
                        <FormControl><Input type="number" placeholder="Ex: 350" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="discountPercentage"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Desconto Aplicado (%)</FormLabel>
                        <FormControl><Input type="number" step="0.1" placeholder="Ex: 15" {...field} /></FormControl>
                        <FormDescription className="text-xs">O valor original e com desconto serão calculados.</FormDescription>
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
                      <FormLabel>Estágio</FormLabel>
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
                      <FormLabel>Vendedor Responsável</FormLabel>
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
                        <FormLabel>{customerType === 'pj' ? 'Contrato Social da Empresa' : 'Documento de Identidade (Foto/PDF)'}</FormLabel>
                        <FormControl><Input type="file" {...photoFileRef} /></FormControl>
                        <FormDescription>
                          {customerType === 'pj' 
                            ? "Anexe o contrato social da empresa ou documento equivalente."
                            : "Anexe uma foto ou PDF do documento do cliente (RG ou CNH)."
                          }
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                
                {customerType === 'pj' && (
                  <Card className="p-4 bg-background/50">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-lg text-primary">Dados do Representante Legal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4">
                      <FormField control={form.control} name="legalRepresentativeName" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Nome completo do representante" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="legalRepresentativeCpf" render={({ field }) => (<FormItem><FormLabel>CPF</FormLabel><FormControl><Input placeholder="CPF do representante" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="legalRepresentativeRg" render={({ field }) => (<FormItem><FormLabel>RG e Órgão Emissor</FormLabel><FormControl><Input placeholder="Ex: 1234567 SSP/MT" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="legalRepresentativeAddress" render={({ field }) => (<FormItem><FormLabel>Endereço</FormLabel><FormControl><Input placeholder="Endereço do representante" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="legalRepresentativeEmail" render={({ field }) => (<FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="email@representante.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="legalRepresentativePhone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(XX) XXXXX-XXXX" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField control={form.control} name="legalRepresentativeMaritalStatus" render={({ field }) => ( <FormItem><FormLabel>Estado Civil</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="solteiro">Solteiro(a)</SelectItem><SelectItem value="casado">Casado(a)</SelectItem><SelectItem value="divorciado">Divorciado(a)</SelectItem><SelectItem value="viuvo">Viúvo(a)</SelectItem><SelectItem value="uniao_estavel">União Estável</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                         <FormField control={form.control} name="legalRepresentativeBirthDate" render={({ field }) => (<FormItem><FormLabel>Data de Nascimento</FormLabel><FormControl><Input placeholder="DD/MM/AAAA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="legalRepresentativeProfession" render={({ field }) => (<FormItem><FormLabel>Profissão</FormLabel><FormControl><Input placeholder="Profissão do representante" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="legalRepresentativeNationality" render={({ field }) => (<FormItem><FormLabel>Nacionalidade</FormLabel><FormControl><Input placeholder="Ex: Brasileiro(a)" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="legalRepresentativeDocumentFile" render={() => (<FormItem><FormLabel>Documento(s) do Representante</FormLabel><FormControl><Input type="file" {...legalRepFileRef} /></FormControl><FormDescription>Anexe o documento de identidade (RG/CNH) do representante.</FormDescription><FormMessage /></FormItem>)} />
                    </CardContent>
                  </Card>
                )}

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
                
                {customerType === 'pj' && (
                   <FormField control={form.control} name="otherDocumentsFile" render={() => (<FormItem><FormLabel>Demais Documentos (Opcional)</FormLabel><FormControl><Input type="file" {...otherDocsFileRef} /></FormControl><FormDescription>Anexe outros documentos relevantes para o cliente PJ.</FormDescription><FormMessage /></FormItem>)} />
                )}

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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : (initialData?.id ? "Salvar Alterações" : "Criar Lead")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
