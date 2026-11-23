/* 盲棋独立规则。board 只存公开身份，identities 仅用于实际落子后的揭示。 */
(function (root) {
  "use strict";
  function createBlindChess(base) {
    const { KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN, RED, BLACK } = base;
    const row = square => Math.floor(square / 9), col = square => square % 9;
    const inside = (r,c) => r >= 0 && r < 10 && c >= 0 && c < 9;
    const home = (square,side) => side === RED ? row(square) >= 5 : row(square) < 5;
    const palace = (r,c,side) => c >= 3 && c <= 5 && (side === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
    const orthogonal = [[1,0],[-1,0],[0,1],[0,-1]];
    const diagonals = [[1,1],[1,-1],[-1,1],[-1,-1]];
    const jumps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    const values = [0,100000,240,260,440,940,460,110];

    function createState(random = Math.random) {
      const initial = base.initialBoard();
      const pieces = initial.filter(piece => piece && Math.abs(piece) !== KING);
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pieces[i],pieces[j]] = [pieces[j],pieces[i]];
      }
      let index = 0;
      return {
        hidden: initial.map(piece => Boolean(piece && Math.abs(piece) !== KING)),
        identities: initial.map(piece => piece && Math.abs(piece) !== KING ? pieces[index++] : 0),
        remaining: pieces.slice().sort((a,b) => a-b)
      };
    }

    function moves(position, side, hidden, from = null, firstOnly = false, capturesOnly = false) {
      if (!position.includes(side * KING)) return [];
      const result = [];
      const start = from ?? 0, end = from ?? 89;
      for (let square = start; square <= end; square++) {
        const piece = position[square];
        if (piece * side <= 0 || hidden[square] && !home(square,side)) continue;
        const r = row(square), c = col(square), type = Math.abs(piece), covered = hidden[square];
        const canLand = to => !position[to] || covered || hidden[to] || position[to] * side < 0;
        function add(nr,nc) {
          if (!inside(nr,nc)) return;
          const to = nr * 9 + nc;
          if (canLand(to) && (!capturesOnly || position[to])) result.push({ from: square, to });
        }
        switch (type) {
          case KING:
            for (let nr = side === RED ? 7 : 0; nr < (side === RED ? 10 : 3); nr++) for (let nc = 3; nc <= 5; nc++) {
              if (nr !== r || nc !== c) add(nr,nc);
            }
            break;
          case GUARD:
            for (const [dr,dc] of diagonals) if (!covered || palace(r+dr,c+dc,side)) add(r+dr,c+dc);
            break;
          case ELEPHANT:
            for (const [dr,dc] of diagonals) if (inside(r+2*dr,c+2*dc) && !position[(r+dr)*9+c+dc] && (!covered || home((r+2*dr)*9+c+2*dc,side))) add(r+2*dr,c+2*dc);
            break;
          case HORSE:
            for (const [dr,dc] of jumps) if (inside(r+dr,c+dc) && !position[(r+Math.trunc(dr/2))*9+c+Math.trunc(dc/2)]) add(r+dr,c+dc);
            break;
          case ROOK:
          case CANNON:
            for (const [dr,dc] of orthogonal) {
              let screen = false;
              for (let nr=r+dr,nc=c+dc; inside(nr,nc); nr+=dr,nc+=dc) {
                const to = nr*9+nc, target = position[to];
                if (type === ROOK) { add(nr,nc); if (target) break; }
                else if (screen) { if (target) { if (canLand(to)) add(nr,nc); break; } }
                else if (target) screen = true;
                else add(nr,nc);
              }
            }
            break;
          case PAWN:
            add(r-side,c);
            if (!home(square,side)) { add(r,c-1); add(r,c+1); }
            break;
        }
        if (firstOnly && result.length) return [result[0]];
      }
      return result;
    }

    function removePiece(pool,piece) { const i = pool.indexOf(piece); if (i >= 0) pool.splice(i,1); }
    function publicState(state) { return { hidden: state.hidden.slice(), remaining: state.remaining.slice().sort((a,b) => a-b) }; }

    // 此函数只接受公开信息，无法读取真实暗子分布。
    function choosePublicMove(position, side, information, difficulty = "normal", seed = Date.now(), timeLimit = Infinity) {
      const options = moves(position,side,information.hidden);
      if (!options.length) return null;
      const samples = { easy: 2, normal: 7, hard: 18 }[difficulty] ?? 7;
      const deadline = performance.now() + Math.min(timeLimit, difficulty === "hard" ? 500 : 220);
      let randomState = seed >>> 0;
      const random = () => { randomState = (Math.imul(randomState,1664525)+1013904223) >>> 0; return randomState / 4294967296; };
      const scores = options.map(() => 0), counts = options.map(() => 0);
      function take(pool, fallback) { if (!pool.length) return fallback; return pool.splice(Math.floor(random()*pool.length),1)[0]; }
      function evaluate(board,hidden) {
        if (!board.includes(side* KING)) return -1000000;
        if (!board.includes(-side* KING)) return 1000000;
        let score = 0;
        for (let square=0;square<90;square++) {
          const piece = board[square];
          if (!piece) continue;
          const value = hidden[square] ? 150 : values[Math.abs(piece)];
          score += Math.sign(piece) * side * value;
        }
        let risk = 0;
        for (const reply of moves(board,-side,hidden,null,false,true)) {
          const target = board[reply.to];
          if (target === side* KING) return score - 180000;
          if (!hidden[reply.to] && target*side>0) risk = Math.max(risk,values[Math.abs(target)]);
        }
        return score - risk*.65;
      }
      for (let sample=0;sample<samples;sample++) for (let i=0;i<options.length;i++) {
        if (sample > 0 && performance.now() > deadline) break;
        const move = options[i], board = position.slice(), hidden = information.hidden.slice(), remaining = information.remaining.slice();
        const target = hidden[move.to] ? take(remaining,board[move.to]) : board[move.to];
        const mover = hidden[move.from] ? take(remaining,board[move.from]) : board[move.from];
        if (board[move.to] === -side* KING) return move;
        board[move.to] = mover; board[move.from] = 0;
        const revealed = hidden[move.from];
        hidden[move.from] = hidden[move.to] = false;
        let score = evaluate(board,hidden);
        if (target) score -= Math.sign(target)*side*values[Math.abs(target)]*.1;
        if (revealed) score += 190;
        score += 4 - Math.abs(col(move.to)-4);
        scores[i] += score; counts[i]++;
      }
      let best = 0, bestScore = -Infinity;
      for (let i=0;i<options.length;i++) {
        const score = counts[i] ? scores[i]/counts[i] + random() * (difficulty === "easy" ? 45 : 2) : -Infinity;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return options[best];
    }

    function createEngine(state) {
      function applyMove(board,move) {
        const { from,to } = move;
        const change = {
          actor: Math.sign(board[from]), movingPiece: board[from], originalCaptured: board[to],
          sourceHidden: state.hidden[from], targetHidden: state.hidden[to],
          sourceIdentity: state.identities[from], targetIdentity: state.identities[to],
          previousRemaining: state.remaining.slice()
        };
        change.captured = change.targetHidden ? state.identities[to] : board[to];
        change.revealed = change.sourceHidden ? state.identities[from] : 0;
        if (change.targetHidden) removePiece(state.remaining,change.captured);
        if (change.sourceHidden) removePiece(state.remaining,change.revealed);
        board[to] = change.revealed || board[from]; board[from] = 0;
        state.hidden[from] = state.hidden[to] = false;
        state.identities[from] = state.identities[to] = 0;
        return change;
      }
      function revertMove(board,move,change) {
        board[move.from] = change.movingPiece; board[move.to] = change.originalCaptured;
        state.hidden[move.from] = change.sourceHidden; state.hidden[move.to] = change.targetHidden;
        state.identities[move.from] = change.sourceIdentity; state.identities[move.to] = change.targetIdentity;
        state.remaining = change.previousRemaining.slice();
      }
      const legalMoves = (board,side,from=null,firstOnly=false,skills=null,capturesOnly=false) => moves(board,side,state.hidden,from,firstOnly,capturesOnly);
      return { ...base, applyMove, revertMove, legalMoves,
        inCheck: () => false,
        inspectMoves: (board,side,from) => ({ moves: legalMoves(board,side,from), blocked: [] }),
        blockedPath: () => "此步不符合当前棋子的走法。暗子按开局棋位走，明子按翻开的身份走。",
        positionKey: (board,side) => side + ":" + board.join(",") + "|blind:" + state.hidden.map(Number).join(""),
        chooseMove: (board,side,difficulty,repetitions,skills,timeLimit) => choosePublicMove(board,side,publicState(state),difficulty,Date.now(),timeLimit),
        workerSource: () => base.workerSource() + "\nconst blindRules = (" + createBlindChess.toString() + ")(engine);\nself.onmessage = ({data}) => self.postMessage(blindRules.choosePublicMove(data.board,data.side,data.blind,data.difficulty));"
      };
    }
    return { createState, createEngine, publicState, choosePublicMove, moves, home };
  }
  if (typeof module === "object" && module.exports) module.exports = createBlindChess;
  else root.createBlindChess = createBlindChess;
})(typeof window === "object" ? window : globalThis);
