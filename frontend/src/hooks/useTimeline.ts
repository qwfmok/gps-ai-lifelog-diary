import { useCallback, useEffect, useState } from 'react';
import type { Activity, TimelineEvent } from '../types';
import { services } from '../services';

type TimelineLoadStatus = 'loading' | 'success' | 'empty' | 'error';

interface TimelineState {
  status: TimelineLoadStatus;
  events: TimelineEvent[];
  error: string | null;
}

interface UseTimelineResult extends TimelineState {
  retry: () => void;
  confirmActivity: (eventId: string, activity: Activity) => Promise<TimelineEvent>;
  addNote: (eventId: string, note: string) => Promise<TimelineEvent>;
}

export function useTimeline(date: string): UseTimelineResult {
  const [state, setState] = useState<TimelineState>({
    status: 'loading',
    events: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const confirmActivity = useCallback(async (eventId: string, activity: Activity) => {
    const updatedEvent = await services.activity.confirmActivity(eventId, activity);

    setState((currentState) => ({
      ...currentState,
      status: 'success',
      events: currentState.events.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
      error: null,
    }));

    return updatedEvent;
  }, []);

  const addNote = useCallback(async (eventId: string, note: string) => {
    const updatedEvent = await services.timeline.addNote(eventId, note);

    setState((currentState) => ({
      ...currentState,
      status: 'success',
      events: currentState.events.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
      error: null,
    }));

    return updatedEvent;
  }, []);

  useEffect(() => {
    let isCurrentRequest = true;

    setState({ status: 'loading', events: [], error: null });

    services.timeline
      .getTimeline(date)
      .then((events) => {
        if (!isCurrentRequest) return;

        setState({
          status: events.length > 0 ? 'success' : 'empty',
          events,
          error: null,
        });
      })
      .catch(() => {
        if (!isCurrentRequest) return;

        setState({
          status: 'error',
          events: [],
          error: '오늘의 기록을 불러오지 못했습니다.',
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [attempt, date]);

  return { ...state, retry, confirmActivity, addNote };
}
