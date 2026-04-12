/**
 * Bank rows store FinanceSite id only; users think in FinanceProject + client/site.
 * Select values: `p:<projectId>` → PATCH siteId = project.financeSiteId; `s:<siteId>` → direct site.
 */

export type SiteRow = {
  id: string;
  name: string;
  client?: { id: string; name: string } | null;
};

export type FinanceProjectRow = {
  id: string;
  name: string;
  financeSiteId: string | null;
  financeSite?: {
    id: string;
    name: string;
    client?: { id: string; name: string } | null;
  } | null;
};

export function labelForSite(s: SiteRow): string {
  return s.client?.name?.trim() ? `${s.client.name} · ${s.name}` : s.name;
}

export function labelForProject(p: FinanceProjectRow): string {
  const c = p.financeSite?.client?.name?.trim();
  const site = p.financeSite?.name?.trim();
  const parts = [c, site, p.name].filter(Boolean);
  return parts.join(' · ');
}

/** Controlled value for <select> from current site id + project list */
export function encodeProjectSiteValue(
  siteId: string | null | undefined,
  projects: FinanceProjectRow[]
): string {
  if (!siteId) return '';
  const projs = projects.filter((p) => p.financeSiteId === siteId);
  if (projs.length === 1) return `p:${projs[0].id}`;
  return `s:${siteId}`;
}

export function decodeProjectSiteValue(
  raw: string,
  projects: FinanceProjectRow[]
): string | null {
  if (!raw) return null;
  if (raw.startsWith('s:')) return raw.slice(2) || null;
  if (raw.startsWith('p:')) {
    const pid = raw.slice(2);
    const p = projects.find((x) => x.id === pid);
    return p?.financeSiteId ?? null;
  }
  return null;
}

/** Plain label for table/export: client · site, or project line when exactly one project on site, else API site name */
export function displayProjectSiteLabel(
  valueSiteId: string | null | undefined,
  site: { id: string; name: string } | null | undefined,
  sites: SiteRow[],
  projects: FinanceProjectRow[]
): string {
  const sid = valueSiteId ?? site?.id ?? null;
  if (!sid) return '—';
  const fullSite = sites.find((s) => s.id === sid);
  if (fullSite) return labelForSite(fullSite);
  const projs = projects.filter((p) => p.financeSiteId === sid);
  if (projs.length === 1) return labelForProject(projs[0]);
  if (site?.name?.trim()) return site.name.trim();
  return '—';
}

function fallbackLabelForEncodedValue(
  encoded: string,
  projects: FinanceProjectRow[],
  sites: SiteRow[]
): string {
  if (encoded.startsWith('p:')) {
    const id = encoded.slice(2);
    const p = projects.find((x) => x.id === id);
    return p ? labelForProject(p) : `Project (${id.slice(-8)}…)`;
  }
  if (encoded.startsWith('s:')) {
    const id = encoded.slice(2);
    const s = sites.find((x) => x.id === id);
    return s ? labelForSite(s) : `Site (${id.slice(-8)}…)`;
  }
  return encoded;
}

export function ProjectSiteSelect({
  sites,
  projects,
  valueSiteId,
  onPickSiteId,
  disabled,
  className,
}: {
  sites: SiteRow[];
  projects: FinanceProjectRow[];
  valueSiteId: string | null | undefined;
  onPickSiteId: (siteId: string | null) => void;
  disabled?: boolean;
  /** Merged after base select styles */
  className?: string;
}) {
  const projectsWithSite = projects.filter((p) => p.financeSiteId);
  const sortedProjects = [...projectsWithSite].sort((a, b) =>
    labelForProject(a).localeCompare(labelForProject(b))
  );
  const sortedSites = [...sites].sort((a, b) => labelForSite(a).localeCompare(labelForSite(b)));
  const v = encodeProjectSiteValue(valueSiteId ?? null, projects);
  /** Stale site id on row but site removed from finance — keep select value valid */
  const orphanSiteId =
    valueSiteId &&
    v.startsWith('s:') &&
    !sortedSites.some((s) => s.id === valueSiteId)
      ? valueSiteId
      : null;

  const hasOptionForV =
    !v ||
    sortedProjects.some((p) => `p:${p.id}` === v) ||
    sortedSites.some((s) => `s:${s.id}` === v) ||
    (orphanSiteId && v === `s:${orphanSiteId}`);

  return (
    <select
      value={v}
      disabled={disabled}
      aria-label="Project or site"
      onChange={(e) => onPickSiteId(decodeProjectSiteValue(e.target.value, projects))}
      className={`border rounded px-2 py-1 text-xs min-w-[140px] max-w-[220px] disabled:bg-gray-100${className ? ` ${className}` : ''}`}
    >
      <option value="" />
      {sortedProjects.length > 0 && (
        <optgroup label="Projects">
          {sortedProjects.map((p) => (
            <option key={p.id} value={`p:${p.id}`}>
              {labelForProject(p)}
            </option>
          ))}
        </optgroup>
      )}
      {sortedSites.length > 0 && (
        <optgroup label="Sites">
          {sortedSites.map((s) => (
            <option key={s.id} value={`s:${s.id}`}>
              {labelForSite(s)}
            </option>
          ))}
        </optgroup>
      )}
      {orphanSiteId && (
        <optgroup label="Unknown site (re-link)">
          <option value={`s:${orphanSiteId}`}>Site id {orphanSiteId.slice(-8)}…</option>
        </optgroup>
      )}
      {v && !hasOptionForV && (
        <optgroup label="Current (loading or removed)">
          <option value={v}>{fallbackLabelForEncodedValue(v, projects, sites)}</option>
        </optgroup>
      )}
    </select>
  );
}
