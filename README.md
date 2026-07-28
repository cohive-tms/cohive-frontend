# 💬 cohive-frontend

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

The core frontend Single Page Application (SPA) component for the **CoHive** business collaboration platform, built with React, TypeScript, and Vite.

---

## 🌟 Overview

`cohive-frontend` provides a lightweight, responsive, and real-time user interface. It powers essential workspace features, including:

* 💬 **Chat Channels**: Real-time channel messaging and direct messaging.
* 📋 **Kanban Boards**: Dynamic task and project tracking.
* 📅 **Calendar & Scheduling**: Workspace events and scheduling tools.
* 📝 **Markdown Co-Editing**: Collaborative document editing.
* 🏢 **Multi-Tenant & Admin UI**: Workspace switcher and tenant admin dashboard.

---

## 🚀 Key Technologies

* **Framework**: React 18 + TypeScript
* **Build Tool**: Vite
* **Icons**: Lucide React
* **Styling**: Vanilla CSS with modern design variables
* **Markdown Support**: Marked + PrismJS

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL of the `cohive-cloudflare` backend API Worker | `http://localhost:8787` |

---

## 💻 Local Development

### 1. Prerequisites
To test full backend integration locally, ensure the backend API worker ([cohive-cloudflare](https://github.com/cohive-tms/cohive-cloudflare)) is running.

### 2. Setup & Run

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

The application will start on your local dev server (e.g. `http://localhost:3000`).

---

## 📄 License

This project is licensed under the [Apache License 2.0](./LICENSE).
