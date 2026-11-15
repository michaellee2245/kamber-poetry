<script>
  import { poem, displayWord } from './poem.svelte.js';
  import { formatDate } from './loadWords.js';
  import SaveMenu from './SaveMenu.svelte';

  // onopenbank: shows the word bank on small screens.
  let { isToday, onopenbank } = $props();

  function clearPoem() {
    if (window.confirm('Clear your whole poem? This can’t be undone.')) poem.clear();
  }
</script>

<div class="canvas">
  <header class="top">
    <div class="heading">
      <p class="date">{formatDate(poem.date)}</p>
      {#if !isToday}
        <p class="notice">Today’s words aren’t ready yet, so these are the most recent ones.</p>
      {/if}
    </div>
    <div class="no-print"><SaveMenu /></div>
  </header>

  <article class="sheet">
    <label class="title">
      <span class="visually-hidden">Poem title (optional)</span>
      <input
        type="text"
        placeholder="Untitled"
        maxlength="80"
        value={poem.title}
        oninput={(e) => poem.setTitle(e.currentTarget.value)}
      />
    </label>
    <!-- Printed instead of the input, which doesn't print cleanly. -->
    <h1 class="print-title print-only">{poem.title.trim() || 'Untitled'}</h1>

    <div class="poem" aria-label="Your poem">
      {#each poem.tokens as token (token.id)}
        {#if token.type === 'break'}
          <button
            type="button"
            class="break no-print"
            onclick={() => poem.remove(token.id)}
            aria-label="Remove line break"
            title="Remove line break">↵</button
          ><br />
        {:else}
          <button
            type="button"
            class="word"
            onclick={() => poem.remove(token.id)}
            aria-label="Remove {displayWord(token.text)}"
            title="Click to remove">{displayWord(token.text)}</button
          >{' '}
        {/if}
      {:else}
        <p class="placeholder no-print">
          Pick words from the word bank to start your poem. Click a word here to take it back out.
        </p>
      {/each}
    </div>
    <p class="print-date print-only">{formatDate(poem.date)}</p>
  </article>

  <!-- Announces each change to screen readers. -->
  <p class="visually-hidden" aria-live="polite">{poem.announcement}</p>

  <div class="toolbar no-print" role="toolbar" aria-label="Poem tools">
    <button type="button" onclick={() => poem.addBreak()}>↵ Line break</button>
    <button type="button" onclick={() => poem.undo()} disabled={poem.isEmpty} title="Backspace">Undo</button>
    <button type="button" onclick={clearPoem} disabled={poem.isEmpty}>Clear</button>
    <button type="button" class="primary open-bank" onclick={onopenbank}>Word bank</button>
  </div>
</div>

<style>
  .canvas {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 46rem;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .date {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .notice {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--accent);
  }

  .sheet {
    background: var(--sheet);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.5rem clamp(1rem, 4vw, 2.5rem) 2rem;
    min-height: 16rem;
    box-shadow: var(--shadow);
  }

  .title input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    border-bottom: 1px solid transparent;
    background: none;
    color: var(--ink);
    font-family: var(--serif);
    font-size: 1.6rem;
    font-weight: 600;
    padding: 0.25rem 0;
    margin-bottom: 1rem;
  }

  .title input:hover,
  .title input:focus {
    border-bottom-color: var(--line);
  }

  .title input::placeholder {
    color: var(--muted);
    opacity: 0.7;
  }

  .poem {
    font-family: var(--serif);
    font-size: 1.35rem;
    line-height: 1.9;
  }

  /* Poem words look like text, but are buttons so they can be removed. */
  .word {
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    padding: 0 0.05em;
    border-radius: 4px;
    cursor: pointer;
  }

  .word:hover {
    background: var(--chip-hover);
    text-decoration: line-through;
    text-decoration-color: var(--accent);
  }

  .break {
    border: 1px dashed var(--line);
    background: none;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1;
    padding: 0.15em 0.35em;
    border-radius: 4px;
    vertical-align: middle;
    cursor: pointer;
  }

  .break:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .placeholder {
    margin: 0;
    color: var(--muted);
    font-size: 1.05rem;
    font-style: italic;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* The word bank button only shows when the bank is a bottom sheet. */
  .open-bank {
    margin-left: auto;
  }

  @media (min-width: 801px) {
    .open-bank {
      display: none;
    }
  }

  /* Phones: keep the tools within reach at the bottom of the screen. */
  @media (max-width: 800px) {
    .canvas {
      padding-bottom: 5rem;
    }

    .toolbar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 5;
      flex-wrap: nowrap;
      gap: 0.4rem;
      padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
      background: var(--panel);
      border-top: 1px solid var(--line);
    }

    .toolbar button {
      padding: 0.45em 0.7em;
      white-space: nowrap;
    }
  }

  @media print {
    .canvas {
      max-width: none;
      padding: 0;
    }

    .sheet {
      border: none;
      box-shadow: none;
      padding: 0;
      background: none;
    }

    .title {
      display: none;
    }

    .print-title {
      font-family: var(--serif);
      font-size: 22pt;
      margin: 0 0 18pt;
    }

    .poem {
      font-size: 15pt;
      line-height: 1.7;
    }

    .word {
      padding: 0;
    }

    .print-date {
      margin-top: 24pt;
      font-size: 10pt;
      color: #555;
    }

    .date,
    .notice {
      display: none;
    }
  }
</style>
