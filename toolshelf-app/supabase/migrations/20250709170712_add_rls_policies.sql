-- Enable RLS for all relevant tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_shelf_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tool_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for 'teams'
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

-- Policies for 'team_members'
CREATE POLICY "Users can view members of teams they belong to."
ON public.team_members FOR SELECT
USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team admins can add new members."
ON public.team_members FOR INSERT
WITH CHECK (
  (get_my_role_in_team(team_id) = 'admin')
);

CREATE POLICY "Team admins can update member roles."
ON public.team_members FOR UPDATE
USING (
  (get_my_role_in_team(team_id) = 'admin')
);

CREATE POLICY "Team admins can remove members."
ON public.team_members FOR DELETE
USING (
  (get_my_role_in_team(team_id) = 'admin')
);

-- Policies for 'team_shelf_tools'
CREATE POLICY "Users can view tools on shelves of teams they belong to."
ON public.team_shelf_tools FOR SELECT
USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins and editors can add tools to their team shelf."
ON public.team_shelf_tools FOR INSERT
WITH CHECK (
  (get_my_role_in_team(team_id) IN ('admin', 'editor'))
);

-- Policies for 'user_tool_preferences'
CREATE POLICY "Users can manage their own tool preferences."
ON public.user_tool_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Helper function to get a user's role in a specific team
CREATE OR REPLACE FUNCTION get_my_role_in_team(team_id_to_check uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = auth.uid() AND team_id = team_id_to_check;
$$;
