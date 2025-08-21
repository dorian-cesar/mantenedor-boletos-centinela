import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';
import RutaEditor from '@components/RutaEditor/RutaEditor';
import Swal from 'sweetalert2';
import { ReactSortable } from 'react-sortablejs';

const Rutas = () => {
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Modal crear/editar ruta (solo para crear ahora; el botón de fila abre bloques)
  const [modalRutaVisible, setModalRutaVisible] = useState(false);
  const [rutaEditando, setRutaEditando] = useState(null); // se usa solo para PUT si reactivas edición
  const [formRuta, setFormRuta] = useState({ name: '', origin: '', destination: '', stops: [] });

  // Catálogo de ciudades
  const [ciudades, setCiudades] = useState([]);

  // Expandir paradas en la tabla
  const [rutasExpandida, setRutasExpandida] = useState(null);

  // Modal de BLOQUES por route master
  const [modalBlocksVisible, setModalBlocksVisible] = useState(false);
  const [routeMasterForBlocks, setRouteMasterForBlocks] = useState(null);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState('');
  const [blocksData, setBlocksData] = useState(null); // { routeMaster, totalBlocks, blocks: [...] }
  const [actualizando, setActualizando] = useState(false);
  const [blockLayoutId, setBlockLayoutId] = useState('');
  const [availableLayouts, setAvailableLayouts] = useState([]);
  const [layoutsLoading, setLayoutsLoading] = useState(false);
  const [layoutsError, setLayoutsError] = useState('');

  // Opciones de paradas permitidas desde la ruta maestra, con su orden original
  const allowedRMStopOptions = useMemo(() => {
    const stops = routeMasterForBlocks?.stops || [];
    return [...stops]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => ({ name: s.name, order: s.order }));
  }, [routeMasterForBlocks]);

  const allowedRMStops = useMemo(
    () => allowedRMStopOptions.map(s => s.name),
    [allowedRMStopOptions]
  );


  const fetchLayouts = async () => {
    setLayoutsLoading(true);
    setLayoutsError('');
    setAvailableLayouts([]);
    try {
      const res = await fetch('https://boletos.dev-wit.com/api/layouts/');
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { throw new Error('Respuesta no JSON al listar layouts'); }

      if (!res.ok || !Array.isArray(body)) {
        throw new Error('No se pudo obtener la lista de layouts');
      }

      const list = body
      .map(l => ({
        _id: l._id,          
        name: l.name,
        pisos: l.pisos,
        capacidad: l.capacidad,
        columns: l.columns,
        rows: l.rows,
        tipo_Asiento_piso_1: l.tipo_Asiento_piso_1,
        tipo_Asiento_piso_2: l.tipo_Asiento_piso_2,
      }))
      .filter(l => l._id);

      setAvailableLayouts(list);
    } catch (e) {
      setLayoutsError(e.message || 'Error al cargar layouts');
    } finally {
      setLayoutsLoading(false);
    }
  };

  // Filtro de tabla
  const [filtro, setFiltro] = useState('');

  // Lista filtrada (por nombre, origen, destino, o nombre de parada)
  const rutasFiltradas = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    if (!term) return rutas;
    return rutas.filter(r => {
      const name = (r?.name || '').toLowerCase();
      const origen = (r?.stops?.[0]?.name || '').toLowerCase();
      const destino = (r?.stops?.[r?.stops?.length - 1]?.name || '').toLowerCase();
      const anyStop = (r?.stops || []).some(s => (s?.name || '').toLowerCase().includes(term));
      return name.includes(term) || origen.includes(term) || destino.includes(term) || anyStop;
    });
  }, [rutas, filtro]);

  // Para el chevron accesible
  const isExpanded = (id) => rutasExpandida === id;


  // opcional: cargar cuando abres el modal de blocks
  useEffect(() => {
    if (modalBlocksVisible) fetchLayouts();
  }, [modalBlocksVisible]);

  // ayuda para etiqueta y selección actual
  const selectedLayout = useMemo(
    () => availableLayouts.find(l => l._id === blockLayoutId) || null,
    [availableLayouts, blockLayoutId]
  );

  const layoutLabel = (l) =>
    `${l.name} • ${l.pisos ?? '-'} pisos • ${l.capacidad ?? '-'} pax • ${l.columns ?? '-'}×${l.rows ?? '-'}`;

  // Helpers
  const parseResponseSafe = async (res) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { _raw: text }; }
  };

  // helper cerrar modal
  const closeBlocksModal = React.useCallback(() => {
    setModalBlocksVisible(false);
    setBlocksData(null);
    setBlocksError('');
    setRouteMasterForBlocks(null);
    setBlockMode('view');
    setEditingBlockId(null);
    setBlockForm({ name: '', stops: [] });
    setBlockLayoutId('');
  }, []);


  // ---- CATALOGOS ----
  useEffect(() => {
    const fetchCiudades = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/cities');
        const data = await res.json();
        setCiudades(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error al cargar ciudades:', err);
      }
    };
    fetchCiudades();
  }, []);

  // ---- CARGA INICIAL RUTAS (route-masters) ----
  useEffect(() => {
    const fetchRutas = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/route-masters');
        const data = await res.json();
        setRutas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error al cargar rutas maestras:', error);
      } finally {
        setCargando(false);
      }
    };
    fetchRutas();
  }, []);

  const toggleExpandirRuta = (rutaId) => {
    setRutasExpandida((prev) => (prev === rutaId ? null : rutaId));
  };

  // ---- CREAR (opcionalmente editar) RUTA MAESTRA ----
  const abrirModalNuevaRuta = () => {
    setRutaEditando(null);
    setFormRuta({ name: '', origin: '', destination: '', stops: [] });
    setModalRutaVisible(true);
  };

  const handleGuardarRuta = async () => {
    const esNuevaRuta = !rutaEditando;

    const todasLasParadas = [
      formRuta.origin,
      ...(Array.isArray(formRuta.stops) ? formRuta.stops.map((s) => s.city) : []),
      formRuta.destination,
    ].filter((x) => typeof x === 'string' && x.trim());

    if (todasLasParadas.length < 2) {
      showToast('Datos incompletos', 'Debes seleccionar al menos origen y destino', true);
      return;
    }

    const stopsConOrden = todasLasParadas.map((name, i) => ({ name, order: i + 1 }));

    const dataAGuardar = { name: formRuta.name, stops: stopsConOrden };
    const endpoint = esNuevaRuta
      ? 'https://boletos.dev-wit.com/api/route-masters'
      : `https://boletos.dev-wit.com/api/route-masters/${encodeURIComponent(rutaEditando)}`;
    const metodo = esNuevaRuta ? 'POST' : 'PUT';

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataAGuardar),
      });
      const body = await parseResponseSafe(res);

      if (!res.ok) {
        const msg = body?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      const rutaGuardada = body;
      setRutas((prev) => (esNuevaRuta ? [...prev, rutaGuardada] : prev.map((t) => (t._id === rutaEditando ? rutaGuardada : t))));
      showToast(esNuevaRuta ? 'Ruta maestra creada' : 'Ruta maestra actualizada', esNuevaRuta ? 'Se creó correctamente' : 'Cambios guardados');
      setModalRutaVisible(false);
      setRutaEditando(null);
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'No se pudo guardar la ruta maestra', true);
    }
  };

  const handleEliminar = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar ruta maestra?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/route-masters/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');

      setRutas((prev) => prev.filter((t) => t._id !== id));
      await Swal.fire('Ruta eliminada', 'La ruta maestra fue eliminada exitosamente.', 'success');
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'No se pudo eliminar la ruta maestra', 'error');
    }
  };
  
  // Modal de Blocks
  const fetchBlocksByRouteMaster = async (id) => {
    if (!id) {
      setBlocksError('Falta el ID de la ruta maestra.');
      return;
    }
    setBlocksLoading(true);
    setBlocksError('');
    setBlocksData(null);  

    const url = `https://boletos.dev-wit.com/api/route-blocks/byRouteMaster/${encodeURIComponent(id)}`;

    try {
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } 
      catch { throw new Error(`Respuesta no JSON del servidor (status ${res.status}): ${text.slice(0,200)}…`); }

      if (!res.ok) {
        const msg = body?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      setBlocksData(body);
      setBlocksCountMap(prev => ({
      ...prev,
      [id]: typeof body?.totalBlocks === 'number' ? body.totalBlocks : (prev[id] ?? 0)
      }));
    } catch (e) {
      console.error('fetchBlocksByRouteMaster error:', e);
      setBlocksError(e.message || 'No se pudieron obtener los bloques para esta ruta maestra.');
    } finally {
      setBlocksLoading(false);
    }
  };

  const handleVerBlocks = (ruta) => {
    setRouteMasterForBlocks(ruta);
    setModalBlocksVisible(true);
    fetchBlocksByRouteMaster(ruta._id);
  };

  // --- Blocks CRUD state ---
  const [blockMode, setBlockMode] = useState('view'); // 'view' | 'create' | 'edit'
  const [blockForm, setBlockForm] = useState({ name: '', stops: [] }); // stops: [{ name, order }]
  const [editingBlockId, setEditingBlockId] = useState(null);

  const canSave = useMemo(() => {
  const nameOk = !!blockForm?.name?.trim();
  const stopsArr = (blockForm?.stops || []).filter(s => s?.name?.trim());
  const stopsOk = stopsArr.length >= 2 && stopsArr.every(s => allowedRMStops.includes(s.name));
  const layoutOk = /^[a-f0-9]{24}$/i.test(String(blockLayoutId || '').trim());
    return nameOk && stopsOk && layoutOk;
  }, [blockForm, blockLayoutId, allowedRMStops]);

  // Totales de bloques por route master
  const [blocksCountMap, setBlocksCountMap] = useState({});
  const blocksCountFetching = React.useRef(new Set());

  const ensureBlocksCount = useCallback(async (id) => {
    if (!id) return;
    if (blocksCountFetching.current.has(id)) return;
    if (Object.prototype.hasOwnProperty.call(blocksCountMap, id)) return;

    blocksCountFetching.current.add(id);
    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/route-blocks/byRouteMaster/${encodeURIComponent(id)}`);
      const text = await res.text();
      let body; try { body = JSON.parse(text); } catch { body = null; }
      const total = (body && typeof body.totalBlocks === 'number') ? body.totalBlocks : 0;
      setBlocksCountMap(prev => ({ ...prev, [id]: total }));
    } catch {
      setBlocksCountMap(prev => ({ ...prev, [id]: 0 }));
    } finally {
      blocksCountFetching.current.delete(id);
    }
  }, [blocksCountMap]);

  // Cargar (solo) para las rutas visibles/filtradas
  useEffect(() => {
    rutasFiltradas.forEach(r => ensureBlocksCount(r._id));
  }, [rutasFiltradas, ensureBlocksCount]);

  // Helpers UI para el formulario de block 
  const addBlockStop = () => {
    if (!allowedRMStops.length) {
      showToast('Sin paradas disponibles', 'Esta ruta maestra no tiene paradas configuradas.', true);
      return;
    }
    setBlockForm(prev => {
      const nextName = allowedRMStops[0];
      const next = [...(prev.stops || []), { name: nextName, order: (prev.stops?.length || 0) + 1 }];
      return { ...prev, stops: next };
    });
  };

  const removeBlockStop = (idx) => {
    setBlockForm((prev) => {
      const next = (prev.stops || []).filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, order: i + 1 }));
    return { ...prev, stops: next };
    });
  };  

  // Abrir creación de block
  const openCreateBlock = () => {
    setEditingBlockId(null);
    setBlockForm({ name: '', stops: [] });
    setBlockLayoutId('');           
    setBlockMode('create');
    fetchLayouts();                 
  };

  const openEditBlock = (bloque) => {
    setEditingBlockId(bloque._id);
    setBlockForm({
      name: bloque.name || '',
      stops: (bloque.stops || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => ({ name: s.name, order: s.order })),
    });
    setBlockLayoutId(bloque?.layout?._id || bloque?.layoutId || bloque?.layout || '');
    setBlockMode('edit');
    fetchLayouts();                
  };

  useEffect(() => {
    if (blockMode !== 'view' && Array.isArray(blockForm.stops)) {
      const filtered = blockForm.stops.filter(s => allowedRMStops.includes(s?.name));
      if (filtered.length !== blockForm.stops.length) {
        setBlockForm(p => ({ ...p, stops: filtered.map((s,i) => ({ name: s.name, order: i+1 })) }));
      }
    }
  }, [allowedRMStops, blockMode]); 

  // Cancelar formulario
  const cancelBlockForm = () => {
    setEditingBlockId(null);
    setBlockForm({ name: '', stops: [] });
    setBlockMode('view');
    setBlockLayoutId('');
  };

  // Guardar (create/edit)
  const saveBlock = async () => {
    const routeMasterId = routeMasterForBlocks?._id;
    if (!routeMasterId) {
      showToast('Error', 'No hay routeMaster seleccionado.', true);
      return;
    }

    const stops = (blockForm.stops || [])
      .filter(s => typeof s?.name === 'string' && s.name.trim())
      .map((s, i) => ({ name: String(s.name).trim(), order: i + 1 }));

    if (!blockForm.name?.trim() || stops.length < 2) {
      showToast('Datos incompletos', 'Nombre del bloque y al menos 2 paradas.', true);
      return;
    }

    if (!blockLayoutId?.trim()) {
      showToast('Layout requerido', 'Debes seleccionar un layout.', true);
      return;
    }

    const invalid = stops.some(s => !allowedRMStops.includes(s.name));
    if (invalid) {
      showToast('Paradas no válidas', 'Solo puedes usar ciudades definidas en la ruta maestra.', true);
      return;
    }

    const payload = {
      routeMasterId,
      name: blockForm.name.trim(),
      stops,                      
      layoutId: blockLayoutId.trim(),  
    };

    try {
      const isCreate = blockMode === 'create';
      const url = isCreate
        ? 'https://boletos.dev-wit.com/api/route-blocks'
        : `https://boletos.dev-wit.com/api/route-blocks/${encodeURIComponent(editingBlockId)}`;

      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { _raw: text }; }

      if (!res.ok) {
        console.error('[Blocks] Error', res.status, res.statusText, 'body:', body);
        const msg = body?.message || body?.error || `${res.status} ${res.statusText || ''}`.trim();
        showToast('Error', msg, true);
        return;
      }

      showToast(isCreate ? 'Bloque creado' : 'Bloque actualizado',
                isCreate ? 'Se creó correctamente' : 'Cambios guardados');
      cancelBlockForm();
      await fetchBlocksByRouteMaster(routeMasterId);
    } catch (e) {
      console.error(e);
      showToast('Error', e.message || 'No se pudo guardar el bloque', true);
    }
  };

  // Eliminar block
  const deleteBlock = async (blockId) => {
    const result = await Swal.fire({
      title: '¿Eliminar bloque?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/route-blocks/${encodeURIComponent(blockId)}`, {
        method: 'DELETE',
      });
      const body = await parseResponseSafe(res);
      if (!res.ok) throw new Error(body?.message || `${res.status} ${res.statusText}`);

      showToast('Bloque eliminado', 'El bloque fue eliminado correctamente');
      await fetchBlocksByRouteMaster(routeMasterForBlocks?._id);
    } catch (e) {
      console.error(e);
      showToast('Error', e.message || 'No se pudo eliminar el bloque', true);
    }
  };  

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="rutas" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Rutas Maestras</h1>
          <p className="text-muted">Aquí puedes visualizar y gestionar las rutas maestras y paradas</p>
        </div>

        <div className="stats-box">
          <div className="d-flex flex-column gap-2 mb-3">
            {/* Fila 1: título + acciones */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0">Listado de Rutas Maestras</h5>                
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary"
                  disabled={actualizando}
                  onClick={async () => {
                    setActualizando(true);
                    try {
                      const res = await fetch('https://boletos.dev-wit.com/api/route-masters');
                      const data = await res.json();
                      setRutas(Array.isArray(data) ? data : []);
                      showToast('Actualizado', 'Lista de rutas maestras sincronizada');
                    } catch (err) {
                      console.error(err);
                      showToast('Error al actualizar', err.message || 'No se pudo sincronizar', true);
                    } finally {
                      setActualizando(false);
                    }
                  }}
                  title="Volver a cargar la lista"
                  aria-label="Actualizar lista de rutas"
                >
                  {actualizando ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>
                      <i className="bi bi-arrow-repeat" /> Actualizar
                    </>
                  )}
                </button>

                <button className="btn btn-primary" onClick={abrirModalNuevaRuta}>
                  <i className="bi bi-plus-lg me-1" /> Nueva ruta
                </button>
              </div>
            </div>

            {/* Fila 2: buscador */}
            <div className="input-group w-100">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                className="form-control"
                placeholder="Buscar por nombre, origen, destino o parada…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                aria-label="Buscar rutas maestras"
              />
              {filtro && (
                <button className="btn btn-outline-secondary" onClick={() => setFiltro('')}>
                  Limpiar
                </button>
              )}
            </div>
          </div>        

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando rutas maestras...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{width: 48}} aria-label="Expandir"></th>
                    <th>Ruta</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th style={{width: 110}}>Bloques</th> 
                    <th style={{width: 120}}>Paradas</th>
                    <th style={{width: 240}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rutasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={7}>
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

                  {rutasFiltradas.map((ruta) => {
                    const origen = ruta?.stops?.[0]?.name || '';
                    const destino = ruta?.stops?.[ruta.stops.length - 1]?.name || '';
                    const paradasPendientes = !Array.isArray(ruta?.stops);
                    const totalParadas = ruta?.stops?.length || 0;
                    const totalBloques = blocksCountMap[ruta._id];

                    return (
                      <React.Fragment key={ruta._id}>
                        <tr className={isExpanded(ruta._id) ? 'table-active' : ''}>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleExpandirRuta(ruta._id)}
                              aria-expanded={isExpanded(ruta._id)}
                              aria-controls={`stops-${ruta._id}`}
                              title={isExpanded(ruta._id) ? 'Ocultar paradas' : 'Ver paradas'}
                            >
                              <i className={`bi ${isExpanded(ruta._id) ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                            </button>
                          </td>

                          <td className="fw-semibold">{ruta.name}</td>
                          <td>{origen}</td>
                          <td>{destino}</td>                          
                          <td>
                            {totalBloques == null ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <span
                                className="badge bg-info-subtle text-info-emphasis border"
                                style={{ '--bs-badge-font-size': '0.95rem' }}
                              >
                                {totalBloques}
                              </span>
                            )}
                          </td>

                          <td>
                            {totalParadas == null ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <span
                                className="badge bg-info-subtle text-info-emphasis border"
                                style={{ '--bs-badge-font-size': '0.95rem' }}
                              >
                                {totalParadas}
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td>
                            <div className="btn-group btn-group-sm" role="group" aria-label="Acciones">
                              <button
                                className="btn btn-outline-primary"
                                title="Ver bloques de esta ruta"
                                aria-label="Ver bloques de esta ruta"
                                onClick={() => handleVerBlocks(ruta)}
                              >
                                <i className="bi bi-grid-3x3-gap-fill me-1 d-none d-md-inline" />
                                <span className="d-none d-md-inline">Bloques</span>
                                <i className="bi bi-grid-3x3-gap-fill d-inline d-md-none" />
                              </button>

                              <button
                                className="btn btn-outline-danger"
                                title="Eliminar ruta maestra"
                                aria-label="Eliminar ruta maestra"
                                onClick={() => handleEliminar(ruta._id)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Fila expandida de paradas */}
                        {isExpanded(ruta._id) && (
                          <tr id={`stops-${ruta._id}`}>
                            <td colSpan={7}>
                              <div className="p-2 border rounded bg-light">
                                <div className="d-flex align-items-center mb-2">
                                  <i className="bi bi-signpost-2 me-2" />
                                  <h6 className="mb-0">Paradas</h6>
                                </div>

                                <div className="table-responsive">
                                  <table className="table table-sm table-striped mb-0">
                                    <thead>
                                      <tr>
                                        <th style={{width: 60}}>#</th>
                                        <th>Nombre</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...(ruta.stops || [])]
                                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                                        .map((stop) => (
                                          <tr key={stop._id || `${stop.name}-${stop.order}`}>
                                            <td>{stop.order}</td>
                                            <td>{stop.name}</td>
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
      </main>

      {/* MODAL NUEVA RUTA */}
      <ModalBase
        visible={modalRutaVisible}
        title={rutaEditando ? 'Editar Ruta Maestra' : 'Nueva Ruta Maestra'}
        onClose={() => {
          setModalRutaVisible(false);
          setRutaEditando(null);
        }}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalRutaVisible(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleGuardarRuta}>
              Guardar Cambios
            </button>
          </>
        }
      >
        <RutaEditor formRuta={formRuta} setFormRuta={setFormRuta} ciudades={ciudades} />
      </ModalBase>

      {/* MODAL: BLOQUES POR ROUTE MASTER */}
      <ModalBase
        visible={modalBlocksVisible}
        title={`Bloques — ${routeMasterForBlocks?.name || ''}`}
        onClose={closeBlocksModal}
      >
        {blocksLoading && (
          <div className="text-center py-3">
            <Spinner animation="border" />
            <div className="mt-2">Cargando bloques...</div>
          </div>
        )}

        {!blocksLoading && blocksError && (
          <div className="alert alert-danger" role="alert">
            {blocksError}
          </div>
        )}

        {!blocksLoading && !blocksError && blocksData && (
          <div>
            {/* Encabezado con total y botón crear */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="fw-semibold">Ruta Maestra: {blocksData.routeMaster}</div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-secondary">Total: {blocksData.totalBlocks}</span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={openCreateBlock}
                  disabled={blockMode !== 'view'}
                  title="Crear bloque"
                >
                  <i className="bi bi-plus-circle me-1" />
                  Nuevo bloque
                </button>
              </div>
            </div>

            {/* Formulario crear/editar bloque */}
            {blockMode !== 'view' && (
              <div className="mb-3 p-3 border rounded bg-light-subtle">
                {/* Fila estable: nombre + layout (solo el select aquí) */}
                <div className="row g-3 align-items-start">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold mb-1">Nombre del bloque</label>
                    <input
                      className="form-control"
                      value={blockForm.name}
                      onChange={(e) => setBlockForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: Tramo Norte"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold mb-1">Layout (requerido)</label>

                    {layoutsLoading && <div className="form-text">Cargando layouts…</div>}
                    {!layoutsLoading && layoutsError && (
                      <div className="alert alert-warning py-1 px-2 mb-2">{layoutsError}</div>
                    )}

                    {!layoutsLoading && !layoutsError && (
                      <select
                        className="form-select"
                        value={blockLayoutId}
                        onChange={(e) => setBlockLayoutId(e.target.value)}
                      >
                        <option value="" disabled>Seleccione un layout</option>
                        {availableLayouts.map(l => (
                          <option key={l._id} value={l._id}>
                            {layoutLabel(l)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Detalles del layout: fila aparte de ancho completo (no desordena la fila superior) */}
                  {selectedLayout && (
                    <div className="col-12">
                      <div className="alert alert-secondary py-2 mb-0">
                        <div className="small">
                          <strong>{selectedLayout.name}</strong><br />
                          Pisos: {selectedLayout.pisos ?? '-'} · Capacidad: {selectedLayout.capacidad ?? '-'} ·{' '}
                          Disposición: {selectedLayout.columns ?? '-'} columnas × {selectedLayout.rows ?? '-'} filas<br />
                          Asientos P1: {selectedLayout.tipo_Asiento_piso_1 ?? '-'} ·{' '}
                          Asientos P2: {selectedLayout.tipo_Asiento_piso_2 ?? '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Paradas con drag & drop */}
                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-semibold mb-0">
                      Paradas del bloque (arrástralas para reordenar)
                    </label>
                    <button className="btn btn-sm btn-outline-primary" onClick={addBlockStop}>
                      <i className="bi bi-plus" /> Añadir parada
                    </button>
                  </div>

                  <ReactSortable
                    list={blockForm.stops || []}
                    setList={(newOrder) =>
                      setBlockForm((p) => ({
                        ...p,
                        stops: (newOrder || []).map((s, i) => ({ name: s.name || '', order: i + 1 })),
                      }))
                    }
                    animation={180}
                    handle=".drag-handle"
                    ghostClass="sortable-ghost"
                    chosenClass="sortable-chosen"
                  >
                    {(blockForm.stops || []).map((s, idx) => (
                      <div
                        key={`${idx}-${s?.name || 'stop'}`}
                        className="d-flex gap-2 align-items-center mb-2 p-2 border rounded bg-white"
                      >
                        {/* Asa de arrastre */}
                        <span
                          className="drag-handle d-inline-flex align-items-center justify-content-center px-2"
                          title="Arrastrar para reordenar"
                          style={{ cursor: 'grab' }}
                        >
                          <i className="bi bi-grip-vertical" />
                        </span>

                        {/* Selector de ciudad */}
                        <select
                          className="form-select form-select-sm flex-fill"
                          value={s?.name || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBlockForm((p) => {
                              const arr = [...(p.stops || [])];
                              arr[idx] = { name: v, order: idx + 1 };
                              return { ...p, stops: arr };
                            });
                          }}
                        >
                          <option value="">Selecciona ciudad</option>
                          {allowedRMStopOptions.map(({ name, order }) => (
                            <option key={name} value={name}>
                              {String(order).padStart(2, '0')} — {name}
                            </option>
                          ))}
                        </select>


                        {/* Eliminar */}
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => removeBlockStop(idx)}
                          title="Quitar parada"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    ))}
                  </ReactSortable>

                  {(blockForm.stops || []).length === 0 && (
                    <p className="text-muted fst-italic mt-2">Aún no hay paradas. Agrega al menos una.</p>
                  )}

                  {/* Barra de acciones abajo (sticky) */}
                  <div
                    className="d-flex justify-content-between align-items-center pt-3 mt-3 border-top"
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      background: 'inherit',
                      zIndex: 2,
                      borderBottomLeftRadius: '0.5rem',   
                      borderBottomRightRadius: '0.5rem',  
                    }}
                  >
                    <div className="small text-muted">
                      {(blockForm.stops || []).filter(s => s?.name).length} paradas · layout: {selectedLayout?.name || '—'}
                    </div>

                    <div className="d-flex gap-2">
                      <button className="btn btn-secondary" onClick={cancelBlockForm}>Cancelar</button>
                      <button
                        className="btn btn-primary"
                        onClick={saveBlock}
                        disabled={!canSave}
                        title={canSave ? (blockMode === 'create' ? 'Crear bloque' : 'Guardar cambios') : 'Completa: nombre, layout válido y al menos 2 paradas de la ruta'}
                      >
                        {blockMode === 'create' ? 'Crear bloque' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Listado de bloques */}
            {Array.isArray(blocksData.blocks) && blocksData.blocks.length > 0 ? (
              blocksData.blocks.map((bloque) => {
                const isEditingThis = blockMode === 'edit' && editingBlockId === bloque._id;
                const disableOthers = blockMode !== 'view' && !isEditingThis;

                return (
                  <div
                    key={bloque._id}
                    className={`mb-3 p-2 border rounded ${isEditingThis ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'bg-light'}`}
                    style={disableOthers ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <strong>{bloque.name}</strong>
                        {isEditingThis && <span className="badge bg-primary">Editando…</span>}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small">ID: {bloque._id}</span>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => openEditBlock(bloque)}
                          disabled={blockMode !== 'view'}
                          title="Editar bloque"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteBlock(bloque._id)}
                          disabled={blockMode !== 'view'}
                          title="Eliminar bloque"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm table-striped mb-0">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Parada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(bloque.stops || [])]
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((s) => (
                              <tr key={s._id || `${s.name}-${s.order}`}>
                                <td>{s.order}</td>
                                <td>{s.name}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted">No hay bloques para esta ruta.</p>
            )}
          </div>
        )}
      </ModalBase>
    </div>
  );
};

export default Rutas;
