"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserPlus, Pencil, KeyRound, Power, X } from "lucide-react";
import {
  createBenutzerAction,
  updateBenutzerAction,
  toggleBenutzerAktivAction,
  resetPasswordAction,
} from "./actions";
import { getRolleLabel, getRolleBadgeColor } from "@/lib/auth/roles";

interface Benutzer {
  id: number;
  email: string;
  name: string;
  rolle: string;
  aktiv: boolean;
  letzterLogin: Date | null;
  createdAt: Date;
}

interface Props {
  initialBenutzer: Benutzer[];
}

function formatDatum(date: Date | null): string {
  if (!date) return "Nie";
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ModalType = "create" | "edit" | "resetPassword" | null;

export function BenutzerVerwaltungClient({ initialBenutzer }: Props) {
  const router = useRouter();
  const [benutzerList, setBenutzerList] = useState(initialBenutzer);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedBenutzer, setSelectedBenutzer] = useState<Benutzer | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Action
  const [createState, createAction, isCreating] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createBenutzerAction(formData);
      if (result.success) {
        setModal(null);
        setMessage({ type: "success", text: result.message ?? "Benutzer angelegt." });
        // Seite neu laden fuer frische Daten
        router.refresh();
      }
      return result;
    },
    null
  );

  // Update Action
  const [updateState, updateAction, isUpdating] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await updateBenutzerAction(formData);
      if (result.success) {
        setModal(null);
        setSelectedBenutzer(null);
        setMessage({ type: "success", text: result.message ?? "Benutzer aktualisiert." });
        router.refresh();
      }
      return result;
    },
    null
  );

  // Reset Password Action
  const [resetState, resetAction, isResetting] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await resetPasswordAction(formData);
      if (result.success) {
        setModal(null);
        setSelectedBenutzer(null);
        setMessage({ type: "success", text: result.message ?? "Passwort zurueckgesetzt." });
      }
      return result;
    },
    null
  );

  const handleToggleAktiv = async (user: Benutzer) => {
    const formData = new FormData();
    formData.set("id", String(user.id));
    formData.set("aktiv", String(!user.aktiv));
    const result = await toggleBenutzerAktivAction(formData);
    if (result.success) {
      setBenutzerList((prev) =>
        prev.map((b) => (b.id === user.id ? { ...b, aktiv: !b.aktiv } : b))
      );
      setMessage({ type: "success", text: result.message ?? "Status geaendert." });
    } else {
      setMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  return (
    <div className="ml-[280px] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-[#575756]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Benutzerverwaltung</h1>
              <p className="text-sm text-gray-500 mt-1">
                Benutzer anlegen, bearbeiten und verwalten
              </p>
            </div>
          </div>
          <button
            onClick={() => { setModal("create"); setMessage(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#575756] text-white rounded-lg
              hover:bg-[#474746] transition-colors font-medium text-sm"
          >
            <UserPlus size={18} />
            Neuer Benutzer
          </button>
        </div>

        {/* Status-Meldung */}
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-4">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Benutzer-Tabelle */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  E-Mail
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rolle
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Letzter Login
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benutzerList.map((user) => (
                <tr
                  key={user.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    !user.aktiv ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#575756] text-white flex items-center justify-center text-sm font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getRolleBadgeColor(
                        user.rolle
                      )}`}
                    >
                      {getRolleLabel(user.rolle)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.aktiv
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDatum(user.letzterLogin)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedBenutzer(user);
                          setModal("edit");
                          setMessage(null);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBenutzer(user);
                          setModal("resetPassword");
                          setMessage(null);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Passwort zuruecksetzen"
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleAktiv(user)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.aktiv
                            ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={user.aktiv ? "Deaktivieren" : "Aktivieren"}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {benutzerList.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Keine Benutzer vorhanden.
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}

      {/* Neuer Benutzer */}
      {modal === "create" && (
        <Modal title="Neuer Benutzer" onClose={() => setModal(null)}>
          <form action={createAction} className="space-y-4">
            {(createState as { error?: string })?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {(createState as { error: string }).error}
              </div>
            )}
            <FormField label="Name" name="name" required autoFocus />
            <FormField label="E-Mail" name="email" type="email" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
              <select
                name="rolle"
                defaultValue="mitarbeiter"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              >
                <option value="admin">Administrator</option>
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="betrachter">Betrachter</option>
              </select>
            </div>
            <FormField
              label="Initiales Passwort"
              name="passwort"
              type="password"
              required
              minLength={8}
              placeholder="Mind. 8 Zeichen"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                  hover:bg-[#474746] disabled:opacity-50 transition-colors"
              >
                {isCreating ? "Wird angelegt..." : "Benutzer anlegen"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Benutzer bearbeiten */}
      {modal === "edit" && selectedBenutzer && (
        <Modal title="Benutzer bearbeiten" onClose={() => { setModal(null); setSelectedBenutzer(null); }}>
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="id" value={selectedBenutzer.id} />
            {(updateState as { error?: string })?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {(updateState as { error: string }).error}
              </div>
            )}
            <FormField label="Name" name="name" required defaultValue={selectedBenutzer.name} autoFocus />
            <FormField label="E-Mail" name="email" type="email" required defaultValue={selectedBenutzer.email} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
              <select
                name="rolle"
                defaultValue={selectedBenutzer.rolle}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              >
                <option value="admin">Administrator</option>
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="betrachter">Betrachter</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setModal(null); setSelectedBenutzer(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-4 py-2.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                  hover:bg-[#474746] disabled:opacity-50 transition-colors"
              >
                {isUpdating ? "Wird gespeichert..." : "Speichern"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Passwort zuruecksetzen */}
      {modal === "resetPassword" && selectedBenutzer && (
        <Modal title="Passwort zuruecksetzen" onClose={() => { setModal(null); setSelectedBenutzer(null); }}>
          <form action={resetAction} className="space-y-4">
            <input type="hidden" name="id" value={selectedBenutzer.id} />
            {(resetState as { error?: string })?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {(resetState as { error: string }).error}
              </div>
            )}
            <p className="text-sm text-gray-600">
              Neues Passwort fuer <strong>{selectedBenutzer.name}</strong> ({selectedBenutzer.email}) setzen:
            </p>
            <FormField
              label="Neues Passwort"
              name="neuesPasswort"
              type="password"
              required
              minLength={8}
              placeholder="Mind. 8 Zeichen"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setModal(null); setSelectedBenutzer(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isResetting}
                className="px-4 py-2.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                  hover:bg-[#474746] disabled:opacity-50 transition-colors"
              >
                {isResetting ? "Wird gesetzt..." : "Passwort setzen"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
  minLength,
  autoFocus = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  minLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        minLength={minLength}
        autoFocus={autoFocus}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent
          placeholder:text-gray-400"
      />
    </div>
  );
}
