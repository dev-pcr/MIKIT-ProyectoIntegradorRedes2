/**
 * Procesador de audio en tiempo real para grabación.
 * Interpola un AudioWorklet (con fallback a ScriptProcessor) con puerta de ruido
 * entre el MediaStream del micrófono y el MediaRecorder.
 */

const NOISE_GATE_WORKLET_CODE = `
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    this.thresholdDb = typeof opts.thresholdDb === 'number' ? opts.thresholdDb : -45;
    this.threshold = Math.pow(10, this.thresholdDb / 20);
    this.attack = opts.attack || 0.010;   // 10ms attack (apertura rápida)
    this.hold = opts.hold || 0.060;       // 60ms hold (evita cortes entre consonantes)
    this.release = opts.release || 0.120; // 120ms release (caída suave sin clicks)
    this.currentGain = 0;
    this.holdCounter = 0;

    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.thresholdDb === 'number') {
        this.thresholdDb = event.data.thresholdDb;
        this.threshold = Math.pow(10, this.thresholdDb / 20);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const numChannels = input.length;
    const blockSize = input[0].length;
    const sampleRate = globalThis.sampleRate || 48000;

    // Calcular RMS en el bloque actual
    let sumSquares = 0;
    for (let c = 0; c < numChannels; c++) {
      const channel = input[c];
      for (let i = 0; i < blockSize; i++) {
        sumSquares += channel[i] * channel[i];
      }
    }
    const rms = Math.sqrt(sumSquares / (numChannels * blockSize));

    // Determinar ganancia objetivo
    let targetGain = 0;
    if (rms >= this.threshold) {
      targetGain = 1.0;
      this.holdCounter = Math.floor(this.hold * sampleRate);
    } else if (this.holdCounter > 0) {
      targetGain = 1.0;
      this.holdCounter -= blockSize;
    } else {
      targetGain = 0.0;
    }

    const attackCoeff = 1.0 - Math.exp(-1.0 / (Math.max(0.001, this.attack) * sampleRate));
    const releaseCoeff = 1.0 - Math.exp(-1.0 / (Math.max(0.001, this.release) * sampleRate));

    for (let i = 0; i < blockSize; i++) {
      const coeff = targetGain > this.currentGain ? attackCoeff : releaseCoeff;
      this.currentGain += (targetGain - this.currentGain) * coeff;

      if (this.currentGain < 0.0001) this.currentGain = 0;
      else if (this.currentGain > 0.9999) this.currentGain = 1;

      for (let c = 0; c < numChannels; c++) {
        if (output[c]) {
          output[c][i] = input[c][i] * this.currentGain;
        }
      }
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
`;

/**
 * Crea el nodo de compuerta de ruido en el AudioContext.
 */
export async function createNoiseGateNode(audioContext, thresholdDb) {
  if (audioContext.audioWorklet && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof AudioWorkletNode !== 'undefined') {
    try {
      const blob = new Blob([NOISE_GATE_WORKLET_CODE], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);
      return new AudioWorkletNode(audioContext, 'noise-gate-processor', {
        processorOptions: { thresholdDb },
      });
    } catch (e) {
      console.warn('AudioWorklet no disponible, recurriendo a fallback:', e);
    }
  }

  // Fallback con ScriptProcessorNode
  const bufferSize = 2048;
  const scriptNode = audioContext.createScriptProcessor
    ? audioContext.createScriptProcessor(bufferSize, 2, 2)
    : null;

  if (!scriptNode) {
    return audioContext.createGain ? audioContext.createGain() : null;
  }

  let currentThreshold = Math.pow(10, thresholdDb / 20);
  let currentGain = 0;
  let holdCounter = 0;
  const attack = 0.010;
  const hold = 0.060;
  const release = 0.120;
  const sampleRate = audioContext.sampleRate || 48000;
  const attackCoeff = 1.0 - Math.exp(-1.0 / (attack * sampleRate));
  const releaseCoeff = 1.0 - Math.exp(-1.0 / (release * sampleRate));

  scriptNode.onaudioprocess = (e) => {
    const inputBuffer = e.inputBuffer;
    const outputBuffer = e.outputBuffer;
    const numChannels = inputBuffer.numberOfChannels;
    const length = inputBuffer.length;

    let sumSquares = 0;
    for (let c = 0; c < numChannels; c++) {
      const data = inputBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        sumSquares += data[i] * data[i];
      }
    }
    const rms = Math.sqrt(sumSquares / (numChannels * length));

    let targetGain = 0;
    if (rms >= currentThreshold) {
      targetGain = 1.0;
      holdCounter = Math.floor(hold * sampleRate);
    } else if (holdCounter > 0) {
      targetGain = 1.0;
      holdCounter -= length;
    } else {
      targetGain = 0.0;
    }

    for (let i = 0; i < length; i++) {
      const coeff = targetGain > currentGain ? attackCoeff : releaseCoeff;
      currentGain += (targetGain - currentGain) * coeff;
      if (currentGain < 0.0001) currentGain = 0;
      else if (currentGain > 0.9999) currentGain = 1;

      for (let c = 0; c < numChannels; c++) {
        if (outputBuffer.getChannelData(c)) {
          outputBuffer.getChannelData(c)[i] = inputBuffer.getChannelData(c)[i] * currentGain;
        }
      }
    }
  };

  return scriptNode;
}

/**
 * Conecta el stream del micrófono a través del nodo de puerta de ruido
 * y retorna el stream filtrado listo para ser capturado por MediaRecorder.
 */
export async function createProcessedStream(rawStream, thresholdDb) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return {
      stream: rawStream,
      cleanup: () => {
        rawStream.getTracks().forEach((t) => t.stop());
      },
    };
  }

  const context = new AudioCtx();
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Ignorar si requiere interacción adicional
    }
  }

  const source = context.createMediaStreamSource(rawStream);
  const destination = context.createMediaStreamDestination();

  if (typeof thresholdDb === 'number') {
    try {
      const gateNode = await createNoiseGateNode(context, thresholdDb);
      if (gateNode) {
        source.connect(gateNode);
        gateNode.connect(destination);
      } else {
        source.connect(destination);
      }
    } catch (err) {
      console.warn('Error al inicializar la puerta de ruido:', err);
      source.connect(destination);
    }
  } else {
    source.connect(destination);
  }

  const cleanup = () => {
    try {
      rawStream.getTracks().forEach((track) => track.stop());
    } catch {}
    try {
      destination.stream.getTracks().forEach((track) => track.stop());
    } catch {}
    try {
      if (context.state !== 'closed') {
        context.close().catch(() => {});
      }
    } catch {}
  };

  return {
    stream: destination.stream,
    rawStream,
    context,
    cleanup,
  };
}
