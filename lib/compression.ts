
/**
 * Compresses and resizes an image file in the browser.
 * @param file The original File object
 * @param maxWidth The maximum width in pixels (default 1600)
 * @param quality The JPEG quality 0-1 (default 0.8)
 */
export const compressImage = async (file: File, maxWidth = 1600, quality = 0.8): Promise<File> => {
    // Skip if not an image
    if (!file.type.match(/image.*/)) return file;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                let width = image.width;
                let height = image.height;

                // Scale down if necessary
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if(!ctx) { 
                    console.warn("Canvas context missing, skipping compression");
                    resolve(file); 
                    return; 
                }
                
                // Draw image to canvas
                ctx.drawImage(image, 0, 0, width, height);
                
                // Export as JPEG
                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file); // Fallback to original
                        return;
                    }
                    // Create new File from Blob, forcing .jpg extension
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], newName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    
                    console.log(`[Compression] Original: ${(file.size/1024).toFixed(0)}KB, New: ${(compressedFile.size/1024).toFixed(0)}KB`);
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            image.onerror = () => resolve(file); // Fallback
            image.src = readerEvent.target?.result as string;
        };
        reader.onerror = () => resolve(file); // Fallback
        reader.readAsDataURL(file);
    });
};
