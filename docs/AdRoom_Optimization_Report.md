# AdRoom Optimization Report

## Issue
**User Feedback:** "AdRoom is analyzing once the web application starts" (too eager), sending too many requests (abuse risk), and should only use Gemini when required.

## Resolution

### 1. Lazy Initialization (Frontend)
- **Verified:** The `AdRoomChat` component is only rendered when the `adroom` tab is active in `Dashboard.tsx`.
- **Behavior:** Analysis is triggered only when the component mounts.
- **Optimization:** To prevent re-analysis on every tab switch, backend caching was implemented.

### 2. Rate Limiting (Backend)
- **Implemented:** Added `express-rate-limit` to `api/routes/adroom.ts`.
- **Policy:** Limit of 10 requests per 15 minutes per IP address.
- **Goal:** Prevent abuse and excessive API usage.

### 3. Caching (Backend)
- **Implemented:** Added `node-cache` for server-side in-memory caching.
- **Logic:** 
    - The `/api/adroom/analyze` endpoint checks for a cached analysis (TTL: 1 hour).
    - If found, it returns the cached result immediately (saving API costs and time).
    - If not found, it fetches data from Supabase, calls Gemini, and caches the result.
- **Benefit:** Drastically reduces Gemini API calls, especially if the user switches tabs frequently.

### 4. Database Migration (Optional for Persistence)
- A SQL migration file was created at `supabase/migrations/20240101000000_create_adroom_cache.sql`.
- **Instruction:** Apply this migration to your Supabase project if you wish to persist the cache across server restarts in the future. Currently, in-memory caching is active and sufficient for session-based performance.

## Verification
- **Rate Limiting:** Verified code implementation ensures requests exceeding the limit will receive a 429 status.
- **Caching:** Verified logic ensures the second request within 1 hour returns the cached value.
- **Tests:** Existing unit tests for `geminiService` pass.

## Next Steps
- Monitor the `gemini_usage` table (already implemented) to track actual token usage.
- Adjust Rate Limit parameters based on real-world usage patterns.
