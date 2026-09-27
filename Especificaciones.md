# Especificaciones del Sistema — MIKIT v1.0

## Visión General

MIKIT es una aplicación de productividad personal para grabación de audio y transcripción, con procesamiento de texto vía IA. Es un **monolito**: un backend FastAPI (Python) sirve el build de React (Vite) y expone las APIs de transcripción, IA, y exportación a Escritorio. La interfaz sigue principios de UX/UI: jerarquía visual clara, feedback inmediato mediante *Toasts*, navegación predecible y accesibilidad (WCAG 2.1 AA).

---

## Principios de Diseño

- **Consistencia**: Misma tipografía, paleta y patrones de componentes en toda la app.
- **Feedback inmediato**: Toda acción del usuario genera una respuesta visual mediante un sistema de *Toasts* flotantes (3s, éxito/error).
- **Confirmaciones Seguras**: Las acciones destructivas utilizan ventanas modales de la propia interfaz gráfica (nunca pop-ups nativos del navegador).
- **Jerarquía clara**: El elemento más importante en cada pantalla domina visualmente.
- **Accesibilidad**: Contraste mínimo 4.5:1, navegación por teclado, respeto de `prefers-reduced-motion`.
- **Persistencia de estado**: Historial y configuraciones se guardan en `localStorage` o IndexedDB.

---

## Navegación Global

- Sidebar persistente y colapsable (280px ↔ 80px) con animación, visible en todas las páginas (logo en `/LOGO.png`).
- Indicador de estado del backend en el menú (polling cada 5s): "Server: Online/Offline".
- Rutas e ítems del menú (en orden):

| Etiqueta | Path | Ícono |
|---|---|---|
| Inicio | `/` | Home |
| Grabadora | `/grabadora` | Mic |
| Transcriptor | `/transcriptor` | FileText |
| Historial | `/historial` | History |
| Procesar con IA | `/procesar-ia` | Sparkles |
| Configuración | `/configuracion` | Settings |

---

## Página: Home (`/`)

- Título y descripción breve del sistema.
- Tarjetas de acceso rápido a: Grabadora y Transcriptor (ícono, nombre, descripción de una línea).
- Indicadores de estado opcionales: "X grabaciones guardadas", "X transcripciones en historial".

---

## Módulo: Grabadora (`/grabadora`)

### 1. Panel de Control de Grabación

**Estados posibles:** `inactivo` → `grabando` → `pausado` → `detenido`

| Acción | Condición | Resultado |
|---|---|---|
| Iniciar | Estado: inactivo | Comienza grabación, activa micrófono |
| Pausar | Estado: grabando | Congela el audio, mantiene el tiempo |
| Reanudar | Estado: pausado | Continúa desde donde pausó |
| Detener | Estado: grabando o pausado | Termina grabación, abre modal de guardado |
| Descartar | Estado: grabando o pausado | Cancela y reinicia (ícono reiniciar, junto al botón principal) |

**Visuales requeridos:**
- Temporizador en formato `H:MM:SS` actualizado en tiempo real.
- Visualizador animado de 40 barras durante la grabación.
- Indicador de estado actual diferenciado por color/ícono.

**Captura de audio:** `MediaRecorder` con `audio/webm;codecs=opus` a 256 kbps (fallback si el browser no lo soporta). Constraints de fidelidad: `echoCancellation/noiseSuppression/autoGainControl` desactivados, `channelCount: 2`, `sampleRate: 48000`, `sampleSize: 16`. El blob se guarda como **WebM/Opus** en IndexedDB.

### 2. Configuración adicional (modal)

