import { Profiler, useEffect, useState, type ReactNode } from 'react'

import { SnapshotPublisher } from './game/snapshot'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './game/tuning'
import { InputSystem } from './scenes/input'
import { layout, trackLayout, walkPadRect } from './scenes/layout'
import { perf } from './scenes/perf'
import { HouseInput } from './scenes/house'
import { StoneInput } from './scenes/path'
import { Renderer } from './scenes/renderer'
import { WellInput } from './scenes/well'
import { WipeInput } from './scenes/wipe'
import {
  createMotion,
  GameLayout,
  isTouchDevice,
  startLoop,
  useGameCanvas,
  useLeaveWarning,
  useStore,
  type DevAction,
  type MotionPermission
} from './shared'
import {
  closeModal,
  covered,
  createGame,
  FORCE_TRAY,
  goToChore,
  noteFail,
  openSettings,
  SKIP,
  type Game
} from './shell'
import { ChoresModal } from './ui/ChoresModal'
import { Ending } from './ui/Ending'
import { Hud } from './ui/Hud'
import { ReplayModal, ShareDialog } from './ui/ReplayModal'
import { SettingsModal } from './ui/SettingsModal'
import { ShopModal } from './ui/ShopModal'
import { Sideways } from './ui/Sideways'
import { Title } from './ui/Title'
import { TrayStep } from './ui/TrayStep'

/** The title, then "Hold It Like a Tray" on phones with motion, then the game. */
type Stage = 'title' | 'tray' | 'playing'

