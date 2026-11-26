import type { Diary, LocationPoint } from '../../types';

export interface DiaryGenerationInput {
  date: string;
  memo?: string;
  transcript?: string;
  currentLocation?: LocationPoint;
}

export interface DiaryGenerationResult {
  diary: Diary;
  usedFacts: string[];
  uncertainPoints: string[];
}

export interface DiaryGenerationService {
  generateDiaryDraft(input: DiaryGenerationInput): Promise<DiaryGenerationResult>;
}
