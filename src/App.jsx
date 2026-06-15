import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
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

// Seções do Hinário Novo Cântico IPB — cada faixa de números corresponde a um tema
const HYMN_SECTIONS = [
  { label: "Louvor e Adoração",      from: 1,     to: 65,   color: "#e0b341" },
  { label: "Confissão",              from: 66,    to: 80,   color: "#e8554d" },
  { label: "Edificação",             from: 81,    to: 196,  color: "#4f9dde" },
  { label: "Apelo",                  from: 197,   to: 216,  color: "#9b6ef0" },
  { label: "Consagração",            from: 217,   to: 225,  color: "#ec6aa8" },
  { label: "Cristo — Sua Vida",      from: 226,   to: 297,  color: "#34c98a" },
  { label: "Igreja — Seu Ministério",from: 298,   to: 367,  color: "#3fb6c9" },
  { label: "Assuntos Diversos",      from: 368,   to: 400,  color: "#f0883e" },
  { label: "Outros",                 from: null,  to: null, color: "#9aa3ad" }, // 400-A e extras
];

// Retorna a seção do hinário a que um hino pertence
function getHymnSection(hymnNumber) {
  if (!hymnNumber) return HYMN_SECTIONS[HYMN_SECTIONS.length - 1];
  // Suporta formatos como "400-A", "12", "12a" etc.
  const num = parseInt(hymnNumber, 10);
  if (isNaN(num)) return HYMN_SECTIONS[HYMN_SECTIONS.length - 1]; // "400-A" e similares → Outros
  const sec = HYMN_SECTIONS.find(s => s.from !== null && num >= s.from && num <= s.to);
  return sec || HYMN_SECTIONS[HYMN_SECTIONS.length - 1];
}


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
            <span style={{ height: "1.5em", lineHeight: "1.5em", color: chordColor, fontWeight: 700, fontSize: "0.9em", whiteSpace: "pre", paddingRight: chordStr ? (chordNeedsGap ? "0.9em" : "0.35em") : 0, boxSizing: "content-box" }}>
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

/* ---------- Wake Lock — evita que a tela durma durante apresentação ---------- */
function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!active) { lockRef.current?.release().catch(() => {}); lockRef.current = null; return; }
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(lock => { lockRef.current = lock; }).catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !lockRef.current)
        navigator.wakeLock.request('screen').then(lock => { lockRef.current = lock; }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); lockRef.current?.release().catch(() => {}); lockRef.current = null; };
  }, [active]);
}

/* ---------- Metrônomo com AudioContext lookahead (sem deriva) ----------
   timeSig: string "4/4", "3/4", "6/8" etc — extrai o numerador para o número de beats. */
function useMetronome(bpm, timeSig) {
  const [playing, setPlaying] = useState(false);
  const [visualBeat, setVisualBeat] = useState(0);
  const ctxRef = useRef(null);
  const schedulerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);

  const beatsPerBar = useMemo(() => {
    const n = parseInt((timeSig || '4/4').split('/')[0], 10);
    return (n > 0 && n <= 16) ? n : 4;
  }, [timeSig]);

  const scheduleClick = useCallback((accent, time) => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 900;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.06);
  }, []);

  useEffect(() => {
    if (!playing) { clearTimeout(schedulerRef.current); setVisualBeat(0); currentBeatRef.current = 0; return; }
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    const interval = 60 / (bpm || 120);
    const lookahead = 0.1;
    const scheduleAhead = 0.05;
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;
    const schedule = () => {
      while (nextNoteTimeRef.current < ctx.currentTime + lookahead) {
        const b = currentBeatRef.current;
        scheduleClick(b === 0, nextNoteTimeRef.current);
        const capturedBeat = b + 1;
        const delay = Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
        setTimeout(() => setVisualBeat(capturedBeat), delay);
        currentBeatRef.current = (b + 1) % beatsPerBar;
        nextNoteTimeRef.current += interval;
      }
      schedulerRef.current = setTimeout(schedule, scheduleAhead * 1000);
    };
    schedule();
    return () => { clearTimeout(schedulerRef.current); setVisualBeat(0); };
  }, [playing, bpm, beatsPerBar, scheduleClick]);

  return { playing, setPlaying, beat: visualBeat, beatsPerBar };
}

/* ---------- Toast — feedback de sucesso/erro ---------- */
const ToastContext = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", minWidth: 260, maxWidth: "90vw" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: "11px 18px", borderRadius: 12, fontFamily: "'Montserrat',sans-serif", fontSize: 13.5, fontWeight: 600,
            background: t.type === "error" ? "#b8301f" : t.type === "success" ? "#1a7a4a" : "#1a3a2a",
            color: "#fff", boxShadow: "0 6px 24px rgba(0,0,0,.45)",
            borderLeft: `4px solid ${t.type === "error" ? "#e8554d" : t.type === "success" ? "#3fae6b" : "#4f9dde"}`,
            animation: "slideUp .22s ease"
          }}>
            {t.type === "error" ? "✗ " : t.type === "success" ? "✓ " : "ℹ "}{t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}
function useToast() { return useContext(ToastContext) || (() => {}); }

/* ---------- Modal de confirmação — substitui confirm() nativo ---------- */
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "#0c2419", border: "1px solid #1d4435", borderRadius: 16, padding: 24, fontFamily: "'Montserrat',sans-serif" }}>
        <p style={{ margin: "0 0 20px", color: "#eef5f0", fontSize: 14.5, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={ghostBtn()}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...ghostBtn(), color: "#e8554d", borderColor: "#e8554d44" }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}
function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback((message) => new Promise(resolve => { setState({ message, resolve }); }), []);
  const modal = state ? (
    <ConfirmModal
      message={state.message}
      onConfirm={() => { state.resolve(true); setState(null); }}
      onCancel={() => { state.resolve(false); setState(null); }}
    />
  ) : null;
  return { confirm, modal };
}

/* ---------- Skeleton loading ---------- */
function SkeletonLine({ width = "100%", height = 16, radius = 6, style: s = {} }) {
  return <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg,#0c2419 25%,#122d20 50%,#0c2419 75%)", backgroundSize: "200% 100%", animation: "skeletonPulse 1.4s ease infinite", ...s }} />;
}
function SongListSkeleton() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 22px 90px" }}>
      <style>{`@keyframes skeletonPulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#0c2419", flexShrink: 0 }} />
        <div><SkeletonLine width={140} height={28} style={{ marginBottom: 8 }} /><SkeletonLine width={200} height={14} /></div>
      </div>
      <SkeletonLine height={48} radius={11} style={{ marginBottom: 18 }} />
      {[1,2,3].map(i => (
        <div key={i} style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <SkeletonLine width={4} height={18} radius={2} />
            <SkeletonLine width={120} height={13} />
            <SkeletonLine width={24} height={13} style={{ marginLeft: "auto" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- App ---------- */
function IPBChartsInner() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
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

  // ----- Grupos de louvor do usuário (versionado para evitar schema antigo) -----
  const LS_GROUPS_VERSION = "v2";
  const [myGroups, setMyGroups] = useState([]);
  const groupsKey = session?.user?.email ? `ipb:groups:${session.user.email.toLowerCase()}` : null;
  useEffect(() => {
    if (!groupsKey) return;
    try {
      const raw = localStorage.getItem(groupsKey);
      if (!raw) { setMyGroups([]); return; }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setMyGroups(parsed); // legado
      else if (parsed?.v === LS_GROUPS_VERSION && Array.isArray(parsed.data)) setMyGroups(parsed.data);
      else setMyGroups([]);
    } catch (e) { setMyGroups([]); }
  }, [groupsKey]);
  const saveMyGroups = useCallback((groups) => {
    setMyGroups(groups);
    try { if (groupsKey) localStorage.setItem(groupsKey, JSON.stringify({ v: LS_GROUPS_VERSION, data: groups })); } catch (e) {}
  }, [groupsKey]);

  // ----- Carregar cifras do banco (com cache offline) -----
  const SONGS_CACHE_KEY = "ipb:songs:cache:v1";
  const loadSongs = useCallback(async () => {
    try {
      const cached = localStorage.getItem(SONGS_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) { setSongs(list); setLoading(false); }
      }
    } catch (e) {}
    const { data, error } = await supabase.from("songs").select("*");
    if (!error && data) {
      const list = data.map(row => ({ ...row.data, id: row.id }));
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      setSongs(list);
      try { localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
    } else if (error) { console.error("Erro ao carregar:", error); }
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

  // ----- Preferências de tom/capo por música (conta + cache offline) -----
  const PREFS_CACHE_KEY = session?.user?.id ? `ipb:prefs:${session.user.id}` : null;
  const [prefs, setPrefs] = useState(() => {
    if (!PREFS_CACHE_KEY) return {};
    try { return JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || "{}"); } catch (e) { return {}; }
  });
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
      try { if (PREFS_CACHE_KEY) localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(map)); } catch (e) {}
    }
    setPrefsLoaded(true);
  }, [session, PREFS_CACHE_KEY]);
  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const savePref = useCallback(async (songId, semitones, capo) => {
    if (!session?.user || !songId) return;
    setPrefs(p => {
      const next = { ...p, [songId]: { semitones, capo } };
      try { if (PREFS_CACHE_KEY) localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    const { error } = await supabase.from("user_prefs").upsert({
      user_id: session.user.id, song_id: songId, semitones, capo, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,song_id" });
    if (error) console.error("Erro ao salvar preferência:", error.message);
  }, [session, PREFS_CACHE_KEY]);

  // ----- Salvar / excluir (gravam no banco; o realtime atualiza todos) -----
  const saveSong = useCallback(async (song) => {
    const { id, ...rest } = song;
    const payload = { id, data: { ...rest }, updated_by: memberName || "anônimo" };
    const { error } = await supabase.from("songs").upsert(payload);
    if (error) { toast("Erro ao salvar: " + error.message, "error"); return; }
    toast("Cifra salva!", "success");
    loadSongs();
  }, [memberName, loadSongs, toast]);

  const deleteSong = useCallback(async (id) => {
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) { toast("Erro ao excluir: " + error.message, "error"); return; }
    toast("Cifra excluída.", "success");
    loadSongs();
  }, [loadSongs, toast]);

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
      if (!Array.isArray(list)) { toast("Arquivo de backup inválido.", "error"); return; }
      const okImport = await confirm(`Importar ${list.length} música(s)? As que tiverem o mesmo identificador serão atualizadas; as demais serão adicionadas. Nada é apagado.`);
      if (!okImport) return;
      const rows = list.map(s => {
        const { id, ...rest } = s;
        return { id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), data: { ...rest }, updated_by: memberName || "import" };
      });
      const { error } = await supabase.from("songs").upsert(rows);
      if (error) { toast("Erro ao importar: " + error.message, "error"); return; }
      await loadSongs();
      toast("Importação concluída!", "success");
    } catch (e) {
      toast("Não foi possível ler o arquivo: " + e.message, "error");
    }
  }, [memberName, loadSongs, toast, confirm]);

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
    if (error) { toast("Erro ao salvar repertório: " + error.message, "error"); return null; }
    await loadSetlists();
    return payload.id;
  }, [memberName, loadSetlists, toast]);

  const deleteSetlist = useCallback(async (id) => {
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) { toast("Erro ao excluir repertório: " + error.message, "error"); return; }
    loadSetlists();
  }, [loadSetlists, toast]);

  // ----- Músicas recentes -----
  const RECENTS_KEY = session?.user?.email ? `ipb:recents:${session.user.email.toLowerCase()}` : null;
  const [recentIds, setRecentIds] = useState([]);
  useEffect(() => {
    if (!RECENTS_KEY) return;
    try { const s = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); if (Array.isArray(s)) setRecentIds(s); } catch (e) {}
  }, [RECENTS_KEY]);
  const addRecent = useCallback((songId) => {
    setRecentIds(prev => {
      const next = [songId, ...prev.filter(id => id !== songId)].slice(0, 5);
      try { if (RECENTS_KEY) localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, [RECENTS_KEY]);
  const recentSongs = useMemo(() => recentIds.map(id => songs.find(s => s.id === id)).filter(Boolean), [recentIds, songs]);

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
      <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", color: "#eef5f0", fontFamily: "'Montserrat',sans-serif" }}>
        {styleTag}<SongListSkeleton />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg,#0a1f17 0%,#08160f 55%,#06110b 100%)", color: "#eef5f0", fontFamily: "'Montserrat',sans-serif" }}>
      {styleTag}
      {confirmModal}
      {!online && (
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#b8541f", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
          <WifiOff size={16} /> Sem conexão — músicas em cache disponíveis, mas mudanças não serão salvas.
        </div>
      )}
      {view === "list" && <SongList songs={filtered} allCount={songs.length} search={search} setSearch={setSearch}
        memberName={memberName} canEdit={canEdit} onLogout={() => supabase.auth.signOut()}
        onExport={exportBackup} onImport={importBackup}
        setlistCount={visibleSetlists.length} onOpenSetlists={() => setView("setlists")}
        onOpenTeoria={() => setView("teoria")}
        myGroups={myGroups} onSaveGroups={saveMyGroups}
        recentSongs={recentSongs}
        groupBy={groupBy} setGroupBy={setGroupBy} restoreScroll={listScrollRef}
        openCategories={openCategories} setOpenCategories={setOpenCategories}
        onOpen={s => {
          listScrollRef.current = window.scrollY || document.scrollingElement?.scrollTop || 0;
          addRecent(s.id);
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

export default function IPBCharts() {
  return (
    <ToastProvider>
      <IPBChartsInner />
    </ToastProvider>
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

function SongList({ songs, allCount, search, setSearch, memberName, canEdit, onLogout, onExport, onImport, setlistCount, onOpenSetlists, onOpenTeoria, myGroups, onSaveGroups, groupBy, setGroupBy, restoreScroll, openCategories, setOpenCategories, onOpen, onNew, onNewHymn, recentSongs }) {
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

  // separa hinos e agrupa por seção do Hinário Novo Cântico
  const hymns = useMemo(() =>
    songs.filter(s => s.category === "Hino")
      .sort((a, b) => (parseInt(a.hymnNumber) || 9999) - (parseInt(b.hymnNumber) || 9999)),
    [songs]);

  // Para a aba de hinos: agrupa por seção do hinário, mantendo só seções que têm hinos
  const hymnsBySection = useMemo(() => {
    const sectionMap = {};
    hymns.forEach(s => {
      const sec = getHymnSection(s.hymnNumber);
      const key = sec.label;
      if (!sectionMap[key]) sectionMap[key] = { color: sec.color, hymns: [], from: sec.from, to: sec.to };
      sectionMap[key].hymns.push(s);
    });
    // Ordena as seções na ordem definida em HYMN_SECTIONS
    const orderedKeys = HYMN_SECTIONS.map(s => s.label).filter(l => sectionMap[l]);
    return { items: sectionMap, keys: orderedKeys };
  }, [hymns]);

  // agrupa por categoria ou autor (excluindo hinos, que têm aba própria)
  const grouped = useMemo(() => {
    const list = songs.filter(s => s.category !== "Hino");
    const map = {};
    list.forEach(s => {
      const k = groupBy === "artist" ? (s.artist?.trim() || "Sem artista") : categoryLabel(s);
      (map[k] = map[k] || []).push(s);
    });
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
    keys.forEach(k => map[k].sort((a, b) => (a.title || "").localeCompare(b.title || "")));
    return { items: map, keys };
  }, [songs, groupBy]);

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


      {/* Músicas recentes — visível apenas sem busca ativa */}
      {!search.trim() && recentSongs && recentSongs.length > 0 && groupBy !== "hymns" && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5d917a", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 10 }}>Abertas recentemente</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentSongs.map(s => (
              <button key={s.id} onClick={() => onOpen(s)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid #15392b", background: "#0c2419", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left", maxWidth: 220 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#2f7d57"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#15392b"; }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLORS[s.category] || "#3fae6b", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "#6fae8a" }}>{s.key || "—"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
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
      ) : groupBy === "hymns" ? (
        /* ── Aba de Hinos: agrupado por seção do Hinário Novo Cântico ── */
        <div style={{ display: "grid", gap: 10 }}>
          {hymnsBySection.keys.map(sectionLabel => {
            const sec = hymnsBySection.items[sectionLabel];
            const rangeText = sec.from !== null ? `Hinos ${sec.from}–${sec.to}` : "Outros";
            const isOpen = search.trim() ? true : !!openCategories[`hymn:${sectionLabel}`];
            const filteredHymns = search.trim()
              ? sec.hymns.filter(s => s.title?.toLowerCase().includes(search.toLowerCase()) || String(s.hymnNumber).includes(search))
              : sec.hymns;
            if (search.trim() && filteredHymns.length === 0) return null;
            return (
              <div key={sectionLabel} style={{ background: "#0c2419", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden" }}>
                {/* Cabeçalho da seção */}
                <button
                  onClick={() => toggleCategory(`hymn:${sectionLabel}`)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#0e2c1f"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 4, height: 18, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#cfe6d9", textTransform: "uppercase", letterSpacing: 1.1 }}>{sectionLabel}</span>
                    <span style={{ fontSize: 11, color: "#5d917a", marginLeft: 10, fontWeight: 500 }}>{rangeText}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "#5d917a", marginRight: 6 }}>{filteredHymns.length}</span>
                  <span style={{ color: "#5d917a", transition: "transform .18s", display: "inline-flex", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <ChevronDown size={16} />
                  </span>
                </button>
                {/* Hinos da seção */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #15392b" }}>
                    {filteredHymns.map(s => (
                      <SongCard key={s.id} s={s} onOpen={onOpen} showHymnNumber={true} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Abas Por categoria / Por autor ── */
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
                      <SongCard key={s.id} s={s} onOpen={onOpen} showHymnNumber={false} />
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
  useWakeLock(true); // impede que a tela apague durante a apresentação ao vivo
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
            const secKey = sec._id || `${sec.type}-${sec.label||""}-${i}`;
            return (
              <div key={secKey} style={{ marginBottom: 26 }}>
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
                      <div style={{ fontSize: 10 * fontScale, color: "#9fdabb", fontStyle: "italic", marginTop: 1, lineHeight: 1.3 }}>♪ {sec.note}</div>
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
      // a cifra precisa de respiro à direita sempre que houver cifra,
      // e respiro extra quando a cifra é mais larga que a sílaba abaixo
      const needsGap = chordStr && chordStr.length >= Math.max(textLen, 1);
      const chPad = chordStr ? (needsGap ? "padding-right:.9em" : "padding-right:.35em") : "";
      return `<span class="col"><span class="ch"${chPad ? ` style="${chPad}"` : ""}>${chordStr || "&nbsp;"}</span><span class="ly">${esc(g.text).replace(/ /g, "&nbsp;") || "&nbsp;"}</span></span>`;
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
  const { playing, setPlaying, beat, beatsPerBar } = useMetronome(song.bpm || 120, song.timeSig);
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
          {playing && <div style={{ display: "flex", gap: 5 }}>{Array.from({ length: beatsPerBar }, (_, i) => i + 1).map(b => <div key={b} style={{ width: 9, height: 9, borderRadius: "50%", background: beat === b ? (b === 1 ? "#e8554d" : "#fff") : "rgba(255,255,255,.2)" }} />)}</div>}
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
          const secKey = sec._id || `${sec.type}-${sec.label||""}-${i}`;
          return (
            <div key={secKey} style={{ marginBottom: 28 }}>
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
                style={{ whiteSpace: "pre", cursor: "pointer", color: "#eef5f0", background: chord ? "rgba(47,157,99,.15)" : "transparent", borderRadius: 2 }}>
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
    <div style={{ background: "#0c2419", border: "1px solid #1d4435", borderRadius: 10, padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "#9fc7b2" }}>Clique numa <strong style={{ color: "#fff" }}>sílaba</strong> para pôr o acorde acima dela. Clique num acorde para editar/remover.</span>
        <button onClick={() => { setDraftText(lines.map(l => parseLineToModel(l).text).join("\n")); setLyricsMode(true); }} style={{ ...ghostBtn(), padding: "5px 10px", fontSize: 12 }}>
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
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${parseInt(d)} de ${months[parseInt(m)-1]} de ${y}`;
  } catch(e) { return dateStr; }
}

function SetlistsView({ setlists, songs, canEdit, reopenSetlistId, onClearReopen, onBack, onSave, onDelete, onOpenSong }) {
  const [editing, setEditing] = useState(null);
  const [opened, setOpened] = useState(null);
  const { confirm, modal: confirmModal } = useConfirm();

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
        {confirmModal}
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
      onDelete={editing.id ? async () => { const ok = await confirm("Excluir este repertório? As músicas continuam no acervo."); if (ok) { await onDelete(editing.id); setEditing(null); } } : null} />;
  }

  // ----- lista de repertórios -----
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 90px" }}>
      {confirmModal}
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
        /* ── Abas Por categoria / Por autor ── */
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
  const toast = useToast();
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
    if (!name.trim()) { toast("Dê um nome ao repertório (ex: Culto de Domingo).", "error"); return; }
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
        💡 <strong>Dica prática:</strong> a distância de <em>Dó a Sol</em> é uma 5ª justa (7 semitons) —
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
    { name: "Blues", formula: "Pent. min + ♭5", ex: "Lá Dó Ré Mib Mi Sol", char: "Expressiva, tensão e resolução" },
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
    { symbol: "Cm",     name: "Menor",       semis: "1 – ♭3 – 5",      ex: "Dó Mib Sol",            char: "Expressivo, sombrio" },
    { symbol: "C7",     name: "Dom. 7",      semis: "1 – 3 – 5 – ♭7",  ex: "Dó Mi Sol Sib",         char: "Quer resolver — tensão" },
    { symbol: "Cmaj7",  name: "Maior 7",     semis: "1 – 3 – 5 – 7",   ex: "Dó Mi Sol Si",          char: "Suave, sofisticado (jazz)" },
    { symbol: "Cm7",    name: "Menor 7",     semis: "1 – ♭3 – 5 – ♭7", ex: "Dó Mib Sol Sib",        char: "Flutuante, jazz" },
    { symbol: "Cdim",   name: "Diminuto",    semis: "1 – ♭3 – ♭5",     ex: "Dó Mib Solb",           char: "Máxima tensão" },
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
        💡 <strong>Ciclo básico:</strong> Tônica → Subdominante → Dominante → Tônica
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
    { n: "VII", tipo: "m7♭5",     func: "Dominante",    cor: "#D85A30" },
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
        💡 <strong>Regra:</strong> qualquer sequência usando apenas esses acordes soará "dentro" da tonalidade.
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
        💡 Use o módulo <em>Harmonia Completa</em> para ver essas progressões transpostas para qualquer tom!
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
            { icon: "🎤", text: "Adaptar ao alcance vocal do cantor" },
            { icon: "🎸", text: "Facilitar as posições no instrumento" },
            { icon: "🔑", text: "Usar capo e tocar cifras abertas" },
            { icon: "🎵", text: "Combinar com outras músicas no set" },
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
        💡 No IPBCharts, use os controles <strong>Tom ↑↓</strong> e <strong>Capo ↑↓</strong> na visualização de cada cifra para ajustar em tempo real!
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
            { sig: "4/4", nome: "Quaternário", desc: "4 tempos por compasso · o mais comum no pop, rock, gospel", ex: "💓 💓 💓 💓" },
            { sig: "3/4", nome: "Ternário (valsa)", desc: "3 tempos · dança, hinos clássicos, baladas", ex: "💓 💓 💓" },
            { sig: "6/8", nome: "Composto", desc: "6 colcheias · sensação de dois grupos de 3 · rock, balada", ex: "💓·· 💓··" },
            { sig: "2/4", nome: "Binário", desc: "Marchas, sambas, música rápida", ex: "💓 💓" },
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
    { nome: "Mixolídio", grau: "V",   ex: "G A B C D E F",       char: "Maior com ♭7 · rock, blues, 'Sweet Home'" },
    { nome: "Eólio",     grau: "VI",  ex: "A B C D E F G",       char: "= Menor natural · melancólico, expressivo" },
    { nome: "Lócrio",    grau: "VII", ex: "B C D E F G A",       char: "Menor com ♭2 e ♭5 · muito tenso, raro" },
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
        💡 <strong>Dica:</strong> no louvor gospel e CCB, o modo <em>Mixolídio</em> é muito frequente —
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

