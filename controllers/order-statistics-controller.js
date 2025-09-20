const Order = require("../models/order");
const Dish = require("../models/dish");
const User = require("../models/user");
const Ingredient = require("../models/ingredient");

exports.getMostPopularDishes = (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate;
  const period = req.body.periodMostPopular || "tydzien";

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setDate(1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  Order.find({})
    .then((orders) => {
      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= startDate && orderDate <= today;
      });

      if (filteredOrders.length === 0) {
        return res
          .status(404)
          .json({ message: `Brak zamówień z ostatniego okresu: ${period}.` });
      }

      const dishStats = {};
      filteredOrders.forEach((order) => {
        order.dishes.forEach((dishItem) => {
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
          revenue: stats.revenue.toFixed(2),
        }));

      let mostPopularDish = null;
      let maxCount = 0;
      let maxRevenue = 0;

      if (sortedDishes.length > 0) {
        mostPopularDish = sortedDishes[0].name;
        maxCount = sortedDishes[0].count;
        maxRevenue = sortedDishes[0].revenue;
      }

      const result = {
        message: `Lista 7 najpopularniejszych dań z ostatniego okresu: ${period}.`,
        mostPopularDish: mostPopularDish,
        mostPopularDishCount: maxCount,
        mostPopularDishRevenue: maxRevenue,
        topDishes: sortedDishes,
      };

      res.status(200).json(result);
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ message: "Wystąpił błąd podczas pobierania danych." });
    });
};

