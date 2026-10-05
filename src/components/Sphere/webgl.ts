let supported: boolean | undefined;

/** Probes with a throwaway canvas, once per page load. */
export function detectWebGL(): boolean {
  if (supported !== undefined) return supported;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    supported = gl !== null;
    // Give the probe context back straight away.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    supported = false;
  }
  return supported;
}
