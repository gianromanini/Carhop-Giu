import { Users, Settings, Briefcase, Leaf, Fuel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export interface Vehicle {
  id: string;
  name: string;
  category: string;
  image: string;
  pricePerDay: number;
  payNowPrice: number;
  mpg: number;
  passengers: number;
  transmission: "Automatic" | "Manual";
  luggage: number;
  fuelEfficient: boolean;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect?: (vehicle: Vehicle) => void;
  onViewDetails?: (vehicle: Vehicle) => void;
}

export function VehicleCard({ vehicle, onSelect, onViewDetails }: VehicleCardProps) {
  const savings = vehicle.pricePerDay - vehicle.payNowPrice;
  const savingsPercent = Math.round((savings / vehicle.pricePerDay) * 100);

  return (
    <Card className="overflow-visible hover-elevate group">
      <div className="relative aspect-video overflow-hidden rounded-t-md">
        <img
          src={vehicle.image}
          alt={`${vehicle.name} - ${vehicle.category}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          data-testid={`img-vehicle-${vehicle.id}`}
        />
        {vehicle.fuelEfficient && (
          <Badge 
            className="absolute top-3 left-3 bg-green-600 text-white border-green-700"
            data-testid={`badge-fuel-saver-${vehicle.id}`}
          >
            <Leaf className="h-3 w-3 mr-1" />
            Fuel Saver
          </Badge>
        )}
        {savings > 0 && (
          <Badge 
            className="absolute top-3 right-3 bg-primary text-primary-foreground"
            data-testid={`badge-savings-${vehicle.id}`}
          >
            Save {savingsPercent}%
          </Badge>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-lg" data-testid={`text-vehicle-name-${vehicle.id}`}>
              {vehicle.name}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {vehicle.category}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Fuel className="h-4 w-4" />
            <span data-testid={`text-mpg-${vehicle.id}`}>{vehicle.mpg} MPG</span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 py-2 border-y">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{vehicle.passengers}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            <span className="truncate">{vehicle.transmission === "Automatic" ? "Auto" : "Manual"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>{vehicle.luggage} bags</span>
          </div>
        </div>
        
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground line-through">
              ${vehicle.pricePerDay}/day
            </div>
            <div className="font-display text-2xl font-bold text-primary" data-testid={`text-price-${vehicle.id}`}>
              ${vehicle.payNowPrice}
              <span className="text-sm font-normal text-muted-foreground">/day</span>
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Pay Now Price
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 gap-2 flex-wrap">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => onViewDetails?.(vehicle)}
          data-testid={`button-details-${vehicle.id}`}
        >
          View Details
        </Button>
        <Button 
          className="flex-1"
          onClick={() => onSelect?.(vehicle)}
          data-testid={`button-select-${vehicle.id}`}
        >
          Select
        </Button>
      </CardFooter>
    </Card>
  );
}
