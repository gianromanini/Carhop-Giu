import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertBookingSchema, insertHostSchema, insertPayoutSchema, type Vehicle } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./googleAuth";
import { getUncachableStripeClient, getStripePublishableKey, verifyStripePaymentIntent } from "./stripeClient";
import { stripBookingImages } from "./bookingUtils";
import { calculateVehicleDiscount } from "@shared/pricing";
import {
  LEGACY_PLATFORM_COMMISSION,
  VEHICLE_DEDUCTIBLES,
  isAllowedVehicleCommission,
} from "@shared/vehicleCommission";
import bcrypt from "bcryptjs";
import { z } from "zod";
import nodemailer from "nodemailer";
import webpush from "web-push";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  popupEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  notifyExtensionRequests: true,
  notifyNewBookings: true,
  notifyMessages: true,
  notifySupportRequests: true,
  showBookingDetails: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  sound: 'chime',
  duplicateIntervalMinutes: 10,
};

function isAdminRequest(req: any): boolean {
  return (req.isAuthenticated?.() && req.user?.isAdmin === true) ||
    req.session?.adminAuthenticated === true;
}

function isHostVehicleRequest(req: any): boolean {
  const passportHost = req.isAuthenticated?.() && req.user?.isHost === true;
  const sessionHost = Boolean(req.session?.authenticatedHostId || req.session?.authenticatedHostEmail);
  return !isAdminRequest(req) && (passportHost || sessionHost);
}

async function getOrphanVehicleSnapshot(vehicleId: number): Promise<any | undefined> {
  const bookings = await storage.getBookings();
  const booking = bookings
    .filter((candidate: any) => Number(candidate.vehicleId) === vehicleId)
    .sort((a: any, b: any) => {
      const activeStatuses = new Set(['Active', 'Extended']);
      return Number(activeStatuses.has(b.status)) - Number(activeStatuses.has(a.status)) ||
        Number(b.id || 0) - Number(a.id || 0);
    })[0];

  if (!booking) return undefined;

  const details = (booking.details || {}) as any;
  const days = Math.max(1, Number(booking.days) || 1);
  const storedDailyRate = Number(details.rentalDailyRate) || Number(details.vehiclePrice);
  const historicalDailyRate = storedDailyRate > 0
    ? storedDailyRate
    : (Number(details.rate || 0) + Number(details.extendedRate || 0)) / days;

  return {
    id: vehicleId,
    model: booking.carName || 'Vehicle from booking',
    category: 'SUV',
    price: Number.isFinite(historicalDailyRate) && historicalDailyRate > 0 ? historicalDailyRate : 0,
    fuel: 'Gasoline',
    seats: 5,
    transmission: 'Automatic',
    driveType: 'AWD',
    year: details.vehicleYear || null,
    vinNumber: null,
    licensePlate: null,
    hostName: details.hostName || null,
    images: booking.image ? [booking.image] : [],
    consumption: null,
    isPriceMatch: false,
    isAWD: true,
    hasCarPlay: false,
    hasBluetooth: false,
    hasReverseCamera: false,
    hasHeatedSeats: false,
    hasHeatedSteering: false,
    hasElectricSeats: false,
    hasPaddleShifters: false,
    hasKeylessEntry: false,
    hasBlindSpotWarning: false,
    hasDriveAssist: false,
    hasUSBCharger: false,
    hostId: details.hostId || null,
    commission: 10,
    deductible: 2250,
    availableLocations: [],
    deliveryAddress: '',
    isDeliveryEnabled: false,
    maxDeliveryDistance: 50,
    minDeliveryFeeMiles: 5,
    minDeliveryFee: 15,
    deliveryPricePerMile: 2.5,
    minDeliveryHours: 6,
    pickupInstructions: '',
    locationLat: null,
    locationLon: null,
    pricing: {
      taxes: 0,
      cleaningFee: 0,
      includedMiles: 0,
      extraMileRate: 0,
      prices: {
        insurance500: 0,
        insurance1000: 0,
        childSeat: 0,
        childSeatPerTrip: false,
      },
      discountPrograms: Array.isArray(details.discountPrograms) ? details.discountPrograms : [],
    },
    expenses: null,
    transferRequests: [],
    availabilityStatus: 'unavailable',
    createdAt: booking.createdAt || null,
    isOrphanedBookingVehicle: true,
  };
}

async function getNotificationSettings() {
  const stored = await storage.getSetting('notifications');
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(stored?.value || {}) };
}

function normalizeVapidKey(value: string | undefined) {
  if (!value) return '';
  const trimmed = value.trim();
  const jsonKeyMatch = trimmed.match(/["'](?:publicKey|privateKey)["']\s*:\s*["']([^"']+)["']/);
  return (jsonKeyMatch?.[1] || trimmed)
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')
    .replace(/=+$/g, '');
}

const vapidPublicKey = normalizeVapidKey(process.env.VAPID_PUBLIC_KEY);
const vapidPrivateKey = normalizeVapidKey(process.env.VAPID_PRIVATE_KEY);
let webPushConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@carhopgo.com',
      vapidPublicKey,
      vapidPrivateKey,
    );
    webPushConfigured = true;
  } catch (error: any) {
    console.error('[Notifications] Invalid VAPID configuration; background push is disabled:', error?.message || 'invalid VAPID keys');
  }
}

type StoredPushSubscription = webpush.PushSubscription & {
  audience: string;
  updatedAt: string;
};

async function getStoredPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const stored = await storage.getSetting('pushSubscriptions');
  return Array.isArray(stored?.value) ? stored.value as StoredPushSubscription[] : [];
}

async function saveStoredPushSubscriptions(subscriptions: StoredPushSubscription[]) {
  await storage.setSetting('pushSubscriptions', subscriptions);
}

async function getPushAudiencesForRequest(req: any): Promise<string[]> {
  if (isAdminRequest(req)) return ['admin'];

  const sessionHostId = req.session?.authenticatedHostId;
  if (sessionHostId) return [`host:${sessionHostId}`];

  if (req.isAuthenticated?.() && req.user?.isHost && req.user?.email) {
    const host = await storage.getHostByEmail(req.user.email).catch(() => undefined);
    if (host) return [`host:${host.id}`];
  }

  if (req.isAuthenticated?.() && req.user?.id && !req.user?.isHost) {
    return [`client:${String(req.user.id)}`];
  }

  return [];
}

async function sendWebPushNotification(audiences: string[], payload: {
  title: string;
  body: string;
  bookingId?: number;
  targetUrl?: string;
}) {
  if (!webPushConfigured || audiences.length === 0) return false;

  const subscriptions = await getStoredPushSubscriptions();
  const matching = subscriptions.filter(subscription => audiences.includes(subscription.audience));
  if (matching.length === 0) return false;

  const staleEndpoints = new Set<string>();
  const results = await Promise.allSettled(matching.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: payload.bookingId ? `booking-${payload.bookingId}` : 'carhopgo-notification',
        data: {
          bookingId: payload.bookingId,
          targetUrl: payload.targetUrl || '/',
        },
        vibrate: [180, 80, 180],
      }));
      return true;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) staleEndpoints.add(subscription.endpoint);
      console.error('[Notifications] Web Push delivery failed:', error?.statusCode || error?.message || error);
      return false;
    }
  }));

  if (staleEndpoints.size > 0) {
    await saveStoredPushSubscriptions(
      subscriptions.filter(subscription => !staleEndpoints.has(subscription.endpoint))
    );
  }

  return results.some(result => result.status === 'fulfilled' && result.value === true);
}

async function sendConfiguredStaffPush(
  audiences: string[],
  setting: 'notifyExtensionRequests' | 'notifyNewBookings' | 'notifyMessages' | 'notifySupportRequests',
  payload: { title: string; body: string; bookingId?: number; targetUrl?: string },
) {
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.pushEnabled || !settings[setting]) return false;
  return sendWebPushNotification(audiences, payload);
}

async function notifyBookingStaff(
  booking: any,
  vehicle: any,
  setting: 'notifyNewBookings' | 'notifyMessages',
  payload: { title: string; body: string },
) {
  const audiences = ['admin'];
  const hostId = vehicle?.hostId || booking?.details?.hostId;
  if (hostId) audiences.push(`host:${hostId}`);
  return sendConfiguredStaffPush(audiences, setting, {
    ...payload,
    bookingId: booking?.id,
    targetUrl: '/',
  });
}

async function notifyBookingClient(
  booking: any,
  payload: { title: string; body: string },
) {
  const userId = booking?.userId || (
    booking?.driver?.email
      ? (await storage.getUserByEmail(String(booking.driver.email)).catch(() => undefined))?.id
      : undefined
  );
  if (!userId) return false;

  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.pushEnabled) return false;

  return sendWebPushNotification([`client:${String(userId)}`], {
    ...payload,
    bookingId: booking.id,
    targetUrl: `/?view=bookings&bookingId=${encodeURIComponent(booking.id)}`,
  });
}

async function notifyAdminOfSupportRequest(message: any) {
  return sendConfiguredStaffPush(['admin'], 'notifySupportRequests', {
    title: 'New support request',
    body: `${message.senderName || 'A user'} sent a new support message.`,
    targetUrl: '/?view=admin&tab=support',
  });
}

async function notifyHostOfSupportReply(message: any, reply: string) {
  if (message?.senderType !== 'host') return false;
  const email = message.senderEmail || message.senderIdentifier;
  const host = email?.includes('@')
    ? await storage.getHostByEmail(email).catch(() => null)
    : null;
  const hostId = host?.id || (String(message.senderId || '').match(/^\d+$/) ? message.senderId : null);
  if (!hostId) return false;
  return sendConfiguredStaffPush([`host:${hostId}`], 'notifySupportRequests', {
    title: 'New support reply',
    body: reply || 'CarHop Support replied to your message.',
    targetUrl: '/?view=host-dashboard&tab=chat',
  });
}

/**
 * Returns the daily protection price that was used for a booking.
 *
 * New bookings persist this value explicitly. For older bookings, the
 * original protection total is reliable only before the first extension;
 * after an extension, use the selected plan to avoid dividing an already
 * extended total by the new number of days.
 */
function getProtectionDailyRate(details: any, vehicle: any, settingsObj: any, bookingDays: number): number {
  const storedRate = Number(details?.protectionDailyRate);
  if (Number.isFinite(storedRate) && storedRate >= 0) return storedRate;

  const protectionTotal = Number(details?.protection || 0);
  const safeDays = Math.max(1, Number(bookingDays) || 1);
  const hasPreviousExtension = Number(details?.extendedRate || 0) > 0;

  if (!hasPreviousExtension && protectionTotal > 0) {
    return protectionTotal / safeDays;
  }

  const vehicleStandard = Number(vehicle?.pricing?.prices?.insurance500);
  const settingsStandard = Number(settingsObj?.prices?.insurance500);
  const standardRate = Number.isFinite(vehicleStandard)
    ? vehicleStandard
    : Number.isFinite(settingsStandard) ? settingsStandard : 25.90;
  const protectionType = String(details?.protectionType || '').trim().toLowerCase();

  if (protectionType === 'minimum') return 19.40;
  if (protectionType === 'gold') return standardRate + 16.90;
  if (protectionType === 'standard') return standardRate;

  return protectionTotal / safeDays;
}

function getRentalDailyRate(details: any, vehicle: any, bookingDays: number): number {
  const storedRate = Number(details?.rentalDailyRate);
  if (Number.isFinite(storedRate) && storedRate > 0) return storedRate;

  const vehicleRate = Number(vehicle?.price);
  if (Number.isFinite(vehicleRate) && vehicleRate > 0) return vehicleRate;

  const rentalTotal = Number(details?.rate || 0);
  const safeDays = Math.max(1, Number(bookingDays) || 1);
  return rentalTotal > 0 ? rentalTotal / safeDays : 0;
}

function calculateExtensionPricing(vehicle: any, extensionDays: number, dailyRate: number) {
  if (extensionDays <= 0) {
    return {
      grossRental: 0,
      discountAmount: 0,
      discountPercent: 0,
      netRental: 0,
    };
  }
  return calculateVehicleDiscount(vehicle, extensionDays, dailyRate);
}

// Email notification helper functions
async function sendBookingConfirmationEmail(booking: any, vehicle: any) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;

  const bookingIsPending = booking.status === 'Pending Approval' ||
    booking.details?.bookingApprovalStatus === 'pending';
  const deliveryType = booking.details?.deliveryType || 'pickup';
  const deliveryAddress = booking.details?.deliveryAddress || '';
  const pickupAddress = booking.details?.pickupAddress || booking.location || '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - ${bookingIsPending ? 'Booking Request Received' : 'Booking Confirmation'} #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">${bookingIsPending ? 'Booking Request Received' : 'Booking Confirmed!'}</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              ${bookingIsPending
                ? 'Your booking request has been received. The host or admin must release the vehicle before payment is available.'
                : 'Your booking has been confirmed! Here are your rental details:'}
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Vehicle:</strong> ${booking.carName || vehicle?.model || 'N/A'}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Pick-up Date:</strong> ${booking.startDate} at ${booking.startTime}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Return Date:</strong> ${booking.returnDate} at ${booking.returnTime}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Duration:</strong> ${booking.days} day(s)
              </p>
              ${bookingIsPending ? `
                <p style="margin: 0; color: #f59e0b;">
                  <strong>Next step:</strong> Wait for the host or admin to approve the vehicle. No payment has been taken.
                </p>
              ` : deliveryType === 'delivery' ? `
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Delivery Address:</strong> ${deliveryAddress}
                </p>
                <p style="margin: 0; color: #f59e0b;">
                  <strong>Note:</strong> Delivery is pending approval. You will receive a notification once approved.
                </p>
              ` : `
                <p style="margin: 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Pickup Location:</strong> ${pickupAddress}
                </p>
              `}
            </div>
            
            <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #0369a1; font-size: 14px;">
                <strong>Total Amount:</strong> $${(booking.total || 0).toFixed(2)}
              </p>
            </div>
            
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
              CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Booking confirmation email sent to ${clientEmail}`);
  } catch (error) {
    console.error("Error sending booking confirmation email:", error);
  }
}

async function sendDeliveryApprovalEmail(booking: any, status: 'approved' | 'rejected', pickupLocation: string) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;

  const isApproved = status === 'approved';
  const deliveryAddress = booking.details?.deliveryAddress || '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Delivery Request ${isApproved ? 'Approved' : 'Declined'} #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${isApproved ? '#22c55e' : '#f59e0b'} 0%, ${isApproved ? '#16a34a' : '#d97706'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Delivery ${isApproved ? 'Approved!' : 'Declined'}</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            
            ${isApproved ? `
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Great news! Your delivery request has been <strong style="color: #22c55e;">approved</strong>. The vehicle will be delivered to your specified address at the scheduled time.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
                </p>
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Delivery Address:</strong> ${deliveryAddress}
                </p>
                <p style="margin: 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Delivery Date:</strong> ${booking.startDate} at ${booking.startTime}
                </p>
              </div>
            ` : `
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                We're sorry, but your delivery request has been <strong style="color: #f59e0b;">declined</strong>. However, you can still pick up the vehicle at our location.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
                </p>
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Pickup Location:</strong> ${pickupLocation}
                </p>
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Pickup Date:</strong> ${booking.startDate} at ${booking.startTime}
                </p>
                <p style="margin: 0; color: #22c55e;">
                  <strong>Good News:</strong> The delivery fee has been removed from your total.
                </p>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupLocation)}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  View Pickup Location on Map
                </a>
              </div>
            `}
            
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
              CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Delivery ${status} email sent to ${clientEmail}`);
  } catch (error) {
    console.error("Error sending delivery approval email:", error);
  }
}

async function sendBookingApprovalEmail(booking: any, status: 'approved' | 'rejected') {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;
  const isApproved = status === 'approved';
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Booking Request ${isApproved ? 'Approved' : 'Declined'} #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${isApproved ? '#22c55e 0%, #16a34a' : '#ef4444 0%, #b91c1c'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Booking Request ${isApproved ? 'Approved!' : 'Declined'}</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
              ${isApproved
                ? 'The host has released the vehicle for your requested dates. Complete your payment in My Bookings to confirm the reservation.'
                : 'The vehicle is not available for your requested dates. No payment was taken. Please choose another vehicle or dates.'}
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${isApproved ? '#22c55e' : '#ef4444'};">
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}</p>
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Vehicle:</strong> ${booking.carName || 'N/A'}</p>
              <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">Dates:</strong> ${booking.startDate} to ${booking.returnDate}</p>
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">CarHop LLC - Connecticut, USA</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending booking approval email:", error);
  }
}

// Helper: convert 12-hour time string to 24-hour (server-side)
function convertTimeTo24HourServer(timeStr: string): string {
  const parts = (timeStr || '12:00 PM').trim().split(' ');
  const [time, period] = [parts[0], parts[1] || 'AM'];
  let [h, m] = time.split(':').map(Number);
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function sendForceExtendEmail(booking: any, newReturnDate: string, newReturnTime: string, extraDays: number, extraCost: number, note?: string) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Trip Extended #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Trip Extended!</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Your trip for <strong>${booking.carName}</strong> has been extended by the host.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}</p>
              <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">New Return Date:</strong> ${newReturnDate} at ${newReturnTime}</p>
              <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Extra Days:</strong> ${extraDays}</p>
              <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">Additional Charge:</strong> $${extraCost.toFixed(2)}</p>
              ${note ? `<p style="margin: 10px 0 0 0; color: #6b7280;"><strong style="color: #1f2937;">Note:</strong> ${note}</p>` : ''}
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622.<br/>CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending force-extend email:", error);
  }
}

