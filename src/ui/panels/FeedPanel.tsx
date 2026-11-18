import { useMemo, useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import type { Medium } from '../../sim/types';
import { buildFeed, type FeedPost } from '../../history/feed';
import { feedFrame } from '../../history/feedFrame';
import { Icon, Flag } from '../shared';

const MEDIUM_LABEL: Record<Medium, string> = {
  carving: 'Carved in stone', tablet: 'Clay tablet', scroll: 'Scroll', broadsheet: 'Printed broadsheet',
  newspaper: 'Newspaper', broadcast: 'Broadcast', social: 'Social feed', holo: 'Holo-feed',
};

function Reply({ r }: { r: FeedPost }) {
  return (
    <div class={'post-reply' + (r.flag === 'false' ? ' is-false' : '') + (r.flag === 'ai' ? ' is-ai' : '')}>
      <div class="post-by">
        <strong>{r.author}</strong>
        {r.handle && <span class="muted"> {r.handle}</span>}
        <span class="muted"> · {r.role}</span>
        {r.flag === 'ai' && <span class="tag-ai">AI</span>}
      </div>
      <div>{r.text}</div>
      {r.flag === 'false' && r.context && <div class="fact-check" role="note"><Icon id="ico.warning" size={14} /> {r.context}</div>}
      {r.likes !== undefined && <div class="post-meta muted">♥ {r.likes}</div>}
    </div>
  );
}

/** One post, drawn in the medium of its time. */
export function PostCard({ post, sim, focus }: { post: FeedPost; sim: Simulation; focus: (x: number, y: number) => void }) {
  const civ = sim.w.civs.get(post.civId);
  return (
    <article class={`post medium-${post.medium}`} aria-label={`${MEDIUM_LABEL[post.medium]}, year ${post.year}`}>
      <header class="post-head">
        {civ && <Flag civ={civ} size={18} />}
        <span class="post-medium">{MEDIUM_LABEL[post.medium]}</span>
        {post.outlet && <span class="post-outlet">{post.outlet}</span>}
        <span class="post-year">Year {post.year}</span>
        {post.flag === 'state' && <span class="tag-state" title="State-run outlet">state media</span>}
      </header>
      <button class="post-body" onClick={() => post.x >= 0 && focus(post.x, post.y)} title="Show on the map">
        {post.headline && <div class="post-headline">{post.headline}</div>}
        <div class="post-text">{post.text}</div>
        {post.tags.length > 0 && <div class="post-tags">{post.tags.join(' ')}</div>}
      </button>
      <div class="post-by muted">
        — {post.author}{post.handle ? ` ${post.handle}` : ''}{post.role ? `, ${post.role}` : ''}
      </div>
      {post.likes !== undefined && <div class="post-meta muted">♥ {post.likes} · ⟳ {post.shares}</div>}
      {post.replies.length > 0 && <div class="post-replies">{post.replies.map((r) => <Reply key={r.key} r={r} />)}</div>}
    </article>
  );
}

/** A paged list of posts for one nation (civId) or the world (0). */
export function PostList({ sim, civId, focus }: { sim: Simulation; civId: number; focus: (x: number, y: number) => void }) {
  const [limit, setLimit] = useState(20);
  const posts = useMemo(() => buildFeed(sim, civId, limit), [sim.w.events.length, civId, limit]);
  const frame = useMemo(() => feedFrame(sim, civId ? sim.w.civs.get(civId) : undefined), [sim.w.events.length, civId]);
  const m = frame.medium;
  const app = m === 'social' || m === 'holo';
  return (
    <section class={`feed-frame frame-${m}`} aria-label={frame.title}>
      <header class="frame-head">
        <div class="frame-logo" aria-hidden="true">{FRAME_GLYPH[m]}</div>
        <div class="frame-titles">
          <div class="frame-title">{frame.title}</div>
          <div class="frame-sub">{frame.subtitle}</div>
        </div>
        {m === 'broadcast' && <span class="on-air">ON AIR</span>}
      </header>
      {frame.outlets.length > 1 && (
        <div class="frame-switch" role="list" aria-label={app ? 'Platforms' : 'Outlets'}>
          {frame.outlets.map((o) => (
            <span role="listitem" key={o.name} class="frame-chip">{o.name}{app ? ` · ${Math.round(o.reach * 100)}%` : ''}{o.stateRun ? ' (state)' : ''}</span>
          ))}
        </div>
      )}
      <div class="frame-body">
        <div class="feed">
          {posts.map((p) => <PostCard key={p.key} post={p} sim={sim} focus={focus} />)}
          {!posts.length && <p class="muted">{EMPTY[m]}</p>}
          {posts.length >= limit && <button class="btn small" onClick={() => setLimit(limit + 20)}>Older posts</button>}
        </div>
        {(frame.trending.length > 0 || frame.people.length > 0) && (
          <aside class="frame-side" aria-label={app ? 'Trending' : 'Talk of the town'}>
            {frame.trending.length > 0 && (
              <>
                <h4>{app ? 'Trending' : m === 'broadcast' ? 'Top stories' : 'Talk of the town'}</h4>
                <ul>{frame.trending.map((t) => <li key={t.tag}>{app ? t.tag : t.tag.replace(/^#\w*?([A-Z][a-z]+)$/, '$1')} <span class="muted">{t.count}</span></li>)}</ul>
              </>
            )}
            {frame.people.length > 0 && (
              <>
                <h4>{app ? 'Who to follow' : 'Notable people'}</h4>
                <ul>{frame.people.map((p) => <li key={p.id}><strong>{p.name}</strong> <span class="muted">{app ? p.handle : p.role}</span></li>)}</ul>
              </>
            )}
          </aside>
        )}
      </div>
      {m === 'broadcast' && posts.length > 0 && (
        <div class="frame-ticker" aria-hidden="true"><span>{posts.slice(0, 6).map((p) => p.headline ?? p.text).join('  •  ')}</span></div>
      )}
    </section>
  );
}

const FRAME_GLYPH: Record<Medium, string> = {
  carving: '✺', tablet: '▤', scroll: '✒', broadsheet: '▦', newspaper: '¶', broadcast: '◎', social: '◉', holo: '◈',
};
const EMPTY: Record<Medium, string> = {
  carving: 'The cave wall is still bare.', tablet: 'No tablets have been pressed yet.', scroll: 'The scribes have nothing to record yet.',
  broadsheet: 'The presses are quiet.', newspaper: 'Nothing fit to print yet.', broadcast: 'Dead air. Stay tuned.', social: 'Your feed is empty. Follow some people!', holo: 'No signals in the lattice.',
};

export function FeedPanel({ sim, close, focus, selectedCiv }: { sim: Simulation; close: () => void; focus: (x: number, y: number) => void; selectedCiv: number }) {
  const [civId, setCivId] = useState(selectedCiv);
  const civs = [...sim.w.civs.values()].filter((c) => c.alive && c.settlements.length).sort((a, b) => b.population - a.population).slice(0, 12);
  return (
    <aside class="sheet" aria-label="News feed">
      <div class="sheet-head">
        <Icon id="ico.newspaper" size={28} />
        <h2>{civId ? `News of ${sim.w.civs.get(civId)?.name ?? 'a nation'}` : 'World news'}</h2>
        <button class="icon-btn" aria-label="Close" onClick={close}><Icon id="ico.close" size={24} /></button>
      </div>
      <div class="sheet-body">
        <p class="muted small">Every post retells something that really happened in this world, in the medium of its time. Tap a post to see where.</p>
        <div class="filters" role="group" aria-label="Whose news">
          <button aria-pressed={civId === 0} onClick={() => setCivId(0)}>World</button>
          {civs.map((c) => (
            <button key={c.id} aria-pressed={civId === c.id} onClick={() => setCivId(c.id)}>
              <Flag civ={c} size={14} /> {c.baseName}
            </button>
          ))}
        </div>
        <PostList sim={sim} civId={civId} focus={focus} />
      </div>
    </aside>
  );
}
