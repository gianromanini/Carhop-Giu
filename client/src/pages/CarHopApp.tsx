import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Car, Settings, Plus, Trash2, Check, Calendar, Leaf, DollarSign, ArrowLeft, Shield, Mountain, Smartphone, Gauge, Zap, Edit, X, Image, ChevronRight, ChevronLeft, Info, Search, MapPin, User, Menu, Users, Activity, Phone, Sun, Moon, Clock, LogOut, Map, Bluetooth, Camera, Route, Upload, Mail, FileText, Download, CreditCard, AlertTriangle, AlertCircle, CalendarClock, Lock, Fuel, Loader, Briefcase, List, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut, Move, Thermometer, Unlock, BatteryCharging, Armchair, Navigation, BarChart3, TrendingUp, Wallet, Receipt, MoreHorizontal, MessageCircle, Send, Bell, MoreVertical, Building2
} from 'lucide-react';
import type { Vehicle, Booking } from '@shared/schema';
type User = typeof import('@shared/schema').users.$inferSelect;
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

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
       <div className="absolute bottom-8 flex items-center gap-4 bg-zinc-900/80 backdrop-blur p-3 rounded-full border border-zinc-700 text-white">
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
      {checked && <Check size={14} className="text-white" />}
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
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-zinc-900/95 text-white text-[10px] p-3 rounded-lg shadow-xl z-20 w-36 backdrop-blur-sm border border-zinc-700">
                  <div className="font-bold text-sm border-b border-zinc-700 pb-1 mb-1 text-center">{label}</div>
                  <div className="flex justify-between"><span className="text-orange-400">Expenses:</span> <span>${expenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-green-400">Revenue:</span> <span>${gross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-purple-400">Pending:</span> <span>${pending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between font-bold border-t border-zinc-700 pt-1 mt-1"><span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>Net:</span> <span>${net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
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
                      {expPercent > 15 && <span className="text-[9px] font-bold text-white">${expenses > 999 ? `${(expenses/1000).toFixed(1)}k` : expenses.toFixed(0)}</span>}
                    </div>
                  )}
                  {/* Gross Revenue - Green (middle) */}
                  {grossPercent > 0 && (
                    <div 
                      className="w-full bg-green-500 flex items-center justify-center"
                      style={{ height: `${grossPercent}%` }}
                    >
                      {grossPercent > 15 && <span className="text-[9px] font-bold text-white">${gross > 999 ? `${(gross/1000).toFixed(1)}k` : gross.toFixed(0)}</span>}
                    </div>
                  )}
                  {/* Pending - Purple (top) */}
                  {pendingPercent > 0 && (
                    <div 
                      className="w-full bg-purple-500 flex items-center justify-center"
                      style={{ height: `${pendingPercent}%` }}
                    >
                      {pendingPercent > 15 && <span className="text-[9px] font-bold text-white">${pending > 999 ? `${(pending/1000).toFixed(1)}k` : pending.toFixed(0)}</span>}
                    </div>
                  )}
                </div>
                
                {/* Month label */}
                <span className="text-xs font-bold text-zinc-400 mt-2">{label}</span>
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

const initialFormState = { model: '', category: '', price: '', fuel: 'Gasoline', seats: 5, transmission: 'Automatic', driveType: 'AWD', images: [''], consumption: '', isPriceMatch: false, isAWD: false, hasCarPlay: false, hasBluetooth: false, hasReverseCamera: false, hasHeatedSeats: false, hasHeatedSteering: false, hasElectricSeats: false, hasPaddleShifters: false, hasKeylessEntry: false, hasBlindSpotWarning: false, hasDriveAssist: false, hasUSBCharger: false, commission: 10, deductible: 1000, availableLocations: [], pricing: {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}} };
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
  pricing: { taxes: number; cleaningFee: number; includedMiles: number; extraMileRate: number; prices: { insurance500: number; insurance1000: number; childSeat: number; childSeatPerTrip: boolean; prepaidFuel: number; prepaidFuelPerTrip: boolean; lateReturnGrace: number; lateReturnGracePerTrip: boolean; stressFreePackage: number; stressFreePackagePerTrip: boolean } };
}

