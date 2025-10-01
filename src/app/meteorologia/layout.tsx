"use client";

import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-screen" style={{ backgroundColor: '#0a0a0b' }}>
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-white mt-4">Carregando...</p>
    </div>
);

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
        return <LoadingSpinner />;
    }
    
    // Prevent flicker while redirecting
    if (!firebaseUser && pathname !== '/meteorologia/login') {
       return <LoadingSpinner />;
    }
    
    if (firebaseUser && pathname === '/meteorologia/login') {
        return <LoadingSpinner />;
    }

    return <>{children}</>;
}

export default function MeteorologiaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section>
        <MeteorologiaLayoutContent>{children}</MeteorologiaLayoutContent>
    </section>
  )
}
