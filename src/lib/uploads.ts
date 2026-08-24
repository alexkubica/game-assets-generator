const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export class InvalidImageUploadError extends Error {}

function hasExpectedSignature(content: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      content.length >= 8 &&
      content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }

  return (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function getSafeImageUpload(file: File) {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new InvalidImageUploadError("Image uploads must be non-empty and 20 MB or smaller.");
  }

  const extension = IMAGE_EXTENSIONS.get(file.type);
  if (!extension) {
    throw new InvalidImageUploadError("Image uploads must be PNG, JPEG, or WebP.");
  }

  const content = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(content, file.type)) {
    throw new InvalidImageUploadError("The uploaded file does not match its declared image type.");
  }

  return {
    content,
    extension,
    mimeType: file.type,
  };
}
