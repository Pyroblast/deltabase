import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  EyeOff,
  X,
  Pencil,
  Link2,
} from "lucide-react";
import { api, Button, Empty, ErrorBox, time, cn } from "./lib";
import {
  channelNames,
  eventNames,
  growthSources,
  type GrowthRow,
} from "../shared/growth";
import "./growth.css";
function useChange<T>(fn: (arg: T) => Promise<any>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries({ queryKey: ["growth"] }),
  });
}
const companyPath = (id: string) => `/growth/${encodeURIComponent(id)}`;
const endpoint = (id: string) => `/growth/companies/${encodeURIComponent(id)}`;
function Tags({ lead }: { lead: GrowthRow }) {
  return (
    <div className="growth-tags">
      {lead.evidence.length ? (
        lead.evidence.map((e) => <span key={e.channel}>{e.channel}</span>)
      ) : (
        <span>渠道待研究</span>
      )}
    </div>
  );
}
function SourceStatus() {
  const query = useQuery({
    queryKey: ["growth", "status"],
    queryFn: () => api("/growth/status"),
    refetchInterval: 2500,
  });
  const refresh = useChange(() => api("/growth/sync", "POST", {}));
  const run = query.data?.runs[0];
  const running = run?.status === "running";
  const labels: Record<string, string> = {
    completed: "采集完成",
    partial: "部分失败",
    failed: "采集失败",
    interrupted: "采集中断",
  };
  return (
    <section className="growth-sources" aria-label="增长信源状态">
      <div className="growth-source-main">
        <div>
          <span className="eyebrow">AUTOMATIC · PUBLIC SAMPLE</span>
          <h3>
            YC Jobs <span>Marketing</span>
          </h3>
          <p>
            {running
              ? `正在读取岗位 ${run.done} / ${run.total || "…"}`
              : `${labels[run?.status] ?? "尚未建立基线"} · 最近完整更新 ${time(query.data?.source.last_success)}`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refresh.mutate(undefined)}
          disabled={running || refresh.isPending}
        >
          <RefreshCw size={14} className={running ? "spin" : ""} />
          {running ? "采集中" : "更新 YC Jobs"}
        </Button>
      </div>
      {running && <progress value={run.done} max={run.total || 1} />}
      <div className="growth-manual-sources">
        <span>
          SideShift <b>手动线索</b>
        </span>
        <span>
          Wellfound <b>手动线索</b>
        </span>
        <span>仅覆盖公开样本 · 首次发现 ≠ 发布时间</span>
      </div>
      <ErrorBox
        error={refresh.error || query.error || query.data?.source.error}
      />
      {!!query.data?.failures.length && (
        <details>
          <summary>查看 {query.data.failures.length} 条失败详情</summary>
          {query.data.failures.map((f: any) => (
            <p key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer">
                原始页面 ↗
              </a>{" "}
              · {f.error}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
export function GrowthRadar() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [channel, setChannel] = useState("");
  const [view, setView] = useState("all");
  const [form, setForm] = useState(false);
  const navigate = useNavigate();
  const params = new URLSearchParams({ q, source, channel, view });
  const query = useQuery({
    queryKey: ["growth", "list", q, source, channel, view],
    queryFn: () => api(`/growth?${params}`),
    refetchInterval: 5000,
  });
  const patch = useChange(({ id, body }: { id: string; body: any }) =>
    api(endpoint(id), "PATCH", body),
  );
  const leads: GrowthRow[] = query.data?.leads ?? [];
  return (
    <div className="growth-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SIGNAL 02 / GROWTH INTENT</div>
          <h1>增长投入雷达.</h1>
          <p>观察谁在招募增长人才、尝试获客渠道，留下值得验证的问题。</p>
        </div>
        <div className="heading-actions">
          <Button onClick={() => setForm(!form)}>
            <Plus size={15} />
            录入线索
          </Button>
        </div>
      </div>
      <SourceStatus />
      {form && (
        <ManualForm
          onCancel={() => setForm(false)}
          onSaved={(id) => navigate(companyPath(id))}
        />
      )}
      <div className="growth-counts">
        <span>
          <strong>{query.data?.totals.companies ?? 0}</strong> 家公司
        </span>
        <span>
          <strong>{query.data?.totals.leads ?? 0}</strong> 条线索
        </span>
        <span>
          <strong>{query.data?.totals.watched ?? 0}</strong> 家关注
        </span>
        <small>招聘与活动反映投入意向，不代表增长或盈利已得到验证。</small>
      </div>
      <div className="growth-toolbar">
        <div className="small-tabs">
          {[
            ["all", "全部公司"],
            ["watch", "已关注"],
            ["changes", "发现与变化"],
            ["ignored", "已忽略"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="growth-filters">
          <label className="growth-search">
            <Search size={15} />
            <input
              aria-label="搜索增长线索"
              placeholder="搜索公司、产品或岗位…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="信源筛选"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">全部信源</option>
            {Object.entries(growthSources).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="渠道筛选"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="">全部渠道</option>
            {channelNames.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <ErrorBox error={query.error || patch.error} />
      {query.isPending ? (
        <Empty title="正在读取本地线索…" />
      ) : !leads.length ? (
        <Empty
          title={
            query.data?.totals.leads
              ? "没有符合条件的线索"
              : "从第一条增长线索开始"
          }
        >
          {query.data?.totals.leads
            ? "试试调整来源、渠道或搜索条件。"
            : "点击更新 YC Jobs 建立公开岗位基线，也可以录入 SideShift 或 Wellfound 线索。"}
        </Empty>
      ) : (
        <div className="growth-grid">
          {query.data.companies.map((c: any) => {
            const items = leads.filter((l) => l.companyId === c.id);
            const channels = [
              ...new Set(
                items.flatMap((l) => l.evidence.map((e) => e.channel)),
              ),
            ];
            return (
              <article
                className={cn("growth-card", c.ignored && "ignored")}
                key={c.id}
              >
                <div className="growth-card-heading">
                  <span className="growth-company-icon">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <Link to={companyPath(c.id)}>
                      <h2>{c.name}</h2>
                    </Link>
                    <span>
                      {c.batch ? `YC ${c.batch} · ` : ""}
                      {items.length} 条相关线索
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`${c.watch ? "取消关注" : "关注"} ${c.name}`}
                    disabled={patch.isPending}
                    onClick={() =>
                      patch.mutate({ id: c.id, body: { watch: !c.watch } })
                    }
                  >
                    <Bookmark
                      size={17}
                      fill={c.watch ? "currentColor" : "none"}
                    />
                  </Button>
                </div>
                <p className="growth-summary">
                  {c.summary || "产品背景待补充，先从原始线索开始研究。"}
                </p>
                <div className="growth-tags">
                  {channels.length ? (
                    channels.map((x) => <span key={x}>{x}</span>)
                  ) : (
                    <span>渠道待研究</span>
                  )}
                </div>
                <div className="growth-card-leads">
                  {items.slice(0, 3).map((l) => (
                    <Link key={l.id} to={companyPath(c.id)}>
                      <span>
                        {growthSources[l.source]} · {eventNames[l.event]}
                      </span>
                      <strong>{l.title}</strong>
                      <small>
                        {l.compensation || "报酬未披露"}
                        {l.location ? ` · ${l.location}` : ""}
                      </small>
                    </Link>
                  ))}
                </div>
                <div className="growth-card-foot">
                  <span>
                    {items.length > 3 ? `另有 ${items.length - 3} 条 · ` : ""}
                    最近观察{" "}
                    {time(
                      items
                        .map((l) => l.lastSeen)
                        .sort()
                        .at(-1),
                    )}
                  </span>
                  <Link to={companyPath(c.id)}>
                    查看证据 <ArrowUpRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
type ManualProps = {
  initial?: GrowthRow;
  onSaved: (companyId: string) => void;
  onCancel: () => void;
};
function ManualForm({ initial, onSaved, onCancel }: ManualProps) {
  const companies = useQuery({
    queryKey: ["growth", "companies"],
    queryFn: () => api<any[]>("/growth/companies"),
  });
  const [source, setSource] = useState(initial?.source ?? "sideshift");
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const save = useChange((body: any) =>
    api(
      initial
        ? `/growth/leads/${encodeURIComponent(initial.id)}`
        : "/growth/leads",
      initial ? "PUT" : "POST",
      body,
    ),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const company = companies.data?.find((c) => c.id === companyId);
    save.mutate(
      {
        ...body,
        source,
        ...(companyId ? { companyId } : {}),
        companyName: company?.name ?? body.companyName,
      },
      { onSuccess: (r) => onSaved(r.companyId) },
    );
  }
  return (
    <form className="panel growth-form" onSubmit={submit}>
      <div className="panel-title">
        <h2>{initial ? "编辑手动线索" : "录入一条增长线索"}</h2>
        <Button
          type="button"
          variant="ghost"
          aria-label="关闭录入"
          onClick={onCancel}
        >
          <X size={18} />
        </Button>
      </div>
      <p className="growth-help">
        保存原始链接和你的观察。发布机构与推广产品可以不同；报酬保留周期和口径。
      </p>
      <div className="growth-form-grid">
        <label>
          来源
          <select
            aria-label="线索来源"
            value={source}
            disabled={!!initial}
            onChange={(e) => setSource(e.target.value as any)}
          >
            <option value="sideshift">SideShift</option>
            <option value="wellfound">Wellfound</option>
          </select>
        </label>
        <label>
          线索类型
          <select name="kind" defaultValue={initial?.kind ?? "campaign"}>
            <option value="campaign">创作者 / 推广活动</option>
            <option value="job">招聘岗位</option>
          </select>
        </label>
        <label className="wide">
          原始链接
          <input
            name="url"
            type="url"
            required
            maxLength={2000}
            defaultValue={initial?.url}
            placeholder={
              source === "sideshift"
                ? "https://app.sideshift.app/jobs/…"
                : "https://wellfound.com/jobs/…"
            }
          />
        </label>
        <label>
          归属公司
          <select
            aria-label="归属公司"
            value={companyId}
            disabled={!!initial}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">新建公司 / 产品</option>
            {companies.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!companyId ? (
          <label>
            公司 / 产品名称
            <input
              name="companyName"
              required
              maxLength={200}
              defaultValue={initial?.company.name}
            />
          </label>
        ) : (
          <div className="growth-help">这条线索将归入所选公司的研究记录。</div>
        )}
        {!companyId && (
          <label>
            产品官网（可选）
            <input
              name="website"
              type="url"
              maxLength={2000}
              placeholder="https://…"
              defaultValue={initial?.company.website}
            />
          </label>
        )}
        <label>
          发布机构（可选）
          <input
            name="publisher"
            maxLength={200}
            defaultValue={initial?.publisher}
            placeholder="可能是代理商或招聘机构"
          />
        </label>
        <label className="wide">
          线索标题
          <input
            name="title"
            required
            maxLength={500}
            defaultValue={initial?.title}
          />
        </label>
        <label className="wide">
          研究记录
          <textarea
            name="description"
            required
            rows={5}
            maxLength={30000}
            defaultValue={initial?.description}
            placeholder="用自己的话记录：推广哪个产品、需要什么内容、涉及哪些渠道，以及还有哪些疑问。"
          />
        </label>
        <label>
          报酬原文（可选）
          <input
            name="compensation"
            maxLength={1000}
            defaultValue={initial?.compensation}
            placeholder="$1,000 / month + bonus"
          />
        </label>
        <label>
          报酬口径（可选）
          <input
            name="compensationUnit"
            maxLength={200}
            defaultValue={initial?.compensationUnit}
            placeholder="创作者月费 / 每条视频 / 岗位年薪"
          />
        </label>
        <label>
          工作地点（可选）
          <input
            name="location"
            maxLength={1000}
            defaultValue={initial?.location}
          />
        </label>
        <label>
          产品目标市场（可选）
          <input
            name="targetMarket"
            maxLength={1000}
            defaultValue={initial?.targetMarket}
            placeholder="仅填写原文明确提及的市场"
          />
        </label>
        <label>
          发布时间描述（可选）
          <input
            name="publishedLabel"
            maxLength={200}
            defaultValue={initial?.publishedLabel}
            placeholder="保留来源日期或相对时间"
          />
        </label>
        <label>
          合作方式（可选）
          <input
            name="employmentType"
            maxLength={200}
            defaultValue={initial?.employmentType}
            placeholder="全职 / 合同 / 单次合作"
          />
        </label>
      </div>
      <ErrorBox error={save.error} />
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={save.isPending}>
          {save.isPending ? "保存中…" : "保存线索"}
        </Button>
      </div>
    </form>
  );
}
export function GrowthCompany() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["growth", "company", id],
    queryFn: () => api(endpoint(id)),
  });
  return (
    <div className="growth-page">
      <Link className="back" to="/growth">
        <ArrowLeft size={14} />
        返回增长雷达
      </Link>
      <ErrorBox error={query.error} />
      {query.data ? (
        <CompanyBody key={id} data={query.data} />
      ) : (
        !query.error && <Empty title="正在读取研究记录…" />
      )}
    </div>
  );
}
function CompanyBody({ data }: { data: any }) {
  const c = data.company;
  const leads: GrowthRow[] = data.leads;
  const [notes, setNotes] = useState(c.notes);
  const [saved, setSaved] = useState(false);
  const [edit, setEdit] = useState<GrowthRow | undefined>();
  const patch = useChange((body: any) => api(endpoint(c.id), "PATCH", body));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            COMPANY RESEARCH{c.batch ? ` / YC ${c.batch}` : ""}
          </div>
          <h1>{c.name}</h1>
          <p>{c.summary || "从增长线索认识这个产品。"}</p>
          {c.website && (
            <a
              className="growth-website"
              href={c.website}
              target="_blank"
              rel="noreferrer"
            >
              产品官网 <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ watch: !c.watch })}
          >
            <Bookmark size={15} fill={c.watch ? "currentColor" : "none"} />
            {c.watch ? "已关注" : "关注公司"}
          </Button>
          <Button
            variant="ghost"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ ignored: !c.ignored })}
          >
            <EyeOff size={15} />
            {c.ignored ? "恢复显示" : "忽略"}
          </Button>
        </div>
      </div>
      <ErrorBox error={patch.error} />
      {edit && (
        <ManualForm
          key={edit.id}
          initial={edit}
          onCancel={() => setEdit(undefined)}
          onSaved={() => setEdit(undefined)}
        />
      )}
      <div className="growth-detail-grid">
        <div className="growth-detail-main">
          <div className="growth-section-label">
            增长证据 <span>{leads.length} 条</span>
          </div>
          {leads.map((l) => (
            <article className="panel growth-evidence" key={l.id}>
              <div className="growth-evidence-top">
                <span>
                  {growthSources[l.source]} ·{" "}
                  {l.kind === "job" ? "招聘岗位" : "推广活动"} ·{" "}
                  {l.source === "yc" ? "来源陈述" : "人工研究记录"}
                </span>
                <span>{eventNames[l.event]}</span>
              </div>
              <h2>{l.title}</h2>
              <Tags lead={l} />
              <dl className="growth-facts">
                <dt>报酬</dt>
                <dd>
                  {l.compensation || "未披露"}
                  {l.compensation && l.compensationUnit
                    ? ` · ${l.compensationUnit}`
                    : ""}
                </dd>
                <dt>工作地点</dt>
                <dd>{l.location || "未披露"}</dd>
                <dt>目标市场</dt>
                <dd>{l.targetMarket || "未单独确认"}</dd>
                <dt>发布机构</dt>
                <dd>{l.publisher || "未单独记录"}</dd>
                <dt>合作方式</dt>
                <dd>{l.employmentType || "未披露"}</dd>
              </dl>
              {l.evidence.length > 0 && (
                <div className="growth-quotes">
                  {l.evidence.map((e) => (
                    <div key={e.channel}>
                      <span>{e.channel}</span>
                      <blockquote>{e.text}</blockquote>
                    </div>
                  ))}
                  <small>规则匹配的文字依据，需结合完整上下文判断。</small>
                </div>
              )}
              {l.checkError && (
                <ErrorBox error={`最近检查失败，保留旧资料：${l.checkError}`} />
              )}
              {l.source === "yc" && !l.inLatestList && (
                <p className="growth-warning">
                  本次公开列表未观察到；不代表岗位关闭。
                </p>
              )}
              <details className="growth-description">
                <summary>
                  {l.source === "yc" ? "查看完整岗位正文" : "查看研究记录"}
                </summary>
                <p>{l.description}</p>
              </details>
              <div className="growth-observed">
                <span>
                  首次发现 {time(l.firstSeen)} · 最近观察 {time(l.lastSeen)}
                </span>
                <span>
                  来源发布时间描述：{l.publishedLabel || "未提供"}（观察时记录）
                </span>
              </div>
              <div className="growth-evidence-actions">
                <a href={l.url} target="_blank" rel="noreferrer">
                  查看原始页面 <ExternalLink size={13} />
                </a>
                <a
                  href={`/api/growth/versions/${l.versionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  保存的证据
                </a>
                {l.source !== "yc" && (
                  <Button variant="ghost" onClick={() => setEdit(l)}>
                    <Pencil size={12} />
                    编辑线索
                  </Button>
                )}
              </div>
            </article>
          ))}
          <section className="panel growth-history">
            <h2>观察时间线</h2>
            <p className="growth-help">
              首次采集只建立基线。新发现表示进入本地观察范围，内容变化也可能只是措辞调整。
            </p>
            {data.versions.map((v: any) => (
              <details key={v.id}>
                <summary>
                  <span>{eventNames[v.event]}</span>
                  <strong>{v.payload.title}</strong>
                  <time>{time(v.observed_at)}</time>
                </summary>
                <p>{v.payload.description}</p>
                <a
                  href={`/api/growth/versions/${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看当时保存的完整版本 ↗
                </a>
              </details>
            ))}
          </section>
        </div>
        <aside className="growth-detail-aside">
          <section className="panel">
            <h2>研究笔记</h2>
            <p className="growth-help">
              区分来源陈述、你的推断，以及下一步需要验证的问题。
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                patch.mutate({ notes }, { onSuccess: () => setSaved(true) });
              }}
            >
              <label className="growth-notes-label">
                机会假设与下一步
                <textarea
                  aria-label="公司研究笔记"
                  value={notes}
                  maxLength={30000}
                  rows={9}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setSaved(false);
                  }}
                  placeholder={"需求假设：\n证据与疑问：\n下一步验证："}
                />
              </label>
              <Button disabled={patch.isPending}>保存笔记</Button>
              {saved && (
                <span className="growth-saved" role="status">
                  已保存
                </span>
              )}
            </form>
          </section>
          <AppAssociations company={c} links={data.links} />
          <div className="growth-caution">
            招聘、创作者招募和薪资是投入意向。它们不能单独证明渠道有效、实际投入金额或产品已达到
            PMF。
          </div>
        </aside>
      </div>
    </>
  );
}
function AppAssociations({ company, links }: { company: any; links: any[] }) {
  const [q, setQ] = useState(company.name);
  const [search, setSearch] = useState(company.name);
  const candidates = useQuery({
    queryKey: ["growth", "candidates", search],
    queryFn: () =>
      api<any[]>(`/growth/app-candidates?q=${encodeURIComponent(search)}`),
    enabled: !!search.trim(),
  });
  const link = useChange((appId: string) =>
    api(`${endpoint(company.id)}/apps`, "POST", { appId }),
  );
  const unlink = useChange((appId: string) =>
    api(`${endpoint(company.id)}/apps/${appId}`, "DELETE"),
  );
  return (
    <section className="panel growth-associations">
      <h2>
        <Link2 size={15} />
        关联 App Store 产品
      </h2>
      <p className="growth-help">
        从本地 App 库搜索并确认关联。同名只是候选，仍需核对开发者和官网。
      </p>
      {links.map((l) => (
        <div className="growth-linked" key={`${l.id}:${l.market}`}>
          <Link to={`/apps/${l.id}?market=${l.market}`}>
            <strong>{l.name}</strong>
            <small>{l.market.toUpperCase()} · 查看排名与笔记 ↗</small>
          </Link>
          <Button
            variant="ghost"
            aria-label={`解除关联 ${l.name} ${l.market}`}
            disabled={unlink.isPending}
            onClick={() => unlink.mutate(l.id)}
          >
            <X size={13} />
          </Button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <input
          aria-label="搜索关联 App"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="产品名、开发者或 App ID"
          maxLength={200}
        />
        <Button variant="outline" disabled={!q.trim()}>
          搜索
        </Button>
      </form>
      <ErrorBox error={link.error || unlink.error || candidates.error} />
      <div className="growth-candidates">
        {candidates.data
          ?.filter((a) => !links.some((l) => l.id === a.id))
          .map((a) => (
            <div key={`${a.id}:${a.market}`}>
              <span>
                <strong>{a.name}</strong>
                <small>
                  {a.developer} · {a.market.toUpperCase()} · {a.id}
                </small>
              </span>
              <Button
                variant="ghost"
                disabled={link.isPending}
                aria-label={`确认关联 ${a.name} ${a.market}`}
                onClick={() => link.mutate(a.id)}
              >
                关联
              </Button>
            </div>
          ))}
      </div>
      {candidates.data?.length === 0 && (
        <p className="growth-help">
          本地库暂未找到。可先到「观察名单」用 App Store 链接添加，再回来搜索。
        </p>
      )}
    </section>
  );
}
