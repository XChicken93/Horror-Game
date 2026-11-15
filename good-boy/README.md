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

Use headphones and play in the dark. A full playthrough to the true ending takes roughly 35–50 minutes.

## Controls

| Key | Action |
| --- | --- |
| **WASD** / mouse | move / look (click to capture the mouse; arrow keys also turn) |
| **Shift** | run |
| **Space** | bark (wakes sleepers, annoys the family, makes the furnace answer) |
| **Q** | whine (calms them down, earns forgiveness) |
| **E** | look closer at photos and letters · take or drop something in your mouth · push the stool · pull a rope or the flap's storm cover · eat · tug a sleeve · nudge a sleeper · scratch a door |
| hold **E** | bite |
| hold **F** / right mouse | **sniff**: the world goes grey and you see scent trails. Each person has a colour, Danny's old trail is gold, the deer are rust-red, and the *wrong* smell is grey. |
| **T** (while sniffing) | **follow one smell.** The scent you're on glows brighter, bigger and more saturated, every other scent fades to dim grey, and the one you follow stays faintly visible even when you stop sniffing. Old trails under the snow only show up when you follow them. **T** again lets go. |
| hold **R** | **dig** (outside, in the snow) |
| hold **C** | lie down (hold it in your bed to sleep) |

**You can see yourself.** Biscuit has a body: look down to see your chest, front legs and paws. Everything you do shows. Your paws come up and scratch at a door, leaving claw marks; your legs stretch out in front of you when you lie down; your paws dig and throw snow; your jaw opens with teeth showing when you bark or bite; you lunge and shake your head when you bite, brace and pull when you tug or pull a rope, put your head down to eat, carry or drop something, and shake the snow off when you come back inside. Out in the cold your breath smokes, and you leave paw prints in the snow.

## The story, in seven chapters

Biscuit starts out understanding about twenty-five words. **Each puzzle you solve teaches him more**, so the family's garbled speech fills in as the night goes on, until by the end you understand every word.

1. **Dinner.** Your bowl is empty. Carry it to the woman so she remembers to feed you, then eat.
2. **Lily's crayons.** Lily lost four crayons around the house. Find them (sniff for her green scent) and bring them back. She draws the family and tells you she can hear Danny *under the house*.
3. **The voice under the house.** At bedtime the furnace lights. The basement door rattles on its hook every time the furnace cycles, and Tom explains why: it pulls air, and only the old latch holds the door shut. Find what Lily hears through the vent in her room. She goes to the basement door but can't reach the hook, so push the kitchen step stool over for her.
4. **Danny's room.** Claire goes to bed and drops the key she keeps in her pocket. Bring it to Lily so she unlocks Danny's room, shut for a year. Read his furnace checklist, his essay *My Dog Biscuit*, his photographs.
5. **Out back.** Danny's list has one more job: *after a big snow, dig out the furnace pipe by the back door, or the bad air comes back inside.* Pull the storm cover off your dog flap at the end of the hall (the family stops you while they're awake) and go out into the snow. The yard has the old oak with Danny's tire swing, the doghouse he built you, Lily's snowman wearing his scarf, the woodpile, a sheet frozen on the clothesline, and deer tracks along the fence. There are three things to do:
   - **Dig out the furnace pipe** buried in the drift against the house. Afterwards the bad air builds more slowly for the rest of the night.
   - **Find what you and Danny buried.** Nothing on the snow shows where it is; you have to smell it. Dig up the treasure tin under the oak, with Danny's letter to himself in 2010.
   - **Follow his last trail to the field gate.** So many smells cross there that you have to follow only Danny's (sniff, then **T**). It is where he went, the night you ran after the deer.

   The air outside is clean: your head clears out there and the poison's effects fade, then come back when you go in.
6. **Under the house.** Danny's gold ghost guides you to his boxes. Read the newspaper clipping about how he died. Pull the workbench drawer's rope for the red tag. Taking either one wakes the thing from the furnace, so carry each up the stairs before it catches you.
7. **Wake them.** Tom and Claire won't wake to barking any more. Bring the CO alarm's battery to Lily so she puts it back. When the alarm screams, Tom stumbles in and pulls it out again. Show him the red tag, then Danny's jacket, and lead him out the front door.

**Why Danny died, and why the furnace was never checked.** It all comes out through hall photographs, Claire's letter, Danny's room, the clipping and the tag. **Danny is not the monster.** He is a warm, gold figure who guides you. The thing that chases you is the furnace's poison, given a shape by a poisoned dog's mind, and the game tells you so the first time you see it.

## What's in the prototype

**Look and feel**
- A custom PS1-style renderer. Lighting and fog are per-vertex (Gouraud) and textures are low-resolution with crunchy nearest-neighbour filtering. The scene renders at 240p and is upscaled, with 15-bit colour and 4×4 ordered dithering. Geometry and textures are rock-steady, with no jitter or warping.
- Thick, dark fog swallows the far end of every room.
- Carbon-monoxide effects build up over the night: double vision, chromatic split, tunnel vision, a vignette that pulses with your heartbeat, faces that go wrong, and brief blackouts.
- All 60+ textures are painted procedurally on canvas: wallpapers, the farmhouse floors, faces, the daughter's drawings, the calendar with tomorrow circled, the thermostat cranked to 78.

