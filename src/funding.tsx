import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Pencil,
  ExternalLink,
  FileCheck2,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, ApiError, Button, Empty, ErrorBox } from "./lib";
import "./funding.css";
import {
  fundingRecordKinds,
  fundingSourceRoles,
  fundingFieldNames,
  emptyFundingDraft,
  emptyFundingEvidence,
  type FundingDate,
  type FundingAmount,
  type FundingDraft,
  type FundingEvidenceInput,
  type FundingCompany,
  type FundingEvent,
  type FundingDetail as FundingDetailData,
  type FundingList,
  type FundingDuplicate,
  type FundingMutationResult,
  type FundingObservation,
  type FundingField,
} from "../shared/funding";

function Field({
  label,
  help,
  wide,
  children,
}: {
  label: string;
  help?: string;
  wide?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`funding-field${wide ? " wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {help && <small>{help}</small>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  help,
  wide,
  multiline,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  wide?: boolean;
  multiline?: boolean;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} help={help} wide={wide}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            placeholder={placeholder}
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            placeholder={placeholder}
          />
        )
      }
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
  wide,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Record<T, string>;
  help?: string;
  wide?: boolean;
}) {
  return (
    <Field label={label} help={help} wide={wide}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {Object.entries(options).map(([key, text]) => (
            <option key={key} value={key}>
              {String(text)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function readDraft<T>(key: string, initial: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null") ?? initial;
  } catch {
    return initial;
  }
}
const requestMemory = new Map<string, { signature: string; key: string }>();
function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readDraft(key, initial));
  const cleared = useRef(false);
  useEffect(() => {
    if (!cleared.current) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  }, [key, value]);
  const clear = () => {
    cleared.current = true;
    requestMemory.delete(key);
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(`${key}:request`);
    } catch {}
  };
  return [value, setValue, clear] as const;
}

// Preserve a request identity through retries and reloads; a changed payload gets a new identity.
function requestKey(draftKey: string, payload: unknown): string {
  const signature = JSON.stringify(payload);
  const prior =
    readDraft<{ signature: string; key: string } | null>(
      `${draftKey}:request`,
      null,
    ) ?? requestMemory.get(draftKey);
  if (prior?.signature === signature) return prior.key;
  const key = crypto.randomUUID();
  requestMemory.set(draftKey, { signature, key });
  try {
    sessionStorage.setItem(
      `${draftKey}:request`,
      JSON.stringify({ signature, key }),
    );
  } catch {}
  return key;
}

const fundingPath = (id: string) => `/funding/${encodeURIComponent(id)}`;
const fundingEndpoint = (id: string) => `/funding/${encodeURIComponent(id)}`;
const localTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "未知";

function Fact({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "wide" : undefined}>
      <dt>{label}</dt>
      <dd>{children || "未披露"}</dd>
    </div>
  );
}

function SaveFooter({
  pending,
  label = "保存记录",
  onCancel,
}: {
  pending: boolean;
  label?: string;
  onCancel: () => void;
}) {
  return (
    <div className="funding-form-footer">
      <span className="funding-caption">草稿暂存于当前浏览器会话</span>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={pending}
      >
        取消
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? "正在保存…" : label}
      </Button>
    </div>
  );
}

const precisionNames = {
  unknown: "未知 / 仅原文",
  year: "年份",
  month: "月份",
  day: "日期",
  instant: "带时区的时刻",
};
const scopeNames = {
  round: "本轮融资",
  cumulative: "累计融资",
  valuation: "估值",
  mixed: "混合未拆分",
};
const amountKindNames = {
  undisclosed: "未披露",
  exact: "精确金额",
  approximate: "约数",
  range: "范围",
  lower_bound: "下界 / 超过",
};
const financingNames = {
  equity: "股权",
  convertible: "可转债 / SAFE",
  debt: "债务",
  mixed: "混合",
  unspecified: "未说明",
};
const verificationNames = {
  unverified: "待核验",
  source_checked: "已核对原文",
  conflicting: "来源有冲突",
};
const investorRoles = {
  lead: "领投",
  participant: "参投",
  unspecified: "未说明",
};
const observationNames = {
  readable: "原文可读，已核对",
  unavailable: "访问失败 / 无法核对",
  conflicting: "原文有冲突，待判断",
  withdrawn: "来源已撤稿，待核验",
};
const dateText = (date: FundingDate) =>
  date.precision === "instant" && date.value
    ? `${localTime(date.value)}（北京时间）${date.raw ? ` · 原文：${date.raw}` : ""}`
    : date.raw && date.value && date.raw !== date.value
      ? `${date.raw}（${date.value}）`
      : date.raw || date.value || "未知";
function DateEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FundingDate;
  onChange: (date: FundingDate) => void;
}) {
  return (
    <div className="funding-fields">
      <SelectField
        label={`${label}精度`}
        value={value.precision}
        options={precisionNames}
        onChange={(precision) => onChange({ ...value, precision, value: null })}
      />
      {value.precision !== "unknown" && (
        <TextField
          label={label}
          value={value.value ?? ""}
          onChange={(v) => onChange({ ...value, value: v || null })}
          type={
            value.precision === "day"
              ? "date"
              : value.precision === "month"
                ? "month"
                : "text"
          }
          placeholder={
            value.precision === "instant" ? "2026-07-07T09:00:00+08:00" : "2026"
          }
          help={
            value.precision === "instant"
              ? "保留来源时区，例如 +08:00；不补造未知时区。"
              : undefined
          }
          required
        />
      )}
      <TextField
        label={`${label}原文`}
        value={value.raw}
        onChange={(raw) => onChange({ ...value, raw })}
        required={value.precision !== "unknown"}
        help={
          value.precision === "unknown"
            ? "未披露可留空；模糊表述可只保留原文。"
            : undefined
        }
      />
    </div>
  );
}

function EvidenceEditor({
  value,
  onChange,
  index = 0,
}: {
  value: FundingEvidenceInput;
  onChange: (value: FundingEvidenceInput) => void;
  index?: number;
}) {
  const set = <K extends keyof FundingEvidenceInput>(
    key: K,
    next: FundingEvidenceInput[K],
  ) => onChange({ ...value, [key]: next });
  return (
    <div className="funding-stack">
      <div className="funding-fields">
        <TextField
          label="原始公告链接"
          value={value.url}
          onChange={(v) => set("url", v)}
          type="url"
          wide
          required
          placeholder="https://…"
        />
        <TextField
          label="原文标题"
          value={value.title}
          onChange={(v) => set("title", v)}
          required
        />
        <TextField
          label="发布者"
          value={value.publisher}
          onChange={(v) => set("publisher", v)}
          required
          placeholder="公司、投资机构或媒体名称"
        />
        <SelectField
          label="证据性质"
          value={value.role}
          options={fundingSourceRoles}
          onChange={(v) => set("role", v)}
          help="公司新闻稿即使发布在分发平台，仍属于公司发布。"
        />
        <TextField
          label="摘要或短摘录"
          value={value.summary}
          onChange={(v) => set("summary", v)}
          multiline
          wide
          required
          help="记录自己的摘要或必要短摘录，不保存整篇文章。"
        />
      </div>
      <div>
        <h3>这份来源支持哪些字段</h3>
        <div className="funding-choice">
          {Object.entries(fundingFieldNames).map(([field, label]) => (
            <label key={field}>
              <input
                type="checkbox"
                aria-label={`支持${label}`}
                checked={value.supports.includes(field as FundingField)}
                onChange={(e) =>
                  set(
                    "supports",
                    e.target.checked
                      ? [...value.supports, field as FundingField]
                      : value.supports.filter((f) => f !== field),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        <p className="funding-caption">
          只勾选原文实际支持的字段。投资方文章未披露金额时，不应作为金额依据。
        </p>
      </div>
      <details>
        <summary>来源发布时间与更新时间</summary>
        <DateEditor
          label={`来源 ${index + 1} 发布时间`}
          value={value.published}
          onChange={(v) => set("published", v)}
        />
        <DateEditor
          label={`来源 ${index + 1} 更新时间`}
          value={value.sourceUpdated}
          onChange={(v) => set("sourceUpdated", v)}
        />
      </details>
    </div>
  );
}

function CompanyEditor({
  value,
  reason,
  onChange,
  onReason,
  currentCompany,
}: {
  value: FundingDraft["company"];
  reason: string;
  onChange: (value: FundingDraft["company"]) => void;
  onReason: (value: string) => void;
  currentCompany?: FundingCompany;
}) {
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["funding", "companies", q],
    queryFn: () =>
      api<FundingCompany[]>(`/funding/companies?q=${encodeURIComponent(q)}`),
  });
  const existing = "id" in value;
  const companies = [...(query.data ?? [])];
  if (currentCompany && !companies.some((c) => c.id === currentCompany.id))
    companies.push(currentCompany);
  return (
    <fieldset>
      <legend>归属公司</legend>
      <div className="funding-choice">
        <label>
          <input
            type="radio"
            name="funding-company-mode"
            checked={existing}
            onChange={() => onChange({ id: "" })}
          />
          选择已有公司
        </label>
        <label>
          <input
            type="radio"
            name="funding-company-mode"
            checked={!existing}
            onChange={() => onChange({ name: "", website: "" })}
          />
          新建独立公司
        </label>
      </div>
      <div className="funding-fields">
        {existing ? (
          <>
            <TextField
              label="搜索已有公司"
              value={q}
              onChange={(next) => {
                setQ(next);
                onChange({ id: "" });
              }}
              placeholder="输入公司名称或官网"
            />
            <Field label="已有公司">
              {(id) => (
                <select
                  id={id}
                  value={value.id}
                  onChange={(e) => onChange({ id: e.target.value })}
                  required
                >
                  <option value="">请选择公司</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.website ? ` · ${c.website}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </>
        ) : (
          <>
            <TextField
              label="公司名称"
              value={value.name}
              onChange={(name) => onChange({ ...value, name })}
              required
            />
            <TextField
              label="公司官网"
              value={value.website}
              onChange={(website) => onChange({ ...value, website })}
              type="url"
              placeholder="https://…（可选）"
            />
          </>
        )}
        <TextField
          label="公司身份核对依据"
          value={reason}
          onChange={onReason}
          wide
          multiline
          required={existing}
          help="说明公告主体与公司的关系。没有 App 也可以保存，不会自动关联同名产品。"
        />
      </div>
      <ErrorBox error={query.error} />
    </fieldset>
  );
}

