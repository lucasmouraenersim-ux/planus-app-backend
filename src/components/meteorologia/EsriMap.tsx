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
import { Pencil, Menu, MapPin, X, PlusCircle, Calendar as CalendarIcon, Wind, CloudHail, Tornado, LogOut, Layers, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot, Timestamp, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Input } from '../ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

import { addPolygon, removePolygon, getAllPolygons, getPolygonsByHazard, togglePolygonVisibility, catColor, levelOf } from './polygon-manager';

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
type DrawingMode = 'risk' | 'prevots' | 'none';

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

const prevotsLevelOptions = [1, 2, 3, 4];

const hexToRgbArray = (hex: string): [number, number, number] => {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b];
};


const SideMenu = ({ onLogout }: { onLogout: () => void }) => {
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
        <div className="bg-gray-800 p-3 rounded-md shadow-md text-white w-56 flex flex-col h-full">
            <ul className="space-y-2 flex-grow">
                {menuItems.map(item => (
                    <li key={item}>
                        <a href="#" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-700 transition-colors">
                            {item}
                        </a>
                    </li>
                ))}
            </ul>
             <Button onClick={onLogout} variant="ghost" className="w-full justify-start text-left text-red-400 hover:bg-red-900/50 hover:text-white mt-4">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
            </Button>
        </div>
    );
};

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

const StatsPanel = () => {
    return (
        <div id="statsPanel" style={{
            position: "fixed",
            bottom: "180px",
            right: "20px",
            background: "rgba(30, 30, 30, 0.85)",
            color: "white",
            padding: "10px 14px",
            fontSize: "13px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            fontFamily: "sans-serif",
            zIndex: 9999
        }}>
            <div id="statsContent">Carregando estatísticas...</div>
        </div>
    );
};

