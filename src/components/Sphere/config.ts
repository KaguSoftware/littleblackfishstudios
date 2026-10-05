// Everything you might want to tune lives here.
export const CONFIG = {
  // Sphere geometry (world units). The camera sits at the centre.
  shellRadius: 11.5, // the dark inner shell
  tileRadius: 9.6, // radius the screens sit on
  starRadius: 10.6,

  // Screens. Angular width in degrees, height follows `aspect`.
  tileWidthDeg: 22,
  aspect: 16 / 9,
  gapDeg: 2.5,

  // The screens sit on rings of latitude, one every `rowStepDeg`, all the way from the south pole to
  // the north pole. A ring holds as many screens as fit round it, so they thin out toward the poles,
  // and each pole is capped by one small screen. Nothing is clamped: drag over the top and on.
  rowStepDeg: 15,
  maxLatDeg: 75, // the outermost full ring
  poleScale: 0.5, // size of the screen on each pole, as a fraction of a full one

  // How long the placeholder animations loop (seconds). Picked per project.
  loopSeconds: [4, 5, 6, 8],

  // Camera
  baseHFovDeg: 100, // horizontal field of view the layout is tuned for (landscape)
  portraitHFovDeg: 64, // …and on tall phone screens
  minVFov: 52,
  maxVFov: 112,
  // There is no zooming. This is the one fixed view: how much wider than `baseHFovDeg` it looks.
  // Above 1 the screens are smaller and more of the sphere curves round you.
  viewZoom: 1.3,
  // The same on tall phone screens. Below 1 the screens are bigger and the sphere is zoomed in, so
  // they stay readable on a narrow display (1.3 there is clamped at the widest view, `maxVFov`).
  portraitViewZoom: 0.8,
  autoRotateAfter: 6, // seconds idle before the slow drift starts
  autoRotateSpeed: 0.03, // rad/s
  inertia: 3.2, // higher = stops sooner

  // Turning the sphere about its poles moves the middle of the view by only cos(pitch), so a
  // sideways drag is sped up by 1 / cos(pitch) to keep the surface under your finger. This caps it.
  poleGain: 0.22,

  // Focus view: how much of the viewport height the screen fills
  focusFill: 0.6,

  // The project posters and clips are the only colour on the page.
  // 'always': every poster shows its own colours. 'focus': only the opened one. 'never': greys.
  posterColor: 'always' as 'always' | 'focus' | 'never',

  // The label atlas holds two columns of 25.
  maxProjects: 50,
};
