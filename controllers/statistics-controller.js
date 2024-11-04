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
                dishPercentage[dishName] = parseFloat(((dishCount[dishName] / totalDishes) * 100).toFixed(2));
            }

            // Przekształcenie obiektu w tablicę, sortowanie i ograniczenie do 7 pozycji
            const topDishes = Object.entries(dishPercentage)
                .sort(([, a], [, b]) => b - a) // Sortowanie malejąco według wartości procentowej
                .slice(0, 7) // Wybranie maksymalnie 7 najczęściej występujących pozycji
                .reduce((acc, [name, percentage]) => {
                    acc[name] = percentage;
                    return acc;
                }, {});

            res.status(200).json({ dishPercentage: topDishes });
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

exports.getDishIngredientCost= async (req, res, next) => {
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
    const todayFormatted = `${month}.${day}.${year}`; // Format dzisiejszej daty

    // Ustalamy granice daty dla dzisiejszego dnia
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)); // Początek dnia
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)); // Koniec dnia

    // Zmiana zapytania do bazy, aby uwzględniało datę z orderDate
    Order.find({
        orderDate: {
            $gte: startOfDay,
            $lte: endOfDay
        }
    })
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

                // Inicjalizacja statystyk dla dania, jeśli nie istnieje
                if (!dishStats[dishName]) {
                    dishStats[dishName] = { count: 0, revenue: 0 };
                }

                // Zliczanie ilości i przychodu
                dishStats[dishName].count += quantity;
                dishStats[dishName].revenue += dishPrice * quantity;
            });
        });

        // Sortowanie dań według ilości
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


