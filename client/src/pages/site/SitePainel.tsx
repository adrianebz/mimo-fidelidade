import React, { useState, useEffect, useRef } from "react";
import { SiteNavTab } from "../../components/SiteHeader.js";
import { Html5Qrcode } from "html5-qrcode";
import {
  carimbarSelo,
  resgatarPremio,
  normalizarCelularBR,
  obterDadosLojista,
  publicarIdentidadeVisual,
  obterClientesReaisLojista,
  dispararNotificacaoManual,
  salvarConfigNotificacoes,
  NOTIFICACOES_PADRAO,
  NotificacoesConfig,
} from "../../services/boomiiWalletService.js";
import { CardStudio } from "../../wallet-studio/CardStudio.js";
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
  LayoutGrid,
  MoreHorizontal,
  Menu,
} from "lucide-react";
import { ToggleTema } from "../../components/ToggleTema.js";
import { EditarClienteModal } from "../../components/EditarClienteModal.js";
import { urlCadastroCliente } from "../../siteConfig.js";

type DashboardTab = "visao-geral" | "identidade" | "itens" | "clientes" | "aniversarios" | "produtos";

/**
 * Navegação do painel, declarada uma vez só.
 *
 * O mesmo array alimenta a barra lateral do desktop, a folha "Mais" do celular
 * e o título da página. Antes os seis botões estavam escritos à mão na barra
 * horizontal, o que fazia qualquer alteração precisar ser repetida em vários
 * lugares.
 *
 * `noRodape` marca os itens que aparecem na barra inferior do celular — cabem
 * quatro ao lado do botão de leitura, e os demais ficam na folha "Mais".
 */
const ITENS_NAV: Array<{
  id: DashboardTab;
  rotulo: string;
  rotuloCurto: string;
  Icone: React.ComponentType<{ className?: string }>;
  noRodape?: boolean;
}> = [
  { id: "visao-geral", rotulo: "Visão geral", rotuloCurto: "Início", Icone: LayoutGrid, noRodape: true },
  { id: "clientes", rotulo: "Clientes", rotuloCurto: "Clientes", Icone: Users, noRodape: true },
  { id: "aniversarios", rotulo: "Aniversários & Brindes", rotuloCurto: "Brindes", Icone: Gift, noRodape: true },
  { id: "identidade", rotulo: "Identidade do Cartão", rotuloCurto: "Cartão", Icone: Palette },
  { id: "itens", rotulo: "Itens Participantes", rotuloCurto: "Itens", Icone: ShoppingBag },
  { id: "produtos", rotulo: "Mais Vendidos", rotuloCurto: "Vendas", Icone: TrendingUp },
];

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  stamps: number;
  totalStamps: number;
  lastVisit: string;
  birthday: string;
  /** Aniversário como gravado ("AAAA-MM-DD", "MM-DD" ou vazio) — base da edição. */
  birthdayRaw?: string;
  /** Código impresso abaixo do QR no passe (ex.: BOOMII-PASS-54_1). */
  passCode?: string;
  avatarBg: string;
  initials: string;
  qrToken: string;
}

/** Mesmo código que o passe mostra abaixo do QR: últimos 4 caracteres do cartão. */
function codigoDoPasse(slug: string, clienteId: string, ciclo = 1): string {
  return `BOOMII-PASS-${`${slug}_${clienteId}_${ciclo}`.slice(-4).toUpperCase()}`;
}

