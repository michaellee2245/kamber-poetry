// Loads the day's word file. Uses today's file if it exists (by the user's
// local date), otherwise the newest one available.

const base = import.meta.env.BASE_URL;

// YYYY-MM-DD from the user's local clock.
export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-11-15" -> "Sunday, November 15, 2026" (parsed as a local date).
export function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function getJson(path) {
  // no-cache: always check with the server so a new day's file shows up.
  const res = await fetch(base + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
  return res.json();
}

export async function loadWords() {
  const index = await getJson('words/index.json');
  const today = localDate();
  const date = index.dates.includes(today) ? today : index.latest;
  if (!date) throw new Error('No word lists are available yet.');

  const data = await getJson(`words/${date}.json`);
  return { ...data, isToday: date === today };
}
