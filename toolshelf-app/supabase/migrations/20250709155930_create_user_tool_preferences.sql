-- Create the user_tool_preferences table
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

-- Create the function to update the timestamp
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
