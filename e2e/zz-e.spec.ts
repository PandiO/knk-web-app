import { test } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { mockDashboardTypes } from './fixtures/dashboardAccess';
import { mockTownDetail } from './fixtures/entityDetail';
test('e', async ({ page, api }) => {
  await startLoggedIn(page, 'access-1');
  mockSession(api, alex, () => true);
  mockContentDefaults(api);
  mockDashboardTypes(api);
  mockTownDetail(api, 14);
  await page.goto(process.env.U ?? '/display/Town/1');
  await page.waitForTimeout(2500);
  console.log('CALLS ' + [...new Set(api.requests.filter(r => !r.path.includes('permissions')).map(r => r.method + ' ' + r.path + '?' + r.query + ' ' + (api.unmocked.includes(r.method + ' ' + r.path) ? 'UNMOCKED' : '')))].join('\n  '));
  console.log('TEXT ' + (await page.locator('body').innerText()).slice(-900));
  console.log('BTN ' + (await page.getByRole('button').evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || e.textContent || '').trim() + (e.hasAttribute('disabled') ? '[dis]' : '')))).join(' | '));
  console.log('LINKS ' + (await page.getByRole('link').allInnerTexts()).slice(-20).join(' | '));
});
