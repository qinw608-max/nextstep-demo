(() => {
  const body = document.body;
  const canvas = document.getElementById("signal-field");
  const backLink = document.querySelector("[data-back]");
  const demoLink = document.querySelector("[data-demo-link]");
  const routeStage = document.querySelector(".logo-route");
  const routeLockup = document.querySelector(".logo-route__lockup");
  const routeMark = document.querySelector(".logo-route__mark");
  const routeSub = document.querySelector(".logo-route__sub");
  const routeScan = document.querySelector(".logo-route__scan");
  const params = new URLSearchParams(location.search);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("reduce-motion");
  const mobileMotionLite = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const saveData = navigator.connection?.saveData === true;
  const sourcePage = params.get("from") || "direct";
  let leaving = false;
  let leavingToDemo = false;
  body.classList.toggle("is-reduced-motion", reducedMotion);
  body.classList.toggle("is-save-data", saveData);

  function recentMarker(marker, maxAge = 8000) {
    const startedAt = Number(marker?.startedAt || 0);
    return Boolean(startedAt && Date.now() - startedAt >= 0 && Date.now() - startedAt < maxAge);
  }

  function consumeEntryMode() {
    let mode = params.get("transition") || "";
    try {
      const marker = JSON.parse(sessionStorage.getItem("t4-nextstep-transition") || "null");
      sessionStorage.removeItem("t4-nextstep-transition");
      if (recentMarker(marker) && marker.direction === "forward") mode = marker.mode || mode;
    } catch {}
    return mode;
  }

  const entryMode = consumeEntryMode();
  const isWorldEntry = sourcePage === "world" && (entryMode === "logo-lockup" || entryMode === "perspective-corridor");
  if (isWorldEntry) body.classList.add("is-entering-from-world");
  let routeTimeline = null;

  function demoDestination(base = new URL("interactive.html", location.href).href) {
    const url = new URL(base);
    url.searchParams.set("v", "20260713-8");
    url.searchParams.set("from", "github-pages");
    url.hash = "scenarios";
    return url.href;
  }

  async function preferRunningLocalDemo() {
    if (!demoLink || !/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 700);
    try {
      await fetch("http://127.0.0.1:4182/?probe=personal-site", {
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      demoLink.href = demoDestination("http://localhost:4182/");
    } catch {
      // Keep the public demo URL when the optional local preview is offline.
    } finally {
      clearTimeout(timeout);
    }
  }

  if (demoLink) {
    demoLink.href = demoDestination();
    preferRunningLocalDemo();
    demoLink.addEventListener("click", (event) => {
      const sameTab = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
      if (!sameTab) return;
      leavingToDemo = true;
      setTimeout(() => { leavingToDemo = false; }, 1000);
    });
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const reason = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(reason || "Signal shader failed to compile.");
    }
    return shader;
  }

  function createSignalField() {
    if (!canvas) return null;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return null;

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uPhase;
      uniform float uEnergy;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                   mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.52;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amp;
          p = p * 2.03 + 17.17;
          amp *= 0.48;
        }
        return value;
      }

      vec3 hsl2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
      }

      float field(vec2 uv, vec2 center, float radius, float aspect) {
        vec2 delta = vec2((uv.x - center.x) * aspect, uv.y - center.y);
        return exp(-dot(delta, delta) / max(0.001, radius));
      }

      float segmentGlow(vec2 uv, vec2 start, vec2 end, float radius, float aspect) {
        vec2 point = vec2(uv.x * aspect, uv.y);
        vec2 a = vec2(start.x * aspect, start.y);
        vec2 b = vec2(end.x * aspect, end.y);
        vec2 ab = b - a;
        float progress = clamp(dot(point - a, ab) / max(0.0001, dot(ab, ab)), 0.0, 1.0);
        vec2 nearest = a + ab * progress;
        vec2 delta = point - nearest;
        return exp(-dot(delta, delta) / max(0.0001, radius));
      }

      vec2 vnoise(vec2 p) {
        return vec2(noise(p), noise(p + vec2(37.2, 17.5)));
      }

      vec2 liquidDomain(vec2 p, float time) {
        vec2 q = vnoise(p * 1.45 + vec2(time * 0.045, -time * 0.035));
        vec2 r = vnoise(p * 3.1 + (q - 0.5) * 2.4 + vec2(-time * 0.12, time * 0.1));
        return (mix(q, r, 0.58) - 0.5) * 2.0;
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(1.0, uResolution.y);
        float slow = uTime * 0.24;
        float px = uPointer.x - 0.5;
        float py = uPointer.y - 0.5;
        float drift = sin(slow * 0.73 + uPhase * 1.17) * 0.055;
        float paletteClock = mod(6.0 + uTime * 0.06 + uPhase * 0.82 + px * 0.52 + uEnergy * 0.06, 3.0);
        float paletteMix = smoothstep(0.0, 1.0, fract(paletteClock));

        float n = fbm(uv * vec2(4.8 * aspect, 4.8) + vec2(uTime * 0.072, -uTime * 0.054));
        vec2 flowPoint = vec2(uv.x * aspect, uv.y);
        vec2 warp = liquidDomain(flowPoint + vec2(uPhase * 0.13, -uPhase * 0.09), uTime);
        float warpAmp = mix(0.024, 0.044, clamp(uEnergy, 0.0, 1.0));
        vec2 liquidOffset = vec2(warp.x / aspect, warp.y) * warpAmp;
        vec2 ribbonUv = uv + liquidOffset + vec2((n - 0.5) * 0.006);
        vec2 haloUv = uv + liquidOffset * 0.46;
        vec2 tip = vec2(
          0.80 + px * 0.055 + sin(slow * 0.46 + uPhase) * 0.018,
          0.52 + py * 0.052 + cos(slow * 0.39) * 0.012
        );
        vec2 upperStart = vec2(0.46 + drift * 0.46 - px * 0.025, 1.12 + sin(slow * 0.31) * 0.025);
        vec2 lowerStart = vec2(0.34 - drift * 0.34 - px * 0.018, -0.14 + cos(slow * 0.27) * 0.026);
        float upperCore = segmentGlow(ribbonUv, upperStart, tip, 0.0032 + uEnergy * 0.0005, aspect);
        float upperHalo = segmentGlow(haloUv, upperStart, tip, 0.021 + uEnergy * 0.002, aspect);
        float lowerCore = segmentGlow(ribbonUv, lowerStart, tip, 0.0041 + uEnergy * 0.0006, aspect);
        float lowerHalo = segmentGlow(haloUv, lowerStart, tip, 0.026 + uEnergy * 0.0024, aspect);
        float tipGlow = field(haloUv, tip, 0.048 + uEnergy * 0.004, aspect);
        float upperProgress = clamp((ribbonUv.x - upperStart.x) / max(0.001, tip.x - upperStart.x), 0.0, 1.0);
        float lowerProgress = clamp((ribbonUv.x - lowerStart.x) / max(0.001, tip.x - lowerStart.x), 0.0, 1.0);
        float upperFlow = fbm(vec2(upperProgress * 4.3 - uTime * 0.19, 1.7 + uPhase * 0.24));
        float lowerFlow = fbm(vec2(lowerProgress * 4.0 - uTime * 0.16, 7.3 - uPhase * 0.2));
        float upperBlobT = smoothstep(0.0, 1.0, fract(uTime * 0.046 + 0.12 + uPhase * 0.08));
        float lowerBlobT = smoothstep(0.0, 1.0, fract(uTime * 0.039 + 0.61 + uPhase * 0.07));
        float upperBlob = field(ribbonUv, mix(upperStart, tip, upperBlobT), 0.027 + upperFlow * 0.012, aspect);
        float lowerBlob = field(ribbonUv, mix(lowerStart, tip, lowerBlobT), 0.034 + lowerFlow * 0.014, aspect);

        vec3 tealA = vec3(0.025, 0.67, 0.62);
        vec3 tealB = vec3(0.08, 0.30, 0.95);
        vec3 tealC = vec3(0.48, 0.13, 0.94);
        vec3 emberA = vec3(0.95, 0.56, 0.12);
        vec3 emberB = vec3(0.91, 0.18, 0.25);
        vec3 emberC = vec3(0.66, 0.08, 0.49);
        vec3 mineralA = vec3(0.08, 0.72, 0.46);
        vec3 mineralB = vec3(0.02, 0.45, 0.74);
        vec3 mineralC = vec3(0.23, 0.15, 0.76);
        vec3 colorA;
        vec3 colorB;
        vec3 colorC;

        if (paletteClock < 1.0) {
          colorA = mix(tealA, emberA, paletteMix);
          colorB = mix(tealB, emberB, paletteMix);
          colorC = mix(tealC, emberC, paletteMix);
        } else if (paletteClock < 2.0) {
          colorA = mix(emberA, mineralA, paletteMix);
          colorB = mix(emberB, mineralB, paletteMix);
          colorC = mix(emberC, mineralC, paletteMix);
        } else {
          colorA = mix(mineralA, tealA, paletteMix);
          colorB = mix(mineralB, tealB, paletteMix);
          colorC = mix(mineralC, tealC, paletteMix);
        }

        vec3 upperColor = mix(colorA, colorB, smoothstep(0.04, 0.96, upperProgress + (upperFlow - 0.5) * 0.16));
        vec3 lowerColor = mix(colorC, colorB, smoothstep(0.04, 0.96, lowerProgress + (lowerFlow - 0.5) * 0.16));
        float upperRibbon = (upperCore * 0.56 + upperHalo * 0.23 + upperBlob * 0.18) * (0.64 + upperFlow * 0.6);
        float lowerRibbon = (lowerCore * 0.58 + lowerHalo * 0.25 + lowerBlob * 0.2) * (0.66 + lowerFlow * 0.56);
        float leftFalloff = mix(0.025, 1.0, smoothstep(0.16, 0.68, uv.x));
        vec3 color = vec3(0.0015, 0.004, 0.008);
        color += (upperColor * upperRibbon + lowerColor * lowerRibbon + colorB * tipGlow * 0.11) * leftFalloff * (0.56 + uEnergy * 0.1);
        color *= 0.88 + n * 0.24;
        float vignette = 1.0 - smoothstep(0.18, 1.12, distance(uv, vec2(0.54, 0.5)));
        color *= 0.42 + vignette * 0.7;
        gl_FragColor = vec4(max(color, 0.0), 1.0);
      }
    `;

    try {
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Signal shader failed to link.");
      }
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.useProgram(program);

      const points = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, points);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        pointer: gl.getUniformLocation(program, "uPointer"),
        time: gl.getUniformLocation(program, "uTime"),
        phase: gl.getUniformLocation(program, "uPhase"),
        energy: gl.getUniformLocation(program, "uEnergy"),
      };
      const state = { phase: 0, energy: 0.38, pointerX: 0.67, pointerY: 0.48 };
      let width = 0;
      let height = 0;
      let raf = 0;
      let paused = false;
      let lastDrawAt = -Infinity;

      function resize() {
        const cssPixels = Math.max(1, innerWidth * innerHeight);
        const mobileDprCap = saveData
          ? 1
          : Math.max(1, Math.min(1.4, Math.sqrt(760000 / cssPixels)));
        const dpr = Math.min(devicePixelRatio || 1, mobileMotionLite ? mobileDprCap : 1.5);
        const nextWidth = Math.max(1, Math.round(innerWidth * dpr));
        const nextHeight = Math.max(1, Math.round(innerHeight * dpr));
        if (nextWidth === width && nextHeight === height) return;
        width = nextWidth;
        height = nextHeight;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      function queueRender() {
        if (paused || reducedMotion || raf) return;
        raf = requestAnimationFrame(render);
      }

      function pauseRender() {
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
      }

      function resumeRender() {
        paused = false;
        lastDrawAt = performance.now();
        queueRender();
      }

      function render(now) {
        raf = 0;
        if (paused) return;
        if (mobileMotionLite && now - lastDrawAt < 1000 / 30) {
          queueRender();
          return;
        }
        lastDrawAt = now;
        resize();
        const time = reducedMotion ? 1.2 : now * 0.001;
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform2f(uniforms.pointer, state.pointerX, state.pointerY);
        gl.uniform1f(uniforms.time, time);
        gl.uniform1f(uniforms.phase, state.phase);
        gl.uniform1f(uniforms.energy, state.energy);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        queueRender();
      }

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseRender();
        else resumeRender();
      });
      addEventListener("pagehide", pauseRender);
      addEventListener("pageshow", resumeRender);
      render(performance.now());
      body.classList.add("has-signal-field");
      return state;
    } catch (error) {
      console.warn("NextStep signal field fallback active.", error);
      return null;
    }
  }

  function clearRouteStage() {
    body.classList.remove("is-entering-from-world", "is-returning-to-world");
    body.removeAttribute("aria-busy");
    document.documentElement.removeAttribute("data-nextstep-entry");
    if (window.gsap) {
      window.gsap.set([routeStage, routeLockup, routeMark, routeSub, routeScan].filter(Boolean), {
        clearProps: "visibility,opacity,transform,filter,clipPath",
      });
      window.gsap.set(["main", ".site-head", ".site-foot"], { clearProps: "opacity" });
    } else if (routeStage) {
      routeStage.removeAttribute("style");
    }
    routeTimeline = null;
  }

  function playLogoEntry() {
    document.documentElement.removeAttribute("data-nextstep-entry");
    if (!routeStage || !routeLockup || !routeMark || reducedMotion || !window.gsap) {
      clearRouteStage();
      return;
    }
    const { gsap } = window;
    const content = ["main", ".site-head", ".site-foot"];
    body.setAttribute("aria-busy", "true");
    gsap.set(content, { opacity: 0 });
    gsap.set(routeStage, { visibility: "visible", opacity: 1 });
    gsap.set(routeLockup, { opacity: 1, scale: 1 });
    gsap.set(routeMark, { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" });
    gsap.set(routeSub, { opacity: 1, y: 0 });
    gsap.set(routeScan, { opacity: 0, xPercent: -120 });
    routeTimeline = gsap.timeline({ defaults: { ease: "power2.inOut" } })
      .to(routeScan, { opacity: 0.52, duration: 0.08, ease: "power1.out" }, 0.04)
      .to(routeScan, { xPercent: 720, duration: 0.46, ease: "power2.inOut" }, 0.04)
      .to(routeScan, { opacity: 0, duration: 0.1, ease: "power1.in" }, 0.4)
      .to(content, { opacity: 1, duration: 0.46, ease: "power2.out" }, 0.14)
      .to(routeLockup, { opacity: 0, duration: 0.24, ease: "power1.out" }, 0.32)
      .to(routeStage, { opacity: 0, duration: 0.38, ease: "power2.out" }, 0.4)
      .add(clearRouteStage, 0.8);
  }

  function playLogoDeparture(kind, onComplete) {
    if (kind === "plain") {
      setTimeout(onComplete, reducedMotion ? 20 : 720);
      return;
    }
    if (!routeStage || !routeLockup || !routeMark || reducedMotion || !window.gsap) {
      body.setAttribute("aria-busy", "true");
      if (routeStage) {
        routeStage.style.visibility = "visible";
        routeStage.style.opacity = "1";
      }
      setTimeout(onComplete, reducedMotion ? 120 : 620);
      return;
    }
    const { gsap } = window;
    body.classList.add("is-returning-to-world");
    body.setAttribute("aria-busy", "true");
    gsap.set(routeStage, { visibility: "visible", opacity: 0 });
    gsap.set(routeLockup, { opacity: 1, scale: 0.98 });
    gsap.set(routeMark, { opacity: 1, clipPath: "inset(0% 0% 0% 93%)" });
    gsap.set(routeSub, { opacity: 0, y: 6 });
    gsap.set(routeScan, { opacity: 0, xPercent: -120 });
    routeTimeline = gsap.timeline({ defaults: { ease: "power2.inOut" }, onComplete })
      .to(routeStage, { opacity: 1, duration: 0.18, ease: "power1.out" }, 0)
      .to("main, .site-head, .site-foot", { opacity: 0, duration: 0.3, ease: "power2.in" }, 0.02)
      .to(routeMark, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.38, ease: "power3.out" }, 0.1)
      .to(routeLockup, { scale: 1, duration: 0.36, ease: "power2.out" }, 0.1)
      .to(routeSub, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.32)
      .to(routeScan, { opacity: 0.5, duration: 0.08, ease: "power1.out" }, 0.18)
      .to(routeScan, { xPercent: 720, duration: 0.46, ease: "power2.inOut" }, 0.18)
      .to(routeScan, { opacity: 0, duration: 0.1, ease: "power1.in" }, 0.54)
      .to({}, { duration: 0.16 });
  }

  function canTraverseBackTo(pathname) {
    if (history.length <= 1 || !document.referrer) return false;
    try { return new URL(document.referrer).pathname.endsWith(pathname); }
    catch { return false; }
  }

  function storeWorldReturnMarker() {
    if (sourcePage !== "world") return;
    try {
      sessionStorage.setItem("t4-world-return", JSON.stringify({
        from: "nextstep",
        node: "projects",
        mode: "logo-lockup",
        direction: "return",
        startedAt: Date.now(),
      }));
    } catch {}
  }

  function leavePage(event) {
    event?.preventDefault();
    if (leaving || body.classList.contains("is-entering-from-world")) return;
    leaving = true;
    storeWorldReturnMarker();
    body.classList.add("is-leaving");
    const historyPath = sourcePage === "projects" ? "/projects.html" : sourcePage === "world" ? "/world.html" : "";
    const useHistory = historyPath && canTraverseBackTo(historyPath);
    const portfolioBase = "https://suoluo-portfolio-d6e969w8ce60141-1415753242.tcloudbaseapp.com/";
    const fallback = sourcePage === "projects"
      ? `${portfolioBase}projects.html?from=nextstep#nextstep`
      : `${portfolioBase}world.html?from=nextstep#home`;
    playLogoDeparture(sourcePage === "world" ? "world" : "plain", () => {
      if (useHistory) history.back();
      else location.assign(fallback);
    });
  }

  const signal = createSignalField();
  const gsapReady = Boolean(window.gsap && window.ScrollTrigger);

  if (gsapReady) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    body.classList.add("motion-ready");

    if (!isWorldEntry) {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from(".site-head > *", { y: -18, opacity: 0, duration: 0.7, stagger: 0.08 })
        .from(".brand-mark span", { x: -36, opacity: 0, filter: "blur(12px)", duration: 0.9 }, 0.24)
        .from(".brand-mark strong", { x: 36, opacity: 0, filter: "blur(12px)", duration: 0.9 }, 0.28)
        .from(".brand-mark b", { opacity: 0, duration: 0.3 }, 0.76)
        .from(".brand-sub", { y: 18, opacity: 0, letterSpacing: "1.2em", duration: 0.8 }, 0.46)
        .from(".site-foot > *", { y: 12, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.76);
    }
    gsap.to(".brand-mark b", { opacity: 0.12, duration: 0.46, repeat: -1, yoyo: true, ease: "steps(1)" });

    if (!reducedMotion) {
      gsap.to(".brand-lockup", {
        yPercent: -16,
        scale: 0.9,
        opacity: 0.16,
        filter: mobileMotionLite ? "none" : "blur(8px)",
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 },
      });
      gsap.to(".site-head, .site-foot", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "42% top", end: "bottom top", scrub: true },
      });

      const corridorCards = gsap.utils.toArray(".corridor-card");
      const lastCorridorIndex = Math.max(1, corridorCards.length - 1);
      const corridor = gsap.timeline({
        scrollTrigger: {
          trigger: ".corridor",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.82,
          invalidateOnRefresh: true,
        },
      });
      corridor
        .fromTo(".corridor-copy", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.12, ease: "none" }, 0)
        .to(".corridor-copy", { opacity: 0.08, y: -28, duration: 0.18, ease: "none" }, 0.62);
      corridorCards.forEach((card, index) => {
        const side = index % 2 === 0 ? 1 : -1;
        const vertical = Number(card.dataset.y || 0);
        const at = (index / lastCorridorIndex) * 0.76;
        corridor
          .fromTo(card, {
            xPercent: -50,
            yPercent: -50,
            x: () => side * innerWidth * (innerWidth < 760 ? 0.15 : 0.27),
            y: () => vertical * innerHeight,
            z: -1900,
            rotateY: side * -16,
            rotateZ: side * 1.4,
            opacity: 0,
          }, {
            xPercent: -50,
            yPercent: -50,
            x: () => side * innerWidth * (innerWidth < 760 ? 0.035 : 0.085),
            y: () => vertical * innerHeight * 0.38,
            z: 330,
            rotateY: side * -3,
            rotateZ: 0,
            opacity: 0.94,
            duration: 0.22,
            ease: "none",
          }, at)
          .to(card, { z: () => mobileMotionLite ? 410 : 720, opacity: 0, duration: 0.07, ease: "none" }, at + 0.22);
      });

      const story = gsap.timeline({
        scrollTrigger: {
          trigger: ".story",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      });
      story
        .fromTo(".stage-index", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.12 }, 0)
        .fromTo(".story-stage h2", { opacity: 0, y: 48, filter: "blur(14px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.24 }, 0.03)
        .fromTo(".fragment", { opacity: 0, scale: 0.62 }, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.035 }, 0.12)
        .fromTo(".stage-note", { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.18)
        .to(".fragment", { left: "50%", top: "50%", xPercent: -50, yPercent: -50, opacity: 0.06, scale: 0.78, duration: 0.34, stagger: 0.018, ease: "power2.inOut" }, 0.44)
        .fromTo(".core-node", { opacity: 0, scale: 0.72, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, xPercent: -50, yPercent: -50, duration: 0.22, ease: "back.out(1.5)" }, 0.61)
        .to(".story-stage h2", { opacity: 0.16, y: -34, filter: "blur(4px)", duration: 0.2 }, 0.72)
        .to(".core-node", { boxShadow: "0 0 5rem rgba(77, 229, 157, 0.48)", duration: 0.16 }, 0.74)
        .to(".story-stage > *", { opacity: 0, duration: 0.16 }, 0.88);

      gsap.from(".exit-stage > *", {
        y: 24,
        opacity: 0,
        stagger: 0.09,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: ".exit-stage", start: "top 62%", toggleActions: "play none none reverse" },
      });

      if (signal) {
        gsap.to(signal, {
          phase: 0.92,
          energy: 0.58,
          ease: "none",
          scrollTrigger: { trigger: ".corridor", start: "top bottom", end: "bottom top", scrub: 1 },
        });
        gsap.to(signal, {
          phase: 1.15,
          energy: 0.66,
          ease: "none",
          scrollTrigger: { trigger: ".story", start: "top bottom", end: "bottom top", scrub: 1 },
        });
        gsap.to(signal, {
          phase: 2.35,
          energy: 0.5,
          ease: "none",
          scrollTrigger: { trigger: ".exit-stage", start: "top bottom", end: "bottom top", scrub: 1 },
        });
      }
    }

    if (signal && !reducedMotion) {
      const pointX = gsap.quickTo(signal, "pointerX", { duration: 0.8, ease: "power3.out" });
      const pointY = gsap.quickTo(signal, "pointerY", { duration: 0.8, ease: "power3.out" });
      const energy = gsap.quickTo(signal, "energy", { duration: 1.1, ease: "power2.out" });
      addEventListener("pointermove", (event) => {
        pointX(event.clientX / innerWidth);
        pointY(1 - event.clientY / innerHeight);
        energy(0.7 + Math.min(0.34, Math.abs(event.movementX) * 0.012 + Math.abs(event.movementY) * 0.012));
      }, { passive: true });
      addEventListener("pointerleave", () => energy(0.44), { passive: true });
      addEventListener("pointerdown", () => energy(1.18), { passive: true });
      addEventListener("pointerup", () => energy(0.58), { passive: true });
    }

    addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
  }

  if (isWorldEntry) playLogoEntry();
  else document.documentElement.removeAttribute("data-nextstep-entry");

  backLink?.addEventListener("click", leavePage);
  addEventListener("contextmenu", leavePage);
  addEventListener("pagehide", () => {
    if (!leaving && !leavingToDemo) storeWorldReturnMarker();
  });
  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" && event.key !== "Backspace") return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    leavePage(event);
  });

  addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    leaving = false;
    leavingToDemo = false;
    routeTimeline?.kill();
    routeTimeline = null;
    body.classList.remove("is-leaving", "is-returning-to-world");
    clearRouteStage();
    window.ScrollTrigger?.update();
  });
})();
