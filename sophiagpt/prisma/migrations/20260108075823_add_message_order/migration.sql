/*
  Warnings:

  - Added the required column `order` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "order" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Message_chatId_order_idx" ON "Message"("chatId", "order");