// HTML da Harmonia Musical Completa (adaptado para o tema escuro do app)
const HARMONIA_HTML = "\n<style>html,body{background:#0a1f17;color:#eef5f0;font-family:Montserrat,Arial,sans-serif;margin:0;padding:8px 4px}*{box-sizing:border-box}</style>\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\n.sec-head{font-size:11px;font-weight:500;color:#6fae8a;padding:14px 16px 5px;letter-spacing:.07em;text-transform:uppercase;background:#0c2419;border-top:0.5px solid #15392b;border-bottom:0.5px solid #15392b}\n.row{display:flex;align-items:center;border-bottom:0.5px solid #15392b;transition:background .12s;cursor:default}\n.row:last-child{border-bottom:none}\n.row:hover{background:#0c2419}\n.icon-col{width:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:10px 0;font-size:18px;color:#6fae8a}\n.info{flex:1;padding:10px 12px 10px 4px}\n.nome{font-size:14px;font-weight:500;color:#eef5f0}\n.desc{font-size:12px;color:#9fdabb;margin-top:2px}\n.ex{font-size:11px;color:#6fae8a;margin-top:2px;font-style:italic}\n.badge{font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap;margin-right:14px}\n.tag-p{background:#EEEDFE;color:#3C3489}\n.tag-t{background:#E1F5EE;color:#085041}\n.tag-c{background:#FAECE7;color:#712B13}\n.tag-a{background:#FAEEDA;color:#633806}\n.tag-g{background:#F1EFE8;color:#444441}\n.chord-btn{font-size:12px;padding:5px 10px;border-radius:9px;border:0.5px solid #1d4435;background:transparent;color:#9fdabb;cursor:pointer;transition:all .12s}\n.chord-btn:hover{background:#0c2419}\n.chord-btn.active{background:#EEEDFE;color:#3C3489;border-color:#AFA9EC}\n.prog-btn{font-size:12px;padding:6px 12px;border-radius:9px;border:0.5px solid #1d4435;background:transparent;color:#9fdabb;cursor:pointer;transition:all .12s;text-align:left}\n.prog-btn:hover{background:#0c2419}\n.prog-btn.sel{background:#EEEDFE;color:#3C3489;border-color:#AFA9EC}\n.transp-bar{display:flex;align-items:center;gap:8px;padding:8px 16px 10px;background:#0c2419;border-bottom:0.5px solid #15392b;flex-wrap:wrap}\n.transp-label{font-size:11px;color:#6fae8a;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}\n.key-btn{font-size:12px;padding:4px 9px;border-radius:20px;border:0.5px solid #1d4435;background:transparent;color:#9fdabb;cursor:pointer;transition:all .12s;white-space:nowrap}\n.key-btn:hover{background:#0a1f17}\n.key-btn.sel{background:#7F77DD;color:#fff;border-color:#534AB7;font-weight:500}\n</style>\n\n<h2 class=\"sr-only\">Guia completo de harmonia musical com transposi\u00e7\u00e3o de tom</h2>\n\n<div style=\"padding:.5rem 0 0\">\n\n<div class=\"sec-head\">Tom de refer\u00eancia global</div>\n<div class=\"transp-bar\">\n  <span class=\"transp-label\">Transpor para \u2192</span>\n  <div style=\"display:flex;flex-wrap:wrap;gap:4px\" id=\"global-key-btns\"></div>\n  <span id=\"global-key-label\" style=\"font-size:12px;color:#9fdabb;margin-left:4px\"></span>\n</div>\n\n<div class=\"sec-head\">1 \u00b7 Intervalos \u2014 a dist\u00e2ncia entre duas notas</div>\n<div style=\"padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:0.5px solid #15392b\">\n  <div style=\"font-size:12px;color:#9fdabb;width:100%;margin-bottom:4px\">Clique em um intervalo para ver no piano \u2014 raiz = tom global</div>\n  <div id=\"piano-wrap\" style=\"position:relative;display:inline-flex;margin-bottom:8px\"></div>\n  <div id=\"interval-info\" style=\"width:100%;min-height:36px;font-size:13px;color:#eef5f0\"></div>\n</div>\n<div style=\"display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 12px;border-bottom:0.5px solid #15392b\" id=\"int-btns\"></div>\n\n<div class=\"sec-head\">2 \u00b7 Escalas \u2014 sequ\u00eancias de notas com car\u00e1ter</div>\n<div class=\"row\">\n  <span class=\"icon-col\">\u2600</span>\n  <div class=\"info\">\n    <div class=\"nome\">Maior (j\u00f4nica) <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T T S T T T S</span></div>\n    <div class=\"desc\">Som alegre, est\u00e1vel, conclusivo \u00b7 base da tonalidade ocidental</div>\n    <div class=\"ex\" id=\"sc-major-ex\">Ex: D\u00f3 R\u00e9 Mi F\u00e1 Sol L\u00e1 Si D\u00f3 \u00b7 \"Parab\u00e9ns pra voc\u00ea\", \"Let It Be\"</div>\n  </div><span class=\"badge tag-p\">Maior</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">\u263d</span>\n  <div class=\"info\">\n    <div class=\"nome\">Menor natural (e\u00f3lia) <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T S T T S T T</span></div>\n    <div class=\"desc\">Som melanc\u00f3lico, introspectivo \u00b7 par da escala maior</div>\n    <div class=\"ex\" id=\"sc-minor-ex\">Ex: L\u00e1 Si D\u00f3 R\u00e9 Mi F\u00e1 Sol L\u00e1 \u00b7 \"Summertime\", \"Nothing Else Matters\"</div>\n  </div><span class=\"badge tag-c\">Menor</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">\u2191</span>\n  <div class=\"info\">\n    <div class=\"nome\">Menor harm\u00f4nica <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T S T T S T\u00bd S</span></div>\n    <div class=\"desc\">7\u00ba grau elevado \u00b7 cria tens\u00e3o dram\u00e1tica, som \u00e1rabe/flamenco</div>\n    <div class=\"ex\" id=\"sc-harmm-ex\">Ex: L\u00e1 Si D\u00f3 R\u00e9 Mi F\u00e1 Sol# L\u00e1 \u00b7 m\u00fasica cl\u00e1ssica, metal, flamenco</div>\n  </div><span class=\"badge tag-c\">Menor</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">~</span>\n  <div class=\"info\">\n    <div class=\"nome\">Menor mel\u00f3dica <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T S T T T T S</span></div>\n    <div class=\"desc\">6\u00ba e 7\u00ba elevados na subida \u00b7 suaviza o salto da harm\u00f4nica</div>\n    <div class=\"ex\" id=\"sc-melm-ex\">Ex: jazz, m\u00fasica cl\u00e1ssica \u00b7 muito usada em solos</div>\n  </div><span class=\"badge tag-c\">Menor</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">5</span>\n  <div class=\"info\">\n    <div class=\"nome\">Pentat\u00f4nica maior <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T T T\u00bd T T\u00bd</span></div>\n    <div class=\"desc\">5 notas \u00b7 sem meios-tons, universalmente agrad\u00e1vel</div>\n    <div class=\"ex\" id=\"sc-pmaj-ex\">Ex: D\u00f3 R\u00e9 Mi Sol L\u00e1 \u00b7 pop, folk, blues, rock, m\u00fasica asi\u00e1tica</div>\n  </div><span class=\"badge tag-t\">5 notas</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">5</span>\n  <div class=\"info\">\n    <div class=\"nome\">Pentat\u00f4nica menor <span style=\"font-weight:400;color:#9fdabb\">\u00b7 T\u00bd T T T\u00bd T</span></div>\n    <div class=\"desc\">A mais usada para solos de guitarra de todos os tempos</div>\n    <div class=\"ex\" id=\"sc-pmin-ex\">Ex: L\u00e1 D\u00f3 R\u00e9 Mi Sol \u00b7 blues, rock, jazz, samba</div>\n  </div><span class=\"badge tag-t\">5 notas</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">b</span>\n  <div class=\"info\">\n    <div class=\"nome\">Blues <span style=\"font-weight:400;color:#9fdabb\">\u00b7 pentat\u00f4nica menor + \u266d5</span></div>\n    <div class=\"desc\">Nota azul (tritono) d\u00e1 o car\u00e1ter tenso e expressivo do blues</div>\n    <div class=\"ex\" id=\"sc-blues-ex\">Ex: L\u00e1 D\u00f3 R\u00e9 Mib Mi Sol \u00b7 blues, jazz, rock'n'roll</div>\n  </div><span class=\"badge tag-a\">Blues</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">M</span>\n  <div class=\"info\">\n    <div class=\"nome\">Modos gregos \u2014 7 modos da escala maior</div>\n    <div class=\"desc\">J\u00f4nico \u00b7 D\u00f3rico \u00b7 Fr\u00edgio \u00b7 L\u00eddio \u00b7 Mixol\u00eddio \u00b7 E\u00f3lio \u00b7 L\u00f3crio</div>\n    <div class=\"ex\">Cada modo come\u00e7a em um grau diferente \u00b7 cores \u00fanicas de tens\u00e3o</div>\n  </div><span class=\"badge tag-g\">Modos</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\">#</span>\n  <div class=\"info\">\n    <div class=\"nome\">Crom\u00e1tica, de tons inteiros, diminuta\u2026</div>\n    <div class=\"desc\">Escalas sim\u00e9tricas usadas em jazz, m\u00fasica contempor\u00e2nea e improvisa\u00e7\u00e3o</div>\n    <div class=\"ex\">Crom\u00e1tica: todas as 12 notas \u00b7 tons inteiros: 6 notas equidistantes</div>\n  </div><span class=\"badge tag-g\">Especial</span>\n</div>\n\n<div class=\"sec-head\">3 \u00b7 Tr\u00edades e t\u00e9trades \u2014 os blocos fundamentais</div>\n<div style=\"padding:12px 16px 14px;border-bottom:0.5px solid #15392b\">\n  <div style=\"font-size:12px;color:#9fdabb;margin-bottom:10px\">Selecione um tipo \u00b7 as notas mostradas usam o tom global</div>\n  <div style=\"display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px\" id=\"chord-btns\"></div>\n  <div id=\"chord-display\" style=\"min-height:80px\"></div>\n</div>\n\n<div class=\"sec-head\">4 \u00b7 Fun\u00e7\u00f5es harm\u00f4nicas \u2014 o que cada acorde faz</div>\n<div class=\"row\">\n  <div style=\"width:10px;min-width:10px;background:#7F77DD;align-self:stretch;border-radius:0\"></div>\n  <span class=\"icon-col\" style=\"font-size:13px;font-weight:500;color:#3C3489\">I</span>\n  <div class=\"info\">\n    <div class=\"nome\" style=\"color:#3C3489\">T\u00f4nica \u2014 repouso</div>\n    <div class=\"desc\">Centro tonal \u00b7 sensa\u00e7\u00e3o de chegada, estabilidade, \"em casa\"</div>\n    <div class=\"ex\">Graus: I, III, VI \u00b7 Ex: C em D\u00f3 maior</div>\n  </div><span class=\"badge tag-p\">Est\u00e1vel</span>\n</div>\n<div class=\"row\">\n  <div style=\"width:10px;min-width:10px;background:#D85A30;align-self:stretch;border-radius:0\"></div>\n  <span class=\"icon-col\" style=\"font-size:13px;font-weight:500;color:#712B13\">V</span>\n  <div class=\"info\">\n    <div class=\"nome\" style=\"color:#712B13\">Dominante \u2014 tens\u00e3o m\u00e1xima</div>\n    <div class=\"desc\">Quer resolver na t\u00f4nica \u00b7 tritono interno cria a atra\u00e7\u00e3o mais forte</div>\n    <div class=\"ex\">Graus: V, VII \u00b7 Ex: G7 em D\u00f3 maior</div>\n  </div><span class=\"badge tag-c\">Tens\u00e3o</span>\n</div>\n<div class=\"row\">\n  <div style=\"width:10px;min-width:10px;background:#1D9E75;align-self:stretch;border-radius:0\"></div>\n  <span class=\"icon-col\" style=\"font-size:13px;font-weight:500;color:#085041\">IV</span>\n  <div class=\"info\">\n    <div class=\"nome\" style=\"color:#085041\">Subdominante \u2014 movimento</div>\n    <div class=\"desc\">Entre t\u00f4nica e dominante \u00b7 d\u00e1 dire\u00e7\u00e3o sem m\u00e1xima tens\u00e3o</div>\n    <div class=\"ex\">Graus: II, IV \u00b7 Ex: F em D\u00f3 maior</div>\n  </div><span class=\"badge tag-t\">Movimento</span>\n</div>\n\n<div class=\"sec-head\">5 \u00b7 Cifra de acordes \u2014 leitura r\u00e1pida</div>\n<div style=\"padding:12px 16px;border-bottom:0.5px solid #15392b;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px\">\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">C</span> <span style=\"color:#9fdabb\">D\u00f3 maior</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Cm</span> <span style=\"color:#9fdabb\">D\u00f3 menor</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">C7</span> <span style=\"color:#9fdabb\">D\u00f3 dominante</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Cmaj7</span> <span style=\"color:#9fdabb\">D\u00f3 maior com 7\u00aa maior</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Cm7</span> <span style=\"color:#9fdabb\">D\u00f3 menor com 7\u00aa menor</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Cdim</span> <span style=\"color:#9fdabb\">D\u00f3 diminuto</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Caug</span> <span style=\"color:#9fdabb\">D\u00f3 aumentado</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Csus2/4</span> <span style=\"color:#9fdabb\">Suspens\u00e3o de 2\u00aa ou 4\u00aa</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">C9, C11, C13</span> <span style=\"color:#9fdabb\">Extens\u00f5es de jazz</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">C/E</span> <span style=\"color:#9fdabb\">Invers\u00e3o com baixo em Mi</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">C#, Cb</span> <span style=\"color:#9fdabb\">Sustenido / bemol</span></div>\n  <div style=\"font-size:13px;color:#eef5f0;padding:8px 10px;background:#0c2419;border-radius:9px\"><span style=\"font-weight:500\">Cadd9</span> <span style=\"color:#9fdabb\">Acorde com 9\u00aa adicionada</span></div>\n</div>\n\n<div class=\"sec-head\">6 \u00b7 Campo harm\u00f4nico \u2014 graus da tonalidade</div>\n<div style=\"padding:12px 16px 16px;border-bottom:0.5px solid #15392b\">\n  <div style=\"font-size:12px;color:#9fdabb;margin-bottom:10px\">Campo harm\u00f4nico maior transposto para o tom global</div>\n  <div style=\"display:flex;gap:6px;flex-wrap:wrap\" id=\"campo-wrap\"></div>\n  <div id=\"campo-info\" style=\"margin-top:10px;min-height:32px;font-size:13px;color:#eef5f0\"></div>\n</div>\n\n<div class=\"sec-head\">7 \u00b7 Progress\u00f5es mais usadas</div>\n<div style=\"padding:12px 16px 16px;border-bottom:0.5px solid #15392b\">\n  <div style=\"font-size:12px;color:#9fdabb;margin-bottom:10px\">Acordes transpostos para o tom global \u00b7 clique para detalhes</div>\n  <div style=\"display:flex;flex-direction:column;gap:6px\" id=\"prog-list\"></div>\n  <div id=\"prog-detail\" style=\"margin-top:12px;min-height:40px;font-size:13px;color:#eef5f0\"></div>\n</div>\n\n<div class=\"sec-head\">8 \u00b7 Conceitos avan\u00e7ados</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:15px;color:#6fae8a\">\u2192</span>\n  <div class=\"info\">\n    <div class=\"nome\">Modula\u00e7\u00e3o</div>\n    <div class=\"desc\">Mudan\u00e7a de tonalidade dentro de uma m\u00fasica \u00b7 d\u00e1 sensa\u00e7\u00e3o de \"eleva\u00e7\u00e3o\"</div>\n    <div class=\"ex\">Ex: \u00faltimo refr\u00e3o um semitom acima \u00b7 muito usado em pop e gospel</div>\n  </div><span class=\"badge tag-p\">Avan\u00e7ado</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:15px;color:#6fae8a\">II</span>\n  <div class=\"info\">\n    <div class=\"nome\">Dominante secund\u00e1ria \u2014 V/X</div>\n    <div class=\"desc\">Acorde dominante de um grau que n\u00e3o \u00e9 a t\u00f4nica \u00b7 cria tens\u00e3o local</div>\n    <div class=\"ex\" id=\"adv-sec-ex\">Ex: A7 em D\u00f3 maior resolve em Dm (V/II)</div>\n  </div><span class=\"badge tag-c\">Tens\u00e3o</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:14px;color:#6fae8a\">\u2194</span>\n  <div class=\"info\">\n    <div class=\"nome\">Empr\u00e9stimo modal</div>\n    <div class=\"desc\">Acorde de tom paralelo (maior/menor) inserido para cor diferente</div>\n    <div class=\"ex\" id=\"adv-emp-ex\">Ex: bVII em maior (Sol em D\u00f3) \u00b7 muito comum no rock</div>\n  </div><span class=\"badge tag-t\">Cor</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:14px;color:#6fae8a\">#</span>\n  <div class=\"info\">\n    <div class=\"nome\">Acorde napolitano (bII)</div>\n    <div class=\"desc\">Acorde maior constru\u00eddo sobre o 2\u00ba grau bemolizado \u00b7 muito dram\u00e1tico</div>\n    <div class=\"ex\" id=\"adv-nap-ex\">Ex: R\u00e9b maior em D\u00f3 menor \u00b7 \u00f3pera, cl\u00e1ssico, metal</div>\n  </div><span class=\"badge tag-a\">Cl\u00e1ssico</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:14px;color:#6fae8a\">dim</span>\n  <div class=\"info\">\n    <div class=\"nome\">Acorde diminuto de passagem</div>\n    <div class=\"desc\">Cria movimento crom\u00e1tico entre dois acordes \u00b7 substituto da dominante</div>\n    <div class=\"ex\" id=\"adv-dim-ex\">Ex: C \u2013 C#dim \u2013 Dm \u00b7 jazz, bossa nova, choro</div>\n  </div><span class=\"badge tag-g\">Passagem</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:13px;color:#6fae8a\">sub</span>\n  <div class=\"info\">\n    <div class=\"nome\">Substitui\u00e7\u00e3o de tr\u00edtono (SubV)</div>\n    <div class=\"desc\">Substitui o V7 pelo acorde a um tr\u00edtono de dist\u00e2ncia \u00b7 som jazz\u00edstico</div>\n    <div class=\"ex\" id=\"adv-sub-ex\">Ex: Db7 no lugar de G7 em D\u00f3 \u00b7 jazz, bossa nova</div>\n  </div><span class=\"badge tag-a\">Jazz</span>\n</div>\n<div class=\"row\">\n  <span class=\"icon-col\" style=\"font-size:13px;color:#6fae8a\">ped</span>\n  <div class=\"info\">\n    <div class=\"nome\">Nota pedal</div>\n    <div class=\"desc\">Uma nota (geralmente a t\u00f4nica ou dominante) mantida enquanto os acordes mudam</div>\n    <div class=\"ex\">Ex: baixo sustentado enquanto os acordes variam \u00b7 tens\u00e3o progressiva</div>\n  </div><span class=\"badge tag-g\">Textura</span>\n</div>\n\n</div>\n\n<script>\nconst ALL_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];\nconst NOTE_PT_SHARP = ['D\u00f3','D\u00f3#','R\u00e9','R\u00e9#','Mi','F\u00e1','F\u00e1#','Sol','Sol#','L\u00e1','L\u00e1#','Si'];\nconst NOTE_PT_FLAT  = ['D\u00f3','R\u00e9b','R\u00e9','Mib','Mi','F\u00e1','Solb','Sol','L\u00e1b','L\u00e1','Sib','Si'];\nconst PREFER_FLAT = [1,3,5,8,10];\nfunction notePT(idx){\n  const i=(idx%12+12)%12;\n  return PREFER_FLAT.includes(i)?NOTE_PT_FLAT[i]:NOTE_PT_SHARP[i];\n}\nfunction noteEN(idx){\n  const i=(idx%12+12)%12;\n  const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];\n  return PREFER_FLAT.includes(i)?flats[i]:ALL_NOTES[i];\n}\n\nconst KEY_LABELS = ['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B'];\nconst KEY_PT = ['D\u00f3','D\u00f3#/R\u00e9b','R\u00e9','R\u00e9#/Mib','Mi','F\u00e1','F\u00e1#/Solb','Sol','Sol#/L\u00e1b','L\u00e1','L\u00e1#/Sib','Si'];\n\nlet ROOT = 0;\n\nconst WHITE_KEYS_SEMIS = [0,2,4,5,7,9,11];\nconst BLACK_KEYS_DEF = [{idx:1,pos:1},{idx:3,pos:2},{idx:6,pos:4},{idx:8,pos:5},{idx:10,pos:6}];\n\nconst INTERVALS = [\n  {name:'Un\u00edssono',semi:0,qual:'P1',carac:'Nota repetida'},\n  {name:'2\u00aa menor',semi:1,qual:'m2',carac:'Tom mais tenso'},\n  {name:'2\u00aa maior',semi:2,qual:'M2',carac:'Tom de escala'},\n  {name:'3\u00aa menor',semi:3,qual:'m3',carac:'Som menor'},\n  {name:'3\u00aa maior',semi:4,qual:'M3',carac:'Som maior'},\n  {name:'4\u00aa justa',semi:5,qual:'P4',carac:'Est\u00e1vel, aberto'},\n  {name:'Tr\u00edtono', semi:6,qual:'TT',carac:'M\u00e1xima tens\u00e3o'},\n  {name:'5\u00aa justa',semi:7,qual:'P5',carac:'Mais est\u00e1vel'},\n  {name:'6\u00aa menor',semi:8,qual:'m6',carac:'Melanc\u00f3lico'},\n  {name:'6\u00aa maior',semi:9,qual:'M6',carac:'Aberto, doce'},\n  {name:'7\u00aa menor',semi:10,qual:'m7',carac:'Tens\u00e3o suave'},\n  {name:'7\u00aa maior',semi:11,qual:'M7',carac:'Tens\u00e3o aguda'},\n  {name:'8\u00aa (oitava)',semi:12,qual:'P8',carac:'Oitava completa'},\n];\n\nconst CHORDS = [\n  {id:'maj',label:'Maior',formula:'1 \u2013 3 \u2013 5',semis:[0,4,7],desc:'Som est\u00e1vel e brilhante \u00b7 base da m\u00fasica tonal'},\n  {id:'min',label:'Menor',formula:'1 \u2013 \u266d3 \u2013 5',semis:[0,3,7],desc:'Som sombrio e expressivo \u00b7 emo\u00e7\u00e3o, melancolia'},\n  {id:'dim',label:'Diminuto',formula:'1 \u2013 \u266d3 \u2013 \u266d5',semis:[0,3,6],desc:'Tr\u00eas meios-tons iguais \u00b7 m\u00e1xima tens\u00e3o'},\n  {id:'aug',label:'Aumentado',formula:'1 \u2013 3 \u2013 #5',semis:[0,4,8],desc:'Dois tons maiores \u00b7 som suspenso, misterioso'},\n  {id:'dom7',label:'Dominante 7',formula:'1 \u2013 3 \u2013 5 \u2013 \u266d7',semis:[0,4,7,10],desc:'O acorde que mais \"quer\" resolver \u00b7 motor tonal'},\n  {id:'maj7',label:'Maior 7',formula:'1 \u2013 3 \u2013 5 \u2013 7',semis:[0,4,7,11],desc:'Som suave e sofisticado \u00b7 jazz, bossa nova'},\n  {id:'min7',label:'Menor 7',formula:'1 \u2013 \u266d3 \u2013 5 \u2013 \u266d7',semis:[0,3,7,10],desc:'O acorde do jazz \u00b7 suave, flutuante'},\n  {id:'dim7',label:'Dim 7',formula:'1 \u2013 \u266d3 \u2013 \u266d5 \u2013 \u266d\u266d7',semis:[0,3,6,9],desc:'Completamente sim\u00e9trico \u00b7 4 notas equidistantes'},\n  {id:'sus2',label:'Sus2',formula:'1 \u2013 2 \u2013 5',semis:[0,2,7],desc:'Terceira substitu\u00edda por 2\u00aa \u00b7 som aberto, amb\u00edguo'},\n  {id:'sus4',label:'Sus4',formula:'1 \u2013 4 \u2013 5',semis:[0,5,7],desc:'Terceira substitu\u00edda por 4\u00aa \u00b7 quer resolver'},\n];\n\nconst CAMPO_SEMIS = [0,2,4,5,7,9,11];\nconst CAMPO_TIPOS = ['maj7','m7','m7','maj7','7','m7','m7\u266d5'];\nconst CAMPO_FUNC = ['T\u00f4nica','Subdominante','T\u00f4nica','Subdominante','Dominante','T\u00f4nica','Dominante'];\nconst CAMPO_GRAUS = ['I','II','III','IV','V','VI','VII'];\nconst CAMPO_CORS = ['#7F77DD','#1D9E75','#7F77DD','#1D9E75','#D85A30','#7F77DD','#D85A30'];\nconst CAMPO_CORTX = ['#3C3489','#085041','#3C3489','#085041','#712B13','#3C3489','#712B13'];\nconst CAMPO_CORBG = ['#EEEDFE','#E1F5EE','#EEEDFE','#E1F5EE','#FAECE7','#EEEDFE','#FAECE7'];\nconst CAMPO_MENOR = [false,true,true,false,false,true,true];\n\nconst PROGS = [\n  {label:'I \u2013 V \u2013 VI \u2013 IV',graus:[0,4,5,3],desc:'A progress\u00e3o mais popular do mundo \u00b7 literalmente milhares de m\u00fasicas',ex:'\"Let It Be\", \"No Woman No Cry\", \"With or Without You\"'},\n  {label:'I \u2013 IV \u2013 V \u2013 I',graus:[0,3,4,0],desc:'Cad\u00eancia aut\u00eantica completa \u00b7 o n\u00facleo da m\u00fasica cl\u00e1ssica e country',ex:'\"La Bamba\", hinos, blues de 12 compassos'},\n  {label:'II \u2013 V \u2013 I',graus:[1,4,0],desc:'A progress\u00e3o do jazz \u00b7 movimento de quartas descendentes',ex:'Standard de jazz, bossa nova, \"Garota de Ipanema\"'},\n  {label:'I \u2013 VI \u2013 IV \u2013 V',graus:[0,5,3,4],desc:'Progress\u00e3o dos anos 50-60 \u00b7 nostalgia e simplicidade',ex:'\"Stand By Me\", \"Earth Angel\"'},\n  {label:'VI \u2013 IV \u2013 I \u2013 V',graus:[5,3,0,4],desc:'Variante menor do I-V-VI-IV \u00b7 mais sombria e dram\u00e1tica',ex:'\"Pompeii\", \"Numb\", \"Wicked Game\"'},\n  {label:'I \u2013 bVII \u2013 IV',graus:[0,-1,3],desc:'Progress\u00e3o modal com empr\u00e9stimo \u00b7 som de rock cl\u00e1ssico',ex:'\"Sweet Home Alabama\", \"Here Comes the Sun\"'},\n  {label:'I \u2013 V \u2013 I (cad\u00eancia)',graus:[0,4,0],desc:'Cad\u00eancia perfeita \u00b7 resolu\u00e7\u00e3o mais forte da harmonia tonal',ex:'Final de frases musicais em toda m\u00fasica cl\u00e1ssica'},\n  {label:'IV \u2013 I (plagal)',graus:[3,0],desc:'Cad\u00eancia plagal \u00b7 resolu\u00e7\u00e3o suave, religiosa, \"am\u00e9n\"',ex:'Final de hinos, gospel, Beatles (\"Hey Jude\")'},\n];\n\nconst SCALE_MAJOR     = [0,2,4,5,7,9,11];\nconst SCALE_MINOR_NAT = [0,2,3,5,7,8,10];\nconst SCALE_MINOR_HAR = [0,2,3,5,7,8,11];\nconst SCALE_MINOR_MEL = [0,2,3,5,7,9,11];\nconst SCALE_PENT_MAJ  = [0,2,4,7,9];\nconst SCALE_PENT_MIN  = [0,3,5,7,10];\nconst SCALE_BLUES     = [0,3,5,6,7,10];\n\nfunction scaleNotes(semis){\n  return semis.map(s=>notePT((ROOT+s)%12)).join(' ');\n}\n\nfunction buildGlobalKeys(){\n  const wrap=document.getElementById('global-key-btns');\n  wrap.innerHTML='';\n  ALL_NOTES.forEach((n,i)=>{\n    const b=document.createElement('button');\n    b.className='key-btn'+(i===ROOT?' sel':'');\n    b.textContent=KEY_PT[i];\n    b.onclick=()=>{ROOT=i;refreshAll();};\n    wrap.appendChild(b);\n  });\n}\n\nfunction buildPiano(){\n  const wrap=document.getElementById('piano-wrap');\n  wrap.style.cssText='position:relative;display:inline-flex;height:90px;';\n  wrap.innerHTML='';\n  WHITE_KEYS_SEMIS.forEach((rel,i)=>{\n    const midi=(ROOT+rel)%12;\n    const k=document.createElement('div');\n    k.className='piano-key white';\n    k.dataset.semi=rel;\n    k.style.cssText=`width:28px;height:80px;background:#0a1f17;border:0.5px solid #1d4435;border-radius:0 0 4px 4px;display:inline-block;position:relative;margin-right:1px;vertical-align:top;cursor:pointer;transition:background .08s`;\n    k.innerHTML=`<span style=\"position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:9px;color:#6fae8a\">${notePT(midi)}</span>`;\n    wrap.appendChild(k);\n  });\n  BLACK_KEYS_DEF.forEach(b=>{\n    const midi=(ROOT+b.idx)%12;\n    const k=document.createElement('div');\n    k.className='piano-key black';\n    k.dataset.semi=b.idx;\n    k.style.cssText=`width:18px;height:50px;background:#eef5f0;border-radius:0 0 3px 3px;position:absolute;top:0;z-index:2;left:${b.pos*29-9}px;cursor:pointer;transition:background .08s`;\n    wrap.appendChild(k);\n  });\n}\n\nfunction highlightSemis(semis){\n  document.querySelectorAll('.piano-key').forEach(k=>{\n    const s=parseInt(k.dataset.semi);\n    const isBlack=k.classList.contains('black');\n    if(semis.includes(s)){\n      k.style.background=isBlack?'#534AB7':'#EEEDFE';\n      if(!isBlack)k.style.borderColor='#7F77DD';\n    } else {\n      k.style.background=isBlack?'#eef5f0':'#0a1f17';\n      if(!isBlack)k.style.borderColor='#1d4435';\n    }\n  });\n}\n\nlet activeInterval=null;\nfunction buildIntervalBtns(){\n  const wrap=document.getElementById('int-btns');\n  wrap.innerHTML='';\n  INTERVALS.forEach(iv=>{\n    const b=document.createElement('button');\n    b.className='chord-btn';\n    b.textContent=iv.qual;\n    b.title=iv.name;\n    b.onclick=()=>{\n      activeInterval=iv;\n      document.querySelectorAll('#int-btns .chord-btn').forEach(x=>x.classList.remove('active'));\n      b.classList.add('active');\n      const semis=[0,Math.min(iv.semi,11)].filter((v,i,a)=>a.indexOf(v)===i);\n      highlightSemis(semis);\n      const r=notePT(ROOT);\n      const t=notePT((ROOT+iv.semi)%12);\n      document.getElementById('interval-info').textContent=`${iv.qual} \u00b7 ${iv.name} (${iv.semi} semitom${iv.semi!==1?'s':''}) \u2014 ${iv.carac} \u00b7 ${r} \u2192 ${t}`;\n    };\n    wrap.appendChild(b);\n  });\n}\n\nlet activeChord=null;\nfunction buildChordBtns(){\n  const wrap=document.getElementById('chord-btns');\n  const disp=document.getElementById('chord-display');\n  wrap.innerHTML='';\n  CHORDS.forEach(ch=>{\n    const b=document.createElement('button');\n    b.className='chord-btn';\n    b.textContent=ch.label;\n    b.onclick=()=>{\n      activeChord=ch;\n      document.querySelectorAll('#chord-btns .chord-btn').forEach(x=>x.classList.remove('active'));\n      b.classList.add('active');\n      highlightSemis(ch.semis);\n      const noteNames=ch.semis.map(s=>notePT((ROOT+s)%12)).join(' \u2013 ');\n      const rootName=notePT(ROOT);\n      disp.innerHTML=`\n        <div style=\"font-size:14px;font-weight:500;color:#eef5f0;margin-bottom:4px\">${rootName} ${ch.label} \u00b7 f\u00f3rmula: ${ch.formula}</div>\n        <div style=\"font-size:13px;color:#9fdabb;margin-bottom:3px\">${noteNames}</div>\n        <div style=\"font-size:12px;color:#6fae8a\">${ch.desc}</div>\n      `;\n    };\n    wrap.appendChild(b);\n  });\n}\n\nfunction buildCampo(){\n  const wrap=document.getElementById('campo-wrap');\n  const info=document.getElementById('campo-info');\n  wrap.innerHTML='';\n  CAMPO_SEMIS.forEach((rel,i)=>{\n    const midi=(ROOT+rel)%12;\n    const nome=notePT(midi)+(CAMPO_MENOR[i]?'m':'');\n    const b=document.createElement('div');\n    b.style.cssText=`padding:8px 12px;border-radius:9px;background:${CAMPO_CORBG[i]};border:0.5px solid ${CAMPO_CORS[i]};cursor:pointer;transition:opacity .12s`;\n    b.innerHTML=`<div style=\"font-size:11px;color:${CAMPO_CORS[i]};font-weight:500\">${CAMPO_GRAUS[i]}</div><div style=\"font-size:14px;font-weight:500;color:${CAMPO_CORTX[i]}\">${nome}</div><div style=\"font-size:10px;color:${CAMPO_CORS[i]}\">${CAMPO_TIPOS[i]}</div>`;\n    b.onclick=()=>{\n      info.innerHTML=`<span style=\"font-weight:500\">${CAMPO_GRAUS[i]} grau \u2014 ${notePT(midi)} ${CAMPO_MENOR[i]?'menor':'maior'} ${CAMPO_TIPOS[i]}</span> \u00b7 Fun\u00e7\u00e3o: <span style=\"color:${CAMPO_CORS[i]};font-weight:500\">${CAMPO_FUNC[i]}</span>`;\n    };\n    wrap.appendChild(b);\n  });\n}\n\nfunction buildProgs(){\n  const list=document.getElementById('prog-list');\n  const detail=document.getElementById('prog-detail');\n  list.innerHTML='';\n  PROGS.forEach(p=>{\n    const b=document.createElement('button');\n    b.className='prog-btn';\n    const chordNames=p.graus.map(gi=>{\n      if(gi===-1){const midi=(ROOT+10)%12;return notePT(midi);}\n      const rel=CAMPO_SEMIS[gi];\n      const midi=(ROOT+rel)%12;\n      return notePT(midi)+(CAMPO_MENOR[gi]?'m':'');\n    }).join(' \u2013 ');\n    b.innerHTML=`<span style=\"font-weight:500;color:#eef5f0\">${p.label}</span> <span style=\"font-size:11px;color:#6fae8a;margin-left:8px\">${chordNames}</span>`;\n    b.onclick=()=>{\n      document.querySelectorAll('.prog-btn').forEach(x=>x.classList.remove('sel'));\n      b.classList.add('sel');\n      detail.innerHTML=`<div style=\"font-weight:500;margin-bottom:3px\">${p.label} <span style=\"color:#6fae8a;font-weight:400\">em ${notePT(ROOT)}</span></div><div style=\"color:#9fdabb;margin-bottom:3px\">${p.desc}</div><div style=\"font-size:12px;color:#6fae8a;font-style:italic\">${p.ex}</div>`;\n    };\n    list.appendChild(b);\n  });\n}\n\nfunction updateScales(){\n  const m=notePT(ROOT);\n  const rel=(ROOT+9)%12;\n  const relPt=notePT(rel);\n  document.getElementById('sc-major-ex').textContent=`Ex: ${scaleNotes(SCALE_MAJOR)} \u00b7 \"Parab\u00e9ns pra voc\u00ea\", \"Let It Be\"`;\n  document.getElementById('sc-minor-ex').textContent=`Ex: ${scaleNotes(SCALE_MINOR_NAT)} \u00b7 \"Summertime\", \"Nothing Else Matters\"`;\n  document.getElementById('sc-harmm-ex').textContent=`Ex: ${scaleNotes(SCALE_MINOR_HAR)} \u00b7 m\u00fasica cl\u00e1ssica, metal, flamenco`;\n  document.getElementById('sc-melm-ex').textContent=`Ex: ${scaleNotes(SCALE_MINOR_MEL)} (ascendente) \u00b7 jazz, m\u00fasica cl\u00e1ssica`;\n  document.getElementById('sc-pmaj-ex').textContent=`Ex: ${scaleNotes(SCALE_PENT_MAJ)} \u00b7 pop, folk, blues, rock`;\n  document.getElementById('sc-pmin-ex').textContent=`Ex: ${scaleNotes(SCALE_PENT_MIN)} \u00b7 blues, rock, jazz, samba`;\n  document.getElementById('sc-blues-ex').textContent=`Ex: ${scaleNotes(SCALE_BLUES)} \u00b7 blues, jazz, rock'n'roll`;\n}\n\nfunction updateAdvanced(){\n  const r=notePT(ROOT);\n  const ii=(ROOT+2)%12;const iiPt=notePT(ii);\n  const iv=(ROOT+5)%12;const ivPt=notePT(iv);\n  const v=(ROOT+7)%12;const vPt=notePT(v);\n  const bvii=(ROOT+10)%12;const bviiPt=notePT(bvii);\n  const bii=(ROOT+1)%12;const biiPt=notePT(bii);\n  const subv=(ROOT+6)%12;const subvPt=notePT(subv);\n  const csharp=(ROOT+1)%12;const csharpPt=notePT(csharp);\n  document.getElementById('adv-sec-ex').textContent=`Ex: ${notePT((ROOT+9)%12)}7 em ${r} maior resolve em ${iiPt}m (V/II)`;\n  document.getElementById('adv-emp-ex').textContent=`Ex: bVII em maior (${bviiPt} em ${r}) \u00b7 muito comum no rock`;\n  document.getElementById('adv-nap-ex').textContent=`Ex: ${biiPt} maior em ${r} menor \u00b7 \u00f3pera, cl\u00e1ssico, metal`;\n  document.getElementById('adv-dim-ex').textContent=`Ex: ${r} \u2013 ${csharpPt}dim \u2013 ${iiPt}m \u00b7 jazz, bossa nova, choro`;\n  document.getElementById('adv-sub-ex').textContent=`Ex: ${subvPt}7 no lugar de ${vPt}7 em ${r} \u00b7 jazz, bossa nova`;\n}\n\nfunction updateGlobalLabel(){\n  document.getElementById('global-key-label').textContent=`Tom: ${notePT(ROOT)} maior`;\n  document.querySelectorAll('#global-key-btns .key-btn').forEach((b,i)=>{\n    b.classList.toggle('sel',i===ROOT);\n  });\n}\n\nfunction refreshAll(){\n  updateGlobalLabel();\n  buildPiano();\n  buildIntervalBtns();\n  if(activeInterval){\n    const btns=document.querySelectorAll('#int-btns .chord-btn');\n    const idx=INTERVALS.findIndex(iv=>iv.qual===activeInterval.qual);\n    if(idx>=0){btns[idx].classList.add('active');highlightSemis([0,Math.min(activeInterval.semi,11)].filter((v,i,a)=>a.indexOf(v)===i));}\n  }\n  buildChordBtns();\n  if(activeChord){\n    const btns=document.querySelectorAll('#chord-btns .chord-btn');\n    const idx=CHORDS.findIndex(c=>c.id===activeChord.id);\n    if(idx>=0){\n      btns[idx].classList.add('active');\n      highlightSemis(activeChord.semis);\n      const noteNames=activeChord.semis.map(s=>notePT((ROOT+s)%12)).join(' \u2013 ');\n      document.getElementById('chord-display').innerHTML=`\n        <div style=\"font-size:14px;font-weight:500;color:#eef5f0;margin-bottom:4px\">${notePT(ROOT)} ${activeChord.label} \u00b7 f\u00f3rmula: ${activeChord.formula}</div>\n        <div style=\"font-size:13px;color:#9fdabb;margin-bottom:3px\">${noteNames}</div>\n        <div style=\"font-size:12px;color:#6fae8a\">${activeChord.desc}</div>\n      `;\n    }\n  }\n  updateScales();\n  buildCampo();\n  document.getElementById('campo-info').textContent='Clique em um grau para ver sua fun\u00e7\u00e3o';\n  buildProgs();\n  document.getElementById('prog-detail').textContent='Clique em uma progress\u00e3o para ver detalhes';\n  updateAdvanced();\n}\n\nbuildGlobalKeys();\nrefreshAll();\ndocument.getElementById('interval-info').textContent='Selecione um intervalo acima para ver no piano';\ndocument.getElementById('chord-display').innerHTML='<span style=\"font-size:13px;color:#6fae8a\">Selecione um acorde para ver a estrutura no piano</span>';\n</script>\n";

