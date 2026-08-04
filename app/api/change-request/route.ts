import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json();
  const { week_key, day_name, row_key, slot, current_doctor, requested_doctor, reason } = body;

  // Validation basique
  if (!week_key || !day_name || !row_key || !requested_doctor) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, doctor_code')
    .eq('id', user.id)
    .single();

  const profileRole = profile?.role?.toLowerCase() || '';
  const doctorCode = profile?.doctor_code?.toUpperCase() || '';
  const userEmail = user.email?.toLowerCase() || '';

  const isAdmin = profileRole === 'admin' || 
                  profileRole === 'administrateur' ||
                  userEmail.includes('admin') || 
                  ['M', 'Z', 'L'].includes(doctorCode) ||
                  userEmail.includes('lucie') ||
                  userEmail.includes('ouissem');

  // Si l'utilisateur n'est pas admin, vérifier qu'il est bien l'occupant (locataire) de la case
  if (!isAdmin) {
    const { data: scheduleDataRow } = await adminDb
      .from('schedules')
      .select('schedule_data')
      .eq('week_key', week_key)
      .maybeSingle();

    const scheduleObj = (scheduleDataRow?.schedule_data || {}) as Record<string, Record<string, { value?: string[] }>>;
    const cellValues = scheduleObj[row_key]?.[day_name]?.value || [];
    const isTenant = Boolean(doctorCode && cellValues.includes(doctorCode));

    if (!isTenant) {
      return NextResponse.json(
        { error: "Seul le médecin occupant de la case (locataire) est autorisé à en demander le changement." },
        { status: 403 }
      );
    }
  }

  // Vérifier que la case n'est pas déjà en demande
  const { data: existing } = await adminDb
    .from('change_requests')
    .select('id')
    .eq('week_key', week_key)
    .eq('day_name', day_name)
    .eq('row_key', row_key)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Une demande est déjà en attente pour cette case' }, { status: 409 });
  }

  const { data, error } = await adminDb
    .from('change_requests')
    .insert({
      requester_id: user.id,
      week_key,
      day_name,
      row_key,
      slot,
      current_doctor,
      requested_doctor,
      reason,
    })
    .select()
    .single();

  if (error) {
    console.error('[change-request] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
