import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ImageLightbox } from "@/components/ui/image-lightbox";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "E-Qarza — Quick Loans for Pakistan",
  description: "Fast, secure mobile loans for the Pakistani market. Apply in minutes, get approved fast, withdraw via JazzCash, EasyPaisa, or Bank.",
  keywords: ["E-Qarza", "Qarza", "loan", "Pakistan", "JazzCash", "EasyPaisa", "quick loan"],
  authors: [{ name: "E-Qarza Securities" }],
  icons: {
    icon: "/e-qarza-logo.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        {/*Start of Tawk.to Script*/}
        <script
          async
          src="https://embed.tawk.to/6a37106caf26101d489dc77b/1jrjhgarp"
          charSet="UTF-8"
        />
        {/*End of Tawk.to Script*/}
        <Toaster />
        <SonnerToaster />
        <ImageLightbox />
      </body>
    </html>
  );
}
