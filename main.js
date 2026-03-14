(() => {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

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
    sidebar.onMessage("cut-segment", (data) => {
      (() => __async(this, null, function* () {
        const markers = getMarkers();
        const ma = markers.find((m) => m.id === data.id1);
        const mb = markers.find((m) => m.id === data.id2);
        if (!ma || !mb) {
          log.warn("[VideoMarkers] cut-segment: markers not found");
          return;
        }
        const startM = ma.time <= mb.time ? ma : mb;
        const endM = ma.time <= mb.time ? mb : ma;
        const fileUrl = core.status.url;
        if (!fileUrl || !fileUrl.startsWith("file://")) {
          core.osd("\u041D\u0435\u0442 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430");
          return;
        }
        const filePath = decodeURIComponent(fileUrl.replace(/^file:\/\//, ""));
        const lastSlash = filePath.lastIndexOf("/");
        const dir = filePath.substring(0, lastSlash);
        const basename = filePath.substring(lastSlash + 1);
        const dotIdx = basename.lastIndexOf(".");
        const nameNoExt = dotIdx >= 0 ? basename.substring(0, dotIdx) : basename;
        const ext = dotIdx >= 0 ? basename.substring(dotIdx) : "";
        const timeTag = (s) => formatTime(s).replace(/:/g, "_");
        const sanitize = (s) => s.replace(/[\/\\:*?"<>|]/g, "").trim();
        const parts = [nameNoExt];
        if (startM.label) parts.push(sanitize(startM.label));
        if (endM.label) parts.push(sanitize(endM.label));
        parts.push(timeTag(startM.time));
        parts.push(timeTag(endM.time));
        const outPath = `${dir}/${parts.join("_")}${ext}`;
        const startFmt = formatTime(startM.time);
        const endFmt = formatTime(endM.time);
        core.osd(`\u0412\u044B\u0440\u0435\u0437\u0430\u044E ${startFmt} \u2192 ${endFmt}\u2026`);
        log.log(`[VideoMarkers] ffmpeg: "${filePath}" \u2192 "${outPath}"`);
        const cmd = [
          "ffmpeg",
          "-ss",
          startFmt,
          "-to",
          endFmt,
          "-i",
          filePath,
          "-c",
          "copy",
          outPath,
          "-y"
        ].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
        const { status, stderr } = yield utils.exec("/bin/bash", ["-lc", cmd]);
        if (status === 0) {
          core.osd(`\u0413\u043E\u0442\u043E\u0432\u043E: ${parts.join("_")}${ext}`);
          utils.open(dir);
        } else {
          core.osd("ffmpeg \u043E\u0448\u0438\u0431\u043A\u0430 \u2014 \u0441\u043C\u043E\u0442\u0440\u0438 \u043A\u043E\u043D\u0441\u043E\u043B\u044C");
          log.warn(`[VideoMarkers] ffmpeg stderr:
${stderr}`);
        }
      }))();
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
      const safeName = videoName.replace(/[\/\\:*?"<>|]/g, "_").trim().substring(0, 60);
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
