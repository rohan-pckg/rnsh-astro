import { useEffect, useRef, type CSSProperties } from "react"
import * as THREE from "three"

/**
 * Pixel Blast, vendored from the official React Bits source
 * (`src/content/Backgrounds/PixelBlast/PixelBlast.jsx`, MIT) and trimmed for
 * use as a decorative ambient background:
 *
 * - The vertex/fragment shaders, shape masks and uniforms are verbatim,
 *   plus a small hover extension (see `uHover*`): the same soft Gaussian
 *   envelope around a damped cursor position lifts pixel density and warms
 *   lit pixels toward the brand accent. No new visual system, no new colour.
 * - Removed: click ripples, touch/liquid distortion, the `postprocessing`
 *   EffectComposer path (`liquid` / `noiseAmount`), and everything that path
 *   required. This variant needs only `three`.
 * - Hardened for background use: capped DPR, pause when the tab is hidden or
 *   the layer is offscreen, cursor tracking on fine pointers only, and no
 *   WebGL at all under `prefers-reduced-motion`.
 *
 * Subtlety is controlled by the caller (`patternDensity`, `speed`) and by the
 * `.pixel-blast-fixed` CSS opacity — keep both low. This component on its own
 * renders at full strength.
 */

export type PixelBlastVariant = "square" | "circle" | "triangle" | "diamond"

type PixelBlastProps = {
  variant?: PixelBlastVariant
  /** Device-pixel size of one block. Larger = chunkier and sparser. */
  pixelSize?: number
  color?: string
  /** Feature scale of the underlying noise. Larger = calmer. */
  patternScale?: number
  /** Coverage. Lower = sparser. Small changes move coverage a lot. */
  patternDensity?: number
  pixelSizeJitter?: number
  /** Fades the effect toward the viewport edges. */
  edgeFade?: number
  /** Animation rate. Keep well below the official default of 0.5. */
  speed?: number
  /** Cursor glow radius in CSS pixels. Large + soft by design. */
  hoverRadius?: number
  /**
   * Accent gain at the coverage stage: how strongly the texture densifies
   * around the cursor. This — not the color mix — is what makes the hover
   * visible. Kept at the lowest clearly-noticeable value.
   */
  hoverAccentStrength?: number
  /** Blend of hovered pixels toward the pure brand accent. 1 = full. */
  hoverColorStrength?: number
  className?: string
  style?: CSSProperties
}

const SHAPE_MAP: Record<PixelBlastVariant, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
}

const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

