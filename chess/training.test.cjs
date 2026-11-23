const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./engine.js');
const training = require('./training.js')(engine);
const { KING, ROOK, PAWN, CANNON, RED, BLACK } = engine;
function position(pieces) {
  const board = Array(90).fill(0);
  board[4] = -KING; board[85] = KING; board[49] = PAWN;
  for (const [square, piece] of pieces) board[square] = piece;
  return board;
}
test('sandbox copies its root and isolates all moves from the real game', () => {
  const real = engine.initialBoard(), before = real.slice();
  const box = new training.Sandbox(real, RED);
  assert.notStrictEqual(box.current.board, real);
  assert.equal(box.play({ from: 54, to: 45 }), true);
  assert.equal(box.current.side, BLACK);
  assert.equal(box.play({ from: 27, to: 36 }), true);
  assert.deepEqual(real, before);
  assert.equal(box.current.depth, 2);
  box.back(); assert.equal(box.current.side, BLACK);
  box.reset(); assert.deepEqual(box.current.board, before);
  box.forward(); box.forward(); assert.equal(box.current.depth, 2);
});
test('sandbox retains branches, navigates them, and reuses an existing variation', () => {
  const box = new training.Sandbox(engine.initialBoard(), RED);
  box.play({ from: 54, to: 45 }); const first = box.current;
  box.back(); box.play({ from: 56, to: 47 }); const second = box.current;
  assert.equal(box.root.children.length, 2);
  box.reset(); box.forward(0); assert.strictEqual(box.current, first);
  box.reset(); box.forward(1); assert.strictEqual(box.current, second);
  box.reset(); box.play({ from: 54, to: 45 }); assert.strictEqual(box.current, first);
  assert.equal(box.root.children.length, 2);
});
test('sandbox rejects moving the wrong side and moves outside the rules', () => {
  const box = new training.Sandbox(engine.initialBoard(), BLACK);
  assert.equal(box.play({ from: 54, to: 45 }), false);
  assert.equal(box.play({ from: 27, to: 45 }), false);
  assert.equal(box.current.depth, 0);
  assert.equal(box.play({ from: 27, to: 36 }), true);
});
test('unprotected rook is reported with the actual attacking piece and board stays intact', () => {
  const board = position([[45, ROOK], [36, -ROOK]]), before = board.slice();
  const risks = training.threats(board, RED);
  const rook = risks.find(risk => risk.square === 45);
  assert.equal(rook.severity, 'hanging'); assert.equal(rook.from, 36);
  assert.deepEqual(board, before);
});
test('protected equal exchange is distinguished from hanging material', () => {
  const board = position([[45, ROOK], [36, -ROOK], [54, ROOK]]);
  assert.equal(training.threats(board, RED).find(risk => risk.square === 45).severity, 'attacked');
});
test('lower-valued attacker against a protected rook is an unfavorable immediate exchange', () => {
  const board = position([[45, ROOK], [36, -PAWN], [54, ROOK]]);
  assert.equal(training.threats(board, RED).find(risk => risk.square === 45).severity, 'exchange');
});
test('pinned attackers do not produce impossible capture warnings', () => {
  const board = position([[49, 0], [22, -ROOK], [76, ROOK], [23, CANNON]]);
  // The black rook shields its general from the red rook on file five.
  assert.equal(training.threats(board, RED).some(risk => risk.square === 23), false);
});
test('coaching produces a legal reference move and legal response without mutating the board', () => {
  const board = engine.initialBoard(), before = board.slice();
  const report = training.analyze(board, RED, {}, 60);
  assert.ok(engine.legalMoves(board, RED).some(move => move.from === report.move.from && move.to === report.move.to));
  assert.ok(report.reason.length > 5);
  engine.makeMove(board, report.move);
  assert.ok(engine.legalMoves(board, BLACK).some(move => move.from === report.reply.from && move.to === report.reply.to));
  assert.deepEqual(before, engine.initialBoard());
  const original = engine.initialBoard(); training.analyze(original, BLACK, {}, 40); assert.deepEqual(original, before);
});
test('coaching finds a legal defense when in check', () => {
  const board = position([[67, -ROOK], [49, 0]]), before = board.slice();
  const report = training.analyze(board, RED, {}, 50);
  assert.equal(report.checked, true); assert.ok(report.move);
  engine.makeMove(board, report.move);
  assert.equal(Boolean(engine.inCheck(board, RED)), false);
  assert.deepEqual(before, position([[67, -ROOK], [49, 0]]));
});
test('full analysis leaves its input unchanged even during a bounded search', () => {
  const board = position([[45, ROOK], [36, -ROOK], [54, ROOK]]), before = board.slice();
  training.analyze(board, RED, {}, 30);
  assert.deepEqual(board, before);
});
