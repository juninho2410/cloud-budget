
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Coins } from "lucide-react";
import Link from "next/link"; // Import Link

export function AppHeader() {
    return (
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
             <SidebarTrigger className="md:hidden" />
             {/* Wrap the logo and title with a Link */}
             <Link href="/" className="flex items-center gap-2" aria-label="Go to homepage">
                <Coins className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold text-primary">CloudWise</h1>
             </Link>
            {/* Add other header elements here if needed, e.g., User Menu */}
        </header>
    );
}
