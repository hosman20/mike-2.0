"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/app/lib/mikeApi";

// Mike 2.1 signup page.
// Mirrors the login layout: 460px card, hairline border, no shadow, ink-pill
// primary CTA. Organisation is required because Mike 2.0 is a B2B legal-AI
// product — every account belongs to a firm.
// Source reference: Pencil node `V3Q1xu` (AUTH · 02 SIGN UP).
export default function SignupPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!authLoading && isAuthenticated && !success) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router, success]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data.session) {
                const trimmedName = name.trim();
                const trimmedOrg = organisation.trim();
                if (trimmedName || trimmedOrg) {
                    try {
                        await updateUserProfile({
                            ...(trimmedName && { displayName: trimmedName }),
                            ...(trimmedOrg && { organisation: trimmedOrg }),
                        });
                    } catch (profileError) {
                        console.error(
                            "[signup] failed to persist profile fields",
                            profileError,
                        );
                    }
                }
            }
            setSuccess(true);
            setTimeout(() => {
                router.push("/assistant");
            }, 2000);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An error occurred during signup",
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-dvh bg-bg-canvas flex items-start justify-center px-6 pt-24 md:pt-32 pb-10 relative">
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" asLink />
                </div>
                <div className="w-full max-w-[460px]">
                    <div className="bg-surface border border-border rounded-xl p-10 text-center">
                        <div className="mx-auto w-12 h-12 bg-green-soft rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="h-6 w-6 text-green" />
                        </div>
                        <h2 className="text-base font-semibold text-foreground mb-2 tracking-tight">
                            Your firm workspace is ready
                        </h2>
                        <p className="text-xs text-text-muted">
                            Taking you to your assistant…
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-bg-canvas flex items-start justify-center px-6 pt-24 md:pt-32 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" asLink />
            </div>
            <div className="w-full max-w-[460px]">
                <div className="bg-surface border border-border rounded-xl p-8">
                    <div className="flex flex-col gap-1 mb-6">
                        <h2 className="text-base font-semibold text-foreground tracking-tight">
                            Create a firm workspace
                        </h2>
                        <p className="text-xs text-text-muted">
                            Set up Mike for your practice in under a minute
                        </p>
                    </div>

                    <form
                        onSubmit={handleSignup}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="organisation"
                                className="text-[11px] font-medium text-text-secondary"
                            >
                                Firm name
                            </label>
                            <Input
                                id="organisation"
                                type="text"
                                value={organisation}
                                onChange={(e) =>
                                    setOrganisation(e.target.value)
                                }
                                placeholder="e.g. Al Tamimi & Company"
                                required
                                autoComplete="organization"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="name"
                                className="text-[11px] font-medium text-text-secondary"
                            >
                                Your name{" "}
                                <span className="text-text-dim font-normal">
                                    (optional)
                                </span>
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Sara Haddad"
                                autoComplete="name"
                            />
                        </div>

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
                                placeholder="Create a password (min. 6 characters)"
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="confirmPassword"
                                className="text-[11px] font-medium text-text-secondary"
                            >
                                Confirm password
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm your password"
                                required
                                autoComplete="new-password"
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
                            {loading ? "Creating workspace…" : "Start free trial"}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-[11px] text-text-muted">
                        14-day free trial · no card required
                    </p>

                    <p className="mt-3 text-center text-[11px] text-text-muted leading-relaxed">
                        By creating an account you agree to our{" "}
                        <Link
                            href="/terms"
                            className="text-foreground font-medium hover:underline underline-offset-2"
                        >
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="/privacy"
                            className="text-foreground font-medium hover:underline underline-offset-2"
                        >
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>

                <p className="mt-4 text-center text-xs text-text-muted">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-medium text-foreground hover:underline underline-offset-2"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
