const Order = require("../models/order");
const Dish = require("../models/dish");
const User = require("../models/user");
const Ingredient = require("../models/ingredient");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const Tip = require("../models/tip");

exports.calculateIngredientWasteProbability = async (req, res, next) => {
  try {
    const ingredientName = req.params.ingredientName;
    const ingredients = await Ingredient.find({ name: ingredientName });

    if (!ingredients || ingredients.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono składnika." });
    }

    const today = new Date();
    let expirationDate = null;

    const totalWeightOfIngredient = ingredients.reduce(
      (acc, ingredient) => acc + ingredient.weight,
      0
    );

    ingredients.forEach((ingredient) => {
      if (ingredient.expirationDate) {
        const expDate = new Date(ingredient.expirationDate);
        if (!expirationDate || expDate < expirationDate) {
          expirationDate = expDate;
        }
      }
    });

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const last30DaysOrders = await Order.find({
      orderDate: { $exists: true },
    });

    const filteredOrders = last30DaysOrders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= thirtyDaysAgo && orderDate < today;
    });

    if (filteredOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "Brak zamówień z ostatnich 30 dni." });
    }

    let totalUsage = 0;

    filteredOrders.forEach((order) => {
      order.dishes.forEach((dishItem) => {
        const dish = dishItem.dish;

        if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;

        dish.ingredientTemplates.forEach((ingTemplate) => {
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
        message: "Składnik nie był używany w ostatnich 30 dniach.",
        daysUntilOutOfStock: "Nieskończoność",
        shortageProbability: "N/A",
        wastedWeight: "0",
        wastedValue: "0",
        totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2),
      });
    }

    const daysUntilOutOfStock = totalWeightOfIngredient / averageDailyUsage;

    let daysUntilExpiration = null;
    if (expirationDate) {
      daysUntilExpiration = Math.ceil(
        (expirationDate - today) / (1000 * 60 * 60 * 24)
      );
    }

    let shortageProbability = 0;
    if (daysUntilOutOfStock <= daysUntilExpiration) {
      shortageProbability =
        (1 - daysUntilOutOfStock / daysUntilExpiration) * 100;
    }

    let wastedWeight = 0;
    let wastedValue = 0;

    if (daysUntilExpiration && daysUntilOutOfStock > daysUntilExpiration) {
      wastedWeight = Math.max(
        0,
        averageDailyUsage * (daysUntilOutOfStock - daysUntilExpiration)
      );
      wastedWeight = Math.min(wastedWeight, totalWeightOfIngredient);
      const priceRatio = ingredients[0].priceRatio || 0;
      wastedValue = wastedWeight * priceRatio;
    }

    return res.status(200).json({
      ingredientName: ingredientName,
      averageDailyUsage: averageDailyUsage.toFixed(2),
      daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
      daysUntilExpiration:
        daysUntilExpiration !== null
          ? daysUntilExpiration.toFixed(2)
          : "Brak daty wygaśnięcia",
      shortageProbability: shortageProbability.toFixed(2) + "%",
      wastedWeight: wastedWeight.toFixed(2),
      wastedValue: wastedValue.toFixed(2),
      totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania." });
  }
};

exports.calculateIngredientWasteProbabilitydziala = async (req, res, next) => {
  try {
    const ingredientName = req.params.ingredientName;
    const ingredients = await Ingredient.find({ name: ingredientName });

    if (!ingredients || ingredients.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono składnika." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let expirationDate = null;

    const totalWeightOfIngredient = ingredients.reduce(
      (acc, ingredient) => acc + ingredient.weight,
      0
    );

    ingredients.forEach((ingredient) => {
      if (ingredient.expirationDate) {
        const expDate = new Date(ingredient.expirationDate);
        if (!expirationDate || expDate < expirationDate) {
          expirationDate = expDate;
        }
      }
    });

    console.log(
      `Składnik: ${ingredientName}, Całkowita ilość: ${totalWeightOfIngredient}`
    );

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    console.log(
      `Pobieranie zamówień z okresu: ${thirtyDaysAgo.toISOString()} - ${today.toISOString()}`
    );

    const last30DaysOrders = await Order.find({
      orderDate: { $gte: thirtyDaysAgo, $lt: today },
    });

    console.log(`Znalezione zamówienia: ${last30DaysOrders.length}`);

    if (last30DaysOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "Brak zamówień z ostatnich 30 dni." });
    }

    let totalUsage = 0;

    last30DaysOrders.forEach((order) => {
      console.log(`Zamówienie ID: ${order._id}, Data: ${order.orderDate}`);

      order.dishes.forEach((dishItem) => {
        const dish = dishItem.dish;

        if (!dish || !dish.ingredientTemplates || !dish.isAvailable) return;

        dish.ingredientTemplates.forEach((ingTemplate) => {
          const ingredientInDish = ingTemplate.ingredient;

          if (ingredientInDish.name === ingredientName) {
            console.log(
              `Znaleziono składnik: ${ingredientInDish.name}, Zużycie na danie: ${ingTemplate.weight}, Ilość dań: ${dishItem.quantity}`
            );
            totalUsage += parseFloat(ingTemplate.weight) * dishItem.quantity;
          }
        });
      });
    });

    console.log(
      `Całkowite zużycie składnika ${ingredientName} w ostatnich 30 dniach: ${totalUsage}`
    );

    const averageDailyUsage = totalUsage / 30;

    console.log(
      `Średnie dzienne zużycie składnika ${ingredientName}: ${averageDailyUsage.toFixed(
        2
      )}`
    );

    if (averageDailyUsage === 0) {
      return res.status(200).json({
        message: "Składnik nie był używany w ostatnich 30 dniach.",
        daysUntilOutOfStock: "Nieskończoność",
        shortageProbability: "0%",
        totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2),
      });
    }

    const daysUntilOutOfStock = totalWeightOfIngredient / averageDailyUsage;

    console.log(
      `Składnik ${ingredientName} wystarczy na: ${daysUntilOutOfStock.toFixed(
        2
      )} dni`
    );

    let daysUntilExpiration = null;
    if (expirationDate) {
      daysUntilExpiration = Math.ceil(
        (expirationDate - today) / (1000 * 60 * 60 * 24)
      );
      console.log(`Days Until Expiration: ${daysUntilExpiration}`);
    } else {
      console.log(`Brak daty wygaśnięcia dla składnika ${ingredientName}`);
    }

    let shortageProbability = 0;
    if (daysUntilExpiration && daysUntilOutOfStock < daysUntilExpiration) {
      const deficitDays = daysUntilExpiration - daysUntilOutOfStock;
      shortageProbability = Math.min(
        100,
        (deficitDays / daysUntilExpiration) * 100
      );
    }

    return res.status(200).json({
      ingredientName: ingredientName,
      averageDailyUsage: averageDailyUsage.toFixed(2),
      daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
      daysUntilExpiration:
        daysUntilExpiration !== null
          ? daysUntilExpiration.toFixed(2)
          : "Brak daty wygaśnięcia",
      shortageProbability: shortageProbability.toFixed(2) + "%",
      totalWeightOfIngredient: totalWeightOfIngredient.toFixed(2),
    });
  } catch (err) {
    console.error("Wystąpił błąd:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania." });
  }
};

