import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, Layers, Trophy, ChevronLeft, ChevronRight,
  Eye, CheckCircle2, XCircle, Plus, Settings, Search,
  Globe, RotateCcw, List, Star, BookOpen, Volume2,
  Download, Upload, Share2, Database
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BUNDLED_DATA from './data/vocabulary.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Word {
  id: string;
  word: string;
  meaning: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  reading?: string;
  category?: string;
}

interface LanguageEntry {
  name: string;
  flag: string;
  color: string;
  words: Word[];
  isCustom?: boolean;
}

type Mode = 'Dashboard' | 'Memorize' | 'Quiz' | 'List' | 'AddWord' | 'AddLanguage' | 'Settings';

const DEFAULT_DIFFICULTY_LABELS: Record<string, string[]> = {
  Japanese: ['N5', 'N4', 'N3', 'N2', 'N1'],
  default: ['Easy', 'Medium', 'Hard'],
};

const LANG_META: Record<string, { flag: string; color: string }> = {
  English: { flag: '🇺🇸', color: 'from-blue-500 to-indigo-600' },
  Spanish: { flag: '🇪🇸', color: 'from-red-500 to-orange-500' },
  Japanese: { flag: '🇯🇵', color: 'from-rose-500 to-pink-600' },
};

const VOCAB_LANG_MAP: Record<string, string> = {
  English: 'en-US',
  Spanish: 'es-ES',
  Japanese: 'ja-JP',
};

const speak = (text: string, langName: string) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // Stop any current speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOCAB_LANG_MAP[langName] || 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};

const DEFAULT_LANG_META = { flag: '🌍', color: 'from-teal-500 to-cyan-600' };

// LocalStorage helpers
const STORAGE_KEY = 'global_voca_pro_v2';

function loadStore(): Record<string, any> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return {};
    const parsed = JSON.parse(s);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_) {}
  return {};
}

