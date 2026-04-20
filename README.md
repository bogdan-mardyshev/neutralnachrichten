# 📰 NeutralNachrichten — German Media Bias Analyzer

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" width="100%" alt="NeutralNachrichten Header" />

  [![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev/)
  [![Gemini](https://img.shields.io/badge/AI-Gemini_2.5_Flash-orange?logo=googlegemini)](https://ai.google.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
</div>

---

## 🌟 Overview

**NeutralNachrichten** is an AI-native platform designed to combat media polarization. By leveraging **Google Gemini 2.5 Flash**, it provides a 360-degree view of the German news landscape, analyzing framing across political spectrums.

---

## ✨ Key Features

- 🌍 **Trilingual Support**: Full UI/Analysis for **German, English, and Russian**.
- ⚖️ **Narrative Split**: Side-by-side comparison of "Left/Progressive" vs. "Right/Conservative" framing.
- 🚨 **Security & Protection**: Backend proxying, rate limiting (3 req/day/IP), and daily budget caps.
- 📈 **Analytics & Monitoring**: Integrated PostHog (analytics) and Sentry (error tracking).
- ⚖️ **GDPR Compliant**: Built-in cookie consent and legal page structures.

---

## 🚀 Tech Stack

- **Frontend**: React 19, Tailwind CSS, React Router
- **Backend**: Node.js, Express (API Proxy & Static Serving)
- **AI Engine**: Google Gemini 2.5 Flash
- **Tools**: PostHog, Sentry, Helmet (Security), express-rate-limit

---

## 🛠️ Installation & Setup

### Prerequisites

- Node.js v20+
- Google Gemini API Key

### Local Development

1. **Clone & Install**
   ```bash
   git clone https://github.com/your-username/neutralnachrichten.git
   cd neutralnachrichten
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env.local` and fill in your values:
   ```env
   VITE_GEMINI_API_KEY=your_key
   ```

3. **Run Dev Mode**
   ```bash
   npm run dev
   ```
   *Runs backend on :3001 and frontend on :3000.*

---

## 🚢 Deployment (Railway)

1. Connect your GitHub repository to [Railway](https://railway.app/).
2. Add all environment variables from `.env.example` to the Railway project settings.
3. Railway will automatically detect the `start` script.
4. Ensure `NODE_ENV` is set to `production`.

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_GEMINI_API_KEY` | Your Google AI Studio API Key |
| `VITE_POSTHOG_API_KEY`| (Optional) PostHog Project API Key |
| `VITE_SENTRY_DSN`     | (Optional) Sentry DSN |
| `DAILY_BUDGET_USD`    | Max daily spend cap (default: 5) |
| `PORT`                | Port to run the server on (Railway handles this) |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
