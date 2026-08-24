import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "@better-auth/core/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { bearer, emailOTP, oneTap, twoFactor } from "better-auth/plugins";
import { env } from "@/config/env";
import { sendOtpEmail, sendPasswordResetEmail } from "@/externalService/mailer";
import { recordResetToken, consumeResetToken } from "@/lib/passwordResetTokens";
import { consumeEmailLimit, nativeIpRateLimitStorage, type EmailLimitGroup } from "@/lib/rateLimit";
import { revokeSessionsForUser } from "@/utils/sessions";

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
  // revokeSessionsForUser matches both a plain string and an ObjectId-typed
  // userId — this same file's own databaseHooks.session.create.after
  // already had to convert a session's userId to ObjectId to query `users`
  // by `_id`, evidence this codebase's Mongo documents aren't consistently
  // one type or the other; querying `session`'s own userId field with only
  // a plain string matched nothing in real CI, so this covers whichever the
  // adapter actually uses. Extracted to src/utils/sessions.ts on its second
  // use (Issue #142's own deactivation path).
  await revokeSessionsForUser(userId);
});

// Issue #145/M3.7, FR-AUTH-040/042/043's "per email" dimension — Better
// Auth's own native rate limiter (the `rateLimit` option below) resolves
// the real client IP and applies rules atomically before any handler runs,
// but it has no per-email dimension at all. This is the second, independent
// layer, applied here where ctx.body.email is already reliably available
// (proven by every hook above) — runs first in the hooks.before chain below
// so a rate-limited request never reaches the credential-check hooks.
// `/two-factor/send-otp`/`/two-factor/verify-otp` (the rest of FR-AUTH-040's
// "admin sign-in/OTP-verify" named limit and all of FR-AUTH-041's OTP-resend
// limit) carry no email in their request body at all (just `{}`/`{code}` —
// the pending 2FA challenge is resolved from a signed cookie inside their
// own endpoint handlers, not exposed to this global pre-request hook) — IP-
// only coverage via the native system is the documented, accepted scope for
// those two paths, same treatment this codebase gives other infra-shaped
// gaps.
const EMAIL_RATE_LIMIT_GROUPS: Record<string, EmailLimitGroup> = {
  "/sign-in/email": "admin-signin",
  "/request-password-reset": "admin-forgot-password",
  "/email-otp/send-verification-otp": "buyer-otp-request",
};

const enforceEmailRateLimits = createAuthMiddleware(async (ctx) => {
  const group = EMAIL_RATE_LIMIT_GROUPS[ctx.path];
  if (!group) return;
  const email = (ctx.body as { email?: string } | undefined)?.email;
  if (!email) return;
  const { allowed, retryAfter } = await consumeEmailLimit(group, email);
  if (!allowed) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: "RATE_LIMITED",
      message: retryAfter
        ? `Too many attempts. Try again in ${retryAfter} seconds.`
        : "Too many attempts. Please try again later.",
    });
  }
});

// FR-AUTH-045's ACCOUNT_DEACTIVATED code had no enforcement anywhere in this
// codebase before this issue — deactivating an admin (adminUsers.service.ts,
// `status: false`) only revokes *existing* sessions (src/utils/sessions.ts),
// it never blocked a fresh sign-in/OTP-request attempt from that account.
// Covers the admin password step and both buyer OTP steps with one lookup,
// reusing the same raw-driver pattern findExistingNonBuyer/
// rejectBuyerOnPasswordSignIn above already use in this file.
const ACCOUNT_DEACTIVATED_ERROR = {
  code: "ACCOUNT_DEACTIVATED",
  message: "This account has been deactivated.",
};

const enforceAccountNotDeactivated = createAuthMiddleware(async (ctx) => {
  if (
    ctx.path !== "/sign-in/email" &&
    ctx.path !== "/sign-in/email-otp" &&
    ctx.path !== "/email-otp/send-verification-otp"
  ) {
    return;
  }
  const email = (ctx.body as { email?: string } | undefined)?.email;
  if (!email) return;
  const existing = await mongoose.connection
    .db!.collection<{ email: string; status?: boolean }>("users")
    .findOne({ email });
  if (existing && existing.status === false) {
    throw new APIError("FORBIDDEN", ACCOUNT_DEACTIVATED_ERROR);
  }
});

// Issue #148/M3.10 — admin-app (Vercel) is cross-domain from backend
// (Render), exactly like buyer-app is. The *established* session already
// survives that via the bearer plugin below, but the admin two-step
// password->OTP challenge has an intermediate step with no bearer-token
// equivalent: the `twoFactor` plugin's own pending-challenge cookie, which
// carries "which sign-in does this OTP belong to" between /sign-in/email
// and /two-factor/verify-otp. That cookie inherits `sameSite: "lax"` from
// Better Auth's own cookie defaults (confirmed by reading the installed
// package's createCookieGetter, cookies/index.mjs) — a Lax cookie is not
// sent on a cross-site fetch, so this step would silently fail
// (INVALID_TWO_FACTOR_COOKIE) in any real deployment despite passing both
// Supertest (its agent resends cookies unconditionally, no SameSite
// enforcement) and local dev (localhost:5173->localhost:4000 is same-site
// by spec — port doesn't affect "site"). Gated on BETTER_AUTH_URL being
// https, mirroring the same package's own useSecureCookies protocol-sniff,
// so this is a no-op in dev/test (BETTER_AUTH_URL is http there) and only
// engages against a real deployment — SameSite=None requires Secure, which
// requires HTTPS to actually be stored by a browser at all.
const isCrossSiteDeployment = env.BETTER_AUTH_URL.startsWith("https://");

