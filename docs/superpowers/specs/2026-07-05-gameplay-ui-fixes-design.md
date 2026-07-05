# Gameplay UI Fixes Design

## Scope

This spec covers the first checkpoint only:

- Halve the normal shot travel limit.
- Ensure a killing shot still renders its full shot animation before the match-end UI appears.
- Show a blocking match-end popup with winner information and a single return-to-menu action.
- Center and polish the main menu for the Discord Activity 16:9 no-scroll target.

The custom map loader, persistent map library, and Electron map builder are intentionally out of scope for this checkpoint and will get a separate spec.

## Current Behavior

Shot travel is limited by `defaultMatchTuning.sampleStep * (defaultMatchTuning.maxPathPoints - 1)`. With `sampleStep = 0.05` and `maxPathPoints = 2000`, the current cap is `99.95` units before field-boundary clipping.

The final-shot animation can be skipped when the shot ends the match because `MatchController.submitShot()` returns `match-ended` instead of `shot-resolved` for a killing shot. The client only animates `shot-resolved` events, so it receives the ended snapshot without the final path. The canvas is also passed the fully resolved snapshot during playback, while the HUD uses the staged pre-shot snapshot.

## Recommended Approach

Use normal event sequencing:

1. The server always broadcasts `shot-resolved` for an accepted shot, including a killing shot.
2. If the shot ends the match, the server broadcasts `match-ended` immediately after `shot-resolved`.
3. The client uses the latest `shot-resolved` event for playback and keeps both HUD and canvas on the pre-shot snapshot while playback is in progress.
4. If a `match-ended` event arrives during playback, the client delays the modal until playback finishes.

This keeps `shot-resolved` as the only event that carries path and impact details, and keeps `match-ended` focused on final outcome.

## Server Design

`MatchController.submitShot()` will return `shot-resolved` for every valid submitted shot. The returned event will include the post-shot snapshot. If victory is reached, the controller will still mark its internal snapshot as ended after building the shot event, so the room can emit a separate `match-ended` event based on the ended snapshot.

`GameRoom.handleSubmitShot()` will broadcast the `shot-resolved` event first. For non-ending shots it will keep broadcasting `turn-advanced`. For ending shots it will broadcast `match-ended`, mark the lobby ended, and persist the match result. It will not broadcast `turn-advanced` after match end.

The shot length cap will change by setting `defaultMatchTuning.maxPathPoints` to `1001`, preserving `sampleStep = 0.05` and producing a `50.0` unit cap.

## Client Design

`GameActivity` will pass `displaySnapshot` into `GameCanvas` so both world rendering and HUD use the same staged snapshot while a shot is travelling.

A `MatchEndModal` component will derive winner display from the final snapshot and latest `match-ended` event:

- In team-versus mode, it will show the winning team label and winner names.
- In free-for-all mode, it will show the winner names.
- If no winner exists, it will show a draw/no-winner message.

The modal will only render when the final match-ended event exists and playback is not in progress. It will cover the game UI, block pointer access to the underlying controls, and expose only one action: `Return to Menu`.

The return action will disconnect from the lobby session, clear transient match/lobby state, and navigate to `main-menu`.

## Main Menu Design

The main menu remains a simple Discord Activity menu. It will be centered both vertically and horizontally, use a constrained column width, and keep the guild indicator, title, and action buttons aligned as one centered group. The action buttons will be full-width within the menu group to avoid awkward wrapping in 16:9 desktop and phone-landscape layouts.

## Testing Plan

Add focused tests for:

- The shot length constant now producing a `50.0` unit travel cap.
- A killing shot producing `shot-resolved` followed by `match-ended`.
- The room not sending `turn-advanced` after a match-ending shot.
- Client state/rendering delaying the match-end modal until shot playback completes.
- Winner text formatting for team and free-for-all snapshots.
- Main menu centered layout remaining within the no-scroll viewport through existing Playwright coverage.

Run the established verification set for this checkpoint: `npm run check`, `npm test`, `npm run test:e2e`, `npm --workspace apps/client run build`, and `npm --workspace apps/server run build`.
