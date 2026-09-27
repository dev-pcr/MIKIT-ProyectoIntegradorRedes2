import { useCallback, useRef, useState } from 'react';
import { Volume2, VolumeX, RotateCcw, TriangleAlert } from 'lucide-react';
import { NOISE_GATE_MIN_DB, NOISE_GATE_MAX_DB } from '../utils/preferences';

const SPAN = NOISE_GATE_MAX_DB - NOISE_GATE_MIN_DB;

const dbToPct = (db) => ((db - NOISE_GATE_MIN_DB) / SPAN) * 100;
const pctToDb = (pct) => NOISE_GATE_MIN_DB + (pct / 100) * SPAN;

const roundTo = (db, step = 1) => Math.round(db / step) * step;

function formatDb(db) {
  if (db <= NOISE_GATE_MIN_DB) return '-∞';
  return `${db > 0 ? '+' : ''}${Math.round(db)}`;
}

/**
 * Barra de nivel en vivo + umbral arrastrable de la puerta de ruido.
 *
 * El rango es dBFS de -60 (silencio) a 0 (clipping). Todo lo que quede
 * por debajo del umbral se dibuja atenuado a propósito: así se ve qué
 * está descartando la puerta, no sólo dónde está el corte.
 */
export default function NoiseGateControl({
  levelDb,
  thresholdDb,
  onThresholdChange,
  error = null,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const isConfigured = typeof thresholdDb === 'number';
  const thresholdPct = isConfigured ? dbToPct(thresholdDb) : 0;
  const levelPct = dbToPct(levelDb);

  // Si el umbral está por encima del nivel actual, la puerta está cerrada
  // para esa señal. Es el feedback más importante de la UI.
  const passing = isConfigured && levelDb >= thresholdDb;

  const setFromClientX = useCallback(
    (clientX) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      onThresholdChange(roundTo(pctToDb(pct)));
    },
    [onThresholdChange],
  );

  const handlePointerDown = (e) => {
    // Sólo el mango arrastrable captura el puntero; el resto de la barra
    // responde al click. Así se puede calibrar rápido sin histéresis.
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setFromClientX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setFromClientX(e.clientX);
  };

  const stopDragging = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const handleKeyDown = (e) => {
    const step = e.shiftKey ? 6 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onThresholdChange(roundTo((thresholdDb ?? NOISE_GATE_MIN_DB) - step));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onThresholdChange(roundTo((thresholdDb ?? NOISE_GATE_MIN_DB) + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onThresholdChange(NOISE_GATE_MIN_DB);
    } else if (e.key === 'End') {
      e.preventDefault();
      onThresholdChange(NOISE_GATE_MAX_DB);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {passing
            ? <Volume2 size={14} className="text-green-400" />
            : <VolumeX size={14} className="text-zinc-500" />}
          <span className="text-xs uppercase tracking-wider text-zinc-500">Puerta de ruido</span>
        </div>
        <span className="text-xs font-mono tabular-nums text-zinc-500">
          {isConfigured ? `umbral ${formatDb(thresholdDb)} dB` : 'sin calibrar'}
        </span>
      </div>

      {/* Pista: click para saltar, drag desde el mango para ajuste fino */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (e.target.dataset.handle) return;
          setFromClientX(e.clientX);
        }}
        className="relative h-9 w-full cursor-pointer select-none touch-none rounded-lg bg-zinc-900/60 ring-1 ring-inset ring-white/5"
      >
        {/* Señal por debajo del umbral: atenuada. Es lo que la puerta corta. */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg bg-zinc-700/50"
          style={{ width: `${Math.min(levelPct, thresholdPct)}%` }}
        />
        {/* Señal por encima del umbral: pasa, y se ve iluminada */}
        {levelPct > thresholdPct && (
          <div
            className={`absolute inset-y-0 rounded-l-none transition-colors ${
              levelPct > 92 ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ left: `${thresholdPct}%`, width: `${levelPct - thresholdPct}%` }}
          />
        )}

        {/* Umbral por defecto antes de calibrar */}
        {!isConfigured && (
          <div className="absolute inset-y-0 left-[30%] w-px bg-white/20" aria-hidden="true" />
        )}

        {isConfigured && (
          <div
            data-handle="1"
            role="slider"
            tabIndex={0}
            aria-label="Umbral de la puerta de ruido en decibeles"
            aria-valuemin={NOISE_GATE_MIN_DB}
            aria-valuemax={NOISE_GATE_MAX_DB}
            aria-valuenow={Math.round(thresholdDb)}
            aria-valuetext={`${formatDb(thresholdDb)} decibeles`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onKeyDown={handleKeyDown}
            className={`absolute -top-1 -bottom-1 -ml-3 w-6 flex items-center justify-center cursor-ew-resize touch-none outline-none ${
              dragging ? 'scale-105' : ''
            }`}
            style={{ left: `${thresholdPct}%` }}
          >
            <div
              className={`h-6 w-1.5 rounded-full ring-2 ring-zinc-950 transition-all ${
                dragging ? 'bg-white ring-white/40 shadow-lg shadow-black/50' : 'bg-brand-500 ring-zinc-950'
              }`}
            />
          </div>
        )}
      </div>

      {/* Escala */}
      <div className="flex justify-between text-[10px] font-mono text-zinc-600">
        <span>-60</span>
        <span>-40</span>
        <span>-20</span>
        <span>0 dB</span>
      </div>

      {error ? (
        <p className="flex items-start gap-2 text-xs text-amber-400">
          <TriangleAlert size={13} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      ) : !isConfigured ? (
        <p className="text-xs text-amber-400/90">
          Arrastrá el mango (o hacé click en la barra) para fijar desde qué nivel pasa el sonido.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          {passing
            ? 'Señal por encima del umbral: pasa.'
            : 'Señal por debajo del umbral: se descarta.'}
        </p>
      )}

      {isConfigured && (
        <button
          onClick={() => onThresholdChange(null)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
        >
          <RotateCcw size={11} />
          Recalibrar
        </button>
      )}
    </div>
  );
}
