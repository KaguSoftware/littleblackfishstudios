import * as THREE from 'three';
import type { SphereProject } from './types';

/** Poster through the site's image optimizer: same-origin (no CORS), resized, AVIF/WebP, cached. */
export function posterUrl(src: string, width: number) {
  if (src.startsWith('/')) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/** YouTube only makes the 1280×720 still for some videos; every video has the 320×180 one. */
const YT_MAXRES = /^(https:\/\/img\.youtube\.com\/vi\/[\w-]{11}\/)maxresdefault\.jpg$/;

/** Where to try to get a poster from, best first: each source in turn (main image, then gallery). */
function posterCandidates(srcs: string[], width: number) {
  const list: string[] = [];
  for (const src of srcs) {
    list.push(posterUrl(src, width), src);
    const yt = YT_MAXRES.exec(src);
    if (yt) {
      const small = `${yt[1]}mqdefault.jpg`;
      list.push(posterUrl(small, width), small);
    }
  }
  return list;
}

/** The poster and then the gallery photos, in the order they are tried. */
function imageSources(project: SphereProject) {
  return [project.image, ...project.galleryImages].filter((s): s is string => !!s);
}

/** How many poster fetches run at once. */
const MAX_INFLIGHT = 6;

export interface MediaItem {
  kind: 'image' | 'video';
  texture: THREE.Texture | null;
  video: HTMLVideoElement | null;
  ready: boolean;
  failed: boolean;
  /** width / height of the poster or clip */
  aspect: number;
  playing: boolean;
  /** Width of the poster that is on `texture` now (0 until one has loaded). */
  width: number;
  /** A bigger poster is on its way to replace `texture`. */
  upgrading: boolean;
}

/**
 * Posters and clips for the screens. A project shows on many screens but is ONE texture, created
 * the first time one of its screens comes into view. Posters are plain images; a project with
 * `video` gets one muted looping <video> that only plays while on screen.
 *
 * `get(project, width)` is how big a poster the caller wants. A small one is fetched first and
 * swapped for a bigger one in place when a later caller asks for it, so the globe on the home page
 * stays light and the sphere it leads into starts from posters that are already there.
 */
export class MediaPool {
  items = new Map<string, MediaItem>();
  private disposed = false;
  /** Posters being fetched right now. At most `MAX_INFLIGHT` at a time, see `get`. */
  inflight = 0;

  constructor(private width: number) {}

  /**
   * Only `MAX_INFLIGHT` posters are fetched at once, and callers ask for the ones nearest the middle
   * of the view first (see `nearestFirst`), so the screens you are looking at get their pictures
   * before the ones at the edge, instead of thirty requests queuing in array order. A project that
   * can't start yet returns null (its screen shows the animated placeholder) and is asked for again
   * next frame.
   */
  get(project: SphereProject, width = this.width): MediaItem | null {
    if (!project.image && !project.video) return null;
    let it = this.items.get(project.id);
    if (!it) {
      if (this.inflight >= MAX_INFLIGHT) return null;
      it = project.video ? this.loadVideo(project.video) : this.loadImage(imageSources(project), width);
      this.items.set(project.id, it);
    } else if (it.kind === 'image' && it.ready && !it.upgrading && it.width < width && project.image && this.inflight < MAX_INFLIGHT) {
      this.loadImage(imageSources(project), width, it);
    }
    return it;
  }

  /** Fetches a poster, trying each source in turn. Given `into`, it is an upgrade: a failure leaves the poster already shown alone. */
  private loadImage(srcs: string[], width: number, into?: MediaItem): MediaItem {
    const it: MediaItem =
      into ?? { kind: 'image', texture: null, video: null, ready: false, failed: false, aspect: 16 / 9, playing: false, width: 0, upgrading: false };
    if (into) it.upgrading = true;
    this.inflight++;
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        this.inflight--;
      }
    };
    const attempts = posterCandidates(srcs, width);
    const tryNext = () => {
      const url = attempts.shift();
      if (!url || this.disposed) {
        settle();
        if (into) it.upgrading = false;
        else it.failed = true;
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = async () => {
        try {
          await img.decode();
        } catch {
          /* already decoded, or decode() unsupported: upload anyway */
        }
        settle();
        if (this.disposed) return;
        const tex = new THREE.Texture(img);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        const old = it.texture;
        it.texture = tex;
        old?.dispose();
        it.aspect = img.naturalWidth / img.naturalHeight || 16 / 9;
        it.width = width;
        it.upgrading = false;
        it.ready = true;
      };
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
    return it;
  }

  private loadVideo(src: string): MediaItem {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.src = src;
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const it: MediaItem = { kind: 'video', texture, video, ready: false, failed: false, aspect: 16 / 9, playing: false, width: 0, upgrading: false };
    video.addEventListener('error', () => {
      it.failed = true;
    });
    return it;
  }

  /** Call every frame for items being shown: refreshes `ready` / `aspect` for clips. */
  isReady(it: MediaItem) {
    if (it.failed) return false;
    if (it.kind === 'video' && it.video) {
      const ok = it.video.readyState >= 2 && it.video.videoWidth > 0;
      if (ok) it.aspect = it.video.videoWidth / it.video.videoHeight;
      return ok;
    }
    return it.ready;
  }

  setVisible(it: MediaItem, visible: boolean) {
    if (it.kind !== 'video' || !it.video || it.failed) return;
    if (visible && !it.playing) {
      it.playing = true;
      const p = it.video.play();
      if (p && p.catch) p.catch(() => { it.playing = false; });
    } else if (!visible && it.playing) {
      it.playing = false;
      it.video.pause();
    }
  }

  /** Stops every clip (the pool itself lives on). */
  pauseAll() {
    this.items.forEach((it) => this.setVisible(it, false));
  }

  dispose() {
    this.disposed = true;
    this.items.forEach((it) => {
      if (it.video) {
        it.video.pause();
        it.video.removeAttribute('src');
        it.video.load();
      }
      it.texture?.dispose();
    });
    this.items.clear();
  }
}

let shared: MediaPool | null = null;

/**
 * The one pool for the session. It is a module-level singleton, so it survives the move from the
 * home page to the projects page: a poster is fetched, decoded and turned into a texture once, and
 * the next canvas picks it up as it is (the GPU copy is made again, the decoded image is not).
 */
export function sharedMediaPool(): MediaPool {
  return (shared ??= new MediaPool(window.matchMedia('(max-width: 760px)').matches ? 828 : 1080));
}

/**
 * Fills `order` with the indices whose `facing` is above `min`, most central (largest) first.
 * `order` is reused between frames; returns how many it holds.
 */
export function nearestFirst(facing: ArrayLike<number>, min: number, order: number[]): number {
  let n = 0;
  for (let i = 0; i < facing.length; i++) if (facing[i] > min) order[n++] = i;
  order.length = n;
  order.sort((a, b) => facing[b] - facing[a]);
  return n;
}
