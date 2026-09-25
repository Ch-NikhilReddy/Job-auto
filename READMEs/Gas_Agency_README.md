# Gas Agency Management System — Online Booking Platform

> MERN-based gas booking system with JWT auth, role-based access, and automated notifications.

**Live Demo:** `Add your Vercel/Render link here` | **GitHub:** `github.com/Ch-NikhilReddy/Gas-Agency`

![MERN](https://img.shields.io/badge/Stack-MERN%20%7C%20JWT%20%7C%20RBAC-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green)
![Database](https://img.shields.io/badge/Database-MongoDB-brightgreen)

### Problem
Traditional gas booking relies on phone calls, causing delays, no booking history, and manual tracking for agencies. Customers need on-demand booking with payment and status updates.

### Solution
A full-stack platform where customers can register, book gas barrels on demand, choose payment options, and receive email updates — while admins manage bookings and inventory via dashboard.

### Key Features
- **JWT Authentication & RBAC** — User and Admin roles with protected routes
- **Booking Workflow** — Book gas barrels on demand, view booking history and status (`pending → confirmed → delivered`)
- **Payment Options** — Cash on Delivery + online payment placeholder
- **Email Notifications** — Automated emails on booking confirmation/status change (Nodemailer)
- **Admin Dashboard** — View all bookings, update status, manage inventory/users
- **Responsive UI** — React + Bootstrap, mobile-friendly

### Tech Stack
**Frontend:** React.js, React Router, Axios, Bootstrap, HTML5/CSS3
**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt
**Tools:** Postman, Git/GitHub, Vercel/Render, Nodemailer

### Architecture
```
Client (React) → REST API (Express + JWT) → MongoDB
  ├── /api/auth (register/login)
  ├── /api/bookings (create, list, update status)
  └── /api/admin (manage bookings/users)
```

### Screenshots
Add 2-3 screenshots:
- `screenshots/user-booking.png` — User booking form
- `screenshots/admin-dashboard.png` — Admin booking list
- `screenshots/email-notification.png` — Email confirmation

### Getting Started

**Prerequisites:** Node.js 18+, MongoDB (local or Atlas)

```bash
# 1. Clone
git clone https://github.com/Ch-NikhilReddy/Gas-Agency.git
cd Gas-Agency

# 2. Backend
cd server
npm install
# create .env -> MONGODB_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASS, PORT=5000
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
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=app_password
PORT=5000
```

### API Endpoints (Sample)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Register user |
| POST | /api/auth/login | Public | Login + JWT |
| POST | /api/bookings | User | Create gas booking |
| GET | /api/bookings/my | User | Get my bookings |
| GET | /api/bookings | Admin | Get all bookings |
| PATCH | /api/bookings/:id | Admin | Update booking status |

### What I Learned
- Designing MongoDB schemas for bookings, users, and agency inventory
- Implementing JWT + RBAC guards for MERN stack
- Integrating email service for booking workflows

### Future Improvements
- Online payment gateway (Razorpay/Stripe)
- Real-time booking tracking and delivery OTP
- Inventory management with stock alerts

---
**Author:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University | [LinkedIn](https://linkedin.com/in/ch-nikhil-reddy) | [Portfolio](https://nikhilreddy.dpdns.org)
