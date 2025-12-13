"use client";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/ClientLayout'; // Importa o novo componente

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <title>Sent Energia Hub</title>
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-cyan-500/30 selection:text-cyan-100">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
