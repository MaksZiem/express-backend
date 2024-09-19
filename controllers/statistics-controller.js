const Order = require('../models/order'); 
const Dish = require('../models/dish');   
const User = require('../models/user')
const Ingredient = require('../models/ingredient')
const IngredientTemplate = require('../models/ingredientTemplate')
const mongoose = require('mongoose');
const HttpError = require('../models/http-error')
const Tip = require('../models/tip')

exports.getDishPercentage = (req, res, next) => {
    Order.find()
        .then(orders => {
            const dishCount = {};  
            let totalDishes = 0;   

            orders.forEach(order => {
                order.dishes.forEach(dishItem => {
                    const dishName = dishItem.dish.name;
                    const quantity = dishItem.quantity;

                    if (!dishCount[dishName]) {
                        dishCount[dishName] = 0;
                    }
                    dishCount[dishName] += quantity;
                    totalDishes += quantity;  
                });
            });

            const dishPercentage = {};
            for (const dishName in dishCount) {
                dishPercentage[dishName] = parseInt( ((dishCount[dishName] / totalDishes) * 100).toFixed(2))
            }

            res.status(200).json( {dishPercentage: dishPercentage});
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: "Wystąpił błąd." });
        });
};

exports.getTodayOrdersCount = (req, res, next) => {
    const today = new Date();

    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${month}.${day}.${year}`;

    Order.find({ orderDate: todayFormatted })
        .then(orders => {
            const orderCount = orders.length;

            res.status(200).json({
                date: todayFormatted,
                orderCount: orderCount
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: "Wystąpił błąd." });
        });
};

exports.getTodayOrdersAndRevenue = (req, res, next) => {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${month}.${day}.${year}`;

    Order.find({ orderDate: todayFormatted })
        .then(orders => {
            const orderCount = orders.length; 
            const totalRevenue = orders.reduce((sum, order) => sum + order.price, 0); 

            res.status(200).json({
                date: todayFormatted,
                orderCount: orderCount,
                totalRevenue: totalRevenue.toFixed(2) 
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: "Wystąpił błąd." });
        });
};

