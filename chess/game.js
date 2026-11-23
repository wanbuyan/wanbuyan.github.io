/* 界面和对局状态。走法判定和电脑搜索由 engine.js 提供。 */
(() => {
  "use strict";

  const engine = window.Xiangqi;
  const { RED, BLACK, KING, GUARD, ELEPHANT, HORSE, ROOK, CANNON, PAWN, ISLAND } = engine;
  const skillEffects = new Map([
    [GUARD, "march", "shift"], [ELEPHANT, "boat", "sweep"], [HORSE, "pegasus", "cloak"],
    [ROOK, "teleport", "flying-rook"], [CANNON, "double-cannon", "remote"], [PAWN, "pawn-roam", "pawn-kick"]
  ].flatMap(([type, ...effects]) => engine.cards[type].map(([name], index) => [name, effects[index]])));
  // 每段分别指定起拍时间、音高、力度和音高变化。
  const soundProfiles = {
    move: [0.82, "wood", [[0, 540, 1]]],
    capture: [0.92, "wood", [[0, 480, 1], [0.032, 355, 0.62]]],
    teleport: [0.76, "wood", [[0, 620, 1], [0.024, 920, 0.43]]],
    "flying-rook": [0.94, "wood", [[0, 465, 1], [0.026, 720, 0.55]]],
    sweep: [0.94, "wood", [[0, 265, 1], [0.019, 395, 0.53], [0.048, 215, 0.4]]],
    march: [0.86, "wood", [[0, 270, 1], [0.075, 270, 0.86]]],
    shift: [0.77, "bell", [[0, 440, 0.88, 210], [0.046, 660, 1, -220]]],
    boat: [0.7, "water", [[0, 240, 1, 510], [0.045, 680, 0.58, 340]]],
    pegasus: [0.88, "wood", [[0, 310, 1], [0.047, 465, 0.8], [0.099, 670, 0.68]]],
    cloak: [0.62, "electric", [[0, 790, 1, -510], [0.065, 480, 0.58, -180]]],
    "double-cannon": [0.94, "blast", [[0, 235, 1, -140], [0.04, 400, 0.54], [0.087, 330, 0.42]]],
    remote: [0.89, "electric", [[0, 1270, 0.83, -930], [0.034, 180, 1, -83]]],
    "pawn-roam": [0.79, "bell", [[0, 500, 0.95], [0.062, 690, 0.72], [0.118, 500, 0.53]]],
    "pawn-kick": [0.88, "blast", [[0, 355, 1, -105], [0.053, 570, 0.5, -260]]]
  };
  // 基音衰减、泛音比例和衰减、噪声比例和衰减。
  const soundVoices = {
    wood: [50, 2.27, 0.34, 82, 0.35, 220],
    bell: [25, 2.72, 0.32, 36, 0.07, 170],
    water: [29, 1.51, 0.16, 42, 0.06, 150],
    electric: [31, 3.07, 0.48, 37, 0.42, 48],
    blast: [36, 1.38, 0.24, 58, 0.64, 70]
  };
  const byId = id => document.getElementById(id);
  const playfield = byId("playfield");
  const boardFrame = byId("board-frame");
  const boardElement = byId("board");
  const boardMotion = byId("board-motion");
  const boardEffects = byId("board-effects");
  const guideCanvas = byId("board-guides");
  const guideContext = guideCanvas.getContext("2d");
  const boardGuide = byId("board-guide");
  const boardGuideText = byId("board-guide-text");
  const boardGuideActions = byId("board-guide-actions");
  const practiceGuide = byId("practice-guide");
  const practiceTitle = byId("practice-title");
  const practiceDetail = byId("practice-detail");
  const practiceLine = byId("practice-line");
  const practiceHint = byId("practice-hint");
  const practiceRetry = byId("practice-retry");
  const practiceContinue = byId("practice-continue");
  const practiceSetup = byId("practice-setup");
  const training = window.createXiangqiTraining(engine);
  let sandbox = null;
  let coaching = null;
  let coachJob = null;
  let coachPreview = false;
  let riskPreview = null;
  let riskyTargets = new Set();
  const surface = byId("board-surface");
  const canvas = byId("lines");
  const context = canvas.getContext("2d");
  const gameStatus = byId("game-status");
  const statusTitle = byId("status-title");
  const statusDetail = byId("status-detail");
  const statusMark = byId("status-mark");
  const players = { [RED]: byId("red-player"), [BLACK]: byId("black-player") };
  const captureLists = {
    [RED]: players[RED].querySelector(".capture-list"),
    [BLACK]: players[BLACK].querySelector(".capture-list")
  };
  const files = { [RED]: byId("red-files"), [BLACK]: byId("black-files") };
  const undoButton = byId("undo");
  const convertButton = byId("convert");
  const pieceMotion = byId("piece-motion");
  const pieceSound = byId("piece-sound");
  const pieceVolume = byId("piece-volume");
  const volumeValue = byId("volume-value");
  const restartButton = byId("restart");
  const restartDialog = byId("restart-dialog");
  const restartWarning = byId("restart-warning");
  const restartCancel = byId("restart-cancel");
  const modeLabel = byId("mode-label");
  const difficultySettings = byId("difficulty-settings");
  const skillsPanel = byId("skills-panel");
  const learnedSkills = byId("learned-skills");
  const nextDraw = byId("next-draw");
  const drawProgress = byId("draw-progress");
  const draftDialog = byId("draft-dialog");
  const draftDetail = byId("draft-detail");
  const draftCards = byId("draft-cards");
  const moveDialog = byId("move-dialog");
  const moveTitle = byId("move-title");
  const moveOptions = byId("move-options");
  const moveRestrictions = byId("move-restrictions");
  const islandDialog = byId("island-dialog");
  const islandDetail = byId("island-detail");
  const resultDialog = byId("result-dialog");
  const resultMark = byId("result-mark");
  const resultTitle = byId("result-title");
  const resultDetail = byId("result-detail");
  const resultUndo = byId("result-undo");
  const islandDock = byId("island-dock");
  const passButton = byId("pass");
  const moveList = byId("move-list");
  const recordOpening = byId("record-opening");
  const moveCount = byId("move-count");
  const emptyRecord = byId("empty-record");

  let board;
  let turn;
  let humanSide = RED;
  let openingSide = "red";
  let mode = "challenge";
  let started = false;
  let challenge = null;
  let offer = null;
  let openingReward = "";
  let practice = null;
  let draftPreview = null;
  const drawThresholds = [null, { pieces: 3, material: 5 }, { pieces: 6, material: 10 }, { pieces: 9, material: 16 }];
  let history;
  let repetitions;
  let selected = null;
  let targets = [];
  let blockedMoves = [];
  let sweepSelection = null;
  let threatPreview = null;
  let conversionSquares = null;
  let checked = false;
  let canPass = false;
  let result = null;
  let shownResult = null;
  let searchJob = null;
  let activeMovement = null;
  let soundContext = null;
  let soundGain = null;
  let soundReady = null;
  const soundBuffers = Object.create(null);
  let boardSize = null;
  let recordScrollPending = false;
  const activeSounds = new Set();
  const cloakFades = new Set();
  const landingOffset = 0.88;
  const cloakBeat = 45;
  const computerReplyPause = 1000;
  let difficulty = document.querySelector('input[name="level"]:checked').value;
  let focusSquare = 85;
  const viewSquare = square => humanSide === RED ? square : 89 - square;
  const sideName = side => side === RED ? "红方" : "黑方";
  const canUndo = () => history.length > (humanSide === RED ? 0 : 1);
  const currentKey = () => engine.positionKey(board, turn, challenge);
  const copyChallenge = () => challenge && {
    ...challenge, levels: challenge.levels.slice(), crossedPawns: challenge.crossedPawns.slice()
  };
  const visibleBoard = () => sandbox?.current.board ?? draftPreview?.board ?? board;
  const visibleSkills = () => draftPreview?.skills ?? challenge;

  const cells = Array.from({ length: 90 }, (_, square) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "intersection";
    button.tabIndex = square === focusSquare ? 0 : -1;
    const stone = document.createElement("span");
    stone.className = "stone";
    stone.setAttribute("aria-hidden", "true");
    const warning = document.createElement("span");
    warning.className = "move-warning";
    warning.setAttribute("aria-hidden", "true");
    warning.hidden = true;
    button.append(stone, warning);
    button.addEventListener("focus", () => setFocusSquare(square));
    button.addEventListener("click", () => {
      setFocusSquare(square);
      selectSquare(square);
    });
    boardElement.append(button);
    return { button, stone, warning };
  });

  function drawLines({ width, height }) {
    if (!width || !height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (boardSize?.width === width && boardSize.height === height && boardSize.pixelRatio === pixelRatio) return;
    stopMovement(true);
    boardSize = { width, height, pixelRatio };
    if (!context) return;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    const cell = width / 9;
    const x = c => (c + 0.5) * cell;
    const y = r => (r + 0.5) * height / 10;
    context.strokeStyle = getComputedStyle(surface).getPropertyValue("--board-line").trim();
    context.lineWidth = 1.15;
    context.beginPath();

    function line(x1, y1, x2, y2) {
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
    }

    for (let r = 0; r < 10; r++) line(x(0), y(r), x(8), y(r));
    for (let c = 0; c < 9; c++) {
      if (c === 0 || c === 8) {
        line(x(c), y(0), x(c), y(9));
      } else {
        line(x(c), y(0), x(c), y(4));
        line(x(c), y(5), x(c), y(9));
      }
    }
    for (const r of [0, 7]) {
      line(x(3), y(r), x(5), y(r + 2));
      line(x(5), y(r), x(3), y(r + 2));
    }

    function cornerMarks(r, c) {
      const gap = cell * 0.075;
      const outer = cell * 0.18;
      for (const dx of [-1, 1]) {
        if ((c === 0 && dx < 0) || (c === 8 && dx > 0)) continue;
        for (const dy of [-1, 1]) {
          const innerX = x(c) + dx * gap;
          const innerY = y(r) + dy * gap;
          line(innerX, y(r) + dy * outer, innerX, innerY);
          line(innerX, innerY, x(c) + dx * outer, innerY);
        }
      }
    }

    for (const r of [2, 7]) for (const c of [1, 7]) cornerMarks(r, c);
    for (const r of [3, 6]) for (const c of [0, 2, 4, 6, 8]) cornerMarks(r, c);
    context.stroke();
    drawGuides();
  }

  function drawGuides() {
    const threat = threatPreview?.threat;
    const coaching = riskPreview ? { kind: "line", move: riskPreview.move } : coachPreview && coachingReport()?.move
      ? { kind: "hint", move: coachingReport().move } : sandbox ? null : practice?.preview;
    guideCanvas.hidden = !sweepSelection && !threat?.path && !coaching?.move;
    guideCanvas.toggleAttribute("data-practice", Boolean(coaching?.move));
    if (guideCanvas.hidden || !guideContext || !boardSize) return;
    const { width, height, pixelRatio } = boardSize;
    const bitmapWidth = Math.round(width * pixelRatio), bitmapHeight = Math.round(height * pixelRatio);
    if (guideCanvas.width !== bitmapWidth) guideCanvas.width = bitmapWidth;
    if (guideCanvas.height !== bitmapHeight) guideCanvas.height = bitmapHeight;
    guideContext.resetTransform();
    guideContext.clearRect(0, 0, bitmapWidth, bitmapHeight);
    guideContext.setTransform(guideCanvas.width / width, 0, 0, guideCanvas.height / height, 0, 0);
    const point = square => {
      const view = viewSquare(square);
      return [(engine.col(view) + 0.5) * width / 9, (engine.row(view) + 0.5) * height / 10];
    };
    const colors = getComputedStyle(surface);
    if (sweepSelection) {
      const [x1, y1] = point(selected), [x2, y2] = point(sweepSelection.to);
      const padding = width / 24;
      const left = Math.min(x1, x2) - padding, top = Math.min(y1, y2) - padding;
      const w = Math.abs(x1 - x2) + 2 * padding, h = Math.abs(y1 - y2) + 2 * padding;
      guideContext.fillStyle = colors.getPropertyValue("--last").trim();
      guideContext.globalAlpha = 0.48;
      guideContext.fillRect(left, top, w, h);
      guideContext.globalAlpha = 1;
      guideContext.strokeStyle = colors.getPropertyValue("--target").trim();
      guideContext.lineWidth = 1.5;
      guideContext.setLineDash([4, 3]);
      guideContext.strokeRect(left, top, w, h);
    }
    if (threat?.path) {
      guideContext.strokeStyle = colors.getPropertyValue("--red").trim();
      guideContext.lineWidth = 3;
      guideContext.setLineDash([6, 4]);
      guideContext.beginPath();
      guideContext.moveTo(...point(threat.path[0]));
      for (const square of threat.path.slice(1)) guideContext.lineTo(...point(square));
      guideContext.stroke();
      guideContext.setLineDash([]);
      for (const square of [threat.from, threat.king]) {
        guideContext.beginPath();
        guideContext.arc(...point(square), width / 20, 0, Math.PI * 2);
        guideContext.stroke();
      }
    }
    if (coaching?.move) {
      const [x1, y1] = point(coaching.move.from);
      const [x2, y2] = point(coaching.move.to);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const step = width / 9;
      const x = x2 - Math.cos(angle) * step * 0.16;
      const y = y2 - Math.sin(angle) * step * 0.16;
      const head = step * 0.25;
      const color = colors.getPropertyValue(coaching.kind === "line" ? "--red-dark" : "--target").trim();
      guideContext.lineCap = "round";
      guideContext.lineJoin = "round";
      guideContext.beginPath();
      guideContext.moveTo(x1 + Math.cos(angle) * step * 0.27, y1 + Math.sin(angle) * step * 0.27);
      guideContext.lineTo(x, y);
      guideContext.moveTo(x - Math.cos(angle - 0.55) * head, y - Math.sin(angle - 0.55) * head);
      guideContext.lineTo(x, y);
      guideContext.lineTo(x - Math.cos(angle + 0.55) * head, y - Math.sin(angle + 0.55) * head);
      guideContext.lineWidth = Math.max(3, step * 0.10);
      guideContext.strokeStyle = colors.getPropertyValue("--piece").trim();
      guideContext.stroke();
      guideContext.lineWidth = Math.max(2, step * 0.055);
      guideContext.strokeStyle = color;
      guideContext.stroke();
    }
  }

  function setFocusSquare(square) {
    cells[focusSquare].button.tabIndex = -1;
    cells[square].button.tabIndex = 0;
    focusSquare = square;
  }

  function clearSelection() {
    selected = null;
    targets = [];
    blockedMoves = [];
    conversionSquares = null;
    sweepSelection = null;
    threatPreview = null;
    riskyTargets = new Set();
  }

  function changeVisit(key, delta) {
    const count = (repetitions.get(key) ?? 0) + delta;
    if (count) repetitions.set(key, count);
    else repetitions.delete(key);
  }

  function prepareDraw() {
    if (!challenge || offer) return;
    if (challenge.drawIndex > 0 && turn !== humanSide) return;
    const gap = engine.drawGap(board, humanSide);
    const owned = board.filter(piece => piece * humanSide > 0);
    while (challenge.drawIndex < drawThresholds.length) {
      const index = challenge.drawIndex;
      const threshold = drawThresholds[index];
      if (threshold && (turn !== humanSide || gap.pieces < threshold.pieces && gap.material < threshold.material)) return;
      const level = index < 2 ? 1 : 2;
      let source = "开局抽取";
      if (threshold) {
        const reasons = [];
        if (gap.pieces >= threshold.pieces) reasons.push("落后 " + gap.pieces + " 子");
        if (gap.material >= threshold.material) reasons.push("兵力落后 " + gap.material + " 分");
        source = reasons.join("，");
      }
      const eligible = [...new Set(owned.map(Math.abs))].sort((a, b) => a - b)
        .filter(type => engine.cards[type] && !challenge.levels[type]);
      if (eligible.length) {
        let seed = (challenge.seed + index * 0x9e3779b9) >>> 0;
        for (let i = eligible.length - 1; i > 0; i--) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const j = seed % (i + 1);
          [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }
        offer = { index, level, source, types: eligible.slice(0, 3) };
        return;
      }
      if (level === 2) {
        const squares = board.flatMap((piece, square) =>
          piece * humanSide < 0 && Math.abs(piece) !== KING ? [square] : []);
        if (squares.length) {
          offer = { index, source, compensation: squares, ready: false };
          return;
        }
      }
      challenge.drawIndex++;
    }
  }

  function claimDraw({ type, square }) {
    if (!offer) return;
    const current = offer;
    if (current.compensation ? !current.ready || !current.compensation.includes(square) : !current.types.includes(type)) return;
    changeVisit(currentKey(), -1);
    let reward;
    if (current.compensation) {
      const captured = board[square];
      const last = history.at(-1);
      (last.compensations ??= []).push({ square, captured });
      board[square] = 0;
      reward = "补偿击杀" + namedPiece(captured);
    } else {
      engine.grantSkill(board, challenge, type, current.level);
      reward = "获得" + engine.cards[type][current.level - 1][0];
    }
    if (current.index === 0) openingReward = current.source + " · " + reward;
    else history.at(-1).reward = "第 " + (current.index + 1) + " 次奖励 · " + current.source + " · " + reward;
    challenge.drawIndex++;
    offer = null;
    if (draftPreview) clearPlayback();
    draftPreview = null;
    clearSelection();
    // 下一档等电脑再走一手后检查，同一手只发一次奖励。
    changeVisit(currentKey(), 1);
    refresh();
    renderCaptures();
    if (current.compensation) showBoardEffect(square, "capture");
    else if (type === HORSE && current.level === 2) cueCloak(board, challenge, turn);
    advanceGame();
  }

  async function showDraw() {
    const current = offer;
    if (!current) return;
    if (activeMovement) await activeMovement.animation.finished.catch(() => {});
    if (offer !== current || draftPreview || restartDialog.open || draftDialog.open) return;
    if (current.compensation) {
      current.ready = true;
      renderBoard();
      renderStatus();
      return;
    }
    const levelName = current.level === 1 ? "一级" : "二级";
    draftDetail.textContent = current.source + "。选一项" + levelName + "技能，己方该棋种全部获得。";
    draftCards.replaceChildren(...current.types.map(type => {
      const [name, description] = engine.cards[type][current.level - 1];
      const button = document.createElement("button");
      const piece = document.createElement("span");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      const group = document.createElement("div");
      const squares = board.flatMap((value, square) => value === type * humanSide ? [square] : []);
      group.className = "draft-card-group";
      button.type = "button";
      button.className = "draft-card";
      piece.textContent = engine.pieceName(type * humanSide) + " · " + levelName + " · " + squares.length + " 枚";
      title.textContent = name;
      detail.textContent = description;
      button.append(piece, title, detail);
      let rescue = "";
      if (turn === humanSide && checked) {
        const simulated = copyChallenge();
        engine.grantSkill(board, simulated, type, current.level);
        const response = engine.legalMoves(board, humanSide, null, true, simulated).length;
        rescue = response ? "选后有解将走法" : "选后仍无解将走法";
        const hint = document.createElement("span");
        if (response) hint.className = "draft-rescue";
        hint.textContent = rescue;
        button.append(hint);
      }
      button.addEventListener("click", () => {
        draftDialog.close();
        claimDraw({ type });
      });
      group.append(button, uiButton("预览" + engine.pieceName(type * humanSide) + "的技能", () => {
        if (offer !== current) return;
        draftPreview = { type, name, rescue };
        resetDraftTrial();
        draftDialog.close();
        boardGuideActions.firstElementChild?.focus();
      }));
      return group;
    }));
    draftDialog.showModal();
  }

  function orientBoard() {
    const flipped = humanSide === BLACK;
    if (playfield.hasAttribute("data-flipped") !== flipped) {
      playfield.toggleAttribute("data-flipped", flipped);
      boardFrame.before(players[-humanSide]);
      boardFrame.after(players[humanSide]);
      surface.before(files[-humanSide]);
      surface.after(files[humanSide]);
      boardElement.replaceChildren(...cells.map((_, square) => cells[viewSquare(square)].button));
    }
    players[humanSide].querySelector(".player-role").textContent = "你";
    players[-humanSide].querySelector(".player-role").textContent = "电脑";
  }

  function unlockSound() {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!pieceSound.checked || !AudioContext) return;
    try {
      soundContext ??= new AudioContext({ latencyHint: "interactive" });
      if (!soundGain) {
        soundGain = soundContext.createGain();
        soundGain.gain.value = pieceVolume.valueAsNumber / 100;
        soundGain.connect(soundContext.destination);
      }
      if (soundContext.state !== "running") soundReady = soundContext.resume().catch(() => {});
    } catch {
      // 浏览器无法启动音频时，仍然可以正常对弈。
    }
  }

  function soundBuffer(kind) {
    return soundBuffers[kind] ??= soundProfiles[kind] ? createSkillSound(soundProfiles[kind]) : createGlide(kind === "flightLead");
  }

  function createSkillSound([loudness, voice, knocks]) {
    const rate = soundContext.sampleRate;
    const duration = 0.12;
    const length = Math.round(rate * duration);
    const buffer = soundContext.createBuffer(1, length + Math.round(rate * knocks.at(-1)[0]), rate);
    const samples = buffer.getChannelData(0);
    const [decay, overtone, harmonics, harmonicDecay, noise, noiseDecay] = soundVoices[voice];

    for (const [delay, pitch, volume, bend = 0] of knocks) {
      const offset = Math.round(rate * delay);
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const phase = 2 * Math.PI * t * (pitch + bend * t / (2 * duration));
        const flutter = voice === "electric" ? 0.63 + 0.37 * Math.cos(2 * Math.PI * 92 * t) : 1;
        const body = Math.sin(phase) * 0.57 * Math.exp(-t * decay);
        const overtones = Math.sin(phase * overtone) * harmonics * Math.exp(-t * harmonicDecay);
        const contact = (Math.random() * 2 - 1) * noise * Math.exp(-t * noiseDecay);
        const envelope = Math.min(1, t * 2400, (length - i - 1) / (rate * 0.012));
        samples[offset + i] += volume * envelope * flutter * (body + overtones + contact);
      }
    }

    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    const gain = loudness / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    return buffer;
  }

  function createGlide(flying) {
    const rate = soundContext.sampleRate;
    const duration = flying ? 0.135 : 0.16;
    const buffer = soundContext.createBuffer(1, Math.round(rate * duration), rate);
    const samples = buffer.getChannelData(0);
    let phase = 0, filteredNoise = 0;
    for (let i = 0; i < samples.length; i++) {
      const progress = i / samples.length;
      const frequency = flying ? 900 - 580 * progress : 440 + 630 * progress;
      phase += 2 * Math.PI * frequency / rate;
      filteredNoise += ((Math.random() * 2 - 1) - filteredNoise) * 0.16;
      const envelope = Math.sin(progress * Math.PI) ** 1.7;
      samples[i] = envelope * (Math.sin(phase) * (flying ? 0.12 : 0.19) + filteredNoise * (flying ? 0.5 : 0.24));
    }
    return buffer;
  }

  function startSound(buffer, when) {
    const source = soundContext.createBufferSource();
    source.buffer = buffer;
    source.connect(soundGain);
    source.start(when);
    activeSounds.add(source);
    source.onended = () => activeSounds.delete(source);
    return source;
  }

  function skillEffect(move, change) {
    const skills = visibleSkills();
    // 普通走兵也可能刚过河或提高共享步长。
    const grew = skills?.levels[PAWN] === 1 && change.previous && visibleBoard()[move.to] === skills.side * PAWN &&
      skills.crossedPawns.includes(move.to) &&
      (!change.previous.crossedPawns.includes(move.from) || skills.pawnRange > change.previous.pawnRange);
    return skillEffects.get(move.skill) ?? (grew ? "pawn-roam" : null);
  }

  function cloakedSquares(position, skills, side) {
    if (skills?.levels[HORSE] !== 2 || side !== -skills.side || skills.horseRound % 2) return [];
    return position.flatMap((_, square) => engine.hiddenHorse(position, square, skills, side) ? [square] : []);
  }

  async function cueCloak(position, skills, side) {
    const squares = cloakedSquares(position, skills, side);
    if (!squares.length) return;
    for (const square of squares) showBoardEffect(square, "cloak");
    if (!pieceSound.checked) return;
    unlockSound();
    if (!soundGain) return;
    if (soundContext.state !== "running") await soundReady;
    if (pieceSound.checked && soundContext.state === "running" && position === visibleBoard() && skills === visibleSkills() &&
        (draftPreview ? -humanSide : turn) === side && engine.hiddenHorse(position, squares[0], skills, side)) {
      startSound(soundBuffer("cloak"), soundContext.currentTime);
    }
  }

  function moveSounds(entry, withGlide = false) {
    const kind = entry.effect;
    const impact = soundBuffer(kind ?? (entry.captured ? "capture" : "move"));
    const cloak = entry.cloaked?.length ? soundBuffer("cloak") : null;
    let glide = null;
    if (withGlide && kind === "flying-rook") glide = soundBuffer("flightLead");
    if (withGlide && kind === "teleport") glide = soundBuffer("teleportLead");
    return { impact, cloak, glide };
  }

  async function playSound(entry, movement = null) {
    if (!pieceSound.checked || !soundGain) return;
    if (soundContext.state !== "running") await soundReady;
    if (movement) await movement.animation.ready.catch(() => {});
    const latest = draftPreview ? draftPreview.moves.at(-1) : history.at(-1);
    if (!pieceSound.checked || latest !== entry || soundContext.state !== "running") return;
    if (movement && movement !== activeMovement) return;

    const { impact, cloak, glide } = movement?.audio ?? moveSounds(entry);
    let startAt = soundContext.currentTime;
    if (movement) {
      const landingAt = movement.animation.startTime + movement.impactTime;
      const timestamp = soundContext.getOutputTimestamp?.();
      // 将棋子接触棋盘的画面时刻换算到音频输出时钟。
      const audioTime = timestamp?.performanceTime > 0
        ? timestamp.contextTime + (landingAt - timestamp.performanceTime) / 1000
        : startAt + (landingAt - performance.now()) / 1000
          - (soundContext.baseLatency ?? 0) - (soundContext.outputLatency ?? 0);
      startAt = Math.max(startAt, audioTime);
    }
    if (glide && startAt - soundContext.currentTime >= glide.duration) {
      movement.sounds.push(startSound(glide, startAt - glide.duration));
    }
    const source = startSound(impact, startAt);
    if (movement) movement.sounds.push(source);
    if (cloak) {
      // 两匹马共用一次提示，给落子的声音先留出一拍。
      const source = startSound(cloak, startAt + cloakBeat / 1000);
      if (movement) movement.sounds.push(source);
    }
  }

  function stopSounds() {
    for (const source of activeSounds) source.stop();
    activeSounds.clear();
  }

  function clearPlayback() {
    stopMovement();
    stopSounds();
    boardEffects.replaceChildren();
  }

  function showBoardEffect(square, kind, delay = 0) {
    if (!pieceMotion.checked) return;
    const view = viewSquare(square);
    const effect = document.createElement("span");
    effect.className = "board-effect";
    effect.dataset.effect = kind;
    effect.style.left = (engine.col(view) + 0.5) / 9 * 100 + "%";
    effect.style.top = (engine.row(view) + 0.5) * 10 + "%";
    effect.style.setProperty("--effect-delay", delay + "ms");

    const ring = document.createElement("span");
    ring.className = "effect-ring";
    ring.addEventListener("animationend", () => effect.remove(), { once: true });
    effect.append(ring);
    if (["capture", "conversion", "teleport", "teleport-out", "flying-rook", "sweep", "pawn-kick", "double-cannon", "remote", "cloak"].includes(kind)) {
      const angles = ["capture", "flying-rook", "sweep", "double-cannon", "remote"].includes(kind)
        ? [12, 67, 136, 198, 248, 311] : [45, 135, 225, 315];
      const sparks = document.createElement("span");
      sparks.className = "effect-sparks";
      for (const angle of angles) {
        const spark = document.createElement("span");
        spark.className = "effect-spark";
        const radians = angle * Math.PI / 180;
        spark.style.left = (50 + Math.cos(radians) * 40) + "%";
        spark.style.top = (50 + Math.sin(radians) * 40) + "%";
        sparks.append(spark);
      }
      effect.append(sparks);
    }
    boardEffects.append(effect);
    return effect;
  }

  function showSkillTrace(move, kind, delay) {
    const from = viewSquare(move.from), to = viewSquare(move.to);
    const r = engine.row(from), c = engine.col(from);
    const dy = engine.row(to) - r, dx = engine.col(to) - c;
    const trace = document.createElement("span");
    trace.className = "skill-trace";
    trace.dataset.effect = kind;
    trace.style.setProperty("--effect-delay", delay + "ms");
    if (kind !== "sweep-grid") {
      trace.style.left = (c + 0.5) / 9 * 100 + "%";
      trace.style.top = (r + 0.5) * 10 + "%";
      trace.style.width = Math.hypot(dx, dy) / 9 * 100 + "%";
      trace.style.setProperty("--trace-angle", Math.atan2(dy, dx) + "rad");
    } else {
      trace.style.left = (Math.min(c, c + dx) + 0.12) / 9 * 100 + "%";
      trace.style.top = (Math.min(r, r + dy) + 0.12) * 10 + "%";
      trace.style.width = (Math.abs(dx) + 0.76) / 9 * 100 + "%";
      trace.style.height = (Math.abs(dy) + 0.76) * 10 + "%";
    }
    trace.addEventListener("animationend", () => trace.remove(), { once: true });
    boardEffects.append(trace);
    return trace;
  }

  function showMoveEffects(entry, impactTime = 0) {
    if (!pieceMotion.checked) return [];
    const { move, captured, effect: kind, cloaked } = entry;
    const square = captured ? engine.captureSquare(move) : move.to;
    const effects = [showBoardEffect(square, kind ?? (captured ? "capture" : "move"), impactTime)];
    const mark = (where, effect, delay = impactTime) => effects.push(showBoardEffect(where, effect, delay));
    const trace = (effect, delay = impactTime) => effects.push(showSkillTrace(move, effect, delay));
    if (kind === "teleport") {
      mark(move.from, "teleport-out", 0);
    } else if (kind === "flying-rook") {
      mark(move.screen, "flying-screen", 0);
      trace("flight-trace", impactTime * 0.18);
    } else if (kind === "sweep") {
      trace("sweep-grid");
    } else if (kind === "double-cannon" || kind === "remote") {
      const step = engine.row(move.to) === engine.row(move.from) ? Math.sign(move.to - move.from) : Math.sign(move.to - move.from) * 9;
      let number = 0;
      for (let point = move.from + step; point !== move.to; point += step) {
        // 炮架不随这两种走法移动，可以直接从走完后的棋盘找出。
        if (visibleBoard()[point]) mark(point, kind === "remote" ? "remote-screen" : "cannon-screen", impactTime * (0.26 + number++ * 0.2));
      }
      if (kind === "remote") mark(move.from, "remote-screen", 0);
      trace(kind === "remote" ? "remote-beam" : "cannon-trace", impactTime * 0.13);
    } else if (kind === "shift" && move.kind === "swap") {
      mark(move.from, "shift");
      trace("shift-trace", impactTime * 0.3);
    } else if (kind === "boat") {
      mark((move.from + move.to) / 2, "boat", impactTime * 0.38);
      trace("boat-wake", impactTime * 0.18);
    } else if (kind === "pegasus") {
      const dr = engine.row(move.to) - engine.row(move.from);
      const dc = engine.col(move.to) - engine.col(move.from);
      mark(move.from + 9 * Math.trunc(dr / 2) + Math.trunc(dc / 2), "hoof", impactTime * 0.4);
      trace("horse-arc", impactTime * 0.15);
    } else if (kind === "pawn-kick" || kind === "pawn-roam") {
      mark(move.from, kind, impactTime * 0.12);
      if (kind === "pawn-kick") trace("kick-trace", impactTime * 0.23);
    }
    for (const where of cloaked ?? []) mark(where, "cloak", impactTime + cloakBeat);
    return effects;
  }

  function stopMovement(landNow = false) {
    for (const fade of cloakFades) fade.cancel();
    cloakFades.clear();
    if (!activeMovement) return;
    const { animation, impactTime, sounds, entry, effects, buttons, animations } = activeMovement;
    activeMovement = null;
    const inFlight = animation.currentTime < impactTime;
    for (const clip of animations) clip.cancel();
    clearMovingPieces(buttons);
    if (inFlight) {
      for (const effect of effects) effect.remove();
      for (const sound of sounds) {
        if (activeSounds.delete(sound)) sound.stop();
      }
      if (landNow) {
        showMoveEffects(entry);
        playSound(entry);
      }
    }
    if (landNow && entry.captured && !draftPreview) renderCaptures();
  }

  function clearMovingPieces(buttons) {
    boardMotion.replaceChildren();
    for (const button of buttons) button.removeAttribute("data-moving");
  }

  function motionPiece(square, piece, check = false) {
    const view = viewSquare(square);
    const sprite = document.createElement("span");
    sprite.className = "motion-square";
    sprite.style.left = engine.col(view) / 9 * 100 + "%";
    sprite.style.top = engine.row(view) * 10 + "%";
    sprite.toggleAttribute("data-red", piece > 0);
    sprite.toggleAttribute("data-check", check);
    const skill = piece * humanSide > 0 && visibleSkills()?.levels[Math.abs(piece)];
    if (skill) sprite.dataset.skilled = skill;
    const stone = document.createElement("span");
    stone.className = "stone";
    stone.textContent = engine.pieceName(piece);
    sprite.append(stone);
    boardMotion.append(sprite);
    return sprite;
  }

  function animateMove(entry) {
    const { move, captured } = entry;
    const effectSquare = captured ? engine.captureSquare(move) : move.to;
    if (move.kind === "remote" || !pieceMotion.checked || !boardMotion.animate) {
      showMoveEffects(entry);
      playSound(entry);
      return;
    }
    const { width, height } = boardSize ?? surface.getBoundingClientRect();
    const distance = Math.hypot(engine.row(move.from) - engine.row(move.to), engine.col(move.from) - engine.col(move.to));
    const duration = Math.min(440, 250 + distance * 23);
    const audio = pieceSound.checked && soundGain ? moveSounds(entry, true) : null;
    const buttons = [], animations = [];
    const position = visibleBoard();
    const transform = (x, y, scale) => `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    function slide(from, to) {
      const { button } = cells[to];
      const origin = viewSquare(from), destination = viewSquare(to);
      const dx = (engine.col(origin) - engine.col(destination)) * width / 9;
      const dy = (engine.row(origin) - engine.row(destination)) * height / 10;
      const sprite = motionPiece(to, position[to], button.hasAttribute("data-check"));
      buttons.push(button);
      button.setAttribute("data-moving", "");
      let frames = [
        { transform: transform(dx, dy, 1.04), easing: "cubic-bezier(0.25, 0.2, 0.46, 1)" },
        { transform: transform(0, 0, 0.97), offset: landingOffset, easing: "ease-out" },
        { transform: transform(0, 0, 1) }
      ];
      if (move.kind === "teleport") {
        frames = [
          { opacity: 0, transform: transform(0, 0, 0.65) },
          { opacity: 0, transform: transform(0, 0, 0.65), offset: 0.27 },
          { opacity: 1, transform: transform(0, 0, 0.97), offset: landingOffset, easing: "ease-out" },
          { opacity: 1, transform: transform(0, 0, 1) }
        ];
      } else if (move.kind === "flying-rook" || entry.effect === "pegasus") {
        frames = [
          { transform: transform(dx, dy, 1), easing: "ease-in" },
          { transform: transform(dx * 0.43, dy * 0.43, 1.17), offset: 0.54, easing: "ease-out" },
          { transform: transform(0, 0, 0.96), offset: landingOffset, easing: "ease-out" },
          { transform: transform(0, 0, 1) }
        ];
      }
      const animation = sprite.animate(frames, { duration, fill: "both" });
      animations.push(animation);
      return animation;
    }
    if (captured) {
      const sprite = motionPiece(effectSquare, captured);
      animations.push(sprite.animate([
        { opacity: 1 }, { opacity: 1, offset: landingOffset }, { opacity: 0, offset: 0.93 }, { opacity: 0 }
      ], { duration, fill: "both" }));
    }
    if (move.kind === "teleport") {
      const departure = motionPiece(move.from, position[move.to]);
      animations.push(departure.animate([
        { opacity: 1, transform: transform(0, 0, 1) }, { opacity: 0, transform: transform(0, 0, 0.55) }
      ], { duration: duration * 0.42, easing: "ease-in", fill: "both" }));
    }
    const animation = slide(move.from, move.to);
    if (move.kind === "swap") slide(move.to, move.from);
    const impactTime = duration * landingOffset;
    const effects = showMoveEffects(entry, impactTime);
    for (const square of entry.cloaked ?? []) {
      const fade = cells[square].stone.animate([{ opacity: 1 }, { opacity: 0.48 }], {
        delay: impactTime + cloakBeat, duration: 130, fill: "backwards", easing: "ease-out"
      });
      cloakFades.add(fade);
      const release = () => cloakFades.delete(fade);
      fade.finished.then(release, release);
    }
    const movement = { animation, animations, buttons, entry, impactTime, effects, audio, sounds: [] };
    activeMovement = movement;
    function finishMovement() {
      if (activeMovement !== movement) return;
      activeMovement = null;
      clearMovingPieces(buttons);
      if (captured && !draftPreview) renderCaptures();
    }
    animation.finished.then(finishMovement, finishMovement);
    playSound(entry, movement);
  }

  function renderBoard() {
    const position = visibleBoard(), skills = visibleSkills();
    const activeSide = sandbox ? sandbox.current.side : draftPreview ? humanSide : turn;
    const hiddenSide = draftPreview ? -humanSide : turn;
    const checkedNow = sandbox || draftPreview ? engine.inCheck(position, activeSide, undefined, skills) : checked;
    islandDock.hidden = !engine.kingOnIsland(position, BLACK);
    const last = sandbox ? sandbox.current : draftPreview ? draftPreview.moves.at(-1) : history.at(-1);
    const checkedSquare = checkedNow ? position.indexOf(activeSide * KING) : -1;
    const compensation = offer?.ready ? offer.compensation : null;
    const destinations = new Set(sweepSelection ? sweepSelection.moves.map(move => move.hit) :
      compensation ?? conversionSquares ?? targets.map(move => move.to));
    const restricted = new Set(sweepSelection ? sweepSelection.blocked.map(option => option.move.hit) :
      blockedMoves.map(option => option.move.to));
    const threat = threatPreview?.threat;
    const canSelect = Boolean(sandbox || draftPreview || started && !offer && turn === humanSide && !result) && !conversionSquares && !sweepSelection;
    const risks = coachingReport()?.risks ?? [];
    const action = sweepSelection ? "，可扫穴击杀" : compensation ? "，可补偿击杀" : conversionSquares ? "，可附体" : "，可落子";
    cells.forEach(({ button, stone, warning }, square) => {
      const piece = position[square];
      const level = piece * humanSide > 0 ? skills?.levels[Math.abs(piece)] : 0;
      const hidden = engine.hiddenHorse(position, square, skills, hiddenSide);
      const previewPiece = draftPreview && piece === humanSide * draftPreview.type;
      const skill = level ? engine.cards[Math.abs(piece)][level - 1][0] : "";
      const name = piece ? sideName(Math.sign(piece)) + engine.pieceName(piece) : "空位";
      const target = destinations.has(square);
      const restrictedHere = restricted.has(square);
      const view = viewSquare(square);
      const location = "第" + (engine.row(view) + 1) + "行第" + (engine.col(view) + 1) + "列";
      const description = location + "，" + name + (skill ? "，" + skill : "") +
        (hidden ? "，隐身免疫" : "") + (target ? action : "") + (restrictedHere ? "，有受限走法，点击查看原因" : "") +
        (previewPiece ? "，正在试用" + draftPreview.name : "") +
        (square === threat?.from ? "，预览中的攻击方" : "") +
        (risks.some(risk => risk.square === square) ? "，受攻击" : "") +
        (riskyTargets.has(square) ? "，落子后可能被直接吃取" : "");
      if (button.getAttribute("aria-label") !== description) button.setAttribute("aria-label", description);
      if (level && button.dataset.skilled !== String(level)) button.dataset.skilled = level;
      else if (!level) button.removeAttribute("data-skilled");
      button.toggleAttribute("data-invisible", hidden);
      const pressed = String(square === selected);
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
      button.toggleAttribute("data-red", piece > 0);
      button.toggleAttribute("data-occupied", Boolean(piece));
      button.toggleAttribute("data-playable", Boolean(canSelect && piece * (sandbox ? activeSide : humanSide) > 0));
      const risk = risks.find(risk => risk.square === square);
      button.toggleAttribute("data-risk", Boolean(risk && risk.severity !== "attacked"));
      button.toggleAttribute("data-guarded-risk", risk?.severity === "attacked");
      button.toggleAttribute("data-risk-target", riskyTargets.has(square));
      button.toggleAttribute("data-last", square === last?.move?.from || square === last?.move?.to || square === last?.conversion?.square);
      button.toggleAttribute("data-selected", square === selected);
      button.toggleAttribute("data-target", target);
      button.toggleAttribute("data-sweep-destination", square === sweepSelection?.to);
      button.toggleAttribute("data-threat", square === threat?.from || square === threat?.king);
      button.toggleAttribute("data-draft-preview", Boolean(previewPiece));
      warning.toggleAttribute("hidden", !restrictedHere);
      const marker = target ? "!" : "×";
      if (restrictedHere && warning.textContent !== marker) warning.textContent = marker;
      button.toggleAttribute("data-check", square === checkedSquare);
      stone.toggleAttribute("hidden", !piece);
      const glyph = engine.pieceName(piece);
      if (stone.textContent !== glyph) stone.textContent = glyph;
    });
    drawGuides();
    renderBoardGuide();
  }

  function uiButton(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function cancelSweep() {
    sweepSelection = null;
    threatPreview = null;
    renderBoard();
  }

  function updatePractice() {
    if (!practice) return;
    const wasDefending = practice.tactics?.danger;
    Object.assign(practice, { warning: null, demonstrating: false, preview: null, tactics: null, defended: false });
    if (result) return;
    if (turn === humanSide) {
      const winning = engine.findMateInOne(board, humanSide);
      // 未被将军时，假设原地不动，看看对手下一手有什么杀招。
      const danger = checked ? null : engine.findMateInOne(board, -humanSide);
      practice.tactics = { winning, danger };
    } else if (canUndo()) {
      const move = engine.findMateInOne(board, turn);
      if (!move) {
        if (wasDefending) {
          practice.defended = true;
          history.at(-1).mateDefense = true;
        }
        return;
      }
      practice.warning = move;
      practice.warnings++;
      history.at(-1).mateWarning = true;
    }
  }

  function renderPractice() {
    practiceGuide.hidden = !practice || Boolean(result) || Boolean(sandbox);
    if (practiceGuide.hidden) return;
    const { warning, tactics, preview } = practice;
    const paused = warning && !practice.demonstrating;
    const danger = tactics?.danger;
    const inCheck = tactics && checked;
    const winning = tactics?.winning;
    let title = "练习教练";
    let detail = "等电脑走完，再检查双方将帅的安全。";
    if (paused) {
      title = "杀棋预警 · 对手一步可将死";
      detail = "对局已暂停。可以先找找自己哪条防线被打开了。";
    } else if (practice.demonstrating) {
      title = "电脑即将演示杀法";
      detail = "留意哪枚棋子将军，以及将帅的退路被哪些棋子封住。";
    } else if (practice.defended) {
      title = "你挡住了一步杀";
      detail = "对手的杀着已被化解。看看电脑接下来会怎么走。";
    } else if (winning) {
      title = "你有一步杀";
      detail = "找一手能将军的棋，检查对手能不能逃、挡或吃。";
    } else if (inCheck) {
      title = "先应将";
      detail = "试着移开将帅、挡住攻击路线，或吃掉将军的棋子。";
    } else if (danger) {
      title = "杀棋预警 · 留意对方下一手";
      detail = "如果这个局面交给对手走，对方有一步杀。先找一手能破坏杀法的棋。";
    } else if (tactics) {
      detail = "当前局面未发现一步杀。落子前，先看看对方能吃你什么、有没有将军的机会。";
    }
    if (preview) {
      detail = preview.move ? preview.text + engine.notation(board, preview.move) + "。" : preview.text;
    }
    practiceGuide.toggleAttribute("data-danger", Boolean(warning || inCheck || danger));
    practiceTitle.textContent = title;
    practiceDetail.textContent = detail;
    practiceLine.hidden = !paused && !danger;
    practiceLine.setAttribute("aria-pressed", String(preview?.kind === "line"));
    practiceLine.textContent = preview?.kind === "line" ? "收起杀法" : "查看杀法";
    practiceHint.hidden = !tactics || !winning && !inCheck && !danger;
    practiceHint.setAttribute("aria-pressed", String(preview?.kind === "hint"));
    practiceHint.textContent = preview?.kind === "hint" ? "收起提示" : "提示一手";
    practiceRetry.hidden = !paused;
    practiceContinue.hidden = !paused;
  }

  function practiceDefense() {
    const moves = engine.legalMoves(board, humanSide);
    return moves.find(move => {
      const captured = engine.makeMove(board, move);
      const key = engine.positionKey(board, -humanSide);
      const safe = repetitions.get(key) >= 2 || !engine.findMateInOne(board, -humanSide);
      engine.unmakeMove(board, move, captured);
      return safe;
    });
  }

  function togglePracticePreview(kind) {
    if (!practice || result) return;
    if (practice.preview?.kind === kind) {
      practice.preview = null;
    } else if (kind === "line") {
      const move = practice.warning ?? practice.tactics?.danger;
      if (!move) return;
      practice.preview = { kind, move, text: "对手若走这一步即可将死你。杀着是" };
    } else if (practice.tactics) {
      const { winning } = practice.tactics;
      const move = winning ?? practiceDefense();
      const text = winning ? "可以一步将死对方的走法是" : checked
        ? "可以解将并避开对手下一手将死的走法是" : "可以挡住对手一步杀的走法是";
      practice.preview = { kind, move, text: move ? text : "当前每种合法走法都会留下对手的一步杀。可以悔棋，回到更早的局面找防守。" };
    }
    renderPractice();
    drawGuides();
  }

  function returnToDraft() {
    clearPlayback();
    draftPreview = null;
    clearSelection();
    renderBoard();
    renderStatus();
    showDraw();
  }

  function resetDraftTrial() {
    clearPlayback();
    draftPreview.board = board.slice();
    draftPreview.skills = copyChallenge();
    draftPreview.moves = [];
    engine.grantSkill(draftPreview.board, draftPreview.skills, draftPreview.type, offer.level);
    clearSelection();
    renderBoard();
    renderStatus();
    if (draftPreview.type === HORSE && offer.level === 2) cueCloak(draftPreview.board, draftPreview.skills, -humanSide);
  }

  function undoDraftTrial() {
    const last = draftPreview.moves.pop();
    if (!last) return;
    clearPlayback();
    engine.revertMove(draftPreview.board, last.move, last.change, draftPreview.skills);
    clearSelection();
    renderBoard();
    renderStatus();
  }

  function renderBoardGuide() {
    boardGuide.hidden = !draftPreview && !sweepSelection && !threatPreview;
    if (boardGuide.hidden) return;
    let text = "";
    const actions = [];
    if (draftPreview) {
      const { type, name, rescue, moves } = draftPreview;
      text = "试招「" + name + "」 · 已试 " + moves.length + " 步。";
      if (!moves.length && rescue) text += rescue + "。";
      const undoTrial = uiButton("撤回试招", undoDraftTrial);
      undoTrial.disabled = !moves.length;
      actions.push(uiButton("返回抽牌", returnToDraft), uiButton("选此技能", () => claimDraw({ type })),
        undoTrial, uiButton("重置试招", resetDraftTrial));
    }
    if (sweepSelection) {
      text += (text ? " " : "") + (sweepSelection.moves.length ? "点选田字格内高亮的敌棋进行扫穴。" :
        "这个落点的扫穴目标均受限，点「×」查看原因。");
      if (sweepSelection.plain) actions.push(uiButton("普通走相", () => playMove(sweepSelection.plain)));
      actions.push(uiButton("重选落点", cancelSweep));
    } else if (!draftPreview) {
      actions.push(uiButton("收起提示", () => {
        threatPreview = null;
        renderBoard();
      }));
    }
    if (threatPreview) text += " " + restrictionText(threatPreview);
    boardGuideText.textContent = text.trim();
    boardGuideActions.replaceChildren(...actions);
  }

  function setStatus(mark, title, detail, tone) {
    gameStatus.dataset.tone = tone;
    if (statusMark.textContent !== mark) statusMark.textContent = mark;
    if (statusTitle.textContent !== title) statusTitle.textContent = title;
    if (statusDetail.textContent !== detail) statusDetail.textContent = detail;
  }

  function describeResult(outcome) {
    if (outcome.reason === "repetition") {
      return { mark: "和", title: "本局和棋", detail: "同一局面已出现三次。", tone: "neutral" };
    }
    const winner = sideName(outcome.winner);
    const loser = sideName(-outcome.winner);
    const detail = outcome.reason === "checkmate"
      ? winner + "将死" + loser + "。"
      : loser + "困毙，" + winner + "获胜。";
    return {
      mark: outcome.winner === RED ? "红" : "黑",
      title: outcome.winner === humanSide ? "你赢了" : "电脑获胜",
      detail,
      tone: outcome.winner === RED ? "red" : "black"
    };
  }

  function renderStatus() {
    if (sandbox) {
      for (const side of [RED, BLACK]) players[side].querySelector(".player-turn").hidden = side !== sandbox.current.side;
      setStatus("演", "沙盘 · " + sideName(sandbox.current.side) + "走棋", "双方均可手动操作，试走不会改变原对局。", "neutral");
      undoButton.disabled = !sandbox.current.parent;
      convertButton.disabled = true;
      passButton.hidden = true;
      return;
    }
    for (const side of [RED, BLACK]) {
      players[side].querySelector(".player-turn").hidden = side !== (draftPreview ? humanSide : turn) || Boolean(result);
    }
    const mark = turn === RED ? "红" : "黑";
    const tone = turn === RED ? "red" : "black";
    const restrictionHint = blockedMoves.length ? " 点击带「!」或「×」的落点可查看原因。" : "";
    if (draftPreview) {
      setStatus("试", "技能试招", "可以连续走己方棋子。返回抽牌后会恢复正式局面。" + restrictionHint, "neutral");
    } else if (!started) {
      setStatus("棋", "选择开局", "选定模式和执棋方后开始。", "neutral");
    } else if (offer) {
      if (offer.compensation) setStatus("补", "补偿击杀", "选中一枚高亮敌棋移除，然后继续当前回合。", "neutral");
      else setStatus("技", "选择超能力", "选中技能后继续对局。", "neutral");
    } else if (result?.reason === "island-offer") {
      setStatus("黑", checked ? "你被将死了" : "黑方困毙", "可以选择登岛继续对局。", "black");
    } else if (result) {
      const summary = describeResult(result);
      setStatus(summary.mark, summary.title, summary.detail, summary.tone);
    } else if (practice?.warning && !practice.demonstrating) {
      setStatus("练", "杀棋预警", "电脑下一手可将死你。可在棋盘下查看杀法、悔棋或继续。", "neutral");
    } else if (turn !== humanSide) {
      setStatus(mark, "电脑思考中", checked ? sideName(turn) + "被将军，正在应将。" : "电脑正在选择下一步。", tone);
    } else if (conversionSquares) {
      const detail = conversionSquares.length ? "选中高亮敌棋归你，占用一手（将帅除外）。" : "当前没有可以附体的棋子。";
      setStatus("神", "棋神附体", detail + restrictionHint, tone);
    } else if (checked) {
      setStatus(mark, "你被将军了", "请选择能够解除将军的走法。" + restrictionHint, tone);
    } else if (canPass) {
      setStatus("黑", "黑方待机", "棋盘上无子可走，可以待机或使用棋神附体。", "black");
    } else {
      const detail = challenge ? "选中己棋，再选落点。多个走法可在弹窗中选择。" :
        "选中" + sideName(humanSide) + "棋子，点击标出的落点。";
      setStatus(mark, "轮到你走", detail + restrictionHint, tone);
    }
    undoButton.disabled = draftPreview ? !draftPreview.moves.length : !canUndo();
    passButton.hidden = !canPass || Boolean(result);
    convertButton.disabled = turn !== humanSide || Boolean(result);
    convertButton.setAttribute("aria-pressed", String(conversionSquares !== null));
  }

  function renderSkills() {
    skillsPanel.hidden = mode !== "challenge";
    if (skillsPanel.hidden) return;
    const index = challenge?.drawIndex ?? 0;
    const threshold = drawThresholds[index];
    nextDraw.textContent = index >= drawThresholds.length ? "已完成抽取" :
      index === 0 ? "开局抽取" : offer ? "本次奖励待选" : "下次抽取 · " + (index === 1 ? "一级" : "二级");
    drawProgress.hidden = !threshold;
    if (threshold) {
      const gap = engine.drawGap(board, humanSide);
      drawProgress.textContent = "子数落后 " + Math.max(0, gap.pieces) + "/" + threshold.pieces + " 子，兵力落后 " +
        Math.max(0, gap.material) + "/" + threshold.material + " 分";
    }
    const entries = (challenge?.levels ?? []).flatMap((level, type) => {
      if (!level) return [];
      const [name, description] = engine.cards[type][level - 1];
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const text = document.createElement("p");
      title.textContent = engine.pieceName(type * humanSide) + " · " + (level === 1 ? "一级" : "二级") + " · " + name;
      text.textContent = type === engine.PAWN && level === 1 ? description + " 当前共享步长 " + challenge.pawnRange + " 格。" : description;
      item.append(title, text);
      return [item];
    });
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.textContent = "开局时选择第一项技能。";
      entries.push(empty);
    }
    learnedSkills.replaceChildren(...entries);
  }

  function renderRecord() {
    const record = moveList.closest(".record");
    const rounds = Math.ceil(history.length / 2);
    const latest = moveList.querySelector(".is-latest");
    if (latest) latest.classList.remove("is-latest");
    while (moveList.rows.length > rounds) moveList.deleteRow(-1);
    while (moveList.rows.length < rounds) {
      const entry = moveList.insertRow();
      entry.insertCell().textContent = String(moveList.rows.length);
      entry.insertCell();
      entry.insertCell();
    }
    if (rounds) {
      const entry = moveList.rows[rounds - 1];
      for (const side of [0, 1]) {
        const move = history[2 * (rounds - 1) + side];
        const cell = entry.cells[side + 1];
        cell.textContent = move?.label ?? "—";
        const practiceNote = move?.mateWarning ? "给了对手一步杀" : move?.mateDefense ? "化解了对手的一步杀" : "";
        for (const note of [move?.note, move?.reward, practiceNote]) {
          if (!note) continue;
          const detail = document.createElement("small");
          detail.className = "move-note";
          detail.textContent = note;
          cell.append(detail);
        }
      }
      entry.classList.add("is-latest");
    }
    recordOpening.textContent = openingReward;
    recordOpening.hidden = !openingReward;
    emptyRecord.hidden = history.length > 0;
    moveCount.textContent = history.length + " 步";
    if (!recordScrollPending) {
      recordScrollPending = true;
      const scroll = () => {
        if (activeMovement) {
          const { animation } = activeMovement;
          const nextFrame = () => requestAnimationFrame(scroll);
          animation.finished.then(nextFrame, nextFrame);
          return;
        }
        recordScrollPending = false;
        record.scrollTop = record.scrollHeight;
      };
      requestAnimationFrame(scroll);
    }
  }

  function renderCaptures() {
    const counts = { [RED]: new Map(), [BLACK]: new Map() };
    function count(piece) {
      if (!piece) return;
      const captures = counts[-Math.sign(piece)];
      captures.set(piece, (captures.get(piece) ?? 0) + 1);
    }
    for (const entry of history) {
      if (entry !== activeMovement?.entry) count(entry.captured);
      for (const reward of entry.compensations ?? []) count(reward.captured);
    }

    for (const side of [RED, BLACK]) {
      const list = captureLists[side];
      const captures = counts[side];
      const key = [...captures].join(";");
      if (list.dataset.captures === key) continue;
      list.dataset.captures = key;
      if (!captures.size) {
        const empty = document.createElement("li");
        empty.className = "capture-empty";
        empty.textContent = "—";
        empty.setAttribute("aria-label", "尚未吃子");
        list.replaceChildren(empty);
        continue;
      }
      const items = [...captures].map(([piece, count]) => {
        const name = engine.pieceName(piece);
        const item = document.createElement("li");
        item.className = "capture-entry";
        item.setAttribute("aria-label", sideName(Math.sign(piece)) + name + " " + count + " 枚");
        const stone = document.createElement("span");
        stone.className = "capture-piece";
        stone.toggleAttribute("data-red", piece > 0);
        stone.setAttribute("aria-hidden", "true");
        stone.textContent = name;
        item.append(stone);
        if (count > 1) {
          const quantity = document.createElement("span");
          quantity.className = "capture-count";
          quantity.setAttribute("aria-hidden", "true");
          quantity.textContent = "×" + count;
          item.append(quantity);
        }
        return item;
      });
      list.replaceChildren(...items);
    }
  }

  function refresh() {
    checked = engine.inCheck(board, turn, undefined, challenge);
    const noMoves = !offer && !engine.legalMoves(board, turn, null, true, challenge).length;
    canPass = noMoves && turn === humanSide && engine.kingOnIsland(board, turn);
    if (offer || !started) {
      result = null;
    } else if (noMoves && !canPass) {
      result = { winner: -turn, reason: checked ? "checkmate" : "stalemate" };
      if (mode === "casual" && turn === BLACK && humanSide === BLACK) result.reason = "island-offer";
    } else if (repetitions.get(currentKey()) >= 3) {
      result = { reason: "repetition" };
    } else {
      result = null;
    }
    updatePractice();
    renderBoard();
    renderStatus();
    renderRecord();
    renderSkills();
    renderPractice();
    syncTraining();
  }

  function selectSquare(square) {
    if (sandbox) { selectSandboxSquare(square); return; }
    if (!draftPreview && (!started || turn !== humanSide || result)) return;
    if (!draftPreview && offer) {
      if (offer.ready && offer.compensation) {
        if (board[square] === -humanSide * KING) chooseAction([], [], "补偿击杀只能移除将帅以外的一枚敌棋。");
        else claimDraw({ square });
      }
      return;
    }
    const position = visibleBoard();
    if (conversionSquares) {
      if (conversionSquares.includes(square)) {
        const piece = board[square];
        board[square] = -piece;
        recordTurn({ conversion: { square, piece }, label: "附体：" + (piece > 0 ? "红" : "黑") + engine.pieceName(piece) });
      } else {
        const blocked = blockedMoves.filter(option => option.move.to === square);
        if (blocked.length) chooseAction([], blocked);
      }
      return;
    }
    if (sweepSelection) {
      const sweep = sweepSelection.moves.find(move => move.hit === square);
      if (sweep) {
        playMove(sweep);
        return;
      }
      const blocked = sweepSelection.blocked.find(option => option.move.hit === square);
      if (blocked) {
        threatPreview = blocked;
        renderBoard();
      } else if (square === selected) {
        cancelSweep();
      }
      return;
    }
    const moves = targets.filter(target => target.to === square);
    const blocked = blockedMoves.filter(option => option.move.to === square);
    if (moves.length || blocked.length) {
      const sweeps = moves.filter(move => move.kind === "sweep");
      const restrictedSweeps = blocked.filter(option => option.move.kind === "sweep");
      if (sweeps.length || restrictedSweeps.length) {
        sweepSelection = { to: square, moves: sweeps, blocked: restrictedSweeps, plain: moves.find(move => !move.kind) };
        threatPreview = sweeps.length ? null : restrictedSweeps[0];
        renderBoard();
      } else if (moves.length === 1 && !blocked.length) playMove(moves[0]);
      else chooseAction(moves, blocked);
      return;
    }
    if (selected !== null && position[square] * humanSide <= 0) {
      const reason = engine.blockedPath(position, selected, square, visibleSkills());
      if (reason) {
        chooseAction([], [], reason);
        return;
      }
    }
    if (position[square] * humanSide > 0 && square !== selected) {
      selectPiece(square);
      return;
    }
    clearSelection();
    renderBoard();
    renderStatus();
  }

  function selectPiece(square) {
    unlockSound();
    selected = square;
    threatPreview = null;
    const options = engine.inspectMoves(visibleBoard(), humanSide, square, visibleSkills());
    targets = options.moves;
    blockedMoves = options.blocked;
    riskyTargets = new Set();
    if (practice) {
      for (const move of targets) {
        const position = board.slice();
        engine.makeMove(position, move);
        if (training.threats(position, humanSide).some(risk => risk.square === move.to && risk.severity !== "attacked")) riskyTargets.add(move.to);
      }
    }
    renderBoard();
    renderStatus();
  }

  function squareLabel(square) {
    const view = viewSquare(square);
    return "第" + (engine.row(view) + 1) + "行第" + (engine.col(view) + 1) + "列";
  }

  function namedPiece(piece) {
    return sideName(Math.sign(piece))[0] + engine.pieceName(piece);
  }

  function actionLabel(move) {
    const position = visibleBoard();
    switch (move.kind) {
      case "remote": return "穿山打牛 · 原地击杀" + engine.pieceName(position[move.to]);
      case "swap": return "移形换影 · 与" + engine.pieceName(position[move.to]) + "换位";
      case "sweep": return "犁庭扫穴 · 击杀" + namedPiece(position[move.hit]) + "（" + squareLabel(move.hit) + "）";
      case "flying-rook": return "飞车 · 越子吃" + namedPiece(position[move.to]);
      case "teleport": return "随心所欲 · 瞬移";
      case "conversion": return "棋神附体 · 转换" + engine.pieceName(board[move.to]);
      default: return move.skill ?? "普通落子";
    }
  }

  function restrictionText({ reason, attacker }) {
    if (reason === "king-target") return "对方将帅是将军目标，胜负由将死或困毙判定。";
    if (reason === "hidden-horse") return "对方马正在隐身，本回合免疫吃子和远击。";
    if (Math.abs(attacker) === KING) return "这一步会造成将帅照面。";
    if (!attacker) return "这一步无法保证己方将帅的安全。";
    const king = sideName(humanSide)[0] + engine.pieceName(humanSide * KING);
    const threat = sideName(Math.sign(attacker))[0] + engine.pieceName(attacker);
    return "这一步之后，" + king + "会被" + threat + "将军。";
  }

  function chooseAction(moves, blocked, pathHint = "") {
    threatPreview = blocked.find(option => option.threat?.path) ?? null;
    renderBoard();
    moveTitle.textContent = moves.length ? "选择走法" : "这步不可用";
    const actions = moves.map(move => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action";
      button.textContent = actionLabel(move);
      button.addEventListener("click", () => {
        moveDialog.close();
        playMove(move);
      });
      return button;
    });
    const destination = blocked[0]?.move.to;
    const destinationPiece = visibleBoard()[destination];
    if (!moves.length && destinationPiece * humanSide > 0) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action";
      button.textContent = "改选" + engine.pieceName(destinationPiece);
      button.addEventListener("click", () => {
        moveDialog.close();
        selectPiece(destination);
      });
      actions.push(button);
    }
    moveOptions.replaceChildren(...actions);
    moveOptions.hidden = !actions.length;
    const notes = blocked.map(option => {
      const note = document.createElement("div");
      const title = document.createElement("strong");
      const text = document.createElement("p");
      note.className = "move-restriction";
      title.textContent = actionLabel(option.move);
      text.textContent = "不可用。" + restrictionText(option);
      note.append(title, text);
      if (option.threat?.path) {
        note.append(uiButton("在棋盘查看攻击路线", () => {
          threatPreview = option;
          moveDialog.close();
          renderBoard();
          boardGuideActions.firstElementChild?.focus();
        }));
      }
      return note;
    });
    if (pathHint) {
      const note = document.createElement("p");
      note.className = "move-restriction";
      note.textContent = pathHint;
      notes.push(note);
    }
    moveRestrictions.replaceChildren(...notes);
    moveRestrictions.hidden = !notes.length;
    moveDialog.showModal();
  }

  function playMove(move) {
    if (draftPreview) {
      stopMovement();
      unlockSound();
      const { board: position, skills, moves } = draftPreview;
      const change = engine.applyMove(position, move, skills);
      // 试招连续走己棋，每一步后推进一次隐身轮次。
      if (skills.levels[HORSE] === 2) skills.horseRound++;
      const entry = { move, change, captured: change.captured, effect: skillEffect(move, change),
        cloaked: cloakedSquares(position, skills, -humanSide) };
      moves.push(entry);
      clearSelection();
      renderBoard();
      renderStatus();
      animateMove(entry);
      return;
    }
    const mover = engine.pieceName(board[move.from]);
    let label = engine.notation(board, move);
    if (move.kind === "teleport") label = mover + "移至" + squareLabel(move.to);
    else if (move.kind === "remote") label = mover + "原地远击";
    else if (move.kind === "swap") label = mover + engine.pieceName(board[move.to]) + "换位";
    const hit = engine.captureSquare(move);
    const target = board[hit];
    const capture = target * turn < 0 ? "吃" + namedPiece(target) : "";
    const note = [move.skill, capture].filter(Boolean).join(" · ") + (capture && (move.kind === "sweep" || move.kind === "remote")
      ? "（" + squareLabel(hit) + "）" : "");
    const priorChallenge = copyChallenge();
    const change = engine.applyMove(board, move, challenge);
    recordTurn({ move, label, note, captured: change.captured, change, priorChallenge, effect: skillEffect(move, change) });
  }

  function recordTurn(entry) {
    stopMovement();
    if (turn === humanSide) unlockSound();
    history.push(entry);
    turn = -turn;
    if (entry.move) entry.cloaked = cloakedSquares(board, challenge, turn);
    prepareDraw();
    changeVisit(currentKey(), 1);
    clearSelection();
    refresh();
    if (entry.move) animateMove(entry);
    else if (entry.conversion || entry.islandFrom !== undefined) {
      if (entry.conversion) showBoardEffect(entry.conversion.square, "conversion");
      playSound(entry);
    }
    renderCaptures();
    advanceGame();
  }

  function advanceGame() {
    if (sandbox) return;
    if (offer) showDraw();
    else if (result) showEndDialog();
    else if (turn !== humanSide && !(practice?.warning && !practice.demonstrating)) scheduleComputer();
  }

  async function showEndDialog() {
    if (sandbox) return;
    const outcome = result;
    if (!outcome || outcome === shownResult) return;
    if (activeMovement) await activeMovement.animation.finished.catch(() => {});
    if (sandbox || result !== outcome || restartDialog.open || islandDialog.open || resultDialog.open) return;
    if (outcome.reason === "island-offer") {
      islandDetail.textContent = checked ? "黑将已被将死。登岛算黑方走一手。" : "黑方已困毙。登岛算黑方走一手。";
      islandDialog.returnValue = "no";
      islandDialog.showModal();
      return;
    }
    const summary = describeResult(outcome);
    resultMark.textContent = summary.mark;
    resultTitle.textContent = summary.title;
    const warnings = practice?.warnings;
    resultDetail.textContent = summary.detail + (warnings
      ? " 本局触发 " + warnings + " 次一步杀预警（含悔棋前的尝试）。" : "");
    resultDialog.dataset.tone = summary.tone;
    resultUndo.disabled = !canUndo();
    resultDialog.returnValue = "view";
    resultDialog.showModal();
    shownResult = outcome;
  }

  function stopComputer() {
    if (!searchJob) return;
    clearTimeout(searchJob.timer);
    searchJob.worker?.terminate();
    if (searchJob.url) URL.revokeObjectURL(searchJob.url);
    searchJob = null;
  }

  function scheduleComputer() {
    // 切换难度时重新算棋，沿用这一回合的落子时间。
    const animation = activeMovement?.animation;
    const replyTime = searchJob?.replyTime ?? (async () => {
      if (animation) await animation.finished.catch(() => {});
      return performance.now() + computerReplyPause;
    })();
    stopComputer();
    const job = { worker: null, url: null, timer: null, replyTime };
    searchJob = job;

    async function finish(move) {
      const earliestReply = await job.replyTime;
      if (searchJob !== job) return;
      job.timer = setTimeout(() => {
        if (searchJob !== job) return;
        stopComputer();
        const legal = engine.legalMoves(board, -humanSide, null, false, challenge);
        const chosen = legal.find(candidate => candidate.from === move?.from && candidate.to === move?.to) ?? legal[0];
        if (chosen) playMove(chosen);
      }, Math.max(0, Math.ceil(earliestReply - performance.now())));
    }

    if (practice?.demonstrating) {
      finish(practice.warning);
      return;
    }
    async function startSearch() {
      // 落子期间将可用的处理时间留给动画，随后再启动后台算棋。
      if (animation) await animation.finished.catch(() => {});
      if (searchJob !== job) return;
      const data = { board: board.slice(), side: -humanSide, difficulty: challenge ? "challenge" : difficulty,
        repetitions: Object.fromEntries(repetitions), skills: copyChallenge() };
      const fallback = () => {
        if (searchJob === job) finish(engine.chooseMove(data.board, data.side, data.difficulty, data.repetitions, data.skills, 20));
      };
      try {
        job.url = URL.createObjectURL(new Blob([engine.workerSource()], { type: "text/javascript" }));
        job.worker = new Worker(job.url);
        job.worker.onmessage = event => finish(event.data);
        job.worker.onerror = event => {
          event.preventDefault();
          fallback();
        };
        job.worker.postMessage(data);
      } catch {
        fallback();
      }
    }
    job.timer = setTimeout(startSearch, 0);
  }

  function undo() {
    if (sandbox) { sandbox.back(); updateSandbox(); return; }
    if (draftPreview) {
      undoDraftTrial();
      return;
    }
    if (!canUndo()) return;
    stopComputer();
    clearPlayback();
    offer = null;
    // 撤回玩家最近一手及其后已落下的电脑应手。
    do {
      changeVisit(currentKey(), -1);
      const { move, change, conversion, islandFrom, priorChallenge, compensations } = history.pop();
      for (const reward of compensations ?? []) board[reward.square] = reward.captured;
      if (conversion) board[conversion.square] = conversion.piece;
      else if (islandFrom !== undefined) board[islandFrom] = board.pop();
      else if (move) {
        engine.revertMove(board, move, change);
        challenge = priorChallenge;
      }
      turn = -turn;
    } while (turn !== humanSide);
    clearSelection();
    refresh();
    renderCaptures();
    showEndDialog();
  }

  function newGame(begin = true) {
    sandbox = null;
    stopCoach();
    coaching = null;
    coachPreview = false;
    riskPreview = null;
    stopComputer();
    clearPlayback();
    board = engine.initialBoard();
    turn = RED;
    started = begin;
    offer = null;
    draftPreview = null;
    if (openingSide === "random") humanSide = Math.random() < 0.5 ? RED : BLACK;
    else humanSide = openingSide === "black" ? BLACK : RED;
    history = [];
    openingReward = "";
    practice = begin && mode === "practice" ? { warnings: 0 } : null;
    challenge = begin && mode === "challenge" ? engine.createSkills(humanSide, Math.floor(Math.random() * 0x100000000)) : null;
    prepareDraw();
    repetitions = new Map([[currentKey(), 1]]);
    modeLabel.textContent = { challenge: "挑战模式", casual: "娱乐对局", practice: "练习模式" }[mode];
    difficultySettings.hidden = mode === "challenge";
    convertButton.hidden = mode !== "casual";
    convertButton.parentElement.toggleAttribute("data-no-conversion", mode !== "casual");
    convertButton.parentElement.toggleAttribute("data-challenge", mode === "challenge");
    clearSelection();
    orientBoard();
    setFocusSquare(board.indexOf(humanSide * KING));
    refresh();
    renderCaptures();
    if (begin) advanceGame();
  }

  function trainingKey() {
    if (sandbox) return engine.positionKey(sandbox.current.board, sandbox.current.side);
    return practice && started && !result && turn === humanSide ? currentKey() : null;
  }

  function coachingReport() {
    return coaching?.key === trainingKey() ? coaching.report : null;
  }

  function stopCoach() {
    if (!coachJob) return;
    clearTimeout(coachJob.timer);
    coachJob.worker?.terminate();
    if (coachJob.url) URL.revokeObjectURL(coachJob.url);
    coachJob = null;
  }

  function syncTraining() {
    byId("sandbox-board-bar").hidden = !sandbox;
    byId("sandbox-section").hidden = !started || mode === "challenge";
    byId("sandbox-enter").hidden = Boolean(sandbox);
    byId("sandbox-controls").hidden = !sandbox;
    byId("sandbox-enter").disabled = engine.kingOnIsland(board, BLACK);
    if (!sandbox) {
      byId("sandbox-summary").textContent = engine.kingOnIsland(board, BLACK)
        ? "登岛局面不适用普通象棋推演；可在登岛前进入沙盘。" : "从当前局面开始，双方轮流试走。退出后恢复原对局。";
      byId("sandbox-state").textContent = "独立试走";
    }
    restartButton.disabled = Boolean(sandbox);
    difficultySettings.disabled = Boolean(sandbox);
    byId("record-title").textContent = sandbox ? "原对局走棋记录" : "走棋记录";
    document.body.classList.toggle("is-sandbox", Boolean(sandbox));
    const key = trainingKey();
    if (!key) {
      stopCoach();
      coaching = null;
      coachPreview = false;
      riskPreview = null;
      renderTraining();
      return;
    }
    if (coaching?.key === key || coachJob?.key === key) { renderTraining(); return; }
    stopCoach();
    coaching = null;
    coachPreview = false;
    riskPreview = null;
    const position = visibleBoard().slice();
    const side = sandbox ? sandbox.current.side : humanSide;
    const visits = sandbox ? sandbox.visits() : Object.fromEntries(repetitions);
    const job = { key, worker: null, url: null, timer: null };
    coachJob = job;
    const finish = report => {
      if (coachJob !== job || trainingKey() !== key) return;
      stopCoach();
      coaching = { key, report };
      renderTraining();
      if (sandbox) renderSandbox();
      renderBoard();
    };
    const fallback = () => {
      if (coachJob !== job) return;
      finish(training.analyze(position, side, visits, 35));
    };
    try {
      const source = engine.workerSource() + "\nconst trainer = (" + window.createXiangqiTraining.toString() + ")(engine);\nself.onmessage = ({ data }) => self.postMessage(trainer.analyze(data.board, data.side, data.visits));";
      job.url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      job.worker = new Worker(job.url);
      job.worker.onmessage = event => finish(event.data);
      job.worker.onerror = event => { event.preventDefault(); fallback(); };
      job.worker.postMessage({ board: position, side, visits });
      job.timer = setTimeout(fallback, 8000);
    } catch { job.timer = setTimeout(fallback, 0); }
    renderTraining();
    renderBoard();
  }

  function renderTraining() {
    const panel = byId("training-panel");
    panel.hidden = !sandbox && !practice;
    if (panel.hidden) return;
    const report = coachingReport();
    const risks = byId("training-risks");
    const hint = byId("coach-hint");
    byId("training-state").textContent = report ? "分析完成" : trainingKey() ? "分析中" : "等待走棋";
    hint.disabled = !report?.move;
    hint.setAttribute("aria-pressed", String(coachPreview));
    hint.textContent = coachPreview ? "收起参考走法" : "显示参考走法";
    let advice = report ? report.move ? "可参考：" + engine.notation(visibleBoard(), report.move) + "。" + report.reason : "当前一方没有合法走法。" : trainingKey() ? "正在检查将帅安全、受攻击棋子与下一步走法。" : result ? "本局已结束，可进入沙盘复盘。" : practice?.warning ? "对手存在一步杀。可查看杀法、悔棋，或进入沙盘寻找防守。" : "等待电脑走棋，随后更新局面指导。";
    if (report?.reply && coachPreview) {
      const next = visibleBoard().slice();
      engine.makeMove(next, report.move);
      advice += " 对方可能应：" + engine.notation(next, report.reply) + "。";
    }
    byId("training-advice").textContent = advice;
    const entries = (report?.risks ?? []).map(risk => {
      const item = document.createElement("li");
      const button = uiButton(engine.pieceName(risk.piece) + " · " + squareLabel(risk.square), () => {
        riskPreview = riskPreview === risk ? null : risk;
        coachPreview = false;
        renderTraining();
        renderBoard();
      });
      button.setAttribute("aria-pressed", String(riskPreview === risk));
      const detail = document.createElement("p");
      detail.textContent = "受到对方" + engine.pieceName(risk.attacker) + "攻击；" + risk.reason + "。";
      item.dataset.severity = risk.severity;
      item.append(button, detail);
      return item;
    });
    if (!entries.length) {
      const item = document.createElement("li");
      item.textContent = report ? report.checked ? "当前被将军，先按合法落点应将。" : "未发现对手可立即吃取的己方棋子。" : "局面更新后显示。";
      entries.push(item);
    }
    risks.replaceChildren(...entries);
  }

  function renderSandbox() {
    if (!sandbox) return;
    const node = sandbox.current;
    const legal = engine.legalMoves(node.board, node.side);
    const repeated = sandbox.visits()[engine.positionKey(node.board, node.side)] >= 3;
    byId("sandbox-state").textContent = "已推演 " + node.depth + " 步";
    byId("sandbox-summary").textContent = !legal.length ? sideName(node.side) + (engine.inCheck(node.board, node.side) ? "被将死。" : "困毙。") + "可后退选择其他分支。" : repeated ? "该局面已出现三次，可后退选择其他分支。" : sideName(node.side) + "走棋。原对局已暂停。";
    byId("sandbox-back").disabled = !node.parent;
    byId("sandbox-board-back").disabled = !node.parent;
    byId("sandbox-board-turn").textContent = "沙盘推演 · " + sideName(node.side) + "走棋 · 已试走 " + node.depth + " 步";
    byId("sandbox-forward").disabled = !node.children.length;
    byId("sandbox-reset").disabled = node === sandbox.root;
    byId("sandbox-reply").disabled = !legal.length || repeated || !coachingReport()?.move;
    byId("sandbox-path").replaceChildren(...sandbox.path().map(entry => {
      const item = document.createElement("li");
      const button = uiButton(entry.depth ? entry.depth + ". " + entry.label : entry.label, () => { sandbox.current = entry; updateSandbox(); });
      if (entry === node) button.setAttribute("aria-current", "step");
      item.append(button);
      return item;
    }));
    byId("sandbox-branches").replaceChildren(...node.children.map((entry, index) => uiButton("分支 " + (index + 1) + "：" + entry.label, () => { sandbox.forward(index); updateSandbox(); })));
  }

  function updateSandbox() {
    clearSelection();
    syncTraining();
    renderSandbox();
    renderPractice();
    renderStatus();
    renderBoard();
  }

  function selectSandboxSquare(square) {
    const node = sandbox.current;
    const move = targets.find(move => move.to === square);
    if (move) {
      sandbox.play(move);
      updateSandbox();
      return;
    }
    clearSelection();
    if (node.board[square] * node.side > 0) {
      selected = square;
      targets = engine.legalMoves(node.board, node.side, square);
    }
    renderBoard();
  }

  byId("coach-hint").addEventListener("click", () => {
    if (!coachingReport()?.move) return;
    coachPreview = !coachPreview;
    riskPreview = null;
    renderTraining();
    drawGuides();
  });
  byId("sandbox-enter").addEventListener("click", () => {
    if (!started || mode === "challenge" || sandbox || engine.kingOnIsland(board, BLACK)) return;
    stopComputer();
    clearPlayback();
    sandbox = new training.Sandbox(board, turn);
    updateSandbox();
  });
  byId("sandbox-exit").addEventListener("click", () => {
    if (!sandbox) return;
    sandbox = null;
    stopCoach();
    coaching = null;
    clearSelection();
    syncTraining();
    renderBoard();
    renderStatus();
    renderPractice();
    advanceGame();
  });
  byId("sandbox-back").addEventListener("click", () => { if (sandbox) { sandbox.back(); updateSandbox(); } });
  byId("sandbox-forward").addEventListener("click", () => { if (sandbox) { sandbox.forward(); updateSandbox(); } });
  byId("sandbox-reset").addEventListener("click", () => { if (sandbox) { sandbox.reset(); updateSandbox(); } });
  byId("sandbox-reply").addEventListener("click", () => {
    const move = coachingReport()?.move;
    if (sandbox && move) { sandbox.play(move); updateSandbox(); }
  });
  byId("sandbox-board-back").addEventListener("click", () => byId("sandbox-back").click());
  byId("sandbox-board-exit").addEventListener("click", () => byId("sandbox-exit").click());

  function closeBoardGuide() {
    coachPreview = false;
    riskPreview = null;
    if (draftPreview) returnToDraft();
    else if (sweepSelection) cancelSweep();
    else {
      if (practice?.preview) practice.preview = null;
      clearSelection();
      renderBoard();
      renderStatus();
      renderPractice();
    }
  }

  boardElement.addEventListener("keydown", event => {
    const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (event.key === "Escape") {
      closeBoardGuide();
      return;
    }
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const view = viewSquare(focusSquare);
    const r = engine.row(view) + direction[0];
    const c = engine.col(view) + direction[1];
    if (r >= 0 && r < 10 && c >= 0 && c < 9) cells[viewSquare(r * 9 + c)].button.focus();
  });
  boardGuide.addEventListener("keydown", event => {
    if (event.key === "Escape") closeBoardGuide();
  });
  practiceGuide.addEventListener("keydown", event => {
    if (event.key === "Escape") closeBoardGuide();
  });

  document.querySelectorAll('input[name="level"]').forEach(input => {
    input.addEventListener("change", () => {
      difficulty = input.value;
      if (started && !challenge) advanceGame();
    });
  });
  undoButton.addEventListener("click", undo);
  practiceLine.addEventListener("click", () => togglePracticePreview("line"));
  practiceHint.addEventListener("click", () => togglePracticePreview("hint"));
  practiceRetry.addEventListener("click", () => {
    if (!practice?.warning || practice.demonstrating) return;
    undo();
    cells[board.indexOf(humanSide * KING)].button.focus();
  });
  practiceContinue.addEventListener("click", () => {
    if (!practice?.warning || practice.demonstrating) return;
    practice.demonstrating = true;
    practice.preview = null;
    drawGuides();
    renderPractice();
    renderStatus();
    advanceGame();
  });
  passButton.addEventListener("click", () => {
    if (canPass && !result) recordTurn({ label: "待机" });
  });
  convertButton.addEventListener("click", () => {
    if (sandbox) return;
    if (mode !== "casual" || turn !== humanSide || result) return;
    const wasActive = conversionSquares !== null;
    clearSelection();
    if (!wasActive) conversionSquares = engine.conversionTargets(board, humanSide, blockedMoves);
    renderBoard();
    renderStatus();
  });
  function openSetup() {
    if (sandbox) return;
    byId("restart-title").textContent = started ? "重新开局" : "开始对局";
    restartCancel.hidden = !started;
    restartWarning.hidden = history.length === 0;
    restartDialog.querySelector('input[name="opening-side"][value="' + openingSide + '"]').checked = true;
    restartDialog.querySelector('input[name="opening-mode"][value="' + mode + '"]').checked = true;
    practiceSetup.hidden = mode !== "practice";
    restartDialog.returnValue = "cancel";
    restartDialog.showModal();
  }
  restartButton.addEventListener("click", openSetup);
  restartDialog.addEventListener("cancel", event => {
    if (!started) event.preventDefault();
  });
  restartDialog.addEventListener("change", event => {
    if (event.target.name === "opening-mode") practiceSetup.hidden = event.target.value !== "practice";
  });
  draftDialog.addEventListener("cancel", event => event.preventDefault());
  restartDialog.addEventListener("close", () => {
    if (restartDialog.returnValue === "restart") {
      openingSide = restartDialog.querySelector('input[name="opening-side"]:checked').value;
      mode = restartDialog.querySelector('input[name="opening-mode"]:checked').value;
      unlockSound();
      newGame();
    } else if (offer) showDraw();
    else showEndDialog();
  });
  islandDialog.addEventListener("close", () => {
    if (result?.reason !== "island-offer") return;
    if (islandDialog.returnValue === "yes") {
      const islandFrom = board.indexOf(BLACK * KING);
      board[ISLAND] = board[islandFrom];
      board[islandFrom] = 0;
      recordTurn({ islandFrom, label: "登岛" });
    } else {
      result = { winner: RED, reason: checked ? "checkmate" : "stalemate" };
      renderStatus();
      showEndDialog();
    }
  });
  resultDialog.addEventListener("close", () => {
    if (resultDialog.returnValue === "undo") undo();
    else if (resultDialog.returnValue === "replay") {
      if (mode === "challenge") openSetup();
      else {
        unlockSound();
        newGame();
      }
    }
  });
  new ResizeObserver(([entry]) => drawLines(entry.contentRect)).observe(surface);
  pieceMotion.addEventListener("change", () => {
    if (!pieceMotion.checked) {
      stopMovement(true);
      boardEffects.replaceChildren();
    }
  });
  pieceSound.addEventListener("change", () => {
    if (pieceSound.checked) unlockSound();
    else stopSounds();
  });
  pieceVolume.addEventListener("input", () => {
    const percent = pieceVolume.valueAsNumber;
    volumeValue.textContent = percent + "%";
    if (soundGain) soundGain.gain.setTargetAtTime(percent / 100, soundContext.currentTime, 0.012);
  });
  newGame(false);
  openSetup();
  window.dispatchEvent(new Event("blog:page-ready"));
})();
