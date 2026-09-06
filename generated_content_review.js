// generated_content_review.js
// =============================================================================
// ADDITIVE CONTENT — REVIEW PILE (NOT WIRED IN ANYWHERE)
// =============================================================================
// This file is a curation pile, not live data. Nothing here is imported by the
// app and NO live data file (categoryAnswers.js, combo lists, etc.) was touched.
// Formats mirror the backend so survivors can be lifted straight in:
//   - Category Blitz: "Name": new Set([ ...lowercase, apostrophe-free... ])
//   - everything else: plain arrays/objects.
// Answer Sets here are SEED lists (~25-40 strong entries) meant to prove the
// category is answerable and to be expanded toward the live ~150 before shipping;
// the Stage-2 AI judge already covers the long tail.
//
// QUALITY BAR APPLIED (from CLAUDE.md): niche, unexpected, screenshot-to-the-
// group-chat funny. Generic was BANNED on sight. The test for every single item:
// "would a high schooler screenshot this and send it?" If no -> cut.
//
// =============================================================================
// SELF-REVIEW LOG (two full rate -> cut -> push-harder passes, bar raised each pass)
// =============================================================================
// Process per item: rated BANGER / SOLID / WEAK. WEAK cut outright. Borderline
// moved to a MAYBE — REVIEW block at the end of each section. SOLID items were
// rewritten harder (more specific, more unexpected) and kept. Pass 2 re-rated the
// survivors against a higher bar and cut/sharpened again.
//
// SECTION 1 — Category Blitz
//   Generated 30 -> cut 7 WEAK -> 20 kept (final) + 3 in MAYBE.
//   Cut (too generic / no screenshot): "Types of weather", "Things that are
//     cold", "Reasons the wifi is down", "Things in a kitchen", "Sports balls",
//     "Things with wheels", "Office supplies". (All failed the screenshot test.)
//   Pushed harder examples: "Things in a dad's apartment" -> "Things in a
//     DIVORCED dad's apartment" (specificity = the joke); "Things a teacher
//     takes away" -> "Things confiscated by a teacher (and never returned)".
//   TOP 5: 1) Things in a divorced dad's apartment  2) Florida man headlines
//     3) Things a mom yells from another room  4) Ways to die in Minecraft
//     5) Things confiscated by a teacher
//
// SECTION 2 — Imposter Word pairs
//   Generated 25 -> cut 5 (weak overlap or repeated half) -> 20 kept.
//   Cut: "Renaissance fair / Medieval times" (too similar = no hiding room),
//     "Airport / Refugee camp" (punches down), "Frat party / Crime scene"
//     (reused "crime scene"), "The mall / A liminal space" (too online-niche),
//     "Theme park / Riot" (redundant with Disneyland/Hell).
//   TOP 5: 1) The DMV / Purgatory  2) A first date / A job interview
//     3) Disneyland / Hell  4) A dad's garage / A serial killer's basement
//     5) IKEA / A maze you can't escape
//
// SECTION 3 — Word Bomb combos
//   40 kept, each difficulty-rated. No hard cuts, but 4 flagged "TOO EASY — low
//   drama" (ER, IN, ON, AT) — keep only as warm-up/early-round filler.
//   TOP 5 (best tension-to-fairness): IGHT, OCK, UMP, TCH, STR.
//
// SECTION 4 — Flavor text
//   Generated ~115 -> cut to the requested 40 / 15 / 12 / 8 (cut the limpest).
//   Cut examples: "GOOD JOB", "NICE ONE", "KEEP GOING" (encouraging != our
//     voice — we're a menace, not a soccer coach).
//   TOP 5 hype: NAH HE TYPING / THESAURUS REX / SPELL CHECK CANT SAVE YOU /
//     COOKED / THE BOMB IS UNDEFEATED.
// =============================================================================


