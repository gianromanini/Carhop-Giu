/**
 * Tests for check-in photo handling.
 *
 * Integration tests spin up a real Express HTTP server (mirroring production
 * middleware: 50 MB body-parser, JSON serialisation, route handler) backed by
 * MemStorage so no external DB is needed.  The tests confirm that:
 *
 *   1. GET /api/bookings/:id returns large base64 photos byte-for-byte intact.
 *   2. PUT /api/bookings/:id persists large photos in checkInData, and they
 *      survive a subsequent GET exactly as submitted.
 *
 * Unit tests verify that stripBookingImages does NOT touch gas/miles fields
 * while it replaces long image strings with "[IMAGE]".
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { stripBookingImages } from "../server/bookingUtils.js";
import { MemStorage } from "../server/storage.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Generates a base64-encoded data-URI of approximately `sizeKB` kilobytes. */
function makeLargeBase64(sizeKB: number): string {
  const bytes = Buffer.alloc(sizeKB * 1024, 0xaa);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

/** Minimal booking payload accepted by MemStorage.createBooking. */
function makeBookingPayload(overrides: Record<string, unknown> = {}): any {
  return {
    date: "2026-08-06",
    status: "Active",
    carName: "Test Car",
    location: "Test Location",
    startDate: "2026-08-06",
    startTime: "10:00",
    returnDate: "2026-08-08",
    returnTime: "10:00",
    days: 2,
    total: 100,
    driver: {
      name: "Test Driver",
      phone: "555-0000",
      email: "test@example.com",
      licenseNumber: "DL-00000",
      licenseImages: [],
    },
    details: {
      rate: 50,
      extras: 0,
      protection: 0,
      fees: 0,
      tax: 0,
    },
    paymentRaw: { type: "paypal", stripePaymentIntentId: "PAYPAL-TEST" },
    paymentMethod: "paypal",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test HTTP server factory
//
// Mirrors the production setup in server/index.ts and the relevant route
// handlers from server/routes.ts, but without Stripe / OAuth dependencies.
// This validates the full HTTP request → JSON parse → route handler → JSON
// serialise → response cycle.
// ---------------------------------------------------------------------------

function createTestServer(storage: InstanceType<typeof MemStorage>): http.Server {
  const app = express();

  // Same body size limit as production (server/index.ts line ~39)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  // GET /api/bookings/:id — returns full booking (no image stripping)
  // Mirrors server/routes.ts:1216-1221
  app.get("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  // PUT /api/bookings/:id — update booking fields including checkInData
  // Mirrors the relevant subset of server/routes.ts:1262-1323 (Stripe/email
  // verification is intentionally excluded; those paths are already covered by
  // the production route tests).
  app.put("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const booking = await storage.updateBooking(id, req.body);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  return http.createServer(app);
}

/** Start the server on an OS-assigned port; returns the base URL. */
async function startServer(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("Bad address"));
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

/** Stop the server and wait for all connections to close. */
async function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// HTTP integration tests
// ---------------------------------------------------------------------------

describe("HTTP integration — GET /api/bookings/:id returns large photos intact", () => {
  let server: http.Server;
  let baseUrl: string;
  let storage: InstanceType<typeof MemStorage>;

  before(async () => {
    storage = new MemStorage();
    server = createTestServer(storage);
    baseUrl = await startServer(server);
  });

  after(async () => {
    await stopServer(server);
  });

  test("GET /api/bookings/:id returns a >100 KB checkInData photo byte-for-byte", async () => {
    const largePhoto = makeLargeBase64(150); // ~150 KB base64 string
    assert.ok(largePhoto.length > 100 * 1024, "Precondition: photo must be >100 KB");

    // Seed booking directly in storage (bypasses payment routes)
    const created = await storage.createBooking(
      makeBookingPayload({
        checkInData: {
          miles: "12345",
          gas: "3/4",
          photosOutside: [largePhoto],
          photosInside: [],
        },
      }),
    );

    // Fetch via the real HTTP endpoint
    const response = await fetch(`${baseUrl}/api/bookings/${created.id}`);
    assert.equal(response.status, 200, "Expected 200 OK");

    const body = await response.json() as any;
    assert.ok(body.checkInData, "checkInData should be present in response");

    const returnedPhoto = body.checkInData.photosOutside[0];
    assert.equal(
      returnedPhoto.length,
      largePhoto.length,
      "Returned photo length must match original",
    );
    assert.equal(
      returnedPhoto,
      largePhoto,
      "GET /api/bookings/:id must return the photo byte-for-byte — no truncation or placeholder",
    );
  });

  test("GET /api/bookings/:id returns multiple large photos in checkInData and checkOutData", async () => {
    const outside = makeLargeBase64(120);
    const inside = makeLargeBase64(200);

    const created = await storage.createBooking(
      makeBookingPayload({
        checkInData: {
          miles: "99999",
          gas: "1/2",
          photosOutside: [outside],
          photosInside: [inside],
        },
      }),
    );

    const response = await fetch(`${baseUrl}/api/bookings/${created.id}`);
    const body = await response.json() as any;

    assert.equal(body.checkInData.photosOutside[0], outside, "photosOutside[0] must be intact");
    assert.equal(body.checkInData.photosInside[0], inside, "photosInside[0] must be intact");
  });

  test("PUT /api/bookings/:id persists large checkInData photos; GET returns them intact", async () => {
    const largePhoto = makeLargeBase64(180);

    // Create booking without photos
    const created = await storage.createBooking(makeBookingPayload());

    // Update via HTTP PUT (mirrors the production check-in flow)
    const putResponse = await fetch(`${baseUrl}/api/bookings/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkInStatus: "completed",
        checkInData: {
          miles: "55000",
          gas: "Full",
          photosOutside: [largePhoto],
          photosInside: [],
        },
      }),
    });
    assert.equal(putResponse.status, 200, "PUT should return 200");

    // Retrieve via GET and verify photo survived the round trip
    const getResponse = await fetch(`${baseUrl}/api/bookings/${created.id}`);
    const body = await getResponse.json() as any;

    assert.equal(body.checkInData.photosOutside[0], largePhoto, "Photo must survive PUT → GET round trip");
    assert.equal(body.checkInData.miles, "55000", "miles must be preserved through PUT");
    assert.equal(body.checkInData.gas, "Full", "gas must be preserved through PUT");
  });

  test("Response body size is sufficient for a >100 KB photo (body-parser limit is honoured)", async () => {
    // Send a very large JSON body (200 KB photo) to confirm the 50 MB limit
    // is not exceeded and the server accepts and reflects the payload.
    const largePhoto = makeLargeBase64(200);
    const created = await storage.createBooking(makeBookingPayload());

    const putResponse = await fetch(`${baseUrl}/api/bookings/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkInData: {
          miles: "0",
          gas: "Empty",
          photosOutside: [largePhoto],
          photosInside: [],
        },
      }),
    });

    assert.equal(
      putResponse.status,
      200,
      "Server must accept a >200 KB JSON body without a 413 error",
    );
    const body = await putResponse.json() as any;
    assert.equal(body.checkInData.photosOutside[0].length, largePhoto.length);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — stripBookingImages must NOT alter gas / miles fields
// ---------------------------------------------------------------------------

describe("stripBookingImages — gas and miles fields are preserved", () => {
  test("miles and gas in checkInData are not modified", () => {
    const booking = {
      id: 1,
      checkInData: {
        miles: "12345",
        gas: "3/4",
        photosOutside: ["x".repeat(2000)], // long string → should become [IMAGE]
        photosInside: [],
      },
    };

    const result = stripBookingImages(booking);

    assert.equal(result.checkInData.miles, "12345", "miles must not be changed");
    assert.equal(result.checkInData.gas, "3/4", "gas must not be changed");
    assert.equal(
      result.checkInData.photosOutside[0],
      "[IMAGE]",
      "long photo should be replaced with [IMAGE]",
    );
  });

  test("miles and gas in checkOutData are not modified", () => {
    const booking = {
      id: 2,
      checkOutData: {
        miles: "55000",
        gas: "Full",
        photosOutside: [],
        photosInside: ["y".repeat(1500)],
      },
    };

    const result = stripBookingImages(booking);

    assert.equal(result.checkOutData.miles, "55000", "checkOutData miles must not change");
    assert.equal(result.checkOutData.gas, "Full", "checkOutData gas must not change");
    assert.equal(
      result.checkOutData.photosInside[0],
      "[IMAGE]",
      "long inside photo should be replaced with [IMAGE]",
    );
  });

  test("miles and gas in hostCheckInData and hostCheckOutData are not modified", () => {
    const booking = {
      id: 3,
      hostCheckInData: { miles: "11111", gas: "1/4", photosOutside: [], photosInside: [] },
      hostCheckOutData: { miles: "22222", gas: "1/2", photosOutside: [], photosInside: [] },
    };

    const result = stripBookingImages(booking);

    assert.equal(result.hostCheckInData.miles, "11111");
    assert.equal(result.hostCheckInData.gas, "1/4");
    assert.equal(result.hostCheckOutData.miles, "22222");
    assert.equal(result.hostCheckOutData.gas, "1/2");
  });

  test("short strings in photo arrays are NOT replaced", () => {
    // Only strings longer than 1000 chars are replaced
    const booking = {
      id: 4,
      checkInData: {
        miles: "0",
        gas: "Empty",
        photosOutside: ["short-url"],
        photosInside: [],
      },
    };

    const result = stripBookingImages(booking);

    assert.equal(
      result.checkInData.photosOutside[0],
      "short-url",
      "short strings must be preserved as-is",
    );
  });

  test("booking without checkInData is returned unchanged", () => {
    const booking = { id: 5, image: null };
    const result = stripBookingImages(booking);
    assert.equal(result.checkInData, undefined);
    assert.equal(result.image, null);
  });
});
