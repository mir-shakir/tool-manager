'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { Pin, PinOff, Plus, Settings } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Define types
interface TeamTool {
  id: string;
  master_tool_id?: string;
  master_tools?: { title: string; description: string; external_link: string; category: string; };
  custom_title?: string;
  custom_description?: string;
  custom_external_link?: string;
  custom_category?: string;
  is_pinned: boolean;
}

interface TeamDetails {
  id: string;
  name: string;
}

const initialCustomToolState = {
  title: '',
  description: '',
  link: '',
  category: '',
};

export default function TeamShelfPage({ params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [tools, setTools] = useState<TeamTool[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomToolDialogOpen, setIsCustomToolDialogOpen] = useState(false);
  const [customTool, setCustomTool] = useState(initialCustomToolState);

  const fetchTeamAndTools = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      
      const { data: teamData, error: teamError } = await supabase.from('teams').select('id, name').eq('id', teamId).single();
      if (teamError) throw teamError;
      setTeam(teamData);

      const { data: toolsData, error: toolsError } = await supabase.from('team_shelf_tools').select(`id, master_tool_id, custom_title, custom_description, custom_external_link, custom_category, master_tools (title, description, external_link, category), user_tool_preferences (is_pinned)`).eq('team_id', teamId).eq('user_tool_preferences.user_id', currentUser.id);
      if (toolsError) throw toolsError;

      const formattedTools = toolsData.map(tool => ({ ...tool, is_pinned: tool.user_tool_preferences[0]?.is_pinned || false }));
      formattedTools.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const titleA = a.master_tools?.title || a.custom_title || '';
        const titleB = b.master_tools?.title || b.custom_title || '';
        return titleA.localeCompare(titleB);
      });
      setTools(formattedTools);
    } catch (error) {
      console.error('Error fetching team data:', error);
      setTeam(null);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      fetchTeamAndTools(user);
    };
    getCurrentUser();
  }, [fetchTeamAndTools]);

  const handleToolClick = async (toolId: string) => {
    if (!user) return;
    try { await supabase.rpc('touch_tool', { tool_id: toolId, user_id: user.id }); }
    catch (error) { console.error('Error updating last used timestamp:', error); }
  };

  const handleTogglePin = async (tool: TeamTool) => {
    if (!user) return;
    const newPinnedStatus = !tool.is_pinned;
    try {
      const { error } = await supabase.from('user_tool_preferences').upsert({ user_id: user.id, team_shelf_tool_id: tool.id, is_pinned: newPinnedStatus }, { onConflict: 'user_id, team_shelf_tool_id' });
      if (error) throw error;
      toast.success(newPinnedStatus ? 'Tool pinned!' : 'Tool unpinned!');
      fetchTeamAndTools(user); // Re-fetch to get correct sorting
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update pin status.');
    }
  };

  const handleCustomToolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCustomTool(prev => ({ ...prev, [id]: value }));
  };

  const handleAddCustomTool = async () => {
    if (!user || !customTool.title || !customTool.link) {
      toast.error('Title and Link are required for custom tools.');
      return;
    }
    try {
      const { error } = await supabase.from('team_shelf_tools').insert({
        team_id: teamId,
        added_by_user_id: user.id,
        custom_title: customTool.title,
        custom_description: customTool.description,
        custom_external_link: customTool.link,
        custom_category: customTool.category,
      });
      if (error) throw error;
      toast.success('Custom tool added successfully!');
      setIsCustomToolDialogOpen(false);
      setCustomTool(initialCustomToolState);
      fetchTeamAndTools(user);
    } catch (error) {
      console.error('Error adding custom tool:', error);
      toast.error('Failed to add custom tool.');
    }
  };

  const filteredTools = tools.filter(tool => {
    const title = tool.master_tools?.title || tool.custom_title || '';
    const description = tool.master_tools?.description || tool.custom_description || '';
    return title.toLowerCase().includes(searchTerm.toLowerCase()) || description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) return <p>Loading team shelf...</p>;
  if (!team) return <p>Team not found.</p>;

  return (
    <div>
      <Toaster richColors />
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-muted-foreground">Your team's curated tool shelf.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link href={`/teams/${teamId}/settings`}><Settings className="mr-2 h-4 w-4" /> Settings</Link>
          </Button>
          <Dialog open={isCustomToolDialogOpen} onOpenChange={setIsCustomToolDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Custom Tool</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a Custom Tool</DialogTitle><DialogDescription>Add a tool that isn't in the master catalog.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="title" className="text-right">Title</Label><Input id="title" value={customTool.title} onChange={handleCustomToolChange} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="description" className="text-right">Description</Label><Input id="description" value={customTool.description} onChange={handleCustomToolChange} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="link" className="text-right">Link</Label><Input id="link" value={customTool.link} onChange={handleCustomToolChange} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="category" className="text-right">Category</Label><Input id="category" value={customTool.category} onChange={handleCustomToolChange} className="col-span-3" /></div>
              </div>
              <DialogFooter><Button onClick={handleAddCustomTool}>Add Tool</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button asChild><Link href="/master-catalog">Add From Catalog</Link></Button>
        </div>
      </div>

      <div className="mb-6"><Input placeholder="Search tools on this shelf..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" /></div>

      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => {
            const title = tool.master_tools?.title || tool.custom_title;
            const description = tool.master_tools?.description || tool.custom_description;
            const category = tool.master_tools?.category || tool.custom_category;
            const link = tool.master_tools?.external_link || tool.custom_external_link;
            return (
              <div key={tool.id} className="border rounded-lg p-4 flex flex-col bg-card relative">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8" onClick={(e) => { e.stopPropagation(); handleTogglePin(tool); }}>
                  {tool.is_pinned ? <PinOff className="h-4 w-4 text-primary" /> : <Pin className="h-4 w-4" />}
                </Button>
                <a href={link || '#'} target="_blank" rel="noopener noreferrer" onClick={() => handleToolClick(tool.id)} className="flex flex-col flex-grow h-full">
                  <h2 className="text-lg font-bold pr-8">{title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 flex-grow">{description}</p>
                  <div className="mt-4"><span className="text-xs font-semibold bg-secondary text-secondary-foreground py-1 px-2 rounded-full">{category}</span></div>
                </a>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12"><p className="text-muted-foreground">This shelf is empty.</p><p className="text-muted-foreground mt-2">Add tools to get started.</p></div>
      )}
    </div>
  );
}
