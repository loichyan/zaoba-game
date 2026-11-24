import { Leaderboard } from './Leaderboard';
import { ReputationBoard } from './ReputationBoard';
import type { LeaderboardEntry, ReputationEntry } from '../lib/types';

interface StudentBoardsProps {
  leaderboard: LeaderboardEntry[] | null;
  reputationBoard: ReputationEntry[] | null;
  meId: string;
  open: boolean;
  onToggle: () => void;
  showReputation?: boolean;
  note?: string;
}

export function StudentBoards({
  leaderboard,
  reputationBoard,
  meId,
  open,
  onToggle,
  showReputation = false,
  note,
}: StudentBoardsProps) {
  return (
    <div className="student-boards">
      <button type="button" className="btn btn-ghost board-toggle" onClick={onToggle}>
        {open ? '收起积分榜' : '看积分榜'}
      </button>
      {open && (
        <div className="student-board">
          <Leaderboard entries={leaderboard} meId={meId} limit={5} title="当前积分榜" compact />
          {showReputation && (
            <ReputationBoard
              entries={reputationBoard}
              meId={meId}
              title="江湖声誉榜"
              limit={5}
              compact
              showValues={false}
            />
          )}
          {note && <p className="fine center">{note}</p>}
        </div>
      )}
    </div>
  );
}
