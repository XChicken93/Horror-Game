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

Use headphones and play in the dark. A first playthrough to the true ending is meant to take about an hour. The night itself lasts about 55 minutes of air from the moment the furnace lights (longer if you dig out its pipe), and the thing in the dark costs you time every time it catches you.

## Controls

| Key | Action |
| --- | --- |
| **WASD** / mouse | move / look (click to capture the mouse; arrow keys also turn) |
| **Shift** | run |
| **Space** | jump, about a metre: up onto anything solid you could stand on, from the step stool and the beds to the washer, the freezer and the kitchen counter. If you're coming down close to something, you land on it rather than just past it. |
| **B** / left click | bark (wakes sleepers, annoys the family, scatters the thing in the dark). Left click barks once the mouse is captured. |
| **X** | sit (Claire won't feed you until you sit; the family likes it) |
| **G** | wag your tail (your back end sways and thumps; the family softens) |
| **Q** | whine (calms them down, earns forgiveness) |
| **E** | look closer at photos and letters · take or drop something in your mouth · push the stool · pull a rope or the flap's storm cover · eat · tug a sleeve · nudge a sleeper · scratch a door |
| hold **E** | bite |
| hold **F** / right mouse | **sniff**: the world goes grey and you see scent trails. Each person has a colour, Danny's old trail is gold, the deer are rust-red, and the *wrong* smell is grey. |
| **T** (while sniffing) | **follow one smell.** The scent you're on glows brighter, bigger and more saturated, every other scent fades to dim grey, and the one you follow stays faintly visible even when you stop sniffing. Old trails under the snow only show up when you follow them. **T** again lets go. |
| hold **R** | **dig** (outside, in the snow) |
| hold **C** | lie down (hold it in your bed to sleep) |

**You are Biscuit**, the Hales' golden retriever mix: eight years old, with one ear that never stood up. Danny picked you out of a box at the feed store when you were small enough to fit inside his jacket.

**The time limit.** From the moment the furnace lights, a **TIME LIMIT** counts down in the bottom left: how long the air in the house will let the family live. Digging out the furnace pipe outside slows it down. Getting caught by the thing in the dark, or collapsing in the cold, costs time. In the last five minutes it turns red and blinks.

**Cold.** Outside, the cold builds up in you. The screen drains to blue and frost creeps in from the edges as it gets worse, and faster still out in the open field. Go back inside to warm up. If you stay out too long, the cold puts you down, and you come to inside your flap, having lost time.

**Learning words slowly.** Each solved puzzle teaches only about nine new words and saves the rest for later. Every photograph, letter, drawing and keepsake you look at teaches three to five words connected to it, shown underlined, so you understand the family a little at a time.

**You can see yourself.** Biscuit has a body: look down to see your chest, front legs and paws. Everything you do shows. Your paws come up and scratch at a door, leaving claw marks; your legs stretch out in front of you when you lie down; your paws dig and throw snow; your jaw opens with teeth showing when you bark or bite; you lunge and shake your head when you bite, brace and pull when you tug or pull a rope, put your head down to eat, carry or drop something, and shake the snow off when you come back inside. Out in the cold your breath smokes, and you leave paw prints in the snow.

**On a phone or tablet** the same link switches to touch controls by itself. Hold the phone sideways (in portrait it asks you to turn it); tapping to begin goes full screen. Put your left thumb anywhere on the left side for a joystick: push gently to walk, all the way to run. Drag anywhere else with your right thumb to look. On the right, in an arc around your thumb: **E** use/take/drop (hold to bite), **⤒** jump, **B** bark, **F** sniff (hold), **R** dig (hold), **T** follow a smell. In a slim column down the left edge: **»** run (toggle), **C** lie down (hold), **X** sit, **G** wag, **Q** whine. The buttons carry the same letters as the keyboard keys, so every prompt still matches. The HUD is rearranged to fit around your thumbs. Add `?mobile=1` to the address to force touch controls, or `?mobile=0` to turn them off.

**You always know what to do next.** Under the objective in the top right, a **NEXT** line says exactly what to do, which key to press and where, and it updates the moment you do it. A marker at the top of the screen points toward the target, tells you how far away it is and which room it's in, and says "upstairs", "downstairs, in the basement" or "outside, through your flap" when the target is on another level.

## Nothing tells you what to do

There is no objective marker, no NEXT line and no compass on screen. You find your way the way a dog would: the family's behaviour, sounds through the walls, light under a door, and smells (sniff with F, follow one with T). If you are truly lost, hold **H** to remember what you were doing (it shows Biscuit's thought, the next step and a compass for as long as you hold it). If you go a long time without progress, the place you need gives off a glimmer of Danny's scent (visible when you sniff) and a soft knock.

