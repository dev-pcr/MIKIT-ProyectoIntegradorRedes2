# Manual de Usuario — MIKIT

**MIKIT** es un software libre de grabación de audio y procesamiento de texto con IA, que se usa como aplicación web local en Windows.

Este manual explica cada pantalla y función de la aplicación.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Inicio](#2-inicio)
3. [Grabadora](#3-grabadora)
4. [Transcriptor](#4-transcriptor)
5. [Historial](#5-historial)
6. [Procesar con IA](#6-procesar-con-ia)
7. [Configuración](#7-configuración)
8. [Dónde se guardan tus archivos](#8-dónde-se-guardan-tus-archivos)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Primeros pasos

Antes de usar MIKIT necesitás dos cosas:

1. **El proyecto corriendo** — seguí las instrucciones de instalación del [`README.md`](README.md).
2. **Una API key** — MIKIT usa dos motores distintos, y solo necesitás el que vas a usar:

| Si querés... | Necesitás | Se carga en |
|---|---|---|
| Transcribir audio | API key de **Groq** (gratis, [console.groq.com](https://console.groq.com)) | [Configuración](#7-configuración) → *Claves API de Groq para audio* |
| Procesar texto con IA | API key de **OpenRouter** ([openrouter.ai](https://openrouter.ai)) | [Configuración](#7-configuración) → *Claves API para procesado de texto* |

Las claves se pegan en la app, no en archivos. Sin clave de Groq la grabadora funciona igual, pero el transcriptor no.

> El indicador **Server: Online / Offline** abajo del menú lateral te dice si el backend está respondiendo. Si está en *Offline*, nada que dependa del servidor va a funcionar.

---

## 2. Inicio

Al abrir MIKIT ves la pantalla de bienvenida con dos tarjetas principales:

- **Grabadora Pro** — captura audio con el micrófono, con plantillas de nombres e historial.
- **Transcriptor IA** — convierte archivos de audio o video en texto.

Debajo hay tres accesos destacados: **Privacidad** (tus datos quedan en tu PC), **Velocidad** (transcripción rápida) e **Historial** (tus trabajos siempre disponibles).

El menú lateral tiene las seis secciones del app y se puede colapsar con la ☰ para ganar espacio.

---

## 3. Grabadora

### Grabar un audio

1. Andá a **Grabadora**.
2. Tocá el botón central (micrófono) para **empezar a grabar**. MIKIT pedirá permiso para usar el micrófono — aceptalo.
3. Mientras grabás podés:
   - **Pausar** y **reanudar** cuando quieras.
   - **Descartar** la grabación (botón de reinicio) para empezar de nuevo.
   - **Detener** para cerrar y guardar.
4. Al detener, se abre la ventana **Guardar Grabación**:

| Campo | Descripción |
| --- | --- |
| Plantilla de Nombre | Prefijo opcional elegido de tus plantillas (se crean en [Configuración](#7-configuración)). |
| Nombre Específico | Nombre libre, por ejemplo "Notas de la reunión". |
| Vista Previa del Nombre | Muestra cómo quedará el nombre final: `DD-MM-AAAA plantilla nombre`. |

5. Elegí **Guardar**.

### Configuración adicional

En la **esquina superior derecha de la consola de grabación** hay una **tuerca**. La apretás y se abre una ventana con los ajustes de captura: el selector de micrófono a la izquierda y la puerta de ruido a la derecha. En pantallas angostas se apilan en una columna.

La tuerca tiene un **punto amarillo** mientras falte completar algo, y queda deshabilitada si intentás abrirla con una grabación en curso.

Se cierra con la **X**, apretando **Escape** o haciendo click afuera de la ventana.

> También podés abrirla desde el aviso que aparece bajo el botón de grabar cuando todavía falta configurar algo.

#### Elegir micrófono

El selector lista los dispositivos de audio disponibles. MIKIT detecta si conectás o desconectás un micrófono mientras la app está abierta — útil para el mic Bluetooth de solapa. No se recuerda entre sesiones, y no podés cambiarlo mientras estás grabando.

#### Calibrar la puerta de ruido

La barra muestra **el nivel de volumen que entra del micrófono en este momento**, sin reproducir sonido. La escala va de **−60 dB** (silencio) a **0 dB** (clipping).

Arrastrá el mango —o hacé click en la barra— para fijar **desde qué nivel pasa el sonido**. Lo que quede por debajo del umbral se dibuja atenuado: eso es justamente lo que la puerta descarta. Al soltar el mango, si la señal está por encima del umbral, la barra se ilumina y el texto confirma que pasa.

También podés moverlo con el teclado: flechas para ajustar de a 1 dB, `Shift` + flechas de a 6 dB, `Home` / `End` para los extremos. **Recalibrar** lo devuelve a "sin calibrar".

El umbral se guarda entre sesiones. La calibración depende del micrófono y de la distancia a la boca, así que conviene repetirla si cambiás de dispositivo.

> **Ojo:** hoy la puerta define el umbral y te muestra en vivo qué señal pasaría, pero **todavía no le aplica el filtrado al audio que se graba**. El recorte real se agrega en el paso siguiente de la implementación.

#### Antes de grabar

El botón de grabación permanece bloqueado hasta que completes las dos cosas:

- elegiste un micrófono, y
- calibraste la puerta de ruido.

Bajo el botón aparece qué falta. Si no entendés por qué no graba, es una de esas dos.

### El reproductor

Al guardar, aparece un aviso **Grabación Guardada** con botones para **Reproducir** o **Transcribir** la grabación.

Cada grabación se puede reproducir con un reproductor completo: play/pausa, saltar ±10 segundos, barra de progreso clicable y **velocidad de reproducción** (1x, 1.5x, 2x, 0.5x — cíclica).

> Las grabaciones quedan en el almacenamiento local (IndexedDB) de tu navegador. Las encontrás, exportás o transcribís desde [Historial](#5-historial).

---

## 4. Transcriptor

### Subir un archivo

En la pantalla **Transcriptor IA** hay dos formas:

1. **Arrastrar y soltar** el archivo en la zona punteada.
2. **Seleccionar archivo** con el botón.

**Formatos soportados:** MP3, MP4, WAV, M4A, WEBM, OGG — **sin límite de tamaño**.

También podés llegar desde la Grabadora tocando **Transcribir** en una grabación guardada.

### Transcribir

Con el archivo cargado, tocá **Transcribir ahora**. MIKIT muestra el progreso en tiempo real con tres etapas desplegables:

1. **Fraccionando audio** — el backend divide el archivo en partes para procesarlo de forma óptima.
2. **Transcribiendo fragmentos** — cada parte se envía al modelo Whisper. Si tenés varias API keys, ves con cuál se procesa cada fragmento; si una clave alcanza su límite, MIKIT **rota automáticamente** a otra o **espera** y reintenta.
3. **Ensamblando resultado** — se unen los fragmentos en el texto final, con párrafos automáticos según los silencios.

### Karaoke y texto: dos vistas del mismo resultado

Cuando el modelo devuelve marcas de tiempo (que es lo habitual), la pantalla abre en **modo karaoke**, que es la vista por defecto:

**Modo karaoke** — reproduction sync:
- Fragmento actual `N/M` con su marca de tiempo `[inicio – fin]`.
- Navegación de fragmento con flechas, y skip ±10s del audio.
- El fragmento avanza solo mientras se reproduce el audio.
- **Copiar frag.** (solo el fragmento actual) o **Copiar** (todo).
- **Exportar MD** — arma un `.md` con el índice de fragmentos y el texto completo, cada línea con su marca de tiempo.

**Modo texto** — con el botón **Ver texto** pasás a un área editable con la transcripción completa en párrafos. Podés corregirla a mano antes de guardarla. **Ver karaoke** te devuelve a la vista sincronizada.

> El botón de guardado tiene dos opciones: **Guardar transcripción** (texto plano al historial) o **Guardar como Karaoke (N fragmentos)**, que conserva el audio y las marcas de tiempo para poder seguirlo sincronizado después.

### Guardar el resultado

- **Guardar en Escritorio** — exporta el texto como **Markdown (`.md`)** tal cual, sin header.
- **Guardar** (modal) — te deja elegir plantilla y nombre antes de mandarlo al [Historial](#5-historial).
- **Copiar** — al portapapeles.
- **Subir otro archivo** — vuelve a la zona de carga.

> El botón "Guardar en Escritorio" exporta el texto crudo. En cambio, la **exportación masiva desde Historial** sí le agrega un header `# Transcripción: [nombre]` con la fecha.

---

## 5. Historial

Todas las grabaciones, transcripciones y karaokes viven en una **única lista** en `/historial`, ordenada de más reciente a más antigua. Cada ítem muestra su ícono de tipo y, según corresponda, un reproductor inline.

### Qué podés hacer con cada tipo

| Acción | Audio | Transcripción | Karaoke |
| --- | :---: | :---: | :---: |
| Reproducir inline | ✅ | — | — |
| Ver karaoke sincronizado | — | — | ✅ |
| Copiar texto | — | ✅ | ✅ |
| Renombrar | ✅ | ✅ | ✅ |
| Guardar en Escritorio | ✅ (`.mp3`) | ✅ (`.md`) | — |
| Exportar MD | — | — | ✅ |
| Transcribir | ✅ | — | — |
| Eliminar | ✅ | ✅ | ✅ |

Renombrar y eliminar se hacen con los íconos que aparecen al pasar el mouse sobre el ítem. Eliminar siempre pide confirmación.

### Exportar todo

Dos botones arriba de la lista, con avisos de progreso:

- **Exportar Audios** — crea una carpeta `MIKIT_Grabaciones_AAAAMMDD_HHMM` en tu Escritorio y guarda cada grabación como **MP3** (22050 Hz, 16 bits, 96 kbps).
- **Exportar Textos** — crea una carpeta `MIKIT_Transcripciones_AAAAMMDD_HHMM` con todas las transcripciones y karaokes en `.md`, cada uno con su header de fecha.

Si algo falla a mitad de la exportación, el proceso se detiene y te informa hasta dónde llegó.

> Si la lista está vacía, aparece un mensaje con un acceso directo para empezar a grabar o transcribir.

---

## 6. Procesar con IA

Esta sección es independiente del transcriptor: en vez de audio, toma **texto** y lo transforma según las instrucciones que le des. Sirve para resumir, corregir, extraer ideas, etc.

Es un wizard de **3 pasos**. Los pasos ya completados se pueden volver a abrir con un clic.

### Paso 1 — Fuentes

Elegís de dónde sale el texto, hasta **2 fuentes combinadas**:

- **Archivos `.md`** — arrastralos o seleccionalos. MIKIT les saca la extensión y el frontmatter (`---...---`) para quedarse con el cuerpo limpio.
- **Transcripciones y karaokes del historial** — se listan más abajo, con las más recientes primero. Los karaokes se identifican con un badge violeta.

Clic en cada fuente para seleccionarla o deseleccionarla.

### Paso 2 — Prompt y Clave

- **Plantilla de prompt** — elijes una de tus plantillas (ver [Configuración](#7-configuración)) y ves un adelanto de las instrucciones. Con **Nuevo prompt** podés crear una sin salir del wizard.
- **Clave API** — elijes cuál de tus claves de OpenRouter usar. Se preselecciona la activa.

Si no hay plantillas o claves cargadas, el paso te avisa con un enlace directo a Configuración.

### Paso 3 — Resultado

Tocá **Procesar** y MIKIT avanza solo a esta pantalla. Vas a ver el texto aparecer en vivo mientras el modelo responde; hasta el primer fragmento hay un spinner.

Cuando termina, el resultado es **Markdown**, con botones:

- **Ajustar** — vuelve al paso 2 para cambiar el prompt o la clave sin perder la selección de fuentes.
- **Copiar** — al portapapeles.
- **Guardar en Historial** — lo suma a la lista de [Historial](#5-historial), desde donde lo exportás.
- **`.md`** — lo baja directo a tu Escritorio.

> El modelo se elige automáticamente según el tipo de tarea. MIKIT le exige siempre que responda únicamente en Markdown, sin texto alrededor.

---

## 7. Configuración

Cuatro secciones, todas plegables. La primera viene abierta.

### 1. Claves API de Groq para audio

El pool de claves que usa el **Transcriptor**. MIKIT rota entre ellas automáticamente cuando una recibe un límite de uso, así que la transcripción de un audio largo no se interrumpe.

- **Agregar** — un *Alias* (ej. "Mi Clave") y la *API Key* (`gsk_...`).
- **Activar** — con varias claves, la activa es la que se usa primero. Las demás quedan de respaldo.
- **Eliminar** — con el ícono de papelera, pide confirmación.

La primera clave que agregás queda activa. Si eliminás la activa, la primera restante toma su lugar.

**¿Por qué conviene varias?** Groq limita los minutos de audio transcribibles por clave, por cuenta. Agregá varias (todas gratuitas, con cuentas distintas) para no cortar transcripciones largas.

> **Seguridad:** las claves se guardan solo en el `localStorage` de tu navegador. Nunca se envían a servidores propios — se usan directamente contra la API de Groq desde tu máquina.

### 2. Claves API para procesado de texto

Idéntico, pero para el pool que usa **Procesar con IA** (OpenRouter). Son claves **independientes** de las de audio: tener Groq cargado no habilita el procesado de texto, y viceversa.

### 3. Plantillas de Nombre

Prefijos que se usan al guardar grabaciones o transcripciones para ordenar tus archivos. Vienen cuatro por defecto: `Ingeniería de Software`, `Redes 2`, `Entrevista`, `Notas Personales`.

- **Agregar** — escribís el prefijo y tocás Agregar (o Enter).
- **Editar** — ícono de lápiz, modal de un campo.
- **Eliminar** — ícono de papelera, con confirmación.

Ejemplo: la plantilla `Entrevista` más el nombre `Juan` guarda la grabación como `26-09-2026 Entrevista Juan`.

### 4. Plantillas de Prompts

Instrucciones para modelos de IA, que se usan en el paso 2 de [Procesar con IA](#6-procesar-con-ia). A diferencia de las plantillas de nombre, acá importa el **texto**, no el prefijo.

- **Ver** — ícono de ojo, abre el texto completo (con botón para editar desde ahí).
- **Editar** — ícono de lápiz, modal con nombre y área de texto.
- **Eliminar** — ícono de papelera, con confirmación.
- **Nueva Plantilla de Prompt** — botón al final de la lista.

---

## 8. Dónde se guardan tus archivos

| Tipo de archivo | Destino |
| --- | --- |
| Grabación exportada | `Escritorio\nombre.mp3` |
| Grabaciones exportadas en lote | `Escritorio\MIKIT_Grabaciones_AAAAMMDD_HHMM\*.mp3` |
| Transcripción exportada | `Escritorio\nombre.md` |
| Karaoke exportado | `Escritorio\nombre.md` |
| Exportaciones en lote de texto | `Escritorio\MIKIT_Transcripciones_AAAAMMDD_HHMM\*.md` |

MIKIT resuelve la ruta real de tu Escritorio automáticamente (soporta redirección a OneDrive). Si ya existe un archivo con el mismo nombre, agrega un sufijo numérico: `nombre (1).md`, `nombre (2).md`, etc.

Todo lo demás vive en el navegador y **no sale de tu PC**:

| Dato | Dónde |
| --- | --- |
| Grabaciones y karaokes | IndexedDB del navegador |
| Claves de API y plantillas | localStorage del navegador |

> Esto tiene una consecuencia práctica: si borrás los datos del navegador o cambiás de máquina, perdés el historial. **Exportá antes** lo que te importa.

---

## 9. Solución de problemas

| Problema | Causa probable | Solución |
| --- | --- | --- |
| El indicador dice **Server: Offline** | El backend no arrancó o se cayó | Volvé a lanzar `iniciar.bat`. Si sigue en Offline, revisá la ventana de consola: ahí está el error real. |
| "No hay API Keys configuradas" | No agregaste una clave de Groq | Andá a **Configuración → Claves API de Groq para audio** y agregá tu clave (`gsk_...`). |
| "Se requiere una API Key de texto (OpenRouter)" | Falta la clave de OpenRouter | Andá a **Configuración → Claves API para procesado de texto**. Son claves separadas de las de Groq. |
| "No se pudo acceder al micrófono" | El navegador no tiene permiso | Permití el acceso al micrófono cuando el navegador lo pida (o en la configuración del sitio). |
| Al transcribir dice "esperando límite" | Tu clave gratuita alcanzó el límite de Groq | Esperá a que se libere, o agregá más claves de audio en Configuración para rotar. |
| La exportación falla | El backend no está corriendo | Verificá el indicador del menú lateral. |
| El backend avisa que no encuentra `ffmpeg` | Falta FFmpeg | Instalá FFmpeg y agregalo al `PATH` del sistema, **o** poné una carpeta `ffmpeg/` en la **raíz** del proyecto. |
| El frontend no carga en el navegador | El puerto 8000 está ocupado por otra app | `iniciar.bat` te avisa si detecta el puerto ocupado. Cerrá la otra app y volvé a lanzar. |
| `ModuleNotFoundError: No module named 'backend'` | Se ejecutó el backend desde una carpeta equivocada | Ejecutalo desde la **raíz** del proyecto: `python backend/main.py`. |
| El puerto 8000 queda ocupado al cerrar | Un proceso anterior no terminó | El launcher detecta que el backend se detuvo; si el puerto sigue tomado, cerrá la consola vieja y relanzá. |

---

*MIKIT es software libre bajo GNU GPL v3. Si te resulta útil, podés donar por Mercado Pago al alias **MP.PAGAR** (Pablo Nicolas Celaya Rios).*