exports.getDishPercentage = (req, res, next) => {
  const period = req.body.periodPercentage || "tydzien";
  console.log("przychod");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate;
  switch (period) {
    case "miesiac":
      startDate = new Date(today);
      startDate.setDate(1);
      break;
    case "rok":
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
      break;
    case "tydzien":
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
      break;
  }

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  Order.find({
    orderDate: { $gte: startDate, $lt: endOfToday },
  })
    .then((orders) => {
      const dishCount = {};
      let totalDishes = 0;

      orders.forEach((order) => {
        order.dishes.forEach((dishItem) => {
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
        dishPercentage[dishName] = parseFloat(
          ((dishCount[dishName] / totalDishes) * 100).toFixed(2)
        );
      }

      const topDishes = Object.entries(dishPercentage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .reduce((acc, [name, percentage]) => {
          acc[name] = percentage;
          return acc;
        }, {});

      res.status(200).json({ dishPercentage: topDishes });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Wystąpił błąd." });
    });
};

exports.getOrdersStats = (req, res, next) => {
  const today = new Date();
  let startDate;
  const period = req.body.periodTotal || "rok";

  let dataCount = [];
  let labels = [];

  if (period === "rok") {
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    dataCount = Array(12).fill(0);
    labels = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = (today.getMonth() - 11 + i + 12) % 12;
      return monthIndex + 1;
    });

    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    Order.find({
      orderDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= endDate) {
            const diffMonths =
              (orderDate.getFullYear() - startDate.getFullYear()) * 12 +
              orderDate.getMonth() -
              startDate.getMonth();
            if (diffMonths >= 0 && diffMonths < 12) {
              dataCount[diffMonths]++;
            }
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        res.status(200).json({
          message: `Statystyki zamówień z ostatnich 12 miesięcy.`,
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = today.getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    Order.find({ orderDate: { $gte: startDate, $lte: today } })
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego miesiąca.`,
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);

    labels = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      return day.toLocaleDateString("pl-PL", { weekday: "short" });
    });

    dataCount = Array(7).fill(0);

    Order.find({ orderDate: { $gte: startDate, $lte: today } })
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            if (dayIndex >= 0 && dayIndex < 7) {
              dataCount[dayIndex]++;
            }
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego tygodnia.`,
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else {
    res.status(400).json({
      message: "Invalid period. Choose 'rok', 'miesiac', or 'tydzien'.",
    });
  }
};

exports.getTotalProfit2 = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log("procenty");
    let startDate;
    const period = req.body.periodPercentage || "tydzien";

    if (period === "tydzien") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === "miesiac") {
      startDate = new Date(today);
      startDate.setDate(1);
    } else if (period === "rok") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const recentOrders = await Order.find({
      orderDate: { $gte: startDate, $lt: endOfToday },
    });

    console.log(
      `Znalezione zamówienia z okresu '${period}':`,
      recentOrders.length
    );

    const dishIds = [
      ...new Set(
        recentOrders.flatMap((order) =>
          order.dishes.map((dishItem) => dishItem.dish._id)
        )
      ),
    ];
    const dishes = await Dish.find({ _id: { $in: dishIds } });

    const dishMap = {};
    dishes.forEach((dish) => {
      dishMap[dish._id] = dish;
    });

    const ingredientNames = [
      ...new Set(
        dishes.flatMap((dish) =>
          dish.ingredientTemplates.map((template) => template.ingredient.name)
        )
      ),
    ];
    const ingredients = await Ingredient.find({
      name: { $in: ingredientNames },
    });

    const ingredientPriceMap = {};
    ingredientNames.forEach((name) => {
      const relevantIngredients = ingredients.filter(
        (ingredient) => ingredient.name === name
      );

      const avgPriceRatio =
        relevantIngredients.reduce(
          (sum, ingredient) => sum + ingredient.priceRatio,
          0
        ) / relevantIngredients.length;
      ingredientPriceMap[name] = avgPriceRatio;
    });

    let totalProfit = 0;

    for (const order of recentOrders) {
      for (const dishItem of order.dishes) {
        const dish = dishMap[dishItem.dish._id];
        if (!dish) continue;

        const dishPrice = dish.price;
        const ingredientTemplates = dish.ingredientTemplates;

        let totalIngredientCost = 0;

        for (const template of ingredientTemplates) {
          const ingredient = template.ingredient;
          const avgPriceRatio = ingredientPriceMap[ingredient.name];

          const weightInDish = parseFloat(template.weight);
          const ingredientCostForDish = avgPriceRatio * weightInDish;
          totalIngredientCost += ingredientCostForDish;
        }

        const dishProfit =
          (dishPrice - totalIngredientCost) * dishItem.quantity;
        totalProfit += dishProfit;
      }
    }

    console.log("Całkowity zysk:", totalProfit);

    return res.status(200).json({
      message: `Całkowity zysk w ostatnim okresie: ${period}`,
      totalProfit: totalProfit.toFixed(2),
    });
  } catch (err) {
    console.log("Błąd:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania zysku." });
  }
};

exports.getTotalProfit = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log("procenty");
    let startDate;
    const period = req.body.periodPercentage || "tydzien";

    if (period === "tydzien") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === "miesiac") {
      startDate = new Date(today);
      startDate.setDate(1);
    } else if (period === "rok") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const recentOrders = await Order.find({
      orderDate: { $gte: startDate, $lt: endOfToday },
    });

    console.log(
      `Znalezione zamówienia z okresu '${period}':`,
      recentOrders.length
    );

    const dishIds = [
      ...new Set(
        recentOrders.flatMap((order) =>
          order.dishes.map((dishItem) => dishItem.dish._id)
        )
      ),
    ];
    const dishes = await Dish.find({ _id: { $in: dishIds } });

    const dishMap = {};
    dishes.forEach((dish) => {
      dishMap[dish._id] = dish;
    });

    const ingredientNames = [
      ...new Set(
        dishes.flatMap((dish) =>
          dish.ingredientTemplates.map((template) => template.ingredient.name)
        )
      ),
    ];
    const ingredients = await Ingredient.find({
      name: { $in: ingredientNames },
    });

    const ingredientPriceMap = {};
    ingredientNames.forEach((name) => {
      const relevantIngredients = ingredients.filter(
        (ingredient) => ingredient.name === name
      );

      if (relevantIngredients.length === 0) {
        console.warn(`Brak składnika: ${name} - ustawiam priceRatio na 0`);
        ingredientPriceMap[name] = 0;
        return;
      }

      const avgPriceRatio =
        relevantIngredients.reduce(
          (sum, ingredient) => {
            const priceRatio = parseFloat(ingredient.priceRatio) || 0;
            return sum + priceRatio;
          },
          0
        ) / relevantIngredients.length;
      
      ingredientPriceMap[name] = avgPriceRatio;
    });

    let totalProfit = 0;
    let debugInfo = []; // dla debugowania

    for (const order of recentOrders) {
      for (const dishItem of order.dishes) {
        const dish = dishMap[dishItem.dish._id];
        if (!dish) {
          console.warn(`Brak dania o ID: ${dishItem.dish._id}`);
          continue;
        }

        const dishPrice = parseFloat(dish.price) || 0;
        const quantity = parseInt(dishItem.quantity) || 0;
        
        if (dishPrice === 0) {
          console.warn(`Brak ceny dla dania: ${dish.name || dish._id}`);
        }
        
        if (quantity === 0) {
          console.warn(`Brak ilości dla dania: ${dish.name || dish._id}`);
        }

        const ingredientTemplates = dish.ingredientTemplates || [];
        let totalIngredientCost = 0;

        for (const template of ingredientTemplates) {
          const ingredient = template.ingredient;
          if (!ingredient || !ingredient.name) {
            console.warn(`Brak nazwy składnika w template`);
            continue;
          }

          const avgPriceRatio = ingredientPriceMap[ingredient.name];
          
          if (avgPriceRatio === undefined) {
            console.warn(`Brak avgPriceRatio dla składnika: ${ingredient.name}`);
            continue;
          }

          const weightInDish = parseFloat(template.weight) || 0;
          
          if (weightInDish === 0) {
            console.warn(`Brak wagi dla składnika: ${ingredient.name} w daniu: ${dish.name}`);
          }

          const ingredientCostForDish = avgPriceRatio * weightInDish;
          
          if (isNaN(ingredientCostForDish)) {
            console.error(`NaN wykryty dla składnika ${ingredient.name}:`, {
              avgPriceRatio,
              weightInDish,
              template: template
            });
            continue;
          }

          totalIngredientCost += ingredientCostForDish;
        }

        const dishProfit = (dishPrice - totalIngredientCost) * quantity;
        
        if (isNaN(dishProfit)) {
          console.error(`NaN wykryty dla zysku dania:`, {
            dishName: dish.name,
            dishPrice,
            totalIngredientCost,
            quantity,
            dishProfit
          });
          continue;
        }

        debugInfo.push({
          dishName: dish.name,
          dishPrice,
          totalIngredientCost,
          quantity,
          dishProfit
        });

        totalProfit += dishProfit;
      }
    }

    console.log("Informacje debug:", debugInfo);
    console.log("Całkowity zysk:", totalProfit);

    // Sprawdzenie czy totalProfit to NaN
    if (isNaN(totalProfit)) {
      console.error("BŁĄD: totalProfit to NaN");
      return res.status(500).json({
        message: "Błąd obliczeń - wynik to NaN",
        debugInfo: debugInfo
      });
    }

    return res.status(200).json({
      message: `Całkowity zysk w ostatnim okresie: ${period}`,
      totalProfit: totalProfit.toFixed(2),
    });
  } catch (err) {
    console.log("Błąd:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania zysku." });
  }
};

