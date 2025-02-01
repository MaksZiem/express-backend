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
      return res
        .status(404)
        .json({
          message:
            "No orders found for the specified dish in the given period.",
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
    res
      .status(500)
      .json({
        message: "An error occurred while calculating revenue for the dish.",
      });
  }
};

//wersja z 3001
exports.getDishRevenueByPeriod30011 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "miesiac"; // Domyślnie ustawiamy "miesiac"

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
    //   startDate = new Date(today.getFullYear(), 0, 1); // Pierwszy dzień roku
    startDate = new Date(today);

    startDate.setMonth(today.getMonth() - 11, 1); // 12 miesięcy wstecz
    startDate.setDate(1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    // Pobieramy dane o danym daniu, w tym cenę i składniki
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    const dishPrice = dish.price; // Cena dania
    let ingredientCostDetails = {};

    // Przetwarzamy składniki dania i obliczamy ich koszt
    for (const template of dish.ingredientTemplates) {
      const weightInOrder = parseFloat(template.weight);
      const ingredient = template.ingredient;

      const matchingIngredients = await Ingredient.find({
        name: ingredient.name,
      });
      if (!matchingIngredients.length) continue;

      const averagePriceRatio =
        matchingIngredients.reduce((sum, ing) => {
          return sum + (ing.priceRatio || ing.price / ing.weight);
        }, 0) / matchingIngredients.length;

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

    // Obliczamy marżę zysku na podstawie ceny dania i składników
    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );

    const profitMarginValue = dishPrice - totalIngredientCost;
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    // Przygotowujemy dane do zwrócenia
    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      const totalWeight = ingredientCostDetails[name].totalWeight;

      const percentageOfDishPrice = (totalCost / dishPrice) * 100 || 0;

      return {
        name,
        totalWeight: totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishPrice: percentageOfDishPrice.toFixed(2),
      };
    });

    let dataCount = [];
    let labels = [];

    // Określamy dane do okresów: tydzień, miesiąc, rok
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      dataCount = Array(12).fill(0); // 12 miesięcy
      labels = [];

      for (let i = 2; i <= 13; i++) {
        const monthIndex = (today.getMonth() + i) % 12; // Przesunięcie o i
        labels.push(monthIndex === 0 ? 12 : monthIndex); // Dodanie miesiąca (12 zamiast 0)
      }
    }

    // Sprawdzamy liczbę zamówień w ostatnim tygodniu
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    console.log(startDate);
    console.log(endOfToday);
    console.log(orders);
    if (orders.length === 0) {
      return res
        .status(404)
        .json({
          message:
            "No orders found for the specified dish in the given period.",
        });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let dishIngredientCost = 0;

          // Przetwarzamy składniki dla każdego zamówienia
          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInOrder = parseFloat(template.weight);
            const ingredient = template.ingredient;

            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;

            const averagePriceRatio =
              matchingIngredients.reduce((sum, ing) => {
                return sum + (ing.priceRatio || ing.price / ing.weight);
              }, 0) / matchingIngredients.length;

            const ingredientCost = averagePriceRatio * weightInOrder;
            dishIngredientCost += ingredientCost;
          }

          // Obliczamy przychód dla dania
          const dishProfit =
            dishItem.quantity * (dishPrice - dishIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              const dayIndex = 6 - daysAgo;
              dataCount[dayIndex] += dishProfit;
            }
          } else if (period === "miesiac") {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex] += dishProfit;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            // Dopasowanie do indeksu miesięcy w tablicy
            if (monthIndex === 0) {
              dataCount[11] += dishProfit; // Styczeń na końcu
            } else {
              dataCount[monthIndex - 1] += dishProfit;
            }
          }
        }
      }
    }

    const revenueByPeriod = dataCount.map((revenue, index) => ({
      period: labels[index],
      revenue: revenue.toFixed(2),
    }));

    console.log(revenueByPeriod);

    res.status(200).json({
      dish: dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      revenueByPeriod,
    });
  } catch (err) {
    console.error("Error while calculating revenue for dish:", err);
    res.status(500).json({
      message: "An error occurred while calculating revenue for the dish.",
    });
  }
};

exports.getDishRevenueByPeriods = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "tydzien";

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
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for the specified dish." });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    let revenueByPeriod = [];
    let ingredientCostDetails = {};

    let dataCount, labels;
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );
    }

    // Pobieramy dane o danym daniu, w tym cenę
    const dish = await Dish.findById(objectIdDishId);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    const dishPrice = dish.price; // Cena dania

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
              matchingIngredients.reduce((sum, ing) => {
                return sum + (ing.priceRatio || ing.price / ing.weight);
              }, 0) / matchingIngredients.length;

            const ingredientCost = averagePriceRatio * weightInOrder;
            dishIngredientCost += ingredientCost;

            if (!ingredientCostDetails[ingredient.name]) {
              ingredientCostDetails[ingredient.name] = {
                totalWeight: 0,
                totalCost: 0,
              };
            }
            ingredientCostDetails[ingredient.name].totalWeight += weightInOrder;
            ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
          }

          // Teraz obliczamy marżę na podstawie ceny dania
          const dishProfit =
            dishItem.quantity * (dishPrice - dishIngredientCost);
          totalRevenue += dishProfit;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              const dayIndex = 6 - daysAgo;
              dataCount[dayIndex] += dishProfit;
            }
          } else if (period === "miesiac") {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex] += dishProfit;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            dataCount[monthIndex] += dishProfit;
          }
        }
      }
    }

    revenueByPeriod = dataCount.map((revenue, index) => ({
      period: labels[index],
      revenue: revenue.toFixed(2),
    }));

    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      const totalWeight = ingredientCostDetails[name].totalWeight;

      // Obliczamy procentowy udział składnika w cenie dania
      const percentageOfDishPrice = (totalCost / dishPrice) * 100 || 0;

      return {
        name,
        totalWeight: totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishPrice: percentageOfDishPrice.toFixed(2), // Zmieniamy na procentowy udział w cenie dania
      };
    });

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );

    // Obliczamy marżę zysku
    const profitMarginValue = dishPrice - totalIngredientCost; // Cena dania minus koszt składników
    const profitMarginPercentage = (
      (profitMarginValue / dishPrice) *
      100
    ).toFixed(2);

    res.status(200).json({
      dish: dish,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: profitMarginValue.toFixed(2),
        percentage: profitMarginPercentage,
      },
      revenueByPeriod,
    });
  } catch (err) {
    console.error("Error while calculating revenue for dish:", err);
    res.status(500).json({
      message: "An error occurred while calculating revenue for the dish.",
    });
  }
};

