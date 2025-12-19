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
      existingScript.addEventListener('load', () => {
        setTimeout(() => resolve(), 100);
      });
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
    script.onload = () => {
      setTimeout(() => resolve(), 100);
    };
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
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch((err) => console.error('Google Maps load error:', err));
  }, []);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places || !containerRef.current || autocompleteRef.current) {
      return;
    }

    try {
      const placeAutocompleteElement = new (window as any).google.maps.places.PlaceAutocompleteElement(
        {
          componentRestrictions: { country: ['us'] }
        }
      );

      autocompleteRef.current = placeAutocompleteElement;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(placeAutocompleteElement);

      placeAutocompleteElement.addEventListener('gmp-placeselect', async () => {
        const place = placeAutocompleteElement.value?.formattedAddress;
        if (place) {
          onChange(place);
        }
      });

      const input = placeAutocompleteElement.querySelector('input');
      if (input) {
        input.placeholder = placeholder;
        input.value = value;
      }
    } catch (error) {
      console.error('Error initializing place autocomplete:', error);
    }
  }, [isLoaded, onChange, placeholder, value]);

  return (
    <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
      <div className="pl-2 sm:pl-3">
        <MapPin size={16} className="text-green-600" />
      </div>
      <div ref={containerRef} className="w-full" data-testid="place-autocomplete-container" />
    </div>
  );
}
