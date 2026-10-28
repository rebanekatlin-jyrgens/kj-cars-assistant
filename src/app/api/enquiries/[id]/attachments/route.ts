import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertDraft, loadOwnEnquiry } from "@/lib/server/enquiries";
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from "@/lib/seller/flow";

export const dynamic = "force-dynamic";

/** Detects the real image type from the file's first bytes (the browser's type is not trusted). */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function safeFilename(name: string, mimeType: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || `photo.${mimeType.split("/")[1]}`;
}

// Uploads one vehicle photo. Bytes are stored in PostgreSQL (see README: Photo storage).
export const POST = handler(async (request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 64 * 1024) throw new ApiError(413, "This photo is larger than 5 MB. Please choose a smaller image.");

  const enquiry = await loadOwnEnquiry(visitorId, id);
  assertDraft(enquiry);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "The upload could not be read. Please try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Please choose a photo to upload.");
  if (file.size === 0) throw new ApiError(400, "This file is empty.");
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError(413, `"${file.name.slice(0, 60)}" is larger than 5 MB. Please choose a smaller image.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(bytes);
  if (!mimeType) throw new ApiError(415, `"${file.name.slice(0, 60)}" is not a JPEG, PNG or WebP image.`);

  const attachment = await prisma.$transaction(async (tx) => {
    // Lock the enquiry row so parallel uploads can't exceed the photo limit.
    await tx.$queryRaw`SELECT id FROM "VehicleEnquiry" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.vehicleEnquiry.findUniqueOrThrow({
      where: { id },
      select: { status: true, _count: { select: { attachments: true } } },
    });
    assertDraft(current);
    if (current._count.attachments >= MAX_PHOTOS) {
      throw new ApiError(409, `You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`);
    }
    return tx.attachment.create({
      data: { enquiryId: id, visitorId, filename: safeFilename(file.name, mimeType), mimeType, size: bytes.length, data: bytes },
      select: { id: true, filename: true, mimeType: true, size: true },
    });
  });

  return NextResponse.json({ attachment: { ...attachment, url: `/api/attachments/${attachment.id}` } }, { status: 201 });
});
