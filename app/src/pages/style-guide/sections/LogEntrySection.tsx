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
      description="The scene log / party chat row — five entry kinds from Journal v1's taxonomy (journal-mockup.html, repo root). Sender color is per-character data (SPEC's 'one PC color everywhere' rule), applied inline rather than as a Tailwind class; narration and system entries mute it to a fixed ink-dim/ink-faint tone since they speak in the GM/system voice, not a character's."
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
      </div>
    </Section>
  )
}