exports.getUserOrders = (req, res, next) => {
    const userId = req.user._id;  

    Order.find({ 'user.userId': userId })
        .then(orders => {
            if (!orders) {
                return res.status(404).json({ message: 'Nie znaleziono zamówień dla tego użytkownika.' });
            }

            const ordersCount = orders.length; 

            res.status(200).json({
                message: 'Znaleziono zamówienia.',
                ordersCount: ordersCount,
                orders: orders
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas pobierania zamówień.' });
        });
};


exports.getUsersByOrderCount = (req, res, next) => {
    Order.aggregate([
        {
            $group: {
                _id: "$user.userId",        
                totalOrders: { $sum: 1 }    
            }
        },
        {
            $sort: { totalOrders: -1 }    
        }
    ])
    .then(results => {
        if (results.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono żadnych zamówień.' });
        }

        const userIds = results.map(result => result._id);

        User.find({ _id: { $in: userIds } })
            .then(users => {
                const usersWithOrderCounts = results.map(result => {
                    const user = users.find(u => u._id.toString() === result._id.toString());
                    return {
                        name: user ? user.name : 'Nieznany użytkownik',
                        totalOrders: result.totalOrders
                    };
                });

                res.status(200).json({
                    message: 'Lista użytkowników z liczbą zamówień.',
                    users: usersWithOrderCounts
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({ message: 'Wystąpił błąd podczas pobierania użytkowników.' });
            });
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({ message: 'Wystąpił błąd podczas obliczania zamówień.' });
    });
};

exports.getDishIngredientCost = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;  
        const dish = await Dish.findById(dishId);  

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        const ingredientTemplates = dish.ingredientTemplates; 
        let totalIngredientCost = 0; 

        for (const template of ingredientTemplates) {
            const ingredientName = template.ingredient.name;
            const weightInDish = parseFloat(template.weight);  

            const ingredients = await Ingredient.find({ name: ingredientName });

            if (ingredients.length === 0) {
                return res.status(404).json({ message: `Nie znaleziono składnika o nazwie ${ingredientName}.` });
            }

            const totalPrice = ingredients.reduce((sum, ing) => sum + ing.price, 0);
            const averagePrice = totalPrice / ingredients.length;

            const ingredientCostForDish = averagePrice * (weightInDish / 100);  

            totalIngredientCost += ingredientCostForDish;
        }

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,  
            totalIngredientCost: totalIngredientCost.toFixed(2), 
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztu składników.' });
    }
};

exports.getMostPopularDishesToday = (req, res, next) => {
    const today = new Date();

    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${month}.${day}.${year}`;

    Order.find({ orderDate: todayFormatted })
        .sort({ createdAt: -1 }) 
        .limit(7) 
        .then(orders => {
            if (orders.length === 0) {
                return res.status(404).json({ message: 'Brak zamówień z dzisiaj.' });
            }

           
            const dishStats = {};
            orders.forEach(order => {
                order.dishes.forEach(dishItem => {
                    const dishName = dishItem.dish.name;
                    const dishPrice = dishItem.dish.price;
                    const quantity = dishItem.quantity;

                    
                    if (!dishStats[dishName]) {
                        dishStats[dishName] = { count: 0, revenue: 0 };
                    }

                   
                    dishStats[dishName].count += quantity;

                    
                    dishStats[dishName].revenue += dishPrice * quantity;
                });
            });

           
            const sortedDishes = Object.entries(dishStats)
                .sort(([, statsA], [, statsB]) => statsB.count - statsA.count) 
                .slice(0, 7) 
                .map(([name, stats]) => ({
                    name,
                    count: stats.count,
                    revenue: stats.revenue.toFixed(2) 
                }));

            let mostPopularDish = null;
            let maxCount = 0;
            let maxRevenue = 0;

            if (sortedDishes.length > 0) {
                mostPopularDish = sortedDishes[0].name;
                maxCount = sortedDishes[0].count;
                maxRevenue = sortedDishes[0].revenue;
            }

            res.status(200).json({
                message: 'Lista 7 najpopularniejszych dań z dzisiaj.',
                mostPopularDish: mostPopularDish,
                mostPopularDishCount: maxCount,
                mostPopularDishRevenue: maxRevenue, 
                topDishes: sortedDishes
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych.' });
        });
};


exports.getMostPopularDishesToday2 = (req, res, next) => {
    const today = new Date();

    
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${month}.${day}.${year}`;

    Order.find({ orderDate: todayFormatted })
        .sort({ createdAt: -1 }) 
        .limit(7) 
        .then(orders => {
            if (orders.length === 0) {
                return res.status(404).json({ message: 'Brak zamówień z dzisiaj.' });
            }

            
            const dishCount = {};
            orders.forEach(order => {
                order.dishes.forEach(dishItem => {
                    const dishName = dishItem.dish.name;

                    if (!dishCount[dishName]) {
                        dishCount[dishName] = 0;
                    }
                    dishCount[dishName] += dishItem.quantity;
                });
            });

            const sortedDishes = Object.entries(dishCount)
                .sort(([, countA], [, countB]) => countB - countA) 
                .slice(0, 7)
                .map(([name, count]) => ({ name, count }));

            let mostPopularDish = null;
            let maxCount = 0;

            if (sortedDishes.length > 0) {
                mostPopularDish = sortedDishes[0].name;
                maxCount = sortedDishes[0].count;
            }

            res.status(200).json({
                message: 'Lista 7 najpopularniejszych dań z dzisiaj.',
                mostPopularDish: mostPopularDish,
                mostPopularDishCount: maxCount,
                topDishes: sortedDishes
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych.' });
        });
};

exports.calculateIngredientEndDate = async (req, res, next) => {
    try {
        const ingredientId = req.params.ingredientId;  
        const ingredient = await Ingredient.findById(ingredientId);  

        if (!ingredient) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        console.log(`Składnik: ${ingredient.name}, Aktualna ilość: ${ingredient.weight}`);

        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        const last30DaysOrders = await Order.find({
            orderDate: {
                $gte: thirtyDaysAgo.toISOString().split('T')[0],
                $lt: today.toISOString().split('T')[0]
            }
        });

        console.log(`Znalezione zamówienia: ${last30DaysOrders.length}`);

        if (last30DaysOrders.length === 0) {
            console.log('Brak zamówień w poprzednich 30 dniach.');
            return res.status(404).json({ message: 'Brak zamówień z ostatnich 30 dni.' });
        }

        let totalUsage = 0;  

        last30DaysOrders.forEach(order => {
            console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish; 

                if (!dish || !dish.ingredientTemplates) {
                    console.log(`Brak składników w daniu ${dish ? dish.name : 'Nieznane danie'}`);
                    return;
                }
                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredient.name) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie: ${ingTemplate.weight}`);
                        totalUsage += parseFloat(ingTemplate.weight); 
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredient.name} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;
        console.log(`Średnie dzienne zużycie składnika ${ingredient.name}: ${averageDailyUsage.toFixed(2)} na dzień`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończone'
            });
        }

        const daysUntilOutOfStock = ingredient.weight / averageDailyUsage;

        console.log(`Składnik ${ingredient.name} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        const estimatedOutOfStockDate = new Date(today);
        estimatedOutOfStockDate.setDate(today.getDate() + daysUntilOutOfStock);

        console.log(`Składnik ${ingredient.name} może się skończyć około: ${estimatedOutOfStockDate.toDateString()}`);

        const sameNameIngredients = await Ingredient.find({ name: ingredient.name });
        const maxExpirationDate = sameNameIngredients.reduce((latest, current) => {
            const currentExpiration = new Date(current.expirationDate);
            return currentExpiration > latest ? currentExpiration : latest;
        }, new Date(0));  

        console.log(`Najpóźniejsza data ważności składnika ${ingredient.name}: ${maxExpirationDate.toDateString()}`);

        const outOfStockDate = estimatedOutOfStockDate > maxExpirationDate ? maxExpirationDate : estimatedOutOfStockDate;

        console.log(`Ostateczna data wyczerpania składnika ${ingredient.name}: ${outOfStockDate.toDateString()}`);

        return res.status(200).json({
            ingredientName: ingredient.name,
            currentWeight: ingredient.weight,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            estimatedOutOfStockDate: estimatedOutOfStockDate.toDateString(),
            outOfStockDate: outOfStockDate.toDateString()  
        });

    } catch (err) {
        console.log('Błąd podczas obliczania:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};

exports.calculateDishesAvailable = async (req, res, next) => {
    try {
        const dishId = req.params.dishId; 

        const dish = await Dish.findById(dishId);

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, ID: ${dishId}`);

        let minDishesPossible = Infinity;  

        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name; 
            const ingredientNeededWeight = parseFloat(ingTemplate.weight);  

            console.log(`Składnik: ${ingredientName}, Potrzebna waga na jedno danie: ${ingredientNeededWeight}`);

            const availableIngredients = await Ingredient.find({
                name: ingredientName,
            }).sort({ expirationDate: 1 });

            if (availableIngredients.length === 0) {
                console.log(`Brak składnika ${ingredientName} w magazynie.`);
                return res.status(200).json({
                    dishName: dish.name,
                    message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`
                });
            }

            let totalAvailableWeight = 0;

            availableIngredients.forEach(ingredient => {
                totalAvailableWeight += ingredient.weight;
            });

            console.log(`Całkowita dostępna ilość składnika ${ingredientName}: ${totalAvailableWeight}`);

            const possibleDishesWithThisIngredient = Math.floor(totalAvailableWeight / ingredientNeededWeight);

            console.log(`Możliwe do przygotowania dania na podstawie składnika ${ingredientName}: ${possibleDishesWithThisIngredient}`);

            if (possibleDishesWithThisIngredient < minDishesPossible) {
                minDishesPossible = possibleDishesWithThisIngredient;
            }
        }

        console.log(`Maksymalna liczba możliwych do wykonania dań: ${minDishesPossible}`);

        return res.status(200).json({
            dishName: dish.name,
            maxDishesPossible: minDishesPossible
        });

    } catch (err) {
        console.log('Błąd podczas obliczania:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};

exports.calculateIngredientWasteProbability = async (req, res, next) => {
    try {
        const ingredientId = req.params.ingredientId; 
        const ingredient = await Ingredient.findById(ingredientId);  

        if (!ingredient) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        let expirationDate = null;

        
        if (ingredient.expirationDate) {
            expirationDate = new Date(ingredient.expirationDate);
        }

        console.log(`Składnik: ${ingredient.name}, Aktualna ilość: ${ingredient.weight}`);
        
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        
        const convertStringToDate = (dateString) => {
            const [month, day, year] = dateString.split('.').map(Number);  
            return new Date(year, month - 1, day);  
        };

        
        const last30DaysOrders = await Order.find({
            orderDate: {
                $exists: true,  
            }
        });

        
        const filteredOrders = last30DaysOrders.filter(order => {
            const orderDate = convertStringToDate(order.orderDate);  
            return orderDate >= thirtyDaysAgo && orderDate < today;  
        });

        console.log(`Znalezione zamówienia: ${filteredOrders.length}`);

        if (filteredOrders.length === 0) {
            return res.status(404).json({ message: 'Brak zamówień z ostatnich 30 dni.' });
        }

        let totalUsage = 0;  

        
        filteredOrders.forEach(order => {
            console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;  

                
                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredient.name) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`);
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity; 
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredient.name} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;

        console.log(`Średnie dzienne zużycie składnika ${ingredient.name}: ${averageDailyUsage.toFixed(2)}`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A'
            });
        }

        const daysUntilOutOfStock = ingredient.weight / averageDailyUsage;

        console.log(`Składnik ${ingredient.name} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
            console.log(`Days Until Expiration: ${daysUntilExpiration}`);
        } else {
            console.log(`Brak daty wygaśnięcia dla składnika ${ingredient.name}`);
        }

        let wasteProbability = 0;
        if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const totalIngredientValue = ingredient.price * ingredient.weight;
        const wastedValue = (wasteProbability / 100) * totalIngredientValue;

        return res.status(200).json({
            ingredientName: ingredient.name,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration !== null ? daysUntilExpiration.toFixed(2) : 'Brak daty wygaśnięcia',
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};


exports.calculateIngredientWasteProbability3 = async (req, res, next) => {
    try {
        const ingredientId = req.params.ingredientId;  
        const ingredient = await Ingredient.findById(ingredientId);  

        if (!ingredient) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        let expirationDate = null;

        
        if (ingredient.expirationDate) {
            expirationDate = new Date(ingredient.expirationDate);
        }

        console.log(`Składnik: ${ingredient.name}, Aktualna ilość: ${ingredient.weight}`);
        
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        
        const last30DaysOrders = await Order.find({
            orderDate: {
                $gte: thirtyDaysAgo.toISOString().split('T')[0],
                $lt: today.toISOString().split('T')[0]
            }
        });

        console.log(`Znalezione zamówienia: ${last30DaysOrders.length}`);

        if (last30DaysOrders.length === 0) {
            return res.status(404).json({ message: 'Brak zamówień z ostatnich 30 dni.' });
        }

        let totalUsage = 0;  

        
        last30DaysOrders.forEach(order => {
            console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;  

                
                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredient.name) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`);
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity; 
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredient.name} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;

        console.log(`Średnie dzienne zużycie składnika ${ingredient.name}: ${averageDailyUsage.toFixed(2)}`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A'
            });
        }

        const daysUntilOutOfStock = ingredient.weight / averageDailyUsage;

        console.log(`Składnik ${ingredient.name} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
            console.log(`Days Until Expiration: ${daysUntilExpiration}`);
        } else {
            console.log(`Brak daty wygaśnięcia dla składnika ${ingredient.name}`);
        }

        let wasteProbability = 0;
        if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const totalIngredientValue = ingredient.price * ingredient.weight;
        const wastedValue = (wasteProbability / 100) * totalIngredientValue;

        return res.status(200).json({
            ingredientName: ingredient.name,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration !== null ? daysUntilExpiration.toFixed(2) : 'Brak daty wygaśnięcia',
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};




exports.calculateIngredientWasteProbability2 = async (req, res, next) => {
    try {
        const ingredientId = req.params.ingredientId;  
        const ingredient = await Ingredient.findById(ingredientId);  

        if (!ingredient) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        const expirationDate = new Date(ingredient.expirationDate);

        console.log(`Składnik: ${ingredient.name}, Aktualna ilość: ${ingredient.weight}`);
        
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        
        const last30DaysOrders = await Order.find({
            orderDate: {
                $gte: thirtyDaysAgo.toISOString().split('T')[0], 
                $lt: today.toISOString().split('T')[0]
            }
        });

        console.log(`Znalezione zamówienia: ${last30DaysOrders.length}`);

        if (last30DaysOrders.length === 0) {
            return res.status(404).json({ message: 'Brak zamówień z ostatnich 30 dni.' });
        }

        let totalUsage = 0;  

        
        last30DaysOrders.forEach(order => {
            console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates) return;

                
                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredient.name) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`);
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity; 
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredient.name} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;

        console.log(`Średnie dzienne zużycie składnika ${ingredient.name}: ${averageDailyUsage.toFixed(2)}`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A'
            });
        }

        const daysUntilOutOfStock = ingredient.weight / averageDailyUsage;

        console.log(`Składnik ${ingredient.name} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));

        console.log(`Days Until Expiration: ${daysUntilExpiration}`);

        let wasteProbability = 0;
        if (daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const totalIngredientValue = ingredient.price * ingredient.weight;
        const wastedValue = (wasteProbability / 100) * totalIngredientValue;

        return res.status(200).json({
            ingredientName: ingredient.name,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration.toFixed(2),
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};


exports.calculateAverageIngredientPrices = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;

        
        let objectIdDishId;
        try {
            objectIdDishId = new mongoose.Types.ObjectId(dishId);
        } catch (err) {
            const error = new HttpError('Invalid dishId format.', 400);
            return next(error);
        }

        
        const dish = await Dish.findById(objectIdDishId);

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, Cena dania: ${dish.price}`);

        const ingredientCosts = {};
        let totalIngredientCost = 0;

        
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);

            console.log(`Składnik: ${ingredientName}, Waga w daniu: ${ingredientWeightInDish}g`);

            const matchingIngredients = await Ingredient.find({ name: ingredientName });

            if (matchingIngredients.length === 0) {
                console.log(`Nie znaleziono składników o nazwie: ${ingredientName}`);
                ingredientCosts[ingredientName] = 'Brak danych';
                continue;
            }

            let totalCost = 0;
            let totalWeight = 0;

            matchingIngredients.forEach(ingredient => {
                totalCost += ingredient.price;
                totalWeight += ingredient.weight;
            });

            const averagePricePerGram = totalCost / totalWeight;
            const ingredientCostInDish = averagePricePerGram * ingredientWeightInDish;

            ingredientCosts[ingredientName] = {
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / dish.price) * 100).toFixed(2)
            };

            totalIngredientCost += ingredientCostInDish;
        }

        const profitMargin = ((dish.price - totalIngredientCost) / dish.price) * 100;

        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); 

        const formatDate = date => {
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const year = date.getFullYear();
            return `${month}.${day}.${year}`;
        };

        console.log(`Pobieranie zamówień z okresu: ${formatDate(sevenDaysAgo)} - ${formatDate(today)} (włącznie)`);

        const recentOrders = await Order.find({
            orderDate: {
                $gte: formatDate(sevenDaysAgo),
                $lte: formatDate(today)
            }
        });

        let dishQuantity = 0;
        const dailyRevenue = Array(7).fill(0); 

        recentOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24)); 

            if (daysAgo >= 0 && daysAgo < 7) { 
                order.dishes.forEach(dishItem => {
                    if (dishItem.dish._id.equals(objectIdDishId)) {
                        const revenueForDish = dishItem.quantity * dish.price * (profitMargin / 100);
                        dailyRevenue[6 - daysAgo] += revenueForDish; 
                        dishQuantity += dishItem.quantity;
                    }
                });
            }
        });

        const totalRevenueLastWeek = dailyRevenue.reduce((acc, val) => acc + val, 0); 

        console.log('Ile razy to danie wystąpiło w zamówieniach w ostatnim tygodniu (włącznie z dzisiejszym dniem): ' + dishQuantity);
        console.log(`Łączny przychód z dania ${dish.name} w zeszłym tygodniu (włącznie z dzisiejszym dniem): ${totalRevenueLastWeek.toFixed(2)}`);

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenue: dailyRevenue.map((revenue, index) => ({
                day: index + 1, 
                revenue: revenue.toFixed(2)
            }))
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};

exports.calculateWithNewDishPrice = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;
        const newPrice = parseFloat(req.body.newPrice); 

        if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
            return res.status(400).json({ message: 'Invalid or missing newPrice in request body.' });
        }

        
        let objectIdDishId;
        try {
            objectIdDishId = new mongoose.Types.ObjectId(dishId);
        } catch (err) {
            const error = new HttpError('Invalid dishId format.', 400);
            return next(error);
        }

        
        const dish = await Dish.findById(objectIdDishId);

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, Oryginalna cena dania: ${dish.price}`);

        const originalPrice = dish.price;
        const ingredientCosts = {};
        let totalIngredientCost = 0;

        
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);

            const matchingIngredients = await Ingredient.find({ name: ingredientName });

            if (matchingIngredients.length === 0) {
                ingredientCosts[ingredientName] = 'Brak danych';
                continue;
            }

            let totalCost = 0;
            let totalWeight = 0;

            matchingIngredients.forEach(ingredient => {
                totalCost += ingredient.price;
                totalWeight += ingredient.weight;
            });

            const averagePricePerGram = totalCost / totalWeight;
            const ingredientCostInDish = averagePricePerGram * ingredientWeightInDish;

            ingredientCosts[ingredientName] = {
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / newPrice) * 100).toFixed(2)
            };

            totalIngredientCost += ingredientCostInDish;
        }

        
        const newProfitMargin = ((newPrice - totalIngredientCost) / newPrice) * 100;
        const originalProfitMargin = ((originalPrice - totalIngredientCost) / originalPrice) * 100;

        
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); 

        const formatDate = date => {
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const year = date.getFullYear();
            return `${month}.${day}.${year}`;
        };

        console.log(`Pobieranie zamówień z okresu: ${formatDate(sevenDaysAgo)} - ${formatDate(today)} (włącznie)`);

        const recentOrders = await Order.find({
            orderDate: {
                $gte: formatDate(sevenDaysAgo),
                $lte: formatDate(today)
            }
        });

        let dishQuantity = 0;
        const dailyRevenueOriginal = Array(7).fill(0); 
        const dailyRevenueNew = Array(7).fill(0); 

        recentOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

            if (daysAgo >= 0 && daysAgo < 7) {
                order.dishes.forEach(dishItem => {
                    if (dishItem.dish._id.equals(objectIdDishId)) {
                        const originalRevenueForDish = dishItem.quantity * originalPrice * (originalProfitMargin / 100);
                        const newRevenueForDish = dishItem.quantity * newPrice * (newProfitMargin / 100);

                        dailyRevenueOriginal[6 - daysAgo] += originalRevenueForDish;
                        dailyRevenueNew[6 - daysAgo] += newRevenueForDish;

                        dishQuantity += dishItem.quantity;
                    }
                });
            }
        });

        const totalOriginalRevenueLastWeek = dailyRevenueOriginal.reduce((acc, val) => acc + val, 0);
        const totalNewRevenueLastWeek = dailyRevenueNew.reduce((acc, val) => acc + val, 0);

        const percentageIncrease = ((totalNewRevenueLastWeek - totalOriginalRevenueLastWeek) / totalOriginalRevenueLastWeek) * 100;

        console.log(`Łączny przychód z dania ${dish.name} w zeszłym tygodniu (oryginalna cena): ${totalOriginalRevenueLastWeek.toFixed(2)}`);
        console.log(`Łączny przychód z dania ${dish.name} w zeszłym tygodniu (nowa cena): ${totalNewRevenueLastWeek.toFixed(2)}`);
        console.log(`Procentowy wzrost przychodu: ${percentageIncrease.toFixed(2)}%`);

        return res.status(200).json({
            dishName: dish.name,
            originalPrice: originalPrice,
            newPrice: newPrice,
            ingredients: ingredientCosts,
            originalProfitMargin: originalProfitMargin.toFixed(2),
            newProfitMargin: newProfitMargin.toFixed(2),
            totalOriginalRevenueLastWeek: totalOriginalRevenueLastWeek.toFixed(2),
            totalNewRevenueLastWeek: totalNewRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenueOriginal: dailyRevenueOriginal.map((revenue, index) => ({
                day: index + 1,
                revenue: revenue.toFixed(2)
            })),
            dailyRevenueNew: dailyRevenueNew.map((revenue, index) => ({
                day: index + 1,
                revenue: revenue.toFixed(2)
            })),
            percentageIncrease: percentageIncrease.toFixed(2)
        });

    } catch (err) {
        console.error('Błąd podczas obliczania nowych przychodów i marży:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania nowych przychodów i marży.' });
    }
};


exports.calculateAverageIngredientPrices7 = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;

        
        let objectIdDishId;
        try {
            objectIdDishId = new mongoose.Types.ObjectId(dishId);
        } catch (err) {
            const error = new HttpError('Invalid dishId format.', 400);
            return next(error);
        }

        
        const dish = await Dish.findById(objectIdDishId); 

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, Cena dania: ${dish.price}`);

        const ingredientCosts = {};
        let totalIngredientCost = 0;

        
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);

            console.log(`Składnik: ${ingredientName}, Waga w daniu: ${ingredientWeightInDish}g`);

            
            const matchingIngredients = await Ingredient.find({ name: ingredientName });

            if (matchingIngredients.length === 0) {
                console.log(`Nie znaleziono składników o nazwie: ${ingredientName}`);
                ingredientCosts[ingredientName] = 'Brak danych';
                continue;
            }

            
            let totalCost = 0;
            let totalWeight = 0;

            matchingIngredients.forEach(ingredient => {
                totalCost += ingredient.price;
                totalWeight += ingredient.weight;

                console.log(`Znaleziono składnik: ${ingredient.name}, Cena: ${ingredient.price}, Waga: ${ingredient.weight}`);
                console.log(`Obliczenia: Łączna cena = ${totalCost}, Łączna waga = ${totalWeight}`);
            });

            const averagePricePerGram = totalCost / totalWeight;
            const ingredientCostInDish = averagePricePerGram * ingredientWeightInDish;

            ingredientCosts[ingredientName] = {
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / dish.price) * 100).toFixed(2)
            };

            totalIngredientCost += ingredientCostInDish;
        }

        const profitMargin = ((dish.price - totalIngredientCost) / dish.price) * 100;

        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const formatDate = date => {
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const year = date.getFullYear();
            return `${month}.${day}.${year}`;
        };

        const recentOrders = await Order.find({
            orderDate: {
                $gte: formatDate(sevenDaysAgo),
                $lt: formatDate(today)
            }
        });

        let totalRevenue = 0;
        let dishQuantity = 0;

        recentOrders.forEach(order => {
            order.dishes.forEach(dishItem => {
                
                console.log('Przeglądanie dania w zamówieniu:', dishItem);

                
                if (dishItem.dish._id.equals(objectIdDishId)) {
                    console.log('Znaleziono dopasowanie dla dania w zamówieniu');
                    totalRevenue += dishItem.dish.price * dishItem.quantity;
                    dishQuantity += dishItem.quantity;
                } else {
                    console.log('Brak dopasowania dla dania w zamówieniu');
                }
            });
        });

        console.log('Ile razy to danie wystąpiło w zamówieniach w ostatnim tygodniu: ' + dishQuantity);
        console.log(`Łączny przychód z dania ${dish.name} w zeszłym tygodniu: ${totalRevenue.toFixed(2)}`);

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenue.toFixed(2),
            totalQuantityLastWeek: dishQuantity
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};



exports.calculateAverageIngredientPrices5 = async (req, res, next) => {
    try {
        const dishId = req.params.dishId; 

        let objectIdDishId;
    try {
        objectIdDishId = new mongoose.Types.ObjectId(dishId);
    } catch (err) {
        const error = new HttpError('Invalid dishId format.', 400);
        return next(error);
    }
        
        
        const dish = await Dish.findById(objectIdDishId);  

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, Cena dania: ${dish.price}`);

        const ingredientCosts = {};
        let totalIngredientCost = 0;

        
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);

            console.log(`Składnik: ${ingredientName}, Waga w daniu: ${ingredientWeightInDish}g`);

            
            const matchingIngredients = await Ingredient.find({ name: ingredientName });

            if (matchingIngredients.length === 0) {
                console.log(`Nie znaleziono składników o nazwie: ${ingredientName}`);
                ingredientCosts[ingredientName] = 'Brak danych';
                continue;
            }

            
            let totalCost = 0;
            let totalWeight = 0;

            matchingIngredients.forEach(ingredient => {
                totalCost += ingredient.price 
                totalWeight += ingredient.weight;

                console.log(`Znaleziono składnik: ${ingredient.name}, Cena: ${ingredient.price}, Waga: ${ingredient.weight}`);
                console.log(`Obliczenia: Łączna cena = ${totalCost}, Łączna waga = ${totalWeight}`);
            });

            
            const averagePricePerGram = totalCost / totalWeight;

            console.log(`Średnia cena jednostkowa składnika ${ingredientName}: ${averagePricePerGram.toFixed(2)} za 1g`);

            
            const ingredientCostInDish = averagePricePerGram * ingredientWeightInDish;

            console.log(`Koszt składnika ${ingredientName} w daniu ${dish.name}: ${ingredientCostInDish.toFixed(2)}`);

            ingredientCosts[ingredientName] = {
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / dish.price) * 100).toFixed(2) 
            };

            totalIngredientCost += ingredientCostInDish;
        }

        
        const profitMargin = ((dish.price - totalIngredientCost) / dish.price) * 100;

        console.log(`Łączny koszt składników: ${totalIngredientCost.toFixed(2)}`);
        console.log(`Marża restauracji: ${profitMargin.toFixed(2)}%`);

        
        const today = new Date();
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay());

        
        const formatDate = date => {
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const year = date.getFullYear();
            return `${month}.${day}.${year}`;
        };

        console.log(`Pobieranie zamówień z okresu: ${formatDate(lastWeekStart)} - ${formatDate(lastWeekEnd)}`);

        
        const lastWeekOrders = await Order.find({
            orderDate: {
                $gte: formatDate(lastWeekStart),
                $lt: formatDate(lastWeekEnd)
            }
        });

        console.log(`Znalezione zamówienia: ${lastWeekOrders.length}`);

        let totalRevenue = 0;
        let dishQuantity = 0;

        
        lastWeekOrders.forEach(order => {
            order.dishes.forEach(dishItem => {
                if (dishItem.dish._id === objectIdDishId) {
                    totalRevenue += dishItem.price * dishItem.quantity;
                    dishQuantity += dishItem.quantity
                }
            });
        });

        console.log('Ile razy to danie wystapilo w zamowieniach w ostatnim tygodniu: ' + dishQuantity)
        console.log(`Łączny przychód z dania ${dish.name} w zeszłym tygodniu: ${totalRevenue.toFixed(2)}`);

        
        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenue.toFixed(2)
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};



