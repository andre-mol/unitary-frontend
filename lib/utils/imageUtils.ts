
/**
 * Resize and compress image file client-side
 * Max dimension: 1600px
 * Quality: 0.8 (for JPEG)
 */
export async function compressImage(file: File): Promise<File> {
    // Only process images
    if (!file.type.startsWith('image/')) {
        return file;
    }

    // If simple gif, return as is (canvas ruins animations)
    if (file.type === 'image/gif') {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(img.src);

            const MAX_DIM = 1600;
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                }
            } else {
                if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
            }

            // Draw to canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not supported'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Export
            // Use original type if supported, else JPEG
            const exportType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const quality = 0.8;

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create new file with original name (but potentially new ext if converted, though we try to keep)
                        const newFile = new File([blob], file.name, {
                            type: exportType,
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                },
                exportType,
                quality
            );
        };

        img.onerror = (error) => {
            URL.revokeObjectURL(img.src);
            reject(error);
        };
    });
}
