import { useState } from "react";
import { VehicleDetailModal } from "../VehicleDetailModal";
import { ThemeProvider } from "../ThemeProvider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import corollaImage from "@assets/generated_images/toyota_corolla_side_view.png";

const mockVehicle = {
  id: "1",
  name: "Toyota Corolla",
  category: "Economy",
  image: corollaImage,
  pricePerDay: 35,
  payNowPrice: 29,
  mpg: 32,
  passengers: 5,
  transmission: "Automatic" as const,
  luggage: 2,
  fuelEfficient: true,
};

export default function VehicleDetailModalExample() {
  const [open, setOpen] = useState(true);

  return (
    <ThemeProvider>
      <div className="p-6 bg-background">
        <Button onClick={() => setOpen(true)}>View Vehicle Details</Button>
        <VehicleDetailModal
          vehicle={mockVehicle}
          open={open}
          onOpenChange={setOpen}
          onSelect={(v) => console.log("Selected:", v.name)}
        />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
