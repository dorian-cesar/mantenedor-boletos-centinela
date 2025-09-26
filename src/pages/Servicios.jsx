import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import ModalBase from '@components/ModalBase/ModalBase';
import { showToast } from '@components/Toast/Toast';
import { Tabs, Tab } from 'react-bootstrap';
import Select from "react-select";
import { FixedSizeList as List } from "react-window";

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error("No se encontró VITE_API_URL. Revisa tus .env");
}

// Endpoints usados en este componente
const SERVICES_ENDPOINT  = `${API_URL}/services`;
const LAYOUTS_ENDPOINT   = `${API_URL}/bus-layout`;
const CREW_ENDPOINT = `${API_URL}/users/crew`;

const formatHoraCL = (iso) =>
  new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

const formatFechaCL = (iso) =>
  new Date(iso).toLocaleDateString("es-CL");

const minutesToHhMm = (min = 0) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

const userIdOf = (u) => (typeof u === 'string' ? u : (u?._id || u?.id || ''));
const userNameOf = (u) => (typeof u === 'object' ? (u.name || u.email || userIdOf(u)) : u);
const userRutOf  = (u) => (typeof u === 'object' ? (u.rut || '') : '');

const mergeUniqueById = (base = [], extra = []) => {
  const map = new Map(base.map(x => [x._id, x]));
  for (const x of extra) {
    if (!map.has(x._id)) map.set(x._id, x);
  }
  return Array.from(map.values());
};

const MenuList = props => {
  const height = 35;
  const { options, children, maxHeight, getValue } = props;
  const [value] = getValue();
  const initialOffset = options.indexOf(value) * height;

  return (
    <List
      height={maxHeight}
      itemCount={children.length}
      itemSize={height}
      initialScrollOffset={initialOffset}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>{children[index]}</div>
      )}
    </List>
  );
};