## How the fear works

Built on what makes the best stalker horror work (Alien: Isolation's two-layer AI, Amnesia's noise and vulnerability, build-up and release):

- **A director you never see** (`js/director.js`) keeps a *menace* gauge of how much pressure you are under. When you have had it easy, it nudges the thing toward you (roughly, never exactly). When fear peaks, it pulls the thing away before it goes stale, usually for a while, sometimes only for a few seconds. Every wait, route and choice is rolled fresh, so no two nights go the same way.
- **The thing does not know where you are.** It has to hear you and see you. It roams, investigates noises (going to where the sound *was*, not where you are), hunts what it sees, searches where it lost you, and sometimes stops dead in a dark doorway and waits, silent, for ten or twenty seconds.
- **Everything you do makes noise, and the puzzles need you to do it.** A bark carries ten metres through walls. Running, landing a jump, scratching a door, dragging the stool, knocking the jar off the counter, biting, tugging, dropping things: all of it can be heard. Creeping is nearly silent. Lying still makes no sound at all. Every loud thing is a gamble.
- **Light is a risk too.** With Danny's flashlight in your mouth you can see, and it can see you from much further away, even from the next room.
- **Gaps.** Before the power goes it is still in the walls: knocks that follow your noise, breathing through the nearest vent, lights flickering in the room it is behind. Make enough noise for long enough, close enough, and it comes out. After the power goes it walks the house: you hear its steps and breathing placed where it is, the lights flicker in its room, and its grey smell drifts ahead of it.
- **Silence first.** The house hushes for a moment before it comes out of a vent.
- **No guaranteed safety.** Hiding (lying still, in the dark, ideally under something) usually works, but it may stop right beside you and listen.

## The story, in ten chapters

Biscuit starts out understanding about twenty-five words. **Each puzzle you solve teaches him more**, so the family's garbled speech fills in as the night goes on, until by the end you understand every word.

