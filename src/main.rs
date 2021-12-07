mod atlas;
mod game;
mod graph;
mod map;
mod utils;

const ROW_COUNT: usize = 64;
const COL_COUNT: usize = 64;

fn main() {
  let game = game::Game::new(ROW_COUNT, COL_COUNT, 1000);
  println!("{}", game);
}
