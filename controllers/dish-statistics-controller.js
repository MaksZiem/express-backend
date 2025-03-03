const Order = require("../models/order");
const Dish = require("../models/dish");
const User = require("../models/user");
const Ingredient = require("../models/ingredient");
const IngredientTemplate = require("../models/ingredientTemplate");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");

exports.getDishRevenueByPeriod = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "miesiac";

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Invalid dishId format." });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  let startDate;
  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    const dishPrice = dish.price;
    let ingredientCostDetails = {};

    for (const template of dish.ingredientTemplates) {
      const weightInOrder = parseFloat(template.weight);
      const ingredient = template.ingredient;

      const matchingIngredients = await Ingredient.find({
        name: ingredient.name,
      });
      if (!matchingIngredients.length) continue;

      const averagePriceRatio =
        matchingIngredients.reduce(
          (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
          0
        ) / matchingIngredients.length;

      const ingredientCost = averagePriceRatio * weightInOrder;

      if (!ingredientCostDetails[ingredient.name]) {
        ingredientCostDetails[ingredient.name] = {
          totalWeight: 0,
          totalCost: 0,
        };
      }
      ingredientCostDetails[ingredient.name].totalWeight += weightInOrder;
      ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
    }

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );
    const profitMarginValue = dishPrice - totalIngredientCost;
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      return {
        name,
        totalWeight: ingredientCostDetails[name].totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishPrice: ((totalCost / dishPrice) * 100 || 0).toFixed(2),
      };
    });

    let dataCount, labels;
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      dataCount = Array(12).fill(0);
      labels = Array.from({ length: 12 }, (_, i) => {
        const monthIndex = (today.getMonth() - 11 + i + 12) % 12;
        return monthIndex + 1;
      });
    }

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "No orders found for the specified dish in the given period.",
      });
    }

    let totalRevenue = 0,
      totalQuantity = 0;
    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let dishIngredientCost = 0;

          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInOrder = parseFloat(template.weight);
            const ingredient = template.ingredient;
            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;

            const averagePriceRatio =
              matchingIngredients.reduce(
                (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
                0
              ) / matchingIngredients.length;

            dishIngredientCost += averagePriceRatio * weightInOrder;
          }

          const dishProfit =
            dishItem.quantity * (dishPrice - dishIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7)
              dataCount[6 - daysAgo] += dishProfit;
          } else if (period === "miesiac") {
            dataCount[orderDate.getDate() - 1] += dishProfit;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            const normalizedIndex =
              (monthIndex - (today.getMonth() - 11) + 12) % 12;
            dataCount[normalizedIndex] += dishProfit;
          }
        }
      }
    }

    res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      revenueByPeriod: labels.map((period, index) => ({
        period,
        revenue: dataCount[index].toFixed(2),
      })),
    });
  } catch (err) {
    console.error("Error while calculating revenue for dish:", err);
    res.status(500).json({
      message: "An error occurred while calculating revenue for the dish.",
    });
  }
};

exports.calculateDishesAvailable = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;

    const dish = await Dish.findById(dishId);

    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    let minDishesPossible = Infinity;

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientNeededWeight = parseFloat(ingTemplate.weight);

      const availableIngredients = await Ingredient.find({
        name: ingredientName,
      }).sort({ expirationDate: 1 });

      if (availableIngredients.length === 0) {
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

      let totalAvailableWeight = 0;

      availableIngredients.forEach((ingredient) => {
        totalAvailableWeight += ingredient.weight;
      });

      const possibleDishesWithThisIngredient = Math.floor(
        totalAvailableWeight / ingredientNeededWeight
      );

      if (possibleDishesWithThisIngredient < minDishesPossible) {
        minDishesPossible = possibleDishesWithThisIngredient;
      }
    }

    return res.status(200).json({
      dishName: dish.name,
      maxDishesPossible: minDishesPossible,
    });
  } catch (err) {
    console.log("Błąd podczas obliczania:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania." });
  }
};

exports.getDishPopularity = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "miesiac";

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    const error = new HttpError("Nieprawidłowy format dishId.", 400);
    return next(error);
  }

  try {
    const today = new Date();
    let startDate;

    switch (period) {
      case "tydzien":
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        break;
      case "rok":
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 11);
        startDate.setDate(1);
        break;
      case "miesiac":
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      orderDate: {
        $gte: startDate,
        $lte: endOfToday,
      },
    });

    const popularity = Array(7).fill(0);

    orders.forEach((order) => {
      const orderDate = new Date(order.orderDate);
      const dayOfWeek = (orderDate.getDay() + 6) % 7;

      order.dishes.forEach((dish) => {
        if (dish.dish._id.equals(objectIdDishId)) {
          popularity[dayOfWeek] += dish.quantity;
          console.log(dish);
        }
      });
    });

    return res.status(200).json({
      dishId: dishId,
      popularity: popularity.map((count, index) => ({
        day: ["pn", "wt", "śr", "cz", "pt", "sb", "nd"][index],
        count: count,
      })),
    });
  } catch (err) {
    console.error("Błąd podczas pobierania popularności dania:", err);
    return res.status(500).json({
      message: "Wystąpił błąd podczas pobierania popularności dania.",
    });
  }
};

exports.getDishOrdersStatsByPeriod = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "tydzien";

  let startDate;
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Invalid dishId format." });
  }

  let dataCount = [];
  let labels = [];

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    dataCount = Array(7).fill(0);
    labels = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      return day.toLocaleDateString("pl-PL", { weekday: "short" });
    });
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    startDate.setDate(1);
    console.log(startDate);

    dataCount = Array(12).fill(0);
    labels = [];
    for (let i = 0; i < 12; i++) {
      const month = (today.getMonth() - i + 12) % 12;
      labels.unshift(month + 1);
    }
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: today },
      "dishes.dish._id": objectIdDishId,
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.orderDate);
      orderDate.setHours(0, 0, 0, 0);

      if (orderDate >= startDate && orderDate <= today) {
        if (period === "tydzien") {
          const daysAgo = Math.floor(
            (today - orderDate) / (1000 * 60 * 60 * 24)
          );
          const dayIndex = 6 - daysAgo;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        } else if (period === "miesiac") {
          const dayIndex = orderDate.getDate() - 1;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        } else if (period === "rok") {
          const diffMonths =
            (orderDate.getFullYear() - startDate.getFullYear()) * 12 +
            orderDate.getMonth() -
            startDate.getMonth();
          const monthIndex = (diffMonths + 12) % 12;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[monthIndex] += dish.quantity;
            }
          });
        }
      }
    });

    const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

    const responseData = {
      data: dataCount,
      labels: labels,
      totalOrders: totalOrders,
    };

    res.status(200).json({
      message: `Statystyki zamówień dla dania ${dishId} z ostatniego okresu: ${period}.`,
      ...responseData,
    });
  } catch (err) {
    console.error("Błąd podczas pobierania danych zamówień:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania danych zamówień." });
  }
};