- **No es un panel inline**: se abre como ventana emergente (`AnimatePresence` + `motion.div`) desde un botón **tuerca (`Wrench`) en la esquina superior derecha de la consola de grabación**. Es una tarea puntual (calibrar una vez) y así la consola queda limpia.
- La tuerca va **dentro** del `glass-card` de la consola, no al lado: el card es `overflow-hidden`, así que un botón posicionado fuera de sus límites quedaría recortado. Como es `absolute` + `z-10`, no participa del flex layout, no corre el contenido, y queda por encima del glow desenfocado.
- La tuerca muestra un **punto ámbar** mientras la configuración esté incompleta, y queda `disabled` si `status !== 'inactivo'`.
- **Cierre por `Escape`** (listener en `window` agregado/retirado según el estado del modal) y por click en el overlay (`e.target === e.currentTarget`, para no cerrar al clickear dentro). Un modal de calibración sin salida por teclado deja al usuario atrapado.
- Role `dialog` + `aria-modal` + `aria-label`; botón de cierre con `aria-label`.
- `max-w-2xl` (el layout es de dos columnas, `max-w-md` no alcanza) y `max-h-[90vh] overflow-y-auto` para que no se corte en pantallas bajas.
- Contenido: dos columnas con `grid md:grid-cols-2` dentro de un panel de vidrio. **Micrófono** a la izquierda, **puerta de ruido** a la derecha. Ambas columnas con `min-w-0` porque el `select` tiene ancho intrínseco y hace blowout del grid.
- El panel interno y la caja del modal usan `.glass` y **no** `.glass-card`: esa tiene `-translate-y-1` en `:hover` y el contenedor se levantaría al arrastrar el umbral, sacando el slider de debajo del cursor. Un contenedor con controles de formulario no puede animarse al hover. (El modal de guardado sí usa `glass-card`: no tiene drag, ahí no molesta.)
- Sin `backdrop-blur` en el panel: el fondo de la app es un gradiente suave sin detalle, así que el desenfoque no aportaría nada visible. La separación la dan contraste, borde y sombra. (En el overlay del modal sí, porque ahí sí hay contenido detrás.)
- El aviso de bloqueo bajo el botón de grabar es **un botón** que abre el modal: el mensaje que falta está en la tuerca, así que abrirla es la acción obvia.
- Reusa el patrón de modal que ya usa la app (`fixed inset-0 z-[100] ... bg-black/60 backdrop-blur-sm`).
- Enumera dispositivos `audioinput` con `enumerateDevices()` (pide permiso con un `getUserMedia` mudo para obtener labels reales).
- Detecta conexión/desconexión de dispositivos en caliente (evento `devicechange` — utilidad para el mic Bluetooth de solapa).
- Al grabar aplica `deviceId: { exact: selectedDeviceId }`.
- Estado solo en memoria (no persiste entre sesiones).

#### 2.1 Puerta de ruido — monitor de nivel + umbral

Control en dos partes, dentro del mismo desplegable.

**Monitor de nivel** — `src/hooks/useLevelMonitor.js`
- `getUserMedia` propio + `AudioContext` + `AnalyserNode` (`fftSize` 2048, `smoothingTimeConstant` 0.6).
- El `AnalyserNode` **no** se conecta al `destination`: el monitor es exclusivamente visual, nunca reproduce audio (requisito explícito del usuario).
- Con `echoCancellation`, `noiseSuppression` y `autoGainControl` en `false`. Si el navegador normaliza o cancela ruido, la lectura del nivel miente y la calibración no sirve.
- RMS sobre time-domain data → `20*log10(rms)`, acotado a −60…0 dBFS. El piso de −60 dB representa "silencio" y evita que el ruido de fondo empuje la barra contra el extremo izquierdo.
- Emisión a ~20 Hz con histéresis de 0.5 dB. A 60 Hz el `setState` re-renderiza el `Recorder` entero, que además tiene `MediaRecorder` y timer corriendo.
- Se monta solo con `status === 'inactivo'`: grabar ya abre su propio stream, y mantener dos capturas vivas del mismo micrófono enciende el indicador del sistema sin necesidad.
- Compara contra un ref del último valor emitido, no contra el `state`: dentro del rAF el `state` es un closure viejo y daría una diferencia siempre grande (re-render loop).

**Umbral** — `src/components/NoiseGateControl.jsx`
- Escala −60…0 dBFS; `dbToPct` / `pctToDb` sobre el span completo, con snapping a 1 dB.
- Click en la pista = salto directo; drag desde el mango = ajuste fino. El puntero se captura en `pointerdown` para que el drag no se pierda al salirse del elemento.
- Accesible como `role="slider"` con teclado: flechas 1 dB, `Shift`+flechas 6 dB, `Home`/`End` a los extremos.
- La señal **por debajo** del umbral se dibuja atenuada y la de **arriba** iluminada: la barra muestra qué se está descartando, no solo dónde está el corte.