function saveStore(store: Record<string, any>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Build initial language store
function buildInitialStore() {
  const saved = loadStore();
  const initial: Record<string, LanguageEntry> = {};

  const bundled = (BUNDLED_DATA && typeof BUNDLED_DATA === 'object') ? (BUNDLED_DATA as any) : {};
  for (const [name, data] of Object.entries(bundled)) {
    if (!data || typeof data !== 'object') continue;
    const entry = data as any;
    const words = Array.isArray(entry.value) ? entry.value : (Array.isArray(entry) ? entry : []);
    
    if (words.length === 0) continue;

    const meta = LANG_META[name] || DEFAULT_LANG_META;
    initial[name] = {
      name,
      flag: meta.flag,
      color: meta.color,
      words: [...words],
    };
  }

  // Merge saved custom words / languages
  if (saved && typeof saved === 'object') {
    for (const [name, entry] of Object.entries(saved)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as any;
      if (initial[name]) {
        // Append custom words added by user
        const words = Array.isArray(e.words) ? e.words : [];
        const customWords = words.filter((w: Word) => w && w.id && w.id.startsWith('custom-'));
        if (customWords.length > 0) {
          initial[name].words = [...initial[name].words, ...customWords];
        }
      } else if (e.name && e.words) {
        // Fully custom languages
        initial[name] = {
          name: e.name,
          flag: e.flag || DEFAULT_LANG_META.flag,
          color: e.color || DEFAULT_LANG_META.color,
          words: Array.isArray(e.words) ? e.words : [],
          isCustom: true
        };
      }
    }
  }

  return initial;
}

// Ruby text component (Japanese Furigana)
function RubyText({ word, reading }: { word: string; reading?: string }) {
  if (!reading) return <span>{word}</span>;
  return (
    <ruby className="ruby-text">
      {word}
      <rt className="text-sm text-primary-400 font-normal">{reading}</rt>
    </ruby>
  );
}

// Difficulty badge
function DiffBadge({ diff }: { diff: string }) {
  const colors: Record<string, string> = {
    Easy: 'bg-emerald-100 text-emerald-700',
    N5: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    N4: 'bg-amber-100 text-amber-700',
    N3: 'bg-orange-100 text-orange-700',
    Hard: 'bg-red-100 text-red-700',
    N2: 'bg-red-100 text-red-700',
    N1: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter', colors[diff] || 'bg-slate-100 text-slate-500')}>
      {diff}
    </span>
  );
}

export default function App() {
  const [store, setStore] = useState<Record<string, LanguageEntry>>(buildInitialStore);
  const [currentLang, setCurrentLang] = useState<string>('English');
  const [mode, setMode] = useState<Mode>('Dashboard');
  const [filterDiff, setFilterDiff] = useState<string>('All');

  const langEntry = store[currentLang];
  const langWords = langEntry?.words || [];
  const currentWords = useMemo(() => {
    if (filterDiff === 'All') return langWords;
    return langWords.filter(w => w.difficulty === filterDiff || w.category === filterDiff);
  }, [langWords, filterDiff]);

  const diffOptions = useMemo(() => {
    if (currentLang === 'Japanese') return DEFAULT_DIFFICULTY_LABELS.Japanese;
    const cats = [...new Set(langWords.map(w => w.difficulty))];
    return cats.length ? cats : DEFAULT_DIFFICULTY_LABELS.default;
  }, [currentLang, langWords]);

  // Persist custom changes
  const persistStore = useCallback((updated: Record<string, LanguageEntry>) => {
    const toSave: Record<string, any> = {};
    for (const [name, entry] of Object.entries(updated)) {
      const bundled = (BUNDLED_DATA as any)[name];
      if (!bundled) {
        toSave[name] = entry;
      } else {
        const customOnly = entry.words.filter(w => w.id.startsWith('custom-'));
        if (customOnly.length > 0) {
          toSave[name] = { ...entry, words: customOnly };
        }
      }
    }
    saveStore(toSave);
  }, []);

  const addWord = useCallback((word: Word) => {
    setStore(prev => {
      const updated = {
        ...prev,
        [currentLang]: {
          ...prev[currentLang],
          words: [...prev[currentLang].words, word],
        },
      };
      persistStore(updated);
      return updated;
    });
  }, [currentLang, persistStore]);

  const addLanguage = useCallback((name: string, flag: string, color: string) => {
    setStore(prev => {
      if (prev[name]) return prev;
      const updated = {
        ...prev,
        [name]: { name, flag, color, words: [], isCustom: true },
      };
      persistStore(updated);
      return updated;
    });
    setCurrentLang(name);
    setMode('Dashboard');
  }, [persistStore]);

  // Data Management Actions
  const exportData = useCallback((langName?: string) => {
    const dateStr = new Date().toISOString().split('T')[0].split('-').join('');
    let dataToExport: any = {};
    let fileName = `voca_full_backup_${dateStr}.json`;

    if (langName && store[langName]) {
      dataToExport = { [langName]: store[langName] };
      fileName = `voca_${langName}_${dateStr}.json`;
    } else {
      dataToExport = store;
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [store]);

  const importData = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setStore(prev => {
          const updated = { ...prev };
          if (imported && typeof imported === 'object') {
            for (const [name, entry] of Object.entries(imported)) {
              if (!entry || typeof entry !== 'object') continue;
              const e = entry as any;
              if (!e.words || !Array.isArray(e.words)) continue;
              
              if (updated[name]) {
                // Merge words, avoiding duplicates
                const existingIds = new Set(updated[name].words.map(w => w.id));
                const newWords = e.words.filter((w: any) => w && w.id && !existingIds.has(w.id));
                updated[name] = {
                  ...updated[name],
                  words: [...updated[name].words, ...newWords]
                };
              } else if (e.name) {
                updated[name] = {
                  name: e.name,
                  flag: e.flag || DEFAULT_LANG_META.flag,
                  color: e.color || DEFAULT_LANG_META.color,
                  words: e.words,
                  isCustom: true
                };
              }
            }
          }
          persistStore(updated);
          return updated;
        });
        alert('데이터를 성공적으로 불러왔습니다!');
      } catch (err) {
        alert('잘못된 파일 형식입니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }, [persistStore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100/80 h-16 flex items-center px-6 justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setMode('Dashboard')}>
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-all">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight text-slate-800 leading-none">Global Voca <span className="text-primary-500">Pro</span></h1>
            <p className="text-[10px] text-slate-400 font-medium">외국어 종합 단어장</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode !== 'Dashboard' && (
            <button onClick={() => setMode('Dashboard')} className="btn flex items-center gap-1.5 text-slate-500 hover:bg-slate-100 text-sm">
              <ChevronLeft size={16} /> 대시보드
            </button>
          )}
          <button onClick={() => setMode('AddLanguage')} className="btn flex items-center gap-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 text-sm">
            <Globe size={16} /> 언어 추가
          </button>
          <button onClick={() => setMode('AddWord')} className="btn flex items-center gap-1.5 bg-primary-500 text-white hover:bg-primary-600 text-sm shadow-sm shadow-primary-500/30">
            <Plus size={16} /> 단어 추가
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6">
        <AnimatePresence mode="wait">
          {/* ========== DASHBOARD ========== */}
          {mode === 'Dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-8 py-6">

              {/* Language Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black text-slate-800">언어 선택</h2>
                  <button onClick={() => setMode('AddLanguage')} className="text-primary-500 text-sm font-bold flex items-center gap-1 hover:underline">
                    <Plus size={14} /> 새 언어 만들기
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Object.entries(store).map(([name, entry]) => (
                    <button
                      key={name}
                      onClick={() => { setCurrentLang(name); setFilterDiff('All'); }}
                      className={cn(
                        "relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200 border-2 group",
                        currentLang === name
                          ? "border-primary-400 shadow-lg shadow-primary-200/50 bg-white"
                          : "border-slate-100 bg-white hover:border-primary-200 hover:shadow-md"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3 text-2xl bg-gradient-to-br text-white shadow-md", entry.color)}>
                        {entry.flag}
                      </div>
                      <div className="font-black text-slate-800">{name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{entry.words.length}개 단어</div>
                      {currentLang === name && (
                        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Study Panel */}
              {langEntry && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">
                  <div className={cn("bg-gradient-to-r p-8 text-white", langEntry.color)}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{langEntry.flag}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-black">{currentLang} 학습</h2>
                          <button 
                            onClick={(e) => { e.stopPropagation(); exportData(currentLang); }}
                            className="p-2 bg-white/20 hover:bg-white/40 rounded-xl transition-all flex items-center gap-2 group"
                            title="이 단어장 내보내기"
                          >
                            <Share2 size={16} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase">Export</span>
                          </button>
                        </div>
                        <p className="text-white/70 text-sm">총 {langWords.length}개의 단어</p>
                      </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex flex-wrap gap-2 mt-5">
                      {['All', ...diffOptions].map(d => (
                        <button
                          key={d}
                          onClick={() => setFilterDiff(d)}
                          className={cn(
                            "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                            filterDiff === d ? "bg-white text-slate-800 shadow" : "bg-white/20 text-white hover:bg-white/30"
                          )}
                        >
                          {d} {d === 'All' ? `(${langWords.length})` : `(${langWords.filter(w => w.difficulty === d || w.category === d).length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StudyCard
                      icon={<Eye size={22} className="text-blue-500" />}
                      title="암기 모드"
                      subtitle="Flashcards"
                      count={currentWords.length}
                      onClick={() => setMode('Memorize')}
                    />
                    <StudyCard
                      icon={<Trophy size={22} className="text-amber-500" />}
                      title="퀴즈 모드"
                      subtitle="Quiz"
                      count={Math.min(currentWords.length, 20)}
                      onClick={() => setMode('Quiz')}
                    />
                    <StudyCard
                      icon={<List size={22} className="text-indigo-500" />}
                      title="단어 목록"
                      subtitle="Word List"
                      count={currentWords.length}
                      onClick={() => setMode('List')}
                    />
                  </div>
                </div>
              )}

              {/* Data Management Section */}
              <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-slate-200/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary-500 shadow-sm border border-slate-100/50">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 leading-none">데이터 관리 및 동기화</h3>
                    <p className="text-xs text-slate-400 mt-1">단어장 전체를 백업하거나 친구가 공유한 파일을 불러와 현재 목록에 합칩니다.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => exportData()}
                    className="flex-1 sm:flex-none btn bg-white text-slate-700 hover:bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 font-bold px-6 py-3 rounded-2xl shadow-sm transition-all active:scale-95"
                  >
                    <Download size={18} /> 전체 내보내기
                  </button>
                  <label className="flex-1 sm:flex-none btn bg-primary-500 text-white hover:bg-primary-600 flex items-center justify-center gap-2 font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary-500/20 cursor-pointer transition-all active:scale-95">
                    <Upload size={18} /> 데이터 불러오기
                    <input type="file" accept=".json" className="hidden" onChange={importData} />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========== ADD WORD ========== */}
          {mode === 'AddWord' && (
            <motion.div key="addword" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-lg mx-auto py-8">
              <AddWordForm
                langName={currentLang}
                diffOptions={diffOptions}
                onAdd={(word: Word) => { addWord(word); setMode('Dashboard'); }}
                onCancel={() => setMode('Dashboard')}
              />
            </motion.div>
          )}

          {/* ========== ADD LANGUAGE ========== */}
          {mode === 'AddLanguage' && (
            <motion.div key="addlang" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-lg mx-auto py-8">
              <AddLanguageForm
                onAdd={addLanguage}
                onCancel={() => setMode('Dashboard')}
              />
            </motion.div>
          )}

          {/* ========== MEMORIZE ========== */}
          {mode === 'Memorize' && currentWords.length > 0 && (
            <motion.div key="memorize" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MemorizeView words={currentWords} lang={currentLang} langEntry={langEntry} />
            </motion.div>
          )}

          {/* ========== QUIZ ========== */}
          {mode === 'Quiz' && currentWords.length >= 4 && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <QuizView words={currentWords} lang={currentLang} langEntry={langEntry} onExit={() => setMode('Dashboard')} />
            </motion.div>
          )}

          {/* ========== LIST ========== */}
          {mode === 'List' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ListView words={currentWords} lang={currentLang} langEntry={langEntry} />
            </motion.div>
          )}

          {/* Empty state */}
          {(mode === 'Memorize' || mode === 'Quiz') && currentWords.length < 4 && (
            <motion.div key="empty" className="py-20 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-slate-400 font-bold text-xl mb-2">단어가 부족합니다</p>
              <p className="text-slate-300 text-sm mb-6">퀴즈 모드는 최소 4개 이상의 단어가 필요합니다.</p>
              <button onClick={() => setMode('AddWord')} className="btn btn-primary font-bold px-8 py-3">단어 추가하기</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-6 text-center text-slate-300 text-xs">
        © 2026 Global Voca Pro · Your Personal Language Companion
      </footer>
    </div>
  );
}

// --- StudyCard ---
function StudyCard({ icon, title, subtitle, count, onClick }: { icon: React.ReactNode, title: string, subtitle: string, count: number, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card p-6 text-left hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-primary-50 transition-colors">
          {icon}
        </div>
        <div>
          <div className="font-black text-slate-800 text-sm">{title}</div>
          <div className="text-[10px] text-slate-400">{subtitle}</div>
        </div>
      </div>
      <div className="text-2xl font-black text-slate-700">{count}<span className="text-sm font-medium text-slate-400 ml-1">단어</span></div>
    </button>
  );
}

// --- Add Word Form ---
function AddWordForm({ langName, diffOptions, onAdd, onCancel }: { langName: string, diffOptions: string[], onAdd: (w: Word) => void, onCancel: () => void }) {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [reading, setReading] = useState('');
  const [difficulty, setDifficulty] = useState(diffOptions[0] || 'Easy');
  const [category, setCategory] = useState('');

  const handleSubmit = () => {
    if (!word.trim() || !meaning.trim()) return;
    onAdd({
      id: `custom-${Date.now()}`,
      word: word.trim(),
      meaning: meaning.trim(),
      reading: reading.trim() || undefined,
      difficulty: difficulty as any,
      category: category.trim() || difficulty,
    });
  };

  return (
    <div className="card p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">{langName}에 단어 추가</h2>
        <p className="text-slate-400 text-sm mt-1">새로운 단어를 단어장에 추가합니다.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">단어 *</label>
          <input className="input" placeholder={langName === 'Japanese' ? '漢字 或はひらがな' : 'Word'} value={word} onChange={e => setWord(e.target.value)} />
        </div>
        {langName === 'Japanese' && (
          <div>
            <label className="label">읽기 (후리가나)</label>
            <input className="input" placeholder="よみかた" value={reading} onChange={e => setReading(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">뜻 *</label>
          <input className="input" placeholder="한국어 뜻을 입력하세요" value={meaning} onChange={e => setMeaning(e.target.value)} />
        </div>
        <div>
          <label className="label">난이도 / 레벨</label>
          <div className="flex flex-wrap gap-2">
            {diffOptions.map((d: string) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={cn("px-4 py-1.5 rounded-xl border text-sm font-bold transition-all", difficulty === d ? "bg-primary-500 text-white border-primary-500" : "border-slate-200 text-slate-500 hover:border-primary-300")}
              >{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">카테고리 (선택)</label>
          <input className="input" placeholder="예: day1, 인사, N3..." value={category} onChange={e => setCategory(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn flex-1 border border-slate-200 text-slate-500 font-bold py-3">취소</button>
        <button onClick={handleSubmit} disabled={!word || !meaning} className="btn btn-primary flex-1 font-bold py-3 disabled:opacity-40">추가하기</button>
      </div>
    </div>
  );
}

// --- Add Language Form ---
const flagOptions = ['🇫🇷','🇩🇪','🇨🇳','🇮🇹','🇵🇹','🇷🇺','🇦🇪','🇻🇳','🇹🇭','🌍','🏴‍☠️','🎌','🇰🇷'];
const colorOptions = [
  'from-violet-500 to-purple-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-lime-500 to-green-600',
  'from-cyan-500 to-sky-600',
];

function AddLanguageForm({ onAdd, onCancel }: { onAdd: (n: string, f: string, c: string) => void, onCancel: () => void }) {
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('🌍');
  const [color, setColor] = useState(colorOptions[0]);

  return (
    <div className="card p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">새 언어 만들기</h2>
        <p className="text-slate-400 text-sm mt-1">나만의 단어장 카테고리를 추가하세요.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">언어 이름 *</label>
          <input className="input" placeholder="예: 프랑스어, Chinese, Deutsch..." value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">이모지 국기</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {flagOptions.map(f => (
              <button key={f} onClick={() => setFlag(f)}
                className={cn("text-2xl p-2 rounded-xl border-2 transition-all", flag === f ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:border-primary-200")}
              >{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">테마 색상</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {colorOptions.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={cn("w-10 h-10 rounded-xl bg-gradient-to-br border-2 transition-all", c, color === c ? "border-slate-800 scale-110" : "border-transparent")}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        {name && (
          <div className={cn("rounded-2xl p-5 text-white bg-gradient-to-r", color)}>
            <span className="text-3xl">{flag}</span>
            <p className="font-black text-xl mt-2">{name}</p>
            <p className="text-white/60 text-xs">0개 단어</p>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn flex-1 border border-slate-200 text-slate-500 font-bold py-3">취소</button>
        <button onClick={() => onAdd(name, flag, color)} disabled={!name.trim()} className="btn btn-primary flex-1 font-bold py-3 disabled:opacity-40">만들기</button>
      </div>
    </div>
  );
}

// --- Memorize View ---
function MemorizeView({ words, lang, langEntry }: { words: Word[], lang: string, langEntry: LanguageEntry }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffled] = useState(() => [...words].sort(() => Math.random() - 0.5));
  const current = shuffled[index];

  const goNext = () => { setIsFlipped(false); setTimeout(() => setIndex(i => (i + 1) % shuffled.length), 150); };
  const goPrev = () => { setIsFlipped(false); setTimeout(() => setIndex(i => (i === 0 ? shuffled.length - 1 : i - 1)), 150); };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{langEntry?.flag}</span>
          <span className="font-black text-slate-700">{lang} · 암기 모드</span>
        </div>
        <div className="text-sm font-bold text-primary-500 bg-primary-50 px-3 py-1 rounded-full">
          {index + 1} / {shuffled.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className="bg-gradient-to-r from-primary-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${((index + 1) / shuffled.length) * 100}%` }} />
      </div>

      {/* Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="flashcard h-72 w-full cursor-pointer select-none"
        style={{ perspective: '1000px' }}
      >
        <div className="flashcard-inner relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
          {/* Front */}
          <div className="flashcard-front card absolute inset-0 flex flex-col items-center justify-center p-10 text-center"
            style={{ backfaceVisibility: 'hidden' }}>
            {lang === 'Japanese' && current.reading
              ? <div className="text-center"><div className="text-xl text-primary-400 font-medium mb-2">{current.reading}</div><div className="text-5xl font-black text-slate-800">{current.word}</div></div>
              : <h2 className="text-4xl md:text-5xl font-black text-slate-800 break-words">{current.word}</h2>
            }
            {current.category && <div className="mt-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{current.category}</div>}
            <p className="mt-4 text-slate-300 text-xs tracking-widest uppercase animate-pulse">탭하여 뒤집기</p>
          </div>
          {/* Back */}
          <div className="card absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-gradient-to-b from-primary-50 to-indigo-50 border-primary-100"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <h2 className={cn("font-bold text-primary-700 text-center leading-tight", current.meaning.length > 20 ? "text-2xl" : "text-4xl")}>{current.meaning}</h2>
            <DiffBadge diff={current.difficulty} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={(e) => { e.stopPropagation(); speak(current.word, lang); }} className="btn bg-white border border-slate-200 text-primary-500 hover:bg-primary-50 px-4">
          <Volume2 size={24} />
        </button>
        <button onClick={goPrev} className="flex-1 btn bg-white border border-slate-200 text-slate-600 font-bold py-4 hover:bg-slate-50">
          <ChevronLeft size={20} className="inline" /> 이전
        </button>
        <button onClick={goNext} className="flex-1 btn btn-primary font-bold py-4">
          다음 <ChevronRight size={20} className="inline" />
        </button>
      </div>
    </div>
  );
}

// --- Quiz View ---
function QuizView({ words, lang, langEntry, onExit }: { words: Word[], lang: string, langEntry: LanguageEntry, onExit: () => void }) {
  const [questions] = useState(() => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(20, shuffled.length));
  });
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[index];
  const isWriting = index % 3 === 0;

  const options = useMemo(() => {
    const others = words.filter((w: Word) => w.word !== current.word)
      .sort(() => Math.random() - 0.5).slice(0, 3);
    return [current.meaning, ...others.map((o: Word) => o.meaning)].sort(() => Math.random() - 0.5);
  }, [current, words]);

  const handleAnswer = useCallback((ans: string) => {
    if (answered) return;
    const correct = ans.trim() === current.meaning;
    setAnswered(true);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
  }, [answered, current]);

  const goNext = () => {
    if (index + 1 >= questions.length) { setFinished(true); return; }
    setIndex(i => i + 1);
    setAnswered(false);
    setIsCorrect(null);
    setSelected(null);
    setUserAnswer('');
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="text-6xl">{pct >= 80 ? '🏆' : pct >= 60 ? '🎯' : '📚'}</div>
        <h2 className="text-3xl font-black text-slate-800">퀴즈 완료!</h2>
        <div className="card p-8">
          <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-indigo-600">{pct}%</div>
          <div className="text-slate-400 font-medium mt-2">{score} / {questions.length} 정답</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onExit} className="flex-1 btn border border-slate-200 font-bold py-4">대시보드로</button>
          <button onClick={() => { setIndex(0); setScore(0); setFinished(false); setAnswered(false); setIsCorrect(null); setSelected(null); setUserAnswer(''); }} className="flex-1 btn btn-primary font-bold py-4">다시 풀기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{langEntry?.flag}</span>
          <span className="font-bold text-slate-600 text-sm">{lang} 퀴즈</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">{index + 1}/{questions.length}</div>
          <div className="text-sm font-black text-amber-500 flex items-center gap-1"><Star size={14} fill="currentColor" /> {score}</div>
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className="bg-gradient-to-r from-amber-400 to-primary-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${((index) / questions.length) * 100}%` }} />
      </div>

      {/* Question card */}
      <div className="card p-10 text-center relative overflow-hidden">
        <div className="absolute top-3 right-4 text-[9px] font-bold text-slate-200 uppercase tracking-widest">{isWriting ? '주관식' : '객관식'}</div>
        {lang === 'Japanese' && current.reading
          ? <><div className="text-lg text-primary-400 font-medium">{current.reading}</div><div className="text-5xl font-black text-slate-800 mt-1">{current.word}</div></>
          : <div className="text-4xl md:text-5xl font-black text-slate-800">{current.word}</div>}
        <p className="text-slate-400 mt-4 text-sm">이 단어의 뜻은?</p>

        {/* Feedback after answering */}
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("mt-4 p-4 rounded-2xl text-sm font-medium", isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100")}
          >
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2"><CheckCircle2 size={16} /> 정답입니다! 잘했어요 🎉</div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2"><XCircle size={16} /> 오답입니다</div>
                <div className="font-black">정답: <span className="text-red-800">{current.meaning}</span></div>
                {current.category && <div className="text-red-400 text-xs">{current.category}</div>}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Answer options */}
      {!answered ? (
        isWriting ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className="input flex-1 py-4 text-center text-lg"
              placeholder="뜻을 직접 입력..."
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && userAnswer.trim() && handleAnswer(userAnswer)}
            />
            <button onClick={() => handleAnswer(userAnswer)} disabled={!userAnswer.trim()} className="btn btn-primary px-6 font-bold disabled:opacity-40">확인</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt: string) => (
              <button
                key={opt}
                onClick={() => { setSelected(opt); handleAnswer(opt); }}
                className={cn("card p-4 text-center font-bold transition-all hover:scale-[1.01] hover:shadow-md", selected === opt ? "bg-primary-500 text-white border-primary-600" : "hover:border-primary-200 text-slate-700")}
              >{opt}</button>
            ))}
          </div>
        )
      ) : (
        <>
          {!isWriting && (
            <div className="grid grid-cols-1 gap-2">
              {options.map((opt: string) => (
                <div
                  key={opt}
                  className={cn("p-4 rounded-2xl border-2 text-center font-bold transition-all",
                    opt === current.meaning ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                    opt === selected ? "bg-red-50 border-red-300 text-red-600" : "bg-slate-50 border-slate-100 text-slate-400"
                  )}
                >{opt}</div>
              ))}
            </div>
          )}
          <button onClick={goNext} className="w-full btn btn-primary font-bold py-4 text-lg mt-2">
            {index + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
          </button>
        </>
      )}
    </div>
  );
}

