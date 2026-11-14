import { expect, type Page } from '@playwright/test';

/**
 * Layout checks the smoke tests asked a person to do by eye (backfill PandiO/knk-workspace#511).
 */

/** Nothing scrolls the page sideways: the document is no wider than the viewport (1 px rounding allowed). */
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
}
