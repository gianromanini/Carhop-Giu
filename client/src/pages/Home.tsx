import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { VehicleCard, type Vehicle } from "@/components/VehicleCard";
import { VehicleDetailModal } from "@/components/VehicleDetailModal";
import { FilterSidebar, type Filters } from "@/components/FilterSidebar";
import { PriceMatchModal } from "@/components/PriceMatchModal";
import { CheckoutFlow } from "@/components/CheckoutFlow";
import { TrustBadges } from "@/components/TrustBadges";
import { Footer } from "@/components/Footer";
import { SearchForm } from "@/components/SearchForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Leaf } from "lucide-react";
import { addDays } from "date-fns";

import corollaImage from "@assets/generated_images/toyota_corolla_side_view.png";
import civicImage from "@assets/generated_images/honda_civic_side_view.png";
import versaImage from "@assets/generated_images/nissan_versa_side_view.png";
import elantraImage from "@assets/generated_images/hyundai_elantra_side_view.png";
import forteImage from "@assets/generated_images/kia_forte_side_view.png";
import mazda3Image from "@assets/generated_images/mazda_3_hatchback_view.png";

// todo: remove mock functionality - replace with real API data
const mockVehicles: Vehicle[] = [
  {
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
  },
  {
    id: "2",
    name: "Honda Civic",
    category: "Economy",
    image: civicImage,
    pricePerDay: 38,
    payNowPrice: 32,
    mpg: 33,
    passengers: 5,
    transmission: "Automatic",
    luggage: 2,
    fuelEfficient: true,
  },
  {
    id: "3",
    name: "Nissan Versa",
    category: "Compact",
    image: versaImage,
    pricePerDay: 28,
    payNowPrice: 22,
    mpg: 35,
    passengers: 5,
    transmission: "Automatic",
    luggage: 2,
    fuelEfficient: true,
  },
  {
    id: "4",
    name: "Hyundai Elantra",
    category: "Economy",
    image: elantraImage,
    pricePerDay: 32,
    payNowPrice: 26,
    mpg: 31,
    passengers: 5,
    transmission: "Automatic",
    luggage: 2,
    fuelEfficient: true,
  },
  {
    id: "5",
    name: "Kia Forte",
    category: "Economy",
    image: forteImage,
    pricePerDay: 30,
    payNowPrice: 24,
    mpg: 28,
    passengers: 5,
    transmission: "Automatic",
    luggage: 2,
    fuelEfficient: false,
  },
  {
    id: "6",
    name: "Mazda 3",
    category: "Compact",
    image: mazda3Image,
    pricePerDay: 42,
    payNowPrice: 35,
    mpg: 30,
    passengers: 5,
    transmission: "Manual",
    luggage: 2,
    fuelEfficient: true,
  },
];

type View = "browse" | "checkout" | "confirmation";

