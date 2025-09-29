
// src/components/meteorologia/polygon-manager.ts

import type { Feature, Polygon as TurfPolygon } from '@turf/turf';

// Definições de tipo para clareza
type EsriPolygon = __esri.Polygon;
type EsriGraphic = __esri.Graphic;
type EsriColor = __esri.Color;
type EsriSimpleFillSymbol = __esri.symbols.SimpleFillSymbol;
type EsriSimpleLineSymbol = __esri.symbols.SimpleLineSymbol;
type EsriGraphicsLayer = __esri.GraphicsLayer;
type EsriMapView = __esri.MapView;
type Turf = typeof import('@turf/turf');
type HazardType = "hail" | "wind" | "tornado" | "prevots";


// Regras de negócio e cores, extraídas da referência
export const catColor: Record<number, string> = {
  0: '#90EE90', // Verde claro para Risco Mínimo/Geral
  1: "#FFFF00", // Nível 1 (Amarelo)
  2: "#FFA500", // Nível 2 (Laranja)
  3: "#FF0000", // Nível 3 (Vermelho)
  4: "#800080"  // Roxo - PREV 4 (se houver)
};

export const levelOf = (p: number, t: Exclude<HazardType, 'prevots'>): number => {
    return t === 'tornado'
        ? {2:1, 5:2, 10:3, 15:4}[p] || 0
        : {5:1, 15:2, 30:3, 45:4}[p] || 0;
};

export const probabilityOptions: Record<Exclude<HazardType, 'prevots'>, number[]> = {
    hail: [5, 15, 30, 45],
    wind: [5, 15, 30, 45],
    tornado: [2, 5, 10, 15],
};

let turfInstance: Turf | null = null;

// Cache para armazenar polígonos por tipo
const polygonGroups: Record<string, EsriGraphic[]> = {
  hail: [],
  wind: [],
  tornado: [],
  prevots: [],
};

export function initializePolygonManager(turfLib: Turf) {
  turfInstance = turfLib;
}

// Validação de área: polígono de nível maior não pode ser maior que um de nível menor
export function validateArea(newPolygon: EsriPolygon, newLevel: number, hazard: Exclude<HazardType, 'prevots'>): boolean {
  if (!turfInstance || !newPolygon?.rings) return true; // Se turf não estiver carregado, pula a validação

  const newPolygonGeoJSON = { type: "Polygon" as const, coordinates: newPolygon.rings };
  const newPolygonFeature = turfInstance.feature(newPolygonGeoJSON);
  const newArea = turfInstance.area(newPolygonFeature);
  
  const sameHazardPolys = polygonGroups[hazard] || [];
  for (const existingGraphic of sameHazardPolys) {
    const existingLevel = existingGraphic.attributes?.level;
    if (existingLevel == null || existingLevel >= newLevel) continue;
    
    const existingGeom = existingGraphic.geometry as EsriPolygon;
    if (!existingGeom?.rings) continue;
    
    const existingPolygonGeoJSON = { type: "Polygon" as const, coordinates: existingGeom.rings };
    const existingPolygonFeature = turfInstance.feature(existingPolygonGeoJSON);
    const existingArea = turfInstance.area(existingPolygonFeature);
    
    if (newArea > existingArea) {
      alert("🚫 Um polígono de nível maior não pode ser maior que um de nível menor.");
      return false;
    }
  }
  return true;
}


