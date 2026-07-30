import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

if (window.location.pathname === '/wissen') {
  void import('./pages/KnowledgeOverviewPage');
} else if (/^\/wissen\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(window.location.pathname)) {
  void import('./pages/KnowledgeArticlePage');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
