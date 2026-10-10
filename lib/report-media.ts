/** Browser-side JPEG conversion with an HTML image fallback for mobile browsers. */
export async function prepareEvidence(file: File): Promise<string> {
  if (file.size > 10000000) throw new Error("Choose a photo under 10 MB.");
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    throw new Error("Choose a JPEG, PNG, or WebP photo. Convert HEIC photos to JPEG first.");
  const url = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("This photo could not be decoded. Try a JPEG or PNG."));
      image.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.startsWith("data:image/jpeg;base64,") && encoded.length < 1300000) return encoded;
    }
    throw new Error("This photo is too large after compression. Choose a smaller photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
