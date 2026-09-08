-- Name is no longer collected at login/signup; it's backfilled from the first
-- checkout's delivery-details form instead, so it can be null until then.
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;
