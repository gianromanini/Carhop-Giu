import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  iconSize?: number;
}

export function ThemeToggle({ className, iconSize = 20 }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon style={{ width: iconSize, height: iconSize }} />
      ) : (
        <Sun style={{ width: iconSize, height: iconSize }} />
      )}
    </Button>
  );
}
