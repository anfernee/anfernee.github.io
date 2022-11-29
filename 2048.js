// TODO:
// - Render Game over
// - Render Score
// - Render transition
// - No new tile if no tiles are moved

Array.prototype.random = function () {
  return this[Math.floor((Math.random()*this.length))];
}

class Cell {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
  }

  next(dir) {
    if (this.is_outbound()) {
      return null;
    }
    if (dir.is_horizontal()) {
      return new Cell(this.x, this.y + dir.increment());
    } else {
      return new Cell(this.x + dir.increment(), this.y);
    }
  }

  is_outbound() {
    return this.x >= this.size || this.x < 0 || this.y >= this.size || this.y < 0;
  }

  toString() {
    return `[${this.x},${this.y}]`
  }
}

class Tile {
  constructor(x, y, value) {
    this.cell = new Cell(x, y);
    this.value = value;
    this.previous = null;
  }

  update(x, y) {
    this.previous = this.cell;
    this.cell = new Cell(x, y);
  }

  can_merge(tile) {
    if (tile == null) {
      return false;
    }
    if (this.value == tile.value) {
      return true;
    }
    return false;
  }

  merge(tile) {
    this.value *= 2;
    tile.value = 0;
  }

  toString() {
    return `${this.value}`;
  }
}

var EMPTY_TILE = new Tile(0, 0, 0);

const OUTBOUND = -1;

class Iteration {
  constructor(grid, index, dir) {
    this.grid = grid;
    this.dir = dir;
    this.index = index;

    this.cur = 0;
    if (dir == Direction.Down || dir == Direction.Right) {
      this.cur = grid.length - 1;
    }
  }

  next() {
    if (this.is_outbound()) {
      return OUTBOUND;
    }

    let value = null;
    if (this.dir.is_horizontal()) {
      value = this.grid[this.index][this.cur];
    } else {
      value = this.grid[this.cur][this.index];
    }

    this.cur += this.dir.increment();

    return value;
  }

  next_valid() {
    let tile = null;
    do {
      if (tile != null) {
        console.log(`check next tile: ${tile.cell} ${tile}`);
      }
      tile = this.next();
    } while (tile == null || tile.value == 0)
    if (tile != null) {
      console.log(`next tile: ${tile.cell} ${tile}`);
    }
    return tile;
  }

  is_outbound() {
    return this.cur >= this.grid.length || this.cur < 0;
  }
}

class Direction {
  static Up = new Direction('Up');
  static Down = new Direction('Down');
  static Left = new Direction('Left');
  static Right = new Direction('Right');

  constructor(name) {
    this.name = name;
  }

  static map = {
      Up: { x: 0, y: -1 },
      Right: { x: 1, y: 0 },
      Down: { x: 0, y: 1 },
      Left: { x: -1, y: 0 },
  }

  direction() {
    return Direction.map[this];
  }

  // fixed y
  is_verticle() {
    return this == Direction.Up || this == Direction.Down;
  }

  // fixed x
  is_horizontal() {
    return this == Direction.Left || this == Direction.Right;
  }

  increment() {
    if (this == Direction.Up || this == Direction.Left) {
      return 1;
    }
    return -1;
  }

  toString() {
    return `${this.name}`;
  }
}

class Grid {
  constructor(size) {
    this.size = size;
    this.grid = [];
    for (let i = 0; i < size; i++) {
      this.grid.push(Array(size).fill(null));
    }
  }

