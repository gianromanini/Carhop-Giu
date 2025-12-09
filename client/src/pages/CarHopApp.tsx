import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Car, Settings, Plus, Trash2, Check, Calendar, Leaf, DollarSign, ArrowLeft, Shield, Mountain, Smartphone, Gauge, Zap, Edit, X, Image, ChevronRight, ChevronLeft, Info, Search, MapPin, User, Menu, Users, Activity, Phone, Sun, Moon, Clock, LogOut, Map, Bluetooth, Camera, Route, Upload, Mail, FileText, Download, CreditCard, AlertTriangle, CalendarClock, Lock, Fuel, Loader, Briefcase, List, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut, Move, Thermometer, Unlock, BatteryCharging, Armchair, Navigation, BarChart3, TrendingUp, Wallet, Receipt, MoreHorizontal
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
    return `${hours}:${minutes}`;
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
    <div 
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center overflow-hidden select-none"
      onWheel={handleWheel}
    >
       <div 
         className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-move active:cursor-grabbing"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onDoubleClick={toggleZoom}
       >
         <img 
           src={src} 
           style={{ 
             transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
             transition: isDragging ? 'none' : 'transform 0.2s ease-out'
           }}
           className="max-w-full max-h-[85vh] object-contain"
           draggable={false}
           alt=""
         />
       </div>

       <div className="absolute bottom-8 flex items-center gap-4 bg-zinc-900/80 backdrop-blur p-3 rounded-full border border-zinc-700 text-white">
          <button onClick={() => {setScale(Math.max(1, scale - 0.5)); if(scale<=1.5) setPosition({x:0,y:0});}} className="p-2 hover:bg-zinc-700 rounded-full"><ZoomOut size={20}/></button>
          <span className="text-xs font-mono w-12 text-center">{(scale * 100).toFixed(0)}%</span>
          <button onClick={() => setScale(Math.min(4, scale + 0.5))} className="p-2 hover:bg-zinc-700 rounded-full"><ZoomIn size={20}/></button>
          <div className="w-px h-4 bg-zinc-700 mx-1"></div>
          <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="p-2 hover:bg-zinc-700 rounded-full" title="Reset"><Maximize2 size={18}/></button>
       </div>

       <button 
         className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all z-50"
         onClick={onClose}
       >
         <X size={32} />
       </button>
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
            {images.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}></div>
            ))}
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
  return (
    <button onClick={disabled ? undefined : onClick} type={type} className={`${baseStyle} ${variantClass} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
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
  const allValues = Object.values(data).flatMap((d: any) => [d.gross, d.expenses, Math.abs(d.net)]);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1000;
  
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="w-full mt-6 select-none overflow-x-auto">
        <div className="flex items-end justify-between gap-4 h-64 w-full pb-0 border-b border-zinc-200 dark:border-zinc-800 min-w-[600px]">
        {monthOrder.map((label) => {
            const monthData = data[label] || { gross: 0, expenses: fixedExpenses, net: -fixedExpenses };
            const gross = monthData.gross || 0;
            const expenses = fixedExpenses > 0 ? fixedExpenses : (monthData.expenses || 0); 
            const net = gross - expenses;

            const hGross = Math.max((gross / maxVal) * 100, 2);
            const hExpenses = Math.max((expenses / maxVal) * 100, 2);
            const hNet = Math.max((Math.abs(net) / maxVal) * 100, 2);

            return (
            <div key={label} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-[40px]">
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-zinc-900/90 text-white text-[10px] p-2 rounded shadow-xl z-20 w-32 text-center backdrop-blur-sm border border-zinc-700">
                    <div className="font-bold text-xs border-b border-zinc-700 pb-1 mb-1">{label} Financials</div>
                    <div className="flex justify-between"><span className="text-red-400">Exp:</span> <span>${expenses.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-green-400">Gross:</span> <span>${gross.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span className="text-blue-400">Net:</span> <span>${net.toLocaleString()}</span></div>
                </div>

                <div className="flex items-end gap-[2px] w-full h-full justify-center opacity-90 hover:opacity-100 transition-opacity">
                    <div className="w-1/3 bg-red-500 rounded-t-sm transition-all relative group/bar" style={{ height: `${hExpenses}%` }}></div>
                    <div className="w-1/3 bg-green-500 rounded-t-sm transition-all relative group/bar" style={{ height: `${hGross}%` }}></div>
                    <div className={`w-1/3 rounded-t-sm transition-all relative group/bar ${net >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ height: `${hNet}%` }}></div>
                </div>
            </div>
            );
        })}
        </div>
        <div className="flex justify-center gap-6 mt-4 text-xs font-bold text-zinc-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Expenses</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Gross Revenue</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Net Profit</div>
        </div>
        <div className="flex justify-between gap-4 mt-2 min-w-[600px]">
            {monthOrder.map(label => (
                <div key={label} className="flex-1 text-center">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
                </div>
            ))}
        </div>
    </div>
  );
};

interface VehicleType {
  id: string;
  name: string;
  category: string;
  image: string;
  images?: string[];
  pricePerDay: number;
  payNowPrice: number;
  mpg: number;
  passengers: number;
  transmission: string;
  drivetrain: string;
  luggage: number;
  fuelEfficient: boolean;
  available: boolean;
  fuel?: string;
  isAWD?: boolean;
  hasBluetooth?: boolean;
  hasCarPlay?: boolean;
  hasReverseCamera?: boolean;
  hasHeatedSeats?: boolean;
  expenses?: {
    lease: number;
    insurance: number;
    carWash: number;
    maintenance: number;
    trackApp: number;
    downPayment: number;
  };
}