/* Componente que renderiza o HTML de harmonia num iframe responsivo */
function HarmoniaCompletaView({ onBack }) {
  const iframeRef = React.useRef(null);
  const [height, setHeight] = React.useState(600);

  // Ajusta a altura do iframe ao conteúdo conforme o usuário interage
  const onLoad = () => {
    try {
      const h = iframeRef.current?.contentDocument?.body?.scrollHeight;
      if (h && h > 100) setHeight(h + 24);
    } catch(e) {}
  };

  // Reajusta quando o conteúdo muda (ex: usuário clica em acordes)
  React.useEffect(() => {
    const iv = setInterval(() => {
      try {
        const h = iframeRef.current?.contentDocument?.body?.scrollHeight;
        if (h && Math.abs(h - height) > 20) setHeight(h + 24);
      } catch(e) {}
    }, 600);
    return () => clearInterval(iv);
  }, [height]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 10px 80px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "7px 12px" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: "clamp(18px,5vw,24px)", color: "#fff", lineHeight: 1.1 }}>🎹 Harmonia Musical</div>
          <div style={{ fontSize: 12, color: "#6fae8a", marginTop: 2 }}>Guia completo com transposição interativa</div>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={HARMONIA_HTML}
        onLoad={onLoad}
        style={{
          width: "100%", height: height, border: "none", borderRadius: 14,
          background: "#0a1f17", display: "block",
        }}
        title="Harmonia Musical Completa"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEORIA MUSICAL — Reconstrução pedagógica completa
// Progressão: Iniciante → Básico → Intermediário → Avançado
// Cada módulo: Conteúdo + Exercício interativo
// Piano: destaca posições ABSOLUTAS corretas independente do tom
// ═══════════════════════════════════════════════════════════════

// ── UTILITÁRIOS MUSICAIS ────────────────────────────────────────
const TM_SHARP  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TM_FLAT   = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const TM_PT_S   = ['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'];
const TM_PT_F   = ['Dó','Réb','Ré','Mib','Mi','Fá','Solb','Sol','Láb','Lá','Sib','Si'];

// Grafia canônica por tonalidade:
//   Tom de sustenidos (E, A, D, G, B, F#, C#...): usa #
//   Tom de bemóis (F, Bb, Eb, Ab, Db, Gb...): usa b
// Fonte: KEY_USES_FLATS já definido no app (linha ~71)

// Escala de 12 notas para uma tonalidade — sustenidos ou bemóis conforme o tom
function tmScaleForKey(keyIdx, isMinor) {
  // Nome canônico do tom para lookup no KEY_USES_FLATS
  // Tenta com sustenido e com bemol para achar o match
  const minor = isMinor;
  const nameSharp = TM_SHARP[((keyIdx%12)+12)%12] + (minor?"m":"");
  const nameFlat  = TM_FLAT [((keyIdx%12)+12)%12] + (minor?"m":"");
  const useFlats = (nameFlat in KEY_USES_FLATS)
    ? KEY_USES_FLATS[nameFlat]
    : (nameSharp in KEY_USES_FLATS)
      ? KEY_USES_FLATS[nameSharp]
      : /b/.test(nameFlat[0]); // fallback
  return useFlats ? TM_FLAT : TM_SHARP;
}
function tmScalePTForKey(keyIdx, isMinor) {
  const useFlats = tmScaleForKey(keyIdx, isMinor) === TM_FLAT;
  return useFlats ? TM_PT_F : TM_PT_S;
}

// Nota em PT respeitando o tom (root em semitom 0-11, isMinor bool)
function tmPTinKey(noteIdx, keyRoot, isMinor=false) {
  const n=((noteIdx%12)+12)%12;
  return tmScalePTForKey(keyRoot,isMinor)[n];
}
// Nota em EN respeitando o tom
function tmENinKey(noteIdx, keyRoot, isMinor=false) {
  const n=((noteIdx%12)+12)%12;
  return tmScaleForKey(keyRoot,isMinor)[n];
}

