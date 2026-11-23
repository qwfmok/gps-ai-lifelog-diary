import type { MockDiaryService } from './MockDiaryService';
import type { DiaryGenerationInput, DiaryGenerationResult, DiaryGenerationService } from './DiaryGenerationService';

export class MockDiaryGenerationService implements DiaryGenerationService {
  constructor(private readonly diaryService: Pick<MockDiaryService, 'generateDiary'>) {}

  async generateDiaryDraft(input: DiaryGenerationInput): Promise<DiaryGenerationResult> {
    const diary = await this.diaryService.generateDiary(input.date);
    return { diary, usedFacts: [], uncertainPoints: [] };
  }
}
