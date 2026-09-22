# Manual de Usuario — MIKIT

**MIKIT** es un software libre de grabación de audio y transcripción inteligente con IA, disponible como aplicación web y como app de escritorio para Windows.

Este manual explica cada pantalla y función de la aplicación.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Inicio](#2-inicio)
3. [Grabadora Pro](#3-grabadora-pro)
4. [Transcriptor IA](#4-transcriptor-ia)
5. [Configuración](#5-configuración)
6. [¿Cómo funciona la transcripción?](#6-cómo-funciona-la-transcripción)
7. [Dónde se guardan tus archivos](#7-dónde-se-guardan-tus-archivos)
8. [Solución de problemas](#8-solución-de-problemas)
9. [App de escritorio (Windows)](#9-app-de-escritorio-windows)

---

## 1. Primeros pasos

Antes de usar MIKIT necesitás dos cosas:

1. **El proyecto corriendo** — seguí las instrucciones de instalación del [`README.md`](README.md).
2. **Una API key de Groq** (gratuita) — entrá a [console.groq.com](https://console.groq.com), create una cuenta y generá una clave (`gsk_...`). Sin una clave, la grabadora funciona, pero el transcriptor no.

Para configurar la clave: abrí MIKIT, andá a **Configuración** (ícono de llave en el menú lateral), pegá tu clave y guardala. Consultá la sección [5. Configuración](#5-configuración).

---

## 2. Inicio

Al abrir MIKIT ves la pantalla de bienvenida con dos tarjetas principales:

- **Grabadora Pro** — captura audio con el micrófono, con plantillas de nombres e historial.
- **Transcriptor IA** — convierte archivos de audio o video en texto.

También hay tres accesos destacados: **Privacidad** (tus datos quedan en tu PC), **Velocidad** (transcripción rápida) e **Historial** (tus trabajos siempre disponibles).

---

## 3. Grabadora Pro

### Grabar un audio

1. Andá a **Grabadora Pro**.
2. Tocá el botón central (micrófono) para **empezar a grabar**. MIKIT pedirá permiso para usar el micrófono — aceptalo.
3. Mientras grabás podés:
   - **Pausar** (botón rojo central) y **reanudar** cuando quieras.
   - **Descartar** la grabación (botón de reinicio) para empezar de nuevo.
   - **Detener** con el botón cuadrado blanco.
4. Al detener, se abre la ventana **Guardar Grabación**:

| Campo | Descripción |
| --- | --- |
| Plantilla de Nombre | Prefijo opcional elegido de tus plantillas (se crean en Configuración). |
| Nombre Específico | Nombre libre, por ejemplo "Notas de la reunión". |
| Vista Previa del Nombre | Muestra cómo quedará el nombre final: `fecha plantilla nombre`. |

5. Elegí **Guardar** (o **Descartar** si no te sirve).

### El reproductor

Al guardar, aparece un aviso **Grabación Guardada** con botones para **Reproducir** o **Transcribir** la grabación directamente.

Cada grabación del historial se puede reproducir con un reproductor completo: play/pausa, saltar ±10 segundos, barra de progreso clicable y **velocidad de reproducción** (1x, 1.5x, 2x, 0.5x).

### Historial de grabaciones

Todas tus grabaciones quedan en la lista **Historial de Grabaciones**. Sobre cada una (pasando el mouse) tenés:

- **Reproducir** — abre el reproductor.
- **Guardar en Escritorio** — exporta el audio como **MP3** (22050 Hz, 96 kbps) directo a tu Escritorio.
- **Transcribir** — envía la grabación al Transcriptor IA.
- **Renombrar** — edita el nombre (ícono de lápiz sobre el título).
- **Eliminar** — borra la grabación (pide confirmación).

### Exportar todas las grabaciones

El botón **Exportar Todo** crea una carpeta `MIKIT_Grabaciones_FECHA_HORA` en tu Escritorio y guarda todas las grabaciones del historial como MP3, una por una, con avisos de progreso.

> Los audios guardados en el historial quedan en el almacenamiento local (IndexedDB) de tu navegador. Exportalos o transcribilos antes de limpiar el navegador.

---

## 4. Transcriptor IA

### Subir un archivo

En la pantalla **Transcriptor IA** hay dos formas:

1. **Arrastrar y soltar** el archivo en la zona punteada.
2. **Seleccionar archivo** con el botón.

**Formatos soportados:** MP3, MP4, WAV, M4A, WEBM, OGG — **sin límite de tamaño**.

También podés llegar desde la Grabadora tocando **Transcribir** en una grabación guardada.

### Transcribir

Con el archivo cargado, tocá **Transcribir ahora**. MIKIT muestra el progreso en tiempo real con tres etapas desplegables:

1. **Fraccionando audio** — el backend divide el archivo en partes para procesarlo de forma óptima.
2. **Transcribiendo fragmentos** — cada parte se envía al modelo Whisper. Si tenés varias API keys, verás con cuál se está procesando cada fragmento; si hay un límite de uso, MIKIT **rota automáticamente** de clave o **espera el tiempo necesario** y reintenta.
3. **Ensamblando resultado** — se unen los fragmentos en el texto final, con párrafos automáticos según los silencios.

### El resultado

Cuando termina, aparece el texto en un área editable — podés corregirlo antes de guardarlo. Las opciones son:

- **Copiar** — copia el texto al portapapeles.
- **Guardar en Escritorio** — exporta un archivo **Markdown (`.md`)** con el texto.
- **Historial** — guarda la transcripción dentro de MIKIT para consultarla luego.
- **Subir otro archivo** — vuelve a la zona de carga.

### Historial de transcripciones

Las transcripciones guardadas en el historial se pueden:

- **Expandir** (clic en el ítem) para ver el texto completo.
- **Copiar** el texto.
- **Guardar en Escritorio** (`.md`).
- **Eliminar** (con confirmación).

El botón **Exportar Todo** crea una carpeta `MIKIT_Transcripciones_FECHA_HORA` en el Escritorio con todas las transcripciones en formato `.md`.

---

## 5. Configuración

### Claves API de Groq

- **Agregar clave**: completá un *Alias* (ej. "Mi Clave") y la *API Key* (`gsk_...`), y tocá **Agregar**. La primera clave agregada queda activa automáticamente.
- **Activar**: si tenés varias claves, la activa es la que se usa primero. Cualquier otra clave queda como respaldo.
- **Eliminar**: con el botón de papelera (pide confirmación).

**¿Por qué conviene varias claves?** Groq limita los minutos de audio transcribibles por clave. Si agregás varias (todas gratuitas, con cuentas distintas), MIKIT rota entre ellas cuando una alcanza el límite y la transcripción larga continúa sin interrumpirse.

> **Seguridad:** las claves se guardan solo en el almacenamiento local de tu navegador (`localStorage`). Nunca se envían a servidores de terceros — solo se usan directamente contra la API de Groq desde tu propia máquina.

### Plantillas de Nombre

Las plantillas son prefijos que se usan al guardar grabaciones para organizar tus archivos automáticamente. Podés:

- **Agregar** una nueva plantilla (Enter o botón Agregar).
- **Editar** una existente (ícono de lápiz).
- **Eliminar** una plantilla (ícono de papelera, con confirmación).

Ejemplo: una plantilla `Entrevista` más el nombre `Juan` guarda la grabación como `26-09-2026 Entrevista Juan`.

---

## 6. ¿Cómo funciona la transcripción?

1. Subís un archivo de audio o video.
2. El backend lo **fracciona** en partes de aproximadamente 10 minutos.
3. Cada parte se envía al modelo **Whisper** (`whisper-large-v3`) de Groq con tu API key.
4. MIKIT une los fragmentos y detecta **silencios** para separar párrafos automáticamente.
5. El texto final mantiene las marcas de tiempo internas del modelo.

Si un fragmento falla (por ejemplo, por límite de uso), MIKIT **conserva el progreso**: une los fragmentos exitosos y te muestra el error en el texto final como una advertencia de *transcripción parcial*.

---

## 7. Dónde se guardan tus archivos

| Tipo de archivo | Destino |
| --- | --- |
| Grabación exportada | `Escritorio\nombre.mp3` |
| Grabaciones exportadas en lote | `Escritorio\MIKIT_Grabaciones_FECHA_HORA\*.mp3` |
| Transcripción exportada | `Escritorio\nombre.md` |
| Transcripciones exportadas en lote | `Escritorio\MIKIT_Transcripciones_FECHA_HORA\*.md` |

MIKIT resuelve la ruta real de tu Escritorio automáticamente (soporta redirección a OneDrive). Si ya existe un archivo con el mismo nombre, agrega un sufijo numérico: `nombre (1).md`, `nombre (2).md`, etc.

En la app de escritorio, los datos internos (historial, claves, plantillas) se guardan en `Documentos\MIKIT_Data`.

---

## 8. Solución de problemas

| Problema | Causa probable | Solución |
| --- | --- | --- |
| "No hay API Keys configuradas" | No agregaste una clave de Groq | Andá a **Configuración** y agregá tu clave (`gsk_...`). |
| "No se pudo acceder al micrófono" | El navegador no tiene permiso | Permití el acceso al micrófono cuando el navegador lo pida (o en la configuración del sitio). |
| Al transcribir siempre dice "esperando límite" | Tu clave gratuita alcanzó el límite de Groq | Esperá a que se libere o agregá más claves en Configuración para rotar. |
| La exportación falla | El backend no está corriendo | Verificá que el backend esté levantado (`python backend/main.py`). |
| El backend avisa que no encuentra `ffmpeg` | Falta FFmpeg en el PATH | Instalá FFmpeg y agregalo al PATH del sistema, o poné una carpeta `ffmpeg/` en la raíz del proyecto. |
| `ModuleNotFoundError: No module named 'backend'` | Se ejecutó el backend desde una carpeta equivocada | Ejecutalo desde la **raíz** del proyecto: `python backend/main.py`. |
| El puerto 8000 está ocupado | Otra app usa ese puerto | Cerrá la otra app o usá otra configuración de puerto. |

---

## 9. App de escritorio (Windows)

Si preferís usar MIKIT como aplicación de ventana nativa (sin navegador):

```bash
pip install pywebview
python launcher.py
```

La ventana se abre con la interfaz completa. Al cerrarla, el backend se detiene automáticamente y los datos quedan guardados en `Documentos\MIKIT_Data`.

---

*MIKIT es software libre bajo GNU GPL v3. Si te resulta útil, podés donar por Mercado Pago al alias **MP.PAGAR** (Pablo Nicolas Celaya Rios).*