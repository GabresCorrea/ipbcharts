import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, Music, Play, Pause, Edit3, Trash2, Youtube, ChevronUp, ChevronDown, X, Search, Save, ArrowLeft, Hash, LogOut, Tag, User, BookOpen, Copy, Maximize2, Download, Minus, GripVertical, Upload, WifiOff, Type, ListMusic, Users, GraduationCap } from "lucide-react";
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

// Para cada semitom (0-11), qual nome de nota deve ser usado em tonalidades maiores/menores.
// Usa a convenção da teoria musical: cada tonalidade tem uma única grafia canônica.
// Maiores com sustenidos: C G D A E B F#/Gb
// Maiores com bemóis:     F Bb Eb Ab Db Gb
// As relativas menores seguem a mesma grafia da maior correspondente.
// Índice = semitom (0=C, 1=C#/Db, 2=D, ...)
// true  = usa bemóis para esse semitom como raiz de tonalidade
// false = usa sustenidos
const KEY_USES_FLATS = {
  // Maiores
  "C": false, "C#": false, "Db": true,  "D": false, "D#": false, "Eb": true,
  "E": false, "F": true,   "F#": false, "Gb": true,  "G": false,  "G#": false,
  "Ab": true,  "A": false,  "A#": false, "Bb": true,  "B": false,
  // Menores (relativas — mesma grafia do relativo maior)
  "Cm": true,  "C#m": false, "Dbm": true,  "Dm": true,  "D#m": false, "Ebm": true,
  "Em": false, "Fm": true,   "F#m": false, "Gbm": true,  "Gm": true,   "G#m": false,
  "Abm": true,  "Am": false,  "A#m": false, "Bbm": true,  "Bm": false,
};
function keyUsesFlats(key) {
  if (key in KEY_USES_FLATS) return KEY_USES_FLATS[key];
  // fallback: se a raiz for bemol, usa bemóis
  return /b/.test(key);
}
const FLAT_KEYS = new Set(Object.keys(KEY_USES_FLATS).filter(k => KEY_USES_FLATS[k]));

// Tipos de seção + cor própria (todas distintas)
const SECTION_TYPES = [
  "Introdução", "Intro", "Verso", "Pré-Refrão", "Refrão", "Ponte",
  "Interlúdio", "Turnaround", "Rampa", "Repete", "Saída", "Final", "Instrumental", "Solo"
];
const SECTION_COLORS = {
  "Introdução": "#e0b341", "Intro": "#c98a2b",
  "Verso": "#4f9dde", "Pré-Refrão": "#9b6ef0", "Refrão": "#e8554d",
  "Ponte": "#34c98a", "Interlúdio": "#3fb6c9", "Turnaround": "#f0883e",
  "Rampa": "#ec6aa8", "Repete": "#7a86f0", "Saída": "#9aa3ad", "Final": "#a07850",
  "Instrumental": "#2bc4b0", "Solo": "#c06ef0"
};

