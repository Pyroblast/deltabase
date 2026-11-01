# 融资 MVP 前后端契约

2026-11-01。共享类型：`shared/funding.ts`。实现中；本契约先行供前端对接。全部 API 前缀 `/api/funding`，只处理本地手动资料，不访问输入的 URL。

## 读取

- `GET /api/funding?q=&companyId=&recordKind=all|event|lead&archived=0|1|all&dateType=discovered|published&from=YYYY-MM-DD&to=YYYY-MM-DD&unknownDate=0|1&page=1` → `FundingList`（pageSize=30）。默认未归档、发现时间倒序。公告日期筛选按精度区间重叠，不把月份填成第一天；unknownDate=1 只看未知公告日期（仅 published 生效）。
- `GET /api/funding/companies?q=` → `FundingCompany[]`，全部来源公司可选；不创建占位岗位。
- `GET /api/funding/:id` → `FundingDetail`。当前 `event.data` 可直接作为编辑草稿（其 company 使用 `{id}`）；`event.company` 是当前公司资料，历史 revisions.snapshot.company 是当时的身份快照。
- `POST /api/funding/duplicates`，body `{data: FundingDraft, excludeId?: string}` → `{candidates: FundingDuplicate[]}`。只读提示，不写数据、不自动归并。创建/编辑时后端再次检查；编辑只要求处理相对原记录新增的候选，已存在的重复关系不会阻挡普通笔记编辑。

## 写入

所有写操作要求 body.idempotencyKey（8–160 字符，建议 crypto.randomUUID()）。一次保存尝试和它的网络重试用同一键；改 payload（含解决冲突后的修改）用新键。幂等键在整个融资模块全局唯一：同键同请求返回原结果并标 replayed=true，同键不同请求/路径返回409。失败事务不消耗键。成功重试优先于预期版本检查，即便事件已经被后续编辑，仍返回那次成功结果。

