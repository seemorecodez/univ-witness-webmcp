import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://univ-witness-proof.seemoreas0-0.chatgpt.site'),
  title: 'UNIV Deploy — A proof-carrying release portability gate',
  description:
    'Let a browser agent compile one approved WASI release, execute two governed runtimes, and return a durable, re-verifiable proof link.',
  openGraph: {
    title: 'UNIV Deploy',
    description: 'Approve one release. Prove it behaved the same everywhere.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'UNIV Deploy intent-to-capsules-to-runtime-witness flow',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNIV Deploy',
    description: 'Approve one release. Prove it behaved the same everywhere.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
