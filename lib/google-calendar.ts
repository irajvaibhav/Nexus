const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  // Lets Settings show which Google account is connected.
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export const GOOGLE_STATE_COOKIE = "nexus_google_oauth_state";

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI!;
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CALENDAR_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

type StoredTokenRow = {
  access_token: string;
  refresh_token: string | null;
  expiry_date: string;
};

export class CalendarDisconnectedError extends Error {
  constructor(message = "Google Calendar is no longer connected. Reconnect it from Settings.") {
    super(message);
    this.name = "CalendarDisconnectedError";
  }
}

export async function getValidAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: row } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expiry_date")
    .eq("user_id", userId)
    .maybeSingle() as { data: StoredTokenRow | null };

  if (!row) return null;

  const expiresSoon = new Date(row.expiry_date).getTime() - Date.now() < 60_000;
  if (!expiresSoon) return row.access_token;

  if (!row.refresh_token) return row.access_token;

  let refreshed: TokenResponse;
  try {
    refreshed = await refreshAccessToken(row.refresh_token);
  } catch {
    // The grant was revoked or expired. Keeping the row would leave Settings
    // saying "Connected" while every calendar call fails.
    await supabase.from("google_tokens").delete().eq("user_id", userId);
    throw new CalendarDisconnectedError();
  }

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("google_tokens")
    .update({ access_token: refreshed.access_token, expiry_date: newExpiry, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return refreshed.access_token;
}

async function googleJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const error = data.error as { message?: string; status?: string } | string | undefined;
  if (!res.ok || error) {
    const message =
      typeof error === "string"
        ? error
        : error?.message || `Google returned ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new CalendarDisconnectedError(
        `Google rejected the request (${message}). Reconnect the calendar to grant access again.`
      );
    }
    throw new Error(message);
  }
  return data;
}

// The connected Google account. Older grants lack the email scope; null then.
export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const data = await googleJson("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return typeof data.email === "string" ? data.email : null;
  } catch {
    return null;
  }
}

export async function getFreeBusy(accessToken: string, timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  const data = await googleJson("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });
  const calendars = data.calendars as { primary?: { busy?: { start: string; end: string }[] } } | undefined;
  return calendars?.primary?.busy || [];
}

// A cheap round-trip that proves the token works against the user's calendar.
export async function probeCalendarAccess(accessToken: string): Promise<void> {
  const now = new Date();
  const later = new Date(now.getTime() + 60_000);
  await getFreeBusy(accessToken, now.toISOString(), later.toISOString());
}

export async function isDayFree(accessToken: string, dateISO: string): Promise<boolean> {
  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(`${dateISO}T23:59:59`);
  const busy = await getFreeBusy(accessToken, dayStart.toISOString(), dayEnd.toISOString());
  return busy.length === 0;
}

function nextDayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type CreatedEvent = { id: string; htmlLink: string | null };

export async function createCalendarEvent(
  accessToken: string,
  event: { title: string; description?: string; dateISO: string }
): Promise<CreatedEvent> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.dateISO)) {
    throw new Error(`Invalid date "${event.dateISO}", expected YYYY-MM-DD`);
  }

  // All-day events use an exclusive end date. With start == end Google
  // rejects the event as an empty range, so nothing ever reached the calendar.
  const data = await googleJson("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description || "Created by NEXUS",
      start: { date: event.dateISO },
      end: { date: nextDayISO(event.dateISO) },
      reminders: { useDefault: true },
    }),
  });

  return {
    id: String(data.id),
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
  };
}