| 操作 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/funding` | `FundingCreateRequest` | 201 `FundingMutationResult`，初始 version=1 |
| `PUT /api/funding/:id` | `FundingUpdateRequest`，完整替换 data，reason 非空 | 200 `FundingMutationResult`；无实质变化 changed=false、版本不增 |
| `POST /api/funding/:id/evidence` | `FundingEvidenceRequest`，新增一条证据 | 200 `FundingMutationResult`；现有 key 请走完整编辑，不能借追加覆盖 |
| `POST /api/funding/:id/archive` | `FundingArchiveRequest`，archived=true/false，reason 非空 | 200 `FundingMutationResult`；duplicateOf 可选但须为同公司其他未归档事件；恢复需 archived=false 且 duplicateOf=null/省略 |
| `POST /api/funding/:id/observations` | `FundingObservationRequest` | 201 `{id, eventId, version, replayed}`；核验不修改事件内容版本；再次明确核验用新键 |

除创建外都要求 expectedVersion。归档记录不可编辑内容/追加证据，但可阅读、记录核验和恢复。归档重复保留原 ID、版本和目标去向；禁止删除或循环归档引用。

## 草稿结构与前端行为

以 `emptyFundingDraft()` 和 `emptyFundingEvidence(key)` 初始化完整对象；空字符串与 null 按共享类型提交，不以 0 表示未知。公司二选一：已有 `{id:"yc:24065"}`，或新建 `{name:"示例公司",website:"https://example.com"}`。新公司不按同名/同域自动合并；服务返回 `company:<uuid>`。选择已有公司及变更公司需填 companyReason（核对依据）；公司已有 notes/watch 不因融资编辑而覆盖。

至少一条 evidence。每条有事件内稳定 key、URL、标题、发布者、角色、自写摘要或短摘录、发布时间、来源更新时间、supports（支持的字段名数组）。文档规范化 URL 相同则共享 documentId，但 **标题、摘录、发布时间和 supports 都保存在当前事件自己的版本**，另一事件编辑不会污染历史。单事件相同规范化 URL 只允许一条证据；同文档可支持多个事件。

Date：`{raw:"2026年7月",value:"2026-07",precision:"month"}`。unknown 时 value=null，raw 可保留模糊原文；year/month/day 严格符合真实日历；instant 必须有时区。事件 occurred/published 的非空原文或值须有相应 supports；轮次、金额、状态、用途也需要来源依据。investors 的 evidenceKeys 必须指向 supports 含 investors 的证据。公司关联使用 companyReason 保留人工判断，不强制一篇融资公告证明 App 身份。

Amount：规范化 value/upper 是非负十进制字符串，currency 为3位大写代码或null。保留 raw 与 scope/kind。undisclosed 的 value/upper 必须为null；range 可仅有原文，若规范化则上下界必须同时提供且顺序有效；只有 range 可设 upper。不换汇、不汇总。规范化金额须有币种；scope=混合也不拆分推算。

recordKind=lead 可以没有轮次/金额/日期，允许保存证据不足的线索。verification=source_checked 只表示核对过来源，不代表独立确认到账。所有链接只支持 HTTP(S)，拒绝带用户名/密码；原文以纯文本展示。

历史 revisions 包含完整 data 和 company 身份快照，reason、version、createdAt；不在前端对历史字段用当前公司名回填。observations 自带核验当时 evidence 快照，失败也保留原有效证据。

## 冲突例子

HTTP 409，版本冲突：

```json
{"error":"记录已被更新，请重新读取后合并草稿","code":"VERSION_CONFLICT","currentVersion":3}
```

HTTP 409，同键不同请求：

```json
{"error":"此幂等键已用于不同请求，请使用新的键","code":"IDEMPOTENCY_CONFLICT"}
```

HTTP 409，可能同轮：

```json
{"error":"发现可能属于同轮的记录，请追加证据或说明另建理由","code":"DUPLICATE_CANDIDATES","candidates":[{"id":"funding:example","title":"示例 A 轮","companyName":"示例公司","roundRaw":"Series A","published":{"raw":"2026-07-07","value":"2026-07-07","precision":"day"},"reasons":["已确认同公司且轮次相同"]}]}
```

前端提供两条路径：跳转候选详情追加证据；或填写非空 separateReason 后使用新幂等键重新提交。reason/separateReason 保存在事件版本说明中。不能因有提示就静默自动合并。

校验失败 HTTP400 `{error,code:"VALIDATION_ERROR",issues?:[{path,message}]}`；不存在404 `{error,code:"NOT_FOUND"}`；已归档内容修改409 `{error,code:"ARCHIVED",currentVersion}`。关系冲突409 `{error,code:"RELATION_CONFLICT"}`（例如归档目标被其他记录引用，或变更公司会破坏已有轮次关系）。网络/保存失败保留草稿，不能提前显示成功。

公司笔记、关注与 App 关联复用既有 `/api/growth/companies/:id` PATCH 和 `/api/growth/companies/:id/apps` POST/DELETE；已有无 App 路径继续可用。新增融资页不依赖启动采集。后端将增长统计限定为有 growth_leads 的公司，通用公司选择器仍包含纯融资公司。

## 请求与成功响应示例

前端构造一条证据不足的线索（不需要编造轮次/金额）：

```ts
const data = emptyFundingDraft();
data.company = { name: "示例公司", website: "https://example.com" };
data.recordKind = "lead";
data.title = "待核验的公司投资背景";
data.evidence = [{
  ...emptyFundingEvidence(crypto.randomUUID()),
  url: "https://example.com/about",
  title: "公司介绍", publisher: "示例公司", role: "company",
  summary: "页面提及投资背景，但未披露本轮金额和日期。",
  supports: ["company"],
}];
// POST /api/funding，JSON body：
const request = { idempotencyKey: crypto.randomUUID(), data };
```

成功创建返回 `201 {"id":"funding:<uuid>","version":1,"changed":true,"replayed":false}`；同请求重试返回相同 id/version，replayed=true。详情响应形状：

```ts
{
  event: { id, version, companyId, company, data, firstSeenAt, updatedAt,
           archived: false, duplicateOf: null, archiveReason: "" },
  revisions: [{ id: 1, version: 1, reason: "手动录入", createdAt,
                snapshot: { data, company, archived: false, duplicateOf: null, archiveReason: "" } }],
  documents: [{ key: data.evidence[0].key, documentId, canonicalUrl, originalUrl }],
  observations: [], appLinks: []
}
```

`documents.originalUrl` 是共享文档首次录入的链接；当前事件自己填写的 URL 在 `event.data.evidence[].url`，不要用共享 originalUrl 覆盖它。

人工访问失败登记示例：`POST /api/funding/:id/observations`，body 为 `{idempotencyKey, expectedVersion: 1, evidenceKey, outcome: "unavailable", note: "原始页面暂时需要登录，未核验正文"}`。成功只新增 observation，不改变金额、核验状态选择或内容版本；界面同时呈现最近失败记录和旧证据。

恢复归档示例：`POST /api/funding/:id/archive`，body 为 `{idempotencyKey, expectedVersion: 2, archived: false, duplicateOf: null, reason: "复核后确认不是重复记录"}`。不改变首次发现时间；历史保留原归档去向。
