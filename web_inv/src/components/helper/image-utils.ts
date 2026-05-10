const DEFAULT_MAX_IMAGE_DIMENSION = 512;

export async function resizeImage(file: File, maxDimension: number = DEFAULT_MAX_IMAGE_DIMENSION): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            const scale = Math.min(
                1,
                maxDimension / image.width,
                maxDimension / image.height,
            );

            const targetWidth = Math.max(1, Math.round(image.width * scale));
            const targetHeight = Math.max(1, Math.round(image.height * scale));

            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const context = canvas.getContext("2d");
            if (!context) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Could not process image."));
                return;
            }

            context.drawImage(image, 0, 0, targetWidth, targetHeight);
            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob) {
                        reject(new Error("Could not encode image."));
                        return;
                    }
                    resolve(blob);
                },
                "image/jpeg",
                0.82,
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Invalid image file."));
        };

        image.src = objectUrl;
    });
}
