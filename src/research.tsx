import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  FileText,
  X,
} from "lucide-react";
import {
  categoryName,
  chartNames,
  marketNames,
  type ChartKind,
  type Market,
} from "../shared/catalog";
import { api, AppIcon, Button, cn, Empty, ErrorBox, stale, time } from "./lib";

export type ResearchItem = {
  key: string;
  id: string;
  name: string;
  icon?: string;
  developer?: string;
  price?: number | null;
  currency?: string;
  category: number;
  kind: ChartKind;
  rank?: number;
  previousRank?: number | null;
  previousAt?: string | null;
  observedAt: string;
  sourceUpdatedAt?: string | null;
  snapshotId?: number;
  type?: string;
  from?: string;
  to?: string;
  cross?: boolean;
  freeRank?: number | null;
  freeAt?: string | null;
  grossingRank?: number | null;
  counterpartAt?: string | null;
  ignored?: number;
};

function Change({ item }: { item: ResearchItem }) {
  if (item.cross)
    return (
      <span className="cross-ranks">
        <span>
          免费 <b>{item.freeRank ?? "未观察到"}</b>
        </span>
        <span>
          畅销 <b>{item.grossingRank ?? "未观察到"}</b>
        </span>
      </span>
    );
  if (item.type === "version")
    return <span className="category-tag">版本更新</span>;
  if (item.previousRank == null)
    return (
      <span className="delta muted">
        {item.previousAt ? "新进入" : "建立基线"}
      </span>
    );
  const delta = item.previousRank - (item.rank ?? item.previousRank);
  return (
    <span
      className={cn(
        "delta",
        delta > 0 ? "positive" : delta < 0 ? "negative" : "muted",
      )}
    >
      {delta > 0 ? (
        <ArrowUp size={14} />
      ) : delta < 0 ? (
        <ArrowDown size={14} />
      ) : null}
      {delta ? `${Math.abs(delta)} 位` : "持平"}
    </span>
  );
}

export function ResearchList({
  items,
  selected,
  onSelect,
  loading,
  signals,
}: {
  items: ResearchItem[];
  selected?: string;
  onSelect: (key: string) => void;
  loading: boolean;
  signals: boolean;
}) {
  if (!items.length)
    return (
      <Empty
        title={
          loading
            ? "正在读取本地数据…"
            : signals
              ? "变化需要时间，也需要证据"
              : "这里还没有产品记录"
        }
      >
        {signals
          ? "首次采集只建立基线。后续新进入观察列表、上升至少 10 位或关注产品更新版本时，会在这里留下记录。"
          : "可以调整筛选，或到数据状态页检查来源。首次采集会逐批填充榜单。"}
      </Empty>
    );
  return (
    <div className="research-list" aria-label="产品研究列表">
      <div className="research-list-heading">
        <span>产品 / 来源品类</span>
        <span>{items[0]?.cross ? "免费 × 畅销" : "观察信号"}</span>
      </div>
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          className={cn("research-row", item.ignored && "ignored")}
          aria-label={`查看证据 ${item.name}`}
          aria-pressed={selected === item.key}
          onClick={() => onSelect(item.key)}
        >
          <AppIcon src={item.icon} name={item.name} />
          <span className="research-product">
            <strong>{item.name}</strong>
            <small>
              {item.kind
                ? `${categoryName(item.category)} · ${chartNames[item.kind]}`
                : "产品资料"}
              {!item.cross && item.rank != null ? ` #${item.rank}` : ""}
              {item.kind === "paid" && item.price != null
                ? ` · ${item.currency} ${item.price}`
                : ""}
              {item.kind === "grossing" || item.cross ? " · 实验性" : ""}
            </small>
            {signals && (
              <small className="signal-description">
                {item.type === "rising"
                  ? `从第 ${item.previousRank} 位升至第 ${item.rank} 位`
                  : item.type === "entered"
                    ? "新进入本次观察列表"
                    : `版本 ${item.from} → ${item.to}`}
              </small>
            )}
          </span>
          <span className="research-row-end">
            <Change item={item} />
            <small>{time(item.observedAt)}</small>
            {stale(item.observedAt) && <span className="stale">数据过期</span>}
          </span>
          <ChevronRight className="research-row-chevron" size={15} />
        </button>
      ))}
    </div>
  );
}

