import { useState } from "react";
import type { ImpactReason, PlayerId, ServerEvent } from "@graphwar/shared";

export type ShotHistoryEntry = {
  id: string;
  aimDirection: string;
  expression: string;
  impactReason: ImpactReason;
  shooterAvatarUrl?: string;
  shooterColor?: string;
  shooterId: PlayerId;
  shooterName: string;
  turnNumber: number;
};

type ShotHistoryTabProps = {
  defaultExpanded?: boolean;
  enabled: boolean;
  events: ServerEvent[];
};

function impactLabel(reason: ImpactReason): string {
  return reason.replace(/-/g, " ");
}

export function shotHistoryEntriesFromEvents(events: ServerEvent[]): ShotHistoryEntry[] {
  const entries: ShotHistoryEntry[] = [];

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "shot-resolved") {
      continue;
    }

    const shooter = event.snapshot.players.find((player) => player.id === event.shooterId);
    entries.push({
      id: `${event.roomId}:${event.snapshot.turn.turnNumber}:${event.shooterId}:${index}`,
      aimDirection: event.aimDirection,
      expression: event.expression,
      impactReason: event.impact.reason,
      shooterAvatarUrl: shooter?.avatarUrl,
      shooterColor: shooter?.color,
      shooterId: event.shooterId,
      shooterName: shooter?.displayName ?? event.shooterId,
      turnNumber: event.snapshot.turn.turnNumber
    });
  }

  return entries;
}

export function ShotHistoryTab({ defaultExpanded = false, enabled, events }: ShotHistoryTabProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!enabled) {
    return null;
  }

  const entries = shotHistoryEntriesFromEvents(events);

  if (!expanded) {
    return (
      <aside className="shot-history-tab collapsed" aria-label="Function history">
        <button
          aria-label="Expand function history"
          className="shot-history-toggle"
          data-game-sound="ui.button"
          onClick={() => setExpanded(true)}
          type="button"
        >
          {">"}
        </button>
      </aside>
    );
  }

  return (
    <aside className="shot-history-tab expanded" aria-label="Function history">
      <div className="shot-history-heading">
        <h2>Function history</h2>
        <button
          aria-label="Collapse function history"
          className="shot-history-toggle"
          data-game-sound="ui.button"
          onClick={() => setExpanded(false)}
          type="button"
        >
          {"<"}
        </button>
      </div>
      {entries.length > 0 ? (
        <ol className="shot-history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className="shot-history-player">
                {entry.shooterAvatarUrl ? (
                  <img alt="" className="shot-history-avatar" src={entry.shooterAvatarUrl} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="shot-history-avatar color-avatar"
                    style={{ backgroundColor: entry.shooterColor ?? "#65c18c" }}
                  />
                )}
                <span>{entry.shooterName}</span>
              </div>
              <code>{entry.expression}</code>
              <span className="shot-history-impact">{impactLabel(entry.impactReason)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="shot-history-empty">No shots yet.</p>
      )}
    </aside>
  );
}
