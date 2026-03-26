# Supabase Setup Guide

This app now uses Supabase for real authentication. Follow these steps to get it working:

## 1. Create a Supabase Project

1. Go to https://app.supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in the project name (e.g., "rivora")
5. Create a strong database password
6. Select your region (closest to you)
7. Click "Create new project" and wait 2-3 minutes

## 2. Set Up Environment Variables

1. Go to your Supabase project → Settings → API Keys
2. Copy the **Project URL** and **anon (public) key**
3. Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Save and restart the dev server (`npm run dev`)

## 3. Set Up Database Schema

1. In Supabase, go to SQL Editor
2. Create a new query
3. Copy the entire contents of `supabase/schema.sql`
4. Paste it into the SQL editor
5. Run the query (click the play button)
6. Wait for it to complete (you'll see a success message)

## 4. Configure Authentication Settings

1. Go to Authentication → Providers
2. Make sure "Email" is enabled (it should be by default)
3. Go to Authentication → Email Templates
4. These are the confirmation and password reset emails - customize if desired

## 5. Test It Out

1. Go to http://localhost:3000
2. Click "Get Started Free"
3. Sign up with an email and password
4. You should be redirected to the onboarding flow
5. Complete onboarding and access your dashboard
6. Your data is now saved in Supabase!

## 6. View Your Data

To view user data in Supabase:
1. Go to SQL Editor → New Query
2. Example queries:

```sql
-- View all profiles
SELECT * FROM profiles;

-- View a specific user's meal entries
SELECT * FROM meal_entries 
WHERE user_id = 'user-id-here' 
ORDER BY date DESC;
```

## Troubleshooting

**"Database password authentication failed"**
- Make sure your Supabase URL and anon key are correct in `.env.local`
- Restart the dev server after changing env vars

**"Row level security: Permission denied"**
- This means RLS policies aren't working correctly
- Make sure you ran the entire schema.sql including the RLS policies section

**"User not found in profiles table"**
- The auto-create trigger might not be working
- Manually create a profile:

```sql
INSERT INTO profiles (id, email, name)
VALUES ('user-id', 'email@example.com', 'Name')
```

## What's Implemented

✅ Email/password signup & login
✅ User profiles with onboarding
✅ Row-level security (users can only see their own data)
✅ Auto-create profile on signup
✅ Token persistence (auto-login on page refresh)

## Next Steps (Optional)

- Add social login (Google, GitHub)
- Add password reset functionality
- Add email verification requirement
- Enable 2FA (two-factor authentication)
