/**
 * Load .env.local (and other .env*) into process.env before any app code runs.
 * Import this first in scripts that run outside Next.js (e.g. worker.ts).
 */
import { loadEnvConfig } from "@next/env"

loadEnvConfig(process.cwd())
