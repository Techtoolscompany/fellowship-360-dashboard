'use client'
import { usePathname } from "next/navigation";
import Header from "@/components/shared/header/Header";
import NavigationManu from "@/components/shared/navigationMenu/NavigationMenu";
import SupportDetails from "@/components/supportDetails";
import useBootstrapUtils from "@/hooks/useBootstrapUtils";
import { ToastProvider } from "@/components/shared/Toast";
import CommandPalette from "@/components/shared/CommandPalette";
import { useOnboardingTour } from "@/components/shared/OnboardingTour";

const layout = ({ children }) => {
    const pathName = usePathname()
    useBootstrapUtils(pathName)
    const { TourComponent } = useOnboardingTour()

    return (
        <ToastProvider>
            <Header />
            <NavigationManu />
            <main className="nxl-container">
                <div className="nxl-content">
                    {children}
                </div>
            </main>
            <SupportDetails />
            <CommandPalette />
            {TourComponent && <TourComponent />}
        </ToastProvider>
    )
}

export default layout