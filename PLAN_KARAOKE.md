# Plan: MIKIT Karaoke (transcripción sincronizada + panel de fragmentos)

> Estado: **implementado completo (2026-09-24)** — build OK, sintaxis backend OK. Falta solo la verificación E2E en vivo con API key real + audio.
> Fecha: 2026-09-24

## 1. Objetivo

Agregar a MIKIT el modo **Karaoke**: al transcribir un audio, separar el texto en **fragmentos lógicos con timestamps** (cortes por silencio que representan fin de oración / cambio de tema) y poder reproducir el audio con el **texto del fragmento actual sincronizado**, dentro de una tarjeta expandible en la sección **Historial**.

Al finalizar una transcripción, el usuario elige **cómo guardar**:
- **Solo transcripción** (comportamiento actual, texto en localStorage).
- **Karaoke** (audio + transcripción + fragmentos sincronizados).

Quedan fuera de alcance en esta versión:
- Editar/corregir el texto de un fragmento puntual.
- Tope de duración (se aceptan audios largos, con resguardo de performance, ver §3.5).

---

## 2. Estado actual (verificado en el repo)

| Componente                          | Comportamiento hoy                                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/main.py` → `run_groq_transcription` | **Ya pide `response_format="verbose_json"`** a Whisper (modelo `whisper-large-v3`) → la API devuelve `segments[]` con `start`, `end` y `text`. |
| `backend/main.py` → loop de chunks  | Ya itera `transcription.segments`, calcula `start_global`/`end_global` (offset por chunk con `accumulated_time`) y arma párrafos en `transcription_buffer.txt` con umbral de silencio de **1.5s** (`paragraph_threshold`). **Pero descarta los timestamps**: solo escribe texto. |
| Evento SSE `completed`              | Envía `{'status':'completed', 'text': ..., 'message': ...}`. **No envía segmentos ni timestamps.**                                                                                        |
| `src/pages/Transcriber.jsx`         | Recibe el SSE y guarda texto en localStorage con `addTranscription` (`{id, createdAt, name, text}` — **sin audio**, sin timestamps). |
| `src/utils/api.js`                  | `transcribeAudioStream(file, apiKeys, onProgress)` parsea el stream y delega cada `data:` a `onProgress`. No sabe nada de segmentos. |
| `src/pages/History.jsx`             | Unifica grabaciones (IndexedDB `mikit-db`/`recordings`) + transcripciones (localStorage). **Reproductor global fijo arriba de la lista** (`activePlayer`). |
| IndexedDB                           | Solo existe el store `recordings`. No hay store para karaokes.                                                                                                                             |

Conclusión: **la fuente de timestamps ya existe** (Whisper la entrega), solo hay que capturarla en el backend, exponerla por SSE, guardarla y renderizarla.

---

## 3. Decisiones de arquitectura (confirmadas con el usuario)

### 3.1 Fuente de fragmentos — **Whisper (Groq), acumulada en lote**

> Respuesta usuario (1): "que lo haga whisper, y lo vamos guardando en lote en un texto auxiliar cuando termine el proceso de transcripción lo mostramos".

- Los fragmentos salen de `segments[]` que **Whisper ya genera** (separa por silencio/oración).
- El backend **acumula en lote** los segmentos globales (texto + `start` + `end`) en una estructura auxiliar (lista en memoria, al estilo del `transcription_buffer.txt` actual).
- Cuando termina el proceso, el evento `completed` incluye **`segments`** además de `text`.
- No se detecta silencio extra en el cliente: Whisper es quien corta. El umbral de párrafo (1.5s) del backend se mantiene para la vista de texto plano.

### 3.2 Persistencia — **IndexedDB, nuevo store `karaokes`**

> Respuesta usuario (3): "para la persistencia decide lo mejor".

| Dato         | Dónde                                                              | Por qué                                                                 |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Karaoke      | IndexedDB `mikit-db`, nuevo store **`karaokes`**                    | Lleva **blob de audio** (+ segmentos) → localStorage no da para blobs grandes. |
| Transcripciones texto (compat) | localStorage `transcriptions_history` (sin cambios)                 | Compatibilidad total con lo existente.                                  |

Registro de karaoke:
```
{ id, name (derivado del título), createdAt, blob, segments: [{text, start, end}], text (join de fragmentos) }
```

### 3.3 Backward compat — **las transcripciones viejas quedan igual**

> Respuesta usuario (2): "si quedan igual y se suma una nueva variante que es karaoke".

- Las transcripciones existentes (sin audio ni timestamps) siguen listadas y funcionando exactamente igual.
- El karaoke es **una variante nueva** con su badge/ícono propio en `History.jsx`.
- La lista única del Historial ahora mezcla 3 tipos: `audio` (grabación), `texto` (transcripción) y `karaoke`.

### 3.4 Sin edición de fragmentos (v1)

> Respuesta usuario (4): "por el momento que no se pueda corregir un fragmento puntual".

- El panel de karaoke es de **lectura + navegación + exportación**.
- El texto completo editable (textarea) sigue siendo la vista de "transcripción"; no se edita por fragmento.

### 3.5 Sin tope de duración — **con resguardo de performance**

> Respuesta usuario (5): "que no haya tope. Pero que no afecte al performance de la página web que no vuelva lenta".

Reglas de performance para audios largos (3h+, cientos de fragmentos):

- **Un solo `<audio>`** reutilizado con `URL.createObjectURL(blob)` (patrón que ya usa `History.jsx`). Nunca base64 ni múltiples elementos.
- **Renderizar solo el fragmento actual** en la caja central — no renderizar los 300+ fragmentos en el DOM. La lista de navegación (contador + flechas) no construye nodos por fragmento.
- Los segmentos se guardan como JSON plano en el registro de IndexedDB; se leen **una sola vez** al abrir la tarjeta.
- Exportar a MD construye el texto con un loop simple (sin state intermedio pesado).
- (Si en el futuro los audios muy largos degradan, virtualizar la navegación; no es necesario ahora.)

### 3.6 Player inline en el Historial (requerimiento nuevo)

> Respuesta usuario: "cuando yo estoy en el historial, y reproduzco un audio, no se reproduzca en la parte de encima de todo, sino en el mismo lugar".

- **Eliminar el panel fijo `activePlayer`** que hoy se renderiza arriba de la lista (`<audio>` global + panel superpuesto).
- El player se renderiza **dentro de la propia tarjeta** del ítem en reproducción (donde está el botón ▶), en el mismo lugar de la lista.
- Al pulsar ▶ en otra tarjeta, la reproducción **se mueve** a esa tarjeta (una sola reproducción a la vez).
- Mismo comportamiento para karaokes: al abrir la tarjeta karaoke, el panel con controles y el fragmento en curso viven **dentro de la tarjeta**.

### 3.7 Exportar MD (karaoke)

> Respuesta usuario (6): sí.

Formato del `.md` exportado:
````markdown
# {título}

- Fragmento 1 de N — 00:00 – 00:28
- Fragmento 2 de N — 00:28 – 01:05
...

## Texto completo

[00:00 – 00:28] Así que les pido que nos concentremos...
[00:28 – 01:05] Durante las últimas clases hemos estado...
````

---

## 4. Cambios por capa

### 4.1 Backend (`backend/main.py`)

1. En el loop de fragmentos, además de escribir `transcription_buffer.txt`, **acumular** en una lista `global_segments` cada `{start: start_global, end: end_global, text: s_text}`.
2. Limitar el formato del texto del fragmento (trim, sin saltos de párrafo artificiales en `segments`; los párrafos quedan solo en el `text` final).
3. En el evento `completed`: enviar `segments` junto al `text`:
   ```python
   yield f"data: {json.dumps({'status': 'completed', 'text': final_text, 'segments': global_segments, 'message': 'Transcripción finalizada.'})}\n\n"
   ```
   (Si `partial_error`, los segmentos son los acumulados hasta el corte — comportamiento igual al texto parcial.)
4. Mantener el resto del SSE intacto (rotación de claves, cooldowns, etc.).

### 4.2 Frontend — `src/utils/api.js`

- `transcribeAudioStream` no necesita cambios de API: `onProgress` ya recibe cada `data:` completo. Los segmentos llegan dentro del evento `completed` y el Transcriber los captura ahí.

### 4.3 Frontend — `src/utils/storage.js`

- Agregar helpers para el store `karaokes`:
  - `saveKaraoke({name, blob, segments, text})` → genera `id`, `createdAt` y guarda en IndexedDB.
  - `getKaraokes()` / `deleteKaraoke(id)` / `updateKaraokeName(id, name)`.
- Reutilizar el patrón de `recordings` (misma conexión `mikit-db`).

### 4.4 Frontend — `src/pages/Transcriber.jsx`

1. Al recibir `completed`, capturar `segments` (opcional; puede ser `undefined` en respuestas sin timestamps).
2. En el modal "Guardar en Historial" (o nuevo paso), **ofrecer las dos opciones**:
   - **Guardar transcripción** (texto → localStorage, hoy).
   - **Guardar como Karaoke** (audio + segmentos → IndexedDB). Requiere que exista `audioBlob`/`file` en el estado (ya existe: blob del Recorder o `File` subido).
3. Para el karaoke, el nombre se deriva igual que hoy (`nombre original` del archivo).
4. Mostrar pequeño feedback del tipo guardado ("Guardado en Historial" / "Karaoke guardado").

### 4.5 Frontend — `src/pages/History.jsx`

1. **Player inline**: quitar el `<audio>` global + panel superior; mover audioRef/estado del player **dentro de la tarjeta activa** (posicionado en el ítem correspondiente). Una sola tarjeta puede tener el player montado a la vez.
2. **Lista unificada**: mezclar también `karaokes` de IndexedDB (badge "Karaoke" con ícono distinto, p. ej. `MicVocal` / `AudioLines`).
3. **Tarjeta karaoke expandible** (patrón tipo "tarjeta 3" del mock):
   - Header: título "Karaoke" + contador `(1/N)`.
   - Botones píldora: **Copiar frag.**, **Copiar todo**, **Historial** (colapsa/vuelve a la lista), **Exportar MD**.
   - Caja central: texto del fragmento actual, letra grande, blanca, centrada, + **rango de tiempo en violeta** (`00:00 – 00:28`).
   - Flechas ‹ › a los lados para cambiar de fragmento (izquierda atenuada en el primero).
   - Controles: play circular centrado + retroceder/adelantar (⟲ ⟳), barra de progreso con tiempos `00:00` izq/der.
   - Sincronización: `timeupdate` del `<audio>` → detectar fragmento activo por `currentTime ∈ [start, end)` y resaltar/actualizar la caja.
4. Botones existentes de audio/texto (renombrar, eliminar, exportar, transcribir → `/transcriptor`) se mantienen; se agregan los equivalentes para karaoke (renombrar nombre, eliminar, exportar MP3 y MD).

### 4.6 Export MD (karaoke)

- Helper `karaokeToMarkdown(karaoke)` → formato de §3.7.
- Usa `saveToDesktop` (endpoint `/save_md` existente).

---

## 5. Tareas

- [x] Backend: acumular `global_segments` en el loop de chunks (main.py).
- [x] Backend: incluir `segments` en evento `completed`.
- [x] Frontend: helpers `karaokes` en `storage.js` (save/get/delete/rename + store propio en IndexedDB).
- [x] Frontend: opción "Guardar como Karaoke" en el modal del Transcriber (exige `audioBlob`/`file` en estado).
- [x] Frontend: player inline en `History.jsx` (quitado el panel global; el player vive dentro de la tarjeta activa).
- [x] Frontend: integrar karaokes en la lista unificada (badge propio "Karaoke").
- [x] Frontend: tarjeta karaoke expandible (header con contador, botones píldora, caja de fragmento, flechas, controles ⟲ ▶ ⟳, sync por timeupdate).
- [x] Frontend: exportar MD del karaoke (formato §3.7: lista de fragmentos + "## Texto completo").
- [x] Frontend: exportar MP3 del karaoke desde la fila de acciones (plan 4.5: "exportar MP3 y MD").
- [ ] Verificación E2E en vivo (recorder/archivo → transcribir → guardar karaoke → abrir en Historial → navegar fragmentos → exportar MD). Requiere API key real + backend corriendo.

**Nota de implementación (2026-09-24):** el `segments` de Whisper ya venía disponible en el backend (`verbose_json`), solo había que acumularlo con offset global y exponerlo en el evento `completed`. El player del Historial ya no se monta "arriba de todo": el `<audio>` oculto se controla desde la tarjeta activa y el bloque de controles se renderiza inline en esa misma tarjeta. El panel de karaoke usa un solo `karaokeIndex` global (una tarjeta expandida a la vez) y sincroniza por `timeupdate` comparando `currentTime` contra `[start, end)` del fragmento.

**Correcciones post-revisión (auditoría contra el plan):**
- `gotoFragment` ahora recibe el karaoke del panel (no `activeItem`): las flechas ‹ › navegan aunque el player esté cerrado; solo saltan el audio si ese karaoke se está reproduciendo.
- `karaokeIndex` se resetea a 0 al expandir otro karaoke distinto.
- Export MD alineado al formato §3.7 (lista de fragmentos con rango + sección "## Texto completo").
- **Vista karaoke en el resultado del Transcriptor (2026-09-24):** al terminar de transcribir, si hay `segments`, se muestra directamente el panel karaoke (contador, fragmento centrado con rango violeta, flechas ‹ ›, controles ⟲ ▶ ⟳ + velocidad, barra y Exportar MD) en lugar del textarea plano. El botón **"Guardar"** abre el modal que pregunta cómo guardarlo (transcripción o karaoke). Un toggle "Ver texto" / "Ver karaoke" permite editar el texto completo antes de guardar; "Subir otro archivo" limpia el estado del karaoke.

**Limitaciones conocidas:**
- Si se sube un archivo de **video (MP4)** y se guarda como karaoke, el blob es video → el `<audio>` del panel no lo reproducirá. Los formatos de audio (mp3, m4a, wav, ogg, webm) funcionan. Para convertir el video a audio habría que exponer el MP3 procesado por el backend (fuera de alcance v1).
- El `segments` llega como lista plana de Whisper; si un fragmento tiene saltos de línea internos se conservan (solo se aplica `strip()`), sin colapso de espacios.

---

## 6. Criterios de aceptación

1. Transcribir un audio de prueba → al completar, se ofrece guardar como **transcripción** o **karaoke**.
2. Guardar karaoke persiste el audio y los fragmentos en IndexedDB (no en localStorage).
3. En Historial, abrir un karaoke muestra el panel expandido con contador `(1/N)`, texto del fragmento centrado, rango violeta y controles.
4. Al reproducir, el fragmento resaltado **cambia sincronizado** con el audio; flechas ‹ › navegan y actualizan el audio (`currentTime` del fragmento).
5. **El reproductor vive dentro de la tarjeta** (inline), ya no arriba de la lista.
6. Las transcripciones viejas se ven y funcionan igual que antes.
7. Exportar MD genera el formato de §3.7.
8. Un audio de 1h+ se reproduce y navega sin volver lenta la página.