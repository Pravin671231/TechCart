"use client";

import { useState } from "react";
import { useUpdateProfileMutation } from "./api";
import type { AccountProfile } from "./types";
import type { NormalizedApiError } from "@/store/api";

export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      await updateProfile({ name, phone }).unwrap();
      setSaved(true);
    } catch (err) {
      const apiError = err as NormalizedApiError;
      setError(apiError?.message || "Failed to update profile. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="field-input mt-1 w-full px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input mt-1 w-full px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="field-input mt-1 w-full px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Profile updated.</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-gradient-primary py-2 font-medium text-white transition hover:brightness-95 hover:shadow-md disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
