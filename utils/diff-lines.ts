import { diffLines, type Change } from "diff";

export type DiffLineKind = "added" | "removed" | "unchanged";

export interface DiffDisplayLine {
  kind: DiffLineKind;
  text: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface SplitDiffRow {
  left: DiffDisplayLine | null;
  right: DiffDisplayLine | null;
}

export function computeUnifiedLines(from: string, to: string): DiffDisplayLine[] {
  const changes = diffLines(from, to);
  const lines: DiffDisplayLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const parts = splitChangeLines(change);
    for (const text of parts) {
      if (change.added) {
        lines.push({ kind: "added", text, oldLineNumber: null, newLineNumber: newLine++ });
      } else if (change.removed) {
        lines.push({ kind: "removed", text, oldLineNumber: oldLine++, newLineNumber: null });
      } else {
        lines.push({ kind: "unchanged", text, oldLineNumber: oldLine++, newLineNumber: newLine++ });
      }
    }
  }

  return lines;
}

export function computeSplitRows(from: string, to: string): SplitDiffRow[] {
  const unified = computeUnifiedLines(from, to);
  const rows: SplitDiffRow[] = [];

  for (const line of unified) {
    if (line.kind === "unchanged") {
      rows.push({ left: line, right: { ...line } });
      continue;
    }
    if (line.kind === "removed") {
      rows.push({ left: line, right: null });
      continue;
    }
    rows.push({ left: null, right: line });
  }

  return alignSplitRows(rows);
}

function splitChangeLines(change: Change): string[] {
  const value = change.value ?? "";
  const parts = value.split("\n");
  if (parts.length > 1 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

function alignSplitRows(rows: SplitDiffRow[]): SplitDiffRow[] {
  const aligned: SplitDiffRow[] = [];
  let i = 0;

  while (i < rows.length) {
    const current = rows[i];
    if (current.left?.kind === "removed" && current.right === null) {
      const removals: DiffDisplayLine[] = [current.left];
      let j = i + 1;
      while (j < rows.length && rows[j].left?.kind === "removed" && rows[j].right === null) {
        removals.push(rows[j].left!);
        j++;
      }
      const additions: DiffDisplayLine[] = [];
      while (j < rows.length && rows[j].left === null && rows[j].right?.kind === "added") {
        additions.push(rows[j].right!);
        j++;
      }
      const count = Math.max(removals.length, additions.length);
      for (let k = 0; k < count; k++) {
        aligned.push({
          left: removals[k] ?? null,
          right: additions[k] ?? null,
        });
      }
      i = j;
      continue;
    }
    aligned.push(current);
    i++;
  }

  return aligned;
}