exports.getOrdersByDayOfWeek = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate;
    const period = req.body.period || "tydzien";

    if (period === "tydzien") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === "miesiac") {
      startDate = new Date(today);
      startDate.setDate(1);
    } else if (period === "rok") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const recentOrders = await Order.find({
      orderDate: { $gte: startDate, $lt: endOfToday },
    });

    console.log(
      `Znalezione zamówienia z okresu '${period}':`,
      recentOrders.length
    );

    const ordersByDayOfWeek = {
      Poniedziałek: 0,
      Wtorek: 0,
      Środa: 0,
      Czwartek: 0,
      Piątek: 0,
      Sobota: 0,
      Niedziela: 0,
    };

    recentOrders.forEach((order) => {
      const dayOfWeek = order.orderDate.getDay();
      const dayMap = [
        "Niedziela",
        "Poniedziałek",
        "Wtorek",
        "Środa",
        "Czwartek",
        "Piątek",
        "Sobota",
      ];
      const dayName = dayMap[dayOfWeek];
      ordersByDayOfWeek[dayName]++;
    });

    const sortedOrdersByDayOfWeek = [
      { day: "pon.", count: ordersByDayOfWeek["Poniedziałek"] },
      { day: "wt.", count: ordersByDayOfWeek["Wtorek"] },
      { day: "śr.", count: ordersByDayOfWeek["Środa"] },
      { day: "czw.", count: ordersByDayOfWeek["Czwartek"] },
      { day: "pt.", count: ordersByDayOfWeek["Piątek"] },
      { day: "sob.", count: ordersByDayOfWeek["Sobota"] },
      { day: "niedz.", count: ordersByDayOfWeek["Niedziela"] },
    ];

    return res.status(200).json(sortedOrdersByDayOfWeek);
  } catch (err) {
    console.log("Błąd:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd przy pobieraniu zamówień." });
  }
};

