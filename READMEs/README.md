# Student-Teacher Appointment Booking System — MERN Scheduling Platform

> Secure appointment scheduling connecting students and teachers with availability management and JWT auth.

**Live Demo:** `Add your Vercel/Render link here` | **GitHub:** `github.com/Ch-NikhilReddy/Student-Teacher`

![MERN](https://img.shields.io/badge/Stack-MERN%20%7C%20JWT-blue)
![Auth](https://img.shields.io/badge/Auth-JWT%20%7C%20RBAC-orange)

### Problem
Students waste time finding teachers for guidance, and teachers lack a structured way to manage availability and appointments. Manual scheduling via messages leads to conflicts and no tracking.

### Solution
A MERN platform where students browse teachers, check availability slots, book appointments, and track status — while teachers manage slots and approve/reject requests.

### Key Features
- **JWT Authentication & Roles** — Student and Teacher registration, login, protected routes
- **Teacher Availability** — Teachers set available time slots (date + time range)
- **Appointment Booking** — Students book slots, view `pending → approved → completed/cancelled` status
- **Role Dashboards** — Student (my bookings) + Teacher (requests, upcoming appointments)
- **RESTful APIs & MongoDB Models** — Users, slots, appointments with validation

### Tech Stack
**Frontend:** React.js, React Router, Axios, Bootstrap/Tailwind
**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt
**Tools:** Postman, Git/GitHub, Vercel/Render

### Architecture
```
Client (React) → REST API (Express + JWT) → MongoDB
  ├── /api/auth (register/login)
  ├── /api/teachers (list, availability)
  └── /api/appointments (book, list, update status)
```

### Screenshots
Add 2 screenshots:
- `screenshots/student-booking.png` — Student booking view
- `screenshots/teacher-dashboard.png` — Teacher slot management

### Getting Started

**Prerequisites:** Node.js 18+, MongoDB

```bash
# 1. Clone
git clone https://github.com/Ch-NikhilReddy/Student-Teacher.git
cd Student-Teacher

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
| POST | /api/auth/register | Public | Register (student/teacher) |
| POST | /api/auth/login | Public | Login + JWT |
| GET | /api/teachers | Student | List teachers with availability |
| POST | /api/appointments | Student | Book appointment |
| GET | /api/appointments/my | Student/Teacher | Get my appointments |
| PATCH | /api/appointments/:id | Teacher | Approve/reject |

### What I Learned
- Modeling time slots and appointment conflicts at DB level
- Implementing role-based scheduling workflows

### Future Improvements
- Calendar integration (Google Calendar)
- Email notifications for appointment updates
- Video link integration for online appointments

---
**Author:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University | [LinkedIn](https://linkedin.com/in/ch-nikhil-reddy) | [Portfolio](https://nikhilreddy.dpdns.org)
