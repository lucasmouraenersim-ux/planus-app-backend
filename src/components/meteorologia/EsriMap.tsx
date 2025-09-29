// src/components/meteorologia/EsriMap.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as turf from '@turf/turf';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Pencil, Menu, MapPin, X, PlusCircle, Calendar as CalendarIcon, Wind, CloudHail, Tornado, LogOut, Layers, AlertTriangle, Send, Loader2, Search as SearchIcon, Clock, Trash2, Edit } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot, Timestamp, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Input } from '../ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { loadCss, loadScript } from '@/lib/esri-loader';

import { addPolygon, clearAllPolygons, deletePolygon, getPolygonGroups, getPolygonsByHazard, initializePolygonManager, togglePolygonVisibility, updatePolygon, validateArea, catColor, levelOf, probabilityOptions } from './polygon-manager';


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

type HazardType = "hail" | "wind" | "tornado" | "prevots";
type DrawingMode = 'risk' | 'prevots' | 'none';

const hazardOptions: { value: Exclude<HazardType, 'prevots'>; label: string; icon: React.ElementType }[] = [
    { value: "hail", label: "Granizo", icon: CloudHail },
    { value: "wind", label: "Vento", icon: Wind },
    { value: "tornado", label: "Tornado", icon: Tornado },
];


const prevotsLevelOptions = [1, 2, 3, 4, 5];

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