exports.getMostPopularDishesLastWeek = (req, res, next) => {
    const today = new Date();

    // Ustawiamy datę na początku dnia (00:00:00)
    today.setHours(0, 0, 0, 0); // Ignorujemy godzinę

    // Obliczanie daty sprzed 7 dni, łącznie z dzisiejszym dniem
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Ustawienie daty na 6 dni wstecz + dzisiaj

    // Funkcja pomocnicza do konwersji daty z formatu string
    const parseOrderDate = (orderDateStr) => {
        const [datePart] = orderDateStr.split(' '); // Ignorujemy czas
        const [month, day, year] = datePart.split('.').map(Number); // Ustawiamy kolejność [miesiąc, dzień, rok]
        return new Date(year, month - 1, day); // Miesiąc - 1, ponieważ miesiące w JS zaczynają się od 0
    };

    Order.find({})
        .then(orders => {
            const filteredOrders = orders.filter(order => {
                const orderDate = parseOrderDate(order.orderDate);
                return orderDate >= sevenDaysAgo && orderDate <= today; // Filtrujemy po datach
            });

            if (filteredOrders.length === 0) {
                return res.status(404).json({ message: 'Brak zamówień z ostatnich 7 dni.' });
            }

            const dishStats = {};
            filteredOrders.forEach(order => {
                order.dishes.forEach(dishItem => {
                    const dishName = dishItem.dish.name;
                    const dishPrice = dishItem.dish.price;
                    const quantity = dishItem.quantity;

                    if (!dishStats[dishName]) {
                        dishStats[dishName] = { count: 0, revenue: 0 };
                    }

                    // Zliczanie ilości i przychodu
                    dishStats[dishName].count += quantity;
                    dishStats[dishName].revenue += dishPrice * quantity;
                });
            });

            // Sortowanie dań według liczby zamówień i ograniczenie do 7 najpopularniejszych
            const sortedDishes = Object.entries(dishStats)
                .sort(([, statsA], [, statsB]) => statsB.count - statsA.count) // Sortowanie według ilości
                .slice(0, 7) // Ograniczenie do 7 najpopularniejszych dań
                .map(([name, stats]) => ({
                    name,
                    count: stats.count,
                    revenue: stats.revenue.toFixed(2) // Formatowanie przychodu
                }));

            // Najbardziej popularne danie
            let mostPopularDish = null;
            let maxCount = 0;
            let maxRevenue = 0;

            if (sortedDishes.length > 0) {
                mostPopularDish = sortedDishes[0].name;
                maxCount = sortedDishes[0].count;
                maxRevenue = sortedDishes[0].revenue;
            }

            res.status(200).json({
                message: 'Lista 7 najpopularniejszych dań z ostatnich 7 dni.',
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

exports.getOrdersStatsLastWeek = (req, res, next) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignorujemy godzinę

    // Obliczanie daty sprzed 6 dni (aby łącznie z dzisiaj było 7 dni)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    // Funkcja pomocnicza do konwersji daty z formatu string
    const parseOrderDate = (orderDateStr) => {
        const [datePart] = orderDateStr.split(' '); // Ignorujemy czas
        const [month, day, year] = datePart.split('.').map(Number); // Ustawiamy kolejność [miesiąc, dzień, rok]
        return new Date(year, month - 1, day); // Miesiąc - 1, ponieważ miesiące w JS zaczynają się od 0
    };

    // Pobranie wszystkich zamówień
    Order.find({})
        .then(orders => {
            const ordersCountByDay = Array(7).fill(0); // Tablica na zliczanie zamówień dla każdego z ostatnich 7 dni
            const dataDays = Array(7); // Tablica na nazwy dni tygodnia

            // Określenie dni tygodnia dla ostatnich 7 dni, zaczynając od dzisiaj na pozycji 6
            for (let i = 0; i < 7; i++) {
                const day = new Date(today);
                day.setDate(today.getDate() - (6 - i)); // Cofamy się w czasie o (6 - i) dni
                const dayOfWeek = day.toLocaleDateString('pl-PL', { weekday: 'short' }); // Skrót dnia tygodnia
                dataDays[i] = dayOfWeek;
            }

            // Przetwarzanie zamówień
            orders.forEach(order => {
                if (!order.orderDate || typeof order.orderDate !== 'string') return; // Pomijamy, jeśli data nie jest poprawna

                const orderDate = parseOrderDate(order.orderDate); // Konwersja daty zamówienia
                if (orderDate >= sevenDaysAgo && orderDate <= today) {
                    // Obliczamy indeks dnia, uwzględniając że indeks 6 to dziś
                    const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
                    const dayIndex = 6 - daysAgo; // Im bliżej dziś, tym wyższy indeks

                    ordersCountByDay[dayIndex] += 1; // Zwiększamy licznik dla odpowiedniego dnia
                }
            });

            const totalOrders = ordersCountByDay.reduce((acc, count) => acc + count, 0); // Suma wszystkich zamówień

            // Formatowanie danych dla wykresu
            const responseData = {
                data: ordersCountByDay,
                dataDays: dataDays,
                totalOrders: totalOrders,
            };

            res.status(200).json({
                message: 'Statystyki zamówień z ostatnich 7 dni.',
                ...responseData,
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych.' });
        });
};


exports.getOrdersStatsLastWeek2 = (req, res, next) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignorujemy godzinę

    // Obliczanie daty sprzed 7 dni
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Ustawiamy datę na 6 dni wstecz + dzisiaj

    // Funkcja pomocnicza do konwersji daty z formatu string
    const parseOrderDate = (orderDateStr) => {
        const [datePart] = orderDateStr.split(' '); // Ignorujemy czas
        const [month, day, year] = datePart.split('.').map(Number); // Ustawiamy kolejność [miesiąc, dzień, rok]
        return new Date(year, month - 1, day); // Miesiąc - 1, ponieważ miesiące w JS zaczynają się od 0
    };

    Order.find({})
        .then(orders => {
            const ordersCountByDay = Array(7).fill(0); // Tablica na zliczanie zamówień dla każdego dnia

            orders.forEach(order => {
                const orderDate = parseOrderDate(order.orderDate);
                if (orderDate >= sevenDaysAgo && orderDate <= today) { // Filtrujemy zamówienia w ostatnich 7 dniach
                    const dayOfWeek = (orderDate.getDay() + 6) % 7; // Obliczanie indeksu dnia tygodnia (0 = niedziela, 1 = poniedziałek, ..., 6 = sobota)
                    ordersCountByDay[dayOfWeek] += 1; // Zwiększamy licznik dla odpowiedniego dnia
                }
            });

            const totalOrders = ordersCountByDay.reduce((acc, count) => acc + count, 0); // Suma wszystkich zamówień w ostatnich 7 dniach

            // Formatowanie danych dla wykresu
            const responseData = {
                data: ordersCountByDay,
                totalOrders: totalOrders,
            };

            res.status(200).json({
                message: 'Statystyki zamówień z ostatnich 7 dni.',
                ...responseData,
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych.' });
        });
};





// zly format daty
// exports.getMostPopularDishesToday = (req, res, next) => {
//     const today = new Date();

//     const day = today.getDate().toString().padStart(2, '0');
//     const month = (today.getMonth() + 1).toString().padStart(2, '0');
//     const year = today.getFullYear();
//     const todayFormatted = `${month}.${day}.${year}`;

//     Order.find({ orderDate: todayFormatted })
//         .sort({ createdAt: -1 }) 
//         .limit(7) 
//         .then(orders => {
//             if (orders.length === 0) {
//                 return res.status(404).json({ message: 'Brak zamówień z dzisiaj.' });
//             }

           
//             const dishStats = {};
//             orders.forEach(order => {
//                 order.dishes.forEach(dishItem => {
//                     const dishName = dishItem.dish.name;
//                     const dishPrice = dishItem.dish.price;
//                     const quantity = dishItem.quantity;

                    
//                     if (!dishStats[dishName]) {
//                         dishStats[dishName] = { count: 0, revenue: 0 };
//                     }

                   
//                     dishStats[dishName].count += quantity;

                    
//                     dishStats[dishName].revenue += dishPrice * quantity;
//                 });
//             });

           
//             const sortedDishes = Object.entries(dishStats)
//                 .sort(([, statsA], [, statsB]) => statsB.count - statsA.count) 
//                 .slice(0, 7) 
//                 .map(([name, stats]) => ({
//                     name,
//                     count: stats.count,
//                     revenue: stats.revenue.toFixed(2) 
//                 }));

//             let mostPopularDish = null;
//             let maxCount = 0;
//             let maxRevenue = 0;

//             if (sortedDishes.length > 0) {
//                 mostPopularDish = sortedDishes[0].name;
//                 maxCount = sortedDishes[0].count;
//                 maxRevenue = sortedDishes[0].revenue;
//             }

//             res.status(200).json({
//                 message: 'Lista 7 najpopularniejszych dań z dzisiaj.',
//                 mostPopularDish: mostPopularDish,
//                 mostPopularDishCount: maxCount,
//                 mostPopularDishRevenue: maxRevenue, 
//                 topDishes: sortedDishes
//             });
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych.' });
//         });
// };


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
        const ingredientName = req.params.ingredientName;  // Używamy nazwy składnika z parametrów
        const ingredients = await Ingredient.find({ name: ingredientName });  // Pobierz wszystkie wpisy dla danego składnika

        if (!ingredients || ingredients.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        let expirationDate = null;

        // Obliczamy całkowitą wagę składnika
        const totalWeightOfIngredient = ingredients.reduce((acc, ingredient) => acc + ingredient.weight, 0);

        // Szukamy najwcześniejszej daty wygaśnięcia, jeśli istnieje
        ingredients.forEach(ingredient => {
            if (ingredient.expirationDate) {
                const expDate = new Date(ingredient.expirationDate);
                if (!expirationDate || expDate < expirationDate) {
                    expirationDate = expDate;
                }
            }
        });

        console.log(`Składnik: ${ingredientName}, Całkowita ilość: ${totalWeightOfIngredient}`);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  // Data sprzed 30 dni

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        const convertStringToDate = (dateString) => {
            const [month, day, year] = dateString.split('.').map(Number);
            return new Date(year, month - 1, day);
        };

        // Pobierz zamówienia z ostatnich 30 dni
        const last30DaysOrders = await Order.find({
            orderDate: { $exists: true }
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

                    if (ingredientInDish.name === ingredientName) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`);
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity;
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredientName} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;

        console.log(`Średnie dzienne zużycie składnika ${ingredientName}: ${averageDailyUsage.toFixed(2)}`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A',
                totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2)
            });
        }

        // Obliczenie liczby dni do wyczerpania zapasów na podstawie całkowitej ilości składnika
        const daysUntilOutOfStock = totalWeightOfIngredient / averageDailyUsage;

        console.log(`Składnik ${ingredientName} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
            console.log(`Days Until Expiration: ${daysUntilExpiration}`);
        } else {
            console.log(`Brak daty wygaśnięcia dla składnika ${ingredientName}`);
        }

        let wasteProbability = 0;
        if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const totalIngredientValue = ingredients.reduce((acc, ingredient) => acc + (ingredient.price * ingredient.weight), 0);
        const wastedValue = (wasteProbability / 100) * totalIngredientValue;

        return res.status(200).json({
            ingredientName: ingredientName,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration !== null ? daysUntilExpiration.toFixed(2) : 'Brak daty wygaśnięcia',
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2),
            totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};

exports.calculateIngredientWasteProbability = async (req, res, next) => {
    try {
        const ingredientName = req.params.ingredientName; // Pobranie nazwy składnika
        const ingredients = await Ingredient.find({ name: ingredientName }); // Pobierz wszystkie składniki o danej nazwie

        if (!ingredients.length) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        let totalWeight = 0;  // Zmienna do przechowywania całkowitej wagi
        let totalValue = 0; // Zmienna do przechowywania całkowitej wartości

        // Oblicz całkowitą wagę i wartość
        ingredients.forEach(ingredient => {
            totalWeight += ingredient.weight;
            totalValue += ingredient.price; // Zakładamy, że cena dotyczy całości
        });

        const expirationDate = ingredients[0].expirationDate ? new Date(ingredients[0].expirationDate) : null;
        console.log(`Składnik: ${ingredientName}, Całkowita waga: ${totalWeight}`);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const last30DaysOrders = await Order.find({
            orderDate: {
                $exists: true,
            }
        });

        // Funkcja konwertująca string do daty
        const convertStringToDate = (dateString) => {
            const [month, day, year] = dateString.split('.').map(Number);  
            return new Date(year, month - 1, day);  
        };

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
            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;

                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredientName) {
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity;
                    }
                });
            });
        });

        const averageDailyUsage = totalUsage / 30;

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A'
            });
        }

        const daysUntilOutOfStock = totalWeight / averageDailyUsage;

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
        }

        let wasteProbability = 0;
        if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const wastedValue = (wasteProbability / 100) * totalValue;

        return res.status(200).json({
            ingredientName,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration !== null ? daysUntilExpiration.toFixed(2) : 'Brak daty wygaśnięcia',
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2),
            totalWeightOfIngredient: totalWeight.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};

