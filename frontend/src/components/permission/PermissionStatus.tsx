import type { LocationPermissionStatus } from '../../types';

const statusCopy: Record<LocationPermissionStatus, { label: string; description: string }> = {
  UNKNOWN: { label: '아직 요청하지 않음', description: '아직 위치 권한을 요청하지 않았습니다.' },
  GRANTED: { label: '허용됨', description: '위치 기록을 사용할 준비가 되었습니다.' },
  DENIED: { label: '허용되지 않음', description: '위치 사용이 허용되지 않았습니다. 위치 기록 없이도 일기 기능을 사용할 수 있습니다.' },
  UNAVAILABLE: { label: '사용할 수 없음', description: '현재 환경에서는 위치 기능을 사용할 수 없습니다. 직접 기록 기능은 계속 사용할 수 있습니다.' },
};

interface PermissionStatusProps {
  status: LocationPermissionStatus;
  isChecking?: boolean;
}

export default function PermissionStatus({ status, isChecking = false }: PermissionStatusProps) {
  const copy = statusCopy[status];
  return (
    <div className="permission-status" aria-live="polite">
      <p className="settings-state">현재 상태: <strong>{isChecking ? '확인 중' : copy.label}</strong></p>
      <p>{isChecking ? '위치 권한 상태를 확인하고 있습니다.' : copy.description}</p>
    </div>
  );
}
