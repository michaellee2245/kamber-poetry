<script>
  import { poem } from './poem.svelte.js';
  import { formatDate } from './loadWords.js';

  let status = $state('');
  let timer;

  const subject = $derived(poem.title.trim() || `My poem for ${formatDate(poem.date)}`);
  const mailto = $derived(
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(poem.text)}`,
  );

  function flash(message) {
    status = message;
    clearTimeout(timer);
    timer = setTimeout(() => (status = ''), 2000);
  }

  async function copy() {
    const text = poem.title.trim() ? `${poem.title.trim()}\n\n${poem.text}` : poem.text;
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied!');
    } catch {
      flash("Couldn't copy");
    }
  }
</script>

<div class="save" role="group" aria-label="Save your poem">
  <button type="button" onclick={copy} disabled={poem.isEmpty}>Copy</button>
  {#if poem.isEmpty}
    <button type="button" disabled>Email</button>
  {:else}
    <a class="button" href={mailto}>Email</a>
  {/if}
  <button type="button" onclick={() => window.print()} disabled={poem.isEmpty}>Download PDF</button>
  <span class="status" role="status">{status}</span>
</div>

<style>
  .save {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .status {
    font-size: 0.85rem;
    color: var(--accent);
  }
</style>
