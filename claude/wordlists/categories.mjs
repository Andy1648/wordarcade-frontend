// claude/wordlists/categories.mjs — STEP 55 hand-curated PROBE categories.
//
// The single source for (a) the probe set (probe.txt, via measure.mjs) and (b) the words added to
// src/solo/words.common.txt (via build-common.mjs). Lowercase, a-z only, SINGLE words only — the
// solo input accepts no spaces, so "new york" / "costa rica" are not representable and are omitted.
//
// SAFETY: every entry is filtered at build time against src/moderation/blockedTerms.js
// (isBlockedForDisplay = slurs + profanity) and src/leaderboard/nameFilter.js (isNameBlocked =
// whole-term + leet/ROOT match). Demonyms are listed as the plain NATIONALITY ADJECTIVE only
// (french, japanese) — never an ethnic slur form. The insult list is MILD only: no slur, no
// profanity, no sexual term, nothing targeting a group, and no ableist/clinical-diagnosis term
// beyond the two Andy named explicitly (idiot, moron). Deliberately LEFT OUT: imbecile, cretin,
// retard (ableist); psycho, nutjob, nutcase (mental-health stigma); fatso (body); hick, redneck
// (group); scumbag (sexual origin); berk, prat (vulgar origins); jackass, dumbass, butthead (profanity roots); plonker (vulgar).

export const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
];

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const CONTINENTS = [
  'africa', 'antarctica', 'asia', 'australia', 'europe', 'america', 'americas', 'oceania',
  'eurasia', 'arctic', 'antarctic', 'atlantic', 'pacific', 'mediterranean', 'caribbean',
  'scandinavia', 'siberia', 'sahara', 'balkans', 'himalayas', 'alps', 'andes', 'amazon',
];

// Sovereign states + a few widely-used single-word territories/regions. Single-word names only.
export const COUNTRIES = [
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia', 'australia',
  'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados', 'belarus', 'belgium',
  'belize', 'benin', 'bhutan', 'bolivia', 'bosnia', 'botswana', 'brazil', 'brunei', 'bulgaria',
  'burundi', 'cambodia', 'cameroon', 'canada', 'chad', 'chile', 'china', 'colombia', 'comoros',
  'congo', 'croatia', 'cuba', 'cyprus', 'czechia', 'denmark', 'djibouti', 'dominica', 'ecuador',
  'egypt', 'eritrea', 'estonia', 'eswatini', 'ethiopia', 'fiji', 'finland', 'france', 'gabon',
  'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada', 'guatemala', 'guinea', 'guyana',
  'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland',
  'israel', 'italy', 'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya', 'kiribati', 'kosovo',
  'kuwait', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lesotho', 'liberia', 'libya',
  'liechtenstein', 'lithuania', 'luxembourg', 'madagascar', 'malawi', 'malaysia', 'maldives',
  'mali', 'malta', 'mauritania', 'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco',
  'mongolia', 'montenegro', 'morocco', 'mozambique', 'myanmar', 'burma', 'namibia', 'nauru',
  'nepal', 'netherlands', 'holland', 'nicaragua', 'niger', 'nigeria', 'norway', 'oman',
  'pakistan', 'palau', 'palestine', 'panama', 'paraguay', 'peru', 'philippines', 'poland',
  'portugal', 'qatar', 'romania', 'russia', 'rwanda', 'samoa', 'senegal', 'serbia', 'seychelles',
  'singapore', 'slovakia', 'slovenia', 'somalia', 'spain', 'sudan', 'suriname', 'swaziland',
  'sweden', 'switzerland', 'syria', 'taiwan', 'tajikistan', 'tanzania', 'thailand', 'togo',
  'tonga', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu', 'uganda', 'ukraine', 'uruguay',
  'uzbekistan', 'vanuatu', 'vatican', 'venezuela', 'vietnam', 'yemen', 'zambia', 'zimbabwe',
  'england', 'scotland', 'wales', 'britain', 'greenland', 'tibet', 'bermuda', 'tahiti', 'aruba',
  'guam', 'macau', 'gibraltar', 'catalonia', 'sicily', 'sardinia', 'corsica', 'crete', 'bali',
  'java', 'sumatra', 'borneo', 'hawaii', 'cuba', 'madeira', 'iberia', 'persia', 'prussia',
  'mesopotamia', 'babylon', 'sparta', 'troy',
];

