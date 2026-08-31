import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://univ-witness-proof.seemoreas0-0.chatgpt.site'),
  title: 'UNIV Deploy — Universal WebMCP WASI deployment',
  description: 'Deploy one manifest-bound WASI workload across browser and edge targets, compare portability, and inspect controlled handoff receipts.',
  openGraph: {
    title: 'UNIV Deploy',
    description: 'One manifest. Two real runtimes. One controlled handoff.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'UNIV Deploy manifest-to-browser-and-edge deployment flow' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNIV Deploy',
    description: 'One manifest. Two real runtimes. One controlled handoff.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
