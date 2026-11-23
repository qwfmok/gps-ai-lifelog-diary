import type { VoiceRecord } from '../../types';
import type { VoiceService } from './VoiceService';
import { MAX_RECORDING_SECONDS, PcmWavRecorder } from './PcmWavRecorder';
import { VoiceServiceError } from './VoiceServiceError';
import { VoiceTranscriptionApiService } from './VoiceTranscriptionApiService';

export class ApiVoiceService implements VoiceService {
  private readonly recorder = new PcmWavRecorder();
  private readonly transcriptionApi = new VoiceTranscriptionApiService();
  private record: VoiceRecord = this.emptyRecord();
  private wavBlob: Blob | null = null;

  async startRecording(eventId?: string): Promise<VoiceRecord> {
    this.wavBlob = null;
    await this.recorder.start();
    this.record = {
      ...this.emptyRecord(),
      eventId: eventId ?? null,
      status: 'RECORDING',
    };
    return structuredClone(this.record);
  }

  async stopRecording(): Promise<VoiceRecord> {
    const recording = await this.recorder.stop();
    this.wavBlob = recording.blob;
    this.record = {
      ...this.record,
      duration: Math.min(MAX_RECORDING_SECONDS, Math.round(recording.durationSeconds)),
      status: 'PROCESSING',
    };
    return structuredClone(this.record);
  }

  async cancelRecording(): Promise<void> {
    await this.recorder.cancel();
    this.wavBlob = null;
    this.record = this.emptyRecord();
  }

  async transcribe(): Promise<VoiceRecord> {
    if (!this.wavBlob) {
      throw new VoiceServiceError('RECORDING_FAILED', '업로드할 녹음 파일이 없습니다. 다시 녹음해 주세요.');
    }

    const response = await this.transcriptionApi.transcribeVoice(this.wavBlob);
    this.record = { ...this.record, transcript: response.transcript, status: 'COMPLETED' };
    return structuredClone(this.record);
  }

  async clearRecord(): Promise<void> {
    await this.recorder.cancel();
    this.wavBlob = null;
    this.record = this.emptyRecord();
  }

  private emptyRecord(): VoiceRecord {
    return {
      id: `voice-${Date.now()}`,
      eventId: null,
      duration: 0,
      transcript: null,
      status: 'IDLE',
    };
  }
}
