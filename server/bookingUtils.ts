/**
 * Utility functions for booking data transformation.
 * Kept separate so they can be imported in tests without pulling in DB or auth dependencies.
 */

/**
 * Replaces long base64 image strings with "[IMAGE]" placeholders.
 * Used in list endpoints to reduce payload size.
 * Fields like `miles` and `gas` inside checkInData / checkOutData are NOT touched.
 */
export function stripBookingImages(booking: any): any {
  const optimized = { ...booking };

  if (optimized.image && typeof optimized.image === 'string' && optimized.image.length > 1000) {
    optimized.image = '[IMAGE]';
  }

  if (optimized.driver && typeof optimized.driver === 'object') {
    const driver = { ...optimized.driver };
    if (driver.licenseImages && Array.isArray(driver.licenseImages)) {
      driver.licenseImagesCount = driver.licenseImages.length;
      driver.licenseImages = driver.licenseImages.map((img: string) =>
        typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
      );
    }
    optimized.driver = driver;
  }

  for (const field of ['checkInData', 'checkOutData', 'hostCheckInData', 'hostCheckOutData']) {
    if (optimized[field] && typeof optimized[field] === 'object') {
      const data = { ...optimized[field] };
      if (data.photosOutside && Array.isArray(data.photosOutside)) {
        data.photosOutsideCount = data.photosOutside.length;
        data.photosOutside = data.photosOutside.map((img: string) =>
          typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
        );
      }
      if (data.photosInside && Array.isArray(data.photosInside)) {
        data.photosInsideCount = data.photosInside.length;
        data.photosInside = data.photosInside.map((img: string) =>
          typeof img === 'string' && img.length > 1000 ? '[IMAGE]' : img
        );
      }
      optimized[field] = data;
    }
  }

  return optimized;
}
