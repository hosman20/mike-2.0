"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { DEV_STUB_USER, isDevAuthBypass } from "@/lib/devAuth";

interface User {
    id: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Stable value reused on every render so consumers don't see referential
// churn while the bypass is on.
const DEV_BYPASS_VALUE: AuthContextType = {
    user: { id: DEV_STUB_USER.id, email: DEV_STUB_USER.email },
    isAuthenticated: true,
    authLoading: false,
    signOut: async () => {
        // eslint-disable-next-line no-console
        console.log("[devAuth] signOut() is a no-op in dev bypass mode");
    },
};

export function AuthProvider({ children }: { children: ReactNode }) {
    // Dev-only bypass: short-circuit before any Supabase wiring runs. Hard
    // gated by NODE_ENV !== 'production' inside `isDevAuthBypass`.
    if (isDevAuthBypass) {
        return (
            <AuthContext.Provider value={DEV_BYPASS_VALUE}>
                {children}
            </AuthContext.Provider>
        );
    }

    return <RealAuthProvider>{children}</RealAuthProvider>;
}

function RealAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || "",
                });
            }
            setAuthLoading(false);
        };

        checkUser();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || "",
                });
            } else {
                setUser(null);
            }
            setAuthLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                authLoading,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
