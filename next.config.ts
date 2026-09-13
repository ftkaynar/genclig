import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Neden agentRules kapalı: Next 16, her "next dev" çalışmasında AGENTS.md'ye
  // kendi yönerge bloğunu ekliyor. AGENTS.md bu projede kalıcı çalışma
  // kurallarının birebir kopyası olmak zorunda (bkz. .agent/rules/genclig-kurallar.md),
  // otomatik ekleme dosyayı her seferinde kirletiyordu.
  // Denenen ve elenen alternatif: bloğu kabul edip commit etmek — kural dosyası
  // ile AGENTS.md'nin ayrışmasına ve her Next sürümünde sessiz diff'e yol açıyordu.
  agentRules: false,
};

export default nextConfig;
