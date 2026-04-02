import type { useI18n } from '@affine/i18n';

/**
 * Default label for a newly created organize folder (sidebar).
 * Uses the same i18n key everywhere so folder `data` is never a missing-key string.
 */
export function getDefaultNewFolderName(t: ReturnType<typeof useI18n>): string {
  return t['com.affine.rootAppSidebar.organize.new-folders']();
}
