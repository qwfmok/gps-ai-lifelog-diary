import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceRecordStatus } from '../types';
import { services } from '../services';

type VoiceFailureStage = 'start' | 'stop' | 'transcribe' | null;

interface UseVoiceRecordingResult {
  status: VoiceRecordStatus;
  duration: number;
  transcript: string;
  error: string | null;
  setTranscript: (transcript: string) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useVoiceRecording(eventId: string, initialTranscript: string): UseVoiceRecordingResult {
  const [status, setStatus] = useState<VoiceRecordStatus>('IDLE');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscriptState] = useState(initialTranscript);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<VoiceRecordStatus>('IDLE');
  const requestIdRef = useRef(0);
  const failureStageRef = useRef<VoiceFailureStage>(null);

  const updateStatus = useCallback((nextStatus: VoiceRecordStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const setTranscript = useCallback((nextTranscript: string) => {
    setTranscriptState(nextTranscript);
  }, []);

  const start = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    failureStageRef.current = null;
    setError(null);
    setDuration(0);
    updateStatus('RECORDING');
    try {
      await services.voice.startRecording(eventId);
      if (requestId !== requestIdRef.current) return;
    } catch {
      if (requestId !== requestIdRef.current) return;
      failureStageRef.current = 'start';
      setError('음성 기록을 시작하지 못했습니다. 다시 시도하거나 직접 입력해 주세요.');
      updateStatus('ERROR');
    }
  }, [eventId, updateStatus]);

  const transcribe = useCallback(async (requestId: number, shouldStop: boolean) => {
    try {
      if (shouldStop) {
        try {
          await services.voice.stopRecording();
        } catch {
          if (requestId !== requestIdRef.current) return;
          failureStageRef.current = 'stop';
          throw new Error('stop');
        }
      }

      failureStageRef.current = 'transcribe';
      const record = await services.voice.transcribe();
      if (requestId !== requestIdRef.current) return;

      setTranscriptState(record.transcript ?? '');
      setError(null);
      failureStageRef.current = null;
      updateStatus('COMPLETED');
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError('음성 기록을 처리하지 못했습니다. 다시 시도하거나 직접 입력해 주세요.');
      updateStatus('ERROR');
    }
  }, [updateStatus]);

  const stop = useCallback(async () => {
    if (statusRef.current !== 'RECORDING') return;
    const requestId = ++requestIdRef.current;
    setError(null);
    updateStatus('PROCESSING');
    await transcribe(requestId, true);
  }, [transcribe, updateStatus]);

  const cancel = useCallback(async () => {
    requestIdRef.current += 1;
    failureStageRef.current = null;
    setError(null);
    setDuration(0);
    updateStatus('IDLE');
    try {
      await services.voice.cancelRecording();
    } catch {
      // Closing the editor must remain possible if a service cannot cancel.
    }
  }, [updateStatus]);

  const retry = useCallback(async () => {
    if (statusRef.current !== 'ERROR') return;
    const failedAt = failureStageRef.current;
    if (failedAt === 'start') {
      await start();
      return;
    }

    const requestId = ++requestIdRef.current;
    setError(null);
    updateStatus('PROCESSING');
    await transcribe(requestId, failedAt === 'stop');
  }, [start, transcribe, updateStatus]);

  useEffect(() => {
    if (status !== 'RECORDING') return undefined;

    const timerId = window.setInterval(() => {
      setDuration((currentDuration) => currentDuration + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [status]);

  useEffect(() => () => {
    if (statusRef.current === 'RECORDING' || statusRef.current === 'PROCESSING') {
      requestIdRef.current += 1;
      void services.voice.cancelRecording();
    }
  }, []);

  return { status, duration, transcript, error, setTranscript, start, stop, cancel, retry };
}
