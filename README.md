# MIKIT — Transcriptor & Grabadora

**MIKIT** es un software libre de grabación de audio y procesamiento de texto con IA. Podés grabar desde el app, transcribir archivos de audio (sin límite de tamaño) y obtener resultados en Markdown, exportándolos a tu Escritorio.

Corre **100% en local** dentro del navegador: un doble clic y la app queda lista.

---

## Software libre y donaciones

**MIKIT es software libre y gratuito**, distribuido bajo la licencia **GNU GPL v3** (ver [`LICENSE`](LICENSE)). Cualquiera puede descargarlo, usarlo, estudiarlo, modificarlo y compartirlo; cualquier versión derivada también debe ser libre. El desarrollo es artesanal y lleva tiempo, así que si MIKIT te resulta útil, cualquier aporte es bienvenido.

Podés donar a través de Mercado Pago al alias **MP.PAGAR**, a nombre de **Pablo Nicolas Celaya Rios**. ¡Gracias por apoyar el proyecto!

---

## Documentación

Cada documento es dueño de un tipo de información. Si buscás algo y no está en el que estás mirando, es por diseño:

| Documento | Dueño de | Para quién |
|---|---|---|
| [`MANUAL.md`](MANUAL.md) | **Cómo se usa** la app, pantalla por pantalla, y **solución de problemas** | Quien usa MIKIT |
| [`Especificaciones.md`](Especificaciones.md) | **Comportamiento técnico**: endpoints, parámetros, esquemas de datos, algorithms | Quien toca el código |
| Este `README` | **Identidad, requisitos e instalación** | Quien decide si lo clona |

---

## Arquitectura

MIKIT es un **monolito local**: el frontend y el backend corren en la misma máquina y se sirven desde **un solo puerto** (`http://127.0.0.1:8000`).

```
┌──────────────────────────────────────────────────────────────┐
│                    Navegador (localhost)                     │
│                                                              │
│   React (dist/)  ──►  http://127.0.0.1:8000                 │
│        │                        │                            │
│        └──────────┬─────────────┘                            │
│                   ▼                                          │
│   FastAPI (backend/main.py)                                  │
│     • Sirve el frontend compilado (dist/)                    │
│     • /transcribe    → streaming SSE → Groq (whisper-large) │
│     • /process_text  → streaming SSE → OpenRouter            │
│     • /save_md       → exporta .md al Escritorio             │
│     • /save_audio    → exporta .mp3 al Escritorio            │
└──────────────────────────────────────────────────────────────┘
```

**Dos motores de IA, pools de claves separados:**

| Función | Proveedor | Para qué |
|---|---|---|
| Transcriptor | **Groq** (`whisper-large-v3`) | Audio → texto con marcas de tiempo |
| Procesar con IA | **OpenRouter** (`openrouter/auto`) | Texto → texto (resumir, corregir, analizar) |

Son independientes: podés usar uno sin el otro. Groq rota claves automáticamente ante rate limits; OpenRouter no rota, pero acepta varias y elige la activa.

### Frontend (React + Vite)

Seis páginas con sidebar persistente:

| Página | Ruta |
|---|---|
| Inicio | `/` |
| Grabadora | `/grabadora` |
| Transcriptor | `/transcriptor` |
| Historial | `/historial` |
| Procesar con IA | `/procesar-ia` |
| Configuración | `/configuracion` |

La Grabación usa `MediaRecorder` y guarda en **IndexedDB**. La transcripción y el procesado de texto consumen el backend por **streaming (SSE)**. `npm run build` compila todo en `dist/` (minificado y con hash para caché).

### Backend (FastAPI)

Sirve el frontend compilado (`dist/`) con SPA fallback — por eso todo vive en un solo puerto. Procesa audio con **pydub + FFmpeg**, y expone streaming real (no buffereado) en las dos rutas de IA.

Los detalles de chunking, rotación de claves y esquemas de almacenamiento están en [`Especificaciones.md`](Especificaciones.md).

### Persistencia

Los datos viven en la PC donde corre la app, **nunca en el repositorio**:

| Dato | Dónde se guarda |
|---|---|
| Grabaciones y karaokes | IndexedDB del navegador |
| Claves de API y plantillas | localStorage del navegador |
| Exportaciones (`.md` / `.mp3`) | Escritorio del usuario |

---

## Requisitos previos

- **Windows** (el launcher es un `.bat`).
- **Python** 3.10 o superior.
- **Node.js** 18 o superior.
- **FFmpeg**: en el `PATH`, o en una carpeta `ffmpeg/` en la **raíz del proyecto** (esa carpeta está en `.gitignore`; es un drop-in local, no se commitea).
- **API key de Groq** — para transcribir audio ([console.groq.com](https://console.groq.com), gratis).
- **API key de OpenRouter** — solo si vas a usar **Procesar con IA** ([openrouter.ai](https://openrouter.ai)).

## Cómo usar el programa

### Arranque rápido (recomendado)

Doble clic en **`iniciar.bat`** (en la raíz del proyecto). El script:

1. Verifica que existan Python, Node y `curl`.
2. Crea el entorno virtual de Python e instala `backend/requirements.txt` (solo la primera vez).
3. Instala las dependencias de Node (`npm install`, solo la primera vez).
4. Compila el frontend si no existe `dist/` (`npm run build`).
5. Verifica que el puerto 8000 esté libre, levanta el backend y abre el navegador.

> Para detener: Ctrl+C o cerrá la ventana. El script detecta solo cuando el backend se cae.

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

> Ojo: en modo dev el backend **no** sirve el `dist/`, y `/process_text` sí necesita la carpeta raíz accesible (corre desde la raíz del proyecto).

---

## Estructura del proyecto

```
├── iniciar.bat           # Launcher: instala, compila y levanta todo
├── backend/
│   ├── main.py           # API FastAPI + serving del frontend
│   ├── utils/audio.py    # Fraccionamiento y normalización de audio
│   └── requirements.txt  # Dependencias Python
├── src/                  # Frontend React
│   ├── pages/            # Home, Recorder, Transcriber, History, AIProcessor, Settings
│   ├── components/       # Layout.jsx (sidebar + estado del backend)
│   └── utils/            # api.js, storage.js (IndexedDB), preferences.js (localStorage)
├── public/               # Assets públicos (LOGO.png)
├── ffmpeg/               # Drop-in opcional de FFmpeg (no se commitea)
├── dist/                 # Frontend compilado (generado)
├── venv/                 # Entorno virtual de Python (generado)
├── node_modules/         # Dependencias de Node (generado)
├── MANUAL.md             # Manual de usuario + solución de problemas
└── Especificaciones.md   # Comportamiento técnico
```

## Configuración y solución de problemas

Si algo no funciona, la tabla deoubleshooting está en
[`MANUAL.md`](MANUAL.md#9-solución-de-problemas) — es el único lugar donde se
mantiene, para que no se desincronice del resto de la documentación.