exports.calculateMonthlyOrderDifferences = (req, res, next) => {
  try {
    const orders = [
      100, 120, 90, 105, 130, 110, 100, 150, 140, 120, 135, 125, 105, 115, 95,
      110, 140, 130, 110, 160, 145, 130, 150, 140,
    ];

    const differences = [];
    for (let i = 0; i < orders.length - 1; i++) {
      differences[i] = (orders[i + 1] / orders[i]) * 100;
    }

    const previousYears = [];
    for (let i = 0; i < 12; i++) {
      previousYears[i] = (orders[i] + orders[i + 12]) / 2;
    }

    const currentYear = [110, 130, 85, 125];

    let totalDifference = 0;
    for (let i = 0; i < currentYear.length; i++) {
      const difference = currentYear[i] - previousYears[i];
      totalDifference += difference;
    }

    const actualDifference = totalDifference / currentYear.length;

    const updatedPredictions = previousYears.map(
      (monthlyOrder) => monthlyOrder + actualDifference
    );

    res.status(200).json({
      message: "Obliczenia zakończone sukcesem.",
      orders,
      differences,
      previousYears,
      currentYear,
      updatedPredictions,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania prognoz zamówień." });
  }
};

exports.getCooks = async (req, res, next) => {
  try {
    const cooks = await User.find({ role: "cook" });

    if (!cooks || cooks.length === 0) {
      return res.status(404).json({ message: "No cooks found." });
    }

    res.status(200).json({ users: cooks });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving cooks." });
  }
};


exports.getWaiters = async (req, res, next) => {
    try {
      // Pobranie wszystkich kelnerów
      const waiters = await User.find({ role: "waiter" });
  
      const waiterData = await Promise.all(
        waiters.map(async (waiter) => {
          // Pobranie wszystkich zamówień przypisanych do danego kelnera
          const orders = await Order.find({ "user.userId": waiter._id });
  
          // Pobranie identyfikatorów zamówień, upewnij się, że są to ObjectId
          const orderIds = orders.map(order => new mongoose.Types.ObjectId(order._id));
          console.log("Converted Order IDs:", orderIds);
          console.log("Waiter user._id:", waiter._id);
  
          // Pobranie napiwków powiązanych z tymi zamówieniami i tym kelnerem
          const tips = await Tip.find({
            order: { $in: orderIds.map(id => id.toString()) }, // Nie potrzebujemy używać new, przekazujemy bezpośrednio stringi
            user: waiter._id.toString() // Tak samo tutaj, przekazujemy bezpośrednio jako string
          });
  
          console.log("Tips for waiter:", tips);
  
          // Obliczanie sumy napiwków
          const totalTips = tips.reduce((acc, tip) => acc + tip.amount, 0);
          // Obliczanie średniego napiwku
          const averageTip = orders.length > 0 ? totalTips / orders.length : 0;
  
          // Zwracanie danych dla kelnera
          return {
            waiterId: waiter._id,
            waiterName: waiter.name,
            surname: waiter.surname,
            totalTips,
            averageTip,
            image: waiter.image,
            orderCount: orders.length,
          };
        })
      );
  
      // Zwracanie wyników
      res.status(200).json({ waiters: waiterData });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Wystąpił błąd podczas pobierania kelnerów i ich średnich napiwków.",
      });
    }
  };
  

