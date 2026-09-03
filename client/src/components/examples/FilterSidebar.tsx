import { useState } from "react";
import { FilterSidebar, type Filters } from "../FilterSidebar";
import { ThemeProvider } from "../ThemeProvider";

export default function FilterSidebarExample() {
  const [filters, setFilters] = useState<Filters>({
    priceRange: [15, 100],
    fuelSaverOnly: false,
    transmission: [],
    drivetrain: [],
    passengers: null,
    sortBy: "price-low",
  });

  return (
    <ThemeProvider>
      <div className="p-6 max-w-xs bg-background">
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          vehicleCount={12}
        />
      </div>
    </ThemeProvider>
  );
}
