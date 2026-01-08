import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);

    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In Next.js 15, params is a Promise
    const resolvedParams = await params;
    const chatId = resolvedParams.id;
    if (!chatId) {
      return NextResponse.json({ error: "Missing chat id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || (body.title === undefined && body.messages === undefined)) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const { title, messages } = body as {
      title?: string;
      messages?: { role: string; content: string }[];
    };

    // Verify ownership
    const existingChat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
      select: { id: true },
    });

    if (!existingChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update title if provided
      if (typeof title === "string") {
        await tx.chat.update({
          where: { id: chatId },
          data: { title },
        });
      }

      // Replace messages if provided
      if (Array.isArray(messages)) {
        await tx.message.deleteMany({
          where: { chatId },
        });

        if (messages.length > 0) {
          await tx.message.createMany({
            data: messages.map((m, index) => ({
              chatId,
              role: m.role,
              content: m.content,
              order: index,
            })),
          });
        }
      }
      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      // Return updated chat with messages
      return tx.chat.findUnique({
        where: { id: chatId },
        include: {
          messages: { orderBy: { order: "asc" } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);

    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In Next.js 15, params is a Promise
    const resolvedParams = await params;
    const chatId = resolvedParams.id;
    if (!chatId) {
      return NextResponse.json({ error: "Missing chat id" }, { status: 400 });
    }

    // Verify ownership
    const existingChat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
      select: { id: true },
    });

    if (!existingChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Delete messages then chat (safe even if no cascade)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.message.deleteMany({ where: { chatId } });
      await tx.chat.delete({ where: { id: chatId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}


