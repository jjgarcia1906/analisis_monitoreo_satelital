// 1. IMPORTAR MÓDULOS
const express = require('express');
const cors = require('cors');
// const { Pool } = require('pg'); // DESACTIVADO TEMPORALMENTE
const path = require('path'); // Módulo necesario para las rutas de archivos

// 2. INICIALIZAR LA APLICACIÓN Y PUERTO
const app = express();
const PORT = process.env.PORT || 3000;

// 3. CONFIGURACIÓN DE CONEXIONES A POSTGRESQL - DESACTIVADO TEMPORALMENTE
// const poolLogin = new Pool({ ... });
// const poolApp = new Pool({ ... });

// 4. MIDDLEWARE
app.use(cors());
app.use(express.json());

// --- AÑADIDO: SERVIR LOS ARCHIVOS DEL FRONTEND ---
// Esta es la línea clave. Asegúrate de que tu carpeta se llame 'public'.
// Si se llama diferente (ej: 'frontend'), cambia el nombre aquí.
const publicDirectoryPath = path.join(__dirname, './public');
app.use(express.static(publicDirectoryPath));
// --------------------------------------------------

// ----- RUTAS DE LA API - DESACTIVADAS TEMPORALMENTE -----
// Devolvemos mensajes de marcador de posición para que la app no se caiga.

app.post('/login', async (req, res) => {
    res.json({ success: false, message: 'Login temporalmente desactivado.' });
});

app.get('/api/contrato/:num_contrato', async (req, res) => {
    res.status(404).json({ success: false, message: 'Búsqueda temporalmente desactivada.' });
});

app.post('/api/supervision', async (req, res) => {
    res.status(500).json({ success: false, message: 'Guardado temporalmente desactivado.' });
});

// 6. INICIAR EL SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});