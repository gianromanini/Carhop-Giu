import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Car, Settings, Plus, Trash2, Check, Calendar, Leaf, DollarSign, ArrowLeft, Shield, Mountain, Smartphone, Gauge, Zap, Edit, X, Image, ChevronRight, ChevronLeft, Info, Search, MapPin, User, Menu, Users, Activity, Phone, Sun, Moon, Clock, LogOut, Map, Bluetooth, Camera, Route, Upload, Mail, FileText, Download, CreditCard, AlertTriangle, AlertCircle, CalendarClock, Lock, Fuel, Loader, Briefcase, List, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut, Move, Thermometer, Unlock, BatteryCharging, Armchair, Navigation, BarChart3, TrendingUp, Wallet, Receipt, MoreHorizontal, MessageCircle, Send, Bell, MoreVertical
} from 'lucide-react';
import type { Vehicle, Booking } from '@shared/schema';
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
                  <div className="flex justify-between"><span className="text-orange-400">Expenses:</span> <span>${expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-green-400">Revenue:</span> <span>${gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between"><span className="text-purple-400">Pending:</span> <span>${pending.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between font-bold border-t border-zinc-700 pt-1 mt-1"><span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>Net:</span> <span>${net.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
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

const initialFormState = { model: '', category: '', price: '', fuel: 'Gasoline', seats: 5, transmission: 'Automatic', driveType: 'AWD', images: [''], consumption: '', isPriceMatch: false, isAWD: false, hasCarPlay: false, hasBluetooth: false, hasReverseCamera: false, hasHeatedSeats: false, hasHeatedSteering: false, hasElectricSeats: false, hasPaddleShifters: false, hasKeylessEntry: false, hasBlindSpotWarning: false, hasDriveAssist: false, hasUSBCharger: false };
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
  const { user: authUser, isAuthenticated } = useAuth();
  const [view, setView] = useState('home');
  const [darkMode, setDarkMode] = useState(true);
  const [adminTab, setAdminTab] = useState('fleet');
  
  const [clientUser, setClientUser] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState<'oauth' | 'signup'>('oauth');
  
  useEffect(() => {
    if (isAuthenticated && authUser) {
      const fullName = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || authUser.email?.split('@')[0] || 'User';
      setClientUser({ name: fullName, email: authUser.email || '' });
      setDriverDetails(prev => ({ ...prev, name: fullName, email: authUser.email || '' }));
      setShowLoginModal(false);
    }
  }, [isAuthenticated, authUser]);
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
  const [selectedExpenseVehicleId, setSelectedExpenseVehicleId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState<{lease: number; insurance: number; carWash: number; maintenance: number; trackApp: number; downPayment: number}>({ lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
  
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [checkData, setCheckData] = useState(initialCheckState);
  const [isCheckOutMode, setIsCheckOutMode] = useState(false);
  const [viewingReceiptBookingId, setViewingReceiptBookingId] = useState<number | null>(null);

  const [adjustment, setAdjustment] = useState({ type: 'fixed', value: '' });
  const [extraCharge, setExtraCharge] = useState({ type: 'Refuel', amount: '' });
  const [extraPaymentAmount, setExtraPaymentAmount] = useState('');

  const [newLocation, setNewLocation] = useState('');
  
  const [carRentalAgreementAccepted, setCarRentalAgreementAccepted] = useState(false);
  const [showCarRentalModal, setShowCarRentalModal] = useState(false);
  const [viewingCarRentalOnly, setViewingCarRentalOnly] = useState(false);
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [extensionRequestReason, setExtensionRequestReason] = useState('');

  const [cart, setCart] = useState<{ car: Vehicle | null; days: number; billingDays: number; extrasSelected: string[]; insuranceOption: string }>({ car: null, days: 3, billingDays: 3, extrasSelected: [], insuranceOption: '1000' });
  const [viewCar, setViewCar] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState(false);

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

  const settings: SettingsType = settingsData || { taxes: 8.5, cleaningFee: 25, includedMiles: 200, extraMileRate: 0.45, prices: { insurance500: 25, insurance1000: 15, childSeat: 8 }, locations: ['JFK Airport', 'Downtown Center', 'Fairfield County'] };

  const createVehicleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/vehicles', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); setFormData(initialFormState); }
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
      setEditingId(null); 
    }
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

  useEffect(() => {
    if ((view === 'checkout' || view === 'payment') && cart.car && searchParams.start && searchParams.end && searchParams.startTime && searchParams.endTime) {
      const billingDays = calculateBillingDays(searchParams.start, searchParams.startTime, searchParams.end, searchParams.endTime);
      setCart(prev => ({ ...prev, billingDays }));
    }
  }, [searchParams.end, searchParams.endTime, searchParams.start, searchParams.startTime, view, cart.car?.id]);

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
      const newUser = { name: isRegistering ? loginForm.name : "Client User", email: loginForm.email, phone: loginForm.phone };
      setClientUser(newUser);
      setDriverDetails(prev => ({ ...prev, name: newUser.name, email: newUser.email, phone: newUser.phone || '' }));
      setShowLoginModal(false);
      if (view === 'manage-redirect') setView('bookings');
    }
  };


  const handleAdminLogin = () => { setShowLoginModal(false); setView('admin'); };
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
       const allowedMiles = settings.includedMiles * activeBooking.days;
       const milesDriven = checkOutMiles - checkInMiles;
       const excessMiles = Math.max(0, milesDriven - allowedMiles);
       const excessMileageFee = excessMiles * settings.extraMileRate;
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
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center gap-2 hover:text-green-600 dark:hover:text-white transition-colors cursor-pointer"><Phone size={16} /> <span>(475) 449-8622</span></div>
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

          <div className="flex md:hidden items-center justify-end gap-2 flex-1">
            {clientUser && (
              <button onClick={() => setView('bookings')} className="text-sm font-bold hover:text-green-600 dark:hover:text-green-500 transition-colors uppercase tracking-wide relative" data-testid="button-bookings-mobile-header">
                Bookings
                {getClientUnreadCount() > 0 && (
                  <span className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{getClientUnreadCount()}</span>
                )}
              </button>
            )}
            <div className="relative">
              <button onClick={() => setMobileActionsMenuOpen(!mobileActionsMenuOpen)} className="p-2 hover:text-green-600 dark:hover:text-green-500 transition-colors" data-testid="button-actions-menu">
                <Menu className="h-5 w-5" />
              </button>
              {mobileActionsMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-[150px] overflow-hidden">
                  {clientUser ? (
                    <>
                      <div className="w-full px-4 py-2 text-center text-sm text-green-600 font-bold flex items-center justify-center gap-2">Hi, {clientUser.name.split(' ')[0]}</div>
                      <button onClick={() => { setView('bookings'); setMobileActionsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 whitespace-nowrap" data-testid="button-menu-chat-logged"><MessageCircle className="h-4 w-4" />Chat / Support</button>
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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-red-500 transition-colors" data-testid="button-close-modal"><X size={20}/></button>
            <div className="flex gap-2 mb-4 sm:mb-5 border-b border-zinc-200 dark:border-zinc-800">
              <button 
                onClick={() => setAuthMode('oauth')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${authMode === 'oauth' ? 'text-green-600 border-b-2 border-green-600' : 'text-zinc-500'}`}
                data-testid="button-oauth-tab"
              >
                Quick Sign In
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${authMode === 'signup' ? 'text-green-600 border-b-2 border-green-600' : 'text-zinc-500'}`}
                data-testid="button-signup-tab"
              >
                Create Account
              </button>
            </div>

            {authMode === 'oauth' ? (
              <>
                <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-5 text-center text-zinc-900 dark:text-white">Sign In to CarHop</h2>
                <p className="text-center text-sm text-zinc-500 mb-6">Sign in with your account to continue</p>
                <div className="space-y-2">
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
                  <Button 
                    variant="secondary" 
                    className="w-full flex items-center justify-center gap-3 text-sm py-3 border-2 bg-black text-white hover:bg-zinc-800" 
                    onClick={() => window.location.href = '/api/auth/apple'} 
                    data-testid="button-apple-login"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.29.89 3.04.89.9 0 2.29-1.16 3.86-1.04.64.03 2.46.25 3.64 1.84-3.38 2.08-2.81 6.48.28 7.74-.95 1.78-2.27 2.97-4.52 3.74z"/>
                    </svg>
                    <span className="font-bold">Continue with Apple</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-5 text-center text-zinc-900 dark:text-white">Create Your CarHop Account</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    const response = await fetch('/api/auth/signup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        firstName: formData.get('firstName'),
                        lastName: formData.get('lastName'),
                        email: formData.get('email'),
                        phone: formData.get('phone'),
                        password: formData.get('password'),
                      }),
                    });
                    if (response.ok) {
                      window.location.href = '/';
                    } else {
                      const error = await response.json();
                      alert(error.message || 'Signup failed');
                    }
                  } catch (err) {
                    alert('Error signing up');
                  }
                }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" name="firstName" placeholder="First Name" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-first-name" />
                    <input type="text" name="lastName" placeholder="Last Name" required className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-last-name" />
                  </div>
                  <input type="email" name="email" placeholder="Email Address" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-email" />
                  <input type="tel" name="phone" placeholder="Phone Number" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-phone" />
                  <input type="password" name="password" placeholder="Password (min 6 chars)" required className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" data-testid="input-password" />
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 mt-4" data-testid="button-signup-submit">Create Account</Button>
                </form>
              </>
            )}

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <button onClick={handleAdminLogin} className="text-[10px] sm:text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 mx-auto" data-testid="button-admin-login"><Settings size={10}/> Admin / Owner Login</button>
            </div>
          </div>
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
                  <span className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4">Price Match Guarantee</span>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 sm:mb-4" data-testid="text-hero-title">The Best price rental in Fairfield County <br/><span className="text-green-500">Up to $39/Day</span></h1>
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
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 sm:p-3">
                          <Calendar size={16} className="text-green-600 mr-2 flex-shrink-0" />
                          <input type="date" value={searchParams.start} onChange={e => handleSearchParamsChange('start', e.target.value)} min={getTodayString()} className="bg-transparent w-full outline-none text-xs sm:text-sm text-zinc-900 dark:text-white" data-testid="input-start-date" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Return Date</label>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 sm:p-3">
                          <Calendar size={16} className="text-green-600 mr-2 flex-shrink-0" />
                          <input type="date" value={searchParams.end} onChange={e => handleSearchParamsChange('end', e.target.value)} min={searchParams.start} className="bg-transparent w-full outline-none text-xs sm:text-sm text-zinc-900 dark:text-white" data-testid="input-end-date" />
                        </div>
                      </div>
                    </div>
                    <Button className="w-full py-2 sm:py-4 text-xs sm:text-sm" onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                      {isSearching ? <><Loader className="animate-spin" size={16} sm:size-20/> Searching...</> : <><Search size={16}/> Search Vehicles</>}
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
                {vehicles.map((car) => (
                  <div key={car.id} onClick={() => handleViewDetails(car)} data-testid={`card-vehicle-${car.id}`}>
                    <Card className="group cursor-pointer hover-elevate overflow-visible">
                      <div className="relative overflow-hidden rounded-t-lg">
                        <img src={car.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60'} alt={car.model} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate flex-1" data-testid={`text-vehicle-name-${car.id}`}>{car.model}</h3>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg sm:text-2xl font-bold text-green-600" data-testid={`text-vehicle-price-${car.id}`}>${car.price}</div>
                            <div className="text-[10px] sm:text-xs text-zinc-500">/day</div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400 mb-4 flex-wrap">
                          <span className="flex items-center gap-1"><Users size={14}/> {car.seats} passengers</span>
                          <span className="flex items-center gap-1">
                            {car.driveType === 'AWD' && <Mountain size={14} />}
                            {car.driveType === 'FWD' && <Navigation size={14} />}
                            {car.driveType === 'RWD' && <Navigation size={14} className="transform rotate-180" />}
                            {car.driveType}
                          </span>
                          <span className="flex items-center gap-1"><Gauge size={14}/> {car.consumption}</span>
                          <span className="flex items-center gap-1"><Zap size={14}/> {car.transmission}</span>
                        </div>
                        <Button className="w-full" onClick={(e: any) => { e.stopPropagation(); handleRent(car); }} data-testid={`button-rent-${car.id}`}>Book Now</Button>
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
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-start justify-between mb-8 gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white" data-testid="text-admin-title">Admin</h1>
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setDarkMode(!darkMode)} data-testid="button-admin-theme">
                  {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0" data-testid="button-admin-chat">
                  <MessageCircle size={14}/>
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center gap-2 mb-6 overflow-x-auto pb-2">
              {['fleet', 'bookings', 'earnings'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${adminTab === tab ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`} data-testid={`button-tab-${tab}`}>
                  {tab === 'fleet' && <Car size={18} />}
                  {tab === 'bookings' && <Briefcase size={18} />}
                  {tab === 'earnings' && <TrendingUp size={18} />}
                  <span className="md:text-xs text-xs">{tab}</span>
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

                    <div className="mb-3">
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Drive Type</label>
                      <select name="driveType" value={formData.driveType} onChange={handleInputChange} className="w-full p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none" data-testid="select-vehicle-drive-type">
                        <option value="AWD">AWD (All-Wheel Drive)</option>
                        <option value="FWD">FWD (Front-Wheel Drive)</option>
                        <option value="RWD">RWD (Rear-Wheel Drive)</option>
                      </select>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - All Bookings List */}
                <Card className="p-3 sm:p-4 md:col-span-1 max-h-[85vh] overflow-y-auto">
                  <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">All Bookings</h3>
                  <div className="space-y-2">
                    {bookings.map(b => {
                      const statusColor = b.status === 'Completed' ? 'bg-green-600 text-white' : (b.status === 'Active' || b.status === 'Extended') ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white';
                      const statusText = b.status === 'Completed' ? 'COMPLETED' : b.status === 'Active' ? 'ACTIVE' : b.status;
                      const pendingRequests = getPendingRequestsCount(b);
                      const unreadMessages = getUnreadMessagesCount(b, 'admin');
                      const hasNotifications = pendingRequests > 0 || unreadMessages > 0;
                      return (
                        <div key={b.id} onClick={() => setManageBookingId(b.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${manageBookingId === b.id ? 'border-green-500 bg-green-950/30' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}`} data-testid={`card-booking-${b.id}`}>
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              {hasNotifications && (
                                <span className="text-yellow-500 animate-pulse" title={`${pendingRequests} pending requests, ${unreadMessages} unread messages`}>
                                  <AlertCircle size={14}/>
                                </span>
                              )}
                              <span className="font-bold text-sm text-white">{b.bookingCode}</span>
                              <span className="text-[10px] text-zinc-500">{b.startDate}</span>
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${statusColor}`}>{statusText}</span>
                          </div>
                          <div className="text-xs text-zinc-400 font-medium">{b.carName}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{b.driver.name}</div>
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
                            <div className="text-left sm:text-right text-[10px] sm:text-xs text-zinc-500">
                              <div>{b.date}</div>
                              <div>{b.paymentMethod || 'Credit Card (Visa **** 4242)'}</div>
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
                                <p className="text-zinc-500">{b.startDate} to {b.returnDate}</p>
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
                            <h4 className="text-xs font-bold uppercase text-zinc-400 mb-3">Financial Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between text-zinc-300"><span>Base Rate</span><span>${b.details.rate.toFixed(2)}</span></div>
                              <div className="flex justify-between text-zinc-300"><span>Extras</span><span>${b.details.extras.toFixed(2)}</span></div>
                              {b.details.protection > 0 && (
                                <div className="flex justify-between text-zinc-300"><span>Protection</span><span>${b.details.protection.toFixed(2)}</span></div>
                              )}
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
                              
                              {/* Extra Payments Already Processed */}
                              {b.extraPayments && b.extraPayments.length > 0 && (
                                <>
                                  <div className="text-xs text-zinc-500 mt-3 mb-1">Processed Extra Payments:</div>
                                  {b.extraPayments.map((p, i) => (
                                    <div key={i} className="flex justify-between text-orange-400">
                                      <span className="flex items-center gap-1">
                                        <Check size={12}/> {p.type}
                                      </span>
                                      <span>+${p.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              <div className="flex justify-between border-t border-zinc-700 pt-3 mt-3 font-bold text-white">
                                <span>Total Billed</span>
                                <span>${b.total.toFixed(2)}</span>
                              </div>
                              
                              {/* Extra Payment Charge */}
                              <div className="mt-4 pt-4 border-t border-zinc-700">
                                <div className="text-xs text-zinc-500 mb-2">Charge {b.paymentMethod || 'Credit Card'}</div>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                                    <input
                                      type="number"
                                      value={extraPaymentAmount || calculateExtraChargesTotal(b).toFixed(2)}
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
                                    Charge extra payment Trip
                                  </button>
                                </div>
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
                <Card className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={20} className="text-green-500"/> Revenue & Finance Overview
                    </h3>
                    <div className="text-right">
                      <span className="text-xs text-zinc-500">Monthly Fleet Fixed Cost: </span>
                      <span className="text-sm font-bold text-orange-500">${(financialData?.fixedMonthly || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-900/20 p-4 rounded-xl border border-green-800/30">
                      <div className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Total Gross Revenue</div>
                      <div className="text-3xl font-bold text-green-500">${Object.values(financialData?.monthly || {}).reduce((sum: number, m: any) => sum + (m.gross || 0) + (m.pending || 0), 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/30">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Completed Trips</div>
                      <div className="text-3xl font-bold text-white">{bookings.filter(b => b.status === 'Completed').length}</div>
                    </div>
                  </div>
                  
                  {/* Monthly Performance Chart */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Monthly Financial Performance</h4>
                    {financialData && <FinancialBarChart data={financialData.monthly} fixedExpenses={financialData.fixedMonthly} />}
                    <div className="flex justify-center gap-6 mt-4">
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-orange-500 rounded"></span> Expenses</span>
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-green-500 rounded"></span> Gross Revenue</span>
                      <span className="flex items-center gap-2 text-xs"><span className="w-3 h-3 bg-purple-500 rounded"></span> Pending</span>
                    </div>
                  </div>
                </Card>
                
                {/* Bottom Section - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Monthly Vehicle Expenses */}
                  <Card className="p-6">
                    <h3 className="text-base font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <DollarSign size={18}/> Monthly Vehicle Expenses
                    </h3>
                    
                    {/* Vehicle Selector */}
                    <div className="mb-4">
                      <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">Select Vehicle to Update</label>
                      <select 
                        className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white"
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Down Payment ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.downPayment || ''} onChange={(e) => setExpenseForm({...expenseForm, downPayment: parseFloat(e.target.value) || 0})} data-testid="input-expense-downpayment"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Lease / Financing ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.lease || ''} onChange={(e) => setExpenseForm({...expenseForm, lease: parseFloat(e.target.value) || 0})} data-testid="input-expense-lease"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Insurance ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.insurance || ''} onChange={(e) => setExpenseForm({...expenseForm, insurance: parseFloat(e.target.value) || 0})} data-testid="input-expense-insurance"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Car Wash ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.carWash || ''} onChange={(e) => setExpenseForm({...expenseForm, carWash: parseFloat(e.target.value) || 0})} data-testid="input-expense-carwash"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Maintenance ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.maintenance || ''} onChange={(e) => setExpenseForm({...expenseForm, maintenance: parseFloat(e.target.value) || 0})} data-testid="input-expense-maintenance"/>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1 uppercase">Tracking / App ($)</label>
                        <input type="number" className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white" placeholder="0.00" value={expenseForm.trackApp || ''} onChange={(e) => setExpenseForm({...expenseForm, trackApp: parseFloat(e.target.value) || 0})} data-testid="input-expense-trackapp"/>
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
                  <Card className="p-6">
                    <h3 className="text-base font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                      <BarChart3 size={18}/> Financial Status by Vehicle
                    </h3>
                    
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {vehicles.map(vehicle => {
                        const vehicleData = financialData?.byVehicle?.[vehicle.model] || { gross: 0, pending: 0, expenses: 0 };
                        const gross = (vehicleData.gross || 0) + (vehicleData.pending || 0);
                        const expenses = vehicleData.expenses || 0;
                        const balance = gross - expenses;
                        
                        return (
                          <div key={vehicle.id} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              {/* Vehicle Image */}
                              <div className="w-16 h-12 rounded overflow-hidden shrink-0">
                                <img src={vehicle.images[0]} alt={vehicle.model} className="w-full h-full object-cover"/>
                              </div>
                              
                              {/* Vehicle Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-bold text-sm text-white truncate">{vehicle.model}</h4>
                                    <p className="text-[10px] text-zinc-500">{vehicle.category}</p>
                                  </div>
                                  <button 
                                    className="text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded px-2 py-1 shrink-0"
                                    onClick={() => {
                                      setSelectedExpenseVehicleId(vehicle.id);
                                      setExpenseForm(vehicle.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 });
                                    }}
                                  >
                                    Edit
                                  </button>
                                </div>
                                
                                {/* Financial Stats */}
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                  <div>
                                    <div className="text-[9px] text-green-500 uppercase font-bold">Gross Revenue</div>
                                    <div className="text-sm font-bold text-green-500">${gross.toFixed(0)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9px] text-orange-500 uppercase font-bold">Monthly Exp</div>
                                    <div className="text-sm font-bold text-orange-500">${expenses.toFixed(0)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9px] text-zinc-400 uppercase font-bold">Net Balance</div>
                                    <div className={`text-sm font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-500'}`}>
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
              </div>
            )}

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
                      <p>The Lessee is entitled to {settings.includedMiles} miles per day included in the rental. Excess mileage will be charged at ${settings.extraMileRate} per mile. The vehicle must be returned with a full fuel tank. Refueling charges will apply if the vehicle is returned with less fuel.</p>
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
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-in Photos</p>
                      <div className="grid grid-cols-3 gap-3">
                        {receiptBooking.checkInData.photosOutside.slice(0, 6).map((photo, idx) => (
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
                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Check-out Photos</p>
                      <div className="grid grid-cols-3 gap-3">
                        {receiptBooking.checkOutData.photosOutside.slice(0, 6).map((photo, idx) => (
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
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Rental Rate ({receiptBooking.days} days)</span>
                      <span className="text-zinc-900 dark:text-white font-medium">${receiptBooking.details?.rate?.toFixed(2) || '0.00'}</span>
                    </div>
                    {receiptBooking.details?.protection > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Protection</span>
                        <span className="text-zinc-900 dark:text-white">+${receiptBooking.details.protection.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptBooking.details?.extras && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Extras</span>
                        <span className="text-green-600 dark:text-green-400">+${receiptBooking.details.extras.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptBooking.details?.fees && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Cleaning Fee</span>
                        <span className="text-zinc-900 dark:text-white">${receiptBooking.details.fees.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptBooking.details?.extendedRate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Extension</span>
                        <span className="text-blue-600 dark:text-blue-400">+${receiptBooking.details.extendedRate.toFixed(2)}</span>
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
                    {receiptBooking.details?.tax && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Tax</span>
                        <span className="text-zinc-900 dark:text-white">${receiptBooking.details.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-3">
                      <span className="text-zinc-900 dark:text-white">Total</span>
                      <span className="text-green-600">${receiptBooking.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button onClick={() => setViewingReceiptBookingId(null)} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors mt-6" data-testid="button-close-receipt">Close Receipt</button>
                </div>
              </div>
            </div>
          );
        })()}

        {view === 'bookings' && (
          <div className="max-w-4xl mx-auto px-6 py-12">
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
                        <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${b.status === 'Extended' || b.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>{b.status}</div>
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
                              
                              return (
                              <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">New Return Date & Time</label>
                                <p className="text-xs text-zinc-500 mb-3">Extend or reduce your booking. Reductions require admin approval.</p>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Calendar size={18} className="text-green-600 mr-2" /><input type="date" className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionDate} min={minDateStr} onChange={(e) => setExtensionDate(e.target.value)} data-testid="input-extension-date" /></div>
                                  <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2"><Clock size={18} className="text-green-600 mr-2" /><select className="bg-transparent w-full outline-none text-sm text-zinc-900 dark:text-white" value={extensionTime} onChange={(e) => setExtensionTime(e.target.value)} data-testid="select-extension-time">{timeOptions.map(t => <option key={t} value={t} className="text-black">{t}</option>)}</select></div>
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
                          disabled
                          className="bg-transparent w-full outline-none text-sm text-white opacity-75 cursor-not-allowed" 
                          data-testid="input-checkout-start-date" 
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                        <Clock size={16} className="text-zinc-500" />
                        <input 
                          type="text"
                          value={searchParams.startTime} 
                          disabled
                          className="bg-transparent w-full outline-none text-sm text-white opacity-75 cursor-not-allowed"
                          data-testid="select-checkout-start-time"
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">Auto-set to current time + 30 min</p>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">RETURN</label>
                      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-2">
                        <Calendar size={16} className="text-zinc-500" />
                        <input 
                          type="date" 
                          value={searchParams.end} 
                          onChange={e => handleSearchParamsChange('end', e.target.value)} 
                          min={getMinReturnDate()} 
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
                      <span className="text-white">Protection</span>
                      <span className="text-white">+${((cart.insuranceOption === '500' ? settings.prices.insurance500 : settings.prices.insurance1000) * cart.billingDays).toFixed(2)}</span>
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
                  {viewCar.hasCarPlay && <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold"><Smartphone size={12} className="inline mr-1"/> CarPlay</span>}
                  {viewCar.hasBluetooth && <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold"><Bluetooth size={12} className="inline mr-1"/> Bluetooth</span>}
                </div>
                <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
                  <div className="flex justify-between items-end">
                    <div><span className="text-zinc-500 text-sm">Starting at</span><div className="text-4xl font-bold text-green-600" data-testid="text-car-detail-price">${viewCar.price}<span className="text-lg text-zinc-500">/day</span></div></div>
                    <Button onClick={() => handleRent(viewCar)} className="px-8" data-testid="button-rent-detail">Book Now</Button>
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
