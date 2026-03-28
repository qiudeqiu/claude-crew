/**
 * claude-crew 宣传视频 — 气泡时间线数据
 * 供 Remotion 直接消费
 */

// ── 角色 ──

export const ROLES = {
  you: {
    side: "right" as const,
    nameLabel: undefined,
    nameColor: "",
    bubbleColor: "#1A4D3E",
    textColor: "#D1FAE5",
    font: "Inter" as const,
  },
  leo: {
    side: "left" as const,
    nameLabel: "Leo",
    nameColor: "#3B82F6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    font: "Inter" as const,
  },
  momo: {
    side: "left" as const,
    nameLabel: "Momo",
    nameColor: "#A78BFA",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    font: "Inter" as const,
  },
  nova: {
    side: "left" as const,
    nameLabel: "Nova",
    nameColor: "#EC4899",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    font: "Inter" as const,
  },
  kira: {
    side: "left" as const,
    nameLabel: "Kira",
    nameColor: "#F59E0B",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    font: "Inter" as const,
  },
  sage: {
    side: "left" as const,
    nameLabel: "Sage",
    nameColor: "#14B8A6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    font: "Inter" as const,
  },
} as const;

export const BOT_STYLE = {
  progress: {
    side: "left" as const,
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    font: "JetBrains Mono" as const,
  },
  result: {
    side: "left" as const,
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    font: "Inter" as const,
  },
} as const;

// ── 类型 ──

export type BubbleType =
  | "message"
  | "progress"
  | "result"
  | "reply"
  | "chat"
  | "announcement";

export interface Bubble {
  id: string;
  /** 出现时间，单位秒 */
  time: number;
  /** 角色 key */
  sender: keyof typeof ROLES | string;
  side: "left" | "right";
  type: BubbleType;
  /** 气泡上方显示的名字，右侧气泡无 */
  nameLabel?: string;
  nameColor: string;
  bubbleColor: string;
  textColor: string;
  content: string;
  /** type=reply 时引用的内容 */
  quote?: string;
  font: "Inter" | "JetBrains Mono";
  /** 指向要原地更新的气泡 id（进度追加行） */
  updateTarget?: string;
  /** 所属阶段，方便调试 */
  phase: string;
}

// ── 气泡时间线 ──

