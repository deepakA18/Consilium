"use client";

import { useEffect, useRef } from "react";

/**
 * Full-bleed WebGL nebula for the hero. A domain-warped fractal-noise field tinted brand-violet,
 * with a green pole (Bull / LIQUIDATABLE) and a red pole (Bear / SAFE) bleeding through the cloud —
 * the adversarial market rendered as light. Mouse-reactive, DPR-aware, pauses when offscreen, and
 * degrades to a static CSS gradient when WebGL or reduced-motion isn't available.
 */

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_noedge;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0,0.0)), c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.045;
  vec2 m = (u_mouse - 0.5) * 0.35;

  // domain warping (iq) — slow, liquid drift
  vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(fbm(uv + 1.6 * q + vec2(1.7, 9.2) + m), fbm(uv + 1.6 * q + vec2(8.3, 2.8) - m));
  float f = fbm(uv + 2.0 * r);

  // monochrome smoke — near-black base, soft white cloud
  float cloud = smoothstep(0.0, 1.05, f);
  vec3 col = vec3(0.03);
  col += vec3(0.82) * cloud * 0.8;                 // body of the cloud
  col = mix(col, vec3(1.0), pow(r.x, 2.0) * 0.28); // bright filaments
  col += pow(max(0.0, 1.0 - length(uv * vec2(0.65, 1.15))), 3.0) * 0.15; // core glow

  // vignette + soft filmic rolloff
  col *= 1.0 - 0.5 * length(uv * 0.72);
  col = col / (col + 0.6) * 1.4;

  // vertical fade — melt the smoke into near-black at the top & bottom edges (seamless blend).
  // Skipped (u_noedge=1) when the canvas is shaped externally, e.g. the CSS dome mask.
  float vy = gl_FragCoord.y / u_res.y;
  float vmask = smoothstep(0.0, 0.32, vy) * smoothstep(0.0, 0.30, 1.0 - vy);
  col *= mix(0.06, 1.0, max(vmask, u_noedge));

  col += (hash(uv + t) - 0.5) * 0.012; // faint grain
  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export function NebulaCanvas({ className, edgeFade = true }: { className?: string; edgeFade?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) {
      canvas.style.display = "none"; // CSS fallback gradient shows through
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uNoedge = gl.getUniformLocation(prog, "u_noedge");
    gl.uniform1f(uNoedge, edgeFade ? 0 : 1);

    const mouse = { x: 0.5, y: 0.5 };
    const target = { x: 0.5, y: 0.5 };

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.75);
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const d = dpr();
      canvas.width = Math.max(1, Math.floor(w * d));
      canvas.height = Math.max(1, Math.floor(h * d));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver((es) => (visible = es[0]?.isIntersecting ?? true), { threshold: 0 });
    io.observe(canvas);

    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      mouse.x += (target.x - mouse.x) * 0.04;
      mouse.y += (target.y - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduce ? 12 : (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (reduce) cancelAnimationFrame(raf); // draw one frame, then stop
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
