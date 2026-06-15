let code = require('fs').readFileSync('2048.js', 'utf8');
code = code.replace('class Tile', 'global.Tile = class Tile');
code = code.replace('class Direction', 'global.Direction = class Direction');
code = code.replace('class Cell', 'global.Cell = class Cell');
code = code.replace('const game = new Game();', 'global.game = new Game();');
// Mock document and window
global.document = {
  querySelector: () => ({ classList: { add: () => {} }, appendChild: () => {}, removeChild: () => {} }),
  addEventListener: () => {},
  createElement: () => ({ classList: { add: () => {} }, querySelector: () => ({}), appendChild: () => {}, setAttribute: () => {} })
};
global.window = {
  requestAnimationFrame: (cb) => cb()
};

eval(code);

let tile = new Tile(0, 0, 2);
console.log(tile.cell);
let c = tile.cell.next(Direction.Right);
console.log(c);
