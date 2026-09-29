import './globals.css';
import '@awc-ui/core/css/tokens.css';
import './theme.css';
import 'material-symbols/outlined.css';
import { DialogProvider } from '@/components/DialogProvider';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const display = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Quizzy',
    template: '%s · Quizzy',
  },
  description: 'Live quiz arena for teams — MCQ and coding challenges in real time.',
  applicationName: 'Quizzy',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/logo-mark.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'Quizzy',
    description: 'Live quiz arena for teams — MCQ and coding challenges in real time.',
    siteName: 'Quizzy',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
