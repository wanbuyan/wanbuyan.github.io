/* 中国象棋走棋规则和电脑搜索。数值的正负分别代表红方和黑方。 */
(function () {
  "use strict";

  function createEngine(createChallengeRules) {
    const RED = 1, BLACK = -1;
    const KING = 1, GUARD = 2, ELEPHANT = 3, HORSE = 4, ROOK = 5, CANNON = 6, PAWN = 7;
    const ISLAND = 90;
    const names = ["", "帅仕相马车炮兵", "将士象马车炮卒"];
    const files = "一二三四五六七八九";
    const values = [0, 0, 120, 120, 405, 940, 460, 95];
    const skillValues = [0, 0, 32, 48, 120, 145, 145, 72];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const jumps = [
      [-2, -1], [-2, 1], [2, -1], [2, 1],
      [-1, -2], [1, -2], [-1, 2], [1, 2]
    ];
    const levels = {
      easy: { depth: 1, time: 120 },
      normal: { depth: 3, time: 350 },
      hard: { depth: 6, time: 950 },
      challenge: { depth: 8, time: 1950 }
    };

    const row = square => Math.floor(square / 9);
    const col = square => square % 9;
    const squareAt = (r, c) => r * 9 + c;
    const inside = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
    const half = r => r < 5 ? BLACK : RED;
    const crossed = (r, side) => side === RED ? r < 5 : r >= 5;
    const palace = (r, c, side) => c >= 3 && c <= 5 && (side === RED ? r >= 7 && r < 10 : r >= 0 && r <= 2);
    const pieceName = piece => piece ? names[piece > 0 ? 1 : 2][Math.abs(piece) - 1] : "";
    const positionKey = (board, side, skills) => side + ":" + board.join(",") + (skills
      ? "|" + skills.levels.join("") + ":" + skills.pawnRange + ":" + skills.crossedPawns.join(",") +
        ":" + skills.horseRound % 2 + ":" + skills.drawIndex
      : "");
    const kingOnIsland = (board, side) => side === BLACK && board[ISLAND] === BLACK * KING;
    const rules = createChallengeRules({
      KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN, directions, diagonals, jumps,
      row, col, squareAt, inside, half, crossed, palace
    });
    const captureSquare = move => move.kind === "swap" ? -1 : move.hit ?? move.to;
    function materialValue(piece, skills) {
      const type = Math.abs(piece);
      const level = Math.sign(piece) === skills?.side ? skills.levels[type] : 0;
      return values[type] + level * skillValues[type];
    }

    function initialBoard() {
      const board = Array(90).fill(0);
      const backRank = [ROOK, HORSE, ELEPHANT, GUARD, KING, GUARD, ELEPHANT, HORSE, ROOK];
      backRank.forEach((piece, c) => {
        board[c] = -piece;
        board[81 + c] = piece;
      });
      for (const c of [1, 7]) {
        board[squareAt(2, c)] = -CANNON;
        board[squareAt(7, c)] = CANNON;
      }
      for (const c of [0, 2, 4, 6, 8]) {
        board[squareAt(3, c)] = -PAWN;
        board[squareAt(6, c)] = PAWN;
      }
      return board;
    }

    function pieceMoves(board, from, moves) {
      const piece = board[from];
      const side = Math.sign(piece);
      const type = Math.abs(piece);
      const r = row(from), c = col(from);
      function add(targetRow, targetCol) {
        if (!inside(targetRow, targetCol)) return;
        const to = squareAt(targetRow, targetCol);
        if (board[to] * side <= 0) moves.push({ from, to });
      }

      switch (type) {
        case KING:
        case GUARD: {
          // 附体后的士仍在原九宫活动。
          const palaceSide = type === KING ? side : half(r);
          for (const [dr, dc] of type === KING ? directions : diagonals) {
            if (palace(r + dr, c + dc, palaceSide)) add(r + dr, c + dc);
          }
          break;
        }
        case ELEPHANT:
          for (const [dr, dc] of diagonals) {
            if (half(r) === half(r + 2 * dr) && !board[squareAt(r + dr, c + dc)]) {
              add(r + 2 * dr, c + 2 * dc);
            }
          }
          break;
        case HORSE:
          for (const [dr, dc] of jumps) {
            const leg = squareAt(r + Math.trunc(dr / 2), c + Math.trunc(dc / 2));
            if (!board[leg]) add(r + dr, c + dc);
          }
          break;
        case ROOK:
        case CANNON:
          for (const [dr, dc] of directions) {
            let screen = false;
            for (let nr = r + dr, nc = c + dc; inside(nr, nc); nr += dr, nc += dc) {
              const to = squareAt(nr, nc);
              const target = board[to];
              if (type === ROOK) {
                if (target * side <= 0) moves.push({ from, to });
                if (target) break;
              } else if (screen) {
                if (target * side < 0) moves.push({ from, to });
                if (target) break;
              } else if (target) {
                screen = true;
              } else {
                moves.push({ from, to });
              }
            }
          }
          break;
        case PAWN:
          add(r - side, c);
          if (crossed(r, side)) {
            add(r, c - 1);
            add(r, c + 1);
          }
          break;
      }
    }

    function reportCheck(board, from, king, trace, via = null) {
      if (trace) {
        trace.from = from;
        trace.king = king;
        trace.path = via === null ? [from, king] : [from, via, king];
      }
      return board[from];
    }

    function checkingPiece(board, side, king = board.indexOf(side * KING), skills = null, trace = null) {
      if (king === ISLAND && side === BLACK) return 0;
      if (king < 0) return null;
      const r = row(king), c = col(king);
      const enemy = -side;

      // 第一枚棋子可能是车或对面的将，第二枚棋子可能是架炮后的炮。
      for (const [dr, dc] of directions) {
        let screen = -1;
        for (let nr = r + dr, nc = c + dc; inside(nr, nc); nr += dr, nc += dc) {
          const from = squareAt(nr, nc);
          const target = board[from] * enemy;
          if (!target) continue;
          if (screen >= 0) {
            if (target === CANNON) return reportCheck(board, from, king, trace, screen);
            break;
          }
          if (target === ROOK || (target === KING && dc === 0)) return reportCheck(board, from, king, trace);
          screen = from;
        }
      }

      for (const [dr, dc] of jumps) {
        const nr = r + dr, nc = c + dc;
        if (!inside(nr, nc) || board[squareAt(nr, nc)] !== enemy * HORSE) continue;
        const leg = squareAt(nr - Math.trunc(dr / 2), nc - Math.trunc(dc / 2));
        if (!board[leg]) return reportCheck(board, squareAt(nr, nc), king, trace, leg);
      }
      const front = squareAt(r + enemy, c);
      if (inside(r + enemy, c) && board[front] === enemy * PAWN) return reportCheck(board, front, king, trace);
      if (crossed(r, enemy)) {
        if (c > 0 && board[king - 1] === enemy * PAWN) return reportCheck(board, king - 1, king, trace);
        if (c < 8 && board[king + 1] === enemy * PAWN) return reportCheck(board, king + 1, king, trace);
      }
      // 被附体的士、相可能在将帅所在的半边。
      for (const [dr, dc] of diagonals) {
        const nr = r + dr, nc = c + dc;
        if (palace(nr, nc, side) && board[squareAt(nr, nc)] === enemy * GUARD) return reportCheck(board, squareAt(nr, nc), king, trace);
        const er = r + 2 * dr, ec = c + 2 * dc;
        if (inside(er, ec) && half(er) === half(r) && board[squareAt(er, ec)] === enemy * ELEPHANT && !board[squareAt(nr, nc)]) {
          return reportCheck(board, squareAt(er, ec), king, trace, squareAt(nr, nc));
        }
      }
      if (skills?.side === enemy) {
        const attacks = [];
        for (let from = 0; from < ISLAND; from++) {
          const piece = board[from];
          if (piece * enemy <= 0 || !skills.levels[Math.abs(piece)]) continue;
          rules.skillMoves(board, from, attacks, skills, king);
          const attack = attacks.find(move => captureSquare(move) === king);
          if (attack) {
            let via = null;
            if (trace && Math.abs(piece) === HORSE) {
              via = squareAt(row(from) + Math.trunc((r - row(from)) / 2), col(from) + Math.trunc((c - col(from)) / 2));
            } else if (attack.kind === "sweep" && attack.to !== king) {
              via = attack.to;
            }
            return reportCheck(board, from, king, trace, via);
          }
          attacks.length = 0;
        }
      }
      return 0;
    }

    function inCheck(board, side, king, skills) {
      return checkingPiece(board, side, king, skills) !== 0;
    }

    function conversionTargets(board, side, blocked = null) {
      const targets = [];
      for (let square = 0; square < board.length; square++) {
        const piece = board[square];
        if (piece * side >= 0) continue;
        if (Math.abs(piece) === KING) {
          if (square < ISLAND) blocked?.push({ move: { to: square, kind: "conversion" }, reason: "king-target" });
          continue;
        }
        board[square] = -piece;
        const threat = blocked ? {} : null;
        const attacker = checkingPiece(board, side, undefined, null, threat);
        board[square] = piece;
        if (attacker === 0) targets.push(square);
        else blocked?.push({ move: { to: square, kind: "conversion" }, reason: "check", attacker, threat });
      }
      return targets;
    }

    function makeMove(board, move) {
      const captured = board[move.to];
      board[move.to] = board[move.from];
      board[move.from] = 0;
      return captured;
    }

    function unmakeMove(board, move, captured) {
      board[move.from] = board[move.to];
      board[move.to] = captured;
    }

    function applyMove(board, move, skills = null) {
      const { from, to, kind } = move;
      const piece = board[from];
      const side = Math.sign(piece);
      const hit = captureSquare(move);
      const target = board[hit];
      const captured = target * side < 0 ? target : 0;
      const previous = skills && {
        pawnRange: skills.pawnRange, crossedPawns: skills.crossedPawns, horseRound: skills.horseRound
      };
      if (kind === "remote") {
        board[to] = 0;
      } else if (kind === "swap") {
        board[from] = board[to];
        board[to] = piece;
      } else {
        makeMove(board, move);
        if (hit !== to) board[hit] = 0;
      }

      if (skills?.levels[PAWN] === 1) {
        const pawn = skills.side * PAWN;
        const mover = piece === pawn;
        if (captured === pawn || mover) {
          const prior = skills.crossedPawns;
          const updated = prior.filter(square => square !== hit && (!mover || square !== from));
          if (mover && prior.includes(from)) skills.pawnRange = Math.min(3, skills.pawnRange + 1);
          if (mover && (prior.includes(from) || crossed(row(to), side))) updated.push(to);
          skills.crossedPawns = updated.sort((a, b) => a - b);
        }
      }
      if (skills?.levels[HORSE] === 2 && side !== skills.side) skills.horseRound++;
      return { captured, previous };
    }

    function revertMove(board, move, change, skills = null) {
      const { from, to, kind } = move;
      const { captured, previous } = change;
      if (kind === "remote") {
        board[to] = captured;
      } else if (kind === "swap") {
        [board[from], board[to]] = [board[to], board[from]];
      } else if (kind === "sweep" && move.hit !== to) {
        unmakeMove(board, move, 0);
        board[move.hit] = captured;
      } else {
        unmakeMove(board, move, captured);
      }
      if (skills && previous) Object.assign(skills, previous);
    }

    function checkAfterMove(board, side, king, move, skills, trace) {
      if (!skills) {
        const captured = makeMove(board, move);
        const attacker = checkingPiece(board, side, king === move.from ? move.to : king, null, trace);
        unmakeMove(board, move, captured);
        return attacker;
      }
      const change = applyMove(board, move, skills);
      const nextKing = move.kind === "swap" ? move.from : king === move.from ? move.to : king;
      const attacker = checkingPiece(board, side, nextKing, skills, trace);
      revertMove(board, move, change, skills);
      return attacker;
    }

    function legalMoves(board, side, from = null, firstOnly = false, skills = null, capturesOnly = false, blocked = null) {
      const moves = [];
      const candidates = [];
      const king = board.indexOf(side * KING);
      if (king < 0) return moves;
      const start = from ?? 0;
      const end = Math.min(from ?? ISLAND - 1, ISLAND - 1);
      for (let index = start; index <= end; index++) {
        if (board[index] * side <= 0) continue;
        candidates.length = 0;
        pieceMoves(board, index, candidates);
        if (skills) rules.skillMoves(board, index, candidates, skills);
        for (const move of candidates) {
          const hit = captureSquare(move);
          if (capturesOnly && !(board[hit] * side < 0)) continue;
          if (Math.abs(board[hit]) === KING) {
            blocked?.push({ move, reason: "king-target" });
            continue;
          }
          if (rules.hiddenHorse(board, hit, skills, side)) {
            blocked?.push({ move, reason: "hidden-horse" });
            continue;
          }
          const threat = blocked ? {} : null;
          const attacker = checkAfterMove(board, side, king, move, skills, threat);
          if (attacker !== 0) {
            blocked?.push({ move, reason: "check", attacker, threat });
            continue;
          }
          moves.push(move);
          if (firstOnly) return moves;
        }
      }
      return moves;
    }

    function inspectMoves(board, side, from, skills) {
      const blocked = [];
      const moves = legalMoves(board, side, from, false, skills, false, blocked);
      return { moves, blocked };
    }

    function findMateInOne(board, side) {
      const defender = -side;
      const king = board.indexOf(defender * KING);
      if (king < 0 || king === ISLAND) return null;
      for (const move of legalMoves(board, side)) {
        const captured = makeMove(board, move);
        const mate = inCheck(board, defender, king) && !legalMoves(board, defender, null, true).length;
        unmakeMove(board, move, captured);
        if (mate) return move;
      }
      return null;
    }

    // 仅解释玩家实际点到、且未能生成走法的常见受阻落点。
    function blockedPath(board, from, to, skills) {
      const piece = board[from];
      const side = Math.sign(piece), type = Math.abs(piece);
      const r = row(from), c = col(from);
      const dr = row(to) - r, dc = col(to) - c;
      const dy = Math.abs(dr), dx = Math.abs(dc);
      const level = side === skills?.side ? skills.levels[type] : 0;
      if (type === HORSE && dy + dx === 3 && dy && dx && level !== 1) {
        if (board[squareAt(r + Math.trunc(dr / 2), c + Math.trunc(dc / 2))]) return "马腿被挡，马无法走到这里。";
      }
      if (type === ELEPHANT && dy === 2 && dx === 2) {
        if (half(r) !== half(row(to))) return "相、象的落点必须留在原来的半场。";
        if (level !== 1 && board[squareAt(r + dr / 2, c + dc / 2)]) {
          return level === 2 ? "普通走相受相眼限制。犁庭扫穴可越过相眼，但田字格内需要有可吃的敌棋。" : "相眼被挡，相或象无法走到这里。";
        }
      }
      if (type === ROOK && level === 1 && board[to] * side < 0) return "随心所欲只用于瞬移到空位。车吃子须沿直线走。";
      if ((type === ROOK || type === CANNON) && (dy === 0) !== (dx === 0)) {
        let screens = 0;
        const stride = Math.sign(dr) * 9 + Math.sign(dc);
        for (let square = from + stride; square !== to; square += stride) {
          if (board[square]) screens++;
        }
        if (type === ROOK && screens) {
          if (level === 2 && board[to] * side < 0) return "飞车吃子需要隔着恰好一枚棋子，这条线上有 " + screens + " 枚。";
          return "车的移动路线上有棋子挡住。";
        }
        if (type === CANNON && !board[to] && screens) return "炮走到空位时，沿途必须畅通。";
        if (type === CANNON && board[to] * side < 0) {
          const allowed = level === 1 ? "一枚或两枚" : "恰好一枚";
          return "炮吃子需要隔着" + allowed + "棋子，这条线上有 " + screens + " 枚。";
        }
      }
      if (type === KING && dy + dx === 1 && !palace(row(to), col(to), side)) return "将帅只能在己方九宫内活动。";
      if (type === GUARD && (dy === 1 && dx === 1 || level && dy + dx === 1) && !palace(row(to), col(to), half(r))) {
        return "士、仕的落点必须留在原来的九宫。";
      }
      return "";
    }

    function notation(board, move) {
      const { from, to } = move;
      const piece = board[from];
      const side = Math.sign(piece);
      const number = n => side === RED ? files[n - 1] : String(n);
      const file = c => number(side === RED ? 9 - c : c + 1);
      const sameFile = [];
      for (let r = 0; r < 10; r++) {
        const index = squareAt(r, col(from));
        if (board[index] === piece) sameFile.push(index);
      }
      if (side === BLACK) sameFile.reverse();
      const index = sameFile.indexOf(from);
      let prefix = pieceName(piece) + file(col(from));
      if (sameFile.length === 2) prefix = (index === 0 ? "前" : "后") + pieceName(piece);
      if (sameFile.length === 3) prefix = ["前", "中", "后"][index] + pieceName(piece);
      if (sameFile.length > 3) prefix = (files[index] ?? String(index + 1)) + pieceName(piece);
      if (row(from) === row(to)) return prefix + "平" + file(col(to));
      const direction = (row(from) - row(to)) * side > 0 ? "进" : "退";
      return prefix + direction + (col(from) === col(to) ? number(Math.abs(row(from) - row(to))) : file(col(to)));
    }

    function evaluate(board, side, skills) {
      let score = 0;
      for (let index = 0; index < 90; index++) {
        const piece = board[index];
        if (!piece) continue;
        const owner = Math.sign(piece);
        const type = Math.abs(piece);
        const advance = owner === RED ? 9 - row(index) : row(index);
        const center = 4 - Math.abs(col(index) - 4);
        let placement = 0;
        switch (type) {
          case PAWN:
            placement = advance >= 5 ? 32 + center * 8 + Math.min(advance - 5, 3) * 9 : advance * 5;
            break;
          case HORSE:
            placement = center * 9 + Math.min(advance, 6) * 7 - (advance === 0 ? 15 : 0);
            break;
          case CANNON:
            placement = center * 5 + (advance >= 2 && advance <= 6 ? 12 : 0);
            break;
          case ROOK:
            placement = center * 4 + Math.min(advance, 7) * 5;
            break;
        }
        score += (materialValue(piece, skills) + placement) * owner;
      }
      return score * side;
    }

    function chooseMove(board, side, difficulty, repetitions = {}, skills = null, timeLimit = Infinity) {
      const level = levels[difficulty] ?? levels.normal;
      const deadline = Date.now() + Math.min(level.time, timeLimit);
      const mate = 100000;
      const timeout = Symbol("search deadline");
      const tactical = difficulty === "challenge";
      let nodes = 0;

      function orderedMoves(turn, capturesOnly = false) {
        const moves = legalMoves(board, turn, null, false, skills, capturesOnly);
        const priority = move => {
          const target = board[captureSquare(move)];
          return target * turn < 0 ? materialValue(target, skills) * 10 - materialValue(board[move.from], skills) : 0;
        };
        return moves.sort((a, b) => priority(b) - priority(a));
      }

      function search(turn, depth, alpha, beta, ply) {
        if ((++nodes & 31) === 0 && Date.now() >= deadline) throw timeout;
        if (depth <= 0 && (!tactical || depth <= -2)) {
          return kingOnIsland(board, turn) || legalMoves(board, turn, null, true, skills).length
            ? evaluate(board, turn, skills) : -mate + ply;
        }
        const quiet = depth <= 0 && !inCheck(board, turn, undefined, skills);
        let best = -Infinity;
        if (quiet) {
          if (!kingOnIsland(board, turn) && !legalMoves(board, turn, null, true, skills).length) return -mate + ply;
          best = evaluate(board, turn, skills);
          if (best >= beta) return best;
          alpha = Math.max(alpha, best);
        }
        const moves = orderedMoves(turn, quiet);
        if (!moves.length) {
          if (quiet) return best;
          if (kingOnIsland(board, turn)) return -search(-turn, depth - 1, -beta, -alpha, ply + 1);
          return -mate + ply;
        }
        for (const move of moves) {
          const change = applyMove(board, move, skills);
          let score;
          try {
            score = -search(-turn, depth - 1, -beta, -alpha, ply + 1);
          } finally {
            revertMove(board, move, change, skills);
          }
          best = Math.max(best, score);
          alpha = Math.max(alpha, best);
          if (alpha >= beta) break;
        }
        return best;
      }

      const moves = orderedMoves(side);
      if (!moves.length) return null;
      let best = moves[0];
      const randomBonus = moves.map(() => difficulty === "easy" ? Math.random() * 48 : 0);
      for (let depth = 1; depth <= level.depth && Date.now() < deadline; depth++) {
        let depthBest = best;
        let bestScore = -Infinity;
        const indices = [moves.indexOf(best), ...moves.map((_, index) => index).filter(index => moves[index] !== best)];
        try {
          for (const index of indices) {
            if (Date.now() >= deadline) throw timeout;
            const move = moves[index];
            const change = applyMove(board, move, skills);
            let score;
            try {
              const bonus = randomBonus[index];
              const visits = repetitions[positionKey(board, -side, skills)] ?? 0;
              const repeated = visits >= 2 && (kingOnIsland(board, -side) || legalMoves(board, -side, null, true, skills).length);
              score = repeated ? 0 : bonus - search(-side, depth - 1, -Infinity, bonus - bestScore, 1);
            } finally {
              revertMove(board, move, change, skills);
            }
            if (score > bestScore) {
              bestScore = score;
              depthBest = move;
            }
          }
        } catch (error) {
          if (error !== timeout) throw error;
          break;
        }
        best = depthBest;
        if (bestScore >= mate - depth) break;
      }
      return best;
    }

    return { RED, BLACK, KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN, ISLAND, row, col, pieceName, initialBoard, positionKey,
      kingOnIsland, inCheck, legalMoves, inspectMoves, blockedPath, conversionTargets, makeMove, unmakeMove, applyMove, revertMove,
      captureSquare, notation, chooseMove, findMateInOne, ...rules };
  }

  // 用 Blob 启动后台搜索，使双击 file:// 页面也能使用 Worker。
  function workerSource() {
    return 'const engine = (' + createEngine.toString() + ')(' + createChallengeRules.toString() + ');\n' +
      'self.onmessage = ({ data }) => {\n' +
      '  const { board, side, difficulty, repetitions, skills } = data;\n' +
      '  self.postMessage(engine.chooseMove(board, side, difficulty, repetitions, skills));\n' +
      '};';
  }

  const createChallengeRules = typeof module === "object" && module.exports
    ? require("./skills.js") : window.createChallengeRules;
  const engine = { ...createEngine(createChallengeRules), workerSource };
  if (typeof module === "object" && module.exports) module.exports = engine;
  else window.Xiangqi = engine;
})();
