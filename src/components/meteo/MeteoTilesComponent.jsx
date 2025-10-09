import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASyZjkbeiSqh9fEaYDwuS9diyIDUhEQeQ",
  authDomain: "energisa-invoice-editor.firebaseapp.com",
  projectId: "energisa-invoice-editor",
  storageBucket: "energisa-invoice-editor.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Hook para gerenciar tiles meteorológicos
export const useMeteoTiles = (mapRef) => {
  const [overlays, setOverlays] = useState({});
  const [tileUrls, setTileUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bounds do Brasil
  const brazilBounds = [
    [-35.0, -75.0], // Sudoeste
    [5.0, -30.0]    // Nordeste
  ];

  // Carregar tile do Firebase Storage
  const loadTileFromFirebase = async (tileName) => {
    try {
      const storageRef = ref(storage, `meteo_tiles/${tileName}`);
      const url = await getDownloadURL(storageRef);
      console.log(`✅ Tile carregado: ${tileName}`);
      return url;
    } catch (error) {
      console.error(`❌ Erro ao carregar tile ${tileName}:`, error);
      setError(`Erro ao carregar ${tileName}: ${error.message}`);
      return null;
    }
  };

  // Adicionar overlay ao mapa
  const addOverlay = async (tileType, opacity = 0.7) => {
    if (!mapRef.current) return;

    try {
      setLoading(true);
      
      // Carregar tile se ainda não carregado
      if (!tileUrls[tileType]) {
        const url = await loadTileFromFirebase(`${tileType}_tile.png`);
        if (!url) return;
        
        setTileUrls(prev => ({ ...prev, [tileType]: url }));
      }

      // Criar overlay
      const overlay = L.imageOverlay(tileUrls[tileType] || await loadTileFromFirebase(`${tileType}_tile.png`), brazilBounds, {
        opacity: opacity,
        interactive: false
      });

      // Adicionar ao mapa
      overlay.addTo(mapRef.current);
      
      // Salvar referência
      setOverlays(prev => ({ ...prev, [tileType]: overlay }));
      
    } catch (error) {
      console.error(`Erro ao adicionar overlay ${tileType}:`, error);
      setError(`Erro ao adicionar ${tileType}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Remover overlay do mapa
  const removeOverlay = (tileType) => {
    if (!mapRef.current || !overlays[tileType]) return;

    mapRef.current.removeLayer(overlays[tileType]);
    setOverlays(prev => {
      const newOverlays = { ...prev };
      delete newOverlays[tileType];
      return newOverlays;
    });
  };

  // Atualizar opacidade do overlay
  const updateOverlayOpacity = (tileType, opacity) => {
    if (overlays[tileType]) {
      overlays[tileType].setOpacity(opacity);
    }
  };

  // Toggle overlay
  const toggleOverlay = (tileType, isVisible, opacity = 0.7) => {
    if (isVisible) {
      addOverlay(tileType, opacity);
    } else {
      removeOverlay(tileType);
    }
  };

  return {
    overlays,
    tileUrls,
    loading,
    error,
    addOverlay,
    removeOverlay,
    updateOverlayOpacity,
    toggleOverlay,
    brazilBounds
  };
};

// Componente de controles
export const MeteoTilesControls = ({ mapRef, className = "" }) => {
  const [capeVisible, setCapeVisible] = useState(false);
  const [srhVisible, setSrhVisible] = useState(false);
  const [capeOpacity, setCapeOpacity] = useState(70);
  const [srhOpacity, setSrhOpacity] = useState(70);

  const { toggleOverlay, updateOverlayOpacity, loading, error } = useMeteoTiles(mapRef);

  const handleCapeToggle = (visible) => {
    setCapeVisible(visible);
    toggleOverlay('cape', visible, capeOpacity / 100);
  };

  const handleSrhToggle = (visible) => {
    setSrhVisible(visible);
    toggleOverlay('srh', visible, srhOpacity / 100);
  };

  const handleCapeOpacityChange = (opacity) => {
    setCapeOpacity(opacity);
    updateOverlayOpacity('cape', opacity / 100);
  };

  const handleSrhOpacityChange = (opacity) => {
    setSrhOpacity(opacity);
    updateOverlayOpacity('srh', opacity / 100);
  };

  return (
    <div className={`meteo-tiles-controls ${className}`} style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'white',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      minWidth: '300px',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '18px' }}>
        🌦️ Modelos Meteorológicos
      </h3>
      
      {loading && (
        <div style={{ color: '#007bff', marginBottom: '10px', fontSize: '12px' }}>
          🔄 Carregando tiles...
        </div>
      )}
      
      {error && (
        <div style={{ color: '#dc3545', marginBottom: '10px', fontSize: '12px' }}>
          ❌ {error}
        </div>
      )}

      {/* Controle CAPE */}
      <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
          <input
            type="checkbox"
            checked={capeVisible}
            onChange={(e) => handleCapeToggle(e.target.checked)}
            style={{ marginRight: '10px', transform: 'scale(1.2)' }}
          />
          <strong>CAPE</strong> - Convective Available Potential Energy
        </label>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Unidade: J/kg | Opacidade: <span>{capeOpacity}</span>%
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={capeOpacity}
          onChange={(e) => handleCapeOpacityChange(parseInt(e.target.value))}
          style={{ width: '100%', marginTop: '5px' }}
        />
      </div>

      {/* Controle SRH */}
      <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
          <input
            type="checkbox"
            checked={srhVisible}
            onChange={(e) => handleSrhToggle(e.target.checked)}
            style={{ marginRight: '10px', transform: 'scale(1.2)' }}
          />
          <strong>SRH 0-3km</strong> - Storm Relative Helicity
        </label>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Unidade: m²/s² | Opacidade: <span>{srhOpacity}</span>%
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={srhOpacity}
          onChange={(e) => handleSrhOpacityChange(parseInt(e.target.value))}
          style={{ width: '100%', marginTop: '5px' }}
        />
      </div>

      {/* Informações do modelo */}
      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
        <div><strong>Modelo:</strong> WRF 9.0 km</div>
        <div><strong>Válido:</strong> 2024-10-01 12:00 UTC</div>
        <div><strong>Resolução:</strong> 9.0 km</div>
      </div>
    </div>
  );
};

export default MeteoTilesControls;
