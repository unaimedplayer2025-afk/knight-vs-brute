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

The fight music is John's own battle track (`audio/battle.ogg`, with `audio/battle.mp3` for Safari). It starts on the first key or tap, loops through the title and the fight, and M mutes it. Sound effects are made in the browser.

## Graphics quality

The game picks a quality level automatically and drops a level if the fight runs slowly. To force one, add `?q=high`, `?q=med`, or `?q=low` to the URL.

## Tech

Three.js r170 (in `vendor/`) with bloom post-processing. The knight and the brute are real rigged 3D characters (Quaternius Universal Base Characters) driven by motion-captured-style clips from the Quaternius Universal Animation Library 1 and 2, loaded with GLTFLoader + meshopt compression. Their armor, cape, swords and the brute's skull are added and colored in code. The stone is CC0 PBR texture from ambientCG, and the far vista is a painted backdrop. See `CREDITS.md`. There are no build steps, so you can open it with any static file server. `tools/` has the asset build script notes and the real-keypress test (`node tools/play-tests.js <url>`).
