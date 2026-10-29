import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leo.casa — Your AI Home Advisor",
  description: "Tell Leo how you live — he finds the homes worth rearranging your day for. Leo learns your routine, your budget, the streets you love and the things you can't stand.",
  openGraph: {
    title: "Leo.casa — Your AI Home Advisor",
    description: "Tell Leo how you live — he finds the homes worth rearranging your day for.",
    type: "website",
    locale: "en_US",
    siteName: "Leo.casa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leo.casa — Your AI Home Advisor",
    description: "Tell Leo how you live — he finds the homes worth rearranging your day for.",
  },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>

      <body 
        className="antialiased font-sans" 
        style={{ 
          fontFamily: "'Source Sans 3', system-ui, sans-serif" 
        }}
        suppressHydrationWarning
      >
        <div id="atelier-native-app">{children}</div>
        <Script src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/native-nav/atelier-nav.js`} strategy="afterInteractive" data-project="home-matching" />
      </body>
    </html>
  );
}
