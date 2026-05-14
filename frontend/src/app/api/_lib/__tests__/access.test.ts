import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    checkProjectAccess,
    ensureReviewAccess,
    filterAccessibleDocumentIds,
} from "../access";

/**
 * Tiny Supabase query-builder mock. Each `.from(table)` returns an object
 * matching the chained API surface used in `access.ts`. The chain is
 * thenable / has terminal methods (`.single()`, `.maybeSingle()`,
 * `.in()`, `.eq()`, `.filter()`, `.neq()`) that resolve to `{ data }`.
 *
 * For each table the test passes in a "responder" — a function called
 * with the recorded chain that returns the `{ data }` payload. This
 * keeps every test's mock state local and inspectable.
 */
type ChainCall = { method: string; args: unknown[] };
type Responder = (chain: ChainCall[]) => { data: unknown };

function makeDb(responders: Record<string, Responder>): SupabaseClient {
    function makeChain(table: string) {
        const calls: ChainCall[] = [];
        const resolve = () => responders[table]?.(calls) ?? { data: null };
        const handler: ProxyHandler<object> = {
            get(_t, prop: string) {
                if (prop === "then") {
                    // Make the chain awaitable as a terminal — some Supabase
                    // queries are awaited directly without .single() etc.
                    return (
                        onFulfilled: (v: { data: unknown }) => unknown,
                    ) => Promise.resolve(resolve()).then(onFulfilled);
                }
                return (...args: unknown[]) => {
                    calls.push({ method: prop, args });
                    if (
                        prop === "single" ||
                        prop === "maybeSingle"
                    ) {
                        return Promise.resolve(resolve());
                    }
                    return new Proxy({}, handler);
                };
            },
        };
        return new Proxy({}, handler);
    }
    return {
        from: (table: string) => makeChain(table),
    } as unknown as SupabaseClient;
}

describe("access helpers", () => {
    test("filterAccessibleDocumentIds drops doc IDs the user cannot access (CWE-639 regression — commit e261d2e)", async () => {
        // Setup:
        //   - doc-own:    owned by user-1 directly                → keep
        //   - doc-shared: owned by other, in project user-1 shares → keep
        //   - doc-foreign: owned by other, in project user-1 cannot see → DROP
        //   - doc-orphan:  owned by other, project_id = null      → DROP
        const db = makeDb({
            documents: () => ({
                data: [
                    {
                        id: "doc-own",
                        user_id: "user-1",
                        project_id: "proj-own",
                    },
                    {
                        id: "doc-shared",
                        user_id: "user-2",
                        project_id: "proj-shared",
                    },
                    {
                        id: "doc-foreign",
                        user_id: "user-2",
                        project_id: "proj-foreign",
                    },
                    {
                        id: "doc-orphan",
                        user_id: "user-2",
                        project_id: null,
                    },
                ],
            }),
            projects: (chain) => {
                // listAccessibleProjectIds runs two queries in parallel:
                //   1. own projects: .select('id').eq('user_id', userId)
                //   2. shared projects: .select('id').filter(...).neq(...)
                const isOwn = chain.some(
                    (c) => c.method === "eq" && c.args[0] === "user_id",
                );
                if (isOwn) return { data: [{ id: "proj-own" }] };
                return { data: [{ id: "proj-shared" }] };
            },
        });

        const out = await filterAccessibleDocumentIds(
            ["doc-own", "doc-shared", "doc-foreign", "doc-orphan"],
            "user-1",
            "user1@example.com",
            db,
        );
        expect(out.sort()).toEqual(["doc-own", "doc-shared"]);
    });

    test("ensureReviewAccess returns ok:false for cross-tenant review (no project, not in shared_with)", async () => {
        // Standalone review (project_id null) owned by user-2, shared with
        // a third party but NOT user-1. user-1 must be denied — the lack
        // of a project_id means there's no indirect path either.
        const db = makeDb({}); // no DB calls expected
        const result = await ensureReviewAccess(
            {
                user_id: "user-2",
                project_id: null,
                shared_with: ["someone-else@example.com"],
            },
            "user-1",
            "user1@example.com",
            db,
        );
        expect(result).toEqual({ ok: false });
    });

    test("checkProjectAccess honors JSONB shared_with shape (commit 625bca4)", async () => {
        // Project owned by user-2; user-1 (user1@example.com) is in the
        // shared_with list. Helper must recognise the case-insensitive
        // email match and return ok:true with isOwner:false. This exercises
        // the JSONB-aware containment shape preserved from commit 625bca4
        // — the helper compares the array members directly, NOT via the
        // `.contains()` operator.
        const db = makeDb({
            projects: () => ({
                data: {
                    id: "proj-1",
                    user_id: "user-2",
                    // Mixed-case to verify the lowercase comparison.
                    shared_with: ["User1@Example.com"],
                },
            }),
        });
        const result = await checkProjectAccess(
            "proj-1",
            "user-1",
            "user1@example.com",
            db,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.isOwner).toBe(false);
            expect(result.project.id).toBe("proj-1");
        }
    });

    test("filterAccessibleDocumentIds short-circuits on empty input", async () => {
        const db = makeDb({});
        const spy = vi.spyOn(db, "from");
        const out = await filterAccessibleDocumentIds(
            [],
            "user-1",
            "user1@example.com",
            db,
        );
        expect(out).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
    });
});