exports.calculateAverageIngredientPrices2 = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;  
        const dish = await Dish.findById(dishId);  

        if (!dish) {
            return res.status(404).json({ message: 'Nie znaleziono dania.' });
        }

        console.log(`Danie: ${dish.name}, Cena dania: ${dish.price}`);

        const ingredientCosts = {};
        let totalIngredientCost = 0;

        
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);

            console.log(`Składnik: ${ingredientName}, Waga w daniu: ${ingredientWeightInDish}g`);

            
            const matchingIngredients = await Ingredient.find({ name: ingredientName });

            if (matchingIngredients.length === 0) {
                console.log(`Nie znaleziono składników o nazwie: ${ingredientName}`);
                ingredientCosts[ingredientName] = 'Brak danych';
                continue;
            }

            
            let totalCost = 0;
            let totalWeight = 0;

            matchingIngredients.forEach(ingredient => {
                totalCost += ingredient.price * ingredient.weight;
                totalWeight += ingredient.weight;

                console.log(`Znaleziono składnik: ${ingredient.name}, Cena: ${ingredient.price}, Waga: ${ingredient.weight}`);
                console.log(`Obliczenia: Łączna cena = ${totalCost}, Łączna waga = ${totalWeight}`);
            });

            
            const averagePricePerGram = totalCost / totalWeight;

            console.log(`Średnia cena jednostkowa składnika ${ingredientName}: ${averagePricePerGram.toFixed(2)} za 1g`);

            
            const ingredientCostInDish = averagePricePerGram * ingredientWeightInDish;

            console.log(`Koszt składnika ${ingredientName} w daniu ${dish.name}: ${ingredientCostInDish.toFixed(2)}`);

            ingredientCosts[ingredientName] = {
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / dish.price) * 100).toFixed(2) 
            };

            totalIngredientCost += ingredientCostInDish;
        }

        
        const profitMargin = ((dish.price - totalIngredientCost) / dish.price) * 100;

        console.log(`Łączny koszt składników: ${totalIngredientCost.toFixed(2)}`);
        console.log(`Marża restauracji: ${profitMargin.toFixed(2)}%`);

        
        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2)
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników i marży:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników i marży.' });
    }
};