exports.getIngredientUsageInDishes = async (req, res) => {
    const ingredientName = req.params.ingredientName; // Pobierz nazwę składnika z parametrów żądania

    try {
        // Znajdź wszystkie zamówienia, które zawierają dania wykorzystujące dany składnik
        const orders = await Order.find({
            'dishes.dish.ingredientTemplates.ingredient.name': ingredientName // Filtruj zamówienia zawierające składnik
        }).populate({
            path: 'dishes.dish', // Populate z danymi dania
            populate: {
                path: 'ingredientTemplates.ingredient' // Populate z danymi składników
            }
        });

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono zamówień z tym składnikiem.' });
        }

        const ingredientUsage = {}; // Obiekt do przechowywania danych o użyciu

        // Iteruj przez zamówienia, aby znaleźć użycie składnika
        orders.forEach(order => {
            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish; // Pobierz obiekt dania

                if (dish && dish.ingredientTemplates) {
                    dish.ingredientTemplates.forEach(ingTemplate => {
                        const ingredientInDish = ingTemplate.ingredient;

                        if (ingredientInDish.name === ingredientName) {
                            // Dodaj lub zaktualizuj użycie w obiekcie ingredientUsage
                            if (!ingredientUsage[dish._id]) {
                                ingredientUsage[dish._id] = {
                                    dishName: dish.name,
                                    totalQuantity: 0, // Łączna ilość
                                };
                            }
                            // Dodaj ilość użytego składnika do dania
                            ingredientUsage[dish._id].totalQuantity += dishItem.quantity * parseFloat(ingTemplate.weight); // Zaktualizuj ilość
                        }
                    });
                }
            });
        });

        return res.status(200).json({
            message: 'Znaleziono zamówienia z użyciem składnika.',
            ingredientUsage
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas wyszukiwania zamówień.' });
    }
};



exports.calculateIngredientWasteProbability5 = async (req, res, next) => {
    try {
        const ingredientName = req.params.ingredientName;  // Używamy nazwy składnika z parametrów
        const ingredients = await Ingredient.find({ name: ingredientName });  // Pobierz wszystkie wpisy dla danego składnika

        if (!ingredients || ingredients.length === 0) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        const today = new Date();
        let expirationDate = null;

        // Obliczamy całkowitą wagę składnika
        const totalWeightOfIngredient = ingredients.reduce((acc, ingredient) => acc + ingredient.weight, 0);

        // Szukamy najwcześniejszej daty wygaśnięcia, jeśli istnieje
        ingredients.forEach(ingredient => {
            if (ingredient.expirationDate) {
                const expDate = new Date(ingredient.expirationDate);
                if (!expirationDate || expDate < expirationDate) {
                    expirationDate = expDate;
                }
            }
        });

        console.log(`Składnik: ${ingredientName}, Całkowita ilość: ${totalWeightOfIngredient}`);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  // Data sprzed 30 dni

        console.log(`Pobieranie zamówień z okresu: ${thirtyDaysAgo.toDateString()} - ${today.toDateString()}`);

        const convertStringToDate = (dateString) => {
            const [month, day, year] = dateString.split('.').map(Number);
            return new Date(year, month - 1, day);
        };

        // Pobierz zamówienia z ostatnich 30 dni
        const last30DaysOrders = await Order.find({
            orderDate: { $exists: true }
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

                    if (ingredientInDish.name === ingredientName) {
                        console.log(`Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`);
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity;
                    }
                });
            });
        });

        console.log(`Całkowite zużycie składnika ${ingredientName} w ostatnich 30 dniach: ${totalUsage}`);

        const averageDailyUsage = totalUsage / 30;

        console.log(`Średnie dzienne zużycie składnika ${ingredientName}: ${averageDailyUsage.toFixed(2)}`);

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A',
                totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2)
            });
        }

        // Obliczenie liczby dni do wyczerpania zapasów na podstawie całkowitej ilości składnika
        const daysUntilOutOfStock = totalWeightOfIngredient / averageDailyUsage;

        console.log(`Składnik ${ingredientName} wystarczy na: ${daysUntilOutOfStock.toFixed(2)} dni`);

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
            console.log(`Days Until Expiration: ${daysUntilExpiration}`);
        } else {
            console.log(`Brak daty wygaśnięcia dla składnika ${ingredientName}`);
        }

        let wasteProbability = 0;
        if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
            const excessDays = daysUntilOutOfStock - daysUntilExpiration;
            wasteProbability = Math.min(100, (excessDays / daysUntilOutOfStock) * 100);
        }

        const totalIngredientValue = ingredients.reduce((acc, ingredient) => acc + (ingredient.price * ingredient.weight), 0);
        const wastedValue = (wasteProbability / 100) * totalIngredientValue;

        return res.status(200).json({
            ingredientName: ingredientName,
            averageDailyUsage: averageDailyUsage.toFixed(2),
            daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
            daysUntilExpiration: daysUntilExpiration !== null ? daysUntilExpiration.toFixed(2) : 'Brak daty wygaśnięcia',
            wasteProbability: wasteProbability.toFixed(2),
            wastedValue: wastedValue.toFixed(2),
            totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2)
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};



