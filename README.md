# KNIGHT vs BRUTE: Cavern Duel

A one-on-one 3D boss fight in the browser, based on John's short video of a caped knight with a glowing blue sword fighting a skull-faced brute on a round stone balcony in a crystal cavern.

**Play:** https://unaimedplayer2025-afk.github.io/knight-vs-brute/

## Controls

| Action | Keyboard | Gamepad | Phone |
|---|---|---|---|
| Move | WASD / arrow keys | left stick | left stick |
| Slash (tap up to 3 times for a combo) | J or Space | A | SLASH |
| Heavy leaping strike | K | X | HEAVY |
| Dodge roll (you can't be hit mid-roll) | L or Shift | B / RB | DODGE |
| Sword wave (when the blue meter is full) | I | Y | WAVE |
| Mute | M | | top-right |

Start or retry with any key, Enter, or a tap.

## The fight

- **The brute (phase 1):** slow walk, a charge with a red lane warning, a two-fist ground smash with a red ring warning and an orange shockwave, and a punch, punch, uppercut combo.
- **Phase 2 (at half health):** a smoke burst, then dark-red plate armor with a glowing cyan chest gem, and he draws a blade. He adds two-handed blade swings and a leaping slam, and he moves faster.
- **You:** a three-hit combo, a leaping overhead strike, a dodge roll you can't be hit in, and a blue sword wave. The meter fills from landed hits, from taking damage, and from rolling through attacks at the last moment ("perfect dodges").
- **Feel:** hits briefly freeze the action, the screen shakes, orange sparks burst, and the sword leaves blue light trails.
- **If the brute wins** (the ending from the video): he parries your last swing and you drop to one knee. He draws a short blade, raises it, and stabs. You fall on your back, and he roars with his arms spread while green-teal magic swirls up around him.
- **If you win:** the final slash plays in slow motion with a white flash. The brute staggers, drops to his knees, and collapses, his eyes go dark, and the knight raises his sword.

## Music

No music track is included right now, by request. The game uses only sound effects made in the browser. The music code is ready for a track later: add `audio/<name>.ogg` and `audio/<name>.mp3`, then set `MUSIC` at the top of `src/audio.js`. It picks OGG or MP3 automatically, starts on the first key or tap, and M mutes it.

## Graphics quality

The game picks a quality level automatically and drops a level if the fight runs slowly. To force one, add `?q=high`, `?q=med`, or `?q=low` to the URL.

## Tech

Three.js r170 (in `vendor/`) with bloom post-processing. Everything is built from code: the models are made from basic shapes, the textures are drawn in code, and the animation is a small keyframe system. There are no build steps, so you can open it with any static file server.

- `src/world.js`: the cavern, the platform, the scenery and the sky
- `src/chars.js`: the knight and brute models and their animations
- `src/fx.js`: sparks, sword trails, shockwaves, warnings, smoke, the sword wave and the green roar
- `src/main.js`: controls, combat, the brute's AI, the finishing moves, the camera and the HUD
- `tools/play-tests.js`: a Playwright test that uses real key presses. It plays one fight that the brute wins and one that the knight wins (a bot that reads the game state and presses real keys), and saves screenshots to `shots/`.