**Persistencia** — `src/utils/preferences.js`
- Clave `noise_gate_settings`, con `thresholdDb` y `enabled`.
- El umbral arranca en `null` = **sin calibrar**. Ese `null` es lo que mantiene bloqueada la grabación: no tiene sentido dar por buena una puerta que el usuario nunca fijó.
- Un umbral de `0` dB es un valor legítimo y distinguible de `null` (JSON los separa).

**Regla de bloqueo** — `src/pages/Recorder.jsx`
- `canRecord = micSeleccionado && umbralConfigurado`.
- El botón queda `disabled` y debajo se listan los pendientes concretos ("seleccioná un micrófono y calibrá la puerta de ruido"), para que el bloqueo se lea como una regla y no como un bug.

**Pendiente — el umbral no filtra el audio grabado.** Hoy la puerta define el corte y muestra en vivo qué señal pasaría, pero el `MediaRecorder` sigue capturando todo. Filtrar en vivo requiere un `AudioWorklet` entre el `MediaStream` y el `MediaRecorder`, con ataque/release para no cortar sílabas. La alternativa barata es el filtro `agate` de ffmpeg al exportar, pero entonces el nivel en vivo de la barra miente respecto de lo que finalmente se escucha. La arquitectura actual deja el umbral listo para ser leído por el processor.

### 3. Guardado de Grabación

Al detener, se presenta un **modal de guardado** con:

- **Selector de plantilla de nombre**: lista desplegable (opcional).
- **Campo de nombre específico**: texto libre (placeholder "Ej. Notas de la reunión", autofocus).
- **Vista previa**: `[Fecha DD-MM-YYYY] [Plantilla] [Nombre]` construida en tiempo real. Ejemplo: `26-09-2026 Ingeniería de Software Notas finales`.
- Botones: `Guardar` / `Descartar`.
- Al guardar: blob WebM/Opus + metadatos `{ name, duration }` a IndexedDB; toast de confirmación; botón "Transcribir" navega al Transcriptor con el audio en `location.state`.

### 4. Reproductor Rápido (Post-grabación)

- Banner "Grabación Guardada" con acciones `Reproducir` / `Transcribir`.
- Reproductor activo: Play/Pausa, skip ±10s, barra de progreso con scrubbing, velocidad cíclica (1x → 1.5x → 2x → 0.5x), tiempo transcurrido / duración total.

### 5. Secciones plegables

`src/components/CollapsibleSection.jsx` — encabezado clickeable con `aria-expanded`, animación de altura con framer-motion y soporte para título, descripción, ícono y `defaultOpen`.

- **Consumidor único hoy: `src/pages/Settings.jsx`.** Nació para compartirlo con la Grabadora, pero esa pantalla terminó usando un modal en vez de un panel inline, así que el componente ya no se comparte. Sigue siendo un acierto: la definición estaba *dentro* de `Settings.jsx`, sin exportar, y ahora es un módulo reutilizable por cualquier pantalla que necesite un plegable.

---

## Módulo: Transcriptor (`/transcriptor`)

### 1. Carga de Archivo

- Zona de carga con **drag & drop** + botón de selección.
- Formatos aceptados: `.mp3`, `.mp4`, `.wav`, `.webm`, `.m4a`, `.ogg`.
- El backend divide el audio en fragmentos de hasta 10 minutos para Groq.
- Al seleccionar archivo: mostrar nombre, tamaño y tipo.

### 2. Panel de Transcripción Activa

**Estados del proceso:** `idle` (sin archivo → dropzone; con archivo → tarjeta "Listo para transcribir"; con error → pantalla de error con "Reintentar") → `transcribiendo` → `listo`.