const RiskLegend = ({ selectedHazard }: { selectedHazard: Exclude<HazardType, 'prevots'> }) => {
  const hazardProbs = probabilityOptions[selectedHazard] || [];
  
  const legendItems = hazardProbs.map(p => {
    const lvl = levelOf(p, selectedHazard);
    const color = catColor[lvl] || "#999";
    return `<div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="display: inline-block; width: 14px; height: 14px; background-color: ${color}; margin-right: 6px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.2);"></span>
              <span>${p}% (Nível ${lvl})</span>
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
      <b style={{display: 'block', marginBottom: '6px'}}>Legenda por Risco ({hazardOptions.find(h => h.value === selectedHazard)?.label})</b>
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
         <span style={{display: 'inline-block', width: '14px', height: '14px', backgroundColor: 'rgb(255, 165, 0)', marginRight: '6px'}} ></span>PREV 3
       </div>
       <div>
         <span style={{display: 'inline-block', width: '14px', height: '14px', backgroundColor: 'rgb(255, 0, 0)', marginRight: '6px'}} ></span>PREV 4
       </div>
       <div>
        <span style={{display:'inline-block',width:'14px',height:'14px',background:'#800080',marginRight:'6px'}}></span>PREV 5
      </div>
    </div>
);


const DrawUI = ({ onStartDrawing, onCancel, activeHazard }: { 
    onStartDrawing: (mode: DrawingMode, hazard: HazardType, probability: number, level: number) => void;
    onCancel: () => void;
    activeHazard: Exclude<HazardType, 'prevots'>;
}) => {
    const [activeMenu, setActiveMenu] = useState<'main' | 'risk' | 'prevots'>('risk'); // Default to risk
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions[activeHazard][0]);
    const [currentProbOptions, setCurrentProbOptions] = useState<number[]>(probabilityOptions[activeHazard]);
    const [selectedPrevotsLevel, setSelectedPrevotsLevel] = useState<number>(1);
    
    useEffect(() => {
      const newOptions = probabilityOptions[activeHazard] || [];
      setCurrentProbOptions(newOptions);
      if (!newOptions.includes(selectedProb)) {
          setSelectedProb(newOptions[0] || 0);
      }
    }, [activeHazard, selectedProb]);

    const handleStartDrawingWithState = () => {
        if (activeMenu === 'risk') {
            onStartDrawing('risk', activeHazard, selectedProb, selectedPrevotsLevel);
        } else if (activeMenu === 'prevots') {
            onStartDrawing('prevots', 'prevots', 0, selectedPrevotsLevel);
        }
    };

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
            {activeMenu === 'risk' && (
              <div className="space-y-4">
                <h3 className="font-bold">Desenhar Polígono de Risco</h3>
                <div>
                  <Label>Probabilidade (%) para {hazardOptions.find(h => h.value === activeHazard)?.label}</Label>
                  <Select value={String(selectedProb)} onValueChange={(v) => setSelectedProb(Number(v))}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{currentProbOptions.map(prob => <SelectItem key={prob} value={String(prob)}>{prob}%</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleStartDrawingWithState} className="w-full mt-4"><Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho</Button>
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
                <Button onClick={handleStartDrawingWithState} className="w-full mt-4"><Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho</Button>
              </div>
            )}
             <Button onClick={onCancel} variant="ghost" size="sm" className="w-full justify-center mt-4">Fechar</Button>
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
    const graphicsLayersRef = useRef<Record<string, __esri.GraphicsLayer>>({});
    
    // Refs for ESRI classes
    const esriModulesRef = useRef<any>({});

    const [isLoading, setIsLoading] = useState(true);
    const [brazilBoundary, setBrazilBoundary] = useState<any>(null);
    
    const [weatherModels, setWeatherModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('radar.nowcast');
    const [modelGroupLayer, setModelGroupLayer] = useState<__esri.GroupLayer | null>(null);

    const [isReportMode, setIsReportMode] = useState(false);
    const [newReport, setNewReport] = useState<{
        hazard: Exclude<HazardType, 'prevots'>,
        sev: 'NOR' | 'SS',
        date: string,
        location: __esri.Point | null
    }>({
        hazard: 'wind',
        sev: 'NOR',
        date: new Date().toISOString().slice(0, 10),
        location: null
    });
    
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
    const [countdown, setCountdown] = useState('');
    const [forecastDate, setForecastDate] = useState(getInitialForecastDate());

    const [selectedHazardForDisplay, setSelectedHazardForDisplay] = useState<Exclude<HazardType, 'prevots'>>('hail');
    
    const sketchViewModelRef = useRef<__esri.widgets.Sketch.SketchViewModel | null>(null);

    const [dialogState, setDialogState] = useState<{
      isOpen: boolean;
      graphic: __esri.Graphic | null;
    }>({ isOpen: false, graphic: null });

    function getInitialForecastDate() {
        const now = new Date();
        const deadline = new Date(now);
        deadline.setHours(12, 0, 0, 0); // Deadline is at 12:00:00.000

        if (now >= deadline) {
            // If it's past noon, forecast is for the next day
            now.setDate(now.getDate() + 1);
        }
        return now.toISOString().slice(0, 10);
    }

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            let deadline = new Date();
            deadline.setHours(12, 0, 0, 0);

            if (now > deadline) {
                deadline.setDate(deadline.getDate() + 1);
            }

            const diff = deadline.getTime() - now.getTime();

            if (diff <= 0) {
                setForecastDate(getInitialForecastDate());
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdown(
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/meteorologia/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
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
    
    const handleSaveHazardForecast = async (hazard: Exclude<HazardType, 'prevots'>) => {
        const polygonsToSave = getPolygonsByHazard(hazard);
        if (polygonsToSave.length === 0) {
            alert(`Nenhum polígono de ${hazard} para salvar.`);
            return;
        }

        setIsSubmitting(prev => ({...prev, [hazard]: true}));

        try {
            const forecastId = `forecast_${forecastDate}_${hazard}`;
            const forecastDocRef = doc(db, 'weather_forecasts', forecastId);
            
            const featuresToSave = polygonsToSave.map(g => ({
              geometry: JSON.stringify(g.geometry.toJSON()),
              attributes: g.attributes
            }));

            await setDoc(forecastDocRef, {
                date: forecastDate,
                hazard: hazard,
                createdAt: serverTimestamp(),
                features: featuresToSave
            }, { merge: true }); // Merge to update if doc exists

            alert(`Previsão para ${hazard} salva com sucesso!`);
            
        } catch (error) {
            console.error(`Erro ao salvar previsão de ${hazard}: `, error);
            alert(`Falha ao salvar a previsão de ${hazard}.`);
        } finally {
            setIsSubmitting(prev => ({...prev, [hazard]: false}));
        }
    };

    const handleLoadForecast = useCallback(async () => {
        if (!viewRef.current || !esriModulesRef.current.Polygon) return;
        
        clearAllPolygons(viewRef.current);
        
        setIsLoading(true);

        const hazardsToFetch: HazardType[] = ['hail', 'wind', 'tornado', 'prevots'];
        
        try {
            const { Polygon, Graphic, SimpleFillSymbol, Color } = esriModulesRef.current;

            for (const hazard of hazardsToFetch) {
                const forecastId = `forecast_${forecastDate}_${hazard}`;
                const forecastDocRef = doc(db, 'weather_forecasts', forecastId);
                const docSnap = await getDoc(forecastDocRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const features = data.features || [];
                    
                    features.forEach((feature: any) => {
                        const geometry = new Polygon(JSON.parse(feature.geometry));
                        const attributes = feature.attributes;
                        const { type, hazard: featureHazard, prob, level } = attributes;
                        
                        let colorHex = "#999";
                        if (type === 'risk') {
                            const riskLevel = levelOf(prob, featureHazard);
                            colorHex = catColor[riskLevel] || "#999";
                        } else if (type === 'prevots') {
                            colorHex = catColor[level] || "#999";
                        }

                        const symbol = new SimpleFillSymbol({
                            color: [...new Color(colorHex).toRgb(), 0.25],
                            outline: { color: new Color(colorHex), width: 2 }
                        });

                        const graphic = new Graphic({ geometry, symbol, attributes });
                        const targetLayer = graphicsLayersRef.current[featureHazard || type];
                        if (targetLayer) {
                            targetLayer.add(graphic);
                        }
                    });
                }
            }
            alert("Previsões carregadas do Firestore!");
        } catch (error) {
            console.error("Erro ao carregar previsões: ", error);
            alert("Falha ao carregar previsões do banco de dados.");
        } finally {
            setIsLoading(false);
        }
    }, [forecastDate]);

    const handleHazardChangeForDisplay = useCallback((hazard: Exclude<HazardType, 'prevots'>) => {
        setSelectedHazardForDisplay(hazard);
        if(viewRef.current) {
            togglePolygonVisibility(viewRef.current, hazard);
        }
    }, []);

    const handleStartDrawing = useCallback((mode: DrawingMode, hazard: HazardType, probability: number, level: number) => {
        const sketchVM = sketchViewModelRef.current;
        if (!sketchVM) return;

        const { Color, SimpleFillSymbol } = esriModulesRef.current;
    
        let symbolOptions: any = {};
        let attributes: any = {};
        let targetLayerId: string | undefined;

        if (mode === 'risk') {
            const riskHazard = hazard as Exclude<HazardType, 'prevots'>;
            const prob = probability;
            const riskLevel = levelOf(prob, riskHazard);
            const colorHex = catColor[riskLevel] || "#999999";
            
            symbolOptions = {
                color: [...new Color(colorHex).toRgb(), 0.25],
                outline: { color: new Color(colorHex), width: 2 }
            };
            
            targetLayerId = riskHazard;
            attributes = { type: 'risk', hazard: riskHazard, prob, level: riskLevel, date: forecastDate };
        } else if (mode === 'prevots') {
            const colorHex = catColor[level] || "#999999";
            symbolOptions = {
                color: [...new Color(colorHex).toRgb(), 0.25],
                outline: { color: new Color(colorHex), width: 2 }
            };
            targetLayerId = 'prevots';
            attributes = { type: 'prevots', level: level, date: forecastDate };
        }


        if (targetLayerId && graphicsLayersRef.current[targetLayerId]) {
            sketchVM.layer = graphicsLayersRef.current[targetLayerId];
        } else {
            console.error(`Layer ${targetLayerId} não encontrada para o desenho.`);
            return;
        }
        
        const newSymbol = new SimpleFillSymbol(symbolOptions);
        sketchVM.polygonSymbol = newSymbol;
        (sketchVM as any)._creationAttributes = attributes;

        sketchVM.create("polygon");

    }, [forecastDate]);

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
                    SimpleFillSymbol, SimpleLineSymbol, PictureMarkerSymbol, Point, SketchViewModel
                ] = await loadScript();

                // Store loaded modules in refs
                esriModulesRef.current = {
                    Map, MapView, Basemap, TileLayer, GroupLayer, BasemapGallery,
                    Expand, LayerList, Sketch, GraphicsLayer, WebTileLayer,
                    webMercatorUtils, Polygon, Color, Graphic, SimpleFillSymbol,
                    SimpleLineSymbol, PictureMarkerSymbol, Point, SketchViewModel
                };
                
                initializePolygonManager(turf);

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
                
                const modelLayers = models.map(model => new WebTileLayer({ id: model.id, urlTemplate: `https://tilecache.rainviewer.com${model.path}/256/{level}/{col}/{row}/5/1_1.png`, title: model.name, visible: model.id === selectedModel, opacity: 0.7 }));
                const newModelGroupLayer = new GroupLayer({ title: "Modelos Meteorológicos", visible: true, layers: modelLayers });
                setModelGroupLayer(newModelGroupLayer);
                
                hazardOptions.forEach(h => { graphicsLayersRef.current[h.value] = new GraphicsLayer({ id: h.value, title: h.label, visible: h.value === selectedHazardForDisplay }); });
                graphicsLayersRef.current.prevots = new GraphicsLayer({ id: "prevots", title: "Previsao PREVOTS", visible: true });
                graphicsLayersRef.current.reports = new GraphicsLayer({ id: "reports", title: "Relatos", visible: true });
                
                const basemap = await Basemap.fromId("dark-gray-vector");
                const map = new Map({ basemap: basemap, layers: [ newModelGroupLayer, ...Object.values(graphicsLayersRef.current) ] });
                view = new MapView({ container: mapDivRef.current!, map: map, center: [-54, -15], zoom: 5 });
                viewRef.current = view;
                
                view.when(() => { setIsLoading(false); });
                view.popup.autoOpenEnabled = false; 

                const basemapGallery = new BasemapGallery({ view });
                view.ui.add(new Expand({ view, content: basemapGallery, expandIconClass: "esri-icon-basemap", group: "top-left" }), "top-left");

                const layerList = new LayerList({ view });
                view.ui.add(new Expand({ view, content: layerList, expandIconClass: "esri-icon-layers", group: "top-left" }), "top-left");
                
                const sketchVM = new SketchViewModel({ view: view });
                sketchViewModelRef.current = sketchVM;

                sketchVM.on("create", (event: __esri.SketchViewModelCreateEvent) => {
                    if (event.state === "complete") {
                         const attributes = (sketchViewModelRef.current as any)._creationAttributes || {};
                        addPolygon({
                            graphic: event.graphic,
                            attributes: attributes,
                            brazilBoundary,
                            Color, SimpleFillSymbol, SimpleLineSymbol, Polygon, webMercatorUtils
                        });
                    }
                });

                sketchVM.on("update", (event: any) => {
                    if (event.state === "complete") {
                        event.graphics.forEach((graphic: __esri.Graphic) => {
                             const { hazard, prob, level, type } = graphic.attributes;
                            
                             const geographicGeom = webMercatorUtils.webMercatorToGeographic(graphic.geometry) as __esri.Polygon;
                             const turfPolygon = turf.polygon(geographicGeom.rings);
                             const clipped = turf.intersect(turfPolygon, brazilBoundary);
                            
                             if (!clipped || !clipped.geometry) {
                                alert("A edição resultou em um polígono fora dos limites do Brasil. Revertendo.");
                                sketchVM.cancel(); // Revert the edit
                                return;
                             }
                            
                             const esriPolygon = new Polygon({ rings: (clipped.geometry as any).coordinates, spatialReference: { wkid: 4326 } });
                            
                             if (type === 'risk') {
                                if (!validateArea(esriPolygon, level, hazard)) {
                                    alert("Falha na validação da área. A edição foi cancelada.");
                                    sketchVM.cancel();
                                    return;
                                }
                             }
                            
                             graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);
                             updatePolygon(graphic, graphic.attributes);
                             console.log(`✅ Polígono (${hazard}, ${prob}%) atualizado.`);
                        });
                    }
                });
                
                view.on("click", (event) => {
                    if (sketchViewModelRef.current?.state === 'active') return; // Don't interfere with active drawing/editing

                    view.hitTest(event).then((response) => {
                        const results = response.results.filter(r => r.graphic && r.graphic.layer?.type === 'graphics');
                        if (results.length > 0) {
                            const graphic = results[0].graphic;
                            // Check if the forecast is for the current prediction cycle
                            if (graphic.attributes.date === forecastDate) {
                                setDialogState({ isOpen: true, graphic: graphic });
                            } else {
                                alert("Não é possível editar ou excluir previsões de datas passadas.");
                            }
                        }
                    });
                });
                
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
                        onStartDrawing={(mode, hazard, prob, level) => {
                             handleStartDrawing(mode, hazard, prob, level);
                        }}
                        onCancel={() => { sketchExpand.collapse(); sketchViewModelRef.current?.cancel(); }}
                        activeHazard={selectedHazardForDisplay}
                    />
                );

            } catch (error) {
                console.error("Erro ao carregar o mapa da Esri:", error);
                setIsLoading(false);
            }
        };

        if (brazilBoundary) {
            initMap();
        }

        return () => { if (viewRef.current) viewRef.current.destroy(); };
    }, [brazilBoundary, userAppRole, handleStartDrawing, handleLoadForecast, selectedHazardForDisplay]);
    

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
    
    const startEdit = () => {
      if (dialogState.graphic) {
        sketchViewModelRef.current?.update(dialogState.graphic, { tool: "transform" });
      }
      setDialogState({ isOpen: false, graphic: null });
    };

    const confirmDelete = () => {
      if (dialogState.graphic) {
        const { graphic } = dialogState;
        const layerId = graphic.layer.id;
        deletePolygon(graphic, graphicsLayersRef.current[layerId]);
      }
      setDialogState({ isOpen: false, graphic: null });
    };


    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isLoading && <LoadingSpinner />}
            <Scoreboard />
            <StatsPanel />
            <ReportsLegend />
            <RiskLegend selectedHazard={selectedHazardForDisplay} />
            <PrevotsLegend />
            
            <div className="absolute top-4 left-[110px] z-50 bg-gray-800/80 backdrop-blur-sm p-2 rounded-md shadow-lg flex items-center gap-2 flex-wrap">
                <Input type="date" value={forecastDate} onChange={(e) => setForecastDate(e.target.value)} className="bg-gray-700 border-gray-600 text-white h-9" />
                <Button onClick={handleLoadForecast}><SearchIcon className="mr-2 h-4 w-4"/>Ver Previsão Feita</Button>
                {(userAppRole === 'superadmin') && (
                    <Button onClick={() => setIsReportMode(!isReportMode)} variant={isReportMode ? 'destructive' : 'default'}>
                        {isReportMode ? <X className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        {isReportMode ? 'Cancelar Relato' : 'Adicionar Relato'}
                    </Button>
                )}
            </div>
            
            <div className="absolute top-[88px] left-[60px] z-50 bg-gray-800/80 backdrop-blur-sm p-1 rounded-md shadow-lg flex flex-col md:flex-row items-stretch gap-1">
                 {hazardOptions.map(hazard => (
                    <div key={hazard.value} className="flex items-center gap-1">
                        <Button 
                            variant={selectedHazardForDisplay === hazard.value ? 'secondary' : 'ghost'}
                            onClick={() => handleHazardChangeForDisplay(hazard.value)}
                            className="flex-grow justify-start text-white hover:bg-gray-700 data-[state=active]:bg-blue-600"
                        >
                           <hazard.icon className="h-4 w-4 mr-2" /> {hazard.label}
                        </Button>
                        {userAppRole === 'superadmin' && (
                             <Button 
                                size="sm"
                                onClick={() => handleSaveHazardForecast(hazard.value)} 
                                disabled={isSubmitting[hazard.value]}
                                className="bg-green-600 hover:bg-green-700 h-full"
                             >
                                {isSubmitting[hazard.value] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                <span className="sr-only">Salvar {hazard.label}</span>
                            </Button>
                        )}
                    </div>
                ))}
            </div>

            {isReportMode && (
                <div className="absolute top-[182px] left-[60px] z-50 bg-gray-800/90 backdrop-blur-md p-4 rounded-lg shadow-lg w-72 space-y-4">
                    <h3 className="font-bold text-white text-lg border-b border-gray-600 pb-2 mb-3">Novo Relato de Tempo Severo</h3>
                    <div>
                        <Label className="text-gray-300">Tipo de Evento</Label>
                        <Select value={newReport.hazard} onValueChange={(v: Exclude<HazardType, 'prevots'>) => setNewReport(prev => ({...prev, hazard: v}))}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {hazardOptions.map(opt => <SelectItem key={opt.value} value={opt.value}><opt.icon className="inline-block mr-2 h-4 w-4" />{opt.label}</SelectItem>)}
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
            
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000 }} className="bg-gray-800/80 backdrop-blur-sm p-2 rounded-md shadow-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-400"/>
                <span className="text-sm font-mono text-yellow-400" title="Tempo restante para a previsão do dia atual">
                    {countdown}
                </span>
            </div>

             <AlertDialog open={dialogState.isOpen} onOpenChange={(isOpen) => setDialogState({ isOpen, graphic: isOpen ? dialogState.graphic : null })}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ação do Polígono</AlertDialogTitle>
                  <AlertDialogDescription>
                    O que você gostaria de fazer com o polígono selecionado?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Button variant="outline" onClick={startEdit}>
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  <AlertDialogAction asChild>
                    <Button variant="destructive" onClick={confirmDelete}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
}

```
- src/components/meteorologia/polygon-manager.ts:
```ts
// src/components/meteorologia/polygon-manager.ts

import type { Feature, Polygon as TurfPolygon } from '@turf/turf';

// Definições de tipo para clareza
type EsriPolygon = __esri.Polygon;
type EsriGraphic = __esri.Graphic;
type EsriColor = __esri.Color;
type EsriSimpleFillSymbol = __esri.symbols.SimpleFillSymbol;
type EsriSimpleLineSymbol = __esri.symbols.SimpleLineSymbol;
type EsriGraphicsLayer = __esri.layers.GraphicsLayer;
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
        ? ({2:1, 5:2, 10:3, 15:4}[p] || 0)
        : ({5:1, 15:2, 30:3, 45:4}[p] || 0);
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
    polygonGroups[groupKey] = polygonGroups[groupKey].filter(g => g.uid !== graphic.uid);
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
```
- src/lib/esri-loader.ts:
```ts
// src/lib/esri-loader.ts

// Flag to ensure CSS is loaded only once
let isCssLoaded = false;

// Function to load the Esri CSS
export function loadCss(url?: string) {
    if (isCssLoaded) {
        return;
    }
    const esriVersion = "4.29"; // Use a consistent version
    const finalUrl = url || `https://js.arcgis.com/${esriVersion}/esri/themes/dark/main.css`;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = finalUrl;
    document.head.appendChild(link);
    isCssLoaded = true;
}

// Type definition for the loaded modules
type EsriModules = [
    typeof __esri.Map,
    typeof __esri.MapView,
    typeof __esri.Basemap,
    typeof __esri.TileLayer,
    typeof __esri.GroupLayer,
    typeof __esri.BasemapGallery,
    typeof __esri.Expand,
    typeof __esri.LayerList,
    typeof __esri.Sketch,
    typeof __esri.GraphicsLayer,
    typeof __esri.WebTileLayer,
    typeof import ("esri/geometry/support/webMercatorUtils"),
    typeof __esri.Polygon,
    typeof __esri.Color,
    typeof __esri.Graphic,
    typeof __esri.symbols.SimpleFillSymbol,
    typeof __esri.symbols.SimpleLineSymbol,
    typeof __esri.symbols.PictureMarkerSymbol,
    typeof __esri.Point,
    typeof __esri.widgets.Sketch.SketchViewModel,
];

// Helper to require modules
function requireModules(resolve: (modules: EsriModules) => void) {
    // @ts-ignore
    window.require([
        "esri/Map",
        "esri/views/MapView",
        "esri/Basemap",
        "esri/layers/TileLayer",
        "esri/layers/GroupLayer",
        "esri/widgets/BasemapGallery",
        "esri/widgets/Expand",
        "esri/widgets/LayerList",
        "esri/widgets/Sketch",
        "esri/layers/GraphicsLayer",
        "esri/layers/WebTileLayer",
        "esri/geometry/support/webMercatorUtils",
        "esri/geometry/Polygon",
        "esri/Color",
        "esri/Graphic",
        "esri/symbols/SimpleFillSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/PictureMarkerSymbol",
        "esri/geometry/Point",
        "esri/widgets/Sketch/SketchViewModel",
    ], (...modules: EsriModules) => {
        resolve(modules);
    });
}

// Function to load the Esri JavaScript modules
export function loadScript(): Promise<EsriModules> {
    const esriVersion = "4.29";
    const scriptUrl = `https://js.arcgis.com/${esriVersion}/`;

    return new Promise((resolve, reject) => {
        // @ts-ignore
        if (window.require) {
            requireModules(resolve);
            return;
        }

        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            requireModules(resolve);
        };

        script.onerror = (error) => {
            console.error("Failed to load ArcGIS API script:", error);
            reject(new Error("Failed to load the ArcGIS API for JavaScript."));
        };
    });
}
```