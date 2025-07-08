// src/config/chat-templates.ts

export interface MessageTemplate {
  name: string;
  body: string;
}

export const CHAT_TEMPLATES: MessageTemplate[] = [
  {
    name: "Saudação Inicial",
    body: "Olá, {{leadName}}! Tudo bem?\n\nMeu nome é {{userName}} e sou consultor(a) aqui na Planus Energia. Vi que você tem interesse em economizar na sua conta de luz. Podemos conversar rapidamente sobre como podemos te ajudar?",
  },
  {
    name: "Solicitação de Fatura",
    body: "Olá, {{leadName}}. Para que eu possa fazer uma análise precisa da sua economia, você poderia me enviar uma cópia da sua última fatura de energia, por favor?",
  },
  {
    name: "Follow-up Proposta",
    body: "Oi, {{leadName}}. Passando para saber se você conseguiu dar uma olhada na proposta de economia que te enviei. Alguma dúvida que eu possa esclarecer?",
  },
  {
    name: "Follow-up Contrato",
    body: "Olá, {{leadName}}. O contrato para iniciarmos nossa parceria e sua economia já está com você. Precisa de alguma ajuda para a assinatura digital?",
  },
];