exports.getDishRevenueByPeriod4 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "tydzien";

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
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for the specified dish." });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    let revenueByPeriod = [];
    let ingredientCostDetails = {};

    let dataCount, labels;
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );
    }

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let dishIngredientCost = 0; // Poprawne zainicjalizowanie zmiennej w każdym obiegu pętli.

          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInOrder = parseFloat(template.weight);
            const ingredient = template.ingredient;

            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;

            const averagePriceRatio =
              matchingIngredients.reduce((sum, ing) => {
                return sum + (ing.priceRatio || ing.price / ing.weight);
              }, 0) / matchingIngredients.length;

            const ingredientCost = averagePriceRatio * weightInOrder;
            dishIngredientCost += ingredientCost;

            if (!ingredientCostDetails[ingredient.name]) {
              ingredientCostDetails[ingredient.name] = {
                totalWeight: 0,
                totalCost: 0,
              };
            }
            ingredientCostDetails[ingredient.name].totalWeight += weightInOrder;
            ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
          }

          // Obliczamy dochód po odjęciu kosztów składników
          const dishRevenue =
            dishItem.quantity * (dishItem.dish.price - dishIngredientCost);
          totalRevenue += dishRevenue; // Zwiększamy totalRevenue o dochód po kosztach składników
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              const dayIndex = 6 - daysAgo;
              dataCount[dayIndex] += dishRevenue;
            }
          } else if (period === "miesiac") {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex] += dishRevenue;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            dataCount[monthIndex] += dishRevenue;
          }
        }
      }
    }

    revenueByPeriod = dataCount.map((revenue, index) => ({
      period: labels[index],
      revenue: revenue.toFixed(2),
    }));

    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      const totalWeight = ingredientCostDetails[name].totalWeight;
      const percentageOfDishCost = (totalCost / totalRevenue) * 100 || 0;

      return {
        name,
        totalWeight: totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishCost: percentageOfDishCost.toFixed(2),
      };
    });

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );

    console.log(totalRevenue + "revenue");
    console.log(totalIngredientCost);

    res.status(200).json({
      dishId,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: (totalRevenue - totalIngredientCost).toFixed(2),
        percentage: (
          ((totalRevenue - totalIngredientCost) / totalRevenue) *
          100
        ).toFixed(2),
      },
      revenueByPeriod,
    });
  } catch (err) {
    console.error("Error while calculating revenue for dish:", err);
    res.status(500).json({
      message: "An error occurred while calculating revenue for the dish.",
    });
  }
};

exports.getDishRevenueByPeriod2 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "tydzien";

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
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for the specified dish." });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    let revenueByPeriod = [];
    let ingredientCostDetails = {};

    let dataCount, labels;
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );
    }

    for (const order of orders) {
      for (const dishItem of order.dishes) {
        if (dishItem.dish._id.equals(objectIdDishId)) {
          let dishIngredientCost = 0; // Poprawne zainicjalizowanie zmiennej w każdym obiegu pętli.

          for (const template of dishItem.dish.ingredientTemplates) {
            const weightInOrder = parseFloat(template.weight);
            const ingredient = template.ingredient;

            const matchingIngredients = await Ingredient.find({
              name: ingredient.name,
            });
            if (!matchingIngredients.length) continue;

            const averagePriceRatio =
              matchingIngredients.reduce((sum, ing) => {
                return sum + (ing.priceRatio || ing.price / ing.weight);
              }, 0) / matchingIngredients.length;

            const ingredientCost = averagePriceRatio * weightInOrder;
            dishIngredientCost += ingredientCost;

            if (!ingredientCostDetails[ingredient.name]) {
              ingredientCostDetails[ingredient.name] = {
                totalWeight: 0,
                totalCost: 0,
              };
            }
            ingredientCostDetails[ingredient.name].totalWeight += weightInOrder;
            ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
          }

          const dishRevenue = dishItem.quantity * dishItem.dish.price;
          totalRevenue += dishRevenue;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              const dayIndex = 6 - daysAgo;
              dataCount[dayIndex] += dishRevenue;
            }
          } else if (period === "miesiac") {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex] += dishRevenue;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            dataCount[monthIndex] += dishRevenue;
          }
        }
      }
    }

    revenueByPeriod = dataCount.map((revenue, index) => ({
      period: labels[index],
      revenue: revenue.toFixed(2),
    }));

    const ingredientSummary = Object.keys(ingredientCostDetails).map((name) => {
      const totalCost = ingredientCostDetails[name].totalCost;
      const totalWeight = ingredientCostDetails[name].totalWeight;
      const percentageOfDishCost = (totalCost / totalRevenue) * 100 || 0;

      return {
        name,
        totalWeight: totalWeight.toFixed(2),
        totalCost: totalCost.toFixed(2),
        percentageOfDishCost: percentageOfDishCost.toFixed(2),
      };
    });

    const totalIngredientCost = Object.values(ingredientCostDetails).reduce(
      (sum, item) => sum + item.totalCost,
      0
    );

    res.status(200).json({
      dishId,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: ingredientSummary,
      profitMargin: {
        value: (totalRevenue - totalIngredientCost).toFixed(2),
        percentage: (
          ((totalRevenue - totalIngredientCost) / totalRevenue) *
          100
        ).toFixed(2),
      },
      revenueByPeriod,
    });
  } catch (err) {
    console.error("Error while calculating revenue for dish:", err);
    res.status(500).json({
      message: "An error occurred while calculating revenue for the dish.",
    });
  }
};