const ReportsLegend = () => {
    return (
        <div id="legendReports" className="bg-gray-800/80 backdrop-blur-sm text-white" style={{
            position: 'fixed',
            bottom: '95px',
            left: '20px',
            padding: '10px 14px',
            fontSize: '13px',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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

const RiskLegend = ({ selectedHazard }: { selectedHazard: HazardType }) => {
    const legendItems = probabilityOptions[selectedHazard].map(p => {
        const lvl = levelOf(p, selectedHazard);
        const color = catColor[lvl] || "#999";
        return `<div style="margin-bottom:4px">
            <span style="display:inline-block;width:14px;height:14px;background:${color};margin-right:6px;border-radius:2px;"></span>
            ${p}% (Nível ${lvl})
        </div>`;
    }).join('');

    return (
      <div id="legendRisk" className="bg-gray-800/80 backdrop-blur-sm text-white" style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 14px',
        fontSize: '13px',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        fontFamily: 'sans-serif',
        zIndex: 9999,
      }}>
        <b>Legenda por risco ({hazardOptions.find(h => h.value === selectedHazard)?.label})</b>
        <div id="legendItems" dangerouslySetInnerHTML={{ __html: legendItems }}></div>
      </div>
    );
};


const PrevotsLegend = () => (
    <div id="legendPrevots" style={{
        display: 'none',
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(30, 30, 30, 0.85)',
        color: 'white',
        padding: '10px 14px',
        fontSize: '13px',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        fontFamily: 'sans-serif',
        zIndex: 9999
    }}>
      <b>Níveis PREVOTS</b>
      <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#00FF00',marginRight:'6px'}}></span>PREV 1
      </div>
      <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#FFFF00',marginRight:'6px'}}></span>PREV 2
      </div>
       <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#FFA500',marginRight:'6px'}}></span>PREV 3
      </div>
       <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#FF0000',marginRight:'6px'}}></span>PREV 4
      </div>
       <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#800080',marginRight:'6px'}}></span>PREV 5
      </div>
    </div>
);


const DrawUI = ({ onStartDrawing, selectedHazard, setSelectedHazard, selectedProb, setSelectedProb, selectedPrevotsLevel, setSelectedPrevotsLevel, onCancel }: { 
    onStartDrawing: (mode: DrawingMode) => void;
    selectedHazard: HazardType;
    setSelectedHazard: (h: HazardType) => void;
    selectedProb: number;
    setSelectedProb: (p: number) => void;
    selectedPrevotsLevel: number;
    setSelectedPrevotsLevel: (l: number) => void;
    onCancel: () => void;
}) => {
    const [activeMenu, setActiveMenu] = useState<'main' | 'risk' | 'prevots'>('main');

    useEffect(() => {
        if (activeMenu === 'risk') {
            setSelectedProb(probabilityOptions[selectedHazard][0]);
        }
    }, [selectedHazard, activeMenu, setSelectedProb]);

    return (
      <div className="bg-gray-800 p-3 rounded-md shadow-md text-white">
        {activeMenu === 'main' && (
          <div className="space-y-2">
            <Button onClick={() => setActiveMenu('risk')} className="w-full justify-start"><Layers className="mr-2 h-4 w-4"/> Previsão de Risco</Button>
            <Button onClick={() => setActiveMenu('prevots')} className="w-full justify-start"><AlertTriangle className="mr-2 h-4 w-4"/> Previsão PREVOTS</Button>
            <Button onClick={onCancel} variant="ghost" size="sm" className="w-full justify-center mt-2">Fechar</Button>
          </div>
        )}
        
        {activeMenu !== 'main' && (
          <>
            <Button onClick={() => setActiveMenu('main')} variant="ghost" size="sm" className="mb-4"> &lt; Voltar</Button>
            {activeMenu === 'risk' && (
              <div className="space-y-4">
                <h3 className="font-bold">Desenhar Polígono de Risco</h3>
                <div>
                  <Label>Tipo de Risco</Label>
                  <Select value={selectedHazard} onValueChange={(v) => setSelectedHazard(v as HazardType)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{hazardOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Probabilidade (%)</Label>
                  <Select value={String(selectedProb)} onValueChange={(v) => setSelectedProb(Number(v))}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{probabilityOptions[selectedHazard].map(prob => <SelectItem key={prob} value={String(prob)}>{prob}%</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => onStartDrawing('risk')} className="w-full mt-4"><Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho</Button>
              </div>
            )}
            {activeMenu === 'prevots' && (
              <div className="space-y-4">
                <h3 className="font-bold">Desenhar Polígono PREVOTS</h3>
                <div>
                  <Label>Nível PREVOTS</Label>
                  <Select value={String(selectedPrevotsLevel)} onValueChange={(v) => setSelectedPrevotsLevel(Number(v))}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue/></SelectTrigger>
                    <SelectContent>{prevotsLevelOptions.map(lvl => <SelectItem key={lvl} value={String(lvl)}>Nível {lvl}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => onStartDrawing('prevots')} className="w-full mt-4"><Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho</Button>
              </div>
            )}
          </>
        )}
      </div>
    );
};


export function EsriMap() {
    const { userAppRole } = useAuth();
    const router = useRouter();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<__esri.MapView | null>(null);
    const sketchRef = useRef<__esri.Sketch | null>(null);
    const graphicsLayerRef = useRef<__esri.GraphicsLayer | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);
    
    const [weatherModels, setWeatherModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('radar.nowcast');
    const [modelGroupLayer, setModelGroupLayer] = useState<__esri.GroupLayer | null>(null);

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
    const [isSubmittingForecast, setIsSubmittingForecast] = useState(false);
    const [isViewingForecast, setIsViewingForecast] = useState(false);
    const [forecastDate, setForecastDate] = useState(new Date().toISOString().slice(0, 10));
    
    const [selectedHazard, setSelectedHazard] = useState<HazardType>('hail');
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions.hail[0]);
    const [selectedPrevotsLevel, setSelectedPrevotsLevel] = useState<number>(1);
    
    const [isDrawing, setIsDrawing] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/meteorologia/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };
    
    const handleStartDrawing = (mode: DrawingMode) => {
        if (!sketchRef.current) return;
        
        const hazard = selectedHazard;
        const prob = selectedProb;
        const level = levelOf(prob, hazard);
        const colorHex = catColor[level] || "#999999";
        const [r, g, b] = hexToRgbArray(colorHex);

        const symbol = new (sketchRef.current as any).viewModel.polygonSymbol.constructor({
             color: new (sketchRef.current as any).viewModel.polygonSymbol.color.constructor([r, g, b, 0.25]),
             outline: { color: new (sketchRef.current as any).viewModel.polygonSymbol.outline.color.constructor([r, g, b, 1]), width: 2 }
        });
        
        (sketchRef.current as any).viewModel.polygonSymbol = symbol;
        
        setIsDrawing(true);
        sketchRef.current.create("polygon");
    };


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

    useEffect(() => {
        if (!modelGroupLayer) return;
        modelGroupLayer.layers.forEach((layer: any) => {
            layer.visible = (layer.id === selectedModel);
        });
    }, [selectedModel, modelGroupLayer]);

    const handleSendForecast = async () => {
        const allGraphics = getAllPolygons();
        if (allGraphics.length === 0) {
            alert("Nenhum polígono desenhado para enviar.");
            return;
        }
        setIsSubmittingForecast(true);
        try {
            const forecastId = `forecast_${forecastDate}`;
            const forecastDocRef = doc(db, 'weather_forecasts', forecastId);
            
            const features = allGraphics.map(g => {
                const geoJSON = g.geometry.toJSON();
                return JSON.stringify(geoJSON);
            });

            await setDoc(forecastDocRef, {
                date: forecastDate,
                createdAt: serverTimestamp(),
                features: features.map(f => JSON.parse(f)),
                attributes: allGraphics.map(g => g.attributes)
            });


            alert("Previsão enviada com sucesso!");
            
        } catch (error) {
            console.error("Erro ao enviar previsão: ", error);
            alert("Falha ao enviar a previsão.");
        } finally {
            setIsSubmittingForecast(false);
        }
    };

    useEffect(() => {
        let view: __esri.MapView;
        
        const initMap = async () => {
            if (!mapDivRef.current || !brazilBoundary) return;

            try {
                loadCss();
                const [
                    Map, MapView, Basemap, TileLayer, GroupLayer,
                    BasemapGallery, Expand, LayerList, Sketch, GraphicsLayer,
                    WebTileLayer, webMercatorUtils, Polygon, Color, Graphic, 
                    SimpleFillSymbol, SimpleLineSymbol, PictureMarkerSymbol, Point
                ] = await loadScript();

                let models: any[] = [];
                try {
                    const response = await fetch('/api/rainviewer');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    models = Object.keys(data.radar).map(key => ({ id: `radar.${key}`, path: data.radar[key][0].path, name: `Radar ${key}` }));
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
                
                graphicsLayerRef.current = new GraphicsLayer({ id: 'userGraphics' });
                const reportsLayer = new GraphicsLayer({ id: 'reports' });
                
                const map = new Map({ basemap: "dark-gray-vector", layers: [newModelGroupLayer, graphicsLayerRef.current, reportsLayer] });
                view = new MapView({ container: mapDivRef.current!, map: map, center: [-54, -15], zoom: 5 });
                viewRef.current = view;
                
                view.when(() => {
                    setIsLoading(false);
                });
                
                view.popup.autoOpenEnabled = false; 

                const basemapGallery = new BasemapGallery({ view });
                view.ui.add(new Expand({ view, content: basemapGallery, expandIconClass: "esri-icon-basemap", group: "top-left" }), "top-left");

                const layerList = new LayerList({ view });
                view.ui.add(new Expand({ view, content: layerList, expandIconClass: "esri-icon-layers", group: "top-left" }), "top-left");
                
                const sketch = new Sketch({ view, layer: graphicsLayerRef.current!, creationMode: "update" });
                sketchRef.current = sketch;
                
                const drawContainer = document.createElement("div");
                const sketchExpand = new Expand({ view: view, content: drawContainer, expandIconClass: "esri-icon-edit", group: "top-left" });
                
                const menuContainer = document.createElement("div");
                const menuExpand = new Expand({ view: view, content: menuContainer, expandIconClass: "esri-icon-menu", group: "top-left" });

                if (userAppRole === 'superadmin') view.ui.add(sketchExpand, "top-left");
                view.ui.add(menuExpand, "top-left");
                
                const menuRoot = createRoot(menuContainer);
                menuRoot.render(<SideMenu onLogout={handleLogout} />);
                
                const root = createRoot(drawContainer);
                root.render(
                    <DrawUI 
                        onStartDrawing={handleStartDrawing} 
                        selectedHazard={selectedHazard}
                        setSelectedHazard={setSelectedHazard}
                        selectedProb={selectedProb}
                        setSelectedProb={setSelectedProb}
                        selectedPrevotsLevel={selectedPrevotsLevel}
                        setSelectedPrevotsLevel={setSelectedPrevotsLevel}
                        onCancel={() => { sketchExpand.collapse(); setIsDrawing(false); }}
                    />
                );
                
                sketch.on("create", (event) => {
                    if (event.state === "complete") {
                         if (!brazilBoundary) {
                            alert("Contorno do Brasil não carregado. Tente desenhar novamente em alguns segundos.");
                            sketchRef.current?.cancel();
                            return;
                        }

                        const addedGraphic = addPolygon({
                            graphic: event.graphic,
                            hazard: selectedHazard,
                            prob: selectedProb,
                            brazilBoundary,
                            Color, SimpleFillSymbol, SimpleLineSymbol, Polygon, webMercatorUtils
                        });
                        
                        if (addedGraphic) {
                            graphicsLayerRef.current?.remove(event.graphic);
                            graphicsLayerRef.current?.add(addedGraphic);
                        } else {
                            graphicsLayerRef.current?.remove(event.graphic);
                        }
                        setIsDrawing(false);
                    }
                });

            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (brazilBoundary) {
            initMap();
        }

        return () => { if (viewRef.current) viewRef.current.destroy(); };
    }, [brazilBoundary, userAppRole, selectedHazard, selectedProb, selectedPrevotsLevel]);
    
    useEffect(() => {
        if(graphicsLayerRef.current && viewRef.current) {
            togglePolygonVisibility(viewRef.current.map, selectedHazard);
        }
    }, [selectedHazard]);
    

    const handleSaveReport = async () => {
        if (!newReport.location) {
            alert("Por favor, clique no mapa para definir a localização do relato.");
            return;
        }
        const reportData = { hazard: newReport.hazard, sev: newReport.sev, date: newReport.date, location: { latitude: newReport.location.latitude, longitude: newReport.location.longitude }, timestamp: Timestamp.now() };
        try {
            await addDoc(collection(db, "weather_reports"), reportData);
            alert("Relato salvo com sucesso!");
            setIsReportMode(false);
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
            <RiskLegend selectedHazard={selectedHazard} />
            <PrevotsLegend />

            <div className="absolute top-4 left-[60px] z-50 bg-gray-800/80 backdrop-blur-sm p-2 rounded-md shadow-lg flex items-center gap-2">
                <Input type="date" value={forecastDate} onChange={(e) => setForecastDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white h-9" />
                <Button onClick={() => alert("Função de busca por data a ser implementada.")}>Buscar Previsões</Button>
                {(userAppRole === 'superadmin') && (
                    <>
                        <Button onClick={handleSendForecast} disabled={isSubmittingForecast || getAllPolygons().length === 0} className="bg-green-600 hover:bg-green-700">
                            {isSubmittingForecast ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Enviar Previsão
                        </Button>
                        <Button onClick={() => setIsReportMode(!isReportMode)} variant={isReportMode ? 'destructive' : 'default'}>
                            {isReportMode ? <X className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {isReportMode ? 'Cancelar Relato' : 'Adicionar Relato'}
                        </Button>
                    </>
                )}
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