export default function CarHopApp() {
  const queryClient = useQueryClient();
  const { user: authUser, isAuthenticated } = useAuth();
  const [view, setView] = useState('home');
  const [darkMode, setDarkMode] = useState(true);
  const [adminUnit, setAdminUnit] = useState('');
  const [adminTab, setAdminTab] = useState('fleet');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedHost, setSelectedHost] = useState<any>(null);
  const [selectedHostCarCommission, setSelectedHostCarCommission] = useState<any>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [expandedHostImage, setExpandedHostImage] = useState<string | null>(null);
  
  const [clientUser, setClientUser] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showHostRegisterModal, setShowHostRegisterModal] = useState(false);
  const [showHostLoginModal, setShowHostLoginModal] = useState(false);
  const [signupForm, setSignupForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [adminLoginForm, setAdminLoginForm] = useState({ unit: '', password: '' });
  const [hostLoginForm, setHostLoginForm] = useState({ username: '', password: '' });
  const [hostRegisterForm, setHostRegisterForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '',
    licenseNumber: '', licenseFrontImage: '', licenseBackImage: '', proofOfResidenceImage: '', username: '', password: '', confirmPassword: ''
  });
  const [hostRegisterMessage, setHostRegisterMessage] = useState('');
  const [showHostAgreementModal, setShowHostAgreementModal] = useState(false);
  const [hostAgreementAccepted, setHostAgreementAccepted] = useState(false);
  const [hostAgreementAcceptedAt, setHostAgreementAcceptedAt] = useState('');
  const [currentHost, setCurrentHost] = useState<any>(null);
  const [signupMessage, setSignupMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  const [searchParams, setSearchParams] = useState({ location: '', start: '', startTime: '10:00 AM', end: '', endTime: '10:00 AM' });
  const [isSearching, setIsSearching] = useState(false);

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
  const [selectedExpenseVehicleId, setSelectedExpenseVehicleId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState<{lease: number; insurance: number; carWash: number; maintenance: number; trackApp: number; downPayment: number}>({ lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
  
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [checkData, setCheckData] = useState(initialCheckState);
  const [isCheckOutMode, setIsCheckOutMode] = useState(false);
  const [viewingReceiptBookingId, setViewingReceiptBookingId] = useState<number | null>(null);

  const [adjustment, setAdjustment] = useState({ type: 'fixed', value: '' });
  const [extraCharge, setExtraCharge] = useState({ type: 'Refuel', amount: '' });
  const [extraPaymentAmount, setExtraPaymentAmount] = useState('');
  const [checkingOutByAdminBookingId, setCheckingOutByAdminBookingId] = useState<number | null>(null);

  const [newLocation, setNewLocation] = useState('');
  
  const [carRentalAgreementAccepted, setCarRentalAgreementAccepted] = useState(false);
  const [showCarRentalModal, setShowCarRentalModal] = useState(false);
  const [viewingCarRentalOnly, setViewingCarRentalOnly] = useState(false);
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [extensionRequestReason, setExtensionRequestReason] = useState('');
  const [bookingFilterType, setBookingFilterType] = useState<'end-soon' | 'start-first'>('end-soon');

  const [cart, setCart] = useState<{ car: Vehicle | null; days: number; billingDays: number; extrasSelected: string[]; insuranceOption: string }>({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' });
  const [viewCar, setViewCar] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<FormDataType>(initialFormState as FormDataType);
  const [pricingStrings, setPricingStrings] = useState<{taxes: string; extraMileRate: string; childSeat: string; prepaidFuel: string; lateReturnGrace: string; stressFreePackage: string; cleaningFee: string; includedMiles: string; insurance500: string; insurance1000: string}>({taxes: '8.5', extraMileRate: '0.45', childSeat: '8', prepaidFuel: '35', lateReturnGrace: '25', stressFreePackage: '50', cleaningFee: '25', includedMiles: '200', insurance500: '25', insurance1000: '15'});
  const [editingPricingStrings, setEditingPricingStrings] = useState<{taxes: string; extraMileRate: string; childSeat: string; prepaidFuel: string; lateReturnGrace: string; stressFreePackage: string; cleaningFee: string; includedMiles: string; insurance500: string; insurance1000: string}>({taxes: '8.5', extraMileRate: '0.45', childSeat: '8', prepaidFuel: '35', lateReturnGrace: '25', stressFreePackage: '50', cleaningFee: '25', includedMiles: '200', insurance500: '25', insurance1000: '15'});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adminEditingVehicleId, setAdminEditingVehicleId] = useState<number | null>(null);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);

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
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({ queryKey: ['/api/bookings'] });
  const { data: settingsData } = useQuery<SettingsType>({ queryKey: ['/api/settings'] });
  const { data: financialData } = useQuery<{ monthly: Record<string, any>; byVehicle: Record<string, { gross: number; pending: number; expenses: number }>; fixedMonthly: number }>({ queryKey: ['/api/financial/summary'] });
  const { data: hostsData = [] } = useQuery<any[]>({ queryKey: ['/api/hosts'] });
  const { data: usersData = [] } = useQuery<User[]>({ queryKey: ['/api/admin/users'] });
  const [hostTab, setHostTab] = useState('fleet');
  const [editingHost, setEditingHost] = useState<any>(null);
  const [editingHostVehicle, setEditingHostVehicle] = useState<Vehicle | null>(null);
  const [hostVehicleImages, setHostVehicleImages] = useState<string[]>([]);
  const [hostNewLocation, setHostNewLocation] = useState('');
  const [priceConfigForm, setPriceConfigForm] = useState<SettingsType | null>(null);
  const [carDetailsBooking, setCarDetailsBooking] = useState({ startDate: getTodayString(), startTime: getNext30MinSlot(), endDate: addDaysToDate(getTodayString(), 3), endTime: getNext30MinSlot() });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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
  const { toast } = useToast();

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
    }
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({ title: 'Vehicle deleted successfully' });
    }
  });

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
    mutationFn: (data: any) => apiRequest('POST', '/api/bookings', data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); 
      queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); 
      toast({ title: 'Booking created successfully' });
    }
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/bookings/${id}`, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); 
      queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); 
      toast({ title: 'Booking updated successfully' });
    }
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => apiRequest('PUT', `/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: 'Settings updated successfully' });
    }
  });

  const clientTrips = useMemo(() => {
    if (!selectedClient) return [];
    return bookings.filter(b => b.driver.email === selectedClient.email);
  }, [selectedClient, bookings]);

  const getUserTripsAndTotal = (userEmail: string | null) => {
    if (!userEmail) return { trips: 0, total: 0 };
    const userBookings = bookings.filter(b => b.driver.email === userEmail);
    const total = userBookings.reduce((sum, b) => {
      const details = b.details;
      if (!details) return sum;
      return sum + (details.rate * 1 + details.extras + details.protection + details.fees + details.tax - (details.discount || 0));
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

  useEffect(() => {
    if (isAuthenticated && authUser) {
      const fullName = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || authUser.email?.split('@')[0] || 'User';
      setClientUser({ name: fullName, email: authUser.email || '' });
      setDriverDetails(prev => ({ ...prev, name: fullName, email: authUser.email || '' }));
      setProfileForm({ firstName: authUser.firstName || '', lastName: authUser.lastName || '', phone: authUser.phone || '' });
      setShowLoginModal(false);
    }
  }, [isAuthenticated, authUser]);

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
    window.location.href = '/api/logout';
  };
  
  const handleSearch = () => { 
    if (!searchParams.location) { alert("Please select a Pick-up Location."); return; } 
    setIsSearching(true); 
    setTimeout(() => { setIsSearching(false); const fleetSection = document.getElementById('fleet'); if (fleetSection) fleetSection.scrollIntoView({behavior:'smooth'}); }, 1500); 
  };
  
  const handleViewDetails = (car: Vehicle) => { 
    setViewCar(car); 
    setView('car-details'); 
    const today = getTodayString();
    const nextTime = getNext30MinSlot();
    const returnDay = addDaysToDate(today, 3);
    setCarDetailsBooking({ startDate: today, startTime: nextTime, endDate: returnDay, endTime: nextTime });
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
    setView('checkout'); 
  };

  const toggleExtra = (extraType: string) => { 
    if (cart.extrasSelected.includes(extraType)) setCart({ ...cart, extrasSelected: cart.extrasSelected.filter(e => e !== extraType) }); 
    else setCart({ ...cart, extrasSelected: [...cart.extrasSelected, extraType] }); 
  };

  const calculateTotal = () => { 
    if (!cart.car) return { subtotal: 0, taxAmount: 0, total: 0 }; 
    const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
    const carPricing = cart.car.pricing || settings;
    let runningTotal = cart.car.price * days; 
    if (cart.extrasSelected.includes('childSeat')) runningTotal += settings.prices.childSeat;
    if (cart.insuranceOption === '500') runningTotal += (settings.prices.insurance500 * days); 
    if (cart.insuranceOption === '1000') runningTotal += (settings.prices.insurance1000 * days); 
    runningTotal += (carPricing.cleaningFee || settings.cleaningFee); 
    const taxAmount = runningTotal * ((carPricing.taxes || settings.taxes) / 100); 
    return { subtotal: runningTotal, taxAmount, total: runningTotal + taxAmount }; 
  };

  const handleProceedToPayment = () => { 
    if (!isCheckoutValid()) { alert("Please complete all mandatory fields and upload driver license photos."); return; } 
    setView('payment'); 
  };

  const isCheckoutValid = () => driverDetails.name && driverDetails.email && driverDetails.phone && driverDetails.licenseNumber && driverDetails.licenseImages.length >= 2;

  const handleConfirmBooking = async () => { 
    if (paymentMethod === 'credit' && (!paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvc || !paymentDetails.cardName)) { 
      alert("Please enter valid payment details."); 
      return; 
    } 
    setIsProcessingPayment(true); 
    
    // Simulate payment processing animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const totalData = calculateTotal(); 
    const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
    
    const paymentMethodDisplay = paymentMethod === 'paypal' 
      ? 'PayPal' 
      : `${paymentDetails.type.toUpperCase()} **** ${paymentDetails.cardNumber.slice(-4)}`;
    
    const newBooking = { 
      bookingCode: 'BK-' + Math.floor(Math.random() * 10000), 
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      status: 'Active', 
      carName: cart.car!.model, 
      vehicleId: cart.car!.id,
      location: searchParams.location || 'Main Office', 
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
      details: { rate: cart.car!.price * days, extras: (cart.extrasSelected.includes('childSeat') ? settings.prices.childSeat : 0), protection: (cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * days, fees: (cart.car!.pricing?.cleaningFee || settings.cleaningFee), tax: totalData.taxAmount }, 
      carRentalAgreement: carRentalAgreementAccepted ? { accepted: true, clientName: driverDetails.name, acceptedAt: new Date().toISOString() } : undefined,
      checkInStatus: 'pending', 
      checkOutStatus: 'pending', 
      checkInData: null, 
      checkOutData: null 
    };
    
    await createBookingMutation.mutateAsync(newBooking);
    setIsProcessingPayment(false);
    setView('confirmation');
    window.scrollTo(0, 0);
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
        if (currentList.length >= 1) return prev;
        return { ...prev, [section === 'outside' ? 'photosOutside' : 'photosInside']: [...currentList, reader.result as string] };
      });
      reader.readAsDataURL(file);
    }
    if (checkInInputRef.current) checkInInputRef.current.value = '';
  };

  const triggerCheckInput = (section: string) => document.getElementById(`check-input-${section}`)?.click();

  const completeWorkflow = async () => {
     if (!checkData.miles) { alert("Please enter current mileage."); return; }
     if (checkData.photosOutside.length !== 1) { alert("Please upload 1 outside photo."); return; }
     if (checkData.photosInside.length !== 1) { alert("Please upload 1 inside photo."); return; }

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
    const extraTax = extraCost * (settings.taxes / 100);
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

  const sendChatMessage = async (bookingId: number, sender: 'client' | 'admin') => {
    if (!chatMessage.trim()) return;
    await apiRequest('POST', `/api/bookings/${bookingId}/messages`, { sender, text: chatMessage });
    // Mark messages as read when admin/client sends a message (they've seen the conversation)
    await apiRequest('PUT', `/api/bookings/${bookingId}/messages/read`, { reader: sender });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    setChatMessage('');
  };

  const handleExtensionRequestResponse = async (bookingId: number, requestId: string, status: 'approved' | 'rejected') => {
    await apiRequest('PUT', `/api/bookings/${bookingId}/extension-request/${requestId}`, { status });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] });
  };

  const markMessagesAsRead = async (bookingId: number, reader: 'client' | 'admin') => {
    await apiRequest('PUT', `/api/bookings/${bookingId}/messages/read`, { reader });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
  };

  const getUnreadMessagesCount = (booking: Booking, reader: 'client' | 'admin') => {
    const messages = booking.messages || [];
    return messages.filter(m => m.sender !== reader && !m.read).length;
  };

  const getPendingRequestsCount = (booking: Booking) => {
    const requests = booking.extensionRequests || [];
    return requests.filter(r => r.status === 'pending').length;
  };

  const getTotalPendingNotifications = () => {
    return bookings.reduce((acc, b) => {
      const pendingRequests = (b.extensionRequests || []).filter(r => r.status === 'pending').length;
      const unreadMessages = (b.messages || []).filter(m => m.sender === 'client' && !m.read).length;
      return acc + pendingRequests + unreadMessages;
    }, 0);
  };

  const getClientUnreadCount = () => {
    return bookings.filter(b => clientUser && b.driver.email === clientUser.email).reduce((acc, b) => {
      const unread = (b.messages || []).filter(m => m.sender === 'admin' && !m.read).length;
      return acc + unread;
    }, 0);
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
    const vehicleData = {
      model: formData.model,
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
      pricing: formData.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}
    };

    if (editingId) {
      updateVehicleMutation.mutate({ id: editingId, data: vehicleData });
    } else {
      createVehicleMutation.mutate(vehicleData);
    }
  };

  const handleEditVehicle = (car: Vehicle) => {
    const pricing = car.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}};
    setFormData({
      model: car.model,
      category: car.category,
      price: String(car.price),
      fuel: car.fuel,
      seats: car.seats,
      transmission: car.transmission,
      driveType: car.driveType || 'AWD',
      images: car.images.length > 0 ? car.images : [''],
      consumption: car.consumption || '',
      isPriceMatch: car.isPriceMatch || false,
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
      commission: car.commission || 10,
      deductible: car.deductible || 1000,
      availableLocations: car.availableLocations || [],
      pricing: pricing,
    });
    setPricingStrings({
      taxes: String(pricing.taxes || ''),
      extraMileRate: String(pricing.extraMileRate || ''),
      childSeat: String(pricing.prices?.childSeat || ''),
      prepaidFuel: String(pricing.prices?.prepaidFuel || '35'),
      lateReturnGrace: String(pricing.prices?.lateReturnGrace || '25'),
      stressFreePackage: String(pricing.prices?.stressFreePackage || '50'),
      cleaningFee: String(pricing.cleaningFee || ''),
      includedMiles: String(pricing.includedMiles || ''),
      insurance500: String(pricing.prices?.insurance500 || ''),
      insurance1000: String(pricing.prices?.insurance1000 || ''),
    });
    setEditingId(car.id);
  };

  const addLocation = () => { 
    if (newLocation.trim()) { 
      updateSettingMutation.mutate({ key: 'locations', value: [...settings.locations, newLocation.trim()] });
      setNewLocation(''); 
    } 
  };

  const removeLocation = (locToRemove: string) => { 
    updateSettingMutation.mutate({ key: 'locations', value: settings.locations.filter(l => l !== locToRemove) });
  };

  if (vehiclesLoading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-black text-green-600"><Loader className="animate-spin" size={32} /> Loading CarHopGo...</div>;

  return (
    <div className={darkMode ? "dark" : ""}>
      <style>{` @media print { body * { visibility: hidden; } .printable-receipt, .printable-receipt * { visibility: visible; } .printable-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; } .no-print { display: none !important; } } `}</style>
    <div className="min-h-screen bg-gray-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-green-500 selection:text-white transition-colors duration-300 overflow-x-hidden">
      
      <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex justify-between items-center gap-2">
          <div className="flex items-center gap-1 sm:gap-2 cursor-pointer flex-shrink-0" onClick={() => setView('home')} data-testid="link-home">
            <div className="bg-green-600 p-1 sm:p-1.5 rounded-lg flex items-center justify-center"><Car className="text-white w-4 h-4 sm:w-5 sm:h-5" /></div>
            <span className="text-sm sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">CarHop<span className="text-green-600">Go</span></span>
          </div>
          <div className="hidden md:flex items-center gap-4 lg:gap-8 text-xs lg:text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <div className="hidden lg:flex items-center gap-2 hover:text-green-600 dark:hover:text-white transition-colors cursor-pointer"><Phone size={16} /> <span>(475) 449-8622</span></div>
            <button onClick={handleManageBookingClick} className="hover:text-green-600 dark:hover:text-white transition-colors font-bold text-xs uppercase tracking-wide" data-testid="button-manage-booking">Manage Booking</button>
            {clientUser ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setView('bookings')} className="relative p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" data-testid="button-chat-support" title="Support Messages">
                  <MessageCircle size={18}/>
                  {getClientUnreadCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{getClientUnreadCount()}</span>
                  )}
                </button>
                <span className="text-green-600 font-bold" data-testid="text-username">Hi, {clientUser.name}</span>
                <button onClick={handleSignOut} className="text-xs border px-2 py-1 rounded hover:bg-zinc-800" data-testid="button-signout"><LogOut size={12}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLoginModal(true)} className="p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" data-testid="button-chat-support-guest" title="Support">
                  <MessageCircle size={18}/>
                </button>
                <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white dark:hover:text-black transition-all uppercase text-xs font-bold tracking-wider" data-testid="button-signin">Sign In</button>
              </div>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="hover:text-green-600 dark:hover:text-white transition-colors" title="Toggle Theme" data-testid="button-theme-toggle">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => setView('admin')} className="text-zinc-400 hover:text-white" data-testid="button-admin"><Lock size={16}/></button>
          </div>

          <div className="flex md:hidden items-center justify-end gap-1 sm:gap-2 flex-1">
            <div className="relative">
              <button onClick={() => setMobileActionsMenuOpen(!mobileActionsMenuOpen)} className="p-1 sm:p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" data-testid="button-actions-menu">
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {mobileActionsMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-[150px] overflow-hidden">
                  {clientUser ? (
                    <>
                      <div className="w-full px-4 py-2 text-center text-sm text-green-600 font-bold flex items-center justify-center gap-2">Hi, {clientUser.name.split(' ')[0]}</div>
                      <button onClick={() => { setView('bookings'); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-chat-logged"><MessageCircle className="h-4 w-4" />Chat / Support</button>
                      <button onClick={() => { setShowProfileModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-profile"><User className="h-4 w-4" />Edit Profile</button>
                      <button onClick={() => { setDarkMode(!darkMode); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-theme">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
                      <button onClick={() => { handleSignOut(); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 text-red-600 dark:text-red-400" data-testid="button-menu-logout"><LogOut className="h-4 w-4" />Logout</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setShowLoginModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-2" data-testid="button-menu-signin">Sign In</button>
                      <button onClick={() => { setShowLoginModal(true); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-chat"><MessageCircle className="h-4 w-4" />Chat / Support</button>
                      <button onClick={() => { setDarkMode(!darkMode); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800" data-testid="button-menu-theme">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {selectedImage && <ImageViewer src={selectedImage} onClose={() => setSelectedImage(null)} />}

      {isProcessingPayment && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4 text-center">
          <Car size={64} className="text-green-600 animate-bounce mb-6" />
          <div className="flex items-center gap-3 text-white text-xl font-bold mb-2"><Loader className="animate-spin"/> Processing payment...</div>
          <p className="text-zinc-400 text-sm">Please wait while we secure your vehicle.</p>
        </div>
      )}
      
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

            <div className="text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Don't have an account? <button onClick={() => { setShowLoginModal(false); setShowSignupModal(true); }} className="text-green-600 hover:text-green-700 font-bold" data-testid="button-create-account-link">Create Account</button></p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <button onClick={() => { setShowLoginModal(false); setShowAdminLoginModal(true); }} className="text-[10px] sm:text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto" data-testid="button-admin-login"><Settings size={10}/> Admin / Owner Login</button>
              <button onClick={() => { setShowLoginModal(false); setShowHostRegisterModal(true); }} className="text-[10px] sm:text-xs text-green-500 hover:text-green-400 flex items-center justify-center gap-1 mx-auto font-bold" data-testid="button-become-host"><Building2 size={10}/> Become a Host</button>
            </div>
          </div>
        </div>
      )}

      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowAdminLoginModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-admin-modal"><X size={20}/></button>
            
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">Admin / Owner Login</h2>
            
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
                  setHostRegisterForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', licenseNumber: '', licenseFrontImage: '', licenseBackImage: '', proofOfResidenceImage: '', username: '', password: '', confirmPassword: '' }); 
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
                <input 
                  type="text" 
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                  placeholder="First Name" 
                  required 
                  className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-profile-first-name" 
                />
                <input 
                  type="text" 
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                  placeholder="Last Name" 
                  required 
                  className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                  data-testid="input-profile-last-name" 
                />
              </div>
              <input 
                type="tel" 
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                placeholder="Phone Number" 
                required 
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                data-testid="input-profile-phone" 
              />
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 mt-4" data-testid="button-profile-save">Save Changes</Button>
            </form>
          </div>
        </div>
      )}

      {view === 'host-dashboard' && currentHost && (
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="flex items-start justify-between mb-8 gap-2">
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white" data-testid="text-host-title">Host Dashboard</h1>
              <p className="text-xs text-zinc-500">Welcome, {currentHost.firstName} {currentHost.lastName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setDarkMode(!darkMode)} data-testid="button-host-theme">
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setCurrentHost(null); setView('home'); }} data-testid="button-host-logout">
                <LogOut size={14} className="mr-1" /> Logout
              </Button>
            </div>
          </div>
          
          <div className="flex justify-center gap-2 mb-6 overflow-x-auto pb-2">
            {['fleet', 'bookings', 'earnings'].map(tab => (
              <button key={tab} onClick={() => setHostTab(tab)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${hostTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-host-tab-${tab}`}>
                {tab === 'fleet' && <Car size={18} />}
                {tab === 'bookings' && <Briefcase size={18} />}
                {tab === 'earnings' && <TrendingUp size={18} />}
                <span>{tab}</span>
              </button>
            ))}
          </div>

          {hostTab === 'fleet' && (() => {
            const hostVehicles = vehicles.filter(v => v.hostId === String(currentHost.id));
            return (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <Card className="p-6">
                      <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Add New Vehicle</h3>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const vehicleData = {
                          ...formData,
                          price: parseFloat(formData.price) || 0,
                          hostId: String(currentHost.id),
                          commission: formData.commission || 10,
                          deductible: formData.deductible || 1000
                        };
                        createVehicleMutation.mutate(vehicleData);
                      }} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Car Model *</label>
                          <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="e.g. Tesla Model 3" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-vehicle-model" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Daily Rate ($) *</label>
                            <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="e.g. 45" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-vehicle-price" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fuel Type</label>
                            <select value={formData.fuel} onChange={(e) => setFormData({...formData, fuel: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                              <option value="Gasoline">Gasoline</option>
                              <option value="Diesel">Diesel</option>
                              <option value="Electric">Electric</option>
                              <option value="Hybrid">Hybrid</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Seats</label>
                            <select value={formData.seats} onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                              <option value="2">2</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Transmission</label>
                            <select value={formData.transmission} onChange={(e) => setFormData({...formData, transmission: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                              <option value="Automatic">Automatic</option>
                              <option value="Manual">Manual</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Drive Type</label>
                          <select value={formData.driveType} onChange={(e) => setFormData({...formData, driveType: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                            <option value="AWD">AWD (All-Wheel Drive)</option>
                            <option value="FWD">FWD (Front-Wheel Drive)</option>
                            <option value="RWD">RWD (Rear-Wheel Drive)</option>
                            <option value="4WD">4WD (Four-Wheel Drive)</option>
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Consumption / Range</label>
                            <input type="text" value={formData.consumption} onChange={(e) => setFormData({...formData, consumption: e.target.value})} placeholder="e.g. 300mi range" className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-vehicle-consumption" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Category *</label>
                            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                              <option value="">Select Category</option>
                              <option value="SEDAN">SEDAN</option>
                              <option value="SUV">SUV</option>
                              <option value="HATCHBACK">HATCHBACK</option>
                              <option value="MINIVAN">MINIVAN</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Features</label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.isAWD} onChange={(e) => setFormData({...formData, isAWD: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              AWD / 4x4
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasCarPlay} onChange={(e) => setFormData({...formData, hasCarPlay: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              CarPlay / Auto
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasBluetooth} onChange={(e) => setFormData({...formData, hasBluetooth: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Bluetooth
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasReverseCamera} onChange={(e) => setFormData({...formData, hasReverseCamera: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Reverse Camera
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasHeatedSeats} onChange={(e) => setFormData({...formData, hasHeatedSeats: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Heated Seats
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasHeatedSteering} onChange={(e) => setFormData({...formData, hasHeatedSteering: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Heated Steering
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasElectricSeats} onChange={(e) => setFormData({...formData, hasElectricSeats: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Electric Seats
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasPaddleShifters} onChange={(e) => setFormData({...formData, hasPaddleShifters: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Paddle Shifters
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasKeylessEntry} onChange={(e) => setFormData({...formData, hasKeylessEntry: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Keyless Entry
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasBlindSpotWarning} onChange={(e) => setFormData({...formData, hasBlindSpotWarning: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Blind Spot Warning
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasDriveAssist} onChange={(e) => setFormData({...formData, hasDriveAssist: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              Drive Assist
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input type="checkbox" checked={formData.hasUSBCharger} onChange={(e) => setFormData({...formData, hasUSBCharger: e.target.checked})} className="w-4 h-4 accent-green-600" />
                              USB Charger
                            </label>
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Vehicle Photos ({formData.images.filter(img => img.trim()).length} photos)</label>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {formData.images.filter(img => img.trim()).map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img src={img} alt={`Photo ${idx+1}`} className="w-16 h-16 object-cover rounded border border-zinc-300 dark:border-zinc-700" />
                                <button type="button" onClick={() => setFormData({...formData, images: formData.images.filter((_, i) => i !== idx)})} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X size={10}/>
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mb-2">
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
                            }} className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-vehicle-photo-upload" />
                          </div>
                          <input type="text" placeholder="Or paste image URL and press Enter..." className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" onKeyDown={(e) => {
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
                        
                        <div className="border-t pt-4">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Available Locations</label>
                          <div className="space-y-2">
                            {settings.locations.map(loc => (
                              <label key={loc} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                <input type="checkbox" checked={formData.availableLocations?.includes(loc) || false} onChange={(e) => {
                                  const current = formData.availableLocations || [];
                                  setFormData({...formData, availableLocations: e.target.checked ? [...current, loc] : current.filter(l => l !== loc)});
                                }} className="w-4 h-4 accent-green-600" />
                                {loc}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Commission Plan</label>
                          <div className="space-y-2">
                            <div className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${formData.commission === 15 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setFormData({...formData, commission: 15, deductible: 750})}>
                              <input type="radio" name="commission" value="15" checked={formData.commission === 15} onChange={() => setFormData({...formData, commission: 15, deductible: 750})} className="w-4 h-4" />
                              <div className="ml-3">
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">15% Commission</p>
                                <p className="text-xs text-zinc-500">$750 Deductible</p>
                              </div>
                            </div>
                            <div className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${formData.commission === 25 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setFormData({...formData, commission: 25, deductible: 500})}>
                              <input type="radio" name="commission" value="25" checked={formData.commission === 25} onChange={() => setFormData({...formData, commission: 25, deductible: 500})} className="w-4 h-4" />
                              <div className="ml-3">
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">25% Commission</p>
                                <p className="text-xs text-zinc-500">$500 Deductible</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" data-testid="button-host-add-vehicle">Add Vehicle</Button>
                      </form>
                    </Card>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                    {/* Pickup Locations */}
                    <Card className="p-6">
                      <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                        <MapPin size={18} className="text-green-500"/>
                        Pickup Locations
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {settings.locations.map(loc => (
                          <span key={loc} className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-xs font-bold group">
                            <MapPin size={12}/> {loc}
                            <button onClick={() => updateSettingMutation.mutate({ key: 'locations', value: settings.locations.filter(l => l !== loc) })} className="ml-1 p-0.5 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full" data-testid={`button-remove-location-${loc.replace(/\s+/g, '-')}`}>
                              <X size={12} className="text-red-500"/>
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={hostNewLocation} onChange={(e) => setHostNewLocation(e.target.value)} placeholder="Add new location..." className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-new-location" />
                        <Button variant="primary" onClick={() => { if(hostNewLocation.trim()) { updateSettingMutation.mutate({ key: 'locations', value: [...settings.locations, hostNewLocation.trim()] }); setHostNewLocation(''); } }} data-testid="button-add-location">
                          <Plus size={16}/> Add
                        </Button>
                      </div>
                    </Card>

                    {/* Price Configuration Section */}
                    <Card className="p-6">
                      <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                        <DollarSign size={18} className="text-green-500"/>
                        Price Configuration
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Sales Tax (%)</label>
                          <input type="number" step="0.1" value={priceConfigForm?.taxes || settings.taxes} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, taxes: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-taxes" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Cleaning Fee ($)</label>
                          <input type="number" value={priceConfigForm?.cleaningFee || settings.cleaningFee} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, cleaningFee: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-cleaning-fee" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Included Miles/Day</label>
                          <input type="number" value={priceConfigForm?.includedMiles || settings.includedMiles} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, includedMiles: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-included-miles" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Extra Mile Rate ($)</label>
                          <input type="number" step="0.01" value={priceConfigForm?.extraMileRate ?? settings.extraMileRate} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, extraMileRate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-host-extra-mile-rate" />
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-bold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Shield size={16} className="text-blue-500"/>
                        Insurance Prices (per day)
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">$500 Deductible Price (Fixed)</label>
                          <input type="text" value={priceConfigForm?.prices?.insurance500 || settings.prices.insurance500} disabled className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-sm cursor-not-allowed opacity-60" data-testid="input-host-insurance-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">$1000 Deductible Price (Fixed)</label>
                          <input type="text" value={priceConfigForm?.prices?.insurance1000 || settings.prices.insurance1000} disabled className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-sm cursor-not-allowed opacity-60" data-testid="input-host-insurance-1000" />
                        </div>
                      </div>

                      <h4 className="text-sm font-bold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Shield size={16} className="text-green-500"/>
                        Add-on Prices
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Child Seat</label>
                          <input type="number" value={priceConfigForm?.prices?.childSeat || settings.prices.childSeat} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeat: parseFloat(e.target.value) || 0}})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm mb-2" data-testid="input-host-child-seat" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="childSeatBilling" checked={!(priceConfigForm?.prices?.childSeatPerTrip ?? settings.prices.childSeatPerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeatPerTrip: false}})} className="accent-green-500" />
                              Per Day
                            </label>
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="childSeatBilling" checked={priceConfigForm?.prices?.childSeatPerTrip ?? settings.prices.childSeatPerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, childSeatPerTrip: true}})} className="accent-green-500" />
                              Per Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Prepaid Fuel</label>
                          <input type="number" value={priceConfigForm?.prices?.prepaidFuel ?? settings.prices.prepaidFuel} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuel: parseFloat(e.target.value) || 0}})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm mb-2" data-testid="input-host-prepaid-fuel" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="prepaidFuelBilling" checked={!(priceConfigForm?.prices?.prepaidFuelPerTrip ?? settings.prices.prepaidFuelPerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuelPerTrip: false}})} className="accent-green-500" />
                              Per Day
                            </label>
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="prepaidFuelBilling" checked={priceConfigForm?.prices?.prepaidFuelPerTrip ?? settings.prices.prepaidFuelPerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, prepaidFuelPerTrip: true}})} className="accent-green-500" />
                              Per Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">2hr Late Return Grace Period</label>
                          <input type="number" value={priceConfigForm?.prices?.lateReturnGrace ?? settings.prices.lateReturnGrace} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGrace: parseFloat(e.target.value) || 0}})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm mb-2" data-testid="input-host-late-return-grace" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="lateReturnGraceBilling" checked={!(priceConfigForm?.prices?.lateReturnGracePerTrip ?? settings.prices.lateReturnGracePerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGracePerTrip: false}})} className="accent-green-500" />
                              Per Day
                            </label>
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="lateReturnGraceBilling" checked={priceConfigForm?.prices?.lateReturnGracePerTrip ?? settings.prices.lateReturnGracePerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, lateReturnGracePerTrip: true}})} className="accent-green-500" />
                              Per Trip
                            </label>
                          </div>
                        </div>
                        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/20">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Stress-Free Package</label>
                          <p className="text-[10px] text-zinc-400 mb-2">Includes Prepaid Fuel + 2hr Late Return Grace</p>
                          <input type="number" value={priceConfigForm?.prices?.stressFreePackage ?? settings.prices.stressFreePackage} onChange={(e) => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackage: parseFloat(e.target.value) || 0}})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm mb-2" data-testid="input-host-stress-free-package" />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="stressFreePackageBilling" checked={!(priceConfigForm?.prices?.stressFreePackagePerTrip ?? settings.prices.stressFreePackagePerTrip)} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackagePerTrip: false}})} className="accent-green-500" />
                              Per Day
                            </label>
                            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                              <input type="radio" name="stressFreePackageBilling" checked={priceConfigForm?.prices?.stressFreePackagePerTrip ?? settings.prices.stressFreePackagePerTrip} onChange={() => setPriceConfigForm({...priceConfigForm || settings, prices: {...(priceConfigForm || settings).prices, stressFreePackagePerTrip: true}})} className="accent-green-500" />
                              Per Trip
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setPriceConfigForm(settings)} data-testid="button-cancel-price-config">Cancel</Button>
                        <Button variant="primary" className="flex-1" onClick={() => {
                          if (priceConfigForm) {
                            updateSettingMutation.mutate({ key: 'taxes', value: priceConfigForm.taxes });
                            updateSettingMutation.mutate({ key: 'cleaningFee', value: priceConfigForm.cleaningFee });
                            updateSettingMutation.mutate({ key: 'includedMiles', value: priceConfigForm.includedMiles });
                            updateSettingMutation.mutate({ key: 'extraMileRate', value: priceConfigForm.extraMileRate });
                            updateSettingMutation.mutate({ key: 'prices', value: priceConfigForm.prices });
                          }
                        }} data-testid="button-save-price-config">
                          <Check size={16}/> Save Configuration
                        </Button>
                      </div>
                    </Card>

                    {/* My Vehicles */}
                    <Card className="p-6">
                      <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">My Vehicles ({hostVehicles.length})</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {hostVehicles.length > 0 ? hostVehicles.map((car) => (
                          <div key={car.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" data-testid={`card-host-vehicle-${car.id}`}>
                            <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-16 h-16 object-cover rounded-lg" />
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{car.model}</h4>
                              <p className="text-xs text-zinc-500">{car.fuel} · {car.category} · {car.seats} seats · {car.images?.length || 0} photos</p>
                              <p className="text-xs font-bold text-green-600 mt-1">${car.price}/day | {car.commission || 10}% commission | ${car.deductible || 1000} deductible</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingHostVehicle(car); setHostVehicleImages(car.images || []); setEditingPricingStrings({taxes: String(car.pricing?.taxes || '8.5'), extraMileRate: String(car.pricing?.extraMileRate || '0.45'), childSeat: String(car.pricing?.prices?.childSeat || '8'), prepaidFuel: String(car.pricing?.prices?.prepaidFuel || '35'), lateReturnGrace: String(car.pricing?.prices?.lateReturnGrace || '25'), stressFreePackage: String(car.pricing?.prices?.stressFreePackage || '50'), cleaningFee: String(car.pricing?.cleaningFee || '25'), includedMiles: String(car.pricing?.includedMiles || '200'), insurance500: String(car.pricing?.prices?.insurance500 || '25'), insurance1000: String(car.pricing?.prices?.insurance1000 || '15')}); }} className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50" data-testid={`button-edit-vehicle-${car.id}`}>
                                <Edit size={16} />
                              </button>
                              <button onClick={() => { if(confirm('Delete this vehicle?')) deleteVehicleMutation.mutate(car.id); }} className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50" data-testid={`button-delete-vehicle-${car.id}`}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-zinc-500 text-center py-8">No vehicles added yet</p>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Vehicle Edit Modal */}
                {editingHostVehicle && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Edit Vehicle: {editingHostVehicle.model}</h3>
                        <button onClick={() => { setEditingHostVehicle(null); setHostVehicleImages([]); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full" data-testid="button-close-edit-vehicle">
                          <X size={20} className="text-zinc-500"/>
                        </button>
                      </div>

                      {/* Photo Management */}
                      <div className="mb-6">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Image size={14}/> Vehicle Photos ({hostVehicleImages.length})
                        </label>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          {hostVehicleImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img src={img} alt={`Photo ${idx+1}`} className="w-full h-20 object-cover rounded-lg border border-zinc-300 dark:border-zinc-700" />
                              <button onClick={() => setHostVehicleImages(hostVehicleImages.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-remove-photo-${idx}`}>
                                <X size={12}/>
                              </button>
                            </div>
                          ))}
                          <button onClick={() => setHostVehicleImages([...hostVehicleImages, ''])} className="w-full h-20 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:border-green-500 hover:text-green-500 transition-colors" data-testid="button-add-photo-slot">
                            <Plus size={24}/>
                          </button>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <input type="file" ref={editVehicleImageInputRef} accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                const newImages = hostVehicleImages[0] === '' ? [base64] : [...hostVehicleImages, base64];
                                setHostVehicleImages(newImages);
                                if (editVehicleImageInputRef.current) editVehicleImageInputRef.current.value = '';
                              };
                              reader.readAsDataURL(file);
                            }
                          }} className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-edit-vehicle-photo-upload" />
                        </div>
                        {hostVehicleImages.map((img, idx) => (
                          <input key={idx} type="text" value={img} onChange={(e) => { const newImages = [...hostVehicleImages]; newImages[idx] = e.target.value; setHostVehicleImages(newImages); }} placeholder={`Photo URL ${idx+1}`} className="w-full px-3 py-2 mb-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid={`input-photo-url-${idx}`} />
                        ))}
                      </div>

                      {/* Vehicle Details */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Price/Day ($)</label>
                          <input type="number" value={editingHostVehicle.price} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, price: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-edit-vehicle-price" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Category</label>
                          <select value={editingHostVehicle.category || ''} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, category: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-edit-vehicle-category">
                            <option value="">Select Category</option>
                            <option value="SEDAN">SEDAN</option>
                            <option value="SUV">SUV</option>
                            <option value="HATCHBACK">HATCHBACK</option>
                            <option value="MINIVAN">MINIVAN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fuel Type</label>
                          <select value={editingHostVehicle.fuel || 'Gasoline'} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, fuel: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                            <option value="Gasoline">Gasoline</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Electric">Electric</option>
                            <option value="Hybrid">Hybrid</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Transmission</label>
                          <select value={editingHostVehicle.transmission || 'Automatic'} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, transmission: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                            <option value="Automatic">Automatic</option>
                            <option value="Manual">Manual</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Seats</label>
                          <select value={editingHostVehicle.seats || 5} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, seats: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                            <option value="4">4 Seats</option>
                            <option value="5">5 Seats</option>
                            <option value="7">7 Seats</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Drive Type</label>
                          <select value={editingHostVehicle.driveType || 'AWD'} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, driveType: e.target.value})} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm">
                            <option value="AWD">AWD</option>
                            <option value="FWD">FWD</option>
                            <option value="RWD">RWD</option>
                          </select>
                        </div>
                      </div>

                      {/* Commission Plan */}
                      <div className="mb-6">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Commission Plan</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${editingHostVehicle.commission === 15 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setEditingHostVehicle({...editingHostVehicle, commission: 15, deductible: 750})}>
                            <input type="radio" checked={editingHostVehicle.commission === 15} onChange={() => {}} className="w-4 h-4" />
                            <div className="ml-3">
                              <p className="text-sm font-bold text-zinc-900 dark:text-white">15% Commission</p>
                              <p className="text-xs text-zinc-500">$750 Deductible</p>
                            </div>
                          </div>
                          <div className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${editingHostVehicle.commission === 25 ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-zinc-300 dark:border-zinc-700 hover:border-green-400'}`} onClick={() => setEditingHostVehicle({...editingHostVehicle, commission: 25, deductible: 500})}>
                            <input type="radio" checked={editingHostVehicle.commission === 25} onChange={() => {}} className="w-4 h-4" />
                            <div className="ml-3">
                              <p className="text-sm font-bold text-zinc-900 dark:text-white">25% Commission</p>
                              <p className="text-xs text-zinc-500">$500 Deductible</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pickup Locations */}
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                        <label className="block text-xs font-bold text-zinc-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                          <MapPin size={14}/> Pickup Locations
                        </label>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {(settings?.locations || ['JFK Airport', 'Downtown Center', 'Fairfield County']).map((loc) => (
                            <label key={loc} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={(editingHostVehicle.availableLocations || []).includes(loc)}
                                onChange={(e) => {
                                  const current = editingHostVehicle.availableLocations || [];
                                  if (e.target.checked) {
                                    setEditingHostVehicle({...editingHostVehicle, availableLocations: [...current, loc]});
                                  } else {
                                    setEditingHostVehicle({...editingHostVehicle, availableLocations: current.filter(l => l !== loc)});
                                  }
                                }}
                                className="w-4 h-4 accent-blue-600" 
                              />
                              {loc}
                            </label>
                          ))}
                        </div>
                        <Button 
                          variant="primary" 
                          size="sm"
                          className="w-full" 
                          onClick={() => {
                            updateVehicleMutation.mutate({ 
                              id: editingHostVehicle.id, 
                              data: {...editingHostVehicle, availableLocations: editingHostVehicle.availableLocations || []} 
                            });
                          }}
                          data-testid="button-save-vehicle-locations"
                        >
                          <Check size={14}/> Save Locations
                        </Button>
                      </div>

                      {/* Features */}
                      <div className="mb-6">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Features</label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasCarPlay || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasCarPlay: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            CarPlay / Auto
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasBluetooth || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasBluetooth: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Bluetooth
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasReverseCamera || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasReverseCamera: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Reverse Camera
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasHeatedSeats || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasHeatedSeats: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Heated Seats
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasHeatedSteering || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasHeatedSteering: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Heated Steering
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasElectricSeats || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasElectricSeats: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Electric Seats
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasPaddleShifters || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasPaddleShifters: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Paddle Shifters
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasKeylessEntry || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasKeylessEntry: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Keyless Entry
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasBlindSpotWarning || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasBlindSpotWarning: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Blind Spot Warning
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasDriveAssist || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasDriveAssist: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            Drive Assist
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            <input type="checkbox" checked={editingHostVehicle.hasUSBCharger || false} onChange={(e) => setEditingHostVehicle({...editingHostVehicle, hasUSBCharger: e.target.checked})} className="w-4 h-4 accent-green-600" />
                            USB Charger
                          </label>
                        </div>
                      </div>

                      {/* Individual Vehicle Pricing Configuration */}
                      <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg">
                        <label className="block text-xs font-bold text-zinc-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                          <DollarSign size={14}/> Individual Price Configuration
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Sales Tax (%)</label>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              placeholder="e.g., 8.5"
                              value={editingPricingStrings.taxes}
                              onChange={(e) => setEditingPricingStrings({...editingPricingStrings, taxes: e.target.value})}
                              onBlur={(e) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0; const newPricing = {...(editingHostVehicle.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}), taxes: val}; setEditingHostVehicle({...editingHostVehicle, pricing: newPricing}); setEditingPricingStrings({...editingPricingStrings, taxes: String(val)})}}
                              className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                              data-testid="input-vehicle-pricing-taxes"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Cleaning Fee ($)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              value={editingHostVehicle.pricing?.cleaningFee ?? 25} 
                              onChange={(e) => setEditingHostVehicle({...editingHostVehicle, pricing: {...(editingHostVehicle.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}), cleaningFee: parseFloat(e.target.value) || 0}} as Vehicle)}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                              data-testid="input-vehicle-pricing-cleaning"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Included Miles/Day (Editable)</label>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              placeholder="e.g., 200"
                              value={editingHostVehicle.pricing?.includedMiles ?? 200} 
                              onChange={(e) => {const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0; setEditingHostVehicle({...editingHostVehicle, pricing: {...(editingHostVehicle.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}), includedMiles: val}} as Vehicle)}}
                              className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                              data-testid="input-vehicle-pricing-miles"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Extra Mile Rate ($) (Editable)</label>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              placeholder="e.g., 0.45"
                              value={editingPricingStrings.extraMileRate}
                              onChange={(e) => setEditingPricingStrings({...editingPricingStrings, extraMileRate: e.target.value})}
                              onBlur={(e) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0; const newPricing = {...(editingHostVehicle.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}), extraMileRate: val}; setEditingHostVehicle({...editingHostVehicle, pricing: newPricing}); setEditingPricingStrings({...editingPricingStrings, extraMileRate: String(val)})}}
                              className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                              data-testid="input-vehicle-pricing-extra-mile"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Insurance $500 (Fixed)</label>
                            <input 
                              type="text" 
                              placeholder="e.g., 25 or 25.50"
                              value={editingHostVehicle.pricing?.prices?.insurance500 ?? 25} 
                              disabled
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-sm cursor-not-allowed opacity-60" 
                              data-testid="input-vehicle-pricing-ins500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Insurance $1000 (Fixed)</label>
                            <input 
                              type="text" 
                              placeholder="e.g., 15 or 15.50"
                              value={editingHostVehicle.pricing?.prices?.insurance1000 ?? 15} 
                              disabled
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 text-sm cursor-not-allowed opacity-60" 
                              data-testid="input-vehicle-pricing-ins1000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Child Seat Price (Editable)</label>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              placeholder="e.g., 8 or 8.50"
                              value={editingPricingStrings.childSeat}
                              onChange={(e) => setEditingPricingStrings({...editingPricingStrings, childSeat: e.target.value})}
                              onBlur={(e) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0; const newPricing = {...(editingHostVehicle.pricing || {taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}}), prices: {...(editingHostVehicle.pricing?.prices || {insurance500: 25, insurance1000: 15, childSeat: 8, childSeatPerTrip: false, prepaidFuel: 35, prepaidFuelPerTrip: true, lateReturnGrace: 25, lateReturnGracePerTrip: true, stressFreePackage: 50, stressFreePackagePerTrip: true}), childSeat: val}}; setEditingHostVehicle({...editingHostVehicle, pricing: newPricing}); setEditingPricingStrings({...editingPricingStrings, childSeat: String(val)})}}
                              className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" 
                              data-testid="input-vehicle-pricing-child-seat"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => { setEditingHostVehicle(null); setHostVehicleImages([]); setEditingPricingStrings({taxes: '8.5', extraMileRate: '0.45', childSeat: '8', prepaidFuel: '35', lateReturnGrace: '25', stressFreePackage: '50', cleaningFee: '25', includedMiles: '200', insurance500: '25', insurance1000: '15'}); }} data-testid="button-cancel-edit-vehicle">Cancel</Button>
                        <Button variant="primary" className="flex-1" onClick={() => {
                          const updatedData = {
                            ...editingHostVehicle,
                            images: hostVehicleImages.filter(img => img.trim() !== '')
                          };
                          updateVehicleMutation.mutate({ id: editingHostVehicle.id, data: updatedData });
                          setEditingHostVehicle(null);
                          setHostVehicleImages([]);
                        }} data-testid="button-update-configuration">
                          <Check size={16}/> Update Configuration
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {hostTab === 'bookings' && (() => {
            const hostVehicleIds = vehicles.filter(v => v.hostId === String(currentHost.id)).map(v => v.id);
            const hostBookings = bookings.filter(b => b.vehicleId && hostVehicleIds.includes(b.vehicleId));
            return (
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">My Bookings ({hostBookings.length})</h3>
                {hostBookings.length > 0 ? (
                  <div className="space-y-3">
                    {hostBookings.map(b => (
                      <div key={b.id} className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{b.bookingCode}</h4>
                            <p className="text-xs text-zinc-500">{b.carName}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded font-bold ${b.status === 'Completed' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'}`}>{b.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <div><span className="text-zinc-500">Client:</span> {b.driver.name}</div>
                          <div><span className="text-zinc-500">Total:</span> <span className="text-green-500 font-bold">${b.total.toFixed(2)}</span></div>
                          <div><span className="text-zinc-500">From:</span> {b.startDate}</div>
                          <div><span className="text-zinc-500">To:</span> {b.returnDate}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-8">No bookings yet</p>
                )}
              </Card>
            );
          })()}

          {hostTab === 'earnings' && (() => {
            const hostVehicleIds = vehicles.filter(v => v.hostId === String(currentHost.id)).map(v => v.id);
            const hostVehicleMap = Object.fromEntries(vehicles.filter(v => v.hostId === String(currentHost.id)).map(v => [v.id, v]));
            const hostBookings = bookings.filter(b => b.vehicleId && hostVehicleIds.includes(b.vehicleId) && b.status === 'Completed');
            
            let totalGross = 0;
            let totalCommission = 0;
            let totalDeductible = 0;
            
            hostBookings.forEach(b => {
              const vehicle = hostVehicleMap[b.vehicleId as unknown as number];
              const commission = vehicle ? (b.total * (vehicle.commission || 10) / 100) : (b.total * 0.10);
              const deductible = vehicle?.deductible || 1000;
              totalGross += b.total;
              totalCommission += commission;
              totalDeductible += deductible;
            });
            
            const netEarnings = totalGross - totalCommission - totalDeductible;
            return (
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="p-6 text-center">
                  <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Gross Earnings</h4>
                  <p className="text-3xl font-bold text-zinc-900 dark:text-white">${totalGross.toFixed(2)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total before deductions</p>
                </Card>
                <Card className="p-6 text-center">
                  <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Commission</h4>
                  <p className="text-3xl font-bold text-orange-500">-${totalCommission.toFixed(2)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Platform fee</p>
                </Card>
                <Card className="p-6 text-center">
                  <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Deductible</h4>
                  <p className="text-3xl font-bold text-red-500">-${totalDeductible.toFixed(2)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Insurance deductible</p>
                </Card>
                <Card className="p-6 text-center">
                  <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Net Earnings</h4>
                  <p className="text-3xl font-bold text-green-500">${Math.max(0, netEarnings).toFixed(2)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Your profit</p>
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
                  <span className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 sm:mb-2">Price Match Guarantee</span>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 sm:mb-4" data-testid="text-hero-title">The Best car rental prices in Fairfield County <br/><span className="text-green-500">Starting from $39/day</span></h1>
                  <p className="text-xs sm:text-base lg:text-lg text-zinc-200 max-w-xl mb-6 sm:mb-8">Premium vehicles at unbeatable prices. Book your ride in just 3 simple steps.</p>
                </div>
                <Card className="p-4 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur w-full">
                  <h3 className="text-base sm:text-lg font-bold mb-4 text-zinc-900 dark:text-white">Find Your Perfect Ride</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Pick-up Location</label>
                      <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white">
                        <div className="pl-2 sm:pl-3"><MapPin size={16} className="text-green-600" /></div>
                        <select className="bg-transparent w-full p-2 sm:p-3 outline-none text-xs sm:text-sm" value={searchParams.location} onChange={(e) => handleSearchParamsChange('location', e.target.value)} data-testid="select-location">
                          <option value="" className="text-black">Select Location</option>
                          {settings.locations.map(loc => <option key={loc} value={loc} className="text-black">{loc}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Pick-up Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 sm:px-2 sm:py-1.5 cursor-pointer" onClick={(e) => {if (e.target.tagName !== 'INPUT') document.querySelector('[data-testid="input-start-date"]').click()}}>
                          <Calendar size={13} className="text-black dark:text-white mr-1 flex-shrink-0 cursor-pointer" />
                          <input type="date" value={searchParams.start} onChange={e => handleSearchParamsChange('start', e.target.value)} min={getTodayString()} className="bg-transparent w-full outline-none text-xs sm:text-sm text-zinc-900 dark:text-white cursor-pointer" data-testid="input-start-date" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Return Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 sm:px-2 sm:py-1.5 cursor-pointer" onClick={(e) => {if (e.target.tagName !== 'INPUT') document.querySelector('[data-testid="input-end-date"]').click()}}>
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
            
            <div id="fleet" className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16 scroll-mt-32">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white" data-testid="text-fleet-title">Our Fleet</h2>
                  <p className="text-xs sm:text-sm text-zinc-500">Choose from our wide selection of vehicles</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {vehicles.filter(car => {
                  // If no location selected, show all vehicles
                  if (!searchParams.location) return true;
                  
                  // If vehicle has no availableLocations (old data), show it
                  if (!car.availableLocations) return true;
                  
                  // If vehicle has empty availableLocations array, show it
                  if (car.availableLocations.length === 0) return true;
                  
                  // Otherwise, only show if location is in availableLocations
                  return car.availableLocations.includes(searchParams.location);
                }).map((car) => (
                  <div key={car.id} onClick={() => handleViewDetails(car)} data-testid={`card-vehicle-${car.id}`}>
                    <Card className="group cursor-pointer hover-elevate overflow-visible">
                      <div className="relative overflow-hidden rounded-t-lg">
                        <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60'} alt={car.model} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate flex-1" data-testid={`text-vehicle-name-${car.id}`}>{car.model}</h3>
                          <div className="text-right flex-shrink-0">
                            <div className="text-base sm:text-xl font-bold text-green-600" data-testid={`text-vehicle-price-${car.id}`}>${car.price}</div>
                            <div className="text-[9px] sm:text-xs text-zinc-500">/day</div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400 mb-4 flex-wrap">
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
                        <Button className="w-full text-xs sm:text-sm py-2 sm:py-3" onClick={(e: any) => { e.stopPropagation(); handleRent(car); }} data-testid={`button-rent-${car.id}`}>Book Now</Button>
                      </div>
                    </Card>
                  </div>
                ))}
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
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setDarkMode(!darkMode)} data-testid="button-admin-theme">
                  {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0" data-testid="button-admin-chat">
                  <MessageCircle size={14}/>
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center gap-1 md:gap-2 mb-6 overflow-x-auto pb-2">
              {['fleet', 'bookings', 'clients', 'hosts', 'earnings'].map(tab => (
                <button key={tab} onClick={() => { setAdminTab(tab); setSelectedClient(null); setSelectedHost(null); }} className={`flex flex-col items-center gap-0.5 md:gap-1 px-2 md:px-3 py-2 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-wider transition-all whitespace-nowrap ${adminTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-tab-${tab}`}>
                  <div className="hidden md:block">
                    {tab === 'fleet' && <Car size={18} />}
                    {tab === 'bookings' && <Briefcase size={18} />}
                    {tab === 'clients' && <Users size={18} />}
                    {tab === 'hosts' && <Building2 size={18} />}
                    {tab === 'earnings' && <TrendingUp size={18} />}
                  </div>
                  <div className="md:hidden">
                    {tab === 'fleet' && <Car size={14} />}
                    {tab === 'bookings' && <Briefcase size={14} />}
                    {tab === 'clients' && <Users size={14} />}
                    {tab === 'hosts' && <Building2 size={14} />}
                    {tab === 'earnings' && <TrendingUp size={14} />}
                  </div>
                  <span>{tab}</span>
                </button>
              ))}
            </div>

            {adminTab === 'fleet' && (
              <div className="grid md:grid-cols-2 gap-3 sm:gap-6">
                {/* Left Column - Add New Vehicle Form */}
                <Card className="p-3 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-6 text-zinc-900 dark:text-white flex items-center gap-2">
                    <Plus size={16} className="text-green-500"/>
                    {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <Input label="Car Model" name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. Tesla Model 3" required data-testid="input-vehicle-model" />
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <Input label="Daily Rate ($)" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="e.g. 45" required data-testid="input-vehicle-price" />
                      <div className="mb-2 sm:mb-3">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fuel Type</label>
                        <select name="fuel" value={formData.fuel} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-fuel">
                          <option value="Gasoline">Gasoline</option>
                          <option value="Hybrid">Hybrid</option>
                          <option value="Electric">Electric</option>
                          <option value="Diesel">Diesel</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <Input label="Seats" name="seats" type="number" value={formData.seats} onChange={handleInputChange} placeholder="5" data-testid="input-vehicle-seats" />
                      <div className="mb-2 sm:mb-3">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Transmission</label>
                        <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-transmission">
                          <option value="Automatic">Automatic</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Drive Type</label>
                      <select name="driveType" value={formData.driveType} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-drive-type">
                        <option value="AWD">AWD (All-Wheel Drive)</option>
                        <option value="FWD">FWD (Front-Wheel Drive)</option>
                        <option value="RWD">RWD (Rear-Wheel Drive)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <Input label="Consumption / Range" name="consumption" value={formData.consumption} onChange={handleInputChange} placeholder="e.g. 300mi range" data-testid="input-vehicle-consumption" />
                      <div className="mb-2 sm:mb-3">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Category *</label>
                        <select name="category" value={formData.category} onChange={handleInputChange} required className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-category">
                          <option value="">Select Category</option>
                          <option value="SEDAN">SEDAN</option>
                          <option value="SUV">SUV</option>
                          <option value="HATCHBACK">HATCHBACK</option>
                          <option value="MINIVAN">MINIVAN</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Available Locations</label>
                      <div className="space-y-1">
                        {settings.locations.map(loc => (
                          <Checkbox key={loc} label={loc} checked={formData.availableLocations?.includes(loc)} onChange={(e: any) => {
                            const current = formData.availableLocations || [];
                            setFormData({...formData, availableLocations: e.target.checked ? [...current, loc] : current.filter(l => l !== loc)});
                          }} />
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider">Features</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 sm:gap-x-4 gap-y-1">
                        <Checkbox label="AWD / 4x4" name="isAWD" checked={formData.isAWD} onChange={handleInputChange} />
                        <Checkbox label="CarPlay / Auto" name="hasCarPlay" checked={formData.hasCarPlay} onChange={handleInputChange} />
                        <Checkbox label="Bluetooth" name="hasBluetooth" checked={formData.hasBluetooth} onChange={handleInputChange} />
                        <Checkbox label="Reverse Camera" name="hasReverseCamera" checked={formData.hasReverseCamera} onChange={handleInputChange} />
                        <Checkbox label="Heated Seats" name="hasHeatedSeats" checked={formData.hasHeatedSeats} onChange={handleInputChange} />
                        <Checkbox label="Heated Steering" name="hasHeatedSteering" checked={formData.hasHeatedSteering} onChange={handleInputChange} />
                        <Checkbox label="Electric Seats" name="hasElectricSeats" checked={formData.hasElectricSeats} onChange={handleInputChange} />
                        <Checkbox label="Paddle Shifters" name="hasPaddleShifters" checked={formData.hasPaddleShifters} onChange={handleInputChange} />
                        <Checkbox label="Keyless Entry" name="hasKeylessEntry" checked={formData.hasKeylessEntry} onChange={handleInputChange} />
                        <Checkbox label="Blind Spot Warning" name="hasBlindSpotWarning" checked={formData.hasBlindSpotWarning} onChange={handleInputChange} />
                        <Checkbox label="Drive Assist" name="hasDriveAssist" checked={formData.hasDriveAssist} onChange={handleInputChange} />
                        <Checkbox label="USB Charger" name="hasUSBCharger" checked={formData.hasUSBCharger} onChange={handleInputChange} />
                      </div>
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
                      <Input className="mt-3" placeholder="Or paste image URL..." value="" onChange={(e: any) => { if (e.target.value) setFormData({...formData, images: [...formData.images.filter(i => i), e.target.value]}); }} data-testid="input-vehicle-image-url" />
                    </div>

                    <Button onClick={handleSaveVehicle} className="w-full mt-4" data-testid="button-save-vehicle">
                      {editingId ? 'Update Vehicle' : 'Add Vehicle'}
                    </Button>
                    {editingId && <Button variant="ghost" onClick={() => { setFormData(initialFormState); setPricingStrings(defaultPricingStrings); setEditingId(null); }} className="w-full">Cancel</Button>}
                  </div>
                </Card>

                {/* Right Column - Locations, Pricing, Inventory */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Pickup Locations */}
                  <Card className="p-3 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <MapPin size={16} className="text-green-500"/>
                      Pickup Locations
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
                      <Input placeholder="New Location Name (e.g. Airport JFK)" value={newLocation} onChange={(e: any) => setNewLocation(e.target.value)} className="mb-0 flex-1" data-testid="input-new-location" />
                      <Button onClick={addLocation} variant="secondary" className="w-full sm:w-auto" data-testid="button-add-location">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                      {settings.locations.map(loc => (
                        <span key={loc} className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-full text-sm">
                          {loc}
                          <button onClick={() => removeLocation(loc)} className="text-zinc-400 hover:text-red-500 ml-1" data-testid={`button-remove-location-${loc}`}><X size={14}/></button>
                        </span>
                      ))}
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => {}}>Save Locations</Button>
                  </Card>

                  {/* Pricing Configuration */}
                  <Card className="p-3 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white">Pricing Configuration {editingId && `(${formData.model})`}</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="mb-3 w-full">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Sales Tax (%)</label>
                          <input type="text" inputMode="decimal" placeholder="e.g., 8.5" value={pricingStrings.taxes} onChange={(e: any) => setPricingStrings({...pricingStrings, taxes: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, taxes: val}}); setPricingStrings({...pricingStrings, taxes: String(val)})}} onFocus={() => { if (!pricingStrings.taxes) setPricingStrings({...pricingStrings, taxes: String(formData.pricing?.taxes || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-taxes" />
                        </div>
                        <div className="mb-3 w-full">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Cleaning Fee ($)</label>
                          <input type="text" inputMode="decimal" placeholder="e.g., 25" value={pricingStrings.cleaningFee} onChange={(e: any) => setPricingStrings({...pricingStrings, cleaningFee: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, cleaningFee: val}}); setPricingStrings({...pricingStrings, cleaningFee: String(val)})}} onFocus={() => { if (!pricingStrings.cleaningFee) setPricingStrings({...pricingStrings, cleaningFee: String(formData.pricing?.cleaningFee || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-cleaning" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="mb-3 w-full">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Included Miles / Day</label>
                          <input type="text" inputMode="numeric" placeholder="e.g., 200" value={pricingStrings.includedMiles} onChange={(e: any) => setPricingStrings({...pricingStrings, includedMiles: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0; setFormData({...formData, pricing: {...formData.pricing, includedMiles: val}}); setPricingStrings({...pricingStrings, includedMiles: String(val)})}} onFocus={() => { if (!pricingStrings.includedMiles) setPricingStrings({...pricingStrings, includedMiles: String(formData.pricing?.includedMiles || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-miles" />
                        </div>
                        <div className="mb-3 w-full">
                          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Extra Mile Rate ($)</label>
                          <input type="text" inputMode="decimal" placeholder="e.g., 0.45" value={pricingStrings.extraMileRate} onChange={(e: any) => setPricingStrings({...pricingStrings, extraMileRate: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, extraMileRate: val}}); setPricingStrings({...pricingStrings, extraMileRate: String(val)})}} onFocus={() => { if (!pricingStrings.extraMileRate) setPricingStrings({...pricingStrings, extraMileRate: String(formData.pricing?.extraMileRate || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-extra-rate" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-3 uppercase tracking-wider">Daily Add-on Rates</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Ins. $500</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 25" value={pricingStrings.insurance500} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance500: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, insurance500: val}}}); setPricingStrings({...pricingStrings, insurance500: String(val)})}} onFocus={() => { if (!pricingStrings.insurance500) setPricingStrings({...pricingStrings, insurance500: String(formData.pricing?.prices?.insurance500 || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-ins500" />
                          </div>
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Ins. $1000</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 15" value={pricingStrings.insurance1000} onChange={(e: any) => setPricingStrings({...pricingStrings, insurance1000: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, insurance1000: val}}}); setPricingStrings({...pricingStrings, insurance1000: String(val)})}} onFocus={() => { if (!pricingStrings.insurance1000) setPricingStrings({...pricingStrings, insurance1000: String(formData.pricing?.prices?.insurance1000 || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-ins1000" />
                          </div>
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Child Seat</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 8.50" value={pricingStrings.childSeat} onChange={(e: any) => setPricingStrings({...pricingStrings, childSeat: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, childSeat: val}}}); setPricingStrings({...pricingStrings, childSeat: String(val)})}} onFocus={() => { if (!pricingStrings.childSeat) setPricingStrings({...pricingStrings, childSeat: String(formData.pricing?.prices?.childSeat || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-child-seat" />
                          </div>
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Prepaid Fuel</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 35" value={pricingStrings.prepaidFuel} onChange={(e: any) => setPricingStrings({...pricingStrings, prepaidFuel: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, prepaidFuel: val}}}); setPricingStrings({...pricingStrings, prepaidFuel: String(val)})}} onFocus={() => { if (!pricingStrings.prepaidFuel) setPricingStrings({...pricingStrings, prepaidFuel: String(formData.pricing?.prices?.prepaidFuel || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-prepaid-fuel" />
                          </div>
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Late Return Grace</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 25" value={pricingStrings.lateReturnGrace} onChange={(e: any) => setPricingStrings({...pricingStrings, lateReturnGrace: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, lateReturnGrace: val}}}); setPricingStrings({...pricingStrings, lateReturnGrace: String(val)})}} onFocus={() => { if (!pricingStrings.lateReturnGrace) setPricingStrings({...pricingStrings, lateReturnGrace: String(formData.pricing?.prices?.lateReturnGrace || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-late-return" />
                          </div>
                          <div className="mb-3 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Stress-Free Pkg</label>
                            <input type="text" inputMode="decimal" placeholder="e.g., 50" value={pricingStrings.stressFreePackage} onChange={(e: any) => setPricingStrings({...pricingStrings, stressFreePackage: e.target.value})} onBlur={(e: any) => {const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0; setFormData({...formData, pricing: {...formData.pricing, prices: {...formData.pricing?.prices, stressFreePackage: val}}}); setPricingStrings({...pricingStrings, stressFreePackage: String(val)})}} onFocus={() => { if (!pricingStrings.stressFreePackage) setPricingStrings({...pricingStrings, stressFreePackage: String(formData.pricing?.prices?.stressFreePackage || '')}) }} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="input-pricing-stress-free" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Inventory - Collapsed List */}
                  <Card className="p-3 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white">Inventory ({vehicles.length})</h3>
                    <div className="space-y-2 sm:space-y-3 max-h-full overflow-y-auto">
                      {vehicles.map((car) => {
                        const hostOwner = hostsData.find(h => String(h.id) === car.hostId);
                        return (
                          <div key={car.id} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" data-testid={`card-admin-vehicle-${car.id}`}>
                            <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-12 h-12 object-cover rounded-lg" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{car.model}</h4>
                              <p className="text-xs text-zinc-500">{car.fuel} · {car.category} {hostOwner && <span className="text-blue-500 font-semibold">@{hostOwner.username}</span>}</p>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleEditVehicle(car)} className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors" data-testid={`button-edit-${car.id}`} title="Edit vehicle"><Edit size={14}/></button>
                              <button onClick={() => setDeletingVehicleId(car.id)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" data-testid={`button-delete-${car.id}`} title="Delete vehicle"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                </div>
              </div>
            )}

            {/* Delete Vehicle Confirmation Modal */}
            {deletingVehicleId !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Delete Vehicle?</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Are you sure you want to delete this vehicle? This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeletingVehicleId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-delete-vehicle">Cancel</button>
                    <button onClick={() => { deleteVehicleMutation.mutate(deletingVehicleId); setDeletingVehicleId(null); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors" data-testid="button-confirm-delete-vehicle">Yes, Delete</button>
                  </div>
                </div>
              </div>
            )}

            {/* Checkout By Admin Confirmation Modal */}
            {checkingOutByAdminBookingId !== null && bookings.find(b => b.id === checkingOutByAdminBookingId) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Complete Trip by Admin?</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">You are about to complete this trip. This will mark it as COMPLETED and finalize all charges. Continue?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setCheckingOutByAdminBookingId(null)} className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors" data-testid="button-cancel-checkout-admin">Cancel</button>
                    <button onClick={() => { 
                      const bookingToComplete = bookings.find(b => b.id === checkingOutByAdminBookingId);
                      if (bookingToComplete) {
                        updateBookingMutation.mutate({ id: bookingToComplete.id, data: { status: 'Completed', checkOutStatus: 'completed', checkOutData: bookingToComplete.checkOutData || { miles: '0', gas: 'Full', photosOutside: [], photosInside: [] } } });
                      }
                      setCheckingOutByAdminBookingId(null);
                    }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors" data-testid="button-confirm-checkout-admin">Yes, Complete</button>
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
                        return (
                          <div key={user.id} onClick={() => setSelectedClient(user)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedClient?.id === user.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-client-${user.id}`}>
                            <div className="font-bold text-sm text-white">{user.firstName} {user.lastName}</div>
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
                              clientTrips.map((trip, idx) => (
                                <div key={idx} className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-zinc-900 dark:text-white">{trip.carName}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${trip.status === 'Completed' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'}`}>{trip.status}</span>
                                  </div>
                                  <div className="text-zinc-500">{trip.startDate} to {trip.returnDate}</div>
                                  <div className="text-zinc-400">${trip.total.toFixed(2)}</div>
                                </div>
                              ))
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
                            <select value={editingHost.status} onChange={(e) => setEditingHost({...editingHost, status: e.target.value})} className="px-3 py-2 border border-zinc-700 rounded bg-zinc-800 text-white text-xs">
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="pending">Pending</option>
                            </select>
                          </div>
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
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">All Bookings</h3>
                  
                  {/* Filters */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Filter Bookings</label>
                      <select value={bookingFilterType} onChange={(e) => setBookingFilterType(e.target.value as 'end-soon' | 'start-first')} className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white" data-testid="select-booking-filter">
                        <option value="end-soon">End Soon (Next 3 Days)</option>
                        <option value="start-first">Start First</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {bookings
                      .sort((a, b) => {
                        if (bookingFilterType === 'end-soon') {
                          const aDateTime = new Date(`${a.returnDate}T${a.returnTime}`).getTime();
                          const bDateTime = new Date(`${b.returnDate}T${b.returnTime}`).getTime();
                          return aDateTime - bDateTime;
                        } else {
                          const aDateTime = new Date(`${a.startDate}T${a.startTime}`).getTime();
                          const bDateTime = new Date(`${b.startDate}T${b.startTime}`).getTime();
                          return aDateTime - bDateTime;
                        }
                      })
                      .map(b => {
                        const statusColor = b.status === 'Completed' ? 'bg-green-600 text-white' : (b.status === 'Active' || b.status === 'Extended') ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white';
                        const statusText = b.status === 'Completed' ? 'COMPLETED' : b.status === 'Active' ? 'ACTIVE' : b.status;
                        const pendingRequests = getPendingRequestsCount(b);
                        const unreadMessages = getUnreadMessagesCount(b, 'admin');
                        const hasNotifications = pendingRequests > 0 || unreadMessages > 0;
                        
                        const today = getTodayString();
                        const tomorrow = addDaysToDate(today, 1);
                        const returnDate = b.returnDate;
                        const pickupDate = b.startDate;
                        
                        const pickupIsToday = pickupDate === today;
                        const pickupIsTomorrow = pickupDate === tomorrow;
                        const returnIsToday = returnDate === today;
                        const returnIsTomorrow = returnDate === tomorrow;
                        
                        return (
                          <div key={b.id} onClick={() => setManageBookingId(b.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${manageBookingId === b.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-booking-${b.id}`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                {(pickupIsToday || pickupIsTomorrow || returnIsToday || returnIsTomorrow) && (
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
                              <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>{statusText}</span>
                            </div>
                            <div className="text-xs text-zinc-400 font-medium">{b.carName}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{b.driver.name}</div>
                            <div className="text-[10px] text-zinc-400 mt-2">
                              <div>Pickup: {b.startDate} at {b.startTime}</div>
                              <div>Return: {b.returnDate} at {b.returnTime}</div>
                              {(pickupIsToday || pickupIsTomorrow) && (
                                <div className={`text-[9px] font-bold ${pickupIsToday ? 'text-red-400' : 'text-yellow-400'}`}>
                                  Pickup {pickupIsToday ? 'TODAY ⚠️' : 'TOMORROW ⚠️'}
                                </div>
                              )}
                              {(returnIsToday || returnIsTomorrow) && (
                                <div className={`text-[9px] font-bold ${returnIsToday ? 'text-red-400' : 'text-yellow-400'}`}>
                                  Return {returnIsToday ? 'TODAY ⚠️' : 'TOMORROW ⚠️'}
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
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Customer</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.driver.name}</p>
                                <p className="text-zinc-500">{b.driver.phone}</p>
                                <p className="text-zinc-500">{b.driver.email}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Rental Information</h4>
                              <div className="text-sm text-zinc-900 dark:text-white space-y-0.5">
                                <p className="font-medium">{b.carName}</p>
                                <p className="text-zinc-500">{formatDisplayDate(b.startDate, b.startTime)} to {formatDisplayDate(b.returnDate, b.returnTime)}</p>
                                <p className="text-zinc-500">{b.location}</p>
                              </div>
                            </div>
                          </div>

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
                                const subtotalBeforeTax = rate + extras + protection + cleaningFee;
                                const originalTax = subtotalBeforeTax > 0 ? subtotalBeforeTax * ((settings.taxes || 0) / 100) : 0;
                                const originalBookingAmount = subtotalBeforeTax + originalTax;
                                
                                const extendedRate = b.details.extendedRate || 0;
                                const manualChargesTotal = (b.details.manualCharges || []).reduce((sum, c) => sum + c.amount, 0);
                                const extraPaymentsTotal = (b.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                                const discount = b.details.discount || 0;
                                const additionalChargesBeforeTax = extendedRate + manualChargesTotal + extraPaymentsTotal - discount;
                                const additionalTax = additionalChargesBeforeTax > 0 ? additionalChargesBeforeTax * ((settings.taxes || 0) / 100) : 0;
                                const additionalCharges = additionalChargesBeforeTax + additionalTax;
                                
                                return (
                                  <>
                                    {/* Original Booking Amount */}
                                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                                      <div className="text-xs font-bold uppercase text-zinc-400 mb-2">Original Booking Amount</div>
                                      <div className="space-y-1 mb-2">
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Base Rate</span>
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
                                            <span>Protection</span>
                                            <span>+${protection.toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-zinc-300 text-xs">
                                          <span>Cleaning Fee</span>
                                          <span>+${cleaningFee.toFixed(2)}</span>
                                        </div>
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
                                    {(extendedRate > 0 || manualChargesTotal > 0 || extraPaymentsTotal > 0 || discount > 0) && (
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
                                          {discount > 0 && (
                                            <div className="flex justify-between text-green-400 text-xs">
                                              <span className="flex items-center gap-1">
                                                Discount Applied
                                                <button 
                                                  onClick={() => handleRemoveDiscount(b)} 
                                                  className="text-red-400 hover:text-red-300"
                                                  data-testid="button-remove-discount"
                                                >
                                                  <X size={10}/>
                                                </button>
                                              </span>
                                              <span>-${discount.toFixed(2)}</span>
                                            </div>
                                          )}
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
                                      </div>
                                    )}

                                    {/* Final Total */}
                                    <div className="bg-green-950/30 rounded-lg p-3 border border-green-700">
                                      <div className="flex justify-between text-green-200 font-bold">
                                        <span>TOTAL BILLED</span>
                                        <span>${b.total.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    {/* Charge Extra Payment */}
                                    <div className="mt-4 pt-4 border-t border-zinc-700">
                                      <div className="text-xs text-zinc-500 mb-2">Charge Extras by original Payment Method</div>
                                      <div className="flex gap-2">
                                        <div className="relative flex-1">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                                          <input
                                            type="number"
                                            value={extraPaymentAmount}
                                            onChange={(e) => setExtraPaymentAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white"
                                            data-testid="input-extra-payment-amount"
                                          />
                                        </div>
                                        <button 
                                          onClick={() => handleChargeExtraPayment(b)}
                                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                                          data-testid="button-charge-extra-payment"
                                        >
                                          Charge Extra Payment Trip
                                        </button>
                                      </div>
                                    </div>
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
                                  {b.driver.licenseImages && b.driver.licenseImages.length > 0 ? (
                                    b.driver.licenseImages.map((img, i) => (
                                      <div key={i} className="w-16 h-12 rounded overflow-hidden border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(b.driver.licenseImages || [], i)}>
                                        <img src={img} alt={`License ${i+1}`} className="w-full h-full object-cover" />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-zinc-600">No images</div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Check-in Photos */}
                              <div>
                                <label className="text-xs text-green-500 mb-2 block">Check-in (Start)</label>
                                <div className="flex gap-2 flex-wrap">
                                  {b.checkInData?.photosOutside && b.checkInData.photosOutside.length > 0 ? (
                                    [...(b.checkInData.photosOutside || []), ...(b.checkInData.photosInside || [])].slice(0, 4).map((img, i, allPhotos) => (
                                      <div key={i} className="w-16 h-12 rounded overflow-hidden border border-green-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox([...(b.checkInData?.photosOutside || []), ...(b.checkInData?.photosInside || [])], i)}>
                                        <img src={img} alt={`Check-in ${i+1}`} className="w-full h-full object-cover" />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-zinc-600">No images</div>
                                  )}
                                  {b.checkInData?.photosOutside && ([...(b.checkInData.photosOutside || []), ...(b.checkInData.photosInside || [])].length > 4) && (
                                    <div className="w-16 h-12 rounded overflow-hidden border border-green-700 bg-green-900/50 flex items-center justify-center cursor-pointer hover:bg-green-900 transition-colors" onClick={() => openLightbox([...(b.checkInData?.photosOutside || []), ...(b.checkInData?.photosInside || [])], 4)}>
                                      <span className="text-xs text-green-400 font-bold">+{[...(b.checkInData.photosOutside || []), ...(b.checkInData.photosInside || [])].length - 4}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Check-out Photos */}
                              <div>
                                <label className="text-xs text-orange-500 mb-2 block">Check-out (End)</label>
                                <div className="flex gap-2 flex-wrap">
                                  {b.checkOutData?.photosOutside && b.checkOutData.photosOutside.length > 0 ? (
                                    [...(b.checkOutData.photosOutside || []), ...(b.checkOutData.photosInside || [])].slice(0, 4).map((img, i) => (
                                      <div key={i} className="w-16 h-12 rounded overflow-hidden border border-orange-700 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox([...(b.checkOutData?.photosOutside || []), ...(b.checkOutData?.photosInside || [])], i)}>
                                        <img src={img} alt={`Check-out ${i+1}`} className="w-full h-full object-cover" />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-zinc-600">No images</div>
                                  )}
                                  {b.checkOutData?.photosOutside && ([...(b.checkOutData.photosOutside || []), ...(b.checkOutData.photosInside || [])].length > 4) && (
                                    <div className="w-16 h-12 rounded overflow-hidden border border-orange-700 bg-orange-900/50 flex items-center justify-center cursor-pointer hover:bg-orange-900 transition-colors" onClick={() => openLightbox([...(b.checkOutData?.photosOutside || []), ...(b.checkOutData?.photosInside || [])], 4)}>
                                      <span className="text-xs text-orange-400 font-bold">+{[...(b.checkOutData.photosOutside || []), ...(b.checkOutData.photosInside || [])].length - 4}</span>
                                    </div>
                                  )}
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

                          {/* Pending Extension/Reduction Requests */}
                          {(b.extensionRequests || []).filter(r => r.status === 'pending').length > 0 && (
                            <div className="p-4 rounded-lg border bg-yellow-950/30 border-yellow-900/50">
                              <h4 className="text-xs font-bold uppercase flex items-center gap-2 mb-4 text-yellow-400">
                                <AlertCircle size={14}/> Pending Requests
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
                    <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <BarChart3 size={18}/> Financial Status by Vehicle
                    </h3>
                    
                    <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {vehicles.map(vehicle => {
                        const vehicleData = financialData?.byVehicle?.[vehicle.model] || { gross: 0, pending: 0, expenses: 0 };
                        const gross = (vehicleData.gross || 0) + (vehicleData.pending || 0);
                        const expenses = vehicleData.expenses || 0;
                        const balance = gross - expenses;
                        
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
                                    <h4 className="font-bold text-xs sm:text-sm text-white truncate">{vehicle.model}</h4>
                                    <p className="text-[8px] sm:text-[10px] text-zinc-500">{vehicle.category}</p>
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

              <div className="p-8 space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-300">
                    <span className="font-bold">Client Name: </span>{driverDetails.name}
                  </p>
                </div>

                <div className="prose dark:prose-invert max-w-none">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">VEHICLE RENTAL AGREEMENT</h3>
                  
                  <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                    <p><strong>This Car Rental Agreement ("Agreement")</strong> is entered into on this date between <strong>CarHop Rental Services</strong> ("Lessor") and <strong>{driverDetails.name}</strong> ("Lessee").</p>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">1. VEHICLE AND TERMS</h4>
                      <p>The Lessee agrees to lease a vehicle as specified in the rental confirmation. The lease term shall be from the pickup date and time until the return date and time specified in the booking.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">2. RENTAL PAYMENT</h4>
                      <p>The Lessee agrees to pay the total rental amount as quoted. Payment is due before or at the time of vehicle pickup. Additional charges may apply for late returns, excess mileage, fuel, or vehicle damage.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">3. DRIVER LICENSE AND LIABILITY</h4>
                      <p>The Lessee confirms that they hold a valid driver's license and are authorized to operate the vehicle. The Lessee assumes full responsibility for the vehicle and all liability during the rental period. The Lessee is responsible for all accidents, traffic violations, and damage to the vehicle.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">4. VEHICLE CONDITION</h4>
                      <p>The Lessee acknowledges receipt of the vehicle in good working condition and agrees to return it in the same condition. Any damage, scratches, or mechanical issues discovered will be charged to the Lessee.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">5. MILEAGE AND FUEL</h4>
                      <p>The Lessee is entitled to {activeBooking?.car?.pricing?.includedMiles || settings.includedMiles} miles per day included in the rental. Excess mileage will be charged at ${(activeBooking?.car?.pricing?.extraMileRate || settings.extraMileRate).toFixed(2)} per mile. The vehicle must be returned with a full fuel tank. Refueling charges will apply if the vehicle is returned with less fuel.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">6. INSURANCE AND PROTECTION</h4>
                      <p>The Lessee has selected a protection plan as detailed in the booking. This covers damage up to the specified franchise amount. The Lessee remains responsible for any damage exceeding the franchise limit.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">7. GOVERNING LAW - STATE OF CONNECTICUT</h4>
                      <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Connecticut, without regard to its conflict of law principles. The Lessee consents to the exclusive jurisdiction and venue of the federal and state courts located in Connecticut for any legal proceedings arising out of this Agreement.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">8. COMPLIANCE WITH LAWS</h4>
                      <p>The Lessee agrees to comply with all federal, state, and local laws while operating the vehicle, including speed limits, traffic regulations, and parking ordinances. The Lessee is responsible for all fines, tickets, or penalties incurred during the rental period.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">9. LIMITATION OF LIABILITY</h4>
                      <p>CarHop shall not be liable for any loss, damage, or injury to the Lessee or their belongings, except as provided by the selected protection plan. The Lessee assumes all risk associated with vehicle operation.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mt-4">10. ACKNOWLEDGMENT</h4>
                      <p>By accepting this agreement, the Lessee acknowledges that they have read, understood, and agree to all terms and conditions set forth herein. The Lessee assumes all responsibility and liability for the vehicle during the rental period.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex gap-3">
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

                <div className="p-8 space-y-8">
                  {/* Header */}
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-zinc-500 uppercase tracking-wider">Booking Code</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{receiptBooking.bookingCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase">Status</p>
                        <p className="text-lg font-bold text-green-600">Completed</p>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{receiptBooking.carName}</h3>
                    <p className="text-sm text-zinc-500 mt-2">{receiptBooking.location}</p>
                  </div>

                  {/* Rental Dates */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Pick-up</p>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">{formatDisplayDate(receiptBooking.startDate, receiptBooking.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Return</p>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">{formatDisplayDate(receiptBooking.returnDate, receiptBooking.returnTime)}</p>
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
                  {receiptBooking.checkInData?.photosOutside && receiptBooking.checkInData.photosOutside.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-in Photos ({receiptBooking.checkInData.photosOutside.length})</p>
                      <div className="grid grid-cols-3 gap-3">
                        {receiptBooking.checkInData.photosOutside.map((photo, idx) => (
                          <div key={idx} className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80" onClick={() => openLightbox(receiptBooking.checkInData?.photosOutside || [], idx)}>
                            <img src={photo} alt={`Check-in ${idx + 1}`} className="w-full h-32 object-cover"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Check-out Photos */}
                  {receiptBooking.checkOutData?.photosOutside && receiptBooking.checkOutData.photosOutside.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-out Photos ({receiptBooking.checkOutData.photosOutside.length})</p>
                      <div className="grid grid-cols-3 gap-3">
                        {receiptBooking.checkOutData.photosOutside.map((photo, idx) => (
                          <div key={idx} className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80" onClick={() => openLightbox(receiptBooking.checkOutData?.photosOutside || [], idx)}>
                            <img src={photo} alt={`Check-out ${idx + 1}`} className="w-full h-32 object-cover"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mileage Info */}
                  {receiptBooking.checkInData?.miles && receiptBooking.checkOutData?.miles && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase">Check-in Mileage</p>
                        <p className="text-lg font-bold text-zinc-900 dark:text-white">{receiptBooking.checkInData.miles} mi</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 uppercase">Check-out Mileage</p>
                        <p className="text-lg font-bold text-zinc-900 dark:text-white">{receiptBooking.checkOutData.miles} mi</p>
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
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-6">
                    {(() => {
                      const carForReceipt = vehicles.find(v => v.id === receiptBooking.vehicleId);
                      const cleaningFeeForReceipt = carForReceipt?.pricing?.cleaningFee || settings.cleaningFee;
                      
                      // Calculate initial payment
                      const rentalRate = receiptBooking.details?.rate || 0;
                      const protection = receiptBooking.details?.protection || 0;
                      const extras = receiptBooking.details?.extras || 0;
                      const tax = receiptBooking.details?.tax || 0;
                      const initialPayment = rentalRate + protection + extras + cleaningFeeForReceipt + tax;
                      
                      // Calculate additional charges
                      const extendedRate = receiptBooking.details?.extendedRate || 0;
                      const manualChargesTotal = (receiptBooking.details?.manualCharges || []).reduce((sum, c) => sum + c.amount, 0);
                      const extraPaymentsTotal = (receiptBooking.extraPayments || []).reduce((sum, p) => sum + p.amount, 0);
                      const additionalCharges = extendedRate + manualChargesTotal + extraPaymentsTotal;
                      
                      return (
                        <>
                          {/* Initial Payment Section */}
                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Initial Payment Breakdown</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-600 dark:text-zinc-400">Rental Rate ({receiptBooking.days} days)</span>
                                <span className="text-zinc-900 dark:text-white">${rentalRate.toFixed(2)}</span>
                              </div>
                              {protection > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-zinc-600 dark:text-zinc-400">Protection</span>
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
                              {tax > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                                  <span className="text-zinc-900 dark:text-white">+${tax.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                <span className="font-bold text-zinc-900 dark:text-white">Initial Payment</span>
                                <span className="font-bold text-zinc-900 dark:text-white">${initialPayment.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Charges Section */}
                          {additionalCharges > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Additional Charges</h4>
                              <div className="space-y-2">
                                {extendedRate > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-600 dark:text-zinc-400">Extended Days</span>
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
                              <span className="text-2xl font-bold text-green-600 dark:text-green-400">${receiptBooking.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <button onClick={() => setViewingReceiptBookingId(null)} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors mt-6" data-testid="button-close-receipt">Close Receipt</button>
                </div>
              </div>
            </div>
          );
        })()}

        {view === 'bookings' && (
          <div className="max-w-4xl mx-auto px-2 sm:px-6 py-12">
            <h2 className="text-3xl font-bold mb-8 text-zinc-900 dark:text-white" data-testid="text-my-bookings">My Bookings</h2>
            <div className="space-y-6">
              {bookings.length === 0 ? (
                <div className="text-center text-zinc-500 py-12">No active bookings found.</div>
              ) : (
                bookings.map((b) => (
                  <Card key={b.id} className="p-3 md:p-6" data-testid={`card-my-booking-${b.id}`}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 md:p-3 rounded-full flex-shrink-0 ${b.status === 'Completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}><Check size={14} className="md:w-6 md:h-6"/></div>
                        <div>
                          <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${b.status === 'Extended' || b.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{b.status}</div>
                          {b.status === 'Active' && b.checkInStatus !== 'completed' && (
                            <div className="text-xs text-green-600 font-semibold mt-1">*To start your trip you must complete the check in.</div>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-sm md:text-base text-zinc-900 dark:text-white">${b.total.toFixed(2)}</div>
                    </div>
                    <div className="flex-1 w-full">
                      <div className="text-xs md:text-sm font-bold text-blue-600">Pick-up: {formatDisplayDate(b.startDate, b.startTime)}</div>
                      <div className="text-xs md:text-sm font-bold text-orange-600 mt-1">Drop-off: {formatDisplayDate(b.returnDate, b.returnTime)}</div>
                      <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1"><Clock size={12} /> Grace period: +30 min</div>
                      <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-white mt-2">{b.carName}</h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">{b.days} Days | {b.location}</p>
                      
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
                          <div className="flex justify-between items-center"><h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Rental Summary</h4><button onClick={() => setViewingReceiptBookingId(b.id)} className="text-xs text-green-600 hover:text-green-400 font-bold" data-testid={`button-view-completed-${b.id}`}>View Receipt</button></div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
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

        {view === 'checkout' && cart.car && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <button onClick={() => setView('home')} className="flex items-center gap-2 text-zinc-400 hover:text-green-500 mb-6 transition-colors" data-testid="button-back-from-checkout">
              <ArrowLeft size={18} /> Back to Fleet
            </button>
            
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left Column - Forms */}
              <div className="lg:col-span-2 space-y-6">
                
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
                      data-testid="option-protection-gold"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-semibold text-white flex items-center gap-2">
                              Gold Protection 
                              {cart.insuranceOption === '500' && <Check size={16} className="text-green-500" />}
                            </h4>
                            <p className="text-xs text-zinc-500">$500 Deductible</p>
                          </div>
                        </div>
                        <span className="font-bold text-white">+${settings.prices.insurance500}/day</span>
                      </div>
                    </div>
                    <div 
                      onClick={() => setCart({...cart, insuranceOption: '1000'})} 
                      className={`p-4 rounded-lg cursor-pointer transition-all ${cart.insuranceOption === '1000' ? 'bg-zinc-800 border-2 border-green-500' : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'}`}
                      data-testid="option-protection-standard"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-semibold text-white flex items-center gap-2">
                              Standard Protection 
                              {cart.insuranceOption === '1000' && <Check size={16} className="text-green-500" />}
                            </h4>
                            <p className="text-xs text-zinc-500">$1,000 Deductible</p>
                          </div>
                        </div>
                        <span className="font-bold text-white">+${settings.prices.insurance1000}/day</span>
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
                    <div className="mt-6 pt-6 border-t border-zinc-700">
                      <div className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-lg">
                        <input 
                          type="checkbox" 
                          checked={carRentalAgreementAccepted} 
                          onChange={(e) => {
                            setCarRentalAgreementAccepted(e.target.checked);
                            if (e.target.checked) {
                              setViewingCarRentalOnly(false);
                              setShowCarRentalModal(true);
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
                  <div className="flex gap-2 mb-4">
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.category}</span>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{cart.car.fuel}</span>
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
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-800">
                    <span className="font-bold text-zinc-400">TOTAL</span>
                    <span className="text-3xl font-bold text-green-500" data-testid="text-checkout-total">${calculateTotal().total.toFixed(2)}</span>
                  </div>

                  {/* Proceed Button */}
                  <button 
                    onClick={handleProceedToPayment} 
                    disabled={!isCheckoutValid() || !carRentalAgreementAccepted} 
                    className={`w-full mt-6 py-4 rounded-lg font-bold text-sm transition-all ${isCheckoutValid() && carRentalAgreementAccepted ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}
                    data-testid="button-proceed-payment"
                  >
                    Proceed to Payment
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
                  <div className="flex gap-3 mb-6">
                    {['visa', 'mastercard', 'amex', 'discover'].map(type => (
                      <div 
                        key={type} 
                        onClick={() => setPaymentDetails({...paymentDetails, type})} 
                        className={`cursor-pointer border px-3 py-2 rounded-lg transition-all ${paymentDetails.type === type ? 'border-green-500 bg-green-900/20' : 'border-zinc-700 hover:border-zinc-600'}`}
                      >
                        <span className="uppercase font-bold text-xs text-zinc-400">{type}</span>
                      </div>
                    ))}
                  </div>
                  <div>
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
                    <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CARD NUMBER</label>
                    <input 
                      type="text"
                      value={paymentDetails.cardNumber} 
                      onChange={(e: any) => setPaymentDetails({...paymentDetails, cardNumber: e.target.value})} 
                      placeholder="4242 4242 4242 4242"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors" 
                      data-testid="input-card-number" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">EXPIRY</label>
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
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Outside Photos <span className="text-red-500">* (min 1 photo)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosOutside.map((p, i) => (<div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-green-500"><img src={p} className="w-full h-full object-cover"/></div>))}
                    {checkData.photosOutside.length < 1 && <button onClick={() => triggerCheckInput('outside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-outside"><Camera size={20}/></button>}
                    <input id="check-input-outside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'outside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosOutside.length}/1 photo uploaded</p>
                </div>
                
                {/* 2. Inside Photos - Second */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Inside Photos <span className="text-red-500">* (min 1 photo)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosInside.map((p, i) => (<div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-green-500"><img src={p} className="w-full h-full object-cover"/></div>))}
                    {checkData.photosInside.length < 1 && <button onClick={() => triggerCheckInput('inside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-inside"><Camera size={20}/></button>}
                    <input id="check-input-inside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'inside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosInside.length}/1 photo uploaded</p>
                </div>
                
                {/* 3. Current Mileage - Third */}
                <Input label="Current Mileage" type="number" value={checkData.miles} onChange={(e: any) => setCheckData({...checkData, miles: e.target.value})} placeholder="e.g. 45000" required data-testid="input-check-miles" />
                
                {/* 4. Fuel Level - Fourth (Last) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Fuel Level</label>
                  <div className="flex gap-2">{['Full', '3/4', '1/2', '1/4', 'Empty'].map(level => (<button key={level} onClick={() => setCheckData({...checkData, gas: level})} className={`flex-1 py-2 rounded border text-sm font-bold ${checkData.gas === level ? 'bg-green-600 text-white border-green-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`} data-testid={`button-gas-${level}`}>{level}</button>))}</div>
                </div>
                
                {(() => {
                  const canComplete = checkData.photosOutside.length === 1 && checkData.photosInside.length === 1 && checkData.miles && checkData.gas;
                  
                  const calculateCheckoutCharges = () => {
                    if (!isCheckOutMode || !activeBooking?.checkInData) return { excessMileageFee: 0, refuelingFee: 0, totalDifference: 0 };
                    
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
                    
                    return { excessMileageFee, refuelingFee, totalDifference: excessMileageFee + refuelingFee };
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
                              <span className="text-orange-600 dark:text-orange-400">Extra Miles Charged</span>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Pickup Date</label>
                        <input type="date" min={getTodayString()} value={carDetailsBooking.startDate} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, startDate: e.target.value})} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="input-cardetail-startdate" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Pickup Time</label>
                        <select value={carDetailsBooking.startTime} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, startTime: e.target.value})} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="select-cardetail-starttime">
                          {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Return Date</label>
                        <input type="date" value={carDetailsBooking.endDate} onChange={(e) => setCarDetailsBooking({...carDetailsBooking, endDate: e.target.value})} min={carDetailsBooking.startDate} className="w-full px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-white text-xs" data-testid="input-cardetail-enddate" />
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
                      <div><h4 className="font-bold text-green-800 dark:text-green-400">Price Match Guarantee</h4><p className="text-xs text-green-600 dark:text-green-500">Find a lower price? We'll match it!</p></div>
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
    </div>
    </div>
  );
}
