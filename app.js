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

const MONGODB_URI =
'mongodb+srv://maximilian:Johen2001@cluster0.pyphlw1.mongodb.net/restaurant2?retryWrites=true&w=majority'

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});

const wsServer = http.createServer(); 
const io = new Server(wsServer, {
  cors: {
    origin: 'http://localhost:3000',
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

// ???
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);

app.use('/uploads/images', express.static(path.join('uploads', 'images')))


// zeby nie bylo cors error
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
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
      app.listen(8000);
})
.catch(err => {
    console.log(err)
}) 

wsServer.listen(8001, () => {
  console.log('WebSocket server is running on port 8001');
});