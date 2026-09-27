import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Website Cloning Agent",
  description: "Analyze a website and regenerate its frontend.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
