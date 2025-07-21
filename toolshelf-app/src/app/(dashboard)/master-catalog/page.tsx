'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toaster, toast } from 'sonner';
import { User } from '@supabase/supabase-js';

// Define types
interface MasterTool {
  id: string;
  title: string;
  description: string;
  external_link: string;
  category: string;
  tags: string[];
}

interface Team {
  id: string;
  name: string;
}

export default function MasterCatalogPage() {
  const [tools, setTools] = useState<MasterTool[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [shelfToolIds, setShelfToolIds] = useState<Set<string>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch user's teams
  const fetchTeams = useCallback(async (currentUser: User) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('team_members')
      .select('teams(id, name)')
      .eq('user_id', currentUser.id);
    if (error) {
      console.error('Error fetching teams:', error);
    } else {
      const validTeams = data?.map(item => item.teams).filter((team): team is Team => team !== null) || [];
      setTeams(validTeams);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchTeams(user);
    }
  }, [user, fetchTeams]);

  // Fetch tools already on the selected team's shelf
  const fetchShelfTools = useCallback(async (teamId: string) => {
    const { data, error } = await supabase
      .from('team_shelf_tools')
      .select('master_tool_id')
      .eq('team_id', teamId)
      .not('master_tool_id', 'is', null);
    
    if (error) {
      console.error('Error fetching shelf tools:', error);
    } else {
      const ids = new Set(data.map(t => t.master_tool_id as string));
      setShelfToolIds(ids);
    }
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchShelfTools(selectedTeamId);
    } else {
      setShelfToolIds(new Set());
    }
  }, [selectedTeamId, fetchShelfTools]);

  // Fetch master tools with search
  useEffect(() => {
    const fetchMasterTools = async () => {
      try {
        setLoading(true);
        let query = supabase.from('master_tools').select('*');
        if (searchTerm) {
          query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        setTools(data || []);
      } catch (error) {
        console.error('Error fetching master tools:', error);
        toast.error('Failed to load tools.');
      } finally {
        setLoading(false);
      }
    };
    const debounceTimer = setTimeout(() => fetchMasterTools(), 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleAddToolToShelf = async (toolId: string) => {
    if (!selectedTeamId || !user) {
      toast.error('Please select a team first.');
      return;
    }
    try {
      const { error } = await supabase.from('team_shelf_tools').insert({
        team_id: selectedTeamId,
        master_tool_id: toolId,
        added_by_user_id: user.id,
      });
      if (error) throw error;
      toast.success('Tool added to shelf!');
      // Refresh shelf tool IDs to disable the button
      fetchShelfTools(selectedTeamId);
    } catch (error) {
      console.error('Error adding tool to shelf:', error);
      toast.error('Failed to add tool. It might already be on the shelf.');
    }
  };

  return (
    <div>
      <Toaster richColors />
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Master Tool Catalog</h1>
          <p className="text-muted-foreground">
            Browse and search for tools to add to your team's shelf.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select onValueChange={setSelectedTeamId} value={selectedTeamId || undefined}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a team to add to" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Search for tools by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <p>Loading tools...</p>
      ) : tools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div key={tool.id} className="border rounded-lg p-4 flex flex-col">
              <h2 className="text-lg font-bold">{tool.title}</h2>
              <p className="text-sm text-muted-foreground mt-1 flex-grow">{tool.description}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs font-semibold bg-secondary text-secondary-foreground py-1 px-2 rounded-full">
                  {tool.category}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAddToolToShelf(tool.id)}
                  disabled={!selectedTeamId || shelfToolIds.has(tool.id)}
                >
                  {shelfToolIds.has(tool.id) ? 'Added' : 'Add to Shelf'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tools found.</p>
        </div>
      )}
    </div>
  );
}
