const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";

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

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("google_tokens")
    .update({ access_token: refreshed.access_token, expiry_date: newExpiry, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return refreshed.access_token;
}

export async function getFreeBusy(accessToken: string, timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
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
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.calendars?.primary?.busy || [];
}

export async function isDayFree(accessToken: string, dateISO: string): Promise<boolean> {
  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(`${dateISO}T23:59:59`);
  const busy = await getFreeBusy(accessToken, dayStart.toISOString(), dayEnd.toISOString());
  return busy.length === 0;
}

export async function createCalendarEvent(
  accessToken: string,
  event: { title: string; description?: string; dateISO: string }
): Promise<string> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description || "Created by NEXUS",
      start: { date: event.dateISO },
      end: { date: event.dateISO },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}
