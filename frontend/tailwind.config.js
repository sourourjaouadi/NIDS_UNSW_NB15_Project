/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nids: {
          bg: "#0D1117",
          panel: "#111827",
          card: "#101A29",
          border: "#223046",
          accent: "#0FC3FF",
          accentSoft: "#153347",
          muted: "#94A3B8",
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#F43F5E"
        }
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        body: ["Inter", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(15,195,255,0.16), 0 20px 60px rgba(15,195,255,0.12)",
        soft: "0 18px 45px rgba(0, 0, 0, 0.28)"
      },
      backgroundImage: {
        "cyber-grid":
          "linear-gradient(rgba(15,195,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,195,255,0.08) 1px, transparent 1px)"
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(18px,-24px,0)" }
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.08)" }
        },
        sheen: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" }
        }
      },
      animation: {
        drift: "drift 10s ease-in-out infinite",
        "pulse-glow": "pulseGlow 6s ease-in-out infinite",
        sheen: "sheen 2.8s linear infinite"
      }
    }
  },
  plugins: []
};
