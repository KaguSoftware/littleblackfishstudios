import * as THREE from 'three';
import type { SphereProject } from './types';

/** Poster through the site's image optimizer: same-origin (no CORS), resized, AVIF/WebP, cached. */
export function posterUrl(src: string, width: number) {
  if (src.startsWith('/')) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/** YouTube only makes the 1280×720 still for some videos; every video has the 320×180 one. */
const YT_MAXRES = /^(https:\/\/img\.youtube\.com\/vi\/[\w-]{11}\/)maxresdefault\.jpg$/;

/** Where to try to get a poster from, best first. */
function posterCandidates(src: string, width: number) {
  const list = [posterUrl(src, width), src];
  const yt = YT_MAXRES.exec(src);
  if (yt) {
    const small = `${yt[1]}mqdefault.jpg`;
    list.push(posterUrl(small, width), small);
  }
  return list;
}

export interface MediaItem {
  kind: 'image' | 'video';
  texture: THREE.Texture | null;
  video: HTMLVideoElement | null;
  ready: boolean;
  failed: boolean;
  /** width / height of the poster or clip */
  aspect: number;
  playing: boolean;
}

/**
 * Posters and clips for the screens. A project shows on many screens but is ONE texture, created
 * the first time one of its screens comes into view. Posters are plain images; a project with
 * `video` gets one muted looping <video> that only plays while on screen.
 */
export class MediaPool {
  items = new Map<string, MediaItem>();
  private disposed = false;

  constructor(private width: number) {}

  get(project: SphereProject): MediaItem | null {
    if (!project.image && !project.video) return null;
    let it = this.items.get(project.id);
    if (!it) {
      it = project.video ? this.loadVideo(project.video) : this.loadImage(project.image as string);
      this.items.set(project.id, it);
    }
    return it;
  }

  private loadImage(src: string): MediaItem {
    const it: MediaItem = { kind: 'image', texture: null, video: null, ready: false, failed: false, aspect: 16 / 9, playing: false };
    const attempts = posterCandidates(src, this.width);
    const tryNext = () => {
      const url = attempts.shift();
      if (!url || this.disposed) {
        it.failed = true;
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
        if (this.disposed) return;
        const tex = new THREE.Texture(img);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        it.texture = tex;
        it.aspect = img.naturalWidth / img.naturalHeight || 16 / 9;
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
    const it: MediaItem = { kind: 'video', texture, video, ready: false, failed: false, aspect: 16 / 9, playing: false };
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
