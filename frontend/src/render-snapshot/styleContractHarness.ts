import '../styles.css';

async function markStyleContractReady(): Promise<void> {
  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1_500)),
      ]);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    document.documentElement.dataset.knowledgeStyleContract = 'ready';
  } catch (error) {
    document.documentElement.dataset.knowledgeStyleContract = 'error';
    document.documentElement.dataset.knowledgeStyleContractError = error instanceof Error ? error.message : String(error);
  }
}

void markStyleContractReady();
