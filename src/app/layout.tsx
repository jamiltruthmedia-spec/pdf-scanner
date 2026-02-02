import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Scanner - Search Your Batch Sheets",
  description: "Upload, OCR, and search your production batch sheets by Job #, Formula ID, or any text.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
