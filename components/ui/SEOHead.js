import Head from 'next/head';
import { SITE_NAME } from '../../utils/seo';

export default function SEOHead({ title, description, path = '', noIndex = true, extraMeta = [] }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const desc = description || `${SITE_NAME} — Hospital Management System`;
  const canonical = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://medicare-erp.com'}${path}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      {!noIndex && <meta name="robots" content="index,follow" />}
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* Extra meta */}
      {extraMeta.map((m, i) => <meta key={i} {...m} />)}
    </Head>
  );
}