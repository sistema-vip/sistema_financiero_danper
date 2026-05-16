// app/(sistema)/layout.tsx — Layout con Sidebar para todas las rutas del sistema
import Sidebar from "../../components/Sidebar";

export default function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />
      {/* ml-72 compensa el ancho fijo del Sidebar (w-72) */}
      <main className="flex-1 ml-72 p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
