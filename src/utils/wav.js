/**
 * Arma un WAV (PCM 16 bit, mono) a partir de paquetes de bytes crudos.
 * Portado de `btnSave.onclick` de grabador_ble.html.
 *
 * @param {Uint8Array[]} chunks   paquetes PCM int16 little-endian
 * @param {number} byteLength     suma de los largos de los paquetes
 * @param {number} sampleRate     frecuencia de muestreo en Hz
 * @returns {{ blob: Blob, durationSec: number, dataBytes: number }}
 */
export function pcm16ToWavBlob(chunks, byteLength, sampleRate = 16000) {
  // Una muestra son 2 bytes: si llegó un paquete cortado con un byte impar al
  // final, ese byte suelto se descarta para no desalinear el audio.
  const dataBytes = byteLength & ~1;

  const header = new DataView(new ArrayBuffer(44));
  const w = (offset, str) => {
    for (let i = 0; i < str.length; i++) header.setUint8(offset + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  header.setUint32(4, 36 + dataBytes, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  header.setUint32(16, 16, true);          // tamaño del bloque fmt
  header.setUint16(20, 1, true);           // formato PCM
  header.setUint16(22, 1, true);           // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // byte rate
  header.setUint16(32, 2, true);           // block align
  header.setUint16(34, 16, true);          // bits por muestra
  w(36, 'data');
  header.setUint32(40, dataBytes, true);

  // Si hay que recortar el byte impar, se corta sobre el último paquete.
  const parts = [header];
  let remaining = dataBytes;
  for (const c of chunks) {
    if (remaining <= 0) break;
    parts.push(c.length <= remaining ? c : c.subarray(0, remaining));
    remaining -= Math.min(c.length, remaining);
  }

  return {
    blob: new Blob(parts, { type: 'audio/wav' }),
    durationSec: dataBytes / (sampleRate * 2),
    dataBytes,
  };
}

