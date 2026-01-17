import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Icon Studio",
  description: "Create and export beautiful icons with instant preview",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
