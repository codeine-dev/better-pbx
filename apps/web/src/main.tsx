import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';

// Apply persisted theme before first render to avoid a flash.
const storedTheme = localStorage.getItem('theme');
if (storedTheme === 'dark') document.documentElement.classList.add('dark');

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);