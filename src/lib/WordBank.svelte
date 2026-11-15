<script>
  import WordChip from './WordChip.svelte';
  import { poem } from './poem.svelte.js';
  import { connectors } from './connectors.js';

  // words: { noun: [...], verb: [...], ... } from the daily file.
  // onclose: only passed on small screens, where the bank is a bottom sheet.
  let { words, onclose } = $props();

  const LABELS = {
    noun: 'Nouns',
    verb: 'Verbs',
    adjective: 'Adjectives',
    adverb: 'Adverbs',
    pronoun: 'Pronouns',
    connector: 'Connectors',
  };

  // Daily buckets in a fixed order (skipping any missing from the file),
  // then the reusable connectors.
  const buckets = $derived([
    ...Object.keys(LABELS)
      .filter((b) => b !== 'connector' && words[b]?.length)
      .map((b) => ({ id: b, label: LABELS[b], words: words[b], reusable: false })),
    { id: 'connector', label: LABELS.connector, words: connectors, reusable: true },
  ]);

  let activeTab = $state('noun');
  let query = $state('');

  const searching = $derived(query.trim() !== '');

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return buckets
      .map((b) => ({ ...b, words: b.words.filter((w) => w.includes(q)) }))
      .filter((b) => b.words.length > 0);
  });

  const usedCount = (bucket) =>
    bucket.reusable ? null : bucket.words.filter((w) => poem.isSelected(bucket.id, w)).length;

  function choose(bucket, text) {
    if (bucket.reusable) poem.addConnector(text);
    else poem.toggleWord(bucket.id, text);
  }

  // Left/Right arrows move between tabs (standard tab keyboard pattern).
  function onTabKeydown(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = buckets[(index + step + buckets.length) % buckets.length];
    activeTab = next.id;
    document.getElementById(`tab-${next.id}`)?.focus();
  }
</script>

{#snippet chipList(bucket)}
  <ul class="chips">
    {#each bucket.words as text (text)}
      <li>
        <WordChip
          {text}
          selected={bucket.reusable ? undefined : poem.isSelected(bucket.id, text)}
          onclick={() => choose(bucket, text)}
        />
      </li>
    {/each}
  </ul>
{/snippet}

<div class="bank">
  <div class="bank-header">
    <h2>Word bank</h2>
    {#if onclose}
      <button type="button" class="close" onclick={onclose} aria-label="Close word bank">✕</button>
    {/if}
  </div>

  <label class="search">
    <span class="visually-hidden">Search words</span>
    <input type="search" placeholder="Search all words…" bind:value={query} autocomplete="off" />
  </label>

  {#if searching}
    <div class="panel">
      {#each results as bucket (bucket.id)}
        <section>
          <h3>{bucket.label} <span class="count">{bucket.words.length}</span></h3>
          {@render chipList(bucket)}
        </section>
      {:else}
        <p class="empty">No words match “{query.trim()}”.</p>
      {/each}
    </div>
  {:else}
    <div class="tabs" role="tablist" aria-label="Word types">
      {#each buckets as bucket, i (bucket.id)}
        {@const used = usedCount(bucket)}
        <button
          type="button"
          role="tab"
          id="tab-{bucket.id}"
          aria-selected={activeTab === bucket.id}
          aria-controls="panel-{bucket.id}"
          tabindex={activeTab === bucket.id ? 0 : -1}
          onclick={() => (activeTab = bucket.id)}
          onkeydown={(e) => onTabKeydown(e, i)}
        >
          {bucket.label}
          <span class="count">{used ? `${used}/` : ''}{bucket.words.length}</span>
        </button>
      {/each}
    </div>

    {#each buckets as bucket (bucket.id)}
      {#if activeTab === bucket.id}
        <div class="panel" role="tabpanel" id="panel-{bucket.id}" aria-labelledby="tab-{bucket.id}">
          <h3 class="visually-hidden">{bucket.label}</h3>
          {#if bucket.reusable}
            <p class="hint">Connecting words can be used as many times as you like.</p>
          {/if}
          {@render chipList(bucket)}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .bank {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .bank-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }

  .close {
    border: none;
    background: none;
    color: var(--ink);
    font-size: 1.1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .search {
    padding: 0 1rem 0.75rem;
  }

  .search input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0 1rem 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  [role='tab'] {
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
  }

  [role='tab']:hover {
    color: var(--ink);
  }

  [role='tab'][aria-selected='true'] {
    background: var(--paper);
    border-color: var(--line);
    color: var(--ink);
    font-weight: 600;
  }

  .count {
    font-size: 0.8em;
    font-weight: 400;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem 1rem 1.5rem;
  }

  h3 {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }

  section + section {
    margin-top: 1rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hint,
  .empty {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
