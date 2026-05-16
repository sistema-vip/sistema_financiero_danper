// app/(auth)/layout.tsx — Layout limpio para login (sin Sidebar)
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
