import init, { Game } from "./pkg/wide_world.js";
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
import initHud from "./hud.mjs";

const ROW_COUNT = 64;
const COL_COUNT = 64;
const IMAGE_ASSETS = [{ name: "tiles", src: "./sprites/tiles.png" }];
// Center of map
const INITIAL_COORD = toIso({
  x: (COL_COUNT * CELL_SIZE) / 2,
  y: (ROW_COUNT * CELL_SIZE) / 2,
});
const DEFAULT_SEED = 1024;

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

function initGame(memory) {
  let _level;
  let _tileMap1;
  let _tileMap2;
  let _heightMap;
  let _rows;
  let _cols;
  return {
    load(rows, cols, seed) {
      _rows = rows;
      _cols = cols;
      return new Promise((resolve) => {
        _level = Game.new(rows, cols, seed);

        _tileMap1 = new Uint8Array(
          memory.buffer,
          _level.tileMapPtr(),
          rows * cols
        );

        _tileMap2 = new Uint8Array(
          memory.buffer,
          _level.tileMap2Ptr(),
          rows * cols
        );

        _heightMap = new Uint8Array(
          memory.buffer,
          _level.heightMapPtr(),
          rows * cols
        );
        resolve({
          level: this.level,
        });
      });
    },
    get level() {
      return {
        tileMap1: _tileMap1,
        tileMap2: _tileMap2,
        heightMap: _heightMap,
        rows: _rows,
        cols: _cols,
      };
    },
  };
}

// Load game assets
Promise.all(fetchImageAssets(IMAGE_ASSETS)).then((loaded) => {
  const assets = new Map(loaded.map((asset) => [asset.name, asset.img]));
  // Init WASM
  init().then(({ memory }) => {
    const keys = new Set();
    const canvas = initCanvas("c");
    const game = initGame(memory);
    const camera = initCamera(canvas.gl, INITIAL_COORD);
    const renderer = initRenderer(canvas.gl, assets.get("tiles"));
    const hud = initHud("hud");
    const pointer = initPointerEvents(canvas.el);
    const loading = document.getElementById("loading");
    const state = {
      lastTickTime: 0,
      level: undefined,
    };

    const loop = (timestamp) => {
      if (state.level) {
        const delta = (timestamp - state.lastTickTime) / 1000;
        state.lastTickTime = timestamp;

        hud.update(`FPS: ${(1 / delta).toFixed(1)}`);

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

        loading.classList.add("hidden");

        // Clear
        canvas.clear();
        // Render scene
        renderer.render(game.level, camera);
      } else {
        loading.classList.remove("hidden");
      }
      window.requestAnimationFrame(loop);
    };

    // Bindings
    window.addEventListener("keydown", (e) => {
      keys.add(e.key);
    });

    window.addEventListener("keyup", (e) => {
      keys.delete(e.key);
    });

    document
      .getElementById("seed")
      .querySelector("input")
      .addEventListener("change", async (e) => {
        const parsed = clamp(parseInt(e.target.value, 10), 0, 4294967295);
        e.target.value = parsed;
        e.target.blur();
        state.level = undefined;
        state.level = await game.load(ROW_COUNT, COL_COUNT, parsed);
        state.lastTickTime = 0;
      });

    document.getElementById("seed").addEventListener("keydown", (e) => {
      e.stopPropagation();
    });

    document.getElementById("seed").addEventListener("keyup", (e) => {
      e.stopPropagation();
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

    game.load(ROW_COUNT, COL_COUNT, DEFAULT_SEED).then((level) => {
      state.level = level;
      state.lastTickTime = 0;
    });

    loop(0);
  });
});
