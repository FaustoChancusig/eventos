/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // ← Habilita modo oscuro manual
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores base del sistema
        ink: "#1a1a1a",
        surface: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
        },

        // 🎨 PALETA PRINCIPAL NARANJA–AMARILLO
        primary: {
          50: "#FFF6E5",
          100: "#FFE7BF",
          200: "#FFD38A",
          300: "#FFBD52",
          400: "#FFA62A",
          500: "#FF8C00",   // 🔥 Naranja principal
          600: "#E67C00",
          700: "#CC6D00",
          800: "#A65A00",
          900: "#804600",
        },

        secondary: {
          50: "#FFFBEA",
          100: "#FFF3C4",
          200: "#FCE588",
          300: "#FADB5F",
          400: "#F7C948",
          500: "#F0B429",  // Amarillo cálido
          600: "#DE911D",
          700: "#CB6E17",
          800: "#B44D12",
          900: "#8D2B0B",
        },

        // Estados
        danger: "#E53935",
        dangerBg: "#FDECEA",
        success: "#2ECC71",
      },

      // Sombras suaves estilo mobile app
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.08)",
        soft: "0 2px 6px rgba(0,0,0,0.05)",
      },

      // Animaciones para navegación smooth
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.30s ease-out",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
