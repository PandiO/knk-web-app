import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './theme/tokens.css';
import './index.css';
import App from './App';
import { applyTheme, resolveInitialTheme } from './theme/themes';

// Before the first render, so the page never flashes in another theme (#95).
applyTheme(resolveInitialTheme());

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
