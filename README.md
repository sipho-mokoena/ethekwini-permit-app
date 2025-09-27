# eThekwini Spaza Permit PWA

A lightweight progressive web application that lets spaza shop owners in eThekwini submit permit applications from their mobile phones. The app supports both a fully local development mode (IndexedDB) and a production mode backed by Appwrite.

## Features

- 📱 Responsive React 19 UI built with Vite and Tailwind CSS 4
- 🔐 Phone OTP login for applicants plus email/password login for administrators
- 🗂️ Application capture with document checklist and file uploads
- 🪪 Document management with upload progress and previews
- 📥 Admin dashboard for reviewing and approving submissions
- 💾 IndexedDB-powered local backend for offline-friendly development
- ☁️ Appwrite integration for auth, databases, storage, and team management
- ⚙️ Typed data layer with interchangeable backend implementations

## Tech Stack

- React 19 + Vite 6
- TypeScript strict mode
- TanStack Router & TanStack Query
- Tailwind CSS 4 + shadcn-inspired UI primitives
- Appwrite Web SDK (client) & Node SDK (provisioning)
- IndexedDB via `idb` for the local backend

## Prerequisites

- Node.js 20+
- pnpm 9+
- Appwrite instance (self-hosted or Cloud) for production mode

## Getting Started

```powershell
pnpm install
pnpm dev
```

The dev server runs on <http://localhost:5173>. By default the app boots in local mode using IndexedDB. Set `VITE_USE_LOCALDB=false` in your `.env` to target Appwrite.

### Environment Variables

Create a `.env` file based on `.env.example`:

```dotenv
VITE_USE_LOCALDB=true
VITE_APPWRITE_ENDPOINT=https://your-appwrite-endpoint.com/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_PROJECT_NAME=eThekwini Spaza Registration
APPWRITE_API_KEY=your-appwrite-api-key
```

- `VITE_*` variables are used in the browser bundle.
- `APPWRITE_API_KEY` is only used by the provisioning script and should have admin-level access.

### Switching Backends

| Mode              | How                                   | Notes |
|-------------------|----------------------------------------|-------|
| Local development | `VITE_USE_LOCALDB=true` (default)      | OTP code is always `123456`. Admin login uses `admin@local.test / adminpass`. |
| Appwrite          | `VITE_USE_LOCALDB=false` + valid creds | Uses Appwrite Phone OTP, storage uploads, database rules, and team-based admin access. |

## Provisioning Appwrite

Run the setup script once per project/tenant to create the database, collections, bucket, and admin team:

```powershell
pnpm appwrite:setup
```

The script requires the following permissions on the API key:

- Databases: read/write
- Storage: read/write
- Teams: read/write

After running:

1. Create an admin user in the Appwrite Console.
2. Add the user to the `admins` team.
3. Update any production `.env` files with the endpoint, project ID, and bucket name if you change defaults.

## Handy Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Build the production bundle |
| `pnpm preview` | Preview the production build |
| `pnpm lint` | Run ESLint on the React source files |
| `pnpm ts:check` | Type-check the whole project |
| `pnpm format` | Format code in `src/` using Biome |
| `pnpm appwrite:setup` | Provision Appwrite collections, bucket, and team |

## Testing the Flow

1. Run `pnpm dev`.
2. Visit `/login` and enter a South African phone number.
3. In local mode, use OTP `123456`; in Appwrite mode, read the code from your SMS provider.
4. Complete the document checklist and upload required files (images and PDFs supported up to 8 MB).
5. Submit the application and review it from `/dashboard` or `/admin/applications` if logged in as an admin.

## Troubleshooting

- **Storage uploads fail in Appwrite mode**: Ensure the bucket permissions allow the user and `admins` team to create/read files.
- **Phone OTP throttling**: The app enforces a 60-second cooldown client-side and relies on Appwrite server-side limits.
- **Running the provisioning script**: If you see `Cannot find module 'node-appwrite'`, reinstall dependencies with `pnpm install`.

Feel free to open issues or suggestions to improve the MVP! 🚀

