import { render } from 'preact';
import { App } from './ui/App';
import { framedCrossOrigin } from './security/framing';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/styles.css';

const root = document.getElementById('app')!;
if (framedCrossOrigin(window)) {
  // Embedded by another site: do not run the game underneath someone else's page.
  render(
    <main class="screen"><div class="page">
      <h1>EPOCH</h1>
      <p>This game is embedded in another website. For your safety it only runs in its own tab.</p>
      <a class="btn" href={location.href} target="_blank" rel="noopener noreferrer">Open EPOCH in a new tab</a>
    </div></main>,
    root,
  );
} else {
  render(<App />, root);
}
