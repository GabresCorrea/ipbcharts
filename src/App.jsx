import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, Music, Play, Pause, Edit3, Trash2, Youtube, ChevronUp, ChevronDown, X, Search, Save, ArrowLeft, Hash, LogOut, Tag, User, BookOpen, Copy, Maximize2, Download, Minus, GripVertical, Upload, WifiOff, Type, ListMusic, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* Conexão com o Supabase — os valores vêm das variáveis de ambiente
   configuradas na Vercel (ver guia). Em desenvolvimento local você pode
   criar um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/* ============================================================
   EDITORES — apenas estes e-mails podem criar/editar/excluir cifras.
   Substitua pelos e-mails reais (tudo minúsculo). Os demais membros
   só visualizam. A trava de verdade está no Supabase (ver guia);
   esta lista apenas controla o que aparece na tela.
   ============================================================ */
const EDITOR_EMAILS = [
  "voce@email.com",
  "editor2@email.com",
  // "editor3@email.com",
];
function isEditorEmail(email) {
  return !!email && EDITOR_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

/* Grupos de louvor da igreja. Para adicionar/remover um grupo,
   basta editar esta lista. */
const WORSHIP_GROUPS = ["ADONAI", "HOLY", "CRISTO EM NÓS", "ECOS DA PROMESSA"];
const GROUP_COLORS = {
  "ADONAI": "#e0b341",
  "HOLY": "#4f9dde",
  "CRISTO EM NÓS": "#e8554d",
  "ECOS DA PROMESSA": "#9b6ef0",
};
function groupColor(g) { return GROUP_COLORS[g] || "#3fae6b"; }
function groupColorSoft(g) {
  const hex = groupColor(g).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${gg},${b},0.15)`;
}

/* ---------- Logo: fachada da igreja + pauta musical com claves ---------- */
function Logo({ size = 56 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", display: "block", flexShrink: 0 }}>
      <img src="/logo.png" alt="IPBCharts"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

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

// Categorias fixas das músicas
const CATEGORIES = ["Louvor", "Adoração", "Congregacional", "Hino", "Outra"];
const CATEGORY_COLORS = {
  "Louvor": "#e8a23d", "Adoração": "#7a86f0", "Congregacional": "#34c98a",
  "Hino": "#d4a017", "Outra": "#9aa3ad", "": "#9aa3ad"
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
function ChartLine({ line, semitones, useFlats, mode = "chords" }) {
  if (!line.trim()) return <div style={{ height: "1.4em" }} />;
  const t = transposeText(line, semitones, useFlats);
  const parts = t.split(/(\[[^\]]+\])/g).filter(p => p !== "");
  const hasLyrics = parts.some(p => !(p.startsWith("[") && p.endsWith("]")) && p.trim() !== "");

  // transforma o acorde conforme o modo
  const showChord = (chord) => {
    if (mode === "bass") return bassNote(chord);
    return chord;
  };

  // Modo "só letra": ignora completamente os acordes
  if (mode === "lyrics") {
    if (!hasLyrics) return <div style={{ height: "0.6em" }} />; // linha só de acordes some
    const lyric = parts.filter(p => !(p.startsWith("[") && p.endsWith("]"))).join("");
    return <div style={{ lineHeight: 1.7, fontFamily: "'Space Mono',monospace", fontSize: "1em", color: "#1a2b22", whiteSpace: "pre-wrap", marginBottom: 2 }}>{lyric}</div>;
  }

  // Linha só com acordes (intro, interlúdio)
  if (!hasLyrics) {
    return (
      <div style={{ lineHeight: 1.9, color: "#2f9d63", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: "1em", whiteSpace: "pre-wrap", marginBottom: 2 }}>
        {parts.map((p, i) => p.startsWith("[") ? showChord(p.slice(1, -1)) + "   " : p).join("")}
      </div>
    );
  }

  const groups = [];
  let pending = null;
  parts.forEach((p) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      if (pending !== null) groups.push({ chord: pending, text: "" });
      pending = p.slice(1, -1);
    } else {
      groups.push({ chord: pending, text: p });
      pending = null;
    }
  });
  if (pending !== null) groups.push({ chord: pending, text: "" });

  const chordColor = mode === "bass" ? "#b8541f" : "#2f9d63";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", fontFamily: "'Space Mono',monospace", fontSize: "1em", marginBottom: 6 }}>
      {groups.map((g, i) => {
        // se o grupo tem acorde mas o texto está vazio/em branco (acorde no fim da
        // frase ou acordes seguidos), reserva uma largura mínima para o acorde
        // aparecer ACIMA de um espaço próprio, e não colado na palavra anterior.
        const emptyText = !g.text || g.text.trim() === "";
        const lyricContent = g.chord && emptyText ? "\u00A0\u00A0" : g.text;
        return (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <span style={{ height: "1.5em", lineHeight: "1.5em", color: chordColor, fontWeight: 700, fontSize: "0.9em", whiteSpace: "pre" }}>
              {g.chord ? showChord(g.chord) : ""}
            </span>
            <span style={{ color: "#1a2b22", whiteSpace: "pre", lineHeight: 1.4 }}>
              {lyricContent}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function RenderBlock({ content, semitones, useFlats, mode }) {
  const lines = content.split("\n");
  return (
    <div>
      {lines.map((line, i) => <ChartLine key={i} line={line} semitones={semitones} useFlats={useFlats} mode={mode} />)}
    </div>
  );
}

// Extrai a nota que o baixista toca: se houver baixo invertido (D/F#), usa o F#;
// senão, a fundamental do acorde (Am7 -> A, Csus4 -> C).
function bassNote(chord) {
  const slash = chord.indexOf("/");
  if (slash !== -1) {
    const after = chord.slice(slash + 1).match(/^[A-G](#|b)?/);
    if (after) return after[0];
  }
  const root = chord.match(/^[A-G](#|b)?/);
  return root ? root[0] : chord;
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
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const canEdit = isEditorEmail(session?.user?.email);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

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

  // ----- Grupos de louvor do usuário (escolha pessoal, salva por e-mail no aparelho) -----
  const [myGroups, setMyGroups] = useState([]);
  const groupsKey = session?.user?.email ? `ipb:groups:${session.user.email.toLowerCase()}` : null;
  useEffect(() => {
    if (!groupsKey) return;
    try {
      const saved = localStorage.getItem(groupsKey);
      setMyGroups(saved ? JSON.parse(saved) : []);
    } catch (e) { setMyGroups([]); }
  }, [groupsKey]);
  const saveMyGroups = useCallback((groups) => {
    setMyGroups(groups);
    try { if (groupsKey) localStorage.setItem(groupsKey, JSON.stringify(groups)); } catch (e) {}
  }, [groupsKey]);

  // ----- Carregar cifras do banco -----
  const loadSongs = useCallback(async () => {
    const { data, error } = await supabase
      .from("songs").select("*");
    if (!error && data) {
      const list = data.map(row => ({ ...row.data, id: row.id }));
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      setSongs(list);
    } else if (error) {
      console.error("Erro ao carregar:", error);
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

  // ----- Preferências de tom/capo por música (sincronizadas na conta) -----
  // mapa { [song_id]: { semitones, capo } }
  const [prefs, setPrefs] = useState({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const loadPrefs = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from("user_prefs").select("song_id, semitones, capo")
      .eq("user_id", session.user.id);
    if (!error && data) {
      const map = {};
      data.forEach(r => { map[r.song_id] = { semitones: r.semitones, capo: r.capo }; });
      setPrefs(map);
    }
    setPrefsLoaded(true);
  }, [session]);
  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const savePref = useCallback(async (songId, semitones, capo) => {
    if (!session?.user || !songId) return;
    // atualiza local na hora (resposta imediata) e grava no banco
    setPrefs(p => ({ ...p, [songId]: { semitones, capo } }));
    const { error } = await supabase.from("user_prefs").upsert({
      user_id: session.user.id, song_id: songId, semitones, capo, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,song_id" });
    if (error) console.error("Erro ao salvar preferência:", error.message);
  }, [session]);

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

  // ----- Backup: exportar todo o acervo para um arquivo -----
  const exportBackup = useCallback(() => {
    const data = { app: "IPBCharts", version: 1, exportedAt: new Date().toISOString(), songs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ipbcharts-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [songs]);

  // ----- Backup: importar de um arquivo (faz upsert; não apaga o que já existe) -----
  const importBackup = useCallback(async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.songs;
      if (!Array.isArray(list)) { alert("Arquivo de backup inválido."); return; }
      if (!confirm(`Importar ${list.length} música(s)? As que tiverem o mesmo identificador serão atualizadas; as demais serão adicionadas. Nada é apagado.`)) return;
      const rows = list.map(s => {
        const { id, ...rest } = s;
        return { id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), data: { ...rest }, updated_by: memberName || "import" };
      });
      const { error } = await supabase.from("songs").upsert(rows);
      if (error) { alert("Erro ao importar: " + error.message); return; }
      await loadSongs();
      alert("Importação concluída!");
    } catch (e) {
      alert("Não foi possível ler o arquivo: " + e.message);
    }
  }, [memberName, loadSongs]);

  // ----- Repertórios (setlists) -----
  const [setlists, setSetlists] = useState([]);
  const loadSetlists = useCallback(async () => {
    const { data, error } = await supabase.from("setlists").select("*");
    if (!error && data) {
      const list = data.map(r => ({ ...r.data, id: r.id }));
      list.sort((a, b) => (b.date || "").localeCompare(a.date || "")); // mais recentes primeiro
      setSetlists(list);
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    loadSetlists();
    const ch = supabase.channel("setlists-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "setlists" }, () => loadSetlists())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, loadSetlists]);

  const saveSetlist = useCallback(async (sl) => {
    const { id, ...rest } = sl;
    const payload = { id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), data: { ...rest }, updated_by: memberName || "anônimo" };
    const { error } = await supabase.from("setlists").upsert(payload);
    if (error) { alert("Erro ao salvar repertório: " + error.message); return null; }
    await loadSetlists();
    return payload.id;
  }, [memberName, loadSetlists]);

  const deleteSetlist = useCallback(async (id) => {
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) { alert("Erro ao excluir repertório: " + error.message); return; }
    loadSetlists();
  }, [loadSetlists]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return songs;
    return songs.filter(s => s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q));
  }, [songs, search]);

  // Repertórios visíveis: os sem grupo aparecem para todos; os com grupo,
  // só para quem pertence àquele grupo. Editores veem todos (para gerenciar).
  const visibleSetlists = useMemo(() => {
    if (canEdit) return setlists;
    return setlists.filter(sl => !sl.group || myGroups.includes(sl.group));
  }, [setlists, myGroups, canEdit]);

  const styleTag = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      html { background: #0a1f17; }
      body {
        margin: 0;
        background: #0a1f17;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
      }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: #0a1f17; }
      /* iOS dá zoom automático ao focar campo com fonte < 16px; força 16px para evitar */
      input, textarea, select { font-size: 16px !important; }
      ::-webkit-scrollbar-thumb { background: #1d4435; border-radius: 5px; }
      ::selection { background: #2f7d57; color: #fff; }
    `}</style>
  );

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#08160f", display: "flex", alignItems: "center", justifyContent: "center", color: "#7fce9f", fontFamily: "'Montserrat',sans-serif" }}>
        {styleTag}<Music style={{ marginRight: 10 }} /> Iniciando…
      </div>
    );
  }

  if (!session) {
    return <div>{styleTag}<AuthScreen /></div>;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#08160f", display: "flex", alignItems: "center", justifyContent: "center", color: "#7fce9f", fontFamily: "'Montserrat',sans-serif" }}>
        {styleTag}<Music style={{ marginRight: 10 }} /> Carregando repertório…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", color: "#eef5f0", fontFamily: "'Montserrat',sans-serif" }}>
      {styleTag}
      {!online && (
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#b8541f", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
          <WifiOff size={16} /> Sem conexão — você pode ver a música aberta, mas mudanças não serão salvas até a internet voltar.
        </div>
      )}
      {view === "list" && <SongList songs={filtered} allCount={songs.length} search={search} setSearch={setSearch}
        memberName={memberName} canEdit={canEdit} onLogout={() => supabase.auth.signOut()}
        onExport={exportBackup} onImport={importBackup}
        setlistCount={visibleSetlists.length} onOpenSetlists={() => setView("setlists")}
        myGroups={myGroups} onSaveGroups={saveMyGroups}
        onOpen={s => { setCurrent(s); setView("view"); }} onNew={() => { if (canEdit) { setCurrent(null); setView("edit"); } }} />}
      {view === "setlists" && <SetlistsView setlists={visibleSetlists} songs={songs} canEdit={canEdit}
        onBack={() => setView("list")} onSave={saveSetlist} onDelete={deleteSetlist}
        onOpenSong={s => { setCurrent(s); setView("view"); }} />}
      {view === "view" && current && <SongView song={current} canEdit={canEdit}
        pref={prefs[current.id]} prefsLoaded={prefsLoaded} onSavePref={(st, cp) => savePref(current.id, st, cp)}
        onBack={() => setView("list")} onEdit={() => { if (canEdit) setView("edit"); }} />}
      {view === "edit" && canEdit && <SongEditor song={current} memberName={memberName}
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", boxShadow: "0 12px 32px rgba(0,0,0,.45)", borderRadius: "50%" }}>
            <Logo size={76} />
          </div>
          <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 46, color: "#fff", margin: "16px 0 2px", letterSpacing: -0.5 }}>IPBCharts</h1>
          <p style={{ color: "#6fae8a", margin: 0 }}>Repertório do louvor</p>
        </div>
        <div style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 18, padding: 26 }}>
          <h2 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 26, color: "#fff", margin: "0 0 18px" }}>
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
const linkBtn = { background: "none", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 14, textDecoration: "underline" };

