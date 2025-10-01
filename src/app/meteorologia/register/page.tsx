"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Loader2, Cloud, UserPlus } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

export default function MeteorologiaRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Erro de Registro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // After successful registration, Firebase automatically signs the user in.
      // The onAuthStateChanged listener in the layout will handle the redirect.
      toast({
        title: "Registro bem-sucedido!",
        description: "Você será redirecionado para o mapa.",
      });
      router.push('/meteorologia');
    } catch (error: any) {
      let errorMessage = "Ocorreu uma falha no registro.";
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "Este email já está em uso por outra conta.";
          break;
        case 'auth/invalid-email':
          errorMessage = "O formato do email é inválido.";
          break;
        case 'auth/weak-password':
          errorMessage = "A senha é muito fraca. Ela deve ter no mínimo 6 caracteres.";
          break;
      }
      toast({
        title: "Erro de Registro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-gray-900">
      <Card className="w-full max-w-md z-10 bg-gray-800/80 backdrop-blur-lg border-gray-700 shadow-2xl text-white">
        <CardHeader className="text-center space-y-4">
          <UserPlus className="w-16 h-16 text-blue-400 mx-auto" />
          <CardTitle className="text-3xl font-bold text-blue-300">Criar Conta</CardTitle>
          <CardDescription className="text-gray-400">Junte-se à plataforma de análise de tempo severo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Registrando...' : 'Registrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-gray-400">
          <p>
            Já tem uma conta?{' '}
            <Link href="/meteorologia/login" className="font-medium text-blue-400 hover:underline">
              Faça login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