exports.calculateIngredientWasteProbabilit4y = async (req, res, next) => {
    try {
        const ingredientName = req.params.ingredientName; 
        const ingredient = await Ingredient.findOne({ name: ingredientName });

        if (!ingredient) {
            return res.status(404).json({ message: 'Nie znaleziono składnika.' });
        }

        // Pobierz wszystkie składniki o tej samej nazwie i zsumuj ich wagę
        const allIngredientsWithSameName = await Ingredient.find({ name: ingredientName });
        const totalWeightOfIngredient = allIngredientsWithSameName.reduce((total, ing) => total + ing.weight, 0);

        const today = new Date();
        let expirationDate = null;

        if (ingredient.expirationDate) {
            expirationDate = new Date(ingredient.expirationDate);
        }

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);  

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

        if (filteredOrders.length === 0) {
            return res.status(404).json({ message: 'Brak zamówień z ostatnich 30 dni.' });
        }

        let totalUsage = 0;  

        filteredOrders.forEach(order => {
            order.dishes.forEach(dishItem => {
                const dish = dishItem.dish;

                if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;

                dish.ingredientTemplates.forEach(ingTemplate => {
                    const ingredientInDish = ingTemplate.ingredient;

                    if (ingredientInDish.name === ingredient.name) {
                        totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity; 
                    }
                });
            });
        });

        const averageDailyUsage = totalUsage / 30;

        if (averageDailyUsage === 0) {
            return res.status(200).json({
                message: 'Składnik nie był używany w ostatnich 30 dniach.',
                daysUntilOutOfStock: 'Nieskończoność',
                wasteProbability: 'N/A',
                totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2)
            });
        }

        const daysUntilOutOfStock = ingredient.weight / averageDailyUsage;

        let daysUntilExpiration = null;
        if (expirationDate) {
            daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
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
            wastedValue: wastedValue.toFixed(2),
            totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2) // Całkowita ilość składnika
        });

    } catch (err) {
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania.' });
    }
};


exports.calculateIngredientWasteProbability3 = async (req, res, next) => {
    try {
        console.log(req.params.ingredientName)
        const ingredientName = req.params.ingredientName;  // Używamy nazwy składnika z parametrów zapytania
        const ingredient = await Ingredient.findOne({ name: ingredientName });  // Wyszukujemy składnik po nazwie

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


exports.calculateIngredientWasteProbability2 = async (req, res, next) => {
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


exports.calculateAverageIngredientPrices2 = async (req, res, next) => {
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
                percentage: ((ingredientCostInDish / dish.price) * 100).toFixed(2)
            };

            totalIngredientCost += ingredientCostInDish;
        }

        const profitMargin = ((dish.price - totalIngredientCost) / dish.price) * 100;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);

        const dailyRevenue = Array(7).fill(0);
        const dailyRevenueDays = Array(7);

        for (let i = 0; i < 7; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() - (6 - i));
            const dayOfWeek = day.toLocaleDateString('pl-PL', { weekday: 'short' });
            dailyRevenueDays[i] = dayOfWeek;
        }

        const recentOrders = await Order.find({
            orderDate: {
                $gte: sevenDaysAgo,
                $lte: today
            }
        });

        let dishQuantity = 0;

        recentOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            orderDate.setHours(0, 0, 0, 0);
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

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenue: dailyRevenue.map((revenue, index) => ({
                day: dailyRevenueDays[index],
                revenue: revenue.toFixed(2)
            }))
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
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
                weightInDish: ingredientWeightInDish.toFixed(2),
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

        const dayNames = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
        const recentOrders = await Order.find({
            orderDate: {
                $gte: formatDate(sevenDaysAgo),
                $lte: formatDate(today)
            }
        });

        let dishQuantity = 0;
        const dailyRevenue = Array(7).fill(0).map((_, i) => ({
            dayName: dayNames[(today.getDay() + i - 6 + 7) % 7], // Nazwa dnia tygodnia, od dziś wstecz
            revenue: 0,
            quantity: 0
        }));

        recentOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

            if (daysAgo >= 0 && daysAgo < 7) {
                order.dishes.forEach(dishItem => {
                    if (dishItem.dish._id.equals(objectIdDishId)) {
                        const revenueForDish = dishItem.quantity * dish.price * (profitMargin / 100);
                        dailyRevenue[6 - daysAgo].revenue += revenueForDish;
                        dailyRevenue[6 - daysAgo].quantity += dishItem.quantity;
                        dishQuantity += dishItem.quantity;
                    }
                });
            }
        });

        const totalRevenueLastWeek = dailyRevenue.reduce((acc, day) => acc + day.revenue, 0);

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenue: dailyRevenue.map(day => ({
                dayName: day.dayName,
                revenue: day.revenue.toFixed(2),
                quantity: day.quantity
            }))
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};