**Progreso por tareas** (3 fases expandibles con subtareas dinámicas):
1. *Fraccionando audio*
2. *Transcribiendo fragmentos* → subtareas `2.N` (una por chunk, con alias de clave en uso; escucha eventos `rotating_key`, `waiting_limit`, `retrying`)
3. *Ensamblando resultado* → subtareas "Leyendo memoria temporal", "Normalizando texto", "Preparando respuesta final"

**Resultado visible:**
- Área de texto con la transcripción completa, formateada en **párrafos basados en silencios fonéticos** (>1.5s entre segmentos).
- Botones de acción: `Ver texto / Ver karaoke` (si hay fragmentos sincronizados), `Copiar`, `Guardar en Escritorio`, `Guardar`.

### 3. Modal de Guardado de Transcripción

- Misma lógica que la grabadora: Plantilla de Nombre + Nombre Específico (default = nombre del archivo) + Vista Previa.
- Si el audio tiene segmentos sincronizados: botones **"Guardar transcripción"** (historial de texto) y **"Guardar como Karaoke (N fragmentos)"** (store de karaokes con `{blob, text, segments, duration}`).

### 4. Modo Karaoke

- Si hay segmentos, la vista por defecto es modo karaoke: fragmento actual N/M con marca de tiempo `[start–end]`, navegación prev/next, play/pause con audio sincronizado (avanza de fragmento en `onTimeUpdate`), skip ±10s, velocidad cíclica.
- Acciones: `Copiar frag.`, `Copiar todo`, `Exportar MD`.
- **Export MD karaoke**: header `# nombre`, `**Fecha:**`, lista `- Fragmento i de N — t1 – t2`, `## Texto completo` con líneas `[t1 – t2] texto`.

### 5. Descarga como `.md` (Escritorio)

- El botón **"Guardar en Escritorio"** exporta el texto tal cual (crudo) vía el backend.
- La exportación masiva desde Historial sí genera el header `# Transcripción: [nombre]` + `**Fecha:**`.

---

## Módulo: Historial (`/historial`)

- Lista única (ordenada por fecha, más reciente primero) que unifica tres tipos de ítems: `audio` (grabaciones), `text` (transcripciones y resultados IA), `karaoke` (karaokes).
- Cada ítem expone según su tipo: player inline, renombrado inline, copiar, guardar en Escritorio, exportar MD (texto y karaokes), borrar (con modal de confirmación), y "Transcribir" para audios.
- **Exportación masiva de audios**: carpeta `MIKIT_Grabaciones_AAAAMMDD_HHMM` en el Escritorio; cada grabación convertida a MP3 (22050 Hz, 16 bits, 96 kbps). Alertas de progreso secuenciales; ante error, detiene e informa hasta dónde avanzó.
- **Exportación masiva de textos**: carpeta `MIKIT_Transcripciones_AAAAMMDD_HHMM`; cada ítem como `.md` con header. Colisiones de nombre → sufijos `(1)`, `(2)`.
- **Estado vacío**: mensaje amigable + CTA.

---

## Módulo: Procesar con IA (`/procesar-ia`)

Wizard de **3 pasos** con indicador superior (los pasos ya completados son navegables hacia atrás).

### Paso 1 — Fuentes

- **Límite: máximo 2 fuentes combinadas.**
- **Dropzone de archivos `.md`** (arriba): drag & drop o click, múltiple. Cada uno pasa por parseo de Markdown: quita extensión y frontmatter (`---...---`). Chips con preview de 60 chars y X para quitar.
- **Fuentes internas** (abajo, lista scrolleable): transcripciones del historial + karaokes guardados, ordenados por fecha. Los karaokes se muestran con badge "Karaoke". Selección por checkbox.

### Paso 2 — Prompt y Clave

- Resumen de fuentes seleccionadas (chips).
- **Plantilla de prompt**: selector de plantillas guardadas + preview del texto (4 líneas clamp) + botón **"Nuevo prompt"** (modal con Nombre + Textarea; al guardar, se persiste y queda seleccionado).
- **Clave API (OpenRouter)**: selector del pool de claves de texto mostrando `alias · Activa/Inactiva · key enmascarada`. Preselecciona la activa.
- Validaciones con toast: al menos 1 fuente, prompt y clave.

### Paso 3 — Resultado

