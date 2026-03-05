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
  Award,
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  Plus,
  Settings2,
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

type Tab = "dashboard" | "analytics" | "titles" | "social" | "settings";
type Difficulty = "Facil" | "Medio" | "Dificil" | "Extremo";
type QuestCategory = "Corpo" | "Estudos" | "Trabalho" | "Negocios";
type Rarity = "Comum" | "Raro" | "Epico" | "Lendario";
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
type TitleItem = {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  xpRequired: number;
  questDropOnly?: boolean;
};
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
  totalXp: "sf_total_xp",
  level: "sf_level",
  stats: "sf_stats",
  activityLog: "sf_activity_log",
  bossHp: "sf_boss_hp",
  bossDefeated: "sf_boss_defeated",
  quests: "sf_quests",
  titles: "sf_titles_v1",
  activeTitleId: "sf_active_title_v1",
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

const DIFFICULTY_MAP: Record<Difficulty, { xp: number; stat: number; color: string; border: string }> = {
  Facil: { xp: 15, stat: 1, color: "text-emerald-300", border: "border-l-emerald-400" },
  Medio: { xp: 35, stat: 2, color: "text-cyan-300", border: "border-l-cyan-400" },
  Dificil: { xp: 70, stat: 4, color: "text-amber-300", border: "border-l-amber-400" },
  Extremo: { xp: 120, stat: 7, color: "text-fuchsia-300", border: "border-l-fuchsia-400" },
};

const RARITY_STYLE: Record<Rarity, { badge: string; glow: string }> = {
  Comum: { badge: "bg-slate-700 text-slate-200", glow: "shadow-slate-700/20" },
  Raro: { badge: "bg-cyan-950 text-cyan-300", glow: "shadow-cyan-500/30" },
  Epico: { badge: "bg-fuchsia-950 text-fuchsia-300", glow: "shadow-fuchsia-500/30" },
  Lendario: { badge: "bg-amber-950 text-amber-300", glow: "shadow-amber-500/30" },
};

