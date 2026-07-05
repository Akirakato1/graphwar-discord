# Lobby Menu Flow Design

## Status

Pending written-spec review on 2026-07-05.

This design replaces the current developer-only direct-room flow with a Discord-ready pre-game flow: main menu, settings, create lobby, join lobby, lobby setup, spectating, and leaderboard.

## Current State

The app currently auto-connects to a room from URL query parameters such as `room`, `mockPlayer`, and `displayName`. The lobby screen shows players, mode, teams, and a start button, but it is not a true product lobby:

- Any connected player can start the match.
- Any connected player can change mode.
- Team assignment is displayed but not movable.
- The protocol has a `set-team` command, but the server rejects it.
- There is no main menu, lobby browser, lobby creator, spectator role, settings screen, or leaderboard.
- Rooms are in memory and disappear when empty.
- There is no guild/server scope; every local room id is global.

## Goals

- Add a main menu with `Create Lobby`, `Join Lobby`, `Settings`, and `Leaderboard`.
- Make local mock clients test the same create/join flow that Discord users will use.
- Scope visible lobbies and leaderboard entries to a Discord server/guild id.
- Let each joining user enter a lobby alias such as `Alice` or `Bob`.
- Keep Discord user id as the canonical identity for ownership and statistics.
- Reject or block duplicate aliases within the same lobby before join.
- Add lobby leader/creator authority.
- Let only the lobby leader start the match.
- Add player, team, and spectator slots before match start.
- Let players choose spectator before starting.
- Let users spectate an already-started lobby.
- Let team-versus lobbies move players between Team A, Team B, and Spectators.
- Add auto-assign for team-versus lobbies.
- Add a settings panel wired to local persistent server config with the first concrete fields defined in this spec.
- Add persistent leaderboard/stat entries keyed by guild id and Discord user id, with first displayed columns defined in this spec.
- Hide game UI during main menu, create lobby, join lobby, settings, leaderboard, and pre-game lobby setup.

## Non-Goals For This Checkpoint

- Full Discord OAuth/session verification.
- Final leaderboard metric design.
- Final match settings design.
- Public cross-server lobby discovery.
- Production database migration.
- Drag-and-drop polish for team movement. Buttons are acceptable for the first implementation.

## Identity Model

Each client has:

- `guildId`: Discord server id. Local testing uses a query parameter, defaulting to a stable local guild id.
- `discordUserId`: Discord user id. Local testing uses a query parameter or `mockPlayer`.
- `alias`: user-entered display name for the current lobby.

The server treats `guildId + discordUserId` as canonical identity. The alias is lobby-local display text and must be unique inside that lobby. Stats and leaderboard records never key by alias.

Local testing URLs should still be easy:

```txt
http://localhost:5173/?guild=local-guild&user=alice
http://localhost:5173/?guild=local-guild&user=bob
```

The user enters `Alice` or `Bob` in the join/create form. Existing `mockPlayer` links can continue to work as a compatibility shortcut by seeding `discordUserId` and default alias, but e2e tests should use the visible create/join lobby flow.

## Main Menu

The first visible screen is a main menu. It does not show the battlefield, function input, turn HUD, connection panel, or roster setup.

Actions:

- `Create Lobby`: opens create lobby form.
- `Join Lobby`: opens a guild-scoped lobby browser.
- `Settings`: opens local settings panel.
- `Leaderboard`: opens guild-scoped leaderboard panel.

The main menu can show a compact account/guild label, but it should not expose debug connection details in normal play.

## Create Lobby

Fields:

- Lobby name.
- Alias.
- Match mode: `Team Versus` or `Free For All`.
- Initial slot: player or spectator.

Behavior:

- Creating a lobby creates a guild-scoped lobby record.
- Creator becomes lobby leader.
- Creator joins using their entered alias and chosen slot.
- Alias is validated against existing lobby occupants. This is mostly defensive for create, but the same validation path should be used as join.
- After success, the creator lands in lobby setup.

## Join Lobby

The join screen shows only lobbies for the current `guildId`.

Lobby rows include:

- Lobby name.
- Leader alias.
- Mode.
- Status: `open`, `playing`, or `ended`.
- Player count and spectator count.

Behavior:

- Clicking an open lobby opens an alias form with `Join As Player` and `Join As Spectator`.
- Clicking a playing lobby opens an alias form with only `Spectate`.
- Ended lobbies can be listed as disabled or hidden; the first implementation can show them disabled.
- The joining user enters an alias.
- If the alias is empty, the form shows a validation message.
- If the alias already exists in the lobby, the textbox is marked invalid/red and the form says the name is already taken.
- Alias comparison is case-insensitive after trimming whitespace.
- A user already in a lobby can reconnect with their same `discordUserId` and current alias.

## Lobby Setup

Lobby setup is separate from gameplay. It does not show the battlefield or function input.

Shared elements:

- Lobby name.
- Mode.
- Leader label.
- Player list.
- Spectator box.
- Leave lobby action.
- Start match button visible and enabled only for leader when the lobby is valid.

Team-versus layout:

- Team A box.
- Team B box.
- Spectator box.
- Each occupant is shown by alias.
- A player can move themselves between Team A, Team B, and Spectators.
- The leader can move any occupant.
- `Auto Assign` distributes non-spectator players across Team A and Team B as evenly as possible.
- Start is disabled until both teams have at least one player.

Free-for-all layout:

- Players box.
- Spectator box.
- A player can move themselves between Players and Spectators.
- The leader can move any occupant.
- Start is disabled until at least two players are in the Players box.

## Started Lobby And Spectating

When a lobby starts:

- Player slots become match participants.
- Spectator slots remain connected as spectators.
- Spectators see the battlefield and shot playback.
- Spectators do not see enabled function input or direction controls.
- Users joining an already-started lobby can only join as spectators.

