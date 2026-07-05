# Lobby Identity And Settings Design

## Goal

Improve the pre-match lobby so player identity and movement are clearer, and make maximum function travel length a lobby-level match setting.

## Requirements

- The lobby leader is marked with a small yellow crown icon immediately to the left of their name.
- Player names use a player-selected color.
- Players choose one of 10 fixed colors when creating or joining a lobby.
- The selected color is server-authoritative and visible to all clients.
- The selected color is used for the player's in-game icon and name label.
- Per-player move buttons inside roster rows are removed.
- Each group table header owns its movement button:
  - Team A header: `Join A`
  - Team B header: `Join B`
  - Spectators header: `Join Spectator`
  - Free-for-all players header: `Join Players`
- A group's join button is disabled when the local player is already in that group.
- A group's join button is disabled when the local player cannot move there.
- Lobby leader controls such as `Auto Assign` and `Start Match` remain leader-only.
- Create Lobby is vertically and horizontally centered like the main menu.
- Create Lobby includes maximum function length as a match setting.
- Maximum function length defaults to the current `50` world units.
- Maximum function length is bounded from `20` to `100` world units.
- The server uses the lobby's maximum function length for authoritative shot path sampling.

## Architecture

Add shared lobby identity constants for the 10-color palette and max-function-length bounds. Extend create/join lobby requests, lobby occupants, lobby sessions, and match player snapshots with a validated `color` value. Extend lobby snapshots with `maxFunctionLength`, and pass it from the server lobby directory into the match controller before match start.

The client renders player names with their color, adds a small crown glyph for leaders, and replaces row-level movement actions with group-header join actions scoped to the local occupant. The game renderer uses `player.color` for player circles and labels, falling back to existing team-derived colors only if older snapshots do not include a color.

## Data Flow

1. Create Lobby sends `alias`, `color`, `maxFunctionLength`, mode, map, and slot.
2. Join Lobby sends `alias`, `color`, and slot.
3. `LobbyDirectory` validates color and max function length, stores them on runtime lobby state, and emits them in snapshots.
4. `GameRoom` passes ordered lobby players and lobby max length into `MatchController`.
5. `MatchController` stores colors on `PlayerState` and configures `ShotSimulator` with the lobby max path length.
6. Clients render the updated lobby and game state from server snapshots.

## UI Details

The color selector is a compact 10-swatch control with accessible button labels such as `Choose red`. The selected swatch is visually highlighted and included in form submission. The Create Lobby panel remains compact enough for Discord's 16:9 no-scroll viewport.

Group headers are laid out with the group title on the left and one join action on the right. Rows contain only the crown marker, colored player name, and compact status text if needed. This keeps action placement predictable and makes touch interaction easier on phone layouts.

## Error Handling

Invalid colors and out-of-range max function lengths are rejected by shared Zod schemas before reaching lobby runtime logic. The server keeps existing lobby errors for alias conflicts, invalid maps, forbidden actions, and invalid placement. If old data or test fixtures omit color, renderers fall back to a palette color so backward-compatible tests and snapshots remain readable.

## Testing

- Shared schema tests cover color validation and max-function-length bounds.
- `LobbyDirectory` tests cover create/join persistence of colors, max length, and placement movement.
- `MatchController` or room integration tests cover color propagation into match snapshots and max path length affecting shot sampling.
- Client component tests cover centered Create Lobby layout, color selectors, crown rendering, and group-header join button behavior.
- Existing Playwright lobby tests are updated for the new join controls.
