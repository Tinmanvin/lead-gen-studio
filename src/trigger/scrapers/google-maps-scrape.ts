import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { supabase } from "../../lib/supabase-server.js";
import type { GooglePlaceResult, Country, RawLead } from "../../lib/types.js";

const NICHES_AU = [
  "plumber",
  "electrician",
  "roofer",
  "solar installer",
  "mortgage broker",
  "dentist",
  "physiotherapist",
  "chiropractor",
  "law firm",
  "personal injury lawyer",
  "real estate agent",
  "mechanic",
  "locksmith",
  "pest control",
];

const NICHES_UK = [
  "plumber",
  "electrician",
  "roofer",
  "mortgage broker",
  "solicitor",
  "dentist",
  "physiotherapist",
  "estate agent",
  "mechanic",
  "locksmith",
  "pest control",
  "accountant",
];

const CITIES_AU = [
  { city: "Sydney", timezone: "Australia/Sydney" },
  { city: "Melbourne", timezone: "Australia/Melbourne" },
  { city: "Brisbane", timezone: "Australia/Brisbane" },
  { city: "Perth", timezone: "Australia/Perth" },
  { city: "Adelaide", timezone: "Australia/Adelaide" },
];

const CITIES_UK = [
  { city: "London", timezone: "Europe/London" },
  { city: "Manchester", timezone: "Europe/London" },
  { city: "Birmingham", timezone: "Europe/London" },
  { city: "Leeds", timezone: "Europe/London" },
  { city: "Bristol", timezone: "Europe/London" },
];

const MISSED_CALL_KEYWORDS = [
  "no one picked up",
  "never called back",
  "voicemail was full",
  "didn't return my call",
  "couldn't reach",
  "no answer",
  "left a message",
  "still waiting",
  "no response",
];

const AFTER_HOURS_KEYWORDS = [
  "closed on weekend",
  "not available after",
  "couldn't get through",
  "called after hours",
  "after 5",
  "on the weekend",
];

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<GooglePlaceResult | null> {
  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "websiteUri",
    "nationalPhoneNumber",
    "rating",
    "userRatingCount",
    "reviews",
    "regularOpeningHours",
    "businessStatus",
  ].join(",");

  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const data = (await res.json()) as GooglePlaceResult & { error?: { message: string } };

  if (data.error) {
    logger.warn("Place details error", { placeId, error: data.error.message });
    return null;
  }
  return data;
}

async function searchPlaces(
  query: string,
  apiKey: string
): Promise<string[]> {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20 }),
  });

  const data = (await res.json()) as {
    places?: Array<{ id: string }>;
    error?: { message: string };
  };

  if (data.error) {
    logger.error("Places search error", { query, error: data.error.message });
    return [];
  }
  return (data.places ?? []).map((p) => p.id);
}

function detectMissedCallSignal(reviews: GooglePlaceResult["reviews"]): string | null {
  if (!reviews) return null;
  for (const review of reviews) {
    const text = review.text.text.toLowerCase();
    const match = MISSED_CALL_KEYWORDS.find((kw) => text.includes(kw));
    if (match) return review.text.text;
  }
  return null;
}

function detectAfterHoursSignal(
  reviews: GooglePlaceResult["reviews"],
  openingHours?: GooglePlaceResult["regularOpeningHours"]
): string | null {
  if (openingHours?.weekdayDescriptions) {
    const closedEarly = openingHours.weekdayDescriptions.some((h) =>
      h.match(/closed|17:00|18:00/i)
    );
    if (closedEarly) return "Closes at or before 6pm";
  }
  if (!reviews) return null;
  for (const review of reviews) {
    const text = review.text.text.toLowerCase();
    const match = AFTER_HOURS_KEYWORDS.find((kw) => text.includes(kw));
    if (match) return review.text.text;
  }
  return null;
}

function isNewListing(placeDetails: GooglePlaceResult): boolean {
  return (placeDetails.userRatingCount ?? 0) < 15;
}

async function saveLead(
  lead: RawLead,
  userId: string
): Promise<string | null> {
  // Check for duplicate by company_name + country
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("company_name", lead.company_name)
    .eq("country", lead.country)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...lead, user_id: userId, status: "new" })
    .select("id")
    .single();

  if (error) {
    logger.error(`Save failed [${error.code}]: ${error.message} | hint: ${error.hint} | company: ${lead.company_name}`);
    return null;
  }

  return data.id;
}

async function saveSignals(
  leadId: string,
  signals: Array<{ signal_type: string; evidence: string }>
): Promise<void> {
  if (signals.length === 0) return;
  await supabase.from("lead_signals").insert(
    signals.map((s) => ({ ...s, lead_id: leadId }))
  );
}

export const googleMapsScrape = schemaTask({
  id: "google-maps-scrape",
  schema: z.object({
    country: z.enum(["AU", "UK"]),
    niche: z.string(),
    city: z.string(),
    timezone: z.string(),
    userId: z.string(),
  }),
  machine: "small-2x",
  maxDuration: 300,
  run: async (payload) => {
    const { country, niche, city, timezone, userId } = payload;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY!;

    logger.log(`Scraping Google Maps: ${niche} in ${city}, ${country}`);

    const query = `${niche} in ${city} ${country === "AU" ? "Australia" : "UK"}`;
    const placeIds = await searchPlaces(query, apiKey);

    logger.log(`Found ${placeIds.length} places for query: ${query}`);

    let saved = 0;
    let skipped = 0;

    for (const placeId of placeIds) {
      const place = await fetchPlaceDetails(placeId, apiKey);
      if (!place || place.businessStatus !== "OPERATIONAL") {
        skipped++;
        continue;
      }

      if (!place.rating) {
        skipped++;
        continue;
      }

      const signals: Array<{ signal_type: string; evidence: string }> = [];

      const missedCallEvidence = detectMissedCallSignal(place.reviews);
      if (missedCallEvidence) {
        signals.push({ signal_type: "missed_call", evidence: missedCallEvidence });
      }

      const afterHoursEvidence = detectAfterHoursSignal(place.reviews, place.regularOpeningHours);
      if (afterHoursEvidence) {
        signals.push({ signal_type: "after_hours_gap", evidence: afterHoursEvidence });
      }

      if (place.rating >= 3.2 && place.rating <= 3.8) {
        signals.push({
          signal_type: "low_rating",
          evidence: `Rating: ${place.rating} (${place.userRatingCount} reviews)`,
        });
      }

      if (isNewListing(place)) {
        signals.push({
          signal_type: "new_listing",
          evidence: `Only ${place.userRatingCount ?? 0} reviews — likely new`,
        });
      }

      const name = place.displayName?.text ?? "";
      const website = place.websiteUri;

      const lead: RawLead = {
        company_name: name,
        website,
        niche,
        country: country as Country,
        city,
        timezone,
        source: "google_maps",
        source_url: `https://maps.google.com/?place_id=${placeId}`,
        source_raw: place as unknown as Record<string, unknown>,
        rating: place.rating,
        review_count: place.userRatingCount,
        has_ssl: website?.startsWith("https") ?? false,
      };

      const leadId = await saveLead(lead, userId);
      if (!leadId) {
        skipped++;
        continue;
      }

      await saveSignals(leadId, signals);
      saved++;
    }

    logger.log(`Done: ${saved} saved, ${skipped} skipped`);
    return { saved, skipped, niche, city, country };
  },
});

export { NICHES_AU, NICHES_UK, CITIES_AU, CITIES_UK };
