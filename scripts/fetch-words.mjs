// Builds the day's word file from the Datamuse API (free, no key).
//
//   node scripts/fetch-words.mjs            write today's file (skips if it exists)
//   node scripts/fetch-words.mjs --force    overwrite today's file
//   node scripts/fetch-words.mjs --dry-run  print the words, write nothing
//
// Datamuse has no "random words" request, so we ask for words starting with a
// few random two-letter prefixes (e.g. "st*"), keep the reasonably common ones,
// sort them by part of speech, and pick at random from what we collected.

import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { connectors } from '../src/lib/connectors.js';

// ---- Config -----------------------------------------------------------------

const CONFIG = {
  // Must add up to 335.
  counts: { noun: 120, verb: 85, adjective: 70, adverb: 35, pronoun: 25 },

  // Datamuse frequency = uses per million words. Raise to get more everyday
  // words, lower to get more unusual ones.
  minFrequency: 3,

  minLength: 3,
  maxLength: 12,

  // Collect this many candidates per bucket before picking, so the daily
  // pick has some randomness. 2 = twice the target count.
  candidateMultiplier: 2,

  // Safety limits.
  maxRequests: 60,
  delayMs: 150,

  timeZone: 'America/New_York',
};

// Datamuse part-of-speech tag -> our bucket name.
const TAG_TO_BUCKET = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
const API_BUCKETS = ['noun', 'verb', 'adjective', 'adverb'];

// Definitions that mean the word is really a name, place or abbreviation.
const SKIP_DEFINITION = /\b(surname|given name|abbreviation|initialism|acronym|a (city|town|country|river|village|county|province|state) (in|of))\b/i;

// Common English word starts. Shuffled every run.
const PREFIXES = `ab ac ad af ag al am an ap ar as at aw ba be bi bl bo br bu ca ce ch
  ci cl co cr cu da de di do dr du ea ec ed ef el em en ep eq er es ev ex fa fe fi fl fo
  fr fu ga ge gi gl go gr gu ha he hi ho hu id ig il im in ja je jo ju ke ki kn la le li
  lo lu ma me mi mo mu na ne ni no nu ob oc od of om op or ou ow pa pe ph pi pl po pr pu
  qu ra re ri ro ru sa sc se sh si sk sl sm sn so sp sq st su sw ta te th ti to tr tu tw
  ug un up ur us va ve vi vo wa we wh wi wo wr ya ye yo ze zi`.split(/\s+/).filter(Boolean);

// Adverbs are rare under most prefixes, so we always do one "*ly" request too.
const ALWAYS_PATTERNS = ['*ly'];

const WORDS_DIR = new URL('../public/words/', import.meta.url);
const LISTS_DIR = new URL('./lists/', import.meta.url);

