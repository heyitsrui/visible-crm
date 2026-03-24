import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { sendNotification, sendNotificationToRoles, getSocket } from '../utils/notifService';
import '../styles/bom.css';

const API_BASE_URL = process.env.REACT_APP_API_IP;

const VENDOR_REGISTRY = {
  ruijie: {
    label: 'Ruijie',
    logoUrl: 'https://www.almacctv.com/web/wp-content/uploads/2020/11/ruijie-logo.png',
    logoFallback: 'RJ', color: '#2563eb', bgColor: '#eff6ff', available: true,
  },
  sundray: {
    label: 'Sundray',
    logoUrl: 'https://www.cstc.com.ph/images/sundray.png',
    logoFallback: 'SD', color: '#2563eb', bgColor: '#eff6ff', available: true,
  },
  hikvision: {
    label: 'Hikvision',
    logoUrl: 'https://www.hikvision.com/favicon.ico',
    logoFallback: 'HV', color: '#2563eb', bgColor: '#eff6ff', available: true,
  },
  zkteco: {
    label: 'Zkteco',
    logoUrl: 'https://zkteco.technology/calculator/images/pngwing.com.png',
    logoFallback: 'ZT', color: '#2563eb', bgColor: '#eff6ff', available: true,
  },
  sophos: {
    label: 'Sophos',
    logoUrl: 'https://www.sophos.com/favicon.ico',
    logoFallback: 'SP', color: '#0066cc', bgColor: '#e8f4ff', available: true,
  },
};

const CAT_BADGE_COLOR = {
  'Router': 'blue', 'Switch': 'purple', 'Wireless / AP': 'green',
  'Access Controller': 'teal', 'Firewall / Security': 'rose',
  'Switch Accessory': 'orange', 'Software': 'gray',
  'Endpoint Protection': 'rose', 'Network Security': 'blue',
  'Email Security': 'purple', 'Cloud Security': 'teal',
  'Server Protection': 'orange', 'Encryption': 'gray',
};

const SEGMENT_COLORS = {
  'Enterprise': { bg: '#dbeafe', text: '#1d4ed8' },
  'SME': { bg: '#dcfce7', text: '#16a34a' },
  'Data Center': { bg: '#f3e8ff', text: '#7c3aed' },
  'Enterprise / Data Center': { bg: '#fef3c7', text: '#d97706' },
  'SME / Enterprise': { bg: '#fce7f3', text: '#be185d' },
  'Enterprise/SME': { bg: '#fce7f3', text: '#be185d' },
};

let _nextId = 1;
const uid = () => _nextId++;

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatPeso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDollar = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ children, color = 'blue' }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

function SegmentTag({ segment }) {
  const style = SEGMENT_COLORS[segment] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{ background: style.bg, color: style.text, fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
      {segment}
    </span>
  );
}

function MarketPriceTag({ price }) {
  if (!price || parseFloat(price) === 0) return null;
  return (
    <span style={{
      fontSize: 10, background: '#fef9c3', color: '#854d0e',
      padding: '2px 7px', borderRadius: 10, fontWeight: 700,
      border: '1px solid #fde68a', whiteSpace: 'nowrap',
    }}>
      🏷 {formatDollar(price)}
    </span>
  );
}

function VendorLogo({ vendor }) {
  const [imgError, setImgError] = useState(false);
  const v = VENDOR_REGISTRY[vendor];
  if (!v) return null;
  if (!imgError) {
    return <img src={v.logoUrl} alt={v.label} onError={() => setImgError(true)}
      style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />;
  }
  return <span style={{ background: v.color, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '4px 6px' }}>{v.logoFallback}</span>;
}

