import "leaflet/dist/leaflet.css";

export default function MapLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-[calc(100vh-4rem)] w-full"
      data-route="map"
    >
      {children}
    </div>
  );
}
