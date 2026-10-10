import type { Sim } from '../game/sim'
import { Button, ChoreList, Modal } from '../shared'

export interface ChoresModalProps {
  open: boolean
  sim: Sim
  onClose: () => void
  /** Takes you to a chore; the dialog closes first. */
  onGoTo: (id: string) => void
}

/** The chore list on phones, from the Chores button. Tap a chore to go and do it. */
export function ChoresModal({ open, sim, onClose, onGoTo }: ChoresModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chores"
      footer={
        <Button onClick={onClose} sound={false}>
          Back to the Game
        </Button>
      }
    >
      <p className="mb-3 text-lg text-ink-soft">
        Tap a chore to go and do it. The game waits while this is open.
      </p>
      <ChoreList
        board={sim.chores}
        title=""
        emptyText="Nothing to do. Enjoy it while it lasts."
        onSelect={chore => {
          onClose()
          onGoTo(chore.id)
        }}
      />
    </Modal>
  )
}
