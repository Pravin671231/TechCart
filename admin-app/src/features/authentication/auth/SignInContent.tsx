import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useGetSessionQuery } from "./api";
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">TechCart Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {step.name === "password" ? "Sign in to continue" : "Two-factor verification"}
        </p>
      </div>
      {step.name === "password" ? (
        <PasswordSignIn onOtpRequired={(email) => setStep({ name: "otp", email })} />
      ) : (
        <OtpVerify
          email={step.email}
          onVerified={() => navigate("/", { replace: true })}
          onStartOver={() => setStep({ name: "password" })}
        />
      )}
    </main>
  );
};
