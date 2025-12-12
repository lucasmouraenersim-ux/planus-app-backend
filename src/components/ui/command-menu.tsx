"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  User,
  Zap,
  LayoutDashboard,
  FileText,
  Users,
  Search
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      {/* Dica visual no topo (opcional, pode colocar no Header depois) */}
      <p className="text-xs text-muted-foreground fixed bottom-4 right-4 z-50 bg-black/50 px-2 py-1 rounded border border-white/10 hidden md:block pointer-events-none">
        Pressione <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"><span className="text-xs">⌘</span>K</kbd>
      </p>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="bg-slate-950 border-white/10">
            <CommandInput placeholder="Digite um comando ou busca..." />
            <CommandList className="bg-slate-950 text-slate-300">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            
            <CommandGroup heading="Acesso Rápido">
                <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/proposal-generator'))}>
                    <FileText className="mr-2 h-4 w-4" /> Nova Proposta
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/crm'))}>
                    <Users className="mr-2 h-4 w-4" /> CRM / Pipeline
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/faturas'))}>
                    <Zap className="mr-2 h-4 w-4" /> Gestão de Faturas
                </CommandItem>
            </CommandGroup>
            
            <CommandSeparator className="bg-white/10" />
            
            <CommandGroup heading="Ferramentas">
                <CommandItem onSelect={() => runCommand(() => router.push('/calculadora'))}>
                    <Calculator className="mr-2 h-4 w-4" /> Calculadora Solar
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/carteira'))}>
                    <CreditCard className="mr-2 h-4 w-4" /> Minha Carteira
                </CommandItem>
            </CommandGroup>
            
            <CommandSeparator className="bg-white/10" />

            <CommandGroup heading="Configurações">
                <CommandItem onSelect={() => runCommand(() => router.push('/profile'))}>
                    <User className="mr-2 h-4 w-4" /> Meu Perfil
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
                    <Settings className="mr-2 h-4 w-4" /> Configurações
                </CommandItem>
            </CommandGroup>
            </CommandList>
        </div>
      </CommandDialog>
    </>
  )
}
