use std::collections::VecDeque;
use std::collections::{HashMap, HashSet};

fn get_path(
  start: (usize, usize),
  nodes: HashMap<(usize, usize), (usize, usize)>,
) -> Vec<(usize, usize)> {
  let mut path = Vec::new();
  let mut current = start;
  path.push(current);
  while let Some(&vertex) = nodes.get(&current) {
    path.push(vertex);
    current = vertex;
  }
  path.reverse();
  path
}

// BFS to find the shortest path to a node
pub fn bfs_path_to_target<T, U>(
  start_cell: (usize, usize),
  get_neigbors: T,
  is_match: U,
) -> Option<Vec<(usize, usize)>>
where
  T: Fn((usize, usize)) -> Vec<(usize, usize)>,
  U: Fn((usize, usize)) -> bool,
{
  let mut queue = VecDeque::new();
  let mut visited = HashSet::new();
  let mut prev_map = HashMap::new();
  let mut path = vec![];

  queue.push_back(start_cell);
  visited.insert(start_cell);

  while let Some(cell) = queue.pop_front() {
    if is_match(cell) {
      path = get_path(cell, prev_map);
      break;
    }
    for neighbor in get_neigbors(cell) {
      if !visited.contains(&neighbor) {
        queue.push_back(neighbor);
        visited.insert(neighbor);
        prev_map.insert(neighbor, cell);
      }
    }
  }
  if path.is_empty() {
    None
  } else {
    Some(path)
  }
}

#[cfg(test)]
mod test {
  use super::*;
  #[test]
  fn find_path_to_closest() {
    let row_count = 4;
    let col_count = 4;
    #[rustfmt::skip]
    let grid = vec![
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 0,
    ];

    let get_neighbors = |(row, col)| {
      let mut neighbors = Vec::new();
      if row > 0 {
        neighbors.push((row - 1, col));
      }
      if col < col_count - 1 {
        neighbors.push((row, col + 1));
      }
      if row < row_count - 1 {
        neighbors.push((row + 1, col));
      }
      if col > 0 {
        neighbors.push((row, col - 1));
      }

      neighbors
    };
    let is_target = |(r, c)| grid[r * col_count + c] == 1;
    // x x x 0
    // 0 0 x 0
    // 0 0 x 0
    // 0 0 0 0
    let path = bfs_path_to_target((0, 0), get_neighbors, is_target);
    assert_eq!(path, Some(vec![(0, 0), (0, 1), (0, 2), (1, 2), (2, 2)]));
  }
  #[test]
  fn no_path() {
    let row_count = 4;
    let col_count = 4;
    #[rustfmt::skip]
    let grid = vec![
      0, 0, 0, 0,
      2, 2, 2, 2,
      0, 0, 1, 0,
      0, 0, 0, 0,
    ];

    let get_neighbors = |(row, col)| {
      let mut neighbors = Vec::new();
      if row > 0 {
        neighbors.push((row - 1, col));
      }
      if col < col_count - 1 {
        neighbors.push((row, col + 1));
      }
      if row < row_count - 1 {
        neighbors.push((row + 1, col));
      }
      if col > 0 {
        neighbors.push((row, col - 1));
      }

      neighbors
        .iter()
        .cloned()
        .filter(|(r, c)| {
          println!("{:?}", (r, c));
          println!("{:?}", grid[r * col_count + c]);
          grid[r * col_count + c] != 2
        })
        .collect()
    };
    let is_target = |(r, c)| grid[r * col_count + c] == 1;
    let path = bfs_path_to_target((0, 0), get_neighbors, is_target);
    assert_eq!(path, None);
  }
}
