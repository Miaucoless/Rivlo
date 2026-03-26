# Vercel Deployment Guide for Rivora Fitness App

## Prerequisites
- GitHub repository with your code
- Vercel account
- Supabase project with environment variables

## Step 1: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select "Next.js" as framework

## Step 2: Configure Environment Variables
In Vercel project settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Deploy
1. Vercel will automatically detect Next.js and deploy
2. Wait for build to complete
3. Your app will be live at `your-app.vercel.app`

## Step 4: Post-Deployment
1. Test your live app
2. Run the updated schema in Supabase SQL editor
3. Test sync functionality

## Troubleshooting
- **Build fails**: Check environment variables match exactly
- **Supabase errors**: Ensure schema is updated in your Supabase project
- **Sync issues**: Check browser console for errors

## Notes
- The `vercel.json` file ensures proper Next.js deployment
- Environment variables are automatically available in production
- No additional configuration needed for basic deployment
