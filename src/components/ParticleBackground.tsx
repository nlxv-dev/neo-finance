import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  isMint: boolean;
  life: number;
  maxLife: number;
}

type ResizeResult = 'unavailable' | 'changed' | 'same';

export function ParticleBackground({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDarkRef = useRef(isDark);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let isRunning = false;
    let pendingStartFrame = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const createParticle = (randomLife = false): Particle => {
      const maxLife = 420 + Math.random() * 380;

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.11,
        vy: (Math.random() - 0.5) * 0.11 - 0.035,
        radius:
          Math.random() < 0.55
            ? 0.35 + Math.random() * 0.45
            : 0.6 + Math.random() * 0.85,
        opacity: 0,
        isMint: Math.random() < 0.52,
        life: randomLife ? Math.random() * maxLife : 0,
        maxLife,
      };
    };

    const resetParticles = () => {
      particles = Array.from({ length: 213 }, () => createParticle(true));
    };

    const syncCanvasSize = (): ResizeResult => {
      const parent = canvas.parentElement;
      if (!parent) return 'unavailable';

      const rect = parent.getBoundingClientRect();
      const nextWidth = rect.width;
      const nextHeight = rect.height;

      // Some mobile WebViews briefly report a zero-sized viewport on resume.
      if (nextWidth <= 0 || nextHeight <= 0) return 'unavailable';

      const nextPixelRatio = window.devicePixelRatio || 1;
      const nextCanvasWidth = Math.round(nextWidth * nextPixelRatio);
      const nextCanvasHeight = Math.round(nextHeight * nextPixelRatio);
      const changed =
        nextWidth !== width ||
        nextHeight !== height ||
        nextPixelRatio !== pixelRatio ||
        canvas.width !== nextCanvasWidth ||
        canvas.height !== nextCanvasHeight;

      width = nextWidth;
      height = nextHeight;
      pixelRatio = nextPixelRatio;

      if (changed) {
        canvas.width = nextCanvasWidth;
        canvas.height = nextCanvasHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      // Unlike scale(), setTransform replaces the matrix and cannot accumulate DPR scaling.
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      return changed ? 'changed' : 'same';
    };

    const stopLoop = () => {
      isRunning = false;
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    };

    const cancelPendingStart = () => {
      if (pendingStartFrame) {
        cancelAnimationFrame(pendingStartFrame);
        pendingStartFrame = 0;
      }

      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const animate = () => {
      animationRef.current = 0;
      if (!isRunning || document.hidden) return;

      ctx.clearRect(0, 0, width, height);
      const dark = isDarkRef.current;
      const BASE_OPACITY = dark ? 0.35 : 0.62;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Motion is frame-based, not multiplied by elapsed wall-clock time.
        // Restarting the particle array on resume prevents stale positions being reused.
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        const lifeRatio = p.life / p.maxLife;
        if (lifeRatio < 0.15) {
          p.opacity = lifeRatio / 0.15;
        } else if (lifeRatio > 0.85) {
          p.opacity = (1 - lifeRatio) / 0.15;
        } else {
          p.opacity = 1;
        }

        const alpha = p.opacity * BASE_OPACITY;
        const coreR = p.isMint ? 74 : 99;
        const coreG = p.isMint ? 222 : 102;
        const coreB = p.isMint ? 128 : 241;

        const haloAlpha = alpha * 0.22;
        const haloR = p.isMint ? 5 : 59;
        const haloG = p.isMint ? 217 : 130;
        const haloB = p.isMint ? 164 : 246;
        const haloRadius = p.radius * 4.5;

        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          haloRadius
        );
        gradient.addColorStop(
          0,
          `rgba(${haloR},${haloG},${haloB},${haloAlpha})`
        );
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${coreR},${coreG},${coreB},${alpha})`;
        ctx.arc(p.x, p.y, Math.max(0.3, p.radius), 0, Math.PI * 2);
        ctx.fill();

        if (
          p.life >= p.maxLife ||
          p.x < -8 ||
          p.x > width + 8 ||
          p.y < -8 ||
          p.y > height + 8
        ) {
          particles[i] = createParticle(false);
        }
      }

      if (isRunning && !document.hidden) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    const startLoop = () => {
      if (document.hidden || isRunning || width <= 0 || height <= 0) return;
      isRunning = true;
      animationRef.current = requestAnimationFrame(animate);
    };

    const restartSystem = () => {
      stopLoop();
      cancelPendingStart();

      const initializeAfterResume = () => {
        pendingStartFrame = 0;
        if (document.hidden) return;

        const result = syncCanvasSize();
        if (result === 'unavailable') {
          // Retry after the WebView has had time to restore its layout.
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!document.hidden) {
              pendingStartFrame = requestAnimationFrame(initializeAfterResume);
            }
          }, 50);
          return;
        }

        resetParticles();
        ctx.clearRect(0, 0, width, height);
        startLoop();
      };

      // Measure on the next frame, after the visible layout has had a chance to recover.
      pendingStartFrame = requestAnimationFrame(initializeAfterResume);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
        cancelPendingStart();
      } else {
        restartSystem();
      }
    };

    const handleResize = () => {
      if (document.hidden) return;

      const result = syncCanvasSize();
      if (result === 'unavailable') {
        stopLoop();
        return;
      }

      if (result === 'changed') {
        resetParticles();
        ctx.clearRect(0, 0, width, height);
      }

      startLoop();
    };

    const parent = canvas.parentElement;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && parent
        ? new ResizeObserver(handleResize)
        : null;

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (parent) resizeObserver?.observe(parent);

    // Initialize safely even if the first layout measurement is temporarily zero.
    const initialSize = syncCanvasSize();
    if (initialSize === 'unavailable') {
      restartSystem();
    } else {
      resetParticles();
      startLoop();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver?.disconnect();
      stopLoop();
      cancelPendingStart();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full pointer-events-none gpu ${
        isDark ? 'particle-dark' : 'particle-light'
      }`}
    />
  );
}