type Draft = { hypothesis: string; nextStep: string };
const blankDraft: Draft = { hypothesis: "", nextStep: "" };
function readDraft(id: string): Draft {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`deltabase:draft:${id}`) ?? "null",
    );
    return value &&
      typeof value.hypothesis === "string" &&
      typeof value.nextStep === "string"
      ? value
      : blankDraft;
  } catch {
    return blankDraft;
  }
}

function QuickNote({
  id,
  latestNote,
}: {
  id: string;
  latestNote?: { hypothesis: string; next_step: string };
}) {
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => readDraft(id));
  const [saved, setSaved] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const client = useQueryClient();
  useEffect(() => {
    try {
      if (draft.hypothesis || draft.nextStep)
        sessionStorage.setItem(`deltabase:draft:${id}`, JSON.stringify(draft));
      else sessionStorage.removeItem(`deltabase:draft:${id}`);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [id, draft]);
  const save = useMutation({
    mutationFn: () => api(`/apps/${id}/notes`, "POST", draft),
    onSuccess: () => {
      try {
        sessionStorage.removeItem(`deltabase:draft:${id}`);
      } catch {
        /* The saved note remains persisted in SQLite. */
      }
      setDraft(blankDraft);
      setSaved(true);
      void client.invalidateQueries({ queryKey: ["detail", id] });
    },
  });
  return (
    <section className="inspector-notes">
      <div className="panel-title">
        <h3>机会笔记</h3>
        <FileText size={16} />
      </div>
      {latestNote && (
        <details className="latest-note">
          <summary>最近的研究假设</summary>
          <p>{latestNote.hypothesis}</p>
          {latestNote.next_step && (
            <p>
              <span className="muted">下一步：</span>
              {latestNote.next_step}
            </p>
          )}
        </details>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          save.mutate();
        }}
      >
        <div className="quick-note-field">
          <label htmlFor={`${formId}-hypothesis`}>需求假设</label>
          <textarea
            id={`${formId}-hypothesis`}
            required
            maxLength={10000}
            rows={3}
            value={draft.hypothesis}
            disabled={save.isPending}
            placeholder="这个产品解决了谁的什么问题？"
            onChange={(e) => {
              setSaved(false);
              setDraft({ ...draft, hypothesis: e.target.value });
            }}
          />
        </div>
        <div className="quick-note-field">
          <label htmlFor={`${formId}-next-step`}>下一步验证</label>
          <textarea
            id={`${formId}-next-step`}
            maxLength={10000}
            rows={2}
            value={draft.nextStep}
            disabled={save.isPending}
            placeholder="体验产品、访谈用户，或做一个小实验"
            onChange={(e) => {
              setSaved(false);
              setDraft({ ...draft, nextStep: e.target.value });
            }}
          />
        </div>
        <ErrorBox error={save.error} />
        <div className="quick-note-actions">
          <span role="status">
            {saved
              ? "笔记已保存到本机"
              : storageFailed
                ? "草稿暂存不可用，请先保存笔记"
                : draft.hypothesis || draft.nextStep
                  ? "草稿已暂存于当前标签页"
                  : "记录一个可以验证的问题"}
          </span>
          <Button disabled={save.isPending || !draft.hypothesis.trim()}>
            {save.isPending ? "保存中…" : "保存笔记"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function RankEvidence({ item }: { item: ResearchItem }) {
  if (item.cross)
    return (
      <div className="evidence-cross">
        {[
          ["免费榜", item.freeRank, item.freeAt],
          ["畅销榜 · 实验性", item.grossingRank, item.counterpartAt],
        ].map(([label, rank, at]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{rank == null ? "未观察到" : `#${rank}`}</strong>
            <small>{at ? time(String(at)) : "本次返回列表没有该产品"}</small>
            {at && stale(String(at)) && (
              <small className="stale">数据过期</small>
            )}
          </div>
        ))}
        <p>两榜按 App ID 关联，保留各自采样时间。排名不代表收入金额。</p>
      </div>
    );
  const interval = item.previousAt
    ? (Date.parse(item.observedAt) - Date.parse(item.previousAt)) / 3600000
    : null;
  return (
    <div className="rank-evidence">
      <strong>
        {item.type === "version"
          ? `${item.from} → ${item.to}`
          : item.previousRank != null
            ? `#${item.previousRank} → #${item.rank}`
            : item.previousAt
              ? `未观察到 → #${item.rank}`
              : `#${item.rank}`}
      </strong>
      <p>
        {item.previousAt ? `${time(item.previousAt)} → ` : "本次观察："}
        {time(item.observedAt)}
      </p>
      <p>
        {item.type === "version"
          ? "关注产品的版本资料更新"
          : interval != null
            ? `相邻有效快照间隔 ${Number(interval.toFixed(1))} 小时`
            : "已建立基线，等待下一次采集"}{" "}
        · 北京时间
      </p>
      {item.previousRank == null && item.previousAt && (
        <p>前次返回列表未包含该产品；不代表新上架。</p>
      )}
      {item.sourceUpdatedAt && (
        <p>来源更新时间：{time(item.sourceUpdatedAt)}</p>
      )}
      {stale(item.observedAt) && (
        <p className="stale">此条观察已超过 36 小时，请结合最新数据判断。</p>
      )}
      {item.snapshotId && (
        <a
          className="evidence-link"
          href={`/api/snapshots/${item.snapshotId}`}
          target="_blank"
          rel="noreferrer"
        >
          查看原始快照 <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}

export function ResearchInspector({
  item,
  market,
  returnTo,
  onClose,
  onPrevious,
  onNext,
}: {
  item?: ResearchItem;
  market: Market;
  returnTo: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const id = item?.id;
  const client = useQueryClient();
  const detail = useQuery<any>({
    queryKey: ["detail", id, market],
    queryFn: () => api(`/apps/${id}?market=${market}`),
    enabled: !!id,
  });
  const update = useMutation({
    mutationFn: (body: { watch?: boolean; ignored?: boolean }) =>
      api(`/apps/${id}`, "PATCH", body),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
  if (!item)
    return (
      <aside
        className="research-inspector inspector-placeholder"
        aria-label="观察证据"
      >
        <FileText size={26} />
        <h2>让线索变成研究。</h2>
        <p>选择左侧产品，在这里核对变化、查看证据，记录下一步验证动作。</p>
      </aside>
    );
  const a = detail.data;
  return (
    <aside
      id="research-evidence"
      className="research-inspector"
      aria-label="观察证据"
    >
      <div className="inspector-toolbar">
        <span>观察证据</span>
        <div>
          <Button
            variant="ghost"
            aria-label="上一个产品"
            disabled={!onPrevious}
            onClick={onPrevious}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            aria-label="下一个产品"
            disabled={!onNext}
            onClick={onNext}
          >
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" aria-label="关闭证据侧栏" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>
      <div className="inspector-body">
        <div className="inspector-product">
          <AppIcon name={item.name} src={item.icon} />
          <div>
            <h2>{item.name}</h2>
            <p>
              {marketNames[market]} ·{" "}
              {item.category ? categoryName(item.category) : "产品资料"}
              {item.kind ? ` · ${chartNames[item.kind]}` : ""}
              {item.kind === "grossing" || item.cross ? " · 实验性" : ""}
            </p>
          </div>
        </div>
        {a && (
          <p className="inspector-facts">
            {a.developer} · 下载价格{" "}
            {a.price == null
              ? "未知"
              : a.price === 0
                ? "免费"
                : `${a.currency} ${a.price}`}
          </p>
        )}
        <RankEvidence item={item} />
        <ErrorBox error={detail.error ?? update.error} />
        <div className="inspector-actions">
          <Button
            variant={a?.watch ? "outline" : "default"}
            disabled={!a || update.isPending}
            onClick={() => update.mutate({ watch: !a.watch })}
          >
            <Bookmark size={15} fill={a?.watch ? "currentColor" : "none"} />
            {a?.watch ? "已关注" : "加入观察名单"}
          </Button>
          <Link
            className="btn btn-outline"
            to={`/apps/${id}?market=${market}&returnTo=${encodeURIComponent(returnTo)}`}
          >
            完整档案 <ArrowUpRight size={15} />
          </Link>
        </div>
        {a?.tags && <p className="inspector-tags">研究标签 · {a.tags}</p>}
        <QuickNote key={id} id={id!} latestNote={a?.notes?.[0]} />
        <div className="inspector-bottom">
          <span>笔记和关注跨市场共享</span>
          <Button
            variant="ghost"
            disabled={!a || update.isPending}
            onClick={() => update.mutate({ ignored: !a.ignored })}
          >
            {a?.ignored ? <Check size={14} /> : <EyeOff size={14} />}
            {a?.ignored ? "恢复显示" : "忽略产品"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
