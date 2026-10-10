# Water in a Sieve: Design

A meme game that takes an idiom literally. It is built to make you angry, keep you busy with chores, and take 1 to 2 hours to finish. Unskilled players take longer.

## Decisions So Far

- **Platform:** one web game built with React and Vite. It runs in desktop browsers and phone browsers. There is no app store version.
- **Length:** 1 to 2 hours for an average player, in one sitting. Unskilled players take longer.
- **Waits:** every wait runs in real time, lasts about 1 minute, and can't be skipped. Each wait overlaps with a chore, so you never stare at a timer.
- **No paid skips:** the pain is the joke. Selling shortcuts would turn it into a cash grab.
- **Money:** free. No ads, no tip jar, no purchases.
- **No server:** no accounts, no leaderboards, no public counters. Everything runs in the browser.
- **No saving:** progress lives only while the tab is open. Closing or reloading the tab starts the game over.
- **Art style:** hand-drawn, scrappy meme look.
- **Physics:** Matter.js.

## Research Summary

- The Needle In A Haystack Simulator clip passed 50 million views in August 2026. More than 10 copies reached Steam within weeks.
- Every viral idiom game so far is on PC. This idea does not exist as a game yet.
- Copies arrive within days, so ship fast and lead with the funniest fail clip.

---

## The Game

**Pitch:** "Fill the bathtub. You only have a sieve."

**Story:** your water is cut off and you have a job interview tomorrow. The only water left is the well at the bottom of the garden.

### The Core Idea

A sieve really can hold water if you keep it still. Jolt it, or let something touch the mesh, and all the water drains through. On a phone, the phone is the sieve. On desktop, the mouse is the sieve. Your own steadiness decides everything.

### Goal

Fill a series of containers, each harder than the last:

1. A bucket (10 L), the tutorial.
2. The kitchen sink (20 L).
3. The bathtub (100 L), the main goal.

### Core Loop

1. Crank up a bucket from the well.
2. Scoop water into the sieve.
3. Walk 100 m to the house without jolting.
4. Pour it into the tub without splashing.
5. Walk back.

### The Steadiness Meter

- On a phone, the meter reads how much the phone jolts.
- On desktop, it reads sudden mouse movement while you hold the button.
- Above the limit, the sieve drains completely.
- Walking adds a small, steady jolt. Rushing adds a big one.

### Waits

- The well takes 1 minute to refill after every 5 scoops.
- Glue on a patched sieve takes 1 minute to dry.

### Chores

- **Mend the mesh:** snags tear holes. Thread a needle and sew each hole shut.
- **Wipe spills:** wet patches turn into ice in winter.
- **Check the plug:** the cat pulls the plug chain. Miss it and the tub drains.
- **Shoo the cat:** it drinks from the tub.
- **Clear leaves:** leaves in the bucket clog the sieve.

### Things That Go Wrong

- A fly lands on the water and breaks it.
- A sneeze warning: "Ah… ah…". Freeze until it passes.
- The dog runs between your legs.
- Your phone rings, in the game.
- Rain falls straight into the tub and drains away, mocking you.

### Coins

- Each litre that reaches the tub pays coins.
- A full trip with no drips pays a bonus.

### Upgrades

| Upgrade | Helps | New chore |
|---|---|---|
| Finer mesh | Holds more water | Fills slowly |
| Wax coating | Fewer drips | Rewax every 10 trips |
| Bigger sieve | More water per trip | Heavier and harder to keep still |
| Paved path | Fewer bumps | Lay it one stone at a time |
| Slippers | Quieter, smoother steps | They get soaked and need drying |
| Fly swatter | Removes flies | Swinging it jolts the sieve |

### Length

- The sieve starts at 1 L per trip and reaches about 3 L with upgrades.
- That's about 60 to 70 trips for 130 L, at roughly 45 seconds per trip.
- Drained trips, chores and well refills bring it to 1 to 2 hours for an average player.
- Events partway through keep trips from feeling the same.

### Ending

The bathtub fills. You step in. The water supply comes back on at that exact moment.

### Shareable Moments

- The full sieve draining one step from the tub.
- People filming themselves tiptoeing around the house holding their phone flat.
- Share cards like "Trip 41: lost 3 L to a fly".

### Controls

| Action | Phone | Desktop |
|---|---|---|
| Hold the sieve steady | Hold the phone flat and still | Hold the mouse button and keep the mouse still |
| Walk | Hold a thumb down | Hold W or the up arrow |
| Scoop | Dip the phone forward and back | Drag down, then up |
| Crank the well | Draw circles | Drag circles |
| Sew the mesh | Drag the needle through each hole | Same, with the mouse |

### Build Notes

- No water physics. Water is a fill level plus the steadiness meter. Drips and splashes are effects on top.
- iPhones ask permission before a web page can read motion. Show a **Tap to Start** button that asks once.
- Add an **Assist Mode** that loosens the limit for players with shaky hands.

---

## Shared Foundation

The game builds on these blocks in `src/shared`.

- **Real-time timers:** each timer stores its finish time, so it stays accurate when the tab sits in the background.
- **Chores:** one system for "this must be done before that".
- **Coins and upgrades:** one shop, one upgrade list per game.
- **No saving:** progress exists only while the tab is open.
- **Keep the screen awake:** the game asks the phone not to sleep while you play, so the screen doesn't lock mid-task.
- **Leave warning:** on desktop, closing the tab asks "Leave and lose everything?". Phone browsers don't reliably show this prompt.
- **Fail replays:** keep the last few seconds of play and replay them in slow motion.
- **Share cards:** an image with the fail and the numbers, shared through the phone's share menu.
- **Controls:** one layer that turns touch, tilt, mouse and keyboard into the same game actions.
- **Settings:** sound, sensitivity and Assist Mode.
- **Layout:** React handles menus and the shop. A canvas draws the game itself.
- **Physics:** Matter.js handles falling objects.
- **Scrappy look:** lines are drawn with a slight random wobble, like a felt-tip pen, so no art library is needed. Characters and props are hand-drawn images.
