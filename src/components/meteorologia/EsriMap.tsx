
// src/components/meteorologia/EsriMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { loadCss, loadScript } from '@/lib/esri-loader';

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

    useEffect(() => {
        let view: __esri.MapView;
        let basemapGallery: __esri.BasemapGallery;
        let layerList: __esri.LayerList;
        let sketch: __esri.Sketch;

        const initMap = async () => {
            try {
                // Carregar CSS da API da Esri
                loadCss();

                // Carregar módulos da API da Esri
                const [
                    Map, MapView, Basemap, TileLayer, MapImageLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer
                ] = await loadScript();

                // Configuração do mapa e da visualização
                const map = new Map({
                    basemap: new Basemap({
                        baseLayers: [
                            new TileLayer({
                                url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer"
                            })
                        ]
                    })
                });

                view = new MapView({
                    container: mapDivRef.current!,
                    map: map,
                    center: [-54, -15],
                    zoom: 5
                });
                
                view.when(() => {
                    setIsLoading(false);
                });


                // --- Camadas (Layers) ---
                const rainViewerLayer = new TileLayer({
                    url: "https://tilecache.rainviewer.com/v2/radar/nowcast/0/256/{level}/{col}/{row}/2/1_1.png",
                    title: "Radar RainViewer",
                    visible: true
                });

                const groupLayer = new GroupLayer({
                    title: "Sobreposições",
                    visible: true,
                    layers: [rainViewerLayer],
                    opacity: 0.75
                });
                map.add(groupLayer);

                // --- Galeria de Mapas Base ---
                basemapGallery = new BasemapGallery({
                    view: view,
                    container: document.createElement("div")
                });

                const basemapExpand = new Expand({
                    view: view,
                    content: basemapGallery,
                    expandIconClass: "esri-icon-basemap",
                    group: "top-right"
                });
                view.ui.add(basemapExpand, "top-right");

                // --- Lista de Camadas ---
                layerList = new LayerList({
                    view: view,
                    container: document.createElement("div"),
                    listItemCreatedFunction: (event) => {
                        const item = event.item;
                        if (item.layer.type !== "group") {
                            item.panel = {
                                content: "legend",
                                open: item.layer.title === "Radar RainViewer"
                            };
                        }
                    }
                });

                const layerListExpand = new Expand({
                    view: view,
                    content: layerList,
                    expandIconClass: "esri-icon-layers",
                    group: "top-right"
                });
                view.ui.add(layerListExpand, "top-right");
                
                // --- Sketch (Desenho) ---
                const graphicsLayer = new GraphicsLayer();
                map.add(graphicsLayer);

                sketch = new Sketch({
                    layer: graphicsLayer,
                    view: view,
                    creationMode: "update",
                    container: document.createElement("div")
                });
                
                const sketchExpand = new Expand({
                  view: view,
                  content: sketch,
                  expandIconClass: "esri-icon-edit",
                  group: "top-right"
                });
                view.ui.add(sketchExpand, "top-right");


                // -- Atualização automática da camada RainViewer ---
                setInterval(() => {
                    rainViewerLayer.refresh();
                }, 300 * 1000);

            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (mapDivRef.current) {
            initMap();
        }

        // Cleanup
        return () => {
            if (view) {
                view.destroy();
            }
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}
