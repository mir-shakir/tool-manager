import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`Function "invite-member" up and running!`);

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { team_id, email } = await req.json();

    // Create a Supabase client with the user's auth token
    const authHeader = req.headers.get('Authorization')!;
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the user making the request
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
    if (userError) throw userError;

    // Create a service role client to perform admin actions
    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if the requesting user is an admin of the team
    const { data: teamMember, error: memberError } = await serviceSupabaseClient
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('team_id', team_id)
      .single();

    if (memberError || teamMember.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'You must be an admin to invite members.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Get the user ID for the invited email
    // Note: This requires the email to already exist in auth.users
    // A more robust solution would use Supabase's built-in email invites,
    // but this is a simpler approach for the MVP.
    const { data: invitedUser, error: invitedUserError } = await serviceSupabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (invitedUserError || !invitedUser) {
      return new Response(JSON.stringify({ error: 'User with that email does not exist.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Add the user to the team_members table
    const { error: insertError } = await serviceSupabaseClient
      .from('team_members')
      .insert({
        team_id: team_id,
        user_id: invitedUser.id,
        role: 'viewer', // Default role
      });

    if (insertError) {
      // Handle potential duplicate invites
      if (insertError.code === '23505') { // unique_violation
        return new Response(JSON.stringify({ error: 'User is already a member of this team.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        });
      }
      throw insertError;
    }

    return new Response(JSON.stringify({ message: 'Member invited successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});