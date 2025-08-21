import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import ModalBase from '@components/ModalBase/ModalBase';
import { showToast } from '@components/Toast/Toast';
import { Tabs, Tab } from 'react-bootstrap';

const Servicios = () => {
  const formatearFecha = (fechaStr) => {
    const [a, m, d] = fechaStr.split("-");
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${a}`;
  };
  const [todosLosServicios, setTodosLosServicios] = useState([]);  
  const [serviciosFiltrados, setServiciosFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalNuevoVisible, setModalNuevoVisible] = useState(false);
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
  
  const [layouts, setLayouts] = useState([]);
  const layoutSeleccionado = layouts.find(l => l.name === nuevoServicio.busLayout);
  const tieneDosPisos = layoutSeleccionado?.pisos === 2;
  const [ciudades, setCiudades] = useState([]);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [servicioEditando, setServicioEditando] = useState(null);
  const [editandoServicioId, setEditandoServicioId] = useState(null);
  const [orden, setOrden] = useState('hora');
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [serviciosPorFecha, setServiciosPorFecha] = useState({});   
  const [fechasTabs, setFechasTabs] = useState([]);
  const [origenesDestinos, setOrigenesDestinos] = useState([]);
  const [origenSeleccionado, setOrigenSeleccionado] = useState('');
  const [destinosDisponibles, setDestinosDisponibles] = useState([]);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [origenesDisponibles, setOrigenesDisponibles] = useState([]);
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
      'ID','Origen','Destino','TerminalOrigen','TerminalDestino',
      'FechaSalida','HoraSalida','FechaLlegada','HoraLlegada',
      'TipoBus','Precio1Piso','Precio2Piso','Compañía','Layout'
    ];
    const lines = [header.map(escapeCSV).join(',')];

    rows.forEach(s => {
      lines.push([
        s._id,
        s.origin,
        s.destination,
        s.terminalOrigin,
        s.terminalDestination,
        s.date,           // ya la normalizas a YYYY-MM-DD
        s.departureTime,
        s.arrivalDate,    // en fetchServicios la pasas a YYYY-MM-DD
        s.arrivalTime,
        s.busTypeDescription,
        s.priceFirst,
        s.priceSecond,
        s.company,
        s.busLayout
      ].map(escapeCSV).join(','));
    });

    // BOM para acentos en Excel
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
        const toMin = (s) => {
          if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
          const [h, m] = s.split(':').map(Number);
          return (isNaN(h) || isNaN(m)) ? Number.POSITIVE_INFINITY : h * 60 + m;
        };
        return sign * (toMin(a.departureTime) - toMin(b.departureTime));
      }

      if (criterio === 'tipoBus') {
        const diff = (a.busTypeDescription || '').localeCompare(b.busTypeDescription || '');
        return sign * diff;
      }

      return 0; // 'fecha' no reordena
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
        const res = await fetch('https://boletos.dev-wit.com/api/layouts/');
        const data = await res.json();
        setLayouts(data);
      } catch (error) {
        console.error('Error al obtener layouts:', error);
      }
    };
    fetchLayouts();
  }, []);

  useEffect(() => {
    const obtenerCiudades = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/cities');
        const data = await res.json();
        setCiudades(data);
      } catch (error) {
        console.error("Error al obtener ciudades:", error);
      }
    };

    obtenerCiudades();
  }, []);

  useEffect(() => {
    fetchServicios();
  }, []);

  useEffect(() => {
    if (!fechaSeleccionada) return;

    const listaBase = 
      fechaSeleccionada === "todos"
        ? todosLosServicios
        : (serviciosPorFecha[fechaSeleccionada] || []);

    const filtrados = listaBase.filter((s) => {
      const coincideOrigen = !origenSeleccionado || s.origin === origenSeleccionado;
      const coincideDestino = !destinoSeleccionado || s.destination === destinoSeleccionado;
      const texto = `${s.origin} ${s.destination} ${s._id}`.toLowerCase();
      return coincideOrigen && coincideDestino && texto.includes(busqueda.toLowerCase());
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
    origenSeleccionado,
    destinoSeleccionado
  ]);  

  useEffect(() => {
    const cargarOrigenes = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/routes/origins');
        const data = await res.json();
        setOrigenesDestinos(data);
      } catch (error) {
        console.error('Error cargando origenes:', error);
      }
    };

    cargarOrigenes();
  }, []);

  useEffect(() => {
    const origen = origenesDestinos.find((o) => o.origen === origenSeleccionado);
    setDestinosDisponibles(origen ? origen.destinos : []);
    setDestinoSeleccionado('');
  }, [origenSeleccionado]); 

  useEffect(() => {
    if (!destinoSeleccionado) {
      setOrigenesDisponibles([]);
      return;
    }

    const posiblesOrigenes = origenesDestinos
      .filter((o) => o.destinos.includes(destinoSeleccionado))
      .map((o) => o.origen);

    setOrigenesDisponibles(posiblesOrigenes);
  }, [destinoSeleccionado]);

  const fetchServicios = async () => {
    try {
      setCargando(true);
      const token =
        sessionStorage.getItem("token") ||
        JSON.parse(localStorage.getItem("recordarSession") || "{}").token;

      const res = await fetch("https://boletos.dev-wit.com/api/services/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("No se pudieron obtener los servicios.");
      const data = await res.json();

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const serviciosNormalizados = data.map((servicio) => {
        const fechaServicio = new Date(servicio.date);
        const fechaNormalizada = fechaServicio.toLocaleDateString("sv-SE"); // YYYY-MM-DD

        return {
          ...servicio,
          fechaNormalizada,
          date: fechaNormalizada,
          arrivalDate: new Date(servicio.arrivalDate).toISOString().split("T")[0],
        };
      });

      // Agrupar por fecha
      const serviciosPorFechaTmp = {};
      serviciosNormalizados.forEach((servicio) => {
        const fecha = servicio.fechaNormalizada;
        if (!serviciosPorFechaTmp[fecha]) serviciosPorFechaTmp[fecha] = [];
        serviciosPorFechaTmp[fecha].push(servicio);
      });

      // Generar fechas para los tabs
      const fechasTabs = [];
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      fechasTabs.push(ayer.toLocaleDateString("sv-SE"));
      fechasTabs.push(hoy.toLocaleDateString("sv-SE"));
      for (let i = 1; i <= 6; i++) {
        const dia = new Date(hoy);
        dia.setDate(hoy.getDate() + i);
        fechasTabs.push(dia.toLocaleDateString("sv-SE"));
      }

      // Actualizar estados
      setTodosLosServicios(serviciosNormalizados); // ✅ Aquí cargas todos
      setServiciosPorFecha(serviciosPorFechaTmp);
      setFechasTabs(fechasTabs);

      // Establecer fecha seleccionada si no hay una ya
      if (!fechaSeleccionada) {
        setFechaSeleccionada(hoy.toLocaleDateString("sv-SE"));
      }

      // Inicializar serviciosFiltrados si corresponde
      const hoyStr = hoy.toLocaleDateString("sv-SE");
      if (serviciosPorFechaTmp[hoyStr]) {
        setServiciosFiltrados(
          ordenarServicios(serviciosPorFechaTmp[hoyStr], orden, ordenAscendente)
        );
      } else {
        setServiciosFiltrados([]);
      }
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      showToast("Error", "No se pudieron cargar los servicios.", true);
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e) => {
    const texto = e.target.value.toLowerCase();
    setBusqueda(texto);

    if (!texto) {
      // Si no hay texto de búsqueda, mostrar todos los servicios de la fecha seleccionada
      setServiciosFiltrados(serviciosPorFecha[fechaSeleccionada] || []);
      return;
    }

    // Filtrar los servicios de la fecha seleccionada
    const serviciosFecha = serviciosPorFecha[fechaSeleccionada] || [];
    const filtrados = serviciosFecha.filter((s) => {
      return (
        s.origin.toLowerCase().includes(texto) ||
        s.destination.toLowerCase().includes(texto) ||
        s._id.toLowerCase().includes(texto) ||
        s.terminalOrigin.toLowerCase().includes(texto) ||
        s.terminalDestination.toLowerCase().includes(texto) ||
        s.busTypeDescription.toLowerCase().includes(texto) ||
        s.company.toLowerCase().includes(texto)
      );
    });

    setServiciosFiltrados(filtrados);
  };  

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

      const endpoint = editandoServicioId
        ? `https://boletos.dev-wit.com/api/templates/update/${editandoServicioId}`
        : `https://boletos.dev-wit.com/api/templates/create`;

      const metodo = editandoServicioId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
        ...nuevoServicio,
        priceFirst: nuevoServicio.priceFirst ? Number(nuevoServicio.priceFirst) : null,
        priceSecond: nuevoServicio.priceSecond ? Number(nuevoServicio.priceSecond) : null,
        date: nuevoServicio.startDate,
        departureTime: nuevoServicio.time,
        arrivalDate: nuevoServicio.arrivalDate,
        arrivalTime: nuevoServicio.arrivalTime
      };

      const res = await fetch(`https://boletos.dev-wit.com/api/templates/${servicioSeleccionado._id}`, {
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

  const tiposDeBus = [
    {
      tipo: "Salón-Ejecutivo",
      descripcionPiso1: "Asientos ejecutivo",
      descripcionPiso2: "Ejecutivo estándar"
    },
    {
      tipo: "Semi-cama",
      descripcionPiso1: "Semi-cama normal",
      descripcionPiso2: "Semi-cama reclinable"
    },
    {
      tipo: "Cama",
      descripcionPiso1: "Cama total",
      descripcionPiso2: "Cama reclinable"
    },
    {
      tipo: "Premium",
      descripcionPiso1: "Butaca Premium",
      descripcionPiso2: "Butaca Premium Relax"
    }
  ];

  const terminales = [
    "Terminal Alameda",
    "Terminal Sur Santiago",
    "Terminal Rodoviario Antofagasta",
    "Terminal de Buses Temuco",
    "Terminal de Buses Valparaíso",
    "Terminal de Buses Concepción",
    "Terminal de Buses Osorno",
    "Terminal de Buses Iquique",
    "Terminal de Buses Chillán",
    "Terminal de Buses Puerto Montt"
  ];

  const companias = [
    "BusesExpress",
    "TurBus",
    "Pullman Bus",
    "Condor Bus",
    "JetSur",
    "Buses Romani",
    "Buses BioBio",
    "Andesmar Chile",
    "Via Costa",
    "Expreso Norte"
  ];   

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
                      await fetchServicios(); // reutiliza headers + normalización + agrupación
                      showToast('Actualizado', 'Lista de servicios sincronizada correctamente.');
                    } catch (e) {
                      console.error(e);
                      showToast('Error', 'No se pudo actualizar la lista de servicios', true);
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
                  value={origenSeleccionado}
                  onChange={(e) => setOrigenSeleccionado(e.target.value)}
                >
                  <option value="">Todos</option>
                  {(destinoSeleccionado
                    ? origenesDisponibles
                    : origenesDestinos.map((o) => o.origen)
                  ).map((origen) => (
                    <option key={origen} value={origen}>{origen}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Destino</label>
                <select
                  className="form-select form-select-sm"
                  value={destinoSeleccionado}
                  onChange={(e) => setDestinoSeleccionado(e.target.value)}
                >
                  <option value="">Todos</option>
                  {(origenSeleccionado
                    ? destinosDisponibles
                    : [...new Set(origenesDestinos.flatMap((o) => o.destinos))]
                  ).map((destino) => (
                    <option key={destino} value={destino}>{destino}</option>
                  ))}
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
                          {/* <th>ID Servicio</th> */}
                          <th>Origen → Destino</th>
                          <th>Terminales</th>
                          <th>Hora Salida</th>
                          <th>Hora Llegada</th>
                          <th>Fecha salida</th>
                          <th>Fecha llegada</th>
                          <th>Tipo de Bus</th>
                          <th>Precios</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviciosFiltrados.map((servicio) => (
                          <tr key={servicio._id}>
                            {/* <td>{servicio._id}</td> */}
                            <td>{servicio.origin} → {servicio.destination}</td>
                            <td>{servicio.terminalOrigin} / {servicio.terminalDestination}</td>
                            <td>{servicio.departureTime}</td>
                            <td>{servicio.arrivalTime}</td>
                            <td>{formatearFecha(servicio.date)}</td>
                            <td>{formatearFecha(servicio.arrivalDate)}</td>
                            <td>{servicio.busTypeDescription}</td>
                            <td>
                              1° piso: ${servicio.priceFirst}<br />
                              2° piso: ${servicio.priceSecond}
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
                        ))}
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
                                <th>Precios</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {serviciosFiltrados.map((servicio) => (
                                <tr key={servicio._id}>
                                  {/* <td>{servicio._id}</td> */}
                                  <td>{servicio.origin} → {servicio.destination}</td>
                                  <td>{servicio.terminalOrigin} / {servicio.terminalDestination}</td>
                                  <td>{servicio.departureTime}</td>
                                  <td>{servicio.arrivalTime}</td>
                                  <td>{formatearFecha(servicio.date)}</td>
                                  <td>{formatearFecha(servicio.arrivalDate)}</td>
                                  <td>{servicio.busTypeDescription}</td>
                                  <td>
                                    1° piso: ${servicio.priceFirst}<br />
                                    2° piso: ${servicio.priceSecond}
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
                              ))}
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
                        
      {/* Modal Nuevo Servicio */}  
      <ModalBase
        visible={modalNuevoVisible}
        title="Nuevo Servicio"
        onClose={() => setModalNuevoVisible(false)}
        footer={
          <button className="btn btn-primary" onClick={crearNuevoServicio}>
            Guardar
          </button>
        }>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Ciudad Origen</label>
            <select
              name="origin"
              className="form-control"
              value={nuevoServicio.origin}
              onChange={handleNuevoChange}
            >
              <option value="">Seleccione Origen</option>
              {ciudades.map((ciudad) => (
                <option key={ciudad._id} value={ciudad.name}>
                  {ciudad.name} ({ciudad.region})
                </option>
              ))}
            </select>
          </div>


          <div className="col-md-6">
            <label className="form-label">Ciudad Destino</label>
            <select
              name="destination"
              className="form-control"
              value={nuevoServicio.destination}
              onChange={handleNuevoChange}
            >
              <option value="">Seleccione Destino</option>
              {ciudades.map((ciudad) => (
                <option key={ciudad._id} value={ciudad.name}>
                  {ciudad.name} ({ciudad.region})
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Terminal Origen</label>
            <select
              name="terminalOrigin"
              className="form-control"
              onChange={handleNuevoChange}
            >
              <option value="">Seleccione Terminal</option>
              {terminales.map((terminal, i) => (
                <option key={i} value={terminal}>{terminal}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Terminal Destino</label>
            <select
              name="terminalDestination"
              className="form-control"
              onChange={handleNuevoChange}
            >
              <option value="">Seleccione Terminal</option>
              {terminales.map((terminal, i) => (
                <option key={i} value={terminal}>{terminal}</option>
              ))}
            </select>
          </div> 

          <div className="col-md-6">
            <label className="form-label">Fecha de Salida</label>
            <input type="date" name="startDate" className="form-control" onChange={handleNuevoChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Hora de Salida</label>
            <input type="time" name="time" className="form-control" onChange={handleNuevoChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Fecha Llegada</label>
            <input type="date" name="arrivalDate" className="form-control" onChange={handleNuevoChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Hora Llegada</label>
            <input type="time" name="arrivalTime" className="form-control" onChange={handleNuevoChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Días vigente</label>
            <div className="d-flex flex-wrap gap-1">
              {[1,2,3,4,5,6,7].map(d => (
                <button
                  key={d}
                  type="button"
                  className={`btn btn-sm ${nuevoServicio.days.includes(d) ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => handleDaysChange(d)}
                >
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'][d-1]}
                </button>
              ))}
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label">Compañía</label>
            <select
              name="company"
              className="form-control"
              onChange={handleNuevoChange}
            >
              <option value="">Seleccione Compañía</option>
              {companias.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Layout del Bus</label>
            <select
              name="busLayout"
              className="form-control"
              onChange={(e) => {
                handleNuevoChange(e);

                const layoutSeleccionado = layouts.find(l => l.name === e.target.value);
                if (layoutSeleccionado?.pisos !== 2) {
                  // Limpiar segundo piso si el layout no tiene 2 pisos
                  setNuevoServicio(prev => ({
                    ...prev,
                    seatDescriptionSecond: ""
                  }));
                }
              }}
            >
              <option value="">Seleccione layout</option>
              {layouts.map((layout, i) => (
                <option key={i} value={layout.name}>{layout.name}</option>
              ))}
            </select>
            {nuevoServicio.busLayout && (
              <div className="mt-2 small text-muted">
                {(() => {
                  const selected = layouts.find(l => l.name === nuevoServicio.busLayout);
                  if (!selected) return null;

                  const info = [];
                  if (selected.pisos) info.push(`Pisos: ${selected.pisos}`);
                  if (selected.capacidad) info.push(`Capacidad: ${selected.capacidad}`);
                  if (selected.tipo_Asiento_piso_1) info.push(`1° piso: ${selected.tipo_Asiento_piso_1}`);
                  if (selected.tipo_Asiento_piso_2) info.push(`2° piso: ${selected.tipo_Asiento_piso_2}`);
                  if (selected.rows && selected.columns) info.push(`Filas: ${selected.rows}, Columnas: ${selected.columns}`);

                  return info.join(' | ');
                })()}
              </div>
            )}

          </div>
          
          <div className="col-md-6">
            <label className="form-label">Tipo de Bus</label>
            <select
              name="busTypeDescription"
              className="form-control"
              onChange={(e) => {
                const tipo = e.target.value;
                const match = tiposDeBus.find(t => t.tipo === tipo);
                handleNuevoChange({ target: { name: 'busTypeDescription', value: tipo } });
                handleNuevoChange({ target: { name: 'seatDescriptionFirst', value: match?.descripcionPiso1 || '' } });
                handleNuevoChange({ target: { name: 'seatDescriptionSecond', value: match?.descripcionPiso2 || '' } });
              }}
            >
              <option value="">Seleccione tipo</option>
              {tiposDeBus.map((t, i) => (
                <option key={i} value={t.tipo}>{t.tipo}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Descripción 1° Piso</label>
            <select
              name="seatDescriptionFirst"
              className="form-control"
              onChange={handleNuevoChange}
              value={nuevoServicio.seatDescriptionFirst || ''}
            >
              <option value="">Seleccione descripción</option>
              {[...new Set(tiposDeBus.map(t => t.descripcionPiso1))].map((desc, i) => (
                <option key={i} value={desc}>{desc}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Descripción 2° Piso</label>
            <select
              name="seatDescriptionSecond"
              className="form-control"
              onChange={handleNuevoChange}
              value={nuevoServicio.seatDescriptionSecond || ''}
              disabled={!tieneDosPisos}
            >
              <option value="">{tieneDosPisos ? 'Seleccione descripción' : 'Solo 1 piso'}</option>
              {[...new Set(tiposDeBus.map(t => t.descripcionPiso2))].map((desc, i) => (
                <option key={i} value={desc}>{desc}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Precio 1° Piso</label>
            <input
              type="number"
              name="priceFirst"
              className="form-control"
              value={nuevoServicio.priceFirst ?? ''}
              onChange={handleNuevoChange}
              placeholder="Ej: 15000"
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Precio 2° Piso</label>
            <input
              type="number"
              name="priceSecond"
              className="form-control"
              value={nuevoServicio.priceSecond ?? ''}
              onChange={handleNuevoChange}
              placeholder="Ej: 14000"
            />
          </div>
                   
        </div>
      </ModalBase>  

      {/* Modal Editar */}        
      <ModalBase
        visible={modalEditarVisible}
        title="Editar Servicio"
        onClose={() => {
          setModalNuevoVisible(false);
          setModoEdicion(false);
          setNuevoServicio(valoresIniciales);
        }}
        footer={
          <button
            className="btn btn-primary"
            onClick={actualizarServicio}
          >
            Guardar Cambios
          </button>
        }
      >
        {servicioEditando && (
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Ciudad Origen</label>
              <input
                type="text"
                className="form-control"
                name="origin"
                value={servicioEditando.origin}
                onChange={(e) =>
                  setServicioEditando((prev) => ({ ...prev, origin: e.target.value }))
                }
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Ciudad Destino</label>
              <input
                type="text"
                className="form-control"
                name="destination"
                value={servicioEditando.destination}
                onChange={(e) =>
                  setServicioEditando((prev) => ({ ...prev, destination: e.target.value }))
                }
              />
            </div>
            {/* ... agrega los demás campos según lo que quieras editar */}
          </div>
        )}
      </ModalBase>
    
      {/* Modal layout asientos */} 
      <ModalBase
              visible={modalVisible}
              title={`Asientos de: ${servicioSeleccionado?.origin} → ${servicioSeleccionado?.destination}`}
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