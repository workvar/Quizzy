import './globals.css';
import { DialogProvider } from '@/components/DialogProvider';

export const metadata = {
  title: 'Quizzy',
  description: 'Cryptocurrency Knowledge Challenge',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
