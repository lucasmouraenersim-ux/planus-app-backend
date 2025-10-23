"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CheckCircle, Zap, TrendingUp, Users, FileText, CalendarClock, Leaf, ShieldCheck, User, Briefcase, PackageMinus, CircleDollarSign, Receipt, Phone, ArrowRight, Camera, LineChart, CloudRain, Loader2 } from 'lucide-react';
import { calculateSavings } from '@/lib/discount-calculator';
import Image from 'next/image';
import { getLandingPageStats } from '@/actions/public/getLandingPageStats';
import { getFinalizedKwh } from '@/actions/public/getFinalizedKwh';
import { cn } from '@/lib/utils';
import { FakeLogin } from '@/components/auth/FakeLogin';
import { PhotoEnhancer } from '@/components/photo/PhotoEnhancer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';


const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const duration = 1500; // Animation duration in milliseconds

  useEffect(() => {
    let startTimestamp: number | null = null;
    const animationFrame = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const nextValue = Math.floor(progress * value);
      
      setDisplayValue(nextValue);
      
      if (progress < 1) {
        requestAnimationFrame(animationFrame);
      }
    };
    requestAnimationFrame(animationFrame);
  }, [value]);

  return <>{displayValue.toLocaleString('pt-BR')}</>;
};

const EnergySection = () => {
    const [billAmount, setBillAmount] = useState(1000);
    const savings = calculateSavings(billAmount, { type: 'fixed', fixed: { rate: 15 }});
    // Initialize totalKwh to 0 or a default value
    const [stats, setStats] = useState({ totalKwh: 0, pfCount: 300, pjCount: 188 });

    useEffect(() => {
      const fetchStats = async () => {
        // Fetch existing landing page stats
        const existingStatsResult = await getLandingPageStats();
        let currentPfCount = 300;
        let currentPjCount = 188;
        if (existingStatsResult.success && existingStatsResult.stats) {
          currentPfCount = existingStatsResult.stats.pfCount;
          currentPjCount = existingStatsResult.stats.pjCount;
        }

        // Fetch finalized kWh from CRM
        const finalizedKwhResult = await getFinalizedKwh();
        let finalizedKwh = 0;
        if (finalizedKwhResult.success && typeof finalizedKwhResult.totalKwh === 'number') {
          finalizedKwh = finalizedKwhResult.totalKwh;
        }

        // Update stats state with fetched values
        setStats({
          totalKwh: finalizedKwh,
          pfCount: currentPfCount,
          pjCount: currentPjCount,
        });
      };
      fetchStats(); 
    }, []); // Empty dependency array to run once on mount

    const handleSliderChange = (value: number[]) => {
      setBillAmount(value[0]);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      setBillAmount(isNaN(value) ? 0 : value);
    };
    return (
        <>
        {/* Hero Section */}
        <section className="relative text-center py-24 px-4 overflow-hidden">
            <div className="absolute inset-0 z-0">
                <Image src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/refs/heads/main/Whisk_7171a56086%20(2).svg" alt="Blurred Background" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center" }} className="filter blur-sm opacity-30" data-ai-hint="abstract background" />
                <div className="absolute inset-0 bg-background/70"></div>
            </div>
            <div className="relative z-10">
                <h1 className="text-4xl md:text-6xl font-bold text-primary mb-4 animate-fade-in-down">Reduza sua conta de luz em até 30%</h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-fade-in-down animation-delay-300">
                Com a Sent Energia, você acessa fontes de energia renovável, economiza dinheiro e ajuda o planeta. Sem instalação, sem obras e sem investimento inicial.
                </p>
                <div className="flex gap-4 justify-center animate-fade-in-up animation-delay-600">
                    <Link href="#calculator">
                        <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">Simule sua Economia</Button>
                    </Link>
                    <Link href="/login">
                        <Button size="lg" variant="outline" className="border-primary/50 hover:border-primary text-primary/90 hover:text-primary hover:bg-primary/10">Área do Consultor</Button>
                    </Link>
                </div>
            </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Nosso Impacto em Números</h2>
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg">
                <CardHeader>
                <Zap className="w-10 h-10 mx-auto text-primary mb-2" />
                <CardTitle className="text-4xl font-bold"><AnimatedNumber value={stats.totalKwh} /></CardTitle>
                </CardHeader>
                <CardContent>
                <p className="text-muted-foreground">kWh Conectados</p>
                </CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg">
                <CardHeader>
                <User className="w-10 h-10 mx-auto text-primary mb-2" />
                <CardTitle className="text-4xl font-bold"><AnimatedNumber value={stats.pfCount} /></CardTitle>
                </CardHeader>
                <CardContent>
                <p className="text-muted-foreground">Clientes Pessoa Física</p>
                </CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg">
                <CardHeader>
                <Briefcase className="w-10 h-10 mx-auto text-primary mb-2" />
                <CardTitle className="text-4xl font-bold"><AnimatedNumber value={stats.pjCount} /></CardTitle>
                </CardHeader>
                <CardContent>
                <p className="text-muted-foreground">Clientes Pessoa Jurídica</p>
                </CardContent>
            </Card>
            </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-muted/30">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Como Funciona? É Simples!</h2>
            <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-20 w-20 flex items-center justify-center text-3xl font-bold mb-4 border-4 border-primary/30">1</div>
                <h3 className="text-xl font-semibold mb-2">Análise da Fatura</h3>
                <p className="text-muted-foreground">Analisamos sua fatura para entender seu consumo e apresentar a melhor solução de economia.</p>
            </div>
            <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-20 w-20 flex items-center justify-center text-3xl font-bold mb-4 border-4 border-primary/30">2</div>
                <h3 className="text-xl font-semibold mb-2">Adesão Digital</h3>
                <p className="text-muted-foreground">Você assina digitalmente, sem burocracia. Cuidamos de toda a comunicação com sua distribuidora.</p>
            </div>
            <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-20 w-20 flex items-center justify-center text-3xl font-bold mb-4 border-4 border-primary/30">3</div>
                <h3 className="text-xl font-semibold mb-2">Economia na Prática</h3>
                <p className="text-muted-foreground">Em até 90 dias, você começa a receber sua nova fatura com o desconto aplicado, direto no seu e-mail.</p>
            </div>
            </div>
        </section>

        {/* Why Sent Section */}
        <section className="py-16 px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Por Que Nosso Desconto é Vantajoso?</h2>
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0">
                <PackageMinus className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle className="text-xl font-semibold">Sem Obras ou Instalação</CardTitle>
                </CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Receba créditos de energia limpa direto na sua fatura, sem precisar instalar painéis solares.</p></CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0"><ShieldCheck className="w-12 h-12 mx-auto text-primary mb-4" /><CardTitle className="text-xl font-semibold">Livre de Bandeiras Tarifárias</CardTitle></CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Nossa energia não sofre acréscimo das bandeiras (amarela e vermelha), garantindo uma economia estável.</p></CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0"><FileText className="w-12 h-12 mx-auto text-primary mb-4" /><CardTitle className="text-xl font-semibold">100% Digital e Sem Burocracia</CardTitle></CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Todo o processo de adesão é online, de forma rápida, segura e sem papelada.</p></CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0"><Leaf className="w-12 h-12 mx-auto text-primary mb-4" /><CardTitle className="text-xl font-semibold">Energia Limpa e Sustentável</CardTitle></CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Você consome energia de fontes renováveis, contribuindo para um futuro mais verde.</p></CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0"><CircleDollarSign className="w-12 h-12 mx-auto text-primary mb-4" /><CardTitle className="text-xl font-semibold">Sem Investimento Inicial</CardTitle></CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Você não precisa gastar nada para começar a economizar. Sem taxas de adesão ou mensalidade.</p></CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-lg border shadow-lg text-center p-6 hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0"><Receipt className="w-12 h-12 mx-auto text-primary mb-4" /><CardTitle className="text-xl font-semibold">Desconto Real na Fatura</CardTitle></CardHeader>
                <CardContent className="p-0 mt-4"><p className="text-muted-foreground text-sm">Sua economia é garantida e vem refletida na sua conta de luz, que passa a ser emitida pela Sent.</p></CardContent>
            </Card>
            </div>
        </section>
        
        {/* Savings Calculator */}
        <section id="calculator" className="py-16 px-4 bg-muted/30">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Simule sua Economia Anual</h2>
            <Card className="max-w-3xl mx-auto shadow-lg bg-card/70">
            <CardHeader>
                <CardTitle>Quanto você paga na sua conta de luz mensalmente?</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                <Input type="number" value={billAmount} onChange={handleInputChange} className="text-2xl h-14 mb-4 text-center font-bold" />
                <Slider value={[billAmount]} onValueChange={handleSliderChange} min={100} max={20000} step={50} />
                </div>
                <div className="text-center bg-primary/10 p-6 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">Sua economia anual estimada</p>
                <p className="text-4xl md:text-5xl font-bold text-primary my-2">{formatCurrency(savings.annualSaving)}</p>
                <p className="text-sm text-muted-foreground">Com desconto efetivo de <span className="font-bold">{savings.effectiveAnnualDiscountPercentage}%</span> ao ano.</p>
                </div>
            </CardContent>
            <CardDescription className="text-center px-6 pb-4 text-xs">{savings.discountDescription}</CardDescription>
            </Card>
        </section>

        {/* Legal Basis & Timeline */}
        <section className="py-16 px-4 grid md:grid-cols-2 gap-12 max-w-6xl mx-auto items-start">
            <div>
            <h3 className="text-3xl font-bold text-primary mb-4 flex items-center"><ShieldCheck className="w-8 h-8 mr-3"/>Baseado na Lei</h3>
            <div className="text-muted-foreground space-y-3"><p>A Geração Distribuída (GD) é regulamentada pela ANEEL (Resolução Normativa 1.059/2023), permitindo que a energia gerada por fontes renováveis (como solar, eólica, biomassa) seja injetada na rede da distribuidora local.</p><p>Essa energia se transforma em créditos que são utilizados para abater o consumo de nossos clientes, gerando a economia na fatura de luz. É um processo seguro, legal e que promove a sustentabilidade.</p></div>
            </div>
            <div>
            <h3 className="text-3xl font-bold text-primary mb-4 flex items-center"><CalendarClock className="w-8 h-8 mr-3"/>Cronograma</h3>
            <ul className="list-none space-y-3">
                <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">Dia 1:</strong> Assinatura digital do contrato.</p></li>
                <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">Até 30 Dias:</strong> A Sent informa a distribuidora sobre a adesão.</p></li>
                <li className="flex flex-col items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">De 60 a 90 Dias:</strong> A distribuidora processa a alteração e, no ciclo de faturamento seguinte, você recebe sua primeira fatura com o desconto da Sent.</p></li>
            </ul>
            </div>
        </section>

        {/* Our Clients */}
        <section className="py-16 px-4 bg-muted/30">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Clientes que Confiam na Sent</h2>
            <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
                <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 1" className="opacity-60" data-ai-hint="company logo"/>
                <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 2" className="opacity-60" data-ai-hint="company logo"/>
                <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 3" className="opacity-60" data-ai-hint="company logo"/>
                <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 4" className="opacity-60" data-ai-hint="company logo"/>
                <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 5" className="opacity-60" data-ai-hint="company logo"/>
            </div>
        </section>

        {/* Lead Capture Section */}
        <section className="py-20 px-4 bg-primary/5">
            <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">Pronto para Economizar?</h2>
            <p className="text-lg text-muted-foreground mb-8">
                Deixe suas informações e um de nossos consultores entrará em contato para mostrar o caminho da economia.
            </p>
            <Card className="text-left shadow-lg bg-card">
                <CardContent className="p-6 space-y-4">
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <div>
                    <Label htmlFor="lead-name" className="text-sm font-medium text-muted-foreground">Nome Completo</Label>
                    <div className="relative mt-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="lead-name" placeholder="Seu nome" className="pl-10"/>
                    </div>
                    </div>
                    <div>
                    <Label htmlFor="lead-phone" className="text-sm font-medium text-muted-foreground">Número de Telefone</Label>
                    <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="lead-phone" type="tel" placeholder="(XX) XXXXX-XXXX" className="pl-10"/>
                    </div>
                    </div>
                    <div>
                    <Label htmlFor="lead-bill" className="text-sm font-medium text-muted-foreground">Valor Médio da Conta de Energia</Label>
                    <div className="relative mt-1">
                        <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="lead-bill" type="number" placeholder="Ex: 500" className="pl-10"/>
                    </div>
                    </div>
                    <Button type="submit" size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-2">
                    Quero Fazer Parte! <ArrowRight className="ml-2 h-5 w-5"/>
                    </Button>
                </form>
                </CardContent>
            </Card>
            </div>
        </section>
        </>
    );
}

