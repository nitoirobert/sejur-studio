import { setWorkerUrl } from "maplibre-gl";

// MapLibre desenează harta într-un „worker" (fișier separat). Bundler-ul Next nu-l copiază singur,
// așa că îl servim din public/ (copiat din node_modules/maplibre-gl/dist la instalare – vezi scriptul „postinstall").
setWorkerUrl("/maplibre-gl-worker.mjs");
