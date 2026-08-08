import { LogEntryRow } from '../../../components/ui/LogEntryRow'
import { Section } from '../Section'
import { Specimen } from '../Specimen'

export function LogEntrySection() {
  return (
    <Section
      id="sec-log"
      number="013"
      group="Components"
      title="Log Entries"
      description="The scene log / party chat row — six entry kinds: Journal v1's original five (journal-mockup.html, repo root) plus 'rules', added for BOB_queue task 1's unified feed. Sender color is per-character data (SPEC's 'one PC color everywhere' rule), applied inline rather than as a Tailwind class; only system entries mute it to a fixed ink-dim tone, since that's the one kind that always speaks in a fixed system voice — narration follows senderColor like any other kind, so AI GM narration can render in its own cyan while a hand-typed entry with no real actor_color still falls back to the same muted gray it always had. Rules entries are gm_chat exchanges merged into the feed for display only — never a real journal_entries row — both the question and the answer get the same quiet orange-tinted card, so an exchange reads as one digression at a glance, and their body renders through a small markdown subset renderer (bold, italic, headings, lists — BOB_queue task 2) since the rules assistant is asked to structure its answers. Every other kind renders plain text on purpose — narration is fixed at the prompt level instead, so it reads as prose rather than picking up stray markdown syntax."
    >
      <div className="flex flex-col gap-2">
        <Specimen tag="LOG_ENTRY_ROW" state="NARRATION">
          <LogEntryRow
            senderName="GM"
            senderColor="#66666f"
            message="The northeast hall opens before you. A bull statue of black iron dominates the chamber."
            timestamp="9:12 pm"
            kind="narration"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="ACTION">
          <LogEntryRow
            senderName="Bjorn"
            senderColor="#9b5cff"
            message="Approaches the statue slowly, torch high."
            timestamp="9:14 pm"
            kind="action"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="ROLL" tone="purple">
          <LogEntryRow
            senderName="Bjorn"
            senderColor="#9b5cff"
            message="WIS check to spot the trap — d20+1 -> 16 vs DC 12. Success."
            timestamp="9:15 pm"
            kind="roll"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="NOTE" tone="yellow">
          <LogEntryRow
            senderName="Bjorn"
            senderColor="#9b5cff"
            message="Statue's eyes might hold gems — come back with a pry bar."
            timestamp="9:19 pm"
            kind="note"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="SYSTEM" tone="faint">
          <LogEntryRow
            senderName="System"
            senderColor="#66666f"
            message="Torch burns low — 38 minutes remaining."
            timestamp="9:18 pm"
            kind="system"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="RULES" tone="orange">
          <LogEntryRow
            senderName="Rules"
            senderColor="#ff8a3d"
            message={'A shield gives **+1 AC** and can\'t stack with a second shield (pg. 12).\n\nActive Modes of Play:\n- Hunter\n- Momentum'}
            timestamp="9:21 pm"
            kind="rules"
            className="w-full"
          />
        </Specimen>
      </div>
    </Section>
  )
}
