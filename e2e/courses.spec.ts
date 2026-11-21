import { expect, test, type Page } from '@playwright/test';
import { DEMO_COURSE, loadDemo } from './helpers';

/** Course file of the loaded demo, renamed so it imports as a second course. */
async function demoShareAs(page: Page, title: string): Promise<string> {
  return page.evaluate(
    async ([courseId, newTitle, modulePath]) => {
      // the dev server serves the app's modules, so the test can build the file the way the app does
      const { buildCourseShare } = (await import(/* @vite-ignore */ modulePath)) as typeof import('../src/lib/share');
      const share = await buildCourseShare(courseId);
      share.course.title = newTitle;
      return JSON.stringify(share);
    },
    [DEMO_COURSE, title, '/src/lib/share.ts'] as const,
  );
}

async function importShare(page: Page, json: string): Promise<void> {
  await page.goto('/#/import');
  await page.getByPlaceholder(/Antwort aus dem Chat hier einfügen/).fill(json);
  await page.getByRole('button', { name: 'Kurs importieren' }).click();
}

test('a shared course file imports as a course of its own', async ({ page }) => {
  await loadDemo(page);
  await importShare(page, await demoShareAs(page, 'Geteilter Kurs'));
  await expect(page).toHaveURL(/#\/course\/geteilter-kurs$/);
  await expect(page.getByRole('heading', { name: 'Geteilter Kurs' })).toBeVisible();
});

test('a shared course with the title of an existing course does not touch it', async ({ page }) => {
  await loadDemo(page);
  // same title as the loaded demo course
  await importShare(page, await demoShareAs(page, 'Demo: Wie Lernen hängen bleibt'));
  await expect(page).toHaveURL(new RegExp(`#/course/${DEMO_COURSE}-2$`));
  await page.goto('/');
  await expect(page.locator('.course-card')).toHaveCount(2);
});

test('starred courses stay on top and the order can be dragged', async ({ page }) => {
  await loadDemo(page);
  await importShare(page, await demoShareAs(page, 'Zweiter Kurs'));
  await page.goto('/');

  const titles = page.locator('.course-card h3');
  const order = async () => titles.allTextContents();
  const [first, second] = await order();

  // drag the second card onto the first one
  const handle = page.locator('.course-card').nth(1).locator('.drag-handle');
  const target = page.locator('.course-card').nth(0);
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('cards not laid out');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(titles).toHaveText([second ?? '', first ?? '']);

  // starring the (now) second course pins it to the top
  await page.locator('.course-card').nth(1).getByRole('button', { name: 'Mit Stern nach oben' }).click();
  await expect(titles).toHaveText([first ?? '', second ?? '']);
  await page.reload();
  await expect(titles).toHaveText([first ?? '', second ?? '']);
});

test('the cheat sheet lists every objective with its summary', async ({ page }) => {
  await loadDemo(page);
  await page.goto(`/#/sheet/${DEMO_COURSE}`);
  await expect(page.locator('.sheet-list dt')).toHaveCount(4);
  await expect(page.locator('.sheet-list dd').first()).toContainText('Wer vor dem Lesen Fragen zum Stoff beantwortet');
  await expect(page.locator('.sheet-list dd em')).toHaveCount(0);
});
