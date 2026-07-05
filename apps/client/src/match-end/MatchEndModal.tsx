import type { MatchEndedEvent, MatchSnapshot } from "@graphwar/shared";
import { useEffect, useRef, type KeyboardEvent } from "react";

type WinnerText = {
  detail: string;
  title: string;
};

export function formatMatchWinner(snapshot: MatchSnapshot, winnerIds: string[]): WinnerText {
  const winners = winnerIds
    .map((winnerId) => snapshot.players.find((player) => player.id === winnerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const names = winners.map((winner) => winner.displayName).join(", ");

  if (winners.length === 0) {
    return { title: "Match ended", detail: "No winner" };
  }

  if (snapshot.mode === "team-versus") {
    return { title: `${teamLabel(winners[0].teamId)} wins`, detail: names };
  }

  return { title: winners.length === 1 ? `${names} wins` : "Winners", detail: names };
}

export function MatchEndModal({
  event,
  onReturnToMenu
}: {
  event: MatchEndedEvent;
  onReturnToMenu: () => void;
}) {
  const winnerText = formatMatchWinner(event.snapshot, event.winnerIds);
  const returnButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    returnButtonRef.current?.focus();
  }, []);

  function handleDialogKeyDown(keyboardEvent: KeyboardEvent<HTMLElement>): void {
    if (keyboardEvent.key !== "Tab") {
      return;
    }

    keyboardEvent.preventDefault();
    returnButtonRef.current?.focus();
  }

  return (
    <div className="match-end-backdrop">
      <section
        aria-labelledby="match-end-title"
        aria-modal="true"
        className="match-end-dialog"
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <p className="eyebrow">Match complete</p>
        <h2 id="match-end-title">{winnerText.title}</h2>
        <p>{winnerText.detail}</p>
        <button autoFocus className="primary-action" onClick={onReturnToMenu} ref={returnButtonRef} type="button">
          Return to Menu
        </button>
      </section>
    </div>
  );
}

function teamLabel(teamId: string): string {
  if (teamId === "team-a") {
    return "Team A";
  }
  if (teamId === "team-b") {
    return "Team B";
  }
  return teamId || "Winning team";
}
