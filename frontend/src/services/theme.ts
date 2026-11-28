export type NexusPlayTheme = "light" | "dark";

const THEME_STORAGE_KEY = "nexusplay_theme";

export function getTheme(): NexusPlayTheme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function initTheme(): void {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage may be disabled; fall back to the light theme.
  }

  const theme: NexusPlayTheme = saved === "light" || saved === "dark" ? saved : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function toggleTheme(): NexusPlayTheme {
  const next: NexusPlayTheme = getTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The current tab still switches theme even when persistence is blocked.
  }

  return next;
}
