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
  "prof.gabrielcorrea@gmail.com",
  "leohenriqueleoderio@icloud.com",
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
// ═══════════════════════════════════════════════════════════════
// TEORIA MUSICAL — Reconstrução pedagógica completa
// Progressão: Iniciante → Básico → Intermediário → Avançado
// Cada módulo: Conteúdo + Exercício interativo
// ═══════════════════════════════════════════════════════════════

// ── UTILITÁRIOS MUSICAIS ────────────────────────────────────────
const TM_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TM_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const TM_PT_S  = ['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'];
const TM_PT_F  = ['Dó','Réb','Ré','Mib','Mi','Fá','Solb','Sol','Láb','Lá','Sib','Si'];
const TM_FLAT_SET = new Set([1,3,6,8,10]);
function tmPT(i){ const n=((i%12)+12)%12; return TM_FLAT_SET.has(n)?TM_PT_F[n]:TM_PT_S[n]; }
function tmEN(i){ const n=((i%12)+12)%12; return TM_FLAT_SET.has(n)?TM_FLAT[n]:TM_SHARP[n]; }
function tmNote(root,interval){ return tmPT((root+interval+12)%12); }
function tmNoteEN(root,interval){ return tmEN((root+interval+12)%12); }
function tmRandom(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function tmShuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

// Componente Piano reutilizável
function TmPiano({ root=0, highlight=[], onClick=null, size="md" }) {
  const W = size==="sm"?22:size==="lg"?34:27;
  const H = size==="sm"?64:size==="lg"?96:78;
  const BW= size==="sm"?14:size==="lg"?20:17;
  const BH= size==="sm"?38:size==="lg"?58:47;
  // Teclas brancas: semitons absolutos (relativos a Dó=0)
  const WHITES=[0,2,4,5,7,9,11];
  const BLACKS=[{s:1,p:1},{s:3,p:2},{s:6,p:4},{s:8,p:5},{s:10,p:6}];

  // Converte os semitons relativos ao root para semitons absolutos (0-11, relativos a Dó)
  // highlight contém semitons relativos ao root (ex: [0,4,7] = tríade maior desde o root)
  // precisamos saber quais posições absolutas do teclado acender
  const highlightAbs = new Set(highlight.map(rel => ((root + rel) % 12 + 12) % 12));

  return (
    <div style={{position:"relative",display:"inline-flex",height:H+4,userSelect:"none",flexShrink:0}}>
      {WHITES.map((abs,i)=>{
        const lit = highlightAbs.has(abs);
        // para onClick: retorna o semitom relativo ao root
        const rel = ((abs - root) % 12 + 12) % 12;
        return <div key={i} onClick={()=>onClick&&onClick(rel,abs)} style={{
          width:W,height:H,background:lit?"#7F77DD":"#0d2a1d",
          border:"1px solid #1d4435",borderRadius:"0 0 5px 5px",
          display:"inline-flex",alignItems:"flex-end",justifyContent:"center",
          paddingBottom:3,position:"relative",marginRight:1,
          cursor:onClick?"pointer":"default",transition:"background .1s"
        }}>
          <span style={{fontSize:7,color:lit?"#fff":"#6fae8a",fontWeight:600,textAlign:"center",lineHeight:1}}>
            {tmPT(abs)}
          </span>
        </div>;
      })}
      {BLACKS.map(({s:abs,p})=>{
        const lit = highlightAbs.has(abs);
        const rel = ((abs - root) % 12 + 12) % 12;
        return <div key={abs} onClick={()=>onClick&&onClick(rel,abs)} style={{
          width:BW,height:BH,background:lit?"#534AB7":"#eef5f0",
          borderRadius:"0 0 4px 4px",position:"absolute",top:0,zIndex:2,
          left:p*(W+1)-BW/2,cursor:onClick?"pointer":"default",transition:"background .1s"
        }}/>;
      })}
    </div>
  );
}

// Tom selector compacto
function TmKeyPicker({ value, onChange, label="Tom" }) {
  const keys=[
    {i:0,l:'Dó'},{i:1,l:'Réb'},{i:2,l:'Ré'},{i:3,l:'Mib'},{i:4,l:'Mi'},
    {i:5,l:'Fá'},{i:6,l:'Solb'},{i:7,l:'Sol'},{i:8,l:'Láb'},{i:9,l:'Lá'},
    {i:10,l:'Sib'},{i:11,l:'Si'},
  ];
  return (
    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",
      padding:"10px 12px",background:"#091f14",borderRadius:12,marginBottom:14}}>
      <span style={{fontSize:11,fontWeight:700,color:"#6fae8a",
        textTransform:"uppercase",letterSpacing:".07em",marginRight:4}}>{label}:</span>
      {keys.map(k=>(
        <button key={k.i} onClick={()=>onChange(k.i)} style={{
          fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",
          fontFamily:"'Montserrat',sans-serif",fontWeight:value===k.i?700:400,
          background:value===k.i?"#7F77DD":"transparent",
          color:value===k.i?"#fff":"#9fdabb",
          border:value===k.i?"1px solid #534AB7":"1px solid #1d4435",
          transition:"all .12s"
        }}>{k.l}</button>
      ))}
    </div>
  );
}

// Feedback de exercício
function TmFeedback({ ok, msg }) {
  if (ok===null) return null;
  return (
    <div style={{
      padding:"10px 14px",borderRadius:10,marginTop:10,
      background:ok?"rgba(47,157,99,.15)":"rgba(232,85,77,.15)",
      border:`1px solid ${ok?"#2f9d63":"#e8554d"}`,
      fontSize:13,color:ok?"#3fae6b":"#e8554d",fontWeight:600
    }}>
      {ok ? "✓ " : "✗ "}{msg}
    </div>
  );
}

// Botão de opção do exercício
function TmOpt({ label, onClick, state }) {
  const bg = state==="correct"?"rgba(47,157,99,.2)":state==="wrong"?"rgba(232,85,77,.15)":"transparent";
  const br = state==="correct"?"#2f9d63":state==="wrong"?"#e8554d":"#1d4435";
  const co = state==="correct"?"#3fae6b":state==="wrong"?"#e8554d":"#eef5f0";
  return (
    <button onClick={onClick} disabled={!!state} style={{
      padding:"9px 16px",borderRadius:9,border:`1px solid ${br}`,
      background:bg,color:co,cursor:state?"default":"pointer",
      fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:state==="correct"?700:400,
      transition:"all .15s",textAlign:"left"
    }}>{label}</button>
  );
}

