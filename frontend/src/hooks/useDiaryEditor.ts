import { useCallback, useEffect, useRef, useState } from 'react';
import { services } from '../services';
import type { Diary } from '../types';

interface UseDiaryEditorResult {
  isEditing: boolean;
  draftContent: string;
  isSaving: boolean;
  isSaved: boolean;
  saveError: string | null;
  validationError: string | null;
  saveNotice: string | null;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  deleteError: string | null;
  startEditing: () => void;
  cancelEditing: () => void;
  updateDraft: (content: string) => void;
  save: () => Promise<void>;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

export function useDiaryEditor(
  diary: Diary | null,
  onDiarySaved: (diary: Diary) => void,
  onDiaryDeleted: () => void,
): UseDiaryEditorResult {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(diary?.content ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentDiaryIdRef = useRef(diary?.id ?? null);
  const isSavingRef = useRef(false);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    const nextDiaryId = diary?.id ?? null;
    if (currentDiaryIdRef.current === nextDiaryId) return;

    currentDiaryIdRef.current = nextDiaryId;
    setIsEditing(false);
    setDraftContent(diary?.content ?? '');
    setIsSaved(false);
    setSaveError(null);
    setValidationError(null);
    setSaveNotice(null);
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }, [diary?.content, diary?.id]);

  const startEditing = useCallback(() => {
    if (!diary) return;
    setDraftContent(diary.content);
    setIsEditing(true);
    setSaveError(null);
    setValidationError(null);
    setSaveNotice(null);
  }, [diary]);

  const cancelEditing = useCallback(() => {
    setDraftContent(diary?.content ?? '');
    setIsEditing(false);
    setSaveError(null);
    setValidationError(null);
  }, [diary]);

  const updateDraft = useCallback((content: string) => {
    setDraftContent(content);
    setSaveError(null);
    setValidationError(null);
  }, []);

  const save = useCallback(async () => {
    if (!diary || isSavingRef.current) return;
    const content = draftContent.trim();
    if (!content) {
      setValidationError('일기 내용을 입력해 주세요.');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setValidationError(null);
    setSaveNotice(null);

    try {
      const savedDiary = isSaved
        ? await services.diary.updateDiary(diary.id, content)
        : await services.diary.saveDiary({
            ...diary,
            content,
            updatedAt: new Date().toISOString(),
          });
      onDiarySaved(savedDiary);
      setIsSaved(true);
      setDraftContent(savedDiary.content);
      setIsEditing(false);
      setSaveNotice('일기가 저장되었습니다.');
    } catch {
      setSaveError('일기를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [diary, draftContent, isSaved, onDiarySaved]);

  const requestDelete = useCallback(() => {
    setDeleteError(null);
    setIsDeleteDialogOpen(true);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeletingRef.current) return;
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!diary || isDeletingRef.current) return;

    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await services.diary.deleteDiary(diary.id);
      setIsDeleteDialogOpen(false);
      onDiaryDeleted();
    } catch {
      setDeleteError('일기를 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  }, [diary, onDiaryDeleted]);

  return {
    isEditing,
    draftContent,
    isSaving,
    isSaved,
    saveError,
    validationError,
    saveNotice,
    isDeleteDialogOpen,
    isDeleting,
    deleteError,
    startEditing,
    cancelEditing,
    updateDraft,
    save,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
