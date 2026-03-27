import { LockKeyhole, Rocket, ScanLine } from "lucide-react";
import { motion } from "framer-motion";

import SectionReveal from "./SectionReveal";

const cards = [
  {
    icon: ScanLine,
    title: "Built for clarity",
    body: "Track portfolios, signals, and price context without dashboard sprawl or spreadsheet-style overload.",
  },
  {
    icon: LockKeyhole,
    title: "Secure account flows",
    body: "Telegram-backed OTP and protected account handling keep access flows practical and investor-friendly.",
  },
  {
    icon: Rocket,
    title: "Research at speed",
    body: "Open a symbol and move straight into charts, sentiment, earnings snapshots, and AI commentary.",
  },
];

export default function ValuePropCards() {
  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 py-14 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-3">
        {cards.map(({ icon: Icon, title, body }) => (
          <motion.article
            key={title}
            whileHover={{ rotateX: 5, rotateY: -6, y: -6 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            style={{ transformStyle: "preserve-3d", perspective: 1400 }}
            className="rounded-[1.8rem] border border-white/5 bg-surface p-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
              <Icon size={18} />
            </div>
            <h3 className="mt-5 font-display text-3xl text-text">{title}</h3>
            <p className="mt-4 text-sm leading-7 text-muted">{body}</p>
          </motion.article>
        ))}
      </div>
    </SectionReveal>
  );
}
