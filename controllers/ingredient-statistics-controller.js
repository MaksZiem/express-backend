const Order = require("../models/order");
const Dish = require("../models/dish");
const User = require("../models/user");
const Ingredient = require("../models/ingredient");
const IngredientTemplate = require("../models/ingredientTemplate");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const Tip = require("../models/tip");
const IngredientWaste = require("../models/ingredientWaste");

//nie dziala
// exports.getIngredientUsageByPeriod = async (req, res, next) => {
//     const ingredientName = req.params.ingredientName;
//     const period = req.body.period || "tydzien";
  
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const endOfToday = new Date(today);
//     endOfToday.setHours(23, 59, 59, 999);
  
//     let startDate;
//     if (period === "tydzien") {
//       startDate = new Date(today);
//       startDate.setDate(today.getDate() - 6);
//     } else if (period === "miesiac") {
//       startDate = new Date(today.getFullYear(), today.getMonth(), 1);
//     } else if (period === "rok") {
//       startDate = new Date(today.getFullYear(), 0, 1); // Początek roku
//     } else {
//       return res.status(400).json({
//         message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
//       });
//     }
  
//     try {
//       const orders = await Order.find({
//         orderDate: { $gte: startDate, $lte: endOfToday },
//       });
  
//       if (orders.length === 0) {
//         return res.status(404).json({ message: "Brak zamówień w wybranym okresie." });
//       }
  
//       let usageData = [];
//       let labels = [];
//       let totalUsage = 0;
  
//       if (period === "tydzien") {
//         usageData = Array(7).fill(0);
//         labels = Array.from({ length: 7 }, (_, i) => {
//           const day = new Date(today);
//           day.setDate(today.getDate() - (6 - i));
//           return day.toLocaleDateString("pl-PL", { weekday: "short" });
//         });
//       } else if (period === "miesiac") {
//         const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
//         usageData = Array(daysInMonth).fill(0);
//         labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
//       } else if (period === "rok") {
//         usageData = Array(12).fill(0);
//         labels = Array.from({ length: 12 }, (_, i) => new Date(today.getFullYear(), i, 1).toLocaleString("pl-PL", { month: "short" }));
//       }
  
//       orders.forEach((order) => {
//         const orderDate = new Date(order.orderDate);
  
//         order.dishes.forEach((dishItem) => {
//           const dish = dishItem.dish;
//           if (!dish || !dish.ingredientTemplates) return;
  
//           dish.ingredientTemplates.forEach((ingTemplate) => {
//             if (ingTemplate.ingredient.name === ingredientName) {
//               const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
//               totalUsage += ingredientUsage;
  
//               if (period === "tydzien") {
//                 const daysAgo = Math.floor((endOfToday - orderDate) / (1000 * 60 * 60 * 24));
//                 if (daysAgo >= 0 && daysAgo < 7) {
//                   const dayIndex = 6 - daysAgo;
//                   usageData[dayIndex] += ingredientUsage;
//                 }
//               } else if (period === "miesiac") {
//                 const dayIndex = orderDate.getDate() - 1;
//                 usageData[dayIndex] += ingredientUsage;
//               } else if (period === "rok") {
//                 const monthIndex = orderDate.getMonth();
//                 usageData[monthIndex] += ingredientUsage;
//               }
//             }
//           });
//         });
//       });
  
//       res.status(200).json({
//         ingredientName: ingredientName,
//         totalUsage: totalUsage.toFixed(2),
//         usageByPeriod: usageData.map((usage, index) => ({
//           period: labels[index],
//           usage: usage.toFixed(2),
//         })),
//       });
//     } catch (err) {
//       console.error("Błąd podczas obliczania zużycia składnika:", err);
//       res.status(500).json({ message: "Wystąpił błąd podczas obliczania zużycia składnika." });
//     }
//   };