export function App() {
  const { canvasRef, viewport } = useGameCanvas({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    mode: 'contain'
  })
  const [game] = useState(createGame)
  const [stage, setStage] = useState<Stage>(SKIP ? 'playing' : 'title')
  const [devActions, setDevActions] = useState<DevAction[]>([])
  const modal = useStore(game.ui, s => s.modal)
  // From the start tap until the ending, closing the tab asks first.
  useLeaveWarning(stage !== 'title')

  useEffect(() => {
    const canvas = viewport.canvas
    if (!canvas) return
    const { sim } = game
    const input = new InputSystem(
      canvas,
      (x, y, out) => viewport.toLogical(x, y, out),
      game.tilt
    )
    input.isPaused = () => sim.state.paused
    input.onPause = () => sim.pause()
    input.onMenu = () => {
      if (game.started) openSettings(game)
    }
    // Coming back to the tab carries on by itself when no water is at stake.
    input.onReturn = () => {
      if (!covered(game)) sim.resume()
    }
    game.suspendInput = () => input.suspend()
    const publisher = new SnapshotPublisher(game.hud)
    const renderer = new Renderer(
      viewport,
      sim,
      () => input.mode,
      game.tilt,
      () => game.started
    )
    // Every drain is filmed: the clip opens a replay when it's due and feeds Share This Fail.
    renderer.film.onClip = shot => noteFail(game, shot)
    renderer.film.onMoment = still => {
      game.shots.moment = still
    }
    // Each scene claims the presses it turns into gestures; the rest grip or walk.
    const well = new WellInput(sim, renderer.pond)
    const house = new HouseInput(sim)
    const wipe = new WipeInput(sim)
    const stone = new StoneInput(sim)
    input.pressHandler = (pointer, timeMs) =>
      well.press(pointer, timeMs) ??
      house.press(pointer) ??
      wipe.press(pointer) ??
      stone.press(pointer)
    // A finger on a falling leaf blows at it.
    const blowSpot = { x: 0, y: 0, height: 0 }
    input.blowTarget = () => sim.blowTarget(blowSpot)
    const stopLayout = trackLayout(viewport)
    // The walk pad sits in the bottom band, or at the foot of the right column.
    const syncPad = () => {
      input.walkPad = walkPadRect(layout.get())
    }
    syncPad()
    const stopPad = layout.subscribe(syncPad)
    let bucketWasUp = false
    const stopLoop = startLoop({
      update: dt => {
        game.tilt.step(dt)
        // Read even before the start, so presses behind the start screen never carry over.
        const frame = input.read()
        if (!game.started) return
        // Dev pilots stand aside while a dialog is open, so it stays paused.
        const pilot = covered(game) ? null : game.pilot
        sim.update(dt, pilot ? pilot(frame) : frame)
        publisher.publish(sim, input.mode, sim.events.length > 0)
        // Each crank ends with the phone in hand: a chance to settle level again.
        const up = sim.state.well.bucketUp
        if (up && !bucketWasUp && input.mode === 'motion')
          game.tilt.request('refine')
        bucketWasUp = up
      },
      render: (_alpha, timeMs) => {
        input.sampleFrame(performance.now())
        renderer.render(timeMs)
      }
    })

    let disposed = false
    let stopDev = () => {}
    if (import.meta.env.DEV) {
      void import('./dev').then(({ installDev }) => {
        if (disposed) return
        const dev = installDev({ game, input, viewport, renderer })
        stopDev = dev.dispose
        setDevActions(dev.actions)
      })
    }
    return () => {
      disposed = true
      stopDev()
      stopLoop()
      stopPad()
      stopLayout()
      renderer.dispose()
      input.dispose()
      game.suspendInput = () => {}
    }
  }, [viewport, game])

  useEffect(() => () => game.motion?.dispose(), [game])

  const play = () => {
    game.started = true
    game.sim.startColdOpen()
    setStage('playing')
  }

  const start = (permission: MotionPermission) => {
    if ((permission !== 'denied' || FORCE_TRAY) && !game.motion) {
      game.motion = createMotion()
      game.tilt.setSource(game.motion)
    }
    // Phones hold the sieve with the phone itself, once it knows what level is.
    if (game.motion && (isTouchDevice() || FORCE_TRAY)) setStage('tray')
    else play()
  }

  return (
    <GameLayout canvasRef={canvasRef} dev={devActions}>
      {stage === 'playing' ? (
        <>
          <CommitCounter>
            <Hud game={game} />
          </CommitCounter>
          <Sideways game={game} />
          <Ending game={game} />
        </>
      ) : stage === 'tray' ? (
        <TrayStep
          tilt={game.tilt}
          realWalk={game.sim.state.realWalk.on}
          onDone={play}
          onThumbs={play}
        />
      ) : (
        <Title
          sim={game.sim}
          phone={isTouchDevice() || FORCE_TRAY}
          onStart={start}
          onSettings={() => game.ui.set({ modal: 'settings' })}
        />
      )}
      <SettingsModal
        open={modal === 'settings'}
        onClose={() => closeModal(game)}
        tilt={game.tilt}
        sim={game.sim}
        realWalk={realWalkSetting(game, stage)}
        started={stage === 'playing'}
      />
      <ShopModal
        open={modal === 'shop'}
        sim={game.sim}
        onClose={() => closeModal(game)}
      />
      <ChoresModal
        open={modal === 'chores'}
        sim={game.sim}
        onClose={() => closeModal(game)}
        onGoTo={id => goToChore(game, id)}
      />
      <ReplayModal game={game} />
      <ShareDialog game={game} />
    </GameLayout>
  )
}

/**
 * Walk for Real in Settings: on phones, and anywhere a motion sensor sends data. Before
 * the start tap nobody knows yet whether the sensor works, so it stays available.
 */
function realWalkSetting(
  game: Game,
  stage: Stage
): 'ready' | 'noSensor' | null {
  const sensor = game.tilt.source?.available ?? false
  if (!sensor && !isTouchDevice() && !FORCE_TRAY) return null
  return sensor || stage === 'title' ? 'ready' : 'noSensor'
}

/** Counts React commits for the `?debug` overlay in dev builds. */
function CommitCounter({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV) return children
  return (
    <Profiler id="hud" onRender={() => perf.noteCommit()}>
      {children}
    </Profiler>
  )
}
