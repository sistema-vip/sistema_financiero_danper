import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DANPER Finance - Princess Travel",
  description: "Sistema Financiero Profesional",
};

// Layout raíz mínimo — solo define html/body y CSS global.
// Cada route group tiene su propio layout que inyecta el Sidebar (o no).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-[#0f172a] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}