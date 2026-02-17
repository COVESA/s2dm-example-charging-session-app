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
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
