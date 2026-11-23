/* 在游戏脚本之前显示加载层；游戏初始化后发送 blog:page-ready。 */
(() => {
  "use strict";
  const script = document.currentScript;
  if (!script || !window.HTMLDialogElement || window.BlogPageTransition) return;
  const navigationOnly = script.dataset.mode === "navigation";
  const navigationApi = {
    navigate(href, title) {
      if (document.getElementById("blog-page-transition")) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) { location.assign(url.href); return; }
      mount({ title, destination: url });
    }
  };
  if (navigationOnly) window.BlogPageTransition = navigationApi;
  else mount({ title: script.dataset.title || "页面" });

  function mount({ title, destination = null }) {
    const root = document.documentElement;
    const minimumVisibleTime = 1600;
    const fadeInTime = 360;
    const fadeOutTime = 420;
    let visibleAt = null;
    const entryAnimations = [];
    const currentUrl = new URL(location.href);
    const previousStart = Number(currentUrl.searchParams.get("_transition"));
    const elapsed = Date.now() - previousStart;
    const continuing = !destination && previousStart > 0 && elapsed >= 0 && elapsed < 15000;
    const dialog = document.createElement("dialog");
    dialog.id = "blog-page-transition";
    dialog.setAttribute("aria-labelledby", "page-transition-title");
    dialog.setAttribute("aria-describedby", "page-transition-status");
    dialog.innerHTML = '<a class="page-transition-brand">万不言的博客</a><div class="page-transition-center"><h1 class="page-transition-title" id="page-transition-title"></h1><p class="page-transition-status" id="page-transition-status" role="status" aria-live="polite">正在加载</p><div class="page-transition-dots" aria-hidden="true"><span></span><span></span><span></span></div><button class="page-transition-retry" type="button" hidden>重新加载</button></div><a class="page-transition-return">返回博客</a>';
    dialog.querySelector("h1").textContent = title;
    if (destination) dialog.classList.add("is-departing");
    if (continuing) {
      dialog.classList.add("is-visible");
      visibleAt = performance.now() - elapsed;
      currentUrl.searchParams.delete("_transition");
      try { history.replaceState(history.state, "", currentUrl.href); } catch {}
    }
    const blog = new URL("../index.html", script.src);
    dialog.querySelector(".page-transition-brand").href = blog.href + "#home";
    dialog.querySelector(".page-transition-return").href = blog.href + "#games";
    const status = dialog.querySelector(".page-transition-status");
    const retry = dialog.querySelector("button");
    let ready = script.dataset.wait !== "game";
    let parsed = document.readyState !== "loading";
    let leaving = false;
    let destroyed = false;
    let failed = false;
    let finishTimer;
    let paintTimer;
    let removeTimer;
    let slowTimer;
    let observer;
    let revealTimer;
    let navigationTimer;
    // 放在 body 外，使游戏自己的布局、字体和弹窗样式不会覆盖加载层。
    root.append(dialog);
    function front() {
      if (destroyed || leaving) return;
      if (dialog.open) dialog.close();
      dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
    function restoreFocus() {
      const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
      const target = modal?.querySelector("[autofocus], input:checked, button:not(:disabled):not([hidden])");
      target?.focus({ preventScroll: true });
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const timer of [finishTimer, paintTimer, removeTimer, slowTimer, revealTimer, navigationTimer]) clearTimeout(timer);
      observer?.disconnect();
      root.classList.remove("blog-page-loading");
      root.classList.remove("blog-page-departing");
      window.removeEventListener("blog:page-ready", onReady);
      window.removeEventListener("error", onError, true);
      window.removeEventListener("pagehide", destroy);
      document.removeEventListener("DOMContentLoaded", onParsed);
      if (dialog.open) dialog.close();
      dialog.remove();
      for (const animation of entryAnimations) animation.cancel();
      if (navigationOnly) window.BlogPageTransition = navigationApi;
      restoreFocus();
    }
    function finish() {
      if (destroyed || leaving || failed || !parsed || !ready) return;
      // 保持同一个加载层淡出，避免关闭再打开弹窗时露出中间画面。
      leaving = true;
      observer?.disconnect();
      clearTimeout(slowTimer);
      root.classList.remove("blog-page-loading");
      dialog.classList.add("is-leaving");
      removeTimer = setTimeout(destroy, fadeOutTime + 20);
    }
    function checkReady() {
      if (destination || destroyed || leaving || failed || !parsed || !ready || visibleAt === null || finishTimer !== undefined) return;
      const delay = Math.max(0, visibleAt + minimumVisibleTime + fadeInTime - performance.now());
      finishTimer = setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(finish));
        // 后台标签页可能暂停绘制，仍需释放已经准备完成的页面。
        paintTimer = setTimeout(finish, 150);
      }, delay);
    }
    function reveal() {
      if (destroyed || visibleAt !== null) return;
      visibleAt = performance.now();
      dialog.classList.add("is-visible");
      // 使用同一组时间轴；弹窗置顶时 display 的短暂切换不会重置渐入。
      if (typeof dialog.animate === "function") {
        for (const element of dialog.children) entryAnimations.push(element.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fadeInTime, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "both" }
        ));
        if (destination) entryAnimations.push(dialog.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fadeInTime, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "both" }
        ));
      }
      if (destination) {
        destination.searchParams.set("_transition", String(Date.now()));
        navigationTimer = setTimeout(() => location.assign(destination.href), fadeInTime + 40);
      }
      checkReady();
    }
    function onReady() { ready = true; checkReady(); }
    function onParsed() { parsed = true; checkReady(); }
    function onError(event) {
      if (destroyed || leaving) return;
      const element = event.target;
      const resourceError = element instanceof HTMLScriptElement || element instanceof HTMLLinkElement && element.getAttribute("href") === "style.css";
      if (!resourceError && !(event instanceof ErrorEvent && event.filename)) return;
      failed = true;
      clearTimeout(slowTimer);
      dialog.classList.add("has-error");
      status.textContent = "加载失败，请重试或返回博客。";
      retry.hidden = false;
    }
    try {
      root.classList.add(destination ? "blog-page-departing" : "blog-page-loading");
      front();
      // 保持象棋原有的开始弹窗打开，同时避免它抢到加载层上方。
      observer = new MutationObserver(records => {
        if (records.some(record => record.target !== dialog && record.target instanceof HTMLDialogElement && record.target.open)) front();
      });
      observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["open"] });
    } catch {
      destroy();
      return;
    }
    dialog.addEventListener("cancel", event => event.preventDefault());
    for (const name of ["keydown", "keyup", "keypress"]) dialog.addEventListener(name, event => event.stopPropagation());
    retry.addEventListener("click", () => location.reload());
    window.addEventListener("blog:page-ready", onReady);
    window.addEventListener("error", onError, true);
    window.addEventListener("pagehide", destroy);
    document.addEventListener("DOMContentLoaded", onParsed, { once: true });
    slowTimer = setTimeout(() => {
      if (destroyed || leaving) return;
      status.textContent = "加载时间较长，可继续等待或返回博客。";
      retry.hidden = false;
    }, 12000);
    window.BlogPageTransition = { ready: onReady };
    requestAnimationFrame(() => requestAnimationFrame(reveal));
    // 后台标签页暂停绘制时，也要开始计时，避免重新切回时再次等待。
    if (document.hidden) revealTimer = setTimeout(reveal, 150);
    checkReady();
  }
})();
