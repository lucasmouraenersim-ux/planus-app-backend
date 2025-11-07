
'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as turf from '@turf/turf';

import { createPortal } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Pencil,
  Menu,
  MapPin,
  X,
  PlusCircle,
  Calendar as CalendarIcon,
  Wind,
  CloudHail,
  Tornado,
  LogOut,
  Layers,
  AlertTriangle,
  Send,
  Loader2,
  Search as SearchIcon,
  Clock,
  Trash2,
  Edit,
} from 'lucide-react';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Input } from '../ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { loadCss, loadScript } from '@/lib/esri-loader';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

import {
  addPolygon,
  clearAllPolygons,
  deletePolygon,
  getPolygonsByHazard,
  initializePolygonManager,
  togglePolygonVisibility,
  updatePolygon,
  validateArea,
  catColor,
  levelOf,
  probabilityOptions,
} from './polygon-manager';

type HazardType = 'hail' | 'wind' | 'tornado' | 'prevots';
type DrawingMode = 'risk' | 'prevots' | 'none';

const LoadingSpinner = () => (
  <div className="absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center bg-gray-900 bg-opacity-70 text-white">
    <div className="flex items-center justify-center space-x-1">
      <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0s' }} />
      <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.1s' }} />
      <div className="h-8 w-2 animate-pulse bg-white" style={{ animationDelay: '0.2s' }} />
      <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.3s' }} />
      <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0.4s' }} />
    </div>
    <p className="mt-4 text-sm">Carregando mapa meteorológico...</p>
  </div>
);

const hazardOptions = [
  { value: 'hail', label: 'Granizo', icon: CloudHail },
  { value: 'wind', label: 'Vento', icon: Wind },
  { value: 'tornado', label: 'Tornado', icon: Tornado },
] as const;

const prevotsLevelOptions = [1, 2, 3, 4, 5];

const SideMenu = ({ onLogout }: { onLogout: () => void }) => {
  const menuItems = [
    'Modelos Meteorologico',
    'Placar',
    'Galeria de tornados no Brasil',
    'Relatos de Tempo Severo',
    'Galeria Storm Chaser BR',
    'Perfil',
    'Patrocine-nos',
  ];

  return (
    <div className="flex h-full w-56 flex-col rounded-md bg-gray-800 p-3 text-white shadow-md">
      <ul className="flex-grow space-y-2">
        {menuItems.map((item) => (
          <li key={item}>
            <a
              href="#"
              className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-700"
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
      <Button
        onClick={onLogout}
        variant="ghost"
        className="mt-4 w-full justify-start text-left text-red-400 hover:bg-red-900/50 hover:text-white"
      >
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
    <div className="pointer-events-none absolute right-[20px] top-[88px] z-10 w-[240px]">
      <table className="w-full border-collapse bg-black/60 text-[13px] font-sans leading-tight text-white">
        <thead>
          <tr>
            <th className="border border-gray-700 p-1">Perigo</th>
            <th className="border border-gray-700 p-1">Acertos</th>
            <th className="border border-gray-700 p-1">Erros</th>
            <th className="border border-gray-700 p-1">% AxE</th>
            <th className="border border-gray-700 p-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr key={score.hazard} data-hazard={score.hazard.toLowerCase()}>
              <td className="border border-gray-700 p-1">{score.hazard}</td>
              <td className="border border-gray-700 p-1 text-center">{score.hits}</td>
              <td className="border border-gray-700 p-1 text-center">{score.misses}</td>
              <td className="border border-gray-700 p-1 text-center">{score.percentage} %</td>
              <td className="border border-gray-700 p-1 text-center">{score.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatsPanel = () => (
  <div
    id="statsPanel"
    style={{
      position: 'fixed',
      bottom: '180px',
      right: '20px',
      background: 'rgba(30, 30, 30, 0.85)',
      color: 'white',
      padding: '10px 14px',
      fontSize: '13px',
      borderRadius: '6px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      fontFamily: 'sans-serif',
      zIndex: 999,
    }}
  >
    <div id="statsContent">Carregando estatísticas...</div>
  </div>
);

const ReportsLegend = () => (
  <div
    className="bg-gray-800/80 text-white"
    style={{
      position: 'fixed',
      bottom: '95px',
      left: '20px',
      padding: '10px 14px',
      fontSize: '13px',
      borderRadius: '6px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      fontFamily: 'sans-serif',
      zIndex: 999,
    }}
  >
    <b>Relatos</b>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_38c6ec164e3742dab2237816e4ff8c95~mv2.png"
        width="16"
        alt="Vento leve"
      />{' '}
      Vento 80–100km/h
    </div>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_3fc6c303cb364c5db3595e4203c1888e~mv2.png"
        width="16"
        alt="Vento forte"
      />{' '}
      Vento &gt;100km/h
    </div>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_70be04c630a64abca49711a423da779b~mv2.png"
        width="16"
        alt="Granizo pequeno"
      />{' '}
      Granizo &lt; 4cm
    </div>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_946684b74c234c2287a153a6b6c077fe~mv2.png"
        width="16"
        alt="Granizo grande"
      />{' '}
      Granizo &gt; 4cm
    </div>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_9f22188e065e4424a1f8ee3a3afeffde~mv2.png"
        width="16"
        alt="Tornado fraco"
      />{' '}
      Tornado &lt; EF2
    </div>
    <div>
      <img
        src="https://static.wixstatic.com/media/c003a9_3a647b1160024b55bb3ecc148df1309f~mv2.png"
        width="16"
        alt="Tornado forte"
      />{' '}
      Tornado ≥ EF2
    </div>
  </div>
);

const RiskLegend = ({ selectedHazard }: { selectedHazard: Exclude<HazardType, 'prevots'> }) => {
  const hazardProbs = probabilityOptions[selectedHazard] ?? [];

  const legendItems = hazardProbs
    .map((prob) => {
      const lvl = levelOf(prob, selectedHazard);
      const color = catColor[lvl] ?? '#999';
      return `
        <div style="display:flex;align-items:center;margin-bottom:4px;">
          <span style="display:inline-block;width:14px;height:14px;background-color:${color};margin-right:6px;border-radius:2px;border:1px solid rgba(255,255,255,0.2);"></span>
          <span>${prob}% (Nível ${lvl})</span>
        </div>
      `;
    })
    .join('');

  return (
    <div
      className="bg-gray-800/80 text-white"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 14px',
        fontSize: '13px',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        fontFamily: 'sans-serif',
        zIndex: 999,
      }}
    >
      <b style={{ display: 'block', marginBottom: '6px' }}>
        Legenda por Risco ({hazardOptions.find((h) => h.value === selectedHazard)?.label})
      </b>
      <div id="legendItems" dangerouslySetInnerHTML={{ __html: legendItems }} />
    </div>
  );
};

const PrevotsLegend = () => (
  <div
    id="legendPrevots"
    style={{
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
      zIndex: 999,
    }}
  >
    <b>Níveis PREVOTS</b>
    <div>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          background: '#00FF00',
          marginRight: '6px',
        }}
      />{' '}
      PREV 1
    </div>
    <div>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          background: '#FFFF00',
          marginRight: '6px',
        }}
      />{' '}
      PREV 2
    </div>
    <div>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          backgroundColor: 'rgb(255, 165, 0)',
          marginRight: '6px',
        }}
      />{' '}
      PREV 3
    </div>
    <div>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          backgroundColor: 'rgb(255, 0, 0)',
          marginRight: '6px',
        }}
      />{' '}
      PREV 4
    </div>
    <div>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          background: '#800080',
          marginRight: '6px',
        }}
      />{' '}
      PREV 5
    </div>
  </div>
);

