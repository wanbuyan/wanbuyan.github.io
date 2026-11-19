/* 挑战模式技能表及额外走法，供页面和后台棋力搜索共用。 */
(function () {
  "use strict";

  function createChallengeRules({ KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN, directions, diagonals, jumps, row, col, squareAt, inside, half, crossed, palace }) {
    const cards = {
      [PAWN]: [
        ["反复横跳", "过河后可前后左右往返。步长初始为一格，己方兵卒过河后每走一手，全类共享步长加一，最多三格。"],
        ["足力健", "可向前或斜前走一至两格，过河后也可横走一至两格，沿途不能跨子。"]
      ],
      [CANNON]: [
        ["隔山山打牛", "新增隔着恰好两枚棋子吃子的走法。"],
        ["穿山打牛", "隔一枚炮架远击敌棋，炮留在原位。"]
      ],
      [GUARD]: [
        ["踢正步", "可在九宫内横走或竖走一格。"],
        ["移形换影", "可在九宫内横走或竖走一格，也可与己方将帅换位。"]
      ],
      [ROOK]: [
        ["随心所欲", "车可以瞬移到棋盘任意空位。沿原有直线路线仍可正常吃子。"],
        ["飞车", "车可以沿同一行或列，隔着恰好一枚棋子跳到敌棋所在格吃子。"]
      ],
      [ELEPHANT]: [
        ["宰相的眼睛能乘船", "相眼被挡时也能斜走两格，仍受河界限制。"],
        ["犁庭扫穴", "发动扫穴时可无视相眼，斜走两格并吃掉由起点和落点围成的田字格内一枚敌棋，落点仍受河界限制。"]
      ],
      [HORSE]: [
        ["飞马", "马腿被挡时也能走日字。"],
        ["电棍之马", "获得后从第一个电脑回合起，隔一个电脑回合隐身。隐身马仍占格，免疫吃子和远击。"]
      ]
    };
    const drawValues = { [PAWN]: 1, [GUARD]: 2, [ELEPHANT]: 2, [HORSE]: 4, [CANNON]: 5, [ROOK]: 9 };

    function drawGap(board, side) {
      let pieces = 0;
      let material = 0;
      for (const piece of board) {
        const value = drawValues[Math.abs(piece)];
        if (!value) continue;
        const direction = piece * side < 0 ? 1 : -1;
        pieces += direction;
        material += direction * value;
      }
      return { pieces, material };
    }

    function createSkills(side, seed = 0) {
      return { side, seed, levels: Array(8).fill(0), pawnRange: 1, crossedPawns: [], horseRound: 0, drawIndex: 0 };
    }

    function grantSkill(board, skills, type, level) {
      skills.levels[type] = level;
      if (type === PAWN && level === 1) {
        skills.crossedPawns = board.flatMap((piece, index) =>
          piece === skills.side * PAWN && crossed(row(index), skills.side) ? [index] : []);
      }
    }

    function hiddenHorse(board, square, skills, turn) {
      return Boolean(skills && turn === -skills.side && skills.levels[HORSE] === 2 &&
        skills.horseRound % 2 === 0 && board[square] === skills.side * HORSE);
    }

    function skillMoves(board, from, moves, skills, kingTarget = null) {
      const piece = board[from];
      const side = Math.sign(piece), type = Math.abs(piece);
      const level = skills.levels[type];
      if (!level || side !== skills.side) return;
      const r = row(from), c = col(from);
      const skill = cards[type][level - 1][0];
      function add(nr, nc, extra = {}) {
        if (!inside(nr, nc)) return;
        const to = squareAt(nr, nc);
        if (kingTarget !== null && to !== kingTarget) return;
        if (board[to] * side <= 0) moves.push({ from, to, skill, ...extra });
      }

      if (type === PAWN) {
        const roaming = level === 1 && skills.crossedPawns.includes(from);
        if (level === 1 && !roaming) return;
        const steps = roaming ? directions : [[-side, 0], [-side, -1], [-side, 1]];
        if (level === 2 && crossed(r, side)) steps.push([0, -1], [0, 1]);
        const range = roaming ? skills.pawnRange : 2;
        if (kingTarget !== null && Math.max(Math.abs(row(kingTarget) - r), Math.abs(col(kingTarget) - c)) > range) return;
        for (const [dr, dc] of steps) {
          for (let step = 1; step <= range; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (!inside(nr, nc)) break;
            const ordinary = step === 1 && (dr === -side && dc === 0 || dr === 0 && crossed(r, side));
            if (!ordinary) add(nr, nc);
            if (board[squareAt(nr, nc)]) break;
          }
        }
      } else if (type === HORSE && level === 1) {
        if (kingTarget !== null && (Math.abs(row(kingTarget) - r) + Math.abs(col(kingTarget) - c) !== 3 ||
            row(kingTarget) === r || col(kingTarget) === c)) return;
        for (const [dr, dc] of jumps) {
          const leg = squareAt(r + Math.trunc(dr / 2), c + Math.trunc(dc / 2));
          if (board[leg]) add(r + dr, c + dc);
        }
      } else if (type === CANNON || type === ROOK && level === 2) {
        if (kingTarget !== null && (type === CANNON && level === 2 || row(kingTarget) !== r && col(kingTarget) !== c)) return;
        const screenCount = type === CANNON && level === 1 ? 2 : 1;
        for (const [dr, dc] of directions) {
          let screens = 0;
          let firstScreen;
          for (let nr = r + dr, nc = c + dc; inside(nr, nc); nr += dr, nc += dc) {
            const target = board[squareAt(nr, nc)];
            if (!target) continue;
            if (screens === screenCount) {
              if (target * side < 0) {
                if (type === ROOK) add(nr, nc, { kind: "flying-rook", screen: firstScreen });
                else add(nr, nc, level === 2 ? { kind: "remote" } : {});
              }
              break;
            }
            if (screens === 0) firstScreen = squareAt(nr, nc);
            screens++;
          }
        }
      } else if (type === GUARD && kingTarget === null) {
        for (const [dr, dc] of directions) {
          if (palace(r + dr, c + dc, half(r))) add(r + dr, c + dc);
        }
        if (level === 2) {
          const king = board.indexOf(side * KING);
          if (king >= 0 && palace(row(king), col(king), half(r))) moves.push({ from, to: king, kind: "swap", skill });
        }
      } else if (type === ELEPHANT) {
        if (kingTarget !== null && (half(r) !== half(row(kingTarget)) ||
            Math.max(Math.abs(row(kingTarget) - r), Math.abs(col(kingTarget) - c)) > 2)) return;
        for (const [dr, dc] of diagonals) {
          const nr = r + 2 * dr, nc = c + 2 * dc;
          if (!inside(nr, nc) || half(nr) !== half(r)) continue;
          if (level === 1) {
            if (board[squareAt(r + dr, c + dc)]) add(nr, nc);
          } else {
            const to = squareAt(nr, nc);
            if (board[to] * side > 0) continue;
            for (let dy = 0; dy <= 2; dy++) {
              for (let dx = 0; dx <= 2; dx++) {
                const hit = squareAt(r + dr * dy, c + dc * dx);
                if ((kingTarget === null || hit === kingTarget) && board[hit] * side < 0 && (!board[to] || hit === to)) {
                  moves.push({ from, to, hit, kind: "sweep", skill });
                }
              }
            }
          }
        }
      } else if (type === ROOK && level === 1 && kingTarget === null) {
        const ordinary = new Set(moves.map(move => move.to));
        for (let to = 0; to < 90; to++) {
          if (!board[to] && !ordinary.has(to)) moves.push({ from, to, kind: "teleport", skill });
        }
      }
    }

    return { cards, createSkills, grantSkill, hiddenHorse, skillMoves, drawGap };
  }

  if (typeof module === "object" && module.exports) module.exports = createChallengeRules;
  else window.createChallengeRules = createChallengeRules;
})();
