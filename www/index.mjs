import {
  DPI,
  CELL_SIZE,
  SCROLL_SPEED,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SPEED,
} from "./config.mjs";
import { clamp, toIso } from "./util.mjs";
import initCanvas from "./canvas.mjs";
import initCamera from "./camera.3d.mjs";
import initPointerEvents from "./pointer.mjs";
import initRenderer from "./renderer.iso.mjs";

const DEFAULT_ROW_COUNT = 128;
const DEFAULT_COL_COUNT = 128;
const IMAGE_ASSETS = [{ name: "tiles", src: "./sprites/tiles.png" }];
// Center of map
const INITIAL_COORD = toIso({
  x: (DEFAULT_COL_COUNT * CELL_SIZE) / 2,
  y: (DEFAULT_ROW_COUNT * CELL_SIZE) / 2,
});
const DEFAULT_SEED = 255;

const worker = new Worker("./worker.mjs", { type: "module" });

function fetchImageAssets(assets) {
  return assets.map(
    ({ name, src }) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ name, img });
        img.onerror = () => reject(new Error(`Error: ${src}`));
        img.src = src;
      })
  );
}

function init() {
  // Set up stats
  const stats = new window.Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  // Load game assets
  Promise.all(fetchImageAssets(IMAGE_ASSETS)).then((loaded) => {
    const assets = new Map(loaded.map((asset) => [asset.name, asset.img]));
    const keys = new Set();
    const canvas = initCanvas("c");
    const camera = initCamera(canvas.gl, INITIAL_COORD);
    const renderer = initRenderer(canvas.gl, assets.get("tiles"));
    const pointer = initPointerEvents(canvas.el);
    const els = {
      loading: document.getElementById("loading"),
      size: document.getElementById("size"),
      seed: document.getElementById("seed"),
    };
    const state = {
      lastTickTime: 0,
      level: undefined,
    };
    const load = (rows, cols, seed) => {
      els.size.disabled = true;
      els.seed.disabled = true;
      state.level = undefined;
      worker.postMessage({
        type: "load",
        rows,
        cols,
        seed,
      });
    };

    const loop = (timestamp) => {
      stats.begin();
      if (state.level) {
        const delta = (timestamp - state.lastTickTime) / 1000;
        state.lastTickTime = timestamp;

        // Handle input
        if (keys.has("ArrowUp")) {
          camera.moveTo(camera.coord.x, camera.coord.y - SCROLL_SPEED * delta);
        }
        if (keys.has("ArrowDown")) {
          camera.moveTo(camera.coord.x, camera.coord.y + SCROLL_SPEED * delta);
        }
        if (keys.has("ArrowLeft")) {
          camera.moveTo(camera.coord.x - SCROLL_SPEED * delta, camera.coord.y);
        }
        if (keys.has("ArrowRight")) {
          camera.moveTo(camera.coord.x + SCROLL_SPEED * delta, camera.coord.y);
        }
        if (keys.has("w")) {
          const zoom = clamp(
            camera.zoom + ZOOM_SPEED * delta,
            MIN_ZOOM,
            MAX_ZOOM
          );
          camera.zoomToCenter(zoom);
        }
        if (keys.has("s")) {
          const zoom = clamp(
            camera.zoom - ZOOM_SPEED * delta,
            MIN_ZOOM,
            MAX_ZOOM
          );
          camera.zoomToCenter(zoom);
        }

        els.loading.classList.add("hidden");

        // Clear
        canvas.clear();
        // Render scene
        renderer.render(state.level, camera);
      } else {
        els.loading.classList.remove("hidden");
      }
      stats.end();
      window.requestAnimationFrame(loop);
    };

    // Bindings
    window.addEventListener("keydown", (e) => {
      keys.add(e.key);
    });

    window.addEventListener("keyup", (e) => {
      keys.delete(e.key);
    });

    els.seed.addEventListener("change", async (e) => {
      const seed = clamp(parseInt(e.target.value, 10), 0, 4294967295);
      e.target.value = seed;
      e.target.blur();
      load(DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT, seed);
    });

    els.seed.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });

    els.seed.addEventListener("keyup", (e) => {
      e.stopPropagation();
    });

    els.size.addEventListener("change", async (e) => {
      e.target.blur();
      switch (e.target.value) {
        case "64":
          load(64, 64, state.level.seed);
          break;
        case "128":
          load(128, 128, state.level.seed);
          break;
        case "256":
          load(256, 256, state.level.seed);
          break;
        default:
          load(DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT, state.level.seed);
      }
    });

    canvas.el.addEventListener("wheel", (e) => {
      e.preventDefault();
      // Multiply the wheel movement by the current zoom level, so we zoom
      // less when zoomed in and more when zoomed out
      const zoom = clamp(
        camera.zoom * 2 ** (e.deltaY / 100),
        MIN_ZOOM,
        MAX_ZOOM
      );
      camera.zoomToScreenCoord(e.clientX, e.clientY, zoom);
    });

    pointer.on("pan", (e) => {
      camera.moveTo(
        camera.coord.x - (e.dX * DPI) / camera.zoom,
        camera.coord.y - (e.dY * DPI) / camera.zoom
      );
    });

    pointer.on("pinch", (e) => {
      const zoom = clamp(
        camera.zoom * 2 ** (e.deltaXY / 100),
        MIN_ZOOM,
        MAX_ZOOM
      );
      camera.zoomToScreenCoord(e.midpoint.x, e.midpoint.y, zoom);
    });

    load(DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT, DEFAULT_SEED);

    worker.addEventListener("message", ({ data }) => {
      const { type, ...rest } = data;
      if (type === "load") {
        state.level = rest;
        state.lastTickTime = 0;
        els.size.disabled = false;
        els.seed.disabled = false;
        // Center of map
        const center = toIso({
          x: (state.level.cols * CELL_SIZE) / 2,
          y: (state.level.rows * CELL_SIZE) / 2,
        });
        camera.moveTo(center.x, center.y);
        camera.zoomToCenter(1);
      }
    });

    loop(0);
  });
}

// Wait for worker to load before initializing
worker.addEventListener(
  "message",
  ({ data }) => {
    if (data.type === "ready") {
      init({
        tiles: data.tiles,
      });
    }
  },
  {
    once: true,
  }
);
