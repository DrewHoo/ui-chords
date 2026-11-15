import type { Metadata, Viewport } from "next"
import { Doto } from "next/font/google"
import { SITE } from "@/lib/site"
import "./globals.css"

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["700", "800"],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.name,
  description: SITE.description,
  applicationName: SITE.name,
  authors: SITE.authors.map((name) => ({ name })),
  creator: SITE.authors[0],
  publisher: SITE.authors[1],
  keywords: [
    "ui-chords",
    "chord synthesizer",
    "web synth",
    "pocket synth",
    "HiChord",
    "ui-sdk",
    "looper",
    "drum machine",
    "music",
  ],
  category: "music",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  appleWebApp: { title: SITE.name, capable: true, statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f7",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${doto.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
