
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
import { Pencil, Menu, MapPin, X, PlusCircle, Calendar as CalendarIcon, Wind, CloudHail, Tornado } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Input } from '../ui/input';


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

const SideMenu = () => {
    const menuItems = [
        "Modelos Meteorologico",
        "Placar",
        "Galeria de tornados no Brasil",
        "Relatos de Tempo Severo",
        "Galeria Storm Chaser BR",
        "Perfil",
        "Patrocine-nos"
    ];

    return (
        <div className="bg-gray-800 p-3 rounded-md shadow-md text-white w-56">
            <ul className="space-y-2">
                {menuItems.map(item => (
                    <li key={item}>
                        <a href="#" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-700 transition-colors">
                            {item}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// Placar Component
const Scoreboard = () => {
    const scores = [
        { hazard: 'Granizo', hits: 0, misses: 0, percentage: 0, points: 0 },
        { hazard: 'Vento', hits: 0, misses: 0, percentage: 0, points: 0 },
        { hazard: 'Tornados', hits: 0, misses: 0, percentage: 0, points: 0 },
    ];

    return (
        <div id="scoreboard-wrapper" className="absolute top-[88px] right-[56px] z-[1000] w-[240px] pointer-events-none">
            <table id="scoreboard" className="w-full border-collapse bg-black/60 text-white text-[13px] leading-tight font-sans">
                <thead>
                    <tr>
                        <th className="p-1 border border-gray-700">Perigo</th>
                        <th className="p-1 border border-gray-700">Acertos</th>
                        <th className="p-1 border border-gray-700">Erros</th>
                        <th className="p-1 border border-gray-700">% AxE</th>
                        <th className="p-1 border border-gray-700">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {scores.map(score => (
                        <tr key={score.hazard} data-hazard={score.hazard.toLowerCase()}>
                            <td className="p-1 border border-gray-700">{score.hazard}</td>
                            <td className="p-1 border border-gray-700 text-center">{score.hits}</td>
                            <td className="p-1 border border-gray-700 text-center">{score.misses}</td>
                            <td className="p-1 border border-gray-700 text-center">{score.percentage} %</td>
                            <td className="p-1 border border-gray-700 text-center">{score.points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Stats Panel Component
const StatsPanel = () => {
    return (
        <div id="statsPanel" style={{
            position: "fixed",
            bottom: "180px",
            right: "20px",
            background: "rgba(255,255,255,0.95)",
            padding: "10px 14px",
            fontSize: "13px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            fontFamily: "sans-serif",
            zIndex: 9999
        }}>
            <div id="statsContent">Carregando estatísticas...</div>
        </div>
    );
};

// Reports Legend Component
const ReportsLegend = () => {
    return (
        <div id="legendReports" style={{
            position: 'fixed',
            bottom: '95px',
            left: '20px', // Adjusted position from example
            background: 'rgba(255,255,255,0.95)',
            padding: '10px 14px',
            fontSize: '13px',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            fontFamily: 'sans-serif',
            zIndex: 9999
        }}>
            <b>Relatos</b><br />
            <div><img src="https://static.wixstatic.com/media/c003a9_38c6ec164e3742dab2237816e4ff8c95~mv2.png" width="16" alt="Vento leve" /> Vento 80–100km/h</div>
            <div><img src="https://static.wixstatic.com/media/c003a9_3fc6c303cb364c5db3595e4203c1888e~mv2.png" width="16" alt="Vento forte" /> Vento &gt;100km/h</div>
            <div><img src="https://static.wixstatic.com/media/c003a9_70be04c630a64abca49711a423da779b~mv2.png" width="16" alt="Granizo pequeno" /> Granizo &lt; 4cm</div>
            <div><img src="https://static.wixstatic.com/media/c003a9_946684b74c234c2287a153a6b6c077fe~mv2.png" width="16" alt="Granizo grande" /> Granizo &gt; 4cm</div>
            <div><img src="https://static.wixstatic.com/media/c003a9_9f22188e065e4424a1f8ee3a3afeffde~mv2.png" width="16" alt="Tornado fraco" /> Tornado &lt; EF2</div>
            <div><img src="https://static.wixstatic.com/media/c003a9_3a647b1160024b55bb3ecc148df1309f~mv2.png" width="16" alt="Tornado forte" /> Tornado ≥ EF2</div>
        </div>
    );
};


export function EsriMap() {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const sketchRef = useRef<__esri.Sketch | null>(null);
    const graphicsLayerRef = useRef<__esri.GraphicsLayer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);

    const [selectedHazard, setSelectedHazard] = useState<HazardType>("hail");
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions["hail"][0]);
    
    // New state for weather models
    const [weatherModels, setWeatherModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('radar.nowcast');
    const [modelGroupLayer, setModelGroupLayer] = useState<__esri.GroupLayer | null>(null);

    // Reports States
    const [isReportMode, setIsReportMode] = useState(false);
    const [newReport, setNewReport] = useState<{
        hazard: HazardType,
        sev: 'NOR' | 'SS',
        date: string,
        location: __esri.Point | null
    }>({
        hazard: 'wind',
        sev: 'NOR',
        date: new Date().toISOString().slice(0, 10),
        location: null
    });


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
            graphicsLayerRef.current?.removeAll(); // Limpa os desenhos anteriores
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

    // Handle changing the visible weather model
    useEffect(() => {
        if (!modelGroupLayer) return;
        modelGroupLayer.layers.forEach((layer: any) => {
            layer.visible = (layer.id === selectedModel);
        });
    }, [selectedModel, modelGroupLayer]);

    useEffect(() => {
        let view: __esri.MapView;
        
        const initMap = async () => {
            if (!mapDivRef.current || !brazilBoundary) return;

            try {
                loadCss();
                const [
                    Map, MapView, Basemap, TileLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer,
                    WebTileLayer, webMercatorUtils, Polygon, Color, Graphic, SimpleFillSymbol, SimpleLineSymbol,
                    PictureMarkerSymbol, Point
                ] = await loadScript();

                let models: any[] = [];
                try {
                    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                    const data = await response.json();
                    const host = data.host;
                    
                    const processModelData = (category: string, subCategory: string, dataObj: any) => {
                        if (dataObj && Array.isArray(dataObj) && dataObj.length > 0) {
                            return { id: `${category}.${subCategory}`, path: dataObj[0].path, name: `${category.toUpperCase()} - ${subCategory.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}` };
                        }
                        return null;
                    };
                    
                    models = Object.keys(data)
                      .filter(key => key !== 'host')
                      .flatMap(key => {
                          if (key === 'radar' && data.radar.nowcast) {
                              return { id: 'radar.nowcast', path: data.radar.nowcast[0].path, name: 'Radar de Chuva' };
                          }
                          if (key === 'satellite' && data.satellite.infrared) {
                              return { id: 'satellite.infrared', path: data.satellite.infrared[0].path, name: 'Satélite (Infravermelho)' };
                          }
                          if (key === 'gfs' || key === 'ecmwf' || key === 'meteofrance') {
                             if (typeof data[key] === 'object' && data[key] !== null) {
                                return Object.keys(data[key]).map(subKey => processModelData(key, subKey, data[key][subKey])).filter(Boolean) as { id: string; path: string; name: string; }[];
                             }
                          }
                          return [];
                      }).filter((model): model is { id: string; path: string; name: string; } => model !== null && model.path !== null);
                      
                    setWeatherModels(models);

                } catch(e) {
                    console.error("Failed to fetch weather models, proceeding without them", e);
                }

                const modelLayers = models.map(model => new WebTileLayer({
                    id: model.id,
                    urlTemplate: `https://tilecache.rainviewer.com${model.path}/256/{level}/{col}/{row}/5/1_1.png`,
                    title: model.name,
                    visible: model.id === selectedModel, 
                    opacity: 0.7,
                }));
                
                const newModelGroupLayer = new GroupLayer({
                    title: "Modelos Meteorológicos",
                    visible: true,
                    layers: modelLayers,
                });
                setModelGroupLayer(newModelGroupLayer);
                
                const municipiosLayer = new GraphicsLayer({
                    id: "municipios",
                    title: "Municípios",
                    visible: false,
                });

                const reportsLayer = new GraphicsLayer({
                    id: "reports",
                    title: "Relatos",
                    visible: true,
                });
                
                fetch("https://cdn.jsdelivr.net/gh/LucasMouraChaser/simplaoosmunicipio@bb3e7071319f8e42ffd24513873ffb73cce566e6/brazil-mun.simplao.geojson")
                    .then(res => res.json())
                    .then(data => {
                        const municipioGraphics = data.features.map((f: any) => new Graphic({
                            geometry: new Polygon({
                                rings: f.geometry.coordinates,
                                spatialReference: { wkid: 4326 }
                            }),
                            symbol: new SimpleFillSymbol({
                                style: "null",
                                outline: new SimpleLineSymbol({
                                    style: "solid",
                                    color: new Color([0, 0, 0, 0.3]),
                                    width: 1
                                })
                            })
                        }));
                        municipiosLayer.addMany(municipioGraphics);
                        console.log("✅ Municípios carregados na camada de gráficos.");
                    }).catch(err => console.error("❌ Erro ao carregar GeoJSON dos municípios:", err));

                const groupLayer = new GroupLayer({
                    title: "Sobreposições",
                    visible: true,
                    layers: [newModelGroupLayer, municipiosLayer, reportsLayer],
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
                
                view.when(() => {
                    setIsLoading(false);
                    // Firestore listener for reports
                    const reportsQuery = query(collection(db, "weather_reports"));
                    onSnapshot(reportsQuery, (querySnapshot) => {
                        const reportGraphics: __esri.Graphic[] = [];
                        const stats = { total: 0, sig: 0, hail: 0, wind: 0, tornado: 0, hailSig: 0, windSig: 0, tornadoSig: 0 };
                        
                        querySnapshot.forEach((doc) => {
                            const data = doc.data();
                            const { hazard, sev, location } = data;
                            if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
                                stats.total++;
                                if (sev === 'SS') stats.sig++;
                                if (hazard === 'hail') { stats.hail++; if (sev === 'SS') stats.hailSig++; }
                                if (hazard === 'wind') { stats.wind++; if (sev === 'SS') stats.windSig++; }
                                if (hazard === 'tornado') { stats.tornado++; if (sev === 'SS') stats.tornadoSig++; }

                                reportGraphics.push(new Graphic({
                                    geometry: new Point({ longitude: location.longitude, latitude: location.latitude }),
                                    symbol: getIconSymbol(hazard, sev),
                                    attributes: data,
                                }));
                            }
                        });
                        reportsLayer.removeAll();
                        reportsLayer.addMany(reportGraphics);
                        updateStatsPanel(stats);
                    });
                });
                
                view.popup.autoOpenEnabled = false; 
                view.on("click", (event) => {
                    if (isReportMode) {
                        setNewReport(prev => ({...prev, location: event.mapPoint}));
                        return;
                    }

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
                view.ui.add(new Expand({ view, content: basemapGallery, expandIconClass: "esri-icon-basemap", group: "top-left" }), "top-left");

                const layerList = new LayerList({ view });
                view.ui.add(new Expand({ view, content: layerList, expandIconClass: "esri-icon-layers", group: "top-left" }), "top-left");
                
                const sketch = new Sketch({ layer: graphicsLayer, view, creationMode: "update" });
                sketchRef.current = sketch;
                
                const drawContainer = document.createElement("div");
                const sketchExpand = new Expand({
                    view: view,
                    content: drawContainer,
                    expandIconClass: "esri-icon-edit",
                    group: "top-left",
                });
                
                const menuContainer = document.createElement("div");
                const menuExpand = new Expand({
                    view: view,
                    content: menuContainer,
                    expandIconClass: "menu",
                    group: "top-left",
                });

                view.ui.add(sketchExpand, "top-left");
                view.ui.add(menuExpand, "top-left");
                
                const menuRoot = createRoot(menuContainer);
                menuRoot.render(<SideMenu />);
                
                const root = createRoot(drawContainer);
                root.render(
                    <div className="bg-gray-800 p-3 rounded-md shadow-md text-white">
                        <div className="space-y-4">
                             <div>
                                <Label>Modelo Meteorológico</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {weatherModels.map(model => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <hr className="border-gray-600"/>
                            <h3 className="font-bold">Desenhar Polígono de Risco</h3>
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
                        const turfPolygon = turf.polygon((geographicGeom as any).rings);
                        const clipped = turf.intersect(turfPolygon, brazilBoundary);
                        
                        if (!clipped || !clipped.geometry) {
                            alert("O polígono desenhado está fora dos limites do Brasil.");
                            graphicsLayer.remove(event.graphic);
                            return;
                        }
                        
                         const esriPolygon = new Polygon({
                            rings: (clipped.geometry as any).coordinates,
                            spatialReference: { wkid: 4326 }
                        });
                        
                        event.graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);


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

                // Reports logic
                function getIconSymbol(hazard: string, sev: string = "NOR") {
                    const key = `${hazard.toLowerCase()}|${sev.toUpperCase()}`;
                    const iconMap: Record<string, string> = {
                        'wind|NOR': 'https://static.wixstatic.com/media/c003a9_38c6ec164e3742dab2237816e4ff8c95~mv2.png',
                        'wind|SS': 'https://static.wixstatic.com/media/c003a9_3fc6c303cb364c5db3595e4203c1888e~mv2.png',
                        'hail|NOR': 'https://static.wixstatic.com/media/c003a9_70be04c630a64abca49711a423da779b~mv2.png',
                        'hail|SS': 'https://static.wixstatic.com/media/c003a9_946684b74c234c2287a153a6b6c077fe~mv2.png',
                        'tornado|NOR': 'https://static.wixstatic.com/media/c003a9_9f22188e065e4424a1f8ee3a3afeffde~mv2.png',
                        'tornado|SS': 'https://static.wixstatic.com/media/c003a9_3a647b1160024b55bb3ecc148df1309f~mv2.png'
                    };
                    const iconUrl = iconMap[key] || iconMap['wind|NOR'];
                    return new PictureMarkerSymbol({ url: iconUrl, width: "20px", height: "20px" });
                }
                
                function updateStatsPanel(stats: any) {
                    const statsContent = document.getElementById("statsContent");
                    if (statsContent) {
                        statsContent.innerHTML = `
                            <b>Total:</b> ${stats.total} (<b>${stats.sig}</b> sig)<br>
                            <span style="color:#3366cc"><b>Vento:</b> ${stats.wind} (${stats.windSig} sig)</span><br>
                            <span style="color:#33aa33"><b>Granizo:</b> ${stats.hail} (${stats.hailSig} sig)</span><br>
                            <span style="color:#cc0033"><b>Tornado:</b> ${stats.tornado} (${stats.tornadoSig} sig)</span>
                        `;
                    }
                }


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
    }, [brazilBoundary, handleStartDrawing, selectedHazard, selectedProb, selectedModel]);
    
    // Effect to update probability options when hazard changes
    useEffect(() => {
        setSelectedProb(probabilityOptions[selectedHazard][0]);
        if(graphicsLayerRef.current) {
            graphicsLayerRef.current.removeAll(); // Clear drawings on hazard change
        }
    }, [selectedHazard]);
    
    const handleSaveReport = async () => {
        if (!newReport.location) {
            alert("Por favor, clique no mapa para definir a localização do relato.");
            return;
        }

        const reportData = {
            hazard: newReport.hazard,
            sev: newReport.sev,
            date: newReport.date,
            location: {
                latitude: newReport.location.latitude,
                longitude: newReport.location.longitude,
            },
            timestamp: Timestamp.now(),
        };

        try {
            await addDoc(collection(db, "weather_reports"), reportData);
            alert("Relato salvo com sucesso!");
            setIsReportMode(false); // Close panel after saving
            setNewReport({ hazard: 'wind', sev: 'NOR', date: new Date().toISOString().slice(0, 10), location: null });
        } catch (error) {
            console.error("Erro ao salvar relato: ", error);
            alert("Falha ao salvar o relato.");
        }
    };


    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <Scoreboard />
            <StatsPanel />
            <ReportsLegend />

            {/* Reports Toolbar */}
            <div className="absolute top-4 left-[60px] z-50 bg-gray-800/80 backdrop-blur-sm p-2 rounded-md shadow-lg flex items-center gap-2">
                <Input
                    type="date"
                    value={newReport.date}
                    onChange={(e) => setNewReport(prev => ({...prev, date: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white h-9"
                />
                 <Button onClick={() => alert("Função de busca por data a ser implementada.")}>Buscar Relatos</Button>
                <Button onClick={() => setIsReportMode(!isReportMode)} variant={isReportMode ? 'destructive' : 'default'}>
                    {isReportMode ? <X className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {isReportMode ? 'Cancelar Relato' : 'Adicionar Relato'}
                </Button>
            </div>
            
            {isReportMode && (
                <div className="absolute top-[80px] left-[60px] z-50 bg-gray-800/90 backdrop-blur-md p-4 rounded-lg shadow-lg w-72 space-y-4">
                    <h3 className="font-bold text-white text-lg border-b border-gray-600 pb-2 mb-3">Novo Relato de Tempo Severo</h3>
                    <div>
                        <Label className="text-gray-300">Tipo de Evento</Label>
                        <Select value={newReport.hazard} onValueChange={(v: HazardType) => setNewReport(prev => ({...prev, hazard: v}))}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="wind"><Wind className="inline-block mr-2 h-4 w-4" />Vento</SelectItem>
                                <SelectItem value="hail"><CloudHail className="inline-block mr-2 h-4 w-4" />Granizo</SelectItem>
                                <SelectItem value="tornado"><Tornado className="inline-block mr-2 h-4 w-4" />Tornado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label className="text-gray-300">Severidade</Label>
                        <Select value={newReport.sev} onValueChange={(v: 'NOR' | 'SS') => setNewReport(prev => ({...prev, sev: v}))}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NOR">Normal</SelectItem>
                                <SelectItem value="SS">Significativo (SS)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="text-sm text-yellow-300 bg-yellow-900/50 p-2 rounded-md flex items-center">
                        <MapPin className="h-5 w-5 mr-2 flex-shrink-0"/>
                        {newReport.location 
                            ? `Localização: ${newReport.location.latitude.toFixed(4)}, ${newReport.location.longitude.toFixed(4)}`
                            : "Clique no mapa para definir a localização."
                        }
                    </div>
                    <Button onClick={handleSaveReport} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!newReport.location}>
                        Salvar Relato
                    </Button>
                </div>
            )}

            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}
