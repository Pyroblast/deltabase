# 融资平台同样本核对：6家公司 × 3平台

观察日期：2026-11-01，北京时间。负责人：产品研究与机会验证。状态：**案头核对完成，保留访问与事实核验限制**。仅写入本目录，不涉及服务、数据库或代码。

本次对照 IT桔子、Crunchbase、Dealroom，共18格。所有格子执行了公开搜索；找到的候选继续读取并核对官网、产品、主体或创始人。没有注册、付费、登录或绕过访问限制。逐格查询、URL、slug、可见融资行、官方核对和排除记录见[结构化样本](2026-11-01-funding-provider-samples.json)。它是研究材料，**不是自动导入包**。

## 可以据此得出的结论

| 平台 | 本次观察结果 | 不能据此得出的结论 |
| --- | --- | --- |
| IT桔子 | 0/6定位公司详情页；2/6在公开历史报告中确认目标；另4/6未找到 | 不能说其公司库没有这些公司，或中国覆盖差。主页读取返回HTTP 412，原因未确定，不能当作登录墙。 |
| Crunchbase | 6/6找到可确认身份的档案；公开轮次标签与部分投资方可读；6/6关键金额/日期遮挡 | 不能据公开字段评价付费完整度、更新时效或宣称已确认最新轮次。 |
| Dealroom | 6/6找到匹配档案并读取公开融资表；高级字段仍受限 | 不能把可见行数等同完整历史；公开表含身份重复候选、时间异常与轮次口径差异。 |

这是一轮小样本的**公开可观察性检查**，不是统计代表性覆盖率、平台排名或采购结论。首查只建立基线；比较区间为空，没有制造变化信号。

## 18格明细

“登录遮挡”指部分融资字段出现注册/升级提示，不指整页不可读；“公开报告”不指已经进入公司档案。以下链接是本次实际发现的公开地址；slug只作为URL标识，未验证为API稳定ID。日期星号原样保留，含义未确认；月精度不补成月首。