interface DrawUIProps {
  onStartDrawing: (mode: DrawingMode, hazard: HazardType, probability: number, level: number) => void;
  onCancel: () => void;
  activeHazard: Exclude<HazardType, 'prevots'>;
  isDrawingActive: boolean;
}

const DrawUI = React.memo(
  ({ onStartDrawing, onCancel, activeHazard, isDrawingActive }: DrawUIProps) => {
    const [selectedProb, setSelectedProb] = useState<number>(probabilityOptions[activeHazard][0]);

    useEffect(() => {
      setSelectedProb(probabilityOptions[activeHazard][0]);
    }, [activeHazard]);

    const handleStart = useCallback(() => {
      onStartDrawing('risk', activeHazard, selectedProb, 0);
    }, [onStartDrawing, activeHazard, selectedProb]);

    return (
      <div className="space-y-4 rounded-md bg-gray-800 p-3 text-white shadow-md">
        <h3 className="font-bold">
          Desenhar Risco de {hazardOptions.find((h) => h.value === activeHazard)?.label}
        </h3>
        <div>
          <Label>Probabilidade (%)</Label>
          <Select value={String(selectedProb)} onValueChange={(value) => setSelectedProb(Number(value))}>
            <SelectTrigger className="bg-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {probabilityOptions[activeHazard].map((prob) => (
                <SelectItem key={prob} value={String(prob)}>
                  {prob}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleStart} className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
          <Pencil className="mr-2 h-4 w-4" /> Iniciar Desenho
        </Button>
        {isDrawingActive && (
          <Button
            onClick={onCancel}
            variant="destructive"
            size="sm"
            className="mt-2 w-full justify-center"
          >
            <X className="mr-2 h-4 w-4" /> Parar Desenho
          </Button>
        )}
      </div>
    );
  }
);

DrawUI.displayName = 'DrawUI';

