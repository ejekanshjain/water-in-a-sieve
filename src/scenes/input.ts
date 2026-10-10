import { HandMotion } from '../game/hand'
import {
  BLOW_HIT_RADIUS,
  TOUCH_GRACE_MS,
  TOUCH_GRACE_SCALE
} from '../game/tuning'
import {
  emptyInput,
  type InputFrame,
  type InputMode,
  type ReleaseKind
} from '../game/types'
import {
  isGameInputBlocked,
  Keyboard,
  PointerTracker,
  prefersMotion,
  sfx,
  type Point
} from '../shared'
import { PhoneTilt } from './motion'

/** Keys that walk on desktop. */
export const WALK_KEYS = ['KeyW', 'ArrowUp'] as const
/** Keys that raise and lower the pour. */
const POUR_UP_KEYS = ['KeyD', 'ArrowRight'] as const
const POUR_DOWN_KEYS = ['KeyA', 'ArrowLeft'] as const
/** Key that blows at a fly or leaf on desktop, and declines a call. */
const BLOW_KEY = 'KeyF'
/** Key that answers a call. */
const ANSWER_KEY = 'KeyE'
/** Key that swings the fly swatter. */
const SWAT_KEY = 'KeyR'
/** Grip id used while Space holds the sieve. */
export const SPACE_GRIP = -1

/** A rectangle in logical units. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function inRect(rect: Rect | null, x: number, y: number): boolean {
  return (
    rect !== null &&
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

/** How much motion jolt counts this long after a touch press or release: thumbs shake phones. */
export function touchGrace(msSinceTouch: number): number {
  return msSinceTouch < TOUCH_GRACE_MS ? TOUCH_GRACE_SCALE : 1
}

/** What the input layer knows when a grip ends. */
export interface ReleaseInfo {
  /** The DOM event type that ended it: 'pointerup', 'pointercancel' or 'keyup'. */
  eventType: string
  /** The simulation is paused. */
  paused: boolean
  /** A pause trigger (blur, Esc, hidden tab) fired in this same frame. */
  pauseThisFrame: boolean
  /** A dialog is blocking game input. */
  blocked: boolean
  /** `document.hasFocus()`. */
  hasFocus: boolean
}

/**
 * Decides whether a grip release is a real let-go or a pause. Blur, dialogs, cancelled
 * pointers and pauses must never tip the sieve: fails come from your hands.
 */
export function classifyRelease(info: ReleaseInfo): ReleaseKind {
  if (
    info.eventType === 'pointercancel' ||
    info.paused ||
    info.pauseThisFrame ||
    info.blocked ||
    !info.hasFocus
  )
    return 'pause'
  return 'letGo'
}

/** The parts of a pointer the grip logic reads, so tests can pass plain objects. */
export interface PointerLike {
  id: number
  type: string
  x: number
  y: number
}

/**
 * Who holds the sieve and who walks, tracked per pointer id. The grip is the pointer
 * that pressed in the play area; on touch screens a pointer that started in the walk pad
 * walks instead. In motion mode the phone is the grip, so every touch walks, and a touch
 * press still counts as a grip press for resuming. A press only grips from a real
 * `pointerdown`, so the shared tracker handing the primary to another finger can never
 * count as a re-grab.
 */
export class GripControl {
  /** Pointer id holding the sieve, SPACE_GRIP for Space, or null. */
  gripId: number | null = null
  /** Pointers that started on the walk pad. */
  readonly walkIds = new Set<number>()
  /** The grip is a finger, not a mouse, pen or Space. */
  private gripTouch = false
  private pressed = false
  private released: ReleaseKind = 'none'

  /** A pointer went down. Returns what it does. */
  down(
    pointer: PointerLike,
    onWalkPad: boolean,
    motion = false
  ): 'grip' | 'walk' | 'none' {
    if (pointer.type !== 'mouse' && (onWalkPad || motion)) {
      this.walkIds.add(pointer.id)
      if (motion) this.pressed = true
      return 'walk'
    }
    if (this.gripId !== null) return 'none'
    this.gripId = pointer.id
    this.gripTouch = pointer.type === 'touch'
    this.pressed = true
    return 'grip'
  }

