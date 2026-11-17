# Study: three.js "skinning blending" walk demo

Studied 2026-11-17. Source: https://threejs.org/examples/#webgl_animation_skinning_blending (three.js examples, MIT licence, so the code can be used with credit).

## What it shows

One soldier with a skeleton and three animation clips (idle, walk, run), all playing at once through one `AnimationMixer`. What you see is a mix of the three, set by weights:

- **Weights:** `action.setEffectiveWeight(w)` decides how much of each clip shows. Weights 0/1/0 is a pure walk; 0/0.5/0.5 is a jog between walk and run.
- **Cross-fades:** `start.crossFadeTo(end, seconds, true)` moves the weight from one clip to the other over time.
- **Warping** (the `true`): during the fade the two clips' speeds are stretched to match, so the feet stay in step instead of stuttering.
- **Waiting for the loop:** walk to run waits for the walk loop to finish (the mixer's `loop` event) before fading, so the switch starts on the same foot.
- **Time scale:** `mixer.timeScale` or `action.setEffectiveTimeScale` slows or speeds the gait.

The cost: every person needs a skinned mesh and a mixer updated every frame. That's fine for dozens of people, not for hundreds.

## How our people work now

`src/people.ts` builds each person from about eight rigid meshes (torso, head, arms, legs). `pose(t, walking)` swings them with sine waves. There are two states, walking or idle, which switch instantly. Cheap and readable, but stiff: no knees, no weight shift, no turn-in-place, a hard snap between states, and the stride speed isn't tied to how fast someone moves, so feet slide.

## Version 2 ideas

1. **Skinned people with real clips.** Idle, walk, run, plus our own: talk (two people facing), queue-shuffle, lean on a rail, sit. Fade between them using the demo's method (warp on, wait for the loop to end).
2. **No foot sliding.** Set each walker's time scale from their real ground speed divided by the clip's stride length. This one rule removes most of the "skating" look.
3. **Belter low-g lope.** A second walk clip with longer, floatier strides. Blend walk and lope by local gravity (Ceres 0.3 g, the axis of Medina's drum). This ties in with roadmap step 9, spin gravity.
4. **Crowds at scale.** Full mixers only for people within about 15 m. Further out: update the mixer every 2nd to 4th frame, then bake the walk into a vertex-animation texture and draw everyone else with one `InstancedMesh`. That keeps 500+ people affordable on WebGL.
5. **Third-person view (optional).** The same rig as the player's body, with a toggle between first and third person when walking.

## Where the bodies and clips come from

- **Not the demo's Soldier.glb.** It comes from Mixamo (Adobe), whose terms don't allow sharing the raw files, so it can't go into our public repo.
- **Trial:** a CC0 animated character pack (for example Quaternius). Check the licence page and add it to `CREDITS.md` before use.
- **Long term:** our own. Extend `tools/blender/kit.py` to build a scripted armature, bind the body with automatic weights, and key idle, walk, lope and talk cycles in script. Fully ours, fits the existing Blender pipeline, and matches roadmap step 11 ("better people").

## Suggested first step

One skinned person on the Ceres Concourse with idle and walk clips, fading with warp, time scale tied to speed. Compare it side by side with the current sine-wave person before touching the crowd code.