const MeteoTilesControls = ({
  map,
  ImageryLayer,
}: {
  map: __esri.Map | null;
  ImageryLayer: typeof __esri.ImageryLayer | undefined;
}) => {
  const [capeVisible, setCapeVisible] = useState(false);
  const [srhVisible, setSrhVisible] = useState(false);
  const [capeOpacity, setCapeOpacity] = useState(70);
  const [srhOpacity, setSrhOpacity] = useState(70);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const storage = useMemo(() => getStorage(), []);

  const brazilBounds = useMemo(
    () => ({
      xmin: -75.0,
      ymin: -35.0,
      xmax: -30.0,
      ymax: 5.0,
      spatialReference: { wkid: 4326 },
    }),
    []
  );

  const toggleOverlay = useCallback(
    async (tileType: 'cape' | 'srh', isVisible: boolean, opacity: number) => {
      if (!map || !ImageryLayer) return;

      const layerId = `meteo-tile-${tileType}`;
      const existingLayer = map.findLayerById(layerId) as __esri.ImageryLayer | undefined;

      if (!isVisible) {
        if (existingLayer) map.remove(existingLayer);
        return;
      }

      if (existingLayer) {
        existingLayer.opacity = opacity / 100;
        existingLayer.visible = true;
        return;
      }

      setIsLoading((prev) => ({ ...prev, [tileType]: true }));
      setError(null);

      try {
        const storageRef = ref(storage, `meteo_tiles/${tileType}_tile.png`);
        const url = await getDownloadURL(storageRef);

        const newLayer = new ImageryLayer({
          id: layerId,
          url,
          extent: brazilBounds,
          opacity: opacity / 100,
        });

        map.add(newLayer);
      } catch (err) {
        console.error(`Erro ao carregar tile ${tileType}:`, err);
        setError(`Falha ao carregar ${tileType}.`);
      } finally {
        setIsLoading((prev) => ({ ...prev, [tileType]: false }));
      }
    },
    [map, ImageryLayer, storage, brazilBounds]
  );

  useEffect(() => {
    toggleOverlay('cape', capeVisible, capeOpacity);
  }, [capeVisible, capeOpacity, toggleOverlay]);

  useEffect(() => {
    toggleOverlay('srh', srhVisible, srhOpacity);
  }, [srhVisible, srhOpacity, toggleOverlay]);

  return (
    <div className="absolute right-5 top-24 z-40 w-72 rounded-lg bg-gray-800/80 p-4 text-white shadow-lg backdrop-blur-sm">
      <h3 className="mb-3 border-b border-gray-600 pb-2 text-lg font-bold">🌦️ Modelos Meteorológicos</h3>
      {(isLoading.cape || isLoading.srh) && (
        <div className="mb-2 text-xs text-blue-400">🔄 Carregando...</div>
      )}
      {error && <div className="mb-2 text-xs text-red-400">❌ {error}</div>}

      <div className="space-y-4">
        <div>
          <Label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={capeVisible}
              onChange={(event) => setCapeVisible(event.target.checked)}
              className="form-checkbox h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            <strong>CAPE</strong>
          </Label>
          <p className="ml-6 text-xs text-gray-400">Energia Potencial Convectiva</p>
          <input
            type="range"
            min="0"
            max="100"
            value={capeOpacity}
            onChange={(event) => setCapeOpacity(Number(event.target.value))}
            className="mt-2 h-1 w-full accent-blue-500"
          />
        </div>

        <div>
          <Label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={srhVisible}
              onChange={(event) => setSrhVisible(event.target.checked)}
              className="form-checkbox h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            <strong>SRH 0-3km</strong>
          </Label>
          <p className="ml-6 text-xs text-gray-400">Helicidade Relativa à Tempestade</p>
          <input
            type="range"
            min="0"
            max="100"
            value={srhOpacity}
            onChange={(event) => setSrhOpacity(Number(event.target.value))}
            className="mt-2 h-1 w-full accent-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-gray-600 pt-2 text-xs text-gray-500">
        <p>
          <strong>Modelo:</strong> WRF 9.0 km
        </p>
        <p>
          <strong>Válido:</strong> 2024-10-01 12:00 UTC
        </p>
      </div>
    </div>
  );
};

interface PopoverState {
  isOpen: boolean;
  graphic: __esri.Graphic | null;
  anchor: { top: number; left: number } | null;
}

