import { test, expect } from './support/mockApi';
import type { MockApi } from './support/mockApi';
import { alex, mockSession, startLoggedIn } from './fixtures/auth';
import { mockContentDefaults } from './fixtures/content';
import { generalDisplay } from './fixtures/territory';
import {
  APPLE,
  ENTRY_APPLE,
  FOOD,
  LEVEL_2,
  PHOENIX,
  SHOP,
  SHOP_MERCHANDISE,
  SHOP_TYPE,
  TOOLS,
  TOWN_ACCOUNT,
  WORLD,
  bakeryShop,
  bakeryType,
  mockPaged,
  mockShopLookups,
  mockShopPage,
  mockTradeStats,
  phoenixAccount,
  phoenixLedger,
  shopMetadata,
  shopRows,
  shopTradeStatMetadata,
  shopTypeMetadata,
  shopTypeRows,
  townAccountMetadata,
  townAccountRows,
} from './fixtures/shops';
import type { DisplayConfigurationDto } from '../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../src/types/dtos/metadata/MetadataModels';
import type { FormConfigurationDto } from '../src/types/dtos/forms/FormModels';
import type { PagedQueryDto, PagedResultDto } from '../src/types/dtos/common/PagedQuery';
import type { ProductionWorldListDto } from '../src/types/dtos/structure/ProductionWorldDtos';
import type {
  ShopCatalogueEntryDto,
  ShopDto,
  ShopTradeStatRebuildResultDto,
  ShopTypeDto,
  ShopTypeLevelDto,
  ShopTypeListDto,
  TownAccountDto,
  TownAccountEntryDto,
  TownAccountListDto,
} from '../src/types/dtos/production/ShopDtos';
import type { StockPagedResultDto } from '../src/types/dtos/stock/StockDtos';

/**
 * Shops P10c in the web app (PandiO/knk-workspace#688; shops DESIGN § 2-5, § 9, decision G17, acceptance A18, A23): a
 * shop type's accepted categories (`acceptedCategoryIds`) and levels; a shop's summary, town account, offer, catalogue
 * editor, sales and buy-backs and the hourly trade stats chart, with its processing and consumer views; a town account's
 * balance and ledger; the dashboard lists. Smoke test: knk-workspace docs/guides/production-storage-transport-smoke-test.md
 * § 11.3.
 */

const nodes = (...held: string[]) => (node: string) => held.includes(node);
/** Creates and edits need the World area's node and knk.admin.content (the API's dashboard change rule). */
const CONTENT = 'knk.admin.content';

test.beforeEach(async ({ page }) => {
  await startLoggedIn(page, 'access-1');
});

/** A detail page: metadata, a one-field display and the realtime hub offline. */
function mockDetailPage(api: MockApi, metadata: EntityMetadataDto, id: string): void {
  mockContentDefaults(api);
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [metadata]);
  api.json<DisplayConfigurationDto>('GET', `DisplayConfigurations/entity/${metadata.entityName}`, generalDisplay(metadata.entityName, id));
  api.on('POST', 'hubs/web/negotiate', { status: 404 });
}

