import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { ApiError, handler, readJson, type RouteParams } from "@/lib/server/http";
import { getOrCreateVisitorId } from "@/lib/server/visitor";
import { enquiryData, loadChatDto, toEnquiryDto } from "@/lib/server/chats";
import { confirmationText, loadOwnEnquiry, newReference } from "@/lib/server/enquiries";
import { missingForSubmission } from "@/lib/seller/flow";

export const dynamic = "force-dynamic";

// Idempotent submission: the Draft -> Submitted transition happens at most once.
// Repeated clicks or retries return the existing reference instead of creating duplicates.
export const POST = handler(async (request: Request, { params }: RouteParams) => {
  const visitorId = await getOrCreateVisitorId();
  const { id } = await params;
  const body = await readJson<{ confirmAccurate?: unknown; consentContact?: unknown }>(request);

  const respond = async (alreadySubmitted: boolean) => {
    const enquiry = await loadOwnEnquiry(visitorId, id);
    if (!enquiry.reference) throw new ApiError(409, "This enquiry changed while submitting. Please reload and try again.");
    return NextResponse.json({
      alreadySubmitted,
      enquiry: toEnquiryDto(enquiry),
      chat: enquiry.chatId ? await loadChatDto(visitorId, enquiry.chatId) : null,
      message: confirmationText(enquiry.reference),
    });
  };

  const enquiry = await loadOwnEnquiry(visitorId, id);
  if (enquiry.status === "Submitted") return respond(true);

  if (body.confirmAccurate !== true || body.consentContact !== true) {
    throw new ApiError(400, "Please confirm that the information is accurate and that KJ Cars may contact you about this enquiry.");
  }
  if (enquiry.step !== "summary") throw new ApiError(409, "Please answer the remaining questions before submitting.");
  const missing = missingForSubmission(enquiryData(enquiry));
  if (missing.length) throw new ApiError(422, `Please complete these fields before submitting: ${missing.join(", ")}.`);

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newReference();
    const now = new Date();
    try {
      const transitioned = await prisma.$transaction(async (tx) => {
        // The row lock taken by this UPDATE serialises concurrent submits; only one sees status Draft.
        const result = await tx.vehicleEnquiry.updateMany({
          where: { id, visitorId, status: "Draft", step: "summary" },
          data: { status: "Submitted", step: "submitted", reference, submittedAt: now, consentAt: now },
        });
        if (result.count === 1 && enquiry.chatId) {
          await tx.message.create({ data: { chatId: enquiry.chatId, role: "assistant", content: confirmationText(reference) } });
          await tx.chatSession.update({ where: { id: enquiry.chatId }, data: { updatedAt: now } });
        }
        return result.count === 1;
      });
      return respond(!transitioned);
    } catch (error) {
      // Extremely unlikely reference collision: retry with a new reference.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new ApiError(500, "We couldn't create a reference for your enquiry. Please try again.");
});
