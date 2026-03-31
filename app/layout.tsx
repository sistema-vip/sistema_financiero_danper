import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "DANPER Finance - Princess Travel",
  description: "Sistema Financiero Profesional",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="flex bg-[#0f172a] text-slate-200 antialiased">
        <Sidebar />
        {/* El margen de 64 (ml-64) es para que el contenido no se tape con el menú */}
        <main className="flex-1 ml-64 p-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}