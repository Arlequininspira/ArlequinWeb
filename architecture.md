# Documentación de Arquitectura del Proyecto Arlequín

## 1. Resumen del Proyecto

**Nombre:** Arlequín (star-animation)  
**Tipo:** Sitio web interactivo con animaciones complejas  
**Tecnología:** React 18 + Vite 5  
**Estado:** Versión 0.0.1

Este proyecto es un sitio web interactivo con temática de "Arlequín" que utiliza animaciones avanzadas basadas en Canvas y pre-carga de frames de imagen para crear experiencias visuales fluidas.

---

## 2. Estructura del Proyecto

```
d:/Alequin/
├── public/                    # Recursos estáticos públicos
│   ├── Cartas/               # Imágenes de cartas (verso, frente, escudo, banners)
│   ├── estrellas/            # Frames de animación de estrellas (191 frames)
│   ├── isologo/             # Frames de animación del isologo
│   └── fonts/               # Fuentes (si las hay)
├── src/
│   ├── main.jsx             # Punto de entrada de React
│   ├── App.jsx              # Componente principal y gestión de estado
│   ├── App.css              # Estilos globales de App
│   ├── index.css            # Estilos globales reset/normalización
│   └── components/          # Componentes React
│       ├── ArlequinMaskSystem.jsx   # Sistema principal de contenido
│       ├── ArlequinMask.jsx          # Animación de máscara
│       ├── ArlequinEscudo.jsx        # Escudo/escudo heráldico
│       ├── BackgroundAnimation.jsx  # Animación de fondo con Canvas
│       ├── LogoAnimation.jsx        # Animación de logo con Canvas
│       ├── ThemeToggleStar.jsx      # Botón de cambio de tema
│       ├── FooterBanner.jsx        # Banner animado del pie
│       ├── QuestionStage.jsx       # Etapa de pregunta Sí/No
│       ├── GridStage.jsx           # Cuadrícula de tarjetas
│       ├── CardStage.jsx          # Etapa de tarjeta
│       ├── CardQueEsArlequin.jsx   # Contenido: ¿Qué es Arlequín?
│       ├── CardServicios.jsx       # Contenido: Servicios
│       ├── CardContacto.jsx        # Contenido: Contacto
│       ├── CardQuemiesSomos.jsx    # Contenido: Quiénes somos
│       └── [archivos CSS]          # Estilos correspondientes
├── index.html               # HTML base
├── package.json             # Dependencias y scripts
├── vite.config.js           # Configuración de Vite
└── architecture.md          # Este documento
```

---

## 3. Responsabilidades por Carpeta/Archivo

### 3.1 `public/`

| Carpeta | Contenido | Propósito |
|---------|-----------|-----------|
| `Cartas/` | ~50+ imágenes .avif | Cartas del juego Arlequín (verso, frente), escudo, banners, elementos UI |
| `estrellas/` | 191 frames de animación | Secuencia de frames para animación de estrellas (estrella_giro_*.avif) |
| `isologo/` | Frames de animación | Secuencia para animación del logo |
| `fonts/` | Fuentes personalizadas | (si aplica) |

### 3.2 `src/`

| Archivo | Responsabilidad |
|---------|-----------------|
| `main.jsx` | Punto de entrada de React, renderiza el App dentro de StrictMode |
| `App.jsx` | **Orquestador principal**: gestión de estado global (tema, fases de animación), coordinación entre componentes |
| `index.css` | Estilos globales reset y variables CSS |
| `App.css` | Estilos del contenedor principal |

### 3.3 `src/components/`

#### Componentes de Animación Core

| Componente | Archivo JSX | Responsabilidad |
|------------|-------------|-----------------|
| **BackgroundAnimation** | `BackgroundAnimation.jsx` | Canvas con animación de estrellas. Carga 191x2=382 imágenes, renderiza estrellas con posiciones aleatorias, responde a cambio de tema |
| **LogoAnimation** | `LogoAnimation.jsx` | Canvas con doble animación: logo interactivo (hover) + secuencia de carta Arlequín al hacer click. États: idle, opening, loop, closing, arlequin |
| **ArlequinMask** | `ArlequinMask.jsx` | Máscara animada que se abre/cierra según la fase. Usa transformaciones CSS con translateX |
| **ThemeToggleStar** | `ThemeToggleStar.jsx` | Botón toggle tema con animación de estrella en Canvas. Tooltip informativo |

#### Componentes de Sistema de Contenido

