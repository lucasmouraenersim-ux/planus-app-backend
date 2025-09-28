// src/components/meteorologia/EsriMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { loadCss, loadScript } from '@/lib/esri-loader';
import * as turf from '@turf/turf';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    0: "#00FF00",
    1: "#FFFF00",
    2: "#FFA500",
    3: "#FF0000",
    4: "#800080",
};

const levelOf = (prob: number, type: HazardType): number => {
    const rules = {
        tornado: { 2: 1, 5: 2, 10: 3, 15: 4 },
        hail: { 5: 1, 15: 2, 30: 3, 45: 4 },
        wind: { 5: 1, 15: 2, 30: 3, 45: 4 },
    };
    return rules[type][prob as keyof typeof rules[type]] || 0;
};


export function EsriMap() {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const sketchRef = useRef<__esri.Sketch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);

    const [isDrawMenuOpen, setIsDrawMenuOpen] = useState(false);
    const [selectedHazard, setSelectedHazard] = useState<HazardType>("hail");
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions.hail[0]);

    useEffect(() => {
        // Fetch Brazil boundary
        fetch("https://cdn.jsdelivr.net/gh/LucasMouraChaser/brasilunificado@main/brasilunificado.geojson")
            .then(res => res.json())
            .then(data => {
                const firstValid = data.features.find(
                    (f: any) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
                );
                if (firstValid) {
                    setBrazilBoundary(firstValid);
                    console.log("✅ Contorno do Brasil carregado.");
                } else {
                    console.error("❌ Nenhum polígono válido no GeoJSON do Brasil.");
                }
            })
            .catch(err => console.error("❌ Erro ao carregar contorno do Brasil:", err));
    }, []);

    const startDrawing = (hazard: HazardType, prob: number) => {
        if (sketchRef.current) {
            const level = levelOf(prob, hazard);
            const colorHex = catColor[level] || "#999999";
            
            const r = parseInt(colorHex.slice(1, 3), 16);
            const g = parseInt(colorHex.slice(3, 5), 16);
            const b = parseInt(colorHex.slice(5, 7), 16);

            const symbol = {
                type: "simple-fill",
                color: [r, g, b, 0.25],
                outline: {
                    color: [r, g, b, 1],
                    width: 2
                }
            };
            
            if (sketchRef.current.viewModel) {
              sketchRef.current.viewModel.polygonSymbol = symbol as any;
              sketchRef.current.create("polygon");
            }
            
            // Associate data for when the drawing completes
            (sketchRef.current as any)._activeDrawingInfo = {
                hazard,
                prob,
                level,
            };

            setIsDrawMenuOpen(false);
        }
    };

    useEffect(() => {
        let view: __esri.MapView;
        
        const initMap = async () => {
            try {
                loadCss();
                const [
                    Map, MapView, Basemap, TileLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer, WebTileLayer,
                    webMercatorUtils
                ] = await loadScript();

                const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await response.json();
                const host = data.host;
                const latestFrame = data.radar.nowcast.find((frame: any) => frame.path === '/v2/radar/nowcast/0.png');
                const path = latestFrame ? latestFrame.path : data.radar.nowcast[0].path;

                const color = 5; 
                const opts = '0_0'; 

                const rainViewerLayer = new WebTileLayer({
                    urlTemplate: `${host}${path}/256/{level}/{col}/{row}/${color}/${opts}.png`,
                    title: "Radar RainViewer",
                    visible: true,
                    opacity: 0.7,
                });
                
                const groupLayer = new GroupLayer({
                    title: "Sobreposições",
                    visible: true,
                    layers: [rainViewerLayer],
                    opacity: 0.8
                });


                const map = new Map({
                    basemap: new Basemap({
                        baseLayers: [new TileLayer({ url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer" })]
                    }),
                    layers: [groupLayer]
                });

                view = new MapView({
                    container: mapDivRef.current!,
                    map: map,
                    center: [-54, -15],
                    zoom: 5
                });
                
                view.when(() => setIsLoading(false));
                
                const basemapGalleryEl = document.createElement("div");
                const basemapGallery = new BasemapGallery({ view, container: basemapGalleryEl });
                view.ui.add(new Expand({ view, content: basemapGalleryEl, expandIconClass: "esri-icon-basemap", group: "top-right" }), "top-right");

                const layerListEl = document.createElement("div");
                const layerList = new LayerList({ view, container: layerListEl });
                view.ui.add(new Expand({ view, content: layerListEl, expandIconClass: "esri-icon-layers", group: "top-right" }), "top-right");
                
                const graphicsLayer = new GraphicsLayer();
                map.add(graphicsLayer);

                const sketch = new Sketch({ layer: graphicsLayer, view, creationMode: "update" });
                sketchRef.current = sketch;

                const sketchContainer = document.createElement("div");
                sketchContainer.className = "bg-background p-2 rounded-md";
                sketchContainer.innerHTML = `
                    <div id="draw-popover-root"></div>
                `;

                view.ui.add(new Expand({ 
                    view, 
                    content: sketchContainer, 
                    expandIconClass: "esri-icon-edit", 
                    group: "top-right" 
                }), "top-right");

                // We can't use React components directly inside the Esri UI,
                // so we'll have to manage the popover manually or use a simpler approach.
                // For now, let's keep the popover logic inside the React component and just have a placeholder button.
                // A better integration would require `ReactDOM.createPortal`.
                // The provided code shows a button that will be replaced. For now, let's simplify.
                
                const drawButton = document.createElement('button');
                drawButton.innerText = 'Desenhar Polígono';
                drawButton.className = 'w-full p-2 bg-blue-500 text-white rounded';
                drawButton.onclick = () => {
                    // This is a simplified version. A full React-based popover is complex here.
                    const hazard = prompt("Digite o tipo (hail, wind, tornado):", "hail") as HazardType;
                    const prob = parseInt(prompt("Digite a probabilidade:", "15") || "15", 10);
                    if (hazard && !isNaN(prob)) {
                        startDrawing(hazard, prob);
                    }
                };
                sketchContainer.appendChild(drawButton);

                sketch.on("create", (event) => {
                    if (event.state === "complete") {
                         if (!brazilBoundary) {
                            alert("Contorno do Brasil não carregado. Tente desenhar novamente em alguns segundos.");
                            graphicsLayer.remove(event.graphic);
                            return;
                        }

                        const geographicGeom = webMercatorUtils.webMercatorToGeographic(event.graphic.geometry) as __esri.Polygon;
                        const turfPolygon = turf.polygon(geographicGeom.rings);

                        const clipped = turf.intersect(turfPolygon, brazilBoundary);

                        if (!clipped) {
                            alert("O polígono desenhado está fora dos limites do Brasil.");
                            graphicsLayer.remove(event.graphic);
                            return;
                        }

                        const clippedPolygonForEsri = {
                            type: "polygon",
                            rings: clipped.geometry.coordinates,
                            spatialReference: { wkid: 4326 }
                        };

                        const mercatorGeom = webMercatorUtils.geographicToWebMercator(clippedPolygonForEsri);
                        
                        event.graphic.geometry = mercatorGeom;

                        // Add attributes from the active drawing info
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

            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (mapDivRef.current && brazilBoundary) {
            initMap();
        }

        return () => {
            if (view) {
                view.destroy();
            }
        };
    }, [brazilBoundary]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}
