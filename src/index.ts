// VideoMarkers – IINA Plugin entry point

const { console: log, core, event: iinaEvent, menu, sidebar, preferences, file, utils } = iina;

// ── Types ──────────────────────────────────────────────────────────────────

interface Marker {
  id: string;
  time: number;
  type: 1 | 2;
  label: string;
  createdAt: string;
}

interface SidebarPayload {
  markers: Marker[];
  duration: number;
  currentTime: number;
  videoName: string;
}

// ── State ──────────────────────────────────────────────────────────────────

const markersStore: Record<string, Marker[]> = {};
let currentVideoId: string | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getVideoId(): string {
  const title = (core.window as any).title ?? core.status.title ?? 'unknown';
  const duration = core.status.duration ?? 0;
  const clean = title
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `${clean}_${Math.round(duration)}`;
}

function getMarkers(): Marker[] {
  if (!currentVideoId) return [];
  if (!markersStore[currentVideoId]) markersStore[currentVideoId] = [];
  return markersStore[currentVideoId];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// ── Persistence ────────────────────────────────────────────────────────────

function saveMarkers(): void {
  if (!currentVideoId) return;
  preferences.set(`markers_${currentVideoId}`, JSON.stringify(getMarkers()));
  preferences.sync();
}

function loadMarkers(): void {
  if (!currentVideoId) return;
  const raw = preferences.get(`markers_${currentVideoId}`);
  const parsed: Marker[] = raw ? (JSON.parse(raw) as Marker[]) : [];
  markersStore[currentVideoId] = parsed.map((m) => ({
    id: m.id ?? uid(),
    time: m.time,
    type: m.type,
    label: m.label ?? '',
    createdAt: m.createdAt,
  }));
  log.log(`[VideoMarkers] Loaded ${getMarkers().length} markers`);
}

// ── Sidebar communication ──────────────────────────────────────────────────

function updateSidebar(): void {
  const payload: SidebarPayload = {
    markers: getMarkers(),
    duration: core.status.duration ?? 0,
    currentTime: core.status.position ?? 0,
    videoName: (core.window as any).title ?? core.status.title ?? 'No video',
  };
  log.log(`[VideoMarkers] postMessage update → ${payload.markers.length} markers`);
  sidebar.postMessage('update', payload);
}

// NOTE: sidebar.onMessage MUST be registered AFTER sidebar.loadFile().
// loadFile() clears all message listeners (per IINA plugin behaviour).
function registerSidebarHandlers(): void {
  sidebar.onMessage('seek', (data: any) => {
    log.log(`[VideoMarkers] seek → ${data.time}`);
    core.seekTo(data.time as number);
  });

  sidebar.onMessage('request-update', () => {
    log.log('[VideoMarkers] request-update');
    updateSidebar();
  });

  sidebar.onMessage('delete-marker', (data: any) => {
    if (!currentVideoId) return;
    const before = getMarkers().length;
    markersStore[currentVideoId] = getMarkers().filter((m) => m.id !== data.id);
    log.log(`[VideoMarkers] delete-marker ${data.id} (${before} → ${getMarkers().length})`);
    saveMarkers();
    updateSidebar();
  });

  sidebar.onMessage('rename-marker', (data: any) => {
    if (!currentVideoId) return;
    const marker = getMarkers().find((m) => m.id === data.id);
    if (!marker) return;
    marker.label = data.label ?? '';
    log.log(`[VideoMarkers] rename-marker ${data.id} → "${marker.label}"`);
    saveMarkers();
    updateSidebar();
  });

  sidebar.onMessage('cut-segment', (data: any) => {
    (async () => {
      const markers = getMarkers();
      const ma = markers.find((m) => m.id === data.id1);
      const mb = markers.find((m) => m.id === data.id2);
      if (!ma || !mb) { log.warn('[VideoMarkers] cut-segment: markers not found'); return; }

      // Ensure start < end regardless of which type was picked first
      const startM = ma.time <= mb.time ? ma : mb;
      const endM   = ma.time <= mb.time ? mb : ma;

      const fileUrl = core.status.url;
      if (!fileUrl || !fileUrl.startsWith('file://')) {
        core.osd('Нет локального файла');
        return;
      }
      const filePath = decodeURIComponent(fileUrl.replace(/^file:\/\//, ''));
      const lastSlash = filePath.lastIndexOf('/');
      const dir      = filePath.substring(0, lastSlash);
      const basename = filePath.substring(lastSlash + 1);
      const dotIdx   = basename.lastIndexOf('.');
      const nameNoExt = dotIdx >= 0 ? basename.substring(0, dotIdx) : basename;
      const ext       = dotIdx >= 0 ? basename.substring(dotIdx) : '';

      // Build output filename: name_label1_label2_HH_MM_SS_HH_MM_SS.ext
      const timeTag = (s: number) => formatTime(s).replace(/:/g, '_');
      const sanitize = (s: string) => s.replace(/[\/\\:*?"<>|]/g, '').trim();
      const parts: string[] = [nameNoExt];
      if (startM.label) parts.push(sanitize(startM.label));
      if (endM.label)   parts.push(sanitize(endM.label));
      parts.push(timeTag(startM.time));
      parts.push(timeTag(endM.time));
      const outPath = `${dir}/${parts.join('_')}${ext}`;

      const startFmt = formatTime(startM.time);
      const endFmt   = formatTime(endM.time);

      core.osd(`Вырезаю ${startFmt} → ${endFmt}…`);
      log.log(`[VideoMarkers] ffmpeg: "${filePath}" → "${outPath}"`);

      // Use bash so ffmpeg is found via login PATH (Homebrew /usr/local/bin etc.)
      const cmd = [
        'ffmpeg',
        '-ss', startFmt,
        '-to', endFmt,
        '-i', filePath,
        '-c', 'copy',
        outPath,
        '-y',
      ].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');

      const { status, stderr } = await utils.exec('/bin/bash', ['-lc', cmd]);

      if (status === 0) {
        core.osd(`Готово: ${parts.join('_')}${ext}`);
        utils.open(dir);
      } else {
        core.osd('ffmpeg ошибка — смотри консоль');
        log.warn(`[VideoMarkers] ffmpeg stderr:\n${stderr}`);
      }
    })();
  });

  sidebar.onMessage('export-markers', () => {
    const sorted = getMarkers().slice().sort((a, b) => a.time - b.time);
    if (sorted.length === 0) {
      core.osd('No markers to export');
      return;
    }
    const videoName = (core.window as any).title ?? core.status.title ?? 'markers';
    const date = new Date().toISOString().slice(0, 10);
    const safeName = videoName.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 60);
    const filename = `${safeName}_${date}.txt`;

    const lines = sorted.map((m) => {
      const parts: string[] = [formatTime(m.time)];
      if (m.label) parts.push(m.label);
      parts.push(`Type ${m.type}`);
      return parts.join('\n');
    }).join('\n\n');

    file.write(`@data/${filename}`, lines);
    utils.open(`@data/${filename}`);
    core.osd(`Exported: ${filename}`);
    log.log(`[VideoMarkers] Exported ${sorted.length} markers → ${filename}`);
  });
}

// ── Core action ────────────────────────────────────────────────────────────

function addMarker(type: 1 | 2): void {
  const position = core.status.position;
  if (position == null) {
    log.warn('[VideoMarkers] addMarker: no position');
    return;
  }
  if (!currentVideoId) {
    log.warn('[VideoMarkers] addMarker: no video loaded');
    return;
  }
  const marker: Marker = {
    id: uid(),
    time: position,
    type,
    label: '',
    createdAt: new Date().toISOString(),
  };
  getMarkers().push(marker);
  saveMarkers();
  core.osd(`Type ${type} marker — ${formatTime(position)}`);
  log.log(`[VideoMarkers] Added type ${type} at ${formatTime(position)}`);
  updateSidebar();
}

// ── Events ─────────────────────────────────────────────────────────────────

iinaEvent.on('iina.window-loaded', () => {
  log.log('[VideoMarkers] iina.window-loaded → loadFile then register handlers');
  sidebar.loadFile('sidebar/index.html');
  registerSidebarHandlers();
});

iinaEvent.on('iina.file-loaded', () => {
  currentVideoId = getVideoId();
  log.log(`[VideoMarkers] iina.file-loaded → videoId: ${currentVideoId}`);
  loadMarkers();
  setTimeout(() => updateSidebar(), 300);
});

// Push current position to sidebar every 500ms (always, regardless of pause state).
// This ensures the playhead updates when user seeks via player controls.
setInterval(() => {
  if (!currentVideoId) return;
  sidebar.postMessage('tick', { currentTime: core.status.position ?? 0 });
}, 500);

// ── Menu / hotkeys ─────────────────────────────────────────────────────────

menu.addItem(menu.item('Add Type 1 Marker', () => addMarker(1), { keyBinding: '1' }));
menu.addItem(menu.item('Add Type 2 Marker', () => addMarker(2), { keyBinding: '2' }));

log.log('[VideoMarkers] Plugin initialised ✓');

export {};