async function sendLateReturnEmail(booking: any, extraDays: number, lateReturnFee: number) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Late Return Fee Applied #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Late Return Fee</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Your vehicle was returned after the scheduled return date. A late return fee has been applied.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}</p>
              <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Extra Days:</strong> ${extraDays}</p>
              <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">Late Return Fee:</strong> $${lateReturnFee.toFixed(2)}</p>
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622.<br/>CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending late return email:", error);
  }
}

async function sendExtensionResponseEmail(booking: any, status: 'approved' | 'rejected', requestDetails: any) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;

  const isApproved = status === 'approved';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Extension Request ${isApproved ? 'Approved' : 'Declined'} #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${isApproved ? '#22c55e' : '#ef4444'} 0%, ${isApproved ? '#16a34a' : '#dc2626'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Extension ${isApproved ? 'Approved!' : 'Declined'}</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            
            ${isApproved ? `
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Your extension request has been <strong style="color: #22c55e;">approved</strong>! Your new return date has been updated.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
                </p>
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">New Return Date:</strong> ${requestDetails?.requestedReturnDate} at ${requestDetails?.requestedReturnTime}
                </p>
              </div>
              
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                Please note that additional charges may apply for the extended period.
              </p>
            ` : `
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                We're sorry, but your extension request has been <strong style="color: #ef4444;">declined</strong>. Please return the vehicle by the original date and time.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 0 0 10px 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
                </p>
                <p style="margin: 0; color: #6b7280;">
                  <strong style="color: #1f2937;">Original Return Date:</strong> ${booking.returnDate} at ${booking.returnTime}
                </p>
              </div>
              
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                If you need to extend your rental, please contact us to discuss available options.
              </p>
            `}
            
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
              CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Extension ${status} email sent to ${clientEmail}`);
  } catch (error) {
    console.error("Error sending extension response email:", error);
  }
}

async function sendCheckInCompletedEmail(booking: any) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Check-In Completed #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Check-In Complete!</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Your vehicle check-in has been successfully completed! You're all set to enjoy your rental.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Vehicle:</strong> ${booking.carName || 'N/A'}
              </p>
              <p style="margin: 0; color: #6b7280;">
                <strong style="color: #1f2937;">Return Date:</strong> ${booking.returnDate} at ${booking.returnTime}
              </p>
            </div>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Reminder:</strong> Please return the vehicle by your scheduled date and time to avoid late fees.
              </p>
            </div>
            
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
              CarHop LLC - Connecticut, USA
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Check-in completed email sent to ${clientEmail}`);
  } catch (error) {
    console.error("Error sending check-in completed email:", error);
  }
}

async function sendCheckOutCompletedEmail(booking: any) {
  const clientEmail = booking.driver?.email;
  const adminEmail = process.env.EMAIL_USER;
  
  if (!clientEmail && !adminEmail) return;

  // Get vehicle and host info if possible
  const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
  const host = vehicle?.hostId ? await storage.getHost(parseInt(vehicle.hostId)).catch(() => null) : null;
  const hostEmail = host?.email;

  const recipients = [clientEmail, adminEmail, hostEmail].filter(Boolean) as string[];
  
  // Format check-in/out photos for display
  const checkInPhotos = [
    ...(booking.checkInData?.photosOutside || []),
    ...(booking.checkInData?.photosInside || [])
  ];
  
  const checkOutPhotos = [
    ...(booking.checkOutData?.photosOutside || []),
    ...(booking.checkOutData?.photosInside || [])
  ];

  const photoHtml = (photos: string[], title: string) => {
    if (!photos || photos.length === 0) return '';
    return `
      <div style="margin-top: 20px;">
        <h3 style="font-size: 16px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">${title}</h3>
        <div style="margin-top: 10px;">
          ${photos.map((p, i) => {
            // Ensure we have a valid data URL or absolute URL
            const src = p.startsWith('data:') ? p : (p.startsWith('http') ? p : '');
            if (!src) return '';
            
            return `
              <div style="margin-bottom: 15px; display: block; text-align: center;">
                <img src="${src}" alt="${title} ${i+1}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #d1d5db; display: block; margin: 0 auto;" />
                <p style="font-size: 10px; color: #9ca3af; margin-top: 5px;">Photo ${i+1}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  try {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1f2937;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Final Rental Receipt</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Booking #${booking.bookingCode}</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
              <div style="flex: 1;">
                <h2 style="font-size: 18px; margin: 0 0 10px 0;">Customer Information</h2>
                <p style="margin: 2px 0;"><strong>Name:</strong> ${booking.driver?.name}</p>
                <p style="margin: 2px 0;"><strong>Email:</strong> ${booking.driver?.email}</p>
                <p style="margin: 2px 0;"><strong>Phone:</strong> ${booking.driver?.phone}</p>
                <p style="margin: 2px 0;"><strong>License #:</strong> ${booking.driver?.licenseNumber}</p>
              </div>
              <div style="flex: 1; text-align: right;">
                <h2 style="font-size: 18px; margin: 0 0 10px 0;">Vehicle Details</h2>
                <p style="margin: 2px 0;"><strong>Vehicle:</strong> ${booking.carName || 'N/A'}</p>
                <p style="margin: 2px 0;"><strong>Location:</strong> ${booking.location?.split(',')[0] || 'N/A'}</p>
                <p style="margin: 2px 0;"><strong>Period:</strong> ${booking.startDate} to ${booking.returnDate}</p>
              </div>
            </div>

            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="font-size: 18px; margin: 0 0 15px 0; color: #111827;">Financial Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #4b5563;">Daily Rate (${booking.days} days)</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${(booking.details?.rate || 0).toFixed(2)}</td>
                </tr>
                ${booking.details?.protection ? `
                <tr>
                  <td style="padding: 8px 0; color: #4b5563;">Protection Plan</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${(booking.details.protection).toFixed(2)}</td>
                </tr>` : ''}
                ${booking.details?.fees ? `
                <tr>
                  <td style="padding: 8px 0; color: #4b5563;">Fees & Cleaning</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${(booking.details.fees).toFixed(2)}</td>
                </tr>` : ''}
                ${booking.details?.extendedRate ? `
                <tr>
                  <td style="padding: 8px 0; color: #3b82f6;">Extensions</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #3b82f6;">+$${(booking.details.extendedRate).toFixed(2)}</td>
                </tr>` : ''}
                ${Array.isArray(booking.details?.manualCharges) && booking.details.manualCharges.length > 0 ? 
                  booking.details.manualCharges.map((c: any) => `
                  <tr>
                    <td style="padding: 8px 0; color: #f59e0b;">${c.type}</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #f59e0b;">+$${(c.amount).toFixed(2)}</td>
                  </tr>
                  `).join('') : ''
                }
                <tr style="border-top: 1px solid #d1d5db;">
                  <td style="padding: 12px 0; color: #111827; font-weight: bold;">Total Amount Paid</td>
                  <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #1e40af;">$${(booking.total || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
              <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #065f46; text-transform: uppercase;">Check-In Data</h3>
                <p style="margin: 2px 0;"><strong>Mileage:</strong> ${booking.checkInData?.miles || 'N/A'} mi</p>
                <p style="margin: 2px 0;"><strong>Fuel:</strong> ${booking.checkInData?.gas || 'N/A'}</p>
              </div>
              <div style="background: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #fed7aa;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #9a3412; text-transform: uppercase;">Check-Out Data</h3>
                <p style="margin: 2px 0;"><strong>Mileage:</strong> ${booking.checkOutData?.miles || 'N/A'} mi</p>
                <p style="margin: 2px 0;"><strong>Fuel:</strong> ${booking.checkOutData?.gas || 'N/A'}</p>
              </div>
            </div>

            ${photoHtml(checkInPhotos, 'Check-In Condition Photos')}
            ${photoHtml(checkOutPhotos, 'Check-Out Condition Photos')}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
              <p>This is an automated legal receipt for booking #${booking.bookingCode}.</p>
              <p>CarHop LLC - Professional Car Rental Management<br/>Connecticut, USA | (475) 449-8622</p>
            </div>
          </div>
        </div>
    `;

    // Send to each recipient individually to avoid exposing other emails if preferred, 
    // but here we just send to all for simplicity
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipients.join(', '),
      subject: `CarHop - Final Rental Receipt & Evidence #${booking.bookingCode}`,
      html: htmlContent,
    });
    
    console.log(`Final receipt email sent to ${recipients.length} recipients for booking ${booking.bookingCode}`);
  } catch (error) {
    console.error("Error sending final receipt email:", error);
  }
}

async function sendNewBookingNotificationToHost(booking: any, vehicle: any) {
  const recipients = new Set<string>();
  if (process.env.EMAIL_USER) recipients.add(process.env.EMAIL_USER);
  if (vehicle?.hostId) {
    const host = await storage.getHost(parseInt(String(vehicle.hostId))).catch(() => null);
    if (host?.email) recipients.add(host.email);
  }
  if (recipients.size === 0) return;

  const deliveryType = booking.details?.deliveryType || 'pickup';
  const deliveryAddress = booking.details?.deliveryAddress || '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: Array.from(recipients).join(', '),
      subject: `New Booking Received #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">New Booking!</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">A new booking has been received!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Booking Code:</strong> ${booking.bookingCode}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Vehicle:</strong> ${booking.carName || vehicle?.model || 'N/A'}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Customer:</strong> ${booking.driver?.name || 'N/A'}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Email:</strong> ${booking.driver?.email || 'N/A'}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Phone:</strong> ${booking.driver?.phone || 'N/A'}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Pick-up:</strong> ${booking.startDate} at ${booking.startTime}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Return:</strong> ${booking.returnDate} at ${booking.returnTime}
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280;">
                <strong style="color: #1f2937;">Duration:</strong> ${booking.days} day(s)
              </p>
              <p style="margin: 0; color: #6b7280;">
                <strong style="color: #1f2937;">Total:</strong> $${(booking.total || 0).toFixed(2)}
              </p>
            </div>
            
            ${deliveryType === 'delivery' ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-weight: bold;">Delivery Requested</p>
                <p style="margin: 5px 0 0 0; color: #92400e;">Address: ${deliveryAddress}</p>
                <p style="margin: 5px 0 0 0; color: #92400e;">Please approve or decline this delivery request in the admin dashboard.</p>
              </div>
            ` : ''}
            
            <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Log in to the admin dashboard to manage this booking.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`New booking notification sent to host`);
  } catch (error) {
    console.error("Error sending new booking notification:", error);
  }
}

async function sendExtensionRequestEmailToHost(booking: any, vehicle: any, host: any, request: any) {
  const hostEmail = host?.email || process.env.EMAIL_USER;
  if (!hostEmail) return false;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: hostEmail,
      subject: `Extension Request #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Extension Request</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937;">Hi <strong>${host?.firstName || host?.name || 'Host'}</strong>,</p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
              ${booking.driver?.name || 'Your guest'} requested a ${request.type === 'reduction' ? 'reduction' : 'trip extension'}.
              Review the request in the Host dashboard before the requested return date.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #7c3aed;">
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Booking:</strong> ${booking.bookingCode}</p>
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Vehicle:</strong> ${booking.carName || vehicle?.model || 'N/A'}</p>
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Guest:</strong> ${booking.driver?.name || 'N/A'}</p>
              <p style="margin: 0 0 10px; color: #6b7280;"><strong style="color: #1f2937;">Requested return:</strong> ${request.requestedReturnDate} at ${request.requestedReturnTime}</p>
              <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">Reason:</strong> ${request.reason || 'No reason provided'}</p>
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">Log in to CarHopGo to approve or decline this request.</p>
          </div>
        </div>
      `,
    });
    console.log(`Extension request email sent to host for booking ${booking.bookingCode}`);
    return true;
  } catch (error) {
    console.error("Error sending extension request email to host:", error);
    return false;
  }
}

/**
 * SMS is deliberately opt-in and provider-agnostic. The app never pretends
 * that an SMS was sent when no provider is configured. A deployment can
 * provide an internal SMS webhook later without changing the booking flow.
 */
async function sendExtensionRequestSmsToHost(booking: any, vehicle: any, host: any, request: any) {
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  const hostPhone = host?.phone;
  if (!webhookUrl || !hostPhone) {
    console.warn(`[Notifications] SMS skipped for booking ${booking.bookingCode}: SMS provider is not configured`);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: hostPhone,
        message: `CarHopGo: ${booking.driver?.name || 'Guest'} requested a ${request.type === 'reduction' ? 'reduction' : 'trip extension'} for ${booking.carName || vehicle?.model || 'your vehicle'} (${booking.bookingCode}) until ${request.requestedReturnDate} ${request.requestedReturnTime}.`,
      }),
    });
    if (!response.ok) throw new Error(`SMS webhook returned ${response.status}`);
    console.log(`Extension request SMS sent to host for booking ${booking.bookingCode}`);
    return true;
  } catch (error) {
    console.error("Error sending extension request SMS to host:", error);
    return false;
  }
}

async function notifyHostOfExtensionRequest(booking: any, vehicle: any, request: any) {
  const settings = await getNotificationSettings();
  const host = vehicle?.hostId ? await storage.getHost(parseInt(String(vehicle.hostId))).catch(() => null) : null;
  const channels: Promise<boolean>[] = [];

  if (settings.enabled && settings.notifyExtensionRequests && settings.emailEnabled) {
    channels.push(sendExtensionRequestEmailToHost(booking, vehicle, host, request));
  }
  if (settings.enabled && settings.notifyExtensionRequests && settings.smsEnabled) {
    channels.push(sendExtensionRequestSmsToHost(booking, vehicle, host, request));
  }
  if (webPushConfigured && settings.enabled && settings.notifyExtensionRequests && settings.pushEnabled) {
    channels.push(sendWebPushNotification(['admin'], {
      title: 'New extension request',
      body: `${booking.driver?.name || 'Guest'} requested a ${request.type === 'reduction' ? 'reduction' : 'trip extension'} for ${booking.carName || vehicle?.model || 'your vehicle'} (${booking.bookingCode}).`,
      bookingId: booking.id,
      targetUrl: `/?view=admin&tab=bookings&bookingId=${booking.id}`,
    }));
    if (host?.id) {
      channels.push(sendWebPushNotification([`host:${host.id}`], {
        title: 'New extension request',
        body: `${booking.driver?.name || 'Guest'} requested a ${request.type === 'reduction' ? 'reduction' : 'trip extension'} for ${booking.carName || vehicle?.model || 'your vehicle'} (${booking.bookingCode}).`,
        bookingId: booking.id,
        targetUrl: `/?view=host-dashboard&bookingId=${booking.id}`,
      }));
    }
  }

  if (channels.length === 0) return { status: 'skipped' as const, sentAt: undefined };
  const results = await Promise.all(channels);
  const sentCount = results.filter(Boolean).length;
  return {
    status: sentCount === results.length ? 'sent' as const : sentCount > 0 ? 'partial' as const : 'skipped' as const,
    sentAt: sentCount > 0 ? new Date().toISOString() : undefined,
  };
}

