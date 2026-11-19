// Design floors measured inside the page (round 6 design review), shared by tools/design-capture.mjs
// and tools/viewports.mjs. Pass to page.evaluate(measure, isTouchDevice).
//   smallText:    visible text under 12 CSS px
//   smallTargets: interactive elements under 44x44 px on touch devices (a checkbox inside a >=44 px label counts as the label)
//   lowContrast:  text below WCAG AA (4.5:1, or 3:1 for large text) against its nearest opaque background (gradients: first stop)
//   motion:       CSS transitions and animations in use
export /** Measured in the page: small text, small targets, low contrast, motion durations. */
function measure(touch) {
  const lum = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
  };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      // gradient backgrounds (era frames: scroll, broadsheet...): use the gradient's first colour
      const grad = st.backgroundImage && st.backgroundImage.includes('gradient') ? st.backgroundImage.match(/rgba?\([^)]+\)/) : null;
      if (grad) { const g = lum(grad[0]); if (g && g.a > 0.6) return g.L; }
      const l = lum(st.backgroundColor);
      if (l && l.a > 0.6) return l.L;
    }
    return lum('rgb(13,20,36)').L; // the app background
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const smallText = [], lowContrast = [], smallTargets = [], motion = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.transitionDuration && s.transitionDuration !== '0s') motion.add(`transition ${s.transitionDuration} ${s.transitionTimingFunction}`);
    if (s.animationName && s.animationName !== 'none') motion.add(`animation ${s.animationName} ${s.animationDuration}`);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (hasText) {
      const fs = parseFloat(s.fontSize);
      if (fs < 12) smallText.push(`${sel(el)} ${fs}px "${el.textContent.trim().slice(0, 30)}"`);
      const fg = lum(s.color);
      if (fg) {
        const bg = bgOf(el);
        const ratio = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(s.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${sel(el)} ${ratio.toFixed(2)}:1 "${el.textContent.trim().slice(0, 30)}"`);
      }
    }
    if (touch && el.matches('button, a[href], input, select, [role=tab], [role=button]')) {
      const r = el.getBoundingClientRect();
      // a checkbox inside a label: the whole label is the target (WCAG 2.5.8)
      const lab = el.closest('label');
      if (lab && el.matches('input') && lab.getBoundingClientRect().height >= 44) continue;
      if (r.width < 44 || r.height < 44) smallTargets.push(`${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`);
    }
  }
  return { smallText, lowContrast, smallTargets, motion: [...motion] };
}

