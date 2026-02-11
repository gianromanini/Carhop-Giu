import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertBookingSchema, insertHostSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./googleAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Email notification helper functions
async function sendBookingConfirmationEmail(booking: any, vehicle: any) {
  const clientEmail = booking.driver?.email;
  if (!clientEmail) return;

  const deliveryType = booking.details?.deliveryType || 'pickup';
  const deliveryAddress = booking.details?.deliveryAddress || '';
  const pickupAddress = booking.details?.pickupAddress || booking.location || '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `CarHop - Booking Confirmation #${booking.bookingCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Booking Confirmed!</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${booking.driver?.name || 'Customer'}</strong>,</p>
            
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Your booking has been confirmed! Here are your rental details:
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
              ${deliveryType === 'delivery' ? `
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
  const hostEmail = process.env.EMAIL_USER; // Admin email
  if (!hostEmail) return;

  const deliveryType = booking.details?.deliveryType || 'pickup';
  const deliveryAddress = booking.details?.deliveryAddress || '';

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: hostEmail,
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
  const taxRate = (settingsObj.taxes || 0) / 100;
  
  // Initial Payment = rate + protection + extras + cleaningFee
  const initialSubtotal = (booking.details?.rate || 0) + (booking.details?.protection || 0) + (booking.details?.extras || 0) + (booking.details?.fees || 0);
  const initialTax = initialSubtotal > 0 ? initialSubtotal * taxRate : 0;
  
  // Additional Charges = extendedRate + manualCharges + extraPayments - discount
  const extendedRate = booking.details?.extendedRate || 0;
  const manualChargesTotal = Array.isArray(booking.details?.manualCharges) ? (booking.details.manualCharges as any[]).reduce((sum: number, c: any) => sum + (c.amount || 0), 0) : 0;
  const extraPaymentsTotal = (booking.extraPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
  const discount = booking.details?.discount || 0;
  const additionalChargesBeforeTax = extendedRate + manualChargesTotal + extraPaymentsTotal - discount;
  const additionalTax = additionalChargesBeforeTax > 0 ? additionalChargesBeforeTax * taxRate : 0;
  
  return initialSubtotal + initialTax + additionalChargesBeforeTax + additionalTax;
}

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // ========== AUTHENTICATION (Google OAuth) ==========
  await setupAuth(app);

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
    const vehicles = await storage.getVehicles();
    const hosts = await storage.getHosts();
    const hostsMap = new Map(hosts.map(h => [h.id.toString(), h]));
    
    let filteredVehicles = vehicles;
    
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      const requestedStart = startDate as string;
      const requestedEnd = endDate as string;
      const allBookings = await storage.getBookings();
      const activeStatuses = ['Cancelled', 'Declined', 'Completed'];
      const overlappingVehicleIds = new Set<number>();
      
      for (const booking of allBookings) {
        if (activeStatuses.includes(booking.status)) continue;
        if (!booking.vehicleId) continue;
        if (booking.startDate < requestedEnd && booking.returnDate > requestedStart) {
          overlappingVehicleIds.add(booking.vehicleId);
        }
      }
      
      filteredVehicles = vehicles.filter(v => !overlappingVehicleIds.has(v.id));
    }
    
    const vehiclesWithHost = filteredVehicles.map(v => ({
      ...v,
      hostInfo: v.hostId ? {
        id: hostsMap.get(v.hostId)?.id,
        firstName: hostsMap.get(v.hostId)?.firstName,
        lastName: hostsMap.get(v.hostId)?.lastName,
        city: hostsMap.get(v.hostId)?.city,
        state: hostsMap.get(v.hostId)?.state,
      } : null,
    }));
    
    res.json(vehiclesWithHost);
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getVehicle(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  });

  app.post("/api/vehicles", async (req, res) => {
    const result = insertVehicleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const vehicle = await storage.createVehicle(result.data);
    res.status(201).json(vehicle);
  });

  app.put("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertVehicleSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const vehicle = await storage.updateVehicle(id, result.data);
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
      updateData.hostId = transferRequests[requestIndex].toHostId;
      updateData.hostName = transferRequests[requestIndex].toHostName;
    }

    const updated = await storage.updateVehicle(id, updateData);
    res.json(updated);
  });

  app.get("/api/bookings", async (_req, res) => {
    try {
      console.log(`[API] /api/bookings - Starting fetch at ${new Date().toISOString()}`);
      const bookings = await storage.getBookings();
      console.log(`[API] /api/bookings - Got ${bookings.length} bookings, preparing response...`);
      
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
      const optimizedBookings = bookings.map(booking => {
        const optimized = { ...booking };
        
        // Replace large base64 images with placeholder info
        if (optimized.driver && typeof optimized.driver === 'object') {
          const driver = { ...optimized.driver as any };
          if (driver.licenseImages && Array.isArray(driver.licenseImages)) {
            // Keep count but replace actual images with placeholders
            driver.licenseImagesCount = driver.licenseImages.length;
            driver.licenseImages = driver.licenseImages.map((img: string) => 
              typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
            );
          }
          optimized.driver = driver;
        }
        
        // Replace check-in photos with placeholders
        if (optimized.checkInData && typeof optimized.checkInData === 'object') {
          const checkIn = { ...optimized.checkInData as any };
          if (checkIn.photosOutside && Array.isArray(checkIn.photosOutside)) {
            checkIn.photosOutsideCount = checkIn.photosOutside.length;
            checkIn.photosOutside = checkIn.photosOutside.map((img: string) => 
              typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
            );
          }
          if (checkIn.photosInside && Array.isArray(checkIn.photosInside)) {
            checkIn.photosInsideCount = checkIn.photosInside.length;
            checkIn.photosInside = checkIn.photosInside.map((img: string) => 
              typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
            );
          }
          optimized.checkInData = checkIn;
        }
        
        // Replace check-out photos with placeholders
        if (optimized.checkOutData && typeof optimized.checkOutData === 'object') {
          const checkOut = { ...optimized.checkOutData as any };
          if (checkOut.photosOutside && Array.isArray(checkOut.photosOutside)) {
            checkOut.photosOutsideCount = checkOut.photosOutside.length;
            checkOut.photosOutside = checkOut.photosOutside.map((img: string) => 
              typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
            );
          }
          if (checkOut.photosInside && Array.isArray(checkOut.photosInside)) {
            checkOut.photosInsideCount = checkOut.photosInside.length;
            checkOut.photosInside = checkOut.photosInside.map((img: string) => 
              typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
            );
          }
          optimized.checkOutData = checkOut;
        }
        
        return optimized;
      });
      
      console.log(`[API] /api/bookings - Sending optimized JSON response...`);
      res.json(optimizedBookings);
      console.log(`[API] /api/bookings - Response sent successfully`);
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
      res.json(userBookings);
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
      const booking = await storage.createBooking(result.data);
      console.log("[API] Booking created successfully:", booking.id);
      
      // Send email notifications in background to avoid blocking response
      const vehicle = booking.vehicleId ? await storage.getVehicle(booking.vehicleId).catch(() => null) : null;
      sendBookingConfirmationEmail(booking, vehicle).catch(err => console.error("Error sending confirmation email:", err));
      sendNewBookingNotificationToHost(booking, vehicle).catch(err => console.error("Error sending host notification:", err));

      res.status(201).json(booking);
    } catch (error) {
      console.error("[API] Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.put("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertBookingSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    
    // Get the current booking state before update
    const previousBooking = await storage.getBooking(id);
    
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

    const newRequest = {
      id: `ext-${Date.now()}`,
      type: type as 'extension' | 'reduction',
      requestedReturnDate,
      requestedReturnTime,
      reason: reason || '',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    
    const extensionRequests = [...(booking.extensionRequests || []), newRequest];
    const updated = await storage.updateBooking(id, { extensionRequests });
    res.json(updated);
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
      const vehicle = vehicleId ? await storage.getVehicle(vehicleId) : null;
      const pricePerDay = vehicle?.price || 0;
      
      // Adjust total and extended rate based on days difference
      const rateDifference = pricePerDay * daysDifference;
      const oldExtendedRate = booking.details?.extendedRate || 0;
      const newExtendedRate = Math.max(0, oldExtendedRate + rateDifference);
      
      // Calculate tax adjustment
      const oldTax = booking.details?.tax || 0;
      let newTax = oldTax;
      if (daysDifference !== 0) {
        const taxRate = (settingsObj.taxes || 0) / 100;
        const taxAdjustment = rateDifference * taxRate;
        newTax = oldTax + taxAdjustment;
      }
      
      // Total will be recalculated correctly
      updateData.details = {
        ...booking.details,
        extendedRate: newExtendedRate,
        tax: newTax
      };
    }
    
    const updated = await storage.updateBooking(id, updateData);
    
    // Send email notification for extension response
    const respondedRequest = extensionRequests.find(r => r.id === requestId);
    if (respondedRequest && (status === 'approved' || status === 'rejected')) {
      sendExtensionResponseEmail(updated, status, respondedRequest);
    }
    
    res.json(updated);
  });

  // ========== DELIVERY APPROVAL ==========
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

  // ========== SETTINGS ==========
  app.get("/api/settings", async (_req, res) => {
    const allSettings = await storage.getAllSettings();
    const settingsObj: Record<string, any> = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
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
    const bookings = await storage.getBookings();
    const vehicles = await storage.getVehicles();

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
      // Don't send password hashes to frontend
      const safeHosts = hosts.map(h => ({ ...h, passwordHash: undefined }));
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
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">2. COMMISSION STRUCTURE</h3>
                  <p><strong>15% Commission Plan:</strong> $750 deductible per incident<br/>
                  <strong>25% Commission Plan:</strong> $500 deductible per incident</p>
                  
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
  app.post("/api/hosts/login", async (req, res) => {
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

      res.json({ 
        message: "Login successful", 
        host: { ...host, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error logging in host:", error);
      res.status(500).json({ message: "Failed to login" });
    }
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
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
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
          text: `(Cliente Reabriu o chat ${reopenTime})`,
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
              subject: 'CarHop Support - Nova Resposta ao seu chamado',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                  <div style="background: #16a34a; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">CarHop Support</h1>
                  </div>
                  <div style="padding: 32px; background: white;">
                    <p style="font-size: 16px; color: #374151; margin-top: 0;">Olá ${originalMessage.senderName},</p>
                    <p style="font-size: 16px; color: #374151;">Você recebeu uma nova resposta do nosso suporte sobre o assunto: <strong>"${originalMessage.subject}"</strong></p>
                    
                    <div style="background: #f9fafb; border-left: 4px solid #16a34a; padding: 20px; border-radius: 4px; margin: 24px 0;">
                      <p style="margin: 0; white-space: pre-wrap; color: #1f2937; font-size: 15px; line-height: 1.6;">${adminReply}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${process.env.APP_URL || 'https://carhop.replit.app'}" style="background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Ver no Chat</a>
                    </div>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 20px;">
                      Obrigado por escolher CarHop. Se tiver mais dúvidas, sinta-se à vontade para responder diretamente no chat em nossa plataforma.
                    </p>
                  </div>
                  <div style="background: #f9fafb; padding: 16px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Esta é uma mensagem automática do CarHop. Por favor, não responda a este e-mail.</p>
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
}
