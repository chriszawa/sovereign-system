"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Backpack,
  BarChart3,
  CheckCircle2,
  Coins,
  Gem,
  LayoutDashboard,
  PackageOpen,
  Plus,
  Shield,
  Skull,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

type Tab = "dashboard" | "analytics" | "inventory";
type Difficulty = "Facil" | "Medio" | "Dificil" | "Extremo";
type Rarity = "Comum" | "Raro" | "Epico" | "Lendario";
type LootType = "consumivel" | "reliquia" | "material";

type Stat = { subject: string; A: number };

type Quest = {
  id: string;
  title: string;
  difficulty: Difficulty;
  statIndex: number;
  xpGain: number;
  statGain: number;
  completed: boolean;
};

type LootItem = {
  id: string;
  name: string;
  rarity: Rarity;
  type: LootType;
  description: string;
  value: number;
};

type InventoryEntry = LootItem & { qty: number };

const STORAGE_KEYS = {
  xp: "sf_xp",
  level: "sf_level",
  stats: "sf_stats",
  activityLog: "sf_activity_log",
  bossHp: "sf_boss_hp",
  bossDefeated: "sf_boss_defeated",
  quests: "sf_quests",
  inventory: "sf_inventory_v2",
  gold: "sf_gold_v2",
  activeRelicId: "sf_active_relic_v2",
};

const BASE_STATS: Stat[] = [
  { subject: "Forca", A: 10 },
  { subject: "Inteligencia", A: 10 },
  { subject: "Vitalidade", A: 10 },
  { subject: "Riqueza", A: 10 },
  { subject: "Disciplina", A: 10 },
  { subject: "Foco", A: 10 },
  { subject: "Social", A: 10 },
  { subject: "Criatividade", A: 10 },
];
const STAT_NAMES = BASE_STATS.map((s) => s.subject);

const DIFFICULTY_MAP: Record<
  Difficulty,
  { xp: number; stat: number; color: string; border: string; dropChance: number; gold: number }
> = {
  Facil: {
    xp: 10,
    stat: 1,
    color: "text-emerald-400",
    border: "border-l-emerald-400",
    dropChance: 0.2,
    gold: 8,
  },
  Medio: {
    xp: 20,
    stat: 2,
    color: "text-amber-400",
    border: "border-l-amber-400",
    dropChance: 0.35,
    gold: 14,
  },
  Dificil: {
    xp: 40,
    stat: 4,
    color: "text-rose-400",
    border: "border-l-rose-400",
    dropChance: 0.5,
    gold: 22,
  },
  Extremo: {
    xp: 80,
    stat: 7,
    color: "text-purple-400",
    border: "border-l-purple-400",
    dropChance: 0.75,
    gold: 34,
  },
};

const RARITY_STYLE: Record<Rarity, { badge: string; glow: string; weight: number }> = {
  Comum: { badge: "bg-slate-700 text-slate-200", glow: "shadow-slate-700/20", weight: 62 },
  Raro: { badge: "bg-sky-900 text-sky-300", glow: "shadow-sky-500/25", weight: 24 },
  Epico: { badge: "bg-fuchsia-900 text-fuchsia-300", glow: "shadow-fuchsia-500/30", weight: 11 },
  Lendario: { badge: "bg-amber-900 text-amber-300", glow: "shadow-amber-500/30", weight: 3 },
};

const LOOT_POOL: LootItem[] = [
  {
    id: "ion_shard",
    name: "Fragmento Ionico",
    rarity: "Comum",
    type: "material",
    description: "Material de forja para upgrades futuros.",
    value: 10,
  },
  {
    id: "focus_serum",
    name: "Serum de Foco",
    rarity: "Comum",
    type: "consumivel",
    description: "Concede +12 XP ao usar.",
    value: 12,
  },
  {
    id: "mind_tonic",
    name: "Tonico Mental",
    rarity: "Raro",
    type: "consumivel",
    description: "Concede +20 XP ao usar.",
    value: 20,
  },
  {
    id: "discipline_chip",
    name: "Chip de Disciplina",
    rarity: "Raro",
    type: "consumivel",
    description: "Aumenta Disciplina em +2.",
    value: 2,
  },
  {
    id: "relic_vision",
    name: "Reliquia da Visao",
    rarity: "Epico",
    type: "reliquia",
    description: "Bonus passivo de +40 no Power Score.",
    value: 40,
  },
  {
    id: "relic_king",
    name: "Coroa do Arquiteto",
    rarity: "Lendario",
    type: "reliquia",
    description: "Bonus passivo de +90 no Power Score.",
    value: 90,
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const safeInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDifficulty = (value: string): Difficulty => {
  const normalized = value
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();

  if (normalized.includes("facil")) return "Facil";
  if (normalized.includes("medio")) return "Medio";
  if (normalized.includes("dificil")) return "Dificil";
  return "Extremo";
};

const getTodayStr = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
};

const getLastDays = (days: number) => {
  const now = new Date();
  return Array.from({ length: days }, (_, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (days - 1 - idx));
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    return { iso, label: d.toLocaleDateString("pt-BR", { weekday: "short" }) };
  });
};

