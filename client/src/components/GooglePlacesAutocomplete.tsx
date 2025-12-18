import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function GooglePlacesAutocomplete({ value, onChange, placeholder = 'Enter pickup address' }: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch((err) => console.error('Google Maps load error:', err));
  }, []);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    if (!inputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'us' }
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address) {
          onChange(place.formatted_address);
        }
      });
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
    }
  }, [isLoaded, onChange]);

  return (
    <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
      <div className="pl-2 sm:pl-3">
        <MapPin size={16} className="text-green-600" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent w-full p-2 sm:p-3 outline-none text-xs sm:text-sm text-zinc-900 dark:text-white"
        data-testid="input-autocomplete-location"
      />
    </div>
  );
}
