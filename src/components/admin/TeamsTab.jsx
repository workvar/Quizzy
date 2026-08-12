'use client';
import { useState, useEffect, useCallback } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Modal } from '@/components/Modal';
import { useConfirm } from '@/components/DialogProvider';
import { Spinner, Avatar } from './AdminUI';
import { DropZone } from './UploadQuestionsModal';

function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated(data);
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Team Group" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Track A · Juniors" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateTeamModal({ onClose, onCreated, groups, onGroupsChange }) {
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
  const [groupId, setGroupId] = useState('__none__');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const groupOptions = [
    { value: '__none__', label: 'No group' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  const createGroup = async (name) => {
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    onGroupsChange?.();
    setGroupId(String(data.id));
  };

  const submit = async () => {
    setError('');
    if (!teamname.trim()) { setError('Team name is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }
    setSaving(true);
    try {
      const payload = { name: teamname.trim(), password };
      if (groupId && groupId !== '__none__') payload.groupId = parseInt(groupId);
      const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Team" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Name</label>
          <input value={teamname} onChange={e => setTeamname(e.target.value)} placeholder="e.g. TeamAlpha" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Password</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Team login password" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Group</label>
          <SearchableSelect
            value={groupId}
            onChange={setGroupId}
            options={groupOptions}
            placeholder="Select group…"
            searchPlaceholder="Search or add group…"
            creatable
            onCreate={async (name) => {
              try { await createGroup(name); } catch (e) { setError(e.message); }
            }}
            createLabel={(q) => `Add new: “${q}”`}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Team'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UploadTeamsModal({ onClose, onUploaded, groups, onGroupsChange }) {
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState('__none__');
  const [pendingNewName, setPendingNewName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const groupOptions = [
    { value: '__none__', label: 'No group (optional)' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  const createGroup = async (name) => {
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    onGroupsChange?.();
    setPendingNewName('');
    setGroupId(String(data.id));
    return data;
  };

  const upload = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setError(''); setUploading(true);
    const form = new FormData();
    form.append('csv', file);
    if (groupId && groupId !== '__none__') {
      form.append('groupId', groupId);
    } else if (pendingNewName.trim()) {
      form.append('groupName', pendingNewName.trim());
    }
    try {
      const res = await fetch('/api/admin/teams/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setResult(data);
      onGroupsChange?.();
      onUploaded();
    } catch { setError('Network error'); }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const csv = `name,password\nTeamAlpha,pass123\nTeamBeta,securepass\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'teams_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Import Teams from CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-apple-green/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-apple-text">Import Complete</p>
              <p className="text-sm text-apple-text-2 mt-1">{result.created} team{result.created !== 1 ? 's' : ''} imported</p>
              {result.errors?.length > 0 && result.errors.map((e, i) => <p key={i} className="text-xs text-apple-red mt-1">{e}</p>)}
            </div>
            <button onClick={onClose} className="px-6 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors">Done</button>
          </div>
        ) : (
          <>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none bg-apple-gray/60 border border-apple-gray-2 rounded-apple px-4 py-3 hover:bg-apple-gray transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide">CSV Format Guide</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={e => { e.preventDefault(); downloadTemplate(); }} className="text-xs font-semibold text-apple-blue hover:underline">Download Template</button>
                  <svg className="w-4 h-4 text-apple-text-3 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </summary>
              <div className="mt-2 bg-[#1e1e1e] rounded-apple overflow-hidden">
                <pre className="text-xs text-green-400 font-mono p-4 leading-relaxed">{`name,password\nTeamAlpha,pass123\nTeamBeta,securepass`}</pre>
              </div>
            </details>

            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Assign to Team Group</label>
              <p className="text-xs text-apple-text-3 mb-2">Search for a group, or type a new name and choose Add new.</p>
              <SearchableSelect
                value={pendingNewName ? `__new__:${pendingNewName}` : groupId}
                onChange={(v) => {
                  setPendingNewName('');
                  setGroupId(v);
                }}
                options={
                  pendingNewName
                    ? [...groupOptions, { value: `__new__:${pendingNewName}`, label: pendingNewName }]
                    : groupOptions
                }
                placeholder="Select group for this CSV…"
                searchPlaceholder="Search or add group…"
                creatable
                onCreate={async (name) => {
                  try {
                    await createGroup(name);
                  } catch {
                    // Keep typed name so upload can create via groupName
                    setPendingNewName(name);
                    setGroupId('__none__');
                  }
                }}
                createLabel={(q) => `Add new: “${q}”`}
              />
              {pendingNewName && (
                <p className="text-xs text-apple-blue mt-1.5">Will create group “{pendingNewName}” on import.</p>
              )}
            </div>

            <DropZone file={file} onFile={setFile} />

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
              <button onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-brand-orange-deep transition-colors disabled:opacity-50 flex items-center gap-2">
                {uploading ? <><Spinner size={4} />Importing…</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Import Teams</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function TeamsTab() {
  const confirm = useConfirm();
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [banning, setBanning] = useState({});
  const [updatingGroup, setUpdatingGroup] = useState({});

  const loadGroups = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/groups').then(r => r.json());
      if (Array.isArray(data)) setGroups(data);
    } catch {}
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/teams').then(r => r.json());
      if (Array.isArray(data)) setTeams(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTeams(); loadGroups(); }, [loadTeams, loadGroups]);

  const deleteTeam = async (team) => {
    const ok = await confirm({
      title: 'Delete team?',
      message: `Delete team "${team.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch('/api/admin/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: team.id }) });
      loadTeams();
      loadGroups();
    } catch {}
    setDeleting(prev => ({ ...prev, [team.id]: false }));
  };

  const deleteGroup = async (group) => {
    const ok = await confirm({
      title: 'Delete group?',
      message: `Delete group "${group.name}"? Teams in this group will be unassigned.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await fetch(`/api/admin/groups/${group.id}`, { method: 'DELETE' });
      loadGroups();
      loadTeams();
    } catch {}
  };

  const toggleBan = async (team) => {
    const action = team.isBanned ? 'unban' : 'ban';
    const ok = await confirm({
      title: action === 'ban' ? 'Ban team?' : 'Unban team?',
      message: `${action === 'ban' ? 'Ban' : 'Unban'} team "${team.name}"?`,
      confirmLabel: action === 'ban' ? 'Ban' : 'Unban',
      tone: action === 'ban' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBanning(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch(`/api/admin/teams/${team.id}/ban`, { method: 'POST' });
      loadTeams();
    } catch {}
    setBanning(prev => ({ ...prev, [team.id]: false }));
  };

  const setTeamGroup = async (team, nextGroupId) => {
    setUpdatingGroup(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: nextGroupId === '__none__' ? null : parseInt(nextGroupId) }),
      });
      loadTeams();
      loadGroups();
    } catch {}
    setUpdatingGroup(prev => ({ ...prev, [team.id]: false }));
  };

  const groupSelectOptions = [
    { value: '__none__', label: 'No group' },
    ...groups.map(g => ({ value: String(g.id), label: g.name })),
  ];

  return (
    <div>
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={() => { loadGroups(); }} />}
      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreated={loadTeams} groups={groups} onGroupsChange={loadGroups} />}
      {showUpload && <UploadTeamsModal onClose={() => setShowUpload(false)} onUploaded={loadTeams} groups={groups} onGroupsChange={loadGroups} />}

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Teams</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{teams.length} registered · {groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            Create Group
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-brand-orange-deep transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Create Team
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white border border-apple-gray-2 rounded-apple-lg p-4 shadow-apple-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-apple-text">Team Groups</h3>
          <button onClick={() => setShowCreateGroup(true)} className="text-xs font-semibold text-apple-blue hover:underline">Add group</button>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-apple-text-3">No groups yet. Create one to assign teams and restrict quiz access.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="inline-flex items-center gap-2 bg-apple-gray border border-apple-gray-2 rounded-apple px-3 py-1.5">
                <span className="text-sm font-semibold text-apple-text">{g.name}</span>
                <span className="text-xs text-apple-text-3">{g.teamCount} team{g.teamCount !== 1 ? 's' : ''}</span>
                <button onClick={() => deleteGroup(g)} className="text-apple-text-3 hover:text-apple-red" title="Delete group">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No teams yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-apple-blue font-semibold text-sm hover:underline">Create your first team →</button>
        </div>
      ) : (
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-apple-gray border-b border-apple-gray-2">
                <th className="text-left px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Team Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden md:table-cell">Group</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Score</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Correct</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Attempted</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-gray-2">
              {teams.map(team => (
                <tr key={team.id} className="hover:bg-apple-gray/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={team.name} size={8} />
                      <div>
                        <p className="text-sm font-semibold text-apple-text">{team.name}</p>
                        <p className="text-xs text-apple-text-3 font-mono">#{team.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell min-w-[160px]">
                    <SearchableSelect
                      value={team.groupId ? String(team.groupId) : '__none__'}
                      onChange={(v) => setTeamGroup(team, v)}
                      options={groupSelectOptions}
                      disabled={!!updatingGroup[team.id]}
                      placeholder="No group"
                      searchPlaceholder="Search groups…"
                      className="min-w-[140px]"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-bold font-mono text-apple-blue">{team.total_score || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-green font-semibold">{team.correct_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-text-2">{team.attempted_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    {team.isBanned
                      ? <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Banned</span>
                      : <span className="text-xs text-apple-text-3">Active</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleBan(team)} disabled={banning[team.id]} title={team.isBanned ? 'Unban' : 'Ban'} className={`p-1.5 transition-colors ${team.isBanned ? 'text-apple-green hover:text-green-600' : 'text-orange-400 hover:text-orange-600'}`}>
                        {team.isBanned
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        }
                      </button>
                      <button onClick={() => deleteTeam(team)} disabled={deleting[team.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}