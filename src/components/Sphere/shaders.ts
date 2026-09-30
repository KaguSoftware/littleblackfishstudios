// GLSL for the three things we draw: the inner shell, the dust/stars, and the screens.
// Everything is black, white and the greys between, except the screens themselves (their
// animations, posters and clips), which are in colour. The screens are where the magic is:
// geometry is placed on the sphere in the vertex shader, and the placeholder "videos" are
// procedural animations that loop perfectly (every time-dependent term is an integer
// multiple of the loop phase).

export const SCREEN_VERT = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uScale;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec2 o = (uv - 0.5) * 2.0 * uHalf * uScale;
  // gnomonic patch: looks perfectly flat from the centre of the sphere
  vec3 q = uCenter + uRight * o.x + uUp * o.y;
  vec3 p = normalize(q) * uRadius;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

export const SCREEN_FRAG = /* glsl */ `
precision highp float;
#define TAU 6.28318530718

varying vec2 vUv;

uniform float uPhase;      // 0..1 position in the loop
uniform float uScene;      // which placeholder animation
uniform vec3 uC0;          // palette: dark, mid, bright
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uAspect;
uniform float uHover;
uniform float uFocus;
uniform float uDim;
uniform float uIntro;
uniform float uEdge;       // fades screens out near the top/bottom seam
uniform float uColor;      // how much of the poster's own colour to show: 0 = greys, 1 = full colour
uniform float uRtl;        // 1 = caption sits at the right
uniform float uTime;
uniform sampler2D uAtlas;
uniform vec4 uLabel;       // x: column, y: row, z: columns, w: rows
uniform float uLabelAspect;
uniform sampler2D uMap;    // poster / video frame (when uVideo > 0)
uniform float uVideo;
uniform float uVideoAspect;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 ramp(float v, vec3 c0, vec3 c1, vec3 c2) {
  v = clamp(v, 0.0, 1.0);
  vec3 a = mix(c0, c1, smoothstep(0.0, 0.65, v));
  return mix(a, c2, smoothstep(0.6, 1.0, v));
}

// 0 ─ plasma
vec3 sPlasma(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float v = sin(p.x * 3.0 + w + sin(p.y * 2.2 - w) * 1.4) + sin(p.y * 3.6 - w + sin(p.x * 1.7 + w) * 1.2)
          + sin((p.x + p.y) * 2.4 + 2.0 * w)
          + sin(length(p - 0.6 * vec2(sin(w), cos(w))) * 5.5 - w);
  return ramp(v * 0.25 + 0.5, c0, c1, c2);
}

// 1 ─ tunnel
vec3 sTunnel(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float z = 1.0 / (r + 0.22);
  float ring = fract(z * 1.3 - 3.0 * ph);
  float band = smoothstep(0.0, 0.06, ring) * (1.0 - smoothstep(0.06, 0.4, ring));
  float spokes = 0.5 + 0.5 * cos(a * 8.0 + TAU * ph);
  float v = band * (0.55 + 0.45 * spokes) * smoothstep(0.02, 0.35, r);
  v += 0.28 * exp(-r * 3.0);
  return ramp(v, c0, c1, c2);
}

// 2 ─ orbits
vec3 sOrbit(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float g = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float k = 1.0 + mod(fi, 3.0);
    float ang = dir * k * w + fi * 0.95;
    float rad = 0.2 + 0.12 * fi;
    vec2 c = vec2(cos(ang), sin(ang)) * rad;
    g += 0.0012 / (abs(length(p) - rad) + 0.004);
    g += 0.011 / (length(p - c) + 0.011) * 0.9;
  }
  return ramp(g * 0.75, c0, c1, c2);
}

// 3 ─ waves
vec3 sWaves(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float g = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float k = 1.0 + mod(fi, 3.0);
    float y0 = (fi - 4.0) * 0.2;
    float y = y0 + 0.16 * sin(p.x * (1.8 + 0.25 * fi) + k * w + fi * 0.8);
    float d = abs(p.y - y);
    g += 0.0075 / (d + 0.0075) * (0.3 + 0.7 * (1.0 - abs(fi - 4.0) / 5.0));
  }
  return ramp(g * 0.4, c0, c1, c2);
}

// 4 ─ retro grid + sun
vec3 sGrid(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float y = p.y - 0.12;
  vec3 col = mix(c0 * 0.7, c1 * 0.5, smoothstep(-0.6, 1.0, p.y));
  vec2 sp = p - vec2(0.0, 0.42);
  float sd = length(sp);
  float sun = smoothstep(0.38, 0.365, sd);
  float mask = sp.y < 0.04 ? step(0.0, sin(sp.y * 46.0 - TAU * ph * 3.0)) : 1.0;
  col = mix(col, ramp(0.72 + (sp.y + 0.36) * 0.45, c0, c1, c2), sun * mask);
  col += c1 * 0.25 * exp(-max(sd - 0.36, 0.0) * 5.0);
  if (y < 0.0) {
    float z = 0.55 / (-y);
    float gx = abs(fract(p.x * z * 0.5) - 0.5) / z;
    float gz = abs(fract(z * 0.6 - ph * 3.0) - 0.5);
    float lx = smoothstep(0.014, 0.0, gx);
    float lz = smoothstep(0.05, 0.0, gz);
    float fade = smoothstep(0.0, -0.4, y);
    col = mix(col, c0 * 0.45, smoothstep(0.0, -0.05, y));
    col += c2 * (lx + lz) * 0.85 * fade;
  }
  return col;
}

// 5 ─ metaballs
vec3 sBlobs(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float f = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(cos(w * (1.0 + mod(fi, 2.0)) + fi * 1.3) * 1.15,
                  sin(w * (1.0 + mod(fi + 1.0, 2.0)) + fi * 2.1) * 0.55);
    vec2 d = p - c;
    f += 0.11 / (dot(d, d) + 0.035);
  }
  float v = smoothstep(0.9, 2.6, f);
  vec3 col = ramp(v, c0, c1, c2);
  col += c2 * 0.55 * exp(-abs(f - 1.5) * 7.0);
  return col;
}

// 6 ─ radar
vec3 sRadar(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float a = atan(p.y, p.x);
  float r = length(p);
  float s = fract(-a / TAU - ph);
  float beam = pow(s, 7.0) * smoothstep(1.02, 0.94, r);
  float rings = smoothstep(0.03, 0.0, abs(fract(r * 2.6 + 0.5) - 0.5)) * smoothstep(1.0, 0.9, r);
  float cross = smoothstep(0.012, 0.0, abs(p.x)) + smoothstep(0.012, 0.0, abs(p.y));
  float v = beam * 0.85 + rings * 0.28 + cross * 0.1 * smoothstep(1.0, 0.2, r);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ab = fi * 2.4 + 0.5;
    vec2 pb = vec2(cos(ab), sin(ab)) * (0.22 + 0.13 * fi);
    float age = fract(ph + ab / TAU);
    v += 0.014 / (length(p - pb) + 0.014) * exp(-3.5 * age);
  }
  return ramp(v, c0, c1, c2);
}

// 7 ─ equaliser
vec3 sBars(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float n = 16.0;
  float x01 = p.x / (uAspect * 2.0) + 0.5;
  float id = floor(x01 * n);
  float fx = fract(x01 * n);
  float h = 0.16 + 0.62 * (0.5 + 0.5 * sin(w * (1.0 + mod(id, 3.0)) + id * 1.9));
  float y01 = p.y * 0.5 + 0.5;
  float bar = step(fx, 0.74) * step(0.1, y01) * step(y01, 0.1 + h);
  float seg = step(fract(y01 * 16.0), 0.66);
  float t = clamp((y01 - 0.1) / max(h, 0.001), 0.0, 1.0);
  vec3 col = mix(c0 * 1.1, c1 * 0.18, y01);
  col = mix(col, ramp(0.35 + 0.65 * t, c0, c1, c2), bar * seg);
  return col;
}

// 8 ─ kaleidoscope
vec3 sKaleido(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float r = length(p);
  float a = atan(p.y, p.x) + w;
  float seg = TAU / 8.0;
  a = abs(mod(a, seg) - seg * 0.5);
  vec2 q = r * vec2(cos(a), sin(a));
  float v = sin(q.x * 9.0 + w) + sin(q.y * 11.0 - 2.0 * w) + sin(r * 8.0 - w);
  v = v / 3.0 * 0.5 + 0.5;
  return ramp(pow(v, 1.3) * 1.1, c0, c1, c2);
}

// 9 ─ lissajous
vec3 sLiss(vec2 p, float ph, vec3 c0, vec3 c1, vec3 c2) {
  float w = TAU * ph;
  float acc = 0.0;
  for (int i = 0; i < 56; i++) {
    float t = float(i) / 56.0 * TAU;
    vec2 c = vec2(sin(3.0 * t + w) * 1.25, sin(2.0 * t + 2.0 * w) * 0.68);
    vec2 d = p - c;
    acc += 0.0009 / (dot(d, d) + 0.00045);
  }
  return ramp(acc * 0.32, c0, c1, c2) + c0 * 0.4;
}

vec3 scene(float id, vec2 p) {
  float ph = uPhase;
  if (id < 0.5) return sPlasma(p, ph, uC0, uC1, uC2);
  if (id < 1.5) return sTunnel(p, ph, uC0, uC1, uC2);
  if (id < 2.5) return sOrbit(p, ph, uC0, uC1, uC2);
  if (id < 3.5) return sWaves(p, ph, uC0, uC1, uC2);
  if (id < 4.5) return sGrid(p, ph, uC0, uC1, uC2);
  if (id < 5.5) return sBlobs(p, ph, uC0, uC1, uC2);
  if (id < 6.5) return sRadar(p, ph, uC0, uC1, uC2);
  if (id < 7.5) return sBars(p, ph, uC0, uC1, uC2);
  if (id < 8.5) return sKaleido(p, ph, uC0, uC1, uC2);
  return sLiss(p, ph, uC0, uC1, uC2);
}

void main() {
  vec2 uv = vUv;
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);   // height units, centred
  vec2 p = q * 2.0;

  // rounded rectangle
  float rad = 0.055;
  vec2 b = vec2(uAspect, 1.0) * 0.5 - rad;
  vec2 dd = abs(q) - b;
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - rad;
  float aa = max(fwidth(sd), 1e-4);
  float mask = 1.0 - smoothstep(-aa, aa, sd);

  // ── media ── (the procedural scene is skipped once a poster fully covers it)
  // The screens are the only colour: the animations use their project's palette, the posters and
  // clips keep their own. (Everything around them is black and white.)
  vec3 col = vec3(0.0);
  if (uVideo < 0.999) col = scene(uScene, p);
  if (uVideo > 0.001) {
    float va = uVideoAspect / uAspect;
    vec2 vuv = uv - 0.5;
    if (va > 1.0) vuv.x /= va; else vuv.y *= va;   // object-fit: cover
    vec3 vid = texture2D(uMap, vuv + 0.5).rgb;
    vid = mix(vec3(dot(vid, vec3(0.299, 0.587, 0.114))), vid, uColor);
    col = mix(col, vid, uVideo);
  }

  // ── tile polish ──
  float vr = length(q / (vec2(uAspect, 1.0) * 0.5));
  col *= mix(1.0, 0.7, smoothstep(0.65, 1.45, vr));                 // vignette
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.03; // film grain
  col *= 1.0 + 0.16 * uHover;

  // legibility gradient under the label
  float gbot = smoothstep(0.6, 0.0, uv.y);
  col = mix(col, col * 0.22, gbot * 0.88 * (1.0 - 0.6 * uFocus));

  // label (from the atlas)
  float labH = 0.25;
  float labW = labH * uLabelAspect;
  float x0 = mix(0.075, uAspect - 0.075 - labW, uRtl);
  vec2 lu = vec2((uv.x * uAspect - x0) / labW, (uv.y - 0.085) / labH);
  float inside = step(0.0, lu.x) * step(lu.x, 1.0) * step(0.0, lu.y) * step(lu.y, 1.0);
  vec2 luc = clamp(lu, 0.0, 1.0);
  vec2 auv = vec2((uLabel.x + luc.x) / uLabel.z, (uLabel.w - uLabel.y - 1.0 + luc.y) / uLabel.w);
  float la = texture2D(uAtlas, auv).a * inside;
  col = mix(col, vec3(1.0), la * (1.0 - 0.75 * uFocus));

  // loop progress bar (sells the "it's a video" feel)
  float barIn = step(0.045, uv.x) * step(uv.x, 0.955) * step(0.03, uv.y) * step(uv.y, 0.042);
  float fill = step((uv.x - 0.045) / 0.91, uPhase);
  float barA = barIn * (0.14 + 0.86 * fill) * (0.3 + 0.7 * uHover);
  col = mix(col, vec3(0.92), barA * 0.85);

  // rim light
  float rim = exp(-pow((sd + 0.006) * 95.0, 2.0));
  col += vec3(1.0) * rim * (0.16 + 0.8 * uHover + 0.7 * uFocus);

  // dimmed (filtered out / something else in focus)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * 0.5, uDim * 0.85) * (1.0 - 0.5 * uDim);

  float alpha = mask * uIntro * uEdge;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`

