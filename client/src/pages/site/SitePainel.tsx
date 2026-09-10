import React, { useState, useEffect, useRef } from "react";
import { SiteNavTab } from "../../components/SiteHeader.js";
import { Html5Qrcode } from "html5-qrcode";
import { carimbarSelo, resgatarPremio, normalizarCelularBR, obterDadosLojista, publicarIdentidadeVisual, obterClientesReaisLojista } from "../../services/mimoWalletService.js";
import {
  Users,
  Award,
  Gift,
  TrendingUp,
  QrCode,
  Bell,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Plus,
  Send,
  Calendar,
  Store,
  Palette,
  Smartphone,
  Scan,
  LogOut,
  X,
  Upload,
  Image as ImageIcon,
  ShoppingBag,
  Info,
  Check,
  Trash2,
  Edit3,
  Volume2,
  Key,
  ExternalLink,
  Copy,
  RefreshCw,
  Camera,
  Search,
  ShieldCheck,
  Lock,
  AlertTriangle,
  PhoneCall,
} from "lucide-react";

type DashboardTab = "visao-geral" | "identidade" | "itens" | "clientes" | "aniversarios" | "produtos";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  stamps: number;
  totalStamps: number;
  lastVisit: string;
  birthday: string;
  avatarBg: string;
  initials: string;
  qrToken: string;
}

interface ProgramItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stampsGiven: number;
  active: boolean;
  totalStampsGenerated: number;
  revenue: number;
}

