"use client";

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface RankingData {
  pos: number;
  playerName: string;
  daysCount: number;
  hailPoints: number;
  windPoints: number;
  tornadoPoints: number;
  totalPoints: number;
}

// Mock data to simulate the backend response
const MOCK_DATA: RankingData[] = [
  { pos: 1, playerName: 'Jogador Exemplo A', daysCount: 5, hailPoints: 120, windPoints: 80, tornadoPoints: 50, totalPoints: 250 },
  { pos: 2, playerName: 'Previsor B', daysCount: 4, hailPoints: 90, windPoints: 100, tornadoPoints: 0, totalPoints: 190 },
  { pos: 3, playerName: 'StormChaser C', daysCount: 5, hailPoints: 50, windPoints: 75, tornadoPoints: 60, totalPoints: 185 },
];

export default function RankingPrevisoesPage() {
  const { userAppRole } = useAuth();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadData = () => {
    setIsLoading(true);
    setError(null);
    console.log(`Carregando dados de ${startDate} até ${endDate}`);
    // Simulate API call
    setTimeout(() => {
      // In a real app, you would fetch data from your backend here
      // For now, we just use the mock data
      setRankingData(MOCK_DATA);
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    handleLoadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold text-primary">
            <Trophy className="mr-3 h-6 w-6" />
            Ranking de Previsões Meteorológicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 border rounded-lg bg-card-foreground/5">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate">De:</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="endDate">Até:</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button onClick={handleLoadData} disabled={isLoading}>
              {isLoading ? 'Carregando...' : 'Carregar Ranking'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Granizo</TableHead>
                  <TableHead>Vento</TableHead>
                  <TableHead>Tornado</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center">Carregando...</TableCell></TableRow>
                ) : error ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-destructive">{error}</TableCell></TableRow>
                ) : rankingData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center">Nenhum registro encontrado para o período.</TableCell></TableRow>
                ) : (
                  rankingData.map((row) => (
                    <TableRow key={row.pos}>
                      <TableCell>{row.pos}</TableCell>
                      <TableCell>{row.playerName}</TableCell>
                      <TableCell>{row.daysCount}</TableCell>
                      <TableCell>{row.hailPoints}</TableCell>
                      <TableCell>{row.windPoints}</TableCell>
                      <TableCell>{row.tornadoPoints}</TableCell>
                      <TableCell><strong>{row.totalPoints}</strong></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
