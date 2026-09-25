# Civic Issues Portal — Map-Based Complaint Platform

> **Hackathon Winner — MLRIT College** | Report, track, and resolve civic issues with geolocation.

**Live Demo:** `Add your Vercel/Render link here` | **GitHub:** `github.com/Ch-NikhilReddy/civic`

![React](https://img.shields.io/badge/Frontend-React%20%7C%20Tailwind%20%7C%20Leaflet-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20MongoDB-green)
![Auth](https://img.shields.io/badge/Auth-JWT%20%7C%20RBAC-orange)

### Problem
Citizens struggle to report civic issues (potholes, streetlights, garbage) with location proof, and have no visibility into resolution status. Admins and field workers lack a centralized tracking system.

### Solution
A full-stack civic portal with map-based reporting, 3-tier role access, and end-to-end status tracking from `pending → in-progress → resolved`.

### Key Features
- **Map-Based Reporting** — Leaflet integration for geolocated issue reporting with pin drop + address
- **3-Tier Role-Based Access** — User (report/view), Admin (assign/manage), Worker (update status)
- **JWT Authentication** — Secure login, protected routes, role guards
- **Status Tracking** — Lifecycle `pending → in-progress → resolved` with timestamped updates
- **Responsive UI** — Tailwind CSS, mobile-friendly reporting flow
- **Admin Dashboard** — View, filter, assign, and track all complaints

### Tech Stack
**Frontend:** React.js, Tailwind CSS, Leaflet (maps), Axios, React Router
**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt
**Tools:** Git, GitHub, Postman, Vercel/Render

### Architecture
```
Client (React + Leaflet) → REST API (Express + JWT) → MongoDB
  ├── /api/auth (login/register)
  ├── /api/issues (CRUD, geolocation, status)
  └── /api/users (roles)
```

### Screenshots
Add 2-3 screenshots here:
- `screenshots/map-report.png` — Map with issue pins
- `screenshots/dashboard.png` — Admin dashboard
- `screenshots/status-flow.png` — Status tracking

### Getting Started

**Prerequisites:** Node.js 18+, MongoDB (local or Atlas)

```bash
# 1. Clone
git clone https://github.com/Ch-NikhilReddy/civic.git
cd civic

# 2. Backend
cd server
npm install
# create .env -> MONGODB_URI, JWT_SECRET, PORT=5000
npm start

# 3. Frontend (new terminal)
cd ../client
npm install
npm run dev
```

**.env example (server/.env):**
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
PORT=5000
```

### API Endpoints (Sample)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Register user |
| POST | /api/auth/login | Public | Login + JWT |
| POST | /api/issues | User | Report issue with lat/lng |
| GET | /api/issues | All | List issues (filtered by role) |
| PATCH | /api/issues/:id/status | Admin/Worker | Update status |

### What I Learned
- Implementing Leaflet geolocation with React state management
- Designing 3-tier RBAC and status workflow at DB schema level
- Structuring JWT auth with protected frontend routes

### Future Improvements
- Image upload for issue proof (Cloudinary/S3)
- Real-time worker assignment notifications
- Analytics dashboard for admin (issues by area/status)

---
**Author:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University | [LinkedIn](https://linkedin.com/in/ch-nikhil-reddy) | [Portfolio](https://nikhilreddy.dpdns.org)