const PhotoSection = () => {
  const { appUser, isLoadingAuth, firebaseUser } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  // This handles the case where the user is already logged in via the main app's AuthProvider
  useEffect(() => {
    if (!isLoadingAuth && firebaseUser) {
      setIsLoggedIn(true);
    }
  }, [isLoadingAuth, firebaseUser]);
  
  const handleLoginSuccess = () => {
      setIsLoggedIn(true);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center px-4">
        <Loader2 className="w-12 h-12 text-[#a855f7] animate-spin mb-4" />
        <p className="text-lg text-slate-400">Carregando...</p>
      </div>
    );
  }
  
  if (!isLoggedIn) {
      return <FakeLogin onLogin={handleLoginSuccess} />;
  }

  // If user is logged in, show the photo enhancer.
  return <PhotoEnhancer />;
};

const ForexSection = () => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center px-4">
    <LineChart className="w-24 h-24 text-primary mb-6 opacity-30" />
    <h2 className="text-4xl font-bold text-primary">Invista em Forex com Inteligência</h2>
    <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
      Uma nova plataforma para análise e investimento no mercado Forex está em desenvolvimento. Volte em breve para mais novidades.
    </p>
  </div>
);


const LandingPage = () => {
  const [selectedApp, setSelectedApp] = useState<'energia' | 'foto' | 'forex'>('energia');

  return (
    <div className={cn("text-foreground", selectedApp === 'foto' ? 'bg-[#171821]' : 'bg-background' )}>
      {/* Top Menu */}
      <header className={cn("sticky top-0 z-50  border-b", selectedApp === 'foto' ? 'bg-[#171821]/80 border-slate-800' : 'bg-background/80 border-border')}>
        <nav className="container mx-auto px-4 py-2 flex justify-center items-center gap-4">
            <Button 
                variant={selectedApp === 'energia' ? 'default' : 'ghost'} 
                onClick={() => setSelectedApp('energia')}
                className="transition-all"
            >
                <Zap className="mr-2 h-4 w-4"/>
                Economize Energia
            </Button>
            <Button 
                variant={selectedApp === 'foto' ? 'default' : 'ghost'} 
                onClick={() => setSelectedApp('foto')}
                className="transition-all"
            >
                <Camera className="mr-2 h-4 w-4"/>
                Melhore sua Foto
            </Button>
            <Button 
                variant={selectedApp === 'forex' ? 'default' : 'ghost'} 
                onClick={() => setSelectedApp('forex')}
                className="transition-all"
            >
                <LineChart className="mr-2 h-4 w-4"/>
                Invista em Forex
            </Button>
            <Link href="/meteorologia" passHref>
              <Button variant='ghost' className="transition-all">
                  <CloudRain className="mr-2 h-4 w-4"/>
                  Meteorologia BR
              </Button>
            </Link>
        </nav>
      </header>

      {/* Conditional Content */}
      <main>
        {selectedApp === 'energia' && <EnergySection />}
        {selectedApp === 'foto' && <PhotoSection />}
        {selectedApp === 'forex' && <ForexSection />}
      </main>

      {/* Footer */}
      <footer className={cn("text-center py-6 border-t", selectedApp === 'foto' ? 'bg-[#171821] border-slate-800' : 'bg-background border-border')}>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sent Energia. Todos os direitos reservados.</p>
        <Link href="/politica-de-privacidade" className="text-sm text-primary hover:underline mt-1 inline-block">Política de Privacidade</Link>
      </footer>
    </div>
  );
}

export default LandingPage;
