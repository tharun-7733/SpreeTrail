import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This is a public route to preview a group's basic details (name, description, member count)
// It does NOT expose member details, expenses, or balances.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: { members: true }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error("Failed to preview group:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
