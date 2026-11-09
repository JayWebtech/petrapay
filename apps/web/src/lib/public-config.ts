/**
 * Public URLs shown to merchants and developers (docs, code samples, the Developers page).
 * Override per deployment with NEXT_PUBLIC_API_ORIGIN, e.g. for a self-hosted instance.
 */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://api.petrapay.xyz").replace(/\/+$/, "");

/** Base URL of the public merchant API. */
export const API_V1 = `${API_ORIGIN}/v1`;
