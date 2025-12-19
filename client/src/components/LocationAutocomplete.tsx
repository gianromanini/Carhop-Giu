import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableLocations?: string[];
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Enter pickup address',
  availableLocations
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // If availableLocations is provided, filter from those instead of searching OSM
  const searchLocations = async (query: string) => {
    if (availableLocations && availableLocations.length > 0) {
      // Filter from available locations
      const filtered = availableLocations
        .filter(loc => loc.toLowerCase().includes(query.toLowerCase()))
        .map(loc => ({
          display_name: loc,
          lat: '0',
          lon: '0'
        }));
      
      setSuggestions(filtered);
      setIsOpen(true);
      return;
    }

    // Original OSM search behavior
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (response.ok) {
        const data: LocationSuggestion[] = await response.json();
        setSuggestions(data);
        setIsOpen(true);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Location search error:', error);
      }
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLocations(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, availableLocations]);

  const handleSelectLocation = (location: LocationSuggestion) => {
    setInputValue(location.display_name);
    onChange(location.display_name);
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
    >
      <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <div className="pl-2 sm:pl-3 flex-shrink-0">
          <MapPin size={16} className="text-green-600" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          data-testid="input-autocomplete-location"
          className="w-full bg-transparent px-3 py-2 outline-none text-sm"
        />
        {isLoading && (
          <div className="pr-3 flex-shrink-0">
            <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.lat}-${suggestion.lon}-${index}`}
              onClick={() => handleSelectLocation(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-b-0 transition-colors"
              data-testid={`suggestion-location-${index}`}
            >
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {suggestion.display_name}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && inputValue.length >= 1 && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 px-4 py-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {availableLocations?.length === 0 ? 'Nenhuma localização disponível' : 'Nenhuma localização encontrada'}
          </p>
        </div>
      )}
    </div>
  );
}
