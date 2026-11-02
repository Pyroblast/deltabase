# 信源三：官方数据接入与成本核验

核验日期：2026-11-01。用途：Deltabase 单用户、本地、内部机会研究。本文是选型研究，不代表已接通供应商或已取得数据许可。

本轮仅阅读公开官方页面；没有注册、采购、外联、配置 MCP、读取密钥、调用需授权的业务 API，也没有修改源码、数据库或服务。文中「未核定」不等于免费、不支持或无限额。价格不换汇，税费另列。总控提供的公开端点 403 和浏览器阻断结果单独注明，没有绕过。

## 1. 决策摘要

建议将下一步拆成「人工交互研究试验」和「本地自动日更」两条路径，先验证前者的数据价值，再决定是否购买后者。

- **海外公司先评估 Crunchbase Pro + 官方 MCP 的交互式试验。** 2026-10-05 更新的官方购买说明给出 $99/月，并明确包含 MCP。这是当前有公开月付入口的候选；不是 $99 即可获得本地后台同步 API 的承诺。[Pro 当前说明](https://support.crunchbase.com/hc/en-us/articles/360001616808-Buy-Crunchbase-Pro)
- **国内融资事件优先评估 IT 桔子的授权文件交付或事件 API。** 官方支持表格与 API 两种服务；事件结构与本项目所需证据链匹配度较高。当前公开价格未核定，不能以历史会员价替代 API 报价。[官方数据服务](https://aboutus.itjuzi.com/zh-CN/)
- **Dealroom 暂不作为个人 MVP 的默认付费选择。** 当前定价至少 3 席、年付，API 另计；最低 3 席的确切总价未核定。可继续评估数据覆盖，但不依据旧价格、示例 demo 或免费 sample 承诺自动接入。[当前美元定价](https://dealroom.co/pricing-usd)

现有手动融资 MVP 可以继续承接经核验的原始报道与研究笔记。下一项开发更适合是「候选预览、来源保留、手动确认、重复导入识别」，然后在具体许可和样本验证完成后接供应商适配器。本轮没有实施这些建议。

## 2. 四种购买/接入方式必须分别判断

| 方式 | 能解决的问题 | 不能据此推定的权限 |
| --- | --- | --- |
| 网页订阅 | 人工检索、浏览资料、保存平台内列表 | 批量抓取、官方 API、后台定时运行、本地无限期保存 |
| CSV/Excel | 一次性导入、离线分析、可复核小样本 | 实时数据、完整融资事件粒度、稳定事件 ID、永久更新服务 |
| REST API | 程序化检索、历史回填、分页、增量同步 | 套餐包含所有字段、无限调用、自动获得转售/公开展示许可 |
| MCP | AI 客户端调用供应商工具，做交互研究或获准的代理任务 | 等同 REST 权限、服务账号、无人值守日更、免费返回任意数据、无限期缓存 |

MCP 只是接入方式，费用和权限仍取决于账号、套餐及合同。应分别核实「工具可连接」「字段可返回」「可存多久」「是否可无人值守」「可给谁看」。这是本项目的接入检查框架，不是供应商已批准的权利清单。

## 3. 官方接入与字段矩阵

### IT 桔子

| 项目 | 核验结果与适配含义 |
| --- | --- |
| 网页/文件/API | 官方提供按月等周期表格、定制 CSV/Excel/MySQL/JSON、API；不是同一购买项。可要求只覆盖所需公司/行业及融资事件，实际最低订单与范围须报价。[数据服务](https://aboutus.itjuzi.com/zh-CN/) |
| 认证 | V2 文档采用 access_token；认证接口使用 appid/appkey，支持 client_credentials/refresh_token。以实际开通版本为准，不将网页登录 Cookie 用作 API 凭据。[认证文档](https://www.itjuzi.com/shujuapi/V2BaseComponents/oauth2.0/get_access_token.html) |
| 文档版本 | V2 路径的总说明标注 3.7.0、更新 2026-05-29；路径名 V2 不代表文档停留于 2020。生产域名、开通接口清单需交付时核对。[总说明](https://www.itjuzi.com/shujuapi/V2BaseComponents/explain/explain.html) |
| 公司/事件标识 | `com_id`、`event_id` 分开；另有工商名、信用代码。可作供应商外键，不能把公司 ID 当事件 ID，也不应假定合并/纠错时 ID 永不调整。 |
| 新闻与时间 | `news[]` 含 title/url/time；事件发生时间拆为 invest_year/month/day，另有 create_time/update_time。新闻时间是披露线索，不能用录入时间替代融资发生时间。 |
| 增量与历史 | `date_pattern` 可选创建、更新、发生时间；可设起止区间及排序。历史回填按发生时间，纠错/迟到数据按更新时间；需要重叠窗口及本地去重。 |
| 分页 | `page` 默认 1、默认 20 条；另有 start/limit。最大 limit、并发、QPS、窗口边界及稳定排序保证未核定。 |
| 金额 | `detail_amount` 单位为万；`juzi_detail_amount` 是人民币估算值，不能当原币精确融资额。保留原币和模糊金额，不用估算值覆盖原文。 |

以上事件字段和参数来自同一份[投资事件接口文档](https://www.itjuzi.com/shujuapi/V2BaseComponents/event/v2_investevent.html)。该接口参数表没有列出公司 ID 筛选；不能先承诺「50 家公司一条查询」。公司详情是否携带完整轮次、公司筛选的可用路由需样本验证。

官方有[调用剩余次数接口](https://www.itjuzi.com/shujuapi/V2BaseComponents/interface_address/get_remaining_times.html)，说明应监控余量；但本轮没有核定套餐次数、重置周期、空结果/失败调用是否扣费。未找到可验证的官方 MCP 产品/价格，不能据此断言其不存在。个人内部使用、数据库保存、备份及到期后保留权需写入采购范围。

### Crunchbase

| 项目 | 核验结果与适配含义 |
| --- | --- |
| 网页/MCP | 当前 Pro 购买页明确含 MCP；MCP 按用户 OAuth 登录。REST API 仍需单独 provision 的 key，MCP 不能替代。[Pro](https://support.crunchbase.com/hc/en-us/articles/360001616808-Buy-Crunchbase-Pro)、[接入总览](https://data.crunchbase.com/docs/welcome-to-crunchbase-data) |
| 文件导出 | 官方 CSV 文档说可用于内部工具，但同页同时写每月 1k 行和 2k exports，存在冲突；不能把其中一个数字视为已核定额度。实际套餐、行定义与字段需账户/报价确认。[CSV 帮助](https://support.crunchbase.com/hc/en-us/articles/115010610787-Export-to-CSV) |
| REST 认证/限流 | 推荐 `X-cb-user-key` 请求头。Enterprise REST 文档给出每 key 200 请求/分钟、最多 3 个并发；不代表月度配额，也不适用于 MCP。[API essentials](https://data.crunchbase.com/docs/api-essentials) |
| 财务字段分层 | Core Financials 主要是最新/累计财务快照；逐轮融资历史应核对 Advanced Financials。不能仅凭 Fundamentals 名称承诺完整轮次、原新闻和所有财务字段。[套餐映射](https://data.crunchbase.com/docs/api-packages-overview) |
| 稳定标识 | 公司及融资轮次各有 UUID；详情可接受 UUID/permalink，内部供应商映射优先保存 UUID。域名仅用于候选匹配，同域名可能返回多条。[实体匹配 FAQ](https://data.crunchbase.com/docs/troubleshooting-and-faqs) |
| 事件/证据 | FundingRound 详情支持 organization、investors、press_references 等卡片。证据卡是否完整、允许哪些字段取决于开通版本；不能假定每轮都有 2 条独立报道。[轮次详情](https://data.crunchbase.com/reference/getfundinground) |
| 时间 | 轮次有 announced_on、closed_on、created_at、updated_at；新闻引用有 url 等字段。公告与交割日期分别保存，closed_on 缺失时不以公告日期伪造。字段存在于参考文档不等于当前 key 已授权。[组织关联卡片参考](https://data.crunchbase.com/reference/getorganizationcard-2) |
| 增量关键点 | **新增/修改融资轮次不保证改变 organization.updated_at。** 必须跟踪 funding_rounds 等相关实体，不能只轮询公司修改时间。[当前 FAQ](https://data.crunchbase.com/docs/troubleshooting-and-faqs) |
| REST 分页 | 使用最后一条原始记录 UUID 作为 after_id，查询/排序保持不变；短页也继续请求至空页。失败不推进游标，重复 UUID 去重。关联卡片分页须另验。[分页指南](https://data.crunchbase.com/docs/paginate-search-results) |

**MCP 的技术与许可边界：** 当前参考文档支持结构化搜索、实体详情与引用元数据，具体工具依赖账号；应通过 live schema 核验，不能假定 REST 全部操作都有 MCP 对应。程序化 headless/backend 接入需单独安排身份与权限，不能把交互 OAuth 注册当服务身份。[MCP 开发参考](https://data.crunchbase.com/docs/mcp-developer-reference)

2026-09-30 生效的 MCP 条款允许获授权的内部研究与工作流；订阅终止后要求在 10 天内删除原始数据及相关 AI artifacts，已有合规内部分析成果和普通灾备另有例外。**不能据此承诺“订一个月、永久留下完整原始数据库”。** 本地存储、备份、摘要以及第三方 AI 客户端处理均要按实际协议划清范围。[MCP 条款，第 3、5、8、10 节](https://about.crunchbase.com/terms-of-service/mcp-server-terms)

### Dealroom

| 项目 | 核验结果与适配含义 |
| --- | --- |
| 正式 API | 官方定位是程序化公司/融资数据与内部工具。当前 cookbook 使用 Programmatic M2M、OAuth2 client-credentials、Authorization 和 X-Client-Id；旧知识库只写 API key。需以实际开通版本文档为准。[API 产品](https://dealroom.co/api/)、[当前构建指南](https://dealroom.co/cookbooks/deal-board/)、[知识库](https://knowledge.dealroom.co/knowledge/dealroom-api-1) |
| 公司标识/回填路由 | 当前指南使用公司 UUID，给出 `/data/search`、`/data/companies/{id}`、`/data/companies/{id}/funding-rounds`。这是设计入口，尚未调用验证。[Deal Board](https://dealroom.co/cookbooks/deal-board/) |
| 事件 ID/证据字段 | 完整 schema 未读到：轮次稳定 ID、原新闻 URL、公告/交割/创建/修改时间的准确字段名和缺失语义均待验证。公司 UUID 已有公开依据，不能外推所有融资事件都有同等标识。 |
| 增量/分页/配额 | 产品宣传历史与实时数据，但本轮没有核定轮次 modified-since、分页模式/上限、变更回放、删除/合并通知。当前价格页称按调用量报价、自定义限流；不要填入虚构固定 QPS 或月度额度。[价格](https://dealroom.co/pricing-usd) |
| MCP | 官方远程 OAuth 接入、只读工具，包含 search_transactions/entity_fundings。MCP 页说所有 Premium 可用，价格页却把 MCP 列在 Premium Plus/Enterprise；权限存在官方页面冲突。[MCP 页](https://dealroom.co/mcp/)、[价格页](https://dealroom.co/pricing-usd) |
| 文件与许可 | 当前套餐有导出 credits，但导出文件能否带逐轮 ID、证据、修改时间及实际重置周期待验证。内部数据库保存、到期删除和个人方案需确认，不从“可导出”外推无限期镜像许可。 |

公开 API 文档入口本轮仅返回空壳，MCP Markdown 参考在阅读器中报不支持的 content-type；这是本轮可读性限制，不是断言正式 API 不可用。[API 文档入口](https://docs.dealroom.co/docs/premium-api)、[MCP 参考入口](https://dealroom.co/mcp/dealroom-mcp-reference.md)

**免费样本与 demo 不能算已接通：** 官方 llms.txt 将 `/api/live-signals`、`/api/lookup-slug` 等标为无认证 sample，明确区别于完整 API。总控本轮只读访问两项均 HTTP 403，浏览器报价页也遇阻断并停止；没有绕过。因此不纳入本地日更可用路径。旧 CRM cookbook 当前重定向到 Deal Board，其 demo 使用保存快照，提醒只是应用内到期列表，实时数据仍需正式权限。[公开索引](https://dealroom.co/llms.txt)、[当前 demo 边界](https://dealroom.co/cookbooks/deal-board/)

## 4. 成本台账：哪些能报价，哪些还不能

| 成本项 | IT 桔子 | Crunchbase | Dealroom |
| --- | --- | --- | --- |
| 单用户网页/交互入口 | 当前会员价未核定；历史 PDF 不作报价 | Pro $99/月；年付介绍有首年优惠，但完整年价未核定 | 至少 3 席、按年预付；最低 3 席总价未核定 |
| 本轮可验证的展示价格 | 定制询价 | 只买 1 月 Pro 的平台基数 $99；不代表完整任务预算 | 默认 **10 席** Premium $34,500/年，Plus $45,900/年；不是个人最低价 |
| API 最低年约 | 金额、年约要求均未核定 | 定制报价，最低金额及期限未公开核定 | API 按调用量在套餐上附加报价；附加最低年费未核定 |
| 配额 | 合同调用次数/文件行数待定 | REST 月度额度待定；MCP allowance 按账户，CSV 页面冲突 | 每席 Premium 10k、Plus 30k 导出 credits；重置周期需确认；API 单独配额 |
| 额外字段 | 新闻、历史事件、估值/其他表是否分项计费需确认 | 明确询 Advanced Financials、press_references，不额外采购预测/联系人等无关字段 | 轮次/新闻/历史/变更字段是否包含需报价；联系人 credits 对本任务非必需 |
| 席位 | 是否有个人方案/最低席位待定 | 个人 Pro 可作基准；REST 是否要求额外席位待定 | 即使只用 1 人也不能忽略 3 席最低承诺 |
| 额度追加 | 单价、失败/重复调用计费待定 | MCP Data Tokens 可追加，金额/默认配额未公开核定；REST 超额价格待定 | API 超额单价、自定义限流和导出追加费待定 |
| 税费/支付 | 含税、发票、支付费未知 | 未核定是否含适用税；AI 客户端费用另算 | 未核定是否含适用税；跨币种/支付费另算 |

依据：[IT 桔子报价说明](https://aboutus.itjuzi.com/zh-CN/)、[Crunchbase API 价格 FAQ](https://support.crunchbase.com/hc/en-us/articles/32319290128019-Crunchbase-API-FAQ)、[Pro 月付](https://support.crunchbase.com/hc/en-us/articles/360001616808-Buy-Crunchbase-Pro)、[MCP 用量与追加](https://support.crunchbase.com/hc/en-us/articles/55909906252947-Crunchbase-MCP-Connection-Guide)、[Dealroom 当前定价](https://dealroom.co/pricing-usd)。

成本公式：

```text
交互研究月成本 = 网页/MCP平台费 + 追加数据额度 + 新增AI客户端费用 + 税费
本地日更首年成本 = API许可/最低承诺 + 必需平台席位 + 必需字段附加
                + 超额调用/导出 + 新增运行费用 + 税费
```

应询问 API 是否已包含必需平台席位和财务字段，避免重复相加；Dealroom 当前公开表述则是 API 加在平台计划之上。本地自用无需据此另买云主机，但电费、人工和已有 AI 订阅不等于不存在，只是不混入供应商价格。

**官方页面冲突记录：**

1. Dealroom 搜索缓存曾显示 Premium $14,500/年、Plus $20,000/年、14 天试用；直接打开现页为按席位定价，默认 10 席价格如上，试用为 3 天/50 export credits。旧缓存价格不用于预算。页面显示的每席月价为四舍五入值，也不能乘 3 或乘 120 反推合同总价。[当前原页](https://dealroom.co/pricing-usd)
2. Dealroom MCP 的 Premium 与 Plus 资格冲突未解决，不按较便宜说法先采购。[MCP](https://dealroom.co/mcp/)、[价格](https://dealroom.co/pricing-usd)
3. Crunchbase 新购买页和 MCP overview 支持 Pro/按账户额度；另一份团队管理文档仍要求 Business 加购 MCP 席位。记录为账号/产品版本范围待确认，不能把旧企业席位要求套在所有个人用户，也不能向所有账号保证同等额度。[当前 MCP 总览](https://data.crunchbase.com/docs/mcp-overview)、[团队管理文档](https://data.crunchbase.com/docs/managing-mcp-access)
4. Crunchbase 当前 FAQ 与 v4-legacy FAQ 对 organization.updated_at 的说法相反；实施按当前文档跟踪轮次更新。[当前](https://data.crunchbase.com/docs/troubleshooting-and-faqs)、[旧版，仅用于记录冲突](https://data.crunchbase.com/v4-legacy/docs/api-faqs)
5. CSV 帮助的 1k/2k 额度冲突不沿用旧搜索摘要来“解决”。[CSV 原页](https://support.crunchbase.com/hc/en-us/articles/115010610787-Export-to-CSV)

补充核验：Harmonic 官方 MCP 指南明确 **Deal data 是 add-on**，不能以公司 enrichment 可用推定完整融资事件免费。本轮不把它扩展为第四家完整报价；其费用仍未知。[Harmonic 官方指南](https://support.harmonic.ai/en/articles/12785899-harmonic-mcp-server-getting-started-guide)

## 5. 统一用量场景与估算

以下是我们为比较供应商设定的工程假设，不是已经测得的请求数或供应商报价：单用户，固定监控 50 家公司；首次回填平均每家 3 轮，即 150 个历史事件；随后日更 30 天；当月筛出 100 个候选事件，每事件最多 2 个来源。候选不自动扩成 150 家监控名单。源网站的新闻阅读不算供应商 API 请求，供应商证据卡检索则可能算。

### 5.1 REST 规划量

先按「公司 ID 匹配 + 轮次历史页 + 详情补全」拆量，不假设三家有相同批量路由：

| 操作 | 基础数量 | 必须保留的变量 |
| --- | --- | --- |
| 50 家公司首次身份匹配 | 50 次单公司查询 | 歧义重查/分页可能增加；已知 ID 可减少 |
| 50 家首次历史回填 | 50 次历史首屏 | 每家平均 3 轮是假设；超页、独立公司详情另计 |
| 150 个历史事件详情补全 | 最多 150 次单事件读取 | 如果历史列表已含全部必要字段可省；新闻卡额外分页另计 |
| 固定 50 家日更 30 天 | 1,500 次公司轮次集合读取 | 必须读取相关轮次，不能仅读公司 updated_at；全部分页另计 |
| 每日发现一次候选 | 30 次首屏 | 100 是最终候选数，不是原始命中数；全市场筛选可能很多页 |
| 100 个候选补全详情 | 最多 100 次 | 与监控事件重叠可去重；未知公司详情/匹配另计 |

简单拆分合计 **1,880 次基础业务调用**；这是给报价讨论用的参考作业，不是三家通用的上界、最低配额或现成可执行方案。加上 `额外分页 + 新公司解析/详情 + 监控纠错详情 + 证据卡 + 认证/余额查询 + 重试`，才是请求预算。报价可先要求覆盖约 **3,000 次/月及首月回填** 的可选档，是否足够必须样本测量；不要为了凑到该数字截断结果并宣称完成。

供应商分别处理：

- **IT 桔子**：事件列表默认每页 20。若筛选刚好只返回 150 个目标历史事件，需 `ceil(150/20)=8` 页；但已公开参数没有公司 ID 筛选，因此实际可能要读更多记录再本地筛选。按每日更新时间窗拉取时，页数为 `Σ max(1, ceil(U_d/20))`，`U_d` 是窗口内原始命中数（含重叠记录），不是最终候选数。列表已含证据时不用另发每条新闻 API。不能把 8 页当 50 家公司的确定回填成本。[事件接口](https://www.itjuzi.com/shujuapi/V2BaseComponents/event/v2_investevent.html)
- **Crunchbase**：确认 licensed funding_rounds search 可按公司及更新时间筛选后，可用轮次级 delta 替代每天 50 次遍历。参考公式为 `Σ(ceil(U_d/L)+1)`；`L` 是获准页长，多出的 1 是最终空页，空集合也有一次请求。首月历史每公司独立遍历还应加入 50 个结束页。实际 page limit 与过滤组合在授权样本里确认，不用旧版“最大 1000”当所有端点上限。[轮次搜索](https://data.crunchbase.com/reference/searchfundingrounds)、[分页终止规则](https://data.crunchbase.com/docs/paginate-search-results)
- **Dealroom**：当前指南有按公司取 funding-rounds 的路径，故上述逐公司方案有设计依据；轮次字段、分页和增量语义未验证，不能给出实际信用额度消耗。[构建指南](https://dealroom.co/cookbooks/deal-board/)

最多证据引用：历史 `150×2=300`，新增候选 `100×2=200`，合计 **500 个引用槽位**。不等于 500 个不同新闻 URL，也不等于 500 个额外 API 请求。两个数据库转引同一篇稿件仍是一条原始证据。获取文章全文的权利也不由融资数据库订阅自动提供。

### 5.2 Crunchbase MCP 数据额度规划

官方当前对 basic fields 按「返回记录数 × 非空字段数 × 10 data tokens」计量；关联记录也独立计字段，Expert 处理另有消耗，数据 token 与 AI 模型 token 分开。重复请求不保证免费。[计量说明](https://data.crunchbase.com/docs/data-tokens-and-usage)

为了给小试一个可审计基线，假设只用结构化检索、不用 Expert 分析：

| 返回内容 | 假定非空字段数 | 规划 data tokens |
| --- | --- | --- |
| 首次 50 家公司，含身份、网站、描述等 | 6 | 50×6×10 = 3,000 |
| 150 个历史事件，含轮次身份、公司、日期、金额、币种等 | 8 | 150×8×10 = 12,000 |
| 30 天每日返回固定 150 轮的 ID+轮次修改时间 | 2 | 150×30×2×10 = 90,000 |
| 100 个新候选事件 | 8 | 100×8×10 = 8,000 |
| 最多 500 个来源引用，每条 URL/标题/时间 | 3 | 500×3×10 = 15,000 |
| 合计 | | **128,000 data tokens** |

这是字段级规划值，不保证 live schema 恰好支持这些选择；查询识别、额外系统字段、候选筛选预览、变化详情、重试、Expert 消耗另加。证据缺失、聚合字段或有效轮次级 delta 可能减少返回量。**没有已核定的 Pro 默认 allowance 和 token 追加单价，因此不能把 128,000 换算成美元或断言 $99 能完成全月。** 日更这一项只展示用量；不构成个人 OAuth 已获准无人值守的依据。[程序化接入边界](https://data.crunchbase.com/docs/mcp-developer-reference)

若用户决定试验，建议沿用本轮固定的 6 家公司与另 10 个候选，固定字段，记录每次返回的实际 deduction，再决定是否扩大到 50 家。MCP 余额不是预留预算，多个连接可能同时消耗；扣费元数据缺失不能当 0，超时重试也可能再次收费。[MCP 已知限制](https://data.crunchbase.com/docs/known-mcp-limitations)

### 5.3 CSV 的量级

若导出以事件为一行，首月基础数据约 50 公司行 + 150 历史事件行 + 100 候选事件行 = 300 行；若证据另成表，最多再加 500 行。按关联投资人一人一行的导出可能更大。每天重导历史 150 轮则单月约 4,500 事件行，不能用「只有 50 家公司」判断额度够用。

因此授权文件小试宜先做一次回填和每周差量，是否能做到真实日更由文件服务频率、事件标识、更新时间及合同决定。文件导入是接入阶段，不等于已具备自动采集。

## 6. 与现有融资模型的适配方案

以下是本项目的设计建议，并非供应商能力承诺。

1. **供应商身份独立保存。** 用 `(provider, entity_type, external_id)` 映射本地 company/event UUID；保存供应商原 URL 与原 ID。名称、域名、日期、金额都不能作为唯一身份。公司合并、事件拆分由人工确认，不静默覆盖已有事件。
2. **保留四类时间。** 来源融资发生/交割时间、公告/新闻发布时间、供应商 created/updated、我们 observed_at 各自保存；保留日期精度。供应商更新时间不是新的融资事件。
3. **先进入候选区。** 原始响应按许可保存；抽取字段、证据、缺失项和冲突后展示预览，确认后使用现有修订/证据机制写入。API 缺字段与真实空值区分，不能清空已有有效数据。
4. **幂等与断点。** 稳定供应商事件 ID 加规范化内容指纹识别重复；相同内容只增加观察，不制造新版本。修改时走预期版本检查；分页完整持久化后才推进 checkpoint，失败保留上次有效结果。
5. **重叠窗口与对账。** 日增量包含一段重叠时间，按事件 ID 去重；定期重扫固定监控公司的已知轮次，捕获迟到数据。若没有可靠 modified-since，则明确采用全量小集合比较，显示覆盖与成功时间；一次未返回不自动删事件。
6. **事实与研究笔记分开。** 供应商估算、第三方报道、公司公告与我们的机会推断分别标记。融资、累计融资和估值分开；保留原币和模糊金额，不因为可计算就把估算变成事实。
7. **许可决定保留策略。** 原始供应商数据、衍生分析、原新闻链接、用户自己的笔记分层存储；记录来源许可/到期要求，避免把受限原始数据固化进永久修订和备份。API 授权尚未明确前，不先导入大批第三方记录。

## 7. 下一步的最小验证与报价清单

建议分三步，均尚未执行：

1. **数据价值试验：** 海外方向先查 Crunchbase 个人账号实际 MCP 可用性、额度和许可；若用户选择月付，仅将 $99 作为平台基数。国内方向准备 IT 桔子小范围文件/API 样本规格；Dealroom 等三席最低总价和许可清楚后再比较。各家沿用本轮相同 6 家公司、另 10 个候选，检查公司匹配、旧轮次、原新闻、模糊金额和迟到修改。
2. **本地导入闭环：** 先设计一种经授权的 JSON/CSV 中间格式及预览/确认流程；来源 ID、来源 URL、时间语义和许可元数据必填或明确缺失。测重复导入不增事件、纠错只增修订、失败不清空、研究笔记不被刷新覆盖。先用授权样本或本地合成 fixture，不触碰个人生产数据。
3. **自动化采购与适配：** 只有样本证明有价值、单用户费用可接受且后台/持久化许可明确，才选择一个正式 API 实施 50 家历史回填及 30 天日更。开发预算按有无轮次级增量、原新闻覆盖和分页完整性决定；不同时买三家。

未来若获准询价，发送同一份需求以便比较；本轮未发送：

- 单个自然人内部研究、本机 SQLite、无公开数据服务；50 家初始公司、约 150 历史轮次、30 天日更、100 候选/月、最多两条来源/事件。需覆盖哪些地区/历史年份另列。
- 公司 ID、融资事件 ID、原新闻 URL/发布时间、发生/公告/交割日期、record created/modified、金额原币与估算标记、投资人；列出缺失字段和附加费。
- 公司匹配、按公司历史轮次、轮次级修改筛选、分页、补录纠错、删除合并通知；提供脱敏 schema 和包含修改案例的合法样本。
- 平台费、API 最低年约/最短期限、最低席位、字段附加、配额计费单位、空/失败/重复请求扣费、超额单价、税费/发票、续约涨价分别列出；不要只给一个套餐总价。
- REST 与 MCP 分别确认：个人 OAuth、M2M 身份、无人值守、第三方 AI 客户端、月度 data allowance、token 追加单价及硬停止能力。
- 原始数据/修订/备份可保留多久，订阅结束如何处理，分析成果可否保留；供应商数据与原报道版权边界；署名要求。

**研究完成判定：** 已形成官方依据、冲突记录、统一用量假设及下一步试验顺序；三家正式 API 均未实测。尚缺的是合同级价格、许可和授权样本，不应把这些空白包装为已经跑通的接入。
