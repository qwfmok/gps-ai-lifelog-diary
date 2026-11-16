export type VoiceServiceErrorKind =
  | 'MICROPHONE_PERMISSION'
  | 'MICROPHONE_UNAVAILABLE'
  | 'UNSUPPORTED_BROWSER'
  | 'RECORDING_FAILED'
  | 'BACKEND_CONFIGURATION'
  | 'INSECURE_TRANSPORT'
  | 'AUTH_CONFIGURATION'
  | 'AUTHENTICATION'
  | 'NETWORK'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_AUDIO'
  | 'STT_UNAVAILABLE'
  | 'TRANSCRIPTION_FAILED'
  | 'TIMEOUT'
  | 'PROTOCOL';

export class VoiceServiceError extends Error {
  constructor(public readonly kind: VoiceServiceErrorKind, message: string) {
    super(message);
    this.name = 'VoiceServiceError';
  }
}
