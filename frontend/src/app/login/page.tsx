"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";

// Mike 2.1 login page.
// Visual language: warm-paper canvas (`bg-bg-canvas`), centered 460px card with
// hairline `border-border` (no shadow), 12-px label / 14-px input copy, primary
// CTA renders as the signature ink-pill via Button's `default` variant.
// Source reference: Pencil node `gtQ5F` (AUTH · 01 SIGN IN).
export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.push("/assistant");
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An error occurred during login",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-bg-canvas flex items-start justify-center px-6 pt-24 md:pt-32 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" asLink />
            </div>
            <div className="w-full max-w-[460px]">
                <div className="bg-surface border border-border rounded-xl p-8">
                    <div className="flex flex-col gap-1 mb-6">
                        <h2 className="text-base font-semibold text-foreground tracking-tight">
                            Sign in to your firm
                        </h2>
                        <p className="text-xs text-text-muted">
                            Use your firm credentials to continue
                        </p>
                    </div>

                    <form
                        onSubmit={handleLogin}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="email"
                                className="text-[11px] font-medium text-text-secondary"
                            >
                                Work email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@firm.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="password"
                                className="text-[11px] font-medium text-text-secondary"
                            >
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="text-xs text-rose bg-rose-soft border border-rose/20 px-3 py-2 rounded-sm"
                            >
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2"
                        >
                            {loading ? "Signing in…" : "Sign in"}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-[11px] text-text-muted">
                        14-day free trial · no card required
                    </p>
                </div>

                <p className="mt-4 text-center text-xs text-text-muted">
                    Don&apos;t have an account?{" "}
                    <Link
                        href="/signup"
                        className="font-medium text-foreground hover:underline underline-offset-2"
                    >
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
