import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Vérifier que la case n'est pas déjà en demande (optionnel)
  const { data: existing } = await supabase
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

  const { data, error } = await supabase
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
