# MIKIT v1.0 — Transcriptor & Grabador

Este es el prototipo de alta fidelidad de **MIKIT**, una PWA para grabación de audio y transcripción inteligente.

## Tecnologías Utilizadas

- **Core**: React 18 + Vite
- **Estilo**: Tailwind CSS v3 (Refined Futurism Aesthetic)
- **Animaciones**: Framer Motion
- **Iconografía**: Lucide React
- **Tipografía**: Plus Jakarta Sans & Outfit (vía Google Fonts)

## Estructura del Proyecto

- `/src/pages/Home.jsx`: Dashboard principal con tarjetas interactivas.
- `/src/pages/Recorder.jsx`: Interfaz de grabación con visualizador y gestión de historial.
- `/src/pages/Transcriber.jsx`: Módulo de carga de archivos y previsualización de transcripciones.
- `/src/pages/Settings.jsx`: Gestión de API Keys (Groq) y plantillas de nombres.
- `/src/components/Layout.jsx`: Sistema de navegación lateral (Sidebar) con glassmorphism.

## Cómo Ejecutar (Desarrollo)

Para visualizar este proyecto localmente, asegúrate de tener **Node.js** instalado y sigue estos pasos:

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Abrir en el navegador la URL proporcionada (generalmente `http://localhost:5173`).

---

**Nota**: En esta etapa de diseño, la persistencia de datos (IndexedDB) y la integración real con la API de Groq están simuladas mediante estados de React y mock data.
