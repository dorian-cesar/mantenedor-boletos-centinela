import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import ModalBase from '@components/ModalBase/ModalBase';
import { showToast } from '@components/Toast/Toast';
import { Tabs, Tab } from 'react-bootstrap';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error("No se encontró VITE_API_URL. Revisa tus .env");
}

// Endpoints usados en este componente
const SERVICES_ENDPOINT  = `${API_URL}/services`;
const LAYOUTS_ENDPOINT   = `${API_URL}/bus-layout`;
const ROUTES_ENDPOINT    = `${API_URL}/route-masters`;

const formatHoraCL = (iso) =>
  new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

const formatFechaCL = (iso) =>
  new Date(iso).toLocaleDateString("es-CL");

const minutesToHhMm = (min = 0) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

const Servicios = () => {
  const [todosLosServicios, setTodosLosServicios] = useState([]);  
  const [serviciosFiltrados, setServiciosFiltrados] = useState([]);
  const [modalNuevoVisible, setModalNuevoVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState(''); 
  const [nuevoServicio, setNuevoServicio] = useState({
    origin: '',
    destination: '',
    startDate: '',
    days: [],
    time: '',
    busLayout: '',
    company: '',
    busTypeDescription: '',
    seatDescriptionFirst: '',
    seatDescriptionSecond: '',
    priceFirst: '',
    priceSecond: '',
    terminalOrigin: '',
    terminalDestination: '',
    arrivalDate: '',
    arrivalTime: ''
  });  
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
  const layoutSeleccionado = layouts.find(l => l.name === nuevoServicio.busLayout);
  const tieneDosPisos = layoutSeleccionado?.pisos === 2;
  const [orden, setOrden] = useState('hora');
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [serviciosPorFecha, setServiciosPorFecha] = useState({});   
  const [fechasTabs, setFechasTabs] = useState([]);
  const [actualizando, setActualizando] = useState(false);  

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

  const validarCampos = () => {
    const camposRequeridos = [
      'origin', 'destination',
      'terminalOrigin', 'terminalDestination',
      'startDate', 'arrivalDate',
      'time', 'arrivalTime',
      'company', 'busLayout',
      'busTypeDescription',
      'seatDescriptionFirst',
      'priceFirst'
    ];

    for (let campo of camposRequeridos) {
      if (!nuevoServicio[campo] || nuevoServicio[campo]?.toString().trim() === '') {
        const etiqueta = etiquetasCampos[campo] || campo;
        showToast('Advertencia', `Debe completar el campo: ${etiqueta}`, true);

        return false;
      }
    }

    if (!nuevoServicio.days || nuevoServicio.days.length === 0) {
      showToast('Advertencia', 'Debe seleccionar al menos un día vigente.', true);
      return false;
    }

    const layout = layouts.find(l => l.name === nuevoServicio.busLayout);
    const tieneDosPisos = layout?.pisos === 2;

    if (tieneDosPisos) {
      if (!nuevoServicio.seatDescriptionSecond || nuevoServicio.seatDescriptionSecond.trim() === '') {
        showToast('Advertencia', 'Debe completar la descripción del 2° piso.', true);
        return false;
      }
      if (!nuevoServicio.priceSecond || nuevoServicio.priceSecond.toString().trim() === '') {
        showToast('Advertencia', 'Debe ingresar el precio del 2° piso.', true);
        return false;
      }
    }

    return true;
  };
  
  const etiquetasCampos = {
    origin: "Ciudad Origen",
    destination: "Ciudad Destino",
    terminalOrigin: "Terminal Origen",
    terminalDestination: "Terminal Destino",
    startDate: "Fecha de Salida",
    arrivalDate: "Fecha de Llegada",
    time: "Hora de Salida",
    arrivalTime: "Hora de Llegada",
    company: "Compañía",
    busLayout: "Layout del Bus",
    busTypeDescription: "Tipo de Bus",
    seatDescriptionFirst: "Descripción 1° Piso",
    seatDescriptionSecond: "Descripción 2° Piso",
    priceFirst: "Precio 1° Piso",
    priceSecond: "Precio 2° Piso",
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

      return true; // ✅ éxito
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e) => setBusqueda(e.target.value); 

  const handleNuevoChange = (e) => {
    const { name, value } = e.target;
    setNuevoServicio(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDaysChange = (day) => {
    setNuevoServicio(prev => {
      const days = prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day];
      return { ...prev, days };
    });
  };  

  const crearNuevoServicio = async () => {
    if (!validarCampos()) return;
    try {
      const token =
        sessionStorage.getItem("token") ||
        JSON.parse(localStorage.getItem("recordarSession") || '{}').token;

      const payload = {
        ...nuevoServicio,
        priceFirst: nuevoServicio.priceFirst ? Number(nuevoServicio.priceFirst) : null,
        priceSecond: nuevoServicio.priceSecond ? Number(nuevoServicio.priceSecond) : null
      };

      const endpoint = `${SERVICES_ENDPOINT}/generate`;
      const metodo = 'POST';

      const res = await fetch(endpoint, {
        method: metodo, // 'POST'
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al guardar servicio');

      showToast('Éxito', editandoServicioId ? 'Servicio actualizado' : 'Servicio creado');
      setModalNuevoVisible(false);
      setEditandoServicioId(null);  

      await fetchServicios();  
        
    } catch (error) {
      console.error(error);
      showToast('Error', 'No se pudo guardar el servicio.', true);
    }
  };  

  const actualizarServicio = async () => {
    if (!validarCampos()) return;

    try {
      const token =
        sessionStorage.getItem("token") ||
        JSON.parse(localStorage.getItem("recordarSession") || '{}').token;

      const payload = {
        startDate: nuevoServicio.startDate,   // YYYY-MM-DD
        daysOfWeek: nuevoServicio.days,       // [1..7]
        origin: nuevoServicio.origin,
        destination: nuevoServicio.destination,
        terminalOrigin: nuevoServicio.terminalOrigin,
        terminalDestination: nuevoServicio.terminalDestination,
        time: nuevoServicio.time,             // HH:mm (salida)
        arrivalDate: nuevoServicio.arrivalDate,
        arrivalTime: nuevoServicio.arrivalTime,
        company: nuevoServicio.company,
        busLayout: nuevoServicio.busLayout,   // si backend espera name o id, ajusta aquí
        busTypeDescription: nuevoServicio.busTypeDescription,
        seatDescriptionFirst: nuevoServicio.seatDescriptionFirst,
        seatDescriptionSecond: nuevoServicio.seatDescriptionSecond,
        priceFirst: nuevoServicio.priceFirst ? Number(nuevoServicio.priceFirst) : null,
        priceSecond: nuevoServicio.priceSecond ? Number(nuevoServicio.priceSecond) : null,
      };

      const res = await fetch(`${TEMPLATES_ENDPOINT}/${servicioSeleccionado._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al actualizar servicio');

      showToast('Éxito', 'Servicio actualizado correctamente.');
      setModalNuevoVisible(false);
      setModoEdicion(false);
      setNuevoServicio(valoresIniciales); // Reset form       
    } catch (error) {
      console.error(error);
      showToast('Error', 'No se pudo actualizar el servicio.', true);
    }
  };  

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

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setModalNuevoVisible(true)}
                >
                  <i className="bi bi-calendar-plus me-2"></i> Nuevo Servicio
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
                                  className="btn btn-sm btn-info"
                                  onClick={() => {
                                    setServicioSeleccionado(servicio);
                                    setModalVisible(true);
                                  }}
                                  title="Ver asientos"
                                >
                                  <i className="bi bi-eye"></i>
                                </button>{' '}
                                
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
                                {/* <th>ID Servicio</th> */}
                                <th>Origen → Destino</th>
                                <th>Terminales</th>
                                <th>Hora Salida</th>
                                <th>Hora Llegada</th>
                                <th>Fecha salida</th>
                                <th>Fecha llegada</th>
                                <th>Tipo de Bus</th>
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
                                    <td>{minutesToHhMm(servicio.routeMaster?.durationMinutes || 0)}</td>
                                    <td>
                                      {salida && llegada
                                        ? `${formatFechaCL(salida.time)} → ${formatFechaCL(llegada.time)}`
                                        : '—'}
                                    </td>
                                    <td>
                                      <button className="btn btn-sm btn-warning" onClick={() => handleEditar(servicio)}>
                                        <i className="bi bi-pencil-square"></i>
                                      </button>{' '}
                                      <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(servicio._id)}>
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
    
      {/* Modal layout asientos */} 
      <ModalBase
        visible={modalVisible}
        title={
          servicioSeleccionado
            ? `Asientos de: ${servicioSeleccionado.routeMaster?.origin} → ${servicioSeleccionado.routeMaster?.destination}`
            : "Asientos"
        }
        onClose={() => setModalVisible(false)}
        size="xl"
        footer={null}
      >
        {servicioSeleccionado && (() => {
          const isDoubleDecker = servicioSeleccionado.layout?.includes('double');
          const seatsByFloor = { first: [], second: [] };

          servicioSeleccionado.seats.forEach(seat => {
            const fila = parseInt(seat.number.match(/\d+/)?.[0]);
            if (isDoubleDecker) {
              if (fila <= 4) {
                seatsByFloor.first.push(seat);
              } else {
                seatsByFloor.second.push(seat);
              }
            } else {
              seatsByFloor.first.push(seat);
            }
          });

          const renderPiso = (seats, piso, descripcion) => {
          const filas = {};

          seats.forEach(seat => {
            const match = seat.number.match(/^(\d+)([A-Z])$/);
            if (!match) return;

            const [, num, letra] = match;
            if (!filas[num]) filas[num] = { left: [], right: [] };

            if (letra === 'A' || letra === 'B') {
              filas[num].left.push(seat);
            } else {
              filas[num].right.push(seat);
            }
          });

          const resumenPiso = seats.reduce((acc, seat) => {
            if (seat.paid) {
              acc.pagados++;
              acc.ocupados++;
            } else if (seat.reserved) {
              acc.reservados++;
              acc.ocupados++;
            } else {
              acc.disponibles++;
            }
            return acc;
          }, { disponibles: 0, reservados: 0, pagados: 0, ocupados: 0 });

          return (
            <div key={piso} className="mb-5">
              <h6 className="text-muted">
                Piso {piso === 'first' ? '1' : '2'} ({descripcion})
              </h6>
              <div className="d-flex flex-column gap-1 border rounded p-3 bg-light align-items-center">             
                
                {Object.keys(filas)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map(fila => {
                    const { left, right } = filas[fila];
                    return (
                      <div key={fila} className="d-flex gap-3 justify-content-center align-items-center">
                        <div className="d-flex gap-2">
                          {left.map(seat => {
                            const statusClass = seat.paid
                              ? 'btn-danger'
                              : seat.reserved
                              ? 'btn-warning'
                              : 'btn-success';
                            return (
                              <button
                                key={seat._id}
                                className={`btn ${statusClass} btn-sm`}
                                disabled
                                style={{ width: 48 }}
                                title={`${seat.number} - ${seat.paid ? 'Pagado' : seat.reserved ? 'Reservado' : 'Disponible'}`}
                              >
                                {seat.number}
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ width: '24px' }} />

                        <div className="d-flex gap-2">
                          {right.map(seat => {
                            const statusClass = seat.paid
                              ? 'btn-danger'
                              : seat.reserved
                              ? 'btn-warning'
                              : 'btn-success';
                            return (
                              <button
                                key={seat._id}
                                className={`btn ${statusClass} btn-sm`}
                                disabled
                                style={{ width: 48 }}
                                title={`${seat.number} - ${seat.paid ? 'Pagado' : seat.reserved ? 'Reservado' : 'Disponible'}`}
                              >
                                {seat.number}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <p className="mt-2 small text-muted">
                Disponibles: <strong>{resumenPiso.disponibles}</strong> &nbsp;|&nbsp;
                Reservados: <strong>{resumenPiso.reservados}</strong> &nbsp;|&nbsp;
                Pagados: <strong>{resumenPiso.pagados}</strong> &nbsp;|&nbsp;
                Total ocupados: <strong>{resumenPiso.ocupados}</strong>
              </p>
            </div>
          );
        };

          return (
            <div>
              <div className="mb-3">
                <span className="badge bg-success me-2">Disponible</span>
                <span className="badge bg-warning text-dark me-2">Reservado</span>
                <span className="badge bg-danger">Pagado</span>
              </div>
              {renderPiso(
                seatsByFloor.first,
                'first',
                servicioSeleccionado.seatDescriptionFirst || 'Piso inferior'
              )}
              {isDoubleDecker && renderPiso(
                seatsByFloor.second,
                'second',
                servicioSeleccionado.seatDescriptionSecond || 'Piso superior'
              )}
              <div className="mt-3">
                <strong>
                  {servicioSeleccionado.seats.filter(s => !s.paid && !s.reserved).length} asientos disponibles
                </strong>
              </div>
            </div>
          );
        })()}
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