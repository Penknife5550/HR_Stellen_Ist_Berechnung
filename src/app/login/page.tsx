/**
 * Login-Seite.
 *
 * Zentriertes Formular mit CREDO-Branding.
 * Bereits eingeloggte Benutzer werden zum Dashboard weitergeleitet.
 */

import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/permissions";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Anmelden | CREDO Verwaltung",
};

export default async function LoginPage() {
  // Bereits eingeloggt → Dashboard
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-[420px]">
        {/* CREDO Header */}
        <div className="text-center mb-8">
          {/* CREDO Farbstreifen */}
          <div className="flex justify-center mb-6">
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div className="w-10 bg-[#575756]" />
              <div className="w-3 bg-[#FBC900]" />
              <div className="w-3 bg-[#6BAA24]" />
              <div className="w-3 bg-[#E2001A]" />
              <div className="w-3 bg-[#009AC6]" />
            </div>
          </div>

          <div className="text-xs uppercase tracking-[3px] text-gray-400 mb-2">
            CREDO Verwaltung
          </div>
          <h1 className="text-2xl font-bold text-[#575756]">
            Stellenberechnung
          </h1>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">
            Anmelden
          </h2>

          <LoginForm />
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-400">
          Freie Evangelische Schulen &middot; lebensnah &middot; wegweisend &middot; christlich
        </div>
      </div>
    </div>
  );
}
