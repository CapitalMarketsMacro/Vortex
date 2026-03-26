import type {
  VortexBlotterRowFontSizePreset,
  VortexBlotterRowFontWeightPreset,
  VortexBlotterRowStyleRule,
} from './perspective-row-styles';
import { parseVortexBlotterNumericValue } from './perspective-row-styles';

export type VortexBlotterRowStyleConditionOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains';

export interface VortexBlotterRowEditorDraft {
  column: string;
  op: VortexBlotterRowStyleConditionOp;
  value: string;
  order: number;
  backgroundColor: string;
  color: string;
  fontSize: VortexBlotterRowFontSizePreset | '';
  fontWeight: VortexBlotterRowFontWeightPreset | '';
}

export function buildConditionMatcher(
  op: VortexBlotterRowStyleConditionOp,
  valueStr: string,
): (v: unknown) => boolean {
  const trimmed = valueStr.trim();
  return (v: unknown) => {
    switch (op) {
      case 'eq':
        return String(v ?? '').trim() === trimmed;
      case 'neq':
        return String(v ?? '').trim() !== trimmed;
      case 'contains':
        return String(v ?? '').includes(valueStr);
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const n = parseVortexBlotterNumericValue(v);
        const t = parseVortexBlotterNumericValue(trimmed);
        if (n === null || t === null) {
          return false;
        }
        if (op === 'gt') {
          return n > t;
        }
        if (op === 'gte') {
          return n >= t;
        }
        if (op === 'lt') {
          return n < t;
        }
        return n <= t;
      }
      default:
        return false;
    }
  };
}

export function draftToStyleRule(
  draft: VortexBlotterRowEditorDraft,
): VortexBlotterRowStyleRule | null {
  const col = draft.column.trim();
  if (!col) {
    return null;
  }
  const rule: VortexBlotterRowStyleRule = {
    column: col,
    order: Number.isFinite(draft.order) ? draft.order : 0,
    match: buildConditionMatcher(draft.op, draft.value),
  };
  const bg = draft.backgroundColor.trim();
  const fg = draft.color.trim();
  if (bg) {
    rule.backgroundColor = bg;
  }
  if (fg) {
    rule.color = fg;
  }
  if (draft.fontSize) {
    rule.fontSize = draft.fontSize;
  }
  if (draft.fontWeight) {
    rule.fontWeight = draft.fontWeight;
  }
  return rule;
}

export function draftsToStyleRules(
  drafts: VortexBlotterRowEditorDraft[],
): VortexBlotterRowStyleRule[] {
  return drafts
    .map(draftToStyleRule)
    .filter((r): r is VortexBlotterRowStyleRule => r !== null);
}
