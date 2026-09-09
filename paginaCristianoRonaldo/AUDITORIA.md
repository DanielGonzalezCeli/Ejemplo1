# Auditoría de Accesibilidad — Página Cristiano Ronaldo

**Alcance:** `index.html`, `styles.css`, `script.js`
**Estándar:** WCAG 2.2 AA + UX + Diseño Responsive
**Fecha:** 2026-09-07
**Método:** Revisión estática del código fuente (no destructiva)

---

## 1. Resumen ejecutivo

La página demuestra un nivel de accesibilidad **por encima del promedio** para un proyecto académico. Estructura semántica sólida, alternativas de texto bien redactadas, botones correctamente utilizados, y estados de foco visibles. Se identificaron **8 hallazgos** (0 críticos, 2 altos, 4 medios, 2 bajos), siendo el más significativo la ausencia de trampa de foco en el lightbox y objetivos táctiles insuficientes en la navegación de escritorio.

| Severidad | Cantidad |
|-----------|----------|
| Crítico   | 0        |
| Alto      | 2        |
| Medio     | 4        |
| Bajo      | 2        |

---

## 2. Hallazgos

### H1 — ALTO: Lightbox sin trampa de foco (foco modal)

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 2.4.3 Orden del foco / PRG 1.3 |
| **Archivo** | `script.js:142-190` |
| **Elemento** | `#lightbox` (`role="dialog"`, `aria-modal="true"`) |

**Problema:** Cuando el lightbox se abre, el atributo `aria-modal="true"` anuncia al lector de pantalla que el diálogo es modal, pero JavaScript **no implementa la trampa de foco**. Un usuario que navega con Tab puede mover el foco hacia los elementos de la página que están detrás del modal.

**Evidencia:**
```js
// script.js:161-163 — Solo mueve foco al botón, pero no lo atrapa
lightbox.hidden = false;
elementoConFocoPrevio = boton;
lightboxCerrar.focus();
```

**Recomendación:** Implementar una función `tramparFoco()` que intercepte las teclas Tab y Shift+Tab, manteniendo el foco dentro de `#lightbox-contenido` mientras esté abierto. El foco solo debe poder salir con Escape.

---

### H2 — ALTO: Objetivos táctiles por debajo del mínimo (24 px WCAG 2.5.8)

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 2.5.8 Tamaño del objetivo (mínimo) |
| **Archivo** | `styles.css:188-193` |
| **Elemento** | `.nav-principal a` |

**Problema:** Los enlaces de navegación en escritorio tienen `padding: 0.35rem 0.1rem` (~5.6 px vertical, ~1.6 px horizontal). El área táctil resultante depende del tamaño de fuente (0.92rem ≈ 14.7px) y la línea, pero el padding vertical total es de apenas ~5.6 px, lo que da un objetivo táctil significativamente menor a los 24 px mínimos de WCAG 2.5.8.

**Evidencia:**
```css
/* styles.css:188-193 */
.nav-principal a {
  color: var(--color-texto);
  font-weight: 600;
  font-size: 0.92rem;
  padding: 0.35rem 0.1rem; /* <— área táctil insuficiente */
}
```

**Nota:** En móvil (≤640px), los enlaces pasan a `display: block` con `padding: 0.6rem 0.2rem` y ocupan el ancho completo, lo cual cumple el mínimo. El problema es **exclusivo de escritorio y tablet en modo escritorio**.

**Recomendación:** Aumentar el padding a al menos `padding: 0.5rem 0.4rem` o implementar un área pseudo-elemento (`::after`) más amplia para satisfacer 44×44 px recomendados.

---

### H3 — MEDIO: Sin respeto de `prefers-reduced-motion`

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 2.3.3 Animación a partir de interacciones |
| **Archivos** | `styles.css:28`, `styles.css:17`, `styles.css:405`, `styles.css:512`, `script.js:115-137` |
| **Elemento** | `html { scroll-behavior: smooth }`, transiciones, animación de contadores |

**Problema:** Múltiples animaciones y transiciones no verifican la preferencia de movimiento reducido del usuario:

1. `scroll-behavior: smooth` — puede causar molestias vestibulares.
2. `.timeline-item` — `transition: transform 200ms` con `translateY(-2px)` al hacer hover.
3. `.galeria-boton img` — `transition: transform 200ms` con `scale(1.04)` al hacer hover.
4. Contadores animados en estadísticas (`script.js:115-137`) — animación de 900ms sin consultar `matchMedia('(prefers-reduced-motion: reduce)')`.

**Evidencia:**
```js
// script.js:115-137 — animación incondicional
function animarContador(elemento) {
  var duracionMs = 900;
  // ...sin verificación de prefers-reduced-motion
}
```

**Recomendación:**
- CSS: Envolver `scroll-behavior: smooth` y transiciones en `@media (prefers-reduced-motion: no-preference)`.
- JS: Consultar `window.matchMedia('(prefers-reduced-motion: reduce)').matches` antes de animar; si es `true`, llamar directamente a `mostrarValorFinal()`.

---

### H4 — MEDIO: `aria-controls` ausente en botones de la línea de tiempo

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 4.1.2 Nombre, rol, valor (ARIA) |
| **Archivo** | `index.html:136-176` |
| **Elemento** | `<button class="timeline-item" data-target="t1">` |

**Problema:** Cada botón de la línea de tiempo tiene un atributo `data-target` que vincula JavaScript con el panel correspondiente, pero no existe un atributo `aria-controls` que establezca la relación semántica para tecnologías asistivas.

**Evidencia:**
```html
<!-- index.html:136 — falta aria-controls -->
<button type="button" class="timeline-item" data-target="t1" aria-expanded="false">
```

**Recomendación:** Agregar `aria-controls="t1"`, `aria-controls="t2"`, etc., a cada botón para que los lectores de pantalla comuniquen la relación botón → panel.

---

### H5 — MEDIO: Indicación visual de enlaces externos en sección de enlaces

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 3.2.5 Cambio a solicitud del usuario |
| **Archivo** | `index.html:309-332`, `styles.css:591-594` |
| **Elemento** | `<a href="..." target="_blank" rel="noopener noreferrer">` |

**Problema (parcialmente mitigado):** Los enlaces externos abren en nueva pestaña (`target="_blank"`). El CSS agrega un indicador visual `↗` mediante pseudo-elemento `.enlaces-lista a::after`, lo cual es positivo. Sin embargo, **este indicador no incluye texto alternativo** para usuarios de lector de pantalla — el contenido `content: "↗"` es un carácter Unicode que puede no ser announced de forma comprensible.

**Evidencia:**
```css
/* styles.css:591-594 */
.enlaces-lista a::after {
  content: "↗";
  font-size: 0.85em;
}
```

**Recomendación:** Agregar un `<span class="sr-only"> (abre en nueva ventana)</span>` dentro de cada enlace externo, o bien, agregar `aria-label` descriptivo que incluya la advertencia de nueva ventana. Ejemplo:
```html
<a href="..." target="_blank" rel="noopener noreferrer">
  Wikipedia — Cristiano Ronaldo <span class="sr-only">(abre en nueva ventana)</span>
</a>
```

---

### H6 — MEDIO: Hover en timeline sin equivalente táctil

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 1.4.13 Contenido al pasar el ratón / tocar |
| **Archivo** | `styles.css:408-411` |
| **Elemento** | `.timeline-item:hover` |

**Problema:** El efecto `transform: translateY(-2px)` al hacer hover sobre los items de la línea de tiempo no tiene un equivalente para usuarios táctiles ni se puede descartar fácilmente. Aunque es un efecto sutil, WCAG 1.4.13 requiere que el contenido mostrado por hover pueda ser descartado, persistente y dismissing.

**Evidencia:**
```css
/* styles.css:408-411 */
.timeline-item:hover {
  border-color: var(--color-primario);
  transform: translateY(-2px);
}
```

**Recomendación:** Aunque el efecto es sutil y probablemente no bloquee el contenido, considerar envolverlo en `@media (hover: hover)` para que solo se aplique en dispositivos con hover capability:
```css
@media (hover: hover) {
  .timeline-item:hover { ... }
}
```

