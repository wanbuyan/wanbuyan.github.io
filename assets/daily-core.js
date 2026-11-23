/* 北京时间排期：插图按小时，金句按天；相同时间段使用相同选择。 */
(function (root) {
  "use strict";
  const DAY = 86400000;
  const HOUR = 3600000;
  const OFFSET = 8 * 3600000;
  const epoch = Date.UTC(2026, 10, 23) / DAY;
  function dayIndex(now = Date.now()) { return Math.max(0, Math.floor((new Date(now).getTime() + OFFSET) / DAY) - epoch); }
  function dateKey(now = Date.now()) { return new Date(new Date(now).getTime() + OFFSET).toISOString().slice(0, 10); }
  function hourIndex(now = Date.now()) { return Math.max(0, Math.floor((new Date(now).getTime() + OFFSET) / HOUR) - epoch * 24); }
  function hourKey(now = Date.now()) { return new Date(new Date(now).getTime() + OFFSET).toISOString().slice(0, 13); }
  function untilNextHour(now = Date.now()) { const time = new Date(now).getTime(); return HOUR - ((time + OFFSET) % HOUR) + 80; }
  function untilMidnight(now = Date.now()) { const time = new Date(now).getTime(); return DAY - ((time + OFFSET) % DAY) + 80; }
  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }
  function shuffled(items, seed) {
    let state = seed;
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      state += 0x6D2B79F5;
      let value = Math.imul(state ^ state >>> 15, 1 | state);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      const j = Math.floor(((value ^ value >>> 14) >>> 0) / 4294967296 * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function pick(items, count, day = dayIndex(), namespace = "default", identity = item => item.id) {
    const catalog = [...new Map(items.map(item => [String(identity(item)), item])).entries()]
      .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const size = catalog.length;
    if (!size) return [];
    const amount = Math.min(Math.max(0, Math.floor(count)), size);
    const seed = namespace + ":2026-11-23:" + catalog.map(item => item[0]).join("\u001f");
    const raw = round => shuffled(catalog, hash(seed + ":" + round));
    const cycles = new Map();
    function cycle(round) {
      if (!cycles.has(round)) {
        const list = raw(round);
        // 奇数图集跨轮补齐双图时，不让同一张图占据当天两个位置。
        if (size >= 3 && round > 0 && list[0][0] === raw(round - 1).at(-1)[0]) [list[0], list[1]] = [list[1], list[0]];
        cycles.set(round, list);
      }
      return cycles.get(round);
    }
    const start = Math.max(0, Math.floor(day)) * amount;
    return Array.from({ length: amount }, (_, slot) => {
      const position = start + slot;
      return cycle(Math.floor(position / size))[position % size][1];
    });
  }
  const artworkSchedules = new Map();
  function artworkSchedule(items, relations) {
    const catalog = [...new Map(items.map(item => [String(item.id), item])).values()]
      .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
    const canonical = name => relations.aliases?.[name] || name;
    const key = (a, b) => [a, b].sort().join("\u001f");
    const links = new Map();
    function register(a, b, relation, priority) {
      const pairKey = key(canonical(a), canonical(b));
      if (!links.has(pairKey) || links.get(pairKey).priority < priority) links.set(pairKey, { relation, priority });
    }
    for (const [a, b, relation] of relations.links || []) register(a, b, relation, 3);
    for (const group of relations.groups || []) for (let i = 0; i < group.characters.length; i++) {
      for (let j = i + 1; j < group.characters.length; j++) register(group.characters[i], group.characters[j], group.relation, group.close ? 3 : 1);
    }
    const seed = "related-artworks-v1:" + catalog.map(item => item.id + ":" + canonical(item.character)).join("|") +
      JSON.stringify([...links].sort((a, b) => a[0] < b[0] ? -1 : 1));
    if (artworkSchedules.has(seed)) return artworkSchedules.get(seed);
    const edges = catalog.map(() => new Map());
    for (let i = 0; i < catalog.length; i++) for (let j = i + 1; j < catalog.length; j++) {
      const a = canonical(catalog[i].character), b = canonical(catalog[j].character);
      const link = a === b ? { relation: a + " · 不同画像", priority: 3 } : links.get(key(a, b));
      if (link) { edges[i].set(j, link); edges[j].set(i, link); }
    }
    const eligible = catalog.map((_, i) => i).filter(i => edges[i].size);
    const schedule = { catalog, seed, edges, eligible, counts: catalog.map(() => 0), rounds: [], slots: 0 };
    // 更换图集或关系时重新排期；限制缓存，避免长期打开页面积累旧目录。
    if (artworkSchedules.size >= 4) artworkSchedules.delete(artworkSchedules.keys().next().value);
    artworkSchedules.set(seed, schedule);
    return schedule;
  }
  function addArtworkRound(schedule) {
    const { catalog, edges, eligible, counts, seed } = schedule;
    const round = schedule.rounds.length;
    const order = shuffled(eligible, hash(seed + ":nodes:" + round));
    const rank = new Map(order.map((id, i) => [id, i]));
    const available = new Set(order), pairs = [];
    // 先照顾前轮落单的图片，再处理可选搭档较少的人物；一轮内每图最多出现一次。
    while (available.size > 1) {
      const choices = [...available].map(id => ({ id, neighbors: [...edges[id].keys()].filter(other => available.has(other)) }))
        .filter(item => item.neighbors.length)
        .sort((a, b) => counts[a.id] - counts[b.id] || a.neighbors.length - b.neighbors.length || rank.get(a.id) - rank.get(b.id));
      if (!choices.length) break;
      const { id, neighbors } = choices[0];
      neighbors.sort((a, b) => counts[a] - counts[b] || edges[id].get(b).priority - edges[id].get(a).priority || rank.get(a) - rank.get(b));
      const other = neighbors[0];
      available.delete(id); available.delete(other);
      pairs.push({ artworks: [catalog[id], catalog[other]], relation: edges[id].get(other).relation });
    }
    for (const pair of pairs) for (const artwork of pair.artworks) counts[catalog.indexOf(artwork)]++;
    const result = shuffled(pairs, hash(seed + ":pairs:" + round));
    schedule.rounds.push(result);
    schedule.slots += result.length;
  }
  function pickArtworks(items, relations = {}, slot = hourIndex()) {
    const schedule = artworkSchedule(items, relations);
    const position = Math.max(0, Math.floor(slot));
    if (!schedule.eligible.length) return { artworks: [], relation: "", round: 0, roundLength: 0 };
    while (schedule.slots <= position) addArtworkRound(schedule);
    let offset = position;
    for (let round = 0; round < schedule.rounds.length; round++) {
      const pairs = schedule.rounds[round];
      if (offset < pairs.length) return { ...pairs[offset], round, roundLength: pairs.length };
      offset -= pairs.length;
    }
  }
  function normalizeQuotes(rows) {
    const headerIndex = rows.findIndex(row => row.some(value => String(value ?? "").trim()));
    if (headerIndex < 0) throw new Error("Excel 为空，请填写出处、作者、内容三列表头。");
    const header = rows[headerIndex].map(value => String(value ?? "").trim());
    const columns = ["出处", "作者", "内容"].map(name => header.indexOf(name));
    if (columns.some(index => index < 0) || ["出处", "作者", "内容"].some(name => header.filter(value => value === name).length !== 1)) throw new Error("表头需要包含且不能重复：出处、作者、内容。");
    const result = new Map();
    for (const row of rows.slice(headerIndex + 1)) {
      const [source, author, content] = columns.map(index => String(row[index] ?? "").trim());
      if (!content) continue;
      const id = [source, author, content].join("\u001e");
      if (!result.has(id)) result.set(id, { id, source, author, content });
    }
    if (!result.size) throw new Error("没有可展示的金句，请在“内容”列填写正文。");
    return [...result.values()];
  }
  const api = { dayIndex, dateKey, untilMidnight, hourIndex, hourKey, untilNextHour, pick, pickArtworks, normalizeQuotes };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BlogDaily = api;
})(typeof window === "object" ? window : globalThis);
