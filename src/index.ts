// VideoMarkers – IINA Plugin entry point
// `iina` is declared as a global by iina-plugin-definition

const { console: log, core, event: iinaEvent, menu, sidebar, preferences } = iina;

// ── Types ──────────────────────────────────────────────────────────────────

interface Marker {
  time: number;
  type: 1 | 2;
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
  markersStore[currentVideoId] = raw ? (JSON.parse(raw) as Marker[]) : [];
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

// Messages coming FROM the sidebar WebView
sidebar.onMessage('seek', (data: any) => {
  log.log(`[VideoMarkers] seek → ${data.time}`);
  core.seekTo(data.time as number);
});

sidebar.onMessage('request-update', () => {
  log.log('[VideoMarkers] request-update received');
  updateSidebar();
});

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
  const marker: Marker = { time: position, type, createdAt: new Date().toISOString() };
  getMarkers().push(marker);
  saveMarkers();
  core.osd(`Type ${type} marker — ${formatTime(position)}`);
  log.log(`[VideoMarkers] Added type ${type} at ${formatTime(position)}`);
  updateSidebar();
}

// ── Events ─────────────────────────────────────────────────────────────────

iinaEvent.on('iina.window-loaded', () => {
  log.log('[VideoMarkers] iina.window-loaded → loadFile sidebar');
  sidebar.loadFile('sidebar/index.html');
});

iinaEvent.on('iina.file-loaded', () => {
  currentVideoId = getVideoId();
  log.log(`[VideoMarkers] iina.file-loaded → videoId: ${currentVideoId}`);
  loadMarkers();
  setTimeout(() => updateSidebar(), 300);
});

// ── Menu / hotkeys ─────────────────────────────────────────────────────────

menu.addItem(menu.item('Add Type 1 Marker', () => addMarker(1), { keyBinding: '1' }));
menu.addItem(menu.item('Add Type 2 Marker', () => addMarker(2), { keyBinding: '2' }));

log.log('[VideoMarkers] Plugin initialised ✓');

export {};
