import "../assets/scss/theme.scss";
import 'react-circular-progressbar/dist/styles.css';
import "react-perfect-scrollbar/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "react-datetime/css/react-datetime.css";
import NavigationProvider from "@/contentApi/navigationProvider";
import SettingSideBarProvider from "@/contentApi/settingSideBarProvider";
import ThemeCustomizer from "@/components/shared/ThemeCustomizer";

export const metadata = {
  title: "Duralux | Dashboard",
  description: "Duralux is a admin Dashboard create for multipurpose,",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
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