export function FundingRadar() {
  const [params, setParams] = useSearchParams();
  const value = (name: string, fallback = "") => params.get(name) ?? fallback;
  const change = (name: string, next: string) =>
    setParams(
      (previous) => {
        const p = new URLSearchParams(previous);
        next ? p.set(name, next) : p.delete(name);
        p.delete("page");
        if (name === "dateType") p.delete("unknownDate");
        return p;
      },
      { replace: true },
    );
  const query = useQuery({
    queryKey: ["funding", "list", params.toString()],
    queryFn: () => api<FundingList>(`/funding?${params}`),
  });
  const back = `/funding${params.size ? `?${params}` : ""}`;
  return (
    <div className="funding-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SIGNAL 03 / FUNDING EVIDENCE</div>
          <h1>融资观察</h1>
          <p>从公告出发，核对一轮融资，保留尚未回答的问题。</p>
        </div>
        <Link className="btn btn-default" to="/funding/new">
          <Plus size={15} />
          录入公告
        </Link>
      </div>
      <p className="funding-caption funding-intro">
        手动收录与原文核验 · 融资不等于成功，收录日期不代表融资发生日期。
      </p>
      <div className="funding-toolbar">
        <label className="funding-filter funding-search">
          搜索公司或公告
          <input
            aria-label="搜索融资记录"
            value={value("q")}
            onChange={(e) => change("q", e.target.value)}
            placeholder="公司、轮次、公告标题…"
          />
        </label>
        <label className="funding-filter">
          记录类型
          <select
            aria-label="记录类型"
            value={value("recordKind", "all")}
            onChange={(e) => change("recordKind", e.target.value)}
          >
            <option value="all">全部记录</option>
            <option value="event">融资事件</option>
            <option value="lead">待核验线索</option>
          </select>
        </label>
        <label className="funding-filter">
          归档状态
          <select
            aria-label="归档状态"
            value={value("archived", "0")}
            onChange={(e) => change("archived", e.target.value)}
          >
            <option value="0">未归档</option>
            <option value="1">已归档</option>
            <option value="all">全部状态</option>
          </select>
        </label>
        <label className="funding-filter">
          筛选时间
          <select
            aria-label="筛选时间"
            value={value("dateType", "discovered")}
            onChange={(e) => change("dateType", e.target.value)}
          >
            <option value="discovered">本地收录日期</option>
            <option value="published">公告日期</option>
          </select>
        </label>
        <label className="funding-filter">
          开始日期
          <input
            type="date"
            value={value("from")}
            disabled={value("unknownDate") === "1"}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label className="funding-filter">
          结束日期
          <input
            type="date"
            value={value("to")}
            disabled={value("unknownDate") === "1"}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        {value("dateType") === "published" && (
          <label className="funding-choice">
            <input
              type="checkbox"
              checked={value("unknownDate") === "1"}
              onChange={(e) =>
                change("unknownDate", e.target.checked ? "1" : "")
              }
            />
            仅看公告日期未知
          </label>
        )}
      </div>
      <p className="funding-caption">
        共 {query.data?.total ?? "…"} 条记录 ·
        按本地收录时间排序；月份或年份按来源精度展示。
      </p>
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Empty title="正在读取融资记录…" />
      ) : !query.data?.items.length ? (
        <Empty
          title={params.size ? "没有符合条件的记录" : "从一份公开公告开始"}
        >
          可以保存完整融资公告，也可以先留下待核验的公司线索。
        </Empty>
      ) : (
        <div className="funding-list">
          {query.data.items.map((event) => (
            <Link
              className="funding-row"
              key={event.id}
              to={`${fundingPath(event.id)}?returnTo=${encodeURIComponent(back)}`}
            >
              <div>
                <div className="funding-company">{event.company.name}</div>
                <h2>{event.data.title}</h2>
                <FundingBadges event={event} />
              </div>
              <div className="funding-row-meta">
                <strong>{event.data.amount.raw || "金额未披露"}</strong>
                <span className="funding-caption">
                  {scopeNames[event.data.amount.scope]} ·{" "}
                  {event.data.roundRaw || "轮次未知"}
                </span>
              </div>
              <div className="funding-row-meta">
                <span>公告：{dateText(event.data.published)}</span>
                <span className="funding-caption">
                  收录：{localTime(event.firstSeenAt)}
                </span>
                <span className="funding-caption">
                  {event.data.evidence.length} 份来源 <ArrowUpRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {!!query.data?.total && (
        <div className="funding-pagination">
          <Button
            variant="outline"
            aria-label="融资上一页"
            disabled={query.data.page <= 1}
            onClick={() =>
              setParams((p) => {
                p.set("page", String(query.data!.page - 1));
                return p;
              })
            }
          >
            <ChevronLeft size={14} />
          </Button>
          <span>
            {query.data.page} /{" "}
            {Math.ceil(query.data.total / query.data.pageSize)}
          </span>
          <Button
            variant="outline"
            aria-label="融资下一页"
            disabled={query.data.page * query.data.pageSize >= query.data.total}
            onClick={() =>
              setParams((p) => {
                p.set("page", String(query.data!.page + 1));
                return p;
              })
            }
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function FundingBadges({ event }: { event: FundingEvent }) {
  return (
    <div className="funding-badges">
      <span className="funding-badge">
        {fundingRecordKinds[event.data.recordKind]}
      </span>
      <span
        className={`funding-badge ${event.data.verification === "conflicting" ? "warning" : event.data.verification === "source_checked" ? "success" : ""}`}
      >
        {verificationNames[event.data.verification]}
      </span>
      {event.archived && <span className="funding-badge">已归档</span>}
    </div>
  );
}

function AmountEditor({
  value,
  onChange,
}: {
  value: FundingAmount;
  onChange: (value: FundingAmount) => void;
}) {
  return (
    <div className="funding-stack">
      <div className="funding-fields">
        <TextField
          label="金额原文"
          value={value.raw}
          onChange={(raw) => onChange({ ...value, raw })}
          wide
          placeholder="例如 $15M；累计超过 $20M 应单独保留口径"
          help="未披露可留空；数千万、超过、约数等表述不转成精确数字。"
        />
        <SelectField
          label="金额口径"
          value={value.scope}
          options={scopeNames}
          onChange={(scope) => onChange({ ...value, scope })}
        />
        <SelectField
          label="金额表述"
          value={value.kind}
          options={amountKindNames}
          onChange={(kind) =>
            onChange({
              ...value,
              kind,
              value: kind === "undisclosed" ? null : value.value,
              upper: kind === "range" ? value.upper : null,
            })
          }
        />
      </div>
      <details>
        <summary>可选：币种与规范化金额</summary>
        <div className="funding-fields">
          <TextField
            label="币种"
            value={value.currency ?? ""}
            onChange={(currency) =>
              onChange({ ...value, currency: currency.toUpperCase() || null })
            }
            placeholder="USD / CNY（确认后填写）"
            help="不将所有 $ 自动视为美元。"
          />
          {value.kind !== "undisclosed" && (
            <TextField
              label={value.kind === "range" ? "金额下界" : "规范化金额"}
              value={value.value ?? ""}
              onChange={(v) => onChange({ ...value, value: v || null })}
              placeholder="15000000"
              help="以该币种为单位；不换汇。可只保留原文。"
            />
          )}
          {value.kind === "range" && (
            <TextField
              label="金额上界"
              value={value.upper ?? ""}
              onChange={(upper) => onChange({ ...value, upper: upper || null })}
            />
          )}
        </div>
      </details>
    </div>
  );
}

function InvestorsEditor({
  data,
  onChange,
}: {
  data: FundingDraft;
  onChange: (investors: FundingDraft["investors"]) => void;
}) {
  return (
    <div className="funding-stack">
      {data.investors.map((investor, index) => (
        <div className="funding-fields" key={index}>
          <TextField
            label={`投资方 ${index + 1} 名称`}
            value={investor.name}
            onChange={(name) =>
              onChange(
                data.investors.map((i, n) =>
                  n === index ? { ...i, name } : i,
                ),
              )
            }
            required
          />
          <SelectField
            label={`投资方 ${index + 1} 角色`}
            value={investor.role}
            options={investorRoles}
            onChange={(role) =>
              onChange(
                data.investors.map((i, n) =>
                  n === index ? { ...i, role } : i,
                ),
              )
            }
          />
          <div className="funding-field wide">
            <span>投资方依据</span>
            <div className="funding-choice">
              {data.evidence.map((source, n) => (
                <label key={source.key}>
                  <input
                    type="checkbox"
                    aria-label={`投资方 ${index + 1} 依据来源 ${n + 1}`}
                    checked={investor.evidenceKeys.includes(source.key)}
                    onChange={(e) =>
                      onChange(
                        data.investors.map((i, j) =>
                          j === index
                            ? {
                                ...i,
                                evidenceKeys: e.target.checked
                                  ? [...i.evidenceKeys, source.key]
                                  : i.evidenceKeys.filter(
                                      (k) => k !== source.key,
                                    ),
                              }
                            : i,
                        ),
                      )
                    }
                  />
                  来源 {n + 1}：{source.publisher || source.title || "待填写"}
                </label>
              ))}
            </div>
            <small>对应来源还需勾选「投资方」支持字段。</small>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange(data.investors.filter((_, n) => n !== index))
            }
          >
            移除投资方 {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...data.investors,
            { name: "", role: "unspecified", evidenceKeys: [] },
          ])
        }
      >
        <Plus size={14} />
        添加投资方
      </Button>
    </div>
  );
}

function missingSupport(data: FundingDraft): string[] {
  const supported = new Set(data.evidence.flatMap((e) => e.supports));
  const needed: FundingField[] = [];
  if (data.roundRaw || data.roundNormalized) needed.push("round");
  if (data.amount.raw || data.amount.value) needed.push("amount");
  if (data.occurred.raw || data.occurred.value) needed.push("occurred");
  if (data.published.raw || data.published.value) needed.push("published");
  if (data.statusRaw) needed.push("status");
  if (data.useOfFunds) needed.push("useOfFunds");
  const labels = needed
    .filter((f) => !supported.has(f))
    .map((f) => fundingFieldNames[f] as string);
  if (
    data.investors.some(
      (i) =>
        !i.evidenceKeys.length ||
        i.evidenceKeys.some(
          (k) =>
            !data.evidence.some(
              (e) => e.key === k && e.supports.includes("investors"),
            ),
        ),
    )
  )
    labels.push("投资方与对应来源");
  return labels;
}

type EditorDraft = {
  data: FundingDraft;
  expectedVersion: number;
  reason: string;
  separateReason: string;
};
function initialEditor(event?: FundingEvent): EditorDraft {
  const data = event ? event.data : emptyFundingDraft();
  if (!event) data.evidence = [emptyFundingEvidence(crypto.randomUUID())];
  return {
    data,
    expectedVersion: event?.version ?? 0,
    reason: "",
    separateReason: "",
  };
}

export function FundingNew() {
  const navigate = useNavigate();
  return (
    <div className="funding-page">
      <Link className="funding-back" to="/funding">
        <ArrowLeft size={14} />
        返回融资观察
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MANUAL / EVIDENCE FIRST</div>
          <h1>录入融资公告</h1>
          <p>只记录来源能支持的事实。信息不完整时，可以先存为待核验线索。</p>
        </div>
      </div>
      <FundingEditor
        onCancel={() => navigate("/funding")}
        onSaved={(id) => navigate(fundingPath(id))}
      />
    </div>
  );
}

function FundingEditor({
  event,
  onCancel,
  onSaved,
}: {
  event?: FundingEvent;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const draftKey = `deltabase:funding:editor:${event?.id ?? "new"}`;
  const [form, setForm, clear] = useDraft<EditorDraft>(
    draftKey,
    initialEditor(event),
  );
  const [latest, setLatest] = useState<FundingEvent | null>(null);
  const [conflictError, setConflictError] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const [candidates, setCandidates] = useState<FundingDuplicate[]>([]);
  const [appendKey, setAppendKey] = useState("");
  const data = form.data;
  const set = <K extends keyof FundingDraft>(key: K, value: FundingDraft[K]) =>
    setForm((f) => ({ ...f, data: { ...f.data, [key]: value } }));
  const related = useQuery({
    queryKey: [
      "funding",
      "related",
      "id" in data.company ? data.company.id : "",
    ],
    queryFn: () =>
      api<FundingList>(
        `/funding?companyId=${encodeURIComponent("id" in data.company ? data.company.id : "")}&archived=0`,
      ),
    enabled: "id" in data.company && !!data.company.id,
  });
  const save = useMutation({
    mutationFn: async () => {
      const missing = missingSupport(data);
      if (missing.length)
        throw new Error(`请在来源中补充这些字段的依据：${missing.join("、")}`);
      const body = event
        ? {
            data,
            expectedVersion: form.expectedVersion,
            reason: form.reason,
            separateReason: form.separateReason,
          }
        : { data, separateReason: form.separateReason };
      return api<FundingMutationResult>(
        event ? fundingEndpoint(event.id) : "/funding",
        event ? "PUT" : "POST",
        { ...body, idempotencyKey: requestKey(draftKey, body) },
      );
    },
    onSuccess: (result) => {
      clear();
      client.invalidateQueries({ queryKey: ["funding"] });
      onSaved(result.id);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.details.code === "DUPLICATE_CANDIDATES"
      )
        setCandidates(error.details.candidates ?? []);
    },
  });
  const loadLatest = async () => {
    if (!event) return;
    setReading(true);
    setConflictError(null);
    try {
      const response = await api<FundingDetailData>(fundingEndpoint(event.id));
      setLatest(response.event);
    } catch (error) {
      setConflictError(error);
    } finally {
      setReading(false);
    }
  };
  const missing = missingSupport(data);
  const versionConflict =
    save.error instanceof ApiError &&
    save.error.details.code === "VERSION_CONFLICT";
  return (
    <form
      className="funding-form funding-panel"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <fieldset disabled={save.isPending}>
        <div className="funding-stack">
          <CompanyEditor
            value={data.company}
            reason={data.companyReason}
            onChange={(v) => set("company", v)}
            onReason={(v) => set("companyReason", v)}
            currentCompany={event?.company}
          />
          <fieldset>
            <legend>公告记录</legend>
            <div className="funding-fields">
              <TextField
                label="记录标题"
                value={data.title}
                onChange={(v) => set("title", v)}
                required
                wide
                placeholder="例如：Agave 宣布 A 轮融资"
              />
              <SelectField
                label="记录性质"
                value={data.recordKind}
                options={fundingRecordKinds}
                onChange={(v) => set("recordKind", v)}
                help="只有背景资料或证据不足时，选择待核验线索。"
              />
              <SelectField
                label="核验状态"
                value={data.verification}
                options={verificationNames}
                onChange={(v) => set("verification", v)}
                help="已核对原文只表示核对来源陈述，不代表独立确认资金到账。"
              />
              <TextField
                label="轮次原文"
                value={data.roundRaw}
                onChange={(v) => set("roundRaw", v)}
                placeholder="Series A / A+ / extension（可空）"
              />
              <SelectField
                label="融资类型"
                value={data.financingType}
                options={financingNames}
                onChange={(v) => set("financingType", v)}
              />
            </div>
          </fieldset>
          <AmountEditor
            value={data.amount}
            onChange={(v) => set("amount", v)}
          />
          <fieldset>
            <legend>公告时间</legend>
            <DateEditor
              label="公告日期"
              value={data.published}
              onChange={(v) => set("published", v)}
            />
            <p className="funding-caption">
              选择有来源依据的公告日期。首次收录时间由系统单独记录，不能代替公告或交割日。
            </p>
          </fieldset>
          <fieldset>
            <legend>来源与字段依据</legend>
            {missing.length > 0 && (
              <p className="funding-notice">
                尚缺来源依据：{missing.join("、")}
                。请在下方来源中勾选它实际支持的字段。
              </p>
            )}
            {data.evidence.map((source, index) => (
              <div className="funding-evidence" key={source.key}>
                <div className="funding-panel-heading">
                  <h3>来源 {index + 1}</h3>
                  {data.evidence.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        set(
                          "evidence",
                          data.evidence.filter((e) => e.key !== source.key),
                        )
                      }
                    >
                      移除来源 {index + 1}
                    </Button>
                  )}
                </div>
                <EvidenceEditor
                  value={source}
                  index={index}
                  onChange={(v) =>
                    set(
                      "evidence",
                      data.evidence.map((e) => (e.key === source.key ? v : e)),
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                set("evidence", [
                  ...data.evidence,
                  emptyFundingEvidence(crypto.randomUUID()),
                ])
              }
            >
              <Plus size={14} />
              添加另一份来源
            </Button>
          </fieldset>
          <details>
            <summary>更多交易信息：发生时间、投资方与资金用途</summary>
            <div className="funding-stack">
              <DateEditor
                label="融资发生时间"
                value={data.occurred}
                onChange={(v) => set("occurred", v)}
              />
              <TextField
                label="交易状态原文"
                value={data.statusRaw}
                onChange={(v) => set("statusRaw", v)}
                help="募资意向、已签约、已完成分别保留；未知可空。"
              />
              <InvestorsEditor
                data={data}
                onChange={(v) => set("investors", v)}
              />
              <TextField
                label="资金用途"
                value={data.useOfFunds}
                onChange={(v) => set("useOfFunds", v)}
                multiline
                help="这是来源陈述的计划，不代表实际支出。"
              />
              <TextField
                label="标准化轮次（可选）"
                value={data.roundNormalized}
                onChange={(v) => set("roundNormalized", v)}
              />
            </div>
          </details>
          <details>
            <summary>追加轮或相关融资关系</summary>
            <div className="funding-fields">
              <Field label="关联已有融资记录">
                {(id) => (
                  <select
                    id={id}
                    value={data.relatedEventId ?? ""}
                    onChange={(e) =>
                      set("relatedEventId", e.target.value || null)
                    }
                  >
                    <option value="">暂不关联</option>
                    {related.data?.items
                      .filter((e) => e.id !== event?.id)
                      .map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.data.title}
                        </option>
                      ))}
                  </select>
                )}
              </Field>
              <TextField
                label="关系原文与判断依据"
                value={data.relationRaw}
                onChange={(v) => set("relationRaw", v)}
                help="例如同一轮追加、分期交割；保留原文，不自动合并。"
              />
            </div>
          </details>
          <TextField
            label="事件疑问与下一步"
            value={data.notes}
            onChange={(v) => set("notes", v)}
            multiline
            wide
            placeholder="还有什么需要核对？下一步准备怎么验证？"
          />
          {event && (
            <TextField
              label="本次修改理由"
              value={form.reason}
              onChange={(reason) => setForm((f) => ({ ...f, reason }))}
              multiline
              required
              help="历史版本会保留修改前后的事实与依据。"
            />
          )}
        </div>
      </fieldset>
      {!!candidates.length && (
        <div
          className="funding-notice"
          role="region"
          aria-label="可能重复的融资记录"
        >
          <p>
            这些记录可能已包含同一公告或同轮融资。先核对已有证据；确认属于另一轮时，说明区别后再保存。
          </p>
          {data.evidence.length > 1 && (
            <Field
              label="选择要追加的来源"
              help="一次追加一份来源；其余来源和原录入草稿会保留，可稍后继续处理。"
            >
              {(id) => (
                <select
                  id={id}
                  value={appendKey || data.evidence[0].key}
                  onChange={(e) => setAppendKey(e.target.value)}
                >
                  {data.evidence.map((e, i) => (
                    <option key={e.key} value={e.key}>
                      来源 {i + 1} · {e.title || e.publisher || e.url}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {candidates.map((candidate) => (
            <div className="funding-candidate" key={candidate.id}>
              <div>
                <strong>
                  {candidate.companyName} · {candidate.title}
                </strong>
                <div className="funding-caption">
                  {candidate.reasons.join("；")}
                </div>
              </div>
              <Link className="btn btn-outline" to={fundingPath(candidate.id)}>
                查看已有记录
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem(
                    `deltabase:funding:append:${candidate.id}`,
                    JSON.stringify({
                      evidence:
                        data.evidence.find(
                          (e) => e.key === (appendKey || data.evidence[0].key),
                        ) ?? data.evidence[0],
                      reason: "为已有融资补充公告依据",
                    }),
                  );
                  navigate(`${fundingPath(candidate.id)}?append=1`);
                }}
              >
                追加该公告
              </Button>
            </div>
          ))}
          <TextField
            label="确认为另一轮的理由"
            value={form.separateReason}
            onChange={(separateReason) =>
              setForm((f) => ({ ...f, separateReason }))
            }
            multiline
            help="仅在有依据区分两轮时另建。相同公告补充字段可直接编辑原记录。"
          />
        </div>
      )}
      {versionConflict && (
        <div className="funding-notice">
          <p>
            其他操作已更新了这条记录。你的草稿仍在，请读取最新内容并逐项核对后再保存。
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={reading}
            onClick={loadLatest}
          >
            {reading ? "正在读取…" : "读取最新版本"}
          </Button>
        </div>
      )}
      {latest && (
        <div className="funding-notice">
          <h3>最新保存内容 · 版本 {latest.version}</h3>
          <Snapshot data={latest.data} company={latest.company} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setForm((f) => ({ ...f, expectedVersion: latest.version }));
              setLatest(null);
              save.reset();
            }}
          >
            已核对，保留草稿并采用最新版本
          </Button>
          <p className="funding-caption">
            这不会自动合并字段。请在上方调整草稿，再点击保存。
          </p>
        </div>
      )}
      <ErrorBox error={save.error || conflictError} />
      <SaveFooter pending={save.isPending} onCancel={onCancel} />
    </form>
  );
}

function EvidenceText({ source }: { source: FundingEvidenceInput }) {
  return (
    <>
      <div className="funding-badges">
        <span className="funding-badge">{fundingSourceRoles[source.role]}</span>
        <span className="funding-caption">
          {source.publisher || "发布者未记录"}
        </span>
      </div>
      <h3>{source.title || "来源公告"}</h3>
      <a href={source.url} target="_blank" rel="noreferrer">
        打开原始来源 <ExternalLink size={13} />
      </a>
      <blockquote className="funding-excerpt">{source.summary}</blockquote>
      <p className="funding-caption">
        发布时间：{dateText(source.published)} · 来源更新时间：
        {dateText(source.sourceUpdated)}
      </p>
      <div className="funding-badges">
        <span className="funding-caption">支持字段</span>
        {source.supports.length ? (
          source.supports.map((field) => (
            <span className="funding-badge" key={field}>
              {fundingFieldNames[field]}
            </span>
          ))
        ) : (
          <span className="funding-caption">尚未指定</span>
        )}
      </div>
    </>
  );
}

function Snapshot({
  data,
  company,
}: {
  data: FundingDraft;
  company: FundingCompany;
}) {
  return (
    <div>
      <dl className="funding-facts">
        <Fact label="公司">
          {company.name}
          {company.website ? ` · ${company.website}` : ""}
        </Fact>
        <Fact label="记录标题">{data.title}</Fact>
        <Fact label="记录性质">
          {fundingRecordKinds[data.recordKind]} ·{" "}
          {verificationNames[data.verification]}
        </Fact>
        <Fact label="轮次">
          {data.roundRaw || "未知"}
          {data.roundNormalized ? `（${data.roundNormalized}）` : ""}
        </Fact>
        <Fact label="金额与口径">
          {data.amount.raw || "未披露"} · {scopeNames[data.amount.scope]} ·{" "}
          {amountKindNames[data.amount.kind]}
          {data.amount.currency ? ` · ${data.amount.currency}` : ""}
          {data.amount.value
            ? ` · ${data.amount.value}${data.amount.upper ? ` – ${data.amount.upper}` : ""}`
            : ""}
        </Fact>
        <Fact label="融资类型">{financingNames[data.financingType]}</Fact>
        <Fact label="公告时间">
          {dateText(data.published)} ·{" "}
          {precisionNames[data.published.precision]}
          {data.published.value && data.published.value !== data.published.raw
            ? ` · ${data.published.value}`
            : ""}
        </Fact>
        <Fact label="发生时间">
          {dateText(data.occurred)} · {precisionNames[data.occurred.precision]}
          {data.occurred.value && data.occurred.value !== data.occurred.raw
            ? ` · ${data.occurred.value}`
            : ""}
        </Fact>
        <Fact label="交易状态">{data.statusRaw}</Fact>
        <Fact label="资金用途">{data.useOfFunds}</Fact>
        <Fact label="投资方" wide>
          {data.investors.length
            ? data.investors.map((i, n) => (
                <div key={n}>
                  {i.name} · {investorRoles[i.role]}
                  <span className="funding-caption">
                    {" "}
                    · 依据：
                    {i.evidenceKeys
                      .map(
                        (key) =>
                          data.evidence.find((e) => e.key === key)?.title ||
                          "来源",
                      )
                      .join("；")}
                  </span>
                </div>
              ))
            : "未披露"}
        </Fact>
        <Fact label="公司身份依据" wide>
          {data.companyReason}
        </Fact>
        {(data.relationRaw || data.relatedEventId) && (
          <Fact label="相关轮次" wide>
            {data.relationRaw}
            {data.relatedEventId && (
              <Link to={fundingPath(data.relatedEventId)}> 查看相关记录 ↗</Link>
            )}
          </Fact>
        )}
        <Fact label="研究疑问与下一步" wide>
          {data.notes || "尚未记录"}
        </Fact>
      </dl>
      {data.evidence.map((source) => (
        <div className="funding-evidence" key={source.key}>
          <EvidenceText source={source} />
        </div>
      ))}
    </div>
  );
}

function VersionNotice({
  error,
  event,
  onVersion,
}: {
  error: unknown;
  event: FundingEvent;
  onVersion: (version: number) => void;
}) {
  const [latest, setLatest] = useState<FundingEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<unknown>(null);
  if (!(error instanceof ApiError) || error.details.code !== "VERSION_CONFLICT")
    return null;
  return (
    <div className="funding-notice">
      <p>这条记录已更新，你填写的内容仍保留。请核对最新内容后再继续。</p>
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            setLatest(
              (await api<FundingDetailData>(fundingEndpoint(event.id))).event,
            );
          } catch (e) {
            setReadError(e);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "正在读取…" : "读取最新版本"}
      </Button>
      {latest && (
        <>
          <Snapshot data={latest.data} company={latest.company} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onVersion(latest.version);
              setLatest(null);
            }}
          >
            已核对，按最新版本继续
          </Button>
        </>
      )}
      <ErrorBox error={readError} />
    </div>
  );
}

function AppendEvidence({
  event,
  onCancel,
  onSaved,
}: {
  event: FundingEvent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const key = `deltabase:funding:append:${event.id}`;
  const [form, setForm, clear] = useDraft<{
    evidence: FundingEvidenceInput;
    reason: string;
    expectedVersion?: number;
  }>(key, {
    evidence: emptyFundingEvidence(crypto.randomUUID()),
    reason: "",
    expectedVersion: event.version,
  });
  const [baseVersion, setBaseVersion] = useState(
    form.expectedVersion ?? event.version,
  );
  const save = useMutation({
    mutationFn: () => {
      const body = {
        evidence: form.evidence,
        reason: form.reason,
        expectedVersion: baseVersion,
      };
      return api<FundingMutationResult>(
        `${fundingEndpoint(event.id)}/evidence`,
        "POST",
        { ...body, idempotencyKey: requestKey(key, body) },
      );
    },
    onSuccess: () => {
      clear();
      onSaved();
    },
  });
  return (
    <form
      className="funding-form funding-panel"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2>为同一轮追加证据</h2>
      <p className="funding-caption">
        补充支持本轮融资的另一份来源。已有来源的更正请使用「编辑记录」。
      </p>
      <fieldset disabled={save.isPending}>
        <div className="funding-stack">
          <EvidenceEditor
            value={form.evidence}
            onChange={(evidence) => setForm((f) => ({ ...f, evidence }))}
          />
          <TextField
            label="追加理由"
            value={form.reason}
            onChange={(reason) => setForm((f) => ({ ...f, reason }))}
            required
            multiline
          />
        </div>
      </fieldset>
      <VersionNotice
        error={save.error}
        event={event}
        onVersion={(version) => {
          setBaseVersion(version);
          setForm((f) => ({ ...f, expectedVersion: version }));
          save.reset();
        }}
      />
      <ErrorBox error={save.error} />
      <SaveFooter
        label="保存证据"
        pending={save.isPending}
        onCancel={onCancel}
      />
    </form>
  );
}

function ObservationForm({
  event,
  source,
  onCancel,
  onSaved,
}: {
  event: FundingEvent;
  source: FundingEvidenceInput;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const key = `deltabase:funding:check:${event.id}:${source.key}`;
  const [form, setForm, clear] = useDraft<{
    outcome: FundingObservation["outcome"];
    note: string;
    expectedVersion: number;
  }>(key, { outcome: "readable", note: "", expectedVersion: event.version });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, evidenceKey: source.key };
      return api(`${fundingEndpoint(event.id)}/observations`, "POST", {
        ...body,
        idempotencyKey: requestKey(key, body),
      });
    },
    onSuccess: () => {
      clear();
      onSaved();
    },
  });
  return (
    <form
      className="funding-form funding-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h3>记录本次原文核验</h3>
      <p className="funding-caption">
        请先打开来源自行核对。访问失败会保留原有证据，也不会被解释为融资撤回。
      </p>
      <fieldset disabled={save.isPending}>
        <div className="funding-fields">
          <SelectField
            label="核验结果"
            value={form.outcome}
            options={observationNames}
            onChange={(outcome) => setForm((f) => ({ ...f, outcome }))}
          />
          <TextField
            label="核验说明"
            value={form.note}
            onChange={(note) => setForm((f) => ({ ...f, note }))}
            multiline
            wide
            required
            placeholder="例如：页面返回 404，暂时无法核对原文。"
          />
        </div>
      </fieldset>
      <VersionNotice
        error={save.error}
        event={event}
        onVersion={(version) => {
          setForm((f) => ({ ...f, expectedVersion: version }));
          save.reset();
        }}
      />
      <ErrorBox error={save.error} />
      <SaveFooter
        pending={save.isPending}
        label="保存核验记录"
        onCancel={onCancel}
      />
    </form>
  );
}

function ArchiveForm({
  event,
  onCancel,
  onSaved,
}: {
  event: FundingEvent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const key = `deltabase:funding:archive:${event.id}`;
  const [form, setForm, clear] = useDraft(key, {
    reason: "",
    duplicateOf: "",
    expectedVersion: event.version,
  });
  const query = useQuery({
    queryKey: ["funding", "archive-targets", event.companyId],
    queryFn: () =>
      api<FundingList>(
        `/funding?companyId=${encodeURIComponent(event.companyId)}&archived=0`,
      ),
    enabled: !event.archived,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        reason: form.reason,
        duplicateOf: event.archived ? null : form.duplicateOf || null,
        expectedVersion: form.expectedVersion,
        archived: !event.archived,
      };
      return api(`${fundingEndpoint(event.id)}/archive`, "POST", {
        ...body,
        idempotencyKey: requestKey(key, body),
      });
    },
    onSuccess: () => {
      clear();
      onSaved();
    },
  });
  return (
    <form
      className="funding-form funding-panel"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2>{event.archived ? "恢复记录" : "归档记录"}</h2>
      <p className="funding-caption">
        归档会保留证据、版本和原链接。重复记录可指向同公司的主记录，之后仍可恢复。
      </p>
      <fieldset disabled={save.isPending}>
        <div className="funding-fields">
          {!event.archived && (
            <Field label="重复记录归向（可选）" wide>
              {(id) => (
                <select
                  id={id}
                  value={form.duplicateOf}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duplicateOf: e.target.value }))
                  }
                >
                  <option value="">不指定重复记录</option>
                  {query.data?.items
                    .filter((item) => item.id !== event.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.data.title}
                      </option>
                    ))}
                </select>
              )}
            </Field>
          )}
          <TextField
            label={event.archived ? "恢复理由" : "归档理由"}
            value={form.reason}
            onChange={(reason) => setForm((f) => ({ ...f, reason }))}
            required
            wide
            multiline
          />
        </div>
      </fieldset>
      <VersionNotice
        error={save.error}
        event={event}
        onVersion={(version) => {
          setForm((f) => ({ ...f, expectedVersion: version }));
          save.reset();
        }}
      />
      <ErrorBox error={save.error || query.error} />
      <SaveFooter
        label={event.archived ? "确认恢复" : "确认归档"}
        pending={save.isPending}
        onCancel={onCancel}
      />
    </form>
  );
}

