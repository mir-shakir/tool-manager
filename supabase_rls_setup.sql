-- This script sets up the necessary Row Level Security (RLS) policies for the ToolShelf MVP.
-- Copy the entire content of this file and run it in the SQL Editor on your Supabase dashboard.
-- Go to: Database -> SQL Editor -> New query

-- 1. Enable RLS for all relevant tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_shelf_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tool_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Create a helper function to get a user's role in a specific team
-- This function is used in the policies below to check for 'admin' or 'editor' roles.
CREATE OR REPLACE FUNCTION get_my_role_in_team(team_id_to_check uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = auth.uid() AND team_id = team_id_to_check;
$$;

-- 3. Policies for the 'teams' table
CREATE POLICY "Users can view teams they are a member of."
ON public.teams FOR SELECT
USING (auth.uid() IN (SELECT user_id FROM public.team_members WHERE team_id = id));

CREATE POLICY "Authenticated users can create teams."
ON public.teams FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Team owners can update their own team."
ON public.teams FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 4. Policies for the 'team_members' table
CREATE POLICY "Users can view members of teams they belong to."
ON public.team_members FOR SELECT
USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can add new members."
ON public.team_members FOR INSERT
WITH CHECK ((get_my_role_in_team(team_id) = 'admin'));

CREATE POLICY "Team admins can update member roles."
ON public.team_members FOR UPDATE
USING ((get_my_role_in_team(team_id) = 'admin'));

CREATE POLICY "Team admins can remove members."
ON public.team_members FOR DELETE
USING ((get_my_role_in_team(team_id) = 'admin'));

-- 5. Policies for the 'team_shelf_tools' table
CREATE POLICY "Users can view tools on shelves of teams they belong to."
ON public.team_shelf_tools FOR SELECT
USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins and editors can add tools to their team shelf."
ON public.team_shelf_tools FOR INSERT
WITH CHECK ((get_my_role_in_team(team_id) IN ('admin', 'editor')));

-- 6. Policies for the 'user_tool_preferences' table
CREATE POLICY "Users can manage their own tool preferences."
ON public.user_tool_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Policies for the 'master_tools' table (Assuming it should be publicly readable)
ALTER TABLE public.master_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read the master tool catalog."
ON public.master_tools FOR SELECT
USING (auth.role() = 'authenticated');

-- Note: You will need a service_role key to insert/update/delete master_tools.
-- This is intentional for the MVP, where the catalog is managed by the platform owner.

SELECT 'ToolShelf RLS policies have been set up successfully!';
