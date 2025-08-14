"use client";

import type { Bankroll, Operation, ProjectionDay } from '@/types/forex';
import { addDays, differenceInDays, eachDayOfInterval, endOfYear, format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

interface ForexContextType {
    bankroll: Bankroll | null;
    setBankroll: (bankroll: Bankroll | null) => void;
    operations: Operation[];
    addOperation: (operation: Operation) => void;
    updateOperation: (operation: Operation) => void;
    deleteOperation: (id: string) => void;
    projection: ProjectionDay[];
    dailyPerformance: {
        totalProfitLoss: number;
        avgEvolution: number;
        bestDay: number;
        worstDay: number;
    };
    filteredChartData: any[];
    setDateRange: (range: 'all' | 'last7' | 'last30' | DateRange | undefined) => void;
}

const ForexContext = createContext<ForexContextType | undefined>(undefined);

export const ForexProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [bankroll, setBankrollState] = useState<Bankroll | null>(null);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [dateRange, setDateRange] = useState<'all' | 'last7' | 'last30' | DateRange | undefined>('all');

    useEffect(() => {
        const savedBankroll = localStorage.getItem('forexBankroll');
        const savedOps = localStorage.getItem('forexOperations');
        if (savedBankroll) {
            setBankrollState(JSON.parse(savedBankroll));
        }
        if (savedOps) {
            setOperations(JSON.parse(savedOps));
        }
    }, []);

    const setBankroll = (newBankroll: Bankroll | null) => {
        setBankrollState(newBankroll);
        if (newBankroll) {
            localStorage.setItem('forexBankroll', JSON.stringify(newBankroll));
        } else {
            localStorage.removeItem('forexBankroll');
        }
    };
    
    const persistOperations = (ops: Operation[]) => {
        localStorage.setItem('forexOperations', JSON.stringify(ops));
    };

    const addOperation = (operation: Operation) => {
        const newOps = [...operations, operation];
        setOperations(newOps);
        persistOperations(newOps);
    };

    const updateOperation = (updatedOperation: Operation) => {
        const newOps = operations.map(op => op.id === updatedOperation.id ? updatedOperation : op);
        setOperations(newOps);
        persistOperations(newOps);
    };

    const deleteOperation = (id: string) => {
        const newOps = operations.filter(op => op.id !== id);
        setOperations(newOps);
        persistOperations(newOps);
    };

    const { projection, dailyPerformance, filteredChartData } = useMemo(() => {
        if (!bankroll) return { projection: [], dailyPerformance: { totalProfitLoss: 0, avgEvolution: 0, bestDay: 0, worstDay: 0 }, filteredChartData: [] };

        const startDate = parseISO(bankroll.startDate);
        const today = new Date();
        const interval = eachDayOfInterval({ start: startDate, end: today });

        const operationsByDate: { [key: string]: number } = {};
        operations.forEach(op => {
            if (op.status === 'Fechada') {
                const dateKey = format(parseISO(op.date), 'yyyy-MM-dd');
                operationsByDate[dateKey] = (operationsByDate[dateKey] || 0) + op.result;
            }
        });

        let currentCapital = bankroll.initialCapital;
        const dailyPerformanceData: { date: string, capital: number, profit: number }[] = [];

        for (const day of interval) {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyProfit = operationsByDate[dateKey] || 0;
            currentCapital += dailyProfit;
            dailyPerformanceData.push({ date: dateKey, capital: currentCapital, profit: dailyProfit });
        }

        const totalProfitLoss = dailyPerformanceData.reduce((acc, day) => acc + day.profit, 0);
        const avgEvolution = dailyPerformanceData.length > 0 ? (dailyPerformanceData.reduce((acc, day, i) => {
            const prevCapital = i > 0 ? dailyPerformanceData[i-1].capital : bankroll.initialCapital;
            return acc + (day.profit / prevCapital * 100);
        }, 0) / dailyPerformanceData.length) : 0;
        const bestDay = Math.max(0, ...dailyPerformanceData.map(d => d.profit));
        const worstDay = Math.min(0, ...dailyPerformanceData.map(d => d.profit));


        // Projection calculation
        const projectionDays = eachDayOfInterval({ start: startDate, end: endOfYear(today) });
        const projResult: ProjectionDay[] = [];
        let projCapitals = [bankroll.initialCapital, bankroll.initialCapital, bankroll.initialCapital, bankroll.initialCapital, bankroll.initialCapital];

        projectionDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const actualCapital = dailyPerformanceData.find(d => d.date === dateKey)?.capital || (projResult.length > 0 ? projResult[projResult.length - 1].actualCapital : bankroll.initialCapital);

            projResult.push({
                date: day.toISOString(),
                actualCapital,
                proj1: projCapitals[0],
                proj2: projCapitals[1],
                proj3: projCapitals[2],
                proj4: projCapitals[3],
                proj5: projCapitals[4],
                drawdown: actualCapital * 0.15,
                lowRiskLots: actualCapital * 0.10 / 1000,
                highRiskLots: actualCapital * 0.20 / 1000
            });
            projCapitals = projCapitals.map((cap, i) => cap * (1 + (i + 1) / 100));
        });

        // Filtering for chart
        let chartData = projResult.filter(d => parseISO(d.date) <= today);

        if (dateRange instanceof Object && dateRange.from) {
             const toDate = dateRange.to ? addDays(dateRange.to, 1) : addDays(dateRange.from, 1);
             chartData = chartData.filter(d => {
                 const day = parseISO(d.date);
                 return day >= dateRange.from! && day < toDate;
             });
        } else if (dateRange === 'last7') {
             chartData = chartData.slice(-7);
        } else if (dateRange === 'last30') {
             chartData = chartData.slice(-30);
        }


        return {
            projection: projResult,
            dailyPerformance: { totalProfitLoss, avgEvolution, bestDay, worstDay },
            filteredChartData: chartData
        };

    }, [bankroll, operations, dateRange]);


    const value: ForexContextType = {
        bankroll,
        setBankroll,
        operations,
        addOperation,
        updateOperation,
        deleteOperation,
        projection,
        dailyPerformance,
        filteredChartData,
        setDateRange
    };

    return (
        <ForexContext.Provider value={value}>
            {children}
        </ForexContext.Provider>
    );
};

export const useForex = (): ForexContextType => {
  const context = useContext(ForexContext);
  if (context === undefined) {
    throw new Error('useForex must be used within a ForexProvider');
  }
  return context;
};
