// Spoken NPC voice clips live in Firestore as small MP3s (rooms/{roomId}/npcClips/{id}), not in
// Storage: Storage's free daily download allowance is shared with the maps and runs out.
import { Mp3Encoder } from '@breezystack/lamejs';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** A chat line's audioUrl that points at a clip in Firestore instead of a web address. */
export const CLIP_REF_PREFIX = 'npc-clip:';

const CLIP_RATE = 22050;
// Firestore documents top out at 1 MB, so long clips are squeezed harder
const MAX_BASE64 = 900_000;

const clipsPath = (roomId: string) => `rooms/${roomId}/npcClips`;

/** Any clip (WAV or MP3) as a mono 22 kHz MP3, base64-encoded. */
export async function compressClip(clip: Blob): Promise<string> {
  const decoder = new OfflineAudioContext(1, 1, CLIP_RATE);
  const input = await decoder.decodeAudioData(await clip.arrayBuffer());
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(input.duration * CLIP_RATE)), CLIP_RATE);
  const source = ctx.createBufferSource();
  source.buffer = input;
  source.connect(ctx.destination);
  source.start();
  const samples = (await ctx.startRendering()).getChannelData(0);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  for (const kbps of [40, 24, 16]) {
    const b64 = toBase64(encodeMp3(pcm, kbps));
    if (b64.length <= MAX_BASE64) return b64;
  }
  throw new Error('That line is too long to save as a voice clip');
}

function encodeMp3(pcm: Int16Array, kbps: number): Uint8Array {
  const encoder = new Mp3Encoder(1, CLIP_RATE, kbps);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) parts.push(encoder.encodeBuffer(pcm.subarray(i, i + 1152)));
  parts.push(encoder.flush());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Saves a clip and returns the reference to put on the chat line. */
export async function saveClip(roomId: string, id: string, clip: Blob, createdAt: number): Promise<string> {
  if (!db) throw new Error('No database connection');
  const data = await compressClip(clip);
  await setDoc(doc(db, clipsPath(roomId), id), { id, data, createdAt });
  return CLIP_REF_PREFIX + id;
}

/** Something an <audio> element can play: the clip from Firestore, or an older Storage address as is. */
export async function clipSource(roomId: string | null | undefined, ref: string): Promise<string> {
  if (!ref.startsWith(CLIP_REF_PREFIX)) return ref;
  if (!db || !roomId) throw new Error('No database connection');
  const snap = await getDoc(doc(db, clipsPath(roomId), ref.slice(CLIP_REF_PREFIX.length)));
  const data = snap.data()?.data;
  if (typeof data !== 'string') throw new Error('Voice clip is gone');
  return `data:audio/mpeg;base64,${data}`;
}

/** Deletes clips saved before the cutoff. */
export async function sweepClips(roomId: string, cutoff: number): Promise<void> {
  if (!db) return;
  const old = await getDocs(query(collection(db, clipsPath(roomId)), where('createdAt', '<', cutoff)));
  await Promise.all(old.docs.map(d => deleteDoc(d.ref).catch(() => {})));
}
