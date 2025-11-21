import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DivineTickets",
  description: "Plataforma de eventos para igrejas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
