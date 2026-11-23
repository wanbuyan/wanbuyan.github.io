const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const base = require('./engine.js');
const blind = require('./blind.js')(base);
const { RED, BLACK, KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN } = base;
const sorted = values => values.slice().sort((a,b)=>a-b);
function fixture(pieces = {}, secrets = {}) {
  const board = Array(90).fill(0); board[4] = -KING; board[85] = KING;
  Object.entries(pieces).forEach(([square,piece])=>board[square]=piece);
  const state = { hidden: Array(90).fill(false), identities: Array(90).fill(0), remaining: sorted(Object.values(secrets)) };
  Object.entries(secrets).forEach(([square,piece])=>{state.hidden[square]=true;state.identities[square]=piece;});
  return { board, state, engine: blind.createEngine(state) };
}
const can = (game,side,from,to) => game.engine.legalMoves(game.board,side,from).some(move=>move.to===to);
test('opening keeps the two kings, conceals exactly 30 pieces and shuffles the complete mixed inventory', () => {
  const state = blind.createState(()=>.23), board = base.initialBoard();
  assert.equal(state.hidden.filter(Boolean).length,30);
  assert.equal(state.hidden[4],false); assert.equal(state.hidden[85],false);
  assert.equal(board[4],-KING); assert.equal(board[85],KING);
  assert.deepEqual(sorted(state.identities.filter(Boolean)),sorted(board.filter(piece=>piece && Math.abs(piece)!==KING)));
  assert.ok(state.identities.some((piece,square)=>state.hidden[square] && piece*board[square]<0));
});
test('a covered piece uses its opening role and reveals after its first move, including enemy-color undercover pieces', () => {
  const game = fixture({54:PAWN},{54:-ROOK});
  assert.equal(can(game,RED,54,45),true);
  assert.equal(can(game,RED,54,55),false);
  const change = game.engine.applyMove(game.board,{from:54,to:45});
  assert.equal(change.revealed,-ROOK); assert.equal(game.board[45],-ROOK);
  assert.equal(game.state.hidden[45],false); assert.equal(game.state.remaining.length,0);
  assert.equal(game.engine.legalMoves(game.board,RED,45).length,0);
  assert.ok(game.engine.legalMoves(game.board,BLACK,45).length>0);
});
test('only covered pieces in the actor own half may be moved and exposed', () => {
  const game = fixture({27:ROOK,54:-ROOK},{27:PAWN,54:-PAWN});
  assert.equal(game.engine.legalMoves(game.board,RED,27).length,0);
  assert.equal(game.engine.legalMoves(game.board,BLACK,54).length,0);
});
test('covered movers may capture friendly revealed pieces; revealed movers may capture friendly covered pieces', () => {
  const covered = fixture({81:ROOK,72:PAWN},{81:-PAWN});
  assert.equal(can(covered,RED,81,72),true);
  const revealed = fixture({81:ROOK,72:PAWN});
  assert.equal(can(revealed,RED,81,72),false);
  const targetCovered = fixture({81:ROOK,72:PAWN},{72:HORSE});
  assert.equal(can(targetCovered,RED,81,72),true);
});
test('capturing an unknown friendly or enemy identity reveals the correct captured piece and undo restores both secrets', () => {
  const game = fixture({81:ROOK,72:PAWN},{81:-CANNON,72:HORSE});
  const board = game.board.slice(), state = structuredClone(game.state);
  const change = game.engine.applyMove(game.board,{from:81,to:72});
  assert.equal(change.captured,HORSE); assert.equal(change.revealed,-CANNON);
  assert.deepEqual(game.state.remaining,[]);
  game.engine.revertMove(game.board,{from:81,to:72},change);
  assert.deepEqual(game.board,board); assert.deepEqual(game.state,state);
});
test('kings can jump across their own palace, including blocked intermediate squares, and cannot leave it', () => {
  const game = fixture({76:PAWN});
  assert.equal(can(game,RED,85,67),true);
  assert.equal(can(game,RED,85,66),true);
  assert.equal(can(game,RED,85,58),false);
  assert.equal(can(game,BLACK,4,23),true);
  assert.equal(can(game,BLACK,4,32),false);
});
test('revealed guards cross the river diagonally; covered guard roles remain in the palace', () => {
  const open = fixture({49:GUARD});
  assert.equal(can(open,RED,49,39),true);
  const covered = fixture({49:GUARD},{49:ROOK});
  assert.equal(can(covered,RED,49,39),false);
});
test('revealed elephants cross the river but still obey elephant eyes and two-step diagonal moves', () => {
  assert.equal(can(fixture({58:ELEPHANT}),RED,58,38),true);
  assert.equal(can(fixture({58:ELEPHANT,48:PAWN}),RED,58,38),false);
  assert.equal(can(fixture({58:ELEPHANT}),RED,58,28),false);
  assert.equal(can(fixture({58:ELEPHANT},{58:ROOK}),RED,58,38),false);
});
test('red and black pawns never retreat, with sideways moves only after crossing', () => {
  const red = fixture({40:PAWN});
  assert.equal(can(red,RED,40,31),true); assert.equal(can(red,RED,40,39),true); assert.equal(can(red,RED,40,49),false);
  const black = fixture({49:-PAWN});
  assert.equal(can(black,BLACK,49,58),true); assert.equal(can(black,BLACK,49,48),true); assert.equal(can(black,BLACK,49,40),false);
  assert.equal(can(fixture({54:PAWN}),RED,54,55),false);
});
test('cannons need exactly one screen for friendly fire and still stop at the first target beyond it', () => {
  const game = fixture({64:CANNON,55:PAWN,46:HORSE,37:-ROOK},{64:PAWN});
  assert.equal(can(game,RED,64,46),true);
  assert.equal(can(game,RED,64,55),false);
  assert.equal(can(game,RED,64,37),false);
  assert.equal(can(fixture({64:CANNON,55:PAWN,46:HORSE}),RED,64,46),false);
});
test('king capture, including self-inflicted king capture, is legal and ordinary check does not constrain moves', () => {
  assert.equal(can(fixture({40:ROOK}),RED,40,4),true);
  assert.equal(can(fixture({81:ROOK},{81:-PAWN}),RED,81,85),true);
  assert.equal(can(fixture({67:-ROOK,54:PAWN}),RED,54,45),true);
});
test('AI public data is identical for different secret layouts; inventory order cannot leak the layout', () => {
  const a = blind.createState(()=>.01), b = blind.createState(()=>.99);
  assert.notDeepEqual(a.identities,b.identities);
  assert.deepEqual(blind.publicState(a),blind.publicState(b));
  assert.deepEqual(Object.keys(blind.publicState(a)),['hidden','remaining']);
  const board = base.initialBoard();
  assert.deepEqual(blind.choosePublicMove(board,BLACK,blind.publicState(a),'easy',1234),blind.choosePublicMove(board,BLACK,blind.publicState(b),'easy',1234));
});
test('computer takes a visible enemy king and receives no real secret mapping in the Worker', () => {
  const game = fixture({40:ROOK});
  assert.deepEqual(blind.choosePublicMove(game.board,RED,blind.publicState(game.state),'easy',123),{from:40,to:4});
  let choice;
  const self = { postMessage: value => {choice=value;} };
  vm.runInNewContext(game.engine.workerSource(), { self, performance, Date, Math });
  const data = { board: game.board,side:RED,blind:blind.publicState(game.state),difficulty:'easy' };
  self.onmessage({data});
  assert.deepEqual(JSON.parse(JSON.stringify(choice)),{from:40,to:4});
  assert.equal('identities' in data.blind,false);
});
test('a complete sequence conserves pieces and reversing every move restores the exact shuffled game', () => {
  const board = base.initialBoard(), state = blind.createState(()=>.42), originalBoard=board.slice(), originalState=structuredClone(state);
  const engine = blind.createEngine(state), record=[];
  const total = sorted(originalState.remaining);
  const captured = [];
  for(let i=0;i<100 && board.includes(KING) && board.includes(-KING);i++) {
    const legal = engine.legalMoves(board,i%2===0?RED:BLACK);
    if(!legal.length) break;
    const move = legal[(i*17+9)%legal.length],change=engine.applyMove(board,move);
    record.push({move,change});
    if(change.captured && Math.abs(change.captured)!==KING)captured.push(change.captured);
    const exposed = board.filter((piece,square)=>piece && Math.abs(piece)!==KING && !state.hidden[square]);
    assert.deepEqual(sorted([...state.remaining,...exposed,...captured]),total);
  }
  assert.ok(record.length>0);
  for(const {move,change} of record.reverse())engine.revertMove(board,move,change);
  assert.deepEqual(board,originalBoard); assert.deepEqual(state,originalState);
  assert.deepEqual(base.initialBoard(),originalBoard);
});
