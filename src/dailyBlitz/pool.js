// dailyBlitz/pool.js — WHICH Category Blitz lists can be a DAILY BLITZ prompt, and how hard each is.
//
// Every name here is a list in the backend's blitzLists.json (the closed, verified Blitz lists — STEP 9
// list-only judging). scripts/gen-daily-blitz.mjs copies exactly these lists into data.json and FAILS if a
// name is missing, so this file and the data can't drift.
//
// A day is SIX prompts as a ramp: two EASY (anyone can name one — the game is naming a RARE one), two
// MEDIUM, two NICHE (a gaming/fandom deep cut, still answerable by the kid who plays it). Left out on
// purpose: lists a 13-year-old cannot answer at all (Declaration signers, Inca emperors, shoguns, tsars,
// Heisman winners, NCAA conferences, musical keys, Dark Souls bosses, Sherlock Holmes stories) and lists
// too small to have a rare answer (fewer than ~12 entries).

export const PER_TIER = 2;

export const DAILY_POOL = {
  easy: [
    'African countries', 'Asian countries', 'Bones of the human body', 'European national capitals',
    'Girl Scout cookies', 'Latin American countries', 'Major human organs', 'Middle Eastern countries',
    'Minecraft mobs', 'NBA teams', 'NFL teams', 'Pixar feature films', 'Pokemon from Gen 1',
    'Summer Olympic sports', 'US presidents', 'US state capitals', 'US states',
  ],
  medium: [
    'Call of Duty games', 'English & British monarchs', 'Grand Theft Auto games', 'Greek Olympian gods',
    'James Bond films', 'Japanese prefectures', 'Mario Kart items', 'Minecraft biomes', 'MLB teams', 'NHL teams',
    'Nintendo, PlayStation, Xbox & Sega consoles', 'Norse gods and goddesses', 'Olympic track and field events',
    'Organs of the human digestive system', 'Premier League clubs (all-time)', 'Roman emperors',
    'Shakespeare plays', 'Star Wars theatrical films', 'Studio Ghibli Movies', 'US First Ladies',
    'US National Parks', 'Wonders of the World (Ancient & New 7)',
  ],
  niche: [
    'Among Us colors', 'Angry Birds birds', 'Apex Legends legends', "Donkey Kong's Kong family",
    'F1 circuits (2026 calendar)', 'Greek Titans', 'Half-Life enemies', 'Irish counties',
    'League of Legends Champions', 'Minecraft Ore Blocks', 'Minecraft potions', 'Minecraft tools & weapons',
    'MLS teams', 'Overwatch heroes', 'Parts of a plant cell', 'Pokémon starters', 'Resident Evil games',
    'Skyrim races', 'Stardew Valley villagers', 'Street Fighter fighters', 'Super Smash Bros. fighters',
    'Valorant agents', 'WNBA teams',
  ],
};

export const TIER_ORDER = ['easy', 'medium', 'niche'];
