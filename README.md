# Booth Map

Career fair booth assignment tool. Import companies from a spreadsheet, drag them onto an interactive floor map, and export finalized assignments.

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your Supabase credentials (see `.env.example`).

3. Run the Prisma migration:
   ```bash
   npx prisma db push
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

## Useful Prisma Commands

- Opens a browser tab where you can see all your tables, add/delete rows, and filter data without writing any SQL.
   ```bash
   npx prisma studio
   ```

- When you run this, Prisma compares your schema to the database and generates a .sql file in a prisma/migrations folder. This folder then holds SQL files that show exactly how the database changed over time, that way a teammate can pull your code and run npx prisma migrate dev to get their local database updated with the exact same SQL steps you took.
   ```bash
   npx prisma migrate dev --name {change name}
   ```

- Use this for development/prototyping. It syncs your schema with the database immediately, but does not keep track of history.
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
