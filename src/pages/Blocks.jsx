import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';

const parseSafe = async (res) => {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch { return '—'; }
};

const Blocks = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Catálogos para mostrar nombres
  const [routeMasters, setRouteMasters] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [catLoading, setCatLoading] = useState(true);

  const [filtro, setFiltro] = useState('');
  const [actualizando, setActualizando] = useState(false);

  // expandir filas (para ver paradas)
  const [expanded, setExpanded] = useState(() => new Set());
  const isExpanded = useCallback((id) => expanded.has(id), [expanded]);
  const toggleExpanded = useCallback((id) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  // --- Generar servicio ---
  const [modalGenVisible, setModalGenVisible] = useState(false);
  const [blockForGen, setBlockForGen] = useState(null);
  const [genForm, setGenForm] = useState({ date: '', time: '' });
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // default de fecha: hoy (formato yyyy-mm-dd)
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const openGenerateModal = (b) => {
    setBlockForGen(b);
    setGenResult(null);
    setGenForm({ date: todayStr, time: '08:00' });
    setModalGenVisible(true);
  };

  const closeGenerateModal = () => {
    setModalGenVisible(false);
    setBlockForGen(null);
    setGenForm({ date: '', time: '' });
    setGenResult(null);
  };

  // Nombre de RM y Layout (usando tus mapas ya existentes)
  const getRMName = (b) => {
    const rmId = typeof b.routeMaster === 'object' ? b.routeMaster?._id : b.routeMaster;
    return (typeof b.routeMaster === 'object' ? b.routeMaster?.name : routeMastersMap[rmId]?.name) || (rmId ? `${rmId.slice(0, 8)}…` : '—');
  };
  const getLayoutName = (b) => {
    const layId = typeof b.layout === 'object' ? b.layout?._id : b.layout;
    return (typeof b.layout === 'object' ? b.layout?.name : layoutsMap[layId]?.name) || (layId ? `${layId.slice(0, 8)}…` : '—');
  };

  // Puede guardar solo si tiene fecha (yyyy-mm-dd) y hora (HH:mm)
  const canGenerate = useMemo(() => {
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(genForm.date || '');
    const okTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(genForm.time || '');
    return !!blockForGen && okDate && okTime;
  }, [blockForGen, genForm]);
    
  const generateService = async () => {
    if (!canGenerate || !blockForGen) return;

    const blockId = blockForGen._id;
    const layId = typeof blockForGen.layout === 'object'
      ? blockForGen.layout?._id
      : blockForGen.layout;

    if (!layId) {
      showToast('Layout faltante', 'Este bloque no tiene un layout asociado. Edítalo y asigna un layout.', true);
      return;
    }

    const payload = {
      routeBlockId: blockId,
      date: genForm.date,      
      time: genForm.time,     
      layoutId: layId
    };

    setGenerating(true);
    setGenResult(null);
    try {
      // Úsalo con slash final (evita 404/redirects en CORS)
      const res = await fetch("https://boletos.dev-wit.com/api/route-blocks-generated/generate/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }

      if (!res.ok) {
        const msg = body?.error || body?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      setGenResult(body);
      showToast('Servicio generado', `Bloque "${blockForGen.name}" — ${genForm.date} ${genForm.time}`);
    } catch (e) {
      console.error('[Generate Service] Payload →', payload);
      console.error('[Generate Service] Error →', e);
      showToast('Error', e.message || 'No se pudo generar el servicio', true);
    } finally {
      setGenerating(false);
    }
  };

  // Cargar blocks + catálogos
  useEffect(() => {
    let cancel = false;
    const fetchAll = async () => {
      setLoading(true);
      setCatLoading(true);
      setErrorMsg('');

      try {
        const [resBlocks, resRM, resLayouts] = await Promise.all([
          fetch('https://boletos.dev-wit.com/api/route-blocks/'),
          fetch('https://boletos.dev-wit.com/api/route-masters/'),
          fetch('https://boletos.dev-wit.com/api/layouts/'),
        ]);

        const [bodyBlocks, bodyRM, bodyLayouts] = await Promise.all([
          parseSafe(resBlocks),
          parseSafe(resRM),
          parseSafe(resLayouts),
        ]);

        if (!resBlocks.ok) throw new Error(bodyBlocks?.message || 'No se pudieron cargar los bloques');
        if (!Array.isArray(bodyBlocks)) throw new Error('La API de bloques no devolvió una lista');

        // Catálogos: si fallan, mostramos id truncado
        const rmList = Array.isArray(bodyRM) ? bodyRM : [];
        const layList = Array.isArray(bodyLayouts) ? bodyLayouts : [];

        if (!cancel) {
          setBlocks(bodyBlocks);
          setRouteMasters(rmList);
          setLayouts(layList);
        }
      } catch (e) {
        console.error(e);
        if (!cancel) {
          setErrorMsg(e.message || 'Error al cargar datos');
          setBlocks([]);
          showToast('Error', e.message || 'No se pudo cargar la lista de bloques', true);
        }
      } finally {
        if (!cancel) {
          setLoading(false);
          setCatLoading(false);
        }
      }
    };
    fetchAll();
    return () => { cancel = true; };
  }, []);

  // Mapas id->obj para mostrar nombres
  const routeMastersMap = useMemo(
    () => Object.fromEntries(routeMasters.filter(r => r && r._id).map(r => [r._id, r])),
    [routeMasters]
  );
  const layoutsMap = useMemo(
    () => Object.fromEntries(layouts.filter(l => l && l._id).map(l => [l._id, l])),
    [layouts]
  );

  // Filtro simple por nombre de bloque / nombre de RM / nombre de layout / paradas
  const norm = (v) => (v ?? '').toString().toLowerCase();
  const blocksFiltrados = useMemo(() => {
    const t = norm(filtro);
    if (!t) return blocks;
    return blocks.filter(b => {
      const rmId = typeof b.routeMaster === 'object' ? b.routeMaster?._id : b.routeMaster;
      const rmName = typeof b.routeMaster === 'object'
        ? b.routeMaster?.name
        : routeMastersMap[rmId]?.name;

      const layId = typeof b.layout === 'object' ? b.layout?._id : b.layout;
      const layName = typeof b.layout === 'object'
        ? b.layout?.name
        : layoutsMap[layId]?.name;

      const inStops = (b.stops || []).some(s => norm(s?.name).includes(t));

      return (
        norm(b.name).includes(t) ||
        norm(rmName).includes(t) ||
        norm(layName).includes(t) ||
        inStops
      );
    });
  }, [blocks, filtro, routeMastersMap, layoutsMap]);

  // Refresh
  const handleActualizar = async () => {
    setActualizando(true);
    try {
      const res = await fetch('https://boletos.dev-wit.com/api/route-blocks/');
      const body = await parseSafe(res);
      if (!res.ok) throw new Error(body?.message || 'No se pudo actualizar la lista de bloques');
      if (!Array.isArray(body)) throw new Error('La API no devolvió una lista de bloques');
      setBlocks(body);
      showToast('Actualizado', 'Listado de bloques sincronizado');
    } catch (e) {
      console.error(e);
      showToast('Error', e.message || 'No se pudo sincronizar', true);
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="blocks" />

      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Bloques de rutas</h1>
          <p className="text-muted">Visualiza los bloques y sus paradas asociadas</p>
        </div>

        <div className="stats-box">
          {/* Encabezado moderno: título + acciones arriba, buscador abajo */}
          <div className="d-flex flex-column gap-2 mb-3">
            {/* Fila 1 */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0">Listado de bloques</h5>
                <span className="badge bg-light text-secondary border">
                  {blocksFiltrados.length} {blocksFiltrados.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleActualizar}
                  disabled={actualizando}
                >
                  {actualizando
                    ? <Spinner animation="border" size="sm" />
                    : (<><i className="bi bi-arrow-repeat me-1" />Actualizar</>)}
                </button>
              </div>
            </div>

            {/* Fila 2: buscador */}
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                className="form-control"
                placeholder="Buscar por nombre de bloque, ruta, layout o parada…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                aria-label="Buscar bloques"
              />
              {filtro && (
                <button className="btn btn-outline-secondary" onClick={() => setFiltro('')}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando bloques…</p>
            </div>
          ) : errorMsg ? (
            <div className="alert alert-danger" role="alert">
              {errorMsg}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 48 }} aria-label="Expandir"></th>
                    <th>Bloque</th>
                    <th>Ruta Maestra</th>
                    <th>Layout</th>
                    <th style={{ width: 110 }}>Paradas</th>
                    <th style={{ width: 170 }}>Creado</th>
                    <th style={{ width: 170 }}>Actualizado</th>
                    <th style={{ width: 160 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {blocksFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <div className="d-flex justify-content-between align-items-center p-3 border rounded bg-light">
                          <div>
                            <strong>Sin resultados</strong>
                            <div className="text-muted small">Prueba con otro término o limpia el filtro.</div>
                          </div>
                          {filtro && (
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => setFiltro('')}>
                              Limpiar filtro
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {blocksFiltrados.map((b) => {
                    const rmId = typeof b.routeMaster === 'object' ? b.routeMaster?._id : b.routeMaster;
                    const rmName = typeof b.routeMaster === 'object'
                      ? b.routeMaster?.name
                      : routeMastersMap[rmId]?.name;

                    const layId = typeof b.layout === 'object' ? b.layout?._id : b.layout;
                    const layName = typeof b.layout === 'object'
                      ? b.layout?.name
                      : layoutsMap[layId]?.name;

                    const paradas = Array.isArray(b.stops) ? b.stops.length : 0;

                    return (
                      <React.Fragment key={b._id}>
                        <tr className={isExpanded(b._id) ? 'table-active' : ''}>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleExpanded(b._id)}
                              aria-expanded={isExpanded(b._id)}
                              aria-controls={`stops-${b._id}`}
                              title={isExpanded(b._id) ? 'Ocultar paradas' : 'Ver paradas'}
                            >
                              <i className={`bi ${isExpanded(b._id) ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                            </button>
                          </td>

                          <td className="fw-semibold">{b.name || '—'}</td>

                          <td title={rmName || rmId || ''}>
                            {catLoading
                              ? <Spinner animation="border" size="sm" />
                              : (rmName || (rmId ? `${rmId.slice(0, 8)}…` : '—'))}
                          </td>

                          <td title={layName || layId || ''}>
                            {catLoading
                              ? <Spinner animation="border" size="sm" />
                              : (layName || (layId ? `${layId.slice(0, 8)}…` : '—'))}
                          </td>

                          <td>
                            <span
                              className="badge bg-info-subtle text-info-emphasis border"
                              style={{ '--bs-badge-font-size': '0.95rem' }}
                            >
                              {paradas}
                            </span>
                          </td>

                          <td className="text-muted small">{formatDate(b.createdAt)}</td>
                          <td className="text-muted small">{formatDate(b.updatedAt)}</td>

                          {/* ACCIONES */}
                          <td className="text-nowrap">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Generar servicio para este bloque"
                              onClick={() => openGenerateModal(b)}
                            >
                              <i className="bi bi-calendar-plus me-1" />
                              Generar
                            </button>
                          </td>
                        </tr>

                        {isExpanded(b._id) && (
                          <tr id={`stops-${b._id}`}>
                            <td colSpan={8}>
                              <div className="p-2 border rounded bg-light">
                                <div className="d-flex align-items-center mb-2">
                                  <i className="bi bi-signpost-2 me-2" />
                                  <h6 className="mb-0">Paradas</h6>
                                </div>
                                <div className="table-responsive">
                                  <table className="table table-sm table-striped mb-0">
                                    <thead>
                                      <tr>
                                        <th style={{ width: 60 }}>#</th>
                                        <th>Nombre</th>
                                        <th className="text-muted">ID</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...(b.stops || [])]
                                        .sort((a, c) => (a.order || 0) - (c.order || 0))
                                        .map((s) => (
                                          <tr key={s._id || `${s.name}-${s.order}`}>
                                            <td>{s.order}</td>
                                            <td>{s.name}</td>
                                            <td className="text-muted small">{s._id || '—'}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ModalBase
          visible={modalGenVisible}
          title={`Generar servicio — ${blockForGen?.name || ''}`}
          onClose={closeGenerateModal}
        >
          {!blockForGen ? (
            <div className="text-muted">Selecciona un bloque para continuar.</div>
          ) : (
            <div className="p-2">
              {/* Resumen del bloque */}
              <div className="mb-3">
                <div className="small text-muted">Ruta maestra</div>
                <div className="fw-semibold">{getRMName(blockForGen)}</div>
                <div className="small text-muted mt-2">Layout</div>
                <div>{getLayoutName(blockForGen)}</div>
              </div>

              {/* Formulario */}
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={genForm.date}
                    min={todayStr}
                    onChange={(e) => setGenForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold">Hora</label>
                  <input
                    type="time"
                    className="form-control"
                    value={genForm.time}
                    step={300} // saltos de 5 min
                    onChange={(e) => setGenForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top">
                <button className="btn btn-secondary" onClick={closeGenerateModal} disabled={generating}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={generateService}
                  disabled={!canGenerate || generating}
                  title={canGenerate ? 'Generar servicio' : 'Completa fecha y hora'}
                >
                  {generating ? <><Spinner animation="border" size="sm" /> Generando…</> : 'Generar servicio'}
                </button>
              </div>

              {/* Resultado (preview) */}
              {genResult && (
                <div className="alert alert-success mt-3 mb-0">
                  <div className="fw-semibold mb-1">{genResult?.message || 'Servicio generado correctamente'}</div>
                  <div className="small">
                    ID: <span className="text-monospace">{genResult?.data?._id || '—'}</span><br />
                    Fecha: {genResult?.data?.date ? new Date(genResult.data.date).toLocaleDateString() : '—'} · Hora: {genResult?.data?.time || '—'}<br />
                    Tramos: {Array.isArray(genResult?.data?.segments) ? genResult.data.segments.length : 0} · Asientos: {genResult?.data?.seatMatrix ? Object.keys(genResult.data.seatMatrix).length : 0}
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalBase>
      </main>
    </div>
  );
};

export default Blocks;
