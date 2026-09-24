# MIKIT — Transcriptor & Grabador

**MIKIT** es un software libre de grabación de audio y transcripción inteligente con IA. Podés grabar desde la app, subir archivos de audio (sin límite de tamaño) y obtener transcripciones con marcas de tiempo, párrafos automáticos y exportación a `.md` y `.mp3` directamente en tu Escritorio.

Corre **100% en local** dentro del navegador: un doble clic y la app queda lista, sin instalar nada más que las dependencias del proyecto.

---

## Software libre y donaciones

**MIKIT es software libre y gratuito**, distribuido bajo la licencia **GNU GPL v3** (ver [`LICENSE`](LICENSE)). Cualquiera puede descargarlo, usarlo, estudiarlo, modificarlo y compartirlo; cualquier versión derivada también debe ser libre. El desarrollo es artesanal y lleva tiempo, así que si MIKIT te resulta útil, cualquier aporte es bienvenido.

Podés donar a través de Mercado Pago al alias **MP.PAGAR**, a nombre de **Pablo Nicolas Celaya Rios**. ¡Gracias por apoyar el proyecto!

---

## Arquitectura

MIKIT es un **monolito local**: el frontend y el backend corren en la misma máquina y, en uso normal, se sirven desde **un solo puerto** (`http://127.0.0.1:8000`).

```
┌────────────────────────────────────────────────────────────┐
│                    Navegador (localhost)                   │
│                                                            │
│   React (dist/)  ──►  http://127.0.0.1:8000               │
│        │                        │                          │
│        └──────────┬─────────────┘                          │
│                   ▼                                        │
│   FastAPI (backend/main.py)                                │
│     • Sirve el frontend compilado (dist/)                  │
│     • /transcribe  → streaming SSE → Groq (whisper-large)  │
│     • /save_md     → exporta .md al Escritorio             │
│     • /save_audio  → exporta .mp3 al Escritorio            │
│     • Rotación de API keys ante rate limits                │
└────────────────────────────────────────────────────────────┘
```

### Frontend (React + Vite)

- Páginas: **Home**, **Grabadora**, **Transcriptor**, **Configuración** (React Router con sidebar persistente).
- La Grabación usa `MediaRecorder` y guarda en **IndexedDB** (historial local del navegador).
- El Transcriptor consume el backend por **streaming (SSE)** y muestra el progreso en vivo.
- `npm run build` compila todo en `dist/` (minificado y con hash para caché).

### Backend (FastAPI)

- Sirve el frontend compilado (`dist/`) con SPA fallback — por eso todo vive en un solo puerto.
- **`/transcribe`**: recibe el audio, lo fracciona (máx. 10 min por parte, cortando por silencio), lo envía a Groq (`whisper-large-v3`) con rotación automática de API keys, y devuelve líneas JSON en streaming.
- **Párrafos automáticos**: detecta silencios de 1.5 s para armar transcripciones legibles.
- **`/save_md`** y **`/save_audio`**: exportan transcripciones y grabaciones al **Escritorio** real del usuario (resuelve la ruta automáticamente, incluso con redirección a OneDrive).
- Requiere **FFmpeg** para procesar audio.

### Persistencia

Los datos viven en la PC donde corre la app, **nunca en el repositorio**:

| Dato | Dónde se guarda |
|---|---|
| Grabaciones (historial) | IndexedDB del navegador |
| API keys y plantillas | localStorage del navegador |
| Exportaciones (`.md` / `.mp3`) | Escritorio del usuario |

Esto mantiene el git liviano y permite que cada persona use el proyecto con sus propios datos: se clona, se ejecuta y listo.

---

## Requisitos previos

- **Windows** (el launcher es un `.bat`).
- **Python** 3.10 o superior.
- **Node.js** 18 o superior.
- **FFmpeg** en el `PATH` (o en una carpeta `ffmpeg/` en la raíz del proyecto).
- **API key de Groq** (gratuita en [console.groq.com](https://console.groq.com)).

## Cómo usar el programa

### Arranque rápido (recomendado)

Doble clic en **`iniciar.bat`** (en la raíz del proyecto). El script:

1. Instala dependencias si falta alguna (venv de Python + `npm install`).
2. Compila el frontend si no existe `dist/` (`npm run build`).
3. Levanta el backend en `http://127.0.0.1:8000`.
4. Abre el navegador con MIKIT listo.

> Si el puerto 8000 está ocupado, el script lo detecta y avisa. Para cerrar, cerrá la consola (o Ctrl+C) — el script se encarga de no dejar procesos colgados.

### Configurar la API Key (primera vez)

- En la app: entrá a **Configuración** y pegá tu API key de Groq. Podés cargar varias: MIKIT las rota automáticamente ante límites de uso.

### Qué podés hacer

1. **Grabar** un audio desde la Grabadora (queda en el historial del navegador).
2. **Transcribir** ese audio o subir cualquier archivo desde el Transcriptor.
3. **Exportar** el resultado como `.md` y el audio como `.mp3` — caen en tu **Escritorio** (opcionalmente en una carpeta con nombre).

### Modo desarrollo (para tocar código)

En dos terminales, desde la raíz:

```bash
# Terminal 1 — backend
python backend/main.py

# Terminal 2 — frontend (Vite con hot reload)
npm install
npm run dev
```

Abrí la URL que muestra Vite (generalmente `http://localhost:5173`). El frontend en dev usa CORS para hablar con el backend en el puerto 8000.

---

## Estructura del proyecto

```
├── iniciar.bat           # Launcher del prototipo (arranque local)
├── backend/
│   ├── main.py           # API FastAPI: /transcribe, /save_md, /save_audio
│   ├── utils/audio.py    # Fraccionamiento y normalización de audio
│   └── requirements.txt  # Dependencias Python
├── src/                  # Frontend React
│   ├── pages/            # Home, Recorder, Transcriber, Settings
│   ├── components/       # Layout (sidebar) y UI
│   └── utils/            # api, storage (IndexedDB), preferences
├── public/               # Assets públicos (logo, favicon)
├── dist/                 # Frontend compilado (generado, no se commitea)
├── MANUAL.md             # Manual de usuario completo
├── Especificaciones.md   # Especificaciones técnicas y funcionales
└── PLAN_PROTOTIPO_LOCAL.md  # Plan de conversión a prototipo local
```

## Configuración y solución de problemas

**FFmpeg no encontrado**
Asegurate de tener `ffmpeg` en el `PATH` o la carpeta `backend/ffmpeg/` con el binario dentro.

**Frontend no carga en el navegador**
Verificá que el backend esté corriendo en `http://127.0.0.1:8000` y que el puerto no esté ocupado por otro proceso.

**Límite de uso de Groq (rate limit)**
MIKIT rota automáticamente entre las keys configuradas (con un enfriamiento de 30 s tras un 429). Cargá varias keys en Configuración para transcribir audios largos sin interrupciones.

**Audios largos**
El backend los fracciona en partes de hasta 10 minutos y transcribe cada parte por separado, cortando en silencios para no partir palabras.

---

## Documentación

- [`MANUAL.md`](MANUAL.md) — manual de usuario completo, pantalla por pantalla.
- [`Especificaciones.md`](Especificaciones.md) — especificaciones técnicas y funcionales del sistema.
- [`PLAN_PROTOTIPO_LOCAL.md`](PLAN_PROTOTIPO_LOCAL.md) — plan de conversión a prototipo local (navegador + `.bat`).