exports.getIngredientUsageByPeriod = async (req, res, next) => {
    const ingredientName = req.params.ingredientName;
    const period = req.body.period || "tydzien";
  
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
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // Poprawione obliczenie
    } else {
        return res.status(400).json({
            message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
        });
    }
  
    try {
        const orders = await Order.find({
            orderDate: { $gte: startDate, $lte: endOfToday },
        });
  
        if (orders.length === 0) {
            return res.status(404).json({ message: "Brak zamówień w wybranym okresie." });
        }
  
        let usageData = [];
        let labels = [];
        let totalUsage = 0;
  
        if (period === "tydzien") {
            usageData = Array(7).fill(0);
            labels = Array.from({ length: 7 }, (_, i) => {
                const day = new Date(today);
                day.setDate(today.getDate() - (6 - i));
                return day.toLocaleDateString("pl-PL", { weekday: "short" });
            });
  
            orders.forEach((order) => {
                const orderDate = new Date(order.orderDate);
                const daysAgo = Math.floor((endOfToday - orderDate) / (1000 * 60 * 60 * 24));
  
                if (daysAgo >= 0 && daysAgo < 7) {
                    const dayIndex = 6 - daysAgo;
  
                    order.dishes.forEach((dishItem) => {
                        const dish = dishItem.dish;
                        if (!dish || !dish.ingredientTemplates) return;
  
                        dish.ingredientTemplates.forEach((ingTemplate) => {
                            if (ingTemplate.ingredient.name === ingredientName) {
                                const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                                usageData[dayIndex] += ingredientUsage;
                                totalUsage += ingredientUsage;
                            }
                        });
                    });
                }
            });
        } else if (period === "miesiac") {
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            usageData = Array(daysInMonth).fill(0);
            labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  
            orders.forEach((order) => {
                const orderDate = new Date(order.orderDate);
                const dayIndex = orderDate.getDate() - 1;
  
                order.dishes.forEach((dishItem) => {
                    const dish = dishItem.dish;
                    if (!dish || !dish.ingredientTemplates) return;
  
                    dish.ingredientTemplates.forEach((ingTemplate) => {
                        if (ingTemplate.ingredient.name === ingredientName) {
                            const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                            usageData[dayIndex] += ingredientUsage;
                            totalUsage += ingredientUsage;
                        }
                    });
                });
            });
        } else if (period === "rok") {
            usageData = Array(12).fill(0);
            labels = [];
            for (let i = 0; i < 12; i++) {
                const monthIndex = (today.getMonth() - i + 12) % 12;
                labels.unshift(monthIndex + 1);
            }
  
            orders.forEach((order) => {
                const orderDate = new Date(order.orderDate);
                const diffMonths = (orderDate.getFullYear() - startDate.getFullYear()) * 12 + orderDate.getMonth() - startDate.getMonth();
                if (diffMonths >= 0 && diffMonths < 12) {
                    order.dishes.forEach((dishItem) => {
                        const dish = dishItem.dish;
                        if (!dish || !dish.ingredientTemplates) return;
  
                        dish.ingredientTemplates.forEach((ingTemplate) => {
                            if (ingTemplate.ingredient.name === ingredientName) {
                                const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                                usageData[diffMonths] += ingredientUsage;
                                totalUsage += ingredientUsage;
                            }
                        });
                    });
                }
            });
        }
  
        res.status(200).json({
            ingredientName: ingredientName,
            totalUsage: totalUsage.toFixed(2),
            usageByPeriod: usageData.map((usage, index) => ({
                period: labels[index],
                usage: usage.toFixed(2),
            })),
        });
    } catch (err) {
        console.error("Błąd podczas obliczania zużycia składnika:", err);
        res.status(500).json({ message: "Wystąpił błąd podczas obliczania zużycia składnika." });
    }
};


