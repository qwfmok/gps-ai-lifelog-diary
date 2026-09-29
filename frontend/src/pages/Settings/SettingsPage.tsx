import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import LocationPermissionDialog from '../../components/permission/LocationPermissionDialog';
import PermissionStatus from '../../components/permission/PermissionStatus';
import SettingsConfirmationDialog from '../../components/settings/SettingsConfirmationDialog';
import { useSettings } from '../../hooks/useSettings';

export default function SettingsPage() {
  const settings = useSettings();
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
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
          <p className="settings-card__note">위치 기록은 이 브라우저에서만 작동합니다. 앱이나 탭이 닫히면 추적이 종료되며, 백그라운드 추적은 지원하지 않습니다.</p>
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
            <p>현재 위치는 버튼을 눌렀을 때 확인합니다. 웹 위치 기록은 앱이 열려 있는 동안에만 작동합니다.</p>
            {settings.locationStatus === 'LOADING' && <p className="settings-location__state" role="status">현재 위치를 확인하고 있습니다.</p>}
            {settings.locationStatus === 'SUCCESS' && !settings.trackingEnabled && <p className="settings-location__state" role="status">현재 위치를 확인했습니다.</p>}
            {settings.trackingEnabled && <p className="settings-location__state" role="status">이 브라우저 세션에서 위치를 확인하고 있습니다.</p>}
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
            <h3>위치 기록 삭제</h3>
            <p>저장된 Timeline과 위치 기록, 현재 위치 상태를 삭제하고 추적을 중지합니다. 작성한 일기는 유지됩니다.</p>
          </div>
          <button className="settings-danger-button" onClick={() => settings.requestDelete('location')} type="button">위치 기록 삭제</button>
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
            <h3>전체 데이터 삭제</h3>
            <p>위치 기록, 저장된 일기, 음성 Mock 결과를 삭제합니다. 이 작업은 현재 Mock 환경에서 되돌릴 수 없습니다.</p>
          </div>
          <button className="settings-danger-button" onClick={() => settings.requestDelete('all')} type="button">전체 데이터 삭제</button>
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
            <li>이동 경로와 체류지를 파악합니다.</li>
            <li>시간과 장소를 바탕으로 하루 Timeline을 구성합니다.</li>
            <li>하루의 맥락을 이해하기 위한 행동 후보를 준비합니다.</li>
          </ul>
          <p>위치는 하루의 흐름을 구성하기 위한 근거로 사용됩니다. 현재 Prototype은 입력 정보를 실제 서버에 저장하지 않으며, 위치 기록과 일기를 각각 또는 전체 삭제할 수 있습니다.</p>
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