exports.calculateAverageIngredientPricesDobrealebezdnitygodnia = async (req, res, next) => {
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

        const ingredientCosts = {};
        let totalIngredientCost = 0;

        // Przetwarzanie składników z szablonu dania
        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const ingredientWeightInDish = parseFloat(ingTemplate.weight);  // Ilość składnika w daniu

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
                weightInDish: ingredientWeightInDish.toFixed(2),  // Dodano wagę składnika
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


exports.calculateAverageIngredientPricesDobre = async (req, res, next) => {
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

        // Day labels corresponding to array indices
        const dayLabels = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
        // const dailyRevenue = Array(7).fill(0);

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dish.price,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenue: dailyRevenue.map((revenue, index) => ({
                day: dayLabels[index],
                revenue: revenue.toFixed(2)
            }))
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};





exports.getDishPopularity = async (req, res, next) => {
    const dishId = req.params.dishId;

    let objectIdDishId;
    try {
        objectIdDishId = new mongoose.Types.ObjectId(dishId);
    } catch (err) {
        const error = new HttpError('Nieprawidłowy format dishId.', 400);
        return next(error);
    }

    try {
        // Obliczamy datę sprzed miesiąca
        const today = new Date();
        const oneMonthAgo = new Date();

        oneMonthAgo.setMonth(today.getMonth() - 1);

        // Formatowanie daty do porównania
        const formatDate = (date) => {
            const day = ('0' + date.getDate()).slice(-2);
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        console.log(formatDate(oneMonthAgo))
        console.log(formatDate(today))

        // Pobieramy zamówienia z ostatniego miesiąca
        const orders = await Order.find();

        console.log(orders.length)

        // Inicjalizujemy tablicę do zliczania zamówień w poszczególnych dniach tygodnia
        const popularity = Array(7).fill(0); // 0 - Poniedziałek, 1 - Wtorek, ..., 6 - Niedziela

        orders.forEach(order => {
            // order.orderDate jest w formacie string "DD.MM.YYYY HH:mm:ss"
            const [dateString] = order.orderDate.split(' '); // Oddzielamy datę od godziny
            const [day, month, year] = dateString.split('.').map(Number); // Dzielimy na dzień, miesiąc i rok

            // Tworzymy datę JavaScript
            const orderDate = new Date(year, month - 1, day); // Miesiąc w JavaScript zaczyna się od 0
            const dayOfWeek = (orderDate.getDay() + 6) % 7; // Dostosowanie: poniedziałek = 0, ..., niedziela = 6

            // Zliczamy zamówienia tylko dla danego dania
            order.dishes.forEach(dish => {
                if (dish.dish._id.equals(objectIdDishId)) {
                    popularity[dayOfWeek] += dish.quantity; // Zwiększamy licznik zamówień
                }
            });
        });

        // Zwracamy popularność dania w formacie odpowiedzi
        return res.status(200).json({
            dishId: dishId,
            popularity: popularity.map((count, index) => ({
                day: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'][index], // Skróty dni tygodnia zaczynając od poniedziałku
                count: count
            }))
        });
    } catch (err) {
        console.error('Błąd podczas pobierania popularności dania:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas pobierania popularności dania.' });
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



exports.calculateAverageIngredientPrices2 = async (req, res, next) => {
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



exports.calculatePredictionTest = (req, res, next) => {
    const orders = [
        100, 120, 90, 105, 130, 110, 100,
        150, 140, 120, 135, 125, 105, 115,
        95, 110, 140, 130, 110, 160, 145,
        130, 150, 140
    ];

    const calculateMonthlyDifferences = (orders) => {
        const newOrders = [];
        for (let i = 1; i < orders.length; i++) {
            const difference = (orders[i] / orders[i - 1]) * 100;
            newOrders.push(parseFloat(difference.toFixed(2)));
        }
        return newOrders;
    };

    const calculateMonthlyAverages = (orders) => {
        const monthlyAverages = [];
        for (let i = 0; i < 12; i++) {
            const firstValue = orders[i];
            const secondValue = orders[i + 12];
            const average = (firstValue + secondValue) / 2;
            monthlyAverages.push(parseFloat(average.toFixed(2)));
        }
        return monthlyAverages;
    };

    const forecastUsingMonthlyAverages = (monthlyAverages, newDifferences) => {
        const differences = monthlyAverages.slice(0, newDifferences.length).map((value, index) => newDifferences[index] - value);
        const averageDifference = differences.reduce((sum, value) => sum + value, 0) / differences.length;

        const nextMonths = monthlyAverages.slice(3, 6);
        const forecasts = nextMonths.map(value => parseFloat((value + averageDifference).toFixed(2)));

        return forecasts;
    };

    const newOrders = calculateMonthlyDifferences(orders);

    const monthlyAverages = calculateMonthlyAverages(newOrders);

    const newDifferences = [96, 110, 78];

    const forecastedValues = forecastUsingMonthlyAverages(monthlyAverages, newDifferences);

    res.json({
        originalOrders: orders,
        newOrders,
        monthlyAverages,
        forecastedValues
    });
};




//dziwnie zwraca
exports.calculatePredictionTest2 = (req, res, next) => {
    
    const orders = [
        100, 120, 75, 116.67, 123.81, 84.62, 90.91, 
        150, 93.33, 85.71, 112.5, 92.59, 
        84, 109.52, 82.61, 115.79, 127.27, 92.86, 
        84.62, 145.45, 90.63, 89.66, 115.38, 93.33
    ];

    const newDifferences = [96, 110, 78];

    
    const calculateMonthlyAverages = (orders) => {
        const monthlyAverages = [];
        
        
        for (let i = 0; i < 12; i++) {
            const firstValue = orders[i];           
            const secondValue = orders[i + 12];     

            
            const average = (firstValue + secondValue) / 2;

            
            monthlyAverages.push(average);
        }

        return monthlyAverages;
    };

    
    const forecastUsingMonthlyAverages = (monthlyAverages, newDifferences) => {
        
        const differences = monthlyAverages.slice(0, newDifferences.length).map((value, index) => newDifferences[index] - value);
        
        
        const averageDifference = differences.reduce((sum, value) => sum + value, 0) / differences.length;

        
        const nextMonths = monthlyAverages.slice(3, 6); 
        const forecasts = nextMonths.map(value => parseFloat((value + averageDifference).toFixed(2)));

        return forecasts;
    };

    
    const monthlyAverages = calculateMonthlyAverages(orders);

    
    const forecastedValues = forecastUsingMonthlyAverages(monthlyAverages, newDifferences);

    
    res.json({
        monthlyAverages,
        forecastedValues
    });
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

  exports.getCooks = async (req, res, next) => {
    try {
        
        const cooks = await User.find({ role: 'cook' }); 
        
        
        if (!cooks || cooks.length === 0) {
            return res.status(404).json({ message: 'No cooks found.' });
        }

        
        res.status(200).json({ users: cooks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred while retrieving cooks.' });
    }
};

exports.getWaiters = async (req, res, next) => {
    try {
      
      const waiters = await User.find({ role: 'waiter' });
      
      
      const waiterData = await Promise.all(waiters.map(async (waiter) => {
        
        const orders = await Order.find({ "user.userId": waiter._id });
        const orderIds = orders.map((order) => order._id);
        const tips = await Tip.find({ order: { $in: orderIds }, user: waiter._id });
        
        
        const totalTips = tips.reduce((acc, tip) => acc + tip.amount, 0);
        const averageTip = orders.length > 0 ? (totalTips / orders.length) : 0;
  
        return {
          waiterId: waiter._id,
          waiterName: waiter.name,
          totalTips,
          averageTip,
          orderCount: orders.length
        };
      }));
      
      res.status(200).json({ waiters: waiterData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Wystąpił błąd podczas pobierania kelnerów i ich średnich napiwków." });
    }
  };


exports.getDishesCountWithTopCook2 = async (req, res, next) => {
  try {
    const currentDate = new Date();
    const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
    const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
    const dayOfWeek = currentDate.getUTCDay();
    
    const weekStart = new Date(currentDate);
    weekStart.setUTCDate(currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setUTCHours(0, 0, 0, 0);
    
    const weekEnd = new Date(currentDate);
    weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
    weekEnd.setUTCHours(23, 59, 59, 999);
    
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const yearStart = new Date(currentDate.getFullYear(), 0, 1);
    const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);

    const orders = await Order.find(); 

    const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
    const cookDishCount = {};

    orders.forEach(order => {
      order.dishes.forEach(dish => {
        const doneByCookDate = new Date(dish.doneByCookDate);
        
        
        if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
          counts.today++;
        }
        if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
          counts.lastWeek++;
        }
        if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
          counts.lastMonth++;
        }
        if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
          counts.lastYear++;
        }

        
        if (dish.preparedBy) {
          const cookId = dish.preparedBy.toString();
          if (!cookDishCount[cookId]) {
            cookDishCount[cookId] = 0;
          }
          cookDishCount[cookId]++;
        }
      });
    });
    
    
    let topCookId = null;
    let maxDishesPrepared = 0;
    for (const [cookId, dishCount] of Object.entries(cookDishCount)) {
      if (dishCount > maxDishesPrepared) {
        maxDishesPrepared = dishCount;
        topCookId = cookId;
      }
    }

    res.status(200).json({
      message: 'Liczba dań w zamówieniach oraz najlepszy kucharz.',
      counts: counts,
      topCook: {
        cookId: topCookId,
        dishesPrepared: maxDishesPrepared
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby dań i najlepszego kucharza.' });
  }
};


exports.getDishesCountWithTopCook2 = async (req, res, next) => {
    try {
      const currentDate = new Date();
      const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
      const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
      const dayOfWeek = currentDate.getUTCDay();
  
      const weekStart = new Date(currentDate);
      weekStart.setUTCDate(currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setUTCHours(0, 0, 0, 0);
  
      const weekEnd = new Date(currentDate);
      weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
      weekEnd.setUTCHours(23, 59, 59, 999);
  
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  
      const orders = await Order.find(); 
  
      const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
      const cookDishCount = {};
  
      orders.forEach(order => {
        order.dishes.forEach(dish => {
          const doneByCookDate = new Date(dish.doneByCookDate);
  
          
          if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
            counts.today++;
          }
          if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
            counts.lastWeek++;
          }
          if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
            counts.lastMonth++;
          }
          if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
            counts.lastYear++;
          }
  
          
          if (dish.preparedBy) {
            const cookId = dish.preparedBy.toString();
            if (!cookDishCount[cookId]) {
              cookDishCount[cookId] = 0;
            }
            cookDishCount[cookId]++;
          }
        });
      });
  
      
      const cookRanking = Object.entries(cookDishCount)
        .map(([cookId, dishCount]) => ({ cookId, dishCount }))
        .sort((a, b) => b.dishCount - a.dishCount); 
  
      res.status(200).json({
        message: 'Liczba dań w zamówieniach oraz ranking kucharzy.',
        counts: counts,
        cookRanking: cookRanking,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.' });
    }
  };
  

  exports.getDishesCountWithTopCook3 = async (req, res, next) => {
    try {
      const currentDate = new Date();
      const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
      const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
      const dayOfWeek = currentDate.getUTCDay();
  
      const weekStart = new Date(currentDate);
      weekStart.setUTCDate(currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setUTCHours(0, 0, 0, 0);
  
      const weekEnd = new Date(currentDate);
      weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
      weekEnd.setUTCHours(23, 59, 59, 999);
  
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  
      const orders = await Order.find(); 
  
      const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
      const cookDishCount = {};
  
      orders.forEach(order => {
        order.dishes.forEach(dish => {
          const doneByCookDate = new Date(dish.doneByCookDate);
  
          
          if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
            counts.today++;
          }
          if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
            counts.lastWeek++;
          }
          if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
            counts.lastMonth++;
          }
          if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
            counts.lastYear++;
          }
  
          
          if (dish.preparedBy) {
            const cookId = dish.preparedBy.toString();
            if (!cookDishCount[cookId]) {
              cookDishCount[cookId] = 0;
            }
            cookDishCount[cookId]++;
          }
        });
      });

      console.log("Today range: ", todayStart, todayEnd);
    console.log("Week range: ", weekStart, weekEnd);
    console.log("Month range: ", monthStart, monthEnd);
    console.log("Year range: ", yearStart, yearEnd);
  
      
      const cookRanking = await Promise.all(
        Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
          const user = await User.findById(cookId).select('name'); 
          return {
            cookId,
            cookName: user ? user.name : 'Nieznany', 
            dishCount
          };
        })
      );
  
      
      cookRanking.sort((a, b) => b.dishCount - a.dishCount);
  
      res.status(200).json({
        message: 'Liczba dań w zamówieniach oraz ranking kucharzy.',
        counts: counts,
        cookRanking: cookRanking,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.' });
    }
  };
  
//dobre ale nie zwraca wszustkich inromacji o kucharzach
  exports.getDishesCountWithTopCook2 = async (req, res, next) => {
    try {
        const currentDate = new Date();
        
        
        const todayStart = new Date(currentDate.setUTCHours(0, 0, 0, 0));
        const todayEnd = new Date(currentDate.setUTCHours(23, 59, 59, 999));
        const dayOfWeek = todayStart.getUTCDay();

        const weekStart = new Date(todayStart);
        weekStart.setUTCDate(todayStart.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setUTCHours(0, 0, 0, 0);

        const weekEnd = new Date(todayStart);
        weekEnd.setUTCDate(todayStart.getUTCDate() + (7 - dayOfWeek));
        weekEnd.setUTCHours(23, 59, 59, 999);

        const monthStart = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
        const monthEnd = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0, 23, 59, 59, 999);

        const yearStart = new Date(currentDate.getUTCFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getUTCFullYear(), 11, 31, 23, 59, 59, 999);

        const orders = await Order.find(); 

        const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
        const cookDishCount = {};

        orders.forEach(order => {
            order.dishes.forEach(dish => {
                const doneByCookDate = new Date(dish.doneByCookDate);

                
                if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
                    counts.today++;
                }
                if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
                    counts.lastWeek++;
                }
                if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
                    counts.lastMonth++;
                }
                if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
                    counts.lastYear++;
                }

                
                if (dish.preparedBy) {
                    const cookId = dish.preparedBy.toString();
                    if (!cookDishCount[cookId]) {
                        cookDishCount[cookId] = 0;
                    }
                    cookDishCount[cookId]++;
                }
            });
        });

        
        console.log("Today range: ", todayStart, todayEnd);
        console.log("Week range: ", weekStart, weekEnd);
        console.log("Month range: ", monthStart, monthEnd);
        console.log("Year range: ", yearStart, yearEnd);

        
        const cookRanking = await Promise.all(
            Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
                const user = await User.findById(cookId).select('name'); 
                return {
                    cookId,
                    cookName: user ? user.name : 'Nieznany', 
                    dishCount
                };
            })
        );

        
        cookRanking.sort((a, b) => b.dishCount - a.dishCount);

        res.status(200).json({
            message: 'Liczba dań w zamówieniach oraz ranking kucharzy.',
            counts: counts,
            cookRanking: cookRanking,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.' });
    }
};