//2901 dzialajace
exports.getIngredientUsageByPeriod2901 = async (req, res, next) => {
    const ingredientName = req.params.ingredientName;
    const period = req.body.period || "tydzien";
  
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
    //   startDate = new Date(today);
    //   startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
    //   startDate.setDate(1);
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }
  
    try {
      const orders = await Order.find({
        orderDate: { $gte: startDate, $lte: endOfToday },
      });
  
      if (orders.length === 0) {
        return res.status(404).json({ message: "Brak zamówień w wybranym okresie." });
      }
  
      let usageData = [];
      let labels = [];
      let totalUsage = 0;
  
      if (period === "tydzien") {
        usageData = Array(7).fill(0);
        labels = Array.from({ length: 7 }, (_, i) => {
          const day = new Date(today);
          day.setDate(today.getDate() - (6 - i));
          return day.toLocaleDateString("pl-PL", { weekday: "short" });
        });
  
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          const daysAgo = Math.floor((endOfToday - orderDate) / (1000 * 60 * 60 * 24));
  
          if (daysAgo >= 0 && daysAgo < 7) {
            const dayIndex = 6 - daysAgo;
  
            order.dishes.forEach((dishItem) => {
              const dish = dishItem.dish;
              if (!dish || !dish.ingredientTemplates) return;
  
              dish.ingredientTemplates.forEach((ingTemplate) => {
                if (ingTemplate.ingredient.name === ingredientName) {
                  const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                  usageData[dayIndex] += ingredientUsage;
                  totalUsage += ingredientUsage;
                }
              });
            });
          }
        });
      } else if (period === "miesiac") {
        const daysInMonth = today.getDate();
        usageData = Array(daysInMonth).fill(0);
        labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          const dayIndex = orderDate.getDate() - 1;
  
          order.dishes.forEach((dishItem) => {
            const dish = dishItem.dish;
            if (!dish || !dish.ingredientTemplates) return;
  
            dish.ingredientTemplates.forEach((ingTemplate) => {
              if (ingTemplate.ingredient.name === ingredientName) {
                const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                usageData[dayIndex] += ingredientUsage;
                totalUsage += ingredientUsage;
              }
            });
          });
        });
      } else if (period === "rok") {
        const currentMonth = today.getMonth();
        usageData = Array(12).fill(0);
        for (let i = 2; i <= 13; i++) {
          const monthIndex = (today.getMonth() + i) % 12;
          labels.push(monthIndex === 0 ? 12 : monthIndex);
        }
  
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          const monthIndex = orderDate.getMonth();
  
          order.dishes.forEach((dishItem) => {
            const dish = dishItem.dish;
            if (!dish || !dish.ingredientTemplates) return;
  
            dish.ingredientTemplates.forEach((ingTemplate) => {
              if (ingTemplate.ingredient.name === ingredientName) {
                const ingredientUsage = parseFloat(ingTemplate.weight) * dishItem.quantity;
                usageData[monthIndex] += ingredientUsage;
                totalUsage += ingredientUsage;
              }
            });
          });
        });
      }
  
      res.status(200).json({
        ingredientName: ingredientName,
        totalUsage: totalUsage.toFixed(2),
        usageByPeriod: usageData.map((usage, index) => ({
          period: labels[index],
          usage: usage.toFixed(2),
        })),
      });
    } catch (err) {
      console.error("Błąd podczas obliczania zużycia składnika:", err);
      res.status(500).json({ message: "Wystąpił błąd podczas obliczania zużycia składnika." });
    }
  };
  


