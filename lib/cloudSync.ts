import type { GameState, TeamBattleSnapshot } from "./game";

export type CloudSyncProvider = "local" | "supabase";

export type CloudSyncStatus = {
  provider: CloudSyncProvider;
  configured: boolean;
  label: string;
  detail: string;
};

export type BattleSnapshotPayload = {
  sync_code: string;
  owner_guest_id: string;
  owner_name: string;
  trader_level: number;
  base_attack: number;
  total_attack: number;
  team_bonus_name: string;
  team_bonus_multiplier: number;
  members: TeamBattleSnapshot["members"];
  updated_at: string;
};

export type PlayerProfilePayload = {
  guest_id: string;
  display_name: string;
  provider: GameState["accountProfile"]["provider"];
  trader_level: number;
  updated_at: string;
};

export type CloudSyncResult = {
  ok: boolean;
  skipped: boolean;
  message: string;
};

export type CloudSyncDiagnostics = CloudSyncResult & {
  provider: CloudSyncProvider;
  configured: boolean;
  leaderboardCount: number;
};

type BattleSnapshotRow = BattleSnapshotPayload & {
  created_at?: string;
};

const rawProvider = process.env.NEXT_PUBLIC_KABUMON_SYNC_PROVIDER;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getCloudSyncStatus(): CloudSyncStatus {
  const provider: CloudSyncProvider = rawProvider === "supabase" ? "supabase" : "local";

  if (provider === "supabase") {
    const configured = Boolean(supabaseUrl && supabaseAnonKey);
    return {
      provider,
      configured,
      label: configured ? "Supabase準備OK" : "Supabase未設定",
      detail: configured
        ? "環境変数は設定済みです。次に認証と書き込み処理を接続します。"
        : "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定するとクラウド同期へ進めます。"
    };
  }

  return {
    provider,
    configured: true,
    label: "ローカル保存",
    detail: "現在は端末内保存です。対戦用データ形式はクラウド移行できる形に揃えています。"
  };
}

export function buildBattleSnapshotPayload(snapshot: TeamBattleSnapshot): BattleSnapshotPayload {
  return {
    sync_code: snapshot.syncCode,
    owner_guest_id: snapshot.ownerGuestId,
    owner_name: snapshot.ownerName,
    trader_level: snapshot.traderLevel,
    base_attack: snapshot.baseAttack,
    total_attack: snapshot.totalAttack,
    team_bonus_name: snapshot.teamBonusName,
    team_bonus_multiplier: snapshot.teamBonusMultiplier,
    members: snapshot.members,
    updated_at: snapshot.createdAt
  };
}

export function buildPlayerProfilePayload(state: GameState): PlayerProfilePayload {
  return {
    guest_id: state.accountProfile.guestId,
    display_name: state.accountProfile.displayName,
    provider: state.accountProfile.provider,
    trader_level: state.traderLevel,
    updated_at: state.accountProfile.updatedAt
  };
}

export async function publishPlayerProfileToCloud(state: GameState): Promise<CloudSyncResult> {
  const status = getCloudSyncStatus();
  if (status.provider !== "supabase") {
    return {
      ok: true,
      skipped: true,
      message: "ローカル保存モードのためプロフィール同期はスキップしました。"
    };
  }

  if (!status.configured || !supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      skipped: true,
      message: "SupabaseのURLまたはanon keyが未設定です。"
    };
  }

  try {
    await upsertSupabaseRow("player_profiles", buildPlayerProfilePayload(state), "guest_id");

    return {
      ok: true,
      skipped: false,
      message: "Supabaseへプロフィールを同期しました。"
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message: error instanceof Error ? error.message : "プロフィール同期に失敗しました。"
    };
  }
}

