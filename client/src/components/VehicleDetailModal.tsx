import { Users, Settings, Briefcase, Leaf, Fuel, Check, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PriceMatchModal } from "./PriceMatchModal";
import type { Vehicle } from "./VehicleCard";

interface VehicleDetailModalProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (vehicle: Vehicle) => void;
}

export function VehicleDetailModal({
  vehicle,
  open,
  onOpenChange,
  onSelect,
}: VehicleDetailModalProps) {
  if (!vehicle) return null;

  const savings = vehicle.pricePerDay - vehicle.payNowPrice;

  const features = [
    "Air Conditioning",
    "Bluetooth Audio",
    "USB Charging Ports",
    "Backup Camera",
    "Cruise Control",
    "Power Windows",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {vehicle.name}
            <Badge variant="secondary">{vehicle.category}</Badge>
            {vehicle.fuelEfficient && (
              <Badge className="bg-green-600 text-white border-green-700">
                <Leaf className="h-3 w-3 mr-1" />
                Fuel Saver
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={vehicle.image}
              alt={`${vehicle.name} - ${vehicle.category}`}
              className="w-full h-full object-cover"
              data-testid={`img-vehicle-detail-${vehicle.id}`}
            />
          </div>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{vehicle.passengers}</p>
              <p className="text-xs text-muted-foreground">Passengers</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <Settings className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{vehicle.transmission}</p>
              <p className="text-xs text-muted-foreground">Transmission</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <Briefcase className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{vehicle.luggage}</p>
              <p className="text-xs text-muted-foreground">Large Bags</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <Fuel className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">{vehicle.mpg}</p>
              <p className="text-xs text-muted-foreground">MPG</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Features</h4>
            <div className="grid grid-cols-2 gap-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-muted-foreground line-through">
                ${vehicle.pricePerDay}/day
              </div>
              <div className="font-display text-3xl font-bold text-primary">
                ${vehicle.payNowPrice}
                <span className="text-base font-normal text-muted-foreground">/day</span>
              </div>
              {savings > 0 && (
                <Badge className="bg-primary text-primary-foreground mt-1">
                  Save ${savings}/day with Pay Now
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <PriceMatchModal
                trigger={
                  <Button variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Price Match
                  </Button>
                }
                vehicleName={vehicle.name}
                currentPrice={vehicle.payNowPrice}
              />
              <Button
                onClick={() => {
                  onSelect(vehicle);
                  onOpenChange(false);
                }}
                data-testid="button-select-vehicle"
              >
                Select This Car
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
