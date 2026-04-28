import { createClient } from '@supabase/supabase-js';
import process from 'process';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Set them before running the script.');
  process.exit(1);
}

const [email] = process.argv.slice(2);

if (!email) {
  console.error('Usage: node scripts/insert-default-data.js <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Inserting default data for user:', email);

  // Find user ID
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const userId = user.id;
  console.log('User ID:', userId);

  // Insert customization if not exists
  const { data: existingCustomization, error: customError } = await supabase
    .from('customization')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (customError && customError.code !== 'PGRST116') {
    console.error('Error checking customization:', customError.message);
    process.exit(1);
  }

  if (!existingCustomization) {
    console.log('Inserting default customization...');
    const { error: insertCustomError } = await supabase
      .from('customization')
      .insert({
        user_id: userId,
        title: 'Bicycle Inventory',
        sidebar_color: '#1f2937',
        main_color: '#3b82f6',
        initial_retail_amount: 0,
        regards: 'Best Regards',
        exec_name: 'Executive'
      });
    if (insertCustomError) {
      console.error('Failed to insert customization:', insertCustomError.message);
      process.exit(1);
    }
    console.log('Customization inserted.');
  } else {
    console.log('Customization already exists.');
  }

  // Insert default categories if none exist
  const { data: existingCategories, error: catError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (catError) {
    console.error('Error checking categories:', catError.message);
    process.exit(1);
  }

  if (existingCategories.length === 0) {
    console.log('Inserting default categories...');
    const defaultCategories = [
      { name: 'Mountain Bikes', user_id: userId },
      { name: 'Road Bikes', user_id: userId },
      { name: 'Hybrid Bikes', user_id: userId },
      { name: 'Electric Bikes', user_id: userId }
    ];

    const { error: insertCatError } = await supabase
      .from('categories')
      .insert(defaultCategories);
    if (insertCatError) {
      console.error('Failed to insert categories:', insertCatError.message);
      process.exit(1);
    }
    console.log('Default categories inserted.');
  } else {
    console.log('Categories already exist.');
  }

  console.log('Default data insertion complete.');
}

main().catch(console.error);