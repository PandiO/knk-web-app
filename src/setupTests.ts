// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom doesn't provide TextEncoder/TextDecoder, but react-router v7 needs them at import time.
import { TextEncoder, TextDecoder } from 'util';
import { setNumberLocale } from './utils/format';
if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

// LW3-1 (#187): numbers follow the browser's locale; tests pin en-US so their expected text ("12,345")
// doesn't depend on the machine's locale. A test for another locale calls setNumberLocale itself.
setNumberLocale('en-US');