1. **Dinner.** Your bowl is empty. Carry it to the woman. She takes it, points at the floor and says *"Biscuit, sit."* Sit (X). She walks to the kitchen cupboard, kneels and gets the dog food, carries the bag back, sets your bowl down in its place, pours, and puts the bag up on the counter. Then eat.
2. **Lily's crayons.** Lily lost six crayons all over the house, from the laundry room to the parents' room. Sniff for her green scent on them. Two have rolled under furniture (the couch, the parents' bed): lie flat with **C** and stretch in to drag them out. She draws the family and tells you she can hear Danny *under the house*.
3. **The voice under the house.** At bedtime the furnace lights. The basement door rattles on its hook every time the furnace cycles, and Tom explains why: it pulls air, and only the old latch holds the door shut. Find what Lily hears through the vent in her room. She goes to the basement door but can't reach the hook, so push the kitchen step stool over for her.
4. **Danny's room.** Claire goes to bed and puts Danny's key in the cookie jar, high on the kitchen counter. Climb up after it: jump (Space) onto the kitchen chair nearest the counter, then jump from the chair up onto the counter (run at it if you fall short), walk to the jar and push it off (E). It smashes, and the key is in the pieces. Bring it to Lily so she unlocks Danny's room, shut for a year. Read his furnace checklist, his essay *My Dog Biscuit*, his photographs.
5. **Out back.** Danny's list has one more job: *after a big snow, dig out the furnace pipe by the back door, or the bad air comes back inside.* Pull the storm cover off your dog flap at the end of the hall (the family stops you while they're awake) and go out into the snow. The yard has the old oak with Danny's tire swing, the doghouse he built you, Lily's snowman wearing his scarf, the woodpile, a sheet frozen on the clothesline, and deer tracks along the fence. There are three things to do:
   - **Dig out the furnace pipe** buried in the drift against the house. Afterwards the bad air builds more slowly for the rest of the night.
   - **Find what you and Danny buried.** Nothing on the snow shows where it is; you have to smell it. Dig up the treasure tin under the oak, with Danny's letter to himself in 2010.
   - **Follow his last trail to the field gate.** Danny's ghost is waiting just past it. It is where he went, the night you ran after the deer.

   Then, if you want, **dig under the gate** (hold **R** at the snow piled against it) and follow his trail across the field, through the gap in the pines, to the frozen pond with a hole in the ice. Something of his is buried in the reeds at the edge. It's colder out there.

   The air outside is clean: your head clears out there and the poison's effects fade, then come back when you go in.
6. **Lights out.** Back inside, lightning takes the power. Every light in the house dies; only the furnace keeps glowing. Lily screams, then stops, and her bed is empty and still warm. Follow only her scent (sniff, **T**) through the dark house and down the basement stairs. Danny's flashlight fell off his nightstand when the thunder hit and clicked on: carry it in your mouth and it lights wherever you look, though the old batteries flicker and cut out at the worst moments. You find Lily standing in front of the furnace, talking to it, saying Danny wants everyone to go to sleep down there. Bark to snap her out of it, then lead her back up to her room while the thing from the furnace comes after you. She is slow, and she is scared of the dark.
7. **Under the house.** Danny's gold ghost guides you to his boxes. Read the newspaper clipping about how he died. Pull the workbench drawer's rope for the red tag. Taking either one wakes the thing from the furnace, so carry each up the stairs before it catches you.
8. **Wake them.** Tom and Claire won't wake to barking any more. Bring the CO alarm's battery to Lily so she puts it back. When the alarm screams, Tom stumbles in and pulls it out again. Show him the red tag, then Danny's jacket. He finally understands, tries to get everyone out, and collapses.
9. **The other side.** The furnace roars and opens its grille like a mouth, and behind it there is a street. Walk into it.
   - You come out on your street, almost: the houses are the wrong colours and ash falls instead of snow. Your house's door is open. Inside, the family is lying on the floor, dead. One by one they get up and whisper "Biscuit," and the front door slams behind you. They come for you with their arms out, speeding up, saying things ("Why didn't you wake us up?", "Come lie down with us"). If they reach you, cold hands. The way out is the way a dog gets out of any house: the flap in the west wall (ash blows in through it), round through the side yard's broken gate.
   - Once you are out in the street, the front door bursts open and they come after you, and the thing comes down the road and eats them, one after another. In their last second their right faces come back and they tell you to run. It rears up, then comes for you. Only one house on the street has its light on, and it has a dog flap: the thing is too big to follow you in.
   - Inside is this house's hot box, sick like yours: its pipe coughs bad air back into the room through a cracked joint, and half of Danny's checklist is taped beside it ("1. CLEAR THE VE..."). The gas stem has no handle: it is on top of the tall shelf in the corner (climb the crate, the workbench, then the shelf; knock it down, carry it to the stem, then hold E to turn the gas off). The pipe runs out through the wall: its end, in the side yard, is stuffed with something wet and black. Getting to it means going back out past the thing as it walks the street, and pulling it out takes three loud tugs. It hears. It sees you if you are close, or in front of it.
   - The air across the road tears open, a burning orange rip with home on the other side, and the thing sits in the road between you and it. Go out through the flap, and Danny is right there. He gives you a fright, but it's only him. He picks you up, and **you play as Danny**, carrying Biscuit (SHIFT run, SPACE jump).
   - Danny talks to you for a long time first, then hums the lullaby as he carries you. The tear rips away down the road, and the road goes on and on. Something is breathing behind a parked car you just passed. Then it chases you, lunging every few seconds. The road narrows into a canyon; streetlights (their lines sparking), dead trees and whole house fronts fall across it; pieces of the sky come down (watch for their shadows); cars come out of the dark, swerve, crash and burn. Jump what is low, go round what is high. If it catches you, you go back to the last checkpoint.
   - At the end, the road gives way in front of you. There is only room for one of you. While the thing creeps closer, Danny says goodbye: it was never your fault; tell Lily he is not in the heater. He throws Biscuit across in slow motion with the lullaby playing. In mid-air you turn and watch the thing take him, and the tear closes white around you.
