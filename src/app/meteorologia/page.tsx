
"use client";
import Head from 'next/head';

export default function MeteorologiaPage() {
  return (
    <>
      <Head>
        <title>Tempo Severo no Hemisfério Sul</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style jsx global>{`
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden; /* Prevent scrolling on the main page */
        }
        #meteorologia-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            border: none;
        }
      `}</style>
      
      <iframe 
        id="meteorologia-container" 
        src="/meteorologia.html" 
        title="Meteorologia BR"
      ></iframe>
    </>
  );
}
