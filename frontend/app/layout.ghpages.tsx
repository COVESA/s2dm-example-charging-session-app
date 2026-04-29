import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Data Model Explorer — LeafyCharge",
  description: "From conceptual S2DM model to application and database: the story behind this EV charging demo."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
        <style>{`[data-route="data-model"] { height: 100vh !important; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
