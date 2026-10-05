import * as THREE from 'three';
import { CONFIG } from './config';
import type { Slot, Vec3 } from './layout';
import type { Atlas } from './labelAtlas';
import { SCREEN_VERT, SCREEN_FRAG } from './shaders';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** One screen: a mesh, its material and the per-frame numbers the render loop animates. */
export interface Tile {
  slot: Slot;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  u: Record<string, THREE.IUniform>;
  loop: number;
  hover: number;
  focus: number;
  dim: number;
  introDelay: number;
  /** Scale the screen is drawn at this frame (1 = its full size). Hit-testing uses the same number. */
  drawn: number;
  /** How far this screen is turned in its own plane this frame to read upright (see `alignTurn`). */
  turn: number;
  /** This frame's axes: the laid-out ones, turned by `turn`. Hit-testing uses the same ones. */
  right: Vec3;
  up: Vec3;
}

/**
 * `introFrom` is the direction the screens fly in from: the first ones to appear are the ones
 * nearest it. The default is the opening view of the projects page.
 */
export function makeTile(
  slot: Slot,
  atlas: Atlas,
  dummy: THREE.Texture,
  geo: THREE.BufferGeometry,
  rtl: boolean,
  introFrom: Vec3 = [0, 0, -1],
): Tile {
  const p = slot.project;
  const [c0, c1, c2] = p.palette.map(hexToRgb);
  const loops = CONFIG.loopSeconds;
  const loop = loops[slot.projectIndex % loops.length];
  const cell = atlas.cell(slot.projectIndex);
  const u: Record<string, THREE.IUniform> = {
    uCenter: { value: new THREE.Vector3(...slot.center) },
    uRight: { value: new THREE.Vector3(...slot.right) },
    uUp: { value: new THREE.Vector3(...slot.up) },
    uHalf: { value: new THREE.Vector2(...slot.half) },
    uRadius: { value: CONFIG.tileRadius },
    uScale: { value: 1 },
    uFlip: { value: 0 },
    uPhase: { value: 0 },
    uScene: { value: p.scene },
    uC0: { value: new THREE.Vector3(...c0) },
    uC1: { value: new THREE.Vector3(...c1) },
    uC2: { value: new THREE.Vector3(...c2) },
    uAspect: { value: CONFIG.aspect },
    uHover: { value: 0 },
    uFocus: { value: 0 },
    uDim: { value: 0 },
    uIntro: { value: 0 },
    uEdge: { value: 1 },
    uColor: { value: 0 },
    uRtl: { value: rtl ? 1 : 0 },
    uTime: { value: 0 },
    uAtlas: { value: atlas.texture },
    uLabel: { value: new THREE.Vector4(cell.col, cell.row, atlas.cols, atlas.rows) },
    uLabelAspect: { value: atlas.aspect },
    uMap: { value: dummy },
    uVideo: { value: 0 },
    uVideoAspect: { value: 16 / 9 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: SCREEN_VERT,
    fragmentShader: SCREEN_FRAG,
    uniforms: u,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = false;
  const c = slot.center;
  const ang = Math.acos(clamp(c[0] * introFrom[0] + c[1] * introFrom[1] + c[2] * introFrom[2], -1, 1));
  return {
    slot,
    mesh,
    material,
    u,
    loop,
    hover: 0,
    focus: 0,
    dim: 0,
    introDelay: 0.2 + ang * 0.55 + slot.seed * 0.18,
    drawn: 0,
    turn: 0,
    right: [...slot.right],
    up: [...slot.up],
  };
}
