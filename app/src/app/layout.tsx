import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../providers/providers";

export const metadata: Metadata = {
  title: "Arvo Protocol Dashboard",
  description: "Vault dashboard for agent-driven trading across chains.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
