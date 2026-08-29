declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options?: { type?: string; theme?: string; size?: string }) => void;
          prompt: (onSuccess?: () => void, onError?: () => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface CredentialResponse {
  credential: string;
  select_by?: string;
}

export {};
