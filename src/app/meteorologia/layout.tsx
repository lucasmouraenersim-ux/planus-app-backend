"use client";

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

const MeteorologiaLayoutContent = ({ children }: { children: ReactNode }) => {
    const { firebaseUser, isLoadingAuth } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoadingAuth) {
            const isLoginPage = pathname === '/meteorologia/login';
            if (firebaseUser && isLoginPage) {
                // If logged in and on login page, redirect to map
                router.replace('/meteorologia');
            } else if (!firebaseUser && !isLoginPage) {
                // If not logged in and not on login page, redirect to login
                router.replace('/meteorologia/login');
            }
        }
    }, [isLoadingAuth, firebaseUser, pathname, router]);

    if (isLoadingAuth) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <Loader2 className="animate-spin h-12 w-12 text-blue-400 mb-4" />
                <p>Carregando...</p>
            </div>
        );
    }
    
    // Allow rendering login page or children for authenticated users
    if (!firebaseUser && pathname !== '/meteorologia/login') {
       return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <Loader2 className="animate-spin h-12 w-12 text-blue-400 mb-4" />
                <p>Redirecionando para login...</p>
            </div>
        );
    }

    return <>{children}</>;
}


export default function MeteorologiaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
        <head>
            <title>Sent Meteorologia</title>
        </head>
      <body>
          <AuthProvider>
            <MeteorologiaLayoutContent>{children}</MeteorologiaLayoutContent>
            <Toaster />
          </AuthProvider>
      </body>
    </html>
  )
}
