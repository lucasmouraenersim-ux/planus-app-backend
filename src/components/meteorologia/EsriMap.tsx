// src/components/meteorologia/EsriMap.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { loadCss, loadScript } from '@/lib/esri-loader';
import * as turf from '@turf/turf';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';


const LoadingSpinner = () => (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center bg-gray-900 bg-opacity-70 text-white">
        <div className="flex items-center justify-center space-x-1">
            <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0s' }}></div>
            <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.1s' }}></div>
            <div className="h-8 w-2 animate-pulse bg-white" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.3s' }}></div>
            <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0.4s' }}></div>
        </div>
        <p className="mt-4 text-sm">Carregando mapa meteorológico...</p>
    </div>
);

type HazardType = "hail" | "wind" | "tornado";

const hazardOptions: { value: HazardType; label: string }[] = [
    { value: "hail", label: "Granizo" },
    { value: "wind", label: "Vento" },
    { value: "tornado", label: "Tornado" },
];

const probabilityOptions: Record<HazardType, number[]> = {
    hail: [5, 15, 30, 45],
    wind: [5, 15, 30, 45],
    tornado: [2, 5, 10, 15],
};

const catColor: Record<number, string> = {
    2: "#FFFF00", // Amarelo
    3: "#FFA500", // Laranja
    4: "#FF0000", // Vermelho
    5: "#800080"  // Roxo
};

const levelOf = (prob: number, type: HazardType): number => {
    const rules: Record<HazardType, Record<number, number>> = {
        tornado: { 2: 2, 5: 3, 10: 4, 15: 5 },
        hail: { 5: 2, 15: 3, 30: 4, 45: 5 },
        wind: { 5: 2, 15: 3, 30: 4, 45: 5 },
    };
    return rules[type]?.[prob] || 0;
};


