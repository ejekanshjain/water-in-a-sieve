import type { CSSProperties, ReactNode } from 'react'

import { litres } from '../game/captions'
import { seasonName } from '../game/seasons'
import type { Sim } from '../game/sim'
import type { HudSnapshot } from '../game/snapshot'
import { RING_MAX, SLOSH_LEVEL } from '../game/tuning'
import {
  CHORES_SLOT,
  column,
  columnWalkPad,
  CONTEXT_SLOT,
  layout,
  logicalBox,
  METER_ROW,
  topBand,
  WALK_PAD,
  type Box,
  type LayoutState
} from '../scenes/layout'
import {
  Button,
  ChoreList,
  CoinBadge,
  cn,
  formatClock,
  LiveText,
  Meter,
  TimerChip,
  timeLeftMs,
  useChores,
  sfx,
  useNow,
  useStore,
  type RealTimer
} from '../shared'
import {
  goToChore,
  openChores,
  openSettings,
  openShop,
  pressContext,
  type Game
} from '../shell'

export interface HudProps {
  game: Game
}

const ZONES = [
  { from: 0, to: SLOSH_LEVEL },
  { from: SLOSH_LEVEL, to: 1, className: 'bg-marker-yellow/60' }
]

/**
 * The React HUD. On phones it sits in the design's top and bottom bands; on wide screens
 * it moves into columns beside the design, so it never covers the play area.
 */
export function Hud({ game }: HudProps) {
  const l = useStore(layout)
  const snap = useStore(game.hud)
  // Cutscenes get the whole screen.
  if (snap.scene === 'cutscene') return null
  const menu = () => openSettings(game)
  return (
    <div className="pointer-events-none fixed inset-0 font-hand text-ink">
      {l.mode === 'columns' ? (
        <Columns l={l} game={game} snap={snap} onMenu={menu} />
      ) : (
        <Bands l={l} game={game} snap={snap} onMenu={menu} />
      )}
    </div>
  )
}

interface PartProps {
  l: LayoutState
  game: Game
  snap: HudSnapshot
  onMenu: () => void
}

/**
 * A mouse can't reach a button without letting go of the sieve, so while water is in
 * your hands the button gives way to the Esc reminder. A pause frees the mouse, so the
 * button comes back. Touch keeps the button: the grip thumb stays down while another
 * finger taps it.
 */
function MenuSlot({
  snap,
  compact = false,
  onMenu,
  className
}: {
  snap: HudSnapshot
  /** An icon instead of the Settings label, for the phone's crowded top row. */
  compact?: boolean
  onMenu: () => void
  className?: string
}) {
  if (snap.inputMode === 'mouse' && snap.atStake && !snap.paused)
    return (
      <span className={cn('font-marker whitespace-nowrap', className)}>
        {compact ? 'Esc' : 'Esc: Pause'}
      </span>
    )
  return (
    <Button
      variant="ghost"
      onClick={onMenu}
      aria-label={compact ? 'Menu' : undefined}
      className={className}
    >
      {compact ? <MenuIcon /> : 'Settings'}
    </Button>
  )
}

/** Three wobbly lines, drawn like the rest of the game. */
function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-6 fill-none stroke-ink stroke-[3]"
      strokeLinecap="round"
    >
      <path d="M3 6.5 Q12 5 21 6.8 M3.5 12.2 Q12 11 20.5 12 M3 17.6 Q12 18.6 21 17.2" />
    </svg>
  )
}

/**
 * Phones and narrow windows: a top band with one row of 48 px targets and a status line,
 * and a bottom band with the meter row over fixed slots. The Hold to Walk pad fills
 * exactly the rect the input layer hit-tests.
 */
