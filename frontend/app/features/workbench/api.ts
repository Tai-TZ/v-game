import * as v from "valibot";

import { API_BASE, ApiError, getJson } from "~/lib/api";

import { starterBench, type Bench, type Env } from "./bench";
import { fmt } from "./copy";
import {
  BLOCK_TYPES,
  BlocksResponseSchema,
  IssueSchema,
  PostRunResponseSchema,
  PublicLevelSchema,
  type BlockSpec,
  type BlockType,
  type Issue,
} from "./schema";

const SLUG = /^[a-z][a-z0-9-]{1,31}$/;

export type LevelPageData =
  | { kind: "ready"; zoneId: string; env: Env; starter: Bench }
  | { kind: "not-found"; zoneId: string | null }
  | { kind: "error"; zoneId: string | null };

/** Everything `/play/:zoneId/:levelId` can show, as data (§8.7). Never rejects. */
export async function loadLevelPage(
  zoneId: string | undefined,
  levelId: string | undefined,
): Promise<LevelPageData> {
  const zone = zoneId && SLUG.test(zoneId) ? zoneId : null;
  if (!zone || !levelId || !SLUG.test(levelId)) return { kind: "not-found", zoneId: zone };
  try {
    const [level, { blocks: list }] = await Promise.all([
      getJson(`/api/levels/${levelId}`, PublicLevelSchema),
      getJson("/api/blocks", BlocksResponseSchema),
    ]);
    if (level.zone !== zone) return { kind: "not-found", zoneId: zone };
    const byType = new Map(list.map((block) => [block.type, block]));
    if (!BLOCK_TYPES.every((type) => byType.has(type))) return { kind: "error", zoneId: zone };
    const env: Env = {
      level,
      blocks: Object.fromEntries(byType) as Record<BlockType, BlockSpec>,
    };
    const starter = starterBench(env);
    // A starter the bench cannot draw is a contract mismatch, not something to half-render.
    if (!starter) return { kind: "error", zoneId: zone };
    return { kind: "ready", zoneId: zone, env, starter };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return { kind: "not-found", zoneId: zone };
    return { kind: "error", zoneId: zone };
  }
}

/** 32 hex chars. `crypto.randomUUID` exists only in secure contexts (W9). */
export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface PostError {
  title: string;
  lines: string[];
  /** "Thử lại" resends the same body with the same key (W9). */
  retry: boolean;
  /** 404: link back to the level list. */
  backLink: boolean;
  /** 422 with the validator's issues: shown on the slots. */
  issues: Issue[] | null;
}

export type PostResult =
  { ok: true; runId: string; created: boolean; issues: Issue[] } | { ok: false; error: PostError };

const GENERIC = "Máy chủ đang gặp sự cố. Thử lại sau ít phút.";
const InvalidGraphSchema = v.looseObject({ detail: v.string(), issues: v.array(IssueSchema) });

function retryAfterSeconds(value: string | null | undefined, now: number): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((at - now) / 1000));
}

/**
 * What the aside shows for a failed `POST /api/runs` (§6.1). `status` 0 means fetch threw.
 * Pure, so every branch is unit-tested.
 */
export function describePostError(
  status: number,
  json: unknown,
  headers: Pick<Headers, "get"> | null,
  now = Date.now(),
): PostError {
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const detail = typeof body.detail === "string" ? body.detail : null;
  const box = (title: string, lines: string[], extra: Partial<PostError> = {}): PostError => ({
    title,
    lines,
    retry: false,
    backLink: false,
    issues: null,
    ...extra,
  });
  switch (status) {
    case 0:
      return box(
        "Không gửi được cấu hình",
        ["Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại."],
        { retry: true },
      );
    case 422: {
      const parsed = v.safeParse(InvalidGraphSchema, json);
      return parsed.success
        ? box(parsed.output.detail, [], { issues: parsed.output.issues })
        : box("Chưa mở ca được", [GENERIC]);
    }
    case 429: {
      const seconds = retryAfterSeconds(headers?.get("Retry-After"), now);
      if (seconds === null) {
        return box(
          "Máy chủ đang bận",
          [detail ?? "Đang có nhiều lượt chạy, bạn thử lại sau ít phút."],
          {
            retry: true,
          },
        );
      }
      // A daily quota resets hours away: "khoảng 5 giờ", not "khoảng 300 phút".
      const wait =
        seconds < 60
          ? `${seconds} giây`
          : seconds < 90 * 60
            ? `${Math.ceil(seconds / 60)} phút`
            : `${fmt(Math.round(seconds / 1800) / 2)} giờ`;
      return box(
        "Máy chủ đang bận",
        [detail ?? "Đang có nhiều lượt chạy.", `Bạn có thể thử lại sau khoảng ${wait}.`],
        { retry: true },
      );
    }
    case 503: {
      const lines = [detail ?? GENERIC];
      if (body.code === "rerank_unavailable") lines.push("Tháo Kính lúp thì vẫn mở ca được.");
      lines.push("Cấu hình của bạn vẫn được giữ trên máy này.");
      return box("Máy chủ chưa sẵn sàng chạy", lines, { retry: true });
    }
    case 409:
      return box("Chưa mở ca được", [detail ?? GENERIC]);
    case 404:
      return box("Chưa mở ca được", [detail ?? GENERIC], { backLink: true });
    case 415:
      return box("Chưa mở ca được", [GENERIC]);
    default:
      // 5xx, a gateway page (the API sleeps behind a proxy) or a broken body: the server may
      // have started the run, and the same key returns that run instead of a second one.
      return box("Chưa mở ca được", [GENERIC], { retry: true });
  }
}

/** `POST /api/runs?level=<id>` with the exact body and key (a retry reuses both). */
export async function postRun(levelId: string, body: string, key: string): Promise<PostResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/runs?level=${encodeURIComponent(levelId)}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body,
    });
  } catch {
    return { ok: false, error: describePostError(0, null, null) };
  }
  const json: unknown = await response.json().catch(() => null);
  if (response.status === 202 || response.status === 200) {
    const parsed = v.safeParse(PostRunResponseSchema, json);
    if (parsed.success) {
      return {
        ok: true,
        runId: parsed.output.run_id,
        created: parsed.output.created,
        issues: parsed.output.issues,
      };
    }
    return { ok: false, error: describePostError(-1, null, null) };
  }
  return { ok: false, error: describePostError(response.status, json, response.headers) };
}

/**
 * Never rejects. True when nothing is left running: 202 ends the stream with
 * run.failed{cancelled}; 404 (gone) and 409 (already over) need nothing.
 */
export function cancelRun(runId: string, options: { keepalive?: boolean } = {}): Promise<boolean> {
  return fetch(`${API_BASE}/api/runs/${runId}/cancel`, {
    method: "POST",
    keepalive: options.keepalive ?? false,
  }).then(
    (response) => response.ok || response.status === 404 || response.status === 409,
    () => false,
  );
}

export const eventsUrl = (runId: string) => `${API_BASE}/api/runs/${runId}/events`;
