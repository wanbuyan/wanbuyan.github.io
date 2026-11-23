"use strict";
(() => {
  const daily = window.BlogDaily;
  const sampleRows = [["出处", "作者", "内容"], ["蝶恋花", "晏殊", "昨夜西风凋碧树，独上高楼，望尽天涯路。"]];
  const cacheKey = "wanbuyan-local-quote-workbook-v1";
  let quotes = daily.normalizeQuotes(sampleRows);
  let displayedDate = "";
  let displayedHour = "";
  let updateTimer;
  let loadVersion = 0;
  const artworkCards = [...document.querySelectorAll("#hero-art-pages .art-page")];
  const quoteContent = document.querySelector("#daily-quote-content");
  const quoteSource = document.querySelector("#daily-quote-source");
  const localTools = document.querySelector("#local-quote-tools");
  const localStatus = document.querySelector("#local-quote-status");

  function renderQuote() {
    const quote = daily.pick(quotes, 1, daily.dayIndex(), "quotes")[0];
    quoteContent.textContent = quote.content;
    const source = quote.source ? (/^[《〈]/.test(quote.source) ? quote.source : "《" + quote.source + "》") : "";
    quoteSource.textContent = [quote.author, source].filter(Boolean).join("");
    document.querySelector("#daily-quote-attribution").hidden = !quote.author && !quote.source;
    document.querySelector("#daily-quote").dataset.date = daily.dateKey();
  }
  function renderArtworks() {
    const pair = daily.pickArtworks(window.BLOG_ARTWORKS || [], window.BLOG_ARTWORK_RELATIONS, daily.hourIndex());
    const selected = pair.artworks;
    artworkCards.forEach((card, index) => {
      const artwork = selected[index];
      card.hidden = !artwork;
      if (!artwork) return;
      const image = card.querySelector("img");
      image.src = artwork.src;
      image.width = artwork.width;
      image.height = artwork.height;
      image.alt = "戴敦邦绘：" + artwork.character;
      card.dataset.artworkId = artwork.id;
      card.querySelector(".art-name").textContent = artwork.character;
      card.querySelector(".art-description").textContent = artwork.description;
    });
    document.querySelector("#inscription-note").hidden = !selected.some(artwork => artwork.description.includes("〔未辨〕"));
    document.querySelector("#hero-art-pages").dataset.date = daily.dateKey();
    document.querySelector("#hero-art-pages").dataset.hour = daily.hourKey();
    const relation = document.querySelector("#artwork-relation");
    relation.textContent = pair.relation;
    relation.hidden = !pair.relation;
  }
  function applyRows(rows) {
    quotes = daily.normalizeQuotes(rows);
    renderQuote();
    return quotes.length;
  }
  async function loadOnlineQuotes() {
    if (location.protocol === "file:") return;
    const version = ++loadVersion;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL("金句/金句.xlsx", document.baseURI);
      url.searchParams.set("updated", String(Date.now()));
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Excel HTTP " + response.status);
      const buffer = await response.arrayBuffer();
      const rows = await window.QuoteWorkbook.read(buffer);
      if (version === loadVersion) { applyRows(rows); document.querySelector("#daily-quote").dataset.input = "excel"; }
    } catch (error) {
      console.warn("金句 Excel 暂未读取，保留已载入的金句。", error.message);
    } finally { clearTimeout(timeout); }
  }
  function checkSchedule() {
    const today = daily.dateKey();
    const hour = daily.hourKey();
    if (hour !== displayedHour) {
      displayedHour = hour;
      renderArtworks();
    }
    if (today !== displayedDate) {
      displayedDate = today;
      renderQuote();
      loadOnlineQuotes();
    }
    clearTimeout(updateTimer);
    updateTimer = setTimeout(checkSchedule, daily.untilNextHour());
  }

  if (location.protocol === "file:") {
    localTools.hidden = false;
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey));
      if (saved?.rows) { const count = applyRows(saved.rows); document.querySelector("#daily-quote").dataset.input = "local"; localStatus.textContent = "已使用本地导入的 " + count + " 条金句。修改 Excel 后需重新选择文件。"; }
    } catch {}
    document.querySelector("#local-quote-file").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      localStatus.textContent = "正在读取 Excel…";
      try {
        if (!/\.xlsx$/i.test(file.name)) throw new Error("请选择 .xlsx 格式；旧版 .xls 请先另存为 .xlsx。");
        const rows = await window.QuoteWorkbook.read(await file.arrayBuffer());
        const count = applyRows(rows);
        document.querySelector("#daily-quote").dataset.input = "local";
        let cached = true;
        try { localStorage.setItem(cacheKey, JSON.stringify({ rows })); } catch { cached = false; }
        localStatus.textContent = "已导入 " + count + " 条金句，首页已更新。" + (cached ? "本地预览已记住该文件内容。" : "当前浏览器无法保存，下次打开需重新选择。");
      } catch (error) { localStatus.textContent = "导入失败：" + error.message; }
      event.target.value = "";
    });
  }
  checkSchedule();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkSchedule(); });
  window.addEventListener("pageshow", checkSchedule);
})();