---

### H7 — BAJO: `role="status"` semánticamente impreciso en timeline

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 1.3.1 Información y relaciones |
| **Archivo** | `index.html:179` |
| **Elemento** | `<div class="timeline-detalle" role="status" aria-live="polite">` |

**Problema:** `role="status"` está diseñado para mensajes de estado asesorios (ej: "Guardado automáticamente"). En este caso, el contenedor muestra contenido interactivo (paneles con encabezados y párrafos). Aunque funciona, semánticamente sería más preciso un `role="region"` con `aria-live="polite"`.

**Recomendación:** Cambiar a `role="region" aria-label="Detalle de la etapa seleccionada" aria-live="polite"` para mayor precisión semántica.

---

### H8 — BAJO: Enlace "Volver arriba" con área táctil reducida

| Campo | Valor |
|-------|-------|
| **Criterio WCAG** | 2.5.8 Tamaño del objetivo (mínimo) |
| **Archivo** | `styles.css:615-618` |
| **Elemento** | `.volver-arriba` |

**Problema:** El enlace "Volver arriba ↑" no tiene padding explícito. Su área táctil depende únicamente del tamaño de fuente y línea, resultando en un objetivo por debajo de los 44 px recomendados (aproximadamente 27-30 px de alto).

**Evidencia:**
```css
/* styles.css:615-618 */
.volver-arriba {
  margin-top: 0.75rem;
  font-weight: 600;
  /* Sin padding explícito */
}
```

**Recomendación:** Agregar `padding: 0.5rem 0` o más para alcanzar al menos 44 px de altura táctil.

---

## 3. Criterios que SÍ cumplen

Los siguientes aspectos fueron revisados y **no presentan problemas**:

| Criterio | Detalle |
|----------|---------|
| **`<html lang="es">`** | Idioma declarado correctamente en `index.html:2` |
| **Estructura semántica** | Uso correcto de `<header>`, `<main>`, `<nav>`, `<footer>`, `<section>`, `<article>`, `<aside>`, `<figure>`, `<figcaption>` |
| **Jerarquía de encabezados** | H1 único (`index.html:51`), H2 por sección (5 instancias), H3 para sub-secciones. Sin niveles omitidos |
| **Skip link** | Presente y funcional (`index.html:12`, `styles.css:94-108`). Se muestra con `:focus` en la posición correcta |
| **Foco visible** | Regla `:focus-visible` con `outline: 3px solid var(--color-foco)` y `outline-offset: 3px` (`styles.css:86-92`) |
| **Uso de `<button>` vs `<a>`** | Navegación usa `<a href>`, acciones interactivas (timeline, galería, menú) usan `<button type="button">` |
| **`aria-expanded`** | Implementado y toggleado correctamente en el menú hamburguesa (`script.js:28`) y timeline (`script.js:62,68`) |
| **`aria-labelledby`** | Cada `<section>` y el `<aside>` vinculan con su encabezado |
| **Textos alternativos** | Todas las imágenes tienen `alt` descriptivo y relevante |
| **`<figure>` + `<figcaption>`** | Imágenes en hero y galería envueltas correctamente |
| **`<dl>` para ficha técnica** | Uso semántico correcto de lista de definición con `<dt>` y `<dd>` |
| **Cierre de menú móvil** | Se cierra al hacer clic en cualquier enlace (`script.js:32-38`) |
| **Foco restaurado al cerrar lightbox** | `elementoConFocoPrevio.focus()` en `script.js:172` |
| **Cierre con Escape** | Lightbox se cierra con tecla Escape (`script.js:186`) |
| **`aria-modal="true"`** | Declarado en el lightbox (`index.html:295`) |
| **`aria-live="polite"`** | Declarado en el contenedor de timeline para anunciar cambios |
| **`<meta name="viewport">`** | Sin `maximum-scale` ni `user-scalable=no` — permite zoom |
| **Imágenes responsive** | `img { max-width: 100% }` en reset global |
| **`rel="noopener noreferrer"`** | Presente en todos los enlaces externos |
| **Fallback de IntersectionObserver** | `script.js:88-93` muestra valores finales si no hay soporte |
| **Null checks** | Verificaciones de elementos DOM antes de operar (`script.js:22,48,84,150,197`) |
| **Scroll suave en anclaje** | `scroll-behavior: smooth` en `html` facilita navegación entre secciones |
| **Contraste de color** | `#1b1c22` / `#f7f7f9` (~16:1), `#c8102e` / `#fff` (~5.6:1), `#d4af37` / `#14151b` (~7:1) — todos superan 4.5:1 |
| **Responsive** | Breakpoints en 800px (grid) y 640px (menú móvil); `clamp()` para tipografía fluida; `auto-fit` + `minmax()` para grid |
| **Sin overflow horizontal** | Contenedor con `max-width: 1100px` y `padding-inline: 1.25rem`; imágenes con `max-width: 100%` |
| **Comportamiento en 320px** | Grids colapsan a una columna; timeline items se apilan; ficha técnica se apila verticalmente |
| **Comportamiento en 390px** | Similar a 320px con más espacio; todo cabe sin overflow |
| **Comportamiento en 768px** | Biografía y hero en una columna (breakpoint 800px); navegación aún horizontal |
| **Comportamiento en escritorio** | Layout de dos columnas activo; navegación horizontal; todo dentro del ancho máximo |
| **Año dinámico en footer** | `new Date().getFullYear()` en `script.js:198` |
| **Errores JavaScript** | Sin errores sintácticos ni lógicos detectados; `parseInt` con radix 10 |