exports.getDishRevenuePredictionbest = async (req, res, next) => {
  console.log("NAJBLIZSZA");
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();

    const getStartDateAndEndDate = (year, month) => {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 5, 0);
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024, currentMonth);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023, currentMonth);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });
    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    const getMonthIndex = (date) => date.getMonth() % 4;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);
          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    const dishCounts2023 = countDishesInOrders(orders2023);

    const dishes = await Dish.find();
    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });

      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        changes.push(
          array[i - 1] === 0
            ? 0
            : ((array[i] - array[i - 1]) / array[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (array1, array2) => {
      const changes1 = calculatePercentageChanges(array1);
      const changes2 = calculatePercentageChanges(array2);
      return changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
    };

    const results = [];

    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);
        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [
        0, 0, 0, 0,
      ];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [
        0, 0, 0, 0,
      ];

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        const clampedChange = Math.max(-50, Math.min(50, averageChanges[i]));
        currentOrders = currentOrders * (1 + clampedChange / 100);
        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
      });
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePredictionuzywabebezrankingu = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();

      const startDate = new Date(year, now.getMonth() + 1, 1);

      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);

      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });
    console.log("Zamówienia 2024:", orders2024.length, "znalezionych zamówień");

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });
    console.log("Zamówienia 2023:", orders2023.length, "znalezionych zamówień");

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);

          console.log(
            `Przetwarzanie zamówienia (ID: ${
              order._id
            }) - dla dania (ID: ${dishId}) w indeksie miesiąca ${monthIndex} (data zamówienia: ${order.orderDate.toISOString()}). Ilość: ${
              dish.quantity
            }`
          );
          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    console.log("Liczba zamówień dla dań w 2024 (miesięczne):", dishCounts2024);
    const dishCounts2023 = countDishesInOrders(orders2023);
    console.log("Liczba zamówień dla dań w 2023 (miesięczne):", dishCounts2023);

    console.log(
      "Wyjaśnienie danych miesięcznych: tablica [a, b, c] oznacza kolejno liczbę zamówień w miesiącach:"
    );
    console.log(" - indeks 0: marzec,");
    console.log(" - indeks 1: kwiecień,");
    console.log(" - indeks 2: maj.");
    console.log(
      "Przykład: Dane miesięczne 2023: [3,4,5] oznaczają, że w marcu było 3 zamówienia, w kwietniu 4, a w maju 5."
    );

    const dishes = await Dish.find();
    console.log("Pobrano dania:", dishes.length);
    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (
      monthlyCounts1,
      monthlyCounts2,
      initial
    ) => {
      const changes1 = calculatePercentageChangesFromData(
        monthlyCounts1,
        initial
      );
      const changes2 = calculatePercentageChangesFromData(
        monthlyCounts2,
        initial
      );
      const avgChanges = changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      console.log(`\nPrzetwarzanie dania: ${dish.name} (ID: ${dish._id})`);
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);
        console.log(
          `  Składnik: ${ingredientName} - waga w daniu: ${ingredientWeightInDish}`
        );
        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });
        console.log(
          `  Znaleziono ${matchingIngredients.length} rekordów dla składnika ${ingredientName}`
        );

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
        console.log(`    Cena średnia (price ratio): ${averagePriceRatio}`);
        console.log(`    Koszt składnika w daniu: ${ingredientCostInDish}`);
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;
      console.log(`  Całkowity koszt składników: ${totalIngredientCost}`);
      console.log(`  Marża (%): ${profitMargin}`);
      console.log(`  Wartość marży: ${marginValue}`);

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [0, 0, 0];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [0, 0, 0];
      console.log(
        `  Dane miesięczne 2023 dla dania (ID: ${dish._id}): ${dishData2023}`
      );
      console.log(
        `  Dane miesięczne 2024 dla dania (ID: ${dish._id}): ${dishData2024}`
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );

        const projectionStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 1,
          1
        );
        const projectionEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 2,
          0
        );
        console.log(
          `    Miesiąc ${
            i + 1
          } - Zakres dat: od ${projectionStartDate.toISOString()} do ${projectionEndDate.toISOString()}`
        );
        console.log(
          `    Miesiąc ${
            i + 1
          }: klamrowana zmiana procentowa: ${clampedChange}%`
        );
        currentOrders = currentOrders * (1 + clampedChange / 100);
        console.log(
          `    Miesiąc ${i + 1}: prognozowana liczba zamówień: ${currentOrders}`
        );
        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
      });
    }

    console.log("Wynik prognozowania przychodów:", results);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePredictionbest = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);

          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    console.log("Liczba zamówień dla dań w 2024 (miesięczne):", dishCounts2024);
    const dishCounts2023 = countDishesInOrders(orders2023);
    console.log("Liczba zamówień dla dań w 2023 (miesięczne):", dishCounts2023);

    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (
      monthlyCounts1,
      monthlyCounts2,
      initial
    ) => {
      const changes1 = calculatePercentageChangesFromData(
        monthlyCounts1,
        initial
      );
      const changes2 = calculatePercentageChangesFromData(
        monthlyCounts2,
        initial
      );
      const avgChanges = changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [0, 0, 0];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [0, 0, 0];
      console.log(
        `  Dane miesięczne 2023 dla dania (ID: ${dish._id}): ${dishData2023}`
      );
      console.log(
        `  Dane miesięczne 2024 dla dania (ID: ${dish._id}): ${dishData2024}`
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        const projectionStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 1,
          1
        );
        const projectionEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 2,
          0
        );

        currentOrders = currentOrders * (1 + clampedChange / 100);

        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );

    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePrediction2 = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const yearsCount = Number(req.query.years) || 2;
    const currentYear = currentDate.getFullYear();

    console.log(yearsCount);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const yearsData = [];
    for (let i = 1; i <= yearsCount; i++) {
      const year = currentYear - i;
      const { startDate, endDate } = getStartDateAndEndDate(year);
      const orders = await Order.find({
        orderDate: { $gte: startDate, $lt: endDate },
      });
      console.log(
        `Zamówienia ${year}:`,
        orders.length,
        "znalezionych zamówień"
      );
      yearsData.push({ year, orders });
    }

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);
          console.log(
            `Przetwarzanie zamówienia (ID: ${
              order._id
            }) - dla dania (ID: ${dishId}) w indeksie miesiąca ${monthIndex} (data zamówienia: ${order.orderDate.toISOString()}). Ilość: ${
              dish.quantity
            }`
          );
          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCountsByYear = {};
    yearsData.forEach(({ year, orders }) => {
      dishCountsByYear[year] = countDishesInOrders(orders);
      console.log(
        `Liczba zamówień dla dań w ${year} (miesięczne):`,
        dishCountsByYear[year]
      );
    });

    console.log(
      "Wyjaśnienie danych miesięcznych: tablica [a, b, c] oznacza kolejno liczbę zamówień w miesiącach:"
    );
    console.log(" - indeks 0: marzec,");
    console.log(" - indeks 1: kwiecień,");
    console.log(" - indeks 2: maj.");
    console.log(
      "Przykład: Dane miesięczne: [3,4,5] oznaczają, że w marcu było 3 zamówienia, w kwietniu 4, a w maju 5."
    );

    const dishes = await Dish.find();
    console.log("Pobrano dania:", dishes.length);
    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChangesForMultipleYears = (
      dataSets,
      initial
    ) => {
      if (dataSets.length === 0) return [0, 0, 0];
      let sums = [0, 0, 0];
      dataSets.forEach((monthlyCounts) => {
        const changes = calculatePercentageChangesFromData(
          monthlyCounts,
          initial
        );
        for (let i = 0; i < changes.length; i++) {
          sums[i] += changes[i];
        }
      });
      const avgChanges = sums.map((sum) => sum / dataSets.length);
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      console.log(`\nPrzetwarzanie dania: ${dish.name} (ID: ${dish._id})`);
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);
        console.log(
          `  Składnik: ${ingredientName} - waga w daniu: ${ingredientWeightInDish}`
        );
        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });
        console.log(
          `  Znaleziono ${matchingIngredients.length} rekordów dla składnika ${ingredientName}`
        );

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
        console.log(`    Cena średnia (price ratio): ${averagePriceRatio}`);
        console.log(`    Koszt składnika w daniu: ${ingredientCostInDish}`);
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;
      console.log(`  Całkowity koszt składników: ${totalIngredientCost}`);
      console.log(`  Marża (%): ${profitMargin}`);
      console.log(`  Wartość marży: ${marginValue}`);

      const yearsMonthlyData = [];
      for (let i = 1; i <= yearsCount; i++) {
        const year = currentYear - i;
        const dishData = dishCountsByYear[year][dish._id]?.monthlyCounts || [
          0, 0, 0,
        ];
        console.log(
          `  Dane miesięczne ${year} dla dania (ID: ${dish._id}): ${dishData}`
        );
        yearsMonthlyData.push(dishData);
      }

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChangesForMultipleYears(
        yearsMonthlyData,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        const projectionStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 1,
          1
        );
        const projectionEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 2,
          0
        );
        console.log(
          `    Miesiąc ${
            i + 1
          } - Zakres dat: od ${projectionStartDate.toISOString()} do ${projectionEndDate.toISOString()}`
        );
        console.log(
          `    Miesiąc ${
            i + 1
          }: klamrowana zmiana procentowa: ${clampedChange}%`
        );
        currentOrders = currentOrders * (1 + clampedChange / 100);
        console.log(
          `    Miesiąc ${i + 1}: prognozowana liczba zamówień: ${currentOrders}`
        );
        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );

    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    console.log("Wynik prognozowania przychodów:", results);
    console.log("Globalny Total Profit:", globalTotalProfit);
    console.log("Ranking dań wg prognozowanego przychodu:", ranking);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePrediction6moths = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);

          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    console.log("Liczba zamówień dla dań w 2024 (miesięczne):", dishCounts2024);
    const dishCounts2023 = countDishesInOrders(orders2023);
    console.log("Liczba zamówień dla dań w 2023 (miesięczne):", dishCounts2023);

    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const earliestMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 5,
      1
    );
    const endMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    console.log(
      "Okres ostatnich 5 miesięcy od:",
      earliestMonth,
      "do:",
      endMonth
    );

    const ordersLast5Months = await Order.find({
      orderDate: { $gte: earliestMonth, $lt: endMonth },
    });
    console.log(
      "Liczba zamówień z ostatnich 5 miesięcy:",
      ordersLast5Months.length
    );

    const dishOrdersLast5Months = {};
    ordersLast5Months.forEach((order) => {
      const monthDiff =
        (order.orderDate.getFullYear() - earliestMonth.getFullYear()) * 12 +
        (order.orderDate.getMonth() - earliestMonth.getMonth());

      if (monthDiff >= 0 && monthDiff < 5) {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishOrdersLast5Months[dishId]) {
            dishOrdersLast5Months[dishId] = [0, 0, 0, 0, 0];
          }
          dishOrdersLast5Months[dishId][monthDiff] += dish.quantity;
        });
      }
    });

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (
      monthlyCounts1,
      monthlyCounts2,
      initial
    ) => {
      const changes1 = calculatePercentageChangesFromData(
        monthlyCounts1,
        initial
      );
      const changes2 = calculatePercentageChangesFromData(
        monthlyCounts2,
        initial
      );
      const avgChanges = changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [0, 0, 0];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [0, 0, 0];
      console.log(
        `  Dane miesięczne 2023 dla dania (ID: ${dish._id}): ${dishData2023}`
      );
      console.log(
        `  Dane miesięczne 2024 dla dania (ID: ${dish._id}): ${dishData2024}`
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        const projectionStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 1,
          1
        );
        const projectionEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + i + 2,
          0
        );

        currentOrders = currentOrders * (1 + clampedChange / 100);
        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      const orders6monthsago = dishOrdersLast5Months[dish._id.toString()] || [
        0, 0, 0, 0, 0,
      ];

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
        orders6monthsago,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );

    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePrediction6months2 = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);

          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    console.log("Liczba zamówień dla dań w 2024 (miesięczne):", dishCounts2024);
    const dishCounts2023 = countDishesInOrders(orders2023);
    console.log("Liczba zamówień dla dań w 2023 (miesięczne):", dishCounts2023);

    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const earliestMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 5,
      1
    );
    const endMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    console.log(
      "Okres ostatnich 5 miesięcy od:",
      earliestMonth,
      "do:",
      endMonth
    );

    const ordersLast5Months = await Order.find({
      orderDate: { $gte: earliestMonth, $lt: endMonth },
    });
    console.log(
      "Liczba zamówień z ostatnich 5 miesięcy:",
      ordersLast5Months.length
    );

    const dishOrdersLast5Months = {};
    ordersLast5Months.forEach((order) => {
      const monthDiff =
        (order.orderDate.getFullYear() - earliestMonth.getFullYear()) * 12 +
        (order.orderDate.getMonth() - earliestMonth.getMonth());

      if (monthDiff >= 0 && monthDiff < 5) {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishOrdersLast5Months[dishId]) {
            dishOrdersLast5Months[dishId] = [0, 0, 0, 0, 0];
          }
          dishOrdersLast5Months[dishId][monthDiff] += dish.quantity;
        });
      }
    });

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (
      monthlyCounts1,
      monthlyCounts2,
      initial
    ) => {
      const changes1 = calculatePercentageChangesFromData(
        monthlyCounts1,
        initial
      );
      const changes2 = calculatePercentageChangesFromData(
        monthlyCounts2,
        initial
      );
      const avgChanges = changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [0, 0, 0];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [0, 0, 0];
      console.log(
        `  Dane miesięczne 2023 dla dania (ID: ${dish._id}): ${dishData2023}`
      );
      console.log(
        `  Dane miesięczne 2024 dla dania (ID: ${dish._id}): ${dishData2024}`
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        currentOrders = currentOrders * (1 + clampedChange / 100);
        projectedOrders.push(currentOrders);
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      let orders6monthsago = dishOrdersLast5Months[dish._id.toString()] || [
        0, 0, 0, 0, 0,
      ];

      orders6monthsago.push(initialOrders);

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
        orders6monthsago,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );

    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePrediction1902 = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);
          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024);
    console.log("Liczba zamówień dla dań w 2024 (miesięczne):", dishCounts2024);
    const dishCounts2023 = countDishesInOrders(orders2023);
    console.log("Liczba zamówień dla dań w 2023 (miesięczne):", dishCounts2023);

    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const earliestMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 5,
      1
    );
    const endMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    console.log(
      "Okres ostatnich 5 miesięcy od:",
      earliestMonth,
      "do:",
      endMonth
    );

    const ordersLast5Months = await Order.find({
      orderDate: { $gte: earliestMonth, $lt: endMonth },
    });
    console.log(
      "Liczba zamówień z ostatnich 5 miesięcy:",
      ordersLast5Months.length
    );

    const dishOrdersLast5Months = {};
    ordersLast5Months.forEach((order) => {
      const monthDiff =
        (order.orderDate.getFullYear() - earliestMonth.getFullYear()) * 12 +
        (order.orderDate.getMonth() - earliestMonth.getMonth());
      if (monthDiff >= 0 && monthDiff < 5) {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishOrdersLast5Months[dishId]) {
            dishOrdersLast5Months[dishId] = [0, 0, 0, 0, 0];
          }
          dishOrdersLast5Months[dishId][monthDiff] += dish.quantity;
        });
      }
    });

    function predictNextOrders(data, monthsToPredict = 3) {
      const n = data.length;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0;
      for (let i = 0; i < n; i++) {
        const x = i + 1;
        const y = data[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
      const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const a = (sumY - b * sumX) / n;
      const predictions = [];
      for (let i = 1; i <= monthsToPredict; i++) {
        const x = n + i;
        const yPred = a + b * x;
        predictions.push(yPred);
      }
      return { a, b, predictions };
    }

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChanges = (
      monthlyCounts1,
      monthlyCounts2,
      initial
    ) => {
      const changes1 = calculatePercentageChangesFromData(
        monthlyCounts1,
        initial
      );
      const changes2 = calculatePercentageChangesFromData(
        monthlyCounts2,
        initial
      );
      const avgChanges = changes1.map(
        (_, index) => (changes1[index] + changes2[index]) / 2
      );
      return avgChanges;
    };

    const results = [];

    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });

        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }

      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const dishData2023 = dishCounts2023[dish._id]?.monthlyCounts || [0, 0, 0];
      const dishData2024 = dishCounts2024[dish._id]?.monthlyCounts || [0, 0, 0];
      console.log(
        `  Dane miesięczne 2023 dla dania (ID: ${dish._id}): ${dishData2023}`
      );
      console.log(
        `  Dane miesięczne 2024 dla dania (ID: ${dish._id}): ${dishData2024}`
      );

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `  Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChanges(
        dishData2024,
        dishData2023,
        initialOrders
      );
      console.log(`  Średnie zmiany procentowe: ${averageChanges}`);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;
      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        currentOrders = currentOrders * (1 + clampedChange / 100);
        projectedOrders.push(currentOrders);
      }

      let orders6monthsago = dishOrdersLast5Months[dish._id.toString()] || [
        0, 0, 0, 0, 0,
      ];
      orders6monthsago.push(initialOrders);

      const regressionResult = predictNextOrders(orders6monthsago, 3);
      console.log(`  Regression dla dania "${dish.name}":`, regressionResult);

      for (let i = 0; i < 3; i++) {
        const originalPrediction = projectedOrders[i + 1];
        const regressionPrediction = regressionResult.predictions[i];
        const combinedPrediction =
          (originalPrediction + regressionPrediction) / 2;
        projectedOrders[i + 1] = combinedPrediction;
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `  Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `  Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
        orders6monthsago,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );

    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.getDishRevenuePrediction = async (req, res, next) => {
  console.log("NAJBLIZSZA - rozpoczęcie prognozowania przychodów");
  try {
    const currentDate = new Date();
    console.log("Aktualna data:", currentDate);

    const yearsCount = Number(req.query.years) || 2;
    const currentYear = currentDate.getFullYear();

    const getStartDateAndEndDate = (year) => {
      const now = new Date();
      const startDate = new Date(year, now.getMonth() + 1, 1);
      const endDate = new Date(year, now.getMonth() + 1 + 3, 0);
      console.log(`Zakres dat dla roku ${year} (dynamicznie ustalany):`, {
        startDate,
        endDate,
      });
      return { startDate, endDate };
    };

    const yearsData = [];
    for (let i = 1; i <= yearsCount; i++) {
      const year = currentYear - i;
      const { startDate, endDate } = getStartDateAndEndDate(year);
      const orders = await Order.find({
        orderDate: { $gte: startDate, $lt: endDate },
      });
      console.log(
        `Zamówienia ${year}:`,
        orders.length,
        "znalezionych zamówień"
      );
      yearsData.push({ year, orders });
    }

    const getMonthIndex = (date) => date.getMonth() - 2;

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          const monthIndex = getMonthIndex(order.orderDate);
          if (!result[dishId]) {
            result[dishId] = { monthlyCounts: [0, 0, 0] };
          }
          result[dishId].monthlyCounts[monthIndex] += dish.quantity;
        });
        return result;
      }, {});
    };

    const dishCountsByYear = {};
    yearsData.forEach(({ year, orders }) => {
      dishCountsByYear[year] = countDishesInOrders(orders);
      console.log(
        `Liczba zamówień dla dań w ${year} (miesięczne):`,
        dishCountsByYear[year]
      );
    });

    const dishes = await Dish.find();
    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const getInitialOrders = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log("Data 30 dni temu:", thirtyDaysAgo);

      const recentOrders = await Order.find({
        orderDate: { $gte: thirtyDaysAgo },
      });
      console.log("Zamówienia z ostatnich 30 dni:", recentOrders.length);

      const dishCounts = {};
      recentOrders.forEach((order) => {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishCounts[dishId]) {
            dishCounts[dishId] = 0;
          }
          dishCounts[dishId] += dish.quantity;
        });
      });
      console.log("Liczba zamówień dla dań z ostatnich 30 dni:", dishCounts);
      return dishCounts;
    };

    const dishInitialOrders = await getInitialOrders();

    const earliestMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 5,
      1
    );
    const endMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    console.log(
      "Okres ostatnich 5 miesięcy od:",
      earliestMonth,
      "do:",
      endMonth
    );

    const ordersLast5Months = await Order.find({
      orderDate: { $gte: earliestMonth, $lt: endMonth },
    });
    console.log(
      "Liczba zamówień z ostatnich 5 miesięcy:",
      ordersLast5Months.length
    );

    const dishOrdersLast5Months = {};
    ordersLast5Months.forEach((order) => {
      const monthDiff =
        (order.orderDate.getFullYear() - earliestMonth.getFullYear()) * 12 +
        (order.orderDate.getMonth() - earliestMonth.getMonth());
      if (monthDiff >= 0 && monthDiff < 5) {
        order.dishes.forEach((dish) => {
          const dishId = dish.dish._id.toString();
          if (!dishOrdersLast5Months[dishId]) {
            dishOrdersLast5Months[dishId] = [0, 0, 0, 0, 0];
          }
          dishOrdersLast5Months[dishId][monthDiff] += dish.quantity;
        });
      }
    });

    const calculatePercentageChangesFromData = (monthlyCounts, initial) => {
      const combined = [initial, ...monthlyCounts];
      const changes = [];
      for (let i = 1; i < combined.length; i++) {
        changes.push(
          combined[i - 1] === 0
            ? 0
            : ((combined[i] - combined[i - 1]) / combined[i - 1]) * 100
        );
      }
      return changes;
    };

    const calculateAveragePercentageChangesForMultipleYears = (
      dataSets,
      initial
    ) => {
      if (dataSets.length === 0) return [0, 0, 0];
      let sums = [0, 0, 0];
      dataSets.forEach((monthlyCounts) => {
        const changes = calculatePercentageChangesFromData(
          monthlyCounts,
          initial
        );
        for (let i = 0; i < changes.length; i++) {
          sums[i] += changes[i];
        }
      });
      const avgChanges = sums.map((sum) => sum / dataSets.length);
      return avgChanges;
    };

    function predictNextOrders(data, monthsToPredict = 3) {
      const n = data.length;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0;
      for (let i = 0; i < n; i++) {
        const x = i + 1;
        const y = data[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
      const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const a = (sumY - b * sumX) / n;
      const predictions = [];
      for (let i = 1; i <= monthsToPredict; i++) {
        const x = n + i;
        const yPred = a + b * x;
        predictions.push(yPred);
      }
      return { a, b, predictions };
    }

    const results = [];
    for (const dish of dishes) {
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);
        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });
        if (matchingIngredients.length === 0) continue;

        let totalPriceRatio = 0;
        let totalCount = 0;
        matchingIngredients.forEach((ingredient) => {
          const ratio =
            ingredient.priceRatio || ingredient.price / ingredient.weight;
          totalPriceRatio += ratio;
          totalCount++;
        });
        const averagePriceRatio = totalPriceRatio / totalCount;
        const ingredientCostInDish = averagePriceRatio * ingredientWeightInDish;
        totalIngredientCost += ingredientCostInDish;

        ingredientDetails.push({
          name: ingredientName,
          weightInDish: ingredientWeightInDish,
          averagePriceRatio,
          finalCost: ingredientCostInDish,
          contributionPercentage: (ingredientCostInDish / dish.price) * 100,
        });
      }
      const profitMargin =
        ((dish.price - totalIngredientCost) / dish.price) * 100;
      const marginValue = dish.price - totalIngredientCost;

      const yearsMonthlyData = [];
      for (let i = 1; i <= yearsCount; i++) {
        const year = currentYear - i;
        const dishData = dishCountsByYear[year][dish._id]?.monthlyCounts || [
          0, 0, 0,
        ];
        console.log(
          `Dane miesięczne ${year} dla dania (ID: ${dish._id}):`,
          dishData
        );
        yearsMonthlyData.push(dishData);
      }

      const initialOrders = dishInitialOrders[dish._id.toString()] || 0;
      console.log(
        `Początkowa liczba zamówień (ostatnie 30 dni): ${initialOrders}`
      );

      const averageChanges = calculateAveragePercentageChangesForMultipleYears(
        yearsMonthlyData,
        initialOrders
      );
      console.log("Średnie zmiany procentowe:", averageChanges);

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;
      for (let i = 0; i < 3; i++) {
        const clampedChange = Math.max(
          -50,
          Math.min(50, averageChanges[i] || 0)
        );
        currentOrders = currentOrders * (1 + clampedChange / 100);
        projectedOrders.push(currentOrders);
      }

      let orders6monthsago = dishOrdersLast5Months[dish._id.toString()] || [
        0, 0, 0, 0, 0,
      ];
      orders6monthsago.push(initialOrders);

      const regressionResult = predictNextOrders(orders6monthsago, 3);
      console.log(`Regression dla dania "${dish.name}":`, regressionResult);

      for (let i = 0; i < 3; i++) {
        const originalPrediction = projectedOrders[i + 1];
        const regressionPrediction = regressionResult.predictions[i];
        const combinedPrediction =
          (originalPrediction + regressionPrediction) / 2;
        projectedOrders[i + 1] = combinedPrediction;
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish;
      });
      console.log(
        `Prognozowane przychody dla kolejnych okresów: ${projectedRevenues}`
      );

      const totalProjectedRevenue = projectedRevenues.reduce(
        (sum, revenue) => sum + revenue,
        0
      );
      console.log(
        `Łączny prognozowany przychód dla dania "${dish.name}": ${totalProjectedRevenue}`
      );

      results.push({
        dishName: dish.name,
        dishPrice: dish.price,
        profitMargin,
        marginValue,
        totalProjectedRevenue,
        projectedOrders,
        projectedRevenues,
        ingredientDetails,
        orders6monthsago,
      });
    }

    const globalTotalProfit = results.reduce(
      (sum, dish) => sum + dish.totalProjectedRevenue,
      0
    );
    const ranking = results
      .map(({ dishName, totalProjectedRevenue }) => ({
        dishName,
        totalProfit: totalProjectedRevenue,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    return res.status(200).json({ results, ranking, globalTotalProfit });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodów:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodów." });
  }
};

exports.dishesCount = async (req, res, next) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const getStartDateAndEndDate = (year, month) => {
      const startDate = new Date(year, month, 1);

      const endDate = new Date(year, month + 5, 0);

      return { startDate, endDate };
    };

    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024, currentMonth);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023, currentMonth);

    console.log("Zakres dat dla 2024:", startDate2024, endDate2024);
    console.log("Zakres dat dla 2023:", startDate2023, endDate2023);

    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    console.log(`Liczba zamówień dla 2024 roku: ${orders2024.length}`);

    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    console.log(`Liczba zamówień dla 2023 roku: ${orders2023.length}`);

    const getMonthIndex = (date) => {
      const monthMapping = [0, 1, 2, 3];

      const month = date.getMonth();
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1;
    };

    const countDishesInOrders = (orders, year) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);

          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = {
                dishName,
                monthlyCounts: [0, 0, 0, 0],
              };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;
          }
        });
        return result;
      }, {});
    };

    const dishCounts2024 = countDishesInOrders(orders2024, 2024);
    const dishCounts2023 = countDishesInOrders(orders2023, 2023);

    const processCounts = (dishCounts) => {
      return Object.values(dishCounts).map((dish) => ({
        dishId: dish.dishId,
        dishName: dish.dishName,
        monthlyCounts: dish.monthlyCounts,
      }));
    };

    const processedCounts2024 = processCounts(dishCounts2024);
    const processedCounts2023 = processCounts(dishCounts2023);

    res.json({ data2024: processedCounts2024, data2023: processedCounts2023 });
  } catch (error) {
    res.status(500).json({ error: "Błąd serwera", details: error.message });
  }
};

exports.getDishById = async (req, res) => {
  const { dishId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(dishId)) {
    return res.status(400).json({ message: "Invalid dish ID format." });
  }

  try {
    const dish = await Dish.findById(dishId);

    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    res.status(200).json({
      name: dish.name,
      price: dish.price,
      isAvailable: dish.isAvailable,
      isBlocked: dish.isBlocked,
      image: dish.image,
      ingredientTemplates: dish.ingredientTemplates.map((template) => ({
        ingredient: {
          _id: template.ingredient._id,
          name: template.ingredient.name,
        },
        weight: template.weight,
      })),
      user: {
        name: dish.user.name,
        userId: dish.user.userId,
      },
    });
  } catch (err) {
    console.error("Error fetching dish:", err);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the dish." });
  }
};

exports.addIngredientToDish = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { ingredientTemplateId, weight } = req.body;
  console.log(dishId);

  try {
    if (!mongoose.Types.ObjectId.isValid(dishId)) {
      return res
        .status(400)
        .json({ message: `Nieprawidłowy identyfikator dania.` });
    }

    const ingredientTemplate = await IngredientTemplate.findById(
      ingredientTemplateId
    );
    if (!ingredientTemplate) {
      return res
        .status(404)
        .json({ message: "Składnik nie został znaleziony." });
    }

    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    const newIngredientTemplate = {
      ingredient: {
        _id: ingredientTemplate._id,
        name: ingredientTemplate.name,
        category: ingredientTemplate.category,
        expirationDate: ingredientTemplate.expirationDate,
        image: ingredientTemplate.image,
      },
      weight,
    };

    dish.ingredientTemplates.push(newIngredientTemplate);

    await dish.save();

    res.status(200).json({
      message: "Składnik został dodany do dania.",
      dish,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Wystąpił błąd podczas dodawania składnika do dania.",
      error: err.message,
    });
  }
};

exports.updateDish = async (req, res, next) => {
  console.log("update dish");
  const { dishId } = req.params;
  const { name, price, isBlocked, ingredientTemplates } = req.body;
  console.log(req.body);
  try {
    const updateFields = {};

    if (name) updateFields.name = name;
    if (price) updateFields.price = price;

    updateFields.isBlocked = isBlocked;
    if (req.file && req.file.path) {
      updateFields.image = req.file.path;
    }
    if (ingredientTemplates) {
      const updatedIngredients = await Promise.all(
        ingredientTemplates.map(async (item) => {
          const ingredient = await IngredientTemplate.findById(
            item.ingredientId
          );
          if (!ingredient) {
            throw new Error(
              `Ingredient with ID ${item.ingredientId} not found`
            );
          }
          return {
            ingredient,
            weight: item.weight,
          };
        })
      );
      updateFields.ingredientTemplates = updatedIngredients;
    }

    const updatedDish = await Dish.findOneAndUpdate(
      { _id: dishId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedDish) {
      return res.status(404).json({ message: "Dish not found" });
    }

    res.status(200).json({
      message: "Dish updated successfully",
      dish: updatedDish,
    });
  } catch (error) {
    console.error("Error updating dish:", error);
    res.status(500).json({ message: "Updating dish failed", error });
  }
};

exports.deleteDish = async (req, res, next) => {
  const { dishId } = req.params;

  try {
    const deletedDish = await Dish.findByIdAndDelete(dishId);
    if (!deletedDish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    res
      .status(200)
      .json({ message: "Danie zostało usunięte.", dish: deletedDish });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Błąd podczas usuwania dania.", error: err });
  }
};

exports.deleteIngredient = async (req, res, next) => {
  const { dishId, ingredientId } = req.params;
  console.log(ingredientId);
  try {
    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    console.log(dish.ingredientTemplates);

    dish.ingredientTemplates = dish.ingredientTemplates.filter(
      (template) => template.ingredient._id.toString() !== ingredientId
    );

    console.log(dish.ingredientTemplates);

    await dish.save();

    res.status(200).json({ message: "Składnik został usunięty.", dish });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Błąd podczas usuwania składnika.", error: err });
  }
};

exports.getDishRevenueByDateRange2 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { startDate: startDateStr, endDate: endDateStr } = req.body;

  if (!startDateStr || !endDateStr) {
    return res
      .status(400)
      .json({ message: "startDate oraz endDate są wymagane." });
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res
      .status(400)
      .json({
        message: "Nieprawidłowy format daty dla startDate lub endDate.",
      });
  }

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Nieprawidłowy format dishId." });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }
    const dishPrice = dish.price;

    let ingredientCostDetails = {};
    for (const template of dish.ingredientTemplates) {
      const weightInDish = parseFloat(template.weight);
      const ingredient = template.ingredient;
      const matchingIngredients = await Ingredient.find({
        name: ingredient.name,
      });
      if (!matchingIngredients.length) continue;
      const averagePriceRatio =
        matchingIngredients.reduce(
          (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
          0
        ) / matchingIngredients.length;
      const ingredientCost = averagePriceRatio * weightInDish;

      if (!ingredientCostDetails[ingredient.name]) {
        ingredientCostDetails[ingredient.name] = {
          totalWeight: 0,
          totalCost: 0,
        };
      }
      ingredientCostDetails[ingredient.name].totalWeight += weightInDish;
      ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
    }

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );
    const profitMarginValue = dishPrice - totalIngredientCost;
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      return {
        name,
        totalWeight: ingredientCostDetails[name].totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishPrice: ((totalCost / dishPrice) * 100 || 0).toFixed(2),
      };
    });

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "Brak zamówień zawierających to danie w zadanym okresie.",
      });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderHistory = [];

    const msInDay = 1000 * 60 * 60 * 24;
    const dayCount = Math.floor((endDate - startDate) / msInDay) + 1;
    const revenueByDay = Array(dayCount).fill(0);
    const labels = [];
    for (let i = 0; i < dayCount; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      labels.push(day.toLocaleDateString("pl-PL"));
    }

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          const dishProfit =
            dishItem.quantity * (dishPrice - totalIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          const dayIndex = Math.floor((orderDate - startDate) / msInDay);
          if (dayIndex >= 0 && dayIndex < dayCount) {
            revenueByDay[dayIndex] += dishProfit;
          }

          orderHistory.push({
            orderId: order._id,
            orderDate: order.orderDate,
            quantity: dishItem.quantity,
            dishProfit: dishProfit.toFixed(2),
            ingredients: dish.ingredientTemplates.map((template) => ({
              name: template.ingredient.name,
              weight: template.weight,
            })),
          });
        }
      }
    }

    const revenueByPeriod = labels.map((label, index) => ({
      period: label,
      revenue: revenueByDay[index].toFixed(2),
    }));

    res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      revenueByPeriod,
      orderHistory,
    });
  } catch (err) {
    console.error(
      "Błąd podczas obliczania przychodu dla dania w zadanym okresie:",
      err
    );
    res.status(500).json({
      message: "Wystąpił błąd podczas obliczania przychodu dla dania.",
    });
  }
};

exports.getDishRevenueByDateRangedruga = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { startDate: startDateStr, endDate: endDateStr } = req.body;
  console.log("hello");

  let startDate, endDate;
  if (!startDateStr || !endDateStr) {
    endDate = new Date();
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    console.log("Używany domyślny przedział dat:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  } else {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res
      .status(400)
      .json({
        message: "Nieprawidłowy format daty dla startDate lub endDate.",
      });
  }

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Nieprawidłowy format dishId." });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }
    const dishPrice = dish.price;

    let ingredientCostDetails = {};
    for (const template of dish.ingredientTemplates) {
      const weightInDish = parseFloat(template.weight);
      const ingredient = template.ingredient;
      const matchingIngredients = await Ingredient.find({
        name: ingredient.name,
      });
      if (!matchingIngredients.length) continue;
      const averagePriceRatio =
        matchingIngredients.reduce(
          (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
          0
        ) / matchingIngredients.length;
      const ingredientCost = averagePriceRatio * weightInDish;

      if (!ingredientCostDetails[ingredient.name]) {
        ingredientCostDetails[ingredient.name] = {
          totalWeight: 0,
          totalCost: 0,
        };
      }
      ingredientCostDetails[ingredient.name].totalWeight += weightInDish;
      ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
    }

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );
    const profitMarginValue = dishPrice - totalIngredientCost;
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "Brak zamówień zawierających to danie w zadanym okresie.",
      });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderHistory = [];

    const msInDay = 1000 * 60 * 60 * 24;
    const dayCount = Math.floor((endDate - startDate) / msInDay) + 1;
    const revenueByDay = Array(dayCount).fill(0);
    const labels = [];
    for (let i = 0; i < dayCount; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      labels.push(day.toLocaleDateString("pl-PL"));
    }

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          const dishProfit =
            dishItem.quantity * (dishPrice - totalIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          const dayIndex = Math.floor((orderDate - startDate) / msInDay);
          if (dayIndex >= 0 && dayIndex < dayCount) {
            revenueByDay[dayIndex] += dishProfit;
          }

          orderHistory.push({
            orderId: order._id,
            orderDate: order.orderDate,
            quantity: dishItem.quantity,
            dishProfit: dishProfit.toFixed(2),
            ingredients: dish.ingredientTemplates.map((template) => ({
              name: template.ingredient.name,
              weight: template.weight,
            })),
          });
        }
      }
    }

    const revenueByPeriod = labels.map((label, index) => ({
      period: label,
      revenue: revenueByDay[index].toFixed(2),
    }));

    res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      revenueByPeriod,
      orderHistory,
    });
  } catch (err) {
    console.error(
      "Błąd podczas obliczania przychodu dla dania w zadanym okresie:",
      err
    );
    res.status(500).json({
      message: "Wystąpił błąd podczas obliczania przychodu dla dania.",
    });
  }
};

exports.getDishRevenueByDateRange4 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { startDate: startDateStr, endDate: endDateStr } = req.body;

  let startDate, endDate;
  if (!startDateStr || !endDateStr) {
    endDate = new Date();
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ message: "Nieprawidłowy format daty." });
  }

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Nieprawidłowy format dishId." });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }
    const dishPrice = dish.price;

    let totalIngredientCost = 0;
    for (const template of dish.ingredientTemplates) {
      const weightInDish = parseFloat(template.weight);
      const ingredient = template.ingredient;
      const matchingIngredients = await Ingredient.find({
        name: ingredient.name,
      });
      if (!matchingIngredients.length) continue;
      const averagePriceRatio =
        matchingIngredients.reduce(
          (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
          0
        ) / matchingIngredients.length;
      totalIngredientCost += averagePriceRatio * weightInDish;
    }

    const profitMarginValue = dishPrice - totalIngredientCost;
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "Brak zamówień zawierających to danie w zadanym okresie.",
      });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderHistory = [];

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          const dishProfit =
            dishItem.quantity * (dishPrice - totalIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          orderHistory.push({
            orderId: order._id,
            orderDate: order.orderDate,
            quantity: dishItem.quantity,
            dishProfit: dishProfit.toFixed(2),

            ingredients: dish.ingredientTemplates.map((template) => ({
              name: template.ingredient.name,
              weight: template.weight,
            })),
          });
        }
      }
    }

    return res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      orderHistory,
    });
  } catch (err) {
    console.error("Błąd podczas obliczania przychodu dla dania:", err);
    return res.status(500).json({
      message: "Wystąpił błąd podczas obliczania przychodu dla dania.",
    });
  }
};

exports.getDishRevenueByDateRangebest = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { startDate: startDateStr, endDate: endDateStr } = req.body;

  let startDate, endDate;
  if (!startDateStr || !endDateStr) {
    endDate = new Date();
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ message: "Nieprawidłowy format daty." });
  }

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Nieprawidłowy format dishId." });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }
    const dishPrice = dish.price;

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "Brak zamówień zawierających to danie w zadanym okresie.",
      });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderHistory = [];

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let orderSpecificIngredientCost = 0;
          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInDish = parseFloat(template.weight);
            const ingredient = template.ingredient;

            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;
            const averagePriceRatio =
              matchingIngredients.reduce(
                (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
                0
              ) / matchingIngredients.length;
            orderSpecificIngredientCost += averagePriceRatio * weightInDish;
          }

          const dishProfit =
            dishItem.quantity *
            (dishItem.dish.price - orderSpecificIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          orderHistory.push({
            orderId: order._id,
            orderDate: order.orderDate,
            quantity: dishItem.quantity,
            dishProfit: dishProfit.toFixed(2),

            ingredients: dishItem.dish.ingredientTemplates.map((template) => ({
              name: template.ingredient.name,
              weight: template.weight,
            })),
          });
        }
      }
    }

    let averageProfitPerPortion =
      totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

    const profitMarginValue = averageProfitPerPortion;
    const profitMarginPercentage =
      dishPrice > 0 ? ((profitMarginValue / dishPrice) * 100).toFixed(2) : "0";

    return res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      orderHistory,
    });
  } catch (err) {
    console.error("Błąd podczas obliczania przychodu dla dania:", err);
    return res.status(500).json({
      message: "Wystąpił błąd podczas obliczania przychodu dla dania.",
    });
  }
};

exports.getDishRevenueByDateRange = async (req, res, next) => {
  const dishId = req.params.dishId;
  const { startDate: startDateStr, endDate: endDateStr } = req.body;

  let startDate, endDate;
  if (!startDateStr || !endDateStr) {
    endDate = new Date();
    startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ message: "Nieprawidłowy format daty." });
  }

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    return res.status(400).json({ message: "Nieprawidłowy format dishId." });
  }

  try {
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }
    const dishPrice = dish.price;

    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endDate },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "Brak zamówień zawierających to danie w zadanym okresie.",
      });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderHistory = [];

    const monthlyOccurrences = {};

    let currentMonth = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1
    );
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (currentMonth <= endMonth) {
      const monthKey = `${currentMonth.getFullYear()}-${(
        currentMonth.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}`;
      monthlyOccurrences[monthKey] = 0;
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let orderSpecificIngredientCost = 0;
          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInDish = parseFloat(template.weight);
            const ingredient = template.ingredient;

            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;
            const averagePriceRatio =
              matchingIngredients.reduce(
                (sum, ing) => sum + (ing.priceRatio || ing.price / ing.weight),
                0
              ) / matchingIngredients.length;
            orderSpecificIngredientCost += averagePriceRatio * weightInDish;
          }

          const dishProfit =
            dishItem.quantity *
            (dishItem.dish.price - orderSpecificIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          const monthKey = `${orderDate.getFullYear()}-${(
            orderDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}`;
          if (monthlyOccurrences[monthKey] !== undefined) {
            monthlyOccurrences[monthKey] += dishItem.quantity;
          }

          orderHistory.push({
            orderId: order._id,
            orderDate: order.orderDate,
            quantity: dishItem.quantity,
            dishProfit: dishProfit.toFixed(2),
            ingredients: dishItem.dish.ingredientTemplates.map((template) => ({
              name: template.ingredient.name,
              weight: template.weight,
            })),
          });
        }
      }
    }

    const averageProfitPerPortion =
      totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
    const profitMarginValue = averageProfitPerPortion;
    const profitMarginPercentage =
      dishPrice > 0 ? ((profitMarginValue / dishPrice) * 100).toFixed(2) : "0";

    const occurrencesByMonth = [];
    currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (currentMonth <= endMonth) {
      const monthKey = `${currentMonth.getFullYear()}-${(
        currentMonth.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}`;
      occurrencesByMonth.push({
        period: monthKey,
        quantity: monthlyOccurrences[monthKey],
      });
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    return res.status(200).json({
      dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      occurrencesByMonth,
      orderHistory,
    });
  } catch (err) {
    console.error("Błąd podczas obliczania przychodu dla dania:", err);
    return res.status(500).json({
      message: "Wystąpił błąd podczas obliczania przychodu dla dania.",
    });
  }
};
