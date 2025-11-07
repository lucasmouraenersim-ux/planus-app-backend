import type { Feature } from '@turf/turf';

type EsriPolygon = __esri.Polygon;
type EsriGraphic = __esri.Graphic;
type EsriColor = __esri.Color;
type EsriSimpleFillSymbol = __esri.symbols.SimpleFillSymbol;
type EsriSimpleLineSymbol = __esri.symbols.SimpleLineSymbol;
type EsriGraphicsLayer = __esri.layers.GraphicsLayer;
type EsriMapView = __esri.MapView;
type Turf = typeof import('@turf/turf');
type HazardType = 'hail' | 'wind' | 'tornado' | 'prevots';

export const catColor: Record<number, string> = {
  0: '#90EE90',
  1: '#FFFF00',
  2: '#FFA500',
  3: '#FF0000',
  4: '#800080',
};

export const levelOf = (prob: number, hazard: Exclude<HazardType, 'prevots'>): number =>
  hazard === 'tornado'
    ? ({ 2: 1, 5: 2, 10: 3, 15: 4 }[prob] ?? 0)
    : ({ 5: 1, 15: 2, 30: 3, 45: 4 }[prob] ?? 0);

export const probabilityOptions: Record<Exclude<HazardType, 'prevots'>, number[]> = {
  hail: [5, 15, 30, 45],
  wind: [5, 15, 30, 45],
  tornado: [2, 5, 10, 15],
};

let turfInstance: Turf | null = null;

const polygonGroups: Record<string, EsriGraphic[]> = {
  hail: [],
  wind: [],
  tornado: [],
  prevots: [],
};

export function initializePolygonManager(turfLib: Turf): void {
  turfInstance = turfLib;
}

export function validateArea(
  newPolygon: EsriPolygon,
  newLevel: number,
  hazard: Exclude<HazardType, 'prevots'>
): boolean {
  if (!turfInstance || !newPolygon?.rings) return true;

  const newPolygonGeoJSON: Feature = turfInstance.feature({
    type: 'Polygon',
    coordinates: newPolygon.rings,
  });
  const newArea = turfInstance.area(newPolygonGeoJSON);

  const sameHazardPolys = polygonGroups[hazard] ?? [];
  for (const existingGraphic of sameHazardPolys) {
    const existingLevel = existingGraphic.attributes?.level as number | undefined;
    if (existingLevel == null || existingLevel >= newLevel) continue;

    const existingGeom = existingGraphic.geometry as EsriPolygon;
    if (!existingGeom?.rings) continue;

    const existingPolygonGeoJSON: Feature = turfInstance.feature({
      type: 'Polygon',
      coordinates: existingGeom.rings,
    });
    const existingArea = turfInstance.area(existingPolygonGeoJSON);

    if (newArea > existingArea) {
      alert('🚫 Um polígono de nível maior não pode ser maior que um de nível menor.');
      return false;
    }
  }

  return true;
}

interface AddPolygonArgs {
  graphic: EsriGraphic;
  attributes: Record<string, unknown>;
  brazilBoundary: Feature;
  Color: typeof EsriColor;
  SimpleFillSymbol: typeof EsriSimpleFillSymbol;
  SimpleLineSymbol: typeof EsriSimpleLineSymbol;
  Polygon: typeof EsriPolygon;
  webMercatorUtils: __esri.webMercatorUtils;
}

export function addPolygon({
  graphic,
  attributes,
  brazilBoundary,
  Color,
  SimpleFillSymbol,
  SimpleLineSymbol,
  Polygon,
  webMercatorUtils,
}: AddPolygonArgs): EsriGraphic | null {
  if (!turfInstance) {
    console.error('Turf.js não inicializado. Chame initializePolygonManager primeiro.');
    return null;
  }

  if (!attributes) {
    console.error('Atributos ausentes ao adicionar polígono.');
    return null;
  }

  graphic.attributes = attributes;
  const { hazard, prob, level, type } = attributes as {
    hazard: Exclude<HazardType, 'prevots'>;
    prob: number;
    level: number;
    type: HazardType;
  };

  const geographicGeom = webMercatorUtils.webMercatorToGeographic(graphic.geometry) as EsriPolygon;
  const turfPolygon = turfInstance.polygon(geographicGeom.rings);
  const clipped = turfInstance.intersect(turfPolygon, brazilBoundary);

  if (!clipped?.geometry) {
    alert('O polígono desenhado está fora dos limites do Brasil.');
    return null;
  }

  const esriPolygon = new Polygon({
    rings: (clipped.geometry as any).coordinates,
    spatialReference: { wkid: 4326 },
  });

  if (type === 'risk') {
    if (!validateArea(esriPolygon, level, hazard)) {
      return null;
    }

    graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);

    polygonGroups[hazard] ??= [];
    polygonGroups[hazard].push(graphic);

    console.log(`✅ Polígono (${hazard}, ${prob}%) adicionado.`);
    return graphic;
  }

  if (type === 'prevots') {
    graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);

    polygonGroups.prevots ??= [];
    polygonGroups.prevots.push(graphic);

    console.log(`✅ Polígono (PREVOTS, Nível ${level}) adicionado.`);
    return graphic;
  }

  return graphic;
}

export function deletePolygon(graphic: EsriGraphic, graphicsLayer: EsriGraphicsLayer): void {
  const { hazard, type } = graphic.attributes as { hazard?: HazardType; type?: HazardType };
  const groupKey: HazardType | undefined = type === 'prevots' ? 'prevots' : hazard;

  if (groupKey && polygonGroups[groupKey]) {
    polygonGroups[groupKey] = polygonGroups[groupKey].filter((g) => g.uid !== graphic.uid);
    graphicsLayer.remove(graphic);
    console.log(`🗑️ Polígono (${groupKey}) removido.`);
  }
}

export function updatePolygon(graphic: EsriGraphic, newAttributes: Record<string, unknown>): void {
  graphic.attributes = { ...graphic.attributes, ...newAttributes };
}

export function clearAllPolygons(view: EsriMapView): void {
  Object.keys(polygonGroups).forEach((key) => {
    const layer = view.map.findLayerById(key) as EsriGraphicsLayer | undefined;
    layer?.removeAll();
    polygonGroups[key] = [];
  });

  console.log('🗑️ Todos os polígonos foram limpos.');
}

export function getPolygonGroups(): Record<string, EsriGraphic[]> {
  return polygonGroups;
}

export function getPolygonsByHazard(hazard: Exclude<HazardType, 'prevots'>): EsriGraphic[] {
  return polygonGroups[hazard] ?? [];
}

export function togglePolygonVisibility(
  view: EsriMapView,
  selectedHazard: Exclude<HazardType, 'prevots'>
): void {
  if (!view) return;

  Object.keys(polygonGroups).forEach((hazardKey) => {
    const layer = view.map.findLayerById(hazardKey) as EsriGraphicsLayer | undefined;

    if (layer && hazardKey !== 'prevots') {
      layer.visible = hazardKey === selectedHazard;
    }
  });
}