  empty_tiles() {
    let tiles = [];
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (this.grid[i][j] == null || this.grid[i][j].value == 0) {
          tiles.push(new Cell(i, j, this.size));
        }
      }
    }
    return tiles
  }

  iterations(dir) {
    let iters = [];
    for(let i = 0; i < this.size; i++) {
      iters.push(new Iteration(this.grid, i, dir))
    }
    return iters;
  }

  move(dir) {
    let iters = this.iterations(dir);
    var moved = false;

    iters.forEach(iter => {
      var cur = iter.next_valid(); // current tile
      var cell = this.last_cell(iter.index, dir); // current cell in grid to fill
      var next = null; // next tile to merge

      while (cur != OUTBOUND) {
        next = iter.next_valid();

        if (cur.can_merge(next)) {
          let next_cur = next;
          cur.merge(next);
          this.unassign(next);
          this.assign(cur, cell);
          cur = next_cur;
          moved = true;
        } else {
          this.assign(cur, cell);
          cur = next;
        }

        cell = cell.next(dir);
      }
    });

    return moved;
  }

  last_cell(index, dir) {
    let size = this.size;

    switch (dir) {
      case Direction.Up:
        return new Cell(0, index, size);
      case Direction.Down:
        return new Cell(size-1, index, size);
      case Direction.Left:
        return new Cell(index, 0, size);
      case Direction.Right:
        return new Cell(index, size-1, size);
    }
  }

  assign(tile, cell) {
    if (tile.value == 0) {
      return;
    }

    console.log(`assign ${tile} from ${tile.cell} to ${cell}`)
    if (tile.cell.x != cell.x || tile.cell.y != cell.y) {
      this.unassign(tile);
    }
    tile.cell = cell;
    this.grid[cell.x][cell.y] = tile;
  }

  unassign(tile) {
    console.log(`unassign ${tile} on ${tile.cell}`);
    this.grid[tile.cell.x][tile.cell.y] = null;
  }

  debug() {
    console.log("Grid:")
    this.grid.forEach(line => {
      let msg = line.join(",");
      console.log(`[${msg}]`);
    });
  }
}

class KeyboardManager {
  static map = {
    38: Direction.Up,     // Up
    39: Direction.Right,  // Right
    40: Direction.Down,   // Down
    37: Direction.Left,   // Left
    87: Direction.Up,     // W
    68: Direction.Right,  // D
    83: Direction.Down,   // S
    65: Direction.Left,   // A
  };


  constructor() {
    var self = this;
    this.events = {};

    document.addEventListener("keydown", function(event) {
      let dir = KeyboardManager.map[event.which];
      if (dir != null) {
        self.emit("move", dir);
        self.emit("debug");
      }
    });
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  remove(event) {
    this.events.delete(event);
  }

  emit(event, data) {
    var callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach(function (callback) {
        callback(data);
      });
    }
  }
}

class Renderer {
  constructor(grid) {
    this.tile_container = document.querySelector(".tile-container");
    this.grid = grid;
  }

  render() {
    var self = this;

    window.requestAnimationFrame(function() {
      self.clear_container(self.tile_container);

      for (let i = 0; i < self.grid.size; i++) {
        for (let j = 0; j < self.grid.size; j++) {
          if (self.grid.grid[i][j] != null) {
            self.add_tile(self.grid.grid[i][j]);
          }
        }
      }
    })
  }

  clear_container(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  add_tile(tile) {
    var wrapper = document.createElement("div");
    var inner = document.createElement("div");

    inner.classList.add("tile-inner");
    inner.textContent = tile.value;
    wrapper.appendChild(inner);

    var classes = ["tile", "tile-" + tile.value, this.position_class(tile.cell)];
    this.apply_classes(wrapper, classes);
    this.tile_container.appendChild(wrapper);
  }

  position_class(cell) {
    return "tile-position-" + (cell.y + 1) + "-" + (cell.x + 1);
  }

  apply_classes(elem, classes) {
    elem.setAttribute("class", classes.join(" "));
  }
}

class Game {
  constructor() {
    this.grid = new Grid(4);
    this.keyboard = new KeyboardManager();
    this.renderer = new Renderer(this.grid);
  }

  static GAME_OVER = -1;

  setup() {
    console.log("setup()");
    game.grid.assign(new Tile(0, 0, 2), new Cell(0, 0, 4));
    game.grid.assign(new Tile(0, 1, 2), new Cell(0, 1, 4));
    this.keyboard.on("move", this.move.bind(this));
    this.keyboard.on("debug", this.grid.debug.bind(this.grid));
    this.renderer.render();
  }

  move(dir) {
    this.grid.move(dir);
    this.renderer.render();
    if (this.new_tile() == Game.GAME_OVER) {
      this.keyboard.remove("move");
      // TODO: render game over
    }
    this.renderer.render();
  }

  new_tile_pos() {
    return this.grid.empty_tiles().random();
  }

  new_tile_value() {
    return [2, 4].random();
  }

  new_tile() {
    let pos = this.new_tile_pos();
    if (pos == null) {
      return Game.GAME_OVER;
    }

    let val = this.new_tile_value();
    let tile = new Tile(pos.x, pos.y, val);
    this.grid.assign(tile, pos);
  }
}

const game = new Game();
game.setup();
