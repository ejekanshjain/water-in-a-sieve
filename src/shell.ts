import {
  failCard,
  GAME_NAME,
  milestoneCard,
  nearMissCard,
  type CardText
} from './game/share'
import { Sim } from './game/sim'
import { createHudStore, type HudSnapshot } from './game/snapshot'
import type { InputFrame } from './game/types'
import type { FailShot } from './scenes/film'
import { PhoneTilt } from './scenes/motion'
import {
  createStore,
  toast,
  type Motion,
  type ShareCardInput,
  type Store
} from './shared'

const params = new URLSearchParams(location.search)
/** Dev only: `?skip` starts at the well with no start screen and no cold open, for automation. */
export const SKIP =
  import.meta.env.DEV && (params.has('skip') || params.has('ending'))
/** Dev only: `?ending` fills the tub and plays the ending as soon as the game loads. */
export const ENDING = import.meta.env.DEV && params.has('ending')
/**
 * Dev only: `?tray` treats any device as a phone: the start screen offers Walk for Real
 * and "Hold It Like a Tray" follows the start tap, for browser tests.
 */
export const FORCE_TRAY = import.meta.env.DEV && params.has('tray')

/** Overlays React shows over the game. Each one pauses the game while it shows. */
export interface UiState {
  modal: 'settings' | 'chores' | 'shop' | 'replay' | 'share' | null
  /** A phone held sideways covers the game. */
  sideways: boolean
  /** The drain the replay dialog plays. */
  replay: FailShot | null
  /** The card the share dialog shows, and the message sent with it. */
  card: ShareCardInput | null
  cardText: string
  /** Fails and near misses are shameful; milestones are something to show off. */
  shame: boolean
}

/** Pictures for share cards, kept by the renderer's film. */
export interface Shots {
  /** The latest drain on film; its clip lasts until the next drain. */
  fail: FailShot | null
  /** The latest still of a near miss, a milestone or the full tub. */
  moment: HTMLCanvasElement | null
}

/** Everything that lives for the whole page: one simulation and its HUD store. */
export interface Game {
  sim: Sim
  hud: Store<HudSnapshot>
  ui: Store<UiState>
  /** False until the start tap: the sim waits behind the start screen. */
  started: boolean
  /** Motion sensors, created on the start tap unless access was denied. */
  motion: Motion | null
  /** The phone as the sieve: calibration and tilt over `motion`. */
  tilt: PhoneTilt
  /** Dev tools swap in a frame source here, such as the autopilot. */
  pilot: ((input: InputFrame) => InputFrame) | null
  /** Ends every press as a pause; set once the input layer exists. */
  suspendInput: () => void
  shots: Shots
}

export function createGame(): Game {
  return {
    sim: new Sim(Math.floor(Math.random() * 1e9)),
    hud: createHudStore(),
    ui: createStore<UiState>({
      modal: null,
      sideways: false,
      replay: null,
      card: null,
      cardText: '',
      shame: true
    }),
    started: SKIP,
    motion: null,
    tilt: new PhoneTilt(),
    pilot: null,
    suspendInput: () => {},
    shots: { fail: null, moment: null }
  }
}

/** Opens Settings. The game pauses first, so no press held under the dialog can tip the sieve. */
export function openSettings(game: Game): void {
  openModal(game, 'settings')
}

/** Opens the chore list on phones, where it has no room on screen. It pauses like Settings. */
export function openChores(game: Game): void {
  openModal(game, 'chores')
}

/** Opens the shop, where it opens at all: an empty sieve, at the well or in the house. */
export function openShop(game: Game): void {
  if (!game.sim.canShop()) return
  game.sim.state.hintsDone.shop = true
  openModal(game, 'shop')
}

/**
 * A drain's clip is ready. It becomes the walk back's Share picture, and an automatic
 * replay opens when the sim says one is due and nothing else covers the game.
 */
