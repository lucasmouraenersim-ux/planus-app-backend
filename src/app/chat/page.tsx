
"use client";

import { Suspense } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { Loader2 } from 'lucide-react';

function ChatPageContent() {
    return <ChatLayout />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando Chat...</p>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