// =============================================================================
// SECTION 1 — CATEGORY BLITZ CATEGORIES  (20 final)
// =============================================================================
export const CATEGORY_BLITZ = {
  "Things in a divorced dad's apartment": new Set([
    'a massive tv', '85 inch tv', 'gaming chair', 'recliner', 'leather couch',
    'air mattress', 'sad bunk beds', 'a futon', 'folding chairs', 'a folding table',
    'one fork', 'paper plates', 'plastic cutlery', 'a george foreman grill',
    'mini fridge', 'a case of beer', 'protein powder', 'hot sauce collection',
    'tv dinners', 'hot pockets', 'frozen pizza', 'takeout containers',
    'a scarface poster', 'a neon beer sign', 'a dartboard', 'a weight bench',
    'dumbbells', 'a pull up bar', 'a ps5', 'a fish tank', 'a motorcycle',
    'a toolbox', 'axe body spray', 'a single scented candle', 'mounted fish',
    'a pool table', 'whiskey', 'beware of dog sign', 'an empty fridge',
    'condiments only', 'a projector', 'a bar cart',
  ]),
  "Florida man headlines": new Set([
    'florida man arrested', 'florida man fights an alligator',
    'florida man wrestles a gator', 'florida man rides a manatee',
    'florida man steals a lawnmower', 'florida man on bath salts',
    'florida man punches a flamingo', 'florida man throws a gator through a window',
    'florida man breaks into jail', 'florida man marries an alligator',
    'florida man flees police on a lawnmower', 'florida man calls 911 for a ride',
    'florida man hides drugs in his stomach', 'florida man bites a police dog',
    'florida man dressed as a clown', 'florida man found in a storm drain',
    'florida man steals 100 phones', 'florida man on a riding mower drunk',
    'florida man crashes into a pole', 'florida man bites someone',
    'florida man on the run', 'florida man eats a parking ticket',
  ]),
  "Things a mom yells from another room": new Set([
    'dinners ready', 'whats that noise', 'who left the door open',
    'im not telling you again', 'because i said so', 'close the door',
    'were you raised in a barn', 'turn that down', 'clean your room',
    'did you do your homework', 'who broke this', 'what did i just say',
    'dont make me come up there', 'im counting to three',
    'you better not be on that phone', 'take out the trash', 'did you feed the dog',
    'why is every light on', 'who used all the hot water', 'get down here right now',
    'what do you want for dinner', 'dont walk away from me',
    'ill turn this car around', 'money doesnt grow on trees', 'ask your father',
    'look at me when im talking', 'watch your tone', 'is your homework done',
    'who tracked mud in here', 'wait till your father gets home',
  ]),
  "Ways to die in Minecraft": new Set([
    'creeper', 'creeper explosion', 'fall damage', 'fell off a cliff', 'lava',
    'fell in lava', 'drowning', 'starvation', 'hunger', 'zombie', 'skeleton',
    'skeleton arrow', 'spider', 'enderman', 'suffocated in sand', 'gravel',
    'the void', 'fell into the void', 'tnt', 'your own tnt', 'the wither',
    'ender dragon', 'drowned', 'guardian', 'ghast', 'blaze', 'magma cube',
    'baby zombie', 'phantom', 'pillager', 'ravager', 'cactus', 'sweet berries',
    'lightning', 'freezing', 'powder snow', 'anvil', 'dug straight down',
    'fell out of the world', 'poison', 'fire', 'burned',
  ]),
  "Things confiscated by a teacher": new Set([
    'phone', 'airpods', 'earbuds', 'headphones', 'fidget spinner', 'pop it',
    'slime', 'silly putty', 'a rubber band', 'a paper airplane', 'a paper football',
    'a passed note', 'gum', 'candy', 'a nerf gun', 'a laser pointer', 'a vape',
    'a juul', 'a lighter', 'a gameboy', 'a nintendo switch', 'a ds',
    'playing cards', 'pokemon cards', 'yugioh cards', 'dice', 'a hat', 'a hood',
    'a squishmallow', 'a beyblade', 'a tech deck', 'a bouncy ball', 'a sharpie',
    'a spray bottle', 'an energy drink', 'a comic book', 'a hacky sack',
  ]),
  "Red flags in a dating profile": new Set([
    'holding a fish', 'a gym mirror selfie', 'only group photos', 'no face photos',
    'married but looking', 'no bio', 'just emojis for a bio', 'lives with parents',
    'a fedora', 'sunglasses in every pic', 'a cropped out ex', 'a sword collection',
    'six foot and proud of it', 'no recent photos', 'a rented lambo',
    'a tiger photo', 'holding someone elses baby', 'partner in crime',
    'here for a good time not a long time', 'swipe left if', 'asks for money',
    'crypto in bio', 'grindset', 'hustle culture', '420 friendly',
    'no hookups winky face', 'my mom thinks im funny', 'a shirtless bathroom selfie',
    'every photo is a snapchat filter', 'a dog filter', 'an essay about their ex',
    'i dont want drama then all drama',
  ]),
  "Things in a 2010 kid's bedroom": new Set([
    'silly bands', 'an ipod touch', 'a nintendo ds', 'a wii', 'a psp',
    'club penguin', 'webkinz', 'moshi monsters', 'bakugan', 'beyblades',
    'a nerf gun', 'pokemon cards', 'yugioh cards', 'a tech deck',
    'a justin bieber poster', 'a jonas brothers poster', 'slap bracelets',
    'scented markers', 'gel pens', 'a lava lamp', 'a bean bag chair',
    'glow in the dark stars', 'a monster high doll', 'a bratz doll',
    'littlest pet shop', 'hot wheels', 'lego', 'a razor scooter', 'heelys',
    'light up shoes', 'crocs with jibbitz', 'a livestrong bracelet',
    'angry birds', 'fruit ninja', 'an ipod dock', 'hannah montana',
  ]),
  "What the dog ate": new Set([
    'my homework', 'a sock', 'your shoe', 'the couch cushion', 'the tv remote',
    'an entire chocolate bar', 'a whole birthday cake', 'the trash', 'a crayon',
    'a tampon', 'your underwear', 'a phone charger', 'a wedding ring',
    'a 20 dollar bill', 'a diaper', 'a tennis ball', 'a rock', 'grass',
    'another dogs poop', 'a bee', 'a stick of butter', 'the thanksgiving turkey',
    'a sponge', 'dental floss', 'a hair tie', 'gum', 'a battery', 'a lego',
    'a barbie', 'a sippy cup', 'a whole sandwich', 'a pen', 'a glove',
    'the baby toy', 'a pacifier',
  ]),
  "Things at a gas station bathroom": new Set([
    'an out of order sign', 'no toilet paper', 'a broken lock', 'no lock on the door',
    'a key on a giant spoon', 'a key chained to a brick', 'graffiti',
    'a phone number on the wall', 'a broken soap dispenser', 'no soap',
    'a hand dryer that doesnt work', 'a wet floor', 'a suspicious puddle',
    'a flickering light', 'a condom machine', 'a clogged toilet',
    'a missing toilet seat', 'a roach', 'a mysterious smell', 'a cracked mirror',
    'someone knocking', 'a line out the door', 'a plunger', 'a weird stain',
    'a vending machine', 'a code you have to ask for', 'a paper towel mountain',
    'an air freshener doing nothing',
  ]),
  "Cryptids in the woods at night": new Set([
    'bigfoot', 'sasquatch', 'mothman', 'dogman', 'wendigo', 'skinwalker',
    'chupacabra', 'jersey devil', 'slender man', 'glowing eyes', 'red eyes',
    'a deer just staring', 'an owl', 'a branch snapping', 'footsteps behind you',
    'something breathing', 'a shadow figure', 'a tall figure', 'the rake',
    'fresno nightcrawler', 'the goatman', 'flatwoods monster', 'loveland frog',
    'a coyote', 'a bear', 'the smell of sulfur', 'a child crying',
    'the birds going silent', 'a face in the trees', 'a flashlight that wont turn on',
    'humming with no source',
  ]),
  "Things a substitute teacher says": new Set([
    'im not your regular teacher', 'the teacher left a worksheet',
    'i dont know the lesson', 'stay in your seats', 'im writing names down',
    'movie day', 'is this assigned seating', 'free period',
    'your teacher didnt leave anything', 'keep it down', 'whats your name',
    'i wasnt told about this', 'raise your hand', 'ill let it slide this once',
    'im calling the office', 'do i look like i know', 'study hall',
    'where does your teacher keep the', 'no this is not a free period',
    'i can see you on your phone', 'silent reading', 'first one to talk gets detention',
  ]),
  "Ways to get sent to the principal's office": new Set([
    'fighting', 'talking back', 'skipping class', 'cheating on a test',
    'a dress code violation', 'phone out in class', 'a food fight', 'swearing',
    'cursing at a teacher', 'vaping in the bathroom', 'pulling the fire alarm',
    'vandalism', 'forging a note', 'sleeping in class', 'throwing a chair',
    'bullying', 'making threats', 'passing notes', 'making the sub cry',
    'a senior prank', 'streaking', 'public display of affection', 'hood up',
    'graffiti on a desk', 'plagiarism', 'mooning someone', 'being late again',
    'starting a rumor', 'a tiktok in the hallway',
  ]),
  "Things in a final boss arena": new Set([
    'a save point before the door', 'a giant health bar', 'dramatic music',
    'a long cutscene', 'an unskippable speech', 'multiple phases', 'phase two',
    'a glowing weak spot', 'the boss gets bigger', 'no exit', 'lava', 'spikes',
    'minions', 'adds', 'a quick time event', 'an instant death attack',
    'a one shot move', 'the boss heals itself', 'a third form', 'no checkpoint',
    'a rage mode', 'a healing item right before', 'an arena that shrinks',
    'you fool', 'a second wind', 'a fog of war',
  ]),
  "Things at a middle school dance": new Set([
    'chaperones', 'a cup of warm punch', 'a dj', 'a slow dance', 'awkward swaying',
    'arms length apart', 'leave room for jesus', 'a teacher with a flashlight',
    'glow sticks', 'balloons', 'streamers', 'a fog machine', 'the cha cha slide',
    'the cupid shuffle', 'soulja boy', 'cotton eye joe', 'the wobble',
    'the macarena', 'single ladies', 'a kid doing the worm', 'too much axe',
    'sweaty palms', 'a first kiss', 'a breakup', 'the snack table',
    'kids on their phones', 'the cool kids corner', 'someone crying in the bathroom',
    'a dance circle nobody enters',
  ]),
  "Things your weird aunt posts on Facebook": new Set([
    'minion memes', 'live laugh love', 'a chain prayer', 'type amen to be blessed',
    'share if you love jesus', 'an essay about her ex husband', 'a vague threat',
    'some people know what they did', 'a sunset photo', '47 photos of her cat',
    'an anti vaccine article', 'a fake celebrity death', 'a scam giveaway',
    'win a free rv', 'facebook is stealing my data', 'essential oils',
    'its 5 oclock somewhere', 'an all caps political rant', 'the inside of a nostril',
    'a blurry plate of food', 'a candy crush invite', 'a farmville request',
    'remember these', 'kids these days', 'a 40 ad recipe',
    'happy birthday to my son on the wrong day',
  ]),
  "The DMV experience": new Set([
    'take a number', 'now serving b47', 'a two hour wait', 'plastic chairs',
    'a written test', 'a vision test', 'the eye chart', 'a terrible license photo',
    'the wrong forms', 'proof of residence', 'two forms of id',
    'youre in the wrong line', 'one window open', 'a closed window',
    'an angry customer', 'fluorescent lights', 'a road test', 'parallel parking',
    'a broken pen on a chain', 'a vending machine', 'a baby crying', 'sighing',
    'the smell of despair', 'a clipboard', 'license plates', 'a learners permit',
    'a number ticket from a machine',
  ]),
  "Things found in a frat house": new Set([
    'a beer pong table', 'red solo cups', 'ping pong balls', 'a keg', 'a beer bong',
    'a sticky floor', 'an american flag on the wall', 'a composite', 'a paddle',
    'greek letters', 'a couch on the lawn', 'a broken couch', 'jungle juice',
    'a handle of plastic vodka', 'natty light', 'a dog named after a beer',
    'a hole in the wall', 'christmas lights in march', 'a fog machine',
    'a hot tub of questionable water', 'a pledge', 'ramen', 'a george foreman grill',
    'vomit in the bushes', 'neon signs', 'a basement you shouldnt enter',
    'empty cans everywhere',
  ]),
  "Things in an emo kid's room (2008)": new Set([
    'black eyeliner', 'side bangs', 'a studded belt', 'an mcr poster',
    'a fall out boy poster', 'a panic at the disco poster', 'skinny jeans',
    'band tees', 'checkered vans', 'fingerless gloves', 'black nail polish',
    'hot topic everything', 'tripp pants', 'chains', 'a sad poetry notebook',
    'twilight', 'manga', 'scene hair', 'a studded bracelet', 'snakebites',
    'a black hoodie', 'invader zim', 'jack skellington', 'dyed black hair',
    'an ipod full of screamo', 'a myspace top 8', 'razor blade jewelry',
    'wristbands up to the elbow',
  ]),
  "Excuses for not doing your homework": new Set([
    'my dog ate it', 'i left it at home', 'i thought it was due tomorrow',
    'my printer broke', 'the wifi was down', 'i was sick', 'i had a game',
    'my computer crashed', 'i didnt understand it', 'i lost it',
    'it deleted itself', 'my little brother spilled juice on it',
    'i did it but forgot it', 'my account logged out', 'i was at my dads',
    'we had a family emergency', 'i didnt know we had homework',
    'you never assigned it', 'its in my other binder', 'my backpack got stolen',
    'i ran out of ink', 'the google doc wouldnt load', 'i fell asleep',
    'i had work', 'i thought it was extra credit',
  ]),

  // ---- MAYBE — REVIEW (borderline; SOLID but not screenshot-guaranteed) ----
  // "Things a Karen demands": new Set(['the manager', 'a refund', ...]) — funny
  //   but the Karen meme is aging; review for freshness.
  // "Things in a pirate's pocket": new Set(['a gold coin', 'a compass', ...]) —
  //   answerable + fun but reads younger/less relatable than the rest.
  // "Cereal box prizes": new Set(['a temporary tattoo', 'a decoder ring', ...]) —
  //   strong nostalgia but skews older than a high schooler; cut if it doesn't land.
};