exports.getWaiters3 = async (req, res, next) => {
    try {
      // Pobierz wszystkich użytkowników o roli "waiter"
      const waiters = await User.find({ role: "waiter" });
  
      // Przetwórz dane dla każdego kelnera
      const waiterData = await Promise.all(
        waiters.map(async (waiter) => {
          // Znajdź wszystkie zamówienia obsługiwane przez danego kelnera
          const orders = await Order.find({ "user.userId": waiter._id });
  
          // Pobierz wszystkie napiwki przypisane do zamówień tego kelnera
          const tips = await Tip.find({
            order: { $in: orders.map(order => order._id) }, // Powiązane zamówienia
          });

          
          
          console.log(orders)

          // Oblicz całkowitą sumę napiwków kelnera
          const totalTips = tips.reduce((acc, tip) => acc + tip.amount, 0);
  
          // Oblicz średni napiwek na zamówienie
          const averageTip =
            orders.length > 0 ? totalTips / orders.length : 0;
  
          // Zwróć dane o kelnerze
          return {
            waiterId: waiter._id,
            waiterName: waiter.name,
            surname: waiter.surname,
            totalTips,
            averageTip,
            image: waiter.image,
            orderCount: orders.length,
          };
        })
      );
  
      // Zwróć odpowiedź z danymi
      res.status(200).json({ waiters: waiterData });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Wystąpił błąd podczas pobierania kelnerów i ich średnich napiwków.",
      });
    }
  };
  
  

exports.getWaiters2 = async (req, res, next) => {
  try {
    const waiters = await User.find({ role: "waiter" });

    const waiterData = await Promise.all(
      waiters.map(async (waiter) => {
        const orders = await Order.find({ "user.userId": waiter._id });
        const orderIds = orders.map((order) => order._id);
        const tips = await Tip.find({
          order: { $in: orderIds },
          user: waiter._id,
        });

        const totalTips = tips.reduce((acc, tip) => acc + tip.amount, 0);
        const averageTip = orders.length > 0 ? totalTips / orders.length : 0;

        return {
          waiterId: waiter._id,
          waiterName: waiter.name,
          surname: waiter.surname,
          totalTips,
          averageTip,
          image: waiter.image,
          orderCount: orders.length,
        };
      })
    );

    res.status(200).json({ waiters: waiterData });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message:
        "Wystąpił błąd podczas pobierania kelnerów i ich średnich napiwków.",
    });
  }
};


