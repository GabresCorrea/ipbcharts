import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, Music, Play, Pause, Edit3, Trash2, Youtube, ChevronUp, ChevronDown, X, Search, Save, ArrowLeft, Hash, Activity, Clock, LogOut } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* Conexão com o Supabase — os valores vêm das variáveis de ambiente
   configuradas na Vercel (ver guia). Em desenvolvimento local você pode
   criar um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/* ============================================================
   IPBCharts — Plataforma de cifras do louvor (estilo ChartBuilder)
   Verde escuro + branco, premium. Dados via Supabase (banco + login + tempo real).
   Escrita simples: acordes em cima, letra embaixo (duas linhas).
   ============================================================ */

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm"]);

// Tipos de seção + cor própria (todas distintas)
const SECTION_TYPES = [
  "Introdução", "Intro", "Verso", "Pré-Refrão", "Refrão", "Ponte",
  "Interlúdio", "Turnaround", "Repete", "Saída", "Final", "Instrumental", "Solo"
];
const SECTION_COLORS = {
  "Introdução": "#e0b341", "Intro": "#c98a2b",
  "Verso": "#4f9dde", "Pré-Refrão": "#9b6ef0", "Refrão": "#e8554d",
  "Ponte": "#34c98a", "Interlúdio": "#3fb6c9", "Turnaround": "#f0883e",
  "Repete": "#ec6aa8", "Saída": "#7a86f0", "Final": "#9aa3ad",
  "Instrumental": "#2bc4b0", "Solo": "#c06ef0"
};

