
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const comercializadoras = [
  {
    label: "BC Energia",
    value: "BC Energia",
  },
  {
    label: "Bolt Energy",
    value: "Bolt Energy",
  },
  {
    label: "Cenergy",
    value: "Cenergy",
  },
  {
    label: "Serena Energia",
    value: "Serena Energia",
  },
  {
    label: "Bowe Holding",
    value: "Bowe Holding",
  },
  {
    label: "Fit Energia",
    value: "Fit Energia",
  },
];

const formSchema = z.object({
  clienteNome: z.string().min(1, "Nome do cliente é obrigatório."),
  clienteCnpjCpf: z.string().optional(),
  codigoClienteInstalacao: z
    .string()
    .optional()
    .describe("Unidade Consumidora (UC)"),
  item1Quantidade: z
    .string()
    .min(1, "Consumo KWh é obrigatório.")
    .refine((val) => !isNaN(parseFloat(val.replace(".", "").replace(",", "."))), {
      message: "Consumo KWh deve ser um número válido.",
    }),
  currentTariff: z
    .string()
    .min(1, "Tarifa é obrigatória.")
    .refine((val) => !isNaN(parseFloat(val.replace(".", "").replace(",", "."))), {
      message: "A tarifa deve ser um número válido.",
    }),
  ligacao: z
    .enum(["MONOFASICO", "BIFASICO", "TRIFASICO", "NAO_INFORMADO", ""])
    .optional()
    .describe("Tipo de Fornecimento"),
  classificacao: z.string().optional().describe("Classe de Consumo"),
  distribuidora: z.string().optional().describe("Distribuidora local"),
  comercializadora: z
    .string()
    .min(1, "Selecione a comercializadora responsável pela proposta."),
  cobreBandeira: z
    .enum(["sim", "nao"])
    .default("sim")
    .describe("A proposta cobre bandeira tarifária?"),

  clienteCep: z
    .string()
    .optional()
    .refine(
      (val) => val === "" || /^\d{5}-?\d{3}$/.test(val) || /^\d{8}$/.test(val),
      { message: "CEP inválido. Use XXXXX-XXX ou XXXXXXXX." },
    ),
  clienteRua: z.string().optional(),
  clienteNumero: z.string().optional(),
  clienteComplemento: z.string().optional(),
  clienteBairro: z.string().optional(),
  clienteCidade: z.string().optional(),
  clienteUF: z.string().optional(),

  item3Valor: z
    .string()
    .optional()
    .refine(
      (val) => val === "" || !isNaN(parseFloat(val.replace(".", "").replace(",", "."))),
      { message: "CIP/COSIP deve ser um número válido ou vazio." },
    ),
  valorProducaoPropria: z
    .string()
    .optional()
    .refine(
      (val) => val === "" || !isNaN(parseFloat(val.replace(".", "").replace(",", "."))),
      { message: "Valor da produção própria deve ser um número válido ou vazio." },
    ),
  isencaoIcmsEnergiaGerada: z
    .enum(["sim", "nao"])
    .default("nao")
    .describe("Há isenção de ICMS na Energia Gerada?"),
  comFidelidade: z.boolean().default(true).describe("A proposta inclui fidelidade?"),
});

type ProposalFormData = z.infer<typeof formSchema>;

function ProposalGeneratorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialKwhFromUrl = searchParams.get("item1Quantidade");
  const initialUfFromUrl = searchParams.get("clienteUF");

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clienteNome: "",
      clienteCnpjCpf: "",
      codigoClienteInstalacao: "",
      item1Quantidade: initialKwhFromUrl || "1500",
      currentTariff: "0,98",
      ligacao: "TRIFASICO",
      classificacao: "RESIDENCIAL-CONVENCIONAL BAIXA TENSAO B1",
      distribuidora: "",
      comercializadora: comercializadoras[0]?.value,
      cobreBandeira: "sim",
      clienteCep: "",
      clienteRua: "",
      clienteNumero: "",
      clienteComplemento: "",
      clienteBairro: "",
      clienteCidade: "",
      clienteUF: initialUfFromUrl || "",
      item3Valor: "13,75",
      valorProducaoPropria: "0",
      isencaoIcmsEnergiaGerada: "nao",
      comFidelidade: true,
    },
  });

  const cepValue = form.watch("clienteCep");

  useEffect(() => {
    const kwhFromUrl = searchParams.get("item1Quantidade");
    const ufFromUrl = searchParams.get("clienteUF");
    const comercializadoraFromUrl = searchParams.get("comercializadora");
    const cobreBandeiraFromUrl = searchParams.get("cobreBandeira");
    const tarifaFromUrl = searchParams.get("currentTariff");
    const distribuidoraFromUrl = searchParams.get("distribuidora");

    if (kwhFromUrl && form.getValues("item1Quantidade") !== kwhFromUrl) {
      form.setValue("item1Quantidade", kwhFromUrl);
    }
    if (ufFromUrl && form.getValues("clienteUF") !== ufFromUrl) {
      form.setValue("clienteUF", ufFromUrl);
    }
    if (comercializadoraFromUrl && form.getValues("comercializadora") !== comercializadoraFromUrl) {
      form.setValue("comercializadora", comercializadoraFromUrl);
    }
    if (cobreBandeiraFromUrl) {
      const normalized = cobreBandeiraFromUrl.toLowerCase();
      const bandeiraValue = ["true", "sim", "1"].includes(normalized) ? "sim" : "nao";
      if (form.getValues("cobreBandeira") !== bandeiraValue) {
        form.setValue("cobreBandeira", bandeiraValue);
      }
    }
    if (tarifaFromUrl && form.getValues("currentTariff") !== tarifaFromUrl) {
      form.setValue("currentTariff", tarifaFromUrl);
    }
    if (distribuidoraFromUrl && form.getValues("distribuidora") !== distribuidoraFromUrl) {
      form.setValue("distribuidora", distribuidoraFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, form.setValue]);

  useEffect(() => {
    const fetchAddress = async (cep: string) => {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!response.ok) {
          throw new Error("Erro ao buscar CEP");
        }
        const data = await response.json();
        if (data.erro) {
          toast({
            title: "CEP não encontrado",
            description: "Por favor, verifique o CEP digitado.",
            variant: "destructive",
          });
          form.setValue("clienteRua", "");
          form.setValue("clienteBairro", "");
          form.setValue("clienteCidade", "");
          form.setValue("clienteUF", searchParams.get("clienteUF") || "");
        } else {
          form.setValue("clienteRua", data.logradouro || "");
          form.setValue("clienteBairro", data.bairro || "");
          form.setValue("clienteCidade", data.localidade || "");
          form.setValue("clienteUF", data.uf || "");
          toast({
            title: "Endereço preenchido",
            description: "Os campos de endereço foram atualizados.",
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
        toast({
          title: "Erro na busca de CEP",
          description: "Não foi possível buscar o endereço. Tente novamente.",
          variant: "destructive",
        });
      }
    };

    if (cepValue) {
      const cleanedCep = cepValue.replace(/\D/g, "");
      if (cleanedCep.length === 8) {
        fetchAddress(cleanedCep);
      } else {
        if (
          form.getValues("clienteRua") ||
          form.getValues("clienteBairro") ||
          form.getValues("clienteCidade") ||
          form.getValues("clienteUF") !== (searchParams.get("clienteUF") || "")
        ) {
          if ((cleanedCep.length === 0 || cleanedCep.length < 8) && !/^\d{0,7}$/.test(cleanedCep)) {
            form.setValue("clienteRua", "");
            form.setValue("clienteBairro", "");
            form.setValue("clienteCidade", "");
            form.setValue("clienteUF", searchParams.get("clienteUF") || "");
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepValue, form.setValue, toast, searchParams]);

  function onSubmit(values: ProposalFormData) {
    const queryParams = new URLSearchParams();
    (Object.keys(values) as Array<keyof ProposalFormData>).forEach((key) => {
      const value = values[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        if (typeof value === "boolean") {
          queryParams.set(key, String(value));
        } else {
          queryParams.set(key, String(value));
        }
      }
    });
    queryParams.set("comFidelidade", String(form.getValues("comFidelidade")));

    router.push(`/proposal?${queryParams.toString()}`);
  }

  return (
    <main className="flex flex-col items-center justify-start min-h-screen bg-background p-4 md:p-8 font-body">
      <Card className="w-full max-w-2xl border bg-card/70 shadow-xl backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-headline text-primary font-bold tracking-tight">
            Gerador de Proposta de Fatura
          </CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">
            Preencha os dados abaixo para personalizar a simulação da fatura. Os campos da fatura serão calculados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="clienteNome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Cliente / Razão Social</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Mercado Mix LTDA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clienteCnpjCpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 123.456.789-00 ou XX.XXX.XXX/XXXX-XX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clienteCep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 78890-000 ou 78890000" {...field} />
                    </FormControl>
                    <FormDescription>Digite o CEP para buscar o endereço automaticamente.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clienteRua"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rua</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Rua Caminho do Sol" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clienteNumero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clienteComplemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: QD18 LT11, APTO 101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="clienteBairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Rota do Sol" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clienteCidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Sorriso" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clienteUF"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: MT" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="codigoClienteInstalacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade Consumidora (UC)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 6555432" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="distribuidora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distribuidora Local</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Neoenergia Brasília" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comercializadora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comercializadora Responsável</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a comercializadora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {comercializadoras.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="item1Quantidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumo Médio Mensal (KWh)</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Ex: 1500" {...field} />
                      </FormControl>
                      <FormDescription>Preenche o consumo base da proposta.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentTariff"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarifa Vigente (R$/kWh)</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Ex: 0,98" {...field} />
                      </FormControl>
                      <FormDescription>Esta tarifa será usada como referência para o cálculo sem desconto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="ligacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Fornecimento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MONOFASICO">Monofásico</SelectItem>
                        <SelectItem value="BIFASICO">Bifásico</SelectItem>
                        <SelectItem value="TRIFASICO">Trifásico</SelectItem>
                        <SelectItem value="NAO_INFORMADO">Não especificado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classificacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe de Consumo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: RESIDENCIAL-CONVENCIONAL BAIXA TENSAO B1" {...field} />
                    </FormControl>
                    <FormDescription>Ex: RESIDENCIAL, COMERCIAL, INDUSTRIAL, etc.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cobreBandeira"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>A proposta cobre bandeiras tarifárias?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-row space-x-4">
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="sim" />
                          </FormControl>
                          <FormLabel className="font-normal">Sim</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="nao" />
                          </FormControl>
                          <FormLabel className="font-normal">Não</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Define se a comercializadora absorve ou repassa as bandeiras tarifárias ao cliente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isencaoIcmsEnergiaGerada"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Há isenção de ICMS na Energia Gerada?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-row space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="sim" />
                          </FormControl>
                          <FormLabel className="font-normal">Sim</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="nao" />
                          </FormControl>
                          <FormLabel className="font-normal">Não</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Isto afeta a tarifa exibida para a "Energia Ativa Injetada" na fatura.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="item3Valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contribuição de Iluminação Pública (R$)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Ex: 13,75" {...field} />
                    </FormControl>
                    <FormDescription>Valor manual da CIP/COSIP.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valorProducaoPropria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Energia Ativa Injetada (R$)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Ex: 146,60" {...field} />
                    </FormControl>
                    <FormDescription>Valor em R$ da energia injetada (produção própria).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comFidelidade"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background/50 p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Incluir Fidelidade na Proposta?</FormLabel>
                      <FormDescription>
                        Afeta as regras de desconto aplicadas na simulação.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Gerar Proposta Final
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ProposalGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen flex-col items-center justify-center bg-background text-primary">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-medium">Carregando Gerador de Proposta...</p>
        </div>
      }
    >
      <ProposalGeneratorPageContent />
    </Suspense>
  );
}
