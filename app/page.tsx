import { Credits } from "@/components/instrument/credits"
import { Instrument } from "@/components/instrument/instrument"
import styles from "@/components/instrument/instrument.module.css"
import { SITE } from "@/lib/site"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a browser with Web Audio",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: [
    { "@type": "Person", name: "nays" },
    { "@type": "Organization", name: "Paisanos" },
  ],
}

export default function Home() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 className="sr-only">ui-chords, a pocket chord instrument for the web</h1>
      <Instrument />
      <p className={styles.rotateHint}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
          <path d="M10.5 18h3" strokeLinecap="round" />
        </svg>
        Turn your phone sideways to play
      </p>
      <Credits />
    </main>
  )
}