exports.getOrdersWithDetails = async (req, res, next) => {
  const { startDate, endDate } = req.body;

  let filter = {};
  if (startDate && endDate) {
    let start, end;
    try {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.orderDate = { $gte: start, $lte: end };
    } catch (err) {
      return res.status(400).json({ message: "Nieprawidłowy format dat." });
    }
  }

  try {
    const orders = await Order.find(filter)
      .populate({
        path: "dishes.dish",
        model: Dish,
      })
      .populate({
        path: "dishes.preparedBy",
        model: User,
        select: "name",
      });

    const detailedOrders = orders.map((order) => ({
      orderId: order._id,
      tableNumber: order.tableNumber,
      totalPrice: order.price,
      orderDate: order.orderDate,
      dishes: order.dishes.map((dishItem) => ({
        dishName: dishItem.dish.name,
        dishPrice: dishItem.dish.price,
        quantity: dishItem.quantity,
        status: dishItem.status,
        preparedBy: dishItem.preparedBy?.name || "Nieznany",
        doneByCookDate: dishItem.doneByCookDate,
      })),
    }));

    res.status(200).json({
      message: `Znaleziono ${detailedOrders.length} zamówień.`,
      orders: detailedOrders,
    });
  } catch (err) {
    console.error("Błąd podczas pobierania zamówień:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania zamówień." });
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysOrders = await Order.find({
      orderDate: { $gte: today, $lte: endOfToday },
    });

    const totalOrders = todaysOrders.length;
    if (!totalOrders) {
      return res.status(200).json({
        message: "Brak zamówień dzisiaj.",
        totalProfit: "0.00",
        totalOrders: 0,
        top5Earners: [],
        top5Losers: [],
      });
    }

    const dishIds = [
      ...new Set(
        todaysOrders.flatMap((order) =>
          order.dishes.map((dishItem) => dishItem.dish._id.toString())
        )
      ),
    ];

    const dishes = await Dish.find({ _id: { $in: dishIds } });
    const dishMap = {};
    dishes.forEach((dish) => {
      dishMap[dish._id.toString()] = dish;
    });

    const ingredientNames = [
      ...new Set(
        dishes.flatMap((dish) =>
          dish.ingredientTemplates.map((template) => template.ingredient.name)
        )
      ),
    ];

    const ingredients = await Ingredient.find({
      name: { $in: ingredientNames },
    });
    const ingredientPriceMap = {};
    ingredientNames.forEach((name) => {
      const relevantIngredients = ingredients.filter(
        (ingredient) => ingredient.name === name
      );
      const avgPriceRatio =
        relevantIngredients.reduce(
          (sum, ingredient) => sum + ingredient.priceRatio,
          0
        ) / relevantIngredients.length;
      ingredientPriceMap[name] = avgPriceRatio;
    });

    let totalProfit = 0;

    const dishProfitMap = {};

    for (const order of todaysOrders) {
      for (const dishItem of order.dishes) {
        const dishIdStr = dishItem.dish._id.toString();
        const dish = dishMap[dishIdStr];
        if (!dish) continue;

        let orderSpecificIngredientCost = 0;
        for (const template of dishItem.dish.ingredientTemplates) {
          const ingredientName = template.ingredient.name;
          const avgPriceRatio = ingredientPriceMap[ingredientName] || 0;
          const weight = parseFloat(template.weight);
          orderSpecificIngredientCost += avgPriceRatio * weight;
        }

        const dishProfit =
          dishItem.quantity *
          (dishItem.dish.price - orderSpecificIngredientCost);
        totalProfit += dishProfit;

        if (!dishProfitMap[dishIdStr]) {
          dishProfitMap[dishIdStr] = { totalProfit: 0, totalQuantity: 0 };
        }
        dishProfitMap[dishIdStr].totalProfit += dishProfit;
        dishProfitMap[dishIdStr].totalQuantity += dishItem.quantity;
      }
    }

    const dishResults = Object.keys(dishProfitMap).map((dishIdStr) => {
      const dish = dishMap[dishIdStr];
      const { totalProfit, totalQuantity } = dishProfitMap[dishIdStr];
      return { dish, totalProfit, totalQuantity };
    });

    const top5Earners = dishResults
      .slice()
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    const top5Losers = dishResults
      .slice()
      .sort((a, b) => a.totalProfit - b.totalProfit)
      .slice(0, 5);

    return res.status(200).json({
      message: "Podsumowanie dzisiejsze",
      totalProfit: totalProfit.toFixed(2),
      totalOrders,
      top5Earners,
      top5Losers,
    });
  } catch (err) {
    console.error("Błąd podczas pobierania podsumowania:", err);
    return res.status(500).json({
      message: "Wystąpił błąd podczas pobierania podsumowania.",
    });
  }
};
