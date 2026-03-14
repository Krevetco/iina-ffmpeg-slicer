(() => {
  // src/index.ts
  var { console: log, core, event: iinaEvent, menu, sidebar, preferences } = iina;
  var markersStore = {};
  var currentVideoId = null;
  function getVideoId() {
    var _a, _b, _c;
    const title = (_b = (_a = core.window.title) != null ? _a : core.status.title) != null ? _b : "unknown";
    const duration = (_c = core.status.duration) != null ? _c : 0;
    const clean = title.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
    return `${clean}_${Math.round(duration)}`;
  }
  function getMarkers() {
    if (!currentVideoId) return [];
    if (!markersStore[currentVideoId]) markersStore[currentVideoId] = [];
    return markersStore[currentVideoId];
  }
  function pad(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const sec = Math.floor(s % 60);
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  function saveMarkers() {
    if (!currentVideoId) return;
    preferences.set(`markers_${currentVideoId}`, JSON.stringify(getMarkers()));
    preferences.sync();
  }
  function loadMarkers() {
    if (!currentVideoId) return;
    const raw = preferences.get(`markers_${currentVideoId}`);
    markersStore[currentVideoId] = raw ? JSON.parse(raw) : [];
    log.log(`[VideoMarkers] Loaded ${getMarkers().length} markers`);
  }
  function updateSidebar() {
    var _a, _b, _c, _d;
    const payload = {
      markers: getMarkers(),
      duration: (_a = core.status.duration) != null ? _a : 0,
      currentTime: (_b = core.status.position) != null ? _b : 0,
      videoName: (_d = (_c = core.window.title) != null ? _c : core.status.title) != null ? _d : "No video"
    };
    log.log(`[VideoMarkers] postMessage update \u2192 ${payload.markers.length} markers`);
    sidebar.postMessage("update", payload);
  }
  sidebar.onMessage("seek", (data) => {
    log.log(`[VideoMarkers] seek \u2192 ${data.time}`);
    core.seekTo(data.time);
  });
  sidebar.onMessage("request-update", () => {
    log.log("[VideoMarkers] request-update received");
    updateSidebar();
  });
  function addMarker(type) {
    const position = core.status.position;
    if (position == null) {
      log.warn("[VideoMarkers] addMarker: no position");
      return;
    }
    if (!currentVideoId) {
      log.warn("[VideoMarkers] addMarker: no video loaded");
      return;
    }
    const marker = { time: position, type, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    getMarkers().push(marker);
    saveMarkers();
    core.osd(`Type ${type} marker \u2014 ${formatTime(position)}`);
    log.log(`[VideoMarkers] Added type ${type} at ${formatTime(position)}`);
    updateSidebar();
  }
  iinaEvent.on("iina.window-loaded", () => {
    log.log("[VideoMarkers] iina.window-loaded \u2192 loadFile sidebar");
    sidebar.loadFile("sidebar/index.html");
  });
  iinaEvent.on("iina.file-loaded", () => {
    currentVideoId = getVideoId();
    log.log(`[VideoMarkers] iina.file-loaded \u2192 videoId: ${currentVideoId}`);
    loadMarkers();
    setTimeout(() => updateSidebar(), 300);
  });
  menu.addItem(menu.item("Add Type 1 Marker", () => addMarker(1), { keyBinding: "1" }));
  menu.addItem(menu.item("Add Type 2 Marker", () => addMarker(2), { keyBinding: "2" }));
  log.log("[VideoMarkers] Plugin initialised \u2713");
})();
