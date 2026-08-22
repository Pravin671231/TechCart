import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "@better-auth/core/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { bearer, emailOTP, oneTap } from "better-auth/plugins";
import { env } from "@/config/env";
import { sendOtpEmail } from "@/externalService/resend";

const ADMIN_EMAIL_ON_BUYER_ROUTE_ERROR = {
  code: "GOOGLE_ACCOUNT_IS_ADMIN",
  message: "This email belongs to an admin account. Sign in from the admin console instead.",
};

// Raw driver query, not a Mongoose model — this file sits alongside the DB
// layer itself and shouldn't create a circular import with a future `users`
// Mongoose model.
async function findExistingNonBuyer(email: string): Promise<boolean> {
  const existing = await mongoose.connection
    .db!.collection<{ email: string; role?: string }>("users")
    .findOne({ email });
  return existing != null && existing.role !== "buyer";
}

async function rejectIfNonBuyerEmail(
  email: string | undefined,
): Promise<{ error: string; errorDescription: string } | void> {
  if (!email) return;
  if (await findExistingNonBuyer(email)) {
    return {
      error: ADMIN_EMAIL_ON_BUYER_ROUTE_ERROR.code,
      errorDescription: ADMIN_EMAIL_ON_BUYER_ROUTE_ERROR.message,
    };
  }
}

// `validateUserInfo` re-validates on every OAuth/One Tap sign-in (fresh
// provider identity each time) and on first creation/linking for email-OTP,
// but per Better Auth's own docs a *returning* email-OTP sign-in for an
// already-existing account is not re-validated through this hook (it's a
// "non-provider returning sign-in"). That's the one gap: an admin's email,
// once it exists as a user record, could otherwise sign in a second time via
// the buyer email-OTP route unchecked. The `hooks.before` matcher below
// closes exactly that gap — it does not need to cover the OAuth/One Tap
// paths, which `validateUserInfo` already re-checks unconditionally.
const rejectAdminEmailOnReturningOtpSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email-otp" && ctx.path !== "/email-otp/send-verification-otp") {
    return;
  }
  const email = (ctx.body as { email?: string } | undefined)?.email;
  if (!email) return;
  if (await findExistingNonBuyer(email)) {
    throw new APIError("FORBIDDEN", ADMIN_EMAIL_ON_BUYER_ROUTE_ERROR);
  }
});

export const auth = betterAuth({
  database: mongodbAdapter(mongoose.connection.db!, {
    client: mongoose.connection.getClient(),
    // Passing `client` defaults this to true, but @better-auth/mongo-adapter
    // 1.7.1 has a real, still-open upstream transaction-lifecycle bug
    // (https://github.com/better-auth/better-auth/issues/10925): it throws
    // "Cannot call abortTransaction after calling commitTransaction" from
    // inside handleOAuthUserInfo. This issue's account-creation flows have
    // no multi-document atomicity requirement that needs it, so it stays
    // off rather than working around a third-party bug.
    transaction: false,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // CORS_ORIGINS entries may include a `*` wildcard segment (see
  // src/utils/originMatch.ts / cors.ts) — Better Auth's trustedOrigins
  // matcher accepts wildcard strings natively, so the same env-driven list
  // cors.ts uses is reused here verbatim as the single source of truth.
  trustedOrigins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
  user: {
    modelName: "users",
    additionalFields: {
      role: { type: "string", defaultValue: "buyer", input: false },
      status: { type: "boolean", defaultValue: true, input: false },
      phone: { type: "string", required: false },
      lastSignInAt: { type: "date", required: false, input: false },
    },
    validateUserInfo: async ({ user }) => rejectIfNonBuyerEmail(user.email),
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE.CLIENT_ID,
      clientSecret: env.GOOGLE.CLIENT_SECRET,
    },
  },
  plugins: [
    emailOTP({
      expiresIn: 600,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in") {
          await sendOtpEmail(email, otp, "sign-in");
        }
      },
    }),
    oneTap(),
    // buyer-app (Vercel) and backend (Render) are separate domains with no
    // shared parent domain — a cross-site fetch won't reliably carry a
    // cookie session (Safari ITP blocks third-party cookies outright even
    // at sameSite=none), which is what broke buyer sign-in on deployed
    // previews the first time this feature shipped (Issue #139, reverted
    // in #208). `bearer` is additive alongside the existing cookie session,
    // not a replacement: it returns the session token via a `set-auth-token`
    // response header on sign-in, which a client sends back as
    // `Authorization: Bearer <token>` — see betterAuthHandler.ts for the
    // header-forwarding fix this depends on, and cors.ts for the matching
    // `exposedHeaders` config.
    bearer(),
  ],
  hooks: {
    before: rejectAdminEmailOnReturningOtpSignIn,
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await mongoose.connection
            .db!.collection("users")
            .updateOne(
              { _id: new mongoose.Types.ObjectId(session.userId) },
              { $set: { lastSignInAt: new Date() } },
            );
        },
      },
    },
  },
});