const TITLE_POOL: TitleItem[] = [
  { id: "initiate", name: "Iniciado das Sombras", rarity: "Comum", description: "Primeiro passo de um cacador disciplinado.", xpRequired: 0 },
  { id: "rising_hunter", name: "Cacador Ascendente", rarity: "Comum", description: "Conquistado por consistencia diaria.", xpRequired: 300 },
  { id: "iron_blood", name: "Sangue de Ferro", rarity: "Raro", description: "Domina o corpo e mantem foco absoluto.", xpRequired: 900 },
  { id: "crown_of_merit", name: "Coroa do Merito", rarity: "Raro", description: "Reconhecimento pelo crescimento constante.", xpRequired: 1700 },
  { id: "mind_emperor", name: "Imperador da Mente", rarity: "Epico", description: "Controle total sobre estrategia e inteligencia.", xpRequired: 2800 },
  { id: "sovereign_archon", name: "Soberano Arcano", rarity: "Lendario", description: "Lenda viva entre os cacadores.", xpRequired: 4500 },
  { id: "void_reaper", name: "Ceifador do Vazio", rarity: "Lendario", description: "Titulo raro obtido por drop em missao.", xpRequired: 0, questDropOnly: true },
  { id: "oracle_of_stars", name: "Oraculo Estelar", rarity: "Epico", description: "Titulo secreto obtido por chance em missao.", xpRequired: 0, questDropOnly: true },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const safeInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
const xpToNextLevel = (lv: number) => Math.floor(100 + Math.pow(lv, 1.4) * 35);
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
  const [totalXp, setTotalXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<Stat[]>(BASE_STATS);
  const [activityLog, setActivityLog] = useState<Record<string, number>>({});
  const [bossHp, setBossHp] = useState(20);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [showAddQuest, setShowAddQuest] = useState(false);
  const [newQuest, setNewQuest] = useState<{ title: string; difficulty: Difficulty; category: QuestCategory }>({ title: "", difficulty: "Medio", category: "Corpo" });

  const [titles, setTitles] = useState<TitleItem[]>(() => TITLE_POOL.filter((t) => t.id === "initiate"));
  const [activeTitleId, setActiveTitleId] = useState<string>("initiate");
  const [titleDropResult, setTitleDropResult] = useState<string | null>(null);

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [socialFeedback, setSocialFeedback] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  const powerScore = Math.floor(stats.reduce((acc, curr) => acc + curr.A, 0) * (level / 4.5));
  const xpToLevel = xpToNextLevel(level);
  const xpPercent = clamp((xp / xpToLevel) * 100, 0, 100);
  const activeQuests = useMemo(() => quests.filter((q) => !q.completed), [quests]);
  const completedQuests = useMemo(() => quests.filter((q) => q.completed), [quests]);
  const equippedTitle = useMemo(() => titles.find((t) => t.id === activeTitleId) || titles[0] || TITLE_POOL[0], [titles, activeTitleId]);

  const activitySeries = useMemo(() => {
    const days = getLastDays(7);
    return days.map((d) => ({ day: d.label, count: activityLog[d.iso] || 0 }));
  }, [activityLog]);

  const getRank = (score: number) => {
    if (score < 80) return "RANK E";
    if (score < 220) return "RANK D";
    if (score < 500) return "RANK C";
    if (score < 900) return "RANK B";
    if (score < 1600) return "RANK A";
    return "RANK S";
  };

  const acceptedFriendships = useMemo(() => friendships.filter((f) => f.status === "accepted"), [friendships]);
  const pendingIncoming = useMemo(() => friendships.filter((f) => f.status === "pending" && f.addressee_id === currentUserId), [friendships, currentUserId]);

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
    if (!currentUserId) {
      return [] as Array<{ id: string; name: string; username: string; level: number; power: number; createdAt: string; avatarUrl: string | null }>;
    }

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
          avatarUrl: profile?.avatar_url || post.avatar_url_snapshot || null,
        };
      })
      .sort((a, b) => b.power - a.power || b.level - a.level);
  }, [socialPosts, myFriends, currentUserId, profilesById]);

  const grantTitle = (title: TitleItem, sourceLabel: string) => {
    setTitles((prev) => {
      if (prev.some((t) => t.id === title.id)) return prev;
      return [...prev, title];
    });
    setTitleDropResult(`${sourceLabel}: ${title.name} (${title.rarity})`);
  };

  const checkXpTitles = (nextTotalXp: number) => {
    const unlocked = TITLE_POOL.filter((t) => !t.questDropOnly && t.xpRequired <= nextTotalXp);
    unlocked.forEach((title) => {
      if (!titles.some((owned) => owned.id === title.id)) grantTitle(title, "Titulo por XP");
    });
  };

  const tryQuestTitleDrop = () => {
    if (Math.random() > 0.05) return;
    const pool = TITLE_POOL.filter((t) => t.questDropOnly && !titles.some((owned) => owned.id === t.id));
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    grantTitle(picked, "Drop de Missao");
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

    const fallbackProfile: Profile = {
      id: userId,
      username: metadataUsername.length >= 3 ? metadataUsername : `user_${userId.slice(0, 8)}`,
      hunter_name: metadataHunterRaw.trim() || (metadataUsername.length >= 3 ? metadataUsername.toUpperCase() : `USER_${userId.slice(0, 8)}`),
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
    } catch {
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
    const pending = allFriendships.filter((f) => f.status === "pending" && f.addressee_id === userId);

    const profileIds = new Set<string>([userId]);
    accepted.forEach((f) => profileIds.add(f.requester_id === userId ? f.addressee_id : f.requester_id));
    pending.forEach((f) => profileIds.add(f.requester_id));

    const ids = [...profileIds];
    let map: Record<string, Profile> = {};
    if (ids.length > 0) {
      const { data: profileRows } = await supabase.from("profiles").select("id, username, hunter_name, avatar_url").in("id", ids);
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

  const publishStatusSnapshot = async (levelSnapshot: number, powerSnapshot: number) => {
    if (!supabase || !currentUserId) return;

    await supabase.from("posts").insert({
      author_id: currentUserId,
      hunter_name_snapshot: hunterName,
      avatar_url_snapshot: avatarDataUrl,
      content: `STATUS ${getRank(powerSnapshot)} | LV ${levelSnapshot} | PWR ${powerSnapshot}`,
      level_snapshot: levelSnapshot,
      power_snapshot: powerSnapshot,
    });

    await loadSocialData(currentUserId);
  };

  useEffect(() => {
    setIsClient(true);

    setXp(Math.max(0, safeInt(localStorage.getItem(STORAGE_KEYS.xp), 0)));
    setTotalXp(Math.max(0, safeInt(localStorage.getItem(STORAGE_KEYS.totalXp), 0)));
    setLevel(Math.max(1, safeInt(localStorage.getItem(STORAGE_KEYS.level), 1)));

    const loadedStats = safeParse<Stat[]>(localStorage.getItem(STORAGE_KEYS.stats), BASE_STATS);
    setStats(BASE_STATS.map((base, idx) => ({ subject: base.subject, A: clamp(loadedStats[idx]?.A ?? base.A, 0, 100) })));

    setActivityLog(safeParse<Record<string, number>>(localStorage.getItem(STORAGE_KEYS.activityLog), {}));
    setBossHp(clamp(safeInt(localStorage.getItem(STORAGE_KEYS.bossHp), 20), 0, 20));
    setBossDefeated(localStorage.getItem(STORAGE_KEYS.bossDefeated) === "true");

    const loadedQuests = safeParse<Quest[]>(localStorage.getItem(STORAGE_KEYS.quests), []);
    setQuests(loadedQuests.map((q) => {
      const difficulty = DIFFICULTY_MAP[q.difficulty] ? q.difficulty : "Medio";
      const category = QUEST_CATEGORY_MAP[q.category] ? q.category : "Corpo";
      const fallbackIndexes = QUEST_CATEGORY_MAP[category].statIndexes;
      const statIndexes = Array.isArray(q.statIndexes) && q.statIndexes.length > 0
        ? q.statIndexes.map((idx) => clamp(Number(idx) || 0, 0, STAT_NAMES.length - 1))
        : fallbackIndexes;

      return {
        id: String(q.id),
        title: String(q.title || "Missao"),
        difficulty,
        category,
        statIndexes,
        xpGain: DIFFICULTY_MAP[difficulty].xp,
        statGain: DIFFICULTY_MAP[difficulty].stat,
        completed: Boolean(q.completed),
      };
    }));

    const storedTitles = safeParse<TitleItem[]>(localStorage.getItem(STORAGE_KEYS.titles), []);
    const owned = storedTitles.length > 0 ? storedTitles : TITLE_POOL.filter((t) => t.id === "initiate");
    setTitles(owned);
    const storedActive = localStorage.getItem(STORAGE_KEYS.activeTitleId) || "initiate";
    setActiveTitleId(owned.some((t) => t.id === storedActive) ? storedActive : owned[0].id);

    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const activeSession = data.session ?? null;
      setSession(activeSession);
      if (activeSession?.user) await loadProfile(activeSession.user);
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

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STORAGE_KEYS.xp, String(xp));
    localStorage.setItem(STORAGE_KEYS.totalXp, String(totalXp));
    localStorage.setItem(STORAGE_KEYS.level, String(level));
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(activityLog));
    localStorage.setItem(STORAGE_KEYS.bossHp, String(bossHp));
    localStorage.setItem(STORAGE_KEYS.bossDefeated, String(bossDefeated));
    localStorage.setItem(STORAGE_KEYS.quests, JSON.stringify(quests));
    localStorage.setItem(STORAGE_KEYS.titles, JSON.stringify(titles));
    localStorage.setItem(STORAGE_KEYS.activeTitleId, activeTitleId);
  }, [isClient, xp, totalXp, level, stats, activityLog, bossHp, bossDefeated, quests, titles, activeTitleId]);

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

      const { data: userExists } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (userExists) {
        setAuthError("Esse usuario ja esta em uso.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, hunter_name: username.toUpperCase() } },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (!data.session) {
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

    const { error } = await supabase.from("profiles").update({ hunter_name: cleanName.toUpperCase(), avatar_url: avatarDataUrl }).eq("id", currentUserId);
    if (error) {
      setSocialFeedback("Nao foi possivel salvar o perfil.");
      return;
    }

    setHunterName(cleanName.toUpperCase());
    await loadSocialData(currentUserId);
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) setAvatarDataUrl(result);
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

    const { data: target, error: targetError } = await supabase.from("profiles").select("id, username, hunter_name, avatar_url").eq("username", username).maybeSingle();
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
        setSocialFeedback("Voces ja tem uma conexao pendente ou ativa.");
      }
      await loadSocialData(currentUserId);
      return;
    }

    const { error } = await supabase.from("friendships").insert({ requester_id: currentUserId, addressee_id: target.id, status: "pending" });
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
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId).eq("addressee_id", currentUserId);
    await loadSocialData(currentUserId);
  };

  const removeFriend = async (friendshipId: string) => {
    if (!supabase || !currentUserId) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadSocialData(currentUserId);
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

    const today = getTodayStr();
    const todayCount = activityLog[today] || 0;

    let gainedXp = quest.xpGain;
    if (todayCount >= 2) gainedXp += Math.floor(quest.xpGain * 0.15);

    let nextXp = xp + gainedXp;
    let nextLevel = level;

    while (nextXp >= xpToNextLevel(nextLevel)) {
      nextXp -= xpToNextLevel(nextLevel);
      nextLevel += 1;
      nextXp += 10;
      gainedXp += 10;
    }

    const nextStats = stats.map((s, i) => {
      const idxInQuest = quest.statIndexes.indexOf(i);
      if (idxInQuest === -1) return s;
      const gain = idxInQuest === 0 ? quest.statGain : Math.max(1, Math.floor(quest.statGain * 0.6));
      return { ...s, A: clamp(s.A + gain, 0, 100) };
    });

    const nextQuests = quests.map((q) => (q.id === id ? { ...q, completed: true } : q));
    const nextLog = { ...activityLog, [today]: clamp(todayCount + 1, 0, 6) };

    let nextBossHp = bossHp;
    let nextBossDef = bossDefeated;
    if (!bossDefeated && bossHp > 0) {
      nextBossHp -= 1;
      if (nextBossHp <= 0) {
        nextBossHp = 0;
        nextBossDef = true;
        nextXp += 220;
        gainedXp += 220;
      }
    }

    while (nextXp >= xpToNextLevel(nextLevel)) {
      nextXp -= xpToNextLevel(nextLevel);
      nextLevel += 1;
    }

    const nextTotalXp = totalXp + gainedXp;
    const nextPower = Math.floor(nextStats.reduce((acc, curr) => acc + curr.A, 0) * (nextLevel / 4.5));

    setXp(Math.max(0, nextXp));
    setTotalXp(nextTotalXp);
    setLevel(nextLevel);
    setStats(nextStats);
    setQuests(nextQuests);
    setActivityLog(nextLog);
    setBossHp(nextBossHp);
    setBossDefeated(nextBossDef);

    checkXpTitles(nextTotalXp);
    tryQuestTitleDrop();
    void publishStatusSnapshot(nextLevel, nextPower);
  };

  const resetProgress = () => {
    if (!window.confirm("Tem certeza que deseja resetar todo o progresso?")) return;

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));

    setXp(0);
    setTotalXp(0);
    setLevel(1);
    setStats(BASE_STATS);
    setActivityLog({});
    setBossHp(20);
    setBossDefeated(false);
    setQuests([]);
    setShowAddQuest(false);
    setNewQuest({ title: "", difficulty: "Medio", category: "Corpo" });
    setTitles(TITLE_POOL.filter((t) => t.id === "initiate"));
    setActiveTitleId("initiate");
    setTitleDropResult(null);
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
            <h1 className="hud-title text-cyan-200 mb-4"><UserRound size={16} /> Acesso do Cacador</h1>
            <div className="hud-tabs mb-4">
              <button onClick={() => setAuthMode("login")} className={`hud-tab flex-1 ${authMode === "login" ? "hud-tab-active" : ""}`}>Login</button>
              <button onClick={() => setAuthMode("register")} className={`hud-tab flex-1 ${authMode === "register" ? "hud-tab-active" : ""}`}>Cadastro</button>
            </div>
            <div className="space-y-3">
              <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" className="hud-input" />
              {authMode === "register" && <input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="Usuario publico" className="hud-input" />}
              <input value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder="Senha" type="password" className="hud-input" />
              {authError && <p className="text-xs text-rose-300">{authError}</p>}
              <button onClick={() => void handleAuth()} className="hud-action-btn">{authMode === "login" ? "ENTRAR" : "CRIAR CONTA"}</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-bg min-h-screen text-slate-100 px-3 py-4 md:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="hud-topline">SISTEMA SOLO LEVELING</p>

        <header className="hud-panel p-5 md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="hud-subpanel p-4">
              <h2 className="hud-title mb-2">MATRIZ DE PONTOS</h2>
              <div className="h-44">
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
                  <div key={s.subject} className="hud-stat-mini"><span>{statAbbr(s.subject)}</span><strong>{s.A}</strong></div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 min-w-56">
              <div className="hud-chip"><span>POWER</span><strong className="text-cyan-300">{powerScore}</strong></div>
              <div className="hud-chip"><span>RANK</span><strong className="text-fuchsia-300">{getRank(powerScore)}</strong></div>
              <div className="hud-chip"><span>TITULO</span><strong className="text-amber-300">{equippedTitle?.name || "-"}</strong></div>
              <div className="hud-chip"><span>XP TOTAL</span><strong className="text-emerald-300">{totalXp}</strong></div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-slate-300"><span>XP</span><span>{xp} / {xpToLevel}</span></div>
            <div className="hud-progress mt-2"><div className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300" style={{ width: `${xpPercent}%` }} /></div>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[88px_1fr]">
          <aside className="hud-panel p-2 lg:p-3 h-fit">
            <div className="grid grid-cols-5 lg:grid-cols-1 gap-2">
              <button onClick={() => setActiveTab("dashboard")} className={`hud-icon-btn ${activeTab === "dashboard" ? "hud-icon-btn-active" : ""}`}><LayoutDashboard size={16} /></button>
              <button onClick={() => setActiveTab("analytics")} className={`hud-icon-btn ${activeTab === "analytics" ? "hud-icon-btn-active" : ""}`}><BarChart3 size={16} /></button>
              <button onClick={() => setActiveTab("titles")} className={`hud-icon-btn ${activeTab === "titles" ? "hud-icon-btn-active" : ""}`}><Award size={16} /></button>
              <button onClick={() => setActiveTab("social")} className={`hud-icon-btn ${activeTab === "social" ? "hud-icon-btn-active" : ""}`}><Users size={16} /></button>
              <button onClick={() => setActiveTab("settings")} className={`hud-icon-btn ${activeTab === "settings" ? "hud-icon-btn-active" : ""}`}><Settings2 size={16} /></button>
            </div>
          </aside>

          <main className="space-y-4">
            {activeTab === "dashboard" && (
              <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
                <section className="hud-panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="hud-title"><Target size={14} /> MISSOES DIARIAS</h3>
                    <button onClick={() => setShowAddQuest((v) => !v)} className="hud-icon-btn"><Plus size={14} /></button>
                  </div>

                  {showAddQuest && (
                    <div className="hud-subpanel p-4 mb-3 space-y-3">
                      <input value={newQuest.title} onChange={(e) => setNewQuest((p) => ({ ...p, title: e.target.value }))} placeholder="Nome da missao" className="hud-input" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select value={newQuest.difficulty} onChange={(e) => setNewQuest((p) => ({ ...p, difficulty: e.target.value as Difficulty }))} className="hud-input">
                          <option>Facil</option><option>Medio</option><option>Dificil</option><option>Extremo</option>
                        </select>
                        <select value={newQuest.category} onChange={(e) => setNewQuest((p) => ({ ...p, category: e.target.value as QuestCategory }))} className="hud-input">
                          {Object.keys(QUEST_CATEGORY_MAP).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <button onClick={handleAddQuest} className="hud-action-btn">FORJAR MISSAO</button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[580px] overflow-auto pr-1">
                    {activeQuests.length === 0 && <div className="hud-subpanel p-4 text-sm text-slate-400">Sem missoes ativas.</div>}
                    {activeQuests.map((q) => (
                      <button key={q.id} onClick={() => completeQuest(q.id)} className={`hud-quest ${DIFFICULTY_MAP[q.difficulty].border}`}>
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

                    {completedQuests.length > 0 && (
                      <div className="pt-3 border-t border-slate-800/70 space-y-2">
                        {completedQuests.slice(0, 6).map((q) => (
                          <div key={q.id} className="hud-subpanel p-3 flex items-center justify-between opacity-70">
                            <p className="text-sm line-through text-slate-400">{q.title}</p>
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="hud-panel p-4">
                    <div className="flex items-center gap-2">
                      {bossDefeated ? <Trophy size={14} className="text-amber-300" /> : <Skull size={14} className="text-rose-400" />}
                      <h3 className="hud-title text-rose-300">BOSS SEMANAL</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Complete 20 habitos esta semana</p>
                    <div className="hud-progress mt-3"><div className="h-full bg-gradient-to-r from-rose-600 to-red-400" style={{ width: `${(bossHp / 20) * 100}%` }} /></div>
                    <div className="flex justify-between mt-2 text-xs"><span className="text-slate-400">{20 - bossHp}/20</span><span className="text-rose-300">{bossDefeated ? "DERROTADO" : `${bossHp} RESTANTES`}</span></div>
                  </section>

                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-3">TITULO ATIVO</h3>
                    <p className="text-sm font-bold text-cyan-100">{equippedTitle?.name || "Sem titulo"}</p>
                    <p className="text-xs text-slate-400 mt-2">{equippedTitle?.description || "Conquiste titulos por XP e missao."}</p>
                  </section>

                  <section className="hud-panel p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="hud-title"><Users size={14} /> PREVIEW SOCIAL</h3>
                      <button onClick={() => setActiveTab("social")} className="hud-mini-btn">Abrir</button>
                    </div>
                    <div className="space-y-2">
                      {socialStatusBoard.slice(0, 3).map((entry, i) => (
                        <div key={entry.id} className="hud-subpanel p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full overflow-hidden border border-cyan-500/40 bg-slate-950/80">
                              {entry.avatarUrl ? <img src={entry.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-[10px] text-slate-400">?</div>}
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">#{i + 1} @{entry.username}</p>
                              <p className="text-sm font-bold text-cyan-100">{entry.name}</p>
                            </div>
                          </div>
                          <div className="text-right"><p className="text-xs text-fuchsia-300">{getRank(entry.power)}</p><p className="text-sm font-black text-cyan-200">{entry.power}</p></div>
                        </div>
                      ))}
                      {socialStatusBoard.length === 0 && <div className="hud-subpanel p-3 text-xs text-slate-400">Sem dados sociais ainda.</div>}
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-3"><TrendingUp size={14} /> ATIVIDADE (7 DIAS)</h3>
                  <div className="h-72"><ResponsiveContainer><AreaChart data={activitySeries}><CartesianGrid stroke="#1f2a4f" vertical={false} strokeDasharray="4 4" /><XAxis dataKey="day" stroke="#6ea7d8" fontSize={11} tickLine={false} axisLine={false} /><YAxis domain={[0, 6]} allowDecimals={false} stroke="#6ea7d8" fontSize={11} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#050b1f", border: "1px solid #1f2a4f", borderRadius: "10px", color: "#cdeaff" }} /><Area dataKey="count" type="monotone" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
                </section>

                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-3"><Activity size={14} /> ESTATISTICAS DE COMBATE</h3>
                  <div className="h-72"><ResponsiveContainer><BarChart data={stats}><CartesianGrid stroke="#1f2a4f" vertical={false} strokeDasharray="4 4" /><XAxis dataKey="subject" stroke="#6ea7d8" fontSize={10} tickLine={false} axisLine={false} /><Bar dataKey="A" fill="#00d9ff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
              </div>
            )}

            {activeTab === "titles" && (
              <section className="hud-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 className="hud-title"><Award size={14} /> TITULOS</h3><span className="text-xs text-slate-400 uppercase tracking-[0.2em]">{titles.length} desbloqueados</span></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {titles.slice().sort((a, b) => a.xpRequired - b.xpRequired).map((title) => (
                    <div key={title.id} className={`hud-subpanel p-4 ${RARITY_STYLE[title.rarity].glow}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="font-bold text-lg leading-none">{title.name}</p><p className="mt-2 text-xs text-slate-400">{title.description}</p></div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${RARITY_STYLE[title.rarity].badge}`}>{title.rarity}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">XP req: {title.xpRequired}</span>
                        <button onClick={() => setActiveTitleId(title.id)} className={`hud-mini-btn ${activeTitleId === title.id ? "!bg-emerald-700" : ""}`}>{activeTitleId === title.id ? "Ativo" : "Ativar"}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "social" && (
              <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <section className="hud-panel p-5">
                  <h3 className="hud-title mb-4"><Users size={14} /> RANK DE AMIGOS</h3>
                  <div className="space-y-3 max-h-[620px] overflow-auto pr-1">
                    {socialStatusBoard.length === 0 && <div className="hud-subpanel p-4 text-sm text-slate-400">Sem status ainda. O ranking atualiza quando os amigos completam missoes.</div>}
                    {socialStatusBoard.map((entry, index) => (
                      <article key={entry.id} className="hud-subpanel p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-cyan-500/40 bg-slate-950/80">{entry.avatarUrl ? <img src={entry.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-cyan-200 font-black">#{index + 1}</div>}</div>
                          <div>
                            <p className="text-sm font-bold text-cyan-100">{entry.name}</p>
                            <p className="text-[11px] text-slate-500">@{entry.username}</p>
                            <p className="text-[11px] text-slate-400">Atualizado em {new Date(entry.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                        <div className="text-right"><p className="text-xs uppercase tracking-[0.16em] text-fuchsia-300">{getRank(entry.power)}</p><p className="text-lg font-black text-cyan-200">{entry.power}</p><p className="text-[11px] text-slate-400">Nivel {entry.level}</p></div>
                      </article>
                    ))}
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="hud-panel p-4">
                    <h3 className="hud-title mb-3">AMIGOS</h3>
                    <div className="flex gap-2 mb-3"><input value={friendInput} onChange={(e) => setFriendInput(e.target.value)} placeholder="Usuario publico do amigo" className="hud-input" /><button onClick={() => void addFriend()} className="hud-icon-btn"><Plus size={14} /></button></div>
                    {socialFeedback && <p className="text-xs text-cyan-200 mb-3">{socialFeedback}</p>}
                    {socialLoading && <p className="text-xs text-slate-400 mb-3">Sincronizando social...</p>}

                    {pendingIncoming.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Solicitacoes recebidas</p>
                        {pendingIncoming.map((req) => (
                          <div key={req.id} className="hud-subpanel p-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full overflow-hidden border border-cyan-500/30 bg-slate-950/70">{profilesById[req.requester_id]?.avatar_url ? <img src={profilesById[req.requester_id]?.avatar_url || ""} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-[10px] text-slate-400">?</div>}</div>
                              <div><p className="text-sm font-bold text-cyan-100">{profilesById[req.requester_id]?.hunter_name || "Novo Cacador"}</p><p className="text-[11px] text-slate-500">@{profilesById[req.requester_id]?.username || "usuario"}</p></div>
                            </div>
                            <button onClick={() => void acceptFriend(req.id)} className="hud-mini-btn !bg-emerald-700">Aceitar</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {myFriends.length === 0 && <div className="hud-subpanel p-3 text-xs text-slate-400">Nenhum amigo adicionado.</div>}
                      {myFriends.map((friend) => (
                        <div key={friend.profile.id} className="hud-subpanel p-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full overflow-hidden border border-cyan-500/30 bg-slate-950/70">{friend.profile.avatar_url ? <img src={friend.profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-[10px] text-slate-400">?</div>}</div>
                            <div><p className="text-sm font-bold text-cyan-100">{friend.profile.hunter_name}</p><p className="text-[11px] text-slate-500">@{friend.profile.username}</p></div>
                          </div>
                          <button onClick={() => void removeFriend(friend.friendshipId)} className="hud-mini-btn !bg-rose-900/60">Remover</button>
                        </div>
                      ))}
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
                  <input value={hunterNameDraft} onChange={(e) => setHunterNameDraft(e.target.value)} className="hud-input" placeholder="Nome do cacador" />
                  <div className="flex flex-wrap gap-2"><input type="file" accept="image/*" onChange={onAvatarChange} className="hud-input max-w-sm" /><button onClick={updateProfile} className="hud-mini-btn">Salvar Perfil</button><button onClick={logout} className="hud-mini-btn !bg-slate-700">Sair</button></div>
                </div>
                <div className="hud-subpanel p-4 space-y-4">
                  <div><p className="text-sm font-semibold text-slate-200">Resetar progresso</p><p className="text-xs text-slate-400 mt-1">Remove XP, nivel, missoes, titulos, boss semanal e dados salvos.</p></div>
                  <button onClick={resetProgress} className="hud-action-btn !border-rose-500/60 !text-rose-200 !bg-rose-900/40 hover:!border-rose-400"><X size={14} /> RESETAR PROGRESSO</button>
                  <p className="text-[11px] text-rose-300/90 uppercase tracking-[0.12em]">Acao irreversivel</p>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {titleDropResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-7 text-center">
            <Sparkles size={56} className="mx-auto text-amber-300 mb-4" />
            <h2 className="text-2xl font-black tracking-[0.1em] text-cyan-200">TITULO OBTIDO</h2>
            <p className="mt-2 text-slate-200 font-bold">{titleDropResult}</p>
            <button onClick={() => setTitleDropResult(null)} className="hud-action-btn mt-5">FECHAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
