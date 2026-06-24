// categoryExamples.js
// One short, clearly-valid SAMPLE answer per Category Blitz category, shown as a
// subtle "e.g. ..." hint so players instantly understand the expected FORMAT and
// scope of an answer - whether it's a single word, a short phrase, or a sentence
// fragment. (The confusion this fixes: prompts like "Lies on a dating profile"
// where players can't tell if an answer is a word or a whole sentence.)
//
// PURELY PRESENTATIONAL / DISPLAY-ONLY: these hints are never submitted, never
// validated, never scored, and never pre-fill the input. The server's answer
// sets / validation are untouched. Keys are the EXACT category strings the server
// broadcasts (kept in sync with the backend's CATEGORIES in categoryBlitzLogic.js);
// any category without an entry simply shows no hint. Same school-appropriate
// content standard as the categories.
export const CATEGORY_EXAMPLES = {
  // Oddly specific
  'Things in your junk drawer': 'rubber bands',
  'Gas station purchases at 2am': 'energy drink',
  'Things on a CVS receipt': 'a mile-long receipt',
  'Things your mom has in her purse': 'hand sanitizer',
  'Things in a college dorm room': 'mini fridge',
  'Smells in a middle school': 'body spray',
  "Things in a teacher's desk": 'red pens',
  'Things you find between couch cushions': 'a crusty old fry',
  'Things in a hotel minibar': '$9 water',
  'Things taped to a fridge': "a kid's crayon drawing",
  // Food but make it specific
  "McDonald's menu items": 'McFlurry',
  'Things you dip in ranch': 'literally everything',
  'Foods that are better cold the next day': 'cold pizza',
  "Gas station food you'd actually eat": 'beef jerky',
  'Things you put on toast': 'an alarming amount of butter',
  'School cafeteria foods': 'chicken nuggets',
  "Foods that shouldn't exist but do": 'candy corn',
  'Things at a buffet nobody touches': 'the jello',
  'Midnight snack choices': 'cereal in the dark',
  "Foods you eat with your hands but probably shouldn't": 'spaghetti',
  // Pop culture (specific)
  'SpongeBob characters': 'Patrick',
  'Minecraft mobs': 'Creeper',
  'Pokemon from Gen 1': 'Pikachu',
  'Things you can do in GTA': 'drive a car',
  'Fortnite skins': 'Peely',
  'Mario power-ups and items': 'Super Mushroom',
  'Disney villains': 'Scar',
  'Pixar movies': 'Toy Story',
  'Things in Hogwarts': 'the Great Hall',
  'Roblox games': 'Adopt Me',
  // Debatable / funny
  'Valid excuses for being late': 'traffic',
  "Things you shouldn't microwave": 'aluminum foil',
  'Worst superpowers': 'talking to fish',
  'Things that are technically legal but feel illegal': 'jaywalking',
  'Reasons to call in sick': 'food poisoning',
  'Things you pretend to understand': 'the stock market',
  'Things you google at 3am': 'is cereal a soup',
  'Lies on a dating profile': 'I love hiking',
  'Things the weird kid did in class': 'ate glue',
  "Things that shouldn't be a sport but are": 'competitive eating',
  // Brands & specific knowledge
  'Shoe brands': 'Crocs',
  'Car brands': 'Toyota',
  'Fast food chains': "Wendy's",
  'Apps on your phone right now': 'TikTok',
  'Things in an Amazon package': 'bubble wrap',
  'Things in a Costco': 'free samples',
  'YouTube video categories': 'unboxing',
  'Things with a drive-through': 'Starbucks',
  'Subscription services': 'Netflix',
  'Things that come in a vending machine': 'the bag that gets stuck',
  // Social / relatable
  'Things teachers always say': "we're waiting",
  'Things your parents text you': 'call me',
  'Things a gym bro says': 'do you even lift',
  'Things you say when you stub your toe': 'a word I learned online',
  'Things you whisper in a library': "where's the bathroom",
  'Things you yell at a sports game': 'defense!',
  'First things you do when you wake up': 'check my phone',
  'Things you do when the WiFi goes out': 'slowly lose your mind',
  'Things that hit different at night': 'sad songs',
  'Excuses for not texting back': 'my phone died',
  // Curated expansion batch
  "Things in a divorced dad's apartment": 'a big TV',
  'Florida man headlines': 'wrestles alligator',
  'Things a mom yells from another room': "dinner's ready",
  'Ways to die in Minecraft': 'fall in lava',
  'Things confiscated by a teacher': 'cell phone',
  'Red flags in a dating profile': 'loves drama',
  "Things in a 2010 kid's bedroom": 'Silly Bandz',
  'What the dog ate': 'my homework',
  'Things at a gas station bathroom': 'a broken sink',
  'Cryptids in the woods at night': 'Bigfoot',
  'Things a substitute teacher says': "I'm just the sub",
  "Ways to get sent to the principal's office": 'talking back',
  'Things in a final boss arena': 'lava pits',
  'Things at a middle school dance': 'a punch bowl',
  'Things your weird aunt posts on Facebook': 'minion memes',
  'The DMV experience': 'long lines',
  'Things found in a frat house': 'ping pong table',
  "Things in an emo kid's room (2008)": 'band posters',
  'Excuses for not doing your homework': 'my dog ate it',
};

// Look up the hint for a category name; returns '' when there's no example, so
// callers can render nothing rather than a broken "e.g. undefined".
export function exampleFor(category) {
  return (category && CATEGORY_EXAMPLES[category]) || '';
}
