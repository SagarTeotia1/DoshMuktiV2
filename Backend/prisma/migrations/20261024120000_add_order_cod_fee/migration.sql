-- COD handling charge (Rs50 on COD orders that get free delivery). Part of `total`;
-- 0 on prepaid orders and on every order placed before this column existed.
ALTER TABLE "Order" ADD COLUMN "codFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
