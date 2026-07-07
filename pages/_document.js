import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" style={{ scrollBehavior: 'smooth' }} data-scroll-behavior="smooth">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#16a34a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Structured data for hospital */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Hospital",
          "name": "MediCare Hospital",
          "description": "Multi-Specialty Hospital & Research Center",
          "telephone": "+91-98765-43210",
          "address": { "@type": "PostalAddress", "streetAddress": "123 Health Avenue", "addressLocality": "Medical District" }
        })}} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}