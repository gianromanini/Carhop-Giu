import { useState } from "react";
import { MapPin, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";

interface SearchFormProps {
  onSearch?: (data: { location: string; pickupDate: Date; returnDate: Date }) => void;
  compact?: boolean;
}

export function SearchForm({ onSearch, compact = false }: SearchFormProps) {
  const [location, setLocation] = useState("");
  const [pickupDate, setPickupDate] = useState<Date>(new Date());
  const [returnDate, setReturnDate] = useState<Date>(addDays(new Date(), 3));
  const [pickupOpen, setPickupOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const handleSearch = () => {
    onSearch?.({ location, pickupDate, returnDate });
    console.log("Search:", { location, pickupDate, returnDate });
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Airport, city, or address"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9"
              data-testid="input-location-compact"
            />
          </div>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Pick-up</Label>
          <Popover open={pickupOpen} onOpenChange={setPickupOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal" data-testid="button-pickup-date-compact">
                <Calendar className="mr-2 h-4 w-4" />
                {format(pickupDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={pickupDate}
                onSelect={(date) => {
                  if (date) {
                    setPickupDate(date);
                    if (date >= returnDate) {
                      setReturnDate(addDays(date, 1));
                    }
                  }
                  setPickupOpen(false);
                }}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Return</Label>
          <Popover open={returnOpen} onOpenChange={setReturnOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal" data-testid="button-return-date-compact">
                <Calendar className="mr-2 h-4 w-4" />
                {format(returnDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={returnDate}
                onSelect={(date) => {
                  if (date) setReturnDate(date);
                  setReturnOpen(false);
                }}
                disabled={(date) => date <= pickupDate}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={handleSearch} data-testid="button-search-compact">
          <Search className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="location">Pick-up Location</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="location"
            placeholder="Airport, city, or address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="pl-10 h-12 text-base"
            data-testid="input-location"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pick-up Date</Label>
          <Popover open={pickupOpen} onOpenChange={setPickupOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-12 justify-start font-normal text-base"
                data-testid="button-pickup-date"
              >
                <Calendar className="mr-2 h-5 w-5" />
                {format(pickupDate, "EEE, MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={pickupDate}
                onSelect={(date) => {
                  if (date) {
                    setPickupDate(date);
                    if (date >= returnDate) {
                      setReturnDate(addDays(date, 1));
                    }
                  }
                  setPickupOpen(false);
                }}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Return Date</Label>
          <Popover open={returnOpen} onOpenChange={setReturnOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-12 justify-start font-normal text-base"
                data-testid="button-return-date"
              >
                <Calendar className="mr-2 h-5 w-5" />
                {format(returnDate, "EEE, MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={returnDate}
                onSelect={(date) => {
                  if (date) setReturnDate(date);
                  setReturnOpen(false);
                }}
                disabled={(date) => date <= pickupDate}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button 
        className="w-full h-12 text-base font-semibold" 
        onClick={handleSearch}
        data-testid="button-search"
      >
        <Search className="mr-2 h-5 w-5" />
        Search Cars
      </Button>
    </div>
  );
}