test.describe('a shop type', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, shopTypeMetadata, '950');
    mockShopLookups(api);
    api.json<ShopTypeDto>('GET', `ShopTypes/${SHOP_TYPE}`, bakeryType());
  });

  test('lists its accepted categories and its levels with multipliers, caps and the default min and max', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);

    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await expect(panel.getByRole('list', { name: 'Accepted categories' })).toHaveText(/Food/);
    const levels = panel.getByRole('table', { name: 'Levels' });
    await expect(levels.getByRole('row')).toHaveCount(3);
    await expect(levels.getByRole('row').nth(1)).toHaveText(/Level 1\s*× 1\s*× 1\s*× 1\s*× 1\s*640\s*320\s*-\s*16 \/ 64/);
    await expect(levels.getByRole('row').nth(2)).toHaveText(/Level 2\s*× 1.25\s*× 1.1\s*× 0.9\s*× 1.2\s*1280\s*640\s*64\s*32 \/ 128/);
    await expect(levels.getByRole('link', { name: 'Level 2' })).toHaveAttribute('href', new RegExp(`/display/ShopTypeLevel/${LEVEL_2}`));
  });

  test('a category is added and one removed, and the whole list is saved as acceptedCategoryIds', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    api.json<ShopTypeDto>('PUT', `ShopTypes/${SHOP_TYPE}`, bakeryType({ acceptedCategories: [{ id: TOOLS, name: 'Tools' }] }));
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);

    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await expect(panel.getByRole('button', { name: 'Save the categories' })).toBeDisabled();
    await panel.getByLabel('Add a category').fill('Too');
    await panel.getByRole('button', { name: 'Tools' }).click();
    await panel.getByRole('button', { name: 'Remove Food' }).click();
    await expect(panel.getByRole('list', { name: 'Accepted categories' })).toHaveText(/^Tools/);
    await panel.getByRole('button', { name: 'Save the categories' }).click();

    await expect(panel.getByRole('status')).toHaveText('Accepted categories saved: Tools.');
    expect(api.calls('PUT', `ShopTypes/${SHOP_TYPE}`)[0].body).toEqual({ id: SHOP_TYPE, acceptedCategoryIds: [TOOLS] });
  });

  test("the API's refusal of a category list is shown", async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    api.on('PUT', `ShopTypes/${SHOP_TYPE}`, { status: 400, body: { error: 'Category 13 not found.' } });
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);

    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await panel.getByLabel('Add a category').fill('Tools');
    await panel.getByRole('button', { name: 'Tools' }).click();
    await panel.getByRole('button', { name: 'Save the categories' }).click();
    await expect(panel.getByRole('alert')).toContainText('Category 13 not found.');
    expect(api.calls('PUT', `ShopTypes/${SHOP_TYPE}`)[0].body).toEqual({ id: SHOP_TYPE, acceptedCategoryIds: [FOOD, TOOLS] });
  });

  test('a level is added after its checks, edited and deleted (levels on the production level pattern)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT, 'knk.admin.delete'));
    api.json<ShopTypeLevelDto>('POST', /^ShopTypeLevels\/?$/, { id: 93, shopTypeId: SHOP_TYPE, level: 3 });
    api.json<ShopTypeLevelDto>('PUT', `ShopTypeLevels/${LEVEL_2}`, { id: LEVEL_2, shopTypeId: SHOP_TYPE, level: 2 });
    api.on('DELETE', `ShopTypeLevels/${LEVEL_2}`, { status: 204 });
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);

    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await panel.getByRole('button', { name: 'Add a level' }).click();
    const form = panel.getByRole('group', { name: 'New level' });
    await expect(form.getByLabel('Level', { exact: true })).toHaveValue('3');
    await form.getByLabel('Level', { exact: true }).fill('2');
    await form.getByLabel('Price ×').fill('0');
    await form.getByLabel('Default min').fill('50');
    await form.getByLabel('Default max').fill('40');
    await expect(form.getByRole('list', { name: 'Level problems' }).getByRole('listitem')).toHaveText([
      'The shop type already has level 2.',
      'The price multiplier is above 0 and at most 100.',
      'The default max is below the default min.',
    ]);
    await expect(form.getByRole('button', { name: 'Save the level' })).toBeDisabled();
    await form.getByLabel('Level', { exact: true }).fill('3');
    await form.getByLabel('Price ×').fill('1.5');
    await form.getByLabel('Default max').fill('200');
    await form.getByLabel('Merchandise cap').fill('2560');
    await form.getByRole('button', { name: 'Save the level' }).click();

    await expect(panel.getByRole('status')).toHaveText('Level 3 saved; shops of this type at that level use it now.');
    expect(api.calls('POST', /^ShopTypeLevels\/?$/)[0].body).toEqual({
      id: null, shopTypeId: SHOP_TYPE, level: 3, cycleSpeedMultiplier: 1, yieldMultiplier: 1, inputCostMultiplier: 1, priceMultiplier: 1.5,
      merchandiseMaxUnits: 2560, inputMaxUnits: 0, unitsPerSlot: 0, reorderPointUnits: 50, targetUnits: 200,
    });

    await panel.getByRole('button', { name: 'Edit level 2' }).click();
    const edit = panel.getByRole('group', { name: 'Edit level 2' });
    await expect(edit.getByLabel('Price ×')).toHaveValue('1.2');
    await edit.getByLabel('Units per slot').fill('');
    await edit.getByRole('button', { name: 'Save the level' }).click();
    await expect.poll(() => api.calls('PUT', `ShopTypeLevels/${LEVEL_2}`).length).toBe(1);
    expect(api.calls('PUT', `ShopTypeLevels/${LEVEL_2}`)[0].body).toMatchObject({ id: LEVEL_2, level: 2, priceMultiplier: 1.2, unitsPerSlot: 0, targetUnits: 128 });

    await panel.getByRole('button', { name: 'Delete level 2' }).click();
    await expect(panel.getByRole('status')).toHaveText('Level 2 deleted.');
    expect(api.calls('DELETE', `ShopTypeLevels/${LEVEL_2}`)).toHaveLength(1);
  });

  test('without knk.admin.delete a level can be edited but not deleted', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT));
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);
    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await expect(panel.getByRole('button', { name: 'Delete level 1' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Edit level 1' })).toBeEnabled();
  });

  test('without knk.admin.content the categories and levels are read only, with the node named', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);
    const panel = page.getByRole('region', { name: 'Accepted categories and levels' });
    await expect(panel.getByRole('button', { name: 'Add a level' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Add a level' })).toHaveAttribute('title', 'Requires knk.admin.content');
    await expect(panel.getByRole('button', { name: 'Edit level 1' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Remove Food' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Save the categories' })).toBeDisabled();
  });

  test('a type without categories buys nothing; without levels its shops use × 1', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ShopTypeDto>('GET', `ShopTypes/${SHOP_TYPE}`, bakeryType({ acceptedCategories: [], levels: [] }));
    await page.goto(`/display/ShopType/${SHOP_TYPE}`);
    await expect(page.getByTestId('shop-type-no-categories')).toHaveText('None: its shops buy nothing from players.');
    await expect(page.getByTestId('shop-type-no-levels')).toContainText('No levels yet');
  });
});

