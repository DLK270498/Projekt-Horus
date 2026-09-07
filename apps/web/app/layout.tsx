import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horus – Business Class Deals",
  description: "Business Class Flugdeals ex Deutschland",
};

// Runs before first paint (a plain <script>, not a React event) so a
// visitor who previously chose light mode doesn't see a flash of dark
// before it corrects itself - the <html> tag below already defaults to
// "dark" server-side so the common case (no stored preference yet) never
// flashes either way. Keep this in sync with ThemeToggle.tsx's storage
// key and toggle logic.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("horus-theme") === "light") {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased [color-scheme:light] dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]">
        {children}
      </body>
    </html>
  );
}
