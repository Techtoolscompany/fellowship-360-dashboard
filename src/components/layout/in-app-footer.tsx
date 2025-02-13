import { ThemeSwitcher } from "../theme-switcher";
import { appConfig } from "@/lib/config";

export function InAppFooter() {
  return (
    <footer className="border-t border-border/40 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-14 items-center justify-between px-4">
        <nav className="flex items-center space-x-4 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appConfig.projectName}
        </nav>
        <div className="flex items-center space-x-4">
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
