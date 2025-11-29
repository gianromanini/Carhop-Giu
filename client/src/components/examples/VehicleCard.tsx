import { VehicleCard, type Vehicle } from "../VehicleCard";
import { ThemeProvider } from "../ThemeProvider";
import corollaImage from "@assets/generated_images/toyota_corolla_side_view.png";

const mockVehicle: Vehicle = {
  id: "1",
  name: "Toyota Corolla",
  category: "Economy",
  image: corollaImage,
  pricePerDay: 35,
  payNowPrice: 29,
  mpg: 32,
  passengers: 5,
  transmission: "Automatic",
  luggage: 2,
  fuelEfficient: true,
};

export default function VehicleCardExample() {
  return (
    <ThemeProvider>
      <div className="p-6 max-w-sm bg-background">
        <VehicleCard
          vehicle={mockVehicle}
          onSelect={(v) => console.log("Selected:", v.name)}
          onViewDetails={(v) => console.log("View details:", v.name)}
        />
      </div>
    </ThemeProvider>
  );
}
