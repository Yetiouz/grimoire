import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { text } from '../../lib/typography'
import { cx } from '../../lib/cx'

interface MarkdownProps {
  /** Raw model output. Parsed and rendered as real React elements —
   * never `dangerouslySetInnerHTML` — since this always carries
   * untrusted text (an LLM reply). */
  text: string
  /** Which typography level paragraphs/list items render at.
   * 'bodySecondary' (the default) matches LogEntryRow's existing
   * message treatment; RulesChat's transcript uses the brighter 'body'
   * to match what it rendered before this component existed. */
  variant?: 'body' | 'bodySecondary'
  className?: string
}

type Block =
  | { type: 'heading'; content: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'paragraph'; lines: string[] }

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const UL_RE = /^[-*+]\s+(.*)$/
const OL_RE = /^\d+\.\s+(.*)$/

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', content: heading[2].trim() })
      i++
      continue
    }

    const ul = UL_RE.exec(line)
    if (ul) {
      const items = [ul[1]]
      i++
      let next: RegExpExecArray | null
      while (i < lines.length && (next = UL_RE.exec(lines[i]))) {
        items.push(next[1])
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    const ol = OL_RE.exec(line)
    if (ol) {
      const items = [ol[1]]
      i++
      let next: RegExpExecArray | null
      while (i < lines.length && (next = OL_RE.exec(lines[i]))) {
        items.push(next[1])
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph: everything up to a blank line or the start of a
    // different block type. A single '\n' inside becomes a soft <br/>
    // rather than a new paragraph — a blank line is what actually
    // separates paragraphs, matching how the model's own output reads.
    const paraLines = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !HEADING_RE.test(lines[i]) && !UL_RE.test(lines[i]) && !OL_RE.test(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', lines: paraLines })
  }

  return blocks
}

// Matches `code`, **bold**, __bold__, *italic*, _italic_ — deliberately
// not nested (a "small subset", per BOB_queue's own framing, not a full
// CommonMark implementation). Anything without a matching closing
// marker (a stray '*' in ordinary text) just falls through as plain
// text below.
//
// Two fixes from the UI review's Reference-overlay pass (2026-08-16,
// the persona/house-rules packs are heavier markdown than the chat
// answers this started on):
// - `code` spans are real now — backticks used to fall through as
//   literal characters ("shows literal backticks").
// - underscore emphasis requires word boundaries, per CommonMark's own
//   intraword rule: `_TOOLS/dice.py` and `ENCOUNTER_TREASURE_REFERENCE`
//   were being eaten as italics ("underscore-swallowed names"). The
//   lookarounds keep a mid-word `_` as plain text; `*` emphasis is
//   untouched (CommonMark allows it intraword, and nothing real broke
//   on it).
const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|(?<![\w_])__[^_]+__(?![\w_])|\*[^*]+\*|(?<![\w_])_[^_]+_(?![\w_]))/g

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let idx = 0
  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${idx++}`
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-panel px-1 py-0.5 font-mono text-[0.85em] text-ink">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = INLINE_RE.lastIndex
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  return nodes
}

/** A small markdown subset renderer — bold, italic, headings,
 * ordered/unordered lists, line breaks. Written by hand rather than
 * pulling in `react-markdown` (BOB_queue task 2's own call): this keeps
 * typography a closed system, and this repo has no lockfile yet, so a
 * new dependency means someone has to `pnpm install` it before anything
 * builds. Always builds real React elements, never
 * `dangerouslySetInnerHTML` — the input is untrusted model output.
 *
 * Deliberately does NOT map '#'/'##'/'###' onto the app's real H1/H2/H3
 * — those are large Bebas condensed headline type, built for page
 * section headers, and would look wildly out of place inside a compact
 * chat answer. Every heading level renders the same way here: a bold,
 * slightly brighter line, no separate size hierarchy.
 *
 * Used only where structure earns its place — rules-chat surfaces
 * (RulesChat, GmReply's rules-mode reply, LogEntryRow's 'rules' kind).
 * GM narration is fixed at the prompt level instead (see prompt.ts) —
 * narration is supposed to read as prose, so the fix there is asking the
 * model not to emit markdown in the first place, not rendering it once
 * it shows up. */
export function Markdown({ text: source, variant = 'bodySecondary', className }: MarkdownProps) {
  const blocks = parseBlocks(source)
  const bodyClass = variant === 'body' ? text.body : text.bodySecondary

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {blocks.map((block, i) => {
        const key = `block-${i}`
        if (block.type === 'heading') {
          return (
            <p key={key} className={cx(text.body, 'font-semibold')}>
              {renderInline(block.content, key)}
            </p>
          )
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))
          return block.type === 'ul' ? (
            <ul key={key} className={cx(bodyClass, 'list-disc pl-5')}>
              {items}
            </ul>
          ) : (
            <ol key={key} className={cx(bodyClass, 'list-decimal pl-5')}>
              {items}
            </ol>
          )
        }
        return (
          <p key={key} className={bodyClass}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
