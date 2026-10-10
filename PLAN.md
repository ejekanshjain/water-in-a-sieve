# Water in a Sieve: Technical Plan

This plan turns the "Game 3: Water in a Sieve" section of `DESIGN.md` into build steps. Builders work through the milestones in order and keep the Code Map current.

Every number here is a starting value. Once `game/tuning.ts` exists, it is the source of truth, and the final balance pass (M25) writes the tuned numbers back into this plan.

## Changes From the Lead's Direction

Each change below keeps the lead's intent and fixes a gap found while working out the maths.

1. **Two steadiness levels.** A hand level reads the mouse or the phone through the shared `JoltMeter`, so Sensitivity and Assist Mode scale it. A body level, computed in game code with the same rise and fall rates, reads footsteps, bumps and events. Sensitivity never scales the body level, and Assist Mode scales it by its own factor (0.85). Two settings toggles can't remove rushing, bumps or events.
2. **Desktop drift.** While you walk, the sieve drifts on its own and you steer it back with smooth mouse moves. A mouse resting on a desk is perfectly still, so "hold the button and keep still" alone would make desktop trivial. The desktop controls list says "Mouse: steer the sieve onto the dot". DESIGN.md's controls table still reads "keep the mouse still"; the lead owns that file.
3. **Tilt matters on both platforms.** Phones read real tilt from a calibrated pose. Desktop maps the sieve's offset from your hands to the same degrees. Past 12° the sieve dribbles; at 30° it tips. The pour has its own rules (section 3), so pouring never trips the carry rules.
4. **Space also grips on desktop.** Holding a trackpad click while moving is awkward. Space plus a hovering pointer feeds the same hand meter.
5. **A 200 ms re-grab window, and pauses are never let-gos.** Letting go starts a tip that a fast re-press catches with a wobble. The input layer classifies every release first: blur, `pointercancel`, dialogs and pauses never tip.
6. **Walk speed ramps while you hold walk.** There is no rush key: holding longer is rushing. You learn to feather it like a throttle.
7. **Whole millilitres.** Every ledger counts integer mL and moves fractions through per-channel remainders. "Delivered + drained + dripped + splashed = scooped" then holds exactly.
8. **Drains leave wet patches where the water lands,** 1.5 m ahead of you. Outside winter they dry after 3 trips. In winter they freeze. Winter hazards come from your own earlier failures.
9. **Flies have a counter without the swatter: Blow.** Blowing pushes the fly off and ripples the water. The fly gives up after 2 blows. The swatter (R) kills it in one swing with a bigger jolt.
10. **One portrait design space (540 x 960) for every screen.** Desktop draws the world across the full width and moves the HUD into side columns. The HUD never covers the play area.
11. **Walk Back reuses the Garden Path renderer** with a direction flag, and so do empty walks between the well and the house.
12. **Rain water is tracked apart from your water.** It rises in the container, then drains back out.
13. **After 4 drains in a row, a toast suggests Assist Mode.**
14. **Time costs water and arms.** Base drip is 0.8% per second (1% until M25) and arm fatigue grows drift after 15s of carrying. Crawling is never safe, so every carry is a speed-versus-jolt bet.
15. **One crank per well fill,** with ways to fail it. The bucket stays up for its 5 scoops.
16. **Seasons follow progress, not trip count.** Every player sees the whole year.
17. **The steadiness ring lives in the game world,** around the sieve view, so you see danger where you look and replays show why you drained.
18. **Threats follow you indoors.** The walk-in and the pour get their own event slot, so a drain one step from the tub can happen.

## Open Questions for the Lead

Builders use the recommendation unless the lead decides otherwise.

- **Real-phone tuning.** iOS only sends motion data over HTTPS. M6 adds an HTTPS dev flag that uses a self-signed certificate made with openssl (already installed, no package). Someone has to hold a real phone for the spike. Decided (Lead Decisions): the game ships the best guesses, and running the spike recorder (`?spike`, M26) on real phones is an Owner Follow-Up.
- **Walk for Real.** An optional phone mode where real steps move you (M22). Recommendation: keep it optional, offered on the start screen and suggested on Last Trip.

## 1. Player Experience Walkthrough

### First 5 Minutes

Times are for an average player on desktop.

- **0:00 Start screen.** Title, pitch ("Fill the bathtub. You only have a sieve.") and the story. **Tap to Start** unlocks sound, keeps the screen awake, arms the leave warning and requests motion access on phones.
- **0:10 Cold open (8s, tap to skip).** You wear pyjama bottoms with an interview shirt and tie. You turn the bathroom tap; it coughs (`rattle`) and stops. Caption: "Water's off. Interview at 9." You take a sieve from the kitchen drawer. Caption: "This'll do."
- **0:20 Well.** Hint: "Draw slow circles on the crank. Don't let go." Five creaking circles raise the well bucket. It stays up for 5 scoops. The sign on the well reads "Wishing well. No refunds."
- **0:30 Scoop.** Hint: "Grab the sieve. Dip it. Hold. Lift slowly." The fill ring fills. Your first lift is jerky and the water splashes back: "Slowly." Scoops left: 4.
- **0:40 Garden Path, trip 1.** Hint: "Keep holding. Hold W to walk." The steadiness ring glows around the sieve. Trip 1 has no drift and one root at 20 m. Hold W from the start and you reach it at 8 m/s: the ghost tick on the ring turns red, the tick-tick speeds up, and the sieve drains. "Gone. All of it."
- **1:10 Trip 2 adds drift.** Hint: "The sieve wanders. Keep it on the dot." Tilt loss shows a red wedge on the rim and a speeding drip.
- **1:35 House.** The bucket waits on the back step. Hint: "Move right to pour. Stay in the green." The pour gauge shows its green band. "+24" floats off the coin badge. The No-Drip badge cracked at 40 m, when you sloshed.
- **1:45 Walk Back.** Hint: "Nothing to spill. Run." You sprint back in 7s. The trip report reads "0.8 L. The bucket is 8% full."
- **3:30 The fifth scoop** empties the well bucket. "The well needs 1 min to refill." The refill runs while you carry. At the back step the cat is drinking from the bucket; you shoo it. Back at the well with 0:20 left, a frog sits on the crank. You drag it into the grass; it hops back once. The well dings.
- **4:30 Trip 7.** A buzzing starts at 40 m. Hint: "A fly. Hold F to blow it away." Blowing ripples the water. The second time it comes back faster and angrier. After two blows: "Fine. Keep your water."

On a phone the first five minutes match, but the phone is the sieve. You calibrate by holding the phone the way you'll carry it. You tip the phone forward to scoop, hold a thumb down to walk, and tilt right to pour. This is the part people film.

### The Middle

- **Bucket done at about 10 min.** "Bucket: done. The toilet flushes once." You kick the empty bucket into the shed (Matter.js tumble). +150 coins. Autumn arrives with the kitchen sink, piled with dirty dishes.
- **Kitchen sink, about 10 to 30 min.** The path has 4 bumps and a rose bush at 60 m. Each season reshuffles the bumps, and a mole pops out of each new one. You buy Wax Coating, then Finer Mesh. Leaves blow into the well bucket and fall toward the sieve. Flies, sneezes, the dog and phone calls break up trips. Callers rotate: the interviewer, Mum, a scam, and the water company ("We'll restore your supply soon").
- **Bathtub, about 30 to 95 min.** The tub has a painted litre ruler. Bigger Sieve doubles each trip but makes the meter twitchier. The cat pulls the plug chain, and a gurgle at the well tells you. Winter starts at 15 L. Every drain you caused leaves a patch that freezes. Ice slips tear holes, so you thread needles and sew while glue dries. You lay paving stones one per walk back. At 25, 50 and 75 L a 3s gag plays: the duck floats, the cat tests the water, the interviewer reschedules.
- **Spring at 60 L.** Rain pours through the skylight and fills the tub for you, then drains back out: "It was never yours." Later visits escalate: an umbrella, scooping the rain, a rainbow.

### The Ending

- When the remaining litres fit in one sieve, the HUD reads **Last Trip**. One bathroom threat is guaranteed on the walk-in or the pour, so a drain one step from the tub stays possible. If the trip falls short ("99.8 L. So close."), the label becomes **Last Trip (Really)**.
- The final pour tops the tub at 100 L. You put on a shower cap, step in and sigh. Every tap in the house bursts on at once and the sink overflows. The phone rings: "Water company. You're back on." It rings again: "About your interview. That was last year." You stare at the camera.
- The ending screen, **You Filled the Bathtub**, shows time, trips, litres scooped, litres lost, the top cause, flies blown away, coins left over and your quoted interview answer. It offers **Share** and **Play Again**.

## 2. Scenes and Navigation

### Scene List

| Scene | What happens | Phases |
|---|---|---|
| `well` | Crank, scoop, workbench (mend, rewax), clear leaves, dry slippers, frog | `idle`, `crank`, `scoop`, `bench` |
| `path` | Garden Path carry, 100 m outbound with water | `ready`, `carry`, `drained` |
| `house` | Walk in 4 m, pour, house chores | `enter`, `pour`, `visit` |
| `walkBack` | Path renderer reversed; also empty walks both ways | `return`, `toHouse`, `toWell` |
| `cutscene` | Cold open, container done, milestones, ending | one per cutscene |
| `ending` | EndingScreen over the last frame | none |

### Flow

```text
Start Screen -> Calibrate (phones with motion) -> Cold Open -> Well

Well --scoop lifted--> Path (carry) --100 m--> House (pour) --sieve empty--> Walk Back --> Well
                         |                       |
                         +--drain at d m------> Walk Back from d m
                                                 +--drain or dump--> Walk Back

Well --Go to House--> Walk Back (toHouse, empty) --> House (visit) --Go to Well--> Walk Back (toWell) --> Well
Container full --> cutscene --> next container
Bathtub full --> ending cutscene --> Ending
```

Navigation rules:

- The shop opens only with an empty sieve, at the well (out of the water, bench shut) or on a house visit. Desktop shows **Shop** beside **Settings**; phones tap the coin badge. Opening it pauses the game like Settings.
- Settings open at any time with Esc, and opening them pauses the simulation. During a desktop carry the Shop and Settings buttons hide and the column shows "Esc: Pause", until a pause frees the mouse. Phones keep the Menu button, because a phone grip is the phone itself.
- **Go to House** and **Go to Well** start an empty walk, for chores during waits.
- Scene changes keep the grip. The pointer, the anchor and both levels carry across a 250 ms whip-pan, so the scoop flows straight into the carry.
- A button or thumb still held through the walk back picks the empty sieve up again at the well, so you can scoop without letting go and pressing again. (Added in the playtest pass: the sieve used to ignore a held button until a fresh press.)
- A hidden tab, a window blur, a `pointercancel`, an orientation change or a dialog pauses the simulation and cancels any pending tip. Resuming with water in the sieve waits for a fresh grip press, then runs a 1s "Hold still…" countdown and resets the hand baseline.
- Another input set taking over while water is at stake (a mouse, pen or trackpad brushing a phone you tilt, or a finger tapping while a mouse plays) pauses the same way, with a pop and the hint "A mouse or pen took over. Press and hold to grab the sieve." (or the touch and tilt versions). The press that brought the new input in never counts. The next grip anchors the new input where the sieve already is, then the 1s countdown runs. With nothing at stake, the new input picks the sieve up afresh. (Added in the audit pass: a stray mouse move used to jump a tilted sieve from 2° to 49° and drain it.)
- With no water at stake, closing a dialog or coming back to the tab resumes on its own. Any press resumes too, and that press never skips a cutscene or grabs anything.
- Phones held sideways get a "Turn Your Phone Upright" cover that pauses the game like a dialog.

### Design Space and HUD

The canvas uses a logical design of **540 x 960** in `contain` mode. Scenes draw backgrounds across `viewport.view`, so the world fills the whole screen. Everything you must see or touch stays inside the design rect.

