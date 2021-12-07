use crate::atlas::Tile;
use crate::graph::bfs_path_to_target;
use noise::{NoiseFn, Seedable, SuperSimplex};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
enum Direction {
  North,
  NorthEast,
  East,
  SouthEast,
  South,
  SouthWest,
  West,
  NorthWest,
  Lon,
  Lat,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
enum Slope {
  North,
  East,
  South,
  West,
  // 1 point high
  NorthEast1,
  SouthEast1,
  SouthWest1,
  NorthWest1,
  // 3 points high
  NorthEast3,
  SouthEast3,
  SouthWest3,
  NorthWest3,
  // Saddles (2 points high)
  SaddleNorthEast,
  SaddleSouthEast,
  Unknown,
}

pub struct Map {
  pub row_count: usize,
  pub col_count: usize,
  // TODO: TileMap struct
  pub tile_map: Vec<Tile>,
  // TODO: TileMap struct
  pub tile_map_2: Vec<Tile>,
  // TODO: TileMap struct
  pub height_map: Vec<u8>,
}

struct PlaceRandomConfig {
  max_count: usize,
  min_distance: usize,
  max_attempts: usize,
  tile: Tile,
  seed: u64,
}

fn is_base_slope(tile: Tile) -> bool {
  tile == Tile::BaseNorth
    || tile == Tile::BaseEast
    || tile == Tile::BaseSouth
    || tile == Tile::BaseWest
}

fn edge_slope(edge: (usize, usize), neighbors: &[(usize, usize)]) -> Slope {
  let mut n_e_s_w = vec![false, false, false, false];
  let mut ne_se_sw_nw = vec![false, false, false, false];

  neighbors.iter().for_each(|&(n_row, n_col)| {
    if n_row < edge.0 && n_col == edge.1 {
      // n
      n_e_s_w[0] = true;
    } else if n_row == edge.0 && n_col > edge.1 {
      // e
      n_e_s_w[1] = true;
    } else if n_row > edge.0 && n_col == edge.1 {
      // s
      n_e_s_w[2] = true;
    } else if n_row == edge.0 && n_col < edge.1 {
      // w
      n_e_s_w[3] = true;
    } else if n_row < edge.0 && n_col > edge.1 {
      // ne
      ne_se_sw_nw[0] = true;
    } else if n_row > edge.0 && n_col > edge.1 {
      // se
      ne_se_sw_nw[1] = true;
    } else if n_row > edge.0 && n_col < edge.1 {
      // sw
      ne_se_sw_nw[2] = true;
    } else if n_row < edge.0 && n_col < edge.1 {
      // nw
      ne_se_sw_nw[3] = true;
    }
  });

  let n_4_count = n_e_s_w
    .iter()
    .fold(0, |acc, &v| if v { acc + 1 } else { acc });

  if n_4_count == 1 {
    return match (&n_e_s_w[..], &ne_se_sw_nw[..]) {
      // 1 high
      ([true, _, _, _], [_, true, _, _]) => Slope::NorthEast1,
      ([_, true, _, _], [_, _, _, true]) => Slope::NorthEast1,
      ([_, true, _, _], [_, _, true, _]) => Slope::SouthEast1,
      ([_, _, true, _], [true, _, _, _]) => Slope::SouthEast1,
      ([_, _, true, _], [_, _, _, true]) => Slope::SouthWest1,
      ([_, _, _, true], [_, true, _, _]) => Slope::SouthWest1,
      ([_, _, _, true], [true, _, _, _]) => Slope::NorthWest1,
      ([true, _, _, _], [_, _, true, _]) => Slope::NorthWest1,
      // Slope
      ([true, _, _, _], _) => Slope::North,
      ([_, true, _, _], _) => Slope::East,
      ([_, _, true, _], _) => Slope::South,
      ([_, _, _, true], _) => Slope::West,
      _ => Slope::Unknown,
    };
  }

  if n_4_count == 2 {
    // 1 high
    // Check ne_se_sw_nw to make sure there is a "backing" tile
    return match (&n_e_s_w[..], &ne_se_sw_nw[..]) {
      ([true, true, _, _], [_, _, false, _]) => Slope::NorthEast1,
      ([_, true, true, _], [_, _, _, false]) => Slope::SouthEast1,
      ([_, _, true, true], [false, _, _, _]) => Slope::SouthWest1,
      ([true, _, _, true], [_, false, _, _]) => Slope::NorthWest1,
      _ => Slope::Unknown,
    };
  }

  if n_4_count == 0 {
    // 2 and 3 high
    return match &ne_se_sw_nw[..] {
      [true, _, true, _] => Slope::SaddleSouthEast,
      [_, true, _, true] => Slope::SaddleNorthEast,
      [true, _, _, _] => Slope::NorthEast3,
      [_, true, _, _] => Slope::SouthEast3,
      [_, _, true, _] => Slope::SouthWest3,
      [_, _, _, true] => Slope::NorthWest3,
      _ => Slope::Unknown,
    };
  }
  Slope::Unknown
}

fn path_direction(edge: (usize, usize), neighbors: Vec<(usize, usize)>) -> Direction {
  // Corner directions
  // NW x NE
  // -x x x-
  // SW x SE

  // - x -
  // n e n
  // - n -

  // - n -
  // x e n
  // - n -
  let mut direction = (None, None);
  for n in neighbors {
    if n.0 < edge.0 {
      direction.0 = Some(Direction::North);
    } else if n.0 > edge.0 {
      direction.0 = Some(Direction::South);
    } else if n.1 < edge.1 {
      direction.1 = Some(Direction::West);
    } else if n.1 > edge.1 {
      direction.1 = Some(Direction::East);
    }
  }

  // Note, the corner is the inverse of the neighbor positions
  // w NE
  // 0 s
  match direction {
    (Some(Direction::North), Some(Direction::East)) => Direction::SouthWest,
    (Some(Direction::North), Some(Direction::West)) => Direction::SouthEast,
    (Some(Direction::South), Some(Direction::East)) => Direction::NorthWest,
    (Some(Direction::South), Some(Direction::West)) => Direction::NorthEast,
    (Some(Direction::North), None) => Direction::Lon,
    (Some(Direction::South), None) => Direction::Lon,
    (None, Some(Direction::East)) => Direction::Lat,
    (None, Some(Direction::West)) => Direction::Lat,
    _ => panic!("Invalid path"),
  }
}

impl Map {
  fn walkable_cells(&self, row: usize, col: usize) -> Vec<(usize, usize)> {
    let c_height = self.get_height(row, col);
    let c_tile = self.get_tile(row, col);
    self
      .neighbors_4(row, col)
      .iter()
      .cloned()
      .filter(|n| {
        // Find "walkable" neighbors
        // Is the neighbor north/south or east/west to the current cell?
        let n_is_n_or_s = (row as isize - n.0 as isize).abs() == 1 && col == n.1;
        let n_is_e_or_w = (col as isize - n.1 as isize).abs() == 1 && row == n.0;

        let n_tile = self.get_tile(n.0, n.1);
        let n_height = self.get_height(n.0, n.1);

        let slope_check = |a: Tile, b: Tile| -> bool {
          // "a" is a slope
          if a == Tile::BaseNorth || a == Tile::BaseSouth {
            // "b" is same direction as slope
            return (b == Tile::Base || b == a) && n_is_n_or_s;
          }
          if a == Tile::BaseEast || a == Tile::BaseWest {
            // "b" is same direction as slope
            return (b == Tile::Base || b == a) && n_is_e_or_w;
          }
          // Neighbor is not walkable
          false
        };

        if is_base_slope(c_tile) {
          return slope_check(c_tile, n_tile);
        }

        if is_base_slope(n_tile) {
          return slope_check(n_tile, c_tile);
        }

        if n_tile == Tile::Base && n_height == c_height {
          // Neighbor is walkable
          return true;
        }
        false
      })
      .collect::<Vec<(usize, usize)>>()
  }
  fn can_place_rocks(&self, row: usize, col: usize) -> bool {
    // Rocks must be surrounded by flat ground
    let tile = self.get_tile(row, col);
    if tile != Tile::Base {
      return false;
    }
    self
      .neighbors_8(row, col)
      .iter()
      .filter(|n| self.get_tile(n.0, n.1) == Tile::Base)
      .count()
      == 8
  }
  fn can_place_patch(&self, row: usize, col: usize) -> bool {
    self.get_tile(row, col) == Tile::Base && self.get_tile_2(row, col) == Tile::Empty
  }
  fn place_random<T>(&mut self, can_place: T, config: PlaceRandomConfig) -> Vec<(usize, usize)>
  where
    T: Fn(&Map, usize, usize) -> bool,
  {
    let mut rng = StdRng::seed_from_u64(config.seed);
    let mut attempts = 0;
    let mut placed: Vec<(usize, usize)> = Vec::new();
    while placed.len() < config.max_count && attempts < config.max_attempts {
      attempts += 1;
      let row = rng.gen_range(0..self.row_count);
      let col = rng.gen_range(0..self.col_count);
      // Check if row and col are within min_distance
      if placed
        .iter()
        .cloned()
        .map(|(r, c)| (r as isize, c as isize))
        .any(|(r, c)| {
          (row as isize - r).abs() + (col as isize - c).abs() < config.min_distance as isize
        })
      {
        // Placement is too close
        continue;
      }
      if can_place(self, row, col) {
        self.set_tile_2(row, col, config.tile);
        placed.push((row, col));
      }
    }
    placed
  }

