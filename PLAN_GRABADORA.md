# Plan: Mejoras a la pantalla de Grabadora

**Estado:** Propuesto  
**Fecha:** 2026-09-24  
**Alcance:** 4 features sobre la pantalla de Grabadora, aprobadas por el usuario.

---

## Resumen

Mejorar la experiencia de grabación con ajustes **antes de grabar** (calidad, ganancia, noise gate) y **post-proceso** (normalización de volumen). El objetivo: grabar con configuración controlada para que el archivo final salga liviano y con buen nivel, sin depender de edición posterior.

---

## Features

### 1. Ganancia + medidor de niveles en vivo

| Ítem | Detalle |
|------|---------|
| Qué | Slider de ganancia (dB) + medidor de nivel en tiempo real antes de grabar |
| Cómo | Web Audio API: `AnalyserNode` leyendo el stream del mic en vivo |
| Aplicación | `GainNode` entre el mic y el `MediaRecorder`, con el slider seteado **antes** de pulsar grabar |
| Persistencia | localStorage (se recuerda el ajuste entre sesiones) |
| Meta visual | Picos entre -12 y -3 dBFS; color verde/amarillo/rojo según zona |

**Archivos:** `src/pages/Recorder.jsx` (UI + Web Audio graph), posible helper `src/utils/audioSetup.js`.

### 2. Calidad de audio (solo MP3)

| Ítem | Detalle |
|------|---------|
| Qué | Selector de bitrate pre-grabación: **Liviana (64kbps) / Media (96kbps) / Alta (192kbps)** |
| Alcance | SOLO MP3 (no WAV, no OGG) |
| Cómo | Se guarda en localStorage; se envía al backend en el `blob` de metadata del save |
| Backend | Parametrizar `bitrate` en `backend/utils/audio.py` (`process_and_split`) y `backend/main.py` (`/save_audio`) |
| Nota | El chunking de transcripción se mantiene en 64k: es para Groq, es aparte |

**Archivos:** `src/pages/Recorder.jsx`, `src/utils/api.js` (payload), `backend/main.py`, `backend/utils/audio.py`.

### 3. Noise gate (puerta de ruido interactiva)

| Ítem | Detalle |
|------|---------|
| Qué | Barra de nivel en vivo + línea de umbral deslizable ("puerta de ruido") |
| Comportamiento | Sonido por debajo del umbral se corta (silencio); por arriba pasa con ganancia 1 |
| En vivo (A) | DSP en `AudioWorklet` antes del `MediaRecorder`: se graba ya gateado |
| Post (B) | ffmpeg `agate` al exportar: más simple, pero se aplica al guardar |
| Recomendación | **A (en vivo)** — cumple "ajustar antes de grabar"; DSP de gate ~30 líneas (umbral, ataque, release) |
| Riesgo | Complejidad media: trabajador de audio custom, fallback si el browser no soporta AudioWorklet |

**Archivos:** `src/pages/Recorder.jsx` (UI del gate + slider), `src/utils/noiseGateProcessor.js` (AudioWorklet).

### 4. Normalizar volumen (reuso)

| Ítem | Detalle |
|------|---------|
| Qué | Sube el pico del audio a -0.1 dBFS automáticamente |
| Cómo | **Reuso 100%**: `pydub.effects.normalize(seg, headroom=0.1)` — ya confirmado que existe y funciona en el venv |
| Dónde | Backend, al exportar en `/save_audio` (post-grabación) |
| UI | Toggle "Normalizar volumen" (on/off), persiste en localStorage |
| Beneficio | Rescata grabaciones bajitas del mic Bluetooth de solapa |

**Archivos:** `backend/main.py` (`/save_audio`), `src/pages/Recorder.jsx` (toggle).

---

## Orden de implementación

1. **Ganancia + medidor** — base: el mismo `AnalyserNode` se reutiliza para el noise gate
2. **Normalizar volumen** — reuso puro de pydub, ~5 min
3. **Calidad MP3** — parametrizar backend + selector frontend
4. **Noise gate** — la más compleja, al final

---

## Riesgos y notas

- **AudioWorklet**: requiere HTTPS o localhost (en dev OK). Fallback: aplicar el gate con un script processor legacy o avisar al usuario.
- **Compatibilidad de bitrate**: 64k/96k/192k son soportados por pydub/ffmpeg sin problema (lame).
- **Normalización + noise gate juntos**: el gate opera en vivo (antes de grabar), la normalización en backend (después). No compiten.
- **A/B test del gate**: si el DSP custom falla, el plan B (ffmpeg `agate` en backend) cubre el 80% del caso de uso con menos riesgo.

---

## Checklist

- [ ] Ganancia + medidor en vivo (Web Audio)
- [ ] Persistencia localStorage (ganancia, bitrate, toggle normalizar, umbral gate)
- [ ] Selector calidad MP3 (64/96/192)
- [ ] Backend parametrizado con bitrate
- [ ] Normalizar volumen con pydub (reuso)
- [ ] Noise gate interactivo (AudioWorklet)
- [ ] Build + prueba E2E