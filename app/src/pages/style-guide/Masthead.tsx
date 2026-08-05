import { cx } from '../../lib/cx'
import { text } from '../../lib/typography'

const CONTAINER = 'mx-auto max-w-[65rem] px-6'

/** Doc-metadata strip + big title (styleguide-mockup.html's
 * `.masthead`). The mockup's own doc-meta brand mark uses a one-off 15px
 * Pirata One flourish outside the closed type set — deliberately not
 * reproduced here (SPEC.md: "Typography is a closed set", enforced by
 * typography.test.ts). All three doc-meta items use `label` instead, so
 * the masthead stays inside the ten sanctioned levels; a nearly-identical
 * look (the mockup's own doc-meta is 10-11px mono uppercase) for a
 * one-line composition difference. */
export function Masthead() {
  return (
    <header className="border-b border-line">
      <div className={cx(CONTAINER, 'py-6')}>
        <div className={cx('mb-6 flex items-center justify-between gap-4', text.label)}>
          <span>Grimoire</span>
          <span>Design system // v1.0 — living reference</span>
          <span>Updated 2026-08-05</span>
        </div>
        <h1 className={text.h1}>Design System</h1>
        <p className={cx('mt-2', text.bodySecondary, 'max-w-[58ch]')}>
          Tokens, typography, spacing, and the UI kit — every piece shown in every state it supports. Screens
          compose from this page; nothing ships that isn't specified here.
        </p>
      </div>
    </header>
  )
}
