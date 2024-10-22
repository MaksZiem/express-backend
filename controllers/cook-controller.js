const HttpError = require('../models/http-error')
const { validationResult } = require('express-validator')
const Dish = require('../models/dish');
const Order = require('../models/order')
const Ingredient = require('../models/ingredient')
const Table = require('../models/table'); 
const Tip = require('../models/tip')
const mongoose = require('mongoose');

exports.getWaitingOrders2 = async (req, res, next) => {
    try {
        const tablesWithWaitingOrders = await Table.find({ status: 'waiting' })
            .populate({
                path: 'order',
                populate: {
                    path: 'dishes.dish', 
                    model: 'Dish'
                }
            });
    
       
        if (!tablesWithWaitingOrders || tablesWithWaitingOrders.length === 0) {
            return res.status(404).json({ message: "Nie znaleziono zamówień w statusie 'waiting'." });
        }
    
        
        const waitingOrders = tablesWithWaitingOrders.map(table => table.order).filter(order => order !== null);
    
        res.status(200).json({
            message: "Znaleziono zamówienia w statusie 'waiting'.",
            orders: waitingOrders
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania zamówień." });
    }
};

exports.getWaitingOrders = async (req, res, next) => {
    try {
        const tablesWithWaitingOrders = await Table.find({ status: 'waiting' })
            .populate({
                path: 'order',
                populate: {
                    path: 'dishes.dish', 
                    model: 'Dish'
                }
            });
    
        if (!tablesWithWaitingOrders || tablesWithWaitingOrders.length === 0) {
            return res.status(404).json({ message: "Nie znaleziono zamówień w statusie 'waiting'." });
        }

        const waitingOrders = tablesWithWaitingOrders.map(table => table.order).filter(order => order !== null);
    
        // Wyświetlamy zamówienia ze statusem każdego dania
        const ordersWithDishStatus = waitingOrders.map(order => ({
            orderId: order._id,
            tableNumber: order.tableNumber,
            dishes: order.dishes.map(dishItem => ({
                dishName: dishItem.dish.name,
                quantity: dishItem.quantity,
                status: dishItem.status // Status dania
            })),
            price: order.price,
            orderDate: order.orderDate
        }));

        res.status(200).json({
            message: "Znaleziono zamówienia w statusie 'waiting'.",
            orders: ordersWithDishStatus
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania zamówień." });
    }
};


  exports.markOrderAsDelivered = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        console.log('wykonane')
        const table = await Table.findOne({ order: orderId });
        if (table) {
            console.log(table.number)
            table.status = 'delivered';
            await table.save();
        }

        await order.save();

        res.status(200).json({ message: 'Order marked as delivered.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'An error occurred.' });
    }
};

// PATCH /api/cook/:orderId/dish/:dishName/ready
// PATCH /api/cook/:orderId/dish/:dishName/ready
exports.markDishAsReady = async (req, res, next) => {
    const { orderId, dishName } = req.params;
  
    try {
      // Znalezienie zamówienia na podstawie ID
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
      }
  
      // Znalezienie dania w zamówieniu, porównując nazwę
      const dish = order.dishes.find(d => d.dish.name === dishName); // Używamy dish.name z modelu Dish
      if (!dish) {
        return res.status(404).json({ message: 'Dish not found.' });
      }
  
      // Zmiana statusu dania na "gotowy"
      dish.status = 'gotowy';
      await order.save();
  
      res.status(200).json({ message: 'Dish marked as ready.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'An error occurred.' });
    }
  };
  
  
