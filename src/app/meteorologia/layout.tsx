"use client";

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';

const LoadingSpinner = () => (
    <div className="flex items-center justify-center space-x-1">
        <div className="w-2 h-4 bg-white animate-pulse" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-6 bg-white animate-pulse" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-8 bg-white animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-6 bg-white animate-pulse" style={{ animationDelay: '0.3s' }}></div>
        <div className="w-2 h-4 bg-white animate-pulse" style={{ animationDelay: '0.4s' }}></div>
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
        return (
            <div className="flex flex-col justify-center items-center h-screen" style={{ backgroundColor: '#4A90E2' }}>
                <LoadingSpinner />
            </div>
        );
    }
    
    // Allow rendering login page or children for authenticated users
    if (!firebaseUser && pathname !== '/meteorologia/login') {
       return (
            <div className="flex flex-col justify-center items-center h-screen" style={{ backgroundColor: '#4A90E2' }}>
                <LoadingSpinner />
                <p className="text-white mt-4">Redirecionando para login...</p>
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
    <section>
        <AuthProvider>
            <MeteorologiaLayoutContent>{children}</MeteorologiaLayoutContent>
            <Toaster />
        </AuthProvider>
    </section>
  )
}
