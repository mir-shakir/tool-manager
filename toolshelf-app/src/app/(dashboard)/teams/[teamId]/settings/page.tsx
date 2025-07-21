'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Toaster, toast } from 'sonner';

interface TeamMember {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  users: { id: string; email: string; };
}

interface TeamDetails {
  id: string;
  name: string;
  owner_id: string;
}

export default function TeamSettingsPage({ params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const isOwner = team?.owner_id === currentUser?.id;

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: teamData, error: teamError } = await supabase.from('teams').select('id, name, owner_id').eq('id', teamId).single();
      if (teamError) throw teamError;
      setTeam(teamData);

      const { data: membersData, error: membersError } = await supabase.from('team_members').select(`id, role, users (id, email)`).eq('team_id', teamId);
      if (membersError) throw membersError;
      setMembers(membersData as TeamMember[]);
    } catch (error) {
      console.error('Error fetching team settings:', error);
      toast.error('Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
    fetchTeamData();
  }, [fetchTeamData]);

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    try {
      const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', memberId);
      if (error) throw error;
      toast.success("Member's role updated successfully.");
      fetchTeamData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role.');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', memberId);
      if (error) throw error;
      toast.success('Member removed from team.');
      fetchTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member.');
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) return;
    try {
      const { error } = await supabase.functions.invoke('invite-member', {
        body: { team_id: teamId, email: inviteEmail },
      });
      if (error) throw new Error(error.message);
      
      const { data: responseData, error: responseError } = await supabase.functions.invoke('invite-member', {
        body: { team_id: teamId, email: inviteEmail },
      });

      if(responseError) throw responseError;
      
      // The edge function returns errors in the body, so we check that too
      if (responseData.error) {
        throw new Error(responseData.error);
      }

      toast.success('Invitation sent successfully!');
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      fetchTeamData();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error(`Failed to invite member: ${error.message}`);
    }
  };

  if (loading) return <p>Loading settings...</p>;
  if (!team) return <p>Team not found.</p>;

  return (
    <div>
      <Toaster richColors />
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Settings for {team.name}</h1>
          <p className="text-muted-foreground">Manage your team members and their roles.</p>
        </div>
        {isOwner && (
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild><Button>Invite Member</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle>Invite a new member</DialogTitle><DialogDescription>Enter the email of the person you want to invite.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="col-span-3" />
                </div>
              </div>
              <DialogFooter><Button onClick={handleInviteMember}>Send Invitation</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.users.email}</TableCell>
                <TableCell>
                  {isOwner && member.users.id !== currentUser?.id ? (
                    <Select value={member.role} onValueChange={(value: 'admin' | 'editor' | 'viewer') => handleRoleChange(member.id, value)}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (member.role.charAt(0).toUpperCase() + member.role.slice(1))}
                </TableCell>
                <TableCell className="text-right">
                  {isOwner && member.users.id !== currentUser?.id && (<Button variant="destructive" size="sm" onClick={() => handleRemoveMember(member.id)}>Remove</Button>)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
