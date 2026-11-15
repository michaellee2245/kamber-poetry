<script>
  import { onMount } from 'svelte';
  import Canvas from './lib/Canvas.svelte';
  import WordBank from './lib/WordBank.svelte';
  import { loadWords } from './lib/loadWords.js';
  import { poem } from './lib/poem.svelte.js';

  let status = $state('loading'); // 'loading' | 'ready' | 'error'
  let errorMessage = $state('');
  let wordSet = $state(null);

  // On small screens the word bank is a bottom sheet that opens and closes.
  let isMobile = $state(false);
  let bankOpen = $state(false);
  let bankEl = $state();

  async function load() {
    status = 'loading';
    try {
      wordSet = await loadWords();
      poem.load(wordSet.date);
      status = 'ready';
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    }
  }

  onMount(() => {
    load();
    const mq = window.matchMedia('(max-width: 800px)');
    isMobile = mq.matches;
    const onChange = (e) => (isMobile = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  function openBank() {
    bankOpen = true;
    // Wait for the sheet to stop being inert, then move focus into it.
    requestAnimationFrame(() => bankEl?.focus());
  }

  // Backspace = undo, unless the user is typing in a text field.
  function onkeydown(event) {
    if (status !== 'ready') return;
    const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
    if (event.key === 'Backspace' && !typing) {
      event.preventDefault();
      poem.undo();
    } else if (event.key === 'Escape' && isMobile && bankOpen) {
      bankOpen = false;
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="layout">
  <main>
    <header class="site no-print">
      <span class="brand">Daily Word Poem</span>
    </header>

    {#if status === 'loading'}
      <p class="state" role="status">Gathering today’s words…</p>
    {:else if status === 'error'}
      <div class="state" role="alert">
        <p>Sorry, today’s words couldn’t be loaded.</p>
        <p class="detail">{errorMessage}</p>
        <button type="button" onclick={load}>Try again</button>
      </div>
    {:else}
      <Canvas isToday={wordSet.isToday} onopenbank={openBank} />
    {/if}
  </main>

  {#if status === 'ready'}
    <aside
      class="drawer no-print"
      class:open={bankOpen}
      inert={isMobile && !bankOpen}
      bind:this={bankEl}
      tabindex="-1"
      aria-label="Word bank"
    >
      <WordBank words={wordSet.words} onclose={isMobile ? () => (bankOpen = false) : undefined} />
    </aside>
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    height: 100dvh;
  }

  main {
    overflow-y: auto;
  }

  .site {
    padding: 1rem 1rem 0;
    max-width: 46rem;
    margin: 0 auto;
  }

  .brand {
    font-family: var(--serif);
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .state {
    max-width: 46rem;
    margin: 3rem auto;
    padding: 0 1rem;
    color: var(--muted);
  }

  .detail {
    font-size: 0.85rem;
  }

  .drawer {
    min-height: 0;
    background: var(--panel);
    border-left: 1px solid var(--line);
    outline: none;
  }

  /* Phones and small tablets: the bank becomes a bottom sheet. */
  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .drawer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      height: 65dvh;
      border-left: none;
      border-top: 1px solid var(--line);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 30px rgb(0 0 0 / 0.15);
      transform: translateY(100%);
      visibility: hidden;
      transition: transform 0.25s ease, visibility 0.25s;
    }

    .drawer.open {
      transform: translateY(0);
      visibility: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer {
      transition: none;
    }
  }

  @media print {
    .layout {
      display: block;
      height: auto;
    }

    main {
      overflow: visible;
    }
  }
</style>