exports.getDishesCountWithTopCook = async (req, res, next) => {
    try {
        const currentDate = new Date();

        const todayStart = new Date(currentDate.setUTCHours(0, 0, 0, 0));
        const todayEnd = new Date(currentDate.setUTCHours(23, 59, 59, 999));
        const dayOfWeek = todayStart.getUTCDay();

        const weekStart = new Date(todayStart);
        weekStart.setUTCDate(todayStart.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setUTCHours(0, 0, 0, 0);

        const weekEnd = new Date(todayStart);
        weekEnd.setUTCDate(todayStart.getUTCDate() + (7 - dayOfWeek));
        weekEnd.setUTCHours(23, 59, 59, 999);

        const monthStart = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
        const monthEnd = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0, 23, 59, 59, 999);

        const yearStart = new Date(currentDate.getUTCFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getUTCFullYear(), 11, 31, 23, 59, 59, 999);

        const orders = await Order.find();

        const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
        const cookDishCount = {};

        orders.forEach(order => {
            order.dishes.forEach(dish => {
                const doneByCookDate = new Date(dish.doneByCookDate);

                if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
                    counts.today++;
                }
                if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
                    counts.lastWeek++;
                }
                if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
                    counts.lastMonth++;
                }
                if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
                    counts.lastYear++;
                }

                if (dish.preparedBy) {
                    const cookId = dish.preparedBy.toString();
                    if (!cookDishCount[cookId]) {
                        cookDishCount[cookId] = 0;
                    }
                    cookDishCount[cookId]++;
                }
            });
        });

        console.log("Today range: ", todayStart, todayEnd);
        console.log("Week range: ", weekStart, weekEnd);
        console.log("Month range: ", monthStart, monthEnd);
        console.log("Year range: ", yearStart, yearEnd);

        const cookRanking = await Promise.all(
            Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
                const user = await User.findById(cookId).select('name');
                return {
                    cookId,
                    cookName: user ? user.name : 'Nieznany',
                    dishCount
                };
            })
        );

        cookRanking.sort((a, b) => b.dishCount - a.dishCount);

        // Pobranie użytkowników z rolą "cook"
        const cooks = await User.find({ role: 'cook' }).select('name email');

        res.status(200).json({
            message: 'Liczba dań w zamówieniach oraz ranking kucharzy.',
            counts: counts,
            cookRanking: cookRanking,
            cooks: cooks, // dodanie użytkowników z rolą "cook"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.' });
    }
};

