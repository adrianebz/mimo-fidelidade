import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { migrarChavesLocaisDaMarca } from './utils/brandMigration.js';
import './theme.css';

// Antes de montar: o App lê localStorage já no estado inicial dos hooks.
migrarChavesLocaisDaMarca();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
