const HttpError = require('../models/http-error')
const { validationResult } = require('express-validator')
const Dish = require('../models/dish');
const Order = require('../models/order')
const Ingredient = require('../models/ingredient')
const Table = require('../models/table'); 
const Tip = require('../models/tip')
const mongoose = require('mongoose');

exports.getOrdersByDishId = (req, res, next) => {
    const dishId = req.params.dishId;


    let objectIdDishId;
    try {
        objectIdDishId = new mongoose.Types.ObjectId(dishId);
    } catch (err) {
        const error = new HttpError('Invalid dishId format.', 400);
        return next(error);
    }

    Order.find({ 'dishes.dish._id': objectIdDishId })
        .then(orders => {
            if (!orders || orders.length === 0) {
                const error = new HttpError('No orders found for the provided dishId.', 404);
                return next(error);
            }

        
            const orderCount = orders.length;

            res.status(200).json({ count: orderCount });
        })
        .catch(err => {
            const error = new HttpError('Fetching orders failed, please try again later.', 500);
            return next(error);
        });
};
exports.getDishById = async (req, res, next) => {
    const dishId = req.params.pid;

    let dish;
    try {
        dish = await Dish.findById(dishId)
    } catch (err) {
        const error = new HttpError(
            'something went wrong, could not find a dish', 500
        )
    
        return next(error)
    }


    if (!dish) {
        const error = HttpError('Could not find a dish for the provided id.', 404);
        return next(error)
    }

    res.json({
    
        dish: dish.toObject({ getters: true })
    })
}




exports.getDishesDashboard = (req, res, next) => {
    req.user
      .populate('dishCart.items.dishId')
      .then(user => {
        const cartDishes = user.dishCart.items;
        let finalPrices = 0;
  
    
        let dishesPrices = user.dishCart.items.map(i => {
          return finalPrices = finalPrices + i.dishId.price;
        });
  
        Dish.find()
          .then(async dishes => {
        
            for (let dish of dishes) {
              let isDishAvailable = true;
  
              for (let template of dish.ingredientTemplates) {
                const ingredientName = template.ingredient.name;
                
            
                const requiredWeight = parseFloat(template.weight);
  
            
                if (isNaN(requiredWeight)) {
                  console.error(`Invalid weight for ingredient: ${ingredientName}`);
                  isDishAvailable = false;
                  break;
                }
  
            
                const availableIngredient = await Ingredient.findOne({
                  name: ingredientName,
                  weight: { $gte: requiredWeight }
                }).sort({ expirationDate: 1 });
  
            
                if (!availableIngredient) {
                  isDishAvailable = false;
                  break;
                }
              }
  
            
              dish.isAvailable = isDishAvailable;
              await dish.save();
            }
  
            res.status(200).json({
              dishes: dishes.map(dish => dish.toObject({ getters: true })),
              cartDishes: cartDishes.map(cartDish => cartDish.toObject({ getters: true })),
            });
          })
          .catch(err => {
            console.log(err);
            return res.status(500).json({ message: 'Błąd podczas pobierania dań.' });
          });
      })
      .catch(err => {
        console.log(err);
        return res.status(500).json({ message: 'Błąd podczas pobierania koszyka użytkownika.' });
      });
  };

exports.addDishToCart = (req, res, next) => {
    const dishId = req.body.dishId;
    console.log(dishId)
    Dish.findById(dishId)
        .then(dish => {
            return req.user.addDishToCart(dish);
        })
        .then(result => {
            console.log(result)
            res.status(200).json({message: 'Danie zostało dodane do koszyka'})
        }).catch(err => {
            return res.status(500).json({ message: 'Błąd podczas pobierania koszyka użytkownika.' });
        })
};

exports.createDish = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }

    const { name, price } = req.body;

    const createdDish = new Dish({
        name,
        price
    })

    try {
        await createdDish.save();
    } catch (err) {
        const error = new HttpError(
            'Creating dish failed, please try again.',
            500
        );
        return next(error);
    }

    res.status(201).json({ dish: createdDish });

}

exports.updateDish = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs passed, please check your data.', 422))
    }

    const { name, price } = req.body;
    const dishId = req.params.pid;

    let dish;
    try {
        dish = await Dish.findById(dishId)
    } catch (err) {
        const error = new HttpError(
            'fetching dish failed',
            500
        )
        return next(error)
    }

    dish.name = name
    dish.price = price

    try {
        dish = await dish.save()
    } catch (err) {
        const error = new HttpError(
            'something went wrong, could not update a dish',
            500
        )
        return next(error)
    }

    res.status(200).json({ dish: dish.toObject({ getters: true }) })

}

exports.postDeleteDishFromCart = (req, res, next) => {
    const prodId = req.body.dishId;
    console.log(prodId)
    req.user
        .removeDishFromCart(prodId)
        .then(result => {
            res.status(200).json({message: 'Dane usuniete z koszyka'})
        })
        .catch(err => {
            const error = new HttpError(
                'Creating dish failed, please try again.',
                500
            );
            return next(error);
        });
};

exports.deleteDish = async (req, res, next) => {
    const dishId = req.params.pid;

    let dish;
    try {
        dish = await Dish.findById(dishId)
    } catch (err) {
        const error = new HttpError(
            'something went wrong, could not delete dish', 500
        )
        return next(error)
    }

    try {
        await dish.deleteOne()
    } catch (err) {
        const error = new HttpError(
            'something went wrong, could not delete dish', 500
        )
        return next(error)
    }

    res.status(200).json({ message: 'Deleted dish.' });
}


