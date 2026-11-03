/**
 * Micrófono ESP32 por Bluetooth Low Energy (Web Bluetooth).
 * Flujo y UUID tomados de grabador_ble.html.
 *
 * El ESP32 expone un servicio GATT con dos características:
 *   - AUDIO (notify): paquetes PCM int16 little-endian, mono.
 *   - CTRL  (write sin respuesta): [1] = empezar a transmitir, [0] = parar.
 */

export const BLE_SERVICE = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_AUDIO_CHAR = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const BLE_CTRL_CHAR = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const BLE_SAMPLE_RATE = 16000;

/** Web Bluetooth sólo existe en Chrome/Edge y en contextos seguros (localhost/HTTPS). */
export const isBleSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.bluetooth;

/** Error que indica que el usuario cerró el selector sin elegir dispositivo. */
export const isUserCancel = (err) => err?.name === 'NotFoundError' && /cancel/i.test(err?.message || '');

/** Traduce los errores de Web Bluetooth a un mensaje útil para el usuario. */
export function describeBleError(err) {
  if (err?.name === 'SecurityError') {
    return 'El navegador bloqueó Bluetooth. Abrí la app desde localhost o HTTPS.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No se encontró el micrófono ESP32. Verificá que esté encendido y cerca.';
  }
  if (err?.name === 'NetworkError') {
    return 'No se pudo conectar con el ESP32. Reintentá acercándolo.';
  }
  return `No se pudo conectar: ${err?.message || err}`;
}

/** Nivel RMS normalizado (0..1) de un paquete PCM int16. */
export function chunkRms(bytes) {
  const n = bytes.byteLength >> 1;
  if (!n) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = view.getInt16(i * 2, true);
    sum += s * s;
  }
  return Math.sqrt(sum / n) / 32768;
}

export class BleMic {
  constructor() {
    this.device = null;
    this.ctrl = null;
    this.audio = null;
    this._onChunk = null;
    this._onDisconnect = null;
    this._handleValue = (e) => {
      const dv = e.target.value;
      // Copia: el buffer del evento puede reutilizarse después.
      const copy = new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
      this._onChunk?.(copy);
    };
    this._handleDisconnect = () => this._onDisconnect?.();
  }

  get deviceName() {
    return this.device?.name || 'ESP32';
  }

  get connected() {
    return !!this.device?.gatt?.connected;
  }

  /** Debe llamarse desde un click: requestDevice exige gesto del usuario. */
  async connect({ onChunk, onDisconnect }) {
    this._onChunk = onChunk;
    this._onDisconnect = onDisconnect;
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE] }],
      });
      this.device.addEventListener('gattserverdisconnected', this._handleDisconnect);
      const server = await this.device.gatt.connect();
      const svc = await server.getPrimaryService(BLE_SERVICE);
      this.ctrl = await svc.getCharacteristic(BLE_CTRL_CHAR);
      this.audio = await svc.getCharacteristic(BLE_AUDIO_CHAR);
      this.audio.addEventListener('characteristicvaluechanged', this._handleValue);
      await this.audio.startNotifications();
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  /** Pide al ESP32 que empiece a transmitir audio. */
  async start() {
    await this.ctrl.writeValueWithoutResponse(new Uint8Array([1]));
  }

  /** Pide al ESP32 que pare. Si la conexión ya se perdió no es un error. */
  async stop() {
    try {
      await this.ctrl?.writeValueWithoutResponse(new Uint8Array([0]));
    } catch { /* ya desconectado */ }
  }

  /** Idempotente: se puede llamar varias veces y también desmontado. */
  disconnect() {
    const { device, audio } = this;
    this.device = null;
    this.ctrl = null;
    this.audio = null;
    try { audio?.removeEventListener('characteristicvaluechanged', this._handleValue); } catch { /* noop */ }
    if (device) {
      try { device.removeEventListener('gattserverdisconnected', this._handleDisconnect); } catch { /* noop */ }
      try { if (device.gatt?.connected) device.gatt.disconnect(); } catch { /* noop */ }
    }
  }
}

