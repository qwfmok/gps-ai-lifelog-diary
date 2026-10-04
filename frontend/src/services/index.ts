import type {
  ActivityService,
  DiaryService,
  LocationService,
  TimelineService,
  VoiceService,
} from './types';
import { MockActivityService } from './activity/MockActivityService';
import { MockDiaryService } from './diary/MockDiaryService';
import { MockTimelineService } from './timeline/MockTimelineService';
import { MockVoiceService } from './voice/MockVoiceService';
import { WebLocationService } from './location/WebLocationService';
import { LocationApiService } from './location/LocationApiService';

export interface ApplicationServices {
  activity: ActivityService;
  diary: DiaryService;
  location: LocationService;
  locationApi: LocationApiService;
  timeline: TimelineService;
  voice: VoiceService;
}

const timelineService = new MockTimelineService();

export const services: ApplicationServices = {
  activity: new MockActivityService(timelineService),
  diary: new MockDiaryService(timelineService),
  location: new WebLocationService(timelineService),
  locationApi: new LocationApiService(),
  timeline: timelineService,
  voice: new MockVoiceService(),
};