export const BUBBLES: Bubble[] = [
  // ═══ Phase 1: 多人 → 同一项目 (0.5s - 4s) ═══
  {
    id: "p1-you-a",
    time: 0.5,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#1A4D3E",
    textColor: "#D1FAE5",
    content: "@商城_bot 支付流程报错了，查一下原因",
    font: "Inter",
    phase: "1-multi-person-same-project",
  },
  {
    id: "p1-leo-a",
    time: 2.0,
    sender: "leo",
    side: "left",
    type: "message",
    nameLabel: "Leo",
    nameColor: "#3B82F6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@商城_bot 顺便看看那个接口超时的问题",
    font: "Inter",
    phase: "1-multi-person-same-project",
  },

  // ═══ Phase 2: 跨项目并行启动 (4s - 6s) ═══
  {
    id: "p2-nova-b",
    time: 4.0,
    sender: "nova",
    side: "left",
    type: "message",
    nameLabel: "Nova",
    nameColor: "#EC4899",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@官网_bot 落地页文案换成五一活动的",
    font: "Inter",
    phase: "2-cross-project",
  },

  // ═══ Phase 3: 三个 bot 并行进度 (6s - 12s) ═══
  {
    id: "p3-botA-progress",
    time: 6.15,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (5s)\n → 🔧 Read: payment.ts",
    font: "JetBrains Mono",
    phase: "3-parallel-progress",
  },
  {
    id: "p3-botB-progress",
    time: 7.0,
    sender: "官网_bot",
    side: "left",
    type: "progress",
    nameLabel: "官网_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (3s)\n → 🔧 Read: landing.html",
    font: "JetBrains Mono",
    phase: "3-parallel-progress",
  },
  {
    id: "p3-botA-update1",
    time: 8.0,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content:
      '⚙️ working... (8s)\n → 🔧 Read: payment.ts\n → 🔧 Grep: "callback"',
    font: "JetBrains Mono",
    updateTarget: "p3-botA-progress",
    phase: "3-parallel-progress",
  },
  {
    id: "p3-botB-update1",
    time: 9.0,
    sender: "官网_bot",
    side: "left",
    type: "progress",
    nameLabel: "官网_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content:
      "⚙️ working... (6s)\n → 🔧 Read: landing.html\n → 🔧 Edit: landing.html",
    font: "JetBrains Mono",
    updateTarget: "p3-botB-progress",
    phase: "3-parallel-progress",
  },

  // ═══ Phase 4: 成员 ↔ 成员沟通 (12s - 15s) ═══
  {
    id: "p4-momo-chat",
    time: 12.0,
    sender: "momo",
    side: "left",
    type: "chat",
    nameLabel: "Momo",
    nameColor: "#A78BFA",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@Nova 官网的活动banner我做好了，等会儿发你",
    font: "Inter",
    phase: "4-member-chat",
  },
  {
    id: "p4-nova-reply",
    time: 13.15,
    sender: "nova",
    side: "left",
    type: "chat",
    nameLabel: "Nova",
    nameColor: "#EC4899",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "好的👍",
    font: "Inter",
    phase: "4-member-chat",
  },

  // ═══ Phase 5: bot 结果 + 回复继续 (15s - 22s) ═══
  {
    id: "p5-botA-result",
    time: 15.0,
    sender: "商城_bot",
    side: "left",
    type: "result",
    nameLabel: "商城_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    content: "✅ 定位到问题：payment callback 超时未处理，接口缺少 retry 逻辑",
    font: "Inter",
    phase: "5-result-and-reply",
  },
  {
    id: "p5-you-reply",
    time: 17.0,
    sender: "you",
    side: "right",
    type: "reply",
    nameColor: "",
    bubbleColor: "#1A4D3E",
    textColor: "#D1FAE5",
    content: "直接修掉，错误提示也优化一下",
    quote: "✅ 定位到问题：payment callback 超时未处理...",
    font: "Inter",
    phase: "5-result-and-reply",
  },
  {
    id: "p5-botA-resume",
    time: 19.0,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (3s)\n → 🔧 Edit: payment.ts\n → 🔧 Bash: npm test",
    font: "JetBrains Mono",
    phase: "5-result-and-reply",
  },

  // ═══ Phase 6: 一人指挥多项目 (22s - 25s) ═══
  {
    id: "p6-you-c",
    time: 22.0,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#1A4D3E",
    textColor: "#D1FAE5",
    content: "@小程序_bot 首页出一版深色模式",
    font: "Inter",
    phase: "6-one-person-multi-project",
  },
  {
    id: "p6-botC-progress",
    time: 23.0,
    sender: "小程序_bot",
    side: "left",
    type: "progress",
    nameLabel: "小程序_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (2s)\n → 🔧 Read: styles/theme.ts",
    font: "JetBrains Mono",
    phase: "6-one-person-multi-project",
  },

  // ═══ Phase 7: 多人多项目交叉 + 协作闭环 (25s - 38s) ═══
  {
    id: "p7-botB-result",
    time: 25.0,
    sender: "官网_bot",
    side: "left",
    type: "result",
    nameLabel: "官网_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    content:
      "✅ 落地页文案已更新：标题改为「五一特惠」，副标题、CTA 按钮同步调整",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-kira-feedback",
    time: 27.0,
    sender: "kira",
    side: "left",
    type: "chat",
    nameLabel: "Kira",
    nameColor: "#F59E0B",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "方向挺好，再加一句用户评价",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-leo-review",
    time: 28.5,
    sender: "leo",
    side: "left",
    type: "chat",
    nameLabel: "Leo",
    nameColor: "#3B82F6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "商城的支付我看了下改动，逻辑没问题 👍",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-sage-seo",
    time: 30.0,
    sender: "sage",
    side: "left",
    type: "message",
    nameLabel: "Sage",
    nameColor: "#14B8A6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@官网_bot SEO 关键词也更新一下，配合这次活动",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-botA-final",
    time: 31.5,
    sender: "商城_bot",
    side: "left",
    type: "result",
    nameLabel: "商城_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    content:
      "✅ 已修复：添加了 retry 逻辑 + 用户友好的错误提示，12 个测试全部通过",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-botC-result",
    time: 33.0,
    sender: "小程序_bot",
    side: "left",
    type: "result",
    nameLabel: "小程序_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    content: "✅ 深色模式配色方案已生成，应用到首页所有组件",
    font: "Inter",
    phase: "7-cross-collaboration",
  },
  {
    id: "p7-momo-reply-c",
    time: 34.5,
    sender: "momo",
    side: "left",
    type: "reply",
    nameLabel: "Momo",
    nameColor: "#A78BFA",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "不错，再出一版渐变背景的",
    quote: "✅ 深色模式配色方案已生成...",
    font: "Inter",
    phase: "7-cross-collaboration",
  },

  // ═══ Phase 9a: 群里发起新项目 (40s) ═══
  {
    id: "p9a-nova-announce",
    time: 40.0,
    sender: "nova",
    side: "left",
    type: "announcement",
    nameLabel: "Nova",
    nameColor: "#EC4899",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "五一活动反响不错，老板决定单独做一个活动项目，我们马上启动 🚀",
    font: "Inter",
    phase: "9a-announce",
  },

  // ═══ Phase 9c: 宣布上线 (48s) ═══
  {
    id: "p9c-you-launch",
    time: 48.0,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#1A4D3E",
    textColor: "#D1FAE5",
    content: "@活动_bot 已上线，大家开搞 🔥",
    font: "Inter",
    phase: "9c-launch",
  },

  // ═══ Phase 9d: 全员秒响应 (49s - 53s) ═══
  {
    id: "p9d-leo",
    time: 49.0,
    sender: "leo",
    side: "left",
    type: "message",
    nameLabel: "Leo",
    nameColor: "#3B82F6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content:
      "@活动_bot 初始化项目，Next.js + TypeScript + Tailwind，搭好基础目录结构",
    font: "Inter",
    phase: "9d-team-response",
  },
  {
    id: "p9d-nova",
    time: 50.0,
    sender: "nova",
    side: "left",
    type: "message",
    nameLabel: "Nova",
    nameColor: "#EC4899",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@活动_bot 写一版活动规则页的文案，要突出限时和稀缺感",
    font: "Inter",
    phase: "9d-team-response",
  },
  {
    id: "p9d-momo",
    time: 50.8,
    sender: "momo",
    side: "left",
    type: "message",
    nameLabel: "Momo",
    nameColor: "#A78BFA",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@活动_bot 出一版活动主视觉的配色方案，风格参考去年国庆那版",
    font: "Inter",
    phase: "9d-team-response",
  },
  {
    id: "p9d-kira",
    time: 51.5,
    sender: "kira",
    side: "left",
    type: "message",
    nameLabel: "Kira",
    nameColor: "#F59E0B",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@活动_bot 把用户调研里的前三个痛点整理成需求清单",
    font: "Inter",
    phase: "9d-team-response",
  },
  {
    id: "p9d-sage",
    time: 52.2,
    sender: "sage",
    side: "left",
    type: "message",
    nameLabel: "Sage",
    nameColor: "#14B8A6",
    bubbleColor: "#1E293B",
    textColor: "#E5E7EB",
    content: "@活动_bot 写一版小红书发布文案，配合上线节奏",
    font: "Inter",
    phase: "9d-team-response",
  },

  // ═══ Phase 9e: bot 全部接住 (53s - 57s) ═══
  {
    id: "p9e-botD-progress1",
    time: 53.0,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (2s)\n → 🔧 Bash: npx create-next-app",
    font: "JetBrains Mono",
    phase: "9e-bot-working",
  },
  {
    id: "p9e-botD-progress2",
    time: 54.0,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (1s)\n → 🔧 Write: rules.md",
    font: "JetBrains Mono",
    phase: "9e-bot-working",
  },
  {
    id: "p9e-botD-progress3",
    time: 54.8,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D1F17",
    textColor: "#9CA3AF",
    content: "⚙️ working... (1s)\n → 🔧 Write: colors.json",
    font: "JetBrains Mono",
    phase: "9e-bot-working",
  },
  {
    id: "p9e-botD-result1",
    time: 55.5,
    sender: "活动_bot",
    side: "left",
    type: "result",
    nameLabel: "活动_bot",
    nameColor: "#10B981",
    bubbleColor: "#0D2818",
    textColor: "#D1FAE5",
    content:
      "✅ 项目已初始化：Next.js 14 + TypeScript + Tailwind，目录结构搭好了",
    font: "Inter",
    phase: "9e-bot-working",
  },
];