  fn neighbors(&self, indices: Vec<(isize, isize)>) -> HashSet<(usize, usize)> {
    indices
      .iter()
      .cloned()
      .filter_map(|cell| {
        if self.in_bounds(cell.0, cell.1) {
          Some((cell.0 as usize, cell.1 as usize))
        } else {
          None
        }
      })
      .collect()
  }

  fn neighbors_4(&self, row: usize, col: usize) -> HashSet<(usize, usize)> {
    let r = row as isize;
    let c = col as isize;
    // 0 x 0
    // x 0 x
    // 0 x 0
    let indices = vec![(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)];
    self.neighbors(indices)
  }

  fn neighbors_8(&self, row: usize, col: usize) -> HashSet<(usize, usize)> {
    let r = row as isize;
    let c = col as isize;
    // x x x
    // x o x
    // x x x
    let indices = vec![
      (r - 1, c),
      (r - 1, c + 1),
      (r, c + 1),
      (r + 1, c + 1),
      (r + 1, c),
      (r + 1, c - 1),
      (r, c - 1),
      (r - 1, c - 1),
    ];
    self.neighbors(indices)
  }

  fn is_invalid_tile(&self, row: usize, col: usize) -> bool {
    let height = self.get_height(row, col);
    // Get neighbors that are lower than the current tile
    let lower_neighbors = self
      .neighbors_4(row, col)
      .iter()
      .cloned()
      .filter(|n| self.get_height(n.0, n.1) < height)
      .collect::<Vec<(usize, usize)>>();

    let mut n = false;
    let mut e = false;
    let mut s = false;
    let mut w = false;

    let is_edge_tile =
      row == 0 || row == self.row_count - 1 || col == 0 || col == self.col_count - 1;

    if is_edge_tile {
      return lower_neighbors.len() > 1;
    }

    for (n_row, n_col) in lower_neighbors {
      if n_row < row {
        n = true;
      } else if n_row > row {
        s = true;
      } else if n_col > col {
        e = true
      } else if n_col < col {
        w = true
      }
    }

    (n && s) || (e && w)
  }
}

impl Map {
  pub fn new(row_count: usize, col_count: usize) -> Map {
    Map {
      row_count,
      col_count,
      height_map: vec![0; row_count * col_count],
      tile_map: vec![Tile::Base; row_count * col_count],
      tile_map_2: vec![Tile::Empty; row_count * col_count],
    }
  }

