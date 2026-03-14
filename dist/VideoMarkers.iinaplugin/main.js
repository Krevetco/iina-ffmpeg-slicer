(() => {
  // src/index.ts
  var { console: log, core, event: iinaEvent, menu, sidebar, preferences, file, utils } = iina;
  var markersStore = {};
  var currentVideoId = null;
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
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
    const parsed = raw ? JSON.parse(raw) : [];
    markersStore[currentVideoId] = parsed.map((m) => {
      var _a, _b;
      return {
        id: (_a = m.id) != null ? _a : uid(),
        time: m.time,
        type: m.type,
        label: (_b = m.label) != null ? _b : "",
        createdAt: m.createdAt
      };
    });
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
  function registerSidebarHandlers() {
    sidebar.onMessage("seek", (data) => {
      log.log(`[VideoMarkers] seek \u2192 ${data.time}`);
      core.seekTo(data.time);
    });
    sidebar.onMessage("request-update", () => {
      log.log("[VideoMarkers] request-update");
      updateSidebar();
    });
    sidebar.onMessage("delete-marker", (data) => {
      if (!currentVideoId) return;
      const before = getMarkers().length;
      markersStore[currentVideoId] = getMarkers().filter((m) => m.id !== data.id);
      log.log(`[VideoMarkers] delete-marker ${data.id} (${before} \u2192 ${getMarkers().length})`);
      saveMarkers();
      updateSidebar();
    });
    sidebar.onMessage("rename-marker", (data) => {
      var _a;
      if (!currentVideoId) return;
      const marker = getMarkers().find((m) => m.id === data.id);
      if (!marker) return;
      marker.label = (_a = data.label) != null ? _a : "";
      log.log(`[VideoMarkers] rename-marker ${data.id} \u2192 "${marker.label}"`);
      saveMarkers();
      updateSidebar();
    });
    sidebar.onMessage("export-markers", () => {
      var _a, _b;
      const sorted = getMarkers().slice().sort((a, b) => a.time - b.time);
      if (sorted.length === 0) {
        core.osd("No markers to export");
        return;
      }
      const videoName = (_b = (_a = core.window.title) != null ? _a : core.status.title) != null ? _b : "markers";
      const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const safeName = videoName.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 60);
      const filename = `${safeName}_${date}.txt`;
      const lines = sorted.map((m) => {
        const parts = [formatTime(m.time)];
        if (m.label) parts.push(m.label);
        parts.push(`Type ${m.type}`);
        return parts.join("\n");
      }).join("\n\n");
      file.write(`@data/${filename}`, lines);
      utils.open(`@data/${filename}`);
      core.osd(`Exported: ${filename}`);
      log.log(`[VideoMarkers] Exported ${sorted.length} markers \u2192 ${filename}`);
    });
  }
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
    const marker = {
      id: uid(),
      time: position,
      type,
      label: "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    getMarkers().push(marker);
    saveMarkers();
    core.osd(`Type ${type} marker \u2014 ${formatTime(position)}`);
    log.log(`[VideoMarkers] Added type ${type} at ${formatTime(position)}`);
    updateSidebar();
  }
  iinaEvent.on("iina.window-loaded", () => {
    log.log("[VideoMarkers] iina.window-loaded \u2192 loadFile then register handlers");
    sidebar.loadFile("sidebar/index.html");
    registerSidebarHandlers();
  });
  iinaEvent.on("iina.file-loaded", () => {
    currentVideoId = getVideoId();
    log.log(`[VideoMarkers] iina.file-loaded \u2192 videoId: ${currentVideoId}`);
    loadMarkers();
    setTimeout(() => updateSidebar(), 300);
  });
  setInterval(() => {
    var _a;
    if (!currentVideoId) return;
    sidebar.postMessage("tick", { currentTime: (_a = core.status.position) != null ? _a : 0 });
  }, 500);
  menu.addItem(menu.item("Add Type 1 Marker", () => addMarker(1), { keyBinding: "1" }));
  menu.addItem(menu.item("Add Type 2 Marker", () => addMarker(2), { keyBinding: "2" }));
  log.log("[VideoMarkers] Plugin initialised \u2713");
})();
