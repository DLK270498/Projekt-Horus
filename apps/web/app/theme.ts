// Shared light/dark class-string tokens, applied via Tailwind's `dark:`
// variant (see tailwind.config.ts's darkMode: "class"). Dark mode keeps
// the site's original look byte-for-byte; every token's unprefixed half
// is the new light-mode color, picked for contrast on a light background
// rather than just inverting the dark palette (e.g. accent text needs a
// darker shade in light mode to stay readable on white/slate-50).
export const PAGE_BG = "bg-slate-50 dark:bg-slate-950";
export const TEXT_PRIMARY = "text-slate-900 dark:text-slate-100";

// Secondary/muted ("shadow") text - one shared size AND one shared color
// pair, used throughout cards, filters and the footer.
export const MUTED_TEXT_CLASS = "text-xs text-slate-500 dark:text-slate-400";

export const CARD_BG = "bg-white dark:bg-slate-900/50";
export const CARD_BORDER = "border-slate-200 dark:border-slate-800";
export const CARD_BORDER_HOVER = "hover:border-slate-300 dark:hover:border-slate-700";

export const PILL_BG_TEXT = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

export const HEADER_FOOTER_BORDER = "border-slate-200 dark:border-slate-800";
export const STICKY_BAR_BG = "bg-white/90 dark:bg-slate-950/90";
export const SCROLL_FADE_BG = "from-white dark:from-slate-950";

export const LINK_TEXT = "text-sky-600 dark:text-sky-400";
export const PRICE_TEXT = "text-emerald-600 dark:text-emerald-400";
export const STAR_TEXT = "text-amber-500 dark:text-amber-400";

export const FIELD_BG_BORDER = "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900";

// Every small rounded "pill" on a deal card (date range, nights, stops,
// discount, community-deal) shares this exact size/padding.
export const PILL_CLASS = "rounded-full px-2.5 py-1 text-xs font-medium";