exports.postCreateOrder = (req, res, next) => {
    req.user
        .populate('dishCart.items.dishId')
        .then(async user => {
            let orderDate = req.body.orderDate;
            let newOrderDate = orderDate;
            
            if (!orderDate) {
                orderDate = new Date();
                const day = orderDate.getDate().toString().padStart(2, '0');
                const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
                const year = orderDate.getFullYear();
                newOrderDate = `${month}.${day}.${year}`;
            }

            const dishes = user.dishCart.items.map(i => {
                return { quantity: i.quantity, dish: { ...i.dishId._doc } };
            });

            let finalPrices = 0;
            user.dishCart.items.forEach(i => {
                finalPrices += i.dishId.price * i.quantity;
            });

            const tableNumber = req.body.tableNumber;
        
            const order = new Order({
                user: {
                    name: req.user.name,
                    userId: req.user
                },
                dishes: dishes,
                price: finalPrices,
                orderDate: newOrderDate,
                addedDate: newOrderDate.toString(),
                tableNumber: tableNumber
            });

        
            await order.save();

        
            const table = await Table.findOne({ number: tableNumber });

            if (table) {
                table.status = 'waiting';
                table.order = order._id;
                await table.save();
            } else {
                return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
            }

        
            for (const item of user.dishCart.items) {
                const dish = item.dishId;
                const requiredQuantity = item.quantity;

            
                for (const ingredientTemplate of dish.ingredientTemplates) {
                    const ingredientName = ingredientTemplate.ingredient.name;
                    let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

                
                    const availableIngredients = await Ingredient.find({ name: ingredientName })
                        .sort({ expirationDate: 1 });

                    for (const storedIngredient of availableIngredients) {
                        if (remainingQuantity <= 0) break;

                        if (storedIngredient.weight >= remainingQuantity) {
                        
                            storedIngredient.weight -= remainingQuantity;
                            await storedIngredient.save();
                            remainingQuantity = 0;
                        } else {
                        
                            remainingQuantity -= storedIngredient.weight;
                            storedIngredient.weight = 0;
                            await storedIngredient.save();
                        }
                    }

                    if (remainingQuantity > 0) {
                    
                        return res.status(400).json({
                            message: `Brakuje składnika: ${ingredientName}`
                        });
                    }
                }
            }

        
            await req.user.clearDishesCart();

        
            res.status(200).json({ 
                message: 'Zamówienie zostało złożone, a składniki zaktualizowane.', 
                order: order 
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas przetwarzania zamówienia.' });
        });
};


exports.getAllTables = async (req, res, next) => {
    try {
      const tables = await Table.find()
        .populate({
          path: 'order',
          populate: {
            path: 'dishes', 
            model: 'Dish' 
          }
        });
  
      res.status(200).json({ tables: tables });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas pobierania stolików.' });
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
    
        res.status(200).json({
            message: "Znaleziono zamówienia w statusie 'waiting'.",
            orders: waitingOrders
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

exports.addTip = async (req, res, next) => {
    const { amount, orderId } = req.body;
    const userId = req.user._id;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Zamówienie nie znalezione.' });
        }

        const tip = new Tip({
            amount,
            order: orderId,
            user: userId
        });

        await tip.save();

        const table = await Table.findOne({ order: orderId });
        if (table) {
            table.status = 'free';
            table.order = null; 
            await table.save();
        } else {
            console.log('Stolik nie znaleziony.');
        }

        res.status(201).json({ message: 'Napiwek został dodany i status stolika zaktualizowany.', tip });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Wystąpił błąd.' });
    }
};

exports.addDishToTableCart = async (req, res, next) => {
    const { tableNumber, dishId, quantity } = req.body;
  
    try {
      // Znalezienie stolika o podanym numerze
      const table = await Table.findOne({ number: tableNumber });
      if (!table) {
        return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
      }
  
      // Sprawdzenie, czy dany dishId już istnieje w koszyku
      const existingDishIndex = table.dishCart.items.findIndex(item => item.dishId.toString() === dishId.toString());
      if (existingDishIndex >= 0) {
        // Jeśli istnieje, aktualizujemy ilość
        table.dishCart.items[existingDishIndex].quantity += quantity;
      } else {
        // Jeśli nie istnieje, dodajemy nowy element do koszyka
        table.dishCart.items.push({ dishId, quantity });
      }
  
      // Zapisanie zmian w bazie danych
      await table.save();
  
      res.status(200).json({ message: 'Danie zostało dodane do koszyka stolika.', dishCart: table.dishCart });
    } catch (err) {
      console.error('Błąd podczas dodawania dania do koszyka stolika:', err);
      res.status(500).json({ message: 'Wystąpił błąd podczas aktualizacji koszyka stolika.' });
    }
  };

  exports.removeDishFromTableCart = async (req, res, next) => {
    const { tableNumber, dishId } = req.body;
  
    try {
      // Znalezienie stolika o podanym numerze
      const table = await Table.findOne({ number: tableNumber });
      if (!table) {
        return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
      }
  
      // Usuwanie dania z koszyka
      table.dishCart.items = table.dishCart.items.filter(item => item.dishId.toString() !== dishId.toString());
  
      // Zapisanie zmian w bazie danych
      await table.save();
  
      res.status(200).json({ message: 'Danie zostało usunięte z koszyka stolika.', dishCart: table.dishCart });
    } catch (err) {
      console.error('Błąd podczas usuwania dania z koszyka stolika:', err);
      res.status(500).json({ message: 'Wystąpił błąd podczas aktualizacji koszyka stolika.' });
    }
  };