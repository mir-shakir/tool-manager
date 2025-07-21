-- ------------------------------------------------------------------------------------------------
-- ToolShelf MVP: Complete Database Setup Script
-- ------------------------------------------------------------------------------------------------
-- Instructions:
-- 1. Go to your Supabase project dashboard.
-- 2. Navigate to the "SQL Editor".
-- 3. Click "New query".
-- 4. Copy the ENTIRE content of this file, paste it into the editor, and click "RUN".
-- ------------------------------------------------------------------------------------------------

-- Section 1: Table Creation
-- ------------------------------------------------------------------------------------------------

-- Create the 'teams' table to store team information.
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    owner_id uuid NOT NULL,
    CONSTRAINT teams_pkey PRIMARY KEY (id),
    CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.teams IS 'Stores team information and ownership.';

-- Create the 'team_members' table to manage user roles within teams.
CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'viewer'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT team_members_pkey PRIMARY KEY (id),
    CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id)
);
COMMENT ON TABLE public.team_members IS 'Junction table to link users to teams with specific roles.';

-- Create the 'master_tools' table for the platform's curated list of tools.
CREATE TABLE IF NOT EXISTS public.master_tools (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    external_link text NOT NULL,
    category text NOT NULL,
    tags text[],
    logo_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    is_approved boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT master_tools_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE public.master_tools IS 'Platform-managed master catalog of developer tools.';

-- Create the 'team_shelf_tools' table for tools added to a specific team's shelf.
CREATE TABLE IF NOT EXISTS public.team_shelf_tools (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL,
    master_tool_id uuid,
    custom_title text,
    custom_description text,
    custom_external_link text,
    custom_category text,
    custom_tags text[],
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    added_by_user_id uuid NOT NULL,
    CONSTRAINT team_shelf_tools_pkey PRIMARY KEY (id),
    CONSTRAINT team_shelf_tools_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT team_shelf_tools_master_tool_id_fkey FOREIGN KEY (master_tool_id) REFERENCES public.master_tools(id) ON DELETE CASCADE,
    CONSTRAINT team_shelf_tools_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT check_tool_source CHECK (((master_tool_id IS NOT NULL) AND (custom_title IS NULL)) OR ((master_tool_id IS NULL) AND (custom_title IS NOT NULL))),
    CONSTRAINT team_shelf_tools_team_id_master_tool_id_key UNIQUE (team_id, master_tool_id),
    CONSTRAINT team_shelf_tools_team_id_custom_external_link_key UNIQUE (team_id, custom_external_link)
);
COMMENT ON TABLE public.team_shelf_tools IS 'Tools that have been added to a specific team''s shelf.';

-- Create the 'user_tool_preferences' table to track user-specific settings like pinned/recent tools.
CREATE TABLE IF NOT EXISTS public.user_tool_preferences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    team_shelf_tool_id uuid NOT NULL,
    last_used_at timestamp with time zone,
    is_pinned boolean NOT NULL DEFAULT false,
    CONSTRAINT user_tool_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT user_tool_preferences_team_shelf_tool_id_fkey FOREIGN KEY (team_shelf_tool_id) REFERENCES public.team_shelf_tools(id) ON DELETE CASCADE,
    CONSTRAINT user_tool_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT user_tool_preferences_user_id_team_shelf_tool_id_key UNIQUE (user_id, team_shelf_tool_id)
);
COMMENT ON TABLE public.user_tool_preferences IS 'Stores user-specific preferences for tools, like pins and recent usage.';


-- Section 2: Database Functions
-- ------------------------------------------------------------------------------------------------

-- Create a helper function to get a user's role in a specific team.
CREATE OR REPLACE FUNCTION public.get_my_role_in_team(team_id_to_check uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = auth.uid() AND team_id = team_id_to_check;
$$;
COMMENT ON FUNCTION public.get_my_role_in_team(uuid) IS 'Returns the role of the currently authenticated user for a given team.';

-- Create a function to update the 'last_used_at' timestamp for a tool.
CREATE OR REPLACE FUNCTION public.touch_tool(tool_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_tool_preferences (team_shelf_tool_id, user_id, last_used_at)
  VALUES (tool_id, user_id, NOW())
  ON CONFLICT (user_id, team_shelf_tool_id)
  DO UPDATE SET last_used_at = NOW();
END;
$$;
COMMENT ON FUNCTION public.touch_tool(uuid, uuid) IS 'Updates the last_used_at timestamp for a tool, creating a preference entry if one doesn''t exist.';


-- Section 3: Row Level Security (RLS)
-- ------------------------------------------------------------------------------------------------

-- Enable RLS for all tables.
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_shelf_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tool_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_tools ENABLE ROW LEVEL SECURITY;

-- Policies for 'teams'
CREATE POLICY "Users can view teams they are a member of." ON public.teams FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.team_members WHERE team_id = id));
CREATE POLICY "Authenticated users can create teams." ON public.teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Team owners can update their own team." ON public.teams FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Policies for 'team_members'
CREATE POLICY "Users can view members of teams they belong to." ON public.team_members FOR SELECT USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team admins can add new members." ON public.team_members FOR INSERT WITH CHECK ((get_my_role_in_team(team_id) = 'admin'));
CREATE POLICY "Team admins can update member roles." ON public.team_members FOR UPDATE USING ((get_my_role_in_team(team_id) = 'admin'));
CREATE POLICY "Team admins can remove members." ON public.team_members FOR DELETE USING ((get_my_role_in_team(team_id) = 'admin'));

-- Policies for 'team_shelf_tools'
CREATE POLICY "Users can view tools on shelves of teams they belong to." ON public.team_shelf_tools FOR SELECT USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins and editors can add tools to their team shelf." ON public.team_shelf_tools FOR INSERT WITH CHECK ((get_my_role_in_team(team_id) IN ('admin', 'editor')));

-- Policies for 'user_tool_preferences'
CREATE POLICY "Users can manage their own tool preferences." ON public.user_tool_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for 'master_tools'
CREATE POLICY "All authenticated users can read the master tool catalog." ON public.master_tools FOR SELECT USING (auth.role() = 'authenticated');


-- ------------------------------------------------------------------------------------------------
SELECT 'SUCCESS: ToolShelf database schema, functions, and RLS policies created.';
-- ------------------------------------------------------------------------------------------------
