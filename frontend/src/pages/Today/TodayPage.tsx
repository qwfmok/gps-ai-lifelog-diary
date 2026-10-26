import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import ActivityConfirmation from '../../components/activity-confirmation/ActivityConfirmation';
import VoiceRecording from '../../components/voice/VoiceRecording';
import DiaryGenerator from '../../components/diary/DiaryGenerator';
import DailyTimeline from '../../components/timeline/DailyTimeline';
import DailyTimelineSummary from '../../components/timeline/DailyTimelineSummary';
import LocationPermissionDialog from '../../components/permission/LocationPermissionDialog';
import { useLocation } from '../../hooks/useLocation';
import { useTimeline } from '../../hooks/useTimeline';
import type { Activity, TimelineEvent } from '../../types';
import { formatKoreanDate, getLocalDateString } from '../../utils/date';

export default function TodayPage() {
  const today = new Date();
  const date = getLocalDateString(today);
  const { events, status, error, retry, confirmActivity, addNote } = useTimeline(date);
  const permission = useLocation();
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [voiceEvent, setVoiceEvent] = useState<TimelineEvent | null>(null);
  const hasLoaded = status === 'success' || status === 'empty';
  const closePermissionDialog = useCallback(() => setPermissionDialogOpen(false), []);
  const allowLocation = async () => {
    const result = await permission.requestPermission();
    if (result) setPermissionDialogOpen(false);
  };

  const closeConfirmation = useCallback(() => setSelectedEvent(null), []);
  const saveActivity = useCallback(
    async (activity: Activity) => {
      if (!selectedEvent) return;
      await confirmActivity(selectedEvent.id, activity);
    },
    [confirmActivity, selectedEvent],
  );
  const closeVoiceEditor = useCallback(() => setVoiceEvent(null), []);
  const saveMemory = useCallback(
    async (note: string) => {
      if (!voiceEvent) return;
      await addNote(voiceEvent.id, note);
    },
    [addNote, voiceEvent],
  );
  const focusTimelineEvent = useCallback((eventId: string) => {
    const timelineItems = document.querySelectorAll<HTMLElement>('[data-timeline-event]');
    const timelineItem = Array.from(timelineItems).find(
      (item) => item.dataset.timelineEvent === eventId,
    );

    timelineItem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    timelineItem?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="today-page">
      <header className="today-header" aria-labelledby="page-title">
        <p className="page-eyebrow">TODAY</p>
        <time className="today-header__date" dateTime={date}>
          {formatKoreanDate(today)}
        </time>
        <h1 id="page-title">오늘의 기록</h1>
        <p className="today-header__description">
          자동으로 기록된 하루를 확인하고
          <br />
          필요한 부분만 보완해 주세요.
        </p>
      </header>

      {!permission.isCheckingPermission && permission.permissionStatus === 'UNKNOWN' && (
        <aside className="today-location-prompt" aria-label="위치 기록 설정">
          <div>
            <h2>자동 기록을 설정할 수 있어요</h2>
            <p>하루의 이동과 체류지를 정리하려면 위치 사용 동의가 필요합니다. 위치 없이도 일기를 계속 이용할 수 있습니다.</p>
          </div>
          <button className="settings-secondary-button" onClick={() => setPermissionDialogOpen(true)} type="button">위치 사용 설정</button>
        </aside>
      )}
      {!permission.isCheckingPermission && (permission.permissionStatus === 'DENIED' || permission.permissionStatus === 'UNAVAILABLE') && (
        <p className="today-location-note" role="status">
          {permission.permissionStatus === 'DENIED' ? '위치 권한 없이도 하루 기록과 일기를 사용할 수 있습니다.' : '이 환경에서는 위치 기능을 사용할 수 없습니다. 직접 기록 기능을 이용해 주세요.'}
          {' '}<Link to="/settings">위치 설정 보기</Link>
        </p>
      )}
      {permission.permissionError && <p className="today-location-note" role="alert">{permission.permissionError} <button className="settings-inline-button" onClick={() => { void permission.refreshPermissionStatus(); }} type="button">다시 확인</button></p>}

      {hasLoaded && <DailyTimelineSummary events={events} />}

      <section className="timeline-section" aria-labelledby="timeline-heading">
        <div className="timeline-section__heading">
          <h2 id="timeline-heading">하루의 흐름</h2>
          {status === 'success' && <span>{events.length}개 기록</span>}
        </div>
        <DailyTimeline
          events={events}
          status={status}
          error={error}
          onRetry={retry}
          onConfirmActivity={setSelectedEvent}
          onAddMemory={setVoiceEvent}
        />
      </section>

      <DiaryGenerator
        date={date}
        events={events}
        timelineStatus={status}
        onReviewPending={focusTimelineEvent}
      />

      {selectedEvent && (
        <ActivityConfirmation
          event={selectedEvent}
          onClose={closeConfirmation}
          onConfirm={saveActivity}
        />
      )}
      {voiceEvent && (
        <VoiceRecording event={voiceEvent} onClose={closeVoiceEditor} onSave={saveMemory} />
      )}
      {permissionDialogOpen && (
        <LocationPermissionDialog
          isRequesting={permission.isRequestingPermission}
          error={permission.permissionError}
          onCancel={closePermissionDialog}
          onAllow={() => { void allowLocation(); }}
        />
      )}
    </div>
  );
}