// Versão simples sem contexto (para o piano e nota isolada — usa o padrão mais comum)
// Segue: sustenido nos tons neutros, bemol nos tons de bemol
// Para nota isolada, usamos a grafia "mais comum" no contexto geral
const TM_PREFER_FLAT = new Set([1,3,6,8,10]); // Db Eb Gb Ab Bb (mais comuns que C# D# F# G# A#)
function tmPT(i)    { const n=((i%12)+12)%12; return TM_PREFER_FLAT.has(n)?TM_PT_F[n]:TM_PT_S[n]; }
function tmEN(i)    { const n=((i%12)+12)%12; return TM_PREFER_FLAT.has(n)?TM_FLAT[n]:TM_SHARP[n]; }
function tmNoteEN(root,interval){ return tmEN((root+interval+12)%12); }
function tmRandom(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function tmShuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

// Nomear acorde (cifra) no contexto de uma tonalidade
// chord: semitom absoluto da raiz; keyRoot: semitom da tônica; isMinor: se o grau é menor
function tmChordName(chordRoot, isMinorChord, keyRoot, keyIsMinor=false) {
  const rootName = tmENinKey(chordRoot, keyRoot, keyIsMinor);
  return rootName + (isMinorChord ? "m" : "");
}
// Nota em PT no contexto de uma tonalidade
function tmChordNamePT(chordRoot, isMinorChord, keyRoot, keyIsMinor=false) {
  const rootName = tmPTinKey(chordRoot, keyRoot, keyIsMinor);
  return rootName + (isMinorChord ? "m" : "");
}

// Piano interativo — highlight em semitons RELATIVOS ao root
// converte para posições absolutas antes de acender as teclas
function TmPiano({ root=0, highlight=[], onClick=null, size="md" }) {
  const W  = size==="sm"?22:size==="lg"?34:27;
  const H  = size==="sm"?64:size==="lg"?96:78;
  const BW = size==="sm"?14:size==="lg"?20:17;
  const BH = size==="sm"?38:size==="lg"?58:47;
  // teclas brancas e pretas em semitons absolutos (0=Dó, 1=Dó#…)
  const WHITES = [0,2,4,5,7,9,11];
  const BLACKS = [{s:1,p:1},{s:3,p:2},{s:6,p:4},{s:8,p:5},{s:10,p:6}];
  // converte highlight (relativo) → set absoluto
  const litAbs = new Set(highlight.map(rel => ((root+rel)%12+12)%12));
  return (
    <div style={{position:"relative",display:"inline-flex",height:H+4,userSelect:"none",flexShrink:0}}>
      {WHITES.map((abs,i) => {
        const lit = litAbs.has(abs);
        const rel = ((abs-root)%12+12)%12;
        return (
          <div key={i} onClick={()=>onClick&&onClick(rel,abs)} style={{
            width:W, height:H,
            background: lit ? "#7F77DD" : "#0d2a1d",
            border:"1px solid #1d4435", borderRadius:"0 0 5px 5px",
            display:"inline-flex", alignItems:"flex-end", justifyContent:"center",
            paddingBottom:3, position:"relative", marginRight:1,
            cursor:onClick?"pointer":"default", transition:"background .1s"
          }}>
            <span style={{fontSize:7,color:lit?"#fff":"#6fae8a",fontWeight:600}}>
              {tmPT(abs)}
            </span>
          </div>
        );
      })}
      {BLACKS.map(({s:abs,p}) => {
        const lit = litAbs.has(abs);
        const rel = ((abs-root)%12+12)%12;
        return (
          <div key={abs} onClick={()=>onClick&&onClick(rel,abs)} style={{
            width:BW, height:BH,
            background: lit ? "#534AB7" : "#eef5f0",
            borderRadius:"0 0 4px 4px",
            position:"absolute", top:0, zIndex:2,
            left: p*(W+1)-BW/2,
            cursor:onClick?"pointer":"default", transition:"background .1s"
          }}/>
        );
      })}
    </div>
  );
}

// Seletor de tom
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

// Feedback do exercício
function TmFB({ ok, msg }) {
  if (ok===null||ok===undefined) return null;
  return (
    <div style={{
      padding:"10px 14px",borderRadius:10,marginTop:10,
      background:ok?"rgba(47,157,99,.15)":"rgba(232,85,77,.15)",
      border:`1px solid ${ok?"#2f9d63":"#e8554d"}`,
      fontSize:13,color:ok?"#3fae6b":"#e8554d",fontWeight:600
    }}>
      {ok?"✓ ":"✗ "}{msg}
    </div>
  );
}

// Opção de exercício
function TmOpt({ label, onClick, state }) {
  const bg  = state==="correct"?"rgba(47,157,99,.2)":state==="wrong"?"rgba(232,85,77,.15)":"transparent";
  const br  = state==="correct"?"#2f9d63":state==="wrong"?"#e8554d":"#1d4435";
  const col = state==="correct"?"#3fae6b":state==="wrong"?"#e8554d":"#eef5f0";
  return (
    <button onClick={onClick} disabled={!!state} style={{
      padding:"9px 14px",borderRadius:9,border:`1px solid ${br}`,
      background:bg,color:col,cursor:state?"default":"pointer",
      fontFamily:"'Montserrat',sans-serif",fontSize:13,
      fontWeight:state==="correct"?700:400,textAlign:"left",transition:"all .15s"
    }}>{label}</button>
  );
}

// Container do exercício
function TmExercicio({ title, onNew, children, feedback }) {
  return (
    <div style={{background:"#091f14",border:"1px solid #2f4a38",borderRadius:14,
      padding:"16px 14px 18px",marginTop:18}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:12,flexWrap:"wrap",gap:8}}>
        <span style={{fontWeight:800,fontSize:14,color:"#fff"}}>Exercício — {title}</span>
        <button onClick={onNew} style={{
          fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #1d4435",
          background:"transparent",color:"#6fae8a",cursor:"pointer",
          fontFamily:"'Montserrat',sans-serif"
        }}>↺ Novo</button>
      </div>
      {children}
      {feedback}
    </div>
  );
}

