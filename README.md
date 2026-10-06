# Chatling - Ephemeral 1-to-1 Real-Time Chat

A lightweight, secure, ephemeral 1-to-1 web chat application built for instant communication. Requires **ZERO database setup** and **ZERO user authentication**.

## Features

- 🔒 **Zero Database & Zero Authentication**: No accounts, login, or persistent DB. All state is held in server memory and purges when participants leave.
- 🔑 **6-Digit Room Code**: Fast 1-click room creation with copy code & direct link (`?room=123456`) auto-join.
- 👥 **Strict 2-User Capacity**: Enforces max 2 active users per room ($N \le 2$).
- 💬 **Bi-directional Real-Time Messaging**: Instant text transmission with timestamps & status indicators.
- ✍️ **Live Typing Indicator**: Real-time `"Partner is typing..."` feedback.
- 🎨 **Sleek Interface**: Responsive layout, Tailwind CSS, dark/light theme toggle, background pattern, and emoji picker.

---

## Deployment Instructions

### 1. Push to GitHub

Run the following commands in your terminal inside the project directory:

```bash
git init
git add .
git commit -m "Initial commit - Chatling Ephemeral Chat"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.name.git
git push -u origin main
```

---

### 2. Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New Project"**.
2. Connect your GitHub account and import your repository.
3. Keep the default settings (Framework Preset: **Other**).
4. Click **Deploy**. Vercel will auto-detect `vercel.json` and deploy your app instantly!

---

### 3. Alternative Free Hosting (Render / Railway)

Because Socket.io uses persistent WebSocket connections, Render or Railway are also great hosting options:

#### Render.com
1. Go to [Render Dashboard](https://dashboard.render.com/) -> **New Web Service**.
2. Connect your GitHub repo.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Click **Create Web Service**.

---

## Local Development

```bash
# Install dependencies
npm install

# Start local server
npm start
```

Open `http://localhost:3000` in your browser.
