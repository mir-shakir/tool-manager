import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Note: It's often better to create the client inside the component that needs it,
// rather than exporting a singleton instance. This ensures the client is created
// only when needed on the client-side.
// However, for simplicity in this project, we will create a singleton instance.
export const supabase = createSupabaseBrowserClient();
