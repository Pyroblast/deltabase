# Harmonic 发现与提醒流程研究

研究日期：2026-11-01，北京时间。负责人：前端和交互设计。

状态：**公开资料与演示核验完成，未登录产品端实测。** 本轮仅写此报告；未注册、申请 demo、发送邮件、付费、授权集成或配置真实提醒，未改源码、公共文档、数据库、服务或 Git，也未运行测试。

## 1. 对 Deltabase 最有价值的结论

Harmonic 把研究工作分成三个可以组合、但语义不同的对象：**保存搜索负责动态发现，名单负责保存已选对象，Scout 负责重复执行研究任务。** 其公开演示进一步分开“发现创始人并评分”和“监控相关公司的后续进展”，人工复核夹在两者之间。值得借鉴的是这套分工，而不是直接加入一个无边界的 AI 搜索框。[Harmonic 101](https://support.harmonic.ai/en/articles/8230516-harmonic-101)、[官方演示](https://www.loom.com/share/781a70664c3d48e9a1ba3b5814d51577)

对融资模块尤其重要：**首次命中搜索、首次进入数据库、公告日期、公司成立日期是不同的时间。** 有新搜索结果不等于原名单公司的每一次融资变化都会再次提醒。公开文档没有完整解释搜索重新入选、条件变更和重复通知的状态机，不能替它补全。[搜索过滤器](https://support.harmonic.ai/en/articles/5867775-search-filters)、[结果管理](https://support.harmonic.ai/en/articles/8013505-managing-your-search-results)

以下能力分三档：

| 标记 | 含义 | 本轮能证明什么 |
| --- | --- | --- |
| 文档确认 | 官方帮助或字段字典明确说明 | 能力名称、公开操作路径、声明的边界；不证明实际交付质量 |
| 演示确认 | 官方网站链接的公开 Loom 页面及转录 | 演示采用的流程；不是我们在账户中运行成功 |
| 推断 / 待核验 | 从多份材料推导，或公开页面不完整 | 明确标注，不能作为已支持能力验收 |

## 2. 对象名称与职责

| 对象 | 保存什么 | 如何变化 | 适合的任务 |
| --- | --- | --- | --- |
| Company / People Search，保存后为 Saved Search | 筛选条件 | 结果随数据和条件动态变化 | 持续发现符合研究范围的新对象 |
| Workspace → Lists；旧帮助/API 仍使用 Watchlists | 已选择的公司、人物或投资者集合 | 人工添加、导入，或由 Scout 等操作更新成员；成员资料仍可刷新 | 跟踪一个已选研究池、保留研究状态 |
| Scout / Scheduled Scout | 自然语言任务、上下文与调度 | 按任务执行研究、评分、写入名单或发送结果 | 同时需要发现、解释、持续监控的研究任务 |

搜索与名单的区别有官方明确定义。这里的“静态名单”指成员不是仅因搜索条件变化自动增减，**不表示公司资料被冻结，也不排除 Scout 向名单持续添加对象**。[入门](https://support.harmonic.ai/en/articles/8230516-harmonic-101)、[名单操作](https://support.harmonic.ai/en/articles/5882083-workspace-your-home-for-lists)

## 3. 路径 A：条件搜索 → 保存 → 新命中提醒

### 3.1 建立研究范围

官方推荐先建立基础搜索，再复制成更窄的研究切片。可复原的路径为：

1. Company Search 的 General 选地区。
2. Funding 选公司阶段、累计融资范围。
3. Product 选行业、技术、客户类型及排除条件。
4. 用 **See # Results** 预览，再点右上角 **Save** 命名；需要时共享给团队。

它把预览放在保存之前。帮助文档也承认一些筛选会漏掉有效公司，例如只选 Startup 类型、依赖某些创始人背景标签；因此筛选结果不等于完整市场。[Discover Companies and Peoples with Searches](https://support.harmonic.ai/en/articles/10310000-discover-companies-and-peoples-with-searches)

### 3.2 针对融资的细化

Company Search → **Funding** 可以选择投资者、包含或排除、投资者是否领投、最近一轮或指定日期范围、轮次类型和单轮金额。**Lead** 选项是在选定投资者后出现；多轮类型可用 OR 或 AND 表达。这里搜出的仍是公司，不应默认当作一条条独立融资事件列表。[Search by Deal Data](https://support.harmonic.ai/en/articles/11757960-search-by-deal-data)

可借鉴的具体任务是“某研究范围中，最近一段时间有指定投资方领投 A 轮的公司”。它与“这周首次被我们发现的融资公告”不是同一个查询。后者还需要自己的发现时间和去重记录。

### 3.3 订阅方式与频率

| 通道 | 官方路径与支持 | 已知限制 |
| --- | --- | --- |
| Email | Saved Search 的 Subscribe，或左下用户菜单 → Settings → Notifications；选择搜索和日/周频率 | 帮助文章标注 2024-01-02；没有给出小时级邮件、具体发送时区或空结果策略，不能由 Slack/Scout 文档代推 |
| Slack | 已保存搜索右上铃铛 → Slack 开关 → Add channel；也可从 Settings → Notifications 配置 | 支持小时/日/周；日/周文档写 9am PST。夏令时和每周具体哪一天未说明 |
| Slack 内容 | 可选择融资、投资者、人数、增长、官网等随通知显示的字段，可给同一搜索配多个频道 | 首次连接要求 Slack 管理员批准；选择显示字段并不等于这些字段的每次变化都会触发提醒 |

来源：[邮件通知](https://support.harmonic.ai/en/articles/7025950-how-can-i-enable-email-notifications)、[Slack Integration](https://support.harmonic.ai/en/articles/5878370-slack-integration)。Slack 官方 Marketplace 中的开发者说明还提到通知数量上限，但本轮未看到具体上限数值、设置界面或溢出处理规则。[Marketplace](https://slack.com/marketplace/A017N2XAZ88-harmonicai)

### 3.4 处理结果与去噪

官方区分三种操作：未查看用蓝点提示，可在 Display 中只看 Unviewed，也可批量标记已查看；Hide 影响以后的全局搜索；特定搜索的排除则通过自定义名单和 Exclude list 完成。**读过只是处理状态，不应等同于已经失去研究价值。** [Managing Your Search Results](https://support.harmonic.ai/en/articles/8013505-managing-your-search-results)

排除名单能表达“已研究”“另一个人跟进”“不适合这一主题”等局部状态，而不必全局隐藏公司。官方提醒新建名单可能需要一段时间才反映到搜索结果，不能假定更新即时可见。[Include or exclude companies](https://support.harmonic.ai/en/articles/6030208-how-can-i-include-or-exclude-specific-companies-from-a-search)

关于 **Net New**：结果管理文档链接到专门说明页；网页抓取失败后，本轮用未登录浏览器打开，该页显示无法加载、可能需要先登录。因此只确认官方存在“首次匹配搜索”的区分，**未确认其基线建立时点、再次命中是否通知、修改查询是否重置、是否跨团队去重，以及删除重建搜索的行为**。[待核验页面](https://support.harmonic.ai/en/articles/9944801-net-new-in-harmonic)

## 4. 路径 B：名单 → 持续研究，而非再做一遍全库搜索

Workspace → Lists → Create，选择 Company/Person/Investor 类型与 private/shared；可手工加入、CSV 导入，也可从搜索结果选中对象后 **Add to list**。官方另列出 Scout 自动添加路径。名单可以带内部研究字段，作为一批已选对象的工作空间。[Workspace: Your home for Lists](https://support.harmonic.ai/en/articles/5882083-workspace-your-home-for-lists)

需要注意，名单文档明确写了 **人物换工作可订阅每周更新**；公司部分则展示人数、融资历史和社交等增长资料。**本轮没有核验到一个通用的“公司名单中任意融资字段变化就发通知”开关**，不能把人物换工作通知推及所有公司字段。

对于已知公司的持续监控，更有依据的公开路径是把名单作为 Scheduled Scout 的研究范围，并说明关心的变化。[Schedule a Scout](https://support.harmonic.ai/en/articles/15861097-schedule-a-scout)

## 5. 路径 C：Scout → 核对任务 → 定时执行 → 研究结果

### 5.1 文档能够确认的交互

以模板或新聊天开始，说明对象、匹配条件、排除项和频率；Scout 先整理范围与计划，用户调整后点 **Run Now**。任务进入左侧 Scouts 列表，调度使用浏览器本地时区。后续在原聊天修改研究内容，在设置中改频率、时间或暂停。默认有新结果才发邮件，没有新结果则不发；可关闭通知但继续运行任务，例如在后台持续更新名单；也可配置 Slack。定时任务消耗与其他 Scout 研究相同的额度。[Schedule a Scout](https://support.harmonic.ai/en/articles/15861097-schedule-a-scout)

用户可用 `#` 引用保存的名单/搜索，用 `@` 指定公司或人物；让 Scout 把结果写入新建或已有名单，并将评分、备注、匹配判断作为列保存。它支持追问，也有文件导出能力。**名单上的评分可检查，不代表评分已经成为客观事实。** [Getting the most out of Scout](https://support.harmonic.ai/en/articles/13861443-getting-the-most-out-of-scout)

### 5.2 公开演示还原：发现与监控是两条工作流

官方 [Demo 页面](https://harmonic.ai/demo) 链接 **Harmonic Platform Demo: Building Scouts**。本轮通过公开 Loom 页面查看画面与转录，未登录 Harmonic、未执行其中任务。演示长度约 1 分 53 秒，页面作者 Tyler Shapiro，页面显示约三个月前发布。可复核片段：

| 时间 | 演示内容的简要转述 | 对流程的意义 |
| --- | --- | --- |
| 0:14–0:40 | 一个每天早上运行的任务寻找离开 AI 实验室创业的人，进行研究、评分并生成联系草稿 | 发现、解释和后续动作可以串联；演示中的草稿不证明已发消息 |
| 0:45–1:00 | 不论得分都写入名单；演示者筛选四分结果，看评分理由后人工决定是否继续 | 低于最高分的结果仍保留可复核入口，而非直接丢弃 |
| 1:09–1:29 | 相关公司进入另一份名单，由另一个任务跟踪人数、融资、流量、招聘和新闻 | 将“找到对象”与“判断何时值得再研究”拆开 |

来源：[演示与转录](https://www.loom.com/share/781a70664c3d48e9a1ba3b5814d51577)。本轮没有核验评分校准、邮件送达、所有事实的引用质量，亦不把演示摘要中的自动化措辞当成已验证的自动外联能力。

### 5.3 Scout 的留存与可见性

帮助称聊天自动进入研究历史，公司页上的研究保留在公司档案；Scout Reports 团队可见，个人问题默认私有。另一份指南说明聊天可主动 Share 给团队。报告、个人线程与共享线程不能混成同一权限对象。[Scout 介绍](https://support.harmonic.ai/en/articles/11047921-scout-your-ai-research-agent)、[使用指南](https://support.harmonic.ai/en/articles/13861443-getting-the-most-out-of-scout)

## 6. 触发条件必须拆开的四种“新”

| 情形 | Harmonic 公开证据 | 不能据此声称 |
| --- | --- | --- |
| 公司首次进入数据库 | Initialized Date / `initialized_date` | 公司刚成立、刚融资，或我们今天才看到它 |
| 公司首次符合某搜索 | Saved Search 新结果通知；专门 Net New 细则本轮无法访问 | 已在结果中的公司每次属性更新都会重复触发 |
| 已知公司发生值得关注的变化 | Scheduled Scout 与公开演示包含融资、人员等监控任务 | 任意字段都有精确、可配置的阈值事件和完整前后值差异 |
| 用户尚未查看 | Unviewed 蓝点与筛选 | 一定是新公司、新轮次或最新数据 |

时间字段还要进一步分开：`updated_at` 是资料更新时间；`founding_date` 是成立时间且有精度；`funding.last_funding_at` 是最近融资轮日期；逐轮 Deal Data 的 `announcement_date` 明确为公告日期。公开字典未证明这些均具备真实交割日期，更不能从统一的 Funding Date 文案推断资金到账时间。[搜索字段](https://support.harmonic.ai/en/articles/5867775-search-filters)、[数据字典](https://support.harmonic.ai/en/articles/6480774-harmonic-data-fields)

**研究推断：** 若某公司早已符合“美国 A 轮 SaaS”搜索，其新一轮融资发生后仍处在搜索结果中，单靠“新公司匹配”通知未必足够；应使用按事件设计的查询或公司监控任务。是否会重复通知，需要账户端构造样本验证，不能在本报告确定。

另一个容易误读的信号是 **Currently Raising**：官方定义为创始人自述，经审核后显示，并有随时间降级、移除的规则。它代表融资意向，不是已完成融资；“May Be Raising”还可能来自旧状态过期。[Founder Submissions & Fundraising Signals](https://support.harmonic.ai/en/articles/14424590-founder-submissions-fundraising-signals)

## 7. 从提醒到证据，再到研究或 CRM

可核对的能力链为：搜索结果/公司档案 → 查看数据与来源 → 加入名单并记录状态 → 必要时进入 CRM。**通知点击后的精确落点、是否直接突出变化字段，本轮未登录验证。**

- 融资数据字典提供轮次标识、`source_url` 和 `additional_sources`，说明逐轮数据有原始来源入口；还保留是否计入融资总额的标志。估值字段区分来源类型及解释。公开字段存在不代表每条数据都完整，也不证明 UI 中有不可变证据快照、字段级历史归因或冲突裁决界面。[Harmonic Data Fields](https://support.harmonic.ai/en/articles/6480774-harmonic-data-fields)
- 名单自定义字段支持备注、状态、优先级等工作信息，并区分全局字段与名单局部字段；可把研究处理状态附在对象上。[Custom Fields API](https://support.harmonic.ai/en/articles/10234987-custom-fields-api)
- Affinity 已有明确路径：在公司档案、侧栏、扩展或表格的 Add to list 中选择已同步的 Affinity 名单，填写已连接字段后确认。连接本身需要 Harmonic 管理员和有相应名单权限的 Affinity API key；同步字段在 Harmonic 表格中只读。推送报错时官方要求先确认 CRM 是否实际已写入，避免盲目重试。[Affinity Integration](https://support.harmonic.ai/en/articles/8563032-affinity-integration)

这说明值得借鉴的“闭环”是让结果进入可持续处理的研究池，并保留原文复核入口。Deltabase 当前已有来源、版本与核验失败记录，应继续保留，不因接入第三方结构化数据而退化成无来源数字。

## 8. 频率、数据新鲜度与集成边界

**提醒检查频率、资料更新频率、底层事实发生频率、交付文件频率分别计算。**

| 层级 | 官方声明 | 对研究结果的约束 |
| --- | --- | --- |
| 公司资料刷新 | startup、已有融资、公司名单内对象等优先组为两周 freshness；另一组为两个月，其他公司优先级更低 | 频繁运行搜索不保证读取到刚发生的事实 |
| 人数、网站流量 | 人数每周；流量每月 | 不能把每天发提醒写成每天新采集流量 |
| 公司 enrichment | 超过两周陈旧时触发刷新 | 是刷新规则，未承诺任意请求返回时所有字段立即最新 |
| Bulk | 定价页写每周刷新/交付 | 不与逐字段 freshness SLA 互换 |

来源：[Data Freshness](https://support.harmonic.ai/en/articles/8187208-data-freshness)、[Pricing](https://harmonic.ai/pricing)。文档与营销页使用不同口径时，本报告优先保留具体字段/对象的规则，不用“实时”概括全部数据。未取得融资公告发现延迟的单独 SLA，也未测量漏报率。

Webhooks 的当前边界尤其明确：只推送订阅名单的成员新增/删除，**属性变化仍在路线图中**。它要求名单共享，支持失败重试、失败记录和按事件 ID 去重。不能把它当现成的“新融资发生 webhook”，也不能把名单删除解释成公司关闭。[Getting started with Webhooks](https://support.harmonic.ai/en/articles/17707957-getting-started-with-webhooks)

Scout MCP 帮助还明确：MCP 线程与 Console 线程不互通，不能通过该接口修改调度或读取定时 Scout 输出。因此，Deltabase 不能直接把 Console 中的定时 Scout 当成可经 MCP 拉取输出或管理计划的后台数据源；若考虑名单读取或其他 API 通路，仍须另行核验权限、输出结构及增量语义。[Scout MCP](https://support.harmonic.ai/en/articles/16559257-scout-mcp)

## 9. 价格、许可与权限：能看见文档不等于已买到能力

| 项目 | 本轮确认 | 仍未知或需合同确认 |
| --- | --- | --- |
| Console / API / Bulk | 定价页分别列出产品，基础价格需询价；API 与 Bulk 的融资/投资者数据列为 Add-On | 没有可据以计算完整年费的公开报价，不引用非官方估价 |
| 用户席位 | 用户管理帮助：Enterprise、Standard 为付费 Console；Standard 不含导出；扩展席位研究功能随付费账户提供且不能进入 Console | 不能只看定价概览中的 CSV export 就认为所有席位都可导出 |
| Scout 消耗 | 帮助公布输入 $5/百万 tokens、输出 $25/百万 tokens，额度以美元式 Usage Credits 展示；定时任务也消耗额度 | 不是公司数据/API 订阅价格，也不是每次提醒的固定价 |
| Scout 包含额度 | 直接打开的当前消费帮助写每用户 $750/月；2026-10-20 更新的 AI Addendum 也对 Enterprise/Standard Console 列月度 $750，并允许另约 | 搜索摘要仍出现 $250/日、$500/周的旧口径，本报告以直接打开的当前正文为准；包含额度不等于无需付费 Console 许可 |
| MCP | OAuth 的包含配额帮助写每用户每日 100 请求、无 Deal Data；API key 使用团队 API 池 | Console 可用不等于完整融资 API、MCP 无限额度或定时结果导出均已获权 |
| 外部通知/CRM | Slack 首次需管理员批准；Affinity 需管理权限与有效 API key/调用容量 | 本轮未连接、授权或验证具体账户权限 |

来源：[Pricing](https://harmonic.ai/pricing)、[用户与席位](https://support.harmonic.ai/en/articles/5811668-manage-users-role-types)、[Scout Consumption Pricing](https://support.harmonic.ai/en/articles/15063167-scout-consumption-pricing)、[AI and LLM Processing Addendum](https://harmonic.ai/legal/ai-addendum)、[MCP 入门](https://support.harmonic.ai/en/articles/12785899-harmonic-mcp-server-getting-started-guide)。价格与权限均为本次查阅时的公开表述，实际采购仍需核对适用套餐与合同。

## 10. 建议借鉴的五项设计

以下是对 Deltabase 的设计建议，**未获本报告授权实施，也不表示现有产品已经支持**。

| 优先级 | 借鉴项 | Deltabase 可采用的具体形式 | 验收重点 |
| --- | --- | --- | --- |
| 1 | 研究范围与研究池分开 | 保存条件形成“主题”；将选定公司加入“观察名单” | 修改搜索不悄悄移除已关注公司，无 App 公司同样可选 |
| 2 | 发现与变化两种收件项 | “首次进入此主题”与“已关注公司出现新证据”分组 | 旧公告今天收录显示为新发现，不伪装成今天融资；单纯再次核验不产生新事件 |
| 3 | 通知前给出范围预览 | 展示条件、排除项、当前命中样本、频率/时区和消息预览 | 首次运行建立基线；规则变更说明对基线的影响；无变化安静 |
| 4 | 结果能进入人工处理队列 | 已查看、暂存、加入观察、仅对此主题排除；不直接按评分丢弃 | 处理状态与事实状态分开，待核验/有冲突来源仍可追溯 |
| 5 | 每条提醒可回到证据与下一步 | 显示为何命中、来源、公告日、发现日、前后变化和下一步笔记入口 | 阅读提醒后能核对来源并决定行动；自动发现不能绕过已有融资去重/版本流程 |

其中第 2、3、5 项的基线、前后值和失败策略是结合 Deltabase 架构提出的约束，**不是声称 Harmonic 已逐项实现这些细节**。

## 11. 不宜照搬的内容

1. **自动联系、CRM 分发与全网络授权。** 公开演示服务机构投研和外联；Deltabase 当前是个人本地研究工具。可借鉴“下一步动作”，无需复制团队销售流程或自动发送信息。
2. **不透明的综合评分。** 可以显示可核对的匹配原因，暂不把融资、名校、知名雇主、招聘混成“成功概率”；官方搜索指南本身也承认此类条件会制造噪声和漏报。
3. **把运行频率当时效承诺。** 两周资料、每周人数、每月流量不应包装成实时变化；本地进程未运行时也不能宣称持续监控。
4. **用“未披露”替换为零。** 官方寻找早期公司的示例出现融资上限 $0，但本轮未确认该筛选怎样处理未知值；Deltabase 应保持未知、未披露、本轮/累计的既有区分。
5. **现在就采购全量数据或加入定时 AI agent。** 当前需要先证明主题、证据收件箱和人工处理闭环能减少研究成本，再评估来源覆盖、许可、误报和运行成本。

## 12. 仍需账户端或供应商确认的问题

- Saved Search 的首次基线、重复入选、规则修改、订阅时间与通知游标如何作用？多人查看状态是否共享？
- 已命中公司的新融资怎样确保再次出现？是否有稳定轮次事件标识可用于提醒去重，如何处理回补、更正及历史轮次？
- 公司名单是否有独立于 Scout 的属性变更提醒？支持哪些字段、阈值、前后值与故障提示？
- 每个通知是否都给出可点击原始证据？来源失效、冲突和低置信度如何展示？
- Slack 通知上限、周发送日、PST/PDT，以及超量结果是否排队/截断，细则是什么？
- 目标账户的 Console、Deal Data、Scout、MCP 权限及费用分别是什么？融资数据有无单独覆盖范围和延迟 SLA？

这些问题不阻碍学习其交互结构，但在决定集成、采购或声称功能等价之前必须核验。后续方案由总控结合其他竞品和当前数据来源统一提出。
