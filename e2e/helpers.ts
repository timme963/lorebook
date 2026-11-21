import { expect, type Locator, type Page } from '@playwright/test';

export const DEMO_COURSE = 'demo-wie-lernen-hangen-bleibt';
export const DEMO_CHAPTER = `${DEMO_COURSE}:1`;

/** Loads the demo chapter through the empty home page. */
export async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo-Kapitel ausprobieren' }).click();
  await expect(page).toHaveURL(new RegExp(`#/course/${DEMO_COURSE}$`));
}

/**
 * Clicks if the element is there. The chapter re-renders after every answer, so a button seen a moment ago may
 * be gone; the loops below simply look again instead of waiting for it.
 */
async function clickIfPresent(locator: Locator): Promise<boolean> {
  if (!(await locator.isVisible())) return false;
  try {
    await locator.click({ timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

/** Plays through the demo chapter with "don't know" answers, so every question ends up due for review. */
export async function completeDemoChapter(page: Page): Promise<void> {
  await page.goto(`/#/chapter/${DEMO_CHAPTER}`);
  await page.getByRole('button', { name: "Los geht's" }).click();

  const dontKnow = page.getByRole('button', { name: 'Weiß ich nicht' });
  const concept = page.getByRole('button', { name: /Was steckt dahinter\?/ });
  const next = page.getByRole('button', { name: 'Weiter →', exact: true });
  const toPost = page.getByRole('button', { name: 'Zu den Nachfragen →' });
  const done = page.getByRole('button', { name: 'Story nochmal lesen' });
  const applyRating = page.getByRole('button', { name: 'Bewertung übernehmen' });

  // pre-questions (no feedback): answer until the story starts
  await dontKnow.waitFor();
  while (!(await concept.isVisible())) {
    if (!(await clickIfPresent(dontKnow))) await page.waitForTimeout(50);
  }

  // story: open each concept, go to the next scene until the post-questions
  while (!(await toPost.isVisible())) {
    const clicked =
      (await clickIfPresent(concept)) ||
      ((await next.isEnabled({ timeout: 500 }).catch(() => false)) && (await clickIfPresent(next)));
    if (!clicked) await page.waitForTimeout(50);
  }
  await toPost.click();

  // post-questions (feedback after each answer; open questions are self-rated, here with nothing ticked)
  while (!(await done.isVisible())) {
    const clicked =
      (await clickIfPresent(dontKnow)) || (await clickIfPresent(applyRating)) || (await clickIfPresent(next));
    if (!clicked) await page.waitForTimeout(50);
  }
}
