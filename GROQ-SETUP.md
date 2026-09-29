# Getting Your Free Groq API Key

## Why Groq?

✅ **Completely Free** - No credit card required  
✅ **Fast** - Groq's LPU technology provides incredibly fast inference  
✅ **Generous Limits** - ~14,400 requests/day on free tier  
✅ **High Quality** - Open reasoning models on the free tier  

## Step-by-Step Setup

### 1. Sign Up for Groq

Visit: https://console.groq.com

- Click "Sign Up" or "Get Started"
- Use your email or sign in with Google/GitHub
- **No credit card required!**

### 2. Get Your API Key

Once logged in:

1. Go to: https://console.groq.com/keys
2. Click "Create API Key"
3. Give it a name (e.g., "Customer Triage App")
4. Click "Submit"
5. **Copy the API key** - it starts with `gsk_`

**Important**: Save this key somewhere safe! You won't be able to see it again.

### 3. Add to Your Project

1. Open the project folder
2. Create or edit the `.env.local` file in the root directory
3. Add your key:

```
VITE_GROQ_API_KEY=gsk_your-actual-key-here
```

4. Save the file
5. Restart the dev server:

```bash
npm run dev
```

### 4. Test It Out

1. Open http://localhost:5173
2. Go to the "Analyze" tab
3. Paste a test message: "Our server is down"
4. Click "Analyze Message"
5. You should see AI-powered results!

## Troubleshooting

### "Missing credentials" Error

**Problem**: The app can't find your API key

**Solution**:
- Make sure file is named `.env.local` (not `.env`)
- Check that the key starts with `gsk_`
- Restart the dev server after adding the key
- Make sure there are no extra spaces in the file

### "Rate limit exceeded" Error

**Problem**: You've hit the free tier limit

**Solutions**:
- Wait a few minutes and try again
- Create a new Groq account with a different email
- Use the built-in mock responses (automatic fallback)

### Key Not Working

**Problem**: API returns 401 Unauthorized

**Solution**:
- Regenerate a new key at https://console.groq.com/keys
- Delete the old key
- Update `.env.local` with the new key
- Restart dev server

## Mock Mode (No API Key Needed)

If you don't want to use an API key, the app automatically falls back to **mock responses** when:
- No API key is configured
- API key is invalid
- Rate limit is exceeded

The mock mode uses realistic keyword-based categorization and works offline!

## Free Tier Limits

Groq's free tier includes:

- **~14,400 requests per day**
- **30 requests per minute**
- Access to the models enabled for your key. This app lists those models and uses the reasoning model with the most available tokens.

This is more than enough for development and testing!

## Need Help?

- Groq Documentation: https://console.groq.com/docs
- Groq Discord: https://groq.com/discord
- Project README: See `README.md` in this folder

---

**Happy Triaging! 🚀**
