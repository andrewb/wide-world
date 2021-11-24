import { Tile } from "./pkg/wide_world.js";
import { clamp, to2d, toIso } from "./util.mjs";
import { CELL_SIZE, SPRITE_ASPECT_RATIO } from "./config.mjs";
import initTileShader from "./tile.image.mjs";

export default function renderer(gl, tex) {
  const program = initTileShader(gl, tex);

  return {
    render(level, camera) {
      // Update projection to match camera
      program.viewProjMatrix = camera.viewProjMatrix;
      // Calculate number of tiles that will be visible in the viewport
      // Find the hypotenuse of the viewport
      const hypotenuse = Math.sqrt(camera.width ** 2 + camera.height ** 2);
      // Find the number of cells needed to fill the length of the hypotenuse
      // Note, cells overlap by half a cell
      // Also note, distance is havled since the min/max is calculated from the center
      const distance = Math.ceil(
        (hypotenuse / camera.zoom / (CELL_SIZE * SPRITE_ASPECT_RATIO)) * 0.5
      );

      // Find the range of tiles to loop over
      const clampRow = (v) => clamp(v, 0, level.rows);
      const clampCol = (v) => clamp(v, 0, level.cols);
      const targetIn2d = to2d(camera.coord);
      const targetCol = Math.floor(targetIn2d.x / CELL_SIZE);
      const targetRow = Math.floor(targetIn2d.y / CELL_SIZE);
      const rowMin = clampRow(targetRow - distance);
      const rowEnd = clampRow(targetRow + distance);
      const colMin = clampCol(targetCol - distance);
      const colEnd = clampCol(targetCol + distance);

      for (let i = rowMin; i < rowEnd; i++) {
        for (let j = colMin; j < colEnd; j++) {
          const { x, y } = toIso({
            x: j * CELL_SIZE,
            y: i * CELL_SIZE,
          });
          const tile1 = level.tileMap1[i * level.cols + j];
          const tile2 = level.tileMap2[i * level.cols + j];
          const height = level.heightMap[i * level.cols + j];

          program.add(
            x,
            y,
            CELL_SIZE,
            CELL_SIZE * SPRITE_ASPECT_RATIO,
            height,
            tile1
          );

          if (tile2 !== Tile.Empty) {
            // Raise overlay by 1 unit so it sits on top of the tile
            program.add(
              x,
              y,
              CELL_SIZE,
              CELL_SIZE * SPRITE_ASPECT_RATIO,
              height + 1,
              tile2
            );
          }
        }
      }
      program.flush();
    },
  };
}
