import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import signInBackground from "@/features/assets/admin-login-bg.jpg";
import { useGetSessionQuery } from "./api";
import { clearChallenge } from "./challengeStorage";
import { PasswordSignIn } from "./PasswordSignIn";
import { OtpVerify } from "./OtpVerify";

type Step = { name: "password" } | { name: "otp"; email: string };

export const SignInContent = () => {
  const navigate = useNavigate();
  const { data: session } = useGetSessionQuery();
  const [step, setStep] = useState<Step>({ name: "password" });

  useEffect(() => {
    if (session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 bg-cover bg-center p-6"
      style={{ backgroundImage: `url(${signInBackground})` }}
    >
      {/* Scrim between the background illustration and the card, for
       * contrast regardless of where the artwork's linework falls. */}
      <div className="absolute inset-0 -z-10 bg-black/35" />

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-neutral-900">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            TechCart Admin
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {step.name === "password" ? "Sign in to continue" : "Two-factor verification"}
          </p>
        </div>
        <div key={step.name} className="signin-step-enter mt-6">
          {step.name === "password" ? (
            <PasswordSignIn onOtpRequired={(email) => setStep({ name: "otp", email })} />
          ) : (
            <OtpVerify
              email={step.email}
              onVerified={() => navigate("/", { replace: true })}
              onStartOver={() => {
                clearChallenge();
                setStep({ name: "password" });
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
};
