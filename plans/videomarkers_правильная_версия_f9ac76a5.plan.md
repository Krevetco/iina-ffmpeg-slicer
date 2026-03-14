---
name: VideoMarkers правильная версия
overview: Пересоздание плагина VideoMarkers на TypeScript с правильной структурой и сборкой, используя iina-plugin-definition и референсный плагин как пример.
todos:
  - id: cleanup
    content: Удалить старую версию плагина и создать новую структуру проекта
    status: completed
  - id: setup
    content: Настроить package.json, tsconfig.json, .nvmrc
    status: completed
  - id: main-ts
    content: Создать src/index.ts с правильным entry point
    status: completed
  - id: sidebar-ts
    content: Создать ui/sidebar/* (HTML, CSS, TypeScript)
    status: completed
  - id: build-script
    content: Создать build/build.ts для автосборки и установки
    status: completed
  - id: info-json
    content: Создать Info.json в корне
    status: completed
  - id: test
    content: Запустить npm run dev и проверить что плагин работает
    status: completed
isProject: false
---

# План: VideoMarkers на TypeScript (правильная версия)

## Проблема текущей версии

Текущий плагин на чистом JS не работает - нет логов в консоли, горячие клавиши не срабатывают. Причина: неправильная структура entry point и отсутствие типизации.

## Решение

Использовать **TypeScript + правильную сборку**, как в референсном плагине `iina-plugin-bookmarks`.

## Архитектура

### Структура проекта

```
VideoMarkers/
├── package.json              # npm зависимости и скрипты сборки
├── tsconfig.json             # TypeScript конфигурация
├── tsconfig.build.json       # Конфиг для продакшн сборки
├── .nvmrc                    # Node версия (22+)
├── build/                    # Скрипты сборки
│   └── build.ts              # Сборщик плагина
├── src/
│   └── index.ts              # Main entry point (TypeScript)
├── ui/
│   └── sidebar/
│       ├── index.html        # Sidebar UI
│       ├── style.css         # Стили
│       └── script.ts         # Sidebar логика (TypeScript)
└── dist/                     # Выходная директория
    └── VideoMarkers.iinaplugin/
        ├── Info.json
        ├── main.js           # Скомпилированный из src/index.ts
        └── sidebar/
            ├── index.html
            ├── style.css
            └── script.js     # Скомпилированный из ui/sidebar/script.ts
```

### Ключевые отличия от предыдущей версии

**❌ Было (не работало):**

- Чистый JS без типов
- Неправильная структура entry point
- Ручное копирование файлов

**✅ Станет:**

- TypeScript с `iina-plugin-definition`
- Правильный entry point через деструктуризацию `const { core, event, menu, sidebar } = iina`
- Автоматическая сборка с копированием в IINA plugins folder

## Этапы реализации

### 1. Настройка проекта

**package.json:**

```json
{
  "name": "videomarkers",
  "version": "0.1.0",
  "scripts": {
    "build": "tsx build/build.ts",
    "dev": "tsx build/build.ts --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "iina-plugin-definition": "^0.99.3",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "chokidar": "^3.5.0"
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES6",
    "module": "ES6",
    "lib": ["ES6", "ES2015", "ES2016", "ES2017"],
    "outDir": "./dist/VideoMarkers.iinaplugin",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "typeRoots": [
      "./node_modules/@types",
      "./node_modules/iina-plugin-definition"
    ]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}
```

**.nvmrc:**

```
22
```

### 2. Главный entry point (src/index.ts)

```typescript
// Деструктурируем IINA API
const { console, core, event, menu, sidebar, preferences } = iina;

// Хранилище меток
interface Marker {
  time: number;
  type: 1 | 2;
  key: string;
  createdAt: string;
}

let markersStore: Record<string, Marker[]> = {};
let currentVideoId: string | null = null;

// Генерация video ID
function getVideoId(): string {
  const title = core.window.title || 'unknown';
  const duration = core.status.duration || 0;
  const cleanTitle = title
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `${cleanTitle}_${Math.round(duration)}`;
}

// Инициализация
function init() {
  console.log('[VideoMarkers] Initializing...');

  // Регистрация горячих клавиш
  menu.addItem({
    title: 'Add Type 1 Marker',
    keyBinding: '1',
    action: () => addMarker(1)
  });

  menu.addItem({
    title: 'Add Type 2 Marker',
    keyBinding: '2',
    action: () => addMarker(2)
  });

  // События
  event.on('iina.window-loaded', () => {
    console.log('[VideoMarkers] Loading sidebar');
    sidebar.loadHTML('sidebar/index.html');
  });

  event.on('iina.file-loaded', () => {
    currentVideoId = getVideoId();
    console.log('[VideoMarkers] File loaded:', currentVideoId);
    loadMarkers();
    updateSidebar();
  });

  console.log('[VideoMarkers] Initialized');
}

// Добавление метки
function addMarker(type: 1 | 2) {
  const position = core.status.position;
  if (!position) return;

  const marker: Marker = {
    time: position,
    type,
    key: String(type),
    createdAt: new Date().toISOString()
  };

  if (!currentVideoId) return;
  if (!markersStore[currentVideoId]) markersStore[currentVideoId] = [];
  
  markersStore[currentVideoId].push(marker);
  saveMarkers();
  
  core.osd(`Type ${type} marker at ${formatTime(position)}`);
  updateSidebar();
}

// Сохранение/загрузка
function saveMarkers() {
  if (!currentVideoId) return;
  const key = `markers_${currentVideoId}`;
  preferences.set(key, JSON.stringify(markersStore[currentVideoId]));
}

function loadMarkers() {
  if (!currentVideoId) return;
  const key = `markers_${currentVideoId}`;
  const stored = preferences.get(key);
  markersStore[currentVideoId] = stored ? JSON.parse(stored) : [];
}

// Коммуникация с sidebar
function updateSidebar() {
  if (!currentVideoId) return;
  sidebar.postMessage('update', {
    markers: markersStore[currentVideoId] || [],
    duration: core.status.duration || 0,
    currentTime: core.status.position || 0,
    videoName: core.window.title || 'No video'
  });
}

// Обработка сообщений от sidebar
iina.onMessage = (name: string, data: any) => {
  if (name === 'seek') {
    core.seekTo(data.time);
  } else if (name === 'request-update') {
    updateSidebar();
  }
};

// Утилиты
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Запуск
init();
```

### 3. Sidebar UI (ui/sidebar/index.html)

Простой HTML без фреймворков:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div class="info">
      <div id="video-name">No video</div>
      <div id="markers-count">0 markers</div>
    </div>
    <canvas id="timeline" width="280" height="60"></canvas>
    <div id="markers-list"></div>
  </div>
  <script src="script.js"></script>
</body>
</html>
```

### 4. Sidebar Script (ui/sidebar/script.ts)

```typescript
const { console } = iina;

interface MarkerData {
  markers: Array<{ time: number; type: 1 | 2 }>;
  duration: number;
  currentTime: number;
  videoName: string;
}

let data: MarkerData = {
  markers: [],
  duration: 0,
  currentTime: 0,
  videoName: 'No video'
};

// Обработка update сообщений
iina.onMessage('update', (newData: MarkerData) => {
  console.log('[Sidebar] Update received');
  data = newData;
  render();
});

// Рендеринг
function render() {
  renderInfo();
  renderTimeline();
  renderList();
}

function renderInfo() {
  document.getElementById('video-name')!.textContent = data.videoName;
  document.getElementById('markers-count')!.textContent = `${data.markers.length} markers`;
}

function renderTimeline() {
  const canvas = document.getElementById('timeline') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Timeline background
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 28, canvas.width, 4);
  
  // Markers
  data.markers.forEach(m => {
    const x = (m.time / data.duration) * canvas.width;
    ctx.fillStyle = m.type === 1 ? '#4CAF50' : '#F44336';
    ctx.beginPath();
    ctx.arc(x, 30, 5, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function renderList() {
  const list = document.getElementById('markers-list')!;
  if (data.markers.length === 0) {
    list.innerHTML = '<div class="hint">Press 1 or 2</div>';
    return;
  }
  
  list.innerHTML = data.markers
    .sort((a, b) => a.time - b.time)
    .map(m => `
      <div class="marker" onclick="seek(${m.time})">
        <span class="badge type-${m.type}">Type ${m.type}</span>
        <span>${formatTime(m.time)}</span>
      </div>
    `).join('');
}

function seek(time: number) {
  iina.postMessage('seek', { time });
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// Запрос начальных данных
iina.postMessage('request-update');
```

### 5. Build скрипт (build/build.ts)

```typescript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

const PLUGIN_NAME = 'VideoMarkers.iinaplugin';
const DIST_DIR = path.join(process.cwd(), 'dist', PLUGIN_NAME);
const IINA_PLUGINS = path.join(
  process.env.HOME!,
  'Library/Application Support/com.colliderli.iina/plugins',
  PLUGIN_NAME
);

function build() {
  console.log('🔨 Building plugin...');
  
  // Clean
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  
  // Compile TypeScript
  execSync('tsc -p tsconfig.build.json', { stdio: 'inherit' });
  
  // Copy UI files
  const sidebarDist = path.join(DIST_DIR, 'sidebar');
  fs.mkdirSync(sidebarDist, { recursive: true });
  fs.copyFileSync('ui/sidebar/index.html', path.join(sidebarDist, 'index.html'));
  fs.copyFileSync('ui/sidebar/style.css', path.join(sidebarDist, 'style.css'));
  
  // Compile sidebar script
  execSync(`tsc ui/sidebar/script.ts --outDir ${sidebarDist}`, { stdio: 'inherit' });
  
  // Copy Info.json
  fs.copyFileSync('Info.json', path.join(DIST_DIR, 'Info.json'));
  
  // Install to IINA
  if (fs.existsSync(IINA_PLUGINS)) {
    fs.rmSync(IINA_PLUGINS, { recursive: true });
  }
  fs.cpSync(DIST_DIR, IINA_PLUGINS, { recursive: true });
  
  console.log('✅ Build complete!');
  console.log('📍 Installed to:', IINA_PLUGINS);
  console.log('⚠️  Restart IINA to see changes');
}

// Watch mode
if (process.argv.includes('--watch')) {
  console.log('👀 Watching for changes...');
  chokidar.watch(['src/**/*', 'ui/**/*', 'Info.json']).on('change', () => {
    console.log('\n🔄 Change detected, rebuilding...');
    build();
  });
}

