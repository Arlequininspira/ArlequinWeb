# PERF AUDIT — Cambio 4 (Performance)

> Commit: `00b247e`  
> Fecha: 2026-05-03

---

## Archivos nuevos

### `src/hooks/useLowEndDevice.js`
Hook que detecta dispositivos lentos. Devuelve `{ isLowEnd, prefersReducedMotion }`.

**Lógica de detección:**
1. `navigator.hardwareConcurrency <= 2` → low-end inmediato
2. `navigator.deviceMemory <= 1` GB → low-end inmediato (solo Chromium)
3. Si cores ≤ 4 o mem ≤ 2 GB → benchmark sincrónico: 500k iteraciones `Math.sqrt`. Si tarda > 50ms → low-end
4. `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → siempre se lee, independiente del hardware

---

## Archivos modificados

### `src/App.jsx`
- Import `useLowEndDevice`
- Instancia el hook: `const { isLowEnd, prefersReducedMotion } = useLowEndDevice()`
- Pasa `isLowEnd` y `prefersReducedMotion` a `<BackgroundAnimation>`
- Pasa `isLowEnd` a `<ThemeToggleStar>`

---

### `src/components/BackgroundAnimation.jsx`
**Problema anterior:** carga de 382 imágenes sin `image.decode()` (decode bloqueaba main thread), drift en RAF (`= timestamp` en vez de `+= FRAME_DURATION`), sin modo reducido.

**Cambios:**
- `_starCache` a nivel de módulo — las imágenes sobreviven re-mounts (hot reload, etc.)
- `image.decode()` en cada frame: decode ocurre off-main-thread, evita jank al iniciar animación
- RAF fixed-timestep: `lastFrameTimeRef.current += FRAME_DURATION` — sin drift acumulado
- Inicialización correcta: primer RAF setea `lastFrameTimeRef.current = timestamp` (evita race-through de ~22 frames al montar)
- Si `isLowEnd || prefersReducedMotion`: dibuja primer frame estático y cancela el loop — fondo sólido con estrellas congeladas, sin costo de RAF

---

### `src/components/ThemeToggleStar.jsx`
**Problemas anteriores:** mismos que BackgroundAnimation (sin decode, drift en RAF).

**Cambios:**
- `_starCache` a nivel de módulo — si BackgroundAnimation ya cargó las imágenes, ThemeToggleStar las reutiliza sin re-fetch ni re-decode
- `image.decode()` con mismo patrón
- RAF fixed-timestep con inicialización correcta
- Si `isLowEnd`: dibuja primer frame y cancela loop; agrega clase `no-pulse` al botón

---

### `src/components/ThemeToggleStar.css`
- Clase `.theme-toggle.no-pulse { animation: none !important }` — usada cuando `isLowEnd`
- `@media (prefers-reduced-motion: reduce)` — elimina animación `pulse-dark` / `pulse-light` vía CSS puro (cubre caso en que el JS no haya corrido todavía)

---

### `src/components/ArlequinMaskSystem.jsx`
**Problema anterior:** al entrar a `CONTENT_VISIBLE`, montaba los 4 componentes de carta con `preload=true` simultáneamente → 4 × (20+ imágenes × 2 temas) decodificándose al mismo tiempo.

**Cambio:** preload lazy — solo monta el componente de la carta con índice `preloadCard` (seteado al hacer hover sobre una carta en el grid). Los caches a nivel de módulo de cada componente (`_openCache`, `_closeCache`) garantizan que cuando se monta la instancia real ya encuentra las imágenes listas.

```jsx
// Antes
{stage !== STAGES.NONE && Object.entries(CARD_COMPONENTS).map(([key, Component]) => (
  <Component key={`preload-${key}`} preload={true} isDarkMode={isDarkMode} />
))}

// Después
{preloadCard !== null && (() => {
  const Preload = CARD_COMPONENTS[preloadCard];
  return Preload ? <Preload key={`preload-${preloadCard}`} preload={true} isDarkMode={isDarkMode} /> : null;
})()}
```

---

### `src/components/GridStage.jsx`
**Problema anterior:** `onCardPreClick` se disparaba dentro de `handleCardClick` — preload empezaba en el momento del click, demasiado tarde para dispositivos lentos.

**Cambio:** `onMouseEnter` y `onTouchStart` en cada `<button>` de carta disparan `onCardPreClick(index + 1)` si el grid está en estado `idle`. En desktop da ~800ms+ de ventana antes del click. En mobile, `touchstart` se dispara antes del `click` event.

---

### `src/components/CardQueEsArlequin.jsx` + `CardQueEsArlequin.css`
*(Cambios de contenido pre-existentes, incluidos en este commit)*

- Textos reescritos de líneas fijas (`white-space: nowrap`) a párrafos con `word-break: break-word`
- CSS: `top: 200px` (antes `top: 30%` con `transform`), `font-size: 14px`, `line-height: 1.45`
- `card-text-line` → `card-text-paragraph` (`<p>` con `margin-bottom: 10px`)

---

## Resumen de impacto esperado

| Área | Antes | Después |
|------|-------|---------|
| Decode de 382 frames (BackgroundAnim) | Main thread, bloqueante | Off-main-thread via `image.decode()` |
| Drift RAF | Acumulativo (`= timestamp`) | Cero (`+= FRAME_DURATION`) |
| Preload de cartas al abrir contenido | 4 cartas simultáneas | Solo la carta hovereada |
| Inicio de preload en grid | Al hacer click | Al hacer hover / touchstart |
| Dispositivos lentos / reduced-motion | Animación completa igual | Fondo estático, sin pulse |
| Cache de imágenes entre remounts | Ninguno | Module-level (_starCache, _openCache, _closeCache) |
