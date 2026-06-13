import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("INR"),
  splitType: z.enum(["EQUAL", "UNEQUAL", "PERCENTAGE", "SHARES"]),
  paidById: z.string().uuid("Invalid payer ID"),
  date: z.string().optional(),
  participants: z.array(
    z.object({
      userId: z.string().uuid("Invalid user ID"),
      shareAmount: z.number().min(0),
      sharePercentage: z.number().nullable().optional(),
      shareUnits: z.number().nullable().optional(),
    })
  ).min(1, "At least one participant is required"),
});

export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { groupId } = await params;
    
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } }
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { groupId } = await params;
    
    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } }
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = expenseSchema.parse(body);

    // Validate total amount matches the sum of shares
    const totalShares = parsed.participants.reduce((sum, p) => sum + p.shareAmount, 0);
    // Allow small floating point difference (e.g. 0.05) to avoid rounding issues
    if (Math.abs(totalShares - parsed.amount) > 0.05) {
      return NextResponse.json({ error: "Participant shares do not sum up to the total amount" }, { status: 400 });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          groupId,
          createdById: session.userId as string,
          paidById: parsed.paidById,
          description: parsed.description,
          amount: parsed.amount,
          currency: parsed.currency,
          splitType: parsed.splitType,
          date: parsed.date ? new Date(parsed.date) : new Date(),
          participants: {
            create: parsed.participants.map(p => ({
              userId: p.userId,
              shareAmount: p.shareAmount,
              sharePercentage: p.sharePercentage,
              shareUnits: p.shareUnits,
            }))
          }
        },
        include: {
          paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          participants: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        }
      });
      return newExpense;
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
