# TicketBox Frontend

React + TypeScript + Vite frontend for the TicketBox ticket selling platform.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Axios** - HTTP client
- **Keycloak-js** - Authentication

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── api/              # API clients and services
├── components/       # Reusable components
│   ├── Layout/
│   ├── Event/
│   ├── Chat/
│   └── common/
├── pages/            # Page components
│   ├── Home/
│   ├── Events/
│   ├── EventDetail/
│   ├── Checkout/
│   ├── MyTickets/
│   ├── Organizer/
│   └── Auth/
├── hooks/            # Custom React hooks
├── context/          # React Context providers
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── App.tsx           # Main app component
└── main.tsx          # Entry point
```

## Environment Variables

Create a `.env` file at the repository root (not inside `frontend/`):

```env
VITE_API_GATEWAY_URL=http://localhost:8080
VITE_KEYCLOAK_URL=http://13.239.118.235:9090
VITE_KEYCLOAK_REALM=flash-ticket
VITE_KEYCLOAK_CLIENT_ID=flash-ticket-frontend
```

`frontend/vite.config.ts` reads env values from the repo root, so the same `.env` file can be shared with backend services and `docker-compose`.
