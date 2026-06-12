import { useEffect, useMemo, useState } from 'react';
import LocalModeApp from './react-game/LocalModeApp.jsx';

const BOOT_FLAG = '__imposterLegacyBooted';

function loadScript(src, type = 'text/javascript') {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.type = type;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function stripScripts(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  doc.querySelectorAll('script').forEach((node) => node.remove());
  return doc.body.innerHTML;
}

function LegacyBridgeApp() {
  const [legacyMarkup, setLegacyMarkup] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadLegacyMarkup() {
      try {
        const response = await fetch('/legacy/index.html', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Unable to load legacy UI shell.');
        }

        const html = await response.text();
        if (!cancelled) {
          setLegacyMarkup(stripScripts(html));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to initialize UI shell.');
        }
      }
    }

    loadLegacyMarkup();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!legacyMarkup || window[BOOT_FLAG]) {
      return;
    }

    window[BOOT_FLAG] = true;

    async function bootLegacyApp() {
      try {
        await loadScript('/legacy/categories.js');
        await loadScript('/legacy/questionCategories.js');
        await loadScript('/legacy/index.js', 'module');
      } catch (err) {
        setError(err.message || 'Failed to start game modules.');
      }
    }

    bootLegacyApp();
  }, [legacyMarkup]);

  if (error) {
    return (
      <div className="react-loader-shell">
        <div className="react-loader-card">
          <div className="react-loader-icon">⚠️</div>
          <h2>Startup Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!legacyMarkup) {
    return (
      <div className="react-loader-shell">
        <div className="react-loader-card">
          <div className="react-loader-icon">🕵️</div>
          <h2>Loading...</h2>
          <p>Preparing game interface</p>
        </div>
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: legacyMarkup }} />;
}

export default function App() {
  const useLegacyMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('legacy') === '1';
  }, []);

  if (useLegacyMode) {
    return <LegacyBridgeApp />;
  }

  return <LocalModeApp />;
}
