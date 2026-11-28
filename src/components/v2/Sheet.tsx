import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

/** Bottom sheet on phones (drag down to close), side panel on desktop. */
export function Sheet({ open, onClose, title, eyebrow, children, wide }: {
  open: boolean; onClose: () => void; title?: ReactNode; eyebrow?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  const desktop = useIsDesktop();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="s3-sheet-root">
          <motion.div className="s3-sheet-backdrop" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div
            role="dialog" aria-modal="true"
            className={`s3-sheet ${desktop ? 's3-sheet-side' : 's3-sheet-bottom'} ${wide ? 's3-sheet-wide' : ''}`}
            initial={desktop ? { x: '100%' } : { y: '100%' }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: '100%' } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag={desktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
          >
            {!desktop && <div className="s3-grabber" />}
            <header className="s3-sheet-head">
              <div className="min-w-0">
                {eyebrow && <div className="s3-eyebrow">{eyebrow}</div>}
                {title && <h2 className="s3-sheet-title">{title}</h2>}
              </div>
              <button type="button" className="s3-icon-btn" onClick={onClose} aria-label="Tutup"><X className="w-4 h-4" /></button>
            </header>
            <div className="s3-sheet-body" onPointerDown={(e) => e.stopPropagation()}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
