import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const userId = session.userId as string;

    // Check if the group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      // Return 200 instead of error if they are already in the group, so UI can just redirect them to the group page
      return NextResponse.json({ success: true, message: "Already a member" });
    }

    // Add user to the group as a regular MEMBER
    await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ success: true, message: "Successfully joined the group" });
  } catch (error) {
    console.error("Error joining group:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
