import type { Store } from '@blocksuite/store';

type LinkedReference = {
  pageId: string;
  title?: string;
};

function getLinkedReferenceFromText(
  text: any | undefined
): LinkedReference | null {
  const deltas = text?.deltas$?.value as any[] | undefined;
  if (!deltas || deltas.length === 0) return null;
  for (const delta of deltas) {
    const reference = delta?.attributes?.reference;
    if (
      reference?.type === 'LinkedPage' &&
      typeof reference.pageId === 'string'
    ) {
      return {
        pageId: reference.pageId,
        title:
          typeof reference.title === 'string' && reference.title.trim() !== ''
            ? reference.title
            : undefined,
      };
    }
  }
  return null;
}

/** Resolves linked doc id from a database row block (for peek/doc fallback). */
export function getRowLinkedPageTarget(
  store: Store,
  rowId: string
): string | null {
  const row = store.getBlock(rowId)?.model as any;
  if (!row) return null;
  const titleText = row.title as any | undefined;
  const text = row.text as any | undefined;
  return (
    getLinkedReferenceFromText(titleText)?.pageId ??
    getLinkedReferenceFromText(text)?.pageId ??
    null
  );
}
