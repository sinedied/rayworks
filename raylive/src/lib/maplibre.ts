/**
 * Lazy MapLibre loader. The library, its worker and its CSS land in their own chunks and are
 * only fetched when a globe activity is shown.
 */
export type MapLibre = typeof import('maplibre-gl');

let webGL: boolean | undefined;

/**
 * WebGL is required; checking first avoids downloading ~300 kB for a map that cannot render.
 * Cached, since every probe holds a context and browsers cap how many can be live at once.
 */
export function hasWebGL(): boolean {
  if (webGL === undefined) {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      webGL = !!context;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webGL = false;
    }
  }
  return webGL;
}

let pending: Promise<MapLibre> | undefined;

export function loadMapLibre(): Promise<MapLibre> {
  if (!hasWebGL()) return Promise.reject(new Error('WebGL is not available'));
  pending ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
    .then(([maplibre, worker]) => {
      // Vite cannot follow MapLibre's `import.meta.url` worker lookup, so point it at the asset.
      maplibre.setWorkerUrl(worker.default);
      return maplibre;
    })
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