interface BookingType {
  id: string;
  date: string;
  status: string;
  carName: string;
  location: string;
  startDate: string;
  startTime: string;
  returnDate: string;
  returnTime: string;
  days: number;
  total: number;
  image: string;
  driver: {
    name: string;
    phone: string;
    email: string;
    licenseNumber: string;
    licenseImages: string[];
  };
  paymentRaw: {
    cardName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
    type: string;
  };
  paymentMethod: string;
  details: {
    rate: number;
    extras: number;
    protection: number;
    fees: number;
    tax: number;
    discount?: number;
    extendedRate?: number;
    manualCharges?: { type: string; amount: number }[];
  };
  checkInStatus: string;
  checkOutStatus: string;
  checkInData: any;
  checkOutData: any;
}

const initialFormState = { 
  model: '', category: '', price: '', fuel: 'Gasoline', seats: 5, transmission: 'Automatic', images: [''], features: '', consumption: '', 
  isPriceMatch: false, 
  isAWD: false, hasCarPlay: false, hasBluetooth: false, hasReverseCamera: false,
  hasHeatedSeats: false, hasHeatedSteering: false, hasElectricSeats: false, hasPaddleShifters: false,
  hasKeylessEntry: false, hasBlindSpotWarning: false, hasDriveAssist: false, hasUSBCharger: false 
};

const initialCheckState = { photosOutside: [] as string[], photosInside: [] as string[], miles: '', gas: 'Full' };
const initialExpenseState = { carId: '', lease: '', insurance: '', carWash: '', maintenance: '', trackApp: '', downPayment: '' };

const mockBookings: BookingType[] = [
  { 
    id: 'BK-5582', 
    date: 'Nov 15, 2023', 
    status: 'Completed', 
    carName: 'Tesla Model 3', 
    location: 'JFK Airport Drop-off', 
    startDate: '2023-11-15',
    startTime: '10:00 AM', 
    returnDate: '2023-11-18', 
    returnTime: '10:00 AM', 
    days: 3, 
    total: 583.50, 
    image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=500&q=60', 
    driver: { 
      name: "Carlos Silva", 
      phone: "(203) 555-0123", 
      email: "carlos.silva@email.com",
      licenseNumber: "CT-99887766",
      licenseImages: ["https://images.unsplash.com/photo-1562564055-71e051d33c19?w=500&q=80"]
    }, 
    paymentRaw: { cardName: "CARLOS SILVA", cardNumber: "4242 4242 4242 4242", expiry: "12/28", cvc: "123", type: "visa" },
    paymentMethod: "Credit Card (Visa **** 4242)", 
    details: { rate: 450, extras: 24, protection: 45, fees: 25, tax: 39.5, manualCharges: [{ type: "Gas Refill", amount: 30 }] },
    checkInStatus: 'completed', 
    checkOutStatus: 'completed',
    checkInData: { miles: 10000, gas: 'Full', photosOutside: [], photosInside: [] },
    checkOutData: { miles: 10850, gas: '1/4', photosOutside: [], photosInside: [] } 
  },
  {
    id: 'BK-5583', date: 'Nov 20, 2023', status: 'Active', carName: 'Toyota RAV4', location: 'Downtown Center',
    startDate: '2023-11-20', startTime: '09:00 AM', returnDate: '2023-11-25', returnTime: '09:00 AM', days: 5, total: 450.00,
    image: 'https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=500&q=60',
    driver: { name: "Ana Pereira", phone: "(212) 555-9988", email: "ana.p@email.com", licenseNumber: "NY-11223344", licenseImages: [] },
    paymentRaw: { cardName: "ANA PEREIRA", cardNumber: "5555 4444 3333 2222", expiry: "10/25", cvc: "456", type: "mastercard" },
    paymentMethod: "Credit Card (Mastercard **** 2222)",
    details: { rate: 325, extras: 0, protection: 75, fees: 25, tax: 25, manualCharges: [] },
    checkInStatus: 'completed', checkOutStatus: 'pending', checkInData: { miles: 5000, gas: 'Full', photosOutside: [], photosInside: [] }, checkOutData: null
  }
];

