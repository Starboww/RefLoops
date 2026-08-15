import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { initDashboard } from './services/appService';

// Bootstrap: load data into stores before rendering
initDashboard()
  .then(() => {
    const root = document.getElementById('root');
    if (root) {
      ReactDOM.createRoot(root).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      );
    }
  })
  .catch(console.error);
