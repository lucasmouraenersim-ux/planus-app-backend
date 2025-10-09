// Exemplo de como integrar no seu app existente
import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import { MeteoTilesControls } from './MeteoTilesComponent';

// Exemplo de componente de mapa
export const MeteoMapWithTiles = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Inicializar mapa
    const leafletMap = L.map(mapRef.current).setView([-15.0, -55.0], 5);
    
    // Adicionar camada base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
    
    setMap(leafletMap);

    return () => {
      if (leafletMap) {
        leafletMap.remove();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ height: '100vh', width: '100%' }} />
      <MeteoTilesControls mapRef={mapRef} />
    </div>
  );
};

export default MeteoMapWithTiles;