export function EsriMap() {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const sketchRef = useRef<__esri.Sketch | null>(null);
    const graphicsLayerRef = useRef<__esri.GraphicsLayer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);

    const [selectedHazard, setSelectedHazard] = useState<HazardType>("hail");
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions["hail"][0]);


    useEffect(() => {
        fetch("https://cdn.jsdelivr.net/gh/LucasMouraChaser/brasilunificado@main/brasilunificado.geojson")
            .then(res => res.json())
            .then(data => {
                const firstValid = data.features.find(
                    (f: any) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
                );
                if (firstValid) {
                    setBrazilBoundary(firstValid);
                } else {
                    console.error("❌ Nenhum polígono válido no GeoJSON do Brasil.");
                }
            })
            .catch(err => console.error("❌ Erro ao carregar contorno do Brasil:", err));
    }, []);
    
    const handleStartDrawing = useCallback(() => {
        if (sketchRef.current) {
            const hazard = selectedHazard;
            const prob = selectedProb;
            const level = levelOf(prob, hazard);
            const colorHex = catColor[level] || "#999999";

            const [r, g, b] = (colorHex.match(/\w\w/g) || []).map((h) => parseInt(h, 16));

            const symbol = {
                type: "simple-fill",
                color: [r, g, b, 0.25],
                outline: { color: [r, g, b, 1], width: 2 }
            };
            
            sketchRef.current.viewModel.polygonSymbol = symbol as any;
            (sketchRef.current as any)._activeDrawingInfo = { hazard, prob, level };
            sketchRef.current.create("polygon");
        }
    }, [selectedHazard, selectedProb]);

    useEffect(() => {
        let view: __esri.MapView;
        
        const initMap = async () => {
            if (!mapDivRef.current || !brazilBoundary) return;

            try {
                loadCss();
                const [
                    Map, MapView, Basemap, TileLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer,
                    WebTileLayer, webMercatorUtils, Polygon
                ] = await loadScript();

                const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await response.json();
                const host = data.host;
                const latestFrame = data.radar.nowcast.find((frame: any) => frame.path === '/v2/radar/nowcast/0.png');
                const path = latestFrame ? latestFrame.path : data.radar.nowcast[0].path;
                
                const rainViewerLayer = new WebTileLayer({
                    urlTemplate: `${host}${path}/256/{level}/{col}/{row}/5/0_0.png`,
                    title: "Radar RainViewer",
                    visible: true,
                    opacity: 0.7,
                });
                
                const municipiosLayer = new TileLayer({
                    url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer",
                    title: "Municípios",
                    visible: false,
                });

                const groupLayer = new GroupLayer({
                    title: "Sobreposições",
                    visible: true,
                    layers: [rainViewerLayer, municipiosLayer],
                    opacity: 0.8
                });

                const graphicsLayer = new GraphicsLayer();
                graphicsLayerRef.current = graphicsLayer;

                const map = new Map({
                    basemap: "dark-gray-vector",
                    layers: [groupLayer, graphicsLayer]
                });

                view = new MapView({
                    container: mapDivRef.current!,
                    map: map,
                    center: [-54, -15],
                    zoom: 5
                });
                
                view.when(() => setIsLoading(false));
                
                view.popup.autoOpenEnabled = false; 
                view.on("click", (event) => {
                    view.hitTest(event).then((response) => {
                        const graphic = response.results.find(result => result.graphic.layer === graphicsLayer);
                        if (graphic) {
                            showPolygonPopup(graphic.graphic);
                        } else {
                            view.closePopup();
                        }
                    });
                });

                const basemapGallery = new BasemapGallery({ view });
                view.ui.add(new Expand({ view, content: basemapGallery, expandIconClass: "esri-icon-basemap", group: "top-right" }), "top-right");

                const layerList = new LayerList({ view });
                view.ui.add(new Expand({ view, content: layerList, expandIconClass: "esri-icon-layers", group: "top-right" }), "top-right");
                
                const sketch = new Sketch({ layer: graphicsLayer, view, creationMode: "update" });
                sketchRef.current = sketch;
                
                const drawContainer = document.createElement("div");
                const sketchExpand = new Expand({
                    view: view,
                    content: drawContainer,
                    expandIconClass: "esri-icon-edit",
                    group: "top-right",
                });
                view.ui.add(sketchExpand, "top-right");
                
                // Use ReactDOM.createRoot to render React component into the container
                const root = createRoot(drawContainer);
                root.render(
                    <div className="bg-gray-800 p-3 rounded-md shadow-md text-white">
                        <h3 className="font-bold mb-2">Desenhar Polígono de Risco</h3>
                        <div className="space-y-2">
                             <div>
                                <Label>Tipo de Risco</Label>
                                <Select value={selectedHazard} onValueChange={(v) => setSelectedHazard(v as HazardType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {hazardOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Probabilidade (%)</Label>
                                <Select value={String(selectedProb)} onValueChange={(v) => setSelectedProb(Number(v))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {probabilityOptions[selectedHazard].map(prob => <SelectItem key={prob} value={String(prob)}>{prob}%</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleStartDrawing} className="w-full">
                                <Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho
                            </Button>
                        </div>
                    </div>
                );
                
                sketch.on("create", (event) => {
                    if (event.state === "complete") {
                        if (!brazilBoundary) {
                            alert("Contorno do Brasil não carregado. Tente desenhar novamente em alguns segundos.");
                            graphicsLayer.remove(event.graphic);
                            return;
                        }

                        const geographicGeom = webMercatorUtils.webMercatorToGeographic(event.graphic.geometry);
                        const turfPolygon = turf.polygon(geographicGeom.rings);
                        const clipped = turf.intersect(turfPolygon, brazilBoundary);
                        
                        if (!clipped || !clipped.geometry) {
                            alert("O polígono desenhado está fora dos limites do Brasil.");
                            graphicsLayer.remove(event.graphic);
                            return;
                        }
                        
                        const esriPolygon = new Polygon({
                            rings: clipped.geometry.coordinates,
                            spatialReference: view.spatialReference
                        });

                        event.graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon) as __esri.Geometry;


                        const drawingInfo = (sketch as any)._activeDrawingInfo;
                        if (drawingInfo) {
                            event.graphic.attributes = {
                                hazard: drawingInfo.hazard,
                                prob: drawingInfo.prob,
                                level: drawingInfo.level,
                            };
                        }
                    }
                });

                function showPolygonPopup(graphic: __esri.Graphic) {
                    const popupData = graphic.attributes || {};
                    const content = document.createElement("div");
                    content.innerHTML = `
                        <b>Tipo:</b> ${popupData.hazard || 'N/A'}<br>
                        <b>Nível:</b> ${popupData.level || 'N/A'}<br>
                        <b>Probabilidade:</b> ${popupData.prob || 'N/A'}%
                    `;

                    const editButton = document.createElement('button');
                    editButton.textContent = '✏️ Editar';
                    editButton.className = 'p-1 mt-2 mr-2 bg-blue-500 text-white rounded';
                    editButton.onclick = () => {
                        sketchRef.current?.update([graphic], { tool: "reshape" });
                        view.closePopup();
                    };

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = '🗑️ Excluir';
                    deleteButton.className = 'p-1 mt-2 bg-red-500 text-white rounded';
                    deleteButton.onclick = () => {
                        graphicsLayerRef.current?.remove(graphic);
                        view.closePopup();
                    };
                    
                    content.appendChild(editButton);
                    content.appendChild(deleteButton);

                    view.openPopup({
                        title: "Polígono de Risco",
                        content: content,
                        location: graphic.geometry.extent.center
                    });
                }
                
                const legendDiv = document.createElement("div");
                legendDiv.className = "bg-white p-3 rounded-md shadow-md text-black";
                view.ui.add(legendDiv, "bottom-right");

                const updateLegend = () => {
                    const hazard = selectedHazard;
                    const probs = probabilityOptions[hazard];
                    legendDiv.innerHTML = `
                        <h4 class="font-bold mb-2">Legenda - ${hazardOptions.find(h => h.value === hazard)?.label}</h4>
                        ${probs.map(p => {
                            const level = levelOf(p, hazard);
                            const color = catColor[level] || '#999';
                            return `<div class="flex items-center text-xs mb-1">
                                <span class="w-4 h-4 rounded-sm mr-2" style="background-color: ${color};"></span>
                                ${p}% (Nível ${level})
                            </div>`;
                        }).join('')}
                    `;
                };
                updateLegend();
            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (brazilBoundary) {
            initMap();
        }

        return () => {
            if (view) {
                view.destroy();
            }
        };
    }, [brazilBoundary, handleStartDrawing, selectedHazard, selectedProb]);
    
    // Effect to update probability options when hazard changes
    useEffect(() => {
        setSelectedProb(probabilityOptions[selectedHazard][0]);
    }, [selectedHazard]);


    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}
