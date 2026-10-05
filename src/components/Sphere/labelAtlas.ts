import * as THREE from 'three';
import type { SphereProject } from './types';

const CELL_W = 1024;
const CELL_H = 160;
const PER_COLUMN = Math.floor(4096 / CELL_H); // 25

export interface Atlas {
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
  /** width / height of one label cell */
  aspect: number;
  /** Which cell holds project `i`. */
  cell(i: number): { col: number; row: number };
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

const toNumerals = (n: number, rtl: boolean) => String(n).padStart(2, '0').replace(/\d/g, (d) => (rtl ? '۰۱۲۳۴۵۶۷۸۹'[+d] : d));

/** Font stacks come from the next/font CSS variables on `root`; fall back to system fonts. */
function families(root: HTMLElement, rtl: boolean) {
  const cs = getComputedStyle(root);
  const read = (name: string) => cs.getPropertyValue(name).trim();
  const display = rtl ? read('--font-lalezar') : read('--font-bricolage');
  const mono = read('--font-jetbrains');
  return {
    display: [display, rtl ? 'Tahoma' : '"Helvetica Neue"', 'Arial', 'sans-serif'].filter(Boolean).join(', '),
    mono: [rtl ? display : mono, 'ui-monospace', 'Menlo', 'monospace'].filter(Boolean).join(', '),
  };
}

/** Draws every screen's caption into one texture so text is curved + lit by the same shader. */
export async function buildLabelAtlas(projects: SphereProject[], root: HTMLElement, rtl: boolean): Promise<Atlas> {
  const fam = families(root, rtl);
  const sample = projects.map((p) => p.title + p.category).join('').slice(0, 200);
  try {
    if (document.fonts && document.fonts.load) {
      await withTimeout(
        Promise.all([
          document.fonts.load(`${rtl ? 400 : 800} 60px ${fam.display}`, sample),
          document.fonts.load(`500 24px ${fam.mono}`, sample),
        ]),
        1800,
      );
    }
  } catch {
    /* fall back to system fonts */
  }

  const count = Math.min(projects.length, PER_COLUMN * 2);
  const cols = count > PER_COLUMN ? 2 : 1;
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * cols;
  canvas.height = CELL_H * rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const x = rtl ? CELL_W - 6 : 6;
  const setSpacing = (px: string) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px;
  };
  const cell = (i: number) => ({ col: Math.floor(i / rows), row: i % rows });

  projects.slice(0, count).forEach((p, i) => {
    const { col, row } = cell(i);
    const x0 = col * CELL_W;
    const y0 = row * CELL_H;
    const idx = toNumerals(i + 1, rtl);
    ctx.font = rtl ? `400 34px ${fam.display}` : `500 27px ${fam.mono}`;
    setSpacing(rtl ? '0px' : '3px');
    ctx.fillText(rtl ? `${idx}  ${p.category}` : `${idx}  ${p.category.toUpperCase()}`, x0 + x, y0 + 46);

    const weight = rtl ? 400 : 800;
    const face = (size: number) => `${weight} ${size}px ${fam.display}`;
    let size = rtl ? 88 : 82;
    ctx.font = face(size);
    setSpacing(rtl ? '0px' : '-1px');
    while (ctx.measureText(p.title).width > CELL_W - 24 && size > 40) {
      size -= 4;
      ctx.font = face(size);
    }
    ctx.fillText(p.title, x0 + x, y0 + CELL_H - 22);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { texture, cols, rows, aspect: CELL_W / CELL_H, cell };
}