  pub fn generate(&mut self, seed: u32) {
    self.tile_map = vec![Tile::Base; self.row_count * self.col_count];
    self.height_map = vec![0; self.row_count * self.col_count];

    let noise = SuperSimplex::default();

    web_sys::console::log_1(&format!("Seed: {}", seed).into());

    let n1 = noise.set_seed(seed);
    let n2 = noise.set_seed(seed.saturating_add(1));
    let n3 = noise.set_seed(seed.saturating_add(2));
    let n4 = noise.set_seed(seed.saturating_add(3));
    let mut rng = StdRng::seed_from_u64(seed as u64);

    let frequency = (self.col_count as f64 / 32.0).floor();
    let pow = rng.gen_range(1.0..1.4);
    let get_noise = |n: &SuperSimplex, nx: f64, ny: f64| {
      // Get noise value and scale to 0.0-1.0
      n.get([nx, ny]) / 2.0 + 0.5
    };

    (0..(self.row_count * self.col_count)).for_each(|i| {
      let col = i % self.col_count;
      let row = i / self.col_count;

      let nx = col as f64 / self.col_count as f64 - 0.5;
      let ny = row as f64 / self.row_count as f64 - 0.5;

      let a1 = 1.0;
      let a2 = 0.5;
      let a3 = 0.25;

      let mut val = a1 * get_noise(&n1, frequency * nx, frequency * ny)
        + a2 * get_noise(&n2, frequency * 2.0 * nx, frequency * 2.0 * ny)
        + a3 * get_noise(&n3, frequency * 3.0 * nx, frequency * 3.0 * ny);

      // Add and divide by sum of aplitudes to get a value between 0 and 1
      val /= a1 + a2 + a3;

      // Use curve to flatten value
      // Less than 1.0 creates more mountains, greater than 1.0 creates more water
      val = val.powf(pow);

      self.height_map[i] = match (val * 8.0).round() / 8.0 {
        v if v < 0.25 => 1,
        v if v < 0.5 => 2,
        v if v < 0.75 => 3,
        _ => 4,
      };

      self.tile_map[i] = match (val * 8.0).round() / 8.0 {
        v if v < 0.125 => Tile::WaterDeep,
        v if v < 0.25 => Tile::Water,
        v if v < 0.375 => Tile::Marsh,
        v if v < 0.75 => Tile::Base,
        _ => Tile::Rock,
      };
    });

    // Clean up "single" tiles, i.e. those that form a single line that
    // cannot be sloped
    (0..self.row_count).for_each(|row| {
      (0..self.col_count).for_each(|col| {
        if self.is_invalid_tile(row, col) {
          let mut node = Some((row, col));
          while let Some(n) = node {
            let height = self.get_height(n.0, n.1);
            let adjusted_height = height - 1;
            let tile = match adjusted_height {
              1 => Tile::Water,
              _ => Tile::Base,
            };
            self.set_tile(n.0, n.1, tile);
            self.set_height(n.0, n.1, adjusted_height);
            // Invalid neighbor will have at most one other matching neighbor
            node = self
              .neighbors_4(n.0, n.1)
              .iter()
              .cloned()
              .find(|n| self.get_height(n.0, n.1) == height && self.is_invalid_tile(n.0, n.1));
          }
        }
      });
    });

    // Terraform
    (0..self.row_count).for_each(|row| {
      (0..self.col_count).for_each(|col| {
        let mut tile = self.get_tile(row, col);
        // Slope land
        if tile == Tile::Base {
          let neighbors = self
            .neighbors_4(row, col)
            .iter()
            .cloned()
            .filter(|n| {
              let height = self.get_height(row, col);
              let n_height = self.get_height(n.0, n.1);
              n_height < height
            })
            .collect::<Vec<(usize, usize)>>();

          // Only slope n/s/e/w tiles
          if !neighbors.is_empty() {
            let direction = edge_slope((row, col), &neighbors);
            tile = match direction {
              Slope::North => Tile::BaseNorth,
              Slope::East => Tile::BaseEast,
              Slope::South => Tile::BaseSouth,
              Slope::West => Tile::BaseWest,
              _ => tile,
            };
            self.set_tile(row, col, tile);
          }
        }

        // Slope mountains
        if tile == Tile::Rock {
          let neighbors = self
            .neighbors_8(row, col)
            .iter()
            .cloned()
            .filter(|n| {
              let height = self.get_height(row, col);
              let n_height = self.get_height(n.0, n.1);
              n_height < height
            })
            .collect::<Vec<(usize, usize)>>();

          if !neighbors.is_empty() {
            let direction = edge_slope((row, col), &neighbors);

            tile = match direction {
              Slope::NorthEast3 => Tile::RockNorthEast3,
              Slope::NorthWest3 => Tile::RockNorthWest3,
              Slope::SouthEast3 => Tile::RockSouthEast3,
              Slope::SouthWest3 => Tile::RockSouthWest3,
              Slope::NorthEast1 => Tile::RockNorthEast1,
              Slope::NorthWest1 => Tile::RockNorthWest1,
              Slope::SouthEast1 => Tile::RockSouthEast1,
              Slope::SouthWest1 => Tile::RockSouthWest1,
              Slope::SaddleNorthEast => Tile::RockSaddleNorthEast,
              Slope::SaddleSouthEast => Tile::RockSaddleSouthEast,
              Slope::North => Tile::RockNorth,
              Slope::East => Tile::RockEast,
              Slope::South => Tile::RockSouth,
              Slope::West => Tile::RockWest,
              Slope::Unknown => Tile::RockAlt,
            };
            self.set_tile(row, col, tile);
          }
        }

        // Find marsh edges
        if tile == Tile::Marsh {
          let neighbors = self
            .neighbors_8(row, col)
            .iter()
            .cloned()
            .filter(|n| {
              let height = self.get_height(row, col);
              let n_height = self.get_height(n.0, n.1);
              n_height < height
            })
            .collect::<Vec<(usize, usize)>>();

          if !neighbors.is_empty() {
            let direction = edge_slope((row, col), &neighbors);

            tile = match direction {
              Slope::NorthEast3 => Tile::MarshNorthEast3,
              Slope::NorthWest3 => Tile::MarshNorthWest3,
              Slope::SouthEast3 => Tile::MarshSouthEast3,
              Slope::SouthWest3 => Tile::MarshSouthWest3,
              Slope::NorthEast1 => Tile::MarshNorthEast1,
              Slope::NorthWest1 => Tile::MarshNorthWest1,
              Slope::SouthEast1 => Tile::MarshSouthEast1,
              Slope::SouthWest1 => Tile::MarshSouthWest1,
              Slope::SaddleNorthEast => Tile::MarshSaddleNorthEast,
              Slope::SaddleSouthEast => Tile::MarshSaddleSouthEast,
              Slope::North => Tile::MarshNorth,
              Slope::East => Tile::MarshEast,
              Slope::South => Tile::MarshSouth,
              Slope::West => Tile::MarshWest,
              Slope::Unknown => Tile::MarshAlt,
            };
            self.set_tile(row, col, tile);
          }
        }

        // Add flora
        let nx = col as f64 / self.col_count as f64 - 0.5;
        let ny = row as f64 / self.row_count as f64 - 0.5;
        // Add trees
        if tile == Tile::Base {
          let height = self.get_height(row, col);
          let random = get_noise(&n4, nx * 3.0, ny * 3.0);
          self.set_tile_2(
            row,
            col,
            match random {
              // Higher chance of trees at lower altitudes
              r if height == 2 && r < 0.3 => Tile::Tree,
              r if height == 3 && r < 0.2 => Tile::Tree,
              r if height == 4 && r < 0.1 => Tile::Tree,
              _ => Tile::Empty,
            },
          );
        }
        /*
        // Add reeds
        if tile == Tile::Marsh {
          let random = get_noise(&n4, nx * 3.0, ny * 3.0);
          // Add marsh
          self.set_tile_2(
            row,
            col,
            match random {
              // Higher chance of reeds at lower altitudes
              r if r >= 0.4 => Tile::Reeds,
              _ => Tile::Empty,
            },
          );
        }
        */
      });
    });

    let rocks = self.place_random(
      Map::can_place_rocks,
      PlaceRandomConfig {
        max_count: (self.col_count / 16),
        min_distance: 40,
        max_attempts: self.col_count,
        tile: Tile::Rocks,
        seed: seed as u64,
      },
    );

    if rocks.len() > 1 {
      let start = rocks[0];
      let neighbors_for_cell = |(row, col)| self.walkable_cells(row, col);
      // Search for other rock tiles
      let is_match = |(row, col)| (row, col) != start && self.get_tile_2(row, col) == Tile::Rocks;

      if let Some(path) = bfs_path_to_target(start, neighbors_for_cell, is_match) {
        // Remove first and last element from path
        let slice = &path[1..path.len() - 1];
        for i in 0..slice.len() {
          let cell = slice[i];
          let mut neighbors = Vec::new();
          if i > 0 {
            neighbors.push(slice[i - 1]);
          }
          if i < slice.len() - 1 {
            neighbors.push(slice[i + 1]);
          }
          let mut tile = match self.get_tile(cell.0, cell.1) {
            Tile::BaseNorth => Tile::RoadSlopeNorth,
            Tile::BaseEast => Tile::RoadSlopeEast,
            Tile::BaseSouth => Tile::RoadSlopeSouth,
            Tile::BaseWest => Tile::RoadSlopeWest,
            _ => Tile::Road1,
          };
          if tile == Tile::Road1 {
            let direction = path_direction(cell, neighbors);
            tile = match direction {
              Direction::NorthEast => Tile::RoadNorthEast,
              Direction::NorthWest => Tile::RoadNorthWest,
              Direction::SouthEast => Tile::RoadSouthEast,
              Direction::SouthWest => Tile::RoadSouthWest,
              Direction::Lat => Tile::Road2,
              _ => tile,
            };
          }
          self.set_tile(cell.0, cell.1, tile);
          self.set_tile_2(cell.0, cell.1, Tile::Empty);
        }
      }
    }

    self.place_random(
      Map::can_place_patch,
      PlaceRandomConfig {
        max_count: (self.col_count / 4),
        min_distance: 20,
        max_attempts: (self.col_count / 4) * 2,
        tile: Tile::GrassPatch,
        seed: seed as u64,
      },
    );
  }

