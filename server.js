// 1. IMPORTAR MÓDULOS
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// 2. INICIALIZAR LA APLICACIÓN Y PUERTO
const app = express();
const PORT = process.env.PORT || 3000;

// 3. CONFIGURACIÓN DE LA CONEXIÓN A NEON
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 4. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 5. SERVIR LOS ARCHIVOS DEL FRONTEND
const publicDirectoryPath = path.join(__dirname, './public');
app.use(express.static(publicDirectoryPath));

// ================================================================
// RUTAS DE LA API (ENDPOINT)
// ================================================================

// RUTA PARA EL LOGIN DE USUARIOS
app.post('/login', async (req, res) => {
    console.log('Petición recibida en /login');
    const { username, password } = req.body;
    try {
        // ▼▼▼ CAMBIO AQUÍ ▼▼▼
        const query = 'SELECT nombre_usuario, rol FROM public.usuarios WHERE nombre_usuario = $1 AND contraseña = $2';
        const result = await pool.query(query, [username, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ success: true, message: '¡Bienvenido!', username: user.nombre_usuario, role: user.rol });
        } else {
            res.json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error en la consulta de login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// RUTA PARA BUSCAR UN CONTRATO
app.get('/api/contrato/:num_contrato', async (req, res) => {
    const { num_contrato } = req.params;
    console.log(`Buscando contrato en 'permisos_forestales': ${num_contrato}`);
    try {
        // ▼▼▼ CAMBIO AQUÍ ▼▼▼
        const query = 'SELECT numcon, nomtit, resapr, nomobj, ST_AsGeoJSON(geom) as geojson FROM public.permisos_forestales WHERE numcon = $1';
        const result = await pool.query(query, [num_contrato]);

        if (result.rows.length > 0) {
            const data = result.rows[0];
            if (data.geojson) {
                data.geojson = JSON.parse(data.geojson);
            }
            res.json({ success: true, data: data });
        } else {
            res.status(404).json({ success: false, message: 'Contrato no encontrado.' });
        }
    } catch (error) {
        console.error('Error al buscar el contrato:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// RUTA PARA GUARDAR SUPERVISIÓN
app.post('/api/supervision', async (req, res) => {
    const {
        num_contrato, nomtit, resapr, numero_parcela, doc_presentado_ugffs, nro_gtf,
        nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
        link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_ingreso_campo_osinfor,
        n_informe_supervision_osinfor, hallazgos_osinfor
    } = req.body;
    try {
        // ▼▼▼ CAMBIO AQUÍ ▼▼▼ (usando la nueva tabla monitoreo_satel)
        const query = `
            INSERT INTO public.monitoreo_satel (
                num_contrato, nomtit, resapr, numero_parcela, doc_presentado_ugffs, nro_gtf,
                nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
                link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_ingreso_campo_osinfor,
                n_informe_supervision_osinfor, hallazgos_osinfor
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id;
        `;
        const values = [
            num_contrato, nomtit, resapr, numero_parcela, doc_presentado_ugffs, nro_gtf,
            nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
            link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_ingreso_campo_osinfor,
            n_informe_supervision_osinfor, hallazgos_osinfor
        ];
        const result = await pool.query(query, values);
        res.json({ success: true, message: `Registro guardado. Nuevo ID: ${result.rows[0].id}` });
    } catch (error) {
        console.error('Error al guardar la supervisión:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al guardar.' });
    }
});

// 6. INICIAR EL SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});