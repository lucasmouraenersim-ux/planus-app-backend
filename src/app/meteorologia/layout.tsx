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
            const isAuthPage = pathname === '/meteorologia/login' || pathname === '/meteorologia/register';
            if (firebaseUser && isAuthPage) {
                // If logged in and on login/register page, redirect to map
                router.replace('/meteorologia');
            } else if (!firebaseUser && !isAuthPage) {
                // If not logged in and not on an auth page, redirect to login
                router.replace('/meteorologia/login');
            }
        }
    }, [isLoadingAuth, firebaseUser, pathname, router]);

    if (isLoadingAuth) {
        return <LoadingSpinner />;
    }
    
    // Prevent flicker while redirecting
    const isAuthPage = pathname === '/meteorologia/login' || pathname === '/meteorologia/register';
    if (!firebaseUser && !isAuthPage) {
       return <LoadingSpinner />;
    }
    
    if (firebaseUser && isAuthPage) {
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
