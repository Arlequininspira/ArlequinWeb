# AUDIT DE ASSETS — Padding Transparente

> Generado con Sharp (pixel-level scan, umbral alpha > 10).
> Mediciones en píxeles del archivo original.

---

## Metodología

Para cada archivo AVIF: dimensiones del contenedor, bounding box del contenido
visible (alpha > 10), padding en cada lado, ratio de transparencia.
"Padding simétrico" = diferencia entre lados opuestos ≤ 2px.

---

## /public/Cartas/

### Grupo: Dorso grid (frame 00000)
| Archivo | Contenedor | Visible | L | R | T | B | Pad% | Simétrico |
|---------|-----------|---------|---|---|---|---|------|-----------|
| `00000_arlequin_dorso_clear.avif` | 684×950 | 668×932 | 8 | 8 | 9 | 9 | 4.2% | ✓ |
| `00000_arlequin_dorso_dark.avif` | 684×950 | 668×932 | 8 | 8 | 9 | 9 | 4.2% | ✓ |

**Recomendación:** OK. Mínimo padding, simétrico. Usado como imagen de fondo en `GridStage`.

---

### Grupo: Frames de animación 00001–00023 (dorso→frente→dorso)
Estos frames representan la carta girando. El padding varía intencionalmente
frame a frame (el contenido visible cambia de forma durante la rotación).

| Frame | Contenedor | Visible | Pad% | Nota |
|-------|-----------|---------|------|------|
| 00001 | 1000×1400 | 656×998 | 53% | inicio giro |
| 00006 | 1000×1400 | 54×1189 | 95% | perfil |
| 00012 | 1000×1400 | 668×932 | 56% | frente completo |
| 00018 | 1000×1400 | 966×85  | 94% | perfil cierre |
| 00023 | 1000×1400 | 740×921 | 51% | dorso final |

Clear y dark son **pixel-identical** dentro de ±1–2px. ✓

**Recomendación:** Padding variable es ESPERADO (animación de giro). No recortar.

---

### Grupo: Frame final estático (_fija)
| Archivo | Contenedor | Visible | L | R | T | B | Pad% |
|---------|-----------|---------|---|---|---|---|------|
| `00012_arlequin_frente_clear_fija.avif` | 1000×1400 | 668×934 | 166 | 166 | 233 | 233 | 55.4% |
| `00012_arlequin_frente_dark_fija.avif` | 1000×1400 | 668×934 | 166 | 166 | 233 | 233 | 55.4% |
| `00012_arlequin_frente_clear.avif` *(frame animado)* | 1000×1400 | 668×932 | 166 | 166 | 234 | 234 | 55.5% |
| `00012_arlequin_frente_dark.avif` *(frame animado)* | 1000×1400 | 668×932 | 166 | 166 | 234 | 234 | 55.5% |

**Par animado vs fija:** diferencia de 2px en alto visible, 1px en padding → **NO CRÍTICO** (sub-pixel en display). ✓

---

### ⚠️ CRÍTICO — Mismatch de contenedor entre grid y animación

| Uso | Archivo | Contenedor | Visible | Pad% |
|-----|---------|-----------|---------|------|
| Grid card (dorso) | `00000_arlequin_dorso_clear.avif` | **684×950** | 668×932 | **4%** |
| Canvas animación (frame 12 frente) | `00012_arlequin_frente_clear.avif` | **1000×1400** | 668×932 | **56%** |

Ambos archivos tienen el **mismo contenido visible** (668×932 px) pero
**contenedores distintos**. El canvas de las cartas dibuja con
`ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT)` — la imagen entera
(contenedor completo) se escala para llenar el canvas. Resultado:

- Frame 00000 en canvas 550×680: visible ocupa ~97% del canvas
- Frame 00012 en canvas 550×680: visible ocupa solo ~67% del canvas

Esto produce el **salto de tamaño visible** al pasar del dorso al frente
durante la animación de apertura, y entre la carta animada y la carta en
grid al cerrar.

**Recomendación (Cambio 3):** Opción A — compensar vía CSS/canvas clip.
El contenido visible es idéntico en dimensiones; solo hay que alinear los
contenedores. Recortar los 00001-00023 a un canvas unificado de 668×932
(eliminando padding) sería más limpio pero requiere re-exportar los frames.

---

### Grupo: Botones de contacto
| Archivo | Contenedor | Visible | Pad% | Simétrico |
|---------|-----------|---------|------|-----------|
| `arlequin_contacto_clear_boton.avif` | 1000×1400 | 668×932 | 55.5% | ✓ |
| `arlequin_contacto_dark_boton.avif` | 1000×1400 | 668×932 | 55.5% | ✓ |

**Nota:** Mismo contenedor 1000×1400 que los frames de animación. Comportamiento
en canvas idéntico al frame 12. Consistente. ✓

---

