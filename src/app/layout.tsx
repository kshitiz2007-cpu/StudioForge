import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudioForge — Visual Development IDE",
  description: "A source-aware visual development environment for real web projects.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
