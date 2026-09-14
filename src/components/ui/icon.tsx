"use client";

import {
  Activity,
  Award,
  Bell,
  Bike,
  BookOpen,
  Brush,
  Building2,
  Bus,
  Camera,
  Check,
  ChevronRight,
  Coins,
  CalendarClock,
  Compass,
  Crown,
  Droplets,
  Feather,
  Flag,
  Flame,
  Footprints,
  Gift,
  Globe,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  Image as ImageIcon,
  Landmark,
  Leaf,
  Lightbulb,
  ListChecks,
  Lock,
  MapPin,
  Megaphone,
  Moon,
  Music,
  Palette,
  PartyPopper,
  Recycle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  TreePine,
  Trees,
  TrendingUp,
  Trophy,
  User,
  Users,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/*
  Küratörlü ikon kümesi.

  lucide-react bin küsur ikon taşıyor; hepsini isimden dinamik çözmek hem
  bundle'ı şişiriyor hem de yönetici ekranında anlamsız bir seçim listesi
  üretiyordu. Buradaki liste ürünün alanlarına göre seçildi: çevre, spor,
  kültür, eğitim, sosyal, şehir.

  Anahtarlar veritabanındaki `icon` metniyle eşleşiyor. Tanınmayan ad geldiğinde
  varsayılana düşülüyor — eski bir kayıt ya da elle girilmiş yanlış ad sayfayı
  kırmasın diye.
*/
export const ICONS: Record<string, LucideIcon> = {
  // Çevre
  "tree-pine": TreePine,
  trees: Trees,
  leaf: Leaf,
  recycle: Recycle,
  "trash-2": Trash2,
  droplets: Droplets,
  waves: Waves,
  sun: Sun,
  // Spor ve hareket
  footprints: Footprints,
  activity: Activity,
  bike: Bike,
  target: Target,
  flame: Flame,
  zap: Zap,
  // Kültür ve sanat
  landmark: Landmark,
  palette: Palette,
  music: Music,
  brush: Brush,
  feather: Feather,
  // Eğitim
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  lightbulb: Lightbulb,
  // Sosyal
  users: Users,
  "hand-heart": HandHeart,
  heart: Heart,
  "party-popper": PartyPopper,
  user: User,
  // Şehir
  megaphone: Megaphone,
  "building-2": Building2,
  bus: Bus,
  "map-pin": MapPin,
  "calendar-clock": CalendarClock,
  compass: Compass,
  crown: Crown,
  globe: Globe,
  shield: Shield,
  flag: Flag,
  home: Home,
  // Genel / ödül
  camera: Camera,
  image: ImageIcon,
  trophy: Trophy,
  award: Award,
  star: Star,
  sparkles: Sparkles,
  gift: Gift,
  coins: Coins,
  "list-checks": ListChecks,
  "trending-up": TrendingUp,
  timer: Timer,
  bell: Bell,
  moon: Moon,
  lock: Lock,
  check: Check,
  "chevron-right": ChevronRight,
  search: Search,
  settings: Settings,
  x: X,
};

/** Seçici ekranında gösterilecek adlar. */
export const ICON_NAMES = Object.keys(ICONS);

export const FALLBACK_ICON = "list-checks";

export function Icon({
  name,
  className,
  strokeWidth = 2.25,
}: {
  name: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = ICONS[name ?? ""] ?? ICONS[FALLBACK_ICON];
  return <Component className={className} strokeWidth={strokeWidth} aria-hidden />;
}
