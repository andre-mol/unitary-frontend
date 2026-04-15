import React from 'react';
import { motion } from 'framer-motion';

// Configuration for consistent premium feel
const transition = { duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number] }; // Smooth cubic-bezier
const viewportConfig = { once: true, margin: "-50px" };

interface MotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const FadeIn: React.FC<MotionProps> = ({ children, className = "", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={viewportConfig}
    transition={{ ...transition, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const FadeInScale: React.FC<MotionProps> = ({ children, className = "", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: 20 }}
    whileInView={{ opacity: 1, scale: 1, y: 0 }}
    viewport={viewportConfig}
    transition={{ ...transition, delay, duration: 0.6 }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerContainer: React.FC<MotionProps> = ({ children, className = "", delay = 0 }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={viewportConfig}
    variants={{
      visible: {
        transition: {
          staggerChildren: 0.1,
          delayChildren: delay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<MotionProps> = ({ children, className = "" }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: transition },
    }}
    className={className}
  >
    {children}
  </motion.div>
);