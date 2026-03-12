"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await loginAction(formData);
      return result;
    },
    null
  );

  // Bei Erfolg: Weiterleitung zum Dashboard
  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <form action={formAction} className="space-y-6">
      {/* Fehlermeldung */}
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {/* E-Mail */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="name@fes-credo.de"
          className="w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg text-base
            focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent
            placeholder:text-gray-400"
        />
      </div>

      {/* Passwort */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Passwort eingeben"
          className="w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg text-base
            focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent
            placeholder:text-gray-400"
        />
      </div>

      {/* Login-Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[48px] bg-[#575756] text-white font-semibold rounded-lg
          hover:bg-[#474746] transition-colors text-base
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-[#575756] focus:ring-offset-2"
      >
        {isPending ? "Anmeldung..." : "Anmelden"}
      </button>
    </form>
  );
}