  fn in_bounds(&self, row: isize, col: isize) -> bool {
    (row >= 0 && row < self.row_count as isize) && (col >= 0 && col < self.col_count as isize)
  }

  fn get_tile(&self, row: usize, col: usize) -> Tile {
    self.tile_map[row * self.col_count + col]
  }

  fn set_tile(&mut self, row: usize, col: usize, tile: Tile) {
    self.tile_map[row * self.col_count + col] = tile;
  }

  pub fn tile_map_ptr(&self) -> *const Tile {
    self.tile_map.as_ptr()
  }

  fn get_tile_2(&self, row: usize, col: usize) -> Tile {
    self.tile_map_2[row * self.col_count + col]
  }

  fn set_tile_2(&mut self, row: usize, col: usize, tile: Tile) {
    self.tile_map_2[row * self.col_count + col] = tile;
  }

  pub fn tile_map_2_ptr(&self) -> *const Tile {
    self.tile_map_2.as_ptr()
  }

  fn get_height(&self, row: usize, col: usize) -> u8 {
    self.height_map[row * self.col_count + col]
  }

  fn set_height(&mut self, row: usize, col: usize, height: u8) {
    self.height_map[row * self.col_count + col] = height;
  }

  pub fn height_map_ptr(&self) -> *const u8 {
    self.height_map.as_ptr()
  }
}

#[cfg(test)]
mod test {
  use super::edge_slope;
  use super::Map;
  use super::Slope;
  use super::Tile;

