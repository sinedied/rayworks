/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Rayfin API base URL (e.g. http://localhost:5168). */
  readonly VITE_RAYFIN_API_URL?: string;
  /** Rayfin publishable key (pk-...). */
  readonly VITE_RAYFIN_PUBLISHABLE_KEY?: string;
  /** Fabric workspace ID — maps to FabricAuthOptions.workspaceId. */
  readonly VITE_FABRIC_WORKSPACE_ID?: string;
  /** Fabric/Rayfin item ID — maps to FabricAuthOptions.projectId. */
  readonly VITE_FABRIC_ITEM_ID?: string;
  /** Fabric portal base URL (e.g. https://app.fabric.microsoft.com/). */
  readonly VITE_FABRIC_PORTAL_URL?: string;
  /** Story map data source: `sample` (default, bundled fictional data) or `rayfin`. */
  readonly VITE_ATLAS_DATA_SOURCE?: 'sample' | 'rayfin';
  /** Full MapLibre style URL; replaces the generated Ray|Atlas basemap. */
  readonly VITE_ATLAS_MAP_STYLE_URL?: string;
  /** OpenMapTiles-schema vector tiles (TileJSON URL or `{z}/{x}/{y}` template). */
  readonly VITE_ATLAS_TILES_URL?: string;
  readonly VITE_ATLAS_GLYPHS_URL?: string;
  /** Raster DEM for hillshade and 3D terrain; `none` disables both. */
  readonly VITE_ATLAS_DEM_URL?: string;
  readonly VITE_ATLAS_DEM_ENCODING?: string;
  /** `false` turns off 3D buildings. */
  readonly VITE_ATLAS_BUILDINGS?: string;
  /** `night` (default) or `day`. */
  readonly VITE_ATLAS_MAP_VARIANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
