import React from 'react';
import ReactDOM from 'react-dom/client';
import './monacoSetup';
import App from './App';

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  document.body.style.cssText = 'margin:20px;font-family:monospace;background:#fff';
  document.body.innerHTML = `<h2 style="color:#e53935">Ошибка при запуске</h2><pre style="color:#333;white-space:pre-wrap">${e.stack || e}</pre>`;
}
