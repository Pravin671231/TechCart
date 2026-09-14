"use client";

import { useGetProfileQuery } from "./api";
import { ProfileForm } from "./ProfileForm";

// feature/buyer-app-account-sidebar-shell — extracted from AccountContent.tsx,
// now its own sidebar destination (/account/profile). AccountShell already
// guarantees an authenticated session before this renders, so no `skip`.
export function ProfileContent() {
  const { data: profile } = useGetProfileQuery();

  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-neutral-900">Edit profile</h3>
          <p className="mb-4 text-sm text-neutral-600">Update your name and phone number</p>
          <div className="flex justify-center">
            {profile ? (
              <ProfileForm profile={profile} />
            ) : (
              <p className="text-sm text-neutral-500">Loading...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
