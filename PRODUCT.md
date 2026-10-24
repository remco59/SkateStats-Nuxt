# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A long-track ice speed skater, or a parent/coach reading for them, checking results mostly on a phone: rink-side under hall lighting, in the car, on the way home. Secondary: reviewing seasons, splits and targets at a desk in the evening. Several skaters can have accounts on one self-hosted instance; the admin manages users.

## Product Purpose

SkateStats keeps one skater's competition history in one place: races ("ritten") with lap splits, personal records (PR) and season bests (SB), progress per distance, targets with simulated splits, and comparison of two races. Results arrive by import (OSTA, SpeedSkatingResults, KNSB PDF sheets, account backup) or manual entry. Success: right after a race, the skater sees how it went against their PR within seconds, and over a season sees whether they are getting faster.

## Positioning

A private, self-hosted result book for one skater's own times, built around splits, lanes and PR/SB. It is not a social network and not a federation results site.

## Operating Context

- Discipline: long-track ice speed skating, paired-lane sheets (inner/outer lane), 100m-opening splits, lap times.
- Data sources: OSTA monitor on the dashboard (checks linked OSTA profiles after load), SpeedSkatingResults, PDF result sheets, JSON backup.
- Deployment: Nuxt 4 + SQLite, Docker Compose, often used on slow rink/venue connectivity.

## Capabilities and Constraints

- Pages: dashboard (`/`), results (competitions, races, compare), progress (stats, targets), import (OSTA, PDF, preview), account, admin.
- UI language is Dutch and stays Dutch. PR = persoonlijk record, SB = seizoensbeste.
- Light, dark and system themes all stay supported; motion setting (all / background / cards / none) stays.
- Front-end only redesign: routes, API and data model are unchanged.

## Brand Commitments

Name "SkateStats". Dutch copy. Light/dark/system theme switch. The orange accent is not binding.

## Evidence on Hand

Real fixture data under `reference/fixtures/` and a seeded e2e database (`test/e2e/global-setup.ts`). No testimonials, user counts or benchmarks exist; none may be invented.

## Product Principles

1. The latest result against the skater's PR is the first thing they see.
2. Times are the content: tabular, legible at a glance, never decorated.
3. Nothing changes the skater's data without them knowing; every risky action can be undone.
4. Works one-handed on a phone with a weak connection.
5. Skating vocabulary (lanes, splits, laps) is the product's own visual material.

## Accessibility & Inclusion

WCAG AA contrast for all text and controls in every theme; keyboard-operable everywhere; touch targets at least 44px; honours reduced motion.
