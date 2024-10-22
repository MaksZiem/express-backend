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
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const MONGODB_URI =
'mongodb+srv://maximilian:Johen2001@cluster0.pyphlw1.mongodb.net/restaurant?retryWrites=true&w=majority'

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});



app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);


// zeby nie bylo cors error
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT')
  next()
})

app.use((req, res, next) => {
  User.findById('6585c2a7adafbe2c7251da99')
    .then(user => {
      req.user = user;
      // console.log(req.user)
      next();
    })
    .catch(err => console.log(err));
});




app.use('/api/users', usersRoutes);
app.use('/api/dishes', dishesRoutes)
app.use('/api/ingredients', ingredientsRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/magazine', magazineRoutes)
app.use('/api/waiter', waiterRoutes)
app.use('/api/cook', cookRoutes )

app.use((req, res, next) => {
    const error = new HttpError('Could not find this route', 404)
    throw error;
})




app.use((error, req, res, next) => {
    if (res.headerSent) {
        return next(error)
    }
    res.status(error.code || 500)
    res.json({message: error.message || 'uknown error'})
})

// app.listen(5000)

mongoose
.connect(MONGODB_URI)
.then(()=> {
    User.findOne().then(user => {
        if (!user) {
          const user = new User({
            name: 'Max',
            email: 'max@test.com',
            cart: {
              items: []
            }
          });
          user.save();
        }
      });
      app.listen(8000);
})
.catch(err => {
    console.log(err)
})