10. **Wake them.** You come to in front of the furnace, which is cold and quiet now, and you understand every word. Bark at or nudge Tom (in his armchair), Claire and Lily (in their beds). They are deep under: it takes several tries each, and they come up through dreams of Danny. When all three are up, they follow you, and you lead them out of the front door into the snow.

**Why Danny died, and why the furnace was never checked.** It all comes out through hall photographs, Claire's letter, Danny's room, the clipping and the tag. **Danny is not the monster.** He is a warm, gold figure who guides you. The thing that chases you is the furnace's poison, given a shape by a poisoned dog's mind, and the game tells you so the first time you see it.

## What's in the prototype

**Look and feel**
- Everything is modelled as the thing it is, not a painted box:
  - Your tennis ball has its wrapping white seam, the crayons have tips and paper wrappers, the key has its bow, teeth and ribbon, the red tag has its eyelet and string, the 9V battery has its terminals, and the flashlight has a flared head and lens.
  - Coats hang by their shoulders, and boots and sneakers have soles and toes.
  - The couch and armchair have rolled arms and legs, the coffee table has a shelf, the bookshelf holds individual books, the stockings are sock-shaped, the Christmas tree is a real tree with ornaments, and your bed is round.
  - The kitchen has a sink with a faucet, a dish rack, a kettle with a spout, a radio with an antenna, round pill bottles, spindle-backed chairs, full place settings, a wall phone with a coiled cord and a pedal bin.
  - In the bedrooms there are bed posts and plump pillows, dressers and nightstands with drawers and knobs, a teddy bear with ears and a muzzle, a dollhouse with a roof and a toy truck with wheels.
  - The washer and dryer have round glass doors.
  - In the basement: a water heater cylinder, a pegboard of tools, round jars, a real bicycle and a hockey stick.
- The scene renders at 360 lines (300 on phones) and the fog starts further away, so things stay readable across a room.
- Solid things have depth: every plain-coloured or wood, fabric or metal prop has bevelled edges that catch the light, and the house is full of real parts (cabinet doors with knobs and drawer fronts, the fridge's handles and freezer seam, the stove's oven door, knobs and burner rings, a deep CRT television with knobs, raised panels on every door, bars and frames on every window, lamp shades, back cushions on the couch, light switches and outlets).
- A frightening title screen: the dark hall at dog height, the title flickering and bleeding red over a heartbeat-pulsing vignette, and at the far end of the hall something standing. Every time the screen flickers, it is a little closer.
- Things you can pick up catch the light, with small glints rising off them, so you can find them on the floor.
- A custom PS1-style renderer. Lighting and fog are per-vertex (Gouraud) and textures are low-resolution with crunchy nearest-neighbour filtering. The scene renders at 240p and is upscaled, with 15-bit colour and 4×4 ordered dithering. Geometry and textures are rock-steady, with no jitter or warping.
- Thick, dark fog swallows the far end of every room.
- Carbon-monoxide effects build up over the night: double vision, chromatic split, tunnel vision, a vignette that pulses with your heartbeat, faces that go wrong, and brief blackouts.
- All 60+ textures are painted procedurally on canvas: wallpapers, the farmhouse floors, faces, the daughter's drawings, the calendar with tomorrow circled, the thermostat cranked to 78.