// ---- Helpers ----------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY_RUN = args.has('--dry-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// YYYY-MM-DD in the configured time zone (en-CA formats dates that way).
function todayIn(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function exists(url) {
  try { await access(url); return true; } catch { return false; }
}

// Write to a temp file first, then rename, so a crash never leaves half a file.
async function writeJson(url, data) {
  const tmp = new URL(url.href + '.tmp');
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
  await rename(tmp, url);
}

async function fetchPattern(pattern) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(pattern)}&md=pfd&max=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Datamuse ${res.status} for "${pattern}"`);
  return res.json();
}

// Rough word stem so "argue", "argued" and "argues" count as the same word.
function stem(word) {
  return word.replace(/ies$/, 'y').replace(/(ing|ed|es|e|s|d)$/, '');
}

// Pick `count` words at random, at most one per stem.
function pickWords(pool, count) {
  const picked = [];
  const stems = new Set();
  for (const word of shuffle(pool)) {
    const s = stem(word);
    if (stems.has(s)) continue;
    stems.add(s);
    picked.push(word);
    if (picked.length === count) break;
  }
  return picked;
}

// Turn one Datamuse result into { word, bucket }, or null if we don't want it.
// Datamuse lists the most likely part of speech first, so we use that one.
function classify(entry, excluded, blockedStems) {
  const word = entry.word?.toLowerCase();
  if (!word) return null;
  if (!/^[a-z]+(-[a-z]+)*$/.test(word)) return null; // letters and hyphens only
  if (word.length < CONFIG.minLength || word.length > CONFIG.maxLength) return null;
  if (excluded.has(word)) return null;
  if (blockedStems.has(stem(word))) return null; // catches "raped" from "rape"

  const tags = entry.tags ?? [];
  if (tags.includes('prop')) return null; // proper noun (names, places)

  // Must have a dictionary definition, and the main one can't be a name/place.
  const firstDef = entry.defs?.[0];
  if (!firstDef || SKIP_DEFINITION.test(firstDef)) return null;

  const freqTag = tags.find((t) => t.startsWith('f:'));
  const frequency = freqTag ? Number(freqTag.slice(2)) : 0;
  if (frequency < CONFIG.minFrequency) return null;

  const primary = tags.find((t) => !t.startsWith('f:'));
  const bucket = TAG_TO_BUCKET[primary];
  return bucket ? { word, bucket } : null;
}

function pickPronouns({ core, extra }, count) {
  if (core.length > count) throw new Error('counts.pronoun is smaller than the core pronoun set');
  return [...core, ...shuffle(extra).slice(0, count - core.length)];
}

// ---- Main -------------------------------------------------------------------

async function main() {
  const total = Object.values(CONFIG.counts).reduce((a, b) => a + b, 0);
  if (total !== 335) throw new Error(`CONFIG.counts adds up to ${total}, not 335`);

  const date = todayIn(CONFIG.timeZone);
  const fileUrl = new URL(`${date}.json`, WORDS_DIR);

  if (!DRY_RUN && !FORCE && (await exists(fileUrl))) {
    console.log(`${date}.json already exists. Use --force to overwrite.`);
    return;
  }

  const pronounList = await readJson(new URL('pronouns.json', LISTS_DIR));
  const blocklist = await readJson(new URL('blocklist.json', LISTS_DIR));

  // Words that must never land in an API bucket.
  const excluded = new Set([
    ...blocklist.words, ...blocklist.extra,
    ...pronounList.core, ...pronounList.extra,
    ...connectors,
  ]);

  const blockedStems = new Set([...blocklist.words, ...blocklist.extra].map(stem));

  // Collect candidates. A Set per bucket keeps insertion order and dedupes.
  const candidates = Object.fromEntries(API_BUCKETS.map((b) => [b, new Set()]));
  const seen = new Set(); // across buckets: a word goes in the first bucket it hits
  const want = (b) => CONFIG.counts[b] * CONFIG.candidateMultiplier;
  const full = () => API_BUCKETS.every((b) => candidates[b].size >= want(b));

  const patterns = [...ALWAYS_PATTERNS, ...shuffle(PREFIXES).map((p) => `${p}*`)];
  let requests = 0;

  for (const pattern of patterns) {
    if (full() || requests >= CONFIG.maxRequests) break;
    requests++;
    const results = await fetchPattern(pattern);
    for (const entry of results) {
      const hit = classify(entry, excluded, blockedStems);
      if (!hit || seen.has(hit.word)) continue;
      seen.add(hit.word);
      candidates[hit.bucket].add(hit.word);
    }
    await sleep(CONFIG.delayMs);
  }

  console.log(`Made ${requests} requests. Candidates:`,
    Object.fromEntries(API_BUCKETS.map((b) => [b, candidates[b].size])));

  // Pick each bucket's words at random. Fail (and write nothing) if short.
  const words = {};
  for (const b of API_BUCKETS) {
    const picked = pickWords([...candidates[b]], CONFIG.counts[b]);
    if (picked.length < CONFIG.counts[b]) {
      throw new Error(`Only found ${picked.length} ${b}s, need ${CONFIG.counts[b]}`);
    }
    words[b] = picked.sort();
  }
  words.pronoun = pickPronouns(pronounList, CONFIG.counts.pronoun);

  const data = { date, counts: CONFIG.counts, words };

  if (DRY_RUN) {
    for (const [b, list] of Object.entries(words)) console.log(`\n${b} (${list.length}):\n${list.join(', ')}`);
    return;
  }

  await writeJson(fileUrl, data);

  const indexUrl = new URL('index.json', WORDS_DIR);
  const index = (await exists(indexUrl)) ? await readJson(indexUrl) : { dates: [] };
  const dates = [...new Set([...index.dates, date])].sort();
  await writeJson(indexUrl, { dates, latest: dates.at(-1) });

  console.log(`Wrote public/words/${date}.json`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
