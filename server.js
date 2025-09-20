// 1. IMPORTAR MÓDULOS
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');
const shpwrite = require('shp-write');

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

// CONFIGURACIÓN DE SESIONES
app.use(session({
    secret: 'un_secreto_muy_fuerte_y_largo_que_debes_cambiar',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// EL "PORTERO" (MIDDLEWARE DE AUTENTICACIÓN)
const checkAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};

// 5. SERVIR LOS ARCHIVOS PÚBLICOS DEL FRONTEND
const publicDirectoryPath = path.join(__dirname, './public');
app.use(express.static(publicDirectoryPath));

// ================================================================
// RUTAS
// ================================================================

// RUTA PARA EL LOGIN - CREA LA SESIÓN Y DEVUELVE EL ROL
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const query = 'SELECT nombre_usuario, rol FROM public.usuarios WHERE nombre_usuario = $1 AND contraseña = $2';
        const result = await pool.query(query, [username, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            req.session.user = {
                username: user.nombre_usuario,
                role: user.rol
            };
            res.json({ success: true, role: user.rol });
        } else {
            res.json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error en la consulta de login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// RUTA PARA CERRAR SESIÓN
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'No se pudo cerrar la sesión.' });
        }
        res.clearCookie('connect.sid'); 
        res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
    });
});

// RUTA PROTEGIDA PARA SERVIR EL DASHBOARD DE ADMINISTRACIÓN
app.get('/dashboard', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './public/dashboard.html'));
});

// RUTA PROTEGIDA PARA SERVIR EL DASHBOARD DE CONSULTA
app.get('/consulta', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, './public/consulta.html'));
});

