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

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const createParticle = (randomLife = false): Particle => {
      const maxLife = 420 + Math.random() * 380;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.11,
        vy: (Math.random() - 0.5) * 0.11 - 0.035,
        // Mix: ~55% tiny sharp dots, ~45% slightly larger for depth
        radius: Math.random() < 0.55 ? 0.35 + Math.random() * 0.45 : 0.6 + Math.random() * 0.85,
        opacity: 0,
        isMint: Math.random() < 0.52,
        life: randomLife ? Math.random() * maxLife : 0,
        maxLife,
      };
    };

    // 2.5x the previous count of 85 → 213
    const PARTICLE_COUNT = 213;
    particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(true));

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const dark = isDarkRef.current;

      // Dark: 35% peak opacity — vivid star-like glow without being heavy
      // Light: 62% for saturated watercolour on white (multiply blend darkens it naturally)
      const BASE_OPACITY = dark ? 0.35 : 0.62;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Smooth fade-in (first 15%) and fade-out (last 15%)
        const lr = p.life / p.maxLife;
        if (lr < 0.15) {
          p.opacity = lr / 0.15;
        } else if (lr > 0.85) {
          p.opacity = (1 - lr) / 0.15;
        } else {
          p.opacity = 1;
        }

        const alpha = p.opacity * BASE_OPACITY;

        // Core colours: mint green vs electric indigo
        const coreR = p.isMint ? 74  : 99;
        const coreG = p.isMint ? 222 : 102;
        const coreB = p.isMint ? 128 : 241;

        // Subtle glow halo (very soft, 22% of core alpha)
        const haloAlpha = alpha * 0.22;
        const haloR = p.isMint ? 5  : 59;
        const haloG = p.isMint ? 217 : 130;
        const haloB = p.isMint ? 164 : 246;
        const haloRadius = p.radius * 4.5;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloRadius);
        grad.addColorStop(0, `rgba(${haloR},${haloG},${haloB},${haloAlpha})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Sharp crisp core dot
        ctx.beginPath();
        ctx.fillStyle = `rgba(${coreR},${coreG},${coreB},${alpha})`;
        ctx.arc(p.x, p.y, Math.max(0.3, p.radius), 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife || p.x < -8 || p.x > width + 8 || p.y < -8 || p.y > height + 8) {
          particles[i] = createParticle(false);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
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