| Componente | Responsabilidad |
|------------|-----------------|
| **ArlequinMaskSystem** | Contenedor del contenido principal. Gestiona etapas (stages): NONE → QUESTION → CARD/GRID → CARD_DETAIL. Renderiza componentes según estado |
| **QuestionStage** | Pregunta inicial "¿Conoces a Arlequín?" con botones SÍ/NO |
| **GridStage** | Cuadrícula de 4 tarjetas: ¿Qué es?, ¿Quiénes somos?, Servicios, Contacto |
| **CardStage** | Contenedor de animación de carta con contenido de texto integrado (usa estructura de arrays para líneas de texto) |
| **CardQueEsArlequin** | Contenido informativo "Qué es Arlequín" |
| **CardServicios** | Contenido de servicios ofrecidos |
| **CardContacto** | Formulario o información de contacto |
| **CardQuemiesSomos** | Contenido "Quiénes somos" |
| **ArlequinEscudo** | Escudo clickeable para volver al inicio |

#### Componentes de UI

| Componente | Responsabilidad |
|------------|-----------------|
| **FooterBanner** | Banner inferior animado (scroll infinito) con imagen del zócalo |

---

## 4. Flujo de Animación (State Machine)

El componente `App.jsx` implementa una máquina de estados para las animaciones:

```
HOME 
  → (click logo) → LOGO_SHRINKING → MASK_CLOSING → MASK_OPENING 
    → CONTENT_VISIBLE → (click escudo) → REVERSE_CLOSING → REVERSE_OPENING 
      → HOME
```

### Fases definidas en `ANIMATION_PHASE`:
- `HOME` - Estado inicial
- `LOGO_SHRINKING` - Logo comienza a encogerse
- `MASK_CLOSING` - Máscara se cierra
- `MASK_OPENING` - Máscara se abre
- `CONTENT_VISIBLE` - Contenido visible
- `REVERSE_CLOSING` - Invertir cierre
- `REVERSE_OPENING` - Invertir apertura

---

## 5. Gestión de Temas (Dark/Light Mode)

- **Estado:** `isDarkMode` (boolean) persistido en `localStorage`
- **Cambio:** `ThemeToggleStar` emite `onToggle`
- **Imágenes:** Cada recurso tiene versión `_dark` y `_clear` (ej: `arlequin_escudo_dark.avif`)
- **Componentes que consumen tema:** Todos los componentes que muestran imágenes

---

## 6. Análisis de Rendimiento

### 6.1 Problemas Identificados

| Problema | Ubicación | Impacto |
|----------|-----------|---------|
| **Carga masiva de imágenes** | `BackgroundAnimation`, `LogoAnimation`, `ThemeToggleStar` | ~700+ imágenes cargadas al inicio |
| **Sin código split** | Proyecto entero | Todo el JS en un bundle |
| **Sin lazy loading** | Componentes de etapas | Todos los componentes cargados upfront |
| **Sin optimización de imágenes** | public/ | Imágenes .avif sin comprimir/webp |
| **Duplicación de lógica** | Múltiples Canvas | Tres implementaciones independientes de animación Canvas |
| **CSS inline en componentes** | `ArlequinMask.jsx` | `isMobile` evaluado en render time |

### 6.2 Métricas Estimadas

- **Imágenes carga inicial:** ~50MB (191 frames × 2 temas × 3 componentes = ~1146 cargas)
- **Bundle JS:** Sin medir (React + código componente)
- **Tiempo primer paint:** Probablemente alto por carga de imágenes

---

## 7. Propuestas de Mejora

### 7.1 Arquitectura y Organización

| # | Mejora | Prioridad | Descripción |
|---|--------|-----------|-------------|
| 1 | **Agrupar lógica de Canvas** | Alta | Crear hook `useCanvasAnimation` o componente `AnimatedCanvas` reutilizable |
| 2 | **Code Splitting** | Alta | Usar `React.lazy()` para stages: QuestionStage, GridStage, Cards |
| 3 | **Separar componentes de contenido** | Media | Mover CardQueEsArlequin, CardServicios, etc. a carpeta `pages/` o `features/` |
| 4 | **Agrupar imágenes por tipo** | Media | Reorganizar public/ en subcarpetas lógicas más claras |

### 7.2 Rendimiento

| # | Mejora | Prioridad | Descripción |
|---|--------|-----------|-------------|
| 1 | **Carga perezosa de frames** | Alta | Cargar frames bajo demanda, no todos al inicio |
| 2 | **Usar spritesheets** | Alta | Unir frames en spritesheet para reducir requests HTTP |
| 3 | **Implementar Intersection Observer** | Media | Solo iniciar animaciones cuando el componente es visible |
| 4 | **Compresión de imágenes** | Media | Convertir a WebP con optimización |
| 5 | **CDN para estáticos** | Baja | Servir imágenes desde CDN |

### 7.3 Mantenibilidad