test.describe('a shop', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ page, api }) => {
    await page.clock.setFixedTime(new Date('2026-11-21T12:30:00Z'));
    mockDetailPage(api, shopMetadata, '951');
    mockShopLookups(api);
    mockShopPage(api);
  });

  test('shows its kind, type and level, prices, worker, storages, town account and what it offers now (A18)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/Shop/${SHOP}`);

    const panel = page.getByRole('region', { name: 'Shop', exact: true });
    await expect(panel.getByTestId('shop-kind')).toHaveText('Processing (Input → Merchandise, then sells)');
    await expect(panel.getByTestId('shop-type-level')).toHaveText('Bakery, level 2');
    await expect(panel.getByTestId('shop-prices')).toHaveText('tax × 1.1, buys back at 50%');
    await expect(panel.getByTestId('shop-worker')).toHaveText('0 of 1 present: away restocking, processing is lowered (selling goes on)');
    await expect(panel.getByTestId('shop-storages')).toHaveText('Phoenix bakery - input (Input), Phoenix bakery - merchandise (Merchandise)');
    await expect(panel.getByTestId('shop-storages').getByRole('link', { name: 'Phoenix bakery - merchandise' }))
      .toHaveAttribute('href', new RegExp(`/display/Storage/${SHOP_MERCHANDISE}`));
    const account = panel.getByTestId('shop-town-account').getByRole('link');
    await expect(account).toHaveText('Phoenix: 1,250 coins');
    await expect(account).toHaveAttribute('href', new RegExp(`/display/TownAccount/${TOWN_ACCOUNT}`));

    const offer = panel.getByRole('table', { name: 'Offer' });
    await expect(offer.getByRole('row').nth(1)).toHaveText(/Bread\s*12 coins\s*static price\s*Unlimited\s*Pinned/);
    await expect(offer.getByRole('row').nth(2)).toHaveText(/Apple\s*4 coins\s*formula\s*0\s*Sold out/);
    await expect(offer.getByRole('row').nth(2)).toHaveClass(/line-through/);
    await expect(offer.getByRole('row').nth(3)).toHaveText(/Diamond sword \(Sharpness 3\)\s*330 coins\s*formula\s*1\s*Bought back, resold as this item/);
    await expect(panel.getByTestId('shop-offer-summary')).toContainText('sold-out items are greyed out');
    expect(api.calls('POST', 'ShopCatalogueEntries/search')[0].body).toEqual({ pageNumber: 1, pageSize: 200, filters: { shopId: String(SHOP) } });
  });

  test('the shop without a town account yet says it opens with the first sale', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.on('GET', `TownAccounts/by-town/${PHOENIX}`, { status: 404, body: { error: 'No account.' } });
    await page.goto(`/display/Shop/${SHOP}`);
    await expect(page.getByTestId('shop-town-account')).toHaveText('No account yet: it opens with the first sale');
  });

  test('the catalogue lists pinned entries first and is edited: add, a refused add, edit and delete', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD, CONTENT, 'knk.admin.delete'));
    api.json<ShopCatalogueEntryDto>('POST', /^ShopCatalogueEntries\/?$/, { id: 53, shopId: SHOP, itemBlueprintId: 18, itemBlueprint: { id: 18, name: 'Diamond sword' }, itemInstanceId: 7002 });
    api.json<ShopCatalogueEntryDto>('PUT', `ShopCatalogueEntries/${ENTRY_APPLE}`, { id: ENTRY_APPLE, shopId: SHOP, itemBlueprintId: APPLE, itemBlueprint: { id: APPLE, name: 'Apple' } });
    api.on('DELETE', `ShopCatalogueEntries/${ENTRY_APPLE}`, { status: 204 });
    await page.goto(`/display/Shop/${SHOP}`);

    const catalogue = page.getByTestId('shop-catalogue');
    const table = catalogue.getByRole('table', { name: 'Catalogue' });
    await expect(table.getByRole('row').nth(1)).toHaveText(/Bread\s*12 coins\s*Unlimited\s*Pinned\s*0\s*Yes/);
    await expect(table.getByRole('row').nth(2)).toHaveText(/Apple\s*Formula\s*Stocked\s*-\s*1\s*Yes/);

    await catalogue.getByRole('button', { name: 'Add an entry' }).click();
    const form = catalogue.getByRole('group', { name: 'New catalogue entry' });
    await expect(form.getByRole('list', { name: 'Catalogue entry problems' })).toHaveText("Pick an item, or give a unique item's instance id.");
    await form.getByLabel('Or one unique item (instance id)').fill('7002');
    await form.getByLabel('Stock').selectOption('Unlimited');
    await expect(form.getByRole('list', { name: 'Catalogue entry problems' })).toHaveText("A unique item is one item: it can't be Unlimited.");
    await form.getByLabel('Stock').selectOption('Stocked');
    await form.getByLabel('Static price (coins)').fill('400');
    await form.getByRole('button', { name: 'Save the entry' }).click();
    await expect(page.getByRole('region', { name: 'Shop', exact: true }).getByRole('status')).toHaveText('Catalogue entry for Diamond sword saved.');
    expect(api.calls('POST', /^ShopCatalogueEntries\/?$/)[0].body).toEqual({
      id: null, shopId: SHOP, itemBlueprintId: null, itemInstanceId: 7002, staticPrice: 400, stockMode: 'Stocked', pinned: false, sortOrder: 0, enabled: true,
    });

    api.on('POST', /^ShopCatalogueEntries\/?$/, { status: 409, body: { error: 'The shop already has an entry for this blueprint.' } });
    await catalogue.getByRole('button', { name: 'Add an entry' }).click();
    const again = catalogue.getByRole('group', { name: 'New catalogue entry' });
    await again.getByLabel('Item', { exact: true }).fill('Bre');
    await again.getByRole('button', { name: 'Bread' }).click();
    await again.getByRole('button', { name: 'Save the entry' }).click();
    await expect(catalogue.getByRole('alert')).toContainText('The shop already has an entry for this blueprint.');
    await again.getByRole('button', { name: 'Cancel' }).click();

    await catalogue.getByRole('button', { name: 'Edit the entry for Apple' }).click();
    const edit = catalogue.getByRole('group', { name: 'Edit the entry for Apple' });
    await edit.getByLabel('Static price (coins)').fill('5');
    await edit.getByLabel('Pinned (shown first, on display stalls too)').check();
    await edit.getByRole('button', { name: 'Save the entry' }).click();
    await expect.poll(() => api.calls('PUT', `ShopCatalogueEntries/${ENTRY_APPLE}`).length).toBe(1);
    expect(api.calls('PUT', `ShopCatalogueEntries/${ENTRY_APPLE}`)[0].body).toEqual({
      id: ENTRY_APPLE, shopId: null, itemBlueprintId: null, itemInstanceId: null, staticPrice: 5, stockMode: 'Stocked', pinned: true, sortOrder: 1, enabled: true,
    });

    await catalogue.getByRole('button', { name: 'Delete the entry for Apple' }).click();
    await expect(page.getByRole('region', { name: 'Shop', exact: true }).getByRole('status')).toHaveText('Catalogue entry for Apple deleted.');
    expect(api.calls('DELETE', `ShopCatalogueEntries/${ENTRY_APPLE}`)).toHaveLength(1);
  });

  test("lists its sales and buy-backs from the stock ledger filtered by the shop (DESIGN § 9)", async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/Shop/${SHOP}`);

    const sales = page.getByRole('table', { name: 'Sales and buy-backs' });
    await expect(sales.getByRole('row')).toHaveCount(4);
    await expect(sales.getByRole('row').nth(1)).toHaveText(/#703.*Buy-back\s*1/);
    await expect(sales.getByRole('row').nth(2)).toHaveText(/#702.*Sale\s*4/);
    await expect(sales.getByRole('link', { name: '#702' })).toHaveAttribute('href', /\/display\/StockTransaction\/702/);
    expect(api.calls('POST', 'StockTransactions/search')[0].body).toEqual({ pageNumber: 1, pageSize: 20, filters: { sourceType: 'Shop', sourceRef: String(SHOP) } });
  });

  test('the hourly trade stats as a chart with totals, per item, over a range, and rebuilt from the ledger (A18)', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<ShopTradeStatRebuildResultDto>('POST', 'ShopTradeStats/rebuild', { hours: 24, rowsWritten: 3, rowsDeleted: 0 });
    await page.goto(`/display/Shop/${SHOP}`);

    const stats = page.getByTestId('shop-trade-stats');
    await expect(stats.getByTestId('shop-trade-totals')).toHaveText(
      'Last 24 hours, all items: 5 sold for 60 coins, 1 bought back for 2 coins, 20 supplied.');
    await expect(stats.getByRole('img', { name: 'Units per hour, last 24 hours, all items: sold, bought back and supplied' })).toBeVisible();
    await expect(stats.locator('[data-testid="shop-trade-chart"] rect')).toHaveCount(3);
    const rows = stats.getByRole('table', { name: 'Trade stats rows' });
    await expect(rows.getByRole('row').nth(1)).toHaveText(/2026-11-21 11:00 UTC\s*Bread\s*0\s*0 coins\s*0\s*0 coins\s*20\s*20/);
    await expect(rows.getByRole('row').nth(2)).toHaveText(/2026-11-21 10:00 UTC\s*Apple\s*0\s*0 coins\s*1\s*2 coins\s*0\s*1/);
    expect(api.calls('POST', 'ShopTradeStats/search')[0].body).toEqual({
      pageNumber: 1, pageSize: 200, filters: { shopId: String(SHOP), from: '2026-11-20T13:00:00.000Z', to: '2026-11-21T13:00:00.000Z' },
    });

    await stats.getByLabel('Item', { exact: true }).selectOption({ label: 'Bread' });
    await expect(stats.getByTestId('shop-trade-totals')).toHaveText('Last 24 hours, Bread: 5 sold for 60 coins, 0 bought back for 0 coins, 20 supplied.');
    await expect(rows.getByRole('row')).toHaveCount(3);

    await stats.getByLabel('Range', { exact: true }).selectOption('7d');
    await expect.poll(() => api.calls('POST', 'ShopTradeStats/search').length).toBe(2);
    expect(api.calls('POST', 'ShopTradeStats/search')[1].body).toMatchObject({ filters: { from: '2026-11-14T13:00:00.000Z', to: '2026-11-21T13:00:00.000Z' } });

    await stats.getByRole('button', { name: 'Rebuild from the ledger' }).click();
    await expect(stats.getByRole('status', { name: 'Trade stats notice' })).toHaveText('Rebuilt 24 hours from the ledger: 3 rows written, 0 removed.');
    expect(api.calls('POST', 'ShopTradeStats/rebuild')[0].body).toEqual({ shopId: SHOP, from: '2026-11-14T13:00:00.000Z', to: '2026-11-21T13:00:00.000Z' });
  });

  test('a range without trade says so', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    mockTradeStats(api, []);
    await page.goto(`/display/Shop/${SHOP}`);
    await expect(page.getByTestId('shop-trade-none')).toHaveText('No trade in this range.');
    await expect(page.getByTestId('shop-trade-totals')).toHaveText('Last 24 hours, all items: 0 sold for 0 coins, 0 bought back for 0 coins, 0 supplied.');
  });

  test("its processing view and its restocking as a consumer, from the production structure panels", async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/Shop/${SHOP}`);

    const supply = page.getByRole('region', { name: 'Supply (as a consumer)' });
    const demand = supply.getByRole('table', { name: 'Demand of Phoenix bakery - merchandise' });
    await expect(demand.getByRole('row').nth(1)).toHaveText(/Bread\s*0\s*20\s*32\s*128\s*Normal\s*its shop level's default min and max/);
    await expect(supply.getByTestId('structure-logistics-workers')).toHaveText('Its own workers: 0 of 1 present, each carries up to 64 units');
    expect(api.calls('GET', `ProductionStructures/${SHOP}/production`)).toHaveLength(1);
  });

  test('without knk.admin.world the shop panels are not shown and the offer is not read', async ({ page, api }) => {
    mockSession(api, alex, nodes());
    api.json<ShopDto>('GET', `Shops/${SHOP}`, bakeryShop());
    await page.goto(`/display/Shop/${SHOP}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('shop-panel')).toHaveCount(0);
    expect(api.calls('GET', `Shops/${SHOP}/offer`)).toHaveLength(0);
    expect(api.calls('POST', 'ShopTradeStats/search')).toHaveLength(0);
  });
});

test.describe('a town account', () => {
  test.use({ strictApi: true });

  test.beforeEach(async ({ api }) => {
    mockDetailPage(api, townAccountMetadata, '952');
    api.json<TownAccountDto>('GET', `TownAccounts/${TOWN_ACCOUNT}`, phoenixAccount());
    api.on<StockPagedResultDto<TownAccountEntryDto>>('GET', `TownAccounts/${TOWN_ACCOUNT}/ledger`, ({ query }) => ({
      body: { items: phoenixLedger, totalCount: phoenixLedger.length, pageNumber: Number(query.get('pageNumber') ?? 1), pageSize: Number(query.get('pageSize') ?? 50) },
    }));
  });

  test("shows its balance, that it matches the ledger, and every town leg newest first with the shop", async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    await page.goto(`/display/TownAccount/${TOWN_ACCOUNT}`);

    const panel = page.getByRole('region', { name: 'Balance and ledger' });
    await expect(panel.getByTestId('town-account-balance')).toHaveText('1,250 coins');
    await expect(panel.getByTestId('town-account-reconciled')).toHaveText('Matches the last ledger entry');
    const ledger = panel.getByRole('table', { name: 'Town account ledger' });
    await expect(ledger.getByRole('row')).toHaveCount(4);
    await expect(ledger.getByRole('row').nth(1)).toHaveText(/Shop buyback\s*-20\s*1,250 coins\s*User #7\s*Shop #31\s*ctx-903/);
    await expect(ledger.getByRole('row').nth(2)).toHaveText(/Shop purchase\s*\+48\s*1,270 coins/);
    await expect(ledger.getByRole('link', { name: 'Shop #31' }).first()).toHaveAttribute('href', new RegExp(`/display/Shop/${SHOP}`));
    const call = api.calls('GET', `TownAccounts/${TOWN_ACCOUNT}/ledger`)[0];
    expect(call.query.get('pageNumber')).toBe('1');
    expect(call.query.get('pageSize')).toBe('25');
  });

  test('a balance that does not match its ledger is flagged', async ({ page, api }) => {
    mockSession(api, alex, nodes(WORLD));
    api.json<TownAccountDto>('GET', `TownAccounts/${TOWN_ACCOUNT}`, phoenixAccount({ reconciled: false, ledgerBalance: 1200 }));
    await page.goto(`/display/TownAccount/${TOWN_ACCOUNT}`);
    await expect(page.getByTestId('town-account-reconciled')).toHaveText('Does not match: the ledger says 1,200 coins');
  });
});

test.describe('dashboard', () => {
  test.use({ strictApi: true });

  function mockRows<T>(api: MockApi, path: string, rows: T[]): void {
    api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
      const query = body as PagedQueryDto & { pageNumber?: number };
      return { body: { items: rows, totalCount: rows.length, page: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
    });
  }

  test.beforeEach(async ({ api }) => {
    mockContentDefaults(api);
    mockSession(api, alex, nodes(WORLD));
    api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [shopTypeMetadata, shopMetadata, shopTradeStatMetadata, townAccountMetadata]);
    api.json<FormConfigurationDto[]>('GET', /^FormConfigurations\/(ShopType|Shop|ShopTradeStat|TownAccount)$/i, []);
  });

  test('lists the shop types with their categories and levels, the shops and the town accounts (A23)', async ({ page, api }) => {
    mockRows<ShopTypeListDto>(api, 'ShopTypes/search', shopTypeRows);
    mockRows<ProductionWorldListDto>(api, 'Shops/search', shopRows);
    mockRows<TownAccountListDto>(api, 'TownAccounts/search', townAccountRows);
    mockPaged(api, 'ShopTradeStats/search', []);

    await page.goto('/dashboard/ShopType');
    const types = page.getByRole('table');
    await expect(types.getByRole('row').filter({ hasText: 'Bakery' })).toContainText('Processing');
    await expect(types.getByRole('row').filter({ hasText: 'General store' })).toContainText('None (buys nothing)');

    await page.goto('/dashboard/Shop');
    const shops = page.getByRole('table');
    await expect(shops.getByRole('columnheader', { name: 'Processing', exact: true })).toBeVisible();
    await expect(shops.getByRole('row').filter({ hasText: 'Phoenix bakery' })).toContainText('Phoenix');

    await page.goto('/dashboard/TownAccount');
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: 'Phoenix' })).toContainText('1250 coins');
  });
});
