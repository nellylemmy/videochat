-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS (core identity)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  profile_picture_url TEXT,
  role VARCHAR(10) NOT NULL CHECK (role IN ('volunteer', 'student')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VOLUNTEER PROFILES
CREATE TABLE volunteer_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  country VARCHAR(100),
  bio TEXT,
  parent_email VARCHAR(255),
  parent_phone VARCHAR(20),
  parental_approval BOOLEAN DEFAULT FALSE
);

-- STUDENT PROFILES
CREATE TABLE student_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  class_level VARCHAR(50),
  bio TEXT
);

-- EMAIL VERIFICATIONS
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- PASSWORD RESET TOKENS
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- MEETINGS HISTORY
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(100) NOT NULL,
  volunteer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP
);
