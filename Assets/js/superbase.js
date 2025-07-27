// superbase.js

const SUPABASE_URL = 'https://fxxilrlqcrezgporwrib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4eGlscmxxY3Jlemdwb3J3cmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MDkyMzIsImV4cCI6MjA2OTA4NTIzMn0.Dd7sGgIemhWmUbxtSotfaca9BS80-AyNWtH5BZUbyyE';

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
