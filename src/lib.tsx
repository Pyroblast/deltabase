import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <button className={cn("btn", `btn-${variant}`, className)} {...props} />
  );
}
export async function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok)
    throw new ApiError(
      json.error ?? `请求失败 ${res.status}`,
      res.status,
      json,
    );
  return json;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, any>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export const time = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(s))
    : "尚未采集";
export const day = (s: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const stale = (s?: string | null) =>
  !s || Date.now() - Date.parse(s) > 36 * 3600000;
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? "Δ"}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function AppIcon({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img
      className="app-icon"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <div className="app-icon icon-fallback">{name.slice(0, 1)}</div>
  );
}