export default function CarHopApp() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('home');
  const [darkMode, setDarkMode] = useState(true);
  const [adminTab, setAdminTab] = useState('fleet');
  
  const [clientUser, setClientUser] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  const [searchParams, setSearchParams] = useState({ location: '', start: '', startTime: '10:00 AM', end: '', endTime: '10:00 AM' });
  const [isSearching, setIsSearching] = useState(false);

  const [driverDetails, setDriverDetails] = useState({ name: '', email: '', phone: '', licenseNumber: '', licenseImages: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkInInputRef = useRef<HTMLInputElement>(null);
  const carImageInputRef = useRef<HTMLInputElement>(null);

  const [paymentDetails, setPaymentDetails] = useState({ cardName: '', cardNumber: '', expiry: '', cvc: '', type: 'visa' });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  
  const [bookings, setBookings] = useState<BookingType[]>(mockBookings);
  const [receiptBooking, setReceiptBooking] = useState<BookingType | null>(null);
  const [extendingBookingId, setExtendingBookingId] = useState<string | null>(null);
  const [extensionDate, setExtensionDate] = useState('');
  const [extensionTime, setExtensionTime] = useState('10:00 AM');
  const [manageBookingId, setManageBookingId] = useState<string | null>(null);
  
  const [activeBooking, setActiveBooking] = useState<BookingType | null>(null);
  const [checkData, setCheckData] = useState(initialCheckState);
  const [isCheckOutMode, setIsCheckOutMode] = useState(false);

  const [adjustment, setAdjustment] = useState({ type: 'amount', value: '' });
  const [extraCharge, setExtraCharge] = useState({ type: 'Gas Refill', amount: '' });

  const [settings, setSettings] = useState({ 
    taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, 
    prices: { insurance500: 25, insurance1000: 15, childSeat: 8 },
    locations: ['JFK Airport', 'Downtown Center', 'Fairfield County'] 
  });
  const [newLocation, setNewLocation] = useState('');

  const [cart, setCart] = useState<{ car: VehicleType | null; days: number; billingDays: number; extrasSelected: string[]; insuranceOption: string }>({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' });
  const [viewCar, setViewCar] = useState<VehicleType | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [expenseForm, setExpenseForm] = useState(initialExpenseState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEco, setShowEco] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery<VehicleType[]>({
    queryKey: ['/api/vehicles'],
  });

  const cars = vehicles.map(v => ({
    ...v,
    model: v.name,
    price: v.payNowPrice,
    fuel: v.fuelEfficient ? 'Hybrid' : 'Gasoline',
    seats: v.passengers,
    isAWD: v.drivetrain === 'AWD',
    images: v.image ? [v.image] : [],
  }));

  useEffect(() => {
    const today = getTodayString();
    const nextTime = getNext30MinSlot();
    const returnDay = addDaysToDate(today, 3);
    setSearchParams({ location: '', start: today, startTime: nextTime, end: returnDay, endTime: nextTime });
  }, []);

  const earningsData = useMemo(() => {
    const monthlyData: Record<string, { gross: number; expenses: number; net: number }> = {};
    const vehicleTotals: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    monthNames.forEach(m => monthlyData[m] = { gross: 0, expenses: 0, net: 0 });

    const totalFleetFixedExpenses = cars.reduce((sum, car) => {
        const carExp = car.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0 };
        return sum + (Number(carExp.lease)||0) + (Number(carExp.insurance)||0) + (Number(carExp.carWash)||0) + (Number(carExp.maintenance)||0) + (Number(carExp.trackApp)||0);
    }, 0);

    bookings.forEach(b => {
      if (['Completed', 'Active', 'Extended'].includes(b.status)) {
         const [y, m, d] = b.startDate.split('-').map(Number);
         const monthIndex = m - 1; 
         if (monthIndex >= 0 && monthIndex < 12) {
             const monthKey = monthNames[monthIndex];
             monthlyData[monthKey].gross += b.total;
         }

         const carKey = b.carName;
         if (!vehicleTotals[carKey]) vehicleTotals[carKey] = 0;
         vehicleTotals[carKey] += b.total;
      }
    });
    
    monthNames.forEach(m => {
        monthlyData[m].expenses = totalFleetFixedExpenses;
        monthlyData[m].net = monthlyData[m].gross - totalFleetFixedExpenses;
    });

    return { monthly: monthlyData, byVehicle: vehicleTotals, fixedMonthly: totalFleetFixedExpenses };
  }, [bookings, cars]);

  const handleClientLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.email) {
      const newUser = { name: isRegistering ? loginForm.name : "Client User", email: loginForm.email, phone: loginForm.phone };
      setClientUser(newUser);
      setDriverDetails(prev => ({ ...prev, name: newUser.name, email: newUser.email, phone: newUser.phone || '' }));
      setShowLoginModal(false);
      if (view === 'manage-redirect') setView('bookings');
    }
  };

  const handleSocialLogin = (provider: string) => {
    const mockUsers: Record<string, { name: string; email: string }> = { google: { name: "Google User", email: "user@gmail.com" }, apple: { name: "Apple User", email: "user@icloud.com" } };
    const newUser = mockUsers[provider] || { name: "User", email: "user@email.com" };
    setClientUser(newUser);
    setDriverDetails(prev => ({ ...prev, name: newUser.name, email: newUser.email }));
    setShowLoginModal(false);
    if (view === 'manage-redirect') setView('bookings');
  };

  const handleAdminLogin = () => { setShowLoginModal(false); setView('admin'); };
  const handleManageBookingClick = () => { if (clientUser) { setView('bookings'); } else { setView('manage-redirect'); setShowLoginModal(true); } };
  const handleSignOut = () => { setClientUser(null); setDriverDetails({ name: '', email: '', phone: '', licenseNumber: '', licenseImages: [] }); setView('home'); };
  
  const handleSearch = () => { 
    if (!searchParams.location) { alert("Please select a Pick-up Location."); return; } 
    setIsSearching(true); 
    setTimeout(() => { 
      setIsSearching(false); 
      const fleetSection = document.getElementById('fleet'); 
      if (fleetSection) fleetSection.scrollIntoView({behavior:'smooth'}); 
    }, 1500); 
  };
  
  const handleViewDetails = (car: any) => {
    setViewCar(car);
    setView('car-details');
    window.scrollTo(0, 0);
  };

  const handleImageClick = (src: string) => { setSelectedImage(src); };

  const handleLicenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDriverDetails(prev => { 
        if (prev.licenseImages.length >= 2) return prev; 
        return { ...prev, licenseImages: [...prev.licenseImages, reader.result as string] }; 
      });
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

  const handleRent = (car: any) => { 
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
    let runningTotal = cart.car.price * days; 
    if (cart.extrasSelected.includes('childSeat')) runningTotal += (settings.prices.childSeat * days); 
    if (cart.insuranceOption === '500') runningTotal += (settings.prices.insurance500 * days); 
    if (cart.insuranceOption === '1000') runningTotal += (settings.prices.insurance1000 * days); 
    runningTotal += settings.cleaningFee; 
    const taxAmount = runningTotal * (settings.taxes / 100); 
    return { subtotal: runningTotal, taxAmount, total: runningTotal + taxAmount }; 
  };

  const handleProceedToPayment = () => { 
    if (!isCheckoutValid()) { alert("Please complete all mandatory fields and upload driver license photos."); return; } 
    setView('payment'); 
  };

  const isCheckoutValid = () => { 
    return ( driverDetails.name && driverDetails.email && driverDetails.phone && driverDetails.licenseNumber && driverDetails.licenseImages.length >= 2 ); 
  };

  const handleConfirmBooking = () => { 
    if (!paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvc || !paymentDetails.cardName) { alert("Please enter valid payment details."); return; } 
    setIsProcessingPayment(true); 
    const totalData = calculateTotal(); 
    const days = isNaN(cart.billingDays) ? 1 : cart.billingDays;
    
    const newBooking: BookingType = { 
      id: 'BK-' + Math.floor(Math.random() * 10000), 
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      status: 'Active', 
      carName: cart.car!.model || cart.car!.name, 
      location: searchParams.location || 'Main Office', 
      startDate: searchParams.start, 
      startTime: searchParams.startTime, 
      returnDate: searchParams.end, 
      returnTime: searchParams.endTime, 
      days: days, 
      total: totalData.total, 
      image: cart.car!.images?.[0] || cart.car!.image, 
      driver: { name: driverDetails.name, phone: driverDetails.phone, email: driverDetails.email, licenseNumber: driverDetails.licenseNumber, licenseImages: driverDetails.licenseImages }, 
      paymentRaw: { cardName: paymentDetails.cardName, cardNumber: paymentDetails.cardNumber, expiry: paymentDetails.expiry, cvc: paymentDetails.cvc, type: paymentDetails.type }, 
      paymentMethod: `${paymentDetails.type.toUpperCase()} **** ${paymentDetails.cardNumber.slice(-4)}`, 
      details: { 
        rate: cart.car!.price * days, 
        extras: (cart.extrasSelected.includes('childSeat') ? settings.prices.childSeat * days : 0), 
        protection: (cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * days, 
        fees: settings.cleaningFee, 
        tax: totalData.taxAmount 
      }, 
      checkInStatus: 'pending', 
      checkOutStatus: 'pending', 
      checkInData: null, 
      checkOutData: null 
    }; 
    setTimeout(() => { setBookings([newBooking, ...bookings]); setIsProcessingPayment(false); setView('confirmation'); window.scrollTo(0, 0); }, 3000); 
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 4) val = val.slice(0, 4); 
    if (val.length > 2) { val = val.slice(0, 2) + '/' + val.slice(2); } 
    setPaymentDetails({ ...paymentDetails, expiry: val }); 
  };

  const handleStartWorkflow = (booking: BookingType, mode: string) => {
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
        if (currentList.length >= 10) return prev;
        return { ...prev, [section === 'outside' ? 'photosOutside' : 'photosInside']: [...currentList, reader.result as string] };
      });
      reader.readAsDataURL(file);
    }
    if (checkInInputRef.current) checkInInputRef.current.value = '';
  };

  const triggerCheckInput = (section: string) => document.getElementById(`check-input-${section}`)?.click();

  const completeWorkflow = () => {
     if (!checkData.miles) { alert("Please enter current mileage."); return; }
     if (checkData.photosOutside.length === 0 || checkData.photosInside.length === 0) { alert("Please upload at least one photo for both Inside and Outside."); return; }

     const updatedBookings = bookings.map(b => {
       if (b.id === activeBooking?.id) {
         let updatedB = { ...b };
         if (isCheckOutMode) {
           const checkInMiles = parseInt(b.checkInData?.miles || 0);
           const checkOutMiles = parseInt(checkData.miles || '0');
           const allowedMiles = settings.includedMiles * b.days;
           const milesDriven = checkOutMiles - checkInMiles;
           const excessMiles = Math.max(0, milesDriven - allowedMiles);
           const excessMileageFee = excessMiles * settings.extraMileRate;
           const gasInLevel = getGasValue(b.checkInData?.gas);
           const gasOutLevel = getGasValue(checkData.gas);
           const gasDiff = Math.max(0, gasInLevel - gasOutLevel);
           const refuelingFee = gasDiff * 10; 
           updatedB.checkOutStatus = 'completed';
           updatedB.checkOutData = checkData;
           updatedB.status = 'Completed';
           const safeExcess = isNaN(excessMileageFee) ? 0 : excessMileageFee;
           const safeRefuel = isNaN(refuelingFee) ? 0 : refuelingFee;
           updatedB.details = { ...updatedB.details, excessMileageFee: safeExcess as any, refuelingFee: safeRefuel as any };
           updatedB.total += safeExcess + safeRefuel;
         } else {
           updatedB.checkInStatus = 'completed'; 
           updatedB.checkInData = checkData;
         }
         return updatedB;
       }
       return b;
     });
     setBookings(updatedBookings);
     setView('workflow-success');
  };

  const initExtension = (booking: BookingType) => { 
    setExtendingBookingId(booking.id); 
    setExtensionDate(booking.returnDate); 
    setExtensionTime('10:00 AM');
  };

  const confirmExtension = (booking: BookingType) => {
    if (!extensionDate) return;
    
    const oldTimeStr = booking.returnTime || "10:00 AM";
    const oldDateTimeStr = `${booking.returnDate}T${convertTo24Hour(oldTimeStr)}:00`;
    const newDateTimeStr = `${extensionDate}T${convertTo24Hour(extensionTime)}:00`;
    
    const oldReturn = new Date(oldDateTimeStr);
    const newReturn = new Date(newDateTimeStr);
    
    const diffTime = newReturn.getTime() - oldReturn.getTime();
    
    if (diffTime < 0) {
        alert("New return time cannot be before current return time.");
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

    const baseRate = parseFloat(String(booking.details.rate)) || 0;
    const currentExtended = parseFloat(String(booking.details.extendedRate)) || 0;
    const currentDays = parseInt(String(booking.days)) || 1;
    
    const dailyRate = (baseRate + currentExtended) / currentDays;
    
    const extraCost = dailyRate * extraDays;
    const extraTax = extraCost * (settings.taxes / 100);
    const totalExtra = extraCost + extraTax;
    
    const updatedBookings = bookings.map(b => {
      if (b.id === booking.id) {
        const currentTotal = parseFloat(String(b.total)) || 0;
        return {
          ...b,
          returnDate: extensionDate,
          returnTime: extensionTime,
          days: currentDays + extraDays,
          total: currentTotal + totalExtra,
          status: 'Extended',
          details: { 
              ...b.details, 
              extendedRate: (b.details.extendedRate || 0) + extraCost,
              tax: (b.details.tax || 0) + extraTax 
          }
        };
      }
      return b;
    });
    setBookings(updatedBookings); 
    setExtendingBookingId(null); 
    if (extraDays > 0) {
       alert(`Rental updated by ${extraDays} days until ${extensionDate} at ${extensionTime}.\nAdjustment Cost: $${totalExtra.toFixed(2)}`);
    }
  };

  const handleApplyDiscount = (bookingId: string) => {
    const updatedBookings = bookings.map(b => {
        if (b.id === bookingId) {
            const val = parseFloat(adjustment.value);
            if (isNaN(val) || val <= 0) return b;
            let discountAmount = 0;
            if (adjustment.type === 'amount') discountAmount = val;
            else discountAmount = b.total * (val / 100);
            return { ...b, total: b.total - discountAmount, details: { ...b.details, discount: (b.details.discount || 0) + discountAmount } };
        }
        return b;
    });
    setBookings(updatedBookings); 
    setAdjustment({ type: 'amount', value: '' }); 
    alert("Discount Applied!");
  };

  const handleAddCharge = (bookingId: string) => {
    const updatedBookings = bookings.map(b => {
        if (b.id === bookingId) {
            const val = parseFloat(extraCharge.amount);
            if (isNaN(val) || val <= 0) return b;
            const newTotal = b.total + val;
            const newDetails = { ...b.details, manualCharges: [...(b.details.manualCharges || []), { type: extraCharge.type, amount: val }] };
            return { ...b, total: newTotal, details: newDetails };
        }
        return b;
    });
    setBookings(updatedBookings); 
    setExtraCharge({ type: 'Gas Refill', amount: '' }); 
    alert(`Charged $${extraCharge.amount} for ${extraCharge.type} to card on file.`);
  };

  const handleRemoveCharge = (bookingId: string, chargeIndex: number) => {
    const updatedBookings = bookings.map(b => {
        if (b.id === bookingId && b.details.manualCharges) {
            const chargeToRemove = b.details.manualCharges[chargeIndex];
            const newTotal = b.total - chargeToRemove.amount;
            const newCharges = b.details.manualCharges.filter((_, index) => index !== chargeIndex);
            
            const newDetails = { ...b.details, manualCharges: newCharges };
            return { ...b, total: newTotal, details: newDetails };
        }
        return b;
    });
    setBookings(updatedBookings);
  };

  const handleRemoveDiscount = (bookingId: string) => {
    const updatedBookings = bookings.map(b => {
        if (b.id === bookingId && b.details.discount) {
            const newTotal = b.total + b.details.discount;
            const newDetails = { ...b.details };
            delete newDetails.discount;
            return { ...b, total: newTotal, details: newDetails };
        }
        return b;
    });
    setBookings(updatedBookings);
  };

  const handlePrintReceipt = () => { window.print(); };

  const addLocation = () => { 
    if (newLocation.trim()) { 
      setSettings(prev => ({ ...prev, locations: [...(prev.locations || []), newLocation.trim()] })); 
      setNewLocation(''); 
    } 
  };

  const removeLocation = (locToRemove: string) => { 
    setSettings(prev => ({ ...prev, locations: prev.locations.filter(l => l !== locToRemove) })); 
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-black text-green-600">Loading CarHop...</div>;

  return (
    <div className={darkMode ? "dark" : ""}>
      <style>{` @media print { body * { visibility: hidden; } .printable-receipt, .printable-receipt * { visibility: visible; } .printable-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; margin: 0 !important; padding: 20px !important; background-color: white !important; color: black !important; box-shadow: none !important; border: none !important; z-index: 9999; } .no-print { display: none !important; } } `}</style>
    <div className="min-h-screen bg-gray-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-green-500 selection:text-white transition-colors duration-300">
      
      <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-green-600 p-1.5 rounded-lg flex items-center justify-center">
              <Car className="text-white" size={20} />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">CarHop</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <div className="hidden md:flex items-center gap-2 hover:text-green-600 dark:hover:text-white transition-colors cursor-pointer">
              <Phone size={16} /> <span>1-800-CARHOP</span>
            </div>
            <button onClick={handleManageBookingClick} className="hidden md:block hover:text-green-600 dark:hover:text-white transition-colors font-bold text-xs uppercase tracking-wide">
              Manage Booking
            </button>
            {clientUser ? (
              <div className="flex items-center gap-3">
                <span className="text-green-600 font-bold">Hi, {clientUser.name}</span>
                <button onClick={handleSignOut} className="text-xs border px-2 py-1 rounded hover:bg-zinc-800">
                  <LogOut size={12}/>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white dark:hover:text-black transition-all uppercase text-xs font-bold tracking-wider">
                Sign In
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="hover:text-green-600 dark:hover:text-white transition-colors" title="Toggle Theme">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setView('admin')} className="hidden md:block text-zinc-400 hover:text-white">
              <Lock size={16}/>
            </button>
          </div>
        </div>
      </header>

      {selectedImage && <ImageViewer src={selectedImage} onClose={() => setSelectedImage(null)} />}

      {isProcessingPayment && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4 text-center">
          <Car size={64} className="text-green-600 animate-bounce mb-6" />
          <div className="flex items-center gap-3 text-white text-xl font-bold mb-2">
            <Loader className="animate-spin"/> Processing payment...
          </div>
          <p className="text-zinc-400 text-sm">Please wait while we secure your vehicle.</p>
        </div>
      )}
      
      {showLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors"><X/></button>
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
            <div className="space-y-3 mb-6">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={() => handleSocialLogin('google')}>
                <span className="font-bold">Continue with Google</span>
              </Button>
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2 bg-black text-white" onClick={() => handleSocialLogin('apple')}>
                <span className="font-bold">Continue with Apple</span>
              </Button>
            </div>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-300 dark:border-zinc-700"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">Or continue with email</span></div>
            </div>
            <form onSubmit={handleClientLogin} className="space-y-4">
              <Input label="Full Name" value={loginForm.name} onChange={(e: any) => setLoginForm({...loginForm, name: e.target.value})} placeholder="Your Name" required />
              <Input label="Email Address" type="email" value={loginForm.email} onChange={(e: any) => setLoginForm({...loginForm, email: e.target.value})} placeholder="you@example.com" required />
              <Input label="Phone Number" type="tel" value={loginForm.phone} onChange={(e: any) => setLoginForm({...loginForm, phone: e.target.value})} placeholder="(555) 000-0000" />
              <Input label="Password" type="password" value={loginForm.password} onChange={(e: any) => setLoginForm({...loginForm, password: e.target.value})} placeholder="******" required />
              <Button className="w-full mt-4" type="submit">{isRegistering ? 'Sign Up' : 'Sign In'}</Button>
            </form>
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <button onClick={handleAdminLogin} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto">
                <Settings size={10}/> Admin / Owner Login
              </button>
            </div>
            <p className="text-center text-sm text-zinc-500 mt-2 cursor-pointer hover:text-green-600 dark:hover:text-green-500 transition-colors" onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Already have an account? Sign In' : 'New to CarHop? Create Account'}
            </p>
          </div>
        </div>
      )}

      <main className="pt-20 pb-20">
        {view === 'home' && (
          <>
            <div className="relative h-[600px] w-full overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1471479917193-f00955256257?auto=format&fit=crop&w=2000&q=80')` }}></div>
              <div className="absolute inset-0 bg-black/40 z-10"></div>
              <div className="relative z-20 max-w-7xl w-full px-6 grid lg:grid-cols-2 gap-12 items-center">
                <div className="text-left">
                  <span className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">Price Match Guarantee</span>
                  <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4">
                    The Best price rental in Fairfield County <br/>
                    <span className="text-green-500">Up to $39/Day</span>
                  </h1>
                  <p className="text-zinc-200 text-lg max-w-xl mb-8">Premium vehicles at unbeatable prices. Book your ride in just 3 simple steps.</p>
                </div>
                <Card className="p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
                  <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Find Your Perfect Ride</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pick-up Location</label>
                      <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white">
                        <div className="pl-3"><MapPin size={18} className="text-green-600" /></div>
                        <select 
                          className="bg-transparent w-full p-3 outline-none text-sm"
                          value={searchParams.location}
                          onChange={(e) => handleSearchParamsChange('location', e.target.value)}
                        >
                          <option value="" className="text-black">Select Location</option>
                          {settings.locations.map(loc => <option key={loc} value={loc} className="text-black">{loc}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pick-up Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                          <Calendar size={18} className="text-green-600 mr-2" />
                          <input 
                            type="date" 
                            value={searchParams.start} 
                            onChange={e => handleSearchParamsChange('start', e.target.value)} 
                            min={getTodayString()} 
                            className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Return Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                          <Calendar size={18} className="text-green-600 mr-2" />
                          <input 
                            type="date" 
                            value={searchParams.end} 
                            onChange={e => handleSearchParamsChange('end', e.target.value)} 
                            min={searchParams.start} 
                            className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" 
                          />
                        </div>
                      </div>
                    </div>
                    <Button className="w-full py-4 text-lg" onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? <><Loader className="animate-spin" size={20}/> Searching...</> : <><Search size={20}/> Search Vehicles</>}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
            
            <div id="fleet" className="max-w-7xl mx-auto px-6 mt-16 scroll-mt-24">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Our Fleet</h2>
                  <p className="text-zinc-500">Choose from our wide selection of vehicles</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowEco(!showEco)} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${showEco ? 'bg-green-600 text-white border-green-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    <Leaf size={16}/> Fuel Saver
                  </button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cars
                  .filter(car => !showEco || car.fuelEfficient)
                  .map((car: any) => (
                  <Card key={car.id} className="group cursor-pointer" onClick={() => handleViewDetails(car)}>
                    <div className="relative">
                      <img 
                        src={car.images?.[0] || car.image || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60'} 
                        alt={car.model || car.name} 
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      {car.fuelEfficient && (
                        <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Leaf size={12}/> Fuel Saver
                        </div>
                      )}
                      {car.isAWD && (
                        <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Mountain size={12}/> AWD
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{car.model || car.name}</h3>
                          <span className="text-xs text-zinc-500 uppercase tracking-wider">{car.category}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">${car.price}</div>
                          <div className="text-xs text-zinc-500">/day</div>
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-500 mb-4">
                        <span className="flex items-center gap-1"><Users size={14}/> {car.seats || car.passengers}</span>
                        <span className="flex items-center gap-1"><Gauge size={14}/> {car.mpg} MPG</span>
                        <span className="flex items-center gap-1"><Zap size={14}/> {car.transmission}</span>
                      </div>
                      <Button className="w-full" onClick={(e: any) => { e.stopPropagation(); handleRent(car); }}>
                        Reserve Now
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'admin' && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-zinc-500">Manage your fleet, bookings and settings</p>
              </div>
              <Button variant="ghost" onClick={() => setView('home')}>
                <ArrowLeft size={16}/> Back to Site
              </Button>
            </div>
            
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {['fleet', 'bookings', 'earnings', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${adminTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                >
                  {tab === 'fleet' && <Car size={16} className="inline mr-2"/>}
                  {tab === 'bookings' && <Briefcase size={16} className="inline mr-2"/>}
                  {tab === 'earnings' && <TrendingUp size={16} className="inline mr-2"/>}
                  {tab === 'settings' && <Settings size={16} className="inline mr-2"/>}
                  {tab}
                </button>
              ))}
            </div>

            {adminTab === 'fleet' && (
              <div className="grid gap-4">
                {cars.map((car: any) => (
                  <Card key={car.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src={car.images?.[0] || car.image || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} 
                        alt={car.model || car.name} 
                        className="w-20 h-20 object-cover rounded-lg" 
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{car.model || car.name}</h3>
                        <p className="text-sm text-zinc-500">{car.category} | {car.fuel} | {car.seats} seats</p>
                        <div className="flex gap-2 mt-2">
                          {car.fuelEfficient && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-1 rounded">Fuel Saver</span>}
                          {car.isAWD && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded">AWD</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">${car.price}</div>
                        <div className="text-xs text-zinc-500">/day</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {adminTab === 'bookings' && (
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6 md:col-span-1 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2"><Briefcase size={18}/> All Bookings</h3>
                  <div className="space-y-3">
                    {bookings.map(b => {
                      const statusColor = 
                        b.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        (b.status === 'Active' || b.status === 'Extended') ? 'bg-blue-100 text-blue-700' : 
                        'bg-zinc-100 text-zinc-500';
                      return (
                        <div 
                          key={b.id} 
                          onClick={() => setManageBookingId(b.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${manageBookingId === b.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">{b.id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColor}`}>{b.status}</span>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{b.carName}</div>
                          <div className="text-xs text-zinc-500 mt-1">{b.driver.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-8 md:col-span-2">
                  {manageBookingId ? (
                    (() => {
                      const b = bookings.find(bk => bk.id === manageBookingId);
                      if (!b) return null;
                      return (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
                            <div>
                              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Booking {b.id}</h2>
                              <p className="text-zinc-500 text-sm">Total: <span className="text-green-600 font-bold text-lg">${b.total.toFixed(2)}</span></p>
                            </div>
                            <div className="text-right text-xs text-zinc-500">
                              <div>{b.date}</div>
                              <div>{b.paymentMethod}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Customer</h4>
                              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                                <p>{b.driver.name}</p>
                                <p>{b.driver.phone}</p>
                                <p>{b.driver.email}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Rental Info</h4>
                              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                                <p>{b.carName}</p>
                                <p>{b.startDate} to {b.returnDate}</p>
                                <p>{b.location}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-800/30">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold uppercase text-red-500 flex items-center gap-2"><CreditCard size={14}/> Payment Details (Sensitive)</h4>
                              <button onClick={() => setShowSensitiveData(!showSensitiveData)} className="text-red-500 hover:text-red-700 transition-colors">
                                {showSensitiveData ? <EyeOff size={16}/> : <Eye size={16}/>}
                              </button>
                            </div>
                            <div className={`grid grid-cols-2 gap-4 text-sm ${showSensitiveData ? '' : 'blur-sm select-none'}`}>
                              <div><span className="block text-[10px] text-red-400 uppercase">Card Name</span><span className="font-mono text-zinc-900 dark:text-zinc-200">{b.paymentRaw?.cardName || 'N/A'}</span></div>
                              <div><span className="block text-[10px] text-red-400 uppercase">Card Number</span><span className="font-mono text-zinc-900 dark:text-zinc-200">{b.paymentRaw?.cardNumber || '**** **** **** ****'}</span></div>
                              <div><span className="block text-[10px] text-red-400 uppercase">Expiry</span><span className="font-mono text-zinc-900 dark:text-zinc-200">{b.paymentRaw?.expiry || '**/**'}</span></div>
                              <div><span className="block text-[10px] text-red-400 uppercase">CVC</span><span className="font-mono text-zinc-900 dark:text-zinc-200">{b.paymentRaw?.cvc || '***'}</span></div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2">Financial Breakdown</h4>
                            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                              <div className="flex justify-between"><span>Base Rate</span><span>${b.details.rate.toFixed(2)}</span></div>
                              {b.details.extendedRate && b.details.extendedRate > 0 && (
                                <div className="flex justify-between text-blue-500"><span>Extended Rate</span><span>${b.details.extendedRate.toFixed(2)}</span></div>
                              )}
                              <div className="flex justify-between"><span>Extras</span><span>${b.details.extras.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Protection</span><span>${b.details.protection.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Fees</span><span>${b.details.fees.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Tax</span><span>${b.details.tax.toFixed(2)}</span></div>
                              {b.details.discount && (
                                <div className="flex justify-between text-green-500 items-center">
                                  <span className="flex items-center gap-1">
                                    Discount Applied
                                    <button 
                                      onClick={() => handleRemoveDiscount(b.id)} 
                                      className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-colors"
                                    >
                                      <X size={12}/>
                                    </button>
                                  </span>
                                  <span>-${b.details.discount.toFixed(2)}</span>
                                </div>
                              )}
                              {b.details.manualCharges && b.details.manualCharges.map((c, i) => (
                                <div key={i} className="flex justify-between text-red-500 items-center">
                                  <span className="flex items-center gap-1">
                                    {c.type}
                                    <button 
                                      onClick={() => handleRemoveCharge(b.id, i)}
                                      className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-colors"
                                    >
                                      <X size={12}/>
                                    </button>
                                  </span>
                                  <span>+${c.amount.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 font-bold text-zinc-900 dark:text-white">
                                <span>Total Billed</span>
                                <span>${b.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                      <List size={48} className="mb-4 opacity-20"/>
                      <p>Select a booking from the list to manage details.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {adminTab === 'earnings' && (
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={20}/> Monthly Earnings Overview
                </h3>
                <FinancialBarChart data={earningsData.monthly} fixedExpenses={earningsData.fixedMonthly} />
                
                <div className="mt-8 grid grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                    <div className="text-xs text-green-600 font-bold uppercase">Total Revenue</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${Object.values(earningsData.monthly).reduce((sum: number, m: any) => sum + m.gross, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">
                    <div className="text-xs text-red-600 font-bold uppercase">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-600">
                      ${(earningsData.fixedMonthly * 12).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                    <div className="text-xs text-blue-600 font-bold uppercase">Net Profit</div>
                    <div className="text-2xl font-bold text-blue-600">
                      ${Object.values(earningsData.monthly).reduce((sum: number, m: any) => sum + m.net, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {adminTab === 'settings' && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Pricing Settings</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Tax Rate (%)" 
                      type="number" 
                      value={settings.taxes} 
                      onChange={(e: any) => setSettings({...settings, taxes: parseFloat(e.target.value)})} 
                    />
                    <Input 
                      label="Cleaning Fee ($)" 
                      type="number" 
                      value={settings.cleaningFee} 
                      onChange={(e: any) => setSettings({...settings, cleaningFee: parseFloat(e.target.value)})} 
                    />
                    <Input 
                      label="Included Miles/Day" 
                      type="number" 
                      value={settings.includedMiles} 
                      onChange={(e: any) => setSettings({...settings, includedMiles: parseInt(e.target.value)})} 
                    />
                    <Input 
                      label="Extra Mile Rate ($)" 
                      type="number" 
                      step="0.01"
                      value={settings.extraMileRate} 
                      onChange={(e: any) => setSettings({...settings, extraMileRate: parseFloat(e.target.value)})} 
                    />
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Locations</h3>
                  <div className="space-y-3 mb-4">
                    {settings.locations.map(loc => (
                      <div key={loc} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <span className="font-medium text-zinc-900 dark:text-white">{loc}</span>
                        <button onClick={() => removeLocation(loc)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="New location..." 
                      value={newLocation} 
                      onChange={(e: any) => setNewLocation(e.target.value)} 
                      className="mb-0"
                    />
                    <Button onClick={addLocation}><Plus size={16}/></Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {view === 'bookings' && (
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-3xl font-bold mb-8 text-zinc-900 dark:text-white">My Bookings</h2>
            <div className="space-y-6">
              {bookings.length === 0 ? (
                <div className="text-center text-zinc-500 py-12">No active bookings found.</div>
              ) : (
                bookings.map((b) => (
                  <Card key={b.id} className="p-6 flex flex-col md:flex-row gap-6 items-start">
                    <div className={`p-4 rounded-full shrink-0 ${b.status === 'Completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                      <Check size={32}/>
                    </div>
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start">
                        <div className="mb-2">
                          <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${b.status === 'Extended' || b.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{b.status}</div>
                          <div className="text-sm font-bold text-blue-600">
                            Pick-up: {formatDisplayDate(b.startDate, b.startTime)}
                          </div>
                          <div className="text-sm font-bold text-orange-600 mt-1">
                            Drop-off: {formatDisplayDate(b.returnDate, b.returnTime)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-zinc-900 dark:text-white">${b.total.toFixed(2)}</div>
                          <Button variant="blue" className="text-xs h-8 mt-2" onClick={() => setReceiptBooking(b)}>View Receipt</Button>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{b.carName}</h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">{b.days} Days | {b.location}</p>
                      
                      {(b.status === 'Active' || b.status === 'Extended') && (
                        <div className="mt-6 p-4 bg-zinc-50 dark:bg-black/30 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Rental Workflow</h4>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Button 
                                variant={b.checkInStatus === 'completed' ? "verified" : "primary"} 
                                className={`w-full text-xs h-10 flex items-center justify-center gap-2`}
                                disabled={b.checkInStatus === 'completed'} 
                                onClick={() => handleStartWorkflow(b, 'checkin')}
                              >
                                {b.checkInStatus === 'completed' ? <><Check size={14}/> Check-in Verified</> : <><span className="text-red-200 font-bold mr-1">*Required</span> Check In</>}
                              </Button>
                            </div>
                            <div className="flex-1">
                              <Button 
                                variant="orange" 
                                className={`w-full text-xs h-10 flex items-center justify-center gap-2 ${b.checkInStatus === 'completed' ? '' : 'opacity-50 cursor-not-allowed'}`}
                                disabled={b.checkInStatus !== 'completed'} 
                                onClick={() => handleStartWorkflow(b, 'checkout')}
                              >
                                End Trip
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                            {!extendingBookingId && (
                              <Button variant="orange" className="w-full text-xs text-black font-bold" onClick={() => initExtension(b)}>
                                Request Extension
                              </Button>
                            )}
                            {extendingBookingId === b.id && (
                              <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">New Return Date & Time</label>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2">
                                    <Calendar size={18} className="text-green-600 mr-2" />
                                    <input type="date" className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionDate} min={b.returnDate} onChange={(e) => setExtensionDate(e.target.value)} />
                                  </div>
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2">
                                    <Clock size={18} className="text-green-600 mr-2" />
                                    <select className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionTime} onChange={(e) => setExtensionTime(e.target.value)}>
                                      {timeOptions.map(t => <option key={t} value={t} className="text-black">{t}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Button className="flex-1 text-xs" onClick={() => confirmExtension(b)}>Confirm Extension</Button>
                                    <Button variant="ghost" className="flex-1 text-xs" onClick={() => setExtendingBookingId(null)}>Cancel</Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
            <Button variant="ghost" onClick={() => setView('home')} className="mt-8"><ArrowLeft size={16}/> Back to Home</Button>
          </div>
        )}

        {view === 'confirmation' && (
          <div className="max-w-md mx-auto text-center py-20 px-6">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <Check size={48} />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-white">Payment Confirmed!</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 text-lg">Your payment was processed successfully. Now proceed to vehicle check-in.</p>
            <div className="flex flex-col gap-4">
              <Button onClick={() => setView('bookings')} variant="success" className="w-full py-4 text-lg shadow-xl shadow-green-500/30">
                Go to Check-in (Manage Booking)
              </Button>
              <Button onClick={() => setView('home')} variant="secondary" className="w-full">Back to Home</Button>
            </div>
          </div>
        )}
      </main>
    </div>
    </div>
  );
}