export const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
  'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
  'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'wisconsin', 'wyoming',
  // Canadian provinces/territories (single-word) — same "common place name" class.
  'alberta', 'ontario', 'quebec', 'manitoba', 'saskatchewan', 'yukon', 'nunavut',
];

// Major world + US cities, single-word names only.
export const CITIES = [
  // Europe
  'london', 'paris', 'berlin', 'madrid', 'barcelona', 'moscow', 'rome', 'milan', 'venice',
  'naples', 'florence', 'turin', 'genoa', 'palermo', 'bologna', 'verona', 'pisa', 'munich',
  'hamburg', 'frankfurt', 'cologne', 'stuttgart', 'dresden', 'leipzig', 'dusseldorf', 'bremen',
  'hanover', 'nuremberg', 'vienna', 'salzburg', 'prague', 'warsaw', 'krakow', 'budapest',
  'bucharest', 'sofia', 'belgrade', 'zagreb', 'athens', 'istanbul', 'ankara', 'amsterdam',
  'rotterdam', 'brussels', 'antwerp', 'lisbon', 'porto', 'seville', 'valencia', 'malaga',
  'bilbao', 'dublin', 'belfast', 'edinburgh', 'glasgow', 'manchester', 'liverpool', 'birmingham',
  'leeds', 'bristol', 'oxford', 'cambridge', 'cardiff', 'stockholm', 'oslo', 'helsinki',
  'copenhagen', 'reykjavik', 'zurich', 'geneva', 'bern', 'basel', 'lyon', 'marseille', 'nice',
  'bordeaux', 'toulouse', 'strasbourg', 'monaco', 'kyiv', 'kiev', 'minsk', 'riga', 'vilnius',
  'tallinn', 'luxembourg', 'valletta', 'nicosia', 'sarajevo', 'tirana', 'skopje',
  'petersburg', 'stalingrad',
  // Asia / Middle East
  'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'chengdu', 'wuhan', 'nanjing', 'tianjin',
  'hongkong', 'tokyo', 'osaka', 'kyoto', 'yokohama', 'nagoya', 'sapporo', 'hiroshima',
  'nagasaki', 'seoul', 'busan', 'pyongyang', 'taipei', 'bangkok', 'phuket', 'hanoi', 'saigon',
  'manila', 'jakarta', 'singapore', 'mumbai', 'bombay', 'delhi', 'kolkata', 'calcutta',
  'chennai', 'madras', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 'jaipur', 'agra', 'goa',
  'karachi', 'lahore', 'islamabad', 'dhaka', 'kathmandu', 'colombo', 'kabul', 'tehran',
  'baghdad', 'damascus', 'beirut', 'amman', 'jerusalem', 'riyadh', 'jeddah', 'mecca', 'medina',
  'dubai', 'doha', 'muscat', 'kuwait', 'tashkent', 'almaty', 'ulaanbaatar', 'yangon',
  // Africa
  'cairo', 'alexandria', 'lagos', 'abuja', 'nairobi', 'mombasa', 'johannesburg', 'pretoria',
  'durban', 'casablanca', 'marrakesh', 'marrakech', 'rabat', 'tunis', 'algiers', 'tripoli',
  'khartoum', 'kinshasa', 'accra', 'dakar', 'kampala', 'kigali', 'luanda', 'harare', 'lusaka',
  'mogadishu', 'timbuktu', 'zanzibar',
  // Americas
  'toronto', 'montreal', 'vancouver', 'ottawa', 'calgary', 'edmonton', 'winnipeg', 'halifax',
  'chicago', 'boston', 'seattle', 'denver', 'austin', 'dallas', 'houston', 'atlanta', 'miami',
  'orlando', 'tampa', 'philadelphia', 'phoenix', 'detroit', 'minneapolis', 'baltimore',
  'brooklyn', 'manhattan', 'queens', 'bronx', 'pittsburgh', 'cleveland', 'cincinnati',
  'columbus', 'indianapolis', 'milwaukee', 'nashville', 'memphis', 'louisville', 'charlotte',
  'raleigh', 'richmond', 'portland', 'sacramento', 'oakland', 'hollywood', 'honolulu',
  'anchorage', 'albuquerque', 'tucson', 'omaha', 'tulsa', 'buffalo', 'savannah', 'charleston',
  'jacksonville', 'birmingham', 'newark', 'jersey', 'vegas', 'reno', 'boise', 'spokane',
  'anaheim', 'pasadena', 'berkeley', 'malibu', 'aspen', 'juneau', 'chattanooga', 'knoxville',
  'mexico', 'tijuana', 'cancun', 'acapulco', 'guadalajara', 'monterrey', 'havana', 'kingston',
  'bogota', 'medellin', 'caracas', 'lima', 'quito', 'santiago', 'valparaiso', 'montevideo',
  'asuncion', 'brasilia', 'rio', 'salvador', 'recife', 'cusco', 'panama',
  // Oceania
  'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'darwin', 'hobart',
  'auckland', 'wellington', 'christchurch',
];

