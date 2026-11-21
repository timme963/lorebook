import { expect, test } from '@playwright/test';
import { completeDemoChapter, DEMO_COURSE, loadDemo } from './helpers';

test('demo chapter can be played through and fills the review', async ({ page }) => {
  await loadDemo(page);
  await completeDemoChapter(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Wiederholungen machen/ })).toBeVisible();
});

test('a card rated "again" comes back in the same session', async ({ page }) => {
  await loadDemo(page);
  await completeDemoChapter(page);
  await page.goto('/#/review');

  const counter = page.locator('.row.between .muted').filter({ hasText: '/' });
  const total = Number((await counter.textContent())?.split('/')[1]?.trim());
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  // the queue is shuffled: an open question is self-rated first, the others offer "again" right away
  const applyRating = page.getByRole('button', { name: 'Bewertung übernehmen' });
  const again = page.getByRole('button', { name: /Weiter \(kommt in|^Nochmal/ });
  await expect(applyRating.or(again).first()).toBeVisible();
  if (await applyRating.isVisible()) await applyRating.click();
  await again.first().click();
  await expect(counter).toHaveText(`2 / ${total + 1}`);
});

test('a question can be corrected during review', async ({ page }) => {
  await loadDemo(page);
  await completeDemoChapter(page);
  await page.goto('/#/review');

  await page.getByRole('button', { name: '✎ Frage bearbeiten' }).click();
  const prompt = page.locator('.question-editor textarea').first();
  await prompt.fill('Korrigierte Frage ___ für den Test?');
  // a cloze prompt needs a blank, other types accept the text as is
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.q-prompt')).toContainText('Korrigierte Frage');
  // the edit is stored in the chapter, not only shown
  const stored = await page.evaluate(async () => {
    const request = indexedDB.open('lorebook');
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const chapters = await new Promise<
      { content: { pretest: { prompt: string }[]; posttest: { prompt: string }[]; review: { prompt: string }[] } }[]
    >((resolve) => {
      const all = db.transaction('chapters').objectStore('chapters').getAll();
      all.onsuccess = () => resolve(all.result as never);
    });
    db.close();
    return chapters
      .flatMap((c) => [...c.content.pretest, ...c.content.posttest, ...c.content.review])
      .map((q) => q.prompt);
  });
  expect(stored).toContain('Korrigierte Frage ___ für den Test?');
});

test('the mock exam runs, is handed in and estimates a grade', async ({ page }) => {
  await loadDemo(page);
  await completeDemoChapter(page);
  await page.goto(`/#/exam/${DEMO_COURSE}`);

  await page
    .getByRole('button', { name: /Fragen$/ })
    .first()
    .click();
  await expect(page.locator('.exam-clock')).toContainText(':');
  await expect(page.locator('.feedback')).toHaveCount(0);

  await page.getByRole('button', { name: 'Klausur abgeben' }).click();
  await page.locator('section.card').filter({ hasText: 'abgeben?' }).getByRole('button', { name: 'Abgeben' }).click();
  const score = page.getByRole('button', { name: 'Auswerten' });
  if (await score.isVisible()) await score.click();

  await expect(page.getByText('geschätzte Note')).toBeVisible();
  await expect(page.locator('.result .big.accent')).toHaveText('5,0');
  await expect(page.locator('.exam-review li').first()).toBeVisible();
});
