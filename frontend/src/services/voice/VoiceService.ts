import type { VoiceRecord } from '../../types';

export interface VoiceService {
  startRecording(eventId?: string): Promise<VoiceRecord>;
  stopRecording(): Promise<VoiceRecord>;
  cancelRecording(): Promise<void>;
  transcribe(): Promise<VoiceRecord>;
  clearRecord(): Promise<void>;
}
