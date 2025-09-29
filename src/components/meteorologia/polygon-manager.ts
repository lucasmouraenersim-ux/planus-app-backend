// src/components/meteorologia/polygon-manager.ts
import * as turf from '@turf/turf';

// Definições de tipo para clareza
type HazardType = "hail" | "wind" | "tornado";
type EsriPolygon = __esri.Polygon;
type EsriGraphic = __esri.Graphic;
type EsriColor = __esri.Color;
type EsriSimpleFillSymbol = __esri.symbols.SimpleFillSymbol;
type EsriSimpleLineSymbol = __esri.symbols.SimpleLineSymbol;

// Regras de negócio e cores, extraídas da referência
export const catColor: Record<number, string> = {
  0: '#00FF00', // Risco Geral/Mínimo
  1: "#FFFF00", // Nível 1 (Amarelo)
  2: "#FFA500", // Nível 2 (Laranja)
  3: "#FF0000", // Nível 3 (Vermelho)
  4: "#800080"  // Nível 4 (Roxo)
};

export const levelOf = (p: number, t: HazardType): number => {
    return t === 'tornado'
        ? {2:1, 5:2, 10:3, 15:4}[p] || 0
        : {5:1, 15:2, 30:3, 45:4}[p] || 0;
};

// Cache para armazenar polígonos por tipo
const polygonGroups: Record<HazardType, EsriGraphic[]> = {
  hail: [],
  wind: [],
  tornado: []
};

// Converte Hex para array RGB
function hexToRgb(hex: string): number[] {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.substring(0,2), 16),
    parseInt(hex.substring(2,4), 16),
    parseInt(hex.substring(4,6), 16)
  ];
}

// Validação de área: polígono de nível maior não pode ser maior que um de nível menor
function validateArea(newPolygon: EsriPolygon, newLevel: number, hazard: HazardType): boolean {
  if (!turf) return true; // Se turf não estiver carregado, pula a validação

  const newArea = turf.area(newPolygon.toJSON());
  
  const sameHazardPolys = polygonGroups[hazard] || [];
  for (const existingGraphic of sameHazardPolys) {
    const existingLevel = existingGraphic.attributes?.level;
    if (existingLevel == null || existingLevel >= newLevel) continue;
    
    const existingArea = turf.area(existingGraphic.geometry.toJSON());
    
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
  hazard,
  prob,
  brazilBoundary,
  Color,
  SimpleFillSymbol,
  SimpleLineSymbol,
  Polygon,
  webMercatorUtils
}: {
  graphic: EsriGraphic;
  hazard: HazardType;
  prob: number;
  brazilBoundary: any;
  Color: any;
  SimpleFillSymbol: any;
  SimpleLineSymbol: any;
  Polygon: any;
  webMercatorUtils: any;
}): EsriGraphic | null {
  const level = levelOf(prob, hazard);

  // 1. Converte e Recorta a geometria
  const geographicGeom = webMercatorUtils.webMercatorToGeographic(graphic.geometry);
  const turfPolygon = turf.polygon((geographicGeom as any).rings);
  const clipped = turf.intersect(turfPolygon, brazilBoundary);

  if (!clipped || !clipped.geometry) {
    alert("O polígono desenhado está fora dos limites do Brasil.");
    return null;
  }
  
  const esriPolygon = new Polygon({ rings: (clipped.geometry as any).coordinates, spatialReference: { wkid: 4326 } });

  // 2. Validação de Área
  if (!validateArea(esriPolygon, level, hazard)) {
    return null;
  }
  
  // 3. Cria Símbolo e Atributos
  const colorHex = catColor[level] || "#999999";
  const [r, g, b] = hexToRgb(colorHex);
  const symbol = new SimpleFillSymbol({
      color: new Color([r, g, b, 0.25]),
      outline: { color: new Color([r, g, b, 1]), width: 2 }
  });

  graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);
  graphic.symbol = symbol;
  graphic.attributes = { type: 'risk', hazard, prob, level, uid: `risk-${Date.now()}` };
  
  // 4. Adiciona ao cache
  if (!polygonGroups[hazard]) {
    polygonGroups[hazard] = [];
  }
  polygonGroups[hazard].push(graphic);

  console.log(`✅ Polígono (${hazard}, ${prob}%) adicionado.`);
  return graphic;
}

// Remove um polígono do mapa e do cache
export function removePolygon(graphic: EsriGraphic, graphicsLayer: __esri.GraphicsLayer): void {
  const { hazard, uid } = graphic.attributes;
  if (hazard && polygonGroups[hazard]) {
    polygonGroups[hazard] = polygonGroups[hazard].filter(g => g.attributes.uid !== uid);
    graphicsLayer.remove(graphic);
    console.log(`🗑️ Polígono (${hazard}) removido.`);
  }
}

// Limpa o cache de um tipo de risco específico
export function clearPolygonGroup(hazard: HazardType) {
    polygonGroups[hazard] = [];
}

// Retorna todos os polígonos de um grupo específico
export function getPolygonsByHazard(hazard: HazardType): EsriGraphic[] {
  return polygonGroups[hazard] || [];
}

// Retorna todos os polígonos de todos os grupos
export function getAllPolygons(): EsriGraphic[] {
  return Object.values(polygonGroups).flat();
}

// Atualiza a visibilidade das camadas no mapa
export function togglePolygonVisibility(map: __esri.Map, selectedHazard: HazardType): void {
  if (!map) return;
  Object.entries(polygonGroups).forEach(([hazard, group]) => {
    group.forEach(graphic => {