// Nationality / language ADJECTIVES (plain demonyms, never slur forms).
export const NATIONALITIES = [
  'american', 'african', 'european', 'asian', 'canadian', 'mexican', 'brazilian', 'argentine',
  'argentinian', 'chilean', 'peruvian', 'colombian', 'venezuelan', 'cuban', 'jamaican',
  'haitian', 'english', 'british', 'scottish', 'irish', 'welsh', 'french', 'german', 'spanish',
  'italian', 'portuguese', 'dutch', 'belgian', 'swiss', 'austrian', 'swedish', 'norwegian',
  'danish', 'finnish', 'icelandic', 'russian', 'ukrainian', 'polish', 'czech', 'slovak',
  'romanian', 'bulgarian', 'greek', 'croatian', 'serbian', 'hungarian', 'albanian', 'turkish',
  'japanese', 'chinese', 'korean', 'vietnamese', 'thai', 'filipino', 'indonesian', 'malaysian',
  'indian', 'pakistani', 'nepalese', 'tibetan', 'mongolian', 'egyptian', 'moroccan', 'nigerian',
  'kenyan', 'ethiopian', 'somali', 'ghanaian', 'australian', 'israeli', 'iranian', 'iraqi',
  'saudi', 'syrian', 'lebanese', 'persian', 'arab', 'arabian', 'arabic', 'hebrew', 'latin',
  'hindi', 'urdu', 'bengali', 'punjabi', 'tamil', 'mandarin', 'cantonese', 'swahili', 'zulu',
  'yiddish', 'gaelic', 'celtic', 'nordic', 'viking', 'roman', 'egyptian', 'texan', 'hawaiian',
  'alaskan', 'californian', 'parisian', 'londoner', 'victorian', 'elizabethan', 'medieval',
  'americans', 'africans', 'europeans', 'asians', 'canadians', 'mexicans', 'brazilians',
  'italians', 'germans', 'russians', 'indians', 'australians', 'romans', 'vikings', 'greeks',
  'spaniards', 'scots', 'brits',
];