- **Portrait (phones, tablets):** the HUD sits in two bands inside the design. The top band is y 0 to 120 and the bottom band is y 820 to 960. The play area is y 120 to 820.
- On an iPhone SE with Safari toolbars (375 x 553) the design scales to 0.58, so the top band is 69 px. It holds one row of 48 px targets plus a display-only status line.
- **Landscape (desktop):** the HUD moves into side columns outside the design rect. At 1280 x 800 the design is 450 x 800 px, so each column is 415 px wide.
- If a landscape column would be under 240 px wide, the HUD falls back to portrait bands.
- A touch screen wide enough for columns, such as a tablet held sideways, gets the Hold to Walk pad at the foot of the right column (`columnWalkPad`: 22% of the column's height, 96 to 180 px). The column's buttons stop above it, and the input layer hit-tests the same box (`walkPadRect`). (Added in the audit pass: columns had no pad, so a touch-only player could fill the sieve but never walk it to the house.)
- A `layout` store (M1) publishes `{ mode: 'bands' | 'columns', left, top, width, height, scale }` in CSS px on every `viewport.onResize`. HUD components position themselves from it.

### Phone Portrait Sketch

Every interactive element has a fixed slot. The context slot shows one button at a time, by priority: Answer and Decline, Swat, Wipe or Lay Stone, Share This Fail, Go to House or Go to Well. The shop has no slot on phones: the coin badge in the top row opens it, with a small **Shop** sticker while it can. (Changed in M15: Shop sat last in the context slot, where Go to House and Go to Well always beat it.)

```text
y=0    +----------------------- 540 -----------------------+
       | [Bucket 4.2/10 L ====--]        [o 85]    [Menu]   |  row of 48 px targets
       | Well 0:42 . Glue 0:12 . Cat! . Trip 7 . Summer     |  status line (display only)
y=120  +---------------------------------------------------+
       | 0 m --*----^----~~----rose----^---- house 100 m    |  distance bar
       |              .( ring )-.                           |
       |             ( sieve cam )   <- ghost tick, hazards |  ring and cam at 270,320
       |              '-(      )-'                          |
       |   caller bubble / hints / captions (canvas)        |
       |   hero ~~~~~~~~ side view of the path ~~~~~~~~     |  walk strip (480 to 800)
y=820  +---------------------------------------------------+
       | Steadiness [=======|===  ]  0.8 L   [No-Drip]      |  display row
       | [Chores 2]   [context slot]     [ Hold to Walk ]   |  48 px targets
y=960  +---------------------------------------------------+
```

The status line leads with the well, glue and slippers countdowns and the red trouble (holes, **Cat!**, **Plug out!**). Those never get cut off; the trip, season and scoops give way at the end, and "Well refilling" drops while the well countdown shows. All six fit at 375 x 667 and 375 x 553. While the phone rings, Answer and Decline take the Chores slot and the context slot together, so each stays at least 48 px wide on an iPhone SE; the interviewer's two answers use the same pair. The Hold to Walk pad is a display-only overlay that fills exactly the rect the input layer hit-tests per pointer id (`WALK_PAD` in `scenes/layout.ts`, logical x 270 to 540, y 865 to 960). [Menu] is a 48 px icon button, so the container bar fits on a 375 x 553 screen. Phones blow by holding a finger on the fly, so there is no Blow button. The call card's caller line is a speech bubble drawn on the canvas; its **Answer** and **Decline** buttons use the context slot.

### Desktop Landscape Sketch

```text
+------ 415 px ------+------ 450 px design ------+------ 415 px ------+
| Steadiness (big)   | distance bar              | Bucket 4.2 / 10 L  |
| Sieve 0.8 L        |    ring + sieve cam       | Coins 255          |
| No-Drip badge      |                           | Trip 7 . Summer    |
| Controls:          |                           | Well 0:42 Glue 0:12|
|  Mouse or Space:   | hero  path ~~~~~~~~~~~~~~~~~~~~~~ (the world  |
|   grip             |       continues behind both columns)          |
|  Mouse: steer the  |                           |                    |
|   sieve onto dot   |                           |                    |
|  W: walk  F: blow  |                           | Chores list        |
|  R: swat           |                           | [Answer] [Decline] |
|  E/F: answer/decl. |                           | [Go to House]      |
|  Esc: pause        |                           | [Share This Fail]  |
| Hint text          |                           | [Shop] [Settings]  |
+--------------------+---------------------------+--------------------+
```

### Scene Layouts

Coordinates are logical units in the 540 x 960 design.

- **Well:** well centre x 250, rim at y 660, raised well bucket water line at y 600 when full (7 units lower per scoop taken). Crank axle at (430, 612) with a 52-unit handle circle; a press within 115 units of the axle cranks. The sieve hangs on a hook at (96, 600) and hovers at y 545 when grabbed; it dips at the water line and leaves the well above y 470. The slippers hang on the washing line at (150, 548) and the wax tin sits at (122, 752). The workbench overlay shows the sieve at (270, 492), radius 180. (Updated in the playtest pass from the first layout; `game/tuning.ts` holds the live numbers.)
- **Path:** distance bar from y 130 to y 165. Sieve cam centre (270, 320), radius 120, inside a steadiness ring of radius 140. Ground line at y 770. The hero stands at x 170 walking out and at x 370 walking back. The path scale is 40 units per metre, so a phone shows 13.5 m and a 1280 x 800 desktop shows 38 m.
- **House:** floor at y 770, the back wall with the door at x 440 to 526, and the container on the step at x 384. The hero walks in from x 120 to x 280 (4 m). The sieve cam stays at (270, 320); the pour gauge is a vertical bar at x 60 from y 200 to y 520. Until M8 adds the kitchen and bathroom, the sink and bathtub use the back-step art.

### The Steadiness Ring

The ring is the main steadiness readout, drawn on the canvas so replays and share stills show it.

- An arc around the sieve cam fills clockwise from the top with the total level, on a scale to 1.3. A red notch marks the limit at 1.0. The arc is green below 0.55, yellow to 1.0, and flashes red at a break.
- When a bump is within 12 m, a ghost tick shows the level you would hit at your current speed. It turns red when that level would break. A `tick` repeats faster as the bump nears, and a red arrow slides along the rim toward the top.
- Wet patches, ice, the rose bush and the dog's peek show as small icons on the ring when they are within 12 m.
- Tilt loss shows as a red wedge on the sieve rim on the low side.
- The HUD `Meter` repeats the total as a second readout.

## 3. Core Simulation Model

### Units

- UI shows litres with one decimal ("1.4 L", "3 L"). Ledgers store whole millilitres.
- Distances in metres, speeds in m/s, rates per second. Screen positions in logical units.
- The simulation runs at a fixed 60 Hz through `startLoop`. All rates below scale by `dt` in seconds.

### Ledger

The ledger is the single place where water moves. Every loss goes through it.

```ts
// Whole millilitres. Invariant: scooped === inSieve + delivered + drained + dripped + splashed
interface SieveLedger {
  scooped: number
  inSieve: number
  delivered: number
  drained: number
  dripped: number
  splashed: number
}

// One per container. Invariant: delivered === inContainer + plugDrained + catDrunk
interface ContainerLedger {
  delivered: number
  inContainer: number
  plugDrained: number
  catDrunk: number
  rainMl: number // outside the invariant; always returns to 0
}
```

Continuous losses call `leak(channel, mlFloat)`. It adds to that channel's remainder, then moves `Math.floor(remainder)` whole mL, clamped to `inSieve`. A break moves all of `inSieve` at once. Losses are recorded with a cause for stats and share cards.

| Loss | Category | Cause label |
|---|---|---|
| Base drip, hole leak, slosh, tilt dribble, leftover on the walk back | dripped | `drip` |
| Over the limit from hands or bumps | drained | `jolt`, `bump` |
| Tipping past 30°, letting go | drained | `tilt`, `letGo` |
| A failed counter: fly, falling leaf, sneeze, dog, ignored call, slip | drained | `fly`, `leaves`, `sneeze`, `dog`, `ring`, `ice`, `wetFloor` |
| Over the limit with a swatter swing as the largest pulse | drained | `swat` |
| Walking into the cat weaving round your ankles | drained | `cat` |
| Walk for Real: a real step that lands too hard | drained | `stomp` |
| Pouring too fast, dumping in the house, overflow | splashed | `splash` |
| Poured into the container | delivered | none |

A break names its cause from the largest body pulse active at that moment (`bump`, `dog` and so on), and falls back to `jolt`.

### Sieve Capacity and Scooping

```text
capacity   = (1000 + 500 if Finer Mesh) x (2 if Bigger Sieve) mL   -> 1.0, 1.5, 2.0, 3.0 L
capLeaves  = capacity x (1 - 0.15 x leaves), leaves in the well bucket 0 to 3
fill rate  : fill += (capLeaves - fill) x (1 - e^(-dt / tau)) while under the water line
tau        = 0.35s, or 1.0s with Finer Mesh
```

- 95% fill takes 1.05s, or 3.0s with Finer Mesh.
- A scoop counts against the well when the sieve leaves the bucket holding at least 10% of capacity. A second dip in the same visit tops up and counts as another scoop.
- Releasing while dipped leaves the sieve in the bucket with no penalty. Once the sieve rises above the water line with water in it, every steadiness rule applies.

### Steadiness

```text
hand  = shared JoltMeter (limit 1, motionRef 4 m/s2, pointerRef 6000 units/s2, rise 25, fall 3)
          desktop and two-thumb: feed(handAccel / pointerRef) every step while gripping
          phone with motion:     feedMotion(motion.jolt x touchGrace)
          not holding water:     feed(0)
body  = damp(body, raw x bodyAssist, rise 25 or fall 4)   game code, never scaled by Sensitivity
raw   = gait(v) x gaitMul + active pulses
gait  = 0.6 x (v / 8)^2
total = (hand.level + body) x weight      weight = 1.15 with Bigger Sieve
```

- **handAccel** is measured once per rendered frame from the grip pointer's velocity change over real frame time. Velocity comes from pointer event timestamps, sampled at least 8 ms apart and smoothed over 40 ms. Every fixed step of that frame feeds the same reading, so 30, 60 and 120 fps read alike.
- **Zones:** green below 0.55, slosh from 0.55 to 1.0, break at 1.0 or more. The ring and the HUD meter run to 1.3 with a limit mark at 1.0.
- **gaitMul:** 0.7 with dry slippers, times 0.8 on a paved segment.
- **Footsteps** every 0.8 m add a ±15% bob to gait, for rhythm on the ring.
- **touchGrace:** for 150 ms after a touch press or release, motion jolt counts at 50%. These are best guesses; real-phone readings may replace them (Owner Follow-Ups).
- **Sensitivity and Assist Mode** scale only the hand level. Assist Mode reads hands at 0.78x (`HAND_ASSIST_SCALE`, through the shared meter's `assistScale`) and the body at 0.85x (`bodyAssist`). It was 0.6x for hands until M27.
- A pulse of 120 ms reaches 95% of its amplitude at rise 25 (1 - e^-3).

| Speed | gait | gait plus a bump | Zone with a 0.05 hand |
|---|---|---|---|
| 2 m/s | 0.04 | 0.38 | green |
| 4 m/s | 0.15 | 0.64 | slosh, drips |
| 5 m/s | 0.23 | 0.81 | slosh, heavy drips |
| 6 m/s | 0.34 | 1.00 | break |
| 8 m/s | 0.60 | 1.40 | break; flat ground alone is slosh (0.65) |

Pulses, added to `raw` for their duration. Failed counters also drain the sieve directly with their cause; their pulse only drives the ring spike and the shake.

| Source | Amplitude | Duration |
|---|---|---|
| Bump (none on a paved segment) | 0.2 + 0.08 x v | 120 ms |
| Blowing at a fly or leaf | 0.3 | while held |
| Swatter swing | 0.55 | 150 ms |
| Dog passing while you stand still | 0.3 | 200 ms |
| Dog tripping you (also drains) | 1.3 | 300 ms |
| Sneeze held in | 0.1 | 250 ms |
| Sneeze (also drains) | 1.4 | 250 ms |
| Phone buzz in your pocket | 0.35 every 0.8s | 150 ms |
| Declining a call | 0.15 | 100 ms |
| Slip while carrying (also drains) | 1.5 | 300 ms |
| Re-grab catch | 0.5 | 150 ms |

### Grip, Anchor, Tilt and Drift

```text
anchor        = pointer position at the grip press (logical units)
offset        = pointer - anchor + drift                 stored in GameState
desktop tilt  = |offset| x 0.3 degrees per unit           (100 units = 30 degrees)
phone tilt    = hypot(tiltX, tiltY) degrees from the calibrated pose
dribble       = water x 0.3 x ((tilt - 12) / 18)^2 per second, above 12 degrees
tip           = all water drained at 30 degrees or more
drift(t)      = A x (sin(2 pi 0.17 t + p1) + sin(2 pi 0.29 t + p2)) / 2 per axis
A             = (20 + 8 x v) x fatigue units
fatigue       = 1 + 0.06 x (carrySeconds - 15), from 1 to 2.2
```

- The sieve cam draws the sieve at the cam centre plus `offset`, and a dot at the centre. Keep the sieve on the dot.
- On a scene change the anchor moves with the cam, so `offset` and tilt stay continuous through the whip-pan. A re-grab re-anchors so `offset` is preserved.
- The amplitude follows speed smoothly (rate 2 per second), so stopping dead or a scene change never makes the sieve jump.
- Uncorrected drift reaches 60 units (18°, dribbling) at 5 m/s and 84 units (25°) at 8 m/s. Tracking it smoothly costs about 280 units/s² of acceleration, a hand level of 0.05.
- **Trip 1 has no drift.** Trip 2 turns it on with its hint.
- **Arm fatigue** starts after 15s of carrying water. Drift grows each second, the arms tremble (drawn only), sweat drops fly, and at 20s the caption reads "Arms. Going."
- A bump nudges the drift 25 units down over 150 ms on desktop.
- Assist Mode multiplies both tilt thresholds by 1.5 (18° and 45°).
- **Letting go** (desktop or two-thumb) starts a tip. A fresh press within 200 ms catches it with a 0.5 pulse. Otherwise all water drains with cause `letGo`.
- **Calibration** happens on the "Hold It Like a Tray" screen, at the end of each crank once the phone is steady for 0.5s, after an orientation change, and from **Recalibrate** in Settings. Poses more than 45° from flat are refused with "Hold it flatter". The after-crank calibration only refines level: it accepts a pose within 10° of the current level and gives up after 4s, so a player already tipping forward to scoop never makes "dipped" the new level.

### Drips and Holes

| Channel | Rate | Counts against No-Drip |
|---|---|---|
| Base drip | water x 0.008 per second, x 0.7 with Finer Mesh | no |
| Hole leak | 0.05 L/s per hole, at most 3 holes | yes |
| Slosh | water x 0.25 x ((total - 0.55) / 0.45)^2 per second, in the slosh zone | yes |
| Tilt dribble | see above; wax doesn't help, it spills over the rim | yes |

- Wax Coating multiplies base drip, hole leak and slosh by 0.35.
- A 20s carry of 1 L loses 15% to base drip without wax and 5% with it. A 40s crawl loses 27% without wax.
- Holes block scooping until mended. A hole torn mid-carry leaks for the rest of the trip, with ripples at each hole in the sieve cam.
- If holes leak the sieve dry before the house, the trip ends there ("Leaked dry.") and the walk back starts. (Added in M8: an empty sieve used to walk on forever.)

### Walking and Slipping

| Mode | Top speed | Speed up | Slow down |
|---|---|---|---|
| Carry | 8 m/s | 2.2 m/s² | 6 m/s² |
| Walk back and empty walks | 18 m/s | 8 m/s² | 12 m/s² |
| House walk-in (4 m) | 3 m/s | 1.6 m/s² | 6 m/s² |

- Holding walk while carrying reaches 5 m/s in 2.3s and 8 m/s in 3.6s, so you feather it. A clear walk back takes about 7s.
- Your speed carries into the house walk-in, capped at 3 m/s.
- The path is 100 m in 20 segments of 5 m. Bumps per container: bucket 2, sink 4, bathtub 6, at least 8 m apart and none in the last 5 m. Trip 1 has one bump at 20 m. The seed changes with each season, and a mole pops out of each new bump the first time you pass it. A laid stone flattens the bumps in its segment, and a reshuffle never puts one back on a paved segment, so a fully paved path has none.
- The rose bush covers 58 to 62 m from the sink phase on. Carrying past it above 3 m/s tears a hole.
- **Wet patches** are 1.5 m wide. A drain leaves one 1.5 m ahead of where it happened, where the water lands. If a walk back would start on a puddle (after slipping on it), it starts just past the puddle's well side. A pour splash leaves one on the house floor. Outside winter, patches shrink each trip and dry after 3 trips. In winter, patches present when a trip starts become ice. Spring adds a puddle on 40% of trips. Autumn adds 1 wet leaf pile per trip that lasts one trip (2 until M25). A new trip keeps at most 6 patches; the oldest dry or melt first, so a run of drains can't turn the winter path into an ice rink (M25: unskilled players met 7 slips a trip without it).
- **Slip speeds:** wet 1.5 m/s (dry slippers 2.5, soaked 1.0); ice 1.0 m/s (dry slippers 1.8, soaked 0.7). Assist Mode multiplies them by 1.5. Walking under 1.5 m/s shows the tiptoe pose.
- **A slip while carrying** drains with cause `wetFloor`, `ice` or `leaves`, plays a 1.5 pulse and soaks slippers. It tears a hole only on ice.
- **A slip on an empty walk** costs a 2s pratfall and soaks slippers. No hole.
- **Path chores:** on any empty walk, a patch from 6 m ahead to 3 m behind shows a **Wipe** (**Scrape** for ice, **Sweep** for leaves) prompt in the context slot; the next unpaved segment within 3 m ahead shows **Lay Stone** (M16), when no Wipe prompt shows. Pressing the prompt steps you onto the patch; stopping under 0.5 m/s on it also opens a rub area in the walk strip (12 strokes, 20 for ice). Walking past keeps the chore open in the chores list. Stones stay optional: one Lay Stone prompt per empty walk, for the first unpaved segment it reaches; pressing it or stopping by it stands you 3.5 m short of the segment's middle with the stone and a drag target, and passing the segment ends the chance with no chore and no cost.
- **House visits:** **Go to House** (context slot, at the well with an empty sieve) runs an empty walk to the house. On a visit the sieve is down; shoo the cat, put the plug back and rub the floor puddle, then press **Go to Well** or let go of walk and walk again. Only walk (W or the Hold to Walk pad) leaves a visit, so a missed tap never walks you out. A pour also ends in a visit while the floor is wet, the cat drinks or the plug is out.

### Walk for Real

An optional phone mode (M22). While it's on and the phone is the sieve, the motion sensor counts your real steps and they walk you; thumbs no longer walk the carry. Every number below is a starting value until M27 applies Ekansh's real-phone readings.

```text
step        jolt rises past 0.8 m/s² (at least 250 ms after the last step), lands when it falls under 0.4 or after 400 ms
stride      each step owes the walker 2 m (at most 4 m can wait), so 50 steps walk the 100 m path and 2 more the walk-in
speed       2 m / time since the previous step, capped by the walk mode; a first step from standing counts a 2s gap (1 m/s)
stop        no step for 1.2s drops the rest of the stride, so slow steps (over 1.2s apart) cover less ground
hand        motion jolt counts at 0.5 while you walk for real, since footsteps shake the phone
body        the game gait is off; each step pulses 0.15 + 0.85 x (peak - 2)^2 for 150 ms, times the slippers' and paving's gait scale
```

- Gentle steps (1 to 2 m/s²) stay green: about 0.2 to 0.4 total. A 2.5 m/s² step sloshes; a 3 m/s² stomp reaches 1 on its own and drains with cause `stomp` (and a `stomp` thud).
- Speed still decides bumps, slips, the rose bush and the dog: tiptoe across ice with a step every 2s or more.
- Empty walks and house visits take real steps too: each one runs like holding walk for 800 ms, and thumbs still run.
- The start screen (phones) and Settings (phones, or wherever a sensor sends data) have **Walk for Real: Off/On**. On Last Trip, a phone holding the sieve without it gets a **Walk for Real** button in the context slot (at the well once the sieve holds water, and on the path), with the hint "Last trip. Walk it for real? Tap Walk for Real."
- The walk pad shows the trip's step count ("12 Steps", "Walk for real") instead of Hold to Walk.

### Pouring

The pour has its own rules. Tilt only drives the pour axis: there is no dribble, no tip and no drift. The only pour fails are splashing, letting go and the hand level going over the limit.

```text
value          = pour axis from 0 to 1
                 mouse: pointer right of the pour anchor, over 120 units; the anchor is the pointer x when the pour starts
                 keys:  D raises it 0.5 per second and it stays on release; A lowers it 1.0 per second
                 phone: tilt right, maxDegrees 25
flow           = 2.0 L/s x smoothstep(0.15, 1.0, value)
splashFraction = clamp((flow - 0.6) / (2.0 - 0.6), 0, 0.7)
delivered     += flow x (1 - splashFraction) x dt
splashed      += flow x splashFraction x dt
```

- The green band is flow up to 0.6 L/s, which is a value up to about 0.46. Holding D reaches it in about 0.9s.
- A safe pour of 1 L takes 1.7s; 3 L takes 5s.
- Letting go or going over the limit during the pour dumps everything: 40% delivered, 60% splashed.
- The pour stops the moment the container fills. The rest of the sieve drips away and never counts against No-Drip, because a full container isn't your fault. (Changed in M8: overflow used to count as splashed.)
- A pour that splashes 0.1 L or more leaves a wet patch on the floor and soaks slippers.
- When the sieve holds under 5 mL, the pour ends and Walk Back begins. Any leftover counts as dripped.

### Well and Waits

- **One crank per fill:** 5 circles, or 6 in winter (frozen handle). The bucket then stays up for 5 scoops.
- Wrong-way circles subtract one.
- **Letting go mid-crank** spins the bucket back down with a `rattle`. Progress resets. "Don't let go."
- **Cranking too fast** (a circle in under 0.55s) slams the bucket into the pulley with a `slam` and slops out one scoop. "Gently."
- The fifth scoop empties the bucket and starts `startTimer('Well refilling', 60_000)`, which blocks `crank`.
- Sewing every hole starts `startTimer('Glue drying', 60_000)`, which blocks `scoop`.
- Hanging soaked slippers starts `startTimer('Slippers drying', 60_000)`.
- All waits go through the shared timers, so `?fast` shrinks them to 3s. Waits run on wall-clock time, even while the simulation is paused.

### Chore Director Rules

Every wait overlaps a chore. The director acts when a wait starts and when you arrive at the well or the house with at least 10s left on a wait. While the open chores, plus walking, cover less than 85% of the time left, it opens the next eligible chore from this table, in order. (Changed in M24 from 70%: the seeded idle check needs under 10s of a 60s wait with nothing to do, and 70% allows 18s.) Only chores already built count as eligible (`AVAILABLE_CHORES` in the sim); each milestone that adds a chore adds it there. Walking counts 32s for the trip that starts a refill and 7s for the run back to the well when you reach the house, and house chores count 7s each way.

| Moment | Where | Guaranteed chore, first eligible wins |
|---|---|---|
| Refill starts (fifth scoop lifted) | carrying to the house | On arrival: a wet step to wipe; on 30% of refills the cat drinking instead (container at 2 L or more). Changed in M25: the cat came first and drank on almost every refill. |
| Refill, arrival at the well | well | Rewax when it is due within 3 trips; autumn: a leaf pile by the well; else the frog on the crank; then a wet house floor, the cat or the plug, for a trip that drained early and came back with most of the wait left (added in M24) |
| Glue starts | well bench | Rewax when due within 3 trips; autumn: a leaf pile by the well; else a house chore marked **Go to House** (cat, wet floor, plug in the bathtub phase); else the frog |
| Slippers drying starts | well | Nothing. You go on barefoot, so the wait blocks nothing. (Changed in M25: the frog came for it 10 to 90 times a game as pure busywork.) |

Estimated chore times: frog 10s (it hops back once), wipe 10s (ice 15s), rewax 15s, shoo the cat 6s, check the plug 6s, leaves 10s, stone 8s, slippers 5s, walking between the well and the house 7s each way.

- Rewax is eligible once you own Wax Coating and it has 3 trips or fewer left (0 means worn off). Cat Treats make the cat and the plug ineligible while they last.
- Coverage of a glue wait with the chores built through M15: 73% once the container holds 2 L (the cat and the wet floor, with house walks), 73% in autumn before that (the wet floor, the leaves and the frog), and 82% whenever Rewax is due. Only a summer glue wait before 2 L stays at 57% (the wet floor and the frog), and summer has no rose bush or ice, so only dev tools tear holes there.

The frog sits on the crank and blocks it. Drag it into the grass; it hops back once.

### Seasons

Seasons follow progress. After trip 150 a caption jokes "Year 2", with nothing new.

| Season | Starts | Path | Well and house | Carry event weights per trip |
|---|---|---|---|---|
| Summer | Bucket phase | Dry dirt | None | fly 25%, dog 10%, sneeze 8% |
| Autumn | Sink phase | 1 wet leaf pile | Leaves in the well bucket on each crank (60% chance, 1 to 3) | fly 10%, falling leaf 12%, dog 10%, sneeze 12%, ring 8% |
| Winter | 15 L in the tub | Patches freeze to ice | Crank needs 6 circles | dog 5%, sneeze 25%, ring 8% |
| Spring | 60 L in the tub | 40% chance of a new puddle | Rain gag | fly 20%, dog 10%, sneeze 15%, ring 8% |

The phone ring starts at trip 12 in every season.

### Containers

| Container | Capacity | Room | Path |
|---|---|---|---|
| Bucket | 10 L | Back step | 2 bumps, no rose bush, hints on |
| Kitchen sink | 20 L | Kitchen | 4 bumps, rose bush |
| Bathtub | 100 L | Bathroom | 6 bumps, rose bush, cat pulls the plug |

- A container completes the moment it reaches capacity, then locks: no more losses from it.
- The cat drinks 0.008 L/s (0.48 L a minute) from the current container once it holds 2 L, until shooed. It starts on 3% of trips while you're away, and the director sends it on 30% of refills. Cat Treats keep it away for 5 trips.
- In the bathtub phase, the cat pulls the plug on 5% of trips. The tub then drains 0.015 L/s (0.9 L a minute) until you fix it.
- M25 cut these from 0.02 L/s on 20% of trips and 0.05 L/s on 15%: the cat and the plug cost an average player 30 to 70 L a game and an unskilled one never finished. They now cost an average player 2 to 7 L and an unskilled one 6 to 15 L.
- Rain adds 0.3 L/s to `rainMl` for 10s, then drains it at 0.4 L/s. The container bar shows rain as a lighter ghost band. Rain is guaranteed on the first house arrival in spring, then rolls on 30% of later arrivals. Visits escalate: plain rain, an umbrella over the tub, you scoop the rain and it drains through the sieve, a rainbow.
- Bathtub milestones at 25, 50 and 75 L each play a 3s gag (the duck floats, the cat tests the water, the interviewer reschedules) and offer a share card.
- Container losses run on simulation time, so a paused game loses nothing.

### Events

Director rules:

- No events before trip 6. At most one carry event per trip, rolled once when the scoop lifts.
- Total event chance per trip is the season weights summed, capped at 60%. The same event can't repeat within 2 trips.
- Carry events start between 15 m and 85 m. Every event warns at least 1.2s before it can hurt you. Assist Mode leaves warnings alone (1.7s until M27): it helps shaky hands, not slow reactions.
- **Bathroom slot:** on 15% of bathtub-phase trips with no carry event, and always on Last Trip (which rolls no carry event), a threat follows you indoors during the walk-in or the pour: the fly comes through the door, the cat weaves round your ankles (stop until it leaves), or bath dust starts a sneeze. It never stacks with a carry event on the same trip. Threats and anything that followed you in carry on through the pour, where blowing and swatting jolt as usual and a sneeze needs still hands; whatever is left when the sieve empties misses.
- House-side events (cat, plug, rain) roll separately and never stack with a carry event's warning.

| Event | Warning | Your counter | If you fail |
|---|---|---|---|
| Fly | Buzzing, the fly circles for 3s, then a landing shadow 1.2s before touchdown | Blow: hold F, or hold a finger on the fly. It retreats, then returns faster and angrier. It gives up after 2 blows ("Fine. Keep your water.") or at the back door. Swat (R, with the swatter) kills it. | It lands and drains the sieve (`fly`). "A fly. One fly." |
| Falling leaf (autumn) | A leaf drifts down with a landing shadow 1.2s before | Blow once, or swat | It lands on the water and drains it (`leaves`) |
| Sneeze | "Ah…" at 0s, "Ah…!" at 1s, sneeze between 1.8s and 2.6s | Freeze: under 0.3 m/s with total under 0.3 when it comes. You get "…choo." and a 0.1 pulse. 10% are fake-outs: "Ah… ah… never mind." | Drain (`sneeze`) with a 1.4 pulse. "Bless you. Not the water." |
| Dog | Bark from behind; the dog's head peeks in at the left edge, and on the ring, 1.5s before | Stop: under 0.5 m/s. It runs between your legs, 0.3 pulse. | You trip: drain (`dog`) with a 1.3 pulse. The dog looks back, proud. |
| Cat round your ankles (bathroom only) | "Mrrp?" as it trots in from the door, and on the ring, 1.2s before | Stand still (under 0.5 m/s) for its 2s weave; it rubs your shins with 0.25 pulses | You trip over it: drain (`cat`) with a 1.3 pulse. It sits by you, licking a paw. |
| Phone call | Ringtone, the phone glows in your pocket, and the caller's opening line shows while it rings ("Mum: Are you drinking enough water?") | **Answer** (E): you stop for 5s while the caller talks. **Decline** (F): a 0.15 pulse. | Ignored: 0.35 buzz pulses every 0.8s for 6s. Over the limit drains with `ring`. |
| Rain (spring) | Clouds and the rain loop when you arrive | None. It's a gag. | Rain fills `rainMl`, then drains away: "It was never yours." |
| Cat drinks | Lapping in the house; a toast and a draining icon at the well | Shoo the cat | 0.008 L/s from the container |
| Cat pulls the plug | "Gurgle… was that the tub?" toast and a draining icon | Check the plug | 0.015 L/s from the bathtub |

Calls:

- Callers rotate: the interviewer, Mum, a scam and the water company.
- A declined Mum calls back on the next trip. The scam caller rings twice in a row.
- Answering pays off sometimes. Mum sends 60 coins for a snack. The interviewer asks a question you answer with E or F, and the ending quotes your answer back. The water company says "Soon."

### Economy and Upgrades

- Each delivery pays `Math.round((deliveredMl * COINS_PER_LITRE) / 1000)` coins. `COINS_PER_LITRE` is 30.
- **No-Drip Trip, +30 coins:** the scoop held at least 90% of capacity, and the trip had zero counted losses (slosh, tilt dribble, hole leaks, splash, drains). Base drip doesn't count. A No-Drip badge shows during the carry and cracks, with a caption, on your first counted loss.
- Container bonuses: bucket +150, kitchen sink +300, bathtub none. The captions read "+150 coins. Next: the kitchen sink." and "+300 coins. Next: the bathtub."
- Upgrades use the shared `createShop`. Each def extends `UpgradeDef` with typed effect fields.

| Upgrade | Cost | Helps | New chore or downside |
|---|---|---|---|
| Wax Coating | 60 | Base drip, holes and slosh x 0.35 | Wax wears off after 10 trips. The Rewax chore (rub 20 strokes) restores it. |
| Slippers | 90 | Gait x 0.7, higher slip speeds, quieter footsteps | Drains and splashes soak them. Soaked slippers lose the bonus, squish and slip sooner. Dry them on the line for 1 min. |
| Fly Swatter | 100 | Swat (R) kills a fly or leaf for good | Each swing adds a 0.55 pulse |
| Finer Mesh | 150 | +0.5 L capacity, base drip x 0.7 | Fills slowly: tau 1.0s instead of 0.35s |
| Paved Path | 200 | A laid stone flattens the bumps in its 5 m segment for good and gives gait x 0.8 there | Lay one stone per walk back, 20 in total |
| Bigger Sieve | 300 | Capacity x 2 | Heavier: total x 1.15 (1.25 until M25, which made it a trap for shaky hands) |

Joke buys, so coins keep mattering after the upgrades:

| Item | Cost | Effect |
|---|---|---|
| Wish at the Well | 10 | A random caption. One wish in 6 brings the frog back. |
| Cat Treats | 40 | The cat stays away for 5 trips |
| Party Hat | 150 | Cosmetic. You wear it in every scene and in the ending. |

### Update Order

Each fixed step of 16.7 ms runs in this order:

1. `scenes/input` builds the `InputFrame` (section 6). Hand acceleration was measured at the last rendered frame.
2. Events advance warnings and resolve outcomes.
3. The walker updates speed and distance, fires footsteps, bumps and slips.
4. Steadiness feeds the hand meter and the body level and computes the total.
5. The sieve applies drips, slosh, holes and tilt, then checks for a break or tip.
6. Scene logic runs: crank, scoop, pour, chores.
7. Containers apply cat, plug and rain, whatever the current scene.
8. Timers finish: completed waits close their chores and play `ding`. The chore director runs.
9. Effects advance particles, shake and captions.
10. The snapshot publishes at 10 Hz of simulation time, or at once after a discrete event.

## 4. Design Coverage

Every line of the "Game 3: Water in a Sieve" section maps to a mechanic and a milestone.

| Design line | Mechanic | Milestone |
|---|---|---|
| Pitch: "Fill the bathtub. You only have a sieve." | Start screen pitch | M5 |
| Story: water cut off, interview tomorrow, the well | Start screen story, cold open, interviewer and water company calls, the ending calls | M5, M14, M20 |
| A sieve can hold water if you keep it still | Hand and body levels with zones, the ring | M1 |
| Jolt it, or let something touch the mesh, and it drains | Break at total 1.0; the fly and the falling leaf land and drain | M1, M11, M13 |
| On a phone the phone is the sieve; on desktop the mouse is | Motion mode; mouse grip with drift | M1, M6 |
| Your own steadiness decides everything | Telegraphed events, the ghost tick, re-grab window, classified releases | M1, M4, M5, M13 |
| Goal 1: a bucket (10 L), the tutorial | Bucket on the back step, 2 bumps, hints, no events before trip 6 | M3, M5 |
| Goal 2: the kitchen sink (20 L) | Kitchen room, 4 bumps, rose bush | M8 |
| Goal 3: the bathtub (100 L), the main goal | Bathroom room, 6 bumps, plug, milestones at 25, 50 and 75 L | M8 |
| Loop 1: crank up a bucket from the well | One crank per fill, with let-go and too-fast fails | M2 |
| Loop 2: scoop water into the sieve | Dip, fill curve, slow lift | M2, M6 |
| Loop 3: walk 100 m without jolting | Garden Path carry, speed ramp, bumps | M1, M4 |
| Loop 4: pour it into the tub without splashing | Pour flow and splash model with its own rules | M3 |
| Loop 5: walk back | Walk Back scene at 18 m/s, trip report, slips | M2, M4 |
| Meter on a phone reads phone jolts | `feedMotion` with touch grace | M6 |
| Meter on desktop reads sudden mouse moves while holding | Per-frame hand acceleration while gripping | M1 |
| Above the limit the sieve drains completely | Break moves all water to drained | M1 |
| Walking adds a small steady jolt; rushing a big one | gait(v) = 0.6 x (v / 8)², never scaled by settings | M1 |
| The well takes 1 min to refill after every 5 scoops | Refill timer blocks the crank | M2 |
| Glue takes 1 min to dry | Glue timer blocks scooping | M9 |
| Mend the mesh: snags tear holes; thread and sew | Holes from the rose bush and ice slips; swaying needle, stitches, glue | M8, M9 |
| Wipe spills: wet patches turn to ice in winter | Patches from drains and splashes, the Wipe flow, freezing | M4, M10 |
| Check the plug: the cat pulls the chain; the tub drains | Plug event, 0.015 L/s, drag the plug back | M12, M25 |
| Shoo the cat: it drinks from the tub | Cat drinks 0.008 L/s, tap to shoo | M12, M25 |
| Clear leaves: leaves in the bucket clog the sieve | Matter.js leaves, 15% less fill each | M11 |
| A fly lands on the water and breaks it | Fly event, Blow and Swat | M13, M15 |
| A sneeze warning: freeze until it passes | Sneeze event with the freeze check | M13 |
| The dog runs between your legs | Dog event, stop to let it pass | M14 |
| Your phone rings, in the game | Caller line, Answer or Decline, escalation, buzz pulses | M14 |
| Rain falls into the tub and drains away, mocking you | Guaranteed rain gag with `rainMl`, escalating | M14 |
| Each litre that reaches the tub pays coins | 30 coins per litre | M3 |
| A full trip with no drips pays a bonus | No-Drip Trip +30 with a cracking badge | M3 |
| Finer mesh: holds more, fills slowly | +0.5 L, tau 1.0s | M16 |
| Wax coating: fewer drips, rewax every 10 trips | x 0.35 drips, Rewax chore | M15 |
| Bigger sieve: more water, heavier, harder to hold | x 2 capacity, x 1.15 total | M16, M25 |
| Paved path: fewer bumps, laid one stone at a time | 20 stones, one per walk back, each flattens the bumps in its segment | M16 |
| Slippers: quieter, smoother steps, soaked, need drying | Gait x 0.7, quieter footsteps, soaking, 1 min drying | M15 |
| Fly swatter: removes flies, swinging jolts | Swat on R kills, 0.55 pulse | M15 |
| Sieve starts at 1 L, reaches about 3 L | 1.0, 1.5, 3.0 L | M16 |
| About 60 to 70 trips at about 45s each | An average player makes about 76 successful trips at 39s to 54s each, plus about 31 drained ones, which the design's next line adds on top (section 5) | M25 |
| Drains, chores and refills bring it to 1 to 2 hours | Whole seeded games: about 100 min for an average player (section 5) | M25 |
| Events partway through keep trips varied | Seasons by progress, the event director, the bathroom slot | M8, M13, M14, M17 |
| Ending: the tub fills, you step in, the water comes back on | Ending cutscene and EndingScreen | M20 |
| Share: the full sieve draining one step from the tub | Bathroom threats; auto slow-mo replay with a distance label | M17, M18 |
| Share: people filming themselves tiptoeing with a flat phone | Phone motion mode, "Hold It Like a Tray", Walk for Real | M6, M22 |
| Share: cards like "Trip 41: lost 3 L to a fly" | Share This Fail chip and cards | M19 |
| Control: hold the sieve steady | Phone flat and still; mouse button or Space and a still mouse | M1, M6 |
| Control: walk | Thumb down; W or the up arrow | M1, M6 |
| Control: scoop | Tip the phone forward and back; drag down, then up | M2, M6 |
| Control: crank the well | Draw circles; drag circles | M2 |
| Control: sew the mesh | Drag the needle through each stitch point | M9 |
| Build: no water physics | Water is a ledger number; drips and splashes are particles | M1 |
| Build: iPhones need permission; Tap to Start asks once | StartScreen with `motion` | M5, M6 |
| Build: Assist Mode for shaky hands | Shared setting for hands, body factor 0.85, suggestion toast | M1, M5 |

Project-wide rules from "Decisions So Far" and "Shared Foundation":

| Rule | How this game meets it | Milestone |
|---|---|---|
| 1 to 2 hours for an average player | Whole seeded games with skilled autopilots, guarded by `pacing.test.ts` | M25 |
| Waits are real time, about 1 min, unskippable, overlapped by chores | Shared timers; chore director rules | M2, M9 |
| No paid skips, no money, no server, no saving | Nothing persisted; no network code | All |
| Hand-drawn scrappy art, no external images | Shared sketch helpers only | M1 onward |
| Matter.js for falling objects | Leaves, kicked bucket, tumbling sieve, knocked bathroom items | M4, M8, M11, M12 |
| Keep the screen awake | StartScreen `startSession`; EndingScreen `endSession` | M5, M20 |
| Leave warning | The app mounts `useLeaveWarning(started)` from the start tap until the ending; EndingScreen silences it | M5 |
| Fail replays and share cards | ReplayRecorder, ShareModal | M18, M19 |
| One controls layer; settings with sound, sensitivity and Assist Mode | Shared input helpers, the game input layer and SettingsPanel | M1, M5, M6 |

## 5. Pacing Model

The DESIGN target is 60 to 120 minutes for an average player, longer for unskilled players. M25 tuned the average to about 100 minutes.

### How It's Measured

M25 replaced the original arithmetic with whole games. `game/pacing.ts` plays a seeded skilled autopilot through the real simulation, from the first crank to the full tub. Every wait, chore, event, slip, cat and plug counts. A whole game takes under a second of test time.

The estimate adds what the simulation never waits for:

- 60s for the start screen, the tray step and the cold open.
- 20s to read the shop for each upgrade bought.
- 10s for each automatic slow-mo replay.
- 3s for each first-time hint.

The skill profiles in `tuning.ts` stand in for players. M25 set the average player's twitches (1.5 a minute) and top carry speed (5 m/s) to match the success rates this plan assumed before M25: about 75% in the bucket, 70% in the sink and 65% to 70% in the bathtub. The unskilled player (2 twitches a minute, 3.5 m/s) lands near the assumed 55%, 50% and 45%.

Both pilots slow down the way the ring tells you to. They cross each patch under its slip speed and take bumps as fast as the ghost tick allows. They brake for patches on empty walks too. A pilot that never braked sat down on every puddle and soaked its slippers 30 to 90 times a game.

### Average Player

Sixteen seeds: **100 min on average** (90 to 117), over 97 to 122 trips. Between 20% and 38% of trips fail, 29% overall. The cat and the plug cost 2 to 7 L a game.

| Stretch | Trips per game | Success | Delivered per success | Successful trip | Failed trip | Drain point |
|---|---|---|---|---|---|---|
| Bucket, 1 L | 17 | 76% | 78% | 39s | 17s | 47 m |
| Sink, 1 L | 9 | 75% | 87% | 50s | 26s | 54 m |
| Sink, 1.5 L | 16 | 74% | 85% | 49s | 27s | 57 m |
| Bathtub, 1.5 L | 14 | 73% | 87% | 49s | 23s | 46 m |
| Bathtub, 3 L | 52 | 67% | 85% | 54s | 26s | 46 m |

A trip runs from the lift out of the well to the return, house visits included. Successful trips take 39s to 54s, not the 36s to 42s this plan first assumed. Bumps, patches, the rose bush and events slow every carry.

The 96 simulated minutes of an average game go to:

- carrying, 43.5 min;
- walking back, 20.7 min;
- scooping, 9.5 min;
- the walk-in and the pour, 6.8 min;
- house visits and the walks there, 5.7 min;
- the bench and the crank, 4.1 min;
- results and cutscenes, 3.6 min;
- standing at the well with nothing to do, 1.9 min.

The 22 refills barely show up. The trip that starts each refill and the chores the director opens fill them.

DESIGN.md's "about 60 to 70 trips" counts trips that deliver; its next line adds drained trips on top. The average player makes 74 to 78 successful trips a game (76 on average), plus about 31 drained ones. The trip count follows the sieve's size, not the drip: the bucket and the sink run at 1 L and 1.5 L, so 130 L can't take 65 trips. The audit pass tried a lower base drip on all 16 seeds. At 0.5% a second, trips fell from 108 to 104 and successful ones from 76 to 74, while every crawl got cheaper. The drip stays at 0.8%.

The pacing pilots skip Paved Path. With it bought after the slippers, an average game takes 104 min over 101 to 124 trips, and bump drains fall from 32 to 10 across 16 games.

### Unskilled Player

Sixteen seeds: **167 min on average** (143 to 191), over 136 to 184 trips. Between 38% and 54% of trips fail, 48% overall. The cat and the plug cost 6 to 15 L a game.

| Stretch | Success | Delivered per success | Successful trip | Failed trip |
|---|---|---|---|---|
| Bucket, 1 L | 63% | 74% | 48s | 26s |
| Sink, 1 L and 1.5 L | 60% to 61% | 78% | 56s | 26s to 27s |
| Bathtub, 1.5 L | 51% | 82% | 56s | 27s |
| Bathtub, 3 L | 47% | 79% | 63s | 34s |

### Assist Mode

Assist Mode is for shaky hands. It reads the hand at 0.78x and the body at 0.85x, and widens the tilt and slip limits by 1.5x. Warnings last as long as without it. Sixteen seeds per player:

| Player | Without Assist | With Assist | Minutes with Assist | Trips with Assist |
|---|---|---|---|---|
| Average | 29% of trips fail (20% to 38% per game) | 14% fail (9% to 25%) | 79 (76 to 89) | 82 to 99 |
| Unskilled | 48% fail (38% to 54%) | 27% fail (18% to 38%) | 109 (97 to 128) | 94 to 123 |

An unskilled player with Assist fails about as often as an average player without it, as the lead decided. Twitches cause most of the failing: about 18 of the unskilled player's 29 failed trips a game. Flies, the dog, the cat, leaves and bumps cause the rest, because Assist no longer buys extra reaction time. The cat and the plug cost an average player 2 to 5 L a game with Assist, and an unskilled one 3 to 8 L.

Before M27, Assist read hands at 0.6x and stretched every warning to 1.7s. Only 1% to 6% of trips failed, and players finished in 72 to 81 min.

### What M27 Changed

| Number | Before | After | Why |
|---|---|---|---|
| Hand meter in Assist Mode | 0.6x (the shared default) | 0.78x (`HAND_ASSIST_SCALE`) | Assist removed almost every twitch drain. |
| Event warnings in Assist Mode | 1.7s for the leaf, fly, dog, call and cat | Same as without Assist: 1.2s to 1.5s | Assist is for shaky hands. With the longer warnings an unskilled player failed less often than an average one in Assist Mode. |

A hand scale alone could not hit both targets. Failing comes from twitches over the time you hold water, so the unskilled player's rate stays about 1.6 times the average one's at any scale. At 0.8x the average player failed 16% and the unskilled one 25%. Plain warnings add back the reaction drains that only slow players suffer.

### What M25 Changed

| Number | Before | After | Why |
|---|---|---|---|
| Cat drinking | 0.02 L/s; 20% of trips; first pick at every refill | 0.008 L/s; 3% of trips; 30% of refills | It cost an average player 30 to 70 L a game. |
| Plug | 0.05 L/s on 15% of bathtub trips | 0.015 L/s on 5% | An unskilled player never caught up with it. |
| Director at a house arrival | No walking counted | The run back to the well counts 7s | The cat came on almost every refill through this gap. |
| Frog for drying slippers | On every hang with no other wait | Never | The wait blocks nothing, so the frog was busywork. |
| Patches on the path | No limit | 6 at most | Unskilled players met 7 slips a trip on an icy winter path. |
| Bigger Sieve weight | 1.25 | 1.15 | Shaky hands succeeded on 30% of bathtub trips with it. |
| Autumn leaf piles | 2 per trip | 1 | Each pile slows you down both ways. |
| Base drip | 1% a second | 0.8% | Fewer trips, with no change to the carry. |
| Carry speed-up | 1.6 m/s² | 2.2 m/s² | Faster recovery after each slowdown. |
| Average player | 0.8 twitches a minute, 4.5 m/s | 1.5 twitches a minute, 5 m/s | Matches the success rates this plan assumed. |

### Pacing Test

`pacing.test.ts` plays four seeded games per player through `playGame`, in about 8s. It asserts these facts:

- An average player's mean estimate is between 60 and 120 minutes, and every game finishes.
- An unskilled player's mean is over 120 minutes, and every game still finishes inside 5 hours.
- The unskilled player fails more often than the average one in every container.
- The cat and the plug cost an average player under 8 L a game.
- Assist Mode fails an unskilled player on 20% to 35% of trips, within 8 points of an average player without it, and fails an average player on 8% to 18% of trips. Seeds 1 to 4 measure 26% for the unskilled player with Assist, 27% for the average one without it and 13% for the average one with it.
- Assist Mode makes an unskilled player faster, and an average player in Assist Mode still takes over an hour.

Seeds 1 to 4 estimate 95 min for the average player. One seed swings by up to 15 min, so check a tuning change with 8 to 16 seeds through `playGame` and `phaseRates`.

## 6. Controls

The input layer in `scenes/input.ts` turns raw input into one `InputFrame` per step. Mode comes from `prefersMotion(motion, pointer)` first, then `pointer.lastType`.

| Action | Desktop | Phone with motion | Phone without motion |
|---|---|---|---|
| Grip the sieve | Hold the left mouse button on the play area, or hold Space with the pointer hovering | Always gripped: the phone is the sieve | A thumb pressed in the play area, outside the walk pad, tracked by pointer id |
| Hold steady | Steer the sieve onto the dot with smooth moves | Keep the phone still and level | Steer with the gripping thumb |
| Walk | Hold W or the up arrow | Any pointer that started outside the fly radius, or on the **Hold to Walk** pad; with Walk for Real, your real steps | A pointer that started in the **Hold to Walk** pad (the bottom band, or the foot of the right column on a wide touch screen) |
| Crank | Drag circles around the crank | Draw circles on the crank | Same |
| Scoop | Drag the sieve down into the bucket, hold, drag up slowly | Tip the phone forward past 25°, hold, tip back under 8°; the sieve then rises on its own at 110 units/s | Drag down and up |
| Pour | Move the mouse right of the pour anchor; or hold D to raise it, A to lower | Tilt the phone right | Drag the grip thumb right |
| Blow at a fly or leaf | Hold F | Hold a finger on the fly | A pointer that started on the fly |
| Swat (Fly Swatter) | Press R | Tap **Swat** | Tap **Swat** |
| Answer or decline a call | E answers, F declines | Tap **Answer** or **Decline** | Same |
| Freeze for a sneeze or the dog | Release W, keep the mouse steady | Lift the walking thumb, keep the phone still | Lift the walking thumb |
| Thread the needle | Drag the thread end into the swaying eye | Same with a finger | Same |
| Sew | Drag the needle through each stitch point in order | Same | Same |
| Wipe, scrape ice, rewax | Drag back and forth | Rub with a finger | Same |
| Clear leaves | Drag each leaf out of the bucket | Same | Same |
| Shoo the cat, fix the plug, lay a stone, move the frog | Click the cat; drag the plug in; drag the stone; drag the frog | Tap and drag | Same |
| Pause and settings | Esc | Menu button | Menu button |

### InputFrame

```ts
type InputMode = 'mouse' | 'motion' | 'touch'
type ReleaseKind = 'none' | 'letGo' | 'pause'

interface InputFrame {
  mode: InputMode
  grip: boolean // a grip pointer or Space is held, or motion mode is calibrated
  gripId: number // pointer id of the grip; -1 for Space or motion
  gripPressed: boolean // a fresh grip press (pointerdown or Space keydown) since the last step
  release: ReleaseKind // a classified grip release since the last step
  x: number // grip position in logical units
  y: number
  handAccel: number // units/s², measured at the last rendered frame; 0 in motion mode
  motionJolt: number // m/s² after touch grace
  tiltX: number // degrees from the calibrated pose
  tiltY: number
  walk: boolean
  pour: number // pour keys: 1 for D or the right arrow, -1 for A or the left arrow; the sim integrates it
  blow: boolean
  swat: boolean // pressed this step
  answer: boolean // pressed this step
  decline: boolean // pressed this step
}
```

Notes:

- Desktop walking reads keys only, so the mouse press stays the grip. Phone walking reads any non-grip press, so the action stays on the thumb.
- The grip is the specific pointer id that pressed in the play area. A re-grab only counts from a `pointerdown`. When the shared tracker hands the primary to another finger, that is a let-go, not a re-grab.
- Pads (Hold to Walk) are display-only overlays with `pointer-events: none`. The input layer hit-tests them per pointer id from `onDown` and `onUp`.
- A release is a pause, not a let-go, when its event type is `pointercancel`, the game is paused, a pause trigger fired in the same frame, or `document.hasFocus()` is false. Don't rely on `event.isTrusted`; browser tests dispatch untrusted events.
- When the input set changes, a grip held by the other kind of device stops counting without a release (`GripControl.switchTo`), so the new device can take hold. The sim decides what the switch means: a pause with water at stake, a fresh pick-up otherwise.
- The fly hit area has a 50-unit radius. A press that starts there blows instead of walking. The same goes for a falling leaf. A finger only blows while the sieve is already in hand (motion mode, or another finger gripping), so a first press near the fly still grips.
- The start screen tells phone players: "Tip: turn on rotation lock. A flat phone likes to flip the screen."
- Gestures (crank, rub, sew, leaves) stay sim commands that the scene input and the autopilot call directly.

## 7. Art Direction

### Palette

| Use | Colour |
|---|---|
| Paper background, sky | `palette.paper`, `paperDark` for distant hills |
| Every outline | `palette.ink`, width 3; `inkSoft` for background lines |
| Water, rain, drips | `palette.water` at 0.75 alpha, `blue` for depth lines |
| Grass, leaves in summer | `green` hatch |
| Dirt path, wood, well roof, dog | `brown` hatch |
| Autumn leaves, cat | `orange`, `yellow` |
| Ice | `water` at 0.5 alpha with white shine strokes |
| Danger: limit notch, break flash, rose bush, tilt wedge | `red`, `pink` |
| Slippers, rubber duck, coins, party hat | `yellow` |

### Characters

- **You:** a lanky figure with a big round head (`sketchCircle`, radius 34) and three-strand bedhead. You wear striped pyjama bottoms (`blue` hatch), a white interview shirt and a red tie, with a towel over one shoulder. You go barefoot until Slippers, which are yellow bunny slippers with floppy ears.
- **Poses:** carry (arms out, tongue out in focus), tiptoe (under 1.5 m/s, knees bent), rush (leaning forward), slip (legs up), sneeze (head back), freeze (stiff, one sweat drop), crank, scoop, pour, pratfall, tired arms (trembling, sweat drops).
- **Faces:** calm; focus with tongue out; worried with sweat drops above total 0.7; despair with X eyes after a drain; smug after a No-Drip Trip. The face changes on discrete events only.
- **The cat:** an orange tabby (`orange` fill, ink hatch stripes) with half-closed eyes and a curled tail. It drinks with a pink tongue and pulls the chain with one paw. Shooed, it puffs into a spiky `sketchBlob` and leaps off.
- **The dog:** a scruffy brown blob with floppy ears, a lolling tongue and a tail that wags through `boilSeed`. A dust cloud follows it.
- **The fly:** an ink dot with two translucent circle wings, a dotted flight trail and "bzz" squiggles in `sketchText`. It turns red-eyed when it comes back angry.
- **The frog:** a green blob with big eyes, sitting on the crank handle.
- **The mole:** pops out of each new bump once, with a hard hat.

### Props and Rooms

- **The sieve:** a wooden rim (`sketchEllipse`, width 4), a hatch-filled mesh (gap 7; Finer Mesh crosses two hatch passes at gap 4) and a handle (`sketchRoundRect`). Water is an inner ellipse sized by `sqrt(fill)`, with highlight arcs that boil. The surface ellipse leans with tilt and ripples on pulses. Holes are jagged `blobPoints` filled with paper and frayed wire ends. Wax adds white gloss streaks. The bigger sieve draws 1.4x larger.
- **The well:** a ring of blob bricks, a triangular hatched roof, a rope drawn with `sketchPath` `smooth`, and a crank handle. A painted sign reads "Wishing well. No refunds." When the well is dry it shows a cracked bottom.
- **The path:** a brown hatched strip with grass tufts. Fence posts, hills and the path strip are seamless `CachedLayer` tiles 1600 units wide, stamped side by side with wrap to cover any view width. Props (bumps, patches, stones, signposts, the rose bush) are small stamp layers. Hand-lettered signposts stand at 25, 50 and 75 m; the 50 m one reads "Halfway. Sort of." Bumps are roots and rocks with a red hand-drawn arrow. The house appears at the end.
- **The house:** a back door and step with the bucket. The kitchen has a sink full of dishes. The bathroom has a claw-foot tub (`sketchPath` `smooth`, white fill) with a litre ruler painted on its side, a plug chain, a rubber duck and a skylight. A sticky note on the mirror says "INTERVIEW 9AM".
- **Season layers:** each scene's background is a `CachedLayer` per season. Changing season calls `invalidate()`. View-sized layers are recreated in `viewport.onResize`. Winter adds snow caps; spring adds flowers and rain streaks.

### Effects and Juice

- **Particles:** one preallocated pool of 160 particles in typed arrays for drips, splash droplets, raindrops, dust, sweat and sparkles.
- **Screen shake:** 12 units for 300 ms on a drain, 5 units on a slip. Skipped under Reduced Motion.
- **Squash and stretch:** your body bobs 5% per footstep; the sieve squashes 10% on pulses; coins pop with a stretch.
- **Captions:** Permanent Marker at size 44, `tilt: 0.08`, paper `outline`, held 1.6s. A seeded bank with at least 6 lines per cause avoids repeats, for example "Gone. All of it.", "Mind the root.", "Good boy. Bad timing.", "Ice. Of course.", "Your wet floor.", "Should've declined.", "You let go. Why?". Some lines quote your own stats: "Third fly today.", "That's 12 L to the dog.", "8 m. Eight."
- **Big drains** (at least half a sieve) add the sad trombone (`fail`) and `vibrate([40, 30, 80])`.
- **No-Drip badge:** a little gold sticker during the carry. It cracks with a low `pop` on the first counted loss.

### Sound Map

| Moment | Sound |
|---|---|
| Crank quarter turn; let go; too fast | `crank` with pitch rising per circle; `rattle` as it spins down; `slam` |
| Dip; lift; slosh zone | `splash` at pitch 0.7; `slosh`; `slosh` rate-limited to 3 per second |
| Drips; tilt dribble | `drip` at random pitch, at most 6 per second; `drip` faster as the dribble grows |
| Bump ahead | `tick` repeating faster as it nears |
| Break or tip | `splash`, then `fail` for big drains |
| Footsteps every 0.8 m | `thud` at volume 0.15 with pitch jitter; half volume with dry slippers; `squish` when soaked |
| Pour | `pour` loop with `setVolume(flow / 2)`; `splat` on floor splashes |
| Coins; No-Drip Trip; badge cracks | `coin`; `ding`; `pop` at pitch 0.6 |
| Fly; swat; blow | `buzz` every 300 ms; `whoosh` then `splat`; `wind` at low volume |
| Sneeze; dog; phone; cat | `sneeze`; `bark`; `ring`; `meow` |
| Cat lapping | `drip` repeated fast at pitch 1.4 |
| Plug gurgle | `pour` at pitch 0.5 |
| Rain | `rain` loop |
| Slip | `whoosh`, then `thud` |
| Stitch, glue, stone, wipe, wax | `pop`, `squish`, `thud`, `scrub`, `scrub` |
| Frog hop | `pop` at pitch 1.6 |
| Cold open tap cough | `rattle` |
| Ending taps | `splash` plus the `pour` loop |
| Well dry; timer done | `rattle`; `ding` |

### First-Time Hints

Each hint shows once, in the hint line (canvas on phones, the left column on desktop). Each milestone ships the hints for what it adds. In the bucket phase, any event that can roll from trip 6 is taught at or before its first warning.

| Trigger | Copy | Milestone |
|---|---|---|
| First grip on the path | Keep holding. Hold W to walk. (Phone: Hold a thumb down to walk.) | M1 |
| First crank | Draw slow circles on the crank. Don't let go. (A fast crank slops scoops, and the "Bucket up." caption says how many.) | M2 |
| First scoop | Grab the sieve. Dip it. Hold. Lift slowly. | M2 |
| First walk back | Nothing to spill. Run. | M2 |
| First refill | The well needs 1 min. Do a chore. | M2 |
| Frog | A frog. On your crank. Move it. | M2 |
| First pour | Move right to pour. Stay in the green. (Keys: D pours, A eases.) | M3 |
| No-Drip badge | No drips this trip earns a bonus. | M3 |
| First bump in range | Bump ahead. Watch the ring. Slow down. | M4 |
| First wet patch in range | Wet. Tiptoe across. | M4 |
| Trip 2 drift | The sieve wanders. Keep it on the dot. | M5 |
| Arm fatigue | Arms. Going. Hurry up. | M5 |
| Rose bush | Thorns. Walk past slowly. | M8 |
| First hole | A hole. Mend it at the bench. | M9 |
| Threading | Thread the needle. Wait for the sway. | M9 |
| Sewing | Stitch the dots in order. | M9 |
| Glue | Glue dries in 1 min. Do a chore. | M9 |
| Ice | Ice. Slower still. | M10 |
| Wipe prompt | Stop on it and rub to wipe. | M10 |
| Leaves in the bucket | Leaves. Drag them out first. | M11 |
| Falling leaf | A leaf. Hold F to blow it off. | M11 |
| Cat drinking | The cat's drinking your water. Go shoo it. | M12 |
| Plug | Gurgle. Check the plug. | M12 |
| Fly | A fly. Hold F to blow it away. | M13 |
| Sneeze | Ah… ah… Stop walking. Hold still. | M13 |
| Dog | Woof. Stop and let it pass. | M14 |
| Call | E answers. F declines. | M14 |
| Shop (at the well, empty sieve, an upgrade affordable) | Coins buy upgrades. Shop with an empty sieve. (Phone: Coins buy upgrades. Tap your coins to shop.) | M15 |
| Rewax | Wax wore off. Click the wax tin to rub it back on. (Due early: Wax wearing thin. Click the wax tin to top it up.) | M15 |
| Soaked slippers | Soggy slippers. Click the washing line to dry them. | M15 |
| Swatter (after the fly or leaf hint) | R swats. It shakes the sieve. (Phone: Tap Swat. It shakes the sieve.) | M15 |
| Lay stone | Stop here to lay a stone. | M16 |
| Bathroom threat (after that event's own hint) | It followed you in. Hold still. | M17 |
| Cat round your ankles | The cat. Let go of W. Let it weave. (Phone: Lift your thumb.) | M17 |
| First carry walking for real | Walk for real. Small, gentle steps. (The walk back, sneeze, dog, cat and visit lines say "Stop walking", "Stand still" or "take a step" while walking for real.) | M22 |
| Last Trip offer (phone holding the sieve, Walk for Real off, while its button shows) | Last trip. Walk it for real? Tap Walk for Real. | M22 |

## 8. Modules, Files and State

### File Layout

```text
water-in-a-sieve/src/
  main.tsx  index.css  App.tsx
  dev.ts                 window.__game.sieve and dev panel actions (DEV only)
  game/                  pure logic, no React, no DOM, unit tested
    tuning.ts  types.ts  ledger.ts  sieve.ts  steadiness.ts  hand.ts  drift.ts  walker.ts
    path.ts  pour.ts  well.ts  seasons.ts  events.ts  chores.ts  containers.ts
    economy.ts  replays.ts  share.ts  ending.ts  pacing.ts  autopilot.ts  sim.ts  snapshot.ts
  scenes/                canvas renderers and per-scene input
    input.ts  layout.ts  renderer.ts  physics.ts
    well.ts  path.ts  house.ts  cutscenes.ts  ending.ts  film.ts
    art/  hero.ts  sieve.ts  props.ts  animals.ts  rooms.ts  backgrounds.ts  fx.ts
  ui/                    React overlay
    Hud.tsx  ContainerBar.tsx  WaitChips.tsx  ContextSlot.tsx
    ChoresPanel.tsx  ShopModal.tsx  SettingsModal.tsx  ReplayModal.tsx (and ShareDialog)
    Ending.tsx
```

- `game/sim.ts` owns the one mutable `GameState` and exposes `update(dtMs, input)` plus commands for gestures: `crankCircle(direction, durationMs)`, `crankLetGo()`, `moveFrog()`, `threadNeedle(hit)`, `stitch(holeId, index)`, `applyGlue()`, `rub(target, strokes)`, `removeLeaf(id)`, `shooCat()`, `fixPlug()`, `layStone()`, `hangSlippers()`, `buy(id)`.
- `scenes/` feed gestures and call those commands. Renderers only read state.
- `game/autopilot.ts` produces `InputFrame`s and calls gesture commands for dev and tests. Only `dev.ts` and tests import it, so production builds drop it.
- `scenes/physics.ts` reuses one Matter engine and clears its world per scene, capped at 20 bodies. `GameState` owns leaf ids and rest positions, and the scene world is rebuilt from them. Dragged bodies follow a pointer constraint (stiffness 0.2), and bucket walls are static and at least 30 units thick.

### Simulation State

The game loop owns this object and mutates it in place. React never reads it directly.

```ts
interface GameState {
  scene: SceneId
  phase: Phase
  paused: boolean
  holdStillMs: number // resume countdown after a pause
  trip: number // trips started; drives wax wear and the Year 2 caption
  season: Season
  containerIndex: 0 | 1 | 2
  sieve: SieveLedger & { holes: Hole[]; waxTripsLeft: number } // leaves cling to the mesh only while dipped
  steady: { hand: number; body: number; total: number; pulses: Pulse[] }
  grip: { held: boolean; anchorX: number; anchorY: number; offsetX: number; offsetY: number; tipMs: number }
  drift: { t: number; p1: number; p2: number; p3: number; p4: number; fatigue: number; carryMs: number }
  containers: ContainerLedger[] // bucket, sink, bathtub
  walker: { distance: number; speed: number; dir: 1 | -1; slipMs: number; nextStep: number }
  path: { bumps: number[]; stones: boolean[]; patches: Patch[]; roseFrom: number }
  well: { scoopsLeft: number; crankTurns: number; bucketUp: boolean; leaves: Leaf[]; frog: 'none' | 'on' | 'hopped' }
  waits: { refill: RealTimer | null; glue: RealTimer | null; slippers: RealTimer | null }
  slippers: 'none' | 'dry' | 'soaked' | 'drying'
  event: ActiveEvent | null
  house: { floorPatch: boolean; floorWiped: number; leaveArmed: boolean; pour state }
  cat: { mood: 'away' | 'drinking'; plugOut: boolean; plugHeld: boolean; plugX: number; plugY: number }
  current: TripRecord // scoopedMl, lossesByCause, counted losses, maxDistance, startedAt; reset per trip
  stats: SessionStats // totals by cause, fliesBlown, slips, startedAt
  lastDrain: { cause: LossCause; ml: number; distance: number } | null
}
```

The shared `Wallet`, `Shop` and `ChoreBoard` sit beside `GameState` and keep their own stores. The hand `JoltMeter` instance lives in the sim; its level is copied into `steady.hand` every step.

### React Snapshot

`game/snapshot.ts` publishes a flat `HudSnapshot` of primitives through `createStore`. It updates at 10 Hz of simulation time and at once after discrete events: drains, deliveries, scene changes, chores and modals. Litres are rounded to 0.1 L before publishing, so a dripping sieve doesn't notify React every step. Nested objects are reused when nothing in them changed, and the ending stats are built once.

```ts
interface HudSnapshot {
  scene: SceneId
  phase: Phase
  trip: number
  season: Season
  containerId: ContainerId
  containerTenths: number // litres x 10
  containerCapacityTenths: number
  rainTenths: number
  containerDraining: boolean
  sieveTenths: number
  sieveCapacityTenths: number
  scoopsLeft: number
  refill: RealTimer | null
  glue: RealTimer | null
  slippers: RealTimer | null
  context: ContextAction | null // the one context slot button
  hint: string | null
  noDrip: 'none' | 'intact' | 'cracked'
  modal: 'shop' | 'settings' | 'replay' | 'share' | null
  inputMode: InputMode
  canShop: boolean
  lastTrip: 'no' | 'last' | 'really'
  paused: boolean
  ending: EndingStats | null
}
```

Fast values never go through the snapshot. The HUD `Meter` reads `steady.total` with `read`, and `LiveText` reads distance and sieve litres during a carry. `RealTimer` references only change when a wait starts or ends.

## 9. Dev Hooks

### The `window.__game.sieve` API

`dev.ts` calls `exposeDev('sieve', api)` inside `if (import.meta.env.DEV)`. The loop publishes `window.__game.loop` by itself.

```ts
interface SieveDevApi {
  state(): Readonly<GameState>
  snapshot(): HudSnapshot
  ledger(): { litres: Record<string, number>; balanced: boolean }
  toClient(x: number, y: number): { x: number; y: number } // logical to client px
  goto(scene: SceneId, options?: { distance?: number; full?: boolean }): void
  addCoins(amount: number): void
  setContainer(id: ContainerId, litres?: number): void // earlier containers count as full; season follows
  season(season?: Season): Season
  cutscene(id: CutsceneId): void
  setTrip(trip: number): void
  setSieve(litres: number): void
  addHole(count?: number): void
  addPatch(at: number, kind?: 'wet' | 'ice' | 'leaves'): number
  context(): ContextAction | null // the context slot's button
  doContext(): void // Share opens the share dialog, as the button does
  rub(strokes?: number): void
  trigger(event: EventId): void // fly, leaf, sneeze, dog, ring, bathroom (a random threat), catAnkles, rain, leaves, catDrink, catPlug
  bathroom(id?: 'fly' | 'catAnkles' | 'sneeze'): void // sends that threat after you into the house
  call(what: 'answer' | 'decline' | 'e' | 'f'): boolean // answer or decline a call, or answer the interviewer
  removeLeaf(id?: number): boolean // as if dragged out over the rim
  shooCat(): boolean // on a house visit
  fixPlug(): boolean // on a house visit
  blowTarget(): { x: number; y: number } | null // where the leaf or fly is, for a finger press
  finishWaits(): void
  buy(id: UpgradeId, options?: { free?: boolean }): boolean
  buyJoke(id: JokeId): string | null // a wish, cat treats or the party hat; returns the toast line
  canShop(): boolean
  soakSlippers(): void
  hangSlippers(): boolean
  wearWax(): void // opens the Rewax chore
  rubWax(strokes?: number): boolean // at the open bench in wax mode
  swat(): boolean // the phone's Swat button
  layStone(): boolean // gets the walk's stone out if Lay Stone shows, and lays it
  replay(): { id; label; caption; frames; auto; still; open } | null // the latest drain on film
  openReplay(): boolean // opens the latest drain's replay
  share(): boolean // opens the share dialog for this walk back's card
  dialog(): 'settings' | 'chores' | 'shop' | 'replay' | 'share' | null
  closeDialog(): void // as Skip or Close would
  drain(cause?: LossCause): void
  input: {
    set(frame: Partial<InputFrame>): void // overrides fields every step until clear()
    clear(): void
    path(samples: Partial<InputFrame>[], hz?: number): void // one frame per sample, stepping the loop between them
  }
  fakeMotion(reading: { jolt?: number; tiltX?: number; tiltY?: number } | null): void
  realWalk(on?: boolean): boolean // reads Walk for Real, or turns it on or off
  fakeSteps(count: number, options?: { peak?: number; everyMs?: number }): { metres; steps; scene; phase } // real steps through the fake phone (default 1.5 m/s² every 550 ms); needs motion mode
  internals(): { sim; renderer; input; viewport } // the live objects, for profiling one piece at a time
  autopilot(on: boolean, options?: { speed?: number; profile?: 'average' | 'unskilled' }): void // no profile plays flawlessly
  showEnding(): void // fills the tub and plays the ending now
  mode(): InputMode // 'mouse', 'touch' or 'motion'
  restart(): void // reloads without the leave prompt
}
```

- `?skip` (dev only) starts at the well with no start screen and no cold open. `?tray` treats any device as a phone: the start screen offers Walk for Real and "Hold It Like a Tray" follows the start tap; feed it with `fakeMotion`.
- Walk for Real in a browser test: one `pointerType: 'touch'` press, `fakeMotion({ jolt: 0.1 })`, `realWalk(true)`, then `fakeSteps(n)`. Touch grace halves the jolt for 150 ms of real time after a touch, so take steps in a later evaluate than the tap.
- After the start tap the leave prompt blocks reloads and navigation, so use `restart()` to reload.

- `input.set` and `input.path` drive continuous steering. Synthetic pointer events dispatched in a loop get nearly identical timestamps, so use them only for discrete actions: presses, releases, crank circles, rubs and taps.
- `fakeMotion` replaces the motion source with a fixed reading and marks it available. `prefersMotion` then needs a touch press, so send one `pointerType: 'touch'` press first.
- `ledger().balanced` checks both invariants, so every browser test can assert it.
- `?debug` draws physics outlines and an overlay: hand, body and total levels, drift and offset in degrees, the last drain cause, bump and patch markers, frame time (average and worst over 60 frames) and React commits per second. The overlay lives in `scenes/debug.ts` and the counters in `scenes/perf.ts`; the renderer calls both behind `import.meta.env.DEV`, so production builds drop them.
- The sim's dev and test helpers (`jumpTo`, `setContainer`, `setSeason`, `setSieve`, `finishWaitsNow`, `addHoles`, `dropLeaves`, the event, cat, plug and rain triggers, and `buy`'s `free` option) return early unless `import.meta.env.DEV`, so production builds keep only empty stubs.
- `SIEVE_HTTPS=1 bunx vite` (M6) serves over HTTPS with a self-signed certificate from `water-in-a-sieve/.certs/`, made with openssl. Phones on the LAN can then send motion.
- `?spike` (dev only, M26) opens the spike recorder instead of the game: 8 takes on a real phone, then suggested phone numbers, checks, **Copy Readings** and **Play With These**. Off a phone, dispatch `DeviceMotionEvent` and `DeviceOrientationEvent` at about 60 Hz to feed it.
- `?tune=NAME:value,…` (dev only, M26) overrides the 9 phone numbers listed in `game/tune.ts`, for example `?debug&tune=MOTION_REF:5,STEP_START_JOLT:1.1`. Unknown names and negative values are ignored, and `?debug` lists the overrides.

### Dev Panel

The backquote key opens the shared panel with these actions (all built as of M24): **+100 Coins**, **Fill Sieve**, **Drain Here**, **Add Hole**, **Finish Waits**, **Container to 90%**, **Next Container**, **Next Season**, **Trigger Fly**, **Trigger Leaf**, **Trigger Sneeze**, **Trigger Dog**, **Trigger Call**, **Trigger Rain**, **Cat Drinks**, **Cat Pulls Plug**, **Drop Leaves**, **Bathroom Threat**, **Go to Well**, **Go to Path**, **Go to House**, **Go to Walk Back**, **Buy All Upgrades**, **Puddle Ahead**, **Autopilot On/Off** (the average player), **Walk for Real On/Off**, **Show Replay**, **Show Ending**, **Fake Phone Level On/Off**. Each milestone adds the actions for what it builds.

### Browser Test Recipe

Check the dev server with `curl -s -o /dev/null -w '%{http_code}' http://localhost:5175/`. Open your own tab at `http://localhost:5175/?fast`. Paste these helpers once per page load through `preview_evaluate`, then drive the game with them and `step(n)`.

```js
const c = document.querySelector('canvas')
const g = window.__game.sieve
const step = n => window.__game.loop.step(n)
const pe = (type, lx, ly, id = 1, pointerType = 'mouse') => {
  const p = g.toClient(lx, ly)
  c.dispatchEvent(
    new PointerEvent(type, {
      clientX: p.x, clientY: p.y, pointerId: id, pointerType,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true
    })
  )
}
const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
```

Use `pe` for presses and releases, `key` for W and Space, `g.input.set({ handAccel })` for steering, and `g.state()` to read results. Check `g.ledger().balanced` and read console errors in every snapshot.

Notes from M8 to M10:

- Gestures (crank, bench, rub) classify their release too, so in the unfocused preview tab they end as pauses. For gesture tests run `document.hasFocus = () => true` in the page first; it only affects the test tab.
- `RubGesture` needs the pointer to turn back: dispatch several moves per sweep (for example 6 steps from x - 60 to x + 60 and back). Jumping between two points never counts a stroke.
- The bench eye sways from `state().bench.swayS`: `eyeX = 270 + sin(swayS x 0.45 x 2 pi) x 30 x (1 + 2 x shake)`. Synthetic moves have near-equal timestamps, so they read as shaky (shake 1).
- Hot reload keeps the old renderer and input objects when a scene file changes; reload with `restart()` before judging art. Resizing to a phone preset right after `restart()` has twice closed the preview tab; open a new tab instead.
- The first snapshot after an evaluate is sometimes a stale frame. Take a second one before trusting a screenshot.

The preview tab never has focus, so a real pointerup classifies as a pause and the tab blurs after automation clicks. Release with `g.input.set({ release: 'none' })` (or `'letGo'`) around the `pointerup`. The dev autopilot presses to resume any pause, except while a dialog is open. For motion mode, send one `pointerType: 'touch'` press, then `g.fakeMotion({ tiltX, tiltY, jolt })`.

## 10. Unit Test Plan

Tests sit next to the code. They use plain objects for input, a seeded `rng`, and a fake clock for timers. None of them only check that something renders.

| File | What it proves |
|---|---|
| `ledger.test.ts` | Whole-mL moves conserve water; remainders carry fractions; moves clamp to the source; 10,000 seeded random operations keep both invariants exact |
| `sieve.test.ts` | Capacity 1.0, 1.5, 2.0 and 3.0 L; fill reaches 95% at 3 tau; leaves cut fill 15% each; base drip 0.8% per second with and without wax; slosh is 0 below 0.55 and 0.25 x water at 1.0; hole leak; tilt dribble from 12°; tip at 30° |
| `steadiness.test.ts` | gait values at 2, 4, 6 and 8 m/s; a 120 ms pulse reaches 95%; a bump at 6 m/s breaks and at 2 m/s stays green; Bigger Sieve weight; Assist Mode (hands at 0.78x) and Sensitivity 0.5 scale only the hand level; an 8 m/s bump still breaks at Sensitivity 0.5; the break cause comes from the largest pulse |
| `hand.test.ts` | The same hand motion at 30, 60 and 120 fps reads within 10%; a still pointer reads 0; synthetic events with equal timestamps don't spike |
| `drift.test.ts` | Drift amplitude grows with speed and fatigue; trip 1 has none; offset to degrees maps 100 units to 30°; the same seed gives the same drift |
| `walker.test.ts` | Reaches 5 m/s after 2.3s of holding; slows at 6 m/s²; walks back 100 m in about 7s; footsteps every 0.8 m; slip thresholds for wet, ice, dry and soaked slippers, with Assist Mode |
| `path.test.ts` | Seeded bumps are at least 8 m apart and absent from the last 5 m; trip 1 has one bump at 20 m; bumps reshuffle per season and skip paved segments; a drain adds a patch 1.5 m ahead; patches dry after 3 trips outside winter; winter freezes patches present at a trip's start; a new trip keeps at most 6 patches, oldest gone first; wiping removes a patch; path chore prompts appear within 3 m |
| `pour.test.ts` | Flow from axis values; no splash at or below 0.6 L/s; splash fraction caps at 0.7; a 55-unit mouse offset pours with no dribble; D raises and holds the value; a dump splits 40/60; overflow past capacity counts as splashed |
| `well.test.ts` | 5 circles raise the bucket, 6 in winter; wrong-way circles subtract; letting go resets; a circle under 0.55s slops a scoop; the bucket stays up for 5 scoops; the fifth scoop starts the refill and blocks the crank until the fake clock passes 60s |
| `seasons.test.ts` | Summer in the bucket phase, autumn with the sink, winter at 15 L in the tub, spring at 60 L; the Year 2 caption after trip 150 |
| `leaves.test.ts` | 15% off a scoop per floating leaf, at most 3; autumn cranks bring leaves 60% of the time; 3 leaves cap a scoop at 55% and clearing them restores it; no dragging while dipped; leaves stay put across a house trip; the wind brings them on an autumn refill; the falling leaf drains when ignored, blows off, and blowing shakes the sieve |
| `rain.test.ts` | Rain fills about 3 L over 10s and drains back to exactly the tub's own litres; the gags escalate and the umbrella keeps the tub dry; rain always comes on the first spring arrival |
| `events.test.ts` | No events before trip 6; one per trip; 2-trip cooldown; seeded rolls repeat; every warning lasts at least 1.2s; failed counters drain directly in Assist Mode and at Sensitivity 0.5; the fly gives up after 2 blows; sneeze held in when frozen and not when walking; dog passes when stopped; declined callers escalate; the bathroom slot is guaranteed on Last Trip |
| `chores.test.ts` | Holes and glue block `scoop`; refill blocks `crank`; the frog blocks `crank`; every wait start leaves at least 70% of its time covered; a refill's house chore is the wet floor, or the cat when its roll comes up; reaching the house counts the 7s run back; Rewax appears after 10 trips; soaked slippers open the drying chore; the threading eye sways more with a higher hand level; an out-of-order stitch unpicks the last one |
| `containers.test.ts` | Completion at capacity locks the container; whole-mL drains with remainders; cat and plug rates (0.48 L and 0.9 L a minute) that stop once fixed and only start when eligible; a pour ends in a visit while the cat drinks; rain returns `rainMl` to 0 and is guaranteed on the first spring arrival; milestones fire once at 25, 50 and 75 L; losses stop while paused |
| `economy.test.ts` | Deliveries pay 30 coins per litre, rounded per delivery; a clean trip earns No-Drip without wax; one slosh tick loses it; container bonuses; upgrade effects and their chores (a laid stone flattens its segment's bumps); joke buys |
| `share.test.ts` | "Trip 41: lost 3 L to a fly"; one decimal under 10 L with no trailing ".0"; every cause has a phrase; fail and ending cards carry their 4 named stats |
| `pacing.test.ts` | Whole seeded games: the average estimate is between 60 and 120 minutes, the unskilled one above 120 with every game finished; unskilled fails more in every container; the cat and the plug cost under 8 L; Assist Mode fails an unskilled player on 20% to 35% of trips, within 8 points of the average player without it, and an average one on 8% to 18%; Assist Mode speeds an unskilled player up and still takes an hour; phase rates and the estimate's extras from plain samples |
| `sim.test.ts` | From M1: autopilot completes a full trip, delivers what the ledger says and keeps it balanced; a scripted flick drains with cause `jolt`; a held pointer keeps its tilt across scene changes; a blur release pauses instead of tipping. Each milestone extends it. |
| `spike.test.ts` | A synthetic phone session's suggestions pass every M27 check; calm thumb presses switch grace off; missed steps lengthen the stride; missing takes keep today's numbers; soft knocks warn; scoop tips count past 25° and back; the readings text; `?tune` keeps only known, non-negative numbers |
| `scenes/layout.test.ts` | The walk pad uses the bottom band slot on phones, and on a wide touch screen sits at the foot of the right column, where the input layer hit-tests the same box |
| `scenes/input.test.ts` | Mode selection; desktop walk reads keys only; Space grips; the grip follows its pointer id; a takeover is a let-go; pad presses walk in two-thumb mode; touch grace halves motion jolt; the re-grab window catches a 150 ms release and not a 250 ms one; blur, dialog and `pointercancel` releases are pauses |

## 11. Milestones

Each milestone ends with `npx prettier --write` on touched files, then `bun run typecheck`, `bun run test` and `bun run build` inside the game folder. Verify in your own preview tab at 1280 x 800 and the iphone-12-pro preset with `?fast`. Every milestone adds its dev hooks, extends the autopilot and `sim.test.ts` for what it builds, ships the hints from the hint table, and keeps the console free of errors. Milestones that add HUD also take iphone-se, iphone-12-pro and 1280 x 800 snapshots.

- [x] M1: Desktop Carry Slice - App shell with `GameLayout`, a 540 x 960 contain canvas, `startLoop`, the `Sim` and the `layout` store with portrait bands and desktop columns; tuning, ledger, hand meter fed per rendered frame, body level, sieve model, drift with arm fatigue, walker; the input layer with grip by pointer id, the anchor and offset, and release classification (blur and `pointercancel` pause; a fresh grip plus a 1s Hold Still countdown resumes); Garden Path with placeholder art from cached tiles, the sieve cam with its dot and the steadiness ring, the distance bar and the HUD `Meter`; each trip starts at 0 m with a full 1 L sieve; trip 1 has no drift; a minimal autopilot; dev hooks `state()`, `snapshot()`, `ledger()`, `toClient()`, `input.set()`, `input.path()`, `drain()`, `setSieve()`, `autopilot()`; the `?debug` overlay with levels, drift, offset, last drain cause, frame time and React commits. Holding the mouse button and W walks to 100 m; steering keeps tilt under 12°; holding W for 5s turns the ring yellow and drips fall; a fast flick, or letting go for over 200 ms, drains everything with a splash, a shake and a caption; a window blur pauses instead; 100 m shows the delivered litres and restarts; ledger, sieve, steadiness, hand, drift, walker, input and sim tests pass.
- [x] M2: Well, Crank and Scoop - Well scene; one crank per fill (5 circles; wrong-way circles unwind; letting go spins it back down; a circle under 0.55s slams and slops a scoop); the bucket stays up for 5 scoops; the scoop drag, fill ring and slow lift that hands the grip and anchor to the Garden Path; scoops-left counter; the fifth scoop starts a refill `TimerChip` that blocks the crank; the minimal chore director with the frog on the crank; Walk Back at 18 m/s with a one-line trip report, returning to the well from wherever the trip ended; the pour is stubbed as an instant delivery. A full well, path, walk back, well loop works with pointer and key events; a jerky lift drains at the well; a held pointer keeps its tilt across the whip-pan; a refill with no open chore opens the frog; well and chores tests pass; the autopilot cranks and scoops.
- [x] M3: House, Pour and Coins - House scene with the bucket on the back step, the 4 m walk-in and the pour with its own rules (re-anchored axis, no dribble, tip or drift; D raises and holds, A lowers), the pour gauge and its green band; fast pours splash and leave a floor patch; 10 coins per litre with `CoinBadge`; the No-Drip badge that cracks on your first counted loss and pays +10; the bucket bar; the bucket completes at 10 L with +50 coins. A careful first trip delivers about 0.75 L and pays 7 coins plus the No-Drip 10; a 55-unit offset pours with no dribble; holding D reaches the green band and stays; a fast pour splashes and pays less; a clean autopilot trip earns No-Drip without wax; after 5 trips `ledger().balanced` is true; pour, economy and containers tests pass.
- [x] M4: Garden Path Hazards - Seeded bumps by container, reshuffled each season, with a mole; red arrows and distance bar icons; bump pulses and drift nudges; the ghost tick on the ring with a rising `tick` and a rim arrow; drains leave a patch 1.5 m ahead; patches shrink and dry after 3 trips outside winter; slips (a carry slip drains; an empty-walk slip costs a pratfall and soaked slippers); patches on the distance bar and the ring; Matter.js tumbles the sieve on a slip; parallax tiles and prop stamps in `CachedLayer`s; debug bump and patch markers. A bump at 6 m/s drains and at 2 m/s stays green; the ghost tick turns red above the safe speed; the walk back from a drain never starts on its patch; path tests pass; the iphone-se preset keeps typical frame time under 16 ms in the debug probe. Note: a hidden preview tab stalls for 200 to 1,100 ms every few seconds even for a bare canvas benchmark with no game code, so judge worst-case frame time in a visible tab or on a real phone.
- [x] M5: Start Screen, Cold Open, Hints, Settings and Pause - `StartScreen` with pitch, story and Tap to Start with `motion`; the app mounts `useLeaveWarning(started)` from the start tap until the ending; the 8s cold open with tap to skip and the tap cough; trip 1 has one bump at 20 m, trip 2 turns drift on with its hint; the hint system and the bucket-phase hints; the Settings modal with `SettingsPanel` and **Recalibrate**; Esc pauses; Shop and Settings hide during a desktop carry and the column shows "Esc: Pause"; the Assist Mode toast after 4 drains in a row. Each hint shows once; Assist Mode lowers the hand reading for the same scripted flick but an 8 m/s bump still drains; reloading after the start shows the leave prompt; opening Settings mid-carry never drains. Built as: the Settings modal doubles as the pause menu (Esc opens it); the first press after a blur in the preview tab resumes rather than skips, by design.
- [x] M6: Phone Controls - Motion mode with touch grace; tilt dribble and tip with a bubble level; tip-forward scooping; tilt-right pouring with `maxDegrees` 25; thumb walking through display-only pads hit-tested per pointer id; the "Hold It Like a Tray" step that refuses poses more than 45° from flat; calibration after each crank and on rotation; the two-thumb fallback without motion; `fakeMotion()`; a dev readout of jolt, peak jolt, tiltX and tiltY; the `SIEVE_HTTPS` dev flag with an openssl certificate. Ask Ekansh to run the real-phone spike (idle hold, thumb press and release, slow walk, tiptoe, scoop tips) and set touch grace and the hand limit from the readings. In the iphone-12-pro preset with fake motion: a 5 m/s² jolt drains, a 20° tilt dribbles, a -30° tiltY dips the sieve; with motion off, two touch pointers grip and walk, and lifting the grip thumb counts as letting go; input tests pass. Still open: Ekansh has not run the real-phone spike yet, so touch grace (150 ms at 50%) and the hand limit keep their starting values. M27 applies the readings.
- [x] M7: Layout Audit - Safe-area insets; every interactive element in its fixed slot from section 2; controls at least 48 px; no page scroll. Snapshots at iphone-12-pro, iphone-se, freeform 375 x 553 and 1280 x 800 show no HUD over the play area and the ring visible for the whole carry.
- [x] M8: Containers, Seasons and Progression - Kitchen and bathroom rooms with their containers and the litre ruler; container-done cutscenes, including the bucket kicked into the shed with Matter.js; container bonuses; path difficulty and the rose bush by container, with its hint; seasons by progress with a season badge; bathtub milestone gags at 25, 50 and 75 L; **Last Trip** and **Last Trip (Really)** after a near miss. `setContainer('bucket', 9.5)` plus one trip switches to the sink with +50 coins and autumn; the same works from sink to bathtub; 15 L in the tub turns winter and 60 L spring. Built as: the bucket cutscene flushes the toilet once, kicks the bucket into the shed and drops autumn leaves; the sink cutscene washes one plate and meets the empty tub; the gags are the duck floating, the cat puffing up on the rim and the interviewer calling to move it to 10. Cutscenes end at the well (containers) or start the walk back from the house (gags). The rose bush tears one hole per trip above 3 m/s; holes leak 0.05 L/s each and draw as torn gaps in the cam. Winter cranks need 6 circles. The milestone share cards wait for M19, and the bathtub's own finish waits for M20 (until then a full tub just says "Bathtub: done.").
- [x] M9: Chores, Mending and the Glue Wait - `ChoresPanel` (`ChoreList` with go-to) in its slots; the full chore director rules; the workbench with threading (a 12-unit eye swaying ±30 units, more with your hand level; a miss resets the thread with a caption), 4 to 6 stitch points per hole (18-unit hit radius; an out-of-order stitch unpicks the last one) and glue; the glue `TimerChip` blocks scooping, and holes block it until sewn. `addHole(2)` blocks the scoop with a clear message; mending both and waiting 3s unblocks it; every wait start leaves at least 70% of its time covered once the planned chores exist; the autopilot threads in 3 to 8s with the average profile; chores tests pass. Built as: a press on the empty, holey sieve at the well (or **Mend the sieve** in the chore list) opens the bench; you drag the thread end into the swaying eye (fast drags shake it further), drag the needle through the numbered dots in order, then tap the glue. **Back** or a press off the bench leaves it; stitches stay. Sewn but unglued holes still block scooping ("Glue the stitches first."). On phones the chore list opens from the **Chores** button in its slot, as a dialog that pauses the game; on desktop the column list is clickable. The bench sieve is radius 180 at (270, 492) with stitch points 46 units round each hole, so the title stays clear and the dots never touch. Plan fix: the 70% rule can only hold once M10 to M15 add their chores. With the chores built by M10 (the frog and the wet house floor), a refill start reaches 93% (32s of walking plus the floor, 24s with its walks), but a glue wait reaches about 57% (the floor plus the frog). The director test checks 70% with every planned chore available, and M24's seeded idle-time check covers the real game.
- [x] M10: Spills, Ice and Path Chores - Cached season layers; the Wipe flow on the path and in the house with `RubGesture` (12 strokes, 20 for ice); winter freezing; spring puddles; autumn wet leaf piles. A drain at 60 m in winter becomes ice on the next trip; crossing it at 2 m/s slips, drains and tears a hole; stopping on it opens the rub area and wiping removes it; walking past keeps the chore open; seasons and path tests pass. Built as: the hills, ground, cam ground and the little well repaint per season (bare snowy trees and snowy posts in winter, orange trees and fallen leaves in autumn, blossom and flowers in spring). On empty walks the context slot shows **Wipe**, **Scrape** or **Sweep** from 6 m ahead to 3 m behind a patch; pressing it steps you onto it, and stopping on it opens the rub area too. Walking away keeps the strokes on the patch, and passing it leaves a chore such as "Wipe the puddle at 50 m" (relabelled when it freezes, closed when it dries). A patch you slipped on or are wiping can't trip you again until you step off it, so getting up never loops pratfalls. This milestone also built the empty walks the house chores need: **Go to House** from the well, a house **visit** (put the sieve down, rub the floor puddle, then **Go to Well** or let go of walk and walk again), and after a splashy pour you stay in the house on a visit. The director's "wet step" now opens at a refill start, so the frog moved to the refill-arrival row as the plan's table says.
- [x] M11: Autumn Leaves - Leaves in the raised well bucket as Matter.js bodies (at most 12), owned by `GameState`, dragged by a pointer constraint behind 30-unit walls; each leaf left in cuts the scoop by 15% and sticks to the mesh; **Clear Leaves**; the falling-leaf carry event. `trigger('leaves')` with 3 leaves caps the scoop at 55%, and clearing them restores a full scoop; leaves survive leaving and returning to the well; an ignored falling leaf drains with cause `leaves`. Built as: leaves float in the well water seen from above in the well cam (in the raised bucket, or down the well while it refills, so the chore also works during a refill), at most 3, in a tiny Matter.js pond with no gravity, a ring of 8 wall slabs 30 units thick and at most 11 bodies. Press a leaf (not the sieve) and drag it past the water's edge to throw it out; dropped inside, it falls back. Each floating leaf cuts every scoop by 15% (`fillCap`); while you dip, the leaves cling to the mesh and the cam shows them on it, so the plan's `leavesStuck` became derived from `well.dipped`. Autumn cranks bring 1 to 3 leaves 60% of the time, the director's autumn 'leaves' chore blows 2 or 3 in on the wind, and **Clear the leaves** sits in the chore list until the last one is out. The falling leaf is the first carry event: `game/events.ts` rolls one event per trip from trip 6 with the season weights (only built events count, capped at 60%, 2-trip cooldown); the leaf swings in big over the sieve cam and in side view for 2.6s (3.1s in Assist Mode), its landing shadow and a pulsing red ring show for the last 1.2s (1.7s), and blowing at it for 150 ms blows it off. Blow is F on desktop and a finger held on the leaf on phones (two-thumb mode needs the grip thumb to stay down). Blowing adds the plan's 0.3 to the body level for as long as you blow, with a wind sound and ripples. A leaf still falling at the house is caught by the roof. An ignored leaf lands, drains with cause `leaves` and sits on the empty mesh while the result shows.
- [x] M12: The Cat: Drinking and the Plug - The cat drinks from a container holding 2 L or more and pulls the bathtub plug; lapping and gurgle sounds; warnings at the well; **Shoo the Cat** knocks bathroom items down with Matter.js; **Check the Plug** drags it back; losses go to the container ledger. Each trigger drains the expected litres over 60s of `loop.step` and stops once fixed; containers tests pass. Built as: the cat perches on the container's rim (bucket, sink or tub), leans in and laps with a pink tongue; it starts on 20% of trips once the container holds 2 L (or the plug on 15% of bathtub trips, at most one of them per trip), and the director opens it at a refill start, on house arrivals and at glue starts. Losses run every step on simulation time through whole-mL channels with remainders, and a full container is locked. A pour ends in a house visit while the cat drinks, the plug is out or the floor is wet. On a visit, tap the cat: it puffs up, leaps off and sends 3 things flying from the rim (a cosmetic Matter.js world). The pulled plug rests on the tub's rim with a pulsing ring, and a dashed target pulses over the open plughole, where the water swirls down; drag it in to fix it, or it swings back. From the well you hear about it: a toast ("Lapping sounds from the house." or "Gurgle… was that the tub?"), a red **Cat drinking!** or **Tub draining!** sticker by the container bar (the status line on phones), the first-time hint and **Go to House**. Only walk leaves a visit now, so a thumb that misses the cat never walks you out.
- [x] M13: Events: Fly and Sneeze - The event director with season weights; failed counters drain directly with their cause; the fly with buzzing, a landing shadow and Blow (it gives up after 2 blows or at the back door, and each return comes faster); the flies-blown-away stat; the sneeze with "Ah…", "Ah…!", the freeze check and fake-outs; autopilot counters. `trigger('fly')` drains when ignored and gives up after 2 blows; `trigger('sneeze')` drains while walking and passes when frozen; in Assist Mode and at Sensitivity 0.5 a failed sneeze still drains; events tests pass. Built as: `game/events.ts` keeps each event's rules in a pure `stepEvent` that reports what happened, and the sim turns that into drains and pulses (`AVAILABLE_EVENTS` at the bottom of `sim.ts` lists the built ones: leaf, fly, sneeze). The fly circles the sieve cam for 3s with a dotted trail, "bzz" and a buzz every 300 ms, then dives at a spot whose shadow and pulsing red ring show for the last 1.2s (1.7s in Assist Mode); in side view it loops round your head. Blowing at it for 150 ms drives it off; after 0.9s it comes back red-eyed, spinning faster, circles for 1.5s and dives again, and a second blow makes it give up ("Fine. Keep your water.", counted in `stats.fliesBlown`). A fly still out at the back door stays outside. The sneeze shows "Ah…" then "Ah…!" in a speech bubble beside your head and comes 1.8s to 2.6s in: under 0.3 m/s with a total under 0.3 you hold it in ("…choo.", a 0.1 pulse), otherwise it drains with a 1.4 pulse; one in ten never comes ("Ah… ah… never mind."). A sneeze follows you into the walk-in and fizzles out when the pour starts, because the pour has its own rules until M17. The autopilot blows once a shadow shows and freezes for a sneeze. Each event's hint shows at its first warning.
- [x] M14: Events: Dog, Phone Call and Rain - The dog with bark and head peek, also on the ring; calls with the caller's line while ringing, the phone glow in your pocket, Answer (E) and Decline (F) in the context slot and the desktop column, escalation after a decline, rewards for answering and buzz pulses when ignored; the rain gag, guaranteed on the first spring arrival and escalating across visits. The dog drains you while walking and passes when stopped; an ignored call pulses the ring; a declined Mum calls back next trip; container litres return to their pre-rain value after rain. Built as: the dog barks and its head peeks in from behind at the left edge ("Woof!") and on the ring's left side for 1.5s (1.7s in Assist Mode); under 0.5 m/s it dashes between your legs ("Good dog.", a 0.3 pulse), otherwise you go over legs-up, the sieve flies, it drains with cause `dog` and the dog stops ahead and looks back while the result shows. Calls ring from trip 12 with callers in turn (interviewer, Mum, scam, water company; `game/calls.ts`): a speech bubble shows "Mum: Are you drinking enough water?" while your pocket glows and the ringtone repeats. E or **Answer** stops you for 5s with the phone wedged at your ear; F or **Decline** costs a 0.15 pulse; ignored, it buzzes a 0.35 pulse every 0.8s from 1.2s until it rings out at 6s. Mum pays 20 coins when answered and calls back next trip when declined; the scam rings twice in a row; the water company says "Soon."; the interviewer asks a question and the two answers become the buttons (E or F), and your answer is kept in `calls.answer` for the ending. On phones Answer and Decline take both the Chores and context slots while it rings. F declines rather than blows during a call. A sneeze or a call follows you into the walk-in and goes to "never mind" or voicemail once the pour starts; the dog stays outside. Spring rain (`game/rain.ts`) comes through the bathroom skylight on the first spring house arrival, then on 30% of arrivals: 0.3 L/s into `rainMl` for 10s, then out at 0.4 L/s, shown as a pale band in the tub and on the container bar, with the rain loop and "It was never yours." It escalates: plain rain, an umbrella over the tub that keeps it bone dry, "Catch some with the sieve!" (it goes through the sieve, obviously), then a rainbow. The autopilot stops for the dog and answers calls (and picks E).
- [x] M15: Shop: Wax, Slippers, Fly Swatter and Joke Buys - `ShopModal` from `ShopPanel`, open only with an empty sieve; Wax Coating with the Rewax chore every 10 trips; Slippers with footstep sounds, soaking and 1 min drying on the line; Fly Swatter on R with the swing pulse and the **Swat** button; Wish at the Well, Cat Treats and the Party Hat. Each effect shows in `state()` and on screen; chores appear on schedule; economy tests cover all six items. Built as: the shop dialog lists the three upgrades through the shared `ShopPanel` (its new `compact` rows fit the dialog) and a Joke Buys panel; it opens from **Shop** beside Settings on desktop and from the coin badge on phones, which wears a **Shop** sticker while the shop can open. Upgrades live in `game/kit.ts` (`state.kit`). Wax glints on the cam sieve, fading as its 10 trips run down; it wears off as the tenth trip ends and opens **Rewax the sieve**, which the director also opens during waits once 3 trips or fewer are left. Tap the wax tin by the hook post (or the chore) to open the bench in wax mode and rub 20 strokes; gluing with Rewax open turns the bench straight to the wax. Slippers are yellow bunny slippers on the hero, gait x 0.7, half-volume footsteps and slip speeds 2.5 and 1.8 m/s; a drain on the path or in the house, a splashy pour or an empty-walk pratfall soaks them (grey, droopy, squelching footsteps, slips at 1.0 and 0.7 m/s) and opens **Dry your slippers**; tap the washing line at the well to peg them up for 1 min (a Slippers timer), barefoot meanwhile, and they come back on by themselves. The swatter rides in your back pocket; R or **Swat** (in the context slot while a fly or leaf is out; desktop shows "R: Swat" since clicking lets go) slaps it across the cam and over your head in side view with a 0.55 pulse for 150 ms. A swing that reaches a fly or leaf (not one zooming off after a blow) kills it ("Splat.", the fly slides off squashed, counted in `stats.fliesSwatted`); a swing at nothing says "Swatting air."; swinging while rushing can break the sieve with the new cause `swat`. A Wish at the Well (10, well only) gives a toast line, and one in 6 puts the frog back on the crank. Cat Treats (40, stacking 5 trips a bag) stop a drinking cat at once and skip the cat and plug rolls while they last; the cat crunches at a bowl by the door instead. The Party Hat (150, once) sits on the hero in every scene. Code moved out of the sim into `game/carry.ts` (carry events, calls, the swatter) and `game/trouble.ts` (cat, plug, rain).
- [x] M16: Shop: Finer Mesh, Bigger Sieve and Paved Path - Finer Mesh (+0.5 L, slow fill, finer hatch); Bigger Sieve (x 2 capacity, x 1.25 total, bigger art, straining pose); Paved Path with the Lay Stone prompt (one per walk back, the first unpaved segment you pass; a stone halves its segment's bumps). Capacity reads 1.5 L, then 3.0 L with both; a laid stone halves its segment's bump on the next carry; skipping the prompt costs nothing. Built as: the three join the shop list (Finer Mesh 150, Paved Path 200, Bigger Sieve 300). Finer Mesh cross-hatches the mesh at gap 4 in the cam (its own cached layer), tighter on the side views and the bench, and the dip fills with tau 1.0s (95% in 3s). The Bigger Sieve draws 1.4x in the cam and the side view (1.25x at the well, so it still dips into the bucket), weighs the total by 1.25 (`sieveWeight`, also in the ghost tick), and you strain: arms sag, they shake from the start and a sweat bead runs down your temple. Paved Path gives 20 stones (`state.kit.stonesLeft`, `state.path.stones` per 5 m segment, `game/stones.ts`). Every empty walk (back from the house, or either way between the well and the house) offers one stone, for the first unpaved segment it reaches: **Lay Stone** shows in the context slot from 3 m before that segment until you pass it, and the chance is gone once you do. Pressing it, or stopping by it after a step, stands you 3.5 m short of the segment's middle with a stone by your feet and a dashed "Drop it here" gap in the path; drag the stone in ("Laid. 19 to go."). Walking off puts the stone back, at no cost. Paved segments draw flagstones and a grey band on the distance bar, their bumps shrink to 60% in the art, a bump there pulses at half strength, and footsteps on them jolt 0.8x. (Changed in the audit pass: a laid stone flattens its segment's bumps for good, with "Bump buried. 12 to go.", so the path really has fewer bumps.)
- [x] M17: Bathroom Threats - The walk-in and pour event slot on 15% of bathtub trips (the fly through the door, the cat round your ankles, a bath-dust sneeze), guaranteed once on Last Trip, with the usual 1.2s warning; bold floor patches on the walk-in. Each threat drains when ignored and passes when countered at the tub; Last Trip always gets one. Built as: at the back door, a bathtub trip that had no carry event rolls the bathroom slot (`rollBathroomThreat`, 15%, always on Last Trip, which rolls no carry event and keeps Mum's callback for later). The fly comes through the door 0.3 to 2 m into the walk-in, circles for 1.5s and dives with the usual 1.2s shadow, often mid-pour; blow (F or a finger) or swat it while you pour, and blowing adds its 0.3 jolt to the pour. The cat (new event `catAnkles`, never while it's drinking or busy with treats) waits at the door, trots in for 1.2s ("Mrrp?", and on the ring's left like the dog), then weaves round your ankles for 2s: walk at all and you go over it (cause `cat`), stand still and it rubs your shins (0.25 pulses every 0.6s), then gets bored. Bath dust brings a sneeze that usually comes mid-pour, where only still hands hold it in. Sneezes and calls that follow you in from the path now carry on through the pour too, instead of fizzling out. Anything still going when the pour empties the sieve misses ("Too late, fly. All poured."), and a drain mid-pour still pays for what reached the tub. Each threat starts with its own caption ("A fly. Through the door.") and the first one adds the hint "It followed you in. Hold still." The house floor puddle now lies on the walk-in, 3 m in and 0.9 m either side, drawn bold with a yellow wet-floor sign: crossing it with water faster than you'd slip on a wet path (1.5 m/s, 2.5 in dry slippers) slips you and drains with `wetFloor`, and carrying past 85 m with the floor wet calls out "Wet floor ahead. Tiptoe." The autopilot freezes for the cat, blows and freezes mid-pour, and tiptoes over a wet floor. Dev: `trigger('bathroom')`, `trigger('catAnkles')`, `bathroom(id)` and the **Bathroom Threat** panel action.
- [x] M18: Slow-Mo Replays - `ReplayRecorder` at 180 x 320, 20 fps, 3s, cropped to the cached design rect and fed the render `timeMs`; a clip on every drain; automatic replays on the first path drain at 10 m or more, and on drains at 85 m or more or in the house with at least half a sieve, at most once per 3 trips; `ReplayModal` with labels such as "1 step from the tub" or "8 m from the house", plus **Watch Again**, **Share** and **Skip**. `drain()` at 95 m after `loop.step(180)` opens the replay with frames, the ring and the right label. Built as: `scenes/film.ts` (`FailFilm`, owned by the renderer) records every rendered frame except while paused or after the ending, and cuts the clip 700 ms after a drain so it ends on the splash and the caption. The sim decides whether a replay is due (`game/replays.ts`, `claimReplay`, logged in `state.replays`) and puts it on the drain record, with the walk-in metres, mid-pour, container and capacity. "At least half a sieve" applies to both the 85 m rule and the house; the first path drain at 10 m or more needs no minimum. Labels (`drainSpot`): "1 step from the tub" counts 0.8 m steps left on the 4 m walk-in, "Mid-pour, over the sink", "5 m from the house" from 50 m on, "12 m from the well" before. The dialog plays at 0.4x (7.5s) with the label in red above the clip, not on it, because you fall over at the bottom of the frame; the drain caption and "Trip 7. 0.8 L gone." sit underneath. A replay never opens over another dialog, and it pauses like Settings. Dev autopilot runs stall on an automatic replay until `closeDialog()`.
- [x] M19: Share Cards - **Share This Fail** in the context slot during the walk back after any drain; the fail card titled like "Trip 41: lost 3 L to a fly" with the drain's still and Trip, Distance, Litres Lost and Total Lost; milestone and near-miss cards ("Trip 107: 0.2 L short."); the `ShareModal` flow. Card previews show the right title for 3 causes; share tests pass. Built as: the sim keeps one `state.share` per walk back (a drain on the path or in the house, a Last Trip that poured and fell short, or a bathtub milestone), cleared when the next trip starts or you reach the well. The context slot shows **Share This Fail** (**Share This** for a milestone) on the walk back after Wipe and Lay Stone, so it takes the slot once you step off your own puddle; it also follows a house visit's Go to Well. The replay's **Share** opens the same fail card. `game/share.ts` builds the words: a phrase per cause ("to a fly", "by letting go", "to my own swatter"), Distance in metres with "1 step from the tub." as the footer, Total Lost counting the cat and the plug too. The near miss shows "So close. 0.3 L short." with the sad trombone and snaps the house from the caption down (`HOUSE_BAND`); milestone gags snap the room on a `snap` cue (`ROOM_BAND`). The dialog reads "Share Your Shame" for fails and near misses, "Share This" for milestones. Fixed in shared: `ShareModal` showed the previous, revoked picture for a frame when it reopened.
- [x] M20: Ending - At 100 L in the bathtub: the cutscene (shower cap, step in, taps burst on, the sink overflows, the water company calls, then the interviewer: "About your interview. That was last year."), then `EndingScreen` with time, trips, litres scooped, litres lost, the top cause, flies blown away, coins left over and your interview answer; the ending card with Time, Trips, Litres Lost and Top Cause over the bathtub still; Share and Play Again. `setContainer('tub', 99)` plus one trip reaches the ending; Play Again reloads with no leave prompt. Built as: the 12.6s `ending` cutscene (`scenes/ending.ts`): "100 L. Full.", a pink shower cap, a hop over the rim and a splash, "Ahh." with steam (snapped for the card); the kitchen tap bursts on ("FWOOSH") and the sink spills over the counter; back in the overflowing tub, the water company says "You're back on.", then the interviewer: "About your interview." and "That was last year." with the sad trombone; a close-up stare at the camera, chest-deep in your interview shirt, as one drop runs down. The pour loop roars from the taps to the stare. The party hat sits on top of the shower cap. A tap skips to the last frame, and the card then gets the stare instead of the bath. Then the sim stops for good (`state.ended`, the clock stops) and **You Filled the Bathtub** shows over the frozen frame with 8 rows (`game/ending.ts`): the top cause counts the cat once for drinking and tripping, and the plug on its own. Plan fix: with the starting 1 L sieve one careful trip delivers 0.7 to 0.9 L, so `setContainer('tub', 99)` plus one trip only reaches the ending with Finer Mesh or bigger; the unit test starts from 99.5 L. Verified in the browser from 99 L with Finer Mesh.
- [x] M21: Sound and Juice - The full sound map from section 7, `pour` and `rain` loops that follow flow, shake and vibration on drains, squash and stretch, face reactions and the caption bank with at least 6 lines per cause and stat-quoting lines; Reduced Motion stops shake and line boil. One full trip of each type plays every mapped sound once with no stacking; turning Reduced Motion on stops the shake. Built as: most of the sound map already shipped with earlier milestones; this round added the crank's creak at each quarter turn, drips that speed up and get louder as a tilt dribbles toward tipping, the rain loop swelling in and easing off with the clouds, footsteps at the plan's 0.15 (0.075 in dry slippers), and a short buzz on every drain (the big ones keep their pattern). The cam sieve squashes wide and flat, then tall, on bumps, swings, catches, event jolts and drains (`SieveCam.squash`, 10% at full strength). A No-Drip Trip keeps a smug grin on you for the walk back (`HeroFace` replaced the scenes' despair flag). The hero's strokes boil 5 times a second, and the time-seeded captions in events, the house, the cold open and the ending go through `boilSeed`; Reduced Motion freezes both, skips the whip-pan, the squash and new shakes, and stops a shake already running. `game/captions.ts` has 6 lines per cause, rotating so each gets its turn and none repeats back to back; every third drain of a cause counts ("Third fly today.", "Sixth time the dog got you.") or, from 2 L lost, adds up ("That's 12 L to the dog."); a drain in the first 10 m says "8 m. Eight." every other time. Verified by logging every sound over a full autopilot trip (each mapped sound per moment, at most 4 drips a second, one pour loop), a drained trip (pop, splash, sad trombone), the quarter-turn creaks, and the hero's pixels changing between frames until Reduced Motion turns on. Not done: the shared coin badge's "+N" float is the coins' only pop, since stretching it needs a shared change.
- [x] M22: Walk for Real - An optional phone mode, offered on the start screen and suggested on Last Trip: each step the motion sensor detects moves you forward, scaled so a trip takes about 50 real steps. Gentle steps (1 to 2 m/s²) stay green; stomps (3 to 5 m/s²) drain. With fake motion, 50 gentle step peaks walk 100 m and a stomp drains; thumb walking stays the default. Built as (section 3, Walk for Real): steps counted from the smoothed jolt with a start and end threshold; 2 m owed per step at the rhythm's speed, so 49 steps stay on the path and the 50th reaches the house (2 more walk to the tub); the game gait gives way to a pulse per step, and a new loss cause `stomp` ("Stomp. Splosh.", "to a stomp", "Stomping") drains with a heavy `stomp` thud. In the iphone-12-pro preset with fake motion, ten 1.8 m/s² steps peaked at 0.22 total, a 4 m/s² step drained with cause `stomp`, real steps ran the walk back, a thumb on the walk pad walked nobody, and the Last Trip button turned the mode on. The thresholds and the hand scale wait for Ekansh's real-phone readings in M27.
- [x] M23: Performance Sweep - Every repeated prop in a stamp layer; the 160-particle pool; no allocations in update or draw hot paths; at most 20 Matter bodies; React commits at most 10 per second. In the iphone-se preset, 600 dev steps show no garbage-collection spikes in the `?debug` probe. Built as: wet leaf piles became 3 cached stamp variants (every other repeated prop was already a layer); per-frame text and line styles, dash arrays, the crank count, the caller line, the trip report split and the ghost tick's options are hoisted or cached; `hint()` reuses its context and loops instead of closures (it runs every frame on phones); `patchById`, the pond's leaf lookup and the bench's current hole loop instead of `find`. Measured: 18 Matter bodies at most across the three small worlds (pond 11, tumbles 3, knocks 4), each stepped only while busy; HUD commits peaked at 7 in any second of simulation time over a whole trip; in the iphone-se preset 600 dev steps rendered at 0.22 ms average, 0.8 ms at the 99th percentile and 3.4 ms worst, with no spike frames. What's left per frame is V8 boxing the decimal numbers passed to canvas path calls (about 15 KB a frame, mostly the live hero), which minor collections clear in well under a millisecond; caching the hero's torso per boil frame would cut it further if a real phone struggles.
- [x] M24: Autopilot Skill Profiles and Dev Tools - Seeded skill profiles (hand jitter, reaction delay, top carry speed) for "average" and "unskilled"; the autopilot handles each event, pours safely and does chores; every dev panel action and the full `__game.sieve` API work. The autopilot finishes 10 trips with `ledger().balanced` true; a full seeded game shows no wait starting without an open chore and under 10s of idle time per wait. Built as: `SKILL_PROFILES` in `tuning.ts` (top speed, steady hand acceleration, seeded wobble, twitches per minute, steering lag behind the drift, reaction time drawn from half to 1.5 times its typical value per warning, and chore pace against the director's estimates) and `skilledPilot(name, seed)`. A skilled pilot brakes for each patch under its slip speed (the older pilot's 1.2 m/s slipped on ice), shops in the pacing model's order (Wax, Finer Mesh, Slippers, Bigger Sieve), walks to the house whenever the cat drinks or the plug is out, walks to house and path chores while a wait blocks the well, wipes listed patches and ice on empty walks during waits, takes each chore as long as its estimate, and reports `idle` when a wait leaves it nothing to do. Without a profile the pilot plays as before, so older tests keep their numbers. The dev API gained `goto` (`Sim.jumpTo`) and `autopilot(on, { profile })`; the panel gained Go to Well, Go to Path, Go to House and Go to Walk Back, and its Autopilot is the average player. In the browser every panel action and every API call ran with no console errors and a balanced ledger. Plan fix: the director now covers 85% of a wait (was 70%) and a refill arrival can add the wet floor, the cat or the plug, because a trip that drained early came back to 35s of staring at the well; with the change, eight seeded average games idled 3s at most per wait. Measured on the way, for M25: average players finished in 123 to 179 simulated minutes (eight seeds, 104 to 137 trips, 10% to 29% drained), and the cat and the plug cost them 30 to 70 L over a game against the pacing model's 6 L; unskilled players never finished inside 3 hours, because the plug (3 L a minute) and the cat drained the tub about as fast as they filled it.
- [x] M25: Final Balance Pass - The measured pacing test from section 5, including an Assist Mode run; play the bucket and one bathtub segment by hand at 1280 x 800 and in a phone preset; tune `tuning.ts` so the average estimate is 90 to 105 minutes and the unskilled one above 120; write the final numbers back into this plan. Plan fix: the real-phone tuning moved to a later milestone (now M27). It needs Ekansh holding a phone, and nothing else here waits for it. Built as: `game/pacing.ts` plays whole seeded games (`playGame`) instead of extrapolating phase samples, and section 5 now holds the measured numbers and every change with its reason. The cat and the plug cost an average player 30 to 70 L, so they now drink and drain slower and come far less often. The director's refill chore is usually a wet floor, the run back counts at a house arrival, and drying slippers no longer bring the frog. A cap of 6 patches stops the winter ice rink, the Bigger Sieve weighs 1.15, autumn drops 1 leaf pile, base drip is 0.8% a second and the carry speeds up at 2.2 m/s². The skilled pilots take bumps as fast as the ghost tick allows and brake for patches on empty walks; the average one twitches 1.5 times a minute at up to 5 m/s. Measured: an average player takes about 100 min (90 to 117 over 16 seeds) and an unskilled one 167 min (147 to 183). In Assist Mode they take 72 and 81 min. In the browser at 1280 x 800, a bucket trip by hand delivered 0.79 L of 0.99 L for 18 coins, and a jerky steer drained at 42 m with its replay. The average autopilot then finished the bucket on trip 17, and a bathtub trip by hand with every upgrade delivered 2.6 L. In the iphone-12-pro preset two touch thumbs carried 2.2 L into the tub. Without `?fast`, a refill opened the wet floor, and hanging slippers brought no frog. Fixed on the way: the pour that filled a container showed the next, empty room under its result. The house now stays on the full container until its cutscene.
- [x] M26: Spike Recorder - Plan fix: M27 needs Ekansh's readings, and a live readout can't record a 50-step walk with the phone held flat. So the spike became a dev page. `?spike` runs 8 takes, each with a 3s countdown and beeps: Still Hold (8s), Thumb Presses (8, on a pad where the thumbs rest), Scoop Tips (5 dips past 25°), Sharp Knocks (5 in 10s), Slow Walk (20 steps), Tiptoe (20), Walk for Real (50) and Stomps (5 among normal steps). Each take keeps the smoothed jolt and tilt of every sensor reading, and the touch times. Results replay the takes through the game's own hand meter, step detector and body level. They suggest the 9 phone numbers this way:
  - `MOTION_REF`: halfway on a log scale between the least that keeps a still hold under 0.1 and careful scoops under 0.5, and the most that lets 4 of 5 knocks reach 1.
  - Touch grace: the window and scale that hide the least shake while presses stay under 0.15. Off when presses already do.
  - Step thresholds: the ones that count every walking take's steps, catch each footfall's peak and count none while standing. It takes the middle of the widest good run, with the end ratio nearest half.
  - `REAL_STRIDE_M`: 100 m over the steps counted for 50 taken. `REAL_HAND_SCALE`: the walk's 90th-percentile shake reads 0.3.
  - `GENTLE_STEP_JOLT`: the 90th percentile of careful step peaks. `STOMP_SCALE`: 4 of 5 stomps pulse 1.

  A Checks panel reads each M27 target with today's and the suggested numbers, plus whether the tray step can calibrate. **Copy Readings** copies the suggestions, checks and per-take numbers as text. **Play With These** opens `/?debug&tune=…`. In dev, `?tune=NAME:value,…` overrides those 9 constants (`game/tune.ts`), and `?debug` lists the overrides. Verified in headless Chromium at 375 x 667, 390 x 844 and 1280 x 800 with synthetic sensor events: all 8 takes recorded, the results counted 20, 20 and 50 of 50 steps, and every check passed with the suggestions. Play With These ran the game on a `MOTION_REF` of 1.2, where a 1.4 m/s² jolt drained a carry. The production bundle has no recorder and no `?tune` parsing. Fixed on the way: during the result of the pour that filled the bucket or the sink, the status bar showed the next, empty container. It now stays on the full one, by the same rule as the house (`shownContainer`).
- [x] M27: Lead Decisions Built - Build every item in Lead Decisions at the end of this file and re-run the pacing test over 16 seeds. Done when Assist Mode lands where the decision says, pacing still averages 60 to 120 min without Assist, and section 5 records the new numbers. Plan fix: this replaced the real-phone tuning milestone, which moved to Owner Follow-Ups. Built as: Assist Mode reads the hand at 0.78x instead of 0.6x (`HAND_ASSIST_SCALE`, passed to the shared `JoltMeter` through its new `assistScale` option) and no longer stretches event warnings, so `createEvent`, `createBathroomEvent`, `rollCarryEvent` and `rollBathroomThreat` lost their `assist` argument and six `*_ASSIST_MS` numbers went. `playGame` now records what drained each trip. Measured over 16 seeds: an unskilled player with Assist fails 27% of trips (average player without it: 29%) and takes 109 min; an average player with Assist fails 14% and takes 79 min. Without Assist nothing changed: 100 min for the average player and 167 min for the unskilled one. The pacing test asserts both Assist targets. The round 8 balance changes stay as built, and the nine real-phone numbers ship as they are (Lead Decisions). In the preview tab at 1280 x 800, Assist Mode was switched on in Settings: a 6,600 units/s² flick read 0.86 and kept the water, a 9,000 one drained it with "Gone. All of it.", and the fly, dog, leaf and call warned for 4.2s, 1.5s, 2.6s and 1.2s as without Assist. The unskilled autopilot then failed 3 of 10 trips. In the iphone-12-pro preset, with a touch grip, the same flick read 0.86, and the Settings dialog showed Assist Mode on without scrolling. Fixed on the way: Settings told phone players without a tilt sensor that "the mouse and keys" hold the sieve; it now says thumbs or the mouse.

## 12. Critique Decisions

The critics raised 50 issues. Accepted as suggested:

- Chore director rules per wait, a frog chore at the well, and the seeded "no empty wait" check.
- Sensitivity and Assist scale only hands; the body level lives in game code; failed counters drain directly; the cause comes from the largest pulse.
- The app mounts the leave warning itself.
- Seeded skill profiles feed measured rates into the pacing test, and the test's claim now matches what it guards.
- No-Drip counts only losses you cause, with a cracking badge.
- Defined path chore flows, threading numbers, the hint table, extra sound rows, and named share card stats with a clip on every drain.
- The falling-leaf event, the guaranteed and escalating rain gag, debug overlays from M1.
- Base drip (0.8% per second since M25) plus arm fatigue, so crawling costs water.
- The steadiness ring with a ghost tick, in the game world, so replays show the cause.
- Fairer slips: patches land ahead, dry after 3 trips, and empty-walk slips cost no hole. A carry slip tears a hole only on ice.
- One crank per fill with fail states, a 7s walk back and a trip report.
- Bathroom threats, including one on Last Trip.
- Trip 1 without drift and with a bump at 20 m; a loud tilt-loss wedge.
- More captions, stat-quoting lines, per-season bumps with a mole, bathtub milestones.
- Caller lines while ringing, escalation and answer rewards; the fly gives up after 2 blows; Swat on R.
- Pour rules with a re-anchored axis, no dribble or tip, and D that raises and holds.
- Walk for Real as an optional mode; seasons by progress; joke buys; the near-miss and interviewer gags.
- Release classification, per-pointer pads and grip ids, the grip anchor carried across scenes, per-frame hand acceleration, the path tile approach and perf probes in M1, input tools split between events and `input.set`, a minimal autopilot and `sim.test` from M1, the `InputFrame` type and state boundary, the layout store in M1, a flat snapshot, and GameState-owned leaves.

Accepted with changes:

- **Real-phone spike:** it runs in M6, where the motion code lands, not right after M1. Bumps and events now feed the body level in game units, so phone numbers only affect the hand reading. The spike needs someone holding a phone, so Ekansh runs it, with the spike recorder from M26.
- **Pacing sample size:** at least 100 trips per phase and profile instead of 200, so the test stays under 20s.
- **Settings during a carry:** the desktop Settings button hides and Esc stays; phones keep the Menu button, because their grip is the phone itself.

Rejected:

- **No-Drip at 90% delivered:** the "zero losses you cause" rule is clearer and works with any base drip rate.
- **Interview practice and coin tosses as well chores:** the frog covers the well, and the wish became a joke buy.
- **Slippery wet stones and frost-lifted stones:** one rule per stone (it flattens its bumps) keeps paving readable.

## 13. Code Map

Builders keep this section current. List each file once, with one line on what it owns.

- `src/main.tsx`: imports fonts and CSS, renders `<App />`, or the spike recorder under `?spike` in dev builds.
- `src/index.css`: the shared Tailwind entry plus `@source '.'`.
- `src/App.tsx`: the React shell; stages title, "Hold It Like a Tray" and playing; routes presses to the well, house and wipe gestures and points the input's blow target at the sim; mounts the leave warning from the start tap; creates input, renderer, layout tracking (pointing the input's walk pad at the bottom band slot or the column pad, `walkPadRect`) and the loop (which steps phone calibration and asks for a refine after each crank); hands the film's clips and stills to the shell; mounts the replay, share and ending dialogs; loads `dev.ts` in dev builds; counts React commits for `?debug`; says where Settings shows Walk for Real (`realWalkSetting`).
- `src/shell.ts`: the `Game` object (sim, HUD store, UI store with the open dialog, the replay shown, the share card and the sideways cover, motion and `PhoneTilt`, dev pilot, `shots`: the latest drain on film and the latest moment still), `openSettings`, `openChores`, `openShop`, `goToChore` (mend and rewax open the bench, slippers go on the line), `noteFail` (keeps a drain's clip, opens the automatic replay when due), `openReplay`, `shareReplay`, `pressContext` (Share opens a dialog, the rest are sim actions), `openShare` (the fail, near-miss or milestone card with its picture), `closeModal`, `covered`, and the dev flags `?skip` and `?tray` (any device counts as a phone).
- `src/dev.ts`: `window.__game.sieve` (state, snapshot, ledger, toClient, setSieve, setTrip, setContainer, season, addHole, addPatch, cutscene, context, doContext, rub, trigger, call, removeLeaf, blowTarget, shooCat, fixPlug, buy, buyJoke, canShop, soakSlippers, hangSlippers, wearWax, rubWax, swat, layStone, addCoins, coins, drain, finishWaits, input.set/clear/path, fakeMotion, mode, autopilot with options, restart, perf, replay, openReplay, share, dialog, closeDialog, showEnding, realWalk, fakeSteps, internals, goto, autopilot with a profile; doContext presses Share too) and dev panel actions (including Go to Well, Go to Path, Go to House, Go to Walk Back, Container to 90%, Next Container, Next Season, Add Hole, Buy All Upgrades, Soak Slippers, Wear Off Wax, Trigger Fly, Trigger Leaf, Trigger Sneeze, Trigger Dog, Trigger Call, Trigger Rain, Drop Leaves, Cat Drinks, Cat Pulls Plug, Walk for Real On/Off, Show Replay, Show Ending). Dev builds only.
- `dev-https.js` and `dev-https.d.ts`: `SIEVE_HTTPS=1` serves the dev server over HTTPS with a self-signed openssl certificate in `.certs/` (gitignored), so phones on the LAN send motion.
- `src/game/tuning.ts`: every tuning number, with a comment each, including Walk for Real, the Assist Mode scales and the autopilot's `SKILL_PROFILES`; the 9 phone numbers take dev `?tune` overrides.
- `src/game/tune.ts`: the 9 phone numbers M27 sets from a real phone (`PHONE_NUMBERS`), `parseTune` and `tuneValue` for `?tune=`, and the dev overrides `tuning.ts` reads (`TUNED`).
- `src/game/spike.ts`: the spike recorder's maths (dev only): the 8 takes (`SPIKE_STAGES`), scoop tip counting, replaying takes through the hand meter, step detector and body level (`measure`), the suggested numbers (`suggest`), the M27 checks (`checks`) and the readings text.
- `src/game/types.ts`: scene (including `cutscene`), phase, cutscene ids (including the `ending`), season, loss cause (including `swat` and `stomp`), input mode and `InputFrame` types; `emptyInput()`.
- `src/game/ledger.ts`: the whole-mL water ledger with per-channel remainders; `isBalanced`.
- `src/game/sieve.ts`: capacity, the Bigger Sieve's weight (`sieveWeight`), base drip, slosh, tilt dribble and tip rules; steadiness zones.
- `src/game/steadiness.ts`: gait, bump amplitude, the predicted bump level for the ghost tick (with the slippers' gait scale), the body level with its pulse pool, and the total.
- `src/game/hand.ts`: `HandMotion`, frame-rate independent hand acceleration from pointer events.
- `src/game/drift.ts`: seeded drift with arm fatigue.
- `src/game/walker.ts`: speed ramp, distance and footsteps for each walk mode.
- `src/game/steps.ts`: Walk for Real: `RealWalk` state, `detectStep` (a step per jolt peak, with its peak), strides owed at the rhythm's speed (`stepRealWalker`, dropped after you stop), `resetRealWalk` per walk and `stepPulse` (gentle steps small, a 3 m/s² stomp breaks); both take other thresholds for the spike recorder.
- `src/game/sim.ts`: `Sim`, the one mutable `GameState`, with its public `random`, `now`, chore board, wallet and `shop`; Walk for Real (`setWalkForReal`, listening for steps in motion mode, real steps walking the carry and running empty walks and visits, each step's pulse with cause `stomp`, the Last Trip offer in the context slot) and the input mode of the latest step; leaves in the well water (`fillCap`, `dropLeaves`, `removeLeaf`, `placeLeaf`, autumn crank leaves); thin wrappers over `carry.ts` (`triggerEvent`, calls, `blowTarget`, `swat`) and `trouble.ts` (`shooCat`, `dragPlug`, `dropPlug`, `triggerCat`, `triggerPlug`, `triggerRain`, `houseNeedsYou`); the shop and kit (`canShop`, `buy`, `bought`, `buyJoke`, `jokeBlocker`, `hangSlippers`, `rubWax`), the swing countdown, wax used per trip and worn off as a trip ends, slippers soaking on drains, splashy pours and pratfalls, the gait scale and slip speeds from your feet; `hint(mode)` for the hint line (it reuses one context object, since the renderer asks every frame); `AVAILABLE_CHORES` and `AVAILABLE_EVENTS` at the bottom; cutscenes (`startCutscene`, skip with a 400 ms guard, `endCutscene` to the well or the walk back); containers filling in turn with their bonuses and cutscenes, seasons by progress (never backwards), bathtub milestone gags, Last Trip and Last Trip (Really); the rose bush tearing holes and hole leaks, and a sieve that leaks dry ending the trip; grip, pause, resume (`atStake`) and re-grab rules; another input set taking over pauses with water at stake (`switchInput`, `inputSwitched`) and otherwise drops the grip for the new input to take; motion mode (always held, tip-forward dipping with a slow auto-lift, tilt as the sieve offset, tilt-right pouring, no game drift); the well (scoop, refill, frog), the workbench in mend or wax mode (`openBench(mode)`, `threadNeedle`, `stitch`, `applyGlue`, `scoopBlocker`) and the glue and slippers waits, the chore director at wait starts and arrivals (Rewax once due, nothing from a busy cat, the cat on `DIRECTOR_CAT_SHARE` of refills, nothing for drying slippers), empty walks (`goToHouse`, `goToWell`), house visits, wiping (`rub`, `wipeHand`) and the context slot (`contextAction`, `doContext`), winter ice that tears holes, the carry, the house walk-in (with the bathroom slot, the floor puddle you can slip on and the warning at 85 m) and the pour (events carry on through it; a drain mid-pour still pays), coins and the No-Drip badge, drains, the drain streak that suggests Assist Mode once, every drain's record (where, how much, whether a replay is due) and the walk back's share moment (a drain, a near miss, a milestone), the walk back; the ending (`finishGame` stops the sim and the clock), `lostMl`, `playedMs` and `endingStats`; dev and test jumps (`jumpTo` a scene, `setContainer`, `setSeason`, `setSieve`, `finishWaitsNow` and the triggers, all empty in production builds); gesture commands (`crankCircle`, `crankLetGo`, `dragFrog`, `dropFrog`); emits `SimEvent`s.
- `src/game/carry.ts`: the carry event as the sim sees it, on the path, the walk-in and the pour: `advanceEvent` turning each outcome into drains and pulses (bathroom threats wait for the house), dev `triggerEvent` and `triggerBathroom`, calls (`answerCall`, `declineCall`, `chooseAnswer`, `interviewChoices`, `callEnded`), `blowTarget`, and the swatter (`swatReady` for the Swat button, a swing per R or Swat with its 0.55 pulse).
- `src/game/trouble.ts`: trouble at the house: the cat drinking and the pulled plug (`startCat`, `pullPlug`, `rollHouseTrouble` per trip, `catBusy` while treats last, `shooCat`, `dragPlug`, `dropPlug`, `canTouchHouse`, `houseNeedsYou`) and spring rain on arrival (`maybeRain`, `triggerRain`).
- `src/game/replays.ts`: the `DrainRecord`, the automatic replay rules (`claimReplay` with its `ReplayLog`: the first path drain at 10 m or more, then 85 m or more or in the house with half a sieve, at most once per 3 trips) and the replay label (`drainSpot`: "1 step from the tub", "5 m from the house").
- `src/game/share.ts`: share card words: `ShareMoment` (fail, near miss, milestone), a phrase per cause for "Trip 41: lost 3 L to a fly" (`failTitle`), `failCard`, `nearMissCard`, `milestoneCard`, and the message sent with each.
- `src/game/ending.ts`: the ending screen's numbers (`endingStats`: litres lost including the cat and the plug, the top cause), its rows (`endingRows`) and the ending card (`endingCard`).
- `src/game/stones.ts`: Paved Path's one stone per empty walk (`StoneWalk`): the walk's segment (`startStoneWalk`), the Lay Stone prompt, stopping by it, getting the stone out (`openStone`), its slot and rest spots, dragging, dropping and laying it (which flattens the segment's bumps), putting it away.
- `src/game/kit.ts`: the shop's upgrades (`UPGRADES`: Wax Coating, Slippers, Fly Swatter, Finer Mesh, Paved Path, Bigger Sieve, cheapest first) and joke buys (`JOKE_BUYS`: Wish at the Well, Cat Treats, Party Hat), `KitState`, the slippers' gait scale, wishes (`rollWish`, one in 6 brings the frog), and the sim actions: `applyUpgrade`, `buyJoke`, `jokeBlocker`, wax use, wear and `rubWax`, `rewaxDue`, `soakSlippers`, `canHangSlippers`, `hangSlippers`.
- `src/game/well.ts`: the well bucket and crank rules (circles, unwinding, let-go, slams), the water line and the motion dip flag.
- `src/game/chores.ts`: the frog, mend, house floor, leaves, cat, plug, rewax and slippers chores, path patch chores; the chore director (`directorPicks` per moment: a refill's house chore is the wet floor, or the cat when the sim's roll sets `catFirst`; house chores for an early refill arrival; the run back counted at a house arrival; chore estimates with house walks; `coverage`).
- `src/game/bench.ts`: workbench state and rules: the mode (mend or wax), stages (thread, sew, glue, wax), the swaying eye, hole and stitch point positions on the bench, sewing in order with unpicking.
- `src/game/hints.ts`: first-time hints per input (mouse, two thumbs, motion, and walking for real), including drift on trip 2, arm fatigue, leaves, the cat and the plug at the well, soaked slippers, Rewax, the shop, each carry event at its first warning and then the swatter; the visit line (cat, plug, puddle, leave); the pause lines, including which input took over; which one shows now (`hintFor` with a `HintContext` the sim fills in).
- `src/game/snapshot.ts`: the flat `HudSnapshot` store (including `realWalk` for the walk pad, `share` for the context label, the `ending` stats built once, `catDrinking`, `plugOut`, the interviewer's `answerE` and `answerF`, `rainTenths`, `canShop`, `slippersTimer`, `waxTrips`, `slippers`, `swatter` and `treatTrips`) and its 10 Hz publisher.
- `src/game/containers.ts`: the bucket, sink and bathtub definitions and their ledgers; `drainContainer` moves whole mL to the cat or the drain with remainders; `shownContainer`, the one the house and the HUD show (the one just filled while its pour's result shows).
- `src/game/leaves.ts`: leaves floating in the well water: the 15% scoop cut per leaf, scattering at most 3, the autumn crank roll.
- `src/game/events.ts`: carry events: season weights and the roll (built events only, capped at 60%, 2-trip cooldown, none before trip 6, calls from trip 12), each event's warning and outcome as a pure `stepEvent` (falling leaf; fly with blows, retreats and faster returns; a swat that kills either unless the fly is zooming off; sneeze with the freeze check and fake-outs; the dog; the cat round your ankles; a call's buzzes, talk and ring-out), the bathroom slot (`rollBathroomThreat`, `createBathroomEvent`), `answerCall`, `declineCall`, `chooseAnswer`, and where a leaf or fly is over the cam (`eventSpot`, `flySpotAt`, `shadowShowing`).
- `src/game/calls.ts`: callers in turn, their lines while ringing and once answered, the interviewer's questions with their two answers, and the `CallLog` (whose turn, who calls back, your answer).
- `src/game/rain.ts`: spring rain over the tub: the escalating gags and the fill-then-drain step on `rainMl`.
- `src/game/cat.ts`: the cat drinking and the pulled plug: when it bothers (2 L or more), the per-step container losses, whether a dropped plug fits its hole.
- `src/game/seasons.ts`: season by progress, `laterSeason`, names and the Year 2 trip.
- `src/game/story.ts`: each cutscene's length and where play resumes (the well, the walk back, or the end), the container-done cutscenes (the bathtub's is the ending), the bathtub milestone gags and their lines (`MILESTONE_LINES`, also the milestone cards' titles).
- `src/game/holes.ts`: the `Hole` type (spot on the mesh, stitch points), tearing one and the leak rate.
- `src/game/pour.ts`: pour flow, splash share, the pointer pour axis and its inverse, and the D/A key pour.
- `src/game/economy.ts`: coins per delivery and the No-Drip rules.
- `src/game/testing.ts`: test helpers (a sim on a fake clock, autopilot runs, `playWithWaits` recording each refill and glue wait's chores and idle time). Tests only.
- `src/game/pacing.ts`: the pacing measurement (section 5): `playGame` plays a whole seeded game as a skilled pilot, with or without Assist Mode, and records each trip (with what drained it), the cat and the plug, purchases, replays, hints and time by scene and phase; `estimateMinutes` adds the start, shopping, replays and hints; `phaseRates` gives success, delivered share, trip times and drain points per container and sieve size. Tests and balancing only.
- `src/game/captions.ts`: the drain caption bank (6 lines per cause, rotating) with stat-quoting lines (`drainCaption` with `DrainFacts`: "Third fly today.", "That's 12 L to the dog.", "8 m. Eight.") and the litres formatter.
- `src/game/autopilot.ts`: `Autopilot` with `skilledPilot` for the average and unskilled profiles (wobble, twitches, steering lag, reaction times, chore pace, shopping, walks to house and path chores during waits, braking under each patch's slip speed, the `idle` flag), otherwise a flawless careful player (cranks, moves the frog, drags leaves out, mends and rewaxes at the bench, hangs soaked slippers, lays a stone per empty walk, tiptoes over a wet house floor, counters events mid-pour too, scoops up to the leaf cap, slows for bumps (a skilled pilot only as far as the ghost tick asks) and the rose bush, tiptoes past puddles (and a skilled pilot brakes for them on empty walks too), blows leaves and flies off once their shadow shows, freezes for sneezes and the dog, answers calls, pours in the green, shoos the cat, fixes the plug and wipes the floor on visits, runs back, presses to resume pauses) for dev tools and tests only.
- `src/game/path.ts`: seeded bumps, the trip 1 teaching bump, the rose bush stretch, paving segments (`segmentOf`, `pavedAt`, `firstUnpaved`, `segmentAhead`, `flattenBumps`; reshuffled bumps skip paved segments), patches with ids and rub progress (drain patches; aging that dries, freezes in winter and melts in spring; spring puddles and autumn leaf piles), slip speeds by footwear, wipe strokes and hazard look-ahead; a new trip keeps at most `MAX_PATCHES`, oldest gone first.
- `src/scenes/input.ts`: `InputSystem` (pointer, keys, focus and rotation into `InputFrame`; motion mode with touch grace; drops the old device's grip when another input set takes over; Esc pauses and opens Settings; `suspend` for dialogs; scene gesture hooks; blowing with F, or a finger pressed near `blowTarget` while the sieve is in hand; E answers, F declines and R swats as one-shot presses), `GripControl` (grip and walk by pointer id; every touch walks in motion mode; `switchTo` drops a grip from the other kind of device), `classifyRelease` and `touchGrace`.
- `src/scenes/motion.ts`: `PhoneTilt` (raw pose tracking, calibration that refuses poses over 45° from flat, waits for a still phone, and after-crank refines) and `FakeMotion` for dev and tests.
- `src/scenes/layout.ts`: the `layout` store (bands or columns, design rect, safe areas), the fixed bottom-band slots (`METER_ROW`, `CHORES_SLOT`, `CONTEXT_SLOT`, `WALK_PAD`), `logicalBox`, band and column boxes, the column walk pad for wide touch screens (`columnWalkPad`) and the walk pad the input hit-tests in either layout (`walkPadRect`).
- `src/scenes/renderer.ts`: owns the `FailFilm` (records after every frame, notes each drain, snaps stills on `snap` cues and 500 ms after a near miss, between the caption and the hint line); draws each frame for the current scene with the whip-pan (only the world behind the title; none under Reduced Motion), picks the hero's face (despair after a drain, smug after a No-Drip Trip), squashes the cam sieve on jolts, creaks the crank each quarter turn, dresses the hero from the kit (`outfit`), the cold open and its cues, pre-paints cached layers, steps the leaf pond, turns sim events into particles, shake, captions, slips and falls (`fallOver`, shared with the dog), moles, sounds (footsteps soft in slippers and squelching when soaked; wax, slippers and swing lines), the cat's toasts and shoo, the rain's captions, the near miss ("So close. 0.3 L short." and the sad trombone), and the Assist Mode toast, plays the blow wind, the ending's tap roar on the pour loop, lapping, gurgle and the rain loop that swells and fades, drips that quicken as a tilt dribbles, and draws leaves clinging to a dipped sieve, the bubble level, hint, trip report (split once per report), the pause overlay with hoisted text styles, a pop when another input takes over, the `?debug` overlays through `debug.ts` in dev builds only, a stomp's thud and shake, the Walk for Real caption (with the phone's jolt, peak and tilt) and markers. Carry events draw through `EventView`.
- `src/scenes/events.ts`: `EventView` (on the path and in the house): the falling leaf and the fly over the sieve cam with landing shadows (and the culprit on the mesh after a drain), the cat trotting in, weaving round your ankles and on the ring, the bathroom and empty-sieve captions, the swatter slapping across the cam and over your head, a swatted fly sliding off squashed, the dog on the ring, the side view (the leaf, the fly round your head, the sneeze's "Ah…" bubble, the dog's peek, dash or proud look back, the caller's bubble, the glowing pocket and the phone at your ear), the fly's buzz and the ringtone, and captions, sounds and particles for each outcome.
- `src/scenes/leaves.ts`: `LeafPond`, the Matter.js pond of floating leaves in the well cam (8 thick wall slabs, slow currents, a pointer-constraint drag out over the rim, positions saved back to the game state) and its drawing.
- `src/scenes/art/leaf.ts`: `LeafArt`, three cached autumn leaf stamps drawn at any spot, angle and size.
- `src/scenes/cutscenes.ts`: the `Cue` type (sound, caption, shake, action, including `snap` for a share card's still), `CUES` for every cutscene, the `Cutscenes` dispatcher, and `ColdOpen` (bathroom tap that coughs dry, the kitchen drawer sieve).
- `src/scenes/ending.ts`: `EndingScene` and `ENDING_CUES`: the shower cap, the hop into the full tub, every tap bursting on and the sink overflowing, the water company and interviewer calls in the overflowing tub, and the close-up stare; `TAPS_ON_MS` and `STARE_MS` for the tap roar.
- `src/scenes/film.ts`: `FailFilm`, the `ReplayRecorder` at 180 x 320, 20 fps, 3s on the cached design rect, cutting a `FailShot` 700 ms after each drain, plus moment stills of the whole design or a band (`ROOM_BAND` for cutscenes, `HOUSE_BAND` for a near miss).
- `src/scenes/progress.ts`: `ProgressScenes`: the bucket-done cutscene (toilet flush, the kick into the shed, autumn leaves), the sink-done cutscene and the three bathtub gags, with their cues (each gag snaps its milestone card's still).
- `src/scenes/path.ts`: `PathScene`, the Garden Path and empty walks both ways with season-painted parallax tiles (`setSeason`), props, flagstones on paved segments, bumps with moles, the rose bush, puddles, ice and leaf piles, the rub area, the stone to lay with its gap, wet leaf piles as 3 cached stamp variants, and the hero; the shared backdrop; the scrolling cam ground; `StoneInput` (drag the stone into its gap).
- `src/scenes/physics.ts`: `Tumbles`, one cosmetic Matter.js world (at most 3 bodies) for the sieve flying out of your hands on a slip and the bucket kicked into the shed; `Knocks`, the 3 things a shooed cat sends flying; `drawBucket`.
- `src/scenes/well.ts`: `WellScene` (well, bucket, crank, frog, hook, the sieve finer and 1.25x bigger with its upgrades, the washing line with slippers drying or a pulsing Hang spot, the wax tin that bobs while Rewax is open, hero, the cam view into the bucket or down the well, with floating leaves and the refill countdown) and `WellInput` (crank, frog and leaf gestures, the washing line, the wax tin, opening the bench on a holey sieve, bench presses).
- `src/scenes/wipe.ts`: `WipeInput` (rub strokes in the open rub area), the rub box and progress, `drawRubArea` (dashed box, Rub! or Scrape!, progress bar, sponge), shared by the path and the house floor, and the shared `DASH` and `NO_DASH` arrays.
- `src/scenes/bench.ts`: `BenchInput` (thread drag with hand shake, needle drag through stitch points, glue tap, wax rubbing, Back) and `BenchView` (the card, swaying needle, spool, big sieve with numbered stitch points, glue tube, the wax block and its progress bar).
- `src/scenes/cam.ts`: `SieveCam` (its `squash` set per frame by the renderer), the distance bar with hazard marks (bumps, puddles, the rose bush, paved stretches), the round sieve cam (fine mesh, 1.4x for the Bigger Sieve) with holes and wax glints, the ghost tick counting slippers, paving and the sieve's weight (bump only while you walk for real), and the steadiness ring with the ghost tick and rim arrows, shared by every scene.
- `src/scenes/house.ts`: `HouseScene` (which stays on the container a pour just filled while its result shows) and its three rooms (the back step with the bucket, the kitchen sink with its dishes, the bathroom with the claw-foot tub, litre ruler, plug chain, skylight and duck), the walk-in, the pour stream, the visit with the floor puddle on the walk-in, its wet-floor sign and its rub area, the cat lapping on the rim and its shoo leap, the cat crunching treats at a bowl by the door, the pulled plug with its drag target and the swirling plughole, spring rain through the skylight (clouds, streaks, a pale band on the water, the umbrella and the rainbow), and the pour gauge; `drawRoom` for cutscenes; `catSpot`; `HouseInput` (tap the cat, drag the plug).
- `src/scenes/fx.ts`: the particle pool (drips, splashes, ripples, sweat, dust, autumn leaves that drift and can fly off sideways), screen shake (off under Reduced Motion, even mid-shake) and the caption with a one-line queue.
- `src/scenes/perf.ts`: frame time and React commit counters for `?debug`, recorded in dev builds only.
- `src/scenes/debug.ts`: the `?debug` overlays (dev builds only): the stats panel (levels, drift, offset, last drain, frame time, React commits, phone readings and any `?tune` overrides) and the bump and patch markers.
- `src/scenes/art/backgrounds.ts`: cached tile painters per season (hills, ground, the well, the top-down cam ground, grass colours), the house and signposts.
- `src/scenes/art/sieve.ts`: the top-down sieve, its water, wax gloss streaks (`drawGloss`, also on the bench), holes with stitches, tilt wedge, target dot, the steadiness ring and the phone bubble level.
- `src/scenes/art/hero.ts`: the hero in side view with a 5 fps line boil (frozen under Reduced Motion), poses (arms up, phone at the ear), faces (`HeroFace`: smug, despair; the ending's flat stare), the shower cap, `drawHeroHead` for close-ups, the slip fall, and the `outfit` every scene wears: the party hat, dry or soaked bunny slippers, the swatter in the back pocket, a finer or bigger side sieve, and straining arms with the Bigger Sieve.
- `src/scenes/art/animals.ts`: the orange tabby (walking, reaching a paw, lapping, puffed up), the rubber duck and the scruffy dog (running, or just its head).
- `src/scenes/art/bubble.ts`: the canvas speech bubble for callers and the cast.
- `src/ui/Hud.tsx`: the React HUD in portrait bands or desktop columns: the trip or Last Trip label, the season badge, holes, the glue and slippers countdowns, the coin badge that opens the shop on phones (with its Shop sticker), Shop beside Settings on desktop, the desktop gear list (wax trips, slippers, cat treats) and "R: swat", the Chores button and the context button (Swat, Wipe, Scrape, Sweep, Share This Fail or Share This, Go to House, Go to Well; "R: Swat" for a mouse holding water) in their phone slots, the clickable chore list and context button on desktop, Answer and Decline (or the interviewer's two answers) across both phone slots or in the desktop column (as E and F key labels while a mouse holds water, since clicking would let go), the container bar with a pale rain band and red Cat drinking! and Tub draining! stickers (Cat! and Plug out! on the phone's status line, where the well, glue and slippers countdowns lead and never get cut off, and the trip, season and scoops give way), coins, the Menu icon or Settings button (replaced by "Esc: Pause" while a mouse holds water and the game isn't paused), live meter, litres and distance readouts, the No-Drip badge, scoops left, the refill countdown, the chore list and the Hold to Walk pad (`WalkPad`) in its slot, or at the foot of the right column on a wide touch screen with the column's buttons above it (the trip's step count while you walk for real; Walk for Real in the context slot on Last Trip), and the column's controls list for a mouse, two thumbs or tilt (`controlLines`).
- `src/ui/Title.tsx`: the start screen over the faint well, with the rotation lock tip and Walk for Real on phones, and a Settings button.
- `src/ui/TrayStep.tsx`: "Hold It Like a Tray", with live calibration status, a Walk for Real line when it's on, and Use Thumbs Instead.
- `src/ui/SettingsModal.tsx`: Settings as the pause menu, with Recalibrate Tilt and, on phones, Walk for Real.
- `src/ui/RealWalkToggle.tsx`: the **Walk for Real: Off/On** button and its line, disabled without motion data.
- `src/ui/ChoresModal.tsx`: the phone chore list dialog; tapping a chore goes to it.
- `src/ui/ShopModal.tsx`: the shop dialog: the shared `ShopPanel` in compact rows for upgrades, then Joke Buys with toasts for each line.
- `src/ui/Sideways.tsx`: the "Turn Your Phone Upright" cover, which pauses the game.
- `src/ui/ReplayModal.tsx`: `ReplayModal` (the slow-mo replay with its red label above the clip, the drain caption, Skip, Watch Again and Share) and `ShareDialog` (the shared `ShareModal` for the card the shell asked for, "Share Your Shame" or "Share This").
- `src/ui/SpikeRecorder.tsx`: the `?spike` page (dev only): Begin (motion access, sound, wake lock), the take list, each take's countdown, beeps, live reading, press pad, tip count and Done button, and Results with Copy Readings and Play With These.
- `src/ui/Ending.tsx`: **You Filled the Bathtub** through the shared `EndingScreen`, with the 8 rows, the story line, Share (the ending card over the bathtub still) and Play Again.

## Lead Decisions (2026-10-09, 21:45)

Ekansh delegated every design, tuning and balance decision to the lead and is not available to answer questions. Never leave a milestone waiting on him. Make the call yourself, record it in this section with a one-line reason, and move on. Anything only a real phone or a real human session can measure goes under Owner Follow-Ups below and never blocks a milestone.

- **Assist Mode:** too strong at 1 to 6% failed trips. Retune it so an unskilled player with Assist fails about as often as an average player without it (roughly 25 to 35% of trips), and an average player with Assist fails about 10 to 15%. Reason: Assist exists for shaky hands, not to remove the game.
- **Round 8 balance changes** (the frog no longer on the crank while slippers dry, at most 6 slippery patches, the usual wet-floor refill chore with the cat on about 30% of refills, one autumn leaf pile per trip, the Bigger Sieve wobbling 15% more): approved as built.
- **Real-phone constants** (TOUCH_GRACE_MS, TOUCH_GRACE_SCALE, MOTION_REF, STEP_START_JOLT, STEP_END_JOLT, REAL_STRIDE_M, REAL_HAND_SCALE, GENTLE_STEP_JOLT, STOMP_SCALE): ship the current best guesses. Keep the HTTPS readings spike as a dev tool.
- **Assist Mode hand scale (M27 builder):** 0.78x, set in the game through the shared meter's new `assistScale`. Reason: 0.6 is the shared default the other games keep.
- **Assist Mode warnings (M27 builder):** no longer stretched to 1.7s. Reason: Assist is for shaky hands, and with the longer warnings no hand scale got both players into their ranges.
- **Shipped real-phone numbers (M27 builder):** `MOTION_REF` 4 m/s², touch grace 150 ms at 0.5, steps start at 0.8 m/s² and end under 0.4, `REAL_STRIDE_M` 2, `REAL_HAND_SCALE` 0.5, `GENTLE_STEP_JOLT` 2 m/s² and `STOMP_SCALE` 0.85. Reason: unchanged best guesses, as decided above.

## Audit Pass Decisions (2026-10-10)

- **Tablets held sideways get a walk pad:** the column layout shows Hold to Walk at the foot of the right column for touch input. Reason: touch-only players could fill the sieve there but never walk it to the house.
- **Desktop drift stays:** the controls list now says "Mouse: steer the sieve onto the dot". Reason: a resting mouse is perfectly still, so drift is the desktop challenge. DESIGN.md's controls table still says "keep the mouse still" and needs the lead's edit.
- **Base drip stays at 0.8%:** 0.5% cut an average game from 108 trips to 104. Reason: trip count follows the sieve size; the design's 60 to 70 counts delivering trips, and the game measures 76.
- **Paved Path flattens bumps:** a laid stone removes its segment's bumps instead of halving them. Reason: DESIGN.md promises fewer bumps, and a bump vanishing under a stone is visible progress. A paving player still averages 104 min.

## Coin Boost Decision (2026-10-10)

- **All coin income is tripled:** upgrades come about 3x sooner. Reason: the game feels faster. The new values:
  - Delivery pay: 30 coins per litre (10), as `COINS_PER_LITRE` in place of `ML_PER_COIN`.
  - No-Drip Trip: +30 coins (+10).
  - Container bonuses: bucket +150 (+50), kitchen sink +300 (+100), bathtub none (none).
  - Mum's call: 60 coins (20). She says "I've sent you 60 coins. Buy a snack."
- **Prices stay the same:** upgrades and joke buys cost what section 3 lists.
- **Milestone entries keep the old amounts:** section 11 records what each milestone built and measured at the time. Section 5 measured its times with the old income too.

## Owner Follow-Ups

These need a real phone or a real player. They do not block any milestone. The game ships with the current best-guess numbers.

- Run the HTTPS readings spike on a real iPhone and Android phone, record the 8 takes, and set the nine real-phone constants from the readings.
- Original milestone text, kept for reference: M27: Real-Phone Tuning - Ekansh runs `SIEVE_HTTPS=1 bunx vite --port 5175 --strictPort` in `water-in-a-sieve`. On the phone he opens `https://your_lan_address:5175/?spike` (Vite prints the Network address) and accepts the certificate warning. He records the 8 takes, taps **Copy Readings** and sends the text to the builder. **Play With These** tries the suggestions in the game first. The builder checks the suggestions against the readings and writes the 9 numbers into `game/tuning.ts`: `TOUCH_GRACE_MS`, `TOUCH_GRACE_SCALE`, `MOTION_REF`, `STEP_START_JOLT`, `STEP_END_JOLT`, `REAL_STRIDE_M`, `REAL_HAND_SCALE`, `GENTLE_STEP_JOLT` and `STOMP_SCALE`. On a real phone a still hold reads under 0.1, a thumb tap barely moves the ring, gentle steps stay green and a stomp drains. Rerun the pacing test, and write the numbers into this plan.
