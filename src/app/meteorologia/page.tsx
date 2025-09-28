
"use client";
import Head from 'next/head';
import Script from 'next/script';
import { useEffect } from 'react';

export default function MeteorologiaPage() {
  useEffect(() => {
    // This is a workaround to execute the script content after the component mounts
    // because Next.js <Script> with inline content is tricky.
    const scriptContent = `
        var loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            setTimeout(function() {
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.transition = 'opacity 1s';
                setTimeout(function() {
                    loadingOverlay.style.display = 'none';
                }, 1000);
            }, 8000);
        }
        // The rest of your script logic would ideally be here,
        // or refactored into modern React components if possible.
        // The ArcGIS API script will load and hopefully initialize itself.
    `;
    const scriptEl = document.createElement('script');
    scriptEl.innerHTML = scriptContent;
    document.body.appendChild(scriptEl);

    return () => {
      document.body.removeChild(scriptEl);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Tempo Severo no Hemisfério Sul</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://js.arcgis.com/3.35/esri/css/esri.css" />
        <link rel="stylesheet" href="https://js.arcgis.com/3.35/dijit/themes/claro/claro.css" />
      </Head>

      <Script src="https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js" strategy="beforeInteractive" />
      <Script src="https://js.arcgis.com/3.35/" strategy="afterInteractive" />

      <style jsx global>{`
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden; /* Prevent scrolling on the main page */
        }
        .claro {
            width: 100%;
            height: 100%;
        }
        #meteorologia-container {
            width: 100vw;
            height: 100vh;
            border: none;
        }
      `}</style>
      
      <iframe id="meteorologia-container" src="/meteorologia.html" title="Meteorologia BR"></iframe>
    </>
  );
}