// MILD insults only — see the header for what was deliberately left out.
export const INSULTS = [
  'idiot', 'idiots', 'idiotic', 'idiocy', 'moron', 'morons', 'moronic', 'loser', 'losers',
  'dummy', 'dummies', 'dork', 'dorks', 'dorky', 'nerd', 'nerds', 'nerdy', 'jerk', 'jerks',
  'fool', 'fools', 'foolish', 'clown', 'clowns', 'doofus', 'doofuses', 'dimwit', 'dimwits',
  'dimwitted', 'nitwit', 'nitwits', 'halfwit', 'halfwits', 'bozo', 'bozos', 'goof', 'goofs',
  'goofy', 'goofball', 'goofballs', 'numbskull', 'numbskulls', 'numskull', 'twit', 'twits',
  'dingbat', 'dingbats', 'dingus', 'dunce', 'dunces', 'buffoon', 'buffoons', 'blockhead',
  'blockheads', 'bonehead', 'boneheads', 'knucklehead', 'knuckleheads', 'meathead', 'meatheads',
  'airhead', 'airheads', 'birdbrain', 'birdbrains', 'pinhead', 'pinheads', 'peabrain',
  'dunderhead', 'dope', 'dopes', 'dopey', 'chump', 'chumps', 'sucker', 'suckers', 'weirdo',
  'weirdos', 'creep', 'creeps', 'creepy', 'crybaby', 'crybabies', 'wimp', 'wimps', 'wimpy',
  'nincompoop', 'nincompoops', 'ninny', 'ninnies', 'dolt', 'dolts', 'doltish', 'oaf', 'oafs',
  'oafish', 'lummox', 'nimrod', 'nimrods', 'noob', 'noobs', 'newb', 'newbie', 'newbies', 'scrub',
  'scrubs', 'poser', 'posers', 'slacker', 'slackers', 'slob', 'slobs', 'brat', 'brats', 'bratty',
  'coward', 'cowards', 'cowardly', 'liar', 'liars', 'cheater', 'cheaters', 'dweeb', 'dweebs',
  'geek', 'geeks', 'geeky', 'simpleton', 'simpletons', 'twerp', 'twerps', 'goober', 'goobers',
  'dipstick', 'dipsticks', 'pipsqueak', 'pipsqueaks', 'runt', 'runts', 'grouch', 'grouchy',
  'grump', 'grumpy', 'meanie', 'meanies', 'stinker', 'stinkers', 'rascal', 'rascals',
  'scoundrel', 'scoundrels', 'knave', 'knaves', 'villain', 'villains', 'brute', 'brutes', 'lout',
  'louts', 'boor', 'boorish', 'snob', 'snobs', 'snobby', 'snooty', 'weakling', 'weaklings',
  'bumpkin', 'bumpkins', 'oddball', 'oddballs', 'doormat', 'pushover', 'tattletale', 'snitch',
  'snitches', 'whiner', 'whiners', 'crank', 'cranky', 'blabbermouth', 'loudmouth', 'smartypants',
  'showoff', 'killjoy', 'buzzkill', 'gremlin', 'muppet', 'muppets', 'git', 'gits',
  'numpty', 'wally', 'pillock', 'dumb', 'dumber', 'dumbest', 'stupid', 'stupider',
  'stupidest', 'lame', 'lamer', 'cringe', 'cringey', 'cringy', 'sus', 'noobish',
];

// Holidays + planets — the other capitalised-but-everyday words the corpus scan surfaced
// (christmas/halloween/saturn were all rejected). Brand names (lego, pokemon) are NOT added:
// the backend deliberately blocks brands, and they are trademarks, not vocabulary.
export const HOLIDAYS_PLANETS = [
  'christmas', 'christmases', 'halloween', 'easter', 'thanksgiving', 'hanukkah', 'chanukah',
  'kwanzaa', 'ramadan', 'diwali', 'valentine', 'valentines', 'xmas',
  'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

// Everyday modern words the corpus scan found missing (or only in the lazy extension).
export const MODERN = [
  'selfie', 'selfies', 'emoji', 'emojis', 'wifi', 'youtuber', 'youtubers', 'hashtag', 'hashtags',
  'tweets', 'tweeted', 'tweeting', 'unfriend', 'olympic', 'olympics', 'kungfu', 'vlogger',
  'vloggers', 'livestream', 'livestreams', 'gamer', 'gamers', 'esports', 'smartwatch', 'webcam',
  'webcams', 'ebook', 'ebooks', 'inbox', 'spam', 'spammer', 'chatbot', 'chatbots', 'bitcoin',
];

export const CATEGORIES = {
  months: MONTHS,
  days: DAYS,
  continents_regions: CONTINENTS,
  countries: COUNTRIES,
  states_provinces: US_STATES,
  cities: CITIES,
  nationalities_languages: NATIONALITIES,
  mild_insults: INSULTS,
  holidays_planets: HOLIDAYS_PLANETS,
  modern: MODERN,
};