### 1. BoldVoice — boldvoice.com

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：未找到 | 公司URL/ID未知。未定位目标公司的平台档案，身份不能确认。 | 未找到目标公司的详情页或融资字段。 |
| Crunchbase：登录遮挡（部分公开） | [boldvoice](https://www.crunchbase.com/organization/boldvoice)。官网 boldvoice.com；法律名 Wellocution Inc.；Anada Lakra / Ilya Usorov 与公司公告一致。 | Series A / Seed；平台称4轮。Series A详情显示Matrix领投、8家投资方；金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [boldvoice](https://app.dealroom.co/companies/boldvoice)。官网 boldvoice.com，英语口语训练产品匹配。 | 4条可读行：2021-01 Seed $125k；2021-09 Seed $2.0m；2023-08* Early VC $2.5m；2026-01* Series A $21.0m。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com BoldVoice boldvoice.com`
- Crunchbase：`site:crunchbase.com/organization BoldVoice boldvoice.com`
- Dealroom：`site:app.dealroom.co/companies BoldVoice boldvoice.com`

核对结果：官方公告可确认2026-01的金额、轮次和Matrix领投。Crunchbase另列The Graduate Syndicate；公司本轮公告未列，暂留待核验，不能直接判平台错误。

### 2. Agave — useagave.com

目标为建筑软件公司，YC 25273；需排除招聘平台及Agave Games。

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：未找到 | 公司URL/ID未知。未定位目标公司的平台档案，身份不能确认。 | 未找到目标公司的详情页或融资字段。 |
| Crunchbase：登录遮挡（部分公开） | [agave-api](https://www.crunchbase.com/organization/agave-api)。官网 useagave.com；Agave Tech Inc.；别名 Agave API；John Zucchi 等创始人、建筑 ERP 产品匹配。不能因 slug 含 api 就排除。 | Series A / Seed / Pre-Seed；平台称3轮。Accel为Series A领投；金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [agave_3](https://app.dealroom.co/companies/agave_3)。官网 useagave.com，建筑 ERP，LinkedIn agave-api 匹配。 | 4条可读行：2022-01 Seed $500k；2022-07 Seed $125k；2023-08* Seed $2.9m；2026-07* Series A $15.0m。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com Agave useagave.com`
- Crunchbase：`site:crunchbase.com/organization Agave useagave.com`
- Dealroom：`site:app.dealroom.co/companies Agave useagave.com`

核对结果：Crunchbase的agave-api由官网与主体确认；Dealroom的agave_3匹配。另一个Dealroom agave页官网为agave.com，AI描述却像建筑软件，身份冲突，未采用。公开历史行不能相加替代官方累计融资。

### 3. Educato — educato.com

目标为YC 29605的考试准备产品。

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：未找到 | 公司URL/ID未知。未定位目标公司的平台档案，身份不能确认。 | 未找到目标公司的详情页或融资字段。 |
| Crunchbase：登录遮挡（部分公开） | [educato-ai](https://www.crunchbase.com/organization/educato-ai)。公司 press 页直接链接 educato-ai；档案 educato.ai 链接重定向 educato.com；两位创始人匹配。 | Seed / Pre-Seed；平台称2轮。Seed显示Filter Fund VC；FAQ另列YC，但不能指定为同轮。金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [educato_ai](https://app.dealroom.co/companies/educato_ai)。官网 educato.com，AI 考试准备产品匹配。 | 2024-08 Seed $125k，YC；金额、月份和轮次仍为未独立验证的平台记录。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com Educato educato.com`
- Crunchbase：`site:crunchbase.com/organization Educato educato.com`
- Dealroom：`site:app.dealroom.co/companies Educato educato.com`

核对结果：公司press页直接链接Crunchbase educato-ai。另一个Crunchbase educato-24b7使用bargraders.com，虽有Educato Inc.和相同联系域，暂不合并。Dealroom educato_ai_yc_s24_仅索引可读，似重复候选，不另算一笔融资。

### 4. Reframe — joinreframeapp.com

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：未找到 | 公司URL/ID未知。未定位目标公司的平台档案，身份不能确认。 | 未找到目标公司的详情页或融资字段。 |
| Crunchbase：登录遮挡（部分公开） | [reframe-app](https://www.crunchbase.com/organization/reframe-app)。官网 joinreframeapp.com、法律名 Glucobit Inc.、减酒产品匹配。 | Venture - Series Unknown / Series A / Seed；平台称5轮。HOF Capital对应Series A，角色未明；金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [reframe](https://app.dealroom.co/companies/reframe)。官网 reframeapp.com；Apple ID 1485756576、Glucobit 和减酒用途共同匹配。 | 2021-03 Seed $1.4m；2021-08 Seed $125k；2022-03* Series A $12.5m，另列估值$100m。A轮列Atlanta Ventures、Goodwater、HOF。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com Reframe joinreframeapp.com Glucobit`
- Crunchbase：`site:crunchbase.com/organization Reframe joinreframeapp.com Glucobit`
- Dealroom：`site:app.dealroom.co/companies Reframe joinreframeapp.com Glucobit`

核对结果：Dealroom的旧域名通过同一Apple ID和Glucobit主体校验。未把英国癌症服务和AI语音平台的同名融资并入。尚未找到公司/投资方原文确认$12.5m及日期。

### 5. Moonshot AI / 月之暗面 — moonshot.ai

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：公开历史报告；档案未定位 | 公司URL/ID未知。报告同时使用月之暗面、Moonshot AI、Kimi、杨植麟，匹配目标。 | [历史报告](https://cdn.itjuzi.com/pdf/eded90de9b25f6063d7a8a313c799360.pdf)正文p50：2024年$300m B轮；p52累计107亿元、估值33亿美元，均有换算提示。公司详情页未定位。 |
| Crunchbase：登录遮挡（部分公开） | [moonshot-ai-162d](https://www.crunchbase.com/organization/moonshot-ai-162d)。官网 moonshot.ai；北京、Kimi、杨植麟及月之暗面别名匹配。 | Venture - Series Unknown / Series F / Series D；平台称9轮。Guozhi Investment显示为Series F领投；金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [moonshot_ai_kimi](https://app.dealroom.co/companies/moonshot_ai_kimi)。官网 moonshot.cn、Kimi、海淀匹配；已打开官网核对。 | 8条公开行，2023-01*至2026-09*。记录含2024-02* Series B $1.0b、2024-05* Late VC $300m；2026-09*金额N/A、估值$30b。全表转录见JSON，均不当作已核验事件。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com Moonshot Kimi 月之暗面`
- Crunchbase：`site:crunchbase.com/organization Moonshot Kimi 月之暗面`
- Dealroom：`site:app.dealroom.co/companies Moonshot Kimi 月之暗面`

核对结果：Crunchbase dark-side-of-the-moon也使用同一官网、Kimi和创始人；保留为同品牌候选，未证明底层ID相同。Dealroom首条融资早于同页成立月份，需复核；IT桔子2024年$300m称B轮，Dealroom称Late VC，不能凭金额直接合并。报告p52的2024.02.19是成为独角兽日期，不是该B轮日期。

### 6. StepFun / 阶跃星辰 — stepfun.com

| 平台 / 状态 | 地址与身份依据 | 可读融资字段 |
| --- | --- | --- |
| IT桔子：公开历史报告；档案未定位 | 公司URL/ID未知。报告使用阶跃星辰、姜大昕、自研通用大模型，匹配目标。 | 同一[历史报告](https://cdn.itjuzi.com/pdf/eded90de9b25f6063d7a8a313c799360.pdf)p28–29：A轮，2023-11-01，红杉中国/启明；金额未给。表格截止2024-10-07。公司详情页未定位。 |
| Crunchbase：登录遮挡（部分公开） | [stepstar](https://www.crunchbase.com/organization/stepstar)。官网 stepfun.com、上海、多模态模型产品匹配；官方开放平台协议验证中文主体。 | Venture - Series Unknown / Series B；平台称3轮。Tencent对应未定轮次；金额和日期遮挡。 |
| Dealroom：公开可读（部分受限） | [stepfun_1](https://app.dealroom.co/companies/stepfun_1)。官网 stepfun.com、上海徐汇、姜大昕匹配；官方协议验证主体。 | 2024-12* Series B $100m；2026-01* Series B $717m；2026-05* Growth Equity VC $2.5b。三行完整投资方见JSON；后续轮次未被官方确认。 |

本组执行的可复跑查询：

- IT桔子：`site:itjuzi.com StepFun 阶跃星辰`
- Crunchbase：`site:crunchbase.com/organization StepFun 阶跃星辰`
- Dealroom：`site:app.dealroom.co/companies StepFun 阶跃星辰`

核对结果：采用Crunchbase stepstar；另一个stepfun档案为stepfun.ai、San Jose，缺少跨域身份依据，暂不合并。启明原文可校验2026-01跟投，但B+/B及原币/换算金额差异未解决。

## 官方证据控制与未解决字段

独立找到的官方原文与平台自身的原始来源回链分别保存。下列链接不能冒充平台已经给出的溯源链接。

| 样本 | 公司或投资方原文 | 本次能支持的内容 | 仍未解决 |
| --- | --- | --- | --- |
| BoldVoice | [公司供稿公告](https://www.prnewswire.com/news-releases/boldvoice-raises-21m-series-a-to-give-a-billion-non-native-english-speakers-their-own-ai-voice-coach-302671777.html)，2026-01-28 | $21m Series A；Matrix领投；与Dealroom月份/金额/轮次对应 | 精确发生日、是否最新一轮，以及平台额外投资方 |
| Agave | [公司公告](https://useagave.com/blog/announcing-agaves-15m-series-a)；[列表日期](https://useagave.com/blog)为2026-07-07 | $15m Series A，Accel领投、YC继续参与；累计over $20m是另一口径 | 发生日；公开历史表完整性。既有Accel原文链接本次重开失败，未用其新增结论 |
| Educato | [公司Press页](https://www.educato.com/press) | YC支持、两位创始人、官方直接链接Crunchbase档案 | 不能确认平台$125k、Seed日期或Filter Fund对应融资；不能套用YC通用投资条款 |
| Reframe | [公司FAQ](https://www.joinreframeapp.com/faq) | Glucobit与Apple ID的身份链 | 尚无原文确认$12.5m A轮；官方域名与HOF官网定向检索未补齐 |
| Moonshot | [英文官网](https://www.moonshot.ai/en)、[中文官网](https://www.moonshot.cn/)；[阿里FY2024年报](https://static.alibabagroup.com/reports/fy2024/ar/ebook/EN/87/index.html) | Kimi及中英文域名；阿里财年投入约$0.8b、约36%优先股权益 | 财年投资合计不是融资总额；不能校验平台单轮$1b、2026轮次或精确事件日 |
| StepFun | [官方平台协议](https://platform.stepfun.com/legal/user-agreement.html)；[启明2026-01-27公告](https://www.qimingvc.com/cn/news/%E3%80%90%E5%90%AF%E6%98%8E%E5%91%A8%E6%8A%A5%C2%B7%E6%8A%95%E8%B5%84%E4%BC%81%E4%B8%9A%E8%A6%81%E9%97%BB%E5%8D%81%E6%9D%A1%E3%80%91vol-03-2026127) | 中文主体；超50亿元人民币B+、启明进一步跟投 | Dealroom写Series B/$717m，币种换算依据与阶段映射未知；2026-05记录未核验 |

公开页并不证明“最新融资”：本次没有任何样本被标成已穷尽来源、已核验最新一轮。BoldVoice、Agave是可校验的具体轮次，不能因沿用既有验收样本就默认它们仍最新。

## 来源与质量边界

- **原始来源链**：Crunchbase部分融资详情URL可发现，但新闻标题/链接或金额日期仍遮挡；Dealroom融资表未见逐轮外部原文链接；IT桔子报告只标自身数据源。JSON中空来源数组表示本次未读到，不表示不存在。
- **日期语义**：保留平台原始月份/星号；报告截止日不是当前更新日；公司公告日不是交割日。IT桔子阶跃星辰表格印为2023-11-01，语义只到“融资时间”，不能确认发生日。
- **金额语义**：本轮、累计、估值分字段；不汇总融资、不换算汇率。N/A保持空；Crunchbase的obfuscation、1970、Lorem、$123和Dealroom的000k/0000占位不采纳。
- **身份与去重**：官网、主体、产品、创始人优先于名字与slug；同品牌多URL不自动当多个事件，也不自动合并底层ID。Crunchbase重复渲染同一融资行，不计为多轮。
- **证据等级**：平台表为第三方整理；AI简介不补字段。公司/投资方公告为当事方自述。融资不能证明成功、收入或PMF。
- **IT桔子报告核读限制**：读取了《2024年中国人工智能创业者人群画像报告》相关正文、表头、页码和脚注；PDF截图调用未得到可视图片，本地下载因DNS失败，未完成视觉复核。保留原页链接与页码，不将历史报告当当前完整融资档案。
- **搜索限制**：每格均执行所列查询；补充了名称别名、官网与中文关键词检索，并沿公开链接确认候选。搜索索引不全、工具缓存时间不一、HTTP 412/robots/cache miss均可能造成缺失。“未找到”只表示本次路径无结果。

## 给总控的下一步建议（尚未实施）

1. 现有手动MVP继续以公司/投资者原文为证据；平台公开表用于发现候选和提示矛盾，疑似同轮交给人确认。
2. 如要评价采购价值，向供应商索取这**同18格**的授权导出，至少包括稳定公司/事件ID、原币金额与口径、日期语义、轮次、领投/跟投、逐条原始来源、更新日和缺失原因。登录后可读性与合同/API许可需另验，当前结果不能替代。
3. 优先复核Moonshot时间异常和阶段映射、StepFun B/B+与币种、Educato多档案及未证实金额，再讨论自动化；不要先以平台总额或轮次数建立机会评分。

## 交付与验证

修改仅限本报告与同名JSON。结构化文件共6家公司、18个唯一公司/平台组合，含可复跑查询、12个匹配公司档案URL、2个报告样本、4个未找到格、8条官方控制记录及身份排除项。仅做文件解析、必填与交叉引用检查；未运行服务/E2E，也未改个人数据库。这些是真实公开网页观察，未做用户体验、外联或付费数据验收。
