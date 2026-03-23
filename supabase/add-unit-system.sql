ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unit_system TEXT NOT NULL DEFAULT 'imperial'
  CHECK (unit_system IN ('imperial', 'metric'));

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, unit_system)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'unit_system', 'imperial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
