"use client";

import * as React from "react";

export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (stored === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setDark(isDark);
  }, []);

  function toggle() {
    const html = document.documentElement;
    const next = !dark;

    html.classList.add("theme-transitioning");
    window.setTimeout(() => html.classList.remove("theme-transitioning"), 220);

    if (next) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activează tema luminoasă" : "Activează tema întunecată"}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
      style={{ opacity: dark === null ? 0 : 1, pointerEvents: dark === null ? "none" : "auto" }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
