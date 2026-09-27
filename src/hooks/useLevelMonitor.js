import { useEffect, useRef, useState } from 'react';
import { NOISE_GATE_MIN_DB, NOISE_GATE_MAX_DB } from '../utils/preferences';

// Convierte amplitud lineal (0..1) a dBFS. El piso de -60 dB es
// perceptualmente "silencio" y evita que el ruido de fondo empuje la
// barra contra el extremo izquierdo.
function linearToDb(rms) {
  if (rms <= 0.000001) return NOISE_GATE_MIN_DB;
  const db = 20 * Math.log10(rms);
  return Math.max(NOISE_GATE_MIN_DB, Math.min(NOISE_GATE_MAX_DB, db));
}

/**
 * Mide el nivel de entrada del micrófono sin reproducir sonido.
 *
 * Monta su propio MediaStream + AnalyserNode. No interfiere con el stream
 * que usa el grabador: son dos capturas independientes del mismo device.
 *
 * Devuelve el nivel instantáneo en dBFS. Se actualiza a ~20 Hz en vez de
 * 60 Hz porque el consumidor (barra del Recorder) no necesita más y un
 * setState por frame re-renderiza el componente padre entero.
 */
export function useLevelMonitor({ enabled, deviceId }) {
  const [levelDb, setLevelDb] = useState(NOISE_GATE_MIN_DB);
  const [error, setError] = useState(null);
  const lastEmittedRef = useRef(NOISE_GATE_MIN_DB);

  useEffect(() => {
    if (!enabled) {
      setLevelDb(NOISE_GATE_MIN_DB);
      lastEmittedRef.current = NOISE_GATE_MIN_DB;
      setError(null);
      return;
    }

    let cancelled = false;
    let rafId = null;
    let context = null;
    let stream = null;
    let lastEmit = 0;

    const constraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    };

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        context = new AudioCtx();
        // Algunos navegadores arrancan el contexto suspendido hasta que
        // hubo un gesto del usuario. Sin esto el AnalyserNode devuelve 0.
        if (context.state === 'suspended') {
          try { await context.resume(); } catch { /* se reintenta en el primer click */ }
        }

        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        // Sin conectar a destination: el monitor es sólo visual, no
        // reproduce nada. Eso es intencional (pedido explícito).

        const buffer = new Float32Array(analyser.fftSize);

        const tick = (now) => {
          if (cancelled) return;
          analyser.getFloatTimeDomainData(buffer);

          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
          const db = linearToDb(Math.sqrt(sum / buffer.length));

          // Throttle a ~20 Hz + umbral de histeresis para no re-renderizar
          // por ruido de un centésimo de dB. Se compara contra el ref del
          // último valor emitido, no contra `levelDb`: ese es un closure
          // viejo y daría una diferencia siempre grande.
          if (now - lastEmit > 50 && Math.abs(db - lastEmittedRef.current) > 0.5) {
            lastEmit = now;
            lastEmittedRef.current = db;
            setLevelDb(db);
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          setError(err?.name === 'NotAllowedError'
            ? 'Permiso de micrófono denegado. Habilitalo en el candado de la barra de direcciones.'
            : `No se pudo leer el micrófono: ${err?.message || err}`);
          setLevelDb(NOISE_GATE_MIN_DB);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (context && context.state !== 'closed') context.close().catch(() => {});
    };
    // `levelDb` NO va en las deps a propósito: incluirlo reiniciaría el
    // stream en cada actualización del nivel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, deviceId]);

  return { levelDb, error };
}
