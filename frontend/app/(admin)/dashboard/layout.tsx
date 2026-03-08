export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-route="dashboard" className="min-h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
