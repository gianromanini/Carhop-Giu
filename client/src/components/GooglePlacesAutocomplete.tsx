import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
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

export function GooglePlacesAutocomplete({
  value,
  onChange,
  placeholder = 'Enter pickup address'
}: GooglePlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const placeAutocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch((err) => console.error('Google Maps load error:', err));
  }, []);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places || !containerRef.current || placeAutocompleteRef.current) {
      return;
    }

    try {
      const placeAutocomplete = new (window as any).google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: ['us'] }
      });

      placeAutocompleteRef.current = placeAutocomplete;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(placeAutocomplete);

      // Listen for place selection
      placeAutocomplete.addEventListener('gmp-placeselect', async () => {
        const selectedPlace = placeAutocomplete.value;
        if (selectedPlace?.formattedAddress) {
          onChange(selectedPlace.formattedAddress);
        }
      });

      // Set initial value and placeholder
      const inputElement = containerRef.current.querySelector('input');
      if (inputElement) {
        inputElement.placeholder = placeholder;
        inputElement.setAttribute('data-testid', 'input-autocomplete-location');
        if (value) {
          inputElement.value = value;
        }
      }
    } catch (error) {
      console.error('Error initializing PlaceAutocompleteElement:', error);
    }
  }, [isLoaded, onChange, placeholder, value]);

  return (
    <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="pl-2 sm:pl-3 flex-shrink-0">
        <MapPin size={16} className="text-green-600" />
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
