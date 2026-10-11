import { appConfig, readSetting } from '../appConfig';

describe('readSetting', () => {
  it('uses the configured value without a trailing slash', () => {
    expect(readSetting('https://app.example.net/api/', '/api')).toBe('https://app.example.net/api');
  });

  it('falls back when the value is unset or blank', () => {
    expect(readSetting(undefined, '/api')).toBe('/api');
    expect(readSetting('   ', 'play.example.net')).toBe('play.example.net');
  });
});

describe('appConfig', () => {
  it('defaults to the local API outside production builds', () => {
    // Jest runs with NODE_ENV=test and no REACT_APP_API_BASE_URL.
    expect(appConfig.api.baseUrl).toBe('http://localhost:5294/api');
    expect(appConfig.minecraft.serverAddress).toBe('play.knightsandkings.net');
  });
});
