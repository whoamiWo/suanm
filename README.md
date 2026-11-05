# 元亨利贞 · 中国传统术数在线排盘

综合八字、紫微斗数、六爻、梅花易数、奇门遁甲、大六壬、小六壬、太乙、黄历等中国传统术数的在线排盘工具。

> 本站提供中国传统术数的算法排盘工具，结果基于所选规则推演，仅供传统文化研究与学习参考，
> **不构成任何医疗、法律、投资或人生决策建议**。

## 特性

- **算法透明**：排盘口径（真太阳时、日界、流派算法）均可显式选择，不做静默默认，结果可复现
- **交叉验证**：八字四柱与独立实现 `lunar-javascript` 逐例对拍一致
- **免费排盘**：基础排盘永久免费、免注册，是免费引流与 SEO 收录的基础
- **可分享**：参数在 URL 中，服务端直出盘面内容，每个「出生日期 + 术数」都是可索引的长尾页
- **代币计费**：余额 + 订阅双额度池，兑换码发放，无需支付资质即可开卖

## 术数支持

| 类别 | 术数 | 口径开关 |
|---|---|---|
| 命理 | 八字 | 真太阳时、`dayBoundary: midnight\|zi`、`yunSect 1\|2`、时辰未知排三柱 |
| | 大运流年 | 起运时刻、顺逆、虚岁 |
| | 紫微斗数 | `default\|zhongzhou`、年/运/年龄界、闰月策略、自定义四化 |
| | 紫微运限 / 飞星 | 大限、小限、流年流月流日、飞向自化 |
| 占卜 | 六爻 | 硬币/手工/蓍草三法，纳甲六亲六神、伏神动变 |
| | 梅花易数 | 时间/数字/文本起卦，体用诸诀 |
| | 奇门遁甲 | 转盘/飞盘 × 拆补/茅山/节气三等分 |
| | 大六壬 / 小六壬 | 月将、昼夜判定、三传 720 课表 |
| 历法 | 黄历 / 择日 | 13 时段、92 天窗口筛选、冲煞排除 |
| 玄学 | 太乙七十二局 | 金镜/统宗积数现代适配 |
| 风水 | 玄空飞星 | 运盘/山盘/向盘、格局检测 |
| 扩展 | 西洋占星 / 塔罗 | 7 宫制、全/大/小阿卡那 |

## 技术栈

```
Next.js 16.4.5 · React 19.3 · TypeScript 5.9.3 · Tailwind 4.3
taibu-core 4.0.0 (MIT) · @soul-atelier/xuankong (MIT)
PostgreSQL 17 · Redis 8 · Drizzle ORM · better-auth
vitest · playwright
```

> **版本约束**：`typescript-eslint` 要求 `typescript < 6.1.0`，故锁定 5.9.3（勿升级到 TS 7）。
> `taibu-core` 为纯 ESM，仅可在服务端使用；其依赖 `taobi`（MPL-2.0）要求奇门计算锁服务端，前端不打包。

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local

# 3. 启动依赖服务（PostgreSQL + Redis）
docker compose up -d

# 4. 初始化数据库
pnpm db:migrate

# 5. 启动开发服务器
pnpm dev
```

访问 <http://localhost:3000>

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm test` | 单元与契约测试 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm db:generate` | 生成数据库迁移 |
| `pnpm db:migrate` | 应用数据库迁移 |
| `pnpm verify:bazi` | 八字四柱与独立实现交叉对拍 |

## 项目结构

```
src/
├── app/
│   ├── api/chart/          排盘 API（免登录）
│   ├── api/auth/           better-auth 认证
│   ├── api/redeem/         兑换码核销
│   ├── api/reports/        AI 报告
│   ├── api/user/           余额与订阅
│   └── paipan/[method]/    SEO 排盘页（参数化 URL）
├── lib/
│   ├── chart/              术数适配层（隔离上游变更）
│   ├── billing/            代币制计费（余额+订阅双池、幂等）
│   ├── db/schema/          Drizzle schema
│   └── location/           出生地经度（真太阳时校正）
└── components/chart/       排盘表单
```

### 分层约定

- `lib/chart/` 是唯一与 `taibu-core` 耦合的目录，上游版本变更只需改这三个适配文件
- 自研术数实现 `ChartMethod` 后在 `lib/chart/registry.ts` 登记即可被 API 与页面调用
- `lib/db/` 统一管理连接池，路由与组件不得自行创建连接
- 金额一律用 `bigint micros`（百万分之一）存整数，杜绝浮点误差

## 计费模型

```
¥1 = 23 代金卷        1 次 AI 解读 ≈ 25 代金卷 ≈ ¥1.09
```

- **双额度池**：`billing_accounts` 为钱包（永续），`user_subscriptions` 为订阅（按周期刷新）
- **扣费顺序**：订阅额度优先（按 five_hour → daily → weekly → monthly → total 从短到长扣），不足部分扣钱包
- **唯一事实来源**：`billing_ledger` 记录每次变动，带幂等键防重复扣费
- **兑换码**：支持「充余额」与「直接开通套餐」两种形态，条件更新防并发双花

## 许可与合规

- 算法依赖 `taibu-core`（MIT）、`@soul-atelier/xuankong`（MIT）等开源库，保留各自版权声明
- 本站内容仅供传统文化研究与学习参考，不得用于医疗、法律、投资决策
- 出生信息属敏感个人信息，仅保存在用户自己的账号中，可随时导出与删除

## 免责声明

命理术数存在流派差异，本项目按主流公认理法实现，不代表唯一正确解释。
使用者应对基于本站输出的任何判断与决策自行承担责任。
