const Order = require("../models/order");
const Dish = require("../models/dish");
const User = require("../models/user");
const Ingredient = require("../models/ingredient");
const IngredientTemplate = require("../models/ingredientTemplate");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const Tip = require("../models/tip");

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
      startDate.setMonth(today.getMonth() );
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

  console.log(startDate)
  console.log(endOfToday)

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
              orderDate.getMonth() - startDate.getMonth();
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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
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
            const dayOfWeek = orderDate.getDay(); // 0 to niedziela, 6 to sobota
            dataCount[dayOfWeek]++; // Zwiększamy licznik dla odpowiedniego dnia tygodnia
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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else {
    res.status(400).json({
      message: "Invalid period. Choose 'rok', 'miesiac', or 'tydzien'.",
    });
  }
};


//najnowszy z nocy 0102
exports.getOrdersStats01012 = (req, res, next) => {
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

    console.log(startDate)
    console.log(endDate)

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
              orderDate.getMonth() - startDate.getMonth();
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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "miesiac") {
    // startDate = new Date(today);
    // startDate.setMonth(today.getMonth() - 1);
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = today.getDate();
    // const daysInMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    console.log(today)

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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);

    console.log(startDate)
    console.log(today)

    dataCount = Array(7).fill(0);
    labels = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      return day.toLocaleDateString("pl-PL", { weekday: "short" });
    });

    Order.find({ orderDate: { $gte: startDate, $lte: today } })
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor((orderDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
              dataCount[daysAgo]++;
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
        res.status(500).json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else {
    res.status(400).json({
      message: "Invalid period. Choose 'rok', 'miesiac', or 'tydzien'.",
    });
  }
};

exports.getOrdersStats0102 = (req, res, next) => {
  const today = new Date();
  let startDate;
  const period = req.body.periodTotal || "rok";

  let dataCount = [];
  let labels = [];

  if (period === "rok") {
    // startDate = new Date(today);
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    startDate.setDate(1);

    dataCount = Array(12).fill(0);
    labels = [];

    console.log(today);
    // Przygotowanie etykiet z uwzględnieniem bieżącego miesiąca jako punktu początkowego
    for (let i = 2; i <= 13; i++) {
      const monthIndex = (today.getMonth() + i) % 12; // Przesunięcie o i
      labels.push(monthIndex === 0 ? 12 : monthIndex); // Dodanie miesiąca (12 zamiast 0)
    }

    const endDate = new Date(today);

    

    Order.find({
      orderDate: {
        $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1),
        $lt: endDate,
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
            const normalizedIndex = diffMonths % 12; // Indeks w tablicy
            dataCount[normalizedIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        console.log(dataCount)

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatnich 12 miesięcy.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1);

    console.log(startDate)

    const daysInMonth = today.getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    Order.find({})
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

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego miesiąca.`,
          ...responseData,
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

    dataCount = Array(7).fill(0);
    labels = Array(7);

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
    }

    Order.find({})
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego tygodnia.`,
          ...responseData,
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

exports.getOrdersStatsCLOSE = (req, res, next) => {
  const today = new Date();
  let startDate;
  const period = req.body.periodTotal || "rok";

  let dataCount = [];
  let labels = [];

  if (period === "rok") {
    // startDate = new Date(today);
    startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    startDate.setDate(1);

    dataCount = Array(12).fill(0);
    labels = [];

    console.log(today);
    // Przygotowanie etykiet z uwzględnieniem bieżącego miesiąca jako punktu początkowego
    for (let i = 2; i <= 13; i++) {
      const monthIndex = (today.getMonth() + i) % 12; // Przesunięcie o i
      labels.push(monthIndex === 0 ? 12 : monthIndex); // Dodanie miesiąca (12 zamiast 0)
    }

    const endDate = new Date(today);

    

    Order.find({
      orderDate: {
        $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1),
        $lt: endDate,
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
            const normalizedIndex = diffMonths % 12; // Indeks w tablicy
            dataCount[normalizedIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        console.log(dataCount)

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatnich 12 miesięcy.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1);

    console.log(startDate)

    const daysInMonth = today.getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    Order.find({})
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

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego miesiąca.`,
          ...responseData,
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

    dataCount = Array(7).fill(0);
    labels = Array(7);

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
    }

    Order.find({})
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego tygodnia.`,
          ...responseData,
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

exports.getOrdersStatszlelabele = (req, res, next) => {
  const today = new Date();

  let startDate;
  const period = req.body.periodTotal || "rok";

  let dataCount = [];
  let labels = [];

  if (period === "rok") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 11);
    startDate.setDate(1);

    dataCount = Array(12).fill(0);
    labels = [];

    // Przygotowanie etykiet z uwzględnieniem bieżącego miesiąca jako punktu początkowego
    for (let i = 0; i < 12; i++) {
      const monthIndex = (today.getMonth() + i + 1) % 12; // Obliczenie indeksu miesiąca
      const monthDate = new Date(2025, monthIndex); // Dowolny rok, aby pobrać nazwę miesiąca
      labels.push(monthDate.toLocaleDateString("pl-PL", { month: "long" }));
    }

    const endDate = new Date(today);

    console.log(startDate)

    Order.find({
      orderDate: {
        $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1),
        $lt: endDate,
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
            const normalizedIndex = (diffMonths + today.getMonth()) % 12; // Indeks w tablicy
            dataCount[normalizedIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatnich 12 miesięcy.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1);

    const daysInMonth = today.getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    Order.find({})
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

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego miesiąca.`,
          ...responseData,
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

    dataCount = Array(7).fill(0);
    labels = Array(7);

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
    }

    Order.find({})
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego tygodnia.`,
          ...responseData,
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

exports.getOrdersStatsclose = (req, res, next) => {
  const today = new Date();
  // today.setHours(0, 0, 0, 0); // Ustawienie godziny na północ

  let startDate;
  const period = req.body.periodTotal || "rok"; // Domyślnie "rok"

  let dataCount = [];
  let labels = [];

  // Jeśli wybrano "rok", to zwrócimy dane za ostatnie 12 miesięcy
  if (period === "rok") {
    // Ustawienie daty początkowej na 12 miesięcy wstecz, na pierwszy dzień miesiąca
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 11); // 12 miesięcy wstecz
    startDate.setDate(1); // Pierwszy dzień miesiąca

    // Przygotowanie tablicy dla 12 miesięcy
    dataCount = Array(12).fill(0);
    labels = [];

    // Ustawienie etykiet na nazwy miesięcy
    for (let i = 0; i < 12; i++) {
      const month = new Date(startDate);
      labels.push(month.toLocaleDateString("pl-PL", { month: "long" }));
      startDate.setMonth(startDate.getMonth() + 1);
    }

    // Ustawienie daty końcowej na dzisiaj (północ)
    const endDate = new Date(today);

    console.log(startDate.setMonth(today.getMonth() - 11));

    // Pobieranie zamówień z ostatnich 12 miesięcy
    Order.find({
      orderDate: {
        $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1), // Początek roku
        $lt: endDate, // Dzisiejszy dzień
      },
    })
      .then((orders) => {
        console.log(orders);
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0); // Ustawienie godziny na północ

          console.log(startDate);
          console.log(endDate);

          // Sprawdzamy, czy zamówienie mieści się w okresie ostatnich 12 miesięcy
          if (orderDate >= startDate && orderDate <= endDate) {
            const orderMonth = orderDate.getMonth(); // Pobieramy miesiąc z daty zamówienia
            // Dodajemy zamówienie do odpowiedniego miesiąca
            dataCount[orderMonth]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatnich 12 miesięcy.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  }
  // Jeśli wybrano "miesiac", zliczamy dane za ostatni miesiąc
  else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1); // 1 miesiąc wstecz

    // Przygotowanie tablicy dla dni w miesiącu
    const daysInMonth = today.getDate();
    dataCount = Array(daysInMonth).fill(0);
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    // Pobieranie zamówień
    Order.find({})
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          // Sprawdzamy, czy zamówienie mieści się w ostatnim miesiącu
          if (orderDate >= startDate && orderDate <= today) {
            const dayIndex = orderDate.getDate() - 1;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego miesiąca.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  }
  // Jeśli wybrano "tydzien", zliczamy dane za ostatni tydzień
  else if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // 7 dni wstecz

    // Przygotowanie tablicy dla 7 dni w tygodniu
    dataCount = Array(7).fill(0);
    labels = Array(7);

    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
    }

    // Pobieranie zamówień
    Order.find({})
      .then((orders) => {
        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          // Sprawdzamy, czy zamówienie mieści się w ostatnim tygodniu
          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            dataCount[dayIndex]++;
          }
        });

        const totalOrders = dataCount.reduce((acc, count) => acc + count, 0);

        const responseData = {
          data: dataCount,
          labels: labels,
          totalOrders: totalOrders,
        };

        res.status(200).json({
          message: `Statystyki zamówień z ostatniego tygodnia.`,
          ...responseData,
        });
      })
      .catch((err) => {
        console.log(err);
        res
          .status(500)
          .json({ message: "Wystąpił błąd podczas pobierania danych." });
      });
  }
  // Obsługuje nieprawidłowy okres
  else {
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

exports.getOrdersStatsstare = (req, res, next) => {
  const today = new Date();
  //   today.setHours(0, 0, 0, 0);

  let startDate;
  const period = req.body.periodTotal || "tydzien";

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
      let dataCount, labels;

      if (period === "tydzien") {
        dataCount = Array(7).fill(0);
        labels = Array(7);

        for (let i = 0; i < 7; i++) {
          const day = new Date(today);
          day.setDate(today.getDate() - (6 - i));
          labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
        }

        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          if (orderDate >= startDate && orderDate <= today) {
            const daysAgo = Math.floor(
              (today - orderDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = 6 - daysAgo;
            dataCount[dayIndex] += 1;
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
            dataCount[dayIndex] += 1;
          }
        });
      } else if (period === "rok") {
        const currentMonth = today.getMonth();
        dataCount = Array(currentMonth + 1).fill(0);
        labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
          (i + 1).toString()
        );

        startDate.setMonth(today.getMonth() - 10);

        orders.forEach((order) => {
          const orderDate = new Date(order.orderDate);
          orderDate.setHours(0, 0, 0, 0);

          console.log(startDate);
          console.log(today);
          if (orderDate >= startDate && orderDate <= today) {
            const monthIndex = orderDate.getMonth();
            dataCount[monthIndex] += 1;
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
        message: `Statystyki zamówień z ostatniego okresu: ${period}.`,
        ...responseData,
      });
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ message: "Wystąpił błąd podczas pobierania danych." });
    });
};

exports.getTotalProfitclose = async (req, res, next) => {
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
      startDate = new Date(today.getFullYear(), 0, 1);
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
      const avgPrice =
        relevantIngredients.reduce(
          (sum, ingredient) => sum + ingredient.price,
          0
        ) / relevantIngredients.length;
      ingredientPriceMap[name] = avgPrice;
    });

    let totalProfit = 0;

    for (const order of recentOrders) {
      for (const dishItem of order.dishes) {
        const dish = dishMap[dishItem.dish._id];
        if (!dish) continue;

        const dishPrice = dish.price;
        const ingredientTemplates = dish.ingredientTemplates;

        let totalIngredientCost = 0;

        // Nowa logika obliczania kosztu składników (średnia cena składników)
        for (const template of ingredientTemplates) {
          const ingredient = template.ingredient;
          const priceRatio = ingredientPriceMap[ingredient.name];
          console.log(priceRatio);
          const weightInDish = parseFloat(template.weight);
          const ingredientCostForDish = priceRatio * (weightInDish / 100);
          totalIngredientCost += ingredientCostForDish;
        }

        const dishProfit =
          (dishPrice - totalIngredientCost) * dishItem.quantity;
        totalProfit += dishProfit;
        console.log(totalIngredientCost);
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

exports.getTotalProfitstare = async (req, res, next) => {
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
      startDate = new Date(today.getFullYear(), 0, 1);
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
      const avgPrice =
        relevantIngredients.reduce(
          (sum, ingredient) => sum + ingredient.price,
          0
        ) / relevantIngredients.length;
      ingredientPriceMap[name] = avgPrice;
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
          const avgPrice = ingredientPriceMap[template.ingredient.name];
          const weightInDish = parseFloat(template.weight);
          const ingredientCostForDish = avgPrice * (weightInDish / 100);
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
