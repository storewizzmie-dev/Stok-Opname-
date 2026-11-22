import React, { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { motion, HTMLMotionProps } from 'motion/react';

gsap.registerPlugin(ScrollTrigger);

/**
 * 1. LENIS SMOOTH SCROLL + GSAP SCROLLTRIGGER SYNC PROVIDER
 * Mengintegrasikan Lenis smooth scroll dengan GSAP ticker & ScrollTrigger.
 */
export function LenisGsapProvider({
  activeKey,
  children,
}: {
  activeKey?: string;
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeKey]);

  return <>{children}</>;
}

/**
 * 2. GSAP + SCROLLTRIGGER PER-WORD HEADING REVEAL
 * Memecah teks judul menjadi per kata dan menganimasikannya saat di-scroll dengan GSAP + ScrollTrigger.
 */
export function GsapWordTitle({
  text,
  className = '',
  stagger = 0.045,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const wordNodes = el.querySelectorAll('.gsap-split-word');
      if (!wordNodes.length) return;

      gsap.fromTo(
        wordNodes,
        {
          yPercent: 95,
          opacity: 0,
          rotateX: -20,
        },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.62,
          stagger,
          ease: 'power3.out',
           overwrite: 'auto',
          scrollTrigger: {
            trigger: el,
            start: 'top 93%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, el);

    return () => {
      ctx.revert();
    };
  }, [text, stagger]);

  return (
    <span
      ref={containerRef}
      className={`inline-flex flex-wrap items-baseline gap-x-[0.28em] ${className}`}
    >
      {words.map((word, idx) => (
        <span
          key={`${word}-${idx}`}
          className="inline-block overflow-hidden py-0.5 -my-0.5"
        >
          <span className="gsap-split-word inline-block will-change-transform">
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * 3. MOTION CARD & SECTION (Animasi masuk card saat scroll & efek hover interaktif)
 */
interface MotionSectionProps extends HTMLMotionProps<'section'> {
  delay?: number;
  hoverLift?: boolean;
  children: React.ReactNode;
}

export function MotionSection({
  delay = 0,
  hoverLift = true,
  children,
  className = '',
  ...rest
}: MotionSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{
        type: 'spring',
        stiffness: 240,
        damping: 24,
        delay,
      }}
      whileHover={
        hoverLift
          ? {
              y: -3,
              transition: { type: 'spring', stiffness: 360, damping: 22 },
            }
          : undefined
      }
      className={className}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

interface MotionCardProps extends HTMLMotionProps<'div'> {
  delay?: number;
  hoverLift?: boolean;
  children: React.ReactNode;
}

export function MotionCard({
  delay = 0,
  hoverLift = true,
  children,
  className = '',
  ...rest
}: MotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 23,
        delay,
      }}
      whileHover={
        hoverLift
          ? {
              y: -4,
              scale: 1.008,
              transition: { type: 'spring', stiffness: 380, damping: 20 },
            }
          : undefined
      }
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface MotionCardButtonProps extends HTMLMotionProps<'button'> {
  delay?: number;
  children: React.ReactNode;
}

export function MotionCardButton({
  delay = 0,
  children,
  className = '',
  ...rest
}: MotionCardButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        type: 'spring',
        stiffness: 270,
        damping: 22,
        delay,
      }}
      whileHover={{
        y: -5,
        scale: 1.012,
        transition: { type: 'spring', stiffness: 400, damping: 18 },
      }}
      whileTap={{ scale: 0.985 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
