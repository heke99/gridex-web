import type { Metadata } from "next";
import "./style.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Gridex Support", template: "%s · Gridex Support" },
  description: "Gridex kundtjänst",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
