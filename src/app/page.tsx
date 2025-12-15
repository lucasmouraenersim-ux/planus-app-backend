"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isLoadingAuth, appUser } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth) {
      if (appUser) {
        router.replace('/hub');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoadingAuth, appUser, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