export default function Home() {
  const [view, setView] = useState<View>("browse");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchData, setSearchData] = useState({
    location: "Los Angeles Airport (LAX)",
    pickupDate: new Date(),
    returnDate: addDays(new Date(), 3),
  });
  const [filters, setFilters] = useState<Filters>({
    priceRange: [15, 100],
    fuelSaverOnly: false,
    transmission: [],
    passengers: null,
    sortBy: "price-low",
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [manageBookingOpen, setManageBookingOpen] = useState(false);
  const [bookingRef, setBookingRef] = useState("");

  const filteredVehicles = useMemo(() => {
    let result = [...mockVehicles];

    // Filter by price range
    result = result.filter(
      (v) => v.payNowPrice >= filters.priceRange[0] && v.payNowPrice <= filters.priceRange[1]
    );

    // Filter by fuel saver
    if (filters.fuelSaverOnly) {
      result = result.filter((v) => v.fuelEfficient);
    }

    // Filter by transmission
    if (filters.transmission.length > 0) {
      result = result.filter((v) => filters.transmission.includes(v.transmission));
    }

    // Filter by passengers
    if (filters.passengers) {
      result = result.filter((v) => v.passengers >= filters.passengers!);
    }

    // Sort
    switch (filters.sortBy) {
      case "price-low":
        result.sort((a, b) => a.payNowPrice - b.payNowPrice);
        break;
      case "price-high":
        result.sort((a, b) => b.payNowPrice - a.payNowPrice);
        break;
      case "mpg":
        result.sort((a, b) => b.mpg - a.mpg);
        break;
      default:
        break;
    }

    return result;
  }, [filters]);

  const handleSearch = (data: { location: string; pickupDate: Date; returnDate: Date }) => {
    setSearchData(data);
    setHasSearched(true);
    console.log("Search:", data);
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCheckoutComplete = () => {
    setView("confirmation");
  };

  const handleBackFromCheckout = () => {
    setView("browse");
    setSelectedVehicle(null);
  };

  if (view === "checkout" && selectedVehicle) {
    return (
      <div className="min-h-screen bg-background">
        <Header onManageBooking={() => setManageBookingOpen(true)} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <CheckoutFlow
            vehicle={selectedVehicle}
            pickupDate={searchData.pickupDate}
            returnDate={searchData.returnDate}
            location={searchData.location}
            onBack={handleBackFromCheckout}
            onComplete={handleCheckoutComplete}
          />
        </main>
        <ManageBookingDialog
          open={manageBookingOpen}
          onOpenChange={setManageBookingOpen}
          bookingRef={bookingRef}
          setBookingRef={setBookingRef}
        />
      </div>
    );
  }

  if (view === "confirmation") {
    return (
      <div className="min-h-screen bg-background">
        <Header onManageBooking={() => setManageBookingOpen(true)} />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center mb-6">
            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-4">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-8">
            Your {selectedVehicle?.name} rental has been confirmed. A confirmation email has been sent with all the details.
          </p>
          <div className="p-6 rounded-lg bg-muted/50 mb-8 text-left max-w-md mx-auto">
            <h3 className="font-semibold mb-3">Booking Details</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Confirmation #:</span> ECO-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              <p><span className="text-muted-foreground">Vehicle:</span> {selectedVehicle?.name}</p>
              <p><span className="text-muted-foreground">Location:</span> {searchData.location}</p>
              <p><span className="text-muted-foreground">Pick-up:</span> {searchData.pickupDate.toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Return:</span> {searchData.returnDate.toLocaleDateString()}</p>
            </div>
          </div>
          <Button onClick={() => { setView("browse"); setSelectedVehicle(null); }} data-testid="button-book-another">
            Book Another Car
          </Button>
        </main>
        <ManageBookingDialog
          open={manageBookingOpen}
          onOpenChange={setManageBookingOpen}
          bookingRef={bookingRef}
          setBookingRef={setBookingRef}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onManageBooking={() => setManageBookingOpen(true)} />

      {!hasSearched ? (
        <>
          <Hero onSearch={handleSearch} />
          
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
                <div>
                  <h2 className="font-display text-3xl font-bold">Popular Economy Cars</h2>
                  <p className="text-muted-foreground mt-1">Fuel-efficient vehicles at unbeatable prices</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <Leaf className="h-3 w-3 mr-1" />
                    Fuel Savers Available
                  </Badge>
                  <PriceMatchModal />
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockVehicles.slice(0, 6).map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onSelect={handleSelectVehicle}
                    onViewDetails={(v) => setDetailVehicle(v)}
                  />
                ))}
              </div>
            </div>
          </section>

          <TrustBadges />
        </>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 p-4 rounded-lg bg-card border">
            <SearchForm onSearch={handleSearch} compact />
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold">Available Cars</h1>
              <p className="text-muted-foreground">
                {filteredVehicles.length} vehicles found at {searchData.location}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PriceMatchModal
                trigger={
                  <Button variant="outline" size="sm">
                    <Shield className="h-4 w-4 mr-2" />
                    Price Match
                  </Button>
                }
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <FilterSidebar
                filters={filters}
                onFiltersChange={setFilters}
                vehicleCount={filteredVehicles.length}
              />
            </div>
            
            <div className="lg:col-span-3">
              {filteredVehicles.length > 0 ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onSelect={handleSelectVehicle}
                      onViewDetails={(v) => setDetailVehicle(v)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-lg font-medium mb-2">No vehicles match your filters</p>
                  <p className="text-muted-foreground mb-4">Try adjusting your search criteria</p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        priceRange: [15, 100],
                        fuelSaverOnly: false,
                        transmission: [],
                        passengers: null,
                        sortBy: "price-low",
                      })
                    }
                    data-testid="button-clear-filters-empty"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      <Footer />

      <VehicleDetailModal
        vehicle={detailVehicle}
        open={!!detailVehicle}
        onOpenChange={(open) => !open && setDetailVehicle(null)}
        onSelect={handleSelectVehicle}
      />

      <ManageBookingDialog
        open={manageBookingOpen}
        onOpenChange={setManageBookingOpen}
        bookingRef={bookingRef}
        setBookingRef={setBookingRef}
      />
    </div>
  );
}

function ManageBookingDialog({
  open,
  onOpenChange,
  bookingRef,
  setBookingRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingRef: string;
  setBookingRef: (ref: string) => void;
}) {
  const handleLookup = () => {
    console.log("Looking up booking:", bookingRef);
    // todo: replace with real API call
    alert(`Booking ${bookingRef} not found. This is a demo.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Your Booking</DialogTitle>
          <DialogDescription>
            Enter your booking reference to view or modify your reservation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bookingRef">Booking Reference</Label>
            <Input
              id="bookingRef"
              placeholder="e.g., ECO-ABC123XYZ"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              data-testid="input-booking-ref"
            />
          </div>
          <Button className="w-full" onClick={handleLookup} data-testid="button-lookup-booking">
            Look Up Booking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
