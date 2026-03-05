"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "dashboard" | "analytics" | "inventory" | "social" | "settings";
type Difficulty = "Facil" | "Medio" | "Dificil" | "Extremo";
type QuestCategory = "Corpo" | "Estudos" | "Trabalho" | "Negocios";
type Rarity = "Comum" | "Raro" | "Epico" | "Lendario";
type LootType = "consumivel" | "reliquia" | "material";
type AuthMode = "login" | "register";
type FriendshipStatus = "pending" | "accepted" | "rejected";

type Stat = { subject: string; A: number };

type Quest = {
  id: string;
  title: string;
  difficulty: Difficulty;
  category: QuestCategory;
  statIndexes: number[];
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

type Profile = {
  id: string;
  username: string;
  hunter_name: string;
  avatar_url: string | null;
};

type SocialPost = {
  id: string;
  author_id: string;
  hunter_name_snapshot: string;
  avatar_url_snapshot: string | null;
  content: string;
  created_at: string;
  level_snapshot: number;
  power_snapshot: number;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
};

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
  { subject: "Riqueza", A: 10 },
  { subject: "Foco", A: 10 },
];

const STAT_NAMES = BASE_STATS.map((s) => s.subject);

const QUEST_CATEGORY_MAP: Record<QuestCategory, { label: string; statIndexes: number[] }> = {
  Corpo: { label: "Corpo", statIndexes: [0, 3] },
  Estudos: { label: "Estudos", statIndexes: [1, 3] },
  Trabalho: { label: "Trabalho", statIndexes: [2, 1] },
  Negocios: { label: "Negocios", statIndexes: [2, 3] },
};

const DIFFICULTY_MAP: Record<
  Difficulty,
  { xp: number; stat: number; color: string; border: string; dropChance: number; gold: number }
> = {
  Facil: {
    xp: 10,
    stat: 1,
    color: "text-emerald-300",
    border: "border-l-emerald-400",
    dropChance: 0.2,
    gold: 8,
  },
  Medio: {
    xp: 20,
    stat: 2,
    color: "text-cyan-300",
    border: "border-l-cyan-400",
    dropChance: 0.35,
    gold: 14,
  },
  Dificil: {
    xp: 40,
    stat: 4,
    color: "text-amber-300",
    border: "border-l-amber-400",
    dropChance: 0.5,
    gold: 22,
  },
  Extremo: {
    xp: 80,
    stat: 7,
    color: "text-fuchsia-300",
    border: "border-l-fuchsia-400",
    dropChance: 0.75,
    gold: 34,
  },
};

