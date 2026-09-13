"use client";

import { createClient } from "@/lib/supabase-browser";
import { reverseGeocode } from "@/lib/weather";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type CalendarStatus = {
  connected: boolean;
  healthy?: boolean;
  email?: string | null;
  problem?: string;
};

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [agentPermission, setAgentPermission] = useState("recommend");
  const [permissionSaved, setPermissionSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testState, setTestState] = useState<{ phase: "idle" | "sending" | "sent" | "failed"; link?: string; message?: string }>({ phase: "idle" });
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState("");
  const calendarJustConnected = searchParams.get("calendar_connected") === "1";
  const calendarError = searchParams.get("calendar_error");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, city, agent_permission")
        .eq("id", user.id)
        .single();
      setFullName(profile?.full_name || user.user_metadata?.full_name || "");
      setCity(profile?.city || "");
      setAgentPermission(profile?.agent_permission || "recommend");
    })();
  }, [supabase]);

  async function loadCalendarStatus() {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/calendar/status?verify=1");
      const data = (await res.json()) as CalendarStatus;
      setCalendarStatus(data);
    } catch {
      setCalendarStatus({ connected: false, problem: "Couldn't check the connection. Try again." });
    }
    setCalendarLoading(false);
  }

  useEffect(() => {
    loadCalendarStatus();
  }, []);

  async function disconnectCalendar() {
    setDisconnecting(true);
    try {
      await fetch("/api/calendar/disconnect", { method: "POST" });
      setCalendarStatus({ connected: false });
      setTestState({ phase: "idle" });
    } finally {
      setDisconnecting(false);
    }
  }

  // Proves the whole chain (token, permission level, Google's API, the right
  // calendar) with something the user can open and see.
  async function sendTestEvent() {
    setTestState({ phase: "sending" });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateISO = tomorrow.toISOString().slice(0, 10);
    try {
      const res = await fetch("/api/calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "NEXUS test event (safe to delete)",
          description: "NEXUS created this to confirm your Google Calendar connection works. Delete it whenever you like.",
          dateISO,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestState({ phase: "failed", message: data.error || "Couldn't create the test event." });
        if (data.disconnected) loadCalendarStatus();
        return;
      }
      setTestState({ phase: "sent", link: data.htmlLink || undefined });
    } catch {
      setTestState({ phase: "failed", message: "Couldn't reach NEXUS. Check your connection." });
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateMessage("This browser can't share your location. Type your city instead.");
      return;
    }
    setLocating(true);
    setLocateMessage("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (!place) {
            setLocateMessage("Found your position but not a city name for it. Type your city instead.");
          } else {
            setCity(place.city);
            setLocateMessage(`Set to ${place.label}. Save changes to keep it.`);
          }
        } catch {
          setLocateMessage("Couldn't turn your position into a city. Type it instead.");
        }
        setLocating(false);
      },
      (err) => {
        setLocateMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location access was blocked. Allow it in your browser, or type your city."
            : "Couldn't get your location. Type your city instead."
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  async function savePermission(level: string) {
    setAgentPermission(level);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ agent_permission: level }).eq("id", user.id);
    setPermissionSaved(true);
    setTimeout(() => setPermissionSaved(false), 1500);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await Promise.all([
      supabase.from("profiles").update({ full_name: fullName, city }).eq("id", user.id),
      supabase.auth.updateUser({ data: { full_name: fullName } }),
    ]);

    setNameSaving(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordMessage("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function exportData() {
    setExporting(true);
    setExportError("");

    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setExportError(data.error || "Export failed");
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete account");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      router.push("/signup");
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Settings</h1>
      <p className="text-sm text-[#64748B] mt-1">
        Profile, permissions, integrations and data.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">Profile</h2>
        <form onSubmit={saveName} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E6E8EE] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#64748B]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Email</label>
            <input
              value={email}
              disabled
              className="w-full px-3 py-2 border border-[#E6E8EE] rounded-xl text-sm bg-[#F6F7F9] text-[#64748B]/60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">City</label>
            <div className="flex gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. New Delhi"
                className="flex-1 px-3 py-2 border border-[#E6E8EE] rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#64748B]/50"
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="text-xs px-3 py-2 border border-[#E6E8EE] rounded-xl font-semibold text-[#1E293B]
                  hover:border-[#2563EB] transition-colors bg-white disabled:opacity-50 whitespace-nowrap"
              >
                {locating ? "Locating…" : "📍 Use my location"}
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]/70 mt-1">
              {locateMessage || "Used for the local weather on Home and when NEXUS suggests the best day to handle a renewal."}
            </p>
          </div>
          <button
            type="submit"
            disabled={nameSaving}
            className="text-sm px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-medium
              transition-colors cursor-pointer"
          >
            {nameSaving ? "Saving..." : nameSaved ? "Saved ✓" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">Security</h2>
        <form onSubmit={savePassword} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border border-[#E6E8EE] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#64748B]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[#E6E8EE] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#64748B]/50"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600 font-medium">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-emerald-600 font-medium">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSaving || !newPassword}
            className="text-sm px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-medium
              transition-colors cursor-pointer"
          >
            {passwordSaving ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">AI permissions</h2>
          {permissionSaved && <span className="text-xs font-semibold text-[#15803D]">Saved ✓</span>}
        </div>
        <p className="text-xs text-[#64748B] mt-1">
          How far NEXUS can go on your behalf. Each level unlocks the one above it, and NEXUS always
          shows you what it plans to do and waits for your approval before acting.
        </p>
        <div className="mt-4 space-y-2">
          {[
            { value: "read", label: "Read", desc: "Read and organize your documents. NEXUS won't suggest or create anything." },
            { value: "recommend", label: "Recommend", desc: "Also draft renewal plans and suggest what to handle next." },
            { value: "prepare", label: "Prepare", desc: "Also turn a plan you approve into tasks and reminders inside NEXUS." },
            { value: "execute", label: "Execute", desc: "Also write to connected services, like your Google Calendar, once you approve." },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                agentPermission === opt.value
                  ? "border-[#2563EB] bg-[#EAF2FF]"
                  : "border-[#E6E8EE] hover:border-[#2563EB]/40"
              }`}
            >
              <input
                type="radio"
                name="agent_permission"
                checked={agentPermission === opt.value}
                onChange={() => savePermission(opt.value)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">{opt.label}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">What NEXUS can access</h2>
        <p className="text-xs text-[#64748B] mt-1">
          Everything NEXUS stores about you, and what each part is used for.
        </p>
        <ul className="mt-4 space-y-3">
          {[
            {
              what: "Your uploaded files",
              why: "Stored in private storage only you can read. NEXUS reads a file once, when you upload it.",
            },
            {
              what: "Details extracted from them",
              why: "Names, numbers and dates from your documents. Used to answer questions and fill forms.",
            },
            {
              what: "A searchable index of each document",
              why: "Lets NEXUS find the right document for a question. Derived from your files; deleted with them.",
            },
            {
              what: "Your chat history",
              why: "So NEXUS remembers the conversation. Clear it any time from Ask NEXUS.",
            },
            {
              what: "Your activity log",
              why: "A record of everything NEXUS did and everything you approved, so nothing happens invisibly.",
            },
          ].map((item) => (
            <li key={item.what} className="flex gap-3">
              <span className="text-[#15803D] text-sm mt-0.5 shrink-0">✓</span>
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">{item.what}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{item.why}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#64748B]/80 mt-4 pt-4 border-t border-[#E6E8EE]/60">
          NEXUS never shares your documents with anyone. Deleting a document removes its extracted
          details and search index too.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">Your data</h2>
        <p className="text-xs text-[#64748B] mt-1">
          Download everything NEXUS holds about you as one JSON file.
        </p>
        {exportError && <p className="mt-3 text-sm text-red-600 font-medium">{exportError}</p>}
        <button
          onClick={exportData}
          disabled={exporting}
          className="mt-3 text-sm px-4 py-2 border border-[#E6E8EE] rounded-xl text-[#1E293B]
            hover:bg-[#F8FAFC] transition-colors bg-white font-semibold cursor-pointer disabled:opacity-50"
        >
          {exporting ? "Preparing your data..." : "Export my data"}
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">Google Calendar</h2>
        <p className="text-xs text-[#64748B] mt-1">
          Connect your calendar so NEXUS can check you&apos;re free before suggesting a day, and add
          renewal tasks directly to your calendar.
        </p>

        {calendarJustConnected && (
          <p className="mt-3 text-sm text-emerald-600 font-medium">Google Calendar connected ✓</p>
        )}
        {calendarError && (
          <p className="mt-3 text-sm text-red-600 font-medium">
            {calendarError === "denied"
              ? "You didn't grant calendar access, so nothing was connected. Try again and allow both calendar permissions."
              : calendarError === "state"
              ? "That connection attempt expired or didn't start from NEXUS. Start again from this page."
              : "Couldn't connect Google Calendar. Please try again."}
          </p>
        )}

        {calendarLoading ? (
          <p className="mt-3 text-xs text-[#64748B]/60 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
            Checking with Google…
          </p>
        ) : calendarStatus?.connected ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  calendarStatus.healthy
                    ? "bg-[#F0FDF4] text-[#15803D]"
                    : "bg-[#FFFBEB] text-[#D97706]"
                }`}
              >
                {calendarStatus.healthy ? "Connected and working" : "Connected, but not responding"}
              </span>
              {calendarStatus.email && (
                <span className="text-xs text-[#64748B]">
                  as <span className="font-semibold text-[#1E293B]">{calendarStatus.email}</span>
                </span>
              )}
            </div>

            {!calendarStatus.healthy && calendarStatus.problem && (
              <p className="text-xs text-[#D97706]">{calendarStatus.problem}</p>
            )}

            {calendarStatus.healthy && !calendarStatus.email && (
              <p className="text-xs text-[#64748B]">
                Reconnect once to show which account this is.
              </p>
            )}

            <div className="rounded-xl bg-[#F6F7F9] border border-[#E6E8EE] p-3.5">
              <p className="text-xs font-semibold text-[#1E293B]">Check it end-to-end</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                NEXUS adds an all-day event for tomorrow to this account&apos;s main calendar. If it shows
                up there, everything is working.{" "}
                {agentPermission !== "execute" && (
                  <span className="text-[#D97706]">Needs the &ldquo;Execute&rdquo; permission above.</span>
                )}
              </p>
              <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                <button
                  onClick={sendTestEvent}
                  disabled={testState.phase === "sending" || agentPermission !== "execute"}
                  className="text-xs px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-semibold
                    transition-colors disabled:opacity-40"
                >
                  {testState.phase === "sending" ? "Adding…" : "Add a test event"}
                </button>
                {testState.phase === "sent" && (
                  <span className="text-xs text-[#15803D] font-medium">
                    Added ✓{" "}
                    {testState.link && (
                      <a href={testState.link} target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline font-semibold">
                        Open it in Google Calendar →
                      </a>
                    )}
                  </span>
                )}
                {testState.phase === "failed" && (
                  <span className="text-xs text-red-600 font-medium">{testState.message}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={disconnectCalendar}
                disabled={disconnecting}
                className="text-sm px-4 py-2 border border-[#E6E8EE] rounded-xl text-[#1E293B]
                  hover:bg-[#F8FAFC] transition-colors bg-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
              <a
                href="/api/auth/google"
                className="text-sm px-4 py-2 text-[#64748B] hover:text-[#1E293B] transition-colors font-medium"
              >
                Reconnect
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {calendarStatus?.problem && (
              <p className="mb-2 text-xs text-[#D97706]">{calendarStatus.problem}</p>
            )}
            <a
              href="/api/auth/google"
              className="inline-block text-sm px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-medium
                transition-colors shadow-sm"
            >
              Connect Google Calendar
            </a>
            <p className="text-[11px] text-[#64748B]/70 mt-2">
              Google will ask for permission to see when you&apos;re busy and to add events. NEXUS never
              reads the contents of your existing events.
            </p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-[#E6E8EE] p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">Session</h2>
        <p className="text-xs text-[#64748B] mt-1">Sign out of NEXUS on this device.</p>
        <button
          onClick={handleLogout}
          className="mt-3 text-sm px-4 py-2 border border-[#E6E8EE] rounded-xl text-[#1E293B]
            hover:bg-[#F8FAFC] transition-colors bg-white font-semibold cursor-pointer"
        >
          Log out
        </button>
      </section>

      <section className="lg:col-span-2 bg-[#EAF2FF]/30 rounded-2xl border border-[#CFE0FF] p-6">
        <h2 className="text-base font-semibold text-[#2563EB]">Danger zone</h2>
        <p className="text-xs text-[#64748B] mt-1">
          Permanently delete your account and everything in it: documents, extracted data,
          reminders, chat history, and activity log. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 text-sm px-4 py-2 border border-[#CFE0FF] text-[#2563EB] rounded-xl
              hover:bg-[#EAF2FF] transition-colors bg-white font-semibold cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#64748B]">
              Type <span className="font-mono font-bold text-[#2563EB]">DELETE</span> to confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-[#CFE0FF] bg-white rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#1E293B]"
              placeholder="DELETE"
            />
            {deleteError && <p className="text-sm text-red-600 font-semibold">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="text-sm px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-medium
                  hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors cursor-pointer"
              >
                {deleting ? "Deleting..." : "Permanently delete everything"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(""); }}
                className="text-sm px-4 py-2 text-[#64748B] hover:text-[#1E293B] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