export const SHELL_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`

// The backdrop: a black dome with slow grey light drifting across it and a fine latitude /
// longitude grid. It is fixed to the world, so it turns with the screens when you drag.
export const SHELL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 top = vec3(0.004);
  vec3 hor = vec3(0.030);
  vec3 bot = vec3(0.002);
  vec3 col = mix(hor, top, smoothstep(0.0, 0.85, h));
  col = mix(col, bot, smoothstep(0.0, -0.85, h));
  col += vec3(0.20) * exp(-h * h * 9.0) * 0.16;

  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(h, -1.0, 1.0));
  float wlat = lat;

  // slow drifting bands of light
  float n  = 0.5 + 0.5 * sin(lon * 2.0 + uTime * 0.07 + 2.0 * sin(wlat * 3.0 - uTime * 0.05));
  float n2 = 0.5 + 0.5 * sin(lon * 3.0 - uTime * 0.05 + wlat * 2.0);
  float n3 = 0.5 + 0.5 * sin(lon * 5.0 + uTime * 0.03 - wlat * 4.0 + 1.7);
  col += vec3(0.20) * n * n * smoothstep(-0.2, 0.9, h) * 0.34;
  col += vec3(0.16) * n2 * n2 * smoothstep(0.2, -0.9, h) * 0.30;
  col += vec3(0.12) * pow(n3, 6.0) * 0.30;

  // lat / long grid
  const float DEG = 0.01745329252;
  vec2 g = vec2(lon / (15.0 * DEG), wlat / (10.0 * DEG));
  float lonB = atan(-d.x, d.z);
  float fwx = min(fwidth(lon), fwidth(lonB)) / (15.0 * DEG);
  vec2 fw = vec2(fwx, fwidth(wlat) / (10.0 * DEG));
  vec2 gd = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
  float line = 1.0 - min(min(gd.x, gd.y), 1.0);
  float fade = 1.0 - smoothstep(0.72, 0.98, abs(h));
  col += vec3(1.0) * line * 0.075 * fade;

  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
`

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPx;
varying float vA;
void main() {
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx;
  vA = 0.5 + 0.5 * sin(uTime * (0.5 + aPhase * 1.6) + aPhase * 40.0);
}
`

export const STAR_FRAG = /* glsl */ `
precision highp float;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vec3(1.0), a * (0.22 + 0.7 * vA));
}
`