// Cursor hover extension (not part of the official source): position is in
// device pixels with a bottom-left origin, like gl_FragCoord. uHoverActive is
// a damped 0..1 envelope; at 0 the term vanishes and the frame is identical
// to the official output.
uniform vec2  uHoverPos;
uniform float uHoverRadius;
uniform float uHoverActive;
// Accent gain, applied at the coverage stage (see below): widens the
// threshold band near the cursor so the texture itself densifies.
uniform float uHoverAccentStrength;
// Accent response: uHoverColor is the portfolio accent, blended in with the
// same soft envelope. At a zero envelope the mix vanishes, so idle frames
// are identical to the official output.
uniform vec3  uHoverColor;
uniform float uHoverColorStrength;
// Brightness lift applied to pixels lit under the hover envelope.
uniform float uHoverBoost;
// Brightness lift for pixels a click ring passes over. 0 = official look.
uniform float uClickBoost;

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  // Cursor accent: the envelope is applied HERE, at the coverage stage, not
  // just at the color stage. Alpha is binary per pixel (see the bw step
  // below), so recoloring alone can never reveal a transparent fragment — and in dark
  // mode the base already is the accent, making a color mix a literal no-op.
  // Lifting feed widens the threshold band near the cursor, so the orange
  // texture itself densifies around it and fades out with the Gaussian.
  vec2 hoverVec = gl_FragCoord.xy - uHoverPos;
  float hoverDist = length(hoverVec) / max(uHoverRadius, 1.0);
  float hoverGlow = exp(-hoverDist * hoverDist * 3.0) * uHoverActive;
  feed += hoverGlow * uHoverAccentStrength;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  float clickFeed = 0.0;
  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
      clickFeed = max(clickFeed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;
  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  // Accent color: every hovered pixel resolves to the pure brand accent at
  // the envelope centre, fading back to the theme base with distance. Only
  // fragments with coverage (M > 0) can show it, so there is no halo — the
  // orange appears strictly through the Pixel Blast texture. Mixed in linear
  // space, ahead of the sRGB conversion below.
  vec3 color = mix(uColor, uHoverColor, hoverGlow * uHoverColorStrength);
  // Hover brightness stays a multiplier on lit fragments (unchanged).
  color *= 1.0 + hoverGlow * uHoverBoost;
  // Click accent: mix toward the EXACT brand accent uniform (#ff8700,
  // theme-independent), never a scalar brighten — brightening #ff8700
  // clamps its green channel and renders yellow.
  color = mix(color, uHoverColor, clamp(clickFeed * uClickBoost, 0.0, 1.0));

  // sRGB gamma correction - convert linear to sRGB for accurate color output
  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  fragColor = vec4(srgbColor, M);
}
`

const MAX_CLICKS = 10
/** The one accent the cursor may warm toward. Never theme-tinted. */
const HOVER_ACCENT = "#ff8700"
/** Decorative only: never render sharper than this. Phones get 1. */
const MAX_DPR_DESKTOP = 1.25
/** Hover brightness lift at the cursor centre (colour multiplier − 1). */
const HOVER_BOOST = 0.45
/** Click ring mixes lit pixels toward the exact brand accent (not a
    brightness multiply, which would push #ff8700's green channel up and
    read as yellow). */
const CLICK_BOOST = 0.85
/**
 * Small-viewport density multiplier: denser, more legible pixels on phones,
 * same noise, colour and speed. Desktop stays exactly 1×.
 */
const MOBILE_DENSITY_BOOST = 1.25
const MOBILE_BREAKPOINT_PX = 600

function densityScale() {
  if (typeof window === "undefined") return 1
  return window.innerWidth <= MOBILE_BREAKPOINT_PX ? MOBILE_DENSITY_BOOST : 1
}

type BlastState = {
  renderer: THREE.WebGLRenderer
  material: THREE.ShaderMaterial
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  uniforms: Record<string, THREE.IUniform>
  startTime: number
  timeOffset: number
  raf: number
  visible: boolean
  resizeObserver: ResizeObserver
  intersectionObserver: IntersectionObserver | null
}

function dprCap() {
  if (typeof window === "undefined") return 1
  return window.innerWidth < 640 ? 1 : MAX_DPR_DESKTOP
}

export default function PixelBlast({
  variant = "square",
  pixelSize = 6,
  color = "#ff8700",
  patternScale = 3,
  patternDensity = 0.55,
  pixelSizeJitter = 0,
  edgeFade = 0.5,
  speed = 0.2,
  hoverRadius = 240,
  hoverAccentStrength = 0.32,
  hoverColorStrength = 1,
  className,
  style,
}: PixelBlastProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<BlastState | null>(null)
  // Latest props, read by the frame loop and the live-update effect without
  // re-creating the WebGL context. Synced in an effect so render stays pure.
  const propsRef = useRef({
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    pixelSizeJitter,
    edgeFade,
    speed,
    hoverRadius,
    hoverAccentStrength,
    hoverColorStrength,
  })
  useEffect(() => {
    propsRef.current = {
      variant,
      pixelSize,
      color,
      patternScale,
      patternDensity,
      pixelSizeJitter,
      edgeFade,
      speed,
      hoverRadius,
      hoverAccentStrength,
      hoverColorStrength,
    }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || stateRef.current) return
    // Decorative: no animation at all when the user asked for less motion.
    // The page is complete without it (plain theme ground shows through).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const canvas = document.createElement("canvas")
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    })
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    renderer.setClearAlpha(0)
    container.appendChild(renderer.domElement)

    const p = propsRef.current
    const uniforms: Record<string, THREE.IUniform> = {
      uResolution: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(p.color) },
      // Ripples are permanently off; the shader still declares these, so
      // they must exist and stay parked offscreen.
      uClickPos: {
        value: Array.from(
          { length: MAX_CLICKS },
          () => new THREE.Vector2(-1, -1)
        ),
      },
      uClickTimes: { value: new Float32Array(MAX_CLICKS) },
      uShapeType: { value: SHAPE_MAP[p.variant] ?? 0 },
      uPixelSize: { value: p.pixelSize * renderer.getPixelRatio() },
      uScale: { value: p.patternScale },
      uDensity: { value: p.patternDensity * densityScale() },
      uPixelJitter: { value: p.pixelSizeJitter },
      uEnableRipples: { value: 1 },
      uRippleSpeed: { value: 0.3 },
      uRippleThickness: { value: 0.1 },
      uRippleIntensity: { value: 1 },
      uEdgeFade: { value: p.edgeFade },
      // Parked far offscreen with a zero envelope: no cursor, no change.
      uHoverPos: { value: new THREE.Vector2(-9999, -9999) },
      uHoverRadius: { value: p.hoverRadius * renderer.getPixelRatio() },
      uHoverActive: { value: 0 },
      uHoverAccentStrength: { value: p.hoverAccentStrength },
      uHoverColor: { value: new THREE.Color(HOVER_ACCENT) },
      uHoverColorStrength: { value: p.hoverColorStrength },
      uHoverBoost: { value: HOVER_BOOST },
      uClickBoost: { value: CLICK_BOOST },
    }

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SRC,
      fragmentShader: FRAGMENT_SRC,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(quad)

    const setSize = () => {
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()))
      renderer.setSize(w, h, false)
      const buffer = renderer.getDrawingBufferSize(new THREE.Vector2())
      uniforms.uResolution.value.set(buffer.x, buffer.y)
      uniforms.uDensity.value =
        propsRef.current.patternDensity * densityScale()
      uniforms.uPixelSize.value = propsRef.current.pixelSize * renderer.getPixelRatio()
      uniforms.uHoverRadius.value =
        propsRef.current.hoverRadius * renderer.getPixelRatio()
    }
    setSize()
    const resizeObserver = new ResizeObserver(setSize)
    resizeObserver.observe(container)

    const state: BlastState = {
      renderer,
      material,
      quad,
      uniforms,
      startTime: performance.now(),
      timeOffset: (window.crypto?.getRandomValues
        ? window.crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff
        : Math.random()) * 1000,
      raf: 0,
      visible: true,
      resizeObserver,
      intersectionObserver: null,
    }
    stateRef.current = state

    if ("IntersectionObserver" in window) {
      state.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          state.visible = entry?.isIntersecting ?? true
        },
        { threshold: 0 }
      )
      state.intersectionObserver.observe(container)
    }

    // Soft cursor glow, refs only — no React state, no re-renders. Tracked on
    // `window` (not the canvas) because the background itself is
    // `pointer-events: none` and must never intercept input. Fine pointers
    // only: touch and pen never arm it, so mobile stays clean and static.
    const hover = {
      tx: -9999,
      ty: -9999,
      cx: -9999,
      cy: -9999,
      target: 0,
      value: 0,
      last: performance.now(),
    }
    const hoverAllowed =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      hover.tx = event.clientX
      hover.ty = event.clientY
      hover.target = 1
    }
    const onPointerGone = () => {
      hover.target = 0
    }
    if (hoverAllowed) {
      window.addEventListener("pointermove", onPointerMove, { passive: true })
      document.documentElement.addEventListener("pointerleave", onPointerGone)
      window.addEventListener("blur", onPointerGone)
    }

    // The original Pixel Blast click ripple, re-enabled: every pointer-down
    // feeds the shader's uClickPos/uClickTimes ring buffer, exactly what the
    // official ripple block consumes. Independent of the hover envelope.
    let clickIndex = 0
    const onPointerDown = (event: PointerEvent) => {
      const r = container.getBoundingClientRect()
      const ratio = renderer.getPixelRatio()
      const x = (event.clientX - r.left) * ratio
      const y = (r.height - (event.clientY - r.top)) * ratio
      const pos = (uniforms.uClickPos.value as THREE.Vector2[])[clickIndex]
      pos.set(x, y)
      ;(uniforms.uClickTimes.value as Float32Array)[clickIndex] =
        uniforms.uTime.value as number
      clickIndex = (clickIndex + 1) % MAX_CLICKS
    }
    window.addEventListener("pointerdown", onPointerDown, { passive: true })

    const animate = () => {
      state.raf = requestAnimationFrame(animate)
      if (!state.visible || document.hidden) return
      const now = performance.now()
      uniforms.uTime.value =
        state.timeOffset +
        ((now - state.startTime) / 1000) * propsRef.current.speed
      if (hoverAllowed) {
        // Clamped frame delta, exponential damping: the glow trails the
        // cursor smoothly and settles back gently when it leaves.
        const dt = Math.min(Math.max((now - hover.last) / 1000, 0), 0.05)
        hover.last = now
        const follow = 1 - Math.exp(-dt * 7)
        const fade = 1 - Math.exp(-dt * 4)
        hover.cx += (hover.tx - hover.cx) * follow
        hover.cy += (hover.ty - hover.cy) * follow
        hover.value += (hover.target - hover.value) * fade
        const ratio = renderer.getPixelRatio()
        ;(uniforms.uHoverPos.value as THREE.Vector2).set(
          hover.cx * ratio,
          (container.clientHeight - hover.cy) * ratio
        )
        uniforms.uHoverActive.value = hover.value
      }
      renderer.render(scene, camera)
    }
    state.raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(state.raf)
      window.removeEventListener("pointerdown", onPointerDown)
      if (hoverAllowed) {
        window.removeEventListener("pointermove", onPointerMove)
        document.documentElement.removeEventListener(
          "pointerleave",
          onPointerGone
        )
        window.removeEventListener("blur", onPointerGone)
      }
      state.resizeObserver.disconnect()
      state.intersectionObserver?.disconnect()
      state.quad.geometry.dispose()
      state.material.dispose()
      state.renderer.dispose()
      state.renderer.forceContextLoss()
      if (state.renderer.domElement.parentElement === container) {
        container.removeChild(state.renderer.domElement)
      }
      stateRef.current = null
    }
  }, [])

  // Theme switches and prop tweaks apply to the live uniforms — no re-init.
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const u = state.uniforms
    ;(u.uColor.value as THREE.Color).set(color)
    u.uShapeType.value = SHAPE_MAP[variant] ?? 0
    u.uScale.value = patternScale
    u.uDensity.value = patternDensity * densityScale()
    u.uPixelJitter.value = pixelSizeJitter
    u.uEdgeFade.value = edgeFade
    u.uPixelSize.value = pixelSize * state.renderer.getPixelRatio()
    u.uHoverRadius.value = hoverRadius * state.renderer.getPixelRatio()
    u.uHoverAccentStrength.value = hoverAccentStrength
    u.uHoverColorStrength.value = hoverColorStrength
  }, [
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    pixelSizeJitter,
    edgeFade,
    hoverRadius,
    hoverAccentStrength,
    hoverColorStrength,
  ])

  return <div ref={containerRef} className={className} style={style} />
}