export function noteFail(game: Game, shot: FailShot): void {
  game.shots.fail = shot
  if (shot.drain.replay && !covered(game)) openReplay(game, shot)
}

/** Opens the slow-mo replay of a drain. It pauses like Settings. */
export function openReplay(game: Game, shot: FailShot): void {
  if (game.ui.get().modal) return
  game.ui.set({ replay: shot })
  openModal(game, 'replay')
}

/** Share from the replay dialog: the dialog turns into the share dialog, still paused. */
export function shareReplay(game: Game): void {
  const shot = game.ui.get().replay
  if (!shot) return
  showCard(game, failCard(shot.drain, shot.lostMl), shot.clip.still, true)
}

/** The context slot's button: Share opens the share dialog, the rest are sim actions. */
export function pressContext(game: Game): void {
  if (game.sim.contextAction() === 'share') openShare(game)
  else game.sim.doContext()
}

/** Opens the share dialog for this walk back's card: the drain, a near miss or a milestone. */
export function openShare(game: Game): void {
  const sim = game.sim
  const moment = sim.state.share
  if (!moment || game.ui.get().modal) return
  const lost = sim.lostMl()
  if (moment.kind === 'fail') {
    const drain = sim.state.lastDrain
    if (!drain) return
    // The film's clip is this drain's when it carries the same trip; otherwise no picture.
    const shot = game.shots.fail
    const picture = shot?.drain.trip === drain.trip ? shot.clip.still : null
    openCard(game, failCard(drain, shot?.lostMl ?? lost), picture, true)
  } else if (moment.kind === 'nearMiss') {
    openCard(game, nearMissCard(moment, lost), game.shots.moment, true)
  } else {
    const card = milestoneCard(moment, lost, sim.playedMs())
    openCard(game, card, game.shots.moment, false)
  }
}

function openCard(
  game: Game,
  text: CardText,
  picture: HTMLCanvasElement | null,
  shame: boolean
): void {
  game.sim.pause()
  game.suspendInput()
  showCard(game, text, picture, shame)
}

function showCard(
  game: Game,
  { text, ...card }: CardText,
  picture: HTMLCanvasElement | null,
  shame: boolean
): void {
  game.ui.set({
    modal: 'share',
    card: { game: GAME_NAME, ...card, image: picture ?? undefined },
    cardText: text,
    shame
  })
}

function openModal(game: Game, modal: NonNullable<UiState['modal']>): void {
  if (game.ui.get().modal) return
  game.sim.pause()
  game.suspendInput()
  game.ui.set({ modal })
}

/**
 * Takes you to a chore from the chore list: mending opens the workbench at the well.
 * Anywhere else it says where the chore gets done.
 */
export function goToChore(game: Game, id: string): void {
  const s = game.sim.state
  if (id === 'mend') {
    if (s.scene === 'well' && s.sieve.inSieve === 0 && game.sim.openBench())
      return
    toast('Mend the sieve at the well, with the sieve empty.', 'info')
    return
  }
  if (id === 'frog') {
    toast('The frog is on the crank at the well. Drag it off.', 'info')
    return
  }
  if (id === 'rewax') {
    if (s.scene === 'well' && game.sim.openBench('wax')) return
    toast('Rewax at the well, with the sieve empty.', 'info')
    return
  }
  if (id === 'slippers') {
    if (game.sim.hangSlippers()) return
    toast('Hang your slippers on the washing line at the well.', 'info')
    return
  }
  const chore = game.sim.chores.list().find(c => c.id === id)
  if (chore?.detail) toast(chore.detail, 'info')
}

/** True while a dialog or the sideways prompt covers the game. */
export function covered(game: Game): boolean {
  const ui = game.ui.get()
  return ui.modal !== null || ui.sideways
}

/** Closes the open dialog. The game carries on unless water is in your hands. */
export function closeModal(game: Game): void {
  game.ui.set({ modal: null })
  if (!covered(game)) game.sim.resume()
}
