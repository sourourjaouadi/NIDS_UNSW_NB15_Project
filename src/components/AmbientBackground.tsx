import { motion } from "framer-motion";

const particles = [
  { size: 220, x: "6%", y: "12%", delay: 0 },
  { size: 160, x: "78%", y: "18%", delay: 0.8 },
  { size: 260, x: "62%", y: "64%", delay: 1.2 },
  { size: 120, x: "20%", y: "76%", delay: 0.4 },
  { size: 90, x: "88%", y: "52%", delay: 1.5 }
];

export const AmbientBackground = () => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,195,255,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,#0D1117_0%,#0B1320_100%)]" />
    <div className="absolute inset-0 bg-cyber-grid bg-[length:60px_60px] opacity-[0.08]" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(13,17,23,0.45)_24%,rgba(13,17,23,0.92)_100%)]" />
    {particles.map((particle, index) => (
      <motion.div
        key={index}
        className="absolute rounded-full bg-[radial-gradient(circle,rgba(15,195,255,0.20),rgba(15,195,255,0.03),transparent_70%)] blur-2xl"
        style={{
          width: particle.size,
          height: particle.size,
          left: particle.x,
          top: particle.y
        }}
        animate={{
          y: [0, -28, 0],
          x: [0, 20, 0],
          scale: [1, 1.06, 1]
        }}
        transition={{
          duration: 8 + index,
          repeat: Infinity,
          ease: "easeInOut",
          delay: particle.delay
        }}
      />
    ))}
  </div>
);
