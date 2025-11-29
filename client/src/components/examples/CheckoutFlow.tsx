import { CheckoutFlow } from "../CheckoutFlow";
import { ThemeProvider } from "../ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import corollaImage from "@assets/generated_images/toyota_corolla_side_view.png";
import { addDays } from "date-fns";

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

export default function CheckoutFlowExample() {
  return (
    <ThemeProvider>
      <div className="p-6 bg-background min-h-screen">
        <CheckoutFlow
          vehicle={mockVehicle}
          pickupDate={new Date()}
          returnDate={addDays(new Date(), 3)}
          location="Los Angeles Airport (LAX)"
          onBack={() => console.log("Back clicked")}
          onComplete={() => console.log("Booking complete!")}
        />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