function CompanyNotes({ company }: { company: FundingCompany }) {
  const client = useQueryClient();
  const key = `deltabase:funding:company-notes:${company.id}`;
  const [note, setNote] = useState(() => readDraft<string>(key, company.notes));
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api(`/growth/companies/${encodeURIComponent(company.id)}`, "PATCH", {
        notes: note,
      }),
    onSuccess: () => {
      sessionStorage.removeItem(key);
      setSaved(true);
      client.invalidateQueries({ queryKey: ["funding"] });
      client.invalidateQueries({ queryKey: ["growth"] });
    },
  });
  return (
    <form
      className="funding-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <fieldset disabled={save.isPending}>
        <TextField
          label="公司共享研究笔记"
          value={note}
          onChange={(v) => {
            setNote(v);
            setSaved(false);
            try {
              sessionStorage.setItem(key, JSON.stringify(v));
            } catch {}
          }}
          multiline
          help="与增长研究页共享。事件专属问题请写在融资记录中。"
        />
      </fieldset>
      <ErrorBox error={save.error} />
      <div className="funding-actions">
        <Button variant="outline" disabled={save.isPending}>
          {save.isPending ? "正在保存…" : "保存公司笔记"}
        </Button>
        {saved && (
          <span className="funding-success" role="status">
            公司笔记已保存
          </span>
        )}
      </div>
    </form>
  );
}

