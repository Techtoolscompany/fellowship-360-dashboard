import "../assets/scss/theme.scss";
import 'react-circular-progressbar/dist/styles.css';
import "react-perfect-scrollbar/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "react-datetime/css/react-datetime.css";
import NavigationProvider from "@/contentApi/navigationProvider";
import SettingSideBarProvider from "@/contentApi/settingSideBarProvider";
import ThemeCustomizer from "@/components/shared/ThemeCustomizer";
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta-sans',
});

export const metadata = {
  title: "Finance Dashboard",
  description: "Cash Flow Dashboard - Track Your Inflows and Outflows",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body style={{ fontFamily: 'var(--font-plus-jakarta-sans), sans-serif' }}>
        <SettingSideBarProvider>
          <NavigationProvider>
            {children}
          </NavigationProvider>
        </SettingSideBarProvider>
        <ThemeCustomizer />
      </body>
    </html>
  );
}
