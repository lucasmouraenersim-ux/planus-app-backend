
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
        if (!response.ok) throw new Error("Erro ao buscar CEP");
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
        queryParams.set(key, String(value));
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
              {/* Form fields will be rendered here */}
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
