# GOOD BOY — playable prototype

> *December 13th, 1998. The Hale farm. It has been one year since Danny went away. Biscuit still waits by the door.*

A first-person horror game with a PS1-era look. You play Biscuit, the family dog, on the night of a winter storm. Something is wrong with the air in the house, and the people you love can't understand a word you say.

## Running it

It has no build step and no external assets. Every texture, sound and voice is generated in code. Serve the folder over HTTP, because ES modules don't load from `file://`:

```bash
cd good-boy
python3 -m http.server 8000
# open http://localhost:8000
```

Use headphones and play in the dark. A full night lasts about 16 minutes if nothing ends it early.

## Controls

| Key | Action |
| --- | --- |
| **WASD** / mouse | move / look (click to capture the mouse; arrow keys also turn) |
| **Shift** | run |
| **Space** | bark (wakes sleepers, annoys the family, makes the furnace answer) |
| **Q** | whine (calms them down, earns forgiveness) |
| **E** | take or drop something in your mouth · tug a sleeve (they follow you) · nudge a sleeper · scratch a door |
| hold **E** | bite |
| hold **F** / right mouse | **sniff**: the world goes grey and you see scent trails. Each person has a colour, Danny's old trail is gold, and the *wrong* smell is grey. |
| hold **C** | lie down (hold it in your bed to sleep) |

## What's in the prototype

**Look and feel**
- A custom PS1 renderer. Lighting is per-vertex (Gouraud), vertices snap to a coarse screen grid so geometry jitters, textures are mapped affinely so they warp, and fog is per-vertex. The scene renders at 240p and is upscaled with nearest-neighbour filtering, with 15-bit colour and 4×4 ordered dithering.
- Carbon-monoxide hallucination effects build up over the night: the whole world wobbles, you get double vision and chromatic split, the vignette pulses with your heartbeat, the corridors stretch, faces go wrong and you black out briefly.
- All 60+ textures are painted procedurally on canvas: wallpapers, the farmhouse floors, faces, the daughter's drawings, the calendar with tomorrow circled, the thermostat cranked to 78.

**The house**
- Entry, living room, kitchen, hall, three bedrooms, the laundry room, a stairwell and a basement full of Danny's boxes.
- Every room holds details that tell the story. There are four stockings and four place settings, one of each still for Danny. His sneakers are still on the boot tray. Sympathy cards sit on the coffee table. The CO detector's LED is dark, and its battery lies on the floor below it. A dollhouse of the farmhouse has a little figure in its basement. Lily's drawing puts Danny *under the house*.

**The family**
- Tom, Claire and Lily walk the house on a schedule that runs through the evening, bedtime, the slow poisoning, and sleep that turns into something worse.
- **Muffled speech.** Lines are voiced by formant synthesis and run through a garbler, so the subtitles show only the words a dog knows (*Biscuit, no, bed, Danny, good boy…*). Everything else comes out as noise. They tell you exactly what's wrong in the first minute, and you can't understand it.
- They react to you. Barking adds strikes. Whining earns forgiveness. Tugging a sleeve makes them follow you. Leading them to the basement door makes them close it, because they can't face going down there. Three strikes and you get locked in the laundry room. Bringing them objects (Danny's ball, the leash, the battery, Lily's drawing) gets a reaction to each.

**Horror**
- A furnace that breathes, its grille growing teeth as the night goes on.
- A face in the TV static, a figure outside every window in a lightning flash, and knocking at the front door.
- Light and footsteps under Danny's locked door, and a whisper from inside.
- Danny's shape at the end of the hall, walking down into the basement.
- A lullaby coming up from the basement while the mother is asleep upstairs.
- Lily standing in her dark doorway: *"Danny is calling me. From down there."*
- When you take the jacket, **the thing in the basement** wakes up and chases you up the stairs. If it catches you, you get a jumpscare and wake up back where you started.

**Sound**
- Every sound is synthesised in WebAudio and placed in 3D: the storm, sleet, thunder, the furnace drone, the fridge hum, the kitchen clock, TV static, footsteps on wood, carpet and stairs, creaking doors, knocking, barks and whines, the heartbeat, tinnitus, stingers and the lullaby.
- As the poison takes hold, the whole mix gets muffled.

## Endings (5)

| # | Ending | How |
| --- | --- | --- |
| 1 | **GOOD BOY** | Do what they tell you and sleep in your bed, or let the night run out |
| 2 | **THE LONG WAIT** | Be by the front door when the night ends |
| 3 | **THE LAUNDRY ROOM** | Be locked in the laundry room (under its cracked window) when the night ends |
| 4 | **BAD DOG** | Bite one of them once the poison is strong |
| 5 | **HOME** *(true ending)* | Find Danny's jacket in the basement, escape what's down there, and bring it to someone who is awake |

Every ending finishes with **"What they said tonight"**: a full, unscrambled transcript of every line the family spoke, with the clues highlighted. That's when you find out you were told everything in the first minute.

## Code map

| File | Purpose |
| --- | --- |
| `js/ps1.js` | PS1 material (vertex lighting, snapping, affine UVs, fog) and post-processing (dither, hallucination) |
| `js/textures.js` | procedural canvas textures |
| `js/house.js` | geometry, colliders, doors, lights, props, items |
| `js/humans.js` | family models, animation, pathfinding, speech garbler |
| `js/player.js` | dog controller and input |
| `js/scent.js` | scent-vision particles |
| `js/audio.js` | procedural audio |
| `js/story.js` | timeline, reactions, scares, the presence, endings |
| `js/main.js` | bootstrap and render loop |

`vendor/three.module.js` is three.js r160 (MIT, see `vendor/THREE_LICENSE`).
