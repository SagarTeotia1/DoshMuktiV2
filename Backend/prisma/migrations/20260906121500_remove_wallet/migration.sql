-- Remove the wallet feature entirely: redemption at checkout, admin manual grant/deduct,
-- and the underlying ledger. Superseded cashback-earning removal (see the prior
-- 20260906120000_remove_cashback migration) already left this with no way to earn credit;
-- this finishes the removal.

-- DropForeignKey (WalletTransaction has no FK to Order, only a loose orderId string —
-- nothing to drop there. Order.walletRedeemed is a plain column.)
ALTER TABLE "Order" DROP COLUMN "walletRedeemed";

DROP TABLE "WalletTransaction";

DROP TYPE "WalletTransactionReason";
