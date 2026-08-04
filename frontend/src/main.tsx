import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { StatusBar } from '@capacitor/status-bar';
import './index.css';

function AppWithStatusBar() {
  useEffect(() => {
    // Esconde a barra de navegação/status bar ao abrir o app
    const hideStatusBar = async () => {
      try {
        await StatusBar.hide();
      } catch (error) {
        console.log('StatusBar hide not supported in web browser');
      }
    };
    
    hideStatusBar();
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AppWithStatusBar />
    </HashRouter>
  </React.StrictMode>
);