const RARITY_STYLE: Record<Rarity, { badge: string; glow: string; weight: number }> = {
  Comum: { badge: "bg-slate-700 text-slate-200", glow: "shadow-slate-700/20", weight: 62 },
  Raro: { badge: "bg-cyan-950 text-cyan-300", glow: "shadow-cyan-500/30", weight: 24 },
  Epico: { badge: "bg-fuchsia-950 text-fuchsia-300", glow: "shadow-fuchsia-500/30", weight: 11 },
  Lendario: { badge: "bg-amber-950 text-amber-300", glow: "shadow-amber-500/30", weight: 3 },
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
    description: "Aumenta Foco em +2.",
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

const statAbbr = (name: string) => name.slice(0, 3).toUpperCase();

export default function SovereignApp() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<Session | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [hunterName, setHunterName] = useState("CACADOR");
  const [hunterNameDraft, setHunterNameDraft] = useState("CACADOR");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<Stat[]>(BASE_STATS);
  const [activityLog, setActivityLog] = useState<Record<string, number>>({});
  const [bossHp, setBossHp] = useState(20);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showAddQuest, setShowAddQuest] = useState(false);
  const [newQuest, setNewQuest] = useState<{ title: string; difficulty: Difficulty; category: QuestCategory }>({
    title: "",
    difficulty: "Medio",
    category: "Corpo",
  });

  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [gold, setGold] = useState(60);
  const [activeRelicId, setActiveRelicId] = useState<string | null>(null);
  const [lootResult, setLootResult] = useState<string | null>(null);

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [socialFeedback, setSocialFeedback] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

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
        const rawCategory = String((q as { category?: string }).category || "Corpo").toLowerCase();
        const category: QuestCategory = rawCategory.includes("estud")
          ? "Estudos"
          : rawCategory.includes("trabalh")
            ? "Trabalho"
            : rawCategory.includes("negoc")
              ? "Negocios"
              : "Corpo";

        const oldStatIndex = clamp(Number((q as { statIndex?: number }).statIndex) || 0, 0, STAT_NAMES.length - 1);
        const parsedStatIndexes = Array.isArray((q as { statIndexes?: number[] }).statIndexes)
          ? (q as { statIndexes: number[] }).statIndexes.map((idx) => clamp(Number(idx) || 0, 0, STAT_NAMES.length - 1))
          : [oldStatIndex];

        return {
          id: String(q.id),
          title: String(q.title || "Missao"),
          difficulty,
          category,
          statIndexes: parsedStatIndexes.length > 0 ? parsedStatIndexes : QUEST_CATEGORY_MAP[category].statIndexes,
          xpGain: DIFFICULTY_MAP[difficulty].xp,
          statGain: DIFFICULTY_MAP[difficulty].stat,
          completed: Boolean(q.completed),
        };
      })
    );

    setInventory(safeParse<InventoryEntry[]>(localStorage.getItem(STORAGE_KEYS.inventory), []));
    setGold(Math.max(0, safeInt(localStorage.getItem(STORAGE_KEYS.gold), 60)));
    setActiveRelicId(localStorage.getItem(STORAGE_KEYS.activeRelicId));

    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const activeSession = data.session ?? null;
      setSession(activeSession);
      if (activeSession?.user) {
        await loadProfile(activeSession.user);
      }
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user);
      } else {
        setCurrentUserId(null);
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
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

  const todayActivity = activityLog[getTodayStr()] || 0;

  const acceptedFriendships = useMemo(
    () => friendships.filter((f) => f.status === "accepted"),
    [friendships]
  );

  const pendingIncoming = useMemo(
    () => friendships.filter((f) => f.status === "pending" && f.addressee_id === currentUserId),
    [friendships, currentUserId]
  );

  const myFriends = useMemo(() => {
    if (!currentUserId) return [] as Array<{ friendshipId: string; profile: Profile }>;
    return acceptedFriendships
      .map((f) => {
        const friendId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
        const profile = profilesById[friendId];
        if (!profile) return null;
        return { friendshipId: f.id, profile };
      })
      .filter((v): v is { friendshipId: string; profile: Profile } => Boolean(v));
  }, [acceptedFriendships, profilesById, currentUserId]);

  const socialStatusBoard = useMemo(() => {
    if (!currentUserId) return [] as Array<{ id: string; name: string; username: string; level: number; power: number; createdAt: string }>;

    const allowedIds = new Set<string>([currentUserId, ...myFriends.map((f) => f.profile.id)]);
    const latestByAuthor = new Map<string, SocialPost>();

    for (const post of socialPosts) {
      if (!allowedIds.has(post.author_id)) continue;
      const prev = latestByAuthor.get(post.author_id);
      if (!prev || new Date(post.created_at).getTime() > new Date(prev.created_at).getTime()) {
        latestByAuthor.set(post.author_id, post);
      }
    }

    return [...latestByAuthor.values()]
      .map((post) => {
        const profile = profilesById[post.author_id];
        return {
          id: post.author_id,
          name: profile?.hunter_name || post.hunter_name_snapshot,
          username: profile?.username || `user_${post.author_id.slice(0, 8)}`,
          level: post.level_snapshot,
          power: post.power_snapshot,
          createdAt: post.created_at,
        };
      })
      .sort((a, b) => b.power - a.power || b.level - a.level);
  }, [socialPosts, myFriends, currentUserId, profilesById]);

  const getRank = () => {
    if (powerScore < 80) return { title: "RANK E", color: "text-slate-400" };
    if (powerScore < 220) return { title: "RANK D", color: "text-emerald-300" };
    if (powerScore < 500) return { title: "RANK C", color: "text-cyan-300" };
    if (powerScore < 900) return { title: "RANK B", color: "text-indigo-300" };
    if (powerScore < 1600) return { title: "RANK A", color: "text-fuchsia-300" };
    return { title: "RANK S", color: "text-amber-300" };
  };

  const getRankByPower = (score: number) => {
    if (score < 80) return "RANK E";
    if (score < 220) return "RANK D";
    if (score < 500) return "RANK C";
    if (score < 900) return "RANK B";
    if (score < 1600) return "RANK A";
    return "RANK S";
  };
  const getPublicProfile = async (userId: string, metadata?: Record<string, unknown>): Promise<Profile> => {
    if (!supabase) throw new Error("Supabase nao configurado.");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, hunter_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    if (data) return data as Profile;

    const metadataUsernameRaw = typeof metadata?.username === "string" ? metadata.username : "";
    const metadataHunterRaw = typeof metadata?.hunter_name === "string" ? metadata.hunter_name : "";

    const metadataUsername = metadataUsernameRaw.trim().toLowerCase();
    const fallbackUsername = metadataUsername.length >= 3 ? metadataUsername : `user_${userId.slice(0, 8)}`;
    const fallbackHunter = metadataHunterRaw.trim() || fallbackUsername.toUpperCase();

    const fallbackProfile: Profile = {
      id: userId,
      username: fallbackUsername,
      hunter_name: fallbackHunter,
      avatar_url: null,
    };

    const { error: insertError } = await supabase.from("profiles").insert(fallbackProfile);
    if (insertError) throw insertError;
    return fallbackProfile;
  };

  const loadProfile = async (user: { id: string; user_metadata?: Record<string, unknown> }) => {
    try {
      const profile = await getPublicProfile(user.id, user.user_metadata);
      setCurrentUserId(profile.id);
      setCurrentUser(profile.username);
      setHunterName(profile.hunter_name || "CACADOR");
      setHunterNameDraft(profile.hunter_name || "CACADOR");
      setAvatarDataUrl(profile.avatar_url || null);
    } catch (error) {
      console.error(error);
      setAuthError("Falha ao carregar perfil.");
    }
  };

  const loadSocialData = async (userId: string) => {
    if (!supabase) return;
    setSocialLoading(true);

    const { data: friendshipRows, error: friendshipError } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (friendshipError) {
      setSocialFeedback("Erro ao carregar amizades.");
      setSocialLoading(false);
      return;
    }

    const allFriendships = (friendshipRows || []) as Friendship[];
    setFriendships(allFriendships);

    const accepted = allFriendships.filter((f) => f.status === "accepted");
    const pendingIncoming = allFriendships.filter((f) => f.status === "pending" && f.addressee_id === userId);

    const profileIds = new Set<string>();
    profileIds.add(userId);
    accepted.forEach((f) => profileIds.add(f.requester_id === userId ? f.addressee_id : f.requester_id));
    pendingIncoming.forEach((f) => profileIds.add(f.requester_id));

    let map: Record<string, Profile> = {};
    const ids = [...profileIds];
    if (ids.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, username, hunter_name, avatar_url")
        .in("id", ids);
      map = (profileRows || []).reduce<Record<string, Profile>>((acc, row) => {
        const p = row as Profile;
        acc[p.id] = p;
        return acc;
      }, {});
    }
    setProfilesById(map);

    const authorIds = [userId, ...accepted.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id))];
    const uniqueAuthorIds = [...new Set(authorIds)];

    if (uniqueAuthorIds.length > 0) {
      const { data: postRows } = await supabase
        .from("posts")
        .select("id, author_id, hunter_name_snapshot, avatar_url_snapshot, content, created_at, level_snapshot, power_snapshot")
        .in("author_id", uniqueAuthorIds)
        .order("created_at", { ascending: false })
        .limit(100);

      setSocialPosts((postRows || []) as SocialPost[]);
    } else {
      setSocialPosts([]);
    }

    setSocialLoading(false);
  };

  useEffect(() => {
    if (!currentUserId) return;
    void loadSocialData(currentUserId);
  }, [currentUserId]);

  const handleAuth = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthError("Configure Supabase para continuar.");
      return;
    }

    const email = authEmail.trim().toLowerCase();
    const password = authPass.trim();
    const username = authUser.trim().toLowerCase();

    if (!email.includes("@") || password.length < 6) {
      setAuthError("Use email valido e senha com ao menos 6 caracteres.");
      return;
    }

    setAuthError(null);

    if (authMode === "register") {
      if (username.length < 3) {
        setAuthError("Usuario precisa ter pelo menos 3 caracteres.");
        return;
      }

      const { data: userExists } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (userExists) {
        setAuthError("Esse usuario ja esta em uso.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            hunter_name: username.toUpperCase(),
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      const createdUser = data.user;
      if (!createdUser) {
        setAuthError("Conta criada. Verifique seu email para confirmar e depois faca login.");
        return;
      }

      if (!data.session) {
        setAuthError("Conta criada. Confirme o email e depois faca login.");
        setAuthMode("login");
        setAuthPass("");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: createdUser.id,
        username,
        hunter_name: username.toUpperCase(),
        avatar_url: null,
      });

      if (profileError) {
        setAuthError("Conta criada. Confirme o email e depois faca login.");
        setAuthMode("login");
        setAuthPass("");
        return;
      }

      setAuthError("Conta criada. Faca login para entrar.");
      setAuthMode("login");
      setAuthPass("");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(data.session ?? null);
    if (data.user) await loadProfile(data.user);
    setAuthPass("");
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setCurrentUserId(null);
    setCurrentUser(null);
    setAuthMode("login");
    setAuthUser("");
    setAuthEmail("");
    setAuthPass("");
    setAuthError(null);
    setActiveTab("dashboard");
  };

  const updateProfile = async () => {
    if (!supabase || !currentUserId) return;
    const cleanName = hunterNameDraft.trim();
    if (!cleanName) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        hunter_name: cleanName.toUpperCase(),
        avatar_url: avatarDataUrl,
      })
      .eq("id", currentUserId);

    if (error) {
      setSocialFeedback("Nao foi possivel salvar o perfil.");
      return;
    }

    setHunterName(cleanName.toUpperCase());
    await loadProfile({ id: currentUserId, user_metadata: { username: currentUser, hunter_name: cleanName.toUpperCase() } });
    await loadSocialData(currentUserId);
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setAvatarDataUrl(result);
    };

    reader.readAsDataURL(file);
  };

  const addFriend = async () => {
    if (!supabase || !currentUserId) return;

    const username = friendInput.trim().toLowerCase();
    if (!username) {
      setSocialFeedback("Digite um usuario para adicionar.");
      return;
    }

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, username, hunter_name, avatar_url")
      .eq("username", username)
      .maybeSingle();

    if (targetError || !target) {
      setSocialFeedback("Usuario nao encontrado.");
      return;
    }

    if (target.id === currentUserId) {
      setSocialFeedback("Voce nao pode adicionar a si mesmo.");
      return;
    }

    const { data: existing } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${currentUserId})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending" && existing.requester_id === target.id) {
        await supabase.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
        setSocialFeedback("Solicitacao aceita automaticamente.");
      } else {
        setSocialFeedback("VocÃªs ja tem uma conexao pendente ou ativa.");
      }
      await loadSocialData(currentUserId);
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: target.id,
      status: "pending",
    });

    if (error) {
      setSocialFeedback("Erro ao enviar solicitacao.");
      return;
    }

    setSocialFeedback("Solicitacao enviada.");
    setFriendInput("");
    await loadSocialData(currentUserId);
  };

  const acceptFriend = async (friendshipId: string) => {
    if (!supabase || !currentUserId) return;
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)
      .eq("addressee_id", currentUserId);
    await loadSocialData(currentUserId);
  };

  const removeFriend = async (friendshipId: string) => {
    if (!supabase || !currentUserId) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadSocialData(currentUserId);
  };

  const publishStatusSnapshot = async (levelSnapshot: number, powerSnapshot: number) => {
    if (!supabase || !currentUserId) return;

    await supabase.from("posts").insert({
      author_id: currentUserId,
      hunter_name_snapshot: hunterName,
      avatar_url_snapshot: avatarDataUrl,
      content: `STATUS ${getRankByPower(powerSnapshot)} | LV ${levelSnapshot} | PWR ${powerSnapshot}`,
      level_snapshot: levelSnapshot,
      power_snapshot: powerSnapshot,
    });

    await loadSocialData(currentUserId);
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
    const questCategory = QUEST_CATEGORY_MAP[newQuest.category];
    const quest: Quest = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      title: newQuest.title.trim(),
      difficulty: newQuest.difficulty,
      category: newQuest.category,
      statIndexes: questCategory.statIndexes,
      xpGain: diff.xp,
      statGain: diff.stat,
      completed: false,
    };

    setQuests((prev) => [quest, ...prev]);
    setShowAddQuest(false);
    setNewQuest({ title: "", difficulty: "Medio", category: "Corpo" });
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

    const nextStats = stats.map((s, i) => {
      const idxInQuest = quest.statIndexes.indexOf(i);
      if (idxInQuest === -1) return s;

      const gain = idxInQuest === 0 ? quest.statGain : Math.max(1, Math.floor(quest.statGain * 0.6));
      return { ...s, A: clamp(s.A + gain, 0, 100) };
    });
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

    const nextPower = Math.floor(nextStats.reduce((acc, curr) => acc + curr.A, 0) * (nextLevel / 5) + relicBonus);

    setXp(clamp(nextXp, 0, 99));
    setLevel(nextLevel);
    setStats(nextStats);
    setQuests(nextQuests);
    setActivityLog(nextLog);
    setBossHp(nextBossHp);
    setBossDefeated(nextBossDef);

    void publishStatusSnapshot(nextLevel, nextPower);
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
        prev.map((s, i) => (i === 3 ? { ...s, A: clamp(s.A + item.value, 0, 100) } : s))
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

  const resetProgress = () => {
    if (!window.confirm("Tem certeza que deseja resetar todo o progresso?")) return;

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    setXp(0);
    setLevel(1);
    setStats(BASE_STATS);
    setActivityLog({});
    setBossHp(20);
    setBossDefeated(false);
    setQuests([]);
    setShowAddQuest(false);
    setNewQuest({ title: "", difficulty: "Medio", category: "Corpo" });
    setInventory([]);
    setGold(60);
    setActiveRelicId(null);
    setLootResult(null);
    setActiveTab("dashboard");
  };

  if (!isClient) return null;

  if (!isSupabaseConfigured) {
    return (
      <div className="cyber-bg min-h-screen px-3 py-6 md:px-6 lg:px-10 text-slate-100">
        <div className="mx-auto max-w-md">
          <p className="hud-topline">SISTEMA SOLO LEVELING</p>
          <section className="hud-panel p-6 space-y-3">
            <h1 className="hud-title text-cyan-200"><UserRound size={16} /> Configurar Supabase</h1>
            <p className="text-sm text-slate-300">Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.</p>
          </section>
        </div>
      </div>
    );
  }

  if (authLoading || !session || !currentUser) {
    return (
      <div className="cyber-bg min-h-screen px-3 py-6 md:px-6 lg:px-10 text-slate-100">
        <div className="mx-auto max-w-md">
          <p className="hud-topline">SISTEMA SOLO LEVELING</p>
          <section className="hud-panel p-6">
            <h1 className="hud-title text-cyan-200 mb-4">
              <UserRound size={16} /> Acesso do Cacador
            </h1>
            <div className="hud-tabs mb-4">
              <button onClick={() => setAuthMode("login")} className={`hud-tab flex-1 ${authMode === "login" ? "hud-tab-active" : ""}`}>Login</button>
              <button onClick={() => setAuthMode("register")} className={`hud-tab flex-1 ${authMode === "register" ? "hud-tab-active" : ""}`}>Cadastro</button>
            </div>
            <div className="space-y-3">
              <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" className="hud-input" />
              {authMode === "register" && (
                <input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="Usuario publico" className="hud-input" />
              )}
              <input value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder="Senha" type="password" className="hud-input" />
              {authError && <p className="text-xs text-rose-300">{authError}</p>}
              <button onClick={() => void handleAuth()} className="hud-action-btn" disabled={authLoading}>{authMode === "login" ? "ENTRAR" : "CRIAR CONTA"}</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const rank = getRank();

  return (
    <div className="cyber-bg min-h-screen text-slate-100 px-3 py-4 md:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="hud-topline">SISTEMA SOLO LEVELING</p>

        <header className="hud-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              <div className="hud-avatar overflow-hidden">
                {avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarDataUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="text-cyan-300" size={20} />
                )}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-[0.08em] text-cyan-200">{hunterName}</h1>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-fuchsia-300">{rank.title}</p>
                <p className="mt-2 text-sm text-slate-400 italic">"Iniciado das sombras"</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-300">Nivel {level}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 min-w-56">
              <div className="hud-chip">
                <span>POWER</span>
                <strong className="text-cyan-300">{powerScore}</strong>
              </div>
              <div className="hud-chip">
                <span>GOLD</span>
                <strong className="text-amber-300">{gold}</strong>
              </div>
              <div className="hud-chip">
                <span>SEQUENCIA</span>
                <strong className="text-orange-300">{todayActivity}d</strong>
              </div>
              <div className="hud-chip">
                <span>MISSOES</span>
                <strong className="text-emerald-300">{completedQuests.length}/{quests.length}</strong>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-slate-300">
              <span>XP</span>
              <span>{xp} / {xpToLevel}</span>
            </div>
            <div className="hud-progress mt-2">
              <div className="hud-progress-fill" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
        </header>

        <nav className="mt-4 hud-tabs lg:hidden">
          <button onClick={() => setActiveTab("dashboard")} className={`hud-tab ${activeTab === "dashboard" ? "hud-tab-active" : ""}`}>
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button onClick={() => setActiveTab("analytics")} className={`hud-tab ${activeTab === "analytics" ? "hud-tab-active" : ""}`}>
            <BarChart3 size={16} /> Analytics
          </button>
          <button onClick={() => setActiveTab("inventory")} className={`hud-tab ${activeTab === "inventory" ? "hud-tab-active" : ""}`}>
            <Backpack size={16} /> Inventario
          </button>
          <button onClick={() => setActiveTab("social")} className={`hud-tab ${activeTab === "social" ? "hud-tab-active" : ""}`}>
            <Users size={16} /> Social
          </button>
          <button onClick={() => setActiveTab("settings")} className={`hud-tab ${activeTab === "settings" ? "hud-tab-active" : ""}`}>
            <Settings2 size={16} /> Config
          </button>
        </nav>

        <div className="mt-4 grid gap-4 lg:grid-cols-[250px_1fr]">
          <aside className="hidden lg:block">
            <div className="hud-panel p-3 sticky top-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-3">Navegacao</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setActiveTab("dashboard")} className={`hud-tab w-full justify-start ${activeTab === "dashboard" ? "hud-tab-active" : ""}`}>
                  <LayoutDashboard size={16} /> Dashboard
                </button>
                <button onClick={() => setActiveTab("analytics")} className={`hud-tab w-full justify-start ${activeTab === "analytics" ? "hud-tab-active" : ""}`}>
                  <BarChart3 size={16} /> Analytics
                </button>
                <button onClick={() => setActiveTab("inventory")} className={`hud-tab w-full justify-start ${activeTab === "inventory" ? "hud-tab-active" : ""}`}>
                  <Backpack size={16} /> Inventario
                </button>
                <button onClick={() => setActiveTab("social")} className={`hud-tab w-full justify-start ${activeTab === "social" ? "hud-tab-active" : ""}`}>
                  <Users size={16} /> Social
                </button>
                <button onClick={() => setActiveTab("settings")} className={`hud-tab w-full justify-start ${activeTab === "settings" ? "hud-tab-active" : ""}`}>
                  <Settings2 size={16} /> Configuracoes
                </button>
              </div>

              <div className="hud-subpanel p-3 mt-4 text-xs text-slate-400">
                Dica: use a aba Configuracoes para resetar o progresso com seguranca.
              </div>
            </div>
          </aside>

          <main>
            {activeTab === "dashboard" && (
              <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
                <section className="hud-panel p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="hud-title">MISSOES DIARIAS</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{completedQuests.length}/{quests.length}</span>
                      <button onClick={() => setShowAddQuest((v) => !v)} className="hud-icon-btn">
                        {showAddQuest ? <X size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  </div>

                  {showAddQuest && (
                    <div className="hud-subpanel p-3 mb-3 space-y-2">
                      <input
                        value={newQuest.title}
                        onChange={(e) => setNewQuest((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Nome da missao"
                        className="hud-input"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newQuest.difficulty}
                          onChange={(e) => setNewQuest((p) => ({ ...p, difficulty: normalizeDifficulty(e.target.value) }))}
                          className="hud-input"
                        >
                          <option>Facil</option>
                          <option>Medio</option>
                          <option>Dificil</option>
                          <option>Extremo</option>
                        </select>
                        <select
                          value={newQuest.category}
                          onChange={(e) => setNewQuest((p) => ({ ...p, category: e.target.value as QuestCategory }))}
                          className="hud-input"
                        >
                          {Object.keys(QUEST_CATEGORY_MAP).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={handleAddQuest} className="hud-action-btn">FORJAR MISSAO</button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
                    {activeQuests.length === 0 && (
                      <div className="hud-subpanel p-4 text-sm text-slate-400">Sem missoes ativas.</div>
                    )}
                    {activeQuests.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => completeQuest(q.id)}
                        className={`hud-quest ${DIFFICULTY_MAP[q.difficulty].border}`}
                      >
                        <div className="h-8 w-8 rounded-full border border-slate-700/80" />
                        <div className="flex-1 text-left">
                          <h4 className="font-bold text-lg leading-none">{q.title}</h4>
                          <p className={`mt-2 text-xs uppercase tracking-[0.2em] ${DIFFICULTY_MAP[q.difficulty].color}`}>
                            {q.difficulty} +{q.xpGain} XP | {q.category} | {STAT_NAMES[q.statIndexes[0]]} + {STAT_NAMES[q.statIndexes[1]] || STAT_NAMES[q.statIndexes[0]]}
                          </p>
                        </div>
                        <Target size={16} className="text-cyan-400" />
                      </button>
                    ))}
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-3">MATRIZ DE ATRIBUTOS</h3>
                    <div className="h-64">
                      <ResponsiveContainer>
                        <RadarChart data={stats}>
                          <PolarGrid stroke="#1f2a4f" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: "#7ec8ff", fontSize: 10 }} />
                          <Radar dataKey="A" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                      {stats.map((s) => (
                        <div key={s.subject} className="hud-stat-mini">
                          <span>{statAbbr(s.subject)}</span>
                          <strong>{s.A}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="hud-panel p-4">
                    <div className="flex items-center gap-2">
                      {bossDefeated ? <Trophy size={14} className="text-amber-300" /> : <Skull size={14} className="text-rose-400" />}
                      <h3 className="hud-title text-rose-300">BOSS SEMANAL</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Complete 20 habitos esta semana</p>
                    <div className="hud-progress mt-3">
                      <div className="h-full bg-gradient-to-r from-rose-600 to-red-400" style={{ width: `${(bossHp / 20) * 100}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-slate-400">{20 - bossHp}/20</span>
                      <span className="text-rose-300">{bossDefeated ? "DERROTADO" : `${bossHp} RESTANTES`}</span>
                    </div>
                  </section>

                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-3">LOOT LAB</h3>
                    <button onClick={openSupplyCrate} disabled={gold < 25} className="hud-action-btn disabled:opacity-40">
                      <PackageOpen size={14} /> ABRIR CAIXA (25 GOLD)
                    </button>
                    <p className="text-xs text-slate-400 mt-2">Drops aleatorios por raridade.</p>
                  </section>
                </aside>
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-3"><TrendingUp size={14} /> ATIVIDADE (7 DIAS)</h3>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <AreaChart data={activitySeries}>
                        <CartesianGrid stroke="#1f2a4f" vertical={false} strokeDasharray="4 4" />
                        <XAxis dataKey="day" stroke="#6ea7d8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 6]} allowDecimals={false} stroke="#6ea7d8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#050b1f",
                            border: "1px solid #1f2a4f",
                            borderRadius: "10px",
                            color: "#cdeaff",
                          }}
                        />
                        <Area dataKey="count" type="monotone" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-3"><Activity size={14} /> ESTATISTICAS DE COMBATE</h3>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={stats}>
                        <CartesianGrid stroke="#1f2a4f" vertical={false} strokeDasharray="4 4" />
                        <XAxis dataKey="subject" stroke="#6ea7d8" fontSize={10} tickLine={false} axisLine={false} />
                        <Bar dataKey="A" fill="#00d9ff" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "inventory" && (
              <section className="hud-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="hud-title"><Backpack size={14} /> INVENTARIO</h3>
                  <span className="text-xs text-slate-400 uppercase tracking-[0.2em]">
                    Total {inventory.reduce((acc, item) => acc + item.qty, 0)} itens
                  </span>
                </div>

                {inventoryByRarity.length === 0 ? (
                  <div className="hud-subpanel p-8 text-center text-slate-400">Inventario vazio.</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {inventoryByRarity.map((item) => (
                      <div key={item.id} className={`hud-subpanel p-4 ${RARITY_STYLE[item.rarity].glow}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-lg leading-none">{item.name}</p>
                            <p className="mt-2 text-xs text-slate-400">{item.description}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${RARITY_STYLE[item.rarity].badge}`}>
                            {item.rarity}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-slate-400">Qtd: {item.qty}</span>
                          <div className="flex items-center gap-2">
                            {item.type === "consumivel" && (
                              <button onClick={() => useItem(item)} className="hud-mini-btn">Usar</button>
                            )}
                            {item.type === "reliquia" && (
                              <button
                                onClick={() => equipRelic(item)}
                                className={`hud-mini-btn ${activeRelicId === item.id ? "!bg-emerald-600" : "!bg-fuchsia-700"}`}
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

                        {activeTab === "social" && (
              <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-4"><Users size={14} /> RANK DE AMIGOS</h3>

                  <div className="space-y-3 max-h-[620px] overflow-auto pr-1">
                    {socialStatusBoard.length === 0 && (
                      <div className="hud-subpanel p-4 text-sm text-slate-400">
                        Sem status ainda. O ranking atualiza automaticamente quando os amigos completam missoes.
                      </div>
                    )}

                    {socialStatusBoard.map((entry, index) => (
                      <article key={entry.id} className="hud-subpanel p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg border border-cyan-500/30 bg-slate-950/70 grid place-items-center text-cyan-200 font-black">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-cyan-100">{entry.name}</p>
                            <p className="text-[11px] text-slate-500">@{entry.username}</p>
                            <p className="text-[11px] text-slate-400">Atualizado em {new Date(entry.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-300">{getRankByPower(entry.power)}</p>
                          <p className="text-lg font-black text-cyan-200">{entry.power}</p>
                          <p className="text-[11px] text-slate-400">Nivel {entry.level}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-3">AMIGOS</h3>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={friendInput}
                        onChange={(e) => setFriendInput(e.target.value)}
                        placeholder="Usuario publico do amigo"
                        className="hud-input"
                      />
                      <button onClick={() => void addFriend()} className="hud-icon-btn"><Plus size={14} /></button>
                    </div>

                    {socialFeedback && <p className="text-xs text-cyan-200 mb-3">{socialFeedback}</p>}
                    {socialLoading && <p className="text-xs text-slate-400 mb-3">Sincronizando social...</p>}

                    {pendingIncoming.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Solicitacoes recebidas</p>
                        {pendingIncoming.map((req) => (
                          <div key={req.id} className="hud-subpanel p-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-cyan-100">{profilesById[req.requester_id]?.hunter_name || "Novo Cacador"}</p>
                              <p className="text-[11px] text-slate-500">@{profilesById[req.requester_id]?.username || "usuario"}</p>
                            </div>
                            <button onClick={() => void acceptFriend(req.id)} className="hud-mini-btn !bg-emerald-700">Aceitar</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {myFriends.length === 0 && (
                        <div className="hud-subpanel p-3 text-xs text-slate-400">Nenhum amigo adicionado.</div>
                      )}

                      {myFriends.map((friend) => (
                        <div key={friend.profile.id} className="hud-subpanel p-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-cyan-100">{friend.profile.hunter_name}</p>
                            <p className="text-[11px] text-slate-500">@{friend.profile.username}</p>
                          </div>
                          <button onClick={() => void removeFriend(friend.friendshipId)} className="hud-mini-btn !bg-rose-900/60">Remover</button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-2">RESUMO SOCIAL</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="hud-chip">
                        <span>AMIGOS</span>
                        <strong className="text-cyan-200">{myFriends.length}</strong>
                      </div>
                      <div className="hud-chip">
                        <span>RANKING</span>
                        <strong className="text-fuchsia-200">{socialStatusBoard.length}</strong>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            )}
            {activeTab === "settings" && (
              <section className="hud-panel p-5 max-w-3xl">
                <h3 className="hud-title mb-4"><Settings2 size={14} /> CONFIGURACOES</h3>

                <div className="hud-subpanel p-4 space-y-4 mb-4">
                  <p className="text-sm font-semibold text-slate-200">Perfil do cacador</p>
                  <input
                    value={hunterNameDraft}
                    onChange={(e) => setHunterNameDraft(e.target.value)}
                    className="hud-input"
                    placeholder="Nome do cacador"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input type="file" accept="image/*" onChange={onAvatarChange} className="hud-input max-w-sm" />
                    <button onClick={updateProfile} className="hud-mini-btn">Salvar Perfil</button>
                    <button onClick={logout} className="hud-mini-btn !bg-slate-700">Sair</button>
                  </div>
                </div>

                <div className="hud-subpanel p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Resetar progresso</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Remove XP, nivel, missoes, inventario, boss semanal e dados salvos deste usuario.
                    </p>
                  </div>

                  <button
                    onClick={resetProgress}
                    className="hud-action-btn !border-rose-500/60 !text-rose-200 !bg-rose-900/40 hover:!border-rose-400"
                  >
                    <X size={14} /> RESETAR PROGRESSO
                  </button>

                  <p className="text-[11px] text-rose-300/90 uppercase tracking-[0.12em]">Acao irreversivel</p>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {lootResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-7 text-center">
            <Sparkles size={56} className="mx-auto text-amber-300 mb-4" />
            <h2 className="text-2xl font-black tracking-[0.1em] text-cyan-200">LOOT OBTIDO</h2>
            <p className="mt-2 text-slate-200 font-bold">{lootResult}</p>
            <button onClick={() => setLootResult(null)} className="hud-action-btn mt-5">
              COLETAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}










































