// Adiciona um novo polígono ao mapa e ao cache
export function addPolygon({
  graphic,
  attributes,
  brazilBoundary,
  Color,
  SimpleFillSymbol,
  SimpleLineSymbol,
  Polygon,
  webMercatorUtils
}: {
  graphic: EsriGraphic;
  attributes: any,
  brazilBoundary: any;
  Color: any;
  SimpleFillSymbol: any;
  SimpleLineSymbol: any;
  Polygon: any;
  webMercatorUtils: any;
}): EsriGraphic | null {
  if (!turfInstance) {
    console.error("Turf.js não inicializado. Chame initializePolygonManager primeiro.");
    return null;
  }
  
  if (!attributes) {
    console.error("Atributos ausentes ao adicionar polígono.");
    return null;
  }
  // Ensure attributes are attached to the graphic
  graphic.attributes = attributes;
  const { hazard, prob, level, type } = attributes;
  
  // 1. Converte e Recorta a geometria
  const geographicGeom = webMercatorUtils.webMercatorToGeographic(graphic.geometry) as EsriPolygon;
  const turfPolygon = turfInstance.polygon(geographicGeom.rings);
  const clipped = turfInstance.intersect(turfPolygon, brazilBoundary);

  if (!clipped || !clipped.geometry) {
      alert("O polígono desenhado está fora dos limites do Brasil.");
      return null;
  }
  
  const esriPolygon = new Polygon({ rings: (clipped.geometry as any).coordinates, spatialReference: { wkid: 4326 } });
  
  if (type === 'risk') {
    // 2. Validação de Área
    if (!validateArea(esriPolygon, level, hazard)) {
        return null;
    }
    
    graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);
    
    // 4. Adiciona ao cache
    if (!polygonGroups[hazard]) {
        polygonGroups[hazard] = [];
    }
    polygonGroups[hazard].push(graphic);
    
    console.log(`✅ Polígono (${hazard}, ${prob}%) adicionado.`);
    return graphic;

  } else if (type === 'prevots') {
     // A lógica para PREVOTS pode ser mais simples se não precisar de validação de área complexa
    graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);
    if (!polygonGroups['prevots']) {
        polygonGroups['prevots'] = [];
    }
    polygonGroups['prevots'].push(graphic);
    console.log(`✅ Polígono (PREVOTS, Nível ${level}) adicionado.`);
    return graphic;
  }
  
  return graphic; // Retorna o gráfico original se não for de um tipo conhecido
}


// Remove um polígono do mapa e do cache
export function deletePolygon(graphic: EsriGraphic, graphicsLayer: EsriGraphicsLayer): void {
  const { hazard, uid, type } = graphic.attributes;
  const groupKey = type === 'prevots' ? 'prevots' : hazard;
  
  if (groupKey && polygonGroups[groupKey]) {
    polygonGroups[groupKey] = polygonGroups[groupKey].filter(g => g.attributes.uid !== uid);
    graphicsLayer.remove(graphic);
    console.log(`🗑️ Polígono (${groupKey}) removido.`);
  }
}

export function updatePolygon(graphic: EsriGraphic, newAttributes: any) {
    graphic.attributes = { ...graphic.attributes, ...newAttributes };
}


// Limpa todos os polígonos
export function clearAllPolygons(view: EsriMapView): void {
  Object.keys(polygonGroups).forEach(key => {
      const layer = view.map.findLayerById(key) as EsriGraphicsLayer;
      if (layer) {
          layer.removeAll();
      }
      polygonGroups[key] = [];
  });
  console.log("🗑️ Todos os polígonos foram limpos.");
}

// Retorna todos os polígonos de todos os grupos
export function getPolygonGroups(): Record<string, EsriGraphic[]> {
  return polygonGroups;
}

// Retorna polígonos de um risco específico
export function getPolygonsByHazard(hazard: Exclude<HazardType, 'prevots'>): EsriGraphic[] {
  return polygonGroups[hazard] || [];
}

// Atualiza a visibilidade das camadas no mapa
export function togglePolygonVisibility(view: EsriMapView, selectedHazard: Exclude<HazardType, 'prevots'>): void {
    if (!view) return;
    Object.keys(polygonGroups).forEach(hazardKey => {
        const layer = view.map.findLayerById(hazardKey) as EsriGraphicsLayer;
        if (layer) {
            // A camada de PREVOTS tem sua própria lógica, não deve ser afetada aqui
            if(hazardKey !== 'prevots') {
                layer.visible = (hazardKey === selectedHazard);
            }
        }
    });
}
