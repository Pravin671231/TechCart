import { useState, type FormEvent } from "react";
import { useAppDispatch } from "@/app/store/hooks";
import { setAdminKey } from "@/app/store/authSlice";

export const AdminKeyPrompt = () => {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    dispatch(setAdminKey(trimmed));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Admin key required</h1>
      <p className="text-neutral-500">
        Enter the admin key to continue. This is a temporary measure ahead of real authentication.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
        <label htmlFor="admin-key" className="sr-only">
          Admin key
        </label>
        <input
          id="admin-key"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Admin key"
          autoComplete="off"
          className="rounded border border-neutral-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-primary-600 px-4 py-2 text-white">
          Continue
        </button>
      </form>
    </main>
  );
};
