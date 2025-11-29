import { PriceMatchModal } from "../PriceMatchModal";
import { ThemeProvider } from "../ThemeProvider";
import { Toaster } from "@/components/ui/toaster";

export default function PriceMatchModalExample() {
  return (
    <ThemeProvider>
      <div className="p-6 bg-background">
        <PriceMatchModal 
          vehicleName="Toyota Corolla" 
          currentPrice={29} 
        />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