// --- List View ---
function ListView({ words, lang, langEntry }: { words: Word[], lang: string, langEntry: LanguageEntry }) {
  const [query, setQuery] = useState('');
  const filtered = (words || []).filter((w: Word) =>
    w.word.toLowerCase().includes(query.toLowerCase()) ||
    w.meaning.toLowerCase().includes(query.toLowerCase()) ||
    (w.reading && w.reading.includes(query))
  );

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center gap-3 sticky top-20 z-10">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            className="input pl-10 py-3"
            placeholder="단어, 뜻, 후리가나로 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-400 font-medium whitespace-nowrap">{filtered.length}개</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((w: Word, i: number) => (
          <div key={i} className="card p-5 flex flex-col gap-2 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between">
              <div>
                {lang === 'Japanese' && w.reading && <div className="text-xs text-primary-400 font-medium">{w.reading}</div>}
                <div className="text-xl font-black text-slate-800">{w.word}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <DiffBadge diff={w.difficulty} />
                <button 
                  onClick={(e) => { e.stopPropagation(); speak(w.word, lang); }}
                  className="p-2 rounded-lg hover:bg-primary-50 text-slate-300 hover:text-primary-500 transition-colors"
                >
                  <Volume2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-slate-500 text-sm">{w.meaning}</div>
            {w.category && <div className="text-[9px] text-slate-300 uppercase font-bold tracking-widest">{w.category}</div>}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-slate-300">
            <Search size={32} className="mx-auto mb-3" />
            <p className="font-bold">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
