// Shared poem state. Components import `poem` and call its methods.
//
// The poem is an ordered list of tokens:
//   { id, type: 'word', text, bucket, reusable } | { id, type: 'break' }
// Daily words use the id `bucket:word`, so each can only be used once.
// Connectors are reusable, so each use gets its own unique id.

const STORAGE_PREFIX = 'poem:';

export const wordId = (bucket, text) => `${bucket}:${text}`;

// "i" is stored lowercase in the word files but should read as "I".
export const displayWord = (text) => (text === 'i' ? 'I' : text);

const uniqueId = (prefix) => `${prefix}:${crypto.randomUUID()}`;

class Poem {
  date = null;
  title = $state('');
  tokens = $state([]);
  // Short message for screen readers, read out by the aria-live region.
  announcement = $state('');

  // Ids of daily words currently in the poem (connectors never count).
  selectedIds = $derived(
    new Set(this.tokens.filter((t) => t.type === 'word' && !t.reusable).map((t) => t.id)),
  );

  isEmpty = $derived(this.tokens.length === 0);

  // Plain text: words joined by spaces, a break starts a new line.
  text = $derived.by(() => {
    const lines = [[]];
    for (const t of this.tokens) {
      if (t.type === 'break') lines.push([]);
      else lines.at(-1).push(displayWord(t.text));
    }
    return lines.map((words) => words.join(' ')).join('\n');
  });

  isSelected(bucket, text) {
    return this.selectedIds.has(wordId(bucket, text));
  }

  // Click on a daily word in the bank: add it, or remove it if already used.
  toggleWord(bucket, text) {
    const id = wordId(bucket, text);
    if (this.selectedIds.has(id)) {
      this.remove(id);
    } else {
      this.tokens.push({ id, type: 'word', text, bucket, reusable: false });
      this.#changed(`Added ${displayWord(text)}`);
    }
  }

  // Click on a connector: always adds another copy.
  addConnector(text) {
    this.tokens.push({ id: uniqueId('connector'), type: 'word', text, bucket: 'connector', reusable: true });
    this.#changed(`Added ${text}`);
  }

  addBreak() {
    this.tokens.push({ id: uniqueId('break'), type: 'break' });
    this.#changed('New line');
  }

  remove(id) {
    const token = this.tokens.find((t) => t.id === id);
    if (!token) return;
    this.tokens = this.tokens.filter((t) => t.id !== id);
    this.#changed(token.type === 'break' ? 'Removed line break' : `Removed ${displayWord(token.text)}`);
  }

  undo() {
    const last = this.tokens.at(-1);
    if (last) this.remove(last.id);
  }

  clear() {
    this.tokens = [];
    this.#changed('Poem cleared');
  }

  setTitle(title) {
    this.title = title;
    this.#save();
  }

  // Call once the day's words are loaded. Restores a saved poem for the
  // same day and throws away poems saved on other days.
  load(date) {
    this.date = date;
    this.title = '';
    this.tokens = [];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + date) ?? 'null');
      if (saved && Array.isArray(saved.tokens)) {
        this.tokens = saved.tokens;
        this.title = typeof saved.title === 'string' ? saved.title : '';
      }
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(STORAGE_PREFIX) && key !== STORAGE_PREFIX + date) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Storage blocked or bad data: start with an empty poem.
    }
  }

  #changed(message) {
    this.announcement = message;
    this.#save();
  }

  #save() {
    if (!this.date) return;
    try {
      localStorage.setItem(
        STORAGE_PREFIX + this.date,
        JSON.stringify({ title: this.title, tokens: this.tokens }),
      );
    } catch {
      // Storage full or blocked: the poem still works, it just won't persist.
    }
  }
}

export const poem = new Poem();
