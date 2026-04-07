import "leaflet/dist/leaflet.css";

export default function SessionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-route="sessions" className="h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
