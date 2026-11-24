import { useRef, useState } from 'react';
import { services } from '../../services';
import type { LocationImportResponse } from '../../services/location/LocationApiService';

type ImportState = 'idle' | 'loading' | 'success' | 'error';

function formatVisitTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function LocationImportPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocationImportResponse | null>(null);

  const importFile = async () => {
    if (!file) return;
    setState('loading');
    setError(null);
    setResult(null);
    try {
      const imported = await services.locationApi.importLocationFile(file, accessToken);
      setResult(imported);
      setState('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '파일을 가져오지 못했습니다.');
      setState('error');
    } finally {
      setAccessToken('');
    }
  };

  return (
    <section className="location-import" aria-labelledby="location-import-title">
      <div className="location-import__intro">
        <h3 id="location-import-title">위치 파일 가져오기</h3>
        <p>CSV 위치 기록 또는 Google Timeline JSON을 올리면 체류 장소와 활동 후보를 찾아요.</p>
      </div>

      <label className="location-import__field">
        <span>위치 기록 파일</span>
        <input
          accept=".csv,.json,text/csv,application/json"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
            setState('idle');
          }}
          ref={fileInput}
          type="file"
        />
      </label>
      <label className="location-import__field">
        <span>Supabase 로그인 토큰</span>
        <input
          autoComplete="off"
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder="로그인 세션의 access_token"
          type="password"
          value={accessToken}
        />
      </label>
      <p className="location-import__privacy">
        선택한 파일은 설정된 서버로 전송되어 저장됩니다. 토큰은 브라우저에 저장하지 않으며 전송 후 입력란을 비웁니다.
      </p>
      <button
        className="settings-secondary-button"
        disabled={!file || !accessToken.trim() || state === 'loading'}
        onClick={() => { void importFile(); }}
        type="button"
      >
        {state === 'loading' ? '장소를 찾고 있어요…' : '파일 불러오고 장소 추론'}
      </button>

      {state === 'error' && <p className="location-import__message location-import__message--error" role="alert">{error}</p>}
      {state === 'success' && result && (
        <div className="location-import__results" aria-live="polite">
          <p className="location-import__summary">
            위치 {result.imported_count.toLocaleString()}개를 저장했고, 체류·방문 장소 {result.visit_count.toLocaleString()}곳을 확인했어요.
          </p>
          {result.stays.length === 0 ? (
            <p>체류 조건을 충족하는 장소가 없어요. 위치 간격이나 파일의 기록 수를 확인해 주세요.</p>
          ) : (
            <ul>
              {result.stays.map((stay, index) => (
                <li key={`${stay.started_at}-${stay.latitude}-${stay.longitude}-${index}`}>
                  <div className="location-import__result-heading">
                    <strong>{stay.place_name ?? stay.address ?? '장소를 찾지 못했어요'}</strong>
                    {stay.place_category && <span>{stay.place_category}</span>}
                  </div>
                  <p>{formatVisitTime(stay.started_at)} · {Math.round(stay.duration_minutes)}분 머묾</p>
                  {stay.activity_candidates.length > 0 ? (
                    <ul className="location-import__candidates">
                      {stay.activity_candidates.map((candidate) => (
                        <li key={candidate.name}>
                          후보: {candidate.name} ({Math.round(candidate.confidence * 100)}%)
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>활동 후보를 만들 수 있는 장소 유형을 찾지 못했어요.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
