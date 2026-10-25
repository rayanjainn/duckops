"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Fades and lifts its children in once they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  from = "up",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  from?: "up" | "left" | "right" | "zoom";
  className?: string;
}) {
  const still = useReducedMotion();
  const start = {
    up: { opacity: 0, y: 28, filter: "blur(6px)" },
    left: { opacity: 0, x: -36, filter: "blur(6px)" },
    right: { opacity: 0, x: 36, filter: "blur(6px)" },
    zoom: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
  }[from];
  return (
    <motion.div
      className={className}
      initial={still ? false : start}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
