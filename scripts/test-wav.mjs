// Test del encoder WAV usado por la grabadora BLE (src/utils/wav.js) y del
// cálculo de nivel de bleMic.js. No necesita hardware: simula los paquetes
// que mandaría el ESP32 con un seno sintético.
//
// Uso: node scripts/test-wav.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

// Los módulos son ESM dentro de src/: se empaquetan a CJS para requirearlos.
const dir = mkdtempSync(join(process.cwd(), '.smoke-'));
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

async function load(entry, name) {
  const r = await build({ entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node' });
  const out = join(dir, name);
  writeFileSync(out, r.outputFiles[0].text);
  return createRequire(import.meta.url)(out);
}

const { pcm16ToWavBlob } = await load('src/utils/wav.js', 'wav.cjs');
const { chunkRms } = await load('src/utils/bleMic.js', 'ble.cjs');

let failed = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${msg}`);
  if (!cond) failed++;
};

// 1 s de seno 440 Hz a 16 kHz, int16 little-endian, partido en paquetes de
// tamaños irregulares (incluye uno impar: el último byte suelto se descarta).
const SR = 16000;
const samples = new Int16Array(SR);
for (let i = 0; i < SR; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / SR) * 16000);
const bytes = new Uint8Array(samples.buffer);
const sizes = [244, 244, 100, 512, 1];
const chunks = [];
let off = 0, k = 0;
while (off < bytes.length) {
  const n = Math.min(sizes[k++ % sizes.length], bytes.length - off);
  chunks.push(bytes.slice(off, off + n));
  off += n;
}
const total = chunks.reduce((s, c) => s + c.length, 0);

const { blob, durationSec, dataBytes } = pcm16ToWavBlob(chunks, total, SR);
const buf = new DataView(await blob.arrayBuffer());
const str = (o, n) => String.fromCharCode(...Array.from({ length: n }, (_, i) => buf.getUint8(o + i)));

check(blob.type === 'audio/wav', 'tipo MIME audio/wav');
check(str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE', 'cabecera RIFF/WAVE');
check(str(12, 4) === 'fmt ' && str(36, 4) === 'data', 'bloques fmt y data');
check(buf.getUint16(20, true) === 1, 'formato PCM');
check(buf.getUint16(22, true) === 1, 'mono');
check(buf.getUint32(24, true) === SR, 'sample rate 16000');
check(buf.getUint32(28, true) === SR * 2, 'byte rate');
check(buf.getUint16(34, true) === 16, '16 bits por muestra');
check(dataBytes === total && buf.getUint32(40, true) === total, `tamaño de datos = ${total} bytes`);
check(buf.getUint32(4, true) === 36 + total, 'tamaño RIFF = 36 + datos');
check(buf.byteLength === 44 + total, 'tamaño total del archivo = 44 + datos');
check(Math.abs(durationSec - 1) < 1e-9, 'duración 1.000 s');
check(buf.getInt16(44 + 2 * 100, true) === samples[100], 'las muestras quedan intactas');

// Longitud impar: se recorta a par y el header lo refleja.
const odd = pcm16ToWavBlob([new Uint8Array([1, 2, 3])], 3, SR);
const oddBuf = new DataView(await odd.blob.arrayBuffer());
check(odd.dataBytes === 2 && oddBuf.byteLength === 46 && oddBuf.getUint32(40, true) === 2, 'byte impar descartado');

// Vacío: header válido sin datos.
const empty = pcm16ToWavBlob([], 0, SR);
check(empty.blob.size === 44 && empty.durationSec === 0, 'grabación vacía = solo header');

// Nivel RMS: seno de amplitud 16000/32768 → RMS ≈ 0.345; silencio = 0.
check(Math.abs(chunkRms(bytes) - (16000 / 32768) / Math.SQRT2) < 0.005, 'RMS del seno ≈ 0.345');
check(chunkRms(new Uint8Array(64)) === 0, 'RMS del silencio = 0');
check(chunkRms(new Uint8Array(0)) === 0, 'RMS de paquete vacío = 0');
// Un paquete con byteOffset distinto de 0 no debe desalinearse.
check(Math.abs(chunkRms(bytes.subarray(2, 202)) - (16000 / 32768) / Math.SQRT2) < 0.05, 'RMS con byteOffset ≠ 0');

// --- BleMic contra un ESP32 simulado (Web Bluetooth falso) ---
{
  const { BleMic, BLE_SERVICE, BLE_AUDIO_CHAR, BLE_CTRL_CHAR, describeBleError, isUserCancel } = await load('src/utils/bleMic.js', 'ble2.cjs');
  const writes = [];
  const listeners = { audio: {}, device: {} };
  let notifying = false, gattConnected = false, requested = null;
  const audioChar = {
    addEventListener: (t, f) => { listeners.audio[t] = f; },
    removeEventListener: (t) => { delete listeners.audio[t]; },
    startNotifications: async () => { notifying = true; },
  };
  const ctrlChar = { writeValueWithoutResponse: async (v) => { writes.push(Array.from(v)); } };
  const device = {
    name: 'Micro-Clases',
    addEventListener: (t, f) => { listeners.device[t] = f; },
    removeEventListener: (t) => { delete listeners.device[t]; },
    gatt: {
      get connected() { return gattConnected; },
      connect: async () => {
        gattConnected = true;
        return { getPrimaryService: async (u) => ({ getCharacteristic: async (c) => (c === BLE_AUDIO_CHAR ? audioChar : ctrlChar) }) };
      },
      disconnect: () => { gattConnected = false; },
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { bluetooth: { requestDevice: async (o) => { requested = o; return device; } } },
    configurable: true, writable: true,
  });

  const got = [];
  let disconnects = 0;
  const mic = new BleMic();
  await mic.connect({ onChunk: (c) => got.push(c), onDisconnect: () => disconnects++ });

  check(requested.filters[0].services[0] === BLE_SERVICE, 'requestDevice filtra por el UUID de servicio');
  check(mic.connected && notifying && mic.deviceName === 'Micro-Clases', 'conecta y activa notificaciones');

  await mic.start();
  check(JSON.stringify(writes) === '[[1]]', 'start() escribe [1] en CTRL');

  // El buffer del evento se reutiliza: el paquete entregado tiene que ser una copia.
  const shared = new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]);
  listeners.audio.characteristicvaluechanged({
    target: { value: new DataView(shared.buffer, 2, 4) },
  });
  shared.fill(99);
  check(got.length === 1 && got[0].length === 4 && got[0][0] === 2 && got[0][2] === 3, 'paquete copiado (respeta byteOffset y no se pisa)');

  await mic.stop();
  check(JSON.stringify(writes) === '[[1],[0]]', 'stop() escribe [0] en CTRL');

  listeners.device.gattserverdisconnected();
  check(disconnects === 1, 'desconexión inesperada notificada');

  mic.disconnect(); mic.disconnect();
  check(!gattConnected && !listeners.audio.characteristicvaluechanged && !listeners.device.gattserverdisconnected, 'disconnect() idempotente y sin listeners colgados');
  await mic.stop(); // sin conexión no debe tirar
  check(true, 'stop() sin conexión no tira');

  // Errores
  const cancel = Object.assign(new Error('User cancelled the requestDevice() chooser.'), { name: 'NotFoundError' });
  check(isUserCancel(cancel), 'cancelar el selector se reconoce como cancelación');
  check(!isUserCancel(Object.assign(new Error('Device not found'), { name: 'NotFoundError' })), 'dispositivo no encontrado NO es cancelación');
  check(describeBleError(Object.assign(new Error('x'), { name: 'SecurityError' })).includes('localhost'), 'mensaje de SecurityError menciona localhost/HTTPS');
}

if (failed) {
  console.log(`\n[test-wav] ${failed} verificación(es) fallaron`);
  process.exit(1);
}
console.log('\n[test-wav] OK');
