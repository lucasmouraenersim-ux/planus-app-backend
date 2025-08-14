
"use client";

import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
    symbol: string;
}

function TradingViewWidgetComponent({ symbol }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const scriptId = 'tradingview-widget-script';

  useEffect(() => {
    // Evita adicionar o script múltiplas vezes
    if (document.getElementById(scriptId)) {
      // Se o script já existe, mas o widget não, recria o widget.
      if (container.current && container.current.children.length === 0) {
        createWidget();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = createWidget;
    document.head.appendChild(script);

    function createWidget() {
      if (container.current && 'TradingView' in window) {
        new (window as any).TradingView.widget({
            autosize: true,
            symbol: symbol,
            interval: "D",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "br",
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: container.current.id,
        });
      }
    }
    
    // Cleanup on unmount
    return () => {
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            // A remoção do script pode não ser ideal se outros widgets na mesma página o usarem.
            // Para este caso, como é o único, é seguro.
            // existingScript.remove(); 
        }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" style={{ height: "400px", width: "100%" }}>
      <div ref={container} id={`tradingview-widget-${symbol.replace(':', '-')}`} style={{ height: "100%", width: "100%" }}></div>
      <div className="tradingview-widget-copyright">
        <a href={`https://br.tradingview.com/symbols/${symbol.replace(':', '-')}/`} rel="noopener" target="_blank">
            <span className="blue-text">Gráfico {symbol}</span>
        </a> por TradingView
      </div>
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);
