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

export interface ApplicationServices {
  activity: ActivityService;
  diary: DiaryService;
  location: LocationService;
  timeline: TimelineService;
  voice: VoiceService;
}

const timelineService = new MockTimelineService();

export const services: ApplicationServices = {
  activity: new MockActivityService(timelineService),
  diary: new MockDiaryService(timelineService),
  location: new WebLocationService(timelineService),
  timeline: timelineService,
  voice: new MockVoiceService(),
};
