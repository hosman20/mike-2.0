/**
 * Project / document access helpers — ported verbatim from
 * `backend/src/lib/access.ts`.
 *
 * Critically preserves the IDOR fix from commit `e261d2e`
 * (`filterAccessibleDocumentIds`) and the JSONB `shared_with` filter
 * shape from commit `625bca4` (`.filter("shared_with", "cs",
 * JSON.stringify([userEmail]))`).
 *
 * Sharing makes the previous "scope by user_id" pattern incorrect — a
 * doc can belong to user A's project that A has shared with user B's
 * email, and B must still be able to read/edit it. These helpers
 * centralize the "owner OR shared project member" check so every route
 * uses the same logic instead of re-implementing the join.
 *
 * Each helper takes a `SupabaseClient` arg so callers pass in their own
 * (avoids module-level singletons that bind tests to the global env).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectAccess =
    | {
          ok: true;
          isOwner: boolean;
          project: {
              id: string;
              user_id: string;
              shared_with: string[] | null;
          };
      }
    | { ok: false };

export async function checkProjectAccess(
    projectId: string,
    userId: string,
    userEmail: string | null | undefined,
    db: SupabaseClient,
): Promise<ProjectAccess> {
    const { data: project } = await db
        .from("projects")
        .select("id, user_id, shared_with")
        .eq("id", projectId)
        .single();
    if (!project) return { ok: false };
    const proj = project as {
        id: string;
        user_id: string;
        shared_with: string[] | null;
    };
    if (proj.user_id === userId) {
        return { ok: true, isOwner: true, project: proj };
    }
    const sharedWith = Array.isArray(proj.shared_with) ? proj.shared_with : [];
    const email = (userEmail ?? "").toLowerCase();
    if (
        email &&
        sharedWith.some((e) => (e ?? "").toLowerCase() === email)
    ) {
        return { ok: true, isOwner: false, project: proj };
    }
    return { ok: false };
}

/**
 * Check whether the current user can access a tabular review. A review
 * can be shared in two ways:
 *   1. Indirectly — `project_id` set, anyone with project access reads.
 *   2. Directly — `tabular_reviews.shared_with` is a per-review email
 *      list so standalone reviews (project_id null) can still be shared.
 * The owner (review.user_id) always has access.
 */
export async function ensureReviewAccess(
    review: {
        user_id: string;
        project_id: string | null;
        shared_with?: string[] | null;
    },
    userId: string,
    userEmail: string | null | undefined,
    db: SupabaseClient,
): Promise<{ ok: true; isOwner: boolean } | { ok: false }> {
    if (review.user_id === userId) return { ok: true, isOwner: true };
    const email = (userEmail ?? "").toLowerCase();
    if (email && Array.isArray(review.shared_with)) {
        if (review.shared_with.some((e) => (e ?? "").toLowerCase() === email)) {
            return { ok: true, isOwner: false };
        }
    }
    if (!review.project_id) return { ok: false };
    const access = await checkProjectAccess(
        review.project_id,
        userId,
        userEmail,
        db,
    );
    if (access.ok) return { ok: true, isOwner: false };
    return { ok: false };
}

/**
 * Filter user-supplied document IDs down to documents the caller can
 * actually read.
 *
 * Tabular review routes accept document IDs from request bodies. Without
 * this check, a caller with access to any review could attach arbitrary
 * document UUIDs and later cause /generate or /regenerate-cell to extract
 * those bytes (CWE-639 — fixed in commit e261d2e).
 */
export async function filterAccessibleDocumentIds(
    documentIds: string[],
    userId: string,
    userEmail: string | null | undefined,
    db: SupabaseClient,
): Promise<string[]> {
    if (documentIds.length === 0) return [];
    const { data: docs } = await db
        .from("documents")
        .select("id, user_id, project_id")
        .in("id", documentIds);
    const rows = (docs ?? []) as {
        id: string;
        user_id: string;
        project_id: string | null;
    }[];
    if (rows.length === 0) return [];

    const accessibleProjectIds = new Set(
        await listAccessibleProjectIds(userId, userEmail, db),
    );
    const allowed: string[] = [];
    for (const doc of rows) {
        if (doc.user_id === userId) {
            allowed.push(doc.id);
        } else if (
            doc.project_id &&
            accessibleProjectIds.has(doc.project_id)
        ) {
            allowed.push(doc.id);
        }
    }
    return allowed;
}

/**
 * Returns the set of project IDs the user can access — own projects plus
 * any project where their email is in `shared_with`. Used to scope chat
 * lists and similar collection queries.
 *
 * The `shared_with` filter uses `.filter("shared_with", "cs",
 * JSON.stringify([userEmail]))` — the JSONB-aware containment shape from
 * commit 625bca4. Do NOT regress to `.contains("shared_with", [...])`,
 * which generates a Postgres array-style operator that does not match
 * JSONB columns.
 */
export async function listAccessibleProjectIds(
    userId: string,
    userEmail: string | null | undefined,
    db: SupabaseClient,
): Promise<string[]> {
    const [{ data: own }, { data: shared }] = await Promise.all([
        db.from("projects").select("id").eq("user_id", userId),
        userEmail
            ? db
                  .from("projects")
                  .select("id")
                  .filter("shared_with", "cs", JSON.stringify([userEmail]))
                  .neq("user_id", userId)
            : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    const ids = new Set<string>();
    for (const p of (own ?? []) as { id: string }[]) ids.add(p.id);
    for (const p of (shared ?? []) as { id: string }[]) ids.add(p.id);
    return [...ids];
}
