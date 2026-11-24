export type Mode = 'must' | 'never' | 'prob' | 'threshold';
export type DealMode = 'fixed' | 'independent';
export type GameMode = 'base' | 'rollcall' | 'cover';
export type TheoryDisplay = 'off' | 'status' | 'full';
export type RoleType = 'H' | 'L';
export type Action = 'attend' | 'skip';
export type RoomStatus = 'lobby' | 'action' | 'reveal' | 'cover' | 'review' | 'settlement' | 'final';
export type ReputationTier = 'low' | 'mid' | 'high';
export type CoverChoice = 'help' | 'decline';
export type CoverOutcome = 'success' | 'caught' | 'declined' | 'no_help' | 'both_skip' | 'no_call' | 'solo';
export type CalledBy = 'fixed' | 'threshold' | 'prob';

export interface Settings {
  mode: Mode;
  h: number;
  dealMode: DealMode;
  tau: number;
  mood: number;
  duration: number;
  theoryDisplay: TheoryDisplay;
  skipPass: boolean;
}

export interface Role {
  type: RoleType;
  label: string;
  short: string;
  cost: number;
  attend: { called: number; safe: number };
  skip: { called: number; safe: number };
  character: string;
  reason?: string;
}

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  bot: boolean;
  connected: boolean;
  waiting: boolean;
  submitted: boolean;
  rank: number;
  reputationTier?: ReputationTier;
  teamId?: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  bot: boolean;
  connected: boolean;
}

export interface ReputationEntry {
  id: string;
  name: string;
  reputation: number;
  tier: ReputationTier;
  rank: number;
  coverSuccessCount: number;
  bot: boolean;
  connected: boolean;
}

export interface TeamMemberPublic {
  id: string;
  name: string;
  tier: ReputationTier;
  connected: boolean;
  bot: boolean;
}

export interface TeamPublic {
  id: string;
  members: TeamMemberPublic[];
}

export interface CoverEntry {
  teamId: string;
  helperId: string;
  helperName: string;
  helperTier: ReputationTier;
  absenteeId: string;
  absenteeName: string;
  absenteeTier: ReputationTier;
  decided: boolean;
  choice?: CoverChoice;
}

export interface CoverReview {
  teamId: string;
  helperId: string;
  helperName: string;
  absenteeId: string;
  absenteeName: string;
  choice: CoverChoice;
  caught: boolean;
  helperDelta: number;
  absenteeDelta: number;
  helperAfter: number;
  absenteeAfter: number;
}

export interface CoverSummary {
  q: number;
  qBase: number;
  called: boolean;
  calledBy: CalledBy;
  roll: number | null;
  eligibleCount: number;
  decidedCount: number;
  revealed: boolean;
  entries: CoverEntry[];
  reviews: CoverReview[];
  endsAt: number | null;
}

export interface CoverPersonal {
  teamId: string;
  role: 'helper' | 'absentee';
  partnerId: string;
  partnerName: string;
  partnerTier: ReputationTier;
  submitted: boolean;
  revealed: boolean;
  choice?: CoverChoice;
  partnerChoice?: CoverChoice;
  outcome?: CoverOutcome;
  reputationDelta?: number;
  partnerReputationDelta?: number;
  reputationAfter?: number;
  coverSuccessCount?: number;
}

export interface PassInfo {
  allowed: boolean;
  p: number;
}

export interface PassDraw {
  round: number;
  action: Action;
  p: number;
}

export interface LastResult {
  round: number;
  lecture?: number;
  action: Action;
  called: boolean;
  payoff: number;
  q: number;
  attendanceRate: number;
  skipRate: number;
  mode: Mode;
  rankAfter?: number;
  scoreAfter?: number;
  cover?: CoverPersonal;
}

export interface PlayerPrivate {
  id: string;
  name: string;
  score: number;
  rank: number;
  connected: boolean;
  active: boolean;
  waiting: boolean;
  role: Role | null;
  action: Action | null;
  submitted: boolean;
  reputation: number;
  reputationTier: ReputationTier;
  team: TeamPublic | null;
  lectureResults: LastResult[];
  cover: CoverPersonal | null;
  lastResult: LastResult | null;
  pass: PassInfo | null;
  passDraw: PassDraw | null;
}

export interface PureProfile {
  L: Action;
  H: Action;
  q: number;
  attendance: number;
  key: string;
}

export interface Mixing {
  L: { skip: number; attend: number };
  H: { skip: number; attend: number };
  q: number;
}

export interface Theory {
  state:
    | 'ALL_ATTEND'
    | 'ALL_SKIP'
    | 'L_ATTEND_H_SKIP'
    | 'L_SKIP_H_ATTEND'
    | 'MULTIPLE'
    | 'NO_PURE'
    | 'MIXED_L'
    | 'MIXED_H';
  label: string;
  detail: string;
  pure: PureProfile[];
  profileText: string[];
  mixing: Mixing | null;
  qHigh: number | null;
  thresholds: { L: number; H: number };
  h: number;
  sampleSize?: number;
  dealMode?: DealMode;
  nH?: number;
  nL?: number;
}

export interface Result {
  round: number;
  gameMode: GameMode;
  lecture: number;
  mode: Mode;
  settings: Settings;
  participantCount: number;
  attendance: number;
  skip: number;
  attendanceRate: number;
  skipRate: number;
  q: number;
  qHigh: number | null;
  calledBy: 'fixed' | 'threshold' | 'prob';
  called: boolean;
  roll: number | null;
  autoLocked: boolean;
  qBase: number;
  firstCalled: boolean | null;
  cover: CoverSummary | null;
  typeCounts: Record<RoleType, number>;
  actionCounts: Record<RoleType, Record<Action, number>>;
  avgPayoff: number;
  theory: Theory;
  lockedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  top: Array<{ name: string; score: number }>;
}

export interface HistoryEntry {
  round: number;
  gameMode?: GameMode;
  lecture?: number;
  mode: Mode;
  dealMode?: DealMode;
  participantCount: number;
  attendanceRate: number;
  skipRate: number;
  q: number;
  called: boolean;
  avgPayoff: number;
  h: number;
  tau: number;
  mood: number;
  typeCounts?: Record<RoleType, number>;
  actionCounts?: Record<RoleType, Record<Action, number>>;
}

export interface PublicRoom {
  code: string;
  gameMode: GameMode;
  nextGameMode: GameMode | null;
  status: RoomStatus;
  round: number;
  lecture: number;
  settings: Settings;
  createdAt: number;
  serverNow: number;
  startedAt: number | null;
  endsAt: number | null;
  playerCount: number;
  onlineCount: number;
  participantCount: number;
  waitingCount: number;
  submittedCount: number;
  players: PlayerPublic[];
  teams: TeamPublic[];
  cover: CoverSummary | null;
  lectureResults: Result[];
  reputationBoard: ReputationEntry[] | null;
  leaderboard: LeaderboardEntry[] | null;
  result: Result | null;
  history: HistoryEntry[];
  final: boolean;
}

export interface HostState extends PublicRoom {
  pin: string;
  theory: Theory;
  leaderboardAll: LeaderboardEntry[];
}

export interface PlayerState {
  room: PublicRoom;
  me: PlayerPrivate;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'good' | 'error';
}
