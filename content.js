// ============================================================
// content.js v2 — Injected into every page
// ============================================================
(function () {
  if (window.__thinkyLoaded) return;
  window.__thinkyLoaded = true;

  // ── State ─────────────────────────────────────────────────
  let sidebar = null;
  let sidebarOpen = false;
  let floatBtn = null;
  let quickMenu = null;
  let lastSel = "";
  let debounce = null;
  let progressBar = null;
  let focusMode = false;
  let focusOverlay = null;

  // ── Boot ──────────────────────────────────────────────────
  createSidebar();
  createProgressBar();
  document.addEventListener("mouseup",   onMouseUp);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("keyup",     onKeyUp);
  window.addEventListener("scroll",      updateProgress);

  chrome.runtime.onMessage.addListener((msg, _, respond) => {
    if (msg.type === "THINKY_ACTION")   { handleAction(msg); respond({ ok: true }); }
    if (msg.type === "THINKY_TOOL")     { handleTool(msg.tool); respond({ ok: true }); }
    if (msg.type === "TOGGLE_SIDEBAR")  { toggleSidebar(); respond({ open: sidebarOpen }); }
    if (msg.type === "EXTRACT_PAGE_CONTENT") {
      respond({ content: getPageText(), title: document.title, url: location.href });
    }
    return true;
  });

  window.addEventListener("message", (e) => {
    if (e.source !== sidebar?.contentWindow) return;
    if (e.data?.type === "THINKY_CLOSE")        closeSidebar();
    if (e.data?.type === "THINKY_NEED_CONTENT") sendPageContent();
    if (e.data?.type === "THINKY_FOCUS_MODE")   toggleFocusMode(e.data.enabled);
  });

  // ── Sidebar ───────────────────────────────────────────────
  function createSidebar() {
    sidebar = document.createElement("iframe");
    sidebar.id = "__thinky_sidebar__";
    sidebar.src = chrome.runtime.getURL("sidebar/sidebar.html");
    Object.assign(sidebar.style, {
      position:     "fixed",
      top:          "0",
      right:        "-460px",
      width:        "440px",
      height:       "100vh",
      border:       "none",
      zIndex:       "2147483647",
      borderRadius: "20px 0 0 20px",
      boxShadow:    "-8px 0 40px rgba(0,0,0,0.35)",
      transition:   "right 0.18s cubic-bezier(0.25,0.46,0.45,0.94)",
      background:   "transparent",
      colorScheme:  "normal"
    });
    document.documentElement.appendChild(sidebar);
  }

  function openSidebar() {
    sidebarOpen = true;
    sidebar.style.right = "0";
  }

  function closeSidebar() {
    sidebarOpen = false;
    sidebar.style.right = "-460px";
    if (document.body) {
      document.body.style.marginRight = "";
    }
  }

  function toggleSidebar() {
    sidebarOpen ? closeSidebar() : openSidebar();
  }

  function sendToSidebar(data) {
    const attempt = (tries) => {
      try {
        sidebar.contentWindow.postMessage(data, "*");
      } catch (_) {
        if (tries > 0) setTimeout(() => attempt(tries - 1), 200);
      }
    };
    attempt(10);
  }

  function sendPageContent() {
    sendToSidebar({
      type:    "PAGE_CONTENT",
      content: getPageText(),
      title:   document.title,
      url:     location.href
    });
  }

  // ── Reading Progress ──────────────────────────────────────
  function createProgressBar() {
    progressBar = document.createElement("div");
    progressBar.id = "__thinky_progress__";
    Object.assign(progressBar.style, {
      position:   "fixed",
      top:        "0",
      left:       "0",
      height:     "3px",
      width:      "0%",
      background: "linear-gradient(90deg, #F54927, #34D399)",
      zIndex:     "2147483646",
      transition: "width 0.1s ease",
      pointerEvents: "none"
    });
    document.documentElement.appendChild(progressBar);
  }

  function updateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    if (progressBar) progressBar.style.width = pct + "%";
  }

  // ── Focus Mode ────────────────────────────────────────────
  function toggleFocusMode(enabled) {
    focusMode = enabled;
    if (enabled) {
      if (!focusOverlay) {
        focusOverlay = document.createElement("div");
        focusOverlay.id = "__thinky_focus__";
        Object.assign(focusOverlay.style, {
          position:   "fixed",
          inset:      "0",
          background: "rgba(11,18,32,0.7)",
          zIndex:     "2147483640",
          backdropFilter: "blur(2px)",
          pointerEvents: "none"
        });
        document.documentElement.appendChild(focusOverlay);
      }
    } else {
      focusOverlay?.remove();
      focusOverlay = null;
    }
  }

  // ── Text selection ────────────────────────────────────────
  function onMouseDown(e) {
    if (floatBtn && !floatBtn.contains(e.target))  removeFloat();
    if (quickMenu && !quickMenu.contains(e.target)) removeMenu();
  }

  function onMouseUp() {
    clearTimeout(debounce);
    debounce = setTimeout(checkSelection, 280);
  }

  function onKeyUp(e) {
    if (e.key === "Escape") { removeFloat(); removeMenu(); closeSidebar(); return; }
    clearTimeout(debounce);
    debounce = setTimeout(checkSelection, 280);
  }

  function checkSelection() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4 || text === lastSel) { if (!text) removeFloat(); return; }
    lastSel = text;
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    showFloat(rect, text);
  }

  // ── Floating button (upgraded) ────────────────────────────
  function showFloat(rect, text) {
    removeFloat();
    floatBtn = document.createElement("div");
    floatBtn.id = "__thinky_float__";

    floatBtn.innerHTML = `
      <div class="thinky-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.959 9.959 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
        </svg>
        <span>Thinky</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    `;

    const x = Math.max(4, Math.min(rect.left + window.scrollX, window.innerWidth - 170));
    const y = rect.top + window.scrollY - 50;

    Object.assign(floatBtn.style, {
      position: "absolute",
      left:     x + "px",
      top:      y + "px",
      zIndex:   "2147483646",
    });

    floatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMenu(floatBtn, text);
    });

    document.documentElement.appendChild(floatBtn);
  }

  function removeFloat() {
    floatBtn?.remove();
    floatBtn = null;
    lastSel = "";
  }

  // ── Quick menu (upgraded) ─────────────────────────────────
  function showMenu(anchor, text) {
    removeMenu();
    const items = [
      { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`, label: "Explain",     action: "explain" },
      { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, label: "Summarize",   action: "summarize" },
      { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, label: "Study Notes", action: "notes" },
      { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`, label: "Chat",        action: "chat" },
      { icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`, label: "Quiz Me",     action: "quiz" }
    ];

    quickMenu = document.createElement("div");
    quickMenu.id = "__thinky_menu__";
    quickMenu.style.cssText = `
      position:absolute;
      left:${anchor.offsetLeft}px;
      top:${anchor.offsetTop + anchor.offsetHeight + 8}px;
      z-index:2147483646;
    `;

    const inner = document.createElement("div");
    inner.className = "thinky-menu-inner";

    const header = document.createElement("div");
    header.className = "thinky-menu-header";
    header.textContent = `"${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"`;
    inner.appendChild(header);

    items.forEach(({ icon, label, action }) => {
      const btn = document.createElement("button");
      btn.className = "thinky-menu-item";
      btn.innerHTML = `<span class="thinky-menu-icon">${icon}</span><span>${label}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeMenu();
        removeFloat();
        doAction(action, text);
      });
      inner.appendChild(btn);
    });

    quickMenu.appendChild(inner);
    document.documentElement.appendChild(quickMenu);
  }

  function removeMenu() {
    quickMenu?.remove();
    quickMenu = null;
  }

  // ── Actions ───────────────────────────────────────────────
  function doAction(action, text) {
    openSidebar();
    const prompts = {
      explain:   `Explain this clearly for a student, step-by-step with examples:\n\n"${text}"`,
      summarize: `Summarize this concisely, highlighting key points:\n\n"${text}"`,
      notes:     `Create detailed study notes from this text. Include key concepts, definitions, and exam-ready points:\n\n"${text}"`,
      quiz:      `Create 5 multiple-choice questions (A/B/C/D, mark the correct answer) based on:\n\n"${text}"`,
      chat:      null
    };

    setTimeout(() => {
      if (action === "chat") {
        sendToSidebar({ type: "SET_CONTEXT", text });
      } else {
        sendToSidebar({
          type:   "RUN_PROMPT",
          prompt: prompts[action],
          label:  `${action.charAt(0).toUpperCase()+action.slice(1)}: "${text.slice(0,45)}${text.length>45?"...":""}"`
        });
      }
    }, 350);
  }

  function handleAction(msg) {
    openSidebar();
    setTimeout(() => {
      if (msg.action === "page-summary") {
        sendToSidebar({
          type:   "RUN_PROMPT",
          prompt: `Summarize this webpage with key points:\n\nTitle: ${document.title}\nURL: ${location.href}\n\n${getPageText().slice(0, 6000)}`,
          label:  `📄 Page Summary`
        });
      } else if (msg.action === "open-sidebar") {
        if (msg.text) sendToSidebar({ type: "SET_CONTEXT", text: msg.text });
      } else if (msg.text) {
        doAction(msg.action, msg.text);
      }
    }, 350);
  }

  function handleTool(tool) {
    openSidebar();
    const page = getPageText().slice(0, 5000);
    const t = document.title;
    const prompts = {
      flashcards:  `Create 10 Q&A flashcards from this page.\nFormat: **Q:** ...\n**A:** ...\n\nTitle: ${t}\n\n${page}`,
      quiz:        `Create 10 multiple-choice quiz questions (A/B/C/D) from:\nTitle: ${t}\n\n${page}`,
      outline:     `Create a structured study outline with headings from:\nTitle: ${t}\n\n${page}`,
      "key-points":`List the 8-10 most important key points from:\nTitle: ${t}\n\n${page}`
    };
    const labels = { flashcards:"🃏 Flashcards", quiz:"❓ Quiz", outline:"📝 Outline", "key-points":"🎯 Key Points" };
    if (!prompts[tool]) return;
    setTimeout(() => sendToSidebar({ type: "RUN_PROMPT", prompt: prompts[tool], label: labels[tool] }), 350);
  }

  // ── Page text extraction ──────────────────────────────────
  function getPageText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script,style,nav,footer,header,iframe,noscript,[class*='cookie'],[id*='cookie']").forEach(el => el.remove());
    const main = clone.querySelector("main,article,[role='main'],.post,.content,#content,#main");
    return ((main || clone).innerText || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 10000);
  }

})();
