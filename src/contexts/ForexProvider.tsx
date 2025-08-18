"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, Timestamp, runTransaction } from 'firebase/firestore';
import type { ForexBancaConfig, ForexOperation } from '@/types/forex';
import { useToast } from '@/hooks/use-toast';

interface ForexContextType {
    config: ForexBancaConfig | null;
    operations: ForexOperation[];
    isLoading: boolean;
    setConfig: (newConfig: Omit<ForexBancaConfig, 'userId' | 'id'> | null) => Promise<void>;
    addOperation: (operationData: Omit<ForexOperation, 'id' | 'userId' | 'tradeNumber'>) => Promise<void>;
    updateOperation: (operationId: string, updates: Partial<ForexOperation>) => Promise<void>;
    deleteOperation: (operationId: string) => Promise<void>;
}

const ForexContext = createContext<ForexContextType | undefined>(undefined);

export const ForexProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { firebaseUser } = useAuth();
    const { toast } = useToast();
    const [config, setConfigState] = useState<ForexBancaConfig | null>(null);
    const [operations, setOperations] = useState<ForexOperation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const setConfig = async (newConfig: Omit<ForexBancaConfig, 'userId' | 'id'> | null) => {
        if (!firebaseUser) return;
        
        const configRef = doc(db, 'forex_config', firebaseUser.uid);
        
        if (newConfig === null) {
            await deleteDoc(configRef); 
            setConfigState(null);
            setOperations([]);
            return;
        }

        const configToSave: ForexBancaConfig = {
            ...newConfig,
            userId: firebaseUser.uid,
            startDate: Timestamp.fromDate(newConfig.startDate as Date),
        };
        
        await setDoc(configRef, configToSave);
        setConfigState({ ...configToSave, id: firebaseUser.uid, startDate: (configToSave.startDate as Timestamp).toDate().toISOString() });
    };
    
    const addOperation = async (operationData: Omit<ForexOperation, 'id' | 'userId' | 'tradeNumber'>) => {
        if (!firebaseUser) return;

        const operationsRef = collection(db, `forex_config/${firebaseUser.uid}/operations`);
        const counterRef = doc(db, `forex_config/${firebaseUser.uid}/counters/operations_counter`);

        // Use a transaction to safely increment the trade number
        const newTradeNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const newCount = (counterDoc.data()?.count || 0) + 1;
            transaction.set(counterRef, { count: newCount });
            return newCount;
        });

        const dataToSave: { [key: string]: any } = {
            ...operationData,
            tradeNumber: newTradeNumber,
            userId: firebaseUser.uid,
            createdAt: Timestamp.fromDate(operationData.createdAt as Date),
            closedAt: operationData.closedAt ? Timestamp.fromDate(operationData.closedAt as Date) : undefined,
        };

        Object.keys(dataToSave).forEach(key => {
            if (dataToSave[key] === undefined) {
                delete dataToSave[key];
            }
        });

        await addDoc(operationsRef, dataToSave);
    };

    const updateOperation = async (operationId: string, updates: Partial<ForexOperation>) => {
        if (!firebaseUser) return;
        const opRef = doc(db, `forex_config/${firebaseUser.uid}/operations`, operationId);
        
        const updatesToSave: { [key: string]: any } = { ...updates };
        if (updates.createdAt && typeof updates.createdAt !== 'string') {
            updatesToSave.createdAt = Timestamp.fromDate(updates.createdAt as Date);
        }
        if (updates.closedAt && typeof updates.closedAt !== 'string' && updates.closedAt !== null) {
            updatesToSave.closedAt = Timestamp.fromDate(updates.closedAt as Date);
        }
        
         Object.keys(updatesToSave).forEach(key => {
            if (updatesToSave[key] === undefined) {
                delete updatesToSave[key];
            }
        });

        await updateDoc(opRef, updatesToSave);
    };

    const deleteOperation = async (operationId: string) => {
        if (!firebaseUser) return;
        const opRef = doc(db, `forex_config/${firebaseUser.uid}/operations`, operationId);
        await deleteDoc(opRef);
    };
    
    useEffect(() => {
        if (!firebaseUser) {
            setIsLoading(false);
            setConfigState(null);
            setOperations([]);
            return;
        }

        setIsLoading(true);
        const configRef = doc(db, 'forex_config', firebaseUser.uid);
        const fetchConfig = async () => {
            const docSnap = await getDoc(configRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as ForexBancaConfig;
                setConfigState({ ...data, id: docSnap.id, startDate: (data.startDate as Timestamp).toDate().toISOString() });
            } else {
                setConfigState(null);
            }
        };

        fetchConfig().finally(() => setIsLoading(false));
        
        const operationsRef = collection(db, `forex_config/${firebaseUser.uid}/operations`);
        const q = query(operationsRef, orderBy('tradeNumber', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const opsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
                closedAt: doc.data().closedAt ? (doc.data().closedAt as Timestamp).toDate().toISOString() : undefined,
            } as ForexOperation));
            setOperations(opsData);
        }, (error) => {
            console.error("Error fetching operations:", error);
            toast({ title: "Erro ao carregar operações", variant: "destructive" });
        });

        return () => unsubscribe();

    }, [firebaseUser, toast]);

    const value = {
        config,
        operations,
        isLoading,
        setConfig,
        addOperation,
        updateOperation,
        deleteOperation,
    };

    return <ForexContext.Provider value={value}>{children}</ForexContext.Provider>;
};

export const useForex = (): ForexContextType => {
    const context = useContext(ForexContext);
    if (context === undefined) {
        throw new Error('useForex must be used within a ForexProvider');
    }
    return context;
};
