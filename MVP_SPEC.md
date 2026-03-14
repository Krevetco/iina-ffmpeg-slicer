# VideoMarkers для IINA - Техническое задание MVP

## Цель проекта

Плагин для IINA, позволяющий ставить временные метки (bookmarks) двух типов во время просмотра видео:
- **Type 1** - начало сегмента (клавиша `1`)
- **Type 2** - конец сегмента (клавиша `2`)

---

## Функциональные требования MVP

### ✅ Что ДОЛЖНО работать:

1. **Горячие клавиши**
   - Клавиша `1` → добавить метку Type 1 (начало сегмента)
   - Клавиша `2` → добавить метку Type 2 (конец сегмента)
   - Регистрация через IINA Menu API с `keyBinding`

2. **Хранение меток**
   - Сохранение при каждом добавлении метки
   - Автозагрузка при открытии видео
   - Привязка к конкретному видеофайлу

3. **UI в Sidebar**
   - Вкладка "Markers" в боковой панели IINA
   - Информационная панель (имя видео, количество меток, текущая позиция)
   - Визуальная временная шкала с маркерами
   - Список всех меток с деталями

4. **Навигация**
   - Клик по метке в списке → переход к времени (`core.seekTo`)
   - Клик по маркеру на шкале → переход к времени
   - OSD уведомления при добавлении меток

5. **Визуальная дифференциация**
   - Type 1 → зелёный цвет
   - Type 2 → красный цвет

### ❌ Что НЕ входит в MVP:

- Редактирование текста меток
- Удаление меток через UI
- Drag-and-drop правка на шкале
- Автоматическое спаривание сегментов 1↔2
- Экспорт в chapters/ffmetadata/mkv chapters
- Встраивание маркеров в штатную seek bar IINA
- Импорт из других форматов

---

## Технические требования

### Платформа

- **IINA:** версия ≥ 1.4.0 (plugin system)
- **macOS:** ≥ 10.11 (ES6 support в JavaScriptCore)
- **JavaScript:** ES6 (без транспиляции)

### Архитектура плагина

```
VideoMarkers.iinaplugin/
├── Info.json              # Конфигурация плагина
├── src/
│   ├── main.js           # Main entry point
│   └── sidebar/
│       ├── sidebar.html  # UI интерфейс
│       ├── sidebar.css   # Стили
│       └── sidebar.js    # Логика webview
└── README.md
```

### API модули IINA

- `iina.core` - управление плеером (seekTo, status.position, osd)
- `iina.event` - события (file-loaded, window-loaded)
- `iina.menu` - горячие клавиши (menu.item с keyBinding)
- `iina.sidebar` - UI в боковой панели (loadHTML, postMessage)
- `iina.preferences` - хранение данных (set, get)
- `iina.console` - логирование

### Разрешения (permissions)

```json
"permissions": [
  "file-system",
  "show-osd"
]
```

---

## Формат данных

### Структура метки

```javascript
{
  "time": 12.345,           // float, секунды
  "key": "1",               // string "1" или "2"
  "createdAt": "2026-03-12T10:15:30.123Z",  // ISO-8601 UTC
  "type": 1                 // number 1 или 2
}
```

### Хранение

**Текущий подход:** IINA Preferences API

```javascript
// Ключ: markers_<videoId>
// videoId = filename + duration
// Значение: JSON.stringify(markers[])

const key = `markers_${filename}_${duration}`;
preferences.set(key, JSON.stringify(markers));
```

**Оригинальный план (не работает):** JSON sidecar файлы

Причина отказа: `core.status.path` возвращает `undefined` в IINA 1.4.1

---

## Пользовательский сценарий

### Первый запуск

1. Пользователь устанавливает плагин через Settings → Plugins
2. Плагин появляется в списке установленных
3. В меню появляется "Plugin" с пунктами добавления меток

### Работа с видео

1. **Открытие видео:**
   - Плагин получает событие `mpv.file-loaded`
   - Генерирует ID видео: `filename + duration`
   - Загружает сохранённые метки из preferences
   - Отображает метки в sidebar

2. **Добавление метки:**
   - Пользователь нажимает `1` или `2`
   - Плагин создаёт метку с текущим временем
   - Сохраняет в preferences
   - Показывает OSD уведомление
   - Обновляет sidebar (postMessage)

3. **Навигация:**
   - Клик по метке → вызов `iina.postMessage("seek")`
   - Main.js получает → `core.seekTo(time)`

### Повторное открытие

1. Открывается то же видео
2. Плагин распознаёт по ID
3. Автоматически загружает метки
4. Отображает в sidebar

---

## UI Спецификация

### Sidebar Layout

```
┌─────────────────────────────┐
│ Video: filename.mp4         │
│ Markers: 5                  │
│ Position: 00:05:23.456      │
├─────────────────────────────┤
│ Timeline                    │
│ ├──█──────█───█─────────┤  │
│   ▲       ▲   ▲            │
│  Type1  Type2 Type1        │
├─────────────────────────────┤
│ Markers List                │
│ • 00:01:23.456 [Type 1]     │
│ • 00:02:45.789 [Type 2]     │
│ • 00:05:12.345 [Type 1]     │
├─────────────────────────────┤
│ Press 1 or 2 to add markers │
└─────────────────────────────┘
```

### Цветовая схема

**Light Theme:**
- Type 1: `#4CAF50` (зелёный)
- Type 2: `#F44336` (красный)
- Playhead: `#2196F3` (синий)

**Dark Theme:**
- Автоматическое применение через `@media (prefers-color-scheme: dark)`
- CSS переменные для всех цветов

## Требования к итоговому решению

### Обязательные функции

