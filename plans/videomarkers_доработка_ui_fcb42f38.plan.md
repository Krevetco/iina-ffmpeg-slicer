---
name: VideoMarkers доработка UI
overview: "Исправить три бага (timeline при первом открытии, клик по меткам, клик по timeline) и добавить новые функции: удаление меток, редактирование label, два параллельных списка."
todos:
  - id: fix-timeline
    content: "Исправить баг: timeline пустая при первом открытии — добавить ResizeObserver"
    status: completed
  - id: fix-click
    content: "Исправить баг: клики по маркерам и по timeline не работают — заменить onclick на addEventListener"
    status: completed
  - id: marker-id-label
    content: Добавить поля id и label к интерфейсу Marker в src/index.ts и ui/sidebar/script.ts
    status: completed
  - id: delete-rename-handlers
    content: Добавить обработчики delete-marker и rename-marker в src/index.ts
    status: completed
  - id: two-columns-ui
    content: Переделать UI в два параллельных столбца (Type 1 / Type 2) в index.html и style.css
    status: completed
  - id: card-render
    content: Реализовать рендеринг карточек с кнопками удаления и редактирования label в script.ts
    status: completed
  - id: build-install
    content: Собрать и установить обновлённый плагин
    status: completed
isProject: false
---

# VideoMarkers — доработка UI

## Диагностика текущих багов

### Баг 1: Timeline пустая при первом открытии

**Причина:** `renderTimeline()` считает ширину canvas через `canvas.parentElement.clientWidth`. При первом рендере sidebar ещё не вставлен в DOM IINA (или не отрисован), поэтому `clientWidth === 0`. Canvas рисуется с нулевой шириной и ничего не видно.

**Решение:** Добавить `ResizeObserver` на контейнер timeline — перерисовывать canvas каждый раз когда меняется его реальная ширина.

### Баг 2: Клик по меткам в списке не работает

**Причина:** `onclick="seekTo(...)"` в `innerHTML` не работает в WebView IINA — браузерный контекст не позволяет вызывать функции через inline-обработчики в динамически вставленном HTML. Нужно вешать обработчики через `addEventListener`.

**Решение:** После вставки HTML пройтись по элементам и добавить `addEventListener('click', ...)` вместо `onclick`.

### Баг 3: Клик по timeline не работает

**Причина:** На canvas нет обработчика кликов совсем.

**Решение:** Добавить `canvas.addEventListener('click', ...)` с пересчётом позиции в время.

---

## Новые функции

### Структура данных

Добавить поля `label` и `id` к маркеру:

```typescript
// src/index.ts
interface Marker {
  id: string;        // уникальный ID для операций удаления/редактирования
  time: number;
  type: 1 | 2;
  label: string;     // пользовательское название (может быть пустым)
  createdAt: string;
}
```

Добавить новые сообщения от sidebar → main:

```typescript
sidebar.onMessage('delete-marker', (data) => { /* удалить по id */ });
sidebar.onMessage('rename-marker', (data) => { /* обновить label по id */ });
```

### UI: два параллельных списка

Заменить `#markers-list` на `#columns`:

```html
<!-- index.html -->
<div id="columns">
  <div class="col">
    <div class="col-header badge-1">Type 1</div>
    <div id="list-1"></div>
  </div>
  <div class="col">
    <div class="col-header badge-2">Type 2</div>
    <div id="list-2"></div>
  </div>
</div>
```

CSS: `#columns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }`

### Каждая карточка маркера

```
┌────────────────────┐
│ 00:01:23           │
│ label (если есть)  │
│ [✏] [🗑]          │
└────────────────────┘
```

Карточка кликабельна — seekTo. Кнопки: карандаш (редактировать label), мусорка (удалить). Клик по карточке НЕ срабатывает если кликнули по кнопке.

### Inline-редактирование label

По клику на карандаш — текстовое поле появляется прямо в карточке (contenteditable или `<input>`). По Enter/blur — сохраняется и отправляется `rename-marker` в main.js.

---

## Изменяемые файлы

- `[src/index.ts](src/index.ts)` — добавить `id`/`label` к Marker, обработчики `delete-marker` и `rename-marker`
- `[ui/sidebar/script.ts](ui/sidebar/script.ts)` — исправить все три бага, новый рендеринг двух колонок, обработчики кнопок
- `[ui/sidebar/index.html](ui/sidebar/index.html)` — два столбца вместо одного списка
- `[ui/sidebar/style.css](ui/sidebar/style.css)` — стили карточек, колонок, кнопок, inline-редактора

