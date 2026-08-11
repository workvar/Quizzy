import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { parse } from 'csv-parse/sync';
import prisma from '@/lib/prisma';
import { findOrCreateGroupByName } from '@/lib/team-groups';

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('csv');
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });

  let resolvedGroupId = null;
  const groupIdRaw = formData.get('groupId');
  const groupNameRaw = formData.get('groupName');

  try {
    if (groupIdRaw && String(groupIdRaw).trim() && String(groupIdRaw) !== '__none__') {
      resolvedGroupId = parseInt(groupIdRaw);
      const exists = await prisma.teamGroup.findUnique({ where: { id: resolvedGroupId } });
      if (!exists) return NextResponse.json({ error: 'Team group not found' }, { status: 400 });
    } else if (groupNameRaw && String(groupNameRaw).trim()) {
      const group = await findOrCreateGroupByName(String(groupNameRaw));
      resolvedGroupId = group.id;
    }

    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    const created = [];
    const errors = [];

    for (const record of records) {
      const name = record['name'] || record['Name'] || record['TeamName'] || record['team_name'];
      const password = record['password'] || record['Password'];
      if (!name || !password) { errors.push('Skipped row: missing name or password'); continue; }

      let rowGroupId = resolvedGroupId;
      const rowGroup = record['group'] || record['Group'] || record['team_group'] || record['TeamGroup'];
      if (rowGroup && String(rowGroup).trim()) {
        try {
          const g = await findOrCreateGroupByName(String(rowGroup));
          rowGroupId = g.id;
        } catch {
          errors.push(`Invalid group for team "${name}"`);
          continue;
        }
      }

      try {
        const team = await prisma.team.create({
          data: {
            name: name.trim(),
            password: password.trim(),
            ...(rowGroupId ? { groupId: rowGroupId } : {}),
          },
        });
        created.push({ id: team.id, name });
      } catch {
        errors.push(`Team "${name}" already exists`);
      }
    }

    return NextResponse.json({
      created: created.length,
      errors,
      groupId: resolvedGroupId,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
