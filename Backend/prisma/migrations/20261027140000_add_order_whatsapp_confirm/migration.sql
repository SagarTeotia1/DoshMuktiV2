-- Idempotency marker for the WhatsApp order-confirmation message.
ALTER TABLE "Order" ADD COLUMN "whatsappConfirmSentAt" TIMESTAMP(3);
