// src/components/meteorologia/EsriMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { loadCss, loadScript } from '@/lib/esri-loader';
import * as turf from '@turf/turf';

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

export function EsriMap() {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);

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

    useEffect(() => {
        let view: __esri.MapView;
        let basemapGallery: __esri.BasemapGallery;
        let layerList: __esri.LayerList;
        let sketch: __esri.Sketch;
        let drawToolbar: __esri.Draw;

        const initMap = async () => {
            try {
                loadCss();
                const [
                    Map, MapView, Basemap, TileLayer, MapImageLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer, WebTileLayer,
                    Draw, SimpleFillSymbol, SimpleLineSymbol, Color, Graphic,
                    webMercatorUtils // Import for clipping logic
                ] = await loadScript();

                const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await response.json();
                const host = data.host;
                const radarPath = data.radar.nowcast[0].path;

                const rainViewerLayer = new WebTileLayer({
                    urlTemplate: `${host}${radarPath}/{level}/{col}/{row}/2/1_1.png`,
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

                basemapGallery = new BasemapGallery({ view, container: document.createElement("div") });
                view.ui.add(new Expand({ view, content: basemapGallery, expandIconClass: "esri-icon-basemap", group: "top-right" }), "top-right");

                layerList = new LayerList({ view, container: document.createElement("div") });
                view.ui.add(new Expand({ view, content: layerList, expandIconClass: "esri-icon-layers", group: "top-right" }), "top-right");
                
                const graphicsLayer = new GraphicsLayer();
                map.add(graphicsLayer);

                sketch = new Sketch({ layer: graphicsLayer, view, creationMode: "update", container: document.createElement("div") });
                const sketchExpand = new Expand({ view, content: sketch, expandIconClass: "esri-icon-edit", group: "top-right" });
                
                // Redefine o botão de polígono para usar o Draw toolbar
                const polygonButton = sketch.viewModel.toolCollection.find(tool => tool.id === "polygon");
                if (polygonButton) {
                    polygonButton.active = false;
                    polygonButton.on("click", () => {
                        if (brazilBoundary) {
                            drawToolbar.activate(Draw.POLYGON);
                        } else {
                            alert("Aguarde o carregamento dos limites do Brasil.");
                        }
                    });
                }
                view.ui.add(sketchExpand, "top-right");
                
                drawToolbar = new Draw(map);
                drawToolbar.on("draw-complete", (evt) => {
                    drawToolbar.deactivate();
                    if (!brazilBoundary) {
                        alert("Contorno do Brasil não carregado. Tente desenhar novamente em alguns segundos.");
                        return;
                    }

                    // Convert geometry to geographic coordinates for turf
                    const geographicGeom = webMercatorUtils.webMercatorToGeographic(evt.geometry) as __esri.Polygon;
                    
                    const turfPolygon = turf.polygon(geographicGeom.rings);

                    const clipped = turf.intersect(turfPolygon, brazilBoundary);

                    if (!clipped) {
                        alert("O polígono desenhado está fora dos limites do Brasil.");
                        return;
                    }

                    const symbol = new SimpleFillSymbol(
                        SimpleFillSymbol.STYLE_SOLID,
                        new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 207, 255, 0.8]), 2),
                        new Color([0, 207, 255, 0.3])
                    );
                    
                    // The clipped geometry is already in geographic, convert it back to Web Mercator for display
                    const clippedPolygonForEsri = {
                        type: "polygon",
                        rings: clipped.geometry.coordinates,
                        spatialReference: { wkid: 4326 }
                    };

                    const mercatorGeom = webMercatorUtils.geographicToWebMercator(clippedPolygonForEsri);

                    const graphic = new Graphic(mercatorGeom, symbol);
                    graphicsLayer.add(graphic);
                });

            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (mapDivRef.current) {
            initMap();
        }

        return () => {
            if (view) view.destroy();
        };
    }, [brazilBoundary]); // Re-run effect if brazilBoundary changes

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}