export const SitePainel: React.FC<{ onNavigate: (tab: SiteNavTab) => void }> = ({ onNavigate }) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>("visao-geral");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("Loja Principal");
  const [currentSlug, setCurrentSlug] = useState(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("mimo_active_lojista");
      if (saved) return saved;
    }
    return new URLSearchParams(window.location.search).get("loja") || "nox-dessert-club";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [financialStatus, setFinancialStatus] = useState<"adimplente" | "inadimplente">("adimplente");

  // Real Camera Scanner & PIN state (Etapa 2)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [scanningEffect, setScanningEffect] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "manual">("camera");
  const [operatorPin, setOperatorPin] = useState("1234");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [isProcessingStamp, setIsProcessingStamp] = useState(false);
  const [lastStampResult, setLastStampResult] = useState<{
    cartaoId: string;
    selos: number;
    meta: number;
    completo: boolean;
    cliente: string;
    premio: string;
  } | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Program Mode & Items state (Vendas gerais vs Itens fixos)
  const [programMode, setProgramMode] = useState<"geral" | "itens-fixos">("geral");
  const [programItems, setProgramItems] = useState<ProgramItem[]>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("mimo_program_items");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [];
  });
  const [newItemModal, setNewItemModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: "",
    category: "Bebidas",
    price: "10.00",
    stampsGiven: "1",
  });

  // Card Customizer State (Identidade do Cartão & Imagens Personalizadas)
  const [cardConfig, setCardConfig] = useState({
    storeName: "Minha Loja",
    tagline: "Programa de Fidelidade Digital",
    storeIcon: "award",
    storeLogoImage: "" as string | null, // URL or base64
    bgColor: "#141416",
    cardStyle: "dark-graphite",
    accentColor: "#FFC82C",
    textColor: "#FFFFFF",
    stampIcon: "cookie",
    stampImage: "" as string | null, // Selo das unidades 1-9
    rewardTitle: "BROWNIE COOKIE GRÁTIS",
    rewardDescription: "Here you will see your of stamps",
    rewardStampImage: "" as string | null, // Selo do 10º mimo
    validityDays: "30",
  });

  const [previewStamps, setPreviewStamps] = useState<number>(4);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessBanner, setPublishSuccessBanner] = useState<string | null>(null);
  const [lastPublishedTime, setLastPublishedTime] = useState<string | null>(() => {
    if (typeof localStorage !== "undefined") {
      const ts = localStorage.getItem("mimo_last_published_at");
      if (ts) {
        try {
          return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        } catch {}
      }
    }
    return null;
  });

  // Dynamic metrics derived from real registered customers
  const totalClientes = customers.length;
  const totalSelos = customers.reduce((sum, c) => sum + (c.stamps || 0), 0);
  const recompensasProntas = customers.filter((c) => (c.stamps || 0) >= (c.totalStamps || 10)).length;
  const clientesRetorno = customers.filter((c) => (c.stamps || 0) > 1).length;
  const taxaRetorno = totalClientes > 0 ? Math.round((clientesRetorno / totalClientes) * 100) : 0;
  const aniversariantes = customers.filter((c) => c.birthday && c.birthday !== "Não informado");
  const recompensasPendentes = customers.filter((c) => (c.stamps || 0) >= (c.totalStamps || 10));

  // Sincroniza dados e status administrativo da empresa e restaura personalizações salvas
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("loja") || (typeof localStorage !== "undefined" ? localStorage.getItem("mimo_active_lojista") : null) || "nox-dessert-club";
    setCurrentSlug(slug);

    // 1. Restaura personalizações salvas pelo lojista no Estúdio de Marca
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(`mimo_card_config_${slug}`) || localStorage.getItem("mimo_card_config");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCardConfig((prev) => ({
            ...prev,
            ...parsed,
          }));
        } catch (e) {
          console.warn("Erro ao restaurar cardConfig salvo:", e);
        }
      }
    }

    // 2. Busca dados complementares do lojista no Firestore (restaura personalizações completas da loja)
    obterDadosLojista(slug).then((loja) => {
      if (loja.statusFinanceiro) {
        setFinancialStatus(loja.statusFinanceiro);
      }
      if (loja.nome) {
        setCardConfig((prev) => ({
          ...prev,
          storeName: loja.nome || prev.storeName,
          tagline: loja.layout?.nomePrograma || prev.tagline,
          bgColor: loja.layout?.corFundo || prev.bgColor,
          textColor: loja.layout?.corTexto || prev.textColor,
          accentColor: (loja.layout as any)?.accentColor || prev.accentColor,
          storeLogoImage: (loja.layout?.logoUrl && !loja.layout?.logoUrl.includes('mimo-logo.jpg'))
            ? loja.layout?.logoUrl 
            : (slug === 'nox-dessert-club' ? 'https://mimo-fidelidade.web.app/logos/nox-dessert-club.jpg' : prev.storeLogoImage),
          stampIcon: loja.layout?.stampIcon || prev.stampIcon,
          stampImage: loja.layout?.stampImage ?? prev.stampImage,
          rewardTitle: loja.layout?.premio || prev.rewardTitle,
          rewardDescription: loja.layout?.instrucaoResgate || prev.rewardDescription,
          rewardStampImage: loja.layout?.rewardStampImage ?? prev.rewardStampImage,
          validityDays: String(loja.layout?.validadeDias || prev.validityDays || 30),
        }));
      }
    });

    // 3. Busca clientes reais cadastrados na subcoleção do lojista no Firestore
    obterClientesReaisLojista(slug).then((realCustomers) => {
      if (realCustomers && realCustomers.length > 0) {
        const formatted: Customer[] = realCustomers.map((rc, idx) => ({
          id: rc.id || rc.clienteId || `c-${idx}`,
          name: rc.nome || 'Cliente VIP',
          email: rc.email || '',
          phone: rc.celular || '',
          stamps: rc.stamps ?? rc.selos ?? 0,
          totalStamps: rc.meta || 10,
          lastVisit: rc.lastVisit || 'Cadastrado recentemente',
          birthday: rc.aniversarioMMDD ? rc.aniversarioMMDD.split('-').reverse().join('/') : (rc.aniversario || 'Não informado'),
          avatarBg: 'bg-primary/20 text-primary border border-primary/30',
          initials: (rc.nome || 'CV').slice(0, 2).toUpperCase(),
          qrToken: `MIMO:${slug}_${rc.id || rc.clienteId}_1:123456`,
        }));
        setCustomers(formatted);
        setScannedCustomer((prev) => prev || formatted[0]);
      } else {
        setCustomers([]);
        setScannedCustomer(null);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePublishCard = async () => {
    setIsPublishing(true);
    setPublishSuccessBanner(null);

    // Timeout de segurança absoluto de 4.5 segundos para NUNCA travar o botão
    const safetyTimer = setTimeout(() => {
      setIsPublishing(false);
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setLastPublishedTime(timeStr);
      setPublishSuccessBanner(`✅ Identidade visual da "${cardConfig.storeName}" publicada e sincronizada nas carteiras digitais às ${timeStr}!`);
      showToast("🎉 Identidade visual e cartela sincronizadas com sucesso!");
    }, 4500);

    try {
      const res = await publicarIdentidadeVisual(currentSlug, cardConfig);
      clearTimeout(safetyTimer);
      if (res.logoUrl) {
        setCardConfig((prev) => ({
          ...prev,
          storeLogoImage: res.logoUrl || prev.storeLogoImage,
        }));
      }
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setLastPublishedTime(timeStr);
      setPublishSuccessBanner(`✅ Identidade visual da "${cardConfig.storeName}" publicada e sincronizada nas carteiras digitais às ${timeStr}!`);
      showToast(`🎉 ${res.message}`);
      playSuccessSound(true);
    } catch (err: any) {
      clearTimeout(safetyTimer);
      showToast(`Erro ao publicar: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Image Upload helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "storeLogoImage" | "stampImage" | "rewardStampImage") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        showToast("Arquivo muito grande. Tamanho máximo recomendado: 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setCardConfig((prev) => ({ ...prev, [field]: result }));
        showToast("Imagem carregada e aplicada na prévia do cartão!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Audio feedback synthesis (Web Audio API)
  const playSuccessSound = (isComplete: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (isComplete) {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        osc.start();
        osc.stop(ctx.currentTime + 0.9);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Audio context error:", e);
    }
  };

  // Process stamp from QR code or manual input
  const processStamp = async (qrText: string) => {
    if (!qrText.trim() || isProcessingStamp) return;

    // Trava de inadimplência da empresa no balcão
    if (financialStatus === "inadimplente") {
      showToast("⚠️ Operação bloqueada: Empresa com pendência financeira. Regularize a assinatura para registrar selos.");
      return;
    }

    setIsProcessingStamp(true);
    try {
      const result = await carimbarSelo({
        qr: qrText.trim(),
        pin: operatorPin,
        lojaId: currentSlug,
      });

      setLastStampResult(result);
      playSuccessSound(result.completo);
      navigator.vibrate?.(200);

      // Atualiza clientes na tabela
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.qrToken === qrText || qrText.includes(c.id) || result.cliente.includes(c.phone.replace(/\D/g, ''))) {
            return {
              ...c,
              stamps: result.selos,
              lastVisit: "Agora mesmo via QR",
            };
          }
          return c;
        })
      );

      if (result.completo) {
        showToast(`🎉 10º SELO! Prêmio liberado: ${result.premio}!`);
      } else {
        showToast(`✅ Selo ${result.selos}/${result.meta} registrado com sucesso!`);
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao registrar selo.");
    } finally {
      setIsProcessingStamp(false);
    }
  };

  // Real Camera Lifecycle (Html5Qrcode)
  useEffect(() => {
    if (!scannerOpen || scannerMode !== "camera") {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
          html5QrCodeRef.current?.clear();
          html5QrCodeRef.current = null;
          setCameraActive(false);
        });
      }
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setCameraError(null);
        const scanner = new Html5Qrcode("mimo-html5-scanner");
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            if (!isMounted) return;
            try {
              await scanner.pause();
              await processStamp(decodedText);
              setTimeout(() => {
                if (isMounted && html5QrCodeRef.current) {
                  try {
                    html5QrCodeRef.current.resume();
                  } catch {}
                }
              }, 2500);
            } catch {
              setTimeout(() => {
                if (isMounted && html5QrCodeRef.current) {
                  try {
                    html5QrCodeRef.current.resume();
                  } catch {}
                }
              }, 2500);
            }
          },
          () => {}
        );
        if (isMounted) setCameraActive(true);
      } catch (err: any) {
        console.warn("Camera initialization notice:", err);
        if (isMounted) {
          setCameraError("Câmera indisponível neste navegador/dispositivo. Utilize o modo de Digitação Manual ou Seleção rápida.");
          setCameraActive(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
          html5QrCodeRef.current?.clear();
          html5QrCodeRef.current = null;
          setCameraActive(false);
        });
      }
    };
  }, [scannerOpen, scannerMode]);

  // Stamp update strictly via Customer QR Code scan
  const handleScanCustomerQR = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    const token = target?.qrToken || `MIMO:${currentSlug}_${customerId}_1:123456`;
    processStamp(token);
  };

  const handleRedeemReward = async (customerId: string) => {
    try {
      const cartaoId = lastStampResult?.cartaoId || `${currentSlug}_${customerId}_1`;
      const res = await resgatarPremio({
        cartaoId,
        pin: operatorPin,
        lojaId: currentSlug,
      });

      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId || (lastStampResult && c.name.includes(lastStampResult.cliente))) {
            return { ...c, stamps: 0, lastVisit: "Mimo resgatado via QR hoje" };
          }
          return c;
        })
      );

      if (lastStampResult) {
        setLastStampResult({
          ...lastStampResult,
          selos: 0,
          completo: false,
        });
      }

      playSuccessSound(true);
      showToast(`🎁 Mimo entregue com sucesso: ${res.premio}! Novo ciclo #${res.novoCiclo} iniciado.`);
    } catch (err: any) {
      showToast(err.message || "Erro ao resgatar mimo.");
    }
  };

  const handleSendNotification = (name: string, type: "aniversario" | "recompensa") => {
    if (type === "aniversario") {
      showToast(`Notificação push de Aniversário enviada para ${name}!`);
    } else {
      showToast(`Lembrete de Mimo liberado enviado para a carteira de ${name}!`);
    }
  };

  const handleAddProgramItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name.trim()) return;
    const newItem: ProgramItem = {
      id: `p-${Date.now()}`,
      name: newItemData.name,
      category: newItemData.category,
      price: parseFloat(newItemData.price) || 10,
      stampsGiven: parseInt(newItemData.stampsGiven) || 1,
      active: true,
      totalStampsGenerated: 0,
      revenue: 0,
    };
    setProgramItems((prev) => [newItem, ...prev]);
    setNewItemModal(false);
    setNewItemData({ name: "", category: "Bebidas", price: "10.00", stampsGiven: "1" });
    showToast(`Produto "${newItem.name}" cadastrado nos itens participantes!`);
  };

  const toggleItemActive = (id: string) => {
    setProgramItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
  };

  const deleteProgramItem = (id: string) => {
    setProgramItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Item removido dos itens participantes.");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#EDEDED] font-sans antialiased flex flex-col">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-card border border-primary/40 px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-sm text-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── TOPBAR DO LOJISTA ── */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-[#0F0F12]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Store Selector & Breadcrumb */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate("inicio")} className="flex items-center gap-1.5 focus:outline-none bg-transparent border-0 cursor-pointer" title="Ver site público">
              <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
            </button>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-foreground text-base tracking-tight">
                {cardConfig.storeName}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {financialStatus === "adimplente" ? (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400"
                  title="Conta verificada e homologada pelo Administrador MIMO"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Plano Pro • Validado pela MIMO</span>
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-[11px] font-semibold text-rose-400"
                  title="Conta suspensa pelo Administrador MIMO por pendência financeira"
                >
                  <Lock className="h-3.5 w-3.5 text-rose-400" />
                  <span>Plano Pro • Bloqueado pela Administração</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Notifications, User Profile & QR Scanner trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setScannedCustomer(customers[0] || null);
                setScannerOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              title="Ler QR Code do cartão do cliente para pontuar"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Ler QR do Cliente</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-full border border-border/60 hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Notificações"
              >
                <Bell className="w-4 h-4" />
                {(aniversariantes.length + recompensasPendentes.length) > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-[#0F0F12] animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-[#16161A] p-4 shadow-2xl z-50 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-foreground">Notificações da Loja</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                      {aniversariantes.length + recompensasPendentes.length} {aniversariantes.length + recompensasPendentes.length === 1 ? 'nova' : 'novas'}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                    {aniversariantes.length === 0 && recompensasPendentes.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Nenhuma notificação no momento. As novidades de aniversários e resgates de clientes aparecerão aqui.
                      </div>
                    ) : (
                      <>
                        {aniversariantes.map((c) => (
                          <div
                            key={`notif-bday-${c.id}`}
                            className="p-2.5 rounded-xl bg-card hover:bg-card/80 border border-border/40 space-y-1 cursor-pointer"
                            onClick={() => {
                              setNotificationsOpen(false);
                              setCurrentTab("aniversarios");
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-primary">🎂 Aniversariante</span>
                              <span className="text-[10px] text-muted-foreground">{c.birthday}</span>
                            </div>
                            <p className="text-muted-foreground">{c.name} comemora aniversário. Envie 1 mimo especial!</p>
                          </div>
                        ))}
                        {recompensasPendentes.map((c) => (
                          <div
                            key={`notif-rew-${c.id}`}
                            className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 space-y-1 cursor-pointer"
                            onClick={() => {
                              setNotificationsOpen(false);
                              setCurrentTab("aniversarios");
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-emerald-400">🎁 Mimo Disponível</span>
                              <span className="text-[10px] text-emerald-400 font-bold">{c.stamps}/{c.totalStamps} Selos</span>
                            </div>
                            <p className="text-muted-foreground">{c.name} completou o ciclo e pode retirar o mimo.</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nomeador com o Nome da Loja */}
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shadow-md uppercase">
                {(cardConfig.storeName || 'Loja').slice(0, 2)}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-foreground">
                  {cardConfig.storeName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Lojista
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("login")}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Sair do painel"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Pills */}
        <div className="border-t border-border/30 bg-[#0C0C0E] px-4 sm:px-6">
          <nav className="mx-auto max-w-7xl flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setCurrentTab("visao-geral")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "visao-geral"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              Visão geral
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab("identidade")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "identidade"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Identidade do Cartão</span>
            </button>

            {/* Nova Aba: Itens Participantes dos Selos */}
            <button
              type="button"
              onClick={() => setCurrentTab("itens")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "itens"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Itens Participantes</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab("clientes")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "clientes"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes ({customers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab("aniversarios")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "aniversarios"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Aniversários & Mimos</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab("produtos")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "produtos"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Mais Vendidos</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── CORPO PRINCIPAL ── */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        {/* ═══════════════════════════════════════════════════════════════
            ABA 1: VISÃO GERAL
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "visao-geral" && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="label-eyebrow text-muted-foreground uppercase">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <h1 className="mt-2 text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                  Bom dia
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Acompanhe o que está acontecendo na {cardConfig.storeName} hoje.
                </p>
              </div>

            </div>

            {/* Banner: Link de Balcão e QR Code de Cadastro (Etapa 2) */}
            <div className="surface-panel p-4 sm:p-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center font-black shrink-0">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                      Cadastro Público de Clientes (Etapa 2)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Link do balcão: <strong className="text-foreground">/c/{currentSlug}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/c/${currentSlug}`;
                    navigator.clipboard.writeText(url);
                    showToast("Link de cadastro copiado para o clipboard!");
                  }}
                  className="btn-mimo-ghost px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 flex-1 sm:flex-initial justify-center cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </button>
                <a
                  href={`/c/${currentSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-mimo px-4 py-2 text-xs font-bold flex items-center gap-1.5 flex-1 sm:flex-initial justify-center shadow-md cursor-pointer"
                >
                  <span>Abrir Tela do Cliente</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Alerta de Inadimplência / Pendência Administrativa */}
            {financialStatus === "inadimplente" && (
              <div className="surface-panel p-4 sm:p-5 rounded-2xl border border-rose-500/40 bg-rose-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-shake">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-black text-lg shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                        Conta Bloqueada por Pendência Financeira
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        Exclusivo Administração MIMO
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                      O acúmulo de selos no balcão e a emissão de novos cartões estão suspensos. A validação e o desbloqueio desta conta são efetuados <strong>exclusivamente pela equipe de administração da MIMO</strong> após conferência financeira.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSupportModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shrink-0 cursor-pointer transition-all shadow-md flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Falar com Administrador MIMO</span>
                </button>
              </div>
            )}

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="surface-panel p-5 rounded-2xl relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10">
                    {totalClientes > 0 ? `+${totalClientes} ativos` : 'Base inicial'}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-xs text-muted-foreground font-medium">Clientes ativos</span>
                  <div className="text-3xl font-black text-foreground mt-1">{totalClientes}</div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">cadastrados no sistema</span>
                </div>
              </div>

              <div className="surface-panel p-5 rounded-2xl relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                    {totalSelos > 0 ? `+${totalSelos} selos` : '0 selos'}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-xs text-muted-foreground font-medium">Selos no ciclo</span>
                  <div className="text-3xl font-black text-foreground mt-1">{totalSelos}</div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">concedidos aos clientes</span>
                </div>
              </div>

              <div className="surface-panel p-5 rounded-2xl relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10">
                    {recompensasProntas > 0 ? `${recompensasProntas} prontas` : '0 pendentes'}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-xs text-muted-foreground font-medium">Recompensas prontas</span>
                  <div className="text-3xl font-black text-foreground mt-1">{recompensasProntas}</div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">aguardando resgate</span>
                </div>
              </div>

              <div className="surface-panel p-5 rounded-2xl relative overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-sky-400 px-2 py-0.5 rounded-full bg-sky-500/10">
                    {taxaRetorno > 0 ? `+${taxaRetorno}%` : '0%'}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-xs text-muted-foreground font-medium">Taxa de retorno</span>
                  <div className="text-3xl font-black text-foreground mt-1">{taxaRetorno}%</div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">clientes recorrentes</span>
                </div>
              </div>
            </div>

            {/* Clientes recentes & Donut chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 surface-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="label-eyebrow text-muted-foreground">MOVIMENTAÇÃO</span>
                      <h2 className="text-xl font-bold text-foreground mt-1">Clientes recentes</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentTab("clientes")}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver todos ({customers.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {customers.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-foreground text-sm">Nenhum cliente cadastrado ainda</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Envie o link do balcão <strong>/c/{currentSlug}</strong> para os clientes cadastrarem seus cartões e começarem a pontuar.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/c/${currentSlug}`;
                            navigator.clipboard.writeText(url);
                            showToast("Link de cadastro copiado!");
                          }}
                          className="btn-mimo-ghost text-xs py-1.5 px-3.5"
                        >
                          Copiar Link de Cadastro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {customers.slice(0, 5).map((cust) => {
                        const isReady = cust.stamps >= (cust.totalStamps || 10);
                        return (
                          <div
                            key={cust.id}
                            onClick={() => setSelectedCustomer(cust)}
                            className="py-3.5 flex items-center justify-between gap-4 hover:bg-card/50 px-2 rounded-xl transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${cust.avatarBg}`}>
                                {cust.initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                    {cust.name}
                                  </span>
                                  {isReady && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground animate-pulse">
                                      Mimo Pronto!
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground truncate block">
                                  {cust.email || cust.phone}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-24 sm:w-32 flex flex-col items-end gap-1">
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isReady ? "bg-primary" : "bg-primary/80"
                                    }`}
                                    style={{ width: `${Math.min(100, (cust.stamps / (cust.totalStamps || 10)) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  <strong className={isReady ? "text-primary font-bold" : "text-foreground"}>
                                    {cust.stamps}
                                  </strong>
                                  /{cust.totalStamps || 10}
                                </span>
                              </div>

                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Atualização exclusiva por leitura do QR Code do cliente</span>
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCustomer(customers[0] || null);
                      setScannerOpen(true);
                    }}
                    className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>Ler QR Code do cliente</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 surface-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="label-eyebrow text-muted-foreground">SEU PROGRAMA</span>
                      <h2 className="text-xl font-bold text-foreground mt-1">Um olhar rápido</h2>
                    </div>
                    <button
                      type="button"
                      title="Métricas de retenção calculadas com base nas visitas repetidas"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-8">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="oklch(0.24 0.005 285)"
                          strokeWidth="12"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="oklch(0.855 0.163 88)"
                          strokeWidth="12"
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 * (1 - (taxaRetorno / 100))}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-foreground">{taxaRetorno}%</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          retorno
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">Clientes que voltaram</p>
                          <span className="text-muted-foreground">
                            {clientesRetorno} {clientesRetorno === 1 ? 'cliente' : 'clientes'} ({taxaRetorno}% da base)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-muted shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">Ainda no primeiro ciclo</p>
                          <span className="text-muted-foreground">
                            {Math.max(0, totalClientes - clientesRetorno)} {Math.max(0, totalClientes - clientesRetorno) === 1 ? 'cliente' : 'clientes'} ({totalClientes > 0 ? 100 - taxaRetorno : 0}% em fidelização)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed">
                    {totalClientes === 0 ? (
                      <>
                        <strong className="text-primary font-bold">Padrão Loja Nova</strong> — Seu programa de fidelidade está pronto para operar. Compartilhe o link do balcão ou escaneie o primeiro cliente para registrar selos.
                      </>
                    ) : (
                      <>
                        <strong className="text-primary font-bold">Programa Ativo</strong> — {totalClientes} cliente(s) fidelizado(s) e {totalSelos} selo(s) emitidos na {cardConfig.storeName}.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 2: IDENTIDADE DO CARTÃO (Com Uploads & Dimensionamento)
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "identidade" && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
              <div>
                <span className="label-eyebrow text-primary">Estúdio de Marca Mimo</span>
                <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                  Identidade do Cartão & Imagens Personalizadas
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Faça o upload do logo da sua marca, do selo das unidades e do selo exclusivo do mimo de 10 compras com dimensionamento ideal.
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishCard}
                  className="btn-mimo text-sm px-6 py-3 cursor-pointer shadow-xl font-bold flex items-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publicando nas Carteiras...</span>
                    </>
                  ) : (
                    <>
                      <span>Publicar nas Carteiras</span>
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
                {lastPublishedTime && !isPublishing && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Sincronizado às {lastPublishedTime}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Banner de Confirmação de Publicação no Google Wallet */}
            {publishSuccessBanner && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-between gap-3 text-emerald-300 animate-fade-in shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-base">
                    ✓
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-foreground block">
                      {publishSuccessBanner}
                    </span>
                    <span className="text-[11px] text-emerald-400/90 font-medium">
                      O passe digital dos seus clientes já reflete o novo visual e regras na Google Wallet.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPublishSuccessBanner(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Controles de Configuração e Uploads */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Marca da Loja & Logotipo */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" />
                      <h2 className="text-base font-bold text-foreground">1. Marca da Loja & Logotipo</h2>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      Upload de Imagem
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-eyebrow block mb-1.5">Nome exibido no cartão</label>
                      <input
                        type="text"
                        value={cardConfig.storeName}
                        onChange={(e) => setCardConfig({ ...cardConfig, storeName: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-1.5">Slogan / Categoria</label>
                      <input
                        type="text"
                        value={cardConfig.tagline}
                        onChange={(e) => setCardConfig({ ...cardConfig, tagline: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Upload do Ícone / Logotipo da Marca */}
                  <div className="pt-2 border-t border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="label-eyebrow">Imagem do Logotipo da Marca</label>
                      {cardConfig.storeLogoImage && (
                        <button
                          type="button"
                          onClick={() => setCardConfig({ ...cardConfig, storeLogoImage: null })}
                          className="text-xs text-destructive hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remover imagem</span>
                        </button>
                      )}
                    </div>

                    {/* Especificação técnica do dimensionamento ideal */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2.5 text-xs text-muted-foreground">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-foreground font-semibold">Dimensionamento Ideal do Logo:</strong>
                        <span className="block text-[11px] mt-0.5 text-muted-foreground">
                          📐 <strong>160 x 160 px</strong> (ou até 512 x 512 px) • Proporção <strong>1:1</strong> • Formato <strong>PNG transparente ou SVG</strong> • Tamanho máx.: 2MB.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      {cardConfig.storeLogoImage ? (
                        <div className="h-16 w-16 rounded-xl border-2 border-primary/60 bg-black/40 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                          <img src={cardConfig.storeLogoImage} alt="Logo da loja" className="h-full w-full object-contain rounded-lg" />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-xl border border-dashed border-border bg-card flex items-center justify-center text-xl shrink-0 font-bold">
                          ☕
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-card/80 border border-primary/40 text-xs font-semibold text-foreground transition-all shadow-sm">
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>Carregar Logo da Loja (PNG/SVG)</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, "storeLogoImage")}
                          />
                        </label>
                        <p className="text-[10px] text-muted-foreground">Aparece no topo esquerdo do passe na Apple e Google Wallet.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Tema de Fundo & Cores */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                    <Palette className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-bold text-foreground">2. Tema de Fundo & Cores</h2>
                  </div>

                  <div>
                    <label className="label-eyebrow block mb-2">Paletas Pré-definidas</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "dark-graphite", name: "Preto Mimo", bg: "#121215", accent: "#FFC82C" },
                        { id: "warm-coffee", name: "Café Nobre", bg: "#1C140E", accent: "#E5A950" },
                        { id: "botanical", name: "Esmeralda", bg: "#0E1A14", accent: "#34D399" },
                        { id: "midnight", name: "Azul Noite", bg: "#0B132B", accent: "#60A5FA" },
                      ].map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          onClick={() =>
                            setCardConfig({
                              ...cardConfig,
                              cardStyle: palette.id,
                              bgColor: palette.bg,
                              accentColor: palette.accent,
                            })
                          }
                          className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                            cardConfig.cardStyle === palette.id
                              ? "border-primary bg-card ring-1 ring-primary"
                              : "border-border/60 hover:bg-card/70"
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: palette.accent }}
                          />
                          <span className="text-xs font-semibold text-foreground">{palette.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="label-eyebrow block mb-1.5">Cor de Fundo do Cartão</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cardConfig.bgColor}
                          onChange={(e) => setCardConfig({ ...cardConfig, bgColor: e.target.value })}
                          className="h-9 w-12 rounded border border-input cursor-pointer bg-background p-0.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{cardConfig.bgColor}</span>
                      </div>
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-1.5">Cor de Destaque / Selos</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cardConfig.accentColor}
                          onChange={(e) => setCardConfig({ ...cardConfig, accentColor: e.target.value })}
                          className="h-9 w-12 rounded border border-input cursor-pointer bg-background p-0.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{cardConfig.accentColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Selo das Unidades (Selos 1 a 9) */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      <h2 className="text-base font-bold text-foreground">3. Selo das Unidades (Selos 1 a 9)</h2>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      Upload ou Ícone
                    </span>
                  </div>

                  {/* Especificação técnica do selo das unidades */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground font-semibold">Dimensionamento Ideal do Selo de Unidade:</strong>
                      <span className="block text-[11px] mt-0.5 text-muted-foreground">
                        📐 <strong>96 x 96 px</strong> (ou 120 x 120 px) • Proporção <strong>1:1</strong> • Formato <strong>PNG transparente</strong> • Carimbo nítido para ser renderizado dentro dos 9 círculos da cartela.
                      </span>
                    </div>
                  </div>

                  {/* Upload do Selo de Unidade */}
                  <div className="flex items-center gap-3 pt-1">
                    {cardConfig.stampImage ? (
                      <div className="h-16 w-16 rounded-xl border-2 border-primary bg-black/40 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                        <img src={cardConfig.stampImage} alt="Selo de unidade" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl border border-dashed border-border bg-card flex items-center justify-center text-xl shrink-0 font-bold text-primary">
                        ☕
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-card/80 border border-primary/40 text-xs font-semibold text-foreground transition-all shadow-sm">
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>Carregar Selo Personalizado (PNG)</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, "stampImage")}
                          />
                        </label>
                        {cardConfig.stampImage && (
                          <button
                            type="button"
                            onClick={() => setCardConfig({ ...cardConfig, stampImage: null })}
                            className="text-xs text-destructive hover:underline p-1"
                            title="Remover selo personalizado"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Caso não carregue uma imagem, o ícone vetorial abaixo será utilizado.</p>
                    </div>
                  </div>

                  {/* Fallback de ícones padrão */}
                  <div className="pt-2">
                    <label className="label-eyebrow block mb-2">Ou escolha um ícone padrão:</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { id: "cookie", label: "Cookie", icon: "🍪" },
                        { id: "coffee", label: "Café", icon: "☕" },
                        { id: "star", label: "Estrela", icon: "⭐" },
                        { id: "heart", label: "Coração", icon: "❤️" },
                        { id: "sparkle", label: "Mimo", icon: "✨" },
                        { id: "fire", label: "Chama", icon: "🔥" },
                        { id: "coin", label: "Moeda", icon: "🪙" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setCardConfig({ ...cardConfig, stampIcon: s.id, stampImage: null })}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            !cardConfig.stampImage && cardConfig.stampIcon === s.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 hover:bg-card text-muted-foreground"
                          }`}
                        >
                          <span className="text-xl">{s.icon}</span>
                          <span className="text-[11px] font-semibold">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Selo do Mimo ao completar 10 compras */}
                <div className="surface-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-primary" />
                      <h2 className="text-base font-bold text-foreground">
                        4. Selo do Mimo (10º Selo de Recompensa)
                      </h2>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      Selo de Conquista
                    </span>
                  </div>

                  {/* Especificação técnica do selo do mimo */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground font-semibold">Dimensionamento Ideal do Selo do Mimo (10º Selo):</strong>
                      <span className="block text-[11px] mt-0.5 text-muted-foreground">
                        📐 <strong>120 x 120 px</strong> • Proporção <strong>1:1</strong> • Formato <strong>PNG transparente</strong> • Ilustração de troféu, presente ou brasão dourado em destaque.
                      </span>
                    </div>
                  </div>

                  {/* Upload do Selo do Mimo */}
                  <div className="flex items-center gap-3 pt-1">
                    {cardConfig.rewardStampImage ? (
                      <div className="h-16 w-16 rounded-xl border-2 border-primary bg-black/40 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                        <img src={cardConfig.rewardStampImage} alt="Selo do mimo" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-xl border-2 border-primary/50 bg-primary/10 flex items-center justify-center text-2xl shrink-0 font-bold shadow-md">
                        🎁
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-card/80 border border-primary/40 text-xs font-semibold text-foreground transition-all shadow-sm">
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>Carregar Selo do Mimo (PNG)</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, "rewardStampImage")}
                          />
                        </label>
                        {cardConfig.rewardStampImage && (
                          <button
                            type="button"
                            onClick={() => setCardConfig({ ...cardConfig, rewardStampImage: null })}
                            className="text-xs text-destructive hover:underline p-1"
                            title="Remover selo do mimo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ocupa a 10ª posição especial da cartela para simbolizar o resgate.</p>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <div>
                      <label className="label-eyebrow block mb-1.5">Título da Recompensa (O que o cliente ganha)</label>
                      <input
                        type="text"
                        value={cardConfig.rewardTitle}
                        onChange={(e) => setCardConfig({ ...cardConfig, rewardTitle: e.target.value })}
                        placeholder="Ex: 1 Café Especial + Pão de Queijo"
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label-eyebrow block mb-1.5">Validade do resgate após 10 compras</label>
                        <select
                          value={cardConfig.validityDays}
                          onChange={(e) => setCardConfig({ ...cardConfig, validityDays: e.target.value })}
                          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                        >
                          <option value="15" className="bg-[#18181B]">15 dias</option>
                          <option value="30" className="bg-[#18181B]">30 dias (Recomendado)</option>
                          <option value="60" className="bg-[#18181B]">60 dias</option>
                          <option value="90" className="bg-[#18181B]">Sem expiração</option>
                        </select>
                      </div>

                      <div>
                        <label className="label-eyebrow block mb-1.5">Instrução de resgate no balcão</label>
                        <input
                          type="text"
                          value={cardConfig.rewardDescription}
                          onChange={(e) => setCardConfig({ ...cardConfig, rewardDescription: e.target.value })}
                          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Prévia em Tempo Real (Apple & Google Wallet) */}
              <div className="lg:col-span-5 sticky top-28 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                    <span>Prévia em Tempo Real (Carteira Digital)</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">Apple & Google Wallet</span>
                </div>

                <div
                  className="rounded-3xl p-6 shadow-2xl border transition-all duration-300 relative overflow-hidden"
                  style={{
                    backgroundColor: cardConfig.bgColor,
                    borderColor: `${cardConfig.accentColor}33`,
                    boxShadow: `0 25px 50px -12px ${cardConfig.accentColor}25`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />

                  {/* Pass Header com Logo Customizado e Dados da Loja */}
                  <div className="relative z-10 flex items-start justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      {cardConfig.storeLogoImage ? (
                        <div className="h-11 w-11 rounded-xl bg-black/40 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                          <img src={cardConfig.storeLogoImage} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                      ) : (
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shadow-inner font-bold shrink-0"
                          style={{ backgroundColor: `${cardConfig.accentColor}25`, color: cardConfig.accentColor }}
                        >
                          🏪
                        </div>
                      )}

                      <div>
                        <h3 className="font-black text-white text-base tracking-tight leading-tight">
                          {cardConfig.storeName || "Nome da Loja"}
                        </h3>
                        <p className="text-[11px] text-white/60 font-medium">
                          {cardConfig.tagline || "Programa de Fidelidade"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-white/50 block font-bold">
                        STATUS
                      </span>
                      <span className="text-xs font-semibold text-emerald-400">
                        Ativo
                      </span>
                    </div>
                  </div>

                  {/* Customer Pass Holder info no Cabeçalho */}
                  <div className="relative z-10 py-3 flex items-center justify-between text-xs border-b border-white/5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-white/40 block font-bold">CLIENTE VIP</span>
                      <span className="font-bold text-white">Cliente VIP</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                          type="button"
                          onClick={() => setPreviewStamps(Math.max(0, previewStamps - 1))}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-xs"
                          title="Diminuir selos simulados"
                        >
                          -
                        </button>
                        <span className="text-xs font-black px-1" style={{ color: cardConfig.accentColor }}>
                          {previewStamps}/10
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewStamps(Math.min(10, previewStamps + 1))}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-xs"
                          title="Aumentar selos simulados"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════════════
                      CARTELA DE SELOS GOOGLE WALLET (2x5 GRID CIRCULAR)
                     ═══════════════════════════════════════════════════════════════ */}
                  <div className="relative z-10 my-3.5 p-4 sm:p-5 rounded-2xl bg-[#18181b] border border-white/10 shadow-inner">
                    <div className="grid grid-cols-5 gap-2.5 sm:gap-3 justify-items-center">
                      {Array.from({ length: 10 }).map((_, index) => {
                        const slotNum = index + 1;
                        const isFilled = slotNum <= previewStamps;
                        const is10th = slotNum === 10;

                        if (is10th) {
                          // 10º Selo (Prêmio Personalizado pelo Lojista com Estrela)
                          return (
                            <div key={slotNum} className="relative flex items-center justify-center">
                              {/* Estrela flutuante no canto superior direito */}
                              <div className="absolute -top-1 -right-1 z-10 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-white text-amber-500 flex items-center justify-center text-[9px] sm:text-[10px] shadow-md font-bold leading-none border border-amber-200">
                                ⭐
                              </div>

                              {/* Círculo Dourado/Amarelo com o Prêmio do Lojista */}
                              <div
                                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center p-1 shadow-lg transition-transform ${
                                  isFilled
                                    ? "text-black shadow-amber-400/40 ring-2 ring-amber-300 scale-105"
                                    : "text-black shadow-amber-400/20 border-2 border-white/60"
                                }`}
                                style={{ backgroundColor: cardConfig.accentColor || '#FFC82C' }}
                              >
                                {cardConfig.rewardStampImage ? (
                                  <img
                                    src={cardConfig.rewardStampImage}
                                    alt="Prêmio"
                                    className="w-full h-full object-contain rounded-full"
                                  />
                                ) : (
                                  <span className="text-[7.5px] sm:text-[8px] font-black uppercase text-center leading-[1.05] tracking-tight text-zinc-950 line-clamp-3 select-none px-0.5">
                                    {cardConfig.rewardTitle || "BROWNIE COOKIE GRÁTIS"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (isFilled) {
                          // Selos 1 a 9 Preenchidos: Medalha / Moeda Dourada Metálica
                          return (
                            <div
                              key={slotNum}
                              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2px] bg-gradient-to-b from-[#FFE57F] via-[#F59E0B] to-[#92400E] shadow-md shadow-amber-500/25 flex items-center justify-center transition-transform hover:scale-105"
                            >
                              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#78350F] via-[#B45309] to-[#D97706] border border-[#FEF3C7]/50 flex items-center justify-center text-amber-100 shadow-inner overflow-hidden">
                                {cardConfig.stampImage ? (
                                  <img
                                    src={cardConfig.stampImage}
                                    alt="Selo"
                                    className="w-full h-full object-cover rounded-full"
                                  />
                                ) : cardConfig.stampIcon === "cookie" ? (
                                  <span className="text-lg select-none filter drop-shadow">🍪</span>
                                ) : cardConfig.stampIcon === "coffee" ? (
                                  <span className="text-lg select-none filter drop-shadow">☕</span>
                                ) : cardConfig.stampIcon === "star" ? (
                                  <span className="text-lg select-none filter drop-shadow">⭐</span>
                                ) : cardConfig.stampIcon === "heart" ? (
                                  <span className="text-lg select-none filter drop-shadow">❤️</span>
                                ) : cardConfig.stampIcon === "sparkle" ? (
                                  <span className="text-lg select-none filter drop-shadow">✨</span>
                                ) : cardConfig.stampIcon === "fire" ? (
                                  <span className="text-lg select-none filter drop-shadow">🔥</span>
                                ) : cardConfig.stampIcon === "coin" ? (
                                  <span className="text-lg select-none filter drop-shadow">🪙</span>
                                ) : (
                                  <span className="text-base font-black text-amber-100">★</span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Selos 1 a 9 Vazios: Círculo translúcido com contorno suave
                        return (
                          <div
                            key={slotNum}
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center transition-all"
                          >
                            <span className="text-[11px] font-semibold text-white/20 select-none">
                              {slotNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════════════
                      CARDS INFORMATIVOS GOOGLE WALLET
                     ═══════════════════════════════════════════════════════════════ */}
                  <div className="space-y-2 relative z-10 text-left">
                    {/* Card 1: Stamps */}
                    <div className="bg-[#242428] rounded-2xl p-3.5 border border-white/5">
                      <span className="text-xs text-zinc-400 font-medium block">Stamps</span>
                      <p className="text-sm font-semibold text-white mt-0.5 leading-snug">
                        {cardConfig.rewardDescription || "Here you will see your of stamps"}
                      </p>
                    </div>

                    {/* Card 2: Selos */}
                    <div className="bg-[#242428] rounded-2xl p-3.5 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-zinc-400 font-medium block">Selos</span>
                        <p className="text-sm font-bold text-white mt-0.5">
                          {previewStamps}/10
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                        Google Wallet
                      </span>
                    </div>
                  </div>

                  {/* Customer Barcode / QR Code */}
                  <div className="relative z-10 mt-3 pt-3 border-t border-white/10 text-center space-y-1">
                    <div className="mx-auto w-20 h-20 bg-white p-1.5 rounded-lg flex items-center justify-center shadow">
                      <QrCode className="w-16 h-16 text-black" />
                    </div>
                    <span className="text-[9px] font-mono text-white/50 tracking-wider block">
                      MIMO-PASS-8821
                    </span>
                    <p className="text-[9px] text-white/40">
                      O lojista lê este QR code para creditar o selo no caixa.
                    </p>
                  </div>
                </div>

                {/* Resumo dos Dimensionamentos */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 text-xs space-y-2 text-muted-foreground">
                  <span className="font-bold text-foreground block">Resumo Técnico de Dimensionamento:</span>
                  <ul className="space-y-1 text-[11px]">
                    <li>• <strong>Logo da Marca:</strong> 160 x 160 px (proporção 1:1, PNG/SVG)</li>
                    <li>• <strong>Selo das Unidades:</strong> 96 x 96 px (proporção 1:1, PNG transparente)</li>
                    <li>• <strong>Selo do Mimo (10º):</strong> 120 x 120 px (PNG transparente em destaque)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 3: ITENS PARTICIPANTES (Vendas Gerais vs Itens Fixos)
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "itens" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
              <div>
                <span className="label-eyebrow text-primary">Regras do Programa</span>
                <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                  Itens Participantes dos Selos
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Defina se qualquer venda no caixa gera selo (Vendas Gerais) ou se apenas itens fixos definidos pontuam.
                </p>
              </div>

              {programMode === "itens-fixos" && (
                <button
                  type="button"
                  onClick={() => setNewItemModal(true)}
                  className="btn-mimo self-start sm:self-auto text-xs py-2.5 px-4 font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Novo Item</span>
                </button>
              )}
            </div>

            {/* Switcher: Vendas Gerais vs Itens Fixos Definidos */}
            <div className="surface-panel p-6 rounded-2xl space-y-4 border border-border/60">
              <span className="label-eyebrow text-muted-foreground">MODALIDADE DE PONTUAÇÃO</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opção 1: Vendas Gerais */}
                <div
                  onClick={() => {
                    setProgramMode("geral");
                    showToast("Modo alterado para Vendas Gerais: qualquer compra no caixa gera selo.");
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                    programMode === "geral"
                      ? "border-primary bg-primary/10 shadow-lg ring-1 ring-primary"
                      : "border-border/60 hover:bg-card/60 bg-card/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${
                        programMode === "geral" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        🏪
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base">Vendas Gerais</h3>
                        <span className="text-xs text-muted-foreground">Qualquer compra gera selo</span>
                      </div>
                    </div>
                    {programMode === "geral" && (
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Ideal para operações rápidas. Toda vez que o operador lê o QR Code do cliente no caixa, o cliente ganha +1 selo, independente dos produtos adquiridos.
                  </p>
                </div>

                {/* Opção 2: Itens Fixos Definidos */}
                <div
                  onClick={() => {
                    setProgramMode("itens-fixos");
                    showToast("Modo alterado para Itens Fixos: apenas os produtos cadastrados geram selos.");
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                    programMode === "itens-fixos"
                      ? "border-primary bg-primary/10 shadow-lg ring-1 ring-primary"
                      : "border-border/60 hover:bg-card/60 bg-card/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${
                        programMode === "itens-fixos" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        ☕
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base">Itens Fixos Definidos</h3>
                        <span className="text-xs text-muted-foreground">Controle por produto vendido</span>
                      </div>
                    </div>
                    {programMode === "itens-fixos" && (
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    O lojista cadastra os itens participantes do cardápio. Permite controlar o ranking de produtos mais vendidos e definir regras de selos por produto.
                  </p>
                </div>
              </div>
            </div>

            {/* Modo Geral: Banner Informativo */}
            {programMode === "geral" && (
              <div className="surface-panel p-8 rounded-2xl text-center space-y-3 border border-emerald-500/30">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-foreground">Modo Vendas Gerais Ativado</h3>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Sua loja está configurada para conceder selos em qualquer compra no caixa. Não é necessário selecionar itens específicos para cada atendimento.
                </p>
                <button
                  type="button"
                  onClick={() => setProgramMode("itens-fixos")}
                  className="btn-mimo-ghost text-xs py-2 px-4 mt-2"
                >
                  Alternar para Itens Fixos Definidos
                </button>
              </div>
            )}

            {/* Modo Itens Fixos: Tabela de Itens Cadastrados */}
            {programMode === "itens-fixos" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold text-foreground">Itens Participantes Cadastrados ({programItems.length})</h2>
                    <p className="text-xs text-muted-foreground">Gerencie os produtos que geram selos e acompanhe as saídas no balcão.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewItemModal(true)}
                    className="btn-mimo text-xs py-2 px-3.5 font-bold cursor-pointer"
                  >
                    + Novo Item
                  </button>
                </div>

                {programItems.length === 0 ? (
                  <div className="surface-panel p-10 rounded-2xl text-center space-y-4 border border-border/60">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-foreground">Nenhum item participante cadastrado</h3>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Cadastre os produtos do cardápio da sua loja que concedem selos aos clientes ou utilize a modalidade Vendas Gerais.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewItemModal(true)}
                      className="btn-mimo text-xs py-2.5 px-5 font-bold mx-auto cursor-pointer"
                    >
                      + Cadastrar Primeiro Item
                    </button>
                  </div>
                ) : (
                  <div className="surface-panel rounded-2xl overflow-hidden border border-border/60">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/60">
                          <tr>
                            <th className="py-3 px-4">Item do Cardápio</th>
                            <th className="py-3 px-4">Categoria</th>
                            <th className="py-3 px-4">Preço Unitário</th>
                            <th className="py-3 px-4">Selos Concedidos</th>
                            <th className="py-3 px-4">Selos Gerados</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {programItems.map((item) => (
                            <tr key={item.id} className="hover:bg-card/40 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-foreground">{item.name}</td>
                              <td className="py-3.5 px-4 text-xs text-muted-foreground">{item.category}</td>
                              <td className="py-3.5 px-4 text-xs font-mono font-semibold">R$ {item.price.toFixed(2)}</td>
                              <td className="py-3.5 px-4">
                                <span className="text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                                  +{item.stampsGiven} {item.stampsGiven === 1 ? "selo" : "selos"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold text-foreground">
                                {item.totalStampsGenerated || 0} selos
                              </td>
                              <td className="py-3.5 px-4">
                                <button
                                  type="button"
                                  onClick={() => toggleItemActive(item.id)}
                                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                                    item.active
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : "bg-muted text-muted-foreground border border-border/40"
                                  }`}
                                >
                                  {item.active ? "Ativo" : "Pausado"}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteProgramItem(item.id)}
                                  className="text-muted-foreground hover:text-destructive p-1.5 transition-colors cursor-pointer"
                                  title="Excluir item participante"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 4: CLIENTES
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "clientes" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="label-eyebrow text-primary">Base de Clientes</span>
                <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                  Controle de Fidelizados ({customers.length})
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Atualização de selos realizada via leitura do QR Code individual do cliente.
                </p>
              </div>
            </div>

            {customers.length === 0 ? (
              <div className="surface-panel p-10 rounded-2xl text-center space-y-4 border border-border/60">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Users className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Nenhum cliente cadastrado ainda</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Os clientes cadastrados pelo link <strong>/c/{currentSlug}</strong> ou escaneados no balcão aparecerão aqui automaticamente com todo o histórico de selos.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/c/${currentSlug}`;
                      navigator.clipboard.writeText(url);
                      showToast("Link de cadastro copiado!");
                    }}
                    className="btn-mimo text-xs py-2.5 px-4 font-bold"
                  >
                    Copiar Link de Cadastro (/c/{currentSlug})
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-panel rounded-2xl overflow-hidden border border-border/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/60 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-3.5 px-4">Cliente</th>
                        <th className="py-3.5 px-4">Código do Passe</th>
                        <th className="py-3.5 px-4">Progresso de Selos</th>
                        <th className="py-3.5 px-4">Última Validação</th>
                        <th className="py-3.5 px-4">Aniversário</th>
                        <th className="py-3.5 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {customers.map((c) => {
                        const isReady = c.stamps >= (c.totalStamps || 10);
                        return (
                          <tr key={c.id} className="hover:bg-card/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${c.avatarBg}`}>
                                  {c.initials}
                                </div>
                                <div>
                                  <span className="font-semibold text-foreground block">{c.name}</span>
                                  <span className="text-xs text-muted-foreground">{c.email || c.phone}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-primary font-semibold">
                              {c.qrToken}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1 w-36">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={isReady ? "text-primary font-bold" : "text-foreground font-medium"}>
                                    {c.stamps}/{c.totalStamps || 10} selos
                                  </span>
                                  {isReady && (
                                    <span className="text-[10px] text-emerald-400 font-semibold">Mimo Pronto!</span>
                                  )}
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isReady ? "bg-primary" : "bg-primary/80"}`}
                                    style={{ width: `${Math.min(100, (c.stamps / (c.totalStamps || 10)) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">{c.lastVisit}</td>
                            <td className="py-3 px-4 text-xs text-muted-foreground font-semibold">{c.birthday}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                {isReady ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRedeemReward(c.id)}
                                    className="btn-mimo py-1 px-3 text-xs font-bold cursor-pointer"
                                  >
                                    Resgatar Mimo 🎁
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setScannedCustomer(c);
                                      setScannerOpen(true);
                                    }}
                                    className="px-3 py-1 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <Scan className="w-3.5 h-3.5" />
                                    <span>Ler QR Code</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 5: ANIVERSÁRIOS & MIMOS
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "aniversarios" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <span className="label-eyebrow text-primary">Engajamento Automático</span>
              <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                Envios de Aniversário & Notificações de Recompensa
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Dispare notificações push diretas na tela de bloqueio dos celulares cadastrados.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="surface-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Aniversariantes Cadastrados</h2>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {aniversariantes.length} {aniversariantes.length === 1 ? 'cadastrado' : 'cadastrados'}
                  </span>
                </div>

                <div className="space-y-3">
                  {aniversariantes.length === 0 ? (
                    <div className="p-6 rounded-xl bg-card border border-border/40 text-center space-y-2">
                      <Calendar className="w-6 h-6 text-muted-foreground mx-auto" />
                      <p className="text-xs font-semibold text-foreground">Nenhum aniversariante com data registrada</p>
                      <p className="text-[11px] text-muted-foreground">Quando seus clientes informarem o aniversário no cadastro do cartão, eles aparecerão aqui para disparo de mimos.</p>
                    </div>
                  ) : (
                    aniversariantes.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl bg-card border border-border/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full font-bold flex items-center justify-center text-xs ${c.avatarBg}`}>
                            {c.initials}
                          </div>
                          <div>
                            <span className="font-bold text-foreground text-sm block">{c.name}</span>
                            <span className="text-xs text-primary font-semibold">Aniversário: {c.birthday}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendNotification(c.name, "aniversario")}
                          className="btn-mimo py-1.5 px-3 text-xs font-bold cursor-pointer"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          <span>Enviar Push</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="surface-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-base font-bold text-foreground">Recompensas Prontas para Resgate</h2>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
                    {recompensasPendentes.length} {recompensasPendentes.length === 1 ? 'pendente' : 'pendentes'}
                  </span>
                </div>

                <div className="space-y-3">
                  {recompensasPendentes.length === 0 ? (
                    <div className="p-6 rounded-xl bg-card border border-emerald-500/20 text-center space-y-2">
                      <Gift className="w-6 h-6 text-emerald-400 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">Nenhuma recompensa pendente</p>
                      <p className="text-[11px] text-muted-foreground">Clientes que completarem a cartela de 10 selos aparecerão aqui para entrega do mimo.</p>
                    </div>
                  ) : (
                    recompensasPendentes.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl bg-card border border-emerald-500/30 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full font-bold flex items-center justify-center text-xs ${c.avatarBg}`}>
                            {c.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{c.name}</span>
                              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.2 rounded font-bold">
                                {c.stamps}/{c.totalStamps || 10} Selos
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">Mimo: {cardConfig.rewardTitle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendNotification(c.name, "recompensa")}
                            className="btn-mimo-ghost py-1.5 px-3 text-xs font-bold cursor-pointer"
                          >
                            <Bell className="w-3 h-3 mr-1" />
                            <span>Lembrar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRedeemReward(c.id)}
                            className="btn-mimo py-1.5 px-3 text-xs font-bold cursor-pointer"
                          >
                            <span>Resgatar 🎁</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 6: MAIS VENDIDOS & SAÍDAS (Conectado aos Itens)
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "produtos" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="label-eyebrow text-primary">Saídas & Movimentação</span>
                <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                  Produtos Mais Vendidos no Programa
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {programMode === "itens-fixos"
                    ? "Desempenho dos itens fixos participantes configurados na loja."
                    : "Desempenho geral de vendas no programa de fidelidade."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCurrentTab("itens")}
                className="btn-mimo-ghost self-start sm:self-auto text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Configurar Itens Participantes</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {programItems.length === 0 ? (
                <div className="lg:col-span-8 surface-panel p-10 rounded-2xl text-center space-y-4 border border-border/60">
                  <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto" />
                  <h3 className="text-base font-bold text-foreground">Nenhum produto com movimentação registrada</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Cadastre itens participantes na aba anterior para acompanhar o ranking de saídas e estimativa de faturamento.
                  </p>
                </div>
              ) : (
                <div className="lg:col-span-8 surface-panel rounded-2xl overflow-hidden border border-border/60">
                  <div className="p-4 border-b border-border/40 flex items-center justify-between">
                    <h2 className="font-bold text-foreground text-sm">Ranking de Saídas por Selos</h2>
                    <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Item do Cardápio</th>
                          <th className="py-3 px-4">Categoria</th>
                          <th className="py-3 px-4">Selos Gerados</th>
                          <th className="py-3 px-4 text-right">Faturamento Estimado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {programItems.map((prod, index) => (
                          <tr key={prod.id} className="hover:bg-card/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-primary text-xs">#{index + 1}</td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-foreground block">{prod.name}</span>
                              <div className="w-32 bg-muted rounded-full h-1 mt-1.5 overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((prod.totalStampsGenerated || 0) / 100) * 100)}%` }} />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-muted-foreground">{prod.category}</td>
                            <td className="py-3.5 px-4 font-semibold text-foreground text-xs">{prod.totalStampsGenerated || 0} selos</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-xs">
                              R$ {((prod.revenue || (prod.totalStampsGenerated || 0) * prod.price)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="lg:col-span-4 space-y-4">
                <div className="surface-panel p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-foreground text-sm">Resumo da Movimentação</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="text-muted-foreground">Modalidade Ativa</span>
                      <span className="font-bold text-primary">
                        {programMode === "itens-fixos" ? "Itens Fixos Definidos" : "Vendas Gerais"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="text-muted-foreground">Clientes no Programa</span>
                      <span className="font-bold text-foreground">{totalClientes} cadastrado(s)</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="text-muted-foreground">Selos Totais Emitidos</span>
                      <span className="font-bold text-emerald-400">{totalSelos} selos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mimos Liberados</span>
                      <span className="font-bold text-primary">{recompensasProntas} mimos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL: LEITOR DE QR CODE DO CLIENTE (ETAPA 2) ── */}
      {scannerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-background/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-background sm:bg-card border-none sm:border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-card sm:bg-transparent shrink-0">
              <div className="text-center space-y-1 mx-auto">
                <h3 className="text-lg font-bold text-foreground">Validar Selo do Cliente</h3>
              </div>
              <button
                onClick={() => {
                  setScannerOpen(false);
                  setLastStampResult(null);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Configuração de Operador e PIN */}
            <div className="p-3 bg-card border-b border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Operador: <strong className="text-foreground">{cardConfig.storeName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">PIN:</span>
                <input
                  type="password"
                  maxLength={4}
                  value={operatorPin}
                  onChange={(e) => setOperatorPin(e.target.value)}
                  className="w-16 bg-background border border-border/60 rounded px-2 py-0.5 text-center font-mono font-bold text-primary focus:outline-none"
                  placeholder="1234"
                />
              </div>
            </div>

            {/* Abas: Câmera vs Entrada Manual */}
            <div className="grid grid-cols-2 gap-2 bg-muted p-2 rounded-none border-b border-border/40 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScannerMode("camera")}
                className={`py-2 rounded-lg transition-all ${
                  scannerMode === "camera"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Câmera ao Vivo
              </button>
              <button
                type="button"
                onClick={() => setScannerMode("manual")}
                className={`py-2 rounded-lg transition-all ${
                  scannerMode === "manual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Busca / Manual
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* VISÃO 1: CÂMERA AO VIVO */}
              {scannerMode === "camera" && (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-sm rounded-2xl border-2 border-primary/60 bg-black overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[260px]">
                    <div id="mimo-html5-scanner" className="w-full h-full min-h-[260px]" />
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* VISÃO 2: DIGITAÇÃO MANUAL */}
              {scannerMode === "manual" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Código do QR ou Celular
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value)}
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => { processStamp(manualCodeInput); setManualCodeInput(""); }}
                        className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl"
                      >
                        OK
                      </button>
                    </div>
                  </div>

                  {scannedCustomer && (
                    <div className="mt-4 p-4 rounded-xl bg-card border border-border flex flex-col gap-3">
                      <p className="text-xs text-muted-foreground">
                        Cliente selecionado: <strong className="text-foreground">{scannedCustomer.name}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleScanCustomerQR(scannedCustomer.id)}
                        className="btn-mimo w-full py-2.5 text-xs font-bold"
                      >
                        Confirmar +1 Selo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FEEDBACK */}
              {lastStampResult && (
                <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/40 space-y-2">
                  <span className="text-xs font-bold text-primary">Carimbo Registrado!</span>
                  <div className="text-xl font-black text-foreground">
                    {lastStampResult.selos} de {lastStampResult.meta} Selos
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CADASTRAR NOVO ITEM PARTICIPANTE ── */}
      {newItemModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="surface-panel p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-5 border border-primary/40 shadow-2xl animate-fade-in relative">
            <button
              onClick={() => setNewItemModal(false)}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Cardápio Fidelizado</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">Cadastrar Item Participante</h3>
              <p className="text-xs text-muted-foreground">
                Adicione um produto que pontuará no cartão ao ser adquirido pelo cliente.
              </p>
            </div>

            <form onSubmit={handleAddProgramItem} className="space-y-4">
              <div>
                <label className="label-eyebrow block mb-1.5">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={newItemData.name}
                  onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                  placeholder="Ex: Cappuccino Italiano Médio"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-eyebrow block mb-1.5">Categoria</label>
                  <select
                    value={newItemData.category}
                    onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="Bebidas" className="bg-[#18181B]">Bebidas</option>
                    <option value="Salgados" className="bg-[#18181B]">Salgados</option>
                    <option value="Confeitaria" className="bg-[#18181B]">Confeitaria</option>
                    <option value="Combos" className="bg-[#18181B]">Combos</option>
                    <option value="Sobremesas" className="bg-[#18181B]">Sobremesas</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Preço Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={newItemData.price}
                    onChange={(e) => setNewItemData({ ...newItemData, price: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="label-eyebrow block mb-1.5">Selos Concedidos por Compra</label>
                <select
                  value={newItemData.stampsGiven}
                  onChange={(e) => setNewItemData({ ...newItemData, stampsGiven: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary font-bold text-primary"
                >
                  <option value="1" className="bg-[#18181B]">1 Selo (Padrão)</option>
                  <option value="2" className="bg-[#18181B]">2 Selos (Dobro / Combos)</option>
                  <option value="3" className="bg-[#18181B]">3 Selos (Promoção Especial)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="btn-mimo flex-1 py-3 text-xs font-bold cursor-pointer"
                >
                  Salvar Item Participante
                </button>
                <button
                  type="button"
                  onClick={() => setNewItemModal(false)}
                  className="btn-mimo-ghost px-4 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cliente */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-panel p-6 rounded-3xl max-w-sm w-full space-y-4 border border-primary/40">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">{selectedCustomer.name}</h3>
              <button onClick={() => setSelectedCustomer(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/60 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                QR Code do Passe na Carteira
              </span>
              <div className="mx-auto w-20 h-20 bg-white p-1 rounded-lg flex items-center justify-center shadow">
                <QrCode className="w-16 h-16 text-black" />
              </div>
              <span className="text-xs font-mono font-bold text-primary block">
                {selectedCustomer.qrToken}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">Saldo: <strong>{selectedCustomer.stamps}/10 selos</strong></p>

            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setScannedCustomer(selectedCustomer);
                setScannerOpen(true);
              }}
              className="btn-mimo w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Escanear QR deste Cliente</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Suporte & Validação Administrativa da MIMO */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/40 bg-[#16161A] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Validação de Conta — Administração MIMO
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Controle de Adimplência e Ativação Operacional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300">
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-rose-500/20 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Acesso Restrito ao Administrador MIMO</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Por medidas de segurança, integridade dos cartões digitais e governança contratual, 
                  <strong> o contratante não possui permissão para auto-validar ou desbloquear a conta</strong>. 
                  A liberação do sistema é realizada diretamente no banco de dados pela equipe técnica e financeira da MIMO.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-foreground block">
                  Como funciona o processo de ativação/regularização:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                  <li>Realize a quitação da fatura ou mensalidade do plano contratado.</li>
                  <li>Envie o comprovante de pagamento ao suporte da MIMO informando sua empresa (<strong>{cardConfig.storeName}</strong>).</li>
                  <li>O administrador da MIMO validará os dados e ativará o status da sua empresa no sistema instantaneamente.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-3">
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="btn-mimo-ghost px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
              <a
                href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá, sou da loja ${cardConfig.storeName} e gostaria de solicitar a validação/desbloqueio da minha conta no MIMO.`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Enviar Comprovante ao Suporte</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Flutuante com Destaque e Som */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[99999] flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border-2 border-primary/80 px-5 py-4 text-sm font-bold text-white shadow-2xl animate-fade-in backdrop-blur-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-black font-black text-lg shrink-0 shadow-md">
            ✓
          </div>
          <div className="max-w-md">
            <span className="text-white text-xs sm:text-sm font-bold block leading-snug">
              {toastMessage}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SitePainel;
