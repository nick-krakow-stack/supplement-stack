import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type Party = {
  id: number; type: string; name: string; slug: string; status: 'active' | 'blocked';
  auto_catalog_approval: number; version: number; members_count: number; products_count: number; shares_count: number;
};
type Share = {
  id: number; token: string; entity_type: string; creator_name: string; snapshot_hash: string;
  moderation_status: 'pending' | 'approved' | 'blocked'; is_revoked: number; views: number; imports: number;
};
type MissingCode = { shop_domain_id: number; shop_name: string; domain: string; products_count: number; product_names: string };
type Shop = { id: number; display_name: string; domain: string };
type AffiliateVersion = { id: number; shop_domain_id: number; shop_name: string; version: number; status: string; code: string; link_template: string };
type DefaultShop = { shop_domain_id: number; version: number } | null;
type ProductPick = { ingredient_id: number; ingredient_name: string; product_id: number; product_name: string; version: number };
type ProductOwner = { id: number; name: string; brand: string | null; owner_party_id: number; owner_party_name: string };

export default function AdministratorCreatorSharingPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [missingCodes, setMissingCodes] = useState<MissingCode[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [affiliateVersions, setAffiliateVersions] = useState<AffiliateVersion[]>([]);
  const [defaultShop, setDefaultShop] = useState<DefaultShop>(null);
  const [productPicks, setProductPicks] = useState<ProductPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState({ name: '', slug: '', type: 'creator', owner_user_id: '' });
  const [affiliateForm, setAffiliateForm] = useState({ shop_domain_id: '', code: '', link_template: '{url}?tag={code}', tracking_domain: '' });
  const [defaultShopId, setDefaultShopId] = useState('');
  const [pickForm, setPickForm] = useState({ ingredient_id: '', product_id: '' });
  const [ownerProductId, setOwnerProductId] = useState('');
  const [ownerProduct, setOwnerProduct] = useState<ProductOwner | null>(null);
  const [newOwnerPartyId, setNewOwnerPartyId] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [partyResponse, shareResponse, missingResponse, shopResponse] = await Promise.all([
        apiClient.get<{ parties: Party[] }>('/admin/creator-sharing/parties'),
        apiClient.get<{ shares: Share[] }>('/admin/creator-sharing/shares'),
        apiClient.get<{ shops: MissingCode[] }>('/admin/creator-sharing/missing-platform-codes'),
        apiClient.get<{ shops?: Shop[] }>('/admin/shop-domains'),
      ]);
      setParties(partyResponse.data.parties);
      setShares(shareResponse.data.shares);
      setMissingCodes(missingResponse.data.shops);
      setShops(shopResponse.data.shops ?? []);
      setSelectedPartyId((current) => current ?? partyResponse.data.parties.find((party) => party.type !== 'platform')?.id ?? null);
    } catch (caught: unknown) {
      setError((caught as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Creator-Verwaltung konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
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
      setPartyForm({ name: '', slug: '', type: 'creator', owner_user_id: '' });
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

  const moderate = async (share: Share, status: Share['moderation_status'], isRevoked = share.is_revoked) => {
    try {
      await apiClient.patch(`/admin/creator-sharing/shares/${share.id}`, {
        expected_status: share.moderation_status,
        expected_snapshot_hash: share.snapshot_hash,
        moderation_status: status,
        is_revoked: isRevoked,
      });
      await load();
    } catch (caught) { showError(caught, 'Share konnte nicht moderiert werden.'); }
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
        </div>
        <AdminButton variant="primary" onClick={createParty} disabled={!partyForm.name || !partyForm.slug}>Anlegen</AdminButton>
        <div className="admin-table-wrap" style={{ marginTop: 16 }}><table className="admin-table"><thead><tr><th>Name</th><th>Typ</th><th>Status</th><th>Produkte</th><th>Shares</th><th /></tr></thead><tbody>
          {parties.map((party) => <tr key={party.id}><td>{party.name}<div className="admin-muted">{party.slug}</div></td><td>{party.type}</td><td><AdminBadge tone={party.status === 'active' ? 'ok' : 'danger'}>{party.status}</AdminBadge></td><td>{party.products_count}</td><td>{party.shares_count}</td><td>{party.type !== 'platform' && <AdminButton size="sm" variant={party.status === 'active' ? 'danger' : 'default'} onClick={() => toggleParty(party)}>{party.status === 'active' ? 'Sperren' : 'Aktivieren'}</AdminButton>}</td></tr>)}
        </tbody></table></div>
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

      <AdminCard title="Share-Moderation" subtitle="Freigabe bindet Status und Snapshot-Hash; veränderte Datensätze führen zu einem Konflikt." padded>
        {shares.length === 0 ? <AdminEmpty>Keine Creator-Shares vorhanden.</AdminEmpty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Creator</th><th>Typ</th><th>Status</th><th>Aufrufe / Importe</th><th>Aktionen</th></tr></thead><tbody>{shares.map((share) => <tr key={share.id}><td>{share.creator_name}</td><td>{share.entity_type === 'stack' ? 'Stack' : 'Einzelempfehlung'}</td><td><AdminBadge tone={share.moderation_status === 'approved' && !share.is_revoked ? 'ok' : share.moderation_status === 'blocked' || share.is_revoked ? 'danger' : 'warn'}>{share.is_revoked ? 'widerrufen' : share.moderation_status}</AdminBadge></td><td>{share.views} / {share.imports}</td><td><div className="flex gap-2"><AdminButton size="sm" onClick={() => moderate(share, 'approved', 0)}>Freigeben</AdminButton><AdminButton size="sm" variant="danger" onClick={() => moderate(share, 'blocked', 1)}>Sperren</AdminButton></div></td></tr>)}</tbody></table></div>}
      </AdminCard>

      <AdminCard title="Plattform-Code fehlt" subtitle="Aktive sichere Basisziele ohne aktuell gültige Plattform-Affiliate-Version." padded>
        {missingCodes.length === 0 ? <AdminEmpty>Für alle aktiven Basisziele ist ein Plattform-Code vorhanden.</AdminEmpty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Shop</th><th>Betroffene Produkte</th><th>Produkte</th></tr></thead><tbody>{missingCodes.map((row) => <tr key={row.shop_domain_id}><td>{row.shop_name}<div className="admin-muted">{row.domain}</div></td><td>{row.products_count}</td><td>{row.product_names}</td></tr>)}</tbody></table></div>}
      </AdminCard>
    </div>
  );
}
