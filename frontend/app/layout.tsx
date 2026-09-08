import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Food Finder",
  description: "Search packaged foods and explore nutritional information.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
