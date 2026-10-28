import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, readJson, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { enquiryData, sellerTitle, toEnquiryDto } from "@/lib/server/chats";
import { assertDraft, loadOwnEnquiry } from "@/lib/server/enquiries";
import { FIELD_LABELS, isEditableField, validateFieldEdit } from "@/lib/seller/flow";

export const dynamic = "force-dynamic";

export const GET = handler(async (_request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  return NextResponse.json({ enquiry: toEnquiryDto(await loadOwnEnquiry(visitorId, id)) });
});

// Edits a single field from the summary. Uses the same server-side validation as the chat.
export const PATCH = handler(async (request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const body = await readJson<{ field?: unknown; value?: unknown }>(request);
  if (typeof body.field !== "string" || !isEditableField(body.field)) throw new ApiError(400, "That field can't be edited.");
  if (typeof body.value !== "string") throw new ApiError(400, "Please enter a value.");
  const field = body.field;

  const enquiry = await loadOwnEnquiry(visitorId, id);
  assertDraft(enquiry);
  const result = validateFieldEdit(enquiryData(enquiry), field, body.value);
  if (!result.ok) throw new ApiError(422, result.error, { field, label: FIELD_LABELS[field] });

  const updated = await prisma.vehicleEnquiry.updateMany({
    where: { id, visitorId, status: "Draft" },
    data: { [field]: result.value },
  });
  if (updated.count !== 1) throw new ApiError(409, "This enquiry has already been submitted and can no longer be changed.");

  if ((field === "make" || field === "model") && enquiry.chatId) {
    await prisma.chatSession.update({
      where: { id: enquiry.chatId },
      data: { title: sellerTitle({ ...enquiryData(enquiry), [field]: result.value as string }) },
    });
  }
  return NextResponse.json({ enquiry: toEnquiryDto(await loadOwnEnquiry(visitorId, id)) });
});