exports.getDishRevenueByPeriod1 = async (req, res, next) => {
  const dishId = req.params.dishId;
  const period = req.body.period || "tydzien";

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
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const orders = await Order.find({
      orderDate: { $gte: startDate, $lte: endOfToday },
      "dishes.dish._id": objectIdDishId,
    });

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for the specified dish." });
    }

    let totalRevenue = 0;
    let totalQuantity = 0;
    let revenueByPeriod = [];
    let ingredientCostDetails = {};

    let dataCount, labels;
    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );
    }

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
              matchingIngredients.reduce((sum, ing) => {
                return sum + (ing.priceRatio || ing.price / ing.weight);
              }, 0) / matchingIngredients.length;

            const ingredientCost = averagePriceRatio * weightInOrder;
            dishIngredientCost += ingredientCost;

            if (!ingredientCostDetails[ingredient.name]) {
              ingredientCostDetails[ingredient.name] = {
                totalWeight: 0,
                totalCost: 0,
              };
            }
            ingredientCostDetails[ingredient.name].totalWeight += weightInOrder;
            ingredientCostDetails[ingredient.name].totalCost += ingredientCost;
          }

          const profitMargin =
            ((dishItem.dish.price - dishIngredientCost) / dishItem.dish.price) *
            100;

          const dishRevenue =
            dishItem.quantity * dishItem.dish.price * (profitMargin / 100);
          totalRevenue += dishRevenue;
          totalQuantity += dishItem.quantity;

          const orderDate = new Date(order.orderDate);
          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (endOfToday - orderDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              const dayIndex = 6 - daysAgo;
              dataCount[dayIndex] += dishRevenue;
            }
          } else if (period === "miesiac") {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex] += dishRevenue;
          } else if (period === "rok") {
            const monthIndex = orderDate.getMonth();
            dataCount[monthIndex] += dishRevenue;
          }
        }
      }
    }

    revenueByPeriod = dataCount.map((revenue, index) => ({
      period: labels[index],
      revenue: revenue.toFixed(2),
    }));

    res.status(200).json({
      dishId,
      totalRevenue: totalRevenue.toFixed(2),
      totalQuantity,
      ingredients: Object.keys(ingredientCostDetails).map((name) => ({
        name,
        totalWeight: ingredientCostDetails[name].totalWeight.toFixed(2),
        totalCost: ingredientCostDetails[name].totalCost.toFixed(2),
      })),
      revenueByPeriod,
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

    // console.log(`Danie: ${dish.name}, ID: ${dishId}`);

    let minDishesPossible = Infinity;

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientNeededWeight = parseFloat(ingTemplate.weight);

      //   console.log(
      //     `Składnik: ${ingredientName}, Potrzebna waga na jedno danie: ${ingredientNeededWeight}`
      //   );

      const availableIngredients = await Ingredient.find({
        name: ingredientName,
      }).sort({ expirationDate: 1 });

      if (availableIngredients.length === 0) {
        // console.log(`Brak składnika ${ingredientName} w magazynie.`);
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

      let totalAvailableWeight = 0;

      availableIngredients.forEach((ingredient) => {
        totalAvailableWeight += ingredient.weight;
      });

      //   console.log(
      //     `Całkowita dostępna ilość składnika ${ingredientName}: ${totalAvailableWeight}`
      //   );

      const possibleDishesWithThisIngredient = Math.floor(
        totalAvailableWeight / ingredientNeededWeight
      );

      //   console.log(
      //     `Możliwe do przygotowania dania na podstawie składnika ${ingredientName}: ${possibleDishesWithThisIngredient}`
      //   );

      if (possibleDishesWithThisIngredient < minDishesPossible) {
        minDishesPossible = possibleDishesWithThisIngredient;
      }
    }

    // console.log(
    //   `Maksymalna liczba możliwych do wykonania dań: ${minDishesPossible}`
    // );

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
        startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
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

    // console.log(`Liczba zamówień dla okresu ${period}: ${orders.length}`);
    // console.log("Start Date:", startDate);
    // console.log("End Date:", endOfToday);
    // console.log("Zamówienia:", orders);

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
    ).getDate(); // Poprawna liczba dni w miesiącu

    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    startDate.setDate(1); // Pierwszy dzień miesiąca
    console.log(startDate);
    // Przygotowanie etykiet na ostatnie 12 miesięcy
    dataCount = Array(12).fill(0);
    labels = [];
    for (let i = 0; i < 12; i++) {
      const month = (today.getMonth() - i + 12) % 12; // Liczenie od bieżącego miesiąca wstecz
      labels.unshift(month + 1); // Dodawanie miesiąca (1-12)
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
          const monthIndex = (diffMonths + 12) % 12; // Indeks w tablicy dla 12 miesięcy

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

exports.getDishOrdersStatsByPeriod2 = async (req, res, next) => {
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

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "rok") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
    startDate.setDate(1); // Pierwszy dzień miesiąca

    // Przygotowanie etykiet na ostatnie 12 miesięcy
    dataCount = Array(12).fill(0);
    labels = [];
    for (let i = 0; i < 12; i++) {
      const month = (today.getMonth() - i + 12) % 12; // Liczenie od bieżącego miesiąca wstecz
      labels.unshift(month + 1); // Dodawanie miesiąca (1-12)
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

    let dataCount = Array(12).fill(0); // Na początek dla 12 miesięcy (w przypadku "rok")
    let labels = [];

    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });

      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const daysAgo = Math.floor(
            (today - orderDate) / (1000 * 60 * 60 * 24)
          );
          const dayIndex = 6 - daysAgo;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        }
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );

      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const dayIndex = orderDate.getDate() - 1;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        }
      });
    } else if (period === "rok") {
      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const diffMonths =
            (orderDate.getFullYear() - startDate.getFullYear()) * 12 +
            orderDate.getMonth() -
            startDate.getMonth();
          const monthIndex = (diffMonths + 12) % 12; // Indeks w tablicy dla 12 miesięcy

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[monthIndex] += dish.quantity;
            }
          });
        }
      });
    }

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