// ═══ Phase 9b: 加 bot 菜单动画（非气泡，单独处理） ═══

export interface MenuStep {
  time: number;
  action:
    | "show_menu"
    | "type_token"
    | "show_validation"
    | "type_name"
    | "type_path"
    | "click_confirm"
    | "show_result";
  content: string;
  duration: number; // ms
}

export const MENU_STEPS: MenuStep[] = [
  { time: 42.0, action: "show_menu", content: "Add Bot", duration: 500 },
  {
    time: 43.0,
    action: "type_token",
    content: "7891234567:AAH-xxxxx...",
    duration: 800,
  },
  {
    time: 43.8,
    action: "show_validation",
    content: "✅ Found: @活动_bot",
    duration: 600,
  },
  { time: 44.5, action: "type_name", content: "五一活动", duration: 500 },
  {
    time: 45.5,
    action: "type_path",
    content: "/projects/product-d",
    duration: 600,
  },
  {
    time: 46.5,
    action: "click_confirm",
    content: "✅ 已添加 @活动_bot",
    duration: 400,
  },
  { time: 47.0, action: "show_result", content: "🔄 重启中...", duration: 800 },
];

// ═══ Phase 10: 收尾文字 ═══

export interface ClosingText {
  time: number;
  text: string;
  fontSize: number;
  color: string;
  animation: "fadeIn" | "append";
}

