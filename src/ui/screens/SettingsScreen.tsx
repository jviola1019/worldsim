export interface Prefs {
  sound: boolean;
  labels: boolean;
  autosaveMinutes: number;
  tutorialSeen: boolean;
  newspaper: boolean;
}

const KEY = 'epoch-prefs';

export function loadPrefs(): Prefs {
  const def: Prefs = { sound: true, labels: true, autosaveMinutes: 3, tutorialSeen: false, newspaper: true };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return def;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preferences last for this session only */
  }
}

export function SettingsScreen({ back, prefs, setPrefs }: { back: () => void; prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  const update = (patch: Partial<Prefs>) => {
    const p = { ...prefs, ...patch };
    setPrefs(p);
    savePrefs(p);
  };
  return (
    <main class="screen">
      <div class="page">
        <div class="back-row">
          <button class="btn small" onClick={back}>Back</button>
          <h1>Settings</h1>
        </div>
        <section class="fieldset">
          <label class="toggle">
            Sound effects
            <input type="checkbox" checked={prefs.sound} onChange={(e) => update({ sound: (e.target as HTMLInputElement).checked })} />
          </label>
          <label class="toggle">
            Settlement & nation names on the map
            <input type="checkbox" checked={prefs.labels} onChange={(e) => update({ labels: (e.target as HTMLInputElement).checked })} />
          </label>
          <label class="toggle">
            Headlines for major events
            <input type="checkbox" checked={prefs.newspaper} onChange={(e) => update({ newspaper: (e.target as HTMLInputElement).checked })} />
          </label>
          <div class="field">
            <label>Autosave every</label>
            <div class="seg">
              {[0, 1, 3, 10].map((m) => (
                <button key={m} aria-pressed={prefs.autosaveMinutes === m} onClick={() => update({ autosaveMinutes: m })}>
                  {m === 0 ? 'Off' : `${m} min`}
                </button>
              ))}
            </div>
          </div>
          <button class="btn small" onClick={() => update({ tutorialSeen: false })}>Show the introduction again</button>
        </section>
        <p class="footnote">EPOCH stores worlds in this browser only. Use “Export” in the game menu to keep a copy elsewhere.</p>
      </div>
    </main>
  );
}