// Container de exercício com gerador "novo"
function TmExercicio({ title, onNew, children, feedback }) {
  return (
    <div style={{background:"#091f14",border:"1px solid #2f4a38",borderRadius:14,padding:"16px 14px 18px",marginTop:18}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <span style={{fontWeight:800,fontSize:14,color:"#fff"}}>Exercício — {title}</span>
        <button onClick={onNew} style={{
          fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #1d4435",
          background:"transparent",color:"#6fae8a",cursor:"pointer",
          fontFamily:"'Montserrat',sans-serif"
        }}>Novo</button>
      </div>
      {children}
      {feedback}
    </div>
  );
}

// Estilos compartilhados
const tmS = {
  h3:  {fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",color:"#9fdabb",margin:"0 0 8px",letterSpacing:.3},
  p:   {fontSize:"clamp(12px,3.3vw,13.5px)",color:"#b0ccbc",lineHeight:1.65,margin:"0 0 10px"},
  note:{fontSize:"clamp(11px,2.8vw,12px)",color:"#6fae8a",fontStyle:"italic",marginTop:6,lineHeight:1.5},
  card:{background:"#0a2b1e",border:"1px solid #1d4435",borderRadius:11,padding:"11px 13px",marginBottom:9},
  hl:  {background:"#0a2b1e",border:"1px solid #1d4435",borderRadius:10,padding:"10px 12px",marginBottom:10,
        fontSize:"clamp(12px,3.2vw,13px)",color:"#9fdabb",lineHeight:1.6},
  mono:{fontFamily:"'Space Mono',monospace,monospace"},
  chord:{display:"inline-block",background:"rgba(47,157,99,.15)",color:"#3fae6b",fontWeight:700,
         borderRadius:6,padding:"1px 7px",marginRight:4,fontFamily:"monospace",
         fontSize:"clamp(11px,3vw,13px)"},
  table:{width:"100%",borderCollapse:"collapse",fontSize:"clamp(11px,3vw,13px)",color:"#b0ccbc"},
  th:  {textAlign:"left",padding:"7px 10px",background:"#0a2b1e",color:"#6fae8a",
        fontWeight:600,fontSize:"clamp(10px,2.6vw,11.5px)",borderBottom:"1px solid #1d4435"},
  td:  {padding:"7px 10px",borderBottom:"1px solid #132e22"},
  grid2:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,150px),1fr))",gap:8,marginBottom:10},
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 1 — O Som e a Nota
// ═══════════════════════════════════════════════════════════════
function Mod01_Som() {
  const [sel, setSel] = React.useState(null);
  // exercício
  const [qNote, setQNote] = React.useState(null);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  function newQ() {
    setQNote(tmRandom(0,11));
    setFb(null); setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i) {
    if (fb) return;
    const correct = i === qNote;
    const os = {};
    os[i] = correct ? "correct" : "wrong";
    if (!correct) os[qNote] = "correct";
    setOptState(os);
    setFb({ ok:correct, msg: correct ? `Correto! É ${tmPT(qNote)}.` : `Errado. Era ${tmPT(qNote)}.` });
  }

  const opts = tmShuffle([qNote, ...tmShuffle([...Array(12).keys()].filter(x=>x!==qNote)).slice(0,3)]);

  const notes12 = [
    {n:"Dó (C)",     s:0,  desc:"Nota âncora — começo de tudo na teoria ocidental."},
    {n:"Dó#/Réb",    s:1,  desc:"A mesma tecla preta com dois nomes (enarmonia)."},
    {n:"Ré (D)",     s:2,  desc:"Segunda nota da escala maior de Dó."},
    {n:"Ré#/Mib",    s:3,  desc:"Tecla preta entre Ré e Mi."},
    {n:"Mi (E)",     s:4,  desc:"Terceira nota — não tem tecla preta após ela."},
    {n:"Fá (F)",     s:5,  desc:"Quarta nota — não tem tecla preta antes dela."},
    {n:"Fá#/Solb",   s:6,  desc:"Trítono de Dó — o intervalo mais tenso."},
    {n:"Sol (G)",    s:7,  desc:"Quinta nota — a mais estável depois da oitava."},
    {n:"Sol#/Láb",   s:8,  desc:"Tecla preta entre Sol e Lá."},
    {n:"Lá (A)",     s:9,  desc:"Base do sistema de afinação (A = 440 Hz)."},
    {n:"Lá#/Sib",    s:10, desc:"Tecla preta entre Lá e Si."},
    {n:"Si (B)",     s:11, desc:"Última nota — não tem tecla preta após ela."},
  ];

  return (
    <div>
      <p style={tmS.p}>A música ocidental divide a oitava em <strong style={{color:"#fff"}}>12 notas</strong> igualmente espaçadas (sistema temperado). Cada espaço é um <strong style={{color:"#fff"}}>semitom</strong> — a menor distância possível.</p>

      <div style={{...tmS.hl,marginBottom:14}}>
        <strong>Piano:</strong> as teclas brancas são as 7 notas naturais (Dó Ré Mi Fá Sol Lá Si). As teclas pretas são os 5 sustenidos/bemóis. Juntas formam as 12 notas.
      </div>

      <div style={{textAlign:"center",padding:"14px 0",overflowX:"auto"}}>
        <TmPiano root={0} highlight={sel!==null?[sel]:[]} onClick={(rel)=>setSel(sel===rel?null:rel)} size="lg"/>
      </div>
      {sel!==null && (
        <div style={{...tmS.card,textAlign:"center",marginTop:8}}>
          <span style={{fontSize:20,fontWeight:800,color:"#fff"}}>{tmPT(sel)}</span>
          <span style={{fontSize:13,color:"#6fae8a",marginLeft:8}}>{TM_SHARP[sel] !== TM_FLAT[sel] ? `${TM_SHARP[sel]} / ${TM_FLAT[sel]}` : TM_SHARP[sel]}</span>
          <div style={{fontSize:12,color:"#9fdabb",marginTop:4}}>
            {notes12.find(n=>n.s===sel)?.desc}
          </div>
        </div>
      )}
      {!sel && <p style={{...tmS.note,textAlign:"center"}}>Toque em uma tecla para ver o nome da nota.</p>}

      <h3 style={{...tmS.h3,marginTop:16}}>As 12 notas</h3>
      <div style={{overflowX:"auto"}}>
        <table style={tmS.table}>
          <thead><tr>
            <th style={tmS.th}>Nome (PT)</th>
            <th style={tmS.th}>Cifra (EN)</th>
            <th style={tmS.th}>Tipo</th>
          </tr></thead>
          <tbody>
            {notes12.map(n=>(
              <tr key={n.s} style={{cursor:"pointer",background:sel===n.s?"#0a2b1e":"transparent"}}
                onClick={()=>setSel(sel===n.s?null:n.s)}>
                <td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{n.n}</td>
                <td style={{...tmS.td,...tmS.mono,color:"#3fae6b"}}>{TM_SHARP[n.s]}{TM_SHARP[n.s]!==TM_FLAT[n.s]?" / "+TM_FLAT[n.s]:""}</td>
                <td style={{...tmS.td,fontSize:12,color:"#6fae8a"}}>{n.s%2===1||n.s===6||n.s===8||n.s===10?"Acidental (♯/♭)":"Natural"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{...tmS.h3,marginTop:16}}>Enarmonia</h3>
      <p style={tmS.p}>Uma mesma nota pode ter dois nomes. <strong style={{color:"#fff"}}>Dó# e Réb</strong> são a mesma tecla preta — a diferença está apenas no contexto musical (tonalidade).</p>

      <TmExercicio title="Identificar nota" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:12}}>Qual é a nota destacada no piano?</p>
        {qNote!==null && (
          <>
            <div style={{textAlign:"center",marginBottom:14}}>
              <TmPiano root={0} highlight={[qNote]} size="md"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {opts.map((opt,i)=>(
                <TmOpt key={i} label={tmPT(opt)} state={optState[opt]||null} onClick={()=>answer(opt)}/>
              ))}
            </div>
          </>
        )}
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 2 — Ritmo e Compasso
// ═══════════════════════════════════════════════════════════════
function Mod02_Ritmo() {
  const [beat, setBeat] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [compasso, setCompasso] = React.useState("4/4");
  const [bpm, setBpm] = React.useState(80);
  // exercício
  const [qComp, setQComp] = React.useState(null);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const comps = ["4/4","3/4","2/4","6/8","2/2"];

  React.useEffect(()=>{
    if (!playing){setBeat(0);return;}
    const beats = parseInt(compasso.split("/")[0]);
    const ms = compasso==="6/8" ? (60000/bpm)/3 : 60000/bpm;
    const iv = setInterval(()=>setBeat(b=>(b+1)%beats),ms);
    return ()=>clearInterval(iv);
  },[playing,bpm,compasso]);

  function newQ(){
    const c=comps[tmRandom(0,comps.length-1)];
    setQComp(c); setFb(null); setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answerComp(c){
    if(fb)return;
    const ok=c===qComp;
    const os={};
    os[c]=ok?"correct":"wrong";
    if(!ok)os[qComp]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! O padrão é ${qComp}.`:`Errado. Era ${qComp}.`});
  }

  const figuras=[
    {nome:"Semibreve",   valor:"4",  duracao:"4 tempos",  svg:<svg width="28" height="28"><ellipse cx="14" cy="18" rx="10" ry="7" fill="none" stroke="#3fae6b" strokeWidth="2"/></svg>},
    {nome:"Mínima",      valor:"2",  duracao:"2 tempos",  svg:<svg width="28" height="28"><ellipse cx="12" cy="20" rx="8" ry="5" fill="none" stroke="#3fae6b" strokeWidth="2"/><line x1="19" y1="20" x2="19" y2="4" stroke="#3fae6b" strokeWidth="2"/></svg>},
    {nome:"Semínima",    valor:"1",  duracao:"1 tempo",   svg:<svg width="28" height="28"><ellipse cx="12" cy="20" rx="8" ry="5" fill="#3fae6b"/><line x1="19" y1="20" x2="19" y2="4" stroke="#3fae6b" strokeWidth="2"/></svg>},
    {nome:"Colcheia",    valor:"½",  duracao:"½ tempo",   svg:<svg width="28" height="28"><ellipse cx="12" cy="20" rx="8" ry="5" fill="#3fae6b"/><line x1="19" y1="20" x2="19" y2="4" stroke="#3fae6b" strokeWidth="2"/><path d="M19 4 Q28 8 22 14" fill="none" stroke="#3fae6b" strokeWidth="1.8"/></svg>},
    {nome:"Semicolcheia",valor:"¼",  duracao:"¼ tempo",   svg:<svg width="28" height="28"><ellipse cx="12" cy="20" rx="8" ry="5" fill="#3fae6b"/><line x1="19" y1="20" x2="19" y2="4" stroke="#3fae6b" strokeWidth="2"/><path d="M19 4 Q28 8 22 13" fill="none" stroke="#3fae6b" strokeWidth="1.8"/><path d="M19 7 Q28 11 22 16" fill="none" stroke="#3fae6b" strokeWidth="1.8"/></svg>},
    {nome:"Pausa (Semi)",valor:"4p", duracao:"4 tempos",  svg:<svg width="28" height="28"><rect x="6" y="10" width="16" height="6" fill="#3fae6b"/></svg>},
    {nome:"Pausa (Mín)", valor:"2p", duracao:"2 tempos",  svg:<svg width="28" height="28"><rect x="6" y="14" width="16" height="6" fill="#3fae6b"/></svg>},
    {nome:"Pausa (Sem)", valor:"1p", duracao:"1 tempo",   svg:<svg width="28" height="28"><line x1="14" y1="8" x2="14" y2="20" stroke="#3fae6b" strokeWidth="2"/><path d="M14 20 Q10 16 8 12" fill="none" stroke="#3fae6b" strokeWidth="1.8"/></svg>},
  ];

  const beats_count = parseInt(compasso.split("/")[0]);
  const qPattern = qComp ? (() => {
    const b=parseInt(qComp.split("/")[0]);
    return Array.from({length:b},(_,i)=>i===0?"forte":"fraco");
  })() : [];

  return (
    <div>
      <p style={tmS.p}>O <strong style={{color:"#fff"}}>ritmo</strong> organiza os sons no tempo. O <strong style={{color:"#fff"}}>compasso</strong> divide o tempo em grupos regulares com tempos fortes e fracos.</p>

      <h3 style={tmS.h3}>Figuras rítmicas</h3>
      <p style={tmS.p}>Cada figura representa uma duração. A referência é a semínima = 1 tempo.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,140px),1fr))",gap:8,marginBottom:16}}>
        {figuras.map(f=>(
          <div key={f.nome} style={tmS.card}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {f.svg}
              <div>
                <div style={{fontWeight:700,fontSize:"clamp(11px,3vw,13px)",color:"#eef5f0"}}>{f.nome}</div>
                <div style={{fontSize:"clamp(10px,2.6vw,11px)",color:"#6fae8a"}}>{f.duracao}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={tmS.h3}>Fórmulas de compasso</h3>
      <p style={tmS.p}>O número de cima indica <strong style={{color:"#fff"}}>quantos tempos</strong> por compasso. O de baixo indica <strong style={{color:"#fff"}}>qual figura</strong> vale 1 tempo (4 = semínima, 8 = colcheia).</p>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {comps.map(c=>(
          <button key={c} onClick={()=>{setCompasso(c);setPlaying(false);setBeat(0);}} style={{
            fontSize:14,padding:"6px 14px",borderRadius:9,cursor:"pointer",fontWeight:700,
            fontFamily:"'Space Mono',monospace",
            background:compasso===c?"#7F77DD":"transparent",
            color:compasso===c?"#fff":"#9fdabb",
            border:compasso===c?"1px solid #534AB7":"1px solid #1d4435"
          }}>{c}</button>
        ))}
      </div>

      {/* Metrônomo visual */}
      <div style={{...tmS.card,padding:"14px 16px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,color:"#fff",fontSize:13}}>Metrônomo visual — {compasso}</span>
          <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
            <span style={{fontSize:11,color:"#6fae8a"}}>BPM:</span>
            <input type="range" min={40} max={200} value={bpm} onChange={e=>setBpm(+e.target.value)}
              style={{width:80,accentColor:"#3fae6b"}}/>
            <span style={{fontSize:12,color:"#9fdabb",minWidth:28}}>{bpm}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:12}}>
          {Array.from({length:beats_count},(_,i)=>(
            <div key={i} style={{
              width:44,height:44,borderRadius:"50%",
              background:playing&&beat===i?(i===0?"#e8554d":"#7F77DD"):"#0a2b1e",
              border:`2px solid ${i===0?"#e8554d55":"#7F77DD44"}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:i===0?18:14,fontWeight:700,color:playing&&beat===i?"#fff":"#5d917a",
              transition:"background .05s"
            }}>{i+1}</div>
          ))}
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={()=>setPlaying(p=>!p)} style={{
            padding:"8px 22px",borderRadius:10,border:"none",cursor:"pointer",
            background:playing?"#fff":"#3fae6b",color:playing?"#0d3d28":"#fff",
            fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13
          }}>{playing?"Parar":"Iniciar"}</button>
        </div>
      </div>

      <TmExercicio title="Identificar compasso" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Observe o padrão de tempos e identifique o compasso:</p>
        {qComp && (
          <>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:14}}>
              {qPattern.map((tipo,i)=>(
                <div key={i} style={{
                  width:40,height:40,borderRadius:"50%",
                  background:tipo==="forte"?"rgba(232,85,77,.2)":"rgba(127,119,221,.15)",
                  border:`2px solid ${tipo==="forte"?"#e8554d55":"#7F77DD44"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,color:tipo==="forte"?"#e8554d":"#7F77DD"
                }}>{tipo==="forte"?"F":"f"}</div>
              ))}
            </div>
            <p style={{...tmS.note,textAlign:"center",marginBottom:10}}>
              F = tempo forte · f = tempo fraco · {qPattern.length} tempo{qPattern.length>1?"s":""}
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {comps.map(c=>(
                <TmOpt key={c} label={c} state={optState[c]||null} onClick={()=>answerComp(c)}/>
              ))}
            </div>
          </>
        )}
      </TmExercicio>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// MÓDULO 3 — Intervalos
// ═══════════════════════════════════════════════════════════════
function Mod03_Intervalos() {
  const [root, setRoot] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});
  const [qRoot, setQRoot] = React.useState(0);
  const [qTarget, setQTarget] = React.useState(7);

  const intervalos=[
    {s:0, q:"Uníssono",     sigla:"P1", semi:0,  qual:"Perfeito",desc:"Mesma nota. Som absolutamente idêntico."},
    {s:1, q:"2ª menor",     sigla:"m2", semi:1,  qual:"Menor",  desc:"Máxima tensão. Meio tom — escorregamento cromático."},
    {s:2, q:"2ª maior",     sigla:"M2", semi:2,  qual:"Maior",  desc:"Tom inteiro. A distância entre notas adjacentes na escala maior."},
    {s:3, q:"3ª menor",     sigla:"m3", semi:3,  qual:"Menor",  desc:"Caráter menor, melancólico. Pilar dos acordes menores."},
    {s:4, q:"3ª maior",     sigla:"M3", semi:4,  qual:"Maior",  desc:"Caráter maior, brilhante. Pilar dos acordes maiores."},
    {s:5, q:"4ª justa",     sigla:"P4", semi:5,  qual:"Perfeito",desc:"Estável e aberto. \"Aqui está a nota\" (Dó → Fá)."},
    {s:6, q:"Trítono",      sigla:"TT", semi:6,  qual:"Aum/dim", desc:"Máxima dissonância. Divide a oitava ao meio. Dominante quer resolver."},
    {s:7, q:"5ª justa",     sigla:"P5", semi:7,  qual:"Perfeito",desc:"O mais estável depois da oitava. Base dos acordes de poder."},
    {s:8, q:"6ª menor",     sigla:"m6", semi:8,  qual:"Menor",  desc:"Melancolicamente belo. Inverso da 3ª maior."},
    {s:9, q:"6ª maior",     sigla:"M6", semi:9,  qual:"Maior",  desc:"Doce e aberto. Inverso da 3ª menor."},
    {s:10,q:"7ª menor",     sigla:"m7",semi:10,  qual:"Menor",  desc:"Tensão suave e jazzística. Pede resolução, mas não urgente."},
    {s:11,q:"7ª maior",     sigla:"M7",semi:11,  qual:"Maior",  desc:"Tensão aguda e sofisticada. Muito usado em jazz e bossa nova."},
    {s:12,q:"Oitava",       sigla:"P8",semi:12,  qual:"Perfeito",desc:"Mesma nota uma oitava acima. Fecha o ciclo completo."},
  ];

  function newQ(){
    const r=tmRandom(0,11); let t;
    do{ t=tmRandom(1,11); }while(t===r);
    setQRoot(r); setQTarget(t); setFb(null); setOptState({});
  }
  React.useEffect(()=>{ newQ(); setSel(null); },[]);

  function answer(iv){
    if(fb)return;
    const dist=((qTarget-qRoot+12)%12);
    const correct=iv.semi===dist||(iv.semi===12&&dist===0);
    const os={};
    os[iv.sigla]=correct?"correct":"wrong";
    const correctIv=intervalos.find(x=>(x.semi===dist)||(x.semi===12&&dist===0));
    if(!correct&&correctIv)os[correctIv.sigla]="correct";
    setOptState(os);
    setFb({ok:correct,msg:correct?`Correto! ${tmPT(qRoot)}→${tmPT(qTarget)} = ${correctIv?.q} (${dist} semitons).`
      :`Errado. A distância de ${tmPT(qRoot)} a ${tmPT(qTarget)} é ${dist} semitom(s) = ${correctIv?.q}.`});
  }

  const selIv = intervalos.find(x=>x.s===sel);
  const qDist = ((qTarget-qRoot+12)%12);
  const qIvName = intervalos.find(x=>x.semi===qDist)?.q||"";
  const opts6 = tmShuffle(intervalos.filter(x=>x.semi<=12)).slice(0,6);
  const correct6 = intervalos.find(x=>x.semi===qDist);
  const opts = tmShuffle([...new Set([correct6,...opts6.filter(x=>x!==correct6)].slice(0,6).map(x=>x))]);

  return (
    <div>
      <p style={tmS.p}>Um <strong style={{color:"#fff"}}>intervalo</strong> é a distância entre duas notas, medida em semitons. Todo acorde e toda escala é construído a partir de intervalos.</p>

      <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSel(null);}} label="Raiz"/>

      <div style={{textAlign:"center",overflowX:"auto",marginBottom:10}}>
        <TmPiano root={root} highlight={sel!==null?[sel]:sel===0?[0]:[]} size="md"/>
      </div>

      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
        {intervalos.map(iv=>(
          <button key={iv.sigla} onClick={()=>setSel(sel===iv.s?null:iv.s)} style={{
            fontSize:12,padding:"3px 9px",borderRadius:8,cursor:"pointer",
            fontFamily:"'Space Mono',monospace",fontWeight:sel===iv.s?700:400,
            background:sel===iv.s?"#7F77DD":"transparent",
            color:sel===iv.s?"#fff":"#9fdabb",
            border:sel===iv.s?"1px solid #534AB7":"1px solid #1d4435"
          }}>{iv.sigla}</button>
        ))}
      </div>

      {selIv && (
        <div style={{...tmS.card,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>
            {selIv.sigla} — {selIv.q}
            <span style={{color:"#6fae8a",fontWeight:400,fontSize:12,marginLeft:8}}>
              {selIv.semi} semitom{selIv.semi!==1?"s":""} · {selIv.qual}
            </span>
          </div>
          <div style={{fontFamily:"monospace",fontSize:14,color:"#3fae6b",fontWeight:700,marginBottom:8}}>
            {tmPT(root)} → {tmPT(root+selIv.semi)}
          </div>
          <TmPiano root={root} highlight={[0,Math.min(selIv.semi%12,11)].filter((v,i,a)=>a.indexOf(v)===i)} size="sm"/>
          <p style={{...tmS.p,marginTop:8,marginBottom:0}}>{selIv.desc}</p>
        </div>
      )}

      <div style={{overflowX:"auto",marginBottom:6}}>
        <table style={tmS.table}>
          <thead><tr>
            <th style={tmS.th}>Sigla</th><th style={tmS.th}>Nome</th>
            <th style={tmS.th}>Semitons</th><th style={tmS.th}>Qualidade</th>
          </tr></thead>
          <tbody>
            {intervalos.map(iv=>(
              <tr key={iv.sigla} onClick={()=>setSel(iv.s)} style={{cursor:"pointer"}}>
                <td style={{...tmS.td,...tmS.mono,color:"#9fdabb",fontWeight:700}}>{iv.sigla}</td>
                <td style={{...tmS.td,color:"#eef5f0"}}>{iv.q}</td>
                <td style={{...tmS.td,color:"#3fae6b",fontWeight:700}}>{iv.semi}</td>
                <td style={{...tmS.td,fontSize:12,color:"#6fae8a"}}>{iv.qual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TmExercicio title="Nomear intervalo" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Qual é o intervalo entre as duas notas destacadas?</p>
        <div style={{textAlign:"center",marginBottom:12,overflowX:"auto"}}>
          <TmPiano root={qRoot} highlight={[0,qDist%12]} size="md"/>
          <div style={{fontSize:13,color:"#9fdabb",marginTop:6}}>
            <span style={{color:"#7F77DD",fontWeight:700}}>{tmPT(qRoot)}</span>
            {" → "}
            <span style={{color:"#7F77DD",fontWeight:700}}>{tmPT(qTarget)}</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {opts.map(iv=>(
            <TmOpt key={iv.sigla} label={`${iv.sigla} — ${iv.q}`}
              state={optState[iv.sigla]||null} onClick={()=>answer(iv)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 4 — Escalas
// ═══════════════════════════════════════════════════════════════
function Mod04_Escalas() {
  const [root, setRoot] = React.useState(0);
  const [selScale, setSelScale] = React.useState("major");
  const [qRoot, setQRoot] = React.useState(0);
  const [qScale, setQScale] = React.useState("major");
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});
  const [selNotes, setSelNotes] = React.useState([]);

  const escalas={
    major:    {label:"Maior",            ivs:[0,2,4,5,7,9,11], formula:"T T S T T T S",  desc:"Alegre, estável e brilhante. A base da tonalidade ocidental.",  ex:"Hinos diatônicos, pop, \"Parabéns\""},
    nat_min:  {label:"Menor natural",    ivs:[0,2,3,5,7,8,10], formula:"T S T T S T T",  desc:"Melancólica e expressiva. Par relativo da escala maior.",        ex:"\"Summertime\", baladas, \"Nothing Else Matters\""},
    harm_min: {label:"Menor harmônica",  ivs:[0,2,3,5,7,8,11], formula:"T S T T S T½ S", desc:"7º grau elevado — tensão dramática, som árabe e flamengoo.",    ex:"Música clássica, metal, flamenco"},
    mel_min:  {label:"Menor melódica",   ivs:[0,2,3,5,7,9,11], formula:"T S T T T T S",  desc:"6º e 7º elevados — suaviza o salto da harmônica.",              ex:"Jazz, música clássica, solos"},
    pent_maj: {label:"Pentatônica Maior",ivs:[0,2,4,7,9],      formula:"T T T½ T T½",    desc:"5 notas sem meios-tons — universalmente agradável.",             ex:"Pop, folk, blues, rock, música asiática"},
    pent_min: {label:"Pentatônica Menor",ivs:[0,3,5,7,10],     formula:"T½ T T T½ T",   desc:"A mais usada para solos de guitarra de todos os tempos.",        ex:"Blues, rock, jazz, samba"},
    blues:    {label:"Blues",            ivs:[0,3,5,6,7,10],   formula:"Pent. menor + ♭5",desc:"A nota azul (trítono) dá o caráter tenso e expressivo do blues.",ex:"Blues, jazz, rock'n'roll"},
    modes:    null, // divider
  };

  const sc = escalas[selScale];
  const notes = sc?.ivs.map(n=>tmPT((root+n+12)%12))||[];
  const notesEN = sc?.ivs.map(n=>tmNoteEN(root,n))||[];

  const scaleIds = Object.keys(escalas).filter(k=>k!=="modes");

  function newQ(){
    const ids=scaleIds;
    const s=ids[tmRandom(0,ids.length-1)];
    const r=tmRandom(0,11);
    setQRoot(r);setQScale(s);setFb(null);setOptState({});setSelNotes([]);
  }
  React.useEffect(()=>{ newQ(); },[]);

  function toggleNote(semi){
    if(fb)return;
    const qsc=escalas[qScale];
    setSelNotes(prev=>prev.includes(semi)?prev.filter(x=>x!==semi):[...prev,semi]);
  }
  function checkAnswer(){
    if(fb)return;
    const qsc=escalas[qScale];
    const correct=JSON.stringify([...selNotes].sort((a,b)=>a-b))===JSON.stringify([...qsc.ivs].sort((a,b)=>a-b));
    setFb({ok:correct,msg:correct?`Correto! Essa é a escala de ${tmPT(qRoot)} ${qsc.label}.`
      :`Não é bem isso. A escala de ${tmPT(qRoot)} ${qsc.label} usa: ${qsc.ivs.map(n=>tmPT((qRoot+n)%12)).join(" ")}.`});
    if(!correct){setOptState({wrong:true});}
  }

  return (
    <div>
      <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>escala</strong> é uma sequência de notas em ordem ascendente com um padrão fixo de tons (T) e semitons (S). Cada escala tem um caráter sonoro único.</p>

      <TmKeyPicker value={root} onChange={v=>{setRoot(v);}} label="Tom"/>

      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {scaleIds.map(id=>(
          <button key={id} onClick={()=>setSelScale(id)} style={{
            fontSize:12,padding:"4px 11px",borderRadius:8,cursor:"pointer",
            fontFamily:"'Montserrat',sans-serif",fontWeight:selScale===id?700:400,
            background:selScale===id?"#7F77DD":"transparent",
            color:selScale===id?"#fff":"#9fdabb",
            border:selScale===id?"1px solid #534AB7":"1px solid #1d4435"
          }}>{escalas[id].label}</button>
        ))}
      </div>

      {sc && (
        <div style={tmS.card}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
            <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{tmPT(root)} {sc.label}</span>
            <span style={{fontSize:11,...tmS.mono,color:"#6fae8a"}}>{sc.formula}</span>
          </div>
          <div style={{...tmS.mono,fontSize:15,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10}}>
            {notes.join("  ")}
          </div>
          <div style={{marginBottom:10,overflowX:"auto"}}>
            <TmPiano root={root} highlight={sc.ivs} size="sm"/>
          </div>
          <p style={{...tmS.p,marginBottom:3}}>{sc.desc}</p>
          <p style={{...tmS.note,margin:0}}>Ex: {sc.ex}</p>
        </div>
      )}

      <TmExercicio title="Montar a escala" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>
          Monte a escala de <strong style={{color:"#fff"}}>{tmPT(qRoot)} {escalas[qScale]?.label}</strong> selecionando as teclas corretas:
        </p>
        <p style={{...tmS.note,marginBottom:10}}>Fórmula: <span style={tmS.mono}>{escalas[qScale]?.formula}</span></p>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:10}}>
          <TmPiano root={qRoot} highlight={selNotes} onClick={toggleNote} size="md"/>
        </div>
        <div style={{fontSize:13,color:"#9fdabb",marginBottom:10,minHeight:20}}>
          Selecionadas: {selNotes.map(n=>tmPT((qRoot+n)%12)).join("  ")||"—"}
        </div>
        {!fb && (
          <button onClick={checkAnswer} style={{
            padding:"8px 18px",borderRadius:9,border:"none",cursor:"pointer",
            background:"#3fae6b",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13
          }}>Verificar</button>
        )}
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 5 — Acordes
// ═══════════════════════════════════════════════════════════════
function Mod05_Acordes() {
  const [root, setRoot] = React.useState(0);
  const [selAc, setSelAc] = React.useState("maj");
  const [qRoot, setQRoot] = React.useState(0);
  const [qAc, setQAc] = React.useState("maj");
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const acordes={
    maj:   {label:"Maior",         s:[0,4,7],     f:"1–3–5",        desc:"Estável e brilhante. A base de toda tonalidade maior.",     exemplo:"C, G, D, F"},
    min:   {label:"Menor",         s:[0,3,7],     f:"1–♭3–5",       desc:"Expressivo e melancólico. Base da tonalidade menor.",       exemplo:"Am, Em, Dm"},
    dim:   {label:"Diminuto",      s:[0,3,6],     f:"1–♭3–♭5",      desc:"Máxima tensão — todos os intervalos são de 3 semitons.",   exemplo:"Bdim, F#dim"},
    aug:   {label:"Aumentado",     s:[0,4,8],     f:"1–3–#5",       desc:"Suspenso e misterioso — muito usado em modulações.",       exemplo:"Caug"},
    sus2:  {label:"Sus2",          s:[0,2,7],     f:"1–2–5",        desc:"Aberto e ambíguo — sem terça definida.",                   exemplo:"Csus2, Dsus2"},
    sus4:  {label:"Sus4",          s:[0,5,7],     f:"1–4–5",        desc:"Quer resolver — muito usado antes do acorde maior.",      exemplo:"Gsus4"},
    dom7:  {label:"Dominante 7ª",  s:[0,4,7,10],  f:"1–3–5–♭7",    desc:"O motor da harmonia — quer resolver na tônica com urgência.",exemplo:"G7, D7, A7"},
    maj7:  {label:"Maior 7ª",      s:[0,4,7,11],  f:"1–3–5–7",     desc:"Suave e sofisticado. Muito usado em jazz e bossa nova.",   exemplo:"Cmaj7, Fmaj7"},
    min7:  {label:"Menor 7ª",      s:[0,3,7,10],  f:"1–♭3–5–♭7",   desc:"Flutuante e jazzístico. O acorde do jazz por excelência.", exemplo:"Am7, Dm7, Em7"},
    dim7:  {label:"Dim 7ª",        s:[0,3,6,9],   f:"1–♭3–♭5–♭♭7", desc:"Completamente simétrico — 4 notas equidistantes.",          exemplo:"Bdim7"},
    m7b5:  {label:"m7♭5 (meio-dim)",s:[0,3,6,10], f:"1–♭3–♭5–♭7",  desc:"Meio-diminuto — II grau na cadência II-V-I menor.",        exemplo:"Bm7♭5"},
    add9:  {label:"Add9",          s:[0,4,7,14],  f:"1–3–5–9",     desc:"Acorde maior com 9ª adicionada — fullness sem complexidade.",exemplo:"Cadd9, Gadd9"},
  };

  const acIds=Object.keys(acordes);
  const ac=acordes[selAc];
  const realS=ac.s.map(n=>n%12);
  const notesPT=realS.map(n=>tmPT((root+n)%12));
  const notesEN=realS.map(n=>tmNoteEN(root,n));

  function newQ(){
    const ids=acIds;
    const a=ids[tmRandom(0,ids.length-1)];
    const r=tmRandom(0,11);
    setQRoot(r);setQAc(a);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(id){
    if(fb)return;
    const ok=id===qAc;
    const os={};os[id]=ok?"correct":"wrong";
    if(!ok)os[qAc]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! ${tmPT(qRoot)} ${acordes[qAc].label}.`
      :`Errado. Era ${tmPT(qRoot)} ${acordes[qAc].label} (${acordes[qAc].f}).`});
  }

  const qAcObj=acordes[qAc];
  const qNotesHL=qAcObj.s.map(n=>n%12);
  const opts=tmShuffle(acIds).slice(0,6);
  if(!opts.includes(qAc))opts[0]=qAc;
  const optsShuf=tmShuffle(opts);

  return (
    <div>
      <p style={tmS.p}>Um <strong style={{color:"#fff"}}>acorde</strong> é a combinação simultânea de 3 ou mais notas. As <strong style={{color:"#fff"}}>tríades</strong> têm 3 notas; as <strong style={{color:"#fff"}}>tétrades</strong> têm 4. Cada tipo tem uma fórmula de intervalos fixa.</p>

      <TmKeyPicker value={root} onChange={v=>{setRoot(v);}} label="Tom"/>

      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {acIds.map(id=>(
          <button key={id} onClick={()=>setSelAc(id)} style={{
            fontSize:12,padding:"4px 10px",borderRadius:8,cursor:"pointer",
            fontFamily:"'Montserrat',sans-serif",fontWeight:selAc===id?700:400,
            background:selAc===id?"#7F77DD":"transparent",
            color:selAc===id?"#fff":"#9fdabb",
            border:selAc===id?"1px solid #534AB7":"1px solid #1d4435"
          }}>{acordes[id].label}</button>
        ))}
      </div>

      {ac && (
        <div style={tmS.card}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontWeight:800,fontSize:16,color:"#fff"}}>{tmNoteEN(root,0)}{selAc==="maj"?"":selAc==="min"?"m":selAc==="dom7"?"7":selAc==="maj7"?"maj7":selAc==="min7"?"m7":selAc==="dim"?"dim":selAc==="aug"?"aug":selAc==="sus2"?"sus2":selAc==="sus4"?"sus4":selAc==="dim7"?"dim7":selAc==="m7b5"?"m7♭5":"add9"}</span>
            <span style={{fontSize:11,...tmS.mono,color:"#6fae8a"}}>{ac.f}</span>
          </div>
          <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,marginBottom:10,letterSpacing:.5}}>
            {notesPT.join("  ")} <span style={{color:"#5d917a",fontSize:12,fontWeight:400}}>({notesEN.join(" – ")})</span>
          </div>
          <div style={{overflowX:"auto",marginBottom:10}}>
            <TmPiano root={root} highlight={realS} size="sm"/>
          </div>
          <p style={{...tmS.p,marginBottom:3}}>{ac.desc}</p>
          <p style={{...tmS.note,margin:0}}>Exemplos: {ac.exemplo}</p>
        </div>
      )}

      <h3 style={{...tmS.h3,marginTop:14}}>Inversões</h3>
      <p style={tmS.p}>Quando uma nota diferente da fundamental fica no baixo, criamos uma <strong style={{color:"#fff"}}>inversão</strong>. Escrita como <span style={tmS.chord}>C/E</span> (Dó com Mi no baixo). Suaviza a progressão e cria linhas melódicas no baixo.</p>

      <TmExercicio title="Identificar acorde" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>
          Que tipo de acorde está no piano? (tom: <strong style={{color:"#3fae6b"}}>{tmPT(qRoot)}</strong>)
        </p>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:12}}>
          <TmPiano root={qRoot} highlight={qNotesHL} size="md"/>
          <div style={{...tmS.mono,fontSize:13,color:"#3fae6b",marginTop:6}}>
            {qAcObj.s.map(n=>tmPT((qRoot+n%12)%12)).join("  ")}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {optsShuf.map(id=>(
            <TmOpt key={id} label={acordes[id].label} state={optState[id]||null} onClick={()=>answer(id)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// MÓDULO 6 — Tonalidade e Campo Harmônico
// ═══════════════════════════════════════════════════════════════
function Mod06_Tonalidade() {
  const [root, setRoot] = React.useState(0);
  const [selGrau, setSelGrau] = React.useState(null);
  const [qRoot, setQRoot] = React.useState(0);
  const [qGrau, setQGrau] = React.useState(0);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const CAMPO_R=[0,2,4,5,7,9,11];
  const CAMPO_T=["maj7","m7","m7","maj7","7","m7","m7♭5"];
  const CAMPO_N=["Maior 7","Menor 7","Menor 7","Maior 7","Dom. 7","Menor 7","m7♭5"];
  const CAMPO_MN=[false,true,true,false,false,true,true];
  const CAMPO_F=["Tônica","Subdominante","Tônica","Subdominante","Dominante","Tônica","Dominante"];
  const CAMPO_C=["#7F77DD","#1D9E75","#7F77DD","#1D9E75","#D85A30","#7F77DD","#D85A30"];
  const GRAUS=["I","II","III","IV","V","VI","VII"];
  const CHORD_IVS={maj7:[0,4,7,11],m7:[0,3,7,10],"7":[0,4,7,10],"m7♭5":[0,3,6,10]};

  function grauNome(r,i){
    return tmNoteEN((r+CAMPO_R[i])%12)+(CAMPO_MN[i]?"m":"");
  }

  function newQ(){
    const r=tmRandom(0,11); const g=tmRandom(0,6);
    setQRoot(r);setQGrau(g);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i){
    if(fb)return;
    const ok=i===qGrau;
    const os={};os[i]=ok?"correct":"wrong";
    if(!ok)os[qGrau]="correct";
    setOptState(os);
    const cn=grauNome(qRoot,qGrau);
    setFb({ok,msg:ok?`Correto! ${cn} é o grau ${GRAUS[qGrau]} (${CAMPO_F[qGrau]}).`
      :`Errado. ${grauNome(qRoot,qGrau)} é o ${GRAUS[qGrau]} grau (${CAMPO_F[qGrau]}).`});
  }

  const selG = selGrau!==null ? {
    nome: grauNome(root,selGrau),
    tipo: CAMPO_T[selGrau],
    func: CAMPO_F[selGrau],
    cor:  CAMPO_C[selGrau],
    ivs:  CHORD_IVS[CAMPO_T[selGrau]]||[0,4,7],
    root: (root+CAMPO_R[selGrau])%12,
  } : null;

  const qChordName=grauNome(qRoot,qGrau);
  const qChordIvs=CHORD_IVS[CAMPO_T[qGrau]]||[0,4,7];
  const qChordHL=qChordIvs.map(n=>n%12);

  return (
    <div>
      <p style={tmS.p}>A <strong style={{color:"#fff"}}>tonalidade</strong> é o conjunto de notas e acordes que pertencem a uma determinada escala. O <strong style={{color:"#fff"}}>campo harmônico</strong> lista os 7 acordes nativos da tonalidade, cada um com uma função.</p>

      <div style={{...tmS.hl,marginBottom:14}}>
        <strong>Três funções:</strong> <span style={{color:"#7F77DD"}}>Tônica (T)</span> = repouso · <span style={{color:"#1D9E75"}}>Subdominante (SD)</span> = movimento · <span style={{color:"#D85A30"}}>Dominante (D)</span> = tensão que quer resolver
      </div>

      <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSelGrau(null);}} label="Tom"/>

      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
        {GRAUS.map((g,i)=>(
          <button key={g} onClick={()=>setSelGrau(selGrau===i?null:i)} style={{
            padding:"10px 12px",borderRadius:10,cursor:"pointer",textAlign:"center",
            fontFamily:"'Montserrat',sans-serif",
            background:selGrau===i?`${CAMPO_C[i]}33`:"#0a2417",
            border:`1px solid ${selGrau===i?CAMPO_C[i]:"#15392b"}`,
            transition:"all .15s",minWidth:52
          }}>
            <div style={{fontSize:10,color:CAMPO_C[i],fontWeight:600}}>{g}</div>
            <div style={{fontSize:14,color:"#fff",fontWeight:800}}>{grauNome(root,i)}</div>
            <div style={{fontSize:9,color:"#5d917a"}}>{CAMPO_T[i]}</div>
          </button>
        ))}
      </div>

      {selG && (
        <div style={{...tmS.card,marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>
            {GRAUS[selGrau]} grau — {selG.nome} {selG.tipo}
            <span style={{fontSize:12,color:selG.cor,fontWeight:500,marginLeft:8}}>
              Função: {selG.func}
            </span>
          </div>
          <div style={{...tmS.mono,fontSize:13,color:"#3fae6b",fontWeight:700,marginBottom:10}}>
            {selG.ivs.map(n=>tmPT((selG.root+n)%12)).join("  ")}
          </div>
          <TmPiano root={selG.root} highlight={selG.ivs.map(n=>n%12)} size="sm"/>
        </div>
      )}

      <h3 style={{...tmS.h3,marginTop:4}}>Funções harmônicas — tabela</h3>
      <div style={{overflowX:"auto",marginBottom:6}}>
        <table style={tmS.table}>
          <thead><tr>
            <th style={tmS.th}>Grau</th><th style={tmS.th}>Acorde em {tmPT(root)}</th>
            <th style={tmS.th}>Tipo</th><th style={tmS.th}>Função</th>
          </tr></thead>
          <tbody>
            {GRAUS.map((g,i)=>(
              <tr key={g} onClick={()=>setSelGrau(selGrau===i?null:i)} style={{cursor:"pointer"}}>
                <td style={{...tmS.td,fontWeight:900,color:CAMPO_C[i],...tmS.mono}}>{g}</td>
                <td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{grauNome(root,i)}</td>
                <td style={{...tmS.td,fontSize:12,color:"#6fae8a",...tmS.mono}}>{CAMPO_T[i]}</td>
                <td style={{...tmS.td,fontSize:12,color:CAMPO_C[i]}}>{CAMPO_F[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TmExercicio title="Identificar o grau" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>
          No campo harmônico de <strong style={{color:"#3fae6b"}}>{tmPT(qRoot)} maior</strong>, qual grau é o acorde <strong style={{color:"#fff"}}>{qChordName}</strong>?
        </p>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:12}}>
          <TmPiano root={(qRoot+CAMPO_R[qGrau])%12} highlight={qChordHL} size="md"/>
          <div style={{...tmS.mono,fontSize:13,color:"#3fae6b",marginTop:6}}>
            {qChordIvs.map(n=>tmPT(((qRoot+CAMPO_R[qGrau])+n)%12)).join("  ")}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {GRAUS.map((g,i)=>(
            <TmOpt key={g} label={g} state={optState[i]||null} onClick={()=>answer(i)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 7 — Progressões Harmônicas
// ═══════════════════════════════════════════════════════════════
function Mod07_Progressoes() {
  const [root, setRoot] = React.useState(0);
  const [selProg, setSelProg] = React.useState(0);
  const [qProg, setQProg] = React.useState(0);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const CAMPO_R=[0,2,4,5,7,9,11];
  const CAMPO_MN=[false,true,true,false,false,true,true];
  function gNome(r,gi){
    if(gi===-1)return tmNoteEN((r+10)%12);
    return tmNoteEN((r+CAMPO_R[gi])%12)+(CAMPO_MN[gi]?"m":"");
  }

  const progs=[
    {l:"I – V – VI – IV",  gi:[0,4,5,3], desc:"A mais popular do mundo — usada em milhares de músicas.", ex:"\"Let It Be\", \"No Woman No Cry\", \"With or Without You\", gospel"},
    {l:"I – IV – V – I",   gi:[0,3,4,0], desc:"Cadência autêntica — núcleo da música clássica, country e hinos.",ex:"\"La Bamba\", blues de 12 compassos, hinos congregacionais"},
    {l:"II – V – I",       gi:[1,4,0],   desc:"A progressão do jazz — movimento de quartas descendentes.",  ex:"Standards de jazz, bossa nova, \"Garota de Ipanema\""},
    {l:"I – VI – IV – V",  gi:[0,5,3,4], desc:"Progressão dos anos 50 — nostalgia e simplicidade.",          ex:"\"Stand By Me\", \"Earth Angel\", doo-wop"},
    {l:"VI – IV – I – V",  gi:[5,3,0,4], desc:"Variante menor — mais sombria e dramática.",                  ex:"\"Pompeii\", \"Numb\", \"Wicked Game\""},
    {l:"I – bVII – IV",    gi:[0,-1,3],  desc:"Modal com empréstimo — som de rock clássico.",                ex:"\"Sweet Home Alabama\", \"Here Comes the Sun\""},
    {l:"IV – I (plagal)",  gi:[3,0],     desc:"Cadência plagal — resolução suave, religiosa, \"amém\".",     ex:"Final de hinos, gospel, \"Hey Jude\""},
    {l:"I – III – IV – V", gi:[0,2,3,4], desc:"Variação clássica — muito usada em pop e gospel.",            ex:"Baladas, louvor contemporâneo"},
  ];

  function newQ(){
    const p=tmRandom(0,progs.length-1);
    const r=tmRandom(0,11);
    setQProg(p);setRoot(r);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i){
    if(fb)return;
    const ok=i===qProg;
    const os={};os[i]=ok?"correct":"wrong";
    if(!ok)os[qProg]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! É a progressão ${progs[qProg].l}.`
      :`Errado. Era ${progs[qProg].l}.`});
  }

  const p=progs[selProg];
  const qp=progs[qProg];
  const opts=tmShuffle([...Array(progs.length).keys()]);

  return (
    <div>
      <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>progressão harmônica</strong> é uma sequência de acordes que se repete ao longo de uma música. Certas progressões são tão comuns que reconhecemos o som instantaneamente.</p>

      <TmKeyPicker value={root} onChange={v=>setRoot(v)} label="Tom"/>

      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {progs.map((pg,i)=>(
          <button key={i} onClick={()=>setSelProg(i)} style={{
            display:"flex",gap:10,alignItems:"flex-start",
            background:selProg===i?"#0e2c1f":"transparent",
            border:`1px solid ${selProg===i?"#2f7d57":"#15392b"}`,
            borderRadius:10,padding:"10px 12px",cursor:"pointer",
            textAlign:"left",fontFamily:"'Montserrat',sans-serif",transition:"all .15s"
          }}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,color:"#eef5f0",fontSize:13,...tmS.mono}}>{pg.l}</div>
              <div style={{fontSize:12,color:"#3fae6b",marginTop:2}}>
                {pg.gi.map(gi=>gNome(root,gi)).join(" – ")}
              </div>
            </div>
          </button>
        ))}
      </div>

      {p && (
        <div style={tmS.card}>
          <div style={{fontWeight:700,color:"#fff",fontSize:14,marginBottom:4}}>
            {p.l} em {tmPT(root)}
          </div>
          <div style={{...tmS.mono,fontSize:16,color:"#3fae6b",fontWeight:700,marginBottom:8,letterSpacing:.5}}>
            {p.gi.map(gi=>gNome(root,gi)).join("   –   ")}
          </div>
          <p style={{...tmS.p,marginBottom:4}}>{p.desc}</p>
          <p style={{...tmS.note,margin:0}}>Ex: {p.ex}</p>
        </div>
      )}

      <h3 style={{...tmS.h3,marginTop:14}}>Cadências</h3>
      <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>cadência</strong> é o fechamento de uma frase musical. As principais:</p>
      <div style={tmS.grid2}>
        {[
          {nome:"Autêntica perfeita",formula:"V→I",desc:"Resolução mais forte — muito conclusiva"},
          {nome:"Autêntica imperfeita",formula:"VII→I",desc:"Resolução mais suave, sem o V7"},
          {nome:"Plagal (amém)",formula:"IV→I",desc:"Religiosa, suave — usada em hinos"},
          {nome:"Meia cadência",formula:"?→V",desc:"Suspensão — termina na dominante, sem resolver"},
        ].map(c=>(
          <div key={c.nome} style={tmS.card}>
            <div style={{fontWeight:700,fontSize:"clamp(11px,3vw,13px)",color:"#eef5f0"}}>{c.nome}</div>
            <div style={{...tmS.mono,color:"#3fae6b",fontWeight:700,margin:"3px 0"}}>{c.formula}</div>
            <div style={{fontSize:"clamp(10px,2.6vw,11.5px)",color:"#6fae8a"}}>{c.desc}</div>
          </div>
        ))}
      </div>

      <TmExercicio title="Reconhecer progressão" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>
          Em <strong style={{color:"#3fae6b"}}>{tmPT(root)} maior</strong>, identifique esta progressão:
        </p>
        <div style={{...tmS.card,textAlign:"center",fontSize:16,...tmS.mono,color:"#fff",fontWeight:700,padding:"16px",marginBottom:12}}>
          {qp.gi.map(gi=>gNome(root,gi)).join("   –   ")}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {opts.slice(0,5).map(i=>(
            <TmOpt key={i} label={`${progs[i].l}`} state={optState[i]||null} onClick={()=>answer(i)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 8 — Modos Gregos
// ═══════════════════════════════════════════════════════════════
function Mod08_Modos() {
  const [root, setRoot] = React.useState(0);
  const [selModo, setSelModo] = React.useState(0);
  const [qModo, setQModo] = React.useState(0);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const modos=[
    {nome:"Jônico",    grau:"I",   ivs:[0,2,4,5,7,9,11], formula:"T T S T T T S", char:"Maior padrão — alegre, estável",       uso:"Base de toda música tonal"},
    {nome:"Dórico",    grau:"II",  ivs:[0,2,3,5,7,9,10], formula:"T S T T T S T", char:"Menor com 6ª maior — jazz, funk, soul", uso:"\"Oye Como Va\", funk, smooth jazz"},
    {nome:"Frígio",    grau:"III", ivs:[0,1,3,5,7,8,10], formula:"S T T T S T T", char:"Menor com 2ª menor — flamenco, metal",  uso:"Música espanhola, metal extremo"},
    {nome:"Lídio",     grau:"IV",  ivs:[0,2,4,6,7,9,11], formula:"T T T S T T S", char:"Maior com #4 — cinematográfico, mágico",uso:"Trilhas sonoras, John Williams"},
    {nome:"Mixolídio", grau:"V",   ivs:[0,2,4,5,7,9,10], formula:"T T S T T S T", char:"Maior com ♭7 — rock, blues, gospel",   uso:"\"Sweet Home Alabama\", gospel"},
    {nome:"Eólio",     grau:"VI",  ivs:[0,2,3,5,7,8,10], formula:"T S T T S T T", char:"Menor natural padrão — melancólico",    uso:"Base de toda música tonal menor"},
    {nome:"Lócrio",    grau:"VII", ivs:[0,1,3,5,6,8,10], formula:"S T T S T T T", char:"Menor com ♭2 e ♭5 — muito tenso, raro",uso:"Metal extremo, música contemporânea"},
  ];

  function newQ(){
    const m=tmRandom(0,modos.length-1);
    const r=tmRandom(0,11);
    setQModo(m);setRoot(r);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i){
    if(fb)return;
    const ok=i===qModo;
    const os={};os[i]=ok?"correct":"wrong";
    if(!ok)os[qModo]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! É o modo ${modos[qModo].nome}.`
      :`Errado. Era o modo ${modos[qModo].nome} (${modos[qModo].formula}).`});
  }

  const m=modos[selModo];
  const qm=modos[qModo];
  const notes=m.ivs.map(n=>tmPT((root+n)%12));
  const qNotes=qm.ivs.map(n=>tmPT((root+n)%12));
  const opts=tmShuffle([...Array(modos.length).keys()]);

  return (
    <div>
      <p style={tmS.p}>Os <strong style={{color:"#fff"}}>modos gregos</strong> são 7 escalas derivadas da escala maior. Cada uma começa em um grau diferente, criando um caráter sonoro único.</p>
      <div style={{...tmS.hl,marginBottom:14}}>
        <strong>Como funciona:</strong> A escala de Dó maior tocada começando do Ré é o modo Dórico. A mesma começando do Mi é o modo Frígio — e assim por diante.
      </div>

      <TmKeyPicker value={root} onChange={v=>setRoot(v)} label="Tom"/>

      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {modos.map((md,i)=>(
          <button key={md.nome} onClick={()=>setSelModo(i)} style={{
            fontSize:12,padding:"4px 11px",borderRadius:8,cursor:"pointer",
            fontFamily:"'Montserrat',sans-serif",fontWeight:selModo===i?700:400,
            background:selModo===i?"#7F77DD":"transparent",
            color:selModo===i?"#fff":"#9fdabb",
            border:selModo===i?"1px solid #534AB7":"1px solid #1d4435"
          }}>{md.nome}</button>
        ))}
      </div>

      <div style={tmS.card}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{tmPT(root)} {m.nome}</span>
          <span style={{fontSize:10,...tmS.mono,color:"#6fae8a"}}>{m.formula}</span>
          <span style={{fontSize:10,color:"#9b6ef0",fontWeight:600,marginLeft:2}}>grau {m.grau}</span>
        </div>
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10}}>
          {notes.join("  ")}
        </div>
        <div style={{overflowX:"auto",marginBottom:10}}>
          <TmPiano root={root} highlight={m.ivs.map(n=>n%12)} size="sm"/>
        </div>
        <p style={{...tmS.p,marginBottom:3}}>{m.char}</p>
        <p style={{...tmS.note,margin:0}}>Uso: {m.uso}</p>
      </div>

      <TmExercicio title="Identificar modo" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>
          Em <strong style={{color:"#3fae6b"}}>{tmPT(root)}</strong>, que modo é essa escala?
        </p>
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,
          letterSpacing:1,marginBottom:12,padding:"10px",background:"#091f14",borderRadius:10}}>
          {qNotes.join("  ")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {opts.map(i=>(
            <TmOpt key={i} label={modos[i].nome} state={optState[i]||null} onClick={()=>answer(i)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 9 — Harmonia Avançada
// ═══════════════════════════════════════════════════════════════
function Mod09_HarmoniaAvancada() {
  const [root, setRoot] = React.useState(0);
  const [qItem, setQItem] = React.useState(0);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const conceitos=[
    {nome:"Modulação",         tag:"Avançado",
     desc:"Mudança de tonalidade dentro de uma música.",
     detalhe:"Cria sensação de elevação. O tipo mais comum é a modulação por semitom (último refrão um tom acima).",
     exemplo:"\"Man in the Mirror\" — Michael Jackson; modulações em gospel e praise&worship"},
    {nome:"Dominante secundária",tag:"Tensão",
     desc:"Acorde dominante V7 de um grau que não é a tônica.",
     detalhe:"Cria tensão local antes de resolver. Escrito como V/II, V/IV etc. Traz cromatismo sem perder a tonalidade.",
     exemplo:"A7 antes de Dm em Dó maior (V/II) · muito comum em samba e jazz"},
    {nome:"Empréstimo modal",   tag:"Cor",
     desc:"Acorde importado da tonalidade paralela (maior/menor).",
     detalhe:"Em Dó maior: usar accordes de Dó menor (como Fm, Ab, Bb) para 'colorir' a harmonia sem modular.",
     exemplo:"\"Hey Joe\" · bVII em maior · gospel usa muito bIII e bVII"},
    {nome:"Napolitano (bII)",   tag:"Clássico",
     desc:"Acorde maior construído sobre o 2º grau bemolizado.",
     detalhe:"Muito dramático — aparece em músicas clássicas, óperas e metal. Em Dó menor, seria Réb maior.",
     exemplo:"Mozart, Beethoven, metal progressivo · cria máxima tensão antes da dominante"},
    {nome:"Substituição de trítono",tag:"Jazz",
     desc:"O V7 é substituído pelo acorde a um trítono de distância.",
     detalhe:"G7 e Db7 compartilham o trítono (Si e Fá). Db7 pode substituir G7 em Dó com movimento cromático no baixo.",
     exemplo:"Jazz, bossa nova · progressão de baixo descendente por meios-tons"},
    {nome:"Nota pedal",         tag:"Textura",
     desc:"Uma nota (geralmente tônica ou dominante) mantida enquanto os acordes mudam.",
     detalhe:"Cria tensão progressiva quando os acordes mudam acima da nota fixa. Muito usado para climax musical.",
     exemplo:"Prelúdio de Bach · intro de muitas músicas de rock e worship"},
    {nome:"Acorde pivô",        tag:"Modulação",
     desc:"Acorde que pertence às duas tonalidades — usado para modular suavemente.",
     detalhe:"Em vez de modular bruscamente, usa-se um acorde que existe em ambas as tonalidades como 'ponte'.",
     exemplo:"Muito comum em músicas clássicas e corais · transição entre refrão e ponte"},
  ];

  function newQ(){
    const i=tmRandom(0,conceitos.length-1);
    setQItem(i);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i){
    if(fb)return;
    const ok=i===qItem;
    const os={};os[i]=ok?"correct":"wrong";
    if(!ok)os[qItem]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! "${conceitos[qItem].nome}".`
      :`Errado. Era "${conceitos[qItem].nome}".`});
  }

  const opts=tmShuffle([...Array(conceitos.length).keys()]).slice(0,5);
  if(!opts.includes(qItem)){opts[0]=qItem;}
  const optsS=tmShuffle(opts);

  return (
    <div>
      <p style={tmS.p}>Recursos que vão além do campo diatônico — cromatismo, empréstimos e substituições que expandem a paleta harmônica.</p>

      <TmKeyPicker value={root} onChange={v=>setRoot(v)} label="Tom de referência"/>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:6}}>
        {conceitos.map((c,i)=>(
          <div key={c.nome} style={{...tmS.card,padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:"clamp(13px,3.5vw,14px)",color:"#eef5f0"}}>{c.nome}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"1px 8px",borderRadius:10,
                background:"rgba(63,174,107,.15)",color:"#3fae6b",border:"1px solid #1d4435"}}>
                {c.tag}
              </span>
            </div>
            <p style={{...tmS.p,marginBottom:4}}><strong style={{color:"#fff"}}>O que é:</strong> {c.desc}</p>
            <p style={{...tmS.p,marginBottom:4}}>{c.detalhe}</p>
            <p style={{...tmS.note,margin:0}}>Ex: {c.exemplo}</p>
          </div>
        ))}
      </div>

      <TmExercicio title="Identificar o conceito" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Leia a descrição e identifique o conceito:</p>
        <div style={{...tmS.card,fontSize:13,color:"#9fdabb",lineHeight:1.6,marginBottom:12}}>
          {conceitos[qItem].desc}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {optsS.map(i=>(
            <TmOpt key={i} label={conceitos[i].nome} state={optState[i]||null} onClick={()=>answer(i)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO 10 — Leitura de Cifra
// ═══════════════════════════════════════════════════════════════
function Mod10_Cifra() {
  const [root, setRoot] = React.useState(0);
  const [qIdx, setQIdx] = React.useState(0);
  const [fb, setFb] = React.useState(null);
  const [optState, setOptState] = React.useState({});

  const simbolos=[
    {cifra:"C",       desc:"Dó maior",                notas:"Dó  Mi  Sol",      ivs:[0,4,7]},
    {cifra:"Cm",      desc:"Dó menor",                notas:"Dó  Mib  Sol",     ivs:[0,3,7]},
    {cifra:"C7",      desc:"Dó dominante 7ª",         notas:"Dó  Mi  Sol  Sib", ivs:[0,4,7,10]},
    {cifra:"Cmaj7",   desc:"Dó maior 7ª",             notas:"Dó  Mi  Sol  Si",  ivs:[0,4,7,11]},
    {cifra:"Cm7",     desc:"Dó menor 7ª",             notas:"Dó  Mib  Sol  Sib",ivs:[0,3,7,10]},
    {cifra:"Cdim",    desc:"Dó diminuto",             notas:"Dó  Mib  Solb",    ivs:[0,3,6]},
    {cifra:"Caug",    desc:"Dó aumentado",            notas:"Dó  Mi  Sol#",     ivs:[0,4,8]},
    {cifra:"Csus4",   desc:"Dó suspenso 4ª",          notas:"Dó  Fá  Sol",      ivs:[0,5,7]},
    {cifra:"Csus2",   desc:"Dó suspenso 2ª",          notas:"Dó  Ré  Sol",      ivs:[0,2,7]},
    {cifra:"Cadd9",   desc:"Dó maior com 9ª",         notas:"Dó  Mi  Sol  Ré",  ivs:[0,4,7,14]},
    {cifra:"C9",      desc:"Dó dominante 9ª",         notas:"Dó  Mi  Sol  Sib  Ré",ivs:[0,4,7,10,14]},
    {cifra:"C/E",     desc:"Dó maior — Mi no baixo",  notas:"Mi(baixo) Dó Mi Sol",ivs:[4,0,4,7]},
    {cifra:"Cm7b5",   desc:"Dó meio-diminuto",        notas:"Dó  Mib  Solb  Sib",ivs:[0,3,6,10]},
  ];

  function newQ(){
    const i=tmRandom(0,simbolos.length-1);
    setQIdx(i);setFb(null);setOptState({});
  }
  React.useEffect(()=>{ newQ(); },[]);

  function answer(i){
    if(fb)return;
    const ok=i===qIdx;
    const os={};os[i]=ok?"correct":"wrong";
    if(!ok)os[qIdx]="correct";
    setOptState(os);
    setFb({ok,msg:ok?`Correto! ${simbolos[qIdx].cifra} = ${simbolos[qIdx].desc}.`
      :`Errado. ${simbolos[qIdx].cifra} é ${simbolos[qIdx].desc}.`});
  }

  const opts=tmShuffle([...Array(simbolos.length).keys()]).slice(0,6);
  if(!opts.includes(qIdx))opts[0]=qIdx;
  const optsS=tmShuffle(opts);

  return (
    <div>
      <p style={tmS.p}>A <strong style={{color:"#fff"}}>cifra americana</strong> usa as letras C D E F G A B para as 7 notas naturais (equivalentes a Dó Ré Mi Fá Sol Lá Si). Sufixos indicam o tipo de acorde.</p>

      <div style={{...tmS.hl,marginBottom:14}}>
        <strong>Referência rápida:</strong> C=Dó · D=Ré · E=Mi · F=Fá · G=Sol · A=Lá · B=Si · # = sustenido · b = bemol
      </div>

      <h3 style={tmS.h3}>Sufixos essenciais</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,160px),1fr))",gap:8,marginBottom:16}}>
        {simbolos.map((s,i)=>(
          <div key={i} style={{...tmS.card,display:"flex",gap:8,alignItems:"flex-start"}}>
            <span style={{...tmS.mono,fontSize:16,fontWeight:700,color:"#3fae6b",flexShrink:0}}>{s.cifra}</span>
            <div>
              <div style={{fontSize:"clamp(10px,2.7vw,12px)",color:"#eef5f0",fontWeight:500}}>{s.desc}</div>
              <div style={{fontSize:10,color:"#6fae8a",marginTop:2,...tmS.mono}}>{s.notas}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={tmS.h3}>Como ler uma cifra completa</h3>
      <div style={{...tmS.card,marginBottom:14}}>
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,marginBottom:8,lineHeight:2}}>
          [G]Quan-do [Em]che-gar o [C]dia [D]<br/>
          [G]Quan-do [Em]tu vol-[C]ta-[D]res
        </div>
        <p style={{...tmS.p,marginBottom:0}}>A cifra aparece entre colchetes <span style={tmS.chord}>[G]</span> imediatamente antes da sílaba onde o acorde começa. Na auséncia de nova cifra, o acorde anterior continua.</p>
      </div>

      <TmExercicio title="Interpretar cifra" onNew={newQ}
        feedback={<TmFeedback ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>O que significa esta cifra?</p>
        <div style={{textAlign:"center",fontSize:32,...tmS.mono,color:"#3fae6b",
          fontWeight:800,padding:"14px",background:"#091f14",borderRadius:12,marginBottom:14}}>
          {simbolos[qIdx].cifra}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {optsS.map(i=>(
            <TmOpt key={i} label={simbolos[i].desc} state={optState[i]||null} onClick={()=>answer(i)}/>
          ))}
        </div>
      </TmExercicio>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — TeoriaMusicaView
// ═══════════════════════════════════════════════════════════════
function TeoriaMusicaView({ onBack }) {
  const [curMod, setCurMod] = React.useState(null); // null = menu, ou id do módulo
  const [progress, setProgress] = React.useState({}); // {modId: true/false}

  // Persiste progresso no localStorage
  React.useEffect(()=>{
    try{
      const saved=localStorage.getItem("ipb:teoria:progress");
      if(saved) setProgress(JSON.parse(saved));
    }catch(e){}
  },[]);

  function markDone(id){
    const novo={...progress,[id]:true};
    setProgress(novo);
    try{ localStorage.setItem("ipb:teoria:progress",JSON.stringify(novo)); }catch(e){}
  }

  const modulos=[
    {id:"01_som",        nivel:"Iniciante",   cor:"#34c98a", bg:"#0d2e1e",
     titulo:"O Som e a Nota",
     sub:"As 12 notas, enarmonia e o piano",
     comp:<Mod01_Som/>},
    {id:"02_ritmo",      nivel:"Iniciante",   cor:"#34c98a", bg:"#0d2e1e",
     titulo:"Ritmo e Compasso",
     sub:"Figuras rítmicas, fórmulas e pulsação",
     comp:<Mod02_Ritmo/>},
    {id:"03_intervalos", nivel:"Básico",      cor:"#4f9dde", bg:"#0d1e2e",
     titulo:"Intervalos",
     sub:"Distâncias entre notas — de uníssono à oitava",
     comp:<Mod03_Intervalos/>},
    {id:"04_escalas",    nivel:"Básico",      cor:"#4f9dde", bg:"#0d1e2e",
     titulo:"Escalas",
     sub:"Maior, menores, pentatônica e blues",
     comp:<Mod04_Escalas/>},
    {id:"05_acordes",    nivel:"Intermediário",cor:"#e0b341",bg:"#2b1f06",
     titulo:"Acordes",
     sub:"Tríades, tétrades, inversões e notação",
     comp:<Mod05_Acordes/>},
    {id:"06_tonalidade", nivel:"Intermediário",cor:"#e0b341",bg:"#2b1f06",
     titulo:"Tonalidade e Campo Harmônico",
     sub:"Funções: tônica, subdominante e dominante",
     comp:<Mod06_Tonalidade/>},
    {id:"07_progressoes",nivel:"Intermediário",cor:"#e0b341",bg:"#2b1f06",
     titulo:"Progressões Harmônicas",
     sub:"Cadências e progressões mais usadas",
     comp:<Mod07_Progressoes/>},
    {id:"08_modos",      nivel:"Avançado",    cor:"#e8554d", bg:"#2b0d0d",
     titulo:"Modos Gregos",
     sub:"Jônico, Dórico, Frígio, Lídio, Mixolídio, Eólio e Lócrio",
     comp:<Mod08_Modos/>},
    {id:"09_avancado",   nivel:"Avançado",    cor:"#e8554d", bg:"#2b0d0d",
     titulo:"Harmonia Avançada",
     sub:"Modulação, empréstimo modal, dominante secundária",
     comp:<Mod09_HarmoniaAvancada/>},
    {id:"10_cifra",      nivel:"Prático",     cor:"#9b6ef0", bg:"#1a0f2e",
     titulo:"Leitura de Cifra",
     sub:"Sistema cifrado, sufixos e como ler uma partitura cifrada",
     comp:<Mod10_Cifra/>},
  ];

  const nivelOrdem=["Iniciante","Básico","Intermediário","Avançado","Prático"];
  const nivelGrupos=nivelOrdem.reduce((acc,n)=>{
    acc[n]=modulos.filter(m=>m.nivel===n);
    return acc;
  },{});

  const totalDone=Object.values(progress).filter(Boolean).length;

  // Modo de visualização de módulo
  if (curMod) {
    const mod=modulos.find(m=>m.id===curMod);
    if(!mod) return null;
    return (
      <div style={{maxWidth:720,margin:"0 auto",padding:"16px 12px 80px",fontFamily:"'Montserrat',sans-serif"}}>
        {/* Cabeçalho do módulo */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setCurMod(null)} style={{...ghostBtn(),padding:"7px 12px",flexShrink:0}}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{margin:0,fontWeight:800,fontSize:"clamp(17px,4.5vw,22px)",color:"#fff",lineHeight:1.1,
              borderLeft:`3px solid ${mod.cor}`,paddingLeft:10}}>
              {mod.titulo}
            </h1>
            <div style={{fontSize:11,color:mod.cor,marginTop:3,paddingLeft:13}}>{mod.nivel}</div>
          </div>
          {!progress[curMod] && (
            <button onClick={()=>markDone(curMod)} style={{
              fontSize:11,padding:"5px 10px",borderRadius:8,border:`1px solid ${mod.cor}44`,
              background:"transparent",color:mod.cor,cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif",flexShrink:0
            }}>Marcar como feito</button>
          )}
          {progress[curMod] && (
            <span style={{fontSize:12,color:"#3fae6b",fontWeight:600,flexShrink:0}}>Concluído</span>
          )}
        </div>
        {/* Conteúdo */}
        <div style={{fontSize:"clamp(12px,3.2vw,14px)",lineHeight:1.7}}>
          {mod.comp}
        </div>
        {/* Navegação entre módulos */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:22,gap:10}}>
          {modulos.findIndex(m=>m.id===curMod)>0 && (
            <button onClick={()=>{
              const i=modulos.findIndex(m=>m.id===curMod);
              setCurMod(modulos[i-1].id);window.scrollTo(0,0);
            }} style={{...ghostBtn(),flex:1,justifyContent:"flex-start"}}>
              <ChevronDown size={15} style={{transform:"rotate(90deg)"}}/> Anterior
            </button>
          )}
          <div style={{flex:1}}/>
          {modulos.findIndex(m=>m.id===curMod)<modulos.length-1 && (
            <button onClick={()=>{
              markDone(curMod);
              const i=modulos.findIndex(m=>m.id===curMod);
              setCurMod(modulos[i+1].id);window.scrollTo(0,0);
            }} style={{
              display:"inline-flex",alignItems:"center",gap:6,
              padding:"10px 18px",borderRadius:11,border:"none",
              background:`linear-gradient(135deg,${modulos[modulos.findIndex(m=>m.id===curMod)+1]?.cor||"#3fae6b"}33,${modulos[modulos.findIndex(m=>m.id===curMod)+1]?.cor||"#3fae6b"}11)`,
              borderWidth:1,borderStyle:"solid",borderColor:modulos[modulos.findIndex(m=>m.id===curMod)+1]?.cor+"44",
              color:modulos[modulos.findIndex(m=>m.id===curMod)+1]?.cor||"#3fae6b",
              cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,flex:1,justifyContent:"flex-end"
            }}>
              Próximo <ChevronDown size={15} style={{transform:"rotate(-90deg)"}}/>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Menu principal
  return (
    <div style={{maxWidth:720,margin:"0 auto",padding:"20px 12px 80px",fontFamily:"'Montserrat',sans-serif"}}>
      {/* Cabeçalho */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{...ghostBtn(),padding:"8px 12px",flexShrink:0}}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 style={{margin:0,fontWeight:800,fontSize:"clamp(20px,5vw,28px)",color:"#fff",lineHeight:1.1}}>
            Teoria Musical
          </h1>
          <p style={{margin:"3px 0 0",color:"#6fae8a",fontSize:"clamp(11px,3vw,13px)"}}>
            {totalDone}/{modulos.length} módulos concluídos
          </p>
        </div>
      </div>

      {/* Barra de progresso geral */}
      <div style={{height:4,background:"#0c2419",borderRadius:4,marginBottom:22,overflow:"hidden"}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,#3fae6b,#9b6ef0)",
          width:`${(totalDone/modulos.length)*100}%`,borderRadius:4,transition:"width .4s"}}/>
      </div>

      {/* Grupos por nível */}
      {nivelOrdem.map(nivel=>{
        const mods=nivelGrupos[nivel];
        if(!mods.length)return null;
        const nivelCor=mods[0].cor;
        const nivelDone=mods.filter(m=>progress[m.id]).length;
        return (
          <div key={nivel} style={{marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:nivelCor,
                textTransform:"uppercase",letterSpacing:".07em"}}>{nivel}</span>
              <div style={{flex:1,height:1,background:"#15392b"}}/>
              <span style={{fontSize:11,color:"#5d917a"}}>{nivelDone}/{mods.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {mods.map((mod,idx)=>{
                const done=!!progress[mod.id];
                const bloqueado=false; // sem bloqueio — todos acessíveis
                return (
                  <button key={mod.id} onClick={()=>{setCurMod(mod.id);window.scrollTo(0,0);}}
                    disabled={bloqueado}
                    style={{
                      display:"flex",alignItems:"center",gap:12,
                      background:done?"#091f14":"#0c2419",
                      border:`1px solid ${done?mod.cor+"55":"#15392b"}`,
                      borderRadius:12,padding:"13px 14px",cursor:"pointer",
                      textAlign:"left",fontFamily:"'Montserrat',sans-serif",
                      transition:"all .15s",opacity:bloqueado?.5:1
                    }}
                    onMouseEnter={e=>!bloqueado&&(e.currentTarget.style.background="#0e2c1f")}
                    onMouseLeave={e=>e.currentTarget.style.background=done?"#091f14":"#0c2419"}>
                    {/* Número */}
                    <div style={{
                      width:34,height:34,borderRadius:"50%",flexShrink:0,
                      background:done?mod.cor+"33":"#0a2417",
                      border:`1px solid ${done?mod.cor:mod.cor+"33"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:12,fontWeight:800,color:done?mod.cor:mod.cor+"88"
                    }}>
                      {done ? "✓" : `${idx+1+nivelOrdem.slice(0,nivelOrdem.indexOf(nivel)).reduce((acc,n)=>(nivelGrupos[n]||[]).length+acc,0)}`}
                    </div>
                    {/* Texto */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",
                        color:done?"#fff":"#eef5f0",lineHeight:1.2}}>{mod.titulo}</div>
                      <div style={{fontSize:"clamp(10px,2.8vw,12px)",color:done?mod.cor+"bb":"#5d917a",marginTop:2}}>
                        {mod.sub}
                      </div>
                    </div>
                    <ChevronDown size={16} color={mod.cor+"66"} style={{flexShrink:0,transform:"rotate(-90deg)"}}/>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
