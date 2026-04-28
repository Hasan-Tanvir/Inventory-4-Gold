import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Set them before running the script.');
  process.exit(1);
}

const [email, password, name = 'Admin User'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/create-admin-user.js <email> <password> [name]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Setting up admin user:', email);

  // First, try to find existing user
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const existingUser = users.users.find(u => u.email === email);
  let userId;

  if (existingUser) {
    console.log('User exists, updating password...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error('Failed to update user:', updateError.message);
      process.exit(1);
    }
    userId = existingUser.id;
    console.log('Password updated for user:', userId);
  } else {
    console.log('Creating new admin user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      console.error('Failed to create user:', error.message || error.details || error);
      process.exit(1);
    }

    const user = data?.user || data;
    if (!user || !user.id) {
      console.error('Unexpected result from auth.admin.createUser:', data);
      process.exit(1);
    }

    userId = user.id;
    console.log('User created with id:', userId);
  }

  // Ensure profile exists and role is admin
  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (profileFetchError && profileFetchError.code !== 'PGRST116') { // PGRST116 is not found
    console.error('Failed to fetch profile:', profileFetchError.message);
    process.exit(1);
  }

  if (!profile) {
    console.log('Creating profile...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name, role: 'admin' });
    if (insertError) {
      console.error('Failed to create profile:', insertError.message);
      process.exit(1);
    }
  } else if (profile.role !== 'admin') {
    console.log('Updating role to admin...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);
    if (updateError) {
      console.error('Failed to update profile:', updateError.message);
      process.exit(1);
    }
  }

  console.log('Admin user setup complete.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