exports.getDishOrdersStatsByPeriod2801 = async (req, res, next) => {
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

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
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

    let dataCount = [];
    let labels = [];

    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("pl-PL", { weekday: "short" });
      });

      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const daysAgo = Math.floor(
            (today - orderDate) / (1000 * 60 * 60 * 24)
          );
          const dayIndex = 6 - daysAgo;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        }
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );

      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const dayIndex = orderDate.getDate() - 1;

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[dayIndex] += dish.quantity;
            }
          });
        }
      });
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );

      orders.forEach((order) => {
        const orderDate = new Date(order.orderDate);
        orderDate.setHours(0, 0, 0, 0);
        if (orderDate >= startDate && orderDate <= today) {
          const monthIndex = orderDate.getMonth();

          order.dishes.forEach((dish) => {
            if (dish.dish._id.equals(objectIdDishId)) {
              dataCount[monthIndex] += dish.quantity;
            }
          });
        }
      });
    }

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

exports.getDishRevenuePredictionCLOSE2 = async (req, res, next) => {
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

    const getMonthIndex = (date) => {
      const monthMapping = [0, 1, 2, 3];
      const month = date.getMonth();
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1;
    };

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);
          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = { dishName, monthlyCounts: [0, 0, 0, 0] };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;
          }
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

    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        if (array[i - 1] === 0) {
          changes.push(0);
        } else {
          const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
          changes.push(change);
        }
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
        if (matchingIngredients.length === 0) {
          continue;
        }
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
      const dishData2022 = dishCounts2024[dish._id]?.monthlyCounts || [
        0, 0, 0, 0,
      ];

      const averageChanges = calculateAveragePercentageChanges(
        dishData2022,
        dishData2023
      );

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        const clampedChange = Math.max(-50, Math.min(50, averageChanges[i])); // OGRANICZENIE WARTOŚCI DO -50% / +50%
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

exports.getDishRevenuePredictionCLOSE = async (req, res, next) => {
  console.log("nowa");
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

    const getMonthIndex = (date) => {
      const monthMapping = [0, 1, 2, 3];
      const month = date.getMonth();
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1;
    };

    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);
          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = { dishName, monthlyCounts: [0, 0, 0, 0] };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;
          }
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

    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        if (array[i - 1] === 0) {
          changes.push(0);
        } else {
          const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
          changes.push(change);
        }
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
        if (matchingIngredients.length === 0) {
          continue;
        }
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
      const dishData2022 = dishCounts2024[dish._id]?.monthlyCounts || [
        0, 0, 0, 0,
      ];

      const averageChanges = calculateAveragePercentageChanges(
        dishData2022,
        dishData2023
      );

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        currentOrders = currentOrders * (1 + averageChanges[i] / 100);
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