function VendorCard({ vendorKey, vendor, active, onClick }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button className={`vendor-card${active ? ' active' : ''}${!vendor.available ? ' unavailable' : ''}`}
      onClick={() => vendor.available && onClick(vendorKey)}
      style={{ '--vendor-color': vendor.color, '--vendor-bg': vendor.bgColor }}>
      <div className="vendor-card-logo">
        {!imgError ? <img src={vendor.logoUrl} alt={vendor.label} onError={() => setImgError(true)} style={{ width: 36, height: 36, objectFit: 'contain' }} />
          : <span style={{ background: vendor.color, color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 6, padding: '6px 8px' }}>{vendor.logoFallback}</span>}
      </div>
      <span className="vendor-label">{vendor.label}</span>
      {!vendor.available && <span className="vendor-soon">Coming Soon</span>}
      {active && <span className="vendor-check">✓</span>}
    </button>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <div className="product-card">
      <div className="product-card-header">
        <span className="product-card-model">{product.model}</span>
        <Badge color={CAT_BADGE_COLOR[product.product_category] || 'blue'}>{product.product_category}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        <SegmentTag segment={product.segment} />
        {product.poe && product.poe !== 'Non-PoE' && product.poe !== 'N/A' && (
          <span style={{ fontSize: 10, background: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>{product.poe}</span>
        )}
        {product.wireless_standard && product.wireless_standard !== '-' && (
          <span style={{ fontSize: 10, background: '#ede9fe', color: '#5b21b6', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>{product.wireless_standard}</span>
        )}
        <MarketPriceTag price={product.market_price} />
      </div>
      <span className="product-card-sub" style={{ marginTop: 6, display: 'block', fontSize: 12, color: '#6b7280' }}>{product.sub_category}</span>
      <div className="product-card-actions">
        <button className="product-card-add-btn" onClick={() => onAdd(product)}>+ Add to BOM</button>
      </div>
    </div>
  );
}

function BomLineItem({ item, onQtyChange, onRemove }) {
  const lineMarket = item.market_price ? parseFloat(item.market_price) * item.qty : 0;
  return (
    <tr>
      <td>
        <div className="bom-table-model">{item.model}</div>
        <div className="bom-table-vendor" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <VendorLogo vendor={item.vendor} />
          <span>{VENDOR_REGISTRY[item.vendor]?.label || item.vendor}</span>
        </div>
      </td>
      <td><Badge color={CAT_BADGE_COLOR[item.product_category] || 'blue'}>{item.product_category}</Badge></td>
      <td className="bom-table-sub">
        <div>{item.sub_category}</div>
        <SegmentTag segment={item.segment} />
      </td>
      {/* Market Price column */}
      <td>
        {item.market_price && parseFloat(item.market_price) > 0 ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#854d0e' }}>{formatDollar(item.market_price)}</div>
            <div style={{ fontSize: 10, color: '#a16207' }}>per unit</div>
            {item.qty > 1 && (
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginTop: 2 }}>
                = {formatDollar(lineMarket)}
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
        )}
      </td>
      <td>
        <div className="qty-controls">
          <button className="qty-btn" onClick={() => onQtyChange(item.id, Math.max(1, item.qty - 1))}>−</button>
          <input className="qty-input" type="number" min={1} value={item.qty}
            onChange={e => onQtyChange(item.id, Math.max(1, parseInt(e.target.value) || 1))} />
          <button className="qty-btn" onClick={() => onQtyChange(item.id, item.qty + 1)}>+</button>
        </div>
      </td>
      <td>
        <button className="remove-btn" onClick={() => onRemove(item.id)}>✕</button>
      </td>
    </tr>
  );
}

function DraftItemsTable({ items, loading }) {
  if (loading) return <div style={{ padding: '12px 0', color: '#6b7280', fontSize: 13 }}>⏳ Loading items…</div>;
  if (!items || items.length === 0) return <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>No items found.</div>;

  const marketTotal = items.reduce((s, it) => s + ((parseFloat(it.market_price) || 0) * it.qty), 0);

  return (
    <div style={{ overflowX: 'auto', marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Model', 'Category', 'Sub-Category', 'Qty', 'Market Price', 'Market Subtotal'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const mp = parseFloat(item.market_price) || 0;
            const sub = mp * item.qty;
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 10px', fontWeight: 600, color: '#111827' }}>{item.model}</td>
                <td style={{ padding: '6px 10px', color: '#374151' }}>{item.product_category || '—'}</td>
                <td style={{ padding: '6px 10px', color: '#374151' }}>{item.sub_category || '—'}</td>
                <td style={{ padding: '6px 10px', color: '#374151' }}>{item.qty}</td>
                <td style={{ padding: '6px 10px', color: mp > 0 ? '#854d0e' : '#d1d5db', fontWeight: 600 }}>
                  {mp > 0 ? formatDollar(mp) : '—'}
                </td>
                <td style={{ padding: '6px 10px', color: sub > 0 ? '#92400e' : '#d1d5db', fontWeight: 700 }}>
                  {sub > 0 ? formatDollar(sub) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {marketTotal > 0 && (
          <tfoot>
            <tr style={{ background: '#fefce8', borderTop: '2px solid #fde68a' }}>
              <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, color: '#854d0e', textAlign: 'right', fontSize: 12 }}>
                🏷 Market Total:
              </td>
              <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 800, color: '#854d0e', fontSize: 13 }}>
                {formatDollar(marketTotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function PricingItemsTable({ items, onChange, loading, isAdmin = false }) {
  if (loading) return <div style={{ padding: '12px 0', color: '#6b7280', fontSize: 13 }}>⏳ Loading items…</div>;
  if (!items || items.length === 0) return <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>No items found.</div>;

  const total = items.reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * it.qty), 0);
  const marketTotal = items.reduce((s, it) => s + ((parseFloat(it.market_price) || 0) * it.qty), 0);

  return (
    <div style={{ overflowX: 'auto', marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f9ff' }}>
            {['#', 'Model', 'Category', 'Qty', 'Market Price (₱)', 'Unit Price (₱)', 'Total'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #bae6fd', color: '#0369a1', fontWeight: 700, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const lineTotal = (parseFloat(item.unit_price) || 0) * item.qty;
            const mp = parseFloat(item.market_price) || 0;
            const margin = mp > 0 && lineTotal > 0 ? ((lineTotal - mp * item.qty) / (mp * item.qty) * 100).toFixed(1) : null;
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '7px 10px', color: '#6b7280', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#111827' }}>{item.model}</td>
                <td style={{ padding: '7px 10px', color: '#374151', fontSize: 11 }}>{item.product_category || '—'}</td>
                <td style={{ padding: '7px 10px', color: '#374151', fontWeight: 600 }}>{item.qty}</td>
                {/* Market Price column */}
                <td style={{ padding: '7px 10px' }}>
                  {mp > 0 ? (
                    <div>
                      <div style={{ fontWeight: 700, color: '#854d0e', fontSize: 12 }}>{formatDollar(mp)}</div>
                      {margin !== null && (
                        <div style={{
                          fontSize: 10, marginTop: 2, fontWeight: 600,
                          color: parseFloat(margin) >= 0 ? '#16a34a' : '#dc2626',
                        }}>
                          {parseFloat(margin) >= 0 ? '▲' : '▼'} {Math.abs(margin)}% margin
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {isAdmin ? (
                    <input
                      type="number" min={0} step={0.01}
                      value={item.unit_price || ''}
                      placeholder="0.00"
                      onChange={e => onChange(item.id, 'unit_price', e.target.value)}
                      style={{ width: 110, border: '1.5px solid #bae6fd', borderRadius: 7, padding: '5px 8px', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: '#0369a1', fontWeight: 600, background: '#f0f9ff' }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.unit_price ? '#0369a1' : '#d1d5db' }}>
                      {item.unit_price ? formatPeso(item.unit_price) : '—'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '7px 10px', color: lineTotal > 0 ? '#15803d' : '#9ca3af', fontWeight: 700 }}>
                  {lineTotal > 0 ? formatPeso(lineTotal) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {marketTotal > 0 && (
            <tr style={{ background: '#fefce8', borderTop: '1px solid #fde68a' }}>
              <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, color: '#854d0e', textAlign: 'right', fontSize: 12 }}>
                🏷 Market Total:
              </td>
              <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 700, color: '#854d0e', fontSize: 13 }}>
                {formatDollar(marketTotal)}
              </td>
            </tr>
          )}
          <tr style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
            <td colSpan={5} style={{ padding: '10px 10px', fontWeight: 700, color: '#15803d', textAlign: 'right', fontSize: 13 }}>Grand Total:</td>
            <td colSpan={2} style={{ padding: '10px 10px', fontWeight: 800, color: '#15803d', fontSize: 14 }}>{formatPeso(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Draft Card ────────────────────────────────────────────────────────────────
function DraftCard({ draft, onDelete, onMoveToPricing, onFetchItems, onSaveDraftNote }) {
  const [expanded, setExpanded]     = useState(false);
  const [items, setItems]           = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [draftNote, setDraftNote]   = useState(draft.notes || '');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => { setDraftNote(draft.notes || ''); }, [draft.notes]);

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) {
      setLoadingItems(true);
      try { setItems(await onFetchItems(draft.id)); }
      catch { setItems([]); }
      finally { setLoadingItems(false); }
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try { await onSaveDraftNote(draft.id, draftNote); }
    finally { setSavingNote(false); }
  };

  const isRejected = draft.status === 'rejected';

  return (
    <div className="draft-card" style={{ borderLeft: isRejected ? '4px solid #ef4444' : undefined }}>
      <div className="draft-card-top">
        <div>
          <div className="draft-card-name">{draft.name}</div>
          {draft.created_by_name && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              👤 <span>{draft.created_by_name}</span>
            </div>
          )}
          <div className="draft-card-meta">
            {draft.item_count ?? 0} items · {formatDate(draft.saved_at)}
            {isRejected && draft.reject_reason && (
              <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 600 }}>Reason: {draft.reject_reason}</span>
            )}
          </div>
        </div>
        <span className={`draft-status-badge ${draft.status}`}>{draft.status}</span>
      </div>

      <div style={{ margin: '10px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          rows={2}
          placeholder="Add a note for this draft (optional)…"
          value={draftNote}
          onChange={e => setDraftNote(e.target.value)}
          style={{ flex: 1, border: '1.5px solid #e4e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: '#374151', resize: 'vertical', background: '#fafafa' }}
        />
        <button
          onClick={handleSaveNote}
          disabled={savingNote}
          style={{ padding: '7px 14px', borderRadius: 8, background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap', opacity: savingNote ? 0.6 : 1 }}>
          {savingNote ? '⏳' : '💾 Save Note'}
        </button>
      </div>

      <div className="draft-card-actions">
        <button className="draft-btn-load" onClick={handleToggle}>
          {expanded ? '▲ Hide Items' : '▼ View Items'}
        </button>
        {!isRejected && (
          <button className="draft-btn-forward" onClick={() => onMoveToPricing(draft)}>💰 Move for Pricing</button>
        )}
        {isRejected && (
          <button className="draft-btn-forward" onClick={() => onMoveToPricing(draft)}>🔁 Resubmit for Pricing</button>
        )}
        <button className="draft-btn-delete" onClick={() => onDelete(draft.id)}>Delete</button>
      </div>
      {expanded && <DraftItemsTable items={items} loading={loadingItems} />}
    </div>
  );
}

// ── Pricing Card ──────────────────────────────────────────────────────────────
function PricingCard({ draft, onDelete, onMoveBackToDraft, onFetchItems, isAdmin, canPricing, onApprove, onReject, onSavePricing }) {
  const [expanded, setExpanded]         = useState(false);
  const [items, setItems]               = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const fetched = await onFetchItems(draft.id);
      setItems(fetched);
    } catch { setItems([]); }
    finally { setLoadingItems(false); }
  }, [draft.id, onFetchItems]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleToggle = () => { setExpanded(prev => !prev); };

  const handleItemChange = (itemId, field, value) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, [field]: value } : it));
  };

  const handleSave = async () => {
    setSavingPricing(true);
    try {
      await onSavePricing(draft.id, items);
    } finally { setSavingPricing(false); }
  };

  const grandTotal = (items || []).reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * it.qty), 0);
  const marketTotal = (items || []).reduce((s, it) => s + ((parseFloat(it.market_price) || 0) * it.qty), 0);

  return (
    <div className="draft-card pricing-card">
      <div className="draft-card-top">
        <div>
          <div className="draft-card-name">{draft.name}</div>
          {draft.created_by_name && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              👤 <span>{draft.created_by_name}</span>
            </div>
          )}
          <div className="draft-card-meta">
            {draft.item_count ?? 0} items
            {draft.forwarded_at && <> · Moved {formatDate(draft.forwarded_at)}</>}
            {marketTotal > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: '#854d0e' }}>· 🏷 {formatDollar(marketTotal)}</span>
            )}
            {grandTotal > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: '#15803d' }}>· {formatPeso(grandTotal)}</span>
            )}
            {draft.notes && (
              <div style={{ marginTop: 5, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', fontStyle: 'italic' }}>
                📝 {draft.notes}
              </div>
            )}
          </div>
        </div>
        <span className="draft-status-badge pricing">pricing</span>
      </div>
      <div className="draft-card-actions">
        <button className="draft-btn-load" onClick={handleToggle}>
          {expanded ? '▲ Hide Details' : '▼ View Pricing'}
        </button>
        {isAdmin && (
          <>
            <button className="draft-btn-back" onClick={() => onMoveBackToDraft(draft)}>↩ Move Back to Drafts</button>
            <button className="draft-btn-delete" onClick={() => onDelete(draft.id)}>Delete</button>
          </>
        )}
      </div>
      {!canPricing && (
        <div style={{ marginTop: 10, padding: '8px 14px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}>
          🔒 <span>Only <strong>admin, manager, executive, or finance</strong> can enter or save pricing. Only an <strong>admin</strong> can approve or reject.</span>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <PricingItemsTable items={items || []} onChange={handleItemChange} loading={loadingItems} isAdmin={canPricing} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  style={{ padding: '8px 20px', borderRadius: 8, background: '#fff0f0', border: '1.5px solid #fecaca', color: '#dc2626', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                  ❌ Reject
                </button>
                <button
                  onClick={() => onApprove(draft)}
                  disabled={grandTotal === 0}
                  style={{ padding: '8px 20px', borderRadius: 8, background: grandTotal > 0 ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#e5e7eb', border: 'none', color: grandTotal > 0 ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 12.5, cursor: grandTotal > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Poppins,sans-serif', boxShadow: grandTotal > 0 ? '0 2px 8px rgba(22,163,74,.3)' : 'none', transition: 'all 0.15s' }}>
                  ✅ Approve
                </button>
              </>
            )}
            {canPricing && (
              <button
                onClick={handleSave}
                disabled={savingPricing}
                style={{ padding: '8px 22px', borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', boxShadow: '0 3px 12px rgba(37,99,235,.3)', opacity: savingPricing ? 0.6 : 1 }}>
                {savingPricing ? '⏳ Saving…' : '💾 Save Pricing'}
              </button>
            )}
          </div>
        </div>
      )}

      {showRejectModal && createPortal(
        <div onClick={() => setShowRejectModal(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.50)', backdropFilter:'blur(5px)', WebkitBackdropFilter:'blur(5px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:9999, padding:16 }}>
          <div className="ct-modal" style={{ maxWidth:420, width:'100%' }} onClick={e => e.stopPropagation()}>
            <div className="ct-modal-head" style={{ background:'linear-gradient(135deg,#7f1d1d,#dc2626)' }}>
              <div className="ct-modal-head-left">
                <div className="ct-modal-icon">❌</div>
                <div>
                  <h3 className="ct-modal-title">Reject BOM</h3>
                  <p className="ct-modal-sub">{draft.name}</p>
                </div>
              </div>
              <button className="ct-modal-x" onClick={() => setShowRejectModal(false)}>✕</button>
            </div>
            <div className="ct-modal-body">
              <div className="ct-section">Rejection Reason</div>
              <div className="ct-field ct-full">
                <label className="ct-label">Reason</label>
                <textarea
                  className="ct-textarea-field"
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Explain why this BOM is being rejected…"
                />
              </div>
            </div>
            <div className="ct-modal-foot">
              <button className="ct-btn-cancel" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="ct-btn-danger" onClick={() => { onReject(draft, rejectReason); setShowRejectModal(false); }}>
                ❌ Reject
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Generate PO Modal ─────────────────────────────────────────────────────────
function GeneratePOModal({ draft, onGenerate, onClose }) {
  const [form, setForm] = useState({
    company_name: '',
    company_address: '',
    contact_person: '',
    designation: '',
    contact_number: '',
    email: '',
    salesrep_name: '',
  });
  const [generating, setGenerating] = useState(false);

  const handleChange = (field, value) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleGenerate = async () => {
    setGenerating(true);
    try { await onGenerate(draft, form); onClose(); }
    catch { /* error surfaced via toast in parent */ }
    finally { setGenerating(false); }
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.50)', backdropFilter:'blur(5px)', WebkitBackdropFilter:'blur(5px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:9999, padding:16 }}>
      <div className="ct-modal" style={{ maxWidth:560, width:'100%' }} onClick={e => e.stopPropagation()}>
        <div className="ct-modal-head">
          <div className="ct-modal-head-left">
            <div className="ct-modal-icon">📄</div>
            <div>
              <h3 className="ct-modal-title">Generate Purchase Order</h3>
              <p className="ct-modal-sub">{draft.name}</p>
            </div>
          </div>
          <button className="ct-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="ct-modal-body">
          <p style={{ fontSize:12, color:'#64748b', marginBottom:16, fontStyle:'italic' }}>
            Fill in the supplier details. Product items are pulled automatically from this BOM.
          </p>
          <div className="ct-section">Supplier Info</div>
          <div className="ct-form-grid">
            <div className="ct-field ct-full">
              <label className="ct-label">Company Name <span style={{ color:'#ef4444' }}>*</span></label>
              <input className="ct-input-field" placeholder="e.g. Visible Technologies Corp" value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} />
            </div>
            <div className="ct-field ct-full">
              <label className="ct-label">Address</label>
              <input className="ct-input-field" placeholder="e.g. C5 Road Brgy. Ususan, Taguig City" value={form.company_address} onChange={e => handleChange('company_address', e.target.value)} />
            </div>
            <div className="ct-field">
              <label className="ct-label">Contact Person</label>
              <input className="ct-input-field" placeholder="Full Name" value={form.contact_person} onChange={e => handleChange('contact_person', e.target.value)} />
            </div>
            <div className="ct-field">
              <label className="ct-label">Designation</label>
              <input className="ct-input-field" placeholder="e.g. Procurement Officer" value={form.designation} onChange={e => handleChange('designation', e.target.value)} />
            </div>
            <div className="ct-field">
              <label className="ct-label">Contact No.</label>
              <input className="ct-input-field" placeholder="e.g. 09XX-XXX-XXXX" value={form.contact_number} onChange={e => handleChange('contact_number', e.target.value)} />
            </div>
            <div className="ct-field">
              <label className="ct-label">Email</label>
              <input className="ct-input-field" placeholder="supplier@email.com" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            </div>
            <div className="ct-field ct-full">
              <label className="ct-label">Sales Representative</label>
              <input className="ct-input-field" placeholder="e.g. Juan Dela Cruz" value={form.salesrep_name} onChange={e => handleChange('salesrep_name', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ct-modal-foot">
          <button className="ct-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="ct-btn-save" onClick={handleGenerate} disabled={generating || !form.company_name.trim()} style={{ opacity: generating || !form.company_name.trim() ? 0.5 : 1, cursor: generating || !form.company_name.trim() ? 'not-allowed' : 'pointer' }}>
            {generating ? '⏳ Generating…' : '📄 Generate .docx'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Approved Items Table (read-only with unit price) ─────────────────────────
function ApprovedItemsTable({ items, loading }) {
  if (loading) return <div style={{ padding: '12px 0', color: '#6b7280', fontSize: 13 }}>⏳ Loading items…</div>;
  if (!items || items.length === 0) return <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>No items found.</div>;

  const grandTotal = items.reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * it.qty), 0);
  const marketTotal = items.reduce((s, it) => s + ((parseFloat(it.market_price) || 0) * it.qty), 0);

  return (
    <div style={{ overflowX: 'auto', marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0fdf4' }}>
            {['#', 'Model', 'Category', 'Sub-Category', 'Qty', 'Market Price', 'Unit Price', 'Total'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #86efac', color: '#15803d', fontWeight: 700, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const mp = parseFloat(item.market_price) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const lineTotal = up * item.qty;
            return (
              <tr key={item.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '7px 10px', color: '#6b7280', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#111827' }}>{item.model}</td>
                <td style={{ padding: '7px 10px', color: '#374151', fontSize: 11 }}>{item.product_category || '—'}</td>
                <td style={{ padding: '7px 10px', color: '#374151', fontSize: 11 }}>{item.sub_category || '—'}</td>
                <td style={{ padding: '7px 10px', color: '#374151', fontWeight: 600 }}>{item.qty}</td>
                <td style={{ padding: '7px 10px', color: mp > 0 ? '#854d0e' : '#d1d5db', fontWeight: 600 }}>
                  {mp > 0 ? formatDollar(mp) : '—'}
                </td>
                <td style={{ padding: '7px 10px', color: up > 0 ? '#1d4ed8' : '#d1d5db', fontWeight: 700 }}>
                  {up > 0 ? formatPeso(up) : '—'}
                </td>
                <td style={{ padding: '7px 10px', color: lineTotal > 0 ? '#15803d' : '#9ca3af', fontWeight: 700 }}>
                  {lineTotal > 0 ? formatPeso(lineTotal) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {marketTotal > 0 && (
            <tr style={{ background: '#fefce8', borderTop: '1px solid #fde68a' }}>
              <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700, color: '#854d0e', textAlign: 'right', fontSize: 12 }}>🏷 Market Total:</td>
              <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 700, color: '#854d0e', fontSize: 13 }}>{formatDollar(marketTotal)}</td>
            </tr>
          )}
          <tr style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
            <td colSpan={6} style={{ padding: '10px 10px', fontWeight: 700, color: '#15803d', textAlign: 'right', fontSize: 13 }}>Grand Total:</td>
            <td colSpan={2} style={{ padding: '10px 10px', fontWeight: 800, color: '#15803d', fontSize: 14 }}>{formatPeso(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Approved Card ─────────────────────────────────────────────────────────────
function ApprovedCard({ draft, onFetchItems, onGeneratePO }) {
  const [expanded, setExpanded]               = useState(false);
  const [items, setItems]                     = useState(null);
  const [loadingItems, setLoadingItems]       = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) {
      setLoadingItems(true);
      try { setItems(await onFetchItems(draft.id)); }
      catch { setItems([]); }
      finally { setLoadingItems(false); }
    }
  };

  const grandTotal = (items || []).reduce((s, it) => s + ((parseFloat(it.unit_price) || 0) * it.qty), 0);
  const marketTotal = (items || []).reduce((s, it) => s + ((parseFloat(it.market_price) || 0) * it.qty), 0);

  return (
    <div className="draft-card" style={{ borderLeft: '4px solid #16a34a' }}>
      <div className="draft-card-top">
        <div>
          <div className="draft-card-name">{draft.name}</div>
          {draft.created_by_name && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              👤 <span>{draft.created_by_name}</span>
            </div>
          )}
          <div className="draft-card-meta">
            {draft.item_count ?? 0} items · Approved {formatDate(draft.approved_at)}
            {draft.po_number && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: '#16a34a' }}>· {draft.po_number}</span>
            )}
            {marketTotal > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: '#854d0e' }}>· 🏷 {formatDollar(marketTotal)}</span>
            )}
            {grandTotal > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 700, color: '#15803d' }}>· {formatPeso(grandTotal)}</span>
            )}
            {draft.notes && (
              <div style={{ marginTop: 5, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', fontStyle: 'italic' }}>
                📝 {draft.notes}
              </div>
            )}
          </div>
        </div>
        <span className="draft-status-badge" style={{ background: '#d1fae5', color: '#065f46' }}>✅ approved</span>
      </div>

      <div className="draft-card-actions">
        <button className="draft-btn-load" onClick={handleToggle}>
          {expanded ? '▲ Hide Items' : '▼ View Items'}
        </button>
        <button
          onClick={() => setShowGenerateModal(true)}
          style={{ padding: '6px 16px', borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', boxShadow: '0 2px 8px rgba(37,99,235,.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
          📄 Generate PO
        </button>
        {draft.po_file && (
          <a href={`${API_BASE_URL}/api/bom/drafts/${draft.id}/po-download`} download
            style={{ padding: '6px 14px', borderRadius: 7, background: '#f0fdf4', border: '1.5px solid #86efac', color: '#15803d', fontWeight: 700, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'Poppins,sans-serif' }}>
            ⬇ Download Last PO
          </a>
        )}
      </div>

      {expanded && <ApprovedItemsTable items={items} loading={loadingItems} />}

      {showGenerateModal && (
        <GeneratePOModal draft={draft} onGenerate={onGeneratePO} onClose={() => setShowGenerateModal(false)} />
      )}
    </div>
  );
}

function SaveDraftModal({ onSave, onClose, existingName }) {
  const [name, setName] = useState(existingName || `BOM Draft ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.50)', backdropFilter:'blur(5px)', WebkitBackdropFilter:'blur(5px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:9999, padding:16 }}>
      <div className="ct-modal" style={{ maxWidth:420, width:'100%' }} onClick={e => e.stopPropagation()}>
        <div className="ct-modal-head">
          <div className="ct-modal-head-left">
            <div className="ct-modal-icon">💾</div>
            <div>
              <h3 className="ct-modal-title">Save Draft</h3>
              <p className="ct-modal-sub">Name and save your current BOM list</p>
            </div>
          </div>
          <button className="ct-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="ct-modal-body">
          <div className="ct-section">Draft Details</div>
          <div className="ct-field ct-full">
            <label className="ct-label">Draft Name</label>
            <input className="ct-input-field" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. BOM Draft Jun 12" />
          </div>
        </div>
        <div className="ct-modal-foot">
          <button className="ct-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="ct-btn-save" onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}>
            💾 Save Draft
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Market Price Edit Modal ───────────────────────────────────────────────────
function MarketPriceModal({ product, onSave, onClose }) {
  const [price, setPrice] = useState(product.market_price || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(product.id, price); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🏷 Set Market Price</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>{product.model}</p>
          <label className="modal-label">Market Price (₱)</label>
          <input
            className="modal-input"
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={price}
            onChange={e => setPrice(e.target.value)}
            autoFocus
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            This is the reference market/SRP price stored in the database. It will appear in BOM lists and the pricing tab for comparison.
          </p>
          <div className="modal-footer-actions">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="modal-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving…' : '💾 Save Price'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [vendor, setVendor] = useState('ruijie');

  const splitCSVLine = (line) => {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += line[i]; }
    }
    cols.push(cur.trim()); return cols;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim()); const parsed = [];
    if (vendor === 'hikvision') {
      for (const line of lines.slice(2)) {
        const cols = splitCSVLine(line);
        if (!cols[1] || isNaN(Number(cols[0]))) continue;
        const productLine = cols[7] || '';
        const segMap = { 'AcuSense': 'Enterprise', 'DeepinView': 'Enterprise', 'ColorVu': 'SME / Enterprise', 'Network Camera': 'SME', 'PTZ': 'Enterprise', 'Access Control': 'SME / Enterprise', 'Intercom': 'SME', 'NVR': 'SME / Enterprise', 'DVR / XVR': 'SME', 'Storage': 'Enterprise', 'Video Management Software': 'Enterprise', 'Alarm System': 'SME', 'LPR / ANPR': 'Enterprise', 'Thermal': 'Enterprise' };
        const segment = segMap[productLine] || (cols[2] ? 'SME / Enterprise' : '');
        parsed.push({ model: cols[1], segment, product_category: cols[2] || '', sub_category: cols[3] || '', wireless_standard: (cols[4] || '').substring(0, 191), deployment: cols[5] || '', management_type: productLine, poe: '', tag_dc: 0, tag_enterprise: segment.includes('Enterprise') ? 1 : 0, tag_sme: segment.includes('SME') ? 1 : 0, notes: cols[6] || '', vendor, market_price: parseFloat((cols[8] || '').replace(/[$,]/g, '')) || 0 });
      }
      return parsed;
    }
    if (vendor === 'zkteco') {
      for (const line of lines.slice(2)) {
        const cols = splitCSVLine(line);
        if (!cols[1] || isNaN(Number(cols[0]))) continue;
        const segment = cols[5] || '';
        parsed.push({ model: cols[1], segment, product_category: cols[2] || '', sub_category: cols[3] || '', wireless_standard: (cols[11] || '').substring(0, 191), deployment: cols[4] || '', management_type: cols[6] || '', poe: '', tag_dc: segment.toLowerCase().includes('data center') ? 1 : 0, tag_enterprise: segment.toLowerCase().includes('enterprise') ? 1 : 0, tag_sme: segment.toLowerCase().includes('sme') ? 1 : 0, notes: cols[15] || '', vendor, market_price: parseFloat((cols[20] || '').replace(/[$,]/g, '')) || 0 });
      }
      return parsed;
    }
    if (vendor === 'sundray') {
      for (const line of lines.slice(1)) {
        const cols = splitCSVLine(line);
        if (!cols[0]) continue;
        const filterTags = cols[8] || '';
        const segment = filterTags.toLowerCase().includes('data center') ? 'Data Center' : filterTags.toLowerCase().includes('enterprise') ? 'Enterprise' : 'SME / Enterprise';
        parsed.push({ model: cols[0], segment, product_category: cols[1] || '', sub_category: cols[2] || '', wireless_standard: (cols[4] || '').substring(0, 191), deployment: cols[3] || '', management_type: '', poe: cols[6] || '', tag_dc: segment === 'Data Center' ? 1 : 0, tag_enterprise: segment.includes('Enterprise') ? 1 : 0, tag_sme: segment.includes('SME') ? 1 : 0, notes: cols[9] || '', vendor, market_price: parseFloat((cols[10] || '').replace(/[$,]/g, '')) || 0 });
      }
      return parsed;
    }
    if (vendor === 'sophos') {
      // Row 0: Title, Row 1: Warning, Row 2: Empty, Row 3: Headers, Row 4+: data
      for (const line of lines.slice(4)) {
        const cols = splitCSVLine(line);
        // Skip empty rows and section header rows (e.g. "▌  FIREWALL HARDWARE")
        if (!cols[2] || !cols[2].trim() || cols[2].startsWith('▌')) continue;
        // Skip if it looks like a section divider (col0 has content but col2 is empty)
        if (!cols[2].trim()) continue;
        const targetMarket = cols[7] || '';
        const segment = targetMarket.toLowerCase().includes('enterprise') ? 'Enterprise'
          : targetMarket.toLowerCase().includes('smb') || targetMarket.toLowerCase().includes('sme') ? 'SME'
          : targetMarket.toLowerCase().includes('data center') ? 'Data Center'
          : 'SME / Enterprise';
        const rawPrice = (cols[11] || '').replace(/[$,~]/g, '').trim();
        parsed.push({
          model: cols[2].trim(),
          segment,
          product_category: cols[0] || 'Network Security',
          sub_category: cols[1] || '',
          wireless_standard: cols[4] || '',
          deployment: cols[3] || '',
          management_type: cols[8] || '',
          poe: '',
          tag_dc: segment === 'Data Center' ? 1 : 0,
          tag_enterprise: segment.includes('Enterprise') ? 1 : 0,
          tag_sme: segment.includes('SME') ? 1 : 0,
          notes: cols[6] || '',
          vendor,
          market_price: parseFloat(rawPrice) || 0,
        });
      }
      return parsed;
    }
    // Default (ruijie-style)
    for (const line of lines.slice(2)) {
      const cols = splitCSVLine(line);
      if (cols.length >= 3 && cols[0]) {
        parsed.push({ model: cols[0], segment: cols[1] || '', product_category: cols[2] || '', sub_category: cols[3] || '', wireless_standard: (cols[4] || '').substring(0, 191), deployment: cols[5] || '', management_type: cols[6] || '', poe: cols[7] || '', tag_dc: cols[8]?.includes('✓') ? 1 : 0, tag_enterprise: cols[9]?.includes('✓') ? 1 : 0, tag_sme: cols[10]?.includes('✓') ? 1 : 0, notes: cols[14] || cols[11] || '', vendor, market_price: parseFloat((cols[13] || '').replace(/[$,]/g, '')) || 0 });
      }
    }
    return parsed;
  };

  const handleFileChange = (e) => {
    setError(''); const file = e.target.files[0]; if (!file) return;
    if (!file.name.endsWith('.csv')) { setError('Only CSV files are supported.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const rows = parseCSV(ev.target.result); if (!rows.length) { setError('No valid rows found.'); return; } setPreview(rows.slice(0, 5)); fileRef.current._parsed = rows; }
      catch { setError('Failed to parse file.'); }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileRef.current?._parsed?.length) { setError('Please select a valid file first.'); return; }
    setImporting(true);
    try { await onImport(fileRef.current._parsed, vendor); onClose(); }
    catch (err) { setError(err.message || 'Import failed.'); }
    finally { setImporting(false); }
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 16 }}>
      <div className="ct-modal" style={{ maxWidth: 580, width: '100%', borderRadius: 18 }} onClick={e => e.stopPropagation()}>
        <div className="ct-modal-head" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          <div className="ct-modal-head-left">
            <div className="ct-modal-icon" style={{ fontSize: 17, background: 'rgba(255,255,255,0.15)', boxShadow: 'none' }}>📥</div>
            <div>
              <h3 className="ct-modal-title" style={{ color: '#fff' }}>Import Products from CSV</h3>
              <p className="ct-modal-sub" style={{ color: 'rgba(255,255,255,0.65)' }}>Bulk-import products into the catalog</p>
            </div>
          </div>
          <button className="ct-modal-x" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={onClose}>✕</button>
        </div>
        <div className="ct-modal-body">
          <div className="ct-section">Vendor / Company</div>
          <div className="ct-form-grid" style={{ marginBottom: 16 }}>
            <div className="ct-field ct-full">
              <label className="ct-label">Select Vendor</label>
              <select className="ct-select-field" value={vendor} onChange={e => setVendor(e.target.value)}>
                {Object.entries(VENDOR_REGISTRY).map(([key, v]) => (
                  <option key={key} value={key}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sophos CSV format hint */}
          {vendor === 'sophos' && (
            <div style={{ background: '#e8f4ff', border: '1.5px solid #bae6fd', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#0369a1' }}>
              <strong>Sophos CSV format:</strong> Category, Sub-Category, Product/Model, Type, Form Factor, Ports, Key Features, Target Market, Management, License Model, Current/EOL, USD Price, Pricing Notes
              <br /><span style={{ color: '#64748b' }}>First 4 rows (title, warning, blank, header) are skipped automatically.</span>
            </div>
          )}

          <div className="ct-section">CSV File</div>
          <div className="ct-field ct-full" style={{ marginBottom: 14 }}>
            <label className="ct-label">Select CSV File</label>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange}
              style={{ display: 'block', padding: '9px 13px', border: '1.5px dashed #bfdbfe', borderRadius: 9, width: '100%', cursor: 'pointer', background: '#f0f9ff', fontFamily: 'Poppins, sans-serif', fontSize: 13, color: '#0369a1', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12.5, marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>⚠ {error}</p>}

          {preview.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div className="ct-section" style={{ marginTop: 0 }}>Preview — {fileRef.current?._parsed?.length} rows (showing first 5)</div>
              <div style={{ overflowX: 'auto', border: '1px solid #e4e8f0', borderRadius: 9, background: '#fff' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Model', 'Segment', 'Category', 'Sub-Category', 'Market Price'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid #e4e8f0', color: '#64748b', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Poppins, sans-serif' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1a202c' }}>{row.model}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{row.segment}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{row.product_category}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{row.sub_category}</td>
                        <td style={{ padding: '7px 10px', color: row.market_price > 0 ? '#854d0e' : '#d1d5db', fontWeight: row.market_price > 0 ? 700 : 400 }}>
                          {row.market_price > 0 ? formatDollar(row.market_price) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="ct-modal-foot">
          <button className="ct-btn-cancel" type="button" onClick={onClose}>Cancel</button>
          <button className="ct-btn-save" onClick={handleImport} disabled={importing || !preview.length} style={{ opacity: (importing || !preview.length) ? 0.5 : 1, cursor: (importing || !preview.length) ? 'not-allowed' : 'pointer' }}>
            {importing ? '⏳ Importing…' : `📥 Import ${fileRef.current?._parsed?.length || 0} Products`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main BOM Component ───────────────────────────────────────────────────────
const Bom = ({ loggedInUser }) => {
  const [activeVendor, setActiveVendor]         = useState('ruijie');
  const [activeSegment, setActiveSegment]       = useState('ALL');
  const [activeCategory, setActiveCategory]     = useState('ALL');
  const [activeSubcategory, setActiveSubcategory] = useState('ALL');
  const [searchQuery, setSearchQuery]           = useState('');
  const [products, setProducts]                 = useState([]);
  const [loadingProducts, setLoadingProducts]   = useState(false);
  const [bomList, setBomList]                   = useState([]);
  const [tab, setTab]                           = useState('catalog');
  const [drafts, setDrafts]                     = useState([]);
  const [loadingDrafts, setLoadingDrafts]       = useState(false);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [currentDraftId, setCurrentDraftId]     = useState(null);
  const [currentDraftName, setCurrentDraftName] = useState('');
  const [showImportModal, setShowImportModal]   = useState(false);
  const [toast, setToast]                       = useState(null);
  const [marketPriceProduct, setMarketPriceProduct] = useState(null);

  const isAdmin = loggedInUser?.role === 'admin';
  const canPricing = isAdmin || ['manager', 'executive', 'finance'].includes(loggedInUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProducts = useCallback(async (vendorKey) => {
    setLoadingProducts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bom/products`, { params: { vendor: vendorKey } });
      if (res.data.success) setProducts(res.data.products);
    } catch (err) { console.error(err); }
    finally { setLoadingProducts(false); }
  }, []);

  useEffect(() => { fetchProducts(activeVendor); }, [activeVendor, fetchProducts]);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bom/drafts`);
      if (res.data.success) setDrafts(res.data.drafts);
    } catch (err) { console.error(err); }
    finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // ─── SOCKET: auto-refresh drafts + show real-time notifications ─────────────
  useEffect(() => {
    const socket = getSocket();

    const onBomDraftCreated = ({ draftName, changedBy }) => {
      fetchDrafts();
      sendNotification(`📋 New BOM draft "${draftName}" created by ${changedBy}`);
    };
    const onBomMovedToPricing = ({ draftName, changedBy }) => {
      fetchDrafts();
      sendNotification(`💰 BOM "${draftName}" moved to Pricing by ${changedBy}`);
    };
    const onBomPricingSaved = ({ draftName, changedBy }) => {
      fetchDrafts();
      sendNotification(`💾 Pricing saved for "${draftName}" by ${changedBy} — awaiting admin approval`);
    };
    const onBomApproved = ({ draftName, changedBy }) => {
      fetchDrafts();
      sendNotification(`✅ BOM "${draftName}" approved by ${changedBy}`);
    };
    const onBomRejected = ({ draftName, changedBy, reason }) => {
      fetchDrafts();
      sendNotification(`❌ BOM "${draftName}" rejected by ${changedBy}${reason ? `: "${reason}"` : ''}`);
    };

    socket.off('bom-draft-created');
    socket.off('bom-moved-to-pricing');
    socket.off('bom-pricing-saved');
    socket.off('bom-approved');
    socket.off('bom-rejected');

    socket.on('bom-draft-created',   onBomDraftCreated);
    socket.on('bom-moved-to-pricing', onBomMovedToPricing);
    socket.on('bom-pricing-saved',   onBomPricingSaved);
    socket.on('bom-approved',        onBomApproved);
    socket.on('bom-rejected',        onBomRejected);

    return () => {
      socket.off('bom-draft-created',   onBomDraftCreated);
      socket.off('bom-moved-to-pricing', onBomMovedToPricing);
      socket.off('bom-pricing-saved',   onBomPricingSaved);
      socket.off('bom-approved',        onBomApproved);
      socket.off('bom-rejected',        onBomRejected);
    };
  }, [fetchDrafts]);
  // ──────────────────────────────────────────────────────────────────────────

  const draftItems    = drafts.filter(d => d.status === 'draft' || d.status === 'rejected');
  const pricingItems  = drafts.filter(d => d.status === 'pricing');
  const approvedItems = drafts.filter(d => d.status === 'approved');

  const vendor = VENDOR_REGISTRY[activeVendor];

  const segments = useMemo(() => {
    const s = new Set(products.map(p => p.segment).filter(Boolean));
    return [...s].sort();
  }, [products]);

  const categories = useMemo(() => {
    let list = products;
    if (activeSegment !== 'ALL') list = list.filter(p => p.segment === activeSegment);
    const c = new Set(list.map(p => p.product_category).filter(Boolean));
    return [...c].sort();
  }, [products, activeSegment]);

  const subcategories = useMemo(() => {
    let list = products;
    if (activeSegment !== 'ALL') list = list.filter(p => p.segment === activeSegment);
    if (activeCategory !== 'ALL') list = list.filter(p => p.product_category === activeCategory);
    const s = new Set(list.map(p => p.sub_category).filter(Boolean));
    return [...s].sort();
  }, [products, activeSegment, activeCategory]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeSegment !== 'ALL') list = list.filter(p => p.segment === activeSegment);
    if (activeCategory !== 'ALL') list = list.filter(p => p.product_category === activeCategory);
    if (activeSubcategory !== 'ALL') list = list.filter(p => p.sub_category === activeSubcategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.model.toLowerCase().includes(q) ||
        p.sub_category?.toLowerCase().includes(q) ||
        p.product_category?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeSegment, activeCategory, activeSubcategory, searchQuery]);

  const totalItems = bomList.reduce((s, i) => s + i.qty, 0);
  const bomMarketTotal = bomList.reduce((s, i) => s + ((parseFloat(i.market_price) || 0) * i.qty), 0);

  const handleAddToBom = useCallback((product) => {
    setBomList(prev => {
      const existing = prev.find(i => i.product_id === product.id && i.vendor === product.vendor);
      if (existing) return prev.map(i => (i.product_id === product.id && i.vendor === product.vendor) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, id: uid(), product_id: product.id, qty: 1 }];
    });
    showToast(`"${product.model}" added to BOM`);
  }, []);

  const handleQtyChange = (id, qty) => setBomList(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  const handleRemove    = (id) => setBomList(prev => prev.filter(i => i.id !== id));

  // Save market price to DB
  const handleSaveMarketPrice = async (productId, price) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/products/${productId}/market-price`, { market_price: parseFloat(price) || 0 });
      // Refresh product list and      fetchProducts(activeVendor);
      showToast('Market price updated!');
    } catch { showToast('Failed to update market price.', 'error'); }
  };

  const handleSaveDraft = async (name) => {
    try {
      // Always create a new draft (no id) so drafts stack instead of overwriting
      const payload = {
        name, vendor: activeVendor,
        items: bomList.map(i => ({ product_id: i.product_id || i.id, model: i.model, vendor: i.vendor, qty: i.qty, note: '' })),
        status: 'draft', created_by: loggedInUser?.id,
      };
      const res = await axios.post(`${API_BASE_URL}/api/bom/drafts`, payload);
      if (res.data.success) {
        setShowSaveDraftModal(false);
        // Clear the BOM list and reset draft tracking after saving
        setBomList([]);
        setCurrentDraftId(null);
        setCurrentDraftName('');
        fetchDrafts();
        setTab('drafts');
        showToast('Draft saved! BOM list cleared.');
        // Broadcast to ALL users via socket
        await axios.post(`${API_BASE_URL}/api/bom/notify`, {
          event: 'bom-draft-created',
          draftName: name,
          changedBy: loggedInUser?.name || 'Someone',
        });
      }
    } catch { showToast('Failed to save draft.', 'error'); }
  };

  const handleFetchDraftItems = useCallback(async (draftId) => {
    const res = await axios.get(`${API_BASE_URL}/api/bom/drafts/${draftId}`);
    if (!res.data.success) throw new Error('Failed');
    return res.data.items || [];
  }, []);

  const handleDeleteDraft = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    try { await axios.delete(`${API_BASE_URL}/api/bom/drafts/${id}`); fetchDrafts(); showToast('Draft deleted.'); }
    catch { showToast('Failed to delete draft.', 'error'); }
  };

  const handleMoveToPricing = async (draft) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draft.id}/forward`);
      await fetchDrafts();
      setTab('pricing');
      showToast(`"${draft.name}" moved to Pricing.`);
      // Broadcast to ALL users via socket
      await axios.post(`${API_BASE_URL}/api/bom/notify`, {
        event: 'bom-moved-to-pricing',
        draftName: draft.name,
        changedBy: loggedInUser?.name || 'Someone',
      });
    } catch { showToast('Failed to move to pricing.', 'error'); }
  };

  const handleSaveDraftNote = async (draftId, notes) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draftId}/notes`, { notes });
      showToast('Note saved!');
    } catch { showToast('Failed to save note.', 'error'); }
  };

  const handleMoveBackToDraft = async (draft) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draft.id}/status`, { status: 'draft' });
      fetchDrafts(); showToast(`"${draft.name}" moved back to Drafts.`);
    } catch { showToast('Failed to move back to drafts.', 'error'); }
  };

  const handleSavePricing = async (draftId, items) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draftId}/pricing`, {
        items: items.map(it => ({ id: it.id, unit_price: it.unit_price, note: it.note })),
      });
      // Find the draft name for a better message
      const draft = drafts.find(d => d.id === draftId);
      const draftName = draft?.name || `BOM #${draftId}`;
      fetchDrafts();
      showToast('Pricing saved!');
      // Broadcast to admin only via socket
      await axios.post(`${API_BASE_URL}/api/bom/notify`, {
        event: 'bom-pricing-saved',
        draftName: draftName,
        changedBy: loggedInUser?.name || 'Someone',
        targetRoles: ['admin'],
      });
    } catch { showToast('Failed to save pricing.', 'error'); throw new Error('Save failed'); }
  };

  const handleApproveDraft = async (draft) => {
    if (!window.confirm(`Approve "${draft.name}"?`)) return;
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draft.id}/status`, { status: 'approved' });
      fetchDrafts(); setTab('approved');
      showToast(`✅ "${draft.name}" approved! Go to the Approved tab to generate the PO.`);
      // Broadcast to manager, executive, finance via socket
      await axios.post(`${API_BASE_URL}/api/bom/notify`, {
        event: 'bom-approved',
        draftName: draft.name,
        changedBy: loggedInUser?.name || 'Admin',
        targetRoles: ['manager', 'executive', 'finance'],
      });
    } catch (err) { showToast(err.response?.data?.error || 'Failed to approve.', 'error'); }
  };

  const handleGeneratePO = async (draft, supplierForm) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/bom/drafts/${draft.id}/approve`, {
        userRole: loggedInUser?.role,
        ...supplierForm,
      });
      if (res.data.success) {
        fetchDrafts();
        window.open(`${API_BASE_URL}/api/bom/drafts/${draft.id}/po-download`, '_blank');
        showToast(`📄 PO generated! PO # ${res.data.poNumber}`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate PO.', 'error');
      throw err;
    }
  };

  const handleRejectDraft = async (draft, reason) => {
    try {
      await axios.post(`${API_BASE_URL}/api/bom/drafts/${draft.id}/reject`, { userRole: loggedInUser?.role, reject_reason: reason });
      fetchDrafts(); setTab('drafts');
      showToast(`❌ "${draft.name}" rejected. Moved back to Drafts.`);
      // Broadcast to manager, executive, finance via socket
      await axios.post(`${API_BASE_URL}/api/bom/notify`, {
        event: 'bom-rejected',
        draftName: draft.name,
        changedBy: loggedInUser?.name || 'Admin',
        reason: reason || '',
        targetRoles: ['manager', 'executive', 'finance'],
      });
    } catch { showToast('Failed to reject.', 'error'); }
  };

  const handleImport = async (rows, vendorKey) => {
    const res = await axios.post(`${API_BASE_URL}/api/bom/products/import`, { products: rows, vendor: vendorKey });
    if (!res.data.success) throw new Error(res.data.error || 'Import failed');
    fetchProducts(vendorKey);
    showToast(`✅ ${rows.length} products imported successfully!`);
  };

  const handleVendorSwitch = (key) => {
    setActiveVendor(key); setActiveSegment('ALL'); setActiveCategory('ALL'); setActiveSubcategory('ALL'); setSearchQuery('');
  };

  return (
    <div className="bom-root">
      {/* Header */}
      <div className="bom-header">
        <div>
          <h1>BOM Management</h1>
          <p>Select a vendor, browse products, and build your Bill of Materials.</p>
        </div>
        <div className="bom-header-actions">
          {currentDraftName && <span className="current-draft-label">📝 {currentDraftName}</span>}
          <button className="bom-import-btn" onClick={() => setShowImportModal(true)}>📥 Import Products</button>
          {bomList.length > 0 && (
            <button className="bom-save-draft-btn" onClick={() => setShowSaveDraftModal(true)}>💾 Save Draft</button>
          )}
        </div>
      </div>

      {toast && <div className={`toast-${toast.type || 'success'}`}>{toast.msg}</div>}

      {/* Tabs */}
      <div className="bom-tabs">
        <button className={`tab-btn${tab === 'catalog' ? ' active' : ''}`} onClick={() => setTab('catalog')}>Product Catalog</button>
        <button className={`tab-btn${tab === 'bom' ? ' active' : ''}`} onClick={() => setTab('bom')}>
          BOM List {bomList.length > 0 && <span className="tab-badge">{totalItems}</span>}
        </button>
        <button className={`tab-btn${tab === 'drafts' ? ' active' : ''}`} onClick={() => setTab('drafts')}>
          Drafts {draftItems.length > 0 && <span className="tab-badge tab-badge-gray">{draftItems.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'pricing' ? ' active' : ''}`} onClick={() => setTab('pricing')}>
          Pricing {pricingItems.length > 0 && <span className="tab-badge tab-badge-amber">{pricingItems.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'approved' ? ' active' : ''}`} onClick={() => setTab('approved')}>
          Approved {approvedItems.length > 0 && <span className="tab-badge" style={{ background: '#16a34a' }}>{approvedItems.length}</span>}
        </button>
      </div>

      {/* ── CATALOG TAB ── */}
      {tab === 'catalog' && (
        <div>
          <div className="vendor-selector">
            {Object.entries(VENDOR_REGISTRY).map(([key, v]) => (
              <VendorCard key={key} vendorKey={key} vendor={v} active={activeVendor === key} onClick={handleVendorSwitch} />
            ))}
          </div>
          {!vendor.available ? (
            <div className="catalog-empty"><div style={{ fontSize: 48, marginBottom: 12 }}>🔜</div><p style={{ fontWeight: 600, color: '#374151' }}>{vendor.label} catalog coming soon.</p></div>
          ) : loadingProducts ? (
            <div className="catalog-empty"><span>⏳ Loading products…</span></div>
          ) : (
            <>
              <div className="bom-search-bar">
                <input className="bom-search-input" placeholder={`Search ${vendor.label} models, categories, or notes…`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Segment</span>
                <div className="bom-category-pills" style={{ display: 'inline-flex' }}>
                  <button className={`category-pill${activeSegment === 'ALL' ? ' active' : ''}`} onClick={() => { setActiveSegment('ALL'); setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>All</button>
                  {segments.map(seg => <button key={seg} className={`category-pill${activeSegment === seg ? ' active' : ''}`} onClick={() => { setActiveSegment(seg); setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>{seg}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Category</span>
                <div className="bom-category-pills" style={{ display: 'inline-flex' }}>
                  <button className={`category-pill${activeCategory === 'ALL' ? ' active' : ''}`} onClick={() => { setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>All</button>
                  {categories.map(cat => <button key={cat} className={`category-pill${activeCategory === cat ? ' active' : ''}`} onClick={() => { setActiveCategory(cat); setActiveSubcategory('ALL'); }}>{cat}</button>)}
                </div>
              </div>
              {activeCategory !== 'ALL' && subcategories.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Sub-Category</span>
                  <div className="bom-subcategory-pills" style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
                    <button className={`subcategory-pill${activeSubcategory === 'ALL' ? ' active' : ''}`} onClick={() => setActiveSubcategory('ALL')}>All</button>
                    {subcategories.map(sub => <button key={sub} className={`subcategory-pill${activeSubcategory === sub ? ' active' : ''}`} onClick={() => setActiveSubcategory(sub)}>{sub}</button>)}
                  </div>
                </div>
              )}
              <p className="bom-product-count">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                {bomList.length > 0 && <span className="bom-list-peek" onClick={() => setTab('bom')}> · View BOM list ({totalItems} units) →</span>}
              </p>
              {filteredProducts.length > 0 ? (
                <div className="catalog-grid">
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} onAdd={handleAddToBom} />
                  ))}
                </div>
              ) : (
                <div className="catalog-empty">
                  <div style={{ fontSize: 36 }}>🔍</div>
                  <p>No products match your filters.</p>
                  {isAdmin && products.length === 0 && <button className="browse-btn" onClick={() => setShowImportModal(true)}>📥 Import Products Now</button>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BOM LIST TAB ── */}
      {tab === 'bom' && (
        <div>
          {bomList.length === 0 ? (
            <div className="bom-empty-state">
              <div className="empty-icon">📋</div>
              <p>Your BOM list is empty.</p>
              <p className="empty-sub">Go to the Product Catalog and add items.</p>
              <button className="browse-btn" onClick={() => setTab('catalog')}>Browse Catalog</button>
            </div>
          ) : (
            <>
              <div className="bom-summary-bar">
                {[
                  { label: 'Line Items', value: bomList.length },
                  { label: 'Total Units', value: totalItems },
                  { label: 'Vendors', value: new Set(bomList.map(i => i.vendor)).size },
                  { label: 'Categories', value: new Set(bomList.map(i => i.product_category)).size },
                ].map(s => (
                  <div key={s.label} className="bom-summary-card">
                    <div className="bom-summary-value">{s.value}</div>
                    <div className="bom-summary-label">{s.label}</div>
                  </div>
                ))}
                {bomMarketTotal > 0 && (
                  <div className="bom-summary-card" style={{ background: '#fefce8', border: '1.5px solid #fde68a' }}>
                    <div className="bom-summary-value" style={{ color: '#854d0e', fontSize: 13 }}>{formatDollar(bomMarketTotal)}</div>
                    <div className="bom-summary-label" style={{ color: '#a16207' }}>🏷 Market Total</div>
                  </div>
                )}
              </div>
              <div className="bom-table-wrapper">
                <table className="bom-table">
                  <thead>
                    <tr>{['Model / Vendor', 'Category', 'Sub-Category / Segment', 'Market Price', 'Quantity', ''].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {bomList.map(item => (
                      <BomLineItem key={item.id} item={item} onQtyChange={handleQtyChange} onRemove={handleRemove} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bom-footer-actions">
                <button className="bom-clear-btn" onClick={() => { if (window.confirm('Clear the entire BOM list?')) { setBomList([]); setCurrentDraftName(''); setCurrentDraftId(null); } }}>Clear All</button>
                <button className="bom-save-draft-btn" onClick={() => setShowSaveDraftModal(true)}>💾 Save Draft</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DRAFTS TAB ── */}
      {tab === 'drafts' && (
        <div>
          {loadingDrafts ? (
            <div className="bom-empty-state"><p>⏳ Loading drafts…</p></div>
          ) : draftItems.length === 0 ? (
            <div className="bom-empty-state">
              <div className="empty-icon">🗂️</div>
              <p>No drafts saved yet.</p>
              <p className="empty-sub">Build a BOM list and save it as a draft.</p>
              <button className="browse-btn" onClick={() => setTab('catalog')}>Start Building</button>
            </div>
          ) : (
            <div className="drafts-list">
              <p className="drafts-hint">Add notes to items here, then click "Move for Pricing" to send to the pricing team.</p>
              {draftItems.map(draft => (
                <DraftCard key={draft.id} draft={draft} onDelete={handleDeleteDraft} onMoveToPricing={handleMoveToPricing} onFetchItems={handleFetchDraftItems} onSaveDraftNote={handleSaveDraftNote} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PRICING TAB ── */}
      {tab === 'pricing' && (
        <div>
          {loadingDrafts ? (
            <div className="bom-empty-state"><p>⏳ Loading…</p></div>
          ) : pricingItems.length === 0 ? (
            <div className="bom-empty-state">
              <div className="empty-icon">💰</div>
              <p>No BOMs moved for pricing yet.</p>
              <p className="empty-sub">Go to Drafts and click "Move for Pricing".</p>
              <button className="browse-btn" onClick={() => setTab('drafts')}>Go to Drafts</button>
            </div>
          ) : (
            <div className="drafts-list">
              <p className="drafts-hint">
                {isAdmin
                  ? 'Enter unit prices per item. Market prices shown for reference — margin % calculated automatically. As admin, you can Approve or Reject each BOM.'
                  : canPricing
                    ? 'Enter unit prices per item and save. Market prices shown for reference — margin % calculated automatically. Only an admin can approve or reject.'
                    : 'Pricing BOMs are shown below for your reference. Only admin, manager, executive, or finance can enter prices.'}
              </p>
              {pricingItems.map(draft => (
                <PricingCard key={draft.id} draft={draft} onDelete={handleDeleteDraft} onMoveBackToDraft={handleMoveBackToDraft} onFetchItems={handleFetchDraftItems} onSavePricing={handleSavePricing} onApprove={handleApproveDraft} onReject={handleRejectDraft} isAdmin={isAdmin} canPricing={canPricing} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── APPROVED TAB ── */}
      {tab === 'approved' && (
        <div>
          {loadingDrafts ? (
            <div className="bom-empty-state"><p>⏳ Loading…</p></div>
          ) : approvedItems.length === 0 ? (
            <div className="bom-empty-state">
              <div className="empty-icon">✅</div>
              <p>No approved BOMs yet.</p>
              <p className="empty-sub">Admin must approve a BOM from the Pricing tab.</p>
              <button className="browse-btn" onClick={() => setTab('pricing')}>Go to Pricing</button>
            </div>
          ) : (
            <div className="drafts-list">
              <p className="drafts-hint">
                Click <strong>Generate PO</strong> on any approved BOM to fill in supplier details and download the Purchase Order .docx.
              </p>
              {approvedItems.map(draft => (
                <ApprovedCard key={draft.id} draft={draft} onFetchItems={handleFetchDraftItems} onGeneratePO={handleGeneratePO} />
              ))}
            </div>
          )}
        </div>
      )}

      {showSaveDraftModal && <SaveDraftModal existingName={currentDraftName} onSave={handleSaveDraft} onClose={() => setShowSaveDraftModal(false)} />}
      {showImportModal && <ImportModal onImport={handleImport} onClose={() => setShowImportModal(false)} />}
      {marketPriceProduct && <MarketPriceModal product={marketPriceProduct} onSave={handleSaveMarketPrice} onClose={() => setMarketPriceProduct(null)} />}
    </div>
  );
};

export default Bom;
