// Sidebar script – runs inside IINA's sidebar WebView
// `iina` is the WebView-side API: iina.postMessage / iina.onMessage

declare const iina: {
  postMessage(name: string, data?: any): void;
  onMessage(name: string, cb: (data: any) => void): void;
};

// ── Types ──────────────────────────────────────────────────────────────────

interface Marker {
  id: string;
  time: number;
  type: 1 | 2;
  label: string;
  createdAt: string;
}

interface Payload {
  markers: Marker[];
  duration: number;
  currentTime: number;
  videoName: string;
}

// ── State ──────────────────────────────────────────────────────────────────

let state: Payload = { markers: [], duration: 0, currentTime: 0, videoName: 'No video' };

// ── Utils ──────────────────────────────────────────────────────────────────

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }

function fmt(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function seek(time: number): void {
  iina.postMessage('seek', { time });
}

// ── Timeline ───────────────────────────────────────────────────────────────

function drawTimeline(): void {
  const canvas = document.getElementById('timeline') as HTMLCanvasElement | null;
  if (!canvas) return;

  const wrap = canvas.parentElement!;
  const cssW = wrap.clientWidth - 16;
  if (cssW <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.width = cssW * dpr;
  canvas.height = 52 * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const W = cssW;
  const H = 52;
  const dur = state.duration;

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#2a2a2a';
  ctx.fillRect(0, 0, W, H);

  // Center line
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  if (!dur) return;

  // Playhead
  if (state.currentTime > 0) {
    const px = (state.currentTime / dur) * W;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 4);
    ctx.lineTo(px, H - 4);
    ctx.stroke();
  }

  // Markers
  for (const m of state.markers) {
    const x = (m.time / dur) * W;
    ctx.strokeStyle = m.type === 1 ? '#4caf78' : '#e05555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, H - 8);
    ctx.stroke();

    // Dot
    ctx.fillStyle = m.type === 1 ? '#4caf78' : '#e05555';
    ctx.beginPath();
    ctx.arc(x, H / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Timeline click handler (attached once)
function attachTimelineClick(): void {
  const canvas = document.getElementById('timeline') as HTMLCanvasElement | null;
  if (!canvas || (canvas as any).__clickAttached) return;
  (canvas as any).__clickAttached = true;

  canvas.addEventListener('click', (e: MouseEvent) => {
    if (!state.duration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * state.duration);
  });
}

// ── Info panel ─────────────────────────────────────────────────────────────

function renderInfo(): void {
  const nameEl = document.getElementById('video-name');
  const countEl = document.getElementById('markers-count');
  const timeEl = document.getElementById('current-time');
  if (nameEl) nameEl.textContent = state.videoName;
  if (countEl) countEl.textContent = `${state.markers.length} markers`;
  if (timeEl) timeEl.textContent = fmt(state.currentTime);
}

// ── Marker cards ───────────────────────────────────────────────────────────

function makeCard(m: Marker): HTMLElement {
  const card = document.createElement('div');
  card.className = `marker-card type-${m.type}`;
  card.dataset.id = m.id;

  const timeEl = document.createElement('div');
  timeEl.className = 'card-time';
  timeEl.textContent = fmt(m.time);

  const labelEl = document.createElement('div');
  labelEl.className = m.label ? 'card-label' : 'card-label empty';
  labelEl.textContent = m.label;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'card-btn rename';
  renameBtn.title = 'Edit label';
  renameBtn.textContent = '✏';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card-btn delete';
  deleteBtn.title = 'Delete marker';
  deleteBtn.textContent = '🗑';

  actions.append(renameBtn, deleteBtn);
  card.append(timeEl, labelEl, actions);

  // Seek on card click (but not on button clicks)
  card.addEventListener('click', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.card-btn')) return;
    seek(m.time);
  });

  // Delete
  deleteBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    iina.postMessage('delete-marker', { id: m.id });
  });

  // Inline rename
  renameBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (card.querySelector('.label-input')) return; // already open

    const input = document.createElement('input');
    input.className = 'label-input';
    input.type = 'text';
    input.value = m.label;
    input.placeholder = 'Enter label…';

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newLabel = input.value.trim();
      iina.postMessage('rename-marker', { id: m.id, label: newLabel });
      // Optimistically update label while we wait for the update message
      m.label = newLabel;
      const newLabelEl = document.createElement('div');
      newLabelEl.className = newLabel ? 'card-label' : 'card-label empty';
      newLabelEl.textContent = newLabel;
      input.replaceWith(newLabelEl);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ke: KeyboardEvent) => {
      if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
      if (ke.key === 'Escape') { input.value = m.label; input.blur(); }
    });
  });

  return card;
}

function renderLists(): void {
  const list1 = document.getElementById('list-1')!;
  const list2 = document.getElementById('list-2')!;
  if (!list1 || !list2) return;

  list1.innerHTML = '';
  list2.innerHTML = '';

  const t1 = state.markers.filter((m) => m.type === 1).sort((a, b) => a.time - b.time);
  const t2 = state.markers.filter((m) => m.type === 2).sort((a, b) => a.time - b.time);

  if (t1.length === 0 && t2.length === 0) {
    list1.innerHTML = '<div class="hint">Press <kbd>1</kbd> or <kbd>2</kbd></div>';
    return;
  }

  t1.forEach((m) => list1.appendChild(makeCard(m)));
  t2.forEach((m) => list2.appendChild(makeCard(m)));
}

// ── Main render ────────────────────────────────────────────────────────────

function render(): void {
  renderInfo();
  drawTimeline();
  renderLists();
}

// ── ResizeObserver for timeline ────────────────────────────────────────────

function observeTimeline(): void {
  const wrap = document.querySelector('.timeline-wrap');
  if (!wrap) return;
  const ro = new ResizeObserver(() => drawTimeline());
  ro.observe(wrap);
}

// ── Init ───────────────────────────────────────────────────────────────────

iina.onMessage('update', (data: Payload) => {
  state = data;
  render();
});

// Lightweight position tick – only redraws timeline, not the whole list
iina.onMessage('tick', (data: { currentTime: number }) => {
  state.currentTime = data.currentTime;
  renderInfo();
  drawTimeline();
});

document.addEventListener('DOMContentLoaded', () => {
  attachTimelineClick();
  observeTimeline();
  iina.postMessage('request-update');
});

export {};
