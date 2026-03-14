(() => {
  // ui/sidebar/script.ts
  var state = { markers: [], duration: 0, currentTime: 0, videoName: "No video" };
  var preJumpPosition = null;
  var lastPluginSeekTarget = null;
  var lastSeekTs = 0;
  var selectedId1 = null;
  var selectedId2 = null;
  function pad(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function fmt(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const sec = Math.floor(s % 60);
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  function jumpTo(time) {
    preJumpPosition = state.currentTime;
    lastPluginSeekTarget = time;
    lastSeekTs = Date.now();
    iina.postMessage("seek", { time });
    renderBackButton();
  }
  function drawTimeline() {
    const canvas = document.getElementById("timeline");
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssW = wrap.clientWidth - 16;
    if (cssW <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssW}px`;
    canvas.width = cssW * dpr;
    canvas.height = 52 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = cssW;
    const H = 52;
    const dur = state.duration;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg2").trim() || "#2a2a2a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    if (!dur) return;
    const px = state.currentTime / dur * W;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 2);
    ctx.lineTo(px, H - 2);
    ctx.stroke();
    for (const m of state.markers) {
      const x = m.time / dur * W;
      ctx.strokeStyle = m.type === 1 ? "#4caf78" : "#e05555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x, H - 8);
      ctx.stroke();
      ctx.fillStyle = m.type === 1 ? "#4caf78" : "#e05555";
      ctx.beginPath();
      ctx.arc(x, H / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function attachTimelineClick() {
    const canvas = document.getElementById("timeline");
    if (!canvas || canvas.__clickAttached) return;
    canvas.__clickAttached = true;
    canvas.addEventListener("click", (e) => {
      if (!state.duration) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      jumpTo(ratio * state.duration);
    });
  }
  function renderInfo() {
    const nameEl = document.getElementById("video-name");
    const countEl = document.getElementById("markers-count");
    const timeEl = document.getElementById("current-time");
    if (nameEl) nameEl.textContent = state.videoName;
    if (countEl) countEl.textContent = `${state.markers.length} markers`;
    if (timeEl) timeEl.textContent = fmt(state.currentTime);
  }
  function renderBackButton() {
    const btn = document.getElementById("back-btn");
    const timeSpan = document.getElementById("back-time");
    if (!btn || !timeSpan) return;
    if (preJumpPosition !== null) {
      timeSpan.textContent = fmt(preJumpPosition);
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }
  function checkManualSeek(currentTime) {
    if (preJumpPosition === null || lastPluginSeekTarget === null) return;
    const elapsed = (Date.now() - lastSeekTs) / 1e3;
    const expectedMin = lastPluginSeekTarget - 3;
    const expectedMax = lastPluginSeekTarget + elapsed + 3;
    if (currentTime < expectedMin || currentTime > expectedMax) {
      preJumpPosition = null;
      lastPluginSeekTarget = null;
      renderBackButton();
    }
  }
  function updateCardSelection() {
    document.querySelectorAll(".marker-card").forEach((card) => {
      const id = card.dataset.id;
      const type = card.classList.contains("type-1") ? 1 : 2;
      const isSelected = type === 1 ? id === selectedId1 : id === selectedId2;
      card.classList.toggle("selected", isSelected);
      const btn = card.querySelector(".card-btn.select");
      if (btn) btn.classList.toggle("active", isSelected);
    });
  }
  function showPairModal() {
    const m1 = state.markers.find((m) => m.id === selectedId1);
    const m2 = state.markers.find((m) => m.id === selectedId2);
    if (!m1 || !m2) return;
    const body = document.getElementById("modal-body");
    if (body) {
      body.innerHTML = `
      <div class="modal-marker">
        <div class="modal-marker-time">Type 1 \u2014 ${fmt(m1.time)}</div>
        ${m1.label ? `<div class="modal-marker-label">${m1.label}</div>` : ""}
      </div>
      <div class="modal-marker">
        <div class="modal-marker-time">Type 2 \u2014 ${fmt(m2.time)}</div>
        ${m2.label ? `<div class="modal-marker-label">${m2.label}</div>` : ""}
      </div>
    `;
    }
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.remove("hidden");
  }
  function closeModal() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.add("hidden");
    selectedId1 = null;
    selectedId2 = null;
    updateCardSelection();
  }
  function makeCard(m) {
    const card = document.createElement("div");
    card.className = `marker-card type-${m.type}`;
    card.dataset.id = m.id;
    const timeEl = document.createElement("div");
    timeEl.className = "card-time";
    timeEl.textContent = fmt(m.time);
    const labelEl = document.createElement("div");
    labelEl.className = m.label ? "card-label" : "card-label empty";
    labelEl.textContent = m.label;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const renameBtn = document.createElement("button");
    renameBtn.className = "card-btn rename";
    renameBtn.title = "Edit label";
    renameBtn.textContent = "\u270F";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "card-btn delete";
    deleteBtn.title = "Delete marker";
    deleteBtn.textContent = "\u2716";
    const selectBtn = document.createElement("button");
    selectBtn.className = "card-btn select";
    selectBtn.title = "Select for pairing";
    selectBtn.textContent = "\u2714";
    actions.append(renameBtn, deleteBtn, selectBtn);
    card.append(timeEl, labelEl, actions);
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-btn")) return;
      jumpTo(m.time);
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      iina.postMessage("delete-marker", { id: m.id });
    });
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (card.querySelector(".label-input")) return;
      const input = document.createElement("input");
      input.className = "label-input";
      input.type = "text";
      input.value = m.label;
      input.placeholder = "Enter label\u2026";
      labelEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const newLabel = input.value.trim();
        iina.postMessage("rename-marker", { id: m.id, label: newLabel });
        m.label = newLabel;
        const newLabelEl = document.createElement("div");
        newLabelEl.className = newLabel ? "card-label" : "card-label empty";
        newLabelEl.textContent = newLabel;
        input.replaceWith(newLabelEl);
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (ke) => {
        if (ke.key === "Enter") {
          ke.preventDefault();
          input.blur();
        }
        if (ke.key === "Escape") {
          input.value = m.label;
          input.blur();
        }
      });
    });
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (m.type === 1) {
        selectedId1 = selectedId1 === m.id ? null : m.id;
      } else {
        selectedId2 = selectedId2 === m.id ? null : m.id;
      }
      updateCardSelection();
      if (selectedId1 && selectedId2) {
        showPairModal();
      }
    });
    return card;
  }
  function renderLists() {
    const list1 = document.getElementById("list-1");
    const list2 = document.getElementById("list-2");
    if (!list1 || !list2) return;
    list1.innerHTML = "";
    list2.innerHTML = "";
    const t1 = state.markers.filter((m) => m.type === 1).sort((a, b) => a.time - b.time);
    const t2 = state.markers.filter((m) => m.type === 2).sort((a, b) => a.time - b.time);
    if (t1.length === 0 && t2.length === 0) {
      list1.innerHTML = '<div class="hint">Press <kbd>1</kbd> or <kbd>2</kbd></div>';
      return;
    }
    t1.forEach((m) => list1.appendChild(makeCard(m)));
    t2.forEach((m) => list2.appendChild(makeCard(m)));
    updateCardSelection();
  }
  function render() {
    renderInfo();
    drawTimeline();
    renderLists();
    renderBackButton();
  }
  function observeTimeline() {
    const wrap = document.querySelector(".timeline-wrap");
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawTimeline());
    ro.observe(wrap);
  }
  iina.onMessage("update", (data) => {
    state = data;
    render();
  });
  iina.onMessage("tick", (data) => {
    checkManualSeek(data.currentTime);
    state.currentTime = data.currentTime;
    renderInfo();
    drawTimeline();
  });
  document.addEventListener("DOMContentLoaded", () => {
    attachTimelineClick();
    observeTimeline();
    const backBtn = document.getElementById("back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (preJumpPosition === null) return;
        const target = preJumpPosition;
        preJumpPosition = null;
        lastPluginSeekTarget = null;
        renderBackButton();
        iina.postMessage("seek", { time: target });
      });
    }
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        iina.postMessage("export-markers", {});
      });
    }
    const modalOk = document.getElementById("modal-ok");
    if (modalOk) {
      modalOk.addEventListener("click", closeModal);
    }
    iina.postMessage("request-update");
  });
})();