1. ✅ Добавление меток клавишами 1 и 2
2. ⏳ Отображение меток в sidebar (в процессе отладки)
3. ⏳ Сохранение меток (работает, но видео ID временный)
4. ⏳ Загрузка меток (работает)
5. ⏳ Навигация по клику (не проверена из-за UI)

### Приоритет исправлений

1. **КРИТИЧНО:** Заставить sidebar отображать данные
2. **ВАЖНО:** Получить корректный videoPath для JSON файлов
3. **МОЖНО ПОЗЖЕ:** Экспорт, удаление, редактирование

---

## Технические детали реализации

### Info.json (финальная версия)

```json
{
  "name": "VideoMarkers",
  "identifier": "com.iina.videomarkers",
  "version": "0.1.0",
  "entry": "src/main.js",
  "author": {
    "name": "IINA Community"
  },
  "description": "Add time-based markers during playback",
  "minIINAVersion": "1.3.0",
  "permissions": [
    "file-system",
    "show-osd"
  ],
  "sidebarTab": {
    "name": "Markers"
  }
}
```

### Коммуникация main.js ↔ sidebar.js

**Main → Sidebar:**
```javascript
sidebar.postMessage("update", {
  markers: [...],
  duration: 8259.48,
  currentTime: 115.08,
  videoId: "unknown_565"
});
```

**Sidebar → Main:**
```javascript
iina.postMessage("seek", { time: 123.45 });
iina.postMessage("request-update");
```

### Структура marker объекта

```javascript
{
  time: 115.088,              // текущая позиция воспроизведения
  key: "1",                   // какая клавиша нажата
  createdAt: "2026-03-12T20:53:36.140Z",
  type: 1                     // 1 или 2
}
```

---

## Известные проблемы и решения

### Проблема 1: videoPath = undefined/null

**Причина:** `core.status.path` не работает в IINA 1.4.1

**Попытки решения:**
- ✅ Использовать `core.window.title` + duration как ID
- ❌ `core.mpv.getString("path")` - не помогло
- ⏳ Попробовать `core.status["playlist-path"]`

**Текущее решение:** Preferences API вместо JSON файлов

### Проблема 2: Sidebar не отображает данные

**Причина:** sidebar.js возможно не загружается или не регистрирует обработчики

**Попытки решения:**
- ✅ Добавлены meta-теги против кэширования
- ✅ Добавлен DEBUG блок в HTML
- ✅ Детальное логирование
- ⏳ Нужно проверить загружается ли sidebar.js вообще

**Следующий шаг:** Добавить alert/встроить код inline для проверки

---

## Текущий статус

### Что работает (проверено в DevTool):

✅ Плагин загружается  
✅ Menu items регистрируются  
✅ Горячие клавиши срабатывают  
✅ Метки создаются в памяти (видно в логах)  
✅ Сохранение в preferences работает  
✅ Загрузка из preferences работает  
✅ postMessage отправляется (логи показывают success)  
✅ OSD уведомления работают  

### Что НЕ работает:

❌ Sidebar UI остаётся пустым  
❌ Метки не отображаются на шкале  
❌ Метки не отображаются в списке  
❌ JSON файлы не создаются (из-за videoPath=null)  
❌ DEBUG блок не появляется (sidebar.js не выполняется?)  

---

## План исправления

### Этап 1: Диагностика sidebar

**Цель:** Понять, выполняется ли sidebar.js

**Метод:**
1. Добавить `alert()` в начало sidebar.js
2. Или встроить код inline в HTML
3. Проверить путь загрузки скрипта

### Этап 2: Упрощённый тест

**Минимальный sidebar.js:**
```javascript
alert("Sidebar script loaded!");

iina.onMessage("update", function(data) {
  alert("Got " + data.markers.length + " markers");
  
  var list = document.getElementById("markers-list");
  list.innerHTML = "<h1>MARKERS: " + data.markers.length + "</h1>";
});

iina.postMessage("request-update");
```

Если alert появится - значит проблема в коде рендеринга.

### Этап 3: Исправление рендеринга

После подтверждения что sidebar.js работает:
1. Пошагово проверить renderTimeline()
2. Пошагово проверить renderMarkersList()
3. Добавить fallback'ы на ошибки

### Этап 4: Возврат к JSON (опционально)

Если получится найти рабочий способ получить videoPath:
- Попробовать другие API
- Или использовать глобальный entry point
- Или хранить путь в preferences при первом открытии

---

## Критерии успеха MVP

Плагин считается рабочим когда:

1. ✅ После нажатия `1` или `2` метка **ВИДНА** в sidebar
2. ✅ Клик по метке выполняет переход
3. ✅ После перезапуска IINA метки **загружаются**
4. ✅ Можно добавить 10+ меток и все работают
5. ✅ UI корректно отображается в light/dark темах

---

## Ресурсы

- **IINA Plugin API:** https://docs.iina.io/
- **Исходный код:** `/Users/mr.boris/Documents/Sites/iina/VideoMarkers.iinaplugin/`
- **Установленный плагин:** `~/Library/Application Support/com.colliderli.iina/plugins/com.iina.videomarkers.iinaplugin/`
- **Упакованный плагин:** `VideoMarkers-v0.1.0.iinaplgz` (7.2KB)

---

## Текущая блокирующая проблема

**ГЛАВНАЯ ПРОБЛЕМА:** Sidebar.js не выполняется или не получает сообщения от main.js

**Симптомы:**
- Main.js логи показывают "postMessage sent successfully"
- Sidebar DevTool не показывает логи `[Sidebar]`
- UI остаётся в начальном состоянии
- DEBUG блок не появляется

**Нужно:** Подтвердить что sidebar.js вообще загружается и выполняется.

---

**Дата:** 12 марта 2026  
**Версия IINA:** 1.4.1  
**Статус:** В процессе отладки UI отображения