exports.getIngredientWasteByPeriod = async (req, res, next) => {
  const ingredientName = req.params.ingredientName;
  const period = req.body.period || "miesiac";

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate;
  let labels = [];
  let dataCount = [];

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    labels = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      return day.toLocaleDateString("pl-PL", { weekday: "short" });
    });
    dataCount = Array(7).fill(0);
  } else if (period === "miesiac") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayDate = today.getDate();
    labels = Array.from({ length: todayDate }, (_, i) => (i + 1).toString());
    dataCount = Array(todayDate).fill(0);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
    const currentMonth = today.getMonth();
    labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
      (i + 1).toString()
    );
    dataCount = Array(currentMonth + 1).fill(0);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  console.log(
    `Zakres dat: ${startDate.toISOString()} - ${today.toISOString()}`
  );

  try {
    const wasteEntries = await IngredientWaste.find({
      name: ingredientName,
      addedDate: { $gte: startDate, $lte: today },
    });

    console.log(
      `Znalezione wpisy dla składnika "${ingredientName}":`,
      wasteEntries
    );

    if (wasteEntries.length === 0) {
      return res.status(404).json({
        message: `Brak zapisanych strat dla składnika "${ingredientName}" w wybranym okresie.`,
      });
    }

    wasteEntries.forEach((entry) => {
      const pricePerGram = entry.priceRatio || entry.price / entry.weight;
      const lossValue = entry.weight * pricePerGram;

      if (period === "tydzien") {
        const entryDate = new Date(entry.addedDate);
        entryDate.setHours(0, 0, 0, 0);
        if (entryDate >= startDate && entryDate <= today) {
          const daysAgo = Math.floor(
            (today - entryDate) / (1000 * 60 * 60 * 24)
          );
          const dayIndex = 6 - daysAgo;
          if (dayIndex >= 0 && dayIndex < dataCount.length) {
            dataCount[dayIndex] += lossValue;
          }
        }
      } else if (period === "miesiac") {
        const dayIndex = new Date(entry.addedDate).getDate() - 1;
        if (dayIndex < dataCount.length) {
          dataCount[dayIndex] += lossValue;
        }
      } else if (period === "rok") {
        const monthIndex = new Date(entry.addedDate).getMonth();
        if (monthIndex < dataCount.length) {
          dataCount[monthIndex] += lossValue;
        }
      }
    });

    const usageByPeriod = labels.map((label, index) => ({
      period: label,
      usage: dataCount[index].toFixed(2),
    }));

    res.status(200).json({
      ingredientName: ingredientName,
      totalWeightLoss: wasteEntries
        .reduce((acc, entry) => acc + entry.weight, 0)
        .toFixed(2),
      totalValueLoss: wasteEntries
        .reduce(
          (acc, entry) =>
            acc +
            entry.weight * (entry.priceRatio || entry.price / entry.weight),
          0
        )
        .toFixed(2),
      period: period,
      usageByPeriod: usageByPeriod,
    });
  } catch (err) {
    console.error("Błąd podczas obliczania strat składnika:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania strat składnika." });
  }
};

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

    console.log(thirtyDaysAgo)

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

exports.getIngredientUsageInDishes = async (req, res) => {
  const ingredientName = req.params.ingredientName;

  try {
    const orders = await Order.find({
      "dishes.dish.ingredientTemplates.ingredient.name": ingredientName,
    }).populate({
      path: "dishes.dish",
      populate: {
        path: "ingredientTemplates.ingredient",
      },
    });

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ message: "Nie znaleziono zamówień z tym składnikiem." });
    }

    const ingredientUsage = {};

    orders.forEach((order) => {
      order.dishes.forEach((dishItem) => {
        const dish = dishItem.dish;

        if (dish && dish.ingredientTemplates) {
          dish.ingredientTemplates.forEach((ingTemplate) => {
            const ingredientInDish = ingTemplate.ingredient;

            if (ingredientInDish.name === ingredientName) {
              if (!ingredientUsage[dish._id]) {
                ingredientUsage[dish._id] = {
                  dishName: dish.name,
                  totalQuantity: 0,
                };
              }

              ingredientUsage[dish._id].totalQuantity +=
                dishItem.quantity * parseFloat(ingTemplate.weight);
            }
          });
        }
      });
    });

    return res.status(200).json({
      message: "Znaleziono zamówienia z użyciem składnika.",
      ingredientUsage,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas wyszukiwania zamówień." });
  }
};

