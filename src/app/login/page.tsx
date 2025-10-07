"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Firebase onAuthStateChanged in layout.tsx will handle redirect
      router.push('/dashboard'); 
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Ocorreu uma falha no login."; // Default message

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = "Email ou senha inválidos. Por favor, verifique suas credenciais e tente novamente.";
          break;
        case 'auth/invalid-email':
          errorMessage = "O formato do email é inválido.";
          break;
        case 'auth/user-disabled':
          errorMessage = "Esta conta de usuário foi desativada.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Acesso bloqueado temporariamente devido a muitas tentativas de login. Tente novamente mais tarde.";
          break;
        default:
          errorMessage = "Ocorreu um erro inesperado. Verifique sua conexão ou tente novamente mais tarde.";
      }
      
      toast({
        title: "Erro de Login",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Background Image */}
      <Image
        src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/refs/heads/main/Whisk_7171a56086%20(2).svg"
        alt="Background"
        layout="fill"
        objectFit="cover"
        objectPosition="center"
        className="z-0"
        data-ai-hint="abstract background"
      />
      
      {/* Login Card */}
      <Card className="w-full max-w-md z-10 bg-card/70 backdrop-blur-lg border shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/main/LOGO_SENT_ENERGIA_HORIZONTAL_BRANCA.png"
              alt="Sent Energia Logo"
              width={200} 
              height={50} 
              priority
              data-ai-hint="company logo white"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Bem-vindo(a) de volta!</CardTitle>
          <CardDescription>Acesse o mapa interativo do Brasil.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>
            Não tem uma conta?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Registre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
