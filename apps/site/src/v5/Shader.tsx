import { useEffect, useRef } from "react";

/*
 * The hero's light: slow, domain-warped noise in cobalt and violet, brightest behind the mark and
 * fading to night at the edges. Drawn at reduced resolution (it's soft anyway), paused when off
 * screen or in a background tab, and a single still frame when reduced motion is on. Without WebGL
 * the CSS gradient behind the canvas shows instead.
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_t * 0.045;

  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, -t)));
  vec2 r = vec2(fbm(p * 1.7 + 2.0 * q + vec2(1.7, 9.2) + t * 1.2), fbm(p * 1.7 + 2.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.5 + 2.3 * r);

  vec3 night = vec3(0.012, 0.018, 0.075);
  vec3 cobalt = vec3(0.17, 0.29, 0.93);
  vec3 violet = vec3(0.40, 0.26, 0.95);
  vec3 ice = vec3(0.62, 0.78, 1.0);

  vec3 col = night;
  col = mix(col, cobalt, smoothstep(0.32, 0.86, f) * 0.9);
  col = mix(col, violet, smoothstep(0.5, 1.05, length(q)) * 0.38);
  col += ice * pow(smoothstep(0.58, 1.0, f), 3.0) * 0.42;

  // One pool of light high in the frame, behind the mark; night everywhere else.
  float pool = 1.0 - smoothstep(0.0, 0.78, length((uv - vec2(0.5, 0.78)) * vec2(1.25, 1.55)));
  float floor_ = smoothstep(0.0, 0.5, uv.y);
  col = mix(night, col, pool * floor_);

  // Fine grain so the gradient never bands.
  col += (hash(gl_FragCoord.xy + fract(u_t)) - 0.5) * 0.022;
  gl_FragColor = vec4(col, 1.0);
}`;

export function Shader({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");

    // Half resolution: the light is soft, and this keeps phones cool.
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    const size = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    const draw = (t: number) => {
      size();
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const start = performance.now() - 40000; // start mid-flow, not at the noise's origin
    const loop = (now: number) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (still) draw(40);
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    canvas.dataset.ready = "1";
    play();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : play());
    document.addEventListener("visibilitychange", onVis);
    const onResize = () => still && draw(40);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
