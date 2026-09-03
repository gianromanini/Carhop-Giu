import { useState } from "react";
import { Leaf, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface Filters {
  priceRange: [number, number];
  fuelSaverOnly: boolean;
  transmission: string[];
  drivetrain: string[];
  passengers: number | null;
  sortBy: string;
}

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  vehicleCount?: number;
}

function FilterContent({ filters, onFiltersChange }: Omit<FilterSidebarProps, "vehicleCount">) {
  const handleTransmissionChange = (value: string, checked: boolean) => {
    const newTransmission = checked
      ? [...filters.transmission, value]
      : filters.transmission.filter((t) => t !== value);
    onFiltersChange({ ...filters, transmission: newTransmission });
  };

  const handleDrivetrainChange = (value: string, checked: boolean) => {
    const newDrivetrain = checked
      ? [...filters.drivetrain, value]
      : filters.drivetrain.filter((d) => d !== value);
    onFiltersChange({ ...filters, drivetrain: newDrivetrain });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Price Range (per day)</Label>
        <Slider
          value={filters.priceRange}
          onValueChange={(value) => onFiltersChange({ ...filters, priceRange: value as [number, number] })}
          min={15}
          max={100}
          step={5}
          data-testid="slider-price-range"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>${filters.priceRange[0]}</span>
          <span>${filters.priceRange[1]}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fuel-saver-only" className="flex items-center gap-2 cursor-pointer">
            <Leaf className="h-4 w-4 text-green-600" />
            Fuel-efficient only
          </Label>
          <Switch
            id="fuel-saver-only"
            checked={filters.fuelSaverOnly}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, fuelSaverOnly: checked })}
            data-testid="switch-fuel-saver-only"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Transmission</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="automatic"
              checked={filters.transmission.includes("Automatic")}
              onCheckedChange={(checked) => handleTransmissionChange("Automatic", !!checked)}
              data-testid="checkbox-automatic"
            />
            <Label htmlFor="automatic" className="font-normal cursor-pointer">
              Automatic
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="manual"
              checked={filters.transmission.includes("Manual")}
              onCheckedChange={(checked) => handleTransmissionChange("Manual", !!checked)}
              data-testid="checkbox-manual"
            />
            <Label htmlFor="manual" className="font-normal cursor-pointer">
              Manual
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Drivetrain</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fwd"
              checked={filters.drivetrain.includes("FWD")}
              onCheckedChange={(checked) => handleDrivetrainChange("FWD", !!checked)}
              data-testid="checkbox-fwd"
            />
            <Label htmlFor="fwd" className="font-normal cursor-pointer">
              FWD (Front-Wheel Drive)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="rwd"
              checked={filters.drivetrain.includes("RWD")}
              onCheckedChange={(checked) => handleDrivetrainChange("RWD", !!checked)}
              data-testid="checkbox-rwd"
            />
            <Label htmlFor="rwd" className="font-normal cursor-pointer">
              RWD (Rear-Wheel Drive)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="awd"
              checked={filters.drivetrain.includes("AWD")}
              onCheckedChange={(checked) => handleDrivetrainChange("AWD", !!checked)}
              data-testid="checkbox-awd"
            />
            <Label htmlFor="awd" className="font-normal cursor-pointer">
              AWD (All-Wheel Drive)
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Passengers</Label>
        <Select
          value={filters.passengers?.toString() || "any"}
          onValueChange={(value) => 
            onFiltersChange({ ...filters, passengers: value === "any" ? null : parseInt(value) })
          }
        >
          <SelectTrigger data-testid="select-passengers">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="2">2+ passengers</SelectItem>
            <SelectItem value="4">4+ passengers</SelectItem>
            <SelectItem value="5">5+ passengers</SelectItem>
            <SelectItem value="7">7+ passengers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Sort By</Label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}
        >
          <SelectTrigger data-testid="select-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="mpg">Best MPG</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() =>
          onFiltersChange({
            priceRange: [15, 100],
            fuelSaverOnly: false,
            transmission: [],
            drivetrain: [],
            passengers: null,
            sortBy: "price-low",
          })
        }
        data-testid="button-clear-filters"
      >
        <X className="h-4 w-4 mr-2" />
        Clear Filters
      </Button>
    </div>
  );
}

export function FilterSidebar({ filters, onFiltersChange, vehicleCount }: FilterSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="hidden lg:block sticky top-24">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterContent filters={filters} onFiltersChange={onFiltersChange} />
        </CardContent>
      </Card>

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="w-full" size="lg" data-testid="button-open-filters">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {vehicleCount !== undefined && (
                <span className="ml-2 text-primary-foreground/80">
                  ({vehicleCount} cars)
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6 pb-20 overflow-y-auto">
              <FilterContent filters={filters} onFiltersChange={onFiltersChange} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
              <Button className="w-full" onClick={() => setOpen(false)} data-testid="button-show-results">
                Show {vehicleCount} Cars
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