// Estilos compartilhados
const tmS={
  h2:  {fontWeight:800,fontSize:"clamp(15px,4vw,18px)",color:"#fff",margin:"0 0 12px",lineHeight:1.2},
  h3:  {fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",color:"#9fdabb",margin:"16px 0 8px",letterSpacing:.3},
  p:   {fontSize:"clamp(12px,3.3vw,13.5px)",color:"#b0ccbc",lineHeight:1.7,margin:"0 0 10px"},
  note:{fontSize:"clamp(11px,2.8vw,12px)",color:"#6fae8a",fontStyle:"italic",lineHeight:1.5},
  card:{background:"#0a2b1e",border:"1px solid #1d4435",borderRadius:11,padding:"11px 13px",marginBottom:9},
  hl:  {background:"#0a2b1e",border:"1px solid #1d4435",borderRadius:10,padding:"10px 12px",marginBottom:12,
        fontSize:"clamp(12px,3.2vw,13px)",color:"#9fdabb",lineHeight:1.65},
  mono:{fontFamily:"'Space Mono',monospace"},
  pre: {fontFamily:"'Space Mono',monospace",background:"#061410",border:"1px solid #15392b",borderRadius:10,
        padding:"14px 16px",fontSize:"clamp(12px,3.4vw,13.5px)",color:"#7fd8a4",lineHeight:1.85,
        overflowX:"auto",marginBottom:12,whiteSpace:"pre",WebkitOverflowScrolling:"touch"},
  table:{width:"100%",borderCollapse:"collapse",fontSize:"clamp(11px,3vw,13px)",color:"#b0ccbc"},
  th:  {textAlign:"left",padding:"7px 10px",background:"#0a2b1e",color:"#6fae8a",
        fontWeight:600,fontSize:"clamp(10px,2.6vw,11.5px)",borderBottom:"1px solid #1d4435"},
  td:  {padding:"7px 10px",borderBottom:"1px solid #132e22",verticalAlign:"top"},
  tag: {display:"inline-block",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,
        background:"rgba(63,174,107,.15)",color:"#3fae6b",border:"1px solid #1d4435",marginRight:4},
  cifra:{display:"inline-block",background:"rgba(47,157,99,.15)",color:"#3fae6b",fontWeight:700,
         borderRadius:6,padding:"0 7px",...{fontFamily:"'Space Mono',monospace"},fontSize:13},
};

// Bloco de dados visual — substitui tabelas ASCII por linhas responsivas
function TmTabela({ colunas, linhas, destaque }) {
  return (
    <div style={{background:"#061410",border:"1px solid #15392b",borderRadius:12,overflow:"hidden",marginBottom:12}}>
      {linhas.map((linha,i)=>(
        <div key={i} style={{
          display:"flex",flexWrap:"wrap",gap:"2px 10px",
          padding:"10px 13px",
          borderBottom:i<linhas.length-1?"1px solid #0e2419":"none",
          background:i%2===0?"transparent":"rgba(63,174,107,.03)"
        }}>
          {linha.map((cel,j)=>(
            <div key={j} style={{
              flex:j===0?"0 0 100%":"1 1 auto",
              minWidth:j===0?"100%":"90px",
              fontSize:j===0?"clamp(13px,3.6vw,14px)":"clamp(11px,3vw,12.5px)",
              fontWeight:j===0?700:400,
              color:j===0?(destaque?.[i]||"#7fd8a4"):"#9fdabb",
              marginBottom:j===0?2:0,
              fontFamily:"'Montserrat',sans-serif",
            }}>
              {j>0&&colunas&&<span style={{color:"#5d917a",fontSize:10,marginRight:5}}>{colunas[j]}:</span>}
              {cel}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Bloco de diagrama/exemplo — fundo escuro, mais legível que o pre
function TmDiagrama({ children, titulo }) {
  return (
    <div style={{background:"#061410",border:"1px solid #15392b",borderRadius:12,padding:"14px 16px",marginBottom:12,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      {titulo&&<div style={{fontSize:11,fontWeight:700,color:"#5d917a",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{titulo}</div>}
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:"clamp(12px,3.4vw,13.5px)",color:"#7fd8a4",lineHeight:1.9,whiteSpace:"pre"}}>{children}</div>
    </div>
  );
}

const TmEx = TmExercicio;

function TmConceito({ icon, titulo, children }) {
  return <div style={{background:"#081a10",border:"1px solid #1d4435",borderRadius:13,padding:"14px 16px",marginBottom:14}}>
    <div style={{fontWeight:800,fontSize:14,color:"#9fdabb",marginBottom:8,display:"flex",gap:8,alignItems:"center"}}>
      {icon&&<span style={{fontSize:18}}>{icon}</span>}
      {titulo}
    </div>
    {children}
  </div>;
}

// Bloco de "Aplicação" — Pilar 3
function TmAplicacao({ children }) {
  return <div style={{background:"#0a2015",border:"1px solid #2f7d5744",borderRadius:13,padding:"14px 16px",marginBottom:14}}>
    <div style={{fontSize:11,fontWeight:700,color:"#3fae6b",textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>
      Aplicação prática
    </div>
    {children}
  </div>;
}

// Bloco de "Atenção / Dica"
function TmDica({ children }) {
  return <div style={{background:"rgba(224,179,65,.08)",border:"1px solid #e0b34133",borderRadius:11,padding:"12px 14px",marginBottom:12}}>
    <span style={{fontSize:11,fontWeight:700,color:"#e0b341",textTransform:"uppercase",letterSpacing:".06em",marginRight:8}}>Dica</span>
    <span style={{fontSize:13,color:"#e0b341",lineHeight:1.6}}>{children}</span>
  </div>;
}

// Estilos compartilhados

// ════════════════════════════════════════════════════════════════
//  MÓDULO 1 — Fundamentos do Som e da Nota
//  Progressão: O que é som → Notas → Piano → Enarmonia → Exercício
// ════════════════════════════════════════════════════════════════
function Mod01_Som() {
  const [sel,setSel]=React.useState(null);
  const [qNote,setQNote]=React.useState(null);
  const [opts,setOpts]=React.useState([]);
  const [fb,setFb]=React.useState(null);
  const [optSt,setOptSt]=React.useState({});
  const [secao,setSecao]=React.useState(0);
  const [quiz2,setQuiz2]=React.useState(null);
  const [quiz2St,setQuiz2St]=React.useState({});
  const [quiz2Fb,setQuiz2Fb]=React.useState(null);

  function newQ(){
    const n=tmRandom(0,11);
    setQNote(n);setOpts(tmShuffle([n,...tmShuffle([...Array(12).keys()].filter(x=>x!==n)).slice(0,3)]));
    setFb(null);setOptSt({});
  }
  function newQuiz2(){
    const pairs=[[0,1],[1,2],[4,5],[11,0]]; // pares de semitons
    const p=pairs[tmRandom(0,pairs.length-1)];
    setQuiz2(p);setQuiz2St({});setQuiz2Fb(null);
  }
  React.useEffect(()=>{newQ();newQuiz2();},[]);

  function answer(i){
    if(fb)return;const ok=i===qNote;
    const os={[i]:ok?"correct":"wrong"};if(!ok)os[qNote]="correct";
    setOptSt(os);
    setFb({ok,msg:ok?`Exato! É ${tmPT(qNote)}. Boa observação.`
      :`Não é bem isso. A nota destacada é ${tmPT(qNote)}. Observe: está em posição de tecla ${qNote%2===1||qNote===6||qNote===8||qNote===10?"preta":"branca"}.`});
  }
  function answerEnarm(resp){
    if(quiz2Fb)return;
    const [a,b]=quiz2;
    const dist=Math.abs(a-b)===1||Math.abs(a-b)===11?1:Math.abs(a-b);
    const ok=resp==="sim"&&dist===1||resp==="nao"&&dist!==1;
    // Simplificado: quiz2 sempre são semitons adjacentes
    const isAdj=Math.abs(a-b)===1||(a===11&&b===0)||(a===0&&b===11);
    const correct=isAdj?"sim":"nao";
    const os={[resp]:resp===correct?"correct":"wrong"};if(resp!==correct)os[correct]="correct";
    setQuiz2St(os);
    setQuiz2Fb({ok:resp===correct,msg:resp===correct
      ?`Correto! ${tmPT(a)} e ${tmPT(b)} estão a 1 semitom de distância — são vizinhos imediatos.`
      :`Atenção. ${tmPT(a)} e ${tmPT(b)} ${isAdj?"estão":"não estão"} a 1 semitom.`});
  }

  const secoes=["1. O Som","2. As 12 Notas","3. Enarmonia","4. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Antes de qualquer acorde ou progressão, precisamos entender o material bruto da música: o som e as notas. Não pule esta etapa — ela é a fundação de tudo."</em>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"transparent",color:secao===i?"#0d3d28":"#9fdabb",border:secao===i?"none":"1px solid #1d4435"}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é som? (Entendimento)">
          <p style={tmS.p}>Som é <strong style={{color:"#fff"}}>vibração que se propaga pelo ar</strong>. Quando uma corda de violão vibra, empurra o ar ao redor. Essas ondas chegam ao ouvido e o cérebro interpreta como som.</p>
          <p style={tmS.p}>O som tem <strong style={{color:"#fff"}}>4 propriedades</strong> — e todas aparecem na música:</p>
          <TmTabela
            colunas={["","o que é","na música","exemplo"]}
            linhas={[
              ["Altura","Velocidade da onda","Tom / nota","Dó agudo ≠ Dó grave"],
              ["Intensidade","Força da vibração","Volume","Piano vs Forte"],
              ["Timbre","Forma da onda","\"Cor\" do som","Violão ≠ Piano (mesma nota)"],
              ["Duração","Tempo da vibração","Valor rítmico","♩ vs ○"],
            ]}
          />
          <p style={tmS.p}><strong style={{color:"#fff"}}>Por que importa no louvor?</strong> Quando você afina o violão, ajusta a <em>altura</em>. Quando toca mais suave no momento da adoração, controla a <em>intensidade</em>. O som diferente entre o violão e o teclado é o <em>timbre</em>. Tudo isso é consciência musical.</p>
        </TmConceito>
        <TmDica>O Lá central (nota A4) vibra exatamente <strong>440 vezes por segundo</strong> — 440 Hz. É o padrão mundial de afinação. Quando o violão "está no A440", está nessa frequência.</TmDica>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="As 12 notas — Visualização do teclado">
          <p style={tmS.p}>A música ocidental usa <strong style={{color:"#fff"}}>12 notas</strong> que se repetem ciclicamente. A menor distância entre duas notas vizinhas chama-se <strong style={{color:"#fff"}}>semitom</strong>.</p>
          <TmDiagrama>{`TECLADO — uma oitava completa:

  ┌──┐ ┌──┐   ┌──┐ ┌──┐ ┌──┐
  │C#│ │D#│   │F#│ │G#│ │A#│   ← Teclas PRETAS (acidentais)
  │Db│ │Eb│   │Gb│ │Ab│ │Bb│   (dois nomes = enarmonia)
  └──┘ └──┘   └──┘ └──┘ └──┘
┌───┬───┬───┬───┬───┬───┬───┐
│ C │ D │ E │ F │ G │ A │ B │  ← Teclas BRANCAS (notas naturais)
│Dó │Ré │Mi │Fá │Sol│Lá │Si │
└───┴───┴───┴───┴───┴───┴───┘
  1   2   3   4   5   6   7     Sete notas naturais

IMPORTANTE: Entre Mi→Fá e Si→Dó NÃO existe tecla preta.
J� são semitons naturais! Por isso a escala de Dó usa só teclas brancas.`}</TmDiagrama>
          <p style={tmS.p}>Toque nas teclas abaixo — cada uma mostrará seu nome:</p>
        </TmConceito>
        <div style={{textAlign:"center",padding:"10px 0",overflowX:"auto"}}>
          <TmPiano root={0} highlight={sel!==null?[sel]:[]} onClick={(_,abs)=>setSel(sel===abs?null:abs)} size="lg"/>
        </div>
        {sel!==null
          ?<div style={{...tmS.card,textAlign:"center",marginTop:8}}>
            <span style={{fontSize:24,fontWeight:800,color:"#fff"}}>{tmPT(sel)}</span>
            <span style={{fontSize:13,color:"#6fae8a",marginLeft:10,...tmS.mono}}>
              {TM_SHARP[sel]!==TM_FLAT[sel]?`${TM_SHARP[sel]} / ${TM_FLAT[sel]}`:TM_SHARP[sel]}
            </span>
            <div style={{fontSize:12,color:"#9fdabb",marginTop:4}}>
              {["Raiz — o começo de tudo","Entre Dó e Ré — acidental (tecla preta)","Segunda nota natural","Entre Ré e Mi — acidental","Terceira nota — Mi e Fá são vizinhos naturais (semitom)","Quarta nota — Fá e Mi são vizinhos naturais (semitom)","Trítono de Dó — divide a oitava exatamente ao meio","Quinta nota — a mais estável além da oitava","Entre Sol e Lá — acidental","Base da afinação: Lá = 440 Hz","Entre Lá e Si — acidental","Última nota — Si e Dó são vizinhos naturais (semitom)"][sel]}
            </div>
          </div>
          :<p style={{...tmS.note,textAlign:"center"}}>Clique em qualquer tecla para descobrir seu nome e posição.</p>
        }
        <div style={{overflowX:"auto",marginTop:14}}>
          <table style={tmS.table}>
            <thead><tr>
              <th style={tmS.th}>Nome PT</th><th style={tmS.th}>Cifra EN</th>
              <th style={tmS.th}>Posição</th><th style={tmS.th}>Observação</th>
            </tr></thead>
            <tbody>{[0,1,2,3,4,5,6,7,8,9,10,11].map(n=>(
              <tr key={n} onClick={()=>setSel(sel===n?null:n)} style={{cursor:"pointer",background:sel===n?"#0a2b1e":"transparent"}}>
                <td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{tmPT(n)}</td>
                <td style={{...tmS.td,...tmS.mono,color:"#3fae6b"}}>{TM_SHARP[n]}{TM_SHARP[n]!==TM_FLAT[n]?"/"+TM_FLAT[n]:""}</td>
                <td style={{...tmS.td,fontSize:12}}>{[1,3,6,8,10].includes(n)?"Preta (acidental)":"Branca (natural)"}</td>
                <td style={{...tmS.td,fontSize:12,color:"#6fae8a"}}>{n===4?"Vizinho de Fá (sem tecla preta entre eles)":n===5?"Vizinho de Mi (sem tecla preta entre eles)":n===11?"Vizinho de Dó (sem tecla preta entre eles)":n===0?"Início do ciclo":""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Enarmonia — Dois nomes, um som (Entendimento)">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Enarmonia</strong> é quando duas notas têm nomes diferentes mas produzem exatamente o mesmo som. É como chamar a mesma pessoa de "João" ou "John" — depende do idioma (aqui, da tonalidade).</p>
          <TmDiagrama>{`Os 5 pares enarmônicos:

  Dó# = Réb    (entre Dó e Ré)
  Ré# = Mib    (entre Ré e Mi)
  Fá# = Solb   (entre Fá e Sol)
  Sol#= Láb    (entre Sol e Lá)
  Lá# = Sib    (entre Lá e Si)

REGRA PRÁTICA para o louvor:
  Tonalidade de Mi (E), Lá (A), Ré (D)... → usa SUSTENIDOS (#)
  Tonalidade de Fá (F), Sib (Bb), Mib (Eb) → usa BEMÓIS (b)

Por isso:
  Em Mi maior → o acorde é C#m (não Dbm!)
  Em Sib maior → o acorde é Cm e Dm (não B#m!)`}</TmDiagrama>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Por que dois nomes?</strong> Em teoria musical, cada grau da escala deve ter um nome diferente. Na escala de Lá maior (A B C# D E F# G#), o terceiro grau é C# — não Db — porque se fosse Db, teríamos dois "D" na escala (D e Db), o que seria confuso para leitura e análise.</p>
        </TmConceito>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Aplicação direta no violão:</strong></p>
          <TmDiagrama>{`Cifras equivalentes que você verá na prática:
  C# maior = Db maior  (mesma posição, nomes diferentes por tonalidade)
  F# maior = Gb maior
  G# menor = Ab menor
  
No louvor em Mi (E): você verá C#m, F#m, G#m — todos com sustenido.
No louvor em Mib (Eb): você verá Fm, Gm, Cm, Ab — todos com bemol.`}</TmDiagrama>
        </TmAplicacao>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Fixação — Exercícios de verificação">
          <p style={tmS.p}><span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Não avançamos sem testar. Responda com calma — se errar, vou explicar o porquê e tentar de novo."</em></p>
        </TmConceito>

        <TmEx title="Identificar nota no piano" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:12}}>Qual é a nota destacada?</p>
          {qNote!==null&&<>
            <div style={{textAlign:"center",marginBottom:14,overflowX:"auto"}}><TmPiano root={0} highlight={[qNote]} size="md"/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {opts.map(o=><TmOpt key={o} label={tmPT(o)} state={optSt[o]||null} onClick={()=>answer(o)}/>)}
            </div>
          </>}
        </TmEx>

        <div style={{...tmS.card,marginTop:16}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:10}}>São vizinhos (1 semitom)?</div>
          {quiz2&&<>
            <div style={{textAlign:"center",fontSize:20,fontWeight:700,color:"#fff",marginBottom:12}}>
              {tmPT(quiz2[0])} e {tmPT(quiz2[1])}
            </div>
            <div style={{display:"flex",gap:8}}>
              <TmOpt label="Sim, são vizinhos" state={quiz2St["sim"]||null} onClick={()=>answerEnarm("sim")}/>
              <TmOpt label="Não, têm uma nota entre eles" state={quiz2St["nao"]||null} onClick={()=>answerEnarm("nao")}/>
            </div>
            {quiz2Fb&&<TmFB ok={quiz2Fb.ok} msg={quiz2Fb.msg}/>}
          </>}
          <button onClick={newQuiz2} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"1px solid #1d4435",background:"transparent",color:"#6fae8a",cursor:"pointer",marginTop:10,fontFamily:"'Montserrat',sans-serif"}}>↺ Novo par</button>
        </div>

        <div style={{...tmS.card,marginTop:14}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:10}}>Reflexão do professor</div>
          {[
            {q:"Quantas notas existem em uma oitava no sistema temperado?",d:"Se respondeu 7 (as brancas), revise: as 5 teclas pretas também contam. São 12 notas."},
            {q:"Por que entre Mi e Fá não existe tecla preta?",d:"Porque a distância já é de 1 semitom — o mínimo possível. Uma tecla preta só aparece onde há 1 tom (2 semitons) entre dois vizinhos."},
            {q:"C# e Db são a mesma nota ou notas diferentes?",d:"Mesmo som, nomes diferentes. Usamos um ou outro dependendo da tonalidade da música."},
            {q:"Qual propriedade do som determina se uma nota é aguda ou grave?",d:"A altura (frequência). Maior frequência = mais agudo."},
          ].map((item,i)=><div key={i} style={{marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:4}}>
              <span style={{color:"#3fae6b",fontWeight:800,flexShrink:0}}>{i+1}.</span>
              <span style={{fontWeight:600,color:"#eef5f0",fontSize:13}}>{item.q}</span>
            </div>
            <div style={{fontSize:12,color:"#6fae8a",paddingLeft:16,lineHeight:1.5}}><em>Dica se errar: {item.d}</em></div>
          </div>)}
          <p style={{...tmS.note,marginTop:6}}>Responda mentalmente antes de ver a dica. Isso é aprendizado ativo.</p>
        </div>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 2 — Ritmo, Pulso e Compasso
// ════════════════════════════════════════════════════════════════
function Mod02_Ritmo() {
  const [playing,setPlaying]=React.useState(false);
  const [beat,setBeat]=React.useState(0);
  const [comp,setComp]=React.useState("4/4");
  const [bpm,setBpm]=React.useState(80);
  const [qComp,setQComp]=React.useState(null);
  const [fb,setFb]=React.useState(null);
  const [optSt,setOptSt]=React.useState({});
  const [secao,setSecao]=React.useState(0);
  const [vfAnswers,setVfAnswers]=React.useState({});
  const [vfFb,setVfFb]=React.useState({});
  const COMPS=["4/4","3/4","2/4","6/8","2/2","12/8","9/8","5/4","7/8"];

  React.useEffect(()=>{
    if(!playing){setBeat(0);return;}
    const beats=parseInt(comp.split("/")[0]);
    const ms=60000/bpm;
    const iv=setInterval(()=>setBeat(b=>(b+1)%beats),ms);
    return()=>clearInterval(iv);
  },[playing,bpm,comp]);

  function newQ(){const c=["4/4","3/4","2/4","6/8","2/2"][tmRandom(0,4)];setQComp(c);setFb(null);setOptSt({});}
  React.useEffect(()=>{newQ();},[]);
  function answerComp(c){
    if(fb)return;const ok=c===qComp;
    const os={[c]:ok?"correct":"wrong"};if(!ok)os[qComp]="correct";
    setOptSt(os);
    const beatsN=parseInt(qComp.split("/")[0]);
    setFb({ok,msg:ok?`Correto! ${qComp} — ${beatsN} tempos por compasso.`
      :`Não está certo. Era ${qComp}. Conte os acentos: ${parseInt(qComp.split("/")[0])} tempo${parseInt(qComp.split("/")[0])>1?"s":""} (1 forte + ${parseInt(qComp.split("/")[0])-1} fracos).`});
  }
  function answerVF(id,resp){
    if(vfFb[id])return;
    const correct=VF_ITEMS[id].resp;
    const ok=resp===correct;
    setVfAnswers(p=>({...p,[id]:resp}));
    setVfFb(p=>({...p,[id]:{ok,msg:ok?`Correto! ${VF_ITEMS[id].exp}`:`Errado. ${VF_ITEMS[id].exp}`}}));
  }
  const VF_ITEMS=[
    {q:"Pulso e ritmo são a mesma coisa.",resp:false,exp:"Pulso é regular e constante (como o coração). Ritmo é a organização dos sons SOBRE o pulso — pode variar."},
    {q:"Em 4/4, a semibreve preenche um compasso inteiro.",resp:true,exp:"Sim. A semibreve vale 4 tempos e 4/4 tem 4 tempos — exatamente um compasso."},
    {q:"O número de baixo na fórmula 3/8 indica 3 tempos.",resp:false,exp:"O número de baixo (8) indica QUAL figura vale 1 tempo (colcheia). O de cima (3) é a quantidade de tempos."},
    {q:"BPM 60 significa uma batida por segundo.",resp:true,exp:"Exato. 60 batidas em 60 segundos = 1 por segundo. É um andamento bem lento e tranquilo."},
  ];
  const beatsN=parseInt(comp.split("/")[0]);
  const qBeats=qComp?parseInt(qComp.split("/")[0]):4;

  const secoes=["1. Pulso e Ritmo","2. Figuras","3. Compassos","4. Metrônomo","5. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"O ritmo é o esqueleto da música. Sem ele, os acordes mais bonitos ficam sem sentido. Esta aula parece simples — mas muitos músicos pulam e ficam com lacunas sérias."</em>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"transparent",color:secao===i?"#0d3d28":"#9fdabb",border:secao===i?"none":"1px solid #1d4435"}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Pulso vs Ritmo — a diferença fundamental">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Pulso</strong> é a batida constante e regular que você sente quando ouve música — como o coração batendo. Ao bater o pé, você marca o pulso.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Ritmo</strong> é a organização dos sons e silêncios <em>sobre</em> esse pulso. Pode ser variado, sincopado, complexo.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>BPM (Beats Per Minute)</strong> = batidas por minuto. Mede a velocidade do pulso.</p>
          <TmDiagrama>{`Pulso (constante):  |  |  |  |  |  |  |  |  |
                    ♩  ♩  ♩  ♩  ♩  ♩  ♩  ♩

Ritmo (sobre ele):  ♩ ♪♪ ♩  ♩♪  ♩  ♪♪♩ ♩
                    (varia em cima do pulso fixo)

ANDAMENTO    BPM       SENSAÇÃO NO LOUVOR
─────────────────────────────────────────────
Grave        40–60     Contemplação, adoração profunda
Lento        60–80     Balada, hino solene
Moderato     80–100    Louvor suave
Alegretto    100–120   Louvor animado
Alegro       120–160   Louvor festivo, celebração`}</TmDiagrama>
        </TmConceito>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>No violão do louvor:</strong> a marcação de palhetada (↓↑↓↑) é o <em>ritmo</em>. A velocidade dessa marcação é o <em>BPM</em>. O padrão regular que sustenta tudo é o <em>pulso</em>.</p>
        </TmAplicacao>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Figuras rítmicas — quanto tempo cada som dura">
          <p style={tmS.p}>Cada figura representa uma <strong style={{color:"#fff"}}>duração</strong>. A referência universal é a <strong style={{color:"#fff"}}>semínima (♩) = 1 tempo</strong>.</p>
          <TmTabela
            colunas={["","valor","subdivisão","desenho"]}
            linhas={[
              ["○ Semibreve","4 tempos","1 nota","Oval aberta"],
              ["𝅗𝅥 Mínima","2 tempos","1 nota + haste","Oval aberta + haste"],
              ["♩ Semínima","1 tempo","1 nota + haste","Oval fechada + haste"],
              ["♪ Colcheia","½ tempo","+ 1 bandeira","Oval + haste + flag"],
              ["♬ Semicolcheia","¼ tempo","+ 2 bandeiras","+ 2 flags"],
              ["𝅘𝅥𝅯 Fusa","⅛ tempo","+ 3 bandeiras","+ 3 flags"],
            ]}
          />
          <TmDiagrama titulo="Pausas (silêncios)">{`𝄻  Pausa de semibreve  →  4 tempos
𝄼  Pausa de mínima     →  2 tempos
𝄽  Pausa de semínima   →  1 tempo
𝄾  Pausa de colcheia   →  ½ tempo`}</TmDiagrama>
          <TmDiagrama titulo="Ponto de aumento ( . )">{`Aumenta a duração da figura em 50%.

Mínima pontuada    = 2 + 1   = 3 tempos    (comum em 3/4)
Semínima pontuada  = 1 + ½   = 1,5 tempo   (comum em 6/8)`}</TmDiagrama>
          <TmDica>A semibreve não tem haste. A mínima tem haste mas o interior é aberto (vazado). A semínima tem haste e é preenchida. Isso facilita a leitura na partitura.</TmDica>
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Fórmulas de compasso — como organizar os tempos">
          <p style={tmS.p}>O compasso agrupa os tempos em unidades regulares, com acento periódico no primeiro tempo (o "forte").</p>
          <TmDiagrama titulo="Como ler a fórmula">{`   3   ←  Numerador: quantos tempos por compasso
  ───
   4   ←  Denominador: qual figura vale 1 tempo
          1=semibreve · 2=mínima · 4=semínima · 8=colcheia`}</TmDiagrama>
          <TmTabela
            colunas={["","tempos","acento","caráter","no louvor"]}
            linhas={[
              ["4/4","4","F-f-m-f","Universal, neutro","Maioria dos louvores"],
              ["3/4","3","F-f-f","Valsa, balanço","\"Quão Grande És Tu\""],
              ["2/4","2","F-f","Marcha, passo","Hinos litúrgicos"],
              ["2/2","2","F-f","Marcha rápida","Hinos ligeiros"],
              ["6/8","6","F-f-f-m-f-f","Balancinho duplo","Louvores cadenciados"],
              ["12/8","12","F-f-f-m-f-f-m","Blues, groove","Slow gospel"],
              ["9/8","9","F-f-f-m-f-f-m","Flutuante","Clássica, jazz"],
              ["5/4","5","F-f-m-f-f","Assimétrico","Prog rock, jazz"],
              ["7/8","7","F-f-f-m-f-f-m","Irregular","Metal, contemporâneo"],
            ]}
          />
          <p style={{...tmS.note,marginBottom:12}}>F = forte · m = médio · f = fraco</p>
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Metrônomo visual interativo — Aplicação">
          <p style={tmS.p}>Escolha um compasso, ajuste o BPM e <strong style={{color:"#fff"}}>observe o acento no tempo 1</strong> (vermelho). Depois: tente marcar com o pé enquanto o metrônomo toca.</p>
        </TmConceito>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
          {COMPS.map(c=><button key={c} onClick={()=>{setComp(c);setPlaying(false);setBeat(0);}} style={{fontSize:13,padding:"5px 13px",borderRadius:9,cursor:"pointer",fontWeight:700,...tmS.mono,background:comp===c?"#7F77DD":"transparent",color:comp===c?"#fff":"#9fdabb",border:comp===c?"1px solid #534AB7":"1px solid #1d4435"}}>{c}</button>)}
        </div>
        <div style={{...tmS.card,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,color:"#fff",fontSize:14}}>{comp} — {beatsN} tempo{beatsN>1?"s":""} por compasso</span>
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
              <span style={{fontSize:11,color:"#6fae8a"}}>BPM:</span>
              <input type="range" min={40} max={200} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{width:90,accentColor:"#3fae6b"}}/>
              <span style={{fontSize:14,color:"#9fdabb",minWidth:28,fontWeight:700}}>{bpm}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:14,flexWrap:"wrap"}}>
            {Array.from({length:beatsN},(_,i)=><div key={i} style={{width:46,height:46,borderRadius:"50%",background:playing&&beat===i?(i===0?"#e8554d":"#7F77DD"):"#0a2b1e",border:`2px solid ${i===0?"#e8554d55":"#7F77DD44"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===0?18:14,fontWeight:700,color:playing&&beat===i?"#fff":"#5d917a",transition:"background .05s"}}>{i+1}</div>)}
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={()=>setPlaying(p=>!p)} style={{padding:"9px 26px",borderRadius:11,border:"none",cursor:"pointer",background:playing?"#fff":"#3fae6b",color:playing?"#0d3d28":"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13}}>{playing?"⏸ Parar":"▶ Iniciar"}</button>
          </div>
        </div>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Exercício prático com o violão:</strong> metrônomo em 4/4 a 70 BPM. Cada batida = 1 riscada para baixo. Quando confortável: batidas 1 e 3 = riscada ↓, batidas 2 e 4 = riscada ↑.</p>
        </TmAplicacao>
      </div>}

      {secao===4&&<div>
        <TmEx title="Identificar compasso" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:10}}>Observe os acentos e identifique a fórmula de compasso:</p>
          {qComp&&<>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
              {Array.from({length:qBeats},(_,i)=><div key={i} style={{width:44,height:44,borderRadius:"50%",background:i===0?"rgba(232,85,77,.2)":"rgba(127,119,221,.15)",border:`2px solid ${i===0?"#e8554d44":"#7F77DD33"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:i===0?"#e8554d":"#7F77DD"}}>{i===0?"F":"f"}</div>)}
            </div>
            <p style={{...tmS.note,textAlign:"center",marginBottom:12}}>{qBeats} tempo{qBeats>1?"s":""} — F=forte · f=fraco</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {["4/4","3/4","2/4","6/8","2/2"].map(c=><TmOpt key={c} label={c} state={optSt[c]||null} onClick={()=>answerComp(c)}/>)}
            </div>
          </>}
        </TmEx>

        <div style={{...tmS.card,marginTop:16}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:10}}>Verdadeiro ou Falso</div>
          {VF_ITEMS.map((item,i)=><div key={i} style={{marginBottom:14}}>
            <p style={{...tmS.p,marginBottom:6}}><strong style={{color:"#fff"}}>{i+1}.</strong> {item.q}</p>
            <div style={{display:"flex",gap:7}}>
              <TmOpt label="Verdadeiro" state={vfFb[i]?vfAnswers[i]===true?(vfFb[i].ok?"correct":"wrong"):(VF_ITEMS[i].resp===true?"correct":null):null} onClick={()=>answerVF(i,true)}/>
              <TmOpt label="Falso" state={vfFb[i]?vfAnswers[i]===false?(vfFb[i].ok?"correct":"wrong"):(VF_ITEMS[i].resp===false?"correct":null):null} onClick={()=>answerVF(i,false)}/>
            </div>
            {vfFb[i]&&<TmFB ok={vfFb[i].ok} msg={vfFb[i].msg}/>}
          </div>)}
        </div>
      </div>}
    </div>
  );
}
// ════════════════════════════════════════════════════════════════
//  MÓDULO 3 — Intervalos
// ════════════════════════════════════════════════════════════════
function Mod03_Intervalos() {
  const [root,setRoot]=React.useState(0);const [sel,setSel]=React.useState(null);
  const [qRoot,setQRoot]=React.useState(0);const [qSemi,setQSemi]=React.useState(7);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const [secao,setSecao]=React.useState(0);
  const [invQSel,setInvQSel]=React.useState(null);const [invQFb,setInvQFb]=React.useState(null);const [invQSt,setInvQSt]=React.useState({});

  const IVS=[
    {s:0, q:"P1",n:"Uníssono",   qual:"Perfeito", car:"Mesma nota — repouso absoluto",         mus:"Vozes em uníssono no coral"},
    {s:1, q:"m2",n:"2ª menor",   qual:"Menor",    car:"Máxima tensão cromática — \"raspado\"", mus:"Mi→Fá, Si→Dó (vizinhos naturais)"},
    {s:2, q:"M2",n:"2ª maior",   qual:"Maior",    car:"Tom inteiro — passo básico da escala",  mus:"Dó→Ré, Sol→Lá"},
    {s:3, q:"m3",n:"3ª menor",   qual:"Menor",    car:"Melancólico, expressivo",               mus:"Pilar dos acordes menores (Am, Em...)"},
    {s:4, q:"M3",n:"3ª maior",   qual:"Maior",    car:"Brilhante, alegre",                    mus:"Pilar dos acordes maiores (C, G, D...)"},
    {s:5, q:"P4",n:"4ª justa",   qual:"Perfeito", car:"Estável, aberto, conclusivo",           mus:"\"Aqui está\" — Dó→Fá, Sol→Dó"},
    {s:6, q:"TT",n:"Trítono",    qual:"Aug/dim",  car:"Máxima dissonância — inquieto",        mus:"Tritono do dominante 7ª (3ª+7ª)"},
    {s:7, q:"P5",n:"5ª justa",   qual:"Perfeito", car:"Mais estável depois da oitava",        mus:"\"Power chord\", âncora do acorde"},
    {s:8, q:"m6",n:"6ª menor",   qual:"Menor",    car:"Melancolicamente belo",                mus:"Inversão da 3ª maior"},
    {s:9, q:"M6",n:"6ª maior",   qual:"Maior",    car:"Doce, luminoso",                       mus:"\"My Way\" — início da melodia"},
    {s:10,q:"m7",n:"7ª menor",   qual:"Menor",    car:"Tensão suave, jazzístico",             mus:"Dominante 7ª, blues, bossa nova"},
    {s:11,q:"M7",n:"7ª maior",   qual:"Maior",    car:"Tensão aguda, sofisticado",            mus:"Acorde maj7, jazz"},
    {s:12,q:"P8",n:"Oitava",     qual:"Perfeito", car:"Mesmo som, oitava acima",              mus:"Reforço de melodia em oitava"},
  ];

  function newQ(){
    const t=tmRandom(1,12);const r=tmRandom(0,11);
    setQSemi(t);setQRoot(r);setFb(null);setOptSt({});
    const cIv=IVS.find(x=>x.s===t);
    const wr=tmShuffle(IVS.filter(x=>x.s!==t)).slice(0,3);
    setOpts(tmShuffle([cIv,...wr]));
  }
  function newInvQ(){
    const iv=IVS[tmRandom(1,11)];
    setInvQSel(iv);setInvQFb(null);setInvQSt({});
  }
  React.useEffect(()=>{newQ();newInvQ();},[]);

  function answer(iv){
    if(fb)return;const ok=iv.s===qSemi;const cIv=IVS.find(x=>x.s===qSemi);
    const os={[iv.q]:ok?"correct":"wrong"};if(!ok&&cIv)os[cIv.q]="correct";
    setOptSt(os);
    setFb({ok,msg:ok?`Exato! ${cIv.q} — ${cIv.n}. ${cIv.s} semitom${cIv.s!==1?"s":""}. Caráter: ${cIv.car}.`
      :`Não é isso. De ${tmPTinKey(qRoot,qRoot)} a ${tmPTinKey(qRoot+qSemi,qRoot)} há ${qSemi} semitons = ${cIv.n}. Tente contar tecla por tecla no piano.`});
  }
  function answerInv(q){
    if(invQFb)return;
    const inv=9-invQSel.s;
    const invIv=IVS.find(x=>x.s===inv||(x.s===12&&inv===12));
    const ok=q===invIv?.q;
    const os={[q]:ok?"correct":"wrong"};if(!ok&&invIv)os[invIv.q]="correct";
    setInvQSt(os);
    setInvQFb({ok,msg:ok?`Correto! ${invQSel.n} invertida = ${invIv.n}. 9 - ${invQSel.s} = ${inv} semitons.`
      :`Não é isso. A inversão de ${invQSel.n} é ${invIv?.n}. Fórmula: 9 - ${invQSel.s} = ${inv} semitons.`});
  }

  const selIv=IVS.find(x=>x.s===sel);
  const invOf=invQSel?9-invQSel.s:null;
  const invOpts=invQSel?tmShuffle(IVS.filter(x=>x.s>=1&&x.s<=12)).slice(0,4):[];
  const invCorrect=invQSel?IVS.find(x=>x.s===invOf):null;
  const invOptsF=invQSel?tmShuffle([invCorrect,...invOpts.filter(x=>x!==invCorrect)].slice(0,4)):[];

  const secoes=["1. O que é","2. Tabela","3. Piano","4. Aplicação","5. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Intervalos são o DNA da harmonia. Todo acorde é uma combinação de intervalos. Quem entende intervalos, entende por que os acordes soam como soam."</em>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"transparent",color:secao===i?"#0d3d28":"#9fdabb",border:secao===i?"none":"1px solid #1d4435"}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é um intervalo — e por que existe?">
          <p style={tmS.p}>Um <strong style={{color:"#fff"}}>intervalo</strong> é a distância entre duas notas, medida em semitons. É o <strong style={{color:"#fff"}}>"tijolo" da harmonia</strong> — todo acorde, escala e melodia é construído combinando intervalos.</p>
          <TmDiagrama>{`ANATOMIA DE UM ACORDE (C maior = C E G):

  C ───────── E  = 4 semitons = 3ª maior  → caráter "alegre"
  E ───────── G  = 3 semitons = 3ª menor  → estabilidade
  C ───────── G  = 7 semitons = 5ª justa  → âncora

Se você muda a 3ª maior (4 semitons) para 3ª menor (3 semitons):
  C ── Eb ── G = Cm (Dó menor) → caráter "melancólico"

O caráter do acorde muda completamente com 1 semitom!`}</TmDiagrama>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Dois tipos:</strong> <strong style={{color:"#4f9dde"}}>Intervalo melódico</strong> = duas notas tocadas em sequência (melodia). <strong style={{color:"#e0b341"}}>Intervalo harmônico</strong> = duas notas simultâneas (harmonia/acorde).</p>
        </TmConceito>
        <TmConceito titulo="Classificação — Nome + Qualidade">
          <p style={tmS.p}>Todo intervalo tem duas partes: <strong style={{color:"#fff"}}>número</strong> (2ª, 3ª, 5ª...) e <strong style={{color:"#fff"}}>qualidade</strong> (maior, menor, justo, aumentado, diminuto).</p>
          <TmDiagrama>{`QUALIDADES:
  Perfeito (P): 1ª, 4ª, 5ª, 8ª — não têm "maior/menor", só "justo" ou alterado
  Maior (M):    2ª, 3ª, 6ª, 7ª — a versão "maior" (mais semitons)
  Menor (m):    2ª, 3ª, 6ª, 7ª — a versão "menor" (menos semitons)
  Aumentado (A): qualquer intervalo 1 semitom acima do justo/maior
  Diminuto (d):  qualquer intervalo 1 semitom abaixo do justo/menor`}</TmDiagrama>
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Tabela completa — de uníssono à oitava">
          <div style={{overflowX:"auto"}}>
          <table style={tmS.table}>
            <thead><tr>
              <th style={tmS.th}>Sigla</th><th style={tmS.th}>Nome</th>
              <th style={tmS.th}>Semi</th><th style={tmS.th}>Qualidade</th>
              <th style={tmS.th}>Caráter</th><th style={tmS.th}>Uso musical</th>
            </tr></thead>
            <tbody>{IVS.map(iv=><tr key={iv.q} onClick={()=>setSel(iv.s)} style={{cursor:"pointer",background:sel===iv.s?"#0a2b1e":"transparent"}}>
              <td style={{...tmS.td,...tmS.mono,color:"#9fdabb",fontWeight:700}}>{iv.q}</td>
              <td style={{...tmS.td,color:"#eef5f0",fontWeight:500}}>{iv.n}</td>
              <td style={{...tmS.td,color:"#3fae6b",fontWeight:700}}>{iv.s}</td>
              <td style={{...tmS.td,fontSize:12,color:"#6fae8a"}}>{iv.qual}</td>
              <td style={tmS.td}>{iv.car}</td>
              <td style={{...tmS.td,fontSize:12,color:"#9fdabb"}}>{iv.mus}</td>
            </tr>)}
            </tbody>
          </table>
          </div>
        </TmConceito>
        <TmConceito titulo="Inversão de intervalos">
          <p style={tmS.p}>Quando você coloca a nota de baixo uma oitava acima, o intervalo se <strong style={{color:"#fff"}}>inverte</strong>. Fórmula: <strong style={{color:"#fff"}}>9 − número original = intervalo invertido</strong>. A qualidade troca: maior↔menor, aumentado↔diminuto, perfeito→perfeito.</p>
          <TmDiagrama>{`3ª maior (4 semi) → invertida → 6ª menor (8 semi)  [4+8=12 ✓]
5ª justa (7 semi) → invertida → 4ª justa (5 semi)  [7+5=12 ✓]
7ª menor (10semi) → invertida → 2ª maior (2 semi)  [10+2=12 ✓]
3ª menor (3 semi) → invertida → 6ª maior (9 semi)  [3+9=12 ✓]`}</TmDiagrama>
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSel(null);}} label="Nota raiz"/>
        <p style={{...tmS.note,marginBottom:8}}>Selecione um intervalo para ver no piano:</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {IVS.map(iv=><button key={iv.q} onClick={()=>setSel(sel===iv.s?null:iv.s)} style={{fontSize:12,padding:"3px 9px",borderRadius:8,cursor:"pointer",fontWeight:sel===iv.s?700:400,...tmS.mono,background:sel===iv.s?"#7F77DD":"transparent",color:sel===iv.s?"#fff":"#9fdabb",border:sel===iv.s?"1px solid #534AB7":"1px solid #1d4435"}}>{iv.q}</button>)}
        </div>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:8}}>
          <TmPiano root={root} highlight={selIv?[0,selIv.s%12]:[]} size="md"/>
        </div>
        {selIv&&<div style={tmS.card}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:4}}>
            {selIv.q} — {selIv.n}
            <span style={{color:"#6fae8a",fontWeight:400,fontSize:12,marginLeft:8}}>{selIv.s} semitom{selIv.s!==1?"s":""}  · {selIv.qual}</span>
          </div>
          <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,marginBottom:6}}>
            {tmPTinKey(root,root)} → {tmPTinKey(root+selIv.s,root)}
          </div>
          <p style={{...tmS.p,marginBottom:2}}>{selIv.car}</p>
          <p style={{...tmS.note,margin:0}}>Uso: {selIv.mus}</p>
        </div>}
      </div>}

      {secao===3&&<div>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Acordes do louvor analisados em intervalos:</strong></p>
          <TmDiagrama>{`G (Sol maior) — G B D
  G → B = 4 semitons = 3ª maior  ← "alegre"
  B → D = 3 semitons = 3ª menor  ← estabilidade
  G → D = 7 semitons = 5ª justa  ← âncora

Em (Mi menor) — E G B
  E → G = 3 semitons = 3ª menor  ← "melancólico"
  G → B = 4 semitons = 3ª maior  ← equilíbrio

G7 (Sol dom. 7ª) — G B D F
  B → F = 6 semitons = trítono   ← MÁXIMA TENSÃO!
  Esse trítono EXIGE resolução → C (Dó).
  É por isso que G7 → C parece tão "certo".`}</TmDiagrama>
          <p style={{...tmS.note}}>No louvor, toda vez que você ouve G7 resolvendo em C, está sentindo o poder do trítono querendo resolver.</p>
        </TmAplicacao>
      </div>}

      {secao===4&&<div>
        <TmEx title="Nomear intervalo" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:10}}>Que intervalo separa as notas destacadas?</p>
          <div style={{textAlign:"center",marginBottom:12,overflowX:"auto"}}>
            <TmPiano root={qRoot} highlight={[0,qSemi%12]} size="md"/>
            <div style={{fontSize:13,color:"#9fdabb",marginTop:6}}>
              <span style={{color:"#7F77DD",fontWeight:700}}>{tmPTinKey(qRoot,qRoot)}</span>{" → "}
              <span style={{color:"#7F77DD",fontWeight:700}}>{tmPTinKey(qRoot+qSemi,qRoot)}</span>
              <span style={{color:"#5d917a",fontSize:11,marginLeft:8}}>({qSemi} semitom{qSemi!==1?"s":""})</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {opts.map(iv=><TmOpt key={iv.q} label={`${iv.q} — ${iv.n}`} state={optSt[iv.q]||null} onClick={()=>answer(iv)}/>)}
          </div>
        </TmEx>

        <TmEx title="Inversão de intervalos" onNew={newInvQ} fb={<TmFB ok={invQFb?.ok??null} msg={invQFb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:10}}>Qual é a inversão de:</p>
          {invQSel&&<>
            <div style={{...tmS.card,textAlign:"center",fontSize:18,...tmS.mono,color:"#fff",fontWeight:800,padding:14,marginBottom:12}}>{invQSel.q} — {invQSel.n} ({invQSel.s} semi)</div>
            <p style={{...tmS.note,marginBottom:10}}>Lembre: 9 − {invQSel.s} = {9-invQSel.s} semitons</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              {invOptsF.map(iv=><TmOpt key={iv.q} label={`${iv.q} — ${iv.n}`} state={invQSt[iv.q]||null} onClick={()=>answerInv(iv.q)}/>)}
            </div>
          </>}
        </TmEx>

        <div style={{...tmS.card,marginTop:14}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:8}}>Desafio analítico do professor</div>
          {[
            {q:"Por que o trítono é chamado de 'diabolus in musica' (o diabo na música)?",d:"Porque cria máxima dissonância e instabilidade. Na música medieval, era evitado. Hoje é o coração da tensão harmônica — especialmente no acorde dominante 7ª."},
            {q:"Qual intervalo define se um acorde é maior ou menor?",d:"A terça! Terça maior (4 semi) → acorde maior. Terça menor (3 semi) → acorde menor. Um semitom muda o caráter completamente."},
            {q:"Se inverto uma 3ª menor, que intervalo obtenho?",d:"6ª maior. 9 - 3 = 6, e a qualidade inverte: menor → maior."},
            {q:"Quantos semitons tem um intervalo composto de 9ª maior?",d:"Uma 2ª maior (2 semi) + uma oitava (12 semi) = 14 semitons. Intervalos acima da oitava são chamados de compostos."},
          ].map((item,i)=><div key={i} style={{marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:4}}>
              <span style={{color:"#3fae6b",fontWeight:800,flexShrink:0}}>{i+1}.</span>
              <span style={{fontWeight:600,color:"#eef5f0",fontSize:13}}>{item.q}</span>
            </div>
            <div style={{fontSize:12,color:"#6fae8a",paddingLeft:16,lineHeight:1.5}}><em>Resposta: {item.d}</em></div>
          </div>)}
        </div>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 4 — Escalas (Maior, Menores, Pentatônicas, Blues)
