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
      description="Also new — the scene log / party chat row. Sender color is per-character data (SPEC's 'one PC color everywhere' rule), so it's applied inline rather than as a Tailwind class. 'system' entries get a panel2 background; 'roll' entries get a small ROLL tag."
    >
      <div className="flex flex-col gap-2">
        <Specimen tag="LOG_ENTRY_ROW" state="DEFAULT">
          <LogEntryRow
            senderName="Bjorn"
            senderColor="#9b5cff"
            message="Kicks open the iron door."
            timestamp="2m ago"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="ROLL">
          <LogEntryRow
            senderName="Allindra"
            senderColor="#35f0ff"
            message="Rolls to disarm the trap."
            kind="roll"
            timestamp="1m ago"
            className="w-full"
          />
        </Specimen>
        <Specimen tag="LOG_ENTRY_ROW" state="SYSTEM" tone="faint">
          <LogEntryRow
            senderName="System"
            senderColor="#a5a5ae"
            message="Round 3 begins."
            kind="system"
            timestamp="just now"
            className="w-full"
          />
        </Specimen>
      </div>
    </Section>
  )
}