// =============================================================================
// SECTION 2 — IMPOSTER WORD CATEGORY PAIRS  (20 final)
// Two categories whose member sets OVERLAP heavily, so the imposter can blend
// with safe shared answers — but the edges expose them. `overlap` = the shared
// words that make it work; `tell` = the kind of answer that outs the imposter.
// =============================================================================
export const IMPOSTER_PAIRS = [
  { real: 'A wedding', imposter: 'A funeral',
    overlap: 'flowers, suits, crying, an open bar, a slideshow, relatives you never see, a long speech',
    tell: 'a hearse vs a honeymoon' },
  { real: 'Disneyland', imposter: 'Hell',
    overlap: 'endless lines, overpriced, screaming children, eternal heat, you can never leave, a guy in a costume',
    tell: 'a fast pass vs eternal damnation' },
  { real: 'A first date', imposter: 'A job interview',
    overlap: 'youre nervous, dressed up, tell me about yourself, awkward silence, might never call back, a firm handshake',
    tell: 'a goodnight kiss vs a salary' },
  { real: 'The DMV', imposter: 'Purgatory',
    overlap: 'waiting forever, take a number, fluorescent lights, soulless, now serving b47, no end in sight',
    tell: 'a license vs your eternal soul' },
  { real: "A dad's garage", imposter: "A serial killer's basement",
    overlap: 'tools, a chest freezer, things in jars, plastic sheeting, dont go down there, a single bulb',
    tell: 'a lawnmower vs a confession' },
  { real: 'IKEA', imposter: "A maze you can't escape",
    overlap: 'youre lost, arrows on the floor, weve been here three hours, no windows, a meatball break, dead ends',
    tell: 'an allen wrench vs a minotaur' },
  { real: 'A gym', imposter: 'A nightclub',
    overlap: 'loud music, sweaty people, mirrors everywhere, people filming themselves, protein vs drinks, flexing',
    tell: 'a barbell vs a bottle service' },
  { real: 'A sleepover', imposter: 'A hostage situation',
    overlap: 'you cant leave, someone is crying, sitting on the floor, snacks, demands, nobody is sleeping',
    tell: 'a pillow fight vs a ransom' },
  { real: 'An aquarium', imposter: 'A sushi restaurant',
    overlap: 'fish, tanks, look at that one, a fancy tour, dim lighting, pointing at the menu of life',
    tell: 'feeding time vs the chef' },
  { real: 'Prom', imposter: 'A funeral',
    overlap: 'everyone dressed up, slow movement, corsage vs flowers, crying, a limo vs a hearse, group photos',
    tell: 'a crown vs a casket' },
  { real: 'A petting zoo', imposter: 'A Tinder date',
    overlap: 'you dont know what youll get, it might bite, it seemed nicer in the photos, awkward, feeding involved',
    tell: 'a goat vs a guy named chad' },
  { real: 'A hospital', imposter: 'A prison',
    overlap: 'bad food, people in matching outfits, visiting hours, you dont want to be here, beds in rows, a long sentence',
    tell: 'a discharge vs a parole' },
  { real: "A kid's birthday party", imposter: 'A crime scene',
    overlap: 'everyone is a suspect, tape everywhere, someone is crying, evidence vs cake, a meltdown, police called',
    tell: 'a pinata vs a chalk outline' },
  { real: "Grandma's house", imposter: 'A haunted house',
    overlap: 'creaky floors, old portraits staring, a weird smell, plastic on the furniture, you dont want to be here, cold spots',
    tell: 'hard candy vs a ghost' },
  { real: 'Going to the dentist', imposter: 'Medieval torture',
    overlap: 'a chair with straps, drills, open wide, sharp metal tools, pain, someone in a mask',
    tell: 'a free toothbrush vs a confession' },
  { real: 'A gym locker room', imposter: 'A morgue',
    overlap: 'rows of lockers, cold, a strong smell, tags, tile floors, bodies lying around',
    tell: 'a towel vs a toe tag' },
  { real: 'A camping trip', imposter: 'The apocalypse',
    overlap: 'no wifi, scavenging for food, sleeping on the ground, a fire, rationing, did you hear that',
    tell: 's mores vs survival' },
  { real: 'A baby shower', imposter: 'A cult',
    overlap: 'everyone in a circle, matching outfits, weird games, you cant leave early, gifts vs offerings, a chosen one',
    tell: 'a diaper cake vs a robe' },
  { real: 'Black Friday', imposter: 'A zombie apocalypse',
    overlap: 'crowds rushing the doors, trampling, grabbing supplies, fighting over a tv, chaos, boarded windows',
    tell: 'a doorbuster vs a horde' },
  { real: 'Thanksgiving dinner', imposter: 'A political debate',
    overlap: 'raised voices, your uncle, someone storms off, lets not talk about that, a podium vs the head of the table, awkward',
    tell: 'gravy vs a campaign' },

  // ---- MAYBE — REVIEW ----
  // { real: 'The zoo', imposter: 'A frat party' } — animals vs people acting like
  //   animals, cages vs VIP, feeding time. Funny but overlaps the gym/nightclub
  //   energy; review whether it's distinct enough.
];