  /** A pointer went up, with its release already classified. */
  up(id: number, kind: ReleaseKind): void {
    this.walkIds.delete(id)
    if (id !== this.gripId) return
    this.gripId = null
    this.released = kind
  }

  /** Space went down: it grips when no pointer already does. */
  spaceDown(): boolean {
    if (this.gripId !== null) return false
    this.gripId = SPACE_GRIP
    this.gripTouch = false
    this.pressed = true
    return true
  }

  spaceUp(kind: ReleaseKind): void {
    this.up(SPACE_GRIP, kind)
  }

  /**
   * Another input set took over: a grip from the other kind of device stops counting, so
   * the new one can take hold. No release is reported; the sim handles the switch itself.
   */
  switchTo(mode: InputMode): void {
    if (this.gripId === null) return
    if (this.gripTouch === (mode === 'touch')) return
    this.gripId = null
  }

  /** A dialog took over: the grip ends as a pause and walking stops. */
  cancelAll(): void {
    this.walkIds.clear()
    if (this.gripId === null) return
    this.gripId = null
    this.released = 'pause'
  }

  /** Reads and clears the one-shot press flag. */
  takePressed(): boolean {
    const pressed = this.pressed
    this.pressed = false
    return pressed
  }

  /** Reads and clears the one-shot release. A pause wins over a let-go in the same step. */
  takeReleased(): ReleaseKind {
    const kind = this.released
    this.released = 'none'
    return kind
  }
}

/** A press that a scene turned into a gesture, such as cranking or dragging the frog. */
export interface GestureHandler {
  move(x: number, y: number, timeMs: number): void
  /** The pointer lifted; `kind` says whether it was a real let-go or a pause. */
  end(kind: ReleaseKind): void
}

/** Lets the current scene claim a press as a gesture. Return null to grip instead. */
export type PressHandler = (
  pointer: PointerLike,
  timeMs: number
) => GestureHandler | null

/**
 * Turns pointer, keyboard and focus events into one `InputFrame` per update step. Call
 * `sampleFrame` once per rendered frame and `read` once per step.
 */
export class InputSystem {
  readonly pointer: PointerTracker
  readonly keys = new Keyboard()
  readonly hand = new HandMotion()
  readonly grip = new GripControl()

  /** Dev and test override, merged into every frame until cleared. */
  override: Partial<InputFrame> | null = null
  /** Hold to Walk pad in logical units, set by the HUD layout; null hides it. */
  walkPad: Rect | null = null
  /** Called when a pause trigger fires: blur, hidden tab or a classified pause release. */
  onPause: (() => void) | null = null
  /** Called when Esc asks for the pause menu, after `onPause`. */
  onMenu: (() => void) | null = null
  /** Called when the window gets focus back or the tab shows again. */
  onReturn: (() => void) | null = null
  /** Reads whether the simulation is paused, for release classification. */
  isPaused: () => boolean = () => false
  /** The current scene's gesture hook, checked before a press grips. */
  pressHandler: PressHandler | null = null
  /**
   * Where something you can blow at is (a falling leaf), in logical units, or null. On
   * touch screens a press that starts near it blows instead of walking or gripping.
   */
  blowTarget: (() => Point | null) | null = null
  /** Touch pointers held on the blow target. */
  private readonly blowIds = new Set<number>()
  /** One-shot key presses since the last step: E answers a call, F declines it, R swats. */
  private answerPressed = false
  private declinePressed = false
  private swatPressed = false
  private readonly gestures = new Map<number, GestureHandler>()
  private readonly frame = emptyInput()
  private frameNo = 0
  private pauseFrame = -10
  /** The input set at the latest check, to notice another one taking over. */
  private lastMode: InputMode = 'mouse'
  /** `performance.now()` of the latest touch press or release, for touch grace. */
  private lastTouchAt = -1e9
  private readonly stops: (() => void)[] = []