**The house**
- Entry, living room, kitchen, hall, three bedrooms, the laundry room, a stairwell and a basement full of Danny's boxes.
- Framed photographs line the hall: six painted prints (the lake, Danny's school portrait, the puppy, Christmas, his 13th birthday by candlelight, the summer the house was painted). Each has faces with eyes, brows and teeth, flash lighting and a date stamp, and sits in a wooden frame with a cream mat and a glint on the glass. Look closer at any of them for Biscuit's memory of that day.
- Every room holds details that tell the story. There are four stockings and four place settings, one of each still for Danny. His sneakers are still on the boot tray. Sympathy cards sit on the coffee table. The CO detector's LED is dark, and its battery lies on the floor below it. A dollhouse of the farmhouse has a little figure in its basement. Lily's drawing puts Danny *under the house*.

**The family**
- **Retro-realism.** The family are jagged, faceted low-poly meshes wearing photographic textures: painted faces with harsh camera-flash lighting, oily skin sheen, pores, moles, broken capillaries, bloodshot eyes with detailed irises and lashes, and fabric textures with weave and folds. The realism of the skin on blocky heads is what makes them wrong.
- **Real skinned bodies.** Each character is one continuous mesh deformed by a 12-bone skeleton, the way real games build characters, rather than floating parts. Shoulders grow out of the torso with deltoids and a trapezius slope, legs grow out of the pelvis, and elbows and knees bend with the skin stretching across them. The torsos are sculpted (chest, waist, hips, buttocks, bust), and the limbs taper realistically with thighs, calves and forearms. Proportions are still almost right: torsos slightly tall, arms long enough that the hands hang near the knees, necks a touch long. The thing in the basement is the same body, stretched further.
- **PS1 NPC movement.** Limbs update in stiff steps at about 8 frames a second while the body slides smoothly underneath, so the feet don't match the speed. Heads snap to look at you with no easing, turns happen in jumps, and everyone has random twitches: head jerks, shoulder spasms, flinches and tilts, more often as the poison builds.
- Faces blink, close in sleep, and have a "wrong" version: pale skin, fully black eyes, a hanging mouth and veins.
- Tom, Claire and Lily walk the house on a schedule that runs through the evening, bedtime, the slow poisoning, and sleep that turns into something worse.
- **Speech you slowly learn.** Lines are voiced by formant synthesis and run through a garbler that shows only the words Biscuit knows. The vocabulary grows with each solved puzzle, and the voices get less muffled as he understands more.
- They react to you. Barking adds strikes and three strikes get you locked in the laundry room. Whining earns forgiveness. Tugging a sleeve makes them follow you. Every object has a reaction from each person.

**Horror: nothing happens on its own. You set it off.**
No scare fires on a timer or at random. Every scare is set off by something you do, and each one happens only once, so the house reacts to you.

| You... | ...and this happens, once |
| --- | --- |
| push the step stool | the lights flicker out, and when they come back something is standing in the corner of the room |
| lie down near a bed | two eyes look back at you from underneath it |
| lie down in your own bed, at night | Danny's ball comes bouncing out of the dark to you |
| wag your tail near the family | they all stop and stare at you at once, without blinking |
| land on the kitchen counter | the phone rings once, and stops |
| pick the key out of the broken jar | heavy footsteps behind you, then breathing |
| close Danny's notebook | something knocks back from under the floor |
| close Claire's letter | her voice calls you from a dark room she isn't in |
| sniff in the hall at night | small wet boot prints appear, from the front door to the basement door |
| bark near the open basement door | something whispers your name from the stairs |
| nudge Tom while he's deep asleep | he gets up and stands at the end of the hall facing the wall, then turns to look at you with nobody behind his eyes |
| pick up Danny's tennis ball | the TV switches itself on to a face |
| scratch Danny's locked door | a light comes on underneath it, and footsteps |
| scratch the front door at night | something outside knocks back, three times |
| push a door open | another one eases shut somewhere else |
| go down into the basement | a lullaby from the dark |
| look at a photo after the power goes | every face in every frame along the hall changes |
| stare at someone for a couple of seconds once the poison is in *you* (your vision doubles and the edges pulse dark; a card tells you when) | their face goes wrong |

**The thing from the furnace** only comes when you call it by what you do: when you take Danny's jacket or the red tag in the basement (it chases you up the stairs), when you take Danny's flashlight in the dark, and when you carry the jacket up into the house. Then it walks the dark rooms, its steps and breathing coming closer and its grey smell drifting ahead of it (follow THE BAD AIR to see where it is). You can outrun it, but not by walking. Hide by lying still in the dark (under the kitchen table or a bed is safest; not with the flashlight in your mouth). Bark at it face to face and it comes apart like smoke. If it catches you, you black out, drop what you carried and lose time; the third time is the UNDER THE HOUSE ending.

Lightning is just weather: the flash and the thunder.

**Doors** you can push open just by walking into them (the parents' and Lily's doors start closed), and they open for the family as they walk through. Danny's door stays locked until Lily unlocks it; the basement door stays hooked until she unhooks it.

- A drone sits under everything, slightly out of tune with itself, rising with the poison.
- A furnace that breathes, its grille growing teeth as the night goes on.

**Sound**
- Every sound is synthesised in WebAudio and placed in 3D, modelled on how the real sound is made. Barks are formant-filtered bursts with a chest thump. Creaks and scratches are stick-slip impulse trains through wood resonances. Knocks excite a resonant body. Footsteps are paw pads with nail clicks, or a heel and toe with the odd floorboard creak. Voices have three vowel formants and consonants. There's also the CO alarm's real temporal pattern, the latch rattle, eating, the drawer, paper, and the furnace breathing through a vent like a voice.
- Biscuit's own body has sounds too: sniffing in short bursts, a growl and teeth snapping on a bite, a thump and a long sigh when you lie down, claws raking snow when you dig, snow squeaking underfoot, the dog flap slapping shut behind you, and collar tags jingling when you shake off the snow. The wind is louder outside.
- **The world goes on around you.** Outside there are owls in the pines, a coyote far across the fields, a neighbour's dog a long way off and the wind chimes on the back porch. Inside, doors open and close in other rooms, the toilet flushes, Claire clinks dishes at the sink, and the pipes groan. Through the evening Tom, Claire and Lily talk to each other in the next room (about the roads, the tree they haven't put up, where the big flashlight is). You only catch the words if you are close. The wind is soft low gusts indoors and a howl around the eaves outside, rather than a hiss.
- Biscuit's own sounds are kept soft and natural: one low round "boof" of a bark, a short quiet whimper for the whine, a soft pad on every other step with no clicking claws, and a wag that is silent unless your tail thumps the floor. Thunder is a deep, slow rumble rather than a burst of noise.
- The family can't walk through walls: they follow the doorways, and if they ever get stuck they find a new way round.
- As the poison takes hold, the whole mix gets muffled.

