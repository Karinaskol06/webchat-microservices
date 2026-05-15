import React, { createContext, useContext, useEffect, useState } from 'react';

const ChatAreaMetricsContext = createContext({ width: 0, height: 0 });

export function ChatAreaMetricsProvider({ viewportRef, children }) {
  const [metrics, setMetrics] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = viewportRef?.current;
    if (!el) return undefined;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setMetrics({ width: Math.max(0, width), height: Math.max(0, height) });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [viewportRef]);

  return (
    <ChatAreaMetricsContext.Provider value={metrics}>{children}</ChatAreaMetricsContext.Provider>
  );
}

export function useChatAreaMetrics() {
  return useContext(ChatAreaMetricsContext);
}
