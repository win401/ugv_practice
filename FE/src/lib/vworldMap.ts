import type { LatLngTuple } from "leaflet";

/** Official directions-map center; view bounds are for framing, not a surveyed boundary. */
export const suncheonMapConfig = {
  center: [34.92923188877225, 127.49889130642043] as LatLngTuple,
  bounds: [
    [34.9224, 127.4918],
    [34.9345, 127.5132],
  ] as [LatLngTuple, LatLngTuple],
  minZoom: 6,
  // Keep requesting existing source tiles; higher display levels magnify them.
  maxNativeZoom: 19,
  maxZoom: 23,
  tileUrl(apiKey: string) {
    return `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(apiKey.trim())}/Satellite/{z}/{y}/{x}.jpeg`;
  },
};

// Web-map key is intentionally browser-visible. Restrict its allowed service URL in V-world.
export const vworldApiKey = (import.meta.env.VITE_VWORLD_API_KEY ?? "").trim();