/* ---------- Transposição ---------- */
function parseChordRoot(chord) {
  const m = chord.match(/^([A-G])(b|#)?/);
  if (!m) return null;
  const root = m[1] + (m[2] || "");
  let idx = NOTES_SHARP.indexOf(root);
  if (idx === -1) idx = NOTES_FLAT.indexOf(root);
  return { idx, rest: chord.slice(m[0].length) };
}
function transposeChord(chord, semitones, useFlats) {
  const p = parseChordRoot(chord);
  if (!p || p.idx === -1) return chord;
  const newIdx = (((p.idx + semitones) % 12) + 12) % 12;
  const scale = useFlats ? NOTES_FLAT : NOTES_SHARP;
  let rest = p.rest;
  const slash = rest.match(/\/([A-G])(b|#)?/);
  if (slash) {
    const bass = parseChordRoot(slash[1] + (slash[2] || ""));
    if (bass && bass.idx !== -1) {
      const nb = (((bass.idx + semitones) % 12) + 12) % 12;
      rest = rest.replace(slash[0], "/" + scale[nb]);
    }
  }
  return scale[newIdx] + rest;
}
function transposeKey(key, semitones, useFlats) {
  const minor = key.endsWith("m") && !key.endsWith("dim");
  const base = minor ? key.slice(0, -1) : key;
  const t = transposeChord(base, semitones, useFlats);
  return minor ? t + "m" : t;
}
// transposeText: transpõe só o que estiver entre colchetes [G]
function transposeText(text, semitones, useFlats) {
  if (!text) return text;
  return text.replace(/\[([^\]]+)\]/g, (full, ch) => "[" + transposeChord(ch.trim(), semitones, useFlats) + "]");
}

/* ---------- Render de uma linha com acordes inline posicionados livremente ----------
   Acorde digitado entre colchetes [G] aparece flutuando exatamente sobre a sílaba seguinte.
   Linhas só com acordes (sem letra) também funcionam. */
function ChartLine({ line, semitones, useFlats }) {
  if (!line.trim()) return <div style={{ height: "0.8em" }} />;
  const t = transposeText(line, semitones, useFlats);
  const parts = t.split(/(\[[^\]]+\])/g).filter(p => p !== "");
  const hasLyrics = parts.some(p => !(p.startsWith("[") && p.endsWith("]")) && p.trim() !== "");
  if (!hasLyrics) {
    return (
      <div style={{ lineHeight: 1.9, color: "#2f9d63", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 15.5, whiteSpace: "pre-wrap" }}>
        {parts.map((p, i) => p.startsWith("[") ? p.slice(1, -1) + "  " : p)}
      </div>
    );
  }
  return (
    <div style={{ lineHeight: 2.5, whiteSpace: "pre-wrap", fontFamily: "'Space Mono',monospace", fontSize: 15.5, color: "#1a2b22" }}>
      {parts.map((p, i) => {
        if (p.startsWith("[") && p.endsWith("]")) {
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", verticalAlign: "baseline" }}>
              <span style={{ position: "absolute", top: "-1.35em", left: 0, whiteSpace: "nowrap", color: "#2f9d63", fontWeight: 700, fontSize: 14 }}>
                {p.slice(1, -1)}
              </span>
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}

function RenderBlock({ content, semitones, useFlats }) {
  const lines = content.split("\n");
  return (
    <div>
      {lines.map((line, i) => <ChartLine key={i} line={line} semitones={semitones} useFlats={useFlats} />)}
    </div>
  );
}

/* ---------- Metrônomo ---------- */
function useMetronome(bpm) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const beatRef = useRef(0);
  const click = useCallback((accent) => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 900;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
  }, []);
  useEffect(() => {
    if (playing) {
      const interval = 60000 / (bpm || 120);
      beatRef.current = 0; click(true); setBeat(1);
      timerRef.current = setInterval(() => {
        beatRef.current = (beatRef.current + 1) % 4;
        click(beatRef.current === 0);
        setBeat(beatRef.current + 1);
      }, interval);
    } else { clearInterval(timerRef.current); setBeat(0); }
    return () => clearInterval(timerRef.current);
  }, [playing, bpm, click]);
  return { playing, setPlaying, beat };
}

/* ---------- App ---------- */
export default function IPBCharts() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [current, setCurrent] = useState(null);
  const [search, setSearch] = useState("");
  const [memberName, setMemberName] = useState("");

  // ----- Autenticação -----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // nome do membro a partir do email logado
  useEffect(() => {
    if (session?.user) {
      const meta = session.user.user_metadata || {};
      setMemberName(meta.nome || session.user.email.split("@")[0]);
    }
  }, [session]);

  // ----- Carregar cifras do banco -----
  const loadSongs = useCallback(async () => {
    const { data, error } = await supabase
      .from("songs").select("*").order("title", { ascending: true });
    if (!error && data) {
      setSongs(data.map(row => ({ ...row.data, id: row.id })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadSongs();
    // tempo real: qualquer mudança na tabela recarrega a lista para todos
    const channel = supabase
      .channel("songs-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, () => loadSongs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, loadSongs]);

  // ----- Salvar / excluir (gravam no banco; o realtime atualiza todos) -----
  const saveSong = useCallback(async (song) => {
    const { id, ...rest } = song;
    const payload = { id, data: { ...rest }, updated_by: memberName || "anônimo" };
    const { error } = await supabase.from("songs").upsert(payload);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    loadSongs();
  }, [memberName, loadSongs]);

  const deleteSong = useCallback(async (id) => {
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    loadSongs();
  }, [loadSongs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return songs;
    return songs.filter(s => s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q));
  }, [songs, search]);

  const styleTag = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: #0a1f17; }
      ::-webkit-scrollbar-thumb { background: #1d4435; border-radius: 5px; }
      ::selection { background: #2f7d57; color: #fff; }
    `}</style>
  );

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#08160f", display: "flex", alignItems: "center", justifyContent: "center", color: "#7fce9f", fontFamily: "'Manrope',sans-serif" }}>
        {styleTag}<Music style={{ marginRight: 10 }} /> Iniciando…
      </div>
    );
  }

  if (!session) {
    return <div>{styleTag}<AuthScreen /></div>;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#08160f", display: "flex", alignItems: "center", justifyContent: "center", color: "#7fce9f", fontFamily: "'Manrope',sans-serif" }}>
        {styleTag}<Music style={{ marginRight: 10 }} /> Carregando repertório…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", color: "#eef5f0", fontFamily: "'Manrope',sans-serif" }}>
      {styleTag}
      {view === "list" && <SongList songs={filtered} allCount={songs.length} search={search} setSearch={setSearch}
        memberName={memberName} onLogout={() => supabase.auth.signOut()}
        onOpen={s => { setCurrent(s); setView("view"); }} onNew={() => { setCurrent(null); setView("edit"); }} />}
      {view === "view" && current && <SongView song={current} onBack={() => setView("list")} onEdit={() => setView("edit")} />}
      {view === "edit" && <SongEditor song={current} memberName={memberName}
        onCancel={() => setView(current ? "view" : "list")}
        onSave={s => { saveSong(s); setCurrent(s); setView("view"); }}
        onDelete={current ? () => { deleteSong(current.id); setView("list"); } : null} />}
    </div>
  );
}

/* ---------- Tela de Login / Cadastro ---------- */
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password: pass,
          options: { data: { nome: nome.trim() } }
        });
        if (error) throw error;
        setMsg("Conta criada! Se pedir confirmação, verifique seu email. Depois é só entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
      }
    } catch (e) {
      setMsg(e.message === "Invalid login credentials" ? "Email ou senha incorretos." : e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Manrope',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#ffffff 0%,#dff0e6 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 32px rgba(0,0,0,.4)" }}>
            <Music size={34} color="#0d3d28" />
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 46, color: "#fff", margin: "16px 0 2px", letterSpacing: -0.5 }}>IPBCharts</h1>
          <p style={{ color: "#6fae8a", margin: 0 }}>Repertório do louvor</p>
        </div>
        <div style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 18, padding: 26 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 26, color: "#fff", margin: "0 0 18px" }}>
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h2>
          {mode === "signup" && (
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={authLabel}>Seu nome</span>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle()} placeholder="Ex: João" />
            </label>
          )}
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={authLabel}>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle()} placeholder="voce@email.com" />
          </label>
          <label style={{ display: "block", marginBottom: 18 }}>
            <span style={authLabel}>Senha</span>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle()} placeholder="••••••••" />
          </label>
          {msg && <div style={{ background: "rgba(63,174,107,.12)", border: "1px solid #1d6b46", color: "#9fdabb", padding: "10px 12px", borderRadius: 10, fontSize: 13.5, marginBottom: 14, lineHeight: 1.5 }}>{msg}</div>}
          <button onClick={submit} disabled={busy} style={{ ...primaryBtn(), width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Aguarde…" : (mode === "login" ? "Entrar" : "Criar conta")}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, color: "#6fae8a", fontSize: 14 }}>
            {mode === "login" ? (
              <>Ainda não tem conta? <button onClick={() => { setMode("signup"); setMsg(""); }} style={linkBtn}>Cadastre-se</button></>
            ) : (
              <>Já tem conta? <button onClick={() => { setMode("login"); setMsg(""); }} style={linkBtn}>Entrar</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const authLabel = { display: "block", fontSize: 12, color: "#6fae8a", marginBottom: 6, fontWeight: 600, letterSpacing: 0.4 };
const linkBtn = { background: "none", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "'Manrope',sans-serif", fontSize: 14, textDecoration: "underline" };

/* ---------- Lista ---------- */
function SongList({ songs, allCount, search, setSearch, memberName, onLogout, onOpen, onNew }) {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 22px 90px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 38 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#ffffff 0%,#dff0e6 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.5)" }}>
            <Music size={30} color="#0d3d28" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 42, letterSpacing: -0.5, color: "#fff", lineHeight: 1 }}>IPBCharts</h1>
            <p style={{ margin: 0, color: "#6fae8a", fontSize: 14, letterSpacing: 0.3 }}>Repertório do louvor · {allCount} {allCount === 1 ? "música" : "músicas"}</p>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#6fae8a", display: "flex", alignItems: "center", gap: 10 }}>
          Olá, <strong style={{ color: "#fff" }}>{memberName}</strong>
          <button onClick={onLogout} style={{ ...ghostBtn(), padding: "6px 12px" }}><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 15, top: 15, color: "#5d917a" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar música ou artista…" style={inputStyle({ paddingLeft: 44 })} />
        </div>
        <button onClick={onNew} style={primaryBtn()}><Plus size={18} /> Nova cifra</button>
      </div>

      {songs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 18 }}>
          <Music size={42} style={{ opacity: 0.45, marginBottom: 14 }} />
          <p>Nenhuma cifra ainda. Adicione a primeira do repertório!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {songs.map(s => (
            <button key={s.id} onClick={() => onOpen(s)} style={cardStyle()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2f7d57"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#15392b"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 23, color: "#fff", letterSpacing: -0.2 }}>{s.title}</div>
                <div style={{ color: "#6fae8a", fontSize: 14 }}>{s.artist || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#9fc7b2", fontSize: 13 }}>
                <span style={chip()}><Hash size={13} /> {s.key || "—"}</span>
                <span style={chip()}><Activity size={13} /> {s.bpm || "—"}</span>
                {s.youtube && <Youtube size={18} color="#e8554d" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Visualização ---------- */
function SongView({ song, onBack, onEdit }) {
  const [semitones, setSemitones] = useState(0);
  const [capo, setCapo] = useState(0);
  const baseKey = song.key || "C";
  // som real (tom que soa) = base + transposição do usuário
  const useFlats = FLAT_KEYS.has(transposeKey(baseKey, semitones, false)) || semitones < 0;
  const soundingKey = transposeKey(baseKey, semitones, useFlats);
  // formas exibidas = som real menos o capotraste
  const shapeShift = semitones - capo;
  const shapeUseFlats = FLAT_KEYS.has(transposeKey(baseKey, shapeShift, false)) || shapeShift < 0;
  const shapeKey = transposeKey(baseKey, shapeShift, shapeUseFlats);
  const { playing, setPlaying, beat } = useMetronome(song.bpm || 120);
  const ytId = useMemo(() => extractYouTubeId(song.youtube), [song.youtube]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={onBack} style={ghostBtn()}><ArrowLeft size={18} /> Voltar</button>
        <button onClick={onEdit} style={ghostBtn()}><Edit3 size={16} /> Editar</button>
      </div>

      {/* Cabeçalho premium */}
      <div style={{ background: "linear-gradient(135deg,#0f4a30 0%,#0a3422 100%)", border: "1px solid #1d6b46", borderRadius: 20, padding: 26, marginBottom: 24, boxShadow: "0 20px 50px rgba(0,0,0,.45)" }}>
        <h1 style={{ margin: "0 0 4px", fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 40, color: "#fff", letterSpacing: -0.3, lineHeight: 1.05 }}>{song.title}</h1>
        <p style={{ margin: "0 0 20px", color: "#9fdabb", fontSize: 16 }}>{song.artist}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MetaBox label="TOM" value={soundingKey} accent />
          <MetaBox label="ANDAMENTO" value={(song.bpm || "—") + " BPM"} />
          <MetaBox label="COMPASSO" value={song.timeSig || "4/4"} />
          {song.feel && <MetaBox label="LEVADA" value={song.feel} />}
          {capo > 0 && <MetaBox label={`CAPO ${capo}ª`} value={shapeKey} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.3)", borderRadius: 12, padding: "6px 8px" }}>
            <span style={{ fontSize: 11, color: "#9fdabb", paddingLeft: 6, letterSpacing: 1 }}>TRANSPOR</span>
            <button onClick={() => setSemitones(s => s - 1)} style={stepBtn()}><ChevronDown size={18} /></button>
            <span style={{ minWidth: 34, textAlign: "center", fontWeight: 700, color: semitones === 0 ? "#9fdabb" : "#fff" }}>{semitones > 0 ? "+" : ""}{semitones}</span>
            <button onClick={() => setSemitones(s => s + 1)} style={stepBtn()}><ChevronUp size={18} /></button>
            {semitones !== 0 && <button onClick={() => setSemitones(0)} style={{ ...ghostBtn(), padding: "4px 10px", fontSize: 12 }}>reset</button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.3)", borderRadius: 12, padding: "6px 8px" }}>
            <span style={{ fontSize: 11, color: "#9fdabb", paddingLeft: 6, letterSpacing: 1 }}>CAPO</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtn()}><ChevronDown size={18} /></button>
            <span style={{ minWidth: 38, textAlign: "center", fontWeight: 700, color: capo === 0 ? "#9fdabb" : "#fff" }}>{capo === 0 ? "—" : capo + "ª"}</span>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtn()}><ChevronUp size={18} /></button>
          </div>
          <button onClick={() => setPlaying(p => !p)} style={{ ...stepBtn(), width: "auto", padding: "9px 16px", background: playing ? "#fff" : "rgba(0,0,0,.3)", color: playing ? "#0d3d28" : "#fff", display: "flex", gap: 8, fontWeight: 600 }}>
            {playing ? <Pause size={16} /> : <Play size={16} />} Metrônomo
          </button>
          {playing && <div style={{ display: "flex", gap: 6 }}>{[1, 2, 3, 4].map(b => <div key={b} style={{ width: 12, height: 12, borderRadius: "50%", background: beat === b ? (b === 1 ? "#e8554d" : "#fff") : "rgba(255,255,255,.2)" }} />)}</div>}
        </div>
      </div>

      {/* Seções */}
      <div style={{ display: "grid", gap: 16 }}>
        {(song.sections || []).map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || "#3fae6b";
          return (
            <div key={i} style={{ background: "#fbfdfb", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.3)", borderLeft: `6px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", background: hexToSoft(color) }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                <span style={{ fontWeight: 700, color: darken(color), textTransform: "uppercase", fontSize: 13, letterSpacing: 1 }}>
                  {sec.type}{sec.label ? ` ${sec.label}` : ""}
                </span>
                {sec.repeat && <span style={{ fontSize: 12, color: darken(color), opacity: 0.7 }}>×{sec.repeat}</span>}
              </div>
              <div style={{ padding: "16px 20px 18px" }}>
                <RenderBlock content={sec.content} semitones={shapeShift} useFlats={shapeUseFlats} />
              </div>
            </div>
          );
        })}
      </div>

      {ytId && (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#9fdabb" }}>
            <Youtube size={20} color="#e8554d" /> <span style={{ fontWeight: 600 }}>Versão original</span>
          </div>
          <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 16, overflow: "hidden", border: "1px solid #1d4435" }}>
            <iframe src={`https://www.youtube.com/embed/${ytId}`} title="YouTube"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaBox({ label, value, accent }) {
  return (
    <div style={{ background: accent ? "#fff" : "rgba(0,0,0,.28)", color: accent ? "#0d3d28" : "#eef5f0", borderRadius: 13, padding: "10px 18px", minWidth: 86 }}>
      <div style={{ fontSize: 10.5, opacity: 0.65, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Manrope',sans-serif", letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}

/* ---------- Editor ---------- */
function SongEditor({ song, memberName, onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState(song?.title || "");
  const [artist, setArtist] = useState(song?.artist || "");
  const [key, setKey] = useState(song?.key || "C");
  const [bpm, setBpm] = useState(song?.bpm || 120);
  const [timeSig, setTimeSig] = useState(song?.timeSig || "4/4");
  const [feel, setFeel] = useState(song?.feel || "");
  const [youtube, setYoutube] = useState(song?.youtube || "");
  const [sections, setSections] = useState(song?.sections?.length ? song.sections : [
    { type: "Introdução", label: "", repeat: "", content: "[C] [G] [Am] [F]" }
  ]);

  const addSection = () => setSections([...sections, { type: "Verso", label: "", repeat: "", content: "" }]);
  const update = (i, f, v) => setSections(sections.map((s, x) => x === i ? { ...s, [f]: v } : s));
  const remove = i => setSections(sections.filter((_, x) => x !== i));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= sections.length) return; const a = [...sections]; [a[i], a[j]] = [a[j], a[i]]; setSections(a); };

  const handleSave = () => {
    if (!title.trim()) { alert("Dê um título à música."); return; }
    onSave({
      id: song?.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(), artist: artist.trim(), key, bpm: Number(bpm) || 0,
      timeSig, feel: feel.trim(), youtube: youtube.trim(),
      sections: sections.filter(s => s.content.trim() || s.type),
      updatedBy: memberName || "anônimo", updatedAt: Date.now()
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 130px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <button onClick={onCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: 28, color: "#fff" }}>{song ? "Editar cifra" : "Nova cifra"}</h2>
        <button onClick={handleSave} style={primaryBtn()}><Save size={16} /> Salvar</button>
      </div>

      <div style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 18, padding: 22, marginBottom: 20 }}>
        <Field label="Título"><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()} placeholder="Ex: Bondade de Deus" /></Field>
        <Field label="Artista / Ministério"><input value={artist} onChange={e => setArtist(e.target.value)} style={inputStyle()} placeholder="Ex: Isaías Saad" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14 }}>
          <Field label="Tom">
            <select value={key} onChange={e => setKey(e.target.value)} style={inputStyle()}>
              {["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B","Cm","C#m","Dm","D#m","Ebm","Em","Fm","F#m","Gm","G#m","Am","A#m","Bbm","Bm"].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="BPM"><input type="number" value={bpm} onChange={e => setBpm(e.target.value)} style={inputStyle()} /></Field>
          <Field label="Compasso"><select value={timeSig} onChange={e => setTimeSig(e.target.value)} style={inputStyle()}>{["4/4","3/4","6/8","2/4","12/8"].map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Levada"><input value={feel} onChange={e => setFeel(e.target.value)} style={inputStyle()} placeholder="Ex: Balada" /></Field>
        </div>
        <Field label="Link do YouTube (versão original)"><input value={youtube} onChange={e => setYoutube(e.target.value)} style={inputStyle()} placeholder="https://youtube.com/watch?v=…" /></Field>
      </div>

      <div style={{ fontSize: 13.5, color: "#9fc7b2", marginBottom: 14, padding: "12px 16px", background: "#0c2419", borderRadius: 12, border: "1px solid #15392b", lineHeight: 1.7 }}>
        ✍️ <strong style={{ color: "#fff" }}>Como escrever:</strong> coloque cada acorde entre <strong style={{ color: "#fff" }}>colchetes</strong> <code style={{ color: "#3fae6b" }}>[ ]</code> exatamente na sílaba onde ele entra. Ele flutua livremente sobre a letra, no ponto que você quiser — basta mover o colchete.<br />
        <span style={{ fontFamily: "'Space Mono',monospace", color: "#cfe6d9", display: "block", marginTop: 8 }}>Eu [G]te lou[D/F#]varei, [Em]Senhor</span>
        <span style={{ display: "block", marginTop: 6, opacity: 0.8 }}>Para uma linha só de acordes (intro, etc.), escreva só os colchetes: <code style={{ color: "#3fae6b" }}>[C] [G] [Am] [F]</code></span>
      </div>

      {sections.map((sec, i) => {
        const color = SECTION_COLORS[sec.type] || "#3fae6b";
        return (
          <div key={i} style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 14, padding: 16, marginBottom: 14, borderLeft: `5px solid ${color}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <select value={sec.type} onChange={e => update(i, "type", e.target.value)} style={inputStyle({ maxWidth: 170 })}>
                {SECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={sec.label} onChange={e => update(i, "label", e.target.value)} placeholder="rótulo" style={inputStyle({ maxWidth: 100, padding: 10 })} />
              <input value={sec.repeat} onChange={e => update(i, "repeat", e.target.value)} placeholder="repete ×" style={inputStyle({ maxWidth: 90, padding: 10 })} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => move(i, -1)} style={iconBtn()}><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} style={iconBtn()}><ChevronDown size={16} /></button>
                <button onClick={() => remove(i)} style={{ ...iconBtn(), color: "#e8554d" }}><Trash2 size={16} /></button>
              </div>
            </div>
            <textarea value={sec.content} onChange={e => update(i, "content", e.target.value)} rows={5}
              placeholder={"Eu [G]te lou[D/F#]varei, [Em]Senhor"}
              style={{ ...inputStyle(), fontFamily: "'Space Mono',monospace", resize: "vertical", lineHeight: 1.6, fontSize: 15 }} />
          </div>
        );
      })}

      <button onClick={addSection} style={{ ...ghostBtn(), width: "100%", justifyContent: "center", padding: 15, border: "1px dashed #1d4435" }}>
        <Plus size={18} /> Adicionar seção
      </button>

      {onDelete && (
        <button onClick={() => { if (confirm("Excluir esta cifra?")) onDelete(); }} style={{ ...ghostBtn(), color: "#e8554d", marginTop: 26 }}>
          <Trash2 size={16} /> Excluir cifra
        </button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12, color: "#6fae8a", marginBottom: 6, fontWeight: 600, letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}

/* ---------- Utils ---------- */
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function hexToSoft(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.12)`;
}
function darken(hex) {
  const c = hex.replace("#", "");
  const r = Math.round(parseInt(c.slice(0, 2), 16) * 0.55);
  const g = Math.round(parseInt(c.slice(2, 4), 16) * 0.55);
  const b = Math.round(parseInt(c.slice(4, 6), 16) * 0.55);
  return `rgb(${r},${g},${b})`;
}

/* ---------- Estilos ---------- */
function inputStyle(extra = {}) {
  return { width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", fontSize: 15, fontFamily: "'Manrope',sans-serif", outline: "none", ...extra };
}
function primaryBtn() {
  return { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#fff,#dff0e6)", color: "#0d3d28", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Manrope',sans-serif", boxShadow: "0 6px 18px rgba(255,255,255,.12)" };
}
function ghostBtn() {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, border: "1px solid #1d4435", background: "transparent", color: "#eef5f0", fontSize: 14, cursor: "pointer", fontFamily: "'Manrope',sans-serif" };
}
function iconBtn() {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", cursor: "pointer" };
}
function stepBtn() {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(0,0,0,.3)", color: "#fff", cursor: "pointer" };
}
function cardStyle() {
  return { display: "flex", alignItems: "center", gap: 16, padding: "17px 20px", borderRadius: 15, border: "1px solid #15392b", background: "#0c2419", cursor: "pointer", transition: "all .18s", fontFamily: "'Manrope',sans-serif", color: "#eef5f0" };
}
function chip() {
  return { display: "inline-flex", alignItems: "center", gap: 5, background: "#08160f", padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap" };
}
