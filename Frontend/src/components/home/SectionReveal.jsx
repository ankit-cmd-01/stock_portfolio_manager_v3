import { motion } from "framer-motion";

export default function SectionReveal({ as = "section", className = "", children }) {
  const Component = motion[as] || motion.section;

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