const weightedLootRoll = (): LootItem => {
  const expanded = LOOT_POOL.flatMap((item) => Array(RARITY_STYLE[item.rarity].weight).fill(item));
  return expanded[Math.floor(Math.random() * expanded.length)];
};

export default function SovereignApp() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<Stat[]>(BASE_STATS);
  const [activityLog, setActivityLog] = useState<Record<string, number>>({});
  const [bossHp, setBossHp] = useState(20);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showAddQuest, setShowAddQuest] = useState(false);
  const [newQuest, setNewQuest] = useState<{ title: string; difficulty: Difficulty; statIndex: number }>({
    title: "",
    difficulty: "Medio",
    statIndex: 0,
  });

  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [gold, setGold] = useState(60);
  const [activeRelicId, setActiveRelicId] = useState<string | null>(null);
  const [lootResult, setLootResult] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);

    setXp(clamp(safeInt(localStorage.getItem(STORAGE_KEYS.xp), 0), 0, 99));
    setLevel(Math.max(1, safeInt(localStorage.getItem(STORAGE_KEYS.level), 1)));

    const loadedStats = safeParse<Stat[]>(localStorage.getItem(STORAGE_KEYS.stats), BASE_STATS);
    setStats(
      BASE_STATS.map((base, idx) => ({
        subject: base.subject,
        A: clamp(loadedStats[idx]?.A ?? base.A, 0, 100),
      }))
    );

    setActivityLog(safeParse<Record<string, number>>(localStorage.getItem(STORAGE_KEYS.activityLog), {}));
    setBossHp(clamp(safeInt(localStorage.getItem(STORAGE_KEYS.bossHp), 20), 0, 20));
    setBossDefeated(localStorage.getItem(STORAGE_KEYS.bossDefeated) === "true");

    const loadedQuests = safeParse<Quest[]>(localStorage.getItem(STORAGE_KEYS.quests), []);
    setQuests(
      loadedQuests.map((q) => {
        const difficulty = normalizeDifficulty(String(q.difficulty));
        return {
          id: String(q.id),
          title: String(q.title || "Missao"),
          difficulty,
          statIndex: clamp(Number(q.statIndex) || 0, 0, STAT_NAMES.length - 1),
          xpGain: DIFFICULTY_MAP[difficulty].xp,
          statGain: DIFFICULTY_MAP[difficulty].stat,
          completed: Boolean(q.completed),
        };
      })
    );

    setInventory(safeParse<InventoryEntry[]>(localStorage.getItem(STORAGE_KEYS.inventory), []));
    setGold(Math.max(0, safeInt(localStorage.getItem(STORAGE_KEYS.gold), 60)));
    setActiveRelicId(localStorage.getItem(STORAGE_KEYS.activeRelicId));
  }, []);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STORAGE_KEYS.xp, String(xp));
    localStorage.setItem(STORAGE_KEYS.level, String(level));
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(activityLog));
    localStorage.setItem(STORAGE_KEYS.bossHp, String(bossHp));
    localStorage.setItem(STORAGE_KEYS.bossDefeated, String(bossDefeated));
    localStorage.setItem(STORAGE_KEYS.quests, JSON.stringify(quests));
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventory));
    localStorage.setItem(STORAGE_KEYS.gold, String(gold));
    localStorage.setItem(STORAGE_KEYS.activeRelicId, activeRelicId ?? "");
  }, [isClient, xp, level, stats, activityLog, bossHp, bossDefeated, quests, inventory, gold, activeRelicId]);

  const xpToLevel = 100;
  const xpPercent = clamp((xp / xpToLevel) * 100, 0, 100);

  const relicBonus = useMemo(() => {
    const relic = inventory.find((i) => i.id === activeRelicId && i.type === "reliquia");
    return relic?.value ?? 0;
  }, [inventory, activeRelicId]);

  const powerScore = Math.floor(stats.reduce((acc, curr) => acc + curr.A, 0) * (level / 5) + relicBonus);

  const activeQuests = useMemo(() => quests.filter((q) => !q.completed), [quests]);
  const completedQuests = useMemo(() => quests.filter((q) => q.completed), [quests]);

  const activitySeries = useMemo(() => {
    const days = getLastDays(7);
    return days.map((d) => ({ day: d.label, count: activityLog[d.iso] || 0 }));
  }, [activityLog]);

  const inventoryByRarity = useMemo(
    () =>
      [...inventory].sort(
        (a, b) => RARITY_STYLE[b.rarity].weight - RARITY_STYLE[a.rarity].weight || a.name.localeCompare(b.name)
      ),
    [inventory]
  );

  const getRank = () => {
    if (powerScore < 80) return { title: "RANK E", color: "text-slate-500" };
    if (powerScore < 220) return { title: "RANK D", color: "text-emerald-500" };
    if (powerScore < 500) return { title: "RANK C", color: "text-sky-500" };
    if (powerScore < 900) return { title: "RANK B", color: "text-indigo-500" };
    if (powerScore < 1600) return { title: "RANK A", color: "text-rose-500" };
    return { title: "RANK S", color: "text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" };
  };

  const addToInventory = (loot: LootItem) => {
    setInventory((prev) => {
      const found = prev.find((p) => p.id === loot.id);
      if (found) {
        return prev.map((p) => (p.id === loot.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...loot, qty: 1 }];
    });
  };

  const rollLoot = (sourceLabel: string) => {
    const loot = weightedLootRoll();
    addToInventory(loot);
    setLootResult(`${sourceLabel}: ${loot.name} (${loot.rarity})`);
  };

  const handleAddQuest = () => {
    if (!newQuest.title.trim()) return;

    const diff = DIFFICULTY_MAP[newQuest.difficulty];
    const quest: Quest = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      title: newQuest.title.trim(),
      difficulty: newQuest.difficulty,
      statIndex: newQuest.statIndex,
      xpGain: diff.xp,
      statGain: diff.stat,
      completed: false,
    };

    setQuests((prev) => [quest, ...prev]);
    setShowAddQuest(false);
    setNewQuest({ title: "", difficulty: "Medio", statIndex: 0 });
  };

  const completeQuest = (id: string) => {
    const quest = quests.find((q) => q.id === id);
    if (!quest || quest.completed) return;

    let nextXp = xp + quest.xpGain;
    let nextLevel = level;

    while (nextXp >= xpToLevel) {
      nextLevel += 1;
      nextXp -= xpToLevel;
    }

    const nextStats = stats.map((s, i) =>
      i === quest.statIndex ? { ...s, A: clamp(s.A + quest.statGain, 0, 100) } : s
    );
    const nextQuests = quests.map((q) => (q.id === id ? { ...q, completed: true } : q));

    const today = getTodayStr();
    const nextLog = { ...activityLog, [today]: clamp((activityLog[today] || 0) + 1, 0, 6) };

    const rewardGold = DIFFICULTY_MAP[quest.difficulty].gold;
    setGold((prev) => prev + rewardGold);

    let nextBossHp = bossHp;
    let nextBossDef = bossDefeated;
    if (!bossDefeated && bossHp > 0) {
      nextBossHp -= 1;
      if (nextBossHp <= 0) {
        nextBossHp = 0;
        nextBossDef = true;
        nextXp += 100;
        setGold((prev) => prev + 80);
        rollLoot("Drop de Boss");
      }
    }

    if (Math.random() < DIFFICULTY_MAP[quest.difficulty].dropChance) {
      rollLoot("Drop de Quest");
    }

    while (nextXp >= xpToLevel) {
      nextLevel += 1;
      nextXp -= xpToLevel;
    }

    setXp(clamp(nextXp, 0, 99));
    setLevel(nextLevel);
    setStats(nextStats);
    setQuests(nextQuests);
    setActivityLog(nextLog);
    setBossHp(nextBossHp);
    setBossDefeated(nextBossDef);
  };

  const openSupplyCrate = () => {
    if (gold < 25) return;
    setGold((prev) => prev - 25);
    rollLoot("Caixa de Suprimentos");
  };

  const useItem = (item: InventoryEntry) => {
    if (item.type !== "consumivel" || item.qty <= 0) return;

    if (item.id === "focus_serum" || item.id === "mind_tonic") {
      setXp((prev) => {
        let v = prev + item.value;
        let lv = level;
        while (v >= 100) {
          v -= 100;
          lv += 1;
        }
        setLevel(lv);
        return clamp(v, 0, 99);
      });
    }

    if (item.id === "discipline_chip") {
      setStats((prev) =>
        prev.map((s, i) => (i === 4 ? { ...s, A: clamp(s.A + item.value, 0, 100) } : s))
      );
    }

    setInventory((prev) =>
      prev
        .map((p) => (p.id === item.id ? { ...p, qty: p.qty - 1 } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const equipRelic = (item: InventoryEntry) => {
    if (item.type !== "reliquia" || item.qty <= 0) return;
    setActiveRelicId((prev) => (prev === item.id ? null : item.id));
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className={`text-3xl lg:text-4xl font-black tracking-tight ${getRank().color}`}>{getRank().title}</h1>
              <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Nivel {level}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block">Power</span>
                <span className="text-xl font-black text-indigo-400">{powerScore}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block">Gold</span>
                <span className="text-xl font-black text-amber-400 flex items-center gap-1">
                  <Coins size={16} /> {gold}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <span>XP</span>
              <span>
                {xp}/{xpToLevel}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
              <div
                className="h-full bg-sky-400 shadow-[0_0_10px_#38bdf8] transition-all"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2 ${
              activeTab === "dashboard" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2 ${
              activeTab === "analytics" ? "bg-indigo-500 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <BarChart3 size={16} /> Analytics
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2 ${
              activeTab === "inventory" ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Backpack size={16} /> Inventario
          </button>
        </nav>

        {activeTab === "dashboard" && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="space-y-5">
              <div className="rounded-2xl border border-purple-500/20 bg-slate-900/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest font-black text-purple-400">
                    {bossDefeated ? <Trophy size={14} className="text-amber-400" /> : <Skull size={14} />}
                    {bossDefeated ? "Boss derrotado" : "Chefe da semana"}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-bold">HP {bossHp}/20</span>
                </div>
                {!bossDefeated ? (
                  <div className="h-3 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className="h-full bg-rose-500 transition-all shadow-[0_0_12px_#f43f5e]"
                      style={{ width: `${(bossHp / 20) * 100}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-400 font-bold">Recompensas coletadas</p>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="h-72">
                  <ResponsiveContainer>
                    <RadarChart data={stats}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} />
                      <Radar dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex justify-between items-center">
                  <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest font-black text-slate-400">
                    <Target size={14} className="text-sky-500" /> Quests ativas
                  </h3>
                  <button
                    onClick={() => setShowAddQuest((v) => !v)}
                    className="rounded-xl border border-sky-500/20 bg-sky-900/30 p-2 text-sky-400"
                  >
                    {showAddQuest ? <X size={14} /> : <Plus size={14} />}
                  </button>
                </div>

                {showAddQuest && (
                  <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-slate-900 p-4">
                    <input
                      value={newQuest.title}
                      onChange={(e) => setNewQuest((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Nome da missao"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-sky-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newQuest.difficulty}
                        onChange={(e) =>
                          setNewQuest((p) => ({ ...p, difficulty: normalizeDifficulty(e.target.value) }))
                        }
                        className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs"
                      >
                        <option>Facil</option>
                        <option>Medio</option>
                        <option>Dificil</option>
                        <option>Extremo</option>
                      </select>
                      <select
                        value={newQuest.statIndex}
                        onChange={(e) => setNewQuest((p) => ({ ...p, statIndex: Number(e.target.value) }))}
                        className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs"
                      >
                        {STAT_NAMES.map((n, i) => (
                          <option key={n} value={i}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddQuest}
                      className="w-full rounded-xl bg-sky-600 py-3 text-[11px] uppercase tracking-widest font-black"
                    >
                      Forjar
                    </button>
                  </div>
                )}

                {activeQuests.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400 text-center">
                    Sem quests ativas. Crie uma nova acima.
                  </div>
                )}

                {activeQuests.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => completeQuest(q.id)}
                    className={`w-full rounded-2xl border border-slate-800 border-l-4 ${DIFFICULTY_MAP[q.difficulty].border} bg-slate-900/70 p-4 text-left hover:bg-slate-800 transition`}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <h4 className="font-bold">{q.title}</h4>
                        <p className={`text-[10px] uppercase mt-1 font-bold ${DIFFICULTY_MAP[q.difficulty].color}`}>
                          {q.difficulty} | +{q.xpGain} XP | +{q.statGain} {STAT_NAMES[q.statIndex]}
                        </p>
                      </div>
                      <Shield size={16} className="text-slate-600" />
                    </div>
                  </button>
                ))}

                {completedQuests.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    {completedQuests.slice(0, 5).map((q) => (
                      <div
                        key={q.id}
                        className="rounded-xl border border-slate-800/60 bg-slate-950 p-3 text-xs flex items-center justify-between text-slate-400"
                      >
                        <span className="line-through">{q.title}</span>
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-4 flex items-center gap-2">
                  <PackageOpen size={14} className="text-amber-400" /> Loot Lab
                </h3>
                <button
                  onClick={openSupplyCrate}
                  disabled={gold < 25}
                  className={`w-full rounded-xl py-3 text-sm font-black uppercase tracking-wider transition ${
                    gold >= 25
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Abrir Caixa (25 gold)
                </button>
                <p className="mt-3 text-xs text-slate-400">
                  Quests tambem podem dropar itens. Dificuldades maiores aumentam chance.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                  Reliquia equipada
                </h3>
                {activeRelicId ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-3">
                    <p className="font-bold text-emerald-300">
                      {inventory.find((i) => i.id === activeRelicId)?.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Bonus ativo: +{relicBonus} power</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma reliquia ativa.</p>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">Resumo rapido</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-950 p-3">
                    <p className="text-slate-500 text-[10px] uppercase">Itens</p>
                    <p className="font-black">{inventory.reduce((a, b) => a + b.qty, 0)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-3">
                    <p className="text-slate-500 text-[10px] uppercase">Quests</p>
                    <p className="font-black">{activeQuests.length}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-400" /> Atividade (7 dias)
              </h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={activitySeries}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} domain={[0, 6]} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#34d399" fill="#34d399" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Activity size={14} className="text-sky-400" /> Estatisticas de combate
              </h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={stats}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="subject" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                    <Bar dataKey="A" fill="#38bdf8" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {activeTab === "inventory" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 flex items-center gap-2">
                <Backpack size={14} className="text-emerald-400" /> Inventario
              </h3>
              <span className="text-xs text-slate-400">
                Total: {inventory.reduce((acc, item) => acc + item.qty, 0)} itens
              </span>
            </div>

            {inventoryByRarity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Inventario vazio. Complete quests ou abra caixas.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {inventoryByRarity.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg ${RARITY_STYLE[item.rarity].glow}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black ${RARITY_STYLE[item.rarity].badge}`}>
                        {item.rarity}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Qtd: {item.qty}</span>
                      <div className="flex items-center gap-2">
                        {item.type === "consumivel" && (
                          <button
                            onClick={() => useItem(item)}
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-black uppercase"
                          >
                            Usar
                          </button>
                        )}
                        {item.type === "reliquia" && (
                          <button
                            onClick={() => equipRelic(item)}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase ${
                              activeRelicId === item.id
                                ? "bg-emerald-600 text-white"
                                : "bg-fuchsia-700 text-white"
                            }`}
                          >
                            {activeRelicId === item.id ? "Ativa" : "Equipar"}
                          </button>
                        )}
                        {item.type === "material" && (
                          <span className="text-xs text-amber-300 flex items-center gap-1">
                            <Gem size={13} /> Material
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {lootResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-500/40 bg-slate-900 p-8 text-center">
            <Sparkles size={56} className="mx-auto text-amber-400 mb-4" />
            <h2 className="text-2xl font-black text-amber-300 uppercase tracking-tight">Loot obtido</h2>
            <p className="mt-2 text-slate-200 font-bold">{lootResult}</p>
            <button
              onClick={() => setLootResult(null)}
              className="mt-6 w-full rounded-full bg-amber-500 px-6 py-3 text-black text-xs font-black uppercase tracking-[0.2em]"
            >
              Coletar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
