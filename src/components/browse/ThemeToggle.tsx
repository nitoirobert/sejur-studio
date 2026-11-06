"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { setTheme, useTheme } from "@/lib/theme";
import { iconButton } from "@/components/ui/soft";

// Butonul soare / lună. Iconița se rotește la schimbare.
export function ThemeToggle() {
  const t = useTranslations("Header");
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t("lightMode") : t("darkMode")}
      title={dark ? t("lightMode") : t("darkMode")}
      className={`${iconButton} size-12 overflow-hidden`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          {dark ? <Moon className="size-5 text-accent" /> : <Sun className="size-5 text-star" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
