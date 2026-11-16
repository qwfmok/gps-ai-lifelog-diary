import type {
  ActivityService,
  DiaryService,
  DiaryGenerationService,
  LocationService,
  TimelineService,
  VoiceService,
} from './types';
import { Capacitor } from '@capacitor/core';
import { MockActivityService } from './activity/MockActivityService';
import { MockDiaryService } from './diary/MockDiaryService';
import { DiaryApiService } from './diary/DiaryApiService';
import { MockDiaryGenerationService } from './diary/MockDiaryGenerationService';
import { DiaryGenerationApiService } from './diary/DiaryGenerationApiService';
import { MockTimelineService } from './timeline/MockTimelineService';
import { MockTimelineDataService } from './timeline/MockTimelineDataService';
import { TimelineApiService } from './timeline/TimelineApiService';
import type { TimelineDataService } from './timeline/TimelineDataService';
import { MockVoiceService } from './voice/MockVoiceService';
import { ApiVoiceService } from './voice/ApiVoiceService';
import { WebLocationService } from './location/WebLocationService';
import { CapacitorLocationService } from './location/CapacitorLocationService';
import { LocationApiService } from './location/LocationApiService';

export interface ApplicationServices {
  activity: ActivityService;
  diary: DiaryService;
  diaryGeneration: DiaryGenerationService;
  location: LocationService;
  locationApi: LocationApiService;
  timeline: TimelineService;
  timelineData: TimelineDataService;
  voice: VoiceService;
}

const timelineService = new MockTimelineService();
const timelineDataSource = import.meta.env.VITE_TIMELINE_SOURCE ?? 'mock';
const timelineData = timelineDataSource === 'mock'
  ? new MockTimelineDataService(timelineService)
  : new TimelineApiService();
const voiceSource = import.meta.env.VITE_STT_SOURCE ?? 'mock';
const voiceService = voiceSource === 'mock' ? new MockVoiceService() : new ApiVoiceService();
export const diaryGenerationSource = import.meta.env.VITE_DIARY_SOURCE ?? 'mock';
const diaryService = new MockDiaryService(timelineService);
const diaryDataService = diaryGenerationSource === 'api' ? new DiaryApiService() : diaryService;
const locationService = Capacitor.getPlatform() === 'android'
  ? new CapacitorLocationService(timelineService)
  : new WebLocationService(timelineService);

export const services: ApplicationServices = {
  activity: new MockActivityService(timelineService),
  diary: diaryDataService,
  diaryGeneration: diaryGenerationSource === 'api'
    ? new DiaryGenerationApiService()
    : new MockDiaryGenerationService(diaryService),
  location: locationService,
  locationApi: new LocationApiService(),
  timeline: timelineService,
  timelineData,
  voice: voiceService,
};
