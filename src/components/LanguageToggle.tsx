"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

interface LanguageToggleProps {
  currentLocale: Locale;
  className?: string;
}

export const LanguageToggle = ({ currentLocale, className }: LanguageToggleProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    // Replace the locale in the pathname
    const segments = pathname.split('/');
    
    // If current path starts with a locale, replace it
    if (segments[1] === 'es' || segments[1] === 'en') {
      segments[1] = newLocale;
    } else {
      // Otherwise, prepend the new locale
      segments.splice(1, 0, newLocale);
    }

    const newPath = segments.join('/') || '/';
    router.push(newPath);
  };

  return (
    <div className={cn("flex items-center gap-1 bg-stone-100 rounded-full p-1", className)}>
      <button
        onClick={() => handleLocaleChange('es')}
        className={cn(
          "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
          currentLocale === 'es'
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-500 hover:text-stone-700"
        )}
        aria-label="Cambiar a español"
      >
        ES
      </button>
      <button
        onClick={() => handleLocaleChange('en')}
        className={cn(
          "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
          currentLocale === 'en'
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-500 hover:text-stone-700"
        )}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
};

export default LanguageToggle;

