import { expect, test } from 'playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';

const output = path.resolve('.browser-courses');
const lessonUrl = (name: string) =>
  pathToFileURL(path.join(output, 'mcf-showcase', 'lessons', `${name}.html`)).href;
test.beforeEach(async ({ page }) => {
  await page.goto(lessonUrl('questions'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('practice retries and assessment submission are distinct', async ({ page }) => {
  const choice = page.locator('[data-id="one"]');
  await choice.getByLabel('PDF').check();
  await choice.getByRole('button', { name: 'Check answer' }).click();
  await expect(choice.locator('.feedback')).toContainText('Not quite');
  await expect(page.locator('[data-activity="choice-practice"]')).not.toHaveClass(/complete/);
  await choice.getByLabel('MCF').check();
  await choice.getByRole('button', { name: 'Check answer' }).click();
  await choice.getByRole('button', { name: 'Hint' }).click();
  await expect(choice.locator('.hint')).toBeVisible();
  await expect(choice.locator('.explanation')).toBeVisible();
  const many = page.locator('[data-id="many"]');
  await many.getByLabel('Notes').check();
  await many.getByLabel('Practice').check();
  await many.getByRole('button', { name: 'Check answer' }).click();
  const bool = page.locator('[data-id="boolean"]');
  await bool.getByLabel('False').check();
  await bool.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('[data-activity="choice-practice"]')).toHaveClass(/complete/);
  const assessment = page.locator('[data-activity="response-assessment"]');
  await assessment.getByRole('button', { name: 'Submit assessment' }).click();
  await expect(assessment.locator('.assessment-result')).toContainText('Complete all required');
  const essay = assessment.locator('[data-id="reflection"] textarea');
  await essay.fill('A local course.');
  await expect(assessment.locator('[data-id="reflection"] .feedback')).toContainText(
    'Write at least',
  );
  await essay.fill(
    'A local course can preserve learner progress. The course remains useful offline for focused study and review.',
  );
  await assessment.locator('[data-id="number"] input').fill('0');
  await assessment.locator('[data-id="words"] input').fill('wrong');
  await assessment.getByRole('button', { name: 'Submit assessment' }).click();
  await expect(assessment.locator('.assessment-result')).toContainText('Not passed');
  await expect(assessment).toHaveClass(/complete/);
  await assessment.locator('[data-id="number"] input').fill('42');
  await assessment.locator('[data-id="words"] input').fill('mcf');
  await assessment.getByRole('button', { name: 'Submit assessment' }).click();
  await expect(assessment.locator('.assessment-result')).toContainText('Passed');
  await expect(assessment.locator('.assessment-result')).toContainText(
    'Essays are completion-checked',
  );
  await expect(page.locator('[data-progress]').first()).toContainText('50%');
  await page.goto(lessonUrl('rich-content'));
  await page.getByRole('button', { name: 'Mark notes complete' }).click();
  await expect(page.locator('[data-progress]').first()).toContainText('100%');
  await expect(page.locator('.badge')).toBeVisible();
});

test('progress export and validated import restore state', async ({ page }) => {
  await page.locator('[data-id="words"] input').fill('MCF');
  await page.goto(pathToFileURL(path.join(output, 'mcf-showcase', 'index.html')).href);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).toBeTruthy();
  await page.evaluate(() => localStorage.clear());
  await Promise.all([page.waitForNavigation(), page.locator('[data-import]').setInputFiles(file!)]);
  await page.goto(lessonUrl('questions'));
  await expect(page.locator('[data-id="words"] input')).toHaveValue('MCF');
});

test('invalid progress import is rejected without replacing state', async ({ page }, testInfo) => {
  await page.locator('[data-id="words"] input').fill('kept');
  await page.goto(pathToFileURL(path.join(output, 'mcf-showcase', 'index.html')).href);
  const invalid = testInfo.outputPath('invalid-progress.json');
  await fs.writeFile(invalid, JSON.stringify({ schema: 99, courseId: 'wrong' }));
  const dialog = page.waitForEvent('dialog').then(async (value) => {
    expect(value.message()).toContain('not a valid progress file');
    await value.dismiss();
  });
  await page.locator('[data-import]').setInputFiles(invalid);
  await dialog;
  await page.goto(lessonUrl('questions'));
  await expect(page.locator('[data-id="words"] input')).toHaveValue('kept');
});

test('responses restore and notes completion updates progress', async ({ page }) => {
  await page.locator('[data-id="words"] input').fill('MCF');
  await page.reload();
  await expect(page.locator('[data-id="words"] input')).toHaveValue('MCF');
  await page.goto(lessonUrl('rich-content'));
  await page.getByRole('button', { name: 'Mark notes complete' }).click();
  await expect(page.locator('[data-progress]')).toContainText('50%');
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('audio')).toHaveAttribute('src', '../assets/audio/t-rex-roar.mp3');
  await expect(page.locator('video')).toHaveAttribute('src', '../assets/video/flower.mp4');
  await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed/);
  await expect(page.locator('.remote-video-fallback')).toBeVisible();
  await expect(page.locator('.remote-video-fallback')).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=Dw_tGRblTXk',
  );
});

test('phone layout stacks the shell without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lessonUrl('questions'));
  await expect(page.locator('.course-shell')).toHaveCSS('display', 'block');
  await expect(page.locator('.sidebar nav')).toHaveCSS('display', 'flex');
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
});