//ta dziala ale hest wolna
// function parseCustomDate(dateString) {
//     if (!dateString || typeof dateString !== 'string') return null;

//     const [day, month, year] = dateString.split('.');  // Rozdzielamy dzień, miesiąc i rok

//     return new Date(
//         parseInt(year),        // Rok
//         parseInt(month) - 1,   // Miesiąc (0-based)
//         parseInt(day)          // Dzień
//     );
// }

// exports.getTotalProfitLast7Days = async (req, res, next) => {
//     try {
//         const sevenDaysAgo = new Date();
//         sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//         // Pobierz zamówienia, które mają datę zamówienia
//         const recentOrders = await Order.find({ orderDate: { $exists: true } });
//         let totalProfit = 0;

//         for (const order of recentOrders) {
//             // Pomijamy zamówienia z nieprawidłowym `orderDate`
//             if (!order.orderDate || typeof order.orderDate !== 'string') continue;

//             const orderDate = parseCustomDate(order.orderDate);
//             if (!orderDate || orderDate < sevenDaysAgo) continue; // Pomijamy zamówienia starsze niż 7 dni

//             for (const dishItem of order.dishes) {
//                 const dish = await Dish.findById(dishItem.dish._id);

//                 if (!dish) continue;

//                 const dishPrice = dish.price;
//                 const ingredientTemplates = dish.ingredientTemplates;
//                 let totalIngredientCost = 0;

//                 for (const template of ingredientTemplates) {
//                     const ingredientName = template.ingredient.name;
//                     const weightInDish = parseFloat(template.weight);

//                     const ingredients = await Ingredient.find({ name: ingredientName });
//                     if (ingredients.length === 0) continue;

//                     const totalPrice = ingredients.reduce((sum, ing) => sum + ing.price, 0);
//                     const averagePrice = totalPrice / ingredients.length;
//                     const ingredientCostForDish = averagePrice * (weightInDish / 100);
//                     totalIngredientCost += ingredientCostForDish;
//                 }

//                 const dishProfit = (dishPrice - totalIngredientCost) * dishItem.quantity;
//                 totalProfit += dishProfit;
//             }
//         }

//         return res.status(200).json({
//             message: 'Całkowity zysk w ostatnich 7 dniach',
//             totalProfit: totalProfit.toFixed(2)
//         });
//     } catch (err) {
//         console.log(err);
//         return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania zysku.' });
//     }
// };