function Bands({ l, game, snap, onMenu }: PartProps) {
  const sim = game.sim
  const top = topBand(l)
  // Text scales with the design, but never below 13 px.
  const font = Math.max(13, 24 * l.scale)
  const touch = snap.inputMode !== 'mouse'
  return (
    <>
      <Area box={top} style={{ fontSize: font }}>
        <div className="flex h-full flex-col justify-end gap-0.5 px-2 pb-0.5">
          <div className="flex items-center justify-between gap-2">
            <ContainerBar snap={snap} className="min-w-0 flex-1" />
            <ShopCoins game={game} snap={snap} />
            <MenuSlot
              snap={snap}
              compact
              onMenu={onMenu}
              className="shrink-0 px-2"
            />
          </div>
          {/* Waits and trouble never get cut off; the trip and season give way. */}
          <div className="flex items-baseline gap-x-[0.4em] leading-tight whitespace-nowrap">
            {snap.refill && <WaitText label="Well" timer={snap.refill} />}
            {snap.glue && <WaitText label="Glue" timer={snap.glue} />}
            {snap.slippersTimer && (
              <WaitText label="Slippers" timer={snap.slippersTimer} />
            )}
            {snap.holes > 0 && (
              <span className="shrink-0 text-marker-red">
                Holes {snap.holes}
              </span>
            )}
            {snap.catDrinking && (
              <span className="shrink-0 text-marker-red">
                {PHONE_DRAIN_LABEL.cat}
              </span>
            )}
            {snap.plugOut && (
              <span className="shrink-0 text-marker-red">
                {PHONE_DRAIN_LABEL.plug}
              </span>
            )}
            <span className="min-w-0 truncate">
              <TripLabel snap={snap} /> · {seasonName(snap.season)}
              {!snap.refill && (
                <>
                  {' · '}
                  <Scoops snap={snap} />
                </>
              )}
            </span>
          </div>
        </div>
      </Area>
      <Area box={logicalBox(l, METER_ROW)} style={{ fontSize: font }}>
        <div className="flex h-full items-center gap-2 px-2">
          <span className="shrink-0">Steady</span>
          <Meter
            label="Steadiness"
            hideLabel
            read={() => sim.state.steady.total}
            max={RING_MAX}
            limit={1}
            zones={ZONES}
            className="min-w-0 flex-1"
          />
          <span className="shrink-0">
            <SieveLitres sim={sim} />
          </span>
          <NoDripBadge state={snap.noDrip} />
        </div>
      </Area>
      {isCall(snap.context) ? (
        // A call takes both slots, so Answer and Decline stay big enough for thumbs.
        <Area box={logicalBox(l, CALL_SLOTS)} style={{ fontSize: font }}>
          <div className="flex h-full items-center gap-2 p-1">
            <CallButtons game={game} snap={snap} slot />
          </div>
        </Area>
      ) : (
        <>
          <Area box={logicalBox(l, CHORES_SLOT)} style={{ fontSize: font }}>
            <ChoresButton game={game} />
          </Area>
          {snap.context && (
            <Area box={logicalBox(l, CONTEXT_SLOT)} style={{ fontSize: font }}>
              <div className="flex h-full items-center p-1">
                <SlotButton
                  label={contextLabel(snap)}
                  onPress={() => pressContext(game)}
                />
              </div>
            </Area>
          )}
        </>
      )}
      {touch && (
        <WalkPad
          box={logicalBox(l, WALK_PAD)}
          fontSize={font * 1.1}
          sim={sim}
          realWalk={snap.realWalk}
        />
      )}
    </>
  )
}

/**
 * Wide screens: columns beside the design. A touch screen this wide (a tablet held
 * sideways) also gets the Hold to Walk pad at the bottom of the right column, and the
 * column's buttons stop above it.
 */
