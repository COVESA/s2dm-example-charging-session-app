import type { Metadata } from "next";

import { Navbar } from "@/ui/Navbar";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "LeafyCharge — EV Charging Demo",
  description: "Find, book, and manage EV charging sessions"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
