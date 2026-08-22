import { createClient } from "@supabase/supabase-js";
import { generateAgentPlan } from "@/lib/gemini";
import { geocodeCity, getDailyForecast, bestUpcomingDay, type DailyForecast } from "@/lib/weather";
import { getAuthedUser } from "@/lib/require-user";
import { getValidAccessToken, isDayFree } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function pickBestFreeDay(
  forecast: DailyForecast[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<(DailyForecast & { calendarChecked: boolean }) | null> {
  const best = bestUpcomingDay(forecast);
  if (!best) return null;

  const accessToken = await getValidAccessToken(supabase, userId);
  if (!accessToken) return { ...best, calendarChecked: false };

  const byPrecip = [...forecast].sort((a, b) => a.precipProbability - b.precipProbability);
  for (const day of byPrecip) {
    try {
      if (await isDayFree(accessToken, day.date)) {
        return { ...day, calendarChecked: true };
      }
    } catch {
      return { ...best, calendarChecked: false };
    }
  }

  return { ...best, calendarChecked: false };
}

export async function POST() {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authedUser.id;

    const { data: deadlines } = await supabase
      .from("deadlines")
      .select("id, title, expiry_date, document_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("expiry_date", { ascending: true });

    const upcoming = (deadlines || []).filter((d) => daysUntil(d.expiry_date) <= 45);

    if (upcoming.length === 0) {
      return NextResponse.json({ plan: [] });
    }

    const documentIds = upcoming.map((d) => d.document_id).filter(Boolean);
    const [{ data: docs }, { data: fields }, { data: profile }] = await Promise.all([
      supabase.from("documents").select("id, file_name").in("id", documentIds),
      supabase.from("document_fields").select("document_id, field_name, field_value").in("document_id", documentIds),
      supabase.from("profiles").select("city").eq("id", userId).single(),
    ]);

    const docMap = new Map((docs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name]));

    let weatherNote = "";
    const city = (profile as { city?: string } | null)?.city;
    if (city) {
      try {
        const geo = await geocodeCity(city);
        if (geo) {
          const forecast = await getDailyForecast(geo.lat, geo.lon);
          const best = await pickBestFreeDay(forecast, supabase, userId);
          if (best) {
            weatherNote = `Weather in ${city}: the best day in the next 7 days looks to be ${best.date} (${best.description.toLowerCase()}, ${best.tempMin}-${best.tempMax}°C, ${best.precipProbability}% chance of rain)${best.calendarChecked ? ", and your Google Calendar is free that day" : ""}.`;
          }
        }
      } catch {
        // weather is optional context; proceed without it if it fails
      }
    }

    const obligationsText = upcoming
      .map((d) => {
        const docFields = (fields || [])
          .filter((f) => f.document_id === d.document_id)
          .map((f) => `${f.field_name}: ${f.field_value}`)
          .join("; ");
        const days = daysUntil(d.expiry_date);
        return [
          `- id: ${d.id}`,
          `  title: ${d.title}`,
          `  expires: ${d.expiry_date} (${days} days left)`,
          `  document: ${docMap.get(d.document_id) || "Unknown"}`,
          docFields ? `  known fields: ${docFields}` : null,
        ].filter(Boolean).join("\n");
      })
      .join("\n\n");

    const fullContext = weatherNote ? `${obligationsText}\n\n${weatherNote}` : obligationsText;
    const todayLabel = new Date().toISOString().slice(0, 10);

    const result = await generateAgentPlan(fullContext, todayLabel);

    const byId = new Map(upcoming.map((d) => [d.id, d]));
    const plan = (result.plan || [])
      .filter((item: { deadline_id: string }) => byId.has(item.deadline_id))
      .sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority)
      .map((item: { deadline_id: string; priority: number; task_title: string; reasoning: string; suggested_date: string | null }) => {
        const d = byId.get(item.deadline_id)!;
        return {
          deadline_id: item.deadline_id,
          document_id: d.document_id,
          deadline_title: d.title,
          expiry_date: d.expiry_date,
          priority: item.priority,
          task_title: item.task_title,
          reasoning: item.reasoning,
          suggested_date: item.suggested_date,
        };
      });

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "agent",
      details: { message: `NEXUS drafted a renewal plan with ${plan.length} item${plan.length === 1 ? "" : "s"}` },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
