<?php
// Encabezado para indicar que la respuesta es en formato JSON
header('Content-Type: application/json');

// --- 1. CONFIGURACIÓN DE LA CONEXIÓN A POSTGRESQL ---
$host = 'localhost';
$port = '5432';
$dbname = 'permisos_forestales'; // El nombre de tu base de datos
$user = 'postgres'; // Tu usuario de postgres
$password = 'tu_contraseña'; // Tu contraseña de postgres

// --- 2. OBTENER EL NÚMERO DE CONTRATO (DE FORMA SEGURA) ---
// Usamos $_GET para recibir el número que envía el JavaScript
$numcon = isset($_GET['numcon']) ? $_GET['numcon'] : '';

if (empty($numcon)) {
    echo json_encode(['error' => 'Número de contrato no proporcionado']);
    exit;
}

// --- 3. CONECTAR Y REALIZAR LA CONSULTA A POSTGIS ---
try {
    // Cadena de conexión
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    // Conectar a la base de datos
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // La consulta SQL con la función clave ST_AsGeoJSON
    // ¡¡IMPORTANTE!! Cambia 'tu_tabla_de_poligonos', 'geom' y 'numcon' por los nombres reales de tu tabla y columnas
    $sql = "SELECT 
                numcon, 
                otro_campo_interesante, -- puedes añadir otros campos que quieras devolver
                ST_AsGeoJSON(geom) AS geojson -- 'geom' es el nombre de tu columna de geometría
            FROM 
                tu_tabla_de_poligonos 
            WHERE 
                numcon = :numcon";

    // Preparar la consulta para evitar inyección SQL
    $stmt = $pdo->prepare($sql);
    // Asignar el valor del número de contrato al parámetro de la consulta
    $stmt->execute([':numcon' => $numcon]);

    // Obtener el resultado
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        // Si se encontró, decodificamos el string geojson para que sea un objeto JSON válido
        $result['geojson'] = json_decode($result['geojson']);
        echo json_encode($result);
    } else {
        // Si no se encontró ningún polígono con ese contrato
        echo json_encode(['error' => 'Contrato no encontrado']);
    }

} catch (PDOException $e) {
    // Manejo de errores de conexión o consulta
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
}
?>