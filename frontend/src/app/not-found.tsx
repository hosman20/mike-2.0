import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-bg-canvas flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <h1 className="text-3xl font-sans font-medium text-foreground mb-3">
                    Page not found
                </h1>
                <p className="text-[0.9375rem] text-muted-foreground leading-relaxed mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or may
                    have been moved.
                </p>

                <Button asChild>
                    <Link href="/">Go home</Link>
                </Button>
            </div>
        </div>
    );
}
