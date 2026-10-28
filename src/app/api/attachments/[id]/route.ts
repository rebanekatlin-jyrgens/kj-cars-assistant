import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { handler, notFound, type RouteParams } from "@/lib/server/http";
import { findVisitorId, getOrCreateVisitorId } from "@/lib/server/visitor";
import { assertDraft } from "@/lib/server/enquiries";

export const dynamic = "force-dynamic";

// Serves a photo only to the visitor who owns it.
export const GET = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await findVisitorId();
  const { id } = await params;
  if (!visitorId) throw notFound("photo");
  const attachment = await prisma.attachment.findFirst({ where: { id, visitorId } });
  if (!attachment) throw notFound("photo");
  return new Response(Buffer.from(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      // no-store: a shared device must not show photos from the browser cache after access changes.
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${attachment.filename.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
});

// Removes a photo from an unsubmitted enquiry.
export const DELETE = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, visitorId },
    select: { id: true, enquiry: { select: { status: true } } },
  });
  if (!attachment) throw notFound("photo");
  assertDraft(attachment.enquiry);
  await prisma.attachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
