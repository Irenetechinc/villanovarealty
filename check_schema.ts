
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking Auctions Table...');
  const { data: auctions, error: auctionError } = await supabase
    .from('auctions')
    .select('*')
    .limit(1);

  if (auctionError) {
    console.error('Error fetching auctions:', auctionError);
  } else if (auctions && auctions.length > 0) {
    console.log('Auctions keys:', Object.keys(auctions[0]));
  } else {
    console.log('No auctions found to infer schema. Attempting to insert dummy to see error...');
  }

  console.log('\nChecking Properties Table...');
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .limit(1);

  if (propError) {
    console.error('Error fetching properties:', propError);
  } else if (properties && properties.length > 0) {
    console.log('Properties keys:', Object.keys(properties[0]));
  } else {
    console.log('No properties found.');
  }
}

checkSchema();