## The thing in the basement: five shapes

Pick the shape the thing from the furnace takes on the title screen (THE THING IN THE BASEMENT: 1 to 5), or with `?monster=N` in the URL. The choice is remembered; the default is 4, The Crawler. **▶ start on the other side** on the title screen jumps straight into chapter 9. **▶ start in the basement, with it** on the title screen drops you straight into the basement as it climbs out of the furnace, with the stairs door open. It comes back every time you go back down.

| # | Name | What it is |
| --- | --- | --- |
| 1 | **The Hollow Man** | Nine feet of burnt, cracked skin over glowing ribs. Its jaw hangs open to its chest. Ember eyes. Its head tilts slowly sideways, then snaps back. |
| 2 | **The Breather** | The furnace itself, walking on six duct legs. The grille is a mouth full of teeth that opens with every breath, with fire inside and pilot-light eyes. |
| 3 | **Wrong Danny** | A tall figure in Danny's soaked hoodie. No face, only a mouth that runs from forehead to chin. Its head turns all the way round. |
| 4 | **The Crawler** | Bent over backwards and skittering fast on all fours. Its head hangs upside down at dog height, grinning to the ears. |
| 5 | **The Smoke Family** | A column of black smoke with the family's pale faces pressing out of it, mouths stretching, and too many arms. |