  #[test]
  fn cannot_walk_up_or_down_without_slope() {
    let mut map = Map::new(3, 3);
    #[rustfmt::skip]
    let tile_map = vec![
      Tile::Base, Tile::Base, Tile::Base,
      Tile::Base, Tile::Base, Tile::Base,
      Tile::Base, Tile::Base, Tile::Base,
    ];
    #[rustfmt::skip]
    let height_map = vec![
      3, 2, 3,
      2, 1, 2,
      3, 2, 3,
    ];
    map.tile_map = tile_map;
    map.height_map = height_map;
    assert_eq!(map.walkable_cells(1, 1), vec![]);
    assert_eq!(map.walkable_cells(2, 1), vec![]);
  }
  #[test]
  fn cannot_walk_side_to_side_on_slope() {
    let mut map = Map::new(3, 3);
    #[rustfmt::skip]
    let tile_map = vec![
      Tile::Base, Tile::Base, Tile::Base,
      Tile::Base, Tile::Base, Tile::Base,
      Tile::Base, Tile::BaseNorth, Tile::BaseNorth,
    ];
    #[rustfmt::skip]
    let height_map = vec![
      3, 2, 3,
      2, 2, 2,
      1, 2, 2,
    ];
    map.tile_map = tile_map;
    map.height_map = height_map;
    assert_eq!(map.walkable_cells(2, 1), vec![(1, 1)]);
  }

