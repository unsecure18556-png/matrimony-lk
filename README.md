# Matrimony LK (Phases 1-4)

React + Vite + TypeScript + Tailwind + Supabase.

## Features
Register/login/Google/reset password, 5-step profile wizard, private photos with privacy control,
advanced search, AI best-match scoring with reasons, send/accept/decline interests, shortlist,
realtime chat (after acceptance), contact number reveal, block/report, face verification (selfie vs photo),
duplicate-face flags, opt-in similar-face suggestions, admin moderation.

## Setup
1. `.env` -> VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)
2. Supabase SQL Editor, run in order: supabase/01_auth_tables.sql, 02_profile_photos.sql, 03_features.sql,
   04_mandatory_face.sql, 05_feed.sql, 06_social.sql
   (skip any you already ran)
3. `npm install` then `npm run dev`
4. Make yourself admin (SQL Editor): update public.accounts set role='admin'
   where id = (select id from auth.users where email = 'YOUR@EMAIL.COM');

## Mobile / install on phone
The app is responsive (bottom tab bar on phones) and is a PWA: after deploying to https, open it on the phone
and use "Add to Home screen" (Android Chrome) or Share -> "Add to Home Screen" (iPhone Safari).
Deploy on Vercel/Netlify (vercel.json and public/_redirects already handle page routing).

## Face verification is mandatory
After onboarding every member must verify their face (selfie vs profile photo). Enforced in the app and in the
database (04_mandatory_face.sql). Admins are exempt.

## Feed
Home page is a feed: posts with up to 4 photos, #hashtags, place + district, likes and comments.
Verified members only. No links or phone numbers allowed in captions/comments. 5 posts per day.

## Navigation
Home (feed: For You / Recent / Matches, infinite) | Discover | Matches (Recommended / Mutual / Interests) | Create | Chat | Profile. Bell = notifications.
