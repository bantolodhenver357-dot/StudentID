
/* =====================================
   SCHOOL ID MAKER - SUPABASE CONNECTION
===================================== */

const SUPABASE_URL = "https://dbmhfwkocoqdfwwoqctl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_PdSahmQQzatdr6sWFQPoqg_MHOe9e8D";

// Create Supabase client
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("School ID Maker: Supabase connected.");