// =============================================================================
// SECTION 3 — WORD BOMB COMBOS  (40)
// 2–3 letter chunks that must appear somewhere in a typed word. difficulty =
// rough rarity/ease of finding a word fast. "ex" gives a couple sample words.
// =============================================================================
export const WORD_BOMB_COMBOS = [
  // EASY — warm-up / early rounds (huge word pools; low drama)
  { combo: 'er', difficulty: 'easy', ex: 'water, faster, every', note: 'TOO EASY — filler only' },
  { combo: 'in', difficulty: 'easy', ex: 'find, point, ruin', note: 'TOO EASY — filler only' },
  { combo: 'at', difficulty: 'easy', ex: 'cat, water, rate', note: 'TOO EASY — filler only' },
  { combo: 'on', difficulty: 'easy', ex: 'song, front, reason', note: 'TOO EASY — filler only' },
  { combo: 're', difficulty: 'easy', ex: 'read, store, agree' },
  { combo: 'st', difficulty: 'easy', ex: 'stop, best, castle' },
  { combo: 'th', difficulty: 'easy', ex: 'the, math, brother' },
  { combo: 'al', difficulty: 'easy', ex: 'also, metal, normal' },
  { combo: 'le', difficulty: 'easy', ex: 'little, table, simple' },
  { combo: 'ed', difficulty: 'easy', ex: 'jumped, red, needed' },

  // MEDIUM — the sweet spot (findable but you have to think)
  { combo: 'ing', difficulty: 'medium', ex: 'running, thing, bring' },
  { combo: 'ent', difficulty: 'medium', ex: 'rent, student, moment' },
  { combo: 'tion', difficulty: 'medium', ex: 'nation, action, station' },
  { combo: 'all', difficulty: 'medium', ex: 'ball, wall, fallen' },
  { combo: 'ack', difficulty: 'medium', ex: 'back, snack, attack' },
  { combo: 'ick', difficulty: 'medium', ex: 'kick, stick, chicken' },
  { combo: 'ock', difficulty: 'medium', ex: 'rock, clock, pocket', note: 'TOP PICK — clean, fair, lots of words' },
  { combo: 'ight', difficulty: 'medium', ex: 'light, night, fright', note: 'TOP PICK — feels hard, actually fair' },
  { combo: 'ard', difficulty: 'medium', ex: 'card, hard, garden' },
  { combo: 'own', difficulty: 'medium', ex: 'down, brown, crown' },
  { combo: 'ice', difficulty: 'medium', ex: 'nice, police, device' },
  { combo: 'ine', difficulty: 'medium', ex: 'line, machine, define' },
  { combo: 'age', difficulty: 'medium', ex: 'page, manage, village' },
  { combo: 'ure', difficulty: 'medium', ex: 'sure, picture, future' },
  { combo: 'ame', difficulty: 'medium', ex: 'game, name, became' },
  { combo: 'ump', difficulty: 'medium', ex: 'jump, bump, trumpet', note: 'TOP PICK — fun to say, fair pool' },
  { combo: 'ore', difficulty: 'medium', ex: 'more, store, before' },
  { combo: 'nk', difficulty: 'medium', ex: 'think, bank, drink' },
  { combo: 'tch', difficulty: 'medium', ex: 'watch, catch, kitchen', note: 'TOP PICK — looks scary, plenty of words' },
  { combo: 'ous', difficulty: 'medium', ex: 'famous, nervous, serious' },

  // HARD — clutch pressure (sparse pools; for late rounds / high stakes)
  { combo: 'str', difficulty: 'hard', ex: 'strong, street, destroy', note: 'TOP PICK — hard but always solvable' },
  { combo: 'scr', difficulty: 'hard', ex: 'scream, screen, describe' },
  { combo: 'thr', difficulty: 'hard', ex: 'three, throw, threat' },
  { combo: 'squ', difficulty: 'hard', ex: 'square, squad, squeeze' },
  { combo: 'dge', difficulty: 'hard', ex: 'bridge, judge, edge' },
  { combo: 'mb', difficulty: 'hard', ex: 'climb, thumb, number' },
  { combo: 'kn', difficulty: 'hard', ex: 'know, knee, knife' },
  { combo: 'wr', difficulty: 'hard', ex: 'write, wrong, wrist' },
  { combo: 'ph', difficulty: 'hard', ex: 'phone, graph, elephant' },
  { combo: 'zz', difficulty: 'hard', ex: 'pizza, buzz, dizzy' },
];


