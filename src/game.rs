use crate::atlas::Tile;
use crate::map::Map;
use crate::utils::set_panic_hook;
// use rand::Rng;
use std::fmt;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Game {
  map: Map,
}

#[wasm_bindgen]
impl Game {
  pub fn new(row_count: usize, col_count: usize, seed: u32) -> Game {
    set_panic_hook();
    let mut map = Map::new(row_count, col_count);
    // Debug
    // let s = rand::thread_rng().gen_range(0..u32::max_value());
    map.generate(seed);
    Game { map }
  }
  #[wasm_bindgen(js_name = tileMapPtr)]
  pub fn js_tile_map_ptr(&self) -> *const Tile {
    self.map.tile_map_ptr()
  }
  #[wasm_bindgen(js_name = tileMap2Ptr)]
  pub fn js_tile_map_2_ptr(&self) -> *const Tile {
    self.map.tile_map_2_ptr()
  }
  #[wasm_bindgen(js_name = heightMapPtr)]
  pub fn js_height_map_ptr(&self) -> *const u8 {
    self.map.height_map_ptr()
  }
}

impl fmt::Display for Game {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    let mut output = String::new();

    for row in self.map.tile_map.chunks(self.map.col_count) {
      for tile in row.iter().cloned() {
        output.push_str(&format!("{:?}", tile as u8));
      }
      output.push('\n');
    }
    write!(f, "{}", output)
  }
}
