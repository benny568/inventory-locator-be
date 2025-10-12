const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Create a connection to the database
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'itemlocations'
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the MySQL database.');
  
  // Create locations table if it doesn't exist
  const createLocationsTable = `
    CREATE TABLE IF NOT EXISTS locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.query(createLocationsTable, (err) => {
    if (err) {
      console.error('Error creating locations table:', err);
    } else {
      console.log('Locations table ready');
      
      // Insert default locations if table is empty
      db.query('SELECT COUNT(*) as count FROM locations', (err, results) => {
        if (err) {
          console.error('Error checking locations count:', err);
        } else if (results[0].count === 0) {
          const defaultLocations = [
            'Shelves 1, top',
            'Shelves 1, shelf 1',
            'Shelves 1, shelf 2',
            'Shelves 1, shelf 3',
            'Shelves 1, floor',
            'Shelves 2, top',
            'Shelves 2, shelf 1',
            'Shelves 2, shelf 2',
            'Shelves 2, shelf 3',
            'Shelves 2, floor',
            'Press 1, top',
            'Press 1, shelf 1',
            'Press 1, shelf 2',
            'Press 1, shelf 3',
            'Press 1, floor',
            'Press 2, top',
            'Press 2, shelf 1',
            'Press 2, shelf 2',
            'Press 2, shelf 3',
            'Press 2, floor',
            'Box drawers inside door'
          ];
          
          const insertPromises = defaultLocations.map(location => {
            return new Promise((resolve, reject) => {
              db.query('INSERT INTO locations (name) VALUES (?)', [location], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });
          
          Promise.all(insertPromises)
            .then(() => console.log('Default locations inserted'))
            .catch(err => console.error('Error inserting default locations:', err));
        }
      });
    }
  });
});

// Middleware to set Access-Control-Allow-Origin header
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware to parse JSON requests
app.use(express.json());

// Define a route to get items
app.get('/api/items', (req, res) => {
  // console.log('In GET handler...');
  const query = 'SELECT * FROM items';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

// Add new item
app.post('/api/items', (req, res) => {
  const { name, location } = req.body;
  const query = 'INSERT INTO items (name, location) VALUES (?, ?)';
  db.query(query, [name, location], (err, result) => {
    if (err) {
      console.error('Error adding item:', err);
      res.status(500).json({ error: 'Failed to add item' });
      return;
    }
    res.json({ id: result.insertId, name, location });
  });
});

// Update item
app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body;
  const query = 'UPDATE items SET name = ?, location = ? WHERE id = ?';
  db.query(query, [name, location, id], (err, result) => {
    if (err) {
      console.error('Error updating item:', err);
      res.status(500).json({ error: 'Failed to update item' });
      return;
    }
    res.json({ id, name, location });
  });
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM items WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting item:', err);
      res.status(500).json({ error: 'Failed to delete item' });
      return;
    }
    res.json({ message: 'Item deleted successfully' });
  });
});

// Get all locations
app.get('/api/locations', (req, res) => {
  const query = 'SELECT * FROM locations ORDER BY name';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching locations:', err);
      res.status(500).json({ error: 'Failed to fetch locations' });
      return;
    }
    res.json(results);
  });
});

// Add new location
app.post('/api/locations', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Location name is required' });
  }
  
  const query = 'INSERT INTO locations (name) VALUES (?)';
  db.query(query, [name.trim()], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'Location already exists' });
      } else {
        console.error('Error adding location:', err);
        res.status(500).json({ error: 'Failed to add location' });
      }
      return;
    }
    res.json({ id: result.insertId, name: name.trim() });
  });
});

// Delete location
app.delete('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  
  // First check if location is in use
  const checkQuery = 'SELECT COUNT(*) as count FROM items WHERE location = (SELECT name FROM locations WHERE id = ?)';
  db.query(checkQuery, [id], (err, results) => {
    if (err) {
      console.error('Error checking location usage:', err);
      res.status(500).json({ error: 'Failed to check location usage' });
      return;
    }
    
    if (results[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete location. It is currently in use by items.' 
      });
    }
    
    // Delete the location
    const deleteQuery = 'DELETE FROM locations WHERE id = ?';
    db.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error('Error deleting location:', err);
        res.status(500).json({ error: 'Failed to delete location' });
        return;
      }
      res.json({ message: 'Location deleted successfully' });
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
