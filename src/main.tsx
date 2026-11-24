import { render } from 'preact';
import { App } from './ui/App';
import { framedCrossOrigin } from './security/framing';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
// round 10: era typography for the news mediums and postcards (OFL, bundled; a browser downloads a face only when a medium uses it)
import '@fontsource/cinzel/600.css';
import '@fontsource/uncial-antiqua/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/700.css';
import '@fontsource/oswald/500.css';
import '@fontsource/orbitron/600.css';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/400-italic.css';
import '@fontsource/alegreya/700.css';
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