function Columns({ l, game, snap, onMenu }: PartProps) {
  const sim = game.sim
  const touch = snap.inputMode !== 'mouse'
  const left = column(l, 'left')
  const pad = touch ? columnWalkPad(l) : null
  const fullRight = column(l, 'right')
  const right = pad
    ? { ...fullRight, height: pad.top - fullRight.top }
    : fullRight
  return (
    <>
      <Area box={left}>
        <div className="flex h-full flex-col gap-4 bg-paper/80 p-5 text-xl">
          <Meter
            label="Steadiness"
            read={() => sim.state.steady.total}
            max={RING_MAX}
            limit={1}
            zones={ZONES}
          />
          <p>
            Sieve <SieveLitres sim={sim} className="font-marker" />
          </p>
          <p>
            Walked <Distance sim={sim} className="font-marker" />
          </p>
          {snap.holes > 0 && (
            <p className="text-marker-red">
              Holes in the mesh:{' '}
              <span className="font-marker">{snap.holes}</span>
            </p>
          )}
          <NoDripBadge state={snap.noDrip} />
          <GearList snap={snap} />
          <ul className="flex flex-col gap-1 text-lg leading-tight">
            {controlLines(snap).map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {snap.hint && (
            <p className="mt-auto rounded-sketch border-2 border-ink bg-white/90 p-3 text-2xl leading-tight">
              {snap.hint}
            </p>
          )}
        </div>
      </Area>
      <Area box={right}>
        <div className="flex h-full flex-col items-end gap-3 bg-paper/80 p-5 text-xl">
          <p className="font-marker text-3xl">
            <TripLabel snap={snap} />
          </p>
          <SeasonBadge season={snap.season} />
          <ContainerBar snap={snap} className="w-full max-w-72 shrink-0" />
          {snap.catDrinking && <DrainBadge label={DRAIN_LABEL.cat} />}
          {snap.plugOut && <DrainBadge label={DRAIN_LABEL.plug} />}
          <CoinBadge wallet={sim.wallet} />
          <p>
            <Scoops snap={snap} />
          </p>
          {snap.refill && <TimerChip timer={snap.refill} label="Well" />}
          {snap.glue && <TimerChip timer={snap.glue} label="Glue" />}
          {snap.slippersTimer && (
            <TimerChip timer={snap.slippersTimer} label="Slippers" />
          )}
          {isCall(snap.context) ? (
            <div className="flex flex-col items-end gap-2">
              <CallButtons game={game} snap={snap} slot={false} />
            </div>
          ) : snap.context === 'swat' && snap.inputMode === 'mouse' ? (
            // Clicking would let go of the sieve, so the mouse gets the key.
            <KeyLabel keyName="R" label="Swat" />
          ) : (
            snap.context && (
              <Button size="lg" onClick={() => pressContext(game)}>
                {contextLabel(snap)}
              </Button>
            )
          )}
          {/* The list shrinks and scrolls, so Settings never gets pushed off the column. */}
          <div className="pointer-events-auto min-h-0 w-full max-w-72 shrink overflow-y-auto">
            <ChoreList
              board={sim.chores}
              title="Chores"
              emptyText="Nothing to do."
              onSelect={chore => goToChore(game, chore.id)}
            />
          </div>
          <div className="mt-auto flex items-center gap-3">
            {snap.canShop && (
              <Button
                variant="ghost"
                onClick={() => openShop(game)}
                className="text-2xl"
              >
                Shop
              </Button>
            )}
            <MenuSlot snap={snap} onMenu={onMenu} className="text-2xl" />
          </div>
        </div>
      </Area>
      {pad && (
        <WalkPad
          box={pad}
          fontSize={Math.min(36, pad.height * 0.3)}
          sim={sim}
          realWalk={snap.realWalk}
          className="bg-paper/80 p-3"
        />
      )}
    </>
  )
}

/**
 * The Hold to Walk pad. It only shows where to press: the input layer hit-tests the same
 * box per pointer, so the pad itself never takes pointer events.
 */
function WalkPad({
  box,
  fontSize,
  sim,
  realWalk,
  className
}: {
  box: Box
  fontSize: number
  sim: Sim
  realWalk: boolean
  className?: string
}) {
  return (
    <Area box={box} style={{ fontSize }}>
      <div className={cn('h-full p-1', className)}>
        <div
          aria-hidden
          className="flex h-full min-h-12 items-center justify-center rounded-sketch border-[3px] border-ink bg-marker-yellow/70 text-center font-marker leading-none"
        >
          {realWalk ? <RealSteps sim={sim} /> : 'Hold to Walk'}
        </div>
      </div>
    </Area>
  )
}

/**
 * The column's controls list for the input in use. The sieve drifts while you walk, so a
 * mouse steers it back onto the dot rather than resting.
 */
function controlLines(snap: HudSnapshot): string[] {
  if (snap.inputMode === 'mouse')
    return [
      'Mouse or Space: grip',
      'Mouse: steer the sieve onto the dot',
      'W: walk',
      'F: blow at a fly or leaf',
      ...(snap.swatter ? ['R: swat'] : []),
      'E or F: answer or decline a call',
      'Drag circles: crank',
      'Mouse right, or D and A: pour',
      'Esc: pause and settings'
    ]
  const swat = snap.swatter ? ['Swat button: swat'] : []
  if (snap.inputMode === 'motion')
    return [
      'Tablet flat and still: steady',
      'Any thumb down: walk',
      'Finger on a fly or leaf: blow',
      ...swat,
      'Draw circles: crank',
      'Tilt right: pour'
    ]
  return [
    'Thumb on the play area: grip',
    'Grip thumb: steer the sieve onto the dot',
    'Hold to Walk pad: walk',
    'Finger on a fly or leaf: blow',
    ...swat,
    'Draw circles: crank',
    'Grip thumb right: pour'
  ]
}

function Area({
  box,
  style,
  children
}: {
  box: Box
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        ...style
      }}
    >
      {children}
    </div>
  )
}

