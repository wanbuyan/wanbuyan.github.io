(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const arena = $("arena");
  const canvas = $("board");
  const ctx = canvas.getContext("2d", { alpha: false });
  const backdrop = document.createElement("canvas");
  const backdropCtx = backdrop.getContext("2d", { alpha: false });
  const hud = { score: $("score"), best: $("best"), combo: $("combo"), meter: $("combo-meter") };
  const primary = $("primary");
  const pauseButton = $("pause");
  const restartButton = $("restart");
  const dashButton = $("dash");
  const overlay = $("overlay");
  const draft = $("draft");
  const draftOptions = $("draft-options");
  const breachStatus = $("breach-status");
  const boardList = $("leaderboard");

  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const keyDirections = new Map([
    ["ArrowUp", 0], ["KeyW", 0], ["ArrowRight", 1], ["KeyD", 1],
    ["ArrowDown", 2], ["KeyS", 2], ["ArrowLeft", 3], ["KeyA", 3],
  ]);
  const scoreKey = "neon-serpent.scores.v1";
  const audioKey = "neon-serpent.sound.v1";
  const firstDraft = 3;
  const draftInterval = 5;
  const perks = {
    shield: { name: "相位护盾", cap: 2, effect: (rank) => "抵挡 " + rank + " 次碰撞" },
    combo: { name: "连击电容", cap: 3, effect: (rank) => "连击窗口 +" + (rank * 1.2).toFixed(1) + " 秒" },
    dash: { name: "过载冲刺", cap: 3, effect: (rank) => "冲刺拾取额外 +" + rank * 5 + " 分" },
    core: { name: "高纯核心", cap: 3, effect: (rank) => "普通能量基础分 +" + rank * 4 },
    gold: { name: "黄金回路", cap: 3, effect: (rank) => "限时奖励基础分 +" + rank * 15 },
    timer: { name: "时钟扩容", cap: 2, effect: (rank) => "限时奖励多停留 " + rank * 2 + " 秒" },
    slow: { name: "稳态驱动", cap: 2, effect: (rank) => "每格移动间隔延长 " + rank * 12 + " 毫秒" },
    short: { name: "轻量蛇身", cap: 2, effect: (rank) => "每吃 " + (4 - rank) + " 颗能量，少长 1 格" },
    bloom: { name: "能量膨胀", cap: 2, effect: (rank) => "基础能量覆盖 " + (rank === 1 ? "5 格，触及相邻格即可拾取" : "9 格，斜角也可拾取") },
    charged: { name: "强化能量", cap: 3, effect: (rank) => "每吃 " + (5 - rank) + " 颗能量，生成一颗独立的 +10 能量" },
    breach: { name: "冲刺破障", cap: 3, effect: (rank) => "冲刺可撞碎障碍，冷却 " + (15 - rank * 3) + " 秒" },
  };
  const maxRecords = 5;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const fmt = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
  const rootStyle = getComputedStyle(document.documentElement);
  const palette = Object.fromEntries([
    "board", "board-edge", "field-line", "lime", "lime-ink", "deep-lime", "snake-rim",
    "snake-tail", "snake-head", "food-core", "food-glow", "gold", "bonus-glow",
    "orange", "hazard-fill", "hazard-line", "ink", "charged", "charged-glow",
  ].map((name) => [name, rootStyle.getPropertyValue("--" + name).trim()]));

  let columns = 32;
  const rows = 17;
  let state = "ready";
  let snake = [];
  let previousSnake = [];
  let occupied = new Set();
  let obstacles = new Set();
  let turns = [];
  let heading = 1;
  let food = null;
  let bonus = null;
  let chargedFood = null;
  let chargedAt = Infinity;
  let breachReadyAt = 0;
  let score = 0;
  let picked = 0;
  let streak = 0;
  let longest = 0;
  let time = 0;
  let comboUntil = 0;
  let progress = 0;
  let previousFrame = 0;
  let pendingFrame = 0;
  let finishTimer = 0;
  let dashKey = false;
  let dashPointer = null;
  let swipe = null;
  let records = readRecords();
  let sound = readStorage(audioKey) !== "off";
  let audio = null;
  let shake = 0;
  let flash = 0;
  let flashColor = palette.lime;
  let particles = [];
  let ripples = [];
  let popups = [];
  let loadout = {};
  let draftsTaken = 0;
  let nextDraftAt = firstDraft;
  let offer = [];
  let resumeGrace = 0;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function readRecords() {
    try {
      const list = JSON.parse(readStorage(scoreKey));
      if (!Array.isArray(list)) return [];
      return list
        .filter((entry) => entry && Number.isSafeInteger(entry.score) && entry.score > 0 &&
          Number.isFinite(entry.date) && Math.abs(entry.date) <= 8.64e15)
        .sort((a, b) => b.score - a.score || a.date - b.date)
        .slice(0, maxRecords);
    } catch {
      return [];
    }
  }

  function paintRanking() {
    const count = Math.max(3, records.length);
    const items = Array.from({ length: count }, (_, index) => {
      const row = document.createElement("li");
      const entry = records[index];
      for (const [className, value] of [
        ["rank", String(index + 1).padStart(2, "0")],
        ["rank-date", entry ? fmt.format(entry.date) : "暂无"],
        ["rank-score", entry ? String(entry.score) : ""],
      ]) {
        const cell = document.createElement("span");
        cell.className = className;
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    });
    boardList.replaceChildren(...items);
    $("ranking-note").hidden = records.length > 0;
    updateHud();
  }

  function recordScore() {
    const stored = readRecords();
    const best = Math.max(records[0]?.score ?? 0, stored[0]?.score ?? 0);
    if (score <= 0) return false;
    const combined = new Map([...records, ...stored].map((entry) => [entry.score + "/" + entry.date, entry]));
    records = [...combined.values(), { score, date: Date.now() }]
      .sort((a, b) => b.score - a.score || a.date - b.date)
      .slice(0, maxRecords);
    const persisted = writeStorage(scoreKey, JSON.stringify(records));
    paintRanking();
    if (!persisted) {
      $("ranking-note").hidden = false;
      $("ranking-note").textContent = "浏览器存储不可用，成绩保留到页面关闭。";
    }
    return score > best;
  }

  const multiplier = () => Math.min(5, Math.max(1, streak));
  const padded = (value) => String(value).padStart(4, "0");
  const dashing = () => dashKey || dashPointer !== null;
  const rankOf = (id) => loadout[id] ?? 0;
  const comboWindow = () => 4200 + rankOf("combo") * 1200;
  const bonusWindow = () => 5400 + rankOf("timer") * 2000;
  const dashValue = () => 5 + rankOf("dash") * 5;
  const chargedInterval = () => 5 - rankOf("charged");
  const breachCooldown = () => (15 - rankOf("breach") * 3) * 1000;
  const idAt = (x, y) => y * columns + x;
  const locate = (id) => [id % columns, Math.floor(id / columns)];

  function updateHud() {
    hud.score.textContent = padded(score);
    hud.best.textContent = padded(Math.max(records[0]?.score ?? 0, score));
    hud.combo.textContent = "×" + multiplier();
  }

  function paintBuild() {
    const entries = Object.entries(loadout).filter(([, rank]) => rank > 0);
    $("build-panel").hidden = entries.length === 0;
    $("build-list").replaceChildren(...entries.map(([id, rank]) => {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = perks[id].name + (id === "shield" ? "" : " 等级 " + rank + "/" + perks[id].cap);
      row.append(title, perks[id].effect(rank));
      return row;
    }));
    $("dash-value").textContent = String(dashValue());
    $("charged-legend").hidden = !rankOf("charged");
    breachStatus.hidden = !rankOf("breach");
    paintBreach();
  }

  function paintBreach() {
    if (breachStatus.hidden) return;
    const seconds = Math.max(0, Math.ceil((breachReadyAt - time) / 1000));
    const label = seconds ? "破障冷却 " + seconds + " 秒" : "破障可用";
    if (breachStatus.textContent !== label) breachStatus.textContent = label;
  }

  function paintRun() {
    const bar = $("run-progress");
    const remaining = Math.max(0, nextDraftAt - picked);
    const hasChoices = Object.entries(perks).some(([id, perk]) => rankOf(id) < perk.cap);
    $("run-strip").hidden = state === "ready";
    $("run-level").textContent = "已选强化 " + draftsTaken;
    $("run-next").textContent = state === "draft" ? "正在选择" : hasChoices ? "再吃 " + remaining + " 颗能量可强化" : "强化已满";
    bar.hidden = !hasChoices || state === "draft";
    bar.max = nextDraftAt === firstDraft ? firstDraft : draftInterval;
    bar.value = Math.max(0, bar.max - remaining);
  }

  function resetBuild() {
    loadout = {};
    offer = [];
    draftsTaken = resumeGrace = 0;
    nextDraftAt = firstDraft;
    chargedFood = null;
    chargedAt = Infinity;
    breachReadyAt = 0;
    paintBuild();
  }

  function offerPerks() {
    nextDraftAt += draftInterval;
    const available = Object.keys(perks).filter((id) => rankOf(id) < perks[id].cap);
    if (!available.length) return;

    const upgrades = available.filter((id) => id !== "shield" && rankOf(id) > 0);
    offer = upgrades.length ? [upgrades[Math.floor(Math.random() * upgrades.length)]] : [];
    if (offer.length) available.splice(available.indexOf(offer[0]), 1);
    while (offer.length < 3 && available.length) {
      const index = Math.floor(Math.random() * available.length);
      offer.push(available.splice(index, 1)[0]);
    }
    clearInputs();
    turns = [];
    previousSnake = snake;
    $("draft-copy").textContent = "已收集 " + picked + " 颗能量，选择后继续本局。";
    draftOptions.replaceChildren(...offer.map((id, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "draft-choice";
      button.dataset.perk = id;
      button.setAttribute("aria-keyshortcuts", String(index + 1));
      const number = document.createElement("span");
      number.className = "choice-key";
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(index + 1);
      const rank = rankOf(id);
      const next = rank + 1;
      const meta = document.createElement("span");
      meta.className = "choice-meta";
      const level = document.createElement("span");
      level.className = "choice-level";
      level.textContent = id === "shield" ? "充能 " + rank + " → " + next : rank ? "等级 " + rank + " → " + next : "新强化（等级 1）";
      meta.append(number, level);
      const title = document.createElement("strong");
      title.textContent = perks[id].name;
      const effect = document.createElement("span");
      effect.className = "choice-effect";
      effect.textContent = perks[id].effect(next);
      button.append(title, meta, effect);
      bindGameButton(button, () => choosePerk(index));
      return button;
    }));
    setState("draft");
    draftOptions.firstElementChild.focus({ preventScroll: true });
    tone(440, 660, 0.17, 0.08, "triangle");
    tone(660, 920, 0.18, 0.05, "sine", 0.08);
  }

  function choosePerk(index) {
    const id = offer[index];
    if (state !== "draft" || !id) return;
    loadout[id] = rankOf(id) + 1;
    if (id === "combo" && streak) comboUntil += 1200;
    if (id === "timer" && bonus) bonus.until += 2000;
    if (id === "charged") {
      chargedAt = Number.isFinite(chargedAt) ? Math.max(picked, chargedAt - 1) : picked + chargedInterval();
    }
    if (id === "breach") breachReadyAt = Math.max(time, breachReadyAt - 3000);
    offer = [];
    draftsTaken++;
    resumeGrace = 360;
    previousFrame = 0;
    paintBuild();
    setState("running");
    arena.focus({ preventScroll: true });
    tone(380, 760, 0.18, 0.08, "triangle");
  }

  function paintSound() {
    $("sound").setAttribute("aria-pressed", String(sound));
    $("sound-label").textContent = sound ? "音效开启" : "音效静音";
  }

  function unlockAudio() {
    if (!sound) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ??= new Audio();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch { audio = null; }
  }

  function tone(from, to, duration, gain, type, offset = 0) {
    if (!sound || audio?.state !== "running") return;
    const start = audio.currentTime + offset;
    const oscillator = audio.createOscillator();
    const amp = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    amp.gain.setValueAtTime(0.001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(amp).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function impact(x, y, color, amount, strength, label = "") {
    flash = strength * 0.85;
    flashColor = color;
    if (motionQuery.matches) return;
    shake = Math.max(shake, strength);
    for (let index = 0; index < amount; index++) {
      const angle = Math.random() * 2 * Math.PI;
      const velocity = 1 + Math.random() * 6;
      const life = 230 + Math.random() * 310;
      particles.push({
        x, y, dx: Math.cos(angle) * velocity, dy: Math.sin(angle) * velocity,
        life, duration: life, size: 0.06 + Math.random() * 0.12, color,
      });
    }
    if (particles.length > 96) particles.splice(0, particles.length - 96);
    ripples.push({ x, y, color, life: 360 });
    if (label) popups.push({ x, y, color, label, life: 720 });
    if (matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(strength > 0.75 ? [28, 30, 45] : 10);
  }

  function setState(next) {
    state = next;
    arena.dataset.state = state;
    overlay.hidden = state === "running" || state === "crash" || state === "draft";
    draft.hidden = state !== "draft";
    pauseButton.disabled = state !== "running" && state !== "paused";
    restartButton.disabled = state === "ready";
    const pauseLabel = state === "paused" ? "继续（P）" : "暂停（P）";
    pauseButton.setAttribute("aria-label", pauseLabel);
    pauseButton.title = pauseLabel;
    pauseButton.firstElementChild.className = state === "paused" ? "icon icon-resume" : "icon icon-pause";
    $("home").hidden = state !== "over";
    $("start-key").hidden = state === "over";
    if (state === "ready") {
      $("overlay-title").textContent = "准备开局";
      $("overlay-copy").textContent = "吃下 3 颗能量，解锁第一次随机强化。";
      $("primary-label").textContent = "开始游戏";
    } else if (state === "paused") {
      $("overlay-title").textContent = "游戏暂停";
      $("overlay-copy").textContent = "准备好了就接着冲。";
      $("primary-label").textContent = "继续游戏";
    } else if (state === "over") {
      $("primary-label").textContent = "再玩一次";
    }
    paintRun();
    requestFrame();
  }

  function sizeBoard() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = backdrop.width = Math.round(rect.width * scale);
    canvas.height = backdrop.height = Math.round(rect.height * scale);
    if (state === "ready") columns = Math.max(16, Math.min(32, Math.round(rows * rect.width / rect.height)));
    buildBackdrop();
    render(performance.now());
  }

  function buildBackdrop() {
    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / columns;
    const cellH = height / rows;
    const brush = backdropCtx;
    brush.fillStyle = palette.board;
    brush.fillRect(0, 0, width, height);
    brush.strokeStyle = palette["field-line"];
    brush.globalAlpha = 0.62;
    brush.lineWidth = 1;
    brush.beginPath();
    for (let x = 1; x < columns; x++) {
      const px = Math.round(x * cellW) + 0.5;
      brush.moveTo(px, 0);
      brush.lineTo(px, height);
    }
    for (let y = 1; y < rows; y++) {
      const py = Math.round(y * cellH) + 0.5;
      brush.moveTo(0, py);
      brush.lineTo(width, py);
    }
    brush.stroke();
    brush.globalAlpha = 1;
    const vignette = brush.createRadialGradient(width * 0.52, height * 0.42, 0, width * 0.52, height * 0.42, width * 0.6);
    vignette.addColorStop(0, palette.board + "00");
    vignette.addColorStop(1, palette["board-edge"] + "bb");
    brush.fillStyle = vignette;
    brush.fillRect(0, 0, width, height);
  }

  function clearInputs() {
    dashKey = false;
    dashPointer = null;
    swipe = null;
    dashButton.classList.remove("is-held");
  }

  function begin() {
    clearTimeout(finishTimer);
    unlockAudio();
    clearInputs();
    const y = Math.floor(rows / 2);
    snake = [4, 3, 2, 1].map((x) => idAt(x, y));
    previousSnake = snake.slice();
    occupied = new Set(snake);
    turns = [];
    heading = 1;
    obstacles.clear();
    food = idAt(7, y);
    bonus = null;
    score = picked = streak = longest = time = comboUntil = progress = shake = flash = 0;
    resetBuild();
    particles = [];
    ripples = [];
    popups = [];
    hud.meter.style.transform = "scaleX(0)";
    previousFrame = 0;
    updateHud();
    setState("running");
    arena.focus({ preventScroll: true });
    tone(220, 340, 0.13, 0.07, "triangle");
  }

  function home() {
    clearTimeout(finishTimer);
    score = picked = streak = 0;
    resetBuild();
    hud.meter.style.transform = "scaleX(0)";
    updateHud();
    setState("ready");
    sizeBoard();
    primary.focus({ preventScroll: true });
  }

  function togglePause() {
    if (state === "running") {
      clearInputs();
      setState("paused");
      primary.focus({ preventScroll: true });
    } else if (state === "paused" && !document.hidden) {
      unlockAudio();
      previousFrame = 0;
      setState("running");
      arena.focus({ preventScroll: true });
    }
  }

  function finish(reason, impactTile = snake[0]) {
    const newRecord = recordScore();
    clearInputs();
    previousSnake = snake;
    setState("crash");
    const [x, y] = locate(impactTile);
    const won = reason === "填满赛场";
    impact(x + 0.5, y + 0.5, won ? palette.lime : palette.orange, 42, 1);
    tone(won ? 330 : 135, won ? 660 : 45, 0.31, 0.1, "triangle");
    finishTimer = setTimeout(() => {
      $("overlay-title").textContent = won ? "赛场征服！" : newRecord ? "新纪录！" : "游戏结束";
      $("overlay-copy").textContent = reason + "，本局 " + score + " 分，最高连击 ×" + Math.min(5, longest || 1) + "。";
      setState("over");
      if (!document.hidden) primary.focus({ preventScroll: true });
    }, motionQuery.matches ? 90 : 440);
  }

  function queueTurn(next) {
    if (state !== "running" || turns.length >= 2) return;
    const last = turns.at(-1) ?? heading;
    if (next !== last && (next + 2) % 4 !== last) turns.push(next);
  }

  function inFoodRange(id, center = food) {
    if (center === null) return false;
    if (id === center) return true;
    const rank = rankOf("bloom");
    if (!rank) return false;
    const [x, y] = locate(id);
    const [centerX, centerY] = locate(center);
    const dx = Math.min(Math.abs(x - centerX), columns - Math.abs(x - centerX));
    const dy = Math.min(Math.abs(y - centerY), rows - Math.abs(y - centerY));
    return dx <= 1 && dy <= 1 && (rank > 1 || dx + dy === 1);
  }

  function freeTile(minDistance, maxDistance, allowNear = true) {
    const [headX, headY] = locate(snake[0]);
    const nearby = [];
    const fallback = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const id = idAt(x, y);
        if (occupied.has(id) || obstacles.has(id) || food === id || bonus?.id === id || chargedFood === id) continue;
        fallback.push(id);
        if (inFoodRange(id)) continue;
        const dx = Math.abs(x - headX);
        const dy = Math.abs(y - headY);
        const distance = Math.min(dx, columns - dx) + Math.min(dy, rows - dy);
        if (distance >= minDistance && distance <= maxDistance) nearby.push(id);
      }
    }
    const choices = nearby.length || !allowNear ? nearby : fallback;
    return choices[Math.floor(Math.random() * choices.length)] ?? null;
  }

  function nextFood() {
    if (picked <= 2) {
      const openingTile = idAt(7 + picked * 3, Math.floor(rows / 2));
      if (!occupied.has(openingTile)) return openingTile;
    }
    return freeTile(3, 8);
  }

  function step() {
    heading = turns.shift() ?? heading;
    const [dx, dy] = directions[heading];
    const [x, y] = locate(snake[0]);
    const nextX = (x + dx + columns) % columns;
    const nextY = (y + dy + rows) % rows;
    const target = idAt(nextX, nextY);
    const collectedFood = inFoodRange(target);
    const collectedBonus = target === bonus?.id;
    const collectedCharge = target === chargedFood;
    const grows = collectedFood && !(rankOf("short") && (picked + 1) % (4 - rankOf("short")) === 0);
    const tail = snake.at(-1);
    const hitObstacle = obstacles.has(target);
    const hitBody = occupied.has(target) && (target !== tail || grows);
    previousSnake = snake.slice();
    if (hitObstacle && rankOf("breach") && dashing() && time >= breachReadyAt) {
      obstacles.delete(target);
      breachReadyAt = time + breachCooldown();
      paintBreach();
      impact(nextX + 0.5, nextY + 0.5, palette.charged, 25, 0.54, "破障");
      tone(170, 410, 0.15, 0.09, "triangle");
    } else if (hitObstacle || hitBody) {
      if (!rankOf("shield")) {
        finish(hitObstacle ? "撞到障碍" : "撞到蛇身", target);
        return;
      }
      loadout.shield--;
      if (hitObstacle) obstacles.delete(target);
      if (hitBody) {
        for (const id of snake.splice(snake.indexOf(target))) occupied.delete(id);
      }
      impact(nextX + 0.5, nextY + 0.5, palette.gold, 25, 0.52, "护盾");
      tone(165, 340, 0.17, 0.09, "triangle");
      paintBuild();
      paintRun();
    }
    if (!grows) {
      occupied.delete(snake.pop());
    }
    snake.unshift(target);
    occupied.add(target);

    if (collectedFood || collectedBonus || collectedCharge) {
      let gained = 0;
      if (collectedFood || collectedBonus) {
        streak++;
        longest = Math.max(longest, streak);
        comboUntil = time + comboWindow();
        const base = (collectedFood ? 10 + rankOf("core") * 4 : 0) +
          (collectedBonus ? 30 + rankOf("gold") * 15 : 0);
        gained = base * multiplier() + (dashing() ? dashValue() : 0);
      }
      if (collectedCharge) {
        gained += 10;
        chargedFood = null;
      }
      score += gained;
      const color = collectedBonus ? palette.gold : collectedCharge ? palette.charged : palette.lime;
      impact(nextX + 0.5, nextY + 0.5, color, collectedBonus ? 28 : 14, collectedBonus ? 0.58 : 0.32, "+" + gained);
      const pitch = 310 + 105 * multiplier();
      tone(pitch, pitch * 1.65, 0.13, 0.1, "triangle");
      if (collectedBonus || multiplier() >= 3) tone(pitch * 1.5, pitch * 2.15, 0.15, 0.055, "sine", 0.045);

      if (collectedBonus) bonus = null;
      if (collectedFood) {
        picked++;
        food = null;
        food = nextFood();
        if (food === null && bonus) {
          food = bonus.id;
          bonus = null;
        }
        if (food === null && chargedFood !== null) {
          food = chargedFood;
          chargedFood = null;
        }
        if (food !== null && chargedFood === null && picked >= chargedAt) {
          chargedFood = freeTile(4, 8);
          if (chargedFood !== null) chargedAt = picked + chargedInterval();
        }
        if (!bonus && picked % 4 === 0) {
          const id = freeTile(3, 9);
          if (id !== null) bonus = { id, until: time + bonusWindow() };
        }
        if (picked % 6 === 0 && obstacles.size < 12) {
          const id = freeTile(7, Infinity, false);
          if (id !== null) obstacles.add(id);
        }
      }
      updateHud();
    }
    if (food === null && bonus === null) {
      finish("填满赛场");
    } else if (collectedFood) {
      if (picked === nextDraftAt) offerPerks();
      paintRun();
    }
  }

  function advance(delta) {
    if (resumeGrace > 0) {
      resumeGrace = Math.max(0, resumeGrace - delta);
      return;
    }
    time += delta;
    if (rankOf("breach")) paintBreach();
    if (streak && time >= comboUntil) {
      streak = 0;
      updateHud();
    }
    if (bonus && time >= bonus.until) bonus = null;
    const interval = (Math.max(76, 154 - picked * 2.5) + rankOf("slow") * 12) * (dashing() ? 0.56 : 1);
    progress += delta / interval;
    while (progress >= 1 && state === "running") {
      progress -= 1;
      step();
    }
    if (streak || hud.meter.style.transform !== "scaleX(0)") {
      const remaining = streak ? Math.max(0, (comboUntil - time) / comboWindow()) : 0;
      hud.meter.style.transform = "scaleX(" + remaining.toFixed(3) + ")";
    }
  }

  function updateEffects(delta) {
    shake = Math.max(0, shake - delta / 280);
    flash = Math.max(0, flash - delta / 310);
    const seconds = delta / 1000;
    for (const particle of particles) {
      particle.x += particle.dx * seconds;
      particle.y += particle.dy * seconds;
      particle.dy += seconds * 3;
      particle.life -= delta;
    }
    for (const ring of ripples) ring.life -= delta;
    for (const popup of popups) popup.life -= delta;
    if (particles.some((particle) => particle.life <= 0)) particles = particles.filter((particle) => particle.life > 0);
    if (ripples.some((ring) => ring.life <= 0)) ripples = ripples.filter((ring) => ring.life > 0);
    if (popups.some((popup) => popup.life <= 0)) popups = popups.filter((popup) => popup.life > 0);
  }

  function roundedRect(x, y, width, height, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function drawSegment(x, y, index, count, face, pulse = 0) {
    const head = index === 0;
    const fade = index / count;
    const size = head ? 0.91 + pulse : 0.84 - fade * 0.12;
    const offset = (1 - size) / 2;
    const bodyColor = fade > 0.73 ? palette["snake-tail"] : fade > 0.36 ? palette["deep-lime"] : palette.lime;
    roundedRect(x + offset - 0.025, y + offset + 0.065, size + 0.05, size, 0.13, palette["snake-rim"]);
    roundedRect(x + offset, y + offset, size, size, 0.12, head ? palette["snake-head"] : bodyColor);
    ctx.globalAlpha *= head ? 0.62 : 0.27;
    roundedRect(x + offset + 0.12, y + offset + 0.1, size - 0.24, 0.09, 0.035, palette["food-core"]);
    ctx.globalAlpha /= head ? 0.62 : 0.27;
    if (head) {
      const [dx, dy] = directions[face];
      for (const side of [-1, 1]) {
        const eyeX = x + 0.5 + dx * 0.21 - dy * side * 0.18;
        const eyeY = y + 0.5 + dy * 0.21 + dx * side * 0.18;
        roundedRect(eyeX - 0.063, eyeY - 0.063, 0.126, 0.126, 0.025, palette["lime-ink"]);
      }
    }
  }

  function diamond(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawFood(x, y, clock, special = false, alpha = 1, size = 1) {
    const pulse = motionQuery.matches ? 0 : Math.sin(clock / 215) * 0.036;
    const color = special ? palette.gold : palette.lime;
    ctx.globalAlpha = alpha;
    diamond(x, y, (0.57 + pulse * 2) * size, special ? palette["bonus-glow"] : palette["food-glow"]);
    diamond(x, y, (0.34 + pulse) * size, color);
    diamond(x, y, (0.15 + pulse) * size, palette["food-core"]);
    if (special) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.045;
      ctx.beginPath();
      ctx.arc(x, y, 0.55, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * alpha);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBaseFood(clock) {
    const [x, y] = locate(food);
    const rank = rankOf("bloom");
    if (rank) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tileX = (x + dx + columns) % columns;
          const tileY = (y + dy + rows) % rows;
          const id = idAt(tileX, tileY);
          if (!inFoodRange(id) || obstacles.has(id)) continue;
          roundedRect(tileX + 0.03, tileY + 0.03, 0.94, 0.94, 0.14, palette["food-glow"]);
        }
      }
    }
    drawFood(x + 0.5, y + 0.5, clock, false, 1, 1 + rank * 0.22);
  }

  function drawChargedFood() {
    const [x, y] = locate(chargedFood);
    diamond(x + 0.5, y + 0.5, 0.58, palette["charged-glow"]);
    diamond(x + 0.5, y + 0.5, 0.41, palette.charged);
    roundedRect(x + 0.28, y + 0.45, 0.44, 0.1, 0.03, palette["lime-ink"]);
    roundedRect(x + 0.45, y + 0.28, 0.1, 0.44, 0.03, palette["lime-ink"]);
  }

  function drawObstacle(x, y) {
    roundedRect(x + 0.08, y + 0.08, 0.84, 0.84, 0.1, palette["hazard-line"]);
    roundedRect(x + 0.135, y + 0.135, 0.73, 0.73, 0.07, palette["hazard-fill"]);
    ctx.beginPath();
    ctx.moveTo(x + 0.32, y + 0.32);
    ctx.lineTo(x + 0.68, y + 0.68);
    ctx.moveTo(x + 0.68, y + 0.32);
    ctx.lineTo(x + 0.32, y + 0.68);
    ctx.strokeStyle = palette.orange;
    ctx.lineWidth = 0.06;
    ctx.stroke();
  }

  function previewPath(points) {
    const cells = [points[0]];
    for (let index = 1; index < points.length; index++) {
      const [targetX, targetY] = points[index];
      let [x, y] = points[index - 1];
      while (x !== targetX || y !== targetY) {
        x += Math.sign(targetX - x);
        y += Math.sign(targetY - y);
        cells.push([x, y]);
      }
    }
    return cells;
  }

  const largePreview = previewPath([[9, 8], [5, 8], [5, 11], [7, 11], [7, 14], [2, 14], [2, 5], [4, 5], [4, 2]]);
  const smallPreview = previewPath([[8, 14], [5, 14], [5, 15], [2, 15], [2, 11], [1, 11], [1, 9]]);
  const idleSparks = [[0.1, 0.18], [0.24, 0.16], [0.39, 0.14], [0.66, 0.14], [0.76, 0.26], [0.89, 0.19], [0.94, 0.42], [0.88, 0.78], [0.73, 0.87], [0.55, 0.88], [0.31, 0.83], [0.13, 0.73]];

  function drawPreview(clock) {
    const compact = columns < 23;
    const path = compact ? smallPreview : largePreview;
    for (let index = path.length - 1; index >= 0; index--) {
      const [x, y] = path[index];
      ctx.globalAlpha = compact ? 0.46 : 0.95 - index / path.length * 0.59;
      drawSegment(x, y, index, path.length, 1);
    }
    ctx.globalAlpha = 1;
    if (compact) {
      drawFood(columns - 3.5, 3.2, clock, true, 0.75);
      drawFood(2.2, 3.6, clock + 230, false, 0.7);
    } else {
      drawFood(11.45, 8.5, clock);
      drawFood(columns - 4.8, 4.5, clock + 300, true, 0.87);
      drawFood(columns - 6.9, 12.75, clock + 650, false, 0.65);
      drawObstacle(columns - 4, 10);
      drawObstacle(columns - 4, 11);
    }
    for (const [index, [x, y]] of idleSparks.entries()) {
      ctx.globalAlpha = motionQuery.matches ? 0.24 : 0.24 + 0.16 * Math.sin(clock / 440 + index);
      diamond(x * columns, y * rows, index % 3 === 0 ? 0.085 : 0.06, palette.lime);
    }
    ctx.globalAlpha = 1;
  }

  function drawSnake() {
    const interpolation = Math.max(0, Math.min(1, progress));
    for (let index = snake.length - 1; index >= 0; index--) {
      const [x, y] = locate(snake[index]);
      const [oldX, oldY] = locate(previousSnake[index] ?? snake[index]);
      let dx = x - oldX;
      let dy = y - oldY;
      if (Math.abs(dx) > 1) dx -= Math.sign(dx) * columns;
      if (Math.abs(dy) > 1) dy -= Math.sign(dy) * rows;
      const movingX = oldX + dx * interpolation;
      const movingY = oldY + dy * interpolation;
      const pulse = index === 0 && !motionQuery.matches ? flash * 0.22 : 0;
      drawSegment(movingX, movingY, index, snake.length, heading, pulse);
      if (movingX < 0) drawSegment(movingX + columns, movingY, index, snake.length, heading, pulse);
      if (movingY < 0) drawSegment(movingX, movingY + rows, index, snake.length, heading, pulse);
      if (movingX > columns - 1) drawSegment(movingX - columns, movingY, index, snake.length, heading, pulse);
      if (movingY > rows - 1) drawSegment(movingX, movingY - rows, index, snake.length, heading, pulse);
    }
  }

  function drawEffects() {
    for (const particle of particles) {
      ctx.globalAlpha = particle.life / particle.duration;
      diamond(particle.x, particle.y, particle.size * (0.5 + ctx.globalAlpha * 0.5), particle.color);
    }
    for (const ring of ripples) {
      ctx.globalAlpha = ring.life / 500;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 0.35 + (1 - ring.life / 360) * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (popups.length) {
      ctx.font = "bold 0.67px monospace";
      ctx.textAlign = "center";
      ctx.lineWidth = 0.11;
      ctx.strokeStyle = palette["board-edge"];
      for (const popup of popups) {
        ctx.globalAlpha = Math.min(1, popup.life / 260);
        ctx.fillStyle = popup.color;
        const x = Math.max(0.85, Math.min(columns - 0.85, popup.x));
        const y = Math.max(0.68, popup.y - 0.45 - (1 - popup.life / 720) * 1.5);
        ctx.strokeText(popup.label, x, y);
        ctx.fillText(popup.label, x, y);
      }
    }
    ctx.globalAlpha = 1;
    if (flash > 0) {
      ctx.globalAlpha = flash * (motionQuery.matches ? 0.1 : 0.35);
      ctx.strokeStyle = flashColor;
      ctx.lineWidth = 0.2;
      ctx.strokeRect(0.09, 0.09, columns - 0.18, rows - 0.18);
      ctx.globalAlpha = 1;
    }
  }

  function render(clock) {
    if (!canvas.width || !canvas.height) return;
    const activeShake = motionQuery.matches ? 0 : shake;
    const shiftX = activeShake * Math.sin(clock * 0.13) * 0.35;
    const shiftY = activeShake * Math.cos(clock * 0.17) * 0.27;
    ctx.resetTransform();
    ctx.drawImage(backdrop, 0, 0);
    const scaleX = canvas.width / columns;
    const scaleY = canvas.height / rows;
    ctx.setTransform(scaleX, 0, 0, scaleY, shiftX * scaleX, shiftY * scaleY);
    if (state === "ready") {
      drawPreview(clock);
    } else {
      const animationTime = state === "running" ? clock : time;
      for (const id of obstacles) drawObstacle(...locate(id));
      if (food !== null) drawBaseFood(animationTime);
      if (chargedFood !== null) drawChargedFood();
      if (bonus) {
        const [x, y] = locate(bonus.id);
        drawFood(x + 0.5, y + 0.5, animationTime, true, 0.35 + 0.65 * (bonus.until - time) / bonusWindow());
      }
      drawSnake();
      drawEffects();
    }
  }

  function requestFrame() {
    if (!pendingFrame && !document.hidden) pendingFrame = requestAnimationFrame(frame);
  }

  function frame(clock) {
    pendingFrame = 0;
    const delta = previousFrame ? Math.min(48, clock - previousFrame) : 0;
    previousFrame = clock;
    if (state === "running") advance(delta);
    if (state === "running" || state === "crash" || state === "over") updateEffects(delta);
    render(clock);
    if (state === "running" || state === "crash" || (state === "over" && (particles.length || ripples.length || popups.length || flash)) ||
        (state === "ready" && !motionQuery.matches)) requestFrame();
  }

  function bindGameButton(button, action) {
    let lastTouch = -Infinity;
    button.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch" || button.disabled ||
          !button.contains(document.elementFromPoint(event.clientX, event.clientY))) return;
      // Commit quick taps even when the browser suppresses a click after a swipe.
      lastTouch = performance.now();
      action();
    });
    button.addEventListener("click", (event) => {
      if (event.detail > 0 && event.pointerType !== "mouse" && performance.now() - lastTouch < 600) return;
      action();
    });
  }

  bindGameButton(primary, () => state === "paused" ? togglePause() : begin());
  bindGameButton(pauseButton, togglePause);
  bindGameButton(restartButton, begin);
  bindGameButton($("home"), home);
  $("sound").addEventListener("click", () => {
    sound = !sound;
    writeStorage(audioKey, sound ? "on" : "off");
    paintSound();
    unlockAudio();
    tone(330, 450, 0.1, 0.07, "triangle");
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const code = event.code;
    const buttonFocused = event.target instanceof HTMLButtonElement && !event.target.disabled;
    if (state === "draft" && /^(Digit|Numpad)[1-3]$/.test(code)) {
      event.preventDefault();
      if (!event.repeat) choosePerk(Number(code.at(-1)) - 1);
    } else if (keyDirections.has(code) && state === "running") {
      event.preventDefault();
      if (!event.repeat) queueTurn(keyDirections.get(code));
    } else if (code === "Space" && (!buttonFocused || (state === "running" && event.target === dashButton))) {
      event.preventDefault();
      if (event.repeat) return;
      if (state === "ready" || state === "over") begin();
      else if (state === "paused") togglePause();
      else if (state === "running") dashKey = true;
    } else if (code === "KeyP" || code === "Escape") {
      if (!event.repeat && (state === "running" || state === "paused")) {
        event.preventDefault();
        togglePause();
      }
    } else if (code === "KeyR" && !event.repeat && state !== "ready") {
      event.preventDefault();
      begin();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") dashKey = false;
  });

  for (const button of document.querySelectorAll("[data-direction]")) {
    const turn = () => queueTurn(Number(button.dataset.direction));
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); turn(); });
    button.addEventListener("click", (event) => { if (event.detail === 0) turn(); });
  }
  dashButton.addEventListener("pointerdown", (event) => {
    if (state !== "running" || dashPointer !== null) return;
    event.preventDefault();
    dashPointer = event.pointerId;
    dashButton.setPointerCapture(event.pointerId);
    dashButton.classList.add("is-held");
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    dashButton.addEventListener(name, (event) => {
      if (event.pointerId !== dashPointer) return;
      dashPointer = null;
      dashButton.classList.remove("is-held");
    });
  }

  arena.addEventListener("pointerdown", (event) => {
    if (state !== "running" || event.pointerType === "mouse" || swipe) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    arena.setPointerCapture(event.pointerId);
  });
  arena.addEventListener("pointermove", (event) => {
    if (swipe?.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
    queueTurn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    swipe.x = event.clientX;
    swipe.y = event.clientY;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    arena.addEventListener(name, (event) => { if (swipe?.id === event.pointerId) swipe = null; });
  }

  window.addEventListener("blur", () => {
    clearInputs();
    if (state === "running") togglePause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state === "running") togglePause();
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    } else {
      previousFrame = 0;
      requestFrame();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === scoreKey || event.key === null) {
      records = readRecords();
      paintRanking();
    }
  });
  motionQuery.addEventListener("change", requestFrame);
  new ResizeObserver(sizeBoard).observe(canvas);
  paintRanking();
  paintSound();
  sizeBoard();
  requestFrame();
})();
