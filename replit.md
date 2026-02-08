# Saaf Rider - Delivery Partner App

## Overview
Mobile-first Delivery Partner (Rider) App for the "Saaf" laundry marketplace. Built with Expo (React Native), TypeScript, Expo Router. Dark theme UI throughout.

## Recent Changes
- **2026-02-08**: Initial build - login, home, orders, order detail, support, profile screens
- Auth context with AsyncStorage persistence
- Mock API layer in lib/api.ts (ready for backend replacement)
- Dark theme with teal (#00D4AA) accent color

## Architecture
- **Routing**: Expo Router file-based routing
  - `/login` - Authentication screen
  - `/status-blocked` - For PENDING/SUSPENDED riders
  - `/(main)` - Tab layout with Home, Orders, Support, Profile
  - `/order/[id]` - Order detail screen
  - `/new-dispute` - Form sheet for creating disputes
- **State**: Auth context (lib/auth-context.tsx), AsyncStorage persistence
- **API Layer**: lib/api.ts - mock implementations with TODO markers for real backend
- **Theme**: constants/colors.ts - dark theme colors
- **Fonts**: Inter (Google Fonts)

## User Preferences
- Dark theme default
- Minimal text, large touch targets
- No emojis, use vector icons
- High contrast status badges

## Key Files
- `lib/api.ts` - API service layer (mock, replace with real REST calls)
- `lib/auth-context.tsx` - Authentication state management
- `constants/colors.ts` - Theme colors
- `app/(main)/_layout.tsx` - Tab navigation with liquid glass support