---

## 4. Pruebas a repetir después de corregir

### Accesibilidad
| # | Prueba | Herramienta sugerida |
|---|--------|----------------------|
| 1 | Navegar con Tab completo del lightbox — verificar que el foco no sale del diálogo | Lector de pantalla (NVDA/VoiceOver) + navegación manual |
| 2 | Medir área táctil de los enlaces de nav en escritorio — objetivo ≥ 24×24 px | Inspect del navegador + herramienta de medición |
| 3 | Activar "Reducir movimiento" en SO y verificar que las animaciones se deshabilitan | Configuración del SO + revisión visual |
| 4 | Navegar con Tab en la línea de tiempo — verificar que `aria-controls` anuncia la relación | NVDA/VoiceOver |
| 5 | Activar lector de pantalla y escuchar la sección de enlaces — verificar indicación de nueva ventana | NVDA/VoiceOver |
| 6 | Verificar contraste de colores con herramienta de auditoría | axe DevTools / Lighthouse |
| 7 | Probar en dispositivos reales a 320px, 390px, 768px y escritorio | Navegador responsive + dispositivo físico |

### Responsive
| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 8 | Abrir menú hamburguesa en 320px — verificar que se despliega y cada enlace tiene área táctil suficiente | Menú desplegable con enlaces < 44px de alto |
| 9 | Hacer clic en cada botón de timeline en 320px — verificar que el panel aparece sin overflow horizontal | Sin scroll horizontal |
| 10 | Abrir lightbox en 390px — verificar que la imagen cabe y el foco queda en el botón de cerrar | Imagen visible, foco correcto |
| 11 | Navegar con teclado en 768px — verificar que el skip link funciona y el menú es operable | Skip link visible, menú navegable |

---

## 5. Priorización de corrección

| Prioridad | Hallazgo | Esfuerzo estimado |
|-----------|----------|-------------------|
| 1 (urgent) | H1 — Trampa de foco en lightbox | Bajo (~30 líneas JS) |
| 2 | H2 — Objetivos táctiles en nav | Bajo (cambio de padding en CSS) |
| 3 | H3 — prefers-reduced-motion | Medio (CSS + JS) |
| 4 | H4 — aria-controls en timeline | Bajo (atributos HTML) |
| 5 | H5 — Indicación de enlaces externos | Bajo (spans sr-only) |
| 6 | H6 — Hover sin equivalente táctil | Bajo (media query) |
| 7 | H7 — role="status" impreciso | Bajo (cambio de atributo) |
| 8 | H8 — Área táctil "Volver arriba" | Bajo (padding en CSS) |