exports.getDishOrdersInLast7Days = async (req, res, next) => {
    const dishId = req.params.dishId; 

    try {
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        
        const ordersCount = await Order.countDocuments({
            'dishes.dish': dishId, 
            orderDate: {
                $gte: startDateStr,
                $lte: endDateStr
            }
        });

        
        res.status(200).json({
            message: 'Liczba zamówień została pomyślnie pobrana.',
            ordersCount: ordersCount
        });
    } catch (error) {
        console.error('Error retrieving dish orders:', error);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby zamówień.' });
    }
};

exports.calculateMostUsedIngredients = async (req, res, next) => {
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

        
        const convertStringToDate = (dateString) => {
            const [month, day, year] = dateString.split('.').map(Number);  
            return new Date(year, month - 1, day);  
        };

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        
        const last30DaysOrders = await Order.find({
            orderDate: {
                $exists: true,  
            }
        });

        
        const filteredOrders = last30DaysOrders.filter(order => {
            const orderDate = convertStringToDate(order.orderDate);  
            return orderDate >= thirtyDaysAgo && orderDate <= today;  
        });

        console.log(`Znalezione zamówienia: ${filteredOrders.length}`);

        if (filteredOrders.length === 0) {
            return res.status(404).json({ message: 'Brak zamówień w ostatnich 30 dniach.' });
        }

        
        const ingredientUsageCount = {};

        
        for (const order of filteredOrders) {
            console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

            for (const dishItem of order.dishes) {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates || !dish.isAvailable) continue;  

                
                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientName = ingTemplate.ingredient.name;
                    const ingredientWeight = parseFloat(ingTemplate.weight);

                    
                    const totalIngredientWeight = ingredientWeight * dishItem.quantity;

                    
                    if (!ingredientUsageCount[ingredientName]) {
                        ingredientUsageCount[ingredientName] = 0;
                    }

                    ingredientUsageCount[ingredientName] += totalIngredientWeight;
                });
            }
        }

        
        const sortedIngredients = Object.entries(ingredientUsageCount)
            .sort(([, a], [, b]) => b - a)
            .map(([ingredient, usage]) => ({ ingredient, usage }));

        console.log('Najczęściej używane składniki:', sortedIngredients);

        return res.status(200).json({
            period: `${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`,
            mostUsedIngredients: sortedIngredients
        });

    } catch (err) {
        console.error('Błąd podczas obliczania najczęściej używanych składników:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania najczęściej używanych składników.' });
    }
};