| # | Mejora | Prioridad | Descripción |
|---|--------|-----------|-------------|
| 1 | **Crear constants/theme.js** | Alta | Extraer strings como 'dark', 'clear', rutas a un archivo centralizado |
| 2 | **Extraer configuración de animaciones** | Alta | Mover constantes (TOTAL_FRAMES, FRAME_DURATION, etc.) a archivo config |
| 3 | **Crear hook useTheme** | Media | Abstraer lógica de tema a custom hook |
| 4 | **Componente ImageLoader reutilizable** | Media | Crear componente para pre-carga de imágenes con cache |
| 5 | **Documentar transiciones de fase** | Baja | Agregar diagrama de estados en documentación |

### 7.4 CSS/Estilos

| # | Mejora | Prioridad | Descripción |
|---|--------|-----------|-------------|
| 1 | **Usar CSS Modules** | Media | Encapsular estilos por componente |
| 2 | **Extraer variables CSS** | Media | Definir colores, breakpoints en root CSS |
| 3 | **Mover estilos inline a CSS** | Baja | Extraer `MASK_POSITION` y `isMobile` de JSX |

---

## 8. Recomendación de Estructura Futura

```
src/
├── components/
│   ├── animations/           # Componentes de animación
│   │   ├── BackgroundAnimation.jsx
│   │   ├── LogoAnimation.jsx
│   │   ├── ThemeToggleStar.jsx
│   │   └── ArlequinMask.jsx
│   ├── layout/              # Componentes de layout
│   │   └── FooterBanner.jsx
│   ├── shared/              # Componentes reutilizables
│   │   ├── ImageLoader.jsx
│   │   └── Canvas.jsx
│   └── system/              # Sistema de contenido
│       ├── ArlequinMaskSystem.jsx
│       └── ArlequinEscudo.jsx
├── pages/                   # Componentes de contenido/stages
│   ├── QuestionStage.jsx
│   ├── GridStage.jsx
│   ├── CardQueEsArlequin.jsx
│   ├── CardServicios.jsx
│   ├── CardContacto.jsx
│   └── CardQuemiesSomos.jsx
├── hooks/                   # Custom hooks
│   ├── useTheme.js
│   ├── useCanvasAnimation.js
│   └── usePreloadImages.js
├── config/                  # Constantes y configuración
│   ├── animation.js
│   ├── paths.js
│   └── theme.js
├── styles/                  # Estilos globales
│   ├── variables.css
│   └── reset.css
├── App.jsx
└── main.jsx
```

---

## 9. Diagrama de Componentes (Simplificado)

```
                    ┌─────────────────────────────────────────┐
                    │              App.jsx                    │
                    │  (Estado: theme, animation phase)        │
                    └──────────────┬──────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│BackgroundAnimation│    │  LogoAnimation   │    │ ThemeToggleStar  │
│    (Canvas)       │    │    (Canvas)       │    │    (Canvas)      │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   ArlequinMaskSystem      │
                    │  (Gestor de stages)       │
                    └────────────┬─────────────┘
                                 │
         ┌───────────┬───────────┼───────────┬───────────┐
         ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
   │Question │ │  Grid   │ │  Card  │ │  Card  │ │ Card    │
   │ Stage   │ │ Stage   │ │ Stage  │ │ Detail │ │ Detail  │
   └─────────┘ └─────────┘ └────────┘ └────────┘ └─────────┘
```

---

## 10. Glosario de Términos

| Término | Significado |
|---------|-------------|
| **Frame** | Imagen individual en una secuencia de animación |
| **Canvas** | Elemento HTML5 para renderizado gráfico dinámico |
| **Preload/Pre-carga** | Cargar recursos antes de que sean necesarios |
| **Theme/Dark mode** | Sistema de tema claro/oscuro |
| **Stage/Etapa** | Estado visual del contenido (pregunta, grid, detalles) |
| **Phase/Fase** | Estado de la animación principal |

---

## 11. Registro de Cambios y Correcciones

### 2024 - Corrección de Animación de Máscara y Flujo "NO" (ArlequinMask.jsx y ArlequinMaskSystem.jsx)

**Problema 1:** Cuando se hacía click en el logo, la máscara no se animaba correctamente. Quedaba en posición "cerrada" sin transición.

**Causa raíz 1:** 
1. El hook `useMaskPositions` usaba `useState(null)` para inicializar las posiciones
2. Cuando la fase cambiaba a `logoShrinking`, `maskPositions` era `null`, lo que causaba que el código intentara acceder a `null.CLOSED` y retornara `undefined`
3. No había animación suave desde `OFFSCREEN` hacia `CLOSED` en el primer render

