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
    typeof __esri.MapImageLayer,
    typeof __esri.GroupLayer,
    typeof __esri.BasemapGallery,
    typeof __esri.Expand,
    typeof __esri.LayerList,
    typeof __esri.Sketch,
    typeof __esri.GraphicsLayer,
    typeof __esri.WebTileLayer,
    typeof __esri.Draw,
    typeof __esri.SimpleFillSymbol,
    typeof __esri.SimpleLineSymbol,
    typeof __esri.Color,
    typeof __esri.Graphic,
    typeof __esri.geometry.webMercatorUtils,
];

// Helper to require modules
function requireModules(resolve: (modules: EsriModules) => void) {
    // @ts-ignore
    window.require([
        "esri/Map",
        "esri/views/MapView",
        "esri/Basemap",
        "esri/layers/TileLayer",
        "esri/layers/MapImageLayer",
        "esri/layers/GroupLayer",
        "esri/widgets/BasemapGallery",
        "esri/widgets/Expand",
        "esri/widgets/LayerList",
        "esri/widgets/Sketch",
        "esri/layers/GraphicsLayer",
        "esri/layers/WebTileLayer",
        "esri/toolbars/Draw",
        "esri/symbols/SimpleFillSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/Color",
        "esri/graphic",
        "esri/geometry/webMercatorUtils",
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
            reject(error);
        };
    });
}