export async function publishBattleSnapshotToCloud(
  state: GameState,
  snapshot: TeamBattleSnapshot
): Promise<CloudSyncResult> {
  const status = getCloudSyncStatus();
  if (status.provider !== "supabase") {
    return {
      ok: true,
      skipped: true,
      message: "ローカル保存モードのためクラウド送信はスキップしました。"
    };
  }

  if (!status.configured || !supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      skipped: true,
      message: "SupabaseのURLまたはanon keyが未設定です。"
    };
  }

  try {
    await upsertSupabaseRow("player_profiles", buildPlayerProfilePayload(state), "guest_id");
    await upsertSupabaseRow("battle_snapshots", buildBattleSnapshotPayload(snapshot), "sync_code");

    return {
      ok: true,
      skipped: false,
      message: "Supabaseへ対戦チームを同期しました。"
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message: error instanceof Error ? error.message : "Supabase同期に失敗しました。"
    };
  }
}

export async function fetchBattleSnapshotFromCloud(code: string): Promise<TeamBattleSnapshot | null> {
  const status = getCloudSyncStatus();
  if (status.provider !== "supabase" || !status.configured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const syncCode = normalizeSyncCode(code);
  if (!syncCode) return null;

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/battle_snapshots?sync_code=eq.${encodeURIComponent(syncCode)}&select=*`;
  const response = await fetch(endpoint, {
    headers: createSupabaseHeaders()
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json() as BattleSnapshotRow[];
  const row = rows[0];
  if (!row) return null;

  return battleSnapshotRowToSnapshot(row);
}

export async function fetchBattleSnapshotLeaderboard(limit = 20): Promise<TeamBattleSnapshot[]> {
  const status = getCloudSyncStatus();
  if (status.provider !== "supabase" || !status.configured || !supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/battle_snapshots?select=*&order=total_attack.desc&limit=${safeLimit}`;
  const response = await fetch(endpoint, {
    headers: createSupabaseHeaders()
  });

  if (!response.ok) {
    return [];
  }

  const rows = await response.json() as BattleSnapshotRow[];
  return rows.map(battleSnapshotRowToSnapshot);
}

export async function runCloudSyncDiagnostics(): Promise<CloudSyncDiagnostics> {
  const status = getCloudSyncStatus();
  if (status.provider !== "supabase") {
    return {
      ok: true,
      skipped: true,
      provider: status.provider,
      configured: status.configured,
      leaderboardCount: 0,
      message: "ローカル保存モードです。クラウド接続チェックは不要です。"
    };
  }

  if (!status.configured || !supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      skipped: true,
      provider: status.provider,
      configured: false,
      leaderboardCount: 0,
      message: "Supabase環境変数が未設定です。"
    };
  }

  try {
    const snapshots = await fetchBattleSnapshotLeaderboard(5);
    return {
      ok: true,
      skipped: false,
      provider: status.provider,
      configured: true,
      leaderboardCount: snapshots.length,
      message: `Supabase接続OK。ランキング${snapshots.length}件を取得しました。`
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      provider: status.provider,
      configured: true,
      leaderboardCount: 0,
      message: error instanceof Error ? error.message : "Supabase接続チェックに失敗しました。"
    };
  }
}

async function upsertSupabaseRow(tableName: string, payload: unknown, conflictTarget: string): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase設定が不足しています。");
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${tableName}?on_conflict=${conflictTarget}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...createSupabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `${tableName} の同期に失敗しました。`);
  }
}

function createSupabaseHeaders(): HeadersInit {
  return {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`
  };
}

function normalizeSyncCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return "";
  if (normalized.startsWith("KBM") && normalized.length >= 9) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 9)}`;
  }
  return code.trim().toUpperCase();
}

function battleSnapshotRowToSnapshot(row: BattleSnapshotRow): TeamBattleSnapshot {
  return {
    snapshotId: `team-${row.sync_code.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`,
    syncCode: row.sync_code,
    ownerGuestId: row.owner_guest_id,
    ownerName: row.owner_name,
    createdAt: row.updated_at || row.created_at || new Date().toISOString(),
    traderLevel: row.trader_level,
    teamBonusName: row.team_bonus_name,
    teamBonusMultiplier: Number(row.team_bonus_multiplier) || 1,
    baseAttack: row.base_attack,
    totalAttack: row.total_attack,
    members: Array.isArray(row.members) ? row.members : []
  };
}
