"use client";

import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, Float, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { statesData } from '@/data/state-data';

// --- CONFIGURAÇÕES VISUAIS ---
const MAP_COLOR_BASE = "#1e293b";      // Slate 800 (Escuro)
const MAP_COLOR_ACTIVE = "#06b6d4";    // Cyan 500 (Selecionado)
const MAP_COLOR_HOVER = "#22d3ee";     // Cyan 400 (Hover)
const MAP_COLOR_INACTIVE = "#0f172a";  // Slate 950 (Desativado)
const EXTRUDE_DEPTH = 10;              // Espessura do estado

interface BrazilMap3DProps {
  selectedStateCode: string | null;
  onStateClick: (stateCode: string) => void;
  activeStates?: string[];
  activeColor?: string;
}

// Componente Individual de Cada Estado
function StateMesh({ 
    data, 
    isSelected, 
    isActive, 
    activeColor, 
    onClick 
}: { 
    data: typeof statesData[0], 
    isSelected: boolean, 
    isActive: boolean, 
    activeColor: string, 
    onClick: (code: string) => void 
}) {
    const mesh = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // 1. Converter SVG Path (string d) para Formas 3D (Shapes)
    const shapes = useMemo(() => {
        const loader = new SVGLoader();
        // O loader cria um caminho a partir da string SVG "d"
        const shapePath = loader.parse(data.pathD).paths[0];
        // Converte o caminho em formas geométricas
        return shapePath.toShapes(true);
    }, [data.pathD]);

    // 2. Definir a Cor com base no estado (Hover, Selecionado, Inativo)
    const color = useMemo(() => {
        if (!isActive) return MAP_COLOR_INACTIVE;
        if (isSelected) return activeColor;
        if (hovered) return activeColor; // Brilha ao passar o mouse
        return MAP_COLOR_BASE;
    }, [isActive, isSelected, hovered, activeColor]);

    // 3. Animação de "Pop-up" ao passar o mouse (Lerp suave)
    useFrame((state, delta) => {
        if (!mesh.current) return;
        
        // Alvo Z: Se selecionado ou hover, sobe 15 unidades. Se não, fica no 0.
        const targetZ = (hovered || isSelected) ? 20 : 0;
        
        // Interpolação suave (Lerp)
        mesh.current.position.z = THREE.MathUtils.lerp(mesh.current.position.z, targetZ, delta * 10);
        
        // Mudança suave de cor
        (mesh.current.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(color), delta * 10);
    });

    return (
        <mesh
            ref={mesh}
            onClick={(e) => { e.stopPropagation(); onClick(data.abbreviation); }}
            onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHover(false); document.body.style.cursor = 'auto'; }}
            rotation={[Math.PI, 0, 0]} // Inverte porque SVG é desenhado de cima para baixo
        >
            <extrudeGeometry args={[shapes, { depth: EXTRUDE_DEPTH, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 }]} />
            <meshStandardMaterial 
                roughness={0.4} 
                metalness={0.6} 
                emissive={isSelected ? activeColor : "#000000"}
                emissiveIntensity={isSelected ? 0.5 : 0}
            />
        </mesh>
    );
}

export function BrazilMap3D({ selectedStateCode, onStateClick, activeStates = [], activeColor = '#06b6d4' }: BrazilMap3DProps) {
  return (
    <div className="w-full h-full cursor-move">
      <Canvas camera={{ position: [0, 0, 700], fov: 45 }}>
        
        {/* Luzes para dar o efeito 3D */}
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 100, 100]} intensity={1} color="#ffffff" />
        <spotLight position={[-100, -100, 200]} angle={0.5} penumbra={1} intensity={2} color={activeColor} />
        
        {/* Ambiente e Reflexos (Opcional, deixa mais bonito) */}
        <Environment preset="city" />

        {/* Grupo Flutuante */}
        <Float 
            speed={2} // Velocidade da flutuação
            rotationIntensity={0.2} // Intensidade da rotação automática
            floatIntensity={0.5} // Intensidade do sobe/desce
        >
            <Center>
                <group>
                    {statesData.map((state) => {
                         const isActive = activeStates.length === 0 || activeStates.includes(state.abbreviation);
                         return (
                            <StateMesh
                                key={state.code}
                                data={state}
                                isSelected={selectedStateCode === state.abbreviation}
                                isActive={isActive}
                                activeColor={activeColor}
                                onClick={onStateClick}
                            />
                         );
                    })}
                </group>
            </Center>
        </Float>

        {/* Controles de Câmera (Zoom e Rotação limitados para não perder o mapa) */}
        <OrbitControls 
            enablePan={false} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 1.5}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
            minDistance={400}
            maxDistance={1000}
        />
        
        {/* Sombra no "chão" */}
        <ContactShadows position={[0, -150, 0]} opacity={0.5} scale={1000} blur={2.5} far={400} />
      </Canvas>
    </div>
  );
}