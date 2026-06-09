import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/", (_req, res) => {
  res.json({ name: "Halgo Cash API", version: "1.0.0", status: "running" });
});

// Clerk config diagnostic — shows which env vars are present (no secret values)
router.get("/debug-clerk", (_req, res) => {
  const pubKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  res.json({
    CLERK_PUBLISHABLE_KEY: pubKey ? `${pubKey.slice(0, 12)}…` : "MISSING",
    VITE_CLERK_PUBLISHABLE_KEY: (process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "MISSING").slice(0, 12) + "…",
    CLERK_SECRET_KEY: secretKey ? "set" : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
    proxyPath: "/api/__clerk",
  });
});

export default router;
