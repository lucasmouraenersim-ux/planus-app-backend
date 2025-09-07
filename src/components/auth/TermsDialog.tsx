
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface TermsDialogProps {
  isOpen: boolean;
  onAccept: () => Promise<void>;
}

export function TermsDialog({ isOpen, onAccept }: TermsDialogProps) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAccept = privacyAccepted && termsAccepted;

  const handleAcceptClick = async () => {
    setIsSubmitting(true);
    await onAccept();
    // No need to set isSubmitting to false, as the component will unmount
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-2xl bg-card/90 backdrop-blur-xl border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl text-primary">Termos e Condições de Uso</AlertDialogTitle>
          <AlertDialogDescription>
            Para continuar, por favor, leia e aceite nossos termos e políticas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="h-72 w-full rounded-md border p-4">
          <h3 className="font-semibold text-lg mb-2 text-foreground">Termos de Uso do Aplicativo Sent Energia</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ao acessar e usar o aplicativo Sent Energia ("Aplicativo"), você concorda em cumprir estes Termos de Uso. O Aplicativo é uma ferramenta destinada a auxiliar consultores na gestão de leads, criação de propostas e acompanhamento de performance. Você é responsável pela veracidade e legalidade das informações inseridas no sistema, incluindo dados de clientes, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
          </p>
          <h3 className="font-semibold text-lg mb-2 text-foreground">Uso Responsável e Confidencialidade</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Você concorda em usar o Aplicativo de forma ética e profissional. As informações de clientes e dados de comissionamento são confidenciais e não devem ser compartilhadas com terceiros não autorizados. Qualquer uso indevido do sistema, incluindo a inserção de dados falsos ou a prática de atos ilícitos, resultará na suspensão ou encerramento da sua conta.
          </p>
          <h3 className="font-semibold text-lg mb-2 text-foreground">Política de Privacidade</h3>
          <p className="text-sm text-muted-foreground">
            Nossa Política de Privacidade, que é parte integrante destes Termos, descreve como coletamos, usamos e protegemos suas informações pessoais e as de seus clientes. Ao aceitar estes termos, você também concorda com as práticas descritas em nossa Política de Privacidade.
          </p>
        </ScrollArea>
        <div className="space-y-4 pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))} />
            <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Eu li e aceito os <strong>Termos de Uso</strong>.
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="privacy" checked={privacyAccepted} onCheckedChange={(checked) => setPrivacyAccepted(Boolean(checked))} />
            <Label htmlFor="privacy" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Eu li e aceito a <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline"><strong>Política de Privacidade</strong></Link>.
            </Label>
          </div>
        </div>
        <AlertDialogFooter className="mt-4">
          <Button onClick={handleAcceptClick} disabled={!canAccept || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceitar e Continuar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
