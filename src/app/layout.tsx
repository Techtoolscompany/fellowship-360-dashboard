import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { appConfig } from "@/lib/config";
import Providers from "./Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    template: `%s | ${appConfig.projectName}`,
    absolute: appConfig.projectName,
  },
  description: appConfig.description,
  keywords: appConfig.keywords,
  openGraph: {
    title: appConfig.projectName,
    description: appConfig.description,
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: appConfig.projectName,
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/logo.png" sizes="any" />
        <link rel="apple-touch-icon" href="/assets/logo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Material Symbols powers existing icon tokens across the app. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased bg-background`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
