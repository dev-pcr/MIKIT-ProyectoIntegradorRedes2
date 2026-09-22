# MIKIT — Transcriptor & Grabador

**MIKIT** es un software libre de grabación de audio y transcripción inteligente con IA. Podés grabar desde la app, subir archivos de audio (sin límite de tamaño) y obtener transcripciones con marcas de tiempo, párrafos automáticos y exportación a `.md` y `.mp3` directamente en tu Escritorio.

Funciona como aplicación web (PWA) y como app de escritorio para Windows.

---

## Software libre y donaciones

**MIKIT es software libre y gratuito**, distribuido bajo la licencia **GNU GPL v3** (ver [`LICENSE`](LICENSE)). Cualquiera puede descargarlo, usarlo, estudiarlo, modificarlo y compartirlo; cualquier versión derivada también debe ser libre. El desarrollo es artesanal y lleva tiempo, así que si MIKIT te resulta útil, cualquier aporte es bienvenido.

Podés donar a través de Mercado Pago al alias **MP.PAGAR**, a nombre de **Pablo Nicolas Celaya Rios**. ¡Gracias por apoyar el proyecto!

---

## Características

- **Grabadora** con visualizador en tiempo real, historial y plantillas de nombres.
- **Transcriptor** de audio con IA (Groq `whisper-large-v3`), con progreso en vivo.
- **Audios largos sin límite de tamaño**: el backend fracciona el audio y lo transcribe por partes.
- **Rotación de API Keys**: si tenés varias claves de Groq, MIKIT las rota automáticamente ante límites de uso (rate limits) para no interrumpirse.
- **Párrafos automáticos** basados en silencios (1.5s) para transcripciones legibles.
- **Exportación** a Markdown (`.md`) y MP3 (22050 Hz, 96 kbps) en el Escritorio, con exportación masiva del historial.
- **Configuración** de API Keys y plantillas de nombres desde la propia app.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Lucide React |
| Backend | Python, FastAPI, Uvicorn, Groq SDK, pydub |
| Escritorio | PyWebView (wrapper opcional) |

## Estructura del proyecto

```
├── src/                  # Frontend React
│   ├── pages/            # Home, Recorder, Transcriber, Settings
│   ├── components/       # Layout (sidebar) y UI
│   └── utils/            # api, storage (IndexedDB), preferences
├── backend/
│   ├── main.py           # API FastAPI: /transcribe, /save_md, /save_audio
│   ├── utils/audio.py    # Fraccionamiento y normalización de audio
│   └── requirements.txt  # Dependencias Python
├── public/               # Assets públicos (logo, favicon)
├── launcher.py           # App de escritorio (PyWebView)
└── Especificaciones.md   # Documento de especificaciones del sistema
```

## Requisitos previos

- **Node.js** 18 o superior
- **Python** 3.10 o superior
- **FFmpeg** en el `PATH` (o en una carpeta `ffmpeg/` en la raíz del proyecto) — necesario para procesar audio
- **API key de Groq** (gratuita en [console.groq.com](https://console.groq.com))

## Cómo ejecutar en desarrollo

Necesitás dos terminales: una para el backend y otra para el frontend.

### 1. Backend (API)

Desde la raíz del proyecto:

```bash
python -m venv venv
```

- Windows:
  ```bash
  venv\Scripts\activate
  ```
- Linux / macOS:
  ```bash
  source venv/bin/activate
  ```

Luego:

```bash
pip install -r backend/requirements.txt
python backend/main.py
```

La API queda disponible en `http://127.0.0.1:8000`.

### 2. Frontend (interfaz web)

En otra terminal, desde la raíz del proyecto:

```bash
npm install
npm run dev
```

Abrí la URL que muestra Vite (generalmente `http://localhost:5173`).

### 3. Configurar la API Key

- En la app: entrá a **Configuración** y pegá tu API key de Groq (podés agregar varias para que MIKIT rote entre ellas).
- Alternativa: creá un archivo `.env` en la raíz con `GROQ_API_KEY=tu_clave`.

## Ejecutar en modo producción

Construís el frontend y el backend sirve todo en un solo puerto:

```bash
npm run build
python backend/main.py
```

Abrí `http://127.0.0.1:8000` — MIKIT completo (frontend + API) en una sola URL.

## App de escritorio (Windows, opcional)

```bash
pip install pywebview
python launcher.py
```

Esto abre MIKIT en una ventana nativa de escritorio. Los datos (historial, API keys) se guardan en `Documentos\MIKIT_Data`.

## Dónde se guardan los archivos

Las transcripciones (`.md`) y grabaciones (`.mp3`) se exportan al **Escritorio** de tu usuario, opcionalmente dentro de una carpeta. MIKIT resuelve la ruta real del Escritorio automáticamente (soporta redirección a OneDrive).

## Documentación

- [`MANUAL.md`](MANUAL.md) — manual de usuario completo, pantalla por pantalla.
- [`Especificaciones.md`](Especificaciones.md) — especificaciones técnicas y funcionales del sistema.