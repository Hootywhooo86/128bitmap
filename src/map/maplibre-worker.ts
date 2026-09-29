// MapLibre does its tile work in a web worker. Bundling it through Vite
// makes sure the worker file actually ships with the app. The package marks
// itself side-effect free, so keep a reference or the bundler drops it.
import Worker from "maplibre-gl/dist/maplibre-gl-worker.mjs";

(self as unknown as { __maplibreWorker: unknown }).__maplibreWorker = Worker;
