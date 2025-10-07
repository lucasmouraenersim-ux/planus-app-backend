"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface FakeLoginProps {
  onLogin: () => void;
}

export function FakeLogin({ onLogin }: FakeLoginProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    // Simulate a network request
    setTimeout(() => {
      onLogin();
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#171821]">
      <Card className="w-full max-w-md z-10 bg-[#252630]/70 backdrop-blur-lg border-slate-700 shadow-2xl text-slate-200">
        <CardHeader className="text-center space-y-4">
           <div className="flex justify-center">
            <Image
              src="https://placehold.co/180x60.png/252630/FFFFFF?text=EnhanceScape"
              alt="EnhanceScape Logo"
              width={180} 
              height={60} 
              priority
              data-ai-hint="company logo white text"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-100">Bem-vindo(a)!</CardTitle>
          <CardDescription className="text-slate-400">Acesse para aprimorar suas imagens com IA.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  className="pl-10 bg-slate-800 border-slate-600 text-slate-100"
                  disabled={isLoading}
                  defaultValue="demo@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  required
                  className="pl-10 bg-slate-800 border-slate-600 text-slate-100"
                  disabled={isLoading}
                  defaultValue="password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#a855f7] hover:bg-[#a855f7]/90 text-white" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        {/* Adicionado link para a página de registro principal */}
        <div className="text-center pb-4 text-sm">
            <p className="text-slate-400">
                Não tem uma conta?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                    Registre-se
                </Link>
            </p>
        </div>
      </Card>
    </div>
  );
}