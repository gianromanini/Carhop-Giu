import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchForm } from "./SearchForm";
import heroImage from "@assets/generated_images/hero_highway_economy_car.png";

interface HeroProps {
  onSearch?: (data: { location: string; pickupDate: Date; returnDate: Date }) => void;
}

export function Hero({ onSearch }: HeroProps) {
  return (
    <section className="relative min-h-[80vh] flex items-center">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white space-y-6">
            <Badge 
              variant="secondary" 
              className="bg-white/20 text-white border-white/30 backdrop-blur-sm"
            >
              <Shield className="h-3 w-3 mr-1" />
              Price Match Guarantee
            </Badge>
            
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Economy Cars from{" "}
              <span className="text-primary">$19</span>/day
            </h1>
            
            <p className="text-lg text-white/80 max-w-lg">
              Fuel-efficient rentals with no hidden fees. Save more with our pay-now discounts 
              and fuel saver vehicles.
            </p>
            
            <div className="flex flex-wrap gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Free Cancellation
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                No Hidden Fees
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                24/7 Support
              </span>
            </div>
          </div>
          
          <Card className="p-6 backdrop-blur-xl bg-background/95">
            <h2 className="font-display text-xl font-semibold mb-4">Find Your Perfect Ride</h2>
            <SearchForm onSearch={onSearch} />
          </Card>
        </div>
      </div>
    </section>
  );
}
