import { VoiceServiceError } from './VoiceServiceError';

export const TARGET_SAMPLE_RATE = 24_000;
export const MAX_RECORDING_SECONDS = 210;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface RecordedWav {
  blob: Blob;
  durationSeconds: number;
}

export class PcmWavRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.AudioContext === 'undefined') {
      throw new VoiceServiceError('UNSUPPORTED_BROWSER', '이 환경에서는 마이크 녹음을 사용할 수 없습니다. 직접 입력해 주세요.');
    }

    await this.releaseResources();
    this.chunks = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: TARGET_SAMPLE_RATE },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      throw getMicrophoneError(error);
    }

    try {
      this.context = createAudioContext();
      await this.context.resume();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        this.chunks.push(channel.slice());
      };
      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.startedAt = performance.now();
    } catch {
      await this.releaseResources();
      throw new VoiceServiceError('RECORDING_FAILED', '마이크 녹음을 시작하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  async stop(): Promise<RecordedWav> {
    if (!this.context || !this.stream || !this.processor) {
      throw new VoiceServiceError('RECORDING_FAILED', '녹음 중인 음성을 찾을 수 없습니다. 다시 녹음해 주세요.');
    }

    const sampleRate = this.context.sampleRate;
    const durationSeconds = (performance.now() - this.startedAt) / 1000;
    const samples = concatenate(this.chunks);
    await this.releaseResources();
    this.chunks = [];

    if (samples.length === 0) {
      throw new VoiceServiceError('RECORDING_FAILED', '녹음된 음성이 없습니다. 마이크를 확인한 뒤 다시 시도해 주세요.');
    }

    const blob = encodePcm16Wav(samples, sampleRate);
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new VoiceServiceError('PAYLOAD_TOO_LARGE', '녹음 파일이 Backend의 10 MiB 제한을 초과했습니다. 더 짧게 녹음해 주세요.');
    }

    return { blob, durationSeconds };
  }

  async cancel(): Promise<void> {
    this.chunks = [];
    await this.releaseResources();
  }

  private async releaseResources(): Promise<void> {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      try { this.processor.disconnect(); } catch { /* Already disconnected. */ }
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch { /* Already disconnected. */ }
      this.source = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== 'closed') {
      try { await this.context.close(); } catch { /* Releasing the microphone is best effort. */ }
    }
    this.context = null;
  }
}

export function encodePcm16Wav(samples: Float32Array, sourceSampleRate: number): Blob {
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new VoiceServiceError('RECORDING_FAILED', '녹음 sample rate를 확인할 수 없습니다.');
  }

  const monoSamples = resample(samples, sourceSampleRate, TARGET_SAMPLE_RATE);
  const dataSize = monoSamples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < monoSamples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, monoSamples[index] ?? 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function createAudioContext(): AudioContext {
  try {
    return new AudioContext({ sampleRate: TARGET_SAMPLE_RATE, latencyHint: 'interactive' });
  } catch {
    return new AudioContext({ latencyHint: 'interactive' });
  }
}

function resample(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return samples;
  const outputLength = Math.floor(samples.length * targetRate / sourceRate);
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = position - leftIndex;
    const left = samples[leftIndex] ?? 0;
    const right = samples[rightIndex] ?? left;
    output[index] = left + (right - left) * fraction;
  }

  return output;
}

function concatenate(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function getMicrophoneError(error: unknown): VoiceServiceError {
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return new VoiceServiceError('MICROPHONE_PERMISSION', '마이크 권한이 필요합니다. 앱 권한을 허용한 뒤 다시 시도해 주세요.');
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new VoiceServiceError('MICROPHONE_UNAVAILABLE', '사용할 수 있는 마이크를 찾지 못했습니다.');
  }
  return new VoiceServiceError('MICROPHONE_UNAVAILABLE', '마이크를 열지 못했습니다. 다른 앱에서 사용 중인지 확인해 주세요.');
}
