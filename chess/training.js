/* 普通象棋的练习分析与独立推演树。浏览器和 Node 共用。 */
(function (root) {
  "use strict";
  function createTraining(engine) {
    const value = [0, 10000, 120, 120, 405, 940, 460, 95];
    function threats(position, side) {
      const board = position.slice();
      const attacks = engine.legalMoves(board, -side, null, false, null, true);
      const grouped = new Map();
      for (const move of attacks) {
        const piece = board[move.to], attacker = board[move.from];
        const captured = engine.makeMove(board, move);
        const recaptures = engine.legalMoves(board, side, null, false, null, true).filter(reply => reply.to === move.to);
        engine.unmakeMove(board, move, captured);
        const severity = !recaptures.length ? "hanging" : value[Math.abs(piece)] > value[Math.abs(attacker)] ? "exchange" : "attacked";
        const threat = { square: move.to, from: move.from, piece, attacker, severity, move,
          reason: !recaptures.length ? "被吃后没有合法的立即回吃" : severity === "exchange" ? "对手可用低价值棋子换取它" : "有棋子可以立即回吃" };
        const rank = { hanging: 3, exchange: 2, attacked: 1 };
        const previous = grouped.get(move.to);
        if (!previous || rank[severity] > rank[previous.severity]) grouped.set(move.to, threat);
      }
      return [...grouped.values()].sort((a, b) => {
        const rank = { hanging: 3, exchange: 2, attacked: 1 };
        return rank[b.severity] - rank[a.severity] || value[Math.abs(b.piece)] - value[Math.abs(a.piece)];
      });
    }
    function analyze(position, side, repetitions = {}, time = 260) {
      const board = position.slice();
      const checked = engine.inCheck(board, side);
      const risks = threats(board, side);
      const winning = engine.findMateInOne(board, side);
      const danger = checked ? null : engine.findMateInOne(board, -side);
      const move = winning ?? engine.chooseMove(board, side, "hard", repetitions, null, time);
      let reason = "";
      let reply = null;
      if (move) {
        const name = engine.pieceName(board[move.from]);
        const target = board[move.to];
        const saving = risks.find(risk => risk.square === move.from && risk.severity !== "attacked");
        const mobilityBefore = engine.legalMoves(board, side, move.from).length;
        const captured = engine.makeMove(board, move);
        const givesCheck = engine.inCheck(board, -side);
        const remaining = threats(board, side);
        if (winning) reason = "这一步可以将死对方。";
        else if (checked) reason = "先解除将军，保证己方将帅安全。";
        else if (danger && !engine.findMateInOne(board, -side)) reason = "这一步能化解当前对方的一步杀。";
        else if (target) reason = "吃取对方的" + engine.pieceName(target) + "，并比较对手回吃后的得失。";
        else if (saving && !remaining.some(risk => risk.square === move.to && risk.severity !== "attacked")) reason = "移开受威胁的" + name + "，减少直接丢子的风险。";
        else if (givesCheck) reason = "将军，迫使对方先处理将帅受到的攻击。";
        else if (Math.abs(position[move.from]) === engine.HORSE && engine.legalMoves(board, side, move.to).length > mobilityBefore) reason = "调动马的位置，增加它下一回合可选择的走法。";
        else if (risks.some(risk => risk.severity !== "attacked") && remaining.filter(risk => risk.severity !== "attacked").length < risks.filter(risk => risk.severity !== "attacked").length) reason = "调整防守，减少直接受威胁的棋子。";
        else reason = "这是有限搜索给出的参考走法。落子前仍需检查对方的吃子与将军。";
        if (!winning) reply = engine.chooseMove(board, -side, "normal", {}, null, 90);
        engine.unmakeMove(board, move, captured);
      }
      return { checked: Boolean(checked), risks, winning, danger, move, reason, reply };
    }
    class Sandbox {
      constructor(board, side) {
        this.root = { board: board.slice(), side, parent: null, children: [], label: "推演起点", move: null, depth: 0 };
        this.current = this.root;
      }
      play(candidate) {
        const node = this.current;
        const move = engine.legalMoves(node.board, node.side).find(move => move.from === candidate.from && move.to === candidate.to);
        if (!move) return false;
        let child = node.children.find(child => child.move.from === move.from && child.move.to === move.to);
        if (!child) {
          const board = node.board.slice();
          const label = engine.notation(board, move);
          engine.makeMove(board, move);
          child = { board, side: -node.side, parent: node, children: [], label, move, depth: node.depth + 1 };
          node.children.push(child);
        }
        this.current = child;
        return true;
      }
      back() { if (this.current.parent) this.current = this.current.parent; }
      forward(index = 0) { if (this.current.children[index]) this.current = this.current.children[index]; }
      reset() { this.current = this.root; }
      path() { const path = []; for (let node = this.current; node; node = node.parent) path.unshift(node); return path; }
      visits() { const visits = {}; for (const node of this.path()) { const key = engine.positionKey(node.board, node.side); visits[key] = (visits[key] ?? 0) + 1; } return visits; }
    }
    return { threats, analyze, Sandbox };
  }
  if (typeof module === "object" && module.exports) module.exports = createTraining;
  else root.createXiangqiTraining = createTraining;
})(typeof window === "object" ? window : globalThis);
