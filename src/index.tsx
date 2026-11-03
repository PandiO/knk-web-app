import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './theme/tokens.css';
import './index.css';
import './theme/pageBackground.css';
import App from './App';
import { applyTheme, resolveInitialTheme } from './theme/themes';
import { applyPageBackground, resolveInitialPageBackground } from './theme/pageBackground';

// Before the first render, so the page never flashes in another theme (#95) or background (#231).
applyTheme(resolveInitialTheme());
applyPageBackground(resolveInitialPageBackground());

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