exports.getDishRevenuePredictionDataJestDlaWszystkichTakaSama = async (
  req,
  res,
  next
) => {
  try {
    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    // Ustalamy aktualny miesiąc i rok
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
    const currentYear = currentDate.getFullYear();

    // Funkcja do obliczania dat na podstawie aktualnego miesiąca
    const getStartDateAndEndDate = (year, month) => {
      // Start w aktualnym miesiącu
      const startDate = new Date(year, month, 1);
      // Kończymy po 4 miesiącach
      const endDate = new Date(year, month + 5, 0); // Ostatni dzień czwartego miesiąca

      return { startDate, endDate };
    };

    // Ustalamy zakres dat dla 2024 i 2023, uwzględniając aktualny miesiąc
    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024, currentMonth);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023, currentMonth);

    // Pobranie zamówień dla 2024 roku
    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    // Pobranie zamówień dla 2023 roku
    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    // Funkcja pomocnicza do mapowania miesięcy
    const getMonthIndex = (date) => {
      // Mapujemy miesiące na indeksy
      const monthMapping = [0, 1, 2, 3]; // Luty, marzec, kwiecień, maj, czerwiec
      const month = date.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1; // Zwracamy indeks lub -1 jeśli miesiąc nie pasuje
    };

    // Funkcja do zliczania dań w zamówieniach
    const countDishesInOrders = (orders) => {
      return orders.reduce((result, order) => {
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);

          // Sprawdzamy, czy miesiąc pasuje
          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = {
                dishName,
                monthlyCounts: [0, 0, 0, 0], // [luty, marzec, kwiecień, maj, czerwiec]
              };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;
          }
        });
        return result;
      }, {});
    };

    // Zliczanie dań dla 2024 i 2023 roku
    const dishCounts2024 = countDishesInOrders(orders2024);
    const dishCounts2023 = countDishesInOrders(orders2023);

    // Przekształcenie wyników na tablicę
    const processCounts = (dishCounts) => {
      return Object.values(dishCounts).map((dish) => ({
        dishId: dish.dishId,
        dishName: dish.dishName,
        monthlyCounts: dish.monthlyCounts,
      }));
    };

    // Przetwarzamy wyniki dla 2024 i 2023
    const processedCounts2024 = processCounts(dishCounts2024);
    const processedCounts2023 = processCounts(dishCounts2023);

    // Zamiana na tablice miesięcznych liczby zamówień
    const data2024 = processedCounts2024
      .map((dish) => dish.monthlyCounts)
      .flat();
    const data2023 = processedCounts2023
      .map((dish) => dish.monthlyCounts)
      .flat();

    console.log(data2024);
    console.log(data2023);

    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2023,
      data2024
    );

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

        if (matchingIngredients.length === 0) {
          continue;
        }

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

      let projectedOrders = [initialOrders]; // zaczynamy od początkowej liczby zamówień
      let currentOrders = initialOrders;

      // Ustawiamy zakres prognozowania na 4 miesiące (luty, marzec, kwiecień, maj)
      for (let i = 0; i < 4; i++) {
        currentOrders = currentOrders * (1 + averageChanges[i] / 100);
        projectedOrders.push(currentOrders); // dodajemy liczbę zamówień na kolejny miesiąc
      }

      const projectedRevenues = projectedOrders.map((order) => {
        const profitPerDish = dish.price - totalIngredientCost;
        return order * profitPerDish; // dla każdego miesiąca obliczamy przychody
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

//dobra
exports.getDishRevenuePredictionSTARA = async (req, res, next) => {
  console.log("STARA");
  try {
    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const data2022 = [2, 8, 3, 6];
    const data2023 = [10, 3, 1, 4];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

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

        if (matchingIngredients.length === 0) {
          continue;
        }

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

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        currentOrders = currentOrders * (1 + averageChanges[i] / 100);
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

exports.getDishRevenuePrediction = async (req, res, next) => {
  console.log("STARA ale z srednia 50 50");
  try {
    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const data2022 = [1, 2, 3, 4];
    const data2023 = [0, 6, 3, 2];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

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

        if (matchingIngredients.length === 0) {
          continue;
        }

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

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        const clampedChange = Math.max(-50, Math.min(50, averageChanges[i])); // OGRANICZENIE DO -50% / +50%
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

exports.getDishRevenuePrediction3 = async (req, res, next) => {
  try {
    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const results = [];

    for (const dish of dishes) {
      // ** Krok 1: Dane historyczne dla ostatnich 9 miesięcy **
      const today = new Date();
      const historicalOrders = [];

      for (let monthOffset = 0; monthOffset < 9; monthOffset++) {
        const targetDate = new Date(
          today.getFullYear(),
          today.getMonth() - monthOffset,
          1
        );
        const startDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          1
        );
        const endDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth() + 1,
          0
        );

        const ordersInRange = await Order.find({
          "dishes.dish._id": dish._id,
          orderDate: { $gte: startDate, $lte: endDate },
        });

        const totalDishesInMonth = ordersInRange.reduce((total, order) => {
          const dishEntry = order.dishes.find(
            (d) => d.dish._id.toString() === dish._id.toString()
          );
          return total + (dishEntry ? dishEntry.quantity : 0);
        }, 0);

        historicalOrders.unshift(totalDishesInMonth || 0); // Jeśli brak danych, wstaw 0
      }

      // ** Krok 2: Dane z ostatnich 30 dni jako punkt wyjściowy dla prognozy **
      const last30DaysOrders = await Order.find({
        "dishes.dish._id": dish._id,
        orderDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      const initialOrders = last30DaysOrders.reduce((total, order) => {
        const dishEntry = order.dishes.find(
          (d) => d.dish._id.toString() === dish._id.toString()
        );
        return total + (dishEntry ? dishEntry.quantity : 0);
      }, 0);

      // ** Krok 3: Prognozowanie zamówień na 3 kolejne miesiące **
      const calculatePercentageChanges = (array) => {
        const changes = [];
        for (let i = 1; i < array.length; i++) {
          const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100 || 0;
          changes.push(change);
        }
        return changes;
      };

      const averageChanges = calculatePercentageChanges(historicalOrders);
      const averageChange =
        averageChanges.reduce((sum, change) => sum + change, 0) /
        averageChanges.length;

      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < 3; i++) {
        currentOrders = Math.max(0, currentOrders * (1 + averageChange / 100)); // Upewnij się, że prognozowane zamówienia nie są ujemne
        projectedOrders.push(currentOrders);
      }

      // Połącz dane historyczne i prognozowane
      const fullOrders = [...historicalOrders, ...projectedOrders.slice(1)];

      // ** Krok 4: Obliczanie przychodów dla pełnych 12 miesięcy **
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) {
          continue;
        }

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

      const projectedRevenues = fullOrders.map((order) => {
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
        ordersPerMonth: fullOrders, // Dane dla pełnych 12 miesięcy
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

exports.getDishRevenuePrediction2 = async (req, res, next) => {
  try {
    const dishes = await Dish.find();

    if (!dishes || dishes.length === 0) {
      return res.status(404).json({ message: "Nie znaleziono żadnych dań." });
    }

    const results = [];

    for (const dish of dishes) {
      // ** Krok 1: Liczba wystąpień dania w ciągu ostatnich 30 dni **
      const last30DaysOrders = await Order.find({
        "dishes.dish._id": dish._id,
        orderDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      const initialOrders = last30DaysOrders.reduce((total, order) => {
        const dishEntry = order.dishes.find(
          (d) => d.dish._id.toString() === dish._id.toString()
        );
        return total + (dishEntry ? dishEntry.quantity : 0);
      }, 0);

      // ** Krok 2: Dane historyczne (luty-maj dwóch poprzednich lat) **
      const today = new Date();
      const currentYear = today.getFullYear();
      const monthsToAnalyze = [1, 2, 3, 4]; // Luty, Marzec, Kwiecień, Maj (miesiące 0-indeksowane)
      const historicalOrders = [];

      for (let yearOffset = 1; yearOffset <= 2; yearOffset++) {
        const year = currentYear - yearOffset;

        for (const month of monthsToAnalyze) {
          const startDate = new Date(year, month, 1); // Pierwszy dzień miesiąca
          const endDate = new Date(year, month + 1, 0); // Ostatni dzień miesiąca

          const ordersInRange = await Order.find({
            "dishes.dish._id": dish._id,
            orderDate: { $gte: startDate, $lte: endDate },
          });

          const totalDishesInMonth = ordersInRange.reduce((total, order) => {
            const dishEntry = order.dishes.find(
              (d) => d.dish._id.toString() === dish._id.toString()
            );
            return total + (dishEntry ? dishEntry.quantity : 0);
          }, 0);

          historicalOrders.push(totalDishesInMonth || 0); // Jeśli brak danych, wstaw 0
        }
      }

      // ** Krok 3: Obliczanie zmian procentowych w danych historycznych **
      const calculatePercentageChanges = (array) => {
        const changes = [];
        for (let i = 1; i < array.length; i++) {
          const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100 || 0;
          changes.push(change);
        }
        return changes;
      };

      const averageChanges = calculatePercentageChanges(historicalOrders);

      // ** Krok 4: Koszt składników dania **
      let totalIngredientCost = 0;
      const ingredientDetails = [];

      for (const ingTemplate of dish.ingredientTemplates) {
        const ingredientName = ingTemplate.ingredient.name;
        const ingredientWeightInDish = parseFloat(ingTemplate.weight);

        const matchingIngredients = await Ingredient.find({
          name: ingredientName,
        });

        if (matchingIngredients.length === 0) {
          continue;
        }

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

      // ** Krok 5: Prognozowane zamówienia i przychody **
      let projectedOrders = [initialOrders];
      let currentOrders = initialOrders;

      for (let i = 0; i < averageChanges.length; i++) {
        currentOrders = Math.max(
          0,
          currentOrders * (1 + averageChanges[i] / 100)
        ); // Upewnij się, że prognozowane zamówienia nie są ujemne
        projectedOrders.push(currentOrders);
      }

      // Dopilnuj, że mamy dokładnie 4 okresy prognozy
      while (projectedOrders.length < 4) {
        projectedOrders.push(0); // Dodaj 0 jeśli brakuje prognoz
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
        projectedOrders: projectedOrders.slice(0, 4), // Dokładnie 4 okresy
        projectedRevenues: projectedRevenues.slice(0, 4), // Dokładnie 4 okresy
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

exports.dishesCoun5 = async (req, res, next) => {
  try {
    // Ustalamy aktualny miesiąc
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
    const currentYear = currentDate.getFullYear();

    // Funkcja do obliczania dat na podstawie aktualnego miesiąca
    const getStartDateAndEndDate = (year) => {
      // Start w lutym roku "year" i kończy się na końcu maja tego samego roku
      const startDate = new Date(year, 1, 1); // Styczeń 1. (ale musimy przesunąć do lutego)
      startDate.setMonth(1); // Luty

      const endDate = new Date(year, 5, 31); // Maj 31 (zdecydowanie ustawić do końca miesiąca)

      return { startDate, endDate };
    };

    // Ustalamy zakres dat dla 2024 i 2023
    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023);

    // Logowanie dat, aby sprawdzić, czy zakres jest poprawny
    console.log("Zakres dat dla 2024:", startDate2024, endDate2024);
    console.log("Zakres dat dla 2023:", startDate2023, endDate2023);

    // Pobranie zamówień dla 2024 roku
    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    // Logowanie wyników zapytania do bazy danych
    console.log(`Liczba zamówień dla 2024 roku: ${orders2024.length}`);

    // Pobranie zamówień dla 2023 roku
    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    // Logowanie wyników zapytania do bazy danych
    console.log(`Liczba zamówień dla 2023 roku: ${orders2023.length}`);

    // Funkcja pomocnicza do mapowania miesięcy
    const getMonthIndex = (date) => {
      // Mapujemy miesiące na indeksy: luty - 0, marzec - 1, kwiecień - 2, maj - 3
      const monthMapping = [0, 1, 2, 3]; // Tylko dla miesięcy luty (1), marzec (2), kwiecień (3), maj (4)

      const month = date.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1; // Zwracamy indeks lub -1 jeśli miesiąc nie pasuje
    };

    // Funkcja do zliczania dań w zamówieniach
    const countDishesInOrders = (orders, year) => {
      return orders.reduce((result, order) => {
        console.log(
          `Przetwarzam zamówienie: ${
            order._id
          } z dnia ${order.orderDate.toISOString()}`
        );

        // Zliczanie dań w zamówieniu
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);

          // Sprawdzamy, czy miesiąc pasuje
          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = {
                dishName,
                monthlyCounts: [0, 0, 0, 0], // [luty, marzec, kwiecień, maj]
              };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;

            // Logowanie dla danego dania i miesiąca
            console.log(
              `Zliczam danie: ${dishName} (ID: ${dishId}) w miesiącu ${
                ["luty", "marzec", "kwiecień", "maj"][monthIndex]
              }: ${dish.quantity}`
            );
          }
        });
        return result;
      }, {});
    };

    // Zliczanie dań dla 2024 i 2023 roku
    const dishCounts2024 = countDishesInOrders(orders2024, 2024);
    const dishCounts2023 = countDishesInOrders(orders2023, 2023);

    // Przekształcenie wyników na tablicę
    const processCounts = (dishCounts) => {
      return Object.values(dishCounts).map((dish) => ({
        dishId: dish.dishId,
        dishName: dish.dishName,
        monthlyCounts: dish.monthlyCounts,
      }));
    };

    // Przetwarzamy wyniki dla 2024 i 2023
    const processedCounts2024 = processCounts(dishCounts2024);
    const processedCounts2023 = processCounts(dishCounts2023);

    // Zwracamy wyniki w odpowiedzi
    res.json({ data2024: processedCounts2024, data2023: processedCounts2023 });
  } catch (error) {
    res.status(500).json({ error: "Błąd serwera", details: error.message });
  }
};

exports.dishesCount = async (req, res, next) => {
  try {
    // Ustalamy aktualny miesiąc i rok
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
    const currentYear = currentDate.getFullYear();

    // Funkcja do obliczania dat na podstawie aktualnego miesiąca
    const getStartDateAndEndDate = (year, month) => {
      // Start w aktualnym miesiącu
      const startDate = new Date(year, month, 1);
      // Kończymy po 4 miesiącach
      const endDate = new Date(year, month + 5, 0); // Ostatni dzień czwartego miesiąca

      return { startDate, endDate };
    };

    // Ustalamy zakres dat dla 2024 i 2023, uwzględniając aktualny miesiąc
    const { startDate: startDate2024, endDate: endDate2024 } =
      getStartDateAndEndDate(2024, currentMonth);
    const { startDate: startDate2023, endDate: endDate2023 } =
      getStartDateAndEndDate(2023, currentMonth);

    // Logowanie dat, aby sprawdzić, czy zakres jest poprawny
    console.log("Zakres dat dla 2024:", startDate2024, endDate2024);
    console.log("Zakres dat dla 2023:", startDate2023, endDate2023);

    // Pobranie zamówień dla 2024 roku
    const orders2024 = await Order.find({
      orderDate: { $gte: startDate2024, $lt: endDate2024 },
    });

    // Logowanie wyników zapytania do bazy danych
    console.log(`Liczba zamówień dla 2024 roku: ${orders2024.length}`);

    // Pobranie zamówień dla 2023 roku
    const orders2023 = await Order.find({
      orderDate: { $gte: startDate2023, $lt: endDate2023 },
    });

    // Logowanie wyników zapytania do bazy danych
    console.log(`Liczba zamówień dla 2023 roku: ${orders2023.length}`);

    // Funkcja pomocnicza do mapowania miesięcy
    const getMonthIndex = (date) => {
      // Mapujemy miesiące na indeksy
      const monthMapping = [0, 1, 2, 3]; // Luty, marzec, kwiecień, maj, czerwiec

      const month = date.getMonth(); // 0 = styczeń, 1 = luty, ..., 11 = grudzień
      return monthMapping[month - 1] !== undefined
        ? monthMapping[month - 1]
        : -1; // Zwracamy indeks lub -1 jeśli miesiąc nie pasuje
    };

    // Funkcja do zliczania dań w zamówieniach
    const countDishesInOrders = (orders, year) => {
      return orders.reduce((result, order) => {
        //   console.log(`Przetwarzam zamówienie: ${order._id} z dnia ${order.orderDate.toISOString()}`);

        // Zliczanie dań w zamówieniu
        order.dishes.forEach((dish) => {
          const dishName = dish.dish.name;
          const dishId = dish.dish._id;
          const monthIndex = getMonthIndex(order.orderDate);

          // Sprawdzamy, czy miesiąc pasuje
          if (monthIndex !== -1) {
            if (!result[dishId]) {
              result[dishId] = {
                dishName,
                monthlyCounts: [0, 0, 0, 0], // [luty, marzec, kwiecień, maj, czerwiec]
              };
            }
            result[dishId].monthlyCounts[monthIndex] += dish.quantity;

            // Logowanie dla danego dania i miesiąca
            //   console.log(`Zliczam danie: ${dishName} (ID: ${dishId}) w miesiącu ${['luty', 'marzec', 'kwiecień', 'maj', 'czerwiec'][monthIndex]}: ${dish.quantity}`);
          }
        });
        return result;
      }, {});
    };

    // Zliczanie dań dla 2024 i 2023 roku
    const dishCounts2024 = countDishesInOrders(orders2024, 2024);
    const dishCounts2023 = countDishesInOrders(orders2023, 2023);

    // Przekształcenie wyników na tablicę
    const processCounts = (dishCounts) => {
      return Object.values(dishCounts).map((dish) => ({
        dishId: dish.dishId,
        dishName: dish.dishName,
        monthlyCounts: dish.monthlyCounts,
      }));
    };

    // Przetwarzamy wyniki dla 2024 i 2023
    const processedCounts2024 = processCounts(dishCounts2024);
    const processedCounts2023 = processCounts(dishCounts2023);

    // Zwracamy wyniki w odpowiedzi
    res.json({ data2024: processedCounts2024, data2023: processedCounts2023 });
  } catch (error) {
    res.status(500).json({ error: "Błąd serwera", details: error.message });
  }
};

//zs
exports.getDishRevenuePrediction100 = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;

    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    // console.log(`Danie: ${dish.name}, ID: ${dishId}`);

    const data2022 = [200, 190, 205, 210];
    const data2023 = [180, 175, 180, 190];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

    let projectedOrders = [initialOrders];
    let currentOrders = initialOrders;

    for (let i = 0; i < averageChanges.length; i++) {
      currentOrders = currentOrders * (1 + averageChanges[i] / 100);
      projectedOrders.push(currentOrders);
    }

    let totalIngredientCost = 0;
    let ingredientDetails = [];

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientWeightInDish = parseFloat(ingTemplate.weight);

      //   console.log(
      //     `Składnik: ${ingredientName}, Potrzebna waga: ${ingredientWeightInDish}`
      //   );

      const matchingIngredients = await Ingredient.find({
        name: ingredientName,
      });

      if (matchingIngredients.length === 0) {
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

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

    const projectedRevenues = projectedOrders.map((order) => {
      const profitPerDish = marginValue;
      return order * profitPerDish;
    });

    const totalProjectedRevenue = projectedRevenues.reduce(
      (sum, revenue) => sum + revenue,
      0
    );

    // console.log(
    //   `Prognoza dla dania ${dish.name}: Zamówienia - ${projectedOrders}, Przychód - ${projectedRevenues}`
    // );

    return res.status(200).json({
      dishName: dish.name,
      dishPrice: dish.price,
      projectedOrders,
      projectedRevenues,
      totalProjectedRevenue,
      profitMargin,
      marginValue,
      ingredientDetails,
    });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodu:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodu." });
  }
};

exports.getDishRevenuePredictiondziala3 = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;

    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    // console.log(`Danie: ${dish.name}, ID: ${dishId}`);

    const data2022 = [200, 190, 205, 210];
    const data2023 = [180, 175, 180, 190];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

    let projectedOrders = [initialOrders];
    let currentOrders = initialOrders;

    for (let i = 0; i < averageChanges.length; i++) {
      currentOrders = currentOrders * (1 + averageChanges[i] / 100);
      projectedOrders.push(currentOrders);
    }

    let totalIngredientCost = 0;
    let ingredientDetails = [];

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientWeightInDish = parseFloat(ingTemplate.weight);

      //   console.log(
      //     `Składnik: ${ingredientName}, Potrzebna waga: ${ingredientWeightInDish}`
      //   );

      const matchingIngredients = await Ingredient.find({
        name: ingredientName,
      });

      if (matchingIngredients.length === 0) {
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

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

    const projectedRevenues = projectedOrders.map((order) => {
      const profitPerDish = marginValue;
      return order * profitPerDish;
    });

    // console.log(
    //   `Prognoza dla dania ${dish.name}: Zamówienia - ${projectedOrders}, Przychód - ${projectedRevenues}`
    // );

    return res.status(200).json({
      dishName: dish.name,
      projectedOrders,
      projectedRevenues,
      profitMargin,
      marginValue,
      ingredientDetails,
    });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodu:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodu." });
  }
};

exports.getDishRevenuePredictionsdziala2 = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;

    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    // console.log(`Danie: ${dish.name}, ID: ${dishId}`);

    const data2022 = [200, 190, 205, 210];
    const data2023 = [180, 175, 180, 190];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

    let projectedOrders = [initialOrders];
    let currentOrders = initialOrders;

    for (let i = 0; i < averageChanges.length; i++) {
      currentOrders = currentOrders * (1 + averageChanges[i] / 100);
      projectedOrders.push(currentOrders);
    }

    let totalIngredientCost = 0;
    let ingredientDetails = [];

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientWeightInDish = parseFloat(ingTemplate.weight);

      //   console.log(
      //     `Składnik: ${ingredientName}, Potrzebna waga: ${ingredientWeightInDish}`
      //   );

      const matchingIngredients = await Ingredient.find({
        name: ingredientName,
      });

      if (matchingIngredients.length === 0) {
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

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
      });
    }

    const profitMargin =
      ((dish.price - totalIngredientCost) / dish.price) * 100;

    const projectedRevenues = projectedOrders.map((order) => {
      const profitPerDish = dish.price - totalIngredientCost;
      return order * profitPerDish;
    });

    // console.log(
    //   `Prognoza dla dania ${dish.name}: Zamówienia - ${projectedOrders}, Przychód - ${projectedRevenues}`
    // );

    return res.status(200).json({
      dishName: dish.name,
      projectedOrders,
      projectedRevenues,
      profitMargin,
      ingredientDetails,
    });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodu:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodu." });
  }
};

exports.getDishRevenuePredictionDZIALA = async (req, res, next) => {
  try {
    const dishId = req.params.dishId;

    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ message: "Nie znaleziono dania." });
    }

    // console.log(`Danie: ${dish.name}, ID: ${dishId}`);

    const data2022 = [200, 190, 205, 210];
    const data2023 = [180, 175, 180, 190];
    const initialOrders = 100;

    const calculatePercentageChanges = (array) => {
      const changes = [];
      for (let i = 1; i < array.length; i++) {
        const change = ((array[i] - array[i - 1]) / array[i - 1]) * 100;
        changes.push(change);
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

    const averageChanges = calculateAveragePercentageChanges(
      data2022,
      data2023
    );

    let projectedOrders = [initialOrders];
    let currentOrders = initialOrders;

    for (let i = 0; i < averageChanges.length; i++) {
      currentOrders = currentOrders * (1 + averageChanges[i] / 100);
      projectedOrders.push(currentOrders);
    }

    let totalIngredientCost = 0;

    for (const ingTemplate of dish.ingredientTemplates) {
      const ingredientName = ingTemplate.ingredient.name;
      const ingredientWeightInDish = parseFloat(ingTemplate.weight);

      //   console.log(
      //     `Składnik: ${ingredientName}, Potrzebna waga: ${ingredientWeightInDish}`
      //   );

      const matchingIngredients = await Ingredient.find({
        name: ingredientName,
      });

      if (matchingIngredients.length === 0) {
        return res.status(200).json({
          dishName: dish.name,
          message: `Brakuje składnika ${ingredientName}. Nie można przygotować żadnego dania.`,
        });
      }

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
    }

    const profitMargin =
      ((dish.price - totalIngredientCost) / dish.price) * 100;

    const projectedRevenues = projectedOrders.map((order) => {
      const profitPerDish = dish.price - totalIngredientCost;
      return order * profitPerDish;
    });

    // console.log(
    //   `Prognoza dla dania ${dish.name}: Zamówienia - ${projectedOrders}, Przychód - ${projectedRevenues}`
    // );

    return res.status(200).json({
      dishName: dish.name,
      projectedOrders,
      projectedRevenues,
      profitMargin,
    });
  } catch (err) {
    console.error("Błąd podczas prognozowania przychodu:", err);
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas prognozowania przychodu." });
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

exports.addIngredientToDish2 = async (req, res, next) => {
  const { ingredientTemplateId, weight, dishId } = req.body;

  try {
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

exports.deleteIngredient2 = async (req, res, next) => {
  const { dishId, ingredientId } = req.params;
  try {
    const updatedDish = await Dish.findOneAndUpdate(
      { _id: dishId },
      { $pull: { ingredientTemplates: { "ingredient._id": ingredientId } } },
      { new: true }
    );

    if (!updatedDish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    res
      .status(200)
      .json({ message: "Składnik został usunięty.", dish: updatedDish });
  } catch (err) {
    console.error("Błąd podczas usuwania składnika:", err);
    res
      .status(500)
      .json({ message: "Błąd podczas usuwania składnika.", error: err });
  }
};
