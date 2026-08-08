import type { FastifyRequest, FastifyReply } from "fastify";
import {
  createCouponSchema,
  updateCouponSchema,
  idParamSchema,
  listCouponsQuerySchema,
  previewCouponSchema,
} from "./schema";
import {
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  findValidatedCoupon,
  resolveCouponRewardsForCheckout,
  resolveLineItemsForPreview,
  CouponCodeTakenError,
  CouponNotFoundError,
  CouponInactiveError,
  CouponExpiredError,
  CouponUsageLimitReachedError,
  CouponMinOrderNotMetError,
  CouponBirthdayNotEligibleError,
  CouponExhaustedError,
  CouponPreviewItemsInvalidError,
  InvalidCouponValueError,
} from "./service";

// Shared by checkout/controller.ts too — the ONE place a coupon-validation error class
// maps to a stable `code` string + HTTP status, so preview and checkout never drift
// into different messages/codes for the same failure.
export function mapCouponValidationError(
  err: unknown,
): { code: string; message: string; status: number } | null {
  if (err instanceof CouponNotFoundError) {
    return {
      code: "COUPON_NOT_FOUND",
      message: "Coupon code not found",
      status: 400,
    };
  }
  if (err instanceof CouponInactiveError) {
    return {
      code: "COUPON_INACTIVE",
      message: "This coupon is no longer active",
      status: 400,
    };
  }
  if (err instanceof CouponExpiredError) {
    return {
      code: "COUPON_EXPIRED",
      message: "This coupon has expired",
      status: 400,
    };
  }
  if (err instanceof CouponUsageLimitReachedError) {
    return {
      code: "COUPON_USAGE_LIMIT",
      message: "This coupon has reached its usage limit",
      status: 400,
    };
  }
  if (err instanceof CouponMinOrderNotMetError) {
    return {
      code: "COUPON_MIN_ORDER",
      message: `Minimum order of ₹${err.minOrder} required for this coupon`,
      status: 400,
    };
  }
  if (err instanceof CouponBirthdayNotEligibleError) {
    return {
      code: "COUPON_BIRTHDAY_INELIGIBLE",
      message: "This coupon is only valid on the customer's birthday",
      status: 400,
    };
  }
  if (err instanceof CouponExhaustedError) {
    return {
      code: "COUPON_EXHAUSTED",
      message: "This coupon just reached its usage limit",
      status: 409,
    };
  }
  return null;
}

function handleAdminServiceError(err: unknown, reply: FastifyReply) {
  if (err instanceof CouponNotFoundError)
    return reply.code(404).send({ error: err.message });
  if (err instanceof CouponCodeTakenError) {
    return reply
      .code(409)
      .send({
        error: `Coupon code already exists: ${err.code}`,
        code: "COUPON_CODE_TAKEN",
      });
  }
  if (err instanceof InvalidCouponValueError) {
    return reply
      .code(400)
      .send({ error: err.message, code: "INVALID_COUPON_VALUE" });
  }
  throw err;
}

export async function listCouponsHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = listCouponsQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return reply
      .code(400)
      .send({
        error: "Invalid query",
        details: parsed.error.flatten().fieldErrors,
      });

  return reply.send(await listCoupons(parsed.data));
}

export async function getCouponHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: "Invalid id" });

  const coupon = await getCouponById(params.data.id);
  if (!coupon)
    return reply
      .code(404)
      .send({ error: `Coupon not found: ${params.data.id}` });
  return reply.send(coupon);
}

export async function createCouponHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      });

  try {
    const coupon = await createCoupon(parsed.data);
    return reply.code(201).send(coupon);
  } catch (err) {
    return handleAdminServiceError(err, reply);
  }
}

export async function updateCouponHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: "Invalid id" });

  const parsed = updateCouponSchema.safeParse(req.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      });

  try {
    const coupon = await updateCoupon(params.data.id, parsed.data);
    return reply.send(coupon);
  } catch (err) {
    return handleAdminServiceError(err, reply);
  }
}

// Public, unauthenticated — the storefront calls this interactively as the customer
// types a coupon code. Always 200: a not-yet-valid code (expired, wrong minOrder, not
// found, ...) is a normal preview outcome, not a request error. `valid:false` responses
// carry a stable `code` the Frontend switches on for messaging — see mapCouponValidationError.
export async function previewCouponHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = previewCouponSchema.safeParse(req.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      });

  try {
    const { lineItems, subtotal } = await resolveLineItemsForPreview(
      parsed.data.items,
    );
    const coupon = await findValidatedCoupon({
      code: parsed.data.code,
      subtotal,
    });
    const { discountAmount } = await resolveCouponRewardsForCheckout(
      lineItems,
      coupon.id,
    );
    return reply.code(200).send({ valid: true, discountAmount });
  } catch (err) {
    const mapped = mapCouponValidationError(err);
    if (mapped)
      return reply
        .code(200)
        .send({ valid: false, error: mapped.message, code: mapped.code });
    if (err instanceof CouponPreviewItemsInvalidError) {
      return reply
        .code(200)
        .send({
          valid: false,
          error: "One or more items are invalid or unavailable",
          code: "INVALID_ITEMS",
        });
    }
    throw err;
  }
}