Each one moves in stiff, stepped frames with sudden snaps, has its own walk, hunt and catch animation, and when it catches you its face is pushed right into yours.

## Family animation

The family carry things in their hands: the woman fetches the dog food and brings your bowl back, the man reads his newspaper in the armchair and turns the pages, and Lily draws with a crayon on the floor. When you sit or wag your tail near them they crouch down and pat your head. She reaches up to the thermostat. Now and then they stretch or shiver, and once the air goes bad they rub at their headaches.

## Achievements (26)

Shown with a toast when you earn them, listed on the title screen (**achievements**), and saved in your browser. "Forget everything" resets them with the endings.

Good Boy · Everybody Pets the Dog · Counter Surfer · King of the Table · Zoomies · Play Dead · Speak! · Cold Nose · Shake It Off · Best Digger in Cutter County · The Long Way Round · The Nose Knows · Family Album · Good Listener · Like Smoke · Under the Bed · Wrong Tail · Second Wind · Through the Fire · Carried · Everybody Up · Untouchable · Down to the Wire · Home · He Still Waits · Know Your Monsters

## Endings (6)

| # | Ending | How |
| --- | --- | --- |
| 1 | **GOOD BOY** | Do what they tell you and sleep in your bed, or let the night run out |
| 2 | **THE LONG WAIT** | Be by the front door when the night ends |
| 3 | **THE LAUNDRY ROOM** | Be locked in the laundry room (under its cracked window) when the night ends |
| 4 | **BAD DOG** | Bite one of them once the poison is strong |
| 5 | **HOME** *(true ending)* | Come back from the other side, wake all three of them, and lead them out of the front door |
| 6 | **UNDER THE HOUSE** | Let the thing from the furnace catch you three times |

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
| `js/touch.js` | touch controls for phones and tablets: joystick, drag to look, on-screen buttons |
| `js/fx.js` | visible particles: falling snow, snow thrown by digging, breath, the pipe's steam |
| `js/audio.js` | procedural audio |
| `js/story.js` | chapters, puzzles, vocabulary, reactions, scares, the presence and the stalker, the flashlight, endings, the rewind |
| `js/dread.js` | the scares: each one set off by something you do, once |
| `js/lore.js` | Danny's room, photographs, letters, the clipping and tag, puzzle props |
| `js/other.js` | the other side: the wrong street, the dead family, the yellow house, the tear, Danny, the chase and the throw |
| `js/director.js` | the director (menace gauge, pacing) and the thing's senses: hearing, sight, roaming, investigating, searching, ambushing |
| `js/monster.js` | the five shapes of the thing from the furnace, and their animation |
| `js/achievements.js` | achievements: the list, toasts, saving |
| `js/main.js` | bootstrap, title screen and render loop |

`vendor/three.module.js` is three.js r160 (MIT, see `vendor/THREE_LICENSE`).
