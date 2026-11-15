# Daily Word Poem: Project Context

A school project: a static web app where every day users get a fresh bank of **335 words**, sorted by part of speech, and build a short poem or story by clicking words. No accounts, no backend, no database.

## Core concept

- Every day a scheduled job pulls a new set of 335 words from the Datamuse API (free, no key) and saves them as a JSON file in the repo.
- Every visitor sees the same words that day.
- The user builds a poem by clicking words in a **word bank drawer** (right side). Clicked words appear inline on the **canvas** (left/center).
- Clicking a selected word again removes it from the poem (toggle select/deselect).
- A **line break** button starts a new line in the poem.
- Poems are not stored on a server. Users save their poem by emailing it to themselves, downloading a PDF, or copying it.

## Tech stack

- **Svelte 5 + Vite**, not SvelteKit. Single page, no routing, no server endpoints, no SSR. (Already scaffolded with the plain-JS `svelte` template.)
- Use **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`), not legacy `let`/`$:` reactivity or stores, unless a store is clearly simpler.
- Plain CSS in components (scoped `<style>`), plus one global stylesheet for variables and print styles. No CSS framework unless asked.
- **Hosting:** Vercel, auto-deploying from `main`. Build command `npm run build`, output folder `dist`.
- **Daily job:** a GitHub Actions scheduled workflow running a Node script (Node 24 in CI, built-in `fetch`, no extra HTTP libraries).

## Architecture

```
GitHub Action (daily cron)
  → node scripts/fetch-words.mjs   (calls Datamuse; no API key)
  → writes public/words/YYYY-MM-DD.json + updates public/words/index.json
  → commits & pushes to main
  → Vercel auto-redeploys
Browser
  → fetches /words/index.json, then today's file (or the newest available)
  → everything else happens client-side
```

Datamuse needs no API key, so there are no secrets in this project.

## File structure

```
├─ .github/workflows/daily-words.yml
├─ scripts/
│  ├─ fetch-words.mjs         # builds the day's word file
│  └─ lists/
│     ├─ pronouns.json        # curated, not from the API
│     └─ blocklist.json       # profanity (LDNOOBW, CC BY 4.0) + `extra` for our own additions
├─ public/words/
│  ├─ index.json              # { "dates": ["2026-11-15", ...], "latest": "2026-11-15" }
│  └─ 2026-11-15.json         # one file per day, never overwritten
├─ src/
│  ├─ App.svelte              # layout: canvas + drawer
│  ├─ lib/
│  │  ├─ Canvas.svelte        # renders the poem, line breaks, toolbar
│  │  ├─ WordBank.svelte      # drawer with bucket tabs/sections
│  │  ├─ WordChip.svelte      # a single clickable word
│  │  ├─ SaveMenu.svelte      # email / PDF / copy
│  │  ├─ connectors.js        # curated reusable connecting words (static)
│  │  ├─ poem.svelte.js       # shared poem state (runes) + actions
│  │  └─ loadWords.js         # fetch index + daily file with fallback
│  ├─ app.css                 # global vars + @media print rules
│  └─ main.js
└─ CLAUDE.md
```

## Daily word file format

```json
{
  "date": "2026-11-15",
  "counts": { "noun": 120, "verb": 85, "adjective": 70, "adverb": 35, "pronoun": 25 },
  "words": {
    "noun": ["lantern", "orchard", "..."],
    "verb": ["drift", "unravel", "..."],
    "adjective": ["brittle", "amber", "..."],
    "adverb": ["softly", "never", "..."],
    "pronoun": ["she", "they", "..."]
  }
}
```

- Total across all buckets is **exactly 335**. Default split: noun 120, verb 85, adjective 70, adverb 35, pronoun 25. Keep these numbers in one config object at the top of the script.
- All words lowercase. No word appears in more than one bucket on the same day.

## Word-fetching script (`scripts/fetch-words.mjs`)

Uses **Datamuse** (`https://api.datamuse.com/words`): free, no key, up to 100k requests/day. Run with `npm run words` (or `-- --dry-run` / `-- --force`).

Datamuse has no random-words request, so the script:
1. Requests `sp=<prefix>*&md=pfd&max=1000` for random two-letter prefixes (shuffled from a list of common word starts), plus one `*ly` request because adverbs are rare otherwise. `md=pfd` returns part-of-speech tags, frequency (`f:` = uses per million) and definitions.
2. Buckets each word by its **first** POS tag (`n`, `v`, `adj`, `adv`); anything else is dropped.
3. Filters: letters/hyphens only; length 3–12; `f >= minFrequency` (default 3, for everyday words); must have a definition; drops anything tagged `prop` or whose first definition is a surname, given name, place or abbreviation; drops blocklisted words (matched by rough stem, so "raped" is caught by "rape"), pronouns and connectors.
4. De-dupes across buckets (first bucket wins). Keeps requesting prefixes until each bucket has 2× its target in candidates (`maxRequests` 60; usually ~30–40, verbs are the slowest bucket).
5. Picks each bucket at random, at most one word per rough stem (so not "argue", "argued" and "argues" together). Inflected forms like "gasped" are allowed.
6. **Pronouns** come from `scripts/lists/pronouns.json`: the `core` set (I, you, he, she, it, we, they, me, him, her, us, them) always, the rest random from `extra`.
7. Writes `public/words/<date>.json` and updates `index.json` (via temp file + rename, so never a partial file). Never overwrites an existing date unless `--force`. Date is **America/New_York**.
8. If a bucket comes up short or a request fails, exits non-zero and writes nothing. The site falls back to the most recent file.

