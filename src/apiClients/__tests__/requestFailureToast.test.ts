import { requestFailureToast } from '../objectManager';

describe('requestFailureToast', () => {
  it('reports network failures and server errors', () => {
    expect(requestFailureToast(new TypeError('Failed to fetch'), 'Towns')).toBe("Can't reach the server. Check your connection and try again.");
    expect(requestFailureToast({ status: 503 }, 'Towns')).toBe('The server had a problem (Towns). Please try again.');
  });

  it('leaves every 4xx to the caller', () => {
    [400, 401, 403, 404, 409].forEach(status => expect(requestFailureToast({ status }, 'Towns')).toBeNull());
  });
});
