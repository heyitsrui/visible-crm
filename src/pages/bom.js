import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import '../styles/bom.css';

const API_BASE_URL = `http://${window.location.hostname}:5000`;

// ─── Company / Vendor Registry ────────────────────────────────────────────────
// Each vendor maps to one of your 4 companies. Logos use SVG inline or img tag.
const VENDOR_REGISTRY = {
  ruijie: {
    label: 'Ruijie Networks',
    logoUrl: 'https://www.almacctv.com/web/wp-content/uploads/2020/11/ruijie-logo.png',
    logoFallback: 'RJ',
    color: '#2563eb',
    bgColor: '#eff6ff',
    available: true,
  },
  sundray: {
    label: 'Sundray',
    logoUrl: 'https://www.cstc.com.ph/images/sundray.png',
    logoFallback: 'SD',
    color: '#2563eb',
    bgColor: '#eff6ff',
    available: true,
  },
  hikvision: {
    label: 'Hikvision',
    logoUrl: 'https://www.hikvision.com/favicon.ico',
    logoFallback: 'HV',
    color: '#2563eb',
    bgColor: '#eff6ff',
    available: true,
  },
  zkteco: {
    label: 'Zkteco',
    logoUrl: 'https://zkteco.technology/calculator/images/pngwing.com.png',
    logoFallback: 'ZT',
    color: '#2563eb',
    bgColor: '#eff6ff',
    available: true,
  },
};

// Category badge colors
const CAT_BADGE_COLOR = {
  'Router': 'blue',
  'Switch': 'purple',
  'Wireless / AP': 'green',
  'Access Controller': 'teal',
  'Firewall / Security': 'rose',
  'Switch Accessory': 'orange',
  'Software': 'gray',
};

// Segment tag colors
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
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

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

function VendorLogo({ vendor }) {
  const [imgError, setImgError] = useState(false);
  const v = VENDOR_REGISTRY[vendor];
  if (!v) return null;

  if (!imgError) {
    return (
      <img
        src={v.logoUrl}
        alt={v.label}
        className="vendor-logo-img"
        onError={() => setImgError(true)}
        style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
      />
    );
  }
  return (
    <span className="vendor-logo-fallback" style={{ background: v.color, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '4px 6px' }}>
      {v.logoFallback}
    </span>
  );
}

function VendorCard({ vendorKey, vendor, active, onClick }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      className={`vendor-card${active ? ' active' : ''}${!vendor.available ? ' unavailable' : ''}`}
      onClick={() => vendor.available && onClick(vendorKey)}
      style={{ '--vendor-color': vendor.color, '--vendor-bg': vendor.bgColor }}
    >
      <div className="vendor-card-logo">
        {!imgError ? (
          <img src={vendor.logoUrl} alt={vendor.label} onError={() => setImgError(true)}
            style={{ width: 36, height: 36, objectFit: 'contain' }} />
        ) : (
          <span style={{ background: vendor.color, color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 6, padding: '6px 8px' }}>
            {vendor.logoFallback}
          </span>
        )}
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
      </div>
      <span className="product-card-sub" style={{ marginTop: 6, display: 'block', fontSize: 12, color: '#6b7280' }}>{product.sub_category}</span>
      {product.notes && (
        <span style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 3 }}>{product.notes}</span>
      )}
      <div className="product-card-actions">
        <button className="product-card-add-btn" onClick={() => onAdd(product)}>+ Add to BOM</button>
      </div>
    </div>
  );
}

