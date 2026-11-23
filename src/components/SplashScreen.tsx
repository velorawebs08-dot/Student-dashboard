import { motion, useReducedMotion } from 'motion/react';
import { siteData } from '../siteData';
import { BrandLogo } from './BrandLogo';

export function SplashScreen() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 select-none overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${siteData.brandColors.primary} 0%, ${siteData.brandColors.primaryDark} 100%)`,
      }}
    >
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Centered Logo with soft amber glow */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.84 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-full blur-2xl opacity-35"
            style={{ backgroundColor: siteData.brandColors.accent }}
          />
          <div className="relative rounded-3xl p-1.5 bg-white/10 ring-1 ring-white/15 shadow-2xl">
            <BrandLogo size="xl" className="rounded-2xl" />
          </div>
        </motion.div>

        {/* Brand Name + Left-to-Right Amber Underline */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0.1 : 0.25, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {siteData.tuitionName}
          </h1>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scaleX: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scaleX: 1 }}
            transition={{ delay: prefersReducedMotion ? 0.15 : 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-1 w-28 mx-auto mt-2.5 rounded-full origin-left"
            style={{ backgroundColor: siteData.brandColors.accent }}
          />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0.2 : 0.65, duration: 0.5 }}
          className="mt-3 text-sm sm:text-base text-slate-300 font-medium"
        >
          {siteData.tagline}
        </motion.p>
      </div>

      {/* Bottom Thin Amber Progress Bar (2 seconds) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0.4 } : { scaleX: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scaleX: 1 }}
          transition={{ duration: 1.95, ease: 'easeInOut' }}
          className="h-full w-full origin-left"
          style={{ backgroundColor: siteData.brandColors.accent }}
        />
      </div>
    </motion.div>
  );
}
