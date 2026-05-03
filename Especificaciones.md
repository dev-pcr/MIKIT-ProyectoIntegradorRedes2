# Especificaciones del Sistema — MIKIT v1.0

## Visión General

MIKIT es una aplicación web progresiva (PWA) orientada a productividad personal, que integra herramientas de grabación de audio y transcripción. La interfaz debe seguir principios sólidos de UX/UI: jerarquía visual clara, feedback inmediato en cada acción, navegación predecible y accesibilidad (WCAG 2.1 AA).

---

## Principios de Diseño

- **Consistencia**: Misma tipografía, paleta y patrones de componentes en toda la app.
- **Feedback inmediato**: Toda acción del usuario genera una respuesta visual mediante un sistema de *Toasts* flotantes ubicado en la esquina inferior derecha.
- **Confirmaciones Seguras**: Las acciones destructivas utilizan ventanas modales de la propia interfaz gráfica (nunca pop-ups nativos del navegador).
- **Jerarquía clara**: El elemento más importante en cada pantalla domina visualmente.
- **Accesibilidad**: Contraste mínimo 4.5:1, navegación por teclado, etiquetas ARIA donde corresponda.
- **Persistencia de estado**: Historial y configuraciones se guardan en `localStorage` o IndexedDB.

---

## Navegación Global

- Barra de navegación persistente (sidebar o top navbar) visible en todas las páginas.
- Rutas: `/` (Home), `/grabadora`, `/transcriptor`, `/configuracion`.
- Indicación visual de la página activa.
- La navegación no debe interrumpir grabaciones o transcripciones en curso (mostrar advertencia si corresponde).

---

## Página: Home (`/`)

### Propósito
Punto de entrada. Orienta al usuario y ofrece acceso rápido a las herramientas.

### Contenido
- Título y descripción breve del sistema.
- Tarjetas de acceso rápido a: Grabadora y Transcriptor.
- Cada tarjeta muestra: ícono, nombre, descripción de una línea y botón/link de acceso.
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

**Visuales requeridos:**
- Temporizador en formato `HH:MM:SS` actualizado en tiempo real.
- Indicador animado de actividad de audio (waveform o pulsación visual) durante la grabación.
- Indicador de estado actual visible y diferenciado por color/ícono.

---

### 2. Guardado de Grabación

Al detener, se presenta un **modal de guardado** con:

- **Campo de nombre personalizado**: texto libre que el usuario ingresa al momento.
- **Selector de plantilla de nombre**: lista desplegable con plantillas predefinidas.
- **Vista previa del nombre final**: se construye en tiempo real así: [Fecha actual] + [Texto de plantilla] + [Texto del usuario]
Ejemplo: `2025-01-15 Ingenieria de software Reunión Equipo Notas finales`

- **Plantillas de nombre** (configurables en `/configuracion`):
  - Predeterminadas sugeridas: `"Ingenieria de software"`, `"Redes 2"`, `"Entrevista"`, `""` (vacío).
  - El usuario puede agregar/eliminar plantillas desde Configuración.

- Botones: `Guardar` / `Descartar`.

**Formato de archivo guardado:** `.mp3`

---

### 3. Reproductor Rápido (Post-grabación)

Después de guardar, aparece un reproductor inline para escuchar la grabación recién hecha:
- Play / Pausa.
- Barra de progreso con scrubbing (adelantar/retroceder arrastrando).
- Tiempo transcurrido / Duración total.
- Botón para ir al historial.

---

### 4. Panel de Historial de Grabaciones

**Acceso:** botón/tab dentro de `/grabadora` o sección inferior de la misma vista.

**Vista de lista.** Cada ítem muestra:
- Nombre de la grabación.
- Duración (formato `MM:SS`).
- Fecha de guardado (formato `DD/MM/YYYY HH:MM`).
- Acciones disponibles: ` Reproducir`, `Renombrar`, ` Eliminar`, `Copiar`.

**Acciones del historial:**

- **Reproducir**: abre un reproductor inline o modal con:
  - Play / Pausa, barra de scrubbing, velocidad de reproducción (0.5x, 1x, 1.5x, 2x), tiempo actual / total.
- **Renombrar**: edición inline o modal con campo de texto. Confirmar con Enter o botón.
- **Eliminar**: ventana modal de confirmación antes de eliminar ("¿Eliminar esta grabación? Esta acción no se puede deshacer.").

**Ordenamiento:** por fecha (más reciente primero, por defecto). Opcional: ordenar por nombre o duración.

