# Tetris

Career fair booth assignment tool. Import companies from a spreadsheet, drag them onto an interactive floor map, and export finalized assignments.

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your Supabase credentials (see `.env.example`).

3. Apply the database migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Generate the Prisma Client for your machine
   ```bash
   npx prisma generate
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

## Database migrations

Schema changes live in `prisma/migrations` and are applied by `prisma migrate deploy`,
which runs automatically as part of `npm run build`.

**Adding a change:** edit `prisma/schema.prisma`, then add a numbered folder under
`prisma/migrations` with a `migration.sql` holding the SQL. Keep the numbering
sequential — if someone else lands a migration with your number first, renumber yours.

**Pointing at a database that predates migrations:** a database built with `db push`
has no record of what it already ran, so `migrate deploy` will try to replay
migrations against tables that already exist and fail. Mark the ones already
reflected in that database as applied first:

```bash
npx prisma migrate status                        # see what it thinks is pending
npx prisma migrate resolve --applied <folder>    # once per already-applied migration
```

Then `migrate status` should report "Database schema is up to date!".

## Useful Prisma Commands

- Reads your schema.prisma file and generates a type-safe Prisma Client tailored specifically to your database structure. **Required anytime schema.prisma changes.**  
   ```bash
   npx prisma generate
   ```

- Opens a browser tab where you can see all your tables, add/delete rows, and filter data without writing any SQL.
   ```bash
   npx prisma studio
   ```

- Compares your schema to the database and generates a .sql file in a timestamped folder inside the prisma/migrations folder. This folder then holds SQL files that show exactly how the database changed over time, which allows npx prisma migrate dev update the database according to the exact steps. 
   ```bash
   npx prisma migrate dev --name {change name}
   ```

- Applies any migration files the database hasn't run yet. This is what deploys use, and it only ever runs the SQL in `prisma/migrations` — it never drops anything it didn't create.
   ```bash
   npx prisma migrate deploy
   ```

- Syncs the schema straight to the database without recording history. **Avoid this on any shared database.** It rewrites the database to match your `schema.prisma` exactly, silently dropping any table or column your branch doesn't declare — including a teammate's work-in-progress schema.
   ```bash
   npx prisma db push
   ```

- Syncs your schema.prisma to match the actual database.
   ```bash
   npx prisma db pull
   ```

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- react-konva for the interactive map canvas
- Zustand for state management
- Prisma + Supabase (PostgreSQL + Auth)
- shadcn/ui components