All tunables (`counts`, `minFrequency`, lengths, `candidateMultiplier`, `maxRequests`) are in the `CONFIG` object at the top. `minFrequency` was raised from 1 to 3 to favour common words; lower it later for more variety. Some technical words still get through: add unwanted ones to `blocklist.json` → `extra`.

## GitHub Action (`.github/workflows/daily-words.yml`)

- Triggers: `schedule` cron `15 5 * * *` (~12:15 a.m. Eastern; GitHub cron is UTC and can run late), plus `workflow_dispatch`.
- `permissions: contents: write`
- Steps: checkout → setup-node (24; Node 20 is end-of-life) → `node scripts/fetch-words.mjs` (no secrets needed) → commit only if changed, as `github-actions[bot]`, message `chore: words for YYYY-MM-DD` → push.
- GitHub may pause scheduled workflows in inactive repos. If words stop updating, check the Actions tab.

## Front-end behavior

### Loading words (`loadWords.js`)
- Today's date from the **user's local clock** (`YYYY-MM-DD`).
- Fetch `/words/index.json`. If today is listed, fetch that file; otherwise fetch `latest`.
- Show a loading state and a friendly error state.

### Layout
- **Canvas** fills left/center. **Word bank drawer** fixed on the right (~320–380px on desktop).
- On narrow screens, the drawer becomes a bottom sheet or slide-over opened with a toggle. Canvas must stay usable on a phone.
- Drawer grouped into buckets (Nouns, Verbs, Adjectives, Adverbs, Pronouns, Connectors) via tabs or collapsible sections, each with a count. Search/filter box at the top narrows words across buckets.

### Poem state (`poem.svelte.js`)
- Ordered array of tokens: `{ id, type: 'word', text, bucket } | { id, type: 'break' }`
- Each bank word has a stable id (`bucket:word`), so `selectedIds` is derived from the tokens.
- **Each daily word can be used once** (the grayed-out state).
- **Connectors are reusable:** never grayed out, no `aria-pressed`; each click appends a new token. Their token ids must be unique per token (e.g. a counter), not `bucket:word`, and they don't feed `selectedIds`.

### Interactions
- **Click unselected word in drawer:** append to poem; chip goes to ~0.35 opacity with `aria-pressed="true"`.
- **Click selected word in drawer:** remove from poem; chip restored.
- **Click word on canvas:** removes it and restores the chip.
- **Line break button:** adds a `break` token. Each break renders as a small clickable ↵ marker on the canvas that deletes it.
- **Undo last:** removes the last token. Keyboard: Backspace when focus isn't in a text input.
- **Clear poem:** confirm, then empty the poem and restore all chips.
- Canvas shows words inline separated by spaces, wrapping naturally; breaks start new lines.
- Persist in-progress poem to `localStorage` keyed by word-set date; restore same day, ignore on a new day. Wrap storage access in try/catch.

### Saving and sharing (`SaveMenu.svelte`)
- **Copy:** `navigator.clipboard.writeText(poemText)`, then brief "Copied!".
- **Email:** `mailto:?subject=<encoded title>&body=<encoded poem>` via `encodeURIComponent`, lines joined by `\n`.
- **PDF:** "Download PDF" calls `window.print()`. `app.css` `@media print` hides drawer/toolbar/buttons and shows only the poem and date. Consider `jsPDF` only if one-click download is requested.
- Plain-text export: words joined by spaces; `break` → `\n`.

### Accessibility
- Chips and controls are real `<button>`s with visible focus styles.
- `aria-pressed` on chips; heading per bucket; poem canvas has an `aria-live="polite"` region (or summary).
- Selected state not shown by color alone: reduced opacity plus strikethrough or check icon.

## Build order (milestones)

1. Scaffold Svelte + Vite. Add hand-made sample `public/words/<date>.json` and `index.json`.
2. `loadWords.js` + `WordBank.svelte`, rendering the buckets.
3. Poem state + `Canvas.svelte`: select/deselect, line breaks, undo, clear.
4. Layout/responsive drawer + styling.
5. `SaveMenu`: copy, email, print-to-PDF with print styles.
6. `localStorage` persistence.
7. `scripts/fetch-words.mjs` with pronoun list + blocklist (done early, using Datamuse).
8. GitHub Action; run manually via `workflow_dispatch`.
9. Connect the repo to Vercel; confirm a bot commit triggers a redeploy.

## Decisions (2026-11-15)

- **Connecting words:** yes. A curated list of articles, prepositions and conjunctions ("the", "a", "of", "and", "beneath", ...) lives in `src/lib/connectors.js`. They are **reusable** (never grayed out) and **not** part of the 335 or the daily file.
- **Adverbs:** yes, as a fifth API bucket **within** the 335 (see the split above).
- **Reordering:** append-only for now. Remove and re-add to rearrange; insert-at-cursor may come later.
- **Language:** plain JavaScript.
- **Hosting:** Vercel.
- **Word source:** Datamuse instead of Wordnik (Wordnik keys need approval). No API key or `.env` needed.
- **Poem title:** optional, editable above the poem, saved with it, and used as the email subject and the printed heading.
- **Breakpoint:** at 800px and below the word bank becomes a bottom sheet and the toolbar sticks to the bottom of the screen.
- **Connectors** (confirmed as standard) also include helper verbs (is, are, was, be, have, do, will, can, could, should, may, might, must, ...) since Datamuse verbs don't include them reliably and poems need them.

## Conventions

- Keep it simple. School project: clear code over clever abstractions; avoid dependencies unless they save real work.
- Plain JavaScript (the scaffold uses `jsconfig.json`, not TypeScript).
- Small, focused components; shared state lives in `poem.svelte.js`.
- No secrets in client code or committed files. If one is ever needed, it goes in `.env` (gitignored).
