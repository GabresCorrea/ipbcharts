import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { Plus, Music, Play, Pause, Edit3, Trash2, Youtube, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, X, Search, Save, ArrowLeft, Hash, LogOut, Tag, User, BookOpen, Copy, Download, Minus, GripVertical, Upload, WifiOff, Type, ListMusic, Users, GraduationCap, MoreVertical } from "lucide-react";
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
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: imgError ? "linear-gradient(135deg,#1a1a1a,#111)" : "transparent", border: imgError ? "2px solid #1d4435" : "none" }}>
      {imgError ? (
        <span style={{ fontWeight: 900, fontSize: size * 0.32, color: "#3fae6b", letterSpacing: -1, fontFamily: "'Montserrat',sans-serif" }}>IPB</span>
      ) : (
        <img src="/logo.png" alt="IPBCharts" onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
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


const CATEGORIES = ["Louvor", "Adoração", "Congregacional", "Consagração", "Hino", "Outra"];
const CATEGORY_COLORS = {
  "Louvor": "#e8a23d", "Adoração": "#7a86f0", "Congregacional": "#34c98a",
  "Consagração": "#ec6aa8", "Hino": "#d4a017", "Outra": "#9aa3ad", "": "#9aa3ad"
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
/* Normaliza sufixos de acordes digitados de forma abreviada ou alternativa.
   Garante que "G4" → "Gsus4", "G2" → "Gsus2", "Cmaj7" → "CM7", etc.
   Cobre abreviações numéricas, variantes de nome e símbolos musicais.
   Recebe o sufixo COMPLETO após a nota (ex: "4", "m4", "maj7", "min7", "°"). */
function normalizeSuffix(suffix) {
  if (!suffix) return "";
  const MAP = {
    // Abreviações numéricas — as mais comuns e causa do bug reportado
    "2":       "sus2",
    "4":       "sus4",
    "m2":      "m",      // Am2 é raro; trata como menor (a nona está implícita)
    "m4":      "sus4",   // Am4 → sus4 com raiz menor? Na prática = sus4
    // Variantes de nome escritas sem camelCase
    "maj":     "",
    "maj7":    "M7",
    "maj9":    "M9",
    "min":     "m",
    "min7":    "m7",
    "min9":    "m9",
    "dom":     "7",
    "dom7":    "7",
    // Símbolos musicais
    "°":       "dim",
    "°7":      "dim7",
    "o":       "dim",    // "o" minúsculo usado como substituto de °
    "o7":      "dim7",
    "+":       "aug",
    "aug":     "aug",
    "ø":       "m7b5",
    "ø7":      "m7b5",
    "Δ":       "M7",
    "Δ7":      "M7",
    // Variantes "add" — o problema reportado
    "(9)":     "add9",
    "add(9)":  "add9",
    "add2":    "sus2",   // add2 sem terça = sus2 na prática
    "add4":    "sus4",   // add4 → sus4 na prática do violão/louvor
    "add11":   "sus4",   // 11ª = 4ª uma oitava acima, mesma função
    "add6":    "6",      // add6 = acorde com sexta maior
    "add13":   "6",      // 13ª = 6ª uma oitava acima
    "add#4":   "aug",    // #4 sobre maior ≈ aumentado
    // Edge case: "Dmin" → regex captura D + m(menor) + "in"(rest) → "in" = vazio = Dm
    "in":      "",
    // Números de extensões sem "add" (G9 já está no banco como "9")
    // não alterar: "7", "9", "6", "M7", "m7", etc.
  };
  return MAP[suffix] !== undefined ? MAP[suffix] : suffix;
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
// transposeText: transpõe o que estiver entre colchetes [G] ou [C G] (múltiplos)
function transposeText(text, semitones, useFlats) {
  if (!text) return text;
  return text.replace(/\[([^\]]+)\]/g, (full, inner) => {
    // Suporta múltiplos acordes no mesmo colchete: [C G] → cada um transposto
    const chords = inner.trim().split(/\s+/);
    const transposed = chords.map(ch => transposeChord(ch, semitones, useFlats));
    return "[" + transposed.join(" ") + "]";
  });
}

/* ---------- Render de uma linha com acordes inline posicionados livremente ----------
   Acorde digitado entre colchetes [G] aparece flutuando exatamente sobre a sílaba seguinte.
   Linhas só com acordes (sem letra) também funcionam. */
// Separa a raiz do sufixo de um acorde para renderização com sobrescrito.
// O "m" de menor sempre fica na raiz — Bm7 → root:"Bm" suffix:"7"
// Inversões ficam inteiras na raiz — G/B → root:"G/B" suffix:""
function splitChordSuffix(chord) {
  if (!chord) return { root: "", suffix: "", slash: "" };
  const m = chord.match(/^([A-G][#b]?)(m(?!aj))?(.*)/);
  if (!m) return { root: chord, suffix: "", slash: "" };
  const note  = m[1];
  const minor = m[2] || "";
  let   rest  = m[3] || "";
  // Separa inversão (/B, /F#) do sufixo (7, sus4, maj7…)
  const slashIdx = rest.indexOf("/");
  let slash = "";
  if (slashIdx !== -1) { slash = rest.slice(slashIdx); rest = rest.slice(0, slashIdx); }
  // Normaliza abreviações: "4" → "sus4", "maj7" → "M7", etc.
  rest = normalizeSuffix(rest);
  return { root: note + minor, suffix: rest, slash };
}

/* ============================================================
   BANCO DE ACORDES — diagramas SVG para violão (6 cordas, EADGBE)
   frets[]: índice 0 = corda 6 (E grave) → índice 5 = corda 1 (E agudo)
   -1 = não toca (X)  |  0 = solta (O)  |  N = traste N
   fingers[]: 1=indicador 2=médio 3=anelar 4=mindinho (0/-1 = não usa)
   baseFret: traste de referência (1 = posição aberta/padrão)
   barre: { fret, fromString, toString }  (fromString/toString contados da corda 1=aguda)
   ============================================================ */
const CHORD_DB = {
  "C":  [
    { suffix:"",      frets:[-1,3,2,0,1,0], fingers:[-1,3,2,0,1,0], baseFret:1 },
    { suffix:"/E",    frets:[0,3,2,0,1,0],  fingers:[0,3,2,0,1,0],  baseFret:1 },
    { suffix:"/G",    frets:[3,3,2,0,1,0],  fingers:[3,4,2,0,1,0],  baseFret:1 },
    { suffix:"m",     frets:[-1,3,5,5,4,3], fingers:[-1,2,4,3,2,1], baseFret:3, barre:{fret:3,fromString:1,toString:5} },
    { suffix:"7",     frets:[0,3,2,3,1,0],  fingers:[0,3,2,4,1,0],  baseFret:1 },
    { suffix:"M7",    frets:[-1,3,2,0,0,0], fingers:[-1,3,2,0,0,0], baseFret:1 },
    { suffix:"m7",    frets:[-1,3,5,3,4,3], fingers:[-1,2,4,1,3,1], baseFret:3, barre:{fret:3,fromString:1,toString:4} },
    { suffix:"sus2",  frets:[-1,3,0,0,1,3], fingers:[-1,2,0,0,1,4], baseFret:1 },
    { suffix:"sus4",  frets:[-1,3,3,0,1,1], fingers:[-1,2,3,0,1,1], baseFret:1 },
    { suffix:"dim", frets:[-1,3,1,-1,1,2], fingers:[-1,3,1,-1,1,2], baseFret:1 },
    { suffix:"dim7",  frets:[-1,3,4,2,4,2], fingers:[-1,2,3,1,4,1], baseFret:2 },
    { suffix:"aug",   frets:[-1,3,2,1,1,0], fingers:[-1,4,3,1,2,0], baseFret:1 },
    { suffix:"add9",  frets:[-1,3,2,0,3,0], fingers:[-1,2,1,0,3,0], baseFret:1 },
    { suffix:"9",     frets:[-1,3,2,3,3,3], fingers:[-1,2,1,3,3,3], baseFret:1 },
    { suffix:"6",     frets:[-1,3,2,2,1,0], fingers:[-1,4,2,3,1,0], baseFret:1 },
    { suffix:"m6", frets:[-1,3,5,5,4,5], fingers:[-1,1,3,4,2,4], baseFret:3 },
    { suffix:"m7b5", frets:[-1,3,4,3,4,-1], fingers:[-1,1,3,2,4,-1], baseFret:3 },
    { suffix:"7sus4", frets:[-1,3,3,3,1,1], fingers:[-1,2,3,4,1,1], baseFret:1 },
  ],
  "C#": [
    { suffix:"",      frets:[-1,4,3,1,2,1], fingers:[-1,3,2,1,2,1], baseFret:1, barre:{fret:1,fromString:1,toString:3} },
    { suffix:"m",     frets:[-1,4,6,6,5,4], fingers:[-1,2,4,3,2,1], baseFret:4, barre:{fret:4,fromString:1,toString:5} },
    { suffix:"7",     frets:[-1,4,3,4,2,0], fingers:[-1,3,2,4,1,0], baseFret:1 },
    { suffix:"M7",    frets:[-1,4,3,1,1,1], fingers:[-1,3,2,1,1,1], baseFret:1, barre:{fret:1,fromString:1,toString:3} },
    { suffix:"m7",    frets:[-1,4,6,4,5,4], fingers:[-1,1,3,1,2,1], baseFret:4, barre:{fret:4,fromString:1,toString:5} },
    { suffix:"sus2",  frets:[-1,4,1,1,2,4], fingers:[-1,3,1,1,2,4], baseFret:1 },
    { suffix:"sus4",  frets:[-1,4,4,1,2,2], fingers:[-1,3,4,1,2,2], baseFret:1 },
    { suffix:"dim", frets:[-1,4,2,0,-1,-1], fingers:[-1,3,2,0,-1,-1], baseFret:1 },
    { suffix:"dim7",  frets:[-1,4,5,3,5,3], fingers:[-1,2,3,1,4,1], baseFret:3 },
    { suffix:"aug",   frets:[-1,4,3,2,2,1], fingers:[-1,4,3,2,2,1], baseFret:1 },
    { suffix:"add9",  frets:[-1,4,3,1,4,1], fingers:[-1,3,2,1,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:2} },
    { suffix:"m7b5", frets:[-1,4,2,0,0,-1], fingers:[-1,4,2,0,0,-1], baseFret:1 },
  ],
  "D":  [
    { suffix:"",      frets:[-1,-1,0,2,3,2],fingers:[-1,-1,0,1,3,2],baseFret:1 },
    { suffix:"/F#",   frets:[2,-1,0,2,3,2], fingers:[1,-1,0,2,4,3], baseFret:1 },
    { suffix:"/A",    frets:[-1,0,0,2,3,2], fingers:[-1,0,0,1,3,2], baseFret:1 },
    { suffix:"m",     frets:[-1,-1,0,2,3,1],fingers:[-1,-1,0,2,3,1],baseFret:1 },
    { suffix:"7",     frets:[-1,-1,0,2,1,2],fingers:[-1,-1,0,2,1,3],baseFret:1 },
    { suffix:"M7",    frets:[-1,-1,0,2,2,2],fingers:[-1,-1,0,1,1,1],baseFret:1, barre:{fret:2,fromString:1,toString:3} },
    { suffix:"m7",    frets:[-1,-1,0,2,1,1],fingers:[-1,-1,0,2,1,1],baseFret:1, barre:{fret:1,fromString:1,toString:2} },
    { suffix:"sus2",  frets:[-1,-1,0,2,3,0],fingers:[-1,-1,0,1,3,0],baseFret:1 },
    { suffix:"sus4",  frets:[-1,-1,0,2,3,3],fingers:[-1,-1,0,1,3,4],baseFret:1 },
    { suffix:"dim",   frets:[-1,-1,0,1,0,1],fingers:[-1,-1,0,1,0,2],baseFret:1 },
    { suffix:"dim7", frets:[-1,-1,0,1,0,1], fingers:[-1,-1,0,1,0,2], baseFret:1 },
    { suffix:"aug",   frets:[-1,-1,0,3,3,2],fingers:[-1,-1,0,3,4,1],baseFret:1 },
    { suffix:"add9",  frets:[-1,-1,4,2,3,0],fingers:[-1,-1,4,2,3,0],baseFret:1 }, // Dadd9=D,F#,A,E
    { suffix:"9", frets:[-1,5,4,2,1,0], fingers:[-1,4,3,2,1,0], baseFret:1 },
    { suffix:"6",     frets:[-1,-1,0,2,0,2],fingers:[-1,-1,0,1,0,2],baseFret:1 },
    { suffix:"m6",    frets:[-1,-1,0,2,0,1],fingers:[-1,-1,0,2,0,1],baseFret:1 },
    { suffix:"m7b5", frets:[-1,-1,0,1,1,1], fingers:[-1,-1,0,1,2,3], baseFret:1 },
    { suffix:"7sus4", frets:[-1,-1,0,2,1,3],fingers:[-1,-1,0,2,1,4],baseFret:1 },
  ],
  "D#": [
    { suffix:"",      frets:[-1,6,5,3,4,3], fingers:[-1,3,2,1,2,1], baseFret:3, barre:{fret:3,fromString:1,toString:4} },
    { suffix:"m",     frets:[-1,6,8,8,7,6], fingers:[-1,1,3,4,2,1], baseFret:6, barre:{fret:6,fromString:1,toString:5} },
    { suffix:"7",     frets:[-1,6,5,6,4,3], fingers:[-1,3,2,4,1,1], baseFret:3, barre:{fret:3,fromString:1,toString:2} },
    { suffix:"M7",    frets:[-1,6,5,3,3,3], fingers:[-1,3,2,1,1,1], baseFret:3, barre:{fret:3,fromString:1,toString:3} },
    { suffix:"m7",    frets:[-1,6,8,6,7,6], fingers:[-1,1,3,1,2,1], baseFret:6, barre:{fret:6,fromString:1,toString:5} },
    { suffix:"sus2",  frets:[-1,-1,1,3,4,1],fingers:[-1,-1,1,2,3,1],baseFret:1 },
    { suffix:"sus4",  frets:[-1,6,6,3,4,4], fingers:[-1,3,4,1,2,2], baseFret:3 },
    { suffix:"dim",   frets:[-1,-1,1,2,1,2],fingers:[-1,-1,1,3,2,4],baseFret:1 },
    { suffix:"dim7",  frets:[-1,6,7,5,7,5], fingers:[-1,2,3,1,4,1], baseFret:5 },
    { suffix:"aug",   frets:[-1,-1,1,0,0,3],fingers:[-1,-1,1,0,0,4],baseFret:1 },
    { suffix:"m7b5", frets:[-1,6,4,2,2,-1], fingers:[-1,4,3,1,2,-1], baseFret:1 },
  ],
  "E":  [
    { suffix:"",      frets:[0,2,2,1,0,0],  fingers:[0,2,3,1,0,0],  baseFret:1 },
    { suffix:"/G#",   frets:[4,2,2,1,0,0],  fingers:[4,2,3,1,0,0],  baseFret:1 },
    { suffix:"/B",    frets:[-1,2,2,1,0,0], fingers:[-1,2,3,1,0,0], baseFret:1 },
    { suffix:"m",     frets:[0,2,2,0,0,0],  fingers:[0,2,3,0,0,0],  baseFret:1 },
    { suffix:"7",     frets:[0,2,0,1,0,0],  fingers:[0,2,0,1,0,0],  baseFret:1 },
    { suffix:"M7",    frets:[0,2,1,1,0,0],  fingers:[0,3,1,2,0,0],  baseFret:1 },
    { suffix:"m7",    frets:[0,2,2,0,3,0],  fingers:[0,2,3,0,4,0],  baseFret:1 },
    { suffix:"sus2", frets:[0,2,4,4,0,0], fingers:[0,1,3,4,0,0], baseFret:1 },
    { suffix:"sus4",  frets:[0,2,2,2,0,0],  fingers:[0,1,2,3,0,0],  baseFret:1 },
    { suffix:"dim",   frets:[0,1,2,0,0,-1], fingers:[0,1,2,0,0,-1], baseFret:1 },
    { suffix:"dim7",  frets:[0,-1,2,0,2,0], fingers:[0,-1,2,0,3,0], baseFret:1 },
    { suffix:"aug",   frets:[0,3,2,1,1,0],  fingers:[0,4,3,1,2,0],  baseFret:1 },
    { suffix:"add9",  frets:[0,2,2,1,0,2],  fingers:[0,2,3,1,0,4],  baseFret:1 },
    { suffix:"9",     frets:[0,2,0,1,0,2],  fingers:[0,2,0,1,0,3],  baseFret:1 },
    { suffix:"6",     frets:[0,2,2,1,2,0],  fingers:[0,2,3,1,4,0],  baseFret:1 },
    { suffix:"m6",    frets:[0,2,2,0,2,0],  fingers:[0,2,3,0,4,0],  baseFret:1 },
    { suffix:"m7b5",  frets:[0,1,2,0,3,-1], fingers:[0,1,2,0,4,-1], baseFret:1 },
    { suffix:"7sus4", frets:[0,2,2,2,3,0], fingers:[0,1,2,3,4,0], baseFret:1 },
    { suffix:"m9",    frets:[0,2,0,0,0,2],  fingers:[0,2,0,0,0,3],  baseFret:1 },
  ],
  "F":  [
    { suffix:"",      frets:[1,3,3,2,1,1],  fingers:[1,3,4,2,1,1],  baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"/A",    frets:[-1,0,3,2,1,1], fingers:[-1,0,3,2,1,1], baseFret:1 },
    { suffix:"/C",    frets:[-1,3,3,2,1,1], fingers:[-1,3,4,2,1,1], baseFret:1, barre:{fret:1,fromString:1,toString:4} },
    { suffix:"m",     frets:[1,3,3,1,1,1],  fingers:[1,3,4,1,1,1],  baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"7",     frets:[1,3,1,2,1,1],  fingers:[1,3,1,2,1,1],  baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"M7",    frets:[-1,3,3,2,1,0], fingers:[-1,3,4,2,1,0], baseFret:1 },
    { suffix:"m7",    frets:[1,3,1,1,1,1],  fingers:[1,3,1,1,1,1],  baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"sus2", frets:[-1,-1,3,0,1,1], fingers:[-1,-1,3,0,1,2], baseFret:1 },
    { suffix:"sus4",  frets:[1,1,3,3,1,1],  fingers:[1,1,3,4,1,1],  baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"dim",   frets:[-1,-1,0,1,0,1],fingers:[-1,-1,0,1,0,2],baseFret:1 },
    { suffix:"dim7",  frets:[1,-1,0,1,0,1], fingers:[1,-1,0,2,0,3], baseFret:1 },
    { suffix:"aug",   frets:[-1,0,3,2,2,1], fingers:[-1,0,4,2,3,1], baseFret:1 },
    { suffix:"add9",  frets:[-1,0,3,2,1,3], fingers:[-1,0,3,2,1,4], baseFret:1 },
    { suffix:"9", frets:[1,3,1,2,1,3], fingers:[1,3,1,2,1,4], baseFret:1, barre:{fret:1,fromString:1,toString:6} },
    { suffix:"6",     frets:[-1,0,3,2,3,1], fingers:[-1,0,2,1,3,0], baseFret:1 },
    { suffix:"m7b5", frets:[-1,-1,3,4,4,4], fingers:[-1,-1,1,3,4,4], baseFret:3 },
    { suffix:"7sus4", frets:[1,3,3,3,4,1], fingers:[1,3,3,4,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:6} },
  ],
  "F#": [
    { suffix:"",      frets:[2,4,4,3,2,2],  fingers:[1,3,4,2,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"m",     frets:[2,4,4,2,2,2],  fingers:[1,3,4,1,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"7",     frets:[2,4,2,3,2,2],  fingers:[1,3,1,2,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"M7",    frets:[2,4,3,3,2,2],  fingers:[1,4,2,3,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"m7",    frets:[2,4,2,2,2,2],  fingers:[1,3,1,1,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"sus2", frets:[-1,4,6,1,2,2], fingers:[-1,3,4,1,2,2], baseFret:1 },
    { suffix:"sus4",  frets:[2,2,4,4,2,2],  fingers:[1,1,3,4,1,1],  baseFret:2, barre:{fret:2,fromString:1,toString:6} },
    { suffix:"dim",   frets:[-1,-1,1,2,1,2],fingers:[-1,-1,1,3,2,4],baseFret:2 },
    { suffix:"dim7", frets:[-1,-1,4,5,4,5], fingers:[-1,-1,1,3,2,4], baseFret:4 },
    { suffix:"aug",   frets:[-1,-1,4,3,3,2],fingers:[-1,-1,4,2,3,1],baseFret:2 },
    { suffix:"m7b5", frets:[-1,-1,4,2,1,0], fingers:[-1,-1,4,2,1,0], baseFret:1 },
    { suffix:"add9",  frets:[2,4,4,3,2,4],  fingers:[1,2,3,2,1,4],  baseFret:2 },
  ],
  "G":  [
    { suffix:"",      frets:[3,2,0,0,0,3],  fingers:[2,1,0,0,0,3],  baseFret:1 },
    { suffix:"/B",    frets:[-1,2,0,0,0,3], fingers:[-1,1,0,0,0,3], baseFret:1 },
    { suffix:"/D", frets:[-1,-1,0,0,0,3], fingers:[-1,-1,0,0,0,4], baseFret:1 },
    { suffix:"m",     frets:[3,5,5,3,3,3],  fingers:[1,3,4,1,1,1],  baseFret:3, barre:{fret:3,fromString:1,toString:6} },
    { suffix:"7",     frets:[3,2,0,0,0,1],  fingers:[3,2,0,0,0,1],  baseFret:1 },
    { suffix:"M7",    frets:[3,2,0,0,0,2],  fingers:[3,2,0,0,0,4],  baseFret:1 },
    { suffix:"m7",    frets:[3,5,3,3,3,3],  fingers:[1,3,1,1,1,1],  baseFret:3, barre:{fret:3,fromString:1,toString:6} },
    { suffix:"sus2",  frets:[3,0,0,0,3,3],  fingers:[2,0,0,0,3,4],  baseFret:1 },
    { suffix:"sus4",  frets:[3,3,0,0,1,3],  fingers:[2,3,0,0,1,4],  baseFret:1 },
    { suffix:"dim",   frets:[-1,-1,2,3,2,3],fingers:[-1,-1,1,3,2,4],baseFret:1 },
    { suffix:"dim7", frets:[-1,-1,2,3,2,3], fingers:[-1,-1,1,3,2,4], baseFret:1 },
    { suffix:"aug",   frets:[-1,-1,1,0,0,3],fingers:[-1,-1,1,0,0,4],baseFret:2 },
    { suffix:"add9",  frets:[3,2,0,2,0,3],  fingers:[3,2,0,1,0,4],  baseFret:1 },
    { suffix:"9",     frets:[3,2,0,2,0,1],  fingers:[3,2,0,2,0,1],  baseFret:1 },
    { suffix:"6",     frets:[3,2,0,0,0,0],  fingers:[2,1,0,0,0,0],  baseFret:1 },
    { suffix:"m6", frets:[3,5,5,3,3,0], fingers:[2,4,4,1,1,0], baseFret:3 },
    { suffix:"m7b5", frets:[6,-1,5,6,6,-1], fingers:[1,-1,1,2,3,-1], baseFret:4 },
    { suffix:"7sus4", frets:[3,3,0,0,1,1],  fingers:[3,4,0,0,1,2],  baseFret:1 },
    { suffix:"m9",    frets:[3,5,3,3,3,5],  fingers:[1,3,1,1,1,4],  baseFret:3, barre:{fret:3,fromString:1,toString:6} },
  ],
  "G#": [
    { suffix:"",      frets:[4,6,6,5,4,4],  fingers:[1,3,4,2,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"m",     frets:[4,6,6,4,4,4],  fingers:[1,3,4,1,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"7",     frets:[4,6,4,5,4,4],  fingers:[1,3,1,2,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"M7",    frets:[4,6,5,5,4,4],  fingers:[1,4,2,3,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"m7",    frets:[4,6,4,4,4,4],  fingers:[1,3,1,1,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"sus2", frets:[-1,1,1,1,4,4], fingers:[-1,1,1,1,3,4], baseFret:1 },
    { suffix:"sus4",  frets:[4,4,6,6,4,4],  fingers:[1,1,3,4,1,1],  baseFret:4, barre:{fret:4,fromString:1,toString:6} },
    { suffix:"dim", frets:[4,-1,0,4,3,-1], fingers:[3,-1,0,4,2,-1], baseFret:1 },
    { suffix:"aug", frets:[-1,3,2,1,1,0], fingers:[-1,4,3,1,2,0], baseFret:1 },
    { suffix:"m7b5", frets:[4,-1,0,4,3,2], fingers:[4,-1,0,3,2,1], baseFret:1 },
  ],
  "A":  [
    { suffix:"",      frets:[-1,0,2,2,2,0], fingers:[-1,0,1,2,3,0], baseFret:1 },
    { suffix:"/C#",   frets:[-1,4,2,2,2,0], fingers:[-1,4,1,2,3,0], baseFret:1 },
    { suffix:"/E",    frets:[0,0,2,2,2,0],  fingers:[0,0,1,2,3,0],  baseFret:1 },
    { suffix:"m",     frets:[-1,0,2,2,1,0], fingers:[-1,0,2,3,1,0], baseFret:1 },
    { suffix:"7",     frets:[-1,0,2,0,2,0], fingers:[-1,0,2,0,3,0], baseFret:1 },
    { suffix:"M7",    frets:[-1,0,2,1,2,0], fingers:[-1,0,2,1,3,0], baseFret:1 },
    { suffix:"m7",    frets:[-1,0,2,0,1,0], fingers:[-1,0,2,0,1,0], baseFret:1 },
    { suffix:"sus2",  frets:[-1,0,2,2,0,0], fingers:[-1,0,1,2,0,0], baseFret:1 },
    { suffix:"sus4",  frets:[-1,0,2,2,3,0], fingers:[-1,0,1,2,3,0], baseFret:1 },
    { suffix:"dim",   frets:[-1,0,1,2,1,2], fingers:[-1,0,1,3,2,4], baseFret:1 },
    { suffix:"dim7",  frets:[-1,0,1,2,1,2], fingers:[-1,0,1,3,2,4], baseFret:1 },
    { suffix:"aug",   frets:[-1,0,3,2,2,1], fingers:[-1,0,4,2,3,1], baseFret:1 },
    { suffix:"add9",  frets:[-1,0,2,4,2,0], fingers:[-1,0,1,3,2,0], baseFret:1 },
    { suffix:"9", frets:[-1,0,2,4,2,3], fingers:[-1,0,2,4,1,3], baseFret:1 },
    { suffix:"6",     frets:[-1,0,2,2,2,2], fingers:[-1,0,1,1,1,1], baseFret:1, barre:{fret:2,fromString:1,toString:4} },
    { suffix:"m6",    frets:[-1,0,2,2,1,2], fingers:[-1,0,2,3,1,4], baseFret:1 },
    { suffix:"m7b5", frets:[-1,0,1,0,1,-1], fingers:[-1,0,1,0,2,-1], baseFret:1 },
    { suffix:"7sus4", frets:[-1,0,2,0,3,0], fingers:[-1,0,2,0,3,0], baseFret:1 },
    { suffix:"m9", frets:[-1,0,2,4,1,3], fingers:[-1,0,2,4,1,3], baseFret:1 },
  ],
  "A#": [
    { suffix:"",      frets:[-1,1,3,3,3,1], fingers:[-1,1,2,3,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"m",     frets:[-1,1,3,3,2,1], fingers:[-1,1,3,4,2,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"7",     frets:[-1,1,3,1,3,1], fingers:[-1,1,3,1,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"M7",    frets:[-1,1,3,2,3,1], fingers:[-1,1,3,2,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"m7",    frets:[-1,1,3,1,2,1], fingers:[-1,1,3,1,2,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"sus2",  frets:[-1,1,3,3,1,1], fingers:[-1,1,3,4,1,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"sus4",  frets:[-1,1,3,3,4,1], fingers:[-1,1,2,3,4,1], baseFret:1, barre:{fret:1,fromString:1,toString:5} },
    { suffix:"dim",   frets:[-1,1,2,3,2,0], fingers:[-1,1,2,4,3,0], baseFret:1 },
    { suffix:"dim7",  frets:[-1,1,2,0,2,0], fingers:[-1,1,2,0,3,0], baseFret:1 },
    { suffix:"aug",   frets:[-1,1,0,3,3,2], fingers:[-1,1,0,3,4,2], baseFret:1 },
    { suffix:"m7b5", frets:[-1,1,2,1,2,-1], fingers:[-1,1,2,1,3,-1], baseFret:1 },
    { suffix:"add9",  frets:[-1,1,3,5,3,1], fingers:[-1,1,2,4,3,1], baseFret:1 }, // A#add9=Bb,C,D,F
  ],
  "B":  [
    { suffix:"",      frets:[-1,2,4,4,4,2], fingers:[-1,1,2,3,4,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"m",     frets:[-1,2,4,4,3,2], fingers:[-1,1,3,4,2,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"7",     frets:[-1,2,1,2,0,2], fingers:[-1,2,1,3,0,4], baseFret:1 },
    { suffix:"M7",    frets:[-1,2,4,3,4,2], fingers:[-1,1,3,2,4,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"m7",    frets:[-1,2,4,2,3,2], fingers:[-1,1,3,1,2,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"sus2",  frets:[-1,2,4,4,2,2], fingers:[-1,1,3,4,1,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"sus4",  frets:[-1,2,4,4,5,2], fingers:[-1,1,2,3,4,1], baseFret:2, barre:{fret:2,fromString:1,toString:5} },
    { suffix:"dim",   frets:[-1,2,3,4,3,2], fingers:[-1,1,2,4,3,1], baseFret:2 },
    { suffix:"dim7",  frets:[-1,2,3,1,3,1], fingers:[-1,2,3,1,4,1], baseFret:1 },
    { suffix:"aug",   frets:[-1,2,1,0,0,3], fingers:[-1,3,2,0,0,4], baseFret:1 },
    { suffix:"add9",  frets:[-1,4,4,4,4,-1],fingers:[-1,1,2,3,4,-1],baseFret:4, barre:{fret:4,fromString:2,toString:5} }, // Badd9=B,C#,D#,F#
    { suffix:"9", frets:[-1,4,1,2,0,2], fingers:[-1,4,1,2,0,3], baseFret:1 },
    { suffix:"m7b5", frets:[-1,0,3,4,3,-1], fingers:[-1,0,2,4,3,-1], baseFret:1 },
    { suffix:"m9", frets:[7,4,4,2,3,-1], fingers:[4,3,3,1,2,-1], baseFret:2 },
  ],
};

// Mapeamento de bemóis para sustenidos (para lookup no banco)
const FLAT_TO_SHARP = { "Db":"C#", "Eb":"D#", "Gb":"F#", "Ab":"G#", "Bb":"A#" };

/* Encontra o diagrama de um acorde no banco.
   Recebe o acorde já transposto (ex: "Am7", "D/F#", "Bb"). */
function findChordDiagram(chord) {
  if (!chord) return null;
  const p = parseChordRoot(chord);
  if (!p || p.idx === -1) return null;
  // Determina a nota raiz em formato do banco (sempre sustenido)
  const sharpScale = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  let rootKey = sharpScale[p.idx];
  let suffix = p.rest || "";
  // Normaliza bemóis
  if (FLAT_TO_SHARP[rootKey]) rootKey = FLAT_TO_SHARP[rootKey];
  const list = CHORD_DB[rootKey];
  if (!list) return null;
  // Normaliza abreviações antes de buscar: "4" → "sus4", "maj7" → "M7", etc.
  suffix = normalizeSuffix(suffix);
  // Procura sufixo exato primeiro
  let found = list.find(c => c.suffix === suffix);
  // Fallback: sem inversão (ex: D/F# → tenta D)
  if (!found && suffix.startsWith("/")) found = list.find(c => c.suffix === "");
  // Fallback: acorde maior simples (último recurso)
  if (!found) found = list[0];
  return found || null;
}

/* ============================================================
   TECLADO — diagrama SVG para o popup de teclado
   ============================================================ */
const PIANO_IS_BLACK   = [false,true,false,true,false,false,true,false,true,false,true,false];
const PIANO_NOTE_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const PIANO_NOTE_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

/* Fórmulas de intervalos (semitons acima da raiz) para cada tipo de acorde */
const PIANO_INTERVALS = {
  "":      [0,4,7],
  "m":     [0,3,7],
  "7":     [0,4,7,10],
  "M7":    [0,4,7,11],
  "m7":    [0,3,7,10],
  "sus2":  [0,2,7],
  "sus4":  [0,5,7],
  "dim":   [0,3,6],
  "dim7":  [0,3,6,9],
  "aug":   [0,4,8],
  "add9":  [0,2,4,7],
  "9":     [0,4,7,10,14],
  "M9":    [0,4,7,11,14],
  "m9":    [0,3,7,10,14],
  "6":     [0,4,7,9],
  "m6":    [0,3,7,9],
  "m7b5":  [0,3,6,10],
  "7sus4": [0,5,7,10],
  // inversões — mantém apenas as 3 notas primárias num voicing de 2 oitavas
  "/E": [4,7,12], "/G": [7,12,16], "/B": [4,7,12],
  "/D": [3,7,12], "/A": [7,12,15], "/C": [7,12,16],
  "/F#":[4,7,12], "/G#":[4,8,12], "/C#":[4,7,12],
};

/* Converte string de acorde (ex: "Am7", "D/F#", "Bb") em { rootIdx, intervals }
   para renderizar o diagrama de teclado. */
function parseChordForKeyboard(chord) {
  if (!chord) return null;
  const p = parseChordRoot(chord);
  if (!p || p.idx === -1) return null;
  const rootIdx = p.idx; // 0-11
  let suffix = p.rest || "";
  // Normaliza abreviações: "4" → "sus4", "maj7" → "M7", etc.
  suffix = normalizeSuffix(suffix);
  // Tenta sufixo exato; fallback: inversão → acorde simples; fallback: maior
  let intervals = PIANO_INTERVALS[suffix];
  if (!intervals && suffix.startsWith("/")) intervals = PIANO_INTERVALS[""];
  if (!intervals) intervals = PIANO_INTERVALS[""];
  return { rootIdx, intervals, suffix };
}

/* SVG compacto do teclado para popup — 1 oitava (max 1.5 oitavas para extensões) */
function PianoKeyboardSVG({ chord, useFlat }) {
  const parsed = parseChordForKeyboard(chord);
  const noteNames = useFlat ? PIANO_NOTE_FLAT : PIANO_NOTE_SHARP;

  if (!parsed) return (
    <div style={{ width:160, height:80, display:"flex", alignItems:"center",
      justifyContent:"center", color:"#5d917a", fontSize:11 }}>sem diagrama</div>
  );

  const { rootIdx, intervals } = parsed;

  // Conjunto de semitons absolutos do acorde (0-11) para destaque
  const chordSemitones = new Set(intervals.map(iv => (rootIdx + iv) % 12));

  // ── OITAVA FIXA C→B (sempre 7 brancas + 5 pretas) ──────────────
  // Posição visual fixa de cada semitom dentro da oitava C-B:
  //   Brancas: C=0, D=1, E=2, F=3, G=4, A=5, B=6  (índice entre as brancas)
  //   Pretas:  C#, D#, F#, G#, A# (posicionadas entre as brancas)
  //
  // WHITE_POS[semitom] = índice da tecla branca (0-6) ou null se preta
  // BLACK_BETWEEN[semitom] = { afterWhite } se preta (posicionada após branca N)
  const WHITE_POS   = [0,null,1,null,2,3,null,4,null,5,null,6]; // C=0..B=11
  const BLACK_AFTER = [null,0,null,1,null,null,3,null,4,null,5,null]; // após branca N

  const WK = 20;   // largura de cada tecla branca
  const HW = 56;   // altura tecla branca
  const HB = 35;   // altura tecla preta
  const BW = 12;   // largura tecla preta
  const TITLE_H = 18;
  const svgW = 7 * WK;          // 7 brancas fixas = 140px
  const svgH = TITLE_H + HW + 4;
  const FS = 6.5;

  // x esquerdo de uma tecla branca dado seu índice 0-6
  const whiteLeft = (wi) => wi * WK;
  // x centro de uma tecla preta dado o índice da branca após a qual ela fica
  // C#=após C(0), D#=após D(1), F#=após F(3), G#=após G(4), A#=após A(5)
  // Centro: borda direita da branca anterior - BW/2 + pequeno ajuste visual
  const blackCX = (afterWhite) => (afterWhite + 1) * WK - BW / 2 - 1;

  const isNoteActive = (semitom) => chordSemitones.has(semitom);
  const isRootSem    = (semitom) => semitom === rootIdx;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg">

      {/* Título: nome do acorde */}
      <text x={svgW/2} y={TITLE_H - 4} textAnchor="middle"
        fontSize={11} fontFamily="'Montserrat',sans-serif" fontWeight="800" fill="#fff">
        {noteNames[rootIdx]}
        <tspan fontStyle="italic" fontSize={9}>{parsed.suffix}</tspan>
      </text>

      {/* ── TECLAS BRANCAS (C D E F G A B) ── */}
      {[0,2,4,5,7,9,11].map((sem, wi) => {
        const hl     = isNoteActive(sem);
        const isRoot = isRootSem(sem);
        const x      = whiteLeft(wi);
        return (
          <g key={`w${sem}`}>
            <rect
              x={x + 0.7} y={TITLE_H}
              width={WK - 1.4} height={HW}
              rx={2}
              fill={hl ? (isRoot ? "#d0d0d0" : "#a0a0a0") : "#e8e8e8"}
              stroke="#666" strokeWidth={0.7}
            />
            {hl && (
              <>
                <circle
                  cx={x + WK/2} cy={TITLE_H + HW - 9}
                  r={5}
                  fill={isRoot ? "#fff" : "#ddd"}
                />
                <text
                  x={x + WK/2} y={TITLE_H + HW - 9 + FS * 0.38}
                  textAnchor="middle" fontSize={FS}
                  fontFamily="Arial,sans-serif" fontWeight="bold" fill="#111">
                  {noteNames[sem]}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* ── TECLAS PRETAS (C# D# F# G# A#) ── */}
      {[1,3,6,8,10].map((sem) => {
        const afterW = BLACK_AFTER[sem]; // índice da branca após a qual fica
        const cx     = blackCX(afterW);
        const hl     = isNoteActive(sem);
        const isRoot = isRootSem(sem);
        return (
          <g key={`b${sem}`}>
            <rect
              x={cx - BW/2} y={TITLE_H}
              width={BW} height={HB}
              rx={2}
              fill={hl ? (isRoot ? "#777" : "#555") : "#111"}
              stroke={hl ? "#bbb" : "#000"} strokeWidth={0.5}
            />
            {hl && (
              <>
                <circle
                  cx={cx} cy={TITLE_H + HB - 7}
                  r={4}
                  fill="#fff"
                />
                <text
                  x={cx} y={TITLE_H + HB - 7 + (FS - 1) * 0.38}
                  textAnchor="middle" fontSize={FS - 1}
                  fontFamily="Arial,sans-serif" fontWeight="bold" fill="#000">
                  {noteNames[sem]}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* SVG do diagrama de acorde — preto e branco, tamanho compacto para popup */
function ChordDiagramSVG({ chord, diagramData }) {
  if (!diagramData) return (
    <div style={{ width: 100, height: 120, display:"flex", alignItems:"center", justifyContent:"center", color:"#5d917a", fontSize:12 }}>
      sem diagrama
    </div>
  );
  const { frets, fingers, baseFret, barre } = diagramData;
  const numStrings = 6;
  const numFrets = 5;
  const W = 100, pL = 14, pT = 28;
  const strF = 13; // espaço entre cordas
  const fretH = 15; // altura de cada traste
  const gridW = strF * (numStrings - 1);
  const gridH = fretH * numFrets;
  const totalH = pT + gridH + 14;
  const dotR = 5;
  const fontSize = 8;

  const sx = i => pL + i * strF;        // x da corda i (0=corda6 grave, esquerda)
  const fy = f => pT + f * fretH;       // y do traste f

  return (
    <svg width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`} xmlns="http://www.w3.org/2000/svg">
      {/* Nome */}
      <text x={W/2} y={11} textAnchor="middle" fontSize={11} fontFamily="'Montserrat',sans-serif" fontWeight="800" fill="#fff">
        {chord}
      </text>

      {/* Indicador de traste (se não é posição aberta) */}
      {baseFret > 1 && (
        <text x={pL + gridW + 4} y={pT + fretH * 0.75} fontSize={7} fontFamily="Arial,sans-serif" fill="#9fdabb">{baseFret}fr</text>
      )}

      {/* Nut (casalha) — grossa só na 1ª posição */}
      <rect x={pL-1} y={pT} width={gridW+2} height={baseFret===1 ? 3 : 1} fill="#fff" />

      {/* Cordas verticais */}
      {Array.from({length: numStrings}).map((_,i) => (
        <line key={`s${i}`} x1={sx(i)} y1={pT} x2={sx(i)} y2={pT+gridH} stroke="#fff" strokeWidth={0.7} opacity={0.6} />
      ))}

      {/* Trastes horizontais */}
      {Array.from({length: numFrets+1}).map((_,f) => (
        <line key={`f${f}`} x1={pL} y1={fy(f)} x2={pL+gridW} y2={fy(f)} stroke="#fff" strokeWidth={0.7} opacity={0.3} />
      ))}

      {/* Barra (cejilha de dedo) */}
      {barre && (() => {
        const rel = barre.fret - baseFret;
        if (rel < 0 || rel >= numFrets) return null;
        const x1 = sx(numStrings - barre.fromString);
        const x2 = sx(numStrings - barre.toString);
        const cy = fy(rel) + fretH/2;
        return (
          <rect
            x={Math.min(x1,x2)-dotR} y={cy-dotR}
            width={Math.abs(x2-x1)+dotR*2} height={dotR*2}
            rx={dotR} fill="#fff"
          />
        );
      })()}

      {/* X e O acima da grade */}
      {frets.map((fret, idx) => {
        const cx = sx(idx);
        const cy = pT - 8;
        if (fret === -1) return (
          <g key={`x${idx}`}>
            <line x1={cx-3} y1={cy-3} x2={cx+3} y2={cy+3} stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.7}/>
            <line x1={cx+3} y1={cy-3} x2={cx-3} y2={cy+3} stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.7}/>
          </g>
        );
        if (fret === 0) return (
          <circle key={`o${idx}`} cx={cx} cy={cy} r={3} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.7}/>
        );
        return null;
      })}

      {/* Pontos dos dedos */}
      {frets.map((fret, idx) => {
        if (fret <= 0) return null;
        const rel = fret - baseFret;
        if (rel < 0 || rel >= numFrets) return null;
        const cx = sx(idx);
        const cy = fy(rel) + fretH/2;
        const finger = fingers ? fingers[idx] : 0;
        const inBarre = barre && fret === barre.fret &&
          idx >= (numStrings - barre.fromString) && idx <= (numStrings - barre.toString);
        if (inBarre) {
          return finger > 0 ? (
            <text key={`bf${idx}`} x={cx} y={cy+fontSize*0.38} textAnchor="middle" fontSize={fontSize-1} fontFamily="Arial,sans-serif" fontWeight="bold" fill="#111">{finger}</text>
          ) : null;
        }
        return (
          <g key={`dot${idx}`}>
            <circle cx={cx} cy={cy} r={dotR} fill="#fff"/>
            {finger > 0 && (
              <text x={cx} y={cy+fontSize*0.38} textAnchor="middle" fontSize={fontSize-1} fontFamily="Arial,sans-serif" fontWeight="bold" fill="#111">{finger}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* Popup flutuante — mostra violão (modos chords/bass) ou teclado (modo keyboard).
   Aparece ACIMA do acorde clicado.
   Usa position:fixed + coords de viewport (getBoundingClientRect).
   Mede a própria altura após render para posicionar com precisão (evita flash). */
function ChordPopup({ chord, anchorRect, onClose }) {
  const ctx        = useContext(ChordPopupContext);
  const isKeyboard = ctx?.viewMode === "keyboard";
  const useFlat    = ctx?.useFlat  ?? false;

  const diagram  = isKeyboard ? null : findChordDiagram(chord);
  const popupRef = useRef(null);
  const [popupH, setPopupH] = useState(0);

  // Mede a altura real do popup depois de renderizar o conteúdo
  useEffect(() => {
    if (popupRef.current) setPopupH(popupRef.current.offsetHeight);
  }, [chord, isKeyboard]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", handler), 80);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", handler); };
  }, [onClose]);

  const POP_W = isKeyboard ? 148 : 122;  // teclado: 7×20px=140 + padding

  // Centraliza horizontalmente sobre o acorde clicado
  const anchorCX = (anchorRect?.left ?? 0) + (anchorRect?.width ?? 0) / 2;
  let left = anchorCX - POP_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - POP_W - 8));

  // Posiciona ACIMA: topo do acorde − altura do popup − 8px de gap
  // anchorRect.top é coordenada de viewport → compatível com position:fixed
  let top = (anchorRect?.top ?? 0) - popupH - 8;
  // Se não há espaço acima, inverte e aparece abaixo
  if (top < 8) top = (anchorRect?.bottom ?? 0) + 8;

  return (
    <div ref={popupRef} style={{
      position: "fixed", left, top, zIndex: 9000,
      background: "#0d2518",
      border: `1px solid ${isKeyboard ? "#4f9dde66" : "#2f7d57"}`,
      borderRadius: 12,
      padding: isKeyboard ? "8px 10px 6px" : "10px 10px 8px",
      boxShadow: "0 8px 32px rgba(0,0,0,.75)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      minWidth: POP_W,
      pointerEvents: "auto",
      // Invisível na 1ª frame (popupH ainda é 0) para evitar flash de posição errada
      opacity: popupH === 0 ? 0 : 1,
      transition: "opacity .08s",
    }}>
      {isKeyboard ? (
        <PianoKeyboardSVG chord={chord} useFlat={useFlat} />
      ) : (
        <>
          <ChordDiagramSVG chord={chord} diagramData={diagram} />
          {!diagram && (
            <div style={{ fontSize: 10, color: "#5d917a", textAlign: "center", marginTop: 2 }}>
              Diagrama não disponível
            </div>
          )}
        </>
      )}
      <button onClick={onClose} style={{
        marginTop: 2, background: "transparent", border: "none",
        color: "#5d917a", fontSize: 10, cursor: "pointer",
        fontFamily: "'Montserrat',sans-serif",
      }}>fechar ✕</button>
    </div>
  );
}

/* Context para o popup — viewMode e useFlat transitam até ChordDisplay sem prop-drilling */
const ChordPopupContext = React.createContext(null);

function ChordDisplay({ chord, style, interactive }) {
  const { root, suffix, slash } = splitChordSuffix(chord);
  const ctx = useContext(ChordPopupContext);

  const handleClick = useCallback((e) => {
    if (!interactive || !ctx) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.openPopup(chord, rect);
  }, [chord, interactive, ctx]);

  const spanStyle = {
    ...style,
    ...(interactive ? { cursor: "pointer", borderRadius: 3, padding: "0 1px", transition: "background .12s" } : {}),
  };

  const inner = (
    <>
      {root}
      {suffix ? <sup style={{ fontSize: "0.68em", lineHeight: 1, verticalAlign: "super", letterSpacing: 0 }}>{suffix}</sup> : null}
      {slash}
    </>
  );

  if (!interactive) {
    if (!suffix && !slash) return <span style={style}>{chord}</span>;
    return <span style={style}>{inner}</span>;
  }

  return (
    <span
      style={spanStyle}
      onClick={handleClick}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(63,174,107,.2)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      {!suffix && !slash ? chord : inner}
    </span>
  );
}

function ChartLine({ line, semitones, useFlats, mode = "chords", interactive = false }) {
  if (!line.trim()) return <div style={{ height: "1.4em" }} />;
  const t = transposeText(line, semitones, useFlats);
  const parts = t.split(/(\[[^\]]+\])/g).filter(p => p !== "");
  const hasLyrics = parts.some(p => !(p.startsWith("[") && p.endsWith("]")) && p.trim() !== "");

  // transforma o acorde conforme o modo
  const showChord = (chord) => {
    if (mode === "bass") return bassNote(chord);
    return chord;
  };
  const isUnknownChord = (chord) => {
    if (!chord) return false;
    const root = parseChordRoot(chord.replace(/\[|\]/g, ""));
    return !root || root.idx === -1;
  };

  // Modo "só letra": ignora completamente os acordes
  if (mode === "lyrics") {
    if (!hasLyrics) return <div style={{ height: "0.6em" }} />; // linha só de acordes some
    const lyric = parts.filter(p => !(p.startsWith("[") && p.endsWith("]"))).join("");
    return <div style={{ lineHeight: 1.7, fontFamily: "'Montserrat',sans-serif", fontSize: "1em", color: "#eef5f0", whiteSpace: "pre-wrap", marginBottom: 2 }}>{lyric}</div>;
  }

  // Linha só com acordes (intro, interlúdio)
  // Suporta múltiplos acordes no mesmo colchete: [C G Am F]
  if (!hasLyrics) {
    return (
      <div style={{ lineHeight: 1.9, color: "#2f9d63", fontWeight: 700, fontFamily: "'Montserrat',sans-serif", fontSize: "1em", whiteSpace: "pre-wrap", marginBottom: 2 }}>
        {parts.map((p, i) => {
          if (!p.startsWith("[")) return p;
          const inner = p.slice(1, -1).trim();
          const chords = inner.split(/\s+/);
          return (
            <React.Fragment key={i}>
              {chords.map((ch, ci) => (
                <React.Fragment key={ci}>
                  <ChordDisplay chord={showChord(ch)} interactive={interactive} />
                  {"   "}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  const groups = [];
  let pending = null;
  parts.forEach((p) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      if (pending !== null) groups.push({ chord: pending, text: "" });
      const inner = p.slice(1, -1).trim();
      const chords = inner.split(/\s+/);
      if (chords.length === 1) {
        // Acorde único — comportamento normal
        pending = chords[0];
      } else {
        // Múltiplos acordes no mesmo colchete: empilha todos exceto o último sem texto
        chords.slice(0, -1).forEach(ch => groups.push({ chord: ch, text: "" }));
        pending = chords[chords.length - 1];
      }
    } else {
      groups.push({ chord: pending, text: p });
      pending = null;
    }
  });
  if (pending !== null) groups.push({ chord: pending, text: "" });

  const chordColor = mode === "bass" ? "#2f9d63" : "#2f9d63";
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
            <span style={{ height: "1.5em", lineHeight: "1.5em", color: (g.chord && isUnknownChord(g.chord)) ? "#e0b341" : chordColor, fontWeight: 700, fontSize: "0.9em", whiteSpace: "pre", paddingRight: chordStr ? (chordNeedsGap ? "0.9em" : "0.35em") : 0, boxSizing: "content-box", textDecoration: (g.chord && isUnknownChord(g.chord)) ? "underline dotted" : "none" }} title={(g.chord && isUnknownChord(g.chord)) ? "Acorde não reconhecido — não será transposto" : undefined}>
              {chordStr ? <ChordDisplay chord={chordStr} interactive={interactive} /> : ""}
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

function SectionNote({ text, fontScale = 1 }) {
  // Quebra a instrução em trechos por vírgula, cada um em sua própria linha.
  // Evita que uma instrução longa se estique indefinidamente para a esquerda.
  const parts = text.split(",").map(p => p.trim()).filter(Boolean);
  return (
    <div style={{ textAlign: "right", marginTop: 4 }}>
      {parts.map((part, i) => (
        <div key={i} style={{ fontSize: 11 * fontScale, color: "#eef5f0", opacity: 0.45, fontStyle: "italic", lineHeight: 1.3 }}>
          {part}{i < parts.length - 1 ? "," : ""}
        </div>
      ))}
    </div>
  );
}

function RenderBlock({ content, semitones, useFlats, mode, interactive = false }) {
  const lines = content.split("\n");
  return (
    <div>
      {lines.map((line, i) => <ChartLine key={i} line={line} semitones={semitones} useFlats={useFlats} mode={mode} interactive={interactive} />)}
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

  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    if (!playing) { clearTimeout(schedulerRef.current); setVisualBeat(0); currentBeatRef.current = 0; return; }
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
      setAudioBlocked(false);
    } catch (e) { setAudioBlocked(true); return; }
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

  return { playing, setPlaying, beat: visualBeat, beatsPerBar, audioBlocked };
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
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "#111", border: "1px solid #1d4435", borderRadius: 16, padding: 24, fontFamily: "'Montserrat',sans-serif" }}>
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
  return <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg,#111 25%,#1a1a1a 50%,#111 75%)", backgroundSize: "200% 100%", animation: "skeletonPulse 1.4s ease infinite", ...s }} />;
}
function SongListSkeleton() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 22px 90px" }}>
      <style>{`@keyframes skeletonPulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#111", flexShrink: 0 }} />
          <div><SkeletonLine width={140} height={28} style={{ marginBottom: 8 }} /><SkeletonLine width={180} height={13} /></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <SkeletonLine width={80} height={36} radius={11} />
          <SkeletonLine width={80} height={36} radius={11} />
        </div>
      </div>
      {/* Search + action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <SkeletonLine height={48} radius={11} style={{ flex: 1, minWidth: 220 }} />
        <SkeletonLine width={120} height={48} radius={11} />
        <SkeletonLine width={130} height={48} radius={11} />
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 26 }}>
        {[110, 95, 85].map((w, i) => <SkeletonLine key={i} width={w} height={38} radius={10} />)}
      </div>
      {/* Category groups */}
      {[1,2,3].map(i => (
        <div key={i} style={{ background: "#111", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <SkeletonLine width={4} height={18} radius={2} />
            <SkeletonLine width={100 + i * 20} height={13} />
            <SkeletonLine width={24} height={13} style={{ marginLeft: "auto" }} />
            <SkeletonLine width={16} height={16} radius={4} />
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

  // Re-sincroniza a música aberta sempre que a lista de músicas (songs) é atualizada —
  // por exemplo quando a resposta do Supabase chega depois de já ter aberto uma versão
  // em cache (localStorage), ou quando outro editor salva uma alteração na mesma música.
  // Sem isso, "current" ficava congelado na versão de quando você abriu a cifra, e o
  // capo/tom corretos só apareciam se você saísse e abrisse a música de novo.
  useEffect(() => {
    if (view !== "view" || !current?.id) return; // só re-sincroniza na visualização, nunca durante a edição
    const fresh = songs.find(s => s.id === current.id);
    if (fresh && fresh !== current) {
      setCurrent(fresh);
    }
  }, [songs, view]);
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
      setMemberName(meta.nome || meta.full_name || session.user.email.split("@")[0]);
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

  // Grupos dinâmicos: carrega da tabela 'groups' no Supabase se existir, senão usa hardcoded
  const [worshipGroups, setWorshipGroups] = useState(WORSHIP_GROUPS);
  useEffect(() => {
    if (!session) return;
    supabase.from("groups").select("name").then(({ data }) => {
      if (data && data.length > 0) setWorshipGroups(data.map(r => r.name));
    });
  }, [session]);

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

  // Link direto ?song=ID — abre a música ao clicar num link compartilhado
  useEffect(() => {
    if (!session || songs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const songId = params.get("song");
    if (!songId) return;
    const found = songs.find(s => s.id === songId);
    if (found) {
      setCurrent(found);
      setView("view");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [songs, session]);

  // ----- Preferências de tom/capo por música (conta + cache offline) -----
  const PREFS_CACHE_KEY = session?.user?.id ? `ipb:prefs:${session.user.id}` : null;
  const [prefs, setPrefs] = useState(() => {
    if (!PREFS_CACHE_KEY) return {};
    try { return JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || "{}"); } catch (e) { return {}; }
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const loadPrefs = useCallback(async () => {
    if (!session?.user) return;
    let { data, error } = await supabase
      .from("user_prefs").select("song_id, semitones, capo, base_capo, bpm_override")
      .eq("user_id", session.user.id);
    // Coluna base_capo pode não existir ainda (banco antigo) — refaz sem ela.
    if (error) {
      ({ data, error } = await supabase
        .from("user_prefs").select("song_id, semitones, capo")
        .eq("user_id", session.user.id));
    }
    if (!error && data) {
      const map = {};
      data.forEach(r => { map[r.song_id] = { semitones: r.semitones, capo: r.capo, baseCapo: r.base_capo ?? null, bpmOverride: r.bpm_override ?? null }; });
      setPrefs(map);
      try { if (PREFS_CACHE_KEY) localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(map)); } catch (e) {}
    }
    setPrefsLoaded(true);
  }, [session, PREFS_CACHE_KEY]);
  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const savePref = useCallback(async (songId, semitones, capo, baseCapo, bpmOverride) => {
    if (!session?.user || !songId) return;
    setPrefs(p => {
      const next = { ...p, [songId]: { semitones, capo, baseCapo, bpmOverride } };
      try { if (PREFS_CACHE_KEY) localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    let { error } = await supabase.from("user_prefs").upsert({
      user_id: session.user.id, song_id: songId, semitones, capo, base_capo: baseCapo, bpm_override: bpmOverride ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,song_id" });
    // Colunas base_capo/bpm_override podem não existir ainda — refaz sem elas.
    if (error) {
      ({ error } = await supabase.from("user_prefs").upsert({
        user_id: session.user.id, song_id: songId, semitones, capo, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,song_id" }));
    }
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
    // Remove campos internos antes de exportar (._id nas seções, updatedAt, updatedBy)
    const cleanSongs = songs.map(s => {
      const { updatedAt, updatedBy, ...rest } = s;
      if (Array.isArray(rest.sections)) {
        rest.sections = rest.sections.map(({ _id, ...sec }) => sec);
      }
      return rest;
    });
    const data = { app: "IPBCharts", version: 1, exportedAt: new Date().toISOString(), songs: cleanSongs };
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
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q) ||
      (s.hymnNumber != null && String(s.hymnNumber).toLowerCase().includes(q)) ||
      (s.feel || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q) ||
      (s.categoryOther || "").toLowerCase().includes(q) ||
      (s.key || "").toLowerCase().includes(q)
    );
  }, [songs, search]);

  // Aviso de performance para acervos grandes
  const isLargeLibrary = songs.length > 150;

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
      html {
        background: #000;
        overflow-x: hidden;
        max-width: 100vw;
      }
      body {
        margin: 0;
        background: #000;
        overflow-x: hidden;
        max-width: 100vw;
        -webkit-overflow-scrolling: touch;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
      }
      #root, #__next { overflow-x: hidden; max-width: 100vw; }
      @keyframes tmSlideIn { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
      @keyframes tmFadeIn  { from { opacity:0; } to { opacity:1; } }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: #000; }
      /* iOS dá zoom automático ao focar campo com fonte < 16px; força 16px para evitar */
      input, textarea, select { font-size: 16px !important; }
      ::-webkit-scrollbar-thumb { background: #1d4435; border-radius: 5px; }
      ::selection { background: #2f7d57; color: #fff; }
    `}</style>
  );

  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Montserrat',sans-serif", gap:18 }}>
        {styleTag}
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
        <Logo size={64} />
        <div style={{ display:"flex", alignItems:"center", gap:10, color:"#6fae8a", fontSize:15 }}>
          <div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid #3fae6b", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} />
          Iniciando…
        </div>
      </div>
    );
  }

  if (!session) {
    return <div>{styleTag}<AuthScreen /></div>;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#eef5f0", fontFamily: "'Montserrat',sans-serif" }}>
        {styleTag}<SongListSkeleton />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#eef5f0", fontFamily: "'Montserrat',sans-serif" }}>
      {styleTag}
      {confirmModal}
      {!online && (
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#2f9d63", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
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
        isLargeLibrary={isLargeLibrary}
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
      {view === "teoria" && <TeoriaMusicaViewWrapped onBack={() => setView("list")} />}
      {view === "view" && current && <SongView song={current} canEdit={canEdit}
        pref={prefs[current.id]} prefsLoaded={prefsLoaded} onSavePref={(st, cp, bpmOv) => savePref(current.id, st, cp, Number(current.capoSuggested) || 0, bpmOv)}
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

function TeoriaMusicaViewWrapped(props) {
  return (
    <TmScoreProvider>
      <TeoriaMusicaView {...props} />
    </TmScoreProvider>
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
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nome, setNome] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info"); // "info" | "error" | "success"
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(""); setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setMsg("Email de recuperação enviado! Verifique sua caixa de entrada (e o spam).");
        setMsgType("success");
        setBusy(false); return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password: pass,
          options: { data: { nome: nome.trim() } }
        });
        if (error) throw error;
        setMsg("Conta criada! Se pedir confirmação, verifique seu email. Depois é só entrar.");
        setMsgType("success");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
      }
    } catch (e) {
      setMsg(e.message === "Invalid login credentials" ? "Email ou senha incorretos." : e.message);
      setMsgType("error");
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", boxShadow: "0 12px 32px rgba(0,0,0,.45)", borderRadius: "50%" }}>
            <Logo size={76} />
          </div>
          <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 46, color: "#fff", margin: "16px 0 2px", letterSpacing: -0.5 }}>IPBCharts</h1>
          <p style={{ color: "#6fae8a", margin: 0 }}>Repertório do louvor</p>
        </div>
        <div style={{ background: "#111", border: "1px solid #15392b", borderRadius: 18, padding: 26 }}>
          <h2 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 26, color: "#fff", margin: "0 0 18px" }}>
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
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
          {mode !== "forgot" && (
            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={authLabel}>Senha</span>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  style={{ ...inputStyle(), paddingRight: 44 }} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6fae8a", fontSize: 13, padding: 4 }}>
                  {showPass ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
          )}
          {msg && (
            <div style={{
              background: msgType === "error" ? "rgba(232,85,77,.12)" : msgType === "success" ? "rgba(63,174,107,.12)" : "rgba(63,174,107,.08)",
              border: `1px solid ${msgType === "error" ? "#e8554d44" : "#1d6b46"}`,
              color: msgType === "error" ? "#e8a09a" : "#9fdabb",
              padding: "10px 12px", borderRadius: 10, fontSize: 13.5, marginBottom: 14, lineHeight: 1.5
            }}>{msg}</div>
          )}
          <button onClick={submit} disabled={busy} style={{ ...primaryBtn(), width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Aguarde…" : (mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar email de recuperação")}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, color: "#6fae8a", fontSize: 14 }}>
            {mode === "login" ? (<>
              <button onClick={() => { setMode("forgot"); setMsg(""); }} style={linkBtn}>Esqueci minha senha</button>
              {" · "}
              <button onClick={() => { setMode("signup"); setMsg(""); }} style={linkBtn}>Criar conta</button>
            </>) : mode === "signup" ? (
              <>Já tem conta? <button onClick={() => { setMode("login"); setMsg(""); }} style={linkBtn}>Entrar</button></>
            ) : (
              <button onClick={() => { setMode("login"); setMsg(""); }} style={linkBtn}>← Voltar para o login</button>
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
  const hymnSec = showHymnNumber ? getHymnSection(s.hymnNumber) : null;
  const sectionBarColor = hymnSec ? hymnSec.color : catColor;
  return (
    <button onClick={() => onOpen(s)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        background: "transparent", border: "none", borderBottom: "1px solid #143426",
        padding: "11px 6px", cursor: "pointer", fontFamily: "'Montserrat',sans-serif",
        paddingLeft: showHymnNumber ? 0 : 6 }}
      onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      {/* barra colorida da seção do hinário (só na aba Hinos) ou ponto de categoria */}
      {showHymnNumber ? (
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
          {/* barra lateral colorida da seção */}
          <div style={{ width: 3, alignSelf: "stretch", background: sectionBarColor, borderRadius: "0 2px 2px 0", marginRight: 10, opacity: 0.75 }} />
          {/* badge dourado com número */}
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#d4a017,#a87813)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d3d28", fontWeight: 800, fontSize: 13.5, flexShrink: 0, letterSpacing: -0.5 }}>
            {s.hymnNumber || "—"}
          </div>
        </div>
      ) : (
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: catColor, flexShrink: 0 }} />
      )}
      {/* título + artista */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15.5, color: "#fff", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflow: "hidden" }}>
          {s.artist && <span style={{ color: "#6fae8a", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1 }}>{s.artist}</span>}
          {s.updatedBy && s.updatedAt && <span style={{ color: "#3d5a4a", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>· {s.updatedBy} {relativeTime(s.updatedAt)}</span>}
        </div>
      </div>
      {/* lado direito: vídeo (se houver) + tom */}
      {s.youtube && <Youtube size={15} color="#e8554d" style={{ flexShrink: 0, opacity: 0.85 }} />}
      {tempoLabel(s.bpm) && <span style={{ flexShrink: 0, fontSize: 11, color: "#5d917a", whiteSpace: "nowrap" }}>{tempoLabel(s.bpm)}</span>}
      <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, color: "#9fdabb", background: "rgba(63,174,107,.12)", borderRadius: 7, padding: "4px 9px", minWidth: 30, textAlign: "center" }}>{s.key || "—"}</span>
    </button>
  );
}

// Formata tempo relativo (ex: "há 3 dias", "hoje")

function tempoLabel(bpm) {
  if (!bpm || bpm <= 0) return null;
  if (bpm < 65)  return "Lento";
  if (bpm < 90)  return "Suave";
  if (bpm < 115) return "Médio";
  if (bpm < 145) return "Animado";
  return "Agitado";
}
function relativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 30) return `há ${Math.floor(d/7)} sem.`;
  if (d < 365) return `há ${Math.floor(d/30)} meses`;
  return `há ${Math.floor(d/365)} ano${Math.floor(d/365)>1?"s":""}`;
}

/* ---------- Seletor de grupos de louvor do usuário ---------- */
function GroupPicker({ myGroups, onSave, onClose }) {
  const [sel, setSel] = useState(myGroups || []);
  const toggle = (g) => setSel(sel.includes(g) ? sel.filter(x => x !== g) : [...sel, g]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#111", border: "1px solid #1d4435", borderRadius: 16, padding: 22 }}>
        <h2 style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 20, color: "#fff" }}>Meus grupos de louvor</h2>
        <p style={{ margin: "0 0 16px", color: "#6fae8a", fontSize: 13.5 }}>Escolha o(s) grupo(s) a que você pertence. Você verá os repertórios criados para eles.</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          {WORSHIP_GROUPS.map(g => {
            const on = sel.includes(g);
            return (
              <button key={g} onClick={() => toggle(g)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 11, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 15, fontWeight: 600, textAlign: "left",
                  border: on ? "1px solid #2f7d57" : "1px solid #15392b",
                  background: on ? "linear-gradient(135deg,#1a1a1a,#111)" : "transparent",
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
                background: active ? "linear-gradient(135deg,#1a1a1a,#111)" : "transparent",
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

      {/* Expandir/Recolher tudo — só na aba Hinos, sem busca ativa */}
      {groupBy === "hymns" && !search.trim() && hymnsBySection.keys.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          {(() => {
            const allOpen = hymnsBySection.keys.every(k => openCategories[`hymn:${k}`]);
            return (
              <button
                onClick={() => {
                  const next = {};
                  hymnsBySection.keys.forEach(k => { next[`hymn:${k}`] = !allOpen; });
                  setOpenCategories(prev => ({ ...prev, ...next }));
                }}
                style={{ ...ghostBtn(), padding: "6px 13px", fontSize: 12.5 }}>
                {allOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {allOpen ? "Recolher tudo" : "Expandir tudo"}
              </button>
            );
          })()}
        </div>
      )}


      {/* Músicas recentes — visível apenas sem busca ativa */}
      {!search.trim() && recentSongs && recentSongs.length > 0 && groupBy !== "hymns" && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5d917a", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 10 }}>Abertas recentemente</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentSongs.map(s => (
              <button key={s.id} onClick={() => onOpen(s)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid #15392b", background: "#111", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left", maxWidth: 220 }}
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
              <div key={sectionLabel} style={{ background: "#111", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden" }}>
                {/* Cabeçalho da seção */}
                <button
                  onClick={() => toggleCategory(`hymn:${sectionLabel}`)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; }}
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
              <div key={k} style={{ background: "#111", border: "1px solid #15392b", borderRadius: 13, overflow: "hidden" }}>
                {/* Cabeçalho clicável */}
                <button onClick={() => toggleCategory(k)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; }}
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
    .topbar { position: fixed; top: 0; left: 0; right: 0; background: #000; border-bottom: 1px solid #1d4435; padding: 10px 16px; display: flex; gap: 10px; align-items: center; z-index: 50; }
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

// Seletor de tom em lista — substitui as setas de Transpor.
// Toca no Tom atual e abre uma lista vertical com os tons possíveis,
// limitada a 1 oitava abaixo e 1 oitava acima do tom original (±12 semitons).
// Tons mais graves aparecem acima; tons mais agudos aparecem abaixo — como um "elevador" de tom.
// Botão flutuante de auto-scroll — uma só velocidade, lógica simples e direta.
// Usa setInterval + window.scrollBy, sem rampas ou cálculos de física —
// a abordagem mais previsível para funcionar de forma consistente no celular.
function AutoScrollControl() {
  const [scrolling, setScrolling] = useState(false);
  const intervalRef = useRef(null);
  const remainderRef = useRef(0); // acumula a parte fracionária do scroll para suavizar o movimento

  useEffect(() => {
    if (!scrolling) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      remainderRef.current = 0;
      return;
    }
    // Mesma velocidade média (~40px/seg), mas em passos menores e mais frequentes —
    // o movimento fica visualmente contínuo em vez de "pulando" pixel a pixel.
    const STEP_MS = 16; // ~60 atualizações por segundo
    const PX_PER_SEC = 40;
    const pxPerStep = PX_PER_SEC / (1000 / STEP_MS);
    intervalRef.current = setInterval(() => {
      const scroller = document.scrollingElement || document.documentElement;
      const maxScroll = scroller.scrollHeight - window.innerHeight;
      if (scroller.scrollTop >= maxScroll - 2) {
        setScrolling(false);
        return;
      }
      // acumula fração de pixel para não perder precisão com incrementos pequenos
      remainderRef.current += pxPerStep;
      const wholePx = Math.floor(remainderRef.current);
      if (wholePx > 0) {
        window.scrollBy(0, wholePx);
        remainderRef.current -= wholePx;
      }
    }, STEP_MS);
    return () => clearInterval(intervalRef.current);
  }, [scrolling]);

  return (
    <button onClick={() => setScrolling(s => !s)} title={scrolling ? "Pausar rolagem automática" : "Iniciar rolagem automática"}
      style={{
        position: "fixed", right: 14, bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)", zIndex: 120,
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: "50%", border: "1px solid #1d443566",
        background: scrolling ? "#3fae6b" : "rgba(0,0,0,.85)",
        color: scrolling ? "#0d3d28" : "#6fae8a",
        cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,.3)"
      }}>
      {scrolling ? <Pause size={13} /> : <ChevronsDown size={15} />}
    </button>
  );
}

function KeyTransposePicker({ baseKey, semitones, setSemitones, soundingKey }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  const currentItemRef = useRef(null);
  const OCTAVE_LIMIT = 12; // ±1 oitava — cobre todas as 12 notas em cada direção sem exagero prático
  const options = [];
  for (let s = OCTAVE_LIMIT; s >= -OCTAVE_LIMIT; s--) {
    const raw = transposeKey(baseKey, s, false);
    const flats = keyUsesFlats(raw);
    const label = transposeKey(baseKey, s, flats);
    options.push({ s, label });
  }
  // Ao abrir a lista, centraliza automaticamente o tom selecionado (o original, se nada foi transposto)
  useEffect(() => {
    if (open && currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ block: "center" });
    }
  }, [open]);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(63,174,107,.14)", border: "1px solid #1d6b46", borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontFamily: "'Montserrat',sans-serif" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#6fae8a" }}>Tom</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{soundingKey}</span>
        {semitones !== 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#3fae6b" }}>{semitones > 0 ? "+" : ""}{semitones}</span>}
        <ChevronDown size={13} color="#6fae8a" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div ref={listRef} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 91, background: "#111", border: "1px solid #1d4435", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.45)", padding: 6, maxHeight: 320, overflowY: "auto", minWidth: 140 }}>
            <div style={{ fontSize: 10, color: "#5d917a", textAlign: "center", padding: "4px 0 6px", borderBottom: "1px solid #1d4435", marginBottom: 4 }}>
              ↑ mais grave · mais agudo ↓
            </div>
            {options.map(opt => {
              const isCurrent = opt.s === semitones;
              const isOriginal = opt.s === 0;
              return (
                <button key={opt.s} ref={isCurrent ? currentItemRef : null} onClick={() => { setSemitones(opt.s); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                    padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: isCurrent ? "rgba(63,174,107,.18)" : "transparent",
                    color: isCurrent ? "#3fae6b" : "#eef5f0", fontFamily: "'Montserrat',sans-serif",
                    fontSize: 13.5, fontWeight: isCurrent ? 800 : isOriginal ? 700 : 500, marginBottom: 1
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "#1a1a1a"; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}>
                  <span>{opt.label}{isOriginal && <span style={{ fontSize: 10, color: "#5d917a", marginLeft: 6, fontWeight: 500 }}>(original)</span>}</span>
                  <span style={{ fontSize: 11, color: isCurrent ? "#3fae6b" : "#5d917a" }}>{opt.s > 0 ? "+" : ""}{opt.s !== 0 ? opt.s : ""}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


// Hook que rastreia qual seção está visível no topo da viewport durante a leitura
function useCurrentSection(sections) {
  const [currentSec, setCurrentSec] = React.useState(0);
  const refsRef = React.useRef([]);
  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const i = Number(e.target.dataset.secIdx);
            if (!isNaN(i)) setCurrentSec(i);
          }
        });
      },
      { threshold: 0, rootMargin: "-20% 0px -70% 0px" }
    );
    refsRef.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [(sections||[]).length]);
  return { currentSec, refsRef };
}

function SongView({ song, canEdit, pref, prefsLoaded, onSavePref, onBack, onEdit, currentSetlist, songs, onNavigateSong }) {
  const capoSuggested = Number(song.capoSuggested) || 0;
  // A preferência só é válida se foi salva com o MESMO capo sugerido que a música tem agora.
  // Se o editor mudou o capo sugerido depois que essa preferência foi salva, ela fica obsoleta
  // e o capo (e tom) atuais da música devem prevalecer.
  const prefIsStale = pref && pref.baseCapo != null && Number(pref.baseCapo) !== capoSuggested;
  const validPref = prefIsStale ? null : pref;
  const [semitones, setSemitones] = useState(validPref?.semitones || 0);
  // capo inicial = preferência salva do usuário (se ainda válida), ou o capo sugerido da música
  const [capo, setCapo] = useState(validPref?.capo != null ? validPref.capo : capoSuggested);
  const [viewMode, setViewMode] = useState("chords"); // chords | lyrics | bass
  const [fontScale, setFontScale] = useState(0.9);
  const baseKey = song.key || "C";
  // O CONTEÚDO digitado representa as FORMAS tocadas COM o capo sugerido.
  // song.key é o tom REAL (o que soa). som real = formas + capoSuggested.
  // som real (tom que soa) = base + transposição do usuário
  // Sem transposição, mostra exatamente a grafia escolhida na edição (ex: C#, não Db).
  // Só recalcula sustenido/bemol quando há transposição de fato — aí não há "grafia original" a preservar.
  const soundingKey = semitones === 0
    ? baseKey
    : transposeKey(baseKey, semitones, keyUsesFlats(transposeKey(baseKey, semitones, false)));
  const useFlats = keyUsesFlats(soundingKey);
  // formas exibidas: conteúdo já equivale ao capo sugerido; ajusta a diferença do capo atual
  const shapeShift = semitones + (capoSuggested - capo);
  const _shapeRaw = transposeKey(baseKey, semitones - capo, false);
  const shapeUseFlats = keyUsesFlats(_shapeRaw);
  const shapeKey = transposeKey(baseKey, semitones - capo, shapeUseFlats);
  const [bpmOverride, setBpmOverride] = useState(null);
  const effectiveBpm = bpmOverride ?? (song.bpm || 120);
  const { playing, setPlaying, beat, beatsPerBar, audioBlocked } = useMetronome(effectiveBpm, song.timeSig);
  const { currentSec, refsRef } = useCurrentSection(song.sections || []);
  const [copied, setCopied] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const ytId = useMemo(() => extractYouTubeId(song.youtube), [song.youtube]);

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

  // Ao trocar de música, esquece a aplicação anterior — a próxima música precisa
  // passar pelo processo de aplicar sua própria preferência (ou capo/tom padrão) do zero.
  useEffect(() => { appliedFor.current = null; }, [song.id]);

  // Aplica a preferência salva (tom/capo) da pessoa para esta música — só UMA vez por música,
  // assim que soubermos com certeza se existe ou não uma preferência válida (prefsLoaded=true).
  // Isso evita qualquer race condition entre o capo da música e uma preferência antiga.
  useEffect(() => {
    if (!prefsLoaded) return;            // espera os dados de preferência chegarem do banco
    if (appliedFor.current === song.id) return; // já aplicado para esta música, não repete
    setSemitones(validPref?.semitones || 0);
    setCapo(validPref?.capo != null ? validPref.capo : capoSuggested);
    setBpmOverride(validPref?.bpmOverride ?? null);
    appliedFor.current = song.id;
  }, [song.id, prefsLoaded]);

  // Salva a preferência quando o usuário muda tom/capo manualmente (depois da aplicação inicial).
  useEffect(() => {
    if (appliedFor.current !== song.id) return; // ainda não aplicou a preferência inicial — não salva por engano
    const savedSemi = validPref?.semitones || 0;
    const savedCapo = validPref?.capo != null ? validPref.capo : capoSuggested;
    const savedBpm  = validPref?.bpmOverride ?? null;
    if (semitones === savedSemi && capo === savedCapo && bpmOverride === savedBpm) return;
    onSavePref?.(semitones, capo, bpmOverride);
  }, [semitones, capo]);

  // ao abrir uma música, começa do topo (cabeçalho), não na posição anterior
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [song.id]);

  // ── Popup de diagrama de acorde ──────────────────────────────
  const [chordPopup, setChordPopup] = useState(null); // { chord, rect }
  const openPopup = useCallback((chord, rect) => {
    setChordPopup(prev => prev?.chord === chord ? null : { chord, rect });
  }, []);
  const closePopup = useCallback(() => setChordPopup(null), []);
  // viewMode e useFlat transitam pelo context para que ChordPopup saiba qual diagrama renderizar
  const chordPopupCtx = useMemo(() => ({
    openPopup,
    viewMode,
    useFlat: (viewMode === "bass" || viewMode === "keyboard") ? useFlats : shapeUseFlats,
  }), [openPopup, viewMode, useFlats, shapeUseFlats]);
  // Fecha popup ao scrollar
  useEffect(() => {
    if (!chordPopup) return;
    const handler = () => setChordPopup(null);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [!!chordPopup]);
  // ─────────────────────────────────────────────────────────────

  return (
    <ChordPopupContext.Provider value={chordPopupCtx}>
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 110px", width: "100%", boxSizing: "border-box", overflowX: "hidden", position: "relative" }}>
      {/* Popup de diagrama — renderizado no nível do container */}
      {chordPopup && (
        <ChordPopup chord={chordPopup.chord} anchorRect={chordPopup.rect} onClose={closePopup} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 8 }}>
        <button onClick={onBack} style={{ ...ghostBtn(), padding: "8px 12px", fontSize: 13.5 }}><ArrowLeft size={18} /> {currentSetlist ? "Repertório" : "Voltar"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
          {canEdit && <button onClick={onEdit} style={{ ...ghostBtn(), padding: "8px 12px", fontSize: 13.5 }}><Edit3 size={15} /> Editar</button>}
          {/* Menu discreto de ações secundárias */}
          <button onClick={() => setActionsMenuOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, border: "1px solid #1d4435", background: actionsMenuOpen ? "rgba(63,174,107,.12)" : "transparent", color: "#6fae8a", cursor: "pointer", flexShrink: 0 }}
            title="Mais opções">
            <MoreVertical size={17} />
          </button>
          {actionsMenuOpen && (
            <>
              <div onClick={() => setActionsMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 91, background: "#111", border: "1px solid #1d4435", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.45)", padding: 6, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
                {navigator.share && (
                  <button onClick={() => {
                    const txt = buildPlainText(song, shapeShift, shapeUseFlats);
                    navigator.share({ title: song.title, text: txt }).catch(()=>{});
                    setActionsMenuOpen(false);
                  }} style={menuItemBtn()}
                  onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Upload size={15} /> Compartilhar
                  </button>
                )}
                <button onClick={() => {
                  const txt = buildPlainText(song, shapeShift, shapeUseFlats);
                  navigator.clipboard?.writeText(txt).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }).catch(()=>{});
                  setActionsMenuOpen(false);
                }} style={{ ...menuItemBtn(), color: copied ? "#3fae6b" : undefined }}
                onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Copy size={15} /> {copied ? "Copiado!" : "Copiar"}
                </button>
                <button onClick={() => { exportSongPDF(song, soundingKey, shapeShift, shapeUseFlats, capo, shapeKey); setActionsMenuOpen(false); }} style={menuItemBtn()}
                onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Download size={15} /> Exportar PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navegação no repertório — topo */}
      {currentSetlist && setlistSongs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, background: "#111", border: "1px solid #15392b", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevSong && onNavigateSong(prevSong)} disabled={!prevSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevSong ? 1 : 0.35, pointerEvents: prevSong ? "auto" : "none" }}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#6fae8a", fontWeight: 600 }}>
            {currentSetlist.name} · {currentIdx + 1} / {setlistSongs.length}
          </div>
          <button onClick={() => nextSong && onNavigateSong(nextSong)} disabled={!nextSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextSong ? 1 : 0.35, pointerEvents: nextSong ? "auto" : "none" }}>
            Próxima <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navegação entre hinos — topo */}
      {isHymnNav && (() => {
        const currentSec = getHymnSection(song.hymnNumber);
        const nextSec = nextHymn ? getHymnSection(nextHymn.hymnNumber) : null;
        const crossesBoundary = nextSec && nextSec.label !== currentSec.label;
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#111", border: "1px solid #d4a01733", borderRadius: crossesBoundary ? "12px 12px 0 0" : 12, padding: "10px 14px" }}>
              <button onClick={() => prevHymn && onNavigateSong(prevHymn)} disabled={!prevHymn}
                style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevHymn ? 1 : 0.35, pointerEvents: prevHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
                <ChevronLeft size={16} /> Anterior
              </button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 12.5, color: "#d4a017", fontWeight: 700 }}>Hino {song.hymnNumber || "—"}</div>
                <div style={{ fontSize: 10.5, color: currentSec.color, fontWeight: 600, marginTop: 1, opacity: 0.85 }}>{currentSec.label}</div>
              </div>
              <button onClick={() => nextHymn && onNavigateSong(nextHymn)} disabled={!nextHymn}
                style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextHymn ? 1 : 0.35, pointerEvents: nextHymn ? "auto" : "none", borderColor: "#d4a01744" }}>
                Próximo <ChevronRight size={16} />
              </button>
            </div>
            {crossesBoundary && (
              <div style={{ background: nextSec.color + "18", border: `1px solid ${nextSec.color}33`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "5px 14px", fontSize: 11, color: nextSec.color, fontWeight: 600, textAlign: "center" }}>
                ↓ Próxima seção: {nextSec.label}
              </div>
            )}
          </div>
        );
      })()}

      {/* Cabeçalho compacto — sem card, em linhas */}
      <div style={{ marginBottom: 18 }}>
        {/* Linha 1: título grande, sempre em uma linha (auto-ajuste) */}
        <FitTitle text={song.title} max={28} min={15} />
        {/* Linha 2: autor menor + info */}
        <div style={{ color: "#9fdabb", fontSize: 13, fontWeight: 500, margin: "1px 0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {song.artist || "—"}
          {song.category && <span style={{ color: "#6fae8a" }}> · {song.category === "Hino" && song.hymnNumber ? `Hino nº ${song.hymnNumber}` : categoryLabel(song)}</span>}
          {song.category === "Hino" && song.hymnNumber && (() => {
            const sec = getHymnSection(song.hymnNumber);
            return (
              <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: sec.color, background: sec.color + "22", border: `1px solid ${sec.color}44`, verticalAlign: "middle", textTransform: "uppercase" }}>
                {sec.label}
              </span>
            );
          })()}
          {song.timeSig && <span style={{ color: "#6fae8a" }}> · {song.timeSig}</span>}
        </div>
        {/* Linha 2b: Feel/groove — exibido só se preenchido */}
        {song.feel && (
          <div style={{ fontSize: 12, color: "#5d917a", fontStyle: "italic", marginBottom: 8, marginTop: -6 }}>
            ♪ {song.feel}
          </div>
        )}
        {/* Linha 3: Tom (clicável, abre lista) + Capo na mesma linha */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 9 }}>
          <KeyTransposePicker baseKey={baseKey} semitones={semitones} setSemitones={setSemitones} soundingKey={soundingKey} />
          {semitones !== 0 && <button onClick={() => setSemitones(0)} style={{ ...ghostBtn(), padding: "4px 9px", fontSize: 11 }}>reset</button>}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#111", border: "1px solid #15392b", borderRadius: 8, padding: "3px 5px", opacity: viewMode === "keyboard" ? 0.4 : 1 }} title={viewMode === "keyboard" ? "Capo não afeta o modo Teclado" : undefined}>
            <span style={ctrlLabel}>Capo</span>
            <button onClick={() => setCapo(c => Math.max(0, c - 1))} style={stepBtnSm()} disabled={viewMode === "keyboard"}><ChevronDown size={15} /></button>
            <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: 12.5, color: capo === 0 ? "#9fdabb" : "#fff" }}>{capo === 0 ? "—" : capo + "ª"}</span>
            <button onClick={() => setCapo(c => Math.min(11, c + 1))} style={stepBtnSm()} disabled={viewMode === "keyboard"}><ChevronUp size={15} /></button>
          </div>
        </div>
        {/* Linha 4: Metrônomo em linha única */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setPlaying(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, border: `1px solid ${audioBlocked ? "#e8554d44" : "#15392b"}`, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 12.5, background: playing ? "#fff" : "#111", color: playing ? "#0d3d28" : "#fff" }}>
            {playing ? <Pause size={15} /> : <Play size={15} />} Metrônomo · {effectiveBpm} BPM
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#111", border: "1px solid #15392b", borderRadius: 8, padding: "3px 5px" }}>
            <button onClick={() => setBpmOverride(b => Math.max(40, (b ?? song.bpm ?? 120) - 5))} style={stepBtnSm()}><Minus size={13}/></button>
            <button onClick={() => setBpmOverride(b => Math.min(240, (b ?? song.bpm ?? 120) + 5))} style={stepBtnSm()}><Plus size={13}/></button>
            {bpmOverride !== null && <button onClick={() => setBpmOverride(null)} style={{ ...ghostBtn(), padding: "2px 6px", fontSize: 10 }}>reset</button>}
          </div>
          {audioBlocked && <span style={{ fontSize: 11.5, color: "#e8a23d", fontStyle: "italic" }}>⚠ Sem permissão de áudio</span>}
          {playing && !audioBlocked && <div style={{ display: "flex", gap: 5 }}>{Array.from({ length: beatsPerBar }, (_, i) => i + 1).map(b => <div key={b} style={{ width: 9, height: 9, borderRadius: "50%", background: beat === b ? (b === 1 ? "#e8554d" : "#fff") : "rgba(255,255,255,.2)" }} />)}</div>}
        </div>
      </div>

      {/* Seletor de modo + tamanho de fonte */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", gap: 3, background: "#111", border: "1px solid #15392b", borderRadius: 10, padding: 4 }}>
          {[["chords", "Violão"], ["keyboard", "Teclado"], ["bass", "Baixo"], ["lyrics", "Só letra"]].map(([m, lbl]) => {
            const active = viewMode === m;
            return (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 600,
                  background: active ? "linear-gradient(135deg,#1a1a1a,#111)" : "transparent", color: active ? "#fff" : "#6fae8a" }}>
                {lbl}
              </button>
            );
          })}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#111", border: "1px solid #15392b", borderRadius: 10, padding: "4px 6px" }}>
          <Type size={15} color="#6fae8a" />
          <button onClick={() => setFontScale(f => Math.max(0.8, Math.round((f - 0.1) * 10) / 10))} style={{ ...iconBtn(), width: 28, height: 28 }}><Minus size={15} /></button>
          <span style={{ fontSize: 12, color: "#9fc7b2", minWidth: 38, textAlign: "center" }}>{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(f => Math.min(1.8, Math.round((f + 0.1) * 10) / 10))} style={{ ...iconBtn(), width: 28, height: 28 }}><Plus size={15} /></button>
        </div>
      </div>

      {/* Aviso do modo Teclado quando há capo ativo */}
      {viewMode === "keyboard" && capo > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(79,157,222,.1)", border: "1px solid #4f9dde44", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 12.5, color: "#9fc7e8" }}>
          <Music size={14} style={{ flexShrink: 0 }} />
          Capo {capo}ª ignorado — exibindo as notas reais em <strong style={{ color: "#fff" }}>{soundingKey}</strong>, como soa de fato.
        </div>
      )}

      {/* Seções — estilo ChartBuilder: sem caixas, fluindo em sequência */}
      {(!song.sections || song.sections.length === 0) && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:"#4d7a64", border:"1px dashed #1d4435", borderRadius:14, marginTop:8 }}>
          <Music size={36} style={{ opacity:0.35, marginBottom:12 }} />
          <p style={{ margin:"0 0 14px", fontSize:15, color:"#6fae8a" }}>Nenhuma seção cadastrada ainda.</p>
          {canEdit && <button onClick={onEdit} style={primaryBtn()}><Edit3 size={15}/> Adicionar cifra</button>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {(song.sections || []).map((sec, i) => {
          const color = SECTION_COLORS[sec.type] || "#3fae6b";
          const secKey = sec._id || `${sec.type}-${sec.label||""}-${i}`;
          return (
            <div key={secKey} ref={el => refsRef.current[i] = el} data-sec-idx={i} style={{ marginBottom: 28 }}>
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
                {/* linha 2: instrução à direita, menor, levemente apagada, quebra por vírgula */}
                {sec.note && <SectionNote text={sec.note} />}
              </div>
              {/* Conteúdo da seção — direto no fundo, sem caixa */}
              <div style={{ paddingLeft: 8, fontSize: `${fontScale * 15.5}px` }}>
                <RenderBlock
                  content={sec.content}
                  semitones={(viewMode === "bass" || viewMode === "keyboard") ? (semitones + capoSuggested) : shapeShift}
                  useFlats={(viewMode === "bass" || viewMode === "keyboard") ? useFlats : shapeUseFlats}
                  mode={viewMode === "keyboard" ? "chords" : viewMode}
                  interactive={viewMode !== "lyrics"}
                />
              </div>
            </div>
          );
        })}
      </div>

      {song.songNotes && (
        <div style={{ marginTop: 28, padding: "12px 16px", background: "#111", border: "1px solid #1d4435", borderRadius: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#5d917a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Observações</div>
          <div style={{ fontSize: 13.5, color: "#9fdabb", lineHeight: 1.6 }}>{song.songNotes}</div>
        </div>
      )}

      {song.composers && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#5d917a", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 3 }}>Compositores</div>
          <div style={{ fontSize: 13, color: "#9fdabb" }}>{song.composers}</div>
        </div>
      )}

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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 30, background: "#111", border: "1px solid #15392b", borderRadius: 12, padding: "10px 14px" }}>
          <button onClick={() => prevSong && onNavigateSong(prevSong)} disabled={!prevSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: prevSong ? 1 : 0.35, pointerEvents: prevSong ? "auto" : "none" }}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, color: "#6fae8a", fontWeight: 600 }}>
            {currentSetlist.name} · {currentIdx + 1} / {setlistSongs.length}
          </div>
          <button onClick={() => nextSong && onNavigateSong(nextSong)} disabled={!nextSong}
            style={{ ...ghostBtn(), padding: "7px 14px", opacity: nextSong ? 1 : 0.35, pointerEvents: nextSong ? "auto" : "none" }}>
            Próxima <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navegação entre hinos — fim da página */}
      {isHymnNav && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 30, background: "#111", border: "1px solid #d4a01733", borderRadius: 12, padding: "10px 14px" }}>
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
      <AutoScrollControl />
      {/* Indicador de seção atual — aparece só quando há mais de 1 seção */}
      {(song.sections||[]).length > 1 && (() => {
        const sec = (song.sections||[])[currentSec];
        if (!sec) return null;
        const color = SECTION_COLORS[sec.type] || "#3fae6b";
        const label = `${sec.type}${sec.label ? " " + sec.label : ""}`;
        return (
          <div style={{ position: "fixed", left: 14, bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)", zIndex: 119, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.85)", border: `1px solid ${color}44`, borderRadius: 16, padding: "5px 10px 5px 7px", boxShadow: "0 2px 10px rgba(0,0,0,.3)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
            <span style={{ fontSize: 10, color: "#5d917a" }}>{currentSec + 1}/{(song.sections||[]).length}</span>
          </div>
        );
      })()}
    </div>
    </ChordPopupContext.Provider>
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
        <div style={{ position: "absolute", top: "-6px", left: 0, zIndex: 10, display: "flex", gap: 6, background: "#111", border: "1px solid #2f7d57", borderRadius: 8, padding: 6, boxShadow: "0 8px 20px rgba(0,0,0,.4)" }}>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditingPos(null); setDraft(""); } }}
            placeholder="acorde (ex: D/F#)"
            style={{ width: 110, padding: "6px 8px", borderRadius: 6, border: "1px solid #1d4435", background: "#000", color: "#fff", fontSize: 13, fontFamily: "'Space Mono',monospace", outline: "none" }} />
          <button onClick={commit} style={{ ...primaryBtn(), padding: "6px 10px", fontSize: 12 }}>OK</button>
          <button onClick={() => { setEditingPos(null); setDraft(""); }} style={{ ...ghostBtn(), padding: "6px 8px" }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}


// Teclado rápido de acordes para celular — inserção de 1 toque no VisualChordEditor
const QUICK_CHORDS = [
  ["C","Cm","C7","Cmaj7","Cm7"],
  ["D","Dm","D7","Dsus2","Dsus4"],
  ["E","Em","E7","Esus4"],
  ["F","Fm","F7","Fmaj7"],
  ["G","Gm","G7","Gsus4"],
  ["A","Am","A7","Amaj7","Am7"],
  ["B","Bm","B7","Bsus4"],
  ["C#","C#m","Db","Eb","Bb"],
  ["F#","F#m","Ab","Abm"],
];

function ChordKeyboard({ onInsert }) {
  const [octave, setOctave] = React.useState(0); // página da root atual
  const roots = ["C","D","E","F","G","A","B","C#","Db","D#","Eb","F#","Gb","G#","Ab","A#","Bb"];
  const [selRoot, setSelRoot] = React.useState(null);
  const qualities = ["","m","7","maj7","m7","sus2","sus4","dim","aug","add9","6","m6","9","11","13"];
  const qualityLabels = ["M","m","7","Δ7","m7","sus2","sus4","°","aug","add9","6","m6","9","11","13"];

  if (selRoot) {
    return (
      <div style={{background:"#000",borderTop:"1px solid #1d4435",padding:"10px 10px 6px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#9fdabb"}}>{selRoot} +</span>
          <button onClick={()=>setSelRoot(null)} style={{background:"transparent",border:"none",color:"#6fae8a",fontSize:12,cursor:"pointer",padding:"2px 8px"}}>← voltar</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {qualities.map((q,i)=>(
            <button key={q} onClick={()=>{onInsert("["+selRoot+q+"]");setSelRoot(null);}}
              style={{padding:"7px 11px",borderRadius:8,border:"1px solid #1d4435",background:"#111",color:"#eef5f0",fontFamily:"'Space Mono',monospace",fontSize:13,cursor:"pointer",fontWeight:600}}>
              {selRoot}<span style={{color:"#3fae6b"}}>{qualityLabels[i]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{background:"#000",borderTop:"1px solid #1d4435",padding:"10px 10px 6px"}}>
      <div style={{fontSize:10.5,color:"#5d917a",textTransform:"uppercase",letterSpacing:.5,fontWeight:700,marginBottom:7}}>Toque para inserir acorde</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {roots.map(r=>(
          <button key={r} onClick={()=>setSelRoot(r)}
            style={{padding:"8px 12px",borderRadius:8,border:"1px solid #1d4435",background:"#111",color:"#eef5f0",fontFamily:"'Space Mono',monospace",fontSize:14,cursor:"pointer",fontWeight:700,minWidth:38,textAlign:"center"}}>
            {r}
          </button>
        ))}
      </div>
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
      <div style={{ background: "#000", border: "1px solid #1d4435", borderRadius: 10, padding: 12 }}>
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
    <div style={{ background: "#111", border: "1px solid #1d4435", borderRadius: 10, padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "#9fc7b2" }}>Clique numa <strong style={{ color: "#fff" }}>sílaba</strong> para pôr o acorde acima dela. Clique num acorde para editar/remover.</span>
        <button onClick={() => { setDraftText(lines.map(l => parseLineToModel(l).text).join("\n")); setLyricsMode(true); }} style={{ ...ghostBtn(), padding: "5px 10px", fontSize: 12 }}>
          <Edit3 size={13} /> Editar letra
        </button>
      </div>
      {lines.map((line, idx) => (
        <VisualLine key={idx} line={line} lineIndex={idx} onChange={nl => updateLine(idx, nl)} />
      ))}
      <ChordKeyboard onInsert={(chord) => {
        // insere o acorde na última linha, ou cria uma nova linha de acordes
        const arr = [...lines];
        const last = arr.length - 1;
        arr[last] = (arr[last] || "") + chord;
        onChange(arr.join("\n"));
      }} />
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
  const [showStats, setShowStats] = useState(false);
  const [setlistSearch, setSetlistSearch] = useState("");
  const { confirm, modal: confirmModal } = useConfirm();

  // Estatísticas: músicas mais usadas em repertórios
  const songStats = useMemo(() => {
    const counts = {};
    setlists.forEach(sl => { (sl.songIds || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; }); });
    return Object.entries(counts)
      .map(([id, count]) => ({ s: songs.find(x => x.id === id), count }))
      .filter(x => x.s)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [setlists, songs]);

  // Ao voltar de uma música aberta a partir de um repertório, reabre esse repertório
  useEffect(() => {
    if (reopenSetlistId && !opened) {
      const sl = setlists.find(s => s.id === reopenSetlistId);
      if (sl) setOpened(sl);
    }
  }, [reopenSetlistId]);

  // Limpa busca ao fechar/trocar repertório
  useEffect(() => { if (!opened) setSetlistSearch(""); }, [opened]);

  if (showStats) return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"22px 22px 90px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
        <button onClick={()=>setShowStats(false)} style={ghostBtn()}><ArrowLeft size={18}/> Repertórios</button>
        <h2 style={{ margin:0, fontWeight:700, fontSize:20, color:"#fff" }}>Músicas mais usadas</h2>
      </div>
      {songStats.length === 0
        ? <p style={{ color:"#6fae8a" }}>Crie repertórios para ver estatísticas de uso.</p>
        : <div style={{ display:"grid", gap:8 }}>
            {songStats.map(({ s, count }, i) => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, background:"#111", border:"1px solid #15392b", borderRadius:11, padding:"10px 14px" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color: i<3?"#0d3d28":"#3fae6b", background: i<3?"linear-gradient(135deg,#d4a017,#a87813)":"rgba(63,174,107,.15)" }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, color:"#fff", fontSize:14.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.title}</div>
                  <div style={{ color:"#6fae8a", fontSize:12 }}>{s.artist||"—"} · {s.key||"—"}{s.capoSuggested>0?" · Capo "+s.capoSuggested+"ª":""}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontWeight:700, color:"#3fae6b", fontSize:16 }}>{count}</div>
                  <div style={{ fontSize:10, color:"#5d917a" }}>uso{count!==1?"s":""}</div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );

  // ----- abrindo um repertório (lista de músicas em ordem) -----
  if (opened) {
    const songsInOrder = (opened.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
    const filteredSetlist = setlistSearch.trim()
      ? songsInOrder.filter(s => s.title.toLowerCase().includes(setlistSearch.toLowerCase()) || (s.artist||"").toLowerCase().includes(setlistSearch.toLowerCase()))
      : songsInOrder;
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 90px" }}>
        {confirmModal}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => { setOpened(null); onClearReopen?.(); }} style={ghostBtn()}><ArrowLeft size={18} /> Repertórios</button>
          {canEdit && <button onClick={() => { setEditing(opened); setOpened(null); }} style={ghostBtn()}><Edit3 size={16} /> Editar</button>}
        </div>
        <div style={{ background: "linear-gradient(135deg,#1a1a1a,#111)", border: "1px solid #1d6b46", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, padding: "4px 10px", borderRadius: 7, textTransform: "uppercase", marginBottom: 8,
            background: groupColorSoft(opened.group), color: groupColor(opened.group), border: `1px solid ${groupColor(opened.group)}44` }}>
            {opened.group || "Todos os grupos"}
          </div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 24, color: "#fff" }}>{opened.name}</h1>
          {opened.date && <p style={{ margin: "4px 0 0", color: "#9fdabb", fontSize: 14 }}>{formatDate(opened.date)}</p>}
          {opened.notes && <p style={{ margin: "8px 0 0", color: "#6fae8a", fontSize: 13, fontStyle: "italic", lineHeight: 1.5, borderTop: "1px solid #1d6b4644", paddingTop: 8 }}>📝 {opened.notes}</p>}
        </div>
        {songsInOrder.length > 4 && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#5d917a" }} />
            <input value={setlistSearch} onChange={e => setSetlistSearch(e.target.value)}
              placeholder="Buscar neste repertório…"
              style={{ ...inputStyle({ paddingLeft: 40 }), background: "#0d0d0d" }} />
          </div>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {filteredSetlist.length === 0 ? (
            <p style={{ color: "#6fae8a" }}>{setlistSearch ? "Nenhuma música encontrada." : "Nenhuma música neste repertório ainda."}</p>
          ) : filteredSetlist.map((s, i) => (
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

      {/* Stats de uso + Novo repertório */}
      <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"center" }}>
        {setlists.length > 0 && (
          <button onClick={() => setShowStats(true)} style={{ ...ghostBtn(), padding:"10px 14px" }} title="Músicas mais tocadas">
            <Hash size={15}/> Mais tocadas
          </button>
        )}
        {canEdit && (
          <button onClick={() => setEditing({ name: "", date: "", songIds: [] })} style={{ ...primaryBtn(), flex:1, justifyContent:"center" }}>
            <Plus size={18} /> Novo repertório
          </button>
        )}
      </div>
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

function SetlistEditor({ setlist, songs, worshipGroups: wg, onCancel, onSave, onDelete }) {
  const GROUPS = wg && wg.length ? wg : WORSHIP_GROUPS;
  const toast = useToast();
  const [name, setName] = useState(setlist.name || "");
  const [date, setDate] = useState(setlist.date || "");
  const [group, setGroup] = useState(setlist.group || "");
  const [notes, setNotes] = useState(setlist.notes || "");
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
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const onDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const a = [...songIds];
    const [removed] = a.splice(dragIdx, 1);
    a.splice(i, 0, removed);
    setSongIds(a);
    setDragIdx(null); setOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null); };
  const remove = id => setSongIds(songIds.filter(x => x !== id));
  const add = id => { setSongIds([...songIds, id]); };

  const save = () => {
    if (!name.trim()) { toast("Dê um nome ao repertório (ex: Culto de Domingo).", "error"); return; }
    onSave({ ...setlist, name: name.trim(), date, group, notes: notes.trim(), songIds });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: "#fff" }}>{setlist.id ? "Editar repertório" : "Novo repertório"}</h2>
        <button onClick={save} style={primaryBtn()}><Save size={16} /> Salvar</button>
      </div>

      <div style={{ background: "#111", border: "1px solid #15392b", borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <Field label="Nome (ex: Culto de Domingo, Ensaio)"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle()} placeholder="Culto de Domingo" /></Field>
        <Field label="Grupo de louvor">
          <select value={group} onChange={e => setGroup(e.target.value)} style={inputStyle()}>
            <option value="">Todos os grupos (visível a todos)</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} /></Field>
        <Field label="Observações (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Orar antes do 3º louvor · Tom do pastor é Lá · Ensaio às 18h"
            rows={2} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5 }} />
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "#cfe6d9" }}>Músicas ({inList.length})</h3>
        <button onClick={() => { setPicker(p => !p); setPickerSearch(""); }} style={ghostBtn()}>
          {picker ? <><X size={16} /> Fechar</> : <><Plus size={16} /> Adicionar música</>}
        </button>
      </div>

      {picker && (
        <div style={{ background: "#111", border: "1px solid #2f7d57", borderRadius: 12, padding: 12, marginBottom: 14 }}>
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
        {inList.length === 0 && (
          <div style={{ padding:"20px", textAlign:"center", color:"#4d7a64", border:"1px dashed #1d4435", borderRadius:10 }}>
            Nenhuma música adicionada ainda. Use o botão acima.
          </div>
        )}
        {inList.map((s, i) => (
          <div key={s.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={e => onDragOver(e, i)}
            onDrop={e => onDrop(e, i)}
            onDragEnd={onDragEnd}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: dragIdx === i ? "#0d0d0d" : overIdx === i ? "#1a1a1a" : "#111",
              border: overIdx === i ? "1px solid #2f7d57" : "1px solid #15392b",
              borderRadius: 11, padding: "10px 12px",
              opacity: dragIdx === i ? 0.5 : 1,
              transition: "all .15s", cursor: "grab"
            }}>
            <GripVertical size={16} style={{ color: "#3d5a4a", flexShrink: 0, cursor: "grab" }} />
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(63,174,107,.15)", color: "#3fae6b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 15 }}>{s.title}</div>
              <div style={{ color: "#6fae8a", fontSize: 12.5 }}>{s.artist || "—"} · Tom {s.key || "—"}</div>
            </div>
            <button onClick={() => remove(s.id)} style={{ ...iconBtn(), color: "#e8554d" }}><X size={15} /></button>
          </div>
        ))}
        {inList.length > 1 && (
          <p style={{ fontSize:11, color:"#3d5a4a", textAlign:"center", margin:0 }}>Arraste para reordenar</p>
        )}
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
    textAlign: "left", padding: "7px 10px", background: "#0d0d0d",
    color: "#6fae8a", fontWeight: 600, fontSize: "clamp(10px,2.6vw,11.5px)",
    borderBottom: "1px solid #1d4435",
  },
  td: { padding: "7px 10px", borderBottom: "1px solid #132e22" },
  highlight: {
    background: "#0d0d0d", border: "1px solid #1d4435", borderRadius: 10,
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
    background: "#0d0d0d", border: "1px solid #1d4435", borderRadius: 10,
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
  const containerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(300);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w) setContainerW(w);
    });
    obs.observe(el);
    setContainerW(el.offsetWidth || 300);
    return () => obs.disconnect();
  }, []);
  // Calcula tamanho das teclas com base no container (7 teclas brancas + gaps)
  const maxW = size==="sm" ? Math.min(22, (containerW-8)/7) :
               size==="lg" ? Math.min(40, (containerW-8)/7) :
               Math.min(34, (containerW-8)/7);
  const W  = Math.max(18, Math.floor(maxW));
  const H  = Math.round(W * 2.9);
  const BW = Math.round(W * 0.62);
  const BH = Math.round(H * 0.60);
  const WHITES = [0,2,4,5,7,9,11];
  const BLACKS = [{s:1,p:1},{s:3,p:2},{s:6,p:4},{s:8,p:5},{s:10,p:6}];
  const litAbs = new Set(highlight.map(rel => ((root+rel)%12+12)%12));
  return (
    <div ref={containerRef} style={{width:"100%",overflow:"hidden"}}>
    <div style={{position:"relative",display:"inline-flex",height:H+4,userSelect:"none",flexShrink:0}}>
      {WHITES.map((abs,i) => {
        const lit = litAbs.has(abs);
        const rel = ((abs-root)%12+12)%12;
        return (
          <div key={i} onClick={()=>{ tmPlayNote(abs); onClick&&onClick(rel,abs); }} style={{
            width:W, height:H,
            background: lit ? "#a89fef" : "#0d2a1d",
            border:"1px solid #1d4435", borderRadius:"0 0 5px 5px",
            display:"inline-flex", alignItems:"flex-end", justifyContent:"center",
            paddingBottom:3, position:"relative", marginRight:1,
            cursor:onClick?"pointer":"default", transition:"background .1s"
          }}>
            <span style={{fontSize:7,color:lit?"#1a1060":"#6fae8a",fontWeight:700}}>{tmPT(abs)}</span>
          </div>
        );
      })}
      {BLACKS.map(({s:abs,p}) => {
        const lit = litAbs.has(abs);
        const rel = ((abs-root)%12+12)%12;
        return (
          <div key={abs} onClick={()=>{ tmPlayNote(abs); onClick&&onClick(rel,abs); }} style={{
            width:BW, height:BH,
            background: lit ? "#7F77DD" : "#d8d4f0",
            borderRadius:"0 0 4px 4px",
            position:"absolute", top:0, zIndex:2,
            left: p*(W+1)-BW/2,
            cursor:onClick?"pointer":"default", transition:"background .1s"
          }}/>
        );
      })}
    </div>
    </div>
  );
}

// ── Contexto de pontuação de exercícios ────────────────────────
const TmScoreContext = React.createContext(null);
function TmScoreProvider({ children }) {
  const [scores, setScores] = React.useState({}); // { modId: { correct, total } }
  const addScore = React.useCallback((modId, correct) => {
    setScores(prev => {
      const cur = prev[modId] || { correct: 0, total: 0 };
      return { ...prev, [modId]: { correct: cur.correct + (correct?1:0), total: cur.total + 1 } };
    });
  }, []);
  return <TmScoreContext.Provider value={{ scores, addScore }}>{children}</TmScoreContext.Provider>;
}
function useTmScore() { return React.useContext(TmScoreContext) || { scores: {}, addScore: ()=>{} }; }

// Toca uma nota via AudioContext quando o músico clica no piano
const tmAudioCtxRef = { current: null };
function tmPlayNote(semiAbsoluto) {
  try {
    if (!tmAudioCtxRef.current) tmAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = tmAudioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    // A4 = 440Hz = semitom 69 (MIDI). C4 = semitom 60.
    // Mapeamos nossos semitons 0-11 para a oitava central (C4=60).
    const midi = 60 + ((semiAbsoluto % 12) + 12) % 12;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.9);
  } catch(e) {}
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
      padding:"10px 12px",background:"#0d0d0d",borderRadius:12,marginBottom:14,
      overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
      <span style={{fontSize:11,fontWeight:700,color:"#6fae8a",
        textTransform:"uppercase",letterSpacing:".07em",marginRight:4,whiteSpace:"nowrap"}}>{label}:</span>
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
function TmExercicio({ title, onNew, children, feedback, modId }) {
  const { scores, addScore } = useTmScore();
  const score = modId ? (scores[modId] || { correct: 0, total: 0 }) : null;
  const feedbackRef = React.useRef(null);
  const hasFeedback = feedback && (feedback.props?.ok !== null && feedback.props?.ok !== undefined);
  // Auto-scroll to feedback when it appears
  React.useEffect(() => {
    if (hasFeedback && feedbackRef.current) {
      setTimeout(() => feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
  }, [hasFeedback]);
  return (
    <div style={{background:"#0d0d0d",border:"1px solid #2f4a38",borderRadius:14,
      padding:"16px 14px 18px",marginTop:18}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:12,flexWrap:"wrap",gap:8}}>
        <span style={{fontWeight:800,fontSize:14,color:"#fff"}}>Exercício — {title}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {score && score.total > 0 && (
            <span style={{fontSize:11,color: score.correct/score.total >= 0.7 ? "#3fae6b" : "#e0b341",fontWeight:700}}>
              {score.correct}/{score.total} ✓
            </span>
          )}
          <button onClick={onNew} style={{
            fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #1d4435",
            background:"transparent",color:"#6fae8a",cursor:"pointer",
            fontFamily:"'Montserrat',sans-serif"
          }}>↺ Novo</button>
        </div>
      </div>
      {children}
      <div ref={feedbackRef}>
        {feedback}
        {hasFeedback && (
          <button onClick={onNew} style={{
            display:"flex",alignItems:"center",gap:6,marginTop:10,width:"100%",
            justifyContent:"center",padding:"9px",borderRadius:9,
            border:"1px solid #2f7d57",background:"rgba(47,125,87,.1)",
            color:"#3fae6b",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",
            fontSize:13,fontWeight:700
          }}>↺ Próxima pergunta</button>
        )}
      </div>
    </div>
  );
}

// Estilos compartilhados
const tmS={
  h2:  {fontWeight:800,fontSize:"clamp(15px,4vw,18px)",color:"#fff",margin:"0 0 12px",lineHeight:1.2},
  h3:  {fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",color:"#9fdabb",margin:"16px 0 8px",letterSpacing:.3},
  p:   {fontSize:"clamp(12px,3.3vw,13.5px)",color:"#b0ccbc",lineHeight:1.7,margin:"0 0 10px"},
  note:{fontSize:"clamp(11px,2.8vw,12px)",color:"#6fae8a",fontStyle:"italic",lineHeight:1.5},
  card:{background:"#0d0d0d",border:"1px solid #1d4435",borderRadius:11,padding:"11px 13px",marginBottom:9},
  hl:  {background:"#0d0d0d",border:"1px solid #1d4435",borderRadius:10,padding:"10px 12px",marginBottom:12,
        fontSize:"clamp(12px,3.2vw,13px)",color:"#9fdabb",lineHeight:1.65},
  mono:{fontFamily:"'Space Mono',monospace"},
  pre: {fontFamily:"'Space Mono',monospace",background:"#061410",border:"1px solid #15392b",borderRadius:10,
        padding:"14px 16px",fontSize:"clamp(12px,3.4vw,13.5px)",color:"#7fd8a4",lineHeight:1.85,
        overflowX:"auto",marginBottom:12,whiteSpace:"pre",WebkitOverflowScrolling:"touch",letterSpacing:0},
  table:{width:"100%",borderCollapse:"collapse",fontSize:"clamp(11px,3vw,13px)",color:"#b0ccbc"},
  th:  {textAlign:"left",padding:"7px 10px",background:"#0d0d0d",color:"#6fae8a",
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
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:"clamp(12px,3.4vw,13.5px)",color:"#7fd8a4",lineHeight:1.9,whiteSpace:"pre",letterSpacing:0}}>{children}</div>
    </div>
  );
}

const TmEx = TmExercicio;

function TmConceito({ icon, titulo, children, nivel }) {
  const nivelCor = nivel==="avancado"?"#e8554d":nivel==="intermediario"?"#e0b341":nivel==="basico"?"#4f9dde":"#1d4435";
  return <div style={{background:"#000",border:"1px solid #1d4435",borderRadius:13,padding:"14px 16px",marginBottom:14,borderLeft:`3px solid ${nivelCor}`}}>
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
    <span style={{fontSize:"clamp(12px,3.3vw,13.5px)",color:"#e0b341",lineHeight:1.65}}>{children}</span>
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
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
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
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",gap:2,overflowX:"auto",marginBottom:8,padding:"4px 0"}}>
              {[["Dó",""],["Dó#","Réb"],["Ré",""],["Ré#","Mib"],["Mi",""],["Fá",""],["Fá#","Solb"],["Sol",""],["Sol#","Láb"],["Lá",""],["Lá#","Sib"],["Si",""]].map((n,i)=>{
                const isPreta=[1,3,6,8,10].includes(i);
                return(
                  <div key={i} style={{
                    minWidth:isPreta?30:38,flex:1,padding:"10px 3px 8px",borderRadius:8,
                    background:isPreta?"#d8d4f0":"#1a1a1a",
                    border:`1px solid ${isPreta?"#9b6ef0":"#2f7d57"}`,
                    textAlign:"center",
                  }}>
                    <div style={{fontSize:9,fontWeight:700,color:isPreta?"#2a1060":"#3fae6b",lineHeight:1.3}}>{n[0]}</div>
                    {n[1]&&<div style={{fontSize:7,color:"#9b6ef0",lineHeight:1.2}}>{n[1]}</div>}
                    <div style={{fontSize:8,color:isPreta?"#7F77DD":"#1d7a4a",marginTop:3,fontWeight:600}}>{isPreta?"♯/♭":"nat."}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:11,marginTop:6}}>
              <span style={{color:"#3fae6b"}}>● 7 notas naturais (naturais: C D E F G A B)</span>
              <span style={{color:"#a89fef"}}>● 5 acidentais (C# D# F# G# A#)</span>
            </div>
          </div>
          <TmDica>Entre <strong>Mi→Fá</strong> e entre <strong>Si→Dó</strong> não existe nota entre elas — já são semitons naturais. Por isso a escala de Dó usa só teclas naturais.</TmDica>
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
              <tr key={n} onClick={()=>setSel(sel===n?null:n)} style={{cursor:"pointer",background:sel===n?"#0d0d0d":"transparent"}}>
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
          <TmTabela
            colunas={["Com #","= Igual a","Com ♭","Posição no teclado"]}
            linhas={[
              ["Dó#","=","Réb","Entre Dó e Ré"],
              ["Ré#","=","Mib","Entre Ré e Mi"],
              ["Fá#","=","Solb","Entre Fá e Sol"],
              ["Sol#","=","Láb","Entre Sol e Lá"],
              ["Lá#","=","Sib","Entre Lá e Si"],
            ]}
          />
          <TmTabela
            colunas={["Tonalidade","Usa","Exemplos de acordes","Por quê"]}
            linhas={[
              ["Mi, Lá, Ré, Sol, Si, F#","Sustenidos (#)","C#m, F#m, G#m","Escala tem sustenidos"],
              ["Fá, Sib, Mib, Láb, Réb","Bemóis (♭)","Fm, Gm, Cm, Ab","Escala tem bemóis"],
            ]}
          />
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
          <div style={{fontWeight:700,color:"#9fdabb",fontSize:13,marginBottom:10}}>Nomes enarmônicos — Complete</div>
          <p style={{...tmS.p,marginBottom:12}}>Cada nota preta tem dois nomes. Conecte:</p>
          {[
            {a:"C#",b:"Réb"},{a:"D#",b:"Mib"},{a:"F#",b:"Solb"},{a:"G#",b:"Láb"},{a:"A#",b:"Sib"},
            {a:"B#",b:"Dó"},{a:"E#",b:"Fá"},
          ].map((par,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{...tmS.mono,fontSize:13,color:"#3fae6b",fontWeight:700,minWidth:32}}>{par.a}</span>
              <span style={{color:"#5d917a",fontSize:12}}>= enarmônico de =</span>
              <span style={{...tmS.mono,fontSize:13,color:"#a89fef",fontWeight:700}}>{par.b}</span>
              {i>=5&&<span style={{fontSize:10,color:"#e0b341",marginLeft:4}}>★ raro</span>}
            </div>
          ))}
          <p style={{...tmS.note,marginTop:8}}>B# e E# aparecem em partituras clássicas e tonalidades com muitos sustenidos (C# maior tem B# no lugar de C).</p>
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
  const audioCtxRef = React.useRef(null);
  // Click sonoro usando AudioContext — mesmo padrão do metrônomo principal
  const playClick = React.useCallback((accent, time=null) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const t = time != null ? time : ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1500 : 900;
      gain.gain.setValueAtTime(accent ? 0.4 : 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.07);
    } catch(e) {}
  }, []);
  const [qComp,setQComp]=React.useState(null);
  const [fb,setFb]=React.useState(null);
  const [optSt,setOptSt]=React.useState({});
  const [secao,setSecao]=React.useState(0);
  const [vfAnswers,setVfAnswers]=React.useState({});
  const [vfFb,setVfFb]=React.useState({});
  const COMPS=["4/4","3/4","2/4","2/2","4/2","6/8","9/8","12/8","5/4","7/8"];

  const schedulerRef2 = React.useRef(null);
  const nextNoteRef2  = React.useRef(0);
  const beatRef2      = React.useRef(0);
  React.useEffect(()=>{
    if(!playing){
      clearTimeout(schedulerRef2.current);
      setBeat(0); beatRef2.current=0;
      return;
    }
    try {
      if(!audioCtxRef.current) audioCtxRef.current=new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtxRef.current.state==="suspended") audioCtxRef.current.resume();
    } catch(e){ return; }
    const ctx=audioCtxRef.current;
    const beats=parseInt(comp.split("/")[0]);
    const interval=60/(bpm||80);
    const lookahead=0.1;
    beatRef2.current=0;
    nextNoteRef2.current=ctx.currentTime;
    const schedule=()=>{
      while(nextNoteRef2.current < ctx.currentTime+lookahead){
        const b=beatRef2.current;
        playClick(b===0, nextNoteRef2.current);
        const cap=b;
        const delay=Math.max(0,(nextNoteRef2.current-ctx.currentTime)*1000);
        setTimeout(()=>setBeat(cap),delay);
        beatRef2.current=(b+1)%beats;
        nextNoteRef2.current+=interval;
      }
      schedulerRef2.current=setTimeout(schedule,0.05*1000);
    };
    schedule();
    return()=>{clearTimeout(schedulerRef2.current);setBeat(0);};
  },[playing,bpm,comp,playClick]);

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
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #e0b341",background:"rgba(224,179,65,.06)"}}>
        <span style={{color:"#e0b341",fontWeight:700}}>⏱ Atenção:</span> <em>"O ritmo é o esqueleto da música. Sem ele, os acordes mais bonitos ficam sem sentido. Esta aula parece simples — mas muitos músicos pulam e ficam com lacunas sérias."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Pulso vs Ritmo — a diferença fundamental">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Pulso</strong> é a batida constante e regular, como o coração. Quando você bate o pé ouvindo uma música, está marcando o pulso.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Ritmo</strong> é como os sons se organizam <em>sobre</em> esse pulso — pode ser simples ou complexo, regular ou sincopado.</p>
          <TmTabela
            colunas={["","O que é","Analogia","No violão"]}
            linhas={[
              ["Pulso","Batida constante e regular","Relógio — sempre igual","Riscada na palhetada"],
              ["Ritmo","Padrão de sons sobre o pulso","Palavras sobre o relógio","↓↑↓↓↑ (varia)"],
              ["BPM","Velocidade do pulso","Velocidade do relógio","Número no metrônomo"],
              ["Andamento","Nome do BPM em italiano","Grave, Lento, Allegro...","Instrução da partitura"],
            ]}
          />
          <TmDiagrama titulo="Como visualizar pulso e ritmo juntos">{`Pulso:  ♩    ♩    ♩    ♩    ♩    ♩    ♩    ♩
        1    2    3    4    1    2    3    4

Ritmo:  ♩  ♪♪  ♩   ♩♪   ♩  ♪♪♩  ♩    —
        (o ritmo é livre, o pulso é fixo)`}</TmDiagrama>
        </TmConceito>
        <TmTabela
          colunas={["Andamento","BPM","Caráter","Exemplo no louvor"]}
          linhas={[
            ["Grave","40–60","Contemplação profunda","Adoração íntima, oração"],
            ["Lento","60–80","Solene, hino","Hinos congregacionais"],
            ["Moderato","80–100","Equilibrado","Louvor suave"],
            ["Alegretto","100–120","Animado","Louvores de celebração"],
            ["Allegro","120–160","Festivo, vibrante","Louvores de jubileu"],
          ]}
        />
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
          <TmTabela
            colunas={["Símbolo","Nome","Pausa","Duração","No louvor"]}
            linhas={[
              ["○","Semibreve","𝄻","4 tempos","Notas longas, finalizar frase"],
              ["𝅗𝅥","Mínima","𝄼","2 tempos","Hinos solenes"],
              ["♩","Semínima","𝄽","1 tempo","Referência — 1 BPM"],
              ["♪","Colcheia","𝄾","½ tempo","Palhetadas, melodias rápidas"],
              ["♬","Semicolcheia","𝄿","¼ tempo","Ornamentos, grooves"],
            ]}
          />
          <TmConceito titulo="Ponto de aumento ( · )">
            <p style={tmS.p}>O <strong style={{color:"#fff"}}>ponto após uma figura</strong> aumenta sua duração em metade. É o que cria o balanço de muitos louvores:</p>
            <TmTabela
              colunas={["Figura pontuada","Cálculo","Resultado","Onde aparece"]}
              linhas={[
                ["Mínima pontuada 𝅗𝅥·","2 + 1","3 tempos","Compasso 3/4"],
                ["Semínima pontuada ♩·","1 + ½","1½ tempo","Compasso 6/8"],
                ["Colcheia pontuada ♪·","½ + ¼","¾ tempo","Ritmos de swing"],
              ]}
            />
          </TmConceito>
          <TmDica>Macete visual: semibreve = oval aberta sem haste · mínima = oval aberta + haste · semínima = oval <strong>fechada</strong> + haste · colcheia = semínima + bandeirinha. Cada bandeirinha divide o valor pela metade.</TmDica>
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Fórmulas de compasso — como organizar os tempos">
          <p style={tmS.p}>O compasso agrupa os tempos em unidades regulares, com acento periódico no primeiro tempo (o "forte").</p>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
            <div style={{flex:1,minWidth:140,background:"#061410",border:"1px solid #15392b",borderRadius:12,padding:"16px",textAlign:"center"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:8}}>
                <div>
                  <div style={{fontSize:42,fontWeight:900,color:"#3fae6b",lineHeight:1}}>3</div>
                  <div style={{width:"100%",height:2,background:"#3fae6b",margin:"4px 0"}}/>
                  <div style={{fontSize:42,fontWeight:900,color:"#a89fef",lineHeight:1}}>4</div>
                </div>
              </div>
              <div style={{fontSize:11,color:"#3fae6b",marginBottom:2}}>↑ 3 tempos por compasso</div>
              <div style={{fontSize:11,color:"#a89fef"}}>↑ Semínima (♩) = 1 tempo</div>
            </div>
            <div style={{flex:2,minWidth:200}}>
              <TmTabela
                colunas={["Denominador","Figura","Símbolo"]}
                linhas={[
                  ["1","Semibreve","○"],
                  ["2","Mínima","𝅗𝅥"],
                  ["4","Semínima","♩"],
                  ["8","Colcheia","♪"],
                  ["16","Semicolcheia","♬"],
                ]}
              />
            </div>
          </div>
          <TmTabela
            colunas={["","tempos","acento","caráter","no louvor"]}
            linhas={[
              ["4/4","4","F-f-m-f","Universal, neutro","Maioria dos louvores"],
              ["3/4","3","F-f-f","Valsa, balanço","\"Quão Grande És Tu\""],
              ["2/4","2","F-f","Marcha, passo","Hinos litúrgicos"],
              ["2/2","2","F-f","Marcha rápida","Hinos ligeiros"],
              ["4/2","4","F-f-m-f","4 mínimas — alla breve largo","Coral sacro, música clássica"],
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
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"#6fae8a"}}>BPM:</span>
              <input type="range" min={40} max={200} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{width:70,accentColor:"#3fae6b"}}/>
              <input type="number" min={40} max={200} value={bpm}
                onChange={e=>{ const v=Math.max(40,Math.min(200,+e.target.value||80)); setBpm(v); }}
                style={{width:52,padding:"3px 6px",borderRadius:7,border:"1px solid #1d4435",background:"#000",color:"#9fdabb",fontSize:13,fontFamily:"'Montserrat',sans-serif",fontWeight:700,textAlign:"center"}}/>
            </div>
          </div>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:14}}>
          <div style={{display:"flex",gap:8,justifyContent:"center",minWidth:"fit-content",padding:"4px 0"}}>
            {Array.from({length:beatsN},(_,i)=>{const sz=beatsN>6?36:42;return(<div key={i} style={{width:sz,height:sz,flexShrink:0,borderRadius:"50%",background:playing&&beat===i?(i===0?"#e8554d":"#7F77DD"):"#0d0d0d",border:`2px solid ${i===0?"#e8554d55":"#7F77DD44"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===0?(sz>38?18:14):Math.min(14,sz-20),fontWeight:700,color:playing&&beat===i?"#fff":"#5d917a",transition:"background .05s"}}>{i+1}</div>);})}
          </div>
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
              {Array.from({length:qBeats},(_,i)=>{const sz=qBeats>6?34:40;return(<div key={i} style={{width:sz,height:sz,flexShrink:0,borderRadius:"50%",background:i===0?"rgba(232,85,77,.2)":"rgba(127,119,221,.15)",border:`2px solid ${i===0?"#e8554d44":"#7F77DD33"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:i===0?"#e8554d":"#7F77DD"}}>{i===0?"F":"f"}</div>);})}
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
function Mod03_Intervalos({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [sel,setSel]=React.useState(null);
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
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
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é um intervalo — e por que existe?">
          <p style={tmS.p}>Um <strong style={{color:"#fff"}}>intervalo</strong> é a distância entre duas notas, medida em semitons. É o <strong style={{color:"#fff"}}>"tijolo" da harmonia</strong> — todo acorde, escala e melodia é construído combinando intervalos.</p>
          <TmTabela
            colunas={["Intervalo","Semitons","Acorde resultante","Caráter"]}
            linhas={[
              ["Dó → Mi (3ª maior)","4 semi","C maior (Dó Mi Sol)","Alegre, brilhante"],
              ["Dó → Mib (3ª menor)","3 semi","Cm menor (Dó Mib Sol)","Melancólico, expressivo"],
              ["Dó → Sol (5ª justa)","7 semi","Âncora de qualquer acorde","Estável, vazio"],
            ]}
          />
          <TmDica>1 semitom na terça muda o caráter do acorde completamente — de alegre para triste. Isso é o poder dos intervalos.</TmDica>
          <TmTabela
            colunas={["Tipo","Definição","Exemplo","Contexto"]}
            linhas={[
              ["Melódico","Notas em sequência (uma após a outra)","Dó → Mi em uma melodia","Solo, voz, melodia"],
              ["Harmônico","Notas simultâneas (ao mesmo tempo)","Dó + Mi no acorde","Acordes, acompanhamento"],
            ]}
          />
        </TmConceito>
        <TmConceito titulo="Classificação — Nome + Qualidade">
          <p style={tmS.p}>Todo intervalo tem duas partes: <strong style={{color:"#fff"}}>número</strong> (2ª, 3ª, 5ª...) e <strong style={{color:"#fff"}}>qualidade</strong> (maior, menor, justo, aumentado, diminuto).</p>
          <TmTabela
            colunas={["Qualidade","Símbolo","Aplica-se a","Descrição"]}
            linhas={[
              ["Perfeito","P","1ª, 4ª, 5ª, 8ª","Não têm versão maior/menor — só 'justo'"],
              ["Maior","M","2ª, 3ª, 6ª, 7ª","Versão com mais semitons"],
              ["Menor","m","2ª, 3ª, 6ª, 7ª","Versão com menos semitons (1 semi a menos)"],
              ["Aumentado","A","Qualquer","Justo ou maior + 1 semitom"],
              ["Diminuto","d","Qualquer","Justo ou menor − 1 semitom"],
            ]}
          />
          <TmDica>Macete: os intervalos <strong>perfeitos</strong> (1ª, 4ª, 5ª, 8ª) são os que existem na natureza acústica como harmônicos naturais. Os demais têm versão maior e menor.</TmDica>
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
            <tbody>{IVS.map(iv=><tr key={iv.q} onClick={()=>setSel(iv.s)} style={{cursor:"pointer",background:sel===iv.s?"#0d0d0d":"transparent"}}>
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
          <TmTabela
            colunas={["Intervalo original","Semitons","Inversão","Semitons","Soma"]}
            linhas={[
              ["3ª maior","4","6ª menor","8","4+8=12 ✓"],
              ["3ª menor","3","6ª maior","9","3+9=12 ✓"],
              ["5ª justa","7","4ª justa","5","7+5=12 ✓"],
              ["7ª menor","10","2ª maior","2","10+2=12 ✓"],
              ["2ª maior","2","7ª menor","10","2+10=12 ✓"],
            ]}
          />
          <TmDica>Fórmula: <strong>9 − número do intervalo = número da inversão</strong>. A qualidade inverte: maior→menor, menor→maior, perfeito→perfeito. E os semitons sempre somam 12.</TmDica>
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
          <TmTabela
            colunas={["Acorde","Notas","Intervalos internos","Caráter resultante"]}
            linhas={[
              ["G (Sol maior)","Sol Si Ré","Sol→Si: 3ª maior + Si→Ré: 3ª menor","Brilhante, estável"],
              ["Em (Mi menor)","Mi Sol Si","Mi→Sol: 3ª menor + Sol→Si: 3ª maior","Expressivo, melancólico"],
              ["G7 (Sol dom.)","Sol Si Ré Fá","Si→Fá: trítono (6 semi)","Máxima tensão → resolve em Dó"],
              ["Cmaj7 (Dó maj7)","Dó Mi Sol Si","Dó→Si: 7ª maior","Suave, sofisticado"],
            ]}
          />
          <TmConceito titulo="Por que G7 sempre quer resolver em C?">
            <p style={tmS.p}>O acorde G7 contém um <strong style={{color:"#e8554d"}}>trítono</strong> entre Si e Fá (6 semitons). Esse intervalo é a maior dissonância possível — e o ouvido exige resolução:</p>
            <TmTabela
              colunas={["Nota em G7","Quer ir para","Movimento","Intervalo"]}
              linhas={[
                ["Si (3ª de G7)","Dó (fundamental de C)","Sobe ½ tom","2ª menor"],
                ["Fá (7ª de G7)","Mi (3ª de C)","Desce ½ tom","2ª menor"],
              ]}
            />
            <TmDica>Toda vez que você ouve G7→C no louvor, está sentindo dois semitons se resolverem ao mesmo tempo. É a cadência mais poderosa da música ocidental.</TmDica>
          </TmConceito>
          <p style={{...tmS.note}}>No louvor, toda vez que você ouve G7 resolvendo em C, está sentindo o poder do trítono querendo resolver.</p>
        </TmAplicacao>
      </div>}

      {secao===4&&<div>
        <TmEx title="Nomear intervalo" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
          <p style={{...tmS.p,marginBottom:10}}>Que intervalo separa as notas destacadas?</p>
          <div style={{textAlign:"center",marginBottom:12,overflowX:"auto"}}>
            <TmPiano root={qRoot} highlight={[0,qSemi%12]} size="md"/>
            <div style={{fontSize:13,color:"#9fdabb",marginTop:6}}>
              <span style={{color:"#a89fef",fontWeight:700}}>{tmPTinKey(qRoot,qRoot)}</span>
              {" → "}
              <span style={{color:"#a89fef",fontWeight:700}}>{tmPTinKey(qRoot+qSemi,qRoot)}</span>
              <span style={{color:"#3d6b52",fontSize:11,marginLeft:8}}>Quantos semitons separam essas notas?</span>
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
function Mod04_Escalas({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [selSc,setSelSc]=React.useState("major");
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
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
  const secoes=["1. O que é","2. Tipos","3. Prática","4. Violão","5. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"Escalas são a paleta de cores do músico. Uma escala maior soa 'alegre', menor soa 'triste', blues soa 'expressivo'. Entender escalas é entender de onde vêm os acordes que você toca."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é uma escala — e por que existem tantos tipos?">
          <p style={tmS.p}>Uma <strong style={{color:"#fff"}}>escala</strong> é uma sequência de notas em ordem, com um padrão fixo de tons (T=2 semitons) e semitons (S=1 semitom). Cada padrão cria um caráter sonoro único.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Relação com acordes:</strong> os acordes do campo harmônico são construídos <em>a partir das notas da escala</em>. Quando você toca em Sol maior (G), todos os acordes naturais (G, Am, Bm, C, D, Em, F#dim) vêm das notas da escala de Sol maior. Escala → acordes → harmonia.</p>
          <div style={{background:"#061410",border:"1px solid #15392b",borderRadius:12,padding:"16px",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#5d917a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Escala de Dó Maior — a mais fácil de visualizar</div>
            <div style={{display:"flex",gap:0,flexWrap:"nowrap",overflowX:"auto",paddingBottom:8}}>
              {["Dó","Ré","Mi","Fá","Sol","Lá","Si","Dó"].map((n,i)=>(
                <div key={i} style={{flexShrink:0,textAlign:"center",minWidth:44}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:i===0||i===7?"#3fae6b":"#0d0d0d",border:"2px solid #1d4435",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px",fontWeight:700,fontSize:12,color:i===0||i===7?"#0d3d28":"#9fdabb"}}>{n}</div>
                  {i<7&&<div style={{fontSize:9,color:([2,6].includes(i))?"#e8554d":"#4f9dde",fontWeight:700,marginTop:2}}>{[2,6].includes(i)?"S":"T"}</div>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"#4f9dde"}}>● T = Tom = 2 semitons</span>
              <span style={{fontSize:11,color:"#e8554d"}}>● S = Semitom = 1 semitom</span>
            </div>
          </div>
          <TmDica>A fórmula <strong>T T S T T T S</strong> vale para <em>qualquer</em> tonalidade. Sol maior: Sol Lá Si Dó Ré Mi F# Sol — a mesma sequência de tons e semitons.</TmDica>
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
          <TmTabela
            colunas={["Tonalidade maior","Relativa menor","Notas em comum","Ponto de início"]}
            linhas={[
              ["Dó maior (C)","Lá menor (Am)","C D E F G A B","A = 6º grau de C"],
              ["Sol maior (G)","Mi menor (Em)","G A B C D E F#","E = 6º grau de G"],
              ["Ré maior (D)","Si menor (Bm)","D E F# G A B C#","B = 6º grau de D"],
              ["Fá maior (F)","Ré menor (Dm)","F G A Bb C D E","D = 6º grau de F"],
            ]}
          />
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Escalas mais usadas no louvor">
          <TmTabela
            colunas={["Escala","Notas (em Lá/A)","Mood","Uso no louvor"]}
            linhas={[
              ["Maior","A B C# D E F# G#","Alegre, festivo","Hinos, louvores de celebração"],
              ["Menor natural","A B C D E F G","Contemplativo","Adoração, músicas de lamento"],
              ["Menor harmônica","A B C D E F G#","Dramático, tenso","Cadências expressivas"],
              ["Pentatônica maior","A B C# E F#","Universal, luminoso","Improvisação sobre acordes maiores"],
              ["Pentatônica menor","A C D E G","Groove, expressivo","Solos de guitarra, improvisação"],
              ["Blues","A C D Eb E G","Gritty, gospel","Gospel soul, expressão emocional"],
            ]}
          />
        </TmConceito>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Regra de ouro:</strong> pentatônica menor de qualquer tonalidade funciona sobre <em>todos</em> os acordes do campo harmônico menor. Em Mi menor (Em), toque as 5 notas E G A B D e nenhuma soará errada.</p>
          <TmDica>A diferença entre a pentatônica menor e o blues é a adição da "nota azul" (♭5 = Sib em Mi menor). Essa nota cria aquela tensão característica do gospel e do blues.</TmDica>
        </TmAplicacao>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Escalas no violão — posições práticas">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Sol maior (G)</strong> — tonalidade mais comum no louvor. Posição aberta (sem capo):</p>
          <TmDiagrama titulo="Sol maior — posição aberta">{"Corda   0    1    2    3    4    5\n6ª(E):  Mi   —   F#  Sol   —   Lá\n5ª(A):  Lá   —   Si  Dó    —   Ré\n4ª(D):  Ré   —   Mi   —   F#  Sol\n3ª(G):  Sol  —   Lá   —   Si   —\n2ª(B):  Si  Dó    —   Ré   —   Mi\n1ª(e):  Mi   —   F#  Sol   —   Lá\n\nNotas: G A B C D E F# G"}</TmDiagrama>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Lá menor (Am)</strong> — adoração contemplativa:</p>
          <TmDiagrama titulo="Lá menor — posição aberta">{"Corda   0    1    2    3    4    5\n5ª(A):  Lá   —   Si  Dó    —   Ré\n4ª(D):  Ré   —   Mi  Fá    —   Sol\n3ª(G):  Sol  Lá   —   —   Si    —\n2ª(B):  Si  Dó    —   Ré   —   Mi\n1ª(e):  Mi  Fá    —  Sol   —   Lá\n\nNotas: A B C D E F G A"}</TmDiagrama>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>Exercício:</strong> toque Sol maior subindo e descendo a 60 BPM. Depois improvise sobre G–Em–C–D usando só essas notas — qualquer nota da escala funcionará!</p>
            <p style={tmS.note}>Pentatônica de Sol = G A B D E. Remove Dó e F#. Ainda mais fácil de improvisar: sem notas que criem tensão.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}

      {secao===4&&<div>
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
function Mod05_Acordes({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [selAc,setSelAc]=React.useState("maj");
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
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
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #4f9dde",background:"rgba(79,157,222,.06)"}}>
        <span style={{color:"#4f9dde",fontWeight:700}}>🎹 Conceito-chave:</span> <em>"Um acorde é o coração da harmonia. Tudo que você toca no violão é um acorde. Entender a estrutura interna de cada um transforma você de tocador de formas para músico consciente."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Anatomia de um acorde — por que soa assim?">
          <p style={tmS.p}>Um <strong style={{color:"#fff"}}>acorde</strong> é a combinação simultânea de 3+ notas. <strong style={{color:"#fff"}}>Tríades</strong> = 3 notas. <strong style={{color:"#fff"}}>Tétrades</strong> = 4 notas. A <strong style={{color:"#fff"}}>fórmula de intervalos</strong> é o que define o tipo.</p>
          <TmTabela
            colunas={["Tipo","Fórmula","Notas (em Dó)","Caráter","Símbolo"]}
            linhas={[
              ["Maior","1 – 3 – 5 (3ªM + 3ªm)","Dó Mi Sol","Alegre, estável","C"],
              ["Menor","1 – ♭3 – 5 (3ªm + 3ªM)","Dó Mib Sol","Expressivo, melancólico","Cm"],
              ["Diminuto","1 – ♭3 – ♭5 (3ªm + 3ªm)","Dó Mib Solb","Máxima tensão","Cdim"],
              ["Aumentado","1 – 3 – #5 (3ªM + 3ªM)","Dó Mi Sol#","Suspenso, misterioso","Caug"],
            ]}
          />
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            {[
              {tipo:"Maior",notas:"Dó Mi Sol",bg:"#3fae6b22",cor:"#3fae6b",desc:"Alegre"},
              {tipo:"Menor",notas:"Dó Mib Sol",bg:"#7F77DD22",cor:"#a89fef",desc:"Melancólico"},
              {tipo:"Diminuto",notas:"Dó Mib Solb",bg:"#e8554d22",cor:"#e8554d",desc:"Tenso"},
              {tipo:"Aumentado",notas:"Dó Mi Sol#",bg:"#e0b34122",cor:"#e0b341",desc:"Suspenso"},
            ].map(ac=>(
              <div key={ac.tipo} style={{flex:1,minWidth:120,background:ac.bg,border:`1px solid ${ac.cor}44`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontWeight:800,color:ac.cor,fontSize:13,marginBottom:2}}>{ac.tipo}</div>
                <div style={{fontSize:12,color:"#9fdabb",fontFamily:"'Space Mono',monospace"}}>{ac.notas}</div>
                <div style={{fontSize:10,color:"#6fae8a",marginTop:4,fontStyle:"italic"}}>{ac.desc}</div>
              </div>
            ))}
          </div>
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
            <span style={{fontWeight:800,fontSize:16,color:"#fff"}}>{tmENinKey(root,root)}{({maj:"",min:"m",dim:"dim",aug:"aug",sus2:"sus2",sus4:"sus4",dom7:"7",maj7:"maj7",min7:"m7",dim7:"dim7",m7b5:"m7♭5",add9:"add9"})[selAc]||""}</span>
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
          <TmTabela
            colunas={["Posição","Nota no baixo","Notação","Exemplo em Dó","Uso"]}
            linhas={[
              ["Fundamental","Raiz","C","Dó no baixo","Normal, estável"],
              ["1ª inversão","Terça","C/E","Mi no baixo","Suave, movimento"],
              ["2ª inversão","Quinta","C/G","Sol no baixo","Cadencial, passagem"],
            ]}
          />
          <TmConceito titulo="Linha de baixo descendo — muito usada no louvor">
            <p style={tmS.p}>Inverter acordes cria uma <strong style={{color:"#fff"}}>melodia no baixo</strong> que desce suavemente. É o que dá aquele som sofisticado a progressões simples:</p>
            <TmTabela
              colunas={["Acorde","Nota no baixo","Acorde escrito","Movimento"]}
              linhas={[
                ["Dó","Dó","C","─────────"],
                ["Dó/Si","Si","C/B","desce ½ tom"],
                ["Lá menor","Lá","Am","desce ½ tom"],
                ["Dó/Sol","Sol","C/G","desce ½ tom"],
                ["Fá","Fá","F","desce 1 tom"],
                ["Sol","Sol","G","sobe 1 tom"],
                ["Dó","Dó","C","resolve"],
              ]}
            />
          </TmConceito>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>No violão:</strong> C/E é a posição de Dó com o polegar no Mi da corda grossa, ou apenas deixar o Mi soar no acorde. G/B = corda 5ª no Si. Esses acordes criam um baixo melódico descendo que soa muito mais rico que acordes simples.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Extensões e tensões — além da tétrade">
          <p style={tmS.p}>Além das tétrades (7ª), podemos adicionar <strong style={{color:"#fff"}}>extensões</strong>: 9ª, 11ª, 13ª. Elas "coloram" o acorde sem mudar sua função harmônica.</p>
          <TmTabela
            colunas={["Extensão","Intervalo","Acorde ex.","Notas","Uso no louvor"]}
            linhas={[
              ["7ª menor (♭7)","10 semi","G7","Sol Si Ré Fá","Dominante — quer resolver"],
              ["7ª maior (△7)","11 semi","Cmaj7","Dó Mi Sol Si","Suave, sofisticado"],
              ["9ª (add9)","14 semi","Cadd9","Dó Mi Sol Ré","Cheio, contemporâneo"],
              ["6ª","9 semi","Am6","Lá Dó Mi F#","Jazzístico, bossa"],
              ["11ª (sus4)","5 semi","Csus4","Dó Fá Sol","Suspenso, sem terça"],
            ]}
          />
          <TmConceito titulo="Acordes alterados — tensão cromática">
            <TmTabela
              colunas={["Símbolo","O que altera","Efeito","Estilo"]}
              linhas={[
                ["G7(#9)","9ª aumentada (♭3 na oitava)","Tensão intensa","Gospel soul, R&B"],
                ["G7(b9)","9ª bemolizada","Tensão dramática","Jazz, flamenco"],
                ["G7(#5)","5ª aumentada","Suspenso","Jazz, neo-soul"],
                ["Caug","5ª aumentada","Misterioso","Progressões cromáticas"],
              ]}
            />
          </TmConceito>
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
//  MÓDULO 6 — Campo Harmônico Maior e Menor
// ════════════════════════════════════════════════════════════════
function Mod06_Tonalidade({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [selG,setSelG]=React.useState(null);
  const [isMenor,setIsMenor]=React.useState(false); // toggle maior/menor
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
  const [qRoot,setQRoot]=React.useState(0);const [qGrau,setQGrau]=React.useState(0);const [qMenor,setQMenor]=React.useState(false);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});

  // Campo maior: I ii iii IV V vi vii°
  const CR_MAI=[0,2,4,5,7,9,11];
  const CT_MAI=["maj7","m7","m7","maj7","7","m7","m7♭5"];
  const CMN_MAI=[false,true,true,false,false,true,true];
  const CF_MAI=["Tônica","Subdominante","Tônica","Subdominante","Dominante","Tônica","Dominante"];
  const CC_MAI=["#7F77DD","#1D9E75","#7F77DD","#1D9E75","#D85A30","#7F77DD","#D85A30"];
  const GR_MAI=["I","II","III","IV","V","VI","VII"];

  // Campo menor natural: i ii° ♭III iv v ♭VI ♭VII
  const CR_MEN=[0,2,3,5,7,8,10];
  const CT_MEN=["m7","m7♭5","maj7","m7","m7","maj7","7"];
  const CMN_MEN=[true,true,false,true,true,false,false];
  const CF_MEN=["Tônica","Dominante","Tônica","Subdominante","Dominante","Subdominante","Subdominante"];
  const CC_MEN=["#7F77DD","#D85A30","#7F77DD","#1D9E75","#D85A30","#1D9E75","#1D9E75"];
  const GR_MEN=["i","ii°","♭III","iv","v","♭VI","♭VII"];

  const CR=isMenor?CR_MEN:CR_MAI;
  const CT=isMenor?CT_MEN:CT_MAI;
  const CMN=isMenor?CMN_MEN:CMN_MAI;
  const CF=isMenor?CF_MEN:CF_MAI;
  const CC=isMenor?CC_MEN:CC_MAI;
  const GR=isMenor?GR_MEN:GR_MAI;
  const CIVS={maj7:[0,4,7,11],m7:[0,3,7,10],"7":[0,4,7,10],"m7♭5":[0,3,6,10]};
  function gN(r,i,men=isMenor){
    const crmn=men?CMN_MEN:CMN_MAI;
    const crr=men?CR_MEN:CR_MAI;
    return tmENinKey((r+crr[i])%12,r,men)+(crmn[i]?"m":"");
  }
  function newQ(){
    const r=tmRandom(0,11);const g=tmRandom(0,6);const m=Math.random()>0.5;
    setQRoot(r);setQGrau(g);setQMenor(m);setFb(null);setOptSt({});
  }
  React.useEffect(()=>{newQ();},[]);
  const qCR=qMenor?CR_MEN:CR_MAI;const qCT=qMenor?CT_MEN:CT_MAI;const qCMN=qMenor?CMN_MEN:CMN_MAI;
  const qCF=qMenor?CF_MEN:CF_MAI;const qCC=qMenor?CC_MEN:CC_MAI;const qGR=qMenor?GR_MEN:GR_MAI;
  function answer(i){if(fb)return;const ok=i===qGrau;const os={[i]:ok?"correct":"wrong"};if(!ok)os[qGrau]="correct";setOptSt(os);setFb({ok,msg:ok?`Correto! ${gN(qRoot,qGrau,qMenor)} é o ${qGR[qGrau]} grau — ${qCF[qGrau]}.`:`Errado. Era o ${qGR[qGrau]} grau (${qCF[qGrau]}). Tônica=repouso · Subdominante=movimento · Dominante=tensão.`});}
  const selGObj=selG!==null?{nome:gN(root,selG),tipo:CT[selG],func:CF[selG],cor:CC[selG],ivs:CIVS[CT[selG]]||[0,4,7],root:(root+CR[selG])%12}:null;
  const qCIvs=CIVS[qCT[qGrau]]||[0,4,7];
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
          <TmTabela
            colunas={["Função","Graus","Sensação","Movimento"]}
            linhas={[
              ["Tônica","I, III, VI","Repouso — 'em casa'","Início e fim de frases"],
              ["Subdominante","II, IV","Movimento — 'partindo'","Cria tensão suave"],
              ["Dominante","V, VII","Tensão — 'quer resolver'","Exige retorno à Tônica"],
            ]}
          />
          <TmDica><strong>No louvor em G (Sol):</strong> G Am Bm C D Em F#dim. A progressão G→C→D→G é I→IV→V→I. É a progressão mais usada na história da música ocidental — e na maioria dos hinos congregacionais.</TmDica>
      </TmConceito>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSelG(null);}} label="Tom"/>
        {/* Toggle maior/menor */}
        <div style={{display:"inline-flex",background:"#0d0d0d",border:"1px solid #1d4435",borderRadius:10,padding:3,flexShrink:0}}>
          {[["Maior",false],["Menor",true]].map(([lbl,val])=>(
            <button key={lbl} onClick={()=>{setIsMenor(val);setSelG(null);}} style={{
              fontSize:12,padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",
              fontFamily:"'Montserrat',sans-serif",fontWeight:isMenor===val?700:400,
              background:isMenor===val?(val?"#7F77DD":"#3fae6b"):"transparent",
              color:isMenor===val?"#fff":"#6fae8a",transition:"all .15s"
            }}>{lbl}</button>
          ))}
        </div>
      </div>
      {isMenor&&<div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:"#9b6ef0",background:"rgba(155,110,240,.08)",border:"1px solid #9b6ef044",borderRadius:9,padding:"10px 12px",marginBottom:8}}>
          <strong style={{color:"#9b6ef0"}}>Campo menor natural</strong> — i ii° ♭III iv v ♭VI ♭VII
        </div>
        <TmTabela
          colunas={["Função","Graus (menor)","Diferença da maior","No louvor"]}
          linhas={[
            ["Tônica","i, ♭III, ♭VI","Acordes menores e emprestados","Início e repouso"],
            ["Subdominante","ii°, iv","Tensão suave","Movimento"],
            ["Dominante","v, ♭VII","V menor (sem trítono)","Resolve suave — ou use V maior!"],
          ]}
        />
        <TmDica>O <strong>V grau menor</strong> (v = Em em Lám) não tem trítono, então resolve mais suavemente. Para mais tensão, use o V <em>maior</em> (E em Lám) — isso cria o campo harmônico <strong>menor harmônico</strong>, com G# no lugar de G.</TmDica>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:14}}>
        {GR.map((g,i)=><button key={g} onClick={()=>setSelG(selG===i?null:i)} style={{padding:"8px 4px",borderRadius:10,cursor:"pointer",textAlign:"center",fontFamily:"'Montserrat',sans-serif",background:selG===i?`${CC[i]}33`:"#0d0d0d",border:`1px solid ${selG===i?CC[i]:"#15392b"}`,transition:"all .15s",minWidth:0}}>
          <div style={{fontSize:9,color:CC[i],fontWeight:700}}>{g}</div>
          <div style={{fontSize:"clamp(10px,3vw,13px)",color:"#fff",fontWeight:800,lineHeight:1.3}}>{gN(root,i)}</div>
          <div style={{fontSize:8,color:"#5d917a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{CT[i]}</div>
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
          <thead><tr><th style={tmS.th}>Grau</th><th style={tmS.th}>Acorde em {tmPTinKey(root,root,isMenor)} {isMenor?"menor":"maior"}</th><th style={tmS.th}>Tipo</th><th style={tmS.th}>Função</th></tr></thead>
          <tbody>{GR.map((g,i)=><tr key={g} onClick={()=>setSelG(selG===i?null:i)} style={{cursor:"pointer"}}><td style={{...tmS.td,fontWeight:900,color:CC[i],...tmS.mono}}>{g}</td><td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{gN(root,i)}</td><td style={{...tmS.td,fontSize:12,...tmS.mono,color:"#6fae8a"}}>{CT[i]}</td><td style={{...tmS.td,fontSize:12,color:CC[i]}}>{CF[i]}</td></tr>)}</tbody>
        </table>
      </div>
      <TmEx title="Identificar grau e função" onNew={newQ} fb={<TmFB ok={fb?.ok??null} msg={fb?.msg}/>}>
        <p style={{...tmS.p,marginBottom:10}}>No campo de <strong style={{color:"#3fae6b"}}>{tmPTinKey(qRoot,qRoot,qMenor)} {qMenor?"menor":"maior"}</strong>, qual grau é <strong style={{color:"#fff"}}>{gN(qRoot,qGrau,qMenor)}</strong>?</p>
        <div style={{textAlign:"center",overflowX:"auto",marginBottom:12}}>
          <TmPiano root={(qRoot+CR[qGrau])%12} highlight={qCIvs.map(n=>n%12)} size="md"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {qGR.map((g,i)=><TmOpt key={g} label={`${g} (${qCF[i].slice(0,3)})`} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod07_Progressoes({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [selP,setSelP]=React.useState(0);
  const [playingProg,setPlayingProg]=React.useState(false);
  const [playBeat,setPlayBeat]=React.useState(-1);
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);

  // Toca a progressão selecionada como sequência de acordes
  const playProg = React.useCallback((prog, rootNote) => {
    if (playingProg) return;
    setPlayingProg(true); setPlayBeat(0);
    const CR=[0,2,4,5,7,9,11];const CMN=[false,true,true,false,false,true,true];
    // Nota fundamental de cada grau
    const chords = prog.gi.map(gi => {
      if (gi===-1) return (rootNote+10)%12;
      return (rootNote+CR[gi])%12;
    });
    let ctx;
    try { ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ setPlayingProg(false); return; }
    const bpm=80; const beatLen=60/bpm;
    chords.forEach((root,ci) => {
      // Toca 3 notas do acorde (fundamental + terça + quinta) em sequência rápida
      const intervals = prog.gi[ci]===-1 ? [0,4,7] :
        CMN[prog.gi[ci]] ? [0,3,7] : [0,4,7];
      intervals.forEach((interval,ni) => {
        const midi = 48 + ((root+interval)%12); // C3 base
        const freq = 440 * Math.pow(2,(midi-69)/12);
        const startTime = ctx.currentTime + ci*beatLen*2 + ni*0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type="triangle"; osc.frequency.value=freq;
        gain.gain.setValueAtTime(0.2,startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime+beatLen*1.8);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(startTime); osc.stop(startTime+beatLen*1.9);
      });
      setTimeout(()=>setPlayBeat(ci), (ci*beatLen*2)*1000);
    });
    setTimeout(()=>{ setPlayingProg(false); setPlayBeat(-1); }, chords.length*beatLen*2*1000+200);
  }, [playingProg]);
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
        <TmTabela
          colunas={["Cadência","Movimento","Sensação","Exemplo em Dó"]}
          linhas={[
            ["Autêntica perfeita","V7 → I","Ponto final — conclusão forte","G7 → C"],
            ["Autêntica imperfeita","V → I","Conclusão suave","G → C"],
            ["Plagal (Amém)","IV → I","Religiosa, devocional","F → C"],
            ["Meia cadência","? → V","Suspensão, interrogação","C → G"],
            ["Deceptiva","V → VI","Surpresa — evita o repouso","G → Am"],
          ]}
        />
        <TmDica>No louvor, a cadência plagal (IV→I) é o <strong>"Amém"</strong> musical — suave, devocional, sem a força da autêntica. Muito usada no final de hinos congregacionais.</TmDica>
      </TmConceito>
      <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {PROGS.map((pg,i)=><button key={i} onClick={()=>setSelP(i)} style={{display:"flex",gap:10,alignItems:"flex-start",background:selP===i?"#1a1a1a":"transparent",border:`1px solid ${selP===i?"#2f7d57":"#15392b"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",fontFamily:"'Montserrat',sans-serif",transition:"all .15s"}}>
          <div style={{flex:1}}>
            <span style={{fontWeight:600,color:"#eef5f0",fontSize:13,...tmS.mono}}>{pg.l}</span>
            <span style={{fontSize:12,color:"#3fae6b",marginLeft:8}}>{pg.gi.map(gi=>gN(root,gi)).join(" – ")}</span>
            {pg.lou&&<span style={{...tmS.tag,marginLeft:8}}>Louvor</span>}
          </div>
        </button>)}
      </div>
      <div style={tmS.card}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
          <div style={{fontWeight:700,color:"#fff",fontSize:14,flex:1}}>{PROGS[selP].l} em {tmPTinKey(root,root)}</div>
          <button onClick={()=>playProg(PROGS[selP],root)} disabled={playingProg}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,border:"none",cursor:playingProg?"default":"pointer",
              background:playingProg?"#111":"#3fae6b",color:playingProg?"#6fae8a":"#0d3d28",
              fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:12,flexShrink:0}}>
            {playingProg?"♪ Tocando…":"▶ Ouvir"}
          </button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          {PROGS[selP].gi.map((gi,ci)=>(
            <div key={ci} style={{padding:"8px 12px",borderRadius:9,fontFamily:"'Space Mono',monospace",
              fontSize:15,fontWeight:700,textAlign:"center",
              background:playBeat===ci?"#3fae6b22":"transparent",
              border:playBeat===ci?"1px solid #3fae6b":"1px solid #1d4435",
              color:playBeat===ci?"#3fae6b":"#eef5f0",transition:"all .15s"}}>
              {gN(root,gi)}
            </div>
          ))}
        </div>
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

function Mod08_Modos({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);const [selM,setSelM]=React.useState(0);
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
  const [qM,setQM]=React.useState(0);const [qRoot,setQRoot]=React.useState(0);
  const [fb,setFb]=React.useState(null);const [optSt,setOptSt]=React.useState({});const [opts,setOpts]=React.useState([]);
  const MODOS=[
    {n:"Jônico",   g:"I",  ivs:[0,2,4,5,7,9,11],f:"T T S T T T S",c:"Maior padrão — alegre, estável",          u:"Base da música tonal",                lou:"Maioria dos louvores"},
    {n:"Dórico",   g:"II", ivs:[0,2,3,5,7,9,10],f:"T S T T T S T",c:"Menor com 6ª maior — blues, soul, funk",  u:"Improvisação, funk, jazz, gospel",   lou:"'What Is This Place' · D-dórico em muito gospel soul"},
    {n:"Frígio",   g:"III",ivs:[0,1,3,5,7,8,10],f:"S T T T S T T",c:"Menor com 2ª menor — flamenco, tenso",   u:"Flamenco, drama, clímax musical",      lou:"Raramente no louvor — cria tensão dramática antes de resolver"},
    {n:"Lídio",    g:"IV", ivs:[0,2,4,6,7,9,11],f:"T T T S T T S",c:"Maior com #4 — etéreo, celestial",       u:"Trilhas, exaltação, momentos de glória", lou:"Momentos de exaltação e adoração profunda — som 'celestial'"},
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
        <TmTabela
          colunas={["Grau","Modo","Diferença da maior","Caráter","No louvor"]}
          linhas={[
            ["I","Jônico","= Maior padrão","Alegre, estável","Base de tudo"],
            ["II","Dórico","6ª maior (↑ 1 semi vs menor)","Menor com brilho — soul","Gospel soul, funk"],
            ["III","Frígio","2ª menor (↓ 1 semi)","Tenso, flamenco","Raramente"],
            ["IV","Lídio","4ª aumentada (#4)","Mágico, celestial","Exaltação, glória"],
            ["V","Mixolídio","7ª menor (♭7)","Rock, gospel, blues","MUITO COMUM — I♭VII IV"],
            ["VI","Eólio","= Menor natural","Contemplativo, lamento","Adoração íntima"],
            ["VII","Lócrio","2ª e 5ª menores","Instável, obscuro","Raramente"],
          ]}
        />
        <TmDica><strong>Mixolídio no louvor:</strong> quando você ouve a progressão G–F–C (Sol–Fá–Dó), o Fá natural não existe no campo de Sol maior. Ele vem do Mixolídio — é o que dá aquele som "gospel rock" característico de tantos louvores contemporâneos.</TmDica>
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
        <div style={{...tmS.mono,fontSize:14,color:"#3fae6b",fontWeight:700,letterSpacing:1,marginBottom:10,padding:10,background:"#0d0d0d",borderRadius:10}}>{qm.ivs.map(n=>tmPTinKey((qRoot+n)%12,qRoot)).join("  ")}</div>
        <div style={{overflowX:"auto",marginBottom:12}}><TmPiano root={qRoot} highlight={qm.ivs.map(n=>n%12)} size="sm"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {opts.map(i=><TmOpt key={i} label={`${MODOS[i].n} — ${MODOS[i].c.split(" — ")[0]}`} state={optSt[i]||null} onClick={()=>answer(i)}/>)}
        </div>
      </TmEx>
    </div>
  );
}

function Mod09_HarmoniaAvancada({ globalKey=0, setGlobalKey=null } = {}) {
  const [root,setRoot]=React.useState(globalKey);
  React.useEffect(()=>{setRoot(globalKey);},[globalKey]);
  React.useEffect(()=>{if(setGlobalKey)setGlobalKey(root);},[root]);
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
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #e8554d",background:"rgba(232,85,77,.06)"}}>
        <span style={{color:"#e8554d",fontWeight:700}}>★ Nível Avançado:</span> <em>"Você chegou ao nível avançado. Estes recursos são o que separa quem 'toca acordes' de quem 'faz harmonia'. No louvor, dominantes secundárias e empréstimo modal aparecem o tempo todo."</em>
      </div>
      <TmKeyPicker value={root} onChange={setRoot} label="Tom de referência"/>
      <TmConceito titulo="Mapa dos recursos avançados">
        <TmTabela
          colunas={["Recurso","Símbolo","Quando usar no louvor","Efeito"]}
          linhas={[
            ["Dom. secundária","V/X","Antes de qualquer grau (exceto I)","Tensão local, drama"],
            ["Empréstimo modal","♭III, ♭VI, ♭VII","Para 'colorir' sem mudar de tom","Som gospel, R&B"],
            ["Sub. de trítono","SubV7","Substituir o V7","Baixo cromático descendente"],
            ["Modulação","→ novo tom","Último refrão, bridge","Elevação, renovação"],
            ["Rearmonização","I→Imaj7→etc","Enriquecer acordes simples","Sofisticação"],
            ["Napolitano","♭II","Antes do V7","Máxima tensão dramática"],
            ["Cadência deceptiva","V → VI","Evitar resolução esperada","Surpresa expressiva"],
          ]}
        />
      </TmConceito>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:6}}>
        {CONC.map((c,i)=>{
          // Transpõe os exemplos para o tom atual
          const r=tmPT(root); const ii=tmPT((root+2)%12); const iv=tmPT((root+5)%12);
          const v=tmPT((root+7)%12); const vi=tmPT((root+9)%12); const bvii=tmPT((root+10)%12);
          const bii=tmPT((root+1)%12); const subv=tmPT((root+6)%12); const vim=tmPT((root+9)%12);
          const transposed = c.ap
            .replace(/A7/g,`${vi}7`).replace(/Dm/g,`${ii}m`).replace(/em Dó maior/g,`em ${r} maior`)
            .replace(/Fm/g,`${iv}m`).replace(/em Dó menor/g,`em ${r} menor`)
            .replace(/Ab/g,`${tmPT((root+8)%12)}`).replace(/Bb/g,`${bvii}`)
            .replace(/Db7/g,`${subv}7`).replace(/G7/g,`${v}7`)
            .replace(/Réb/g,bii).replace(/em Dó/g,`em ${r}`);
          return (
          <div key={c.n} style={{...tmS.card,padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:"clamp(13px,3.5vw,14px)",color:"#eef5f0"}}>{c.n}</span>
              <span style={tmS.tag}>{c.t}</span>
            </div>
            <p style={{...tmS.p,marginBottom:4}}><strong style={{color:"#fff"}}>O que é:</strong> {c.d}</p>
            <p style={{...tmS.note,margin:0}}>Aplicação em <strong style={{color:"#9fdabb"}}>{r}</strong>: {transposed}</p>
          </div>
          );
        })}
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


// ════════════════════════════════════════════════════════════════
//  MÓDULO 11 — Ear Training (Treinamento Auditivo)
// ════════════════════════════════════════════════════════════════
function Mod11_EarTraining() {
  const audioCtxRef = React.useRef(null);
  const [phase, setPhase] = React.useState("idle"); // idle | playing | answer
  const [qType, setQType] = React.useState("interval"); // interval | chord | progression
  const [qData, setQData] = React.useState(null);
  const [fb, setFb] = React.useState(null);
  const [optSt, setOptSt] = React.useState({});
  const [score, setScore] = React.useState({ correct: 0, total: 0 });
  const [secao, setSecao] = React.useState(0);

  function getCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }
  function playNote(semitom, startTime, duration = 0.6, volume = 0.3) {
    try {
      const ctx = getCtx();
      const midi = 60 + ((semitom % 12) + 12) % 12;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(startTime); osc.stop(startTime + duration + 0.05);
    } catch(e) {}
  }
  function playInterval(root, interval, harmonic = false) {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime + 0.1;
      playNote(root, t);
      playNote(root + interval, harmonic ? t : t + 0.55);
    } catch(e) {}
  }
  function playChordNotes(root, intervals) {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime + 0.1;
      intervals.forEach(iv => playNote(root, t, 1.2, 0.22));
      intervals.forEach((iv, i) => setTimeout(() => playNote(root + iv, 0, 1.2, 0.22), i * 80));
    } catch(e) {}
  }
  function playProgression(root, degrees) {
    try {
      const ctx = getCtx();
      const CR = [0,2,4,5,7,9,11];
      const CMN = [false,true,true,false,false,true,true];
      degrees.forEach((g, i) => {
        const chordRoot = (root + CR[g]) % 12;
        const ivs = CMN[g] ? [0,3,7] : [0,4,7];
        setTimeout(() => ivs.forEach(iv => playNote(chordRoot + iv, 0, 0.9, 0.2)), i * 900);
      });
    } catch(e) {}
  }

  const INTERVALS = [
    { s: 1, nome: "2ª menor",  car: "Mi→Fá", ex: "Jaws (tubarão)" },
    { s: 2, nome: "2ª maior",  car: "tom inteiro", ex: "Happy Birthday" },
    { s: 3, nome: "3ª menor",  car: "melancólico", ex: "Smoke on the Water" },
    { s: 4, nome: "3ª maior",  car: "alegre", ex: "Oh When the Saints" },
    { s: 5, nome: "4ª justa",  car: "aberto", ex: "Amazing Grace" },
    { s: 6, nome: "Trítono",   car: "tensão máxima", ex: "The Simpsons" },
    { s: 7, nome: "5ª justa",  car: "estável", ex: "Star Wars tema" },
    { s: 8, nome: "6ª menor",  car: "melancólico", ex: "The Entertainer" },
    { s: 9, nome: "6ª maior",  car: "doce", ex: "My Way" },
    { s: 10, nome: "7ª menor", car: "tensão suave", ex: "Somewhere" },
    { s: 11, nome: "7ª maior", car: "sofisticado", ex: "Take On Me" },
    { s: 12, nome: "Oitava",   car: "mesmo som", ex: "Somewhere Over the Rainbow" },
  ];

  const CHORDS = [
    { nome: "Maior",          ivs: [0,4,7],    car: "alegre" },
    { nome: "Menor",          ivs: [0,3,7],    car: "melancólico" },
    { nome: "Diminuto",       ivs: [0,3,6],    car: "tensão" },
    { nome: "Aumentado",      ivs: [0,4,8],    car: "suspenso" },
    { nome: "Dom. 7ª",        ivs: [0,4,7,10], car: "tensão+resolução" },
    { nome: "Maior 7ª",       ivs: [0,4,7,11], car: "suave, jazz" },
    { nome: "Menor 7ª",       ivs: [0,3,7,10], car: "expressivo" },
  ];

  const PROGS = [
    { nome: "I–IV–V–I",   graus: [0,3,4,0], car: "hino clássico" },
    { nome: "I–V–VI–IV",  graus: [0,4,5,3], car: "pop universal" },
    { nome: "VI–IV–I–V",  graus: [5,3,0,4], car: "contemplativa" },
    { nome: "II–V–I",     graus: [1,4,0],   car: "jazz" },
  ];

  function newIntervalQ() {
    const pool = INTERVALS.slice(0, secao === 0 ? 4 : secao === 1 ? 7 : 12);
    const q = pool[tmRandom(0, pool.length - 1)];
    const root = tmRandom(0, 11);
    setQData({ type:"interval", q, root, harmonic: secao === 2 });
    setFb(null); setOptSt({});
    setPhase("playing");
    setTimeout(() => playInterval(root, q.s, secao === 2), 200);
  }
  function newChordQ() {
    const q = CHORDS[tmRandom(0, CHORDS.length - 1)];
    const root = tmRandom(0, 11);
    setQData({ type:"chord", q, root });
    setFb(null); setOptSt({});
    setPhase("playing");
    setTimeout(() => playChordNotes(root, q.ivs), 200);
  }
  function newProgQ() {
    const q = PROGS[tmRandom(0, PROGS.length - 1)];
    const root = tmRandom(0, 11);
    setQData({ type:"prog", q, root });
    setFb(null); setOptSt({});
    setPhase("playing");
    setTimeout(() => playProgression(root, q.graus), 200);
  }
  function replay() {
    if (!qData) return;
    if (qData.type === "interval") playInterval(qData.root, qData.q.s, qData.harmonic);
    if (qData.type === "chord") playChordNotes(qData.root, qData.q.ivs);
    if (qData.type === "prog") playProgression(qData.root, qData.q.graus);
  }
  function answer(chosen, correct) {
    if (fb) return;
    const ok = chosen === correct;
    setScore(s => ({ correct: s.correct + (ok?1:0), total: s.total + 1 }));
    const os = { [chosen]: ok ? "correct" : "wrong" };
    if (!ok) os[correct] = "correct";
    setOptSt(os);
    setFb({ ok, msg: ok ? "Correto! Excelente ouvido." : `Era ${correct}. Ouça novamente e compare.` });
    setPhase("answer");
  }

  const secoes = ["1. Guia", "2. Intervalos", "3. Acordes", "4. Progressões"];
  const difficulties = ["Básico (4 intervalos)", "Intermediário (7)", "Avançado (todos 12)"];

  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #4f9dde",background:"rgba(79,157,222,.06)"}}>
        <span style={{color:"#4f9dde",fontWeight:700}}>👂 Ear Training:</span> <em>"Nenhuma teoria substitui o ouvido. Músicos avançados identificam intervalos, acordes e progressões de ouvido — em tempo real. Esta é a habilidade mais difícil e mais valiosa."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>{setSecao(i);setPhase("idle");setQData(null);setFb(null);}} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Como funciona o Ear Training">
          <p style={tmS.p}>Você vai <strong style={{color:"#fff"}}>ouvir</strong> um som — intervalo, acorde ou progressão — e identificar o que é, <strong style={{color:"#fff"}}>sem ver a cifra</strong>. Este é o treinamento auditivo usado por músicos profissionais.</p>
          <TmTabela
            colunas={["Exercício","O que treina","Dificuldade"]}
            linhas={[
              ["Intervalos","Distância entre 2 notas","⭐⭐"],
              ["Acordes","Tipo pelo som (maior, menor, dim...)","⭐⭐⭐"],
              ["Progressões","Sequência de acordes","⭐⭐⭐⭐"],
            ]}
          />
        </TmConceito>
        <TmConceito titulo="Truques para identificar intervalos">
          <TmTabela
            colunas={["Intervalo","Música de referência","Dica"]}
            linhas={[
              ["2ª menor","Tema de Tubarão","Mais tenso, cromático"],
              ["2ª maior","Happy Birthday","Tom — o passo básico"],
              ["3ª menor","Smoke on the Water","Abre melancólico"],
              ["3ª maior","Oh When the Saints","Abre alegre"],
              ["4ª justa","Amazing Grace","Salta para cima, estável"],
              ["5ª justa","Star Wars","Grande salto, vazio, forte"],
              ["Oitava","Somewhere (Over the Rainbow)","Salto enorme, mesmo som"],
            ]}
          />
        </TmConceito>
        <TmDica>Comece pelos intervalos. Aprenda 2–3 por semana associando à música de referência. Quando conseguir identificar todos os 12 em 30 segundos, o seu ouvido terá dado um salto enorme.</TmDica>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Treinamento de intervalos">
          <p style={tmS.p}>Cada clique em <strong style={{color:"#fff"}}>▶ Tocar</strong> toca duas notas em sequência. Identifique o intervalo pelo som.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            {difficulties.map((d,i)=>(
              <button key={i} onClick={()=>setSecao(1)} style={{fontSize:11,padding:"4px 10px",borderRadius:8,border:"1px solid #1d4435",background:"transparent",color:"#6fae8a",cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>{d}</button>
            ))}
          </div>
        </TmConceito>
        <div style={{...tmS.card,textAlign:"center",padding:20,marginBottom:14}}>
          {score.total > 0 && <div style={{fontSize:12,color:"#5d917a",marginBottom:8}}>{score.correct}/{score.total} corretos ({Math.round(score.correct/score.total*100)}%)</div>}
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={newIntervalQ} style={{...primaryBtn(),padding:"12px 24px"}}>▶ Tocar intervalo</button>
            {qData&&<button onClick={replay} style={ghostBtn()}>↺ Ouvir novamente</button>}
          </div>
          {qData&&fb===null&&phase==="playing"&&(
            <div style={{marginTop:16}}>
              <p style={{...tmS.p,marginBottom:10}}>Que intervalo foi esse?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {INTERVALS.slice(0, secao===0?4:7).concat(secao===2?INTERVALS.slice(7):[]).slice(0,12).map(iv=>(
                  <TmOpt key={iv.s} label={`${iv.nome}`} state={optSt[iv.nome]||null} onClick={()=>answer(iv.nome, qData.q.nome)}/>
                ))}
              </div>
            </div>
          )}
          {fb&&<div style={{marginTop:12}}><TmFB ok={fb.ok} msg={fb.msg}/></div>}
        </div>
        <TmConceito titulo="Referências auditivas">
          <TmTabela
            colunas={["Intervalo","Semi","Referência musical"]}
            linhas={INTERVALS.map(iv=>[iv.nome, String(iv.s), iv.ex])}
          />
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Identificação de acordes pelo som">
          <p style={tmS.p}>Você vai ouvir um acorde (arpejado). Identifique o tipo pelo caráter sonoro.</p>
        </TmConceito>
        <div style={{...tmS.card,textAlign:"center",padding:20,marginBottom:14}}>
          {score.total > 0 && <div style={{fontSize:12,color:"#5d917a",marginBottom:8}}>{score.correct}/{score.total} corretos</div>}
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={newChordQ} style={{...primaryBtn(),padding:"12px 24px"}}>▶ Tocar acorde</button>
            {qData&&<button onClick={replay} style={ghostBtn()}>↺ Repetir</button>}
          </div>
          {qData&&fb===null&&(
            <div style={{marginTop:16}}>
              <p style={{...tmS.p,marginBottom:10}}>Que tipo de acorde foi esse?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {CHORDS.map(c=><TmOpt key={c.nome} label={c.nome} state={optSt[c.nome]||null} onClick={()=>answer(c.nome, qData.q.nome)}/>)}
              </div>
            </div>
          )}
          {fb&&<div style={{marginTop:12}}><TmFB ok={fb.ok} msg={fb.msg}/></div>}
        </div>
        <TmTabela
          colunas={["Tipo","Caráter sonoro","Dica para identificar"]}
          linhas={[
            ["Maior","Alegre, brilhante","Terceira alta (4 semi) — abre largo"],
            ["Menor","Melancólico","Terceira baixa (3 semi) — mais fechado"],
            ["Diminuto","Tenso, instável","Dois tons menores empilhados — fecha"],
            ["Aumentado","Suspenso, mágico","Simétrico, não resolve"],
            ["Dom. 7ª","Tensão que quer resolver","Trítono interno, 4 notas"],
            ["Maior 7ª","Suave, sofisticado","Estável mas com cor"],
            ["Menor 7ª","Expressivo, jazz","Menor com sabor de 7ª"],
          ]}
        />
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Identificação de progressões">
          <p style={tmS.p}>Você vai ouvir 3–4 acordes em sequência. Identifique a progressão.</p>
        </TmConceito>
        <div style={{...tmS.card,textAlign:"center",padding:20,marginBottom:14}}>
          {score.total > 0 && <div style={{fontSize:12,color:"#5d917a",marginBottom:8}}>{score.correct}/{score.total} corretos</div>}
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={newProgQ} style={{...primaryBtn(),padding:"12px 24px"}}>▶ Tocar progressão</button>
            {qData&&<button onClick={replay} style={ghostBtn()}>↺ Repetir</button>}
          </div>
          {qData&&fb===null&&(
            <div style={{marginTop:16}}>
              <p style={{...tmS.p,marginBottom:10}}>Que progressão foi essa?</p>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {PROGS.map(p=><TmOpt key={p.nome} label={`${p.nome} — ${p.car}`} state={optSt[p.nome]||null} onClick={()=>answer(p.nome, qData.q.nome)}/>)}
              </div>
            </div>
          )}
          {fb&&<div style={{marginTop:12}}><TmFB ok={fb.ok} msg={fb.msg}/></div>}
        </div>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 12 — Violão: Formas, Pestana e CAGED
// ════════════════════════════════════════════════════════════════
function Mod12_Violao() {
  const [secao, setSecao] = React.useState(0);
  const [selAcorde, setSelAcorde] = React.useState("E");

  // Diagrama de grade de violão (6 cordas × 5 casas)
  function ViolaoGrid({ nome, casaInicial = 0, dots, barreString = null, barreFret = null }) {
    const STRINGS = 6;
    const FRETS = 5;
    const strings = Array.from({length:STRINGS},(_,i)=>i);
    const frets = Array.from({length:FRETS},(_,i)=>i+1);
    return (
      <div style={{display:"inline-block",fontFamily:"'Space Mono',monospace",userSelect:"none"}}>
        <div style={{fontWeight:700,color:"#fff",fontSize:13,textAlign:"center",marginBottom:6}}>{nome}</div>
        {casaInicial>0&&<div style={{fontSize:10,color:"#6fae8a",textAlign:"right",marginBottom:2}}>{casaInicial}ª casa</div>}
        <div style={{position:"relative",paddingLeft:20,paddingTop:8}}>
          {/* Indicadores de corda aberta / muda */}
          <div style={{display:"flex",gap:0,marginBottom:4,paddingLeft:0}}>
            {dots.map((d,si)=>(
              <div key={si} style={{width:28,textAlign:"center",fontSize:11,color:d==="x"?"#e8554d":d==="o"?"#3fae6b":"transparent",fontWeight:700}}>
                {d==="x"?"✕":d==="o"?"○":""}
              </div>
            ))}
          </div>
          {/* Grade */}
          <div style={{position:"relative"}}>
            {/* Frets */}
            {frets.map(f=>(
              <div key={f} style={{display:"flex",alignItems:"center",position:"relative",height:28}}>
                {/* Linha do fret */}
                <div style={{position:"absolute",left:0,right:0,top:"50%",height:1,background:f===1?"#eef5f0":"#2f4a38",zIndex:0}}/>
                {/* Pontos nas cordas */}
                {strings.map(si=>{
                  const hasDot = dots[si]===f;
                  const isBarreHere = barreFret===f && si>=barreString;
                  return (
                    <div key={si} style={{width:28,height:28,position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {/* Corda (linha vertical) */}
                      <div style={{position:"absolute",top:0,bottom:0,left:"50%",width:1,background:"#2f4a38",zIndex:0}}/>
                      {(hasDot||isBarreHere)&&(
                        <div style={{width:16,height:16,borderRadius:"50%",background:hasDot?"#3fae6b":isBarreHere?"#4f9dde":"transparent",zIndex:2,border:isBarreHere&&!hasDot?"1px solid #4f9dde":"none"}}/>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Linha de pestana (barra) */}
            {barreFret&&(
              <div style={{position:"absolute",left:barreString*28+14,top:(barreFret-1)*28+6,width:(6-barreString)*28,height:16,borderRadius:8,background:"rgba(79,157,222,.35)",border:"1px solid #4f9dde",zIndex:3,pointerEvents:"none"}}/>
            )}
          </div>
        </div>
      </div>
    );
  }

  const ACORDES_ABERTOS = {
    "E":  { dots:["o","o",3,2,1,"o"], nome:"Mi maior (E)" },
    "Em": { dots:["o","o",2,2,"o","o"], nome:"Mi menor (Em)" },
    "A":  { dots:["x","o",2,2,2,"o"], nome:"Lá maior (A)" },
    "Am": { dots:["x","o",2,2,1,"o"], nome:"Lá menor (Am)" },
    "D":  { dots:["x","x","o",2,3,2], nome:"Ré maior (D)" },
    "Dm": { dots:["x","x","o",2,3,1], nome:"Ré menor (Dm)" },
    "G":  { dots:[3,2,"o","o","o",3], nome:"Sol maior (G)" },
    "C":  { dots:["x",3,2,"o",1,"o"], nome:"Dó maior (C)" },
  };

  const BARRE_CHORDS = [
    { nome:"F (barra 1ª)",  dots:[1,"o",3,3,2,1], barreString:0, barreFret:1, nota:"Barra o indicador na 1ª casa" },
    { nome:"Bm (barra 2ª)", dots:[2,2,4,4,3,2], barreString:0, barreFret:2, nota:"Formato de Am com barra" },
    { nome:"B (barra 2ª)",  dots:[2,2,4,4,4,2], barreString:0, barreFret:2, nota:"Formato de A com barra" },
    { nome:"F#m (barra 2ª)",dots:[2,2,4,4,3,2], barreString:0, barreFret:2, nota:"Bm na 2ª casa" },
  ];

  const secoes = ["1. Posições abertas","2. Pestana","3. CAGED","4. Dicas móveis"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"O violão tem uma geometria lógica. Uma vez que você aprende o CAGED, percebe que os mesmos acordes que já toca existem em 5 posições diferentes no braço — e isso liberta sua mão."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Acordes abertos — os 8 essenciais">
          <p style={tmS.p}>Acordes abertos usam cordas soltas e são a base do violão acústico. Memorize os 8 abaixo — eles cobrem 80% dos louvores congregacionais.</p>
        </TmConceito>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {Object.keys(ACORDES_ABERTOS).map(k=>(
            <button key={k} onClick={()=>setSelAcorde(k)}
              style={{padding:"6px 14px",borderRadius:9,border:selAcorde===k?"1px solid #3fae6b":"1px solid #1d4435",background:selAcorde===k?"rgba(63,174,107,.15)":"transparent",color:selAcorde===k?"#3fae6b":"#9fdabb",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>
              {k}
            </button>
          ))}
        </div>
        {selAcorde&&ACORDES_ABERTOS[selAcorde]&&(
          <div style={{...tmS.card,display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
            <ViolaoGrid nome={ACORDES_ABERTOS[selAcorde].nome} dots={ACORDES_ABERTOS[selAcorde].dots}/>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontWeight:700,color:"#fff",fontSize:15,marginBottom:8}}>{ACORDES_ABERTOS[selAcorde].nome}</div>
              <TmTabela
                colunas={["Corda","Ação","Dedo"]}
                linhas={ACORDES_ABERTOS[selAcorde].dots.map((d,i)=>[
                  `${6-i}ª (${["E","A","D","G","B","e"][i]})`,
                  d==="o"?"Aberta":d==="x"?"Abafada":`Casa ${d}`,
                  d==="o"||d==="x"?"—":String(d)
                ])}
              />
            </div>
          </div>
        )}
        <TmDica>Memorize a ordem: <strong>E Am D G C Em F Bm</strong> — esses são os acordes mais usados no louvor, na ordem de frequência. Domine os 5 primeiros antes de avançar para pestana.</TmDica>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Acordes com pestana (barra)">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Pestana</strong> (ou barra) = o indicador pressiona todas as 6 cordas em uma mesma casa, criando um capo natural. Isso permite tocar qualquer acorde em qualquer tom usando as mesmas formas.</p>
          <TmTabela
            colunas={["Forma base","Pestana","Resulta em","Exemplo"]}
            linhas={[
              ["E maior","1ª casa","F maior","F = E com barra na 1ª"],
              ["E maior","2ª casa","F# maior","F# = E com barra na 2ª"],
              ["E maior","4ª casa","G# maior","G# = E com barra na 4ª"],
              ["Am","2ª casa","Bm","Bm = Am com barra na 2ª"],
              ["Am","5ª casa","Dm","Dm = Am com barra na 5ª"],
            ]}
          />
        </TmConceito>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          {BARRE_CHORDS.map(ac=>(
            <div key={ac.nome} style={tmS.card}>
              <ViolaoGrid nome={ac.nome} dots={ac.dots} barreString={ac.barreString} barreFret={ac.barreFret}/>
              <p style={{...tmS.note,marginTop:8}}>{ac.nota}</p>
            </div>
          ))}
        </div>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Dica de técnica:</strong> ao fazer barra, posicione o indicador bem perto do traste (não no meio da casa). Use a lateral óssea do dedo, não a polpa macia. O polegar deve estar no centro do braço, oposto ao indicador.</p>
        </TmAplicacao>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Sistema CAGED — 5 posições para qualquer acorde">
          <p style={tmS.p}>O <strong style={{color:"#fff"}}>CAGED</strong> são as 5 formas base (C, A, G, E, D) que se repetem pelo braço inteiro. Todo acorde maior existe nessas 5 posições.</p>
          <TmTabela
            colunas={["Forma","Raiz fica na","Exemplo em Sol (G)","Casa"]}
            linhas={[
              ["C","2ª corda, nota mais alta","G forma C","5ª casa"],
              ["A","5ª corda","G forma A","10ª casa"],
              ["G","Aberta (6ª corda)","G aberta","Casa 0"],
              ["E","6ª e 1ª corda","G forma E","3ª casa"],
              ["D","4ª corda","G forma D","7ª casa"],
            ]}
          />
          <TmDica>Aprenda primeiro a localizar a nota raiz em cada forma CAGED na 6ª e 5ª corda. Saber onde está o Lá na 5ª corda (2ª casa) é o que permite montar Am, A, A7 em qualquer posição.</TmDica>
        </TmConceito>
        <TmConceito titulo="Notas na 6ª e 5ª corda (essencial)">
          <TmTabela
            colunas={["Casa","6ª corda (E)","5ª corda (A)"]}
            linhas={[
              ["0 (solta)","Mi (E)","Lá (A)"],
              ["1","Fá (F)","Sib (Bb)"],
              ["2","F# / Solb","Si (B)"],
              ["3","Sol (G)","Dó (C)"],
              ["4","Sol# / Láb","Dó# / Réb"],
              ["5","Lá (A)","Ré (D)"],
              ["7","Si (B)","Mi (E)"],
              ["8","Dó (C)","Fá (F)"],
              ["10","Ré (D)","Sol (G)"],
              ["12","Mi (E)","Lá (A)"],
            ]}
          />
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Dicas práticas para o louvor">
          <TmTabela
            colunas={["Situação","Solução","Por quê"]}
            linhas={[
              ["Tom de Si (B) é difícil","Use capo na 2ª casa, toque em Lá (A)","Mesmas formas, mais fácil"],
              ["Tom de Fá (F) é difícil","Use capo na 1ª casa, toque em Mi (E)","F = E com barra na 1ª"],
              ["Líder quer tom mais alto","Suba o capo 1 ou 2 casas","Mantém as formas abertas"],
              ["Progressão pede F#m","Capo 2ª + forma de Em","F#m = Em na 2ª casa"],
              ["Som mais brilhante","Toque mais no cavalete","Mais agudo e articulado"],
              ["Som mais suave","Toque mais sobre o buraco","Mais redondo, menos agudo"],
            ]}
          />
        </TmConceito>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Exercício semanal:</strong> pegue uma música do repertório. Identifique o tom. Toque sem capo nas posições de barra. Depois toque com capo em posição aberta. Compare o som e a dificuldade. Isso treina sua fluência com o CAGED.</p>
        </TmAplicacao>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 13 — Harmonia Vocal e Voicing
// ════════════════════════════════════════════════════════════════
function Mod13_HarmoniaVocal() {
  const [secao, setSecao] = React.useState(0);
  const audioCtxRef = React.useRef(null);

  function playVoicing(freqs) {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i*0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i*0.1);
        osc.stop(ctx.currentTime + 1.6);
      });
    } catch(e) {}
  }
  function noteFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  const VOICINGS = [
    { nome:"C em posição fechada", desc:"Notas próximas — mais denso", midi:[60,64,67,72], vozes:["Barítono: Dó","Tenor: Mi","Contralto: Sol","Soprano: Dó (oitava)"] },
    { nome:"C em posição aberta", desc:"Notas espaçadas — mais aéreo", midi:[48,64,72,79], vozes:["Baixo: Dó (grave)","Tenor: Mi","Contralto: Dó","Soprano: Sol"] },
    { nome:"G com 1ª inversão", desc:"Si no baixo — passagem suave", midi:[47,55,62,67], vozes:["Baixo: Si","Tenor: Sol","Contralto: Ré","Soprano: Sol"] },
  ];

  const secoes = ["1. Conceito","2. Voicings","3. Movimento","4. Prática"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #ec6aa8",background:"rgba(236,106,168,.06)"}}>
        <span style={{color:"#ec6aa8",fontWeight:700}}>🎤 Vozes:</span> <em>"O arranjo vocal é o que transforma músicos em um grupo de louvor. Não basta saber a cifra — é preciso saber como distribuir as notas entre as vozes para criar harmonia real."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Tessituras vocais — cada voz tem um range">
          <TmTabela
            colunas={["Voz","Range","Notas típicas","Função no grupo"]}
            linhas={[
              ["Soprano","Dó4 – Lá5","C4 – A5","Melodia principal, a mais aguda"],
              ["Mezzo/Contralto","Lá3 – Fá5","A3 – F5","Harmonia, 3ª ou 6ª abaixo do soprano"],
              ["Tenor","Dó3 – Lá4","C3 – A4","Harmonia aguda masculina"],
              ["Barítono","Sol2 – Mi4","G2 – E4","Linha harmônica intermediária"],
              ["Baixo","Mi2 – Dó4","E2 – C4","Fundamental do acorde, base"],
            ]}
          />
          <TmDica>No grupo de louvor típico: a <strong>voz principal</strong> está no soprano. O coral tende a ter soprano + contralto (femininos) e tenor + baixo (masculinos). Mas adapte para sua realidade!</TmDica>
        </TmConceito>
        <TmConceito titulo="Regras básicas de voicing a 4 vozes">
          <TmTabela
            colunas={["Regra","Descrição","Por quê"]}
            linhas={[
              ["Dobrar a fundamental","A nota raiz aparece em 2 vozes","Reforça a identidade do acorde"],
              ["Evitar 5ªs paralelas","Duas vozes não sobem/descem 5ªs juntas","Soa vazio e mecânico"],
              ["Evitar 8ªs paralelas","Idem com oitavas","Vozes perdem independência"],
              ["Movimento contrário preferido","Quando uma voz sobe, outra desce","Cria independência vocal"],
              ["Intervalo máximo S-C: 6ª","Soprano e contralto próximos","Blend melhor"],
            ]}
          />
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Posição fechada vs aberta">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Posição fechada:</strong> as 4 vozes cabem em menos de uma oitava. Som mais denso e compacto — bom para coral. <strong style={{color:"#fff"}}>Posição aberta:</strong> vozes espaçadas em mais de uma oitava. Som mais arejado — bom para grupos com poucos cantores.</p>
        </TmConceito>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {VOICINGS.map((v,i)=>(
            <div key={i} style={tmS.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{v.nome}</div>
                  <div style={{fontSize:12,color:"#6fae8a"}}>{v.desc}</div>
                </div>
                <button onClick={()=>playVoicing(v.midi.map(m=>noteFreq(m)))} style={{...ghostBtn(),padding:"7px 14px",fontSize:12}}>
                  ▶ Ouvir
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {v.vozes.map((vz,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:["#e8554d","#e0b341","#4f9dde","#ec6aa8"][j],fontWeight:700,minWidth:80}}>{["Soprano","Contralto","Tenor","Barítono"][j]}</span>
                    <span style={{fontSize:12,color:"#9fdabb"}}>{vz.split(": ")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Movimento de vozes — como conectar acordes">
          <p style={tmS.p}>A arte do arranjo vocal está em como as vozes <strong style={{color:"#fff"}}>se movem</strong> de um acorde para o outro. Vozes que andam pouco (meio tom ou tom) soam mais natural.</p>
          <TmTabela
            colunas={["Tipo de movimento","Descrição","Qualidade"]}
            linhas={[
              ["Contrário","Uma voz sobe, outra desce","Ótimo — vozes independentes"],
              ["Oblíquo","Uma voz se move, outra fica","Bom — estabilidade + movimento"],
              ["Similar","Vozes movem na mesma direção","OK — evitar quando paralelas"],
              ["Paralelo por 3ªs/6ªs","Duas vozes se movem juntas em 3ª/6ª","Bonito e muito usado"],
              ["Paralelo por 5ªs/8ªs","Duas vozes se movem juntas em 5ª/8ª","Evitar — vazio"],
            ]}
          />
          <TmDica>Na passagem de G para C: o Si (sensível) sobe para Dó, o Ré pode descer para Mi, o Sol pode ficar ou ir para Sol. Sempre procure o caminho de menor distância para cada voz.</TmDica>
        </TmConceito>
        <TmConceito titulo="Harmonia a 3 vozes (prático para louvor)">
          <p style={tmS.p}>Com 3 cantores, distribua assim: <strong style={{color:"#fff"}}>Soprano = melodia. Contralto = 3ª abaixo. Tenor = 5ª abaixo</strong> (ou 3ª abaixo do contralto). Essa fórmula funciona para 90% dos louvores.</p>
          <TmTabela
            colunas={["Acorde","Soprano","Contralto","Tenor"]}
            linhas={[
              ["G","Sol","Mi","Si"],
              ["Em","Mi","Dó","Sol"],
              ["C","Mi","Dó","Sol"],
              ["D","Ré","Lá","F#"],
            ]}
          />
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Exercícios práticos para o grupo de louvor">
          <p style={tmS.p}><strong style={{color:"#fff"}}>1. Identifique as vozes do grupo:</strong> cada voz faz uma nota e o líder ajusta até formarem 3ªs e 5ªs. Grave e compare.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>2. Progressão harmônica:</strong> escolha G–Em–C–D. Cada voz canta só sua linha (Soprano faz a melodia, Contralto faz 3ªs, Tenor faz 5ªs). Pratique separado, depois junto.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>3. Movimento contrário:</strong> enquanto o soprano sobe, o contralto desce. Esse exercício desenvolve independência vocal.</p>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>Para o grupo:</strong> grave um ensaio em áudio. Ouça a gravação e identifique onde as vozes "colam" (soa igual, sem harmonia). Nesses pontos, uma das vozes precisa mudar de nota — provavelmente para a 3ª ou 6ª do soprano.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 14 — Arranjo, Dinâmica e Textura
// ════════════════════════════════════════════════════════════════
function Mod14_Arranjo() {
  const [secao, setSecao] = React.useState(0);
  const secoes = ["1. Estrutura","2. Dinâmica","3. Textura","4. Aplicação"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #f0883e",background:"rgba(240,136,62,.06)"}}>
        <span style={{color:"#f0883e",fontWeight:700}}>🎚 Arranjo:</span> <em>"A diferença entre 'tocar música' e 'fazer música' está no arranjo. Ele é o que cria suspense, emoção, clímax e catarse — usando os mesmos acordes de sempre."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Estrutura de uma música de louvor">
          <TmTabela
            colunas={["Seção","Função","Energia","Instrumentação típica"]}
            linhas={[
              ["Intro","Estabelece o tom e o groove","Baixa","Violão ou piano solo"],
              ["Verso","Conta a história, cria contexto","Média","Violão + bateria suave"],
              ["Pré-refrão","Cria tensão e antecipação","Crescendo","Adiciona baixo e pad"],
              ["Refrão","Clímax emocional, mensagem central","Alta","Banda completa"],
              ["Ponte","Contraste, new perspective","Variável","Pode subir ou descer"],
              ["Build/Rampa","Escalada de tensão antes do clímax","Crescendo","Menos instrumentos, mais pressão"],
              ["Breakdown","Redução radical de instrumentos","Muito baixa","Só voz + violão"],
              ["Final","Resolução ou cadência aberta","Decrescendo ou Alta","Fermatas, diminuendo"],
            ]}
          />
        </TmConceito>
        <TmDica>A estrutura mais comum no louvor contemporâneo: <strong>Intro → V1 → Refrão → V2 → Refrão → Ponte → Refrão final</strong>. A ponte costuma ser o momento mais intenso ou mais íntimo da música.</TmDica>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Dinâmica — o volume como expressão">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Dinâmica</strong> é a variação de volume intencional. Mais do que qualquer acorde, a dinâmica cria emoção.</p>
          <TmTabela
            colunas={["Símbolo","Nome","Nível","No louvor"]}
            linhas={[
              ["pp","Pianissimo","Muito suave","Momento de intimidade/oração"],
              ["p","Piano","Suave","Versos, partes contemplativas"],
              ["mp","Mezzo-piano","Meio suave","Versos com banda leve"],
              ["mf","Mezzo-forte","Meio forte","Refrões normais"],
              ["f","Forte","Forte","Refrões de celebração"],
              ["ff","Fortissimo","Muito forte","Clímax, rampas"],
              ["crescendo","<","Aumenta","Build, rampa"],
              ["decrescendo",">","Diminui","Final, momentos íntimos"],
            ]}
          />
          <TmConceito titulo="Técnica: o breakdown">
            <p style={tmS.p}>O <strong style={{color:"#fff"}}>breakdown</strong> é uma redução radical — de repente só voz e violão, ou só piano. Isso cria contraste dramático. Quando a banda toda volta depois, o impacto é multiplicado.</p>
            <TmDiagrama titulo="Curva de energia de um louvor típico">{`Energia\n\n  ████      ██████\n  █  ██    ██    ██████\n  █   ██  ██          ████\n  █    ████              ██\n─────────────────────────────→ tempo\nIntro  V1  C1  V2  C2  Ponte Final`}</TmDiagrama>
          </TmConceito>
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Textura — quantas camadas soa ao mesmo tempo">
          <TmTabela
            colunas={["Textura","Instrumentos","Sensação","Quando usar"]}
            linhas={[
              ["Monofônica","Só voz ou 1 instrumento","Nua, íntima","Abertura de culto, oração"],
              ["Heterofônica","Todos tocando variações da mesma melodia","Cheia, uníssono","Congregação cantando toda junta"],
              ["Homofônica","Acorde + melodia principal","Clara, definida","Maioria dos louvores"],
              ["Polifônica","Várias linhas independentes","Rica, complexa","Coral, arranjos elaborados"],
            ]}
          />
        </TmConceito>
        <TmConceito titulo="Camadas de um arranjo de louvor">
          <TmTabela
            colunas={["Camada","Instrumento","Frequência","Função"]}
            linhas={[
              ["Base rítmica","Bateria / percussão","100–200Hz","Pulso e groove"],
              ["Base harmônica","Baixo","60–250Hz","Conecta ritmo e harmonia"],
              ["Harmonia média","Violão, guitarra rítmica","200–2000Hz","Acordes, preenchimento"],
              ["Harmonia alta","Piano/teclado, pad","500–5000Hz","Cor, textura, brilho"],
              ["Melodia","Voz principal","300–3000Hz","Mensagem, emoção"],
              ["Ornamento","Guitarra solo, strings","vários","Contraponto, detalhe"],
            ]}
          />
          <TmDica>No louvor com banda pequena: <strong>priorize base (bateria+baixo) + harmonia média (violão) + voz</strong>. Com 3 instrumentos bem posicionados soa melhor que 6 disputando espaço.</TmDica>
        </TmConceito>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Aplicação prática — arranjando uma música">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Passo 1 — Mapeie a estrutura:</strong> escute a gravação original e identifique cada seção. Quantos versos? A ponte sobe ou desce?</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Passo 2 — Defina a curva de energia:</strong> desenhe num papel como o volume/intensidade deve se comportar ao longo da música.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Passo 3 — Atribua instrumentos por seção:</strong> quem entra no verso, quem fica quieto no breakdown, quem lidera a rampa.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Passo 4 — Sinais no ensaio:</strong> combinação de gestos para os músicos — mão para baixo = diminuir, punho fechado = parar, dedo apontando = solo.</p>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>Exercício:</strong> na próxima música que o grupo for ensaiar, antes de tocar, discuta: onde vai ter breakdown? Onde vai ter build? Quando cada instrumento entra? Essa conversa de 5 minutos antes do ensaio economiza 30 minutos de tentativa e erro.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 15 — Nashville Number System
// ════════════════════════════════════════════════════════════════
function Mod15_Nashville() {
  const [root, setRoot] = React.useState(7); // Sol
  const [secao, setSecao] = React.useState(0);
  const [qProg, setQProg] = React.useState(null);
  const [userNums, setUserNums] = React.useState([]);
  const [fb, setFb] = React.useState(null);

  const CR = [0,2,4,5,7,9,11];
  const CMN = [false,true,true,false,false,true,true];
  const GR = ["1","2m","3m","4","5","6m","7°"];
  function gN(r, i) { return tmENinKey((r+CR[i])%12,r)+(CMN[i]?"m":""); }

  const PROGS_NNS = [
    { nums:[1,5,6,4], nome:"1-5-6-4 (pop universal)", desc:"A progressão mais usada de todos os tempos" },
    { nums:[1,4,5,1], nome:"1-4-5-1 (cadência)", desc:"Hinos clássicos, blues" },
    { nums:[6,4,1,5], nome:"6-4-1-5 (relativo menor)", desc:"Louvor contemplativo" },
    { nums:[1,6,4,5], nome:"1-6-4-5 (anos 50)", desc:"Corinhos, música gospel antiga" },
    { nums:[2,5,1], nome:"2-5-1 (jazz)", desc:"Cadência do jazz — funciona em qualquer tom" },
    { nums:[1,3,4,5], nome:"1-3-4-5 (pop clássico)", desc:"Muito usada em baladas" },
  ];

  function newQ() {
    const p = PROGS_NNS[tmRandom(0,PROGS_NNS.length-1)];
    const r = tmRandom(0,11);
    setQProg({prog:p, root:r});
    setUserNums([]);
    setFb(null);
  }
  function checkAnswer() {
    if (!qProg) return;
    const ok = JSON.stringify(userNums) === JSON.stringify(qProg.prog.nums);
    setFb({ ok, msg: ok ? "Perfeito! Você identificou os graus corretamente." : `Não está certo. Era: ${qProg.prog.nums.join("–")} (${qProg.prog.nome})` });
  }

  React.useEffect(()=>{setRoot(root);},[]);
  const secoes = ["1. O que é","2. Sistema","3. Transposição","4. Exercício"];

  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #9b6ef0",background:"rgba(155,110,240,.06)"}}>
        <span style={{color:"#9b6ef0",fontWeight:700}}>🎸 Nashville:</span> <em>"Com o Nashville Number System, você nunca mais precisa 'reaprender' uma música quando o tom muda. Você pensa em números, não em acordes — e os números valem em qualquer tonalidade."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Por que pensar em números?">
          <p style={tmS.p}>Quando você escreve "G C D G" (Sol Dó Ré Sol), essa cifra só funciona em Sol. Se o líder pedir "meio tom acima", você precisa reescrever tudo. Com o Nashville Number System (NNS), você escreve <strong style={{color:"#fff"}}>1 4 5 1</strong> — e esses números valem em <em>qualquer tom</em>.</p>
          <TmTabela
            colunas={["Número","Função","Tipo","Em G","Em C","Em D"]}
            linhas={[
              ["1","Tônica","Maior","G","C","D"],
              ["2m","Supertônica","Menor","Am","Dm","Em"],
              ["3m","Mediante","Menor","Bm","Em","F#m"],
              ["4","Subdominante","Maior","C","F","G"],
              ["5","Dominante","Maior","D","G","A"],
              ["6m","Relativo menor","Menor","Em","Am","Bm"],
              ["7°","Sensível","Diminuto","F#°","B°","C#°"],
            ]}
          />
        </TmConceito>
        <TmDica>O NNS é o sistema usado em estúdios de Nashville para que músicos de sessão toquem qualquer música em qualquer tom sem partitura. Um "chart" de Nashville tem os números, a estrutura (V1 C1 Bridge) e as indicações de dinâmica — nada mais.</TmDica>
      </div>}

      {secao===1&&<div>
        <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
        <TmConceito titulo="Campo harmônico em números">
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:14}}>
            {GR.map((g,i)=>(
              <div key={g} style={{background:"#0d0d0d",border:`1px solid ${["#7F77DD","#1D9E75","#7F77DD","#1D9E75","#D85A30","#7F77DD","#D85A30"][i]}44`,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                <div style={{fontSize:11,color:["#7F77DD","#1D9E75","#7F77DD","#1D9E75","#D85A30","#7F77DD","#D85A30"][i],fontWeight:700}}>{g}</div>
                <div style={{fontSize:"clamp(11px,3vw,14px)",color:"#fff",fontWeight:800,marginTop:2}}>{gN(root,i)}</div>
              </div>
            ))}
          </div>
        </TmConceito>
        <TmConceito titulo="Progressões em NNS">
          <TmTabela
            colunas={["NNS","Nome","Acordes em Sol (G)","Acordes em Dó (C)"]}
            linhas={PROGS_NNS.map(p=>[
              p.nums.join("–"),
              p.nome,
              p.nums.map(n=>gN(7,n-1===6?6:n<=0?0:n-1)).join(" "),
              p.nums.map(n=>gN(0,n-1===6?6:n<=0?0:n-1)).join(" "),
            ])}
          />
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmKeyPicker value={root} onChange={setRoot} label="Tom"/>
        <TmConceito titulo="Como transpor usando o NNS">
          <p style={tmS.p}>Selecione qualquer tom acima e veja os acordes mudarem automaticamente. Os números ficam iguais — só os nomes mudam.</p>
        </TmConceito>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {PROGS_NNS.map(p=>(
            <div key={p.nome} style={tmS.card}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
                <span style={{...tmS.mono,fontSize:15,fontWeight:800,color:"#9b6ef0"}}>{p.nums.join(" – ")}</span>
                <span style={{fontSize:12,color:"#6fae8a"}}>{p.desc}</span>
              </div>
              <div style={{...tmS.mono,fontSize:16,color:"#3fae6b",fontWeight:700,letterSpacing:.5}}>
                {p.nums.map(n=>{const i=n-1<0?0:n-1>6?6:n-1; return gN(root,i);}).join("   ")}
              </div>
              <div style={{fontSize:11,color:"#5d917a",marginTop:4}}>em {tmPTinKey(root,root)}</div>
            </div>
          ))}
        </div>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Exercício — Nomear os graus">
          <p style={tmS.p}>Veja os acordes abaixo. Identifique quais são os <strong style={{color:"#fff"}}>números NNS</strong> correspondentes.</p>
        </TmConceito>
        <div style={{...tmS.card,marginBottom:14}}>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:12}}>
            <button onClick={newQ} style={primaryBtn()}>↺ Nova progressão</button>
          </div>
          {qProg&&<>
            <div style={{fontSize:11,color:"#5d917a",marginBottom:6}}>Tom: <strong style={{color:"#9fdabb"}}>{tmPTinKey(qProg.root,qProg.root)}</strong></div>
            <div style={{...tmS.mono,fontSize:20,color:"#fff",fontWeight:800,textAlign:"center",marginBottom:14,letterSpacing:1}}>
              {qProg.prog.nums.map(n=>{const i=n-1<0?0:n-1>6?6:n-1; return gN(qProg.root,i);}).join("  –  ")}
            </div>
            <p style={{...tmS.p,marginBottom:10}}>Selecione os números em ordem:</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              {GR.map((g,i)=>(
                <button key={g} onClick={()=>setUserNums(u=>[...u,i+1])}
                  style={{padding:"8px 14px",borderRadius:9,border:"1px solid #1d4435",background:"#0d0d0d",color:"#9fdabb",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>
                  {g}
                </button>
              ))}
              {userNums.length>0&&<button onClick={()=>setUserNums(u=>u.slice(0,-1))} style={{...ghostBtn(),padding:"8px 12px",fontSize:12}}>← Apagar</button>}
            </div>
            <div style={{...tmS.mono,fontSize:16,color:"#9b6ef0",fontWeight:800,marginBottom:10,minHeight:24}}>
              {userNums.map(n=>GR[n-1]).join(" – ")}
            </div>
            {userNums.length >= qProg.prog.nums.length && !fb && (
              <button onClick={checkAnswer} style={{...primaryBtn(),width:"100%",justifyContent:"center"}}>Verificar</button>
            )}
            {fb&&<TmFB ok={fb.ok} msg={fb.msg}/>}
          </>}
        </div>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 16 — Síncope e Ritmo Avançado
// ════════════════════════════════════════════════════════════════
function Mod16_Sincope() {
  const [secao, setSecao] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [beat, setBeat] = React.useState(-1);
  const [pattern, setPattern] = React.useState("straight");
  const audioCtxRef = React.useRef(null);
  const schedulerRef = React.useRef(null);
  const nextNoteRef = React.useRef(0);
  const beatRef = React.useRef(0);
  const [bpm, setBpm] = React.useState(80);

  const PATTERNS = {
    straight: { nome:"Direto (4/4)", hits:[0,1,2,3], desc:"Palhetada para baixo em cada tempo" },
    synco1:   { nome:"Síncope simples", hits:[0,0.5,1,2,2.5,3], desc:"Antecipações no off-beat" },
    reggae:   { nome:"Reggae (off-beat)", hits:[0.5,1.5,2.5,3.5], desc:"Acento nos tempos fracos" },
    bossa:    { nome:"Bossa nova", hits:[0,0.5,1.5,2,2.5,3,3.5], desc:"Padrão rítmico brasileiro" },
  };

  function getCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }
  function playClick(accent, t) {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = accent ? 1400 : 800;
      g.gain.setValueAtTime(accent ? 0.4 : 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.06);
    } catch(e) {}
  }

  React.useEffect(()=>{
    if (!playing) { clearTimeout(schedulerRef.current); setBeat(-1); beatRef.current = 0; return; }
    try { getCtx(); } catch(e) { return; }
    const ctx = getCtx();
    const beatLen = 60/bpm;
    nextNoteRef.current = ctx.currentTime;
    beatRef.current = 0;
    const sched = () => {
      while (nextNoteRef.current < ctx.currentTime + 0.12) {
        const b = beatRef.current % 4;
        playClick(b === 0, nextNoteRef.current);
        const cap = b;
        const delay = Math.max(0,(nextNoteRef.current - ctx.currentTime)*1000);
        setTimeout(()=>setBeat(cap), delay);
        beatRef.current++;
        nextNoteRef.current += beatLen;
      }
      schedulerRef.current = setTimeout(sched, 50);
    };
    sched();
    return () => { clearTimeout(schedulerRef.current); setBeat(-1); };
  },[playing, bpm]);

  const secoes = ["1. Síncope","2. Contratempos","3. Padrões","4. Exercícios"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #34c98a",background:"rgba(52,201,138,.06)"}}>
        <span style={{color:"#34c98a",fontWeight:700}}>🥁 Ritmo avançado:</span> <em>"Qualquer acorde correto no tempo errado soa errado. Qualquer acorde 'errado' no tempo certo pode funcionar. O ritmo é mais importante que a nota."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="O que é síncope?">
          <p style={tmS.p}><strong style={{color:"#fff"}}>Síncope</strong> é quando uma nota começa em um tempo <strong style={{color:"#fff"}}>fraco</strong> e se prolonga pelo tempo <strong style={{color:"#fff"}}>forte</strong> seguinte, "roubando" o acento natural do compasso.</p>
          <TmTabela
            colunas={["Conceito","Descrição","Exemplo"]}
            linhas={[
              ["Tempo forte","Acento natural do compasso","Tempo 1 em 4/4 — sempre forte"],
              ["Tempo fraco","Tempos 2, 3, 4 em 4/4","Acento menor ou sem acento"],
              ["Off-beat","Meio dos tempos (colcheias)","O '+' entre os tempos: 1 + 2 + 3 + 4 +"],
              ["Síncope","Nota começa no off-beat e cruza o tempo forte","↓ off → tempo forte mantém a nota"],
              ["Antecipação","Nota chega antes do acorde","Palhetada na colcheia antes do tempo"],
            ]}
          />
          <TmDiagrama titulo="Síncope visualizada">{`Tempo:   1    +    2    +    3    +    4    +\nDireto:  ♩         ♩         ♩         ♩\nSíncope: ♩    ♪─────────  ♪─────────\n         acenta no + e sustenta pelo próximo tempo forte`}</TmDiagrama>
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmConceito titulo="Contratempo e antecipação">
          <TmTabela
            colunas={["Técnica","Definição","No louvor","Exemplo"]}
            linhas={[
              ["Contratempo","Acento nos tempos fracos (2 e 4)","Muito no groove funk/gospel","Caixa da bateria no 2 e 4"],
              ["Antecipação","Acorde chega meia batida antes","Cria tensão e energia","[G] tocado no '+' antes do 1"],
              ["Síncope interna","Nota fora do grid dentro de um compasso","Groove e swing","Palhetada cruzando o 3"],
              ["Hemiola","3 batidas contra 2 (3:2)","Gospel, música latina","Acento deslocado em 6/8"],
            ]}
          />
          <TmDica>No violão do louvor gospel: o padrão de baixo/cima mais antecipação é o que cria aquele "balanço" típico. O baixo fica no tempo, a batida de cima antecipa o próximo acorde no "+" do 4.</TmDica>
        </TmConceito>
        <TmConceito titulo="Padrões de palhetada comuns">
          <TmTabela
            colunas={["Padrão","Notação","Estilo","Toque assim"]}
            linhas={[
              ["Básico","↓ ↓ ↓ ↓","Hinos tradicionais","Cada semínima"],
              ["Folk","↓ ↑ ↓ ↑","Pop, folk, balada","Colcheias iguais"],
              ["Reggae","— ↑ — ↑","Reggae, gospel","Só os off-beats"],
              ["Gospel","↓ ↑ ↑ ↓ ↑","Gospel soul","Antecipação no +4"],
              ["Bossa","↓ ↑↑ ↓ ↑↑","Bossa nova","Padrão sincopado típico"],
            ]}
          />
        </TmConceito>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Padrões rítmicos interativos">
          <p style={tmS.p}>Clique em <strong style={{color:"#fff"}}>▶ Iniciar</strong> e observe o metrônomo. Cada padrão mostra onde os acentos caem.</p>
        </TmConceito>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {Object.entries(PATTERNS).map(([k,p])=>(
            <button key={k} onClick={()=>{setPattern(k);setPlaying(false);setBeat(-1);}}
              style={{fontSize:12,padding:"6px 12px",borderRadius:9,border:pattern===k?"1px solid #3fae6b":"1px solid #1d4435",background:pattern===k?"rgba(63,174,107,.15)":"transparent",color:pattern===k?"#3fae6b":"#9fdabb",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:pattern===k?700:400}}>
              {p.nome}
            </button>
          ))}
        </div>
        <div style={tmS.card}>
          <div style={{marginBottom:10}}>
            <div style={{fontWeight:700,color:"#fff",marginBottom:3}}>{PATTERNS[pattern].nome}</div>
            <div style={{fontSize:12,color:"#6fae8a"}}>{PATTERNS[pattern].desc}</div>
          </div>
          {/* Grade visual dos hits */}
          <div style={{display:"flex",gap:3,marginBottom:12,overflowX:"auto"}}>
            {[0,0.5,1,1.5,2,2.5,3,3.5].map(pos=>{
              const isHit = PATTERNS[pattern].hits.includes(pos);
              const isStrong = pos % 1 === 0;
              const isCurrent = beat === Math.floor(pos) && pos % 1 === 0;
              return (
                <div key={pos} style={{
                  width:isStrong?36:28, height:isStrong?36:28,
                  borderRadius:isStrong?"50%":"4px",
                  background:isCurrent?"#3fae6b":isHit?(isStrong?"#7F77DD":"#534AB7"):"#0d0d0d",
                  border:`1px solid ${isStrong?"#7F77DD44":"#1d4435"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,color:isHit?"#fff":"#3d5a4a",flexShrink:0,
                  transition:"background .08s"
                }}>
                  {isStrong?String(Math.floor(pos)+1):"+"}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>setPlaying(p=>!p)} style={{...primaryBtn(),padding:"10px 20px"}}>
              {playing?"⏸ Parar":"▶ Iniciar"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"#6fae8a"}}>BPM:</span>
              <input type="range" min={50} max={160} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{width:80,accentColor:"#3fae6b"}}/>
              <input type="number" min={50} max={160} value={bpm} onChange={e=>setBpm(Math.max(50,Math.min(160,+e.target.value||80)))}
                style={{width:48,padding:"3px 6px",borderRadius:7,border:"1px solid #1d4435",background:"#000",color:"#9fdabb",fontSize:13,fontFamily:"'Montserrat',sans-serif",textAlign:"center"}}/>
            </div>
          </div>
        </div>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Exercícios práticos">
          <p style={tmS.p}><strong style={{color:"#fff"}}>1. Bata no joelho:</strong> enquanto o metrônomo toca em 4/4, bata os tempos 2 e 4 (contratempo). Isso é o que a caixa da bateria faz no estilo gospel.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>2. Cantar e bater:</strong> cante a melodia de uma música enquanto bate o pulso. Identifique onde a melodia cai no off-beat.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>3. Gravação lenta:</strong> toque uma música a 60% do BPM e preste atenção exata no momento de cada palhetada. A câmera lenta revela síncopes que você não percebia fazer.</p>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>Desafio da semana:</strong> escolha uma música que você já toca. Identifique 3 momentos onde a melodia ou palhetada é sincopada. Descreva: "Aqui a nota começa no + do 2 e sustenta pelo 3."</p>
          </TmAplicacao>
        </TmConceito>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 17 — Campo Harmônico Menor Harmônico
// ════════════════════════════════════════════════════════════════
function Mod17_MenorHarmonico() {
  const [root, setRoot] = React.useState(9); // Lá menor
  const [secao, setSecao] = React.useState(0);
  const [selG, setSelG] = React.useState(null);

  // Menor harmônico: igual ao menor natural mas com 7º grau elevado
  const CR_MH = [0,2,3,5,7,8,11]; // i ii° bIII iv V bVI vii°
  const CT_MH = ["m","dim","maj","m","maj","maj","dim"];
  const CMN_MH = [true,true,false,true,false,false,true];
  const CF_MH = ["Tônica","Dominante","Tônica","Subdominante","Dominante","Subdominante","Dominante"];
  const GR_MH = ["i","ii°","♭III","iv","V","♭VI","vii°"];
  const CC_MH = ["#7F77DD","#D85A30","#7F77DD","#1D9E75","#D85A30","#1D9E75","#D85A30"];
  function gNMH(r,i) { return tmENinKey((r+CR_MH[i])%12,r,true)+(CMN_MH[i]?"m":""); }
  const CIVS = {maj:[0,4,7],m:[0,3,7],dim:[0,3,6]};

  const secoes = ["1. O que é","2. Campo","3. Aplicação","4. Comparação"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"O menor harmônico é o 'upgrade' do menor natural. O 7º grau elevado cria o V maior — e é esse V maior que gera aquela cadência de tensão máxima típica dos clímax do louvor."</em>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>

      {secao===0&&<div>
        <TmConceito titulo="Por que o 7º grau é elevado?">
          <TmTabela
            colunas={["","Menor natural","Menor harmônico","Diferença"]}
            linhas={[
              ["Em Lá (Am)","A B C D E F G","A B C D E F G#","G → G# (1 semitom acima)"],
              ["V grau","Em (menor)","E maior","V menor → V maior"],
              ["Sensível","Não existe","G# → A","Cria tensão máxima para resolução"],
              ["7° grau","G natural (♭VII)","G# (VII)","Leva para a oitava com força"],
            ]}
          />
          <TmDica>A nota sensível (7ª elevada) é um semitom abaixo da tônica. Ela "atrai" a tônica com força magnética — por isso o V maior (com a sensível na terça) resolve no i com muito mais intensidade que o Vm.</TmDica>
        </TmConceito>
      </div>}

      {secao===1&&<div>
        <TmKeyPicker value={root} onChange={v=>{setRoot(v);setSelG(null);}} label="Tom menor"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:14}}>
          {GR_MH.map((g,i)=>(
            <button key={g} onClick={()=>setSelG(selG===i?null:i)}
              style={{padding:"8px 4px",borderRadius:10,cursor:"pointer",textAlign:"center",fontFamily:"'Montserrat',sans-serif",background:selG===i?`${CC_MH[i]}33`:"#0d0d0d",border:`1px solid ${selG===i?CC_MH[i]:"#15392b"}`,transition:"all .15s",minWidth:0}}>
              <div style={{fontSize:9,color:CC_MH[i],fontWeight:700}}>{g}</div>
              <div style={{fontSize:"clamp(10px,2.8vw,12px)",color:"#fff",fontWeight:800,lineHeight:1.3}}>{gNMH(root,i)}</div>
              <div style={{fontSize:8,color:"#5d917a"}}>{CT_MH[i]}</div>
            </button>
          ))}
        </div>
        {selG!==null&&(
          <div style={tmS.card}>
            <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:6}}>
              {GR_MH[selG]} — {gNMH(root,selG)} {CT_MH[selG]}
              <span style={{fontSize:12,color:CC_MH[selG],marginLeft:8}}>{CF_MH[selG]}</span>
            </div>
            <TmPiano root={(root+CR_MH[selG])%12} highlight={(CIVS[CT_MH[selG]]||[0,3,7]).map(n=>n%12)} size="sm"/>
          </div>
        )}
        <div style={{overflowX:"auto",marginTop:14}}>
          <table style={tmS.table}>
            <thead><tr>
              <th style={tmS.th}>Grau</th>
              <th style={tmS.th}>Acorde em {tmPTinKey(root,root)} menor</th>
              <th style={tmS.th}>Tipo</th>
              <th style={tmS.th}>Função</th>
            </tr></thead>
            <tbody>{GR_MH.map((g,i)=>(
              <tr key={g} onClick={()=>setSelG(selG===i?null:i)} style={{cursor:"pointer"}}>
                <td style={{...tmS.td,fontWeight:900,color:CC_MH[i],...tmS.mono}}>{g}</td>
                <td style={{...tmS.td,fontWeight:700,color:"#eef5f0"}}>{gNMH(root,i)}</td>
                <td style={{...tmS.td,fontSize:12,...tmS.mono,color:"#6fae8a"}}>{CT_MH[i]}</td>
                <td style={{...tmS.td,fontSize:12,color:CC_MH[i]}}>{CF_MH[i]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>}

      {secao===2&&<div>
        <TmConceito titulo="Cadências do menor harmônico — onde aparece no louvor">
          <TmTabela
            colunas={["Progressão","Acordes em Am","Ocorre em","Por que funciona"]}
            linhas={[
              ["i – V – i","Am – E – Am","Música flamenca, hinos dramáticos","E major tem G# → A (sensível)"],
              ["iv – V – i","Dm – E – Am","Cadência clássica perfeita","Máxima tensão antes do repouso"],
              ["♭VI – V – i","F – E – Am","Louvor contemplativo","Descida dramática para a tônica"],
              ["i – iv – V – i","Am–Dm–E–Am","Hinos litúrgicos, música sacra","Ciclo completo do menor harmônico"],
              ["i – vii° – V – i","Am–G#dim–E–Am","Músicas clássicas, gospel dramático","vii° intensifica a dominante"],
            ]}
          />
        </TmConceito>
        <TmAplicacao>
          <p style={tmS.p}><strong style={{color:"#fff"}}>Experimente:</strong> toque Am – E – Am (em vez de Am – Em – Am). A diferença é drástica. O E maior cria tensão real que resolve na tônica. Isso é o menor harmônico em ação.</p>
        </TmAplicacao>
      </div>}

      {secao===3&&<div>
        <TmConceito titulo="Menor natural vs Menor harmônico — tabela comparativa">
          <TmKeyPicker value={root} onChange={setRoot} label="Tom menor"/>
          <TmTabela
            colunas={["Grau","Menor natural","Menor harmônico","Diferença"]}
            linhas={GR_MH.map((g,i)=>{
              const CR_MN = [0,2,3,5,7,8,10];
              const CMN_MN = [true,true,false,true,true,false,false];
              const natName = tmENinKey((root+CR_MN[i])%12,root,true)+(CMN_MN[i]?"m":"");
              const harName = gNMH(root,i);
              return [g, natName, harName, natName===harName?"igual":"← mudou"];
            })}
          />
        </TmConceito>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 18 — Análise de Músicas Reais de Louvor
// ════════════════════════════════════════════════════════════════
function Mod18_AnaliseMusicas() {
  const [sel, setSel] = React.useState(0);
  const [secao, setSecao] = React.useState(0);

  const MUSICAS = [
    {
      nome:"Reckless Love (Cory Asbury)",
      tom:"E maior", campo:"E F#m G#m A B C#m D#dim",
      estrutura:"Verso → Pré-refrão → Refrão → Ponte",
      progressoes:[
        {secao:"Verso",prog:"E – B – C#m – A", nums:"1 – 5 – 6m – 4", analise:"Progressão I–V–VI–IV. Classic pop. Tom: Mi."},
        {secao:"Refrão",prog:"A – E – B", nums:"4 – 1 – 5", analise:"Subdominante → Tônica → Dominante. Cria tensão que quer resolver."},
        {secao:"Ponte",prog:"A – E – B – C#m", nums:"4 – 1 – 5 – 6m", analise:"A ponte desce do IV para o relativo menor criando emoção extra."},
      ],
      recursos:["Dominante secundária: B7 (V7/VI) antes de C#m","Dinâmica: Breakdown total na ponte antes do clímax","Campo: Todas as notas diatônicas de Mi maior"],
      cor:"#e8554d"
    },
    {
      nome:"Oceans (Hillsong United)",
      tom:"D maior / Si menor", campo:"D Em F#m G A Bm C#dim",
      estrutura:"Verso (íntimo) → Refrão → Ponte (crescimento) → Clímax",
      progressoes:[
        {secao:"Verso",prog:"D – A – Bm – G", nums:"1 – 5 – 6m – 4", analise:"I–V–VI–IV. O verso começa contemplativo, instrumentação mínima."},
        {secao:"Refrão",prog:"G – D – A – Bm", nums:"4 – 1 – 5 – 6m", analise:"Começa na Subdominante — cria sensação de expansão e resposta."},
        {secao:"Ponte",prog:"Bm – G – D – A (repetida)", nums:"6m – 4 – 1 – 5", analise:"Empréstimo do relativo menor para criar drama. Build progressivo."},
      ],
      recursos:["Empréstimo modal: Bm como centro tonal na ponte","Build de textura: piano → guitarra → percussão → bateria completa","Dinâmica: pp no verso, ff no clímax da ponte"],
      cor:"#4f9dde"
    },
    {
      nome:"Quão Grande És Tu (Hino Clássico)",
      tom:"A maior", campo:"A Bm C#m D E F#m G#dim",
      estrutura:"Estrofe → Refrão (hino clássico)",
      progressoes:[
        {secao:"Estrofe",prog:"A – D – A – E – A", nums:"1 – 4 – 1 – 5 – 1", analise:"I–IV–I–V–I. Cadência clássica completa. Simples e poderoso."},
        {secao:"Refrão",prog:"A – D – A – E7 – A", nums:"1 – 4 – 1 – V7 – 1", analise:"E7 (dominante com 7ª) intensifica a resolução no I final."},
      ],
      recursos:["Cadência autêntica perfeita (V7–I) no final de cada frase","Estrutura de hino: 4 linhas, AABA","Harmonia diatônica pura — sem empréstimos ou dominantes secundárias"],
      cor:"#e0b341"
    },
  ];

  const m = MUSICAS[sel];
  const secoes = ["Progressões","Recursos","Aplicação"];
  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16,borderLeft:"3px solid #9b6ef0",background:"rgba(155,110,240,.06)"}}>
        <span style={{color:"#9b6ef0",fontWeight:700}}>🔍 Análise:</span> <em>"Não existe melhor professor do que a música que você já conhece. Analisar músicas reais conecta a teoria ao que seus ouvidos já sabem."</em>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {MUSICAS.map((mu,i)=>(
          <button key={i} onClick={()=>{setSel(i);setSecao(0);}}
            style={{padding:"8px 14px",borderRadius:10,border:sel===i?`1px solid ${mu.cor}`:"1px solid #15392b",background:sel===i?`${mu.cor}18`:"#111",color:sel===i?mu.cor:"#9fdabb",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:sel===i?700:400,transition:"all .15s"}}>
            {mu.nome.split(" (")[0]}
          </button>
        ))}
      </div>
      <div style={{background:`${m.cor}18`,border:`1px solid ${m.cor}33`,borderRadius:14,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontWeight:800,color:"#fff",fontSize:15,marginBottom:4}}>{m.nome}</div>
        <div style={{fontSize:12,color:m.cor,marginBottom:6}}>Tom: {m.tom} · Campo: {m.campo}</div>
        <div style={{fontSize:12,color:"#9fdabb"}}>Estrutura: {m.estrutura}</div>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4,marginBottom:16,scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {secoes.map((s,i)=><button key={i} onClick={()=>setSecao(i)} style={{fontSize:12,padding:"6px 13px",borderRadius:20,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:secao===i?700:400,background:secao===i?"#3fae6b":"#000",color:secao===i?"#0d3d28":"#6fae8a",border:secao===i?"1px solid #2f9d63":"1px solid #1d4435",whiteSpace:"nowrap",transition:"all .15s",minHeight:32,lineHeight:1}}>{s}</button>)}
      </div>
      {secao===0&&<div>
        {m.progressoes.map((p,i)=>(
          <div key={i} style={{...tmS.card,marginBottom:10}}>
            <div style={{fontWeight:700,color:m.cor,fontSize:12,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{p.secao}</div>
            <div style={{...tmS.mono,fontSize:16,color:"#fff",fontWeight:800,marginBottom:4}}>{p.prog}</div>
            <div style={{...tmS.mono,fontSize:12,color:"#9b6ef0",marginBottom:8}}>{p.nums}</div>
            <p style={tmS.p}>{p.analise}</p>
          </div>
        ))}
      </div>}
      {secao===1&&<div>
        <TmConceito titulo="Recursos harmônicos identificados">
          {m.recursos.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
              <span style={{color:m.cor,fontWeight:700,flexShrink:0}}>→</span>
              <span style={{fontSize:13,color:"#9fdabb",lineHeight:1.6}}>{r}</span>
            </div>
          ))}
        </TmConceito>
      </div>}
      {secao===2&&<div>
        <TmConceito titulo="Como aplicar esta análise ao seu ministério">
          <p style={tmS.p}><strong style={{color:"#fff"}}>1. Encontre a tonalidade:</strong> qual é o acorde de repouso da música? Esse é o I grau.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>2. Numere os acordes:</strong> com o campo harmônico em mãos, identifique o grau de cada acorde da progressão.</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>3. Identifique os recurso especiais:</strong> algum acorde não pertence ao campo? Qual recurso avançado é esse?</p>
          <p style={tmS.p}><strong style={{color:"#fff"}}>4. Anote no IPBCharts:</strong> use o campo "Observações" do repertório para registrar suas descobertas.</p>
          <TmAplicacao>
            <p style={tmS.p}><strong style={{color:"#fff"}}>Exercício da semana:</strong> escolha uma música que seu grupo vai tocar. Faça a análise completa: tom, campo harmônico, progressão por seção, recursos especiais. Compartilhe a análise com a equipe no ensaio.</p>
          </TmAplicacao>
        </TmConceito>
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MÓDULO 19 — Glossário e Revisão
// ════════════════════════════════════════════════════════════════
function Mod19_Glossario() {
  const [busca, setBusca] = React.useState("");
  const [sel, setSel] = React.useState(null);

  const TERMOS = [
    {t:"Acorde",d:"Combinação de 3+ notas tocadas simultaneamente. Tipos: maior, menor, diminuto, aumentado, 7ª, etc.",mod:"05"},
    {t:"Acorde de passagem",d:"Acorde não diatônico usado para conectar dois acordes do campo, geralmente por movimento cromático.",mod:"09"},
    {t:"Antecipação",d:"Quando um acorde ou nota chega uma colcheia antes do tempo esperado, criando tensão rítmica.",mod:"16"},
    {t:"BPM",d:"Batidas por minuto — medida de velocidade do pulso musical. 60 BPM = 1 batida por segundo.",mod:"02"},
    {t:"Cadência",d:"Fechamento de uma frase musical. Tipos: autêntica (V→I), plagal (IV→I), deceptiva (V→VI).",mod:"07"},
    {t:"Cadência plagal",d:"IV→I. A cadência do 'Amém' — suave e devocional. Muito usada no final de hinos.",mod:"07"},
    {t:"Campo harmônico",d:"Conjunto dos 7 acordes formados pelas notas de uma escala. Cada acorde tem uma função tonal.",mod:"06"},
    {t:"CAGED",d:"Sistema de 5 formas de acorde no violão (C A G E D) que se repetem pelo braço inteiro.",mod:"12"},
    {t:"Contratempo",d:"Acento nos tempos fracos do compasso (2 e 4 em 4/4). Base do groove funk e gospel.",mod:"16"},
    {t:"Dominante secundária",d:"Acorde V7 aplicado a um grau que não é a tônica. Ex: A7 antes de Dm (V/II) em Dó maior.",mod:"09"},
    {t:"Ear training",d:"Treinamento auditivo — capacidade de identificar intervalos, acordes e progressões de ouvido.",mod:"11"},
    {t:"Empréstimo modal",d:"Acorde importado da tonalidade paralela (maior↔menor) para colorir a harmonia sem modular.",mod:"09"},
    {t:"Enarmonia",d:"Duas notas com o mesmo som mas nomes diferentes. Ex: C# = Db. Depende da tonalidade.",mod:"01"},
    {t:"Escala pentatônica",d:"Escala de 5 notas. Pentatônica maior: 1–2–3–5–6. Menor: 1–♭3–4–5–♭7. Nenhuma nota 'errada'.",mod:"04"},
    {t:"Fermata",d:"Símbolo (𝄐) que indica que a nota ou pausa deve ser sustentada por tempo indeterminado.",mod:"02"},
    {t:"Fórmula de compasso",d:"Fração que indica tempos por compasso (numerador) e figura de referência (denominador).",mod:"02"},
    {t:"Grau",d:"Posição de um acorde no campo harmônico. Numerado de I a VII. I=tônica, V=dominante.",mod:"06"},
    {t:"Hemiola",d:"Padrão rítmico onde 3 notas de valor duplo substituem 2 notas de valor triplo (3:2).",mod:"16"},
    {t:"Intervalo",d:"Distância entre duas notas, medida em semitons. De uníssono (0) à oitava (12 semitons).",mod:"03"},
    {t:"Inversão (acorde)",d:"Quando a nota do baixo não é a fundamental. Ex: C/E = acorde de Dó com Mi no baixo.",mod:"05"},
    {t:"Inversão (intervalo)",d:"Inverter um intervalo = colocar a nota de baixo uma oitava acima. Fórmula: 9 - número original.",mod:"03"},
    {t:"Modo Mixolídio",d:"Escala maior com 7ª menor. Muito usado no gospel rock (progressão I–♭VII–IV).",mod:"08"},
    {t:"Modulação",d:"Mudança de tonalidade dentro da música. Cria sensação de elevação ou renovação.",mod:"09"},
    {t:"Nashville Number System",d:"Sistema de cifragem por graus (números) em vez de acordes. 1-4-5-1 em qualquer tom.",mod:"15"},
    {t:"Off-beat",d:"O + entre os tempos do compasso (colcheias). Ex: em 4/4: 1 + 2 + 3 + 4 + ←",mod:"16"},
    {t:"Pestana",d:"Técnica do violão onde o indicador pressiona todas as cordas em uma casa, como um capo móvel.",mod:"12"},
    {t:"Pulso",d:"Batida regular e constante da música — o que você marca batendo o pé. BPM mede sua velocidade.",mod:"02"},
    {t:"Rearmonização",d:"Substituir acordes por outros mais ricos harmonicamente. Ex: C simples → Cmaj7 → Am/C.",mod:"09"},
    {t:"Semitom",d:"A menor distância entre duas notas na música ocidental. C → C# = 1 semitom.",mod:"01"},
    {t:"Sensível",d:"A 7ª nota de uma escala maior (si em Dó maior). Está a 1 semitom da tônica e cria forte tensão.",mod:"17"},
    {t:"Síncope",d:"Nota que começa em tempo fraco e sustenta pelo tempo forte seguinte, deslocando o acento.",mod:"16"},
    {t:"Subdominante",d:"Função harmônica dos graus II e IV. Cria movimento, tensão suave, prepara a dominante.",mod:"06"},
    {t:"Substituição de trítono",d:"Substituir o V7 pelo acorde a 6 semitons de distância. Mesmo trítono, baixo cromático.",mod:"09"},
    {t:"Tônica",d:"Função de repouso. Graus I, III e VI. O ponto de chegada e partida da harmonia.",mod:"06"},
    {t:"Tom (whl. tone)",d:"Intervalo de 2 semitons. C → D = 1 tom. Componente básico da fórmula de escalas.",mod:"03"},
    {t:"Trítono",d:"Intervalo de 6 semitons. A máxima dissonância — presente no V7 como agente de tensão e resolução.",mod:"03"},
    {t:"Voicing",d:"A distribuição específica das notas de um acorde entre as vozes. Posição aberta vs fechada.",mod:"13"},
  ].sort((a,b)=>a.t.localeCompare(b.t));

  const filtered = busca.trim()
    ? TERMOS.filter(t => t.t.toLowerCase().includes(busca.toLowerCase()) || t.d.toLowerCase().includes(busca.toLowerCase()))
    : TERMOS;

  return (
    <div>
      <div style={{...tmS.hl,marginBottom:16}}>
        <span style={{color:"#3fae6b",fontWeight:700}}>Professor:</span> <em>"O glossário é sua referência rápida. Quando ouvir um termo desconhecido no ensaio ou num tutorial, procure aqui primeiro — e depois vá ao módulo de origem para o contexto completo."</em>
      </div>
      <div style={{position:"relative",marginBottom:16}}>
        <Search size={16} style={{position:"absolute",left:12,top:14,color:"#5d917a"}}/>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar termo..." style={inputStyle({paddingLeft:40})}/>
      </div>
      <div style={{fontSize:11,color:"#5d917a",marginBottom:12}}>{filtered.length} termo{filtered.length!==1?"s":""}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {filtered.map((termo,i)=>(
          <div key={termo.t} style={{...tmS.card,cursor:"pointer",borderLeft:`3px solid ${sel===i?"#3fae6b":"#1d4435"}`}}
            onClick={()=>setSel(sel===i?null:i)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{fontWeight:700,color:"#fff",fontSize:14}}>{termo.t}</span>
              <span style={{fontSize:10,color:"#3fae6b",background:"rgba(63,174,107,.12)",padding:"2px 7px",borderRadius:6,flexShrink:0}}>Mod {termo.mod}</span>
            </div>
            {sel===i&&<p style={{...tmS.p,marginTop:8,marginBottom:0}}>{termo.d}</p>}
          </div>
        ))}
      </div>
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
    {prog:"G | Em | C | D",key:"G",answer:["I","VI","IV","V"],expl:"I–VI–IV–V. G=tônica, Em=relativo/tônica, C=subdominante, D=dominante. Progressão dos anos 60."},
    {prog:"Am | F | C | G",key:"C",answer:["VI","IV","I","V"],expl:"VI–IV–I–V em Dó. Começa no relativo menor — padrão muito usado no louvor contemporâneo."},
    {prog:"C | G | Am | F",key:"C",answer:["I","V","VI","IV"],expl:"I–V–VI–IV. A progressão mais gravada da história. Tônica→Dominante→Relativo→Subdominante."},
    {prog:"D | A | Bm | G",key:"D",answer:["I","V","VI","IV"],expl:"I–V–VI–IV em Ré. Mesma progressão, tom diferente. D=I, A=V, Bm=VI, G=IV."},
    {prog:"Em | C | G | D",key:"G",answer:["VI","IV","I","V"],expl:"VI–IV–I–V em Sol. Em=VI, C=IV, G=I, D=V. Tom do relativo menor para o maior."},
    {prog:"G | C | D | G",key:"G",answer:["I","IV","V","I"],expl:"I–IV–V–I. Cadência autêntica completa. O núcleo da harmonia tonal e dos hinos congregacionais."},
    {prog:"Am | Dm | G | C",key:"C",answer:["VI","II","V","I"],expl:"VI–II–V–I em Dó. Cada acorde cai uma quarta abaixo — movimento cadencial muito natural."},
    {prog:"E | A | B | E",key:"E",answer:["I","IV","V","I"],expl:"I–IV–V–I em Mi. Tom de guitarra por excelência — E A B são os acordes mais fáceis do violão."},
    {prog:"C | Am | F | G",key:"C",answer:["I","VI","IV","V"],expl:"I–VI–IV–V. Progressão da música popular desde os anos 50. Doo-wop até o louvor contemporâneo."},
    {prog:"Bm | G | D | A",key:"D",answer:["VI","IV","I","V"],expl:"VI–IV–I–V em Ré. Começa no Bm — cria clima de adoração contemplativa antes de resolver."},
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
        <p style={tmS.p}>A <strong style={{color:"#fff"}}>cifra americana</strong> usa C D E F G A B (Dó Ré Mi Fá Sol Lá Si). Sufixos indicam o tipo. O músico consciente vai além: identifica a função de cada acorde na progressão.</p>
        <TmTabela
          colunas={["Letra","Nota PT","Sustenido (#)","Bemol (b)"]}
          linhas={[
            ["C","Dó","C# = Dó#","Cb = Dób"],
            ["D","Ré","D# = Ré#","Db = Réb"],
            ["E","Mi","—","Eb = Mib"],
            ["F","Fá","F# = Fá#","—"],
            ["G","Sol","G# = Sol#","Gb = Solb"],
            ["A","Lá","A# = Lá#","Ab = Láb"],
            ["B","Si","—","Bb = Sib"],
          ]}
        />
        <TmTabela
          colunas={["Sufixo","Nome","Fórmula","Exemplo em C"]}
          linhas={[
            ["(nada)","Maior","1–3–5","C = Dó Mi Sol"],
            ["m","Menor","1–♭3–5","Cm = Dó Mib Sol"],
            ["7","Dominante 7ª","1–3–5–♭7","C7 = Dó Mi Sol Sib"],
            ["maj7","Maior 7ª maior","1–3–5–7","Cmaj7 = Dó Mi Sol Si"],
            ["m7","Menor 7ª","1–♭3–5–♭7","Cm7 = Dó Mib Sol Sib"],
            ["dim","Diminuto","1–♭3–♭5","Cdim = Dó Mib Solb"],
            ["aug","Aumentado","1–3–#5","Caug = Dó Mi Sol#"],
            ["sus4","Suspenso de 4ª","1–4–5","Csus4 = Dó Fá Sol"],
            ["add9","Com 9ª adicionada","1–3–5–9","Cadd9 = Dó Mi Sol Ré"],
            ["/X","Nota no baixo","acorde/baixo","G/B = Sol, Si no baixo"],
          ]}
        />
        <TmConceito titulo="Como ler acordes na cifra">
          <p style={tmS.p}>Na cifra, os acordes aparecem <strong style={{color:"#fff"}}>imediatamente antes da sílaba</strong> onde o troco começa:</p>
          <div style={{background:"#061410",border:"1px solid #15392b",borderRadius:10,padding:"14px 16px",fontFamily:"'Space Mono',monospace",fontSize:"clamp(13px,3.4vw,15px)",color:"#7fd8a4",lineHeight:2.4,letterSpacing:0}}>
            <div><span style={{color:"#e0b341",fontWeight:700}}>[G]</span>Quan-do <span style={{color:"#e0b341",fontWeight:700}}>[Em]</span>che-gar <span style={{color:"#e0b341",fontWeight:700}}>[C]</span>o di-<span style={{color:"#e0b341",fontWeight:700}}>[D]</span>a</div>
            <div style={{fontSize:11,color:"#5d917a",marginTop:4}}>↑ Cada acorde entra exatamente ANTES desta sílaba</div>
          </div>
        </TmConceito>
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
        <div style={{textAlign:"center",fontSize:34,...tmS.mono,color:"#3fae6b",fontWeight:800,padding:14,background:"#0d0d0d",borderRadius:12,marginBottom:14}}>{SIMS[qI].c}</div>
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


// ── Vídeos por módulo (carregados do Supabase, editáveis pelo prof.gabrielcorrea) ──
function TmModVideo({ url, title }) {
  if (!url) return null;
  const ytId = (() => {
    try {
      const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
      return m ? m[1] : null;
    } catch(e) { return null; }
  })();
  if (!ytId) return null;
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,color:"#5d917a",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        <Youtube size={13} color="#e8554d"/> {title||"Vídeo de apoio"}
      </div>
      <div style={{position:"relative",paddingBottom:"42%",borderRadius:12,overflow:"hidden",border:"1px solid #1d4435",maxWidth:480}}>
        <iframe src={`https://www.youtube.com/embed/${ytId}`} title={title||"Vídeo"}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
      </div>
    </div>
  );
}

// Editor de vídeos de módulo (só prof.gabrielcorrea@gmail.com)
function TmVideoEditor({ modId, videos, onSave, onClose, saving, saveMsg }) {
  const [list, setList] = React.useState(videos || []);
  const [newUrl, setNewUrl] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const add = () => {
    if (!newUrl.trim()) return;
    setList(l => [...l, { url: newUrl.trim(), title: newTitle.trim()||"Vídeo de apoio" }]);
    setNewUrl(""); setNewTitle("");
  };
  const remove = i => setList(l => l.filter((_,j)=>j!==i));
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:6000,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,background:"#111",border:"1px solid #2f7d57",borderRadius:16,padding:22,fontFamily:"'Montserrat',sans-serif"}}>
        <div style={{fontWeight:700,color:"#fff",fontSize:15,marginBottom:14}}>🎬 Vídeos — Módulo {modId}</div>
        <div style={{marginBottom:14}}>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} style={inputStyle({marginBottom:8})} placeholder="Título do vídeo (opcional)"/>
          <div style={{display:"flex",gap:8}}>
            <input value={newUrl} onChange={e=>setNewUrl(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()}
              style={{...inputStyle(),flex:1}} placeholder="URL do YouTube"/>
            <button onClick={add} style={{...primaryBtn(),padding:"10px 16px",fontSize:13}}>+</button>
          </div>
        </div>
        {list.length===0&&<p style={{fontSize:12,color:"#5d917a",textAlign:"center",margin:"0 0 12px"}}>Nenhum vídeo adicionado ainda.</p>}
        {list.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#0d0d0d",border:"1px solid #15392b",borderRadius:9,padding:"8px 12px",marginBottom:7}}>
            <Youtube size={14} color="#e8554d" style={{flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</div>
              <div style={{fontSize:10,color:"#5d917a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.url}</div>
            </div>
            <button onClick={()=>remove(i)} style={{background:"none",border:"none",color:"#e8554d",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
          </div>
        ))}
        {saveMsg&&(
          <div style={{fontSize:12,padding:"8px 12px",borderRadius:8,marginBottom:10,
            background:saveMsg.ok?"rgba(63,174,107,.12)":"rgba(232,85,77,.12)",
            color:saveMsg.ok?"#3fae6b":"#e8554d",border:`1px solid ${saveMsg.ok?"#1d6b4644":"#e8554d44"}`}}>
            {saveMsg.ok?"✓ ":""}{saveMsg.msg}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={()=>onSave(list)} disabled={saving}
            style={{...primaryBtn(),flex:1,justifyContent:"center",fontSize:13,opacity:saving?.6:1}}>
            <Save size={14}/> {saving?"Salvando…":"Salvar"}
          </button>
          <button onClick={onClose} style={ghostBtn()}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}


function TeoriaMusicaView({ onBack }) {
  const [curMod, setCurMod] = React.useState(null);
  const [prog, setProg]     = React.useState({});
  const [userId, setUserId] = React.useState(null);
  const [userEmail, setUserEmail] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [globalKey, setGlobalKey] = React.useState(0);
  const [fontScale, setFontScale] = React.useState(1.0);
  // Vídeos por módulo (carregados do Supabase, editáveis pelo editor)
  const [modVideos, setModVideos] = React.useState({}); // { "01": [{url,title},...], ... }
  const [videoEditorOpen, setVideoEditorOpen] = React.useState(null); // modId ou null
  const isVideoEditor = userEmail === "prof.gabrielcorrea@gmail.com";

  // Obtém user_id e email da sessão Supabase
  React.useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if(data.session?.user?.id) { setUserId(data.session.user.id); setUserEmail(data.session.user.email||null); }
    });
    const {data:sub}=supabase.auth.onAuthStateChange((_,s)=>{
      setUserId(s?.user?.id||null); setUserEmail(s?.user?.email||null);
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

  // Carrega vídeos dos módulos — público, roda uma vez na montagem
  React.useEffect(()=>{
    supabase.from("user_prefs")
      .select("teoria_prog")
      .eq("song_id","__mod_videos__")
      .limit(1)
      .maybeSingle()
      .then(({data})=>{
        if(data?.teoria_prog){
          try{ setModVideos(JSON.parse(data.teoria_prog)||{}); }catch(e){}
        }
      });
  },[]);

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

  const [videoSaving, setVideoSaving] = React.useState(false);
  const [videoSaveMsg, setVideoSaveMsg] = React.useState(null);

  async function saveModVideos(videos){
    if (!userId) { setVideoSaveMsg({ok:false,msg:"Usuário não autenticado."}); return; }
    setVideoSaving(true); setVideoSaveMsg(null);
    try{
      // Salva com o userId real do editor — song_id especial identifica o registro
      const { error } = await supabase.from("user_prefs").upsert({
        user_id: userId,
        song_id: "__mod_videos__",
        semitones: 0, capo: 0,
        teoria_prog: JSON.stringify(videos),
      },{onConflict:"user_id,song_id"});
      if (error) throw error;
      setVideoSaveMsg({ok:true,msg:"Vídeos salvos!"});
      setTimeout(()=>setVideoSaveMsg(null), 3000);
    } catch(e) {
      setVideoSaveMsg({ok:false,msg:"Erro: " + (e.message||"falha ao salvar")});
    }
    setVideoSaving(false);
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
    {id:"01",nivel:"Fundamentos",  cor:"#34c98a",icon:"♩",tempo:"~10 min",titulo:"O Som e a Nota",              sub:"Som · Frequência · Altura · Timbre · As 12 notas · Enarmonia",         comp:<Mod01_Som/>},
    {id:"02",nivel:"Fundamentos",  cor:"#34c98a",icon:"⏱",tempo:"~15 min",titulo:"Ritmo e Compasso",            sub:"Pulso · BPM · Figuras rítmicas · Compassos · Metrônomo interativo",     comp:<Mod02_Ritmo/>},
    {id:"03",tempo:"~12 min",nivel:"Básico",       cor:"#4f9dde",icon:"↔",titulo:"Intervalos",                  sub:"Uníssono à oitava · Melódico/harmônico · Inversão · DNA da harmonia",   comp:<Mod03_Intervalos globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"04",tempo:"~15 min",nivel:"Básico",       cor:"#4f9dde",icon:"𝄞",titulo:"Escalas",                     sub:"Maior · Menores · Pentatônica · Blues · Cromática · Modos futuros",     comp:<Mod04_Escalas globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"05",tempo:"~20 min",nivel:"Intermediário",cor:"#e0b341",icon:"🎹",titulo:"Acordes",                     sub:"Tríades · Tétrades · Inversões · Extensões · Análise de acordes",       comp:<Mod05_Acordes globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"06",tempo:"~15 min",nivel:"Intermediário",cor:"#e0b341",icon:"#",titulo:"Campo Harmônico",             sub:"Graus I–VII · Tônica · Subdominante · Dominante · Cadências",           comp:<Mod06_Tonalidade globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"07",tempo:"~12 min",nivel:"Intermediário",cor:"#e0b341",icon:"⟳",titulo:"Progressões e Cadências",     sub:"Progressões do louvor · Cadências · Reconhecimento auditivo",           comp:<Mod07_Progressoes globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"08",tempo:"~15 min",nivel:"Avançado",     cor:"#e8554d",icon:"◎",titulo:"Modos Gregos",                sub:"7 modos · Caráter sonoro · Mixolídio no gospel · Quando usar cada um",  comp:<Mod08_Modos globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"09",tempo:"~18 min",nivel:"Avançado",     cor:"#e8554d",icon:"★",titulo:"Harmonia Avançada",           sub:"Dom. secundária · Empréstimo modal · Modulação · Rearmonização",        comp:<Mod09_HarmoniaAvancada globalKey={globalKey} setGlobalKey={setGlobalKey}/>},
    {id:"10",tempo:"~10 min",nivel:"Prático",      cor:"#9b6ef0",icon:"≡",titulo:"Leitura e Análise de Cifra",  sub:"Sistema cifrado · Todos os sufixos · Análise harmônica completa",       comp:<Mod10_Cifra/>},
    {id:"11",tempo:"~20 min",nivel:"Auditivo",      cor:"#3fb6c9",icon:"👂",titulo:"Ear Training",                  sub:"Intervalos · Acordes · Progressões · Treinamento auditivo real",         comp:<Mod11_EarTraining/>},
    {id:"12",tempo:"~20 min",nivel:"Violão",        cor:"#f0883e",icon:"🎸",titulo:"Violão: Formas e CAGED",        sub:"Acordes abertos · Pestana · Sistema CAGED · Notas no braço",             comp:<Mod12_Violao/>},
    {id:"13",tempo:"~15 min",nivel:"Vocal",         cor:"#ec6aa8",icon:"🎤",titulo:"Harmonia Vocal e Voicing",      sub:"Tessituras · Voicing · Posição aberta/fechada · Movimento de vozes",     comp:<Mod13_HarmoniaVocal/>},
    {id:"14",tempo:"~12 min",nivel:"Vocal",         cor:"#ec6aa8",icon:"🎚",titulo:"Arranjo, Dinâmica e Textura",   sub:"Estrutura · Dinâmica · Build/Breakdown · Camadas instrumentais",         comp:<Mod14_Arranjo/>},
    {id:"15",tempo:"~15 min",nivel:"Avançado",      cor:"#e8554d",icon:"🔢",titulo:"Nashville Number System",       sub:"Graus em números · Transposição rápida · Prática de cifragem",           comp:<Mod15_Nashville/>},
    {id:"16",tempo:"~12 min",nivel:"Ritmo",         cor:"#34c98a",icon:"🥁",titulo:"Síncope e Ritmo Avançado",      sub:"Síncope · Contratempo · Antecipação · Padrões de palhetada",             comp:<Mod16_Sincope/>},
    {id:"17",tempo:"~12 min",nivel:"Avançado",      cor:"#e8554d",icon:"♭",titulo:"Campo Harmônico Menor Harmônico",sub:"7º grau elevado · V maior · Sensível · Cadências dramáticas",            comp:<Mod17_MenorHarmonico/>},
    {id:"18",tempo:"~15 min",nivel:"Prático",       cor:"#9b6ef0",icon:"🔍",titulo:"Análise de Músicas Reais",       sub:"Reckless Love · Oceans · Quão Grande És Tu · Recursos identificados",    comp:<Mod18_AnaliseMusicas/>},
    {id:"19",tempo:"ref.",   nivel:"Referência",    cor:"#9aa3ad",icon:"📚",titulo:"Glossário",                      sub:"Todos os termos em ordem alfabética · Com busca · Indexado por módulo",  comp:<Mod19_Glossario/>},
  ];

  const NIVEIS=["Fundamentos","Básico","Intermediário","Avançado","Prático","Auditivo","Violão","Vocal","Ritmo","Referência"];
  const totalDone=Object.values(prog).filter(Boolean).length;
  const curIdx=curMod?MODS.findIndex(m=>m.id===curMod):-1;

  // ── Visualização de um módulo ──
  if(curMod){
    const mod=MODS[curIdx];
    if(!mod)return null;
    return(
      <div style={{maxWidth:720,margin:"0 auto",padding:"16px 12px 100px",fontFamily:"'Montserrat',sans-serif"}}>
        {/* Botão flutuante de voltar — visível ao rolar no celular */}
        <div style={{position:"fixed",bottom:24,right:16,zIndex:300}}>
          <button onClick={()=>{markDone(curMod);setCurMod(null);window.scrollTo(0,0);}}
            style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:24,
              background:"#111",border:"1px solid #2f7d57",color:"#3fae6b",
              fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:12.5,
              boxShadow:"0 4px 16px rgba(0,0,0,.5)",cursor:"pointer"}}>
            <ArrowLeft size={14}/> Módulos
          </button>
        </div>
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
            <div style={{fontSize:11,color:mod.cor,marginTop:3,paddingLeft:13,fontWeight:600,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <span>Módulo {mod.id} · {mod.nivel}</span>
              {globalKey!==undefined&&<span style={{color:"#5d917a",fontWeight:500}}>
                Tom: <strong style={{color:"#9fdabb"}}>{['Dó','Réb','Ré','Mib','Mi','Fá','Solb','Sol','Láb','Lá','Sib','Si'][globalKey]}</strong>
              </span>}
              {saving&&<span style={{color:"#5d917a"}}>salvando...</span>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
            {prog[curMod]
              ?<button onClick={()=>markUndone(curMod)} title="Clique para desmarcar"
                  style={{fontSize:11,padding:"5px 10px",borderRadius:8,border:"1px solid #3fae6b44",background:"rgba(63,174,107,.15)",color:"#3fae6b",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",display:"flex",alignItems:"center",gap:4}}>
                  ✓ Concluído <span style={{fontSize:9,opacity:.7}}>(desfazer)</span>
                </button>
              :<button onClick={()=>markDone(curMod)} style={{fontSize:11,padding:"5px 10px",borderRadius:8,border:`1px solid ${mod.cor}44`,background:"transparent",color:mod.cor,cursor:"pointer",fontFamily:"'Montserrat',sans-serif"}}>Marcar feito</button>
            }
            {isVideoEditor&&(
              <button onClick={()=>setVideoEditorOpen(curMod)}
                style={{fontSize:10,padding:"4px 9px",borderRadius:7,border:"1px solid #e8554d44",background:"rgba(232,85,77,.08)",color:"#e8554d",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",display:"flex",alignItems:"center",gap:4}}>
                <Youtube size={11}/> Vídeos
              </button>
            )}
            {/* Controle de fonte */}
            <div style={{display:"flex",alignItems:"center",gap:4,background:"#0d0d0d",border:"1px solid #1d4435",borderRadius:8,padding:"2px 6px"}}>
              <button onClick={()=>setFontScale(f=>Math.max(0.8,+(f-0.1).toFixed(1)))} style={{background:"none",border:"none",color:"#6fae8a",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>A</button>
              <button onClick={()=>setFontScale(f=>Math.min(1.5,+(f+0.1).toFixed(1)))} style={{background:"none",border:"none",color:"#9fdabb",cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 2px",fontWeight:700}}>A</button>
            </div>
          </div>
        </div>
        {/* Vídeos do módulo (se houver) */}
        {(modVideos[curMod]||[]).map((v,i)=>(
          <TmModVideo key={i} url={v.url} title={v.title}/>
        ))}
        {/* Conteúdo */}
        <div key={curMod} style={{fontSize:`calc(clamp(12px,3.2vw,14px) * ${fontScale})`,lineHeight:1.7,animation:"tmSlideIn .22s ease"}}>
          {mod.comp}
        </div>
        {/* Modal editor de vídeos (só pro editor) */}
        {videoEditorOpen===curMod&&(
          <TmVideoEditor
            modId={curMod}
            videos={modVideos[curMod]||[]}
            saving={videoSaving}
            saveMsg={videoSaveMsg}
            onSave={async(list)=>{
              const next={...modVideos,[curMod]:list};
              setModVideos(next);
              await saveModVideos(next);
              setVideoEditorOpen(null);
            }}
            onClose={()=>setVideoEditorOpen(null)}
          />
        )}
        {/* Conexão com próximo módulo */}
        {curIdx < MODS.length-1 && (
          <div style={{marginTop:20,padding:"12px 14px",background:"rgba(63,174,107,.06)",border:"1px solid #1d443522",borderRadius:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#3fae6b",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>
              Próximo módulo
            </div>
            <div style={{fontSize:13,color:"#9fdabb"}}>
              <strong style={{color:"#fff"}}>{MODS[curIdx+1].titulo}</strong> — {MODS[curIdx+1].sub.split(" · ")[0]}
            </div>
          </div>
        )}
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
    <div style={{maxWidth:720,margin:"0 auto",padding:"20px 12px 80px",fontFamily:"'Montserrat',sans-serif",animation:"tmFadeIn .2s ease"}}>
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
      {/* Barra de progresso com legenda */}
      <div style={{marginBottom:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:11,color:"#5d917a"}}>
            {totalDone===0?"Por onde começar: Módulo 1 — O Som e a Nota":
             totalDone===MODS.length?"🎉 Curso completo! Revise quando quiser.":
             `Continue do Módulo ${MODS.find(m=>!prog[m.id])?.id||"01"}`}
          </span>
          <span style={{fontSize:11,color:"#5d917a"}}>{Math.round((totalDone/MODS.length)*100)}%</span>
        </div>
        <div style={{height:6,background:"#111",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#34c98a,#9b6ef0)",
            width:`${(totalDone/MODS.length)*100}%`,borderRadius:4,transition:"width .5s ease"}}/>
        </div>
      </div>
      {/* Metodologia */}
      <div style={{background:"#000",border:"1px solid #1d4435",borderRadius:13,padding:"14px 16px",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:13,color:"#3fae6b",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Metodologia do Curso</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,200px),1fr))",gap:8}}>
          {[
            {cor:"#34c98a",icon:"①",titulo:"Entendimento",desc:"Conceito, porquê existe, onde se usa e como se relaciona com o todo."},
            {cor:"#4f9dde",icon:"②",titulo:"Visualização",desc:"Diagramas, tabelas, piano interativo, esquemas e analogias."},
            {cor:"#e0b341",icon:"③",titulo:"Aplicação",desc:"Exemplos reais, músicas do louvor, exercícios no violão."},
            {cor:"#e8554d",icon:"④",titulo:"Fixação",desc:"Perguntas, V/F, exercícios interativos e revisão espaçada."},
          ].map(p=><div key={p.titulo} style={{background:"#0d0d0d",border:`1px solid ${p.cor}33`,borderRadius:10,padding:"10px 12px"}}>
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
          <div key={nivel} style={{marginBottom:22,background:nivelCor+"06",borderRadius:14,padding:"14px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:nivelCor,textTransform:"uppercase",letterSpacing:".07em"}}>{nivel}</span>
              <div style={{flex:1,height:1,background:"#15392b"}}/>
              <span style={{fontSize:11,color:"#5d917a"}}>{nivelDone}/{mods.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7,alignItems:"stretch"}}>
              {mods.map(mod=>{
                const done=!!prog[mod.id];
                return(
                  <button key={mod.id} onClick={()=>{setCurMod(mod.id);window.scrollTo(0,0);}}
                    style={{display:"flex",alignItems:"center",gap:12,
                      background:done?`${mod.cor}0d`:"#111",
                      border:`1px solid ${done?mod.cor+"44":"#15392b"}`,
                      borderLeft:`4px solid ${mod.cor}`,
                      borderRadius:12,
                      padding:"13px 14px",cursor:"pointer",textAlign:"left",
                      fontFamily:"'Montserrat',sans-serif",transition:"all .18s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=done?`${mod.cor}18`:"#1a1a1a"}
                    onMouseLeave={e=>e.currentTarget.style.background=done?`${mod.cor}0d`:"#111"}>
                    {/* Ícone + número */}
                    <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
                      background:done?mod.cor+"22":"#0d0d0d",border:`1px solid ${done?mod.cor+"66":mod.cor+"22"}`,
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0}}>
                      {done
                        ? <span style={{fontSize:18,color:mod.cor,fontWeight:900,lineHeight:1}}>✓</span>
                        : <>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:mod.cor,fontWeight:700,lineHeight:1}}>{mod.id}</span>
                          </>
                      }
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"clamp(13px,3.8vw,15px)",color:done?mod.cor:"#eef5f0",lineHeight:1.2}}>
                        {mod.titulo}
                      </div>
                      <div style={{fontSize:"clamp(10px,2.8vw,12px)",color:done?mod.cor+"99":"#5d917a",marginTop:3,lineHeight:1.4}}>
                        {mod.sub}
                      </div>
                      {mod.tempo&&<div style={{fontSize:10,color:"#3d5a4a",marginTop:2,fontWeight:600}}>{mod.tempo}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                      <ChevronDown size={16} color={mod.cor+"88"} style={{transform:"rotate(-90deg)"}}/>
                    </div>
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
  const DRAFT_KEY = song?.id ? `ipb:draft:${song.id}` : null;

  // Verifica se existe um rascunho salvo mais recente que a última edição da música
  const [showDraftBanner, setShowDraftBanner] = useState(() => {
    if (!DRAFT_KEY) return false;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!d?.savedAt) return false;
      return d.savedAt > (song?.updatedAt || 0);
    } catch { return false; }
  });

  const recoverDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!d) return;
      if (d.title    !== undefined) setTitle(d.title);
      if (d.artist   !== undefined) setArtist(d.artist);
      if (d.category !== undefined) setCategory(d.category);
      if (d.feel     !== undefined) setFeel(d.feel);
      if (d.bpm      !== undefined) setBpm(d.bpm);
      if (d.sections !== undefined) setSections(d.sections);
      setShowDraftBanner(false);
      toast("Rascunho recuperado.", "success");
    } catch { setShowDraftBanner(false); }
  };

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
  const [composers, setComposers] = useState(song?.composers || "");
  const [songNotes, setSongNotes] = useState(song?.songNotes || "");
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
  // Autosave: salva rascunho no localStorage a cada 20s quando há alterações
  useEffect(() => {
    if (!DRAFT_KEY) return;
    const timer = setInterval(() => {
      try {
        const draft = { title, artist, category, categoryOther, hymnNumber, feel, youtube, bpm, timeSig, capoSuggested, sections, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch(e) {}
    }, 20000);
    return () => clearInterval(timer);
  }, [DRAFT_KEY, title, artist, category, categoryOther, hymnNumber, feel, youtube, bpm, timeSig, capoSuggested, sections]);

  // Limpa o rascunho ao salvar
  const clearDraft = useCallback(() => {
    try { if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY); } catch(e) {}
  }, [DRAFT_KEY]);

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
    clearDraft();
    onSave({
      id: song?.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(), artist: artist.trim(),
      category, categoryOther: category === "Outra" ? categoryOther.trim() : "",
      hymnNumber: category === "Hino" ? (hymnNumber.toString().trim()) : "",
      key, capoSuggested: Number(capoSuggested) || 0, bpm: Number(bpm) || 0,
      timeSig, feel: feel.trim(), youtube: youtube.trim(), composers: composers.trim(), songNotes: songNotes.trim(),
      sections: sections.filter(s => s.content.trim() || s.type),
      updatedBy: memberName || "anônimo", updatedAt: Date.now()
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "22px 22px 130px" }}>
      {confirmModal}
      {showDraftBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(224,179,65,.1)", border: "1px solid #e0b34144", borderRadius: 12, padding: "12px 16px", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, color: "#e0b341", fontSize: 13.5 }}>Rascunho não salvo encontrado</div>
            <div style={{ fontSize: 12, color: "#9fdabb", marginTop: 2 }}>Existe uma versão editada mais recente que não foi salva. Deseja recuperá-la?</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={recoverDraft} style={{ ...primaryBtn(), padding: "8px 16px", fontSize: 13 }}>Recuperar</button>
            <button onClick={() => { setShowDraftBanner(false); try { localStorage.removeItem(DRAFT_KEY); } catch{} }} style={{ ...ghostBtn(), padding: "8px 12px", fontSize: 13 }}>Descartar</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <button onClick={handleCancel} style={ghostBtn()}><X size={18} /> Cancelar</button>
        <h2 style={{ margin: 0, fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 28, color: "#fff" }}>{song?.id ? "Editar cifra" : "Nova cifra"}</h2>
        <button onClick={handleSave} style={primaryBtn()}><Save size={16} /> Salvar</button>
      </div>

      <div style={{ background: "#111", border: "1px solid #15392b", borderRadius: 18, padding: 22, marginBottom: 20 }}>
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
          <Field label="Compasso"><select value={timeSig} onChange={e => setTimeSig(e.target.value)} style={inputStyle()}>{["4/4","3/4","2/4","2/2","4/2","6/8","9/8","12/8","3/8","5/4","7/8","5/8","7/4","11/8","15/8","13/8","Livre"].map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Levada / Groove">
            <input value={feel} onChange={e => setFeel(e.target.value)} style={inputStyle()} placeholder="Ex: Balada, Gospel soul…" list="feel-suggestions" />
            <datalist id="feel-suggestions">
              {["Balada","Lento e suave","Groove funk","Gospel soul","Marchinha","Reggae","Rock","Acústico","Slow gospel","Contemporâneo","Hino tradicional","Pop","Bossa nova","Valsa"].map(f=><option key={f} value={f}/>)}
            </datalist>
            {!feel.trim() && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:6 }}>
                {["Balada","Groove funk","Gospel soul","Marchinha","Rock","Acústico","Slow gospel","Contemporâneo"].map(f=>(
                  <button key={f} type="button" onClick={()=>setFeel(f)}
                    style={{ fontSize:11, padding:"3px 9px", borderRadius:7, border:"1px solid #1d4435", background:"transparent", color:"#6fae8a", cursor:"pointer", fontFamily:"'Montserrat',sans-serif" }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </div>
        {capoSuggested > 0 && (
          <div style={{ fontSize: 12.5, color: "#9fc7b2", background: "rgba(63,174,107,.1)", border: "1px solid #1d4435", borderRadius: 9, padding: "9px 12px", marginTop: 4, marginBottom: 4 }}>
            💡 Digite os acordes nas <strong style={{ color: "#fff" }}>formas que a mão toca com o capo na {capoSuggested}ª casa</strong>. O tom real ({key}) é o som que sai. Quem abrir verá com o capo já aplicado, e o modo contra-baixo mostra o tom real automaticamente.
          </div>
        )}
        <Field label="Compositores">
          <input value={composers} onChange={e => setComposers(e.target.value)} style={inputStyle()} placeholder="Ex: Hillsong, Aline Barros, Fernandinho…" />
        </Field>
        <Field label="Observações gerais">
          <textarea value={songNotes} onChange={e => setSongNotes(e.target.value)}
            placeholder="Ex: Intro diferente ao vivo · Líder entra no 2º verso · Modula no final"
            rows={2} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5 }} />
        </Field>
        <Field label="Link do YouTube (versão original)"><input value={youtube} onChange={e => setYoutube(e.target.value)} style={inputStyle()} placeholder="https://youtube.com/watch?v=…" /></Field>
      </div>

      <div style={{ fontSize: 13.5, color: "#9fc7b2", marginBottom: 14, padding: "12px 16px", background: "#111", borderRadius: 12, border: "1px solid #15392b", lineHeight: 1.7 }}>
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
            style={{ background: "#111", border: isOver ? "1px solid #2f7d57" : "1px solid #15392b", borderRadius: 14, padding: 16, marginBottom: 14, borderLeft: `5px solid ${color}`,
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
            <div style={{ display: "inline-flex", gap: 2, background: "#000", border: "1px solid #1d4435", borderRadius: 9, padding: 3, marginBottom: 10 }}>
              {[["text", "Texto"], ["visual", "Visual (clicar)"]].map(([m, lbl]) => {
                const active = (sec.editMode || "text") === m;
                return (
                  <button key={m} onClick={() => update(i, "editMode", m)}
                    style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 12.5, fontWeight: 600,
                      background: active ? "linear-gradient(135deg,#1a1a1a,#111)" : "transparent", color: active ? "#fff" : "#6fae8a" }}>
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
const INPUT_STYLE_BASE = { width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #1d4435", background: "#000", color: "#eef5f0", fontSize: 15, fontFamily: "'Montserrat',sans-serif", outline: "none", boxSizing: "border-box" };
function inputStyle(extra = {}) { return { ...INPUT_STYLE_BASE, ...extra }; }
const PRIMARY_BTN = { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#fff,#dff0e6)", color: "#0d3d28", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", boxShadow: "0 6px 18px rgba(255,255,255,.12)" };
function primaryBtn() { return PRIMARY_BTN; }
const GHOST_BTN = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, border: "1px solid #1d4435", background: "transparent", color: "#eef5f0", fontSize: 14, cursor: "pointer", fontFamily: "'Montserrat',sans-serif" };
function ghostBtn() { return GHOST_BTN; }
function menuItemBtn() {
  return { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: "#eef5f0", fontSize: 13.5, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", textAlign: "left" };
}
const ICON_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "1px solid #1d4435", background: "#000", color: "#eef5f0", cursor: "pointer" };
function iconBtn() { return ICON_BTN; }
const STEP_BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(0,0,0,.3)", color: "#fff", cursor: "pointer" };
function stepBtn() { return STEP_BTN; }
const CARD_STYLE = { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 13, border: "1px solid #15392b", background: "#111", cursor: "pointer", transition: "all .18s ease", fontFamily: "'Montserrat',sans-serif", color: "#eef5f0", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" };
function cardStyle() { return CARD_STYLE; }
const CHIP = { display: "inline-flex", alignItems: "center", gap: 5, background: "#000", padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap" };
function chip() { return CHIP; }