**The house**
- Entry, living room, kitchen, hall, three bedrooms, the laundry room, a stairwell and a basement full of Danny's boxes.
- Every room holds details that tell the story. There are four stockings and four place settings, one of each still for Danny. His sneakers are still on the boot tray. Sympathy cards sit on the coffee table. The CO detector's LED is dark, and its battery lies on the floor below it. A dollhouse of the farmhouse has a little figure in its basement. Lily's drawing puts Danny *under the house*.

**The family**
- **Retro-realism.** The family are jagged, faceted low-poly meshes wearing photographic textures: painted faces with harsh camera-flash lighting, oily skin sheen, pores, moles, broken capillaries, bloodshot eyes with detailed irises and lashes, and fabric textures with weave and folds. The realism of the skin on blocky heads is what makes them wrong.
- **Real skinned bodies.** Each character is one continuous mesh deformed by a 12-bone skeleton, the way real games build characters, rather than floating parts. Shoulders grow out of the torso with deltoids and a trapezius slope, legs grow out of the pelvis, and elbows and knees bend with the skin stretching across them. The torsos are sculpted (chest, waist, hips, buttocks, bust), and the limbs taper realistically with thighs, calves and forearms. Proportions are still almost right: torsos slightly tall, arms long enough that the hands hang near the knees, necks a touch long. The thing in the basement is the same body, stretched further.
- **PS1 NPC movement.** Limbs update in stiff steps at about 8 frames a second while the body slides smoothly underneath, so the feet don't match the speed. Heads snap to look at you with no easing, turns happen in jumps, and everyone has random twitches: head jerks, shoulder spasms, flinches and tilts, more often as the poison builds.
- Faces blink, close in sleep, and have a "wrong" version: pale skin, fully black eyes, a hanging mouth and veins.
- Tom, Claire and Lily walk the house on a schedule that runs through the evening, bedtime, the slow poisoning, and sleep that turns into something worse.
- **Speech you slowly learn.** Lines are voiced by formant synthesis and run through a garbler that shows only the words Biscuit knows. The vocabulary grows with each solved puzzle, and the voices get less muffled as he understands more.
- They react to you. Barking adds strikes and three strikes get you locked in the laundry room. Whining earns forgiveness. Tugging a sleeve makes them follow you. Every object has a reaction from each person.

**Horror**
- A furnace that breathes, its grille growing teeth as the night goes on.
- A face in the TV static, a figure outside every window in a lightning flash, and knocking at the front door.
- Light and footsteps under Danny's locked door, and a whisper from inside.
- Danny's shape at the end of the hall, walking down into the basement.
- A lullaby coming up from the basement while the mother is asleep upstairs.
- When you take the jacket or the red tag, **the thing from the furnace** wakes up and chases you up the stairs. If it catches you, you get a jumpscare, wake up in the basement, and lose time.

**Sound**
- Every sound is synthesised in WebAudio and placed in 3D, modelled on how the real sound is made. Barks are formant-filtered bursts with a chest thump. Creaks and scratches are stick-slip impulse trains through wood resonances. Knocks excite a resonant body. Footsteps are paw pads with nail clicks, or a heel and toe with the odd floorboard creak. Voices have three vowel formants and consonants. There's also the CO alarm's real temporal pattern, the latch rattle, eating, the drawer, paper, and the furnace breathing through a vent like a voice.
- Biscuit's own body has sounds too: sniffing in short bursts, a growl and teeth snapping on a bite, a thump and a long sigh when you lie down, claws raking snow when you dig, snow squeaking underfoot, the dog flap slapping shut behind you, and collar tags jingling when you shake off the snow. The wind is louder outside.
- As the poison takes hold, the whole mix gets muffled.

## Endings (5)

| # | Ending | How |
| --- | --- | --- |
| 1 | **GOOD BOY** | Do what they tell you and sleep in your bed, or let the night run out |
| 2 | **THE LONG WAIT** | Be by the front door when the night ends |
| 3 | **THE LAUNDRY ROOM** | Be locked in the laundry room (under its cracked window) when the night ends |
| 4 | **BAD DOG** | Bite one of them once the poison is strong |
| 5 | **HOME** *(true ending)* | Finish all seven chapters and lead Tom out of the front door |

Every ending starts with a **rewind**. The camera runs back through every moment of dialogue, in reverse, at the spot it happened, now in plain English. It stops on the lines that mattered and highlights them with a note on what they really meant.

## Code map

| File | Purpose |
| --- | --- |
| `js/ps1.js` | PS1 material (vertex lighting, skinning, fog) and post-processing (dither, hallucination) |
| `js/textures.js` | procedural canvas textures |
| `js/house.js` | geometry, colliders, doors, lights, props, items |
| `js/humans.js` | skinned family bodies (skeleton + continuous skin), sculpted heads, animation, pathfinding, speech garbler |
| `js/faces.js` | painted head textures: open, closed and "wrong" faces for each family member |
| `js/player.js` | dog controller, input, and Biscuit's visible body (legs, paws, jaw, teeth) and its action animations |
| `js/scent.js` | scent-vision particles and following a single scent |
| `js/yard.js` | the back yard: dog flap, fence and gate, oak, doghouse, snowman, the buried pipe and the dig spots |
| `js/fx.js` | visible particles: falling snow, snow thrown by digging, breath, the pipe's steam |
| `js/audio.js` | procedural audio |
| `js/story.js` | chapters, puzzles, vocabulary, reactions, scares, the presence, endings, the rewind |
| `js/lore.js` | Danny's room, photographs, letters, the clipping and tag, puzzle props |
| `js/main.js` | bootstrap and render loop |

`vendor/three.module.js` is three.js r160 (MIT, see `vendor/THREE_LICENSE`).
