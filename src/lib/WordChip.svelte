<script>
  import { displayWord } from './poem.svelte.js';

  // `selected` is undefined for reusable words (connectors), which have no
  // on/off state, so they get no aria-pressed.
  let { text, selected, onclick } = $props();
</script>

<button
  type="button"
  class="chip"
  class:selected
  class:reusable={selected === undefined}
  aria-pressed={selected}
  {onclick}
>
  {#if selected}<span class="check" aria-hidden="true">✓</span>{/if}
  {displayWord(text)}
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    padding: 0.3em 0.7em;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--ink);
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.3;
    cursor: pointer;
    transition: background-color 0.12s, border-color 0.12s, opacity 0.12s;
  }

  .chip:hover {
    border-color: var(--accent);
    background: var(--chip-hover);
  }

  .reusable {
    border-style: dashed;
  }

  /* Used words: faded, struck through and checked, so it's not color alone. */
  .selected {
    opacity: 0.35;
    text-decoration: line-through;
  }

  .selected:hover {
    opacity: 0.6;
  }

  .check {
    font-size: 0.8em;
  }
</style>