### Grupo: Máscara
| Archivo | Contenedor | Visible | L | R | T | B | Pad% |
|---------|-----------|---------|---|---|---|---|------|
| `arlequin_mask_1_transition_clear.avif` | 250×594 | 237×564 | 13 | 0 | 15 | 15 | 10% |
| `arlequin_mask_1_transition_dark.avif` | 250×594 | 237×564 | 13 | 0 | 15 | 15 | 10% |
| `arlequin_mask_2_transition_clear.avif` | 257×594 | 244×564 | 0 | 13 | 15 | 15 | 10% |
| `arlequin_mask_2_transition_dark.avif` | 257×594 | 244×564 | 0 | 13 | 15 | 15 | 10% |

**Nota crítica para `--mask-open-distance`:** La máscara-1 tiene padding L=13,
lo que significa que la decoración interior (rombo rojo) comienza a ~13px del
borde izquierdo del archivo. Con la apertura anterior de 230px, la decoración
interna de la máscara solapaba con la cards-grid. Ver cálculo en `breakpoints.css`.

**Recomendación:** OK tal como están. El ajuste de `--mask-open-distance` (280px
desktop → 140px mobile según viewport) corrige la colisión. No recortar.

---

### Grupo: Escudo, flechas, botón X, banner
| Archivo | Contenedor | Visible | Pad% | Nota |
|---------|-----------|---------|------|------|
| `arlequin_escudo_clear.avif` | 1531×2247 | 1531×2246 | 0% | sin padding |
| `arlequin_escudo_dark.avif` | 1531×2247 | 1531×2246 | 0% | sin padding |
| `arlequin_baraja_A_pieza_avanzar_web.avif` | 410×597 | 410×597 | 0% | sin padding |
| `arlequin_baraja_A_pieza_retroceder_web.avif` | 410×597 | 410×597 | 0% | sin padding |
| `arlequin_elemento_web_X_clare.avif` | 217×319 | 217×319 | 0% | sin padding |
| `arlequin_elemento_web_X_dark.avif` | 217×319 | 217×319 | 0% | sin padding |
| `arlequin_banner_zocalo_clear.avif` | 16076×552 | 15659×541 | 4.5% | trailing pad R=417 |
| `arlequin_banner_zocalo_dark.avif` | 16076×552 | 15659×541 | 4.5% | trailing pad R=417 |
| `arlequin_pieza_fondo-boton-enviar.avif` | 826×691 | 826×691 | 0% | sin padding |

**Banner zócalo:** padding derecho de 417px. El scroll infinito en `FooterBanner`
usa `width: 200%` con dos copias. El trailing padding es cosmético — no interfiere
con el scroll infinito. No recortar.

---

## /public/estrellas/

191 frames (clear) × 1 (solo clear en este directorio). Contenedor fijo 650×650.
Padding variable del 35% al 91% — **ESPERADO** (estrella que gira en 3D).
Clear y dark son pixel-identical frame a frame (verificado en muestra de 20 frames). ✓

| Estadístico | Valor |
|-------------|-------|
| Contenedor | 650×650 (todos) |
| Padding mín | 35.3% (frames expandidos) |
| Padding máx | 90.7% (frames de perfil) |
| Variación clear↔dark | ≤ 2px en cualquier lado |

**Recomendación:** OK. No recortar. El padding variable es la naturaleza de la animación.

---

## /public/isologo/

192 frames (96 clear + 96 dark, algunos con sufijo `_loop`). Contenedor fijo 650×650.

| Estadístico | Valor |
|-------------|-------|
| Contenedor | 650×650 (todos) |
| Visible | ~437×595 (±1–2px variación entre frames) |
| Padding | L≈106, R≈107, T≈27, B≈28 (muy estable) |
| Pad% | ~38.3–38.5% |
| Variación entre frames | ≤ 2px |
| Clear vs dark | Idénticos ✓ |

**Padding asimétrico horizontalmente** (L=106, R=107): diferencia de 1px — compensada
por los números impares del contenedor. El contenido está efectivamente centrado.

**Recomendación:** OK. Padding muy consistente en toda la secuencia. No recortar.

---

## Resumen de acciones requeridas

| Prioridad | Archivo/Grupo | Acción | Cambio |
|-----------|--------------|--------|--------|
| 🔴 CRÍTICO | Frames 00001–00023 vs grid dorso | Compensar size mismatch en canvas draw | Cambio 3 |
| 🟡 MEDIO | Mask open distance | Ya corregido via `--mask-open-distance` en breakpoints.css | Cambio 1 ✅ |
| 🟢 OK | Isologo frames | Sin acción | — |
| 🟢 OK | Estrellas frames | Sin acción | — |
| 🟢 OK | Escudo, flechas, botón X | Sin acción | — |
| 🟢 OK | Banner zócalo | Sin acción | — |
| 🟢 OK | Frame _fija vs frame 00012 | Diferencia sub-pixel (≤2px), ignorar | — |
