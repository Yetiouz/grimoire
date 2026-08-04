import { LogEntryRow } from '../../../components/ui/LogEntryRow'
import { Section } from '../Section'

export function LogEntrySection() {
  return (
    <Section
      title="Log entry row"
      description="Also new — the scene log / party chat row. Sender color is per-character data (SPEC's 'one PC color everywhere' rule), so it's applied inline rather than as a Tailwind class. 'system' entries get a panel2 background; 'roll' entries get a small ROLL tag."
    >
      <div className="flex flex-col divide-y divide-line-soft rounded-card border border-line bg-panel p-2">
        <LogEntryRow senderName="Bjorn" senderColor="#9b5cff" message="Kicks open the iron door." timestamp="2m ago" />
        <LogEntryRow
          senderName="Allindra"
          senderColor="#35f0ff"
          message="Rolls to disarm the trap."
          kind="roll"
          timestamp="1m ago"
        />
        <LogEntryRow senderName="System" senderColor="#a5a5ae" message="Round 3 begins." kind="system" timestamp="just now" />
      </div>
    </Section>
  )
}