- Nombre editable del resultado (default `Procesado IA - fecha`).
- Al presionar `Procesar` (paso 2) se avanza al paso 3 y comienza el **streaming en vivo** vía SSE; spinner "Procesando con OpenRouter…" hasta el primer chunk.
- Área de resultado Markdown (scroll, `.whitespace-pre-wrap`).
- Botones: `Ajustar` (volver al paso 2), `Copiar`, `Guardar en Historial`, `Descargar .md`.

### Comportamiento del backend (`POST /process_text`)

- `MD_OUTPUT_RULES` (responder SOLO Markdown; sin JSON/XML/HTML, sin saludos ni bloques de código) va **siempre como primer system message**; el prompt del usuario como segundo; las fuentes como user message `### Fuente N: nombre` separadas por `---`.
- Llama a `https://openrouter.ai/api/v1/chat/completions` con modelo **`openrouter/auto`** y `stream: true` (timeout 120s). Errores 401/429 → evento de error; chunks → `{status:'chunk', text}`; cierre `{status:'done'}`.
- Se usa el pool de claves de **texto** (OpenRouter), separado del pool de audio Groq.

---

## Módulo: Configuración (`/configuracion`)

Cuatro secciones colapsables (acordeón animado, la primera abierta por defecto):

### 1. Claves API de Groq para audio

- **Pool de claves**: múltiples claves Groq para transcripción. Rotación automática ante Rate Limit (429).
- Cada clave: alias, key enmascarada, indicador Activa/Inactiva.
- Acciones: **Activar**, **Eliminar** (modal de confirmación), **Agregar** (alias + input password).
- La primera clave agregada queda activa; al eliminar la activa, se activa la primera restante.
- Se almacenan en localStorage; no se transmiten a servidores propios. Advertencia visible: "Tus claves se guardan localmente".

### 2. Claves API para procesado de texto (OpenRouter)

- Ídem sección 1 pero con el pool `groq_text_api_keys` (usado por Procesar con IA).
- La confirmación de borrado distingue "clave de texto".

### 3. Plantillas de Nombre (Grabadora y Transcriptor)

- Lista de plantillas con **Editar** (modal de 1 campo, Enter guarda) y **Eliminar** (modal de confirmación).
- Campo para agregar (Enter también).
- Defaults: `Ingeniería de Software`, `Redes 2`, `Entrevista`, `Notas Personales`.
- Se reflejan en los selectores de los modales de guardado.

### 4. Plantillas de Prompts (Procesar con IA)

- Lista (nombre + texto clamp de 3 líneas) con **Ver** (modal de texto completo + botón Editar), **Editar**, **Eliminar** (modal de confirmación).
- Botón **"Nueva Plantilla de Prompt"** (modal nombre + textarea).
- Se reflejan en el selector del paso 2 de Procesar con IA.

---

## Almacenamiento Local

### IndexedDB — base `mikit-db` (v2, librería `idb`)

| Object Store | Ítem | Funciones |
|---|---|---|
| `recordings` | `{ id, blob (WebM/Opus), name, duration "MM:SS", createdAt }` | save/getAll/delete/updateRecording |
| `karaokes` | `{ id, blob, name, text, segments [{start, end, text}], duration (seg), createdAt }` | save/getAll/delete/updateKaraoke |

### localStorage

| Key | Propósito |
|---|---|
| `groq_api_keys` | Pool de claves Groq audio `[{ id, alias, key, active }]` |
| `groq_text_api_keys` | Pool de claves OpenRouter texto `[{ id, alias, key, active }]` |
| `name_templates` | Plantillas de nombre `[string, ...]` |
| `prompt_templates` | Plantillas de prompts `[{ id, name, text }]` |
| `transcriptions_history` | Historial de transcripciones y resultados IA `[{ id, createdAt, name, text, folder? }]` |

---

## Backend (FastAPI — monolito)

- Sirve el build de React (`dist/index.html`) en `/` con SPA fallback (excluye `transcribe*`, `save_*`, `assets`).
- Cache: assets `immutable` (1 año), resto `no-cache`; GZip solo en `/assets` (para no bufferear el SSE).
- Escucha en loopback `127.0.0.1:8000`. CORS abierto. Soporta empaquetado PyInstaller (`sys.frozen` → `sys._MEIPASS`).

