import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horus – Business Class Deals",
  description: "Business Class Flugdeals ex Deutschland",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
