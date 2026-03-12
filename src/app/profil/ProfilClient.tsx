"use client";

import { useActionState } from "react";
import { User, Lock, Check } from "lucide-react";
import { changePasswordAction } from "./actions";
import { getRolleLabel } from "@/lib/auth/roles";

interface Props {
  userName: string;
  userEmail: string;
  userRolle: string;
}

export function ProfilClient({ userName, userEmail, userRolle }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return changePasswordAction(formData);
    },
    null
  );

  const result = state as { success?: boolean; error?: string; message?: string } | null;

  return (
    <div className="ml-[280px] p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <User size={28} className="text-[#575756]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mein Profil</h1>
            <p className="text-sm text-gray-500 mt-1">
              Persoenliche Einstellungen und Passwort
            </p>
          </div>
        </div>

        {/* Profil-Infos (read-only) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Kontoinformationen</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#575756] text-white flex items-center justify-center text-lg font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-800">{userName}</div>
                <div className="text-sm text-gray-500">{userEmail}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Rolle: </span>
              <span className="text-sm font-medium text-gray-700">{getRolleLabel(userRolle)}</span>
            </div>
          </div>
        </div>

        {/* Passwort aendern */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={20} className="text-[#575756]" />
            <h2 className="text-lg font-semibold text-gray-800">Passwort aendern</h2>
          </div>

          {/* Erfolg */}
          {result?.success && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              <Check size={16} />
              {result.message}
            </div>
          )}

          {/* Fehler */}
          {result?.error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {result.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="aktuellesPasswort"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Aktuelles Passwort
              </label>
              <input
                id="aktuellesPasswort"
                name="aktuellesPasswort"
                type="password"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="neuesPasswort"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Neues Passwort
              </label>
              <input
                id="neuesPasswort"
                name="neuesPasswort"
                type="password"
                required
                minLength={8}
                placeholder="Mind. 8 Zeichen"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent
                  placeholder:text-gray-400"
              />
            </div>

            <div>
              <label
                htmlFor="neuesPasswortBestaetigung"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Neues Passwort bestaetigen
              </label>
              <input
                id="neuesPasswortBestaetigung"
                name="neuesPasswortBestaetigung"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                  hover:bg-[#474746] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Wird geaendert..." : "Passwort aendern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
