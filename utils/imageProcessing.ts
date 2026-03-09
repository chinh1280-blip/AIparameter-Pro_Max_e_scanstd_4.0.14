import { ImageProcessingProfile } from '../types';

export const processImage = async (file: File, profile: ImageProcessingProfile): Promise<{ display: string, processed: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = profile.resizeMaxWidth || 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // 1. Draw resized image (Base for both Display and Processed)
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get Display Image (Resized only, no effects)
        const displayBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // 2. Apply Processing based on Profile
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // A. Grayscale
          if (profile.enableGrayscale) {
             for (let i = 0; i < width * height; i++) {
               const gray = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
               data[i * 4] = gray;
               data[i * 4 + 1] = gray;
               data[i * 4 + 2] = gray;
             }
          }

          // B. Adaptive Threshold (Integral Image)
          if (profile.enableAdaptiveThreshold) {
             // We need a separate grayscale buffer for calculation if not already grayscale
             // But if we enabled grayscale above, data is already gray.
             // If not, we calculate gray on the fly or make a buffer.
             // Let's make a buffer to be safe and clean.
             const grayBuffer = new Float32Array(width * height);
             for (let i = 0; i < width * height; i++) {
               grayBuffer[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
             }

             const BLOCK = profile.adaptiveBlockSize || 31;
             const C = profile.adaptiveC || 8;
             const half = Math.floor(BLOCK / 2);

             const integral = new Float64Array((width + 1) * (height + 1));
             for (let y = 0; y < height; y++) {
               for (let x = 0; x < width; x++) {
                 integral[(y + 1) * (width + 1) + (x + 1)] =
                   grayBuffer[y * width + x] +
                   integral[y * (width + 1) + (x + 1)] +
                   integral[(y + 1) * (width + 1) + x] -
                   integral[y * (width + 1) + x];
               }
             }

             for (let y = 0; y < height; y++) {
               for (let x = 0; x < width; x++) {
                 const x1 = Math.max(0, x - half);
                 const y1 = Math.max(0, y - half);
                 const x2 = Math.min(width - 1, x + half);
                 const y2 = Math.min(height - 1, y + half);
                 const count = (x2 - x1 + 1) * (y2 - y1 + 1);

                 const sum =
                   integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
                   integral[y1 * (width + 1) + (x2 + 1)] -
                   integral[(y2 + 1) * (width + 1) + x1] +
                   integral[y1 * (width + 1) + x1];

                 const mean = sum / count;
                 const bin = grayBuffer[y * width + x] > mean - C ? 255 : 0;

                 const idx = (y * width + x) * 4;
                 data[idx] = bin;
                 data[idx + 1] = bin;
                 data[idx + 2] = bin;
               }
             }
          } else {
             // C. Contrast & Brightness (Only if Adaptive is OFF)
             const contrast = profile.contrast || 0;
             const brightness = profile.brightness || 0;
             
             const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

             for (let i = 0; i < data.length; i += 4) {
               // Apply Contrast
               let r = factor * (data[i] - 128) + 128;
               let g = factor * (data[i + 1] - 128) + 128;
               let b = factor * (data[i + 2] - 128) + 128;

               // Apply Brightness
               r += brightness;
               g += brightness;
               b += brightness;

               // Clamp
               data[i] = Math.min(255, Math.max(0, r));
               data[i + 1] = Math.min(255, Math.max(0, g));
               data[i + 2] = Math.min(255, Math.max(0, b));
             }
          }

          ctx.putImageData(imageData, 0, 0);
        } catch (err) {
          console.warn('Image processing failed, using resized original:', err);
        }

        // Get Processed Image
        const quality = (profile.jpegQuality || 80) / 100;
        const processedBase64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        
        resolve({ display: displayBase64, processed: processedBase64 });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

