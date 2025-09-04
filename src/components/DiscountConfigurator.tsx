// src/components/DiscountConfigurator.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscountConfig {
  type: 'promotional' | 'fixed';
  promotional?: {
    rate: number;
    durationMonths: number;
    subsequentRate: number;
  };
  fixed?: {
    rate: number;
  };
}

interface DiscountConfiguratorProps {
  config: DiscountConfig;
  onConfigChange: (newConfig: DiscountConfig) => void;
}

export function DiscountConfigurator({ config, onConfigChange }: DiscountConfiguratorProps) {

  const handleTypeChange = (type: 'promotional' | 'fixed') => {
    onConfigChange({ ...config, type });
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (config.type === 'promotional' && config.promotional) {
      onConfigChange({
        ...config,
        promotional: { ...config.promotional, [field]: numValue },
      });
    } else if (config.type === 'fixed' && config.fixed) {
      onConfigChange({
        ...config,
        fixed: { ...config.fixed, [field]: numValue },
      });
    }
  };

  return (
    <Card className="w-full shadow-xl bg-card/70 backdrop-blur-lg border">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-primary flex items-center">
          <SlidersHorizontal className="mr-2 h-5 w-5" />
          Configuração de Desconto
        </CardTitle>
        <CardDescription className="mt-1">
          Escolha como o desconto será aplicado na simulação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={config.type} onValueChange={handleTypeChange as (value: string) => void}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="promotional" id="promotional" />
            <Label htmlFor="promotional">Desconto Promocional</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixed" id="fixed" />
            <Label htmlFor="fixed">Desconto Fixo</Label>
          </div>
        </RadioGroup>

        <div className={cn("space-y-4 p-4 border rounded-md transition-opacity", config.type !== 'promotional' && "opacity-50 pointer-events-none")}>
          <h4 className="font-semibold text-sm text-muted-foreground">Detalhes Promocionais</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="promoRate" className="text-xs">Taxa Promo (%)</Label>
              <Input
                id="promoRate"
                type="number"
                value={config.promotional?.rate}
                onChange={(e) => handleInputChange('rate', e.target.value)}
                disabled={config.type !== 'promotional'}
              />
            </div>
            <div>
              <Label htmlFor="promoDuration" className="text-xs">Duração (meses)</Label>
              <Input
                id="promoDuration"
                type="number"
                value={config.promotional?.durationMonths}
                onChange={(e) => handleInputChange('durationMonths', e.target.value)}
                disabled={config.type !== 'promotional'}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="subsequentRate" className="text-xs">Taxa Subsequente (%)</Label>
            <Input
              id="subsequentRate"
              type="number"
              value={config.promotional?.subsequentRate}
              onChange={(e) => handleInputChange('subsequentRate', e.target.value)}
              disabled={config.type !== 'promotional'}
            />
          </div>
        </div>

        <div className={cn("space-y-4 p-4 border rounded-md transition-opacity", config.type !== 'fixed' && "opacity-50 pointer-events-none")}>
          <h4 className="font-semibold text-sm text-muted-foreground">Detalhes do Desconto Fixo</h4>
          <div>
            <Label htmlFor="fixedRate" className="text-xs">Taxa Fixa (%)</Label>
            <Input
              id="fixedRate"
              type="number"
              value={config.fixed?.rate}
              onChange={(e) => handleInputChange('rate', e.target.value)}
              disabled={config.type !== 'fixed'}
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