| Método | Ruta | Parámetros | Descripción |
|---|---|---|---|
| GET | `/` | — | Sirve `index.html` |
| POST | `/transcribe` | `file`, `api_key` (opcional), `api_keys` (JSON pool) | Transcripción Groq con pool/rate-limit, streaming SSE, párrafos y segmentos |
| POST | `/process_text` | JSON `{api_key, prompt_text, texts}` | IA vía OpenRouter, streaming SSE |
| POST | `/save_md` | JSON `{title, content, folder?}` | Guarda `.md` en el Escritorio (UTF-8 BOM, colisión → `(N)`) |
| POST | `/save_audio` | `file`, `title`, `folder?` | Convierte a MP3 22050Hz/16bit/96kbps (pydub) y guarda en el Escritorio |

### Chunking y transcripción

- `process_and_split()` (pydub/ffmpeg): normaliza a **mono 16 kHz** → fragmentos de **máx. 10 min**; en la ventana de los últimos 60s busca silencios (`min_silence_len=500ms`, `silence_thresh=-40 dBFS`) y corta en la **mitad del último silencio** (no corta palabras); exporta cada chunk como MP3 64 kbps. Sin silencio → corte exacto en el límite.
- Ensamblado: `paragraph_threshold` de 1.5s de silencio → separación en párrafos; acumula segmentos globales con timestamps (offset por chunk) para karaoke.

### Pool de claves y rate limit

- `KeyPool`: `keys`, `current_index`, `cooldowns {alias: timestamp}`. Métodos: `get_current_key`, `rotate()` (round-robin), `mark_cooldown(alias, seconds)`, `get_wait_time()`, `get_next_available_key()`.
- Ante 429: extrae `retry-after` (default 10s) → cooldown → si hay >1 clave: evento `rotating_key` + rota; si hay 1: evento `retrying` + espera; si todas en cooldown: evento `waiting_limit` con `wait`.
- Errores no-429 rompen el chunk y devuelven **transcripción parcial** con nota `*(Transcripción parcial. Error: ...)*`.

### Escritorio

- `get_desktop_path()` usa `SHGetFolderPathW` (`CSIDL_DESKTOPDIRECTORY`) y **resuelve la redirección de OneDrive**; fallback `~/Desktop`. No está hardcodeado.
- Colisiones de archivos → `nombre (1).(ext)`. Los `.md` se escriben con `utf-8-sig`.

---

## Manejo de Errores

- **Sin micrófono disponible**: mensaje claro + instrucciones para habilitar permisos.
- **Error de API (Groq)**: si falla un fragmento, se preserva el texto transcrito hasta ese punto y se muestra nota de transcripción parcial con el fragmento y error. Reintenta con otras claves del pool automáticamente.
- **Error en Procesar con IA**: el streaming SSE reporta `{status:'error'}` con detalle; el frontend lo muestra en el paso de resultado.
- **Robustez de datos**: el ensamblado de fragmentos maneja dinámicamente las respuestas de la API (objetos o dicts en los segmentos).

---

## Restricciones Técnicas

- **Monolito**: frontend React + Vite servido por backend FastAPI (Python) en el mismo repo; pydub/ffmpeg para audio.
- `ffmpeg`/`ffprobe` se inyectan al PATH desde la carpeta `ffmpeg/` en la **raíz del proyecto** si existe (`main.py` la resuelve como `os.path.join(BASE_DIR, "ffmpeg")`; esa carpeta está en `.gitignore` porque es un drop-in local).
- Compatibilidad: últimas 2 versiones de Chrome, Firefox, Safari y Edge.
- APIs de audio: `MediaRecorder API` + `enumerateDevices`.
- Transcripción: Groq (`whisper-large-v3`, `verbose_json` con timestamps).
- Procesado de texto IA: OpenRouter (`openrouter/auto`, streaming SSE).
- Framework sugerido: React + Vite, framer-motion, Tailwind CSS; `idb` para IndexedDB.