/** "AAAA-MM-DD" | "MM-DD" → "DD/MM" para exibição. */
function aniversarioParaExibir(raw?: string | null, mmdd?: string | null): string {
  const base = mmdd || (raw ? raw.slice(-5) : '');
  const m = base.match(/^(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : 'Não informado';
}

const DIAS_AVISO_ANIVERSARIO = 7;

/** Dias até o próximo aniversário (0 = hoje). `null` se não houver data. */
function diasAteAniversario(raw?: string | null, hoje = new Date()): number | null {
  const m = (raw || '').slice(-5).match(/^(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mes = Number(m[1]) - 1;
  const dia = Number(m[2]);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let alvo = new Date(hoje.getFullYear(), mes, dia);
  if (alvo < base) alvo = new Date(hoje.getFullYear() + 1, mes, dia);
  return Math.round((alvo.getTime() - base.getTime()) / 86400000);
}

function quandoFazAniversario(dias: number): string {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/** ISO gravado pelo servidor → "Hoje, 14:32" | "07/10, 14:32". Texto livre passa direto. */
function formatarUltimaVisita(valor?: string): string {
  if (!valor) return 'Cadastrado recentemente';
  const d = new Date(valor);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor) || isNaN(d.getTime())) return valor;
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
}

/** Iniciais do nome (primeira e última palavra), como no modelo de cartões. */
function iniciais(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'CL';
  const ini = partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0];
  return ini.toUpperCase();
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

export const SitePainel: React.FC<{ onNavigate: (tab: SiteNavTab) => void; onSair: () => void }> = ({ onNavigate, onSair }) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>("visao-geral");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("Loja Principal");
  const [currentSlug, setCurrentSlug] = useState(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("boomii_active_lojista");
      if (saved) return saved;
    }
    return new URLSearchParams(window.location.search).get("loja") || "nox-dessert-club";
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  /**
   * Barra lateral no celular: a MESMA do desktop, deslizando da esquerda por
   * cima do conteúdo. Antes o celular tinha uma folha "Mais" própria, com
   * outros itens e outro visual — o app e o painel na web pareciam produtos
   * diferentes.
   */
  const [gavetaAberta, setGavetaAberta] = useState(false);

  useEffect(() => {
    if (!gavetaAberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setGavetaAberta(false);
    // Virou desktop (girou o tablet, alargou a janela): a barra fixa assume.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const aoMudar = () => desktop.matches && setGavetaAberta(false);
    window.addEventListener("keydown", aoTeclar);
    desktop.addEventListener("change", aoMudar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      desktop.removeEventListener("change", aoMudar);
    };
  }, [gavetaAberta]);
  /** Cliente aberto no pop-up de edição. */
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Customer | null>(null);
  const [buscaClientes, setBuscaClientes] = useState("");
  /**
   * Barra lateral do desktop. A preferência fica salva porque quem trabalha em
   * tela pequena costuma querê-la recolhida o tempo todo — reabrir a cada
   * acesso seria um atrito diário.
   */
  const [menuLateralAberto, setMenuLateralAberto] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    try {
      return localStorage.getItem("boomii_menu_lateral") !== "fechado";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("boomii_menu_lateral", menuLateralAberto ? "aberto" : "fechado");
    } catch {
      // Sem persistência a preferência ainda vale para esta sessão.
    }
  }, [menuLateralAberto]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [financialStatus, setFinancialStatus] = useState<"adimplente" | "inadimplente">("adimplente");

  // Real Camera Scanner & PIN state (Etapa 2)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [scanningEffect, setScanningEffect] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "manual">("camera");
  const [operatorPin, setOperatorPin] = useState("1234");
  // Quantos selos a próxima leitura vai creditar (uma compra pode valer vários).
  const [selosPorLeitura, setSelosPorLeitura] = useState(1);
  const [maxSelosPorLeitura, setMaxSelosPorLeitura] = useState(10);
  const [permiteAlterarQuantidade, setPermiteAlterarQuantidade] = useState(true);
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
      const saved = localStorage.getItem("boomii_program_items");
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
    rewardStampImage: "" as string | null, // Selo do 10º boomii
    validityDays: "30",
  });

  const [notificacoesConfig, setNotificacoesConfig] = useState<NotificacoesConfig>(NOTIFICACOES_PADRAO);
  const [salvandoNotificacoes, setSalvandoNotificacoes] = useState(false);
  const [previewStamps, setPreviewStamps] = useState<number>(4);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessBanner, setPublishSuccessBanner] = useState<string | null>(null);
  const [lastPublishedTime, setLastPublishedTime] = useState<string | null>(() => {
    if (typeof localStorage !== "undefined") {
      const ts = localStorage.getItem("boomii_last_published_at");
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

  // O sino avisa só de aniversários próximos (hoje até 7 dias), do mais perto ao
  // mais longe. A aba Aniversários continua listando todos os cadastrados.
  const aniversariosProximos = customers
    .map((c) => ({ c, dias: diasAteAniversario(c.birthdayRaw) }))
    .filter((a): a is { c: Customer; dias: number } => a.dias !== null && a.dias <= DIAS_AVISO_ANIVERSARIO)
    .sort((a, b) => a.dias - b.dias);
  const totalAvisos = aniversariosProximos.length + recompensasPendentes.length;
  // Mesmo limite de 0 a 5 que a campanhaAniversario aplica no servidor.
  const bonusAniversario = notificacoesConfig.aniversario.ativo
    ? Math.max(0, Math.min(5, Number(notificacoesConfig.aniversario.bonus) || 0))
    : 0;
  const premioLoja = notificacoesConfig.variaveis?.premio || "a recompensa";

  // Sincroniza dados e status administrativo da empresa e restaura personalizações salvas
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("loja") || (typeof localStorage !== "undefined" ? localStorage.getItem("boomii_active_lojista") : null) || "nox-dessert-club";
    setCurrentSlug(slug);

    // 1. Restaura personalizações salvas pelo lojista no Estúdio de Marca
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(`boomii_card_config_${slug}`) || localStorage.getItem("boomii_card_config");
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

      // Regras de quantidade por atendimento, definidas no Estúdio
      const design = (loja as any).design;
      const padrao = design?.stamps?.perScan ?? (loja.regras as any)?.selosPorLeitura ?? 1;
      const teto = design?.stamps?.maxPerScan ?? (loja.regras as any)?.maxSelosPorLeitura ?? 10;
      setSelosPorLeitura(Math.max(1, Math.min(padrao, teto)));
      setMaxSelosPorLeitura(Math.max(1, teto));
      setPermiteAlterarQuantidade(design?.stamps?.allowOperatorOverride !== false);
      if (loja.nome) {
        setCardConfig((prev) => ({
          ...prev,
          storeName: loja.nome || prev.storeName,
          tagline: loja.layout?.nomePrograma || prev.tagline,
          bgColor: loja.layout?.corFundo || prev.bgColor,
          textColor: loja.layout?.corTexto || prev.textColor,
          accentColor: (loja.layout as any)?.accentColor || prev.accentColor,
          storeLogoImage: (loja.layout?.logoUrl && !loja.layout?.logoUrl.includes('boomii-logo.jpg'))
            ? loja.layout?.logoUrl 
            : (slug === 'nox-dessert-club' ? 'https://boomii-fidelidade.web.app/logos/nox-dessert-club.jpg' : prev.storeLogoImage),
          stampIcon: loja.layout?.stampIcon || prev.stampIcon,
          stampImage: loja.layout?.stampImage ?? prev.stampImage,
          rewardTitle: loja.layout?.premio || prev.rewardTitle,
          rewardDescription: loja.layout?.instrucaoResgate || prev.rewardDescription,
          rewardStampImage: loja.layout?.rewardStampImage ?? prev.rewardStampImage,
          validityDays: String(loja.layout?.validadeDias || prev.validityDays || 30),
        }));
      }
      const notifSalvas = (loja as any)?.notificacoes || {};
      setNotificacoesConfig((prev) => ({
        ...prev,
        ...notifSalvas,
        variaveis: {
          ...prev.variaveis,
          ...(notifSalvas.variaveis || {}),
          loja: notifSalvas.variaveis?.loja || loja.nome || prev.variaveis?.loja || "",
          premio: notifSalvas.variaveis?.premio || loja.layout?.premio || prev.variaveis?.premio || "",
          bonusTexto: notifSalvas.variaveis?.bonusTexto || prev.variaveis?.bonusTexto || "1 selo de presente",
          creditadosTexto: notifSalvas.variaveis?.creditadosTexto || prev.variaveis?.creditadosTexto || "1 selo",
          faltamTexto: notifSalvas.variaveis?.faltamTexto || prev.variaveis?.faltamTexto || "falta 1 selo",
        },
      }));
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
          lastVisit: formatarUltimaVisita(rc.lastVisit),
          birthday: aniversarioParaExibir(rc.aniversario, rc.aniversarioMMDD),
          birthdayRaw: rc.aniversario || rc.aniversarioMMDD || '',
          passCode: codigoDoPasse(slug, rc.id || rc.clienteId),
          avatarBg: 'bg-secondary text-foreground',
          initials: iniciais(rc.nome || ''),
          qrToken: `BOOMII:${slug}_${rc.id || rc.clienteId}_1:123456`,
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

  /**
   * Neutraliza o "voltar" do navegador enquanto o painel está aberto.
   *
   * O painel é operado no balcão, muitas vezes em celular, onde o gesto de
   * voltar é fácil de disparar sem querer. Saindo no meio de um atendimento, a
   * leitura em andamento e o que estava preenchido nos formulários se perdiam.
   * A saída passa a ser só pelo botão "Sair do painel", que é explícito.
   *
   * Funciona empurrando uma entrada no histórico e reempurrando a cada
   * tentativa de voltar — o endereço não muda, então o roteamento do App
   * continua entendendo que a aba é o painel.
   */
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);

    const aoTentarVoltar = () => {
      window.history.pushState(null, "", window.location.href);
      showToast('Para sair do painel, use o botão "Sair do painel".');
    };

    window.addEventListener("popstate", aoTentarVoltar);
    return () => window.removeEventListener("popstate", aoTentarVoltar);
  }, []);

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
        lojaId: currentSlug,
        quantidade: selosPorLeitura,
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

      const creditados = result.creditados ?? 1;
      const sufixoExcedente = result.excedente
        ? ` (${result.excedente} guardado${result.excedente > 1 ? 's' : ''} para o próximo ciclo)`
        : '';

      if (result.completo) {
        showToast(`🎉 Cartela completa! Prêmio liberado: ${result.premio}!${sufixoExcedente}`);
      } else if (creditados > 1) {
        showToast(`✅ ${creditados} selos registrados — ${result.selos}/${result.meta}${sufixoExcedente}`);
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
    // Encerra a câmera com segurança: stop() rejeita se o scanner não estiver
    // no estado SCANNING (já parado, pausado ou nem iniciado), e essa rejeição
    // deixava a stream da câmera aberta e o vídeo congelado na tela.
    const desligarCamera = async () => {
      const scanner = html5QrCodeRef.current;
      if (!scanner) return;
      html5QrCodeRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.warn("Encerramento da câmera:", err);
      }
      try {
        scanner.clear();
      } catch {}
      setCameraActive(false);
    };

    if (!scannerOpen || scannerMode !== "camera") {
      void desligarCamera();
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setCameraError(null);
        const scanner = new Html5Qrcode("boomii-html5-scanner");
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
      void desligarCamera();
    };
  }, [scannerOpen, scannerMode]);

  // Stamp update strictly via Customer QR Code scan
  const handleScanCustomerQR = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    const token = target?.qrToken || `BOOMII:${currentSlug}_${customerId}_1:123456`;
    processStamp(token);
  };

  const handleRedeemReward = async (customerId: string) => {
    try {
      const cartaoId = lastStampResult?.cartaoId || `${currentSlug}_${customerId}_1`;
      const res = await resgatarPremio({
        cartaoId,
        lojaId: currentSlug,
      });

      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId || (lastStampResult && c.name.includes(lastStampResult.cliente))) {
            return { ...c, stamps: 0, lastVisit: "Recompensa resgatada hoje" };
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
      showToast(`🎁 Boomii entregue com sucesso: ${res.premio}! Novo ciclo #${res.novoCiclo} iniciado.`);
    } catch (err: any) {
      showToast(err.message || "Erro ao resgatar recompensa.");
    }
  };

  const handleSendNotification = async (clienteId: string, name: string, type: "aniversario" | "recompensa") => {
    try {
      showToast(`Disparando notificação na carteira de ${name}...`);
      const res = await dispararNotificacaoManual(currentSlug, clienteId, type);
      if (res.sucesso) {
        showToast(
          type === "aniversario"
            ? `Notificação de aniversário enviada para a carteira de ${name}! 🎂`
            : `Lembrete de prêmio enviado para a carteira de ${name}! 🎁`
        );
      } else {
        showToast(res.erro || "Falha ao enviar notificação.");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao disparar notificação.");
    }
  };

  const inserirTagNaMensagem = (
    tipo: 'selo' | 'quaseLa' | 'completo' | 'aniversario' | 'lembrete',
    tag: string
  ) => {
    setNotificacoesConfig((prev) => {
      const atual = prev[tipo]?.texto || "";
      const novoTexto = !atual ? tag : (atual.endsWith(" ") ? `${atual}${tag}` : `${atual} ${tag}`);
      return {
        ...prev,
        [tipo]: {
          ...prev[tipo],
          texto: novoTexto,
        },
      };
    });
  };

  const handleSalvarNotificacoes = async () => {
    setSalvandoNotificacoes(true);
    try {
      const res = await salvarConfigNotificacoes(currentSlug, notificacoesConfig);
      if (res.sucesso) {
        showToast("Regras de notificação salvas com sucesso!");
      } else {
        showToast(res.erro || "Erro ao salvar notificações.");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar.");
    } finally {
      setSalvandoNotificacoes(false);
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

  // Rótulos da barra lateral: no desktop seguem o hambúrguer; na gaveta do
  // celular aparecem sempre.
  const rotulos = menuLateralAberto || gavetaAberta;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
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

      {/* Fundo escurecido da gaveta no celular; tocar fora fecha. */}
      {gavetaAberta && (
        <div
          className="lg:hidden fixed inset-0 z-[94] bg-background/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setGavetaAberta(false)}
          aria-hidden="true"
        />
      )}

      {/* ── BARRA LATERAL ──
          Desktop: fixa, recolhível pelo hambúrguer. Celular: a mesma barra,
          sempre expandida, deslizando da esquerda como gaveta. */}
      <aside
        className={`flex fixed inset-y-0 left-0 z-[95] lg:z-40 flex-col border-r border-border/40 bg-card w-72 max-w-[85vw] pt-[env(safe-area-inset-top)] lg:pt-0 lg:max-w-none transition-[transform,width] duration-200 ${
          gavetaAberta ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } lg:translate-x-0 lg:shadow-none ${menuLateralAberto ? "lg:w-64" : "lg:w-[72px]"}`}
        aria-label="Menu do painel"
      >
        {/* O hambúrguer fica dentro da própria barra: recolhida, ela vira uma
            faixa estreita de ícones em vez de sumir, então o controle de
            expandir continua sempre visível e no mesmo lugar. Na gaveta do
            celular, o mesmo botão fecha. */}
        <div
          className={`flex items-center gap-2.5 border-b border-border/40 py-4 ${
            rotulos ? "px-4" : "px-0 justify-center"
          }`}
        >
          <button
            type="button"
            onClick={() => (gavetaAberta ? setGavetaAberta(false) : setMenuLateralAberto((v) => !v))}
            aria-expanded={gavetaAberta || menuLateralAberto}
            aria-label={gavetaAberta ? "Fechar menu" : rotulos ? "Recolher menu" : "Expandir menu"}
            title={gavetaAberta ? "Fechar menu" : rotulos ? "Recolher menu" : "Expandir menu"}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          {rotulos && (
            <div className="min-w-0">
              <div className="font-bold text-foreground text-sm truncate">
                {cardConfig.storeName}
              </div>
              <div className="text-[11px] text-muted-foreground">Painel do lojista</div>
            </div>
          )}
        </div>

        {/* Ação principal do balcão, acima da navegação de propósito:
            é o que o operador mais usa no dia a dia. */}
        <div className={`pt-4 ${rotulos ? "px-4" : "px-3"}`}>
          <button
            type="button"
            onClick={() => {
              setGavetaAberta(false);
              setScannedCustomer(customers[0] || null);
              setScannerOpen(true);
            }}
            className="btn-boomii w-full py-3 px-0 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            title="Ler QR Code do cartão do cliente para pontuar"
          >
            <Scan className="w-4 h-4 shrink-0" />
            {rotulos && <span>Ler QR do Cliente</span>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ITENS_NAV.map(({ id, rotulo, Icone }) => {
            const ativo = currentTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setCurrentTab(id);
                  setGavetaAberta(false);
                }}
                aria-current={ativo ? "page" : undefined}
                title={rotulo}
                className={`w-full flex items-center py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer border ${
                  rotulos ? "gap-3 px-3" : "justify-center px-0"
                } ${
                  ativo
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent"
                }`}
              >
                <Icone className="w-4 h-4 shrink-0" />
                {rotulos && (
                  <>
                    <span className="truncate">{rotulo}</span>
                    {id === "clientes" && customers.length > 0 && (
                      <span className="ml-auto text-[11px] font-bold tabular-nums text-muted-foreground">
                        {customers.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className={`py-4 border-t border-border/40 space-y-2 ${rotulos ? "px-4" : "px-3"}`}>
          {financialStatus === "adimplente" ? (
            <div
              className={`flex items-center py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-400 ${
                rotulos ? "gap-1.5 px-3" : "justify-center px-0"
              }`}
              title="Conta verificada e homologada pelo Administrador BOOMII"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              {rotulos && <span className="truncate">Plano Pro • Validado</span>}
            </div>
          ) : (
            <div
              className={`flex items-center py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] font-semibold text-rose-400 ${
                rotulos ? "gap-1.5 px-3" : "justify-center px-0"
              }`}
              title="Conta suspensa pelo Administrador BOOMII por pendência financeira"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {rotulos && <span className="truncate">Plano Pro • Bloqueado</span>}
            </div>
          )}

          <button
            type="button"
            onClick={onSair}
            title="Sair do painel"
            className={`w-full flex items-center py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors cursor-pointer ${
              rotulos ? "gap-2 px-3" : "justify-center px-0"
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {rotulos && <span>Sair do painel</span>}
          </button>
        </div>
      </aside>

      {/* ── COLUNA DE CONTEÚDO ── */}
      <div
        className={`flex flex-col min-h-screen transition-[padding] duration-200 ${
          menuLateralAberto ? "lg:pl-64" : "lg:pl-[72px]"
        }`}
      >
        {/* pt com safe-area: no iPhone (app e PWA, viewport-fit=cover) o
            cabeçalho ficava por baixo do relógio e da bateria. */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            {/* No celular identifica a loja; no desktop a loja já está na
                lateral, então o espaço vira o título da seção aberta. */}
            <div className="min-w-0 flex items-center gap-2.5">
              {/* Abre a barra lateral como gaveta — o mesmo menu do desktop. */}
              <button
                type="button"
                onClick={() => setGavetaAberta(true)}
                aria-label="Abrir menu"
                aria-expanded={gavetaAberta}
                className="lg:hidden h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-foreground text-base tracking-tight truncate">
                  <span className="lg:hidden">{cardConfig.storeName}</span>
                  <span className="hidden lg:inline">
                    {ITENS_NAV.find((i) => i.id === currentTab)?.rotulo}
                  </span>
                </h1>
                {financialStatus === "inadimplente" && (
                  <span className="lg:hidden text-[10px] font-semibold text-rose-400 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Conta bloqueada
                  </span>
                )}
              </div>
            </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ToggleTema />

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-full border border-border/60 hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Notificações"
              >
                <Bell className="w-4 h-4" />
                {totalAvisos > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover p-4 shadow-2xl z-50 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-foreground">Notificações da Loja</span>
                    {totalAvisos > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                        {totalAvisos} {totalAvisos === 1 ? 'aviso' : 'avisos'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                    {totalAvisos === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Nenhum aviso no momento. Aniversários dos próximos {DIAS_AVISO_ANIVERSARIO} dias e recompensas prontas para retirar aparecem aqui.
                      </div>
                    ) : (
                      <>
                        {recompensasPendentes.map((c) => (
                          <div
                            key={`notif-rew-${c.id}`}
                            className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 space-y-1 cursor-pointer"
                            onClick={() => {
                              setNotificationsOpen(false);
                              setBuscaClientes(c.name);
                              setCurrentTab("clientes");
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-emerald-500">🎁 Recompensa disponível</span>
                              <span className="text-[10px] text-emerald-500 font-bold shrink-0">{c.stamps}/{c.totalStamps} selos</span>
                            </div>
                            <p className="text-muted-foreground">
                              {c.name} completou a cartela e pode retirar {premioLoja}.
                            </p>
                          </div>
                        ))}
                        {aniversariosProximos.map(({ c, dias }) => (
                          <div
                            key={`notif-bday-${c.id}`}
                            className={`p-2.5 rounded-xl border space-y-1 cursor-pointer ${
                              dias === 0
                                ? 'bg-primary/10 hover:bg-primary/15 border-primary/40'
                                : 'bg-card hover:bg-card/80 border-border/40'
                            }`}
                            onClick={() => {
                              setNotificationsOpen(false);
                              setCurrentTab("aniversarios");
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-primary">
                                🎂 {dias === 0 ? 'Aniversário hoje' : 'Aniversário próximo'}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{c.birthday}</span>
                            </div>
                            <p className="text-muted-foreground">
                              {c.name} faz aniversário {quandoFazAniversario(dias)}.{' '}
                              {bonusAniversario > 0
                                ? dias === 0
                                  ? `O cartão recebe ${bonusAniversario} ${bonusAniversario === 1 ? 'selo' : 'selos'} de presente automaticamente.`
                                  : `No dia, o cartão recebe ${bonusAniversario} ${bonusAniversario === 1 ? 'selo' : 'selos'} de presente automaticamente.`
                                : 'Que tal mandar os parabéns?'}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar da loja. O nome ao lado só aparece onde não existe a
                barra lateral repetindo a mesma informação. */}
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shadow-md uppercase">
                {(cardConfig.storeName || 'Loja').slice(0, 2)}
              </div>
              <div className="hidden sm:flex lg:hidden flex-col text-left leading-tight">
                <span className="text-xs font-bold text-foreground">
                  {cardConfig.storeName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Lojista
                </span>
              </div>
            </div>
          </div>
        </div>

      </header>

      {/* ── CORPO PRINCIPAL ──
          pb-28 reserva a faixa ocupada pela barra inferior fixa do celular;
          sem isso o último cartão de cada aba fica escondido atrás dela. */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-10">
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
                    const url = urlCadastroCliente(currentSlug);
                    navigator.clipboard.writeText(url);
                    showToast("Link de cadastro copiado para o clipboard!");
                  }}
                  className="btn-boomii-ghost px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 flex-1 sm:flex-initial justify-center cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </button>
                <a
                  href={urlCadastroCliente(currentSlug)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-boomii px-4 py-2 text-xs font-bold flex items-center gap-1.5 flex-1 sm:flex-initial justify-center shadow-md cursor-pointer"
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
                        Exclusivo Administração BOOMII
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                      O acúmulo de selos no balcão e a emissão de novos cartões estão suspensos. A validação e o desbloqueio desta conta são efetuados <strong>exclusivamente pela equipe de administração da BOOMII</strong> após conferência financeira.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSupportModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shrink-0 cursor-pointer transition-all shadow-md flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Falar com Administrador BOOMII</span>
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
                            const url = urlCadastroCliente(currentSlug);
                            navigator.clipboard.writeText(url);
                            showToast("Link de cadastro copiado!");
                          }}
                          className="btn-boomii-ghost text-xs py-1.5 px-3.5"
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
                                      Recompensa pronta!
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
          <div className="animate-fade-in">
            <CardStudio
              slug={currentSlug}
              readOnlyReason={
                financialStatus === "inadimplente"
                  ? "Conta com pendência financeira: regularize a assinatura para publicar alterações no cartão."
                  : null
              }
              onToast={showToast}
            />
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
                  className="btn-boomii self-start sm:self-auto text-xs py-2.5 px-4 font-bold cursor-pointer flex items-center gap-1.5"
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
                  className="btn-boomii-ghost text-xs py-2 px-4 mt-2"
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
                    className="btn-boomii text-xs py-2 px-3.5 font-bold cursor-pointer"
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
                      className="btn-boomii text-xs py-2.5 px-5 font-bold mx-auto cursor-pointer"
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
        {currentTab === "clientes" && (() => {
          // Busca por nome, e-mail, código do passe ou celular (a partir de 3 dígitos).
          const termo = buscaClientes.trim().toLowerCase();
          const digitos = termo.replace(/\D/g, "");
          const filtrados = termo
            ? customers.filter(
                (c) =>
                  c.name.toLowerCase().includes(termo) ||
                  (c.email || "").toLowerCase().includes(termo) ||
                  (c.passCode || "").toLowerCase().includes(termo) ||
                  (digitos.length >= 3 && (c.phone || "").replace(/\D/g, "").includes(digitos))
              )
            : customers;

          return (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="label-eyebrow">Base de clientes</span>
                <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                  Controle de Fidelizados
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Atualização de selos realizada via leitura do QR Code individual do cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScannedCustomer(customers[0] || null);
                  setScannerOpen(true);
                }}
                className="btn-boomii shrink-0 px-5 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Scan className="w-4 h-4" />
                <span>Escanear QR Code</span>
              </button>
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
                      const url = urlCadastroCliente(currentSlug);
                      navigator.clipboard.writeText(url);
                      showToast("Link de cadastro copiado!");
                    }}
                    className="btn-boomii text-xs py-2.5 px-4 font-bold"
                  >
                    Copiar Link de Cadastro (/c/{currentSlug})
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="search"
                    value={buscaClientes}
                    onChange={(e) => setBuscaClientes(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou código do passe"
                    aria-label="Buscar clientes"
                    className="w-full rounded-2xl border border-input bg-card pl-11 pr-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  />
                </div>

                {filtrados.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    Nenhum cliente encontrado para “{buscaClientes.trim()}”.
                  </p>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filtrados.map((c) => {
                      const total = c.totalStamps || 10;
                      const isReady = c.stamps >= total;
                      return (
                        <article
                          key={c.id}
                          className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${c.avatarBg}`}
                            >
                              {c.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                              <p className="text-xs text-muted-foreground truncate">{c.email || c.phone}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setClienteEmEdicao(c)}
                              aria-label={`Editar dados de ${c.name}`}
                              title="Editar dados do cliente"
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-semibold text-primary truncate">{c.passCode}</span>
                              <span className="font-bold text-foreground shrink-0">
                                {c.stamps}/{total} selos
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, (c.stamps / total) * 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">Última: {c.lastVisit}</span>
                              <span className="shrink-0">Aniversário: {c.birthday}</span>
                            </div>
                          </div>

                          {isReady ? (
                            <button
                              type="button"
                              onClick={() => handleRedeemReward(c.id)}
                              className="btn-boomii w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Gift className="w-3.5 h-3.5" />
                              <span>Resgatar recompensa</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setScannedCustomer(c);
                                setScannerOpen(true);
                              }}
                              className="w-full rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Scan className="w-3.5 h-3.5" />
                              <span>Ler QR Code</span>
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════
            ABA 5: ANIVERSÁRIOS & BOOMIIS
           ═══════════════════════════════════════════════════════════════ */}
        {currentTab === "aniversarios" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <span className="label-eyebrow text-primary">Engajamento automático</span>
              <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">
                Aniversários & Recompensas
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Avisos que chegam na tela de bloqueio do celular dos clientes, pela carteira.
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
                      <p className="text-[11px] text-muted-foreground">Quando seus clientes informarem o aniversário no cadastro do cartão, eles aparecerão aqui para o envio de recompensas.</p>
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
                          onClick={() => handleSendNotification(c.id, c.name, "aniversario")}
                          className="btn-boomii py-1.5 px-3 text-xs font-bold cursor-pointer"
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
                      <p className="text-[11px] text-muted-foreground">Clientes que completarem a cartela de 10 selos aparecerão aqui para entrega da recompensa.</p>
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
                            <span className="text-xs text-muted-foreground">Boomii: {cardConfig.rewardTitle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendNotification(c.id, c.name, "recompensa")}
                            className="btn-boomii-ghost py-1.5 px-3 text-xs font-bold cursor-pointer"
                          >
                            <Bell className="w-3 h-3 mr-1" />
                            <span>Lembrar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRedeemReward(c.id)}
                            className="btn-boomii py-1.5 px-3 text-xs font-bold cursor-pointer"
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

            {/* Configurações de Notificações na Carteira */}
            <div className="surface-panel p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-black text-foreground">Regras de Notificações na Carteira</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Os avisos chegam diretamente na Apple Wallet e Google Wallet dos clientes cadastrados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSalvarNotificacoes}
                  disabled={salvandoNotificacoes}
                  className="btn-boomii text-xs py-2 px-4 font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{salvandoNotificacoes ? "Salvando..." : "Salvar Configurações"}</span>
                </button>
              </div>

              {/* ── CAIXAS DE TEXTO PARA EDITAR E SALVAR AS VARIÁVEIS ── */}
              <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">Caixas de Texto das Variáveis</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Edite aqui o valor de cada variável. Elas substituem automaticamente as tags correspondentes nas mensagens.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-full self-start sm:self-auto">
                    Salvas com as configurações
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* 1. {loja} */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Nome da Loja</label>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">&#123;loja&#125;</code>
                    </div>
                    <input
                      type="text"
                      value={notificacoesConfig.variaveis?.loja ?? ""}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          variaveis: { ...prev.variaveis, loja: e.target.value },
                        }))
                      }
                      placeholder={cardConfig.storeName || "Nome da Loja"}
                      className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
                    />
                    <span className="text-[10px] text-muted-foreground block">Identificação do estabelecimento.</span>
                  </div>

                  {/* 2. {premio} */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Descrição do Prêmio</label>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">&#123;premio&#125;</code>
                    </div>
                    <input
                      type="text"
                      value={notificacoesConfig.variaveis?.premio ?? ""}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          variaveis: { ...prev.variaveis, premio: e.target.value },
                        }))
                      }
                      placeholder={cardConfig.rewardTitle || "Descrição do prêmio"}
                      className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
                    />
                    <span className="text-[10px] text-muted-foreground block">Recompensa liberada na cartela.</span>
                  </div>

                  {/* 3. {bonusTexto} */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Texto do Bônus de Aniversário</label>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">&#123;bonusTexto&#125;</code>
                    </div>
                    <input
                      type="text"
                      value={notificacoesConfig.variaveis?.bonusTexto ?? ""}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          variaveis: { ...prev.variaveis, bonusTexto: e.target.value },
                        }))
                      }
                      placeholder="Ex: 1 selo bônus de presente"
                      className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
                    />
                    <span className="text-[10px] text-muted-foreground block">Presente concedido ao aniversariante.</span>
                  </div>

                  {/* 4. {creditadosTexto} */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Texto de Selos Carimbados</label>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">&#123;creditadosTexto&#125;</code>
                    </div>
                    <input
                      type="text"
                      value={notificacoesConfig.variaveis?.creditadosTexto ?? ""}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          variaveis: { ...prev.variaveis, creditadosTexto: e.target.value },
                        }))
                      }
                      placeholder="Ex: 1 selo"
                      className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
                    />
                    <span className="text-[10px] text-muted-foreground block">Texto da pontuação imediata carimbada.</span>
                  </div>

                  {/* 5. {faltamTexto} */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Texto de Selos Restantes</label>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">&#123;faltamTexto&#125;</code>
                    </div>
                    <input
                      type="text"
                      value={notificacoesConfig.variaveis?.faltamTexto ?? ""}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          variaveis: { ...prev.variaveis, faltamTexto: e.target.value },
                        }))
                      }
                      placeholder="Ex: só falta 1 selo"
                      className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
                    />
                    <span className="text-[10px] text-muted-foreground block">Texto de incentivo na reta final.</span>
                  </div>

                  {/* 6. Variáveis do Cliente (Automáticas) */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-foreground">Variáveis do Cliente</label>
                        <span className="text-[10px] font-bold text-emerald-400">Automáticas</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">&#123;nome&#125;</code>
                        <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">&#123;selos&#125;</code>
                        <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">&#123;meta&#125;</code>
                        <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">&#123;dias&#125;</code>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-1">Preenchidas em tempo real para cada cliente.</span>
                  </div>
                </div>
              </div>

              {/* ── CARDS DAS REGRAS DE NOTIFICAÇÃO ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Novo Selo */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🍪</span>
                      <span className="font-bold text-sm text-foreground">Novo Selo Carimbado</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificacoesConfig.selo.ativo}
                        onChange={(e) =>
                          setNotificacoesConfig((prev) => ({
                            ...prev,
                            selo: { ...prev.selo, ativo: e.target.checked },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={notificacoesConfig.selo.texto}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          selo: { ...prev.selo, texto: e.target.value },
                        }))
                      }
                      placeholder="Mensagem do novo selo..."
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none font-medium leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Inserir:</span>
                      {['{creditadosTexto}', '{selos}', '{meta}', '{loja}'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => inserirTagNaMensagem('selo', tag)}
                          className="text-[10px] font-mono bg-background hover:bg-primary/20 text-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Quase Lá */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <span className="font-bold text-sm text-foreground">Quase Lá (Incentivo)</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificacoesConfig.quaseLa.ativo}
                        onChange={(e) =>
                          setNotificacoesConfig((prev) => ({
                            ...prev,
                            quaseLa: { ...prev.quaseLa, ativo: e.target.checked },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={notificacoesConfig.quaseLa.texto}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          quaseLa: { ...prev.quaseLa, texto: e.target.value },
                        }))
                      }
                      placeholder="Mensagem de incentivo..."
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none font-medium leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Inserir:</span>
                        {['{faltamTexto}', '{premio}', '{loja}'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => inserirTagNaMensagem('quaseLa', tag)}
                            className="text-[10px] font-mono bg-background hover:bg-primary/20 text-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">Faltando:</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={notificacoesConfig.quaseLa.faltam}
                          onChange={(e) =>
                            setNotificacoesConfig((prev) => ({
                              ...prev,
                              quaseLa: { ...prev.quaseLa, faltam: Math.max(1, parseInt(e.target.value) || 1) },
                            }))
                          }
                          className="w-10 rounded border border-input bg-background px-1 py-0.5 text-center text-xs font-bold text-primary outline-none focus:border-primary"
                        />
                        <span className="text-[10px] text-muted-foreground">selo</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Cartela Completa */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎉</span>
                      <span className="font-bold text-sm text-foreground">Prêmio Liberado</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificacoesConfig.completo.ativo}
                        onChange={(e) =>
                          setNotificacoesConfig((prev) => ({
                            ...prev,
                            completo: { ...prev.completo, ativo: e.target.checked },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={notificacoesConfig.completo.texto}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          completo: { ...prev.completo, texto: e.target.value },
                        }))
                      }
                      placeholder="Mensagem de prêmio liberado..."
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none font-medium leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Inserir:</span>
                      {['{premio}', '{loja}', '{nome}'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => inserirTagNaMensagem('completo', tag)}
                          className="text-[10px] font-mono bg-background hover:bg-primary/20 text-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Aniversário com Bônus */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎂</span>
                      <span className="font-bold text-sm text-foreground">Aniversário Automático</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificacoesConfig.aniversario.ativo}
                        onChange={(e) =>
                          setNotificacoesConfig((prev) => ({
                            ...prev,
                            aniversario: { ...prev.aniversario, ativo: e.target.checked },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={notificacoesConfig.aniversario.texto}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          aniversario: { ...prev.aniversario, texto: e.target.value },
                        }))
                      }
                      placeholder="Mensagem de aniversário..."
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none font-medium leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Inserir:</span>
                        {['{nome}', '{bonusTexto}', '{loja}', '{selos}', '{meta}'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => inserirTagNaMensagem('aniversario', tag)}
                            className="text-[10px] font-mono bg-background hover:bg-primary/20 text-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">Bônus:</span>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={notificacoesConfig.aniversario.bonus}
                          onChange={(e) =>
                            setNotificacoesConfig((prev) => ({
                              ...prev,
                              aniversario: { ...prev.aniversario, bonus: Math.max(0, parseInt(e.target.value) || 0) },
                            }))
                          }
                          className="w-10 rounded border border-input bg-background px-1 py-0.5 text-center text-xs font-bold text-primary outline-none focus:border-primary"
                        />
                        <span className="text-[10px] text-muted-foreground">selo(s)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Lembrete de Prêmio Não Resgatado */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎁</span>
                      <span className="font-bold text-sm text-foreground">Lembrete de Prêmio Não Resgatado</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificacoesConfig.lembrete.ativo}
                        onChange={(e) =>
                          setNotificacoesConfig((prev) => ({
                            ...prev,
                            lembrete: { ...prev.lembrete, ativo: e.target.checked },
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={notificacoesConfig.lembrete.texto}
                      onChange={(e) =>
                        setNotificacoesConfig((prev) => ({
                          ...prev,
                          lembrete: { ...prev.lembrete, texto: e.target.value },
                        }))
                      }
                      placeholder="Lembrete de resgate..."
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary resize-none font-medium leading-relaxed"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Inserir:</span>
                        {['{premio}', '{dias}', '{loja}', '{nome}'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => inserirTagNaMensagem('lembrete', tag)}
                            className="text-[10px] font-mono bg-background hover:bg-primary/20 text-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>A cada:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={notificacoesConfig.lembrete.dias}
                            onChange={(e) =>
                              setNotificacoesConfig((prev) => ({
                                ...prev,
                                lembrete: { ...prev.lembrete, dias: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-10 rounded border border-input bg-background px-1 py-0.5 text-center text-xs font-bold text-primary outline-none focus:border-primary"
                          />
                          <span>dias</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Máx:</span>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={notificacoesConfig.lembrete.maxEnvios}
                            onChange={(e) =>
                              setNotificacoesConfig((prev) => ({
                                ...prev,
                                lembrete: { ...prev.lembrete, maxEnvios: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-10 rounded border border-input bg-background px-1 py-0.5 text-center text-xs font-bold text-primary outline-none focus:border-primary"
                          />
                          <span>envios</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
                className="btn-boomii-ghost self-start sm:self-auto text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 cursor-pointer"
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
                      <span className="text-muted-foreground">Brindes Liberados</span>
                      <span className="font-bold text-primary">{recompensasProntas} brindes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── BARRA INFERIOR (CELULAR) ──
          Fica ao alcance do polegar porque o painel é usado em pé, no balcão,
          com uma das mãos segurando o aparelho. O botão de leitura ocupa o
          centro e é elevado: é a ação repetida dezenas de vezes por dia. */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/40 bg-card/95 backdrop-blur-xl">
        <div className="flex items-end justify-around px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {ITENS_NAV.filter((i) => i.noRodape).slice(0, 2).map(({ id, rotuloCurto, Icone }) => {
            const ativo = currentTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentTab(id)}
                aria-current={ativo ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[64px] transition-colors cursor-pointer ${
                  ativo ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icone className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{rotuloCurto}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setScannedCustomer(customers[0] || null);
              setScannerOpen(true);
            }}
            className="flex flex-col items-center gap-0.5 px-2 cursor-pointer"
            title="Ler QR Code do cartão do cliente para pontuar"
          >
            <span className="-mt-6 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-card">
              <Scan className="w-6 h-6" />
            </span>
            <span className="text-[10px] font-bold text-primary">Ler QR</span>
          </button>

          {ITENS_NAV.filter((i) => i.noRodape).slice(2).map(({ id, rotuloCurto, Icone }) => {
            const ativo = currentTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentTab(id)}
                aria-current={ativo ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[64px] transition-colors cursor-pointer ${
                  ativo ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icone className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{rotuloCurto}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            aria-expanded={gavetaAberta}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[64px] transition-colors cursor-pointer ${
              ITENS_NAV.some((i) => !i.noRodape && i.id === currentTab)
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
        </div>
      </nav>
      </div>

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

            {/* Operador identificado pela própria sessão de login (sem PIN) */}
            <div className="p-3 bg-card border-b border-border flex items-center gap-2 text-xs">
              <Key className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">
                Operando como <strong className="text-foreground">{cardConfig.storeName}</strong>
              </span>
            </div>

            {/* Quantos selos esta leitura vai creditar */}
            <div className="px-3 py-2.5 bg-card border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block">Selos por atendimento</span>
                <span className="text-[11px] text-muted-foreground">
                  {permiteAlterarQuantidade
                    ? `Ajuste se o cliente levar vários itens (até ${maxSelosPorLeitura})`
                    : "Quantidade fixada pelo Estúdio"}
                </span>
              </div>

              {permiteAlterarQuantidade ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label="Diminuir selos"
                    onClick={() => setSelosPorLeitura((n) => Math.max(1, n - 1))}
                    disabled={selosPorLeitura <= 1}
                    className="w-8 h-8 rounded-lg border border-border bg-background text-foreground font-bold disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-mono font-black text-base text-primary">
                    {selosPorLeitura}
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar selos"
                    onClick={() => setSelosPorLeitura((n) => Math.min(maxSelosPorLeitura, n + 1))}
                    disabled={selosPorLeitura >= maxSelosPorLeitura}
                    className="w-8 h-8 rounded-lg border border-border bg-background text-foreground font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="font-mono font-black text-base text-primary shrink-0">
                  {selosPorLeitura}
                </span>
              )}
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
              {/* VISÃO 1: CÂMERA AO VIVO
                  O container do scanner fica SEMPRE montado enquanto o modal
                  estiver aberto e é apenas ocultado por CSS. Desmontá-lo ao
                  trocar de aba arrancava do DOM o <video> que a html5-qrcode
                  ainda controlava: o stop() falhava, a câmera não era liberada
                  e a tela ficava preta. */}
              <div className={`space-y-3 ${scannerMode === "camera" ? "" : "hidden"}`}>
                <div className="relative mx-auto w-full max-w-sm rounded-2xl border-2 border-primary/60 bg-black overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[260px]">
                  <div id="boomii-html5-scanner" className="w-full h-full min-h-[260px]" />
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

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
                        className="btn-boomii w-full py-2.5 text-xs font-bold"
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
                    <option value="Bebidas" className="bg-card">Bebidas</option>
                    <option value="Salgados" className="bg-card">Salgados</option>
                    <option value="Confeitaria" className="bg-card">Confeitaria</option>
                    <option value="Combos" className="bg-card">Combos</option>
                    <option value="Sobremesas" className="bg-card">Sobremesas</option>
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
                  <option value="1" className="bg-card">1 Selo (Padrão)</option>
                  <option value="2" className="bg-card">2 Selos (Dobro / Combos)</option>
                  <option value="3" className="bg-card">3 Selos (Promoção Especial)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="btn-boomii flex-1 py-3 text-xs font-bold cursor-pointer"
                >
                  Salvar Item Participante
                </button>
                <button
                  type="button"
                  onClick={() => setNewItemModal(false)}
                  className="btn-boomii-ghost px-4 text-xs font-semibold cursor-pointer"
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
              className="btn-boomii w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Escanear QR deste Cliente</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Suporte & Validação Administrativa da BOOMII */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/40 bg-popover p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Validação de Conta — Administração BOOMII
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
                  <span>Acesso Restrito ao Administrador BOOMII</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Por medidas de segurança, integridade dos cartões digitais e governança contratual, 
                  <strong> o contratante não possui permissão para auto-validar ou desbloquear a conta</strong>. 
                  A liberação do sistema é realizada diretamente no banco de dados pela equipe técnica e financeira da BOOMII.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-foreground block">
                  Como funciona o processo de ativação/regularização:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                  <li>Realize a quitação da fatura ou mensalidade do plano contratado.</li>
                  <li>Envie o comprovante de pagamento ao suporte da BOOMII informando sua empresa (<strong>{cardConfig.storeName}</strong>).</li>
                  <li>O administrador da BOOMII validará os dados e ativará o status da sua empresa no sistema instantaneamente.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-3">
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="btn-boomii-ghost px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
              <a
                href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá, sou da loja ${cardConfig.storeName} e gostaria de solicitar a validação/desbloqueio da minha conta no BOOMII.`)}`}
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

      {/* Pop-up de edição dos dados do cliente */}
      {clienteEmEdicao && (
        <EditarClienteModal
          lojaId={currentSlug}
          cliente={{
            id: clienteEmEdicao.id,
            name: clienteEmEdicao.name,
            email: clienteEmEdicao.email || "",
            phone: clienteEmEdicao.phone || "",
            birthdayRaw: clienteEmEdicao.birthdayRaw || "",
          }}
          onFechar={() => setClienteEmEdicao(null)}
          onSalvo={(clienteId, resultado) => {
            const novo = resultado.cliente;
            if (novo) {
              const atualizar = (c: Customer): Customer =>
                c.id === clienteId
                  ? {
                      ...c,
                      name: novo.nome,
                      email: novo.email,
                      birthdayRaw: novo.aniversario || "",
                      birthday: aniversarioParaExibir(novo.aniversario || "", novo.aniversarioMMDD || ""),
                      initials: iniciais(novo.nome),
                    }
                  : c;
              setCustomers((prev) => prev.map(atualizar));
              setScannedCustomer((prev) => (prev ? atualizar(prev) : prev));
            }
            setClienteEmEdicao(null);
            showToast(
              resultado.carteirasAtualizadas === false
                ? "Dados salvos. O cartão na carteira será atualizado na próxima interação."
                : "Dados do cliente atualizados."
            );
          }}
          onExcluido={(clienteId, resultado) => {
            setCustomers((prev) => prev.filter((c) => c.id !== clienteId));
            setScannedCustomer((prev) => (prev?.id === clienteId ? null : prev));
            setClienteEmEdicao(null);
            showToast(
              resultado.carteirasAtualizadas === false
                ? "Cliente excluído. A Google Wallet não respondeu; o cartão pode continuar visível por um tempo."
                : "Cliente excluído."
            );
          }}
        />
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
