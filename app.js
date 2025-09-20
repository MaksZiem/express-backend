// Ładowanie zmiennych środowiskowych na początku
require('dotenv').config();

const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const path = require('path')
const User = require('./models/user');
const HttpError = require('./models/http-error')
const usersRoutes = require('./routes/users-routes');
const dishesRoutes = require('./routes/dishes-routes')
const ingredientsRoutes = require('./routes/ingredients-routes')
const statisticsRoutes = require('./routes/statistics-routes')
const magazineRoutes = require('./routes/magazine-routes')
const waiterRoutes = require('./routes/waiter-routes')
const cookRoutes = require('./routes/cook-routes')
const authRoutes = require('./routes/auth-routes')
const orderStatisticsRoutes = require('./routes/order-statistics-routes')
const dishStatisticsRoutes = require('./routes/dish-statistics-routes')
const ingredientStatisticsRoutes = require('./routes/ingredient-statistics-routes')
const configRoutes = require('./routes/config-routes')
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const fs = require('fs')
const { Server } = require('socket.io'); 
const http = require('http'); 

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 8000;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

if (!MONGODB_URI) {
  console.error('BŁĄD: MONGODB_URI nie jest ustawione w zmiennych środowiskowych');
  process.exit(1);
}

if (!SESSION_SECRET || SESSION_SECRET === 'fallback-secret') {
  console.warn('OSTRZEŻENIE: SESSION_SECRET nie jest ustawiony lub używa wartości domyślnej');
}

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});

const wsServer = http.createServer(); 
const io = new Server(wsServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

app.set('io', io);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/auth');
});

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS tylko w produkcji
      maxAge: 1000 * 60 * 60 * 24 // 24 godziny
    }
  })
);

app.use('/uploads/images', express.static(path.join('uploads', 'images')))

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT')
  next()
})

app.use('/api/users', usersRoutes);
app.use('/api/dishes', dishesRoutes)
app.use('/api/ingredients', ingredientsRoutes)
app.use('/api/magazine', magazineRoutes)
app.use('/api/waiter', waiterRoutes)
app.use('/api/cook', cookRoutes )
app.use('/api/config', configRoutes )
app.use('/api/auth', authRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/statistics/orders', orderStatisticsRoutes)
app.use('/api/statistics/dishes', dishStatisticsRoutes)
app.use('/api/statistics/ingredients', ingredientStatisticsRoutes)

app.use((req, res, next) => {
    const error = new HttpError('Could not find this route', 404)
    throw error;
})

app.use((error, req, res, next) => {
  if (req.file) {
    fs.unlink(req.file.path, err => {
      console.log(err);
    });
  }
  if (res.headerSent) {
    return next(error);
  }
  res.status(error.code || 500);
  res.json({ message: error.message || 'An unknown error occurred!' });
});

io.on('connection', (socket) => {
  console.log('Nowe połączenie WebSocket');

  socket.on('markDishReady', (data) => {
    io.emit('dishReady', data); 
  });

  socket.on('disconnect', () => {
    console.log('Użytkownik rozłączony');
  });
});

mongoose
.connect(MONGODB_URI)
.then(()=> {
      app.listen(PORT, () => {
        console.log(`Server uruchomiony na porcie ${PORT}`);
      });
})
.catch(err => {
    console.log('Błąd połączenia z bazą danych:', err)
}) 

wsServer.listen(WEBSOCKET_PORT, () => {
  console.log(`WebSocket server is running on port ${WEBSOCKET_PORT}`);
});