// Funkcja pomocnicza do parsowania daty tutaj dziala szybciej ale chuj wie czy dobrze zwracz
function parseCustomDate(dateString) {
    const [day, month, year] = dateString.split('.');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

exports.getTotalProfitLast7Days = async (req, res, next) => {
    try {
        // Oblicz datę sprzed 7 dni
        const today = new Date();
        const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);

        // Pobierz zamówienia, które mają datę w ostatnich 7 dniach
        const recentOrders = await Order.find({ orderDate: { $exists: true } });
        
        // Filtruj zamówienia według daty i formatu
        const validOrders = recentOrders.filter(order => {
            if (!order.orderDate || typeof order.orderDate !== 'string') return false;
            const orderDate = parseCustomDate(order.orderDate.split(" ")[0]); // Ignoruj godziny
            return orderDate >= sevenDaysAgo;
        });

        // Pobierz wszystkie unikalne potrawy z zamówień
        const dishIds = [...new Set(validOrders.flatMap(order => order.dishes.map(dishItem => dishItem.dish._id)))];
        const dishes = await Dish.find({ _id: { $in: dishIds } });

        // Mapuj potrawy po ich ID, aby łatwo je pobrać
        const dishMap = {};
        dishes.forEach(dish => dishMap[dish._id] = dish);

        // Pobierz unikalne składniki z potraw
        const ingredientNames = [...new Set(dishes.flatMap(dish => dish.ingredientTemplates.map(template => template.ingredient.name)))];
        const ingredients = await Ingredient.find({ name: { $in: ingredientNames } });

        // Oblicz średnie ceny składników
        const ingredientPriceMap = {};
        ingredientNames.forEach(name => {
            const ing = ingredients.filter(ingredient => ingredient.name === name);
            const avgPrice = ing.reduce((sum, ing) => sum + ing.price, 0) / ing.length;
            ingredientPriceMap[name] = avgPrice;
        });

        // Oblicz całkowity zysk
        let totalProfit = 0;

        for (const order of validOrders) {
            for (const dishItem of order.dishes) {
                const dish = dishMap[dishItem.dish._id];
                if (!dish) continue;

                const dishPrice = dish.price;
                const ingredientTemplates = dish.ingredientTemplates;

                // Oblicz koszt składników dla danej potrawy
                let totalIngredientCost = 0;
                for (const template of ingredientTemplates) {
                    const avgPrice = ingredientPriceMap[template.ingredient.name];
                    const weightInDish = parseFloat(template.weight);
                    const ingredientCostForDish = avgPrice * (weightInDish / 100);
                    totalIngredientCost += ingredientCostForDish;
                }

                // Oblicz zysk dla danej potrawy
                const dishProfit = (dishPrice - totalIngredientCost) * dishItem.quantity;
                totalProfit += dishProfit;
            }
        }

        return res.status(200).json({
            message: 'Całkowity zysk w ostatnich 7 dniach',
            totalProfit: totalProfit.toFixed(2)
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania zysku.' });
    }
};

exports.calculateWithCustomizations = async (req, res, next) => {
    try {
        const dishId = req.params.dishId;
        const customWeights = req.body.customWeights || {};  // { ingredientName: newWeight }
        const newPrice = req.body.newPrice !== undefined ? parseFloat(req.body.newPrice) : null;

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

        const originalPrice = dish.price;
        const dishPrice = newPrice || originalPrice; // Jeśli nowa cena jest podana, używamy jej; w przeciwnym razie oryginalną cenę
        const ingredientCosts = {};
        let totalIngredientCost = 0;

        for (const ingTemplate of dish.ingredientTemplates) {
            const ingredientName = ingTemplate.ingredient.name;
            const originalWeightInDish = parseFloat(ingTemplate.weight);
            const customWeightInDish = customWeights[ingredientName] !== undefined
                ? parseFloat(customWeights[ingredientName])
                : originalWeightInDish;

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
            const ingredientCostInDish = averagePricePerGram * customWeightInDish;

            ingredientCosts[ingredientName] = {
                weightInDish: customWeightInDish.toFixed(2),
                cost: ingredientCostInDish.toFixed(2),
                percentage: ((ingredientCostInDish / dishPrice) * 100).toFixed(2)
            };

            totalIngredientCost += ingredientCostInDish;
        }

        const profitMargin = ((dishPrice - totalIngredientCost) / dishPrice) * 100;

        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);

        const formatDate = date => {
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const year = date.getFullYear();
            return `${month}.${day}.${year}`;
        };

        const dayNames = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
        const recentOrders = await Order.find({
            orderDate: {
                $gte: formatDate(sevenDaysAgo),
                $lte: formatDate(today)
            }
        });

        let dishQuantity = 0;
        const dailyRevenue = Array(7).fill(0).map((_, i) => ({
            dayName: dayNames[(today.getDay() + i - 6 + 7) % 7],
            revenue: 0,
            quantity: 0
        }));

        recentOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

            if (daysAgo >= 0 && daysAgo < 7) {
                order.dishes.forEach(dishItem => {
                    if (dishItem.dish._id.equals(objectIdDishId)) {
                        const revenueForDish = dishItem.quantity * dishPrice * (profitMargin / 100);
                        dailyRevenue[6 - daysAgo].revenue += revenueForDish;
                        dailyRevenue[6 - daysAgo].quantity += dishItem.quantity;
                        dishQuantity += dishItem.quantity;
                    }
                });
            }
        });

        const totalRevenueLastWeek = dailyRevenue.reduce((acc, day) => acc + day.revenue, 0);

        return res.status(200).json({
            dishName: dish.name,
            dishPrice: dishPrice,
            ingredients: ingredientCosts,
            profitMargin: profitMargin.toFixed(2),
            totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
            totalQuantityLastWeek: dishQuantity,
            dailyRevenue: dailyRevenue.map(day => ({
                dayName: day.dayName,
                revenue: day.revenue.toFixed(2),
                quantity: day.quantity
            }))
        });

    } catch (err) {
        console.error('Błąd podczas obliczania kosztów składników, marży i przychodu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.' });
    }
};

exports.updateDish = async (req, res) => {
    const { dishId } = req.params;
    const { newPrice, customWeights } = req.body;

    try {
        // Znajdź danie w bazie danych
        const dish = await Dish.findById(dishId);

        if (!dish) {
            return res.status(404).json({ message: 'Danie nie zostało znalezione.' });
        }

        // Ustaw nową cenę, jeśli została podana
        if (newPrice) {
            dish.price = newPrice;
        }

        // Zaktualizuj składniki i ich wagi
        if (customWeights) {
            dish.ingredientTemplates.forEach(template => {
                if (customWeights[template.ingredient.name]) {
                    template.weight = customWeights[template.ingredient.name]; // Zakładając, że 'name' jest polem w obiekcie ingredient
                }
            });
        }

        // Zapisz zmiany
        await dish.save();

        return res.status(200).json({
            message: 'Danie zaktualizowane pomyślnie.',
            dish,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Wystąpił błąd przy aktualizacji dania.' });
    }
};
