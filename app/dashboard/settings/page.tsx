"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const calendarJustConnected = searchParams.get("calendar_connected") === "1";
  const calendarError = searchParams.get("calendar_error") === "1";

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/calendar/status");
        const data = await res.json();
        setCalendarConnected(!!data.connected);
      } catch {
        setCalendarConnected(false);
      }
      setCalendarLoading(false);
    })();
  }, []);

  async function disconnectCalendar() {
    setDisconnecting(true);
    try {
      await fetch("/api/calendar/disconnect", { method: "POST" });
      setCalendarConnected(false);
    } finally {
      setDisconnecting(false);
    }
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
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Settings</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        Manage your profile, security, and data.
      </p>

      <section className="mt-6 bg-white rounded-2xl border border-[#E5DFD7] p-6">
        <h2 className="text-base font-serif font-semibold text-[#1A1412]">Profile</h2>
        <form onSubmit={saveName} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Email</label>
            <input
              value={email}
              disabled
              className="w-full px-3 py-2 border border-[#E5DFD7] rounded-xl text-sm bg-[#FCFAF7] text-[#7C6E67]/60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New Delhi"
              className="w-full px-3 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
            />
            <p className="text-[11px] text-[#7C6E67]/70 mt-1">
              Used to check local weather when NEXUS suggests the best day to handle a renewal.
            </p>
          </div>
          <button
            type="submit"
            disabled={nameSaving}
            className="text-sm px-4 py-2 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl font-medium
              transition-colors shadow-sm cursor-pointer"
          >
            {nameSaving ? "Saving..." : nameSaved ? "Saved ✓" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] p-6">
        <h2 className="text-base font-serif font-semibold text-[#1A1412]">Security</h2>
        <form onSubmit={savePassword} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600 font-medium">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-emerald-600 font-medium">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSaving || !newPassword}
            className="text-sm px-4 py-2 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl font-medium
              transition-colors shadow-sm cursor-pointer"
          >
            {passwordSaving ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif font-semibold text-[#1A1412]">Agent Permission</h2>
          {permissionSaved && <span className="text-xs font-semibold text-[#6E885B]">Saved ✓</span>}
        </div>
        <p className="text-xs text-[#7C6E67] mt-1">
          Controls how much NEXUS prepares on your behalf when you ask it to &ldquo;take care of my renewals.&rdquo;
          Whatever the level, NEXUS always shows you the plan and waits for your approval before creating anything.
        </p>
        <div className="mt-4 space-y-2">
          {[
            { value: "read", label: "Read", desc: "NEXUS can only read and organize your documents." },
            { value: "recommend", label: "Recommend", desc: "NEXUS can also suggest actions and renewal plans." },
            { value: "prepare", label: "Prepare", desc: "NEXUS drafts a full plan with tasks ready to approve." },
            { value: "execute", label: "Execute", desc: "Same as Prepare — NEXUS still asks before creating anything real-world actions require your approval either way." },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                agentPermission === opt.value
                  ? "border-[#D95D39] bg-[#FDF2EE]"
                  : "border-[#E5DFD7] hover:border-[#D95D39]/40"
              }`}
            >
              <input
                type="radio"
                name="agent_permission"
                checked={agentPermission === opt.value}
                onChange={() => savePermission(opt.value)}
                className="mt-0.5 accent-[#D95D39]"
              />
              <div>
                <p className="text-sm font-semibold text-[#2E2724]">{opt.label}</p>
                <p className="text-xs text-[#7C6E67] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] p-6">
        <h2 className="text-base font-serif font-semibold text-[#1A1412]">Google Calendar</h2>
        <p className="text-xs text-[#7C6E67] mt-1">
          Connect your calendar so NEXUS can check you&apos;re free before suggesting a day, and add
          renewal tasks directly to your calendar.
        </p>

        {calendarJustConnected && (
          <p className="mt-3 text-sm text-emerald-600 font-medium">Google Calendar connected ✓</p>
        )}
        {calendarError && (
          <p className="mt-3 text-sm text-red-600 font-medium">
            Couldn&apos;t connect Google Calendar. Please try again.
          </p>
        )}

        {calendarLoading ? (
          <p className="mt-3 text-xs text-[#7C6E67]/60">Checking connection...</p>
        ) : calendarConnected ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#F3F6F1] text-[#6E885B] font-semibold">
              Connected
            </span>
            <button
              onClick={disconnectCalendar}
              disabled={disconnecting}
              className="text-sm px-4 py-2 border border-[#E5DFD7] rounded-xl text-[#2E2724]
                hover:bg-[#FAF8F5] transition-colors bg-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google"
            className="mt-3 inline-block text-sm px-4 py-2 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl font-medium
              transition-colors shadow-sm"
          >
            Connect Google Calendar
          </a>
        )}
      </section>

      <section className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] p-6">
        <h2 className="text-base font-serif font-semibold text-[#1A1412]">Session</h2>
        <p className="text-xs text-[#7C6E67] mt-1">Sign out of NEXUS on this device.</p>
        <button
          onClick={handleLogout}
          className="mt-3 text-sm px-4 py-2 border border-[#E5DFD7] rounded-xl text-[#2E2724]
            hover:bg-[#FAF8F5] transition-colors bg-white font-semibold cursor-pointer"
        >
          Log out
        </button>
      </section>

      <section className="mt-4 bg-[#FDF2EE]/30 rounded-2xl border border-[#F5DFD6] p-6">
        <h2 className="text-base font-serif font-semibold text-[#D95D39]">Danger zone</h2>
        <p className="text-xs text-[#7C6E67] mt-1">
          Permanently delete your account and everything in it — documents, extracted data,
          reminders, chat history, and activity log. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 text-sm px-4 py-2 border border-[#F5DFD6] text-[#D95D39] rounded-xl
              hover:bg-[#FDF2EE] transition-colors bg-white font-semibold cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#7C6E67]">
              Type <span className="font-mono font-bold text-[#D95D39]">DELETE</span> to confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-[#F5DFD6] bg-white rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] text-[#2E2724]"
              placeholder="DELETE"
            />
            {deleteError && <p className="text-sm text-red-600 font-semibold">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="text-sm px-4 py-2 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl font-medium
                  hover:bg-[#C24E2B] disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
              >
                {deleting ? "Deleting..." : "Permanently delete everything"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(""); }}
                className="text-sm px-4 py-2 text-[#7C6E67] hover:text-[#2E2724] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
