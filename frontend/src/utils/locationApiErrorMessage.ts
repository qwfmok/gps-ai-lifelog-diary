import { Capacitor } from '@capacitor/core';
import { LocationApiError } from '../services/location/LocationApiService';

export function locationApiErrorMessage(error: unknown): string {
  if (!(error instanceof LocationApiError)) {
    return Capacitor.getPlatform() === 'android'
      ? '모바일에서 접근 가능한 API 서버 주소가 필요합니다.'
      : '위치 API 요청을 처리하지 못했습니다.';
  }

  switch (error.kind) {
    case 'CONFIGURATION':
      return '모바일에서 접근 가능한 API 서버 주소가 필요합니다.';
    case 'INSECURE_TRANSPORT':
      return 'Android 앱의 위치 API 연결에는 HTTPS 서버 주소가 필요합니다.';
    case 'NETWORK':
      return Capacitor.getPlatform() === 'android'
        ? '모바일에서 API 서버에 연결할 수 없습니다. 서버 주소와 기기 네트워크를 확인해 주세요.'
        : '네트워크 문제로 위치 API에 연결할 수 없습니다.';
    case 'VALIDATION':
      return '서버가 위치 정보나 날짜 형식을 확인해 달라고 응답했습니다.';
    case 'SERVER':
      return '서버에서 위치 요청을 처리하지 못했습니다.';
    case 'PROTOCOL':
      return '서버 응답 형식을 확인하지 못했습니다.';
  }
}
