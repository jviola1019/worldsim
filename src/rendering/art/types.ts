/**
 * Pixel-art sprite definition format.
 *
 * Sprites are authored as rows of palette keys (see palette.ts). '.' is
 * transparent. All frames of a sprite share the same w/h.
 *
 * Anchoring: the anchor (ax, ay) is the sprite pixel that is placed on the
 * BOTTOM-CENTER of the tile (or of the multi-tile footprint). The default
 * anchor is x = floor(w / 2), y = h - 1, i.e. the sprite stands on the bottom
 * edge of its tile and may overhang upward (tall buildings, trees).
 *
 * World scale: one map tile = 8x8 art pixels.
 */
export interface SpriteDef {
  w: number;
  h: number;
  frames: string[][];
  ax?: number;
  ay?: number;
  /** Animation frames per second (default 4). */
  fps?: number;
  /** Footprint in tiles for multi-tile buildings (default 1x1). */
  fw?: number;
  fh?: number;
}

export type SpriteSheet = Record<string, SpriteDef>;

/**
 * Convenience constructor. Accepts a single frame (string[]) or multiple
 * frames (string[][]). Width/height are inferred from the first frame.
 */
export function S(
  framesOrRows: string[] | string[][],
  opts: Omit<Partial<SpriteDef>, 'frames' | 'w' | 'h'> = {},
): SpriteDef {
  const frames: string[][] =
    framesOrRows.length > 0 && Array.isArray(framesOrRows[0])
      ? (framesOrRows as string[][])
      : [framesOrRows as string[]];
  const h = frames[0].length;
  const w = frames[0].reduce((m, r) => Math.max(m, r.length), 0);
  // pad ragged rows with transparency so authoring mistakes never crash rendering
  const padded = frames.map((f) => f.map((r) => (r.length < w ? r + '.'.repeat(w - r.length) : r)));
  return { w, h, frames: padded, ...opts };
}

/** Validate a sheet against the palette. Returns a list of human-readable problems. */
export function validateSheet(sheet: SpriteSheet, palette: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  for (const [id, def] of Object.entries(sheet)) {
    if (!def.frames.length) problems.push(`${id}: no frames`);
    def.frames.forEach((frame, fi) => {
      if (frame.length !== def.h) problems.push(`${id}[${fi}]: has ${frame.length} rows, expected ${def.h}`);
      frame.forEach((row, ri) => {
        if (row.length !== def.w) problems.push(`${id}[${fi}] row ${ri}: length ${row.length}, expected ${def.w}`);
        for (const ch of row) {
          if (ch !== '.' && !(ch in palette)) {
            problems.push(`${id}[${fi}] row ${ri}: unknown palette key '${ch}'`);
            break;
          }
        }
      });
    });
  }
  return problems;
}
