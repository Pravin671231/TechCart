import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "@better-auth/core/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { bearer, emailOTP, oneTap, twoFactor } from "better-auth/plugins";
import { env } from "@/config/env";
import { sendOtpEmail, sendPasswordResetEmail } from "@/externalService/resend";
import { recordResetToken, consumeResetToken } from "@/lib/passwordResetTokens";

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

// FR-AUTH-009/010: unknown email and wrong password must be indistinguishable
// — Better Auth's own /sign-in/email already returns one generic
// INVALID_EMAIL_OR_PASSWORD for both cases by default, so no extra code is
// needed for that half. This hook is the other half, FR-AUTH-030's "admin
// sign-in is server-side enforced, not just a client-side route guard": public
// sign-up (below) IS enabled, so a buyer account can end up with a password
// credential of its own — this hook is what actually keeps that credential
// inert, refusing any role:"buyer" account at the password-sign-in step
// regardless of how its credential was created. Uses the identical generic
// error a wrong password gets, so a buyer's password credential can't be
// distinguished from a wrong password either.
const INVALID_CREDENTIALS_ERROR = {
  code: "INVALID_EMAIL_OR_PASSWORD",
  message: "Invalid email or password.",
};

const rejectBuyerOnPasswordSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email") return;
  const email = (ctx.body as { email?: string } | undefined)?.email;
  if (!email) return;
  const existing = await mongoose.connection
    .db!.collection<{ email: string; role?: string }>("users")
    .findOne({ email });
  if (existing && (existing.role ?? "buyer") === "buyer") {
    throw new APIError("UNAUTHORIZED", INVALID_CREDENTIALS_ERROR);
  }
});

// FR-AUTH-022: completing a password reset must invalidate every existing
// session for that admin. Built unconditionally rather than gated on
// whether Better Auth's own /reset-password already does this by default
// (unverified either way) — a harmless no-op deleteMany if it's already
// empty, required regardless since this is a hard functional requirement.
// Resolves the affected user via consumeResetToken (Issue #141's own
// tracking collection, recorded at send time in sendResetPassword below) —
// not by parsing Better Auth's internal `verification` record, whose exact
// shape for this flow is unverified.
//
// Runs in `hooks.before`, not `after`: an `after`-hook version (matching
// on ctx.path, reading ctx.body.token the same way this one does) was tried
// first and confirmed via real CI to never actually delete any session —
// ctx.body in an `after` hook apparently isn't the original request body
// the way it reliably is in `before` (proven repeatedly elsewhere in this
// file: rejectBuyerOnPasswordSignIn, rejectAdminEmailOnReturningOtpSignIn).
// Running this before the real handler means a token-valid-but-otherwise
// -rejected request (e.g. a weak new password, if Better Auth validates
// that after the token) would revoke sessions without the password having
// actually changed — a documented, accepted risk, not chased further since
// CI is the only ground truth available and the `after`-hook alternative
// measurably didn't work at all.
const revokeSessionsAfterPasswordReset = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/reset-password") return;
  const token = (ctx.body as { token?: string } | undefined)?.token;
  if (!token) return;
  const userId = await consumeResetToken(token);
  if (!userId) return;
  // Matches both a plain string and an ObjectId-typed userId — this same
  // file's own databaseHooks.session.create.after already had to convert a
  // session's userId to ObjectId to query `users` by `_id`, evidence this
  // codebase's Mongo documents aren't consistently one type or the other;
  // querying `session`'s own userId field with only a plain string matched
  // nothing in real CI, so this covers whichever the adapter actually uses.
  const userIdVariants: unknown[] = [userId];
  if (mongoose.isValidObjectId(userId)) {
    userIdVariants.push(new mongoose.Types.ObjectId(userId));
  }
  await mongoose.connection.db!.collection("session").deleteMany({ userId: { $in: userIdVariants } });
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
  // Admin-only credential type (Issue #140/M3.2, FR-AUTH-009). `disableSignUp`
  // was tried here first but rejected `auth.api.signUpEmail` too, not just
  // the public HTTP route — createAdminUser.ts's server-side call needs
  // sign-up enabled to create the seeded admin's password credential at all.
  // Left enabled instead: a self-registered password account still always
  // gets role "buyer" (additionalFields.role above is input:false, so a
  // client can't set anything else), and `rejectBuyerOnPasswordSignIn` below
  // already refuses any buyer-role account at the /sign-in/email step
  // regardless of how its credential was created — so a publicly
  // self-registered password credential is inert, never a route to a
  // session, admin or otherwise.
  emailAndPassword: {
    enabled: true,
    // Admin self-service password recovery (Issue #141/M3.3,
    // FR-AUTH-019–022). FR-AUTH-021's 1-hour expiry.
    resetPasswordTokenExpiresIn: 3600,
    // Called by Better Auth's own POST /request-password-reset handler (its
    // actual method/path — neither the SRS/issue's "/forgot-password" nor
    // the plausible-sounding "/forget-password" exist; confirmed via a real
    // CI 404 on both, then a diagnostic listing Object.keys(auth.api) found
    // the real method is `requestPasswordReset`) whenever the submitted
    // email resolves to a real user — but only actually sends an email (and
    // records the token below) for a non-buyer account. Buyers structurally
    // never have a reason to reset a password they don't use for sign-in
    // (rejectBuyerOnPasswordSignIn below), so this keeps their inbox free of
    // a pointless reset link; either way Better Auth's own response to the
    // caller is identical regardless of what this callback does, so
    // FR-AUTH-019's no-enumeration guarantee is unaffected by this branch.
    // Re-queries role via the raw driver (like
    // findExistingNonBuyer above) rather than trusting a `role` field on
    // this callback's own `user` param — additionalFields' presence there
    // isn't guaranteed by the installed package's types, and this repo
    // already has a proven-working raw-driver path for exactly this check.
    sendResetPassword: async ({ user, url, token }) => {
      const record = await mongoose.connection
        .db!.collection<{ email: string; role?: string }>("users")
        .findOne({ email: user.email });
      if ((record?.role ?? "buyer") === "buyer") return;
      await recordResetToken(token, user.id);
      await sendPasswordResetEmail(user.email, url);
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
    // `exposedHeaders` config. Registered once, globally — any session this
    // instance establishes (buyer OR admin, including the two-factor verify
    // step below) gets a bearer token automatically; admin-app is cross-domain
    // from backend too, so this plugin already covers Issue #140's own
    // FR-AUTH-015 cross-domain session requirement with no extra wiring.
    bearer(),
    // Admin's mandatory second factor (Issue #140/M3.2, FR-AUTH-011–014).
    // Requires emailAndPassword above. `twoFactorEnabled` is set directly on
    // the user document by createAdminUser.ts (raw driver, same convention as
    // `role`/`status`) rather than through the plugin's interactive
    // enable-then-verify flow — every admin account is provisioned with 2FA
    // already mandatory, there's no "opt in" step for a human admin to skip.
    // Config/endpoint shape (this otpOptions signature, POST /sign-in/email
    // returning no session pre-OTP, POST /two-factor/send-otp + verify-otp)
    // confirmed working end-to-end via __tests__/auth/admin-sign-in.api.test.ts
    // against a real CI run — see that file's own header comment for the one
    // surprise found along the way (the OTP verification record's identifier
    // shape).
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendOtpEmail(user.email, otp, "sign-in");
        },
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      await rejectAdminEmailOnReturningOtpSignIn(ctx);
      await rejectBuyerOnPasswordSignIn(ctx);
      await revokeSessionsAfterPasswordReset(ctx);
    }),
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