const EsriMapInternal = ({ onLogout }: { onLogout: () => void }) => {
  const { userAppRole } = useAuth();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<__esri.MapView | null>(null);
  const graphicsLayersRef = useRef<Record<string, __esri.GraphicsLayer>>({});
  const esriModulesRef = useRef<any>({});
  const drawControlsContainerRef = useRef<HTMLDivElement | null>(null);
  const drawUiRootRef = useRef<Root | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [brazilBoundary, setBrazilBoundary] = useState<any>(null);

  const [weatherModels, setWeatherModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('radar.nowcast');
  const [modelGroupLayer, setModelGroupLayer] = useState<__esri.GroupLayer | null>(null);

  const [isReportMode, setIsReportMode] = useState(false);
  const [newReport, setNewReport] = useState<{
    hazard: Exclude<HazardType, 'prevots'>;
    sev: 'NOR' | 'SS';
    date: string;
    location: __esri.Point | null;
  }>({
    hazard: 'wind',
    sev: 'NOR',
    date: new Date().toISOString().slice(0, 10),
    location: null,
  });

  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [countdown, setCountdown] = useState('');
  const [forecastDate, setForecastDate] = useState(getInitialForecastDate);
  const [selectedHazardForDisplay, setSelectedHazardForDisplay] =
    useState<Exclude<HazardType, 'prevots'>>('hail');

  const sketchViewModelRef = useRef<__esri.widgets.Sketch.SketchViewModel | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawUIOpen, setIsDrawUIOpen] = useState(false);

  const [popoverState, setPopoverState] = useState<PopoverState>({
    isOpen: false,
    graphic: null,
    anchor: null,
  });

  function getInitialForecastDate() {
    const now = new Date();
    const deadline = new Date();
    deadline.setHours(12, 0, 0, 0);

    if (now >= deadline) {
      now.setDate(now.getDate() + 1);
    }

    return now.toISOString().slice(0, 10);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const deadline = new Date();
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
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
          seconds
        ).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/gh/LucasMouraChaser/brasilunificado@main/brasilunificado.geojson')
      .then((res) => res.json())
      .then((data) => {
        const firstValid = data.features.find(
          (feature: any) =>
            feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'
        );

        if (firstValid) {
          setBrazilBoundary(firstValid);
        } else {
          console.error('❌ Nenhum polígono válido no GeoJSON do Brasil.');
        }
      })
      .catch((error) => console.error('❌ Erro ao carregar contorno do Brasil:', error));
  }, []);

  useEffect(() => {
    if (!modelGroupLayer) return;
    modelGroupLayer.layers.forEach((layer: any) => {
      layer.visible = layer.id === selectedModel;
    });
  }, [selectedModel, modelGroupLayer]);

  const handleSaveHazardForecast = useCallback(
    async (hazard: Exclude<HazardType, 'prevots'>) => {
      const polygonsToSave = getPolygonsByHazard(hazard);

      if (polygonsToSave.length === 0) {
        alert(`Nenhum polígono de ${hazard} para salvar.`);
        return;
      }

      setIsSubmitting((prev) => ({ ...prev, [hazard]: true }));

      try {
        const forecastId = `forecast_${forecastDate}_${hazard}`;
        const forecastDocRef = doc(db, 'weather_forecasts', forecastId);

        const featuresToSave = polygonsToSave.map((graphic) => ({
          geometry: JSON.stringify(graphic.geometry.toJSON()),
          attributes: graphic.attributes,
        }));

        await setDoc(
          forecastDocRef,
          {
            date: forecastDate,
            hazard,
            createdAt: serverTimestamp(),
            features: featuresToSave,
          },
          { merge: true }
        );

        alert(`Previsão para ${hazard} salva com sucesso!`);
      } catch (error) {
        console.error(`Erro ao salvar previsão de ${hazard}:`, error);
        alert(`Falha ao salvar a previsão de ${hazard}.`);
      } finally {
        setIsSubmitting((prev) => ({ ...prev, [hazard]: false }));
      }
    },
    [forecastDate]
  );

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
          const features = data.features ?? [];

          features.forEach((feature: any) => {
            const geometry = new Polygon(JSON.parse(feature.geometry));
            const attributes = feature.attributes;
            const { type, hazard: featureHazard, prob, level } = attributes;

            let colorHex = '#999';
            if (type === 'risk') {
              const riskLevel = levelOf(prob, featureHazard);
              colorHex = catColor[riskLevel] ?? '#999';
            } else if (type === 'prevots') {
              colorHex = catColor[level] ?? '#999';
            }

            const symbol = new SimpleFillSymbol({
              color: [...new Color(colorHex).toRgb(), 0.25],
              outline: { color: new Color(colorHex), width: 2 },
            });

            const graphic = new Graphic({ geometry, symbol, attributes });
            const targetLayer = graphicsLayersRef.current[featureHazard ?? type];
            targetLayer?.add(graphic);
          });
        }
      }

      alert('Previsões carregadas do Firestore!');
    } catch (error) {
      console.error('Erro ao carregar previsões:', error);
      alert('Falha ao carregar previsões do banco de dados.');
    } finally {
      setIsLoading(false);
    }
  }, [forecastDate]);

  const handleHazardChangeForDisplay = useCallback(
    (hazard: Exclude<HazardType, 'prevots'>) => {
      setSelectedHazardForDisplay(hazard);
      if (viewRef.current) {
        togglePolygonVisibility(viewRef.current, hazard);
      }
    },
    []
  );

  const handleStartDrawing = useCallback(
    (mode: DrawingMode, hazard: HazardType, probability: number, level: number) => {
      const sketchVM = sketchViewModelRef.current;

      if (!sketchVM || !esriModulesRef.current.SimpleFillSymbol) return;

      setIsDrawUIOpen(false);
      setIsDrawing(true);

      const { Color, SimpleFillSymbol } = esriModulesRef.current;

      let symbolOptions: any = {};
      let attributes: Record<string, unknown> = {};
      let targetLayerId: string | undefined;

      if (mode === 'risk') {
        const riskHazard = hazard as Exclude<HazardType, 'prevots'>;
        const riskLevel = levelOf(probability, riskHazard);
        const colorHex = catColor[riskLevel] ?? '#999999';

        symbolOptions = {
          color: [...new Color(colorHex).toRgb(), 0.25],
          outline: { color: new Color(colorHex), width: 2 },
        };

        targetLayerId = riskHazard;
        attributes = {
          type: 'risk',
          hazard: riskHazard,
          prob: probability,
          level: riskLevel,
          date: forecastDate,
        };
      } else if (mode === 'prevots') {
        const colorHex = catColor[level] ?? '#999999';

        symbolOptions = {
          color: [...new Color(colorHex).toRgb(), 0.25],
          outline: { color: new Color(colorHex), width: 2 },
        };

        targetLayerId = 'prevots';
        attributes = { type: 'prevots', level, date: forecastDate };
      }

      if (targetLayerId) {
        const targetLayer = graphicsLayersRef.current[targetLayerId];
        if (!targetLayer) {
          console.error(`Layer ${targetLayerId} não encontrada para o desenho.`);
          setIsDrawing(false);
          return;
        }
        sketchVM.layer = targetLayer;
      }

      const newSymbol = new SimpleFillSymbol(symbolOptions);
      sketchVM.polygonSymbol = newSymbol;
      (sketchVM as any)._creationAttributes = attributes;

      sketchVM.create('polygon');
    },
    [forecastDate]
  );

  const handleCancelDrawing = useCallback(() => {
    sketchViewModelRef.current?.cancel();
    setIsDrawing(false);
    setIsDrawUIOpen(false);
  }, []);

  useEffect(() => {
    if (!isReportMode) {
      sketchViewModelRef.current?.cancel();
    }
  }, [isReportMode]);

  const initMap = useCallback(async () => {
    if (!mapDivRef.current || !brazilBoundary || viewRef.current) return;

    try {
      loadCss();

      const [
        Map,
        MapView,
        Basemap,
        TileLayer,
        GroupLayer,
        BasemapGallery,
        Expand,
        LayerList,
        Sketch,
        GraphicsLayer,
        WebTileLayer,
        webMercatorUtils,
        Polygon,
        Color,
        Graphic,
        SimpleFillSymbol,
        SimpleLineSymbol,
        PictureMarkerSymbol,
        Point,
        SketchViewModel,
        ImageryLayer,
      ] = await loadScript();

      esriModulesRef.current = {
        Map,
        MapView,
        Basemap,
        TileLayer,
        GroupLayer,
        BasemapGallery,
        Expand,
        LayerList,
        Sketch,
        GraphicsLayer,
        WebTileLayer,
        webMercatorUtils,
        Polygon,
        Color,
        Graphic,
        SimpleFillSymbol,
        SimpleLineSymbol,
        PictureMarkerSymbol,
        Point,
        SketchViewModel,
        ImageryLayer,
      };

      initializePolygonManager(turf);

      let models: any[] = [];
      try {
        const response = await fetch('/api/rainviewer');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        models = Object.keys(data.radar).map((key) => ({
          id: `radar.${key}`,
          path: data.radar[key][0].path,
          name: `Radar ${key}`,
        }));
        setWeatherModels(models);
      } catch (error) {
        console.error('Failed to fetch weather models, proceeding without them', error);
      }

      const modelLayers = models.map(
        (model) =>
          new WebTileLayer({
            id: model.id,
            urlTemplate: `https://tilecache.rainviewer.com${model.path}/256/{level}/{col}/{row}/5/1_1.png`,
            title: model.name,
            visible: model.id === selectedModel,
            opacity: 0.7,
          })
      );

      const newModelGroupLayer = new GroupLayer({
        title: 'Modelos Meteorológicos',
        visible: true,
        layers: modelLayers,
      });

      setModelGroupLayer(newModelGroupLayer);

      hazardOptions.forEach((hazard) => {
        graphicsLayersRef.current[hazard.value] = new GraphicsLayer({
          id: hazard.value,
          title: hazard.label,
          visible: hazard.value === selectedHazardForDisplay,
        });
      });

      graphicsLayersRef.current.prevots = new GraphicsLayer({
        id: 'prevots',
        title: 'Previsao PREVOTS',
        visible: true,
      });

      graphicsLayersRef.current.reports = new GraphicsLayer({
        id: 'reports',
        title: 'Relatos',
        visible: true,
      });

      graphicsLayersRef.current.municipios = new GraphicsLayer({
        id: 'municipios',
        title: 'Municípios',
        visible: false,
      });

      fetch(
        'https://cdn.jsdelivr.net/gh/LucasMouraChaser/simplaoosmunicipio@bb3e7071319f8e42ffd24513873ffb73cce566e6/brazil-mun.simplificado.geojson'
      )
        .then((res) => res.json())
        .then((data) => {
          const municipioGraphics = data.features.map(
            (feature: any) =>
              new Graphic(
                new Polygon({
                  rings: feature.geometry.coordinates,
                  spatialReference: { wkid: 4326 },
                }),
                new SimpleFillSymbol(
                  SimpleFillSymbol.STYLE_NULL,
                  new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 0, 0.3]), 1),
                  null
                )
              )
          );
          graphicsLayersRef.current.municipios.addMany(municipioGraphics);
          console.log('✅ Municípios carregados na camada de gráficos.');
        })
        .catch((error) => console.error('❌ Erro ao carregar GeoJSON de municípios:', error));

      const map = new Map({
        basemap: 'dark-gray-vector',
        layers: [newModelGroupLayer, ...Object.values(graphicsLayersRef.current)],
      });

      const view = new MapView({
        container: mapDivRef.current,
        map,
        center: [-54, -15],
        zoom: 5,
      });

      viewRef.current = view;

      view.when(() => setIsLoading(false));
      view.popup.autoOpenEnabled = false;

      const basemapGallery = new BasemapGallery({ view });

      view.ui.add(
        new Expand({
          view,
          content: basemapGallery,
          expandIconClass: 'esri-icon-basemap',
          group: 'top-left',
        }),
        'top-left'
      );

      const layerList = new LayerList({ view });

      view.ui.add(
        new Expand({
          view,
          content: layerList,
          expandIconClass: 'esri-icon-layers',
          group: 'top-left',
        }),
        'top-left'
      );

      const sketchVM = new SketchViewModel({
        view,
        layer: graphicsLayersRef.current.hail,
      });

      sketchViewModelRef.current = sketchVM;

      sketchVM.on('create', (event: __esri.SketchViewModelCreateEvent) => {
        if (event.state !== 'complete') return;

        setIsDrawing(false);
        const attributes = (sketchViewModelRef.current as any)._creationAttributes ?? {};

        addPolygon({
          graphic: event.graphic,
          attributes,
          brazilBoundary,
          Color,
          SimpleFillSymbol,
          SimpleLineSymbol,
          Polygon,
          webMercatorUtils,
        });
      });

      sketchVM.on('update', (event: __esri.SketchViewModelUpdateEvent) => {
        if (event.state !== 'complete') return;

        event.graphics.forEach((graphic) => {
          const { hazard, level, type } = graphic.attributes;
          const geographicGeom = webMercatorUtils.webMercatorToGeographic(
            graphic.geometry
          ) as __esri.Polygon;

          const turfPolygon = turf.polygon(geographicGeom.rings);
          const clipped = turf.intersect(turfPolygon, brazilBoundary);

          if (!clipped?.geometry) {
            alert('A edição resultou em um polígono fora dos limites do Brasil. Revertendo.');
            sketchVM.cancel();
            return;
          }

          const esriPolygon = new Polygon({
            rings: (clipped.geometry as any).coordinates,
            spatialReference: { wkid: 4326 },
          });

          if (type === 'risk' && !validateArea(esriPolygon, level, hazard)) {
            alert('Falha na validação da área. A edição foi cancelada.');
            sketchVM.cancel();
            return;
          }

          graphic.geometry = webMercatorUtils.geographicToWebMercator(esriPolygon);
          updatePolygon(graphic, graphic.attributes);
          console.log(`✅ Polígono atualizado.`);
        });
      });

      view.on('click', (event) => {
        if (isReportMode) {
          setNewReport((prev) => ({ ...prev, location: event.mapPoint }));
          return;
        }

        if (sketchViewModelRef.current?.state === 'active') return;

        view.hitTest(event).then((response) => {
          const results = response.results.filter(
            (result) => result.graphic && result.graphic.layer?.type === 'graphics'
          );

          if (results.length === 0) return;

          const [result] = results;
          const { graphic } = result;

          if (graphic.attributes.date === forecastDate) {
            setPopoverState({
              isOpen: true,
              graphic,
              anchor: { top: event.y, left: event.x },
            });
          } else {
            alert('Não é possível editar ou excluir previsões de datas passadas.');
          }
        });
      });

      const menuContainer = document.createElement('div');
      const menuExpand = new Expand({
        view,
        content: menuContainer,
        expandIconClass: 'esri-icon-menu',
        group: 'top-left',
      });

      const menuRoot = createRoot(menuContainer);
      menuRoot.render(<SideMenu onLogout={onLogout} />);

      const meteoTilesContainer = document.createElement('div');
      const meteoTilesExpand = new Expand({
        view,
        content: meteoTilesContainer,
        expandIconClass: 'esri-icon-media',
        group: 'top-right',
        expanded: true,
      });

      const meteoRoot = createRoot(meteoTilesContainer);
      meteoRoot.render(
        <MeteoTilesControls
          map={map}
          ImageryLayer={esriModulesRef.current.ImageryLayer}
        />
      );

      drawControlsContainerRef.current = document.createElement('div');
      drawControlsContainerRef.current.id = 'draw-controls-container-internal';

      if (userAppRole === 'superadmin' || userAppRole === 'admin') {
        drawUiRootRef.current = createRoot(drawControlsContainerRef.current);

        view.ui.add(
          new Expand({
            view,
            content: drawControlsContainerRef.current,
            expandIconClass: 'esri-icon-edit',
            group: 'top-left',
          }),
          'top-left'
        );
      }

      view.ui.add(menuExpand, 'top-left');
      view.ui.add(meteoTilesExpand, 'top-right');
    } catch (error) {
      console.error('Erro ao carregar o mapa da Esri:', error);
      setIsLoading(false);
    }
  }, [brazilBoundary, onLogout, selectedModel, selectedHazardForDisplay, userAppRole, isReportMode, forecastDate]);

  useEffect(() => {
    initMap();

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;

      if (drawUiRootRef.current) {
        drawUiRootRef.current.unmount();
        drawUiRootRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    if (!drawUiRootRef.current || !drawControlsContainerRef.current) return;
    if (!(userAppRole === 'superadmin' || userAppRole === 'admin')) return;

    drawUiRootRef.current.render(
      <DrawUI
        onStartDrawing={handleStartDrawing}
        onCancel={handleCancelDrawing}
        activeHazard={selectedHazardForDisplay}
        isDrawingActive={isDrawing}
      />
    );
  }, [handleCancelDrawing, handleStartDrawing, isDrawing, selectedHazardForDisplay, userAppRole]);

  const handleSaveReport = useCallback(async () => {
    if (!newReport.location) {
      alert('Por favor, clique no mapa para definir a localização do relato.');
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
      await addDoc(collection(db, 'weather_reports'), reportData);
      alert('Relato salvo com sucesso!');

      setIsReportMode(false);
      setNewReport({
        hazard: 'wind',
        sev: 'NOR',
        date: new Date().toISOString().slice(0, 10),
        location: null,
      });
    } catch (error) {
      console.error('Erro ao salvar relato:', error);
      alert('Falha ao salvar o relato.');
    }
  }, [newReport]);

  const startEdit = useCallback(() => {
    const sketchVM = sketchViewModelRef.current;
    const { graphic } = popoverState;

    if (!graphic || !sketchVM) return;

    const targetLayerId =
      graphic.attributes.type === 'prevots' ? 'prevots' : graphic.attributes.hazard;
    const targetLayer = graphicsLayersRef.current[targetLayerId];

    if (targetLayer) {
      sketchVM.layer = targetLayer;
      sketchVM.update(graphic, { tool: 'transform' });
    } else {
      console.error(`Camada de destino '${targetLayerId}' não encontrada para edição.`);
    }

    setPopoverState({ isOpen: false, graphic: null, anchor: null });
  }, [popoverState]);

  const confirmDelete = useCallback(() => {
    if (!popoverState.graphic) return;

    const { graphic } = popoverState;
    const layerId = graphic.layer.id;

    deletePolygon(graphic, graphicsLayersRef.current[layerId]);

    setPopoverState({ isOpen: false, graphic: null, anchor: null });
  }, [popoverState]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isLoading && <LoadingSpinner />}
      <Scoreboard />
      <StatsPanel />
      <ReportsLegend />
      <RiskLegend selectedHazard={selectedHazardForDisplay} />
      <PrevotsLegend />

      <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-md bg-gray-800/80 p-2 text-white shadow-lg backdrop-blur-sm">
        <Input
          type="date"
          value={forecastDate}
          onChange={(event) => setForecastDate(event.target.value)}
          className="h-9 w-auto border-gray-600 bg-gray-700 text-white"
        />
        <Button onClick={handleLoadForecast} size="sm">
          <SearchIcon className="mr-2 h-4 w-4" />
          Ver Previsão Feita
        </Button>
        {(userAppRole === 'superadmin' || userAppRole === 'admin') && (
          <Button
            onClick={() => setIsReportMode((prev) => !prev)}
            variant={isReportMode ? 'destructive' : 'default'}
            size="sm"
          >
            {isReportMode ? <X className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            {isReportMode ? 'Cancelar Relato' : 'Adicionar Relato'}
          </Button>
        )}
      </div>

      <div className="absolute left-[20px] top-[88px] z-40 flex flex-col items-stretch gap-2 rounded-md bg-gray-800/80 p-2 text-white shadow-lg backdrop-blur-sm">
        {hazardOptions.map((hazard) => (
          <div key={hazard.value} className="flex items-center gap-1">
            <Button
              variant={selectedHazardForDisplay === hazard.value ? 'secondary' : 'ghost'}
              onClick={() => handleHazardChangeForDisplay(hazard.value)}
              className="flex-grow justify-start px-3 py-2 text-white hover:bg-gray-700"
            >
              <hazard.icon className="mr-2 h-4 w-4" /> {hazard.label}
            </Button>
            {(userAppRole === 'superadmin' || userAppRole === 'admin') && (
              <Button
                size="sm"
                onClick={() => handleSaveHazardForecast(hazard.value)}
                disabled={isSubmitting[hazard.value]}
                className="h-full bg-green-600 p-2 hover:bg-green-700"
              >
                {isSubmitting[hazard.value] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Salvar {hazard.label}</span>
              </Button>
            )}
          </div>
        ))}
        {(userAppRole === 'superadmin' || userAppRole === 'admin') && (
          <Button
            onClick={() => setIsDrawUIOpen((prev) => !prev)}
            variant="outline"
            className="mt-2 border-blue-500 text-white hover:bg-blue-600"
          >
            <Pencil className="mr-2 h-4 w-4" /> Desenhar Risco
          </Button>
        )}
      </div>

      {isReportMode && (
        <div className="absolute left-[250px] top-[88px] z-50 w-72 space-y-4 rounded-lg bg-gray-800/90 p-4 text-white shadow-lg backdrop-blur-md">
          <h3 className="border-b border-gray-600 pb-2 text-lg font-bold">Novo Relato de Tempo Severo</h3>
          <div>
            <Label className="text-gray-300">Tipo de Evento</Label>
            <Select
              value={newReport.hazard}
              onValueChange={(value: Exclude<HazardType, 'prevots'>) =>
                setNewReport((prev) => ({ ...prev, hazard: value }))
              }
            >
              <SelectTrigger className="bg-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hazardOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <opt.icon className="mr-2 inline-block h-4 w-4" />
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-300">Severidade</Label>
            <Select
              value={newReport.sev}
              onValueChange={(value: 'NOR' | 'SS') =>
                setNewReport((prev) => ({ ...prev, sev: value }))
              }
            >
              <SelectTrigger className="bg-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOR">Normal</SelectItem>
                <SelectItem value="SS">Significativo (SS)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center rounded-md bg-yellow-900/50 p-2 text-sm text-yellow-300">
            <MapPin className="mr-2 h-5 w-5 flex-shrink-0" />
            {newReport.location
              ? `Localização: ${newReport.location.latitude.toFixed(4)}, ${newReport.location.longitude.toFixed(4)}`
              : 'Clique no mapa para definir a localização.'}
          </div>

          <Button
            onClick={handleSaveReport}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!newReport.location}
          >
            Salvar Relato
          </Button>
        </div>
      )}

      <div className="absolute left-[20px] bottom-[20px] z-[1000] flex items-center gap-2 rounded-md bg-gray-800/80 p-2 text-white shadow-lg backdrop-blur-sm">
        <Clock className="h-5 w-5 text-yellow-400" />
        <span className="font-mono text-sm text-yellow-400" title="Tempo restante para a previsão do dia atual">
          {countdown}
        </span>
      </div>

      <div
        className="absolute"
        style={{
          left: `${popoverState.anchor?.left ?? -1000}px`,
          top: `${popoverState.anchor?.top ?? -1000}px`,
        }}
      >
        <Popover
          open={popoverState.isOpen}
          onOpenChange={(isOpen) => setPopoverState((prev) => ({ ...prev, isOpen }))}
        >
          <PopoverTrigger asChild>
            <div />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" side="right" align="start">
            <div className="flex flex-col gap-2 rounded-md bg-gray-800 p-2 text-white shadow-lg">
              <Button variant="ghost" className="justify-start" onClick={startEdit}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-red-400 hover:bg-red-900/50 hover:text-red-400"
                onClick={confirmDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export function EsriMap() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace('/meteorologia/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  return <EsriMapInternal onLogout={handleLogout} />;
}
