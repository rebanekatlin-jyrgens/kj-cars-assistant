import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** An error whose message is safe to show to the visitor. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = "item") =>
  new ApiError(404, `We couldn't find that ${what}. It may have been deleted, or it belongs to another visitor.`);

const DB_UNAVAILABLE =
  "We can't reach the database right now. Your saved progress is safe - please try again in a moment.";

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P1xxx: connection / server errors; P2024: connection pool timeout.
    return error.code.startsWith("P1") || error.code === "P2024";
  }
  return false;
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
  }
  if (isDatabaseUnavailable(error)) {
    console.error("Database unavailable:", (error as Error).name);
    return NextResponse.json({ error: DB_UNAVAILABLE }, { status: 503 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: notFound().message }, { status: 404 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "This was already saved. Please reload the page to see the latest version." }, { status: 409 });
  }
  // Log server-side only; never send stack traces or internals to the browser.
  console.error("Unhandled API error:", error instanceof Error ? `${error.name}: ${error.message}` : error);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

/** Wrap a route handler so every error becomes a safe, readable JSON response. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    throw new ApiError(400, "The request was not valid. Please reload the page and try again.");
  }
}

export type RouteParams<K extends string = "id"> = { params: Promise<Record<K, string>> };
