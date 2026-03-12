import type { Metadata } from "next";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellenberechnung | CREDO Verwaltung",
  description: "Stellenistberechnung fuer die Freien Evangelischen Schulen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </body>
    </html>
  );
}
