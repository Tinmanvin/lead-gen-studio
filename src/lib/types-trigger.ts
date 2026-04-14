export type Country = "AU" | "UK" | "US";

export type LeadStatus =
  | "new"
  | "enriched"
  | "scored"
  | "outreached"
  | "replied"
  | "booked"
  | "dismissed";

export type DemoType =
  | "EMAIL_ONLY"
  | "WIDGET"
  | "REDESIGN"
  | "NEW_SITE"
  | "COMPOUND";

export type SignalType =
  | "missed_call"
  | "after_hours_gap"
  | "low_rating"
  | "new_listing"
  | "no_booking_link"
  | "no_chatbot"
  | "no_ssl"
  | "no_tracking_pixel"
  | "wordpress_no_chat"
  | "ads_no_capture";

export type TouchpointTier = "A" | "B" | "C" | "D";

export interface RawLead {
  company_name: string;
  website?: string;
  niche: string;
  country: Country;
  city?: string;
  timezone?: string;
  dm_name?: string;
  dm_title?: string;
  dm_email?: string;
  dm_linkedin_url?: string;
  dm_whatsapp?: string;
  dm_facebook_url?: string;
  source: string;
  source_url?: string;
  source_raw?: Record<string, unknown>;
  rating?: number;
  review_count?: number;
  listed_since?: string;
  has_ssl?: boolean;
}

// Places API (New) response shape
export interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{ text: { text: string }; rating: number }>;
  regularOpeningHours?: { weekdayDescriptions: string[] };
  businessStatus?: string;
}

export interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  resigned_on?: string;
}