  constructor(
    canvas: HTMLCanvasElement,
    toLogical: (x: number, y: number, out: Point) => Point,
    /** The phone as the sieve; its source arrives with the start tap. */
    readonly tilt = new PhoneTilt()
  ) {
    this.pointer = new PointerTracker(canvas, { toLogical })
    const p = this.pointer
    this.stops.push(
      p.onDown((pointer, event) => {
        sfx.unlock()
        if (pointer.type === 'touch') this.lastTouchAt = performance.now()
        this.syncMode()
        const onPad = inRect(this.walkPad, pointer.x, pointer.y)
        const gesture =
          onPad && pointer.type !== 'mouse'
            ? null
            : this.pressHandler?.(pointer, event.timeStamp)
        if (gesture) {
          this.gestures.set(pointer.id, gesture)
          return
        }
        if (this.blows(pointer)) {
          this.blowIds.add(pointer.id)
          return
        }
        const role = this.grip.down(pointer, onPad, this.mode === 'motion')
        if (role === 'grip')
          this.hand.reset(pointer.x, pointer.y, event.timeStamp)
      }),
      p.onMove((pointer, event) => {
        this.gestures
          .get(pointer.id)
          ?.move(pointer.x, pointer.y, event.timeStamp)
        const id = this.grip.gripId
        const tracksHover = id === SPACE_GRIP && pointer.type === 'mouse'
        if (id === pointer.id || tracksHover)
          this.hand.move(pointer.x, pointer.y, event.timeStamp)
      }),
      p.onUp((pointer, event) => {
        if (pointer.type === 'touch') this.lastTouchAt = performance.now()
        const kind = this.classify(event.type)
        const gesture = this.gestures.get(pointer.id)
        if (gesture) {
          this.gestures.delete(pointer.id)
          gesture.end(kind)
          return
        }
        if (this.blowIds.delete(pointer.id)) return
        this.grip.up(pointer.id, kind)
      }),
      this.keys.onPress('Space', () => {
        sfx.unlock()
        if (this.grip.spaceDown()) this.hand.reset(p.x, p.y, performance.now())
      }),
      this.keys.onRelease('Space', event => {
        this.grip.spaceUp(this.classify(event.type))
      }),
      this.keys.onPress(ANSWER_KEY, () => {
        this.answerPressed = true
      }),
      this.keys.onPress(BLOW_KEY, () => {
        this.declinePressed = true
      }),
      this.keys.onPress(SWAT_KEY, () => {
        this.swatPressed = true
      }),
      this.keys.onPress('Escape', () => {
        this.triggerPause()
        this.onMenu?.()
      })
    )
    const blur = () => this.triggerPause()
    const focus = () => this.onReturn?.()
    // A turned phone pauses, then levels itself again once held still.
    const rotate = () => {
      this.triggerPause()
      if (this.tilt.calibrated) this.tilt.request('rotate')
    }
    screen.orientation?.addEventListener('change', rotate)
    const visibility = () => {
      if (document.visibilityState === 'hidden') this.triggerPause()
      else this.onReturn?.()
    }
    // Capture runs before the pointer and key trackers release, so their releases
    // already see this frame's pause.
    window.addEventListener('blur', blur, true)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    this.stops.push(() => {
      window.removeEventListener('blur', blur, true)
      window.removeEventListener('focus', focus)
      screen.orientation?.removeEventListener('change', rotate)
      document.removeEventListener('visibilitychange', visibility)
    })
  }

  /**
   * The input set the player is using now: motion once the phone is calibrated and a
   * finger plays, otherwise touch or mouse from the latest press.
   */
  get mode(): InputMode {
    if (this.tilt.calibrated && prefersMotion(this.tilt.source, this.pointer))
      return 'motion'
    return this.pointer.lastType === 'touch' ? 'touch' : 'mouse'
  }