  #[test]
  fn find_edge_slope() {
    let edge = (1, 1);
    // - - -
    // - e -
    // n n n
    assert_eq!(
      edge_slope(edge, &vec![(2, 0), (2, 1), (2, 2)]),
      Slope::South
    );
    // - - -
    // - e -
    // - n -
    assert_eq!(edge_slope(edge, &vec![(2, 1)]), Slope::South);
    // n n n
    // - e n
    // - - -
    assert_eq!(
      edge_slope(edge, &vec![(0, 0), (0, 1), (0, 2), (1, 2)]),
      Slope::NorthEast1
    );
    // n n n
    // n e -
    // - - -
    assert_eq!(
      edge_slope(edge, &vec![(0, 0), (0, 1), (0, 2), (1, 0)]),
      Slope::NorthWest1
    );
    // - - -
    // n e -
    // n n n
    assert_eq!(
      edge_slope(edge, &vec![(1, 0), (2, 0), (2, 1), (2, 2)]),
      Slope::SouthWest1
    );
    // - - -
    // - e n
    // n n n
    assert_eq!(
      edge_slope(edge, &vec![(1, 2), (2, 0), (2, 1), (2, 2)]),
      Slope::SouthEast1
    );
    // n - -
    // - e n
    // - - -
    assert_eq!(edge_slope(edge, &vec![(0, 0), (1, 2)]), Slope::NorthEast1);
    // - - -
    // - e n
    // n - -
    assert_eq!(edge_slope(edge, &vec![(1, 2), (2, 0)]), Slope::SouthEast1);
    // - - -
    // n e -
    // - - n
    assert_eq!(edge_slope(edge, &vec![(1, 0), (2, 2)]), Slope::SouthWest1);
    // - - n
    // n e -
    // - - -
    assert_eq!(edge_slope(edge, &vec![(0, 2), (1, 0)]), Slope::NorthWest1);
    // - - n
    // - e -
    // - - -
    assert_eq!(edge_slope(edge, &vec![(0, 2)]), Slope::NorthEast3);
    // - - -
    // - e -
    // - - n
    assert_eq!(edge_slope(edge, &vec![(2, 2)]), Slope::SouthEast3);
    // n - -
    // - e -
    // - - -
    assert_eq!(edge_slope(edge, &vec![(0, 0)]), Slope::NorthWest3);
    // - - -
    // - e -
    // n - -
    assert_eq!(edge_slope(edge, &vec![(2, 0)]), Slope::SouthWest3);
    // - n -
    // - e -
    // - n -
    assert_eq!(edge_slope(edge, &vec![(0, 1), (2, 1)]), Slope::Unknown);
    // - - -
    // n e n
    // - - -
    assert_eq!(edge_slope(edge, &vec![(1, 0), (1, 2)]), Slope::Unknown);
    // - n -
    // n e n
    // - n -
    assert_eq!(
      edge_slope(edge, &vec![(0, 1), (1, 0), (1, 2), (2, 1)]),
      Slope::Unknown
    );
    // - - n
    // - e -
    // n - -
    assert_eq!(
      edge_slope(edge, &vec![(0, 2), (2, 0)]),
      Slope::SaddleSouthEast
    );
    // n - -
    // - e -
    // - - n
    assert_eq!(
      edge_slope(edge, &vec![(0, 0), (2, 2)]),
      Slope::SaddleNorthEast
    );
    // - n -
    // - e -
    // - - n
    assert_eq!(edge_slope(edge, &vec![(0, 1), (2, 2)]), Slope::NorthEast1);
    // - n -
    // - e -
    // n - -
    assert_eq!(edge_slope(edge, &vec![(0, 1), (2, 0)]), Slope::NorthWest1);
    // n - -
    // - e -
    // - n -
    assert_eq!(edge_slope(edge, &vec![(0, 0), (2, 1)]), Slope::SouthWest1);
    // - - n
    // - e -
    // - n -
    assert_eq!(edge_slope(edge, &vec![(0, 2), (2, 1)]), Slope::SouthEast1);
  }
}
