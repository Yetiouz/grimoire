import type { LogEntryKind } from '../components/ui/LogEntryRow'

// Split out of JournalFilterBar.tsx: that file exports a component, and
// eslint-plugin-react-refresh's only-export-components rule doesn't allow a
// component file to also export a non-constant value (ALL_FILTER_KINDS is
// an array, not a primitive, so it doesn't qualify for the rule's
// allowConstantExport carve-out) — Fast Refresh can't distinguish "this
// export changed" from "the component changed" otherwise. This is exactly
// the fix the rule's own error message suggests: a new file to share a
// constant between components.

/** Every filterable kind — `system` has no chip (auto-generated, rare,
 * always shown) and isn't part of this set. */
export type FilterKind = Exclude<LogEntryKind, 'system'>

export const ALL_FILTER_KINDS: FilterKind[] = ['narration', 'action', 'roll', 'note', 'rules']