// ════════════════════════════════════════════════════════════════
function Mod04_Escalas() {
  const [root,setRoot]=React.useState(0);const [selSc,setSelSc]=React.useState("major");
  const [qRoot,setQRoot]=React.useState(0);const [qSc,setQSc]=React.useState("major");
  const [selN,setSelN]=React.useState([]);const [fb,setFb]=React.useState(null);
  const [secao,setSecao]=React.useState(0);
  const [mbPairs,setMbPairs]=React.useState([]);const [mbFb,setMbFb]=React.useState({});const [mbSt,setMbSt]=React.useState({});

  const ESCALAS={
    major:   {l:"Maior",            ivs:[0,2,4,5,7,9,11],f:"T T S T T T S",  d:"Alegre, estável — base da tonalidade ocidental.",   ex:"\"Aleluia\" (Handel), hinos, pop"},
    nat_min: {l:"Menor natural",    ivs:[0,2,3,5,7,8,10],f:"T S T T S T T",  d:"Melancólica — par relativo da maior.",              ex:"\"Nothing Else Matters\", baladas de louvor"},
    harm_min:{l:"Menor harmônica",  ivs:[0,2,3,5,7,8,11],f:"T S T T S T½ S",d:"7º grau elevado — tensão dramática.",               ex:"Música clássica, flamenco, metal"},
    mel_min: {l:"Menor melódica",   ivs:[0,2,3,5,7,9,11],f:"T S T T T T S", d:"6º e 7º elevados — suaviza o salto.",              ex:"Jazz, solos, música clássica"},
    pent_maj:{l:"Pentatônica Maior",ivs:[0,2,4,7,9],     f:"T T T½ T T½",   d:"5 notas sem meios-tons — universal.",               ex:"Pop, folk, rock, música asiática"},
    pent_min:{l:"Pentatônica Menor",ivs:[0,3,5,7,10],    f:"T½ T T T½ T",   d:"Base dos solos de guitarra.",                      ex:"Blues, rock, jazz, samba"},
    blues:   {l:"Blues",            ivs:[0,3,5,6,7,10],  f:"Pent.menor + ♭5",d:"Nota azul (♭5/TT) — tensão e expressividade.",   ex:"Blues, jazz, gospel, rock"},
    cromatica:{l:"Cromática",       ivs:[0,1,2,3,4,5,6,7,8,9,10,11],f:"S S S S S S S S S S S S",d:"12 notas — passagem, modulação.",ex:"Cromatismo, jazz, passagens de transição"},
  };
  const scIds=Object.keys(ESCALAS);
  const sc=ESCALAS[selSc];

  function newQ(){const s=scIds.filter(x=>x!=="cromatica")[tmRandom(0,scIds.length-2)];const r=tmRandom(0,11);setQSc(s);setQRoot(r);setFb(null);setSelN([]);}
  function newMB(){
    const pairs=[["maior e alegre","major"],["menor e melancólica","nat_min"],["5 notas, sons orientais","pent_maj"],["nota azul, tensão do blues","blues"],["menor, muito usada em solos","pent_min"]];
    const selected=tmShuffle(pairs).slice(0,3);
    setMbPairs(selected);setMbFb({});setMbSt({});
  }
  React.useEffect(()=>{newQ();newMB();},[]);
  function toggleN(rel){if(fb)return;setSelN(p=>p.includes(rel)?p.filter(x=>x!==rel):[...p,rel]);}
  function check(){if(fb)return;const qsc=ESCALAS[qSc];const ok=JSON.stringify([...selN].sort((a,b)=>a-b))===JSON.stringify([...qsc.ivs].sort((a,b)=>a-b));setFb({ok,msg:ok?`Correto! ${tmPTinKey(qRoot,qRoot)} ${qsc.l}: ${qsc.ivs.map(n=>tmPTinKey((qRoot+n)%12,qRoot)).join(" ")} — Fórmula: ${qsc.f}`:`Não está certo. ${tmPTinKey(qRoot,qRoot)} ${qsc.l}: ${qsc.ivs.map(n=>tmPTinKey((qRoot+n)%12,qRoot)).join(" ")}. Fórmula: ${qsc.f}`});}
  function answerMB(i,ans){
    if(mbFb[i])return;const ok=ans===mbPairs[i][1];
    const st={...mbSt,[i]:ok?"correct":"wrong"};setMbSt(st);
    setMbFb(p=>({...p,[i]:{ok,msg:ok?`Correto! "${mbPairs[i][0]}" = ${ESCALAS[mbPairs[i][1]].l}.`:`Errado. "${mbPairs[i][0]}" descreve a escala ${ESCALAS[mbPairs[i][1]].l}.`}}));
  }

  const notes=sc.ivs.map(n=>tmPTinKey((root+n)%12,root));
  const secoes=["1. O que é","2. Tipos","3. Prática","4. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Escalas são a paleta de cores do músico. Uma escala maior soa 'alegre', menor soa 'triste', blues soa 'expressivo'. Entender escalas é entender de onde vêm os acordes que você toca."</em>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"transparent",color:secao===i?"#0d3d28":"#9fdabb",border:secao===i?"none":"1px solid #1d4435"}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é uma escala — e por que existem tantos tipos?">
          <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>escala</strong> é uma sequência de notas em ordem, com um padrão fixo de tons (T=2 semitons) e semitons (S=1 semitom). Cada padrão cria um caráter sonoro único.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Relação com acordes:</strong> os acordes do campo harmônico são construídos <em>a partir das notas da escala</em>. Quando você toca em Sol maior (G), todos os acordes naturais (G, Am, Bm, C, D, Em, F#dim) vêm das notas da escala de Sol maior. Escala → acordes → harmonia.</p>
          <TmDiagrama>{`ESCALA DE DÓ MAIOR:
  Dó  Ré  Mi  Fá  Sol  Lá  Si  Dó
   T   T   S   T   T    T   S
   2   2   1   2   2    2   1  (semitons)

FORMULA GERAL DA ESCALA MAIOR: T T S T T T S
(igual em QUALQUER tonalidade)`}</TmDiagrama>
          <TmDica>A escala maior tem 7 notas, mas você precisa aprender a fórmula (T T S T T T S), não decorar todas as notas de cada tonalidade. Com a fórmula, você constrói qualquer escala.</TmDica>
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {scIds.map(id=><button key={id} onClick={()=>setSelSc(id)} style={{fontSize:12,padding:"4px 11px",borderRadius:8,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:selSc===id?700:400,background:selSc===id?"#7F77DD":"transparent",color:selSc===id?"#fff":"#9fdabb",border:selSc===id?"1px solid #534AB7":"1px solid #1d4435"}}>{ESCALAS[id].l}</button>)}
        </div>
        <div style={tmS.card}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{tmPTinKey(root,root)} {sc.l}</span>
            <span style={{fontSize:11,...tmS.mono,color:"#6fae8a"}}>{sc.f}</span>
          </div>
          <div style={{...tmS.mono,fontSize:15,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10}}>{notes.join("  ")}</div>
          <div style={{overflowX:"auto",marginBottom:8}}><TmPiano root={root} highlight={sc.ivs} size="sm"/></div>
          <p style={{...tmS.p,marginBottom:2}}>{sc.d}</p>
          <p style={{...tmS.note,margin:0}}>Ex: {sc.ex}</p>
        </div>
        <TmConceito titulo="Escalas relativas — maior e menor juntas">
          <p style={tmS.p}>Toda escala maior tem uma <strong style={{color:"#fff"}}>relativa menor natural</strong> que usa as mesmas notas — começa 3 semitons abaixo (ou no 6º grau). Ex: Dó maior e Lá menor usam as mesmas teclas brancas.</p>
          <TmDiagrama>{`Dó maior: Dó Ré Mi Fá Sol Lá Si Dó (mesmas notas)
Lá menor: Lá Si Dó Ré Mi  Fá Sol Lá  ← começa no 6º grau`}</TmDiagrama>
        </TmConceito>
      </div>}

      {secao===2&&<TmAplicacao>
        <p style={tmS.p}><strong style={{color:"#fff"}}>Escalas mais usadas no louvor — aplicação direta:</strong></p>
        <TmDiagrama>{`MAIOR: hinos, louvores alegres e festivos
  Dó maior: C D E F G A B — acordes: C Dm Em F G Am Bdim

MENOR NATURAL: adoração, músicas contemplativas  
  Lá menor: A B C D E F G — acordes: Am Bdim C Dm Em F G

PENTATÔNICA MENOR: solos de violão, improvisação
  Lá pent. min: A C D E G — "nenhuma nota errada nessa escala"
  Toque qualquer nota desta escala sobre Am e soará bem!

BLUES: expressividade, gospel soul
  A nota "azul" (♭5, o trítono) é o que dá aquele sabor único`}</TmDiagrama>
        <p style={tmS.note}>Dica para o louvor: se a música está em Mi menor, tente improvisar com a pentatônica menor de Mi (E G A B D). Funciona sobre todos os acordes desse campo harmônico.</p>
      </TmAplicacao>}

      {secao===3&&<div>
        <TmEx title="Montar a escala" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:4}}>Monte a escala de <strong style={{color:"#fff"}}>{tmPTinKey(qRoot,qRoot)} {ESCALAS[qSc].l}</strong>:</p>
          <p style={{...tmS.note,marginBottom:10}}>Fórmula: <span style={tmS.mono}>{ESCALAS[qSc].f}</span></p>
          <div style={{textAlign:"center",overflowX:"auto",marginBottom:8}}><TmPiano root={qRoot} highlight={selN} onClick={toggleN} size="md"/></div>
          <div style={{fontSize:13,color:"#9fdabb",marginBottom:10,minHeight:18}}>{selN.map(n=>tmPTinKey((qRoot+n)%12,qRoot)).join("  ")||"(selecione as teclas)"}</div>
          {!fb&&<button onClick={check} style={{padding:"8px 18px",borderRadius:9,border:"none",cursor:"pointer",background:"#3fae6b",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13}}>Verificar</button>}
        </TmEx>

        <div style={{...tmS.card,marginTop:14}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:10}}>Associar escala ao caráter</div>
          {mbPairs.map((pair,i)=><div key={i} style={{marginBottom:14}}>
            <p style={{...tmS.p,marginBottom:6}}><strong style={{color:"#fff"}}>{i+1}.</strong> Qual escala soa <em>"{pair[0]}"</em>?</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {["major","nat_min","pent_min","blues","pent_maj"].map(id=><TmOpt key={id} label={ESCALAS[id].l} state={mbSt[i]?id===pair[1]?(mbFb[i]?.ok?"correct":"wrong"):mbSt[i]==="correct"?null:id===pair[1]?"correct":null:null} onClick={()=>answerMB(i,id)}/>)}
            </div>
            {mbFb[i]&&<TmFB ok={mbFb[i].ok} msg={mbFb[i].msg}/>}
          </div>)}
          <button onClick={newMB} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"1px solid #1d4435",background:"transparent",color:"#6fae8a",cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>↺ Novos</button>
        </div>
      </div>}
    </div>
  );
}
// ════════════════════════════════════════════════════════════════
//  MÓDULO 5 — Acordes (Tríades, Tétrades, Inversões, Extensões)
// ════════════════════════════════════════════════════════════════
function Mod05_Acordes() {
  const [root,setRoot]=React.useState(0);const [selAc,setSelAc]=React.useState("maj");
  const [qRoot,setQRoot]=React.useState(0);const [qAc,setQAc]=React.useState("maj");
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const [secao,setSecao]=React.useState(0);
  const [analQ,setAnalQ]=React.useState(null);const [analFb,setAnalFb]=React.useState({});const [analSt,setAnalSt]=React.useState({});

  const AC={
    maj:  {l:"Maior",         s:[0,4,7],    f:"1–3–5",       d:"Estável, brilhante — tônica de tonalidade maior.",      ex:"C, G, D, E — I grau"},
    min:  {l:"Menor",         s:[0,3,7],    f:"1–♭3–5",      d:"Expressivo, melancólico — tônica menor.",               ex:"Am, Em, Dm — I menor, VI, II, III"},
    dim:  {l:"Diminuto",      s:[0,3,6],    f:"1–♭3–♭5",     d:"Máxima tensão — instável.",                            ex:"Bdim, F#dim — VII grau"},
    aug:  {l:"Aumentado",     s:[0,4,8],    f:"1–3–#5",      d:"Suspenso, misterioso — passagem.",                     ex:"Caug, Gaug — modulações"},
    sus2: {l:"Sus2",          s:[0,2,7],    f:"1–2–5",       d:"Aberto, sem caráter definido.",                        ex:"Csus2, Dsus2 — louvor contemporâneo"},
    sus4: {l:"Sus4",          s:[0,5,7],    f:"1–4–5",       d:"Tensão suave, quer resolver.",                         ex:"Gsus4 → G — cadência suavizada"},
    dom7: {l:"Dominante 7ª",  s:[0,4,7,10], f:"1–3–5–♭7",   d:"O motor da harmonia — trítono interno quer resolver.", ex:"G7, D7 — V grau"},
    maj7: {l:"Maior 7ª",      s:[0,4,7,11], f:"1–3–5–7",    d:"Suave, sofisticado — jazz, bossa.",                    ex:"Cmaj7, Fmaj7 — I e IV no jazz"},
    min7: {l:"Menor 7ª",      s:[0,3,7,10], f:"1–♭3–5–♭7",  d:"Jazzístico, flutuante.",                              ex:"Am7, Dm7, Em7 — louvor moderno"},
    dim7: {l:"Dim 7ª",        s:[0,3,6,9],  f:"1–♭3–♭5–bb7",d:"4 notas equidistantes — muito tenso.",                ex:"Bdim7 — passagem cromática"},
    m7b5: {l:"m7♭5 (meio-dim)",s:[0,3,6,10],f:"1–♭3–♭5–♭7", d:"II grau na cadência II-V-I menor.",                   ex:"Bm7♭5 — jazz, campo menor"},
    add9: {l:"Add9",          s:[0,4,7,14], f:"1–3–5–9",    d:"Maior com 9ª — cheio, moderno.",                       ex:"Cadd9, Gadd9 — louvor contemporâneo"},
  };
  const acIds=Object.keys(AC);const ac=AC[selAc];const realS=ac.s.map(n=>n%12);

  function newQ(){
    const a=acIds[tmRandom(0,acIds.length-1)];const r=tmRandom(0,11);
    setQAc(a);setQRoot(r);setFb(null);setOptSt({});
    const wr=tmShuffle(acIds.filter(x=>x!==a)).slice(0,5);setOpts(tmShuffle([a,...wr]));
  }
  function newAnal(){
    const progs=[
      {name:"G C Am F (em G)",chords:[["G","maj"],["C","maj"],["Am","min"],["F","maj"]],key:7,analysis:["I grau — Tônica","IV grau — Subdominante","VI grau — Tônica relativa","bVII — empréstimo modal"]},
      {name:"Em C G D (em G)",chords:[["Em","min"],["C","maj"],["G","maj"],["D","maj"]],key:7,analysis:["VI grau — Tônica","IV grau — Subdominante","I grau — Tônica","V grau — Dominante"]},
    ];
    const p=progs[tmRandom(0,progs.length-1)];
    setAnalQ(p);setAnalFb({});setAnalSt({});
  }
  React.useEffect(()=>{newQ();newAnal();},[]);

  function answer(id){
    if(fb)return;const ok=id===qAc;const os={[id]:ok?"correct":"wrong"};if(!ok)os[qAc]="correct";
    setOptSt(os);
    setFb({ok,msg:ok?`Exato! ${tmENinKey(qRoot,qRoot)} ${AC[qAc].l} (${AC[qAc].f}). ${AC[qAc].d}`
      :`Não está certo. As notas ${AC[qAc].s.map(n=>tmPTinKey((qRoot+n%12)%12,qRoot)).join("–")} formam ${tmENinKey(qRoot,qRoot)} ${AC[qAc].l} (${AC[qAc].f}).`});
  }
  const qHL=AC[qAc].s.map(n=>n%12);

  const secoes=["1. O que são","2. Tipos","3. Inversões","4. Extensões","5. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Um acorde é o coração da harmonia. Tudo que você toca no violão é um acorde. Entender a estrutura interna de cada um transforma você de tocador de formas para músico consciente."</em>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"transparent",color:secao===i?"#0d3d28":"#9fdabb",border:secao===i?"none":"1px solid #1d4435"}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Anatomia de um acorde — por que soa assim?">
          <p style={tmS.p}>Um <strong style={{color:"#fff"}}>acorde</strong> é a combinação simultânea de 3+ notas. <strong style={{color:"#fff"}}>Tríades</strong> = 3 notas. <strong style={{color:"#fff"}}>Tétrades</strong> = 4 notas. A <strong style={{color:"#fff"}}>fórmula de intervalos</strong> é o que define o tipo.</p>
          <TmDiagrama>{`TRÍADE — 3 notas empilhadas por terças:

  Fundamental (1): a nota que dá o nome — "a raiz"
  Terça (3 ou ♭3): DEFINE se é maior ou menor
  Quinta (5 ou ♭5 ou #5): estabiliza ou tensiona

C maior:    C – E – G    (3ª maior + 3ª menor)  → estável, alegre
C menor:    C – Eb– G    (3ª menor + 3ª maior)  → melancólico
C diminuto: C – Eb– Gb   (3ª menor + 3ª menor)  → máxima tensão
C aumentado:C – E – G#   (3ª maior + 3ª maior)  → suspenso

UM SEMITOM NA TERÇA MUDA TUDO:`}</TmDiagrama>
          <TmDica>A terça é a nota mais importante do acorde — ela decide o caráter. A quinta "ancora" o acorde. É por isso que guitarristas removem a terça em "power chords" para soar mais neutro.</TmDica>
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {acIds.map(id=><button key={id} onClick={()=>setSelAc(id)} style={{fontSize:12,padding:"4px 10px",borderRadius:8,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:selAc===id?700:400,background:selAc===id?"#7F77DD":"transparent",color:selAc===id?"#fff":"#9fdabb",border:selAc===id?"1px solid #534AB7":"1px solid #1d4435"}}>{AC[id].l}</button>)}
        </div>
        <div style={tmS.card}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
            <span style={{fontWeight:800,fontSize:16,color:"#fff"}}>{tmENinKey(root,root)}{selAc==="maj"?"":selAc==="min"?"m":selAc==="dom7"?"7":selAc==="maj7"?"maj7":selAc==="min7"?"m7":selAc==="dim"?"dim":selAc==="aug"?"aug":selAc==="sus2"?"sus2":selAc==="sus4"?"sus4":selAc==="dim7"?"dim7":selAc==="m7b5"?"m7♭5":"add9"}</span>
            <span style={{fontSize:11,...tmS.mono,color:"#6fae8a"}}>{ac.f}</span>
          </div>
          <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,marginBottom:10,letterSpacing:.5}}>{realS.map(n=>tmPTinKey((root+n)%12,root)).join("  ")}</div>
          <div style={{overflowX:"auto",marginBottom:8}}><TmPiano root={root} highlight={realS} size="sm"/></div>
          <p style={{...tmS.p,marginBottom:2}}>{ac.d}</p>
          <p style={{...tmS.note,margin:0}}>Ex: {ac.ex}</p>
        </div>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Inversões — movimento melódico no baixo">
          <p style={tmS.p}>Quando uma nota diferente da fundamental fica no baixo, criamos uma <strong style={{color:"#fff"}}>inversão</strong>. Notação: <span style={tmS.cifra}>G/B</span> = Sol com Si no baixo.</p>
          <TmDiagrama>{`C maior — posição fundamental e inversões:

  C/C: C E G  (fundamental)  ← Dó no baixo
  C/E: E G C  (1ª inversão)  ← Mi no baixo  
  C/G: G C E  (2ª inversão)  ← Sol no baixo

LINHA DE BAIXO MELÓDICA — muito usada no louvor:
  C → C/B → Am → C/G → F → G → C
  Dó   Si    Lá   Sol   Fá  Sol  Dó
  (baixo desce cromaticamente — muito expressivo)

PROGRESSÃO COM BAIXO DESCENDO:
  G → G/F# → Em → Em/D → C → G/B → Am → D7`}</TmDiagrama>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>No violão:</strong> C/E é a posição de Dó com o polegar no Mi da corda grossa, ou apenas deixar o Mi soar no acorde. G/B = corda 5ª no Si. Esses acordes criam um baixo melódico descendo que soa muito mais rico que acordes simples.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Extensões e tensões — além da tétrade">
          <p style={tmS.p}>Além das tétrades (7ª), podemos adicionar <strong style={{color:"#fff"}}>extensões</strong>: 9ª, 11ª, 13ª. Elas "coloram" o acorde sem mudar sua função harmônica.</p>
          <TmDiagrama>{`9ª = 2ª uma oitava acima    Ex: C9, Cmaj9, Am9
11ª = 4ª uma oitava acima   Ex: C11 (raro em dominantes)
13ª = 6ª uma oitava acima   Ex: G13 (jazz sofisticado)

ACORDES COM EXTENSÕES NO LOUVOR:
  Cadd9  = C + 9ª (sem a 7ª)  → cheio mas simples
  Em7    = Em + 7ª menor       → suave, jazzístico
  Fmaj7  = F + 7ª maior        → brilhante, soft

ACORDES ALTERADOS (tensões cromáticas):
  G7(#9)  = G7 com 9ª aumentada  → "Hendrix chord", gospel soul
  G7(b9)  = G7 com 9ª bemolizada → tensão máxima, flamenco
  G7(#5)  = G7 com 5ª aumentada  → suspenso, jazz`}</TmDiagrama>
        </TmConceito>
      </div>}

      {secao===4&&<div>
        <TmEx title="Identificar tipo de acorde" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:10}}>Que tipo de acorde está no piano? (tom: <strong style={{color:"#3fae6b"}}>{tmPTinKey(qRoot,qRoot)}</strong>)</p>
          <div style={{textAlign:"center",overflowX:"auto",marginBottom:12}}>
            <TmPiano root={qRoot} highlight={qHL} size="md"/>
            <div style={{...tmS.mono,fontSize:13,color:"#3fae6b",marginTop:6}}>{AC[qAc].s.map(n=>tmPTinKey((qRoot+n%12)%12,qRoot)).join("  ")}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {opts.map(id=><TmOpt key={id} label={AC[id].l} state={optSt[id]||null} onClick={()=>answer(id)}/>)}
          </div>
        </TmEx>
        <div style={{...tmS.card,marginTop:14}}>
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:8}}>Análise rápida — resposta aberta</div>
          {[
            {q:"Por que G7 quer resolver em C?",a:"Porque G7 contém um trítono (Si→Fá, 6 semitons) que cria tensão máxima. Si quer subir para Dó; Fá quer descer para Mi. Esses dois movimentos simultâneos = cadência perfeita V7→I."},
            {q:"Qual a diferença entre Cmaj7 e C7?",a:"Em Cmaj7, a 7ª é maior (Si natural — 11 semitons). Em C7, a 7ª é menor (Sib — 10 semitons). C7 tem o trítono Si-Fá que cria tensão. Cmaj7 é suave e estável."},
            {q:"O que é um acorde sus4 e para que serve?",a:"Sus4 substitui a terça pela 4ª justa (Csus4 = C F G). Sem terça, o acorde fica 'suspenso', ambíguo — não é maior nem menor. Muito usado antes de resolver no acorde maior."},
          ].map((item,i)=><div key={i} style={{marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:4}}>
              <span style={{color:"#3fae6b",fontWeight:800,flexShrink:0}}>{i+1}.</span>
              <span style={{fontWeight:600,color:"#eef5f0",fontSize:13}}>{item.q}</span>
            </div>
            <div style={{fontSize:12,color:"#6fae8a",paddingLeft:16,lineHeight:1.5}}>{item.a}</div>
          </div>)}
        </div>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULOS 6–10 compactos (mantêm metodologia, mais objetivos)