/** How full the current container is, as a bar with litres. */
function ContainerBar({
  snap,
  className
}: {
  snap: HudSnapshot
  className?: string
}) {
  const capacity = snap.containerCapacityTenths
  const fraction =
    capacity > 0 ? Math.min(1, snap.containerTenths / capacity) : 0
  // Rain shows as a pale band on top: it's in the tub, but not for long.
  const rain =
    capacity > 0 ? Math.min(1 - fraction, snap.rainTenths / capacity) : 0
  const text = `${snap.containerName} ${(snap.containerTenths / 10).toFixed(1)} / ${snap.containerCapacityTenths / 10} L`
  return (
    <div
      role="meter"
      aria-label={snap.containerName}
      aria-valuemin={0}
      aria-valuemax={snap.containerCapacityTenths / 10}
      aria-valuenow={snap.containerTenths / 10}
      className={cn(
        'relative overflow-hidden rounded-sketch border-[3px] border-ink bg-white/90 px-2 py-0.5',
        className
      )}
    >
      <div
        className="absolute inset-y-0 left-0 bg-marker-water/70"
        style={{ width: `${fraction * 100}%` }}
      />
      {rain > 0 && (
        <div
          className="absolute inset-y-0 bg-marker-water/25"
          style={{ left: `${fraction * 100}%`, width: `${rain * 100}%` }}
        />
      )}
      <span className="relative block truncate">{text}</span>
    </div>
  )
}

/** The No-Drip sticker: gold while intact, cracked once you lose water. */
function NoDripBadge({ state }: { state: HudSnapshot['noDrip'] }) {
  if (state === 'none') return null
  const cracked = state === 'cracked'
  return (
    <span
      className={cn(
        'inline-block shrink-0 self-start rounded-full border-2 border-ink px-2 font-marker leading-tight',
        cracked
          ? 'rotate-6 bg-paper-dark text-ink-soft line-through'
          : '-rotate-3 bg-marker-yellow'
      )}
    >
      No-Drip
    </span>
  )
}

/** What's draining the container while you're not looking. */
const DRAIN_LABEL = { cat: 'Cat drinking!', plug: 'Tub draining!' } as const
/** The same, short enough to share the phone's status line with three countdowns. */
const PHONE_DRAIN_LABEL = { cat: 'Cat!', plug: 'Plug out!' } as const

/** A red sticker under the container bar: something is draining it right now. */
function DrainBadge({ label }: { label: string }) {
  return (
    <p className="-rotate-2 rounded-sketch border-2 border-ink bg-marker-red px-3 font-marker text-white">
      ↓ {label}
    </p>
  )
}

/** A call spans the Chores and context slots on phones. */
const CALL_SLOTS = {
  x: CHORES_SLOT.x,
  y: CHORES_SLOT.y,
  width: CHORES_SLOT.width + CONTEXT_SLOT.width,
  height: CHORES_SLOT.height
}

function isCall(context: HudSnapshot['context']): boolean {
  return context === 'call' || context === 'interview'
}

/**
 * Answer and Decline while the phone rings, or the interviewer's two answers while they
 * wait for yours. `slot` draws them for the phone's bottom band.
 */
function CallButtons({
  game,
  snap,
  slot
}: {
  game: Game
  snap: HudSnapshot
  slot: boolean
}) {
  const sim = game.sim
  const asking = snap.context === 'interview'
  const choices = asking
    ? [
        {
          key: 'E',
          label: snap.answerE ?? '',
          press: () => sim.chooseAnswer('e')
        },
        {
          key: 'F',
          label: snap.answerF ?? '',
          press: () => sim.chooseAnswer('f')
        }
      ]
    : [
        { key: 'E', label: 'Answer', press: () => sim.answerCall() },
        { key: 'F', label: 'Decline', press: () => sim.declineCall() }
      ]
  if (slot)
    return choices.map(c => (
      <SlotButton key={c.key} label={c.label} onPress={c.press} />
    ))
  // A mouse holding water can't click without letting go, so it gets the keys instead.
  if (snap.inputMode === 'mouse' && snap.atStake)
    return choices.map(c => (
      <KeyLabel key={c.key} keyName={c.key} label={c.label} />
    ))
  return choices.map(c => (
    <Button key={c.key} size="lg" onClick={c.press}>
      {c.label} <span className="text-ink-soft">({c.key})</span>
    </Button>
  ))
}

