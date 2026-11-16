import type {
  ActivityService,
  DiaryService,
  LocationService,
  TimelineService,
  VoiceService,
} from './types';
import { Capacitor } from '@capacitor/core';
import { MockActivityService } from './activity/MockActivityService';
import { MockDiaryService } from './diary/MockDiaryService';
import { MockTimelineService } from './timeline/MockTimelineService';
import { MockTimelineDataService } from './timeline/MockTimelineDataService';
import { TimelineApiService } from './timeline/TimelineApiService';
import type { TimelineDataService } from './timeline/TimelineDataService';
import { MockVoiceService } from './voice/MockVoiceService';
import { WebLocationService } from './location/WebLocationService';
import { CapacitorLocationService } from './location/CapacitorLocationService';
import { LocationApiService } from './location/LocationApiService';

export interface ApplicationServices {
  activity: ActivityService;
  diary: DiaryService;
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
const locationService = Capacitor.getPlatform() === 'android'
  ? new CapacitorLocationService(timelineService)
  : new WebLocationService(timelineService);

export const services: ApplicationServices = {
  activity: new MockActivityService(timelineService),
  diary: new MockDiaryService(timelineService),
  location: locationService,
  locationApi: new LocationApiService(),
  timeline: timelineService,
  timelineData,
  voice: new MockVoiceService(),
};