// ════════════════════════════════════════════════════════════════
function Mod06_Tonalidade() {
  const [root,setRoot]=React.useState(0);const [selG,setSelG]=React.useState(null);
  const [qRoot,setQRoot]=React.useState(0);const [qGrau,setQGrau]=React.useState(0);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});
  const CR=[0,2,4,5,7,9,11];const CT=["maj7","m7","m7","maj7","7","m7","m7♭5"];
  const CMN=[false,true,true,false,false,true,true];
  const CF=["Tônica","Subdominante","Tônica","Subdominante","Dominante","Tônica","Dominante"];
  const CC=["#7F77DD","#1D9E75","#7F77DD","#1D9E75","#D85A30","#7F77DD","#D85A30"];
  const GR=["I","II","III","IV","V","VI","VII"];
  const CIVS={maj7:[0,4,7,11],m7:[0,3,7,10],"7":[0,4,7,10],"m7♭5":[0,3,6,10]};
  function gN(r,i){return tmENinKey((r+CR[i])%12,r)+(CMN[i]?"m":"");}
  function newQ(){const r=tmRandom(0,11);const g=tmRandom(0,6);setQRoot(r);setQGrau(g);setFb(null);setOptSt({});}
  React.useEffect(()=>{newQ();},[]);
  function answer(i){if(fb)return;const ok=i===qGrau;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qGrau]="correct";setOptSt(os);setFb({ok,msg:ok?`Correto! ${gN(qRoot,qGrau)} é o ${GR[qGrau]} grau — ${CF[qGrau]}.`:`Errado. ${gN(qRoot,qGrau)} é o ${GR[qGrau]} grau (${CF[qGrau]}). I, III, VI = Tônica · II, IV = Subdominante · V, VII = Dominante.`});}
  const selGObj=selG!==null?{nome:gN(root,selG),tipo:CT[selG],func:CF[selG],cor:CC[selG],ivs:CIVS[CT[selG]]||[0,4,7],root:(root+CR[selG])%12}:null;
  const qCIvs=CIVS[CT[qGrau]]||[0,4,7];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"O campo harmônico é o mapa de uma tonalidade. Com ele, você sabe quais acordes 'pertencem' à música e qual a função de cada um."</em>
      </div>
      <TmConceito titulo="Campo Harmônico — os 7 acordes de uma tonalidade">
        <p style={tmS.p}>O <strong style={{color:"#fff"}}>campo harmônico</strong> é o conjunto dos 7 acordes formados usando exclusivamente as notas de uma escala. Cada acorde tem uma <strong style={{color:"#fff"}}>função</strong>:</p>
        <div style={{...tmS.hl}}>
          <span style={{color:"#7F77DD",fontWeight:700}}>● Tônica (I, III, VI)</span> = repouso, "em casa" &nbsp;·&nbsp;
          <span style={{color:"#1D9E75",fontWeight:700}}>● Subdominante (II, IV)</span> = movimento &nbsp;·&nbsp;
          <span style={{color:"#D85A30",fontWeight:700}}>● Dominante (V, VII)</span> = tensão que quer resolver
        </div>
        <TmDica><strong>No louvor em G (Sol):</strong> G Am Bm C D Em F#dim. A progressão G→C→D→G é I→IV→V→I (Tônica→Subdominante→Dominante→Tônica). É a progressão mais usada na história da música ocidental.</TmDica>
      </TmConceito>
      <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSelG(null);}} label="Tom"/>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
        {GR.map((g,i)=><button key={g} onClick={()=>setSelG(selG===i?null:i)} style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",textAlign:"center",fontFamily:"'Montserrat',sans-serif",minWidth:52,background:selG===i?`${CC[i]}33`:"#0a2417",border:`1px solid ${selG===i?CC[i]:"#15392b"}`,transition:"all .15s"}}>
          <div style={{fontSize:10,color:CC[i],fontWeight:600}}>{g}</div>
          <div style={{fontSize:14,color:"#fff",fontWeight:800}}>{gN(root,i)}</div>
          <div style={{fontSize:9,color:"#5d917a"}}>{CT[i]}</div>
        </button>)}
      </div>
      {selGObj&&<div style={tmS.card}>
        <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:4}}>
          {GR[selG]} — {selGObj.nome} {selGObj.tipo}
          <span style={{fontSize:12,color:selGObj.cor,fontWeight:500,marginLeft:8}}>Função: {selGObj.func}</span>
        </div>
        <div style={{...tmS.mono,fontSize:13,color:"#3fae6b",fontWeight:700,marginBottom:8}}>{selGObj.ivs.map(n=>tmPTinKey((selGObj.root+n)%12,root)).join("  ")}</div>
        <TmPiano root={selGObj.root} highlight={selGObj.ivs.map(n=>n%12)} size="sm"/>
      </div>}
      <div style={{overflowX:"auto",marginBottom:14}}>
        <table style={tmS.table}>
          <thead><tr><th style={tmS.th}>Grau</th><th style={tmS.th}>Acorde em {tmPTinKey(root,root)}</th><th style={tmS.th}>Tipo</th><th style={tmS.th}>Função</th></tr></thead>
          <tbody>{GR.map((g,i)=><tr key={g} onClick={()=>setSelG(selG===i?null:i)} style={{cursor:"pointer"}}><td style={{...tmS.td,fontWeight:900,color:CC[i],...tmS.mono}}>{g}</td><td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{gN(root,i)}</td><td style={{...tmS.td,fontSize:12,...tmS.mono,color:"#6fae8a"}}>{CT[i]}</td><td style={{...tmS.td,fontSize:12,color:CC[i]}}>{CF[i]}</td></tr>)}</tbody>
        </table>
      </div>
      <TmEx title="Identificar grau e função" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>No campo de <strong style={{color:"#3fae6b"}}>{tmPTinKey(qRoot,qRoot)} maior</strong>, qual grau é <strong style={{color:"#fff"}}>{gN(qRoot,qGrau)}</strong>?</p>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:12}}>
          <TmPiano root={(qRoot+CR[qGrau])%12} highlight={qCIvs.map(n=>n%12)} size="md"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {GR.map((g,i)=><TmOpt key={g} label={`${g} (${CF[i][0]})`} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod07_Progressoes() {
  const [root,setRoot]=React.useState(0);const [selP,setSelP]=React.useState(0);
  const [qP,setQP]=React.useState(0);const [qRoot,setQRoot]=React.useState(0);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const CR=[0,2,4,5,7,9,11];const CMN=[false,true,true,false,false,true,true];
  function gN(r,gi){if(gi===-1)return tmENinKey((r+10)%12,r);return tmENinKey((r+CR[gi])%12,r)+(CMN[gi]?"m":"");}
  const PROGS=[
    {l:"I–V–VI–IV",  gi:[0,4,5,3], d:"A mais popular do mundo — usada em milhares de músicas.",      ex:"\"Let It Be\", \"No Woman No Cry\", maioria dos louvores",                    lou:true},
    {l:"I–IV–V–I",  gi:[0,3,4,0], d:"Cadência autêntica — núcleo da música clássica e hinos.",        ex:"\"La Bamba\", blues de 12 compassos, hinos congregacionais",              lou:true},
    {l:"II–V–I",    gi:[1,4,0],   d:"A progressão do jazz — movimento de quartas descendentes.",       ex:"Standards de jazz, bossa nova, \"Garota de Ipanema\"",                    lou:false},
    {l:"I–VI–IV–V", gi:[0,5,3,4], d:"Progressão anos 50 — nostalgia, simplicidade.",                  ex:"\"Stand By Me\", doo-wop, muitos corinhos",                               lou:true},
    {l:"VI–IV–I–V", gi:[5,3,0,4], d:"Variante menor — sombria, dramática.",                           ex:"\"Pompeii\", músicas de adoração contemplativa",                          lou:true},
    {l:"IV–I (plagal)",gi:[3,0],  d:"Cadência plagal — o amém. Resolução suave, religiosa.",           ex:"Final de hinos, gospel, \"Hey Jude\"",                                    lou:true},
    {l:"I–bVII–IV", gi:[0,-1,3],  d:"Modal com empréstimo do Mixolídio — rock clássico.",             ex:"\"Sweet Home Alabama\", \"Here Comes the Sun\", louvor gospel",           lou:true},
    {l:"I–III–IV–V",gi:[0,2,3,4], d:"Pop clássico — muito usada em baladas e louvor.",               ex:"Baladas, praise & worship contemporâneo",                                 lou:true},
  ];
  function newQ(){const p=tmRandom(0,PROGS.length-1);const r=tmRandom(0,11);setQP(p);setQRoot(r);setFb(null);setOptSt({});const wr=tmShuffle([...Array(PROGS.length).keys()].filter(x=>x!==p)).slice(0,4);setOpts(tmShuffle([p,...wr]));}
  React.useEffect(()=>{newQ();},[]);
  function answer(i){if(fb)return;const ok=i===qP;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qP]="correct";setOptSt(os);setFb({ok,msg:ok?`Exato! ${PROGS[qP].l} — ${PROGS[qP].d}`:`Errado. Era ${PROGS[qP].l}. Analise: ${PROGS[qP].gi.map(gi=>gN(qRoot,gi)).join("–")}.`});}
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Reconhecer progressões de ouvido transforma sua leitura de cifra. Você começa a antecipar 'para onde vai' a música antes mesmo de ver o próximo acorde."</em>
      </div>
      <TmConceito titulo="Progressões e Cadências">
        <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>progressão</strong> é uma sequência de acordes. Uma <strong style={{color:"#fff"}}>cadência</strong> é um fechamento de frase musical — como a pontuação de um texto.</p>
        <TmDiagrama>{`PRINCIPAIS CADÊNCIAS:
  Autêntica perfeita  V7 → I   = Resolução forte — "ponto final"
  Autêntica imperfeita V → I   = Resolução menos conclusiva
  Plagal (amém)       IV → I  = Suave, religiosa — "vírgula"
  Meia cadência       ? → V   = Suspensão — "interrogação"
  Deceptiva           V → VI  = Surpresa — o VI substitui o I`}</TmDiagrama>
      </TmConceito>
      <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {PROGS.map((pg,i)=><button key={i} onClick={()=>setSelP(i)} style={{display:"flex",gap:10,alignItems:"flex-start",background:selP===i?"#0e2c1f":"transparent",border:`1px solid ${selP===i?"#2f7d57":"#15392b"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",fontFamily:"'Montserrat',sans-serif",transition:"all .15s"}}>
          <div style={{flex:1}}>
            <span style={{fontWeight:600,color:"#eef5f0",fontSize:13,...tmS.mono}}>{pg.l}</span>
            <span style={{fontSize:12,color:"#3fae6b",marginLeft:8}}>{pg.gi.map(gi=>gN(root,gi)).join(" – ")}</span>
            {pg.lou&&<span style={{...tmS.tag,marginLeft:8}}>Louvor</span>}
          </div>
        </button>)}
      </div>
      <div style={tmS.card}>
        <div style={{fontWeight:700,color:"#fff",fontSize:14,marginBottom:4}}>{PROGS[selP].l} em {tmPTinKey(root,root)}</div>
        <div style={{...tmS.mono,fontSize:16,color:"#3fae6b",fontWeight:700,marginBottom:8,letterSpacing:.5}}>{PROGS[selP].gi.map(gi=>gN(root,gi)).join("   –   ")}</div>
        <p style={{...tmS.p,marginBottom:3}}>{PROGS[selP].d}</p>
        <p style={{...tmS.note,margin:0}}>Ex: {PROGS[selP].ex}</p>
      </div>
      <TmEx title="Reconhecer progressão" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Em <strong style={{color:"#3fae6b"}}>{tmPTinKey(qRoot,qRoot)} maior</strong>, identifique esta progressão:</p>
        <div style={{...tmS.card,textAlign:"center",fontSize:16,...tmS.mono,color:"#fff",fontWeight:700,padding:16,marginBottom:12}}>{PROGS[qP].gi.map(gi=>gN(qRoot,gi)).join("   –   ")}</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {opts.map(i=><TmOpt key={i} label={`${PROGS[i].l}`} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod08_Modos() {
  const [root,setRoot]=React.useState(0);const [selM,setSelM]=React.useState(0);
  const [qM,setQM]=React.useState(0);const [qRoot,setQRoot]=React.useState(0);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const MODOS=[
    {n:"Jônico",   g:"I",  ivs:[0,2,4,5,7,9,11],f:"T T S T T T S",c:"Maior padrão — alegre, estável",          u:"Base da música tonal",                lou:"Maioria dos louvores"},
    {n:"Dórico",   g:"II", ivs:[0,2,3,5,7,9,10],f:"T S T T T S T",c:"Menor com 6ª maior — jazz, funk, soul",  u:"Improvisação, funk, jazz",             lou:"\"What Is This Place\" — soul gospel"},
    {n:"Frígio",   g:"III",ivs:[0,1,3,5,7,8,10],f:"S T T T S T T",c:"Menor com 2ª menor — flamenco, metal",   u:"Flamenco, metal extremo",              lou:"Raramente — muito tenso"},
    {n:"Lídio",    g:"IV", ivs:[0,2,4,6,7,9,11],f:"T T T S T T S",c:"Maior com #4 — cinematográfico, mágico", u:"Trilhas, John Williams",              lou:"Momentos de exaltação, glória"},
    {n:"Mixolídio",g:"V",  ivs:[0,2,4,5,7,9,10],f:"T T S T T S T",c:"Maior com ♭7 — rock, blues, gospel",    u:"Rock clássico, blues, gospel",         lou:"MUITO COMUM — I–bVII–IV no gospel"},
    {n:"Eólio",    g:"VI", ivs:[0,2,3,5,7,8,10],f:"T S T T S T T",c:"Menor natural padrão — melancólico",     u:"Base de toda tonalidade menor",        lou:"Adoração contemplativa, músicas de lamento"},
    {n:"Lócrio",   g:"VII",ivs:[0,1,3,5,6,8,10],f:"S T T S T T T",c:"Menor com ♭2 e ♭5 — tenso, instável",  u:"Metal extremo, contemporâneo",         lou:"Raramente utilizado no louvor"},
  ];
  function newQ(){const m=tmRandom(0,MODOS.length-1);const r=tmRandom(0,11);setQM(m);setQRoot(r);setFb(null);setOptSt({});const wr=tmShuffle([...Array(MODOS.length).keys()].filter(x=>x!==m)).slice(0,3);setOpts(tmShuffle([m,...wr]));}
  React.useEffect(()=>{newQ();},[]);
  function answer(i){if(fb)return;const ok=i===qM;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qM]="correct";setOptSt(os);setFb({ok,msg:ok?`Correto! Modo ${MODOS[qM].n}. "${MODOS[qM].c}"`:`Errado. Era ${MODOS[qM].n}. Observe: ${MODOS[qM].f} — o padrão específico é o que diferencia cada modo.`});}
  const m=MODOS[selM];const qm=MODOS[qM];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Os modos são paletas de cores diferentes. O Jônico é branco — neutro, estável. O Dórico tem uma nota que 'brilha' a mais. O Mixolídio é o mais comum no gospel sem que muitos percebam."</em>
      </div>
      <TmConceito titulo="Como funcionam os modos">
        <p style={tmS.p}>Os 7 modos são escalas derivadas da escala maior, cada uma começando em um grau diferente. Usam as <strong style={{color:"#fff"}}>mesmas notas</strong> da maior, mas o ponto de partida diferente cria um caráter sonoro único.</p>
        <TmDiagrama>{`Escala de DÓ maior: C D E F G A B C
  Começando no 1º grau (C): MODO JÔNICO     — C maior
  Começando no 2º grau (D): MODO DÓRICO     — Ré menor com caráter especial
  Começando no 3º grau (E): MODO FRÍGIO     — Mi menor com 2ª menor
  Começando no 4º grau (F): MODO LÍDIO      — Fá maior com #4
  Começando no 5º grau (G): MODO MIXOLÍDIO  — Sol maior com ♭7
  Começando no 6º grau (A): MODO EÓLIO      — Lá menor natural
  Começando no 7º grau (B): MODO LÓCRIO     — Si menor com ♭2 e ♭5`}</TmDiagrama>
        <TmDica><strong>Mixolídio no louvor:</strong> quando você ouve a progressão G–F–C em Sol, o Fá maior não pertence ao campo de Sol maior (seria F#dim). Esse Fá vem do modo Mixolídio de Sol — é o que dá aquele som "gospel rock" característico.</TmDica>
      </TmConceito>
      <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {MODOS.map((md,i)=><button key={md.n} onClick={()=>setSelM(i)} style={{fontSize:12,padding:"4px 11px",borderRadius:8,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:selM===i?700:400,background:selM===i?"#7F77DD":"transparent",color:selM===i?"#fff":"#9fdabb",border:selM===i?"1px solid #534AB7":"1px solid #1d4435"}}>{md.n}</button>)}
      </div>
      <div style={tmS.card}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{tmPTinKey(root,root)} {m.n}</span>
          <span style={{fontSize:10,...tmS.mono,color:"#6fae8a"}}>{m.f}</span>
          <span style={{fontSize:10,color:"#9b6ef0",fontWeight:600}}>grau {m.g}</span>
        </div>
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10}}>{m.ivs.map(n=>tmPTinKey((root+n)%12,root)).join("  ")}</div>
        <div style={{overflowX:"auto",marginBottom:8}}><TmPiano root={root} highlight={m.ivs.map(n=>n%12)} size="sm"/></div>
        <p style={{...tmS.p,marginBottom:2}}>{m.c}</p>
        <p style={{...tmS.note,marginBottom:4}}>Uso: {m.u}</p>
        <span style={{...tmS.tag}}>{m.lou}</span>
      </div>
      <TmEx title="Identificar modo" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Em <strong style={{color:"#3fae6b"}}>{tmPTinKey(qRoot,qRoot)}</strong>, que modo é esta escala?</p>
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10,padding:10,background:"#091f14",borderRadius:10}}>{qm.ivs.map(n=>tmPTinKey((qRoot+n)%12,qRoot)).join("  ")}</div>
        <div style={{overflowX:"auto",marginBottom:12}}><TmPiano root={qRoot} highlight={qm.ivs.map(n=>n%12)} size="sm"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {opts.map(i=><TmOpt key={i} label={`${MODOS[i].n} — ${MODOS[i].c.split(" — ")[0]}`} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod09_HarmoniaAvancada() {
  const [root,setRoot]=React.useState(0);
  const [qI,setQI]=React.useState(0);const [fb,setFb]=React.useState(null);
  const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const CONC=[
    {n:"Dominante secundária",t:"V/X",d:"Acorde V7 de um grau que não é a tônica — cria tensão local antes de resolver.",ap:"A7 antes de Dm em Dó maior (V/II). O A7 não é diatônico, mas resolve perfeitamente."},
    {n:"Empréstimo modal",t:"♭III, ♭VI, ♭VII",d:"Acorde importado da tonalidade paralela (maior↔menor) para colorir sem modular.",ap:"Fm em Dó maior (emprestado de Dó menor). Ab, Bb — muito no gospel e louvor."},
    {n:"Substituição de trítono",t:"SubV",d:"O V7 é substituído pelo acorde a 6 semitons — mesmo trítono interno, baixo cromático.",ap:"Db7 substituindo G7 em Dó. Baixo desce: D–Db–C (cromatismo no baixo)."},
    {n:"Modulação",t:"Mudança de tom",d:"Mudança de tonalidade dentro da música — cria elevação e renovação.",ap:"Último refrão um semitom acima. Modulação por acorde pivô (pertence a ambos os tons)."},
    {n:"Rearmonização",t:"Reharmonization",d:"Substituir um acorde por outro mais rico que ainda funcione harmonicamente.",ap:"C simples → Cmaj7 → Am/C. G7 → Db7 (substituição de trítono). Torna a harmonia mais rica."},
    {n:"Napolitano (♭II)",t:"♭II",d:"Acorde maior sobre o 2º grau bemolizado — muito dramático e expressivo.",ap:"Réb maior em Dó menor. Muito usado antes da dominante para máxima tensão."},
    {n:"Cadência deceptiva",t:"V → VI",d:"O V resolve no VI em vez do I — surpresa harmônica que evita a resolução esperada.",ap:"G7 → Em (em vez de G7 → C). O ouvinte espera Dó, recebe Mi menor — surpresa bela."},
  ];
  function newQ(){const i=tmRandom(0,CONC.length-1);setQI(i);setFb(null);setOptSt({});const wr=tmShuffle([...Array(CONC.length).keys()].filter(x=>x!==i)).slice(0,4);setOpts(tmShuffle([i,...wr]));}
  React.useEffect(()=>{newQ();},[]);
  function answer(i){if(fb)return;const ok=i===qI;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qI]="correct";setOptSt(os);setFb({ok,msg:ok?`Correto! "${CONC[qI].n}" — ${CONC[qI].d}`:`Errado. Era "${CONC[qI].n}". Releia a descrição e observe os elementos-chave.`});}
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Você chegou ao nível avançado. Estes recursos são o que separa quem 'toca acordes' de quem 'faz harmonia'. No louvor, dominantes secundárias e empréstimo modal aparecem o tempo todo."</em>
      </div>
      <TmKeyPicker value={root} onChange={setRoot} label="Tom de referência"/>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:6}}>
        {CONC.map((c,i)=><div key={c.n} style={{...tmS.card,padding:"13px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:"clamp(13px,3.5vw,14px)",color:"#eef5f0"}}>{c.n}</span>
            <span style={tmS.tag}>{c.t}</span>
          </div>
          <p style={{...tmS.p,marginBottom:4}}><strong style={{color:"#fff"}}>O que é:</strong> {c.d}</p>
          <p style={{...tmS.note,margin:0}}>Aplicação: {c.ap}</p>
        </div>)}
      </div>
      <TmEx title="Identificar recurso harmônico" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>Qual recurso harmônico está descrito?</p>
        <div style={{...tmS.card,fontSize:13,color:"#9fdabb",lineHeight:1.65,marginBottom:12,padding:"12px 14px"}}>{CONC[qI].d}</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {opts.map(i=><TmOpt key={i} label={CONC[i].n} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod10_Cifra() {
  const [qI,setQI]=React.useState(0);const [fb,setFb]=React.useState(null);
  const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const [analQ,setAnalQ]=React.useState(0);const [analFb,setAnalFb]=React.useState({});const [analSt,setAnalSt]=React.useState({});
  const SIMS=[
    {c:"C",     d:"Dó maior (I grau em Dó)",      n:"Dó  Mi  Sol"},
    {c:"Cm",    d:"Dó menor (I grau em Dó menor)", n:"Dó  Mib  Sol"},
    {c:"C7",    d:"Dó dominante 7ª (V grau)",      n:"Dó  Mi  Sol  Sib"},
    {c:"Cmaj7", d:"Dó maior com 7ª maior",         n:"Dó  Mi  Sol  Si"},
    {c:"Cm7",   d:"Dó menor 7ª",                   n:"Dó  Mib  Sol  Sib"},
    {c:"Cdim",  d:"Dó diminuto (VII grau)",        n:"Dó  Mib  Solb"},
    {c:"Caug",  d:"Dó aumentado",                  n:"Dó  Mi  Sol#"},
    {c:"Csus4", d:"Dó suspenso de 4ª",             n:"Dó  Fá  Sol"},
    {c:"Cadd9", d:"Dó maior com 9ª adicionada",    n:"Dó  Mi  Sol  Ré"},
    {c:"C/E",   d:"Dó maior com Mi no baixo",      n:"Mi(baixo)  Dó  Mi  Sol"},
    {c:"Cm7b5", d:"Dó meio-diminuto (II grau menor)",n:"Dó  Mib  Solb  Sib"},
    {c:"G/B",   d:"Sol maior com Si no baixo",     n:"Si(baixo)  Sol  Si  Ré"},
  ];
  const ANAL=[
    {prog:"G | Em | C | D",key:"G",answer:["I","VI","IV","V"],expl:"Progressão I–VI–IV–V. G=tônica, Em=tônica relativa, C=subdominante, D=dominante."},
    {prog:"Am | F | C | G",key:"C",answer:["VI","IV","I","V"],expl:"Progressão VI–IV–I–V em Dó. Am=VI grau, F=IV, C=I, G=V. Começa no relativo menor."},
  ];
  function newQ(){const i=tmRandom(0,SIMS.length-1);setQI(i);setFb(null);setOptSt({});const wr=tmShuffle([...Array(SIMS.length).keys()].filter(x=>x!==i)).slice(0,5);setOpts(tmShuffle([i,...wr]));}
  function newAnal(){setAnalQ(tmRandom(0,ANAL.length-1));setAnalFb({});setAnalSt({});}
  React.useEffect(()=>{newQ();newAnal();},[]);
  function answer(i){if(fb)return;const ok=i===qI;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qI]="correct";setOptSt(os);setFb({ok,msg:ok?`Correto! ${SIMS[qI].c} = ${SIMS[qI].d}. Notas: ${SIMS[qI].n}`:`Errado. ${SIMS[qI].c} é ${SIMS[qI].d}. Notas: ${SIMS[qI].n}.`});}
  function answerAnal(idx,grau){
    if(analFb[idx])return;
    const ok=grau===ANAL[analQ].answer[idx];
    setAnalSt(p=>({...p,[idx]:grau}));
    setAnalFb(p=>({...p,[idx]:{ok,msg:ok?`Correto! É o ${grau}.`:`Errado. É o ${ANAL[analQ].answer[idx]}.`}}));
  }
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Este módulo une tudo. Ler uma cifra com consciência harmônica significa não apenas tocar os acordes, mas entender a função de cada um, antecipar resoluções e enxergar a progressão como um todo."</em>
      </div>
      <TmConceito titulo="Sistema de cifras + Análise harmônica">
        <p style={tmS.p}>A <strong style={{color:"#fff"}}>cifra americana</strong> usa C D E F G A B (Dó Ré Mi Fá Sol Lá Si). Sufixos indicam o tipo. Mas o músico consciente vai além: identifica a função de cada acorde na progressão.</p>
        <TmDiagrama>{`C=Dó  D=Ré  E=Mi  F=Fá  G=Sol  A=Lá  B=Si
# = sustenido (+½)    b = bemol (−½)

SUFIXOS ESSENCIAIS:
(nada) = maior      m = menor       7 = dom. 7ª
maj7 = maior 7ª   m7 = menor 7ª   dim = diminuto
aug = aumentado  sus2/sus4         add9 = com 9ª
/X = nota no baixo (G/B = Sol com Si no baixo)

LEITURA NA CIFRA:
[G]Quan-do [Em]che-gar o [C]dia [D]
← Troca de acorde ANTES da sílaba onde começa`}</TmDiagrama>
      </TmConceito>
      <h3 style={tmS.h3}>Todos os sufixos na prática</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,160px),1fr))",gap:8,marginBottom:16}}>
        {SIMS.map((s,i)=><div key={i} style={{...tmS.card,display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{...tmS.mono,fontSize:16,fontWeight:700,color:"#3fae6b",flexShrink:0}}>{s.c}</span>
          <div><div style={{fontSize:"clamp(10px,2.7vw,12px)",color:"#eef5f0",fontWeight:500}}>{s.d}</div><div style={{fontSize:10,color:"#6fae8a",marginTop:2,...tmS.mono}}>{s.n}</div></div>
        </div>)}
      </div>
      <TmEx title="Interpretar cifra" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>O que significa esta cifra?</p>
        <div style={{textAlign:"center",fontSize:34,...tmS.mono,color:"#3fae6b",fontWeight:800,padding:14,background:"#091f14",borderRadius:12,marginBottom:14}}>{SIMS[qI].c}</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {opts.map(i=><TmOpt key={i} label={SIMS[i].d} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
      <div style={{...tmS.card,marginTop:14}}>
        <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:8}}>Análise harmônica — {ANAL[analQ].prog}</div>
        <p style={{...tmS.p,marginBottom:10}}>Tonalidade de <strong style={{color:"#3fae6b"}}>{ANAL[analQ].key}</strong>. Identifique o grau de cada acorde:</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
          {ANAL[analQ].prog.split(" | ").map((chord,idx)=><div key={idx} style={tmS.card}>
            <div style={{fontWeight:700,color:"#fff",fontSize:14,...tmS.mono,textAlign:"center",marginBottom:6}}>{chord}</div>
            {analFb[idx]?<div style={{fontSize:12,color:analFb[idx].ok?"#3fae6b":"#e8554d",textAlign:"center",fontWeight:700}}>{ANAL[analQ].answer[idx]}</div>
            :<div style={{display:"flex",flexDirection:"column",gap:4}}>
              {["I","II","III","IV","V","VI","VII"].map(g=><button key={g} onClick={()=>answerAnal(idx,g)} style={{fontSize:11,padding:"3px",borderRadius:6,border:"1px solid #1d4435",background:"transparent",color:"#9fdabb",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",...tmS.mono}}>{g}</button>)}
            </div>}
          </div>)}
        </div>
        {Object.keys(analFb).length===4&&<div style={{fontSize:12,color:"#9fdabb",lineHeight:1.5,marginTop:8}}>{ANAL[analQ].expl}</div>}
        <button onClick={newAnal} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"1px solid #1d4435",background:"transparent",color:"#6fae8a",cursor:"pointer",marginTop:8,fontFamily:"'Montserrat',sans-serif"}}>↺ Nova progressão</button>
      </div>
    </div>
  );
}


function TeoriaMusicaView({ onBack }) {
  const [curMod, setCurMod] = React.useState(null);
  const [prog, setProg]     = React.useState({});
  const [userId, setUserId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  // Obtém user_id da sessão Supabase
  React.useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if(data.session?.user?.id) setUserId(data.session.user.id);
    });
    const {data:sub}=supabase.auth.onAuthStateChange((_,s)=>{
      setUserId(s?.user?.id||null);
    });
    return()=>sub.subscription.unsubscribe();
  },[]);

  // Carrega progresso do Supabase quando userId muda
  React.useEffect(()=>{
    if(!userId)return;
    supabase.from("user_prefs")
      .select("teoria_prog")
      .eq("user_id",userId)
      .eq("song_id","__teoria__")
      .maybeSingle()
      .then(({data})=>{
        if(data?.teoria_prog){
          try{ setProg(JSON.parse(data.teoria_prog)||{}); }catch(e){}
        }
      });
  },[userId]);

  // Salva progresso no Supabase
  async function saveProgress(newProg){
    if(!userId)return;
    setSaving(true);
    try{
      await supabase.from("user_prefs").upsert({
        user_id: userId,
        song_id: "__teoria__",
        semitones: 0,
        capo: 0,
        teoria_prog: JSON.stringify(newProg),
      },{onConflict:"user_id,song_id"});
    }catch(e){}
    setSaving(false);
  }

  function markDone(id){
    const n={...prog,[id]:true};
    setProg(n);
    saveProgress(n);
  }
  function markUndone(id){
    const n={...prog};
    delete n[id];
    setProg(n);
    saveProgress(n);
  }

  const MODS=[
    {id:"01",nivel:"Fundamentos",  cor:"#34c98a",titulo:"O Som e a Nota",              sub:"Som · Frequência · Altura · Timbre · As 12 notas · Enarmonia",         comp:<Mod01_Som/>},
    {id:"02",nivel:"Fundamentos",  cor:"#34c98a",titulo:"Ritmo e Compasso",            sub:"Pulso · BPM · Figuras rítmicas · Compassos · Metrônomo interativo",     comp:<Mod02_Ritmo/>},
    {id:"03",nivel:"Básico",       cor:"#4f9dde",titulo:"Intervalos",                  sub:"Uníssono à oitava · Melódico/harmônico · Inversão · DNA da harmonia",   comp:<Mod03_Intervalos/>},
    {id:"04",nivel:"Básico",       cor:"#4f9dde",titulo:"Escalas",                     sub:"Maior · Menores · Pentatônica · Blues · Cromática · Modos futuros",     comp:<Mod04_Escalas/>},
    {id:"05",nivel:"Intermediário",cor:"#e0b341",titulo:"Acordes",                     sub:"Tríades · Tétrades · Inversões · Extensões · Análise de acordes",       comp:<Mod05_Acordes/>},
    {id:"06",nivel:"Intermediário",cor:"#e0b341",titulo:"Campo Harmônico",             sub:"Graus I–VII · Tônica · Subdominante · Dominante · Cadências",           comp:<Mod06_Tonalidade/>},
    {id:"07",nivel:"Intermediário",cor:"#e0b341",titulo:"Progressões e Cadências",     sub:"Progressões do louvor · Cadências · Reconhecimento auditivo",           comp:<Mod07_Progressoes/>},
    {id:"08",nivel:"Avançado",     cor:"#e8554d",titulo:"Modos Gregos",                sub:"7 modos · Caráter sonoro · Mixolídio no gospel · Quando usar cada um",  comp:<Mod08_Modos/>},
    {id:"09",nivel:"Avançado",     cor:"#e8554d",titulo:"Harmonia Avançada",           sub:"Dom. secundária · Empréstimo modal · Modulação · Rearmonização",        comp:<Mod09_HarmoniaAvancada/>},
    {id:"10",nivel:"Prático",      cor:"#9b6ef0",titulo:"Leitura e Análise de Cifra",  sub:"Sistema cifrado · Todos os sufixos · Análise harmônica completa",       comp:<Mod10_Cifra/>},
  ];

  const NIVEIS=["Fundamentos","Básico","Intermediário","Avançado","Prático"];
  const totalDone=Object.values(prog).filter(Boolean).length;
  const curIdx=curMod?MODS.findIndex(m=>m.id===curMod):-1;

  // ── Visualização de um módulo ──
  if(curMod){
    const mod=MODS[curIdx];
    if(!mod)return null;
    return(
      <div style={{maxWidth:720,margin:"0 auto",padding:"16px 12px 80px",fontFamily:"'Montserrat',sans-serif"}}>
        {/* Cabeçalho */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
          <button onClick={()=>{markDone(curMod);setCurMod(null);window.scrollTo(0,0);}}
            style={{...ghostBtn(),padding:"7px 12px",flexShrink:0}}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{margin:0,fontWeight:800,fontSize:"clamp(16px,4.5vw,22px)",color:"#fff",lineHeight:1.1,borderLeft:`3px solid ${mod.cor}`,paddingLeft:10}}>
              {mod.titulo}
            </h1>
            <div style={{fontSize:11,color:mod.cor,marginTop:3,paddingLeft:13,fontWeight:600}}>
              Módulo {mod.id} · {mod.nivel} {saving&&<span style={{color:"#5d917a",marginLeft:6}}>salvando...</span>}
            </div>
          </div>
          {prog[curMod]
            ?<button onClick={()=>markUndone(curMod)} style={{fontSize:11,padding:"5px 10px",borderRadius:8,border:"1px solid #3fae6b44",background:"rgba(63,174,107,.15)",color:"#3fae6b",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>✓ Concluído</button>
            :<button onClick={()=>markDone(curMod)} style={{fontSize:11,padding:"5px 10px",borderRadius:8,border:`1px solid ${mod.cor}44`,background:"transparent",color:mod.cor,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>Marcar como feito</button>
          }
        </div>
        {/* Conteúdo */}
        <div style={{fontSize:"clamp(12px,3.2vw,14px)",lineHeight:1.7}}>
          {mod.comp}
        </div>
        {/* Navegação entre módulos */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:10}}>
          {curIdx>0
            ?<button onClick={()=>{markDone(curMod);setCurMod(MODS[curIdx-1].id);window.scrollTo(0,0);}} style={{...ghostBtn(),flex:1,justifyContent:"flex-start"}}>
              <ChevronDown size={15} style={{transform:"rotate(90deg)"}}/> Anterior
            </button>
            :<div style={{flex:1}}/>
          }
          {curIdx<MODS.length-1
            ?<button onClick={()=>{markDone(curMod);setCurMod(MODS[curIdx+1].id);window.scrollTo(0,0);}} style={{
                display:"inline-flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end",
                padding:"10px 18px",borderRadius:11,cursor:"pointer",
                fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,
                background:`${MODS[curIdx+1].cor}18`,border:`1px solid ${MODS[curIdx+1].cor}44`,
                color:MODS[curIdx+1].cor
              }}>
              Próximo <ChevronDown size={15} style={{transform:"rotate(-90deg)"}}/>
            </button>
            :<div style={{flex:1}}/>
          }
        </div>
      </div>
    );
  }

  // ── Menu principal ──
  return(
    <div style={{maxWidth:720,margin:"0 auto",padding:"20px 12px 80px",fontFamily:"'Montserrat',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{...ghostBtn(),padding:"8px 12px",flexShrink:0}}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 style={{margin:0,fontWeight:800,fontSize:"clamp(20px,5vw,28px)",color:"#fff",lineHeight:1.1}}>
            Teoria Musical
          </h1>
          <p style={{margin:"3px 0 0",color:"#6fae8a",fontSize:"clamp(11px,3vw,13px)"}}>
            {totalDone}/{MODS.length} módulos concluídos · progresso salvo na sua conta
          </p>
        </div>
      </div>
      {/* Barra de progresso */}
      <div style={{height:5,background:"#0c2419",borderRadius:4,marginBottom:22,overflow:"hidden"}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,#34c98a,#9b6ef0)",
          width:`${(totalDone/MODS.length)*100}%`,borderRadius:4,transition:"width .4s"}}/>
      </div>
      {/* Metodologia */}
      <div style={{background:"#081a10",border:"1px solid #1d4435",borderRadius:13,padding:"14px 16px",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:13,color:"#3fae6b",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Metodologia do Curso</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,200px),1fr))",gap:8}}>
          {[
            {cor:"#34c98a",icon:"①",titulo:"Entendimento",desc:"Conceito, porquê existe, onde se usa e como se relaciona com o todo."},
            {cor:"#4f9dde",icon:"②",titulo:"Visualização",desc:"Diagramas, tabelas, piano interativo, esquemas e analogias."},
            {cor:"#e0b341",icon:"③",titulo:"Aplicação",desc:"Exemplos reais, músicas do louvor, exercícios no violão."},
            {cor:"#e8554d",icon:"④",titulo:"Fixação",desc:"Perguntas, V/F, exercícios interativos e revisão espaçada."},
          ].map(p=><div key={p.titulo} style={{background:"#091f14",border:`1px solid ${p.cor}33`,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontWeight:700,fontSize:12,color:p.cor,marginBottom:3}}>{p.icon} {p.titulo}</div>
            <div style={{fontSize:11,color:"#6fae8a",lineHeight:1.5}}>{p.desc}</div>
          </div>)}
        </div>
        <p style={{fontSize:11,color:"#5d917a",marginTop:10,marginBottom:0}}>Seu progresso é individual por conta — salvo automaticamente na nuvem.</p>
      </div>
      {/* Grupos por nível */}
      {NIVEIS.map(nivel=>{
        const mods=MODS.filter(m=>m.nivel===nivel);
        if(!mods.length)return null;
        const nivelCor=mods[0].cor;
        const nivelDone=mods.filter(m=>prog[m.id]).length;
        return(
          <div key={nivel} style={{marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:nivelCor,textTransform:"uppercase",letterSpacing:".07em"}}>{nivel}</span>
              <div style={{flex:1,height:1,background:"#15392b"}}/>
              <span style={{fontSize:11,color:"#5d917a"}}>{nivelDone}/{mods.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {mods.map(mod=>{
                const done=!!prog[mod.id];
                return(
                  <button key={mod.id} onClick={()=>{setCurMod(mod.id);window.scrollTo(0,0);}}
                    style={{display:"flex",alignItems:"center",gap:12,background:done?"#091f14":"#0c2419",
                      border:`1px solid ${done?mod.cor+"55":"#15392b"}`,borderRadius:12,
                      padding:"13px 14px",cursor:"pointer",textAlign:"left",
                      fontFamily:"'Montserrat',sans-serif",transition:"all .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0e2c1f"}
                    onMouseLeave={e=>e.currentTarget.style.background=done?"#091f14":"#0c2419"}>
                    <div style={{width:34,height:34,borderRadius:"50%",flexShrink:0,
                      background:done?mod.cor+"33":"#0a2417",border:`1px solid ${done?mod.cor:mod.cor+"33"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,fontWeight:800,color:done?mod.cor:mod.cor+"77"}}>
                      {done?"✓":mod.id}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",color:"#eef5f0",lineHeight:1.2}}>
                        {mod.titulo}
                      </div>
                      <div style={{fontSize:"clamp(10px,2.8vw,12px)",color:done?mod.cor+"aa":"#5d917a",marginTop:2}}>
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
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
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
  const [sections, setSections] = useState(
    song?.sections?.length
      ? song.sections.map(s => ({ ...s, _id: s._id || (Date.now().toString(36) + Math.random().toString(36).slice(2,5)) }))
      : [{ _id: "intro-0", type: "Introdução", label: "", repeat: "", content: "[C] [G] [Am] [F]" }]
  );

  const addSection = () => setSections([...sections, { _id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), type: "Verso", label: "", repeat: "", content: "" }]);
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
  const duplicate = i => { const a = [...sections]; a.splice(i + 1, 0, { ...sections[i], _id: Date.now().toString(36) + Math.random().toString(36).slice(2,5) }); setSections(a); };

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
  const handleCancel = async () => {
    if (isDirty()) {
      const ok = await confirm("Você tem alterações não salvas. Deseja sair e descartá-las?");
      if (!ok) return;
    }
    onCancel();
  };

  const handleSave = () => {
    if (!title.trim()) { toast("Dê um título à música.", "error"); return; }
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
      {confirmModal}
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
            💡 Digite os acordes nas <strong style={{ color: "#fff" }}>formas que a mão toca com o capo na {capoSuggested}ª casa</strong>. O tom real ({key}) é o som que sai. Quem abrir verá com o capo já aplicado, e o modo contra-baixo mostra o tom real automaticamente.
          </div>
        )}
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
          <div key={sec._id || i} ref={el => sectionRefs.current[i] = el}
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
        <button onClick={async () => { const ok = await confirm(`Excluir "${title}" definitivamente?\n\nIsso remove a cifra para TODOS os membros e não pode ser desfeito.`); if (ok) onDelete(); }} style={{ ...ghostBtn(), color: "#e8554d", marginTop: 26 }}>
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

/* ---------- Estilos — constantes pré-alocadas (não recriam objeto a cada render) ---------- */
const INPUT_STYLE_BASE = { width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", fontSize: 15, fontFamily: "'Montserrat',sans-serif", outline: "none" };
function inputStyle(extra = {}) { return { ...INPUT_STYLE_BASE, ...extra }; }
const PRIMARY_BTN = { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#fff,#dff0e6)", color: "#0d3d28", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", boxShadow: "0 6px 18px rgba(255,255,255,.12)" };
function primaryBtn() { return PRIMARY_BTN; }
const GHOST_BTN = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, border: "1px solid #1d4435", background: "transparent", color: "#eef5f0", fontSize: 14, cursor: "pointer", fontFamily: "'Montserrat',sans-serif" };
function ghostBtn() { return GHOST_BTN; }
const ICON_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #1d4435", background: "#08160f", color: "#eef5f0", cursor: "pointer" };
function iconBtn() { return ICON_BTN; }
const STEP_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(0,0,0,.3)", color: "#fff", cursor: "pointer" };
function stepBtn() { return STEP_BTN; }
const CARD_STYLE = { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 13, border: "1px solid #15392b", background: "#0c2419", cursor: "pointer", transition: "all .18s ease", fontFamily: "'Montserrat',sans-serif", color: "#eef5f0", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" };
function cardStyle() { return CARD_STYLE; }
const CHIP = { display: "inline-flex", alignItems: "center", gap: 5, background: "#08160f", padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap" };
function chip() { return CHIP; }