/**
 * A key to press instead of a button, for a mouse that's holding water. It looks like a
 * keycap, not a button, so nobody lets go of the sieve to click it.
 */
function KeyLabel({ keyName, label }: { keyName: string; label: string }) {
  return (
    <p className="flex items-center gap-3 font-marker text-2xl">
      <kbd className="inline-flex size-12 items-center justify-center rounded-lg border-[3px] border-b-[6px] border-ink bg-white font-marker text-2xl">
        {keyName}
      </kbd>
      {label}
    </p>
  )
}

/**
 * The phone's coin badge, which opens the shop wherever the shop opens. Elsewhere it's
 * just the count.
 */
function ShopCoins({ game, snap }: { game: Game; snap: HudSnapshot }) {
  const badge = <CoinBadge wallet={game.sim.wallet} />
  if (!snap.canShop) return <div className="shrink-0">{badge}</div>
  return (
    <button
      type="button"
      onClick={event => {
        sfx.play('click')
        openShop(game)
        if (event.detail > 0) event.currentTarget.blur()
      }}
      aria-label="Shop"
      className="pointer-events-auto relative shrink-0 rounded-sketch focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-marker-blue active:translate-y-0.5"
    >
      {badge}
      <span className="absolute -top-1.5 -right-1.5 rotate-6 rounded-sketch border-2 border-ink bg-marker-yellow px-1.5 font-marker text-[0.7em] leading-tight">
        Shop
      </span>
    </button>
  )
}

