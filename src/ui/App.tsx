import { useEffect, useState } from 'preact/hooks';
import type { Simulation } from '../sim/simulation';
import { Simulation as SimClass } from '../sim/simulation';
import { SaveStore } from '../persistence/saves';
import { TitleScreen } from './screens/TitleScreen';
import { NewWorldScreen } from './screens/NewWorldScreen';
import { LoadScreen } from './screens/LoadScreen';
import { SettingsScreen, loadPrefs, type Prefs } from './screens/SettingsScreen';
import { Game } from './game/Game';
import type { WorldConfig } from '../config/laws';
import { createWorldAsync } from './worldFactory';
import type { WorldState } from '../sim/types';

export type Screen = 'title' | 'new' | 'load' | 'scenarios' | 'settings' | 'game';

export const store = new SaveStore();

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [sim, setSim] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs());
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    store.open().finally(() => setStoreReady(true)); // ready even when storage is unavailable (import still works)
  }, []);

  const startWorld = async (cfg: WorldConfig) => {
    setBusy('Shaping continents…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const s = await createWorldAsync(cfg);
      setSim(s);
      setScreen('game');
    } catch (e) {
      alert(`The world could not be created: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy('');
    }
  };

  const openWorld = (w: WorldState) => {
    setSim(new SimClass(w));
    setScreen('game');
  };

  return (
    <>
      {screen === 'title' && <TitleScreen go={setScreen} hasSaves={storeReady} />}
      {(screen === 'new' || screen === 'scenarios') && <NewWorldScreen scenarios={screen === 'scenarios'} back={() => setScreen('title')} start={startWorld} />}
      {screen === 'load' && <LoadScreen back={() => setScreen('title')} open={openWorld} setBusy={setBusy} />}
      {screen === 'settings' && <SettingsScreen back={() => setScreen('title')} prefs={prefs} setPrefs={setPrefs} />}
      {screen === 'game' && sim && <Game sim={sim} prefs={prefs} exit={() => setScreen('title')} replaceSim={setSim} />}
      {busy && (
        <div class="loading" role="status">
          {busy}
        </div>
      )}
    </>
  );
}
