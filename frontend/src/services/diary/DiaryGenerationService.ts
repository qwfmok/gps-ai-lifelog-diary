import type { Diary } from '../../types';

export interface DiaryGenerationInput {
  date: string;
  memo?: string;
  transcript?: string;
}

export interface DiaryGenerationResult {
  diary: Diary;
  usedFacts: string[];
  uncertainPoints: string[];
}

export interface DiaryGenerationService {
  generateDiaryDraft(input: DiaryGenerationInput): Promise<DiaryGenerationResult>;
}