The existing authoritative server simulation remains unchanged for players, but command validation must reject `submit-shot`, `select-mode`, `set-team`, and `start-match` from spectators.

## Settings

The settings panel exists now even if exact settings are sparse.

The first implementation should persist a guild settings record locally with these concrete fields:

```ts
type GuildSettings = {
  guildId: string;
  defaultMode: "team-versus" | "free-for-all";
  allowSpectators: boolean;
};
```

The settings UI can expose these fields immediately. Future settings can add turn timers, player limits, function validation rules, terrain generation settings, and damage tuning.

Settings are stored server-side in local persistent storage and loaded by guild id. They survive server restarts.

## Leaderboard And Persistent Stats

The leaderboard panel uses a small concrete first column set while final competitive metrics remain future design work.

The server stores permanent stat entries:

```ts
type PlayerStatsEntry = {
  guildId: string;
  discordUserId: string;
  lastAlias: string;
  gamesPlayed: number;
  wins: number;
  eliminations: number;
  damageDealt: number;
  updatedAt: string;
};
```

The first UI shows these columns:

- Alias.
- Games played.
- Wins.

The server should create or update a stats entry when a user joins a lobby, so entries exist before final stats display expands. Match-result stat increments start with `gamesPlayed` and `wins`; `eliminations` and `damageDealt` remain stored as zero until the scoring pass wires them to match events.

## Persistence

Use local JSON persistence first. The server owns the storage layer; the client never writes files directly.

Suggested file:

```txt
apps/server/data/local-state.json
```

Suggested shape:

```ts
type PersistedServerState = {
  guilds: Record<
    string,
    {
      settings: GuildSettings;
      leaderboard: Record<string, PlayerStatsEntry>;
    }
  >;
};
```

Runtime lobbies can stay in memory for this implementation, but leaderboard and settings must persist. If lobby persistence is added in a future pass, it should remain guild-scoped.

## Protocol Shape

Add HTTP endpoints for menu/lobby data that does not require a game WebSocket yet:

- `GET /guilds/:guildId/lobbies`
- `POST /guilds/:guildId/lobbies`
- `GET /guilds/:guildId/settings`
- `PUT /guilds/:guildId/settings`
- `GET /guilds/:guildId/leaderboard`

Create lobby request includes leader identity, lobby name, alias, mode, and initial slot.

WebSocket game room paths should become guild scoped:

```txt
/guilds/:guildId/rooms/:roomId
```

The existing `/rooms/:roomId` path can remain temporarily for compatibility, but e2e should move to the guild-scoped flow.

Add or extend WebSocket commands:

- `join-room` includes `guildId`, `discordUserId`, `alias`, and `slot`.
- `set-team` becomes supported.
- `set-slot` or `set-team` can move players to `spectator`.
- `auto-assign-teams` is leader-only.
- `start-match` is leader-only.

## Client State Shape

The client should move from one implicit room state to an app route/state machine:

```ts
type AppView =
  | "main-menu"
  | "create-lobby"
  | "join-lobby"
  | "settings"
  | "leaderboard"
  | "lobby-setup"
  | "game";
```

Only `lobby-setup` and `game` need a WebSocket room connection. Main menu, settings, leaderboard, and lobby browser can use HTTP.

## UI Visibility Rules

- Main menu: menu actions only.
- Create lobby: lobby form only.
- Join lobby: lobby browser and alias form only.
- Settings: settings form only.
- Leaderboard: leaderboard table only.
- Lobby setup: roster/team/spectator controls only.
- Game as player: battlefield, own HP, direction dial, function input when it is the player's turn.
- Game as spectator: battlefield and compact spectator label; no function input or direction dial.

All screens must fit inside the Discord Activity 16:9 viewport without page scrolling.

## Testing Requirements

Unit tests:

- Alias normalization trims whitespace and compares case-insensitively.
- Duplicate alias in the same lobby is rejected.
- Same alias in different guilds or different lobbies is allowed.
- Lobby leader is the only user allowed to start.
- Spectators cannot submit shots.
- Team movement updates teams and spectator box.
- Auto-assign balances team-versus players.
- Guild settings persist and reload.
- Leaderboard entries persist and reload.

Integration tests:

- Two local mock users create/join a lobby through HTTP + WebSocket.
- Alice creates a lobby with alias `Alice`.
- Bob joins the lobby with alias `Bob`.
- Bob cannot join as `Alice`.
- Leader starts match; non-leader start is rejected.
- Started lobby appears as spectate-only.

End-to-end tests:

- Open Alice tab at local main menu.
- Alice creates lobby through UI.
- Open Bob tab at local main menu.
- Bob joins lobby through UI and enters alias.
- Duplicate alias textbox turns invalid/red and shows a message.
- Team-versus setup can move Bob between teams and spectator.
- Auto-assign fills Team A and Team B.
- Leader starts match.
- Spectator can join an already-started lobby and sees battlefield without shot controls.
- Main menu/settings/leaderboard/create/join/setup screens do not show game UI.

## Implementation Order

1. Shared types and server persistence.
2. Guild-scoped lobby directory and HTTP endpoints.
3. Lobby metadata, leader, alias validation, slots, and team movement.
4. Client app views for main menu, create/join/settings/leaderboard/setup.
5. WebSocket connection only after lobby selection.
6. Spectator mode and leader-only command validation.
7. E2E conversion so mock clients use create/join flow.

## Open Future Decisions

- Final leaderboard metrics.
- Final settings list.
- Whether lobby records should persist after all users leave.
- Whether team movement should become drag-and-drop.
- Discord SDK auth details for production identity verification.
