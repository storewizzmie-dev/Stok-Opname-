// @ts-nocheck -- imported legacy code written for a looser tsconfig
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

/**
 * 4. AI TYPEWRITER TEXT (Efek AI Sedang Mengetik secara Halus & Format Rapi Tanpa Tanda Bintang *)
 */
function sanitizeDisplayLine(line: string): string {
  return line
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/\*+/g, '')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function renderFormattedLineContent(content: string): React.ReactNode {
  // Highlight label before ":" or " — " if short (e.g. "Beranda: Ringkasan..." or "Kurang: -Rp 20.824.883")
  const colonIdx = content.indexOf(':');
  if (colonIdx > 1 && colonIdx <= 42) {
    const label = content.slice(0, colonIdx).trim();
    const rest = content.slice(colonIdx + 1);
    return (
      <>
        <strong className="font-bold text-slate-950 dark:text-white">
          {label}:
        </strong>
        {rest}
      </>
    );
  }
  const dashMatch = content.match(/^([^—–-]{2,38})\s+([—–-])\s+(.*)$/);
  if (dashMatch) {
    return (
      <>
        <strong className="font-bold text-slate-950 dark:text-white">
          {dashMatch[1]}
        </strong>{' '}
        {dashMatch[2]} {dashMatch[3]}
      </>
    );
  }
  return content;
}

export function AiTypewriterText({
  text,
  animate = false,
  onProgress,
  onComplete,
}: {
  text: string;
  animate?: boolean;
  onProgress?: () => void;
  onComplete?: () => void;
}) {
  const cleanText = React.useMemo(
    () =>
      text
        .replace(/\r\n/g, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .replace(/\*+/g, '')
        .trim(),
    [text]
  );

  const [visibleChars, setVisibleChars] = React.useState<number>(() =>
    animate ? 0 : cleanText.length
  );
  const [isTyping, setIsTyping] = React.useState<boolean>(() =>
    Boolean(animate && cleanText.length > 0)
  );

  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!animate || cleanText.length === 0) {
      setVisibleChars(cleanText.length);
      setIsTyping(false);
      return;
    }

    setVisibleChars(0);
    setIsTyping(true);

    // Dynamic typing speed: finishes short replies in ~1.2s and long replies in ~2.4s
    const charsPerTick = Math.max(2, Math.ceil(cleanText.length / 115));
    let current = 0;

    const intervalId = window.setInterval(() => {
      current += charsPerTick;
      // Snap cleanly to next space if within 4 characters for natural word-by-word feel
      if (current < cleanText.length) {
        const nextSpace = cleanText.indexOf(' ', current);
        if (nextSpace !== -1 && nextSpace - current <= 4) {
          current = nextSpace + 1;
        }
      }

      if (current >= cleanText.length) {
        setVisibleChars(cleanText.length);
        setIsTyping(false);
        window.clearInterval(intervalId);
        onProgressRef.current?.();
        onCompleteRef.current?.();
      } else {
        setVisibleChars(current);
        onProgressRef.current?.();
      }
    }, 18);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cleanText, animate]);

  const displayedText = isTyping
    ? cleanText.slice(0, visibleChars)
    : cleanText;
  const lines = displayedText.split('\n');

  const finishImmediately = () => {
    if (!isTyping) return;
    setVisibleChars(cleanText.length);
    setIsTyping(false);
    onProgressRef.current?.();
    onCompleteRef.current?.();
  };

  return (
    <div
      onClick={isTyping ? finishImmediately : undefined}
      title={isTyping ? 'Klik untuk menampilkan seluruh teks langsung' : undefined}
      className={`space-y-1.5 ${isTyping ? 'cursor-pointer' : ''}`}
    >
      {lines.map((rawLine, idx) => {
        const line = sanitizeDisplayLine(rawLine);
        const isLastLine = idx === lines.length - 1;
        const cursorNode =
          isTyping && isLastLine ? (
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-amber-400 animate-pulse rounded-xs"
            />
          ) : null;

        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        // Numbered heading (e.g. "1. Apa yang aplikasi ini lakukan?")
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const body = numberedMatch[2];
          return (
            <div
              key={idx}
              className="pt-1 font-bold text-slate-900 dark:text-white flex items-baseline gap-1.5"
            >
              <span className="text-amber-600 dark:text-amber-400 font-black tabular-nums shrink-0">
                {num}.
              </span>
              <span className="leading-relaxed">
                {renderFormattedLineContent(body)}
                {cursorNode}
              </span>
            </div>
          );
        }

        // Bullet item (e.g. "- Stok Opname: ..." or "• Barang Kurang...")
        const bulletMatch = line.match(/^([-•●▪‣])\s+(.*)$/);
        if (bulletMatch) {
          const body = bulletMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <span className="flex-1 leading-relaxed">
                {renderFormattedLineContent(body)}
                {cursorNode}
              </span>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {renderFormattedLineContent(line)}
            {cursorNode}
          </p>
        );
      })}
    </div>
  );
}