exports.getDishesCountWithTopCook = async (req, res, next) => {
    try {
      const currentDate = new Date();
  
      // Ustawienie początkowej i końcowej daty dla dzisiaj
      const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
      const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
      const dayOfWeek = todayStart.getDay();
  
      // Ustawienie daty początkowej i końcowej tygodnia
      const weekStart = new Date(todayStart);
      weekStart.setDate(todayStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);
  
      const weekEnd = new Date(todayStart);
      weekEnd.setDate(todayStart.getDate() + (7 - dayOfWeek));
      weekEnd.setHours(23, 59, 59, 999);
  
      // Ustawienie daty początkowej i końcowej miesiąca
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
      // Ustawienie daty początkowej i końcowej roku
    //   const yearStart = new Date(currentDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);

      const today = new Date();
        let yearStart = new Date(today);
        yearStart.setMonth(today.getMonth() - 12); // 12 miesięcy wstecz
        yearStart.setDate(1); 
  
      const orders = await Order.find();
  
      const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
      const cookDishCount = {};
  
      orders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const doneByCookDate = new Date(dish.doneByCookDate);
  
          if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
            counts.today += dish.quantity;
          }
          if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
            counts.lastWeek += dish.quantity;
          }
          if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
            counts.lastMonth += dish.quantity;
          }
          if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
            counts.lastYear += dish.quantity;
          }
  
          if (dish.preparedBy) {
            const cookId = dish.preparedBy.toString();
            if (!cookDishCount[cookId]) {
              cookDishCount[cookId] = 0;
            }
            cookDishCount[cookId] += dish.quantity;
          }
        });
      });
  
      console.log("Today range: ", todayStart, todayEnd);
      console.log("Week range: ", weekStart, weekEnd);
      console.log("Month range: ", monthStart, monthEnd);
      console.log("Year range: ", yearStart, yearEnd);
  
      const cookRanking = await Promise.all(
        Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
          const user = await User.findById(cookId).select("name");
          return {
            cookId,
            cookName: user ? user.name : "Nieznany",
            dishCount,
          };
        })
      );
  
      cookRanking.sort((a, b) => b.dishCount - a.dishCount);
  
      const cooks = await User.find({ role: "cook" }).select("name email");
  
      res.status(200).json({
        message: "Liczba dań w zamówieniach oraz ranking kucharzy.",
        counts: counts,
        cookRanking: cookRanking,
        cooks: cooks,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.",
      });
    }
  };
  

exports.getDishesCountWithTopCook3001 = async (req, res, next) => {
    try {
      const currentDate = new Date();
  
      const todayStart = new Date(currentDate.setUTCHours(0, 0, 0, 0));
      const todayEnd = new Date(currentDate.setUTCHours(23, 59, 59, 999));
      const dayOfWeek = todayStart.getUTCDay();
  
      const weekStart = new Date(todayStart);
      weekStart.setUTCDate(
        todayStart.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
      );
      weekStart.setUTCHours(0, 0, 0, 0);
  
      const weekEnd = new Date(todayStart);
      weekEnd.setUTCDate(todayStart.getUTCDate() + (7 - dayOfWeek));
      weekEnd.setUTCHours(23, 59, 59, 999);
  
      const monthStart = new Date(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        1
      );
      const monthEnd = new Date(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
  
      const yearStart = new Date(currentDate.getUTCFullYear(), 0, 1);
      const yearEnd = new Date(
        currentDate.getUTCFullYear(),
        11,
        31,
        23,
        59,
        59,
        999
      );
  
      const orders = await Order.find();
  
      const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
      const cookDishCount = {};
  
      orders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const doneByCookDate = new Date(dish.doneByCookDate);
  
          if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
            counts.today += dish.quantity;
          }
          if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
            counts.lastWeek += dish.quantity;
          }
          if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
            counts.lastMonth += dish.quantity;
          }
          if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
            counts.lastYear += dish.quantity;
          }
  
          if (dish.preparedBy) {
            const cookId = dish.preparedBy.toString();
            if (!cookDishCount[cookId]) {
              cookDishCount[cookId] = 0;
            }
            cookDishCount[cookId] += dish.quantity;
          }
        });
      });
  
      console.log("Today range: ", todayStart, todayEnd);
      console.log("Week range: ", weekStart, weekEnd);
      console.log("Month range: ", monthStart, monthEnd);
      console.log("Year range: ", yearStart, yearEnd);
  
      const cookRanking = await Promise.all(
        Object.entries(cookDishCount).map(async ([cookId, dishCount]) => {
          const user = await User.findById(cookId).select("name");
          return {
            cookId,
            cookName: user ? user.name : "Nieznany",
            dishCount,
          };
        })
      );
  
      cookRanking.sort((a, b) => b.dishCount - a.dishCount);
  
      const cooks = await User.find({ role: "cook" }).select("name email");
  
      res.status(200).json({
        message: "Liczba dań w zamówieniach oraz ranking kucharzy.",
        counts: counts,
        cookRanking: cookRanking,
        cooks: cooks,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message:
          "Wystąpił błąd podczas pobierania liczby dań i rankingu kucharzy.",
      });
    }
  };
  
  

