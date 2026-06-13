# Spreetail Deployment Guide

This guide covers deploying the Spreetail application to Vercel (Frontend & Serverless API) and Neon (PostgreSQL Database).

## 1. Database Setup (Neon)
1. Go to [Neon.tech](https://neon.tech/) and create a new account or log in.
2. Create a new project. Select the region closest to where you plan to deploy your Vercel app (e.g., `us-east-1`).
3. Once the database is provisioned, copy the **Connection String** from the dashboard.
   *(It should look like: `postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require`)*

## 2. Prepare the Codebase
Currently, the application is using `sqlite` in `prisma/schema.prisma`. We have updated this to `postgresql` to support Neon.

Because you are switching database providers:
1. Delete the existing `prisma/migrations` folder if you have one.
2. Delete the local `prisma/dev.db` file.
3. Update your `.env` file with the Neon `DATABASE_URL`.
4. Run `npx prisma db push` to push the schema to your new Neon database.

## 3. Deployment Setup (Vercel)
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and create a new project.
3. Import your Spreetail GitHub repository.
4. **Environment Variables**: In the deployment settings, add the following variables:
   - `DATABASE_URL` -> *(Paste your Neon connection string here)*
   - `JWT_SECRET` -> *(Generate a long, secure random string. e.g., run `openssl rand -base64 32` in terminal)*
   - `NEXT_PUBLIC_APP_URL` -> *(The production URL of your Vercel app, e.g., `https://spreetail.vercel.app`)*
5. **Build Command**: Leave as default (`next build`). Vercel automatically detects Next.js.
   *Note: Because `prisma` is installed, Vercel will automatically generate the Prisma Client during the build step.*
6. Click **Deploy**.

## 4. Post-Deployment Database Push
If you didn't push your database schema locally in Step 2, you can execute it via Vercel's build process by updating the `"build"` script in `package.json` to:
```json
"build": "prisma generate && prisma db push && next build"
```
*(Warning: `db push` is meant for prototyping. For a true production app, use `prisma migrate deploy` instead.)*

---

# Production Checklist

Before officially sharing your app, ensure the following are verified:

## Database & Data Integrity
- [ ] **Provider updated**: `prisma/schema.prisma` is set to `provider = "postgresql"`.
- [ ] **Connection Pooling**: Neon provides connection pooling (PgBouncer). Ensure your `DATABASE_URL` uses the pooled connection string (usually appending `?pgbouncer=true` or using the `-pooler` endpoint) if you experience Vercel serverless function connection limits.
- [ ] **Migrations**: Have you initialized Prisma migrations (`npx prisma migrate dev --name init`) and committed the `prisma/migrations` folder?

## Security
- [ ] **JWT Secret**: `JWT_SECRET` in Vercel is a strong, unique, and unpredictable string.
- [ ] **CORS / Socket.io**: The Socket.io CORS origin in `server.ts` uses `process.env.NEXT_PUBLIC_APP_URL` rather than `localhost:3000`.
- [ ] **HTTPS**: Vercel handles HTTPS automatically. Ensure cookies (if modified) have `Secure` set to true in production.

## Application Code
- [ ] **Type Checks**: Run `npm run lint` and `npx tsc --noEmit` locally to ensure no hidden TypeScript errors will break the Vercel build.
- [ ] **WebSockets**: Note that Vercel Serverless Functions *do not support persistent WebSockets*. The custom Express + Socket.io server (`server.ts`) is designed for long-running Node environments (like Render, Railway, or AWS EC2). 
  - **CRITICAL WARNING**: Deploying to Vercel will only deploy the Next.js routes, **not** the custom Socket.io server. If real-time features are required, you must deploy this repository to a platform that supports persistent containers (e.g., [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io)) using the `npm run start` command mapping to `npx tsx server.ts`.

## Performance
- [ ] **Server Components**: Ensure you haven't accidentally added `"use client"` to top-level layout pages, preserving the performance benefits of SSR.
- [ ] **Database Region**: Verify that your Vercel function region (e.g., `iad1`) matches your Neon database region (e.g., `us-east-1`) to minimize latency.