// Siglas das seções exibidas no círculo e no cabeçalho
const SECTION_ABBR = {
  "Introdução": "I",  "Intro": "I",
  "Verso":      "V",  // + número do label
  "Pré-Refrão": "Pr",
  "Refrão":     "R",  // + número do label
  "Ponte":      "P",
  "Interlúdio": "It",
  "Turnaround": "To",
  "Rampa":      "Rp",
  "Repete":     "Re",
  "Saída":      "S",
  "Final":      "F",
  "Instrumental":"In",
  "Solo":       "So",
};
// Retorna a sigla curta para exibição no círculo e no label da seção.
// Para Verso e Refrão, incorpora o número do label (ex: V1, R2).
function sectionAbbr(type, label) {
  const base = SECTION_ABBR[type] || (type || "").slice(0, 2).toUpperCase();
  const num = (label || "").trim().match(/^\d+$/);
  if (num && (type === "Verso" || type === "Refrão")) return base + num[0];
  return base;
}

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
    return <div style={{ lineHeight: 1.7, fontFamily: "'Montserrat',sans-serif", fontSize: "1em", color: "#eef5f0", whiteSpace: "pre-wrap", marginBottom: 2 }}>{lyric}</div>;
  }

  // Linha só com acordes (intro, interlúdio)
  if (!hasLyrics) {
    return (
      <div style={{ lineHeight: 1.9, color: "#2f9d63", fontWeight: 700, fontFamily: "'Montserrat',sans-serif", fontSize: "1em", whiteSpace: "pre-wrap", marginBottom: 2 }}>
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
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", fontFamily: "'Montserrat',sans-serif", fontSize: "1em", marginBottom: 6 }}>
      {groups.map((g, i) => {
        const emptyText = !g.text || g.text.trim() === "";
        const lyricContent = g.chord && emptyText ? "\u00A0\u00A0" : g.text;
        const chordStr = g.chord ? showChord(g.chord) : "";
        // Largura visível do texto embaixo (sem contar o espaço-reserva).
        const textLen = (g.text || "").length;
        // Se o acorde é mais largo que a sílaba/texto embaixo, reserva um pequeno
        // espaço à DIREITA do acorde para ele não colar no próximo acorde.
        // Não afeta a letra (o espaço fica só na linha do acorde).
        const chordNeedsGap = chordStr && chordStr.length >= Math.max(textLen, 1);
        return (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <span style={{ height: "1.5em", lineHeight: "1.5em", color: chordColor, fontWeight: 700, fontSize: "0.9em", whiteSpace: "pre", paddingRight: chordNeedsGap ? "0.7em" : 0, boxSizing: "content-box" }}>
              {chordStr}
            </span>
            <span style={{ color: "#eef5f0", whiteSpace: "pre", lineHeight: 1.4, fontSize: "1.07em" }}>
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
  const [currentSetlist, setCurrentSetlist] = useState(null); // repertório de onde veio a música atual
  const [groupBy, setGroupBy] = useState("category"); // aba ativa da lista (persiste ao abrir música)
  const listScrollRef = useRef(0); // posição de rolagem da lista para restaurar ao voltar
  // Controla quais categorias estão abertas na lista. Recolhido na tela inicial;
  // ao voltar de uma música, a categoria correspondente é aberta automaticamente.
  const [openCategories, setOpenCategories] = useState({});
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
        onOpenTeoria={() => setView("teoria")}
        myGroups={myGroups} onSaveGroups={saveMyGroups}
        groupBy={groupBy} setGroupBy={setGroupBy} restoreScroll={listScrollRef}
        openCategories={openCategories} setOpenCategories={setOpenCategories}
        onOpen={s => {
          listScrollRef.current = window.scrollY || document.scrollingElement?.scrollTop || 0;
          // Expande a categoria da música aberta para que ao voltar ela esteja visível
          const catKey = s.category === "Outra" ? (s.categoryOther?.trim() || "Outra") : (s.category || "Sem categoria");
          setOpenCategories(prev => ({ ...prev, [catKey]: true }));
          setCurrentSetlist(null); setCurrent(s); setView("view");
        }} onNew={() => { if (canEdit) { setCurrent(null); setView("edit"); } }}
        onNewHymn={() => { if (canEdit) { setCurrent({ category: "Hino", artist: "Hinário Novo Cântico" }); setView("edit"); } }} />}
      {view === "setlists" && <SetlistsView setlists={visibleSetlists} songs={songs} canEdit={canEdit}
        reopenSetlistId={currentSetlist?.id || null} onClearReopen={() => setCurrentSetlist(null)}
        onBack={() => { setCurrentSetlist(null); setView("list"); }} onSave={saveSetlist} onDelete={deleteSetlist}
        onOpenSong={(s, openedSetlist) => { setCurrent(s); setCurrentSetlist(openedSetlist || null); setView("view"); }} />}
      {view === "teoria" && <TeoriaMusicaView onBack={() => setView("list")} />}
      {view === "view" && current && <SongView song={current} canEdit={canEdit}
        pref={prefs[current.id]} prefsLoaded={prefsLoaded} onSavePref={(st, cp) => savePref(current.id, st, cp)}
        onBack={() => { if (currentSetlist) { setView("setlists"); } else { setView("list"); } }}
        onEdit={() => { if (canEdit) setView("edit"); }}
        currentSetlist={currentSetlist} songs={songs}
        onNavigateSong={(s) => { setCurrent(s); }} />}
      {view === "edit" && canEdit && <SongEditor song={current} memberName={memberName}
        onCancel={() => setView(current?.id ? "view" : "list")}
        onSave={s => { saveSong(s); setCurrent(s); setView("view"); }}
        onDelete={current?.id ? () => { deleteSong(current.id); setView("list"); } : null} />}
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
    <button onClick={() => onOpen(s)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        background: "transparent", border: "none", borderBottom: "1px solid #143426",
        padding: "11px 6px", cursor: "pointer", fontFamily: "'Montserrat',sans-serif" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#0e2c1f"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      {/* marca de categoria (ponto colorido) ou número do hino */}
      {showHymnNumber ? (
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#d4a017,#a87813)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d3d28", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
          {s.hymnNumber || "—"}
        </div>
      ) : (
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: catColor, flexShrink: 0 }} />
      )}
      {/* título + artista (artista discreto na mesma área) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15.5, color: "#fff", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
        {s.artist && <div style={{ color: "#6fae8a", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.artist}</div>}
      </div>
      {/* lado direito: vídeo (se houver) + tom */}
      {s.youtube && <Youtube size={15} color="#e8554d" style={{ flexShrink: 0, opacity: 0.85 }} />}
      <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, color: "#9fdabb", background: "rgba(63,174,107,.12)", borderRadius: 7, padding: "4px 9px", minWidth: 30, textAlign: "center" }}>{s.key || "—"}</span>
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
                  {on && <span style={{ color: "#06110b", fontWeight: 900, fontSize: 13 }}></span>}
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

function SongList({ songs, allCount, search, setSearch, memberName, canEdit, onLogout, onExport, onImport, setlistCount, onOpenSetlists, onOpenTeoria, myGroups, onSaveGroups, groupBy, setGroupBy, restoreScroll, openCategories, setOpenCategories, onOpen, onNew, onNewHymn }) {
  const [showGroups, setShowGroups] = useState(false);
  const importInputRef = useRef(null);
  const toggleCategory = (k) => setOpenCategories(prev => ({ ...prev, [k]: !prev[k] }));

  // restaura a posição de rolagem ao voltar para a lista (ex.: após ver uma música)
  useEffect(() => {
    const y = restoreScroll?.current || 0;
    if (y > 0) {
      const doScroll = () => window.scrollTo(0, y);
      requestAnimationFrame(doScroll);
      // reforço caso o conteúdo só termine de renderizar um instante depois
      const t = setTimeout(doScroll, 60);
      return () => clearTimeout(t);
    }
  }, []);

  // separa hinos
  const hymns = useMemo(() =>
    songs.filter(s => s.category === "Hino")
      .sort((a, b) => (parseInt(a.hymnNumber) || 9999) - (parseInt(b.hymnNumber) || 9999)),
    [songs]);

  // agrupa por categoria ou autor
  const grouped = useMemo(() => {
    const list = groupBy === "hymns" ? hymns : songs.filter(s => s.category !== "Hino");
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
        <button onClick={onOpenTeoria} style={{ ...ghostBtn(), padding: "12px 16px" }}><GraduationCap size={17} /> Teoria Musical</button>
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

      {/* Botão direto de adicionar hino (só na aba Hinos, para editores) */}
      {groupBy === "hymns" && canEdit && (
        <button onClick={onNewHymn} style={{ ...primaryBtn(), width: "100%", justifyContent: "center", marginBottom: 14 }}>
          <Plus size={18} /> Adicionar um Hino
        </button>
      )}

      {songs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 18 }}>
          <Music size={42} style={{ opacity: 0.45, marginBottom: 14 }} />
          <p>Nenhuma cifra ainda. Adicione a primeira do repertório!</p>
        </div>
      ) : groupBy === "hymns" && hymns.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "#4d7a64", border: "1px dashed #1d4435", borderRadius: 18 }}>
          <BookOpen size={42} style={{ opacity: 0.45, marginBottom: 14 }} />
          <p>Nenhum hino ainda.{canEdit ? " Use o botão acima para adicionar." : ""}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.keys.map(k => {
            const catColor = groupBy === "category" ? (CATEGORY_COLORS[k] || CATEGORY_COLORS[grouped.items[k][0]?.category] || "#3fae6b") : "#3fae6b";
            // Expandido se: há busca ativa (para mostrar resultados), ou se o usuário abriu manualmente
            const isOpen = search.trim() ? true : !!openCategories[k];
            return (
              <div key={k} style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden" }}>
                {/* Cabeçalho clicável */}
                <button onClick={() => toggleCategory(k)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#0e2c1f"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 4, height: 18, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#cfe6d9", textTransform: "uppercase", letterSpacing: 1.2, flex: 1 }}>{k}</span>
                  <span style={{ fontSize: 12, color: "#5d917a", marginRight: 6 }}>{grouped.items[k].length}</span>
                  <span style={{ color: "#5d917a", transition: "transform .18s", display: "inline-flex", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <ChevronDown size={16} />
                  </span>
                </button>
                {/* Conteúdo recolhível */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #15392b" }}>
                    {grouped.items[k].map(s => (
                      <SongCard key={s.id} s={s} onOpen={onOpen} showHymnNumber={groupBy === "hymns"} />
                    ))}
                  </div>
                )}
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
      <div style={{ padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", background: "#08160f", borderBottom: "1px solid #15392b" }}>
        {/* Linha 1: Sair + NOME em destaque */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={onExit} style={ghostBtn()}><X size={18} /> Sair</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
            <div style={{ color: "#7fa896", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {song.artist || ""}{song.artist ? " · " : ""}Tom {soundingKey}{capo > 0 ? ` · Capo ${capo}ª` : ""}{song.bpm ? ` · ${song.bpm} BPM` : ""}
            </div>
          </div>
        </div>
        {/* Linha 2: controles compactos */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "2px 4px" }}>
            <span style={{ fontSize: 9.5, color: "#9fdabb", padding: "0 3px" }}>TOM</span>
            <button onClick={() => setSemitones(s => s - 1)} style={stepBtnSm()}><ChevronDown size={14} /></button>
            <button onClick={() => setSemitones(s => s + 1)} style={stepBtnSm()}><ChevronUp size={14} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "2px 4px" }}>
            <span style={{ fontSize: 9.5, color: "#9fdabb", padding: "0 3px" }}>CAPO</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtnSm()}><ChevronDown size={14} /></button>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtnSm()}><ChevronUp size={14} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "2px 4px" }}>
            <span style={{ fontSize: 9.5, color: "#9fdabb", padding: "0 3px" }}>FONTE</span>
            <button onClick={() => setFontScale(f => Math.max(0.7, f - 0.1))} style={stepBtnSm()}><Minus size={14} /></button>
            <button onClick={() => setFontScale(f => Math.min(2.2, f + 0.1))} style={stepBtnSm()}><Plus size={14} /></button>
          </div>
          <button onClick={() => setScrolling(s => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 12, background: scrolling ? "#fff" : "rgba(0,0,0,.3)", color: scrolling ? "#0d3d28" : "#fff" }}>
            {scrolling ? <Pause size={14} /> : <Play size={14} />} Auto-scroll
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "2px 4px" }}>
            <span style={{ fontSize: 9.5, color: "#9fdabb", padding: "0 3px" }}>VEL</span>
            <button onClick={() => setSpeed(s => Math.max(10, s - 10))} style={stepBtnSm()}><Minus size={14} /></button>
            <span style={{ fontSize: 11, color: "#fff", minWidth: 18, textAlign: "center" }}>{Math.round(speed / 10)}</span>
            <button onClick={() => setSpeed(s => Math.min(160, s + 10))} style={stepBtnSm()}><Plus size={14} /></button>
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
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color, textTransform: "uppercase", fontSize: 13 * fontScale, letterSpacing: 1, lineHeight: 1.3 }}>
                        {sectionAbbr(sec.type, sec.label)}{sec.repeat ? ` ×${sec.repeat}` : ""}
                      </span>
                      <span style={{ fontWeight: 500, color, opacity: 0.65, textTransform: "uppercase", fontSize: 10 * fontScale, letterSpacing: 0.5, lineHeight: 1.3 }}>
                        — {sec.type}{sec.label && !/^\d+$/.test(sec.label.trim()) ? ` ${sec.label}` : ""}
                      </span>
                    </div>
                    {sec.note && (
                      <div style={{ fontSize: 10 * fontScale, color: "#9fdabb", fontStyle: "italic", marginTop: 1, lineHeight: 1.3 }}> {sec.note}</div>
                    )}
                  </div>
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
    return `<div class="line">${groups.map(g => {
      const chordStr = g.chord ? esc(g.chord) : "";
      const textLen = (g.text || "").length;
      const needsGap = chordStr && chordStr.length >= Math.max(textLen, 1);
      return `<span class="col"><span class="ch"${needsGap ? ' style="padding-right:.7em"' : ""}>${chordStr || "&nbsp;"}</span><span class="ly">${esc(g.text).replace(/ /g, "&nbsp;") || "&nbsp;"}</span></span>`;
    }).join("")}</div>`;
  };
  const sectionItems = (song.sections || []).map(sec => {
    const color = SECTION_COLORS[sec.type] || "#3fae6b";
    const contentLines = (sec.content || "").split("\n");
    const lines = contentLines.map(renderLineHTML).join("");
    const name = `${esc(sec.type)}${sec.label && !/^\d+$/.test((sec.label || "").trim()) ? " " + esc(sec.label) : (sec.label ? " " + esc(sec.label) : "")}`;
    const html = `<div class="section">
      <div class="sechead">
        <span class="badge" style="border-color:${color};color:${color}">${esc(sectionAbbr(sec.type, sec.label))}</span>
        <span class="setitle">${name}</span>${sec.repeat ? `<span class="rep" style="color:${color}">×${esc(sec.repeat)}</span>` : ""}
        <span class="hline" style="background:${color}"></span>
      </div>
      ${sec.note ? `<div class="note">${esc(sec.note)}</div>` : ""}
      <div class="secbody">${lines}</div>
    </div>`;
    // peso aproximado (altura) = nº de linhas + cabeçalho (+1 se tem instrução)
    const weight = contentLines.length + 2 + (sec.note ? 1 : 0);
    return { html, weight };
  });
  // duas colunas, equilibrando a altura total entre elas
  const totalWeight = sectionItems.reduce((a, s) => a + s.weight, 0);
  const half = totalWeight / 2;
  const leftCol = [], rightCol = [];
  let acc = 0;
  sectionItems.forEach(item => {
    if (acc < half || leftCol.length === 0) { leftCol.push(item.html); acc += item.weight; }
    else rightCol.push(item.html);
  });
  const sectionsHTML = `<table class="coltable"><tr>
    <td class="colcell">${leftCol.join("")}</td>
    <td class="colgap"></td>
    <td class="colcell">${rightCol.join("")}</td>
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
    @page { size: 120mm 200mm; margin: 6mm 5mm; }
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: 'Montserrat', Arial, sans-serif; background: #ffffff; }
    .page { padding: 6mm; background: #ffffff; min-height: 100%; }
    .header { background: #f4f7f5; border:1px solid #d6e2db; border-radius: 14px; padding: 12px 16px; margin-bottom: 14px; }
    .title { color:#111111; font-size: 19pt; font-weight: 800; margin: 0 0 1px; letter-spacing:-0.3px; line-height:1.1; }
    .artist { color:#555555; font-size: 10pt; margin: 0 0 9px; font-weight: 500; }
    .pills { display:flex; flex-wrap:wrap; gap:5px; }
    .pill { display:inline-flex; align-items:baseline; gap:4px; background:#ffffff; border:1px solid #cfdbd4; border-radius:8px; padding:3px 8px; }
    .pill.accent { background:#111111; border-color:#111111; }
    .pl { font-size:7pt; letter-spacing:.5px; font-weight:700; text-transform:uppercase; color:#6a8678; }
    .pill.accent .pl { color:#bfcabf; }
    .pv { font-size:10pt; font-weight:800; color:#111111; }
    .pill.accent .pv { color:#ffffff; }
    /* duas colunas via tabela — respeitado por qualquer motor de impressão,
       inclusive no celular (CSS column é ignorado ao imprimir no mobile). */
    .coltable { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .colcell { width: 48%; vertical-align: top; }
    .colgap { width: 4%; }
    /* seções no estilo ChartBuilder contínuo (sem cards) */
    .section { margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid; }
    .sechead { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
    .badge { width:20px; height:20px; min-width:20px; border-radius:50%; border:1.6px solid #3fae6b; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:8pt; font-family:'Montserrat',Arial,sans-serif; line-height:1; }
    .setitle { font-weight:700; text-transform:uppercase; font-size:10pt; letter-spacing:1px; color:#111111; white-space:nowrap; line-height:20px; }
    .rep { font-size:8pt; font-weight:700; }
    .hline { flex:1; height:1px; min-width:8px; opacity:.55; }
    /* instrução da seção: à direita, menor, levemente apagada, quebra automática */
    .note { font-size:9pt; font-style:italic; color:#000000; opacity:.45; text-align:right; margin:1px 0 5px auto; line-height:1.3; max-width:85%; }
    .secbody { padding: 2px 0 0 1px; }
    .line { display:flex; flex-wrap:wrap; align-items:flex-end; margin-bottom:4px; font-family:'Montserrat',Arial,sans-serif; }
    .col { display:inline-flex; flex-direction:column; justify-content:flex-end; }
    .ch { height:1.35em; line-height:1.35em; color:#000000; font-weight:700; font-size:13pt; white-space:pre; }
    .ly { font-size:13pt; white-space:pre; line-height:1.3; color:#000000; }
    .chordsonly { font-family:'Montserrat',Arial,sans-serif; color:#000000; font-weight:700; font-size:13pt; line-height:1.5; }
    .onecol { width:100%; }
    .ftr { text-align:center; color:#999999; font-size:8pt; margin-top:8px; }
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
/* Título que reduz a fonte automaticamente até caber em UMA linha */
function FitTitle({ text, max = 28, min = 15 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);
  useEffect(() => { setSize(max); }, [text, max]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = max;
    el.style.fontSize = s + "px";
    let guard = 0;
    while (el.scrollWidth > el.clientWidth && s > min && guard < 40) {
      s -= 1; guard += 1; el.style.fontSize = s + "px";
    }
    setSize(s);
  }, [text, max, min]);
  return (
    <h1 ref={ref} style={{ margin: 0, fontWeight: 800, fontSize: size, color: "#fff", letterSpacing: -0.4, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {text}
    </h1>
  );
}

function SongView({ song, canEdit, pref, prefsLoaded, onSavePref, onBack, onEdit, currentSetlist, songs, onNavigateSong }) {
  const capoSuggested = Number(song.capoSuggested) || 0;
  const [semitones, setSemitones] = useState(pref?.semitones || 0);
  // capo inicial = preferência salva do usuário, ou o capo sugerido da música
  const [capo, setCapo] = useState(pref?.capo != null ? pref.capo : capoSuggested);
  const [viewMode, setViewMode] = useState("chords"); // chords | lyrics | bass
  const [fontScale, setFontScale] = useState(0.9);
  const baseKey = song.key || "C";
  // O CONTEÚDO digitado representa as FORMAS tocadas COM o capo sugerido.
  // song.key é o tom REAL (o que soa). som real = formas + capoSuggested.
  // som real (tom que soa) = base + transposição do usuário
  // Determina se a tonalidade resultante usa bemóis ou sustenidos pela convenção musical.
  // Primeiro transpõe com sustenidos para obter a nota canônica, depois consulta KEY_USES_FLATS.
  const _soundingRaw = transposeKey(baseKey, semitones, false);
  const useFlats = keyUsesFlats(_soundingRaw);
  const soundingKey = transposeKey(baseKey, semitones, useFlats);
  // formas exibidas: conteúdo já equivale ao capo sugerido; ajusta a diferença do capo atual
  const shapeShift = semitones + (capoSuggested - capo);
  const _shapeRaw = transposeKey(baseKey, semitones - capo, false);
  const shapeUseFlats = keyUsesFlats(_shapeRaw);
  const shapeKey = transposeKey(baseKey, semitones - capo, shapeUseFlats);
  const { playing, setPlaying, beat } = useMetronome(song.bpm || 120);
  const ytId = useMemo(() => extractYouTubeId(song.youtube), [song.youtube]);
  const [presenting, setPresenting] = useState(false);

  // Navegação no repertório
  const setlistSongs = useMemo(() => {
    if (!currentSetlist || !songs) return [];
    return (currentSetlist.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
  }, [currentSetlist, songs]);
  const currentIdx = setlistSongs.findIndex(s => s.id === song.id);
  const prevSong = currentIdx > 0 ? setlistSongs[currentIdx - 1] : null;
  const nextSong = currentIdx !== -1 && currentIdx < setlistSongs.length - 1 ? setlistSongs[currentIdx + 1] : null;

  // Navegação entre hinos (quando aberto pela aba de Hinos, fora de um repertório)
  const hymnSongs = useMemo(() => {
    if (!songs || song.category !== "Hino") return [];
    return songs.filter(s => s.category === "Hino")
      .sort((a, b) => (parseInt(a.hymnNumber) || 9999) - (parseInt(b.hymnNumber) || 9999));
  }, [songs, song.category]);
  const hymnIdx = hymnSongs.findIndex(s => s.id === song.id);
  const prevHymn = !currentSetlist && hymnIdx > 0 ? hymnSongs[hymnIdx - 1] : null;
  const nextHymn = !currentSetlist && hymnIdx !== -1 && hymnIdx < hymnSongs.length - 1 ? hymnSongs[hymnIdx + 1] : null;
  const isHymnNav = !currentSetlist && song.category === "Hino" && hymnSongs.length > 1;

  // refs de controle (declaradas antes dos effects que as usam)
  const appliedFor = useRef(null);

  // Aplica a preferência salva (tom/capo) da pessoa para esta música.
  // Roda ao trocar de música e também quando o pref chega do banco (assíncrono).
  useEffect(() => {
    if (appliedFor.current === song.id) return;
    setSemitones(pref?.semitones || 0);
    setCapo(pref?.capo != null ? pref.capo : capoSuggested);
    if (prefsLoaded) appliedFor.current = song.id;
  }, [song.id, pref, prefsLoaded]);

  // Salva a preferência quando o tom/capo difere do que está guardado.
  useEffect(() => {
    if (appliedFor.current !== song.id) return;       // ainda não aplicou esta música
    const savedSemi = pref?.semitones || 0;
    const savedCapo = pref?.capo != null ? pref.capo : capoSuggested;
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
        <button onClick={onBack} style={ghostBtn()}><ArrowLeft size={18} /> {currentSetlist ? "Repertório" : "Voltar"}</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportSongPDF(song, soundingKey, shapeShift, shapeUseFlats, capo, shapeKey)} style={ghostBtn()} title="Exportar PDF"><Download size={16} /> PDF</button>
          <button onClick={() => setPresenting(true)} style={ghostBtn()} title="Modo apresentação"><Maximize2 size={16} /> Apresentar</button>
          {canEdit && <button onClick={onEdit} style={ghostBtn()}><Edit3 size={16} /> Editar</button>}
        </div>
      </div>

      {/* Navegação no repertório — topo */}
      {currentSetlist && setlistSongs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, background: "#0c2419", border: "1px solid #15392b", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevSong && onNavigateSong(prevSong)} disabled={!prevSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevSong ? 1 : 0.35, pointerEvents: prevSong ? "auto" : "none" }}>
            <ChevronUp size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#6fae8a", fontWeight: 600 }}>
            {currentSetlist.name} · {currentIdx + 1} / {setlistSongs.length}
          </div>
          <button onClick={() => nextSong && onNavigateSong(nextSong)} disabled={!nextSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextSong ? 1 : 0.35, pointerEvents: nextSong ? "auto" : "none" }}>
            Próxima <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Navegação entre hinos — topo */}
      {isHymnNav && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, background: "#0c2419", border: "1px solid #d4a01733", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevHymn && onNavigateSong(prevHymn)} disabled={!prevHymn}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevHymn ? 1 : 0.35, pointerEvents: prevHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
            <ChevronUp size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#d4a017", fontWeight: 600 }}>
            Hino {song.hymnNumber || "—"}
          </div>
          <button onClick={() => nextHymn && onNavigateSong(nextHymn)} disabled={!nextHymn}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextHymn ? 1 : 0.35, pointerEvents: nextHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
            Próximo <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Cabeçalho compacto — sem card, em linhas */}
      <div style={{ marginBottom: 18 }}>
        {/* Linha 1: título grande, sempre em uma linha (auto-ajuste) */}
        <FitTitle text={song.title} max={28} min={15} />
        {/* Linha 2: autor menor + info */}
        <div style={{ color: "#9fdabb", fontSize: 13, fontWeight: 500, margin: "1px 0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {song.artist || "—"}
          {song.category && <span style={{ color: "#6fae8a" }}> · {song.category === "Hino" && song.hymnNumber ? `Hino nº ${song.hymnNumber}` : categoryLabel(song)}</span>}
          {song.timeSig && <span style={{ color: "#6fae8a" }}> · {song.timeSig}</span>}
        </div>
        {/* Linha 3: Tom + Transpor + Capo na mesma linha */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 9 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "rgba(63,174,107,.14)", border: "1px solid #1d6b46", borderRadius: 8, padding: "4px 9px" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#6fae8a" }}>Tom</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{soundingKey}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#0c2419", border: "1px solid #15392b", borderRadius: 8, padding: "3px 5px" }}>
            <span style={ctrlLabel}>Transpor</span>
            <button onClick={() => setSemitones(s => s - 1)} style={stepBtnSm()}><ChevronDown size={15} /></button>
            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: 12.5, color: semitones === 0 ? "#9fdabb" : "#fff" }}>{semitones > 0 ? "+" : ""}{semitones}</span>
            <button onClick={() => setSemitones(s => s + 1)} style={stepBtnSm()}><ChevronUp size={15} /></button>
            {semitones !== 0 && <button onClick={() => setSemitones(0)} style={{ ...ghostBtn(), padding: "2px 6px", fontSize: 10.5 }}>reset</button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#0c2419", border: "1px solid #15392b", borderRadius: 8, padding: "3px 5px" }}>
            <span style={ctrlLabel}>Capo</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtnSm()}><ChevronDown size={15} /></button>
            <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: 12.5, color: capo === 0 ? "#9fdabb" : "#fff" }}>{capo === 0 ? "—" : capo + "ª"}</span>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtnSm()}><ChevronUp size={15} /></button>
          </div>
        </div>
        {/* Linha 4: Metrônomo em linha única */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setPlaying(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, border: "1px solid #15392b", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 12.5, background: playing ? "#fff" : "#0c2419", color: playing ? "#0d3d28" : "#fff" }}>
            {playing ? <Pause size={15} /> : <Play size={15} />} Metrônomo · {song.bpm || "—"} BPM
          </button>
          {playing && <div style={{ display: "flex", gap: 5 }}>{[1, 2, 3, 4].map(b => <div key={b} style={{ width: 9, height: 9, borderRadius: "50%", background: beat === b ? (b === 1 ? "#e8554d" : "#fff") : "rgba(255,255,255,.2)" }} />)}</div>}
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

      {/* Seções — estilo ChartBuilder: sem caixas, fluindo em sequência */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {(song.sections || []).map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || "#3fae6b";
          return (
            <div key={i} style={{ marginBottom: 28 }}>
              {/* Cabeçalho da seção estilo ChartBuilder */}
              <div style={{ marginBottom: 10 }}>
                {/* linha 1: círculo (sigla) + nome + linha horizontal até a direita */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: 0.3, lineHeight: 1 }}>
                      {sectionAbbr(sec.type, sec.label)}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "#eef5f0", textTransform: "uppercase", letterSpacing: 1.5, whiteSpace: "nowrap", lineHeight: 1 }}>
                    {sec.type}{sec.label && !/^\d+$/.test(sec.label.trim()) ? ` ${sec.label}` : (sec.label ? ` ${sec.label}` : "")}
                  </span>
                  {sec.repeat && <span style={{ fontSize: 12, color, fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>×{sec.repeat}</span>}
                  <span style={{ flex: 1, height: 1, background: `${color}66`, minWidth: 12 }} />
                </div>
                {/* linha 2: instrução à direita, menor, levemente apagada, quebra automática */}
                {sec.note && (
                  <div style={{ fontSize: 11, color: "#eef5f0", opacity: 0.45, fontStyle: "italic", textAlign: "right", marginTop: 4, lineHeight: 1.3 }}>
                    {sec.note}
                  </div>
                )}
              </div>
              {/* Conteúdo da seção — direto no fundo, sem caixa */}
              <div style={{ paddingLeft: 8, fontSize: `${fontScale * 15.5}px` }}>
                <RenderBlock content={sec.content} semitones={viewMode === "bass" ? (semitones + capoSuggested) : shapeShift} useFlats={viewMode === "bass" ? useFlats : shapeUseFlats} mode={viewMode} />
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

      {/* Navegação no repertório — fim da página */}
      {currentSetlist && setlistSongs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 30, background: "#0c2419", border: "1px solid #15392b", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevSong && onNavigateSong(prevSong)} disabled={!prevSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevSong ? 1 : 0.35, pointerEvents: prevSong ? "auto" : "none" }}>
            <ChevronUp size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#6fae8a", fontWeight: 600 }}>
            {currentSetlist.name} · {currentIdx + 1} / {setlistSongs.length}
          </div>
          <button onClick={() => nextSong && onNavigateSong(nextSong)} disabled={!nextSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextSong ? 1 : 0.35, pointerEvents: nextSong ? "auto" : "none" }}>
            Próxima <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Navegação entre hinos — fim da página */}
      {isHymnNav && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 30, background: "#0c2419", border: "1px solid #d4a01733", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevHymn && onNavigateSong(prevHymn)} disabled={!prevHymn}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevHymn ? 1 : 0.35, pointerEvents: prevHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
            <ChevronUp size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#d4a017", fontWeight: 600 }}>
            Hino {song.hymnNumber || "—"}
          </div>
          <button onClick={() => nextHymn && onNavigateSong(nextHymn)} disabled={!nextHymn}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextHymn ? 1 : 0.35, pointerEvents: nextHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
            Próximo <ChevronDown size={16} />
          </button>
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
function SetlistsView({ setlists, songs, canEdit, reopenSetlistId, onClearReopen, onBack, onSave, onDelete, onOpenSong }) {
  const [editing, setEditing] = useState(null); // objeto setlist em edição, ou null
  const [opened, setOpened] = useState(null);   // setlist aberto para uso

  // Ao voltar de uma música aberta a partir de um repertório, reabre esse repertório
  useEffect(() => {
    if (reopenSetlistId && !opened) {
      const sl = setlists.find(s => s.id === reopenSetlistId);
      if (sl) setOpened(sl);
    }
  }, [reopenSetlistId]);

  // ----- abrindo um repertório (lista de músicas em ordem) -----
  if (opened) {
    const songsInOrder = (opened.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 90px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => { setOpened(null); onClearReopen?.(); }} style={ghostBtn()}><ArrowLeft size={18} /> Repertórios</button>
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
            <button key={s.id} onClick={() => onOpenSong(s, opened)} style={cardStyle()}
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

/* ---------- Teoria Musical ---------- */
const tStyles = {
  section: { marginBottom: 18 },
  h3: {
    fontWeight: 700, fontSize: "clamp(13px,3.8vw,15px)", color: "#9fdabb",
    margin: "0 0 8px", letterSpacing: 0.3,
  },
  p: {
    fontSize: "clamp(12px,3.3vw,13.5px)", color: "#b0ccbc", lineHeight: 1.65,
    margin: "0 0 8px",
  },
  tag: (bg, color) => ({
    display: "inline-block", fontSize: "clamp(10px,2.6vw,11px)", fontWeight: 700,
    padding: "2px 8px", borderRadius: 10, background: bg, color, marginRight: 4, marginBottom: 4,
  }),
  table: {
    width: "100%", borderCollapse: "collapse", fontSize: "clamp(11px,3vw,13px)",
    color: "#b0ccbc",
  },
  th: {
    textAlign: "left", padding: "7px 10px", background: "#0a2b1e",
    color: "#6fae8a", fontWeight: 600, fontSize: "clamp(10px,2.6vw,11.5px)",
    borderBottom: "1px solid #1d4435",
  },
  td: { padding: "7px 10px", borderBottom: "1px solid #132e22" },
  highlight: {
    background: "#0a2b1e", border: "1px solid #1d4435", borderRadius: 10,
    padding: "10px 12px", marginBottom: 10,
    fontSize: "clamp(12px,3.2vw,13px)", color: "#9fdabb", lineHeight: 1.6,
  },
  chord: {
    display: "inline-block", background: "rgba(47,157,99,.15)", color: "#3fae6b",
    fontWeight: 700, borderRadius: 6, padding: "1px 7px", marginRight: 4,
    fontFamily: "'Space Mono',monospace", fontSize: "clamp(11px,3vw,13px)",
  },
  note: {
    fontSize: "clamp(11px,2.8vw,12px)", color: "#6fae8a", fontStyle: "italic",
    marginTop: 6, lineHeight: 1.5,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
    gap: 8, marginBottom: 10,
  },
  gridCard: {
    background: "#0a2b1e", border: "1px solid #1d4435", borderRadius: 10,
    padding: "10px 12px",
  },
};

/* ---------- Tópico 1: Intervalos ---------- */
function TopicIntervalos() {
  const rows = [
    ["Uníssono",   "0",  "P1",  "Mesma nota"],
    ["2ª menor",   "1",  "m2",  "Tensão máxima (mi→fá)"],
    ["2ª maior",   "2",  "M2",  "Tom de escala (dó→ré)"],
    ["3ª menor",   "3",  "m3",  "Caráter menor (triste)"],
    ["3ª maior",   "4",  "M3",  "Caráter maior (alegre)"],
    ["4ª justa",   "5",  "P4",  "Estável e aberto"],
    ["Trítono",    "6",  "TT",  "Máxima dissonância"],
    ["5ª justa",   "7",  "P5",  "O mais estável de todos"],
    ["6ª menor",   "8",  "m6",  "Melancólico"],
    ["6ª maior",   "9",  "M6",  "Doce, aberto"],
    ["7ª menor",   "10", "m7",  "Tensão suave (jazz)"],
    ["7ª maior",   "11", "M7",  "Tensão aguda, sofisticado"],
    ["Oitava",     "12", "P8",  "Mesma nota, oitava acima"],
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Um <strong style={{ color: "#fff" }}>intervalo</strong> é a distância entre duas notas, medida em semitons.
        Todo acorde e escala é construído combinando intervalos.
      </p>
      <div style={{ overflowX: "auto", borderRadius: 10, marginBottom: 10 }}>
        <table style={tStyles.table}>
          <thead>
            <tr>
              <th style={tStyles.th}>Intervalo</th>
              <th style={tStyles.th}>Semi</th>
              <th style={tStyles.th}>Sigla</th>
              <th style={tStyles.th}>Caráter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, semi, sig, desc]) => (
              <tr key={sig}>
                <td style={tStyles.td}><strong style={{ color: "#eef5f0" }}>{name}</strong></td>
                <td style={{ ...tStyles.td, color: "#3fae6b", fontWeight: 700 }}>{semi}</td>
                <td style={{ ...tStyles.td, fontFamily: "'Space Mono',monospace", color: "#9fdabb" }}>{sig}</td>
                <td style={tStyles.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={tStyles.highlight}>
        <strong>Dica prática:</strong> a distância de <em>Dó a Sol</em> é uma 5ª justa (7 semitons) —
        o intervalo mais estável depois da oitava. Qualquer quinta tocada juntas soa poderosa!
      </div>
    </div>
  );
}

/* ---------- Tópico 2: Escalas ---------- */
function TopicEscalas() {
  const scales = [
    { name: "Maior (jônica)", formula: "T T S T T T S", ex: "Dó Ré Mi Fá Sol Lá Si", char: "Alegre, estável" },
    { name: "Menor natural", formula: "T S T T S T T", ex: "Lá Si Dó Ré Mi Fá Sol", char: "Melancólica, introspectiva" },
    { name: "Menor harmônica", formula: "T S T T S T½ S", ex: "Lá Si Dó Ré Mi Fá Sol#", char: "Dramática, árabe/clássica" },
    { name: "Pentatônica maior", formula: "T T T½ T T½", ex: "Dó Ré Mi Sol Lá", char: "Pop, folk, universalmente agradável" },
    { name: "Pentatônica menor", formula: "T½ T T T½ T", ex: "Lá Dó Ré Mi Sol", char: "Rock, blues, solos de guitarra" },
    { name: "Blues", formula: "Pent. min + 5", ex: "Lá Dó Ré Mib Mi Sol", char: "Expressiva, tensão e resolução" },
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Uma <strong style={{ color: "#fff" }}>escala</strong> é uma sequência de notas com intervalos fixos que
        definem o caráter (alegre, triste, tenso) de uma música.
      </p>
      <p style={tStyles.p}>
        <strong style={{ color: "#9fdabb" }}>T</strong> = tom (2 semitons) · <strong style={{ color: "#9fdabb" }}>S</strong> = semitom (1 semitom) · <strong style={{ color: "#9fdabb" }}>T½</strong> = tom e meio (3 semitons)
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scales.map(s => (
          <div key={s.name} style={tStyles.gridCard}>
            <div style={{ fontWeight: 700, fontSize: "clamp(12px,3.3vw,14px)", color: "#fff", marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "clamp(10px,2.6vw,11.5px)", color: "#3fae6b", marginBottom: 3 }}>{s.formula}</div>
            <div style={{ fontSize: "clamp(11px,3vw,12.5px)", color: "#9fdabb", marginBottom: 2 }}>{s.ex}</div>
            <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#6fae8a", fontStyle: "italic" }}>{s.char}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Tópico 3: Acordes ---------- */
function TopicAcordes() {
  const chords = [
    { symbol: "C",      name: "Maior",       semis: "1 – 3 – 5",       ex: "Dó Mi Sol",             char: "Estável, brilhante" },
    { symbol: "Cm",     name: "Menor",       semis: "1 – 3 – 5",      ex: "Dó Mib Sol",            char: "Expressivo, sombrio" },
    { symbol: "C7",     name: "Dom. 7",      semis: "1 – 3 – 5 – 7",  ex: "Dó Mi Sol Sib",         char: "Quer resolver — tensão" },
    { symbol: "Cmaj7",  name: "Maior 7",     semis: "1 – 3 – 5 – 7",   ex: "Dó Mi Sol Si",          char: "Suave, sofisticado (jazz)" },
    { symbol: "Cm7",    name: "Menor 7",     semis: "1 – 3 – 5 – 7", ex: "Dó Mib Sol Sib",        char: "Flutuante, jazz" },
    { symbol: "Cdim",   name: "Diminuto",    semis: "1 – 3 – 5",     ex: "Dó Mib Solb",           char: "Máxima tensão" },
    { symbol: "Caug",   name: "Aumentado",   semis: "1 – 3 – #5",      ex: "Dó Mi Sol#",            char: "Suspenso, misterioso" },
    { symbol: "Csus4",  name: "Sus4",        semis: "1 – 4 – 5",       ex: "Dó Fá Sol",             char: "Ambíguo, quer resolver" },
    { symbol: "Cadd9",  name: "Add9",        semis: "1 – 3 – 5 – 9",   ex: "Dó Mi Sol Ré",          char: "Aberto, pop moderno" },
    { symbol: "C/E",    name: "Inversão",    semis: "baixo = Mi",       ex: "Mi no baixo",           char: "Voice leading suave" },
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Um <strong style={{ color: "#fff" }}>acorde</strong> é a combinação de 3 ou mais notas tocadas simultaneamente.
        A fórmula determina quais intervalos compõem o acorde.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {chords.map(c => (
          <div key={c.symbol} style={{ ...tStyles.gridCard, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ ...tStyles.chord, flexShrink: 0, marginTop: 2 }}>{c.symbol}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: "clamp(12px,3.2vw,13.5px)", color: "#eef5f0" }}>{c.name}</span>
              <span style={{ fontSize: "clamp(10px,2.6vw,11px)", color: "#6fae8a", marginLeft: 6 }}>{c.semis}</span>
              <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#9fdabb", marginTop: 2 }}>{c.ex}</div>
              <div style={{ fontSize: "clamp(10px,2.6vw,11px)", color: "#6fae8a", fontStyle: "italic", marginTop: 1 }}>{c.char}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Tópico 4: Funções Harmônicas ---------- */
function TopicFuncoes() {
  const funcs = [
    { grau: "I",   nome: "Tônica",        cor: "#7F77DD", bg: "#1a1560", desc: "Centro tonal — sensação de repouso, chegada, 'em casa'. Graus: I, III, VI.", ex: "C em Dó maior" },
    { grau: "V",   nome: "Dominante",     cor: "#D85A30", bg: "#3d1208", desc: "Máxima tensão — o tritono interno 'puxa' de volta à tônica. Graus: V, VII.", ex: "G7 em Dó maior" },
    { grau: "IV",  nome: "Subdominante",  cor: "#1D9E75", bg: "#093d2e", desc: "Movimento — entre tônica e dominante, dá direção sem tensão extrema. Graus: II, IV.", ex: "F em Dó maior" },
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Cada acorde dentro de uma tonalidade cumpre uma <strong style={{ color: "#fff" }}>função</strong> que
        determina como o ouvinte o percebe — descanso, tensão ou movimento.
      </p>
      {funcs.map(f => (
        <div key={f.grau} style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          background: f.bg, border: `1px solid ${f.cor}44`,
          borderLeft: `4px solid ${f.cor}`,
          borderRadius: 10, padding: "12px 14px", marginBottom: 10,
        }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: f.cor, flexShrink: 0, lineHeight: 1 }}>{f.grau}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "clamp(13px,3.5vw,15px)", color: f.cor, marginBottom: 3 }}>{f.nome}</div>
            <div style={{ fontSize: "clamp(11px,3vw,13px)", color: "#b0ccbc", lineHeight: 1.55, marginBottom: 3 }}>{f.desc}</div>
            <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: f.cor, fontStyle: "italic", opacity: 0.85 }}>Ex: {f.ex}</div>
          </div>
        </div>
      ))}
      <div style={tStyles.highlight}>
         <strong>Ciclo básico:</strong> Tônica → Subdominante → Dominante → Tônica
        <br />É o motor de 90% das músicas ocidentais!
      </div>
    </div>
  );
}

/* ---------- Tópico 5: Campo Harmônico ---------- */
function TopicCampo() {
  const graus = [
    { n: "I",   tipo: "Maior 7",  func: "Tônica",       cor: "#7F77DD" },
    { n: "II",  tipo: "Menor 7",  func: "Subdominante", cor: "#1D9E75" },
    { n: "III", tipo: "Menor 7",  func: "Tônica",       cor: "#7F77DD" },
    { n: "IV",  tipo: "Maior 7",  func: "Subdominante", cor: "#1D9E75" },
    { n: "V",   tipo: "Dom. 7",   func: "Dominante",    cor: "#D85A30" },
    { n: "VI",  tipo: "Menor 7",  func: "Tônica",       cor: "#7F77DD" },
    { n: "VII", tipo: "m75",     func: "Dominante",    cor: "#D85A30" },
  ];
  const notasCDo = ["C", "Dm", "Em", "F", "G7", "Am", "Bdim"];
  return (
    <div>
      <p style={tStyles.p}>
        O <strong style={{ color: "#fff" }}>campo harmônico</strong> é o conjunto de acordes que pertencem a uma tonalidade.
        Em Dó maior, os 7 acordes são:
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {graus.map((g, i) => (
          <div key={g.n} style={{
            flex: "1 1 calc(14% - 6px)", minWidth: 60,
            background: g.cor + "18", border: `1px solid ${g.cor}55`,
            borderRadius: 10, padding: "8px 6px", textAlign: "center",
          }}>
            <div style={{ fontSize: "clamp(9px,2.5vw,10px)", fontWeight: 700, color: g.cor, marginBottom: 2 }}>{g.n}</div>
            <div style={{ fontSize: "clamp(12px,3.5vw,14px)", fontWeight: 700, color: "#fff" }}>{notasCDo[i]}</div>
            <div style={{ fontSize: "clamp(8px,2.2vw,9.5px)", color: g.cor, marginTop: 2 }}>{g.tipo}</div>
          </div>
        ))}
      </div>
      <div style={tStyles.highlight}>
         <strong>Regra:</strong> qualquer sequência usando apenas esses acordes soará "dentro" da tonalidade.
        Sair do campo cria tensão ou cor especial.
      </div>
      <p style={{ ...tStyles.note, marginTop: 0 }}>
        No módulo <em>Harmonia Musical Completa</em> (botão acima) você pode explorar o campo harmônico
        interativo com transposição em tempo real.
      </p>
    </div>
  );
}

/* ---------- Tópico 6: Progressões ---------- */
function TopicProgressoes() {
  const progs = [
    { label: "I – V – VI – IV",    ex: "C G Am F",         musics: '"Let It Be", "No Woman No Cry"' },
    { label: "I – IV – V",         ex: "C F G",            musics: '"La Bamba", blues de 12 compassos' },
    { label: "II – V – I",         ex: "Dm7 G7 Cmaj7",     musics: 'Jazz, bossa nova, "Garota de Ipanema"' },
    { label: "I – VI – IV – V",    ex: "C Am F G",         musics: '"Stand By Me", anos 50-60' },
    { label: "VI – IV – I – V",    ex: "Am F C G",         musics: '"Pompeii", "Numb", rock alternativo' },
    { label: "I – bVII – IV",      ex: "C Bb F",           musics: '"Sweet Home Alabama"' },
    { label: "IV – I (plagal)",    ex: "F C",              musics: 'Hinos, gospel, "Hey Jude" (final)' },
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Uma <strong style={{ color: "#fff" }}>progressão</strong> é uma sequência de acordes que se repete
        e forma a base harmônica de uma música.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {progs.map(p => (
          <div key={p.label} style={tStyles.gridCard}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: "clamp(12px,3.3vw,14px)", color: "#fff" }}>{p.label}</span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "clamp(10px,2.6vw,12px)", color: "#3fae6b" }}>({p.ex})</span>
            </div>
            <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#6fae8a", fontStyle: "italic" }}>{p.musics}</div>
          </div>
        ))}
      </div>
      <div style={{ ...tStyles.highlight, marginTop: 10 }}>
         Use o módulo <em>Harmonia Completa</em> para ver essas progressões transpostas para qualquer tom!
      </div>
    </div>
  );
}

/* ---------- Tópico 7: Transposição e Capo ---------- */
function TopicTransposicao() {
  return (
    <div>
      <p style={tStyles.p}>
        <strong style={{ color: "#fff" }}>Transpor</strong> significa mover todos os acordes de uma música
        para cima ou para baixo, mantendo as mesmas relações entre eles.
      </p>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Por que transpor?</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            { icon: "", text: "Adaptar ao alcance vocal do cantor" },
            { icon: "", text: "Facilitar as posições no instrumento" },
            { icon: "", text: "Usar capo e tocar cifras abertas" },
            { icon: "", text: "Combinar com outras músicas no set" },
          ].map(item => (
            <div key={item.text} style={{ display: "flex", gap: 10, alignItems: "center", ...tStyles.gridCard, padding: "8px 12px" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: "clamp(12px,3.2vw,13.5px)", color: "#b0ccbc" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Capo (cejilha)</h3>
        <p style={tStyles.p}>
          O capo é colocado no braço do violão/guitarra para <strong style={{ color: "#fff" }}>elevar o tom</strong> sem
          mudar as posições dos acordes.
        </p>
        <div style={{ overflowX: "auto", borderRadius: 10 }}>
          <table style={tStyles.table}>
            <thead>
              <tr>
                <th style={tStyles.th}>Capo na casa</th>
                <th style={tStyles.th}>Tom sobe</th>
                <th style={tStyles.th}>Ex: C vira</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1ª", "1 semitom", "C#/Db"],
                ["2ª", "1 tom", "D"],
                ["3ª", "1 tom e meio", "D#/Eb"],
                ["4ª", "2 tons", "E"],
                ["5ª", "2 tons e meio", "F"],
              ].map(([casa, sobe, vira]) => (
                <tr key={casa}>
                  <td style={{ ...tStyles.td, fontWeight: 600, color: "#9fdabb" }}>{casa}</td>
                  <td style={tStyles.td}>{sobe}</td>
                  <td style={{ ...tStyles.td, ...tStyles.chord, display: "table-cell", fontFamily: "'Space Mono',monospace" }}>{vira}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={tStyles.highlight}>
         No IPBCharts, use os controles <strong>Tom ↑↓</strong> e <strong>Capo ↑↓</strong> na visualização de cada cifra para ajustar em tempo real!
      </div>
    </div>
  );
}

/* ---------- Tópico 8: Como ler uma cifra ---------- */
function TopicCifra() {
  return (
    <div>
      <p style={tStyles.p}>
        Uma cifra mostra os <strong style={{ color: "#fff" }}>acordes</strong> posicionados acima da letra,
        indicando onde cada acorde começa.
      </p>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Exemplo visual</h3>
        <div style={{
          background: "#061812", border: "1px solid #1d4435", borderRadius: 10,
          padding: "12px 14px", fontFamily: "'Space Mono',monospace",
          fontSize: "clamp(11px,3vw,13px)", lineHeight: 2, overflowX: "auto",
        }}>
          <div style={{ color: "#3fae6b" }}>G{"       "}Em{"      "}C{"       "}D</div>
          <div style={{ color: "#eef5f0" }}>Quando o sol se pôr no mar</div>
        </div>
        <p style={tStyles.note}>
          O acorde <span style={tStyles.chord}>G</span> toca em "Quando", <span style={tStyles.chord}>Em</span> em "sol",
          <span style={tStyles.chord}>C</span> em "pôr", <span style={tStyles.chord}>D</span> em "mar".
        </p>
      </div>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Notações comuns</h3>
        <div style={tStyles.grid2}>
          {[
            { s: "m", d: "Menor (ex: Am)" },
            { s: "7", d: "Sétima dominante" },
            { s: "maj7", d: "Sétima maior" },
            { s: "dim", d: "Diminuto" },
            { s: "sus2/4", d: "Suspenso" },
            { s: "/baixo", d: "Ex: G/B = baixo Si" },
            { s: "#", d: "Sustenido (meio tom ↑)" },
            { s: "b", d: "Bemol (meio tom ↓)" },
          ].map(n => (
            <div key={n.s} style={tStyles.gridCard}>
              <div style={{ ...tStyles.chord, marginRight: 0 }}>{n.s}</div>
              <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#8ab0a0", marginTop: 4 }}>{n.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Seções da cifra</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { tipo: "Intro", cor: "#e0b341", desc: "Introdução instrumental" },
            { tipo: "Verso", cor: "#4f9dde", desc: "Estrofes da letra" },
            { tipo: "Refrão", cor: "#e8554d", desc: "Parte principal repetida" },
            { tipo: "Ponte", cor: "#34c98a", desc: "Trecho de transição" },
            { tipo: "Rampa", cor: "#ec6aa8", desc: "Modulação gradual" },
          ].map(s => (
            <div key={s.tipo} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.cor, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: s.cor, fontSize: "clamp(11px,3vw,12.5px)", flexShrink: 0, minWidth: 60 }}>{s.tipo}</span>
              <span style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#8ab0a0" }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Tópico 9: Ritmo e Compasso ---------- */
function TopicRitmo() {
  return (
    <div>
      <p style={tStyles.p}>
        O <strong style={{ color: "#fff" }}>ritmo</strong> organiza o tempo musical. O <strong style={{ color: "#fff" }}>compasso</strong> agrupa
        os tempos em unidades regulares.
      </p>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>Compassos mais comuns</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            { sig: "4/4", nome: "Quaternário", desc: "4 tempos por compasso · o mais comum no pop, rock, gospel", ex: "1 — 2 — 3 — 4" },
            { sig: "3/4", nome: "Ternário (valsa)", desc: "3 tempos · dança, hinos clássicos, baladas", ex: "1 — 2 — 3" },
            { sig: "6/8", nome: "Composto", desc: "6 colcheias · sensação de dois grupos de 3 · rock, balada", ex: "1·· 2··" },
            { sig: "2/4", nome: "Binário", desc: "Marchas, sambas, música rápida", ex: "1 — 2" },
          ].map(c => (
            <div key={c.sig} style={{ ...tStyles.gridCard, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#3fae6b", fontSize: "clamp(16px,4.5vw,20px)", flexShrink: 0, lineHeight: 1 }}>{c.sig}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "clamp(12px,3.3vw,13.5px)", color: "#fff", marginBottom: 2 }}>{c.nome}</div>
                <div style={{ fontSize: "clamp(11px,3vw,12.5px)", color: "#8ab0a0", marginBottom: 2 }}>{c.desc}</div>
                <div style={{ fontSize: "clamp(14px,4vw,16px)" }}>{c.ex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={tStyles.section}>
        <h3 style={tStyles.h3}>BPM — Batidas por Minuto</h3>
        <div style={tStyles.grid2}>
          {[
            ["< 60", "Muito lento (largo)"],
            ["60–80", "Lento (andante)"],
            ["80–100", "Moderado"],
            ["100–120", "Animado (allegro)"],
            ["120–160", "Rápido"],
            ["> 160", "Muito rápido (presto)"],
          ].map(([bpm, desc]) => (
            <div key={bpm} style={tStyles.gridCard}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "clamp(12px,3.2vw,13px)", color: "#9fdabb", fontWeight: 700 }}>{bpm} BPM</div>
              <div style={{ fontSize: "clamp(10px,2.6vw,11.5px)", color: "#6fae8a", marginTop: 3 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Tópico 10: Modos Gregos ---------- */
function TopicModos() {
  const modos = [
    { nome: "Jônico",    grau: "I",   ex: "C D E F G A B",       char: "= Escala maior · alegre, estável" },
    { nome: "Dórico",    grau: "II",  ex: "D E F G A B C",       char: "Menor com 6ª maior · jazz, funk, 'Oye Como Va'" },
    { nome: "Frígio",    grau: "III", ex: "E F G A B C D",       char: "Menor com 2ª menor · flamenco, metal" },
    { nome: "Lídio",     grau: "IV",  ex: "F G A B C D E",       char: "Maior com #4 · cinematográfico, mágico" },
    { nome: "Mixolídio", grau: "V",   ex: "G A B C D E F",       char: "Maior com 7 · rock, blues, 'Sweet Home'" },
    { nome: "Eólio",     grau: "VI",  ex: "A B C D E F G",       char: "= Menor natural · melancólico, expressivo" },
    { nome: "Lócrio",    grau: "VII", ex: "B C D E F G A",       char: "Menor com 2 e 5 · muito tenso, raro" },
  ];
  return (
    <div>
      <p style={tStyles.p}>
        Os <strong style={{ color: "#fff" }}>modos gregos</strong> são 7 escalas obtidas começando a escala maior
        em cada um dos seus 7 graus. Cada modo tem um caráter próprio.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {modos.map(m => (
          <div key={m.nome} style={{ ...tStyles.gridCard, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 36 }}>
              <div style={{ fontWeight: 900, fontSize: "clamp(9px,2.4vw,10px)", color: "#9b6ef0", letterSpacing: 0.5 }}>{m.grau}</div>
              <div style={{ fontWeight: 700, fontSize: "clamp(11px,3vw,13px)", color: "#c4a6ff" }}>{m.nome}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "clamp(9.5px,2.6vw,11px)", color: "#3fae6b", marginBottom: 3, wordBreak: "break-all" }}>{m.ex}</div>
              <div style={{ fontSize: "clamp(10px,2.7vw,11.5px)", color: "#8ab0a0", fontStyle: "italic" }}>{m.char}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...tStyles.highlight, marginTop: 10 }}>
        <strong>Dica:</strong> no louvor gospel e CCB, o modo <em>Mixolídio</em> é muito frequente —
        aquela sensação de maior "mais aberta" sem resolver completamente.
      </div>
    </div>
  );
}

/* ============================================================
   MÓDULO: Harmonia Musical Completa (adaptado do HTML externo)
   Toda a lógica JS foi reescrita em React puro.
   Otimizado para mobile.
   ============================================================ */

/* ============================================================
   TEORIA MUSICAL — acordeão de tópicos + Harmonia integrada
   ============================================================ */

// ── HARMONIA MUSICAL COMPLETA — React puro, sem iframe ──────────────────────
// Avaliação crítica aplicada:
//   REMOVIDO:  HTML+JS embutido (iframe frágil, piano duplicado, conflito de IDs)
//   REMOVIDO:  Seção "Cifra de acordes" estática (ignorava o tom global)
//   REMOVIDO:  Piano duplicado na seção Conceitos Avançados
//   REMOVIDO:  Ícones ☀☽↑~ nas escalas (sem significado visual)
//   MELHORADO: Piano como componente React reutilizável, único e correto
//   MELHORADO: Cifra transposta ao tom global (usa as notas reais)
//   MELHORADO: Escalas com notas reais exibidas conforme o tom escolhido
//   MELHORADO: Campo harmônico com nome correto dos acordes por tonalidade
//   MELHORADO: Layout mobile fluido sem iframe/polling

const H_NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const H_NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const H_PREFER_FLAT = new Set([1,3,6,8,10]); // Db Eb Gb Ab Bb
const H_NOTE_PT_S   = ['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'];
const H_NOTE_PT_F   = ['Dó','Réb','Ré','Mib','Mi','Fá','Solb','Sol','Láb','Lá','Sib','Si'];

function hNotePT(idx) {
  const i = ((idx % 12) + 12) % 12;
  return H_PREFER_FLAT.has(i) ? H_NOTE_PT_F[i] : H_NOTE_PT_S[i];
}
function hNoteEN(idx) {
  const i = ((idx % 12) + 12) % 12;
  return H_PREFER_FLAT.has(i) ? H_NOTES_FLAT[i] : H_NOTES_SHARP[i];
}
function hScale(root, intervals) {
  return intervals.map(n => hNotePT((root + n + 12) % 12));
}

// Piano interativo como componente React
function MiniPiano({ root, highlight = [], size = "md" }) {
  const W = size === "sm" ? 22 : 28;
  const BW = size === "sm" ? 14 : 18;
  const H = size === "sm" ? 60 : 76;
  const BH = size === "sm" ? 36 : 46;
  const whites = [0,2,4,5,7,9,11]; // semitons das teclas brancas (relativo)
  const blacks = [{s:1,p:1},{s:3,p:2},{s:6,p:4},{s:8,p:5},{s:10,p:6}];
  return (
    <div style={{ position:"relative", display:"inline-flex", height: H+4, userSelect:"none" }}>
      {whites.map((rel, i) => {
        const note = (root + rel) % 12;
        const lit = highlight.includes(rel);
        return (
          <div key={i} style={{
            width: W, height: H,
            background: lit ? "#7F77DD" : "#0a1f17",
            border: "1px solid #1d4435",
            borderRadius: "0 0 4px 4px",
            display: "inline-flex", alignItems: "flex-end",
            justifyContent: "center", paddingBottom: 3,
            position: "relative", marginRight: 1,
          }}>
            <span style={{ fontSize: 7.5, color: lit ? "#fff" : "#6fae8a", fontWeight: 600 }}>
              {hNotePT(note)}
            </span>
          </div>
        );
      })}
      {blacks.map(({s, p}) => {
        const note = (root + s) % 12;
        const lit = highlight.includes(s);
        return (
          <div key={s} style={{
            width: BW, height: BH,
            background: lit ? "#534AB7" : "#eef5f0",
            borderRadius: "0 0 3px 3px",
            position: "absolute", top: 0, zIndex: 2,
            left: p * (W + 1) - BW/2,
          }} />
        );
      })}
    </div>
  );
}

// Seletor de tom global
function KeySelector({ root, setRoot }) {
  const keys = [
    {i:0,l:'Dó'},{i:1,l:'Réb'},{i:2,l:'Ré'},{i:3,l:'Mib'},{i:4,l:'Mi'},
    {i:5,l:'Fá'},{i:6,l:'Solb'},{i:7,l:'Sol'},{i:8,l:'Láb'},{i:9,l:'Lá'},
    {i:10,l:'Sib'},{i:11,l:'Si'},
  ];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:"12px 14px",
      background:"#091f14", borderRadius:12, marginBottom:18 }}>
      <span style={{ fontSize:11, fontWeight:600, color:"#6fae8a", textTransform:"uppercase",
        letterSpacing:".07em", alignSelf:"center", marginRight:4 }}>Tom:</span>
      {keys.map(k => (
        <button key={k.i} onClick={() => setRoot(k.i)}
          style={{
            fontSize:12.5, padding:"4px 11px", borderRadius:20, cursor:"pointer",
            fontFamily:"'Montserrat',sans-serif", fontWeight: root===k.i ? 700 : 400,
            background: root===k.i ? "#7F77DD" : "transparent",
            color: root===k.i ? "#fff" : "#9fdabb",
            border: root===k.i ? "1px solid #534AB7" : "1px solid #1d4435",
            transition: "all .12s",
          }}>
          {k.l}
        </button>
      ))}
    </div>
  );
}

// Seção 1: Intervalos
function HSecIntervalos({ root }) {
  const [sel, setSel] = React.useState(null);
  const ivs = [
    {s:0, q:"P1", n:"Uníssono",   c:"Nota repetida"},
    {s:1, q:"m2", n:"2ª menor",   c:"Máxima tensão cromática"},
    {s:2, q:"M2", n:"2ª maior",   c:"Tom de escala"},
    {s:3, q:"m3", n:"3ª menor",   c:"Caráter menor (expressivo)"},
    {s:4, q:"M3", n:"3ª maior",   c:"Caráter maior (brilhante)"},
    {s:5, q:"P4", n:"4ª justa",   c:"Estável e aberto"},
    {s:6, q:"TT", n:"Trítono",    c:"Máxima dissonância"},
    {s:7, q:"P5", n:"5ª justa",   c:"O mais estável depois da 8ª"},
    {s:8, q:"m6", n:"6ª menor",   c:"Melancólico"},
    {s:9, q:"M6", n:"6ª maior",   c:"Doce e aberto"},
    {s:10,q:"m7", n:"7ª menor",   c:"Tensão suave (jazz)"},
    {s:11,q:"M7", n:"7ª maior",   c:"Tensão aguda, sofisticado"},
    {s:12,q:"P8", n:"Oitava",     c:"Mesma nota, oitava acima"},
  ];
  return (
    <div>
      <p style={hS.p}>A <strong style={{color:"#fff"}}>distância entre duas notas</strong> medida em semitons.
        Todo acorde e escala é construído combinando intervalos.</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
        {ivs.map(iv => (
          <button key={iv.q} onClick={() => setSel(sel?.q===iv.q ? null : iv)}
            style={{ fontSize:12, padding:"4px 10px", borderRadius:8, cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif", fontWeight:600,
              background: sel?.q===iv.q ? "#7F77DD" : "transparent",
              color: sel?.q===iv.q ? "#fff" : "#9fdabb",
              border: sel?.q===iv.q ? "1px solid #534AB7" : "1px solid #1d4435" }}>
            {iv.q}
          </button>
        ))}
      </div>
      {sel && (
        <div style={{ ...hS.card, marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#fff", marginBottom:4 }}>
            {sel.q} — {sel.n} <span style={{color:"#6fae8a",fontWeight:400,fontSize:12}}>({sel.s} {sel.s===1?"semitom":"semitons"})</span>
          </div>
          <div style={{ color:"#9fdabb", fontSize:13, marginBottom:10 }}>{sel.c}</div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <MiniPiano root={root} highlight={[0, Math.min(sel.s,11)].filter((v,i,a)=>a.indexOf(v)===i)} />
            <div style={{ fontSize:13, color:"#eef5f0" }}>
              <span style={{color:"#7F77DD",fontWeight:700}}>{hNotePT(root)}</span>
              {" → "}
              <span style={{color:"#7F77DD",fontWeight:700}}>{hNotePT(root+sel.s)}</span>
            </div>
          </div>
        </div>
      )}
      {!sel && <p style={{...hS.note}}>Selecione um intervalo acima para ver no piano.</p>}
      <div style={{ overflowX:"auto" }}>
        <table style={hS.table}>
          <thead>
            <tr>
              <th style={hS.th}>Sigla</th><th style={hS.th}>Nome</th>
              <th style={hS.th}>Semi</th><th style={hS.th}>Caráter</th>
            </tr>
          </thead>
          <tbody>
            {ivs.map(iv => (
              <tr key={iv.q} onClick={() => setSel(iv)} style={{ cursor:"pointer" }}>
                <td style={{...hS.td, fontFamily:"monospace", color:"#9fdabb", fontWeight:700}}>{iv.q}</td>
                <td style={{...hS.td, color:"#eef5f0"}}>{iv.n}</td>
                <td style={{...hS.td, color:"#3fae6b", fontWeight:700}}>{iv.s}</td>
                <td style={hS.td}>{iv.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Seção 2: Escalas
function HSecEscalas({ root }) {
  const [sel, setSel] = React.useState("major");
  const escalas = [
    { id:"major",    label:"Maior",            tag:"Maior",   tagC:"#3C3489", tagBg:"#EEEDFE",
      ivs:[0,2,4,5,7,9,11], formula:"T T S T T T S",
      desc:"Som alegre, estável, conclusivo — base da tonalidade ocidental.",
      ex:"\"Parabéns\", \"Let It Be\", hinos diatônicos" },
    { id:"nat_min",  label:"Menor natural",    tag:"Menor",   tagC:"#712B13", tagBg:"#FAECE7",
      ivs:[0,2,3,5,7,8,10], formula:"T S T T S T T",
      desc:"Som melancólico, introspectivo. Par relativo da escala maior.",
      ex:"\"Summertime\", \"Nothing Else Matters\"" },
    { id:"harm_min", label:"Menor harmônica",  tag:"Menor",   tagC:"#712B13", tagBg:"#FAECE7",
      ivs:[0,2,3,5,7,8,11], formula:"T S T T S T½ S",
      desc:"7º grau elevado — cria tensão dramática, som árabe/clássico.",
      ex:"Música clássica, metal, flamenco" },
    { id:"mel_min",  label:"Menor melódica",   tag:"Menor",   tagC:"#712B13", tagBg:"#FAECE7",
      ivs:[0,2,3,5,7,9,11], formula:"T S T T T T S",
      desc:"6º e 7º elevados na subida — suaviza o salto da harmônica.",
      ex:"Jazz, música clássica, solos" },
    { id:"pent_maj", label:"Pentatônica maior", tag:"5 notas", tagC:"#085041", tagBg:"#E1F5EE",
      ivs:[0,2,4,7,9], formula:"T T T½ T T½",
      desc:"5 notas sem meios-tons — universalmente agradável.",
      ex:"Pop, folk, blues, rock, música asiática" },
    { id:"pent_min", label:"Pentatônica menor", tag:"5 notas", tagC:"#085041", tagBg:"#E1F5EE",
      ivs:[0,3,5,7,10], formula:"T½ T T T½ T",
      desc:"A mais usada para solos de guitarra de todos os tempos.",
      ex:"Blues, rock, jazz, samba" },
    { id:"blues",    label:"Blues",             tag:"Blues",   tagC:"#633806", tagBg:"#FAEEDA",
      ivs:[0,3,5,6,7,10], formula:"Pentatônica menor + ♭5",
      desc:"A nota azul (trítono) dá o caráter tenso e expressivo do blues.",
      ex:"Blues, jazz, rock'n'roll" },
  ];
  const sc = escalas.find(e=>e.id===sel);
  const notes = hScale(root, sc.ivs);
  return (
    <div>
      <p style={hS.p}>Sequências de notas com caráter próprio. Selecione uma escala para ver as notas no tom atual.</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
        {escalas.map(e => (
          <button key={e.id} onClick={() => setSel(e.id)}
            style={{ fontSize:12, padding:"4px 11px", borderRadius:8, cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif", fontWeight: sel===e.id ? 700 : 400,
              background: sel===e.id ? "#7F77DD" : "transparent",
              color: sel===e.id ? "#fff" : "#9fdabb",
              border: sel===e.id ? "1px solid #534AB7" : "1px solid #1d4435" }}>
            {e.label}
          </button>
        ))}
      </div>
      <div style={hS.card}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <span style={{ fontWeight:700, fontSize:15, color:"#fff" }}>{hNotePT(root)} {sc.label}</span>
          <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
            background:sc.tagBg+"33", color:sc.tagC, border:`1px solid ${sc.tagC}44` }}>{sc.tag}</span>
          <span style={{ fontSize:11, color:"#6fae8a", fontFamily:"monospace" }}>{sc.formula}</span>
        </div>
        <div style={{ fontFamily:"monospace", fontSize:14, color:"#3fae6b", fontWeight:700,
          marginBottom:8, letterSpacing:1 }}>
          {notes.join("  ")}
        </div>
        <MiniPiano root={root} highlight={sc.ivs} size="sm" />
        <p style={{ ...hS.p, marginTop:10, marginBottom:4 }}>{sc.desc}</p>
        <p style={{ ...hS.note, margin:0 }}>Ex: {sc.ex}</p>
      </div>
    </div>
  );
}

// Seção 3: Acordes
function HSecAcordes({ root }) {
  const [sel, setSel] = React.useState(null);
  const acordes = [
    { id:"maj",  label:"Maior",       s:[0,4,7],    formula:"1–3–5",       desc:"Estável, brilhante — a base da tonalidade maior" },
    { id:"min",  label:"Menor",       s:[0,3,7],    formula:"1–♭3–5",      desc:"Expressivo, melancólico — base da tonalidade menor" },
    { id:"dim",  label:"Diminuto",    s:[0,3,6],    formula:"1–♭3–♭5",     desc:"Máxima tensão — todos os intervalos iguais (3 semitons)" },
    { id:"aug",  label:"Aumentado",   s:[0,4,8],    formula:"1–3–#5",      desc:"Suspenso, misterioso — comum em modulações" },
    { id:"sus2", label:"Sus2",        s:[0,2,7],    formula:"1–2–5",       desc:"Aberto, ambíguo — sem terça definida" },
    { id:"sus4", label:"Sus4",        s:[0,5,7],    formula:"1–4–5",       desc:"Quer resolver — muito usado antes do acorde maior" },
    { id:"dom7", label:"Dom 7",       s:[0,4,7,10], formula:"1–3–5–♭7",    desc:"O que mais quer resolver — motor da cadência V→I" },
    { id:"maj7", label:"Maior 7",     s:[0,4,7,11], formula:"1–3–5–7",     desc:"Suave, sofisticado — jazz e bossa nova" },
    { id:"min7", label:"Menor 7",     s:[0,3,7,10], formula:"1–♭3–5–♭7",  desc:"Flutuante, jazzístico — o acorde do jazz" },
    { id:"dim7", label:"Dim 7",       s:[0,3,6,9],  formula:"1–♭3–♭5–♭♭7",desc:"Simétrico — 4 notas equidistantes (3 semitons cada)" },
    { id:"m7b5", label:"m7♭5",        s:[0,3,6,10], formula:"1–♭3–♭5–♭7", desc:"Meio-diminuto — II grau na cadência II-V-I menor" },
  ];
  const ac = acordes.find(a=>a.id===sel);
  const notes = ac ? ac.s.map(n => hNoteEN((root+n)%12)) : [];
  const notesPT = ac ? ac.s.map(n => hNotePT((root+n)%12)) : [];
  return (
    <div>
      <p style={hS.p}>Selecione um tipo de acorde para ver sua estrutura no tom atual.</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
        {acordes.map(a => (
          <button key={a.id} onClick={() => setSel(sel===a.id ? null : a.id)}
            style={{ fontSize:12, padding:"4px 10px", borderRadius:8, cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif", fontWeight: sel===a.id ? 700 : 400,
              background: sel===a.id ? "#7F77DD" : "transparent",
              color: sel===a.id ? "#fff" : "#9fdabb",
              border: sel===a.id ? "1px solid #534AB7" : "1px solid #1d4435" }}>
            {a.label}
          </button>
        ))}
      </div>
      {ac ? (
        <div style={hS.card}>
          <div style={{ fontWeight:700, fontSize:16, color:"#fff", marginBottom:4 }}>
            {hNoteEN(root)}{ac.id==="maj"?"":ac.id==="min"?"m":ac.id==="dom7"?"7":ac.id==="maj7"?"maj7":ac.id==="min7"?"m7":ac.id==="dim"?"dim":ac.id==="aug"?"aug":ac.id==="sus2"?"sus2":ac.id==="sus4"?"sus4":ac.id==="dim7"?"dim7":"m7♭5"}{" "}
            <span style={{color:"#6fae8a",fontWeight:400,fontSize:12}}>({ac.formula})</span>
          </div>
          <div style={{ fontFamily:"monospace", fontSize:14, color:"#3fae6b", fontWeight:700,
            marginBottom:10, letterSpacing:1 }}>
            {notesPT.join("  ")}
            <span style={{color:"#5d917a",fontSize:11,fontWeight:400,marginLeft:8}}>
              ({notes.join(" – ")})
            </span>
          </div>
          <MiniPiano root={root} highlight={ac.s} size="sm" />
          <p style={{ ...hS.p, marginTop:10, marginBottom:0 }}>{ac.desc}</p>
        </div>
      ) : (
        <p style={hS.note}>Selecione um acorde para ver a estrutura no piano.</p>
      )}
    </div>
  );
}

// Seção 4: Funções harmônicas
function HSecFuncoes({ root }) {
  const funcs = [
    { grau:"I",   cor:"#7F77DD", bg:"#EEEDFE", nome:"Tônica — repouso",
      desc:"Centro tonal. Sensação de chegada, estabilidade, \"em casa\".",
      graus:"I · III · VI", s:[0,4,7] },
    { grau:"IV",  cor:"#1D9E75", bg:"#E1F5EE", nome:"Subdominante — movimento",
      desc:"Entre tônica e dominante. Dá direção sem máxima tensão.",
      graus:"II · IV", s:[0,5,9] },
    { grau:"V",   cor:"#D85A30", bg:"#FAECE7", nome:"Dominante — tensão máxima",
      desc:"Quer resolver na tônica. O trítono interno cria a atração mais forte.",
      graus:"V · VII", s:[0,4,7,10] },
  ];
  const [sel, setSel] = React.useState(null);
  const f = sel !== null ? funcs[sel] : null;
  return (
    <div>
      <p style={hS.p}>Cada acorde tem uma <strong style={{color:"#fff"}}>função</strong> dentro da tonalidade: repouso, movimento ou tensão.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
        {funcs.map((fn, i) => (
          <button key={fn.grau} onClick={() => setSel(sel===i ? null : i)}
            style={{ display:"flex", gap:12, alignItems:"center",
              background: sel===i ? fn.bg+"33" : "#0a2417",
              border: `1px solid ${sel===i ? fn.cor : "#15392b"}`,
              borderRadius:12, padding:"12px 14px", cursor:"pointer",
              textAlign:"left", fontFamily:"'Montserrat',sans-serif", transition:"all .15s" }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:fn.bg+"44",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:900, fontSize:16, color:fn.cor, flexShrink:0 }}>
              {fn.grau}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, color:"#fff", fontSize:14 }}>{fn.nome}</div>
              <div style={{ fontSize:12, color:"#9fdabb", marginTop:2 }}>{fn.desc}</div>
              <div style={{ fontSize:11, color:fn.cor, marginTop:3 }}>Graus: {fn.graus}</div>
            </div>
          </button>
        ))}
      </div>
      {f && (
        <div style={hS.card}>
          <div style={{ fontWeight:700, fontSize:14, color:"#fff", marginBottom:8 }}>
            Acorde de {hNoteEN(root)} no grau {f.grau}:
          </div>
          <div style={{ fontFamily:"monospace", fontSize:14, color:"#3fae6b", fontWeight:700, marginBottom:10 }}>
            {f.s.map(n => hNotePT((root+n)%12)).join("  ")}
          </div>
          <MiniPiano root={root} highlight={f.s} size="sm" />
        </div>
      )}
    </div>
  );
}

// Seção 5: Campo harmônico
function HSecCampo({ root }) {
  const [sel, setSel] = React.useState(null);
  const GRAUS = [
    { g:"I",   r:0,  tipo:"maj7",   f:"Tônica",        cor:"#7F77DD", bg:"#EEEDFE", mn:false },
    { g:"II",  r:2,  tipo:"m7",     f:"Subdominante",  cor:"#1D9E75", bg:"#E1F5EE", mn:true  },
    { g:"III", r:4,  tipo:"m7",     f:"Tônica",        cor:"#7F77DD", bg:"#EEEDFE", mn:true  },
    { g:"IV",  r:5,  tipo:"maj7",   f:"Subdominante",  cor:"#1D9E75", bg:"#E1F5EE", mn:false },
    { g:"V",   r:7,  tipo:"7",      f:"Dominante",     cor:"#D85A30", bg:"#FAECE7", mn:false },
    { g:"VI",  r:9,  tipo:"m7",     f:"Tônica",        cor:"#7F77DD", bg:"#EEEDFE", mn:true  },
    { g:"VII", r:11, tipo:"m7♭5",   f:"Dominante",     cor:"#D85A30", bg:"#FAECE7", mn:true  },
  ];
  const sel_g = sel !== null ? GRAUS[sel] : null;
  // notas de cada acorde (tríade + 7ª)
  const chord_ivs = {maj7:[0,4,7,11], m7:[0,3,7,10], "7":[0,4,7,10], "m7♭5":[0,3,6,10]};
  return (
    <div>
      <p style={hS.p}>Os <strong style={{color:"#fff"}}>7 acordes</strong> que pertencem à tonalidade de <strong style={{color:"#3fae6b"}}>{hNotePT(root)} maior</strong>. Clique num grau para ver o acorde.</p>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {GRAUS.map((g, i) => {
          const nome = hNoteEN((root+g.r)%12) + (g.mn?"m":"");
          return (
            <button key={g.g} onClick={() => setSel(sel===i ? null : i)}
              style={{ padding:"10px 12px", borderRadius:10, cursor:"pointer",
                fontFamily:"'Montserrat',sans-serif", textAlign:"center",
                background: sel===i ? g.bg+"55" : "#0a2417",
                border: `1px solid ${sel===i ? g.cor : "#15392b"}`, transition:"all .15s" }}>
              <div style={{ fontSize:10, color:g.cor, fontWeight:600 }}>{g.g}</div>
              <div style={{ fontSize:15, color:"#fff", fontWeight:700 }}>{nome}</div>
              <div style={{ fontSize:10, color:"#5d917a" }}>{g.tipo}</div>
            </button>
          );
        })}
      </div>
      {sel_g && (
        <div style={hS.card}>
          <div style={{ fontWeight:700, color:"#fff", fontSize:14, marginBottom:4 }}>
            {sel_g.g} grau — {hNoteEN((root+sel_g.r)%12)}{sel_g.mn?"m":""} {sel_g.tipo}
            <span style={{ fontSize:12, color:sel_g.cor, fontWeight:500, marginLeft:8 }}>
              Função: {sel_g.f}
            </span>
          </div>
          <div style={{ fontFamily:"monospace", fontSize:14, color:"#3fae6b", fontWeight:700, marginBottom:10 }}>
            {(chord_ivs[sel_g.tipo]||[0,4,7]).map(n => hNotePT((root+sel_g.r+n)%12)).join("  ")}
          </div>
          <MiniPiano root={(root+sel_g.r)%12} highlight={chord_ivs[sel_g.tipo]||[0,4,7]} size="sm" />
        </div>
      )}
    </div>
  );
}

// Seção 6: Progressões
function HSecProgressoes({ root }) {
  const [sel, setSel] = React.useState(0);
  const CAMPO_R = [0,2,4,5,7,9,11];
  const CAMPO_MN = [false,true,true,false,false,true,true];
  function grauNome(gi) {
    if (gi < 0) return hNoteEN((root+10)%12); // bVII
    const r=(root+CAMPO_R[gi])%12;
    return hNoteEN(r)+(CAMPO_MN[gi]?"m":"");
  }
  const progs = [
    { l:"I – V – VI – IV",  gi:[0,4,5,3], desc:"A mais popular do mundo — literalmente milhares de músicas.", ex:"\"Let It Be\", \"No Woman No Cry\", \"With or Without You\"" },
    { l:"I – IV – V – I",   gi:[0,3,4,0], desc:"Cadência autêntica completa — núcleo da música clássica e country.", ex:"\"La Bamba\", hinos, blues de 12 compassos" },
    { l:"II – V – I",       gi:[1,4,0],   desc:"A progressão do jazz — movimento de quartas descendentes.", ex:"Standards de jazz, bossa nova, \"Garota de Ipanema\"" },
    { l:"I – VI – IV – V",  gi:[0,5,3,4], desc:"Progressão dos anos 50-60 — nostalgia e simplicidade.", ex:"\"Stand By Me\", \"Earth Angel\"" },
    { l:"VI – IV – I – V",  gi:[5,3,0,4], desc:"Variante menor — mais sombria e dramática.", ex:"\"Pompeii\", \"Numb\", \"Wicked Game\"" },
    { l:"I – bVII – IV",    gi:[0,-1,3],  desc:"Modal com empréstimo — som de rock clássico.", ex:"\"Sweet Home Alabama\", \"Here Comes the Sun\"" },
    { l:"IV – I (plagal)",  gi:[3,0],     desc:"Cadência plagal — resolução suave, religiosa, \"amém\".", ex:"Final de hinos, gospel, \"Hey Jude\"" },
  ];
  const p = progs[sel];
  return (
    <div>
      <p style={hS.p}>Sequências de acordes que aparecem em inúmeras músicas. Todas <strong style={{color:"#fff"}}>transpostas para {hNotePT(root)}</strong>.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:14 }}>
        {progs.map((pg, i) => {
          const chords = pg.gi.map(gi => grauNome(gi)).join(" – ");
          return (
            <button key={i} onClick={() => setSel(i)}
              style={{ display:"flex", gap:10, alignItems:"center",
                background: sel===i ? "#0e2c1f" : "transparent",
                border: `1px solid ${sel===i ? "#2f7d57" : "#15392b"}`,
                borderRadius:10, padding:"10px 12px", cursor:"pointer",
                textAlign:"left", fontFamily:"'Montserrat',sans-serif", transition:"all .15s" }}>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:600, color:"#eef5f0", fontSize:13 }}>{pg.l}</span>
                <span style={{ fontSize:12, color:"#3fae6b", marginLeft:8 }}>{chords}</span>
              </div>
            </button>
          );
        })}
      </div>
      {p && (
        <div style={hS.card}>
          <div style={{ fontWeight:700, color:"#fff", fontSize:14, marginBottom:4 }}>
            {p.l} em {hNotePT(root)}
          </div>
          <div style={{ fontFamily:"monospace", fontSize:15, color:"#3fae6b", fontWeight:700,
            marginBottom:8, letterSpacing:.5 }}>
            {p.gi.map(gi => grauNome(gi)).join("  –  ")}
          </div>
          <p style={{ ...hS.p, marginBottom:4 }}>{p.desc}</p>
          <p style={{ ...hS.note, margin:0 }}>Ex: {p.ex}</p>
        </div>
      )}
    </div>
  );
}

// Seção 7: Conceitos avançados (sem piano — não faz sentido aqui)
function HSecAvancados({ root }) {
  const items = [
    { t:"Modulação", tag:"Avançado",
      desc:"Mudança de tonalidade dentro de uma música — dá sensação de \"elevação\".",
      ex:`Último refrão um semitom acima · muito usado em pop e gospel.` },
    { t:"Dominante secundária — V/X", tag:"Tensão",
      desc:"Acorde dominante de um grau que não é a tônica — cria tensão local.",
      ex:`${hNoteEN((root+9)%12)}7 resolve em ${hNoteEN((root+2)%12)}m (V/II em ${hNotePT(root)}).` },
    { t:"Empréstimo modal", tag:"Cor",
      desc:"Acorde do tom paralelo (maior/menor) inserido para cor diferente.",
      ex:`${hNoteEN((root+10)%12)} (bVII) em ${hNotePT(root)} maior — muito comum no rock.` },
    { t:"Acorde napolitano — bII", tag:"Clássico",
      desc:"Acorde maior construído sobre o 2º grau bemolizado — muito dramático.",
      ex:`${hNoteEN((root+1)%12)} maior em ${hNotePT(root)} menor — ópera, clássico, metal.` },
    { t:"Diminuto de passagem", tag:"Passagem",
      desc:"Cria movimento cromático entre dois acordes — substituto da dominante.",
      ex:`${hNotePT(root)} – ${hNoteEN((root+1)%12)}dim – ${hNoteEN((root+2)%12)}m.` },
    { t:"Substituição de trítono — SubV", tag:"Jazz",
      desc:"Substitui o V7 pelo acorde a um trítono de distância — som jazzístico.",
      ex:`${hNoteEN((root+6)%12)}7 no lugar de ${hNoteEN((root+7)%12)}7 em ${hNotePT(root)}.` },
    { t:"Nota pedal", tag:"Textura",
      desc:"Uma nota (geralmente tônica ou dominante) sustentada enquanto os acordes mudam.",
      ex:`Baixo em ${hNotePT(root)} sustentado enquanto os acordes variam — tensão progressiva.` },
  ];
  return (
    <div>
      <p style={hS.p}>Recursos harmônicos além do campo diatônico — todos os exemplos em <strong style={{color:"#3fae6b"}}>{hNotePT(root)}</strong>.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ ...hS.card, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
              <span style={{ fontWeight:700, fontSize:14, color:"#eef5f0" }}>{it.t}</span>
              <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:10,
                background:"rgba(63,174,107,.15)", color:"#3fae6b", border:"1px solid #1d4435" }}>
                {it.tag}
              </span>
            </div>
            <p style={{ ...hS.p, marginBottom:4 }}>{it.desc}</p>
            <p style={{ ...hS.note, margin:0 }}>Ex: {it.ex}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Estilos compartilhados entre as seções
const hS = {
  p:    { fontSize:"clamp(12px,3.2vw,13.5px)", color:"#9fdabb", lineHeight:1.65, margin:"0 0 10px" },
  note: { fontSize:"clamp(11px,2.8vw,12px)", color:"#6fae8a", fontStyle:"italic", lineHeight:1.5 },
  card: { background:"#091f14", border:"1px solid #1d4435", borderRadius:12,
          padding:"14px 14px 16px", marginBottom:10 },
  table: { width:"100%", borderCollapse:"collapse", fontSize:"clamp(11px,3vw,13px)", color:"#9fdabb" },
  th:   { textAlign:"left", padding:"7px 10px", background:"#0a2b1e", color:"#6fae8a",
          fontWeight:600, fontSize:"clamp(10px,2.6vw,11.5px)", borderBottom:"1px solid #1d4435" },
  td:   { padding:"7px 10px", borderBottom:"1px solid #132e22", cursor:"pointer" },
};

// Componente principal
function HarmoniaCompletaView({ onBack }) {
  const [root, setRoot] = React.useState(0); // 0 = Dó
  const [sec, setSec] = React.useState("intervalos");

  const secoes = [
    { id:"intervalos",  label:"Intervalos" },
    { id:"escalas",     label:"Escalas" },
    { id:"acordes",     label:"Acordes" },
    { id:"funcoes",     label:"Funções" },
    { id:"campo",       label:"Campo harm." },
    { id:"progressoes", label:"Progressões" },
    { id:"avancados",   label:"Avançado" },
  ];

  const content = {
    intervalos:  <HSecIntervalos root={root} />,
    escalas:     <HSecEscalas root={root} />,
    acordes:     <HSecAcordes root={root} />,
    funcoes:     <HSecFuncoes root={root} />,
    campo:       <HSecCampo root={root} />,
    progressoes: <HSecProgressoes root={root} />,
    avancados:   <HSecAvancados root={root} />,
  };

  return (
    <div style={{ maxWidth: 720, margin:"0 auto", padding:"16px 12px 80px",
      fontFamily:"'Montserrat',sans-serif" }}>
      {/* Cabeçalho */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding:"7px 12px", flexShrink:0 }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <div style={{ fontWeight:800, fontSize:"clamp(18px,5vw,24px)", color:"#fff", lineHeight:1.1 }}>
            Harmonia Musical
          </div>
          <div style={{ fontSize:12, color:"#6fae8a", marginTop:2 }}>
            Guia interativo completo — muda o tom e veja tudo transposto
          </div>
        </div>
      </div>

      {/* Seletor de tom — persiste em todas as seções */}
      <KeySelector root={root} setRoot={setRoot} />

      {/* Tabs de seção */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
        {secoes.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)}
            style={{ fontSize:12.5, padding:"6px 13px", borderRadius:9, cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif", fontWeight: sec===s.id ? 700 : 400,
              background: sec===s.id ? "linear-gradient(135deg,#0f4a30,#0a3422)" : "transparent",
              color: sec===s.id ? "#fff" : "#6fae8a",
              border: sec===s.id ? "1px solid #2f7d57" : "1px solid #15392b",
              transition:"all .15s" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da seção selecionada */}
      <div style={{ background:"#0c2419", border:"1px solid #15392b", borderRadius:14,
        padding:"16px 14px 20px" }}>
        {content[sec]}
      </div>
    </div>
  );
}


function TeoriaMusicaView({ onBack }) {
  const [subView, setSubView] = React.useState("main");

  // Cada módulo abre em página própria (igual à cifra)
  const modules = [
    {
      id: "harmonia", label: "Harmonia Musical Completa",
      desc: "Intervalos · Escalas · Acordes · Campo harmônico · Progressões",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="18" width="4" height="8" rx="2" fill="#9b6ef0"/><rect x="8" y="13" width="4" height="13" rx="2" fill="#9b6ef0" opacity=".8"/><rect x="14" y="8" width="4" height="18" rx="2" fill="#9b6ef0" opacity=".6"/><rect x="20" y="3" width="4" height="23" rx="2" fill="#9b6ef0" opacity=".4"/></svg>,
      accent: "#9b6ef0", bg: "linear-gradient(135deg,#1a0f4a,#0f1f3d)", border: "#4f3db8",
    },
    {
      id: "compassos", label: "Compassos musicais",
      desc: "Simples, compostos, assimétricos e raros — ordenados por uso",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="10" width="24" height="2" rx="1" fill="#3fae6b"/><rect x="2" y="16" width="24" height="2" rx="1" fill="#3fae6b" opacity=".6"/><circle cx="8" cy="11" r="3" fill="#3fae6b"/><circle cx="20" cy="17" r="3" fill="#3fae6b" opacity=".7"/><rect x="10" y="5" width="2" height="9" rx="1" fill="#3fae6b"/><rect x="22" y="11" width="2" height="9" rx="1" fill="#3fae6b" opacity=".7"/></svg>,
      accent: "#3fae6b", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "divisoes", label: "Divisões rítmicas",
      desc: "Semibreve, mínima, semínima, colcheia e mais",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><ellipse cx="9" cy="22" rx="5" ry="3.5" fill="#e0b341"/><rect x="13" y="7" width="2" height="15" rx="1" fill="#e0b341"/><ellipse cx="20" cy="20" rx="4" ry="3" fill="#e0b341" opacity=".7"/><rect x="23" y="8" width="2" height="12" rx="1" fill="#e0b341" opacity=".7"/><path d="M15 7 Q22 10 25 8" stroke="#e0b341" strokeWidth="1.5" fill="none"/></svg>,
      accent: "#e0b341", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "intervalos", label: "Intervalos musicais",
      desc: "A distância entre duas notas — de uníssono à oitava",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><line x1="4" y1="24" x2="24" y2="4" stroke="#4f9dde" strokeWidth="2" strokeDasharray="2 2"/><circle cx="4" cy="24" r="3" fill="#4f9dde"/><circle cx="24" cy="4" r="3" fill="#4f9dde"/><text x="14" y="17" textAnchor="middle" fontSize="9" fill="#4f9dde" fontFamily="monospace" fontWeight="700">P5</text></svg>,
      accent: "#4f9dde", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "escalas", label: "Escalas",
      desc: "Maior, menor, pentatônica, blues e modos gregos",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="20" width="3" height="6" rx="1" fill="#34c98a"/><rect x="6" y="17" width="3" height="9" rx="1" fill="#34c98a" opacity=".85"/><rect x="10" y="14" width="3" height="12" rx="1" fill="#34c98a" opacity=".7"/><rect x="14" y="11" width="3" height="15" rx="1" fill="#34c98a" opacity=".6"/><rect x="18" y="8" width="3" height="18" rx="1" fill="#34c98a" opacity=".5"/><rect x="22" y="5" width="3" height="21" rx="1" fill="#34c98a" opacity=".4"/></svg>,
      accent: "#34c98a", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "acordes", label: "Acordes e tríades",
      desc: "Tríades, tétrades, inversões e extensões",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><ellipse cx="8" cy="22" rx="5" ry="3.5" fill="#e0b341"/><rect x="12" y="8" width="2" height="14" rx="1" fill="#e0b341"/><ellipse cx="16" cy="18" rx="5" ry="3.5" fill="#e0b341" opacity=".7"/><rect x="20" y="6" width="2" height="12" rx="1" fill="#e0b341" opacity=".7"/></svg>,
      accent: "#e0b341", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "funcoes", label: "Funções harmônicas",
      desc: "Tônica, dominante e subdominante",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="8" width="7" height="18" rx="3" fill="#7F77DD"/><rect x="11" y="4" width="7" height="22" rx="3" fill="#D85A30"/><rect x="20" y="12" width="7" height="14" rx="3" fill="#1D9E75"/></svg>,
      accent: "#9b6ef0", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "campo", label: "Campo harmônico",
      desc: "Os 7 acordes que pertencem a cada tonalidade",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><text x="2" y="14" fontSize="10" fill="#9b6ef0" fontFamily="serif" fontWeight="700">I</text><text x="8" y="14" fontSize="10" fill="#1D9E75" fontFamily="serif" fontWeight="700">II</text><text x="15" y="14" fontSize="10" fill="#9b6ef0" fontFamily="serif" fontWeight="700">III</text><text x="2" y="26" fontSize="10" fill="#1D9E75" fontFamily="serif" fontWeight="700">IV</text><text x="9" y="26" fontSize="10" fill="#D85A30" fontFamily="serif" fontWeight="700">V</text><text x="16" y="26" fontSize="10" fill="#9b6ef0" fontFamily="serif" fontWeight="700">VI</text></svg>,
      accent: "#9b6ef0", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "progressoes", label: "Progressões famosas",
      desc: "I-V-VI-IV · II-V-I · e as mais usadas no louvor",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M2 22 L8 14 L14 18 L20 8 L26 6" stroke="#e0b341" strokeWidth="2" strokeLinecap="round" fill="none"/><circle cx="2" cy="22" r="2" fill="#e0b341"/><circle cx="8" cy="14" r="2" fill="#e0b341"/><circle cx="14" cy="18" r="2" fill="#e0b341"/><circle cx="20" cy="8" r="2" fill="#e0b341"/><circle cx="26" cy="6" r="2" fill="#e0b341"/></svg>,
      accent: "#e0b341", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "transposicao", label: "Transposição e capo",
      desc: "Como mudar de tom e usar a capotraste",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4 L14 24" stroke="#3fae6b" strokeWidth="2"/><path d="M8 10 L14 4 L20 10" stroke="#3fae6b" strokeWidth="2" strokeLinecap="round" fill="none"/><path d="M8 18 L14 24 L20 18" stroke="#3fae6b" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5"/><rect x="2" y="12" width="24" height="4" rx="2" fill="#3fae6b" opacity=".2"/></svg>,
      accent: "#3fae6b", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "cifra", label: "Como ler uma cifra",
      desc: "Notação, símbolos e leitura prática",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="3" width="20" height="22" rx="3" fill="none" stroke="#34c98a" strokeWidth="1.5"/><text x="8" y="12" fontSize="8" fill="#34c98a" fontFamily="monospace" fontWeight="700">Am</text><text x="8" y="20" fontSize="7" fill="#34c98a" fontFamily="monospace" opacity=".7">G/B</text><line x1="8" y1="14" x2="20" y2="14" stroke="#34c98a" strokeWidth="0.5" opacity=".4"/></svg>,
      accent: "#34c98a", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "ritmo", label: "Ritmo e compasso",
      desc: "Fórmulas de compasso, BPM e subdivisões",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><text x="2" y="14" fontSize="13" fill="#3fae6b" fontFamily="serif" fontWeight="700">4</text><line x1="2" y1="16" x2="13" y2="16" stroke="#3fae6b" strokeWidth="1.5"/><text x="2" y="26" fontSize="13" fill="#3fae6b" fontFamily="serif" fontWeight="700">4</text><line x1="16" y1="6" x2="16" y2="22" stroke="#3fae6b" strokeWidth="1.5" opacity=".4"/><ellipse cx="22" cy="22" rx="4" ry="3" fill="#3fae6b" opacity=".7"/><rect x="25" y="12" width="1.5" height="10" rx=".75" fill="#3fae6b" opacity=".7"/></svg>,
      accent: "#3fae6b", bg: "#0c2419", border: "#1d6b46",
    },
    {
      id: "modos", label: "Modos gregos",
      desc: "Jônico · Dórico · Frígio · Lídio · Mixolídio · Eólio · Lócrio",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="11" fill="none" stroke="#e8554d" strokeWidth="1.5"/><line x1="14" y1="3" x2="14" y2="25" stroke="#e8554d" strokeWidth="1" opacity=".4"/><line x1="3" y1="14" x2="25" y2="14" stroke="#e8554d" strokeWidth="1" opacity=".4"/><path d="M8 6 Q14 14 20 6" stroke="#e8554d" strokeWidth="1.5" fill="none"/><path d="M8 22 Q14 14 20 22" stroke="#e8554d" strokeWidth="1.5" fill="none" opacity=".5"/></svg>,
      accent: "#e8554d", bg: "#0c2419", border: "#1d6b46",
    },
  ];

  // Mapa de subView para componente
  const viewMap = {
    harmonia:    <HarmoniaCompletaView onBack={() => setSubView("main")} />,
    compassos:   <CompassosView onBack={() => setSubView("main")} />,
    divisoes:    <DivisoesView  onBack={() => setSubView("main")} />,
    intervalos:  <TopicPage title="Intervalos musicais"  onBack={() => setSubView("main")} accent="#4f9dde"><TopicIntervalos /></TopicPage>,
    escalas:     <TopicPage title="Escalas"               onBack={() => setSubView("main")} accent="#34c98a"><TopicEscalas /></TopicPage>,
    acordes:     <TopicPage title="Acordes e tríades"     onBack={() => setSubView("main")} accent="#e0b341"><TopicAcordes /></TopicPage>,
    funcoes:     <TopicPage title="Funções harmônicas"    onBack={() => setSubView("main")} accent="#9b6ef0"><TopicFuncoes /></TopicPage>,
    campo:       <TopicPage title="Campo harmônico"       onBack={() => setSubView("main")} accent="#9b6ef0"><TopicCampo /></TopicPage>,
    progressoes: <TopicPage title="Progressões famosas"   onBack={() => setSubView("main")} accent="#e0b341"><TopicProgressoes /></TopicPage>,
    transposicao:<TopicPage title="Transposição e capo"   onBack={() => setSubView("main")} accent="#3fae6b"><TopicTransposicao /></TopicPage>,
    cifra:       <TopicPage title="Como ler uma cifra"    onBack={() => setSubView("main")} accent="#34c98a"><TopicCifra /></TopicPage>,
    ritmo:       <TopicPage title="Ritmo e compasso"      onBack={() => setSubView("main")} accent="#3fae6b"><TopicRitmo /></TopicPage>,
    modos:       <TopicPage title="Modos gregos"          onBack={() => setSubView("main")} accent="#e8554d"><TopicModos /></TopicPage>,
  };

  if (subView !== "main") return viewMap[subView] || null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 12px 80px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "8px 12px", flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: "clamp(20px,5vw,28px)", color: "#fff", lineHeight: 1.1 }}>
            Teoria Musical
          </h1>
          <p style={{ margin: "3px 0 0", color: "#6fae8a", fontSize: "clamp(11px,3vw,13px)" }}>
            Selecione um módulo
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {modules.map(m => (
          <button key={m.id} onClick={() => setSubView(m.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%",
              background: m.bg, border: `1px solid ${m.border}`, borderRadius: 13,
              padding: "14px 16px", cursor: "pointer",
              fontFamily: "'Montserrat',sans-serif", textAlign: "left",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <span style={{ flexShrink: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "clamp(13px,3.8vw,15px)", color: "#fff", lineHeight: 1.2 }}>
                {m.label}
              </div>
              <div style={{ fontSize: "clamp(10px,2.8vw,12px)", color: m.accent, opacity: .75, marginTop: 3, lineHeight: 1.4 }}>
                {m.desc}
              </div>
            </div>
            <ChevronDown size={16} color={m.accent} style={{ flexShrink: 0, transform: "rotate(-90deg)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* Wrapper de página para cada tópico — igual ao layout da cifra */
function TopicPage({ title, onBack, accent, children }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 14px 80px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "7px 12px", flexShrink: 0 }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 style={{
          margin: 0, fontWeight: 800,
          fontSize: "clamp(17px,4.5vw,24px)", color: "#fff", lineHeight: 1.1,
          borderLeft: `3px solid ${accent}`, paddingLeft: 12,
        }}>
          {title}
        </h1>
      </div>
      <div style={{ fontSize: "clamp(12px,3.2vw,14px)", lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

/* ---- helpers para CompassosView / DivisoesView com botão Voltar ---- */
const COMPASSOS_DATA = [
  // Simples
  { rank:1,  cat:"simples", cor:"#7F77DD", sig:"4/4", nome:"4/4 — Quaternário simples",    desc:"4 tempos de semínima · o mais universal da música ocidental", generos:"Rock, pop, samba, funk, jazz, eletrônica, MPB", uso:100 },
  { rank:2,  cat:"simples", cor:"#7F77DD", sig:"3/4", nome:"3/4 — Ternário simples",        desc:"3 tempos de semínima · sensação de \"balanço\" e rotação",   generos:"Valsa, choro, balada, clássica, country", uso:82 },
  { rank:3,  cat:"simples", cor:"#7F77DD", sig:"2/4", nome:"2/4 — Binário simples",         desc:"2 tempos de semínima · passo marcado, enérgico",            generos:"Marcha, polka, baião, forró, hino", uso:70 },
  { rank:4,  cat:"simples", cor:"#7F77DD", sig:"2/2", nome:"2/2 — Alla breve",              desc:"2 tempos de mínima · o 4/4 sentido ao dobro da velocidade", generos:"Coral, orquestra, marcha, rock rápido", uso:60 },
  // Compostos
  { rank:5,  cat:"composto", cor:"#1D9E75", sig:"6/8",  nome:"6/8 — Binário composto",       desc:"2 grupos de 3 colcheias · balancinho característico",        generos:"Jiga, shuffle, celta, rock 6/8, pop", uso:72 },
  { rank:6,  cat:"composto", cor:"#1D9E75", sig:"9/8",  nome:"9/8 — Ternário composto",      desc:"3 grupos de 3 colcheias · sensação flutuante",               generos:"Folclore, jazz lento, clássico romântico", uso:38 },
  { rank:7,  cat:"composto", cor:"#1D9E75", sig:"12/8", nome:"12/8 — Quaternário composto",  desc:"4 grupos de 3 colcheias · groove pesado e blues",            generos:"Blues, gospel, soul, slow rock, jazz", uso:45 },
  { rank:8,  cat:"composto", cor:"#1D9E75", sig:"3/8",  nome:"3/8 — Simples leve",           desc:"3 colcheias por compasso · rápido, ágil",                    generos:"Mazurca, música clássica, ópera", uso:28 },
  // Assimétricos
  { rank:9,  cat:"assimetrico", cor:"#D85A30", sig:"5/4",  nome:"5/4 — Quintuple",           desc:"5 tempos · sensação \"manca\", assimétrica",                  generos:"Jazz (Take Five), prog rock, balcânico", uso:32 },
  { rank:10, cat:"assimetrico", cor:"#D85A30", sig:"7/8",  nome:"7/8 — Heptacompasso",       desc:"7 colcheias · agrup. 3+2+2 ou 2+2+3",                        generos:"Balcânico, prog rock, metal progressivo", uso:22 },
  { rank:11, cat:"assimetrico", cor:"#D85A30", sig:"5/8",  nome:"5/8 — Quintuple em colch.", desc:"5 colcheias · mais veloz que o 5/4",                         generos:"Música grega, folclore balcânico", uso:16 },
  { rank:12, cat:"assimetrico", cor:"#D85A30", sig:"7/4",  nome:"7/4 — Heptacompasso lento", desc:"7 semínimas · espaçado, cinematográfico",                     generos:"Prog rock, trilha sonora, Radiohead, Tool", uso:14 },
  // Raros
  { rank:13, cat:"raro", cor:"#888780", sig:"11/8", nome:"11/8 — Hendecacompasso",          desc:"11 colcheias · agrupamentos variados",                        generos:"Contemporâneo, prog metal, flamenco", uso:9 },
  { rank:14, cat:"raro", cor:"#888780", sig:"15/8", nome:"15/8 — Muito longo",             desc:"5 grupos de 3 colcheias · extremamente raro",                 generos:"Folclore turco, balcânico, experimental", uso:5 },
  { rank:15, cat:"raro", cor:"#888780", sig:"13/8", nome:"13/8 — Tridecacompasso",         desc:"13 colcheias · território da vanguarda",                       generos:"Contemporâneo, experimental, prog", uso:4 },
  { rank:16, cat:"raro", cor:"#888780", sig:"livre", nome:"Compasso livre",                desc:"Sem métrica fixa · pulso natural ou improvisado",              generos:"Gregoriano, música árabe, flamenco, free jazz", uso:18 },
];

const COMPASSOS_SECTIONS = [
  { key:"simples",    label:"Compassos simples — os mais usados" },
  { key:"composto",   label:"Compassos compostos — subdivisão ternária" },
  { key:"assimetrico",label:"Compassos assimétricos e irregulares" },
  { key:"raro",       label:"Compassos raros e especializados" },
];

function SigSVG({ sig, cor }) {
  const top = sig === "livre" ? "—" : sig.split("/")[0];
  const bot = sig === "livre" ? "—" : sig.split("/")[1];
  const fontSize = top.length > 1 ? 14 : 17;
  return (
    <svg width="36" height="44" viewBox="0 0 36 44">
      <text x="18" y="22" textAnchor="middle" fontSize={fontSize} fontWeight="600" fill={cor} fontFamily="serif">{top}</text>
      <line x1="5" y1="24" x2="31" y2="24" stroke={cor} strokeWidth="1.2"/>
      <text x="18" y="40" textAnchor="middle" fontSize={17} fontWeight="600" fill={cor} fontFamily="serif">{bot}</text>
    </svg>
  );
}

function CompassosView({ onBack }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? COMPASSOS_DATA : COMPASSOS_DATA.filter(d => d.cat === filter);
  const sections = filter === "all" ? COMPASSOS_SECTIONS : COMPASSOS_SECTIONS.filter(s => s.key === filter);

  const filterBtns = [
    { id:"all", label:"Todos" },
    { id:"simples", label:"Simples" },
    { id:"composto", label:"Compostos" },
    { id:"assimetrico", label:"Assimétricos" },
    { id:"raro", label:"Raros" },
  ];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 80px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "7px 12px" }}><ArrowLeft size={16} /> Voltar</button>
        <div style={{ fontWeight: 800, fontSize: "clamp(18px,5vw,22px)", color: "#fff" }}> Compassos musicais</div>
      </div>
      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {filterBtns.map(b => {
          const active = filter === b.id;
          return (
            <button key={b.id} onClick={() => setFilter(b.id)}
              style={{ fontSize:12, padding:"4px 12px", borderRadius:20, cursor:"pointer", fontFamily:"'Montserrat',sans-serif",
                background: active ? "#eef5f0" : "transparent",
                color: active ? "#0d3d28" : "#6fae8a",
                border: active ? "none" : "1px solid #1d4435" }}>
              {b.label}
            </button>
          );
        })}
      </div>

      <div style={{ background:"#0c2419", border:"1px solid #15392b", borderRadius:14, overflow:"hidden" }}>
        {sections.map(sec => {
          const rows = filtered.filter(d => d.cat === sec.key);
          if (!rows.length) return null;
          return (
            <div key={sec.key}>
              <div style={{ fontSize:11, fontWeight:600, color:"#6fae8a", padding:"10px 16px 4px", letterSpacing:".06em", textTransform:"uppercase", background:"#091f14", borderBottom:"1px solid #15392b", borderTop:"1px solid #15392b" }}>
                {sec.label}
              </div>
              {rows.map(d => (
                <div key={d.rank} style={{ display:"flex", alignItems:"center", borderBottom:"1px solid #15392b", transition:"background .12s", cursor:"default" }}
                  onMouseEnter={e => e.currentTarget.style.background="#0e2c1f"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{ width:32, minWidth:32, textAlign:"center", fontSize:12, color:"#5d917a", padding:"10px 0" }}>{d.rank}</span>
                  <span style={{ width:52, minWidth:52, display:"flex", alignItems:"center", justifyContent:"center", padding:"8px 0" }}>
                    <SigSVG sig={d.sig} cor={d.cor} />
                  </span>
                  <div style={{ flex:1, padding:"10px 8px" }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#eef5f0" }}>{d.nome}</div>
                    <div style={{ fontSize:12, color:"#9fdabb", marginTop:2 }}>{d.desc}</div>
                    <div style={{ fontSize:11, color:"#5d917a", marginTop:2 }}>{d.generos}</div>
                  </div>
                  <div style={{ width:120, minWidth:120, padding:"10px 12px 10px 0", display:"flex", alignItems:"center" }}>
                    <div style={{ height:5, borderRadius:3, background:"#1d4435", width:"100%", position:"relative" }}>
                      <div style={{ height:"100%", borderRadius:3, background:d.cor, opacity:.75, width:`${d.uso}%` }} />
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:"#5d917a", paddingRight:14, minWidth:36, textAlign:"right" }}>{d.uso}%</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Divisões rítmicas ---- */
const DIVISOES_DATA = [
  { rank:1,  cat:"simples",  cor:"#7F77DD", nome:"Semínima (¼)",          ingles:"Quarter note",       svg:"quarter",    uso:100, desc:"1 tempo — base do pulso musical" },
  { rank:2,  cat:"simples",  cor:"#7F77DD", nome:"Mínima (½)",            ingles:"Half note",          svg:"half",       uso:95,  desc:"2 tempos — muito comum em harmonia" },
  { rank:3,  cat:"simples",  cor:"#7F77DD", nome:"Colcheia (⅛)",          ingles:"Eighth note",        svg:"eighth",     uso:93,  desc:"½ tempo — base da subdivisão simples" },
  { rank:4,  cat:"simples",  cor:"#7F77DD", nome:"Semibreve (1)",         ingles:"Whole note",         svg:"whole",      uso:88,  desc:"4 tempos — muito usada em acordes" },
  { rank:5,  cat:"simples",  cor:"#7F77DD", nome:"Semicolcheia (1/16)",   ingles:"Sixteenth note",     svg:"sixteenth",  uso:80,  desc:"¼ de tempo — subdivisão dupla" },
  { rank:6,  cat:"simples",  cor:"#7F77DD", nome:"Mínima pontuada",       ingles:"Dotted half",        svg:"dothalf",    uso:72,  desc:"3 tempos — base do 3/4 e 6/8" },
  { rank:7,  cat:"simples",  cor:"#7F77DD", nome:"Semínima pontuada",     ingles:"Dotted quarter",     svg:"dotquarter", uso:68,  desc:"1½ tempo — swing, síncopes" },
  { rank:8,  cat:"simples",  cor:"#7F77DD", nome:"Colcheia pontuada",     ingles:"Dotted eighth",      svg:"doteighth",  uso:62,  desc:"¾ de tempo — shuffle, folk" },
  { rank:9,  cat:"especial", cor:"#1D9E75", nome:"Tercina de colcheias",  ingles:"Eighth triplet",     svg:"triplet",    uso:75,  desc:"3 notas no espaço de 2 — groove, blues" },
  { rank:10, cat:"especial", cor:"#1D9E75", nome:"Tercina de semínimas",  ingles:"Quarter triplet",    svg:"qtriplet",   uso:55,  desc:"3 notas em 2 tempos — jazz, pop" },
  { rank:11, cat:"especial", cor:"#1D9E75", nome:"Quiáltera de 5",        ingles:"Quintuplet",         svg:"quint",      uso:30,  desc:"5 notas no espaço de 4 — efeito fluente" },
  { rank:12, cat:"especial", cor:"#1D9E75", nome:"Quiáltera de 6",        ingles:"Sextuplet",          svg:"sext",       uso:28,  desc:"6 notas em 1 tempo — variante da tercina" },
  { rank:13, cat:"especial", cor:"#1D9E75", nome:"Quiáltera de 7",        ingles:"Septuplet",          svg:"sept",       uso:18,  desc:"7 notas no espaço de 4 — avançado" },
  { rank:14, cat:"especial", cor:"#1D9E75", nome:"Quiáltera de 9",        ingles:"Nonuplet",           svg:"nine",       uso:10,  desc:"9 notas em 2 tempos — música contemporânea" },
  { rank:15, cat:"especial", cor:"#1D9E75", nome:"Duína",                 ingles:"Duplet",             svg:"duplet",     uso:22,  desc:"2 notas no espaço de 3 — no compasso ternário" },
  { rank:16, cat:"raro",     cor:"#D85A30", nome:"Fusa (1/32)",           ingles:"Thirty-second",      svg:"fusa",       uso:20,  desc:"⅛ de tempo — ornamentos rápidos" },
  { rank:17, cat:"raro",     cor:"#D85A30", nome:"Semifusa (1/64)",       ingles:"Sixty-fourth",       svg:"semifusa",   uso:8,   desc:"1/16 de tempo — raramente escrita" },
  { rank:18, cat:"raro",     cor:"#D85A30", nome:"Breve (2)",             ingles:"Double whole note",  svg:"breve",      uso:12,  desc:"8 tempos — música antiga, coral" },
  { rank:19, cat:"raro",     cor:"#D85A30", nome:"Longa (4)",             ingles:"Longa",              svg:"longa",      uso:5,   desc:"16 tempos — música medieval" },
  { rank:20, cat:"raro",     cor:"#D85A30", nome:"Máxima (8)",            ingles:"Maxima",             svg:"maxima",     uso:2,   desc:"32 tempos — notação histórica" },
];

const DIVISOES_SECTIONS = [
  { key:"simples",  label:"Figuras simples e pontuadas" },
  { key:"especial", label:"Quiálteras e divisões especiais" },
  { key:"raro",     label:"Figuras longas e raras" },
];

function svgNotaJSX(type, color) {
  const c = color;
  const shapes = {
    whole:      <><ellipse cx="22" cy="22" rx="10" ry="7" fill="none" stroke={c} strokeWidth="2"/></>,
    half:       <><ellipse cx="16" cy="26" rx="8" ry="6" fill="none" stroke={c} strokeWidth="2"/><line x1="24" y1="26" x2="24" y2="8" stroke={c} strokeWidth="2"/></>,
    quarter:    <><ellipse cx="16" cy="26" rx="8" ry="6" fill={c}/><line x1="24" y1="26" x2="24" y2="8" stroke={c} strokeWidth="2"/></>,
    eighth:     <><ellipse cx="16" cy="26" rx="8" ry="6" fill={c}/><line x1="24" y1="26" x2="24" y2="8" stroke={c} strokeWidth="2"/><path d="M24 8 Q36 12 28 20" fill="none" stroke={c} strokeWidth="2"/></>,
    sixteenth:  <><ellipse cx="16" cy="28" rx="7" ry="5" fill={c}/><line x1="23" y1="28" x2="23" y2="8" stroke={c} strokeWidth="2"/><path d="M23 8 Q34 12 26 18" fill="none" stroke={c} strokeWidth="1.8"/><path d="M23 14 Q34 18 26 24" fill="none" stroke={c} strokeWidth="1.8"/></>,
    dothalf:    <><ellipse cx="14" cy="26" rx="8" ry="6" fill="none" stroke={c} strokeWidth="2"/><line x1="22" y1="26" x2="22" y2="8" stroke={c} strokeWidth="2"/><circle cx="28" cy="26" r="2.5" fill={c}/></>,
    dotquarter: <><ellipse cx="14" cy="26" rx="8" ry="6" fill={c}/><line x1="22" y1="26" x2="22" y2="8" stroke={c} strokeWidth="2"/><circle cx="28" cy="26" r="2.5" fill={c}/></>,
    doteighth:  <><ellipse cx="13" cy="28" rx="7" ry="5" fill={c}/><line x1="20" y1="28" x2="20" y2="8" stroke={c} strokeWidth="2"/><path d="M20 8 Q31 12 23 20" fill="none" stroke={c} strokeWidth="2"/><circle cx="27" cy="28" r="2.5" fill={c}/></>,
    triplet:    <><ellipse cx="8" cy="26" rx="6" ry="5" fill={c}/><line x1="14" y1="26" x2="14" y2="10" stroke={c} strokeWidth="1.8"/><path d="M14 10 Q20 13 16 18" fill="none" stroke={c} strokeWidth="1.5"/>
                  <ellipse cx="22" cy="26" rx="6" ry="5" fill={c}/><line x1="28" y1="26" x2="28" y2="10" stroke={c} strokeWidth="1.8"/><path d="M28 10 Q34 13 30 18" fill="none" stroke={c} strokeWidth="1.5"/>
                  <ellipse cx="36" cy="26" rx="6" ry="5" fill={c}/><line x1="42" y1="26" x2="42" y2="10" stroke={c} strokeWidth="1.8"/><path d="M42 10 Q48 13 44 18" fill="none" stroke={c} strokeWidth="1.5"/>
                  <line x1="14" y1="10" x2="42" y2="10" stroke={c} strokeWidth="1.5"/><text x="25" y="8" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">3</text></>,
    qtriplet:   <><ellipse cx="8" cy="27" rx="7" ry="5" fill={c}/><line x1="15" y1="27" x2="15" y2="10" stroke={c} strokeWidth="2"/>
                  <ellipse cx="26" cy="27" rx="7" ry="5" fill={c}/><line x1="33" y1="27" x2="33" y2="10" stroke={c} strokeWidth="2"/>
                  <ellipse cx="44" cy="27" rx="7" ry="5" fill={c}/><line x1="51" y1="27" x2="51" y2="10" stroke={c} strokeWidth="2"/>
                  <line x1="15" y1="10" x2="51" y2="10" stroke={c} strokeWidth="1.5"/><text x="33" y="8" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">3</text></>,
    quint:      <><text x="22" y="22" fontSize="16" fill={c} textAnchor="middle" fontFamily="sans-serif" fontWeight="500">5</text><text x="22" y="33" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">:4</text></>,
    sext:       <><text x="22" y="22" fontSize="16" fill={c} textAnchor="middle" fontFamily="sans-serif" fontWeight="500">6</text><text x="22" y="33" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">:4</text></>,
    sept:       <><text x="22" y="22" fontSize="16" fill={c} textAnchor="middle" fontFamily="sans-serif" fontWeight="500">7</text><text x="22" y="33" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">:4</text></>,
    nine:       <><text x="22" y="22" fontSize="16" fill={c} textAnchor="middle" fontFamily="sans-serif" fontWeight="500">9</text><text x="22" y="33" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">:8</text></>,
    duplet:     <><text x="22" y="22" fontSize="16" fill={c} textAnchor="middle" fontFamily="sans-serif" fontWeight="500">2</text><text x="22" y="33" fontSize="9" fill={c} textAnchor="middle" fontFamily="sans-serif">:3</text></>,
    fusa:       <><ellipse cx="13" cy="28" rx="6" ry="5" fill={c}/><line x1="19" y1="28" x2="19" y2="7" stroke={c} strokeWidth="2"/><path d="M19 7 Q28 10 22 16" fill="none" stroke={c} strokeWidth="1.5"/><path d="M19 12 Q28 15 22 21" fill="none" stroke={c} strokeWidth="1.5"/><path d="M19 17 Q28 20 22 26" fill="none" stroke={c} strokeWidth="1.5"/></>,
    semifusa:   <><ellipse cx="13" cy="29" rx="5" ry="4" fill={c}/><line x1="18" y1="29" x2="18" y2="6" stroke={c} strokeWidth="1.8"/><path d="M18 6 Q26 9 21 14" fill="none" stroke={c} strokeWidth="1.4"/><path d="M18 10 Q26 13 21 18" fill="none" stroke={c} strokeWidth="1.4"/><path d="M18 14 Q26 17 21 22" fill="none" stroke={c} strokeWidth="1.4"/><path d="M18 18 Q26 21 21 26" fill="none" stroke={c} strokeWidth="1.4"/></>,
    breve:      <><rect x="10" y="18" width="24" height="10" fill="none" stroke={c} strokeWidth="2"/><line x1="10" y1="14" x2="10" y2="32" stroke={c} strokeWidth="2.5"/><line x1="34" y1="14" x2="34" y2="32" stroke={c} strokeWidth="2.5"/></>,
    longa:      <><rect x="10" y="16" width="20" height="12" fill="none" stroke={c} strokeWidth="2"/><line x1="10" y1="12" x2="10" y2="32" stroke={c} strokeWidth="2.5"/><line x1="30" y1="28" x2="30" y2="40" stroke={c} strokeWidth="2.5"/></>,
    maxima:     <><rect x="6" y="15" width="30" height="13" fill="none" stroke={c} strokeWidth="2"/><line x1="6" y1="11" x2="6" y2="32" stroke={c} strokeWidth="2.5"/><line x1="36" y1="11" x2="36" y2="32" stroke={c} strokeWidth="2.5"/></>,
  };
  const wide = ["triplet","qtriplet","quint","sext","sept","nine","duplet"].includes(type);
  const w = wide ? 52 : 44;
  return <svg width={w} height="40" viewBox={`0 0 ${w} 38`}>{shapes[type] || null}</svg>;
}

function DivisoesView({ onBack }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? DIVISOES_DATA : DIVISOES_DATA.filter(d => d.cat === filter);
  const sections = filter === "all" ? DIVISOES_SECTIONS : DIVISOES_SECTIONS.filter(s => s.key === filter);

  const filterBtns = [
    { id:"all", label:"Todas" },
    { id:"simples", label:"Simples" },
    { id:"especial", label:"Especiais" },
    { id:"raro", label:"Raras" },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 80px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "7px 12px" }}><ArrowLeft size={16} /> Voltar</button>
        <div style={{ fontWeight: 800, fontSize: "clamp(18px,5vw,22px)", color: "#fff" }}>Divisões rítmicas</div>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {filterBtns.map(b => {
          const active = filter === b.id;
          return (
            <button key={b.id} onClick={() => setFilter(b.id)}
              style={{ fontSize:12, padding:"4px 12px", borderRadius:20, cursor:"pointer", fontFamily:"'Montserrat',sans-serif",
                background: active ? "#eef5f0" : "transparent",
                color: active ? "#0d3d28" : "#6fae8a",
                border: active ? "none" : "1px solid #1d4435" }}>
              {b.label}
            </button>
          );
        })}
      </div>

      <div style={{ background:"#0c2419", border:"1px solid #15392b", borderRadius:14, overflow:"hidden" }}>
        {sections.map(sec => {
          const rows = filtered.filter(d => d.cat === sec.key);
          if (!rows.length) return null;
          return (
            <div key={sec.key}>
              <div style={{ fontSize:11, fontWeight:600, color:"#6fae8a", padding:"10px 16px 4px", letterSpacing:".06em", textTransform:"uppercase", background:"#091f14", borderBottom:"1px solid #15392b", borderTop:"1px solid #15392b" }}>
                {sec.label}
              </div>
              {rows.map(d => (
                <div key={d.rank} style={{ display:"flex", alignItems:"center", borderBottom:"1px solid #15392b", transition:"background .12s", cursor:"default" }}
                  onMouseEnter={e => e.currentTarget.style.background="#0e2c1f"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{ width:32, minWidth:32, textAlign:"center", fontSize:12, color:"#5d917a", padding:"10px 0" }}>{d.rank}</span>
                  <span style={{ width:56, minWidth:56, display:"flex", alignItems:"center", justifyContent:"center", padding:"6px 0" }}>
                    {svgNotaJSX(d.svg, d.cor)}
                  </span>
                  <div style={{ flex:1, padding:"10px 8px" }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#eef5f0" }}>{d.nome}</div>
                    <div style={{ fontSize:12, color:"#5d917a", marginTop:1 }}>{d.desc}</div>
                  </div>
                  <div style={{ width:130, minWidth:130, padding:"10px 12px 10px 0", display:"flex", alignItems:"center" }}>
                    <div style={{ height:5, borderRadius:3, background:"#1d4435", width:"100%", position:"relative" }}>
                      <div style={{ height:"100%", borderRadius:3, background:d.cor, opacity:.75, width:`${d.uso}%` }} />
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:"#5d917a", paddingRight:14, minWidth:36, textAlign:"right" }}>{d.uso}%</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
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
  const [capoSuggested, setCapoSuggested] = useState(song?.capoSuggested || 0);
  const [bpm, setBpm] = useState(song?.bpm || 120);

  // Transpõe todas as seções em N semitons, usando a grafia correta para o tom-alvo.
  const transposeSections = (secs, semitones, targetKey, targetCapo) => {
    if (semitones === 0) return secs;
    const shapeKeyRaw = transposeKey(targetKey, -(Number(targetCapo) || 0), false);
    const useFlatsForShapes = keyUsesFlats(shapeKeyRaw);
    return secs.map(sec => ({
      ...sec,
      content: transposeText(sec.content, semitones, useFlatsForShapes)
    }));
  };

  // Ao mudar o tom real (apenas para cifras já existentes):
  // transpõe o conteúdo pelo delta entre o tom antigo e o novo.
  const handleKeyChange = (newKey) => {
    if (!song) { setKey(newKey); return; }
    const noteIndex = (n) => { let i = NOTES_SHARP.indexOf(n); if (i === -1) i = NOTES_FLAT.indexOf(n); return i; };
    const oldIdx = noteIndex(key);
    const newIdx = noteIndex(newKey);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) { setKey(newKey); return; }
    const raw = ((newIdx - oldIdx) + 12) % 12;
    const semitones = raw > 6 ? raw - 12 : raw; // caminho mais curto
    setSections(prev => transposeSections(prev, semitones, newKey, Number(capoSuggested) || 0));
    setKey(newKey);
  };

  // Ao mudar o capo (apenas para cifras já existentes):
  // para manter o mesmo som real, as formas compensam na direção oposta.
  const handleCapoChange = (newCapo) => {
    if (!song) { setCapoSuggested(newCapo); return; }
    const delta = Number(newCapo) - (Number(capoSuggested) || 0);
    if (delta !== 0) setSections(prev => transposeSections(prev, -delta, key, Number(newCapo)));
    setCapoSuggested(newCapo);
  };
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
    key: song?.key || "C", capoSuggested: song?.capoSuggested || 0, bpm: song?.bpm || 120, timeSig: song?.timeSig || "4/4",
    feel: song?.feel || "", youtube: song?.youtube || "",
    sections: song?.sections?.length ? song.sections : [{ type: "Introdução", label: "", repeat: "", content: "[C] [G] [Am] [F]" }]
  }));
  const isDirty = () => initialSnapshot.current !== JSON.stringify({
    title, artist, category, categoryOther, hymnNumber, key, capoSuggested, bpm, timeSig, feel, youtube, sections
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
      key, capoSuggested: Number(capoSuggested) || 0, bpm: Number(bpm) || 0,
      timeSig, feel: feel.trim(), youtube: youtube.trim(),
      sections: sections.filter(s => s.content.trim() || s.type),
      updatedBy: memberName || "anônimo", updatedAt: Date.now()
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 130px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <button onClick={handleCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 28, color: "#fff" }}>{song?.id ? "Editar cifra" : "Nova cifra"}</h2>
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
          <Field label="Tom (som real)">
            <select value={key} onChange={e => handleKeyChange(e.target.value)} style={inputStyle()}>
              {["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B","Cm","C#m","Dm","D#m","Ebm","Em","Fm","F#m","Gm","G#m","Am","A#m","Bbm","Bm"].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Capo sugerido">
            <select value={capoSuggested} onChange={e => handleCapoChange(Number(e.target.value))} style={inputStyle()}>
              <option value={0}>Sem capo</option>
              {[1,2,3,4,5,6,7,8,9,10,11].map(n => <option key={n} value={n}>{n}ª casa</option>)}
            </select>
          </Field>
          <Field label="BPM"><input type="number" value={bpm} onChange={e => setBpm(e.target.value)} style={inputStyle()} /></Field>
          <Field label="Compasso"><select value={timeSig} onChange={e => setTimeSig(e.target.value)} style={inputStyle()}>{["4/4","3/4","2/4","2/2","6/8","9/8","12/8","3/8","5/4","7/8","5/8","7/4","11/8","15/8","13/8","Livre"].map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Levada"><input value={feel} onChange={e => setFeel(e.target.value)} style={inputStyle()} placeholder="Ex: Balada" /></Field>
        </div>
        {capoSuggested > 0 && (
          <div style={{ fontSize: 12.5, color: "#9fc7b2", background: "rgba(63,174,107,.1)", border: "1px solid #1d4435", borderRadius: 9, padding: "9px 12px", marginTop: 4, marginBottom: 4 }}>
             Digite os acordes nas <strong style={{ color: "#fff" }}>formas que a mão toca com o capo na {capoSuggested}ª casa</strong>. O tom real ({key}) é o som que sai. Quem abrir verá com o capo já aplicado, e o modo contra-baixo mostra o tom real automaticamente.
          </div>
        )}
        <Field label="Link do YouTube (versão original)"><input value={youtube} onChange={e => setYoutube(e.target.value)} style={inputStyle()} placeholder="https://youtube.com/watch?v=…" /></Field>
      </div>

      <div style={{ fontSize: 13.5, color: "#9fc7b2", marginBottom: 14, padding: "12px 16px", background: "#0c2419", borderRadius: 12, border: "1px solid #15392b", lineHeight: 1.7 }}>
        ️ <strong style={{ color: "#fff" }}>Como escrever:</strong> coloque cada acorde entre <strong style={{ color: "#fff" }}>colchetes</strong> <code style={{ color: "#3fae6b" }}>[ ]</code> exatamente na sílaba onde ele entra. Ele flutua livremente sobre a letra, no ponto que você quiser — basta mover o colchete.<br />
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
              placeholder=" Instrução da seção (ex: subir a dinâmica, entra toda a banda, só voz e piano…)"
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
