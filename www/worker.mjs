import init, { Game, Tile } from "./pkg/wide_world.js";

init().then(({ memory }) => {
  let _game;

  function load(rows, cols, seed) {
    _game = Game.new(rows, cols, seed);
    const tileMap1 = Array.from(
      new Uint8Array(memory.buffer, _game.tileMapPtr(), rows * cols)
    );
    const tileMap2 = Array.from(
      new Uint8Array(memory.buffer, _game.tileMap2Ptr(), rows * cols)
    );
    const heightMap = Array.from(
      new Uint8Array(memory.buffer, _game.heightMapPtr(), rows * cols)
    );
    return {
      tileMap1,
      tileMap2,
      heightMap,
      rows,
      cols,
      seed,
    };
  }

  // TODO
  // function update() {
  //   if (!_game) {
  //     return;
  //   }
  //   _game.update();
  // }

  onmessage = ({ data }) => {
    const { rows, cols, seed } = data;
    switch (data.type) {
      case "load": {
        postMessage({
          type: "load",
          ...load(rows, cols, seed),
        });
        break;
      }
      default:
        console.log("Unknown message type"); // eslint-disable-line no-console
    }
  };

  postMessage({ type: "ready", tiles: Tile });
});