**Estado vacío**: mensaje amigable + CTA para iniciar primera grabación.

---

## Módulo: Transcriptor (`/transcriptor`)

### 1. Carga de Archivo

- Zona de carga con **drag & drop** + botón de selección de archivo.
- Formatos aceptados: `.mp3`, `.mp4`, `.wav`, `.webm`, `.m4a`, `.ogg`.
- Límite de tamaño: definido por la API de Groq (mostrar si aplica).
- Al seleccionar archivo: mostrar nombre, tamaño y tipo.

---

### 2. Panel de Transcripción Activa

**Estados del proceso:**

| Estado | Visual |
|---|---|
| `idle` | Instrucciones de uso |
| `cargando` | Spinner + "Subiendo archivo…" |
| `en progreso` | Barra de progreso indeterminada + "Transcribiendo…" |
| `listo` | Texto de transcripción visible |
| `error` | Mensaje de error con opción de reintentar |

**Resultado visible:**
- Área de texto (read-only o editable, TBD) con la transcripción completa.
- Botones de acción sobre el resultado: `Copiar`, `Guardar en historial`, `Descargar .md`, `Descartar`.

**Guardar en historial:**
- Se guarda con el nombre del archivo original como nombre por defecto.
- El usuario puede editar el nombre antes de guardar (modal simple).

---

### 3. Panel de Historial de Transcripciones

**Acceso:** tab o sección inferior dentro de `/transcriptor`.

**Vista de lista.** Cada ítem muestra:
- Nombre del archivo original.
- Fecha de guardado (`DD/MM/YYYY HH:MM`).
- Acciones inline: ` Copiar`, ` Eliminar`.

**Al hacer clic en un ítem:** se expande o abre un modal con el texto completo y las opciones: `Copiar`, `Descargar .md`, `Eliminar`.

**Eliminar:** requiere ventana modal de confirmación integrada a la UI.

**Estado vacío**: mensaje amigable + CTA.

---

### 4. Descarga como `.md`

El archivo `.md` descargado debe tener la siguiente estructura:

```markdown
# Transcripción: [Nombre del archivo]
**Fecha:** [DD/MM/YYYY HH:MM]

---

[Texto completo de la transcripción]
```

---

## Módulo: Configuración (`/configuracion`)

### 1. Claves API de Groq

- **Listado de API Keys** registradas: cada una muestra un alias (nombre) y los últimos 4 caracteres de la clave (resto enmascarado).
- Acciones por clave: `Seleccionar como activa`, `Eliminar` (esta última mediante modal de confirmación).
- Indicador visual de cuál es la clave activa actualmente (cual se esta usando)
- **Formulario para agregar nueva clave:**
  - Campo: Alias (nombre descriptivo, ej. "Personal", "Trabajo").
  - Campo: API Key (input tipo password).
  - Botón: `Agregar`.
- Las claves se almacenan de forma local (localStorage). No se transmiten a ningún servidor propio.
- **Advertencia de seguridad** visible: "Tus claves se guardan localmente en este dispositivo."

### 2. Plantillas de Nombre (Grabadora)

- Lista de plantillas actuales con opción de eliminar cada una (mediante modal de confirmación).
- Campo para agregar nueva plantilla.
- Las plantillas se reflejan en el selector del modal de guardado de la grabadora.

---

## Almacenamiento Local

| Dato | Mecanismo |
|---|---|
| Grabaciones (audio) | IndexedDB (blobs de audio) |
| Metadatos de grabaciones | localStorage (JSON array) |
| Transcripciones | localStorage (JSON array) |
| API Keys de Groq | localStorage (con alias) |
| Plantillas de nombre | localStorage (JSON array) |

---

## Manejo de Errores

- Sin micrófono disponible: mensaje claro + instrucciones para habilitar permisos.
- Error de API (Groq): mostrar código/mensaje + botón reintentar. Si la clave es inválida, redirigir a `/configuracion`.
- Sin API Key configurada: bloquear el botón de transcribir + aviso con link a `/configuracion`.
- Archivo inválido o muy grande: mensaje de error específico en la zona de carga.

---

## Restricciones Técnicas

- Aplicación 100% client-side (sin backend propio).
- Compatibilidad: últimas 2 versiones de Chrome, Firefox, Safari y Edge.
- API de grabación: `MediaRecorder API`.
- API de transcripción: Groq (`whisper-large-v3` o equivalente).
- Framework sugerido: React + Vite (o vanilla JS si se prefiere sin bundler).