const signupSchema = z.object({
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Valid phone number required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

// Helper function to calculate correct booking total
async function calculateCorrectTotal(booking: any): Promise<number> {
  const settings = await storage.getAllSettings();
  const settingsObj: Record<string, any> = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  
  const vehicle = await storage.getVehicle(booking.vehicleId).catch(() => null);
  const cleaningFee = vehicle?.pricing?.cleaningFee || settingsObj.cleaningFee || 0;
  const taxRatePercent = vehicle?.pricing?.taxes || settingsObj.taxes || 0;
  
  const deliveryFee = ((booking.details as any)?.deliveryType === 'delivery' && (booking.details as any)?.deliveryApprovalStatus !== 'rejected') ? ((booking.details as any)?.deliveryFee || 0) : 0;
  const discount = booking.details?.discount || 0;
  
  const initialSubtotal = (booking.details?.rate || 0) + (booking.details?.protection || 0) + (booking.details?.extras || 0) + cleaningFee + deliveryFee - discount;
  const initialTax = initialSubtotal > 0 ? initialSubtotal * (taxRatePercent / 100) : 0;
  const initialPayment = initialSubtotal + initialTax;
  
  const extendedRate = booking.details?.extendedRate || 0;
  const extensionTax = extendedRate > 0 ? extendedRate * (taxRatePercent / 100) : 0;
  
  const manualChargesTotal = Array.isArray(booking.details?.manualCharges) ? (booking.details.manualCharges as any[]).reduce((sum: number, c: any) => sum + (c.amount || 0), 0) : 0;
  const manualChargesTax = manualChargesTotal > 0 ? manualChargesTotal * (taxRatePercent / 100) : 0;
  
  const extraPaymentsTotal = (booking.extraPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
  
  return initialPayment + extendedRate + extensionTax + manualChargesTotal + manualChargesTax + extraPaymentsTotal;
}


export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // ========== AUTHENTICATION (Google OAuth) ==========
  await setupAuth(app);

  // ========== STRIPE PAYMENT ==========
  app.get('/api/stripe/config', async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error('[Stripe] Failed to load publishable key:', error?.message || error);
      res.status(500).json({ message: 'Stripe not configured' });
    }
  });

  app.post('/api/stripe/create-payment-intent', async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      const currency = (req.body?.currency || 'usd').toString().toLowerCase();
      const description = req.body?.description ? String(req.body.description) : undefined;
      const metadataInput = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadataInput)) {
        if (value === null || value === undefined) continue;
        metadata[String(key).slice(0, 40)] = String(value).slice(0, 500);
      }

      const stripe = await getUncachableStripeClient();
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        description,
        metadata,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
    } catch (error: any) {
      console.error('[Stripe] create-payment-intent error:', error?.message || error);
      res.status(500).json({ message: error?.message || 'Failed to create payment intent' });
    }
  });

  // Auth routes - get current authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      console.log('[API] /api/auth/user - User data:', JSON.stringify({
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        hasEmail: !!user?.email
      }));
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Traditional signup route
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const result = signupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const { firstName, lastName, email, phone, password } = result.data;

      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const user = await storage.createUser({
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
      });

      // Send confirmation email
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      const loginUrl = `${baseUrl}/`;
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to CarHop - Account Confirmation",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to CarHop!</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${firstName} ${lastName}</strong>,</p>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  Your CarHop account has been successfully created! Here are your account details:
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                  <p style="margin: 0 0 10px 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Name:</strong> ${firstName} ${lastName}
                  </p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Email:</strong> ${email}
                  </p>
                  <p style="margin: 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Phone:</strong> ${phone}
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  You're all set! Click the button below to log in to your account and start booking your perfect ride. Use the password you created during signup.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                    Sign In to CarHop
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  If you did not create this account, please ignore this email. If you have any questions, please contact us at (475) 449-8622.
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Don't fail the signup if email fails, just log it
      }

      // Set session
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({ message: "Account created successfully", user });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Traditional login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const { email, password } = result.data;

      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      req.login(user, (err) => {
        if (err) {
          console.error("[Auth] Login session error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        console.log(`[Auth] User logged in: ${user.email} (ID: ${user.id})`);
        res.json({ message: "Logged in successfully", user });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile', isAuthenticated, async (req: any, res) => {
    try {
      const profileSchema = z.object({
        firstName: z.string().min(2, "First name required").optional(),
        lastName: z.string().min(2, "Last name required").optional(),
        phone: z.string().min(10, "Valid phone number required").optional(),
      });

      const result = profileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const userId = req.user.id;
      const updates = result.data;

      // Update user in storage
      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Profile updated successfully", user });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Profile update failed" });
    }
  });

  // ========== EMAIL OTP FOR BOOKING LOOKUP ==========
  app.post('/api/auth/email-otp/request', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if there are any bookings for this email
      const bookings = await storage.getBookings();
      const hasBookings = bookings.some(b => {
        const driverEmail = (b.driver as any)?.email?.toLowerCase().trim() || '';
        return driverEmail === normalizedEmail;
      });

      // Always return success to prevent email enumeration
      // But only send OTP if there are bookings
      if (hasBookings) {
        const code = (storage as any).generateEmailOTP(normalizedEmail);
        
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: normalizedEmail,
            subject: "CarHop - Your Booking Access Code",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Your Access Code</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi there,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Use the following code to access your bookings:
                  </p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #22c55e;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
                  </div>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    This code will expire in <strong>10 minutes</strong>.
                  </p>
                  
                  <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    If you didn't request this code, you can safely ignore this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`[Auth] OTP sent to ${normalizedEmail}`);
        } catch (emailError) {
          console.error("Error sending OTP email:", emailError);
        }
      }

      // Always return success to prevent email enumeration
      res.json({ 
        message: "If you have bookings with this email, you will receive a verification code shortly.",
        success: true
      });
    } catch (error) {
      console.error("Email OTP request error:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post('/api/auth/email-otp/verify', async (req, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !email.trim() || !code || !code.trim()) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const isValid = (storage as any).validateEmailOTP(normalizedEmail, code.trim());

      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }

      // Get bookings for this email
      const bookings = await storage.getBookings();
      const userBookings = bookings.filter(b => {
        const driverEmail = (b.driver as any)?.email?.toLowerCase().trim() || '';
        return driverEmail === normalizedEmail;
      });

      console.log(`[Auth] OTP verified for ${normalizedEmail}, found ${userBookings.length} bookings`);

      res.json({ 
        success: true, 
        email: normalizedEmail,
        bookingsCount: userBookings.length
      });
    } catch (error) {
      console.error("Email OTP verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Get bookings by verified email (no auth required, email verified via OTP)
  app.get('/api/bookings/email/:email', async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase().trim();
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const bookings = await storage.getBookings();
      const userBookings = bookings.filter(b => {
        const driverEmail = (b.driver as any)?.email?.toLowerCase().trim() || '';
        return driverEmail === email;
      });

      console.log(`[API] Returning ${userBookings.length} bookings for email ${email}`);
      res.json(userBookings);
    } catch (error) {
      console.error("Error fetching bookings by email:", error);
      res.status(500).json({ message: "Error fetching bookings" });
    }
  });

  // ========== DIAGNOSTICS ==========
  // Simple bookings count endpoint for debugging
  app.get("/api/bookings-count", async (_req, res) => {
    try {
      const bookings = await storage.getBookings();
      res.json({ 
        count: bookings.length,
        timestamp: new Date().toISOString(),
        firstId: bookings[0]?.id || null,
        lastId: bookings[bookings.length - 1]?.id || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/diagnostics", async (_req, res) => {
    try {
      const dbStatus = await (storage as any).getDatabaseStatus?.() || { initialized: (storage as any).initialized || false };
      const bookingsCount = await storage.getBookings().then(b => b.length).catch(() => -1);
      const vehiclesCount = await storage.getVehicles().then(v => v.length).catch(() => -1);
      
      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        database: {
          initialized: dbStatus.initialized || (storage as any).initialized || false,
          hasDb: !!(storage as any).db,
        },
        counts: {
          bookings: bookingsCount,
          vehicles: vehiclesCount,
        },
        envVars: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          PGHOST: !!process.env.PGHOST,
          PGUSER: !!process.env.PGUSER,
          PGPASSWORD: !!process.env.PGPASSWORD,
          PGDATABASE: !!process.env.PGDATABASE,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Diagnostics failed",
        message: error?.message || "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ========== VEHICLES ==========
  app.get("/api/vehicles", async (req, res) => {
    const useImageUrls = String(req.query.imageMode || 'urls').toLowerCase() !== 'full';
    let vehicles = useImageUrls
      ? await storage.getVehicleSummaries()
      : await storage.getVehicles();
    const hosts = await storage.getHosts();
    const hostsMap = new Map(hosts.map(h => [h.id.toString(), h]));
    
    const includeUnavailable = String(req.query.includeUnavailable || '').toLowerCase() === 'true';
    if (includeUnavailable) {
      const existingVehicleIds = new Set(vehicles.map((vehicle) => Number(vehicle.id)));
      const bookingVehicles = await storage.getBookings();
      const orphanSnapshots = await Promise.all(
        bookingVehicles
          .filter((booking: any) =>
            booking.vehicleId != null &&
            !existingVehicleIds.has(Number(booking.vehicleId)) &&
            ['Active', 'Extended'].includes(booking.status)
          )
          .map((booking: any) => getOrphanVehicleSnapshot(Number(booking.vehicleId)))
      );
      vehicles = [
        ...vehicles,
        ...orphanSnapshots.filter(Boolean),
      ] as typeof vehicles;
    }

    let filteredVehicles = includeUnavailable
      ? vehicles
      : vehicles.filter((vehicle) => vehicle.availabilityStatus !== 'unavailable');
    
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      const requestedStart = startDate as string;
      const requestedEnd = endDate as string;
      const allBookings = await storage.getBookings();
       // Pending requests do not reserve a vehicle. Availability is checked
       // again when the host approves and when payment activates the booking.
       const blockingStatuses = ['Active', 'Extended'];
      const overlappingVehicleIds = new Set<number>();
      
      for (const booking of allBookings) {
         if (!blockingStatuses.includes(booking.status)) continue;
        if (!booking.vehicleId) continue;
        if (booking.startDate < requestedEnd && booking.returnDate > requestedStart) {
          overlappingVehicleIds.add(booking.vehicleId);
        }
      }
      
      filteredVehicles = vehicles.filter(v => !overlappingVehicleIds.has(v.id));
    }
    
    const vehiclesWithHost = filteredVehicles.map(v => {
      const allImages = Array.isArray(v.images) ? v.images : [];
      const imagesCount = Number((v as any).imagesCount || allImages.length);
      // Keep large base64 photos out of the fleet payload. The detail endpoint
      // still returns the original images, while list cards load only the
      // first photo they need through the cacheable image route below.
      const slimImages = imagesCount > 0
        ? [useImageUrls ? `/api/vehicles/${v.id}/image/0` : allImages[0]]
        : [];
      return {
        ...v,
        images: slimImages,
        imagesCount,
        hostInfo: v.hostId ? {
          id: hostsMap.get(v.hostId)?.id,
          firstName: hostsMap.get(v.hostId)?.firstName,
          lastName: hostsMap.get(v.hostId)?.lastName,
          city: hostsMap.get(v.hostId)?.city,
          state: hostsMap.get(v.hostId)?.state,
        } : null,
      };
    });

    res.json(vehiclesWithHost);
  });

  app.get("/api/vehicles/:id/image/:index", async (req, res) => {
    const id = parseInt(req.params.id);
    const index = parseInt(req.params.index);
    if (!Number.isInteger(id) || !Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid vehicle image" });
    }

    const vehicle = await storage.getVehicle(id) || await getOrphanVehicleSnapshot(id);
    const image = vehicle?.images?.[index];
    if (!image) return res.status(404).json({ error: "Vehicle image not found" });

    // Older records may already contain hosted image URLs.
    if (/^https?:\/\//i.test(image)) {
      return res.redirect(image);
    }

    const match = image.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
    if (!match) return res.status(404).json({ error: "Vehicle image is unavailable" });

    try {
      const imageBuffer = Buffer.from(match[2], "base64");
      if (imageBuffer.length === 0) return res.status(404).json({ error: "Vehicle image is unavailable" });
      res.set("Cache-Control", "public, max-age=3600");
      res.type(match[1]).send(imageBuffer);
    } catch {
      res.status(404).json({ error: "Vehicle image is unavailable" });
    }
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getVehicle(id) || await getOrphanVehicleSnapshot(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  });

  app.get("/api/vehicles/:id/booked-dates", async (req, res) => {
    const id = parseInt(req.params.id);
    const allBookings = await storage.getBookings();
     const blockingStatuses = ['Active', 'Extended'];
    const ranges = allBookings
      .filter(b => b.vehicleId === id && blockingStatuses.includes(b.status))
      .map(b => ({ start: b.startDate, end: b.returnDate, status: b.status }));
    res.json(ranges);
  });

  app.post("/api/vehicles", async (req, res) => {
    const result = insertVehicleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const commission = result.data.commission;
    const rawCommissionProvided = req.body?.commission !== undefined && req.body?.commission !== null;
    if (commission !== undefined && commission !== LEGACY_PLATFORM_COMMISSION && !isAllowedVehicleCommission(commission)) {
      return res.status(400).json({ error: { commission: ["Commission must represent a 70%, 75%, 80%, or 90% Host share."] } });
    }
    if (isHostVehicleRequest(req) && (!rawCommissionProvided || !isAllowedVehicleCommission(commission))) {
      return res.status(400).json({ error: { commission: ["Hosts must choose a 70%, 75%, 80%, or 90% Host share plan."] } });
    }
    const normalizedCommission = commission ?? 10;
    const vehicle = await storage.createVehicle({
      ...result.data,
      commission: normalizedCommission,
      deductible: VEHICLE_DEDUCTIBLES[normalizedCommission] ?? result.data.deductible ?? 2250,
    });
    res.status(201).json(vehicle);
  });

  app.put("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertVehicleSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const existingVehicle = await storage.getVehicle(id);
    const orphanSnapshot = existingVehicle ? undefined : await getOrphanVehicleSnapshot(id);
    if (result.data.commission !== undefined) {
      const isUnchangedLegacyPlan =
        result.data.commission === LEGACY_PLATFORM_COMMISSION &&
        (existingVehicle?.commission === LEGACY_PLATFORM_COMMISSION ||
          orphanSnapshot?.commission === LEGACY_PLATFORM_COMMISSION);
      if (
        result.data.commission !== LEGACY_PLATFORM_COMMISSION &&
        !isAllowedVehicleCommission(result.data.commission)
      ) {
        return res.status(400).json({ error: { commission: ["Commission must represent a 70%, 75%, 80%, or 90% Host share."] } });
      }
      if (isHostVehicleRequest(req) && !isAllowedVehicleCommission(result.data.commission) && !isUnchangedLegacyPlan) {
        return res.status(400).json({ error: { commission: ["Hosts must choose a 70%, 75%, 80%, or 90% Host share plan."] } });
      }
      result.data.deductible = VEHICLE_DEDUCTIBLES[result.data.commission] ?? result.data.deductible;
    }
    let vehicle: Vehicle | undefined;
    if (existingVehicle) {
      vehicle = await storage.updateVehicle(id, result.data);
    } else if (orphanSnapshot) {
      const restoredData = insertVehicleSchema.safeParse({
        ...orphanSnapshot,
        ...result.data,
      });
      if (!restoredData.success) {
        return res.status(400).json({ error: restoredData.error.flatten() });
      }
      vehicle = await storage.restoreVehicle(id, restoredData.data);
    }
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  });

  app.delete("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteVehicle(id);
    if (!deleted) return res.status(404).json({ error: "Vehicle not found" });
    res.status(204).send();
  });

  app.post("/api/vehicles/:id/transfer-request", async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getVehicle(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (!vehicle.hostId) return res.status(400).json({ error: "Vehicle has no current host" });

    const { toHostId, toHostName, requestedBy } = req.body;
    
    const existingPending = (vehicle.transferRequests || []).find(r => r.status === 'pending');
    if (existingPending) {
      return res.status(409).json({ error: "A transfer request is already pending for this vehicle" });
    }
    
    const hosts = await storage.getHosts();
    const hostsMap = new Map(hosts.map(h => [h.id.toString(), h]));
    const currentHost = hostsMap.get(vehicle.hostId);
    const fromHostName = currentHost ? `${currentHost.firstName} ${currentHost.lastName}` : (vehicle.hostName || 'Unknown');

    const transferRequest = {
      id: 'transfer-' + Date.now(),
      fromHostId: vehicle.hostId,
      fromHostName,
      toHostId,
      toHostName,
      requestedBy,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    const transferRequests = [...(vehicle.transferRequests || []), transferRequest];
    const updated = await storage.updateVehicle(id, { transferRequests } as any);
    res.json(updated);
  });

  app.put("/api/vehicles/:id/transfer-request/:requestId", async (req, res) => {
    const id = parseInt(req.params.id);
    const requestId = req.params.requestId;
    const vehicle = await storage.getVehicle(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const { status } = req.body;
    const transferRequests = [...(vehicle.transferRequests || [])];
    const requestIndex = transferRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return res.status(404).json({ error: "Transfer request not found" });

    transferRequests[requestIndex] = {
      ...transferRequests[requestIndex],
      status,
      respondedAt: new Date().toISOString(),
    };

    const updateData: any = { transferRequests };
    if (status === 'approved') {
      updateData.hostId = String(transferRequests[requestIndex].toHostId);
      updateData.hostName = transferRequests[requestIndex].toHostName;
      console.log(`[Transfer] Vehicle ${id} host updated from ${transferRequests[requestIndex].fromHostId} to ${transferRequests[requestIndex].toHostId}. Notification sent to previous owner.`);
    }

    const updated = await storage.updateVehicle(id, updateData);
    res.json(updated);
  });

  app.get("/api/bookings", async (_req, res) => {
    try {
      const bookings = await storage.getBookings();
      
      // Check for a debug query param to see all raw data (may be very large!)
      if (_req.query.debug === 'true') {
        return res.json({
          count: bookings.length,
          data: bookings,
          timestamp: new Date().toISOString(),
          env: process.env.NODE_ENV
        });
      }
      
      // Optimize response by removing heavy image data for list view
      // Full image data is available when fetching individual booking via /api/bookings/:id
      // This prevents timeout/memory issues when there are many bookings with large photos
      const optimizedBookings = bookings.map(stripBookingImages);
      
      res.json(optimizedBookings);
    } catch (error: any) {
      console.error("[API] /api/bookings - ERROR:", error);
      console.error("[API] /api/bookings - Error message:", error?.message || "No message");
      console.error("[API] /api/bookings - Error stack:", error?.stack || "No stack");
      res.status(500).json({ 
        message: "Error fetching bookings",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });

  app.get("/api/bookings/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    try {
      const userEmail = req.user?.email || '';
      if (!userEmail) {
        console.log('[API] /api/bookings/user - No email in user session');
        return res.json([]);
      }
      const userBookings = await storage.getUserTrips(userEmail);
      console.log(`[API] Returning ${userBookings.length} user bookings for ${userEmail} at ${new Date().toISOString()}`);
      res.json(userBookings.map(stripBookingImages));
    } catch (error) {
      console.error("API error fetching user bookings:", error);
      res.status(500).json({ message: "Error fetching user bookings" });
    }
  });

  app.get("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  app.get("/api/bookings/code/:code", async (req, res) => {
    const booking = await storage.getBookingByCode(req.params.code);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  app.post("/api/bookings", async (req, res) => {
    console.log("[API] Received booking request:", JSON.stringify(req.body).substring(0, 200));
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) {
      console.error("[API] Validation error:", JSON.stringify(result.error.flatten()));
      return res.status(400).json({ error: result.error.flatten() });
    }

    try {
      const requestedStatus = String((result.data as any).status || '');
      const bookingApprovalRequested =
        requestedStatus === 'Pending Approval' ||
        (result.data as any).details?.bookingApprovalStatus === 'pending';

      if (result.data.vehicleId) {
        const requestedVehicle = await storage.getVehicle(result.data.vehicleId);
        if (requestedVehicle?.availabilityStatus === 'unavailable') {
          return res.status(409).json({
            error: "This vehicle is currently unavailable and cannot accept new bookings.",
          });
        }
      }

      if (requestedStatus === 'Active') {
        return res.status(409).json({
          error: "New bookings must be approved by the host or admin before payment.",
        });
      }

      // A booking request is intentionally created before payment. It must not
      // reserve the vehicle until a host/admin approves it and the guest pays.
      if (bookingApprovalRequested) {
        const driverEmail = String((result.data as any).driver?.email || '').toLowerCase().trim();
        const existingBookings = await storage.getBookings();
        const duplicate = existingBookings.find((existing) =>
          existing.vehicleId === result.data.vehicleId &&
          existing.startDate === result.data.startDate &&
          existing.returnDate === result.data.returnDate &&
          String((existing.driver as any)?.email || '').toLowerCase().trim() === driverEmail &&
          !['Cancelled', 'Declined', 'Completed'].includes(existing.status)
        );
        if (duplicate) {
          return res.status(409).json({
            error: "A booking request for this vehicle and dates already exists.",
            bookingId: duplicate.id,
          });
        }
      }

      // Server-side Stripe payment verification before creating any booking marked as paid/active
      const paymentRaw: any = (result.data as any).paymentRaw;
      const stripePaymentIntentId: string | undefined = paymentRaw?.stripePaymentIntentId;
      const isPayPal = paymentRaw?.type === 'paypal' || (stripePaymentIntentId && stripePaymentIntentId.startsWith('PAYPAL-'));

      if (!bookingApprovalRequested && !isPayPal) {
        if (!stripePaymentIntentId) {
          console.warn("[API] Booking missing stripePaymentIntentId");
          return res.status(400).json({ error: "Payment missing. Complete the card payment before creating the booking." });
        }
        const expectedTotal = Number((result.data as any).total);
        if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) {
          return res.status(400).json({ error: "Invalid booking total." });
        }
        const verification = await verifyStripePaymentIntent(stripePaymentIntentId, expectedTotal, 'usd');
        if (!verification.ok) {
          console.error("[API] Stripe verification failed:", verification.reason);
          return res.status(402).json({ error: verification.reason || "Stripe payment could not be confirmed." });
        }

        // Replay protection: ensure this paymentIntent hasn't been used by another booking
        try {
          const existing = await storage.getBookings();
          const reused = existing.some((b) => (b.paymentRaw as any)?.stripePaymentIntentId === stripePaymentIntentId);
          if (reused) {
            console.error("[API] Stripe paymentIntent reuse detected:", stripePaymentIntentId);
            return res.status(409).json({ error: "This payment has already been used for another booking." });
          }
        } catch (replayErr) {
          console.error("[API] Replay check error:", replayErr);
        }
      } else if (!bookingApprovalRequested) {
        console.log("[API] PayPal simulated payment — skipping Stripe verification");
      }

      // Enrich booking details with vehicle year and host info before saving
      const vehicleForEnrich = result.data.vehicleId ? await storage.getVehicle(result.data.vehicleId).catch(() => null) : null;
      if (vehicleForEnrich && result.data.details) {
        const hostForEnrich = vehicleForEnrich.hostId ? await storage.getHost(parseInt(vehicleForEnrich.hostId)).catch(() => null) : null;
        (result.data.details as any).vehicleYear = vehicleForEnrich.year || null;
        (result.data.details as any).hostId = vehicleForEnrich.hostId || null;
        (result.data.details as any).hostName = hostForEnrich ? `${hostForEnrich.firstName} ${hostForEnrich.lastName}` : (vehicleForEnrich.hostName || null);
        (result.data.details as any).discountPrograms = Array.isArray(vehicleForEnrich.pricing?.discountPrograms)
          ? vehicleForEnrich.pricing.discountPrograms
          : [];
      }

      // Initialize license verification as pending for host review
      (result.data as any).licenseVerification = { status: 'pending' };
      if (
        (req as any).isAuthenticated?.() &&
        (req as any).user?.id &&
        !(req as any).user?.isAdmin &&
        !(req as any).user?.isHost
      ) {
        (result.data as any).userId = String((req as any).user.id);
      }

      const booking = await storage.createBooking(result.data);
      console.log("[API] Booking created successfully:", booking.id);
      
      // Send email notifications in background to avoid blocking response
      const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
      sendBookingConfirmationEmail(booking, vehicle).catch(err => console.error("Error sending confirmation email:", err));
      sendNewBookingNotificationToHost(booking, vehicle).catch(err => console.error("Error sending host notification:", err));
      notifyBookingStaff(booking, vehicle, 'notifyNewBookings', {
        title: 'New booking request',
        body: `${booking.driver?.name || 'Guest'} requested ${booking.carName || vehicle?.model || 'a vehicle'} (${booking.bookingCode}).`,
      }).catch(err => console.error("Error sending booking push notification:", err));

      res.status(201).json(booking);
    } catch (error) {
      console.error("[API] Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // ========== INITIAL BOOKING APPROVAL (Host/Admin only) ==========
  app.put("/api/bookings/:id/booking-approval", async (req: any, res) => {
    const id = parseInt(req.params.id);
    const status = req.body?.status;
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: "Status must be approved or rejected." });
    }

    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const passportAuth = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
    const sessionAdminAuth = req.session?.adminAuthenticated === true;
    const sessionHostEmail = String(req.session?.authenticatedHostEmail || '').toLowerCase().trim();
    const callerIsAdmin = (passportAuth && req.user?.isAdmin === true) || sessionAdminAuth;
    const callerIsHostViaPassport = passportAuth && req.user?.isHost === true;
    const callerIsHost = callerIsHostViaPassport || !!sessionHostEmail;

    if (!callerIsAdmin && !callerIsHost) {
      return res.status(401).json({ error: "Authentication required. Please sign in as a host or admin." });
    }

    if (!callerIsAdmin) {
      const actorEmail = callerIsHostViaPassport
        ? String(req.user?.email || '').toLowerCase().trim()
        : sessionHostEmail;
      const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
      const host = vehicle?.hostId ? await storage.getHost(parseInt(vehicle.hostId)).catch(() => null) : null;
      if (!host || String(host.email || '').toLowerCase().trim() !== actorEmail) {
        return res.status(403).json({ error: "Only the vehicle's host or an admin may approve this booking." });
      }
    }

    if (booking.status !== 'Pending Approval' ||
        (booking.details as any)?.bookingApprovalStatus !== 'pending') {
      return res.status(409).json({ error: "This booking is no longer awaiting approval." });
    }

    if (status === 'approved' && booking.vehicleId) {
      const vehicle = await storage.getVehicle(booking.vehicleId);
      if (vehicle?.availabilityStatus === 'unavailable') {
        return res.status(409).json({
          error: "This vehicle is currently unavailable and cannot accept new bookings.",
        });
      }
      const allBookings = await storage.getBookings();
      const blockingStatuses = ['Active', 'Extended'];
      const conflicting = allBookings.find((candidate) =>
        candidate.id !== id &&
        candidate.vehicleId === booking.vehicleId &&
        blockingStatuses.includes(candidate.status) &&
        candidate.startDate < booking.returnDate &&
        candidate.returnDate > booking.startDate
      );
      if (conflicting) {
        return res.status(409).json({
          error: "Vehicle is no longer available for these dates.",
          conflictingBooking: conflicting.bookingCode,
        });
      }
    }

    const updatedDetails = {
      ...booking.details,
      bookingApprovalStatus: status,
      bookingApprovalMessage: status === 'approved'
        ? 'Your booking request was approved. Complete payment to confirm the reservation.'
        : 'The vehicle is not available for these dates. Please choose another vehicle or dates.',
      bookingApprovalRespondedAt: new Date().toISOString(),
    };
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: callerIsAdmin ? 'admin' as const : 'host' as const,
      text: updatedDetails.bookingApprovalMessage,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const updated = await storage.updateBooking(id, {
      details: updatedDetails,
      status: status === 'rejected' ? 'Declined' : 'Pending Approval',
      messages: [...(booking.messages || []), newMessage],
      unread: true,
    });
    if (!updated) return res.status(404).json({ error: "Booking not found" });

    sendBookingApprovalEmail(updated, status).catch((error) =>
      console.error("Error sending booking approval email:", error)
    );
    notifyBookingClient(updated, {
      title: status === 'approved' ? 'Booking request approved' : 'Booking request declined',
      body: updatedDetails.bookingApprovalMessage,
    }).catch((error) => console.error("Error sending booking approval push notification:", error));
    res.json(updated);
  });

  app.put("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertBookingSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }

    // Get the current booking state before update
    const previousBooking = await storage.getBooking(id);

    // Server-side Stripe payment verification when this update introduces a new payment
    const incomingPaymentRaw: any = (result.data as any).paymentRaw;
    const incomingIntentId: string | undefined = incomingPaymentRaw?.stripePaymentIntentId;
    const previousIntentId: string | undefined = (previousBooking?.paymentRaw as any)?.stripePaymentIntentId;
    const incomingStatus: string | undefined = (result.data as any).status;
    const previousStatus: string | undefined = previousBooking?.status;
    const isActivating = incomingStatus === 'Active' && previousStatus !== 'Active';
    const previousDetails: any = previousBooking?.details || {};

    if (isActivating && previousStatus === 'Pending Approval') {
      const bookingApprovalStatus = previousDetails.bookingApprovalStatus;
      const deliveryApprovalStatus = previousDetails.deliveryApprovalStatus;
      if (bookingApprovalStatus === 'pending' || bookingApprovalStatus === 'rejected') {
        return res.status(409).json({ error: "The host or admin must approve this booking before payment." });
      }
      if (deliveryApprovalStatus === 'pending') {
        return res.status(409).json({ error: "The delivery request is still awaiting approval." });
      }
      if (previousBooking?.vehicleId) {
        const vehicle = await storage.getVehicle(previousBooking.vehicleId);
        if (vehicle?.availabilityStatus === 'unavailable') {
          return res.status(409).json({
            error: "This vehicle is currently unavailable and cannot accept new bookings.",
          });
        }
        const allBookings = await storage.getBookings();
        const blockingStatuses = ['Active', 'Extended'];
        const conflicting = allBookings.find((candidate) =>
          candidate.id !== id &&
          candidate.vehicleId === previousBooking.vehicleId &&
          blockingStatuses.includes(candidate.status) &&
          candidate.startDate < previousBooking.returnDate &&
          candidate.returnDate > previousBooking.startDate
        );
        if (conflicting) {
          return res.status(409).json({ error: "Vehicle is no longer available for these dates." });
        }
      }
    }

    const isIncomingPayPal = incomingPaymentRaw?.type === 'paypal' || (incomingIntentId && incomingIntentId.startsWith('PAYPAL-'));
    if (incomingIntentId && incomingIntentId !== previousIntentId && !isIncomingPayPal) {
      const expectedTotal = Number((result.data as any).total ?? previousBooking?.total);
      if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) {
        return res.status(400).json({ error: "Invalid booking total for payment verification." });
      }
      const verification = await verifyStripePaymentIntent(incomingIntentId, expectedTotal, 'usd');
      if (!verification.ok) {
        console.error("[API] Stripe verification failed on update:", verification.reason);
        return res.status(402).json({ error: verification.reason || "Stripe payment could not be confirmed." });
      }
      // Replay protection on update path too
      try {
        const existing = await storage.getBookings();
        const reused = existing.some((b) => b.id !== id && (b.paymentRaw as any)?.stripePaymentIntentId === incomingIntentId);
        if (reused) {
          console.error("[API] Stripe paymentIntent reuse detected on update:", incomingIntentId);
          return res.status(409).json({ error: "This payment has already been used for another booking." });
        }
      } catch (replayErr) {
        console.error("[API] Replay check error on update:", replayErr);
      }
    } else if (isActivating && !incomingIntentId && !previousIntentId) {
      // Activating without any payment intent (legacy path) is not allowed
      return res.status(402).json({ error: "Cannot activate a booking without a confirmed Stripe payment." });
    }

    const booking = await storage.updateBooking(id, result.data);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    // Send email notifications for check-in/check-out status changes
    if (previousBooking) {
      // Check-in completed
      if (previousBooking.checkInStatus !== 'completed' && booking.checkInStatus === 'completed') {
        sendCheckInCompletedEmail(booking);
      }
      // Check-out completed
      if (previousBooking.checkOutStatus !== 'completed' && booking.checkOutStatus === 'completed') {
        sendCheckOutCompletedEmail(booking);
      }

      if (previousBooking.status !== booking.status) {
        const statusMessages: Record<string, string> = {
          Active: 'Your booking is confirmed and active.',
          Extended: 'Your booking dates were extended.',
          Cancelled: 'Your booking was cancelled.',
          Completed: 'Your booking has been completed.',
          Declined: 'Your booking was declined.',
        };
        notifyBookingClient(booking, {
          title: `Booking ${booking.status}`,
          body: statusMessages[booking.status] || `Your booking status changed to ${booking.status}.`,
        }).catch((error) => console.error("Error sending booking status push notification:", error));
      } else if (previousBooking.checkInStatus !== booking.checkInStatus && booking.checkInStatus === 'completed') {
        notifyBookingClient(booking, {
          title: 'Check-in completed',
          body: `Check-in for booking ${booking.bookingCode} has been completed.`,
        }).catch((error) => console.error("Error sending check-in push notification:", error));
      } else if (previousBooking.checkOutStatus !== booking.checkOutStatus && booking.checkOutStatus === 'completed') {
        notifyBookingClient(booking, {
          title: 'Check-out completed',
          body: `Check-out for booking ${booking.bookingCode} has been completed.`,
        }).catch((error) => console.error("Error sending check-out push notification:", error));
      }
    }
    
    res.json(booking);
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteBooking(id);
    if (!deleted) return res.status(404).json({ error: "Booking not found" });
    res.status(204).send();
  });

  app.patch("/api/bookings/:id/read", async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateBooking(id, { unread: false });
    if (!updated) return res.status(404).json({ error: "Booking not found" });
    res.json(updated);
  });

  // ========== EXTENSION REQUESTS ==========
  app.post("/api/bookings/:id/extension-request", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { type, requestedReturnDate, requestedReturnTime, reason } = req.body;

    if (booking.vehicleId && requestedReturnDate) {
      const allBookings = await storage.getBookings();
      const excludedStatuses = ['Cancelled', 'Completed', 'Declined'];
      const extensionStart = booking.returnDate;
      const extensionEnd = requestedReturnDate;
      const conflicting = allBookings.find(b => {
        if (b.id === id) return false;
        if (b.vehicleId !== booking.vehicleId) return false;
        if (excludedStatuses.includes(b.status)) return false;
        return b.startDate < extensionEnd && b.returnDate > extensionStart;
      });
      if (conflicting) {
        return res.status(409).json({
          error: "Vehicle is already booked for those dates",
          conflictingBooking: conflicting.bookingCode,
        });
      }
    }

    const duplicateRequest = (booking.extensionRequests || []).find((request: any) =>
      request.status === 'pending' &&
      request.type === type &&
      request.requestedReturnDate === requestedReturnDate &&
      request.requestedReturnTime === requestedReturnTime
    );
    if (duplicateRequest) {
      return res.status(409).json({
        error: "An identical extension request is already pending",
        request: duplicateRequest,
      });
    }

    const newRequest = {
      id: `ext-${Date.now()}`,
      type: type as 'extension' | 'reduction',
      requestedReturnDate,
      requestedReturnTime,
      reason: reason || '',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      hostNotificationStatus: 'pending' as const,
    };
    
    const extensionRequests = [...(booking.extensionRequests || []), newRequest];
    const updated = await storage.updateBooking(id, { extensionRequests });
    if (!updated) return res.status(404).json({ error: "Booking not found" });

    const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
    const notificationResult = await notifyHostOfExtensionRequest(updated, vehicle, newRequest);
    const notifiedRequests = (updated.extensionRequests || []).map((request: any) =>
      request.id === newRequest.id
        ? {
            ...request,
            hostNotificationStatus: notificationResult.status,
            ...(notificationResult.sentAt ? { hostNotificationSentAt: notificationResult.sentAt } : {}),
          }
        : request
    );
    const finalBooking = await storage.updateBooking(id, { extensionRequests: notifiedRequests });
    res.json(finalBooking || updated);
  });

  app.put("/api/bookings/:id/extension-request/:requestId", async (req, res) => {
    const id = parseInt(req.params.id);
    const requestId = req.params.requestId;
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    // Get settings for tax calculation
    const allSettings = await storage.getAllSettings();
    const settingsObj: Record<string, any> = {};
    allSettings.forEach(s => (settingsObj[s.key] = s.value));
    
    const { status } = req.body; // 'approved' or 'rejected'
    const extensionRequests = (booking.extensionRequests || []).map(r => {
      if (r.id === requestId) {
        return { ...r, status, respondedAt: new Date().toISOString() };
      }
      return r;
    });
    
    // If approved, update the booking dates
    const approvedRequest = extensionRequests.find(r => r.id === requestId && r.status === 'approved');
    let updateData: any = { extensionRequests };
    
    if (approvedRequest) {
      updateData.returnDate = approvedRequest.requestedReturnDate;
      updateData.returnTime = approvedRequest.requestedReturnTime;
      // Recalculate days and adjust pricing
      const startDate = new Date(booking.startDate);
      const newReturnDate = new Date(approvedRequest.requestedReturnDate);
      const diffTime = newReturnDate.getTime() - startDate.getTime();
      const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      updateData.days = Math.max(1, newDays);
      
      // Calculate the difference in days from current booking
      const oldDays = booking.days || 1;
      const daysDifference = newDays - oldDays;
      
      // Get the car price per day
      const vehicleId = booking.vehicleId;
      const vehicle = vehicleId
        ? await storage.getVehicle(vehicleId) || await getOrphanVehicleSnapshot(vehicleId)
        : null;
      const pricePerDay = getRentalDailyRate(booking.details, vehicle, oldDays);
      
      // Adjust total and extended rate based on days difference
      const rateDifference = pricePerDay * daysDifference;
      const oldExtendedRate = booking.details?.extendedRate || 0;
      const newExtendedRate = Math.max(0, oldExtendedRate + rateDifference);
      const oldDiscount = Number(booking.details?.discount || 0);
      const extensionDays = Math.max(0, daysDifference);
      const discountPricing = calculateExtensionPricing(vehicle, extensionDays, pricePerDay);
      const extensionDiscount = discountPricing.discountAmount;
      const newDiscount = oldDiscount + extensionDiscount;

      // Protection: charge the same per-day rate used at booking start.
      const oldProtectionAmt = Number(booking.details?.protection || 0);
      const protectionPerDayAmt = getProtectionDailyRate(booking.details, vehicle, settingsObj, oldDays);
      const protectionDeltaAmt = protectionPerDayAmt * daysDifference;
      const newProtectionAmt = Math.max(0, oldProtectionAmt + protectionDeltaAmt);

      // Calculate tax adjustment after applying the discount only to added days.
      const oldTax = booking.details?.tax || 0;
      let newTax = oldTax;
      if (daysDifference !== 0) {
        const taxRate = (settingsObj.taxes || 0) / 100;
        const taxAdjustment = (rateDifference + protectionDeltaAmt - extensionDiscount) * taxRate;
        newTax = oldTax + taxAdjustment;
      }
      
      // Total will be recalculated correctly
      updateData.details = {
        ...booking.details,
        extendedRate: newExtendedRate,
        rentalDailyRate: pricePerDay,
         discount: newDiscount,
         discountPercent: discountPricing.discountPercent,
        protection: newProtectionAmt,
        protectionDailyRate: protectionPerDayAmt,
        tax: newTax
      };

      // Calculate new total
      const baseRate = (booking.details?.rate || 0);
      const fees = (booking.details?.fees || 0);
      const deliveryFee = (booking.details?.deliveryFee || 0);
      const discount = newDiscount;
      
      // Sum everything up for the new total (use updated protection)
      updateData.total = baseRate + newProtectionAmt + fees + newExtendedRate + newTax + deliveryFee - discount;
      
      // Preserve vehicle metadata
      updateData.carName = booking.carName;
      updateData.vehicleId = booking.vehicleId;
    }
    
    const updated = await storage.updateBooking(id, updateData);
    
    // Send email notification for extension response
    const respondedRequest = extensionRequests.find(r => r.id === requestId);
    if (respondedRequest && (status === 'approved' || status === 'rejected')) {
      sendExtensionResponseEmail(updated, status, respondedRequest);
      notifyBookingClient(updated, {
        title: status === 'approved' ? 'Extension approved' : 'Extension declined',
        body: status === 'approved'
          ? `Your booking extension was approved through ${respondedRequest.requestedReturnDate}.`
          : 'Your booking extension request was declined.',
      }).catch((error) => console.error("Error sending extension push notification:", error));
    }
    
    res.json(updated);
  });

  // ========== FORCE EXTEND (Host/Admin only — no guest request needed) ==========
  app.post("/api/bookings/:id/force-extend", async (req: any, res) => {
    // Auth: accept either a Passport session (isAdmin/isHost flags) OR an Express session established
    // by POST /api/hosts/login (authenticatedHostEmail) or POST /api/admin/session-auth (adminAuthenticated).
    const passportAuth = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
    const sessionAdminAuth: boolean = req.session?.adminAuthenticated === true;
    const sessionHostEmail: string = (req.session?.authenticatedHostEmail || '').toLowerCase().trim();

    const callerIsAdmin = (passportAuth && req.user?.isAdmin === true) || sessionAdminAuth;
    const callerIsHostViaPassport = passportAuth && req.user?.isHost === true;
    const callerIsHostViaSession = !!sessionHostEmail;
    const callerIsHost = callerIsHostViaPassport || callerIsHostViaSession;

    if (!callerIsAdmin && !callerIsHost) {
      return res.status(401).json({ error: "Authentication required. Please sign in as a host or admin." });
    }

    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // For non-admin callers, verify host ownership of the booking's vehicle
    if (!callerIsAdmin) {
      const actorEmail: string = callerIsHostViaPassport
        ? (req.user?.email || '').toLowerCase().trim()
        : sessionHostEmail;

      if (!booking.vehicleId) {
        return res.status(403).json({ error: "Forbidden: vehicle has no associated host" });
      }
      const vehicleForAuth = await storage.getVehicle(booking.vehicleId).catch(() => null);
      if (!vehicleForAuth?.hostId) {
        return res.status(403).json({ error: "Forbidden: vehicle has no associated host" });
      }
      const hostForAuth = await storage.getHost(parseInt(vehicleForAuth.hostId)).catch(() => null);
      if (!hostForAuth || hostForAuth.email.toLowerCase().trim() !== actorEmail) {
        return res.status(403).json({ error: "Forbidden: only the vehicle's host or an admin may extend this booking" });
      }
    }

    // Lifecycle state guard: only Active or Extended bookings that are not yet checked out may be extended
    const EXTENDABLE_STATUSES = ['Active', 'Extended'];
    if (!EXTENDABLE_STATUSES.includes(booking.status)) {
      return res.status(409).json({
        error: `Cannot extend a booking with status '${booking.status}'. Only Active or Extended bookings may be extended.`,
      });
    }
    if (booking.checkOutStatus === 'completed') {
      return res.status(409).json({
        error: "Cannot extend a booking that has already been checked out.",
      });
    }

    const { returnDate, returnTime, note } = req.body;

    // Validate presence and format of returnDate (YYYY-MM-DD) and returnTime
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_12H_RE = /^(1[0-2]|0?[1-9]):[0-5]\d\s?(AM|PM)$/i;
    if (!returnDate || !returnTime) {
      return res.status(400).json({ error: "returnDate and returnTime are required" });
    }
    if (!ISO_DATE_RE.test(returnDate)) {
      return res.status(400).json({ error: "returnDate must be in YYYY-MM-DD format" });
    }
    if (!TIME_12H_RE.test(String(returnTime).trim())) {
      return res.status(400).json({ error: "returnTime must be in h:mm AM/PM format (e.g. '10:00 AM')" });
    }

    // Validate the calendar date is a real date (rejects e.g. Feb 30, Apr 31)
    const [rdYear, rdMonth, rdDay] = returnDate.split('-').map(Number);
    const calendarCheck = new Date(rdYear, rdMonth - 1, rdDay);
    if (
      calendarCheck.getFullYear() !== rdYear ||
      calendarCheck.getMonth() !== rdMonth - 1 ||
      calendarCheck.getDate() !== rdDay
    ) {
      return res.status(400).json({ error: `'${returnDate}' is not a valid calendar date` });
    }

    // Parse and validate datetimes are finite
    const currentReturnHHMM = convertTimeTo24HourServer(booking.returnTime || '12:00 PM');
    const currentReturnDT = new Date(`${booking.returnDate}T${currentReturnHHMM}:00`);
    const newReturnHHMM = convertTimeTo24HourServer(returnTime);
    const newReturnDT = new Date(`${returnDate}T${newReturnHHMM}:00`);

    if (!isFinite(currentReturnDT.getTime()) || !isFinite(newReturnDT.getTime())) {
      return res.status(400).json({ error: "Invalid date or time value" });
    }

    if (newReturnDT <= currentReturnDT) {
      return res.status(400).json({ error: "New return date must be after the current return date" });
    }

    // Conflict check — ensure no other booking overlaps the extended window (full datetime precision)
    if (booking.vehicleId) {
      const allBookings = await storage.getBookings();
      const excluded = ['Cancelled', 'Completed', 'Declined'];
      // Window being extended: from current returnDate/Time to new returnDate/Time
      const windowStart = currentReturnDT;
      const windowEnd = newReturnDT;
      const conflicting = allBookings.find(b => {
        if (b.id === id) return false;
        if (b.vehicleId !== booking.vehicleId) return false;
        if (excluded.includes(b.status)) return false;
        // Build full datetimes for the candidate booking
        const bStartHHMM = convertTimeTo24HourServer(b.startTime || '10:00 AM');
        const bEndHHMM = convertTimeTo24HourServer(b.returnTime || '10:00 AM');
        const bStartDT = new Date(`${b.startDate}T${bStartHHMM}:00`);
        const bEndDT = new Date(`${b.returnDate}T${bEndHHMM}:00`);
        // Overlap if the candidate's window intersects [windowStart, windowEnd)
        return bStartDT < windowEnd && bEndDT > windowStart;
      });
      if (conflicting) {
        return res.status(409).json({
          error: "Vehicle is already booked for those dates",
          conflictingBooking: conflicting.bookingCode,
        });
      }
    }

    // Billing: calculate incremental cost from current returnDT → new returnDT (not from startDate)
    // This ensures a same-day time-only extension still produces the correct charge.
    const extensionMs = newReturnDT.getTime() - currentReturnDT.getTime();
    const extraDays = Math.max(0, Math.ceil(extensionMs / (1000 * 60 * 60 * 24)));
    // New total days = original days + incremental days
    const newDays = Math.max(1, (booking.days || 1) + extraDays);

    const allSettings = await storage.getAllSettings();
    const settingsObj: Record<string, any> = {};
    allSettings.forEach(s => (settingsObj[s.key] = s.value));

    const vehicle = booking.vehicleId
      ? await storage.getVehicle(booking.vehicleId) || await getOrphanVehicleSnapshot(booking.vehicleId)
      : null;
    const pricePerDay = getRentalDailyRate(booking.details, vehicle, booking.days || 1);
    const rateDifference = pricePerDay * extraDays;
    const oldExtendedRate = booking.details?.extendedRate || 0;
    const newExtendedRate = Math.max(0, oldExtendedRate + rateDifference);
    const oldDiscount = Number(booking.details?.discount || 0);
    const discountPricing = calculateExtensionPricing(vehicle, extraDays, pricePerDay);
    const extensionDiscount = discountPricing.discountAmount;
    const newDiscount = oldDiscount + extensionDiscount;

    // Protection: charge the same per-day rate that was selected at booking start.
    const oldProtection = Number(booking.details?.protection || 0);
    const originalDays = Math.max(1, booking.days || 1);
    const protectionPerDay = getProtectionDailyRate(booking.details, vehicle, settingsObj, originalDays);
    const protectionDifference = protectionPerDay * extraDays;
    const newProtection = oldProtection + protectionDifference;

    const oldTax = booking.details?.tax || 0;
    const taxRate = (settingsObj.taxes || 0) / 100;
    // Tax follows the extension-only discounted rental amount plus the protection delta.
    const taxAdjustment = (rateDifference + protectionDifference - extensionDiscount) * taxRate;
    const newTax = oldTax + taxAdjustment;

    // Incremental total: add the gross extension rate and protection delta, then apply
    // the discount earned only by the extension days and its tax adjustment.
    // This preserves every other component already in booking.total (extras, fees, delivery,
    // discounts, manual charges, existing tax, etc.) without recomputing them.
    const newTotal = (booking.total || 0) + rateDifference + protectionDifference - extensionDiscount + taxAdjustment;

    // Append a system message notifying the guest
    const noteText = note ? ` Note: ${note}` : '';
    const totalAddition = rateDifference + protectionDifference - extensionDiscount + taxAdjustment;
    const systemMsg = {
      id: `msg-${Date.now()}`,
      read: false,
      sender: 'admin' as const,
      text: `Your trip has been extended to ${returnDate} at ${returnTime}. ${totalAddition > 0 ? `Additional charge: $${totalAddition.toFixed(2)}.` : ''}${noteText}`,
      createdAt: new Date().toISOString(),
    };
    const messages = [...(booking.messages || []), systemMsg];

    const updateData: any = {
      returnDate,
      returnTime,
      days: newDays,
      details: {
        ...booking.details,
        extendedRate: newExtendedRate,
        rentalDailyRate: pricePerDay,
         discount: newDiscount,
         discountPercent: discountPricing.discountPercent,
        protection: newProtection,
        protectionDailyRate: protectionPerDay,
        tax: newTax,
      },
      total: newTotal,
      messages,
      carName: booking.carName,
      vehicleId: booking.vehicleId,
    };

    const updated = await storage.updateBooking(id, updateData);
    if (!updated) return res.status(404).json({ error: "Booking not found after update" });

    // Send email notification to guest (async, don't block response)
    (async () => {
      try {
        await sendForceExtendEmail(updated, returnDate, returnTime, extraDays, totalAddition, note);
      } catch {}
    })();
    notifyBookingClient(updated, {
      title: 'Booking extended',
      body: systemMsg.text,
    }).catch((error) => console.error("Error sending forced extension push notification:", error));

    res.json(updated);
  });

  // ========== DELIVERY APPROVAL ==========
  app.put("/api/bookings/:id/accept-pickup", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).send("Booking not found");
    
    const details = (booking.details as any) || {};
    details.pickupAccepted = true;
    
    await storage.updateBooking(id, { details });
    res.json({ success: true });
  });

  app.put("/api/bookings/:id/decline-pickup", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).send("Booking not found");
    
    // Update status to Cancelled
    const updated = await storage.updateBooking(id, { 
      status: 'Cancelled' 
    });

    // Notify host via email
    const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId) : null;
    const hostEmail = process.env.EMAIL_USER; // Admin/Host notification email
    
    if (hostEmail) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: hostEmail,
          subject: `Booking Cancelled - Pickup Declined #${booking.bookingCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">Booking Cancelled by Guest</h2>
              <p>The guest for booking <strong>#${booking.bookingCode}</strong> has declined the pickup method after delivery was rejected.</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                <p><strong>Vehicle:</strong> ${booking.carName}</p>
                <p><strong>Guest:</strong> ${booking.driver?.name}</p>
                <p><strong>Original Dates:</strong> ${booking.startDate} to ${booking.returnDate}</p>
              </div>
              <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">This is an automated notification from CarHop.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Error sending pickup decline email to host:", error);
      }
    }
    notifyBookingClient(updated, {
      title: 'Booking cancelled',
      body: `Booking ${booking.bookingCode} was cancelled because the pickup request was declined.`,
    }).catch((error) => console.error("Error sending pickup cancellation push notification:", error));
    
    res.json({ success: true, booking: updated });
  });

  app.put("/api/bookings/:id/delivery-approval", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { status } = req.body; // 'approved' or 'rejected'
    
    // Update the delivery approval status in details
    const updatedDetails = {
      ...booking.details,
      deliveryApprovalStatus: status,
    };
    
    // Add automatic message to customer
    const messageText = status === 'approved' 
      ? 'Great news! Your delivery request has been approved. The vehicle will be delivered to your specified address at the scheduled time.'
      : 'Your delivery request was declined. Please pick up the vehicle at the location address shown in your booking, or you may contact us to request a different delivery time.';
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: 'admin' as const,
      text: messageText,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    const messages = [...(booking.messages || []), newMessage];
    
    // If delivery is rejected, apply discount equal to delivery fee
    let updateData: any = { 
      details: updatedDetails,
      messages 
    };
    
    if (status === 'rejected') {
      // Calculate delivery fee discount
      const deliveryFee = (booking.details as any)?.deliveryFee || 0;
      if (deliveryFee > 0) {
        // Apply discount in details
        updateData.details = {
          ...updatedDetails,
          discount: ((booking.details?.discount || 0) + deliveryFee)
        };
      }
    }
    
    const updated = await storage.updateBooking(id, updateData);
    
    // Send email notification for delivery approval/rejection
    const pickupLocation = booking.details?.pickupAddress || booking.location || '';
    sendDeliveryApprovalEmail(updated, status, pickupLocation);
    notifyBookingClient(updated, {
      title: status === 'approved' ? 'Delivery approved' : 'Delivery request declined',
      body: messageText,
    }).catch((error) => console.error("Error sending delivery push notification:", error));
    
    res.json(updated);
  });

  // ========== CHAT MESSAGES ==========
  app.post("/api/bookings/:id/messages", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { sender, text } = req.body;
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: sender as 'client' | 'admin',
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    const messages = [...(booking.messages || []), newMessage];
    const updated = await storage.updateBooking(id, { messages });
    if (newMessage.sender === 'client') {
      const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
      notifyBookingStaff(booking, vehicle, 'notifyMessages', {
        title: 'New guest message',
        body: `${booking.driver?.name || 'Guest'} sent a message about ${booking.carName || booking.bookingCode}.`,
      }).catch(err => console.error("Error sending booking message push notification:", err));
    } else {
      notifyBookingClient(updated, {
        title: 'New booking message',
        body: `You have a new message about booking ${booking.bookingCode}.`,
      }).catch(err => console.error("Error sending guest message push notification:", err));
    }
    res.json(updated);
  });

  // ========== EXTRA PAYMENTS ==========
  app.post("/api/bookings/:id/charge-extra", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { type, amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    const paymentMethod = booking.paymentMethod || 'Credit Card';
    const newPayment = {
      id: `pay-${Date.now()}`,
      type: type || 'Extra Charge',
      amount: parseFloat(amount),
      description: description || '',
      paymentMethod,
      processedAt: new Date().toISOString(),
      status: 'completed' as const,
    };
    
    const extraPayments = [...(booking.extraPayments || []), newPayment];
    const newTotal = (booking.total || 0) + parseFloat(amount);
    
    const bookingForTotal = { ...booking, extraPayments };
    const correctTotal = await calculateCorrectTotal(bookingForTotal);
    const updated = await storage.updateBooking(id, { 
      extraPayments,
      total: correctTotal 
    });
    notifyBookingClient(updated, {
      title: 'Additional charge added',
      body: `$${Number(amount).toFixed(2)} was added to booking ${booking.bookingCode}.`,
    }).catch((error) => console.error("Error sending extra charge push notification:", error));
    
    res.json({ 
      success: true, 
      payment: newPayment,
      booking: updated 
    });
  });

  app.put("/api/bookings/:id/messages/read", async (req, res) => {
    const id = parseInt(req.params.id);
    const { reader } = req.body; // 'client', 'admin', or 'host'
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    // Mark all messages from the other party as read
    const messages = (booking.messages || []).map(m => {
      if (m.sender !== reader) {
        return { ...m, read: true };
      }
      return m;
    });
    
    const updated = await storage.updateBooking(id, { messages });
    res.json(updated);
  });

  // ========== VEHICLE REPLACEMENT ==========
  app.post("/api/bookings/:id/replace-vehicle/request", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { requestedBy, reason } = req.body;
    const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId) : null;
    
    const newRequest = {
      id: `vr-${Date.now()}`,
      requestedBy: requestedBy as 'client' | 'host' | 'admin',
      reason: reason || '',
      status: 'pending' as const,
      oldVehicleId: booking.vehicleId || 0,
      oldVehicleModel: booking.carName || vehicle?.model || '',
      oldDailyRate: vehicle?.price || 0,
      createdAt: new Date().toISOString(),
    };
    
    const vehicleReplaceRequests = [...(booking.vehicleReplaceRequests || []), newRequest];
    
    const messageText = requestedBy === 'client' 
      ? `Vehicle replacement requested by client. Reason: ${reason || 'Not specified'}`
      : requestedBy === 'host'
      ? `Host is offering a vehicle replacement. Reason: ${reason || 'Not specified'}`
      : `Admin initiated a vehicle replacement. Reason: ${reason || 'Not specified'}`;
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: requestedBy === 'client' ? 'client' as const : requestedBy === 'host' ? 'host' as const : 'admin' as const,
      text: messageText,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    const messages = [...(booking.messages || []), newMessage];
    const updated = await storage.updateBooking(id, { vehicleReplaceRequests, messages } as any);
    res.json(updated);
  });

  app.post("/api/bookings/:id/replace-vehicle/respond", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { requestId, status, newVehicleId, respondedBy } = req.body;
    
    if (!requestId || !status) {
      return res.status(400).json({ error: "requestId and status required" });
    }
    
    const requests = [...(booking.vehicleReplaceRequests || [])];
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return res.status(404).json({ error: "Request not found" });
    
    if (status === 'approved' && newVehicleId) {
      const newVehicle = await storage.getVehicle(newVehicleId);
      if (!newVehicle) return res.status(404).json({ error: "New vehicle not found" });
      
      const oldRate = requests[reqIndex].oldDailyRate;
      const newRate = newVehicle.price;
      
      const today = new Date();
      const returnDate = new Date(booking.returnDate);
      const remainingMs = returnDate.getTime() - today.getTime();
      const remainingDays = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      
      const priceDiffPerDay = newRate - oldRate;
      const totalPriceDifference = priceDiffPerDay * remainingDays;
      
      requests[reqIndex] = {
        ...requests[reqIndex],
        status: 'approved',
        newVehicleId: newVehicle.id,
        newVehicleModel: newVehicle.model,
        newDailyRate: newRate,
        priceDifference: totalPriceDifference,
        remainingDays,
        respondedAt: new Date().toISOString(),
        respondedBy: respondedBy || 'host',
      };
      
      let messageText = `Vehicle replacement approved! Swapping from ${booking.carName} to ${newVehicle.model}.`;
      if (totalPriceDifference > 0) {
        messageText += ` Additional charge: +$${totalPriceDifference.toFixed(2)} for ${remainingDays} remaining day(s).`;
      } else if (totalPriceDifference < 0) {
        messageText += ` Discount applied: -$${Math.abs(totalPriceDifference).toFixed(2)} for ${remainingDays} remaining day(s).`;
      } else {
        messageText += ` No price difference.`;
      }
      
      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'admin' as const,
        text: messageText,
        createdAt: new Date().toISOString(),
        read: false,
      };
      
      const messages = [...(booking.messages || []), newMessage];
      
      let newTotal = booking.total + totalPriceDifference;
      
      const updated = await storage.updateBooking(id, {
        vehicleReplaceRequests: requests,
        vehicleId: newVehicle.id,
        carName: newVehicle.model,
        image: newVehicle.images?.[0] || booking.image,
        total: newTotal,
        messages,
      } as any);
      notifyBookingClient(updated, {
        title: 'Vehicle replacement approved',
        body: messageText,
      }).catch((error) => console.error("Error sending vehicle replacement push notification:", error));
      
      res.json(updated);
    } else if (status === 'rejected') {
      requests[reqIndex] = {
        ...requests[reqIndex],
        status: 'rejected',
        respondedAt: new Date().toISOString(),
        respondedBy: respondedBy || 'host',
      };
      
      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'admin' as const,
        text: `Vehicle replacement request has been declined.`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      
      const messages = [...(booking.messages || []), newMessage];
      const updated = await storage.updateBooking(id, { vehicleReplaceRequests: requests, messages } as any);
      notifyBookingClient(updated, {
        title: 'Vehicle replacement declined',
        body: newMessage.text,
      }).catch((error) => console.error("Error sending vehicle replacement push notification:", error));
      res.json(updated);
    } else {
      return res.status(400).json({ error: "Invalid status or missing newVehicleId for approval" });
    }
  });

  // ========== SETTINGS ==========
  app.get("/api/push/config", async (_req, res) => {
    res.json({
      configured: webPushConfigured,
      publicKey: webPushConfigured ? vapidPublicKey : null,
    });
  });

  app.post("/api/push/subscriptions", async (req: any, res) => {
    const audiences = await getPushAudiencesForRequest(req);
    if (audiences.length === 0) {
      return res.status(401).json({ error: "Sign in as an Admin or Host before enabling background notifications" });
    }
    const subscription = req.body?.subscription;
    if (
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.keys ||
      typeof subscription.keys.p256dh !== 'string' ||
      typeof subscription.keys.auth !== 'string'
    ) {
      return res.status(400).json({ error: "A valid browser push subscription is required" });
    }

    const subscriptions = await getStoredPushSubscriptions();
    const withoutEndpoint = subscriptions.filter(item => item.endpoint !== subscription.endpoint);
    const now = new Date().toISOString();
    audiences.forEach(audience => {
      withoutEndpoint.push({
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime || null,
        keys: subscription.keys,
        audience,
        updatedAt: now,
      });
    });
    await saveStoredPushSubscriptions(withoutEndpoint);
    res.status(201).json({ success: true, audiences });
  });

  app.delete("/api/push/subscriptions", async (req: any, res) => {
    const audiences = await getPushAudiencesForRequest(req);
    if (audiences.length === 0) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      return res.status(400).json({ error: "Subscription endpoint is required" });
    }
    const subscriptions = await getStoredPushSubscriptions();
    await saveStoredPushSubscriptions(
      subscriptions.filter(item => item.endpoint !== endpoint || !audiences.includes(item.audience))
    );
    res.status(204).send();
  });

  app.get("/api/settings", async (_req, res) => {
    const allSettings = await storage.getAllSettings();
    const settingsObj: Record<string, any> = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    settingsObj.notifications = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(settingsObj.notifications || {}),
    };
    res.json(settingsObj);
  });

  app.get("/api/admin/notification-settings", async (req: any, res) => {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    res.json(await getNotificationSettings());
  });

  app.put("/api/admin/notification-settings", async (req: any, res) => {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const value = req.body?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return res.status(400).json({ error: "Notification settings object is required" });
    }

    const current = await getNotificationSettings();
    const next = {
      ...current,
      ...value,
      duplicateIntervalMinutes: Math.max(0, Math.min(1440, Number(value.duplicateIntervalMinutes ?? current.duplicateIntervalMinutes) || 0)),
    };
    const setting = await storage.setSetting('notifications', next);
    res.json(setting.value);
  });

  app.put("/api/admin/branding", async (req: any, res) => {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const value = req.body?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return res.status(400).json({ error: "Branding object is required" });
    }

    const branding = {
      logoUrl: typeof value.logoUrl === 'string' ? value.logoUrl : '',
      faviconUrl: typeof value.faviconUrl === 'string' ? value.faviconUrl : '',
    };
    const dataUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i;
    for (const [key, image] of Object.entries(branding)) {
      if (image && (!dataUrlPattern.test(image) || image.length > 4_000_000)) {
        return res.status(400).json({ error: `${key} must be a valid image smaller than 3 MB` });
      }
    }

    const setting = await storage.setSetting('branding', branding);
    res.set('Cache-Control', 'no-store');
    res.json(setting.value);
  });

  app.get("/api/settings/:key", async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: "Setting not found" });
    res.json(setting.value);
  });

  app.put("/api/settings/:key", async (req, res) => {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: "Value is required" });
    }
    const setting = await storage.setSetting(req.params.key, value);
    res.json(setting);
  });

  // ========== FINANCIAL SUMMARY ==========
  app.get("/api/financial/summary", async (_req, res) => {
    const [bookings, vehicles] = await Promise.all([
      storage.getBookingFinancialSummaries(),
      storage.getVehicleSummaries(),
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData: Record<string, { gross: number; expenses: number; net: number; pending: number }> = {};
    const vehicleTotals: Record<string, { gross: number; pending: number; expenses: number }> = {};
    const vehicleExpenses: Record<number, any> = {};

    monthNames.forEach(m => monthlyData[m] = { gross: 0, expenses: 0, net: 0, pending: 0 });

    vehicles.forEach(car => {
      const carExp = car.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 };
      // Monthly expenses exclude downPayment (one-time cost)
      const monthlyExpenses = (carExp.lease || 0) + (carExp.insurance || 0) + (carExp.carWash || 0) + (carExp.maintenance || 0) + (carExp.trackApp || 0);
      vehicleExpenses[car.id] = {
        id: car.id,
        model: car.model,
        expenses: carExp,
        totalExpenses: monthlyExpenses
      };
      vehicleTotals[car.model] = { gross: 0, pending: 0, expenses: monthlyExpenses };
    });

    const totalFleetFixedExpenses = vehicles.reduce((sum, car) => {
      const carExp = car.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 };
      // Down Payment is NOT included in monthly expenses (it's a one-time cost)
      return sum + (carExp.lease || 0) + (carExp.insurance || 0) + (carExp.carWash || 0) + (carExp.maintenance || 0) + (carExp.trackApp || 0);
    }, 0);

    bookings.forEach(b => {
      const [y, m, d] = b.startDate.split('-').map(Number);
      const monthIndex = m - 1;
      const monthKey = monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : null;
      const carKey = b.carName;
      
      if (!vehicleTotals[carKey]) {
        vehicleTotals[carKey] = { gross: 0, pending: 0, expenses: 0 };
      }

      if (b.status === 'Completed' && b.checkOutStatus === 'completed') {
        if (monthKey) monthlyData[monthKey].gross += b.total;
        vehicleTotals[carKey].gross += b.total;
      } else if (['Active', 'Extended'].includes(b.status) && b.checkInStatus === 'completed' && b.checkOutStatus !== 'completed') {
        if (monthKey) monthlyData[monthKey].pending += b.total;
        vehicleTotals[carKey].pending += b.total;
      } else if (['Active', 'Extended'].includes(b.status)) {
        if (monthKey) monthlyData[monthKey].pending += b.total;
        vehicleTotals[carKey].pending += b.total;
      }
    });

    monthNames.forEach(m => {
      monthlyData[m].expenses = totalFleetFixedExpenses;
      monthlyData[m].net = monthlyData[m].gross - totalFleetFixedExpenses;
    });

    res.json({ 
      monthly: monthlyData, 
      byVehicle: vehicleTotals, 
      vehicleExpenses: Object.values(vehicleExpenses),
      fixedMonthly: totalFleetFixedExpenses 
    });
  });

  // ========== HOST ROUTES ==========
  // Get all hosts (Admin Matriz only)
  app.get("/api/hosts", async (_req, res) => {
    try {
      const hosts = await storage.getHosts();
      // Host records are Admin reference data and should not remain in a
      // browser cache after authentication or a host-management update.
      res.set('Cache-Control', 'no-store');
      // Don't send password hashes or large base64 document images in list view.
      // Admin fetches full host (with documents) via /api/hosts/:id when needed.
      const safeHosts = hosts.map(h => ({
        ...h,
        passwordHash: undefined,
        // Omit large base64 document images from list (kept on /api/hosts/:id)
        licenseFrontImage: '',
        licenseBackImage: '',
        proofOfResidenceImage: '',
        hasLicenseFrontImage: !!h.licenseFrontImage,
        hasLicenseBackImage: !!h.licenseBackImage,
        hasProofOfResidenceImage: !!h.proofOfResidenceImage,
      }));
      res.json(safeHosts);
    } catch (error) {
      console.error("Error fetching hosts:", error);
      res.status(500).json({ message: "Failed to fetch hosts" });
    }
  });

  // Get single host
  app.get("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const host = await storage.getHost(id);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json({ ...host, passwordHash: undefined });
    } catch (error) {
      console.error("Error fetching host:", error);
      res.status(500).json({ message: "Failed to fetch host" });
    }
  });

  // Host registration
  app.post("/api/hosts/register", async (req, res) => {
    try {
      const { firstName, lastName, email, phone, address, city, state, zipCode,
              licenseNumber, licenseFrontImage, licenseBackImage, proofOfResidenceImage, socialSecurityNumber, username, password,
              agreementAccepted, agreementAcceptedAt } = req.body;

      // Validate agreement acceptance
      if (!agreementAccepted) {
        return res.status(400).json({ message: "You must accept the Host Partner Agreement" });
      }

      // Check if username already exists
      const existingUsername = await storage.getHostByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Check if email already exists
      const existingEmail = await storage.getHostByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const host = await storage.createHost({
        firstName, lastName, email, phone, address, city, state, zipCode,
        licenseNumber, licenseFrontImage, licenseBackImage, proofOfResidenceImage, socialSecurityNumber, username, passwordHash, 
        agreementAccepted: true,
        agreementAcceptedAt: agreementAcceptedAt ? new Date(agreementAcceptedAt) : new Date(),
        status: 'pending'
      });

      // Send confirmation email with agreement copy
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      const loginUrl = `${baseUrl}/`;
      const agreementDate = agreementAcceptedAt ? new Date(agreementAcceptedAt).toLocaleString() : new Date().toLocaleString();
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to CarHop Host Partner Program - Registration Confirmed",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to CarHop Host Partner Program!</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${firstName} ${lastName}</strong>,</p>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  Thank you for registering as a CarHop Host! Your account has been created and is pending verification. Our team will review your documents and credentials within 2-3 business days. You'll receive a confirmation email once your account is approved.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                  <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Your Account Details:</h3>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Name:</strong> ${firstName} ${lastName}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Email:</strong> ${email}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Phone:</strong> ${phone}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Username:</strong> ${username}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Address:</strong> ${address || 'N/A'}, ${city || ''} ${state || ''} ${zipCode || ''}</p>
                  <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">License #:</strong> ${licenseNumber}</p>
                </div>

                <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Status: Pending Verification</strong></p>
                <p style="margin: 5px 0 0 0; color: #b45309; font-size: 12px;">Your account is under review. We'll verify your documents and notify you within 2-3 business days.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="display: inline-block; background: #d1d5db; color: #6b7280; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: not-allowed;">
                    Login to Host Dashboard (Available After Approval)
                  </a>
                </div>
              </div>

              <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">Host Partner Agreement - Copy for Your Records</h2>
                <p style="font-size: 12px; color: #6b7280; margin-bottom: 15px;"><strong>Agreement Accepted:</strong> ${agreementDate}</p>
                
                <div style="font-size: 12px; color: #4b5563; line-height: 1.6;">
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">1. PARTIES AND OVERVIEW</h3>
                  <p>This Host Partner Agreement is entered into between CarHop LLC and you. By accepting this Agreement, you agree to list your vehicle(s) on the CarHop platform.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">2. HOST EARNINGS STRUCTURE</h3>
                  <p><strong>70% Host Earnings:</strong> $250 Damage / Responsibility per incident<br/>
                  <strong>75% Host Earnings:</strong> $500 Damage / Responsibility per incident<br/>
                  <strong>80% Host Earnings:</strong> $1,200 Damage / Responsibility per incident<br/>
                  <strong>90% Host Earnings:</strong> $2,250 Damage / Responsibility per incident</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">3. VEHICLE REQUIREMENTS</h3>
                  <p>Model Year 2010+, Max 120,000 Miles, clean title, registered/insured in Connecticut and we can request an Inspection in our Partners mechanics Places to approve.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">4. INSURANCE COVERAGE</h3>
                  <p>Liability up to $1,000,000, Comprehensive & Collision at ACV (subject to deductible).</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">5. PAYMENT TERMS</h3>
                  <p>Weekly payments via ACH or PayPal, $50 minimum threshold, 3-5 business days processing.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">6. HOST RESPONSIBILITIES</h3>
                  <p>Maintain availability calendar, respond within 2 hours, deliver clean vehicle with 1/4 tank fuel.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">7. GOVERNING LAW</h3>
                  <p>This Agreement is governed by the laws of the State of Connecticut.</p>
                </div>
                
                <p style="font-size: 11px; color: #9ca3af; margin: 20px 0 0 0; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  This is an abbreviated copy of the agreement. The full agreement can be viewed anytime in your Host Dashboard.
                </p>
              </div>

              <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                  Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                  CarHop LLC - Connecticut, USA
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Host email sending error:", emailError);
      }

      res.status(201).json({ 
        message: "Host registered successfully", 
        host: { ...host, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error registering host:", error);
      res.status(500).json({ message: "Failed to register host" });
    }
  });

  // Host login
  app.post("/api/hosts/login", async (req: any, res) => {
    try {
      const { username, password } = req.body;

      const host = await storage.getHostByUsername(username);
      if (!host) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, host.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (host.status !== 'active') {
        return res.status(403).json({ message: "Account is not active" });
      }

      // Establish server-side session so privileged endpoints (e.g. force-extend) can verify host identity
      req.session.authenticatedHostId = host.id;
      req.session.authenticatedHostEmail = host.email;
      req.session.authenticatedHostAt = new Date().toISOString();

      res.json({ 
        message: "Login successful", 
        host: { ...host, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error logging in host:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/hosts/logout-session", async (req: any, res) => {
    // Clear the host session variables (does not destroy the full Passport session)
    delete req.session.authenticatedHostId;
    delete req.session.authenticatedHostEmail;
    delete req.session.authenticatedHostAt;
    res.json({ message: "Host session cleared" });
  });

  // ========== ADMIN SESSION AUTH ==========
  // Establishes a server-side session for admin access to privileged endpoints.
  // Password is read from ADMIN_PASSWORD env var; defaults to the same value as the client-side check.
  app.post("/api/admin/session-auth", async (req: any, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    // ADMIN_PASSWORD must be set as a server secret; no default fallback to avoid source-visible bypass
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("[API] ADMIN_PASSWORD environment secret is not configured");
      return res.status(503).json({ error: "Admin authentication is not configured on this server" });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    req.session.adminAuthenticated = true;
    req.session.adminAuthenticatedAt = new Date().toISOString();
    res.json({ success: true });
  });

  app.get("/api/admin/session-status", async (req: any, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ authenticated: isAdminRequest(req) });
  });

  app.post("/api/admin/session-logout", async (req: any, res) => {
    delete req.session.adminAuthenticated;
    delete req.session.adminAuthenticatedAt;
    res.json({ message: "Admin session cleared" });
  });

  // Host profile update (self-service with limited fields)
  app.put("/api/hosts/:id/profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { phone, email, licenseFrontImage, licenseBackImage } = req.body;

      // Get the current host
      const host = await storage.getHost(id);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }

      // Track what fields changed for notification
      const changes: string[] = [];
      if (phone && phone !== host.phone) changes.push(`Phone: ${host.phone || 'N/A'} → ${phone}`);
      if (email && email !== host.email) changes.push(`Email: ${host.email} → ${email}`);
      if (licenseFrontImage !== undefined && licenseFrontImage !== host.licenseFrontImage) {
        changes.push(licenseFrontImage ? 'Driver License (Front) updated' : 'Driver License (Front) removed');
      }
      if (licenseBackImage !== undefined && licenseBackImage !== host.licenseBackImage) {
        changes.push(licenseBackImage ? 'Driver License (Back) updated' : 'Driver License (Back) removed');
      }

      // Only allow specific fields to be updated (accept empty strings for image removal)
      const updates: any = {};
      if (phone) updates.phone = phone;
      if (email) updates.email = email;
      if (licenseFrontImage !== undefined) updates.licenseFrontImage = licenseFrontImage;
      if (licenseBackImage !== undefined) updates.licenseBackImage = licenseBackImage;

      const updatedHost = await storage.updateHost(id, updates);
      if (!updatedHost) {
        return res.status(404).json({ message: "Host not found" });
      }

      // Send notification email to Admin if any changes were made
      if (changes.length > 0) {
        try {
          const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
          if (adminEmail) {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: adminEmail,
              subject: `CarHop - Host Profile Updated: ${host.firstName} ${host.lastName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Host Profile Updated</h1>
                  </div>
                  
                  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                    <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">
                      <strong>${host.firstName} ${host.lastName}</strong> (@${host.username}) has updated their profile.
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Changes Made:</h3>
                      <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                        ${changes.map(c => `<li style="margin-bottom: 8px;">${c}</li>`).join('')}
                      </ul>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>Action Required:</strong> Please verify the updated information in the Admin Dashboard.
                      </p>
                    </div>
                    
                    <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                      Updated at: ${new Date().toLocaleString()}<br/>
                      CarHop LLC - Connecticut, USA
                    </p>
                  </div>
                </div>
              `,
            });
            console.log(`Host profile update notification sent to admin for host ${host.id}`);
          }
        } catch (emailError) {
          console.error("Error sending host profile update notification:", emailError);
        }
      }

      res.json({ 
        message: "Profile updated successfully", 
        host: { ...updatedHost, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error updating host profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update host (Admin Matriz edit capability)
  app.patch("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password, ...safeUpdates } = req.body;

      // Get the current host to check for status changes
      const hosts = await storage.getHosts();
      const previousHost = hosts.find(h => h.id === id);
      
      // Build update object with only safe fields
      const updates: any = {};
      const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'status', 'socialSecurityNumber', 'licenseNumber'];
      
      for (const field of allowedFields) {
        if (field in safeUpdates) {
          updates[field] = safeUpdates[field];
        }
      }

      // If password is being updated, hash it
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updates.passwordHash = await bcrypt.hash(password, salt);
      }

      const host = await storage.updateHost(id, updates);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }

      // Send email if status changed
      console.log(`DEBUG: previousHost?.status='${previousHost?.status}' (type: ${typeof previousHost?.status}), host?.status='${host?.status}' (type: ${typeof host?.status})`);
      const statusChanged = previousHost && previousHost.status !== host.status;
      console.log(`DEBUG: statusChanged=${statusChanged}`);
      
      if (statusChanged) {
        try {
          const baseUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
          const loginUrl = `${baseUrl}/`;
          let subject = '';
          let emailHtml = '';
          console.log(`DEBUG: ENTERING STATUS CHANGE EMAIL BLOCK: ${previousHost.status} -> ${host.status}`);
          
          if ((host.status === 'active' && previousHost.status === 'pending') || (host.status === 'active' && previousHost.status !== 'active')) {
            // Approval email - Any status to Active
            subject = 'Congratulations! Your CarHop Host Account is Approved';
            console.log(`DEBUG: Sending approval email (${previousHost.status} -> Active)`);
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Approved!</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Great news! Your CarHop Host Partner account has been <strong>approved and is now active</strong>! You're ready to start listing your vehicles and earning money.
                  </p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Next Steps:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                      <li>Login to your account with your username and password</li>
                      <li>Add your vehicles to the platform</li>
                      <li>Set your vehicle availability dates</li>
                      <li>Start earning money with your fleet!</li>
                    </ul>
                  </div>

                  <div style="background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #047857; font-size: 14px;"><strong>Status: Active</strong></p>
                    <p style="margin: 5px 0 0 0; color: #059669; font-size: 12px;">Your account is ready to use. You can login now!</p>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">
                      Login to Your Host Dashboard
                    </a>
                  </div>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          } else if (host.status === 'pending') {
            // Pending/Under Review email
            subject = 'Your CarHop Host Account is Under Review';
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Under Review</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Thank you for registering with CarHop! Your application has been moved to <strong>pending review status</strong>. Our team is carefully evaluating your information.
                  </p>
                  
                  <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Status: Pending Review</strong></p>
                    <p style="margin: 5px 0 0 0; color: #b45309; font-size: 12px;">Your account is being reviewed by our administrative team</p>
                  </div>

                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">What's Next:</h3>
                    <p style="margin: 0; color: #4b5563; font-size: 12px;">
                      You'll receive an email notification once your account has been approved or if we need additional information. This typically takes 24-48 hours.
                    </p>
                  </div>

                  <p style="font-size: 12px; color: #4b5563; line-height: 1.6; margin: 20px 0;">
                    If you have any questions in the meantime, please don't hesitate to contact us.
                  </p>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          } else if (host.status === 'suspended') {
            // Suspension email
            subject = 'Notice: Your CarHop Host Account Has Been Suspended';
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Suspended</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    We regret to inform you that your CarHop Host Partner account has been <strong>suspended</strong> due to violation of our Terms of Service or illegal activity.
                  </p>
                  
                  <div style="background: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason for Suspension:</strong></p>
                    <p style="margin: 5px 0 0 0; color: #b91c1c; font-size: 12px;">Terms of Service Violation or Illegal Activity</p>
                  </div>

                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">What This Means:</h3>
                    <p style="margin: 0; color: #4b5563; font-size: 12px;">
                      Your account will no longer accept bookings. All vehicles currently listed on the platform have been removed.
                    </p>
                  </div>

                  <p style="font-size: 12px; color: #4b5563; line-height: 1.6; margin: 20px 0;">
                    If you believe this is an error or would like to appeal this decision, please contact us immediately.
                  </p>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Contact us at (475) 449-8622 or reply to this email for more information.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          }

          console.log(`DEBUG: subject="${subject}", emailHtml exists=${!!emailHtml}`);
          if (subject && emailHtml) {
            console.log(`DEBUG: Sending email to ${host.email}`);
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: host.email,
              subject: subject,
              html: emailHtml,
            });
            console.log(`DEBUG: Email sent successfully to ${host.email}`);
          } else {
            console.log(`DEBUG: No email sent - subject or emailHtml empty`);
          }
        } catch (emailError) {
          console.error("Host status change email error:", emailError);
        }
      }

      res.json({ message: 'Host updated successfully', host: { ...host, passwordHash: undefined } });
    } catch (error) {
      console.error("Error updating host:", error);
      res.status(500).json({ message: "Failed to update host" });
    }
  });

  // Delete host
  app.delete("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteHost(id);
      if (!success) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json({ message: "Host deleted successfully" });
    } catch (error) {
      console.error("Error deleting host:", error);
      res.status(500).json({ message: "Failed to delete host" });
    }
  });

  // Get vehicles by host
  app.get("/api/hosts/:id/vehicles", async (req, res) => {
    try {
      const hostId = req.params.id;
      const vehicles = await storage.getVehicles();
      const hostVehicles = vehicles.filter(v => v.hostId === hostId);
      res.json(hostVehicles);
    } catch (error) {
      console.error("Error fetching host vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  // Get bookings by host (vehicles owned by host)
  app.get("/api/hosts/:id/bookings", async (req, res) => {
    try {
      const hostId = req.params.id;
      const vehicles = await storage.getVehicles();
      const hostVehicleIds = vehicles.filter(v => v.hostId === hostId).map(v => v.id);
      const bookings = await storage.getBookings();
      const hostBookings = bookings.filter(b => b.vehicleId && hostVehicleIds.includes(b.vehicleId));
      res.json(hostBookings);
    } catch (error) {
      console.error("Error fetching host bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Get all users (for admin clients tab)
  app.get("/api/admin/users", async (req: any, res) => {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const users = await storage.getAllUsers();
      res.set('Cache-Control', 'no-store');
      res.json(users.map(({ passwordHash: _passwordHash, ...user }) => user));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user
  app.put("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password, ...otherUpdates } = req.body;
      const updates = { ...otherUpdates };
      
      // Hash password if provided
      if (password) {
        const salt = await bcrypt.genSalt(10);
        (updates as any).passwordHash = await bcrypt.hash(password, salt);
      }
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Get user to find their email
      const users = await storage.getAllUsers();
      const userToDelete = users.find(u => u.id === id);
      
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete all bookings for this user
      const allBookings = await storage.getBookings();
      const userBookings = allBookings.filter(b => b.driver.email === userToDelete.email);
      for (const booking of userBookings) {
        await storage.deleteBooking(booking.id);
      }
      
      // Delete user
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ========== RATINGS ==========
  
  // Get all ratings
  app.get("/api/ratings", async (req, res) => {
    try {
      const allRatings = await storage.getRatings();
      res.json(allRatings);
    } catch (error) {
      console.error("Error getting ratings:", error);
      res.status(500).json({ message: "Failed to get ratings" });
    }
  });

  // Get ratings by vehicle
  app.get("/api/ratings/vehicle/:vehicleId", async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const vehicleRatings = await storage.getRatingsByVehicle(vehicleId);
      res.json(vehicleRatings);
    } catch (error) {
      console.error("Error getting vehicle ratings:", error);
      res.status(500).json({ message: "Failed to get vehicle ratings" });
    }
  });

  // Get rating by booking
  app.get("/api/ratings/booking/:bookingId", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const rating = await storage.getRatingByBooking(bookingId);
      res.json(rating || null);
    } catch (error) {
      console.error("Error getting booking rating:", error);
      res.status(500).json({ message: "Failed to get booking rating" });
    }
  });

  // Create rating (client rates trip)
  app.post("/api/ratings", async (req, res) => {
    try {
      const { bookingId, vehicleId, clientName, clientEmail, hostId, stars, comment } = req.body;
      
      // Check if rating already exists for this booking
      const existing = await storage.getRatingByBooking(bookingId);
      if (existing) {
        return res.status(400).json({ message: "Rating already exists for this booking" });
      }
      
      const newRating = await storage.createRating({
        bookingId,
        vehicleId,
        clientName,
        clientEmail,
        hostId,
        stars,
        comment: comment || null,
      });
      
      res.status(201).json(newRating);
    } catch (error) {
      console.error("Error creating rating:", error);
      res.status(500).json({ message: "Failed to create rating" });
    }
  });

  // Update rating (host response and/or host rating to client)
  app.put("/api/ratings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { hostResponse, hostStarsToClient, hostCommentToClient } = req.body;
      
      const updateData: any = {};
      if (hostResponse !== undefined) updateData.hostResponse = hostResponse;
      if (hostStarsToClient !== undefined) {
        updateData.hostStarsToClient = hostStarsToClient;
        updateData.hostCommentToClient = hostCommentToClient || null;
        updateData.hostRatedClientAt = new Date();
      }
      
      const updatedRating = await storage.updateRating(id, updateData);
      if (!updatedRating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      
      res.json(updatedRating);
    } catch (error) {
      console.error("Error updating rating:", error);
      res.status(500).json({ message: "Failed to update rating" });
    }
  });

  // Delete rating (admin only)
  app.delete("/api/ratings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteRating(id);
      
      if (!success) {
        return res.status(404).json({ message: "Rating not found" });
      }
      
      res.json({ message: "Rating deleted successfully" });
    } catch (error) {
      console.error("Error deleting rating:", error);
      res.status(500).json({ message: "Failed to delete rating" });
    }
  });

  // ==================== SUPPORT MESSAGES ====================
  
  // Get all support messages
  app.get("/api/support-messages", async (req, res) => {
    try {
      const messages = await storage.getSupportMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error getting support messages:", error);
      res.status(500).json({ message: "Failed to get support messages" });
    }
  });

  // Get support messages by type (client or host)
  app.get("/api/support-messages/type/:senderType", async (req, res) => {
    try {
      const { senderType } = req.params;
      if (senderType !== 'client' && senderType !== 'host') {
        return res.status(400).json({ message: "Invalid sender type. Must be 'client' or 'host'" });
      }
      const messages = await storage.getSupportMessagesByType(senderType);
      res.json(messages);
    } catch (error) {
      console.error("Error getting support messages by type:", error);
      res.status(500).json({ message: "Failed to get support messages" });
    }
  });

  // Get unread count by type
  app.get("/api/support-messages/unread/:senderType", async (req, res) => {
    try {
      const { senderType } = req.params;
      if (senderType !== 'client' && senderType !== 'host') {
        return res.status(400).json({ message: "Invalid sender type. Must be 'client' or 'host'" });
      }
      const count = await storage.getUnreadSupportMessagesCount(senderType);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Get single support message
  app.get("/api/support-messages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.getSupportMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Support message not found" });
      }
      res.json(message);
    } catch (error) {
      console.error("Error getting support message:", error);
      res.status(500).json({ message: "Failed to get support message" });
    }
  });

  // Create support message
  app.post("/api/support-messages", async (req, res) => {
    try {
      const { senderType, senderId, senderName, senderIdentifier, senderEmail, subject, text, images } = req.body;
      
      if (!senderType || !senderId || !senderName || !senderIdentifier || !text) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (senderType !== 'client' && senderType !== 'host') {
        return res.status(400).json({ message: "Invalid sender type. Must be 'client' or 'host'" });
      }
      
      const finalSubject = subject || 'Questions';
      
      // Check if there's a finished chat with same subject/sender and reopen it
      const lastFinished = await (storage as any).getLastFinishedChat(finalSubject, senderId);
      if (lastFinished && lastFinished.isFinished) {
        // Reopen the chat
        await (storage as any).reopenChat(finalSubject, senderId, lastFinished.chatStartedAt);
        
        // Create system message about reopening
        const reopenTime = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const systemMessage = await (storage as any).createSupportMessage({
          senderType: senderType,
          senderId: senderId,
          senderName: senderName,
          senderIdentifier: senderIdentifier,
          senderEmail: senderEmail || null,
          subject: finalSubject,
          text: `(Client reopened the chat ${reopenTime})`,
          images: [],
          read: true,
          chatStartedAt: lastFinished.chatStartedAt
        });
      }
      
      const newMessage = await (storage as any).createSupportMessage({
        senderType,
        senderId,
        senderName,
        senderIdentifier,
        senderEmail: senderEmail || null,
        subject: finalSubject,
        text,
        images: images || [],
        read: false,
        chatStartedAt: lastFinished?.chatStartedAt || undefined
      });

      notifyAdminOfSupportRequest(newMessage)
        .catch(err => console.error("Error sending support request push notification:", err));
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error creating support message:", error);
      res.status(500).json({ message: "Failed to create support message" });
    }
  });

  // Update support message (admin reply, mark as read)
  app.put("/api/support-messages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { adminReply, read } = req.body;
      
      // Get the original message first to get sender info for email notification
      const originalMessage = await storage.getSupportMessage(id);
      if (!originalMessage) {
        return res.status(404).json({ message: "Support message not found" });
      }
      
      const updateData: any = {};
      if (adminReply !== undefined) updateData.adminReply = adminReply;
      if (read !== undefined) updateData.read = read;
      
      const updatedMessage = await storage.updateSupportMessage(id, updateData);
      if (!updatedMessage) {
        return res.status(404).json({ message: "Support message not found" });
      }
      
      // Send email notification when admin replies to a host message
      if (adminReply && originalMessage.senderType === 'host') {
        notifyHostOfSupportReply(originalMessage, adminReply)
          .catch(err => console.error('Error sending support reply push notification to host:', err));
        const hostEmail = originalMessage.senderEmail || originalMessage.senderIdentifier;
        if (hostEmail && hostEmail.includes('@')) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || 'noreply@carhop.com',
              to: hostEmail,
              subject: 'CarHop Support - New Reply to Your Message',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #16a34a;">CarHop Support</h2>
                  <p>Hello ${originalMessage.senderName},</p>
                  <p>You have received a new reply from CarHop Support:</p>
                  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; white-space: pre-wrap;">${adminReply}</p>
                  </div>
                  <p>Log in to your Host Dashboard to continue the conversation.</p>
                  <p style="color: #666; font-size: 12px;">This is an automated message from CarHop.</p>
                </div>
              `
            });
            console.log(`Support reply email sent to host: ${hostEmail}`);
          } catch (emailError) {
            console.error('Error sending support reply email to host:', emailError);
          }
        }
      }
      
      // Send email notification when admin replies to a client message
      if (adminReply && originalMessage.senderType === 'client') {
        const clientEmail = originalMessage.senderIdentifier;
        if (clientEmail && clientEmail.includes('@')) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || 'noreply@carhop.com',
              to: clientEmail,
              subject: 'CarHop Support - New reply to your inquiry',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                  <div style="background: #16a34a; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">CarHop Support</h1>
                  </div>
                  <div style="padding: 32px; background: white;">
                    <p style="font-size: 16px; color: #374151; margin-top: 0;">Hello ${originalMessage.senderName},</p>
                    <p style="font-size: 16px; color: #374151;">You have received a new reply from our support team regarding: <strong>"${originalMessage.subject}"</strong></p>
                    
                    <div style="background: #f9fafb; border-left: 4px solid #16a34a; padding: 20px; border-radius: 4px; margin: 24px 0;">
                      <p style="margin: 0; white-space: pre-wrap; color: #1f2937; font-size: 15px; line-height: 1.6;">${adminReply}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${process.env.APP_URL || 'https://carhop.replit.app'}" style="background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View in Chat</a>
                    </div>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 20px;">
                      Thank you for choosing CarHop. If you have any further questions, feel free to reply directly in the chat on our platform.
                    </p>
                  </div>
                  <div style="background: #f9fafb; padding: 16px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated message from CarHop. Please do not reply to this email.</p>
                  </div>
                </div>
              `
            });
            console.log(`Support reply email sent to client: ${clientEmail}`);
          } catch (emailError) {
            console.error('Error sending support reply email to client:', emailError);
          }
        }
      }
      
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating support message:", error);
      res.status(500).json({ message: "Failed to update support message" });
    }
  });

  // Delete support message
  app.delete("/api/support-messages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSupportMessage(id);
      
      if (!success) {
        return res.status(404).json({ message: "Support message not found" });
      }
      
      res.json({ message: "Support message deleted successfully" });
    } catch (error) {
      console.error("Error deleting support message:", error);
      res.status(500).json({ message: "Failed to delete support message" });
    }
  });

  // Finish chat (client/host closes conversation)
  app.post("/api/support-messages/finish-chat", async (req, res) => {
    try {
      const { senderIdentifier, senderType, finishedBy } = req.body;
      
      if (!senderIdentifier || !senderType || !finishedBy) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (senderType !== 'client' && senderType !== 'host') {
        return res.status(400).json({ message: "Invalid sender type" });
      }
      
      const success = await (storage as any).finishSupportMessageGroup(senderIdentifier, senderType, finishedBy);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to finish chat" });
      }
      
      res.json({ message: "Chat finished successfully" });
    } catch (error) {
      console.error("Error finishing chat:", error);
      res.status(500).json({ message: "Failed to finish chat" });
    }
  });

  // Finish chat by subject and sender (admin only)
  app.post("/api/support-messages/finish-group", async (req, res) => {
    try {
      const { subject, senderId, finishedBy, chatStartedAt } = req.body;
      
      if (!subject || !senderId || !finishedBy) {
        console.log("Missing fields:", { subject, senderId, finishedBy });
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      console.log(`Finishing chat - Subject: ${subject}, SenderId: ${senderId}, ChatStartedAt: ${chatStartedAt}, FinishedBy: ${finishedBy}`);
      const chatStartedAtDate = chatStartedAt ? new Date(chatStartedAt) : undefined;
      const success = await (storage as any).finishSupportMessageGroupBySubjectAndSender(subject, senderId, finishedBy, chatStartedAtDate);
      
      if (!success) {
        console.log("Failed to finish chat - no messages found or already finished");
        return res.status(400).json({ message: "Failed to finish chat - no messages found" });
      }
      
      res.json({ message: "Chat conversation finished successfully" });
    } catch (error) {
      console.error("Error finishing chat group:", error);
      res.status(500).json({ message: "Failed to finish chat" });
    }
  });


  // Forgot password endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (user) {
        const resetToken = (storage as any).generatePasswordResetToken(email);
        const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
        const resetLink = `${baseUrl}/?reset-token=${resetToken}`;
        
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: email,
            subject: "CarHop - Reset Your Password",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Password Reset</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${user.firstName || 'there'}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    We received a request to reset the password for your CarHop account. Click the button below to create a new password.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                      Reset Password
                    </a>
                  </div>
                  
                  <p style="font-size: 12px; color: #6b7280; margin: 20px 0 0 0;">
                    This link will expire in 24 hours. If you did not request this reset, please ignore this email.
                  </p>
                  
                  <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Error sending password reset email:", emailError);
        }
      }
      
      res.json({ message: "If this email is registered, you will receive a password reset link." });
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      const tokenData = (storage as any).validatePasswordResetToken(token);
      if (!tokenData) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const user = await storage.getUserByEmail(tokenData.email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const passwordHash = bcrypt.hashSync(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash });
      (storage as any).invalidatePasswordResetToken(token);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error in reset password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Cancel booking - notifies host
  app.put('/api/bookings/:id/cancel', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Update booking status to Cancelled
      const updatedBooking = await storage.updateBooking(bookingId, {
        status: 'Cancelled'
      });

      // Send email to host/admin notifying about cancellation
      if (booking.details?.hostEmail || process.env.EMAIL_USER) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER || "noreply@carhop.com",
            to: booking.details?.hostEmail || process.env.EMAIL_USER || "admin@carhop.com",
            subject: "CarHop - Booking Cancelled",
            html: `
              <h2>Booking Cancelled</h2>
              <p>A booking has been cancelled by the client.</p>
              <p><strong>Booking Details:</strong></p>
              <ul>
                <li>Vehicle: ${booking.carName}</li>
                <li>Client: ${booking.driver.name}</li>
                <li>Email: ${booking.driver.email}</li>
                <li>Phone: ${booking.driver.phone}</li>
                <li>Start Date: ${booking.startDate} at ${booking.startTime}</li>
                <li>Return Date: ${booking.returnDate} at ${booking.returnTime}</li>
              </ul>
              <p>The client has cancelled this booking and can now create a new one anytime.</p>
              <p><strong>CarHop Admin Team</strong></p>
            `
          });
        } catch (emailError) {
          console.error("Error sending cancellation email:", emailError);
        }
      }

      res.json({ message: "Booking cancelled successfully", booking: updatedBooking });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  // Host Pickup Locations - Get locations for a specific host (public read)
  app.get('/api/hosts/:hostId/pickup-locations', async (req, res) => {
    try {
      const { hostId } = req.params;
      const host = await storage.getHost(parseInt(hostId));
      
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      
      res.json({ locations: host.pickupLocations || [] });
    } catch (error) {
      console.error("Error getting host pickup locations:", error);
      res.status(500).json({ message: "Failed to get pickup locations" });
    }
  });

  // Host Pickup Locations - Add a new location
  app.post('/api/hosts/:hostId/pickup-locations', async (req: any, res) => {
    try {
      const { hostId } = req.params;
      const { location } = req.body;
      
      if (!location || typeof location !== 'string') {
        return res.status(400).json({ message: "Location is required" });
      }
      
      const host = await storage.getHost(parseInt(hostId));
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      
      const currentLocations = host.pickupLocations || [];
      const trimmedLocation = location.trim();
      if (currentLocations.some(l => l.toLowerCase() === trimmedLocation.toLowerCase())) {
        return res.status(400).json({ message: "Location already exists" });
      }
      
      const updatedHost = await storage.updateHost(parseInt(hostId), {
        pickupLocations: [...currentLocations, trimmedLocation]
      });
      
      res.json({ locations: updatedHost?.pickupLocations || [] });
    } catch (error) {
      console.error("Error adding host pickup location:", error);
      res.status(500).json({ message: "Failed to add pickup location" });
    }
  });

  // Host Pickup Locations - Remove a location
  app.delete('/api/hosts/:hostId/pickup-locations', async (req: any, res) => {
    try {
      const { hostId } = req.params;
      const { location } = req.body;
      
      if (!location || typeof location !== 'string') {
        return res.status(400).json({ message: "Location is required" });
      }
      
      const host = await storage.getHost(parseInt(hostId));
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      
      const currentLocations = host.pickupLocations || [];
      const updatedLocations = currentLocations.filter(l => l !== location);
      
      const updatedHost = await storage.updateHost(parseInt(hostId), {
        pickupLocations: updatedLocations
      });
      
      res.json({ locations: updatedHost?.pickupLocations || [] });
    } catch (error) {
      console.error("Error removing host pickup location:", error);
      res.status(500).json({ message: "Failed to remove pickup location" });
    }
  });

  // Payouts - Get payout history for a host
  app.get('/api/hosts/:hostId/payouts', async (req, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: "Host not found" });
      const payoutList = await storage.getPayoutsByHost(hostId);
      res.json(payoutList);
    } catch (error) {
      console.error("Error getting payouts:", error);
      res.status(500).json({ error: "Failed to get payouts" });
    }
  });

  // Payouts - Create a new payout (withdraw)
  app.post('/api/hosts/:hostId/payouts', async (req, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: "Host not found" });

      const { amount, type } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

      const fee = type === 'instant' ? parseFloat((amount * 0.02).toFixed(2)) : 0;
      const netAmount = parseFloat((amount - fee).toFixed(2));

      const payout = await storage.createPayout({
        hostId,
        amount: parseFloat(amount.toFixed(2)),
        fee,
        netAmount,
        type: type || 'instant',
        status: 'completed',
        note: req.body.note || null,
      });

      // Update host payout settings with last payout date and total withdrawn
      const currentSettings = (host as any).payoutSettings || {};
      const totalWithdrawn = (currentSettings.totalWithdrawn || 0) + netAmount;
      await storage.updateHost(hostId, {
        payoutSettings: {
          ...currentSettings,
          totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
          lastPayoutAt: new Date().toISOString(),
        }
      } as any);

      res.status(201).json(payout);
    } catch (error) {
      console.error("Error creating payout:", error);
      res.status(500).json({ error: "Failed to create payout" });
    }
  });

  // Send a manual Stripe transfer from the platform balance to a host's connected account
  app.post('/api/hosts/:hostId/stripe-transfer', async (req: any, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      if (Number.isNaN(hostId)) return res.status(400).json({ error: 'Invalid host id' });
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: 'Host not found' });
      if (!host.stripeAccountId) {
        return res.status(400).json({ error: 'Host has not connected a Stripe account yet' });
      }
      if (!host.stripeOnboardingComplete) {
        return res.status(400).json({ error: 'Host onboarding is incomplete on Stripe' });
      }

      const { amount, note, idempotencyKey } = req.body || {};
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0 || amt > 1_000_000) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      const cents = Math.round(amt * 100);
      if (cents < 1) {
        return res.status(400).json({ error: 'Amount is too small' });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const idemKey = (typeof idempotencyKey === 'string' && idempotencyKey.length > 0 && idempotencyKey.length <= 200)
        ? idempotencyKey
        : `host-${hostId}-${cents}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const transfer = await stripe.transfers.create(
        {
          amount: cents,
          currency: 'usd',
          destination: host.stripeAccountId,
          description: note || `Payout to ${host.firstName} ${host.lastName}`,
          metadata: { hostId: String(hostId) },
        },
        { idempotencyKey: idemKey }
      );

      const payout = await storage.createPayout({
        hostId,
        amount: parseFloat(amt.toFixed(2)),
        fee: 0,
        netAmount: parseFloat(amt.toFixed(2)),
        type: 'stripe',
        status: 'completed',
        note: note || null,
        stripeTransferId: transfer.id,
      } as any);

      const currentSettings = (host as any).payoutSettings || {};
      const totalWithdrawn = (currentSettings.totalWithdrawn || 0) + amt;
      await storage.updateHost(hostId, {
        payoutSettings: {
          ...currentSettings,
          totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
          lastPayoutAt: new Date().toISOString(),
        }
      } as any);

      res.status(201).json({ payout, transferId: transfer.id });
    } catch (error: any) {
      console.error('[StripeTransfer] error:', error?.message || error);
      res.status(500).json({ error: error?.message || 'Failed to send transfer' });
    }
  });

  // ========== STRIPE CONNECT EXPRESS (host bank linking) ==========
  // NOTE: Hosts authenticate client-side (no server session), matching the existing
  // /api/hosts/:hostId/payout-settings and /pickup-locations endpoints. We rely on the
  // host knowing their hostId from the client login response.

  // Create or refresh a Stripe Connect Express onboarding link for the host
  app.post('/api/hosts/:hostId/stripe-connect/onboard', async (req: any, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      if (Number.isNaN(hostId)) return res.status(400).json({ error: 'Invalid host id' });
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: 'Host not found' });

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      let accountId = host.stripeAccountId;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email: host.email,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: { hostId: String(host.id) },
        });
        accountId = account.id;
        await storage.updateHost(hostId, { stripeAccountId: accountId });
      }

      // Always derive base URL from server-known request, never trust client Origin header
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/?stripeConnect=refresh&hostId=${hostId}`,
        return_url: `${baseUrl}/?stripeConnect=return&hostId=${hostId}`,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url, accountId });
    } catch (error: any) {
      const message = error?.message || "Failed to create onboarding link";
      const connectNotEnabled = message.toLowerCase().includes('sign up for connect') ||
        message.toLowerCase().includes('connect platform');
      console.error("[StripeConnect] onboard error:", message);
      res.status(connectNotEnabled ? 503 : 500).json({
        error: connectNotEnabled
          ? "Stripe Connect is not enabled for this Stripe account"
          : message,
        code: connectNotEnabled ? "STRIPE_CONNECT_NOT_ENABLED" : "STRIPE_CONNECT_ONBOARDING_FAILED",
      });
    }
  });

  // Check Stripe Connect Express status for the host
  app.get('/api/hosts/:hostId/stripe-connect/status', async (req: any, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      if (Number.isNaN(hostId)) return res.status(400).json({ error: 'Invalid host id' });
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: 'Host not found' });
      if (!host.stripeAccountId) {
        return res.json({ connected: false, onboardingComplete: false });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      const account = await stripe.accounts.retrieve(host.stripeAccountId);

      const onboardingComplete = !!account.details_submitted && !!account.payouts_enabled;
      const externalAccount = (account.external_accounts?.data?.[0] as any) || null;
      const bankInfo = externalAccount ? {
        bankName: externalAccount.bank_name || null,
        last4: externalAccount.last4 || null,
        country: externalAccount.country || null,
      } : null;

      // Persist onboarding status + write a 'linked' bank account record matching the UI contract
      const updates: any = {};
      if (host.stripeOnboardingComplete !== onboardingComplete) {
        updates.stripeOnboardingComplete = onboardingComplete;
      }
      if (onboardingComplete && bankInfo) {
        updates.bankAccount = {
          type: 'linked',
          method: 'linked',
          bankName: bankInfo.bankName || 'Stripe',
          accountName: `${host.firstName} ${host.lastName}`,
          accountHolderName: `${host.firstName} ${host.lastName}`,
          linkedEmail: host.email,
          accountNumber: bankInfo.last4 || '',
          routingNumber: '',
          linkedAt: new Date().toISOString(),
        };
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateHost(hostId, updates);
      }

      res.json({
        connected: true,
        accountId: host.stripeAccountId,
        onboardingComplete,
        detailsSubmitted: !!account.details_submitted,
        payoutsEnabled: !!account.payouts_enabled,
        chargesEnabled: !!account.charges_enabled,
        bank: bankInfo,
      });
    } catch (error: any) {
      console.error("[StripeConnect] status error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to fetch status" });
    }
  });

  // Payouts - Update bank account & payout settings for a host
  app.put('/api/hosts/:hostId/payout-settings', async (req, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const host = await storage.getHost(hostId);
      if (!host) return res.status(404).json({ error: "Host not found" });

      const { bankAccount, payoutSettings } = req.body;
      const updates: any = {};
      if (bankAccount !== undefined) updates.bankAccount = bankAccount;
      if (payoutSettings !== undefined) updates.payoutSettings = payoutSettings;

      const updated = await storage.updateHost(hostId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating payout settings:", error);
      res.status(500).json({ error: "Failed to update payout settings" });
    }
  });
}
