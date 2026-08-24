import { NextResponse } from "next/server";
import { listSprites, createUploadedSprite } from "@/lib/sprites";
import { DEFAULT_SPRITE_CELL_HEIGHT, DEFAULT_SPRITE_CELL_WIDTH } from "@/lib/config";
import { getSafeImageUpload, InvalidImageUploadError } from "@/lib/uploads";

export async function GET() {
  const sprites = await listSprites();
  return NextResponse.json({ sprites });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "A sprite sheet image is required." }, { status: 400 });
    }

    const upload = await getSafeImageUpload(image);
    const title = String(formData.get("title") || image.name).trim();
    const rawCellWidth = Number(formData.get("cellWidth") ?? DEFAULT_SPRITE_CELL_WIDTH);
    const rawCellHeight = Number(formData.get("cellHeight") ?? DEFAULT_SPRITE_CELL_HEIGHT);

    if (!Number.isInteger(rawCellWidth) || rawCellWidth < 1) {
      return NextResponse.json({ error: "Cell width must be a positive integer." }, { status: 400 });
    }

    if (!Number.isInteger(rawCellHeight) || rawCellHeight < 1) {
      return NextResponse.json({ error: "Cell height must be a positive integer." }, { status: 400 });
    }

    const sprite = await createUploadedSprite({
      title: title || "Uploaded sprite",
      fileName: `sprite${upload.extension}`,
      mimeType: upload.mimeType,
      content: upload.content,
      cellWidth: rawCellWidth,
      cellHeight: rawCellHeight,
    });

    return NextResponse.json({ sprite }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload sprite." },
      { status: error instanceof InvalidImageUploadError ? 400 : 500 },
    );
  }
}
