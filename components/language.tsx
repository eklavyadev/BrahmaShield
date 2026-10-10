"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translate, type Language } from "@/lib/languages";
const Context = createContext({
  language: "en" as Language,
  setLanguage: (language: Language) => {
    void language;
  },
  t: (text: string) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, update] = useState<Language>("en");
  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem("bs-language");
        if (stored === "en" || stored === "as" || stored === "hi") update(stored);
      } catch {
        /* Device preference is optional. */
      }
    };
    queueMicrotask(load);
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function setLanguage(next: Language) {
    update(next);
    try {
      localStorage.setItem("bs-language", next);
    } catch {
      /* Session selection still works. */
    }
  }
  return (
    <Context.Provider value={{ language, setLanguage, t: (text) => translate(text, language) }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
export function Translated({ text }: { text: string }) {
  return useLanguage().t(text);
}