exports.calculateWithCustomizations = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;
    const customWeights = req.body.customWeights || {};
    const newPrice =
      req.body.newPrice !== undefined ? parseFloat(req.body.newPrice) : null;

    let objectIdDishId;
    try {
      objectIdDishId = new mongoose.Types.ObjectId(dishId);
    } catch (err) {
      const error = new HttpError("Invalid dishId format.", 400);
      return next(error);
    }

    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    const originalPrice = dish.price;
    const dishPrice = newPrice || originalPrice;
    const ingredientCosts = {};
    let totalIngredientCost = 0;

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const originalWeightInDish = parseFloat(ingTemplate.weight);
      const customWeightInDish =
        customWeights[ingredientName] !== undefined
          ? parseFloat(customWeights[ingredientName])
          : originalWeightInDish;

      const matchingIngredients = await Ingredient.find({
        name: ingredientName,
      });
      if (matchingIngredients.length === 0) {
        ingredientCosts[ingredientName] = "Brak danych";
        continue;
      }

      let totalCost = 0;
      let totalWeight = 0;

      matchingIngredients.forEach((ingredient) => {
        totalCost += ingredient.price;
        totalWeight += ingredient.weight;
      });

      const averagePricePerGram = totalCost / totalWeight;
      const ingredientCostInDish = averagePricePerGram * customWeightInDish;

      ingredientCosts[ingredientName] = {
        weightInDish: customWeightInDish.toFixed(2),
        cost: ingredientCostInDish.toFixed(2),
        percentage: ((ingredientCostInDish / dishPrice) * 100).toFixed(2),
      };

      totalIngredientCost += ingredientCostInDish;
    }

    const profitMargin = ((dishPrice - totalIngredientCost) / dishPrice) * 100;

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const formatDate = (date) => {
      const month = ("0" + (date.getMonth() + 1)).slice(-2);
      const day = ("0" + date.getDate()).slice(-2);
      const year = date.getFullYear();
      return `${month}.${day}.${year}`;
    };

    const dayNames = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
    const recentOrders = await Order.find({
      orderDate: {
        $gte: formatDate(sevenDaysAgo),
        $lte: formatDate(today),
      },
    });

    let dishQuantity = 0;
    const dailyRevenue = Array(7)
      .fill(0)
      .map((_, i) => ({
        dayName: dayNames[(today.getDay() + i - 6 + 7) % 7],
        revenue: 0,
        quantity: 0,
      }));

    recentOrders.forEach((order) => {
      const orderDate = new Date(order.orderDate);
      const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

      if (daysAgo >= 0 && daysAgo < 7) {
        order.dishes.forEach((dishItem) => {
          if (dishItem.dish._id.equals(objectIdDishId)) {
            const revenueForDish =
              dishItem.quantity * dishPrice * (profitMargin / 100);
            dailyRevenue[6 - daysAgo].revenue += revenueForDish;
            dailyRevenue[6 - daysAgo].quantity += dishItem.quantity;
            dishQuantity += dishItem.quantity;
          }
        });
      }
    });

    const totalRevenueLastWeek = dailyRevenue.reduce(
      (acc, day) => acc + day.revenue,
      0
    );

    return res.status(200).json({
      dishName: dish.name,
      dishPrice: dishPrice,
      ingredients: ingredientCosts,
      profitMargin: profitMargin.toFixed(2),
      totalRevenueLastWeek: totalRevenueLastWeek.toFixed(2),
      totalQuantityLastWeek: dishQuantity,
      dailyRevenue: dailyRevenue.map((day) => ({
        dayName: day.dayName,
        revenue: day.revenue.toFixed(2),
        quantity: day.quantity,
      })),
    });
  } catch (err) {
    console.error(
      "Błąd podczas obliczania kosztów składników, marży i przychodu:",
      err
    );
    return res.status(500).json({
      message:
        "Wystąpił błąd podczas obliczania kosztów składników, marży i przychodu.",
    });
  }
};

exports.updateDish = async (req, res) => {
  const { dishId } = req.params;
  const { newPrice, customWeights } = req.body;

  try {
    const dish = await Dish.findById(dishId);

    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    if (newPrice) {
      dish.price = newPrice;
    }

    if (customWeights) {
      dish.ingredientTemplates.forEach((template) => {
        if (customWeights[template.ingredient.name]) {
          template.weight = customWeights[template.ingredient.name];
        }
      });
    }

    await dish.save();

    return res.status(200).json({
      message: "Danie zaktualizowane pomyślnie.",
      dish,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd przy aktualizacji dania." });
  }
};
