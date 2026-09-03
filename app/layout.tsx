import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://univ-witness-proof.seemoreas0-0.chatgpt.site'),
  title: 'UNIV Deploy — Proof-carrying WebMCP deployment',
  description: 'Compile one WASI deployment intent into verified target capsules, execute browser and edge runtimes, and return a bounded portability witness.',
  openGraph: {
    title: 'UNIV Deploy',
    description: 'Compile deployment. Prove what ran.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'UNIV Deploy intent-to-capsules-to-runtime-witness flow' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNIV Deploy',
    description: 'Compile deployment. Prove what ran.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