export function FundingDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<"edit" | "archive" | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["funding", "detail", id],
    queryFn: () => api<FundingDetailData>(fundingEndpoint(id)),
  });
  useEffect(() => {
    setMode(null);
    setCheck(null);
    setSaved("");
  }, [id]);
  useEffect(() => {
    if (mode || check || params.get("append") === "1") setSaved("");
  }, [mode, check, params]);
  const refresh = (message: string) => {
    client.invalidateQueries({ queryKey: ["funding"] });
    setMode(null);
    setCheck(null);
    setParams(
      (p) => {
        p.delete("append");
        return p;
      },
      { replace: true },
    );
    setSaved(message);
  };
  const closeAppend = () =>
    setParams(
      (p) => {
        p.delete("append");
        return p;
      },
      { replace: true },
    );
  const returnTo = params.get("returnTo");
  const back =
    returnTo && (returnTo === "/funding" || returnTo.startsWith("/funding?"))
      ? returnTo
      : "/funding";
  const event = query.data?.event;
  if (!event)
    return (
      <div className="funding-page">
        <Link className="funding-back" to={back}>
          <ArrowLeft size={14} />
          返回融资观察
        </Link>
        <ErrorBox error={query.error} />
        <Empty
          title={query.isPending ? "正在读取公告与证据…" : "未找到这条记录"}
        />
      </div>
    );
  const data = event.data;
  return (
    <div className="funding-page">
      <Link className="funding-back" to={back}>
        <ArrowLeft size={14} />
        返回融资观察
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{event.company.name}</div>
          <h1>{data.title}</h1>
          <FundingBadges event={event} />
        </div>
        <div className="funding-actions">
          {!event.archived && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  closeAppend();
                  setMode(mode === "edit" ? null : "edit");
                }}
              >
                <Pencil size={14} />
                编辑记录
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMode(null);
                  setParams(
                    (p) => {
                      p.set("append", "1");
                      return p;
                    },
                    { replace: true },
                  );
                }}
              >
                <Plus size={14} />
                追加证据
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              closeAppend();
              setMode(mode === "archive" ? null : "archive");
            }}
          >
            <Archive size={14} />
            {event.archived ? "恢复记录" : "归档记录"}
          </Button>
        </div>
      </div>
      {saved && (
        <p className="funding-success" role="status">
          {saved}
        </p>
      )}
      <ErrorBox error={query.error} />
      {event.archived && (
        <div className="funding-notice">
          <p>此记录已归档：{event.archiveReason}</p>
          {event.duplicateOf && (
            <Link to={fundingPath(event.duplicateOf)}>查看保留的主记录 ↗</Link>
          )}
        </div>
      )}
      {mode === "edit" ? (
        <FundingEditor
          key={`edit:${id}`}
          event={event}
          onCancel={() => setMode(null)}
          onSaved={() => refresh("记录已保存")}
        />
      ) : mode === "archive" ? (
        <ArchiveForm
          key={`archive:${id}:${event.archived}`}
          event={event}
          onCancel={() => setMode(null)}
          onSaved={() => refresh(event.archived ? "记录已恢复" : "记录已归档")}
        />
      ) : params.get("append") === "1" && !event.archived ? (
        <AppendEvidence
          key={`append:${id}`}
          event={event}
          onCancel={closeAppend}
          onSaved={() => refresh("证据已追加")}
        />
      ) : (
        <div className="funding-detail-grid">
          <div className="funding-stack">
            <section className="funding-panel" aria-label="融资事实">
              <h2>公告中的融资信息</h2>
              <dl className="funding-facts">
                <Fact label="金额原文">{data.amount.raw || "未披露"}</Fact>
                <Fact label="金额口径">
                  {scopeNames[data.amount.scope]} ·{" "}
                  {amountKindNames[data.amount.kind]}
                </Fact>
                {(data.amount.currency || data.amount.value) && (
                  <Fact label="人工规范化金额" wide>
                    {data.amount.currency || "币种未明确"}{" "}
                    {data.amount.value || "未填写数值"}
                    {data.amount.upper ? ` – ${data.amount.upper}` : ""}
                  </Fact>
                )}
                <Fact label="轮次原文">{data.roundRaw || "未知"}</Fact>
                <Fact label="融资类型">
                  {financingNames[data.financingType]}
                </Fact>
                <Fact label="交易状态原文">{data.statusRaw || "未说明"}</Fact>
                <Fact label="核验状态">
                  {verificationNames[data.verification]}
                </Fact>
                <Fact label="投资方" wide>
                  {data.investors.length
                    ? data.investors.map((investor, n) => (
                        <div key={n}>
                          {investor.name} · {investorRoles[investor.role]}
                          <div className="funding-caption">
                            依据：
                            {investor.evidenceKeys
                              .map(
                                (key) =>
                                  data.evidence.find((e) => e.key === key)
                                    ?.title || "来源",
                              )
                              .join("；")}
                          </div>
                        </div>
                      ))
                    : "未披露"}
                </Fact>
                <Fact label="资金用途（来源陈述的计划）" wide>
                  {data.useOfFunds}
                </Fact>
                {(data.relatedEventId || data.relationRaw) && (
                  <Fact label="相关轮次" wide>
                    {data.relationRaw}
                    {data.relatedEventId && (
                      <Link to={fundingPath(data.relatedEventId)}>
                        {" "}
                        查看相关记录 ↗
                      </Link>
                    )}
                  </Fact>
                )}
                <Fact label="事件疑问与下一步" wide>
                  {data.notes || "尚未记录，可通过编辑补充。"}
                </Fact>
              </dl>
              <p className="funding-caption">
                融资公告属于来源陈述；核对原文不等于独立确认资金到账。
              </p>
            </section>
            <section className="funding-panel" aria-label="融资来源证据">
              <div className="funding-panel-heading">
                <h2>来源与证据</h2>
                <span className="funding-caption">
                  {data.evidence.length} 份来源
                </span>
              </div>
              {data.evidence.map((source, index) => (
                <article className="funding-evidence" key={source.key}>
                  <EvidenceText source={source} />
                  <div className="funding-actions" style={{ marginTop: 16 }}>
                    <Button
                      variant="outline"
                      aria-label={`核验来源 ${index + 1}`}
                      onClick={() =>
                        setCheck(check === source.key ? null : source.key)
                      }
                    >
                      <FileCheck2 size={14} />
                      记录原文核验
                    </Button>
                  </div>
                  {check === source.key && (
                    <ObservationForm
                      key={`${id}:${source.key}`}
                      event={event}
                      source={source}
                      onCancel={() => setCheck(null)}
                      onSaved={() => refresh("核验记录已保存，原证据保留")}
                    />
                  )}
                  {query
                    .data!.observations.filter(
                      (o) => o.evidenceKey === source.key,
                    )
                    .map((o) => (
                      <details className="funding-history" key={o.id}>
                        <summary>
                          {observationNames[o.outcome]} ·{" "}
                          {localTime(o.observedAt)}
                        </summary>
                        <p>{o.note}</p>
                        <p className="funding-caption">
                          当时的来源内容 · 版本 {o.version}
                        </p>
                        <EvidenceText source={o.evidence} />
                      </details>
                    ))}
                </article>
              ))}
              {query
                .data!.observations.filter(
                  (o) => !data.evidence.some((e) => e.key === o.evidenceKey),
                )
                .map((o) => (
                  <details className="funding-history" key={o.id}>
                    <summary>
                      已解除关联来源的核验 · {observationNames[o.outcome]} ·{" "}
                      {localTime(o.observedAt)}
                    </summary>
                    <p>{o.note}</p>
                    <p className="funding-caption">
                      核验时版本 {o.version} · 历史证据仍保留
                    </p>
                    <EvidenceText source={o.evidence} />
                  </details>
                ))}
            </section>
            <section className="funding-panel" aria-label="融资编辑历史">
              <h2>编辑历史</h2>
              <p className="funding-caption">
                当前版本 {event.version} · 核验记录与内容版本分别保留。
              </p>
              {query.data!.revisions.map((revision) => (
                <details className="funding-history" key={revision.id}>
                  <summary>
                    版本 {revision.version} · {localTime(revision.createdAt)} ·{" "}
                    {revision.reason}
                  </summary>
                  {revision.snapshot.archived && (
                    <p>已归档：{revision.snapshot.archiveReason}</p>
                  )}
                  <Snapshot
                    data={revision.snapshot.data}
                    company={revision.snapshot.company}
                  />
                </details>
              ))}
            </section>
          </div>
          <aside className="funding-stack">
            <section className="funding-panel" aria-label="融资时间">
              <h2>三个独立时间</h2>
              <dl className="funding-time-list">
                <Fact label="融资发生 / 交割时间">
                  {dateText(data.occurred)}
                </Fact>
                <Fact label="公告时间">{dateText(data.published)}</Fact>
                <Fact label="本地首次收录">{localTime(event.firstSeenAt)}</Fact>
                <Fact label="最近编辑">{localTime(event.updatedAt)}</Fact>
              </dl>
              <p className="funding-caption">
                发生日未知时保持未知。带时区的时刻按北京时间显示；来源年月日按原精度保留。
              </p>
            </section>
            <section className="funding-panel">
              <h2>{event.company.name}</h2>
              {event.company.website && (
                <p>
                  <a
                    href={event.company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="funding-caption"
                  >
                    公司官网 ↗
                  </a>
                </p>
              )}
              <p className="funding-caption">
                身份依据：
                {data.companyReason || "新建独立公司，尚未补充身份核对说明。"}
              </p>
              <p>
                <Link
                  className="funding-caption"
                  to={`/growth/${encodeURIComponent(event.companyId)}`}
                >
                  公司研究与增长线索 ↗
                </Link>
              </p>
              {query.data!.appLinks.length ? (
                query.data!.appLinks.map((app) => (
                  <p key={`${app.id}:${app.market}`}>
                    <Link
                      className="funding-caption"
                      to={`/apps/${encodeURIComponent(app.id)}?market=${encodeURIComponent(app.market)}`}
                    >
                      已确认 App：{app.name} ↗
                    </Link>
                  </p>
                ))
              ) : (
                <p className="funding-caption">尚未关联 App · 不影响独立研究</p>
              )}
              <CompanyNotes key={event.companyId} company={event.company} />
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
