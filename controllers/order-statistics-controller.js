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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate;
  switch (period) {
    case "miesiac":
      startDate = new Date(today);
      startDate.setMonth(today.getMonth());
      break;
    case "rok":
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
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
    startDate.setDate(today.getDate() - 6); // startujemy od 6 dni wcześniej

    // Generowanie etykiet od niedzieli
    labels = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      return day.toLocaleDateString("pl-PL", { weekday: "short" });
    });

    // Inicjalizowanie tablicy z zerami na dane
    dataCount = Array(7).fill(0);

    Order.find({ orderDate: { $gte: startDate, $lte: today } })
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            // Obliczamy dzień tygodnia (0 - niedziela, 6 - sobota)
            // const dayOfWeek = orderDate.getDay(); // 0 to niedziela, 6 to sobota
            // dataCount[dayOfWeek]++; // Zwiększamy licznik dla odpowiedniego dnia tygodnia
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo; // Ostatni dzień to indeks 6, wcześniejsze idą wstecz
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

exports.getTotalProfit = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
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

    // console.log(recentOrders)

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
      // Obliczamy średnią priceRatio dla składników
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

        // Obliczanie kosztu składników na podstawie średniej priceRatio i wagi w daniu
        for (const template of ingredientTemplates) {
          const ingredient = template.ingredient;
          const avgPriceRatio = ingredientPriceMap[ingredient.name];

          // Mnożymy priceRatio przez wagę składnika w daniu
          const weightInDish = parseFloat(template.weight); // waga składnika w danym daniu
          const ingredientCostForDish = avgPriceRatio * weightInDish;
          totalIngredientCost += ingredientCostForDish;
        }

        // Obliczanie zysku z dania: cena dania - koszt składników
        const dishProfit =
          (dishPrice - totalIngredientCost) * dishItem.quantity;
        totalProfit += dishProfit;

        // Debugowanie kosztu składników
        // console.log(`Koszt składników dla dania: ${dishItem + totalIngredientCost}`);
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
      // startDate = new Date(today.getFullYear(), 0, 1);
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
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
