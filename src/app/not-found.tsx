"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconMapSearch, IconArrowLeft, IconHome } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-md w-full">

        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-nexus-card border border-nexus-border flex items-center justify-center shadow-2xl">
              <IconMapSearch size={52} className="text-nexus-muted" />
            </div>
            {/* 404 badge */}
            <span className="absolute -top-2 -right-2 bg-nexus-primary text-nexus-bg text-xs font-black px-2 py-0.5 rounded-full shadow-lg">
              404
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-nexus-text tracking-tight">
            Page Not Found
          </h1>
          <p className="text-nexus-muted text-sm leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            <br />
            Check the URL or head back to your dashboard.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-2.5 bg-nexus-primary text-nexus-bg text-sm font-bold rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20 w-full sm:w-auto justify-center"
          >
            <IconHome size={16} />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-2.5 bg-nexus-card border border-nexus-border text-nexus-text text-sm font-semibold rounded-lg hover:bg-nexus-hover transition-colors w-full sm:w-auto justify-center"
          >
            <IconArrowLeft size={16} />
            Go Back
          </button>
        </div>

      </div>
    </div>
  );
}
