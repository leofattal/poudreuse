/* ---------------------------------------------------------------------
   cloud.js — Supabase bridge (leaderboard + optional Google auth + save)

   Loaded as an ES module, so it CANNOT see the classic scripts' `const P`,
   `UI`, `Game` (those live in the global lexical scope, not on window).
   This file is therefore a pure data/auth layer: it exposes `window.Cloud`
   and dispatches DOM events. The classic scripts (which *can* see P/UI/Game)
   listen for those events and do all state mutation. See the glue block at
   the bottom of game.js.
------------------------------------------------------------------------ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ikqwsxnczncfhsbmswaz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qNDg7512_DnsgHTmCEJ7_w_F0J7TS1S';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let session = null;
let saveTimer = null;

/* ---- identity helpers ---- */
function user(){ return session ? session.user : null; }
function signedIn(){ return !!user(); }
function nameOf(){
  const u = user(); if(!u) return null;
  const m = u.user_metadata || {};
  return m.full_name || m.name || (u.email ? u.email.split('@')[0] : 'Rider');
}
function avatarOf(){
  const u = user(); if(!u) return null;
  const m = u.user_metadata || {};
  return m.avatar_url || m.picture || null;
}

/* ---- leaderboard ---- */
async function submitScore({ mountainId, score, accuracy, board, displayName }){
  score = Math.max(0, Math.min(20000, Math.round(score || 0)));
  accuracy = Math.max(0, Math.min(100, Math.round(accuracy || 0)));
  if(signedIn()){
    // keep only the user's best row per mountain
    const { data: ex } = await sb.from('scores')
      .select('score').eq('user_id', user().id).eq('mountain_id', mountainId).maybeSingle();
    if(ex && ex.score >= score) return { skipped: true, best: ex.score };
    const { error } = await sb.from('scores').upsert({
      mountain_id: mountainId, score, accuracy, board: board || null,
      user_id: user().id, display_name: nameOf(), avatar_url: avatarOf(),
    }, { onConflict: 'user_id,mountain_id' });
    if(error) throw error;
    return { ok: true, best: score };
  }
  const name = (displayName || 'Rider').trim().slice(0, 20) || 'Rider';
  const { error } = await sb.from('scores').insert({
    mountain_id: mountainId, score, accuracy, board: board || null,
    user_id: null, display_name: name,
  });
  if(error) throw error;
  return { ok: true };
}

async function fetchLeaderboard(mountainId, limit = 50){
  const { data, error } = await sb.from('scores')
    .select('display_name,avatar_url,score,accuracy,created_at,user_id')
    .eq('mountain_id', mountainId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if(error) throw error;
  return data || [];
}

/* ---- auth ---- */
async function signInWithGoogle(){
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if(error) throw error;
}
async function signOut(){ await sb.auth.signOut(); }

/* ---- cloud save (the P object) ---- */
async function pullSave(){
  if(!signedIn()) return null;
  const { data, error } = await sb.from('saves')
    .select('data,updated_at').eq('user_id', user().id).maybeSingle();
  if(error){ console.warn('[cloud] pullSave', error.message); return null; }
  return data;                                  // { data, updated_at } or null
}
async function pushSave(P){
  if(!signedIn() || !P) return;
  const { error } = await sb.from('saves').upsert({
    user_id: user().id, data: P, xp: P.xp | 0, coins: P.coins | 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if(error) console.warn('[cloud] pushSave', error.message);
}
function queueSave(P){                            // debounced push, called from persist()
  if(!signedIn()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => pushSave(P), 1500);
}
async function upsertProfile(){
  if(!signedIn()) return;
  await sb.from('profiles').upsert({
    id: user().id, display_name: nameOf(), avatar_url: avatarOf(),
    updated_at: new Date().toISOString(),
  }).then(({ error }) => { if(error) console.warn('[cloud] profile', error.message); });
}

/* ---- expose to classic scripts ---- */
window.Cloud = {
  ready: false,
  isSignedIn: signedIn, user, nameOf, avatarOf,
  submitScore, fetchLeaderboard,
  signInWithGoogle, signOut,
  pullSave, pushSave, queueSave, upsertProfile,
};

/* ---- boot + auth wiring ---- */
async function announceAuth(){                     // signed-in: sync profile + hand save to classic side
  if(!signedIn()) return;
  upsertProfile();
  const row = await pullSave();
  window.dispatchEvent(new CustomEvent('cloud-save', { detail: row }));
}

let booted = false;
sb.auth.onAuthStateChange((event, s) => {
  const was = signedIn();
  session = s;
  const now = signedIn();

  if(!booted){                                     // first fire = INITIAL_SESSION (restored session or none)
    booted = true;
    window.Cloud.ready = true;
    window.dispatchEvent(new Event('cloud-ready'));
    if(now) announceAuth();                         // restored session → merge cloud save (no greeting)
    return;
  }

  window.dispatchEvent(new Event('cloud-auth'));    // any later change → refresh UI
  if(now && !was){                                  // fresh sign-in (e.g. returning from Google OAuth)
    announceAuth();
    window.dispatchEvent(new Event('cloud-signin'));
  }
});
