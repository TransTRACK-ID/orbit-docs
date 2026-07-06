import type { DiffMetadataChange, DiffSection, DiffVersionMeta, HistoryDiffResponse } from "~/types/diff";
import { formatDiffVersionLabel, getHistoryActionLabel } from "~/utils/history-actions";

export function toDiffVersionMeta(
  row: { id: string; action: string; actor: string | null; createdAt: Date | string | null },
): DiffVersionMeta {
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return {
    id: row.id,
    action: row.action,
    actionLabel: getHistoryActionLabel(row.action),
    actor: row.actor,
    createdAt,
    label: formatDiffVersionLabel(row.action, row.actor, createdAt),
  };
}

export function buildTextSections(
  sections: Array<{ key: string; label: string; from: string | null | undefined; to: string | null | undefined }>,
): DiffSection[] {
  return sections
    .filter((s) => (s.from ?? "") !== (s.to ?? ""))
    .map((s) => ({
      key: s.key,
      label: s.label,
      from: s.from ?? "",
      to: s.to ?? "",
    }));
}

export function buildMetadataChanges(
  changes: Array<{
    field: string;
    label: string;
    from: string | boolean | null;
    to: string | boolean | null;
  }>,
): DiffMetadataChange[] {
  return changes.filter((c) => c.from !== c.to);
}

export function buildHistoryDiffResponse<T extends { id: string; action: string; actor: string | null; createdAt: Date | string | null }>(
  versions: T[],
  fromId: string,
  toId: string,
  buildContent: (from: T, to: T) => { sections: DiffSection[]; metadata: DiffMetadataChange[] },
): HistoryDiffResponse {
  const versionMetas = versions.map((v) => toDiffVersionMeta(v));
  const fromRow = versions.find((v) => v.id === fromId);
  const toRow = versions.find((v) => v.id === toId);

  if (!fromRow || !toRow) {
    throw new Error("Version not found");
  }

  const { sections, metadata } = buildContent(fromRow, toRow);

  return {
    from: toDiffVersionMeta(fromRow),
    to: toDiffVersionMeta(toRow),
    sections,
    metadata,
    versions: versionMetas,
  };
}

export function resolveDefaultFromId<T extends { id: string }>(
  versions: T[],
  toId: string,
): string | null {
  const idx = versions.findIndex((v) => v.id === toId);
  if (idx === -1) return null;
  if (idx < versions.length - 1) return versions[idx + 1].id;
  return versions[0]?.id ?? null;
}
