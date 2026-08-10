import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import CustomCursor from "@/components/CustomCursor";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MergePay | GitHub-Triggered Payments",
  description: "A Github-Merge-Triggered Payment Agent",
  icons: {
    icon: "/mergepay.png",
    shortcut: "/mergepay.png",
    apple: "/mergepay.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
    >
      <body className="min-h-screen flex flex-col selection:bg-neon selection:text-background relative">
        <Providers>
          <CustomCursor />
          <Navbar />
          <main className="flex-grow z-10 relative">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