exports.getZeroWeightIngredients = async (req, res, next) => {
    try {
      // Wyszukujemy składniki, których waga wynosi 0
      const zeroWeightIngredients = await Ingredient.find({ weight: 0 });
  
      if (zeroWeightIngredients.length === 0) {
        return res.status(404).json({ message: 'Brak składników o wadze 0.' });
      }
      // Zwracamy znalezione składniki
      return res.status(200).json({ ingredients: zeroWeightIngredients });
    } catch (err) {
      console.error(err);
      console.log('tos')
      return res.status(500).json({ message: 'Błąd podczas pobierania składników.' });
    }
  };

  exports.getExpiredIngredients = async (req, res, next) => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // Początek dzisiejszego dnia
  
      // Przesuwamy today na koniec dnia wczorajszego
      const yesterdayEnd = new Date(today);
      yesterdayEnd.setDate(yesterdayEnd.getDate());
      yesterdayEnd.setUTCHours(23, 59, 59, 999); // Koniec dnia wczorajszego
  
      console.log("Porównywana data:", yesterdayEnd);
  
      const expiredIngredients = await Ingredient.find({
        expirationDate: { $lt: yesterdayEnd }, // Sprawdzamy do końca wczorajszego dnia
      });
  
      if (expiredIngredients.length === 0) {
        return res.status(200).json({ message: "Brak przeterminowanych składników." });
      }
  
      console.log(expiredIngredients);
      res.status(200).json({ ingredients: expiredIngredients });
    } catch (err) {
      console.error("Błąd podczas pobierania danych:", err);
      res.status(500).json({ message: "Coś poszło nie tak podczas przetwarzania żądania." });
    }
  };
  


exports.getExpiredIngredientsstare = async (req, res, next) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); 
    console.log(today)
    const expiredIngredients = await Ingredient.find({
      expirationDate: { $lt: today },
    });

    if (expiredIngredients.length === 0) {
      return res
        .status(200)
        .json({ message: "Brak przeterminowanych składników." });
    }

    console.log(expiredIngredients)
    res.status(200).json({ ingredients: expiredIngredients });
  } catch (err) {
    console.error("Błąd podczas pobierania danych:", err);
    res
      .status(500)
      .json({ message: "Coś poszło nie tak podczas przetwarzania żądania." });
  }
};

exports.niedobor = async (req, res, next) => {
  try {
    const ingredients = await Ingredient.find({});

    if (!ingredients || ingredients.length === 0) {
      return res
        .status(404)
        .json({ message: "Brak składników w bazie danych." });
    }

    const today = new Date();
    const oneYearAgo = new Date(today);
oneYearAgo.setFullYear(today.getFullYear() - 1);

    const last30DaysOrders = await Order.find({
      orderDate: { $exists: true },
    });

    const filteredOrders = last30DaysOrders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= oneYearAgo && orderDate < today;
    });

    if (filteredOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "Brak zamówień z ostatnich 30 dni." });
    }

    const results = [];

    for (let ingredient of ingredients) {
      const ingredientName = ingredient.name;
      const totalWeightOfIngredient = ingredient.weight;

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
        results.push({
          ingredientName: ingredientName,
          averageDailyUsage: "0",
          daysUntilOutOfStock: "Nieskończoność",
          shortageProbability: "N/A",
        });
        continue;
      }

      const daysUntilOutOfStock = totalWeightOfIngredient / averageDailyUsage;

      let daysUntilExpiration = null;
      if (ingredient.expirationDate) {
        const expirationDate = new Date(ingredient.expirationDate);
        daysUntilExpiration = Math.ceil(
          (expirationDate - today) / (1000 * 60 * 60 * 24)
        );
      }

      let shortageProbability = 0;
      if (daysUntilOutOfStock <= daysUntilExpiration) {
        shortageProbability =
          (1 - daysUntilOutOfStock / daysUntilExpiration) * 100;
      }

      results.push({
        ingredientName: ingredientName,
        averageDailyUsage: averageDailyUsage.toFixed(2),
        daysUntilOutOfStock: daysUntilOutOfStock.toFixed(2),
        shortageProbability: shortageProbability.toFixed(2) + "%",
      });
    }

    results.sort(
      (a, b) =>
        parseFloat(b.shortageProbability) - parseFloat(a.shortageProbability)
    );

    const top5Ingredients = results.slice(0, 5);

    return res.status(200).json(top5Ingredients);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Wystąpił błąd podczas obliczania." });
  }
};
