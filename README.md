## Maphy

Maphy is a math + physics olympiad problem platform inspired by Kilonova and pbinfo.

- **Stack**: Next.js (App Router) + Tailwind, PostgreSQL, Prisma, JWT auth
- **Features**: problems list/detail, image submissions (local storage), leaderboards, profiles, follow system, basic rate limiting

## Getting Started

### 1) Install deps

```bash
npm i
```

### 2) Start Postgres (local)

If you have Docker:

```bash
docker compose up -d
```

Then copy env vars:

```bash
copy .env.example .env
```

### 3) Migrate + seed

```bash
npm run prisma:migrate
npm run db:seed
```

### 4) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- **JWT session cookie**: httpOnly cookie `maphy_session` (30 days).
- **Uploads**: stored in `public/uploads/...` (easy to replace with S3/R2 later via `src/lib/storage/*`).
- **Rate limit**: submissions limited to 5 / 15 minutes per user (in-memory dev limiter in `src/lib/rate-limit.ts`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
