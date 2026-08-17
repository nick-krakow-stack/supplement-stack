import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type Party = {
  id: number; type: string; name: string; slug: string; status: 'active' | 'blocked';
  auto_catalog_approval: number; public_profile_image_url: string | null; version: number;
  members_count: number; products_count: number; shares_count: number;
};
type Share = {
  id: number; token: string; entity_type: string; creator_name: string; snapshot_hash: string;
  title?: string | null;
  moderation_status: 'pending' | 'approved' | 'blocked';
  moderation_reason: string | null;
  moderation_target: ModerationTarget | null;
  moderation_item_index: number | null;
  is_revoked: number;
  version: number;
  paused_at: number | null;
  expires_at: number | null;
  archived_at: number | null;
  supersedes_share_link_id: number | null;
};
type ModerationTarget = 'general' | 'title' | 'creator_statement' | 'product';
type ModerationDraft = { reason: string; target: ModerationTarget; itemNumber: string };
type MissingCode = { shop_domain_id: number; shop_name: string; domain: string; products_count: number; product_names: string };
type Shop = { id: number; display_name: string; domain: string };
type AffiliateVersion = { id: number; shop_domain_id: number; shop_name: string; version: number; status: string; code: string; link_template: string };
type DefaultShop = { shop_domain_id: number; version: number } | null;
type ProductPick = { ingredient_id: number; ingredient_name: string; product_id: number; product_name: string; version: number };
type ProductOwner = { id: number; name: string; brand: string | null; owner_party_id: number; owner_party_name: string };
type ShareReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
type ShareReport = {
  id: number; share_link_id: number; category: 'outdated' | 'misleading' | 'safety' | 'other';
  details: string | null; status: ShareReportStatus; version: number; created_at: string;
  reviewed_at: string | null; resolution_note: string | null; token: string;
  entity_type: string; share_title: string | null; creator_name: string;
};

const moderationTargetLabels: Record<ModerationTarget, string> = {
  general: 'Gesamte Empfehlung',
  title: 'Titel',
  creator_statement: 'Persönlicher Text',
  product: 'Produkt',
};

const reportCategoryLabels: Record<ShareReport['category'], string> = {
  outdated: 'Nicht mehr aktuell',
  misleading: 'Missverständlich',
  safety: 'Möglicherweise unsicher',
  other: 'Anderer Grund',
};

function moderationStatusLabel(share: Share) {
  if (share.moderation_status === 'blocked') return 'Abgelehnt';
  if (share.is_revoked) return 'Beendet';
  if (share.moderation_status === 'pending') return 'Wartet auf Prüfung';
  if (share.paused_at !== null) return 'Pausiert';
  return 'Freigegeben';
}

function moderationStatusTone(share: Share): 'neutral' | 'ok' | 'warn' | 'danger' {
  if (share.moderation_status === 'blocked' || share.is_revoked) return 'danger';
  if (share.moderation_status === 'pending') return 'warn';
  if (share.paused_at !== null) return 'neutral';
  return 'ok';
}

export default function AdministratorCreatorSharingPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [reports, setReports] = useState<ShareReport[]>([]);
  const [missingCodes, setMissingCodes] = useState<MissingCode[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [affiliateVersions, setAffiliateVersions] = useState<AffiliateVersion[]>([]);
  const [defaultShop, setDefaultShop] = useState<DefaultShop>(null);
  const [productPicks, setProductPicks] = useState<ProductPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState({ name: '', slug: '', type: 'creator', owner_user_id: '', public_profile_image_url: '' });
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [affiliateForm, setAffiliateForm] = useState({ shop_domain_id: '', code: '', link_template: '{url}?tag={code}', tracking_domain: '' });
  const [defaultShopId, setDefaultShopId] = useState('');
  const [pickForm, setPickForm] = useState({ ingredient_id: '', product_id: '' });
  const [ownerProductId, setOwnerProductId] = useState('');
  const [ownerProduct, setOwnerProduct] = useState<ProductOwner | null>(null);
  const [newOwnerPartyId, setNewOwnerPartyId] = useState('');
  const [moderationDrafts, setModerationDrafts] = useState<Record<number, ModerationDraft>>({});
  const [moderatingShareId, setModeratingShareId] = useState<number | null>(null);
  const [moderatingReportId, setModeratingReportId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [partyResponse, shareResponse, reportResponse, missingResponse, shopResponse] = await Promise.all([
        apiClient.get<{ parties: Party[] }>('/admin/creator-sharing/parties'),
        apiClient.get<{ shares: Share[] }>('/admin/creator-sharing/shares'),
        apiClient.get<{ reports: ShareReport[] }>('/admin/creator-sharing/reports?status=open'),
        apiClient.get<{ shops: MissingCode[] }>('/admin/creator-sharing/missing-platform-codes'),
        apiClient.get<{ shops?: Shop[] }>('/admin/shop-domains'),
      ]);
      setParties(partyResponse.data.parties);
      setShares(shareResponse.data.shares);
      setReports(reportResponse.data.reports);
      setMissingCodes(missingResponse.data.shops);
      setShops(shopResponse.data.shops ?? []);
      setSelectedPartyId((current) => current ?? partyResponse.data.parties.find((party) => party.type !== 'platform')?.id ?? null);
    } catch (caught: unknown) {
      setError((caught as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Creator-Verwaltung konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const selected = parties.find((party) => party.id === selectedPartyId);
    setProfileImageUrl(selected?.public_profile_image_url ?? '');
  }, [parties, selectedPartyId]);
  useEffect(() => {
    if (!selectedPartyId) { setAffiliateVersions([]); return; }
    apiClient.get<{ affiliate_versions: AffiliateVersion[]; default_shop: DefaultShop; product_picks: ProductPick[] }>(`/admin/creator-sharing/parties/${selectedPartyId}/settings`)
      .then((response) => {
        setAffiliateVersions(response.data.affiliate_versions);
        setDefaultShop(response.data.default_shop);
        setDefaultShopId(response.data.default_shop ? String(response.data.default_shop.shop_domain_id) : '');
        setProductPicks(response.data.product_picks);
      })
      .catch(() => { setAffiliateVersions([]); setDefaultShop(null); setProductPicks([]); });
  }, [selectedPartyId]);

  const showError = (caught: unknown, fallback: string) => {
    setError((caught as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback);
  };

  const createParty = async () => {
    setError(null); setNotice(null);
    try {
      await apiClient.post('/admin/creator-sharing/parties', {
        ...partyForm,
        owner_user_id: partyForm.owner_user_id ? Number(partyForm.owner_user_id) : null,
      });
      setPartyForm({ name: '', slug: '', type: 'creator', owner_user_id: '', public_profile_image_url: '' });
      setNotice('Creator-/Markenpartei wurde angelegt.');
      await load();
    } catch (caught) { showError(caught, 'Partei konnte nicht angelegt werden.'); }
  };

  const toggleParty = async (party: Party) => {
    try {
      await apiClient.patch(`/admin/creator-sharing/parties/${party.id}`, {
        expected_version: party.version,
        status: party.status === 'active' ? 'blocked' : 'active',
      });
      await load();
    } catch (caught) { showError(caught, 'Status konnte nicht geändert werden.'); }
  };

  const saveProfileImage = async () => {
    const party = parties.find((entry) => entry.id === selectedPartyId);
    if (!party) return;
    setError(null); setNotice(null);
    try {
      await apiClient.patch(`/admin/creator-sharing/parties/${party.id}`, {
        expected_version: party.version,
        public_profile_image_url: profileImageUrl.trim() || null,
      });
      setNotice(profileImageUrl.trim()
        ? 'Das freiwillige öffentliche Profilbild wurde gespeichert.'
        : 'Das öffentliche Profilbild wurde entfernt.');
      await load();
    } catch (caught) { showError(caught, 'Das Profilbild konnte nicht gespeichert werden.'); }
  };

  const moderateReport = async (report: ShareReport, status: Exclude<ShareReportStatus, 'pending'>) => {
    setError(null); setNotice(null); setModeratingReportId(report.id);
    try {
      await apiClient.patch(`/admin/creator-sharing/reports/${report.id}`, {
        expected_version: report.version,
        expected_status: report.status,
        status,
      });
      setNotice(status === 'reviewed'
        ? 'Die Meldung ist als geprüft markiert.'
        : status === 'resolved'
          ? 'Die Meldung ist erledigt.'
          : 'Die Meldung wurde verworfen.');
      await load();
    } catch (caught: unknown) {
      if ((caught as { response?: { status?: number } })?.response?.status === 409) {
        await load();
        setError('Diese Meldung wurde zwischenzeitlich bearbeitet. Die Liste wurde neu geladen.');
      } else {
        showError(caught, 'Die Meldung konnte nicht bearbeitet werden.');
      }
    } finally {
      setModeratingReportId(null);
    }
  };

  const moderationDraft = (share: Share): ModerationDraft => moderationDrafts[share.id] ?? {
    reason: share.moderation_reason ?? '',
    target: share.moderation_target ?? 'general',
    itemNumber: share.moderation_item_index === null ? '' : String(share.moderation_item_index + 1),
  };

  const updateModerationDraft = (share: Share, change: Partial<ModerationDraft>) => {
    setModerationDrafts((current) => {
      const currentDraft = current[share.id] ?? {
        reason: share.moderation_reason ?? '',
        target: share.moderation_target ?? 'general',
        itemNumber: share.moderation_item_index === null ? '' : String(share.moderation_item_index + 1),
      };
      return { ...current, [share.id]: { ...currentDraft, ...change } };
    });
  };

  const moderate = async (share: Share, status: Extract<Share['moderation_status'], 'approved' | 'blocked'>) => {
    const draft = moderationDraft(share);
    const reason = draft.reason.trim();
    const needsItemNumber = draft.target === 'creator_statement' || draft.target === 'product';
    const itemNumber = Number(draft.itemNumber);

    if (status === 'blocked' && !reason) {
      setError('Bitte erkläre kurz und verständlich, was der Creator ändern soll.');
      return;
    }
    if (status === 'blocked' && needsItemNumber && (!Number.isInteger(itemNumber) || itemNumber < 1)) {
      setError('Bitte gib an, welcher Eintrag geändert werden soll. Die Zählung beginnt bei 1.');
      return;
    }

    setError(null);
    setNotice(null);
    setModeratingShareId(share.id);
    try {
      await apiClient.patch(`/admin/creator-sharing/shares/${share.id}`, {
        expected_version: share.version,
        expected_snapshot_hash: share.snapshot_hash,
        expected_moderation_status: share.moderation_status,
        expected_is_revoked: share.is_revoked,
        expected_paused_at: share.paused_at,
        expected_expires_at: share.expires_at,
        expected_archived_at: share.archived_at,
        moderation_status: status,
        moderation_reason: status === 'blocked' ? reason : null,
        moderation_target: status === 'blocked' ? draft.target : null,
        moderation_item_index: status === 'blocked' && needsItemNumber ? itemNumber - 1 : null,
      });
      setModerationDrafts((current) => {
        const next = { ...current };
        delete next[share.id];
        return next;
      });
      setNotice(status === 'approved'
        ? 'Die Empfehlung wurde freigegeben.'
        : 'Die Empfehlung wurde abgelehnt. Der Creator erhält die Rückmeldung.');
      await load();
    } catch (caught) {
      const responseStatus = (caught as { response?: { status?: number } })?.response?.status;
      if (responseStatus === 409) {
        await load();
        setError('Diese Empfehlung wurde zwischenzeitlich geändert. Die Liste wurde neu geladen. Bitte prüfe den aktuellen Stand.');
      } else {
        setError('Die Empfehlung konnte nicht geprüft werden. Bitte versuche es erneut.');
      }
    } finally {
      setModeratingShareId(null);
    }
  };

  const createAffiliateVersion = async () => {
    if (!selectedPartyId) return;
    const shopId = Number(affiliateForm.shop_domain_id);
    const current = affiliateVersions.find((version) => version.shop_domain_id === shopId && version.status === 'current');
    try {
      await apiClient.post(`/admin/creator-sharing/parties/${selectedPartyId}/affiliate-versions`, {
        shop_domain_id: shopId,
        code: affiliateForm.code,
        link_template: affiliateForm.link_template,
        tracking_domain: affiliateForm.tracking_domain || null,
        expected_current_id: current?.id ?? null,
      });
      setAffiliateForm((form) => ({ ...form, code: '' }));
      const response = await apiClient.get<{ affiliate_versions: AffiliateVersion[] }>(`/admin/creator-sharing/parties/${selectedPartyId}/settings`);
      setAffiliateVersions(response.data.affiliate_versions);
      setNotice('Neue Affiliate-Version ist aktiv; die vorherige Version bleibt historisch erhalten.');
    } catch (caught) { showError(caught, 'Affiliate-Version konnte nicht angelegt werden.'); }
  };

  const saveDefaultShop = async () => {
    if (!selectedPartyId || !defaultShopId) return;
    try {
      const response = await apiClient.put<{ default_shop: Exclude<DefaultShop, null> }>(`/admin/creator-sharing/parties/${selectedPartyId}/default-shop`, {
        shop_domain_id: Number(defaultShopId), expected_version: defaultShop?.version ?? null,
      });
      setDefaultShop(response.data.default_shop);
      setNotice('Standard-Shop gespeichert.');
    } catch (caught) { showError(caught, 'Standard-Shop konnte nicht gespeichert werden.'); }
  };

  const saveProductPick = async () => {
    if (!selectedPartyId || !pickForm.ingredient_id || !pickForm.product_id) return;
    const ingredientId = Number(pickForm.ingredient_id);
    const existing = productPicks.find((pick) => pick.ingredient_id === ingredientId);
    try {
      await apiClient.put(`/admin/creator-sharing/parties/${selectedPartyId}/product-picks/${ingredientId}`, {
        product_id: Number(pickForm.product_id), expected_version: existing?.version ?? null,
      });
      const response = await apiClient.get<{ affiliate_versions: AffiliateVersion[]; default_shop: DefaultShop; product_picks: ProductPick[] }>(`/admin/creator-sharing/parties/${selectedPartyId}/settings`);
      setProductPicks(response.data.product_picks);
      setPickForm({ ingredient_id: '', product_id: '' });
      setNotice('Bevorzugtes Produkt gespeichert.');
    } catch (caught) { showError(caught, 'Produkt-Pick konnte nicht gespeichert werden.'); }
  };

  const loadProductOwner = async () => {
    try {
      const response = await apiClient.get<{ product: ProductOwner }>(`/admin/creator-sharing/products/${Number(ownerProductId)}/owner`);
      setOwnerProduct(response.data.product);
      setNewOwnerPartyId(String(response.data.product.owner_party_id));
    } catch (caught) { setOwnerProduct(null); showError(caught, 'Produkt wurde nicht gefunden.'); }
  };

  const saveProductOwner = async () => {
    if (!ownerProduct || !newOwnerPartyId) return;
    try {
      await apiClient.patch(`/admin/creator-sharing/products/${ownerProduct.id}/owner`, {
        party_id: Number(newOwnerPartyId), expected_owner_party_id: ownerProduct.owner_party_id,
      });
      setNotice('Produkteigentümer wurde aktualisiert.');
      await loadProductOwner();
      await load();
    } catch (caught) { showError(caught, 'Produkteigentümer konnte nicht geändert werden.'); }
  };

  return (
    <div className="admin-page-stack">
      <AdminPageHeader title="Creator-Stack-Sharing" subtitle="Parteien, versionierte Affiliate-Konfiguration und Share-Moderation. Die öffentliche Funktion bleibt separat feature-gesteuert." />
      {error && <AdminError>{error}</AdminError>}
      {notice && <div className="admin-success">{notice}</div>}

      <AdminCard title="Creator und Marken" subtitle="Onboarding erfolgt ausschließlich administrativ." padded>
        <div className="admin-form-grid">
          <label>Name<input value={partyForm.name} onChange={(event) => setPartyForm((form) => ({ ...form, name: event.target.value }))} /></label>
          <label>Öffentlicher Kurzname<input value={partyForm.slug} onChange={(event) => setPartyForm((form) => ({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} /></label>
          <label>Typ<select value={partyForm.type} onChange={(event) => setPartyForm((form) => ({ ...form, type: event.target.value }))}><option value="creator">Creator</option><option value="brand">Marke</option></select></label>
          <label>Kontoinhaber (Benutzer-ID, optional)<input type="number" min="1" value={partyForm.owner_user_id} onChange={(event) => setPartyForm((form) => ({ ...form, owner_user_id: event.target.value }))} /></label>
          <label>Freiwilliges öffentliches Profilbild (optional)<input type="url" placeholder="https://… oder /api/r2/…" value={partyForm.public_profile_image_url} onChange={(event) => setPartyForm((form) => ({ ...form, public_profile_image_url: event.target.value }))} /></label>
        </div>
        <AdminButton variant="primary" onClick={createParty} disabled={!partyForm.name || !partyForm.slug}>Anlegen</AdminButton>
        <div className="admin-table-wrap" style={{ marginTop: 16 }}><table className="admin-table"><thead><tr><th>Name</th><th>Typ</th><th>Status</th><th>Produkte</th><th>Shares</th><th /></tr></thead><tbody>
          {parties.map((party) => <tr key={party.id}><td>{party.name}<div className="admin-muted">{party.slug}</div></td><td>{party.type}</td><td><AdminBadge tone={party.status === 'active' ? 'ok' : 'danger'}>{party.status}</AdminBadge></td><td>{party.products_count}</td><td>{party.shares_count}</td><td>{party.type !== 'platform' && <AdminButton size="sm" variant={party.status === 'active' ? 'danger' : 'default'} onClick={() => toggleParty(party)}>{party.status === 'active' ? 'Sperren' : 'Aktivieren'}</AdminButton>}</td></tr>)}
        </tbody></table></div>
        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Öffentliches Profilbild verwalten</h3>
          <p className="admin-muted mt-1">Das Bild erscheint nur, wenn es hier freiwillig hinterlegt wurde. Ohne URL zeigt die öffentliche Empfehlung kein Profilbild und erfindet keinen Ersatz.</p>
          <div className="admin-form-grid mt-3">
            <label>Creator oder Marke<select value={selectedPartyId ?? ''} onChange={(event) => setSelectedPartyId(Number(event.target.value))}>{parties.filter((party) => party.type !== 'platform').map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
            <label>Sichere Bild-URL<input type="url" placeholder="https://… oder /api/r2/…" value={profileImageUrl} onChange={(event) => setProfileImageUrl(event.target.value)} /></label>
            {profileImageUrl.trim() && <img src={profileImageUrl.trim()} alt="Vorschau des öffentlichen Profilbilds" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton variant="primary" onClick={saveProfileImage} disabled={!selectedPartyId}>Profilbild speichern</AdminButton>
            <AdminButton onClick={() => setProfileImageUrl('')} disabled={!profileImageUrl}>Feld leeren</AdminButton>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Affiliate-Versionen" subtitle="Codes werden nie überschrieben; jede Änderung erzeugt eine neue Version." padded>
        <div className="admin-form-grid">
          <label>Partei<select value={selectedPartyId ?? ''} onChange={(event) => setSelectedPartyId(Number(event.target.value))}>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
          <label>Shop<select value={affiliateForm.shop_domain_id} onChange={(event) => setAffiliateForm((form) => ({ ...form, shop_domain_id: event.target.value }))}><option value="">Auswählen</option>{shops.map((shop) => <option value={shop.id} key={shop.id}>{shop.display_name} · {shop.domain}</option>)}</select></label>
          <label>Affiliate-Code<input value={affiliateForm.code} onChange={(event) => setAffiliateForm((form) => ({ ...form, code: event.target.value }))} /></label>
          <label>Link-Template<input value={affiliateForm.link_template} onChange={(event) => setAffiliateForm((form) => ({ ...form, link_template: event.target.value }))} /></label>
          <label>Externe Tracking-Domain (optional)<input value={affiliateForm.tracking_domain} onChange={(event) => setAffiliateForm((form) => ({ ...form, tracking_domain: event.target.value }))} /></label>
        </div>
        <AdminButton variant="primary" onClick={createAffiliateVersion} disabled={!selectedPartyId || !affiliateForm.shop_domain_id || !affiliateForm.code || !affiliateForm.link_template}>Neue Version aktivieren</AdminButton>
        {affiliateVersions.length === 0 ? <AdminEmpty>Noch keine Affiliate-Versionen.</AdminEmpty> : <div className="admin-table-wrap" style={{ marginTop: 16 }}><table className="admin-table"><thead><tr><th>Shop</th><th>Version</th><th>Status</th><th>Code</th></tr></thead><tbody>{affiliateVersions.map((version) => <tr key={version.id}><td>{version.shop_name}</td><td>v{version.version}</td><td><AdminBadge tone={version.status === 'current' ? 'ok' : 'neutral'}>{version.status}</AdminBadge></td><td>{version.code}</td></tr>)}</tbody></table></div>}
      </AdminCard>

      <AdminCard title="Creator-Auswahl" subtitle="Standard-Shop und wirkstoffbezogene Produkt-Picks steuern nur die Auswahl; Attribution bleibt getrennt versioniert." padded>
        <div className="admin-form-grid">
          <label>Standard-Shop
            <select value={defaultShopId} onChange={(event) => setDefaultShopId(event.target.value)}>
              <option value="">Auswählen</option>
              {shops.map((shop) => <option value={shop.id} key={shop.id}>{shop.display_name} · {shop.domain}</option>)}
            </select>
          </label>
          <div className="self-end"><AdminButton onClick={saveDefaultShop} disabled={!selectedPartyId || !defaultShopId}>Standard-Shop speichern</AdminButton></div>
          <label>Wirkstoff-ID<input type="number" min="1" value={pickForm.ingredient_id} onChange={(event) => setPickForm((form) => ({ ...form, ingredient_id: event.target.value }))} /></label>
          <label>Katalogprodukt-ID<input type="number" min="1" value={pickForm.product_id} onChange={(event) => setPickForm((form) => ({ ...form, product_id: event.target.value }))} /></label>
        </div>
        <AdminButton onClick={saveProductPick} disabled={!selectedPartyId || !pickForm.ingredient_id || !pickForm.product_id}>Produkt-Pick speichern</AdminButton>
        {productPicks.length > 0 && <div className="admin-table-wrap" style={{ marginTop: 16 }}><table className="admin-table"><thead><tr><th>Wirkstoff</th><th>Produkt</th><th>Version</th></tr></thead><tbody>{productPicks.map((pick) => <tr key={pick.ingredient_id}><td>{pick.ingredient_name}</td><td>{pick.product_name}</td><td>v{pick.version}</td></tr>)}</tbody></table></div>}
      </AdminCard>

      <AdminCard title="Produkteigentümer" subtitle="Katalogprodukte bleiben dieselben Datensätze; hier wird ausschließlich ihre verantwortliche Partei geändert." padded>
        <div className="admin-form-grid">
          <label>Produkt-ID<input type="number" min="1" value={ownerProductId} onChange={(event) => setOwnerProductId(event.target.value)} /></label>
          <div className="self-end"><AdminButton onClick={loadProductOwner} disabled={!ownerProductId}>Produkt laden</AdminButton></div>
          {ownerProduct && <>
            <div><strong>{ownerProduct.name}</strong><div className="admin-muted">Aktuell: {ownerProduct.owner_party_name}</div></div>
            <label>Neue Partei<select value={newOwnerPartyId} onChange={(event) => setNewOwnerPartyId(event.target.value)}>{parties.filter((party) => party.status === 'active').map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
          </>}
        </div>
        {ownerProduct && <AdminButton onClick={saveProductOwner} disabled={!newOwnerPartyId || Number(newOwnerPartyId) === ownerProduct.owner_party_id}>Eigentümer ändern</AdminButton>}
      </AdminCard>

      <AdminCard title="Gemeldete Empfehlungen" subtitle="Öffentliche Meldungen enthalten nur den gewählten Grund und einen optionalen kurzen Hinweis. Prüfen, erledigen oder nachvollziehbar verwerfen." padded>
        {reports.length === 0 ? <AdminEmpty>Keine offenen Meldungen.</AdminEmpty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Empfehlung</th><th>Meldung</th><th>Status</th><th>Bearbeiten</th></tr></thead><tbody>
          {reports.map((report) => {
            const busy = moderatingReportId === report.id;
            return <tr key={report.id}>
              <td>
                <strong>{report.share_title || 'Geteilte Empfehlung'}</strong>
                <div className="admin-muted">von {report.creator_name} · Share #{report.share_link_id}</div>
                <a className="font-semibold text-indigo-700 underline" href={`/share/${report.token}`} target="_blank" rel="noreferrer">Öffentliche Ansicht öffnen</a>
              </td>
              <td>
                <strong>{reportCategoryLabels[report.category]}</strong>
                <div className="mt-1">{report.details || <span className="admin-muted">Kein zusätzlicher Hinweis</span>}</div>
                <div className="admin-muted mt-1">Eingegangen: {new Date(report.created_at).toLocaleString('de-DE')}</div>
              </td>
              <td><AdminBadge tone={report.status === 'pending' ? 'warn' : 'neutral'}>{report.status === 'pending' ? 'Offen' : 'Geprüft'}</AdminBadge></td>
              <td>
                <div className="flex flex-wrap gap-2">
                  {report.status === 'pending' && <AdminButton size="sm" onClick={() => void moderateReport(report, 'reviewed')} disabled={busy}>Als geprüft markieren</AdminButton>}
                  <AdminButton size="sm" variant="primary" onClick={() => void moderateReport(report, 'resolved')} disabled={busy}>Erledigt</AdminButton>
                  <AdminButton size="sm" variant="danger" onClick={() => void moderateReport(report, 'dismissed')} disabled={busy}>Verwerfen</AdminButton>
                </div>
              </td>
            </tr>;
          })}
        </tbody></table></div>}
      </AdminCard>

      <AdminCard title="Empfehlungen prüfen" subtitle="Freigeben oder mit einer klaren Rückmeldung ablehnen. Eine Ablehnung macht den Link vorläufig nicht öffentlich; der Creator kann die Empfehlung korrigieren." padded>
        {shares.length === 0 ? <AdminEmpty>Keine Creator-Empfehlungen vorhanden.</AdminEmpty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Creator</th><th>Empfehlung</th><th>Status</th><th>Rückmeldung</th><th>Prüfung</th></tr></thead><tbody>{shares.map((share) => {
          const draft = moderationDraft(share);
          const needsItemNumber = draft.target === 'creator_statement' || draft.target === 'product';
          const isBusy = moderatingShareId === share.id;
          const cannotBlock = !draft.reason.trim()
            || (needsItemNumber && (!Number.isInteger(Number(draft.itemNumber)) || Number(draft.itemNumber) < 1));

          return <tr key={share.id}>
            <td>
              <strong>{share.creator_name}</strong>
              <div className="admin-muted">Empfehlung #{share.id} · Stand {share.version}</div>
              {share.supersedes_share_link_id !== null && <div className="admin-muted">Korrektur von #{share.supersedes_share_link_id}</div>}
            </td>
            <td>
              <strong>{share.title || (share.entity_type === 'stack' ? 'Stack' : 'Einzelempfehlung')}</strong>
              <div className="admin-muted">{share.entity_type === 'stack' ? 'Ganzer Stack' : 'Ein einzelner Eintrag'}</div>
            </td>
            <td>
              <AdminBadge tone={moderationStatusTone(share)}>{moderationStatusLabel(share)}</AdminBadge>
              {share.archived_at !== null && <div className="mt-1"><AdminBadge tone="neutral">Archiviert</AdminBadge></div>}
            </td>
            <td className="min-w-[220px]">
              {share.moderation_reason ? <>
                <div>{share.moderation_reason}</div>
                <div className="admin-muted mt-1">
                  Betrifft: {moderationTargetLabels[share.moderation_target ?? 'general']}
                  {share.moderation_item_index !== null ? `, Eintrag ${share.moderation_item_index + 1}` : ''}
                </div>
              </> : <span className="admin-muted">Noch keine Rückmeldung</span>}
            </td>
            <td className="min-w-[360px]">
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
                  Was muss geändert werden? (Pflicht bei Ablehnung)
                  <textarea
                    aria-label={`Grund für die Ablehnung von ${share.creator_name}`}
                    className="admin-input min-h-[72px]"
                    maxLength={1000}
                    placeholder="Zum Beispiel: Bitte formuliere den persönlichen Text sachlicher."
                    value={draft.reason}
                    onChange={(event) => updateModerationDraft(share, { reason: event.target.value })}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
                    Welcher Bereich?
                    <select
                      aria-label={`Betroffener Bereich von ${share.creator_name}`}
                      className="admin-select"
                      value={draft.target}
                      onChange={(event) => updateModerationDraft(share, { target: event.target.value as ModerationTarget, itemNumber: '' })}
                    >
                      {Object.entries(moderationTargetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  {needsItemNumber && <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
                    Welcher Eintrag?
                    <input
                      aria-label={`Nummer des betroffenen Eintrags von ${share.creator_name}`}
                      className="admin-input"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Nummer ab 1"
                      value={draft.itemNumber}
                      onChange={(event) => updateModerationDraft(share, { itemNumber: event.target.value })}
                    />
                  </label>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton size="sm" onClick={() => void moderate(share, 'approved')} disabled={isBusy || share.is_revoked === 1 || share.moderation_status === 'approved'}>Freigeben</AdminButton>
                  <AdminButton size="sm" variant="danger" onClick={() => void moderate(share, 'blocked')} disabled={isBusy || share.is_revoked === 1 || cannotBlock}>Mit Rückmeldung ablehnen</AdminButton>
                </div>
                {share.is_revoked === 1 && <div className="admin-muted">Vom Creator beendet – keine weitere Prüfung möglich.</div>}
              </div>
            </td>
          </tr>;
        })}</tbody></table></div>}
      </AdminCard>

      <AdminCard title="Plattform-Code fehlt" subtitle="Aktive sichere Basisziele ohne aktuell gültige Plattform-Affiliate-Version." padded>
        {missingCodes.length === 0 ? <AdminEmpty>Für alle aktiven Basisziele ist ein Plattform-Code vorhanden.</AdminEmpty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shop</th><th>Betroffene Produkte</th><th>Produkte</th></tr></thead><tbody>{missingCodes.map((row) => <tr key={row.shop_domain_id}><td>{row.shop_name}<div className="admin-muted">{row.domain}</div></td><td>{row.products_count}</td><td>{row.product_names}</td></tr>)}</tbody></table></div>}
      </AdminCard>
    </div>
  );
}
