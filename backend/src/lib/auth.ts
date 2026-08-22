import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "@better-auth/core/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { emailOTP, oneTap } from "better-auth/plugins";
import { env } from "@/config/env";
import { sendOtpEmail } from "@/externalService/resend";
import { adminAuthPlugin } from "@/lib/adminAuthPlugin";

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
    // 1.7.1 has a real transaction-lifecycle bug (confirmed against a real
    // single-node replica set in CI): it throws "Cannot call abortTransaction
    // after calling commitTransaction" from inside handleOAuthUserInfo. This
    // issue's account-creation flows have no multi-document atomicity
    // requirement that needs it, so it stays off rather than working around
    // a third-party bug.
    transaction: false,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
  // Enabled only so admin.ts's credential accounts hash/verify consistently
  // through Better Auth's own password utilities — the built-in
  // /sign-up/email self-registration endpoint this would otherwise expose
  // is explicitly disabled: buyers never have a password (FR-AUTH-004) and
  // admin accounts are provisioned server-side only (FR-AUTH-024), never by
  // public self-signup.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    // FR-AUTH-016's 30-day rolling ceiling — Better Auth's own default is
    // 7 days. httpOnly/sameSite=lax are already the defaults; `secure` is
    // already production-conditional by default and deliberately left
    // alone here (forcing it on would break local dev over plain http).
    expiresIn: 60 * 60 * 24 * 30,
  },
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
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
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
    adminAuthPlugin(),
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
