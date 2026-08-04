/**
 * Minimal className joiner — avoids adding a dependency (clsx/cn) for
 * something this small. Falsy values (false/null/undefined/'') are
 * dropped, everything else is joined with a space.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
