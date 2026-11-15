/** 2D camera: world units are art pixels (1 tile = 8 px); zoom = CSS px per art px. */
export const TILE = 8;

export class Camera {
  x = 0; // world px at screen center
  y = 0;
  zoom = 1;
  minZoom = 0.15;
  maxZoom = 8;
  viewW = 1;
  viewH = 1;

  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  fitWorld(mapW: number, mapH: number): void {
    this.x = (mapW * TILE) / 2;
    this.y = (mapH * TILE) / 2;
    this.zoom = Math.min(this.viewW / (mapW * TILE), this.viewH / (mapH * TILE)) * 0.95;
    this.minZoom = Math.min(this.zoom * 0.8, 0.5);
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.viewW / 2, (wy - this.y) * this.zoom + this.viewH / 2];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.viewW / 2) / this.zoom + this.x, (sy - this.viewH / 2) / this.zoom + this.y];
  }

  screenToTile(sx: number, sy: number): [number, number] {
    const [wx, wy] = this.screenToWorld(sx, sy);
    return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const [nx, ny] = this.screenToWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
  }

  pan(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  clamp(mapW: number, mapH: number): void {
    const W = mapW * TILE;
    const H = mapH * TILE;
    this.x = Math.max(0, Math.min(W, this.x));
    this.y = Math.max(0, Math.min(H, this.y));
  }

  /** Visible tile bounds (inclusive), with margin. */
  visibleTiles(mapW: number, mapH: number, margin = 2): [number, number, number, number] {
    const [x0, y0] = this.screenToWorld(0, 0);
    const [x1, y1] = this.screenToWorld(this.viewW, this.viewH);
    return [
      Math.max(0, Math.floor(x0 / TILE) - margin),
      Math.max(0, Math.floor(y0 / TILE) - margin),
      Math.min(mapW - 1, Math.ceil(x1 / TILE) + margin),
      Math.min(mapH - 1, Math.ceil(y1 / TILE) + margin + 3),
    ];
  }
}
