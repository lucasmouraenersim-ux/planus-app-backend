
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Award, TrendingUp, Filter, Crown, UserCircle, DollarSign, Hash, ListOrdered, Zap, X } from 'lucide-react';
import type { AppUser } from '@/types/user';

// Interface for Ranking Display
interface RankingDisplayEntry {
  rankPosition: number;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  mainScoreDisplay: string; 
  mainScoreValue: number; 
  detailScore1Label?: string; 
  detailScore1Value?: string | number;
  detailScore2Label?: string;
  detailScore2Value?: string | number;
  periodIdentifier: string; 
  criteriaIdentifier: string; 
  kwh: number;
}

// Mock AppUser for demonstration
const MOCK_LOGGED_IN_USER: AppUser = {
  uid: 'user1',
  email: 'vendedor1@example.com',
  displayName: 'Vendedor Um',
  type: 'vendedor',
  personalBalance: 1250.75,
  mlmBalance: 350.50,
  photoURL: 'https://placehold.co/100x100.png?text=VU',
};

const MOCK_RANKING_ENTRIES: RankingDisplayEntry[] = [
  // Monthly Current - Total Sales Value
  { rankPosition: 0, userId: 'user2', userName: 'Vendedor Dois', userPhotoUrl: 'https://placehold.co/100x100.png?text=V2', mainScoreDisplay: 'R$ 25.000,00', mainScoreValue: 25000, detailScore1Label: 'Nº Vendas', detailScore1Value: 5, detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 5.000,00', periodIdentifier: 'monthly_current', criteriaIdentifier: 'totalSalesValue', kwh: 12500 },
  { rankPosition: 0, userId: 'user1', userName: 'Vendedor Um', userPhotoUrl: MOCK_LOGGED_IN_USER.photoURL || undefined, mainScoreDisplay: 'R$ 18.500,00', mainScoreValue: 18500, detailScore1Label: 'Nº Vendas', detailScore1Value: 3, detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 6.166,67', periodIdentifier: 'monthly_current', criteriaIdentifier: 'totalSalesValue', kwh: 9250 },
  { rankPosition: 0, userId: 'user3', userName: 'Vendedor Três', userPhotoUrl: 'https://placehold.co/100x100.png?text=V3', mainScoreDisplay: 'R$ 12.000,00', mainScoreValue: 12000, detailScore1Label: 'Nº Vendas', detailScore1Value: 4, detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 3.000,00', periodIdentifier: 'monthly_current', criteriaIdentifier: 'totalSalesValue', kwh: 6000 },
  { rankPosition: 0, userId: 'user4', userName: 'Vendedor Quatro', mainScoreDisplay: 'R$ 10.000,00', mainScoreValue: 10000, detailScore1Label: 'Nº Vendas', detailScore1Value: 2, detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 5.000,00', periodIdentifier: 'monthly_current', criteriaIdentifier: 'totalSalesValue', kwh: 5000 },
  // Monthly Current - Number of Sales
  { rankPosition: 0, userId: 'user2', userName: 'Vendedor Dois', userPhotoUrl: 'https://placehold.co/100x100.png?text=V2', mainScoreDisplay: '5 Vendas', mainScoreValue: 5, detailScore1Label: 'Volume (R$)', detailScore1Value: 'R$ 25.000,00', detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 5.000,00', periodIdentifier: 'monthly_current', criteriaIdentifier: 'numberOfSales', kwh: 12500 },
  { rankPosition: 0, userId: 'user3', userName: 'Vendedor Três', userPhotoUrl: 'https://placehold.co/100x100.png?text=V3', mainScoreDisplay: '4 Vendas', mainScoreValue: 4, detailScore1Label: 'Volume (R$)', detailScore1Value: 'R$ 12.000,00', detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 3.000,00', periodIdentifier: 'monthly_current', criteriaIdentifier: 'numberOfSales', kwh: 6000 },
  { rankPosition: 0, userId: 'user1', userName: 'Vendedor Um', userPhotoUrl: MOCK_LOGGED_IN_USER.photoURL || undefined, mainScoreDisplay: '3 Vendas', mainScoreValue: 3, detailScore1Label: 'Volume (R$)', detailScore1Value: 'R$ 18.500,00', detailScore2Label: 'Ticket Médio', detailScore2Value: 'R$ 6.166,67', periodIdentifier: 'monthly_current', criteriaIdentifier: 'numberOfSales', kwh: 9250 },
  // All Time - Total Sales Value
  { rankPosition: 0, userId: 'user1', userName: 'Vendedor Um', userPhotoUrl: MOCK_LOGGED_IN_USER.photoURL || undefined, mainScoreDisplay: 'R$ 150.000,00', mainScoreValue: 150000, detailScore1Label: 'Nº Vendas', detailScore1Value: 25, periodIdentifier: 'all_time', criteriaIdentifier: 'totalSalesValue', kwh: 75000 },
  { rankPosition: 0, userId: 'user2', userName: 'Vendedor Dois', userPhotoUrl: 'https://placehold.co/100x100.png?text=V2', mainScoreDisplay: 'R$ 120.000,00', mainScoreValue: 120000, detailScore1Label: 'Nº Vendas', detailScore1Value: 20, periodIdentifier: 'all_time', criteriaIdentifier: 'totalSalesValue', kwh: 60000 },
  { rankPosition: 0, userId: 'user3', userName: 'Vendedor Três', userPhotoUrl: 'https://placehold.co/100x100.png?text=V3', mainScoreDisplay: 'R$ 90.000,00', mainScoreValue: 90000, detailScore1Label: 'Nº Vendas', detailScore1Value: 15, periodIdentifier: 'all_time', criteriaIdentifier: 'totalSalesValue', kwh: 45000 },
  { rankPosition: 0, userId: 'user4', userName: 'Vendedor Quatro', userPhotoUrl: 'https://placehold.co/100x100.png?text=V4',mainScoreDisplay: 'R$ 75.000,00', mainScoreValue: 75000, detailScore1Label: 'Nº Vendas', detailScore1Value: 10, periodIdentifier: 'all_time', criteriaIdentifier: 'totalSalesValue', kwh: 37500 },
  // All Time - Number of Sales
  { rankPosition: 0, userId: 'user1', userName: 'Vendedor Um', userPhotoUrl: MOCK_LOGGED_IN_USER.photoURL || undefined, mainScoreDisplay: '25 Vendas', mainScoreValue: 25, detailScore1Label: 'Volume (R$)', detailScore1Value: 'R$ 150.000,00', periodIdentifier: 'all_time', criteriaIdentifier: 'numberOfSales', kwh: 75000 },
  { rankPosition: 0, userId: 'user2', userName: 'Vendedor Dois', userPhotoUrl: 'https://placehold.co/100x100.png?text=V2',mainScoreDisplay: '20 Vendas', mainScoreValue: 20, detailScore1Label: 'Volume (R$)', detailScore1Value: 'R$ 120.000,00', periodIdentifier: 'all_time', criteriaIdentifier: 'numberOfSales', kwh: 60000 },
];

const PERIOD_OPTIONS = [
  { value: 'monthly_current', label: 'Mensal Atual' },
  { value: 'monthly_previous', label: 'Mensal Anterior' },
  { value: 'annual_current', label: 'Anual Atual' },
  { value: 'all_time', label: 'Todo o Período' },
];

const CRITERIA_OPTIONS = [
  { value: 'totalSalesValue', label: 'Volume de Vendas (R$)' },
  { value: 'numberOfSales', label: 'Número de Vendas' },
];

const formatDisplayValue = (value: string | number | undefined, criteria: string): string => {
  if (value === undefined) return 'N/A';
  if (criteria === 'totalSalesValue' || (typeof value === 'string' && value.startsWith('R$'))) {
    const num = Number(String(value).replace(/[^0-9,.-]+/g,"").replace('.', '').replace(',', '.'));
    return isNaN(num) ? String(value) : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(value);
};

function RankingPageContent() {
  const [rankingData, setRankingData] = useState<RankingDisplayEntry[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(PERIOD_OPTIONS[0].value);
  const [selectedCriteria, setSelectedCriteria] = useState<string>(CRITERIA_OPTIONS[0].value);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(true);
  const loggedInUser = MOCK_LOGGED_IN_USER;

  useEffect(() => {
    setIsLoading(true);
    // Simulate API call / data processing
    const timer = setTimeout(() => {
      const filtered = MOCK_RANKING_ENTRIES.filter(
        entry => entry.periodIdentifier === selectedPeriod && entry.criteriaIdentifier === selectedCriteria
      );
      const sorted = [...filtered].sort((a, b) => b.mainScoreValue - a.mainScoreValue);
      const ranked = sorted.map((entry, index) => ({ ...entry, rankPosition: index + 1 }));
      setRankingData(ranked);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedPeriod, selectedCriteria]);

  const totalKwhSold = useMemo(() => {
    const relevantEntries = MOCK_RANKING_ENTRIES.filter(
      entry => entry.periodIdentifier === selectedPeriod
    );
    const uniqueUserKwh = new Map<string, number>();
    relevantEntries.forEach(entry => {
        uniqueUserKwh.set(entry.userId, entry.kwh);
    });
    return Array.from(uniqueUserKwh.values()).reduce((sum, kwh) => sum + kwh, 0);
  }, [selectedPeriod]);


  const criteriaLabel = CRITERIA_OPTIONS.find(c => c.value === selectedCriteria)?.label || "Performance";

  const loggedInUserRank = useMemo(() => {
    return rankingData.find(entry => entry.userId === loggedInUser.uid);
  }, [rankingData, loggedInUser.uid]);

  const podiumData = useMemo(() => rankingData.slice(0, 3), [rankingData]);

  const getPodiumBorderColor = (index: number) => {
    if (index === 0) return 'border-yellow-400 shadow-yellow-400/30'; // Gold
    if (index === 1) return 'border-slate-400 shadow-slate-400/30'; // Silver
    if (index === 2) return 'border-yellow-600 shadow-yellow-600/30'; // Bronze
    return 'border-border';
  };
  
  const getPodiumTextColor = (index: number) => {
    if (index === 0) return 'text-yellow-400';
    if (index === 1) return 'text-slate-400';
    if (index === 2) return 'text-yellow-600';
    return 'text-foreground';
  };


  return (
    <div className="container mx-auto px-4 py-8 text-foreground">
      {/* Notification banner */}
      {showNotification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-in fade-in-50">
          <Card className="relative max-w-2xl w-full bg-card/90 border-primary shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full z-50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              onClick={() => setShowNotification(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Fechar</span>
            </Button>
            <CardContent className="p-0">
              <Image
                src="https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/e2ace5e621fa15e3ebfb6cd3ed9fed3122e8928e/ChatGPT%20Image%2023%20de%20jun.%20de%202025%2C%2015_38_04.png"
                alt="Notificação da Campanha de Ranking"
                width={1024}
                height={576}
                className="rounded-lg object-contain"
                data-ai-hint="trophy award announcement"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <header className="text-center mb-12">
        <Award className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary tracking-tight">
          Ranking de Performance
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Acompanhe os top performers e sua posição na equipe Planus Energia.
        </p>
      </header>

      <Card className="mb-8 bg-primary/10 border-primary shadow-xl text-center">
        <CardHeader>
          <CardTitle className="text-xl font-medium text-primary flex items-center justify-center">
            <Zap className="w-6 h-6 mr-2" />
            Total de KWh Vendido (Time)
          </CardTitle>
          <CardDescription>Performance total da equipe no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-6xl font-bold text-foreground">{totalKwhSold.toLocaleString('pt-BR')} <span className="text-2xl text-muted-foreground">kWh</span></p>
        </CardContent>
      </Card>

      <Card className="mb-8 bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtros do Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="period-select" className="block text-sm font-medium text-muted-foreground mb-1">Período</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger id="period-select"><SelectValue placeholder="Selecione o período" /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="criteria-select" className="block text-sm font-medium text-muted-foreground mb-1">Critério</label>
            <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
              <SelectTrigger id="criteria-select"><SelectValue placeholder="Selecione o critério" /></SelectTrigger>
              <SelectContent>
                {CRITERIA_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {isLoading && (
         <div className="flex flex-col justify-center items-center h-64 bg-transparent text-primary">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-lg font-medium">Carregando ranking...</p>
        </div>
      )}

      {!isLoading && rankingData.length > 0 && (
        <>
          {/* Podium Section */}
          {podiumData.length > 0 && (
            <section className="mb-12">
              <h2 className="text-3xl font-semibold text-center text-foreground mb-8">Pódio dos Campeões <Crown className="inline-block text-yellow-400 ml-2 h-7 w-7" /></h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {podiumData.map((entry, index) => (
                  <Card key={entry.userId} className={`bg-card/80 backdrop-blur-xl border-2 ${getPodiumBorderColor(index)} shadow-lg text-center p-6 flex flex-col items-center hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1`}>
                    <div className={`text-5xl font-black mb-3 ${getPodiumTextColor(index)}`}>
                      {entry.rankPosition}º
                    </div>
                    <Avatar className="w-24 h-24 mb-4 border-4 border-primary/50">
                      <AvatarImage src={entry.userPhotoUrl} alt={entry.userName} data-ai-hint="user avatar" />
                      <AvatarFallback className="text-2xl">{entry.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-semibold text-primary mb-1 truncate max-w-full">{entry.userName}</h3>
                    <p className="text-2xl font-bold text-foreground">{entry.mainScoreDisplay}</p>
                    <p className="text-xs text-muted-foreground">{criteriaLabel}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* My Position Section */}
          {loggedInUserRank && (
            <Card className="my-8 bg-primary/10 border-primary/50 border-2 shadow-xl p-6">
              <CardHeader className="p-0 pb-3 text-center md:text-left">
                <CardTitle className="text-2xl text-primary flex items-center justify-center md:justify-start">
                  <UserCircle className="mr-3 h-7 w-7" /> Minha Posição no Ranking
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col md:flex-row items-center justify-around text-center md:text-left space-y-4 md:space-y-0 md:space-x-4">
                <div className="text-center">
                  <p className="text-5xl font-bold text-primary">{loggedInUserRank.rankPosition}º</p>
                  <p className="text-muted-foreground">Sua Posição</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-semibold text-foreground">{loggedInUserRank.mainScoreDisplay}</p>
                  <p className="text-muted-foreground">{criteriaLabel}</p>
                </div>
                {loggedInUserRank.detailScore1Label && (
                   <div className="text-center hidden sm:block">
                    <p className="text-2xl font-semibold text-foreground">{formatDisplayValue(loggedInUserRank.detailScore1Value, selectedCriteria === 'numberOfSales' ? 'totalSalesValue' : 'numberOfSales')}</p>
                    <p className="text-muted-foreground">{loggedInUserRank.detailScore1Label}</p>
                  </div>
                )}
                 {loggedInUserRank.detailScore2Label && (
                   <div className="text-center hidden md:block">
                    <p className="text-2xl font-semibold text-foreground">{formatDisplayValue(loggedInUserRank.detailScore2Value, 'currency')}</p>
                    <p className="text-muted-foreground">{loggedInUserRank.detailScore2Label}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Full Ranking Table */}
          <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Classificação Completa</CardTitle>
              <CardDescription>Desempenho da equipe para {PERIOD_OPTIONS.find(p=>p.value === selectedPeriod)?.label || selectedPeriod} por {criteriaLabel.toLowerCase()}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"><Hash className="h-4 w-4 text-muted-foreground"/></TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">{selectedCriteria === 'totalSalesValue' ? <DollarSign className="h-4 w-4 inline-block mr-1 text-muted-foreground"/> : <ListOrdered className="h-4 w-4 inline-block mr-1 text-muted-foreground"/>} {criteriaLabel}</TableHead>
                    {rankingData[0]?.detailScore1Label && <TableHead className="text-right hidden md:table-cell">{rankingData[0].detailScore1Label}</TableHead>}
                    {rankingData[0]?.detailScore2Label && <TableHead className="text-right hidden lg:table-cell">{rankingData[0].detailScore2Label}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingData.map((entry) => (
                    <TableRow key={entry.userId} className={entry.userId === loggedInUser.uid ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}>
                      <TableCell className="font-bold text-lg text-center">{entry.rankPosition}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={entry.userPhotoUrl} alt={entry.userName} data-ai-hint="user avatar" />
                            <AvatarFallback>{entry.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{entry.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{entry.mainScoreDisplay}</TableCell>
                      {entry.detailScore1Label && <TableCell className="text-right hidden md:table-cell">{formatDisplayValue(entry.detailScore1Value, selectedCriteria === 'numberOfSales' ? 'totalSalesValue' : 'numberOfSales')}</TableCell>}
                      {entry.detailScore2Label && <TableCell className="text-right hidden lg:table-cell">{formatDisplayValue(entry.detailScore2Value, 'currency')}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground pt-4">
              <p>* O ranking é atualizado periodicamente. Os valores são baseados em leads com status 'assinado'.</p>
            </CardFooter>
          </Card>
        </>
      )}
      
      {!isLoading && rankingData.length === 0 && (
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl mt-8">
          <CardContent className="p-10 text-center">
            <ListOrdered className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">Nenhum dado de ranking encontrado para os filtros selecionados.</p>
            <p className="text-sm text-muted-foreground mt-2">Tente ajustar o período ou critério.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function RankingPage() {
  // Simulate checking user role, in a real app this would come from auth context
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // This logic now runs only on the client after hydration
    const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const role = loggedIn ? 'vendedor' : 'admin'; // Example: 'vendedor' if logged in, 'admin' if not
    setUserRole(role);

    if (role === 'vendedor' || role === 'admin') {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      // Optionally redirect if not authorized, e.g., router.push('/login');
      // For this example, we'll just show a message.
    }
  }, []);

  if (isAuthorized === null) {
     return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">Verificando autorização...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <TrendingUp size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
        <Link href="/" passHref>
          <Button variant="link" className="mt-4">Voltar para a Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">Carregando Ranking...</p>
      </div>
    }>
      <RankingPageContent />
    </Suspense>
  );
}
