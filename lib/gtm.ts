export type DataLayerEvent = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

export function pushToDataLayer(event: DataLayerEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

// ✅ 互換用（FilterPanel / VideoCard が import している名前）
export function gtmEvent(event: DataLayerEvent) {
  pushToDataLayer(event);
}