const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth')
const statisticsController = require('../controllers/statistics-controller')

router.get('/all-cooks-stats', statisticsController.getDishesCountWithTopCook)

router.get('/waiters', statisticsController.getWaiters)

router.use(checkAuth)

router.get('/cooks', statisticsController.getCooks)

module.exports = router;