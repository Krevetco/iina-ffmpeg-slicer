(() => {
  // ui/sidebar/script.ts
  var state = { markers: [], duration: 0, currentTime: 0, videoName: "No video" };
  function padNum(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const sec = Math.floor(s % 60);
    return `${padNum(h)}:${padNum(m)}:${padNum(sec)}`;
  }
  function renderInfo() {
    const nameEl = document.getElementById("video-name");
    const countEl = document.getElementById("markers-count");
    const timeEl = document.getElementById("current-time");
    if (nameEl) nameEl.textContent = state.videoName;
    if (countEl) countEl.textContent = `${state.markers.length} marker${state.markers.length !== 1 ? "s" : ""}`;
    if (timeEl) timeEl.textContent = formatTime(state.currentTime);
  }
  function renderTimeline() {
    const canvas = document.getElementById("timeline");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.parentElement.clientWidth - 16;
    canvas.style.width = `${cssW}px`;
    canvas.width = cssW * dpr;
    canvas.height = 52 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = cssW;
    const H = 52;
    ctx.clearRect(0, 0, W, H);
    if (!state.duration) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--timeline-track").trim();
    ctx.beginPath();
    ctx.roundRect(0, H / 2 - 2, W, 4, 2);
    ctx.fill();
    for (const m of state.markers) {
      const x = m.time / state.duration * W;
      ctx.fillStyle = m.type === 1 ? getComputedStyle(document.documentElement).getPropertyValue("--type1").trim() : getComputedStyle(document.documentElement).getPropertyValue("--type2").trim();
      ctx.beginPath();
      ctx.arc(x, H / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (state.currentTime >= 0) {
      const px = state.currentTime / state.duration * W;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--playhead").trim();
      ctx.fillRect(px - 1, 4, 2, H - 8);
      ctx.beginPath();
      ctx.moveTo(px, 4);
      ctx.lineTo(px - 4, 0);
      ctx.lineTo(px + 4, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
  function renderList() {
    const list = document.getElementById("markers-list");
    if (!list) return;
    if (state.markers.length === 0) {
      list.innerHTML = '<div class="hint">Press <kbd>1</kbd> or <kbd>2</kbd> to add markers</div>';
      return;
    }
    const sorted = [...state.markers].sort((a, b) => a.time - b.time);
    list.innerHTML = sorted.map(
      (m) => `<div class="marker-row" onclick="seekTo(${m.time})"><span class="badge badge-${m.type}">Type ${m.type}</span><span class="marker-time">${formatTime(m.time)}</span></div>`
    ).join("");
  }
  function render() {
    renderInfo();
    renderTimeline();
    renderList();
  }
  iina.onMessage("update", (data) => {
    state = data;
    render();
  });
  window.seekTo = (time) => {
    iina.postMessage("seek", { time });
  };
  iina.postMessage("request-update");
})();
