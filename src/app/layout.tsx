import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Enquires CRM',
  description: 'Clean and modern CRM for managing leads',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var d = document.documentElement;
                var t = localStorage.getItem('crm-theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  d.setAttribute('data-theme', 'dark');
                  d.style.backgroundColor = '#09090b';
                } else {
                  d.setAttribute('data-theme', 'light');
                  d.style.backgroundColor = '#FFFFFF';
                }
                d.classList.add('no-transitions');
                setTimeout(function() { d.classList.remove('no-transitions'); }, 100);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors theme="system" />
      </body>
    </html>
  );
}
