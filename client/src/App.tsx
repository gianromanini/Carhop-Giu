import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CarHopApp from "@/pages/CarHopApp";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CarHopApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
