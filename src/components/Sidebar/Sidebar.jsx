import React from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Route } from "lucide-react";
import { BusFront } from 'lucide-react';
import { Building } from 'lucide-react';
import { Building2 } from 'lucide-react';
import { Factory } from 'lucide-react';
import { ListChecks } from 'lucide-react';
import { Landmark } from 'lucide-react';
import { LayoutGrid, Grid3X3, Boxes } from 'lucide-react';
import { HouseDoor, People, CalendarCheck } from 'react-bootstrap-icons';
import './Sidebar.css';

const Sidebar = ({ activeItem }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');  
    localStorage.removeItem('recordarSession');
    navigate('/');
  };

  return (
    <nav className="sidebar">
      <h2>Admin Boletos</h2>
      <Link to="/dashboard" className={activeItem === 'dashboard' ? 'active' : ''}>
        <HouseDoor className="me-2" /> Dashboard
      </Link>

      <Link to="/usuarios" className={activeItem === 'usuarios' ? 'active' : ''}>
        <People className="me-2" /> Usuarios
      </Link>

      <Link to="/servicios" className={activeItem === 'servicios' ? 'active' : ''}>
        <CalendarCheck className="me-2" /> Servicios
      </Link>

      <Link to="/tipos-servicio" className={activeItem === 'tipos-servicio' ? 'active' : ''}>
        <ListChecks className="me-2" size={18} /> Tipos de Servicio
      </Link>

      <Link to="/rutas" className={activeItem === 'rutas' ? 'active' : ''}>
          <Route className="me-2" /> Rutas
      </Link>

      <Link to="/blocks" className={activeItem === 'blocks' ? 'active' : ''}>
          <LayoutGrid className="me-2" /> Bloques de rutas
      </Link>      
      
      <Link to="/buses" className={activeItem === 'buses' ? 'active' : ''}>
          <BusFront className="me-2" /> Buses
      </Link>

      <Link to="/layouts" className={activeItem === 'layouts' ? 'active' : ''}>
          <Building className="me-2" /> Layouts de Buses
      </Link> 

     <Link to="/ciudades" className={activeItem === 'ciudades' ? 'active' : ''}>
        <Landmark className="me-2" /> Ciudades
      </Link>

      <Link to="/terminales" className={activeItem === 'terminales' ? 'active' : ''}>
          <Building2 className="me-2" /> Terminales
      </Link>

      <Link to="/companias" className={activeItem === 'companias' ? 'active' : ''}>
          <Factory className="me-2" /> Compañias
      </Link>
      

      <a href="#" onClick={handleLogout} className="mt-auto">
        <i className="bi bi-box-arrow-right me-2"></i> Cerrar Sesión
      </a>
    </nav>
  );
};

export default Sidebar;