// RUTA PARA BUSCAR UN CONTRATO EN AMBAS TABLAS - PROTEGIDA
app.get('/api/contrato/:num_contrato', checkAuth, async (req, res) => {
    const { num_contrato } = req.params;
    console.log(`Buscando contrato en ambas tablas: ${num_contrato}`);

    try {
        // --- BÚSQUEDA EN LA PRIMERA TABLA: permisos_forestales ---
        let queryPermisos = 'SELECT numcon, nomtit, resapr, nomobj, fuente, denomi, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geojson FROM public.permisos_forestales WHERE numcon = $1';
        let result = await pool.query(queryPermisos, [num_contrato]);

        if (result.rows.length > 0) {
            console.log("Contrato encontrado en: permisos_forestales");
            const data = result.rows[0];
            if (data.geojson) { data.geojson = JSON.parse(data.geojson); }
            
            return res.json({ success: true, data: { ...data, tipo_contrato: 'Permiso Forestal' } });
        }

        // --- SI NO SE ENCUENTRA, BÚSQUEDA EN LA SEGUNDA TABLA: concesiones_forestales ---
        console.log("No se encontró en permisos. Buscando en concesiones...");
        let queryConcesiones = 'SELECT "contrato_1", "titular_1", "modalidad", "odp", "superposic", ST_AsGeoJSON(ST_Transform(geom, 4326)) as geojson FROM public.concesiones_forestales WHERE "contrato_1" = $1';
        result = await pool.query(queryConcesiones, [num_contrato]);

        if (result.rows.length > 0) {
            console.log("Contrato encontrado en: concesiones_forestales");
            const data = result.rows[0];
            if (data.geojson) { data.geojson = JSON.parse(data.geojson); }

            const unifiedData = {
                numcon: data.contrato_1,
                nomtit: data.titular_1,
                modalidad_concesion: data.modalidad,
                odp: data.odp,
                superposicion: data.superposic,
                geojson: data.geojson,
                tipo_contrato: 'Concesión Forestal'
            };
            
            return res.json({ success: true, data: unifiedData });
        }

        res.status(404).json({ success: false, message: 'Contrato no encontrado en ninguna de las fuentes de datos.' });

    } catch (error) {
        console.error('Error al buscar el contrato:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// RUTA PARA GUARDAR SUPERVISIÓN - PROTEGIDA
app.post('/api/supervision', checkAuth, async (req, res) => {
    const {
        num_contrato, fecha_monitoreo, nombre_especialista, numero_parcela, doc_presentado_ugffs, nro_gtf,
        nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
        link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_doc_enviado_a_osinfor,
        n_informe_supervision_osinfor, hallazgos_osinfor
    } = req.body;
    try {
        const contratoQuery = 'SELECT nomtit, resapr, fuente FROM public.permisos_forestales WHERE numcon = $1';
        const contratoResult = await pool.query(contratoQuery, [num_contrato]);
        if (contratoResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'El contrato base no fue encontrado.' });
        }
        const { nomtit, resapr, fuente } = contratoResult.rows[0];

        const insertQuery = `
            INSERT INTO public.monitoreo_satel (
                num_contrato, nomtit, resapr, numero_parcela, doc_presentado_ugffs, nro_gtf,
                nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
                link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_doc_enviado_a_osinfor,
                n_informe_supervision_osinfor, hallazgos_osinfor, nombre_especialista, fuente, fecha_monitoreo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING id;
        `;
        const values = [
            num_contrato, nomtit, resapr, numero_parcela, doc_presentado_ugffs, nro_gtf,
            nro_list_troza, fech_tala_lo_th, resultado_analisis, doc_generado, observacion,
            link_reporte, link_gtf_gerforcloud, remitido_osinfor, fecha_doc_enviado_a_osinfor,
            n_informe_supervision_osinfor, hallazgos_osinfor, nombre_especialista, fuente, fecha_monitoreo
        ];
        
        const result = await pool.query(insertQuery, values);
        res.json({ success: true, message: `Registro guardado. Nuevo ID: ${result.rows[0].id}` });
    } catch (error) {
        console.error('Error al guardar la supervisión:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al guardar.' });
    }
});

// RUTA PARA DESCARGAR EL SHAPEFILE DE UN CONTRATO - PROTEGIDA
app.get('/api/download/shapefile/:num_contrato', checkAuth, async (req, res) => {
    const { num_contrato } = req.params;
    try {
        let data;
        let query;
        let result;

        // Búsqueda en permisos_forestales
        query = `
            SELECT numcon, nomtit, resapr, nomobj, fuente, denomi, ST_AsGeoJSON(ST_Transform(geom, 4326)) as geojson 
            FROM public.permisos_forestales WHERE numcon = $1
        `;
        result = await pool.query(query, [num_contrato]);

        if (result.rows.length > 0) {
            data = result.rows[0];
            data.num_contr = data.numcon;
            data.titular = data.nomtit;
            data.resoluc = data.resapr;
            data.modalidad = data.nomobj;
        } else {
            // Búsqueda en concesiones_forestales
            query = `
                SELECT "contrato_1", "titular_1", "modalidad", "odp", "superposic", ST_AsGeoJSON(ST_Transform(geom, 4326)) as geojson 
                FROM public.concesiones_forestales WHERE "contrato_1" = $1
            `;
            result = await pool.query(query, [num_contrato]);

            if (result.rows.length > 0) {
                data = result.rows[0];
                data.num_contr = data.contrato_1;
                data.titular = data.titular_1;
                data.modalidad = data.modalidad;
                data.odp = data.odp;
                data.superposic = data.superposic;
            }
        }
        
        if (!data) {
            return res.status(404).send('Contrato no encontrado.');
        }
        
        if (!data.geojson) {
            return res.status(404).send('Error: El contrato no tiene una geometría para descargar.');
        }

        let geometry = JSON.parse(data.geojson);
        if (geometry.type === 'MultiPolygon' && geometry.coordinates.length === 1) {
            geometry = {
                type: 'Polygon',
                coordinates: geometry.coordinates[0]
            };
        }

        const options = {
            folder: 'poligono',
            types: {
                polygon: data.num_contr.replace(/[^a-zA-Z0-9_-]/g, '_')
            }
        };
        
        const geoJsonData = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: geometry,
                    properties: {
                        num_contr: data.num_contr,
                        titular: data.titular,
                        resoluc: data.resoluc,
                        modalidad: data.modalidad,
                        fuente: data.fuente,
                        denomi: data.denomi,
                        odp: data.odp,
                        superposic: data.superposic
                    }
                }
            ]
        };

        const shapefileBuffer = shpwrite.zip(geoJsonData, options);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${data.num_contr.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
        res.send(shapefileBuffer);
    } catch (error) {
        console.error('--- ERROR DETALLADO AL GENERAR SHAPEFILE ---');
        console.error(error); 
        res.status(500).send('Error interno al generar el archivo.');
    }
});


// 6. INICIAR EL SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});