build();
```

### 6. Info.json

```json
{
  "name": "VideoMarkers",
  "identifier": "com.iina.videomarkers",
  "version": "0.1.0",
  "entry": "main.js",
  "author": {
    "name": "User"
  },
  "description": "Add time markers with hotkeys 1 and 2",
  "minIINAVersion": "1.3.0",
  "permissions": ["show-osd"],
  "sidebarTab": {
    "name": "Markers"
  }
}
```

## Workflow разработки

```bash
# Установка зависимостей
npm install

# Dev режим (watch + auto-rebuild + auto-install)
npm run dev

# Правки в src/index.ts или ui/ → автосборка → автоустановка → перезапуск IINA
```

## Преимущества этого подхода

✅ **TypeScript** - автодополнение, проверка типов, меньше ошибок  
✅ **Правильный entry point** - через деструктуризацию `iina` объекта  
✅ **Автосборка** - изменения автоматически компилируются и устанавливаются  
✅ **Работает** - проверено на референсном плагине  
✅ **Простая структура** - без React/Parcel, только TypeScript компилятор  

## Отличия от референсного плагина

**Упрощения:**

- Без React/Vue/Parcel
- Без сложной системы тегов
- Без миниатюр и экспорта
- Только sidebar (без standalone window)

**Сохраняем:**

- TypeScript + типы
- Структуру сборки
- Паттерн коммуникации main ↔ sidebar

## Порядок выполнения

1. Удалить старую версию плагина
2. Создать новую структуру проекта с TypeScript
3. Настроить package.json, tsconfig.json
4. Создать src/index.ts с правильным entry point
5. Создать ui/sidebar с HTML/CSS/TS
6. Создать build скрипт
7. Запустить `npm run dev` и протестировать