const Servicios = () => {
  const [todosLosServicios, setTodosLosServicios] = useState([]);  
  const [serviciosFiltrados, setServiciosFiltrados] = useState([]);
  const [busqueda, setBusqueda] = useState(''); 
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [filtroDestino, setFiltroDestino] = useState('');
  const [cargando, setCargando] = useState(false);
  const origenes = useMemo(() => {
    const set = new Set(todosLosServicios.map(s => s.routeMaster?.origin).filter(Boolean));
    return Array.from(set).sort();
  }, [todosLosServicios]);

  const destinos = useMemo(() => {
    const set = new Set(todosLosServicios.map(s => s.routeMaster?.destination).filter(Boolean));
    return Array.from(set).sort();
  }, [todosLosServicios]);
  const [layouts, setLayouts] = useState([]);
  const [orden, setOrden] = useState('hora');
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [serviciosPorFecha, setServiciosPorFecha] = useState({});   
  const [fechasTabs, setFechasTabs] = useState([]);
  const [actualizando, setActualizando] = useState(false);  
  const [crewModalVisible, setCrewModalVisible] = useState(false);
  const [crewList, setCrewList] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedAssistants, setSelectedAssistants] = useState([]);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [soloPendientes, setSoloPendientes] = useState(false);

  // Estado de tripulación: completo si hay 1 conductor y ≥1 auxiliar
  const crewStatus = (svc) => {
    const crew = Array.isArray(svc?.crew) ? svc.crew : [];
    const hasDriver = crew.some(c => c.role === 'conductor');
    const hasAssistant = crew.some(c => c.role === 'auxiliar');
    const complete = hasDriver && hasAssistant;
    const missing = [];
    if (!hasDriver) missing.push('chofer');
    if (!hasAssistant) missing.push('auxiliar');
    return { complete, hasDriver, hasAssistant, missing };
  };

  // Render del puntito verde/rojo con tooltip accesible
  const renderStatusDot = (svc) => {
    const { complete, missing } = crewStatus(svc);
    const title = complete ? 'Tripulación completa' : `Falta: ${missing.join(' y ')}`;
    return (
      <span title={title} aria-label={title} className="d-inline-flex align-items-center">
        <i
          className={`bi bi-circle-fill ${complete ? 'text-success' : 'text-danger'}`}
          style={{ fontSize: '0.65rem' }}
        />
      </span>
    );
  };

  // Helpers visuales
  const formatCLP = (n) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n ?? 0);

  // Devuelve [salida, llegada] usando departures
  const endpointsFrom = (svc) => {
    const salida = svc?.departures?.[0] || null;
    const llegada = svc?.departures?.[svc?.departures?.length - 1] || null;
    return [salida, llegada];
  };

  // Click y teclado para abrir detalles desde la fila
  const onRowClick = (svc) => handleOpenDetails(svc);
  const onRowKey = (e, svc) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenDetails(svc);
    }
  };

  // Para que los botones dentro de la fila no disparen el onClick del <tr>
  const stop = (e) => e.stopPropagation();

  // === Exportación a CSV ===
  const [exportMode, setExportMode] = useState('visibles'); // 'visibles' | 'rango' | 'todos'
  const [exportFrom, setExportFrom] = useState('');         // YYYY-MM-DD
  const [exportTo, setExportTo] = useState('');             // YYYY-MM-DD
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const s = String(value).replace(/"/g, '""');
    return /[",\n\r;]/.test(s) ? `"${s}"` : s;
  };

  const handleOpenCrewModal = async (serviceId) => {
    setSelectedServiceId(serviceId);

    try {
      // 1) Servicio actual (soporta {service: {...}} y {...} planos)
      const resService = await fetch(`${SERVICES_ENDPOINT}/${serviceId}`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!resService.ok) throw new Error("No se pudo obtener el servicio");
      const serviceData = await resService.json();
      const svc = serviceData.service ?? serviceData;

      // 2) Tripulación actual desde DB
      const currentCrew = Array.isArray(svc.crew) ? svc.crew : [];
      const driver     = currentCrew.find(c => c.role === "conductor");
      const assistants = currentCrew.filter(c => c.role === "auxiliar");

      const driverId = driver ? userIdOf(driver.user) : "";
      const assistantIds = assistants.map(c => userIdOf(c.user));

      // 3) Usuarios pre-asignados (por si no vienen en /users/crew)
      const preAssignedUsers = currentCrew.map(c => ({
        _id:  userIdOf(c.user),
        name: userNameOf(c.user),
        rut:  userRutOf(c.user),
        role: c.role,
      }));

      // 4) Lista completa de crew disponibles
      const resCrew = await fetch(CREW_ENDPOINT, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!resCrew.ok) throw new Error("No se pudo obtener tripulación");
      const crewData = await resCrew.json();
      const apiUsers = crewData.users || [];

      // 5) Fusionar para garantizar que lo asignado SIEMPRE aparezca
      const merged = mergeUniqueById(apiUsers, preAssignedUsers);
      setCrewList(merged);

      // 6) Setear selección inicial desde DB
      setSelectedDriver(driverId);
      setSelectedAssistants(assistantIds);

      // 7) Abrir modal
      setCrewModalVisible(true);
    } catch (err) {
      console.error(err);
      showToast("Error", "No se pudo cargar la tripulación", true);
    }
  };

  const handleOpenDetails = async (service) => {
    // Pinta algo altiro y luego actualiza con el GET /services/:id
    setServiceDetails(service);
    setDetailsVisible(true);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${SERVICES_ENDPOINT}/${service._id}`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("No se pudieron obtener los detalles del servicio.");
      const data = await res.json();
      const svc = data.service ?? data; // soporta {service:{...}} y objeto plano
      setServiceDetails(svc);
    } catch (err) {
      console.error(err);
      showToast("Error", err.message || "No se pudieron cargar los detalles", true);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setServiceDetails(null);
    setDetailsLoading(false);
  };

  const handleCloseCrewModal = () => {
    setCrewModalVisible(false);
    setSelectedServiceId(null);
    setSelectedDriver('');
    setSelectedAssistants([]);
    setCrewList([]);
  };

  const handleAssignCrew = async () => {
    if (!selectedDriver) {
      showToast("Advertencia", "Debes seleccionar al menos 1 chofer", true);
      return;
    }
    if (selectedAssistants.length === 0) {
      showToast("Advertencia", "Debes seleccionar al menos 1 auxiliar", true);
      return;
    }

    try {
      const res = await fetch(`${SERVICES_ENDPOINT}/${selectedServiceId}/assign`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          crew: [
            { user: selectedDriver, role: "conductor" },
            ...selectedAssistants.map((id) => ({ user: id, role: "auxiliar" })),
          ],
        }),
      });

      if (!res.ok) throw new Error("Error al asignar tripulación");
      showToast("Éxito", "Tripulación asignada correctamente");
      setCrewModalVisible(false);
      await fetchServicios(); // refresca la tabla
    } catch (err) {
      console.error(err);
      showToast("Error", err.message, true);
    }
  };

  const buildCSV = (rows) => {
    const header = [
      'ID',
      'Origen',
      'Destino',
      'Ruta',
      'Layout',
      'FechaSalida',
      'HoraSalida',
      'FechaLlegada',
      'HoraLlegada',
      'Duración'
    ];
    const lines = [header.map(escapeCSV).join(',')];

    rows.forEach(s => {
      const salida = s.departures?.[0];
      const llegada = s.departures?.at(-1);

      lines.push([
        s._id,
        s.routeMaster?.origin || '',
        s.routeMaster?.destination || '',
        s.routeMaster?.name || '',
        s.layout?.name || '',
        salida ? new Date(salida.time).toLocaleDateString("es-CL") : '',
        salida ? new Date(salida.time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : '',
        llegada ? new Date(llegada.time).toLocaleDateString("es-CL") : '',
        llegada ? new Date(llegada.time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : '',
        minutesToHhMm(s.routeMaster?.durationMinutes || 0)
      ].map(escapeCSV).join(','));
    });

    return '\uFEFF' + lines.join('\r\n');
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    let records = [];
    if (exportMode === 'visibles') {
      records = serviciosFiltrados;
    } else if (exportMode === 'todos') {
      records = todosLosServicios;
    } else { // rango
      if (!exportFrom || !exportTo) {
        showToast('Atención', 'Selecciona fechas Desde y Hasta para exportar.', true);
        return;
      }
      const from = exportFrom; // YYYY-MM-DD
      const to = exportTo;
      records = (todosLosServicios || []).filter(s => s.date >= from && s.date <= to);
    }

    if (!records || records.length === 0) {
      showToast('Atención', 'No hay registros para exportar.', true);
      return;
    }

    const csv = buildCSV(records);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const suffix = exportMode === 'rango' ? `${exportFrom}_a_${exportTo}` : exportMode;
    downloadCSV(csv, `servicios_${suffix}_${stamp}.csv`);
  };

  const ordenarServicios = (lista, criterio, asc = true) => {
    if (!lista) return [];
    const sign = asc ? 1 : -1;

    return [...lista].sort((a, b) => {
      if (criterio === 'hora') {
        return sign * (new Date(a.date) - new Date(b.date));
      }
      if (criterio === 'tipoBus') {
        const A = (a.layout?.name || '').toLowerCase();
        const B = (b.layout?.name || '').toLowerCase();
        return sign * A.localeCompare(B);
      }
      return 0;
    });
  };

  const handleChangeOrden = (nuevoOrden) => {
    setOrden(nuevoOrden);    
  };

  const handleToggleOrden = () => {
    setOrdenAscendente(prev => !prev);
  };

  useEffect(() => {
    const fetchLayouts = async () => {
      try {
        const res = await fetch(`${LAYOUTS_ENDPOINT}/`, {
          headers: {
            "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        const data = await res.json();
        setLayouts(data);
      } catch (error) {
        console.error('Error al obtener layouts:', error);
      }
    };
    fetchLayouts();
  }, []);

  useEffect(() => {
    fetchServicios();
  }, []);

  useEffect(() => {
    const base =
      fechaSeleccionada === "todos"
        ? todosLosServicios
        : (serviciosPorFecha[fechaSeleccionada] || []);

    const text = (busqueda || '').toLowerCase();

    const filtrados = base.filter((s) => {
      const rm = s.routeMaster || {};
      const coincideOrigen = !filtroOrigen || rm.origin === filtroOrigen;
      const coincideDestino = !filtroDestino || rm.destination === filtroDestino;
      const texto = `${rm.name} ${rm.origin} ${rm.destination} ${s._id} ${s.layout?.name || ''}`.toLowerCase();
      const coincideTexto = !text || texto.includes(text);
      const pasaTextoYFiltros = coincideOrigen && coincideDestino && coincideTexto;

      if (!pasaTextoYFiltros) return false;
      // si está activado "Solo pendientes", excluye completos
      return !soloPendientes || !crewStatus(s).complete;
    });

    const ordenados = ordenarServicios(filtrados, orden, ordenAscendente);
    setServiciosFiltrados(ordenados);
  }, [
    fechaSeleccionada,
    serviciosPorFecha,
    todosLosServicios,
    busqueda,
    orden,
    ordenAscendente,
    filtroOrigen,
    filtroDestino
  ]); 

  const groupByDate = (items) => {
    const map = {};
    for (const s of items) {
      const key = new Date(s.date).toISOString().slice(0, 10); // YYYY-MM-DD de la salida real
      (map[key] ||= []).push(s);
    }
    return map;
  };

  const fetchServicios = async () => {
    setCargando(true);
    try {
      const res = await fetch(SERVICES_ENDPOINT, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("No se pudieron obtener los servicios.");

      const data = await res.json();

      setTodosLosServicios(data);

      const porFecha = groupByDate(data);
      setServiciosPorFecha(porFecha);
      setFechasTabs(Object.keys(porFecha).sort());

      setFechaSeleccionada("todos");
      setServiciosFiltrados(data);

      return true;
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e) => setBusqueda(e.target.value); 

  return (
    <>
      <div className="dashboard-container">
        <Sidebar activeItem="servicios" />
        <main className="main-content">
          <div className="header">
            <h1 className="mb-0">Gestión de servicios</h1>
            <p className="text-muted">Aquí puedes ver y programar nuevos servicios de bus</p>
          </div>

          <div className="stats-box">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="mb-0">Servicios programados por día</h4>                        
              <div className="d-flex gap-2">
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => setExportModalVisible(true)}
                  >
                    <i className="bi bi-download me-1"></i> Exportar CSV
                  </button>
                </div> 

                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={actualizando}
                  onClick={async () => {
                    setActualizando(true);
                    try {
                      const ok = await fetchServicios();
                      if (ok) {
                        showToast('Actualizado', 'Lista de servicios sincronizada correctamente.');
                      }
                    } catch (err) {
                      console.error(err);
                      const mensaje =
                        err.message === "Failed to fetch"
                          ? "❌ No hay conexión con el servidor. Verifica tu red o que el backend esté activo."
                          : err.message || "Ocurrió un error inesperado";
                      showToast("Error", mensaje, true);
                    } finally {
                      setActualizando(false);
                    }
                  }}
                >
                  {actualizando ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <>
                      <i className="bi bi-arrow-repeat me-1"></i> Actualizar
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar servicio por origen, destino, ID, etc..."
                value={busqueda}
                onChange={handleBuscar}
              />
            </div>

            <div className="mb-3 d-flex align-items-center gap-3">
              <label className="form-label mb-0">Ordenar por:</label>
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: "200px" }}
                value={orden}
                onChange={(e) => handleChangeOrden(e.target.value)}
              >
                <option value="hora">Hora de Salida</option>
                <option value="tipoBus">Tipo de Bus</option>
              </select>

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={handleToggleOrden}
                title={ordenAscendente ? "Orden ascendente" : "Orden descendente"}
              >
                {ordenAscendente ? (
                  <i className="bi bi-sort-down"></i>
                ) : (
                  <i className="bi bi-sort-up"></i>
                )}
              </button>
            </div>

            <div className="mb-3 d-flex gap-3 align-items-end">
              <div>
                <label>Origen</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroOrigen}
                  onChange={(e) => setFiltroOrigen(e.target.value)}
                >
                  <option value="">Todos</option>
                  {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label>Destino</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroDestino}
                  onChange={(e) => setFiltroDestino(e.target.value)}
                >
                  <option value="">Todos</option>
                  {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-check form-switch ms-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="switchPendientes"
                  checked={soloPendientes}
                  onChange={(e) => setSoloPendientes(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switchPendientes">
                  Solo pendientes
                </label>
              </div>
            </div>

            <Tabs
              activeKey={fechaSeleccionada}
              onSelect={(fecha) => setFechaSeleccionada(fecha)}
              className="mb-3"
            >
              {/* Tab: Todos */}
              <Tab eventKey="todos" title="Todos">
                {serviciosFiltrados.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Origen → Destino</th>
                          <th>Ruta</th>
                          <th>Layout</th>
                          <th>Hora Salida</th>
                          <th>Hora Llegada</th>
                          <th>Fecha Salida</th>
                          <th>Fecha Llegada</th>
                          <th>Duración</th>
                          <th style={{ width: 32 }}>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviciosFiltrados.map((servicio) => {
                          const salida = servicio.departures?.[0];
                          const llegada = servicio.departures?.at(-1);

                          return (
                            <tr
                              key={servicio._id}
                              tabIndex={0}
                              className="table-row-clickable"
                              onClick={() => onRowClick(servicio)}
                              onKeyDown={(e) => onRowKey(e, servicio)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{servicio.routeMaster?.origin} → {servicio.routeMaster?.destination}</td>
                              <td>{servicio.routeMaster?.name || '—'}</td>
                              <td>{servicio.layout?.name || '—'}</td>
                              <td>{salida ? formatHoraCL(salida.time) : '—'}</td>
                              <td>{llegada ? formatHoraCL(llegada.time) : '—'}</td>
                              <td>{salida ? formatFechaCL(salida.time) : '—'}</td>
                              <td>{llegada ? formatFechaCL(llegada.time) : '—'}</td>
                              <td>{minutesToHhMm(servicio.routeMaster?.durationMinutes || 0)}</td>
                              <td>{renderStatusDot(servicio)}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-outline-primary me-1"
                                  title="Ver detalles"
                                  onClick={(e) => { stop(e); handleOpenDetails(servicio); }}
                                >
                                  <i className="bi bi-eye"></i>
                                </button>

                                <button
                                  className="btn btn-sm btn-primary me-1"
                                  title="Asignar tripulación"
                                  onClick={(e) => { stop(e); handleOpenCrewModal(servicio._id); }}
                                >
                                  <i className="bi bi-people"></i>
                                </button>

                                <button
                                  className="btn btn-sm btn-danger"
                                  title="Eliminar"
                                  onClick={(e) => { stop(e); handleEliminar(servicio._id); }}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">No hay servicios que coincidan</p>
                )}
              </Tab>

              {/* Tabs por fecha */}
              {fechasTabs.map((fecha) => {
                const [a, m, d] = fecha.split('-');
                const fechaObj = new Date(Number(a), Number(m) - 1, Number(d));

                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const hoyStr = hoy.toLocaleDateString('sv-SE');

                const ayer = new Date(hoy);
                ayer.setDate(hoy.getDate() - 1);
                const ayerStr = ayer.toLocaleDateString('sv-SE');

                let titulo;
                if (fecha === hoyStr) {
                  titulo = 'Hoy';
                } else if (fecha === ayerStr) {
                  titulo = 'Ayer';
                } else {
                  const mesStr = fechaObj.toLocaleString('es-CL', { month: 'short' }).toLowerCase();
                  titulo = `${d.padStart(2, '0')}-${mesStr}`;
                }

                return (
                  <Tab eventKey={fecha} title={titulo} key={fecha}>
                    {fecha === fechaSeleccionada ? (
                      serviciosFiltrados.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-bordered table-hover align-middle">
                            <thead className="table-light">
                              <tr>
                                <th>Origen → Destino</th>
                                <th>Ruta</th>
                                <th>Layout</th>
                                <th>Hora Salida</th>
                                <th>Hora Llegada</th>
                                <th>Fecha Salida</th>
                                <th>Fecha Llegada</th>
                                <th>Duración</th>
                                <th style={{ width: 32 }}>Estado</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {serviciosFiltrados.map((servicio) => {
                                const salida = servicio.departures?.[0];
                                const llegada = servicio.departures?.at(-1);

                                return (
                                  <tr
                                    key={servicio._id}
                                    tabIndex={0}
                                    className="table-row-clickable"
                                    onClick={() => onRowClick(servicio)}
                                    onKeyDown={(e) => onRowKey(e, servicio)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td>{servicio.routeMaster?.origin} → {servicio.routeMaster?.destination}</td>
                                    <td>{servicio.routeMaster?.name || '—'}</td>
                                    <td>{servicio.layout?.name || '—'}</td>
                                    <td>{salida ? formatHoraCL(salida.time) : '—'}</td>
                                    <td>{llegada ? formatHoraCL(llegada.time) : '—'}</td>
                                    <td>{salida ? formatFechaCL(salida.time) : '—'}</td>
                                    <td>{llegada ? formatFechaCL(llegada.time) : '—'}</td>
                                    <td>{minutesToHhMm(servicio.routeMaster?.durationMinutes || 0)}</td>
                                    <td>{renderStatusDot(servicio)}</td>
                                    <td>
                                      <button
                                        className="btn btn-sm btn-outline-primary me-1"
                                        title="Ver detalles"
                                        onClick={(e) => { stop(e); handleOpenDetails(servicio); }}
                                      >
                                        <i className="bi bi-eye"></i>
                                      </button>

                                      <button
                                        className="btn btn-sm btn-primary me-1"
                                        title="Asignar tripulación"
                                        onClick={(e) => { stop(e); handleOpenCrewModal(servicio._id); }}
                                      >
                                        <i className="bi bi-people"></i>
                                      </button>

                                      <button
                                        className="btn btn-sm btn-danger"
                                        title="Eliminar"
                                        onClick={(e) => { stop(e); handleEliminar(servicio._id); }}
                                      >
                                        <i className="bi bi-trash"></i>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-muted">No hay servicios para esta fecha</p>
                      )
                    ) : (
                      <p className="text-muted">Selecciona esta pestaña para ver los servicios</p>
                    )}
                  </Tab>
                );
              })}
            </Tabs>
          </div>
        </main>
      </div> 

      <ModalBase
        visible={crewModalVisible}
        title="Asignar tripulación"
        size="md"
        onClose={handleCloseCrewModal}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-secondary" onClick={handleCloseCrewModal}>
              Cancelar
            </button>
            <button className="btn btn-success" onClick={handleAssignCrew}>
              <i className="bi bi-check2 me-1"></i> Asignar
            </button>
          </div>
        }
      >
        <div className="mb-3">
          <label className="form-label">Chofer</label>
          <Select
            components={{ MenuList }}
            options={crewList
              .filter(c => c.role === "conductor")
              .map(c => ({ value: c._id, label: `${c.name} — ${c.rut}` }))}
            value={
              selectedDriver
                ? { value: selectedDriver, label: crewList.find(c => c._id === selectedDriver)?.name }
                : null
            }
            onChange={(opt) => setSelectedDriver(opt ? opt.value : '')}
            placeholder="Buscar chofer..."
            isClearable
            isSearchable
            menuPortalTarget={document.body}
            styles={{
              menuPortal: base => ({ ...base, zIndex: 2000 }),
            }}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Auxiliares</label>
          <Select
            components={{ MenuList }}
            options={crewList
              .filter(c => c.role === "auxiliar")
              .map(c => ({ value: c._id, label: `${c.name} — ${c.rut}` }))}
            value={selectedAssistants.map(id => {
              const u = crewList.find(c => c._id === id);
              return { value: id, label: u ? u.name : id };
            })}
            onChange={(opts) => setSelectedAssistants((opts || []).map(o => o.value))}
            placeholder="Buscar y seleccionar auxiliares..."
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            isSearchable
            menuPortalTarget={document.body}
            styles={{
              menuPortal: base => ({ ...base, zIndex: 2000 }),
            }}
          />
          <small className="text-muted">Puedes seleccionar uno o varios auxiliares.</small>
        </div>
      </ModalBase>
    
      <ModalBase
        visible={exportModalVisible}
        title="Exportar servicios a CSV"
        size="md"
        onClose={() => setExportModalVisible(false)}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-secondary" onClick={() => setExportModalVisible(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                // pequeña validación de rango
                if (exportMode === 'rango' && (!exportFrom || !exportTo || exportFrom > exportTo)) {
                  showToast('Atención', 'Rango de fechas inválido.', true);
                  return;
                }
                handleExport();
                setExportModalVisible(false);
              }}
            >
              <i className="bi bi-download me-1"></i> Exportar CSV
            </button>
          </div>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Qué exportar</label>
            <select
              className="form-select"
              value={exportMode}
              onChange={(e) => setExportMode(e.target.value)}
            >
              <option value="visibles">Registros visibles (filtros/pestaña actuales)</option>
              <option value="rango">Por rango de fechas</option>
              <option value="todos">Todos los registros</option>
            </select>
          </div>

          {exportMode === 'rango' && (
            <>
              <div className="col-6">
                <label className="form-label">Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </ModalBase>

      <ModalBase
        visible={detailsVisible}
        title={serviceDetails?.routeMaster?.name || "Detalles del servicio"}
        size="lg"
        onClose={handleCloseDetails}
        footer={
          <div className="d-flex justify-content-between w-100">
            <div className="d-flex align-items-center gap-2">
              {/* Acciones rápidas */}
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  handleCloseDetails();
                  handleOpenCrewModal(serviceDetails?._id);
                }}
              >
                <i className="bi bi-people me-1"></i> Asignar tripulación
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigator.clipboard.writeText(serviceDetails?._id || "")}
              >
                <i className="bi bi-clipboard-check me-1"></i> Copiar ID
              </button>
            </div>
            <div>
              <button className="btn btn-secondary" onClick={handleCloseDetails}>
                Cerrar
              </button>
            </div>
          </div>
        }
      >
        {detailsLoading && (
          <div className="d-flex align-items-center gap-2 text-muted">
            <span className="spinner-border spinner-border-sm" />
            Cargando detalles…
          </div>
        )}

        {!detailsLoading && serviceDetails && (
          <div className="container-fluid">
            {/* Resumen */}
            <div className="row g-3">
              <div className="col-12">
                <div className="d-flex flex-wrap align-items-center justify-content-between">
                  <div className="d-flex flex-column">
                    <h5 className="mb-1">
                      {serviceDetails.routeMaster?.origin} → {serviceDetails.routeMaster?.destination}
                    </h5>
                    <div className="text-muted">
                      Ruta: {serviceDetails.routeMaster?.name || "—"}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap align-items-center justify-content-between">
                    <div className="d-flex flex-column">
                      <h5 className="mb-1">
                        {serviceDetails.routeMaster?.origin} → {serviceDetails.routeMaster?.destination}
                      </h5>
                      <div className="text-muted">
                        Ruta: {serviceDetails.routeMaster?.name || "—"}
                      </div>
                    </div>

                    {/* Reemplazo: bloque de indicadores */}
                    <div className="d-flex flex-wrap gap-2">
                      {/* Indicador de tripulación completa/incompleta */}
                      <span className="d-inline-flex align-items-center gap-1">
                        {renderStatusDot(serviceDetails)}
                        <span className="text-muted small">Tripulación</span>
                      </span>

                      {/* Dirección */}
                      <span className={`badge text-bg-${serviceDetails.direction === 'subida' ? 'primary' : 'info'}`}>
                        {serviceDetails.direction || '—'}
                      </span>
                      {/* FAR */}
                      {serviceDetails.far ? (
                        <span className={`badge text-bg-${serviceDetails.far.status === 'rendido' ? 'success' : 'warning'}`}>
                          FAR: {serviceDetails.far.status}
                        </span>
                      ) : (
                        <span className="badge text-bg-secondary">FAR: —</span>
                      )}
                      {/* Bus */}
                      <span className={`badge text-bg-${serviceDetails.bus ? 'success' : 'secondary'}`}>
                        Bus {serviceDetails.bus ? 'asignado' : 'no asignado'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Horarios */}
              <div className="col-12 col-lg-6">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-3">Horarios</h6>
                    {(() => {
                      const [salida, llegada] = endpointsFrom(serviceDetails);
                      return (
                        <ul className="list-unstyled mb-0">
                          <li>
                            <strong>Salida:</strong>{" "}
                            {salida ? `${formatFechaCL(salida.time)} ${formatHoraCL(salida.time)}` : "—"}
                          </li>
                          <li>
                            <strong>Llegada:</strong>{" "}
                            {llegada ? `${formatFechaCL(llegada.time)} ${formatHoraCL(llegada.time)}` : "—"}
                          </li>
                          <li>
                            <strong>Duración:</strong>{" "}
                            {minutesToHhMm(serviceDetails.routeMaster?.durationMinutes || 0)}
                          </li>
                        </ul>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Bus */}
              <div className="col-12 col-lg-6">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-3">Bus</h6>
                    {serviceDetails.bus ? (
                      <ul className="list-unstyled mb-0">
                        <li><strong>Patente:</strong> {serviceDetails.bus.patente || '—'}</li>
                        <li><strong>Marca/Modelo:</strong> {serviceDetails.bus.marca || '—'} {serviceDetails.bus.modelo || ''}</li>
                        <li><strong>Año:</strong> {serviceDetails.bus.anio || '—'}</li>
                        <li><strong>Revisión técnica:</strong> {serviceDetails.bus.revision_tecnica ? formatFechaCL(serviceDetails.bus.revision_tecnica) : '—'}</li>
                        <li><strong>Permiso circulación:</strong> {serviceDetails.bus.permiso_circulacion ? formatFechaCL(serviceDetails.bus.permiso_circulacion) : '—'}</li>
                        <li><strong>Layout:</strong> {serviceDetails.layout?.name || '—'}</li>
                      </ul>
                    ) : (
                      <span className="text-muted">No hay bus asignado.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Paradas y precios */}
              <div className="col-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-3">Paradas y precios</h6>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Parada</th>
                            <th>Hora programada</th>
                            <th>Precio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(serviceDetails.departures || []).map((d, idx) => (
                            <tr key={idx}>
                              <td>{d.order}</td>
                              <td>{d.stop}</td>
                              <td>{`${formatFechaCL(d.time)} ${formatHoraCL(d.time)}`}</td>
                              <td>{d.price != null ? formatCLP(d.price) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(!serviceDetails.departures || serviceDetails.departures.length === 0) && (
                      <div className="text-muted">No hay paradas configuradas.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tripulación */}
              <div className="col-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-3">Tripulación</h6>
                    {serviceDetails.crew?.length ? (
                      <div className="d-flex flex-wrap gap-2">
                        {serviceDetails.crew.map((c, i) => {
                          const id = userIdOf(c.user);
                          const nombre = userNameOf(c.user);
                          const rol = c.role;
                          const badge = rol === 'conductor' ? 'primary' : 'info';
                          return (
                            <span key={`${id}-${i}`} className={`badge rounded-pill text-bg-${badge}`}>
                              {nombre} <small className="ms-1">({rol})</small>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted">No hay tripulación asignada.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* FAR */}
              <div className="col-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title mb-3">Fondo a rendir (FAR)</h6>
                    {serviceDetails.far ? (
                      <>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          <span className="badge text-bg-secondary">Folio: {serviceDetails.far.folio || '—'}</span>
                          <span className="badge text-bg-secondary">Monto: {formatCLP(serviceDetails.far.amount)}</span>
                          <span className={`badge text-bg-${serviceDetails.far.status === 'rendido' ? 'success' : 'warning'}`}>
                            Estado: {serviceDetails.far.status}
                          </span>
                          {serviceDetails.far.deliveredTo && (
                            <span className="badge text-bg-secondary">Entregado a: {serviceDetails.far.deliveredTo}</span>
                          )}
                        </div>
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr><th>Descripción</th><th className="text-end">Monto</th></tr>
                            </thead>
                            <tbody>
                              {(serviceDetails.far.expenses || []).map((e) => (
                                <tr key={e._id}>
                                  <td>{e.description}</td>
                                  <td className="text-end">{formatCLP(e.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <span className="text-muted">Sin FAR asociado.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadatos */}
              <div className="col-12">
                <div className="text-muted small">
                  Creado: {serviceDetails.createdAt ? `${formatFechaCL(serviceDetails.createdAt)} ${formatHoraCL(serviceDetails.createdAt)}` : '—'} ·
                  Actualizado: {serviceDetails.updatedAt ? `${formatFechaCL(serviceDetails.updatedAt)} ${formatHoraCL(serviceDetails.updatedAt)}` : '—'}
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalBase>
    </>
  );
};

export default Servicios;