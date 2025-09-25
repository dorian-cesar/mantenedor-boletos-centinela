import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';
import Swal from 'sweetalert2';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error("❌ No se encontró VITE_API_URL en el entorno");
}

const ROUTES_ENDPOINT = `${API_URL}/route-masters`;
const LAYOUTS_ENDPOINT = `${API_URL}/bus-layout`;

/** Utils */
const pad2 = (n) => String(n).padStart(2, '0');
const hhmmToMin = (hhmm) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minutesToTimeString = (mins) => {
  if (typeof mins !== 'number' || Number.isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
};
const minutesToHhMm = (mins) => {
  if (typeof mins !== 'number' || Number.isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const formatCLP = (value) => {
  if (typeof value !== "number" || isNaN(value)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(value);
};

const formatHoraConDia = (start, offset = 0) => {
  const total = start + offset;
  const diaExtra = Math.floor(total / 1440); // 1440 min = 24h
  const minutos = total % 1440;

  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const hhmm = `${pad2(h)}:${pad2(m)}`;

  if (diaExtra === 0) return hhmm;
  if (diaExtra === 1) return `${hhmm} (día siguiente)`;
  return `${hhmm} (+${diaExtra} días)`;
};

const Rutas = () => {
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [layouts, setLayouts] = useState([]);
  const [modalLayoutVisible, setModalLayoutVisible] = useState(false);
  const [layoutSeleccionado, setLayoutSeleccionado] = useState(null);



  // Modal crear/editar
  const [modalRutaVisible, setModalRutaVisible] = useState(false);
  const [rutaEditando, setRutaEditando] = useState(null);

  const [formRuta, setFormRuta] = useState({
    name: '',
    origin: '',
    destination: '',
    startTime: '',
    direction: '',
    durationHours: 0,
    durationMins: 0,
    layout: '',
    originPrice: 0,
    stops: [
      { name: '', order: 1, offsetMinutes: 0, price: 0 },
      { name: '', order: 2, offsetMinutes: 0, price: 0 },
    ],
    schedule: {
      active: true,
      daysOfWeek: [],   // aquí se seleccionan los días (1=lunes, ..., 7=domingo)
      startDate: null,
      endDate: null,
      horizonDays: 14,
      exceptions: []
    }
  });

  const handleReorderStops = (result) => {
    if (!result.destination) return; // si se suelta fuera, no hacer nada

    const reordered = Array.from(formRuta.stops);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    // Recalcular orden
    const reindexed = reordered.map((s, i) => ({ ...s, order: i + 1 }));

    setFormRuta((prev) => ({ ...prev, stops: reindexed }));
  };

  const [rutasExpandida, setRutasExpandida] = useState(null);
  const [filtro, setFiltro] = useState('');

  /** Carga inicial */
  useEffect(() => {
    const fetchRutas = async () => {
      try {
        const res = await fetch(ROUTES_ENDPOINT, {
          headers: {
            "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
          },
        });

        const data = await res.json();
        setRutas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error al cargar rutas:', error);
      } finally {
        setCargando(false);
      }
    };
    const fetchLayouts = async () => {
      try {
        const res = await fetch(LAYOUTS_ENDPOINT, {
          headers: {
            "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        const data = await res.json();
        setLayouts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error al cargar layouts:", err);
      }
    };
    fetchRutas();
    fetchLayouts();
  }, []);

  const toggleExpandirRuta = (rutaId) => {
    setRutasExpandida((prev) => (prev === rutaId ? null : rutaId));
  };

  /** Crear / Editar */
  const abrirModalNuevaRuta = () => {
    setRutaEditando(null);
    setFormRuta({
      name: '',
      origin: '',
      destination: '',
      startTime: '',
      direction: '',
      durationHours: 0,
      durationMins: 0,
      originPrice: 0,
      layout: '',
      stops: [
        { name: '', order: 1, offsetMinutes: 0, price: 0 },
        { name: '', order: 2, offsetMinutes: 0, price: 0 },
      ],
      schedule: {
        active: true,
        daysOfWeek: [],
        startDate: null,
        endDate: null,
        horizonDays: 14,
        exceptions: []
      }
    });
    setModalRutaVisible(true);
  };

  const handleStopChange = (index, field, value) => {
    setFormRuta((prev) => {
      const next = [...prev.stops];
      const parsed =
        field === 'offsetMinutes' || field === 'segmentPrice'
          ? Number(value) || 0
          : value;
      next[index] = { ...next[index], [field]: parsed };
      return { ...prev, stops: next };
    });
  };

  const agregarParada = () => {
    setFormRuta((prev) => {
      const nextOrder = (prev.stops?.length || 0) + 1;
      return {
        ...prev,
        stops: [
          ...prev.stops,
          { stop: '', order: nextOrder, offsetMinutes: 0, segmentPrice: 0 },
        ],
      };
    });
  };

  const eliminarParada = (index) => {
    setFormRuta((prev) => {
      const filtered = prev.stops.filter((_, i) => i !== index);
      // Recalcular "order"
      const reindexed = filtered.map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, stops: reindexed };
    });
  };

  const handleGuardarRuta = async () => {
    // 🔹 Validaciones mínimas
    if (!formRuta.origin.trim() || !formRuta.destination.trim()) {
      showToast('Datos incompletos', 'Debes ingresar origen y destino.', true);
      return;
    }
    if (!formRuta.startTime) {
      showToast('Datos incompletos', 'Debes ingresar la hora de salida base.', true);
      return;
    }
    if (!formRuta.direction) {
      showToast('Datos incompletos', 'Debes seleccionar la dirección (subida/bajada).', true);
      return;
    }

    const stopsLimpias = formRuta.stops
      .map((s, i) => ({
        name: (s.name || '').trim(),
        order: i + 1,
        offsetMinutes: Number(s.offsetMinutes) || 0,
        price: Number(s.price) || 0,
      }))
      .filter((s) => s.name);

    // Necesitamos al menos una parada intermedia,
    // porque origen y destino los agregamos abajo
    if (stopsLimpias.length < 0) {
      showToast('Datos incompletos', 'Debes ingresar al menos una parada intermedia.', true);
      return;
    }

    // Calcular duración
    let durationMinutes =
      Number(formRuta.durationHours) * 60 + Number(formRuta.durationMins);

    // Fallback: usar la última parada como duración si no se ingresó nada
    if (durationMinutes <= 0 && stopsLimpias.length > 0) {
      durationMinutes = stopsLimpias[stopsLimpias.length - 1].offsetMinutes;
    }

    const startTime = hhmmToMin(formRuta.startTime);
    if (startTime == null) {
      showToast('Datos inválidos', 'La hora de salida no tiene formato válido.', true);
      return;
    }

    // 🔹 Armar stops finales con origen y destino incluidos
    const stopsFinal = [
      {
        name: formRuta.origin.trim(),
        order: 0,
        offsetMinutes: 0,
        price: Number(formRuta.originPrice) || 0,
      },
      ...stopsLimpias.map((s, i) => ({ ...s, order: i + 1 })),
      {
        name: formRuta.destination.trim(),
        order: stopsLimpias.length + 1,
        offsetMinutes: durationMinutes,
        price: 0, // destino puedes dejarlo fijo en 0
      },
    ];

    const payload = {
      name: formRuta.name.trim(),
      origin: formRuta.origin.trim(),
      destination: formRuta.destination.trim(),
      startTime,
      durationMinutes,
      direction: formRuta.direction,
      stops: stopsFinal,
      layout: formRuta.layout || null,
      schedule: formRuta.schedule 
    };

    const esNueva = !rutaEditando;
    const endpoint = esNueva
      ? ROUTES_ENDPOINT
      : `${ROUTES_ENDPOINT}/${encodeURIComponent(rutaEditando)}`;
    const method = esNueva ? "POST" : "PUT";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        const msg = body?.error || body?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      const rutaGuardada = body;
      setRutas((prev) =>
        esNueva
          ? [...prev, rutaGuardada]
          : prev.map((r) => (r._id === rutaEditando ? rutaGuardada : r))
      );

      showToast(
        esNueva ? "Ruta creada" : "Ruta actualizada",
        esNueva ? "Se creó correctamente" : "Cambios guardados"
      );
      setModalRutaVisible(false);
      setRutaEditando(null);
    } catch (err) {
      console.error(err);
      showToast("Error", err.message || "No se pudo guardar la ruta", true);
    }
  };

  const handleEliminar = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar ruta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${ROUTES_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error('Error al eliminar');

      setRutas((prev) => prev.filter((t) => t._id !== id));
      await Swal.fire('Ruta eliminada', 'La ruta fue eliminada exitosamente.', 'success');
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'No se pudo eliminar la ruta', 'error');
    }
  };

  /** Filtro robusto (name/origin/destination/direction + paradas por nombre) */
  const rutasFiltradas = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    if (!term) return rutas;
    return rutas.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const origin = r.origin;
      const destination = r.destination;
      const startTime = minutesToTimeString(r.startTime);
      const durationMinutes = r.durationMinutes;
      const direction = r.direction;
      const originLc = (origin || '').toLowerCase();
      const destLc = (destination || '').toLowerCase();
      const dirLc = (direction || '').toLowerCase();
      const hasStopName = (r.stops || []).some((s) =>
        (s.name || '').toLowerCase().includes(term)
      );
      return (
        name.includes(term) ||
        originLc.includes(term) ||
        destLc.includes(term) ||
        dirLc.includes(term) ||
        hasStopName
      );
    });
  }, [rutas, filtro]);

  const isExpanded = (id) => rutasExpandida === id;

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="rutas" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Rutas</h1>
          <p className="text-muted">Aquí puedes visualizar y gestionar las rutas</p>
        </div>

        <div className="stats-box">
          <div className="d-flex flex-column gap-2 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h5 className="mb-0">Listado de Rutas</h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary"
                  onClick={async () => {
                    try {
                      const res = await fetch(ROUTES_ENDPOINT, {
                        headers: {
                          "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
                        },
                      });
                      const data = await res.json();
                      setRutas(Array.isArray(data) ? data : []);
                      showToast('Actualizado', 'Lista de rutas sincronizada');
                    } catch (err) {
                      console.error(err);
                      showToast('Error al actualizar', err.message || 'No se pudo sincronizar', true);
                    }
                  }}
                >
                  <i className="bi bi-arrow-repeat" /> Actualizar
                </button>

                <button className="btn btn-primary" onClick={abrirModalNuevaRuta}>
                  <i className="bi bi-plus-lg me-1" /> Nueva ruta
                </button>
              </div>
            </div>

            <div className="input-group w-100">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                className="form-control"
                placeholder="Buscar por nombre, origen, destino o dirección…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
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
              <p className="mt-2">Cargando rutas...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th></th>
                    <th>Nombre</th>
                    <th>Origen → Destino</th>
                    <th>Layout</th>
                    <th>Inicio</th>
                    <th>Duración</th>
                    <th>Dirección</th>
                    <th>Días de Servicio</th>
                    <th>Paradas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rutasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={9}>Sin resultados</td>
                    </tr>
                  )}

                  {rutasFiltradas.map((ruta) => {
                    const totalParadas = ruta?.stops?.length || 0;
                    return (
                      <React.Fragment key={ruta._id}>
                        <tr className={isExpanded(ruta._id) ? "table-active" : ""}>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleExpandirRuta(ruta._id)}
                            >
                              <i
                                className={`bi ${
                                  isExpanded(ruta._id)
                                    ? "bi-chevron-down"
                                    : "bi-chevron-right"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="fw-semibold">{ruta.name || "—"}</td>
                          <td>{`${ruta.origin || "—"} → ${ruta.destination || "—"}`}</td>
                          <td>
                            {ruta.layout ? (
                              <>
                                {ruta.layout.name}
                                <br />
                                <small className="text-muted">
                                  {ruta.layout.capacidad} asientos
                                </small>
                                <br />
                                <button
                                  className="btn btn-sm btn-outline-secondary mt-1"
                                  onClick={() => {
                                    setLayoutSeleccionado(ruta.layout);
                                    setModalLayoutVisible(true);
                                  }}
                                >
                                  <i className="bi bi-eye" /> Ver
                                </button>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {ruta.startTime != null
                              ? minutesToTimeString(ruta.startTime)
                              : "—"}
                          </td>
                          <td>
                            {ruta.durationMinutes != null ? (
                              <>
                                {minutesToHhMm(ruta.durationMinutes)}
                                <br />
                                <small className="text-muted">
                                  Llegada:{" "}
                                  {formatHoraConDia(
                                    ruta.startTime,
                                    ruta.durationMinutes
                                  )}
                                </small>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{ruta.direction || "—"}</td>

                          <td>
                            {ruta.schedule?.daysOfWeek?.length > 0
                              ? ruta.schedule.daysOfWeek
                                  .sort((a,b) => a-b)
                                  .map(d => ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][d-1])
                                  .join(", ")
                              : "—"}
                          </td>

                          <td>
                            <span className="badge bg-info-subtle text-info-emphasis border">
                              {totalParadas}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => {
                                  setRutaEditando(ruta._id);
                                  setFormRuta({
                                    name: ruta.name || "",
                                    origin: ruta.origin || "",
                                    destination: ruta.destination || "",
                                    startTime: ruta.startTime != null ? minutesToTimeString(ruta.startTime) : "",
                                    direction: ruta.direction || "",
                                    durationHours: Math.floor((ruta.durationMinutes || 0) / 60),
                                    durationMins: (ruta.durationMinutes || 0) % 60,
                                    originPrice: ruta.stops?.[0]?.price || 0,
                                    layout: ruta.layout?._id || "",
                                    stops: (ruta.stops || [])
                                      .filter((s, i, arr) => i !== 0 && i !== arr.length - 1)
                                      .map((s, i) => ({
                                        name: s.name || "",
                                        order: i + 1,
                                        offsetMinutes: s.offsetMinutes || 0,
                                        price: s.price || 0,
                                      })),
                                    schedule: ruta.schedule || {
                                      active: true,
                                      daysOfWeek: [],
                                      startDate: null,
                                      endDate: null,
                                      horizonDays: 14,
                                      exceptions: []
                                    }
                                  });
                                  setModalRutaVisible(true);
                                }}
                              >
                                <i className="bi bi-pencil" /> Editar
                              </button>

                              <button
                                className="btn btn-outline-danger"
                                onClick={() => handleEliminar(ruta._id)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded(ruta._id) && (
                          <tr>
                            <td colSpan={9}>
                              <div className="p-2 border rounded bg-light">
                                <h6>Paradas</h6>
                                {ruta.stops?.length > 0 ? (
                                  <table className="table table-sm mb-0">
                                    <thead>
                                      <tr>
                                        <th>#</th>
                                        <th>Nombre</th>
                                        <th>Hora Estimada</th>
                                        <th>Precio</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...(ruta.stops || [])]
                                        .sort(
                                          (a, b) => (a.order || 0) - (b.order || 0)
                                        )
                                        .map((stop, i) => (
                                          <tr key={stop._id || i}>
                                            <td>{stop.order}</td>
                                            <td>{stop.name || "—"}</td>
                                            <td>
                                              {formatHoraConDia(
                                                ruta.startTime,
                                                stop.offsetMinutes
                                              )}
                                              <br />
                                              <small className="text-muted">
                                                ({stop.offsetMinutes} min)
                                              </small>
                                            </td>
                                            <td>{formatCLP(stop.price)}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-muted mb-0">
                                    No hay paradas registradas.
                                  </p>
                                )}
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

      <ModalBase
        visible={modalRutaVisible}
        title={rutaEditando ? 'Editar Ruta' : 'Nueva Ruta'}
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
        {/* Nombre de la ruta */}
        <div className="mb-3">
          <label className="form-label">Nombre de la ruta</label>
          <input
            type="text"
            className="form-control"
            value={formRuta.name}
            onChange={(e) =>
              setFormRuta((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Ej: Ovalle - Minera Centinela"
          />
        </div>

       {/* Origen + Precio Origen en la misma fila */}
        <div className="row">
          <div className="col-md-6">
            <label className="form-label">Origen</label>
            <input
              type="text"
              className="form-control"
              value={formRuta.origin}
              onChange={(e) =>
                setFormRuta((prev) => ({ ...prev, origin: e.target.value }))
              }
              placeholder="Ej: Ovalle"
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Precio Origen</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={formRuta.originPrice || 0}
              onChange={(e) =>
                setFormRuta((prev) => ({
                  ...prev,
                  originPrice: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        {/* Destino + Dirección en la misma fila */}
        <div className="row mb-3">
          <div className="col-md-6 mb-3">
            <label className="form-label mt-2">Destino</label>
            <input
              type="text"
              className="form-control"
              value={formRuta.destination}
              onChange={(e) =>
                setFormRuta((prev) => ({ ...prev, destination: e.target.value }))
              }
              placeholder="Ej: Minera Centinela"
            />
          </div>

          <div className="col-md-6 mb-3">
            <label className="form-label mt-2">Dirección</label>
            <select
              className="form-select"
              value={formRuta.direction}
              onChange={(e) =>
                setFormRuta((prev) => ({ ...prev, direction: e.target.value }))
              }
            >
              <option value="">Seleccione...</option>
              <option value="subida">Subida</option>
              <option value="bajada">Bajada</option>
            </select>
          </div>
        </div>

        {/* Hora de salida y duración */}
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Hora de Salida Base</label>
            <input
              type="time"
              className="form-control"
              value={formRuta.startTime}
              onChange={(e) =>
                setFormRuta((prev) => ({ ...prev, startTime: e.target.value }))
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Duración (horas)</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={formRuta.durationHours}
              onChange={(e) =>
                setFormRuta((prev) => ({
                  ...prev,
                  durationHours: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Duración (minutos)</label>
            <input
              type="number"
              min="0"
              max="59"
              className="form-control"
              value={formRuta.durationMins}
              onChange={(e) =>
                setFormRuta((prev) => ({
                  ...prev,
                  durationMins: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        {/* Días de la semana */}
        <div className="mb-3">
          <label className="form-label">Días disponibles</label>
          <div className="d-flex flex-wrap gap-3">
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((dia, idx) => {
              const dayValue = idx + 1; // 1 = lunes ... 7 = domingo
              return (
                <div key={dayValue} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`day-${dayValue}`}
                    checked={formRuta.schedule.daysOfWeek.includes(dayValue)}
                    onChange={() => {
                      setFormRuta((prev) => {
                        const already = prev.schedule.daysOfWeek.includes(dayValue);
                        const days = already
                          ? prev.schedule.daysOfWeek.filter(d => d !== dayValue)
                          : [...prev.schedule.daysOfWeek, dayValue];
                        return { ...prev, schedule: { ...prev.schedule, daysOfWeek: days } };
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor={`day-${dayValue}`}>
                    {dia}
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Layout de bus */}
        <div className="mb-3">
          <label className="form-label">Layout de Bus</label>
          <select
            className="form-select"
            value={formRuta.layout}
            onChange={(e) =>
              setFormRuta((prev) => ({ ...prev, layout: e.target.value }))
            }
          >
            <option value="">Seleccione un layout...</option>
            {layouts.map((layout) => (
              <option key={layout._id} value={layout._id}>
                {layout.name} ({layout.capacidad} asientos)
              </option>
            ))}
          </select>
        </div>

        {/* Paradas */}
        <h6>Paradas</h6>
        <DragDropContext onDragEnd={handleReorderStops}>
          <Droppable droppableId="stops">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {formRuta.stops.map((stop, index) => (
                  <Draggable key={index} draggableId={`stop-${index}`} index={index}>
                    {(provided) => (
                      <div
                        className="border p-2 rounded mb-2 bg-white"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <div className="row g-2">
                          <div className="col-md-4">
                            <label className="form-label">Nombre</label>
                            <input
                              type="text"
                              className="form-control"
                              value={stop.name}
                              onChange={(e) =>
                                handleStopChange(index, "name", e.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Offset (minutos)</label>
                            <input
                              type="number"
                              className="form-control"
                              value={stop.offsetMinutes}
                              onChange={(e) =>
                                handleStopChange(index, "offsetMinutes", e.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Precio</label>
                            <input
                              type="number"
                              className="form-control"
                              value={stop.price}
                              onChange={(e) =>
                                handleStopChange(index, "price", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-2 d-flex justify-content-between">
                          <span className="text-muted">
                            Arrastra para reordenar ↕
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => eliminarParada(index)}
                            disabled={formRuta.stops.length <= 1}
                          >
                            <i className="bi bi-trash" /> Eliminar parada
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Botón para agregar paradas */}
        <button className="btn btn-outline-primary w-100" onClick={agregarParada}>
          + Agregar Parada
        </button>
      </ModalBase>

      <ModalBase
        visible={modalLayoutVisible}
        title={layoutSeleccionado?.name || "Layout de bus"}
        onClose={() => {
          setModalLayoutVisible(false);
          setLayoutSeleccionado(null);
        }}
        footer={
          <button
            className="btn btn-secondary"
            onClick={() => {
              setModalLayoutVisible(false);
              setLayoutSeleccionado(null);
            }}
          >
            Cerrar
          </button>
        }
      >
        {layoutSeleccionado ? (
          <div>
            <p>
              <strong>Capacidad:</strong> {layoutSeleccionado.capacidad} asientos
            </p>
            <p>
              <strong>Pisos:</strong> {layoutSeleccionado.pisos}
            </p>

            <div className="row">
              {/* Piso 1 */}
              {layoutSeleccionado.floor1 && (
                <div className={layoutSeleccionado.floor2 ? "col-md-6" : "col-12"}>
                  <h6 className="text-center">Piso 1</h6>
                  {layoutSeleccionado.tipo_Asiento_piso_1 && (
                    <p className="text-center text-muted small mb-2">
                      Tipo de asiento: {layoutSeleccionado.tipo_Asiento_piso_1}
                    </p>
                  )}
                  <div className="d-inline-block border rounded p-2 bg-light">
                    {layoutSeleccionado.floor1.seatMap.map((row, i) => (
                      <div key={i} className="d-flex justify-content-center">
                        {row.map((seat, j) => (
                          <div
                            key={j}
                            className="border m-1 p-2 text-center"
                            style={{
                              width: 40,
                              height: 40,
                              background: seat ? "#f8f9fa" : "transparent",
                            }}
                          >
                            {seat || ""}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Piso 2 */}
              {layoutSeleccionado.floor2 && (
                <div className={layoutSeleccionado.floor1 ? "col-md-6" : "col-12"}>
                  <h6 className="text-center">Piso 2</h6>
                  {layoutSeleccionado.tipo_Asiento_piso_2 && (
                    <p className="text-center text-muted small mb-2">
                      Tipo de asiento: {layoutSeleccionado.tipo_Asiento_piso_2}
                    </p>
                  )}
                  <div className="d-inline-block border rounded p-2 bg-light">
                    {layoutSeleccionado.floor2.seatMap.map((row, i) => (
                      <div key={i} className="d-flex justify-content-center">
                        {row.map((seat, j) => (
                          <div
                            key={j}
                            className="border m-1 p-2 text-center"
                            style={{
                              width: 40,
                              height: 40,
                              background: seat ? "#f8f9fa" : "transparent",
                            }}
                          >
                            {seat || ""}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p>No hay datos del layout</p>
        )}
      </ModalBase>

    </div>
  );
};

export default Rutas;