function BomLineItem({ item, onQtyChange, onRemove, onNoteChange }) {
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
      <td>
        <div className="qty-controls">
          <button className="qty-btn" onClick={() => onQtyChange(item.id, Math.max(1, item.qty - 1))}>−</button>
          <input className="qty-input" type="number" min={1} value={item.qty}
            onChange={e => onQtyChange(item.id, Math.max(1, parseInt(e.target.value) || 1))} />
          <button className="qty-btn" onClick={() => onQtyChange(item.id, item.qty + 1)}>+</button>
        </div>
      </td>
      <td>
        <input className="note-input" placeholder="Notes…" value={item.note}
          onChange={e => onNoteChange(item.id, e.target.value)} />
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
  return (
    <div style={{ overflowX: 'auto', marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Model', 'Category', 'Sub-Category', 'Qty', 'Note'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#111827' }}>{item.model}</td>
              <td style={{ padding: '6px 10px', color: '#374151' }}>{item.product_category || '—'}</td>
              <td style={{ padding: '6px 10px', color: '#374151' }}>{item.sub_category || '—'}</td>
              <td style={{ padding: '6px 10px', color: '#374151' }}>{item.qty}</td>
              <td style={{ padding: '6px 10px', color: '#9ca3af' }}>{item.note || item.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DraftCard({ draft, onDelete, onMoveToPricing, onFetchItems }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);

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

  return (
    <div className="draft-card">
      <div className="draft-card-top">
        <div>
          <div className="draft-card-name">{draft.name}</div>
          <div className="draft-card-meta">
            {draft.item_count ?? 0} items · {formatDate(draft.saved_at || draft.savedAt)}
          </div>
        </div>
        <span className={`draft-status-badge ${draft.status}`}>{draft.status}</span>
      </div>
      <div className="draft-card-actions">
        <button className="draft-btn-load" onClick={handleToggle}>
          {expanded ? '▲ Hide Items' : '▼ View Items'}
        </button>
        <button className="draft-btn-forward" onClick={() => onMoveToPricing(draft)}>💰 Move for Pricing</button>
        <button className="draft-btn-delete" onClick={() => onDelete(draft.id)}>Delete</button>
      </div>
      {expanded && <DraftItemsTable items={items} loading={loadingItems} />}
    </div>
  );
}

function PricingCard({ draft, onDelete, onMoveBackToDraft, onFetchItems }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);

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

  return (
    <div className="draft-card pricing-card">
      <div className="draft-card-top">
        <div>
          <div className="draft-card-name">{draft.name}</div>
          <div className="draft-card-meta">
            {draft.item_count ?? 0} items
            {draft.forwarded_at && <> · Moved {formatDate(draft.forwarded_at)}</>}
          </div>
        </div>
        <span className="draft-status-badge pricing">pricing</span>
      </div>
      <div className="draft-card-actions">
        <button className="draft-btn-load" onClick={handleToggle}>
          {expanded ? '▲ Hide Items' : '▼ View Items'}
        </button>
        <button className="draft-btn-back" onClick={() => onMoveBackToDraft(draft)}>↩ Move Back to Drafts</button>
        <button className="draft-btn-delete" onClick={() => onDelete(draft.id)}>Delete</button>
      </div>
      {expanded && <DraftItemsTable items={items} loading={loadingItems} />}
    </div>
  );
}

function SaveDraftModal({ onSave, onClose, existingName }) {
  const [name, setName] = useState(existingName || `BOM Draft ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Save Draft</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">Draft Name</label>
          <input className="modal-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="modal-footer-actions">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="modal-save-btn" onClick={() => name.trim() && onSave(name.trim())}>Save Draft</button>
          </div>
        </div>
      </div>
    </div>
  );
}



// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [vendor, setVendor] = useState('ruijie');

  // Split a single CSV line into columns, respecting quoted fields
  const splitCSVLine = (line) => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += line[i]; }
    }
    cols.push(cur.trim());
    return cols;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = [];

    // ── Hikvision format ──────────────────────────────────────────────────────
    // Row 0: title row  ("HIKVISION – BILL OF MATERIALS…")
    // Row 1: column headers (#, Model Number, Category, Sub-Category, …)
    // Data rows may contain section-header lines (e.g. "▌  CAMERAS") – skip those
    // Columns: 0=#, 1=Model Number, 2=Category, 3=Sub-Category,
    //          4=Resolution, 5=Technology/Series, 6=Key Features, 7=Product Line Tag
    if (vendor === 'hikvision') {
      const dataLines = lines.slice(2); // skip title + header
      for (const line of dataLines) {
        const cols = splitCSVLine(line);
        // Skip section-header rows (no numeric # in col 0, or col 1 is empty)
        if (!cols[1] || isNaN(Number(cols[0]))) continue;
        const productLine = cols[7] || '';
        // Derive a segment from the product line tag
        const segmentMap = {
          'AcuSense': 'Enterprise',
          'DeepinView': 'Enterprise',
          'ColorVu': 'SME / Enterprise',
          'Network Camera': 'SME',
          'DarkFighter / DarkFighterX': 'Enterprise',
          'TandemVu': 'Enterprise',
          'PTZ': 'Enterprise',
          'Access Control': 'SME / Enterprise',
          'Intercom': 'SME',
          'NVR': 'SME / Enterprise',
          'DVR / XVR': 'SME',
          'Storage': 'Enterprise',
          'Video Management Software': 'Enterprise',
          'Alarm System': 'SME',
          'LPR / ANPR': 'Enterprise',
          'Thermal': 'Enterprise',
        };
        const segment = segmentMap[productLine] || (cols[2] ? 'SME / Enterprise' : '');
        parsed.push({
          model: cols[1],
          segment,
          product_category: cols[2] || '',
          sub_category: cols[3] || '',
          wireless_standard: cols[4] || '',   // reused for Resolution
          deployment: cols[5] || '',           // reused for Technology/Series
          management_type: productLine,
          poe: '',
          tag_dc: 0,
          tag_enterprise: segment.includes('Enterprise') ? 1 : 0,
          tag_sme: segment.includes('SME') ? 1 : 0,
          notes: cols[6] || '',               // Key Features
          vendor,
        });
      }
      return parsed;
    }

    // ── ZKTeco format ─────────────────────────────────────────────────────────
    // Row 0: title row  ("ZKTeco BOM – Master Product Catalog…")
    // Row 1: column headers (#, Product/Model, Category, Sub-Category,
    //         Product Line, ZKTeco Segment, Tags, CPU/Hardware, Display,
    //         Capacity, Auth Methods, Communication, IP Rating, Operating Temp,
    //         Dimensions, Key Specs/Notes, Camera Type, Resolution, Technology)
    if (vendor === 'zkteco') {
      const dataLines = lines.slice(2); // skip title + header
      for (const line of dataLines) {
        const cols = splitCSVLine(line);
        // Skip section-header / empty rows
        if (!cols[1] || isNaN(Number(cols[0]))) continue;
        const segment = cols[5] || '';
        const tags     = cols[6] || '';
        parsed.push({
          model: cols[1],
          segment,
          product_category: cols[2] || '',
          sub_category: cols[3] || '',
          wireless_standard: cols[11] || '',  // Communication field
          deployment: cols[4] || '',           // Product Line
          management_type: tags,
          poe: '',
          tag_dc: segment.toLowerCase().includes('data center') ? 1 : 0,
          tag_enterprise: segment.toLowerCase().includes('enterprise') ? 1 : 0,
          tag_sme: segment.toLowerCase().includes('sme') || segment.toLowerCase().includes('smart') ? 1 : 0,
          notes: cols[15] || '',              // Key Specs/Notes
          vendor,
        });
      }
      return parsed;
    }

    // ── Sundray format ────────────────────────────────────────────────────────
    // Row 0: column headers (no title row!)
    // Columns: 0=Model/SKU, 1=Product Category, 2=Sub-Category,
    //          3=Product Line, 4=Wi-Fi Standard, 5=Port Config,
    //          6=PoE Support, 7=Uplink, 8=Filter Tags, 9=Description
    if (vendor === 'sundray') {
      const dataLines = lines.slice(1); // skip only the header row
      for (const line of dataLines) {
        const cols = splitCSVLine(line);
        if (!cols[0]) continue;
        const filterTags = cols[8] || '';
        const segment = filterTags.toLowerCase().includes('data center') ? 'Data Center'
          : filterTags.toLowerCase().includes('enterprise') ? 'Enterprise'
          : 'SME / Enterprise';
        parsed.push({
          model: cols[0],
          segment,
          product_category: cols[1] || '',
          sub_category: cols[2] || '',
          wireless_standard: cols[4] || '',
          deployment: cols[3] || '',
          management_type: '',
          poe: cols[6] || '',
          tag_dc: segment === 'Data Center' ? 1 : 0,
          tag_enterprise: segment.includes('Enterprise') ? 1 : 0,
          tag_sme: segment.includes('SME') ? 1 : 0,
          notes: cols[9] || '',
          vendor,
        });
      }
      return parsed;
    }

    // ── Ruijie format (default) ───────────────────────────────────────────────
    // Row 0: title row  ("RUIJIE NETWORKS – FULL PRODUCT BOM…")
    // Row 1: column headers
    // Columns: 0=Model, 1=Segment, 2=Category, 3=Sub-Category,
    //          4=Wireless Standard, 5=Deployment, 6=Management Type,
    //          7=PoE, 8=DC Tag, 9=Enterprise Tag, 10=SME Tag, 13=Notes
    const dataLines = lines.slice(2);
    for (const line of dataLines) {
      const cols = splitCSVLine(line);
      if (cols.length >= 3 && cols[0]) {
        parsed.push({
          model: cols[0],
          segment: cols[1] || '',
          product_category: cols[2] || '',
          sub_category: cols[3] || '',
          wireless_standard: cols[4] || '',
          deployment: cols[5] || '',
          management_type: cols[6] || '',
          poe: cols[7] || '',
          tag_dc: cols[8]?.includes('✓') ? 1 : 0,
          tag_enterprise: cols[9]?.includes('✓') ? 1 : 0,
          tag_sme: cols[10]?.includes('✓') ? 1 : 0,
          notes: cols[13] || cols[11] || '',
          vendor,
        });
      }
    }
    return parsed;
  };

  const handleFileChange = (e) => {
    setError('');
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv'].includes(ext)) { setError('Only CSV files are supported for import.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (!rows.length) { setError('No valid product rows found in file.'); return; }
        setPreview(rows.slice(0, 5));
        fileRef.current._parsed = rows;
      } catch (err) {
        setError('Failed to parse file. Please ensure it matches the expected format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileRef.current?._parsed?.length) { setError('Please select a valid file first.'); return; }
    setImporting(true);
    try {
      await onImport(fileRef.current._parsed, vendor);
      onClose();
    } catch (err) {
      setError(err.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📥 Import Products from CSV</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0369a1' }}>
            <strong>Expected CSV columns:</strong> Product Model, Segment, Product Category, Sub-Category, Wireless Standard, Deployment, Management Type, PoE, DC Tag, Enterprise Tag, SME Tag, Notes
          </div>

          <label className="modal-label">Vendor / Company</label>
          <select className="modal-input" value={vendor} onChange={e => setVendor(e.target.value)} style={{ marginBottom: 14 }}>
            {Object.entries(VENDOR_REGISTRY).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>

          <label className="modal-label">Select CSV File</label>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange}
            style={{ display: 'block', marginBottom: 14, padding: '8px', border: '1px dashed #d1d5db', borderRadius: 8, width: '100%', cursor: 'pointer', background: '#fafafa' }} />

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>⚠ {error}</p>}

          {preview.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Preview ({fileRef.current?._parsed?.length} rows found — showing first 5):
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Model', 'Segment', 'Category', 'Sub-Category', 'PoE'].map(h => (
                        <th key={h} style={{ padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{row.model}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{row.segment}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{row.product_category}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{row.sub_category}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{row.poe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="modal-footer-actions">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="modal-save-btn" onClick={handleImport} disabled={importing || !preview.length}>
              {importing ? '⏳ Importing…' : `📥 Import ${fileRef.current?._parsed?.length || 0} Products`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main BOM Component ───────────────────────────────────────────────────────
const Bom = ({ loggedInUser }) => {
  const [activeVendor, setActiveVendor] = useState('ruijie');
  const [activeSegment, setActiveSegment] = useState('ALL');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeSubcategory, setActiveSubcategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [bomList, setBomList] = useState([]);
  const [tab, setTab] = useState('catalog');

  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [currentDraftName, setCurrentDraftName] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch products from DB ──
  const fetchProducts = useCallback(async (vendorKey) => {
    setLoadingProducts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bom/products`, { params: { vendor: vendorKey } });
      if (res.data.success) setProducts(res.data.products);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { fetchProducts(activeVendor); }, [activeVendor, fetchProducts]);

  // ── Fetch drafts ──
  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bom/drafts`);
      if (res.data.success) setDrafts(res.data.drafts);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const draftItems   = drafts.filter(d => d.status === 'draft');
  const pricingItems = drafts.filter(d => d.status === 'pricing');

  const vendor = VENDOR_REGISTRY[activeVendor];

  // ── Filter derived data ──
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

  // ── BOM handlers ──
  const handleAddToBom = useCallback((product) => {
    setBomList(prev => {
      const existing = prev.find(i => i.product_id === product.id && i.vendor === product.vendor);
      if (existing) return prev.map(i => (i.product_id === product.id && i.vendor === product.vendor) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, id: uid(), product_id: product.id, qty: 1, note: '' }];
    });
    showToast(`"${product.model}" added to BOM`);
  }, []);

  const handleQtyChange = (id, qty) => setBomList(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  const handleRemove = (id) => setBomList(prev => prev.filter(i => i.id !== id));
  const handleNoteChange = (id, note) => setBomList(prev => prev.map(i => i.id === id ? { ...i, note } : i));

  // ── Draft handlers ──
  const handleSaveDraft = async (name) => {
    try {
      const payload = {
        id: currentDraftId,
        name,
        vendor: activeVendor,
        items: bomList.map(i => ({ product_id: i.product_id || i.id, model: i.model, vendor: i.vendor, qty: i.qty, note: i.note })),
        status: 'draft',
        created_by: loggedInUser?.id,
      };
      const res = await axios.post(`${API_BASE_URL}/api/bom/drafts`, payload);
      if (res.data.success) {
        setCurrentDraftId(res.data.id);
        setCurrentDraftName(name);
        setShowSaveDraftModal(false);
        fetchDrafts();
        showToast('Draft saved successfully!');
      }
    } catch (err) {
      showToast('Failed to save draft.', 'error');
    }
  };

  // Fetch items inline for card expand
  const handleFetchDraftItems = async (draftId) => {
    const res = await axios.get(`${API_BASE_URL}/api/bom/drafts/${draftId}`);
    if (!res.data.success) throw new Error('Failed to fetch items');
    return res.data.items || [];
  };

  const handleDeleteDraft = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/bom/drafts/${id}`);
      fetchDrafts();
      showToast('Draft deleted.');
    } catch (err) {
      showToast('Failed to delete draft.', 'error');
    }
  };

  const handleMoveToPricing = async (draft) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draft.id}/forward`);
      await fetchDrafts();
      setTab('pricing');
      showToast(`"${draft.name}" moved to Pricing.`);
    } catch (err) {
      showToast('Failed to move to pricing.', 'error');
    }
  };

  const handleMoveBackToDraft = async (draft) => {
    try {
      await axios.put(`${API_BASE_URL}/api/bom/drafts/${draft.id}/status`, { status: 'draft' });
      fetchDrafts();
      showToast(`"${draft.name}" moved back to Drafts.`);
    } catch (err) {
      showToast('Failed to move back to drafts.', 'error');
    }
  };

  // ── Import handler ──
  const handleImport = async (rows, vendorKey) => {
    const res = await axios.post(`${API_BASE_URL}/api/bom/products/import`, { products: rows, vendor: vendorKey });
    if (!res.data.success) throw new Error(res.data.error || 'Import failed');
    fetchProducts(vendorKey);
    showToast(`✅ ${rows.length} products imported successfully!`);
  };

  const handleVendorSwitch = (key) => {
    setActiveVendor(key);
    setActiveSegment('ALL');
    setActiveCategory('ALL');
    setActiveSubcategory('ALL');
    setSearchQuery('');
  };

  const isAdmin = loggedInUser?.role === 'admin';

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
          {(
            <button className="bom-import-btn" onClick={() => setShowImportModal(true)}>
              📥 Import Products
            </button>
          )}
          {bomList.length > 0 && (
            <button className="bom-save-draft-btn" onClick={() => setShowSaveDraftModal(true)}>
              💾 Save Draft
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast-${toast.type || 'success'}`}>{toast.msg}</div>
      )}

      {/* Tabs */}
      <div className="bom-tabs">
        <button className={`tab-btn${tab === 'catalog' ? ' active' : ''}`} onClick={() => setTab('catalog')}>
          Product Catalog
        </button>
        <button className={`tab-btn${tab === 'bom' ? ' active' : ''}`} onClick={() => setTab('bom')}>
          BOM List {bomList.length > 0 && <span className="tab-badge">{totalItems}</span>}
        </button>
        <button className={`tab-btn${tab === 'drafts' ? ' active' : ''}`} onClick={() => setTab('drafts')}>
          Drafts {draftItems.length > 0 && <span className="tab-badge tab-badge-gray">{draftItems.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'pricing' ? ' active' : ''}`} onClick={() => setTab('pricing')}>
          Pricing {pricingItems.length > 0 && <span className="tab-badge tab-badge-amber">{pricingItems.length}</span>}
        </button>
      </div>

      {/* ── CATALOG TAB ── */}
      {tab === 'catalog' && (
        <div>
          {/* Vendor selector */}
          <div className="vendor-selector">
            {Object.entries(VENDOR_REGISTRY).map(([key, v]) => (
              <VendorCard key={key} vendorKey={key} vendor={v} active={activeVendor === key} onClick={handleVendorSwitch} />
            ))}
          </div>

          {!vendor.available ? (
            <div className="catalog-empty">
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔜</div>
              <p style={{ fontWeight: 600, color: '#374151' }}>{vendor.label} catalog coming soon.</p>
              <p style={{ color: '#9ca3af', fontSize: 13 }}>Products will be available once the catalog is loaded.</p>
            </div>
          ) : loadingProducts ? (
            <div className="catalog-empty"><span>⏳ Loading products…</span></div>
          ) : (
            <>
              {/* Search */}
              <div className="bom-search-bar">
                <input
                  className="bom-search-input"
                  placeholder={`Search ${vendor.label} models, categories, or notes…`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
                )}
              </div>

              {/* Segment Pills (company-based tagging) */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Segment</span>
                <div className="bom-category-pills" style={{ display: 'inline-flex' }}>
                  <button className={`category-pill${activeSegment === 'ALL' ? ' active' : ''}`}
                    onClick={() => { setActiveSegment('ALL'); setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>
                    All
                  </button>
                  {segments.map(seg => (
                    <button key={seg}
                      className={`category-pill${activeSegment === seg ? ' active' : ''}`}
                      onClick={() => { setActiveSegment(seg); setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>
                      {seg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Pills */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Category</span>
                <div className="bom-category-pills" style={{ display: 'inline-flex' }}>
                  <button className={`category-pill${activeCategory === 'ALL' ? ' active' : ''}`}
                    onClick={() => { setActiveCategory('ALL'); setActiveSubcategory('ALL'); }}>
                    All
                  </button>
                  {categories.map(cat => (
                    <button key={cat}
                      className={`category-pill${activeCategory === cat ? ' active' : ''}`}
                      onClick={() => { setActiveCategory(cat); setActiveSubcategory('ALL'); }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategory Pills */}
              {activeCategory !== 'ALL' && subcategories.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Sub-Category</span>
                  <div className="bom-subcategory-pills" style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
                    <button className={`subcategory-pill${activeSubcategory === 'ALL' ? ' active' : ''}`}
                      onClick={() => setActiveSubcategory('ALL')}>
                      All
                    </button>
                    {subcategories.map(sub => (
                      <button key={sub}
                        className={`subcategory-pill${activeSubcategory === sub ? ' active' : ''}`}
                        onClick={() => setActiveSubcategory(sub)}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="bom-product-count">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                {bomList.length > 0 && (
                  <span className="bom-list-peek" onClick={() => setTab('bom')}>
                    · View BOM list ({totalItems} units) →
                  </span>
                )}
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
                  {isAdmin && products.length === 0 && (
                    <button className="browse-btn" onClick={() => setShowImportModal(true)}>📥 Import Products Now</button>
                  )}
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
              </div>

              <div className="bom-table-wrapper">
                <table className="bom-table">
                  <thead>
                    <tr>
                      {['Model / Vendor', 'Category', 'Sub-Category / Segment', 'Quantity', 'Notes', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bomList.map(item => (
                      <BomLineItem key={item.id} item={item} onQtyChange={handleQtyChange} onRemove={handleRemove} onNoteChange={handleNoteChange} />
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
              <p className="empty-sub">Build a BOM list and save it as a draft to move for pricing.</p>
              <button className="browse-btn" onClick={() => setTab('catalog')}>Start Building</button>
            </div>
          ) : (
            <div className="drafts-list">
              <p className="drafts-hint">Click "View Items" to see the products inside a draft. Click "Move for Pricing" to send it to the Pricing tab.</p>
              {draftItems.map(draft => (
                <DraftCard key={draft.id} draft={draft} onDelete={handleDeleteDraft} onMoveToPricing={handleMoveToPricing} onFetchItems={handleFetchDraftItems} />
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
              <p className="empty-sub">Go to Drafts and click "Move for Pricing" on a saved BOM.</p>
              <button className="browse-btn" onClick={() => setTab('drafts')}>Go to Drafts</button>
            </div>
          ) : (
            <div className="drafts-list">
              <p className="drafts-hint">Click "View Items" to see all products. Move back to Drafts if changes are needed.</p>
              {pricingItems.map(draft => (
                <PricingCard key={draft.id} draft={draft} onDelete={handleDeleteDraft} onMoveBackToDraft={handleMoveBackToDraft} onFetchItems={handleFetchDraftItems} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showSaveDraftModal && (
        <SaveDraftModal existingName={currentDraftName} onSave={handleSaveDraft} onClose={() => setShowSaveDraftModal(false)} />
      )}
      {showImportModal && (
        <ImportModal onImport={handleImport} onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
};

export default Bom;