export type VoiceRecordStatus =
  | 'IDLE'
  | 'RECORDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR';

export interface VoiceRecord {
  id: string;
  eventId: string | null;
  duration: number;
  transcript: string | null;
  status: VoiceRecordStatus;
}
