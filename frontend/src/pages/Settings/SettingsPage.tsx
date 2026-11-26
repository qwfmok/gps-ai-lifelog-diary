import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useNavigate } from 'react-router';
import LocationPermissionDialog from '../../components/permission/LocationPermissionDialog';
import PermissionStatus from '../../components/permission/PermissionStatus';
import SettingsConfirmationDialog from '../../components/settings/SettingsConfirmationDialog';
import LocationImportPanel from '../../components/settings/LocationImportPanel';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';

export default function SettingsPage() {
  const settings = useSettings();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const closePermissionDialog = useCallback(() => setPermissionDialogOpen(false), []);

  const handleAllowPermission = async () => {
    const result = await settings.requestPermission();
    if (!result) return;
    setPermissionDialogOpen(false);
    setPermissionNotice(result === 'GRANTED'
      ? '위치 사용이 허용되었습니다. 위치 기록은 별도로 켤 수 있습니다.'
      : result === 'DENIED'
        ? '위치 사용이 허용되지 않았습니다. 위치 기록 없이도 앱을 사용할 수 있습니다.'
        : result === 'UNAVAILABLE'
          ? '현재 환경에서는 위치 기능을 사용할 수 없습니다. 직접 기록은 계속 이용할 수 있습니다.'
          : '아직 위치 권한을 확인하지 못했습니다.');
  };

  const handleTrackingToggle = () => {
    setPermissionNotice(null);
    if (settings.trackingEnabled) {
      void settings.toggleTracking();
      return;
    }
    if (settings.permissionStatus === 'UNKNOWN') {
      setPermissionDialogOpen(true);
    } else if (settings.permissionStatus === 'GRANTED') {
      void settings.toggleTracking();
    } else if (settings.permissionStatus === 'DENIED') {
      setPermissionNotice('위치 기록을 켜려면 위치 사용을 허용해 주세요. 브라우저 설정에서 권한을 변경할 수 있습니다.');
    } else {
      setPermissionNotice('현재 환경에서는 위치 기록을 사용할 수 없습니다. 직접 기록 기능은 계속 이용할 수 있습니다.');
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : '로그아웃하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-intro" aria-labelledby="page-title">
        <p className="page-eyebrow">SETTINGS</p>
        <h1 id="page-title">설정</h1>
        <p className="page-description">기록과 개인정보 사용 방식을 직접 관리할 수 있습니다.</p>
      </header>

      {settings.error && (
        <div className="settings-feedback settings-feedback--error" role="alert">
          <p>{settings.error}</p>
          <button className="settings-inline-button" onClick={() => { void settings.refresh(); }} type="button">다시 시도</button>
        </div>
      )}
      {settings.message && <p className="settings-feedback" role="status" aria-live="polite">{settings.message}</p>}
      {permissionNotice && <p className="settings-feedback" role="status" aria-live="polite">{permissionNotice}</p>}

      <section className="settings-section" aria-labelledby="settings-account-title">
        <div className="settings-section__heading">
          <p className="page-eyebrow">ACCOUNT</p>
          <h2 id="settings-account-title">계정</h2>
        </div>
        <div className="settings-card settings-account-card">
          <div className="settings-card__copy">
            <h3>로그인 계정</h3>
            <p>{user?.email ?? '계정 정보 없음'}</p>
          </div>
          <button
            className="settings-secondary-button"
            disabled={isSigningOut}
            onClick={() => { void handleSignOut(); }}
            type="button"
          >
            {isSigningOut ? '로그아웃 중...' : '로그아웃'}
          </button>
          {signOutError && <p className="settings-feedback settings-feedback--error" role="alert">{signOutError}</p>}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-location-title">
        <div className="settings-section__heading">
          <p className="page-eyebrow">LOCATION</p>
          <h2 id="settings-location-title">위치 및 기록</h2>
          <p>하루의 이동과 체류지를 기록하는 방식을 관리합니다.</p>
        </div>

        <div className="settings-card">
          <div className="settings-card__row">
            <div className="settings-card__copy">
              <h3>위치 기록</h3>
              <p>위치 기록을 사용하면 하루의 이동과 체류지를 자동으로 정리할 수 있습니다.</p>
              <p className="settings-state" role="status">
                현재 상태: <strong>{settings.isLoading ? '불러오는 중' : settings.trackingEnabled ? '켜짐' : '꺼짐'}</strong>
              </p>
            </div>
            <button
              aria-checked={settings.trackingEnabled}
              aria-label="위치 기록"
              className={`settings-toggle${settings.trackingEnabled ? ' settings-toggle--on' : ''}`}
              disabled={settings.isLoading || settings.isCheckingPermission || settings.isUpdatingTracking}
              onClick={handleTrackingToggle}
              role="switch"
              type="button"
            >
              <span className="settings-toggle__thumb" aria-hidden="true" />
              <span className="settings-toggle__text">{settings.isUpdatingTracking ? '변경 중' : settings.trackingEnabled ? '켜짐' : '꺼짐'}</span>
            </button>
          </div>
          <p className="settings-card__note">위치 기록은 앱이 활성화되어 있을 때 작동합니다. 앱이 종료되거나 백그라운드로 이동하면 추적이 중단될 수 있으며, 백그라운드 추적은 지원하지 않습니다.</p>
          <p className="settings-state" role="status" aria-live="polite">
            서버 저장: <strong>{settings.locationSaveStatus === 'SAVING' ? '저장 중'
              : settings.locationSaveStatus === 'SUCCESS' ? '최근 저장 성공'
                : settings.locationSaveStatus === 'ERROR' ? '저장 실패' : '대기 중'}</strong>
            {settings.lastLocationSavedAt && ` · ${new Date(settings.lastLocationSavedAt).toLocaleTimeString()}`}
          </p>
          {settings.locationSaveError && <p className="diary-editor__error" role="alert">{settings.locationSaveError}</p>}
          <p className="settings-state" role="status" aria-live="polite">
            오늘 서버 위치 기록: <strong>{settings.locationQueryStatus === 'LOADING' ? '조회 중'
              : settings.locationQueryStatus === 'SUCCESS' ? `${settings.locationCount ?? 0}개`
                : settings.locationQueryStatus === 'ERROR' ? '조회 실패' : '대기 중'}</strong>
          </p>
          {settings.locationQueryError && (
            <div className="settings-feedback settings-feedback--error" role="alert">
              <p>{settings.locationQueryError}</p>
              <button className="settings-inline-button" onClick={() => { void settings.refreshLocationCount(); }} type="button">다시 조회</button>
            </div>
          )}
        </div>

        <div className="settings-card">
          <div className="settings-card__copy">
            <h3>위치 권한</h3>
            <PermissionStatus status={settings.permissionStatus} isChecking={settings.isCheckingPermission} />
            {settings.permissionError && <p className="diary-editor__error" role="alert">{settings.permissionError}</p>}
          </div>
          {settings.permissionStatus === 'UNKNOWN' && (
            <button className="settings-secondary-button" disabled={settings.isCheckingPermission} onClick={() => setPermissionDialogOpen(true)} type="button">위치 사용 설정</button>
          )}
          {settings.permissionStatus === 'DENIED' && (
            <button className="settings-secondary-button" onClick={() => setPermissionDialogOpen(true)} type="button">다시 안내 보기</button>
          )}
          {settings.permissionError && (
            <button className="settings-secondary-button" onClick={() => { void settings.refreshPermissionStatus(); }} type="button">다시 확인</button>
          )}
        </div>

        <div className="settings-card settings-card--current-location">
          <div className="settings-card__copy">
            <h3>현재 위치</h3>
            <p>현재 위치는 버튼을 눌렀을 때 확인합니다. 위치 추적은 앱이 활성화되어 있을 때 작동합니다.</p>
            {settings.locationStatus === 'LOADING' && <p className="settings-location__state" role="status">현재 위치를 확인하고 있습니다.</p>}
            {settings.locationStatus === 'SUCCESS' && !settings.trackingEnabled && <p className="settings-location__state" role="status">현재 위치를 확인했습니다.</p>}
            {settings.trackingEnabled && <p className="settings-location__state" role="status">현재 앱에서 위치를 확인하고 있습니다.</p>}
            {settings.locationError && <p className="diary-editor__error" role="alert">{settings.locationError}</p>}
            {settings.currentPosition && (
              <dl className="settings-location__coordinates">
                <div><dt>위도</dt><dd>{settings.currentPosition.latitude.toFixed(5)}</dd></div>
                <div><dt>경도</dt><dd>{settings.currentPosition.longitude.toFixed(5)}</dd></div>
                {settings.currentPosition.accuracy !== undefined && <div><dt>정확도</dt><dd>약 {Math.round(settings.currentPosition.accuracy)}m</dd></div>}
              </dl>
            )}
          </div>
          <button
            className="settings-secondary-button"
            disabled={settings.permissionStatus !== 'GRANTED' || settings.isGettingPosition}
            onClick={() => { void settings.requestCurrentPosition(); }}
            type="button"
          >
            {settings.isGettingPosition ? '확인 중...' : settings.locationStatus === 'ERROR' || settings.locationStatus === 'UNAVAILABLE' ? '다시 시도' : '현재 위치 확인'}
          </button>
        </div>

        <div className="settings-card settings-card--danger">
          <div className="settings-card__copy">
            <h3>앱 내 위치 상태 초기화</h3>
            <p>위치 추적을 중지하고 이 앱의 임시 위치 기록과 현재 위치 상태를 지웁니다. Backend에 저장된 위치 기록과 Timeline 기억은 삭제되지 않으며, 작성한 일기는 유지됩니다.</p>
          </div>
          <button className="settings-danger-button" onClick={() => settings.requestDelete('location')} type="button">앱 내 위치 상태 초기화</button>
        </div>

        <div className="settings-card">
          <LocationImportPanel />
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-data-title">
        <div className="settings-section__heading">
          <p className="page-eyebrow">YOUR RECORDS</p>
          <h2 id="settings-data-title">데이터 관리</h2>
          <p>저장한 일기와 기록을 확인하거나 삭제할 수 있습니다.</p>
        </div>

        <div className="settings-card">
          <div className="settings-card__copy">
            <h3>저장된 일기</h3>
            <p>{settings.diaryCount === null ? '일기 수를 확인하고 있습니다.' : `현재 ${settings.diaryCount}편의 일기가 저장되어 있습니다.`}</p>
          </div>
          <Link className="settings-secondary-button" to="/history">지난 기록 보기</Link>
        </div>

        <div className="settings-card settings-card--danger">
          <div className="settings-card__copy">
            <h3>모든 일기 삭제</h3>
            <p>저장한 일기를 모두 삭제합니다. 위치 기반 기록은 유지됩니다.</p>
          </div>
          <button className="settings-danger-button" onClick={() => settings.requestDelete('diaries')} type="button">모든 일기 삭제</button>
        </div>

        <div className="settings-card settings-card--danger settings-card--all-data">
          <div className="settings-card__copy">
            <h3>앱 내 위치 상태와 모든 일기 삭제</h3>
            <p>위치 추적을 중지하고 앱의 임시 위치 상태와 저장된 일기를 삭제합니다. 서버 위치 기록과 Timeline 기억은 삭제되지 않습니다.</p>
          </div>
          <button className="settings-danger-button" onClick={() => settings.requestDelete('all')} type="button">위치 상태와 일기 삭제</button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-privacy-title">
        <div className="settings-section__heading">
          <p className="page-eyebrow">PRIVACY</p>
          <h2 id="settings-privacy-title">개인정보 안내</h2>
        </div>
        <div className="settings-privacy-card">
          <p>이 서비스는 하루의 라이프로그를 만들기 위해 위치 정보와 사용자가 입력한 기억 및 일기 데이터를 활용합니다.</p>
          <h3>위치정보 사용 목적</h3>
          <ul>
            <li>위치 추적 중 수신한 좌표를 설정된 Backend에 저장합니다.</li>
            <li>시간과 장소를 바탕으로 하루 Timeline을 구성합니다.</li>
            <li>체류 장소와 시간을 바탕으로 하루의 흐름을 구성합니다.</li>
          </ul>
          <p>앱 내 위치 상태 초기화는 이 앱의 임시 상태에만 적용됩니다. 서버 위치 기록과 Timeline 기억을 삭제하는 기능은 아직 제공되지 않습니다.</p>
        </div>
      </section>

      {settings.deleteAction && (
        <SettingsConfirmationDialog
          action={settings.deleteAction}
          isDeleting={settings.isDeleting}
          error={settings.deleteError}
          onCancel={settings.cancelDelete}
          onConfirm={() => { void settings.confirmDelete(); }}
        />
      )}
      {permissionDialogOpen && (
        <LocationPermissionDialog
          isRequesting={settings.isRequestingPermission}
          error={settings.permissionError}
          onCancel={closePermissionDialog}
          onAllow={() => { void handleAllowPermission(); }}
        />
      )}
    </div>
  );
}
