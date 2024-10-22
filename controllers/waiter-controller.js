const HttpError = require('../models/http-error')
const { validationResult } = require('express-validator')
const Dish = require('../models/dish');
const Order = require('../models/order')
const Ingredient = require('../models/ingredient')
const Table = require('../models/table');
const Tip = require('../models/tip')
const mongoose = require('mongoose');

exports.getDishesDashboard = async (req, res, next) => {
    const { tableNumber } = req.params; // Przyjmujemy numer stolika z parametrów requestu

    try {
        // Znajdź stolik na podstawie jego numeru
        const table = await Table.findOne({ number: tableNumber }).populate('dishCart.items.dishId');

        if (!table) {
            return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
        }

        const cartDishes = table.dishCart.items;
        let finalPrices = 0;

        let dishesPrices = cartDishes.map(i => {
            return finalPrices = finalPrices + i.dishId.price;
        });

        const dishes = await Dish.find();

        // Sprawdzamy dostępność każdego dania
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

        // Odpowiedź z daniami i koszykiem stolika
        res.status(200).json({
            dishes: dishes.map(dish => dish.toObject({ getters: true })),
            cartDishes: cartDishes.map(cartDish => cartDish.toObject({ getters: true })),
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Błąd podczas pobierania danych z koszyka stolika.' });
    }
};

exports.postCreateOrder2 = async (req, res, next) => {
    const { tableNumber } = req.body; // Przyjmujemy numer stolika z body
    try {
        // Znajdujemy stolik na podstawie numeru
        const table = await Table.findOne({ number: tableNumber }).populate('dishCart.items.dishId');

        if (!table) {
            return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
        }

        let orderDate = req.body.orderDate;
        let newOrderDate = orderDate;

        if (!orderDate) {
            orderDate = new Date();
            const day = orderDate.getDate().toString().padStart(2, '0');
            const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
            const year = orderDate.getFullYear();
            newOrderDate = `${month}.${day}.${year}`;
        }

        const dishes = table.dishCart.items.map(i => {
            return { quantity: i.quantity, dish: { ...i.dishId._doc } };
        });

        let finalPrices = 0;
        table.dishCart.items.forEach(i => {
            finalPrices += i.dishId.price * i.quantity;
        });

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

        // Zaktualizowanie statusu stolika
        table.status = 'waiting';
        table.order = order._id;
        await table.save();

        // Aktualizacja stanów składników
        for (const item of table.dishCart.items) {
            const dish = item.dishId;
            const requiredQuantity = item.quantity;

            for (const ingredientTemplate of dish.ingredientTemplates) {
                const ingredientName = ingredientTemplate.ingredient.name;
                let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

                const availableIngredients = await Ingredient.find({ name: ingredientName }).sort({ expirationDate: 1 });

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

        // Opróżnienie koszyka stolika
        table.dishCart.items = [];
        await table.save();

        res.status(200).json({
            message: 'Zamówienie zostało złożone, a składniki zaktualizowane.',
            order: order
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Wystąpił błąd podczas przetwarzania zamówienia.' });
    }
};

exports.postCreateOrder = async (req, res, next) => {
    const { tableNumber } = req.body; // Przyjmujemy numer stolika z body
    try {
        // Znajdujemy stolik na podstawie numeru
        const table = await Table.findOne({ number: tableNumber }).populate('dishCart.items.dishId');

        if (!table) {
            return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
        }

        let orderDate = req.body.orderDate;
        let newOrderDate = orderDate;

        if (!orderDate) {
            orderDate = new Date();
            const day = orderDate.getDate().toString().padStart(2, '0');
            const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
            const year = orderDate.getFullYear();
            newOrderDate = `${month}.${day}.${year}`;
        }

        // Tworzenie zamówienia z domyślnym statusem "niegotowy" dla każdego dania
        const dishes = table.dishCart.items.map(i => {
            return { 
                quantity: i.quantity, 
                dish: { ...i.dishId._doc },
                status: 'niegotowy'  // Dodajemy pole "status" dla każdego dania
            };
        });

        let finalPrices = 0;
        table.dishCart.items.forEach(i => {
            finalPrices += i.dishId.price * i.quantity;
        });

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

        // Zaktualizowanie statusu stolika
        table.status = 'waiting';
        table.order = order._id;
        await table.save();

        // Aktualizacja stanów składników
        for (const item of table.dishCart.items) {
            const dish = item.dishId;
            const requiredQuantity = item.quantity;

            for (const ingredientTemplate of dish.ingredientTemplates) {
                const ingredientName = ingredientTemplate.ingredient.name;
                let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

                const availableIngredients = await Ingredient.find({ name: ingredientName }).sort({ expirationDate: 1 });

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

        // Opróżnienie koszyka stolika
        table.dishCart.items = [];
        await table.save();

        res.status(200).json({
            message: 'Zamówienie zostało złożone, a składniki zaktualizowane.',
            order: order
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Wystąpił błąd podczas przetwarzania zamówienia.' });
    }
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
    const { tableNumber, dishId } = req.body;  // Usunięto "quantity" z req.body

    try {
        // Znalezienie stolika o podanym numerze
        const table = await Table.findOne({ number: tableNumber });
        if (!table) {
            return res.status(404).json({ message: 'Stolik o podanym numerze nie istnieje.' });
        }

        // Sprawdzenie, czy dany dishId już istnieje w koszyku
        const existingDishIndex = table.dishCart.items.findIndex(item => item.dishId.toString() === dishId.toString());
        if (existingDishIndex >= 0) {
            // Jeśli istnieje, aktualizujemy ilość, zwiększając o 1
            table.dishCart.items[existingDishIndex].quantity += 1;
        } else {
            // Jeśli nie istnieje, dodajemy nowy element do koszyka z quantity ustawionym na 1
            table.dishCart.items.push({ dishId, quantity: 1 });
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


// GET /api/cook/ready-dishes
exports.getReadyDishes = async (req, res, next) => {
    try {
      // Pobranie wszystkich zamówień
      const orders = await Order.find();
  
      // Filtracja dan na podstawie statusu "gotowy"
      const readyDishes = orders.reduce((acc, order) => {
        const dishesReady = order.dishes
          .filter(dish => dish.status === 'gotowy') // Filtrujemy tylko gotowe dania
          .map(dish => ({
            dishName: dish.dish.name,  // Nazwa dania
            tableNumber: order.tableNumber,  // Numer stolika
            orderId: order._id // Numer zamówienia
          }));
  
        // Dodanie znalezionych dan do akumulatora
        return acc.concat(dishesReady);
      }, []);
  
      // Sprawdzenie, czy są jakieś gotowe dania
      if (readyDishes.length === 0) {
        return res.status(404).json({ message: 'Brak gotowych dań.' });
      }
  
      // Zwracanie gotowych dań
      res.status(200).json({
        message: 'Znaleziono gotowe dania.',
        readyDishes
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas pobierania dań.' });
    }
  };
  
// PATCH /api/cook/:orderId/dish/:dishName/delivered
exports.markDishAsDelivered1 = async (req, res, next) => {
    const { orderId, dishName } = req.params;

    try {
        // Znajdź zamówienie na podstawie ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Znalezienie dania w zamówieniu
        const dish = order.dishes.find(d => d.dish.name === dishName);
        if (!dish) {
            return res.status(404).json({ message: 'Dish not found.' });
        }

        // Zmiana statusu dania na "wydane"
        dish.status = 'wydane';
        await order.save();

        res.status(200).json({ message: 'Dish marked as delivered.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred.' });
    }
};

exports.markDishAsDelivered = async (req, res, next) => {
    const { orderId, dishName } = req.params;

    try {
        // Znajdź zamówienie na podstawie ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Znalezienie dania w zamówieniu
        const dish = order.dishes.find(d => d.dish.name === dishName);
        if (!dish) {
            return res.status(404).json({ message: 'Dish not found.' });
        }

        // Zmiana statusu dania na "wydane"
        dish.status = 'wydane';
        await order.save();

        // Sprawdzenie, czy wszystkie dania w zamówieniu są "wydane"
        const allDishesDelivered = order.dishes.every(d => d.status === 'wydane');
        
        if (allDishesDelivered) {
            // Znajdź stolik powiązany z zamówieniem
            const table = await Table.findOne({ order: orderId });
            if (table) {
                // Zmiana statusu stolika na "delivered"
                table.status = 'delivered';
                await table.save();
            }
        }

        res.status(200).json({ message: 'Dish marked as delivered.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred.' });
    }
};

