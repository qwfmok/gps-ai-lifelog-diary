import type { VoiceRecord } from '../../types';
import { MOCK_TRANSCRIPT } from '../../mocks';
import type { VoiceService } from './VoiceService';

export class MockVoiceService implements VoiceService {
  private record: VoiceRecord = {
    id: 'mock-voice-record',
    eventId: null,
    duration: 0,
    transcript: null,
    status: 'IDLE',
  };

  async startRecording(eventId?: string): Promise<VoiceRecord> {
    this.record = {
      id: 'mock-voice-record',
      eventId: eventId ?? null,
      duration: 0,
      transcript: null,
      status: 'RECORDING',
    };
    return structuredClone(this.record);
  }

  async stopRecording(): Promise<VoiceRecord> {
    this.record = {
      ...this.record,
      duration: 12,
      status: 'PROCESSING',
    };
    return structuredClone(this.record);
  }

  async cancelRecording(): Promise<void> {
    this.record = {
      id: 'mock-voice-record',
      eventId: null,
      duration: 0,
      transcript: null,
      status: 'IDLE',
    };
  }

  async transcribe(): Promise<VoiceRecord> {
    this.record = {
      ...this.record,
      transcript: MOCK_TRANSCRIPT,
      status: 'COMPLETED',
    };
    return structuredClone(this.record);
  }

  async clearRecord(): Promise<void> {
    this.record = {
      id: 'mock-voice-record',
      eventId: null,
      duration: 0,
      transcript: null,
      status: 'IDLE',
    };
  }
}