**Solución aplicada 1:**
1. Cambié `defaultTransforms` para tener la misma estructura que las posiciones calculadas (`OFFSCREEN`, `CLOSED`, `OPEN`)
2. Usé `const positions = maskPositions || defaultTransforms` para siempre tener valores válidos
3. Agregué un estado `hasAnimatedIn` para forzar una animación desde `OFFSCREEN` al inicio de la secuencia
4. Agregué `maskClosing` a la condición de `handleTransitionEnd` para que el flujo del "NO" funcione correctamente

---

**Problema 2:** Cuando se presionaba "NO" en la pregunta, la máscara se cerraba y abría pero volvía a mostrar QuestionStage en lugar de CardStage.

**Causa raíz 2:**
1. El sistema usaba `useState` (`isCardAnimationReady`) para rastrear el flujo del "NO"
2. Los efectos de React tienen problemas de timing: cuando el estado `phase` cambia a `contentVisible`, el valor de `isCardAnimationReady` ya había cambiado o el efecto se ejecutaba en el orden incorrecto
3. El batching de React causaba que el primer efecto viera el valor actualizado antes de que el segundo efecto pudiera actuar

**Solución aplicada 2:**
1. Reemplacé `isCardAnimationReady` (useState) con `pendingCardStageRef` (useRef)
2. Los refs se actualizan inmediatamente sin esperar el ciclo de render de React
3. El flujo ahora funciona así:
   - Click en "NO" → `pendingCardStageRef.current = true`
   - La fase cambia a `maskClosing` → el primer efecto ve el ref y retorna sin resetear el stage
   - La fase cambia a `maskOpening` → el primer efecto ve el ref y retorna sin resetear el stage
   - La fase cambia a `contentVisible` → el primer efecto ve el ref = true, limpia el ref y cambia el stage a CARD

**Cambios en código:**
- `ArlequinMask.jsx`: 
  - Valores por defecto estructurados
  - Estado `hasAnimatedIn` para control de animación inicial
  - `handleTransitionEnd` ahora maneja `maskClosing`, `maskOpening`, `reverseClosing`, `reverseOpening`
- `ArlequinMaskSystem.jsx`:
  - Usa `pendingCardStageRef` (useRef) en lugar de `isCardAnimationReady` (useState)
  - Flujo simplificado en un solo useEffect que maneja both QuestionStage y CardStage

---

### 2025 - Corrección de CardStage (CardStage.jsx y CardStage.css)

**Problema 1:** Los botones de navegación estaban invertidos - el botón de arriba iba abajo y viceversa.

**Solución aplicada 1:**
- Invertí las funciones de los botones en el JSX: el botón de arriba (card-nav-prev) ahora llama a `handleNextCard` y el de abajo (card-nav-next) llama a `handlePrevCard`

---

**Problema 2:** El orden de los textos estaba invertido - el último texto debía ser el primero.

**Solución aplicada 2:**
- Reorganicé el array `cardTexts` para que el contenido de la página 3 apareciera primero
- Page 1 ahora muestra el contenido original de "Además, desarrollamos..."
- Page 2 muestra "Nos especializamos en..."
- Page 3 muestra "Arlequín es una marca..."

---

**Problema 3:** Las sangrías aparecían al lado izquierdo del texto en lugar del derecho.

**Solución aplicada 3:**
- Cambié la estructura del texto para usar arrays de objetos con `text` e `indent`
- Cada línea es un `<div>` separado con `marginRight` para la sangría
- Ahora las sangrías aparecen al lado derecho del texto

---

**Cambios en código:**
- `CardStage.jsx`: 
  - Estructura de texto convertida a arrays de líneas
  - Botones invertidos funcionalmente
  - Orden de páginas corregido
- `CardStage.css`:
  - `.card-text-line` con `font-size: 15px`
  - `.card-text-container` con `left: 55px`
  - Alineación a la izquierda con sangrías a la derecha

---

## GridStage Text Styling - Versión Final Aprobada (2024)

**Estado:** Restaurado a versión original + aprobado por usuario.

**Características del texto "¿Qué es Arlequín?" (.card-text-overlay):**

### Clear Mode (not(.dark)):
```
color: white
-webkit-text-stroke: 0.5px black
text-shadow: 2px 2px 4px rgba(0,0,0,0.8)
font-size: 20px
```

### Dark Mode (.dark):
```
color: white
-webkit-text-stroke: 2px #1a1a1a
text-shadow: 0 0 8px rgba(255,255,255,0.9), 2px 2px 4px rgba(0,0,0,0.5)
```

**Archivos de respaldo creados:**
- `GridStage-ORIGINAL.css` - Backup versión pre-modificación
- `casino-title.css` - Estilo casino banner separado (no interfiere)

**CSS completo GridStage restaurado y aprobado.**

---
*Documento generado automáticamente para referencia del proyecto Arlequín.*

