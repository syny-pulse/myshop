# Shop Books

Stock, sales and expenses for a beddings and clothings shop.

Two sides, one app:

- **Owner** signs in with a password. Creates categories, records what she bought on a
  shopping day, records sales and expenses, and sees a dashboard of sales, profit or
  loss, and stock value over any period.
- **Attendants** open a personal link. They see what is in stock and its proposed
  selling price, and can record sales and expenses. **Cost price and profit are never
  sent to this side.**

---

## The three environment variables

Whichever way you run it, the app needs exactly these:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | The Neon Postgres connection string |
| `OWNER_PASSWORD` | The password the owner types to sign in |
| `SESSION_SECRET` | A long random string used to sign session cookies |

Generate the session secret once and keep it. Changing it later signs everyone out,
including attendants holding a working link:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Deploying to Vercel

### 1. Put the code on GitHub

```bash
git init
git add .
git commit -m "Shop Books"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Import the project

Go to [vercel.com/new](https://vercel.com/new), pick the repository, and click **Deploy**.

This first deployment will build successfully but the pages will error when opened, because
there is no database yet. That is expected. The next step fixes it.

### 3. Create the database

1. Open the project in the Vercel dashboard.
2. Go to the **Storage** tab.
3. Click **Create Database**.
4. Choose **Neon** (listed as Serverless Postgres, under the Marketplace providers).
5. Accept the provider terms and choose the **Free** plan.
6. Pick a **region**. Choose the one closest to the shop. For Uganda that is
   **Frankfurt (`eu-central-1`)**, with London (`eu-west-2`) as the next best. A distant
   region adds a delay to every page load.
7. Give the database a name, for example `shop-books`.
8. Click **Create**, then **Connect** it to the project when prompted, leaving all three
   environments (Production, Preview, Development) ticked.

Vercel now writes the connection details into the project's environment variables for you.

### 4. Check what the variable is actually called

This is the one step people skip and then get a build that cannot find the database.

Go to **Settings** then **Environment Variables** and look for `DATABASE_URL`.

- **If `DATABASE_URL` is there**, you are done with this step.
- **If instead you see `POSTGRES_URL` or `DATABASE_URL_UNPOOLED`**, the integration used
  different names. Copy the value of the **pooled** one, then add a new variable named
  `DATABASE_URL` with that value.

Use the **pooled** connection string, the one whose host contains `-pooler`. This app runs
on serverless functions that open a connection per request, and the pooler is what keeps
that from exhausting Neon's connection limit.

### 5. Add the two secrets

Still under **Settings** then **Environment Variables**, add:

| Name | Value |
|---|---|
| `OWNER_PASSWORD` | The password Sarah will type to sign in |
| `SESSION_SECRET` | The random string generated above |

Tick all three environments for each.

### 6. Create the tables

The database exists but is empty. Two ways to build the schema:

**Using the Neon SQL editor**, which needs nothing installed:

1. In Vercel, open the **Storage** tab and click through to the Neon dashboard.
2. Open the **SQL Editor**.
3. Paste the entire contents of [`drizzle/0000_init.sql`](drizzle/0000_init.sql) and run it.

**Or from your machine**, which is easier to repeat later:

```bash
npm i -g vercel
vercel link            # connect this folder to the Vercel project
vercel env pull .env.local
npm install
npm run db:push
```

`vercel env pull` writes the real connection string into `.env.local`, so `db:push` acts on
the production database. `.env.local` is gitignored.

> If `db:push` hangs or times out, swap `DATABASE_URL` in `.env.local` for the **unpooled**
> connection string, the one without `-pooler`. Schema migrations want a direct connection.
> Leave the pooled one in Vercel for the app itself.

### 7. Redeploy

Environment variables are baked in at build time, so the deployment from step 2 still knows
nothing about them. Go to the **Deployments** tab, open the most recent one, and choose
**Redeploy**.

Open the site, sign in with `OWNER_PASSWORD`, and you should land on the dashboard.

### 8. First real setup

1. Go to **Categories** and add the ones the shop uses: carpets, curtains, bedsheets,
   blankets.
2. Go to **Stock** and record a batch from the last shopping trip.
3. Go to **Attendants**, create a link per attendant, and send each person their own.

---

## Running locally

```bash
cp .env.example .env.local
```

Fill in the three variables. For `DATABASE_URL`, either run `vercel env pull .env.local` to
reuse the deployed database, or create a separate free one at
[neon.tech](https://neon.tech) so development data stays out of the real books.

```bash
npm install
npm run db:push
npm run dev
```

Open <http://localhost:3000> and sign in with `OWNER_PASSWORD`.

To load a week of sample activity so the dashboard has something to show:

```bash
npm run db:seed
```

It refuses to run if the database already has categories, so it cannot overwrite real
books. It prints an attendant link at the end that you can open to check the attendant
side.

---

## How it is built

```
Next.js 15 App Router
  Server Components read from the database directly
  Server Actions handle every mutation (there is no API layer)
  Tailwind v4 for styling
  Drizzle ORM  ->  Neon Postgres
```

Auth is two signed cookies and no users table. The owner's cookie comes from the
password; an attendant's comes from exchanging their link token once at `/a/<token>`.

### Things that are the way they are on purpose

**Money is stored as integer shillings.** UGX has no subunit in practice, so integers
avoid floating-point drift entirely. It becomes a string exactly once, in
`lib/format.ts`.

**`sales.unit_cost` is a snapshot, not a join.** The cost is copied onto the sale row at
the moment of sale. If a typo in a batch's cost price is corrected later, last month's
profit does not silently change.

**"Today" is always computed in Africa/Kampala.** The server runs in UTC and Kampala is
UTC+3, so a naive `toISOString()` files sales made before 03:00 under the previous day.
Everything goes through `todayInKampala()` in `lib/dates.ts`.

**The cost-price boundary lives in the SQL, not the templates.** Functions in
`lib/queries.ts` marked `ATTENDANT-SAFE` never put `costPrice`, `unitCost` or a profit
expression into a select list. A template that merely declines to render a field would
still ship it in the RSC payload, where it is readable from devtools. If you add a field
to one of those functions, re-check that rule.

**Every Server Action calls `requireOwner()` or `requireUser()` first.** Layout guards
protect pages, not actions. A Server Action is a POST endpoint that any signed-in client
can invoke directly, so hiding a button is not access control.

**Stock value is point-in-time.** It answers "what am I holding right now", so it
deliberately ignores the dashboard's date range and is labelled "as of today".

**Selling below the minimum warns but never blocks.** Haggling is normal in this trade.
The sale is flagged instead, and flagged sales are called out on the dashboard.

**Recording a sale is one atomic conditional UPDATE.** `WHERE qty_remaining >= n` is what
stops two attendants selling the same last blanket at once; a read-then-write would let
both through.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run locally |
| `npm run build` | Production build |
| `npm run typecheck` | Types only |
| `npm run test:logic` | Date and money regression checks, no database needed |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:seed` | Load sample data into an empty database |
| `npm run db:studio` | Browse the data in a GUI |