export const CLOSING: ClosingText[] = [
  {
    time: 58.0,
    text: "一个群",
    fontSize: 80,
    color: "#FAFAFA",
    animation: "fadeIn",
  },
  {
    time: 59.0,
    text: "所有项目",
    fontSize: 80,
    color: "#FAFAFA",
    animation: "append",
  },
  {
    time: 60.0,
    text: "整个团队",
    fontSize: 80,
    color: "#FAFAFA",
    animation: "append",
  },
  {
    time: 61.0,
    text: "任务 · 进度 · 结果 · 讨论",
    fontSize: 52,
    color: "#9CA3AF",
    animation: "fadeIn",
  },
  {
    time: 61.5,
    text: "同一条时间线",
    fontSize: 52,
    color: "#FAFAFA",
    animation: "append",
  },
];

// ═══ 全局配置 ═══

export const CONFIG = {
  canvas: { width: 1080, height: 1920 },
  fps: 30,
  durationInSeconds: 65,
  background: "#0A0A0A",

  chat: {
    width: 980,
    cornerRadius: 28,
    fill: "#0C0C0C",
    stroke: "#333333",
    strokeWidth: 1,
    headerFill: "#1A1A1A",
    headerHeight: 130,
    messagePadding: { x: 24, y: 20 },
    messageGap: 24,
  },

  bubble: {
    left: { cornerRadius: [0, 20, 20, 20] as const, maxWidthRatio: 0.75 },
    right: { cornerRadius: [20, 20, 0, 20] as const, maxWidthRatio: 0.75 },
    padding: { x: 24, y: 16 },
    nameSize: 26,
    textSize: 32,
    progressTextSize: 28,
    replyBorderWidth: 5,
    replyBorderColor: "#4B5563",
    replyTextColor: "#6B7280",
    replyTextSize: 26,
  },

  animation: {
    bubbleSlideUp: { distance: 20, duration: 200, easing: "easeOut" },
    bubbleFadeIn: { duration: 150 },
    progressUpdate: { duration: 150 },
    scrollUp: { duration: 2000, easing: "easeInOut" },
    closingFadeIn: { duration: 400 },
    closingAppend: { duration: 300 },
  },

  /** 自动滚动：当气泡累计高度超过可视区域时，平滑滚动 */
  autoScroll: {
    viewportHeight: 1660,
    scrollDuration: 300,
    scrollEasing: "easeOut",
    bottomPadding: 60,
  },

  /** Phase 8 全景滚动 */
  panoramaScroll: {
    startTime: 38.0,
    endTime: 40.0,
    easing: "easeInOut",
  },

  /** Phase 9b 菜单界面 */
  menu: {
    startTime: 42.0,
    endTime: 48.0,
    background: "#0C0C0C",
    buttonColor: "#1E293B",
    buttonHighlight: "#10B981",
    inputBackground: "#141414",
    inputBorder: "#333333",
    successColor: "#10B981",
    typingSpeed: 50, // ms per character
  },

  /** Phase 10 收尾 */
  closing: {
    startTime: 58.0,
    endTime: 65.0,
    background: "#0A0A0A",
    githubCard: {
      time: 63.0,
      repo: "qiudeqiu/claude-crew",
      fill: "#0F0F0F",
      stroke: "#333333",
      cornerRadius: 16,
    },
  },

  /** 群头栏 */
  header: {
    avatar: { size: 76, fill: "#10B981" },
    title: "claude-crew",
    subtitle:
      "你, Leo, Momo, Nova, Kira, Sage, 商城_bot, 官网_bot, 小程序_bot, 活动_bot",
    titleFont: "Inter",
    titleSize: 36,
    titleWeight: "600",
    subtitleFont: "Inter",
    subtitleSize: 24,
    subtitleColor: "#6B7280",
  },
};