export const auth = betterAuth({
  advanced: isCrossSiteDeployment
    ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
    : undefined,
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
  // Issue #145/M3.7 (FR-AUTH-040–044) — Better Auth's own native
  // per-request rate limiter, not a hand-rolled Express-level one: it
  // already resolves the real client IP (advanced.ipAddress, honoring
  // x-forwarded-for) and applies rules atomically before any route handler
  // runs (confirmed by reading the installed package's own
  // api/rate-limiter/index.mjs — `/sign-in*`/`/two-factor/*` already carry
  // built-in default/plugin rules; this only supplies the Redis-backed
  // storage plus this issue's own literal-path window/max overrides). Keys
  // are exact literal paths, not wildcards, so nearby paths this issue
  // doesn't name (e.g. `/sign-in/social`, `/sign-in/email-otp`) keep
  // whatever built-in default/plugin rule Better Auth already applies to
  // them, untouched. `enabled: true` unconditionally, not gated on
  // production — credential-stuffing exposure starts the moment these
  // endpoints exist, per this issue's own framing.
  rateLimit: {
    enabled: true,
    customStorage: nativeIpRateLimitStorage,
    customRules: {
      "/sign-in/email": { window: 900, max: 5 }, // FR-AUTH-040
      "/two-factor/verify-otp": { window: 900, max: 5 }, // FR-AUTH-040
      "/two-factor/send-otp": { window: 600, max: 3 }, // FR-AUTH-041
      "/request-password-reset": { window: 3600, max: 3 }, // FR-AUTH-042
      "/email-otp/send-verification-otp": { window: 600, max: 5 }, // FR-AUTH-043
      "/callback/google": { window: 3600, max: 20 }, // FR-AUTH-044
      "/one-tap/callback": { window: 3600, max: 20 }, // FR-AUTH-044
    },
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
      // Issue #242/M3.14 — fixed to a known default value in every
      // environment, including production, so manual sign-in testing never
      // needs real inbox access. Deliberate, explicit security tradeoff: a
      // fixed OTP is a known, guessable constant, not a real secret — only
      // acceptable at this pre-launch stage, not a posture to carry into a
      // real production launch (see docs/srs/features/0.3-authentication.md's
      // amendment note and this file's own security caveat). `storeOTP:
      // "hashed"` above still hashes this fixed value deterministically, so
      // the stored/verified code and the emailed code stay identical either
      // way — no NODE_ENV gate, this plugin has no clean way to distinguish
      // "trusted internal testing" from a real request.
      generateOTP: () => "123456",
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
      // Each of the three below is independently wrapped in its own
      // createAuthMiddleware(...) purely for ctx-type convenience — none is
      // ever registered as its own Better Auth hook, only called manually
      // here. That wrapping makes each expect a slightly narrower context
      // type than this outer hook's own ctx under exactOptionalPropertyTypes
      // (request?: Request vs. request: Request | undefined) — a type-only
      // mismatch, not a real behavioral difference, so a direct cast to each
      // function's own declared parameter type resolves it.
      //
      // enforceEmailRateLimits/enforceAccountNotDeactivated run first, ahead
      // of the three pre-existing credential-check hooks below, so a
      // rate-limited or deactivated-account request never reaches them.
      await enforceEmailRateLimits(ctx as Parameters<typeof enforceEmailRateLimits>[0]);
      await enforceAccountNotDeactivated(
        ctx as Parameters<typeof enforceAccountNotDeactivated>[0],
      );
      await rejectAdminEmailOnReturningOtpSignIn(
        ctx as Parameters<typeof rejectAdminEmailOnReturningOtpSignIn>[0],
      );
      await rejectBuyerOnPasswordSignIn(ctx as Parameters<typeof rejectBuyerOnPasswordSignIn>[0]);
      await revokeSessionsAfterPasswordReset(
        ctx as Parameters<typeof revokeSessionsAfterPasswordReset>[0],
      );
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
    // Issue #242/M3.14 — same fixed-OTP goal as emailOTP's generateOTP
    // above, but the twoFactor plugin's otpOptions has no equivalent
    // override anywhere in its public API (confirmed by reading the
    // installed better-auth@1.7.1 source: OTPOptions is only
    // period/digits/sendOTP/allowedAttempts/storeOTP, and its OTP
    // generation — generateRandomString(opts.digits, "0-9") — is hardcoded
    // with no injection point). This hook is the closest documented,
    // supported alternative: the two-factor OTP is persisted to this same
    // core `verification` collection under identifier `2fa-otp-${key}`,
    // value format `${hashedCode}:0` (storeOTP defaults to "plain" here,
    // i.e. unhashed, since twoFactor's own otpOptions below sets no
    // storeOTP override) — so forcing `value` on write forces what
    // verification compares against.
    //
    // Deliberate, documented asymmetry: this makes admin 2FA verification
    // always accept "123456", but the code actually emailed by
    // otpOptions.sendOTP below is still the real, random
    // generateRandomString() output — sendOTP only ever receives the
    // already-generated code to deliver it, with no way to intercept or
    // rewrite it before send. The emailed code is therefore decorative and
    // safe to ignore: submitting "123456" always verifies regardless of
    // what the email actually shows. This still satisfies the issue's
    // actual goal ("no need to read the inbox during manual testing")
    // using only a documented Better Auth hook — no monkey-patching the
    // library's internals. Same explicit, pre-launch-only security
    // tradeoff as emailOTP's generateOTP override above.
    verification: {
      create: {
        before: async (verification) => {
          if (typeof verification.identifier === "string" && verification.identifier.startsWith("2fa-otp-")) {
            return { data: { value: "123456:0" } };
          }
        },
      },
    },
  },
});
