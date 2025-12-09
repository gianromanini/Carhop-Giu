import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Car, Settings, Plus, Trash2, Check, Calendar, Leaf, DollarSign, ArrowLeft, Shield, Mountain, Smartphone, Gauge, Zap, Edit, X, Image, ChevronRight, ChevronLeft, Info, Search, MapPin, User, Menu, Users, Activity, Phone, Sun, Moon, Clock, LogOut, Map, Bluetooth, Camera, Route, Upload, Mail, FileText, Download, CreditCard, AlertTriangle, CalendarClock, Lock, Fuel, Loader, Briefcase, List, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut, Move, Thermometer, Unlock, BatteryCharging, Armchair, Navigation, BarChart3, TrendingUp, Wallet, Receipt, MoreHorizontal
} from 'lucide-react';
import type { Vehicle, Booking } from '@shared/schema';

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
  const allValues = Object.values(data).flatMap((d: any) => [d.gross, d.expenses, Math.abs(d.net)]);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1000;
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const activeMonths = monthOrder.filter(label => data[label] && data[label].gross > 0);

  return (
    <div className="w-full mt-6 select-none overflow-x-auto">
        <div className="flex items-end justify-start gap-4 h-64 w-full pb-0 border-b border-zinc-200 dark:border-zinc-800 min-w-[600px]">
        {activeMonths.length > 0 ? (
            activeMonths.map((label) => {
                const monthData = data[label] || { gross: 0, expenses: fixedExpenses, net: -fixedExpenses };
                const gross = monthData.gross || 0;
                const expenses = fixedExpenses > 0 ? fixedExpenses : (monthData.expenses || 0);
                const net = gross - expenses;
                const hGross = Math.max((gross / maxVal) * 100, 2);
                const hExpenses = Math.max((expenses / maxVal) * 100, 2);
                const hNet = Math.max((Math.abs(net) / maxVal) * 100, 2);
                return (
                <div key={label} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-[40px] max-w-[100px]">
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-zinc-900/90 text-white text-[10px] p-2 rounded shadow-xl z-20 w-32 text-center backdrop-blur-sm border border-zinc-700">
                        <div className="font-bold text-xs border-b border-zinc-700 pb-1 mb-1">{label} Financials</div>
                        <div className="flex justify-between"><span className="text-red-400">Exp:</span> <span>${expenses.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-green-400">Gross:</span> <span>${gross.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold"><span className="text-blue-400">Net:</span> <span>${net.toLocaleString()}</span></div>
                    </div>
                    <div className="flex items-end gap-[2px] w-full h-full justify-center opacity-90 hover:opacity-100 transition-opacity">
                        <div className="w-1/3 bg-red-500 rounded-t-sm transition-all" style={{ height: `${hExpenses}%` }}></div>
                        <div className="w-1/3 bg-green-500 rounded-t-sm transition-all" style={{ height: `${hGross}%` }}></div>
                        <div className={`w-1/3 rounded-t-sm transition-all ${net >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ height: `${hNet}%` }}></div>
                    </div>
                </div>
                );
            })
        ) : (
            <div className="w-full flex items-center justify-center text-zinc-400 h-full">No revenue data available.</div>
        )}
        </div>
        <div className="flex justify-center gap-6 mt-4 text-xs font-bold text-zinc-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Expenses</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Gross Revenue</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Net Profit</div>
        </div>
        <div className="flex justify-start gap-4 mt-2 min-w-[600px]">
            {activeMonths.map(label => (<div key={label} className="flex-1 text-center max-w-[100px]"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span></div>))}
        </div>
    </div>
  );
};

const initialFormState = { model: '', category: '', price: '', fuel: 'Gasoline', seats: 5, transmission: 'Automatic', images: [''], consumption: '', isPriceMatch: false, isAWD: false, hasCarPlay: false, hasBluetooth: false, hasReverseCamera: false, hasHeatedSeats: false, hasHeatedSteering: false, hasElectricSeats: false, hasPaddleShifters: false, hasKeylessEntry: false, hasBlindSpotWarning: false, hasDriveAssist: false, hasUSBCharger: false };
const initialCheckState = { photosOutside: [] as string[], photosInside: [] as string[], miles: '', gas: 'Full' };
const initialExpenseState = { carId: '', lease: '', insurance: '', carWash: '', maintenance: '', trackApp: '', downPayment: '' };

interface SettingsType {
  taxes: number;
  cleaningFee: number;
  includedMiles: number;
  extraMileRate: number;
  prices: { insurance500: number; insurance1000: number; childSeat: number };
  locations: string[];
}

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
  
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [checkData, setCheckData] = useState(initialCheckState);
  const [isCheckOutMode, setIsCheckOutMode] = useState(false);

  const [adjustment, setAdjustment] = useState({ type: 'fixed', value: '' });
  const [extraCharge, setExtraCharge] = useState({ type: 'Refuel', amount: '' });

  const [newLocation, setNewLocation] = useState('');

  const [cart, setCart] = useState<{ car: Vehicle | null; days: number; billingDays: number; extrasSelected: string[]; insuranceOption: string }>({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' });
  const [viewCar, setViewCar] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [expenseForm, setExpenseForm] = useState(initialExpenseState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showEco, setShowEco] = useState(false);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({ queryKey: ['/api/vehicles'] });
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({ queryKey: ['/api/bookings'] });
  const { data: settingsData } = useQuery<SettingsType>({ queryKey: ['/api/settings'] });
  const { data: financialData } = useQuery<{ monthly: Record<string, any>; byVehicle: Record<string, number>; fixedMonthly: number }>({ queryKey: ['/api/financial/summary'] });

  const settings: SettingsType = settingsData || { taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: { insurance500: 25, insurance1000: 15, childSeat: 8 }, locations: ['JFK Airport', 'Downtown Center', 'Fairfield County'] };

  const createVehicleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/vehicles', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); setFormData(initialFormState); }
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/vehicles/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); setFormData(initialFormState); setEditingId(null); }
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/vehicles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] })
  });

  const createBookingMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/bookings', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); }
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/bookings/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }); queryClient.invalidateQueries({ queryKey: ['/api/financial/summary'] }); }
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => apiRequest('PUT', `/api/settings/${key}`, { value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
  });

  useEffect(() => {
    const today = getTodayString();
    const nextTime = getNext30MinSlot();
    const returnDay = addDaysToDate(today, 3);
    setSearchParams({ location: '', start: today, startTime: nextTime, end: returnDay, endTime: nextTime });
  }, []);

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
    setTimeout(() => { setIsSearching(false); const fleetSection = document.getElementById('fleet'); if (fleetSection) fleetSection.scrollIntoView({behavior:'smooth'}); }, 1500); 
  };
  
  const handleViewDetails = (car: Vehicle) => { setViewCar(car); setView('car-details'); window.scrollTo(0, 0); };
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
      details: { rate: cart.car!.price * days, extras: (cart.extrasSelected.includes('childSeat') ? settings.prices.childSeat * days : 0), protection: (cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * days, fees: settings.cleaningFee, tax: totalData.taxAmount }, 
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
        if (currentList.length >= 10) return prev;
        return { ...prev, [section === 'outside' ? 'photosOutside' : 'photosInside']: [...currentList, reader.result as string] };
      });
      reader.readAsDataURL(file);
    }
    if (checkInInputRef.current) checkInInputRef.current.value = '';
  };

  const triggerCheckInput = (section: string) => document.getElementById(`check-input-${section}`)?.click();

  const completeWorkflow = async () => {
     if (!checkData.miles) { alert("Please enter current mileage."); return; }
     if (checkData.photosOutside.length === 0 || checkData.photosInside.length === 0) { alert("Please upload at least one photo for both Inside and Outside."); return; }

     if (!activeBooking) return;

     let updateData: any = {};
     if (isCheckOutMode) {
       const checkInMiles = parseInt(activeBooking.checkInData?.miles || '0');
       const checkOutMiles = parseInt(checkData.miles || '0');
       const allowedMiles = settings.includedMiles * activeBooking.days;
       const milesDriven = checkOutMiles - checkInMiles;
       const excessMiles = Math.max(0, milesDriven - allowedMiles);
       const excessMileageFee = excessMiles * settings.extraMileRate;
       const gasInLevel = getGasValue(activeBooking.checkInData?.gas || 'Full');
       const gasOutLevel = getGasValue(checkData.gas);
       const gasDiff = Math.max(0, gasInLevel - gasOutLevel);
       const refuelingFee = gasDiff * 10;
       
       updateData = {
         checkOutStatus: 'completed',
         checkOutData: checkData,
         status: 'Completed',
         total: activeBooking.total + excessMileageFee + refuelingFee,
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
    
    if (diffTime < 0) { alert("New return time cannot be before current return time."); return; }
    
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

  const handleAddCharge = async (booking: Booking) => {
    if (!extraCharge.amount || parseFloat(extraCharge.amount) <= 0) {
      alert("Please enter a valid charge amount.");
      return;
    }
    
    const chargeAmount = parseFloat(extraCharge.amount);
    const chargeTypeLabels: Record<string, string> = {
      'refuel': 'Refuel',
      'mileage': 'Excess Mileage',
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

  const handleSaveVehicle = () => {
    const vehicleData = {
      model: formData.model,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      fuel: formData.fuel,
      seats: formData.seats,
      transmission: formData.transmission,
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
    };

    if (editingId) {
      updateVehicleMutation.mutate({ id: editingId, data: vehicleData });
    } else {
      createVehicleMutation.mutate(vehicleData);
    }
  };

  const handleEditVehicle = (car: Vehicle) => {
    setFormData({
      model: car.model,
      category: car.category,
      price: String(car.price),
      fuel: car.fuel,
      seats: car.seats,
      transmission: car.transmission,
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

  if (vehiclesLoading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-black text-green-600"><Loader className="animate-spin" size={32} /> Loading CarHop...</div>;

  return (
    <div className={darkMode ? "dark" : ""}>
      <style>{` @media print { body * { visibility: hidden; } .printable-receipt, .printable-receipt * { visibility: visible; } .printable-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; } .no-print { display: none !important; } } `}</style>
    <div className="min-h-screen bg-gray-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-green-500 selection:text-white transition-colors duration-300">
      
      <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')} data-testid="link-home">
            <div className="bg-green-600 p-1.5 rounded-lg flex items-center justify-center"><Car className="text-white" size={20} /></div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">CarHop</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <div className="hidden md:flex items-center gap-2 hover:text-green-600 dark:hover:text-white transition-colors cursor-pointer"><Phone size={16} /> <span>1-800-CARHOP</span></div>
            <button onClick={handleManageBookingClick} className="hidden md:block hover:text-green-600 dark:hover:text-white transition-colors font-bold text-xs uppercase tracking-wide" data-testid="button-manage-booking">Manage Booking</button>
            {clientUser ? (
              <div className="flex items-center gap-3">
                <span className="text-green-600 font-bold" data-testid="text-username">Hi, {clientUser.name}</span>
                <button onClick={handleSignOut} className="text-xs border px-2 py-1 rounded hover:bg-zinc-800" data-testid="button-signout"><LogOut size={12}/></button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white dark:hover:text-black transition-all uppercase text-xs font-bold tracking-wider" data-testid="button-signin">Sign In</button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="hover:text-green-600 dark:hover:text-white transition-colors" title="Toggle Theme" data-testid="button-theme-toggle">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => setView('admin')} className="hidden md:block text-zinc-400 hover:text-white" data-testid="button-admin"><Lock size={16}/></button>
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
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-modal"><X/></button>
            <h2 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-white">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
            <div className="space-y-3 mb-6">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={() => handleSocialLogin('google')} data-testid="button-google-login"><span className="font-bold">Continue with Google</span></Button>
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2 bg-black text-white" onClick={() => handleSocialLogin('apple')} data-testid="button-apple-login"><span className="font-bold">Continue with Apple</span></Button>
            </div>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-300 dark:border-zinc-700"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">Or continue with email</span></div>
            </div>
            <form onSubmit={handleClientLogin} className="space-y-4">
              <Input label="Full Name" value={loginForm.name} onChange={(e: any) => setLoginForm({...loginForm, name: e.target.value})} placeholder="Your Name" required data-testid="input-name" />
              <Input label="Email Address" type="email" value={loginForm.email} onChange={(e: any) => setLoginForm({...loginForm, email: e.target.value})} placeholder="you@example.com" required data-testid="input-email" />
              <Input label="Phone Number" type="tel" value={loginForm.phone} onChange={(e: any) => setLoginForm({...loginForm, phone: e.target.value})} placeholder="(555) 000-0000" data-testid="input-phone" />
              <Input label="Password" type="password" value={loginForm.password} onChange={(e: any) => setLoginForm({...loginForm, password: e.target.value})} placeholder="******" required data-testid="input-password" />
              <Button className="w-full mt-4" type="submit" data-testid="button-submit-login">{isRegistering ? 'Sign Up' : 'Sign In'}</Button>
            </form>
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <button onClick={handleAdminLogin} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto" data-testid="button-admin-login"><Settings size={10}/> Admin / Owner Login</button>
            </div>
            <p className="text-center text-sm text-zinc-500 mt-2 cursor-pointer hover:text-green-600 dark:hover:text-green-500 transition-colors" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? 'Already have an account? Sign In' : 'New to CarHop? Create Account'}</p>
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
                  <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4" data-testid="text-hero-title">The Best price rental in Fairfield County <br/><span className="text-green-500">Up to $39/Day</span></h1>
                  <p className="text-zinc-200 text-lg max-w-xl mb-8">Premium vehicles at unbeatable prices. Book your ride in just 3 simple steps.</p>
                </div>
                <Card className="p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
                  <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Find Your Perfect Ride</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pick-up Location</label>
                      <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white">
                        <div className="pl-3"><MapPin size={18} className="text-green-600" /></div>
                        <select className="bg-transparent w-full p-3 outline-none text-sm" value={searchParams.location} onChange={(e) => handleSearchParamsChange('location', e.target.value)} data-testid="select-location">
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
                          <input type="date" value={searchParams.start} onChange={e => handleSearchParamsChange('start', e.target.value)} min={getTodayString()} className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" data-testid="input-start-date" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Return Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                          <Calendar size={18} className="text-green-600 mr-2" />
                          <input type="date" value={searchParams.end} onChange={e => handleSearchParamsChange('end', e.target.value)} min={searchParams.start} className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" data-testid="input-end-date" />
                        </div>
                      </div>
                    </div>
                    <Button className="w-full py-4 text-lg" onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                      {isSearching ? <><Loader className="animate-spin" size={20}/> Searching...</> : <><Search size={20}/> Search Vehicles</>}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
            
            <div id="fleet" className="max-w-7xl mx-auto px-6 mt-16 scroll-mt-24">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 dark:text-white" data-testid="text-fleet-title">Our Fleet</h2>
                  <p className="text-zinc-500">Choose from our wide selection of vehicles</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEco(!showEco)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${showEco ? 'bg-green-600 text-white border-green-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`} data-testid="button-fuel-saver"><Leaf size={16}/> Fuel Saver</button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.filter(car => !showEco || car.fuel === 'Hybrid' || car.fuel === 'Electric').map((car) => (
                  <div key={car.id} onClick={() => handleViewDetails(car)} data-testid={`card-vehicle-${car.id}`}>
                    <Card className="group cursor-pointer hover-elevate overflow-visible">
                      <div className="relative overflow-hidden rounded-t-lg">
                        <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60'} alt={car.model} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                        {(car.fuel === 'Hybrid' || car.fuel === 'Electric') && (<div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><Leaf size={12}/> Fuel Saver</div>)}
                        {car.isAWD && (<div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><Mountain size={12}/> AWD</div>)}
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white" data-testid={`text-vehicle-name-${car.id}`}>{car.model}</h3>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">{car.category}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600" data-testid={`text-vehicle-price-${car.id}`}>${car.price}</div>
                            <div className="text-xs text-zinc-500">/day</div>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500 mb-4">
                          <span className="flex items-center gap-1"><Users size={14}/> {car.seats}</span>
                          <span className="flex items-center gap-1"><Gauge size={14}/> {car.consumption}</span>
                          <span className="flex items-center gap-1"><Zap size={14}/> {car.transmission}</span>
                        </div>
                        <Button className="w-full" onClick={(e: any) => { e.stopPropagation(); handleRent(car); }} data-testid={`button-rent-${car.id}`}>Reserve Now</Button>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'admin' && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white" data-testid="text-admin-title">Admin Dashboard</h1>
                <p className="text-zinc-500">Manage your fleet, bookings and settings</p>
              </div>
              <Button variant="ghost" onClick={() => setView('home')} data-testid="button-back-home"><ArrowLeft size={16}/> Back to Site</Button>
            </div>
            
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {['fleet', 'bookings', 'earnings'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${adminTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-tab-${tab}`}>
                  {tab === 'fleet' && <Car size={16} className="inline mr-2"/>}
                  {tab === 'bookings' && <Briefcase size={16} className="inline mr-2"/>}
                  {tab === 'earnings' && <TrendingUp size={16} className="inline mr-2"/>}
                  {tab}
                </button>
              ))}
            </div>

            {adminTab === 'fleet' && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Add New Vehicle Form */}
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-6 text-zinc-900 dark:text-white flex items-center gap-2">
                    <Plus size={18} className="text-green-500"/>
                    {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
                  </h3>
                  <div className="space-y-4">
                    <Input label="Car Model" name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. Tesla Model 3" required data-testid="input-vehicle-model" />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Daily Rate ($)" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="e.g. 45" required data-testid="input-vehicle-price" />
                      <div className="mb-3">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fuel Type</label>
                        <select name="fuel" value={formData.fuel} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-fuel">
                          <option value="Gasoline">Gasoline</option>
                          <option value="Hybrid">Hybrid</option>
                          <option value="Electric">Electric</option>
                          <option value="Diesel">Diesel</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Seats" name="seats" type="number" value={formData.seats} onChange={handleInputChange} placeholder="5" data-testid="input-vehicle-seats" />
                      <div className="mb-3">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Transmission</label>
                        <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-transmission">
                          <option value="Automatic">Automatic</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Consumption / Range" name="consumption" value={formData.consumption} onChange={handleInputChange} placeholder="e.g. 300mi range" data-testid="input-vehicle-consumption" />
                      <Input label="Category" name="category" value={formData.category} onChange={handleInputChange} placeholder="e.g. Sedan" required data-testid="input-vehicle-category" />
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Features</label>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1">
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
                    {editingId && <Button variant="ghost" onClick={() => { setFormData(initialFormState); setEditingId(null); }} className="w-full">Cancel</Button>}
                  </div>
                </Card>

                {/* Right Column - Locations, Pricing, Inventory */}
                <div className="space-y-6">
                  {/* Pickup Locations */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <MapPin size={18} className="text-green-500"/>
                      Pickup Locations
                    </h3>
                    <div className="flex gap-2 mb-4">
                      <Input placeholder="New Location Name (e.g. Airport JFK)" value={newLocation} onChange={(e: any) => setNewLocation(e.target.value)} className="mb-0 flex-1" data-testid="input-new-location" />
                      <Button onClick={addLocation} variant="secondary" data-testid="button-add-location">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {settings.locations.map(loc => (
                        <span key={loc} className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-full text-sm">
                          {loc}
                          <button onClick={() => removeLocation(loc)} className="text-zinc-400 hover:text-red-500 ml-1" data-testid={`button-remove-location-${loc}`}><X size={14}/></button>
                        </span>
                      ))}
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => {}}>Save Locations</Button>
                  </Card>

                  {/* Price Configuration */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <DollarSign size={18} className="text-green-500"/>
                      Price Configuration
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <Input label="Sales Tax (%)" type="number" step="0.1" value={settings.taxes} onChange={(e: any) => updateSettingMutation.mutate({ key: 'taxes', value: parseFloat(e.target.value) })} data-testid="input-taxes" />
                      <Input label="Cleaning Fee ($)" type="number" value={settings.cleaningFee} onChange={(e: any) => updateSettingMutation.mutate({ key: 'cleaningFee', value: parseFloat(e.target.value) })} data-testid="input-cleaning-fee" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <Input label="Included Miles / Day" type="number" value={settings.includedMiles} onChange={(e: any) => updateSettingMutation.mutate({ key: 'includedMiles', value: parseInt(e.target.value) })} data-testid="input-included-miles" />
                      <Input label="Extra Mile Rate ($)" type="number" step="0.01" value={settings.extraMileRate} onChange={(e: any) => updateSettingMutation.mutate({ key: 'extraMileRate', value: parseFloat(e.target.value) })} data-testid="input-extra-mile-rate" />
                    </div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Daily Add-on Rates</label>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <Input label="Ins. $500" type="number" value={settings.prices.insurance500} onChange={(e: any) => updateSettingMutation.mutate({ key: 'prices', value: {...settings.prices, insurance500: parseFloat(e.target.value)} })} data-testid="input-insurance-500" />
                      <Input label="Ins. $1000" type="number" value={settings.prices.insurance1000} onChange={(e: any) => updateSettingMutation.mutate({ key: 'prices', value: {...settings.prices, insurance1000: parseFloat(e.target.value)} })} data-testid="input-insurance-1000" />
                      <Input label="Child Seat" type="number" value={settings.prices.childSeat} onChange={(e: any) => updateSettingMutation.mutate({ key: 'prices', value: {...settings.prices, childSeat: parseFloat(e.target.value)} })} data-testid="input-child-seat" />
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => {}}>Update Global Settings</Button>
                  </Card>

                  {/* Inventory */}
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Inventory ({vehicles.length})</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {vehicles.map((car) => (
                        <div key={car.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group" onClick={() => handleEditVehicle(car)} data-testid={`card-admin-vehicle-${car.id}`}>
                          <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&q=60'} alt={car.model} className="w-12 h-12 object-cover rounded-lg" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{car.model}</h4>
                            <p className="text-xs text-zinc-500">{car.fuel} · {car.category}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEditVehicle(car); }} className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded" data-testid={`button-edit-${car.id}`}><Edit size={14}/></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteVehicleMutation.mutate(car.id); }} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" data-testid={`button-delete-${car.id}`}><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {adminTab === 'bookings' && (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Left Column - All Bookings List */}
                <Card className="p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">All Bookings</h3>
                  <div className="space-y-2">
                    {bookings.map(b => {
                      const statusColor = b.status === 'Completed' ? 'bg-green-600 text-white' : (b.status === 'Active' || b.status === 'Extended') ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white';
                      const statusText = b.status === 'Completed' ? 'COMPLETED' : b.status === 'Active' ? 'ACTIVE' : b.status;
                      return (
                        <div key={b.id} onClick={() => setManageBookingId(b.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${manageBookingId === b.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-booking-${b.id}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-white">{b.bookingCode}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>{statusText}</span>
                          </div>
                          <div className="text-xs text-zinc-400 font-medium">{b.carName}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{b.driver.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Right Column - Booking Details */}
                <Card className="p-6 md:col-span-2 max-h-[85vh] overflow-y-auto">
                  {manageBookingId ? (
                    (() => {
                      const b = bookings.find(bk => bk.id === manageBookingId);
                      if (!b) return null;
                      return (
                        <div className="space-y-6">
                          {/* Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <h2 className="text-xl font-bold text-zinc-900 dark:text-white" data-testid="text-booking-code">Booking {b.bookingCode}</h2>
                              <p className="text-zinc-500 text-sm">Total: <span className="text-green-500 font-bold">${b.total.toFixed(2)}</span></p>
                            </div>
                            <div className="text-right text-xs text-zinc-500">
                              <div>{b.date}</div>
                              <div>{b.paymentMethod || 'Credit Card (Visa **** 4242)'}</div>
                            </div>
                          </div>

                          {/* Customer & Rental Info */}
                          <div className="grid grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
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
                                <p className="text-zinc-500">{b.startDate} to {b.returnDate}</p>
                                <p className="text-zinc-500">{b.location}</p>
                              </div>
                            </div>
                          </div>

                          {/* Payment Details (Sensitive) */}
                          <div className="bg-red-950/30 p-4 rounded-lg border border-red-900/50">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold uppercase text-red-400 flex items-center gap-2">
                                <CreditCard size={14}/> Payment Details (Sensitive)
                              </h4>
                              <button onClick={() => setShowSensitiveData(!showSensitiveData)} className="text-red-400 hover:text-red-300 transition-colors">
                                {showSensitiveData ? <EyeOff size={16}/> : <Eye size={16}/>}
                              </button>
                            </div>
                            <div className={`grid grid-cols-2 gap-4 text-sm ${showSensitiveData ? '' : 'blur-sm select-none'}`}>
                              <div><span className="block text-[10px] text-red-400/70 uppercase">Card Name</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cardName || 'N/A'}</span></div>
                              <div><span className="block text-[10px] text-red-400/70 uppercase">Card Number</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cardNumber || '**** **** **** ****'}</span></div>
                              <div><span className="block text-[10px] text-red-400/70 uppercase">Expiry</span><span className="font-mono text-zinc-300">{b.paymentRaw?.expiry || '**/**'}</span></div>
                              <div><span className="block text-[10px] text-red-400/70 uppercase">CVC</span><span className="font-mono text-zinc-300">{b.paymentRaw?.cvc || '***'}</span></div>
                            </div>
                          </div>

                          {/* Manage Charges & Adjustments */}
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-4">Manage Charges & Adjustments</h4>
                            
                            {/* Apply Discount */}
                            <div className="mb-4">
                              <label className="text-xs text-zinc-500 mb-2 block">Apply Discount</label>
                              <div className="flex gap-2">
                                <select 
                                  value={adjustment.type} 
                                  onChange={(e) => setAdjustment(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white w-32" 
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
                                  className="flex-1 mb-0" 
                                  data-testid="input-discount-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors" 
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
                              <div className="flex gap-2">
                                <select 
                                  value={extraCharge.type}
                                  onChange={(e) => setExtraCharge(prev => ({ ...prev, type: e.target.value }))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white w-32" 
                                  data-testid="select-charge-type"
                                >
                                  <option value="refuel">Refuel</option>
                                  <option value="mileage">Excess Mileage</option>
                                  <option value="damage">Damage</option>
                                  <option value="cleaning">Extra Cleaning</option>
                                  <option value="other">Other</option>
                                </select>
                                <Input 
                                  placeholder="Value ($)" 
                                  type="number"
                                  value={extraCharge.amount}
                                  onChange={(e: any) => setExtraCharge(prev => ({ ...prev, amount: e.target.value }))}
                                  className="flex-1 mb-0" 
                                  data-testid="input-charge-value" 
                                />
                                <button 
                                  className="px-3 h-[38px] bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors" 
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
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-3">Financial Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between text-zinc-300"><span>Base Rate</span><span>${b.details.rate.toFixed(2)}</span></div>
                              <div className="flex justify-between text-zinc-300"><span>Extras</span><span>${b.details.extras.toFixed(2)}</span></div>
                              <div className="flex justify-between text-zinc-300"><span>Protection</span><span>${b.details.protection.toFixed(2)}</span></div>
                              <div className="flex justify-between text-zinc-300"><span>Fees</span><span>${b.details.fees.toFixed(2)}</span></div>
                              <div className="flex justify-between text-zinc-300"><span>Tax</span><span>${b.details.tax.toFixed(2)}</span></div>
                              
                              {b.details.discount && b.details.discount > 0 && (
                                <div className="flex justify-between text-green-500">
                                  <span className="flex items-center gap-1">
                                    Discount Applied 
                                    <button 
                                      onClick={() => handleRemoveDiscount(b)} 
                                      className="text-red-400 hover:text-red-300"
                                      data-testid="button-remove-discount"
                                    >
                                      <X size={12}/>
                                    </button>
                                  </span>
                                  <span>-${b.details.discount.toFixed(2)}</span>
                                </div>
                              )}
                              
                              {b.details.manualCharges && b.details.manualCharges.map((c, i) => (
                                <div key={i} className="flex justify-between text-red-400">
                                  <span className="flex items-center gap-1">
                                    {c.type} 
                                    <button 
                                      onClick={() => handleRemoveCharge(b, i)} 
                                      className="text-red-400 hover:text-red-300"
                                      data-testid={`button-remove-charge-${i}`}
                                    >
                                      <X size={12}/>
                                    </button>
                                  </span>
                                  <span>+${c.amount.toFixed(2)}</span>
                                </div>
                              ))}
                              
                              <div className="flex justify-between border-t border-zinc-700 pt-3 mt-3 font-bold text-white">
                                <span>Total Billed</span>
                                <span>${b.total.toFixed(2)}</span>
                              </div>
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
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2"><BarChart3 size={20}/> Monthly Earnings Overview</h3>
                {financialData && <FinancialBarChart data={financialData.monthly} fixedExpenses={financialData.fixedMonthly} />}
                {financialData && (
                  <div className="mt-8 grid grid-cols-3 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl"><div className="text-xs text-green-600 font-bold uppercase">Total Revenue</div><div className="text-2xl font-bold text-green-600">${Object.values(financialData.monthly).reduce((sum: number, m: any) => sum + m.gross, 0).toLocaleString()}</div></div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl"><div className="text-xs text-red-600 font-bold uppercase">Total Expenses</div><div className="text-2xl font-bold text-red-600">${(financialData.fixedMonthly * 12).toLocaleString()}</div></div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl"><div className="text-xs text-blue-600 font-bold uppercase">Net Profit</div><div className="text-2xl font-bold text-blue-600">${Object.values(financialData.monthly).reduce((sum: number, m: any) => sum + m.net, 0).toLocaleString()}</div></div>
                  </div>
                )}
              </Card>
            )}

                      </div>
        )}

        {view === 'bookings' && (
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-3xl font-bold mb-8 text-zinc-900 dark:text-white" data-testid="text-my-bookings">My Bookings</h2>
            <div className="space-y-6">
              {bookings.length === 0 ? (
                <div className="text-center text-zinc-500 py-12">No active bookings found.</div>
              ) : (
                bookings.map((b) => (
                  <Card key={b.id} className="p-6 flex flex-col md:flex-row gap-6 items-start" data-testid={`card-my-booking-${b.id}`}>
                    <div className={`p-4 rounded-full shrink-0 ${b.status === 'Completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}><Check size={32}/></div>
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start">
                        <div className="mb-2">
                          <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${b.status === 'Extended' || b.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{b.status}</div>
                          <div className="text-sm font-bold text-blue-600">Pick-up: {formatDisplayDate(b.startDate, b.startTime)}</div>
                          <div className="text-sm font-bold text-orange-600 mt-1">Drop-off: {formatDisplayDate(b.returnDate, b.returnTime)}</div>
                          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1"><Clock size={12} /> Grace period: +30 min</div>
                        </div>
                        <div className="text-right"><div className="font-bold text-lg text-zinc-900 dark:text-white">${b.total.toFixed(2)}</div></div>
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{b.carName}</h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">{b.days} Days | {b.location}</p>
                      
                      {(b.status === 'Active' || b.status === 'Extended') && (
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
                            {!extendingBookingId && (<button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors" onClick={() => initExtension(b)} data-testid={`button-extend-${b.id}`}>Request Extension</button>)}
                            {extendingBookingId === b.id && (() => {
                              const today = new Date();
                              const minDate = new Date(today);
                              minDate.setDate(minDate.getDate() + 1);
                              const minDateStr = minDate.toISOString().split('T')[0];
                              
                              return (
                              <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">New Return Date & Time</label>
                                <p className="text-xs text-zinc-500 mb-3">You can extend or adjust your return date (minimum 1 day from today)</p>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Calendar size={18} className="text-green-600 mr-2" /><input type="date" className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionDate} min={minDateStr} onChange={(e) => setExtensionDate(e.target.value)} data-testid="input-extension-date" /></div>
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Clock size={18} className="text-green-600 mr-2" /><select className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionTime} onChange={(e) => setExtensionTime(e.target.value)} data-testid="select-extension-time">{timeOptions.map(t => <option key={t} value={t} className="text-black">{t}</option>)}</select></div>
                                  <div className="flex flex-col gap-2 mt-2">
                                    {b.paymentRaw?.type === 'paypal' && (
                                      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-2">
                                        <p className="text-xs text-blue-400 mb-2">Extension fee will be charged via PayPal</p>
                                        <p className="text-sm font-bold text-white">Additional: ${(Math.max(0, Math.ceil((new Date(extensionDate).getTime() - new Date(b.returnDate).getTime()) / (1000 * 60 * 60 * 24))) * (b.total / Math.ceil((new Date(b.returnDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(2)}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2" onClick={() => confirmExtension(b)} data-testid="button-confirm-extension">
                                        {b.paymentRaw?.type === 'paypal' && <Wallet size={14}/>}
                                        {b.paymentRaw?.type === 'paypal' ? 'Pay Now (PayPal)' : 'Confirm Extension'}
                                      </button>
                                      <Button variant="ghost" className="flex-1 text-xs" onClick={() => setExtendingBookingId(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );})()}
                          </div>
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
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2">
                        <Calendar size={16} className="text-zinc-500" />
                        <input 
                          type="date" 
                          value={searchParams.start} 
                          onChange={e => handleSearchParamsChange('start', e.target.value)} 
                          min={getTodayString()} 
                          className="bg-transparent w-full outline-none text-sm text-white" 
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
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">RETURN</label>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2">
                        <Calendar size={16} className="text-zinc-500" />
                        <input 
                          type="date" 
                          value={searchParams.end} 
                          onChange={e => handleSearchParamsChange('end', e.target.value)} 
                          min={searchParams.start || getTodayString()} 
                          className="bg-transparent w-full outline-none text-sm text-white" 
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
                            <p className="text-xs text-zinc-500">Franchise of $500</p>
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
                            <p className="text-xs text-zinc-500">Franchise of $1,000</p>
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
                    <span className="font-bold text-white">+${settings.prices.childSeat}/day</span>
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
                    <p className="text-xs text-zinc-500 mt-1 ml-6">200 miles/day included</p>
                    <p className="text-xs text-zinc-500 ml-6">Excess: $0.30/mile</p>
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-3 text-sm border-t border-zinc-800 pt-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Rate ({cart.billingDays} days)</span>
                      <span className="text-white">${(cart.billingDays * cart.car.price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-500">Protection</span>
                      <span className="text-green-500">+${((cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * cart.billingDays).toFixed(2)}</span>
                    </div>
                    {cart.extrasSelected.includes('childSeat') && (
                      <div className="flex justify-between">
                        <span className="text-green-500">Child Seat</span>
                        <span className="text-green-500">+${(settings.prices.childSeat * cart.billingDays).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Cleaning Fee</span>
                      <span className="text-white">${settings.cleaningFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Taxes ({settings.taxes}%)</span>
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
                    disabled={!isCheckoutValid()} 
                    className={`w-full mt-6 py-4 rounded-lg font-bold text-sm transition-all ${isCheckoutValid() ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}
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
              <button 
                onClick={() => { setView('home'); setCart({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' }); }} 
                className="w-full py-3 text-zinc-500 hover:text-zinc-300 font-medium transition-all flex items-center justify-center gap-2" 
                data-testid="button-close-confirmation"
              >
                <X size={18} />
                Close
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
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Outside Photos <span className="text-red-500">* (min 5 photos)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosOutside.map((p, i) => (<div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-green-500"><img src={p} className="w-full h-full object-cover"/></div>))}
                    <button onClick={() => triggerCheckInput('outside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-outside"><Camera size={20}/></button>
                    <input id="check-input-outside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'outside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosOutside.length}/5 photos uploaded</p>
                </div>
                
                {/* 2. Inside Photos - Second */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Inside Photos <span className="text-red-500">* (min 5 photos)</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {checkData.photosInside.map((p, i) => (<div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-green-500"><img src={p} className="w-full h-full object-cover"/></div>))}
                    <button onClick={() => triggerCheckInput('inside')} className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500" data-testid="button-upload-inside"><Camera size={20}/></button>
                    <input id="check-input-inside" type="file" className="hidden" accept="image/*" onChange={(e) => handleCheckUpload(e, 'inside')} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{checkData.photosInside.length}/5 photos uploaded</p>
                </div>
                
                {/* 3. Current Mileage - Third */}
                <Input label="Current Mileage" type="number" value={checkData.miles} onChange={(e: any) => setCheckData({...checkData, miles: e.target.value})} placeholder="e.g. 45000" required data-testid="input-check-miles" />
                
                {/* 4. Fuel Level - Fourth (Last) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Fuel Level</label>
                  <div className="flex gap-2">{['Full', '3/4', '1/2', '1/4', 'Empty'].map(level => (<button key={level} onClick={() => setCheckData({...checkData, gas: level})} className={`flex-1 py-2 rounded border text-sm font-bold ${checkData.gas === level ? 'bg-green-600 text-white border-green-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`} data-testid={`button-gas-${level}`}>{level}</button>))}</div>
                </div>
                
                {(() => {
                  const canComplete = checkData.photosOutside.length >= 5 && checkData.photosInside.length >= 5 && checkData.miles && checkData.gas;
                  const isPayPalBooking = activeBooking?.paymentRaw?.type === 'paypal';
                  
                  return (
                    <div className="space-y-3">
                      {isCheckOutMode && isPayPalBooking && (
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                          <p className="text-xs text-blue-400 mb-2">Final payment via PayPal</p>
                          <p className="text-lg font-bold text-white flex items-center gap-2"><Wallet size={18}/> Total: ${activeBooking?.total.toFixed(2)}</p>
                        </div>
                      )}
                      <Button className={`w-full py-4 flex items-center justify-center gap-2 ${!canComplete ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canComplete} onClick={completeWorkflow} data-testid="button-complete-workflow">
                        {isCheckOutMode && isPayPalBooking && <Wallet size={18}/>}
                        {isCheckOutMode && isPayPalBooking ? 'Pay Now (PayPal)' : `Complete ${isCheckOutMode ? 'Check-Out' : 'Check-In'}`}
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

        {view === 'car-details' && viewCar && (
          <div className="max-w-5xl mx-auto px-6 py-12">
            <Button variant="ghost" onClick={() => setView('home')} className="mb-8"><ArrowLeft size={20} /> Back to Fleet</Button>
            <div className="grid md:grid-cols-2 gap-8">
              <ImageCarousel images={viewCar.images} />
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{viewCar.category}</span>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2" data-testid="text-car-detail-name">{viewCar.model}</h1>
                <div className="flex gap-4 text-sm text-zinc-500 mb-6">
                  <span className="flex items-center gap-1"><Users size={16}/> {viewCar.seats} seats</span>
                  <span className="flex items-center gap-1"><Gauge size={16}/> {viewCar.consumption}</span>
                  <span className="flex items-center gap-1"><Zap size={16}/> {viewCar.transmission}</span>
                </div>
                <div className="flex gap-2 mb-6">
                  {viewCar.isAWD && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-3 py-1 rounded-full text-xs font-bold"><Mountain size={12} className="inline mr-1"/> AWD</span>}
                  {(viewCar.fuel === 'Hybrid' || viewCar.fuel === 'Electric') && <span className="bg-green-100 dark:bg-green-900/30 text-green-600 px-3 py-1 rounded-full text-xs font-bold"><Leaf size={12} className="inline mr-1"/> Fuel Saver</span>}
                  {viewCar.hasCarPlay && <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold"><Smartphone size={12} className="inline mr-1"/> CarPlay</span>}
                  {viewCar.hasBluetooth && <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold"><Bluetooth size={12} className="inline mr-1"/> Bluetooth</span>}
                </div>
                <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
                  <div className="flex justify-between items-end">
                    <div><span className="text-zinc-500 text-sm">Starting at</span><div className="text-4xl font-bold text-green-600" data-testid="text-car-detail-price">${viewCar.price}<span className="text-lg text-zinc-500">/day</span></div></div>
                    <Button onClick={() => handleRent(viewCar)} className="px-8" data-testid="button-rent-detail">Reserve Now</Button>
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
          </div>
        )}
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
