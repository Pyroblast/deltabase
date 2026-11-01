import { GrowthRadar, GrowthCompany } from "./growth";
import { useEffect, useState } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ResearchInspector, ResearchList, type ResearchItem } from "./research";
import {
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Bookmark,
  Radar,
  Activity,
  Database,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Trash2,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import {
  categories,
  categoryName,
  chartNames,
  marketNames,
  type Market,
  type ChartKind,
  type RankedApp,
} from "../shared/catalog";
import {
  api,
  Button,
  Empty,
  ErrorBox,
  AppIcon,
  time,
  day,
  stale,
  cn,
} from "./lib";

function useAction<T = any>(fn: (args: T) => Promise<any>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries(),
  });
}
function StatusPill({ run }: { run: any }) {
  if (!run)
    return (
      <span className="status-pill">
        <i />
        等待建立基线
      </span>
    );
  return (
    <span className={cn("status-pill", run.status === "running" && "working")}>
      <i />
      {run.status === "running"
        ? `采集中 ${run.done}/${run.total}`
        : run.status === "partial"
          ? "部分来源待重试"
          : run.status === "failed"
            ? "采集失败"
            : run.status === "interrupted"
              ? "上次采集中断"
              : "本地数据已保存"}
    </span>
  );
}
function Layout() {
  const location = useLocation();
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api("/stats"),
    refetchInterval: 3000,
  });
  const sync = useAction(() => api("/sync", "POST", {}));
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">Δ</span>
          <span>
            deltabase<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace-label">PERSONAL RESEARCH SPACE</div>
        <nav>
          <NavLink to="/" end>
            <Radar size={19} />
            发现
          </NavLink>
          <NavLink to="/growth"><Activity size={19} />增长雷达</NavLink>
          <NavLink to="/watchlist">
            <Bookmark size={19} />
            观察名单
            <span className="nav-count">{stats.data?.watched ?? 0}</span>
          </NavLink>
          <NavLink to="/sources">
            <Database size={19} />
            数据状态
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <p>
            观察变化，
            <br />
            留下值得验证的问题。
          </p>
          <span>OBSERVE. CONNECT. DISCOVER.</span>
        </div>
        <div className="local-label">
          <i />
          本地工作空间<span>v0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Deltabase <ChevronRight size={14} /> 机会研究工作台
          </span>
          <div>
            {location.pathname.startsWith("/growth") ? <span className="status-pill"><i />增长信源 · 本地研究</span> : <StatusPill run={stats.data?.run} />}
          </div>
        </header>
        <main>
          <Routes>
            <Route
              path="/"
              element={<Discover stats={stats.data} sync={sync} />}
            />
            <Route path="/growth" element={<GrowthRadar />} />
            <Route path="/growth/:id" element={<GrowthCompany />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route
              path="/sources"
              element={<Sources stats={stats.data} sync={sync} />}
            />
            <Route path="/apps/:id" element={<Detail />} />
          </Routes>
          <ErrorBox error={stats.error} />
        </main>
        <footer>
          <span>Δ DELTABASE</span>
          <span>数据保存在本机 · 时间为北京时间 · 保留证据，持续观察</span>
        </footer>
      </div>
    </div>
  );
}
export default Layout;
function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function MarketSwitch({
  value,
  onChange,
}: {
  value: Market;
  onChange: (m: Market) => void;
}) {
  return (
    <div className="segmented" aria-label="市场">
      {(["us", "cn"] as const).map((m) => (
        <button
          key={m}
          aria-pressed={value === m}
          className={value === m ? "selected" : ""}
          onClick={() => onChange(m)}
        >
          <span className="country-code">{m.toUpperCase()}</span>
          {marketNames[m]}
        </button>
      ))}
    </div>
  );
}
function Discover({ stats, sync }: { stats: any; sync: any }) {
  const [params, setParams] = useSearchParams();
  const market = (params.get("market") ?? "us") as Market;
  const tab = params.get("tab") ?? (stats?.signals ? "signals" : "charts");
  const requestedKind = params.get("kind");
  const kind =
    tab === "signals"
      ? (requestedKind ?? "all")
      : requestedKind && requestedKind !== "all"
        ? requestedKind
        : "free";
  const category = Number(params.get("category") ?? 0);
  const page = Number(params.get("page") ?? 1);
  const q = params.get("q") ?? "";
  const showIgnored = params.get("ignored") === "1";
  useEffect(() => {
    if (stats && !params.has("tab")) {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.set("tab", stats.signals ? "signals" : "charts");
          return n;
        },
        { replace: true },
      );
    }
  }, [stats, params, setParams]);
  const change = (next: Record<string, string>) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("page", "1");
      n.delete("inspect");
      Object.entries(next).forEach(([k, v]) => n.set(k, v));
      return n;
    });
  const path = `/apps?market=${market}&kind=${tab === "cross" ? "cross" : kind}&category=${category}&q=${encodeURIComponent(q)}&page=${page}&ignored=${showIgnored ? 1 : 0}&focus=${tab === "cross" && params.get("focus") === "1" ? "1" : "0"}`;
  const list = useQuery<{ items: RankedApp[]; total: number }>({
    queryKey: ["apps", path],
    queryFn: () => api(path),
    refetchInterval: stats?.run?.status === "running" ? 5000 : false,
    enabled: tab !== "signals",
  });
  const date = params.get("date") ?? "";
  const signals = useQuery<any[]>({
    queryKey: ["signals", market, kind, category, date],
    queryFn: () =>
      api(
        `/signals?market=${market}${kind === "all" ? "" : `&kind=${kind}`}&category=${category}${date ? `&day=${date}` : ""}`,
      ),
    enabled: tab === "signals",
    refetchInterval: stats?.run?.status === "running" ? 5000 : false,
  });
  const items: ResearchItem[] =
    tab === "signals"
      ? (signals.data ?? []).map((e) => ({
          key: `event:${e.id}`,
          id: e.app_id,
          name: e.name,
          icon: e.icon,
          category: e.category,
          kind: e.kind,
          type: e.type,
          observedAt: e.observed_at,
          snapshotId: e.snapshot_id,
          ...e.details,
        }))
      : (list.data?.items ?? []).map((a) => ({
          ...a,
          key: `${a.id}:${a.category}:${a.kind}`,
          cross: tab === "cross",
        }));
  const selected =
    params.get("inspect") === "none"
      ? undefined
      : (items.find((a) => a.key === params.get("inspect")) ?? items[0]);
  const index = items.findIndex((a) => a.key === selected?.key);
  const select = (key: string, reveal = true) => {
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("inspect", key);
        return n;
      },
      { replace: true, preventScrollReset: true },
    );
    if (reveal && window.matchMedia("(max-width: 1000px)").matches)
      requestAnimationFrame(() =>
        document
          .getElementById("research-evidence")
          ?.scrollIntoView({ block: "start" }),
      );
  };
  const returnTo = `/?${params.toString()}`;
  return (
    <>
      <PageTitle
        eyebrow="THE OPPORTUNITY RADAR"
        title="从变化开始研究。"
        description="查看线索，核对证据，留下一个待验证的问题。"
      >
        <Button
          variant="outline"
          disabled={sync.isPending || stats?.run?.status === "running"}
          onClick={() => sync.mutate()}
        >
          <RefreshCw
            size={15}
            className={stats?.run?.status === "running" ? "spin" : ""}
          />
          {stats?.run?.status === "running" ? "正在更新" : "更新数据"}
        </Button>
      </PageTitle>
      <ErrorBox error={sync.error} />
      <div className="workspace-summary" aria-label="工作空间概览">
        <span>
          <strong>{(stats?.apps ?? 0).toLocaleString()}</strong> 已收录产品
        </span>
        <span>
          <strong>{stats?.signals ?? 0}</strong> 近 24 小时变化
        </span>
        <Link to="/watchlist">
          <Bookmark size={13} />
          <strong>{stats?.watched ?? 0}</strong> 正在关注
        </Link>
        <Link to="/sources" className="summary-sources">
          <Database size={13} />
          有效榜单 {stats?.covered ?? 0} / {stats?.enabled ?? 156}
          <ChevronRight size={13} />
        </Link>
      </div>
      <div className="section-tabs">
        <div>
          {[
            ["signals", "变化信号"],
            ["charts", "榜单浏览"],
            ["cross", "交叉观察"],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => change({ tab: v })}
              aria-pressed={tab === v}
              className={tab === v ? "active" : ""}
            >
              {label}
              {v === "cross" && (
                <span className="new-tag">FREE × GROSSING</span>
              )}
            </button>
          ))}
        </div>
        <span className="updated-at">
          最近成功采集 {time(stats?.lastSuccess)}
        </span>
      </div>
      <div className="toolbar">
        <MarketSwitch
          value={market}
          onChange={(market) => change({ market })}
        />
        <select
          aria-label="品类"
          value={category}
          onChange={(e) => change({ category: e.target.value })}
        >
          <option value="0">全部非游戏品类</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {tab !== "cross" && (
          <select
            aria-label="榜单"
            value={kind}
            onChange={(e) => change({ kind: e.target.value })}
          >
            {tab === "signals" && <option value="all">全部榜单与版本</option>}
            {Object.entries(chartNames).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
                {v === "grossing" ? " · 实验性" : ""}
              </option>
            ))}
          </select>
        )}
        {tab === "cross" && (
          <select
            aria-label="交叉筛选"
            value={params.get("focus") ?? "0"}
            onChange={(e) => change({ focus: e.target.value })}
          >
            <option value="0">全部交叉观察</option>
            <option value="1">畅销前 20 · 免费 50 名后或未观察到</option>
          </select>
        )}
        {tab === "signals" ? (
          <input
            type="date"
            aria-label="信号日期"
            value={date}
            onChange={(e) => change({ date: e.target.value })}
          />
        ) : (
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="搜索产品"
              placeholder="搜索产品、开发者…"
              value={q}
              onChange={(e) => change({ q: e.target.value })}
            />
          </div>
        )}
      </div>
      <div className="context-line">
        <span>
          {tab === "cross"
            ? "仅免费下载安装的产品；按 App ID 关联两榜，并保留未观察到的位置。"
            : kind === "paid"
              ? "观察付费下载产品的新进入与排名变化。"
              : kind === "grossing"
                ? "Apple 旧版畅销榜 · 实验性收入排名信号，不代表收入金额。"
                : "直接观察分类榜单；首次采集建立基线，后续比较变化。"}
        </span>
        {tab !== "signals" && (
          <label>
            <input
              type="checkbox"
              checked={showIgnored}
              onChange={(e) =>
                change({ ignored: e.target.checked ? "1" : "0" })
              }
            />
            显示已忽略
          </label>
        )}
      </div>
      <ErrorBox error={list.error ?? signals.error} />
      <div className="research-workspace">
        <div className="research-results">
          <ResearchList
            items={items}
            selected={selected?.key}
            onSelect={select}
            loading={tab === "signals" ? signals.isLoading : list.isLoading}
            signals={tab === "signals"}
          />
          {tab !== "signals" ? (
            <div className="pagination">
              <span>
                {(list.data?.total ?? 0).toLocaleString()} 条品类榜单记录{" "}
                <span className="muted">· 每页 50 条 · 名次为各品类内位置</span>
              </span>
              <div>
                <Button
                  variant="ghost"
                  aria-label="上一页"
                  disabled={page <= 1}
                  onClick={() => change({ page: String(page - 1) })}
                >
                  <ChevronLeft size={15} />
                </Button>
                <span>
                  {page} /{" "}
                  {Math.max(1, Math.ceil((list.data?.total ?? 0) / 50))}
                </span>
                <Button
                  variant="ghost"
                  aria-label="下一页"
                  disabled={page * 50 >= (list.data?.total ?? 0)}
                  onClick={() => change({ page: String(page + 1) })}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          ) : (
            <p className="results-caption">
              {items.length} 条观察信号 · 最多显示最近 200 条
            </p>
          )}
        </div>
        <ResearchInspector
          key={`${market}:${selected?.id ?? "empty"}`}
          item={selected}
          market={market}
          returnTo={returnTo}
          onClose={() => {
            select("none", false);
            if (window.matchMedia("(max-width: 1000px)").matches)
              document
                .querySelector(".research-results")
                ?.scrollIntoView({ block: "start" });
          }}
          onPrevious={
            index > 0 ? () => select(items[index - 1].key) : undefined
          }
          onNext={
            index >= 0 && index < items.length - 1
              ? () => select(items[index + 1].key)
              : undefined
          }
        />
      </div>
    </>
  );
}
function SignalList({
  items,
  market,
  loading = false,
}: {
  items: any[];
  market: Market;
  loading?: boolean;
}) {
  if (!items.length)
    return (
      <Empty title={loading ? "正在读取变化…" : "变化需要时间，也需要证据"}>
        首次采集只建立基线。后续新进入观察列表、上升至少 10
        位或关注产品更新版本时，会在这里留下记录。
      </Empty>
    );
  return (
    <div className="signals">
      {items.map((e) => (
        <Link
          key={e.id}
          to={`/apps/${e.app_id}?market=${market}`}
          className="signal"
        >
          <span className="signal-glyph">
            {e.type === "rising" ? (
              <ArrowUpRight size={21} />
            ) : e.type === "version" ? (
              <RefreshCw size={19} />
            ) : (
              <Plus size={20} />
            )}
          </span>
          <div>
            <strong>{e.name}</strong>
            <p>
              {e.type === "entered"
                ? `新进入本次观察列表 · 第 ${e.details.rank} 位`
                : e.type === "rising"
                  ? `从第 ${e.details.previousRank} 位升至第 ${e.details.rank} 位`
                  : `版本 ${e.details.from} → ${e.details.to}`}
            </p>
            <small>
              {e.kind
                ? `${categoryName(e.category)} · ${chartNames[e.kind as ChartKind]} · `
                : ""}
              {e.details.previousAt
                ? `对比 ${time(e.details.previousAt)} · `
                : ""}
              本次观察 {time(e.observed_at)}
            </small>
          </div>
          <ChevronRight size={16} />
        </Link>
      ))}
    </div>
  );
}
function Watchlist() {
  const [market, setMarket] = useState<Market>("us");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const list = useQuery<any[]>({
    queryKey: ["watchlist", market, q],
    queryFn: () =>
      api(`/watchlist?market=${market}&q=${encodeURIComponent(q)}`),
  });
  const add = useAction(() => api("/apps", "POST", { input, market }));
  return (
    <>
      <PageTitle
        eyebrow="YOUR OBSERVATION LIST"
        title="保持关注"
        description="把值得研究的产品留下，让判断随着证据逐渐清楚。"
      >
        <Button onClick={() => setAdding(!adding)}>
          <Plus size={16} />
          添加产品
        </Button>
      </PageTitle>
      <div className="toolbar">
        <MarketSwitch value={market} onChange={setMarket} />
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="搜索观察名单…"
            aria-label="搜索观察名单"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      {adding && (
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, {
              onSuccess: (r) => navigate(`/apps/${r.id}?market=${r.market}`),
            });
          }}
        >
          <label>
            添加到{marketNames[market]}市场观察名单
            <input
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="App Store 链接或 App ID"
            />
          </label>
          <Button disabled={add.isPending}>
            {add.isPending ? "正在查询…" : "查询并关注"}
          </Button>
          <ErrorBox error={add.error} />
        </form>
      )}
      <ErrorBox error={list.error} />
      {!list.data?.length ? (
        <Empty
          title="为你的下一次研究，留下一条线索"
          icon={<Bookmark size={28} />}
        >
          在发现页收藏产品，或通过 App Store
          链接添加。此处显示所选市场已收录的产品。
        </Empty>
      ) : (
        <div className="watch-grid">
          {list.data.map((a) => (
            <Link
              key={a.id}
              className="watch-card"
              to={`/apps/${a.id}?market=${market}`}
            >
              <div>
                <AppIcon src={a.icon} name={a.name} />
                <ArrowUpRight size={19} />
              </div>
              <h3>{a.name}</h3>
              <p>{a.developer}</p>
              <div className="watch-tags">
                <span className="category-tag">{categoryName(a.category)}</span>
                {a.tags && <span className="category-tag">{a.tags}</span>}
              </div>
              <div className="watch-bottom">
                <span>查看证据与笔记</span>
                <ChevronRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Detail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const market = (params.get("market") ?? "us") as Market;
  const requestedReturn = params.get("returnTo");
  const returnTo = requestedReturn?.startsWith("/?")
    ? requestedReturn
    : `/?market=${market}`;
  const client = useQueryClient();
  const query = useQuery<any>({
    queryKey: ["detail", id, market],
    queryFn: () => api(`/apps/${id}?market=${market}`),
  });
  const update = useAction((body: any) => api(`/apps/${id}`, "PATCH", body));
  const meta = useMutation({
    mutationFn: () => api(`/apps/${id}/metadata`, "POST", { market }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["detail", id, market] }),
  });
  useEffect(() => {
    meta.mutate();
  }, [id, market]);
  const [editing, setEditing] = useState<any>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  if (query.isLoading) return <Empty title="读取产品档案…" />;
  const a = query.data;
  if (!a)
    return (
      <>
        <Link className="back" to={returnTo}>
          <ArrowLeft size={15} />
          返回发现
        </Link>
        <ErrorBox error={query.error} />
      </>
    );
  const m = a.metadata;
  return (
    <>
      <Link className="back" to={returnTo}>
        <ArrowLeft size={15} />
        返回发现
      </Link>
      <div className="detail-heading">
        <AppIcon src={a.icon} name={a.name} />
        <div>
          <div className="eyebrow">PRODUCT DOSSIER / {id}</div>
          <h1>{a.name}</h1>
          <p>
            {a.developer}{" "}
            <span>
              · {marketNames[market]} · {categoryName(a.category)}
            </span>
          </p>
        </div>
        <Button
          variant={a.watch ? "outline" : "default"}
          disabled={update.isPending}
          onClick={() => update.mutate({ watch: !a.watch })}
        >
          <Bookmark size={16} fill={a.watch ? "currentColor" : "none"} />
          {a.watch ? "已关注" : "加入观察名单"}
        </Button>
      </div>
      <ErrorBox error={update.error} />
      <ErrorBox error={meta.error} />
      <div className="detail-columns">
        <div className="detail-main">
          <section className="panel">
            <div className="panel-title">
              <h2>排名轨迹</h2>
              <span>真实采样 · 无数据处不推算</span>
            </div>
            <History history={a.history} />
            <div className="rank-summaries">
              {(["free", "paid", "grossing"] as const).map((k) => {
                const row = a.latest.find((r: any) => r.kind === k);
                return (
                  <div key={k}>
                    <span>
                      {chartNames[k]}
                      {k === "grossing" ? " · 实验性" : ""}
                    </span>
                    <strong>{row ? `#${row.rank}` : "未观察到"}</strong>
                    <small>
                      {row
                        ? `${categoryName(row.category)} · ${time(row.observed_at)}`
                        : "本次返回列表没有该产品"}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>机会笔记</h2>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setNoteOpen(!noteOpen);
                }}
              >
                <Plus size={15} />
                写一条笔记
              </Button>
            </div>
            {noteOpen && (
              <NoteForm
                key={editing?.id ?? "new"}
                appId={id!}
                note={editing}
                onDone={() => {
                  setNoteOpen(false);
                  setEditing(null);
                }}
              />
            )}
            {!a.notes.length && !noteOpen && (
              <div className="note-prompt">
                <FileText size={22} />
                <p>
                  这个产品解决了谁的什么问题？
                  <br />
                  <span>记录假设、证据和下一步验证动作。</span>
                </p>
              </div>
            )}
            {a.notes.map((n: any) => (
              <Note
                key={n.id}
                note={n}
                onEdit={() => {
                  setEditing(n);
                  setNoteOpen(true);
                }}
              />
            ))}
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>证据时间线</h2>
              <span>来源可追溯</span>
            </div>
            <SignalList items={a.events} market={market} />
            {a.history.length > 0 && (
              <details className="raw-history">
                <summary>查看 {a.history.length} 条原始榜单观察记录</summary>
                {a.history
                  .slice()
                  .reverse()
                  .map((r: any) => (
                    <div key={r.snapshotId}>
                      <span>
                        {time(r.observedAt)} · {categoryName(r.category)} ·{" "}
                        {chartNames[r.kind as ChartKind]} #{r.rank}
                      </span>
                      <a
                        href={`/api/snapshots/${r.snapshotId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        原始快照 <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
              </details>
            )}
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <div className="panel-title">
              <h2>产品资料</h2>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                aria-label="打开 App Store"
              >
                <ExternalLink size={16} />
              </a>
            </div>
            <dl>
              <dt>下载价格</dt>
              <dd>
                {a.price === 0
                  ? "免费"
                  : a.price == null
                    ? "未知"
                    : `${a.currency} ${a.price}`}
              </dd>
              <dt>当前版本</dt>
              <dd>{m?.version ?? "待补充"}</dd>
              <dt>评分 / 评分数</dt>
              <dd>
                {m?.averageUserRating
                  ? `${m.averageUserRating.toFixed(1)} / ${m.userRatingCount.toLocaleString()}`
                  : "待补充"}
              </dd>
              <dt>首次发布</dt>
              <dd>
                {a.release_date
                  ? new Date(a.release_date).toLocaleDateString("zh-CN")
                  : "未知"}
              </dd>
              <dt>首次收录</dt>
              <dd>{time(a.first_seen)}</dd>
              <dt>资料更新</dt>
              <dd>{time(a.metadata_at)}</dd>
            </dl>
            <Button
              variant="outline"
              className="full"
              disabled={meta.isPending}
              onClick={() => meta.mutate()}
            >
              <RefreshCw size={14} className={meta.isPending ? "spin" : ""} />
              {meta.isPending ? "补充资料中…" : "检查资料更新"}
            </Button>
            <p className="micro">
              资料缓存 24 小时。下载价格不是订阅费；评分和描述来自所选地区商店。
            </p>
            <div className="region-links">
              {(["us", "cn"] as const).map((region) => (
                <Link
                  className={region === market ? "active" : ""}
                  key={region}
                  to={`/apps/${id}?market=${region}&returnTo=${encodeURIComponent(returnTo)}`}
                >
                  {marketNames[region]}资料
                </Link>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>研究标签</h2>
            <form
              key={a.tags}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                update.mutate({ tags: String(f.get("tags")) });
              }}
            >
              <input
                aria-label="研究标签"
                name="tags"
                defaultValue={a.tags}
                placeholder="例如：AI 工具、待体验"
                maxLength={500}
              />
              <Button
                variant="outline"
                className="full"
                disabled={update.isPending}
              >
                保存标签
              </Button>
            </form>
          </section>
          <section className="panel description-panel">
            <h2>产品介绍</h2>
            <p>
              {m?.description ??
                "打开详情后会按需查询产品介绍。获取失败时，可以打开 App Store 查看。"}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
function History({ history }: { history: any[] }) {
  const [kind, setKind] = useState<ChartKind>("free");
  const available = [
    ...new Set(history.filter((r) => r.kind === kind).map((r) => r.category)),
  ] as number[];
  const [category, setCategory] = useState(0);
  const selected = available.includes(category) ? category : available[0];
  const rows = history.filter(
    (r) => r.kind === kind && r.category === selected,
  );
  const start = rows.length ? Date.parse(rows[0].observedAt) : 0;
  const end = rows.length ? Date.parse(rows.at(-1).observedAt) : 0;
  const max = Math.max(10, ...rows.map((r) => r.rank));
  const points = rows.map((r) => ({
    x:
      end === start
        ? 350
        : 50 + ((Date.parse(r.observedAt) - start) / (end - start)) * 610,
    y: 20 + ((r.rank - 1) / Math.max(1, max - 1)) * 130,
    r,
  }));
  return (
    <>
      <div className="chart-controls">
        <div className="small-tabs">
          {(["free", "paid", "grossing"] as const).map((k) => (
            <button
              key={k}
              className={kind === k ? "active" : ""}
              onClick={() => setKind(k)}
            >
              {chartNames[k]}
            </button>
          ))}
        </div>
        {available.length > 1 && (
          <select
            aria-label="趋势品类"
            value={selected}
            onChange={(e) => setCategory(Number(e.target.value))}
          >
            {available.map((c) => (
              <option key={c} value={c}>
                {categoryName(c)}
              </option>
            ))}
          </select>
        )}
      </div>
      {!rows.length ? (
        <div className="chart-empty">该榜单尚无观察记录</div>
      ) : (
        <>
          <svg
            className="history-chart"
            viewBox="0 0 710 190"
            role="img"
            aria-label={`${chartNames[kind]}排名历史，${rows.length}个实际采样点，顶部为第一名`}
          >
            <title>排名越靠上越高，仅连接间隔不超过 36 小时的采样点</title>
            {[1, Math.round(max / 2), max].map((v, i) => (
              <g key={i}>
                <line
                  x1="42"
                  x2="678"
                  y1={20 + ((v - 1) / (max - 1)) * 130}
                  y2={20 + ((v - 1) / (max - 1)) * 130}
                  stroke="var(--line)"
                  strokeDasharray="3 5"
                />
                <text x="8" y={24 + ((v - 1) / (max - 1)) * 130}>
                  {v}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i > 0 &&
              Date.parse(p.r.observedAt) -
                Date.parse(points[i - 1].r.observedAt) <=
                36 * 3600000 ? (
                <line
                  key={`line${i}`}
                  x1={points[i - 1].x}
                  y1={points[i - 1].y}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--ink)"
                  strokeWidth="2"
                />
              ) : null,
            )}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--ink)">
                <title>
                  {time(p.r.observedAt)}：第 {p.r.rank} 位
                </title>
              </circle>
            ))}
            <text x="45" y="180">
              {day(rows[0].observedAt)}
            </text>
            {rows.length > 1 && (
              <text x="630" y="180">
                {day(rows.at(-1).observedAt)}
              </text>
            )}
          </svg>
          <div className="chart-caption">
            {categoryName(selected)} · {rows.length} 次观察
            {rows.length === 1 ? " · 已建立基线，等待下一次采集" : ""}
          </div>
        </>
      )}
    </>
  );
}
function NoteForm({
  appId,
  note,
  onDone,
}: {
  appId: string;
  note: any;
  onDone: () => void;
}) {
  const save = useAction((body: any) =>
    api(
      note ? `/notes/${note.id}` : `/apps/${appId}/notes`,
      note ? "PUT" : "POST",
      body,
    ),
  );
  return (
    <form
      className="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate(Object.fromEntries(f), { onSuccess: onDone });
      }}
    >
      {[
        ["audience", "目标人群", note?.audience, "谁在什么情境下需要它？"],
        ["hypothesis", "需求假设", note?.hypothesis, "你希望进一步验证的判断"],
        [
          "evidence",
          "证据与反证",
          note?.evidence,
          "哪些观察支持或反对这个判断？",
        ],
        [
          "nextStep",
          "下一步验证",
          note?.next_step,
          "体验产品、找用户访谈，或做一个小实验",
        ],
        ["links", "原始链接", note?.links, "每行一个 http / https 链接"],
      ].map(([name, label, value, placeholder]) => (
        <label key={name}>
          {label}
          <textarea
            name={name}
            defaultValue={value ?? ""}
            placeholder={placeholder}
            required={name === "hypothesis"}
            rows={name === "evidence" ? 3 : 2}
          />
        </label>
      ))}
      <ErrorBox error={save.error} />
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button disabled={save.isPending}>
          {save.isPending ? "保存中…" : "保存笔记"}
        </Button>
      </div>
    </form>
  );
}
function Note({ note, onEdit }: { note: any; onEdit: () => void }) {
  const remove = useAction(() => api(`/notes/${note.id}`, "DELETE"));
  return (
    <article className="note">
      <div className="note-head">
        <time>{time(note.updated_at)}</time>
        <div>
          <Button variant="ghost" onClick={onEdit}>
            编辑
          </Button>
          <Button
            variant="ghost"
            aria-label="删除笔记"
            onClick={() => {
              if (confirm("删除这条笔记？")) remove.mutate();
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {[
        ["目标人群", note.audience],
        ["需求假设", note.hypothesis],
        ["证据与反证", note.evidence],
        ["下一步验证", note.next_step],
      ]
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div className="note-field" key={label}>
            <span>{label}</span>
            <p>{value}</p>
          </div>
        ))}
      {note.links && (
        <div className="note-links">
          {note.links
            .split("\n")
            .filter(Boolean)
            .map((link: string, i: number) => (
              <a key={i} href={link.trim()} target="_blank" rel="noreferrer">
                <ExternalLink size={12} />
                {link}
              </a>
            ))}
        </div>
      )}
      <ErrorBox error={remove.error} />
    </article>
  );
}

function SourceSwitch({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const [value, setValue] = useState(checked);
  useEffect(() => setValue(checked), [checked]);
  return (
    <label>
      <input
        type="checkbox"
        disabled={disabled}
        checked={value}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          onChange(next);
        }}
      />
      {children}
    </label>
  );
}
function Sources({ stats, sync }: { stats: any; sync: any }) {
  const [market, setMarket] = useState<Market>("us");
  const [category, setCategory] = useState(0);
  const query = useQuery<any[]>({
    queryKey: ["sources"],
    queryFn: () => api("/sources"),
    refetchInterval: 4000,
  });
  const runs = useQuery<any[]>({
    queryKey: ["runs"],
    queryFn: () => api("/runs"),
    refetchInterval: 4000,
  });
  const client = useQueryClient();
  const settings = useMutation({
    mutationFn: (body: any) => api("/sources", "PATCH", body),
    onMutate: (body: any) => {
      const previous = client.getQueryData<any[]>(["sources"]);
      client.setQueryData(["sources"], (rows: any[] | undefined) =>
        rows?.map((s) =>
          (body.kind === undefined || s.kind === body.kind) &&
          (body.category === undefined || s.category === body.category)
            ? { ...s, enabled: Number(body.enabled) }
            : s,
        ),
      );
      return { previous };
    },
    onError: (_error, _body, context) => {
      client.setQueryData(["sources"], context?.previous);
    },
    onSettled: () => client.invalidateQueries(),
  });
  const retry = useAction((sourceId: string) =>
    api("/sync", "POST", { sourceId }),
  );
  const items = (query.data ?? []).filter(
    (s) => s.market === market && (!category || s.category === category),
  );
  return (
    <>
      <PageTitle
        eyebrow="DATA & PROVENANCE"
        title="数据状态"
        description="每一个发现，都应该能回到它的原始证据。"
      >
        <Button
          onClick={() => sync.mutate()}
          disabled={sync.isPending || stats?.run?.status === "running"}
        >
          <RefreshCw size={15} />
          更新全部已启用来源
        </Button>
      </PageTitle>
      <ErrorBox
        error={query.error ?? settings.error ?? retry.error ?? sync.error}
      />
      <div className="source-intro">
        <div>
          <Database size={25} />
          <div>
            <h3>Apple App Store</h3>
            <p>26 个非游戏品类 × 2 个市场 × 3 类榜单 · 最多请求 100 条 / 榜</p>
          </div>
        </div>
        <span className="category-tag">公开 RSS / Lookup</span>
      </div>
      <div className="source-callout">
        畅销榜来自 Apple
        旧版接口，作为实验性收入排名线索。空响应不代表没有产品，失败不覆盖历史快照。所有旧版分类接口的可用性均持续观察。
      </div>
      {stats?.run && (
        <div className="progress-panel">
          <div>
            <strong>
              {stats.run.status === "running" ? "采集进行中" : "最近一次采集"}
            </strong>
            <StatusPill run={stats.run} />
          </div>
          <progress max={stats.run.total || 1} value={stats.run.done} />
          <p>
            {stats.run.success} 成功 · {stats.run.empty} 暂无数据 ·{" "}
            {stats.run.failed} 失败 · {stats.run.done}/{stats.run.total} 已完成
            {stats.run.error ? ` · ${stats.run.error}` : ""}
          </p>
        </div>
      )}
      <details className="settings-panel">
        <summary>
          <SlidersHorizontal size={16} />
          采集范围设置
        </summary>
        <div className="source-toggles">
          {(["free", "paid", "grossing"] as const).map((kind) => (
            <SourceSwitch
              key={kind}
              disabled={settings.isPending}
              checked={(query.data ?? []).some(
                (s) => s.kind === kind && s.enabled,
              )}
              onChange={(enabled) => settings.mutate({ kind, enabled })}
            >
              {chartNames[kind]}
              {kind === "grossing" ? "（实验性）" : ""}
            </SourceSwitch>
          ))}
        </div>
        <div className="category-toggles">
          {categories.map(([category, name]) => (
            <SourceSwitch
              key={category}
              disabled={settings.isPending}
              checked={(query.data ?? []).some(
                (s) => s.category === category && s.enabled,
              )}
              onChange={(enabled) => settings.mutate({ category, enabled })}
            >
              {name}
            </SourceSwitch>
          ))}
        </div>
        <p className="micro">
          操作按所选维度批量启用或停用来源；当前正在执行的采集会完成，下一轮使用新的范围。
        </p>
      </details>
      <div className="toolbar">
        <MarketSwitch value={market} onChange={setMarket} />
        <select
          aria-label="状态品类"
          value={category}
          onChange={(e) => setCategory(Number(e.target.value))}
        >
          <option value="0">全部品类</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="table-panel table-scroll">
        <table className="source-table">
          <thead>
            <tr>
              <th>来源</th>
              <th>状态</th>
              <th>上次有效条数</th>
              <th>最近检查</th>
              <th>说明</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{categoryName(s.category)}</strong>
                  <small>
                    {chartNames[s.kind as ChartKind]}
                    {s.kind === "grossing" ? " · 实验性" : ""}
                  </small>
                </td>
                <td>
                  <span className={`source-status ${s.status}`}>
                    {!s.enabled
                      ? "已停用"
                      : ((
                          {
                            success: "已保存",
                            failed: "失败",
                            empty: "暂无数据",
                            pending: "待采集",
                          } as any
                        )[s.status] ?? s.status)}
                  </span>
                </td>
                <td className="mono">{s.count || "—"}</td>
                <td className="muted">{time(s.last_checked)}</td>
                <td className="source-error">
                  {s.error ??
                    (s.status === "empty"
                      ? "来源未返回条目，历史记录保留"
                      : "")}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    来源 <ExternalLink size={11} />
                  </a>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    disabled={!s.enabled || stats?.run?.status === "running"}
                    onClick={() => retry.mutate(s.id)}
                    aria-label={`重试 ${s.id}`}
                  >
                    <RefreshCw size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel run-log">
        <h2>采集记录</h2>
        {runs.data?.map((r) => (
          <div key={r.id}>
            <span>{time(r.started_at)}</span>
            <span>{r.status}</span>
            <span>
              {r.success} 成功 / {r.failed} 失败 / {r.empty} 无数据
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
