
import React, { useEffect, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import ModalBase from '@components/ModalBase/ModalBase';
import { showToast } from '@components/Toast/Toast';

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const usuariosPorPagina = 10;
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);
  const [actualizando, setActualizando] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'admin',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardarUsuario = async () => {
    if (!modoEdicion && formData.password.length < 8) {
      showToast('Error', 'La contraseña debe tener al menos 8 caracteres.', true);
      return;
    }

    const token = sessionStorage.getItem("token") || JSON.parse(localStorage.getItem("recordarSession") || '{}').token;

    try {
      const url = modoEdicion
        ? `https://boletos.dev-wit.com/api/users/${usuarioEditandoId}`
        : 'https://boletos.dev-wit.com/api/users/register';

      const method = modoEdicion ? 'PUT' : 'POST';
      const bodyData = { ...formData };
      if (modoEdicion) delete bodyData.password; // No se actualiza contraseña

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) throw new Error(`Error al ${modoEdicion ? 'editar' : 'registrar'} el usuario.`);

      showToast('Éxito', `Usuario ${modoEdicion ? 'editado' : 'registrado'} correctamente.`);
      setModalVisible(false);
      setModoEdicion(false);
      setUsuarioEditandoId(null);
      setFormData({ name: '', email: '', role: 'admin', password: '' });
      fetchUsuarios();
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'Error al guardar usuario.', true);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      let token = sessionStorage.getItem("token");

      if (!token) {
        const recordarSession = localStorage.getItem("recordarSession");
        if (recordarSession) {
          try {
            const parsed = JSON.parse(recordarSession);
            token = parsed.token;
          } catch (e) {
            console.error("Error al parsear recordarSession:", e);
          }
        }
      }

      const res = await fetch("https://boletos.dev-wit.com/api/users/", {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error("Error al obtener usuarios. Código: " + res.status);
      }

      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      setUsuarios([]);
    }
  };

  const [filtro, setFiltro] = useState('');

  const usuariosFiltrados = usuarios.filter((u) =>
    [u.name, u.email, u.role].some((campo) =>
      campo.toLowerCase().includes(filtro.toLowerCase())
    )
  );

  const usuariosAMostrar = usuariosFiltrados.slice(
    (paginaActual - 1) * usuariosPorPagina,
    paginaActual * usuariosPorPagina
  );

  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);

  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
    }
  };

  const formatearFecha = (fechaISO) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleEditarUsuario = (usuario) => {
    setModoEdicion(true);
    setUsuarioEditandoId(usuario._id);
    setFormData({
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
      password: '', // no se muestra
    });
    setModalVisible(true);
  };

  const handleEliminarUsuario = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;

    const token = sessionStorage.getItem("token") || JSON.parse(localStorage.getItem("recordarSession") || '{}').token;

    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("No se pudo eliminar el usuario.");

      showToast('Éxito', 'Usuario eliminado correctamente.');
      fetchUsuarios();
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'Error al eliminar usuario.', true);
    }
  };

  return (
    <>
      <div className="dashboard-container">
        <Sidebar activeItem="usuarios" />
        <main className="main-content">
          <div className="header">
            <h1>Gestión de Usuarios</h1>
            <p className="text-muted">Aquí puedes ver y gestionar todos los usuarios registrados en el sistema.</p>
          </div>

          <div className="stats-box">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="mb-0">Lista de Usuarios</h4>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={actualizando}
                  onClick={async () => {
                    setActualizando(true);
                    try {
                      let token = sessionStorage.getItem("token");
                      if (!token) {
                        const recordarSession = localStorage.getItem("recordarSession");
                        if (recordarSession) {
                          try {
                            const parsed = JSON.parse(recordarSession);
                            token = parsed.token;
                          } catch (e) {
                            console.error("Error al parsear recordarSession:", e);
                          }
                        }
                      }

                      const res = await fetch("https://boletos.dev-wit.com/api/users/", {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });

                      if (!res.ok) throw new Error("No se pudo actualizar la lista de usuarios.");

                      const data = await res.json();

                      setUsuarios((prevUsuarios) => {
                        const nuevos = [];

                        data.forEach((nuevo) => {
                          const antiguo = prevUsuarios.find(u => u._id === nuevo._id);
                          const haCambiado =
                            !antiguo ||
                            antiguo.name !== nuevo.name ||
                            antiguo.email !== nuevo.email ||
                            antiguo.role !== nuevo.role;

                          nuevos.push(haCambiado || !antiguo ? nuevo : antiguo);
                        });

                        // Eliminar usuarios que ya no existen
                        return nuevos;
                      });

                      showToast("Actualizado", "Lista de usuarios sincronizada correctamente.");
                    } catch (err) {
                      console.error(err);
                      showToast("Error", err.message || "No se pudo actualizar la lista de usuarios.", true);
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
                  onClick={() => setModalVisible(true)}
                >
                  <i className="bi bi-person-plus me-2"></i> Nuevo Usuario
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar usuario por nombre, email o rol..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Fecha de Registro</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosAMostrar.map((usuario) => (
                    <tr key={usuario._id}>
                      <td>{usuario.name}</td>
                      <td>{usuario.email}</td>
                      <td>{usuario.role}</td>
                      <td>{formatearFecha(usuario.createdAt)}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary me-2"
                          onClick={() => handleEditarUsuario(usuario)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleEliminarUsuario(usuario._id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3">
              <p>Mostrando {usuariosAMostrar.length} de {usuariosFiltrados.length} usuarios</p>
              <span>Página {paginaActual} de {totalPaginas}</span>
              <div>
                <button
                  className="btn btn-outline-primary btn-sm me-2"
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                >
                  Anterior
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ModalBase
        visible={modalVisible}
        title="Crear Nuevo Usuario"
        onClose={() => setModalVisible(false)}
        size="lg"
        footer={
          <div className="d-flex justify-content-end gap-2 px-2">
            <button className="btn btn-outline-secondary" onClick={() => {
              setModalVisible(false);
              setModoEdicion(false);
              setUsuarioEditandoId(null);
              setFormData({ name: '', email: '', role: 'admin', password: '' });}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleGuardarUsuario}>Guardar</button>
          </div>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nombre</label>
              <input type="text" name="name" className="form-control" placeholder="Nombre completo" value={formData.name} onChange={handleInputChange} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-control" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleInputChange} />
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">Rol</label>
            <select name="role" className="form-select" value={formData.role} onChange={handleInputChange}>
              <option value="admin">Admin</option>
              <option value="chofer">Chofer</option>
              <option value="caja">Caja</option>
            </select>
          </div>
          <div className="mt-4">
            <label className="form-label">Contraseña</label>
            <input type="password" name="password" className="form-control" placeholder="Mínimo 8 caracteres" value={formData.password} onChange={handleInputChange} />
          </div>
        </form>
      </ModalBase>
    </>
  );
};

export default Usuarios;
