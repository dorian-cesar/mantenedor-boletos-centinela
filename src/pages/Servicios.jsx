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
      return coincideOrigen && coincideDestino && coincideTexto;
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
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviciosFiltrados.map((servicio) => {
                          const salida = servicio.departures?.[0];
                          const llegada = servicio.departures?.at(-1);

                          return (
                            <tr key={servicio._id}>
                              <td>{servicio.routeMaster?.origin} → {servicio.routeMaster?.destination}</td>
                              <td>{servicio.routeMaster?.name || '—'}</td>
                              <td>{servicio.layout?.name || '—'}</td>
                              <td>{salida ? formatHoraCL(salida.time) : '—'}</td>
                              <td>{llegada ? formatHoraCL(llegada.time) : '—'}</td>
                              <td>{salida ? formatFechaCL(salida.time) : '—'}</td>
                              <td>{llegada ? formatFechaCL(llegada.time) : '—'}</td>
                              <td>{minutesToHhMm(servicio.routeMaster?.durationMinutes || 0)}</td>
                              <td> 
                                <button
                                  className="btn btn-sm btn-primary me-1"
                                  onClick={() => handleOpenCrewModal(servicio._id)}
                                >
                                  <i className="bi bi-people"></i>
                                </button>

                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleEliminar(servicio._id)}
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
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {serviciosFiltrados.map((servicio) => {
                                const salida = servicio.departures?.[0];
                                const llegada = servicio.departures?.at(-1);

                                return (
                                  <tr key={servicio._id}>
                                    <td>{servicio.routeMaster?.origin} → {servicio.routeMaster?.destination}</td>
                                    <td>{servicio.routeMaster?.name || '—'}</td>
                                    <td>{servicio.layout?.name || '—'}</td>
                                    <td>{salida ? formatHoraCL(salida.time) : '—'}</td>
                                    <td>{llegada ? formatHoraCL(llegada.time) : '—'}</td>
                                    <td>{salida ? formatFechaCL(salida.time) : '—'}</td>
                                    <td>{llegada ? formatFechaCL(llegada.time) : '—'}</td>
                                    <td>{minutesToHhMm(servicio.routeMaster?.durationMinutes || 0)}</td>
                                    <td>
                                      <button
                                        className="btn btn-sm btn-primary me-1"
                                        onClick={() => handleOpenCrewModal(servicio._id)}
                                      >
                                        <i className="bi bi-people"></i>
                                      </button>

                                      <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleEliminar(servicio._id)}
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
    </>
  );
};

export default Servicios;