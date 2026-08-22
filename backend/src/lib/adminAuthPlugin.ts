import crypto from "node:crypto";
import { z } from "zod";
import { APIError } from "better-auth";
import { createAuthEndpoint } from "@better-auth/core/api";
import { setSessionCookie } from "better-auth/cookies";
import { AdminSignInChallengeModel } from "@/lib/adminSignInChallenge.model";
import { sendOtpEmail } from "@/externalService/resend";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MS / 1000;

const INVALID_CREDENTIALS_ERROR = {
  code: "INVALID_CREDENTIALS",
  message: "Incorrect email or password.",
};

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// A self-contained challenge, not a reuse of the emailOTP plugin's own
// verification storage: that plugin is shaped for buyer sign-in/creation
// and its `/sign-in/email-otp` endpoint is already guarded (auth.ts) against
// admin emails, so admin OTP needs its own path and its own record — one
// document per password-step attempt, whose _id doubles as the opaque
// "challenge" value returned to the client.
export function adminAuthPlugin() {
  return {
    id: "admin-auth",
    endpoints: {
      adminSignIn: createAuthEndpoint(
        "/admin/sign-in",
        {
          method: "POST",
          body: z.object({
            email: z.string(),
            password: z.string(),
          }),
        },
        async (ctx) => {
          const { email, password } = ctx.body;

          const userRecord = await ctx.context.internalAdapter.findUserByEmail(email.toLowerCase());
          const credentialAccount = userRecord
            ? await ctx.context.internalAdapter.findCredentialAccount(userRecord.user.id)
            : null;
          // `additionalFields` (role/status, auth.ts) aren't part of the
          // generic plugin-facing User type, but are present at runtime.
          const userFields = userRecord?.user as
            ({ role?: string; status?: boolean } & Record<string, unknown>) | undefined;

          // Uniform failure path — unknown email, no password credential
          // (buyers never have one), wrong password, and a deactivated
          // account all collapse into the same generic rejection with a
          // dummy hash on the reject-early branches, mirroring Better
          // Auth's own signInEmail timing-safety pattern.
          if (
            !userRecord ||
            !credentialAccount?.password ||
            userFields?.role === "buyer" ||
            userFields?.status === false
          ) {
            await ctx.context.password.hash(password);
            throw new APIError("UNAUTHORIZED", INVALID_CREDENTIALS_ERROR);
          }

          const validPassword = await ctx.context.password.verify({
            hash: credentialAccount.password,
            password,
          });
          if (!validPassword) {
            throw new APIError("UNAUTHORIZED", INVALID_CREDENTIALS_ERROR);
          }

          const otp = generateOtp();
          const otpHash = await ctx.context.password.hash(otp);
          const challenge = await AdminSignInChallengeModel.create({
            userId: userRecord.user.id,
            otpHash,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
          });

          await sendOtpEmail(userRecord.user.email, otp, "sign-in");

          return ctx.json({
            challenge: challenge._id.toString(),
            expiresInSeconds: OTP_EXPIRY_SECONDS,
            code: "OTP_REQUIRED",
          });
        },
      ),
      adminVerifyOtp: createAuthEndpoint(
        "/admin/verify-otp",
        {
          method: "POST",
          body: z.object({
            challenge: z.string(),
            otp: z.string(),
          }),
        },
        async (ctx) => {
          const { challenge: challengeId, otp } = ctx.body;

          const challenge = await AdminSignInChallengeModel.findById(challengeId);
          if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
            throw new APIError("BAD_REQUEST", {
              code: "OTP_EXPIRED",
              message: "This code has expired. Sign in again to request a new one.",
            });
          }

          const validOtp = await ctx.context.password.verify({
            hash: challenge.otpHash,
            password: otp,
          });
          if (!validOtp) {
            throw new APIError("BAD_REQUEST", {
              code: "OTP_INVALID",
              message: "Incorrect code.",
            });
          }

          challenge.consumedAt = new Date();
          await challenge.save();

          const user = await ctx.context.internalAdapter.findUserById(challenge.userId.toString());
          if (!user) {
            throw new APIError("BAD_REQUEST", {
              code: "OTP_EXPIRED",
              message: "This code has expired. Sign in again to request a new one.",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });

          return ctx.json({ user, token: session.token });
        },
      ),
    },
  };
}
