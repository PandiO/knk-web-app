import { test as base, expect, type Page, type Request, type Route } from '@playwright/test';

/**
 * A mocked knk-web-api for the end-to-end specs: every request to `/api/...` is answered here, so
 * the specs need no API and no database. Register the endpoints a spec needs with `api.on(...)`;
 * the last matching registration wins, so a test can override a `beforeEach` mock. A request with
 * no matching mock gets a 404 `{ error: 'NoMock' }` and is listed on the test as an annotation
 * (and fails the test when `strict` is on), which is how a spec finds the calls a page makes.
 *
 * Bodies are typed by the caller (`api.on<UserDto>(...)`) and the fixtures in `e2e/fixtures/` are
 * built from the DTO types in `src/types/`, so `npm run typecheck:e2e` breaks when a DTO changes.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What a mock answers: a status and a JSON body (or no body for 204). */
export interface MockResponse<T = unknown> {
  status?: number;
  body?: T;
  headers?: Record<string, string>;
}

/** The request as a handler sees it. `path` is the part after `/api/`, without the query string. */
export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** The parsed JSON body, or undefined. */
  body: unknown;
  /** The bearer token of the Authorization header, or null. */
  bearer: string | null;
  request: Request;
}

export type MockHandler<T = unknown> = (req: MockRequest) => MockResponse<T> | Promise<MockResponse<T>>;

interface Registration {
  method: HttpMethod;
  path: string | RegExp;
  handler: MockHandler;
}

const API_PREFIX = '/api/';

function matches(path: string | RegExp, actual: string): boolean {
  return typeof path === 'string' ? path.toLowerCase() === actual.toLowerCase() : path.test(actual);
}

export class MockApi {
  private readonly registrations: Registration[] = [];
  /** Every API request the page made, in order. */
  readonly requests: MockRequest[] = [];
  /** `METHOD path` of each request no mock answered. */
  readonly unmocked: string[] = [];

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    await this.page.route(url => url.pathname.startsWith(API_PREFIX), route => this.handle(route));
  }

  /** Answers `method path` with a fixed response or a handler. `path` is relative to `/api/`, case-insensitive. */
  on<T>(method: HttpMethod, path: string | RegExp, response: MockResponse<T> | MockHandler<T>): this {
    const handler: MockHandler = typeof response === 'function' ? response : () => response;
    this.registrations.push({ method, path, handler });
    return this;
  }

  /** Shorthand for a 200 with a JSON body. */
  json<T>(method: HttpMethod, path: string | RegExp, body: T): this {
    return this.on<T>(method, path, { status: 200, body });
  }

  /** The requests made to `method path` so far. */
  calls(method: HttpMethod, path: string | RegExp): MockRequest[] {
    return this.requests.filter(r => r.method === method && matches(path, r.path));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(API_PREFIX.length);
    const method = request.method();
    let body: unknown;
    try {
      body = request.postDataJSON() ?? undefined;
    } catch {
      body = request.postData() ?? undefined;
    }
    const authorization = (await request.allHeaders())['authorization'] ?? '';
    const mockRequest: MockRequest = {
      method,
      path,
      query: url.searchParams,
      body,
      bearer: authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null,
      request,
    };
    this.requests.push(mockRequest);

    const registration = [...this.registrations].reverse().find(r => r.method === method && matches(r.path, path));
    if (!registration) {
      this.unmocked.push(`${method} ${path}`);
      await route.fulfill({ status: 404, json: { error: 'NoMock', message: `No e2e mock for ${method} ${path}` } });
      return;
    }
    const response = await registration.handler(mockRequest);
    const status = response.status ?? 200;
    if (status === 204 || response.body === undefined) {
      await route.fulfill({ status, headers: response.headers });
      return;
    }
    await route.fulfill({ status, headers: response.headers, json: response.body });
  }
}

export interface MockApiOptions {
  /** Fail the test when the page made a request no mock answered. */
  strictApi: boolean;
}

export const test = base.extend<MockApiOptions & { api: MockApi }>({
  strictApi: [false, { option: true }],
  api: async ({ page, strictApi }, use, testInfo) => {
    const api = new MockApi(page);
    await api.install();
    await use(api);
    if (api.unmocked.length > 0) {
      const list = [...new Set(api.unmocked)].join(', ');
      testInfo.annotations.push({ type: 'unmocked API requests', description: list });
      if (strictApi && testInfo.status === testInfo.expectedStatus) {
        throw new Error(`The page made API requests without a mock: ${list}`);
      }
    }
  },
});

export { expect };
