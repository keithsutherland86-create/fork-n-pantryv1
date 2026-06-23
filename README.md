# Cookbook PWA

Your personal recipe library — installable on iPhone or Android as a home screen app.

## Deploy to Vercel (free, ~5 minutes)

### 1. Get the code on GitHub
- Create a free account at github.com if you don't have one
- Create a new repository (call it `cookbook-pwa`)
- Upload all these files into it (or use GitHub Desktop)

### 2. Deploy on Vercel
- Go to vercel.com and sign in with GitHub
- Click "Add New Project" → import your `cookbook-pwa` repo
- Under **Environment Variables**, add:
  - Key: `ANTHROPIC_API_KEY`
  - Value: your Anthropic API key (from console.anthropic.com)
- Click Deploy — done in ~60 seconds

### 3. Install on your phone
**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap Add — it appears like a real app

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the 3-dot menu
3. Tap "Add to Home screen" or "Install app"

## Features
- 📋 Paste any recipe URL or text
- 🎙️ Voice input — speak a recipe out loud
- ✏️ Manual entry
- 🏷️ AI-powered tag extraction
- 🔍 Search and filter by tag
- 💾 Recipes saved locally on your device
- 📴 Works offline after first visit

## Getting your Anthropic API key
1. Go to console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Copy the key and paste it into Vercel

## Local development
```bash
npm install
cp .env.example .env.local
# edit .env.local with your API key
npm run dev
```
Then open http://localhost:3000
