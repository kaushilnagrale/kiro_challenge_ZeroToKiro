---
name: react-screen
description: |
  Use when adding a new screen to the PulseRoute Expo app. Generates a
  complete screen with expo-router registration, Zustand integration,
  loading/error/empty states, provenance chips, and a skeleton render.
  Follows our design tokens. Trigger phrases: "add screen", "new page",
  "create view for", "build the X screen".
---

# React Screen Skill

When the user asks for a new screen, produce all of these in one response.

## 1. Screen file (frontend/app/<route>.tsx)

Use expo-router file-based routing. File name becomes the URL.

Required structure:
- Default export is the screen component
- Uses `useSafeAreaInsets()` for top padding
- Tailwind classes via NativeWind — no inline StyleSheet unless animating
- Three render states handled explicitly: loading, error, success
- All API calls via `frontend/services/apiClient.ts` — never direct fetch

## 2. State (frontend/stores/<name>Store.ts)

If the screen has cross-screen state, add a Zustand store:
- Use `immer` middleware
- Persist with `expo-secure-store` for user data only
- Never persist tokens or API responses

## 3. Design tokens (use these exact values)

Colors:
- green #16a34a — pulseroute route, green hydration
- blue #2563eb — fastest route, water stops
- amber #d97706 — yellow hydration, heat zones
- red #dc2626 — red hydration
- purple #9333ea — weather advisories
- neutral-900 #111827 — primary text
- neutral-500 #6b7280 — secondary text
- neutral-50 #f9fafb — background

Typography:
- text-3xl (30px) — screen titles
- text-xl (20px) — section headers
- text-base (16px) — body
- text-sm (14px) — secondary
- text-xs (12px) — captions + timestamps

Spacing:
- p-4 (16px) — screen padding
- gap-3 (12px) — card internal spacing
- gap-2 (8px) — tight spacing

Tap targets: minimum h-11 w-11 (44x44pt).

## 4. Provenance integration

If this screen renders any backend-derived data:
- Import `ProvenanceChip` and `ProvenanceModal` from components
- Every data panel has a `<ProvenanceChip sources={...} />` at the bottom
- Tap opens the modal

## 5. Loading + error + empty states

Never render raw spinners. Use:
- `<ScreenLoading message="..." />` for initial load
- `<ScreenError onRetry={...} />` for failures
- `<ScreenEmpty icon={...} message="..." />` for empty data

Create these if they don't exist in `components/states/`.

## 6. Accessibility

- Every Pressable has `accessibilityLabel`
- Every image has `accessibilityLabel` or `accessibilityIgnoresInvertColors`
- Text contrast ratio ≥ 4.5:1

## 7. Test file (frontend/app/<route>.test.tsx)

- One render test with mocked store
- One loading state test
- One error state test
- One success state test with sample data
- Mock `apiClient` with `vi.mock('@/services/apiClient')`

## Checklist before done

- [ ] Screen file created with three render states
- [ ] Store added if cross-screen state needed
- [ ] All colors use design tokens
- [ ] Provenance chip on data panels
- [ ] Accessibility labels present
- [ ] 4 tests passing
- [ ] Route shows up in expo-router dev server