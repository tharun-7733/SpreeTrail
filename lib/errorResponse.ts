import { NextResponse } from "next/server";

export interface ApiError {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

/**
 * Decision 36: Standardised error response shape
 * All API routes use these helpers for consistent contracts.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false as const,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

// Standard error codes
export const ERR = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION_ERROR",
  INVALID_SPLIT_AMOUNTS: "INVALID_SPLIT_AMOUNTS",
  INVALID_PERCENTAGE_SPLIT: "INVALID_PERCENTAGE_SPLIT",
  INACTIVE_MEMBER: "INACTIVE_MEMBER",
  MEMBERSHIP_DATE_CONFLICT: "MEMBERSHIP_DATE_CONFLICT",
  DUPLICATE_EXPENSE: "DUPLICATE_EXPENSE_DETECTED",
  IMPORT_SESSION_NOT_FOUND: "IMPORT_SESSION_NOT_FOUND",
  IMPORT_ROW_ALREADY_COMMITTED: "IMPORT_ROW_ALREADY_COMMITTED",
  INTERNAL: "INTERNAL_ERROR",
} as const;