/* ---------- Lista ---------- */
function categoryLabel(s) {
  if (s.category === "Outra") return s.categoryOther?.trim() || "Outra";
  return s.category || "Sem categoria";
}

function SongCard({ s, onOpen, showHymnNumber }) {
  const catColor = CATEGORY_COLORS[s.category] || "#9aa3ad";
  return (
    <button onClick={() => onOpen(s)} style={{ ...cardStyle(), alignItems: "flex-start" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#2f7d57"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,.35)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#15392b"; e.currentTarget.style.boxShadow = "none"; }}>
      {showHymnNumber && (
        <div style={{ width: 44, height: 44, borderRadius: 11, background: "linear-gradient(135deg,#d4a017,#a87813)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d3d28", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
          {s.hymnNumber || "—"}
        </div>
      )}
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        {/* Título completo (sem corte) */}
        <div style={{ fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: -0.2, lineHeight: 1.25, overflowWrap: "anywhere" }}>{s.title}</div>
        {/* Artista como subtítulo */}
        <div style={{ color: "#9fc7b2", fontSize: 14, marginTop: 2 }}>{s.artist || "—"}</div>
        {/* Informações secundárias: tipo, tom, youtube */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginTop: 9 }}>
          {!showHymnNumber && s.category && (
            <span style={{ ...chip(), color: catColor, borderColor: "transparent", background: hexToSoft(catColor) }}>{categoryLabel(s)}</span>
          )}
          <span style={chip()}><Hash size={12} /> {s.key || "—"}</span>
          {s.youtube && (
            <span style={{ ...chip(), color: "#e8554d", borderColor: "transparent", background: "rgba(232,85,77,.12)" }}><Youtube size={13} /> Vídeo</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ---------- Seletor de grupos de louvor do usuário ---------- */
function GroupPicker({ myGroups, onSave, onClose }) {
  const [sel, setSel] = useState(myGroups || []);
  const toggle = (g) => setSel(sel.includes(g) ? sel.filter(x => x !== g) : [...sel, g]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0c2419", border: "1px solid #1d4435", borderRadius: 16, padding: 22 }}>
        <h2 style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 20, color: "#fff" }}>Meus grupos de louvor</h2>
        <p style={{ margin: "0 0 16px", color: "#6fae8a", fontSize: 13.5 }}>Escolha o(s) grupo(s) a que você pertence. Você verá os repertórios criados para eles.</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          {WORSHIP_GROUPS.map(g => {
            const on = sel.includes(g);
            return (
              <button key={g} onClick={() => toggle(g)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 11, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 15, fontWeight: 600, textAlign: "left",
                  border: on ? "1px solid #2f7d57" : "1px solid #15392b",
                  background: on ? "linear-gradient(135deg,#0f4a30,#0a3422)" : "transparent",
                  color: on ? "#fff" : "#9fc7b2" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: on ? "none" : "1.5px solid #2f7d57", background: on ? "#3fae6b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {on && <span style={{ color: "#06110b", fontWeight: 900, fontSize: 13 }}>✓</span>}
                </span>
                {g}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={ghostBtn()}>Cancelar</button>
          <button onClick={() => onSave(sel)} style={primaryBtn()}><Save size={16} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function SongList({ songs, allCount, search, setSearch, memberName, canEdit, onLogout, onExport, onImport, setlistCount, onOpenSetlists, myGroups, onSaveGroups, onOpen, onNew }) {
  const [groupBy, setGroupBy] = useState("category"); // category | artist | hymns
  const [showGroups, setShowGroups] = useState(false);
  const importInputRef = useRef(null);

  // separa hinos
  const hymns = useMemo(() =>
    songs.filter(s => s.category === "Hino")
      .sort((a, b) => (parseInt(a.hymnNumber) || 9999) - (parseInt(b.hymnNumber) || 9999)),
    [songs]);

  // agrupa por categoria ou autor
  const grouped = useMemo(() => {
    const list = groupBy === "hymns" ? hymns : songs;
    const map = {};
    list.forEach(s => {
      const k = groupBy === "artist" ? (s.artist?.trim() || "Sem artista") : categoryLabel(s);
      (map[k] = map[k] || []).push(s);
    });
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
    if (groupBy === "hymns") {
      keys.forEach(k => map[k].sort((a, b) => (parseInt(a.hymnNumber) || 9999) - (parseInt(b.hymnNumber) || 9999)));
    } else {
      keys.forEach(k => map[k].sort((a, b) => (a.title || "").localeCompare(b.title || "")));
    }
    return { items: map, keys };
  }, [songs, hymns, groupBy]);

  const tabs = [
    { id: "category", label: "Por categoria", icon: Tag },
    { id: "artist", label: "Por autor", icon: User },
    { id: "hymns", label: `Hinos (${hymns.length})`, icon: BookOpen },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 22px 90px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", boxShadow: "0 10px 30px rgba(0,0,0,.45)", borderRadius: "50%" }}>
            <Logo size={60} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: 34, letterSpacing: -1, color: "#fff", lineHeight: 1 }}>IPBCharts</h1>
            <p style={{ margin: "4px 0 0", color: "#6fae8a", fontSize: 13.5, letterSpacing: 0.2 }}>Repertório do louvor · {allCount} {allCount === 1 ? "música" : "músicas"}</p>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#6fae8a", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {canEdit && (
            <>
              <button onClick={onExport} style={{ ...ghostBtn(), padding: "6px 12px" }} title="Baixar backup de todo o acervo"><Download size={15} /> Backup</button>
              <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) { onImport(e.target.files[0]); e.target.value = ""; } }} />
              <button onClick={() => importInputRef.current?.click()} style={{ ...ghostBtn(), padding: "6px 12px" }} title="Importar de um arquivo de backup"><Upload size={15} /> Importar</button>
            </>
          )}
          <button onClick={() => setShowGroups(true)} style={{ ...ghostBtn(), padding: "6px 12px" }} title="Escolher meus grupos de louvor"><Users size={15} /> Meus grupos{myGroups.length ? ` (${myGroups.length})` : ""}</button>
          Olá, <strong style={{ color: "#fff" }}>{memberName}</strong>
          <button onClick={onLogout} style={{ ...ghostBtn(), padding: "6px 12px" }}><LogOut size={15} /> Sair</button>
        </div>
      </header>

      {showGroups && (
        <GroupPicker myGroups={myGroups} onSave={g => { onSaveGroups(g); setShowGroups(false); }} onClose={() => setShowGroups(false)} />
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 15, top: 14, color: "#5d917a" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar música ou artista…" style={inputStyle({ paddingLeft: 44 })} />
        </div>
        {canEdit && <button onClick={onNew} style={primaryBtn()}><Plus size={18} /> Nova cifra</button>}
        <button onClick={onOpenSetlists} style={{ ...ghostBtn(), padding: "12px 16px" }}><ListMusic size={17} /> Repertórios{setlistCount ? ` (${setlistCount})` : ""}</button>
      </div>

      {/* Abas de agrupamento */}
      <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap" }}>
        {tabs.map(t => {
          const active = groupBy === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setGroupBy(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10,
                border: active ? "1px solid #2f7d57" : "1px solid #15392b",
                background: active ? "linear-gradient(135deg,#0f4a30,#0a3422)" : "transparent",
                color: active ? "#fff" : "#6fae8a", fontWeight: active ? 600 : 500, fontSize: 13.5, cursor: "pointer",
                fontFamily: "'Montserrat',sans-serif", transition: "all .15s"
              }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {songs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 18 }}>
          <Music size={42} style={{ opacity: 0.45, marginBottom: 14 }} />
          <p>Nenhuma cifra ainda. Adicione a primeira do repertório!</p>
        </div>
      ) : groupBy === "hymns" && hymns.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 18 }}>
          <BookOpen size={42} style={{ opacity: 0.45, marginBottom: 14 }} />
          <p>Nenhum hino ainda. Crie uma música com a categoria "Hino" e dê o número dela.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 28 }}>
          {grouped.keys.map(k => {
            const catColor = groupBy === "category" ? (CATEGORY_COLORS[k] || CATEGORY_COLORS[grouped.items[k][0]?.category] || "#3fae6b") : "#3fae6b";
            return (
              <div key={k}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 4, height: 18, borderRadius: 2, background: catColor }} />
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#cfe6d9", textTransform: "uppercase", letterSpacing: 1.2 }}>{k}</h2>
                  <span style={{ fontSize: 12, color: "#5d917a" }}>{grouped.items[k].length}</span>
                  <div style={{ flex: 1, height: 1, background: "#15392b" }} />
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {grouped.items[k].map(s => (
                    <SongCard key={s.id} s={s} onOpen={onOpen} showHymnNumber={groupBy === "hymns"} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Modo Apresentação (tela cheia + auto-scroll) ---------- */
function PresentationMode({ song, shapeShift, shapeUseFlats, soundingKey, semitones, setSemitones, capo, setCapo, shapeKey, onExit }) {
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(40); // pixels por segundo aproximado
  const [fontScale, setFontScale] = useState(1);
  const scrollRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!scrolling) { cancelAnimationFrame(rafRef.current); return; }
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollRef.current;
      if (el) {
        el.scrollTop += speed * dt;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) setScrolling(false);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scrolling, speed]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); if (e.key === " ") { e.preventDefault(); setScrolling(s => !s); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0a1f17", display: "flex", flexDirection: "column" }}>
      {/* barra de controles */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", background: "#08160f", borderBottom: "1px solid #15392b", flexWrap: "wrap" }}>
        <button onClick={onExit} style={ghostBtn()}><X size={18} /> Sair</button>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{song.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {/* transpor */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.3)", borderRadius: 9, padding: "3px 5px" }}>
            <span style={{ fontSize: 10.5, color: "#9fdabb", padding: "0 4px" }}>TOM {soundingKey}</span>
            <button onClick={() => setSemitones(s => s - 1)} style={stepBtnSm()}><ChevronDown size={15} /></button>
            <button onClick={() => setSemitones(s => s + 1)} style={stepBtnSm()}><ChevronUp size={15} /></button>
          </div>
          {/* capo */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.3)", borderRadius: 9, padding: "3px 5px" }}>
            <span style={{ fontSize: 10.5, color: "#9fdabb", padding: "0 4px" }}>CAPO {capo === 0 ? "—" : capo + "ª"}</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtnSm()}><ChevronDown size={15} /></button>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtnSm()}><ChevronUp size={15} /></button>
          </div>
          {/* fonte */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.3)", borderRadius: 9, padding: "3px 5px" }}>
            <span style={{ fontSize: 10.5, color: "#9fdabb", padding: "0 4px" }}>FONTE</span>
            <button onClick={() => setFontScale(f => Math.max(0.7, f - 0.1))} style={stepBtnSm()}><Minus size={15} /></button>
            <button onClick={() => setFontScale(f => Math.min(2.2, f + 0.1))} style={stepBtnSm()}><Plus size={15} /></button>
          </div>
          {/* auto-scroll */}
          <button onClick={() => setScrolling(s => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 13, background: scrolling ? "#fff" : "rgba(0,0,0,.3)", color: scrolling ? "#0d3d28" : "#fff" }}>
            {scrolling ? <Pause size={15} /> : <Play size={15} />} Auto-scroll
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.3)", borderRadius: 9, padding: "3px 5px" }}>
            <span style={{ fontSize: 10.5, color: "#9fdabb", padding: "0 4px" }}>VEL</span>
            <button onClick={() => setSpeed(s => Math.max(10, s - 10))} style={stepBtnSm()}><Minus size={15} /></button>
            <span style={{ fontSize: 12, color: "#fff", minWidth: 22, textAlign: "center" }}>{Math.round(speed / 10)}</span>
            <button onClick={() => setSpeed(s => Math.min(160, s + 10))} style={stepBtnSm()}><Plus size={15} /></button>
          </div>
        </div>
      </div>

      {/* área rolável com a cifra */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "30px 24px 60vh", scrollBehavior: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {(song.sections || []).map((sec, i) => {
            const color = SECTION_COLORS[sec.type] || "#3fae6b";
            return (
              <div key={i} style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                  <span style={{ fontWeight: 700, color, textTransform: "uppercase", fontSize: 13 * fontScale, letterSpacing: 1 }}>
                    {sec.type}{sec.label ? ` ${sec.label}` : ""}{sec.repeat ? ` ×${sec.repeat}` : ""}
                  </span>
                  {sec.note && <span style={{ fontSize: 12 * fontScale, color: "#9fdabb", fontStyle: "italic" }}>♪ {sec.note}</span>}
                </div>
                <div style={{ fontSize: `${fontScale}em` }}>
                  <PresentationBlock content={sec.content} semitones={shapeShift} useFlats={shapeUseFlats} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Render da cifra em tema escuro para a apresentação
function PresentationBlock({ content, semitones, useFlats }) {
  const lines = (content || "").split("\n");
  return (
    <div>
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} style={{ height: "1.3em" }} />;
        const t = transposeText(line, semitones, useFlats);
        const parts = t.split(/(\[[^\]]+\])/g).filter(p => p !== "");
        const hasLyrics = parts.some(p => !(p.startsWith("[") && p.endsWith("]")) && p.trim() !== "");
        if (!hasLyrics) {
          return <div key={idx} style={{ color: "#3fae6b", fontWeight: 700, fontFamily: "'Space Mono',monospace", lineHeight: 1.8 }}>
            {parts.map(p => p.startsWith("[") ? p.slice(1, -1) + "   " : p).join("")}</div>;
        }
        const groups = [];
        let pending = null;
        parts.forEach(p => {
          if (p.startsWith("[") && p.endsWith("]")) { if (pending !== null) groups.push({ chord: pending, text: "" }); pending = p.slice(1, -1); }
          else { groups.push({ chord: pending, text: p }); pending = null; }
        });
        if (pending !== null) groups.push({ chord: pending, text: "" });
        return (
          <div key={idx} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", fontFamily: "'Space Mono',monospace", marginBottom: 6 }}>
            {groups.map((g, gi) => (
              <span key={gi} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <span style={{ height: "1.5em", lineHeight: "1.5em", color: "#3fae6b", fontWeight: 700, fontSize: "0.85em", whiteSpace: "pre" }}>{g.chord || ""}</span>
                <span style={{ color: "#eef5f0", whiteSpace: "pre", lineHeight: 1.4 }}>{g.text}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Exportar música em PDF (via janela de impressão) ---------- */
function exportSongPDF(song, soundingKey, shapeShift, shapeUseFlats, capo, shapeKey) {
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tline = (rawLine) => transposeText(rawLine, shapeShift || 0, shapeUseFlats);
  const renderLineHTML = (rawLine) => {
    const line = tline(rawLine);
    const parts = line.split(/(\[[^\]]+\])/g).filter(p => p !== "");
    const hasLyrics = parts.some(p => !(p.startsWith("[") && p.endsWith("]")) && p.trim() !== "");
    if (!hasLyrics) {
      return `<div class="chordsonly">${parts.map(p => p.startsWith("[") ? esc(p.slice(1, -1)) + "&nbsp;&nbsp;" : esc(p)).join("")}</div>`;
    }
    const groups = [];
    let pending = null;
    parts.forEach(p => {
      if (p.startsWith("[") && p.endsWith("]")) { if (pending !== null) groups.push({ chord: pending, text: "" }); pending = p.slice(1, -1); }
      else { groups.push({ chord: pending, text: p }); pending = null; }
    });
    if (pending !== null) groups.push({ chord: pending, text: "" });
    return `<div class="line">${groups.map(g =>
      `<span class="col"><span class="ch">${g.chord ? esc(g.chord) : "&nbsp;"}</span><span class="ly">${esc(g.text).replace(/ /g, "&nbsp;") || "&nbsp;"}</span></span>`
    ).join("")}</div>`;
  };
  const sectionItems = (song.sections || []).map(sec => {
    const color = SECTION_COLORS[sec.type] || "#3fae6b";
    const soft = hexToSoft(color);
    const dark = darken(color);
    const contentLines = (sec.content || "").split("\n");
    const lines = contentLines.map(renderLineHTML).join("");
    const head = `${esc(sec.type)}${sec.label ? " " + esc(sec.label) : ""}`;
    const html = `<div class="section" style="border-left-color:${color}">
      <div class="sechead" style="background:${soft}">
        <span class="dot" style="background:${color}"></span>
        <span class="setitle" style="color:${dark}">${head}</span>${sec.repeat ? `<span class="rep" style="color:${dark}">×${esc(sec.repeat)}</span>` : ""}${sec.note ? `<span class="note" style="color:${dark}">♪ ${esc(sec.note)}</span>` : ""}
      </div>
      <div class="secbody">${lines}</div>
    </div>`;
    // peso aproximado (altura) = nº de linhas + cabeçalho
    const weight = contentLines.length + 2;
    return { html, weight };
  });
  // distribui as seções em 2 colunas equilibrando a altura total
  const totalWeight = sectionItems.reduce((a, s) => a + s.weight, 0);
  const half = totalWeight / 2;
  const left = [], right = [];
  let acc = 0;
  sectionItems.forEach(item => {
    if (acc < half || left.length === 0) { left.push(item.html); acc += item.weight; }
    else right.push(item.html);
  });
  const colLeft = left.join("");
  const colRight = right.join("");
  const sectionsHTML = `<table class="coltable"><tr>
    <td class="colcell">${colLeft}</td>
    <td class="colgap"></td>
    <td class="colcell">${colRight}</td>
  </tr></table>`;
  const catLine = song.category ? (song.category === "Hino" && song.hymnNumber ? `Hino nº ${esc(song.hymnNumber)}` : esc(song.category === "Outra" ? (song.categoryOther || "Outra") : song.category)) : "";
  const pill = (label, value, accent) => `<span class="pill${accent ? " accent" : ""}"><span class="pl">${esc(label)}</span><span class="pv">${esc(value)}</span></span>`;
  const metaPills = [
    pill("Tom", soundingKey, true),
    pill("Compasso", song.timeSig || "4/4", false),
    capo > 0 ? pill(`Capo ${capo}ª`, shapeKey, false) : "",
    song.bpm ? pill("BPM", String(song.bpm), false) : "",
    song.feel ? pill("Levada", song.feel, false) : "",
  ].join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(song.title)}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: Arial, "Helvetica Neue", sans-serif; background: #0a1f17; }
    .page { padding: 6mm; }
    .header { background: linear-gradient(135deg,#0f4a30,#0a3422); border:1px solid #1d6b46; border-radius: 14px; padding: 12px 16px; margin-bottom: 12px; }
    .title { color:#fff; font-size: 19pt; font-weight: 800; margin: 0 0 1px; letter-spacing:-0.3px; line-height:1.1; }
    .artist { color:#9fdabb; font-size: 10pt; margin: 0 0 9px; font-weight: 500; }
    .pills { display:flex; flex-wrap:wrap; gap:5px; }
    .pill { display:inline-flex; align-items:baseline; gap:4px; background:rgba(0,0,0,.28); border-radius:8px; padding:3px 8px; }
    .pill.accent { background:#fff; }
    .pl { font-size:7pt; letter-spacing:.5px; font-weight:700; text-transform:uppercase; color:#9fdabb; }
    .pill.accent .pl { color:#5a7d6c; }
    .pv { font-size:10pt; font-weight:800; color:#eef5f0; }
    .pill.accent .pv { color:#0d3d28; }
    /* duas colunas via tabela — respeitado por qualquer motor de impressão,
       inclusive no celular (CSS column é ignorado ao imprimir no mobile). */
    .coltable { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .colcell { width: 48%; vertical-align: top; }
    .colgap { width: 4%; }
    /* seções em retângulos como na tela */
    .section { background:#fbfdfb; border-radius: 10px; border-left: 5px solid #3fae6b; margin: 0 0 10px; overflow:hidden; box-shadow: 0 2px 5px rgba(0,0,0,.25);
      break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid; }
    .sechead { display:flex; align-items:center; gap:6px; padding: 6px 11px; flex-wrap:wrap; }
    .dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
    .setitle { font-weight:800; text-transform:uppercase; font-size:8pt; letter-spacing:.7px; }
    .rep { font-size:7.5pt; opacity:.75; font-weight:700; }
    .note { font-size:7.5pt; font-style:italic; margin-left:auto; opacity:.9; }
    .secbody { padding: 8px 11px 9px; }
    .line { display:flex; flex-wrap:wrap; align-items:flex-end; margin-bottom:3px; font-family:"Courier New", monospace; }
    .col { display:inline-flex; flex-direction:column; justify-content:flex-end; }
    .ch { height:1.3em; line-height:1.3em; color:#1d7a47; font-weight:bold; font-size:8.5pt; white-space:pre; }
    .ly { font-size:9.5pt; white-space:pre; line-height:1.2; color:#14241c; }
    .chordsonly { font-family:"Courier New", monospace; color:#1d7a47; font-weight:bold; font-size:9.5pt; line-height:1.55; }
    .ftr { text-align:center; color:#3a6450; font-size:7pt; margin-top:6px; }
    /* barra de controle - some na impressão */
    .topbar { position: fixed; top: 0; left: 0; right: 0; background: #08160f; border-bottom: 1px solid #1d4435; padding: 10px 16px; display: flex; gap: 10px; align-items: center; z-index: 50; }
    .topbar button { font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; border: none; border-radius: 9px; padding: 9px 16px; cursor: pointer; }
    .btn-back { background: transparent; color: #eef5f0; border: 1px solid #1d4435 !important; }
    .btn-print { background: linear-gradient(135deg,#fff,#dff0e6); color: #0d3d28; }
    .topbar-spacer { height: 56px; }
    @media print { .topbar, .topbar-spacer { display: none !important; } }
  </style></head><body>
    <div class="topbar">
      <button class="btn-back" onclick="window.close()">← Voltar ao app</button>
      <button class="btn-print" onclick="window.print()">Salvar / Imprimir PDF</button>
      <span style="color:#6fae8a;font-family:Arial;font-size:12px;margin-left:auto">Dica: ative "Gráficos de plano de fundo" na impressão</span>
    </div>
    <div class="topbar-spacer"></div>
    <div class="page">
      <div class="header">
        <div class="title">${esc(song.title)}</div>
        <div class="artist">${esc(song.artist || "—")}${catLine ? " · " + catLine : ""}</div>
        <div class="pills">${metaPills}</div>
      </div>
      ${sectionsHTML}
      <div class="ftr">IPBCharts · Repertório do louvor</div>
    </div>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); }, 200);
}

/* ---------- Visualização ---------- */
function SongView({ song, canEdit, pref, prefsLoaded, onSavePref, onBack, onEdit }) {
  const [semitones, setSemitones] = useState(pref?.semitones || 0);
  const [capo, setCapo] = useState(pref?.capo || 0);
  const [viewMode, setViewMode] = useState("chords"); // chords | lyrics | bass
  const [fontScale, setFontScale] = useState(1);
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
  const [presenting, setPresenting] = useState(false);

  // refs de controle (declaradas antes dos effects que as usam)
  const appliedFor = useRef(null);

  // Aplica a preferência salva (tom/capo) da pessoa para esta música.
  // Roda ao trocar de música e também quando o pref chega do banco (assíncrono).
  useEffect(() => {
    if (appliedFor.current === song.id) return;
    setSemitones(pref?.semitones || 0);
    setCapo(pref?.capo || 0);
    if (prefsLoaded) appliedFor.current = song.id;
  }, [song.id, pref, prefsLoaded]);

  // Salva a preferência quando o tom/capo difere do que está guardado.
  // Só age depois que esta música já teve sua preferência aplicada (appliedFor),
  // e compara com o pref atual para não salvar à toa nem pular mudanças reais.
  useEffect(() => {
    if (appliedFor.current !== song.id) return;       // ainda não aplicou esta música
    const savedSemi = pref?.semitones || 0;
    const savedCapo = pref?.capo || 0;
    if (semitones === savedSemi && capo === savedCapo) return; // nada mudou de fato
    onSavePref?.(semitones, capo);
  }, [semitones, capo, song.id]);

  // ao abrir uma música, começa do topo (cabeçalho), não na posição anterior
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [song.id]);

  if (presenting) {
    return <PresentationMode song={song} shapeShift={shapeShift} shapeUseFlats={shapeUseFlats}
      soundingKey={soundingKey} semitones={semitones} setSemitones={setSemitones}
      capo={capo} setCapo={setCapo} shapeKey={shapeKey} onExit={() => setPresenting(false)} />;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <button onClick={onBack} style={ghostBtn()}><ArrowLeft size={18} /> Voltar</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportSongPDF(song, soundingKey, shapeShift, shapeUseFlats, capo, shapeKey)} style={ghostBtn()} title="Exportar PDF"><Download size={16} /> PDF</button>
          <button onClick={() => setPresenting(true)} style={ghostBtn()} title="Modo apresentação"><Maximize2 size={16} /> Apresentar</button>
          {canEdit && <button onClick={onEdit} style={ghostBtn()}><Edit3 size={16} /> Editar</button>}
        </div>
      </div>

      {/* Cabeçalho premium — compacto e hierárquico */}
      <div style={{ background: "linear-gradient(135deg,#0f4a30 0%,#0a3422 100%)", border: "1px solid #1d6b46", borderRadius: 18, padding: "20px 22px", marginBottom: 22, boxShadow: "0 18px 44px rgba(0,0,0,.42)" }}>
        {/* Nome */}
        <h1 style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 26, color: "#fff", letterSpacing: -0.3, lineHeight: 1.15 }}>{song.title}</h1>
        {/* Autor */}
        <p style={{ margin: "0 0 16px", color: "#9fdabb", fontSize: 13.5, fontWeight: 500 }}>
          {song.artist || "—"}
          {song.category && <span style={{ color: "#6fae8a" }}> · {song.category === "Hino" && song.hymnNumber ? `Hino nº ${song.hymnNumber}` : categoryLabel(song)}</span>}
        </p>

        {/* Tom e Compasso */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <MetaPill label="Tom" value={soundingKey} accent />
          <MetaPill label="Compasso" value={song.timeSig || "4/4"} />
          {capo > 0 && <MetaPill label={`Capo ${capo}ª`} value={shapeKey} />}
        </div>

        {/* Transpor e Capo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.28)", borderRadius: 10, padding: "4px 6px" }}>
            <span style={ctrlLabel}>Transpor</span>
            <button onClick={() => setSemitones(s => s - 1)} style={stepBtnSm()}><ChevronDown size={16} /></button>
            <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700, fontSize: 13, color: semitones === 0 ? "#9fdabb" : "#fff" }}>{semitones > 0 ? "+" : ""}{semitones}</span>
            <button onClick={() => setSemitones(s => s + 1)} style={stepBtnSm()}><ChevronUp size={16} /></button>
            {semitones !== 0 && <button onClick={() => setSemitones(0)} style={{ ...ghostBtn(), padding: "3px 8px", fontSize: 11 }}>reset</button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.28)", borderRadius: 10, padding: "4px 6px" }}>
            <span style={ctrlLabel}>Capo</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtnSm()}><ChevronDown size={16} /></button>
            <span style={{ minWidth: 32, textAlign: "center", fontWeight: 700, fontSize: 13, color: capo === 0 ? "#9fdabb" : "#fff" }}>{capo === 0 ? "—" : capo + "ª"}</span>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtnSm()}><ChevronUp size={16} /></button>
          </div>
        </div>

        {/* Levada e Metrônomo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {song.feel && <MetaPill label="Levada" value={song.feel} />}
          <button onClick={() => setPlaying(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 13, background: playing ? "#fff" : "rgba(0,0,0,.28)", color: playing ? "#0d3d28" : "#fff" }}>
            {playing ? <Pause size={15} /> : <Play size={15} />} Metrônomo · {song.bpm || "—"} BPM
          </button>
          {playing && <div style={{ display: "flex", gap: 5 }}>{[1, 2, 3, 4].map(b => <div key={b} style={{ width: 10, height: 10, borderRadius: "50%", background: beat === b ? (b === 1 ? "#e8554d" : "#fff") : "rgba(255,255,255,.2)" }} />)}</div>}
        </div>
      </div>

      {/* Seletor de modo + tamanho de fonte */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", gap: 3, background: "#0c2419", border: "1px solid #15392b", borderRadius: 10, padding: 4 }}>
          {[["chords", "Cifra"], ["lyrics", "Só letra"], ["bass", "Contra-baixo"]].map(([m, lbl]) => {
            const active = viewMode === m;
            return (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 600,
                  background: active ? "linear-gradient(135deg,#0f4a30,#0a3422)" : "transparent", color: active ? "#fff" : "#6fae8a" }}>
                {lbl}
              </button>
            );
          })}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0c2419", border: "1px solid #15392b", borderRadius: 10, padding: "4px 6px" }}>
          <Type size={15} color="#6fae8a" />
          <button onClick={() => setFontScale(f => Math.max(0.8, Math.round((f - 0.1) * 10) / 10))} style={{ ...iconBtn(), width: 28, height: 28 }}><Minus size={15} /></button>
          <span style={{ fontSize: 12, color: "#9fc7b2", minWidth: 38, textAlign: "center" }}>{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(f => Math.min(1.8, Math.round((f + 0.1) * 10) / 10))} style={{ ...iconBtn(), width: 28, height: 28 }}><Plus size={15} /></button>
        </div>
      </div>

      {/* Seções */}
      <div style={{ display: "grid", gap: 16 }}>
        {(song.sections || []).map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || "#3fae6b";
          return (
            <div key={i} style={{ background: "#fbfdfb", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.3)", borderLeft: `6px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", background: hexToSoft(color), flexWrap: "wrap" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                <span style={{ fontWeight: 700, color: darken(color), textTransform: "uppercase", fontSize: 13, letterSpacing: 1 }}>
                  {sec.type}{sec.label ? ` ${sec.label}` : ""}
                </span>
                {sec.repeat && <span style={{ fontSize: 12, color: darken(color), opacity: 0.7 }}>×{sec.repeat}</span>}
                {sec.note && (
                  <span style={{ fontSize: 12, color: darken(color), opacity: 0.85, fontStyle: "italic", marginLeft: "auto" }}>
                    ♪ {sec.note}
                  </span>
                )}
              </div>
              <div style={{ padding: "16px 20px 18px" }}>
                <div style={{ fontSize: `${fontScale * 15.5}px` }}>
                  <RenderBlock content={sec.content} semitones={viewMode === "bass" ? semitones : shapeShift} useFlats={viewMode === "bass" ? useFlats : shapeUseFlats} mode={viewMode} />
                </div>
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

function MetaPill({ label, value, accent }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: accent ? "#fff" : "rgba(0,0,0,.28)", color: accent ? "#0d3d28" : "#eef5f0", borderRadius: 10, padding: "6px 12px" }}>
      <span style={{ fontSize: 10.5, opacity: accent ? 0.6 : 0.6, letterSpacing: 0.6, fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{value}</span>
    </div>
  );
}
const ctrlLabel = { fontSize: 10.5, color: "#9fdabb", paddingLeft: 6, paddingRight: 2, letterSpacing: 0.6, fontWeight: 600, textTransform: "uppercase" };
function stepBtnSm() {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,255,255,.08)", color: "#fff", cursor: "pointer" };
}

/* ---------- Editor visual de acordes (clicar na sílaba) ----------
   Converte entre o formato com colchetes [G] e um modelo
   { text: "letra pura", chords: { posicao: "acorde" } } por linha. */
function parseLineToModel(line) {
  let text = "";
  const chords = {};
  let i = 0;
  while (i < line.length) {
    if (line[i] === "[") {
      const end = line.indexOf("]", i);
      if (end !== -1) {
        const chord = line.slice(i + 1, end);
        chords[text.length] = chord; // ancorado na posição atual da letra
        i = end + 1;
        continue;
      }
    }
    text += line[i];
    i++;
  }
  return { text, chords };
}

function modelToLine(text, chords) {
  let out = "";
  for (let pos = 0; pos <= text.length; pos++) {
    if (chords[pos]) out += "[" + chords[pos] + "]";
    if (pos < text.length) out += text[pos];
  }
  return out;
}

function VisualLine({ line, lineIndex, onChange }) {
  const model = parseLineToModel(line);
  const [editingPos, setEditingPos] = useState(null);
  const [draft, setDraft] = useState("");

  const openEditor = (pos) => {
    setEditingPos(pos);
    setDraft(model.chords[pos] || "");
  };
  const commit = () => {
    const chords = { ...model.chords };
    const v = draft.trim();
    if (v) chords[editingPos] = v; else delete chords[editingPos];
    onChange(modelToLine(model.text, chords));
    setEditingPos(null);
    setDraft("");
  };

  const chars = model.text.split("");
  return (
    <div style={{ position: "relative", marginBottom: 10, fontFamily: "'Space Mono',monospace" }}>
      {/* faixa dos acordes + letra clicável */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", lineHeight: 1.4 }}>
        {model.text.length === 0 ? (
          <span style={{ color: "#5d917a", fontSize: 13, fontStyle: "italic" }}>(linha em branco)</span>
        ) : chars.map((ch, pos) => {
          const chord = model.chords[pos];
          return (
            <span key={pos} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <span
                onClick={() => openEditor(pos)}
                style={{ height: "1.5em", lineHeight: "1.5em", fontSize: 13, fontWeight: 700, color: chord ? "#2f9d63" : "transparent", cursor: "pointer", whiteSpace: "pre" }}
                title={chord ? "Editar acorde" : "Adicionar acorde aqui"}>
                {chord || "+"}
              </span>
              <span
                onClick={() => openEditor(pos)}
                style={{ whiteSpace: "pre", cursor: "pointer", color: "#1a2b22", background: chord ? "rgba(47,157,99,.12)" : "transparent", borderRadius: 2 }}>
                {ch === " " ? "\u00A0" : ch}
              </span>
            </span>
          );
        })}
        {/* acorde no fim da linha */}
        <span style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <span onClick={() => openEditor(model.text.length)}
            style={{ height: "1.5em", lineHeight: "1.5em", fontSize: 13, fontWeight: 700, color: model.chords[model.text.length] ? "#2f9d63" : "transparent", cursor: "pointer", paddingLeft: 4 }}>
            {model.chords[model.text.length] || "+"}
          </span>
          <span onClick={() => openEditor(model.text.length)} style={{ cursor: "pointer", paddingLeft: 4, color: "#1a2b22" }}>{"\u00A0"}</span>
        </span>
      </div>

      {/* mini-editor do acorde */}
      {editingPos !== null && (
        <div style={{ position: "absolute", top: "-6px", left: 0, zIndex: 10, display: "flex", gap: 6, background: "#0c2419", border: "1px solid #2f7d57", borderRadius: 8, padding: 6, boxShadow: "0 8px 20px rgba(0,0,0,.4)" }}>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditingPos(null); setDraft(""); } }}
            placeholder="acorde (ex: D/F#)"
            style={{ width: 110, padding: "6px 8px", borderRadius: 6, border: "1px solid #1d4435", background: "#08160f", color: "#fff", fontSize: 13, fontFamily: "'Space Mono',monospace", outline: "none" }} />
          <button onClick={commit} style={{ ...primaryBtn(), padding: "6px 10px", fontSize: 12 }}>OK</button>
          <button onClick={() => { setEditingPos(null); setDraft(""); }} style={{ ...ghostBtn(), padding: "6px 8px" }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

function VisualChordEditor({ content, onChange }) {
  const lines = (content || "").split("\n");
  const [lyricsMode, setLyricsMode] = useState(false);
  const [draftText, setDraftText] = useState("");

  const updateLine = (idx, newLine) => {
    const arr = [...lines];
    arr[idx] = newLine;
    onChange(arr.join("\n"));
  };

  // reaplica os acordes existentes sobre a nova letra, preservando as posições
  // (limitadas ao novo comprimento de cada linha)
  const applyLyricsKeepingChords = (newText) => {
    const oldLines = lines;
    const newLines = newText.split("\n");
    const merged = newLines.map((newLyric, i) => {
      const oldModel = oldLines[i] ? parseLineToModel(oldLines[i]) : { text: "", chords: {} };
      const chords = {};
      // mantém cada acorde na mesma posição, sem ultrapassar o tamanho da nova letra
      Object.keys(oldModel.chords).forEach(posStr => {
        const pos = Math.min(parseInt(posStr, 10), newLyric.length);
        chords[pos] = oldModel.chords[posStr];
      });
      return modelToLine(newLyric, chords);
    });
    onChange(merged.join("\n"));
  };

  if (lyricsMode) {
    return (
      <div style={{ background: "#08160f", border: "1px solid #1d4435", borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 12.5, color: "#9fc7b2", marginBottom: 8 }}>Edite a <strong style={{ color: "#fff" }}>letra</strong>. Os acordes já posicionados são preservados na mesma posição (ajuste depois se precisar).</div>
        <textarea autoFocus value={draftText}
          onChange={e => setDraftText(e.target.value)}
          rows={6}
          style={{ ...inputStyle(), fontFamily: "'Space Mono',monospace", lineHeight: 1.5, fontSize: 15, resize: "vertical" }} />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={() => { applyLyricsKeepingChords(draftText); setLyricsMode(false); }} style={primaryBtn()}>Concluir letra</button>
          <button onClick={() => setLyricsMode(false)} style={ghostBtn()}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fbfdfb", border: "1px solid #d6e6dd", borderRadius: 10, padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "#4a5b52" }}>Clique numa <strong>sílaba</strong> para pôr o acorde acima dela. Clique num acorde para editar/remover.</span>
        <button onClick={() => { setDraftText(lines.map(l => parseLineToModel(l).text).join("\n")); setLyricsMode(true); }} style={{ ...ghostBtn(), padding: "5px 10px", fontSize: 12, color: "#0d3d28", borderColor: "#cde0d4" }}>
          <Edit3 size={13} /> Editar letra
        </button>
      </div>
      {lines.map((line, idx) => (
        <VisualLine key={idx} line={line} lineIndex={idx} onChange={nl => updateLine(idx, nl)} />
      ))}
    </div>
  );
}

/* ---------- Repertórios / listas por culto ---------- */
function SetlistsView({ setlists, songs, canEdit, onBack, onSave, onDelete, onOpenSong }) {
  const [editing, setEditing] = useState(null); // objeto setlist em edição, ou null
  const [opened, setOpened] = useState(null);   // setlist aberto para uso

  // ----- abrindo um repertório (lista de músicas em ordem) -----
  if (opened) {
    const songsInOrder = (opened.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 90px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => setOpened(null)} style={ghostBtn()}><ArrowLeft size={18} /> Repertórios</button>
          {canEdit && <button onClick={() => { setEditing(opened); setOpened(null); }} style={ghostBtn()}><Edit3 size={16} /> Editar</button>}
        </div>
        <div style={{ background: "linear-gradient(135deg,#0f4a30,#0a3422)", border: "1px solid #1d6b46", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, padding: "4px 10px", borderRadius: 7, textTransform: "uppercase", marginBottom: 8,
            background: groupColorSoft(opened.group), color: groupColor(opened.group), border: `1px solid ${groupColor(opened.group)}44` }}>
            {opened.group || "Todos os grupos"}
          </div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 24, color: "#fff" }}>{opened.name}</h1>
          {opened.date && <p style={{ margin: "4px 0 0", color: "#9fdabb", fontSize: 14 }}>{formatDate(opened.date)}</p>}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {songsInOrder.length === 0 ? (
            <p style={{ color: "#6fae8a" }}>Nenhuma música neste repertório ainda.</p>
          ) : songsInOrder.map((s, i) => (
            <button key={s.id} onClick={() => onOpenSong(s)} style={cardStyle()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2f7d57"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#15392b"; }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(63,174,107,.15)", color: "#3fae6b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 17, color: "#fff" }}>{s.title}</div>
                <div style={{ color: "#6fae8a", fontSize: 13 }}>{s.artist || "—"} · Tom {s.key || "—"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- editor de repertório -----
  if (editing) {
    return <SetlistEditor setlist={editing} songs={songs}
      onCancel={() => setEditing(null)}
      onSave={async (sl) => { await onSave(sl); setEditing(null); }}
      onDelete={editing.id ? async () => { if (confirm("Excluir este repertório? As músicas continuam no acervo.")) { await onDelete(editing.id); setEditing(null); } } : null} />;
  }

  // ----- lista de repertórios -----
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 90px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <button onClick={onBack} style={ghostBtn()}><ArrowLeft size={18} /> Voltar</button>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: "#fff" }}>Repertórios</h2>
        <span style={{ width: 80 }} />
      </div>
      {canEdit && (
        <button onClick={() => setEditing({ name: "", date: "", songIds: [] })} style={{ ...primaryBtn(), width: "100%", justifyContent: "center", marginBottom: 20 }}>
          <Plus size={18} /> Novo repertório
        </button>
      )}
      {setlists.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 16 }}>
          <ListMusic size={40} style={{ opacity: 0.45, marginBottom: 12 }} />
          <p>Nenhum repertório por aqui. {canEdit ? "Crie um para organizar as músicas de um culto." : "Repertórios aparecem conforme os grupos que você escolheu em \"Meus grupos\"."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {setlists.map(sl => (
            <button key={sl.id} onClick={() => setOpened(sl)} style={cardStyle()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2f7d57"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#15392b"; }}>
              <ListMusic size={20} color="#3fae6b" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 17, color: "#fff" }}>{sl.name}</div>
                <div style={{ color: "#6fae8a", fontSize: 13 }}>{sl.date ? formatDate(sl.date) + " · " : ""}{(sl.songIds || []).length} música(s)</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, padding: "5px 10px", borderRadius: 8, textTransform: "uppercase",
                background: groupColorSoft(sl.group), color: groupColor(sl.group), border: `1px solid ${groupColor(sl.group)}33` }}>
                {sl.group || "Todos"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SetlistEditor({ setlist, songs, onCancel, onSave, onDelete }) {
  const [name, setName] = useState(setlist.name || "");
  const [date, setDate] = useState(setlist.date || "");
  const [group, setGroup] = useState(setlist.group || "");
  const [songIds, setSongIds] = useState(setlist.songIds || []);
  const [picker, setPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const inList = songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
  const available = songs.filter(s => !songIds.includes(s.id))
    .filter(s => {
      const q = pickerSearch.toLowerCase().trim();
      if (!q) return true;
      return (s.title || "").toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q);
    })
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  const move = (i, d) => { const j = i + d; if (j < 0 || j >= songIds.length) return; const a = [...songIds]; [a[i], a[j]] = [a[j], a[i]]; setSongIds(a); };
  const remove = id => setSongIds(songIds.filter(x => x !== id));
  const add = id => { setSongIds([...songIds, id]); };

  const save = () => {
    if (!name.trim()) { alert("Dê um nome ao repertório (ex: Culto de Domingo)."); return; }
    onSave({ ...setlist, name: name.trim(), date, group, songIds });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: "#fff" }}>{setlist.id ? "Editar repertório" : "Novo repertório"}</h2>
        <button onClick={save} style={primaryBtn()}><Save size={16} /> Salvar</button>
      </div>

      <div style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <Field label="Nome (ex: Culto de Domingo, Ensaio)"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle()} placeholder="Culto de Domingo" /></Field>
        <Field label="Grupo de louvor">
          <select value={group} onChange={e => setGroup(e.target.value)} style={inputStyle()}>
            <option value="">Todos os grupos (visível a todos)</option>
            {WORSHIP_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} /></Field>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "#cfe6d9" }}>Músicas ({inList.length})</h3>
        <button onClick={() => { setPicker(p => !p); setPickerSearch(""); }} style={ghostBtn()}>
          {picker ? <><X size={16} /> Fechar</> : <><Plus size={16} /> Adicionar música</>}
        </button>
      </div>

      {picker && (
        <div style={{ background: "#0c2419", border: "1px solid #2f7d57", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={17} style={{ position: "absolute", left: 12, top: 12, color: "#5d917a" }} />
            <input autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
              placeholder="Procurar por título ou artista…"
              style={inputStyle({ paddingLeft: 40 })} />
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {available.length === 0 ? (
              <p style={{ color: "#6fae8a", margin: 8 }}>
                {pickerSearch.trim() ? "Nenhuma música encontrada para essa busca." : "Todas as músicas já estão no repertório."}
              </p>
            ) : available.map(s => (
              <button key={s.id} onClick={() => add(s.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: "#eef5f0", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 14 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(47,125,87,.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {s.title} <span style={{ color: "#6fae8a", fontSize: 12.5 }}>· {s.artist || "—"}{s.key ? " · Tom " + s.key : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {inList.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0c2419", border: "1px solid #15392b", borderRadius: 11, padding: "10px 12px" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(63,174,107,.15)", color: "#3fae6b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 15 }}>{s.title}</div>
              <div style={{ color: "#6fae8a", fontSize: 12.5 }}>{s.artist || "—"} · Tom {s.key || "—"}</div>
            </div>
            <button onClick={() => move(i, -1)} style={iconBtn()}><ChevronUp size={15} /></button>
            <button onClick={() => move(i, 1)} style={iconBtn()}><ChevronDown size={15} /></button>
            <button onClick={() => remove(s.id)} style={{ ...iconBtn(), color: "#e8554d" }}><X size={15} /></button>
          </div>
        ))}
      </div>

      {onDelete && (
        <button onClick={onDelete} style={{ ...ghostBtn(), color: "#e8554d", marginTop: 24 }}>
          <Trash2 size={16} /> Excluir repertório
        </button>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

/* ---------- Editor ---------- */
function SongEditor({ song, memberName, onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState(song?.title || "");
  const [artist, setArtist] = useState(song?.artist || "");
  const [category, setCategory] = useState(song?.category || "Louvor");
  const [categoryOther, setCategoryOther] = useState(song?.categoryOther || "");
  const [hymnNumber, setHymnNumber] = useState(song?.hymnNumber || "");
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
  const moveTo = (from, to) => {
    if (from === to || from == null || to == null) return;
    const a = [...sections];
    const [item] = a.splice(from, 1);
    a.splice(to, 0, item);
    setSections(a);
  };
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const sectionRefs = useRef([]);
  const dragRef = useRef(null);
  const overRef = useRef(null);

  const handleDragPointerDown = (i) => (e) => {
    e.preventDefault();
    dragRef.current = i; overRef.current = i;
    setDragIndex(i); setOverIndex(i);
    const onMove = (ev) => {
      const y = ev.clientY;
      let target = dragRef.current;
      for (let idx = 0; idx < sections.length; idx++) {
        const el = sectionRefs.current[idx];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) { target = idx; break; }
      }
      overRef.current = target;
      setOverIndex(target);
    };
    const onUp = () => {
      if (dragRef.current != null && overRef.current != null) moveTo(dragRef.current, overRef.current);
      dragRef.current = null; overRef.current = null;
      setDragIndex(null); setOverIndex(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const duplicate = i => { const a = [...sections]; a.splice(i + 1, 0, { ...sections[i] }); setSections(a); };

  // snapshot inicial para detectar alterações não salvas
  const initialSnapshot = useRef(JSON.stringify({
    title: song?.title || "", artist: song?.artist || "", category: song?.category || "Louvor",
    categoryOther: song?.categoryOther || "", hymnNumber: song?.hymnNumber || "",
    key: song?.key || "C", bpm: song?.bpm || 120, timeSig: song?.timeSig || "4/4",
    feel: song?.feel || "", youtube: song?.youtube || "",
    sections: song?.sections?.length ? song.sections : [{ type: "Introdução", label: "", repeat: "", content: "[C] [G] [Am] [F]" }]
  }));
  const isDirty = () => initialSnapshot.current !== JSON.stringify({
    title, artist, category, categoryOther, hymnNumber, key, bpm, timeSig, feel, youtube, sections
  });
  const handleCancel = () => {
    if (isDirty() && !confirm("Você tem alterações não salvas. Deseja sair e descartá-las?")) return;
    onCancel();
  };

  const handleSave = () => {
    if (!title.trim()) { alert("Dê um título à música."); return; }
    onSave({
      id: song?.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(), artist: artist.trim(),
      category, categoryOther: category === "Outra" ? categoryOther.trim() : "",
      hymnNumber: category === "Hino" ? (hymnNumber.toString().trim()) : "",
      key, bpm: Number(bpm) || 0,
      timeSig, feel: feel.trim(), youtube: youtube.trim(),
      sections: sections.filter(s => s.content.trim() || s.type),
      updatedBy: memberName || "anônimo", updatedAt: Date.now()
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 130px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <button onClick={handleCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 28, color: "#fff" }}>{song ? "Editar cifra" : "Nova cifra"}</h2>
        <button onClick={handleSave} style={primaryBtn()}><Save size={16} /> Salvar</button>
      </div>

      <div style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 18, padding: 22, marginBottom: 20 }}>
        <Field label="Título"><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()} placeholder="Ex: Bondade de Deus" /></Field>
        <Field label="Artista / Ministério"><input value={artist} onChange={e => setArtist(e.target.value)} style={inputStyle()} placeholder="Ex: Isaías Saad" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14 }}>
          <Field label="Categoria">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle()}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {category === "Outra" && (
            <Field label="Qual categoria?"><input value={categoryOther} onChange={e => setCategoryOther(e.target.value)} style={inputStyle()} placeholder="Ex: Comunhão" /></Field>
          )}
          {category === "Hino" && (
            <Field label="Número do hino"><input type="number" value={hymnNumber} onChange={e => setHymnNumber(e.target.value)} style={inputStyle()} placeholder="Ex: 14" /></Field>
          )}
        </div>
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
        const isDragging = dragIndex === i;
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <div key={i} ref={el => sectionRefs.current[i] = el}
            style={{ background: "#0c2419", border: isOver ? "1px solid #2f7d57" : "1px solid #15392b", borderRadius: 14, padding: 16, marginBottom: 14, borderLeft: `5px solid ${color}`,
              opacity: isDragging ? 0.5 : 1, boxShadow: isOver ? "0 0 0 2px rgba(47,125,87,.4)" : "none", transition: "border-color .12s, box-shadow .12s" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <button onPointerDown={handleDragPointerDown(i)} title="Arraste para reordenar"
                style={{ ...iconBtn(), cursor: "grab", touchAction: "none", color: "#6fae8a" }}>
                <GripVertical size={16} />
              </button>
              <select value={sec.type} onChange={e => update(i, "type", e.target.value)} style={inputStyle({ maxWidth: 160 })}>
                {SECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={sec.label} onChange={e => update(i, "label", e.target.value)} placeholder="rótulo" style={inputStyle({ maxWidth: 90, padding: 10 })} />
              <input value={sec.repeat} onChange={e => update(i, "repeat", e.target.value)} placeholder="repete ×" style={inputStyle({ maxWidth: 85, padding: 10 })} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => move(i, -1)} style={iconBtn()} title="Mover para cima"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} style={iconBtn()} title="Mover para baixo"><ChevronDown size={16} /></button>
                <button onClick={() => duplicate(i)} style={iconBtn()} title="Duplicar seção"><Copy size={15} /></button>
                <button onClick={() => remove(i)} style={{ ...iconBtn(), color: "#e8554d" }} title="Excluir seção"><Trash2 size={16} /></button>
              </div>
            </div>

            {/* Seletor de modo de edição */}
            <div style={{ display: "inline-flex", gap: 2, background: "#08160f", border: "1px solid #1d4435", borderRadius: 9, padding: 3, marginBottom: 10 }}>
              {[["text", "Texto"], ["visual", "Visual (clicar)"]].map(([m, lbl]) => {
                const active = (sec.editMode || "text") === m;
                return (
                  <button key={m} onClick={() => update(i, "editMode", m)}
                    style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 12.5, fontWeight: 600,
                      background: active ? "linear-gradient(135deg,#0f4a30,#0a3422)" : "transparent", color: active ? "#fff" : "#6fae8a" }}>
                    {lbl}
                  </button>
                );
              })}
            </div>

            {(sec.editMode || "text") === "visual" ? (
              <VisualChordEditor content={sec.content} onChange={v => update(i, "content", v)} />
            ) : (
              <textarea value={sec.content} onChange={e => update(i, "content", e.target.value)} rows={5}
                placeholder={"Eu [G]te lou[D/F#]varei, [Em]Senhor"}
                style={{ ...inputStyle(), fontFamily: "'Space Mono',monospace", resize: "vertical", lineHeight: 1.6, fontSize: 15 }} />
            )}
            <input value={sec.note || ""} onChange={e => update(i, "note", e.target.value)}
              placeholder="♪ Instrução da seção (ex: subir a dinâmica, entra toda a banda, só voz e piano…)"
              style={{ ...inputStyle({ marginTop: 8, fontSize: 13, fontStyle: "italic" }) }} />
          </div>
        );
      })}

      <button onClick={addSection} style={{ ...ghostBtn(), width: "100%", justifyContent: "center", padding: 15, border: "1px dashed #1d4435" }}>
        <Plus size={18} /> Adicionar seção
      </button>

      {onDelete && (
        <button onClick={() => { if (confirm(`Excluir "${title}" definitivamente?\n\nIsso remove a cifra para TODOS os membros e não pode ser desfeito.`)) onDelete(); }} style={{ ...ghostBtn(), color: "#e8554d", marginTop: 26 }}>
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
  return { width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", fontSize: 15, fontFamily: "'Montserrat',sans-serif", outline: "none", ...extra };
}
function primaryBtn() {
  return { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#fff,#dff0e6)", color: "#0d3d28", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", boxShadow: "0 6px 18px rgba(255,255,255,.12)" };
}
function ghostBtn() {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, border: "1px solid #1d4435", background: "transparent", color: "#eef5f0", fontSize: 14, cursor: "pointer", fontFamily: "'Montserrat',sans-serif" };
}
function iconBtn() {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", cursor: "pointer" };
}
function stepBtn() {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(0,0,0,.3)", color: "#fff", cursor: "pointer" };
}
function cardStyle() {
  return { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 13, border: "1px solid #15392b", background: "#0c2419", cursor: "pointer", transition: "all .18s ease", fontFamily: "'Montserrat',sans-serif", color: "#eef5f0", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" };
}
function chip() {
  return { display: "inline-flex", alignItems: "center", gap: 5, background: "#08160f", padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap" };
}
