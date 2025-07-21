'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Define types
interface Team {
  id: string;
  name: string;
}

interface Tool {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  description: string;
}

export default function DashboardHome() {
  const [newTeamName, setNewTeamName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [recentTools, setRecentTools] = useState<Tool[]>([]);
  const [pinnedTools, setPinnedTools] = useState<Tool[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async (currentUser: User) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('team_members').select('teams(id, name)').eq('user_id', currentUser.id);
    if (error) console.error('Error fetching teams:', error);
    else {
      const validTeams = data?.map(item => item.teams).filter((team): team is Team => team !== null) || [];
      setTeams(validTeams);
    }
  }, []);

  const formatToolData = (data: any[]): Tool[] => {
    return data.map(item => {
      const tool = item.team_shelf_tools;
      return {
        id: tool.id,
        team_id: tool.team_id,
        team_name: tool.teams?.name || 'Unknown Team',
        title: tool.master_tools?.title || tool.custom_title || 'Untitled Tool',
        description: tool.master_tools?.description || tool.custom_description || '',
      };
    });
  };

  const fetchRecentTools = useCallback(async (currentUser: User) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('user_tool_preferences').select('team_shelf_tools(id, team_id, teams(name), master_tools(title, description), custom_title, custom_description)')
      .eq('user_id', currentUser.id).not('last_used_at', 'is', null).order('last_used_at', { ascending: false }).limit(5);
    if (error) console.error('Error fetching recent tools:', error);
    else setRecentTools(formatToolData(data));
  }, []);

  const fetchPinnedTools = useCallback(async (currentUser: User) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('user_tool_preferences').select('team_shelf_tools(id, team_id, teams(name), master_tools(title, description), custom_title, custom_description)')
      .eq('user_id', currentUser.id).eq('is_pinned', true).order('last_used_at', { ascending: false });
    if (error) console.error('Error fetching pinned tools:', error);
    else setPinnedTools(formatToolData(data));
  }, []);

  useEffect(() => {
    const getUserAndData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        await Promise.all([fetchTeams(user), fetchRecentTools(user), fetchPinnedTools(user)]);
      }
      setLoading(false);
    };
    getUserAndData();
  }, [fetchTeams, fetchRecentTools, fetchPinnedTools]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !user) return;
    try {
      const { data: teamData, error: teamError } = await supabase.from('teams').insert({ name: newTeamName.trim(), owner_id: user.id }).select().single();
      if (teamError) throw teamError;
      const { error: memberError } = await supabase.from('team_members').insert({ team_id: teamData.id, user_id: user.id, role: 'admin' });
      if (memberError) throw memberError;
      await fetchTeams(user);
      setNewTeamName('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const renderToolList = (tools: Tool[], emptyMessage: string) => (
    <div className="border rounded-lg p-4">
      {loading ? <p>Loading...</p> : tools.length > 0 ? (
        <div className="space-y-4">
          {tools.map((tool) => (
            <Link href={`/teams/${tool.team_id}`} key={tool.id} legacyBehavior>
              <a className="block"><Card className="hover:bg-accent transition-colors"><CardHeader><CardTitle>{tool.title}</CardTitle><CardDescription>in <span className="font-semibold">{tool.team_name}</span></CardDescription></CardHeader></Card></a>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12"><p className="text-muted-foreground">{emptyMessage}</p></div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Teams</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogTrigger asChild><Button>Create Team</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle>Create a new team</DialogTitle><DialogDescription>Give your team a name. You can invite members later.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">Team Name</Label><Input id="name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="col-span-3" placeholder="e.g., Marketing Team" /></div></div>
              <DialogFooter><Button type="submit" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Select a team</h2>
          {loading ? <p>Loading teams...</p> : teams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (<Link href={`/teams/${team.id}`} key={team.id} legacyBehavior><a className="block"><Card className="hover:bg-accent hover:border-primary transition-colors"><CardHeader><CardTitle>{team.name}</CardTitle></CardHeader></Card></a></Link>))}
            </div>
          ) : (<div className="text-center py-12"><p className="text-muted-foreground">You are not a member of any teams yet.</p><p className="text-muted-foreground mt-2">Create a team to get started.</p></div>)}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-6">Pinned Tools</h2>
          {renderToolList(pinnedTools, "You haven't pinned any tools yet.")}
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-6">Recently Used Tools</h2>
          {renderToolList(recentTools, "You haven't used any tools recently.")}
        </div>
      </div>
    </div>
  );
}