exports.getTopTippedEmployee = async (req, res, next) => {
    try {
        
        const allTips = await Tip.find().populate('user'); 

        if (!allTips || allTips.length === 0) {
            return res.status(404).json({ message: "Nie znaleziono napiwków." });
        }

        
        const tipSums = {};

        
        allTips.forEach(tip => {
            const userId = tip.user._id.toString();
            const tipAmount = tip.amount;

            if (!tipSums[userId]) {
                tipSums[userId] = {
                    employee: tip.user, 
                    totalTips: 0 
                };
            }

            tipSums[userId].totalTips += tipAmount; 
        });

        
        let topEmployee = null;
        let maxTips = 0;

        for (const userId in tipSums) {
            if (tipSums[userId].totalTips > maxTips) {
                maxTips = tipSums[userId].totalTips;
                topEmployee = tipSums[userId].employee;
            }
        }

        if (!topEmployee) {
            return res.status(404).json({ message: "Nie znaleziono pracownika z napiwkami." });
        }

        
        res.status(200).json({
            employee: topEmployee.name,
            totalTips: maxTips
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError('Wystąpił błąd podczas pobierania pracownika.', 500));
    }
};

exports.calculateMonthlyOrderDifferences = (req, res, next) => {
    try {

      const orders = [100, 120, 90, 105, 130, 110, 100, 150, 140, 120, 135, 125, 105, 115, 95, 110, 140, 130, 110, 160, 145, 130, 150, 140]

      const differences = [];
      for (let i = 0; i < orders.length - 1; i++) {
        differences[i] = (orders[i + 1] / orders[i]) * 100;
      }
  
      const previousYears = [];
      for (let i = 0; i < 12; i++) {
        previousYears[i] = (orders[i] + orders[i + 12]) / 2;
      }

      const currentYear = [110, 130, 85, 125]
  
      let totalDifference = 0;
      for (let i = 0; i < currentYear.length; i++) {
        const difference = currentYear[i] - previousYears[i];
        totalDifference += difference;
      }
  
      const actualDifference = totalDifference / currentYear.length;

      const updatedPredictions = previousYears.map(monthlyOrder => monthlyOrder + actualDifference);
  
      res.status(200).json({
        message: "Obliczenia zakończone sukcesem.",
        orders,
        differences,
        previousYears,
        currentYear,
        updatedPredictions
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas obliczania prognoz zamówień.' });
    }
  };