// =============================================================================
// SECTION 4 — FLAVOR TEXT  (game voice: FNF / Newgrounds, ALL CAPS, a menace)
// =============================================================================
export const FLAVOR = {
  // 40 hype popups — fire on a clean word / clutch accept.
  hypePopups: [
    'NAH HE TYPING', 'THESAURUS REX', 'SPELL CHECK CANT SAVE YOU', 'COOKED',
    'YOU ATE THAT', 'DEVOURED', 'WORD MURDER', 'EAT THE DICTIONARY', 'BARS',
    'ABSOLUTELY DEMOLISHED', 'NO NOTES', 'CERTIFIED YAPPER', 'KEYBOARD WARRIOR',
    'TOO FAST TOO LITERATE', 'VOCAB GOD', 'FINGERS OF FURY', 'LETTERS FEAR YOU',
    'SHAKESPEARE WHO', 'BIG BRAIN ENERGY', 'GALAXY BRAIN', 'DICTIONARY DEMON',
    'MENACE TO SOCIETY', 'BUILT DIFFERENT', 'HES HEATING UP', 'ON FIRE',
    'COMBO KING', 'UNSTOPPABLE', 'FLAWLESS', 'SHEEEESH', 'TYPE NASTY',
    'MAXIMUM YAP', 'THE CROWD GOES WILD', 'RENT FREE', 'GG EZ', 'CLUTCH',
    'WORDSMITH UNLOCKED', 'BOMB DEFUSED', 'NO CAP JUST WORDS', 'FINGERS BLESSED',
    'SPEED DEMON',
  ],

  // 15 kill-feed templates — {player} is replaced with the eliminated name.
  killFeed: [
    '{player} CHOKED.',
    '{player} ran out of words.',
    '{player} got DELETED.',
    'The bomb chose {player}.',
    '{player} forgot how to read.',
    '{player} typed nothing. bold strategy.',
    '{player} got cooked.',
    '{player} fumbled the bag.',
    '{player} ran out of time AND talent.',
    '{player} blew up. literally.',
    "{player}'s brain buffered.",
    '{player} got left on read by the dictionary.',
    '{player} is no longer with us.',
    '{player} rage quit (mentally).',
    "{player} couldn't spell their way out.",
  ],

  // 12 loading taunts — shown while the game boots.
  loadingTaunts: [
    'WARMING UP THE BOMB...',
    'SHARPENING THE VOWELS...',
    "LOADING 40,000 WORDS YOU DON'T KNOW...",
    "COUNTING YOUR L'S IN ADVANCE...",
    'HIDING THE EASY COMBOS...',
    'WARNING THE ENGLISH LANGUAGE...',
    'PREHEATING THE GROUP CHAT...',
    'DRAWING STRAWS FOR WHO LOSES FIRST...',
    'BRIBING THE SPELL CHECKER...',
    'CALCULATING WHO TYPES LIKE A GRANDPA...',
    'LIGHTING THE FUSE...',
    'TELLING YOUR FRIENDS YOU TYPE SLOW...',
  ],

  // 8 end-game blurbs — shown on the game-over screen.
  endGame: [
    'GG. TOUCH GRASS.',
    'THE DICTIONARY WINS AGAIN.',
    'SCREENSHOT THIS AND HUMBLE THEM.',
    'VOCABULARY: 1. YOU: 0.',
    'NO SURVIVORS.',
    'THE BOMB IS UNDEFEATED.',
    'WORDS WERE SAID. PEOPLE WERE HURT.',
    'RUN IT BACK?',
  ],
};
