import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Car, Settings, Plus, Trash2, Check, Calendar, Leaf, DollarSign, ArrowLeft, Shield, Mountain, Smartphone, Gauge, Zap, Edit, X, Image, ChevronRight, ChevronLeft, Info, Search, MapPin, User, Menu, Users, Activity, Phone, Sun, Moon, Clock, LogOut, Map, Bluetooth, Camera, Route, Upload, Mail, FileText, Download, CreditCard, AlertTriangle, AlertCircle, CalendarClock, Lock, Fuel, Loader, Briefcase, List, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut, Move, Thermometer, Unlock, BatteryCharging, Armchair, Navigation, BarChart3, TrendingUp, Wallet, Receipt, MoreHorizontal, MessageCircle, MessageSquare, Send, Bell, MoreVertical, Building2, Truck, Reply, ChevronDown, CheckCircle, PlusCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Vehicle, Booking } from '@shared/schema';
type User = typeof import('@shared/schema').users.$inferSelect;
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

const generateTimeOptions = () => {
  const options = [];
  for (let i = 6; i <= 22; i++) {
    const hour = i;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12; 
    options.push(`${displayHour}:00 ${ampm}`);
    if (i < 22) {
      options.push(`${displayHour}:30 ${ampm}`);
    }
  }
  return options;
};
const timeOptions = generateTimeOptions();

const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getNext30MinSlot = () => {
  const now = new Date();
  let minutes = now.getMinutes();
  let hour = now.getHours();
  if (minutes < 30) { minutes = 30; } else { minutes = 0; hour += 1; }
  if (hour < 6) { hour = 6; minutes = 0; }
  if (hour >= 22) { hour = 22; minutes = 0; }
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinutes = minutes === 0 ? "00" : "30";
  return `${displayHour}:${displayMinutes} ${ampm}`;
};

const convertTo24Hour = (timeStr: string) => {
  if (!timeStr) return "10:00";
  try {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    let hourNum = parseInt(hours, 10);
    if (modifier === 'AM' && hourNum === 12) hourNum = 0;
    if (modifier === 'PM' && hourNum !== 12) hourNum += 12;
    return `${String(hourNum).padStart(2, '0')}:${minutes}`;
  } catch (e) {
    return "10:00";
  }
};

const detectCardType = (cardNumber: string): string => {
  const num = cardNumber.replace(/\s/g, '');
  if (/^4[0-9]{12}(?:[0-9]{3})?$/.test(num)) return 'visa';
  if (/^5[1-5][0-9]{14}$/.test(num)) return 'mastercard';
  if (/^3[47][0-9]{13}$/.test(num)) return 'amex';
  if (/^6(?:011|5[0-9]{2})[0-9]{12}$/.test(num)) return 'discover';
  return '';
};

const STATE_ABBREVIATIONS: { [key: string]: string } = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

const formatAddressForDisplay = (fullAddress: string): string => {
  if (!fullAddress) return fullAddress;
  
  const parts = fullAddress.split(',').map(p => p.trim());
  if (parts.length < 3) return fullAddress;
  
  // First, find ZIP code and STATE from the end
  let zip = '';
  let state = '';
  let stateIndex = -1;
  let zipIndex = -1;
  
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!zip) {
      const zipMatch = part.match(/(\d{5})/);
      if (zipMatch) {
        zip = zipMatch[1];
        zipIndex = i;
      }
    }
    if (!state && i !== zipIndex) {
      if (STATE_ABBREVIATIONS[part]) {
        state = STATE_ABBREVIATIONS[part];
        stateIndex = i;
      } else if (/^[A-Z]{2}$/.test(part)) {
        state = part;
        stateIndex = i;
      }
    }
  }
  
  if (!zip || !state) return fullAddress;
  
  // Now work backwards from state to find city
  let city = '';
  let cityIndex = -1;
  if (stateIndex > 0) {
    // Go backwards from state, skip regional areas, find city
    for (let i = stateIndex - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && !part.match(/Region|County|Area|District/i)) {
        city = part;
        cityIndex = i;
        break;
      }
    }
  }
  
  if (!city) return fullAddress;
  
  // Get everything before city as street/number/place
  let streetParts = parts.slice(0, cityIndex).join(', ');
  
  // Try to extract place name and street number
  let placeName = '';
  let number = '';
  let streetName = '';
  
  const firstParts = parts.slice(0, cityIndex);
  if (firstParts.length > 0) {
    // First part might be place name if non-numeric
    let startIdx = 0;
    if (!/^\d+$/.test(firstParts[0]) && !firstParts[0].match(/^(\d+)\s+/)) {
      placeName = firstParts[0];
      startIdx = 1;
    }
    
    // Next parts: look for number and street
    const remaining = firstParts.slice(startIdx);
    if (remaining.length > 0) {
      if (/^\d+$/.test(remaining[0])) {
        // Standalone number
        number = remaining[0];
        if (remaining.length > 1) {
          streetName = remaining.slice(1).join(' ');
        }
      } else {
        // Try to extract number from first element
        const match = remaining[0].match(/^(\d+)\s+(.+)$/);
        if (match) {
          number = match[1];
          const rest = [match[2], ...remaining.slice(1)];
          streetName = rest.join(' ');
        } else {
          // No number found, use everything as street
          streetName = remaining.join(' ');
        }
      }
    }
  }
  
  // Build formatted address
  if (placeName && number && streetName) {
    return `${placeName}, ${number} ${streetName}, ${city} - ${state}, ${zip}`;
  }
  if (placeName && streetName) {
    return `${placeName}, ${streetName}, ${city} - ${state}, ${zip}`;
  }
  if (number && streetName) {
    return `${number} ${streetName}, ${city} - ${state}, ${zip}`;
  }
  if (streetName) {
    return `${streetName}, ${city} - ${state}, ${zip}`;
  }
  if (city && state && zip) {
    return `${city} - ${state}, ${zip}`;
  }
  
  return fullAddress;
};

// Haversine formula for calculating distance between two coordinates in miles
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const addDaysToDate = (dateStr: string, days: number) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); 
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateBillingDays = (start: string, startTime: string, end: string, endTime: string) => {
  if (!start || !end || !startTime || !endTime) return 1;
  try {
    const startH = convertTo24Hour(startTime);
    const endH = convertTo24Hour(endTime);
    const startDate = new Date(`${start}T${startH}:00`);
    const endDate = new Date(`${end}T${endH}:00`);
    const diffTime = endDate.getTime() - startDate.getTime();
    if (isNaN(diffTime) || diffTime <= 0) return 1;
    const diffHours = diffTime / (1000 * 60 * 60);
    const days = Math.ceil(diffHours / 24);
    return Math.max(1, days);
  } catch (e) {
    return 1;
  }
};

const formatDisplayDate = (dateStr: string, timeStr: string) => {
  if (!dateStr) return "";
  const displayTime = timeStr || "10:00 AM";
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString('en-US', { month: 'short' });
  return `${monthName} ${day}, ${displayTime}, ${year}`;
};

const getGasValue = (level: string) => {
  switch(level) {
    case 'Full': return 4;
    case '3/4': return 3;
    case '1/2': return 2;
    case '1/4': return 1;
    case 'Empty': return 0;
    default: return 4;
  }
};

const getVehicleDescription = (model: string, category: string): string => {
  const descriptions: Record<string, string> = {
    'Toyota Camry': 'A reliable midsize sedan known for its comfort and fuel efficiency. Perfect for business trips or family getaways with excellent reliability.',
    'Honda Civic': 'A compact and nimble sedan that combines style with practical performance. Ideal for urban exploration with responsive handling and great gas mileage.',
    'BMW X5': 'A luxury SUV combining premium comfort with powerful performance. Experience sophistication and advanced technology for every journey.',
    'Tesla Model 3': 'A cutting-edge electric sedan offering zero-emission driving with impressive acceleration. Enjoy advanced autopilot features and minimal maintenance.',
    'Ford F-150': 'A powerful pickup truck built for capability and comfort. Perfect for those needing cargo space and towing power without sacrificing interior quality.',
    'Jeep Wrangler': 'An iconic SUV engineered for adventure. Go where most vehicles can\'t while enjoying rugged durability and open-air freedom.',
    'Audi A4': 'A sophisticated sedan that blends German engineering with understated luxury. Enjoy premium materials and smooth performance on every drive.',
    'Mazda CX-5': 'A sleek crossover SUV offering sportiness with practicality. Excellent handling and fuel efficiency in a versatile family package.',
    'Chevrolet Equinox': 'A versatile midsize SUV providing spacious comfort and reliable performance. Great for families needing room and dependability.',
    'Hyundai Elantra': 'An affordable and stylish compact sedan with modern features. Perfect for budget-conscious travelers without compromising quality.',
    'Volkswagen Jetta': 'A European-inspired compact sedan with excellent driving dynamics. Offers refined comfort and efficiency for savvy travelers.',
    'Nissan Altima': 'A spacious midsize sedan balancing comfort and performance. Known for reliability and a smooth, quiet ride.',
    'Kia Sportage': 'A compact SUV combining style with smart technology. Perfect for those seeking an affordable crossover with modern features.',
    'Honda Accord': 'A legendary midsize sedan recognized for durability and value. Offers a perfect blend of power, comfort, and efficiency.',
    'Toyota Highlander': 'A three-row SUV designed for families who need space and power. Seats up to 8 with the reliability Toyota is known for.'
  };
  
  return descriptions[model] || `A ${category.toLowerCase()} that offers comfortable and reliable transportation. Perfect for your next adventure with quality and style.`;
};

const ImageViewer = ({ src, onClose }: { src: string; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = Math.min(Math.max(1, scale - e.deltaY * 0.01), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  
  const toggleZoom = () => {
    if (scale === 1) setScale(2.5);
    else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center overflow-hidden select-none" onWheel={handleWheel}>
       <div className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-move active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={toggleZoom}>
         <img src={src} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }} className="max-w-full max-h-[85vh] object-contain" draggable={false} alt="" />
       </div>
       <div className="absolute bottom-8 flex items-center gap-4 bg-white dark:bg-zinc-900/80 backdrop-blur p-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">
          <button onClick={() => {setScale(Math.max(1, scale - 0.5)); if(scale<=1.5) setPosition({x:0,y:0});}} className="p-2 hover:bg-zinc-700 rounded-full"><ZoomOut size={20}/></button>
          <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
          <button onClick={() => setScale(Math.min(4, scale + 0.5))} className="p-2 hover:bg-zinc-700 rounded-full"><ZoomIn size={20}/></button>
          <div className="w-px h-4 bg-zinc-700 mx-1"></div>
          <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="p-2 hover:bg-zinc-700 rounded-full" title="Reset"><Maximize2 size={18}/></button>
       </div>
       <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all z-50" onClick={onClose}><X size={32} /></button>
    </div>
  );
};

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600"><Image size={48}/></div>;
  
  return (
    <div className="relative w-full h-56 md:h-96 bg-zinc-100 dark:bg-zinc-950 group">
      <img src={images[idx]} alt="Car" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
      {images.length > 1 && (
        <>
          <button onClick={(e) => {e.stopPropagation(); setIdx((prev) => (prev - 1 + images.length) % images.length)}} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-green-600 z-10"><ChevronLeft size={18}/></button>
          <button onClick={(e) => {e.stopPropagation(); setIdx((prev) => (prev + 1) % images.length)}} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-green-600 z-10"><ChevronRight size={18}/></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}></div>))}
          </div>
        </>
      )}
    </div>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-lg hover:shadow-green-900/20 hover:border-green-500/30 transition-all duration-300 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled, type = "button", ...props }: any) => {
  const baseStyle = "px-4 py-3 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/20",
    secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700",
    danger: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900 border border-red-200 dark:border-red-800",
    success: "bg-green-600 text-white hover:bg-green-500",
    outline: "border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-green-500 hover:text-green-600 dark:hover:text-white bg-transparent",
    ghost: "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
    blue: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20",
    orange: "bg-orange-500 text-black hover:bg-orange-400 shadow-lg shadow-orange-500/20",
    verified: "bg-zinc-200 dark:bg-zinc-800 text-green-600 dark:text-green-500 border border-transparent cursor-default",
    disabled: "bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 cursor-not-allowed border border-transparent"
  };
  const variantClass = disabled ? variants.disabled : variants[variant];
  return (<button onClick={disabled ? undefined : onClick} type={type} className={`${baseStyle} ${variantClass} ${className}`} disabled={disabled} {...props}>{children}</button>);
};

const Input = ({ label, required, className="", ...props }: any) => (
  <div className="mb-3 w-full">
    {label && <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">{label} {required && <span className="text-red-500">*</span>}</label>}
    <input className={`w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all placeholder-zinc-400 dark:placeholder-zinc-600 ${className}`} {...props} />
  </div>
);

const Checkbox = ({ label, checked, onChange, name, ...props }: any) => (
  <div className="flex items-center gap-3 mb-3 cursor-pointer group" onClick={() => onChange({ target: { name: name, type: 'checkbox', checked: !checked } })}>
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-green-600 border-green-600' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-500'}`}>
      {checked && <Check size={14} className="text-white dark:text-white" />}
    </div>
    <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white cursor-pointer select-none">{label}</label>
    <input type="checkbox" className="hidden" name={name} checked={checked} onChange={(e) => onChange(e)} {...props} />
  </div>
);

const FinancialBarChart = ({ data, fixedExpenses }: { data: Record<string, any>; fixedExpenses: number }) => {
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Only show months with actual bookings or returns (gross > 0 or pending > 0)
  const activeMonths = monthOrder.filter(label => data[label] && (data[label].gross > 0 || data[label].pending > 0));
  
  // Find max total for scaling vertical bars
  const maxTotal = Math.max(...activeMonths.map(label => {
    const monthData = data[label] || { gross: 0, expenses: 0, pending: 0 };
    const expenses = fixedExpenses > 0 ? fixedExpenses : (monthData.expenses || 0);
    return (monthData.gross || 0) + (monthData.pending || 0) + expenses;
  }), 1);

  return (
    <div className="w-full mt-4 select-none">
      {activeMonths.length > 0 ? (
        <div className="flex items-end justify-center gap-4 h-64">
          {activeMonths.map((label) => {
            const monthData = data[label] || { gross: 0, expenses: fixedExpenses, net: -fixedExpenses, pending: 0 };
            const gross = monthData.gross || 0;
            const pending = monthData.pending || 0;
            const expenses = fixedExpenses > 0 ? fixedExpenses : (monthData.expenses || 0);
            const net = gross - expenses;
            const total = gross + pending + expenses;
            
            // Calculate height percentages based on max total
            const barHeight = total > 0 ? (total / maxTotal) * 100 : 0;
            const expPercent = total > 0 ? (expenses / total) * 100 : 0;
            const grossPercent = total > 0 ? (gross / total) * 100 : 0;
            const pendingPercent = total > 0 ? (pending / total) * 100 : 0;
            
            return (
              <div key={label} className="flex flex-col items-center group flex-1 max-w-20">
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-white dark:bg-zinc-900/95 text-zinc-900 dark:text-white text-[10px] p-3 rounded-lg shadow-xl z-20 w-36 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700">
                  <div className="font-bold text-sm border-b border-zinc-700 pb-1 mb-1 text-center">{label}</div>
                  <div className="flex justify-between"><span className="text-orange-600 dark:text-orange-400">Expenses:</span> <span className="text-zinc-900 dark:text-white">${expenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-green-600 dark:text-green-400">Revenue:</span> <span className="text-zinc-900 dark:text-white">${gross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-purple-600 dark:text-purple-400">Pending:</span> <span className="text-zinc-900 dark:text-white">${pending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between font-bold border-t border-zinc-200 dark:border-zinc-700 pt-1 mt-1"><span className={net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>Net:</span> <span className="text-zinc-900 dark:text-white">${net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                </div>
                
                {/* Vertical stacked bar */}
                <div 
                  className="w-full bg-zinc-800 rounded-t-lg overflow-hidden flex flex-col-reverse transition-all hover:brightness-110 cursor-pointer relative"
                  style={{ height: `${Math.max(barHeight, 5)}%` }}
                >
                  {/* Expenses - Orange (bottom) */}
                  {expPercent > 0 && (
                    <div 
                      className="w-full bg-orange-500 flex items-center justify-center"
                      style={{ height: `${expPercent}%` }}
                    >
                      {expPercent > 15 && <span className="text-[9px] font-bold text-white drop-shadow-sm">${expenses > 999 ? `${(expenses/1000).toFixed(1)}k` : expenses.toFixed(0)}</span>}
                    </div>
                  )}
                  {/* Gross Revenue - Green (middle) */}
                  {grossPercent > 0 && (
                    <div 
                      className="w-full bg-green-500 flex items-center justify-center"
                      style={{ height: `${grossPercent}%` }}
                    >
                      {grossPercent > 15 && <span className="text-[9px] font-bold text-white drop-shadow-sm">${gross > 999 ? `${(gross/1000).toFixed(1)}k` : gross.toFixed(0)}</span>}
                    </div>
                  )}
                  {/* Pending - Purple (top) */}
                  {pendingPercent > 0 && (
                    <div 
                      className="w-full bg-purple-500 flex items-center justify-center"
                      style={{ height: `${pendingPercent}%` }}
                    >
                      {pendingPercent > 15 && <span className="text-[9px] font-bold text-white drop-shadow-sm">${pending > 999 ? `${(pending/1000).toFixed(1)}k` : pending.toFixed(0)}</span>}
                    </div>
                  )}
                </div>
                
                {/* Month label */}
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mt-2">{label}</span>
                {/* Net value */}
                <span className={`text-[10px] font-bold ${net >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                  ${net >= 0 ? '' : '-'}{Math.abs(net).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="w-full flex items-center justify-center text-zinc-400 py-8">No bookings or returns yet.</div>
      )}
    </div>
  );
};

const HostEarningsChart = ({ bookings, vehicles }: { bookings: Booking[]; vehicles: Vehicle[] }) => {
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  
  // Group bookings by month
  const monthlyData: Record<string, { gross: number; commission: number; net: number }> = {};
  bookings.forEach(b => {
    const date = new Date(b.startDate);
    const monthLabel = monthOrder[date.getMonth()];
    if (!monthlyData[monthLabel]) {
      monthlyData[monthLabel] = { gross: 0, commission: 0, net: 0 };
    }
    const vehicle = vehicleMap[b.vehicleId as unknown as number];
    const commission = b.total * ((vehicle?.commission || 10) / 100);
    monthlyData[monthLabel].gross += b.total;
    monthlyData[monthLabel].commission += commission;
    monthlyData[monthLabel].net += b.total - commission;
  });

  const activeMonths = monthOrder.filter(m => monthlyData[m] && monthlyData[m].gross > 0);
  
  if (activeMonths.length === 0) {
    return <div className="w-full flex items-center justify-center text-zinc-400 py-12">No completed bookings yet</div>;
  }

  const maxGross = Math.max(...activeMonths.map(m => monthlyData[m].gross), 1);

  return (
    <div className="w-full mt-6 select-none">
      <div className="flex items-end justify-center gap-6 h-96">
        {activeMonths.map((month) => {
          const data = monthlyData[month];
          const grossHeight = (data.gross / maxGross) * 100;
          const commissionPercent = (data.commission / data.gross) * 100;
          const netPercent = (data.net / data.gross) * 100;
          const isExpanded = expandedMonth === month;
          
          return (
            <div 
              key={month} 
              className="flex flex-col items-center flex-1 max-w-24"
              onMouseEnter={() => setExpandedMonth(month)}
              onMouseLeave={() => setExpandedMonth(null)}
              onTouchStart={() => setExpandedMonth(month)}
            >
              {/* Bar container */}
              <div 
                className="relative flex flex-col items-stretch rounded-lg overflow-hidden transition-all cursor-pointer"
                style={{ 
                  height: `${Math.max(grossHeight, 5)}%`,
                  width: isExpanded ? '80px' : '40px'
                }}
              >
                {/* Blue Section - Gross Revenue (Top) */}
                <div
                  className="flex-1 bg-blue-500 flex items-center justify-end pr-2 relative group"
                  style={{ flex: `${100}%` }}
                >
                  {isExpanded && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-300 whitespace-nowrap pr-2">
                      ${data.gross > 999 ? (data.gross/1000).toFixed(1) + 'k' : data.gross.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* Green Section - Net Earnings (Middle) */}
                <div
                  className="bg-green-500 flex items-center justify-end pr-2 relative group"
                  style={{ flex: `${netPercent}%`, minHeight: netPercent > 0 ? '20px' : '0px' }}
                >
                  {isExpanded && netPercent > 0 && (
                    <span className="text-[10px] font-bold text-green-700 dark:text-green-300 whitespace-nowrap pr-2">
                      ${data.net > 999 ? (data.net/1000).toFixed(1) + 'k' : data.net.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* Orange Section - Commission Fee (Bottom) */}
                <div
                  className="bg-orange-500 flex items-center justify-end pr-2 relative group"
                  style={{ flex: `${commissionPercent}%`, minHeight: commissionPercent > 0 ? '20px' : '0px' }}
                >
                  {isExpanded && commissionPercent > 0 && (
                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 whitespace-nowrap pr-2">
                      ${data.commission > 99 ? (data.commission/100).toFixed(1) + 'c' : data.commission.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Month label */}
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mt-3">{month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const initialFormState = { model: '', year: new Date().getFullYear(), vinNumber: '', licensePlate: '', hostName: '', category: '', price: '', fuel: 'Gasoline', seats: 5, transmission: 'Automatic', driveType: 'AWD', images: [''], consumption: '', isPriceMatch: false, isAWD: false, hasCarPlay: false, hasBluetooth: false, hasReverseCamera: false, hasHeatedSeats: false, hasHeatedSteering: false, hasElectricSeats: false, hasPaddleShifters: false, hasKeylessEntry: false, hasBlindSpotWarning: false, hasDriveAssist: false, hasUSBCharger: false, commission: 10, deductible: 1000, availableLocations: [], locationLat: null, locationLon: null, isDeliveryEnabled: false, maxDeliveryDistance: 50, minDeliveryFeeMiles: 5, minDeliveryFee: 15, deliveryPricePerMile: 2.50, minDeliveryHours: 6, pricing: {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}} };
const initialCheckState = { photosOutside: [] as string[], photosInside: [] as string[], miles: '', gas: 'Full' };
const initialExpenseState = { carId: '', lease: '', insurance: '', carWash: '', maintenance: '', trackApp: '', downPayment: '' };

interface SettingsType {
  taxes: number;
  cleaningFee: number;
  includedMiles: number;
  extraMileRate: number;
  prices: { 
    insurance500: number; 
    insurance1000: number; 
    childSeat: number; 
    childSeatPerTrip: boolean;
    prepaidFuel: number; 
    prepaidFuelPerTrip: boolean;
    lateReturnGrace: number; 
    lateReturnGracePerTrip: boolean;
    stressFreePackage: number; 
    stressFreePackagePerTrip: boolean;
  };
  locations: string[];
}

interface FormDataType {
  model: string;
  year: number;
  vinNumber: string;
  licensePlate: string;
  hostName: string;
  hostId?: string;
  category: string;
  price: string;
  fuel: string;
  seats: number;
  transmission: string;
  driveType: string;
  images: string[];
  consumption: string;
  isPriceMatch: boolean;
  isAWD: boolean;
  hasCarPlay: boolean;
  hasBluetooth: boolean;
  hasReverseCamera: boolean;
  hasHeatedSeats: boolean;
  hasHeatedSteering: boolean;
  hasElectricSeats: boolean;
  hasPaddleShifters: boolean;
  hasKeylessEntry: boolean;
  hasBlindSpotWarning: boolean;
  hasDriveAssist: boolean;
  hasUSBCharger: boolean;
  commission: number;
  deductible: number;
  availableLocations: string[];
  locationLat: number | null;
  locationLon: number | null;
  isDeliveryEnabled: boolean;
  maxDeliveryDistance: number | undefined;
  minDeliveryFeeMiles: number | undefined;
  minDeliveryFee: number | undefined;
  deliveryPricePerMile: number | undefined;
  minDeliveryHours: number | undefined;
  pricing: { taxes: number; cleaningFee: number; includedMiles: number; extraMileRate: number; prices: { insurance500: number; insurance1000: number; childSeat: number; childSeatPerTrip: boolean; prepaidFuel: number; prepaidFuelPerTrip: boolean; lateReturnGrace: number; lateReturnGracePerTrip: boolean; stressFreePackage: number; stressFreePackagePerTrip: boolean } };
  [key: string]: any;
}

export default function CarHopApp() {
  const queryClient = useQueryClient();
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const proceedButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState('home');
  const [darkMode, setDarkMode] = useState(true);
  const [adminUnit, setAdminUnit] = useState('');
  const [adminTab, setAdminTab] = useState<string | null>(null);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [supportSubTab, setSupportSubTab] = useState<'client' | 'host'>('client');
  const [selectedSupportMessage, setSelectedSupportMessage] = useState<any>(null);
  const [expandedSupportGroup, setExpandedSupportGroup] = useState<string | null>(null);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [supportSortBy, setSupportSortBy] = useState<'date' | 'name'>('date');
  const [supportSearchTerm, setSupportSearchTerm] = useState('');
  const [editingSupportMessageId, setEditingSupportMessageId] = useState<number | null>(null);
  const [editingSupportMessageText, setEditingSupportMessageText] = useState('');
  const [showClientChatModal, setShowClientChatModal] = useState(false);
  const [clientChatForm, setClientChatForm] = useState({ name: '', email: '', phone: '', subject: 'Talk with Support', message: '' });
  const [clientChatImages, setClientChatImages] = useState<string[]>([]);
  const [clientChatSending, setClientChatSending] = useState(false);
  const [clientChatTab, setClientChatTab] = useState<'history' | 'new'>('new');
  const [clientChatReply, setClientChatReply] = useState('');
  const [expandedClientChatGroups, setExpandedClientChatGroups] = useState<Set<string>>(new Set());
  const [finishedClientChatGroups, setFinishedClientChatGroups] = useState<Set<string>>(new Set());
  const [deletingChatGroup, setDeletingChatGroup] = useState<string | null>(null);
  const [deletingAdminChatGroup, setDeletingAdminChatGroup] = useState<string | null>(null);
  const [finishingChatGroup, setFinishingChatGroup] = useState<string | null>(null);
  const [showChatLoginScreen, setShowChatLoginScreen] = useState(false);
  const [earningsSortBy, setEarningsSortBy] = useState('carName');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedTripForView, setSelectedTripForView] = useState<Booking | null>(null);
  const [selectedHost, setSelectedHost] = useState<any>(null);
  const [selectedHostCarCommission, setSelectedHostCarCommission] = useState<any>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [expandedHostImage, setExpandedHostImage] = useState<string | null>(null);
  const [cancelingBookingId, setCancelingBookingId] = useState<number | null>(null);
  
  const [clientUser, setClientUser] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [expandedBenefit, setExpandedBenefit] = useState<string | null>(null);
  const [showHostRegisterModal, setShowHostRegisterModal] = useState(false);
  const [showHostLoginModal, setShowHostLoginModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetPasswordMessage, setResetPasswordMessage] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [signupForm, setSignupForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', city: '', state: '' });
  const [adminLoginForm, setAdminLoginForm] = useState({ unit: '', password: '' });
  const [hostLoginForm, setHostLoginForm] = useState({ username: '', password: '' });
  const [hostRegisterForm, setHostRegisterForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '',
    licenseNumber: '', licenseFrontImage: '', licenseBackImage: '', proofOfResidenceImage: '', socialSecurityNumber: '', username: '', password: '', confirmPassword: ''
  });
  const [hostRegisterMessage, setHostRegisterMessage] = useState('');
  const [showHostAgreementModal, setShowHostAgreementModal] = useState(false);
  const [hostAgreementAccepted, setHostAgreementAccepted] = useState(false);
  const [hostAgreementAcceptedAt, setHostAgreementAcceptedAt] = useState('');
  const [currentHost, setCurrentHost] = useState<any>(null);
  const [signupMessage, setSignupMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Email-only booking lookup with OTP verification
  const [showEmailLookupModal, setShowEmailLookupModal] = useState(false);
  const [emailLookupStep, setEmailLookupStep] = useState<'email' | 'otp'>('email');
  const [emailLookupEmail, setEmailLookupEmail] = useState('');
  const [emailLookupOtp, setEmailLookupOtp] = useState('');
  const [emailLookupLoading, setEmailLookupLoading] = useState(false);
  const [emailLookupMessage, setEmailLookupMessage] = useState('');
  const [verifiedBookingEmail, setVerifiedBookingEmail] = useState<string>(() => {
    // Initialize from localStorage with 24-hour expiration check
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('carhop_verified_email_data');
        if (stored) {
          const { email, timestamp } = JSON.parse(stored);
          const expiryMs = 24 * 60 * 60 * 1000; // 24 hours
          if (Date.now() - timestamp < expiryMs) {
            return email;
          }
          // Expired, remove
          localStorage.removeItem('carhop_verified_email_data');
        }
      } catch {
        localStorage.removeItem('carhop_verified_email_data');
      }
    }
    return '';
  });

  const [searchParams, setSearchParams] = useState({ location: '', start: '', startTime: '10:00 AM', end: '', endTime: '10:00 AM' });
  const [isSearching, setIsSearching] = useState(false);
  
  // Location search states
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{display_name: string, lat: string, lon: string}>>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lon: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showVehiclesMap, setShowVehiclesMap] = useState(false);
  const [selectedMapVehicle, setSelectedMapVehicle] = useState<number | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  const [driverDetails, setDriverDetails] = useState({ name: '', email: '', phone: '', licenseNumber: '', licenseImages: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkInInputRef = useRef<HTMLInputElement>(null);
  const carImageInputRef = useRef<HTMLInputElement>(null);
  const editVehicleImageInputRef = useRef<HTMLInputElement>(null);

  const [paymentDetails, setPaymentDetails] = useState({ cardName: '', cardNumber: '', expiry: '', cvc: '', type: 'visa' });
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'paypal'>('credit');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset-token');
    if (token) {
      setResetToken(token);
      setShowResetPasswordModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  
  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxZoom(1);
    setLightboxOpen(true);
  };
  
  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxImages([]);
    setLightboxIndex(0);
    setLightboxZoom(1);
  };
  
  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
    setLightboxZoom(1);
  };
  
  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
    setLightboxZoom(1);
  };
  
  const toggleZoom = () => {
    setLightboxZoom((prev) => prev === 1 ? 2 : 1);
  };
  
  const [extendingBookingId, setExtendingBookingId] = useState<number | null>(null);
  const [extensionDate, setExtensionDate] = useState('');
  const [extensionTime, setExtensionTime] = useState('10:00 AM');
  const [manageBookingId, setManageBookingId] = useState<number | null>(null);
  const [hostManageBookingId, setHostManageBookingId] = useState<number | null>(null);
  const [selectedExpenseVehicleId, setSelectedExpenseVehicleId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState<{lease: number; insurance: number; carWash: number; maintenance: number; trackApp: number; downPayment: number}>({ lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
  
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [checkData, setCheckData] = useState(initialCheckState);
  const [isCheckOutMode, setIsCheckOutMode] = useState(false);
  const [expandedCheckInPhotos, setExpandedCheckInPhotos] = useState(false);
  const [expandedCheckOutPhotos, setExpandedCheckOutPhotos] = useState(false);
  const [viewingReceiptBookingId, setViewingReceiptBookingId] = useState<number | null>(null);

  const [adjustment, setAdjustment] = useState({ type: 'fixed', value: '' });
  const [extraCharge, setExtraCharge] = useState({ type: 'Refuel', amount: '' });
  const [extraPaymentAmount, setExtraPaymentAmount] = useState('');
  const [checkingOutByAdminBookingId, setCheckingOutByAdminBookingId] = useState<number | null>(null);

  const [newLocation, setNewLocation] = useState('');
  const [newLocationCoords, setNewLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  const [carRentalAgreementAccepted, setCarRentalAgreementAccepted] = useState(false);
  const [showCarRentalModal, setShowCarRentalModal] = useState(false);
  const [viewingCarRentalOnly, setViewingCarRentalOnly] = useState(false);
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [extensionRequestReason, setExtensionRequestReason] = useState('');
  const [pendingDeliveryBookingId, setPendingDeliveryBookingId] = useState<number | null>(null);
  const [bookingFilterType, setBookingFilterType] = useState<'end-soon' | 'start-first'>('start-first');
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('');
  const [bookingFilterCarModel, setBookingFilterCarModel] = useState<string>('');
  const [bookingFilterNumber, setBookingFilterNumber] = useState('');
  const [clientBookingFilter, setClientBookingFilter] = useState<'newest' | 'active' | 'completed' | 'cancelled' | 'pending'>('newest');
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);
  const [showRateGuestModal, setShowRateGuestModal] = useState(false);
  const [selectedBookingForRating, setSelectedBookingForRating] = useState<number | null>(null);
  
  // Cache for full booking data (with images) - fetched on demand
  const [fullBookingCache, setFullBookingCache] = useState<Record<number, Booking>>({});
  // Track in-flight requests to avoid duplicate fetches
  const pendingFetchesRef = useRef<Set<number>>(new Set());

  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');

  const [cart, setCart] = useState<{ car: Vehicle | null; days: number; billingDays: number; extrasSelected: string[]; insuranceOption: string }>({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' });
  const [viewCar, setViewCar] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<FormDataType>(initialFormState as FormDataType);
  const [pricingStrings, setPricingStrings] = useState<{taxes: string; extraMileRate: string; childSeat: string; prepaidFuel: string; lateReturnGrace: string; stressFreePackage: string; cleaningFee: string; includedMiles: string; insurance500: string; insurance1000: string}>({taxes: '8.5', extraMileRate: '0.45', childSeat: '8', prepaidFuel: '35', lateReturnGrace: '25', stressFreePackage: '50', cleaningFee: '25', includedMiles: '200', insurance500: '25', insurance1000: '15'});
  // Load vehicles with availability filter based on search dates
  const vehicleQueryKey = searchParams.start && searchParams.end 
    ? ['/api/vehicles', searchParams.start, searchParams.end]
    : ['/api/vehicles'];

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({ 
    queryKey: vehicleQueryKey,
    queryFn: async () => {
      if (searchParams.start && searchParams.end) {
        const response = await fetch(`/api/vehicles?startDate=${searchParams.start}&endDate=${searchParams.end}`);
        return response.json();
      }
      const response = await fetch('/api/vehicles');
      return response.json();
    }
  });

  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState<boolean>(false);
  const [fleetSort, setFleetSort] = useState('brand-asc');

  const filteredAndSortedFleet = useMemo(() => {
    let result = [...vehicles];
    
    // Sort logic
    result.sort((a: any, b: any) => {
      if (fleetSort === 'brand-asc') return a.model.localeCompare(b.model);
      if (fleetSort === 'brand-desc') return b.model.localeCompare(a.model);
      if (fleetSort === 'year-asc') return (a.year || 0) - (b.year || 0);
      if (fleetSort === 'year-desc') return (b.year || 0) - (a.year || 0);
      if (fleetSort === 'host-asc') return (a.hostName || '').localeCompare(b.hostName || '');
      if (fleetSort === 'host-desc') return (b.hostName || '').localeCompare(a.hostName || '');
      return 0;
    });

    return result;
  }, [vehicles, fleetSort]);
  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery<Booking[]>({ 
    queryKey: ['/api/bookings'],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 3000 
  });
  
  // LOG PARA DEBUG
  useEffect(() => {
    console.log('Bookings DEBUG:', { 
      count: bookings.length, 
      isLoading: bookingsLoading,
      firstBooking: bookings[0] || 'none',
      allBookingIds: bookings.map(b => b.id)
    });
  }, [bookings, bookingsLoading]);
  const { data: settingsData } = useQuery<SettingsType>({ queryKey: ['/api/settings'] });
  const { data: financialData } = useQuery<{ monthly: Record<string, any>; byVehicle: Record<string, { gross: number; pending: number; expenses: number }>; fixedMonthly: number }>({ queryKey: ['/api/financial/summary'] });
  const { data: hostsData = [] } = useQuery<any[]>({ queryKey: ['/api/hosts'] });
  const { data: usersData = [] } = useQuery<User[]>({ queryKey: ['/api/admin/users'] });
  const { data: ratingsData = [] } = useQuery<any[]>({ queryKey: ['/api/ratings'] });
  const { data: supportMessagesData = [] } = useQuery<any[]>({ queryKey: ['/api/support-messages'] });
  const [hostTab, setHostTab] = useState<string | null>(null);
  const [showHostAddVehicleForm, setShowHostAddVehicleForm] = useState(false);
  const [editingHost, setEditingHost] = useState<any>(null);
  const [editingHostVehicle, setEditingHostVehicle] = useState<Vehicle | null>(null);
  const [hostVehicleImages, setHostVehicleImages] = useState<string[]>([]);
  const [hostNewLocation, setHostNewLocation] = useState('');
  const [hostNewLocationCoords, setHostNewLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [priceConfigForm, setPriceConfigForm] = useState<SettingsType | null>(null);
  const [carDetailsBooking, setCarDetailsBooking] = useState({ startDate: getTodayString(), startTime: getNext30MinSlot(), endDate: addDaysToDate(getTodayString(), 3), endTime: getNext30MinSlot() });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [bookingResult, setBookingResult] = useState<Booking | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User> | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [confirmingEditUserId, setConfirmingEditUserId] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showHostLoginPassword, setShowHostLoginPassword] = useState(false);
  const [showHostRegisterPassword, setShowHostRegisterPassword] = useState(false);
  const [showHostRegisterConfirmPassword, setShowHostRegisterConfirmPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showHostEditPassword, setShowHostEditPassword] = useState(false);
  
  // Rating system states
  const [ratingModal, setRatingModal] = useState<{ bookingId: number; vehicleId: number; hostId: string | null; clientName: string; clientEmail: string } | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [viewingVehicleRatings, setViewingVehicleRatings] = useState<number | null>(null);
  const [viewingClientRatings, setViewingClientRatings] = useState<string | null>(null);
  const [hostResponseModal, setHostResponseModal] = useState<{ ratingId: number; existingResponse?: string; existingHostStars?: number } | null>(null);
  const [hostResponseText, setHostResponseText] = useState('');
  const [hostRatingStars, setHostRatingStars] = useState(5);
  const [hostRatingComment, setHostRatingComment] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddressBooking, setDeliveryAddressBooking] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryValidationStatus, setDeliveryValidationStatus] = useState<'valid' | 'invalid' | 'not-checked'>('not-checked');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'delivery' | 'pickup'>('pickup');
  
  // Notification system states
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('carhop_read_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Host Chat Support states
  const [hostChatForm, setHostChatForm] = useState({ subject: 'Talk with Support', message: '' });
  const [hostChatImages, setHostChatImages] = useState<string[]>([]);
  const [hostChatSending, setHostChatSending] = useState(false);
  const [hostChatReply, setHostChatReply] = useState('');
  const [expandedHostChatGroups, setExpandedHostChatGroups] = useState<Set<string>>(new Set());
  const [finishingHostChatGroup, setFinishingHostChatGroup] = useState<string | null>(null);
  const [deletingHostChatGroup, setDeletingHostChatGroup] = useState<string | null>(null);
  
  // Host mobile menu and edit profile states
  const [hostMobileMenuOpen, setHostMobileMenuOpen] = useState(false);
  const [showHostEditProfileModal, setShowHostEditProfileModal] = useState(false);
  const [hostEditProfileForm, setHostEditProfileForm] = useState<{
    phone: string;
    email: string;
    licenseFrontImage: string;
    licenseBackImage: string;
  }>({ phone: '', email: '', licenseFrontImage: '', licenseBackImage: '' });
  const [hostProfileSaving, setHostProfileSaving] = useState(false);
  
  // Refs for closing menus when clicking outside
  const notificationsRef = useRef<HTMLDivElement>(null);
  const mobileActionsMenuRef = useRef<HTMLDivElement>(null);
  const hostMobileMenuRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (mobileActionsMenuRef.current && !mobileActionsMenuRef.current.contains(target)) {
        setMobileActionsMenuOpen(false);
      }
      if (hostMobileMenuRef.current && !hostMobileMenuRef.current.contains(target)) {
        setHostMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const defaultSettings: SettingsType = { taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: { insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true }, locations: ['JFK Airport', 'Downtown Center', 'Fairfield County'] };
  const settings: SettingsType = {
    taxes: settingsData?.taxes ?? defaultSettings.taxes,
    cleaningFee: settingsData?.cleaningFee ?? defaultSettings.cleaningFee,
    includedMiles: settingsData?.includedMiles ?? defaultSettings.includedMiles,
    extraMileRate: settingsData?.extraMileRate ?? defaultSettings.extraMileRate,
    prices: {
      insurance500: settingsData?.prices?.insurance500 ?? defaultSettings.prices.insurance500,
      insurance1000: settingsData?.prices?.insurance1000 ?? defaultSettings.prices.insurance1000,
      childSeat: settingsData?.prices?.childSeat ?? defaultSettings.prices.childSeat,
      childSeatPerTrip: settingsData?.prices?.childSeatPerTrip ?? defaultSettings.prices.childSeatPerTrip,
      prepaidFuel: settingsData?.prices?.prepaidFuel ?? defaultSettings.prices.prepaidFuel,
      prepaidFuelPerTrip: settingsData?.prices?.prepaidFuelPerTrip ?? defaultSettings.prices.prepaidFuelPerTrip,
      lateReturnGrace: settingsData?.prices?.lateReturnGrace ?? defaultSettings.prices.lateReturnGrace,
      lateReturnGracePerTrip: settingsData?.prices?.lateReturnGracePerTrip ?? defaultSettings.prices.lateReturnGracePerTrip,
      stressFreePackage: settingsData?.prices?.stressFreePackage ?? defaultSettings.prices.stressFreePackage,
      stressFreePackagePerTrip: settingsData?.prices?.stressFreePackagePerTrip ?? defaultSettings.prices.stressFreePackagePerTrip,
    },
    locations: settingsData?.locations ?? defaultSettings.locations,
  };

  const defaultPricingStrings = {taxes: '8.5', extraMileRate: '0.45', childSeat: '8', prepaidFuel: '35', lateReturnGrace: '25', stressFreePackage: '50', cleaningFee: '25', includedMiles: '200', insurance500: '25', insurance1000: '15'};
  const createVehicleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/vehicles', data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); 
      setFormData(initialFormState); 
      setPricingStrings(defaultPricingStrings);
      toast({ title: 'Vehicle created successfully' });
      window.scrollTo(0, 0);
    }
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data, expenses }: { id: number; data?: any; expenses?: any }) => {
      if (expenses) return apiRequest('PUT', `/api/vehicles/${id}`, { expenses });
      return apiRequest('PUT', `/api/vehicles/${id}`, data);
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); 
      queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); 
      setFormData(initialFormState); 
      setPricingStrings(defaultPricingStrings);
      setEditingId(null); 
      toast({ title: 'Vehicle updated successfully' });
      window.scrollTo(0, 0);
    }
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setDeletingVehicleId(null);
      toast({ title: 'Veículo excluído com sucesso' });
    }
  });

  const handleDeleteVehicle = (id: number, model: string) => {
    if (confirm(`Deseja excluir o veículo ${model}? Esta ação não pode ser desfeita.`)) {
      deleteVehicleMutation.mutate(id);
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => 
      apiRequest('PUT', `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setConfirmingEditUserId(null);
      setEditingUserId(null);
      setEditForm(null);
      toast({ title: 'User updated successfully' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => 
      apiRequest('DELETE', `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setDeletingUserId(null);
      setSelectedClient(null);
      toast({ title: 'User deleted successfully' });
    }
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/bookings', data);
      return res.json();
    },
    onSuccess: (data) => { 
      console.log('Booking created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); 
      queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); 
      toast({ title: 'Booking created successfully' });
    },
    onError: (error) => {
      console.error('Error creating booking mutation:', error);
      toast({ 
        title: 'Error creating booking', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/bookings/${id}`, data);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); 
      queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); 
      toast({ title: 'Booking updated successfully' });
    }
  });

  const markBookingAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/bookings/${id}/read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/bookings'] });
      const previousBookings = queryClient.getQueryData<Booking[]>(['/api/bookings']);
      queryClient.setQueryData<Booking[]>(['/api/bookings'], (old) => 
        old?.map(b => b.id === id ? { ...b, unread: false } : b) || []
      );
      return { previousBookings };
    },
    onError: (err, id, context) => {
      if (context?.previousBookings) {
        queryClient.setQueryData(['/api/bookings'], context.previousBookings);
      }
    },
    onSettled: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); 
    }
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => apiRequest('PUT', `/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: 'Settings updated successfully' });
    }
  });

  // Rating mutations
  const createRatingMutation = useMutation({
    mutationFn: (data: { bookingId: number; vehicleId: number; clientName: string; clientEmail: string; hostId: string | null; stars: number; comment: string }) => 
      apiRequest('POST', '/api/ratings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ratings'] });
      setRatingModal(null);
      setRatingStars(5);
      setRatingComment('');
      toast({ title: 'Thank you for your rating!' });
    }
  });

  const updateRatingMutation = useMutation({
    mutationFn: ({ id, hostResponse, hostStarsToClient, hostCommentToClient }: { id: number; hostResponse?: string; hostStarsToClient?: number; hostCommentToClient?: string }) => 
      apiRequest('PUT', `/api/ratings/${id}`, { hostResponse, hostStarsToClient, hostCommentToClient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ratings'] });
      setHostResponseModal(null);
      setHostResponseText('');
      setHostRatingStars(5);
      setHostRatingComment('');
      toast({ title: 'Rating submitted successfully' });
    }
  });

  const deleteRatingMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/ratings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ratings'] });
      toast({ title: 'Rating deleted' });
    }
  });

  // Fetch full booking data (with images) on demand - with deduplication
  const fetchFullBooking = useCallback(async (bookingId: number): Promise<Booking | null> => {
    // Return from cache if available
    if (fullBookingCache[bookingId]) {
      return fullBookingCache[bookingId];
    }
    
    // Check if already fetching this booking
    if (pendingFetchesRef.current.has(bookingId)) {
      return null;
    }
    
    // Mark as in-flight
    pendingFetchesRef.current.add(bookingId);
    
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, { credentials: 'include' });
      if (!response.ok) return null;
      const fullBooking = await response.json();
      setFullBookingCache(prev => ({ ...prev, [bookingId]: fullBooking }));
      return fullBooking;
    } catch (error) {
      console.error('Error fetching full booking:', error);
      return null;
    } finally {
      // Remove from pending set
      pendingFetchesRef.current.delete(bookingId);
    }
  }, [fullBookingCache]);

  // Get booking with full data (images) - uses cache or returns original
  // Note: The actual fetch is triggered via the useEffect below to avoid render-time side effects
  const getBookingWithImages = useCallback((booking: Booking): Booking => {
    // If we have cached full data, use it
    if (fullBookingCache[booking.id]) {
      return fullBookingCache[booking.id];
    }
    return booking;
  }, [fullBookingCache]);

  // Check if a booking has placeholder images that need to be fetched
  const bookingNeedsImageFetch = useCallback((booking: Booking): boolean => {
    if (fullBookingCache[booking.id]) return false;
    if (pendingFetchesRef.current.has(booking.id)) return false;
    
    return (
      (booking.driver as any)?.licenseImages?.some((img: string) => img === '[IMAGE]') ||
      (booking.checkInData as any)?.photosOutside?.some((img: string) => img === '[IMAGE]') ||
      (booking.checkInData as any)?.photosInside?.some((img: string) => img === '[IMAGE]') ||
      (booking.checkOutData as any)?.photosOutside?.some((img: string) => img === '[IMAGE]') ||
      (booking.checkOutData as any)?.photosInside?.some((img: string) => img === '[IMAGE]')
    );
  }, [fullBookingCache]);

  // Effect to fetch full booking data when placeholders are detected
  useEffect(() => {
    if (!bookings || bookings.length === 0) return;
    
    // Find bookings that need image fetching
    const bookingsToFetch = bookings.filter(bookingNeedsImageFetch);
    
    // Limit concurrent fetches to avoid overwhelming the server
    const maxConcurrent = 3;
    const toFetch = bookingsToFetch.slice(0, maxConcurrent);
    
    toFetch.forEach(booking => {
      fetchFullBooking(booking.id);
    });
  }, [bookings, bookingNeedsImageFetch, fetchFullBooking]);

  // Host pickup locations - per host, not global
  const { data: hostPickupLocationsData } = useQuery<{ locations: string[] }>({
    queryKey: ['/api/hosts', currentHost?.id, 'pickup-locations'],
    queryFn: async () => {
      if (!currentHost?.id) return { locations: [] };
      try {
        const response = await fetch(`/api/hosts/${currentHost.id}/pickup-locations`, { credentials: 'include' });
        if (!response.ok) return { locations: [] };
        return response.json();
      } catch (error) {
        return { locations: [] };
      }
    },
    enabled: !!currentHost?.id
  });
  const hostPickupLocations = hostPickupLocationsData?.locations || [];

  const addHostPickupLocationMutation = useMutation({
    mutationFn: async ({ location, userId }: { location: string; userId: string }) => {
      const response = await apiRequest('POST', `/api/hosts/${userId}/pickup-locations`, { location });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts', currentHost?.id, 'pickup-locations'] });
      toast({ title: 'Pickup location added' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to add location' });
    }
  });

  const removeHostPickupLocationMutation = useMutation({
    mutationFn: async ({ location, userId }: { location: string; userId: string }) => {
      const response = await apiRequest('DELETE', `/api/hosts/${userId}/pickup-locations`, { location });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts', currentHost?.id, 'pickup-locations'] });
      toast({ title: 'Pickup location removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to remove location' });
    }
  });

  const clientTrips = useMemo(() => {
    // Use authUser directly as primary source (from real authentication), with fallbacks
    const activeUser = selectedClient || clientUser || authUser;
    
    // Check for verified email from OTP verification (stored in localStorage)
    const hasVerifiedEmail = verifiedBookingEmail && verifiedBookingEmail.length > 0;
    
    // If no authenticated user but we have a verified email, use that
    if (!activeUser && hasVerifiedEmail) {
      console.log('[MyBookings] Using verified email for lookup:', verifiedBookingEmail);
      const trips = bookings.filter(b => {
        if (!b.driver) return false;
        const driverObj = typeof b.driver === 'string' ? JSON.parse(b.driver) : b.driver;
        const driverEmail = (driverObj?.email || '').toLowerCase().trim();
        return driverEmail === verifiedBookingEmail;
      });
      console.log('[MyBookings] Trips found for verified email:', trips.length);
      return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }
    
    // If still loading or no user yet, return empty (but UI should show loading state)
    if (!activeUser) {
      console.log('[MyBookings] No active user context yet');
      return [];
    }
    
    const effectiveEmail = (activeUser.email || '').toLowerCase().trim();
    const effectivePhone = (activeUser.phone || '').replace(/\D/g, '');

    console.log('[MyBookings] Filtering for user:', { 
      email: effectiveEmail,
      phone: effectivePhone ? `***${effectivePhone.slice(-4)}` : 'none',
      bookingsCount: bookings.length
    });
    
    if (!effectiveEmail && !effectivePhone) {
      // As a fallback, check for verified email
      if (hasVerifiedEmail) {
        console.log('[MyBookings] Using verified email as fallback:', verifiedBookingEmail);
        const trips = bookings.filter(b => {
          if (!b.driver) return false;
          const driverObj = typeof b.driver === 'string' ? JSON.parse(b.driver) : b.driver;
          const driverEmail = (driverObj?.email || '').toLowerCase().trim();
          return driverEmail === verifiedBookingEmail;
        });
        return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      }
      console.log('[MyBookings] User has no email or phone for filtering');
      return [];
    }
    
    const trips = bookings.filter(b => {
      if (!b.driver) return false;
      const driverObj = typeof b.driver === 'string' ? JSON.parse(b.driver) : b.driver;
      
      const driverEmail = (driverObj?.email || '').toLowerCase().trim();

      // Check details for secondary storage locations
      const detailDriverEmail = ((b.details as any)?.driverEmail || '').toLowerCase().trim();
      const detailHostEmail = ((b.details as any)?.hostEmail || '').toLowerCase().trim();
      
      const emailMatch = effectiveEmail && (driverEmail === effectiveEmail || detailDriverEmail === effectiveEmail || detailHostEmail === effectiveEmail);
      
      // If we are in the live site and user is authenticated, we should also try matching by ID if available in metadata
      const userIdMatch = activeUser.id && (b as any).userId === activeUser.id;
      
      return emailMatch || userIdMatch;
    });
    
    console.log('[MyBookings] Trips found:', trips.length);
    return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [selectedClient, clientUser, authUser, bookings, verifiedBookingEmail]);

  const getUserTripsAndTotal = (userEmail: string | null) => {
    if (!userEmail) return { trips: 0, total: 0 };
    const normalizedUserEmail = userEmail.toLowerCase().trim();
    const userBookings = bookings.filter(b => {
      const bookingEmail = (b.driver as any)?.email?.toLowerCase().trim();
      return bookingEmail === normalizedUserEmail;
    });
    const total = userBookings.reduce((sum, b) => {
      const details = b.details;
      if (!details) return sum;
      return sum + (Number(details.rate || 0) + Number(details.extras || 0) + Number(details.protection || 0) + Number(details.fees || 0) + Number(details.tax || 0) - Number(details.discount || 0));
    }, 0);
    return { trips: userBookings.length, total };
  };

  useEffect(() => {
    const today = getTodayString();
    const nextTime = getNext30MinSlot();
    const returnDay = addDaysToDate(today, 3);
    setSearchParams({ location: '', start: today, startTime: nextTime, end: returnDay, endTime: nextTime });
  }, []);

  useEffect(() => {
    if (settingsData && !priceConfigForm) {
      setPriceConfigForm(settingsData);
    }
  }, [settingsData, priceConfigForm]);

  useEffect(() => {
    if ((view === 'checkout' || view === 'payment') && cart.car && searchParams.start && searchParams.end && searchParams.startTime && searchParams.endTime) {
      const billingDays = calculateBillingDays(searchParams.start, searchParams.startTime, searchParams.end, searchParams.endTime);
      setCart(prev => ({ ...prev, billingDays }));
    }
  }, [searchParams.end, searchParams.endTime, searchParams.start, searchParams.startTime, view, cart.car?.id]);

  // Sync cart.car with latest vehicle data to ensure availableLocations are current
  useEffect(() => {
    if (view === 'checkout' && cart.car && cart.car.id) {
      // Always fetch the latest vehicle data from server when in checkout
      fetch(`/api/vehicles/${cart.car.id}`)
        .then(res => res.json())
        .then(latestCarData => {
          if (latestCarData) {
            setCart(prev => ({ ...prev, car: latestCarData }));
          }
        })
        .catch(err => console.error('Error fetching latest vehicle data:', err));
    }
  }, [view, cart.car?.id]);

  useEffect(() => {
    if (isAuthenticated && authUser) {
      console.log('[Auth] User authenticated:', JSON.stringify({
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        phone: authUser.phone,
        id: authUser.id,
        isHost: authUser.isHost,
        isAdmin: authUser.isAdmin
      }));
      const fullName = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || authUser.email?.split('@')[0] || 'User';
      const userEmail = authUser.email || '';
      console.log('[Auth] Setting clientUser and potentially host context');
      setClientUser({ name: fullName, email: userEmail, phone: authUser.phone || '' });
      setDriverDetails(prev => ({ ...prev, name: fullName, email: userEmail, phone: authUser.phone || '' }));
      setProfileForm({ firstName: authUser.firstName || '', lastName: authUser.lastName || '', phone: authUser.phone || '', city: authUser.city || '', state: authUser.state || '' });
      
      // If the user is a host, ensure the host context is set
      if (authUser.isHost) {
        const hostObj = hostsData?.find(h => h.email.toLowerCase() === userEmail.toLowerCase());
        if (hostObj) {
          console.log('[Auth] Auto-selecting host context for authenticated host');
          setCurrentHost(hostObj);
        }
      }
      
      setShowLoginModal(false);
    }
  }, [isAuthenticated, authUser, hostsData]);

  // Auto-scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Mark host chat messages as read when opening chat tab
  useEffect(() => {
    if (hostTab === 'chat' && currentHost?.email) {
      const hostEmail = currentHost.email;
      const hostUsername = currentHost.username || '';
      // Handle both old format (email as senderIdentifier) and new format (@username)
      const unreadHostReplies = supportMessagesData.filter((m: any) => 
        m.senderType === 'host' && 
        (m.senderIdentifier === hostEmail || m.senderIdentifier === `@${hostUsername}` || m.senderEmail === hostEmail) && 
        m.adminReply && !m.read
      );
      if (unreadHostReplies.length > 0) {
        Promise.all(
          unreadHostReplies.map((msg: any) => 
            apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true })
          )
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
        }).catch(err => console.error('Error marking host messages as read:', err));
      }
    }
  }, [hostTab, currentHost?.email, currentHost?.username, supportMessagesData]);

  // Recalculate delivery fee when pickup location or delivery type changes
  useEffect(() => {
    if (selectedDeliveryType === 'pickup') {
      setDeliveryFee(0);
      setDeliveryValidationStatus('not-checked');
      return;
    }
    
    if (deliveryAddressBooking && pickupAddress && cart.car?.minDeliveryFee !== null && cart.car?.minDeliveryFee !== undefined && cart.car?.minDeliveryFeeMiles !== null && cart.car?.minDeliveryFeeMiles !== undefined) {
      // Fetch delivery address coordinates from cache or re-fetch
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryAddressBooking)}&countrycodes=us&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const deliveryLat = parseFloat(data[0].lat);
            const deliveryLon = parseFloat(data[0].lon);
            
            // Geocodify pickup address to get its coordinates
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupAddress)}&countrycodes=us&limit=1`)
              .then(res => res.json())
              .then(pickupData => {
                if (pickupData && pickupData.length > 0) {
                  const pickupLat = parseFloat(pickupData[0].lat);
                  const pickupLon = parseFloat(pickupData[0].lon);
                  
                  // Calculate Haversine distance
                  const R = 3959;
                  const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
                  const dLon = (deliveryLon - pickupLon) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const distanceInMiles = R * c;
                  
                  const minFee = cart.car?.minDeliveryFee || 15;
                  const minMiles = cart.car?.minDeliveryFeeMiles || 5;
                  const pricePerMile = cart.car?.deliveryPricePerMile || 0;
                  let calculatedFee = 0;
                  
                  if (distanceInMiles <= minMiles) {
                    calculatedFee = minFee;
                  } else {
                    const excessMiles = distanceInMiles - minMiles;
                    calculatedFee = minFee + (excessMiles * pricePerMile);
                  }
                  
                  if (distanceInMiles <= (cart.car?.maxDeliveryDistance || 50)) {
                    setDeliveryFee(calculatedFee);
                    setDeliveryValidationStatus('valid');
                  } else {
                    setDeliveryFee(0);
                    setDeliveryValidationStatus('invalid');
                  }
                }
              });
          }
        });
    }
  }, [pickupAddress, selectedDeliveryType, deliveryAddressBooking, cart.car?.id]);

  const getMinReturnDate = () => {
    const today = getTodayString();
    const startTime = searchParams.startTime || getNext30MinSlot();
    const startH = convertTo24Hour(startTime);
    const startDate = new Date(`${searchParams.start || today}T${startH}:00`);
    startDate.setMinutes(startDate.getMinutes() + 30);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleClientLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.email) {
      const newUser = { name: "Client User", email: loginForm.email };
      setClientUser(newUser);
      setDriverDetails(prev => ({ ...prev, name: newUser.name, email: newUser.email }));
      setShowLoginModal(false);
      if (view === 'manage-redirect') setView('bookings');
    }
  };


  const handleAdminLoginSubmit = () => {
    if (adminLoginForm.unit === '01') {
      setShowAdminLoginModal(false);
      setAdminUnit('01');
      setAdminLoginForm({ unit: '', password: '' });
      setView('admin');
    } else {
      alert('Invalid unit');
    }
  };
  const handleManageBookingClick = () => { if (clientUser) { setView('bookings'); } else { setView('manage-redirect'); setShowLoginModal(true); } };
  const handleSignOut = () => { 
    setClientUser(null); 
    setDriverDetails({ name: '', email: '', phone: '', licenseNumber: '', licenseImages: [] }); 
    setView('home'); 
    queryClient.clear(); // Clear all cache on sign out
    window.location.href = '/api/logout';
  };

  // Location search with Nominatim (OpenStreetMap)
  const searchLocationDebounced = useRef<NodeJS.Timeout | null>(null);
  
  const handleLocationSearch = (query: string) => {
    setLocationQuery(query);
    if (searchLocationDebounced.current) clearTimeout(searchLocationDebounced.current);
    
    if (query.length < 3) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      return;
    }
    
    searchLocationDebounced.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`
        );
        const data = await response.json();
        setLocationSuggestions(data);
        setShowLocationDropdown(true);
      } catch (error) {
        console.error('Location search error:', error);
      }
    }, 300);
  };
  
  const selectLocation = (suggestion: {display_name: string, lat: string, lon: string}) => {
    const displayAddr = formatAddressForDisplay(suggestion.display_name);
    setLocationQuery(displayAddr);
    setUserCoords({ lat: parseFloat(suggestion.lat), lon: parseFloat(suggestion.lon) });
    setSearchParams(prev => ({ ...prev, location: suggestion.display_name }));
    setShowLocationDropdown(false);
    setShowVehiclesMap(true);
  };
  
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.display_name) {
            const displayAddr = formatAddressForDisplay(data.display_name);
            setLocationQuery(displayAddr);
            setSearchParams(prev => ({ ...prev, location: data.display_name }));
          }
        } catch (error) {
          setLocationQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        
        setIsGettingLocation(false);
        setShowVehiclesMap(true);
      },
      (error) => {
        setIsGettingLocation(false);
        alert('Unable to get your location. Please enable location services.');
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const handleSearch = () => { 
    if (!userCoords && !searchParams.location) { alert("Please select a Pick-up Location or use Current Location."); return; } 
    setIsSearching(true); 
    setShowVehiclesMap(true);
    setTimeout(() => { setIsSearching(false); const fleetSection = document.getElementById('fleet'); if (fleetSection) fleetSection.scrollIntoView({behavior:'smooth'}); }, 1500); 
  };
  
  const handleViewDetails = (car: Vehicle) => { 
    setViewCar(car); 
    setView('car-details'); 
    const today = getTodayString();
    const nextTime = getNext30MinSlot();
    const returnDay = addDaysToDate(today, 3);
    setCarDetailsBooking({ startDate: today, startTime: nextTime, endDate: returnDay, endTime: nextTime });
    setDeliveryAddressBooking('');
    setDeliveryFee(0);
    setDeliveryValidationStatus('not-checked');
    window.scrollTo(0, 0); 
  };
  const handleImageClick = (src: string) => { setSelectedImage(src); };

  const handleLicenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDriverDetails(prev => { if (prev.licenseImages.length >= 2) return prev; return { ...prev, licenseImages: [...prev.licenseImages, reader.result as string] }; });
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const deleteLicenseImage = (index: number) => setDriverDetails(prev => ({ ...prev, licenseImages: prev.licenseImages.filter((_, i) => i !== index) }));
  const triggerFileInput = () => fileInputRef.current?.click();

  const handleSearchParamsChange = (field: string, value: string) => { 
    const newParams = { ...searchParams, [field]: value }; 
    if (field === 'startTime') newParams.endTime = value; 
    if (field === 'start') if (newParams.end < value) newParams.end = value; 
    setSearchParams(newParams);
    if (view === 'checkout' || view === 'payment') { 
      const billingDays = calculateBillingDays(newParams.start, newParams.startTime, newParams.end, newParams.endTime); 
      setCart(prev => ({ ...prev, billingDays })); 
    } 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { 
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); 
  };

  const handleRent = (car: Vehicle) => { 
    if (!clientUser) { alert("Please sign in to make a reservation."); setShowLoginModal(true); return; } 
    const billingDays = calculateBillingDays(searchParams.start, searchParams.startTime, searchParams.end, searchParams.endTime); 
    setCart({ car, days: billingDays, billingDays: billingDays, extrasSelected: [], insuranceOption: '1000' }); 
    if (clientUser) setDriverDetails(prev => ({ ...prev, name: clientUser.name, email: clientUser.email, phone: clientUser.phone || '' })); 
    setPickupAddress('');
    setDeliveryAddressBooking('');
    setDeliveryFee(0);
    setDeliveryValidationStatus('not-checked');
    setView('checkout'); 
  };

  const toggleExtra = (extraType: string) => { 
    if (cart.extrasSelected.includes(extraType)) setCart({ ...cart, extrasSelected: cart.extrasSelected.filter(e => e !== extraType) }); 
    else setCart({ ...cart, extrasSelected: [...cart.extrasSelected, extraType] }); 
  };

  const calculateTotal = () => { 
    if (!cart.car) return { subtotal: 0, taxAmount: 0, total: 0, deliveryFee: 0 }; 
    const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
    const carPricing = cart.car.pricing || settings;
    let runningTotal = cart.car.price * days; 
    if (cart.extrasSelected.includes('childSeat')) runningTotal += settings.prices.childSeat;
    if (cart.insuranceOption === '500') runningTotal += (settings.prices.insurance500 * days); 
    if (cart.insuranceOption === '1000') runningTotal += (settings.prices.insurance1000 * days); 
    runningTotal += (carPricing.cleaningFee || settings.cleaningFee); 
    if (deliveryValidationStatus === 'valid') runningTotal += deliveryFee;
    const taxAmount = runningTotal * ((carPricing.taxes || settings.taxes) / 100); 
    return { subtotal: runningTotal, taxAmount, total: runningTotal + taxAmount, deliveryFee: deliveryValidationStatus === 'valid' ? deliveryFee : 0 }; 
  };

  const handleProceedToPayment = async () => { 
    if (!isCheckoutValid()) { alert("Please complete all mandatory fields and upload driver license photos."); return; } 
    
    // If delivery type and address is set, create pending booking first
    if (selectedDeliveryType === 'delivery' && deliveryValidationStatus === 'valid') {
      setIsProcessingPayment(true);
      const totalData = calculateTotal();
      const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
      
      const pendingBooking = {
        bookingCode: 'BK-' + Math.floor(Math.random() * 10000),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Pending Approval',
        carName: cart.car!.model,
        vehicleId: cart.car!.id,
        location: deliveryAddressBooking,
        startDate: searchParams.start,
        startTime: searchParams.startTime,
        returnDate: searchParams.end,
        returnTime: searchParams.endTime,
        days: days,
        total: totalData.total,
        image: cart.car!.images?.[0] || '',
        driver: { name: driverDetails.name, phone: driverDetails.phone, email: driverDetails.email, licenseNumber: driverDetails.licenseNumber, licenseImages: driverDetails.licenseImages },
        paymentRaw: null,
        paymentMethod: null,
        deliveryType: 'delivery',
        details: { 
          rate: cart.car!.price * days, 
          extras: (cart.extrasSelected.includes('childSeat') ? settings.prices.childSeat : 0), 
          protection: (cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * days, 
          protectionType: (cart.insuranceOption === '500' ? 'Standard' : 'Gold'), 
          fees: (cart.car!.pricing?.cleaningFee || settings.cleaningFee), 
          deliveryFee: totalData.deliveryFee || 0, 
          tax: totalData.taxAmount, 
          deliveryType: 'delivery', 
          deliveryApprovalStatus: 'pending', 
          pickupAddress: pickupAddress 
        },
        messages: [{ id: crypto.randomUUID(), sender: 'admin' as const, text: 'Your delivery request is pending approval. The host will review and confirm shortly. You will be notified once approved or if only pickup is available.', createdAt: new Date().toISOString(), read: false }],
        carRentalAgreement: carRentalAgreementAccepted ? { accepted: true, clientName: driverDetails.name, acceptedAt: new Date().toISOString() } : undefined,
        checkInStatus: 'pending',
        checkOutStatus: 'pending',
        checkInData: null,
        checkOutData: null
      };
      
      try {
        const response = await createBookingMutation.mutateAsync(pendingBooking);
        const created = await response.json();
        setPendingDeliveryBookingId(created.id);
        setIsProcessingPayment(false);
        setView('awaiting-approval');
      } catch (error) {
        console.error('Error creating pending booking:', error);
        setIsProcessingPayment(false);
        alert('Error creating booking. Please try again.');
      }
      return;
    }
    
    // For pickup, go directly to payment
    setView('payment'); 
  };

  const isCheckoutValid = () => driverDetails.name && driverDetails.email && driverDetails.phone && driverDetails.licenseNumber && driverDetails.licenseImages.length >= 2;

  const handleConfirmBooking = async () => { 
    if (paymentMethod === 'credit' && (!paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvc || !paymentDetails.cardName)) { 
      alert("Please enter valid payment details."); 
      return; 
    }
    
    // Validate pickup location selection - must be from available locations
    if (selectedDeliveryType === 'pickup') {
      if (!pickupAddress || (cart.car?.availableLocations && !cart.car.availableLocations.includes(pickupAddress))) {
        alert("Please select a valid pickup location from the vehicle's available locations.");
        return;
      }
    }
    
    setIsProcessingPayment(true); 
    
    // Simulate payment processing animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const totalData = calculateTotal(); 
    const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
    
    const paymentMethodDisplay = paymentMethod === 'paypal' 
      ? 'PayPal' 
      : `${paymentDetails.type.toUpperCase()} **** ${paymentDetails.cardNumber.slice(-4)}`;
    
    // Ensure booking location is always valid
    let bookingLocation = '';
    if (selectedDeliveryType === 'delivery') {
      bookingLocation = deliveryAddressBooking;
    } else {
      // For pickup, must use a selected location from available locations
      bookingLocation = pickupAddress || (cart.car?.availableLocations?.[0] || '');
    }
    
    const newBooking = { 
      bookingCode: 'BK-' + Math.floor(Math.random() * 10000), 
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      status: 'Active', 
      carName: cart.car!.model, 
      vehicleId: cart.car!.id,
      location: bookingLocation, 
      startDate: searchParams.start, 
      startTime: searchParams.startTime, 
      returnDate: searchParams.end, 
      returnTime: searchParams.endTime, 
      days: days, 
      total: totalData.total, 
      image: cart.car!.images?.[0] || '', 
      driver: { name: driverDetails.name, phone: driverDetails.phone, email: driverDetails.email, licenseNumber: driverDetails.licenseNumber, licenseImages: driverDetails.licenseImages }, 
      paymentRaw: paymentMethod === 'paypal' ? { type: 'paypal' } : { cardName: paymentDetails.cardName, cardNumber: paymentDetails.cardNumber, expiry: paymentDetails.expiry, cvc: paymentDetails.cvc, type: paymentDetails.type }, 
      paymentMethod: paymentMethodDisplay, 
      deliveryType: selectedDeliveryType,
      details: { rate: cart.car!.price * days, extras: (cart.extrasSelected.includes('childSeat') ? settings.prices.childSeat : 0), protection: (cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * days, protectionType: (cart.insuranceOption === '500' ? 'Standard' : 'Gold'), fees: (cart.car!.pricing?.cleaningFee || settings.cleaningFee), deliveryFee: totalData.deliveryFee || 0, tax: totalData.taxAmount, deliveryType: selectedDeliveryType, deliveryApprovalStatus: selectedDeliveryType === 'delivery' ? 'pending' : undefined, pickupAddress: pickupAddress },
      messages: selectedDeliveryType === 'delivery' ? [{ id: crypto.randomUUID(), sender: 'admin' as const, text: 'Your delivery request is pending approval. The host will review and confirm within the required time. If declined, you may pick up the vehicle at the location or request a different delivery time.', createdAt: new Date().toISOString(), read: false }] : [], 
      carRentalAgreement: carRentalAgreementAccepted ? { accepted: true, clientName: driverDetails.name, acceptedAt: new Date().toISOString() } : undefined,
      checkInStatus: 'pending', 
      checkOutStatus: 'pending', 
      checkInData: null, 
      checkOutData: null 
    };
    
    console.log('[Frontend] Creating booking with data:', JSON.stringify(newBooking).substring(0, 500));
    
    try {
      const createdBooking = await createBookingMutation.mutateAsync(newBooking);
      console.log('[Frontend] Created booking:', createdBooking);
      setIsProcessingPayment(false);
      setBookingResult(createdBooking);
      setPickupAddress('');
      setView('confirmation');
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('[Frontend] Error creating booking:', error);
      setIsProcessingPayment(false);
      // toast is already handled by mutation onError
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 4) val = val.slice(0, 4); 
    if (val.length > 2) { val = val.slice(0, 2) + '/' + val.slice(2); } 
    setPaymentDetails({ ...paymentDetails, expiry: val }); 
  };

  const handleStartWorkflow = (booking: Booking, mode: string) => {
    setActiveBooking(booking);
    setCheckData(initialCheckState);
    setIsCheckOutMode(mode === 'checkout');
    setView('check-workflow');
  };

  const handleCheckUpload = (e: React.ChangeEvent<HTMLInputElement>, section: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCheckData(prev => {
        const currentList = section === 'outside' ? prev.photosOutside : prev.photosInside;
        if (currentList.length >= 15) return prev;
        return { ...prev, [section === 'outside' ? 'photosOutside' : 'photosInside']: [...currentList, reader.result as string] };
      });
      reader.readAsDataURL(file);
    }
    if (checkInInputRef.current) checkInInputRef.current.value = '';
  };

  const handleRemoveCheckPhoto = (section: 'outside' | 'inside', index: number) => {
    setCheckData(prev => {
      const key = section === 'outside' ? 'photosOutside' : 'photosInside';
      const newList = [...prev[key]];
      newList.splice(index, 1);
      return { ...prev, [key]: newList };
    });
  };

  const triggerCheckInput = (section: string) => document.getElementById(`check-input-${section}`)?.click();

  const completeWorkflow = async () => {
     if (!checkData.miles) { alert("Please enter current mileage."); return; }
     if (checkData.photosOutside.length < 1) { alert("Please upload at least 1 outside photo."); return; }
     if (checkData.photosInside.length < 1) { alert("Please upload at least 1 inside photo."); return; }

     if (!activeBooking) return;

     let updateData: any = {};
     if (isCheckOutMode) {
       const checkInMiles = parseInt(activeBooking.checkInData?.miles || '0');
       const checkOutMiles = parseInt(checkData.miles || '0');
       const carPricing = vehicles.find(v => v.id === activeBooking.vehicleId)?.pricing;
       const includedMilesPerDay = carPricing?.includedMiles || settings.includedMiles;
       const extraMileRate = carPricing?.extraMileRate || settings.extraMileRate;
       const allowedMiles = includedMilesPerDay * activeBooking.days;
       const milesDriven = checkOutMiles - checkInMiles;
       const excessMiles = Math.max(0, milesDriven - allowedMiles);
       const excessMileageFee = excessMiles * extraMileRate;
       const gasInLevel = getGasValue(activeBooking.checkInData?.gas || 'Full');
       const gasOutLevel = getGasValue(checkData.gas);
       const gasDiff = Math.max(0, gasInLevel - gasOutLevel);
       const refuelingFee = gasDiff * 10;
       
       const newCharges: { type: string; amount: number }[] = [];
       if (excessMileageFee > 0) {
         newCharges.push({ type: 'Extra Mileage Fee', amount: excessMileageFee });
       }
       if (refuelingFee > 0) {
         newCharges.push({ type: 'Refuel Fee', amount: refuelingFee });
       }
       
       updateData = {
         checkOutStatus: 'completed',
         checkOutData: checkData,
         status: 'Completed',
         total: activeBooking.total + excessMileageFee + refuelingFee,
         details: {
           ...activeBooking.details,
           manualCharges: [...(activeBooking.details.manualCharges || []), ...newCharges]
         }
       };
     } else {
       updateData = {
         checkInStatus: 'completed',
         checkInData: checkData,
       };
     }

     await updateBookingMutation.mutateAsync({ id: activeBooking.id, data: updateData });
     setView('workflow-success');
  };

  const initExtension = (booking: Booking) => { 
    setExtendingBookingId(booking.id); 
    setExtensionDate(booking.returnDate); 
    setExtensionTime('10:00 AM');
  };

  const confirmExtension = async (booking: Booking) => {
    if (!extensionDate) return;
    
    const oldTimeStr = booking.returnTime || "10:00 AM";
    const oldDateTimeStr = `${booking.returnDate}T${convertTo24Hour(oldTimeStr)}:00`;
    const newDateTimeStr = `${extensionDate}T${convertTo24Hour(extensionTime)}:00`;
    
    const oldReturn = new Date(oldDateTimeStr);
    const newReturn = new Date(newDateTimeStr);
    
    const diffTime = newReturn.getTime() - oldReturn.getTime();
    
    // If reduction (new date is before current), create a request for admin approval
    if (diffTime < 0) {
      await apiRequest('POST', `/api/bookings/${booking.id}/extension-request`, {
        type: 'reduction',
        requestedReturnDate: extensionDate,
        requestedReturnTime: extensionTime,
        reason: extensionRequestReason || 'Reduction request'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setExtendingBookingId(null);
      setExtensionRequestReason('');
      alert("Reduction request submitted for admin approval.");
      return;
    }
    
    const diffMinutes = diffTime / (1000 * 60);
    let extraDays = 0;

    if (diffMinutes > 30) {
       const diffHours = diffTime / (1000 * 60 * 60);
       extraDays = Math.ceil(diffHours / 24);
       if (extraDays === 0) extraDays = 1;
    } else {
       alert("Extension granted as courtesy (30 min grace period).");
    }

    const baseRate = booking.details.rate || 0;
    const currentExtended = booking.details.extendedRate || 0;
    const currentDays = booking.days || 1;
    
    const dailyRate = (baseRate + currentExtended) / currentDays;
    const extraCost = dailyRate * extraDays;
    const carForTaxCalc = vehicles.find(v => v.id === booking.vehicleId);
    const extensionTaxRate = carForTaxCalc?.pricing?.taxes || settings.taxes || 0;
    const extraTax = extraCost * (extensionTaxRate / 100);
    const totalExtra = extraCost + extraTax;
    
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: {
        returnDate: extensionDate,
        returnTime: extensionTime,
        days: currentDays + extraDays,
        total: booking.total + totalExtra,
        status: 'Extended',
        details: { ...booking.details, extendedRate: (booking.details.extendedRate || 0) + extraCost, tax: (booking.details.tax || 0) + extraTax }
      }
    });
    
    setExtendingBookingId(null);
    if (extraDays > 0) alert(`Rental updated by ${extraDays} days.\nAdjustment Cost: $${totalExtra.toFixed(2)}`);
  };

  const sendChatMessage = async (bookingId: number, sender: 'client' | 'admin' | 'host') => {
    if (!chatMessage.trim()) return;
    await apiRequest('POST', `/api/bookings/${bookingId}/messages`, { sender, text: chatMessage });
    // Mark messages as read when admin/client/host sends a message (they've seen the conversation)
    await apiRequest('PUT', `/api/bookings/${bookingId}/messages/read`, { reader: sender });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    setChatMessage('');
  };

  const handleExtensionRequestResponse = async (bookingId: number, requestId: string, status: 'approved' | 'rejected') => {
    await apiRequest('PUT', `/api/bookings/${bookingId}/extension-request/${requestId}`, { status });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] });
  };

  const handleDeliveryApproval = async (bookingId: number, status: 'approved' | 'rejected') => {
    await apiRequest('PUT', `/api/bookings/${bookingId}/delivery-approval`, { status });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    toast({
      title: status === 'approved' ? 'Delivery Approved' : 'Delivery Declined',
      description: status === 'approved' 
        ? 'Customer will be notified that delivery is confirmed.' 
        : 'Customer will be notified to pick up the vehicle at the location.',
      variant: status === 'approved' ? 'default' : 'destructive'
    });
  };

  const markMessagesAsRead = async (bookingId: number, reader: 'client' | 'admin' | 'host') => {
    await apiRequest('PUT', `/api/bookings/${bookingId}/messages/read`, { reader });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
  };

  const getUnreadMessagesCount = (booking: Booking, reader: 'client' | 'admin' | 'host') => {
    // Don't count messages for cancelled bookings
    if (booking.status === 'Cancelled') return 0;
    
    const messages = booking.messages || [];
    // For host, filter out host messages; for client, filter out messages from admin/host
    if (reader === 'host') {
      return messages.filter(m => m.sender === 'client' && !m.read).length;
    }
    return messages.filter(m => m.sender !== reader && !m.read).length;
  };

  const getPendingRequestsCount = (booking: Booking) => {
    const requests = booking.extensionRequests || [];
    return requests.filter(r => r.status === 'pending').length;
  };

  const getTotalPendingNotifications = () => {
    return bookings.reduce((acc, b) => {
      // Don't count notifications for cancelled bookings
      if (b.status === 'Cancelled') return acc;
      
      const pendingRequests = (b.extensionRequests || []).filter(r => r.status === 'pending').length;
      const unreadMessages = (b.messages || []).filter(m => m.sender === 'client' && !m.read).length;
      return acc + pendingRequests + unreadMessages;
    }, 0);
  };

  const getClientUnreadCount = () => {
    const userEmail = (authUser?.email || clientUser?.email)?.toLowerCase().trim();
    if (!userEmail) return 0;
    return bookings.filter(b => {
      const bookingEmail = (b.driver as any)?.email?.toLowerCase().trim();
      return bookingEmail && bookingEmail === userEmail && b.status !== 'Cancelled';
    }).reduce((acc, b) => {
      const unread = (b.messages || []).filter(m => m.sender === 'admin' && !m.read).length;
      return acc + unread;
    }, 0);
  };

  const getClientUnreadAdminRepliesCount = () => {
    return supportMessagesData.filter((m: any) => m.senderType === 'client' && m.adminReply && !m.read).length;
  };

  // Mark support messages as read
  const markSupportMessagesAsRead = async () => {
    if (!clientUser) return;
    const unreadMessages = supportMessagesData.filter((m: any) => m.senderType === 'client' && m.adminReply && !m.read);
    for (const msg of unreadMessages) {
      await apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true });
    }
    if (unreadMessages.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
    }
  };

  // Effect to show toast when new admin reply arrives
  useEffect(() => {
    if (!clientUser || view === 'support') return;
    const unread = supportMessagesData.filter((m: any) => m.senderType === 'client' && m.adminReply && !m.read);
    if (unread.length > 0) {
      const lastReply = unread[unread.length - 1];
      toast({
        title: "Nova mensagem do Suporte",
        description: `Resposta sobre: ${lastReply.subject}`,
        onClick: () => setView('support')
      });
    }
  }, [supportMessagesData.length, view]);

  // Effect to mark as read when entering support view
  useEffect(() => {
    if (view === 'support') {
      markSupportMessagesAsRead();
    }
  }, [view]);

  // Generate notifications for client based on Host/Admin actions
  const getClientNotifications = () => {
    if (!clientUser) return [];
    
    const notifications: { id: string; type: string; message: string; timestamp: string; bookingCode: string }[] = [];
    
    // Add admin reply notifications from support messages
    supportMessagesData.filter((m: any) => m.senderType === 'client' && m.adminReply && !m.read).forEach(msg => {
      notifications.push({
        id: `admin-reply-${msg.id}`,
        type: 'admin-reply',
        message: `Suporte: Nova resposta sobre "${msg.subject}"`,
        timestamp: msg.createdAt,
        bookingCode: msg.subject
      });
    });
    
    bookings.filter(b => {
      const bookingEmail = (b.driver as any)?.email?.toLowerCase().trim();
      return bookingEmail && bookingEmail === clientUser.email.toLowerCase().trim() && b.status !== 'Cancelled';
    }).forEach(booking => {
      const vehicle = vehicles.find(v => v.id === booking.vehicleId);
      const carName = vehicle?.model || 'Your vehicle';
      
      // Delivery approval/rejection notifications
      const deliveryStatus = (booking.details as any)?.deliveryApprovalStatus;
      if (deliveryStatus === 'approved') {
        notifications.push({
          id: `delivery-approved-${booking.id}`,
          type: 'delivery-approved',
          message: `Delivery approved for ${carName}`,
          timestamp: booking.startDate,
          bookingCode: booking.bookingCode
        });
      } else if (deliveryStatus === 'rejected') {
        notifications.push({
          id: `delivery-rejected-${booking.id}`,
          type: 'delivery-rejected',
          message: `Delivery declined for ${carName}. Please pick up at location.`,
          timestamp: booking.startDate,
          bookingCode: booking.bookingCode
        });
      }
      
      // Extension request responses
      const extensionRequests = booking.extensionRequests || [];
      extensionRequests.forEach((req: any, idx: number) => {
        if (req.status === 'approved') {
          notifications.push({
            id: `extension-approved-${booking.id}-${idx}`,
            type: 'extension-approved',
            message: `Extension approved for ${carName} until ${req.newReturnDate}`,
            timestamp: req.requestedAt || booking.startDate,
            bookingCode: booking.bookingCode
          });
        } else if (req.status === 'rejected') {
          notifications.push({
            id: `extension-rejected-${booking.id}-${idx}`,
            type: 'extension-rejected',
            message: `Extension request declined for ${carName}`,
            timestamp: req.requestedAt || booking.startDate,
            bookingCode: booking.bookingCode
          });
        }
      });
      
      // Check-in completed
      if (booking.checkInStatus === 'completed') {
        notifications.push({
          id: `checkin-${booking.id}`,
          type: 'checkin',
          message: `Check-in completed for ${carName}. Enjoy your trip!`,
          timestamp: booking.startDate,
          bookingCode: booking.bookingCode
        });
      }
      
      // Check-out completed
      if (booking.checkOutStatus === 'completed') {
        notifications.push({
          id: `checkout-${booking.id}`,
          type: 'checkout',
          message: `Check-out completed for ${carName}. Thank you!`,
          timestamp: booking.returnDate,
          bookingCode: booking.bookingCode
        });
      }
    });
    
    return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getUnreadNotificationsCount = () => {
    const notifications = getClientNotifications();
    return notifications.filter(n => !readNotificationIds.includes(n.id)).length;
  };

  const markNotificationsAsRead = () => {
    const notifications = getClientNotifications();
    const allIds = notifications.map(n => n.id);
    const idSet = new Set([...readNotificationIds, ...allIds]);
    const newReadIds = Array.from(idSet);
    setReadNotificationIds(newReadIds);
    localStorage.setItem('carhop_read_notifications', JSON.stringify(newReadIds));
  };

  const handleApplyDiscount = async (booking: Booking) => {
    if (!adjustment.value || parseFloat(adjustment.value) <= 0) {
      alert("Please enter a valid discount value.");
      return;
    }
    
    let discountAmount = parseFloat(adjustment.value);
    
    if (adjustment.type === 'percent') {
      discountAmount = (booking.total * discountAmount) / 100;
    }
    
    const currentDiscount = booking.details.discount || 0;
    const newDiscount = currentDiscount + discountAmount;
    const newTotal = booking.total - discountAmount;
    
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: {
        total: Math.max(0, newTotal),
        details: { ...booking.details, discount: newDiscount }
      }
    });
    
    setAdjustment({ type: 'fixed', value: '' });
    alert(`Discount of $${discountAmount.toFixed(2)} applied successfully!`);
  };

  const handleDeleteBooking = (bookingId: string) => {
    apiRequest('DELETE', `/api/bookings/${bookingId}`)
      .then(() => {
        setDeletingBookingId(null);
        setManageBookingId(null);
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      })
      .catch(err => console.error('Error deleting booking:', err));
  };

  const handleAddCharge = async (booking: Booking) => {
    if (!extraCharge.amount || parseFloat(extraCharge.amount) <= 0) {
      alert("Please enter a valid charge amount.");
      return;
    }
    
    const chargeAmount = parseFloat(extraCharge.amount);
    const chargeTypeLabels: Record<string, string> = {
      'refuel': 'Refuel',
      'mileage': 'Extra Mileage',
      'damage': 'Damage',
      'cleaning': 'Extra Cleaning',
      'other': 'Other Charge'
    };
    
    const chargeLabel = chargeTypeLabels[extraCharge.type] || extraCharge.type;
    const currentCharges = booking.details.manualCharges || [];
    const newCharge = { type: chargeLabel, amount: chargeAmount };
    const newTotal = booking.total + chargeAmount;
    
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: {
        total: newTotal,
        details: { ...booking.details, manualCharges: [...currentCharges, newCharge] }
      }
    });
    
    setExtraCharge({ type: 'Refuel', amount: '' });
    alert(`Charge of $${chargeAmount.toFixed(2)} (${chargeLabel}) added successfully!`);
  };

  const handleRemoveDiscount = async (booking: Booking) => {
    const discountAmount = booking.details.discount || 0;
    if (discountAmount <= 0) return;
    
    const newTotal = booking.total + discountAmount;
    
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: {
        total: newTotal,
        details: { ...booking.details, discount: 0 }
      }
    });
  };

  const handleRemoveCharge = async (booking: Booking, chargeIndex: number) => {
    const currentCharges = booking.details.manualCharges || [];
    if (chargeIndex < 0 || chargeIndex >= currentCharges.length) return;
    
    const chargeToRemove = currentCharges[chargeIndex];
    const newCharges = currentCharges.filter((_, i) => i !== chargeIndex);
    const newTotal = booking.total - chargeToRemove.amount;
    
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: {
        total: Math.max(0, newTotal),
        details: { ...booking.details, manualCharges: newCharges }
      }
    });
  };

  const handleChargeExtraPayment = async (booking: Booking) => {
    const amount = parseFloat(extraPaymentAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid amount to charge.");
      return;
    }
    
    try {
      const response = await apiRequest('POST', `/api/bookings/${booking.id}/charge-extra`, {
        type: 'Extra Payment Trip',
        amount,
        description: `Extra charge for booking ${booking.bookingCode} - Client: ${booking.driver.name}`
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
        setExtraPaymentAmount('');
        alert(`Payment of $${amount.toFixed(2)} charged successfully to ${booking.paymentMethod || 'Credit Card'}!\n\nClient: ${booking.driver.name}\nBooking: ${booking.bookingCode}`);
      }
    } catch (error) {
      alert("Failed to process payment. Please try again.");
    }
  };

  const calculateExtraChargesTotal = (booking: Booking): number => {
    const manualCharges = booking.details.manualCharges || [];
    const existingPayments = booking.extraPayments || [];
    const chargedTotal = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingCharges = manualCharges.reduce((sum, c) => sum + c.amount, 0);
    return Math.max(0, pendingCharges - chargedTotal);
  };

  const handleSaveVehicle = () => {
    // Validate required fields
    const missingFields = [];
    
    if (!formData.model || formData.model.trim() === '') {
      missingFields.push('Car Model');
    }
    if (!formData.category || formData.category.trim() === '') {
      missingFields.push('Category');
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      missingFields.push('Daily Rate');
    }
    if (!formData.fuel || formData.fuel.trim() === '') {
      missingFields.push('Fuel Type');
    }
    if (!formData.seats || String(formData.seats).trim() === '') {
      missingFields.push('Seats');
    }
    if (!formData.transmission || formData.transmission.trim() === '') {
      missingFields.push('Transmission');
    }
    
    if (missingFields.length > 0) {
      toast({ 
        description: `Por favor, preencha os campos obrigatórios: ${missingFields.join(', ')}`, 
        variant: 'destructive' 
      });
      return;
    }

    const vehicleData = {
      model: formData.model,
      year: parseInt(formData.year.toString()) || new Date().getFullYear(),
      vinNumber: formData.vinNumber,
      licensePlate: formData.licensePlate,
      hostName: formData.hostName,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      fuel: formData.fuel,
      seats: formData.seats,
      transmission: formData.transmission,
      driveType: formData.driveType,
      images: formData.images.filter(img => img.trim() !== ''),
      consumption: formData.consumption,
      isPriceMatch: formData.isPriceMatch,
      isAWD: formData.isAWD,
      hasCarPlay: formData.hasCarPlay,
      hasBluetooth: formData.hasBluetooth,
      hasReverseCamera: formData.hasReverseCamera,
      hasHeatedSeats: formData.hasHeatedSeats,
      hasHeatedSteering: formData.hasHeatedSteering,
      hasElectricSeats: formData.hasElectricSeats,
      hasPaddleShifters: formData.hasPaddleShifters,
      hasKeylessEntry: formData.hasKeylessEntry,
      hasBlindSpotWarning: formData.hasBlindSpotWarning,
      hasDriveAssist: formData.hasDriveAssist,
      hasUSBCharger: formData.hasUSBCharger,
      availableLocations: formData.availableLocations || [],
      locationLat: formData.locationLat || null,
      locationLon: formData.locationLon || null,
      isDeliveryEnabled: formData.isDeliveryEnabled || false,
      maxDeliveryDistance: formData.maxDeliveryDistance || 50,
      minDeliveryFeeMiles: formData.minDeliveryFeeMiles || 5,
      minDeliveryFee: formData.minDeliveryFee || 15,
      deliveryPricePerMile: formData.deliveryPricePerMile || 2.50,
      minDeliveryHours: formData.minDeliveryHours || 6,
      pricing: formData.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}
    };

    if (editingId) {
      updateVehicleMutation.mutate({ id: editingId, data: vehicleData }, {
        onSuccess: () => {
          setEditingId(null);
          setFormData(initialFormState);
          setPricingStrings(defaultPricingStrings);
          toast({ description: "Vehicle updated successfully!" });
        },
        onError: () => {
          toast({ description: "Failed to update vehicle", variant: "destructive" });
        }
      });
    } else {
      createVehicleMutation.mutate(vehicleData, {
        onSuccess: () => {
          setShowAddVehicleForm(false);
          setFormData(initialFormState);
          setPricingStrings(defaultPricingStrings);
          toast({ description: "Vehicle created successfully!" });
        },
        onError: () => {
          toast({ description: "Failed to create vehicle", variant: "destructive" });
        }
      });
    }
  };

  const handleEditVehicle = (car: Vehicle) => {
    const pricing = car.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}};
    setFormData({
      ...initialFormState,
      ...car,
      year: (car as any).year || new Date().getFullYear(),
      vinNumber: (car as any).vinNumber || '',
      licensePlate: (car as any).licensePlate || '',
      price: car.price ? car.price.toString() : '',
    } as any);
    setPricingStrings({
      taxes: String(pricing.taxes || '8.5'),
      extraMileRate: String(pricing.extraMileRate || '0.45'),
      childSeat: String(pricing.prices?.childSeat || '8'),
      prepaidFuel: String(pricing.prices?.prepaidFuel || '35'),
      lateReturnGrace: String(pricing.prices?.lateReturnGrace || '25'),
      stressFreePackage: String(pricing.prices?.stressFreePackage || '50'),
      cleaningFee: String(pricing.cleaningFee || '25'),
      includedMiles: String(pricing.includedMiles || '200'),
      insurance500: String(pricing.prices?.insurance500 || '25'),
      insurance1000: String(pricing.prices?.insurance1000 || '15'),
    });
    setEditingId(car.id);
    window.scrollTo(0, 0);
  };

  const addLocationToVehicle = () => { 
    if (!newLocation.trim()) {
      toast({ title: "Erro", description: "Por favor, digite um endereço", variant: "destructive" });
      return;
    }
    if (!editingHostVehicle) {
      toast({ title: "Erro", description: "Nenhum veículo selecionado", variant: "destructive" });
      return;
    }
    const current = editingHostVehicle.availableLocations || [];
    if (current.includes(newLocation.trim())) {
      toast({ title: "Aviso", description: "Este endereço já foi adicionado", variant: "default" });
      return;
    }
    setEditingHostVehicle({...editingHostVehicle, availableLocations: [...current, newLocation.trim()]});
    toast({ title: "Sucesso", description: "Endereço adicionado! Clique em 'Salvar Locações' para confirmar", });
    setNewLocation(''); 
  };

  const addLocation = async () => { 
    if (!newLocation.trim()) {
      toast({ title: "Erro", description: "Por favor, digite um endereço", variant: "destructive" });
      return;
    }
    const current = settings.locations || [];
    if (current.includes(newLocation.trim())) {
      toast({ title: "Aviso", description: "Este endereço já foi adicionado", variant: "default" });
      return;
    }
    
    let coords = newLocationCoords;
    if (!coords) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newLocation.trim())}&countrycodes=us&limit=1`);
        const data = await response.json();
        if (data && data[0]) {
          coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) { console.error('Geocoding error:', e); }
    }
    
    if (coords && (!formData.locationLat || !formData.locationLon)) {
      setFormData({...formData, locationLat: coords.lat, locationLon: coords.lon});
    }
    
    updateSettingMutation.mutate({ key: 'locations', value: [...current, newLocation.trim()] });
    toast({ title: "Sucesso", description: "Endereço adicionado com sucesso!", });
    setNewLocation('');
    setNewLocationCoords(null);
  };

  const removeLocation = (locToRemove: string) => { 
    updateSettingMutation.mutate({ key: 'locations', value: settings.locations.filter(l => l !== locToRemove) });
  };

  if (vehiclesLoading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-black text-green-600"><Loader className="animate-spin" size={32} /> Loading CarHopGo...</div>;

  return (
    <div className={darkMode ? "dark" : ""}>
      <style>{` @page { size: letter; margin: 0.10in 0.10in 0.10in 0.10in; } @media print { body { margin: 0 !important; padding: 0 !important; } body * { visibility: hidden; margin: 0 !important; padding: 0 !important; } .printable-receipt, .printable-receipt *, .printable-agreement, .printable-agreement * { visibility: visible !important; margin: 0 !important; padding: 0 !important; } .printable-receipt, .printable-agreement { display: block !important; width: 100% !important; max-width: 100% !important; color: black !important; font-size: 8pt; line-height: 1.15; background: white !important; box-sizing: border-box !important; padding: 0 0.05in !important; margin: 0 !important; } .no-print, .no-print * { display: none !important; visibility: hidden !important; } } `}</style>
    <div className="min-h-screen bg-gray-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-green-500 selection:text-white transition-colors duration-300 overflow-x-hidden">
      
      <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex justify-between items-center gap-2">
          <div className="flex items-center gap-1 sm:gap-2 cursor-pointer flex-shrink-0" onClick={() => setView('home')} data-testid="link-home">
            <div className="bg-green-600 p-1 sm:p-1.5 rounded-lg flex items-center justify-center"><Car className="text-white w-5 h-5 sm:w-6 sm:h-6" /></div>
            <span className="text-base sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">CarHop<span className="text-green-600">Go</span></span>
          </div>
          <div className="hidden md:flex items-center gap-4 lg:gap-8 text-xs lg:text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <button onClick={handleManageBookingClick} className="hover:text-green-600 dark:hover:text-white transition-colors font-bold text-xs uppercase tracking-wide" data-testid="button-manage-booking">Manage Booking</button>
            {clientUser ? (
              <div className="flex items-center gap-3">
                {/* Notifications Bell */}
                <div className="relative" ref={notificationsRef}>
                  <button 
                    onClick={() => { setNotificationsOpen(!notificationsOpen); if (!notificationsOpen) markNotificationsAsRead(); }} 
                    className="relative p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" 
                    data-testid="button-notifications" 
                    title="Notifications"
                  >
                    <Bell size={18}/>
                    {(getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount()) > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{(getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount()) > 9 ? '9+' : (getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount())}</span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Notifications</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {getClientNotifications().length === 0 ? (
                          <div className="px-4 py-8 text-center text-zinc-500 text-sm">No notifications yet</div>
                        ) : (
                          getClientNotifications().slice(0, 10).map(notification => (
                            <div key={notification.id} className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 p-1.5 rounded-full ${
                                  notification.type.includes('approved') ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                                  notification.type.includes('rejected') ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                }`}>
                                  {notification.type.includes('delivery') ? <Navigation size={12}/> :
                                   notification.type.includes('extension') ? <CalendarClock size={12}/> :
                                   notification.type.includes('checkin') ? <Check size={12}/> :
                                   <Check size={12}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-900 dark:text-white">{notification.message}</p>
                                  <p className="text-xs text-zinc-500 mt-1">Booking: {notification.bookingCode}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {getClientNotifications().length > 0 && (
                        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                          <button onClick={() => { setNotificationsOpen(false); setView('bookings'); }} className="text-xs text-green-600 hover:text-green-500 font-medium">View All Bookings</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-green-600 font-bold" data-testid="text-username">Hi, {clientUser.name}</span>
                <button onClick={handleSignOut} className="text-xs border px-2 py-1 rounded hover:bg-zinc-800" data-testid="button-signout"><LogOut size={12}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white dark:hover:text-black transition-all uppercase text-xs font-bold tracking-wider" data-testid="button-signin">Sign In</button>
              </div>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="hover:text-green-600 dark:hover:text-white transition-colors" title="Toggle Theme" data-testid="button-theme-toggle">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            {/* Desktop Contact Support Button (only when NOT logged in as host) */}
            {!(view === 'host-dashboard' && currentHost) && (
              <button 
                onClick={() => {
                  if (clientUser) {
                    setClientChatForm(prev => ({ ...prev, name: clientUser.name, email: clientUser.email, phone: clientUser.phone || '' }));
                  }
                  setShowClientChatModal(true);
                }}
                className="hidden sm:flex p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors relative"
                data-testid="button-desktop-chat"
              >
                <MessageCircle size={20} className={getClientUnreadAdminRepliesCount() > 0 ? "text-red-500 animate-pulse" : "text-zinc-600 dark:text-zinc-400"} />
                {getClientUnreadAdminRepliesCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                    {getClientUnreadAdminRepliesCount()}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => {
              if (adminAuthenticated) {
                setView('admin');
              } else {
                setShowAdminPasswordModal(true);
                setAdminPasswordInput('');
                setAdminPasswordError('');
              }
            }} className="text-zinc-400 hover:text-white" data-testid="button-admin"><Lock size={16}/></button>
          </div>

          <div className="flex md:hidden items-center justify-end gap-1 sm:gap-2 flex-1">
            {clientUser && (
              <>
                <button onClick={() => { setView('bookings'); }} className="relative p-1 sm:p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors text-xs font-bold" data-testid="button-mobile-bookings">My Bookings
                  {(getClientUnreadCount() + getClientUnreadAdminRepliesCount()) > 0 && (
                    <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{(getClientUnreadCount() + getClientUnreadAdminRepliesCount()) > 9 ? '9+' : (getClientUnreadCount() + getClientUnreadAdminRepliesCount())}</span>
                  )}
                </button>
                {/* Mobile Notifications Bell */}
                <div className="relative" ref={notificationsRef}>
                  <button 
                    onClick={() => { setNotificationsOpen(!notificationsOpen); if (!notificationsOpen) markNotificationsAsRead(); }} 
                    className="relative p-1 sm:p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" 
                    data-testid="button-mobile-notifications"
                  >
                    <Bell size={18}/>
                    {(getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount()) > 0 && (
                      <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{(getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount()) > 9 ? '9+' : (getUnreadNotificationsCount() + getClientUnreadAdminRepliesCount())}</span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Notifications</h3>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {getClientNotifications().length === 0 ? (
                          <div className="px-4 py-6 text-center text-zinc-500 text-sm">No notifications yet</div>
                        ) : (
                          getClientNotifications().slice(0, 8).map(notification => (
                            <div key={notification.id} className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-start gap-2">
                                <div className={`mt-0.5 p-1 rounded-full ${
                                  notification.type.includes('approved') ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                                  notification.type.includes('rejected') ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                }`}>
                                  {notification.type.includes('delivery') ? <Navigation size={10}/> :
                                   notification.type.includes('extension') ? <CalendarClock size={10}/> :
                                   <Check size={10}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-zinc-900 dark:text-white">{notification.message}</p>
                                  <p className="text-[10px] text-zinc-500 mt-0.5">{notification.bookingCode}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            {/* Desktop Contact Support Button (only when NOT logged in as host) */}
            {!(view === 'host-dashboard' && currentHost) && (
              <button 
                onClick={() => {
                  if (clientUser) {
                    setClientChatForm(prev => ({ ...prev, name: clientUser.name, email: clientUser.email, phone: clientUser.phone || '' }));
                  }
                  setShowClientChatModal(true);
                }}
                className="hidden sm:flex p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors relative"
                data-testid="button-desktop-chat"
              >
                <MessageCircle size={20} className={getClientUnreadAdminRepliesCount() > 0 ? "text-red-500 animate-pulse" : "text-zinc-600 dark:text-zinc-400"} />
                {getClientUnreadAdminRepliesCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                    {getClientUnreadAdminRepliesCount()}
                  </span>
                )}
              </button>
            )}
            {!(view === 'host-dashboard' && currentHost) && (
            <div className="relative sm:hidden" ref={mobileActionsMenuRef}>
              <button onClick={() => setMobileActionsMenuOpen(!mobileActionsMenuOpen)} className="p-1 sm:p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" data-testid="button-actions-menu">
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              {mobileActionsMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-[150px] overflow-hidden">
                  {clientUser ? (
                    <>
                      <div className="w-full px-4 py-2 text-center text-sm text-green-600 font-bold flex items-center justify-center gap-2">Hi, {clientUser.name.split(' ')[0]}</div>
                      <button onClick={() => { setView('bookings'); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-bookings"><Briefcase className="h-4 w-4" />My Bookings</button>
                      <button onClick={() => { 
                        if (clientUser) {
                          setClientChatForm(prev => ({ ...prev, name: clientUser.name, email: clientUser.email, phone: clientUser.phone || '' }));
                        }
                        setShowClientChatModal(true);
                        setMobileActionsMenuOpen(false); 
                      }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-chat-logged">
                        <MessageCircle className={`h-4 w-4 ${getClientUnreadAdminRepliesCount() > 0 ? "text-red-500 animate-pulse" : ""}`} />
                        <span>Chat</span>
                        {getClientUnreadAdminRepliesCount() > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{getClientUnreadAdminRepliesCount()}</span>
                        )}
                      </button>
                      <button onClick={() => { setShowProfileModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-profile"><User className="h-4 w-4" />Edit Profile</button>
                      <button onClick={() => { setDarkMode(!darkMode); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-theme">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
                      <button onClick={() => { handleSignOut(); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 text-red-600 dark:text-red-400" data-testid="button-menu-logout"><LogOut className="h-4 w-4" />Logout</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setShowLoginModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-2" data-testid="button-menu-signin">Sign In</button>
                      <button onClick={() => { setShowClientChatModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-chat"><MessageCircle className="h-4 w-4" />Chat / Support</button>
                      <button onClick={() => { setDarkMode(!darkMode); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-theme">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
                    </>
                  )}
                </div>
              )}
            </div>
            )}
            {/* Host Menu - Large hamburger with Edit Profile and Logout (only when logged in as host) */}
            {view === 'host-dashboard' && currentHost && (
              <div className="relative sm:hidden" ref={hostMobileMenuRef}>
                <button 
                  onClick={() => setHostMobileMenuOpen(!hostMobileMenuOpen)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  data-testid="button-host-mobile-menu"
                >
                  <Menu size={24} />
                </button>
                {hostMobileMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-[200px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentHost.firstName} {currentHost.lastName}</p>
                      <p className="text-xs text-zinc-500">@{currentHost.username}</p>
                    </div>
                    <button 
                      onClick={() => { 
                        setHostTab('chat'); 
                        setHostMobileMenuOpen(false); 
                      }} 
                      className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800"
                      data-testid="button-host-menu-support"
                    >
                      <MessageCircle size={18} className="text-green-600" />
                      <span>Chat / Support</span>
                      {(() => {
                        const hostEmail = currentHost?.email || '';
                        const hostUsername = currentHost?.username || '';
                        const unreadCount = supportMessagesData.filter((m: any) => 
                          m.senderType === 'host' && 
                          (m.senderIdentifier === hostEmail || m.senderIdentifier === `@${hostUsername}` || m.senderEmail === hostEmail) && 
                          m.adminReply && !m.read
                        ).length;
                        return unreadCount > 0 ? (
                          <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">!</span>
                        ) : null;
                      })()}
                    </button>
                    <button 
                      onClick={() => { 
                        setHostEditProfileForm({
                          phone: currentHost.phone || '',
                          email: currentHost.email || '',
                          licenseFrontImage: currentHost.licenseFrontImage || '',
                          licenseBackImage: currentHost.licenseBackImage || ''
                        });
                        setShowHostEditProfileModal(true); 
                        setHostMobileMenuOpen(false); 
                      }} 
                      className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800"
                      data-testid="button-host-menu-edit-profile"
                    >
                      <User size={18} className="text-blue-600" />
                      <span>Edit Profile</span>
                    </button>
                    <button 
                      onClick={() => { setDarkMode(!darkMode); setHostMobileMenuOpen(false); }} 
                      className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800"
                      data-testid="button-host-menu-theme"
                    >
                      {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                      <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentHost(null); setView('home'); setHostMobileMenuOpen(false); }} 
                      className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-3 text-red-600 font-bold"
                      data-testid="button-host-menu-logout"
                    >
                      <LogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {selectedImage && <ImageViewer src={selectedImage} onClose={() => setSelectedImage(null)} />}

      {showAdminPasswordModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => { setShowAdminPasswordModal(false); setAdminPasswordInput(''); setAdminPasswordError(''); }} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-admin-password-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Admin Access</h2>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (adminPasswordInput === 'xablau321') {
                setAdminAuthenticated(true);
                setShowAdminPasswordModal(false);
                setAdminPasswordInput('');
                setAdminPasswordError('');
                setView('admin');
              } else {
                setAdminPasswordError('Incorrect password');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Password</label>
                <input 
                  type="password" 
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminPasswordError('');
                  }}
                  placeholder="Enter admin password" 
                  required 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                  data-testid="input-admin-password" 
                  autoFocus
                />
              </div>
              {adminPasswordError && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-3 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">{adminPasswordError}</p>
                </div>
              )}
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-submit-admin-password">Access Admin Panel</Button>
            </form>
          </div>
        </div>
      )}

      {isProcessingPayment && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4 text-center">
          <Car size={64} className="text-green-600 animate-bounce mb-6" />
          <div className="flex items-center gap-3 text-white text-xl font-bold mb-2"><Loader className="animate-spin"/> Processing payment...</div>
          <p className="text-zinc-400 text-sm">Please wait while we secure your vehicle.</p>
        </div>
      )}
      
      {showClientChatModal && (() => {
        const userEmail = clientUser?.email || clientChatForm.email;
        const clientMessages = supportMessagesData.filter((m: any) => 
          m.senderType === 'client' && (m.senderIdentifier === userEmail || m.senderId === userEmail)
        ).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const hasMessages = clientMessages.length > 0;
        const defaultTab = hasMessages ? 'history' : 'new';
        const activeTab = clientChatTab || defaultTab;
        const isLoggedIn = !!clientUser;
        
        // Count unread admin replies for Conversations badge
        const unreadAdminRepliesCount = clientMessages.filter((m: any) => m.adminReply && !m.read).length;
        const conversationsCount = clientMessages.length;
        
        // Show login screen if not logged in and not already showing form
        if (!isLoggedIn && !showChatLoginScreen) {
          return (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 flex flex-col">
                <button onClick={() => { setShowClientChatModal(false); setShowChatLoginScreen(false); }} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-chat-modal"><X size={20}/></button>
                
                <h2 className="text-xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Sign In to Contact Us</h2>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 text-center">Please log in to your account or create a new one to send us a message.</p>
                
                <button onClick={() => { setShowLoginModal(true); }} className="w-full mb-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all" data-testid="button-signin-chat">
                  Sign In
                </button>
                
                <button onClick={() => { setShowSignupModal(true); }} className="w-full mb-3 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all" data-testid="button-signup-chat">
                  Create Account
                </button>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-300 dark:border-zinc-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">or</span>
                  </div>
                </div>
                
                <button onClick={() => { setShowChatLoginScreen(true); }} className="w-full py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold rounded-lg transition-all" data-testid="button-guest-chat">
                  Continue as Guest
                </button>
              </div>
            </div>
          );
        }
        
        return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto flex flex-col">
            <button onClick={() => { setShowClientChatModal(false); setClientChatForm({ name: '', email: '', phone: '', subject: 'Talk with Support', message: '' }); setClientChatImages([]); setClientChatTab('new'); setClientChatReply(''); setShowChatLoginScreen(false); }} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-chat-modal"><X size={20}/></button>
            
            <h2 className="text-xl font-bold mb-4 text-center text-zinc-900 dark:text-white flex items-center justify-center gap-2">
              <MessageCircle className="text-green-500" size={24}/> Contact Us
            </h2>
            
            {hasMessages && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setClientChatTab('history')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                  data-testid="button-chat-history"
                >
                  Conversations
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded min-w-max ${unreadAdminRepliesCount > 0 ? 'bg-red-600 text-white' : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-500'}`}>
                    {conversationsCount}
                  </span>
                </button>
                <button
                  onClick={() => setClientChatTab('new')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'new' ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}
                  data-testid="button-chat-new"
                >
                  New Chat
                </button>
              </div>
            )}

            {activeTab === 'history' && clientMessages.length > 0 && (() => {
              const unreadReplies = clientMessages.filter((m: any) => m.adminReply && !m.read);
              if (unreadReplies.length > 0) {
                unreadReplies.forEach((msg: any) => {
                  apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true }).catch(err => console.error('Error marking as read:', err));
                });
              }
              
              // Group by subject + timestamp (each chat session is separate, even with same subject)
              const groupedMessages: Record<string, any[]> = {};
              clientMessages.forEach((msg: any) => {
                const subject = msg.subject || 'No Subject';
                
                // Find existing non-finished group with same subject
                const existingGroupKey = Object.keys(groupedMessages).find(
                  key => key.startsWith(subject + "_")
                );
                
                if (existingGroupKey) {
                  // Add to existing active group
                  groupedMessages[existingGroupKey].push(msg);
                } else {
                  // Create new session group with subject + timestamp
                  const groupKey = subject + "_" + new Date(msg.createdAt).getTime();
                  if (!groupedMessages[groupKey]) groupedMessages[groupKey] = [];
                  groupedMessages[groupKey].push(msg);
                }
              });
              
              const sortedGroups = Object.entries(groupedMessages).sort((a, b) => new Date(b[1][0].createdAt).getTime() - new Date(a[1][0].createdAt).getTime());
              
              return (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {sortedGroups.map(([groupKey, groupMsgs]) => {
                  const isExpanded = expandedClientChatGroups.has(groupKey);
                  const isFinished = groupMsgs.every((m: any) => m.isFinished);
                  const subject = groupKey.split("_")[0];
                  const dateTime = new Date(groupMsgs[groupMsgs.length - 1].createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
                  const hasUnread = groupMsgs.some((m: any) => m.adminReply && !m.read);
                  
                  if (isFinished) {
                    return (
                      <div key={groupKey} className="border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                        <div className="px-3 py-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{subject}</span>
                          <span className="text-xs text-zinc-500">• {dateTime}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded ml-auto">Finished</span>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={groupKey} className={`border rounded-lg overflow-hidden ${hasUnread ? 'border-orange-500 shadow-sm' : 'border-zinc-200 dark:border-zinc-700'}`}>
                      <button 
                        onClick={async () => {
                          const newSet = new Set(expandedClientChatGroups);
                          const isCurrentlyExpanded = newSet.has(groupKey);
                          
                          if (!isCurrentlyExpanded && hasUnread && !isFinished) {
                            const unreadMsgs = groupMsgs.filter((m: any) => m.adminReply && !m.read);
                            for (const msg of unreadMsgs) {
                              await apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true }).catch(err => console.error('Error marking as read:', err));
                            }
                            queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                          }
                          
                          if (isCurrentlyExpanded) newSet.delete(groupKey);
                          else newSet.add(groupKey);
                          setExpandedClientChatGroups(newSet);
                        }}
                        className={`w-full px-3 py-2 flex items-center justify-between transition-colors ${hasUnread ? 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <span className={`text-xs font-bold ${hasUnread ? 'text-orange-600 dark:text-orange-400 animate-pulse' : 'text-zinc-900 dark:text-white'}`}>{subject}</span>
                          <span className="text-xs text-zinc-500">• {dateTime}</span>
                          {hasUnread && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                        </div>
                        {hasUnread && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded shadow-sm">
                            {groupMsgs.filter((m: any) => m.adminReply && !m.read).length}
                          </span>
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="p-3 space-y-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
                          <div className="space-y-2">
                            {groupMsgs.map((msg: any, idx: number) => {
                              const messageText = msg.text || '';
                              const phoneMatch = messageText.match(/Telefone:\s*(.*?)(?:\n|$)/);
                              const phone = phoneMatch ? phoneMatch[1] : '';
                              const cleanText = messageText.replace(/\[.*?\]/, '').replace(/Telefone:.*?(?:\n|$)/, '').replace(/Não informado/, '').trim();
                              
                              return (
                                <div key={msg.id} className="space-y-1 pb-2 border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                                  {idx !== 0 && (
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs text-zinc-500">
                                        {new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  )}
                                  {idx === 0 && phone && phone !== 'Não informado' && (
                                    <div className="flex justify-end">
                                      <span className="text-xs text-zinc-600 dark:text-zinc-400">{phone}</span>
                                    </div>
                                  )}
                                  <p className="text-sm text-zinc-900 dark:text-white whitespace-pre-wrap line-clamp-2">{cleanText}</p>
                                  {msg.adminReply && (
                                    <div className={`mt-1 p-2 border rounded text-xs ${!msg.read ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 font-medium' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'}`}>
                                      <span className="font-bold">Admin: </span>{msg.adminReply.substring(0, 60)}...
                                      {!msg.read && <span className="ml-2 inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {finishingChatGroup === groupKey ? (
                            <div className="w-full p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded space-y-2">
                              <p className="text-xs font-bold text-yellow-900 dark:text-yellow-300">Finish this conversation? It cannot be reopened.</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setFinishingChatGroup(null)}
                                  className="flex-1 px-2 py-1 bg-zinc-400 hover:bg-zinc-500 text-white font-bold rounded text-xs"
                                  data-testid={`button-cancel-finish-chat-${groupKey}`}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const subjectFromGroup = groupKey.split("_")[0];
                                      const chatStartedAtFromGroup = groupMsgs[0]?.chatStartedAt;
                                      await apiRequest('POST', '/api/support-messages/finish-group', {
                                        subject: subjectFromGroup,
                                        senderId: userEmail,
                                        finishedBy: 'client',
                                        chatStartedAt: chatStartedAtFromGroup
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                      const newExpanded = new Set(expandedClientChatGroups);
                                      newExpanded.delete(groupKey);
                                      setExpandedClientChatGroups(newExpanded);
                                      setFinishingChatGroup(null);
                                      toast({ description: 'Chat finished. All messages closed.' });
                                    } catch (error) {
                                      toast({ description: 'Error finishing chat', variant: 'destructive' });
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded text-xs"
                                  data-testid={`button-confirm-finish-chat-${groupKey}`}
                                >
                                  Confirm
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setFinishingChatGroup(groupKey)}
                              className="w-full px-2 py-1.5 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-bold rounded text-xs flex items-center justify-center gap-1"
                              data-testid={`button-finish-chat-${groupKey}`}
                            >
                              <CheckCircle size={14} /> Finish Chat
                            </button>
                          )}
                          
                          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                            <textarea
                              value={clientChatReply}
                              onChange={(e) => setClientChatReply(e.target.value)}
                              placeholder="Reply to this subject..."
                              className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm resize-none"
                              rows={2}
                            />
                            <button
                              onClick={async () => {
                                if (!clientChatReply.trim()) return;
                                try {
                                  await apiRequest('POST', '/api/support-messages', {
                                    senderType: 'client',
                                    senderId: userEmail,
                                    senderName: clientUser?.name || 'Client',
                                    senderIdentifier: userEmail,
                                    subject: subject,
                                    text: clientChatReply,
                                    images: []
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                  setClientChatReply('');
                                  toast({ description: 'Reply sent!' });
                                } catch (error) {
                                  toast({ description: 'Error sending reply', variant: 'destructive' });
                                }
                              }}
                              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2"
                            >
                              <Send size={14} /> Send
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
            })()}

            {activeTab === 'new' && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!clientChatForm.name.trim() || !clientChatForm.email.trim() || !clientChatForm.message.trim()) {
                toast({ description: 'Por favor, preencha todos os campos obrigatórios', variant: 'destructive' });
                return;
              }
              setClientChatSending(true);
              try {
                const messagePayload = {
                  senderType: 'client',
                  senderId: clientChatForm.email,
                  senderName: clientChatForm.name,
                  senderIdentifier: clientChatForm.email,
                  subject: clientChatForm.subject,
                  text: clientChatForm.message,
                  images: clientChatImages
                };
                console.log('📨 Enviando mensagem:', messagePayload);
                await apiRequest('POST', '/api/support-messages', messagePayload);
                queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                toast({ description: 'Message sent successfully! We will contact you soon.' });
                setShowClientChatModal(false);
                setClientChatTab('history');
                setClientChatForm({ name: '', email: '', phone: '', subject: 'Talk with Support', message: '' });
                setClientChatImages([]);
              } catch (error) {
                toast({ description: 'Error sending message. Please try again.', variant: 'destructive' });
              } finally {
                setClientChatSending(false);
              }
            }} className="space-y-4">
              {!clientUser && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={clientChatForm.name}
                      onChange={(e) => setClientChatForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                      required
                      data-testid="input-chat-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Email *</label>
                    <input
                      type="email"
                      value={clientChatForm.email}
                      onChange={(e) => setClientChatForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                      required
                      data-testid="input-chat-email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={clientChatForm.phone}
                      onChange={(e) => setClientChatForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(000) 000-0000"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                      data-testid="input-chat-phone"
                    />
                  </div>
                </>
              )}
              
              {clientUser && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center gap-3">
                  <User className="text-green-600" size={20}/>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{clientChatForm.name || clientUser.name}</p>
                    <p className="text-xs text-zinc-500">{clientChatForm.email || clientUser.email}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Subject *</label>
                <select
                  value={clientChatForm.subject}
                  onChange={(e) => setClientChatForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  data-testid="select-chat-subject"
                >
                  <option value="Talk with Support">Talk with Support</option>
                  <option value="Report an Issue">Report an Issue</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Message *</label>
                <textarea
                  value={clientChatForm.message}
                  onChange={(e) => setClientChatForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm resize-none"
                  rows={4}
                  required
                  data-testid="textarea-chat-message"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Attachments (optional)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {clientChatImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16">
                      <img src={img} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-zinc-300 dark:border-zinc-700"/>
                      <button type="button" onClick={() => setClientChatImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={12}/></button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-green-500 transition-colors">
                  <Upload size={18} className="text-zinc-500"/>
                  <span className="text-sm text-zinc-500">Add Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        Array.from(files).forEach(file => {
                          if (file.size > 5 * 1024 * 1024) {
                            toast({ description: 'File too large. Maximum 5MB per image.', variant: 'destructive' });
                            return;
                          }
                          if (!file.type.startsWith('image/')) {
                            toast({ description: 'Only images are allowed.', variant: 'destructive' });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              setClientChatImages(prev => [...prev, ev.target!.result as string]);
                            }
                          };
                          reader.onerror = () => {
                            toast({ description: 'Error loading image.', variant: 'destructive' });
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                    data-testid="input-chat-attachments"
                  />
                </label>
              </div>
              
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3" disabled={clientChatSending} data-testid="button-send-chat">
                {clientChatSending ? <><Loader size={18} className="animate-spin"/> Sending...</> : <><Send size={18}/> Send Message</>}
              </Button>
            </form>
            )}
          </div>
        </div>
        );
      })()}

      {showLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Sign In to CarHop<span className="text-green-600">Go</span></h2>
            
            <div className="space-y-3 mb-6">
              <Button 
                variant="secondary" 
                className="w-full flex items-center justify-center gap-3 text-sm py-3 border-2" 
                onClick={() => window.location.href = '/api/auth/google'} 
                data-testid="button-google-login"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="font-bold">Continue with Google</span>
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-700"></div>
              <span className="text-xs text-zinc-500 font-semibold">OR</span>
              <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-700"></div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const response = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: loginForm.email,
                    password: loginForm.password,
                  }),
                });
                if (response.ok) {
                  window.location.href = '/';
                } else {
                  const error = await response.json();
                  alert(error.message || 'Login failed');
                }
              } catch (err) {
                alert('Error logging in');
              }
            }} className="space-y-3 mb-6">
              <input 
                type="email" 
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                placeholder="Email Address" 
                required 
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                data-testid="input-login-email" 
              />
              <div className="relative">
                <input 
                  type={showLoginPassword ? "text" : "password"} 
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="Password" 
                  required 
                  className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-login-password" 
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  data-testid="button-toggle-login-password"
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-login-submit">Sign In</Button>
            </form>

            <div className="text-center space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Don't have an account? <button onClick={() => { setShowLoginModal(false); setShowSignupModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-create-account-link">Create Account</button></p>
              <p className="text-sm"><button onClick={() => { setShowLoginModal(false); setShowForgotPasswordModal(true); }} className="text-orange-500 hover:text-orange-400 font-bold" data-testid="button-forgot-password-link">Forgot My Password?</button></p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <button onClick={() => { setShowLoginModal(false); setShowEmailLookupModal(true); }} className="text-[10px] sm:text-xs text-blue-500 hover:text-blue-400 flex items-center justify-center gap-1 mx-auto font-bold" data-testid="button-find-bookings"><Mail size={10}/> Find My Bookings (No Password)</button>
              <button onClick={() => { setShowLoginModal(false); setShowAdminLoginModal(true); }} className="text-[10px] sm:text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto" data-testid="button-admin-login"><Settings size={10}/> Admin / Host Login</button>
              <button onClick={() => { setShowLoginModal(false); setShowHostRegisterModal(true); }} className="text-[10px] sm:text-xs text-green-500 hover:text-green-400 flex items-center justify-center gap-1 mx-auto font-bold" data-testid="button-become-host"><Building2 size={10}/> Become a Host</button>
            </div>
          </div>
        </div>
      )}

      {showEmailLookupModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={() => { 
                setShowEmailLookupModal(false); 
                setEmailLookupStep('email');
                setEmailLookupEmail('');
                setEmailLookupOtp('');
                setEmailLookupMessage('');
              }} 
              className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" 
              data-testid="button-close-email-lookup"
            >
              <X size={20}/>
            </button>
            
            <h2 className="text-2xl font-bold mb-2 text-center text-zinc-900 dark:text-white">Find My Bookings</h2>
            <p className="text-sm text-zinc-500 text-center mb-6">Quick access with email verification</p>
            
            {emailLookupStep === 'email' ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setEmailLookupLoading(true);
                setEmailLookupMessage('');
                try {
                  const response = await fetch('/api/auth/email-otp/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailLookupEmail }),
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setEmailLookupStep('otp');
                    setEmailLookupMessage('Check your email for the 6-digit code.');
                  } else {
                    setEmailLookupMessage(data.message || 'Something went wrong. Please try again.');
                  }
                } catch (err) {
                  setEmailLookupMessage('Error sending verification code. Please try again.');
                } finally {
                  setEmailLookupLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Your Email Address</label>
                  <input 
                    type="email" 
                    value={emailLookupEmail}
                    onChange={(e) => setEmailLookupEmail(e.target.value)}
                    placeholder="Enter the email used for your booking" 
                    required 
                    className="w-full px-3 py-3 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-email-lookup" 
                  />
                </div>
                {emailLookupMessage && (
                  <div className="text-sm text-center text-blue-600">{emailLookupMessage}</div>
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3" 
                  disabled={emailLookupLoading}
                  data-testid="button-send-code"
                >
                  {emailLookupLoading ? <><Loader size={18} className="animate-spin mr-2"/> Sending...</> : <><Mail size={18} className="mr-2"/> Send Verification Code</>}
                </Button>
              </form>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setEmailLookupLoading(true);
                setEmailLookupMessage('');
                try {
                  const response = await fetch('/api/auth/email-otp/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailLookupEmail, code: emailLookupOtp }),
                  });
                  const data = await response.json();
                  if (response.ok && data.success) {
                    const normalizedEmail = data.email.toLowerCase().trim();
                    const verifiedData = { email: normalizedEmail, timestamp: Date.now() };
                    localStorage.setItem('carhop_verified_email_data', JSON.stringify(verifiedData));
                    setVerifiedBookingEmail(normalizedEmail);
                    setShowEmailLookupModal(false);
                    setEmailLookupStep('email');
                    setEmailLookupEmail('');
                    setEmailLookupOtp('');
                    setEmailLookupMessage('');
                    toast({ description: 'Email verified! Showing your bookings.', duration: 3000 });
                    setView('bookings');
                  } else {
                    setEmailLookupMessage(data.message || 'Invalid or expired code. Please try again.');
                  }
                } catch (err) {
                  setEmailLookupMessage('Verification failed. Please try again.');
                } finally {
                  setEmailLookupLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Enter Verification Code</label>
                  <p className="text-xs text-zinc-500 mb-3">We sent a 6-digit code to <strong>{emailLookupEmail}</strong></p>
                  <input 
                    type="text" 
                    value={emailLookupOtp}
                    onChange={(e) => setEmailLookupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" 
                    required 
                    maxLength={6}
                    className="w-full px-3 py-3 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-2xl text-center font-bold tracking-widest" 
                    data-testid="input-otp-code" 
                  />
                </div>
                {emailLookupMessage && (
                  <div className={`text-sm text-center ${emailLookupMessage.includes('Check your email') ? 'text-green-600' : 'text-red-500'}`}>{emailLookupMessage}</div>
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3" 
                  disabled={emailLookupLoading || emailLookupOtp.length !== 6}
                  data-testid="button-verify-code"
                >
                  {emailLookupLoading ? <><Loader size={18} className="animate-spin mr-2"/> Verifying...</> : <><Check size={18} className="mr-2"/> Verify & View Bookings</>}
                </Button>
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => { setEmailLookupStep('email'); setEmailLookupOtp(''); setEmailLookupMessage(''); }}
                    className="text-sm text-blue-500 hover:text-blue-400"
                    data-testid="button-back-to-email"
                  >
                    Back to Email Entry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowAdminLoginModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-admin-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Admin / Host Login</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Operating Unit</label>
                <input 
                  type="text" 
                  value={adminLoginForm.unit}
                  onChange={(e) => setAdminLoginForm({...adminLoginForm, unit: e.target.value})}
                  placeholder="e.g., 01 (Bridgeport - Matriz)" 
                  maxLength={2}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-admin-unit" 
                />
              </div>
              <Button 
                onClick={handleAdminLoginSubmit}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 mt-4" 
                data-testid="button-admin-login-submit"
              >
                Access Admin Panel
              </Button>
            </div>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Back to <button onClick={() => { setShowAdminLoginModal(false); setShowLoginModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-back-login">Login</button></p>
              <p className="text-sm"><button onClick={() => { setShowAdminLoginModal(false); setShowHostLoginModal(true); }} className="text-green-500 hover:text-green-400 font-bold flex items-center justify-center gap-1 mx-auto" data-testid="button-host-login-link"><Building2 size={12}/> Host Login</button></p>
            </div>
          </div>
        </div>
      )}

      {showHostLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowHostLoginModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-host-login-modal"><X size={20}/></button>
            
            <div className="text-center mb-6">
              <Building2 size={32} className="mx-auto mb-2 text-green-500" />
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Host Login</h2>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const response = await fetch('/api/hosts/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(hostLoginForm),
                });
                if (response.ok) {
                  const data = await response.json();
                  setCurrentHost(data.host);
                  setShowHostLoginModal(false);
                  setHostLoginForm({ username: '', password: '' });
                  setView('host-dashboard');
                } else {
                  const error = await response.json();
                  alert(error.message || 'Login failed');
                }
              } catch (err) {
                alert('Error logging in');
              }
            }} className="space-y-4">
              <input 
                type="text" 
                value={hostLoginForm.username}
                onChange={(e) => setHostLoginForm({...hostLoginForm, username: e.target.value})}
                placeholder="Username" 
                required 
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                data-testid="input-host-username" 
              />
              <div className="relative">
                <input 
                  type={showHostLoginPassword ? "text" : "password"} 
                  value={hostLoginForm.password}
                  onChange={(e) => setHostLoginForm({...hostLoginForm, password: e.target.value})}
                  placeholder="Password" 
                  required 
                  className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-host-password" 
                />
                <button
                  type="button"
                  onClick={() => setShowHostLoginPassword(!showHostLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  data-testid="button-toggle-host-login-password"
                >
                  {showHostLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-host-login-submit">Access Host Panel</Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Don't have a host account? <button onClick={() => { setShowHostLoginModal(false); setShowHostRegisterModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-become-host-link">Become a Host</button></p>
            </div>
          </div>
        </div>
      )}

      {showResetPasswordModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => { setShowResetPasswordModal(false); setResetPassword(''); setResetPasswordConfirm(''); setResetPasswordMessage(''); }} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-reset-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Create New Password</h2>
            
            {resetPasswordMessage ? (
              <div className="text-center space-y-4">
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-300">{resetPasswordMessage}</p>
                </div>
                <Button onClick={() => { setShowResetPasswordModal(false); setResetPassword(''); setResetPasswordConfirm(''); setResetPasswordMessage(''); setShowLoginModal(true); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-back-to-login-after-reset">Back to Login</Button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (resetPassword !== resetPasswordConfirm) {
                  setResetPasswordMessage('Passwords do not match');
                  return;
                }
                if (resetPassword.length < 6) {
                  setResetPasswordMessage('Password must be at least 6 characters');
                  return;
                }
                setResetPasswordLoading(true);
                try {
                  const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
                  });
                  if (response.ok) {
                    setResetPasswordMessage('Password reset successfully! Redirecting to login...');
                    setTimeout(() => {
                      setShowResetPasswordModal(false);
                      setResetPassword('');
                      setResetPasswordConfirm('');
                      setResetPasswordMessage('');
                      setShowLoginModal(true);
                    }, 2000);
                  } else {
                    const error = await response.json();
                    setResetPasswordMessage(error.message || 'Error resetting password');
                  }
                } catch (err) {
                  setResetPasswordMessage('Error resetting password');
                } finally {
                  setResetPasswordLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">New Password</label>
                  <div className="relative">
                    <input 
                      type={showResetPassword ? "text" : "password"} 
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Enter new password" 
                      required 
                      className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                      data-testid="input-reset-password" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      data-testid="button-toggle-reset-password"
                    >
                      {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Confirm Password</label>
                  <div className="relative">
                    <input 
                      type={showResetPasswordConfirm ? "text" : "password"} 
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      placeholder="Confirm password" 
                      required 
                      className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                      data-testid="input-reset-password-confirm" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPasswordConfirm(!showResetPasswordConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      data-testid="button-toggle-reset-password-confirm"
                    >
                      {showResetPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={resetPasswordLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 disabled:opacity-50" data-testid="button-submit-reset-password">
                  {resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => { setShowForgotPasswordModal(false); setForgotPasswordEmail(''); setForgotPasswordMessage(''); }} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-forgot-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Reset Your Password</h2>
            
            {forgotPasswordMessage ? (
              <div className="text-center space-y-4">
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-300">{forgotPasswordMessage}</p>
                </div>
                <Button onClick={() => { setShowForgotPasswordModal(false); setForgotPasswordEmail(''); setForgotPasswordMessage(''); setShowLoginModal(true); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-back-to-login">Back to Login</Button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setForgotPasswordLoading(true);
                try {
                  const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: forgotPasswordEmail }),
                  });
                  if (response.ok) {
                    const data = await response.json();
                    setForgotPasswordMessage(data.message);
                  } else {
                    const error = await response.json();
                    setForgotPasswordMessage(error.message || 'Error processing request');
                  }
                } catch (err) {
                  setForgotPasswordMessage('Error sending password reset request');
                } finally {
                  setForgotPasswordLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-white mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="Enter your email" 
                    required 
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-forgot-email" 
                  />
                </div>
                <Button type="submit" disabled={forgotPasswordLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 disabled:opacity-50" data-testid="button-send-reset-email">
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Email'}
                </Button>
              </form>
            )}
            
            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <button onClick={() => { setShowForgotPasswordModal(false); setForgotPasswordEmail(''); setForgotPasswordMessage(''); setShowLoginModal(true); }} className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" data-testid="button-back-to-login-link">Back to Login</button>
            </div>
          </div>
        </div>
      )}

      {showHostRegisterModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto pt-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md sm:max-w-xl md:max-w-2xl p-4 sm:p-6 md:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-2 sm:my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <button onClick={() => setShowHostRegisterModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-host-register-modal"><X size={20}/></button>
            
            {hostRegisterMessage ? (
              <div className="text-center py-8">
                <Check size={48} className="mx-auto mb-4 text-green-600" />
                <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">Registration Successful!</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{hostRegisterMessage}</p>
                <Button onClick={() => { 
                  setShowHostRegisterModal(false); 
                  setHostRegisterForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', licenseNumber: '', licenseFrontImage: '', licenseBackImage: '', proofOfResidenceImage: '', socialSecurityNumber: '', username: '', password: '', confirmPassword: '' }); 
                  setHostRegisterMessage(''); 
                }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-host-register-success">Done</Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4 sm:mb-6">
                  <Building2 size={28} className="mx-auto mb-2 text-green-500" />
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Become a Host</h2>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-1">Register to list your vehicles and earn money</p>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (hostRegisterForm.password !== hostRegisterForm.confirmPassword) {
                    alert('Passwords do not match');
                    return;
                  }
                  try {
                    const response = await fetch('/api/hosts/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        firstName: hostRegisterForm.firstName,
                        lastName: hostRegisterForm.lastName,
                        email: hostRegisterForm.email,
                        phone: hostRegisterForm.phone,
                        address: hostRegisterForm.address,
                        city: hostRegisterForm.city,
                        state: hostRegisterForm.state,
                        zipCode: hostRegisterForm.zipCode,
                        licenseNumber: hostRegisterForm.licenseNumber,
                        licenseFrontImage: hostRegisterForm.licenseFrontImage,
                        licenseBackImage: hostRegisterForm.licenseBackImage,
                        proofOfResidenceImage: hostRegisterForm.proofOfResidenceImage,
                        socialSecurityNumber: hostRegisterForm.socialSecurityNumber,
                        username: hostRegisterForm.username,
                        password: hostRegisterForm.password,
                        agreementAccepted: hostAgreementAccepted,
                        agreementAcceptedAt: hostAgreementAcceptedAt,
                      }),
                    });
                    if (response.ok) {
                      setHostAgreementAccepted(false);
                      setHostAgreementAcceptedAt('');
                      setHostRegisterMessage(`Thank you for registering, ${hostRegisterForm.firstName}! Your host account is pending verification. We'll review your documents and email you at ${hostRegisterForm.email} within 2-3 business days. Once approved, you can login with username: ${hostRegisterForm.username}`);
                      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
                    } else {
                      const error = await response.json();
                      alert(error.message || 'Failed to register Host');
                    }
                  } catch (err) {
                    alert('Error registering');
                  }
                }} className="space-y-3 sm:space-y-4">
                  <div className="border-b border-zinc-200 dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Personal Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <input type="text" value={hostRegisterForm.firstName} onChange={(e) => setHostRegisterForm({...hostRegisterForm, firstName: e.target.value})} placeholder="First Name *" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-first-name" />
                      <input type="text" value={hostRegisterForm.lastName} onChange={(e) => setHostRegisterForm({...hostRegisterForm, lastName: e.target.value})} placeholder="Last Name *" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-last-name" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
                      <input type="email" value={hostRegisterForm.email} onChange={(e) => setHostRegisterForm({...hostRegisterForm, email: e.target.value})} placeholder="Email *" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-email" />
                      <input type="tel" value={hostRegisterForm.phone} onChange={(e) => setHostRegisterForm({...hostRegisterForm, phone: e.target.value})} placeholder="Phone *" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-phone" />
                    </div>
                  </div>

                  <div className="border-b border-zinc-200 dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Address</h3>
                    <input type="text" value={hostRegisterForm.address} onChange={(e) => setHostRegisterForm({...hostRegisterForm, address: e.target.value})} placeholder="Street Address" className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-2 sm:mb-3" data-testid="input-host-address" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      <input type="text" value={hostRegisterForm.city} onChange={(e) => setHostRegisterForm({...hostRegisterForm, city: e.target.value})} placeholder="City" className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-city" />
                      <input type="text" value={hostRegisterForm.state} onChange={(e) => setHostRegisterForm({...hostRegisterForm, state: e.target.value})} placeholder="State" maxLength={2} className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-state" />
                      <input type="text" value={hostRegisterForm.zipCode} onChange={(e) => setHostRegisterForm({...hostRegisterForm, zipCode: e.target.value})} placeholder="ZIP" className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-zip" />
                    </div>
                  </div>

                  <div className="border-b border-zinc-200 dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Driver's License</h3>
                    <input type="text" value={hostRegisterForm.licenseNumber} onChange={(e) => setHostRegisterForm({...hostRegisterForm, licenseNumber: e.target.value})} placeholder="License Number *" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-2 sm:mb-3" data-testid="input-host-license" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Front License</label>
                        <input type="file" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setHostRegisterForm({...hostRegisterForm, licenseFrontImage: reader.result as string});
                            reader.readAsDataURL(file);
                          }
                        }} className="w-full text-xs text-zinc-500 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700" data-testid="input-host-license-front" />
                        {hostRegisterForm.licenseFrontImage && <img src={hostRegisterForm.licenseFrontImage} alt="Front" className="mt-2 w-full h-20 object-cover rounded border" />}
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Back License</label>
                        <input type="file" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setHostRegisterForm({...hostRegisterForm, licenseBackImage: reader.result as string});
                            reader.readAsDataURL(file);
                          }
                        }} className="w-full text-xs text-zinc-500 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700" data-testid="input-host-license-back" />
                        {hostRegisterForm.licenseBackImage && <img src={hostRegisterForm.licenseBackImage} alt="Back" className="mt-2 w-full h-20 object-cover rounded border" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs text-zinc-500 mb-1">Proof of Residence (Utilities Bill, etc.) *</label>
                      <input type="file" accept="image/*" required onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setHostRegisterForm({...hostRegisterForm, proofOfResidenceImage: reader.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} className="w-full text-xs text-zinc-500 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700" data-testid="input-host-proof-residence" />
                      {hostRegisterForm.proofOfResidenceImage && <img src={hostRegisterForm.proofOfResidenceImage} alt="Proof" className="mt-2 w-full h-20 object-cover rounded border" />}
                    </div>
                  </div>

                  <div className="border-b border-zinc-200 dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Tax Information</h3>
                    <div>
                      <input type="text" value={hostRegisterForm.socialSecurityNumber} onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setHostRegisterForm({...hostRegisterForm, socialSecurityNumber: value});
                      }} placeholder="Social Security or Tax ID (ITIN Number) *" required maxLength={9} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-ssn" />
                      {hostRegisterForm.socialSecurityNumber && (
                        <p className={`text-xs mt-1 font-medium ${hostRegisterForm.socialSecurityNumber.startsWith('9') ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                          {hostRegisterForm.socialSecurityNumber.startsWith('9') ? '• TAX ID (ITIN Number)' : '• Social Security Number (SSN)'}
                        </p>
                      )}
                      {!hostRegisterForm.socialSecurityNumber && (
                        <p className="text-xs text-zinc-500 mt-1">9 digits required</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Account Credentials</h3>
                    <input type="text" value={hostRegisterForm.username} onChange={(e) => setHostRegisterForm({...hostRegisterForm, username: e.target.value})} placeholder="Username *" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-2 sm:mb-3" data-testid="input-host-username-register" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="relative">
                        <input type={showHostRegisterPassword ? "text" : "password"} value={hostRegisterForm.password} onChange={(e) => setHostRegisterForm({...hostRegisterForm, password: e.target.value})} placeholder="Password *" required minLength={6} className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-password-register" />
                        <button type="button" onClick={() => setShowHostRegisterPassword(!showHostRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" data-testid="button-toggle-host-password-register">{showHostRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      <div className="relative">
                        <input type={showHostRegisterConfirmPassword ? "text" : "password"} value={hostRegisterForm.confirmPassword} onChange={(e) => setHostRegisterForm({...hostRegisterForm, confirmPassword: e.target.value})} placeholder="Confirm Password *" required minLength={6} className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-confirm-password" />
                        <button type="button" onClick={() => setShowHostRegisterConfirmPassword(!showHostRegisterConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" data-testid="button-toggle-host-confirm-password">{showHostRegisterConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 sm:pt-4 mt-3 sm:mt-4">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-2 sm:mb-3">Partner Agreement</h3>
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <input 
                        type="checkbox" 
                        checked={hostAgreementAccepted} 
                        onChange={(e) => {
                          if (!hostAgreementAccepted) {
                            setShowHostAgreementModal(true);
                          } else {
                            setHostAgreementAccepted(false);
                            setHostAgreementAcceptedAt('');
                          }
                        }}
                        className="w-4 h-4 mt-0.5 accent-green-600 cursor-pointer"
                        data-testid="checkbox-host-agreement"
                      />
                      <div className="flex-1">
                        <label className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer" onClick={() => setShowHostAgreementModal(true)}>
                          I agree to the <span className="text-green-600 font-bold hover:text-green-700 underline">Host Agreement</span> *
                        </label>
                        {hostAgreementAccepted && hostAgreementAcceptedAt && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check size={12} /> Accepted
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={!hostAgreementAccepted} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 text-xs sm:text-sm mt-3 sm:mt-4 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="button-host-register-submit">Register as Host</Button>
                </form>

                <div className="mt-4 sm:mt-6 text-center">
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Already a host? <button onClick={() => { setShowHostRegisterModal(false); setShowHostLoginModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-host-login-link-2">Login</button></p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showHostAgreementModal && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-4">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 p-6 border-b border-zinc-200 dark:border-zinc-700 rounded-t-2xl z-10">
              <button onClick={() => setShowHostAgreementModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-host-agreement-modal"><X size={20}/></button>
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 text-green-500" />
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">CarHop Host Partner Agreement</h2>
                <p className="text-sm text-zinc-500 mt-1">Please read carefully before accepting</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="font-bold text-green-800 dark:text-green-400">Effective Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-green-700 dark:text-green-500 text-xs mt-1">State of Connecticut, United States</p>
              </div>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">1. PARTIES AND OVERVIEW</h3>
              <p>This Host Partner Agreement ("Agreement") is entered into between CarHop LLC ("CarHop," "Company," "we," or "us") and you ("Host," "you," or "your"). By accepting this Agreement, you agree to list your vehicle(s) on the CarHop platform for rental by approved customers ("Renters").</p>
              
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">2. COMMISSION STRUCTURE</h3>
              <p>CarHop offers two commission plans. You select your plan when adding each vehicle:</p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-4 p-3 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
                  <div className="text-center min-w-16">
                    <span className="text-2xl font-bold text-green-600">15%</span>
                    <p className="text-xs text-zinc-500">Commission</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-900 dark:text-white">Standard Plan</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">You are responsible for a <strong>$750 deductible</strong> per incident. Best for hosts who want to maximize earnings.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
                  <div className="text-center min-w-16">
                    <span className="text-2xl font-bold text-blue-600">25%</span>
                    <p className="text-xs text-zinc-500">Commission</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-900 dark:text-white">Premium Protection Plan</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Lower <strong>$500 deductible</strong> per incident. Best for hosts who want extra peace of mind.</p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">3. VEHICLE REQUIREMENTS</h3>
              <p>To list your vehicle on CarHop, you must meet the following requirements:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Vehicle must be model year 2010 or newer</li>
                <li>Vehicle must have fewer than 130,000 miles</li>
                <li>Vehicle must pass a safety inspection and be in good working condition</li>
                <li>Vehicle must be registered and insured in the State of Connecticut</li>
                <li>Vehicle must have a clean title (no salvage, rebuilt, or flood titles)</li>
                <li>Vehicle must be clean inside and out before each rental</li>
                <li>Host must provide proof of personal auto insurance coverage</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">4. INSURANCE AND LIABILITY</h3>
              <p>CarHop provides commercial auto insurance coverage during active rentals through our insurance partner. This includes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Liability Coverage:</strong> Up to $35,000 per occurrence</li>
                <li><strong>Comprehensive & Collision:</strong> Actual cash value of the vehicle (subject to deductible)</li>
                <li><strong>Uninsured/Underinsured Motorist:</strong> State minimum requirements</li>
              </ul>
              <p className="text-amber-600 dark:text-amber-400 font-medium mt-2">Important: Coverage only applies during active rental periods. Your personal insurance remains primary when the vehicle is not rented.</p>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">5. DEDUCTIBLE RESPONSIBILITY</h3>
              <p>In the event of damage, theft, or total loss:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>The Host is responsible for paying the deductible based on their selected commission plan</li>
                <li>CarHop will attempt to recover the deductible from the Renter when applicable</li>
                <li>If recovered, CarHop will reimburse the Host minus processing fees</li>
                <li>Deductible is per incident, not per rental period</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">6. PAYMENT TERMS</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Earnings are calculated after the rental is completed and the vehicle is returned</li>
                <li>Payments are processed weekly via direct deposit (ACH) or PayPal</li>
                <li>Minimum payout threshold: $50</li>
                <li>Payment processing time: 3-5 business days</li>
                <li>Hosts are responsible for their own tax obligations (1099 provided if applicable)</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">7. CANCELLATION POLICY</h3>
              <p><strong>Host Cancellations:</strong></p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cancellations made more than 24 hours before pickup: No penalty</li>
                <li>Cancellations made less than 24 hours before pickup: $50 fee</li>
                <li>No-show or same-day cancellation: $100 fee + temporary suspension review</li>
                <li>Repeated cancellations may result in account termination</li>
              </ul>
              <p className="mt-2"><strong>Renter Cancellations:</strong> Handled per CarHop's renter cancellation policy. Hosts receive partial payment for late cancellations.</p>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">8. HOST RESPONSIBILITIES</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Maintain accurate vehicle availability calendar</li>
                <li>Respond to booking requests within 2 hours during business hours</li>
                <li>Deliver vehicle clean, with at least 1/4 tank of fuel</li>
                <li>Conduct vehicle walkaround and document condition at pickup</li>
                <li>Report any issues or damage immediately through the app</li>
                <li>Maintain vehicle in safe, roadworthy condition</li>
                <li>Comply with all Connecticut state laws and regulations</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">9. PROHIBITED USES</h3>
              <p>The following are strictly prohibited and may result in immediate termination:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Conducting transactions outside the CarHop platform</li>
                <li>Misrepresenting vehicle condition or specifications</li>
                <li>Discrimination against renters based on protected characteristics</li>
                <li>Fraudulent claims or documentation</li>
                <li>Operating unlicensed or uninsured vehicles</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">10. DISPUTE RESOLUTION</h3>
              <p>Any disputes arising from this Agreement shall be resolved through:</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Direct negotiation between parties</li>
                <li>Mediation through a mutually agreed mediator</li>
                <li>Binding arbitration under the rules of the American Arbitration Association</li>
              </ol>
              <p className="mt-2">Governing Law: This Agreement is governed by the laws of the State of Connecticut.</p>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">11. TERMINATION</h3>
              <p>Either party may terminate this Agreement at any time with 7 days written notice. Outstanding rentals must be honored. Upon termination:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>All active listings will be deactivated</li>
                <li>Pending payments will be processed per normal schedule</li>
                <li>Outstanding deductibles or fees remain payable</li>
                <li>Vehicle must be returned if currently rented</li>
              </ul>

              <h3 className="text-lg font-bold text-zinc-900 dark:text-white pt-2">12. AMENDMENTS</h3>
              <p>CarHop reserves the right to modify this Agreement with 30 days notice. Continued use of the platform after modifications constitutes acceptance of the updated terms.</p>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-6">
                <p className="font-bold text-amber-800 dark:text-amber-400">ACKNOWLEDGMENT</p>
                <p className="text-amber-700 dark:text-amber-500 text-sm mt-2">By clicking "I Accept," you acknowledge that you have read, understood, and agree to be bound by the terms and conditions of this Host Partner Agreement. You confirm that you are at least 21 years old and legally authorized to enter into this binding contract.</p>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 p-6 border-t border-zinc-200 dark:border-zinc-700 rounded-b-2xl">
              <div className="flex gap-4">
                <Button 
                  onClick={() => setShowHostAgreementModal(false)} 
                  variant="secondary"
                  className="flex-1"
                  data-testid="button-decline-host-agreement"
                >
                  Decline
                </Button>
                <Button 
                  onClick={() => {
                    setHostAgreementAccepted(true);
                    setHostAgreementAcceptedAt(new Date().toISOString());
                    setShowHostAgreementModal(false);
                  }} 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                  data-testid="button-accept-host-agreement"
                >
                  <Check size={16} /> I Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignupModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowSignupModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-signup-modal"><X size={20}/></button>
            
            {signupMessage ? (
              <div className="text-center py-8">
                <Check size={48} className="mx-auto mb-4 text-green-600" />
                <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">Account Created!</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{signupMessage}</p>
                <Button onClick={() => { setShowSignupModal(false); setSignupForm({ firstName: '', lastName: '', email: '', phone: '', password: '' }); setSignupMessage(''); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2" data-testid="button-signup-success">Got It</Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Create Account</h2>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const response = await fetch('/api/auth/signup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(signupForm),
                    });
                    if (response.ok) {
                      setSignupMessage(`Welcome! A confirmation email has been sent to ${signupForm.email} with your account details.`);
                    } else {
                      const error = await response.json();
                      alert(error.message || 'Signup failed');
                    }
                  } catch (err) {
                    alert('Error signing up');
                  }
                }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      value={signupForm.firstName}
                      onChange={(e) => setSignupForm({...signupForm, firstName: e.target.value})}
                      placeholder="First Name" 
                      required 
                      className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                      data-testid="input-signup-first-name" 
                    />
                    <input 
                      type="text" 
                      value={signupForm.lastName}
                      onChange={(e) => setSignupForm({...signupForm, lastName: e.target.value})}
                      placeholder="Last Name" 
                      required 
                      className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                      data-testid="input-signup-last-name" 
                    />
                  </div>
                  <input 
                    type="email" 
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                    placeholder="Email Address" 
                    required 
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-signup-email" 
                  />
                  <input 
                    type="tel" 
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({...signupForm, phone: e.target.value})}
                    placeholder="Phone Number" 
                    required 
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-signup-phone" 
                  />
                  <div className="relative">
                    <input 
                      type={showSignupPassword ? "text" : "password"} 
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({...signupForm, password: e.target.value})}
                      placeholder="Password (min 6 chars)" 
                      required 
                      className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                      data-testid="input-signup-password" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      data-testid="button-toggle-signup-password"
                    >
                      {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 mt-4" data-testid="button-signup-submit">Create Account</Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Already have an account? <button onClick={() => { setShowSignupModal(false); setShowLoginModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-signin-link">Sign In</button></p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-profile-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Edit Profile</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const response = await fetch('/api/auth/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(profileForm),
                });
                if (response.ok) {
                  alert('Profile updated successfully!');
                  setShowProfileModal(false);
                  window.location.href = '/';
                } else {
                  const error = await response.json();
                  alert(error.message || 'Update failed');
                }
              } catch (err) {
                alert('Error updating profile');
              }
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative group">
                  <input 
                    type="text" 
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                    placeholder="First Name" 
                    required 
                    className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm w-full" 
                    data-testid="input-profile-first-name" 
                  />
                  <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Your first name</div>
                </div>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                    placeholder="Last Name" 
                    required 
                    className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm w-full" 
                    data-testid="input-profile-last-name" 
                  />
                  <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Your last name</div>
                </div>
              </div>
              <div className="relative group">
                <input 
                  type="tel" 
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                  placeholder="Phone Number" 
                  required 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-profile-phone" 
                />
                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Your phone number</div>
              </div>
              <div className="relative group">
                <input 
                  type="text" 
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({...profileForm, city: e.target.value})}
                  placeholder="City" 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-profile-city" 
                />
                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Your city</div>
              </div>
              <div className="relative group">
                <input 
                  type="text" 
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({...profileForm, state: e.target.value})}
                  placeholder="State" 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-profile-state" 
                />
                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Your state</div>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 mt-4" data-testid="button-profile-save">Save Changes</Button>
            </form>
          </div>
        </div>
      )}

      {/* Host Edit Profile Modal */}
      {showHostEditProfileModal && currentHost && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowHostEditProfileModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-host-profile-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white flex items-center justify-center gap-2">
              <User className="text-green-600" size={24}/> Edit Profile
            </h2>
            
            <div className="space-y-4">
              {/* Read-only fields */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Personal Information</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">First Name</label>
                    <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300">{currentHost.firstName}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Last Name</label>
                    <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300">{currentHost.lastName}</div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Username</label>
                  <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300">@{currentHost.username}</div>
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Address</label>
                  <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300">
                    {currentHost.address ? `${currentHost.address}, ${currentHost.city || ''} ${currentHost.state || ''} ${currentHost.zipCode || ''}` : 'Not provided'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Tax ID / SSN</label>
                  <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                    <Lock size={14} className="text-zinc-400" />
                    <span>***-**-{currentHost.socialSecurityNumber?.slice(-4) || '****'}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">License Number</label>
                  <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded text-sm text-zinc-600 dark:text-zinc-300">{currentHost.licenseNumber || 'Not provided'}</div>
                </div>
              </div>
              
              {/* Editable fields */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3 border border-green-200 dark:border-green-800">
                <h3 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Edit size={14}/> Editable Fields
                </h3>
                
                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={hostEditProfileForm.phone}
                    onChange={(e) => setHostEditProfileForm({...hostEditProfileForm, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-host-profile-phone" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={hostEditProfileForm.email}
                    onChange={(e) => setHostEditProfileForm({...hostEditProfileForm, email: e.target.value})}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                    data-testid="input-host-profile-email" 
                  />
                </div>
                
                {/* License Images */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Driver's License (Front)</label>
                    <div className="relative">
                      {hostEditProfileForm.licenseFrontImage ? (
                        <div className="relative">
                          <img 
                            src={hostEditProfileForm.licenseFrontImage} 
                            alt="License Front" 
                            className="w-full h-24 object-cover rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:opacity-80"
                            onClick={() => setSelectedImage(hostEditProfileForm.licenseFrontImage)}
                          />
                          <button 
                            onClick={() => setHostEditProfileForm({...hostEditProfileForm, licenseFrontImage: ''})}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X size={12}/>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded cursor-pointer hover:border-green-500 transition-colors">
                          <Upload size={20} className="text-zinc-400 mb-1"/>
                          <span className="text-xs text-zinc-500">Upload Front</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setHostEditProfileForm({...hostEditProfileForm, licenseFrontImage: ev.target?.result as string});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Driver's License (Back)</label>
                    <div className="relative">
                      {hostEditProfileForm.licenseBackImage ? (
                        <div className="relative">
                          <img 
                            src={hostEditProfileForm.licenseBackImage} 
                            alt="License Back" 
                            className="w-full h-24 object-cover rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:opacity-80"
                            onClick={() => setSelectedImage(hostEditProfileForm.licenseBackImage)}
                          />
                          <button 
                            onClick={() => setHostEditProfileForm({...hostEditProfileForm, licenseBackImage: ''})}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X size={12}/>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded cursor-pointer hover:border-green-500 transition-colors">
                          <Upload size={20} className="text-zinc-400 mb-1"/>
                          <span className="text-xs text-zinc-500">Upload Back</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setHostEditProfileForm({...hostEditProfileForm, licenseBackImage: ev.target?.result as string});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-zinc-500 text-center">
                Any changes will be notified to Admin for verification.
              </p>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowHostEditProfileModal(false)}
                  data-testid="button-host-profile-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={hostProfileSaving}
                  onClick={async () => {
                    setHostProfileSaving(true);
                    try {
                      const response = await apiRequest('PUT', `/api/hosts/${currentHost.id}/profile`, hostEditProfileForm);
                      if (response.ok) {
                        toast({
                          title: 'Profile Updated',
                          description: 'Your profile has been updated and Admin has been notified.',
                        });
                        setShowHostEditProfileModal(false);
                        queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
                        // Update current host data
                        setCurrentHost({
                          ...currentHost,
                          phone: hostEditProfileForm.phone,
                          email: hostEditProfileForm.email,
                          licenseFrontImage: hostEditProfileForm.licenseFrontImage,
                          licenseBackImage: hostEditProfileForm.licenseBackImage
                        });
                      } else {
                        const error = await response.json();
                        toast({
                          title: 'Update Failed',
                          description: error.message || 'Failed to update profile',
                          variant: 'destructive'
                        });
                      }
                    } catch (err) {
                      toast({
                        title: 'Error',
                        description: 'Failed to update profile',
                        variant: 'destructive'
                      });
                    } finally {
                      setHostProfileSaving(false);
                    }
                  }}
                  data-testid="button-host-profile-update"
                >
                  {hostProfileSaving ? <Loader className="animate-spin mr-2" size={16}/> : null}
                  Update
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'host-dashboard' && currentHost && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-20 sm:py-24">
          <div className="flex items-start justify-between mb-6 sm:mb-8 gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-white truncate" data-testid="text-host-title">Host Dashboard</h1>
              <p className="text-sm sm:text-base text-zinc-500 truncate">Welcome, <span className="font-semibold text-zinc-700 dark:text-zinc-300">{currentHost.firstName} {currentHost.lastName}</span></p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Desktop: Theme toggle and Logout button */}
              <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8" onClick={() => setDarkMode(!darkMode)} data-testid="button-host-theme">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex text-sm px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => { setCurrentHost(null); setView('home'); }} data-testid="button-host-logout">
                <LogOut size={16} className="mr-1" /> Logout
              </Button>
            </div>
          </div>
          
          <div className="flex justify-center gap-1 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
            {['fleet', 'bookings', 'earnings', 'chat'].map(tab => {
              const hostEmail = currentHost?.email || '';
              const hostUsername = currentHost?.username || '';
              // Handle both old format (email as senderIdentifier) and new format (@username)
              const hostUnreadCount = tab === 'chat' ? supportMessagesData.filter((m: any) => 
                m.senderType === 'host' && 
                (m.senderIdentifier === hostEmail || m.senderIdentifier === `@${hostUsername}` || m.senderEmail === hostEmail) && 
                m.adminReply && !m.read
              ).length : 0;
              return (
              <button key={tab} 
                onClick={() => {
                  setHostTab(tab);
                  if (tab === 'chat') {
                    // Mark messages as read when entering the chat tab
                    const unreadMsgs = supportMessagesData.filter((m: any) => 
                      m.senderType === 'host' && 
                      (m.senderIdentifier === hostEmail || m.senderIdentifier === `@${hostUsername}` || m.senderEmail === hostEmail) && 
                      m.adminReply && !m.read
                    );
                    unreadMsgs.forEach((msg: any) => {
                      apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true }).catch(err => console.error('Error marking as read:', err));
                    });
                    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] }), 500);
                  }
                }} 
                className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all whitespace-nowrap ${hostTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-host-tab-${tab}`}>
                <div className="flex items-center gap-1">
                  {tab === 'fleet' && <Car size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  {tab === 'bookings' && <Briefcase size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  {tab === 'earnings' && <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  {tab === 'chat' && <MessageCircle size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  {tab === 'chat' && hostUnreadCount > 0 && (
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-orange-500 text-white text-[10px] font-bold animate-bounce">
                      {hostUnreadCount}
                    </span>
                  )}
                </div>
                <span>{tab === 'chat' ? 'Support' : tab}</span>
              </button>
            );})}
          </div>

          {hostTab === 'fleet' && (() => {
            const hostVehicles = vehicles.filter(v => v.hostId === String(currentHost.id));
            return (
              <div className="space-y-4 sm:space-y-6">
                {/* Add New Vehicle Button */}
                <div className="flex justify-center">
                  <Button 
                    onClick={() => {
                      setShowHostAddVehicleForm(!showHostAddVehicleForm);
                      setEditingHostVehicle(null);
                      setFormData(initialFormState);
                    }}
                    className={`flex items-center gap-2 ${showHostAddVehicleForm ? 'bg-zinc-600 hover:bg-zinc-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all`}
                    data-testid="button-add-new-vehicle"
                  >
                    {showHostAddVehicleForm ? <X size={20} /> : <Plus size={20} />}
                    {showHostAddVehicleForm ? 'Close Form' : 'Add New Vehicle'}
                  </Button>
                </div>

                {/* Inventory */}
                <Card className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white">Inventory ({hostVehicles.length})</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase">Sort by:</span>
                      <select 
                        value={fleetSort} 
                        onChange={(e) => setFleetSort(e.target.value)}
                        className="p-1.5 sm:p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] sm:text-xs font-bold rounded-lg outline-none"
                      >
                        <option value="brand-asc">Brand (A-Z)</option>
                        <option value="brand-desc">Brand (Z-A)</option>
                        <option value="year-desc">Year (Newest)</option>
                        <option value="year-asc">Year (Oldest)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(() => {
                      const sortedHostVehicles = [...hostVehicles].sort((a: any, b: any) => {
                        if (fleetSort === 'brand-asc') return a.model.localeCompare(b.model);
                        if (fleetSort === 'brand-desc') return b.model.localeCompare(a.model);
                        if (fleetSort === 'year-asc') return (a.year || 0) - (b.year || 0);
                        if (fleetSort === 'year-desc') return (b.year || 0) - (a.year || 0);
                        return 0;
                      });
                      
                      return sortedHostVehicles.length > 0 ? (
                        sortedHostVehicles.map((car: any) => (
                          <div key={car.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden" data-testid={`card-host-vehicle-${car.id}`}>
                            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900">
                              <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">{car.model} {car.year}</h4>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {car.licensePlate && (
                                    <span className="text-[10px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded text-white border border-zinc-700 font-bold uppercase">
                                      PLATE: {car.licensePlate}
                                    </span>
                                  )}
                                  {car.vinNumber && (
                                    <span className="text-[10px] text-zinc-400 font-mono flex items-center bg-zinc-100 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                                      VIN: {car.vinNumber}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 truncate mt-1">{car.fuel} · {car.category} · {car.seats}p</p>
                                <p className="text-xs font-bold text-green-600 mt-1">${car.price}/d | {car.commission || 10}%</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => { 
                                  if (editingHostVehicle?.id === car.id) {
                                    setEditingHostVehicle(null);
                                    setFormData(initialFormState);
                                  } else {
                                    setShowHostAddVehicleForm(false);
                                    setEditingHostVehicle(car); 
                                    setFormData({
                                      model: car.model || '',
                                      year: car.year || new Date().getFullYear(),
                                      vinNumber: car.vinNumber || '',
                                      licensePlate: car.licensePlate || '',
                                      hostName: car.hostName || '',
                                      price: String(car.price || ''),
                                      fuel: car.fuel || 'Gasoline',
                                      seats: car.seats || 5,
                                      transmission: car.transmission || 'Automatic',
                                      category: car.category || '',
                                      consumption: car.consumption || '',
                                      driveType: car.driveType || 'AWD',
                                      isAWD: car.isAWD || false,
                                      hasCarPlay: car.hasCarPlay || false,
                                      hasBluetooth: car.hasBluetooth || false,
                                      hasReverseCamera: car.hasReverseCamera || false,
                                      hasHeatedSeats: car.hasHeatedSeats || false,
                                      hasHeatedSteering: car.hasHeatedSteering || false,
                                      hasElectricSeats: car.hasElectricSeats || false,
                                      hasPaddleShifters: car.hasPaddleShifters || false,
                                      hasKeylessEntry: car.hasKeylessEntry || false,
                                      hasBlindSpotWarning: car.hasBlindSpotWarning || false,
                                      hasDriveAssist: car.hasDriveAssist || false,
                                      hasUSBCharger: car.hasUSBCharger || false,
                                      isPriceMatch: car.isPriceMatch || false,
                                      images: car.images || [],
                                      commission: car.commission || 10,
                                      deductible: car.deductible || 1000,
                                      availableLocations: car.availableLocations || [],
                                      isDeliveryEnabled: car.isDeliveryEnabled || false,
                                      maxDeliveryDistance: car.maxDeliveryDistance || 50,
                                      minDeliveryFeeMiles: car.minDeliveryFeeMiles || 5,
                                      minDeliveryFee: car.minDeliveryFee || 15,
                                      deliveryPricePerMile: car.deliveryPricePerMile || 2.50,
                                      minDeliveryHours: car.minDeliveryHours || 6,
                                      locationLat: car.locationLat || null,
                                      locationLon: car.locationLon || null,
                                      pricing: car.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}
                                    });
                                    setHostVehicleImages(car.images || []);
                                  }
                                }} className="p-2 sm:p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all" data-testid={`button-edit-vehicle-${car.id}`}>
                                  <Edit size={20} className="sm:w-6 sm:h-6" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(car.id, car.model); }} className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50" data-testid={`button-delete-vehicle-${car.id}`}>
                                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs sm:text-sm text-zinc-500 text-center py-6 sm:py-8">No vehicles added yet</p>
                      );
                    })()}
                  </div>
                </Card>

                {/* Add/Edit Vehicle Form - Only shown when button clicked or editing */}
                {(showHostAddVehicleForm || editingHostVehicle) && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (formData.vinNumber.length !== 17) {
                      toast({ title: 'Error', description: 'VIN Number must be exactly 17 characters', variant: 'destructive' });
                      return;
                    }
                    const vehiclePricing = priceConfigForm ? {
                      taxes: priceConfigForm.taxes,
                      cleaningFee: priceConfigForm.cleaningFee,
                      includedMiles: priceConfigForm.includedMiles,
                      extraMileRate: priceConfigForm.extraMileRate,
                      prices: priceConfigForm.prices
                    } : formData.pricing;
                    const vehicleData = {
                      ...formData,
                      price: parseFloat(formData.price) || 0,
                      hostId: String(currentHost.id),
                      commission: formData.commission || 10,
                      deductible: formData.deductible || 1000,
                      locationLat: formData.locationLat || null,
                      locationLon: formData.locationLon || null,
                      pricing: vehiclePricing
                    };
                    if (editingHostVehicle) {
                      updateVehicleMutation.mutate({ id: editingHostVehicle.id, data: vehicleData });
                      setEditingHostVehicle(null);
                      setFormData(initialFormState);
                    } else {
                      createVehicleMutation.mutate(vehicleData);
                      setShowHostAddVehicleForm(false);
                      setFormData(initialFormState);
                    }
                  }} className="space-y-4 sm:space-y-6">
                    <Card className="p-3 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h3 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          {editingHostVehicle ? <Edit size={16} className="text-blue-500" /> : <Plus size={16} className="text-green-500" />}
                          {editingHostVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                        </h3>
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingHostVehicle(null);
                            setShowHostAddVehicleForm(false);
                            setFormData(initialFormState);
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
                          data-testid="button-cancel-edit"
                        >
                          <X size={14}/> Cancel
                        </button>
                      </div>
                      
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Car Model *</label>
                          <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="e.g. Tesla Model 3" required className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-vehicle-model" />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Year</label>
                            <input type="number" value={formData.year} onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})} placeholder="e.g. 2024" className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-vehicle-year" />
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">VIN Number * (17 chars)</label>
                            <input type="text" value={formData.vinNumber} onChange={(e) => setFormData({...formData, vinNumber: e.target.value.toUpperCase().slice(0, 17)})} placeholder="e.g. 1HGBH41JXMN109186" required minLength={17} maxLength={17} pattern="[A-HJ-NPR-Z0-9]{17}" title="VIN must be exactly 17 characters (letters A-Z except I, O, Q and numbers 0-9)" className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm font-mono ${formData.vinNumber.length === 17 ? 'border-green-500' : formData.vinNumber.length > 0 ? 'border-orange-500' : 'border-zinc-300 dark:border-zinc-700'}`} data-testid="input-host-vehicle-vin" />
                            {formData.vinNumber.length > 0 && formData.vinNumber.length !== 17 && (
                              <p className="text-[9px] text-orange-500 mt-0.5">{formData.vinNumber.length}/17 characters</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">License Plate</label>
                            <input type="text" value={formData.licensePlate} onChange={(e) => setFormData({...formData, licensePlate: e.target.value})} placeholder="e.g. ABC1234" className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-vehicle-plate" />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Daily Rate ($) *</label>
                            <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="e.g. 45" required className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-vehicle-price" />
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fuel Type</label>
                            <select value={formData.fuel} onChange={(e) => setFormData({...formData, fuel: e.target.value})} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm">
                              <option value="Gasoline">Gasoline</option>
                              <option value="Diesel">Diesel</option>
                              <option value="Electric">Electric</option>
                              <option value="Hybrid">Hybrid</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Seats</label>
                            <select value={formData.seats} onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value)})} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm">
                              <option value="2">2</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Transmission</label>
                            <select value={formData.transmission} onChange={(e) => setFormData({...formData, transmission: e.target.value})} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm">
                              <option value="Automatic">Automatic</option>
                              <option value="Manual">Manual</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Drive Type</label>
                          <select value={formData.driveType} onChange={(e) => setFormData({...formData, driveType: e.target.value})} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm">
                            <option value="AWD">AWD</option>
                            <option value="FWD">FWD</option>
                            <option value="RWD">RWD</option>
                            <option value="4WD">4WD</option>
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Consumption</label>
                            <input type="text" value={formData.consumption} onChange={(e) => setFormData({...formData, consumption: e.target.value})} placeholder="e.g. 300mi" className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-vehicle-consumption" />
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Category *</label>
                            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm">
                              <option value="">Select</option>
                              <option value="SEDAN">SEDAN</option>
                              <option value="SUV">SUV</option>
                              <option value="HATCHBACK">HATCH</option>
                              <option value="MINIVAN">MINIVAN</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider">Features</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.isAWD} onChange={(e) => setFormData({...formData, isAWD: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              AWD / 4x4
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasCarPlay} onChange={(e) => setFormData({...formData, hasCarPlay: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              CarPlay
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasBluetooth} onChange={(e) => setFormData({...formData, hasBluetooth: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Bluetooth
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasReverseCamera} onChange={(e) => setFormData({...formData, hasReverseCamera: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Camera
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasHeatedSeats} onChange={(e) => setFormData({...formData, hasHeatedSeats: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Heated Seats
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasHeatedSteering} onChange={(e) => setFormData({...formData, hasHeatedSteering: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Heated Wheel
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasElectricSeats} onChange={(e) => setFormData({...formData, hasElectricSeats: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Electric Seats
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasPaddleShifters} onChange={(e) => setFormData({...formData, hasPaddleShifters: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Paddle Shifters
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasKeylessEntry} onChange={(e) => setFormData({...formData, hasKeylessEntry: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Keyless Entry
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasBlindSpotWarning} onChange={(e) => setFormData({...formData, hasBlindSpotWarning: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Blind Spot
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasDriveAssist} onChange={(e) => setFormData({...formData, hasDriveAssist: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              Drive Assist
                            </label>
                            <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasUSBCharger} onChange={(e) => setFormData({...formData, hasUSBCharger: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                              USB Charger
                            </label>
                          </div>
                        </div>

                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin size={12} className="text-green-500"/> Pickup Locations
                          </label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                            {hostPickupLocations.map(loc => (
                              <span key={loc} className="inline-flex items-center gap-0.5 sm:gap-1 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold group">
                                <MapPin size={10} className="sm:w-3 sm:h-3"/> <span className="truncate max-w-[80px] sm:max-w-none">{formatAddressForDisplay(loc)}</span>
                                <button onClick={() => currentHost?.id && removeHostPickupLocationMutation.mutate({ location: loc, userId: String(currentHost.id) })} className="ml-0.5 sm:ml-1 p-0.5 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full" data-testid={`button-remove-location-${loc.replace(/\s+/g, '-')}`}>
                                  <X size={10} className="sm:w-3 sm:h-3 text-red-500"/>
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1.5 sm:gap-2">
                            <div className="flex-1">
                              <LocationAutocomplete 
                                value={hostNewLocation} 
                                onChange={(value, coords) => {
                                  setHostNewLocation(value);
                                  if (coords && coords.lat !== '0' && coords.lon !== '0') {
                                    setHostNewLocationCoords({ lat: parseFloat(coords.lat), lon: parseFloat(coords.lon) });
                                  }
                                }}
                                placeholder="Add location..."
                              />
                            </div>
                            <Button variant="primary" size="sm" onClick={async () => { 
                              if(!hostNewLocation.trim()) { toast({ title: 'Error', description: 'Please enter a location' }); return; } 
                              if(!currentHost?.id) { toast({ title: 'Error', description: 'Please log in as host first' }); return; }
                              
                              let coords = hostNewLocationCoords;
                              if (!coords) {
                                try {
                                  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(hostNewLocation.trim())}&countrycodes=us&limit=1`);
                                  const data = await response.json();
                                  if (data && data[0]) {
                                    coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
                                  }
                                } catch (e) { console.error('Geocoding error:', e); }
                              }
                              
                              if (coords && (!formData.locationLat || !formData.locationLon)) {
                                setFormData({...formData, locationLat: coords.lat, locationLon: coords.lon});
                              }
                              
                              addHostPickupLocationMutation.mutate({ location: hostNewLocation.trim(), userId: String(currentHost.id) }); 
                              setHostNewLocation(''); 
                              setHostNewLocationCoords(null);
                            }} data-testid="button-add-location">
                              <Plus size={14}/> <span className="hidden sm:inline">Add</span>
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider">Locations (Choose availables for this car)</label>
                          <div className="space-y-1.5 sm:space-y-2 max-h-24 overflow-y-auto">
                            {Array.from(new Set([...hostPickupLocations, ...(formData.availableLocations || [])])).map(loc => (
                              <label key={loc} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer" title={loc}>
                                <input type="checkbox" checked={formData.availableLocations?.includes(loc) || false} onChange={(e) => {
                                  const current = formData.availableLocations || [];
                                  setFormData({...formData, availableLocations: e.target.checked ? [...current, loc] : current.filter(l => l !== loc)});
                                }} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                                <span className="truncate">{formatAddressForDisplay(loc)}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider flex items-center gap-1.5">
                            <Route size={12} className="text-blue-500"/> Delivery to Guest
                          </label>
                          <label className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer mb-3">
                            <input type="checkbox" checked={formData.isDeliveryEnabled || false} onChange={(e) => setFormData({...formData, isDeliveryEnabled: e.target.checked})} className="w-3 h-3 sm:w-4 sm:h-4 accent-green-600" />
                            Allow Delivery to Customers?
                          </label>
                          {formData.isDeliveryEnabled && (
                            <div className="space-y-2 sm:space-y-3 bg-blue-50 dark:bg-blue-950/20 p-2 sm:p-3 rounded-lg">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase">Min Fee Amount ($)</label>
                                  <input type="number" step="0.01" value={formData.minDeliveryFee || 15} onChange={(e) => setFormData({...formData, minDeliveryFee: parseFloat(e.target.value) || 0})} className="w-full px-2 py-1 sm:py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs" data-testid="input-host-min-delivery-fee" />
                                </div>
                                <div>
                                  <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase">Min Fee Distance (Miles)</label>
                                  <input type="number" value={formData.minDeliveryFeeMiles || 5} onChange={(e) => setFormData({...formData, minDeliveryFeeMiles: parseInt(e.target.value) || 0})} className="w-full px-2 py-1 sm:py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs" data-testid="input-host-min-delivery-miles" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase">Price Per Mile ($)</label>
                                  <input type="number" step="0.01" value={formData.deliveryPricePerMile || 2.50} onChange={(e) => setFormData({...formData, deliveryPricePerMile: parseFloat(e.target.value) || 0})} className="w-full px-2 py-1 sm:py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs" data-testid="input-host-delivery-per-mile" />
                                </div>
                                <div>
                                  <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase">Max Distance (Miles)</label>
                                  <input type="number" value={formData.maxDeliveryDistance || 50} onChange={(e) => setFormData({...formData, maxDeliveryDistance: parseInt(e.target.value) || 0})} className="w-full px-2 py-1 sm:py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs" data-testid="input-host-max-delivery-distance" />
                                </div>
                              </div>
                              <div className="mt-2">
                                <label className="block text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase">Min Hours Advance for Delivery</label>
                                <input type="number" value={formData.minDeliveryHours || 6} onChange={(e) => setFormData({...formData, minDeliveryHours: parseInt(e.target.value) || 6})} className="w-full px-2 py-1 sm:py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs" data-testid="input-host-min-delivery-hours" />
                                <p className="text-[8px] text-zinc-500 mt-0.5">Minimum hours in advance required for delivery approval</p>
                              </div>
                              <p className="text-[9px] sm:text-[10px] text-zinc-500 italic mt-2">Ex: $15 up to 5mi, then $2.50/mi extra</p>
                            </div>
                          )}
                        </div>

                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider">Commission</label>
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className={`flex items-center p-2 sm:p-3 border rounded cursor-pointer transition-colors ${formData.commission === 15 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setFormData({...formData, commission: 15, deductible: 1250})}>
                              <input type="radio" name="commission" value="15" checked={formData.commission === 15} onChange={() => setFormData({...formData, commission: 15, deductible: 1250})} className="w-3 h-3 sm:w-4 sm:h-4" />
                              <div className="ml-2 sm:ml-3">
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">15%</p>
                                <p className="text-[10px] sm:text-xs text-zinc-500">$1250 Ded.</p>
                              </div>
                            </div>
                            <div className={`flex items-center p-2 sm:p-3 border rounded cursor-pointer transition-colors ${formData.commission === 20 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setFormData({...formData, commission: 20, deductible: 750})}>
                              <input type="radio" name="commission" value="20" checked={formData.commission === 20} onChange={() => setFormData({...formData, commission: 20, deductible: 750})} className="w-3 h-3 sm:w-4 sm:h-4" />
                              <div className="ml-2 sm:ml-3">
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">20%</p>
                                <p className="text-[10px] sm:text-xs text-zinc-500">$750 Ded.</p>
                              </div>
                            </div>
                            <div className={`flex items-center p-2 sm:p-3 border rounded cursor-pointer transition-colors ${formData.commission === 25 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setFormData({...formData, commission: 25, deductible: 500})}>
                              <input type="radio" name="commission" value="25" checked={formData.commission === 25} onChange={() => setFormData({...formData, commission: 25, deductible: 500})} className="w-3 h-3 sm:w-4 sm:h-4" />
                              <div className="ml-2 sm:ml-3">
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">25%</p>
                                <p className="text-[10px] sm:text-xs text-zinc-500">$500 Ded.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-3 sm:pt-4">
                          <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 sm:mb-2 uppercase tracking-wider">Photos ({formData.images.filter(img => img.trim()).length})</label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                            {formData.images.filter(img => img.trim()).map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img src={img} alt={`Photo ${idx+1}`} className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded border border-zinc-300 dark:border-zinc-700" />
                                <button type="button" onClick={() => setFormData({...formData, images: formData.images.filter((_, i) => i !== idx)})} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X size={10}/>
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  const newImages = formData.images[0] === '' ? [base64] : [...formData.images, base64];
                                  setFormData({...formData, images: newImages});
                                  e.target.value = '';
                                };
                                reader.readAsDataURL(file);
                              }
                            }} className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-[10px] sm:text-sm" data-testid="input-host-vehicle-photo-upload" />
                          </div>
                          <input type="text" placeholder="Paste URL + Enter" className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-[10px] sm:text-sm" onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                const newImages = formData.images[0] === '' ? [input.value.trim()] : [...formData.images, input.value.trim()];
                                setFormData({...formData, images: newImages});
                                input.value = '';
                              }
                            }
                          }} data-testid="input-host-vehicle-image-url" />
                        </div>
                      </div>
                    </Card>

                    {/* Price Configuration Section */}
                    <Card className="p-3 sm:p-6">
                      <h3 className="text-sm sm:text-lg font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
                        <DollarSign size={14} className="sm:w-[18px] sm:h-[18px] text-green-500"/>
                        Price Config
                      </h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Tax (%)</label>
                          <input type="number" step="0.1" value={priceConfigForm?.taxes || settings.taxes} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, taxes: parseFloat(e.target.value) || 0})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-taxes" />
                        </div>
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Clean ($)</label>
                          <input type="number" value={priceConfigForm?.cleaningFee || settings.cleaningFee} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, cleaningFee: parseFloat(e.target.value) || 0})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-cleaning-fee" />
                        </div>
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Miles/Day</label>
                          <input type="number" value={priceConfigForm?.includedMiles || settings.includedMiles} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, includedMiles: parseInt(e.target.value) || 0})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-included-miles" />
                        </div>
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">$/Extra Mi</label>
                          <input type="number" step="0.01" value={priceConfigForm?.extraMileRate ?? settings.extraMileRate} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, extraMileRate: parseFloat(e.target.value) || 0})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm" data-testid="input-host-extra-mile-rate" />
                        </div>
                      </div>
                      
                      <h4 className="text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 sm:gap-2">
                        <Shield size={12} className="sm:w-4 sm:h-4 text-blue-500"/>
                        Insurance
                      </h4>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">$500 Ded.</label>
                          <input type="text" value={priceConfigForm?.prices?.insurance500 || settings.prices.insurance500} disabled className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-xs sm:text-sm cursor-not-allowed opacity-60" data-testid="input-host-insurance-500" />
                        </div>
                        <div>
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">$1000 Ded.</label>
                          <input type="text" value={priceConfigForm?.prices?.insurance1000 || settings.prices.insurance1000} disabled className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-xs sm:text-sm cursor-not-allowed opacity-60" data-testid="input-host-insurance-1000" />
                        </div>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 sm:gap-2">
                        <Shield size={12} className="sm:w-4 sm:h-4 text-green-500"/>
                        Add-ons
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div className="p-2 sm:p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Child Seat</label>
                          <input type="number" value={priceConfigForm?.prices?.childSeat || settings.prices.childSeat} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeat: parseFloat(e.target.value) || 0}})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-1 sm:mb-2" data-testid="input-host-child-seat" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="childSeatBilling" checked={!(priceConfigForm?.prices?.childSeatPerTrip ?? settings.prices.childSeatPerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeatPerTrip: false}})} className="accent-green-500" />
                              /Day
                            </label>
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="childSeatBilling" checked={priceConfigForm?.prices?.childSeatPerTrip ?? settings.prices.childSeatPerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeatPerTrip: true}})} className="accent-green-500" />
                              /Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-2 sm:p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Prepaid Fuel</label>
                          <input type="number" value={priceConfigForm?.prices?.prepaidFuel ?? settings.prices.prepaidFuel} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuel: parseFloat(e.target.value) || 0}})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-1 sm:mb-2" data-testid="input-host-prepaid-fuel" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="prepaidFuelBilling" checked={!(priceConfigForm?.prices?.prepaidFuelPerTrip ?? settings.prices.prepaidFuelPerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuelPerTrip: false}})} className="accent-green-500" />
                              /Day
                            </label>
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="prepaidFuelBilling" checked={priceConfigForm?.prices?.prepaidFuelPerTrip ?? settings.prices.prepaidFuelPerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuelPerTrip: true}})} className="accent-green-500" />
                              /Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-2 sm:p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Late Grace 2hr</label>
                          <input type="number" value={priceConfigForm?.prices?.lateReturnGrace ?? settings.prices.lateReturnGrace} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGrace: parseFloat(e.target.value) || 0}})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-1 sm:mb-2" data-testid="input-host-late-return-grace" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="lateReturnGraceBilling" checked={!(priceConfigForm?.prices?.lateReturnGracePerTrip ?? settings.prices.lateReturnGracePerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGracePerTrip: false}})} className="accent-green-500" />
                              /Day
                            </label>
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="lateReturnGraceBilling" checked={priceConfigForm?.prices?.lateReturnGracePerTrip ?? settings.prices.lateReturnGracePerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGracePerTrip: true}})} className="accent-green-500" />
                              /Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-2 sm:p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/20">
                          <label className="block text-[9px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 uppercase tracking-wider">Stress-Free</label>
                          <p className="text-[8px] sm:text-[10px] text-zinc-400 mb-1 sm:mb-2">Fuel + Late Grace</p>
                          <input type="number" value={priceConfigForm?.prices?.stressFreePackage ?? settings.prices.stressFreePackage} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackage: parseFloat(e.target.value) || 0}})} className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm mb-1 sm:mb-2" data-testid="input-host-stress-free-package" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="stressFreePackageBilling" checked={!(priceConfigForm?.prices?.stressFreePackagePerTrip ?? settings.prices.stressFreePackagePerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackagePerTrip: false}})} className="accent-green-500" />
                              /Day
                            </label>
                            <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="stressFreePackageBilling" checked={priceConfigForm?.prices?.stressFreePackagePerTrip ?? settings.prices.stressFreePackagePerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackagePerTrip: true}})} className="accent-green-500" />
                              /Trip
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - At the very bottom */}
                      <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <Button variant="secondary" size="sm" className="flex-1 text-[10px] sm:text-sm" type="button" onClick={() => { setEditingHostVehicle(null); setShowHostAddVehicleForm(false); setFormData(initialFormState); }} data-testid="button-cancel-vehicle">Cancel</Button>
                        <Button variant="primary" size="sm" className="flex-1 text-[10px] sm:text-sm" type="submit" data-testid="button-save-vehicle">
                          <Check size={12} className="sm:w-4 sm:h-4"/> Save Update
                        </Button>
                      </div>
                    </Card>
                  </form>
                )}
              </div>
            );
          })()}

          {hostTab === 'bookings' && (() => {
            const hostVehicleIds = vehicles.filter(v => String(v.hostId) === String(currentHost.id)).map(v => v.id);
            const hostBookings = bookings.filter(b => {
              const bVehicleId = b.vehicleId ? String(b.vehicleId) : null;
              const isOwner = bVehicleId && hostVehicleIds.map(String).includes(bVehicleId);
              const hostEmail = currentHost.email?.toLowerCase().trim();
              const bookingHostEmail = (b.details as any)?.hostEmail?.toLowerCase().trim();
              const hostName = `${currentHost.firstName} ${currentHost.lastName}`.toLowerCase().trim();
              const bookingHostName = (b.details as any)?.hostName?.toLowerCase().trim();
              const bookingCarName = b.carName?.toLowerCase().trim();
              const hostVehicles = vehicles.filter(v => String(v.hostId) === String(currentHost.id));
              const matchesCarModel = hostVehicles.some(v => bookingCarName?.includes(v.model.toLowerCase().trim()));
              
              return isOwner || 
                     (hostEmail && bookingHostEmail && hostEmail === bookingHostEmail) ||
                     (hostName && bookingHostName && hostName === bookingHostName) ||
                     matchesCarModel;
            });
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - Bookings List */}
                <Card className="p-3 sm:p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">My Bookings ({hostBookings.length})</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Ordernar por Data</label>
                      <select value={bookingFilterType} onChange={(e) => setBookingFilterType(e.target.value as 'end-soon' | 'start-first')} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-host-booking-filter">
                        <option value="start-first">All (Newest First)</option>
                        <option value="end-soon">Ending Soon (3 days)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Status</label>
                      <select value={bookingFilterStatus} onChange={(e) => setBookingFilterStatus(e.target.value as any)} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-host-booking-status">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="pending-approval">Pending Approval</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Booking Number</label>
                      <input type="text" placeholder="Search code..." value={bookingFilterNumber} onChange={(e) => setBookingFilterNumber(e.target.value)} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="input-host-booking-number" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {hostBookings
                      .sort((a, b) => {
                        if (bookingFilterType === 'end-soon') {
                          const aDateTime = new Date(`${a.returnDate}T${a.returnTime}`).getTime();
                          const bDateTime = new Date(`${b.returnDate}T${b.returnTime}`).getTime();
                          return aDateTime - bDateTime;
                        } else {
                          // Default sort: Newest ID first (which usually means newest booking)
                          return Number(b.id) - Number(a.id);
                        }
                      })
                      .filter(b => {
                        let matches = true;
                        const normalizedBookingStatus = b.status?.toLowerCase().trim();
                        if (bookingFilterStatus) {
                          const status = bookingFilterStatus as string;
                          if (status === "active") matches = normalizedBookingStatus === 'active' || normalizedBookingStatus === 'extended';
                          else if (status === 'completed') matches = normalizedBookingStatus === 'completed';
                          else if (status === 'cancelled') matches = normalizedBookingStatus === 'cancelled';
                          else if (status === 'pending-approval') matches = normalizedBookingStatus === 'pending approval' || (b.details as any)?.deliveryApprovalStatus === 'pending';
                        }
                        if (bookingFilterNumber) {
                          const searchTerm = bookingFilterNumber.toLowerCase();
                          const matchesCode = b.bookingCode?.toLowerCase().includes(searchTerm) || false;
                          const driverName = (b.driver as any)?.name?.toLowerCase() || "";
                          const matchesName = driverName.includes(searchTerm);
                          if (!matchesCode && !matchesName) matches = false;
                        }
                        return matches;
                      })
                      .map(b => {
                        const statusColor = b.status === 'Completed' ? 'bg-green-600 text-white' : (b.status === 'Active' || b.status === 'Extended') ? 'bg-blue-400 text-white' : (b.status === 'Pending Approval' || (b.details as any)?.deliveryApprovalStatus === 'pending') ? 'bg-orange-400 text-white' : 'bg-zinc-500 text-white';
                        const statusText = b.status === 'Completed' ? 'COMPLETED' : b.status === 'Active' ? 'ACTIVE' : (b.status === 'Pending Approval' || (b.details as any)?.deliveryApprovalStatus === 'pending') ? 'PENDING APPROVAL' : b.status;
                        const pendingRequests = getPendingRequestsCount(b);
                        const unreadMessages = getUnreadMessagesCount(b, 'host');
                        const hasNotifications = b.status !== 'Cancelled' && (pendingRequests > 0 || unreadMessages > 0);
                        
                        const today = getTodayString();
                        const tomorrow = addDaysToDate(today, 1);
                        const returnDate = b.returnDate;
                        const pickupDate = b.startDate;
                        
                        const pickupIsToday = pickupDate === today;
                        const pickupIsTomorrow = pickupDate === tomorrow;
                        const returnIsToday = returnDate === today;
                        const returnIsTomorrow = returnDate === tomorrow;
                        
                        return (
                          <div key={b.id} onClick={() => { setHostManageBookingId(b.id); if (b.unread) markBookingAsReadMutation.mutate(b.id); }} className={`p-3 rounded-lg border cursor-pointer transition-colors relative ${hostManageBookingId === b.id ? 'border-blue-400 bg-blue-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'} ${b.unread ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`} data-testid={`card-host-booking-${b.id}`}>
                            {b.unread && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" title="New booking" />}
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {b.status !== 'Cancelled' && (pickupIsToday || pickupIsTomorrow || returnIsToday || returnIsTomorrow) && (
                                    <span className={`animate-pulse ${pickupIsToday || returnIsToday ? 'text-red-500' : 'text-yellow-500'}`} title={pickupIsToday || returnIsToday ? 'Today!' : 'Tomorrow!'}>
                                      <AlertTriangle size={14}/>
                                    </span>
                                  )}
                                  {hasNotifications && (
                                    <span className="text-yellow-500 animate-pulse" title={`${pendingRequests} pending requests, ${unreadMessages} unread messages`}>
                                      <AlertCircle size={14}/>
                                    </span>
                                  )}
                                  <span className="font-bold text-sm text-white">{b.bookingCode}</span>
                                </div>
                                <div className="text-xs text-zinc-400 font-medium">{b.carName}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{b.driver.name}</div>
                              </div>
                              <div className="text-right">
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${statusColor} block mb-2`}>{statusText}</span>
                                {b.status === 'Completed' && (() => {
                                  const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                                  return (
                                    <div className="text-[8px] text-zinc-400 space-y-1">
                                      {bookingRating?.stars && (
                                        <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); alert(bookingRating.comment ? `"${bookingRating.comment}"` : 'No comment provided'); }}>
                                          <div className="font-bold text-zinc-300">Guest</div>
                                          <div className="flex items-center gap-0.5 justify-end">
                                            {[1,2,3,4,5].map(star => (<span key={star} className={`${star <= (bookingRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}
                                          </div>
                                        </div>
                                      )}
                                      {bookingRating?.hostStarsToClient && (
                                        <div>
                                          <div className="font-bold text-zinc-300">Host</div>
                                          <div className="flex items-center gap-0.5 justify-end">
                                            {[1,2,3,4,5].map(star => (<span key={star} className={`${star <= (bookingRating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              <div>Pickup: {b.startDate} at {b.startTime}</div>
                              <div>Return: {b.returnDate} at {b.returnTime}</div>
                              {b.status !== 'Cancelled' && (pickupIsToday || pickupIsTomorrow) && (
                                <div className={`text-[9px] font-bold ${pickupIsToday ? 'text-red-400' : 'text-yellow-400'}`}>
                                  Pickup {pickupIsToday ? 'TODAY' : 'TOMORROW'}
                                </div>
                              )}
                              {b.status !== 'Cancelled' && (returnIsToday || returnIsTomorrow) && (
                                <div className={`text-[9px] font-bold ${returnIsToday ? 'text-red-400' : 'text-yellow-400'}`}>
                                  Return {returnIsToday ? 'TODAY' : 'TOMORROW'}
                                </div>
                              )}
                            </div>
                            {hasNotifications && (
                              <div className="mt-2 text-[10px] text-yellow-400 flex items-center gap-1">
                                <Bell size={10}/>
                                {pendingRequests > 0 && <span>{pendingRequests} request{pendingRequests > 1 ? 's' : ''}</span>}
                                {pendingRequests > 0 && unreadMessages > 0 && <span>|</span>}
                                {unreadMessages > 0 && <span>{unreadMessages} message{unreadMessages > 1 ? 's' : ''}</span>}
                              </div>
                            )}
                            {(b.details as any)?.deliveryApprovalStatus === 'pending' && (
                              <div className="mt-2 text-[10px] text-orange-400 flex items-center gap-1 font-bold">
                                <Route size={10}/> Delivery Pending Approval
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {hostBookings.length === 0 && (
                      <p className="text-sm text-zinc-500 text-center py-8">No bookings yet</p>
                    )}
                  </div>
                </Card>

                {/* Right Column - Booking Details */}
                <Card className="p-3 sm:p-6 md:col-span-2 max-h-[85vh] overflow-y-auto">
                  {hostManageBookingId ? (
                    (() => {
                      const b = hostBookings.find(bk => bk.id === hostManageBookingId);
                      if (!b) return null;
                      return (
                        <div className="space-y-4 sm:space-y-6">
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
                            <div>
                              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white" data-testid="text-host-booking-code">Booking {b.bookingCode}</h2>
                              <p className="text-xs sm:text-sm text-zinc-500">Total: <span className="text-green-500 font-bold">${b.total.toFixed(2)}</span></p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-left sm:text-right text-[10px] sm:text-xs text-zinc-500">
                                <div>{b.date}</div>
                                <div>{b.paymentMethod || 'Credit Card'}</div>
                              </div>
                              <button onClick={() => setHostManageBookingId(null)} className="px-3 py-1 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1" data-testid="button-close-host-booking">
                                <ChevronLeft size={14}/>
                                Close
                              </button>
                            </div>
                          </div>

                          {/* Customer & Rental Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Cliente</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.driver.name}</p>
                                <p className="text-zinc-500">{b.driver.phone}</p>
                                <p className="text-zinc-500">{b.driver.email}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Informações do Aluguel</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.carName}</p>
                                <p className="text-zinc-500">{formatDisplayDate(b.startDate, b.startTime)} to {formatDisplayDate(b.returnDate, b.returnTime)}</p>
                                <p className="text-zinc-500 font-bold">{ (b.details as any)?.deliveryType === 'delivery' ? 'Entrega' : 'Retirada' }</p>
                                <p className="text-zinc-500">{formatAddressForDisplay(b.location)}</p>
                                {(b.details as any)?.deliveryApprovalStatus === 'pending' && (
                                  <p className="text-orange-500 font-bold text-xs">Aguardando Aprovação</p>
                                )}
                                {(b.details as any)?.deliveryApprovalStatus === 'approved' && (
                                  <p className="text-green-500 font-bold text-xs">Entrega Aprovada</p>
                                )}
                                {(b.details as any)?.deliveryApprovalStatus === 'rejected' && (
                                  <p className="text-red-500 font-bold text-xs">Delivery Declined</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delivery Approval Section */}
                          {(b.details as any)?.deliveryType === 'delivery' && (b.details as any)?.deliveryApprovalStatus === 'pending' && (
                            <div className="p-4 rounded-lg border bg-orange-950/30 border-orange-900/50">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-3 text-orange-400">
                                <Route size={14}/> Delivery Approval Required
                              </h4>
                              <p className="text-sm text-zinc-300 mb-3">
                                Customer requested delivery to: <span className="font-bold text-white">{formatAddressForDisplay(b.location)}</span>
                              </p>
                              <p className="text-xs text-zinc-500 mb-4">
                                Delivery scheduled for: {formatDisplayDate(b.startDate, b.startTime)}
                              </p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDeliveryApproval(b.id, 'approved')}
                                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
                                  data-testid={`button-host-approve-delivery-${b.id}`}
                                >
                                  Approve Delivery
                                </button>
                                <button 
                                  onClick={() => handleDeliveryApproval(b.id, 'rejected')}
                                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                  data-testid={`button-host-reject-delivery-${b.id}`}
                                >
                                  Decline (Pickup Only)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Chat Messages */}
                          {(b.messages || []).length > 0 && (
                            <div className="p-4 rounded-lg border bg-zinc-900/50 border-zinc-800">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-4 text-zinc-400">
                                <MessageCircle size={14}/> Customer Messages
                              </h4>
                              <div className="max-h-48 overflow-y-auto space-y-2 mb-4" onClick={() => markMessagesAsRead(b.id, 'host')}>
                                {(b.messages || []).map(msg => (
                                  <div key={msg.id} className={`p-2 rounded-lg text-sm ${msg.sender === 'host' ? 'bg-green-900/30 border-l-2 border-green-500 ml-4' : 'bg-zinc-800 border-l-2 border-blue-500 mr-4'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                      <span className={`text-[10px] font-bold uppercase ${msg.sender === 'host' ? 'text-green-400' : 'text-blue-400'}`}>{msg.sender}</span>
                                      <span className="text-[10px] text-zinc-500">{new Date(msg.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-zinc-300">{msg.text}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={chatMessage}
                                  onChange={(e) => setChatMessage(e.target.value)}
                                  placeholder="Type a message..."
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                                  data-testid="input-host-message"
                                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(b.id, 'host')}
                                />
                                <button 
                                  onClick={() => sendChatMessage(b.id, 'host')}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                  data-testid="button-send-host-message"
                                >
                                  <Send size={16}/>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Client Requests */}
                          {(b.extensionRequests || []).filter(r => r.status === 'pending').length > 0 && (
                            <div className="p-4 rounded-lg border bg-yellow-950/30 border-yellow-900/50">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-4 text-yellow-400">
                                <AlertCircle size={14}/> Client Requests
                              </h4>
                              <div className="space-y-3">
                                {(b.extensionRequests || []).filter(r => r.status === 'pending').map(req => (
                                  <div key={req.id} className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <span className={`text-xs font-bold uppercase ${req.type === 'extension' ? 'text-blue-400' : 'text-orange-400'}`}>
                                          {req.type === 'extension' ? 'Extension Request' : 'Reduction Request'}
                                        </span>
                                        <div className="text-sm text-zinc-300 mt-1">
                                          New return: <span className="font-bold">{req.requestedReturnDate}</span> at <span className="font-bold">{req.requestedReturnTime}</span>
                                        </div>
                                        {req.reason && <div className="text-xs text-zinc-500 mt-1">Reason: {req.reason}</div>}
                                      </div>
                                      <div className="text-[10px] text-zinc-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button 
                                        onClick={() => handleExtensionRequestResponse(b.id, req.id, 'approved')}
                                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
                                        data-testid={`button-host-approve-${req.id}`}
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        onClick={() => handleExtensionRequestResponse(b.id, req.id, 'rejected')}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                        data-testid={`button-host-reject-${req.id}`}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* GUEST & HOST RATINGS SECTION */}
                          {b.status === 'Completed' && (() => {
                            const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                            return (
                              <div className="space-y-4">
                                {/* Guest's Rating of Host */}
                                {bookingRating?.stars && (
                                  <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                                    <div className="text-xs font-bold uppercase text-blue-400 mb-2">Guest's Rating of You</div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                          <span key={star} className={`text-sm ${star <= (bookingRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                                        ))}
                                      </div>
                                      <span className="text-sm font-bold text-white">{bookingRating.stars}/5</span>
                                    </div>
                                    {bookingRating.comment && (
                                      <p className="text-xs text-zinc-300 italic">"{bookingRating.comment}"</p>
                                    )}
                                  </div>
                                )}

                                {/* Rate Your Guest Button */}
                                {!bookingRating?.hostStarsToClient && (
                                  <button 
                                    onClick={() => { setSelectedBookingForRating(b.id); setShowRateGuestModal(true); setHostRatingStars(5); setHostRatingComment(''); }}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                                    data-testid={`button-rate-guest-${b.id}`}
                                  >
                                    Rate your Guest
                                  </button>
                                )}

                                {/* Your Rating of Guest */}
                                {bookingRating?.hostStarsToClient && (
                                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
                                    <div className="text-xs font-bold uppercase text-green-400 mb-2">Your Rating of Guest</div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                          <span key={star} className={`text-sm ${star <= (bookingRating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                                        ))}
                                      </div>
                                      <span className="text-sm font-bold text-white">{bookingRating.hostStarsToClient}/5</span>
                                    </div>
                                    {bookingRating?.hostCommentToClient && (
                                      <p className="text-xs text-zinc-300 italic">"{bookingRating.hostCommentToClient}"</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Manage Charges & Adjustments */}
                          <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Manage Charges & Adjustments</h4>
                            
                            <div className="mb-4">
                              <label className="text-xs text-zinc-500 mb-2 block">Apply Discount</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select 
                                  value={adjustment.type} 
                                  onChange={(e) => setAdjustment(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white sm:w-40" 
                                  data-testid="select-host-discount-type"
                                >
                                  <option value="fixed">Fixed Value ($)</option>
                                  <option value="percent">Percentage (%)</option>
                                </select>
                                <Input 
                                  placeholder="Value" 
                                  type="number"
                                  value={adjustment.value}
                                  onChange={(e: any) => setAdjustment(prev => ({ ...prev, value: e.target.value }))}
                                  className="flex-1 mb-0 text-xs" 
                                  data-testid="input-host-discount-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap" 
                                  onClick={() => handleApplyDiscount(b)}
                                  data-testid="button-host-apply-discount"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-zinc-500 mb-2 block">Add Extra Charge</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select 
                                  value={extraCharge.type}
                                  onChange={(e) => setExtraCharge(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white sm:w-40" 
                                  data-testid="select-host-charge-type"
                                >
                                  <option value="refuel">Refuel</option>
                                  <option value="mileage">Extra Mileage</option>
                                  <option value="damage">Damage</option>
                                  <option value="cleaning">Extra Cleaning</option>
                                  <option value="other">Other</option>
                                </select>
                                <Input 
                                  placeholder="Value ($)" 
                                  type="number"
                                  value={extraCharge.amount}
                                  onChange={(e: any) => setExtraCharge(prev => ({ ...prev, amount: e.target.value }))}
                                  className="flex-1 mb-0 text-xs" 
                                  data-testid="input-host-charge-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap" 
                                  onClick={() => handleAddCharge(b)}
                                  data-testid="button-host-charge"
                                >
                                  Add Charge
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Vehicle & License Evidence */}
                          <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Vehicle & License Evidence</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {/* Driver's License */}
                              <div>
                                <p className="text-xs font-bold text-zinc-400 mb-2">Driver's License</p>
                                <div className="flex gap-2 flex-wrap">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const licenseImages = fullBooking.driver?.licenseImages || [];
                                    const validImages = licenseImages.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    if (validImages.length > 0) {
                                      return validImages.map((img: string, idx: number) => (
                                        <div key={idx} className="relative group">
                                          <img src={img} alt={`License ${idx + 1}`} className="w-12 h-12 rounded border border-zinc-700 object-cover cursor-pointer hover:border-zinc-500 transition-colors" onClick={() => window.open(img, '_blank')} data-testid={`img-driver-license-${idx}`}/>
                                          <div className="absolute inset-0 rounded border border-green-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                        </div>
                                      ));
                                    } else if (licenseImages.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>

                              {/* Check-in Photos */}
                              <div>
                                <p className="text-xs font-bold text-zinc-400 mb-2">Check-in (Start)</p>
                                <div className="flex gap-2 flex-wrap">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const allPhotos = [...(fullBooking.checkInData?.photosOutside || []), ...(fullBooking.checkInData?.photosInside || [])];
                                    const validPhotos = allPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    if (validPhotos.length > 0) {
                                      return validPhotos.slice(0, 2).map((img: string, idx: number) => (
                                        <div key={idx} className="relative group">
                                          <img src={img} alt={`Check-in ${idx + 1}`} className="w-12 h-12 rounded border border-zinc-700 object-cover cursor-pointer hover:border-zinc-500 transition-colors" onClick={() => window.open(img, '_blank')} data-testid={`img-checkin-${idx}`}/>
                                          <div className="absolute inset-0 rounded border border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                        </div>
                                      ));
                                    } else if (allPhotos.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>

                              {/* Check-out Photos */}
                              <div>
                                <p className="text-xs font-bold text-zinc-400 mb-2">Check-out (End)</p>
                                <div className="flex gap-2 flex-wrap">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const allPhotos = [...(fullBooking.checkOutData?.photosOutside || []), ...(fullBooking.checkOutData?.photosInside || [])];
                                    const validPhotos = allPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    if (validPhotos.length > 0) {
                                      return validPhotos.slice(0, 2).map((img: string, idx: number) => (
                                        <div key={idx} className="relative group">
                                          <img src={img} alt={`Check-out ${idx + 1}`} className="w-12 h-12 rounded border border-zinc-700 object-cover cursor-pointer hover:border-zinc-500 transition-colors" onClick={() => window.open(img, '_blank')} data-testid={`img-checkout-${idx}`}/>
                                          {idx === 1 && (
                                            <button
                                              onClick={() => window.open(img, '_blank')}
                                              className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 rounded-full p-1 transition-colors"
                                              data-testid={`button-expand-checkout-${idx}`}
                                            >
                                              <ChevronRight size={12} className="text-white"/>
                                            </button>
                                          )}
                                        </div>
                                      ));
                                    } else if (allPhotos.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Financial Details */}
                          <div>
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Financial Details</h4>
                            <div className="space-y-4 text-sm">
                              {(() => {
                                const rate = b.details.rate || 0;
                                const extras = b.details.extras || 0;
                                const protection = b.details.protection || 0;
                                const cleaningFee = vehicles.find(v => v.id === b.vehicleId)?.pricing?.cleaningFee || settings.cleaningFee || 0;
                                const deliveryFee = (b.details as any).deliveryFee || 0;
                                const discount = b.details.discount || 0;
                                const subtotalBeforeTax = rate + extras + protection + cleaningFee + deliveryFee - discount;
                                const carForTax = vehicles.find(v => v.id === b.vehicleId);
                                const taxRate = carForTax?.pricing?.taxes || settings.taxes || 0;
                                const originalTax = subtotalBeforeTax > 0 ? subtotalBeforeTax * (taxRate / 100) : 0;
                                const originalBookingAmount = subtotalBeforeTax + originalTax;
                                
                                const extendedRate = b.details.extendedRate || 0;
                                const manualChargesTotal = Array.isArray(b.details.manualCharges) ? b.details.manualCharges.reduce((sum, c) => sum + c.amount, 0) : 0;
                                const extraPaymentsTotal = (b.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                                
                                return (
                                  <>
                                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                                      <div className="text-xs font-bold uppercase text-zinc-400 mb-2">Original Booking Amount</div>
                                      <div className="space-y-1 mb-2">
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Base Rate - {b.days} Days</span>
                                          <span>${rate.toFixed(2)}</span>
                                        </div>
                                        {extras > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Extras</span>
                                            <span>+${extras.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {protection > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Protection - {b.details?.protectionType || 'Standard'}</span>
                                            <span>+${protection.toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Cleaning Fee</span>
                                          <span>+${cleaningFee.toFixed(2)}</span>
                                        </div>
                                        {deliveryFee > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Delivery Fee Service</span>
                                            <span>+${deliveryFee.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {discount > 0 && (
                                          <div className="flex justify-between text-green-400 text-xs">
                                            <span>Discount Applied</span>
                                            <span>-${discount.toFixed(2)}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex justify-between text-zinc-400 text-xs border-t border-zinc-600 pt-2 mb-2">
                                        <span>Subtotal</span>
                                        <span>${subtotalBeforeTax.toFixed(2)}</span>
                                      </div>
                                      {originalTax > 0 && (
                                        <div className="flex justify-between text-purple-300 text-xs mb-2">
                                          <span>Tax</span>
                                          <span>+${originalTax.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-white font-bold border-t border-zinc-600 pt-2">
                                        <span>Initial Payment</span>
                                        <span>${originalBookingAmount.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    {(extendedRate > 0 || manualChargesTotal > 0 || extraPaymentsTotal > 0) && (
                                      <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700">
                                        <div className="text-xs font-bold uppercase text-zinc-400 mb-2">Additional Charges</div>
                                        <div className="space-y-1 mb-2">
                                          {extendedRate > 0 && (
                                            <div className="flex justify-between text-blue-300 text-xs">
                                              <span>Extended Days</span>
                                              <span>+${extendedRate.toFixed(2)}</span>
                                            </div>
                                          )}
                                          {b.details.manualCharges && b.details.manualCharges.map((c, i) => (
                                            <div key={i} className="flex justify-between text-orange-300 text-xs">
                                              <span className="flex items-center gap-1">
                                                {c.type}
                                                <button 
                                                  onClick={() => handleRemoveCharge(b, i)} 
                                                  className="text-red-400 hover:text-red-300"
                                                  data-testid={`button-host-remove-charge-${i}`}
                                                >
                                                  <X size={10}/>
                                                </button>
                                              </span>
                                              <span>+${c.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div className="bg-green-900/30 rounded-lg p-3 border border-green-700">
                                      <div className="flex justify-between text-green-400 font-bold">
                                        <span>TOTAL</span>
                                        <span>${b.total.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Rate Client Option */}
                          {b.status === 'Completed' && (() => {
                            const bookingRating = ratingsData.find(r => r.bookingId === b.id);
                            return bookingRating && !bookingRating.hostStarsToClient ? (
                              <button onClick={() => setRatingModal({ bookingId: b.id, vehicleId: b.vehicleId || 0, hostId: String(currentHost.id), clientName: b.driver.name, clientEmail: b.driver.email })} className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2" data-testid={`button-rate-client-${b.id}`}>
                                <span className="text-lg">★</span> Rate This Client
                              </button>
                            ) : null;
                          })()}

                          {/* Check-in / Check-out Status */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-lg border ${b.checkInStatus === 'completed' ? 'bg-green-950/30 border-green-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-3 text-zinc-500">
                                <Unlock size={14}/> Check-In Status
                              </h4>
                              {b.checkInStatus === 'completed' ? (
                                <div className="space-y-2">
                                  <p className="text-green-400 text-sm font-bold flex items-center gap-1"><Check size={14}/> Completed</p>
                                  {b.checkInData && (
                                    <>
                                      <p className="text-xs text-zinc-400">Miles: {b.checkInData.miles}</p>
                                      <p className="text-xs text-zinc-400">Gas: {b.checkInData.gas}</p>
                                      <p className="text-xs text-zinc-400">Photos: {(b.checkInData.photosOutside?.length || 0) + (b.checkInData.photosInside?.length || 0)}</p>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className="text-yellow-400 text-sm">Pending</p>
                              )}
                            </div>
                            <div className={`p-4 rounded-lg border ${b.checkOutStatus === 'completed' ? 'bg-green-950/30 border-green-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-3 text-zinc-500">
                                <Lock size={14}/> Check-Out Status
                              </h4>
                              {b.checkOutStatus === 'completed' ? (
                                <div className="space-y-2">
                                  <p className="text-green-400 text-sm font-bold flex items-center gap-1"><Check size={14}/> Completed</p>
                                  {b.checkOutData && (
                                    <>
                                      <p className="text-xs text-zinc-400">Miles: {b.checkOutData.miles}</p>
                                      <p className="text-xs text-zinc-400">Gas: {b.checkOutData.gas}</p>
                                      <p className="text-xs text-zinc-400">Photos: {(b.checkOutData.photosOutside?.length || 0) + (b.checkOutData.photosInside?.length || 0)}</p>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className="text-yellow-400 text-sm">Pending</p>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-20">
                      <List size={48} className="mb-4 opacity-30"/>
                      <p>Select a booking from the list to view details.</p>
                    </div>
                  )}
                </Card>
              </div>
            );
          })()}

          {hostTab === 'earnings' && (() => {
            const hostVehicleIds = vehicles.filter(v => String(v.hostId) === String(currentHost.id)).map(v => v.id);
            const hostVehicleMap = Object.fromEntries(vehicles.filter(v => v.hostId === String(currentHost.id)).map(v => [v.id, v]));
            const hostBookings = bookings.filter(b => b.vehicleId && hostVehicleIds.includes(Number(b.vehicleId)) && b.status === 'Completed');
            
            let totalGross = 0;
            let totalCommission = 0;
            
            hostBookings.forEach(b => {
              const vehicle = hostVehicleMap[b.vehicleId as unknown as number];
              const commission = vehicle ? (b.total * (vehicle.commission || 10) / 100) : (b.total * 0.10);
              totalGross += b.total;
              totalCommission += commission;
            });
            
            const netEarnings = totalGross - totalCommission;
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-6">
                  <Card className="p-2 sm:p-6 text-center">
                    <h4 className="text-[10px] sm:text-xs font-bold uppercase text-zinc-400 mb-1 sm:mb-2">Gross Earnings</h4>
                    <p className="text-lg sm:text-3xl font-bold text-blue-500">${totalGross.toFixed(2)}</p>
                    <p className="text-[9px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1">Total earnings</p>
                  </Card>
                  <Card className="p-2 sm:p-6 text-center">
                    <h4 className="text-[10px] sm:text-xs font-bold uppercase text-zinc-400 mb-1 sm:mb-2">Commission</h4>
                    <p className="text-lg sm:text-3xl font-bold text-orange-500">-${totalCommission.toFixed(2)}</p>
                    <p className="text-[9px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1">Platform fee</p>
                  </Card>
                  <Card className="p-2 sm:p-6 text-center">
                    <h4 className="text-[10px] sm:text-xs font-bold uppercase text-zinc-400 mb-1 sm:mb-2">Net Earnings</h4>
                    <p className="text-lg sm:text-3xl font-bold text-green-500">${netEarnings.toFixed(2)}</p>
                    <p className="text-[9px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1">Your profit</p>
                  </Card>
                </div>
                <Card className="p-6">
                  <h4 className="text-sm font-bold uppercase text-zinc-400 mb-4">Monthly Breakdown</h4>
                  <HostEarningsChart bookings={hostBookings} vehicles={vehicles.filter(v => v.hostId === String(currentHost.id))} />
                </Card>
              </div>
            );
          })()}

          {hostTab === 'chat' && (() => {
            const hostEmail = currentHost?.email || '';
            const hostUsername = currentHost?.username || '';
            const hostName = `${currentHost?.firstName || ''} ${currentHost?.lastName || ''}`.trim();
            // Handle both old format (email as senderIdentifier) and new format (@username)
            // Show ALL conversations (active and finished)
            const hostMessages = supportMessagesData.filter((m: any) => 
              m.senderType === 'host' && (m.senderIdentifier === hostEmail || m.senderIdentifier === `@${hostUsername}` || m.senderEmail === hostEmail)
            ).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            
            const hasMessages = hostMessages.length > 0;
            
            // Group by chatStartedAt (each unique chat session gets unique timestamp)
            const groupedMessages: Record<string, any[]> = {};
            hostMessages.forEach((msg: any) => {
              const chatTime = msg.chatStartedAt ? new Date(msg.chatStartedAt).getTime() : new Date(msg.createdAt).getTime();
              const groupKey = `${chatTime}`;
              if (!groupedMessages[groupKey]) {
                groupedMessages[groupKey] = [];
              }
              groupedMessages[groupKey].push(msg);
            });
            
            const sortedGroups = Object.entries(groupedMessages).sort((a, b) => new Date(b[1][0].createdAt).getTime() - new Date(a[1][0].createdAt).getTime());
            
            return (
              <div className="grid md:grid-cols-2 gap-6">
                {/* New Message Form */}
                <Card className="p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <MessageCircle className="text-green-500" size={20}/> Contact Support
                  </h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!hostChatForm.message.trim()) {
                      toast({ description: 'Please enter a message', variant: 'destructive' });
                      return;
                    }
                    
                    setHostChatSending(true);
                    try {
                      const messageData = {
                        senderType: 'host',
                        senderId: hostEmail,
                        senderName: hostName,
                        senderIdentifier: `@${hostUsername}`,
                        senderEmail: hostEmail,
                        subject: hostChatForm.subject,
                        text: hostChatForm.message,
                        images: hostChatImages,
                        read: false
                      };
                      await apiRequest('POST', '/api/support-messages', messageData);
                      queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                      setHostChatForm({ subject: 'Talk with Support', message: '' });
                      setHostChatImages([]);
                      toast({ description: 'Message sent successfully!' });
                    } catch (error) {
                      toast({ description: 'Error sending message', variant: 'destructive' });
                    } finally {
                      setHostChatSending(false);
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Subject *</label>
                      <select
                        value={hostChatForm.subject}
                        onChange={(e) => setHostChatForm(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                        data-testid="select-host-chat-subject"
                      >
                        <option value="Talk with Support">Talk with Support</option>
                        <option value="Suggestion">Suggestion</option>
                        <option value="Report an Issue">Report an Issue</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Message *</label>
                      <textarea
                        value={hostChatForm.message}
                        onChange={(e) => setHostChatForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Type your message here..."
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm resize-none"
                        rows={4}
                        required
                        data-testid="textarea-host-chat-message"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Attachments (optional)</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {hostChatImages.map((img, idx) => (
                          <div key={idx} className="relative w-16 h-16">
                            <img src={img} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-zinc-300 dark:border-zinc-700"/>
                            <button type="button" onClick={() => setHostChatImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={12}/></button>
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-green-500 transition-colors">
                        <Upload size={18} className="text-zinc-500"/>
                        <span className="text-sm text-zinc-500">Add Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              Array.from(files).forEach(file => {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({ description: 'File too large. Maximum 5MB per image.', variant: 'destructive' });
                                  return;
                                }
                                if (!file.type.startsWith('image/')) {
                                  toast({ description: 'Only images are allowed.', variant: 'destructive' });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  if (ev.target?.result) {
                                    setHostChatImages(prev => [...prev, ev.target!.result as string]);
                                  }
                                };
                                reader.onerror = () => {
                                  toast({ description: 'Error loading image.', variant: 'destructive' });
                                };
                                reader.readAsDataURL(file);
                              });
                            }
                          }}
                          data-testid="input-host-chat-attachments"
                        />
                      </label>
                    </div>
                    
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3" disabled={hostChatSending} data-testid="button-host-send-chat">
                      {hostChatSending ? <><Loader size={18} className="animate-spin"/> Sending...</> : <><Send size={18}/> Send Message</>}
                    </Button>
                  </form>
                </Card>

                {/* Conversations */}
                <Card className="p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="text-blue-500" size={20}/> Conversations
                  </h3>
                  
                  {!hasMessages ? (
                    <div className="text-center py-8 text-zinc-500">
                      <MessageCircle size={48} className="mx-auto mb-4 opacity-30"/>
                      <p>No conversations yet</p>
                      <p className="text-sm">Send your first message to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {sortedGroups.map(([groupKey, groupMsgs]) => {
                        const isExpanded = expandedHostChatGroups.has(groupKey);
                        const subject = groupMsgs[0]?.subject || 'No subject';
                        const chatStartedAt = groupMsgs[0]?.chatStartedAt ? new Date(groupMsgs[0].chatStartedAt) : new Date(groupMsgs[0]?.createdAt);
                        const dateStr = chatStartedAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                        const timeStr = chatStartedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                        const displayDate = `${dateStr} ${timeStr}`;
                        const hasUnreadAdminReply = groupMsgs.some((m: any) => m.adminReply && !m.read);
                        const hasUnreadSenderMsg = groupMsgs.some((m: any) => !m.read && !m.adminReply);
                        const allFinished = groupMsgs.every((m: any) => m.isFinished);
                        
                        // Finished conversation - show as completed
                        if (allFinished) {
                          return (
                            <div key={groupKey} className="border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                              <div className="px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{subject}</span>
                                  <span className="text-xs text-zinc-500">• {displayDate}</span>
                                  <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded">Finished</span>
                                </div>
                                {authUser?.isAdmin && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Delete entire "${subject}" conversation? This cannot be undone.`)) {
                                        try {
                                          setDeletingHostChatGroup(groupKey);
                                          for (const msg of groupMsgs) {
                                            await apiRequest('DELETE', `/api/support-messages/${msg.id}`, {});
                                          }
                                          queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                          toast({ description: 'Conversation deleted' });
                                        } catch (error) {
                                          toast({ description: 'Error deleting conversation', variant: 'destructive' });
                                        } finally {
                                          setDeletingHostChatGroup(null);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 text-[10px] bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded font-bold"
                                    data-testid={`button-delete-host-chat-${groupKey}`}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        
                        const hasAdminReply = groupMsgs.some((m: any) => m.adminReply && !m.read);
                        return (
                          <div key={groupKey} className={`border rounded-lg overflow-hidden ${hasAdminReply ? 'border-blue-600 bg-blue-600' : 'border-zinc-300 dark:border-zinc-600'}`}>
                            <button
                              onClick={async () => {
                                const newExpanded = new Set(expandedHostChatGroups);
                                if (isExpanded) {
                                  newExpanded.delete(groupKey);
                                } else {
                                  newExpanded.add(groupKey);
                                  // Mark unread messages as read when expanding
                                  const unreadMsgs = groupMsgs.filter((m: any) => m.adminReply && !m.read);
                                  for (const msg of unreadMsgs) {
                                    try {
                                      await apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true });
                                    } catch (error) {
                                      console.error('Error marking message as read:', error);
                                    }
                                  }
                                  if (unreadMsgs.length > 0) {
                                    queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                  }
                                }
                                setExpandedHostChatGroups(newExpanded);
                              }}
                              className={`w-full px-3 py-2 flex items-center justify-between transition-colors ${hasAdminReply ? 'hover:bg-blue-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                              data-testid={`button-expand-host-chat-${groupKey}`}
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}/>
                                <span className={`text-sm font-bold ${hasAdminReply ? 'text-white' : hasUnreadSenderMsg ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white'}`}>{subject}</span>
                                <span className={`text-xs ${hasAdminReply ? 'text-blue-100' : 'text-zinc-500'}`}>• {displayDate}</span>
                                {hasAdminReply && <span className="w-2 h-2 bg-blue-200 rounded-full animate-pulse"/>}
                                {hasUnreadSenderMsg && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}
                              </div>
                              {(() => {
                                const unreadCount = groupMsgs.filter((m: any) => m.adminReply && !m.read).length;
                                return unreadCount > 0 ? (
                                  <span className="text-xs font-bold px-1.5 py-0.5 bg-red-500 text-white rounded">{unreadCount}</span>
                                ) : (
                                  <span className="text-xs text-zinc-500">{groupMsgs.length} msg</span>
                                );
                              })()}
                            </button>
                            
                            {isExpanded && (
                              <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 space-y-3 bg-white dark:bg-zinc-900">
                                {groupMsgs.map((msg: any) => (
                                  <div key={msg.id} className="space-y-2">
                                    {/* Host message */}
                                    <div className="flex justify-end">
                                      <div className="bg-blue-600 text-white rounded-lg px-3 py-2 max-w-[80%]">
                                        <p className="text-sm">{msg.text?.replace(/\[.*?\]\s*/, '')}</p>
                                        <p className="text-[10px] opacity-70 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                                        {msg.images?.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {msg.images.map((img: string, i: number) => (
                                              <img key={i} src={img} alt="" className="w-12 h-12 object-cover rounded cursor-pointer" onClick={() => setSelectedImage(img)}/>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Admin reply */}
                                    {msg.adminReply && (
                                      <div className="flex justify-start">
                                        <div className="bg-zinc-200 dark:bg-zinc-700 rounded-lg px-3 py-2 max-w-[80%]">
                                          <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">Admin</p>
                                          <p className="text-sm text-zinc-900 dark:text-white">{msg.adminReply}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                
                                {/* Reply textarea */}
                                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <textarea
                                      value={hostChatReply}
                                      onChange={(e) => setHostChatReply(e.target.value)}
                                      placeholder="Type your reply..."
                                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm resize-none"
                                      rows={2}
                                      data-testid={`textarea-host-reply-${groupKey}`}
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={async () => {
                                          if (!hostChatReply.trim()) return;
                                          try {
                                            const messageData = {
                                              senderType: 'host',
                                              senderId: hostEmail,
                                              senderName: hostName,
                                              senderIdentifier: `@${hostUsername}`,
                                              senderEmail: hostEmail,
                                              subject: subject,
                                              text: hostChatReply,
                                              images: [],
                                              read: false
                                            };
                                            await apiRequest('POST', '/api/support-messages', messageData);
                                            queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                            setHostChatReply('');
                                            toast({ description: 'Reply sent!' });
                                          } catch (error) {
                                            toast({ description: 'Error sending reply', variant: 'destructive' });
                                          }
                                        }}
                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm flex items-center justify-center gap-2"
                                        data-testid={`button-send-host-reply-${groupKey}`}
                                      >
                                        <Send size={14}/> Send
                                      </button>
                                      {finishingHostChatGroup === groupKey ? (
                                        <div className="flex-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded space-y-2">
                                          <p className="text-xs font-bold text-yellow-900 dark:text-yellow-300">Finish this conversation? It cannot be reopened.</p>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => setFinishingHostChatGroup(null)}
                                              className="flex-1 px-2 py-1 bg-zinc-400 hover:bg-zinc-500 text-white font-bold rounded text-xs"
                                              data-testid={`button-cancel-finish-host-chat-${groupKey}`}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const chatStartedAtFromGroup = groupMsgs[0]?.chatStartedAt;
                                                  await apiRequest('POST', '/api/support-messages/finish-group', {
                                                    subject: subject,
                                                    senderId: hostEmail,
                                                    finishedBy: 'host',
                                                    chatStartedAt: chatStartedAtFromGroup
                                                  });
                                                  queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                                  const newExpanded = new Set(expandedHostChatGroups);
                                                  newExpanded.delete(groupKey);
                                                  setExpandedHostChatGroups(newExpanded);
                                                  setFinishingHostChatGroup(null);
                                                  toast({ description: 'Chat finished. All messages closed.' });
                                                } catch (error) {
                                                  toast({ description: 'Error finishing chat', variant: 'destructive' });
                                                }
                                              }}
                                              className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded text-xs"
                                              data-testid={`button-confirm-finish-host-chat-${groupKey}`}
                                            >
                                              Confirm
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setFinishingHostChatGroup(groupKey)}
                                          className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-bold rounded text-sm flex items-center gap-1"
                                          data-testid={`button-finish-host-chat-${groupKey}`}
                                        >
                                          <CheckCircle size={14}/> Finish Chat
                                        </button>
                                      )}
                                    </div>
                                  </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            );
          })()}
        </div>
      )}

      <main className="pt-20 pb-20">
        {view === 'home' && (
          <>
            <div className="relative h-auto min-h-[500px] sm:min-h-[600px] w-full overflow-visible flex items-center justify-center py-8 sm:py-0">
              <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1471479917193-f00955256257?auto=format&fit=crop&w=2000&q=80')` }}></div>
              <div className="absolute inset-0 bg-black/40 z-10"></div>
              <div className="relative z-20 max-w-7xl w-full px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-start lg:items-center">
                <div className="text-left pt-6 sm:pt-0">
                  <span className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 sm:mb-2">Host and Rent For The Best Prices</span>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 sm:mb-4" data-testid="text-hero-title">The Best car rental prices in Fairfield County <br/><span className="text-green-500">Starting from $39/day</span></h1>
                  <p className="text-xs sm:text-base lg:text-lg text-zinc-200 max-w-xl mb-6 sm:mb-8">Premium vehicles at unbeatable prices. Book your ride in just 3 simple steps.</p>
                </div>
                <Card className="p-4 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur w-full">
                  <h3 className="text-base sm:text-lg font-bold mb-4 text-zinc-900 dark:text-white">Find Your Perfect Ride</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Pick-up Location</label>
                      <div className="relative">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white">
                              <div className="pl-2 sm:pl-3"><MapPin size={16} className="text-green-600" /></div>
                              <input
                                ref={locationInputRef}
                                type="text"
                                value={locationQuery}
                                onChange={(e) => handleLocationSearch(e.target.value)}
                                onFocus={() => locationSuggestions.length > 0 && setShowLocationDropdown(true)}
                                placeholder="Enter city or address..."
                                className="bg-transparent w-full p-2 sm:p-3 outline-none text-xs sm:text-sm"
                                data-testid="input-location-search"
                              />
                              {locationQuery && (
                                <button
                                  onClick={() => { setLocationQuery(''); setUserCoords(null); setSearchParams(prev => ({ ...prev, location: '' })); setShowVehiclesMap(false); }}
                                  className="pr-2 text-zinc-400 hover:text-zinc-600"
                                  data-testid="button-clear-location"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            {showLocationDropdown && locationSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {locationSuggestions.map((suggestion, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => selectLocation(suggestion)}
                                    className="w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white flex items-center gap-2"
                                    data-testid={`button-location-suggestion-${idx}`}
                                  >
                                    <MapPin size={12} className="text-green-500 flex-shrink-0" />
                                    <span className="truncate">{formatAddressForDisplay(suggestion.display_name)}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={getCurrentLocation}
                            disabled={isGettingLocation}
                            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex-shrink-0"
                            title="Use Current Location"
                            data-testid="button-current-location"
                          >
                            {isGettingLocation ? <Loader size={18} className="animate-spin" /> : <Navigation size={18} />}
                          </button>
                        </div>
                        {userCoords && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => setShowVehiclesMap(!showVehiclesMap)}
                              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                              data-testid="button-toggle-map"
                            >
                              <Map size={12} />
                              {showVehiclesMap ? 'Hide Map' : 'Show Map'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Pick-up Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 sm:px-2 sm:py-1.5 cursor-pointer" onClick={(e) => {if ((e.target as HTMLElement).tagName !== 'INPUT') (document.querySelector('[data-testid="input-start-date"]') as HTMLElement)?.click()}}>
                          <Calendar size={13} className="text-black dark:text-white mr-1 flex-shrink-0 cursor-pointer" />
                          <input type="date" value={searchParams.start} onChange={e => handleSearchParamsChange('start', e.target.value)} min={getTodayString()} className="bg-transparent w-full outline-none text-xs sm:text-sm text-zinc-900 dark:text-white cursor-pointer" data-testid="input-start-date" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Return Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 sm:px-2 sm:py-1.5 cursor-pointer" onClick={(e) => {if ((e.target as HTMLElement).tagName !== 'INPUT') (document.querySelector('[data-testid="input-end-date"]') as HTMLElement)?.click()}}>
                          <Calendar size={13} className="text-black dark:text-white mr-1 flex-shrink-0 cursor-pointer" />
                          <input type="date" value={searchParams.end} onChange={e => handleSearchParamsChange('end', e.target.value)} min={searchParams.start} className="bg-transparent w-full outline-none text-xs sm:text-sm text-zinc-900 dark:text-white cursor-pointer" data-testid="input-end-date" />
                        </div>
                      </div>
                    </div>
                    <Button className="w-full py-2 sm:py-4 text-xs sm:text-sm" onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                      {isSearching ? <><Loader className="animate-spin" size={16}/> Searching...</> : <><Search size={16}/> Search Vehicles</>}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            {/* Interactive Map Section */}
            {showVehiclesMap && userCoords && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Map size={20} className="text-green-600" />
                    Vehicles Near You
                  </h3>
                  <button
                    onClick={() => setShowVehiclesMap(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                    data-testid="button-close-map"
                  >
                    <X size={14} /> Close Map
                  </button>
                </div>
                <div className="relative bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                  {(() => {
                    // Custom marker icon for user location
                    const userIcon = L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                      iconSize: [20, 20],
                      iconAnchor: [10, 10],
                    });
                    
                    // Get vehicles with coordinates from database or deterministic fallback
                    const vehiclesWithCoords = vehicles
                      .map(v => {
                        let lat, lon;
                        // Use real coordinates from database if available
                        if (v.locationLat !== null && v.locationLat !== undefined && v.locationLon !== null && v.locationLon !== undefined) {
                          lat = v.locationLat;
                          lon = v.locationLon;
                        } else {
                          // Fallback to deterministic offset based on vehicle ID
                          const seed = v.id * 0.01;
                          const latOffset = (Math.sin(seed * 13.7) * 0.05);
                          const lonOffset = (Math.cos(seed * 17.3) * 0.05);
                          lat = userCoords.lat + latOffset;
                          lon = userCoords.lon + lonOffset;
                        }
                        return {
                          ...v,
                          coords: { lat, lon },
                          distance: 0
                        };
                      })
                      .map(v => ({
                        ...v,
                        distance: haversineDistance(userCoords.lat, userCoords.lon, v.coords.lat, v.coords.lon)
                      }))
                      .sort((a, b) => a.distance - b.distance);
                    
                    return (
                      <MapContainer
                        center={[userCoords.lat, userCoords.lon]}
                        zoom={12}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {/* User location marker */}
                        <Marker position={[userCoords.lat, userCoords.lon]} icon={userIcon}>
                          <Popup>
                            <div className="text-center">
                              <strong>Your Location</strong>
                            </div>
                          </Popup>
                        </Marker>
                        {/* Vehicle markers */}
                        {vehiclesWithCoords.slice(0, 10).map((v) => {
                          const isSelected = selectedMapVehicle === v.id;
                          const carIcon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="background-color: #000000; color: white; padding: 2px 6px; border-radius: 50%; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; display: flex; align-items: center; justify-content: center; height: 28px; width: 38px; ${isSelected ? 'border: 3px solid #22c55e;' : ''}">$ ${v.price}</div>`,
                            iconSize: [38, 28],
                            iconAnchor: [19, 14],
                          });
                          return (
                            <Marker key={v.id} position={[v.coords.lat, v.coords.lon]} icon={carIcon} eventHandlers={{ click: () => setSelectedMapVehicle(isSelected ? null : v.id) }}>
                              <Popup>
                                <div className="text-center">
                                  <img src={v.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=100&q=60'} alt={v.model} className="w-24 h-16 object-cover rounded mb-2" />
                                  <strong>{v.model}</strong>
                                  <div className="text-green-600 font-bold">${v.price}/day</div>
                                  <div className="text-xs text-zinc-500">{v.distance.toFixed(1)} miles away</div>
                                  <button
                                    onClick={() => handleViewDetails(v)}
                                    className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Benefits Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 sm:mt-20 scroll-mt-32">
              <div className="text-center mb-12 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-white mb-3 sm:mb-4" data-testid="text-benefits-title">Why Choose CarHopGo?</h2>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">The best car rental experience with incredible benefits for both renters and hosts</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Benefit 1: Best Prices */}
                <div>
                  <div className="cursor-pointer" onClick={() => setExpandedBenefit(expandedBenefit === 'prices' ? null : 'prices')}>
                    <Card className={`p-5 sm:p-6 hover-elevate h-full ${expandedBenefit === 'prices' ? 'ring-2 ring-green-500' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <DollarSign size={24} className="text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">Best Market Prices</h3>
                          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500">{expandedBenefit === 'prices' ? 'Click to collapse' : 'Click to expand'}</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-3">Unbeatable rates compared to traditional rental agencies. Save up to 40% on daily rentals.</p>
                    </Card>
                  </div>
                  {expandedBenefit === 'prices' && (
                    <>
                      <div className="flex justify-center py-2">
                        <div className="w-1 h-3 bg-green-600 rounded-full"></div>
                      </div>
                      <div className="space-y-2 bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-900/30">
                        {['Up to 40% savings vs Another Plataforms', 'Cheap Prices', 'No hidden fees', 'Transparent pricing upfront', 'Seasonal promotions', 'Fuel-saver car collection'].map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                            <Check size={16} className="text-green-600 flex-shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Benefit 2: Fewer Fees */}
                <div>
                  <div className="cursor-pointer" onClick={() => setExpandedBenefit(expandedBenefit === 'fees' ? null : 'fees')}>
                    <Card className={`p-5 sm:p-6 hover-elevate h-full ${expandedBenefit === 'fees' ? 'ring-2 ring-blue-500' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <TrendingUp size={24} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">Fewer Fees</h3>
                          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500">{expandedBenefit === 'fees' ? 'Click to collapse' : 'Click to expand'}</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-3">Transparent pricing with minimal hidden charges. Only pay for what you use.</p>
                    </Card>
                  </div>
                  {expandedBenefit === 'fees' && (
                    <>
                      <div className="flex justify-center py-2">
                        <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                      </div>
                      <div className="space-y-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-900/30">
                        {['No booking fees', 'No cancellation charges with Less than 6 Hours', 'Flexible payment options', 'No hidden admin costs', 'Transparent tax breakdown'].map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                            <Check size={16} className="text-blue-600 flex-shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Benefit 3: Easy Booking */}
                <div>
                  <div className="cursor-pointer" onClick={() => setExpandedBenefit(expandedBenefit === 'booking' ? null : 'booking')}>
                    <Card className={`p-5 sm:p-6 hover-elevate h-full ${expandedBenefit === 'booking' ? 'ring-2 ring-purple-500' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <Smartphone size={24} className="text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">Easy Booking</h3>
                          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500">{expandedBenefit === 'booking' ? 'Click to collapse' : 'Click to expand'}</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-3">Simple 3-step booking process. Rent your perfect car in minutes, not hours.</p>
                    </Card>
                  </div>
                  {expandedBenefit === 'booking' && (
                    <>
                      <div className="flex justify-center py-2">
                        <div className="w-1 h-3 bg-purple-600 rounded-full"></div>
                      </div>
                      <div className="space-y-2 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-900/30">
                        {['Book in under 3 minutes', 'Mobile-friendly interface !', 'Delivery System Option !', 'Easy Steps to checkout process', 'Email Confirmation booking', 'Multiple payment methods', 'Flexible date selection', 'Automatic receipt generation', 'Customer support Chat'].map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                            <Check size={16} className="text-purple-600 flex-shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Benefit 4: Best Host Program */}
                <div>
                  <div className="cursor-pointer" onClick={() => setExpandedBenefit(expandedBenefit === 'host' ? null : 'host')}>
                    <Card className={`p-5 sm:p-6 hover-elevate h-full ${expandedBenefit === 'host' ? 'ring-2 ring-orange-500' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                          <Building2 size={24} className="text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white">Best Host Program 2026</h3>
                          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500">{expandedBenefit === 'host' ? 'Click to collapse' : 'Click to expand'}</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-3">Most profitable hosting program with complete management tools and support.</p>
                    </Card>
                  </div>
                  {expandedBenefit === 'host' && (
                    <>
                      <div className="flex justify-center py-2">
                        <div className="w-1 h-3 bg-orange-600 rounded-full"></div>
                      </div>
                      <div className="space-y-2 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-900/30">
                        {['Up to 40% Cheaper Comission Fees vs Another Platforms', 'More money in your pocket', 'Cheap Fees with low Deductible', 'Earn up to 30% More than Another Platform', 'Customized Car Options with Cleaning Fees & Child Chair', 'Customized Booking management', 'Professional insurance coverage included', 'Host to Admin support team', 'Marketing & promotion included', 'Maintenance coordination service', 'Guest screening & verification', 'Biweekly or Monthly Payouts'].map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                            <Check size={16} className="text-orange-600 flex-shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div id="fleet" className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16 scroll-mt-32">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white" data-testid="text-fleet-title">Our Fleet</h2>
                  <p className="text-xs sm:text-sm text-zinc-500">
                    {userCoords ? 'Vehicles sorted by distance from you' : 'Choose from our wide selection of vehicles'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {(() => {
                  // When user coordinates are available via geolocation, show all vehicles sorted by distance
                  // Otherwise, filter by availableLocations if a location is selected
                  let filteredVehicles = vehicles;
                  
                  if (!userCoords && searchParams.location) {
                    filteredVehicles = vehicles.filter(car => {
                      if (!car.availableLocations) return true;
                      if (car.availableLocations.length === 0) return true;
                      return car.availableLocations.includes(searchParams.location);
                    });
                  }
                  
                  // Sort by distance if user coordinates are available
                  if (userCoords) {
                    filteredVehicles = filteredVehicles.map(car => {
                      // Deterministic offset based on vehicle ID for consistent positioning
                      const seed = car.id * 0.01;
                      const latOffset = (Math.sin(seed * 13.7) * 0.05);
                      const lonOffset = (Math.cos(seed * 17.3) * 0.05);
                      const carLat = userCoords.lat + latOffset;
                      const carLon = userCoords.lon + lonOffset;
                      const distance = haversineDistance(userCoords.lat, userCoords.lon, carLat, carLon);
                      return { ...car, _distance: distance, _coords: { lat: carLat, lon: carLon } };
                    }).sort((a: any, b: any) => a._distance - b._distance);
                  }
                  
                  return filteredVehicles.map((car: any) => (
                  <div key={car.id} onClick={() => handleViewDetails(car)} data-testid={`card-vehicle-${car.id}`}>
                    <Card className="group cursor-pointer hover-elevate overflow-visible">
                      <div className="relative overflow-hidden rounded-t-lg">
                        <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60'} alt={car.model} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate flex-1" data-testid={`text-vehicle-name-${car.id}`}>
                            {car.model} {car.year}
                            {car.hostName && <span className="text-zinc-500 font-normal"> - {car.hostName}</span>}
                          </h3>
                          <div className="text-right flex-shrink-0">
                            <div className="text-base sm:text-xl font-bold text-green-600" data-testid={`text-vehicle-price-${car.id}`}>${car.price}</div>
                            <div className="text-[9px] sm:text-xs text-zinc-500">/day</div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400 mb-2 flex-wrap">
                          <span className="flex items-center gap-1"><Users size={14}/> {car.seats} passengers</span>
                          <span className="flex items-center gap-1">
                            {car.driveType === 'AWD' && <Car size={14} />}
                            {car.driveType === 'FWD' && <Navigation size={14} />}
                            {car.driveType === 'RWD' && <Navigation size={14} className="transform rotate-180" />}
                            {car.driveType}
                          </span>
                          <span className="flex items-center gap-1"><Gauge size={14}/> {car.consumption}</span>
                          <span className="flex items-center gap-1"><Zap size={14}/> {car.transmission}</span>
                        </div>
                        {(() => {
                          const vehicleRatings = ratingsData.filter(r => r.vehicleId === car.id);
                          if (vehicleRatings.length === 0) return null;
                          const avgRating = vehicleRatings.reduce((sum, r) => sum + r.stars, 0) / vehicleRatings.length;
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewingVehicleRatings(car.id); }}
                              className="flex items-center gap-1 text-xs mb-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 rounded transition-colors"
                              data-testid={`button-view-ratings-${car.id}`}
                            >
                              <div className="flex">
                                {[1,2,3,4,5].map(star => (
                                  <span key={star} className={`text-xs ${star <= Math.round(avgRating) ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}>★</span>
                                ))}
                              </div>
                              <span className="text-zinc-500">{avgRating.toFixed(1)} ({vehicleRatings.length} reviews)</span>
                            </button>
                          );
                        })()}
                        <Button className="w-full text-xs sm:text-sm py-2 sm:py-3" onClick={(e: any) => { e.stopPropagation(); handleRent(car); }} data-testid={`button-rent-${car.id}`}>Book Now</Button>
                      </div>
                    </Card>
                  </div>
                ));
                })()}
              </div>
            <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16 pt-8 pb-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Copyright © All Rights Reserved 2025
            </footer>
            </div>
          </>
        )}

        {view === 'admin' && (
          <div className="max-w-7xl mx-auto px-2 sm:px-6 py-8">
            <div className="flex items-start justify-between mb-8 gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white" data-testid="text-admin-title">Admin {adminUnit === '01' && 'Matriz'}</h1>
            </div>
            
            <div className="flex justify-start gap-0.5 sm:gap-1 md:gap-2 mb-6 overflow-x-auto pb-2 px-0 sm:px-2">
              {['fleet', 'bookings', 'clients', 'hosts', 'earnings', 'support'].map(tab => {
                const unreadSupportCount = tab === 'support' ? supportMessagesData.filter((m: any) => !m.read).length : 0;
                return (
                <button key={tab} onClick={() => { setAdminTab(tab); setSelectedClient(null); setSelectedHost(null); window.scrollTo(0, 0); }} className={`relative flex flex-col items-center gap-0.5 md:gap-1 px-2 sm:px-3 py-2 rounded-lg font-bold text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${adminTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-tab-${tab}`}>
                  <div className="hidden md:block">
                    {tab === 'fleet' && <Car size={18} />}
                    {tab === 'bookings' && <Briefcase size={18} />}
                    {tab === 'clients' && <Users size={18} />}
                    {tab === 'hosts' && <Building2 size={18} />}
                    {tab === 'earnings' && <TrendingUp size={18} />}
                    {tab === 'support' && <MessageSquare size={18} />}
                  </div>
                  <div className="md:hidden">
                    {tab === 'fleet' && <Car size={14} />}
                    {tab === 'bookings' && <Briefcase size={14} />}
                    {tab === 'clients' && <Users size={14} />}
                    {tab === 'hosts' && <Building2 size={14} />}
                    {tab === 'earnings' && <TrendingUp size={14} />}
                    {tab === 'support' && <MessageSquare size={14} />}
                  </div>
                  <div className="relative">
                    <span>{tab === 'support' ? 'Chat' : tab}</span>
                    {tab === 'support' && supportMessagesData.filter((m: any) => !m.read && !m.adminReply).length > 0 && (
                      <span className="absolute -top-4 -right-1 w-4 h-4 bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                        !
                      </span>
                    )}
                  </div>
                </button>
              );})}
            </div>

            {adminTab === 'fleet' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Add New Vehicle Button */}
                <div className="flex justify-start">
                  <Button 
                    onClick={() => { setShowAddVehicleForm(!showAddVehicleForm); setEditingId(null); setFormData(initialFormState); setPricingStrings(defaultPricingStrings); }}
                    variant={showAddVehicleForm ? "secondary" : "primary"}
                    className="flex items-center gap-2"
                    data-testid="button-toggle-add-vehicle"
                  >
                    {showAddVehicleForm ? <X size={16}/> : <Plus size={16}/>}
                    {showAddVehicleForm ? 'Cancel' : 'Add New Vehicle'}
                  </Button>
                </div>

                {/* Pickup Locations - Admin Fleet - Only show when adding/editing */}
                {(showAddVehicleForm || editingId) && (
                  <Card className="p-3 sm:p-6 border-2 border-green-500/30">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-green-500"/>
                        Pickup Locations
                      </div>
                      <button 
                        onClick={() => { setShowAddVehicleForm(false); setEditingId(null); }}
                        className="text-zinc-500 hover:text-red-500 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
                      <LocationAutocomplete value={newLocation} onChange={(val, coords) => { setNewLocation(val); if (coords && coords.lat !== '0' && coords.lon !== '0') { setNewLocationCoords({ lat: parseFloat(coords.lat), lon: parseFloat(coords.lon) }); } }} placeholder="Enter pickup address (e.g. JFK Airport)" />
                      <Button onClick={addLocation} variant="secondary" className="w-full sm:w-auto" data-testid="button-add-location">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                      {settings.locations.map(loc => (
                        <span key={loc} className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-full text-sm" title={loc}>
                          {formatAddressForDisplay(loc)}
                          <button onClick={() => removeLocation(loc)} className="text-zinc-400 hover:text-red-500 ml-1" data-testid={`button-remove-location-${loc}`}><X size={14}/></button>
                        </span>
                      ))}
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => {}}>Save Locations</Button>
                  </Card>
                )}

                {/* Add New Vehicle Form - Located here ABOVE inventory */}
                {showAddVehicleForm && !editingId && (
                  <Card className="p-4 sm:p-6 border-2 border-green-500/50 shadow-xl bg-white dark:bg-zinc-900">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <PlusCircle className="text-green-500" size={24} /> 
                        Add New Vehicle
                      </h3>
                      <button onClick={() => { setShowAddVehicleForm(false); setEditingId(null); setFormData(initialFormState); }} className="text-zinc-500 hover:text-red-500 transition-colors">
                        <X size={24} />
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <Input label="Car Model" name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. Tesla Model 3" required data-testid="input-vehicle-model" />
                        <Input label="Year" name="year" type="number" value={formData.year} onChange={handleInputChange} placeholder="2024" required data-testid="input-vehicle-year" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <Input label="VIN Number" name="vinNumber" value={formData.vinNumber} onChange={handleInputChange} placeholder="VIN Number" data-testid="input-vehicle-vin" />
                        <Input label="License Plate" name="licensePlate" value={formData.licensePlate} onChange={handleInputChange} placeholder="License Plate" data-testid="input-vehicle-plate" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Host</label>
                        <select 
                          name="hostId" 
                          value={formData.hostId ? String(formData.hostId) : ''} 
                          onChange={(e) => {
                            const selectedHost = hostsData.find((h: any) => String(h.id) === e.target.value);
                            setFormData({...formData, hostId: e.target.value, hostName: selectedHost ? `${selectedHost.firstName} ${selectedHost.lastName}` : ''});
                          }} 
                          className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                          data-testid="select-vehicle-host"
                        >
                          <option value="">Select a Host</option>
                          {hostsData.map((host: any) => (
                            <option key={host.id} value={host.id}>{host.firstName} {host.lastName}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input label="Daily Rate ($)" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="45" required data-testid="input-vehicle-price" />
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Category</label>
                          <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-category">
                            <option value="Economy">Economy</option>
                            <option value="Standard">Standard</option>
                            <option value="SUV">SUV</option>
                            <option value="Luxury">Luxury</option>
                            <option value="Hatchback">Hatchback</option>
                            <option value="Sedan">Sedan</option>
                            <option value="Truck">Truck</option>
                            <option value="Van">Van</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Fuel Type</label>
                          <select name="fuel" value={formData.fuel} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="Gasoline">Gasoline</option>
                            <option value="Hybrid">Hybrid</option>
                            <option value="Electric">Electric</option>
                            <option value="Diesel">Diesel</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Seats</label>
                          <input type="number" name="seats" value={formData.seats} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Transmission</label>
                          <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="Automatic">Automatic</option>
                            <option value="Manual">Manual</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Drive Type</label>
                          <select name="driveType" value={formData.driveType || 'FWD'} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="FWD">FWD</option>
                            <option value="RWD">RWD</option>
                            <option value="AWD">AWD</option>
                            <option value="4WD">4WD</option>
                          </select>
                        </div>
                      </div>

                      {/* Available Locations with summarized addresses */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Available Locations</label>
                        <div className="flex flex-wrap gap-2">
                          {settings.locations.map(loc => (
                            <button
                              key={loc}
                              onClick={() => {
                                const current = formData.availableLocations || [];
                                const next = current.includes(loc) ? current.filter(l => l !== loc) : [...current, loc];
                                setFormData({...formData, availableLocations: next});
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                (formData.availableLocations || []).includes(loc) 
                                  ? 'bg-green-600 border-green-600 text-white' 
                                  : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-green-500'
                              }`}
                              title={loc}
                              data-testid={`button-toggle-location-${loc}`}
                            >
                              {formatAddressForDisplay(loc)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Delivery to Guest Option */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <Truck size={16} /> Delivery to Guest
                          </h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={formData.isDeliveryEnabled || false} 
                              onChange={() => setFormData({...formData, isDeliveryEnabled: !formData.isDeliveryEnabled})} 
                              className="sr-only peer" 
                              data-testid="toggle-delivery-enabled"
                            />
                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        {formData.isDeliveryEnabled && (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Max Distance (mi)</label>
                              <input type="number" value={formData.maxDeliveryDistance || 20} onChange={(e) => setFormData({...formData, maxDeliveryDistance: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" data-testid="input-max-delivery-distance" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Fee ($)</label>
                              <input type="number" value={formData.minDeliveryFee || 30} onChange={(e) => setFormData({...formData, minDeliveryFee: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" data-testid="input-min-delivery-fee" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Fee Dist (mi)</label>
                              <input type="number" value={formData.minDeliveryFeeMiles || 5} onChange={(e) => setFormData({...formData, minDeliveryFeeMiles: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" data-testid="input-min-delivery-fee-miles" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Price/Mile ($)</label>
                              <input type="number" step="0.1" value={formData.deliveryPricePerMile || 3.5} onChange={(e) => setFormData({...formData, deliveryPricePerMile: parseFloat(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" data-testid="input-delivery-price-per-mile" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Hours Notice</label>
                              <input type="number" value={formData.minDeliveryHours || 6} onChange={(e) => setFormData({...formData, minDeliveryHours: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" data-testid="input-min-delivery-hours" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { key: 'hasReverseCamera', label: 'Reverse Camera' },
                          { key: 'hasElectricSeats', label: 'Electric Seats' },
                          { key: 'hasBlindSpotWarning', label: 'Blind Spot Warning' },
                          { key: 'hasCarPlay', label: 'CarPlay / Auto' },
                          { key: 'hasHeatedSeats', label: 'Heated Seats' },
                          { key: 'hasPaddleShifters', label: 'Paddle Shifters' },
                          { key: 'hasBluetooth', label: 'Bluetooth' },
                          { key: 'hasHeatedSteering', label: 'Heated Steering' },
                          { key: 'hasKeylessEntry', label: 'Keyless Entry' },
                          { key: 'hasDriveAssist', label: 'Drive Assist' },
                          { key: 'hasUSBCharger', label: 'USB Charger' }
                        ].map(feature => (
                          <label key={feature.key} className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" checked={formData[feature.key]} onChange={() => setFormData({...formData, [feature.key]: !formData[feature.key]})} className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{feature.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Vehicle Photos <span className="text-zinc-400 font-normal normal-case">{formData.images.filter(i => i).length} photos</span></label>
                        <div className="flex gap-2 flex-wrap">
                          {formData.images.filter(i => i).map((img, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-green-500">
                              <img src={img} className="w-full h-full object-cover"/>
                              <button onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)})} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"><X size={10}/></button>
                            </div>
                          ))}
                          <button onClick={() => carImageInputRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500 transition-all" data-testid="button-upload-car-photo">
                            <Upload size={16}/>
                            <span className="text-[8px] mt-1 uppercase">Upload</span>
                          </button>
                        </div>
                        <input type="file" ref={carImageInputRef} className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setFormData(prev => ({...prev, images: [...prev.images.filter(i => i), reader.result as string]}));
                            reader.readAsDataURL(file);
                          }
                          if (carImageInputRef.current) carImageInputRef.current.value = '';
                        }} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-3">Vehicle Pricing Settings</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Daily Taxes (%)</label>
                              <input type="text" inputMode="decimal" value={pricingStrings.taxes} onChange={(e: any) => setPricingStrings({...pricingStrings, taxes: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, taxes: val}}); setPricingStrings({...pricingStrings, taxes: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Cleaning Fee ($)</label>
                              <input type="text" inputMode="decimal" value={pricingStrings.cleaningFee} onChange={(e: any) => setPricingStrings({...pricingStrings, cleaningFee: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, cleaningFee: val}}); setPricingStrings({...pricingStrings, cleaningFee: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Inc. Miles / Day</label>
                              <input type="text" inputMode="numeric" value={pricingStrings.includedMiles} onChange={(e: any) => setPricingStrings({...pricingStrings, includedMiles: e.target.value})} onBlur={(e: any) => {const val = parseInt(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, includedMiles: val}}); setPricingStrings({...pricingStrings, includedMiles: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Extra Mile Rate ($)</label>
                              <input type="text" inputMode="decimal" value={pricingStrings.extraMileRate} onChange={(e: any) => setPricingStrings({...pricingStrings, extraMileRate: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, extraMileRate: val}}); setPricingStrings({...pricingStrings, extraMileRate: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                          <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3">Extras & Protection Prices</h4>
                          <div className="grid grid-cols-2 gap-x-3">
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">INS. $500</label>
                              <input type="text" inputMode="decimal" value={pricingStrings.insurance500} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance500: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing.prices, insurance500: val}}}); setPricingStrings({...pricingStrings, insurance500: String(val)})}} className="w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                            <div className="mb-3">
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">INS. $1000</label>
                              <input type="text" inputMode="decimal" value={pricingStrings.insurance1000} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance1000: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing.prices, insurance1000: val}}}); setPricingStrings({...pricingStrings, insurance1000: String(val)})}} className="w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button onClick={handleSaveVehicle} className="w-full mt-4" data-testid="button-save-vehicle">
                        Add Vehicle
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Inventory - Vehicle Cards with Inline Edit */}
                <Card className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">Inventory ({vehicles.length})</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase">Sort by:</span>
                      <select 
                        value={fleetSort} 
                        onChange={(e) => setFleetSort(e.target.value)}
                        className="p-1.5 sm:p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] sm:text-xs font-bold rounded-lg outline-none"
                      >
                        <option value="brand-asc">Brand (A-Z)</option>
                        <option value="brand-desc">Brand (Z-A)</option>
                        <option value="year-desc">Year (Newest)</option>
                        <option value="year-asc">Year (Oldest)</option>
                        <option value="host-asc">Host (A-Z)</option>
                        <option value="host-desc">Host (Z-A)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3 max-h-full overflow-y-auto">
                    {filteredAndSortedFleet.map((car: any) => {
                      const isEditing = editingId === car.id;
                      return (
                        <div key={car.id}>
                          <div className={`flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border ${isEditing ? 'border-blue-500' : 'border-zinc-200 dark:border-zinc-800'} rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`} data-testid={`card-admin-vehicle-${car.id}`}>
                            <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-12 h-12 object-cover rounded-lg" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm truncate">
                                <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                                  {car.model} {car.year}
                                  {car.hostName && <span className="text-blue-500 font-semibold"> - {car.hostName}</span>}
                                </span>
                              </h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {car.fuel} · {car.driveType || 'FWD'} · {car.transmission} · {car.category}
                              </p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono">
                                {car.vinNumber && <span>VIN:{car.vinNumber}</span>}
                                {car.vinNumber && car.licensePlate && <span className="mx-1">·</span>}
                                {car.licensePlate && <span>Plate:{car.licensePlate}</span>}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                className="h-7 w-7 p-0 border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950 flex items-center justify-center relative overflow-visible" 
                                onClick={() => { setEditingId(isEditing ? null : car.id); if (!isEditing) { setFormData(car); setPricingStrings({taxes: String(car.pricing?.taxes || 8.5), cleaningFee: String(car.pricing?.cleaningFee || 25), includedMiles: String(car.pricing?.includedMiles || 200), extraMileRate: String(car.pricing?.extraMileRate || 0.45), insurance500: String(car.pricing?.prices?.insurance500 || 25), insurance1000: String(car.pricing?.prices?.insurance1000 || 15), childSeat: String(car.pricing?.prices?.childSeat || 8), prepaidFuel: String(car.pricing?.prices?.prepaidFuel || 60), lateReturnGrace: String(car.pricing?.prices?.lateReturnGrace || 35), stressFreePackage: String(car.pricing?.prices?.stressFreePackage || 45)}); } }} 
                                data-testid={`button-edit-vehicle-${car.id}`}
                              >
                                {isEditing ? (
                                  <X className="w-4 h-4 text-blue-500 opacity-100 visible" style={{ display: 'block', minWidth: '16px', minHeight: '16px' }} />
                                ) : (
                                  <Edit className="w-4 h-4 text-blue-500 opacity-100 visible" style={{ display: 'block', minWidth: '16px', minHeight: '16px' }} />
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                className="h-7 w-7 p-0 border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950 group flex items-center justify-center relative overflow-visible" 
                                onClick={() => setDeletingVehicleId(car.id)} 
                                data-testid={`button-delete-vehicle-${car.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-500 transition-colors opacity-100 visible" style={{ display: 'block', minWidth: '16px', minHeight: '16px' }} />
                              </Button>
                            </div>
                          </div>

                          {isEditing && (
                            <Card className="mt-2 p-4 sm:p-6 border-2 border-blue-500 bg-white dark:bg-zinc-900">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                  <Edit className="text-blue-500" size={18} /> 
                                  Edit Vehicle
                                </h3>
                              </div>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                  <Input label="Car Model" name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. Tesla Model 3" required data-testid="input-edit-vehicle-model" />
                                  <Input label="Year" name="year" type="number" value={formData.year} onChange={handleInputChange} placeholder="2024" required data-testid="input-edit-vehicle-year" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                  <Input label="VIN Number" name="vinNumber" value={formData.vinNumber} onChange={handleInputChange} placeholder="VIN Number" data-testid="input-edit-vehicle-vin" />
                                  <Input label="License Plate" name="licensePlate" value={formData.licensePlate} onChange={handleInputChange} placeholder="License Plate" data-testid="input-edit-vehicle-plate" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Host</label>
                                  <select 
                                    name="hostId" 
                                    value={formData.hostId ? String(formData.hostId) : ''} 
                                    onChange={(e) => {
                                      const selectedHost = hostsData.find((h: any) => String(h.id) === e.target.value);
                                      setFormData({...formData, hostId: e.target.value, hostName: selectedHost ? `${selectedHost.firstName} ${selectedHost.lastName}` : ''});
                                    }} 
                                    className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm"
                                    data-testid="select-edit-vehicle-host"
                                  >
                                    <option value="">Select a Host</option>
                                    {hostsData.map((host: any) => (
                                      <option key={host.id} value={host.id}>{host.firstName} {host.lastName}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <Input label="Daily Rate ($)" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="45" required data-testid="input-edit-vehicle-price" />
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Category</label>
                                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm">
                                      <option value="Economy">Economy</option>
                                      <option value="Standard">Standard</option>
                                      <option value="SUV">SUV</option>
                                      <option value="Luxury">Luxury</option>
                                      <option value="Hatchback">Hatchback</option>
                                      <option value="Sedan">Sedan</option>
                                      <option value="Truck">Truck</option>
                                      <option value="Van">Van</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Fuel Type</label>
                                    <select name="fuel" value={formData.fuel} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm">
                                      <option value="Gasoline">Gasoline</option>
                                      <option value="Hybrid">Hybrid</option>
                                      <option value="Electric">Electric</option>
                                      <option value="Diesel">Diesel</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Seats</label>
                                    <input type="number" name="seats" value={formData.seats} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm" />
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Transmission</label>
                                    <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm">
                                      <option value="Automatic">Automatic</option>
                                      <option value="Manual">Manual</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Drive Type</label>
                                    <select name="driveType" value={formData.driveType || 'FWD'} onChange={handleInputChange} className="w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm">
                                      <option value="FWD">FWD</option>
                                      <option value="RWD">RWD</option>
                                      <option value="AWD">AWD</option>
                                      <option value="4WD">4WD</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Available Locations</label>
                                  <div className="flex flex-wrap gap-2">
                                    {settings.locations.map(loc => (
                                      <button
                                        key={loc}
                                        onClick={() => {
                                          const current = formData.availableLocations || [];
                                          const next = current.includes(loc) ? current.filter(l => l !== loc) : [...current, loc];
                                          setFormData({...formData, availableLocations: next});
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                          (formData.availableLocations || []).includes(loc) 
                                            ? 'bg-green-600 border-green-600 text-white' 
                                            : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-green-500'
                                        }`}
                                        title={loc}
                                      >
                                        {formatAddressForDisplay(loc)}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                      <Truck size={14} /> Delivery to Guest
                                    </h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={formData.isDeliveryEnabled || false} 
                                        onChange={() => setFormData({...formData, isDeliveryEnabled: !formData.isDeliveryEnabled})} 
                                        className="sr-only peer" 
                                      />
                                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                  </div>
                                  {formData.isDeliveryEnabled && (
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Max Dist (mi)</label>
                                        <input type="number" value={formData.maxDeliveryDistance || 20} onChange={(e) => setFormData({...formData, maxDeliveryDistance: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Fee ($)</label>
                                        <input type="number" value={formData.minDeliveryFee || 30} onChange={(e) => setFormData({...formData, minDeliveryFee: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Fee Dist (mi)</label>
                                        <input type="number" value={formData.minDeliveryFeeMiles || 5} onChange={(e) => setFormData({...formData, minDeliveryFeeMiles: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">$/Mile</label>
                                        <input type="number" step="0.1" value={formData.deliveryPricePerMile || 3.5} onChange={(e) => setFormData({...formData, deliveryPricePerMile: parseFloat(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Min Hours</label>
                                        <input type="number" value={formData.minDeliveryHours || 6} onChange={(e) => setFormData({...formData, minDeliveryHours: parseInt(e.target.value) || 0})} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {[
                                    { key: 'hasReverseCamera', label: 'Reverse Camera' },
                                    { key: 'hasElectricSeats', label: 'Electric Seats' },
                                    { key: 'hasBlindSpotWarning', label: 'Blind Spot Warning' },
                                    { key: 'hasCarPlay', label: 'CarPlay / Auto' },
                                    { key: 'hasHeatedSeats', label: 'Heated Seats' },
                                    { key: 'hasPaddleShifters', label: 'Paddle Shifters' },
                                    { key: 'hasBluetooth', label: 'Bluetooth' },
                                    { key: 'hasHeatedSteering', label: 'Heated Steering' },
                                    { key: 'hasKeylessEntry', label: 'Keyless Entry' },
                                    { key: 'hasDriveAssist', label: 'Drive Assist' },
                                    { key: 'hasUSBCharger', label: 'USB Charger' }
                                  ].map(feature => (
                                    <label key={feature.key} className="flex items-center gap-2 cursor-pointer group">
                                      <input type="checkbox" checked={formData[feature.key]} onChange={() => setFormData({...formData, [feature.key]: !formData[feature.key]})} className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500" />
                                      <span className="text-xs text-zinc-600 dark:text-zinc-400">{feature.label}</span>
                                    </label>
                                  ))}
                                </div>

                                <div className="pt-2">
                                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Vehicle Photos <span className="text-zinc-400 font-normal normal-case">{formData.images?.filter(i => i).length || 0} photos</span></label>
                                  <div className="flex gap-2 flex-wrap">
                                    {(formData.images || []).filter(i => i).map((img, i) => (
                                      <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-green-500">
                                        <img src={img} className="w-full h-full object-cover"/>
                                        <button onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)})} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"><X size={10}/></button>
                                      </div>
                                    ))}
                                    <button onClick={() => carImageInputRef.current?.click()} className="w-14 h-14 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500 transition-all">
                                      <Upload size={14}/>
                                      <span className="text-[8px] mt-1 uppercase">Add</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Vehicle Pricing</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Taxes (%)</label>
                                        <input type="text" inputMode="decimal" value={pricingStrings.taxes} onChange={(e: any) => setPricingStrings({...pricingStrings, taxes: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, taxes: val}}); setPricingStrings({...pricingStrings, taxes: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Cleaning ($)</label>
                                        <input type="text" inputMode="decimal" value={pricingStrings.cleaningFee} onChange={(e: any) => setPricingStrings({...pricingStrings, cleaningFee: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, cleaningFee: val}}); setPricingStrings({...pricingStrings, cleaningFee: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Inc. Miles</label>
                                        <input type="text" inputMode="numeric" value={pricingStrings.includedMiles} onChange={(e: any) => setPricingStrings({...pricingStrings, includedMiles: e.target.value})} onBlur={(e: any) => {const val = parseInt(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, includedMiles: val}}); setPricingStrings({...pricingStrings, includedMiles: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Extra $/mi</label>
                                        <input type="text" inputMode="decimal" value={pricingStrings.extraMileRate} onChange={(e: any) => setPricingStrings({...pricingStrings, extraMileRate: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, extraMileRate: val}}); setPricingStrings({...pricingStrings, extraMileRate: String(val)})}} className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Extras & Protection</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">INS. $500</label>
                                        <input type="text" inputMode="decimal" value={pricingStrings.insurance500} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance500: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing.prices, insurance500: val}}}); setPricingStrings({...pricingStrings, insurance500: String(val)})}} className="w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">INS. $1000</label>
                                        <input type="text" inputMode="decimal" value={pricingStrings.insurance1000} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance1000: e.target.value})} onBlur={(e: any) => {const val = parseFloat(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing.prices, insurance1000: val}}}); setPricingStrings({...pricingStrings, insurance1000: String(val)})}} className="w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded" />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button onClick={handleSaveVehicle} className="flex-1" data-testid="button-update-vehicle">
                                    Update Car and Save
                                  </Button>
                                  <Button variant="ghost" onClick={() => { setFormData(initialFormState); setPricingStrings(defaultPricingStrings); setEditingId(null); }}>Cancel</Button>
                                </div>
                              </div>
                            </Card>
                          )}

                          {deletingVehicleId !== null && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                              <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Excluir Veículo?</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Tem certeza que deseja excluir permanentemente este veículo da sua frota?</p>
                                <div className="flex gap-3">
                                  <button onClick={() => setDeletingVehicleId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-delete-vehicle">Cancelar</button>
                                  <button 
                                    onClick={() => { 
                                      if (deletingVehicleId) {
                                        deleteVehicleMutation.mutate(deletingVehicleId); 
                                      }
                                    }} 
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors" 
                                    data-testid="button-confirm-delete-vehicle"
                                    disabled={deleteVehicleMutation.isPending}
                                  >
                                    {deleteVehicleMutation.isPending ? 'Excluindo...' : 'Sim, Excluir'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
            {/* Modal de confirmação para frota do Host */}
            {hostTab === 'fleet' && deletingVehicleId !== null && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Excluir Veículo?</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Tem certeza que deseja excluir permanentemente este veículo da sua frota?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeletingVehicleId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-host-cancel-delete-vehicle">Cancelar</button>
                    <button 
                      onClick={() => { 
                        if (deletingVehicleId) {
                          deleteVehicleMutation.mutate(deletingVehicleId); 
                        }
                      }} 
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors" 
                      data-testid="button-host-confirm-delete-vehicle"
                      disabled={deleteVehicleMutation.isPending}
                    >
                      {deleteVehicleMutation.isPending ? 'Excluindo...' : 'Sim, Excluir'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {adminTab === 'clients' && (
              <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-3 sm:p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                    <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">Registered Clients ({usersData.length})</h3>
                    <div className="space-y-2">
                      {usersData.map((user) => {
                        const { trips, total } = getUserTripsAndTotal(user.email);
                        const clientRatings = ratingsData.filter(r => r.clientEmail === user.email && r.hostStarsToClient);
                        const avgRating = clientRatings.length > 0 ? clientRatings.reduce((sum, r) => sum + (r.hostStarsToClient || 0), 0) / clientRatings.length : 0;
                        return (
                          <div key={user.id} onClick={() => setSelectedClient(user)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedClient?.id === user.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-client-${user.id}`}>
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-sm text-white">{user.firstName} {user.lastName}</div>
                              {avgRating > 0 && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setViewingClientRatings(user.email); }}
                                  className="flex items-center gap-0.5 text-yellow-400 hover:text-yellow-300 transition-colors"
                                  data-testid={`button-view-client-rating-${user.id}`}
                                >
                                  {[1,2,3,4,5].map(star => (
                                    <span key={star} className={`text-xs ${star <= Math.round(avgRating) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                                  ))}
                                </button>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                            <div className="text-xs text-zinc-400 mt-2 flex justify-between">
                              <span>{trips} Trip{trips !== 1 ? 's' : ''}</span>
                              <span>${total.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  <Card className="p-3 sm:p-6 md:col-span-2 max-h-[85vh] overflow-y-auto">
                    {selectedClient ? (
                      <div className="space-y-4 sm:space-y-6">
                        <div className="flex justify-between items-start mb-4">
                          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">{selectedClient.firstName} {selectedClient.lastName}</h2>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingUserId(selectedClient.id); setEditForm({...selectedClient}); }} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors" data-testid={`button-edit-client-${selectedClient.id}`}>Edit</button>
                            <button onClick={() => setDeletingUserId(selectedClient.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors" data-testid={`button-delete-client-${selectedClient.id}`}>Delete</button>
                          </div>
                        </div>

                        {editingUserId === selectedClient.id && editForm ? (
                          <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Edit Client Info</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <input type="text" placeholder="First Name" value={editForm.firstName || ''} onChange={(e) => setEditForm({...editForm, firstName: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white" data-testid="input-edit-firstName"/>
                              <input type="text" placeholder="Last Name" value={editForm.lastName || ''} onChange={(e) => setEditForm({...editForm, lastName: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white" data-testid="input-edit-lastName"/>
                              <input type="email" placeholder="Email" value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white col-span-2" data-testid="input-edit-email"/>
                              <input type="text" placeholder="Phone" value={editForm.phone || ''} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white" data-testid="input-edit-phone"/>
                              <input type="text" placeholder="City" value={editForm.city || ''} onChange={(e) => setEditForm({...editForm, city: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white" data-testid="input-edit-city"/>
                              <input type="text" placeholder="State" value={editForm.state || ''} onChange={(e) => setEditForm({...editForm, state: e.target.value})} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white" data-testid="input-edit-state"/>
                              <div className="col-span-2 relative">
                                <input type={showClientPassword ? "text" : "password"} placeholder="Password (leave blank to keep current)" value={(editForm as any).password || ''} onChange={(e) => setEditForm({...editForm, password: e.target.value} as any)} className="w-full p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white pr-8" data-testid="input-edit-password"/>
                                <button type="button" onClick={() => setShowClientPassword(!showClientPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700" data-testid="button-toggle-password-visibility">
                                  {showClientPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmingEditUserId(selectedClient.id)} disabled={updateUserMutation.isPending} className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-50" data-testid="button-accept-edit-client">Salvar</button>
                              <button onClick={() => { setEditingUserId(null); setEditForm(null); }} className="flex-1 px-3 py-1 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded transition-colors" data-testid="button-decline-edit-client">Voltar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs">
                            <div><span className="text-zinc-400 block text-[10px] uppercase mb-1">Full Name</span><span className="font-medium text-zinc-900 dark:text-white">{selectedClient.firstName} {selectedClient.lastName}</span></div>
                            <div><span className="text-zinc-400 block text-[10px] uppercase mb-1">Email</span><span className="font-medium text-zinc-900 dark:text-white break-all">{selectedClient.email}</span></div>
                            <div><span className="text-zinc-400 block text-[10px] uppercase mb-1">Phone</span><span className="font-medium text-zinc-900 dark:text-white">{selectedClient.phone || 'N/A'}</span></div>
                            <div><span className="text-zinc-400 block text-[10px] uppercase mb-1">City, State</span><span className="font-medium text-zinc-900 dark:text-white">{selectedClient.city || 'N/A'}, {selectedClient.state || 'N/A'}</span></div>
                            <div className="col-span-2"><span className="text-zinc-400 block text-[10px] uppercase mb-1">Password (Hashed)</span><span className="font-mono text-[10px] text-zinc-500 break-all">{selectedClient.passwordHash?.substring(0, 20) || 'N/A'}...</span></div>
                            <div className="col-span-2"><span className="text-zinc-400 block text-[10px] uppercase mb-1">Registered</span><span className="font-medium text-zinc-900 dark:text-white text-xs">{new Date(selectedClient.createdAt).toLocaleDateString()}</span></div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Trip History ({clientTrips.length})</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {clientTrips.length > 0 ? (
                              clientTrips.map((trip, idx) => {
                                const tripRating = ratingsData?.find(r => r.bookingId === trip.id);
                                return (
                                  <div key={idx} onClick={() => setSelectedTripForView(trip)} className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs cursor-pointer hover:border-blue-500 hover:bg-zinc-800 transition-colors" data-testid={`card-trip-${trip.id}`}>
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="font-bold text-zinc-900 dark:text-white">{trip.carName}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${trip.status === 'Completed' ? 'bg-green-600 text-white' : trip.status === 'Cancelled' ? 'bg-red-600 text-white' : 'bg-zinc-500 text-white'}`}>{trip.status}</span>
                                    </div>
                                    <div className="text-zinc-500">{trip.startDate} to {trip.returnDate}</div>
                                    <div className="flex justify-between items-end">
                                      <div className="text-zinc-400">${trip.total.toFixed(2)}</div>
                                      {trip.status === 'Completed' && (
                                        <div className="text-[7px] text-zinc-500 space-y-0.5 text-right">
                                          {tripRating?.stars && (
                                            <div>
                                              <div className="font-bold text-zinc-400">Guest</div>
                                              <div className="flex gap-0.5 justify-end">
                                                {[1,2,3,4,5].map(star => (<span key={star} className={`${star <= (tripRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}
                                              </div>
                                            </div>
                                          )}
                                          {tripRating?.hostStarsToClient && (
                                            <div>
                                              <div className="font-bold text-zinc-400">Host</div>
                                              <div className="flex gap-0.5 justify-end">
                                                {[1,2,3,4,5].map(star => (<span key={star} className={`${star <= (tripRating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-xs text-zinc-500">No trips found</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-500">
                        <div className="text-center"><Users size={32} className="mx-auto mb-2 text-zinc-400" /><p>Select a client to view details</p></div>
                      </div>
                    )}
                  </Card>
                </div>

                {confirmingEditUserId && editForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Save Changes?</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to save these changes to the client information?</p>
                      <div className="flex gap-3">
                        <button onClick={() => { 
                          const { createdAt, updatedAt, passwordHash, ...dataToUpdate } = editForm;
                          updateUserMutation.mutate({id: confirmingEditUserId, data: dataToUpdate}); 
                        }} disabled={updateUserMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50" data-testid="button-confirm-edit-confirmation">Save Changes</button>
                        <button onClick={() => setConfirmingEditUserId(null)} disabled={updateUserMutation.isPending} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50" data-testid="button-cancel-edit-confirmation">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {deletingUserId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Delete Client?</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">This will permanently delete this client and cannot be undone. Continue?</p>
                      <div className="flex gap-3">
                        <button onClick={() => setDeletingUserId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-delete-client">Cancel</button>
                        <button onClick={() => deleteUserMutation.mutate(deletingUserId)} disabled={deleteUserMutation.isPending} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50" data-testid="button-confirm-delete-client">Yes, Delete</button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTripForView && (() => {
                  const vehicleForTrip = vehicles.find(v => v.id === selectedTripForView.vehicleId);
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-6 flex justify-between items-start">
                          <div>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Trip Details</h2>
                            <p className="text-sm text-zinc-500 mt-1">{selectedTripForView.bookingCode}</p>
                          </div>
                          <button onClick={() => setSelectedTripForView(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" data-testid="button-close-trip-modal"><X size={24}/></button>
                        </div>
                        <div className="p-6 space-y-6">
                          {/* Client & Car Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <div>
                              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Client Info</h3>
                              <div className="space-y-2">
                                <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Name</span><p className="text-sm font-medium text-zinc-900 dark:text-white">{selectedTripForView.driver.name}</p></div>
                                <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Email</span><p className="text-sm text-zinc-700 dark:text-zinc-300">{selectedTripForView.driver.email}</p></div>
                                <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Phone</span><p className="text-sm text-zinc-700 dark:text-zinc-300">{selectedTripForView.driver.phone || 'N/A'}</p></div>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Vehicle Info</h3>
                              <div className="space-y-2">
                                <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Model</span><p className="text-sm font-medium text-zinc-900 dark:text-white">{selectedTripForView.carName}</p></div>
                                {vehicleForTrip && (
                                  <>
                                    <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Category</span><p className="text-sm text-zinc-700 dark:text-zinc-300">{vehicleForTrip.category}</p></div>
                                    <div><span className="text-xs text-zinc-600 dark:text-zinc-400">Price/Day</span><p className="text-sm font-bold text-green-600">${vehicleForTrip.price}/day</p></div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Rental Dates & Status with Pickup/Delivery indicator */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Pickup</span>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1">{selectedTripForView.startDate}</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">{selectedTripForView.startTime}</p>
                              </div>
                              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Return</span>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1">{selectedTripForView.returnDate}</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">{selectedTripForView.returnTime}</p>
                              </div>
                              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Status</span>
                                <p className={`text-sm font-bold mt-1 px-2 py-1 rounded w-fit ${selectedTripForView.status === 'Completed' ? 'bg-green-600 text-white' : selectedTripForView.status === 'Cancelled' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>{selectedTripForView.status}</p>
                              </div>
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Total</span>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">${selectedTripForView.total.toFixed(2)}</p>
                              </div>
                            </div>
                            {/* Pickup vs Delivery Indicator */}
                            {(selectedTripForView.details as any)?.deliveryType && (
                              <div className={`p-3 rounded-lg border flex items-center gap-2 ${(selectedTripForView.details as any)?.deliveryType === 'delivery' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                                {(selectedTripForView.details as any)?.deliveryType === 'delivery' ? (
                                  <>
                                    <Truck size={18} className="text-green-600" />
                                    <span className="font-bold text-green-700 dark:text-green-400">Delivery</span>
                                  </>
                                ) : (
                                  <>
                                    <MapPin size={18} className="text-blue-600" />
                                    <span className="font-bold text-blue-700 dark:text-blue-400">Pickup at Location</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Location */}
                          <div>
                            <span className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Location</span>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">{formatAddressForDisplay(selectedTripForView.location)}</p>
                          </div>

                          {/* Check-in Photos */}
                          {(() => {
                            const fullBooking = getBookingWithImages(selectedTripForView);
                            const allCheckInPhotos = [...(fullBooking.checkInData?.photosOutside || []), ...(fullBooking.checkInData?.photosInside || [])];
                            const validCheckInPhotos = allCheckInPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                            
                            if (validCheckInPhotos.length > 0) {
                              return (
                                <div>
                                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-in Photos ({validCheckInPhotos.length})</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    {validCheckInPhotos.map((photo: string, idx: number) => (
                                      <div key={idx} className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80" onClick={() => openLightbox(validCheckInPhotos, idx)}>
                                        <img src={photo} alt={`Check-in ${idx + 1}`} className="w-full h-32 object-cover"/>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            } else if (allCheckInPhotos.some((img: string) => img === '[IMAGE]')) {
                              return <div className="text-sm text-zinc-500">Loading check-in photos...</div>;
                            }
                            return null;
                          })()}

                          {/* Check-out Photos */}
                          {(() => {
                            const fullBooking = getBookingWithImages(selectedTripForView);
                            const allCheckOutPhotos = [...(fullBooking.checkOutData?.photosOutside || []), ...(fullBooking.checkOutData?.photosInside || [])];
                            const validCheckOutPhotos = allCheckOutPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                            
                            if (validCheckOutPhotos.length > 0) {
                              return (
                                <div>
                                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-out Photos ({validCheckOutPhotos.length})</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    {validCheckOutPhotos.map((photo: string, idx: number) => (
                                      <div key={idx} className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80" onClick={() => openLightbox(validCheckOutPhotos, idx)}>
                                        <img src={photo} alt={`Check-out ${idx + 1}`} className="w-full h-32 object-cover"/>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            } else if (allCheckOutPhotos.some((img: string) => img === '[IMAGE]')) {
                              return <div className="text-sm text-zinc-500">Loading check-out photos...</div>;
                            }
                            return null;
                          })()}

                          {/* Mileage Info */}
                          {selectedTripForView.checkInData?.miles && selectedTripForView.checkOutData?.miles && (
                            <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase">Check-in Mileage</p>
                                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{selectedTripForView.checkInData.miles} mi</p>
                                </div>
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase">Check-out Mileage</p>
                                  <p className="text-lg font-bold text-zinc-900 dark:text-white">{selectedTripForView.checkOutData.miles} mi</p>
                                </div>
                              </div>
                              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <p className="text-xs text-zinc-500 uppercase">Included Miles</p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{vehicleForTrip?.pricing?.includedMiles || settings.includedMiles} miles/day × {selectedTripForView.days} days = {((vehicleForTrip?.pricing?.includedMiles || settings.includedMiles) * selectedTripForView.days)} miles total</p>
                              </div>
                            </div>
                          )}

                          {/* Payment Method */}
                          {selectedTripForView.paymentRaw && (
                            <div className={`p-4 rounded-lg border ${selectedTripForView.paymentRaw?.type === 'paypal' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                              <p className={`text-xs font-bold uppercase tracking-wider ${selectedTripForView.paymentRaw?.type === 'paypal' ? 'text-blue-900 dark:text-blue-200' : 'text-red-900 dark:text-red-200'}`}>Payment Method</p>
                              <p className={`text-sm mt-1 ${selectedTripForView.paymentRaw?.type === 'paypal' ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}>
                                {selectedTripForView.paymentRaw?.type === 'paypal' ? 'PayPal' : `Credit Card (${selectedTripForView.paymentRaw?.type || 'Visa'}) ****${selectedTripForView.paymentRaw?.cardNumber?.slice(-4)}`}
                              </p>
                            </div>
                          )}

                          {/* Price Breakdown */}
                          {selectedTripForView.details && (
                            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-6">
                              {(() => {
                                const carForReceipt = vehicles.find(v => v.id === selectedTripForView.vehicleId);
                                const cleaningFeeForReceipt = carForReceipt?.pricing?.cleaningFee || settings.cleaningFee;
                                
                                // Calculate initial payment
                                const rentalRate = selectedTripForView.details?.rate || 0;
                                const protection = selectedTripForView.details?.protection || 0;
                                const extras = selectedTripForView.details?.extras || 0;
                                const initialSubtotal = rentalRate + protection + extras + cleaningFeeForReceipt;
                                const initialTax = initialSubtotal > 0 ? initialSubtotal * ((settings.taxes || 0) / 100) : 0;
                                const initialPayment = initialSubtotal + initialTax;
                                
                                // Calculate additional charges
                                const extendedRate = selectedTripForView.details?.extendedRate || 0;
                                const manualChargesTotal = Array.isArray(selectedTripForView.details?.manualCharges) ? selectedTripForView.details.manualCharges.reduce((sum, c: any) => sum + c.amount, 0) : 0;
                                const extraPaymentsTotal = (selectedTripForView.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                                const discount = selectedTripForView.details?.discount || 0;
                                const additionalChargesBeforeTax = extendedRate + manualChargesTotal + extraPaymentsTotal - discount;
                                const additionalTax = additionalChargesBeforeTax > 0 ? additionalChargesBeforeTax * ((settings.taxes || 0) / 100) : 0;
                                const additionalCharges = additionalChargesBeforeTax + additionalTax;
                                
                                return (
                                  <>
                                    {/* Initial Payment Section */}
                                    <div>
                                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Initial Payment Breakdown</h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-zinc-600 dark:text-zinc-400">Rental Rate ({selectedTripForView.days} days)</span>
                                          <span className="text-zinc-900 dark:text-white">${rentalRate.toFixed(2)}</span>
                                        </div>
                                        {protection > 0 && (
                                          <div className="flex justify-between text-sm">
                                            <span className="text-zinc-600 dark:text-zinc-400">Protection - {selectedTripForView.details?.protectionType || 'Standard'}</span>
                                            <span className="text-zinc-900 dark:text-white">+${protection.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {extras > 0 && (
                                          <div className="flex justify-between text-sm">
                                            <span className="text-zinc-600 dark:text-zinc-400">Extras</span>
                                            <span className="text-green-600 dark:text-green-400">+${extras.toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                          <span className="text-zinc-600 dark:text-zinc-400">Cleaning Fee</span>
                                          <span className="text-zinc-900 dark:text-white">+${cleaningFeeForReceipt.toFixed(2)}</span>
                                        </div>
                                        {initialTax > 0 && (
                                          <div className="flex justify-between text-sm">
                                            <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                            <span className="text-purple-600 dark:text-purple-400">+${initialTax.toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                          <span className="font-bold text-zinc-900 dark:text-white">Initial Payment</span>
                                          <span className="font-bold text-zinc-900 dark:text-white">${initialPayment.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Additional Charges Section */}
                                    {additionalChargesBeforeTax > 0 && (
                                      <div>
                                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Additional Charges</h4>
                                        <div className="space-y-2">
                                          {extendedRate > 0 && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-zinc-600 dark:text-zinc-400">Extended Days - {Math.round(extendedRate / (carForReceipt?.price || 1))} Days</span>
                                              <span className="text-blue-600 dark:text-blue-400">+${extendedRate.toFixed(2)}</span>
                                            </div>
                                          )}
                                          {selectedTripForView.details?.manualCharges && selectedTripForView.details.manualCharges.map((charge, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                              <span className="text-zinc-600 dark:text-zinc-400">{charge.type}</span>
                                              <span className="text-orange-600 dark:text-orange-400">+${charge.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                          {selectedTripForView.extraPayments && selectedTripForView.extraPayments.map((payment, idx) => (
                                            <div key={`ep-${idx}`} className="flex justify-between text-sm">
                                              <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                                                <Check size={12} className="text-green-500"/> {payment.type}
                                              </span>
                                              <span className="text-green-600 dark:text-green-400">+${payment.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                          {discount > 0 && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-zinc-600 dark:text-zinc-400">Discount</span>
                                              <span className="text-green-600 dark:text-green-400">-${discount.toFixed(2)}</span>
                                            </div>
                                          )}
                                          {additionalTax > 0 && (
                                            <div className="flex justify-between text-sm">
                                              <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                              <span className="text-purple-600 dark:text-purple-400">+${additionalTax.toFixed(2)}</span>
                                            </div>
                                          )}
                                          <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                            <span className="font-bold text-zinc-900 dark:text-white">Additional Charges</span>
                                            <span className="font-bold text-zinc-900 dark:text-white">+${additionalCharges.toFixed(2)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Final Total */}
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                      <div className="flex justify-between items-center">
                                        <span className="text-lg font-bold text-green-900 dark:text-green-200">Total Amount</span>
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">${(initialPayment + additionalCharges).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* Ratings */}
                          {selectedTripForView.status === 'Completed' && (() => {
                            const tripRating = ratingsData?.find(r => r.bookingId === selectedTripForView.id);
                            return (
                              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Ratings</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {tripRating?.stars ? (
                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                      <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase">Guest Rating of Host</span>
                                      <div className="flex items-center gap-2 mt-2">
                                        {[1,2,3,4,5].map(star => (<span key={star} className={`text-xl ${star <= (tripRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-400'}`}>★</span>))}
                                        <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400 ml-2">{tripRating.stars}/5</span>
                                      </div>
                                      {tripRating.comment && <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 italic">"{tripRating.comment}"</p>}
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
                                      Guest has not rated this host yet
                                    </div>
                                  )}
                                  {tripRating?.hostStarsToClient ? (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Host Rating of Guest</span>
                                      <div className="flex items-center gap-2 mt-2">
                                        {[1,2,3,4,5].map(star => (<span key={star} className={`text-xl ${star <= (tripRating.hostStarsToClient || 0) ? 'text-blue-400' : 'text-zinc-400'}`}>★</span>))}
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400 ml-2">{tripRating.hostStarsToClient}/5</span>
                                      </div>
                                      {tripRating.hostCommentToClient && <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 italic">"{tripRating.hostCommentToClient}"</p>}
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
                                      Host has not rated this guest yet
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Driver License Info */}
                          {selectedTripForView.driver.licenseNumber && (
                            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">Driver License</h4>
                              <p className="text-sm text-zinc-700 dark:text-zinc-300">{selectedTripForView.driver.licenseNumber}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>
              )}

            {adminTab === 'hosts' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-3 sm:p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">Registered Hosts ({hostsData.length})</h3>
                  {hostsData.length > 0 ? (
                    <div className="space-y-2">
                      {hostsData.map((host: any) => {
                        const hostVehicles = vehicles.filter(v => v.hostId === String(host.id));
                        return (
                          <div key={host.id} onClick={() => { setSelectedHost(host); setEditingHost(null); }} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedHost?.id === host.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-host-${host.id}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-white">{host.firstName} {host.lastName}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${host.status === 'active' ? 'bg-green-600 text-white' : 'bg-zinc-500 text-white'}`}>{host.status}</span>
                            </div>
                            <div className="text-xs text-zinc-500">@{host.username}</div>
                            <div className="text-xs text-zinc-400 mt-1">Vehicles: {hostVehicles.length}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 text-center py-8">No hosts registered yet</div>
                  )}
                </Card>
                <Card className="p-3 sm:p-6 md:col-span-2 max-h-[85vh] overflow-y-auto">
                  {selectedHost ? (
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">{selectedHost.firstName} {selectedHost.lastName}</h2>
                          <p className="text-xs sm:text-sm text-zinc-500 mt-1">@{selectedHost.username} | Joined: {selectedHost.createdAt ? new Date(selectedHost.createdAt).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingHost(editingHost ? null : {...selectedHost})} data-testid="button-edit-host">
                            {editingHost ? <X size={14}/> : <Edit size={14}/>}
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-950" onClick={() => {
                            if (confirm(`Are you sure you want to delete ${selectedHost.firstName} ${selectedHost.lastName}? This action cannot be undone.`)) {
                              fetch(`/api/hosts/${selectedHost.id}`, { method: 'DELETE' })
                                .then(r => r.json())
                                .then(d => {
                                  queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
                                  setSelectedHost(null);
                                })
                                .catch(err => alert('Error deleting host'));
                            }
                          }} data-testid="button-delete-host">
                            <Trash2 size={14}/>
                          </Button>
                        </div>
                      </div>

                      {editingHost ? (
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            const response = await fetch(`/api/hosts/${selectedHost.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(editingHost),
                            });
                            if (response.ok) {
                              const data = await response.json();
                              queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
                              setEditingHost(null);
                              setSelectedHost(data.host || data);
                              toast({ title: data.message || 'Host updated successfully' });
                            } else {
                              alert('Error updating host');
                            }
                          } catch (err) { alert('Error updating host'); }
                        }} className="space-y-4 p-4 bg-zinc-900 rounded-lg">
                          <div className="grid grid-cols-2 gap-3">
                            <input type="text" value={editingHost.firstName} onChange={(e) => setEditingHost({...editingHost, firstName: e.target.value})} placeholder="First Name" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <input type="text" value={editingHost.lastName} onChange={(e) => setEditingHost({...editingHost, lastName: e.target.value})} placeholder="Last Name" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input type="email" value={editingHost.email} onChange={(e) => setEditingHost({...editingHost, email: e.target.value})} placeholder="Email" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <input type="tel" value={editingHost.phone} onChange={(e) => setEditingHost({...editingHost, phone: e.target.value})} placeholder="Phone" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                          </div>
                          <input type="text" value={editingHost.address || ''} onChange={(e) => setEditingHost({...editingHost, address: e.target.value})} placeholder="Address" className="w-full px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                          <div className="grid grid-cols-3 gap-3">
                            <input type="text" value={editingHost.city || ''} onChange={(e) => setEditingHost({...editingHost, city: e.target.value})} placeholder="City" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <input type="text" value={editingHost.state || ''} onChange={(e) => setEditingHost({...editingHost, state: e.target.value})} placeholder="State" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <input type="text" value={editingHost.zipCode || ''} onChange={(e) => setEditingHost({...editingHost, zipCode: e.target.value})} placeholder="ZIP" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input type="text" value={editingHost.licenseNumber} onChange={(e) => setEditingHost({...editingHost, licenseNumber: e.target.value})} placeholder="License Number" className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <div>
                              <input type="text" value={editingHost.socialSecurityNumber || ''} onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                                setEditingHost({...editingHost, socialSecurityNumber: value});
                              }} placeholder="9-digit Tax ID" maxLength={9} className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs w-full" data-testid="input-host-tax-id-edit" />
                              {editingHost.socialSecurityNumber && (
                                <p className="text-xs text-zinc-400 mt-1">
                                  {editingHost.socialSecurityNumber.startsWith('9') ? '🔵 ITIN Number' : '🟢 SSN'}
                                </p>
                              )}
                            </div>
                          </div>
                          <select value={editingHost.status} onChange={(e) => setEditingHost({...editingHost, status: e.target.value})} className="w-full px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs">
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                          </select>
                          <div className="relative">
                            <input type={showHostEditPassword ? "text" : "password"} value={editingHost.password || ''} onChange={(e) => setEditingHost({...editingHost, password: e.target.value})} placeholder="New Password (leave blank to keep current)" className="w-full px-3 py-2 pr-10 border border-zinc-700 rounded bg-zinc-800 text-white text-xs" />
                            <button type="button" onClick={() => setShowHostEditPassword(!showHostEditPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors" data-testid="button-toggle-host-edit-password">{showHostEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">Save Changes</Button>
                            <Button type="button" variant="outline" onClick={() => setEditingHost(null)}>Cancel</Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Contact</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p>{selectedHost.email}</p>
                                <p className="text-zinc-500">{selectedHost.phone}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Address</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p>{selectedHost.address || 'N/A'}</p>
                                <p className="text-zinc-500">{[selectedHost.city, selectedHost.state, selectedHost.zipCode].filter(Boolean).join(', ') || 'N/A'}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">License</h4>
                              <div className="text-sm text-zinc-900 dark:text-white">{selectedHost.licenseNumber}</div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Tax ID</h4>
                              <div className="text-sm text-zinc-900 dark:text-white font-mono">
                                {selectedHost.socialSecurityNumber ? (
                                  <>
                                    {selectedHost.socialSecurityNumber}
                                    <span className="block text-xs text-zinc-500 mt-1">
                                      {selectedHost.socialSecurityNumber.startsWith('9') ? '✓ ITIN Number' : '✓ Social Security Number'}
                                    </span>
                                  </>
                                ) : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Status</h4>
                              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${selectedHost.status === 'active' ? 'bg-green-600 text-white' : 'bg-zinc-500 text-white'}`}>{selectedHost.status}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            {(selectedHost.licenseFrontImage || selectedHost.licenseBackImage) && (
                              <div>
                                <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Driver's License</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {selectedHost.licenseFrontImage && <img src={selectedHost.licenseFrontImage} alt="Front" onClick={() => setExpandedHostImage(selectedHost.licenseFrontImage)} className="w-full h-32 object-cover rounded border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" data-testid="img-host-license-front" />}
                                  {selectedHost.licenseBackImage && <img src={selectedHost.licenseBackImage} alt="Back" onClick={() => setExpandedHostImage(selectedHost.licenseBackImage)} className="w-full h-32 object-cover rounded border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" data-testid="img-host-license-back" />}
                                </div>
                              </div>
                            )}
                            {selectedHost.proofOfResidenceImage && (
                              <div>
                                <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Proof of Residence</h4>
                                <img src={selectedHost.proofOfResidenceImage} alt="Proof of Residence" onClick={() => setExpandedHostImage(selectedHost.proofOfResidenceImage)} className="w-full h-40 object-cover rounded border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" data-testid="img-host-proof-residence" />
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Host Vehicles ({vehicles.filter(v => v.hostId === String(selectedHost.id)).length})</h4>
                            <div className="space-y-2">
                              {vehicles.filter(v => v.hostId === String(selectedHost.id)).map(car => {
                                const carBookings = bookings.filter(b => b.vehicleId === car.id && b.status === 'Completed');
                                const grossRevenue = carBookings.reduce((sum, b) => sum + (b.total || 0), 0);
                                const commissionEarned = (grossRevenue * (car.commission || 10)) / 100;
                                const hostNetProfit = grossRevenue - commissionEarned;
                                return (
                                  <div key={car.id} onClick={() => setSelectedHostCarCommission({ car, host: selectedHost, trips: carBookings.length, grossRevenue, commissionEarned, hostNetProfit })} className="flex items-center gap-3 p-2 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 hover:border-green-500/50 border border-zinc-800 transition-all">
                                    <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-12 h-12 object-cover rounded" />
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-white">{car.model}</p>
                                      <p className="text-xs text-zinc-500">${car.price}/day | {car.commission || 10}% commission | {carBookings.length} trips</p>
                                    </div>
                                    <ChevronRight size={16} className="text-zinc-500" />
                                  </div>
                                );
                              })}
                              {vehicles.filter(v => v.hostId === String(selectedHost.id)).length === 0 && (
                                <p className="text-xs text-zinc-500">No vehicles registered</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                      <div className="text-center">
                        <Building2 size={32} className="mx-auto mb-2 text-zinc-400" />
                        <p>Select a host to view details</p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {expandedHostImage && (
              <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                <button onClick={() => setExpandedHostImage(null)} className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors" data-testid="button-close-host-image-expand"><X size={28} /></button>
                <img src={expandedHostImage} alt="Expanded" className="max-w-4xl max-h-[90vh] object-contain rounded-lg" />
              </div>
            )}

            {adminTab === 'bookings' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - All Bookings List */}
                <Card className="p-3 sm:p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">Todas as Reservas ({bookings.length})</h3>
                  
                  {/* Filters */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Ordernar por Data</label>
                      <select value={bookingFilterType} onChange={(e) => setBookingFilterType(e.target.value as 'end-soon' | 'start-first')} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-booking-filter">
                        <option value="start-first">Todos (Mais recentes)</option>
                        <option value="end-soon">Terminando em breve (3 dias)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Status</label>
                      <select value={bookingFilterStatus} onChange={(e) => setBookingFilterStatus(e.target.value as any)} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-admin-booking-status">
                        <option value="">Todos os Status</option>
                        <option value="active">Ativos</option>
                        <option value="completed">Concluídos</option>
                        <option value="cancelled">Cancelados</option>
                        <option value="pending-approval">Pendente de Aprovação</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Modelo do Carro</label>
                      <select value={bookingFilterCarModel} onChange={(e) => setBookingFilterCarModel(e.target.value as string)} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-admin-booking-carmodel">
                        <option value="">Todos os Modelos</option>
                        {Array.from(new Set(vehicles.map(v => v.model))).sort().map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Número da Reserva ou Nome</label>
                      <input type="text" placeholder="Buscar número ou nome..." value={bookingFilterNumber} onChange={(e) => setBookingFilterNumber(e.target.value)} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="input-admin-booking-number" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {bookings.length === 0 && !bookingsLoading && (
                      <p className="text-zinc-400 text-center py-4">Nenhuma reserva encontrada. Verifique se a API está retornando dados.</p>
                    )}
                    {bookingsLoading && (
                      <p className="text-zinc-400 text-center py-4">Carregando reservas...</p>
                    )}
                    {bookings
                      .filter(b => {
                        let matches = true;
                        
                        if (bookingFilterStatus && bookingFilterStatus !== "" && bookingFilterStatus !== "todos os status") {
                          const status = (bookingFilterStatus as string).toLowerCase().trim();
                          const normalizedStatusForFilter = (b.status || "").toLowerCase().trim();
                          if (status === "active") matches = (normalizedStatusForFilter === 'active' || normalizedStatusForFilter === 'extended');
                          else if (status === 'completed') matches = (normalizedStatusForFilter === 'completed' || normalizedStatusForFilter === 'concluido' || normalizedStatusForFilter === 'concluído');
                          else if (status === 'cancelled') matches = (normalizedStatusForFilter === 'cancelled' || normalizedStatusForFilter === 'cancelado');
                          else if (status === 'pending-approval') matches = (normalizedStatusForFilter === 'pending approval' || normalizedStatusForFilter === 'aguardando aprovação' || (b.details as any)?.deliveryApprovalStatus === 'pending');
                        }
                        
                        // Only filter by car model if one is selected
                        if (bookingFilterCarModel && bookingFilterCarModel !== "") {
                          const bVehicleId = String(b.vehicleId || '');
                          const vehicle = vehicles.find(v => String(v.id) === bVehicleId);
                          if (vehicle?.model !== bookingFilterCarModel) matches = false;
                        }

                        if (bookingFilterNumber && bookingFilterNumber !== "") {
                          const searchTerm = bookingFilterNumber.toLowerCase();
                          const matchesCode = b.bookingCode?.toLowerCase().includes(searchTerm) || false;
                          const driverName = (b.driver as any)?.name?.toLowerCase() || (b.driver as any)?.firstName?.toLowerCase() || "";
                          const matchesName = driverName.includes(searchTerm);
                          if (!matchesCode && !matchesName) matches = false;
                        }
                        return matches;
                      })
                      .sort((a, b) => {
                        if (bookingFilterType === 'end-soon') {
                          const aDateTime = new Date(`${a.returnDate}T${a.returnTime}`).getTime();
                          const bDateTime = new Date(`${b.returnDate}T${b.returnTime}`).getTime();
                          return aDateTime - bDateTime;
                        } else {
                          return Number(b.id) - Number(a.id);
                        }
                      })
                      .map(b => {
                        const statusColor = b.status === 'Completed' ? 'bg-green-600 text-white' : b.status === 'Active' ? 'bg-blue-400 text-white' : b.status === 'Extended' ? 'bg-yellow-400 text-white' : (b.details as any)?.deliveryApprovalStatus === 'approved' ? 'bg-fuchsia-600 text-white' : (b.status === 'Pending Approval' || (b.details as any)?.deliveryApprovalStatus === 'pending') ? 'bg-orange-400 text-white' : 'bg-zinc-500 text-white';
                        const statusText = b.status === 'Completed' ? 'CONCLUÍDO' : b.status === 'Active' ? 'ATIVO' : (b.details as any)?.deliveryApprovalStatus === 'approved' ? 'ENTREGA APROVADA' : (b.status === 'Pending Approval' || (b.details as any)?.deliveryApprovalStatus === 'pending') ? 'AGUARDANDO APROVAÇÃO' : b.status;
                        const pendingRequests = getPendingRequestsCount(b);
                        const unreadMessages = getUnreadMessagesCount(b, 'admin');
                        const hasNotifications = b.status !== 'Cancelled' && (pendingRequests > 0 || unreadMessages > 0);
                        
                        const today = getTodayString();
                        const tomorrow = addDaysToDate(today, 1);
                        const returnDate = b.returnDate;
                        const pickupDate = b.startDate;
                        
                        const pickupIsToday = pickupDate === today;
                        const pickupIsTomorrow = pickupDate === tomorrow;
                        const returnIsToday = returnDate === today;
                        const returnIsTomorrow = returnDate === tomorrow;
                        
                        // Check if host has rated this booking's guest
                        const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                        const hasRated = bookingRating?.hostStarsToClient;
                        
                        return (
                          <div key={b.id} onClick={() => { setManageBookingId(b.id); if (b.unread) markBookingAsReadMutation.mutate(b.id); }} className={`p-3 rounded-lg border cursor-pointer transition-colors relative ${manageBookingId === b.id ? 'border-blue-400 bg-blue-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'} ${b.unread ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`} data-testid={`card-booking-${b.id}`}>
                            {b.unread && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" title="New booking" />}
                            {/* Header: Code + Status Badge */}
                            <div className="flex justify-between items-center gap-2 mb-2">
                              <div className="flex items-center gap-1 flex-1">
                          {b.status === 'Completed' && !hasRated && (<span className="text-red-500 text-lg" title="Pendente de Avaliação">!</span>)}
                                {b.status !== 'Cancelled' && (pickupIsToday || pickupIsTomorrow || returnIsToday || returnIsTomorrow) && (
                                  <span className={`animate-pulse ${pickupIsToday || returnIsToday ? 'text-red-500' : 'text-yellow-500'}`}><AlertTriangle size={12}/></span>
                                )}
                                {hasNotifications && (<span className="text-yellow-500 animate-pulse"><AlertCircle size={12}/></span>)}
                                <span className="font-bold text-sm text-white">{b.bookingCode}</span>
                              </div>
                              <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>{statusText}</span>
                            </div>
                            
                            {/* Car Name + Guest Label */}
                            <div className="flex justify-between items-start gap-2 mb-0.5">
                              <div className="text-xs text-zinc-300 font-medium leading-tight">{b.carName}</div>
                              {b.status === 'Completed' && (() => {
                                const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                                return bookingRating?.stars ? (
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-zinc-300 leading-tight">Guest</div>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            
                            {/* Driver Name + Guest Stars */}
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <div className="text-xs text-zinc-500 leading-tight">{b.driver.name}</div>
                              {b.status === 'Completed' && (() => {
                                const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                                return bookingRating?.stars ? (
                                  <div className="flex gap-0">{[1,2,3,4,5].map(star => (<span key={star} className={`text-xs ${star <= (bookingRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}</div>
                                ) : null;
                              })()}
                            </div>
                            
                            {/* Pickup + Host Label */}
                            <div className="flex justify-between items-start gap-2 mb-0.5">
                              <div className="text-[10px] text-zinc-400 leading-tight">Pickup: {b.startDate} at {b.startTime}</div>
                              {b.status === 'Completed' && (() => {
                                const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                                return bookingRating?.hostStarsToClient ? (
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-zinc-300 leading-tight">Host</div>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            
                            {/* Return + Host Stars */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="text-[10px] text-zinc-400 leading-tight">Return: {b.returnDate} at {b.returnTime}</div>
                              {b.status === 'Completed' && (() => {
                                const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                                return bookingRating?.hostStarsToClient ? (
                                  <div className="flex gap-0">{[1,2,3,4,5].map(star => (<span key={star} className={`text-xs ${star <= (bookingRating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>))}</div>
                                ) : null;
                              })()}
                            </div>
                            
                            {/* Return Status Alerts */}
                            <div className="text-[10px] text-zinc-400 mt-1 leading-tight space-y-0.5">
                              {b.status !== 'Cancelled' && (returnIsToday || returnIsTomorrow) && (
                                <div className={`text-[9px] font-bold ${returnIsToday ? 'text-red-400' : 'text-yellow-400'}`}>Retorno {returnIsToday ? 'HOJE ⚠️' : 'AMANHÃ ⚠️'}</div>
                              )}
                            </div>
                            {hasNotifications && (
                              <div className="mt-1 text-[9px] text-yellow-400 flex items-center gap-1"><Bell size={9}/>{pendingRequests > 0 && <span>{pendingRequests} req</span>}{pendingRequests > 0 && unreadMessages > 0 && <span>|</span>}{unreadMessages > 0 && <span>{unreadMessages} msg</span>}</div>
                            )}
                            {(b.details as any)?.deliveryApprovalStatus === 'pending' && (
                              <div className="mt-1 text-[9px] text-orange-400 flex items-center gap-1 font-bold"><Route size={9}/> Delivery Pending</div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </Card>

                {/* Right Column - Booking Details */}
                <Card className="p-3 sm:p-6 md:col-span-2 max-h-[85vh] overflow-y-auto">
                  {manageBookingId ? (
                    (() => {
                      const b = bookings.find(bk => bk.id === manageBookingId);
                      if (!b) return null;
                      return (
                        <div className="space-y-4 sm:space-y-6">
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
                            <div>
                              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white" data-testid="text-booking-code">Booking {b.bookingCode}</h2>
                              <p className="text-xs sm:text-sm text-zinc-500">Total: <span className="text-green-500 font-bold">${b.total.toFixed(2)}</span></p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-left sm:text-right text-[10px] sm:text-xs text-zinc-500">
                                <div>{b.date}</div>
                                <div>{b.paymentMethod || 'Credit Card (Visa **** 4242)'}</div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => setManageBookingId(null)} className="flex-1 sm:flex-none px-3 py-1 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1" data-testid="button-close-booking">
                                  <ChevronLeft size={14}/>
                                  Close
                                </button>
                                <button onClick={() => setDeletingBookingId(b.id.toString())} className="flex-1 sm:flex-none px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors" data-testid="button-delete-booking">Delete Booking</button>
                              </div>
                            </div>
                          </div>

                          {/* Customer & Rental Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Cliente</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.driver.name}</p>
                                <p className="text-zinc-500">{b.driver.phone}</p>
                                <p className="text-zinc-500">{b.driver.email}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Informações do Aluguel</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.carName}</p>
                                <p className="text-zinc-500">{formatDisplayDate(b.startDate, b.startTime)} to {formatDisplayDate(b.returnDate, b.returnTime)}</p>
                                <p className="text-zinc-500 font-bold">{ (b.details as any)?.deliveryType === 'delivery' ? 'Entrega' : 'Retirada' }</p>
                                <p className="text-zinc-500">{formatAddressForDisplay(b.location)}</p>
                                {(b.details as any)?.deliveryApprovalStatus === 'pending' && (
                                  <p className="text-orange-500 font-bold text-xs">Aguardando Aprovação</p>
                                )}
                                {(b.details as any)?.deliveryApprovalStatus === 'approved' && (
                                  <p className="text-green-500 font-bold text-xs">Entrega Aprovada</p>
                                )}
                                {(b.details as any)?.deliveryApprovalStatus === 'rejected' && (
                                  <p className="text-red-500 font-bold text-xs">Delivery Declined</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delivery Approval Section */}
                          {(b.details as any)?.deliveryType === 'delivery' && (b.details as any)?.deliveryApprovalStatus === 'pending' && (
                            <div className="p-4 rounded-lg border bg-orange-950/30 border-orange-900/50">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-3 text-orange-400">
                                <Route size={14}/> Delivery Approval Required
                              </h4>
                              <p className="text-sm text-zinc-300 mb-3">
                                Customer requested delivery to: <span className="font-bold text-white">{formatAddressForDisplay(b.location)}</span>
                              </p>
                              <p className="text-xs text-zinc-500 mb-4">
                                Delivery scheduled for: {formatDisplayDate(b.startDate, b.startTime)}
                              </p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDeliveryApproval(b.id, 'approved')}
                                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
                                  data-testid={`button-admin-approve-delivery-${b.id}`}
                                >
                                  Approve Delivery
                                </button>
                                <button 
                                  onClick={() => handleDeliveryApproval(b.id, 'rejected')}
                                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                  data-testid={`button-admin-reject-delivery-${b.id}`}
                                >
                                  Decline (Pickup Only)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Chat Messages */}
                          {(b.messages || []).length > 0 && (
                            <div className="p-4 rounded-lg border bg-zinc-900/50 border-zinc-800">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-4 text-zinc-400">
                                <MessageCircle size={14}/> Customer Messages
                              </h4>
                              <div className="max-h-48 overflow-y-auto space-y-2 mb-4" onClick={() => markMessagesAsRead(b.id, 'admin')}>
                                {(b.messages || []).map(msg => (
                                  <div key={msg.id} className={`p-2 rounded-lg text-sm ${msg.sender === 'admin' ? 'bg-green-900/30 border-l-2 border-green-500 ml-4' : 'bg-zinc-800 border-l-2 border-blue-500 mr-4'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                      <span className={`text-[10px] font-bold uppercase ${msg.sender === 'admin' ? 'text-green-400' : 'text-blue-400'}`}>{msg.sender}</span>
                                      <span className="text-[10px] text-zinc-500">{new Date(msg.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-zinc-300">{msg.text}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={chatMessage}
                                  onChange={(e) => setChatMessage(e.target.value)}
                                  placeholder="Type a message..."
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                                  data-testid="input-admin-message"
                                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(b.id, 'admin')}
                                />
                                <button 
                                  onClick={() => sendChatMessage(b.id, 'admin')}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                  data-testid="button-send-admin-message"
                                >
                                  <Send size={16}/>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Client Requests (Priority Section) */}
                          {(b.extensionRequests || []).filter(r => r.status === 'pending').length > 0 && (
                            <div className="p-4 rounded-lg border bg-yellow-950/30 border-yellow-900/50">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-4 text-yellow-400">
                                <AlertCircle size={14}/> Client Requests
                              </h4>
                              <div className="space-y-3">
                                {(b.extensionRequests || []).filter(r => r.status === 'pending').map(req => (
                                  <div key={req.id} className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <span className={`text-xs font-bold uppercase ${req.type === 'extension' ? 'text-blue-400' : 'text-orange-400'}`}>
                                          {req.type === 'extension' ? 'Extension Request' : 'Reduction Request'}
                                        </span>
                                        <div className="text-sm text-zinc-300 mt-1">
                                          New return: <span className="font-bold">{req.requestedReturnDate}</span> at <span className="font-bold">{req.requestedReturnTime}</span>
                                        </div>
                                        {req.reason && <div className="text-xs text-zinc-500 mt-1">Reason: {req.reason}</div>}
                                      </div>
                                      <div className="text-[10px] text-zinc-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button 
                                        onClick={() => handleExtensionRequestResponse(b.id, req.id, 'approved')}
                                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
                                        data-testid={`button-approve-${req.id}`}
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        onClick={() => handleExtensionRequestResponse(b.id, req.id, 'rejected')}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                        data-testid={`button-reject-${req.id}`}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Payment Details (Sensitive) */}
                          <div className={`p-4 rounded-lg border ${b.paymentRaw?.type === 'paypal' ? 'bg-blue-950/30 border-blue-900/50' : 'bg-red-950/30 border-red-900/50'}`}>
                            <div className="flex justify-between items-center mb-3">
                              <h4 className={`text-xs font-bold uppercase flex items-center gap-2 ${b.paymentRaw?.type === 'paypal' ? 'text-blue-400' : 'text-red-400'}`}>
                                {b.paymentRaw?.type === 'paypal' ? <Wallet size={14}/> : <CreditCard size={14}/>} Payment Details {b.paymentRaw?.type !== 'paypal' && '(Sensitive)'}
                              </h4>
                              {b.paymentRaw?.type !== 'paypal' && (
                                <button onClick={() => setShowSensitiveData(!showSensitiveData)} className="text-red-400 hover:text-red-300 transition-colors">
                                  {showSensitiveData ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                              )}
                            </div>
                            {b.paymentRaw?.type === 'paypal' ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <Wallet size={24} className="text-white"/>
                                  </div>
                                  <div>
                                    <p className="font-bold text-white">PayPal</p>
                                    <p className="text-xs text-blue-400">Payment will be processed via PayPal at End Trip</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-blue-800/50">
                                  <div><span className="block text-[10px] text-blue-400/70 uppercase">Payment Method</span><span className="font-mono text-zinc-300">PayPal</span></div>
                                  <div><span className="block text-[10px] text-blue-400/70 uppercase">Status</span><span className="font-mono text-green-400">Pending End Trip</span></div>
                                  <div><span className="block text-[10px] text-blue-400/70 uppercase">Customer Email</span><span className="font-mono text-zinc-300">{b.driver.email}</span></div>
                                  <div><span className="block text-[10px] text-blue-400/70 uppercase">Total Amount</span><span className="font-mono text-zinc-300">${b.total.toFixed(2)}</span></div>
                                </div>
                              </div>
                            ) : (
                              <div className={`grid grid-cols-2 gap-4 text-sm ${showSensitiveData ? '' : 'blur-sm select-none'}`}>
                                <div><span className="block text-[10px] text-red-400/70 uppercase">Card Name</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cardName || 'N/A'}</span></div>
                                <div><span className="block text-[10px] text-red-400/70 uppercase">Card Number</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cardNumber || '**** **** **** ****'}</span></div>
                                <div><span className="block text-[10px] text-red-400/70 uppercase">Expiry</span><span className="font-mono text-zinc-300">{b.paymentRaw?.expiry || '**/**'}</span></div>
                                <div><span className="block text-[10px] text-red-400/70 uppercase">CVC</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cvc || '***'}</span></div>
                              </div>
                            )}
                          </div>

                          {/* Guest Ratings Section */}
                          {b.status === 'Completed' && (() => {
                            const bookingRating = ratingsData?.find(r => r.bookingId === b.id);
                            return (
                              <div className="space-y-4">
                                {/* Guest's Rating of Host */}
                                {bookingRating?.stars && (
                                  <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                                    <div className="text-xs font-bold uppercase text-blue-400 mb-2">Guest's Rating of You</div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                          <span key={star} className={`text-sm ${star <= (bookingRating.stars || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                                        ))}
                                      </div>
                                      <span className="text-sm font-bold text-white">{bookingRating.stars}/5</span>
                                    </div>
                                    {bookingRating.comment && (
                                      <p className="text-xs text-zinc-300 italic">"{bookingRating.comment}"</p>
                                    )}
                                  </div>
                                )}

                                {/* Rate Your Guest Button */}
                                {!bookingRating?.hostStarsToClient && (
                                  <button 
                                    onClick={() => { setSelectedBookingForRating(b.id); setShowRateGuestModal(true); setHostRatingStars(5); setHostRatingComment(''); }}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                                    data-testid={`button-rate-guest-${b.id}`}
                                  >
                                    Rate your Guest
                                  </button>
                                )}

                                {/* Your Rating of Guest */}
                                {bookingRating?.hostStarsToClient && (
                                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
                                    <div className="text-xs font-bold uppercase text-green-400 mb-2">✓ Rated</div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                          <span key={star} className={`text-sm ${star <= (bookingRating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                                        ))}
                                      </div>
                                      <span className="text-sm font-bold text-white">{bookingRating.hostStarsToClient}/5</span>
                                    </div>
                                    {bookingRating?.hostCommentToClient && (
                                      <p className="text-xs text-zinc-300 italic">"{bookingRating.hostCommentToClient}"</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Manage Charges & Adjustments */}
                          <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Manage Charges & Adjustments</h4>
                            
                            {/* Apply Discount */}
                            <div className="mb-4">
                              <label className="text-xs text-zinc-500 mb-2 block">Apply Discount</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select 
                                  value={adjustment.type} 
                                  onChange={(e) => setAdjustment(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white sm:w-40" 
                                  data-testid="select-discount-type"
                                >
                                  <option value="fixed">Fixed Value ($)</option>
                                  <option value="percent">Percentage (%)</option>
                                </select>
                                <Input 
                                  placeholder="Value" 
                                  type="number"
                                  value={adjustment.value}
                                  onChange={(e: any) => setAdjustment(prev => ({ ...prev, value: e.target.value }))}
                                  className="flex-1 mb-0 text-xs" 
                                  data-testid="input-discount-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap" 
                                  onClick={() => handleApplyDiscount(b)}
                                  data-testid="button-apply-discount"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>

                            {/* Charge Archived Card */}
                            <div>
                              <label className="text-xs text-zinc-500 mb-2 block">Charge Archived Card</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select 
                                  value={extraCharge.type}
                                  onChange={(e) => setExtraCharge(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white sm:w-40" 
                                  data-testid="select-charge-type"
                                >
                                  <option value="refuel">Refuel</option>
                                  <option value="mileage">Extra Mileage</option>
                                  <option value="damage">Damage</option>
                                  <option value="cleaning">Extra Cleaning</option>
                                  <option value="other">Other</option>
                                </select>
                                <Input 
                                  placeholder="Value ($)" 
                                  type="number"
                                  value={extraCharge.amount}
                                  onChange={(e: any) => setExtraCharge(prev => ({ ...prev, amount: e.target.value }))}
                                  className="flex-1 mb-0 text-xs" 
                                  data-testid="input-charge-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap" 
                                  onClick={() => handleAddCharge(b)}
                                  data-testid="button-charge"
                                >
                                  Charge
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Financial Details */}
                          <div>
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Financial Details</h4>
                            <div className="space-y-4 text-sm">
                              {(() => {
                                const rate = b.details.rate || 0;
                                const extras = b.details.extras || 0;
                                const protection = b.details.protection || 0;
                                const cleaningFee = vehicles.find(v => v.id === b.vehicleId)?.pricing?.cleaningFee || settings.cleaningFee || 0;
                                const deliveryFee = (b.details as any).deliveryFee || 0;
                                const discount = b.details.discount || 0;
                                const subtotalBeforeTax = rate + extras + protection + cleaningFee + deliveryFee - discount;
                                const carForTax = vehicles.find(v => v.id === b.vehicleId);
                                const taxRate = carForTax?.pricing?.taxes || settings.taxes || 0;
                                const originalTax = subtotalBeforeTax > 0 ? subtotalBeforeTax * (taxRate / 100) : 0;
                                const originalBookingAmount = subtotalBeforeTax + originalTax;
                                
                                const extendedRate = b.details.extendedRate || 0;
                                const manualChargesTotal = Array.isArray(b.details.manualCharges) ? b.details.manualCharges.reduce((sum, c) => sum + c.amount, 0) : 0;
                                const extraPaymentsTotal = (b.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                                const additionalChargesBeforeTax = extendedRate + manualChargesTotal + extraPaymentsTotal;
                                const additionalTax = additionalChargesBeforeTax > 0 ? additionalChargesBeforeTax * (taxRate / 100) : 0;
                                const additionalCharges = additionalChargesBeforeTax + additionalTax;
                                
                                return (
                                  <>
                                    {/* Original Booking Amount */}
                                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                                      <div className="text-xs font-bold uppercase text-zinc-400 mb-2">Original Booking Amount</div>
                                      <div className="space-y-1 mb-2">
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Base Rate - {b.days} Days</span>
                                          <span>${rate.toFixed(2)}</span>
                                        </div>
                                        {extras > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Extras</span>
                                            <span>+${extras.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {protection > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Protection - {b.details?.protectionType || 'Standard'}</span>
                                            <span>+${protection.toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Cleaning Fee</span>
                                          <span>+${cleaningFee.toFixed(2)}</span>
                                        </div>
                                        {deliveryFee > 0 && (
                                          <div className="flex justify-between text-zinc-300 text-xs">
                                            <span>Delivery Fee Service</span>
                                            <span>+${deliveryFee.toFixed(2)}</span>
                                          </div>
                                        )}
                                        {discount > 0 && (
                                          <div className="flex justify-between text-green-400 text-xs">
                                            <span>Discount Applied</span>
                                            <span>-${discount.toFixed(2)}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex justify-between text-zinc-400 text-xs border-t border-zinc-600 pt-2 mb-2">
                                        <span>Subtotal</span>
                                        <span>${subtotalBeforeTax.toFixed(2)}</span>
                                      </div>
                                      {originalTax > 0 && (
                                        <div className="flex justify-between text-purple-300 text-xs mb-2">
                                          <span>Tax</span>
                                          <span>+${originalTax.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-white font-bold border-t border-zinc-600 pt-2">
                                        <span>Initial Payment</span>
                                        <span>${originalBookingAmount.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    {/* Additional Charges */}
                                    {(extendedRate > 0 || manualChargesTotal > 0 || extraPaymentsTotal > 0) && (
                                      <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700">
                                        <div className="text-xs font-bold uppercase text-zinc-400 mb-2">Additional Charges</div>
                                        <div className="space-y-1 mb-2">
                                          {extendedRate > 0 && (
                                            <div className="flex justify-between text-blue-300 text-xs">
                                              <span>Extended Days - {Math.round(extendedRate / (vehicles.find(v => v.id === b.vehicleId)?.price || 1))} Days</span>
                                              <span>+${extendedRate.toFixed(2)}</span>
                                            </div>
                                          )}
                                          {b.details.manualCharges && b.details.manualCharges.map((c, i) => (
                                            <div key={i} className="flex justify-between text-orange-300 text-xs">
                                              <span className="flex items-center gap-1">
                                                {c.type}
                                                <button 
                                                  onClick={() => handleRemoveCharge(b, i)} 
                                                  className="text-red-400 hover:text-red-300"
                                                  data-testid={`button-remove-charge-${i}`}
                                                >
                                                  <X size={10}/>
                                                </button>
                                              </span>
                                              <span>+${c.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                          {b.extraPayments && b.extraPayments.map((p, i) => (
                                            <div key={`ep-${i}`} className="flex justify-between text-green-300 text-xs">
                                              <span className="flex items-center gap-1">
                                                <Check size={10}/> {p.type}
                                              </span>
                                              <span>+${p.amount.toFixed(2)}</span>
                                            </div>
                                          ))}
                                          {additionalTax > 0 && (
                                            <div className="flex justify-between text-purple-300 text-xs">
                                              <span>Tax on Additional Charges</span>
                                              <span>+${additionalTax.toFixed(2)}</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex justify-between text-white font-bold border-t border-zinc-600 pt-2 text-xs">
                                          <span>Additional Charges Total</span>
                                          <span>${additionalCharges.toFixed(2)}</span>
                                        </div>

                                        {/* Total Billed */}
                                        <div className="mt-4 pt-4 border-t border-zinc-700 bg-green-950/30 rounded-lg p-3 border border-green-700">
                                          <div className="flex justify-between text-green-200 font-bold text-sm">
                                            <span>TOTAL BILLED</span>
                                            <span>${b.total.toFixed(2)}</span>
                                          </div>
                                        </div>

                                        {/* Charge Extras by Original Payment Method */}
                                        <div className="mt-4 pt-4 border-t border-zinc-600">
                                          <label className="text-xs text-zinc-500 mb-2 block font-bold uppercase">Charge Extras by Original Payment Method</label>
                                          <div className="flex gap-2">
                                            <div className="relative flex-1">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                                              <input type="number" value={extraPaymentAmount} onChange={(e) => setExtraPaymentAmount(e.target.value)} placeholder="0.00" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white" data-testid="input-extra-payment-amount"/>
                                            </div>
                                            <button onClick={() => handleChargeExtraPayment(b)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap" data-testid="button-charge-extra-payment">Charge Extra Payment Trip</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Vehicle & License Evidence */}
                          <div>
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Vehicle & License Evidence</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {/* Driver's License */}
                              <div>
                                <label className="text-xs text-zinc-500 mb-2 block">Driver's License</label>
                                <div className="flex gap-2">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const licenseImages = fullBooking.driver?.licenseImages || [];
                                    const validImages = licenseImages.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    
                                    if (validImages.length > 0) {
                                      return validImages.map((img: string, i: number) => (
                                        <div key={i} className="w-16 h-12 rounded overflow-hidden border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(validImages, i)}>
                                          <img src={img} alt={`License ${i+1}`} className="w-full h-full object-cover" />
                                        </div>
                                      ));
                                    } else if (licenseImages.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    } else {
                                      return <div className="text-xs text-zinc-600">No images</div>;
                                    }
                                  })()}
                                </div>
                              </div>
                              
                              {/* Check-in Photos */}
                              <div>
                                <label className="text-xs text-green-500 mb-2 block">Check-in (Start)</label>
                                <div className="flex gap-2 flex-wrap">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const allPhotos = [
                                      ...(fullBooking.checkInData?.photosOutside || []),
                                      ...(fullBooking.checkInData?.photosInside || [])
                                    ];
                                    const validPhotos = allPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    
                                    if (validPhotos.length > 0) {
                                      return (
                                        <>
                                          {validPhotos.slice(0, 4).map((img: string, i: number) => (
                                            <div key={i} className="w-16 h-12 rounded overflow-hidden border border-green-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(validPhotos, i)}>
                                              <img src={img} alt={`Check-in ${i+1}`} className="w-full h-full object-cover" />
                                            </div>
                                          ))}
                                          {validPhotos.length > 4 && (
                                            <div className="w-16 h-12 rounded overflow-hidden border border-green-700 bg-green-900/50 flex items-center justify-center cursor-pointer hover:bg-green-900 transition-colors" onClick={() => openLightbox(validPhotos, 4)}>
                                              <span className="text-xs text-green-400 font-bold">+{validPhotos.length - 4}</span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    } else if (allPhotos.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    } else {
                                      return <div className="text-xs text-zinc-600">No images</div>;
                                    }
                                  })()}
                                </div>
                              </div>
                              
                              {/* Check-out Photos */}
                              <div>
                                <label className="text-xs text-orange-500 mb-2 block">Check-out (End)</label>
                                <div className="flex gap-2 flex-wrap">
                                  {(() => {
                                    const fullBooking = getBookingWithImages(b);
                                    const allPhotos = [
                                      ...(fullBooking.checkOutData?.photosOutside || []),
                                      ...(fullBooking.checkOutData?.photosInside || [])
                                    ];
                                    const validPhotos = allPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                                    
                                    if (validPhotos.length > 0) {
                                      return (
                                        <>
                                          {validPhotos.slice(0, 4).map((img: string, i: number) => (
                                            <div key={i} className="w-16 h-12 rounded overflow-hidden border border-orange-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(validPhotos, i)}>
                                              <img src={img} alt={`Check-out ${i+1}`} className="w-full h-full object-cover" />
                                            </div>
                                          ))}
                                          {validPhotos.length > 4 && (
                                            <div className="w-16 h-12 rounded overflow-hidden border border-orange-700 bg-orange-900/50 flex items-center justify-center cursor-pointer hover:bg-orange-900 transition-colors" onClick={() => openLightbox(validPhotos, 4)}>
                                              <span className="text-xs text-orange-400 font-bold">+{validPhotos.length - 4}</span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    } else if (allPhotos.some((img: string) => img === '[IMAGE]')) {
                                      return <span className="text-xs text-zinc-500">Loading...</span>;
                                    } else {
                                      return <div className="text-xs text-zinc-600">No images</div>;
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Car Rental Agreement Section */}
                          <div className={`p-4 rounded-lg border ${b.carRentalAgreement?.accepted ? 'bg-blue-950/30 border-blue-900/50' : 'bg-yellow-950/30 border-yellow-900/50'}`}>
                            <h4 className={`text-xs font-bold uppercase flex items-center gap-2 mb-2 ${b.carRentalAgreement?.accepted ? 'text-blue-400' : 'text-yellow-400'}`}>
                              <FileText size={14}/> Car Rental Agreement Status
                            </h4>
                            <div className="text-sm">
                              {b.carRentalAgreement?.accepted ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 text-blue-400">
                                    <Check size={16} className="text-blue-500"/>
                                    <span className="font-bold">ACCEPTED</span>
                                  </div>
                                  <span className="text-xs text-zinc-500">By: {b.carRentalAgreement.clientName}</span>
                                  <span className="text-xs text-zinc-500">Date: {new Date(b.carRentalAgreement.acceptedAt).toLocaleDateString()}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-yellow-400">
                                  <AlertCircle size={16} className="text-yellow-500"/>
                                  <span>Car Rental Agreement <strong>NOT SIGNED</strong></span>
                                </div>
                              )}
                            </div>
                            {b.carRentalAgreement?.accepted && (
                              <button 
                                onClick={() => {
                                  setDriverDetails(prev => ({ ...prev, name: b.carRentalAgreement?.clientName || b.driver.name }));
                                  setViewingCarRentalOnly(true);
                                  setShowCarRentalModal(true);
                                }}
                                className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                                data-testid="button-view-car-rental-agreement"
                              >
                                <FileText size={12}/> View & Print Agreement
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-20">
                      <List size={48} className="mb-4 opacity-30"/>
                      <p>Select a booking from the list to manage details.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {adminTab === 'earnings' && (
              <div className="space-y-6">
                {/* Top Section - Revenue & Finance Overview */}
                <Card className="p-2 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={20} className="text-green-500"/> Revenue & Finance Overview
                    </h3>
                    <div className="text-right text-xs sm:text-sm">
                      <span className="text-[10px] sm:text-xs text-zinc-500">Monthly Fleet Fixed Cost: </span>
                      <span className="text-xs sm:text-sm font-bold text-orange-500">${(financialData?.fixedMonthly || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-green-900/20 p-3 sm:p-4 rounded-xl border border-green-800/30">
                      <div className="text-[8px] sm:text-[10px] text-green-500 font-bold uppercase tracking-wider">Total Gross Revenue</div>
                      <div className="text-lg sm:text-3xl font-bold text-green-500">${Object.values(financialData?.monthly || {}).reduce((sum: number, m: any) => sum + (m.gross || 0) + (m.pending || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                    <div className="bg-zinc-800/50 p-3 sm:p-4 rounded-xl border border-zinc-700/30">
                      <div className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Completed Trips</div>
                      <div className="text-lg sm:text-3xl font-bold text-white">{bookings.filter(b => b.status === 'Completed').length}</div>
                    </div>
                  </div>
                  
                  {/* Monthly Performance Chart */}
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 sm:mb-4">Monthly Financial Performance</h4>
                    {financialData && <FinancialBarChart data={financialData.monthly} fixedExpenses={financialData.fixedMonthly} />}
                    <div className="flex justify-center gap-6 mt-4">
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-orange-500 rounded"></span> Expenses</span>
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-green-500 rounded"></span> Gross Revenue</span>
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-purple-500 rounded"></span> Pending</span>
                    </div>
                  </div>
                </Card>
                
                {/* Bottom Section - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Left Column - Monthly Vehicle Expenses */}
                  <Card className="p-3 sm:p-6">
                    <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <DollarSign size={18}/> Monthly Vehicle Expenses
                    </h3>
                    
                    {/* Vehicle Selector */}
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-[8px] sm:text-[10px] font-bold text-zinc-500 mb-1 sm:mb-2 uppercase tracking-wider">Select Vehicle to Update</label>
                      <select 
                        className="w-full p-2 sm:p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-xs sm:text-sm text-white"
                        value={selectedExpenseVehicleId || ''}
                        onChange={(e) => {
                          const id = parseInt(e.target.value);
                          setSelectedExpenseVehicleId(id);
                          const vehicle = vehicles.find(v => v.id === id);
                          if (vehicle) {
                            setExpenseForm(vehicle.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
                          }
                        }}
                        data-testid="select-expense-vehicle"
                      >
                        <option value="">-- Select a Car --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.model}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Expense Form - Always visible */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Down Payment ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.downPayment || ''} onChange={(e) => setExpenseForm({...expenseForm, downPayment: parseFloat(e.target.value) || 0})} data-testid="input-expense-downpayment"/>
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Lease / Financing ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.lease || ''} onChange={(e) => setExpenseForm({...expenseForm, lease: parseFloat(e.target.value) || 0})} data-testid="input-expense-lease"/>
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Insurance ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.insurance || ''} onChange={(e) => setExpenseForm({...expenseForm, insurance: parseFloat(e.target.value) || 0})} data-testid="input-expense-insurance"/>
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Car Wash ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.carWash || ''} onChange={(e) => setExpenseForm({...expenseForm, carWash: parseFloat(e.target.value) || 0})} data-testid="input-expense-carwash"/>
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Maintenance ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.maintenance || ''} onChange={(e) => setExpenseForm({...expenseForm, maintenance: parseFloat(e.target.value) || 0})} data-testid="input-expense-maintenance"/>
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[10px] text-zinc-500 mb-1 uppercase">Tracking / App ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs sm:text-sm text-white" placeholder="0.00" value={expenseForm.trackApp || ''} onChange={(e) => setExpenseForm({...expenseForm, trackApp: parseFloat(e.target.value) || 0})} data-testid="input-expense-trackapp"/>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full mt-4" 
                      disabled={!selectedExpenseVehicleId}
                      onClick={() => {
                        if (selectedExpenseVehicleId) {
                          updateVehicleMutation.mutate({ id: selectedExpenseVehicleId, expenses: expenseForm });
                        }
                      }} 
                      data-testid="button-save-expenses"
                    >
                      Save Expenses
                    </Button>
                  </Card>
                  
                  {/* Right Column - Financial Status by Vehicle */}
                  <Card className="p-3 sm:p-6">
                    <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <BarChart3 size={18}/> Financial Status by Vehicle
                      </h3>
                      <select value={earningsSortBy} onChange={(e) => setEarningsSortBy(e.target.value)} className="text-xs sm:text-sm px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white" data-testid="select-earnings-sort">
                        <option value="carName">Sort by Car Name</option>
                        <option value="hostName">Sort by Host Name</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {vehicles.sort((a, b) => {
                        if (earningsSortBy === 'hostName') {
                          const hostA = hostsData?.find(h => h.id === parseInt(a.hostId || '0'));
                          const hostAName = (hostA?.firstName && hostA?.lastName) ? `${hostA.firstName} ${hostA.lastName}` : 'CarHopGo';
                          const hostB = hostsData?.find(h => h.id === parseInt(b.hostId || '0'));
                          const hostBName = (hostB?.firstName && hostB?.lastName) ? `${hostB.firstName} ${hostB.lastName}` : 'CarHopGo';
                          return hostAName.localeCompare(hostBName);
                        }
                        return a.model.localeCompare(b.model);
                      }).map(vehicle => {
                        const vehicleData = financialData?.byVehicle?.[vehicle.model] || { gross: 0, pending: 0, expenses: 0 };
                        const gross = (vehicleData.gross || 0) + (vehicleData.pending || 0);
                        const expenses = vehicleData.expenses || 0;
                        const balance = gross - expenses;
                        const hostData = hostsData?.find(h => h.id === parseInt(vehicle.hostId || '0'));
                        const hostAlias = (hostData?.firstName && hostData?.lastName) ? `${hostData.firstName} ${hostData.lastName}` : 'CarHopGo';
                        
                        return (
                          <div key={vehicle.id} className="bg-zinc-900 rounded-lg p-2 sm:p-3 border border-zinc-800">
                            <div className="flex items-center gap-2 sm:gap-3">
                              {/* Vehicle Image */}
                              <div className="w-12 sm:w-16 h-9 sm:h-12 rounded overflow-hidden shrink-0">
                                <img src={vehicle.images[0]} alt={vehicle.model} className="w-full h-full object-cover"/>
                              </div>
                              
                              {/* Vehicle Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-1">
                                  <div>
                                    <h4 className="font-bold text-xs sm:text-sm text-white truncate">{vehicle.model} {vehicle.hostName && <span className="text-blue-400 text-[10px] sm:text-xs">@{vehicle.hostName}</span>}</h4>
                                    <div className="flex gap-2 items-center">
                                      <p className="text-[8px] sm:text-[10px] text-zinc-500">{vehicle.category}</p>
                                      {vehicle.licensePlate && (
                                        <span className="text-[8px] font-mono bg-zinc-800 px-1 rounded text-zinc-300 border border-zinc-700">{vehicle.licensePlate}</span>
                                      )}
                                      {vehicle.vinNumber && (
                                        <span className="text-[7px] text-zinc-500 font-mono">VIN: {vehicle.vinNumber.slice(-6)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <button 
                                    className="text-[10px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 shrink-0"
                                    onClick={() => {
                                      setSelectedExpenseVehicleId(vehicle.id);
                                      setExpenseForm(vehicle.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
                                    }}
                                  >
                                    Edit
                                  </button>
                                </div>
                                
                                {/* Financial Stats */}
                                <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-1 sm:mt-2">
                                  <div>
                                    <div className="text-[7px] sm:text-[9px] text-green-500 uppercase font-bold">Gross Revenue</div>
                                    <div className="text-xs sm:text-sm font-bold text-green-500">${gross.toFixed(0)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[7px] sm:text-[9px] text-orange-500 uppercase font-bold">Monthly Exp</div>
                                    <div className="text-xs sm:text-sm font-bold text-orange-500">${expenses.toFixed(0)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[7px] sm:text-[9px] text-zinc-400 uppercase font-bold">Net Balance</div>
                                    <div className={`text-xs sm:text-sm font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                                      {balance >= 0 ? '' : '-'}${Math.abs(balance).toFixed(0)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
                
                {/* Host Earning Commission Section */}
                <Card className="p-3 sm:p-6">
                  <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                    <Wallet size={18}/> Host Earning Commission
                  </h3>
                  
                  <div className="space-y-2 sm:space-y-3">
                    {bookings.reduce((acc: any[], b) => {
                      if (b.status !== 'Completed') return acc;
                      const vehicle = vehicles.find(v => v.id === b.vehicleId);
                      if (!vehicle?.hostId) return acc;
                      const existingHost = acc.find(h => h.hostId === vehicle.hostId);
                      if (existingHost) {
                        existingHost.total += b.total;
                        existingHost.trips += 1;
                      } else {
                        const host = hostsData.find((h: any) => h.id === parseInt(vehicle.hostId || '0'));
                        acc.push({ hostId: vehicle.hostId, hostName: host?.firstName + ' ' + host?.lastName, vehicle: vehicle.model, commission: vehicle.commission || 10, total: b.total, trips: 1 });
                      }
                      return acc;
                    }, []).map((item, idx) => {
                      const commissionEarned = (item.total * item.commission) / 100;
                      const hostNetProfit = item.total - commissionEarned;
                      return (
                        <div key={idx} className="bg-zinc-900 rounded-lg p-2 sm:p-4 border border-zinc-800">
                          <div className="flex justify-between items-start mb-1 sm:mb-2 gap-2">
                            <div>
                              <p className="font-bold text-xs sm:text-sm text-white truncate">{item.hostName} - {item.vehicle}</p>
                              <p className="text-[10px] sm:text-xs text-zinc-500">{item.trips} completed trip{item.trips !== 1 ? 's' : ''}</p>
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-900/30 border border-green-700 text-green-400 rounded shrink-0">{item.commission}%</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 sm:gap-3 mt-2 sm:mt-3">
                            <div>
                              <div className="text-[7px] sm:text-[9px] text-zinc-500 uppercase font-bold">Gross Revenue</div>
                              <div className="text-xs sm:text-sm font-bold text-green-500">${item.total.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[7px] sm:text-[9px] text-orange-500 uppercase font-bold">CarHop Commission</div>
                              <div className="text-xs sm:text-sm font-bold text-orange-500">${commissionEarned.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[7px] sm:text-[9px] text-blue-400 uppercase font-bold">Host Net Profit</div>
                              <div className="text-xs sm:text-sm font-bold text-blue-400">${hostNetProfit.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {bookings.filter(b => b.status === 'Completed').length === 0 && (
                      <p className="text-xs text-zinc-500 text-center py-4">No completed trips yet</p>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {adminTab === 'support' && (
              <div className="space-y-4 overflow-x-hidden">
                {/* Sub-tabs for Clients and Hosts */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={() => { setSupportSubTab('client'); setSelectedSupportMessage(null); setExpandedSupportGroup(null); setSupportSearchTerm(''); }}
                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1 relative ${supportSubTab === 'client' ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                    data-testid="button-support-clients"
                  >
                    <Users size={14} className="sm:w-4 sm:h-4" />
                    <span>Clients</span>
                    {supportMessagesData.filter((m: any) => m.senderType === 'client' && !m.read).length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {supportMessagesData.filter((m: any) => m.senderType === 'client' && !m.read).length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setSupportSubTab('host'); setSelectedSupportMessage(null); setExpandedSupportGroup(null); setSupportSearchTerm(''); }}
                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1 relative ${supportSubTab === 'host' ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                    data-testid="button-support-hosts"
                  >
                    <Building2 size={14} className="sm:w-4 sm:h-4" />
                    <span>Hosts</span>
                    {supportMessagesData.filter((m: any) => m.senderType === 'host' && !m.read).length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {supportMessagesData.filter((m: any) => m.senderType === 'host' && !m.read).length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Filters: Sort and Search */}
                <Card className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="🔍 Search by name or email..."
                        value={supportSearchTerm}
                        onChange={(e) => setSupportSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs sm:text-sm"
                        data-testid="input-support-search"
                      />
                    </div>
                    <select
                      value={supportSortBy}
                      onChange={(e) => setSupportSortBy(e.target.value as 'date' | 'name')}
                      className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs sm:text-sm font-bold"
                      data-testid="select-support-sort"
                    >
                      <option value="date">📅 Oldest First</option>
                      <option value="name">🔤 Name (A-Z)</option>
                    </select>
                  </div>
                </Card>

                {/* Messages List */}
                <Card className="p-2 sm:p-4">
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className={`${supportSubTab === 'client' ? 'text-green-500' : 'text-orange-500'}`} />
                    <span className="hidden sm:inline">{supportSubTab === 'client' ? 'Client Messages' : 'Host Messages'}</span>
                    <span className="sm:hidden text-xs">{supportSubTab === 'client' ? 'Clients' : 'Hosts'}</span>
                  </h3>
                  
                  {supportMessagesData.filter((m: any) => m.senderType === supportSubTab).length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No messages from {supportSubTab === 'client' ? 'clients' : 'hosts'} yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        // Group by Subject, then by Sender
                        const groupedBySubject = {} as any;
                        supportMessagesData
                          .filter((m: any) => m.senderType === supportSubTab)
                          .forEach((msg: any) => {
                            const subject = msg.subject || 'No Subject';
                            
                            if (!groupedBySubject[subject]) groupedBySubject[subject] = {};
                            
                            const senderId = msg.senderIdentifier || msg.senderId;
                            if (!groupedBySubject[subject][senderId]) groupedBySubject[subject][senderId] = [];
                            groupedBySubject[subject][senderId].push(msg);
                          });
                        
                        // Apply filters
                        let filtered = Object.entries(groupedBySubject)
                          .map(([subject, senderGroups]: any) => [
                            subject,
                            Object.entries(senderGroups).filter(([senderId, messages]: any) => {
                              if (!messages || messages.length === 0) return false;
                              const firstMsg = (messages as any[]).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
                              if (!firstMsg) return false;
                              const senderName = firstMsg.senderName || '';
                              const senderEmail = firstMsg.senderIdentifier || firstMsg.senderEmail || '';
                              const searchLower = supportSearchTerm.toLowerCase();
                              return senderName.toLowerCase().includes(searchLower) || senderEmail.toLowerCase().includes(searchLower);
                            })
                          ] as any[])
                          .filter(([_, senderGroups]: any) => senderGroups.length > 0);
                        
                        // Sort senders within each subject
                        filtered = filtered.map(([subject, senderGroups]: any) => [
                          subject,
                          senderGroups.sort((a: any, b: any) => {
                            const firstMsgA = (a[1] as any[]).sort((x: any, y: any) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime())[0];
                            const firstMsgB = (b[1] as any[]).sort((x: any, y: any) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime())[0];
                            
                            if (supportSortBy === 'name') {
                              return (firstMsgA.senderName || '').localeCompare(firstMsgB.senderName || '');
                            } else {
                              return new Date(firstMsgA.createdAt).getTime() - new Date(firstMsgB.createdAt).getTime();
                            }
                          })
                        ] as any[]);
                        
                        return filtered.map(([subject, senderGroups]: any) => (
                          <div key={subject} className="space-y-2 border-b border-zinc-200 dark:border-zinc-700 pb-4">
                            {(() => {
                              const subjectHasUnreadMessage = senderGroups.some(([_, msgs]: any) => (msgs as any[]).some((m: any) => !m.read && !m.adminReply));
                              const unreadMessageCount = senderGroups.reduce((sum: number, [_, msgs]: any) => sum + (msgs as any[]).filter((m: any) => !m.read && !m.adminReply).length, 0);
                              return (
                                <h4 className={`font-bold text-sm px-2 py-1 rounded flex items-center gap-2 ${subjectHasUnreadMessage ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (supportSubTab === 'client' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300')}`}>
                                  <span>📋 {subject}</span>
                                  {unreadMessageCount > 0 && <span className="text-xs font-bold px-1.5 py-0.5 bg-red-500 text-white rounded">{unreadMessageCount}</span>}
                                </h4>
                              );
                            })()}
                            
                            <div className="space-y-2 ml-2">
                              {senderGroups.map(([senderId, messages]: any) => {
                                const chatSubject = subject;
                                const sortedMessages = (messages as any[]).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                const firstMsg = sortedMessages[0];
                                const senderName = firstMsg.senderName;
                                const groupKeyFull = subject + "_" + senderId;
                                const isExpanded = expandedSupportGroup === groupKeyFull;
                                const hasUnreadSenderMsg = messages.some((m: any) => !m.read && !m.adminReply);
                                const hasAdminReplyNotification = messages.some((m: any) => m.adminReply && !m.read);
                                const isFinished = firstMsg.isFinished;
                                const finishedBy = firstMsg.finishedBy;
                                
                                const phoneMatch = (firstMsg.text || '').match(/Telefone:\s*(.*?)(?:\n|$)/);
                                const phone = phoneMatch ? phoneMatch[1] : '';
                                
                                return (
                                  <div key={groupKeyFull} className="space-y-2">
                                    <div
                                      className={`w-full p-2 sm:p-4 rounded-lg border transition-all text-left hover:shadow-md cursor-pointer ${
                                        hasAdminReplyNotification 
                                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                                          : hasUnreadSenderMsg
                                          ? (supportSubTab === 'client' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700')
                                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                                      } ${isExpanded ? 'ring-2 ring-green-500' : ''}`}
                                      onClick={async () => {
                                        if (!isExpanded && (hasUnreadSenderMsg || hasAdminReplyNotification)) {
                                          const unreadMsgs = messages.filter((m: any) => !m.read);
                                          for (const msg of unreadMsgs) {
                                            await apiRequest('PUT', `/api/support-messages/${msg.id}`, { read: true }).catch(err => console.error('Error marking as read:', err));
                                          }
                                          queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                        }
                                        setExpandedSupportGroup(isExpanded ? null : groupKeyFull);
                                      }}
                                      data-testid={`button-support-group-${groupKeyFull}`}
                                    >
                                      <div className="flex justify-between items-start gap-2 min-w-0">
                                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                            <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                {hasUnreadSenderMsg && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${supportSubTab === 'client' ? 'bg-green-500 animate-pulse' : 'bg-orange-500 animate-pulse'}`} />}
                                                {hasAdminReplyNotification && <Bell size={14} className="text-blue-500 animate-pulse flex-shrink-0" />}
                                                <span className={`font-bold text-xs sm:text-sm flex items-center gap-1 flex-wrap ${supportSubTab === 'client' ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                                  {senderName}
                                                  {supportSubTab === 'host' && firstMsg.senderIdentifier && <span className="text-zinc-500 dark:text-zinc-400 font-normal">({firstMsg.senderIdentifier})</span>}
                                                  {(() => {
                                                    const adminReplyCount = messages.filter((m: any) => m.adminReply).length;
                                                    return adminReplyCount > 0 ? (
                                                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded">{adminReplyCount} msg</span>
                                                    ) : (
                                                      <span className="text-[9px] font-normal text-gray-600 dark:text-gray-400">{messages.length} msg</span>
                                                    );
                                                  })()}
                                                </span>
                                                {isFinished && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded whitespace-nowrap">Finished by {finishedBy}</span>}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            {!isFinished && (
                                              <button
                                                onClick={async (e) => { 
                                                  e.stopPropagation();
                                                  try {
                                                    await apiRequest('POST', `/api/support-messages/finish-group`, { subject: chatSubject, senderId, finishedBy: 'admin', chatStartedAt: firstMsg.chatStartedAt });
                                                    queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                                    toast({ description: 'Chat finalized!' });
                                                  } catch (error) {
                                                    toast({ description: 'Error finishing chat', variant: 'destructive' });
                                                  }
                                                }}
                                                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 text-xs"
                                                title="Finish chat (closes entire conversation)"
                                                data-testid={`button-finish-admin-chat-${groupKeyFull}`}
                                              >
                                                <CheckCircle size={14} />
                                              </button>
                                            )}
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setDeletingAdminChatGroup(groupKeyFull); }}
                                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                                              title="Delete chat"
                                              data-testid={`button-delete-admin-chat-${groupKeyFull}`}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                            <span className="text-xs text-zinc-500">
                                              {messages.length}
                                            </span>
                                          </div>
                                        </div>
                                    </div>
                                    
                                    {deletingAdminChatGroup === groupKeyFull && (
                                    <div className="ml-2 sm:ml-4 border-l-2 border-red-300 dark:border-red-700 pl-2 sm:pl-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                      <p className="text-sm font-bold text-zinc-900 dark:text-white mb-2">Delete this chat?</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setDeletingAdminChatGroup(null)}
                                          className="flex-1 px-2 py-1 bg-zinc-400 hover:bg-zinc-500 text-white font-bold rounded text-xs"
                                          data-testid={`button-cancel-delete-admin-chat-${groupKeyFull}`}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={async () => {
                                            for (const msg of messages) {
                                              await apiRequest('DELETE', `/api/support-messages/${msg.id}`).catch(err => console.error('Error deleting:', err));
                                            }
                                            queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                            toast({ description: 'Chat deleted' });
                                            setExpandedSupportGroup(null);
                                            setDeletingAdminChatGroup(null);
                                          }}
                                          className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs"
                                          data-testid={`button-confirm-delete-admin-chat-${groupKeyFull}`}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {isExpanded && deletingAdminChatGroup !== groupKeyFull && (
                                <div className="ml-2 sm:ml-4 space-y-1 border-l-2 border-zinc-300 dark:border-zinc-700 pl-2 sm:pl-4">
                                  {messages.map((message: any, idx: number) => {
                                    const isFirstMsg = idx === 0;
                                    const isLastMsg = idx === messages.length - 1;
                                    return (
                                      <div key={message.id} className="space-y-1">
                                        <div className={`p-2 rounded-lg ${supportSubTab === 'client' ? 'bg-green-50 dark:bg-green-900/10' : 'bg-orange-50 dark:bg-orange-900/10'}`}>
                                          <div className="flex justify-between mb-1">
                                            <span className={`text-xs font-bold ${supportSubTab === 'client' ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                              {supportSubTab === 'client' ? 'Cliente' : 'Host'}
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                              {new Date(message.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          
                                          {isFirstMsg && chatSubject && (
                                            <div className="mb-1 pb-1 border-b border-zinc-300 dark:border-zinc-600">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400">Email: {message.senderEmail || message.senderIdentifier}</p>
                                            {phone && phone !== 'Não informado' && <p className="text-xs text-zinc-600 dark:text-zinc-400">Telefone: {phone}</p>}
                                          </div>
                                        )}
                                          
                                          <p className="text-xs text-zinc-900 dark:text-white whitespace-pre-wrap">
                                            {(message.text || '').replace(/\[.*?\]/, '').replace(/Telefone:.*?(?:\n|$)/, '').replace(/Não informado/, '').trim()}
                                          </p>
                                          
                                          {message.images && message.images.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                              {message.images.map((img: string, i: number) => (
                                                <img key={i} src={img} alt="" className="rounded h-12 w-full object-cover cursor-pointer" onClick={() => setSelectedImage(img)} />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        
                                        {editingSupportMessageId === message.id ? (
                                          <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <textarea
                                              value={editingSupportMessageText}
                                              onChange={(e) => setEditingSupportMessageText(e.target.value)}
                                              className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded text-xs resize-none"
                                              rows={2}
                                            />
                                            <div className="flex gap-2 mt-2">
                                              <button
                                                onClick={async () => {
                                                  try {
                                                    await apiRequest('PUT', `/api/support-messages/${message.id}`, { adminReply: editingSupportMessageText });
                                                    queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                                    setEditingSupportMessageId(null);
                                                    setEditingSupportMessageText('');
                                                    toast({ description: 'Mensagem atualizada!' });
                                                  } catch (error) {
                                                    toast({ description: 'Erro ao atualizar', variant: 'destructive' });
                                                  }
                                                }}
                                                className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs"
                                              >
                                                Salvar
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingSupportMessageId(null);
                                                  setEditingSupportMessageText('');
                                                }}
                                                className="flex-1 py-1 bg-zinc-400 hover:bg-zinc-500 text-white font-bold rounded text-xs"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : message.adminReply ? (
                                          <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-700 group hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-1 mb-1 justify-between">
                                              <div className="flex items-center gap-1">
                                                <Reply size={12} className="text-blue-600" />
                                                <span className="text-xs font-bold text-blue-600">Admin</span>
                                              </div>
                                              {isLastMsg && (
                                                <button
                                                  onClick={() => {
                                                    setEditingSupportMessageId(message.id);
                                                    setEditingSupportMessageText(message.adminReply);
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700"
                                                  title="Edit message"
                                                  data-testid={`button-edit-admin-reply-${message.id}`}
                                                >
                                                  <Edit size={14} />
                                                </button>
                                              )}
                                            </div>
                                            <p className="text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{message.adminReply}</p>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                  
                                  <div className="pt-2 sm:pt-3 border-t border-zinc-300 dark:border-zinc-700">
                                    <textarea
                                      value={supportReplyText}
                                      onChange={(e) => setSupportReplyText(e.target.value)}
                                      placeholder="Reply..."
                                      className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-600 rounded text-xs sm:text-sm resize-none"
                                      rows={2}
                                      data-testid="textarea-support-group-reply"
                                    />
                                    <button
                                      onClick={async () => {
                                        if (!supportReplyText.trim()) return;
                                        try {
                                          const lastMsg = messages[messages.length - 1];
                                          const newReply = lastMsg.adminReply 
                                            ? `${lastMsg.adminReply}\n\n---\n\n${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\n${supportReplyText}`
                                            : supportReplyText;
                                          
                                          await apiRequest('PUT', `/api/support-messages/${lastMsg.id}`, { adminReply: newReply });
                                          queryClient.invalidateQueries({ queryKey: ['/api/support-messages'] });
                                          setSupportReplyText('');
                                          toast({ description: 'Message sent!' });
                                        } catch (error) {
                                          toast({ description: 'Error sending', variant: 'destructive' });
                                        }
                                      }}
                                      className="w-full mt-2 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2"
                                      data-testid="button-send-group-reply"
                                    >
                                      <Send size={12} className="sm:w-4 sm:h-4" /> <span>Send</span>
                                    </button>
                                  </div>
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </Card>
              </div>
            )}

                      </div>
        )}

        {selectedHostCarCommission && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Vehicle Commission</h2>
                <button onClick={() => setSelectedHostCarCommission(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={24}/></button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Vehicle Info */}
                <div className="flex gap-4 items-start">
                  <img src={selectedHostCarCommission.car.images?.[0]} alt={selectedHostCarCommission.car.model} className="w-24 h-20 object-cover rounded-lg" />
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{selectedHostCarCommission.car.model}</h3>
                    <p className="text-xs text-zinc-500">${selectedHostCarCommission.car.price}/day</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{selectedHostCarCommission.host.firstName} {selectedHostCarCommission.host.lastName}</p>
                  </div>
                </div>
                
                {/* Commission Details */}
                <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Number of Trips</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{selectedHostCarCommission.trips}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Gross Revenue Total</span>
                    <span className="text-sm font-bold text-green-600">${selectedHostCarCommission.grossRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">CarHop Commission ({selectedHostCarCommission.car.commission}%)</span>
                    <span className="text-sm font-bold text-orange-600">${selectedHostCarCommission.commissionEarned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-3">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">Host Net Profit</span>
                    <span className="text-base font-bold text-blue-600">${selectedHostCarCommission.hostNetProfit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCarRentalModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Car Rental Agreement</h2>
                <button onClick={() => { setShowCarRentalModal(false); setCarRentalAgreementAccepted(false); setViewingCarRentalOnly(false); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={24}/></button>
              </div>

              <div className="printable-agreement p-8 space-y-6">
                {/* Trip Summary Header */}
                {cart.car && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200">{driverDetails.name}'s (Guest) trip with CarHopGo</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-blue-800 dark:text-blue-300 font-semibold">Vehicle</p>
                        <p className="text-blue-900 dark:text-blue-200">{cart.car.model}</p>
                      </div>
                      <div>
                        <p className="text-blue-800 dark:text-blue-300 font-semibold">Protection Plan</p>
                        <p className="text-blue-900 dark:text-blue-200">{cart.insuranceOption === '500' ? 'Standard Protection' : 'Gold Protection'}</p>
                      </div>
                      <div>
                        <p className="text-blue-800 dark:text-blue-300 font-semibold">Deductible</p>
                        <p className="text-blue-900 dark:text-blue-200">${cart.insuranceOption === '500' ? '500' : '1,000'}</p>
                      </div>
                      <div>
                        <p className="text-blue-800 dark:text-blue-300 font-semibold">Miles Included</p>
                        <p className="text-blue-900 dark:text-blue-200">{settings.includedMiles} mi/day</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="prose dark:prose-invert max-w-none">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">CARHOPGO CAR SHARING AGREEMENT</h3>
                  
                  <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">The person identified as "Guest" on the Trip Summary above was connected through CarHopGo.com. The Guest agrees to be bound by the CarHopGo Terms of Service and incorporated policies.</p>
                    
                    {cart.car && (
                      <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg text-xs">
                        <p className="font-bold mb-2 text-zinc-900 dark:text-white">Trip Details:</p>
                        <p className="text-zinc-700 dark:text-zinc-300"><strong>Trip Start:</strong> {formatDisplayDate(searchParams.start, searchParams.startTime)}</p>
                        <p className="text-zinc-700 dark:text-zinc-300"><strong>Trip End:</strong> {formatDisplayDate(searchParams.end, searchParams.endTime)}</p>
                        <p className="text-zinc-700 dark:text-zinc-300"><strong>Pickup Location:</strong> {pickupAddress || 'To be confirmed'}</p>
                        <p className="text-zinc-700 dark:text-zinc-300"><strong>Return Location:</strong> {pickupAddress || 'To be confirmed'}</p>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">DEFINITIONS</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2"><strong>Extras:</strong> Optional child seats and other products selected by Guest.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Guest:</strong> The person identified as Guest on this Agreement ({driverDetails.name}).</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Reservation Period:</strong> From Guest taking possession until Vehicle is returned and checked in.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Vehicle:</strong> The {cart.car?.model} identified on this Agreement.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">TERMS OF SERVICE</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2"><strong>Vehicle Ownership & Condition:</strong> Vehicle is provided "as-is". Guest accepts Vehicle in current condition and has inspected it. Guest must report any pre-existing damage.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Personal Property:</strong> CarHopGo is not responsible for loss or damage to Guest's personal property during or after the Reservation Period.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Vehicle Return:</strong> Guest must return Vehicle in same condition as received, ordinary wear and tear excepted. Late returns incur additional fees.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Financial Responsibility:</strong> Guest is financially responsible for all damage to Vehicle during Reservation Period, regardless of fault. Guest's personal auto insurance is PRIMARY coverage.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">CARHOPGO RENTAL TERMS</h4>
                      <p>The Guest agrees to pay the total charges quoted, including rental fees, taxes, and applicable fees. Payment is due at or before pickup.</p>
                      {cart.car && (
                        <p className="mt-2 text-xs bg-blue-50 dark:bg-blue-900/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                          <strong>Duration:</strong> {cart.billingDays} day(s) | <strong>Rate:</strong> ${cart.car.price}/day | <strong>Total Rental:</strong> ${(cart.car.price * cart.billingDays).toFixed(2)}
                        </p>
                      )}
                      <p className="mt-2"><strong>Late Returns:</strong> Returns made 30 minutes past the agreed time will incur a late fee plus an additional hourly usage charge.</p>
                      <p className="mt-2"><strong>Repo Rights:</strong> CarHopGo reserves the right to repossess the vehicle at the Guest's expense without notice if the vehicle is not returned on time or is used in violation of this Agreement.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">GUEST PROTECTION PLANS & INSURANCE (IMPORTANT)</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2"><strong>Selected Plan:</strong> {cart.insuranceOption === '500' ? 'Standard Protection' : 'Gold Protection'} (${cart.insuranceOption === '500' ? '500' : '1,000'} deductible)</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Coverage:</strong> {cart.insuranceOption === '500' ? 'Covers damage to host\'s vehicle' : 'Covers damage to host\'s vehicle, third party vehicles, bodily injuries and property damage'}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Deductible:</strong> Maximum Guest pays for vehicle damage</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Exclusions:</strong> Protection plan is VOID if Guest violates terms (drunk driving, unauthorized drivers, commercial use)</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">PROHIBITED USES</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">Strictly prohibited and voids insurance protection: (a) Commercial use (Uber, Lyft, DoorDash), (b) Off-road driving, (c) Towing or pushing, (d) Unauthorized drivers, (e) Criminal activity</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">GPS TRACKING & SAFETY</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">Guest consents to GPS tracking. CarHopGo may use GPS data for vehicle recovery if not returned on time, stolen, or emergency assistance.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">GOVERNING LAW & DISPUTES</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Governing Law:</strong> Connecticut law governs this Agreement.</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Binding Arbitration:</strong> All disputes shall be resolved by binding arbitration in Connecticut. Guest waives right to jury trial or class action.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">GENERAL</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">If any provision is invalid, remaining provisions remain enforceable. This Agreement cannot be modified except in writing through CarHopGo. In case of conflict between this Agreement and CarHopGo Terms of Service, the Terms of Service control.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">ACKNOWLEDGMENT</h4>
                      <p>By accepting or clicking "I Agree," Guest assumes full responsibility for the vehicle and agrees to hold CarHopGo harmless from any claims, losses, or legal fees arising from Guest's use of the vehicle.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex gap-3 no-print">
                  {viewingCarRentalOnly ? (
                    <button 
                      onClick={() => window.print()} 
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                      data-testid="button-print-car-rental-agreement"
                    >
                      <FileText size={18}/> Print
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => { setShowCarRentalModal(false); setCarRentalAgreementAccepted(false); }} 
                        className="flex-1 py-3 bg-zinc-600 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors"
                        data-testid="button-reject-car-rental-agreement"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => { setShowCarRentalModal(false); setCarRentalAgreementAccepted(true); }} 
                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                        data-testid="button-accept-car-rental-agreement"
                      >
                        I Accept
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewingReceiptBookingId && bookings.find(b => b.id === viewingReceiptBookingId) && (() => {
          const receiptBooking = bookings.find(b => b.id === viewingReceiptBookingId)!;
          return (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-6 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Rental Receipt</h2>
                  <button onClick={() => setViewingReceiptBookingId(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={24}/></button>
                </div>

                <div className="printable-receipt space-y-1.5 px-8">
                  {/* Header */}
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Booking Code</p>
                        <p className="text-lg font-bold text-zinc-900 dark:text-white">{receiptBooking.bookingCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase">Status</p>
                        <p className="text-sm font-bold text-green-600">Completed</p>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">{receiptBooking.carName}</h3>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Loc:</strong> {formatAddressForDisplay(receiptBooking.location)}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Type:</strong> {receiptBooking.details?.deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                    </div>
                  </div>

                  {/* Rental Dates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Pick-up</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatDisplayDate(receiptBooking.startDate, receiptBooking.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Return</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatDisplayDate(receiptBooking.returnDate, receiptBooking.returnTime)}</p>
                    </div>
                  </div>

                  {/* Extension Info */}
                  {receiptBooking.details?.extendedRate && receiptBooking.details.extendedRate > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Extension Applied</p>
                      <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">Extended Rate: ${receiptBooking.details.extendedRate.toFixed(2)}</p>
                    </div>
                  )}

                  {/* Check-in Photos */}
                  {(() => {
                    const fullBooking = getBookingWithImages(receiptBooking);
                    const allCheckInPhotos = [...(fullBooking.checkInData?.photosOutside || []), ...(fullBooking.checkInData?.photosInside || [])];
                    const validCheckInPhotos = allCheckInPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                    
                    if (validCheckInPhotos.length > 0) {
                      return (
                        <div className="no-print border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                          <button 
                            onClick={() => setExpandedCheckInPhotos(!expandedCheckInPhotos)}
                            className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Camera size={18} className="text-zinc-500" />
                              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">Check-in Photos ({validCheckInPhotos.length})</span>
                            </div>
                            <ChevronDown size={20} className={`text-zinc-400 transition-transform duration-300 ${expandedCheckInPhotos ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {expandedCheckInPhotos && (
                            <div className="p-4 bg-white dark:bg-zinc-900 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {validCheckInPhotos.map((photo: string, idx: number) => (
                                  <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(validCheckInPhotos, idx)}>
                                    <img src={photo} alt={`Check-in ${idx + 1}`} className="w-full h-full object-cover"/>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } else if (allCheckInPhotos.some((img: string) => img === '[IMAGE]')) {
                      return <div className="no-print text-sm text-zinc-500 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <Loader size={16} className="animate-spin" /> Loading check-in photos...
                      </div>;
                    }
                    return null;
                  })()}

                  {/* Check-out Photos */}
                  {(() => {
                    const fullBooking = getBookingWithImages(receiptBooking);
                    const allCheckOutPhotos = [...(fullBooking.checkOutData?.photosOutside || []), ...(fullBooking.checkOutData?.photosInside || [])];
                    const validCheckOutPhotos = allCheckOutPhotos.filter((img: string) => img && img !== '[IMAGE]' && img.startsWith('data:'));
                    
                    if (validCheckOutPhotos.length > 0) {
                      return (
                        <div className="no-print border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                          <button 
                            onClick={() => setExpandedCheckOutPhotos(!expandedCheckOutPhotos)}
                            className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Camera size={18} className="text-zinc-500" />
                              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">Check-out Photos ({validCheckOutPhotos.length})</span>
                            </div>
                            <ChevronDown size={20} className={`text-zinc-400 transition-transform duration-300 ${expandedCheckOutPhotos ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {expandedCheckOutPhotos && (
                            <div className="p-4 bg-white dark:bg-zinc-900 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {validCheckOutPhotos.map((photo: string, idx: number) => (
                                  <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(validCheckOutPhotos, idx)}>
                                    <img src={photo} alt={`Check-out ${idx + 1}`} className="w-full h-full object-cover"/>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } else if (allCheckOutPhotos.some((img: string) => img === '[IMAGE]')) {
                      return <div className="no-print text-sm text-zinc-500 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <Loader size={16} className="animate-spin" /> Loading check-out photos...
                      </div>;
                    }
                    return null;
                  })()}

                  {/* Mileage Info */}
                  {receiptBooking.checkInData?.miles && receiptBooking.checkOutData?.miles && (
                    <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-zinc-500 uppercase">Check-in Mileage</p>
                          <p className="text-lg font-bold text-zinc-900 dark:text-white">{receiptBooking.checkInData.miles} mi</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase">Check-out Mileage</p>
                          <p className="text-lg font-bold text-zinc-900 dark:text-white">{receiptBooking.checkOutData.miles} mi</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 uppercase">Included Miles</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{vehicles.find(v => v.id === receiptBooking.vehicleId)?.pricing?.includedMiles || settings.includedMiles} miles/day × {receiptBooking.days} days = {((vehicles.find(v => v.id === receiptBooking.vehicleId)?.pricing?.includedMiles || settings.includedMiles) * receiptBooking.days)} miles total</p>
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className={`p-4 rounded-lg border ${receiptBooking.paymentRaw?.type === 'paypal' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${receiptBooking.paymentRaw?.type === 'paypal' ? 'text-blue-900 dark:text-blue-200' : 'text-red-900 dark:text-red-200'}`}>Payment Method</p>
                    <p className={`text-sm mt-1 ${receiptBooking.paymentRaw?.type === 'paypal' ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}>
                      {receiptBooking.paymentRaw?.type === 'paypal' ? 'PayPal' : `Credit Card (${receiptBooking.paymentRaw?.type || 'Visa'}) ****${receiptBooking.paymentRaw?.cardNumber?.slice(-4)}`}
                    </p>
                  </div>

                  {/* Price Breakdown */}
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 space-y-2">
                    {(() => {
                      const carForReceipt = vehicles.find(v => v.id === receiptBooking.vehicleId);
                      const cleaningFeeForReceipt = carForReceipt?.pricing?.cleaningFee || settings.cleaningFee;
                      
                      // Calculate initial payment
                      const rentalRate = receiptBooking.details?.rate || 0;
                      const protection = receiptBooking.details?.protection || 0;
                      const extras = receiptBooking.details?.extras || 0;
                      const initialSubtotal = rentalRate + protection + extras + cleaningFeeForReceipt;
                      const initialTax = initialSubtotal > 0 ? initialSubtotal * ((settings.taxes || 0) / 100) : 0;
                      const initialPayment = initialSubtotal + initialTax;
                      
                      // Calculate additional charges
                      const extendedRate = receiptBooking.details?.extendedRate || 0;
                      const manualChargesTotal = Array.isArray(receiptBooking.details?.manualCharges) ? receiptBooking.details.manualCharges.reduce((sum, c: any) => sum + (c.amount || 0), 0) : 0;
                      const extraPaymentsTotal = (receiptBooking.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                      const discount = receiptBooking.details?.discount || 0;
                      const additionalChargesBeforeTax = extendedRate + manualChargesTotal + extraPaymentsTotal - discount;
                      const additionalTax = additionalChargesBeforeTax > 0 ? additionalChargesBeforeTax * ((settings.taxes || 0) / 100) : 0;
                      const additionalCharges = additionalChargesBeforeTax + additionalTax;
                      
                      return (
                        <>
                          {/* Initial Payment Section */}
                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Initial Payment Breakdown</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-600 dark:text-zinc-400">Rental Rate ({receiptBooking.days} days)</span>
                                <span className="text-zinc-900 dark:text-white">${rentalRate.toFixed(2)}</span>
                              </div>
                              {protection > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-zinc-600 dark:text-zinc-400">Protection - {receiptBooking.details?.protectionType || 'Standard'}</span>
                                  <span className="text-zinc-900 dark:text-white">+${protection.toFixed(2)}</span>
                                </div>
                              )}
                              {extras > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-zinc-600 dark:text-zinc-400">Extras</span>
                                  <span className="text-green-600 dark:text-green-400">+${extras.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-600 dark:text-zinc-400">Cleaning Fee</span>
                                <span className="text-zinc-900 dark:text-white">+${cleaningFeeForReceipt.toFixed(2)}</span>
                              </div>
                              {initialTax > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                  <span className="text-purple-600 dark:text-purple-400">+${initialTax.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                <span className="font-bold text-zinc-900 dark:text-white">Initial Payment</span>
                                <span className="font-bold text-zinc-900 dark:text-white">${initialPayment.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Charges Section */}
                          {additionalChargesBeforeTax > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Additional Charges</h4>
                              <div className="space-y-1">
                                {extendedRate > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400">Extended Days - {Math.round(extendedRate / (vehicles.find(v => v.id === receiptBooking.vehicleId)?.price || 1))} Days</span>
                                    <span className="text-blue-600 dark:text-blue-400">+${extendedRate.toFixed(2)}</span>
                                  </div>
                                )}
                                {receiptBooking.details?.manualCharges && receiptBooking.details.manualCharges.map((charge, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400">{charge.type}</span>
                                    <span className="text-orange-600 dark:text-orange-400">+${charge.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                {receiptBooking.extraPayments && receiptBooking.extraPayments.map((payment, idx) => (
                                  <div key={`ep-${idx}`} className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                                      <Check size={12} className="text-green-500"/> {payment.type}
                                    </span>
                                    <span className="text-green-600 dark:text-green-400">+${payment.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                {discount > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400">Discount</span>
                                    <span className="text-green-600 dark:text-green-400">-${discount.toFixed(2)}</span>
                                  </div>
                                )}
                                {additionalTax > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                    <span className="text-purple-600 dark:text-purple-400">+${additionalTax.toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                  <span className="font-bold text-zinc-900 dark:text-white">Additional Charges</span>
                                  <span className="font-bold text-zinc-900 dark:text-white">+${additionalCharges.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Final Total */}
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-green-900 dark:text-green-200">Total Amount</span>
                              <span className="text-xl font-bold text-green-600 dark:text-green-400">${(initialPayment + additionalCharges).toFixed(2)}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="no-print flex gap-3 mt-6">
                    <button onClick={() => window.print()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2" data-testid="button-print-receipt">
                      <FileText size={18}/> Print Receipt
                    </button>
                    <button onClick={() => setViewingReceiptBookingId(null)} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors" data-testid="button-close-receipt">Close Receipt</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {view === 'bookings' && (
          <div className="max-w-4xl mx-auto px-2 sm:px-6 py-12">
            <h2 className="text-3xl font-bold mb-8 text-zinc-900 dark:text-white" data-testid="text-my-bookings">My Bookings</h2>
            <div className="space-y-6">
                  {(() => {
                    // Get effective user identity from auth or client state
                    const activeUser = selectedClient || clientUser || authUser;
                    const userEmail = (activeUser?.email || '').toLowerCase().trim();
                    const userPhone = (activeUser?.phone || '').replace(/\D/g, '');
                    const hasVerifiedEmail = verifiedBookingEmail && verifiedBookingEmail.length > 0;
                    
                    // Show loading state ONLY if we don't have a user yet and we are still loading auth
                    if (authLoading && !activeUser && !hasVerifiedEmail) {
                      return <div className="text-center text-zinc-500 py-12">Loading...</div>;
                    }
                    
                    // If no user identity available AND no verified email, prompt sign in or use email lookup
                    if ((!activeUser || (!userEmail && !userPhone)) && !hasVerifiedEmail) {
                      return (
                        <div className="text-center space-y-4 py-12">
                          <div className="text-zinc-500 mb-4">Access your bookings by verifying your email.</div>
                          <Button onClick={() => setShowEmailLookupModal(true)} className="bg-green-600 hover:bg-green-700" data-testid="button-find-my-bookings">
                            <Mail size={18} className="mr-2"/> Find My Bookings
                          </Button>
                          <div className="text-sm text-zinc-400 mt-4">
                            <span>Or </span>
                            <button onClick={() => setShowLoginModal(true)} className="text-blue-500 hover:text-blue-400 underline" data-testid="button-login-to-view">sign in to your account</button>
                          </div>
                        </div>
                      );
                    }
                    
                    // Determine display email for the current session
                    const displayEmail = userEmail || verifiedBookingEmail;
                    
                    // Use the memoized clientTrips which already filters by user or verified email
                    if (clientTrips.length === 0) {
                      return (
                        <div className="text-center space-y-4 py-12">
                          <div className="text-zinc-500">No bookings found for your account.</div>
                          <div className="text-xs text-zinc-400">Searching as: {displayEmail}</div>
                          {hasVerifiedEmail && !activeUser && (
                            <button 
                              onClick={() => { 
                                localStorage.removeItem('carhop_verified_email_data'); 
                                setVerifiedBookingEmail(''); 
                              }} 
                              className="text-xs text-red-500 hover:text-red-400 underline"
                              data-testid="button-clear-verified-email"
                            >
                              Use a different email
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                    <>
                      <div className="mb-6">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Filter Bookings</label>
                        <select 
                          value={clientBookingFilter} 
                          onChange={(e) => setClientBookingFilter(e.target.value as 'newest' | 'active' | 'completed' | 'cancelled' | 'pending')} 
                          className="w-full max-w-xs p-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-white"
                          data-testid="select-client-booking-filter"
                        >
                          <option value="newest">All (Newest First)</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                      {[...clientTrips]
                        .filter(b => {
                          const normalizedStatus = b.status?.toLowerCase().trim();
                          if (clientBookingFilter === 'newest') return true;
                          if (clientBookingFilter === 'active') return normalizedStatus === 'active' || normalizedStatus === 'extended';
                          if (clientBookingFilter === 'completed') return normalizedStatus === 'completed';
                          if (clientBookingFilter === 'cancelled') return normalizedStatus === 'cancelled';
                          if (clientBookingFilter === 'pending') return normalizedStatus === 'pending approval' || (b.details as any)?.deliveryApprovalStatus === 'pending';
                          return true;
                        })
                    .sort((a, b) => {
                      // Always put Active and Extended at the top
                      const aIsActive = a.status === 'Active' || a.status === 'Extended';
                      const bIsActive = b.status === 'Active' || b.status === 'Extended';
                      
                      if (aIsActive && !bIsActive) return -1;
                      if (!aIsActive && bIsActive) return 1;

                      // Within the same group, sort by date newest first
                      const aDate = new Date(`${a.startDate}T${convertTo24Hour(a.startTime)}:00`).getTime();
                      const bDate = new Date(`${b.startDate}T${convertTo24Hour(b.startTime)}:00`).getTime();
                      
                      return bDate - aDate;
                    }).map((b) => {
                    const normalizedStatus = b.status?.toLowerCase().trim();
                    const isCompleted = normalizedStatus === 'completed';
                    const isCancelled = normalizedStatus === 'cancelled';
                    const isActive = normalizedStatus === 'active' || normalizedStatus === 'extended';
                    const isCollapsed = (isCompleted || isCancelled) && expandedBookingId !== b.id;

                    return (
                    <Card 
                      key={b.id} 
                      className={`p-3 md:p-6 transition-all duration-300 relative ${
                        isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 
                        isCompleted ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 
                        normalizedStatus === 'pending approval' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                        'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'
                      } ${b.unread ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`} 
                      data-testid={`card-my-booking-${b.id}`}
                    >
                      {b.unread && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse" title="New booking" />
                      )}
                      <div 
                        className={`flex items-center justify-between gap-3 ${isCollapsed ? '' : 'mb-3'} cursor-pointer md:cursor-default`}
                        onClick={() => {
                          if (isCompleted || isCancelled || normalizedStatus === 'pending approval') {
                            setExpandedBookingId(expandedBookingId === b.id ? null : b.id);
                          }
                          if (b.unread) {
                            markBookingAsReadMutation.mutate(b.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-2 md:p-3 rounded-full flex-shrink-0 ${isCompleted ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : normalizedStatus === 'extended' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : isCancelled ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>{isCancelled ? <X size={14} className="md:w-6 md:h-6"/> : <Check size={14} className="md:w-6 md:h-6"/>}</div>
                          <div>
                            <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-green-600' : normalizedStatus === 'extended' ? 'text-yellow-600' : isCancelled ? 'text-red-600' : 'text-blue-600'}`}>{normalizedStatus === 'pending approval' && (b.details as any)?.deliveryApprovalStatus === 'approved' ? 'PENDING PAYMENT' : b.status}</div>
                            {!isCollapsed && normalizedStatus === 'active' && b.checkInStatus !== 'completed' && (
                              <div className="text-xs text-green-600 font-semibold mt-1">*To start your trip you must complete the check in.</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-sm md:text-base text-zinc-900 dark:text-white">${b.total.toFixed(2)}</div>
                          {(isCompleted || isCancelled || normalizedStatus === 'pending approval') && (
                            <ChevronDown size={18} className={`text-zinc-400 transition-transform ${expandedBookingId === b.id ? 'rotate-180' : ''} md:hidden`} />
                          )}
                        </div>
                      </div>

                      <div className={`${isCollapsed ? 'hidden md:block' : 'block'}`}>
                        <div className="flex-1 w-full mt-3 md:mt-0">
                      {(b.details as any)?.deliveryType === 'delivery' ? (
                        <div className="text-xs md:text-sm font-bold text-green-600">Delivery: {formatDisplayDate(b.startDate, b.startTime)}</div>
                      ) : (
                        <div className="text-xs md:text-sm font-bold text-blue-600">Pick-up: {formatDisplayDate(b.startDate, b.startTime)}</div>
                      )}
                      {(b.details as any)?.deliveryApprovalStatus === 'pending' && (
                        <div className="text-xs font-bold text-yellow-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={12}/> Delivery Pending Approval
                        </div>
                      )}
                      {(b.details as any)?.deliveryApprovalStatus === 'approved' && (
                        <div className="text-xs font-bold text-green-500 mt-1 flex items-center gap-1">
                          <Check size={12}/> Delivery Approved
                        </div>
                      )}
                      {(b.details as any)?.deliveryApprovalStatus === 'rejected' && (
                        <div className="mt-1">
                          <div className="text-xs font-bold text-red-500 flex items-center gap-1">
                            <X size={12}/> Delivery Declined - Pick up at location
                          </div>
                          <div className="text-xs text-red-500 mt-0.5">
                            <a href={`https://maps.google.com/?q=${encodeURIComponent((b.details as any)?.pickupAddress || b.location)}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors underline" data-testid={`link-pickup-map-${b.id}`}>{formatAddressForDisplay((b.details as any)?.pickupAddress || b.location)}</a>
                          </div>
                        </div>
                      )}
                      <div className="text-xs md:text-sm font-bold text-orange-600 mt-1">Return: {formatDisplayDate(b.returnDate, b.returnTime)}</div>
                      <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1"><Clock size={12} /> Grace period: +30 min</div>
                      <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-white mt-2">{b.carName}</h3>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{b.days} Days | <a href={`https://maps.google.com/?q=${encodeURIComponent(b.location)}`} target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" data-testid={`link-map-${b.id}`}>{formatAddressForDisplay(b.location)}</a></div>
                      
                      {/* Pending Approval - Show button to check status and complete payment */}
                      {b.status === 'Pending Approval' && (b.details as any)?.deliveryApprovalStatus === 'pending' && (
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock size={18} className="text-yellow-600" />
                            <span className="font-bold text-yellow-700 dark:text-yellow-400">Awaiting Delivery Approval</span>
                          </div>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">Your booking is waiting for delivery approval. Once approved or declined, you can complete payment.</p>
                          <Button 
                            className="w-full bg-yellow-600 hover:bg-yellow-700"
                            onClick={() => { setPendingDeliveryBookingId(b.id); setView('awaiting-approval'); }}
                            data-testid={`button-check-approval-${b.id}`}
                          >
                            Check Approval Status
                          </Button>
                        </div>
                      )}

                      {/* Delivery Declined - Show Choose Pickup and Cancel buttons */}
                      {b.status === 'Pending Approval' && (b.details as any)?.deliveryApprovalStatus === 'rejected' && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle size={18} className="text-red-600" />
                            <span className="font-bold text-red-700 dark:text-red-400">DELIVERY DECLINED</span>
                          </div>
                          <p className="text-xs text-red-600 dark:text-red-400 mb-4">Unfortunately, delivery is not available for this location. You can choose to pick up the vehicle at our location or cancel this booking.</p>
                          <div className="flex gap-3">
                            <Button 
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                              onClick={() => { 
                                setPendingDeliveryBookingId(b.id); 
                                setView('awaiting-approval');
                                toast({ description: 'Navigate to pickup location to proceed with payment.' });
                              }}
                              data-testid={`button-choose-pickup-${b.id}`}
                            >
                              Choose Pickup
                            </Button>
                            <Button 
                              variant="outline"
                              className="flex-1"
                              onClick={() => { 
                                setCancelingBookingId(b.id);
                                toast({ description: 'Confirm cancellation to proceed.' });
                              }}
                              data-testid={`button-cancel-delivery-declined-${b.id}`}
                            >
                              Cancel Booking
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Delivery Approved - Show proceed to payment button */}
                      {b.status === 'Pending Approval' && (b.details as any)?.deliveryApprovalStatus === 'approved' && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                          <div className="flex items-center gap-2 mb-3">
                            <Check size={18} className="text-green-600" />
                            <span className="font-bold text-green-700 dark:text-green-400">Delivery Approved</span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400 mb-3">Your delivery has been approved! Complete your payment to finalize the booking.</p>
                          <Button 
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => { setPendingDeliveryBookingId(b.id); setView('awaiting-approval'); }}
                            data-testid={`button-proceed-payment-${b.id}`}
                          >
                            Proceed to Payment
                          </Button>
                        </div>
                      )}
                      
                      {(b.status === 'Active' || b.status === 'Extended') ? (
                        <div className="mt-6 p-4 bg-zinc-50 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <div className="flex justify-between items-center mb-4"><h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Rental Workflow</h4></div>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Button variant={b.checkInStatus === 'completed' ? "verified" : "primary"} className="w-full text-xs h-10 flex items-center justify-center gap-2" disabled={b.checkInStatus === 'completed'} onClick={() => handleStartWorkflow(b, 'checkin')} data-testid={`button-checkin-${b.id}`}>
                                {b.checkInStatus === 'completed' ? <><Check size={14}/> Check-in Verified</> : <><span className="text-red-200 font-bold mr-1">*Required</span> Check In</>}
                              </Button>
                            </div>
                            <div className="flex-1">
                              <Button variant="orange" className={`w-full text-xs h-10 flex items-center justify-center gap-2 ${b.checkInStatus === 'completed' ? '' : 'opacity-50 cursor-not-allowed'}`} disabled={b.checkInStatus !== 'completed'} onClick={() => handleStartWorkflow(b, 'checkout')} data-testid={`button-checkout-${b.id}`}>End Trip</Button>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                            {!extendingBookingId && (<button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors" onClick={() => initExtension(b)} data-testid={`button-extend-${b.id}`}>Modify Return Date</button>)}
                            {extendingBookingId === b.id && (() => {
                              const today = new Date();
                              const minDateStr = today.toISOString().split('T')[0];
                              const isReduction = extensionDate < b.returnDate;
                              
                              // Calculate extension details
                              const oldTimeStr = b.returnTime || "10:00 AM";
                              const oldDateTimeStr = `${b.returnDate}T${convertTo24Hour(oldTimeStr)}:00`;
                              const newDateTimeStr = `${extensionDate}T${convertTo24Hour(extensionTime)}:00`;
                              const oldReturn = new Date(oldDateTimeStr);
                              const newReturn = new Date(newDateTimeStr);
                              const diffTime = newReturn.getTime() - oldReturn.getTime();
                              const diffHours = diffTime / (1000 * 60 * 60);
                              const extendedDays = Math.ceil(diffHours / 24);
                              
                              // Calculate costs
                              const baseRate = b.details.rate || 0;
                              const currentExtended = b.details.extendedRate || 0;
                              const currentDays = b.days || 1;
                              const dailyRate = (baseRate + currentExtended) / currentDays;
                              
                              return (
                              <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">New Return Date & Time</label>
                                <p className="text-xs text-zinc-500">Extend or reduce your booking. Reductions require admin approval.</p>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Calendar size={18} className="text-green-600 mr-2" /><input type="date" className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionDate} min={minDateStr} onChange={(e) => setExtensionDate(e.target.value)} data-testid="input-extension-date" /></div>
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Clock size={18} className="text-green-600 mr-2" /><select className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionTime} onChange={(e) => setExtensionTime(e.target.value)} data-testid="select-extension-time">{timeOptions.map(t => <option key={t} value={t} className="text-black">{t}</option>)}</select></div>
                                  
                                  {/* Extension Cost Breakdown */}
                                  {!isReduction && diffTime > 30 * 60 * 1000 && (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 space-y-2">
                                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Extension Breakdown</h4>
                                      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                        <span>Original Booking Amount</span>
                                        <span className="font-bold text-zinc-900 dark:text-white">${b.total.toFixed(2)}</span>
                                      </div>
                                      {extendedDays > 0 && (
                                        <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                          <span>Extended Days</span>
                                          <span className="font-bold text-zinc-900 dark:text-white">{extendedDays} days × ${dailyRate.toFixed(2)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {isReduction && (
                                    <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-3">
                                      <p className="text-xs text-orange-400 mb-2"><AlertCircle size={12} className="inline mr-1"/> This is a reduction and requires admin approval</p>
                                      <input 
                                        type="text" 
                                        placeholder="Reason for reduction (optional)" 
                                        value={extensionRequestReason}
                                        onChange={(e) => setExtensionRequestReason(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
                                        data-testid="input-reduction-reason"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-2 mt-2">
                                    {b.paymentRaw?.type === 'paypal' && !isReduction && (
                                      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-2">
                                        <p className="text-xs text-blue-400 flex items-center gap-2"><Wallet size={14}/> Extension will be charged when End Trip</p>
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button className={`flex-1 py-2 px-4 ${isReduction ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs font-bold rounded-lg transition-colors`} onClick={() => confirmExtension(b)} data-testid="button-confirm-extension">{isReduction ? 'Submit Reduction Request' : 'Confirm Extension'}</button>
                                      <Button variant="ghost" className="flex-1 text-xs" onClick={() => { setExtendingBookingId(null); setExtensionRequestReason(''); }}>Cancel</Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );})()}
                          </div>
                          
                          {/* Pending Requests Status */}
                          {(b.extensionRequests || []).filter(r => r.status === 'pending').length > 0 && (
                            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
                                <AlertCircle size={16}/>
                                <span className="font-bold">Pending Requests</span>
                              </div>
                              <div className="mt-2 space-y-2">
                                {(b.extensionRequests || []).filter(r => r.status === 'pending').map(req => (
                                  <div key={req.id} className="text-xs text-yellow-600 dark:text-yellow-500">
                                    {req.type === 'extension' ? 'Extension' : 'Reduction'} to {req.requestedReturnDate} - Awaiting approval
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Client Chat Section */}
                          <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <MessageCircle size={14}/> Support Chat
                              {getUnreadMessagesCount(b, 'client') > 0 && (
                                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{getUnreadMessagesCount(b, 'client')} new</span>
                              )}
                            </h5>
                            <div className="max-h-32 overflow-y-auto space-y-2 mb-3" onClick={() => markMessagesAsRead(b.id, 'client')}>
                              {(b.messages || []).length === 0 ? (
                                <div className="text-xs text-zinc-500 text-center py-2">Send a message to our support team</div>
                              ) : (
                                (b.messages || []).map(msg => (
                                  <div key={msg.id} className={`p-2 rounded text-xs ${msg.sender === 'client' ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500 ml-2' : 'bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500 mr-2'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className={`font-bold ${msg.sender === 'client' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>{msg.sender === 'client' ? 'You' : 'CarHop Support'}</span>
                                      <span className="text-zinc-400 text-[10px]">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-zinc-700 dark:text-zinc-300">{msg.text}</p>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm"
                                data-testid="input-client-message"
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(b.id, 'client')}
                              />
                              <button 
                                onClick={() => sendChatMessage(b.id, 'client')}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                data-testid="button-send-client-message"
                              >
                                <Send size={14}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {b.status === 'Completed' && (
                        <div className="mt-6 p-4 bg-zinc-50 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <div className="flex justify-between items-center mb-3"><h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Rental Summary</h4><button onClick={() => setViewingReceiptBookingId(b.id)} className="text-xs text-green-600 hover:text-green-400 font-bold" data-testid={`button-view-completed-${b.id}`}>View Receipt</button></div>
                          {(() => {
                            const existingRating = ratingsData.find(r => r.bookingId === b.id);
                            const vehicle = vehicles.find(v => v.id === b.vehicleId);
                            if (existingRating) {
                              return (
                                <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-zinc-500">Your Rating:</span>
                                    <div className="flex gap-0.5">
                                      {[1,2,3,4,5].map(star => (
                                        <span key={star} className={star <= existingRating.stars ? 'text-yellow-400' : 'text-zinc-400'}>★</span>
                                      ))}
                                    </div>
                                  </div>
                                  {existingRating.comment && <p className="text-xs text-zinc-600 dark:text-zinc-400 italic">"{existingRating.comment}"</p>}
                                  {existingRating.hostResponse && (
                                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                      <p className="text-xs text-blue-500 font-semibold">Host Response:</p>
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400 italic">"{existingRating.hostResponse}"</p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <button
                                onClick={() => setRatingModal({
                                  bookingId: b.id,
                                  vehicleId: b.vehicleId || 0,
                                  hostId: vehicle?.hostId || null,
                                  clientName: b.driver.name,
                                  clientEmail: b.driver.email
                                })}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                                data-testid={`button-rate-trip-${b.id}`}
                              >
                                <span className="text-lg">★</span> Rate Your Trip
                              </button>
                            );
                          })()}
                        </div>
                      )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                    </>
                    );
                  })()}
            </div>
            <Button variant="ghost" onClick={() => setView('home')} className="mt-8" data-testid="button-back-to-home"><ArrowLeft size={16}/> Back to Home</Button>
          </div>
        )}

        {deletingBookingId && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-sm mx-4 border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Delete Booking?</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Are you sure you want to delete this booking? This action cannot be undone and will permanently remove it from the database.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingBookingId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-delete">Cancel</button>
                <button onClick={() => handleDeleteBooking(deletingBookingId)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors" data-testid="button-confirm-delete">Delete</button>
              </div>
            </div>
          </div>
        )}

        {cancelingBookingId && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-sm mx-4 border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Cancel Booking?</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Are you sure you want to cancel this booking? The host will be notified, and you can start a new booking anytime.</p>
              <div className="flex gap-3">
                <button onClick={() => setCancelingBookingId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-confirmation">No, Keep It</button>
                <button onClick={async () => {
                  if (!cancelingBookingId) return;
                  try {
                    const response = await fetch(`/api/bookings/${cancelingBookingId}/cancel`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                    });
                    if (response.ok) {
                      setCancelingBookingId(null);
                      setPendingDeliveryBookingId(null);
                      setView('home');
                      toast({ description: 'Booking cancelled successfully. Host has been notified.' });
                      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
                    } else {
                      toast({ description: 'Failed to cancel booking', variant: 'destructive' });
                    }
                  } catch (err) {
                    alert('Error cancelling booking');
                  }
                }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors" data-testid="button-confirm-cancel">Yes, Cancel It</button>
              </div>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {ratingModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Rate Your Trip</h2>
                <p className="text-sm text-zinc-500">How was your experience?</p>
              </div>
              
              <div className="flex justify-center gap-2 mb-6">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingStars(star)}
                    className={`text-4xl transition-transform hover:scale-110 ${star <= ratingStars ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}
                    data-testid={`button-star-${star}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Comment (optional)</label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Tell us about your experience..."
                  rows={3}
                  className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white resize-none focus:ring-2 focus:ring-yellow-500 outline-none"
                  data-testid="textarea-rating-comment"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setRatingModal(null); setRatingStars(5); setRatingComment(''); }}
                  className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  data-testid="button-cancel-rating"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createRatingMutation.mutate({
                    bookingId: ratingModal.bookingId,
                    vehicleId: ratingModal.vehicleId,
                    clientName: ratingModal.clientName,
                    clientEmail: ratingModal.clientEmail,
                    hostId: ratingModal.hostId,
                    stars: ratingStars,
                    comment: ratingComment
                  })}
                  disabled={createRatingMutation.isPending}
                  className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition-colors disabled:opacity-50"
                  data-testid="button-submit-rating"
                >
                  {createRatingMutation.isPending ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Ratings Modal */}
        {viewingVehicleRatings && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Customer Reviews</h2>
                <button onClick={() => setViewingVehicleRatings(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20}/></button>
              </div>
              
              {(() => {
                const vehicleRatings = ratingsData.filter(r => r.vehicleId === viewingVehicleRatings);
                if (vehicleRatings.length === 0) {
                  return <p className="text-center text-zinc-500 py-8">No reviews yet for this vehicle.</p>;
                }
                return (
                  <div className="space-y-4">
                    {vehicleRatings.map((rating: any) => (
                      <div key={rating.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{rating.clientName}</p>
                            <p className="text-xs text-zinc-500">{new Date(rating.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={`text-sm ${star <= rating.stars ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}>★</span>
                            ))}
                          </div>
                        </div>
                        {rating.comment && <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">"{rating.comment}"</p>}
                        {rating.hostResponse && (
                          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Host Response:</p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">"{rating.hostResponse}"</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Client Ratings Modal - Shows ratings given by hosts to a specific client */}
        {viewingClientRatings && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Client Ratings from Hosts</h2>
                <button onClick={() => setViewingClientRatings(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white" data-testid="button-close-client-ratings"><X size={20}/></button>
              </div>
              
              {(() => {
                const clientRatings = ratingsData.filter(r => r.clientEmail === viewingClientRatings && r.hostStarsToClient);
                if (clientRatings.length === 0) {
                  return <p className="text-center text-zinc-500 py-8">No ratings yet for this client.</p>;
                }
                return (
                  <div className="space-y-4">
                    {clientRatings.map((rating: any) => {
                      const vehicle = vehicles.find(v => v.id === rating.vehicleId);
                      const booking = bookings.find(b => b.id === rating.bookingId);
                      return (
                        <div key={rating.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-sm text-zinc-900 dark:text-white">{vehicle?.model || 'Vehicle'}</p>
                              <p className="text-xs text-zinc-500">{rating.hostRatedClientAt ? new Date(rating.hostRatedClientAt).toLocaleDateString() : 'Date unknown'}</p>
                              {booking && <p className="text-xs text-zinc-400">Trip: {booking.startDate} - {booking.returnDate}</p>}
                            </div>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(star => (
                                <span key={star} className={`text-sm ${star <= (rating.hostStarsToClient || 0) ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}>★</span>
                              ))}
                            </div>
                          </div>
                          {rating.hostCommentToClient && <p className="text-sm text-zinc-600 dark:text-zinc-400">"{rating.hostCommentToClient}"</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Host Response Modal */}
        {hostResponseModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Rate Trip & Respond</h2>
              
              {/* Host Rating to Client */}
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <label className="block text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-2">Rate This Client</label>
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setHostRatingStars(star)}
                      className={`text-2xl transition-colors ${star <= hostRatingStars ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}
                      data-testid={`button-host-rate-star-${star}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  value={hostRatingComment}
                  onChange={(e) => setHostRatingComment(e.target.value)}
                  placeholder="Comment about this client (optional)..."
                  rows={2}
                  className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white resize-none focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                  data-testid="textarea-host-rate-client"
                />
              </div>
              
              {/* Host Response to Client's Review */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Respond to Client's Review</label>
                <textarea
                  value={hostResponseText}
                  onChange={(e) => setHostResponseText(e.target.value)}
                  placeholder="Thank your customer or address their feedback..."
                  rows={3}
                  className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  data-testid="textarea-host-response"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setHostResponseModal(null); setHostResponseText(''); setHostRatingStars(5); setHostRatingComment(''); }}
                  className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  data-testid="button-cancel-host-response"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateRatingMutation.mutate({ 
                    id: hostResponseModal.ratingId, 
                    hostResponse: hostResponseText || undefined,
                    hostStarsToClient: hostRatingStars,
                    hostCommentToClient: hostRatingComment || undefined
                  })}
                  disabled={updateRatingMutation.isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                  data-testid="button-submit-host-response"
                >
                  {updateRatingMutation.isPending ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'checkout' && cart.car && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <button onClick={() => setView('home')} className="flex items-center gap-2 text-zinc-400 hover:text-green-500 mb-6 transition-colors" data-testid="button-back-from-checkout">
              <ArrowLeft size={18} /> Back to Fleet
            </button>
            
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left Column - Forms */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Car Method - ALL IN ONE BLOCK */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="flex items-center gap-2 text-green-500 font-semibold mb-6">
                    <MapPin size={18} /> Car Method
                  </h2>
                  
                  <div className="space-y-4">
                    {/* Delivery Type Selector */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer flex-1 p-4 border border-zinc-700 rounded-lg hover:border-green-500 transition-colors" style={{borderColor: selectedDeliveryType === 'delivery' ? '#22c55e' : undefined}}>
                          <input 
                            type="radio" 
                            name="deliveryType" 
                            value="delivery" 
                            checked={selectedDeliveryType === 'delivery'}
                            onChange={() => setSelectedDeliveryType('delivery')}
                            className="w-5 h-5 cursor-pointer"
                            data-testid="radio-delivery"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">Delivery to Your Address</p>
                            <p className="text-xs text-zinc-400">We'll bring the car to you</p>
                          </div>
                        </label>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer flex-1 p-4 border border-zinc-700 rounded-lg hover:border-green-500 transition-colors" style={{borderColor: selectedDeliveryType === 'pickup' ? '#22c55e' : undefined}}>
                          <input 
                            type="radio" 
                            name="deliveryType" 
                            value="pickup" 
                            checked={selectedDeliveryType === 'pickup'}
                            onChange={() => setSelectedDeliveryType('pickup')}
                            className="w-5 h-5 cursor-pointer"
                            data-testid="radio-pickup"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">Pickup at Our Location</p>
                            <p className="text-xs text-zinc-400">Pick up the car yourself</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Pickup Location Selection - REQUIRED FIRST for Delivery, optional for Pickup */}
                    {selectedDeliveryType === 'delivery' && (
                      <div className="pt-4 border-t border-zinc-700 space-y-3">
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider">STEP 1: SELECT PICKUP LOCATION *</label>
                        <p className="text-xs text-zinc-400 mb-2">Choose where to pick up the car - this is the starting point for delivery distance calculation</p>
                        {cart.car?.availableLocations && cart.car.availableLocations.length > 0 ? (
                          <div className="space-y-2">
                            {Array.from(new Set(cart.car.availableLocations)).map((location) => (
                              <label key={location} className="flex items-center gap-3 cursor-pointer p-3 border border-zinc-700 rounded-lg hover:border-green-500 hover:bg-zinc-800/50 transition-colors" style={{borderColor: pickupAddress === location ? '#22c55e' : undefined, backgroundColor: pickupAddress === location ? 'rgba(34, 197, 94, 0.1)' : undefined}}>
                                <input 
                                  type="checkbox" 
                                  name="pickupLocation" 
                                  value={location} 
                                  checked={pickupAddress === location}
                                  onChange={() => setPickupAddress(location)}
                                  className="w-5 h-5 cursor-pointer"
                                  data-testid={`checkbox-pickup-${location}`}
                                />
                                <span className="text-sm text-white flex-1">{formatAddressForDisplay(location)}</span>
                                {pickupAddress === location && <Check size={16} className="text-green-400 flex-shrink-0" />}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400">No pickup locations available</p>
                        )}
                      </div>
                    )}

                    {/* Delivery Address Section - Show only if Delivery is selected AND pickup location is chosen */}
                    {selectedDeliveryType === 'delivery' && pickupAddress && (
                      <div className="pt-4 border-t border-zinc-700 space-y-3">
                        <div>
                          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-3">STEP 2: ENTER YOUR DELIVERY ADDRESS *</label>
                          <p className="text-xs text-zinc-400 mb-3">We'll calculate the distance from {formatAddressForDisplay(pickupAddress)}</p>
                          <LocationAutocomplete 
                            value={deliveryAddressBooking}
                            onChange={(val, coords) => {
                              setDeliveryAddressBooking(val);
                              if (val && coords && pickupAddress && cart.car?.minDeliveryFee !== null && cart.car?.minDeliveryFee !== undefined && cart.car?.minDeliveryFeeMiles !== null && cart.car?.minDeliveryFeeMiles !== undefined) {
                                const deliveryLat = parseFloat(coords.lat);
                                const deliveryLon = parseFloat(coords.lon);
                                
                                // Geocodify pickup address to get its coordinates
                                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupAddress)}&countrycodes=us&limit=1`)
                                  .then(res => res.json())
                                  .then(data => {
                                    if (data && data.length > 0) {
                                      const pickupLat = parseFloat(data[0].lat);
                                      const pickupLon = parseFloat(data[0].lon);
                                      
                                      // Calculate Haversine distance
                                      const R = 3959; // Earth radius in miles
                                      const dLat = (deliveryLat - pickupLat) * Math.PI / 180;
                                      const dLon = (deliveryLon - pickupLon) * Math.PI / 180;
                                      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(pickupLat * Math.PI / 180) * Math.cos(deliveryLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                      const distanceInMiles = R * c;
                                      
                                      const minFee = cart.car?.minDeliveryFee || 15;
                                      const minMiles = cart.car?.minDeliveryFeeMiles || 5;
                                      const pricePerMile = cart.car?.deliveryPricePerMile || 0;
                                      let calculatedFee = 0;
                                      
                                      if (distanceInMiles <= minMiles) {
                                        calculatedFee = minFee;
                                      } else {
                                        const excessMiles = distanceInMiles - minMiles;
                                        calculatedFee = minFee + (excessMiles * pricePerMile);
                                      }
                                      
                                      if (distanceInMiles <= (cart.car?.maxDeliveryDistance || 50)) {
                                        setDeliveryFee(calculatedFee);
                                        setDeliveryValidationStatus('valid');
                                      } else {
                                        setDeliveryFee(0);
                                        setDeliveryValidationStatus('invalid');
                                      }
                                    }
                                  })
                                  .catch(err => {
                                    console.error('Error geocoding pickup address:', err);
                                    setDeliveryValidationStatus('invalid');
                                  });
                              }
                            }}
                            placeholder="Enter the address where you want the car delivered"
                          />
                        </div>

                        {deliveryAddressBooking && (
                          <div>
                            {deliveryValidationStatus === 'valid' ? (
                              <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <Check size={20} className="text-green-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-green-400 mb-2">Delivery Available</p>
                                    <p className="text-xs text-green-300 mb-3">{formatAddressForDisplay(deliveryAddressBooking)}</p>
                                    <div className="bg-green-900/50 rounded p-2">
                                      <p className="text-xs text-green-300">
                                        Delivery Fee: <span className="font-bold text-green-400">${deliveryFee.toFixed(2)}</span>
                                      </p>
                                      <p className="text-xs text-green-300 mt-1">
                                        ({cart.car?.minDeliveryFee && `$${cart.car.minDeliveryFee.toFixed(2)} up to ${cart.car.minDeliveryFeeMiles} miles, `}${cart.car?.deliveryPricePerMile && `$${cart.car.deliveryPricePerMile.toFixed(2)}/mile after`}, Max: {cart.car?.maxDeliveryDistance} miles)
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-red-400 mb-2">Delivery Not Available</p>
                                    <p className="text-xs text-red-300">Your address is beyond our maximum delivery distance ({cart.car?.maxDeliveryDistance} miles). Please choose a closer address or select Pickup instead.</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pickup Location Selection - Show when Pickup is selected (not Delivery) */}
                    {selectedDeliveryType === 'pickup' && (
                      <div className="pt-4 border-t border-zinc-700 space-y-3">
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider">SELECT YOUR PICKUP LOCATION *</label>
                        {cart.car?.availableLocations && cart.car.availableLocations.length > 0 ? (
                          <div className="space-y-2">
                            {Array.from(new Set(cart.car.availableLocations)).map((location) => (
                              <label key={location} className="flex items-center gap-3 cursor-pointer p-3 border border-zinc-700 rounded-lg hover:border-green-500 hover:bg-zinc-800/50 transition-colors" style={{borderColor: pickupAddress === location ? '#22c55e' : undefined, backgroundColor: pickupAddress === location ? 'rgba(34, 197, 94, 0.1)' : undefined}}>
                                <input 
                                  type="checkbox" 
                                  name="pickupLocation" 
                                  value={location} 
                                  checked={pickupAddress === location}
                                  onChange={() => setPickupAddress(location)}
                                  className="w-5 h-5 cursor-pointer"
                                  data-testid={`checkbox-pickup-${location}`}
                                />
                                <span className="text-sm text-white flex-1">{formatAddressForDisplay(location)}</span>
                                {pickupAddress === location && <Check size={16} className="text-green-400 flex-shrink-0" />}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400">No pickup locations available</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rental Period Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="flex items-center gap-2 text-green-500 font-semibold mb-6">
                    <Calendar size={18} /> Rental Period
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">PICKUP</label>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2 cursor-pointer">
                        <Calendar size={16} className="text-black dark:text-white" />
                        <input 
                          type="date" 
                          value={searchParams.start} 
                          onChange={e => handleSearchParamsChange('start', e.target.value)} 
                          min={getTodayString()} 
                          className="bg-transparent w-full outline-none text-sm text-white cursor-pointer" 
                          data-testid="input-checkout-start-date" 
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                        <Clock size={16} className="text-zinc-500" />
                        <select
                          value={searchParams.startTime}
                          onChange={e => handleSearchParamsChange('startTime', e.target.value)}
                          className="bg-transparent w-full outline-none text-sm text-white"
                          data-testid="select-checkout-start-time"
                        >
                          {timeOptions.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                        </select>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">Auto-set to current time + 30 min</p>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">RETURN</label>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2 cursor-pointer">
                        <Calendar size={16} className="text-black dark:text-white" />
                        <input 
                          type="date" 
                          value={searchParams.end} 
                          onChange={e => handleSearchParamsChange('end', e.target.value)} 
                          min={searchParams.start} 
                          className="bg-transparent w-full outline-none text-sm text-white cursor-pointer" 
                          data-testid="input-checkout-end-date" 
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                        <Clock size={16} className="text-zinc-500" />
                        <select 
                          value={searchParams.endTime} 
                          onChange={e => handleSearchParamsChange('endTime', e.target.value)} 
                          className="bg-transparent w-full outline-none text-sm text-white"
                          data-testid="select-checkout-end-time"
                        >
                          {timeOptions.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mt-4">Duration: <span className="text-green-500 font-semibold">{cart.billingDays} Days Charged</span></p>
                </div>

                {/* Protection Plan Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="flex items-center gap-2 text-green-500 font-semibold mb-6">
                    <Shield size={18} /> Protection Plan (Daily)
                  </h2>
                  <div className="space-y-3">
                    <div 
                      onClick={() => setCart({...cart, insuranceOption: '500'})} 
                      className={`p-4 rounded-lg cursor-pointer transition-all ${cart.insuranceOption === '500' ? 'bg-zinc-800 border-2 border-green-500' : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'}`}
                      data-testid="option-protection-standard"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white flex items-center gap-2 mb-1">
                            Standard Protection 
                            {cart.insuranceOption === '500' && <Check size={16} className="text-green-500" />}
                          </h4>
                          <p className="text-xs text-zinc-400 mb-2">Covers damage to host's vehicle.</p>
                          <p className="text-xs text-zinc-500">$500 Deductible</p>
                        </div>
                        <span className="font-bold text-white whitespace-nowrap">+${settings.prices.insurance500}/day</span>
                      </div>
                    </div>
                    <div 
                      onClick={() => setCart({...cart, insuranceOption: '1000'})} 
                      className={`p-4 rounded-lg cursor-pointer transition-all ${cart.insuranceOption === '1000' ? 'bg-zinc-800 border-2 border-green-500' : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'}`}
                      data-testid="option-protection-gold"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white flex items-center gap-2 mb-1">
                            Gold Protection 
                            {cart.insuranceOption === '1000' && <Check size={16} className="text-green-500" />}
                          </h4>
                          <p className="text-xs text-zinc-400 mb-2">Covers damage to host's vehicle, third party vehicles + bodily injuries and propriety damage.</p>
                          <p className="text-xs text-zinc-500">$1,000 Deductible</p>
                        </div>
                        <span className="font-bold text-white whitespace-nowrap">+${settings.prices.insurance1000}/day</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extras Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="flex items-center gap-2 text-green-500 font-semibold mb-6">
                    <Plus size={18} /> Extras
                  </h2>
                  <div 
                    onClick={() => toggleExtra('childSeat')} 
                    className={`p-4 rounded-lg cursor-pointer transition-all flex justify-between items-center ${cart.extrasSelected.includes('childSeat') ? 'bg-zinc-800 border-2 border-green-500' : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'}`}
                    data-testid="option-child-seat"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${cart.extrasSelected.includes('childSeat') ? 'bg-green-500 border-green-500' : 'border-zinc-500'}`}>
                        {cart.extrasSelected.includes('childSeat') && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-white">Child Safety Seat</span>
                    </div>
                    <span className="font-bold text-white">+${settings.prices.childSeat}</span>
                  </div>
                </div>

                {/* Driver Details Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="flex items-center gap-2 text-zinc-300 font-semibold mb-6">
                    <User size={18} /> Driver Details
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">FULL NAME *</label>
                      <input 
                        type="text"
                        value={driverDetails.name} 
                        onChange={(e: any) => setDriverDetails({...driverDetails, name: e.target.value})} 
                        placeholder="Google User"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-driver-name" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">EMAIL *</label>
                      <input 
                        type="email"
                        value={driverDetails.email} 
                        onChange={(e: any) => setDriverDetails({...driverDetails, email: e.target.value})} 
                        placeholder="user@gmail.com"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-driver-email" 
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">PHONE *</label>
                      <input 
                        type="tel"
                        value={driverDetails.phone} 
                        onChange={(e: any) => setDriverDetails({...driverDetails, phone: e.target.value})} 
                        placeholder="(555) 123-4567"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-driver-phone" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">DRIVER LICENSE NUMBER *</label>
                      <input 
                        type="text"
                        value={driverDetails.licenseNumber} 
                        onChange={(e: any) => setDriverDetails({...driverDetails, licenseNumber: e.target.value})} 
                        placeholder="CNH-12345678"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-driver-license" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-3">
                      DRIVER LICENSE PHOTOS (FRONT AND BACK) <span className="text-red-500">* REQUIRED</span>
                    </label>
                    <div className="flex gap-4 flex-wrap">
                      {driverDetails.licenseImages.map((img, i) => (
                        <div key={i} className="relative w-28 h-20 rounded-lg overflow-hidden border-2 border-green-500">
                          <img src={img} className="w-full h-full object-cover" alt={`License ${i + 1}`} />
                          <button 
                            onClick={() => deleteLicenseImage(i)} 
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                          >
                            <X size={10}/>
                          </button>
                        </div>
                      ))}
                      {driverDetails.licenseImages.length < 2 && (
                        <button 
                          onClick={triggerFileInput} 
                          className="w-28 h-20 border-2 border-dashed border-zinc-600 rounded-lg flex flex-col items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500 transition-all" 
                          data-testid="button-upload-license"
                        >
                          <Plus size={20}/>
                          <span className="text-[10px] mt-1">Add {driverDetails.licenseImages.length === 0 ? 'Front' : 'Back'}</span>
                        </button>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLicenseUpload} />
                    </div>
                  </div>

                  {driverDetails.licenseImages.length === 2 && (
                    <div className="mt-6 pt-6 border-t border-zinc-700 space-y-4">
                      <button 
                        onClick={() => {
                          setViewingCarRentalOnly(false);
                          setShowCarRentalModal(true);
                        }}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                        data-testid="button-read-agreement"
                      >
                        <FileText size={18} className="inline mr-2" />
                        Read Car Rental Agreement
                      </button>
                      <div className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-lg">
                        <input 
                          type="checkbox" 
                          checked={carRentalAgreementAccepted} 
                          onChange={(e) => {
                            setCarRentalAgreementAccepted(e.target.checked);
                            if (e.target.checked) {
                              setTimeout(() => proceedButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                            }
                          }}
                          className="mt-1 w-5 h-5 cursor-pointer" 
                          data-testid="checkbox-car-rental-agreement"
                        />
                        <div className="flex-1">
                          <label className="text-sm font-bold text-white cursor-pointer block">
                            I Accept the Car Rental Agreement <span className="text-red-500">* REQUIRED</span>
                          </label>
                          <p className="text-xs text-zinc-400 mt-1">You must read and accept our car rental agreement to proceed with payment</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Summary Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 sticky top-24">
                  {/* Car Image */}
                  <div className="rounded-lg overflow-hidden mb-4">
                    <img src={cart.car.images?.[0] || ''} className="w-full h-40 object-cover" alt={cart.car.model} />
                  </div>
                  
                  {/* Car Name */}
                  <h3 className="text-xl font-bold text-white mb-2">{cart.car.model}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.category}</span>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.fuel}</span>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.driveType || 'FWD'}</span>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.transmission}</span>
                  </div>

                  {/* Mileage Policy */}
                  <div className="bg-zinc-800 rounded-lg p-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Route size={16} className="text-green-500" />
                      <span className="text-zinc-300 font-medium">Mileage Policy</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-6">{cart.car.pricing?.includedMiles || settings.includedMiles} miles/day included</p>
                    <p className="text-xs text-zinc-500 ml-6">Excess: ${(cart.car.pricing?.extraMileRate || settings.extraMileRate).toFixed(2)}/mile</p>
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-3 text-sm border-t border-zinc-800 pt-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Rate ({cart.billingDays} days)</span>
                      <span className="text-white">${(cart.billingDays * cart.car.price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white">Protection</span>
                      <span className="text-white">+${((cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * cart.billingDays).toFixed(2)}</span>
                    </div>
                    {cart.extrasSelected.includes('childSeat') && (
                      <div className="flex justify-between">
                        <span className="text-green-500">Child Seat</span>
                        <span className="text-green-500">+${settings.prices.childSeat.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Cleaning Fee</span>
                      <span className="text-white">${(cart.car.pricing?.cleaningFee || settings.cleaningFee).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Taxes ({(cart.car.pricing?.taxes || settings.taxes)}%)</span>
                      <span className="text-white">${calculateTotal().taxAmount.toFixed(2)}</span>
                    </div>
                    {deliveryValidationStatus === 'valid' && deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-400">Delivery Fee</span>
                        <span className="text-green-400">+${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-800">
                    <span className="font-bold text-zinc-400">TOTAL</span>
                    <span className="text-3xl font-bold text-green-500" data-testid="text-checkout-total">${calculateTotal().total.toFixed(2)}</span>
                  </div>

                  {/* Proceed Button */}
                  <button 
                    ref={proceedButtonRef}
                    onClick={handleProceedToPayment} 
                    disabled={!isCheckoutValid() || !carRentalAgreementAccepted} 
                    className={`w-full mt-6 py-4 rounded-lg font-bold text-sm transition-all ${isCheckoutValid() && carRentalAgreementAccepted ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}
                    data-testid="button-proceed-payment"
                  >
                    {selectedDeliveryType === 'delivery' && deliveryValidationStatus === 'valid' ? 'Proceed' : 'Proceed to Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'payment' && cart.car && (() => {
          const isCreditCardValid = paymentDetails.cardName && paymentDetails.cardNumber && paymentDetails.expiry && paymentDetails.cvc;
          const isPayButtonEnabled = paymentMethod === 'paypal' || (paymentMethod === 'credit' && isCreditCardValid);
          
          return (
          <div className="max-w-3xl mx-auto px-6 py-12">
            {/* Back to Details Button - Above everything */}
            <button 
              onClick={() => setView('checkout')} 
              className="flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
              data-testid="button-back-to-details"
            >
              <ArrowLeft size={18} /> Back to Details
            </button>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-white">Payment Method</h2>
              
              {/* Payment Method Tabs */}
              <div className="flex mb-8 border-b border-zinc-700">
                <button 
                  onClick={() => setPaymentMethod('credit')}
                  className={`flex-1 py-4 text-center font-semibold transition-all ${paymentMethod === 'credit' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  data-testid="tab-credit-card"
                >
                  <CreditCard size={20} className="inline mr-2" />
                  Credit Card
                </button>
                <button 
                  onClick={() => setPaymentMethod('paypal')}
                  className={`flex-1 py-4 text-center font-semibold transition-all ${paymentMethod === 'paypal' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  data-testid="tab-paypal"
                >
                  <Wallet size={20} className="inline mr-2" />
                  PayPal
                </button>
              </div>

              {/* Credit Card Form */}
              {paymentMethod === 'credit' && (
                <div className="space-y-4">
                  {/* Card Number with Auto-detected Brand */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider">CARD NUMBER</label>
                      {detectCardType(paymentDetails.cardNumber) && (
                        <div className="text-xs font-bold uppercase text-green-400 bg-green-900/20 px-3 py-1 rounded-lg border border-green-700">
                          {detectCardType(paymentDetails.cardNumber)}
                        </div>
                      )}
                    </div>
                    <input 
                      type="text"
                      value={paymentDetails.cardNumber} 
                      onChange={(e: any) => {
                        const num = e.target.value;
                        const detectedType = detectCardType(num);
                        setPaymentDetails({...paymentDetails, cardNumber: num, type: detectedType || paymentDetails.type})} 
                      } 
                      placeholder="4242 4242 4242 4242"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                      data-testid="input-card-number" 
                    />
                  </div>

                  {/* Name + Expiry/CVC in responsive grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">NAME ON CARD</label>
                      <input 
                        type="text"
                        value={paymentDetails.cardName} 
                        onChange={(e: any) => setPaymentDetails({...paymentDetails, cardName: e.target.value})} 
                        placeholder="JOHN DOE"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-card-name" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">EXPIRY (MM/YY)</label>
                      <input 
                        type="text"
                        value={paymentDetails.expiry} 
                        onChange={handleExpiryChange} 
                        placeholder="MM/YY"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-card-expiry" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CVC</label>
                      <input 
                        type="text"
                        value={paymentDetails.cvc} 
                        onChange={(e: any) => setPaymentDetails({...paymentDetails, cvc: e.target.value})} 
                        placeholder="123"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                        data-testid="input-card-cvc" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PayPal Form */}
              {paymentMethod === 'paypal' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wallet size={36} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Pay with PayPal</h3>
                  <p className="text-zinc-400 mb-6">You will be redirected to PayPal to complete your payment securely.</p>
                  <div className="bg-zinc-800 rounded-lg p-4 text-left max-w-sm mx-auto">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400">Amount:</span>
                      <span className="text-white font-bold">${calculateTotal().total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Vehicle:</span>
                      <span className="text-white">{cart.car.model}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Total and Pay Button */}
              <div className="mt-8 pt-6 border-t border-zinc-700">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-zinc-400 text-lg">Total to Pay</span>
                  <span className="text-4xl font-bold text-green-500">${calculateTotal().total.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handleConfirmBooking} 
                  disabled={isProcessingPayment || !isPayButtonEnabled}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                    isProcessingPayment 
                      ? 'bg-zinc-700 text-zinc-400 cursor-wait' 
                      : isPayButtonEnabled 
                        ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                  data-testid="button-confirm-booking"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      {paymentMethod === 'credit' ? <CreditCard size={20} /> : <Wallet size={20} />}
                      {paymentMethod === 'credit' ? 'Pay with Card' : 'Pay with PayPal'}
                    </>
                  )}
                </button>
                {paymentMethod === 'credit' && !isCreditCardValid && (
                  <p className="text-center text-zinc-500 text-sm mt-3">Please fill all card details to continue</p>
                )}
              </div>
            </div>
          </div>
        );})()}

        {view === 'awaiting-approval' && pendingDeliveryBookingId && (() => {
          const pendingBooking = bookings.find(b => b.id === pendingDeliveryBookingId);
          if (!pendingBooking) return null;
          
          const approvalStatus = (pendingBooking.details as any)?.deliveryApprovalStatus;
          const deliveryFeeAmount = (pendingBooking.details as any)?.deliveryFee || 0;
          const originalPickupAddress = (pendingBooking.details as any)?.pickupAddress || '';
          
          // Use vehicle pricing tax rate (e.g., 8.5% = 0.085)
          const vehicleForTax = vehicles.find(v => v.id === pendingBooking.vehicleId);
          const taxRate = (vehicleForTax?.pricing?.taxes || settings.taxes || 0) / 100;
          
          // Calculate subtotal and tax based on approval status
          const rate = pendingBooking.details?.rate || 0;
          const protection = pendingBooking.details?.protection || 0;
          const extras = pendingBooking.details?.extras || 0;
          const cleaningFee = pendingBooking.details?.fees || 0;
          const deliveryFee = approvalStatus === 'pending' || approvalStatus === 'approved' ? deliveryFeeAmount : 0;
          const subtotal = rate + protection + extras + cleaningFee + deliveryFee;
          const calculatedTax = subtotal * taxRate;
          
          // For rejected delivery, recalculate without delivery fee
          const subtotalWithoutDelivery = rate + protection + extras + cleaningFee;
          const taxWithoutDelivery = subtotalWithoutDelivery * taxRate;
          
          const adjustedTotal = approvalStatus === 'rejected' 
            ? subtotalWithoutDelivery + taxWithoutDelivery
            : subtotal + calculatedTax;
          const adjustedTax = approvalStatus === 'rejected'
            ? taxWithoutDelivery
            : calculatedTax;
          
          return (
            <div className="max-w-lg mx-auto px-6 py-12">
              <Card className="p-8">
                {/* Status Header */}
                <div className="text-center mb-8">
                  {approvalStatus === 'pending' && (
                    <>
                      <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock size={40} className="text-yellow-500 animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Awaiting Delivery Approval</h2>
                      <p className="text-zinc-500">Your delivery request is being reviewed by the host. You'll be notified once it's approved or if pickup is required.</p>
                    </>
                  )}
                  
                  {approvalStatus === 'approved' && (
                    <>
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={40} className="text-green-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-green-500 mb-2">Delivery Approved!</h2>
                      <p className="text-zinc-500">Great news! Your delivery request has been approved. Complete your payment to confirm the booking.</p>
                    </>
                  )}
                  
                  {approvalStatus === 'rejected' && (
                    <>
                      <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin size={40} className="text-orange-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-orange-500 mb-2">Pickup Only Available</h2>
                      <p className="text-zinc-500 mb-4">Delivery was not available at this time. You can pick up the vehicle at the location below.</p>
                      {originalPickupAddress && (
                        <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <p className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Pickup Location:</p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{formatAddressForDisplay(originalPickupAddress)}</p>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(originalPickupAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <MapPin size={16} />
                            View on Google Maps
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {/* Booking Summary */}
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Price Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      const rate = pendingBooking.details?.rate || 0;
                      const protection = pendingBooking.details?.protection || 0;
                      const extras = pendingBooking.details?.extras || 0;
                      const cleaningFee = pendingBooking.details?.fees || 0;
                      const deliveryFee = approvalStatus === 'pending' || approvalStatus === 'approved' ? deliveryFeeAmount : 0;
                      const subtotal = rate + protection + extras + cleaningFee + deliveryFee;
                      
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-400">Vehicle</span>
                            <span className="text-zinc-900 dark:text-white">{pendingBooking.carName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-400">Dates</span>
                            <span className="text-zinc-900 dark:text-white">{pendingBooking.startDate} - {pendingBooking.returnDate}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-zinc-300 dark:border-zinc-600">
                            <span className="text-zinc-600 dark:text-zinc-400">Rental Rate ({pendingBooking.days} days)</span>
                            <span className="text-zinc-900 dark:text-white">${rate.toFixed(2)}</span>
                          </div>
                          {protection > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 dark:text-zinc-400">Protection - {pendingBooking.details?.protectionType || 'Standard'}</span>
                              <span className="text-zinc-900 dark:text-white">+${protection.toFixed(2)}</span>
                            </div>
                          )}
                          {extras > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 dark:text-zinc-400">Extras</span>
                              <span className="text-green-600 dark:text-green-400">+${extras.toFixed(2)}</span>
                            </div>
                          )}
                          {cleaningFee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 dark:text-zinc-400">Cleaning Fee</span>
                              <span className="text-zinc-900 dark:text-white">+${cleaningFee.toFixed(2)}</span>
                            </div>
                          )}
                          {deliveryFee > 0 && (
                            <div className="flex justify-between text-blue-600 dark:text-blue-400">
                              <span>Delivery Fee Service</span>
                              <span>+${deliveryFee.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-zinc-600 dark:text-zinc-400 border-t border-zinc-300 dark:border-zinc-600 pt-2">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                          </div>
                          {adjustedTax > 0 && (
                            <div className="flex justify-between text-purple-600 dark:text-purple-400">
                              <span>Tax</span>
                              <span>+${adjustedTax.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-zinc-300 dark:border-zinc-600 font-bold">
                            <span className="text-zinc-900 dark:text-white">Initial Payment</span>
                            <span className="text-green-600 dark:text-green-400">${adjustedTotal.toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Action Buttons */}
                {approvalStatus === 'pending' && (
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => { setPendingDeliveryBookingId(null); setView('bookings'); }}
                    >
                      <Briefcase size={18} className="mr-2" />
                      Go to My Bookings
                    </Button>
                    <p className="text-xs text-center text-zinc-500">You can check your booking status in My Bookings anytime.</p>
                  </div>
                )}
                
                {(approvalStatus === 'approved' || approvalStatus === 'rejected') && (
                  <div className="space-y-3">
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        toast({ description: "Proceeding to payment..." });
                        setView('awaiting-payment');
                      }}
                      data-testid="button-proceed-to-payment-approved"
                    >
                      <CreditCard size={18} className="mr-2" />
                      Proceed to Payment - ${adjustedTotal.toFixed(2)}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => { setCancelingBookingId(pendingDeliveryBookingId); }}
                      data-testid="button-cancel-booking"
                    >
                      Cancel Booking
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          );
        })()}

        {view === 'awaiting-payment' && pendingDeliveryBookingId && (() => {
          const pendingBooking = bookings.find(b => b.id === pendingDeliveryBookingId);
          if (!pendingBooking) return null;
          
          const approvalStatus = (pendingBooking.details as any)?.deliveryApprovalStatus;
          const deliveryFeeAmount = (pendingBooking.details as any)?.deliveryFee || 0;
          
          // Use vehicle pricing tax rate (e.g., 8.5% = 0.085)
          const vehicleForTax = vehicles.find(v => v.id === pendingBooking.vehicleId);
          const taxRate = (vehicleForTax?.pricing?.taxes || settings.taxes || 0) / 100;
          
          // Recalculate subtotal and tax
          const rate = pendingBooking.details?.rate || 0;
          const protection = pendingBooking.details?.protection || 0;
          const extras = pendingBooking.details?.extras || 0;
          const cleaningFee = pendingBooking.details?.fees || 0;
          const deliveryFee = approvalStatus === 'pending' || approvalStatus === 'approved' ? deliveryFeeAmount : 0;
          const subtotal = rate + protection + extras + cleaningFee + deliveryFee;
          const calculatedTax = subtotal * taxRate;
          
          const subtotalWithoutDelivery = rate + protection + extras + cleaningFee;
          const taxWithoutDelivery = subtotalWithoutDelivery * taxRate;
          
          const adjustedTax = approvalStatus === 'rejected'
            ? taxWithoutDelivery
            : calculatedTax;
          
          const adjustedTotal = approvalStatus === 'rejected' 
            ? subtotalWithoutDelivery + taxWithoutDelivery
            : subtotal + calculatedTax;
          
          const isCreditCardValid = paymentDetails.cardName && paymentDetails.cardNumber && paymentDetails.expiry && paymentDetails.cvc;
          const isPayButtonEnabled = paymentMethod === 'paypal' || (paymentMethod === 'credit' && isCreditCardValid);
          
          const handleFinalPayment = async () => {
            if (paymentMethod === 'credit' && !isCreditCardValid) {
              alert("Please enter valid payment details.");
              return;
            }
            
            setIsProcessingPayment(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const paymentMethodDisplay = paymentMethod === 'paypal' 
              ? 'PayPal' 
              : `${paymentDetails.type.toUpperCase()} **** ${paymentDetails.cardNumber.slice(-4)}`;
            
            // Update the booking with payment info and status
            const updateData: any = {
              status: 'Active',
              total: adjustedTotal,
              paymentRaw: paymentMethod === 'paypal' ? { type: 'paypal' } : { cardName: paymentDetails.cardName, cardNumber: paymentDetails.cardNumber, expiry: paymentDetails.expiry, cvc: paymentDetails.cvc, type: paymentDetails.type },
              paymentMethod: paymentMethodDisplay,
            };
            
            // If rejected, apply discount
            if (approvalStatus === 'rejected' && deliveryFeeAmount > 0) {
              updateData.details = {
                ...pendingBooking.details,
                discount: deliveryFeeAmount,
                deliveryType: 'pickup'
              };
              updateData.location = (pendingBooking.details as any)?.pickupAddress || pendingBooking.location;
            }
            
            await updateBookingMutation.mutateAsync({ id: pendingDeliveryBookingId, data: updateData });
            
            setIsProcessingPayment(false);
            setPendingDeliveryBookingId(null);
            setPaymentDetails({ cardName: '', cardNumber: '', expiry: '', cvc: '', type: 'visa' });
            toast({ description: "Payment confirmed! Booking is now active." });
            setView('confirmation');
          };
          
          return (
            <div className="max-w-3xl mx-auto px-6 py-12">
              <button 
                onClick={() => setView('awaiting-approval')} 
                className="flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
              >
                <ArrowLeft size={18} /> Back
              </button>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                <h2 className="text-2xl font-bold mb-6 text-white">Complete Payment</h2>
                
                {approvalStatus === 'rejected' && (
                  <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mb-6">
                    <p className="text-orange-400 text-sm">Delivery fee has been removed. You will pick up the vehicle at the designated location.</p>
                  </div>
                )}
                
                {/* Booking Summary with Details */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-white mb-4">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Vehicle</span>
                      <span className="text-white font-semibold">{pendingBooking.carName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Dates</span>
                      <span className="text-white font-semibold">{pendingBooking.startDate} - {pendingBooking.returnDate}</span>
                    </div>
                    <div className="border-t border-zinc-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Base Rate</span>
                        <span className="text-white">${(pendingBooking.details?.rate || 0).toFixed(2)}</span>
                      </div>
                      {(pendingBooking.details as any)?.protection > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Protection Package</span>
                          <span className="text-white">${((pendingBooking.details as any)?.protection || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(pendingBooking.details as any)?.extras > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Extras</span>
                          <span className="text-white">${((pendingBooking.details as any)?.extras || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(pendingBooking.details as any)?.fees > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Cleaning Fee</span>
                          <span className="text-white">${((pendingBooking.details as any)?.fees || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {adjustedTax > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Tax</span>
                          <span className="text-white">${adjustedTax.toFixed(2)}</span>
                        </div>
                      )}
                      {approvalStatus === 'approved' && deliveryFeeAmount > 0 && (
                        <div className="flex justify-between text-green-400">
                          <span>Delivery Fee</span>
                          <span>+${deliveryFeeAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between pt-3 border-t border-zinc-600 font-bold text-base">
                      <span className="text-white">Total</span>
                      <span className="text-green-500">${adjustedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Payment Method Tabs */}
                <div className="flex mb-8 border-b border-zinc-700">
                  <button 
                    onClick={() => setPaymentMethod('credit')}
                    className={`flex-1 py-4 text-center font-semibold transition-all ${paymentMethod === 'credit' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <CreditCard size={20} className="inline mr-2" />
                    Credit Card
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('paypal')}
                    className={`flex-1 py-4 text-center font-semibold transition-all ${paymentMethod === 'paypal' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Wallet size={20} className="inline mr-2" />
                    PayPal
                  </button>
                </div>
                
                {/* Credit Card Form */}
                {paymentMethod === 'credit' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CARD NUMBER</label>
                      <input 
                        type="text" 
                        placeholder="1234 5678 9012 3456" 
                        value={paymentDetails.cardNumber} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                          setPaymentDetails({ ...paymentDetails, cardNumber: val, type: detectCardType(val) || 'visa' });
                        }}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white font-mono text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CARDHOLDER NAME</label>
                      <input 
                        type="text" 
                        placeholder="John Doe" 
                        value={paymentDetails.cardName} 
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, cardName: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">EXPIRY</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY" 
                          value={paymentDetails.expiry} 
                          onChange={handleExpiryChange}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CVC</label>
                        <input 
                          type="text" 
                          placeholder="123" 
                          value={paymentDetails.cvc} 
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {paymentMethod === 'paypal' && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 text-center">
                    <Wallet size={48} className="mx-auto text-blue-400 mb-4" />
                    <p className="text-blue-300">You will be redirected to PayPal to complete your payment.</p>
                  </div>
                )}
                
                {/* Total and Pay Button */}
                <div className="mt-8 pt-6 border-t border-zinc-700">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-zinc-400 font-bold">TOTAL</span>
                    <span className="text-3xl font-bold text-green-500">${adjustedTotal.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={handleFinalPayment}
                    disabled={isProcessingPayment || !isPayButtonEnabled}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                      isProcessingPayment 
                        ? 'bg-zinc-700 text-zinc-400 cursor-wait' 
                        : isPayButtonEnabled 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader size={20} className="animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        {paymentMethod === 'credit' ? <CreditCard size={20} /> : <Wallet size={20} />}
                        Pay ${adjustedTotal.toFixed(2)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {view === 'confirmation' && (
          <div className="max-w-md mx-auto text-center py-20 px-6">
            {/* Success Animation */}
            <div className="relative mb-8">
              <div className="w-28 h-28 bg-green-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <Check size={40} className="text-white" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-36 h-36 border-4 border-green-500/30 rounded-full animate-ping"></div>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold mb-4 text-white" data-testid="text-confirmation-title">Payment Confirmed!</h2>
            <p className="text-zinc-400 mb-10 text-lg">Your payment was processed successfully. Your booking is now confirmed.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setView('bookings')} 
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30" 
                data-testid="button-go-to-bookings"
              >
                <Briefcase size={20} />
                Go to My Bookings
              </button>
              <button 
                onClick={() => setView('home')} 
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 border border-zinc-700" 
                data-testid="button-back-home-confirm"
              >
                <ArrowLeft size={20} />
                Back to Home
              </button>
            </div>
          </div>
        )}

        {view === 'check-workflow' && activeBooking && (
          <div className="max-w-2xl mx-auto px-6 py-12">
            <Button variant="ghost" onClick={() => setView('bookings')} className="mb-8"><ArrowLeft size={20} /> Back to Bookings</Button>
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">{isCheckOutMode ? 'Vehicle Check-Out' : 'Vehicle Check-In'}</h2>
              <p className="text-zinc-500 mb-6">{activeBooking.carName} - {activeBooking.bookingCode}</p>
              <div className="space-y-6">
                {/* 1. Outside Photos - First */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Outside Photos <span className="text-red-500">* (min 1, max 15)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosOutside.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-green-500 group">
                        <img src={p} className="w-full h-full object-cover"/>
                        <button 
                          onClick={() => handleRemoveCheckPhoto('outside', i)} 
                          className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-outside-${i}`}
                        >
                          <X size={12}/>
                        </button>
                      </div>
                    ))}
                    {checkData.photosOutside.length < 15 && (
                      <button onClick={() => triggerCheckInput('outside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-outside">
                        <Camera size={20}/>
                      </button>
                    )}
                    <input id="check-input-outside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'outside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosOutside.length}/15 photos uploaded</p>
                </div>
                
                {/* 2. Inside Photos - Second */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Inside Photos <span className="text-red-500">* (min 1, max 15)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosInside.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-green-500 group">
                        <img src={p} className="w-full h-full object-cover"/>
                        <button 
                          onClick={() => handleRemoveCheckPhoto('inside', i)} 
                          className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-inside-${i}`}
                        >
                          <X size={12}/>
                        </button>
                      </div>
                    ))}
                    {checkData.photosInside.length < 15 && (
                      <button onClick={() => triggerCheckInput('inside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-inside">
                        <Camera size={20}/>
                      </button>
                    )}
                    <input id="check-input-inside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'inside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosInside.length}/15 photos uploaded</p>
                </div>
                
                {/* 3. Current Mileage - Third */}
                <Input label="Current Mileage" type="number" value={checkData.miles} onChange={(e: any) => setCheckData({...checkData, miles: e.target.value})} placeholder="e.g. 45000" required data-testid="input-check-miles" />
                
                {/* 4. Fuel Level - Fourth (Last) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Fuel Level</label>
                  <div className="flex gap-2">{['Full', '3/4', '1/2', '1/4', 'Empty'].map(level => (<button key={level} onClick={() => setCheckData({...checkData, gas: level})} className={`flex-1 py-2 rounded border text-sm font-bold ${checkData.gas === level ? 'bg-green-600 text-white border-green-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`} data-testid={`button-gas-${level}`}>{level}</button>))}</div>
                </div>
                
                {(() => {
                  const canComplete = checkData.photosOutside.length >= 1 && checkData.photosInside.length >= 1 && checkData.miles && checkData.gas;
                  
                  const calculateCheckoutCharges = () => {
                    if (!isCheckOutMode || !activeBooking?.checkInData) return { excessMileageFee: 0, refuelingFee: 0, totalDifference: 0, excessMiles: 0 };
                    
                    const checkInMiles = parseInt(activeBooking.checkInData?.miles || '0');
                    const checkOutMiles = parseInt(checkData.miles || '0');
                    const carPricing = vehicles.find(v => v.id === activeBooking.vehicleId)?.pricing;
                    const includedMilesPerDay = carPricing?.includedMiles || settings.includedMiles;
                    const extraMileRate = carPricing?.extraMileRate || settings.extraMileRate;
                    const allowedMiles = includedMilesPerDay * activeBooking.days;
                    const milesDriven = checkOutMiles - checkInMiles;
                    const excessMiles = Math.max(0, milesDriven - allowedMiles);
                    const excessMileageFee = excessMiles * extraMileRate;
                    
                    const gasInLevel = getGasValue(activeBooking.checkInData?.gas || 'Full');
                    const gasOutLevel = getGasValue(checkData.gas);
                    const gasDiff = Math.max(0, gasInLevel - gasOutLevel);
                    const refuelingFee = gasDiff * 10;
                    
                    return { excessMileageFee, refuelingFee, totalDifference: excessMileageFee + refuelingFee, excessMiles };
                  };
                  
                  const charges = calculateCheckoutCharges();
                  
                  // Calculate booking value (original without extensions)
                  const originalBookingValue = activeBooking ? activeBooking.total - (activeBooking.details?.extendedRate || 0) : 0;
                  const extendedAmount = activeBooking?.details?.extendedRate || 0;
                  const totalAmount = originalBookingValue + extendedAmount + charges.totalDifference;
                  const amountToPay = totalAmount - originalBookingValue;
                  
                  return (
                    <div className="space-y-3">
                      {isCheckOutMode && (
                        <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-4 space-y-3">
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-3">Check-Out Summary</h3>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-600 dark:text-zinc-400">Original Booking Amount</span>
                            <span className="text-zinc-900 dark:text-white font-medium">${originalBookingValue.toFixed(2)}</span>
                          </div>
                          
                          {/* Extended Days if any */}
                          {extendedAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600 dark:text-blue-400">Extended Days</span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium">+${extendedAmount.toFixed(2)}</span>
                            </div>
                          )}
                          
                          {charges.excessMileageFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-orange-600 dark:text-orange-400">Extra Miles Charged ({charges.excessMiles} miles)</span>
                              <span className="text-orange-600 dark:text-orange-400 font-medium">+${charges.excessMileageFee.toFixed(2)}</span>
                            </div>
                          )}
                          {charges.refuelingFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-orange-600 dark:text-orange-400">Fuel Level Charge</span>
                              <span className="text-orange-600 dark:text-orange-400 font-medium">+${charges.refuelingFee.toFixed(2)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between text-sm pt-2 border-t border-zinc-300 dark:border-zinc-600">
                            <span className="font-bold text-zinc-900 dark:text-white">Total</span>
                            <span className="font-bold text-zinc-900 dark:text-white">${totalAmount.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-lg text-zinc-900 dark:text-white">Amount to Pay Now</span>
                            <span className="font-bold text-lg text-green-600 dark:text-green-400">${amountToPay.toFixed(2)}</span>
                          </div>
                          
                          {charges.totalDifference > 0 && (
                            <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-300 dark:border-zinc-600">
                              The amount of ${amountToPay.toFixed(2)} will be charged to the same payment method used for the original booking.
                            </p>
                          )}
                        </div>
                      )}
                      <Button className={`w-full py-4 flex items-center justify-center gap-2 ${!canComplete ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canComplete} onClick={completeWorkflow} data-testid="button-complete-workflow">
                        {`Complete ${isCheckOutMode ? 'Check-Out' : 'Check-In'}`}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </Card>
          </div>
        )}

        {view === 'workflow-success' && (
          <div className="max-w-md mx-auto text-center py-20 px-6">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8"><Check size={48} /></div>
            <h2 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-white" data-testid="text-workflow-success">{isCheckOutMode ? 'Check-Out Complete!' : 'Check-In Complete!'}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">{isCheckOutMode ? 'Thank you for renting with CarHop. We hope to see you again!' : 'Your vehicle is ready. Have a great trip!'}</p>
            <Button onClick={() => setView('bookings')} className="w-full" data-testid="button-back-to-bookings">Back to My Bookings</Button>
          </div>
        )}

        {view === 'car-details' && viewCar && (() => {
          const bookingDays = calculateBillingDays(carDetailsBooking.startDate, carDetailsBooking.startTime, carDetailsBooking.endDate, carDetailsBooking.endTime);
          
          const getFeaturesList = () => {
            const features = [];
            if (viewCar.hasCarPlay) features.push('CarPlay');
            if (viewCar.hasBluetooth) features.push('Bluetooth');
            if (viewCar.hasReverseCamera) features.push('Reverse Camera');
            if (viewCar.hasHeatedSeats) features.push('Heated Seats');
            if (viewCar.hasHeatedSteering) features.push('Heated Steering');
            if (viewCar.hasElectricSeats) features.push('Electric Seats');
            if (viewCar.hasPaddleShifters) features.push('Paddle Shifters');
            if (viewCar.hasKeylessEntry) features.push('Keyless Entry');
            if (viewCar.hasBlindSpotWarning) features.push('Blind Spot Warning');
            if (viewCar.hasDriveAssist) features.push('Drive Assist');
            if (viewCar.hasUSBCharger) features.push('USB Charger');
            return features;
          };
          
          const features = getFeaturesList();
          
          return (
            <div className="max-w-5xl mx-auto px-6 py-12">
              <Button variant="ghost" onClick={() => setView('home')} className="mb-8"><ArrowLeft size={20} /> Back to Fleet</Button>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <ImageCarousel images={viewCar.images} />
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed mt-6" data-testid="text-car-description">{getVehicleDescription(viewCar.model, viewCar.category)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">{viewCar.category}</span>
                  <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2" data-testid="text-car-detail-name">{viewCar.model}</h1>
                  <div className="flex gap-4 text-sm text-zinc-500 mb-6 flex-wrap">
                    <span className="flex items-center gap-1"><Users size={16}/> {viewCar.seats} seats</span>
                    <span className="flex items-center gap-1"><Gauge size={16}/> {viewCar.consumption}</span>
                    <span className="flex items-center gap-1"><Zap size={16}/> {viewCar.transmission}</span>
                    {viewCar.isAWD && <span className="flex items-center gap-1"><Car size={16}/> AWD</span>}
                  </div>
                  
                  {/* Features - Without Icons */}
                  {features.length > 0 && (
                    <div className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-700">
                      <div className="flex flex-wrap gap-2">
                        {features.map((feature, idx) => (
                          <span key={idx} className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">{feature}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking Dates and Times */}
                  <div className="space-y-4 mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-3">Select Your Rental Dates</h3>
                    
                    {/* Date and Time Inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Pickup Date</label>
                        <input type="date" value={carDetailsBooking.startDate} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, startDate: e.target.value})} min={getTodayString()} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="input-cardetail-startdate" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Return Date</label>
                        <input type="date" value={carDetailsBooking.endDate} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, endDate: e.target.value})} min={carDetailsBooking.startDate} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="input-cardetail-enddate" />
                      </div>
                    </div>

                    {/* Time Selectors */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Pickup Time</label>
                        <select value={carDetailsBooking.startTime} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, startTime: e.target.value})} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="select-cardetail-starttime">
                          {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Return Time</label>
                        <select value={carDetailsBooking.endTime} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, endTime: e.target.value})} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="select-cardetail-endtime">
                          {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Mileage Info */}
                    <div className="border-t border-zinc-300 dark:border-zinc-600 pt-4 mt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">Included Miles per Day:</span>
                        <span className="font-bold text-zinc-900 dark:text-white">{viewCar.pricing?.includedMiles || settings.includedMiles} miles/day</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">Extra Mile Rate:</span>
                        <span className="font-bold text-zinc-900 dark:text-white">${(viewCar.pricing?.extraMileRate || settings.extraMileRate).toFixed(2)}/mile</span>
                      </div>
                      <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                        <span className="text-sm font-bold">Total Included Miles ({bookingDays} days):</span>
                        <span className="font-bold">{(viewCar.pricing?.includedMiles || settings.includedMiles) * bookingDays} miles</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                      <div><span className="text-zinc-500 text-xs sm:text-sm">Price for {bookingDays} day{bookingDays !== 1 ? 's' : ''}</span><div className="text-2xl sm:text-4xl font-bold text-green-600" data-testid="text-car-detail-price">${(viewCar.price * bookingDays).toFixed(2)}</div></div>
                      <Button onClick={() => { setSearchParams({location: '', start: carDetailsBooking.startDate, startTime: carDetailsBooking.startTime, end: carDetailsBooking.endDate, endTime: carDetailsBooking.endTime}); handleRent(viewCar); }} className="px-4 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm w-full sm:w-auto" data-testid="button-rent-detail">Book Now</Button>
                    </div>
                  </div>
                  {viewCar.isPriceMatch && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
                      <DollarSign className="text-green-600" size={24}/>
                      <div><h4 className="font-bold text-green-800 dark:text-green-400">Host and Rent For The Best Prices</h4><p className="text-xs text-green-600 dark:text-green-500">Find a lower price? We'll match it!</p></div>
                    </div>
                  )}
                </div>
              </div>
              <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16 pt-8 pb-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Copyright © All Rights Reserved 2025
              </footer>
            </div>
          );
        })()}
      </main>

      {/* Photo Lightbox Modal */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={closeLightbox} data-testid="modal-lightbox">
          <button onClick={closeLightbox} className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors z-10" data-testid="button-lightbox-close">
            <X size={32}/>
          </button>
          
          <div className="absolute top-4 left-4 text-white text-sm">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>
          
          <div className="relative max-w-4xl max-h-[80vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImages[lightboxIndex]} 
              alt={`Photo ${lightboxIndex + 1}`} 
              className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
              style={{ transform: `scale(${lightboxZoom})` }}
              onClick={toggleZoom}
              data-testid="img-lightbox"
            />
          </div>
          
          {lightboxImages.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); prevImage(); }} 
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                data-testid="button-lightbox-prev"
              >
                <ChevronLeft size={24}/>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); nextImage(); }} 
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                data-testid="button-lightbox-next"
              >
                <ChevronRight size={24}/>
              </button>
            </>
          )}
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleZoom(); }} 
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              data-testid="button-lightbox-zoom"
            >
              <ZoomIn size={16}/> {lightboxZoom === 1 ? 'Zoom In' : 'Zoom Out'}
            </button>
          </div>
        </div>
      )}

      {/* Rate your Guest Modal */}
      {showRateGuestModal && selectedBookingForRating && (() => {
        const b = bookings.find(bk => bk.id === selectedBookingForRating);
        if (!b || b.status !== 'Completed' || !b.driver) return null;
        return (
          <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Rate {b.driver.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">Trip {b.bookingCode}</p>
                </div>
                <button onClick={() => setShowRateGuestModal(false)} className="text-zinc-400 hover:text-white"><X size={20}/></button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-300 mb-3">Your Rating</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => setHostRatingStars(star)} className={`text-3xl transition-colors ${hostRatingStars >= star ? 'text-yellow-400' : 'text-zinc-600'}`} data-testid={`button-star-${star}`}>★</button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-zinc-300 mb-2">Comments</label>
                  <textarea value={hostRatingComment} onChange={(e) => setHostRatingComment(e.target.value)} placeholder="Share your experience..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 min-h-24 resize-none" data-testid="textarea-rate-comment"/>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button onClick={() => setShowRateGuestModal(false)} className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded-lg transition-colors" data-testid="button-cancel-rating">Cancel</button>
                  <button onClick={() => {
                    const rating = ratingsData?.find(r => r.bookingId === b.id);
                    if (rating) {
                      updateRatingMutation.mutate({ id: rating.id, hostStarsToClient: hostRatingStars, hostCommentToClient: hostRatingComment });
                      toast({ title: "Sucesso", description: `Você avaliou ${b.driver.name} com ${hostRatingStars} estrelas!` });
                    }
                    setShowRateGuestModal(false);
                    setSelectedBookingForRating(null);
                  }} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors" data-testid="button-submit-rating">Submit Rating</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}