/** What you own and its upkeep, for the desktop column. */
function GearList({ snap }: { snap: HudSnapshot }) {
  const lines: string[] = []
  if (snap.waxTrips > 0)
    lines.push(
      `Wax: ${snap.waxTrips} ${snap.waxTrips === 1 ? 'trip' : 'trips'} left`
    )
  else if (snap.waxTrips === 0) lines.push('Wax: worn off')
  if (snap.slippers !== 'none')
    lines.push(`Slippers: ${SLIPPER_TEXT[snap.slippers]}`)
  if (snap.stonesLeft > 0) lines.push(`Stones: ${snap.stonesLeft} left`)
  if (snap.treatTrips > 0)
    lines.push(
      `Cat treats: ${snap.treatTrips} ${snap.treatTrips === 1 ? 'trip' : 'trips'}`
    )
  if (lines.length === 0) return null
  return (
    <ul className="flex flex-col gap-0.5 text-lg leading-tight">
      {lines.map(line => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

const SLIPPER_TEXT: Record<HudSnapshot['slippers'], string> = {
  none: '',
  dry: 'on',
  soaked: 'soaked',
  drying: 'on the line'
}

/** What the context slot's button says for each action. */
const CONTEXT_LABEL: Record<NonNullable<HudSnapshot['context']>, string> = {
  call: 'Answer',
  interview: 'Answer',
  swat: 'Swat',
  wipe: 'Wipe',
  scrape: 'Scrape',
  sweep: 'Sweep',
  stone: 'Lay Stone',
  share: 'Share This Fail',
  goHouse: 'Go to House',
  goWell: 'Go to Well',
  realWalk: 'Walk for Real'
}

/** The context button's label. A milestone is no fail, so its Share says so. */
function contextLabel(snap: HudSnapshot): string {
  if (snap.context === 'share' && snap.share === 'milestone')
    return 'Share This'
  return snap.context ? CONTEXT_LABEL[snap.context] : ''
}

/** The phone's Chores button with a count badge; the list opens in a dialog. */
function ChoresButton({ game }: { game: Game }) {
  const count = useChores(game.sim.chores).length
  return (
    <div className="flex h-full items-center p-1">
      <SlotButton
        label="Chores"
        ariaLabel={`Chores: ${count}`}
        dashed={count === 0}
        onPress={() => openChores(game)}
      >
        <span className="min-w-6 rounded-full border-2 border-ink bg-paper px-1 text-center text-[0.85em]">
          {count}
        </span>
      </SlotButton>
    </div>
  )
}

/**
 * A button for the phone's narrow bottom-band slots. The shared Button's padding doesn't
 * fit, so this copies its look with a stacked label.
 */
function SlotButton({
  label,
  ariaLabel,
  dashed = false,
  onPress,
  children
}: {
  label: string
  ariaLabel?: string
  dashed?: boolean
  onPress: () => void
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={event => {
        sfx.play('click')
        onPress()
        if (event.detail > 0) event.currentTarget.blur()
      }}
      aria-label={ariaLabel}
      className={cn(
        'pointer-events-auto flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-sketch border-[3px] border-ink px-1 py-1 text-center font-marker leading-none tracking-wide select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-marker-blue active:translate-y-0.5 active:scale-95',
        dashed
          ? 'border-dashed bg-paper/70'
          : 'bg-marker-yellow shadow-[3px_4px_0_var(--color-ink)]'
      )}
    >
      <span>{label}</span>
      {children}
    </button>
  )
}

/** The trip number, or the bathtub's Last Trip label in red. */
function TripLabel({ snap }: { snap: HudSnapshot }) {
  if (snap.lastTrip === 'no') return <>Trip {Math.max(1, snap.trip)}</>
  return (
    <span className="font-marker text-marker-red">
      {snap.lastTrip === 'really' ? 'Last Trip (Really)' : 'Last Trip'}
    </span>
  )
}

const SEASON_STYLE: Record<HudSnapshot['season'], string> = {
  summer: 'bg-marker-yellow',
  autumn: 'bg-marker-orange',
  winter: 'bg-marker-water',
  spring: 'bg-marker-green text-white'
}

/** The season as a little hand-cut sticker. */
function SeasonBadge({ season }: { season: HudSnapshot['season'] }) {
  return (
    <span
      className={cn(
        'inline-block rotate-2 rounded-sketch border-2 border-ink px-3 font-marker leading-tight',
        SEASON_STYLE[season]
      )}
    >
      {seasonName(season)}
    </span>
  )
}

/** Scoops left in the raised bucket, or why there are none. */
function Scoops({ snap }: { snap: HudSnapshot }) {
  if (snap.bucketUp) return <>Scoops left: {snap.scoopsLeft}</>
  return <>{snap.refill ? 'Well refilling' : 'Well bucket down'}</>
}

/** A compact countdown for the phone status line, such as "Well 0:42". */
function WaitText({ label, timer }: { label: string; timer: RealTimer }) {
  const now = useNow(250)
  const left = timeLeftMs(timer, now)
  return (
    <span role="timer" className="shrink-0 tabular-nums">
      {label} {left > 0 ? formatClock(left) : 'ready'}
    </span>
  )
}

/** Sieve litres, updated every frame without re-rendering React. */
function SieveLitres({ sim, className }: { sim: Sim; className?: string }) {
  let shownTenths = -1
  let text = ''
  return (
    <LiveText
      className={className}
      read={() => {
        const tenths = Math.round(sim.state.sieve.inSieve / 100)
        if (tenths !== shownTenths) {
          shownTenths = tenths
          text = litres(tenths * 100)
        }
        return text
      }}
    />
  )
}

/**
 * Walking for real, the walk pad counts this trip's steps. Off the carry, thumbs run as
 * well as steps, so it says so.
 */
function RealSteps({ sim }: { sim: Sim }) {
  let shown = -2
  let text = ''
  return (
    <span className="flex flex-col items-center gap-1">
      <LiveText
        read={() => {
          const s = sim.state
          const carrying = s.scene === 'path' || s.phase === 'enter'
          const steps = carrying ? s.realWalk.steps : -1
          if (steps !== shown) {
            shown = steps
            text =
              steps < 0
                ? 'Walk or Hold'
                : steps === 1
                  ? '1 Step'
                  : `${steps} Steps`
          }
          return text
        }}
      />
      <span className="font-hand text-[0.7em]">Walk for real</span>
    </span>
  )
}

/** Metres walked, updated every frame without re-rendering React. */
function Distance({ sim, className }: { sim: Sim; className?: string }) {
  let shown = -1
  let text = ''
  return (
    <LiveText
      className={className}
      read={() => {
        const metres = Math.floor(sim.state.walker.distance)
        if (metres !== shown) {
          shown = metres
          text = `${metres} m`
        }
        return text
      }}
    />
  )
}
