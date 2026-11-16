import { Capacitor } from '@capacitor/core';
import { AuthenticatedRequestError, authenticatedFetch } from '../auth/authenticatedFetch';
import { MAX_UPLOAD_BYTES } from './PcmWavRecorder';
import { VoiceServiceError } from './VoiceServiceError';

export interface BackendVoiceTranscriptionResponse {
  transcript: string;
  mode: 'mock' | 'openai';
}

export class VoiceTranscriptionApiService {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

  async transcribeVoice(audio: Blob): Promise<BackendVoiceTranscriptionResponse> {
    const endpoint = this.getEndpoint();
    if (audio.type !== 'audio/wav') {
      throw new VoiceServiceError('UNSUPPORTED_FORMAT', '업로드할 음성이 WAV 형식이 아닙니다. 다시 녹음해 주세요.');
    }
    if (audio.size === 0) {
      throw new VoiceServiceError('INVALID_AUDIO', '녹음된 음성이 없습니다.');
    }
    if (audio.size > MAX_UPLOAD_BYTES) {
      throw new VoiceServiceError('PAYLOAD_TOO_LARGE', '녹음 파일이 Backend의 10 MiB 제한을 초과했습니다. 더 짧게 녹음해 주세요.');
    }

    const formData = new FormData();
    formData.append('audio', audio, 'recording.wav');

    let response: Response;
    try {
      response = await authenticatedFetch(endpoint, { method: 'POST', body: formData });
    } catch (error) {
      if (error instanceof AuthenticatedRequestError) {
        if (error.kind === 'CONFIGURATION') {
          throw new VoiceServiceError('AUTH_CONFIGURATION', 'Supabase Auth URL과 공개 key 설정이 필요합니다.');
        }
        throw new VoiceServiceError('AUTHENTICATION', '로그인 후 음성 인식을 사용할 수 있습니다.');
      }
      throw new VoiceServiceError('NETWORK', 'Backend에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해 주세요.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new VoiceServiceError('AUTHENTICATION', '로그인 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (response.status === 413) {
      throw new VoiceServiceError('PAYLOAD_TOO_LARGE', '녹음 파일이 Backend의 10 MiB 제한을 초과했습니다. 더 짧게 녹음해 주세요.');
    }
    if (response.status === 415) {
      throw new VoiceServiceError('UNSUPPORTED_FORMAT', 'Backend가 WAV 형식을 받지 않았습니다. 녹음을 다시 시도해 주세요.');
    }
    if (response.status === 422) {
      throw new VoiceServiceError('INVALID_AUDIO', '음성을 확인할 수 없습니다. 주변 소리를 확인하고 다시 녹음해 주세요.');
    }
    if (response.status === 503) {
      throw new VoiceServiceError('STT_UNAVAILABLE', 'Backend 음성 인식이 비활성화됐거나 설정이 필요합니다.');
    }
    if (response.status === 504) {
      throw new VoiceServiceError('TIMEOUT', '음성 인식 시간이 초과됐습니다. 다시 시도해 주세요.');
    }
    if (response.status === 502) {
      throw new VoiceServiceError('TRANSCRIPTION_FAILED', '음성 인식에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!response.ok) {
      throw new VoiceServiceError('TRANSCRIPTION_FAILED', `음성 인식 요청에 실패했습니다. (${response.status})`);
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new VoiceServiceError('PROTOCOL', 'Backend가 올바른 음성 인식 응답을 반환하지 않았습니다.');
    }
    if (!isTranscriptionResponse(result)) {
      throw new VoiceServiceError('PROTOCOL', 'Backend 음성 인식 응답 형식이 예상과 다릅니다.');
    }
    if (result.mode !== 'openai') {
      throw new VoiceServiceError('STT_UNAVAILABLE', 'Backend가 Mock 음성 인식 모드입니다. 실제 STT 설정을 확인해 주세요.');
    }
    if (!result.transcript.trim()) {
      throw new VoiceServiceError('INVALID_AUDIO', '음성에서 인식된 문장이 없습니다. 다시 녹음해 주세요.');
    }

    return { ...result, transcript: result.transcript.trim() };
  }

  private getEndpoint(): string {
    if (!this.baseUrl) {
      throw new VoiceServiceError('BACKEND_CONFIGURATION', '음성 인식을 위해 Backend 주소 설정이 필요합니다.');
    }

    let url: URL;
    try {
      url = new URL(this.baseUrl);
    } catch {
      throw new VoiceServiceError('BACKEND_CONFIGURATION', 'Backend 주소 설정을 확인해 주세요.');
    }

    if (Capacitor.getPlatform() === 'android') {
      const host = url.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)) {
        throw new VoiceServiceError('BACKEND_CONFIGURATION', 'Android 기기에서 접근 가능한 Backend 주소가 필요합니다.');
      }
      if (url.protocol !== 'https:') {
        throw new VoiceServiceError('INSECURE_TRANSPORT', 'Android 음성 업로드에는 HTTPS Backend 주소가 필요합니다.');
      }
    }

    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/voice/transcribe`;
    return url.toString();
  }
}

function isTranscriptionResponse(value: unknown): value is BackendVoiceTranscriptionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  return typeof response.transcript === 'string'
    && (response.mode === 'mock' || response.mode === 'openai');
}
