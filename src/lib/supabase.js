import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jgvsbecvgkcfafjyhxvr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndnNiZWN2Z2tjZmFmanloeHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjY4OTQsImV4cCI6MjA5ODY0Mjg5NH0.WuWZPBQkyD5AtvuV3dEnQZHaHMCWKbAmOpKVOiJJO64'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)