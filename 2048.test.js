const { Cell, Direction, Tile, Grid, EMPTY_TILE, OUTBOUND } = require('./2048.js');

describe('Direction', () => {
  test('direction mapping', () => {
    expect(Direction.Up.direction()).toEqual({ x: 0, y: -1 });
    expect(Direction.Right.direction()).toEqual({ x: 1, y: 0 });
    expect(Direction.Down.direction()).toEqual({ x: 0, y: 1 });
    expect(Direction.Left.direction()).toEqual({ x: -1, y: 0 });
  });

  test('is_verticle and is_horizontal', () => {
    expect(Direction.Up.is_verticle()).toBe(true);
    expect(Direction.Down.is_verticle()).toBe(true);
    expect(Direction.Left.is_verticle()).toBe(false);
    expect(Direction.Right.is_verticle()).toBe(false);

    expect(Direction.Left.is_horizontal()).toBe(true);
    expect(Direction.Right.is_horizontal()).toBe(true);
    expect(Direction.Up.is_horizontal()).toBe(false);
    expect(Direction.Down.is_horizontal()).toBe(false);
  });

  test('increment', () => {
    expect(Direction.Up.increment()).toBe(1);
    expect(Direction.Left.increment()).toBe(1);
    expect(Direction.Down.increment()).toBe(-1);
    expect(Direction.Right.increment()).toBe(-1);
  });
});

describe('Cell', () => {
  test('initialization', () => {
    const cell = new Cell(1, 2, 4);
    expect(cell.x).toBe(1);
    expect(cell.y).toBe(2);
    expect(cell.size).toBe(4);
  });

  test('is_outbound', () => {
    expect(new Cell(0, 0, 4).is_outbound()).toBe(false);
    expect(new Cell(3, 3, 4).is_outbound()).toBe(false);
    expect(new Cell(-1, 0, 4).is_outbound()).toBe(true);
    expect(new Cell(0, -1, 4).is_outbound()).toBe(true);
    expect(new Cell(4, 0, 4).is_outbound()).toBe(true);
    expect(new Cell(0, 4, 4).is_outbound()).toBe(true);
  });

  test('next', () => {
    const cell = new Cell(1, 1, 4);

    // Test horizontal
    const nextLeft = cell.next(Direction.Left);
    expect(nextLeft.x).toBe(1);
    expect(nextLeft.y).toBe(2); // cell.y + dir.increment() (1)

    const nextRight = cell.next(Direction.Right);
    expect(nextRight.x).toBe(1);
    expect(nextRight.y).toBe(0); // cell.y + dir.increment() (-1)

    // Test vertical
    const nextUp = cell.next(Direction.Up);
    expect(nextUp.x).toBe(2); // cell.x + dir.increment() (1)
    expect(nextUp.y).toBe(1);

    const nextDown = cell.next(Direction.Down);
    expect(nextDown.x).toBe(0); // cell.x + dir.increment() (-1)
    expect(nextDown.y).toBe(1);
  });

  test('next returns null if current is outbound', () => {
    const cell = new Cell(-1, 0, 4);
    expect(cell.next(Direction.Left)).toBeNull();
  });
});


describe('Tile', () => {
  test('initialization', () => {
    const tile = new Tile(1, 2, 4);
    expect(tile.cell.x).toBe(1);
    expect(tile.cell.y).toBe(2);
    expect(tile.value).toBe(4);
    expect(tile.previous).toBeNull();
  });

  test('update', () => {
    const tile = new Tile(1, 2, 4);
    tile.update(3, 4);
    expect(tile.cell.x).toBe(3);
    expect(tile.cell.y).toBe(4);
    expect(tile.previous.x).toBe(1);
    expect(tile.previous.y).toBe(2);
  });

  test('can_merge', () => {
    const tile1 = new Tile(0, 0, 4);
    const tile2 = new Tile(0, 1, 4);
    const tile3 = new Tile(1, 0, 8);

    expect(tile1.can_merge(null)).toBe(false);
    expect(tile1.can_merge(tile2)).toBe(true);
    expect(tile1.can_merge(tile3)).toBe(false);
  });

  test('merge', () => {
    const tile1 = new Tile(0, 0, 4);
    const tile2 = new Tile(0, 1, 4);

    tile1.merge(tile2);
    expect(tile1.value).toBe(8);
    expect(tile2.value).toBe(0);
  });
});

describe('Grid', () => {
  test('initialization', () => {
    const grid = new Grid(4);
    expect(grid.size).toBe(4);
    expect(grid.grid.length).toBe(4);
    expect(grid.grid[0].length).toBe(4);
    expect(grid.grid[0][0]).toBeNull();
  });

  test('assign and unassign', () => {
    const grid = new Grid(4);
    const tile = new Tile(0, 0, 2);
    const cell = new Cell(1, 1, 4);

    grid.assign(tile, cell);
    expect(grid.grid[1][1]).toBe(tile);
    expect(tile.cell).toBe(cell);

    grid.unassign(tile);
    expect(grid.grid[1][1]).toBeNull();
  });

  test('empty_tiles', () => {
    const grid = new Grid(4);
    let emptyTiles = grid.empty_tiles();
    expect(emptyTiles.length).toBe(16);

    grid.assign(new Tile(0, 0, 2), new Cell(0, 0, 4));
    emptyTiles = grid.empty_tiles();
    expect(emptyTiles.length).toBe(15);
  });

  test('move logic', () => {
    const grid = new Grid(4);

    // Setup a scenario
    // [2, 2, 0, 0]
    // [0, 0, 0, 0]
    // [0, 0, 0, 0]
    // [0, 0, 0, 0]
    const tile1 = new Tile(0, 0, 2);
    const tile2 = new Tile(0, 1, 2);
    grid.assign(tile1, new Cell(0, 0, 4));
    grid.assign(tile2, new Cell(0, 1, 4));

    // Move Left
    let moved = grid.move(Direction.Left);
    expect(moved).toBe(true);

    // Result should be:
    // [4, 0, 0, 0]
    // [0, 0, 0, 0]
    // [0, 0, 0, 0]
    // [0, 0, 0, 0]
    expect(grid.grid[0][0].value).toBe(4);
    expect(grid.grid[0][1]).toBeNull();

    // Move again shouldn't move anything
    moved = grid.move(Direction.Left);
    expect(moved).toBe(false);

    // Setup another scenario
    const grid2 = new Grid(4);
    grid2.assign(new Tile(0, 0, 2), new Cell(0, 0, 4));
    grid2.assign(new Tile(1, 0, 4), new Cell(1, 0, 4));
    grid2.assign(new Tile(2, 0, 2), new Cell(2, 0, 4));

    // Move Up
    moved = grid2.move(Direction.Up);
    expect(moved).toBe(false);

    // Test merging 3 tiles of same value
    const grid3 = new Grid(4);
    grid3.assign(new Tile(0, 0, 2), new Cell(0, 0, 4));
    grid3.assign(new Tile(0, 1, 2), new Cell(0, 1, 4));
    grid3.assign(new Tile(0, 2, 2), new Cell(0, 2, 4));

    // Move Right
    grid3.move(Direction.Right);

    // Result should be:
    // [0, 2, 0, 4]
    expect(grid3.grid[0][1].value).toBe(2);
    expect(grid3.grid[0][3].value).toBe(4);
  });
});