  /** Marks a pause trigger in this frame and tells the game. */
  triggerPause(): void {
    this.pauseFrame = this.frameNo
    this.onPause?.()
  }

  /**
   * Ends every press as a pause, for a dialog opening over the game. A pointer held under
   * the dialog may never send its pointerup, so nothing may wait for one.
   */
  suspend(): void {
    this.grip.cancelAll()
    this.blowIds.clear()
    for (const gesture of this.gestures.values()) gesture.end('pause')
    this.gestures.clear()
  }

  /** Once per rendered frame: measures hand acceleration over real frame time. */
  sampleFrame(timeMs: number): void {
    this.frameNo++
    this.hand.frame(timeMs)
  }

  /** Once per update step: builds the input frame. One-shot presses clear after reading. */
  read(): InputFrame {
    const f = this.frame
    const grip = this.grip
    const mode = this.syncMode()
    const motion = mode === 'motion'
    f.mode = mode
    // In motion mode the phone itself is the grip: it never lets go, it only pauses.
    f.grip = motion || grip.gripId !== null
    f.gripId = motion ? -1 : (grip.gripId ?? -1)
    f.gripPressed = grip.takePressed()
    const released = grip.takeReleased()
    f.release = motion && released === 'letGo' ? 'none' : released
    const held =
      grip.gripId !== null && grip.gripId !== SPACE_GRIP
        ? this.pointer.pointers.get(grip.gripId)
        : undefined
    f.x = held ? held.x : this.pointer.x
    f.y = held ? held.y : this.pointer.y
    f.handAccel = f.grip && !motion ? this.hand.accel : 0
    const source = this.tilt.source
    f.motionJolt =
      motion && source
        ? source.jolt * touchGrace(performance.now() - this.lastTouchAt)
        : 0
    f.tiltX = motion ? this.tilt.tiltX : 0
    f.tiltY = motion ? this.tilt.tiltY : 0
    f.walk =
      this.keys.anyDown(WALK_KEYS) ||
      (mode !== 'mouse' && grip.walkIds.size > 0)
    f.pour = this.keys.axis(POUR_DOWN_KEYS, POUR_UP_KEYS)
    f.blow = this.keys.isDown(BLOW_KEY) || this.blowIds.size > 0
    f.swat = this.swatPressed
    f.answer = this.answerPressed
    f.decline = this.declinePressed
    this.answerPressed = this.declinePressed = this.swatPressed = false
    if (this.override) Object.assign(f, this.override)
    return f
  }

  dispose(): void {
    for (const stop of this.stops) stop()
    this.pointer.dispose()
    this.keys.dispose()
  }

  /**
   * A finger pressed near the blow target blows at it, as long as the sieve is already in
   * hand: the phone itself, or another finger gripping. A mouse blows with F instead.
   */
  private blows(pointer: PointerLike): boolean {
    if (pointer.type === 'mouse') return false
    if (this.mode !== 'motion' && this.grip.gripId === null) return false
    const target = this.blowTarget?.()
    if (!target) return false
    return (
      Math.hypot(pointer.x - target.x, pointer.y - target.y) <= BLOW_HIT_RADIUS
    )
  }

  /** Notices another input set taking over and drops the old one's grip. */
  private syncMode(): InputMode {
    const mode = this.mode
    if (mode !== this.lastMode) {
      this.lastMode = mode
      this.grip.switchTo(mode)
    }
    return mode
  }

  private classify(eventType: string): ReleaseKind {
    return classifyRelease({
      eventType,
      paused: this.isPaused(),
      pauseThisFrame: this.pauseFrame === this.frameNo,
      blocked: isGameInputBlocked(),
      hasFocus: typeof document === 'undefined' || document.hasFocus()
    })
  }
}
