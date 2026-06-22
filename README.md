# 🛡️ Police Duty Management System

A full-stack, role-based duty management system built for law enforcement agencies using the **MERN** stack (MongoDB, Express, React, Node.js) with Vite, Tailwind CSS, Firebase push notifications, WhatsApp notifications via Meta Cloud API, and Cloudinary for file storage.

---

## 📋 Table of Contents

- [Features](#features)
- [Role Hierarchy](#role-hierarchy)
- [Tech Stack](#tech-stack)
- [WhatsApp Templates](#whatsapp-templates)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Seeding the Database](#seeding-the-database)
- [Deployment](#deployment)

---

## ✨ Features

### Core
- **5-tier RBAC**: Master → Superadmin → Admin → Operator (Special/Regular) → Officer
- **Dynamic rank system**: Ranks created by master with custom names, codes, priorities, and badge colors
- **Duty lifecycle**: Create → Assign → Accept/Reject → Replace → Complete/Cancel
- **Auto officer assignment**: Random selection by rank with availability checking
- **Manual officer assignment**: Operator can manually pick specific officers
- **Officer replacement**: When an officer rejects, operator replaces them with a random available officer of the same rank

### Notifications
- **WhatsApp** via Meta Cloud API (7 templates — see below)
- **Firebase FCM** push notifications (browser + mobile)
- **In-app notification bell** with real-time unread count

### Security
- JWT access tokens (15 min) + refresh tokens (7 days)
- Bcrypt password hashing (12 rounds)
- Rate limiting (200 req/15min general, 10 req/15min on auth)
- Helmet security headers
- CORS whitelist
- Suspension cascade (suspend SP → suspends all admins/operators under it)

### File Handling
- Cloudinary for duty documents (PDF, images, Word)
- Cloudinary for Excel officer bulk upload
- Multer for upload handling

### UI/UX
- **Light/Dark mode** (default: light, persisted in localStorage)
- Fully responsive (mobile → desktop)
- Role-specific dashboards and sidebars
- Pagination, search, filters throughout
- Toast notifications (react-hot-toast)
- Drag-and-drop Excel upload

---

## 👥 Role Hierarchy

```
Master (Company / Developer)
│
├── Creates Superadmin (SP) — max 1
│   └── Views all admins, operators, officers, duties (read-only)
│
├── Creates Admins (ACP) — unlimited
│   ├── Creates Operators — max 1 Special + 1 Regular
│   │   ├── Special Operator
│   │   │   ├── Create/Edit/Cancel duties (with VVIP/CITY-POINT/CRIMINAL types)
│   │   │   ├── Add/Edit/Delete officers (single)
│   │   │   └── Replace rejected officers
│   │   └── Regular Operator (same but NO duty type field)
│   └── Views own duties only
│
├── Manages Ranks (dynamic)
├── Bulk uploads officers (Excel) to any admin
└── Can suspend/activate SP and any Admin

Officer
  ├── Views active duties
  ├── Views duty history
  └── Can reject a duty (with reason → operator notified)
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query v5 |
| Icons | Lucide React |
| Notifications (UI) | react-hot-toast |
| Maps | React Leaflet |
| Backend | Node.js, Express 4 |
| Database | MongoDB, Mongoose 8 |
| Auth | JWT (access + refresh), Bcrypt |
| File Storage | Cloudinary |
| Push Notifications | Firebase Admin SDK + FCM |
| WhatsApp | Meta Cloud API (WhatsApp Business) |
| Excel Parsing | xlsx (SheetJS) |
| Email (OTP fallback) | Nodemailer |
| Security | Helmet, express-rate-limit, CORS |

---

## 📱 WhatsApp Templates

You must create and get these templates approved in Meta Business Manager before using them.

| Template Name | Parameters | Use Case |
|---|---|---|
| `welcome_user` | name, role, email, temp_password | New account credentials |
| `duty_assigned` | officer_name, duty_name, location, start, end | Duty assignment |
| `duty_updated` | officer_name, duty_name, changes | Duty details changed |
| `duty_cancelled` | officer_name, duty_name, reason | Duty cancelled |
| `officer_replaced` | new_officer_name, duty_name, reason | Replacement notification |
| `account_suspended` | name, reason | Account suspension |
| `forgot_password_otp` | name, otp, expiry_minutes | Password reset OTP |

**Template Example Body (duty_assigned):**
```
Hello {{1}},

You have been assigned to duty: *{{2}}*
📍 Location: {{3}}
🕐 Start: {{4}}
🏁 End: {{5}}

Please report on time. For queries, contact your operator.

— Duty Management System
```

---

## 📁 Project Structure

```
duty-mgmt/
├── backend/
│   ├── config/
│   │   ├── cloudinary.js        # Cloudinary + Multer setup
│   │   ├── db.js                # MongoDB connection
│   │   └── firebase.js          # Firebase Admin SDK
│   ├── controllers/
│   │   ├── authController.js    # Login, OTP, password reset
│   │   ├── masterController.js  # SP, admins, ranks, bulk upload
│   │   ├── superadminController.js
│   │   ├── adminController.js
│   │   ├── operatorController.js # Duties + officers
│   │   ├── officerController.js  # Active duties, reject
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT protect + role authorize
│   │   └── errorMiddleware.js   # Global error handler
│   ├── models/
│   │   ├── User.js              # All roles in one model
│   │   ├── Officer.js           # Extended officer profile
│   │   ├── Duty.js              # Duty + assigned officers
│   │   ├── Rank.js              # Dynamic ranks
│   │   └── Notification.js      # In-app + channel status
│   ├── routes/                  # Express routers (per role)
│   ├── seeds/
│   │   └── masterSeed.js        # Creates master + default ranks
│   ├── utils/
│   │   ├── jwt.js               # Token generation/verification
│   │   ├── otp.js               # OTP generation/hashing
│   │   ├── whatsapp.js          # Meta Cloud API helpers
│   │   ├── email.js             # Nodemailer OTP fallback
│   │   ├── notificationService.js # Create + dispatch notifications
│   │   └── response.js          # Standard API response helpers
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    │   ├── shield.svg
    │   └── firebase-messaging-sw.js  # FCM background handler
    ├── src/
    │   ├── api/
    │   │   └── axios.js          # Axios instance + token refresh interceptor
    │   ├── components/
    │   │   ├── common/           # Modal, Pagination, StatCard, Sidebar, etc.
    │   │   └── layout/           # BaseLayout + 5 role layouts
    │   ├── contexts/
    │   │   ├── AuthContext.jsx   # User state, login/logout
    │   │   └── ThemeContext.jsx  # Dark/light mode
    │   ├── pages/
    │   │   ├── auth/             # Login, ForgotPassword
    │   │   ├── master/           # Dashboard, Superadmin, Admins, Ranks, Bulk Upload
    │   │   ├── superadmin/       # Dashboard, Admins, Duties
    │   │   ├── admin/            # Dashboard, Operators, Duties
    │   │   ├── operator/         # Dashboard, Officers, Duties, CreateDuty, DutyDetail
    │   │   ├── officer/          # Dashboard, ActiveDuties, History
    │   │   └── shared/           # Settings, NotFound
    │   ├── utils/
    │   │   ├── helpers.js        # formatDate, statusColors, etc.
    │   │   └── firebase.js       # FCM token init
    │   ├── App.jsx               # All routes with role guards
    │   ├── main.jsx
    │   └── index.css
    ├── .env.example
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account
- Meta WhatsApp Business API access
- Firebase project (for push notifications)

### 1. Clone and Install

```bash
# Backend
cd duty-mgmt/backend
cp .env.example .env
# Edit .env with your values
npm install
npm run seed          # Creates master account + default ranks

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env with your Firebase config
npm install
```

### 2. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev           # Starts on http://localhost:5000

# Terminal 2 - Frontend
cd frontend
npm run dev           # Starts on http://localhost:5173
```

### 3. Login as Master

```
Email:    master@supertech.com
Password: venus@1978@
```

**First steps after login:**
1. Go to **Manage Ranks** → Add ranks (or use the 8 default ranks seeded)
2. Go to **Superadmin (SP)** → Create the superadmin
3. Go to **Admins (ACP)** → Create admins
4. Go to **Bulk Upload Officers** → Upload officers to an admin

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/duty_mgmt
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

WHATSAPP_API_TOKEN=your_meta_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase_service_account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`frontend/.env`)

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

---

## 📡 API Reference

### Auth (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/login` | Public | Login with email + password |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/forgot-password` | Public | Send OTP via WhatsApp/email |
| POST | `/verify-otp` | Public | Verify OTP |
| POST | `/reset-password` | Public | Reset password with OTP |
| GET | `/me` | All | Get own profile |
| PATCH | `/change-password` | All | Change own password |
| PATCH | `/fcm-token` | All | Update FCM push token |

### Master (`/api/master`) — role: master
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/superadmin` | Create / get superadmin |
| POST/GET | `/admins` | Create / list admins |
| GET | `/admins/:id/details` | Admin + operators + officers |
| PATCH | `/suspend/:userId` | Suspend SP or admin |
| PATCH | `/activate/:userId` | Activate SP or admin |
| POST/GET | `/ranks` | Create / list ranks |
| PUT/DELETE | `/ranks/:id` | Update / deactivate rank |
| POST | `/officers/bulk-upload` | Excel bulk upload officers |
| GET | `/officers` | All officers (filterable) |

### Operator (`/api/operator`) — roles: operator_special, operator_regular
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/officers` | List / add officer |
| PUT/DELETE | `/officers/:id` | Edit / remove officer |
| GET/POST | `/duties` | List / create duty |
| GET/PUT | `/duties/:id` | Duty detail / update |
| PATCH | `/duties/:id/cancel` | Cancel duty |
| PATCH | `/duties/:id/replace/:assignId` | Replace rejected officer |
| GET | `/ranks/availability` | Ranks with available officer counts |

### Officer (`/api/officer`) — role: officer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Own officer profile |
| GET | `/duties/active` | Active duty assignments |
| GET | `/duties/history` | Completed/cancelled history |
| GET | `/duties/:id` | Single duty detail |
| PATCH | `/duties/:id/reject` | Reject assignment with reason |

---

## 🌱 Seeding the Database

```bash
cd backend
npm run seed
```

This creates:
- **Master account**: `master@supertech.com` / `Master@123`
- **8 default ranks**: SP(A), ASP(B), DSP(C), Inspector(D), SI(E), ASI(F), Head Constable(G), Constable(H)

---

## 🚢 Deployment

### Backend (e.g. Railway, Render, EC2)
```bash
npm start
```
Set `NODE_ENV=production` and all env vars in your hosting platform.

### Frontend (e.g. Vercel, Netlify)
```bash
npm run build
# dist/ folder is the deployable output
```
Set the Vite env vars in your hosting platform's environment settings.

### MongoDB Atlas
Use your Atlas connection string as `MONGO_URI`.

---

## 🔒 Security Notes

- Change `JWT_SECRET` and `JWT_REFRESH_SECRET` to long random strings in production
- Use HTTPS in production (set `FRONTEND_URL` accordingly)
- Enable MongoDB Atlas IP whitelist
- Store Firebase private key securely (use `\n` for newlines in env vars)
- OTP expires in 10 minutes; brute-force protected by rate limiting (10 attempts/15min)

---

## 🧩 Future Enhancements (Suggestions)

- **Mobile app** (React Native) — backend is app-ready, endpoints return JSON
- **Real-time duty status** via Socket.io (infrastructure already listed as dependency)
- **Geo-fence verification** for officer duty check-in
- **Shift scheduling** (recurring duties)
- **Analytics dashboard** with charts (Recharts already installed)
- **Officer selfie/OTP duty verification** at start/end of shift

---

## 📞 Support

For issues with Meta WhatsApp API approval, refer to:
https://developers.facebook.com/docs/whatsapp/message-templates/guidelines

For Firebase FCM setup:
https://firebase.google.com/docs/cloud-messaging/js/client
